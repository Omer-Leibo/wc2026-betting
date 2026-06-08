/**
 * Run once to generate VAPID keys for Web Push notifications.
 * Usage: node server/scripts/generate-vapid-keys.mjs
 *
 * Then add the output to:
 *   - Railway env vars (server):  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   - Vercel env vars  (client):  VITE_VAPID_PUBLIC_KEY  (same public key)
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID keys generated — add these to your environment:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log('\n⚠️  Keep the PRIVATE key secret — never commit it to git.');
console.log('    The PUBLIC key is also needed as VITE_VAPID_PUBLIC_KEY on Vercel.\n');
