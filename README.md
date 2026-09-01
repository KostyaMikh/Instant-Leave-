# 🚪 Instant Leave — Telegram Mini App

A Telegram bot with a Mini App that lets users instantly leave channels and groups they no longer want.

## How it works

1. User opens the bot and taps **Open Instant Leave**
2. The Mini App opens inside Telegram
3. User signs in with their phone number (one-time setup)
4. All their channels and groups are listed
5. Select any/all → tap **Leave** → done instantly

---

## Project Structure

```
Stoper4you/
├── backend/          # Node.js API server + Telegram bot
│   ├── src/
│   │   ├── index.js              # Express server entry
│   │   ├── bot.js                # Telegram bot (node-telegram-bot-api)
│   │   ├── db.js                 # SQLite session storage
│   │   ├── gramjs.js             # MTProto client (GramJS)
│   │   ├── routes/
│   │   │   ├── auth.js           # /api/auth/* endpoints
│   │   │   └── channels.js       # /api/channels/* endpoints
│   │   └── middleware/
│   │       └── validateWebApp.js # Telegram initData verification
│   ├── .env                      # Your credentials (never commit)
│   └── package.json
│
└── webapp/           # React Mini App (Vite)
    ├── src/
    │   ├── App.jsx
    │   ├── api.js                # All API calls
    │   ├── screens/
    │   │   ├── LoginScreen.jsx   # Phone → Code → 2FA flow
    │   │   └── ChannelsScreen.jsx# List, filter, search, leave
    │   └── components/
    │       ├── ChannelItem.jsx
    │       └── Spinner.jsx
    ├── .env
    └── package.json
```

---

## Local Development

### Prerequisites
- Node.js 18+
- npm

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../webapp
npm install
```

### 2. Backend is already configured

`backend/.env` already contains your credentials. Nothing to change for local dev.

### 3. Start the backend

```bash
cd backend
npm run dev
```

Server starts on `http://localhost:3001`

### 4. Start the frontend

```bash
cd webapp
npm run dev
```

App opens on `http://localhost:5173`

> **Note:** To test the Mini App inside Telegram you need a public HTTPS URL.
> Use [ngrok](https://ngrok.com) for local tunneling:
> ```bash
> ngrok http 5173
> ```
> Then set the ngrok URL in BotFather (see step below).

---

## Deployment (Free)

### Backend → Railway

1. Go to [railway.app](https://railway.app) and sign up (free)
2. Click **New Project → Deploy from GitHub repo**
3. Select the `backend/` folder (or push it as its own repo)
4. In Railway dashboard → **Variables**, add:

| Variable | Value |
|---|---|
| `BOT_TOKEN` | `8968033164:AAEo0Uc9QLMIW93nvhxuCdeh_4I_r_yykak` |
| `API_ID` | `33778557` |
| `API_HASH` | `df93ee5e2bde1470f90ed8ebb68c802c` |
| `WEBAPP_URL` | *(your Vercel URL — set after step below)* |
| `NODE_ENV` | `production` |

5. Railway auto-detects Node.js and deploys. Note your Railway URL, e.g.:
   `https://instant-leave-backend.up.railway.app`

---

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (free)
2. Click **New Project → Import Git Repository**
3. Select the `webapp/` folder
4. In **Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://instant-leave-backend.up.railway.app/api` |

5. Deploy. Note your Vercel URL, e.g.:
   `https://instant-leave.vercel.app`

6. Go back to Railway and update `WEBAPP_URL` to your Vercel URL, then redeploy.

---

### Register the Mini App with BotFather

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newapp` (or `/editapp` if the bot exists)
3. Select your bot
4. Set the **Web App URL** to your Vercel URL:
   `https://instant-leave.vercel.app`
5. Done — users can now open it via `/start`

---

## API Endpoints

All endpoints require `x-init-data` header (Telegram WebApp initData).
In dev mode, use `x-telegram-id` header instead.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/auth/status` | Check if user is logged in |
| POST | `/api/auth/send-code` | Send SMS/Telegram code to phone |
| POST | `/api/auth/verify-code` | Verify the code |
| POST | `/api/auth/verify-2fa` | Verify 2FA password |
| POST | `/api/auth/logout` | Delete user session |
| GET | `/api/channels` | Get all channels & groups |
| POST | `/api/channels/leave` | Leave selected chats (`{ ids: [...] }`) |

---

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Opens the Mini App |
| `/help` | Shows usage instructions |
| `/logout` | Removes saved session |

---

## Security Notes

- User sessions (MTProto session strings) are stored in a local SQLite database
- Telegram `initData` is cryptographically verified on every request in production
- `.env` and `data/` folder are gitignored — never commit them
- The bot token and API credentials are only used server-side

---

## Troubleshooting

**"Not logged in" after entering code**
→ Make sure `VITE_API_URL` points to the correct backend URL in Vercel env vars.

**"SESSION_PASSWORD_NEEDED"**
→ Your Telegram account has 2FA. The app handles this automatically — it will prompt for your cloud password.

**Bot doesn't respond to /start**
→ Check Railway logs. Make sure `BOT_TOKEN` env var is set correctly.

**Channels list is empty**
→ GramJS returns only chats where you are a member and not the sole owner. Owned channels that only you admin won't appear.

**CORS error in browser**
→ Make sure `WEBAPP_URL` in the backend env matches exactly the domain of your Vercel deployment (no trailing slash).
