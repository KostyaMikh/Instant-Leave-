const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;

// In-memory map for clients mid-auth (lives for the duration of the serverless
// function warm instance — enough time for the user to enter their code)
const pendingClients = new Map();

function makeClient(sessionString = '') {
  const session = new StringSession(sessionString);
  return new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
    useWSS: false,
  });
}

// ── Auth ──────────────────────────────────────────────────

async function sendCode(phone) {
  const client = makeClient();
  await client.connect();

  const result = await client.sendCode(
    { apiId: API_ID, apiHash: API_HASH },
    phone
  );

  pendingClients.set(phone, client);
  return { phoneCodeHash: result.phoneCodeHash };
}

async function signInWithCode(phone, phoneCodeHash, code) {
  let client = pendingClients.get(phone);

  if (!client) {
    // Serverless cold start — recreate client and reconnect
    client = makeClient();
    await client.connect();
  }

  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phone,
      phoneCodeHash,
      phoneCode: code,
    })
  );

  const sessionString = client.session.save();
  pendingClients.delete(phone);
  await client.disconnect();
  return { sessionString };
}

async function signInWith2FA(phone, password) {
  let client = pendingClients.get(phone);
  if (!client) {
    throw new Error('Session expired. Please start the login again.');
  }

  const passwordInfo = await client.invoke(new Api.account.GetPassword());
  const check = await client._computeCheck(passwordInfo, password);
  await client.invoke(new Api.auth.CheckPassword({ password: check }));

  const sessionString = client.session.save();
  pendingClients.delete(phone);
  await client.disconnect();
  return { sessionString };
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

    // Skip channels the user owns (can't leave, would need to delete)
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
