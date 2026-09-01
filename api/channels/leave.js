const { extractTelegramId, setCors } = require('../_lib/auth');
const { getSession } = require('../_lib/redis');
const { leaveChats } = require('../_lib/gramjs');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  const { ids } = req.body || {};
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No channel IDs provided' });
  }

  try {
    const session = await getSession(telegramId);
    if (!session) {
      return res.status(401).json({ error: 'Not logged in. Please authenticate first.' });
    }

    const result = await leaveChats(session.sessionString, ids);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[channels/leave]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
