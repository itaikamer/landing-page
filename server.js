// שרת מקומי לאתר: מציג את האתר ומקבל את טופס "השאירו פרטים".
// הפעלה: node server.js  ואז לפתוח http://localhost:3000
// הפניות נשמרות בטבלה leads ב-Supabase. הכתובת והמפתח נמצאים בקובץ .env
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const HIDDEN = ['leads.json', '.env', '.env.example'];

// קוראים את .env (אם קיים) לתוך process.env
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
// המפתח הציבורי (publishable): הטבלה מרשה איתו רק להוסיף פניות, לא לקרוא אותן
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) console.warn('חסרים SUPABASE_URL או SUPABASE_KEY בקובץ .env - הטופס לא יישמר.');
// המפתח הסודי: רק בשביל דף הפניות (/admin), שקורא את הטבלה
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';

// קוראים את כל הפניות, הכי חדשות קודם
async function listLeads() {
  const headers = { apikey: SUPABASE_SECRET };
  if (SUPABASE_SECRET.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_SECRET}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id,name,phone,email,created_at&order=created_at.desc`, { headers });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

// דף הפניות עונה רק למי שיושב על המחשב הזה
const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// שומרים פנייה אחת בטבלה leads
async function saveLead(lead) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  // מפתח מהסוג הישן (JWT) נשלח גם ככותרת Authorization
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, { method: 'POST', headers, body: JSON.stringify(lead) });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  // הטופס נשלח לכאן
  if (req.method === 'POST' && req.url === '/api/lead') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let lead;
      try { lead = JSON.parse(body); } catch { return send(res, 400, { error: 'משהו השתבש בשליחה.' }); }
      const name = String(lead.name || '').trim();
      const phone = String(lead.phone || '').trim();
      const email = String(lead.email || '').trim();
      if (!name || !phone || !email) return send(res, 400, { error: 'נא למלא שם, טלפון ואימייל.' });

      try {
        await saveLead({ name, phone, email });
      } catch (err) {
        console.error('שמירה ב-Supabase נכשלה:', err.message);
        return send(res, 500, { error: 'לא הצלחנו לשמור את הפרטים. נסו שוב בעוד רגע.' });
      }
      console.log('פנייה חדשה:', name, phone, email);

      send(res, 200, { message: `תודה ${name}, קיבלנו את הפרטים. נחזור אליך בהקדם.` });
    });
    return;
  }

  // דף הפניות קורא מכאן
  if (req.method === 'GET' && req.url === '/api/leads') {
    if (!isLocal(req)) return send(res, 403, { error: 'הדף זמין רק מהמחשב של האתר.' });
    if (!SUPABASE_SECRET) return send(res, 503, { error: 'missing-secret' });
    listLeads()
      .then(leads => send(res, 200, { leads }))
      .catch(err => { console.error('קריאה מ-Supabase נכשלה:', err.message); send(res, 502, { error: 'לא הצלחנו לקרוא את הפניות מ-Supabase.' }); });
    return;
  }

  // כל השאר: קבצי האתר
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if ((urlPath === '/admin' || urlPath === '/admin.html') && !isLocal(req)) { res.writeHead(403); return res.end(); }
  const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath === '/admin' ? 'admin.html' : urlPath);
  if (!file.startsWith(ROOT) || HIDDEN.includes(path.basename(file))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('לא נמצא'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`האתר רץ: http://localhost:${PORT}`));
