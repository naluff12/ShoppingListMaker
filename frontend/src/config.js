const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/api/ws';

export { API_BASE_URL, WS_BASE_URL };
