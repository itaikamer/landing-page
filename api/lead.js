// Vercel: הטופס "השאירו פרטים" נשלח לכאן
const { handleLead } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  let input;
  try { input = req.body; } catch { return res.status(400).json({ error: 'משהו השתבש בשליחה.' }); }
  const { status, body } = await handleLead(input);
  res.status(status).json(body);
};
