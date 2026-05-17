from fastapi import WebSocket
from typing import Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Mapeo de family_id a una lista de WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.connection_info: Dict[WebSocket, tuple[int, int]] = {}
        self.user_counts: Dict[int, Dict[int, int]] = {}
        self.last_seen: Dict[int, datetime] = {}

    async def connect(self, websocket: WebSocket, family_id: int, user_id: int):
        await websocket.accept()
        if family_id not in self.active_connections:
            self.active_connections[family_id] = []
            self.user_counts[family_id] = {}
        self.active_connections[family_id].append(websocket)
        self.connection_info[websocket] = (family_id, user_id)
        self.user_counts[family_id][user_id] = self.user_counts[family_id].get(user_id, 0) + 1
        self.last_seen[user_id] = datetime.utcnow()
        logger.info(f"Client connected to family {family_id}. Total: {len(self.active_connections[family_id])}")

    def disconnect(self, websocket: WebSocket, family_id: int):
        if family_id in self.active_connections:
            if websocket in self.active_connections[family_id]:
                self.active_connections[family_id].remove(websocket)
            if websocket in self.connection_info:
                _, user_id = self.connection_info.pop(websocket)
                if user_id in self.user_counts.get(family_id, {}):
                    self.user_counts[family_id][user_id] -= 1
                    if self.user_counts[family_id][user_id] <= 0:
                        del self.user_counts[family_id][user_id]
                        self.last_seen[user_id] = datetime.utcnow()
            if not self.active_connections[family_id]:
                del self.active_connections[family_id]
                del self.user_counts[family_id]
            logger.info(f"Client disconnected from family {family_id}.")

    async def broadcast_to_family(self, family_id: int, message: dict, target_user_ids: Optional[List[int]] = None):
        if family_id in self.active_connections:
            for connection in list(self.active_connections[family_id]):
                try:
                    _, conn_user_id = self.connection_info.get(connection, (None, None))
                    if target_user_ids is not None and conn_user_id not in target_user_ids:
                        continue
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to client: {e}")
                    self.disconnect(connection, family_id)

    def get_online_user_ids(self, family_id: int):
        if family_id in self.user_counts:
            return list(self.user_counts[family_id].keys())
        return []

manager = ConnectionManager()
