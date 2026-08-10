"""Servicio para enviar notificaciones push a través de Web Push (VAPID)."""
import json
import logging
import os
from typing import Optional
from sqlalchemy.orm import Session, joinedload

from .. import models

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_SUB_MAIL = os.getenv("VAPID_SUB_MAIL", "mailto:admin@shoppinglistmaker.dev")
VAPID_CLAIMS = {"sub": VAPID_SUB_MAIL}


def _is_expired_push_error(error: Exception) -> bool:
    response = getattr(error, "response", None)
    return response is not None and getattr(response, "status_code", None) in (404, 410)


def _send_web_push(subscription_info: dict, payload: dict) -> tuple[bool, bool]:
    """Retorna (enviado, endpoint_expirado). Los fallos transitorios conservan la suscripción."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY no configurada; se omite el envío push")
        return False, False
    try:
        import pywebpush
        pywebpush.webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True, False
    except Exception as e:
        logger.warning("WebPush error: %s", e)
        return False, _is_expired_push_error(e)


def send_push_to_user(db: Session, user_id: int, notification: dict) -> tuple[int, int]:
    """
    Envía una notificación push a todos los dispositivos suscritos de un usuario.
    Retorna (enviadas, total) donde 'enviadas' es el número de envíos exitosos.
    """
    subscriptions = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == user_id
    ).all()
    if not subscriptions:
        return 0, 0

    sent = 0
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
        }
        delivered, expired = _send_web_push(subscription_info, notification)
        if delivered:
            sent += 1
        elif expired:
            # Solo 404/410 confirma que el endpoint ya no existe.
            db.delete(sub)
    db.commit()
    return sent, len(subscriptions)


def send_push_to_family(db: Session, family_id: int, message: str, link: str = None,
                        created_by_id: Optional[int] = None) -> tuple[int, int]:
    """
    Envía una notificación push a todos los miembros de la familia, excepto al creador si se indica.
    Retorna (enviadas, total) total de suscripciones intentadas.
    """
    family = db.query(models.Family).options(
        joinedload(models.Family.users)
    ).filter(models.Family.id == family_id).first()
    if not family:
        return 0, 0

    notification = {
        "title": "Lista del Súper",
        "body": message,
        "icon": "/icons/pwa-192x192.png",
        "data": {"url": link or "/"}
    }

    sent_total = 0
    subscriptions_total = 0
    for user in family.users:
        if created_by_id is not None and user.id == created_by_id:
            continue
        sent, total = send_push_to_user(db, user.id, notification)
        sent_total += sent
        subscriptions_total += total

    return sent_total, subscriptions_total


def send_test_push(user_id: int) -> bool:
    """Envía una notificación push de prueba a todas las suscripciones del usuario."""
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        sent, total = send_push_to_user(db, user_id, {
            "title": "Lista del Súper",
            "body": "✅ ¡Las notificaciones push están funcionando!",
            "icon": "/icons/pwa-192x192.png",
            "data": {"url": "/"}
        })
        logger.info(f"Test push enviado: {sent}/{total}")
        return sent > 0
    finally:
        db.close()
