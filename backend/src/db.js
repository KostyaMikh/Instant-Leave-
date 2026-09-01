const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'sessions.db');

let db;

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      telegram_id TEXT PRIMARY KEY,
      session_string TEXT NOT NULL,
      phone TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_auth (
      telegram_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      phone_code_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function saveSession(telegramId, sessionString, phone) {
  const stmt = getDb().prepare(`
    INSERT INTO sessions (telegram_id, session_string, phone, updated_at)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(telegram_id) DO UPDATE SET
      session_string = excluded.session_string,
      phone = excluded.phone,
      updated_at = strftime('%s', 'now')
  `);
  stmt.run(String(telegramId), sessionString, phone || null);
}

function getSession(telegramId) {
  const stmt = getDb().prepare('SELECT * FROM sessions WHERE telegram_id = ?');
  return stmt.get(String(telegramId));
}

function deleteSession(telegramId) {
  const stmt = getDb().prepare('DELETE FROM sessions WHERE telegram_id = ?');
  stmt.run(String(telegramId));
}

function savePendingAuth(telegramId, phone, phoneCodeHash) {
  const stmt = getDb().prepare(`
    INSERT INTO pending_auth (telegram_id, phone, phone_code_hash, created_at)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(telegram_id) DO UPDATE SET
      phone = excluded.phone,
      phone_code_hash = excluded.phone_code_hash,
      created_at = strftime('%s', 'now')
  `);
  stmt.run(String(telegramId), phone, phoneCodeHash);
}

function getPendingAuth(telegramId) {
  const stmt = getDb().prepare('SELECT * FROM pending_auth WHERE telegram_id = ?');
  return stmt.get(String(telegramId));
}

function deletePendingAuth(telegramId) {
  const stmt = getDb().prepare('DELETE FROM pending_auth WHERE telegram_id = ?');
  stmt.run(String(telegramId));
}

module.exports = {
  initDb,
  getDb,
  saveSession,
  getSession,
  deleteSession,
  savePendingAuth,
  getPendingAuth,
  deletePendingAuth
};
