import os
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from . import models, schemas, security
from .push_notifications import send_web_push
import json

VAPID_PUBLIC_KEY = os.environ.get("FRONTEND_URL")
# CRUD for Products
def get_or_create_product(db: Session, product_name: str, family_id: int) -> models.Product:
    # Check if product exists (case-insensitive)
    db_product = db.query(models.Product).filter(
        func.lower(models.Product.name) == func.lower(product_name),
        models.Product.family_id == family_id
    ).first()
    if db_product:
        return db_product
    # Create new product if not found
    db_product = models.Product(name=product_name, family_id=family_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def search_products(db: Session, name: str, family_id: int, skip: int = 0, limit: int = 10):
    return db.query(models.Product).filter(models.Product.family_id == family_id, models.Product.name.ilike(f"%{name}%")).offset(skip).limit(limit).all()

def get_products_by_family(db: Session, family_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Product).filter(models.Product.family_id == family_id).offset(skip).limit(limit).all()

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def create_family_product(db: Session, product: schemas.ProductCreate, family_id: int):
    product_data = product.model_dump(exclude={'family_id'})
    db_product = models.Product(**product_data, family_id=family_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_family_product(db: Session, product_id: int, product_update: schemas.ProductCreate):
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product

def delete_family_product(db: Session, product_id: int):
    db_product = get_product(db, product_id)
    if db_product:
        db.delete(db_product)
        db.commit()
    return db_product


# CRUD for Users
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        is_admin=user.is_admin,
        nombre=user.nombre,
        direccion=user.direccion,
        telefono=user.telefono
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user or not security.verify_password(password, user.hashed_password):
        return False
    return user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdateByAdmin):
    db_user = get_user(db, user_id=user_id)
    if not db_user:
        return None
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id=user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

def update_me(db: Session, user: models.User, user_update: schemas.UserUpdate):
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user

def change_password(db: Session, user: models.User, new_password: str):
    user.hashed_password = security.get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    return user


# CRUD for Push Subscriptions
def create_push_subscription(db: Session, subscription: schemas.PushSubscriptionCreate, user_id: int):
    # Check if the subscription endpoint already exists for this user
    db_subscription = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == user_id,
        models.PushSubscription.endpoint == subscription.endpoint
    ).first()

    if db_subscription:
        return db_subscription

    db_subscription = models.PushSubscription(
        user_id=user_id,
        endpoint=subscription.endpoint,
        p256dh_key=subscription.keys.p256dh,
        auth_key=subscription.keys.auth
    )
    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription

def get_push_subscriptions_by_user(db: Session, user_id: int):
    return db.query(models.PushSubscription).filter(models.PushSubscription.user_id == user_id).all()



# CRUD for Families
def get_family(db: Session, family_id: int):
    return db.query(models.Family).options(joinedload(models.Family.users)).filter(models.Family.id == family_id).first()

def get_families(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Family).options(joinedload(models.Family.users)).offset(skip).limit(limit).all()

def create_family_by_admin(db: Session, family: schemas.FamilyCreateByAdmin):
    fam_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    while db.query(models.Family).filter(models.Family.code == fam_code).first():
        fam_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    db_family = models.Family(
        nombre=family.nombre,
        notas=family.notas,
        code=fam_code,
        owner_id=family.owner_id
    )
    db.add(db_family)
    db.commit()
    db.refresh(db_family)
    return db_family

def update_family(db: Session, family_id: int, family_update: schemas.FamilyUpdateByAdmin):
    db_family = get_family(db, family_id=family_id)
    if not db_family:
        return None
    update_data = family_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_family, key, value)
    db.commit()
    db.refresh(db_family)
    return db_family

def delete_family(db: Session, family_id: int):
    db_family = get_family(db, family_id=family_id)
    if db_family:
        db.delete(db_family)
        db.commit()
    return db_family

def transfer_ownership(db: Session, family: models.Family, new_owner_id: int):
    family.owner_id = new_owner_id
    db.commit()
    db.refresh(family)
    return family




# CRUD for Shopping Lists
def get_list(db: Session, list_id: int):
    return db.query(models.ShoppingList).options(
        joinedload(models.ShoppingList.items).joinedload(models.ListItem.product),
        joinedload(models.ShoppingList.calendar)
    ).filter(models.ShoppingList.id == list_id).first()

def get_lists_by_calendar(db: Session, calendar_id: int):
    return db.query(models.ShoppingList).filter(models.ShoppingList.calendar_id == calendar_id).all()

def get_lists_by_user(db: Session, user_id: int):
    return db.query(models.ShoppingList).filter(models.ShoppingList.owner_id == user_id).all()

def create_shopping_list(db: Session, list_data: schemas.ShoppingListCreate, owner_id: int):
    db_list = models.ShoppingList(**list_data.dict(), owner_id=owner_id)
    db.add(db_list)
    db.flush()  # Flush to get the ID

    blame_entry = models.Blame(
        user_id=owner_id,
        action="create",
        entity_type="lista",
        entity_id=db_list.id,
        detalles=f"Lista '{db_list.name}' creada."
    )
    db.add(blame_entry)

    # Create notification
    calendar = db.query(models.Calendar).filter(models.Calendar.id == db_list.calendar_id).first()
    if calendar:
        user = db.query(models.User).filter(models.User.id == owner_id).first()
        message = f"{user.username} ha creado la lista de compras '{db_list.name}'."
        create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=owner_id, link=f"/shopping-list/{db_list.id}")

    db.commit()
    db.refresh(db_list)
    return db_list

def update_shopping_list(db: Session, list_id: int, list_update: schemas.ShoppingListUpdate, user_id: int):
    db_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == list_id).first()
    if not db_list:
        return None

    update_data = list_update.model_dump(exclude_unset=True)
    blame_details = []
    for key, value in update_data.items():
        original_value = getattr(db_list, key)
        if original_value != value:
            blame_details.append(f"'{key}' de la lista cambiado de '{original_value}' a '{value}'")
        setattr(db_list, key, value)

    if blame_details:
        blame_entry = models.Blame(
            user_id=user_id, action="update", entity_type="lista",
            entity_id=list_id, detalles=". ".join(blame_details)
        )
        db.add(blame_entry)

        # Create notification
        calendar = db.query(models.Calendar).filter(models.Calendar.id == db_list.calendar_id).first()
        if calendar:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            message = f"{user.username} ha actualizado la lista de compras '{db_list.name}'."
            create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=user_id, link=f"/shopping-list/{db_list.id}")

    db.commit()
    db.refresh(db_list)
    return db_list

# CRUD for Items
def get_item(db: Session, item_id: int):
    return db.query(models.ListItem).options(joinedload(models.ListItem.product)).filter(models.ListItem.id == item_id).first()

def create_list_item(db: Session, item: schemas.ListItemCreate, user_id: int, family_id: int):
    # Find or create the product
    product = get_or_create_product(db, item.nombre, family_id)

    db_item = models.ListItem(
        list_id=item.list_id,
        product_id=product.id,
        nombre=item.nombre,
        cantidad=item.cantidad,
        unit=item.unit,
        comentario=item.comentario,
        precio_estimado=item.precio_estimado,
        status='pendiente',
        creado_por_id=user_id
    )
    db.add(db_item)
    db.flush()  # Flush to get the ID

    blame_entry = models.Blame(
        user_id=user_id,
        action="create",
        entity_type="item",
        entity_id=db_item.id,
        detalles=f"Producto '{item.nombre}' agregado a la lista."
    )
    db.add(blame_entry)

    # Create notification
    shopping_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == item.list_id).first()
    if shopping_list:
        calendar = db.query(models.Calendar).filter(models.Calendar.id == shopping_list.calendar_id).first()
        if calendar:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            message = f"{user.username} ha agregado el producto '{item.nombre}' a la lista '{shopping_list.name}'."
            create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=user_id, link=f"/shopping-list/{shopping_list.id}")
            trigger_push_notification_for_item_creation(db, family_id=calendar.family_id, message=message, created_by_id=user_id, link=f"/shopping-list/{shopping_list.id}")

    db.commit()
    db.refresh(db_item)
    # Eagerly load product for the return value
    db.refresh(db_item, attribute_names=['product'])
    return db_item

def trigger_push_notification_for_item_creation(db: Session, family_id: int, message: str, created_by_id: int, link: str = None):
    family = db.query(models.Family).options(joinedload(models.Family.users)).filter(models.Family.id == family_id).first()
    if not family:
        return

    for user in family.users:
        if user.id != created_by_id:
            subscriptions = get_push_subscriptions_by_user(db, user_id=user.id)
            for sub in subscriptions:
                subscription_data = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh_key,
                        "auth": sub.auth_key
                    }
                }
                payload = {
                    "title": "Nuevo Producto en la Lista",
                    "body": message,
                    "url": "https://shop-list.insanityblizz.net/"
                }
                send_web_push(subscription_data, payload)


def update_item(db: Session, item_id: int, item_update: schemas.ListItemUpdate, user_id: int):
    db_item = db.query(models.ListItem).options(joinedload(models.ListItem.product)).filter(models.ListItem.id == item_id).first()
    if not db_item:
        return None

    update_data = item_update.model_dump(exclude_unset=True)
    blame_details = []
    for key, value in update_data.items():
        original_value = getattr(db_item, key)
        if original_value != value:
            if key == 'product_id':
                new_product = db.query(models.Product).filter(models.Product.id == value).first()
                blame_details.append(f"'producto' cambiado de '{db_item.product.name}' a '{new_product.name}'")
            else:
                blame_details.append(f"'{key}' cambiado de '{original_value}' a '{value}'")
        setattr(db_item, key, value)

    if blame_details:
        blame_entry = models.Blame(
            user_id=user_id,
            action="update",
            entity_type="item",
            entity_id=item_id,
            detalles=". ".join(blame_details)
        )
        db.add(blame_entry)

        # Create notification
        shopping_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == db_item.list_id).first()
        if shopping_list:
            calendar = db.query(models.Calendar).filter(models.Calendar.id == shopping_list.calendar_id).first()
            if calendar:
                user = db.query(models.User).filter(models.User.id == user_id).first()
                message = f"{user.username} ha actualizado el producto '{db_item.nombre}' en la lista '{shopping_list.name}'."
                create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=user_id, link=f"/shopping-list/{shopping_list.id}")

    db.commit()
    db.refresh(db_item)
    return db_item

def update_item_status(db: Session, item_id: int, status: str, user_id: int):
    db_item = db.query(models.ListItem).options(joinedload(models.ListItem.product)).filter(models.ListItem.id == item_id).first()
    if db_item:
        original_status = db_item.status
        db_item.status = status

        blame_entry = models.Blame(
            user_id=user_id,
            action="update",
            entity_type="item",
            entity_id=item_id,
            detalles=f"Estado del producto '{db_item.product.name}' cambiado de '{original_status}' a '{status}'."
        )
        db.add(blame_entry)

        # Create notification
        shopping_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == db_item.list_id).first()
        if shopping_list:
            calendar = db.query(models.Calendar).filter(models.Calendar.id == shopping_list.calendar_id).first()
            if calendar:
                user = db.query(models.User).filter(models.User.id == user_id).first()
                message = f"{user.username} ha cambiado el estado del producto '{db_item.product.name}' a '{status}' en la lista '{shopping_list.name}'."
                create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=user_id, link=f"/shopping-list/{shopping_list.id}")

        db.commit()
        db.refresh(db_item)
    return db_item

def delete_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(models.ListItem).options(joinedload(models.ListItem.product)).filter(models.ListItem.id == item_id).first()
    if db_item:
        # Create notification before deleting the item to have access to its data
        shopping_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == db_item.list_id).first()
        if shopping_list:
            calendar = db.query(models.Calendar).filter(models.Calendar.id == shopping_list.calendar_id).first()
            if calendar:
                user = db.query(models.User).filter(models.User.id == user_id).first()
                message = f"{user.username} ha eliminado el producto '{db_item.product.name}' de la lista '{shopping_list.name}'."
                create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=user_id, link=f"/shopping-list/{shopping_list.id}")

        blame_entry = models.Blame(
            user_id=user_id,
            action="delete",
            entity_type="item",
            entity_id=item_id,
            detalles=f"Item '{db_item.product.name}' eliminado de la lista."
        )
        db.add(blame_entry)

        db.delete(db_item)
        db.commit()
    return db_item

def delete_shopping_list(db: Session, list_id: int, user_id: int):
    db_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == list_id).first()
    if db_list:
        # Create notification before deleting the list to have access to its data
        calendar = db.query(models.Calendar).filter(models.Calendar.id == db_list.calendar_id).first()
        if calendar:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            message = f"{user.username} ha eliminado la lista de compras '{db_list.name}'."
            create_notification_for_family_members(db, family_id=calendar.family_id, message=message, created_by_id=user_id)

        db.delete(db_list)
        db.commit()
    return db_list

def get_blame_for_list(db: Session, list_id: int):
    return db.query(models.Blame).filter(
        models.Blame.entity_type == "lista",
        models.Blame.entity_id == list_id
    ).order_by(models.Blame.timestamp.desc()).all()

def get_blame_for_item(db: Session, item_id: int):
    return db.query(models.Blame).filter(
        models.Blame.entity_type == "item",
        models.Blame.entity_id == item_id
    ).order_by(models.Blame.timestamp.desc()).all()

def create_blame(db: Session, user_id: int, entity_type: str, entity_id: int, action: str, detalles: str):
    blame = models.Blame(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        detalles=detalles
    )
    db.add(blame)
    db.commit()
    db.refresh(blame)
    return blame

def get_last_lists_for_user_families(db: Session, user: models.User, limit: int = 5):
    family_ids = [family.id for family in user.families]
    return db.query(models.ShoppingList).join(models.Calendar).filter(models.Calendar.family_id.in_(family_ids)).order_by(models.ShoppingList.created_at.desc()).limit(limit).all()

def get_last_products_for_user_families(db: Session, user: models.User, limit: int = 5):
    family_ids = [family.id for family in user.families]
    return db.query(models.Product).filter(models.Product.family_id.in_(family_ids)).order_by(models.Product.created_at.desc()).limit(limit).all()
# CRUD for Notifications
def create_notification_for_family_members(db: Session, family_id: int, message: str, created_by_id: int, link: str = None):
    family = db.query(models.Family).options(joinedload(models.Family.users)).filter(models.Family.id == family_id).first()
    if not family:
        return

    for user in family.users:
        if user.id != created_by_id:
            notification = models.Notification(
                user_id=user.id,
                family_id=family_id,
                message=message,
                created_by_id=created_by_id,
                link=link
            )
            db.add(notification)
    db.commit()

def get_notifications_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Notification).filter(models.Notification.user_id == user_id).order_by(models.Notification.created_at.desc()).offset(skip).limit(limit).all()

def mark_notification_as_read(db: Session, notification_id: int, user_id: int):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == user_id).first()
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification
