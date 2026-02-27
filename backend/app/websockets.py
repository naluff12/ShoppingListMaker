from fastapi import WebSocket
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Mapeo de family_id a una lista de WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, family_id: int):
        await websocket.accept()
        if family_id not in self.active_connections:
            self.active_connections[family_id] = []
        self.active_connections[family_id].append(websocket)
        logger.info(f"Client connected to family {family_id}. Total: {len(self.active_connections[family_id])}")

    def disconnect(self, websocket: WebSocket, family_id: int):
        if family_id in self.active_connections:
            if websocket in self.active_connections[family_id]:
                self.active_connections[family_id].remove(websocket)
            if not self.active_connections[family_id]:
                del self.active_connections[family_id]
            logger.info(f"Client disconnected from family {family_id}.")

    async def broadcast_to_family(self, family_id: int, message: dict):
        if family_id in self.active_connections:
            # Create a copy of the list to avoid Modification during iteration
            for connection in list(self.active_connections[family_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to client: {e}")
                    self.disconnect(connection, family_id)

manager = ConnectionManager()
