const { setCors } = require('./_lib/auth');
const {
  saveSession,
  getSession,
  savePendingAuth,
  getPendingAuth,
  deletePendingAuth,
} = require('./_lib/redis');
const {
  sendCode,
  signInWithCode,
  signInWith2FA,
} = require('./_lib/gramjs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

async function sendMessage(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra }),
  });
}

// In-memory state per user: 'idle' | 'awaiting_phone' | 'awaiting_code' | 'awaiting_2fa'
// On Vercel serverless this resets between cold starts, so we persist state in Redis too
async function getState(telegramId) {
  const pending = await getPendingAuth(telegramId);
  if (!pending) return 'idle';
  if (pending.phoneCodeHash && !pending.awaitingPassword) return 'awaiting_code';
  if (pending.awaitingPassword) return 'awaiting_2fa';
  return 'awaiting_phone';
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const update = req.body;
    const msg = update?.message;
    if (!msg || !msg.text) return res.status(200).end();

    const chatId = msg.chat.id;
    const telegramId = String(chatId);
    const text = msg.text.trim();

    // ── /start ───────────────────────────────────────────
    if (text === '/start') {
      const session = await getSession(telegramId);
      if (session) {
        await sendMessage(chatId,
          `👋 Welcome back! You're already logged in.\n\nTap the button below to manage your channels:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚪 Open Instant Leave', web_app: { url: WEBAPP_URL } }
              ]]
            }
          }
        );
      } else {
        await sendMessage(chatId,
          `👋 *Welcome to Instant Leave!*\n\nThis app lets you instantly leave Telegram channels and groups.\n\nTo get started, please send me your phone number in international format:\n\n📱 Example: \`+14155552671\``
        );
        await savePendingAuth(telegramId, '', '');
      }
      return res.status(200).end();
    }

    // ── /logout ──────────────────────────────────────────
    if (text === '/logout') {
      const { deleteSession } = require('./_lib/redis');
      await deleteSession(telegramId);
      await deletePendingAuth(telegramId);
      await sendMessage(chatId, '✅ Logged out. Send /start to sign in again.');
      return res.status(200).end();
    }

    // ── /help ────────────────────────────────────────────
    if (text === '/help') {
      await sendMessage(chatId,
        `ℹ️ *Instant Leave Help*\n\n` +
        `1. Send /start to begin login\n` +
        `2. Send your phone number (e.g. \`+14155552671\`)\n` +
        `3. Send the confirmation code Telegram sends you\n` +
        `4. If you have 2FA, send your cloud password\n` +
        `5. Tap *Open Instant Leave* to manage your chats\n\n` +
        `Use /logout to remove your session.`
      );
      return res.status(200).end();
    }

    // ── Conversation state machine ────────────────────────
    const state = await getState(telegramId);

    // Awaiting phone number
    if (state === 'idle' || state === 'awaiting_phone' || text.startsWith('+') || /^\d[\d\s\-()]+$/.test(text)) {
      const session = await getSession(telegramId);
      if (session && state === 'idle') {
        // Already logged in, unknown message
        await sendMessage(chatId,
          `You're already logged in! Tap below to open the app, or send /logout to sign out.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚪 Open Instant Leave', web_app: { url: WEBAPP_URL } }
              ]]
            }
          }
        );
        return res.status(200).end();
      }

      if (state === 'awaiting_code') {
        // They sent something that looks like a phone but we're waiting for a code
        // Fall through to code handling below
      } else if (text.startsWith('+') || /^\d[\d\s\-()]+$/.test(text)) {
        // Treat as phone number
        const phone = text.replace(/[\s\-()]/g, '');
        const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

        await sendMessage(chatId, `📱 Sending code to ${normalizedPhone}...`);

        try {
          const { phoneCodeHash } = await sendCode(normalizedPhone);
          await savePendingAuth(telegramId, normalizedPhone, phoneCodeHash);
          await sendMessage(chatId,
            `✅ Code sent! Check your Telegram app for a message from Telegram.\n\nPlease send me the *5-digit code* you received:`
          );
        } catch (err) {
          await sendMessage(chatId, `❌ Failed to send code: ${err.message}\n\nPlease check your phone number and try again.`);
          await deletePendingAuth(telegramId);
        }
        return res.status(200).end();
      }
    }

    // Awaiting verification code
    if (state === 'awaiting_code') {
      const pending = await getPendingAuth(telegramId);
      const code = text.replace(/\s/g, '');

      if (!/^\d{4,8}$/.test(code)) {
        await sendMessage(chatId, `Please send just the numeric code (e.g. \`12345\`).`);
        return res.status(200).end();
      }

      try {
        const { sessionString } = await signInWithCode(pending.phone, pending.phoneCodeHash, code);
        await saveSession(telegramId, sessionString, pending.phone);
        await deletePendingAuth(telegramId);

        await sendMessage(chatId,
          `✅ *Logged in successfully!*\n\nTap below to open the app and leave channels/groups:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚪 Open Instant Leave', web_app: { url: WEBAPP_URL } }
              ]]
            }
          }
        );
      } catch (err) {
        if (err.message?.includes('SESSION_PASSWORD_NEEDED')) {
          // Mark as awaiting 2FA
          const pending = await getPendingAuth(telegramId);
          await savePendingAuth(telegramId, pending.phone, pending.phoneCodeHash);
          // Store 2FA flag
          const { Redis } = require('@upstash/redis');
          const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          await redis.set(`pending:${telegramId}`,
            JSON.stringify({ ...pending, awaitingPassword: true }),
            { ex: 600 }
          );
          await sendMessage(chatId,
            `🔐 Your account has *Two-Step Verification* enabled.\n\nPlease send me your cloud password:`
          );
        } else if (err.message?.includes('PHONE_CODE_INVALID')) {
          await sendMessage(chatId, `❌ Invalid code. Please check and try again:`);
        } else if (err.message?.includes('PHONE_CODE_EXPIRED')) {
          await deletePendingAuth(telegramId);
          await sendMessage(chatId, `❌ Code expired. Send /start to request a new one.`);
        } else {
          await sendMessage(chatId, `❌ Error: ${err.message}\n\nSend /start to try again.`);
          await deletePendingAuth(telegramId);
        }
      }
      return res.status(200).end();
    }

    // Awaiting 2FA password
    if (state === 'awaiting_2fa') {
      const pending = await getPendingAuth(telegramId);
      try {
        const { sessionString } = await signInWith2FA(pending.phone, text);
        await saveSession(telegramId, sessionString, pending.phone);
        await deletePendingAuth(telegramId);

        await sendMessage(chatId,
          `✅ *Logged in successfully!*\n\nTap below to open the app:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚪 Open Instant Leave', web_app: { url: WEBAPP_URL } }
              ]]
            }
          }
        );
      } catch (err) {
        if (err.message?.includes('PASSWORD_HASH_INVALID')) {
          await sendMessage(chatId, `❌ Wrong password. Please try again:`);
        } else {
          await sendMessage(chatId, `❌ Error: ${err.message}\n\nSend /start to try again.`);
          await deletePendingAuth(telegramId);
        }
      }
      return res.status(200).end();
    }

    // Fallback
    await sendMessage(chatId, `Send /start to begin, or /help for instructions.`);
    return res.status(200).end();

  } catch (err) {
    console.error('[bot webhook]', err.message);
    return res.status(200).end();
  }
};
