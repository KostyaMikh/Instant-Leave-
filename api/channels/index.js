const { extractTelegramId, setCors } = require('../_lib/auth');
const { getSession } = require('../_lib/redis');
const { getDialogs } = require('../_lib/gramjs');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  try {
    const session = await getSession(telegramId);
    if (!session) {
      return res.status(401).json({ error: 'Not logged in. Please authenticate first.' });
    }

    const dialogs = await getDialogs(session.sessionString);
    return res.json({ ok: true, dialogs });
  } catch (err) {
    console.error('[channels/index]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
