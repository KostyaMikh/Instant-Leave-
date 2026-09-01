import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Get Telegram initData from the Mini App SDK
function getInitData() {
  if (window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  return '';
}

// Get Telegram user ID (fallback for dev)
function getTelegramId() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return String(window.Telegram.WebApp.initDataUnsafe.user.id);
  }
  return 'dev-user';
}

function getHeaders() {
  const initData = getInitData();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (initData) {
    headers['x-init-data'] = initData;
  } else {
    // Dev mode fallback
    headers['x-telegram-id'] = getTelegramId();
  }

  return headers;
}

export const api = {
  // Auth
  async checkStatus() {
    const res = await axios.get(`${BASE_URL}/auth/status`, { headers: getHeaders() });
    return res.data;
  },

  async sendCode(phone) {
    const res = await axios.post(`${BASE_URL}/auth/send-code`, { phone }, { headers: getHeaders() });
    return res.data;
  },

  async verifyCode(code) {
    const res = await axios.post(`${BASE_URL}/auth/verify-code`, { code }, { headers: getHeaders() });
    return res.data;
  },

  async verify2FA(password) {
    const res = await axios.post(`${BASE_URL}/auth/verify-2fa`, { password }, { headers: getHeaders() });
    return res.data;
  },

  async logout() {
    const res = await axios.post(`${BASE_URL}/auth/logout`, {}, { headers: getHeaders() });
    return res.data;
  },

  // Channels
  async getChannels() {
    const res = await axios.get(`${BASE_URL}/channels`, { headers: getHeaders() });
    return res.data;
  },

  async leaveChannels(ids) {
    const res = await axios.post(`${BASE_URL}/channels/leave`, { ids }, { headers: getHeaders() });
    return res.data;
  },
};
