import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL } from './config';

export const useWebSocket = (familyId) => {
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const heartbeatRef = useRef(null);

    const sendJson = useCallback((payload) => {
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        }
    }, []);

    const shouldReconnectRef = useRef(true);

    const connectWebSocket = useCallback(() => {
        if (!familyId) return;
        shouldReconnectRef.current = true;
        const wsUrl = `${WS_BASE_URL}/${familyId}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('Connected to WebSocket for family', familyId);
            setIsConnected(true);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            heartbeatRef.current = setInterval(() => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: 'heartbeat' }));
                }
            }, 25000);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (err) {
                console.error('Failed to parse websocket message', err);
            }
        };

        ws.onclose = () => {
            if (socketRef.current === ws) {
                socketRef.current = null;
            }
            console.log('Disconnected from WebSocket');
            setIsConnected(false);
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
            if (shouldReconnectRef.current && familyId) {
                reconnectTimerRef.current = setTimeout(() => {
                    connectWebSocket();
                }, 3000);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            if (socketRef.current === ws) {
                ws.close();
            }
        };
    }, [familyId]);

    useEffect(() => {
        if (!familyId) {
            setIsConnected(false);
            return;
        }
        shouldReconnectRef.current = true;
        connectWebSocket();

        return () => {
            shouldReconnectRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            if (socketRef.current) {
                const socket = socketRef.current;
                socketRef.current = null;
                socket.close();
            }
        };
    }, [familyId, connectWebSocket]);

    const connectedState = socketRef.current?.readyState === WebSocket.OPEN || isConnected;
    return { lastMessage, isConnected: connectedState, sendJson };
};
