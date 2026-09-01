const express = require('express');
const router = express.Router();
const { sendCode, signInWithCode, signInWith2FA, validateSession } = require('../gramjs');
const { saveSession, getSession, deletePendingAuth, savePendingAuth, getPendingAuth } = require('../db');
const { verifyTelegramWebApp } = require('../middleware/validateWebApp');

// POST /api/auth/send-code
// Body: { telegramId, phone }
router.post('/send-code', verifyTelegramWebApp, async (req, res) => {
  try {
    const { phone } = req.body;
    const telegramId = req.telegramId;

    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    // Normalize phone — ensure it starts with +
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    const { phoneCodeHash } = await sendCode(normalizedPhone);
    savePendingAuth(telegramId, normalizedPhone, phoneCodeHash);

    res.json({ ok: true, message: 'Code sent to your phone' });
  } catch (err) {
    console.error('[Auth] send-code error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-code
// Body: { telegramId, code }
router.post('/verify-code', verifyTelegramWebApp, async (req, res) => {
  try {
    const { code } = req.body;
    const telegramId = req.telegramId;

    if (!code) return res.status(400).json({ error: 'Code is required' });

    const pending = getPendingAuth(telegramId);
    if (!pending) return res.status(400).json({ error: 'No pending auth. Please send code first.' });

    const { sessionString } = await signInWithCode(pending.phone, pending.phoneCodeHash, code);

    saveSession(telegramId, sessionString, pending.phone);
    deletePendingAuth(telegramId);

    res.json({ ok: true, message: 'Logged in successfully' });
  } catch (err) {
    console.error('[Auth] verify-code error:', err.message);

    // Handle 2FA required
    if (err.message && err.message.includes('SESSION_PASSWORD_NEEDED')) {
      return res.status(200).json({ ok: false, requires2FA: true });
    }

    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-2fa
// Body: { telegramId, password }
router.post('/verify-2fa', verifyTelegramWebApp, async (req, res) => {
  try {
    const { password } = req.body;
    const telegramId = req.telegramId;

    if (!password) return res.status(400).json({ error: 'Password is required' });

    const pending = getPendingAuth(telegramId);
    if (!pending) return res.status(400).json({ error: 'No pending auth found.' });

    const { sessionString } = await signInWith2FA(pending.phone, password);

    saveSession(telegramId, sessionString, pending.phone);
    deletePendingAuth(telegramId);

    res.json({ ok: true, message: 'Logged in with 2FA successfully' });
  } catch (err) {
    console.error('[Auth] verify-2fa error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/status
// Checks if user has a valid session
router.get('/status', verifyTelegramWebApp, async (req, res) => {
  try {
    const telegramId = req.telegramId;
    const row = getSession(telegramId);

    if (!row) {
      return res.json({ loggedIn: false });
    }

    const { valid, user } = await validateSession(row.session_string);

    if (!valid) {
      return res.json({ loggedIn: false });
    }

    res.json({ loggedIn: true, user });
  } catch (err) {
    console.error('[Auth] status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', verifyTelegramWebApp, async (req, res) => {
  try {
    const telegramId = req.telegramId;
    const { deleteSession } = require('../db');
    deleteSession(telegramId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
