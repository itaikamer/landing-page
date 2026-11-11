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
    const r = await fetch(`${url()}/rest/v1/leads?select=id,name,phone,email,created_at,status,notes,follow_up&order=created_at.desc`, { headers: headersFor(secret) });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return { status: 200, body: { leads: await r.json() } };
  } catch (err) {
    console.error('קריאה מ-Supabase נכשלה:', err.message);
    return { status: 502, body: { error: 'לא הצלחנו לקרוא את הפניות מ-Supabase.' } };
  }
}

// ה-CRM: מעדכנים שלב, הערה או תאריך לחזור של פנייה אחת. מחזיר { status, body } לתשובה.
const STATUSES = ['new', 'contacted', 'meeting', 'won', 'lost'];
async function handleUpdate(header, input) {
  if (!isAuthorized(header)) return { status: 401, body: { error: 'unauthorized' } };
  const secret = process.env.SUPABASE_SECRET_KEY || '';
  if (!secret) return { status: 503, body: { error: 'missing-secret' } };

  const id = Number(input?.id);
  if (!Number.isInteger(id) || id < 1) return { status: 400, body: { error: 'פנייה לא מזוהה.' } };
  const changes = {};
  if ('status' in input) {
    if (!STATUSES.includes(input.status)) return { status: 400, body: { error: 'שלב לא מוכר.' } };
    changes.status = input.status;
  }
  if ('notes' in input) {
    const notes = String(input.notes || '').trim();
    if (notes.length > 2000) return { status: 400, body: { error: 'ההערה ארוכה מדי.' } };
    changes.notes = notes || null;
  }
  if ('follow_up' in input) {
    const d = input.follow_up || null;
    if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { status: 400, body: { error: 'תאריך לא תקין.' } };
    changes.follow_up = d;
  }
  if (!Object.keys(changes).length) return { status: 400, body: { error: 'אין מה לעדכן.' } };
  changes.updated_at = new Date().toISOString();

  try {
    const r = await fetch(`${url()}/rest/v1/leads?id=eq.${id}&select=id,name,phone,email,created_at,status,notes,follow_up`, {
      method: 'PATCH',
      headers: { ...headersFor(secret), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(changes),
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    const [lead] = await r.json();
    if (!lead) return { status: 404, body: { error: 'הפנייה לא נמצאה.' } };
    return { status: 200, body: { lead } };
  } catch (err) {
    console.error('עדכון ב-Supabase נכשל:', err.message);
    return { status: 502, body: { error: 'לא הצלחנו לשמור את השינוי. נסו שוב.' } };
  }
}

module.exports = { handleLead, handleLeads, handleUpdate };
