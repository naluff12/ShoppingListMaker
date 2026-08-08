"""Router WebSocket: presencia y mensajería en tiempo real por familia."""
import json
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from .. import models, security
from ..database import SessionLocal
from ..websockets import manager

router = APIRouter(tags=["ws"])


@router.websocket("/ws/{family_id}")
async def websocket_endpoint(websocket: WebSocket, family_id: int):
    # Authenticate via cookie token
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication")
        return
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        username = payload.get("sub")
        if not isinstance(username, str):
            raise ValueError("Invalid token subject")
    except (JWTError, ValueError, TypeError):
        await websocket.close(code=4001, reason="Invalid authentication")
        return

    # Verify user belongs to the family
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user or family_id not in [f.id for f in user.families]:
            await websocket.close(code=4003, reason="Not authorized for this family")
            return
    finally:
        db.close()

    await manager.connect(websocket, family_id, user.id)
    await manager.broadcast_to_family(family_id, {
        "type": "presence_update",
        "action": "connected",
        "user": {
            "id": user.id,
            "username": user.username,
            "nombre": user.nombre
        },
        "online_user_ids": manager.get_online_user_ids(family_id)
    })
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except ValueError:
                continue

            payload_type = payload.get("type")
            if payload_type == "typing":
                await manager.broadcast_to_family(family_id, {
                    "type": "typing",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "nombre": user.nombre
                    }
                })
            elif payload_type in {"heartbeat", "presence_ping"}:
                manager.last_seen[user.id] = datetime.utcnow()
            elif payload_type == "activity_update":
                activity_data = {
                    "type": "activity_update",
                    "action": payload.get("action"),
                    "list_id": payload.get("list_id"),
                    "list_name": payload.get("list_name"),
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "nombre": user.nombre
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }
                await manager.broadcast_to_family(family_id, activity_data)
            # Ignore other incoming messages; family updates are handled by API endpoints.
    except WebSocketDisconnect:
        manager.disconnect(websocket, family_id)
        await manager.broadcast_to_family(family_id, {
            "type": "presence_update",
            "action": "disconnected",
            "user": {
                "id": user.id,
                "username": user.username,
                "nombre": user.nombre
            },
            "online_user_ids": manager.get_online_user_ids(family_id)
        })
