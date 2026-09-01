import axios from 'axios';

// On Vercel, /api/* is handled by serverless functions automatically.
// In local dev, Vite proxies /api to localhost:3001 (if running local backend).
// Since we're fully on Vercel now, /api always works in production.
const BASE = '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    headers['x-init-data'] = initData;
  } else {
    // Dev fallback — backend accepts x-telegram-id in non-production mode
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (userId) headers['x-telegram-id'] = String(userId);
    else headers['x-telegram-id'] = 'dev-user';
  }

  return headers;
}

async function request(method, path, data) {
  try {
    const res = await axios({ method, url: `${BASE}${path}`, data, headers: getHeaders() });
    return res.data;
  } catch (err) {
    // Re-throw with the server error message if available
    const msg = err.response?.data?.error || err.message;
    throw new Error(msg);
  }
}

export const api = {
  // Auth
  checkStatus:  ()         => request('GET',  '/auth/status'),
  sendCode:     (phone)    => request('POST', '/auth/send-code',  { phone }),
  verifyCode:   (code)     => request('POST', '/auth/verify-code', { code }),
  verify2FA:    (password) => request('POST', '/auth/verify-2fa', { password }),
  logout:       ()         => request('POST', '/auth/logout'),

  // Channels
  getChannels:    ()    => request('GET',  '/channels'),
  leaveChannels:  (ids) => request('POST', '/channels/leave', { ids }),
};
