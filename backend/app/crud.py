from sqlalchemy.orm import Session, joinedload
from . import models, schemas, security

# CRUD for Products
def get_or_create_product(db: Session, product_name: str, family_id: int) -> models.Product:
    # Check if product exists
    db_product = db.query(models.Product).filter(models.Product.name == product_name, models.Product.family_id == family_id).first()
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
        is_admin=False,  # Default user is not admin
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

    db.commit()
    db.refresh(db_item)
    # Eagerly load product for the return value
    db.refresh(db_item, attribute_names=['product'])
    return db_item

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

        db.commit()
        db.refresh(db_item)
    return db_item

def delete_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(models.ListItem).options(joinedload(models.ListItem.product)).filter(models.ListItem.id == item_id).first()
    if db_item:
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

def delete_shopping_list(db: Session, list_id: int):
    db_list = db.query(models.ShoppingList).filter(models.ShoppingList.id == list_id).first()
    if db_list:
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
