const TelegramBot = require('node-telegram-bot-api');

let bot;

async function initBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is not set');

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const webAppUrl = process.env.WEBAPP_URL;

    const welcomeText = `👋 *Welcome to Instant Leave!*\n\nThis app helps you quickly leave Telegram channels and groups you no longer need.\n\nTap the button below to open the app 👇`;

    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 Open Instant Leave',
            web_app: { url: webAppUrl }
          }
        ]]
      }
    });
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
      `ℹ️ *Instant Leave Help*\n\n` +
      `1. Open the Mini App with /start\n` +
      `2. Sign in with your Telegram phone number\n` +
      `3. Your channels and groups will be listed\n` +
      `4. Select the ones you want to leave\n` +
      `5. Tap "Leave Selected" — done!\n\n` +
      `Your session is stored securely on the server.\n` +
      `Use /logout to remove your session.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/logout/, async (msg) => {
    const chatId = msg.chat.id;
    const { deleteSession } = require('./db');
    deleteSession(chatId);
    await bot.sendMessage(chatId, '✅ Your session has been removed. You will need to log in again next time.');
  });

  bot.on('polling_error', (err) => {
    console.error('[Bot] Polling error:', err.message);
  });

  console.log('[Bot] Polling started');
  return bot;
}

function getBot() {
  return bot;
}

module.exports = { initBot, getBot };
