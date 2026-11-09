// שרת מקומי לבדיקות במחשב. באינטרנט האתר רץ על Vercel, דרך התיקייה api.
// הפעלה: node server.js  ואז לפתוח http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// קוראים את .env (אם קיים) לתוך process.env
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) console.warn('חסרים SUPABASE_URL או SUPABASE_KEY בקובץ .env - הטופס לא יישמר.');

const { handleLead, handleLeads } = require('./api/_supabase');

const TYPES = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg' };

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// רק הקבצים האלה נגישים מהדפדפן. כל השאר חסום.
function publicFile(urlPath) {
  if (urlPath === '/' || urlPath === '/index.html') return 'index.html';
  if (urlPath === '/admin' || urlPath === '/admin.html') return 'admin.html';
  if (/^\/assets\/[\w-]+\.jpg$/.test(urlPath)) return urlPath.slice(1);
  return null;
}

http.createServer(async (req, res) => {
  // הטופס נשלח לכאן
  if (req.method === 'POST' && req.url === '/api/lead') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let input;
      try { input = JSON.parse(body); } catch { return send(res, 400, { error: 'משהו השתבש בשליחה.' }); }
      const out = await handleLead(input);
      send(res, out.status, out.body);
    });
    return;
  }

  // דף הפניות קורא מכאן
  if (req.method === 'GET' && req.url === '/api/leads') {
    const out = await handleLeads(req.headers['x-admin-password']);
    return send(res, out.status, out.body);
  }

  // כל השאר: קבצי האתר
  const name = publicFile(req.url.split('?')[0]);
  if (!name) { res.writeHead(404); return res.end('לא נמצא'); }
  fs.readFile(path.join(ROOT, name), (err, data) => {
    if (err) { res.writeHead(404); return res.end('לא נמצא'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(name)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`האתר רץ: http://localhost:${PORT}`));
