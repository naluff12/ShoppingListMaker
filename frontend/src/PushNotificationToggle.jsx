import { useState } from 'react';
import { toast } from 'react-hot-toast';
import usePushNotifications from './usePushNotifications';

export default function PushNotificationToggle({ user }) {
  const { supported, subscribed, busy, subscribe, unsubscribe } = usePushNotifications(user);
  const [expanded, setExpanded] = useState(false);

  if (!supported) return null;

  const handleToggle = async () => {
    if (busy) return;
    if (subscribed) {
      try {
        await unsubscribe();
        toast.success('Notificaciones push desactivadas');
      } catch (e) {
        toast.error('No se pudo desactivar');
      }
    } else {
      try {
        const ok = await subscribe();
        if (!ok) toast.error('No se pudo activar (permiso denegado)');
        else toast.success('Notificaciones push activadas');
      } catch (e) {
        toast.error('No se pudo activar');
      }
    }
  };

  return (
    <div className="glass-panel p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-50 mb-1">Notificaciones push</h3>
          <p className="text-sm text-gray-300">
            Recibe notificaciones en tu dispositivo cuando se creen o actualicen listas.
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-blue-400">
          {expanded ? 'Ocultar' : 'Detalles'}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-300 mb-3">
            Las notificaciones se activan por defecto en todos tus dispositivos suscritos,
            siempre que hayas concedido permiso en cada navegador.
          </p>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              Estado: <strong className={subscribed ? 'text-green-400' : 'text-red-400'}>
                {subscribed ? 'Activas' : 'Inactivas'}
              </strong>
            </div>
            <button
              onClick={handleToggle}
              disabled={busy}
              className={`px-4 py-2 rounded-lg ${subscribed ? 'bg-red-800 hover:bg-red-700' : 'bg-green-800 hover:bg-green-700'} text-white font-medium transition ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {busy ? '...' : subscribed ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      )}
      {!expanded && (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {subscribed ? '🔔 Activadas' : '🔕 Desactivadas'}
          </div>
          <button
            onClick={handleToggle}
            disabled={busy}
            className={`px-3 py-1 rounded text-sm ${subscribed ? 'bg-red-900 hover:bg-red-800' : 'bg-green-900 hover:bg-green-800'} ${busy ? 'opacity-60' : ''}`}
          >
            {busy ? '...' : subscribed ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      )}
    </div>
  );
}
