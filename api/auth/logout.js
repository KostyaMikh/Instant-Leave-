const { extractTelegramId, setCors } = require('../_lib/auth');
const { deleteSession } = require('../_lib/redis');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  try {
    await deleteSession(telegramId);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
