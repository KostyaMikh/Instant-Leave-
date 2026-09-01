const { extractTelegramId, setCors } = require('../_lib/auth');
const { savePendingAuth } = require('../_lib/redis');
const { sendCode } = require('../_lib/gramjs');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ok, telegramId, error } = extractTelegramId(req);
  if (!ok) return res.status(401).json({ error });

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  try {
    const { phoneCodeHash } = await sendCode(normalizedPhone);
    await savePendingAuth(telegramId, normalizedPhone, phoneCodeHash);
    return res.json({ ok: true, message: 'Code sent' });
  } catch (err) {
    console.error('[auth/send-code]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
