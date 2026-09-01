/**
 * Run this once after deploying to Vercel to register the bot webhook.
 * Usage: node scripts/set-webhook.js
 * Requires BOT_TOKEN and VERCEL_URL env vars (or set them inline below).
 */

require('dotenv').config({ path: '.env' });

const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL || process.argv[2];

if (!BOT_TOKEN || !VERCEL_URL) {
  console.error('Usage: VERCEL_URL=https://your-app.vercel.app node scripts/set-webhook.js');
  process.exit(1);
}

const webhookUrl = `${VERCEL_URL}/api/bot`;

fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl }),
})
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      console.log(`✅ Webhook set to: ${webhookUrl}`);
    } else {
      console.error('❌ Failed:', data.description);
    }
  })
  .catch(err => console.error('❌ Error:', err.message));
