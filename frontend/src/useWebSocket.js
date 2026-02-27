import { useState, useEffect } from 'react';

export const useWebSocket = (familyId) => {
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!familyId) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use relative path for production if running on same host, or fallback to dev port
        const wsUrl = import.meta.env.VITE_WS_URL || `ws://localhost:8000/ws/${familyId}`; 
        
        let ws;
        let reconnectTimer;
        
        const connect = () => {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('Connected to WebSocket for family', familyId);
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket Message Received:', data);
                    setLastMessage(data);
                } catch (err) {
                    console.error("Failed to parse websocket message", err);
                }
            };

            ws.onclose = () => {
                console.log('Disconnected from WebSocket');
                setIsConnected(false);
                // Simple reconnect logic
                reconnectTimer = setTimeout(connect, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket Error:', error);
                ws.close();
            };
        };

        connect();

        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (ws) ws.close();
        };
    }, [familyId]);

    return { lastMessage, isConnected };
};
