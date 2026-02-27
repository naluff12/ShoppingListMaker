from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
from . import models, schemas, security

# CRUD for Products
def get_or_create_product(db: Session, product_name: str, family_id: int, category: str = None, brand: str = None) -> models.Product:
    # Check if product exists (case-insensitive)
    db_product = db.query(models.Product).filter(
        func.lower(models.Product.name) == func.lower(product_name),
        models.Product.family_id == family_id
    ).first()
    if db_product:
        # If product exists, update category and brand if they are provided
        if category and db_product.category != category:
            db_product.category = category
        if brand and db_product.brand != brand:
            db_product.brand = brand
        db.commit()
        db.refresh(db_product)
        return db_product
    # Create new product if not found
    db_product = models.Product(name=product_name, family_id=family_id, category=category, brand=brand)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

from sqlalchemy import func, or_

def search_products(db: Session, name: str, family_id: int, skip: int = 0, limit: int = 10):
    lower_name = name.lower()
    query = db.query(models.Product).filter(
        models.Product.family_id == family_id,
        or_(
            func.lower(models.Product.name).like(f"%{lower_name}%"),
            func.lower(models.Product.category).like(f"%{lower_name}%"),
            func.lower(models.Product.brand).like(f"%{lower_name}%")
        )
    )
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"items": items, "total": total}

def get_products_by_family(db: Session, family_id: int, skip: int = 0, limit: int = 100, category: str = None, brand: str = None):
    query = db.query(models.Product).filter(models.Product.family_id == family_id)
    if category:
        query = query.filter(func.lower(models.Product.category).like(f"%{category.lower()}%"))
    if brand:
        query = query.filter(func.lower(models.Product.brand).like(f"%{brand.lower()}%"))
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"items": items, "total": total}

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def create_family_product(db: Session, product: schemas.ProductCreate, family_id: int):
    product_data = product.model_dump(exclude={'family_id', 'shared_image_id'})
    
    db_product = models.Product(**product_data, family_id=family_id)

    if product.shared_image_id:
        db_product.shared_image_id = product.shared_image_id

    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_family_product(db: Session, product_id: int, product_update: schemas.ProductCreate):
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    
    update_data = product_update.model_dump(exclude_unset=True, exclude={'shared_image_id'})

    if product_update.shared_image_id is not None: # Check for None explicitly to allow setting to null
        db_product.shared_image_id = product_update.shared_image_id
    
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

def get_price_history_for_product(db: Session, product_id: int):
    return db.query(models.PriceHistory).filter(models.PriceHistory.product_id == product_id).order_by(models.PriceHistory.created_at.desc()).all()

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

def get_lists_by_calendar(
    db: Session,
    calendar_id: int,
    skip: int = 0,
    limit: Optional[int] = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = db.query(models.ShoppingList).filter(
        models.ShoppingList.calendar_id == calendar_id
    )

    if start_date:
        query = query.filter(models.ShoppingList.list_for_date >= start_date)
    if end_date:
        query = query.filter(models.ShoppingList.list_for_date <= end_date)

    total = query.count()

    if limit is not None:
        query = query.offset(skip).limit(limit)

    items = query.all()
    return {"items": items, "total": total}

def get_lists_by_family(db: Session, family_id: int, skip: int = 0, limit: int = 100, start_date: date = None, end_date: date = None):
    query = db.query(models.ShoppingList).join(models.Calendar).filter(models.Calendar.family_id == family_id)
    if start_date:
        query = query.filter(models.ShoppingList.list_for_date >= start_date)
    if end_date:
        query = query.filter(models.ShoppingList.list_for_date <= end_date)
    
    total = query.count()
    items = query.order_by(models.ShoppingList.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": items, "total": total}

def get_lists_by_user(db: Session, user_id: int):
    return db.query(models.ShoppingList).filter(models.ShoppingList.owner_id == user_id).all()

def get_budget_details_for_list(db: Session, list_id: int):
    """
    Calculates the estimated and purchased totals for a given shopping list.
    """
    items = db.query(models.ListItem).options(
        joinedload(models.ListItem.product)
    ).filter(models.ListItem.list_id == list_id).all()

    total_estimado = 0
    total_comprado = 0

    for item in items:
        # Logic for estimated total: confirmed price > product's last price > 0
        precio_a_usar = item.precio_confirmado if item.precio_confirmado is not None else (item.product.last_price if item.product else 0)
        if precio_a_usar is None: # If last_price is also null
            precio_a_usar = 0
        total_estimado += (precio_a_usar * item.cantidad)

        # Logic for purchased total: uses the same price logic but only for 'comprado' items
        if item.status == 'comprado':
            total_comprado += (precio_a_usar * item.cantidad)

    return {"total_estimado": total_estimado, "total_comprado": total_comprado}

def create_shopping_list(db: Session, list_data: schemas.ShoppingListCreate, owner_id: int):
    db_list = models.ShoppingList(**list_data.model_dump(), owner_id=owner_id)
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
    product = get_or_create_product(db, item.nombre, family_id, item.category, item.brand)

    db_item = models.ListItem(
        list_id=item.list_id,
        product_id=product.id,
        nombre=item.nombre,
        cantidad=item.cantidad,
        unit=item.unit,
        comentario=item.comentario,
        precio_estimado=item.precio_estimado,
        precio_confirmado=item.precio_confirmado,
        status='pendiente',
        creado_por_id=user_id
    )

    db.add(db_item)
    db.flush()  # Flush to get the ID

    if item.precio_confirmado is not None:
        product.last_price = item.precio_confirmado
        price_history_entry = models.PriceHistory(
            product_id=product.id,
            price=item.precio_confirmado
        )
        db.add(price_history_entry)

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

    db.commit()
    db.refresh(db_item)
    # Eagerly load product for the return value
    db.refresh(db_item, attribute_names=['product'])
    return db_item

def create_list_items_bulk(db: Session, items: list[schemas.ListItemCreateBulk], list_id: int, user_id: int, family_id: int):
    new_items = []
    for item_data in items:
        product = get_or_create_product(db, item_data.nombre, family_id, item_data.category, item_data.brand)
        db_item = models.ListItem(
            list_id=list_id,
            product_id=product.id,
            nombre=item_data.nombre,
            cantidad=item_data.cantidad,
            unit=item_data.unit,
            comentario=item_data.comentario,
            precio_estimado=item_data.precio_estimado,
            status='pendiente',
            creado_por_id=user_id
        )
        db.add(db_item)
        new_items.append(db_item)
    
    db.flush()

    for db_item in new_items:
        blame_entry = models.Blame(
            user_id=user_id,
            action="create",
            entity_type="item",
            entity_id=db_item.id,
            detalles=f"Producto '{db_item.nombre}' agregado a la lista desde una lista anterior."
        )
        db.add(blame_entry)

    db.commit()
    return new_items


def update_item(db: Session, item_id: int, item_update: schemas.ListItemUpdate, user_id: int):
    db_item = db.query(models.ListItem).options(joinedload(models.ListItem.product)).filter(models.ListItem.id == item_id).first()
    if not db_item:
        return None

    update_data = item_update.model_dump(exclude_unset=True, exclude={'shared_image_id'})
    blame_details = []

    # shared_image_id removed from ListItemUpdate schema to enforce global product images

    if 'precio_confirmado' in update_data and update_data['precio_confirmado'] is not None:
        if db_item.product:
            db_item.product.last_price = update_data['precio_confirmado']
            price_history_entry = models.PriceHistory(
                product_id=db_item.product.id,
                price=update_data['precio_confirmado']
            )
            db.add(price_history_entry)

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
    """
    Elimina un item de la lista de compras, crea notificación y registro de blame.
    Retorna un diccionario JSON seguro para FastAPI.
    """
    db_item = (
        db.query(models.ListItem)
        .options(joinedload(models.ListItem.product), joinedload(models.ListItem.creado_por))
        .filter(models.ListItem.id == item_id)
        .first()
    )
    if not db_item:
        return {"success": False, "message": "Item no encontrado"}

    # Guardar datos importantes antes de eliminar
    product_name = db_item.product.name if db_item.product else "Producto desconocido"
    list_name = None
    calendar_family_id = None

    shopping_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == db_item.list_id).first()
    if shopping_list:
        list_name = shopping_list.name
        calendar = db.query(models.Calendar).filter(models.Calendar.id == shopping_list.calendar_id).first()
        if calendar:
            calendar_family_id = calendar.family_id
            user = db.query(models.User).filter(models.User.id == user_id).first()
            message = f"{user.username} ha eliminado el producto '{product_name}' de la lista '{list_name}'."
            create_notification_for_family_members(
                db,
                family_id=calendar_family_id,
                message=message,
                created_by_id=user_id,
                link=f"/shopping-list/{shopping_list.id}"
            )

    # Blame
    blame_entry = models.Blame(
        user_id=user_id,
        action="delete",
        entity_type="item",
        entity_id=item_id,
        detalles=f"Item '{product_name}' eliminado de la lista '{list_name}'."
    )
    db.add(blame_entry)

    # Eliminar el item
    db.delete(db_item)
    db.commit()

    # Retornar datos simples
    return {
        "success": True,
        "item_id": item_id,
        "product_name": product_name,
        "list_name": list_name,
        "calendar_family_id": calendar_family_id
    }


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
    query = db.query(models.Notification).filter(models.Notification.user_id == user_id).order_by(models.Notification.created_at.desc())
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"items": items, "total": total}

def mark_notification_as_read(db: Session, notification_id: int, user_id: int):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == user_id).first()
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification

def mark_all_notifications_as_read(db: Session, user_id: int):
    notifications = db.query(models.Notification).filter(models.Notification.user_id == user_id, models.Notification.is_read == False).all()
    for notification in notifications:
        notification.is_read = True
    db.commit()
    return notifications

def delete_notification(db: Session, notification_id: int, user_id: int):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == user_id).first()
    if notification:
        db.delete(notification)
        db.commit()
    return notification

def get_list_filter_options(db: Session, list_id: int):
    """
    Get unique categories and brands for a given shopping list.
    """
    # Subquery to get product_ids from the list_items table
    product_ids_sq = db.query(models.ListItem.product_id).filter(models.ListItem.list_id == list_id).distinct()

    # Query for unique, non-null categories
    categories_query = db.query(models.Product.category).filter(
        models.Product.id.in_(product_ids_sq),
        models.Product.category.isnot(None)
    ).distinct()
    categories = [c[0] for c in categories_query.all()]

    # Query for unique, non-null brands
    brands_query = db.query(models.Product.brand).filter(
        models.Product.id.in_(product_ids_sq),
        models.Product.brand.isnot(None)
    ).distinct()
    brands = [b[0] for b in brands_query.all()]

    return {"categories": categories, "brands": brands}


