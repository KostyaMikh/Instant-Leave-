const { extractTelegramId, setCors } = require('../_lib/auth');
const { getPendingAuth, deletePendingAuth, saveSession } = require('../_lib/redis');
const { signInWith2FA } = require('../_lib/gramjs');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password is required' });

  try {
    const pending = await getPendingAuth(telegramId);
    if (!pending) {
      return res.status(400).json({ error: 'Session expired. Please start login again.' });
    }

    const { sessionString } = await signInWith2FA(pending.phone, password);

    await saveSession(telegramId, sessionString, pending.phone);
    await deletePendingAuth(telegramId);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[auth/verify-2fa]', err.message);

    if (err.message?.includes('PASSWORD_HASH_INVALID')) {
      return res.status(400).json({ error: 'Wrong password. Please try again.' });
    }

    return res.status(500).json({ error: err.message });
  }
};
