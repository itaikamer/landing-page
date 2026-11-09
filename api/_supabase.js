// הקוד המשותף: שמירת פנייה, קריאת פניות ובדיקת הסיסמה.
// משתמשים בו גם Vercel (api/lead.js, api/leads.js) וגם השרת המקומי (server.js).
const crypto = require('crypto');

const url = () => (process.env.SUPABASE_URL || '').replace(/\/+$/, '');

function headersFor(key) {
  const headers = { apikey: key };
  // מפתח מהסוג הישן (JWT) נשלח גם ככותרת Authorization
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

// בודקים את השדות ושומרים פנייה אחת. מחזיר { status, body } לתשובה.
async function handleLead(input) {
  const name = String(input?.name || '').trim();
  const phone = String(input?.phone || '').trim();
  const email = String(input?.email || '').trim();
  if (!name || !phone || !email) return { status: 400, body: { error: 'נא למלא שם, טלפון ואימייל.' } };
  if (name.length > 200 || phone.length > 50 || email.length > 200) return { status: 400, body: { error: 'אחד השדות ארוך מדי.' } };

  try {
    const r = await fetch(`${url()}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...headersFor(process.env.SUPABASE_KEY || ''), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ name, phone, email }),
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  } catch (err) {
    console.error('שמירה ב-Supabase נכשלה:', err.message);
    return { status: 500, body: { error: 'לא הצלחנו לשמור את הפרטים. נסו שוב בעוד רגע.' } };
  }
  return { status: 200, body: { message: `תודה ${name}, קיבלנו את הפרטים. נחזור אליך בהקדם.` } };
}

// הסיסמה מגיעה בכותרת x-admin-password. בלי סיסמה מוגדרת בשרת - אף אחד לא נכנס.
function isAuthorized(header) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof header !== 'string') return false;
  const hash = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(hash(header), hash(encodeURIComponent(expected)));
}

// קוראים את כל הפניות, הכי חדשות קודם. מחזיר { status, body } לתשובה.
async function handleLeads(header) {
  if (!isAuthorized(header)) return { status: 401, body: { error: 'unauthorized' } };
  const secret = process.env.SUPABASE_SECRET_KEY || '';
  if (!secret) return { status: 503, body: { error: 'missing-secret' } };
  try {
    const r = await fetch(`${url()}/rest/v1/leads?select=id,name,phone,email,created_at&order=created_at.desc`, { headers: headersFor(secret) });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return { status: 200, body: { leads: await r.json() } };
  } catch (err) {
    console.error('קריאה מ-Supabase נכשלה:', err.message);
    return { status: 502, body: { error: 'לא הצלחנו לקרוא את הפניות מ-Supabase.' } };
  }
}

module.exports = { handleLead, handleLeads };
