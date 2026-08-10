import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, getVapidKey } from './config';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications(user) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window) || !window.isSecureContext) return;
    setSupported(true);
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription))).catch(() => {});
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!supported || busy) return false;
    setBusy(true);
    try {
      const publicKey = await getVapidKey();
      if (!publicKey) throw new Error('Notificaciones push no configuradas en el servidor.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const response = await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error('No se pudo registrar el dispositivo.');
      setSubscribed(true);
      return true;
    } finally { setBusy(false); }
  }, [supported, busy]);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
      method: 'DELETE', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()),
    });
    await subscription.unsubscribe(); setSubscribed(false);
  }, []);

  return { supported, subscribed, busy, subscribe, unsubscribe };
}

export default usePushNotifications;
