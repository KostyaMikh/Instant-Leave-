const { extractTelegramId, setCors } = require('../_lib/auth');
const { getSession } = require('../_lib/redis');
const { validateSession } = require('../_lib/gramjs');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  try {
    const session = await getSession(telegramId);
    if (!session) return res.json({ loggedIn: false });

    const { valid, user } = await validateSession(session.sessionString);
    if (!valid) return res.json({ loggedIn: false });

    return res.json({ loggedIn: true, user });
  } catch (err) {
    console.error('[auth/status]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
