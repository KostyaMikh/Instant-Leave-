const express = require('express');
const router = express.Router();
const { getDialogs, leaveChats } = require('../gramjs');
const { getSession } = require('../db');
const { verifyTelegramWebApp } = require('../middleware/validateWebApp');

// GET /api/channels
// Returns all channels/groups the user is in
router.get('/', verifyTelegramWebApp, async (req, res) => {
  try {
    const telegramId = req.telegramId;
    const row = getSession(telegramId);

    if (!row) {
      return res.status(401).json({ error: 'Not logged in. Please authenticate first.' });
    }

    const dialogs = await getDialogs(row.session_string);
    res.json({ ok: true, dialogs });
  } catch (err) {
    console.error('[Channels] get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/channels/leave
// Body: { ids: ['123', '456', ...] }
router.post('/leave', verifyTelegramWebApp, async (req, res) => {
  try {
    const telegramId = req.telegramId;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No channel IDs provided' });
    }

    const row = getSession(telegramId);
    if (!row) {
      return res.status(401).json({ error: 'Not logged in. Please authenticate first.' });
    }

    const result = await leaveChats(row.session_string, ids);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Channels] leave error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
