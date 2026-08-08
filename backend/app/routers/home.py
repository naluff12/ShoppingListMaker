"""Router de historial familiar, notificaciones y chat."""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..deps import get_current_user, get_db, get_family_for_user
from ..websockets import manager

router = APIRouter(tags=["home", "notifications", "chat"])


# --- HOME / HISTORIAL ---
@router.get("/home/last-lists", response_model=List[schemas.ShoppingListResponse])
def get_last_lists(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_last_lists_for_user_families(db=db, user=current_user)


@router.get("/home/last-products", response_model=List[schemas.Product])
def get_last_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_last_products_for_user_families(db=db, user=current_user)


@router.get("/families/{family_id}/previous_lists", response_model=schemas.Page[schemas.ShoppingListResponse])
def get_previous_lists_for_family(
    family_id: int,
    page: int = 1,
    size: int = 10,
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    result = crud.get_lists_by_family(db=db, family_id=family_id, skip=(page - 1) * size, limit=size, start_date=start_date, end_date=end_date)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)


@router.get("/families/{family_id}/previous_products", response_model=List[schemas.PreviousProductHistoryItem])
def get_previous_products_for_family(
    family_id: int,
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    return crud.get_previous_product_history_by_family(db=db, family_id=family_id, days=days)


# --- NOTIFICATIONS ---
@router.get("/notifications", response_model=schemas.Page[schemas.Notification])
def get_notifications(
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = crud.get_notifications_by_user(db, user_id=current_user.id, skip=(page - 1) * size, limit=size)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)


@router.post("/notifications/{notification_id}/mark-as-read", response_model=schemas.Notification)
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notification = crud.mark_notification_as_read(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/notifications/mark-all-as-read", response_model=List[schemas.Notification])
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.mark_all_notifications_as_read(db, user_id=current_user.id)


@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notification = crud.delete_notification(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return


# --- CHAT ---
@router.get("/families/{family_id}/chat-messages", response_model=List[schemas.ChatMessage])
def get_family_chat_messages(
    family_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    return crud.get_chat_messages_by_family(db=db, family_id=family_id, current_user_id=current_user.id, limit=limit)


@router.post("/families/{family_id}/chat-messages", response_model=schemas.ChatMessage)
async def post_family_chat_message(
    family_id: int,
    message_data: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    if message_data.is_private and not message_data.recipient_id:
        raise HTTPException(status_code=400, detail="recipient_id is required for private messages")

    chat_message = crud.create_chat_message(
        db=db,
        family_id=family_id,
        user_id=current_user.id,
        message=message_data.message,
        list_id=message_data.list_id,
        is_private=message_data.is_private,
        recipient_id=message_data.recipient_id
    )

    recipients = None
    if chat_message.is_private and chat_message.recipient_id:
        recipients = [current_user.id, chat_message.recipient_id]

    await manager.broadcast_to_family(family_id, {
        "type": "chat_message",
        "chat_message": {
            "id": chat_message.id,
            "family_id": chat_message.family_id,
            "user_id": chat_message.user_id,
            "recipient_id": chat_message.recipient_id,
            "list_id": chat_message.list_id,
            "message": chat_message.message,
            "is_private": chat_message.is_private,
            "created_at": chat_message.created_at.isoformat(),
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "nombre": current_user.nombre
            },
            "recipient": {
                "id": chat_message.recipient.id,
                "username": chat_message.recipient.username,
                "nombre": chat_message.recipient.nombre
            } if chat_message.recipient else None
        }
    }, target_user_ids=recipients)
    return chat_message
