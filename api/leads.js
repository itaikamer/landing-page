// Vercel: דף הפניות קורא מכאן, רק עם הסיסמה
const { handleLeads } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const { status, body } = await handleLeads(req.headers['x-admin-password']);
  res.status(status).json(body);
};
