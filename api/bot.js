const { setCors } = require('./_lib/auth');
const { deleteSession } = require('./_lib/redis');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

async function sendMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: 'Markdown', ...extra };

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const update = req.body;
    const msg = update?.message;
    if (!msg) return res.status(200).end();

    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text.startsWith('/start')) {
      await sendMessage(chatId,
        `👋 *Welcome to Instant Leave!*\n\nQuickly leave Telegram channels and groups you no longer need.\n\nTap below to open the app 👇`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🚪 Open Instant Leave', web_app: { url: WEBAPP_URL } }
            ]]
          }
        }
      );
    } else if (text.startsWith('/help')) {
      await sendMessage(chatId,
        `ℹ️ *How to use Instant Leave*\n\n` +
        `1. Tap /start to open the Mini App\n` +
        `2. Sign in with your Telegram phone number\n` +
        `3. Your channels & groups will be listed\n` +
        `4. Select the ones you want to leave\n` +
        `5. Tap *Leave Selected* — done instantly!\n\n` +
        `Use /logout to remove your saved session.`
      );
    } else if (text.startsWith('/logout')) {
      await deleteSession(String(chatId));
      await sendMessage(chatId, '✅ Your session has been removed. You will need to sign in again next time.');
    }

    return res.status(200).end();
  } catch (err) {
    console.error('[bot webhook]', err.message);
    return res.status(200).end(); // always 200 to Telegram
  }
};
