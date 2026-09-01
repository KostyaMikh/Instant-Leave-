const { extractTelegramId, setCors } = require('../_lib/auth');
const { getPendingAuth, deletePendingAuth, saveSession } = require('../_lib/redis');
const { signInWithCode } = require('../_lib/gramjs');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code is required' });

  try {
    const pending = await getPendingAuth(telegramId);
    if (!pending) {
      return res.status(400).json({ error: 'No pending auth found. Please request a new code.' });
    }

    // Pass the saved sessionString so GramJS reconnects to the correct DC
    const { sessionString } = await signInWithCode(
      pending.phone,
      pending.phoneCodeHash,
      code.trim(),
      pending.sessionString
    );

    await saveSession(telegramId, sessionString, pending.phone);
    await deletePendingAuth(telegramId);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[auth/verify-code]', err.message);

    if (err.message?.includes('SESSION_PASSWORD_NEEDED')) {
      return res.json({ ok: false, requires2FA: true });
    }
    if (err.message?.includes('PHONE_CODE_INVALID')) {
      return res.status(400).json({ error: 'Invalid code. Please try again.' });
    }
    if (err.message?.includes('PHONE_CODE_EXPIRED')) {
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if (err.message?.includes('PHONE_NUMBER_INVALID')) {
      return res.status(400).json({ error: 'Phone number invalid. Please go back and re-enter your number.' });
    }

    return res.status(500).json({ error: err.message });
  }
};
