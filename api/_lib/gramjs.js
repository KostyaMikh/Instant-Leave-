const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;

function makeClient(sessionString = '') {
  const session = new StringSession(sessionString);
  return new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
    useWSS: false,
  });
}

// ── Auth ──────────────────────────────────────────────────

/**
 * Sends a login code to the phone number.
 * Creates a fresh client each time — fully stateless.
 * Returns { phoneCodeHash, sessionString } — we save the session
 * string to Redis so verify-code can reuse the same auth state.
 */
async function sendCode(phone) {
  const client = makeClient();
  await client.connect();

  const result = await client.sendCode(
    { apiId: API_ID, apiHash: API_HASH },
    phone
  );

  // Save the partial session so verify-code can reconnect with same DC
  const sessionString = client.session.save();
  await client.disconnect();

  return { phoneCodeHash: result.phoneCodeHash, sessionString };
}

/**
 * Signs in with the code. Reuses the session string from sendCode
 * so we reconnect to the correct Telegram DC.
 */
async function signInWithCode(phone, phoneCodeHash, code, sessionString) {
  const client = makeClient(sessionString);
  await client.connect();

  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phone,
      phoneCodeHash,
      phoneCode: code.trim(),
    })
  );

  const newSessionString = client.session.save();
  await client.disconnect();
  return { sessionString: newSessionString };
}

/**
 * Signs in with 2FA password.
 */
async function signInWith2FA(phone, password, sessionString) {
  const client = makeClient(sessionString);
  await client.connect();

  const passwordInfo = await client.invoke(new Api.account.GetPassword());
  const check = await client._computeCheck(passwordInfo, password);
  await client.invoke(new Api.auth.CheckPassword({ password: check }));

  const newSessionString = client.session.save();
  await client.disconnect();
  return { sessionString: newSessionString };
}

// ── Session validation ────────────────────────────────────

async function validateSession(sessionString) {
  try {
    const client = makeClient(sessionString);
    await client.connect();
    const me = await client.getMe();
    await client.disconnect();
    return {
      valid: true,
      user: {
        id: me.id.toString(),
        firstName: me.firstName,
        username: me.username || null,
      },
    };
  } catch {
    return { valid: false };
  }
}

// ── Dialogs ───────────────────────────────────────────────

async function getDialogs(sessionString) {
  const client = makeClient(sessionString);
  await client.connect();

  const dialogs = await client.getDialogs({ limit: 200 });
  const result = [];

  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (!entity) continue;

    const isChannel = entity.className === 'Channel';
    const isChat = entity.className === 'Chat';
    if (!isChannel && !isChat) continue;

    if (isChannel && entity.creator) continue;

    result.push({
      id: entity.id.toString(),
      title: entity.title || dialog.name || 'Unknown',
      type: isChannel
        ? entity.megagroup ? 'supergroup' : 'channel'
        : 'group',
      username: entity.username || null,
      membersCount: entity.participantsCount || null,
    });
  }

  await client.disconnect();
  return result;
}

// ── Leave chats ───────────────────────────────────────────

async function leaveChats(sessionString, chatIds) {
  const client = makeClient(sessionString);
  await client.connect();

  const dialogs = await client.getDialogs({ limit: 200 });
  const entityMap = new Map();
  for (const dialog of dialogs) {
    if (dialog.entity) entityMap.set(dialog.entity.id.toString(), dialog.entity);
  }

  const success = [];
  const failed = [];

  for (const chatId of chatIds) {
    const entity = entityMap.get(chatId);
    if (!entity) {
      failed.push({ id: chatId, reason: 'Not found' });
      continue;
    }

    try {
      if (entity.className === 'Channel') {
        await client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
      } else {
        await client.invoke(
          new Api.messages.DeleteChatUser({
            chatId: entity.id,
            userId: new Api.InputUserSelf(),
          })
        );
      }
      success.push(chatId);
    } catch (err) {
      failed.push({ id: chatId, reason: err.message });
    }
  }

  await client.disconnect();
  return { success, failed };
}

module.exports = {
  sendCode,
  signInWithCode,
  signInWith2FA,
  validateSession,
  getDialogs,
  leaveChats,
};
