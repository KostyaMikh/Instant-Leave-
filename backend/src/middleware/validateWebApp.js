const crypto = require('crypto');

/**
 * Validates the Telegram Mini App initData and extracts the user's Telegram ID.
 * In development (NODE_ENV !== 'production'), validation is skipped and
 * telegramId is read from the X-Telegram-Id header for easy testing.
 */
function verifyTelegramWebApp(req, res, next) {
  // Dev mode — skip validation
  if (process.env.NODE_ENV !== 'production') {
    const devId = req.headers['x-telegram-id'];
    if (devId) {
      req.telegramId = devId;
      return next();
    }
  }

  const initData = req.headers['x-init-data'] || req.body?.initData;

  if (!initData) {
    return res.status(401).json({ error: 'Missing Telegram initData' });
  }

  try {
    const parsed = new URLSearchParams(initData);
    const hash = parsed.get('hash');

    if (!hash) return res.status(401).json({ error: 'Missing hash in initData' });

    // Build data-check-string (all fields except hash, sorted alphabetically)
    const dataCheckArr = [];
    for (const [key, value] of [...parsed.entries()].sort()) {
      if (key !== 'hash') dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    // Compute HMAC-SHA256
    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    const expectedHash = crypto.createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      return res.status(401).json({ error: 'Invalid initData signature' });
    }

    // Check expiry (24 hours)
    const authDate = parseInt(parsed.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return res.status(401).json({ error: 'initData expired' });
    }

    // Extract user
    const userStr = parsed.get('user');
    if (!userStr) return res.status(401).json({ error: 'No user in initData' });

    const user = JSON.parse(userStr);
    req.telegramId = String(user.id);
    req.telegramUser = user;
    next();
  } catch (err) {
    console.error('[Auth] initData parse error:', err.message);
    return res.status(401).json({ error: 'Invalid initData' });
  }
}

module.exports = { verifyTelegramWebApp };
