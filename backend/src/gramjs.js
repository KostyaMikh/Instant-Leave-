const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;

/**
 * Creates a TelegramClient from a saved session string.
 * Returns a connected client or null if session is invalid.
 */
async function getClientFromSession(sessionString) {
  const session = new StringSession(sessionString || '');
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
    useWSS: false,
  });

  await client.connect();
  return client;
}

/**
 * Starts login flow — sends code to phone number.
 * Returns { phoneCodeHash, client }
 */
async function sendCode(phone) {
  const session = new StringSession('');
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
    useWSS: false,
  });

  await client.connect();

  const result = await client.sendCode(
    { apiId: API_ID, apiHash: API_HASH },
    phone
  );

  // Store client temporarily in memory keyed by phone
  pendingClients.set(phone, client);

  return { phoneCodeHash: result.phoneCodeHash };
}

/**
 * Signs in with phone code. Returns session string on success.
 */
async function signInWithCode(phone, phoneCodeHash, code) {
  let client = pendingClients.get(phone);

  if (!client) {
    // Recreate client if server restarted
    const session = new StringSession('');
    client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 3,
      useWSS: false,
    });
    await client.connect();
  }

  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phone,
      phoneCodeHash: phoneCodeHash,
      phoneCode: code,
    })
  );

  const sessionString = client.session.save();
  pendingClients.delete(phone);
  return { sessionString, client };
}

/**
 * Signs in with 2FA password.
 */
async function signInWith2FA(phone, password) {
  let client = pendingClients.get(phone);
  if (!client) throw new Error('No pending session for this phone. Please start over.');

  const passwordInfo = await client.invoke(new Api.account.GetPassword());
  await client.invoke(
    new Api.auth.CheckPassword({
      password: await client._computeCheck(passwordInfo, password),
    })
  );

  const sessionString = client.session.save();
  pendingClients.delete(phone);
  return { sessionString, client };
}

/**
 * Gets all dialogs (channels + groups) for a user.
 */
async function getDialogs(sessionString) {
  const client = await getClientFromSession(sessionString);

  const dialogs = await client.getDialogs({ limit: 200 });

  const result = [];
  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (!entity) continue;

    const isChannel = entity.className === 'Channel';
    const isChat = entity.className === 'Chat';

    if (!isChannel && !isChat) continue;

    // Skip if user is the creator/owner of a channel (can't leave, must delete)
    if (isChannel && entity.creator) continue;

    result.push({
      id: entity.id.toString(),
      accessHash: entity.accessHash ? entity.accessHash.toString() : null,
      title: entity.title || dialog.name || 'Unknown',
      type: isChannel ? (entity.megagroup ? 'supergroup' : 'channel') : 'group',
      username: entity.username || null,
      membersCount: entity.participantsCount || null,
      photo: null, // skip photo fetching for performance
    });
  }

  await client.disconnect();
  return result;
}

/**
 * Leaves a list of channels/chats by their IDs.
 * Returns { success: [], failed: [] }
 */
async function leaveChats(sessionString, chatIds) {
  const client = await getClientFromSession(sessionString);

  const dialogs = await client.getDialogs({ limit: 200 });
  const dialogMap = new Map();

  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (entity) {
      dialogMap.set(entity.id.toString(), entity);
    }
  }

  const success = [];
  const failed = [];

  for (const chatId of chatIds) {
    const entity = dialogMap.get(chatId);
    if (!entity) {
      failed.push({ id: chatId, reason: 'Not found in dialogs' });
      continue;
    }

    try {
      if (entity.className === 'Channel') {
        await client.invoke(
          new Api.channels.LeaveChannel({
            channel: entity,
          })
        );
      } else if (entity.className === 'Chat') {
        await client.invoke(
          new Api.messages.DeleteChatUser({
            chatId: entity.id,
            userId: new Api.InputUserSelf(),
          })
        );
      }
      success.push(chatId);
    } catch (err) {
      console.error(`[GramJS] Failed to leave ${chatId}:`, err.message);
      failed.push({ id: chatId, reason: err.message });
    }
  }

  await client.disconnect();
  return { success, failed };
}

/**
 * Checks if a session is still valid.
 */
async function validateSession(sessionString) {
  try {
    const client = await getClientFromSession(sessionString);
    const me = await client.getMe();
    await client.disconnect();
    return { valid: true, user: { id: me.id.toString(), firstName: me.firstName, username: me.username } };
  } catch {
    return { valid: false };
  }
}

// In-memory map for clients mid-auth (keyed by phone)
const pendingClients = new Map();

module.exports = {
  sendCode,
  signInWithCode,
  signInWith2FA,
  getDialogs,
  leaveChats,
  validateSession,
};
