const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const PENDING_TTL = 60 * 10;            // 10 minutes

// ── Sessions ──────────────────────────────────────────────
async function saveSession(telegramId, sessionString, phone) {
  const key = `session:${telegramId}`;
  await redis.set(key, JSON.stringify({ sessionString, phone }), { ex: SESSION_TTL });
}

async function getSession(telegramId) {
  const key = `session:${telegramId}`;
  const val = await redis.get(key);
  if (!val) return null;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

async function deleteSession(telegramId) {
  await redis.del(`session:${telegramId}`);
}

// ── Pending auth (phone code hash while user is logging in) ──
async function savePendingAuth(telegramId, phone, phoneCodeHash) {
  const key = `pending:${telegramId}`;
  await redis.set(key, JSON.stringify({ phone, phoneCodeHash }), { ex: PENDING_TTL });
}

async function getPendingAuth(telegramId) {
  const key = `pending:${telegramId}`;
  const val = await redis.get(key);
  if (!val) return null;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

async function deletePendingAuth(telegramId) {
  await redis.del(`pending:${telegramId}`);
}

module.exports = {
  saveSession,
  getSession,
  deleteSession,
  savePendingAuth,
  getPendingAuth,
  deletePendingAuth,
};
