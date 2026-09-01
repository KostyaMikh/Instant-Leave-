const crypto = require('crypto');

/**
 * Extracts and validates Telegram WebApp initData from the request.
 * Sets req.telegramId on success.
 * Returns { ok, telegramId, error }
 */
function extractTelegramId(req) {
  // Dev mode — accept plain header
  if (process.env.NODE_ENV !== 'production') {
    const devId = req.headers['x-telegram-id'];
    if (devId) return { ok: true, telegramId: devId };
  }

  const initData = req.headers['x-init-data'];
  if (!initData) return { ok: false, error: 'Missing x-init-data header' };

  try {
    const parsed = new URLSearchParams(initData);
    const hash = parsed.get('hash');
    if (!hash) return { ok: false, error: 'Missing hash' };

    // Build data-check-string
    const entries = [...parsed.entries()]
      .filter(([k]) => k !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    const expected = crypto
      .createHmac('sha256', secret)
      .update(entries)
      .digest('hex');

    if (expected !== hash) return { ok: false, error: 'Invalid signature' };

    const authDate = parseInt(parsed.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) {
      return { ok: false, error: 'initData expired' };
    }

    const user = JSON.parse(parsed.get('user') || '{}');
    if (!user.id) return { ok: false, error: 'No user in initData' };

    return { ok: true, telegramId: String(user.id) };
  } catch (err) {
    return { ok: false, error: 'Invalid initData: ' + err.message };
  }
}

/**
 * Sets standard CORS headers on the response.
 */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-init-data,x-telegram-id');
}

module.exports = { extractTelegramId, setCors };
