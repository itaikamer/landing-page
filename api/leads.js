// Vercel: דף הפניות קורא מכאן (GET) ומעדכן פנייה (PATCH), רק עם הסיסמה
const { handleLeads, handleUpdate } = require('./_supabase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const header = req.headers['x-admin-password'];
  if (req.method === 'GET') {
    const { status, body } = await handleLeads(header);
    return res.status(status).json(body);
  }
  if (req.method === 'PATCH') {
    const { status, body } = await handleUpdate(header, req.body || {});
    return res.status(status).json(body);
  }
  res.status(405).json({ error: 'method-not-allowed' });
};
