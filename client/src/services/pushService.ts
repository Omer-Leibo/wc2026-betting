import api from './api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Fetch the server's VAPID public key. Returns null if push isn't configured. */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const { data } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
    return data.publicKey;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if the browser supports push and the server has push enabled. */
export async function isPushSupported(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const key = await getVapidPublicKey();
  return key !== null;
}

/** Returns true if the current browser has an active push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

/**
 * Requests notification permission, subscribes the browser via the SW,
 * and registers the subscription with the server.
 * Returns true on success, false if the user denied or an error occurred.
 */
export async function subscribe(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  // Ask for permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = sub.toJSON() as {
      endpoint: string;
      keys?: { p256dh: string; auth: string };
    };
    if (!json.keys?.p256dh || !json.keys?.auth) return false;

    await api.post('/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });

    return true;
  } catch (err) {
    console.error('[Push] subscribe error:', err);
    return false;
  }
}

/**
 * Unsubscribes the current browser from push notifications
 * and removes the subscription from the server.
 */
export async function unsubscribe(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  } catch (err) {
    console.error('[Push] unsubscribe error:', err);
  }
}
