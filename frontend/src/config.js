const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws';

let VAPID_PUBLIC_KEY = null;

async function getVapidKey() {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try {
    const resp = await fetch(`${API_BASE_URL}/api/notifications/vapid-public-key`, { credentials: 'same-origin' });
    if (!resp.ok) return '';
    const data = await resp.json();
    VAPID_PUBLIC_KEY = data.public_key;
    return VAPID_PUBLIC_KEY;
  } catch (e) {
    console.warn('Could not fetch VAPID key:', e);
    return '';
  }
}

export { API_BASE_URL, WS_BASE_URL, getVapidKey };
