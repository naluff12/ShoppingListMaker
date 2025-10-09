
from sqlalchemy.orm import Session
from . import models, schemas, security

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
        is_admin=False,  # Los usuarios creados por esta vía no son admins
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
    if not user:
        return False
    if not security.verify_password(password, user.hashed_password):
        return False
    return user

# CRUD for Shopping Lists
def get_list(db: Session, list_id: int):
    return db.query(models.ShoppingList).filter(models.ShoppingList.id == list_id).first()

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

# CRUD for Items
def get_item(db: Session, item_id: int):
    return db.query(models.ListItem).filter(models.ListItem.id == item_id).first()


def create_list_item(db: Session, item: schemas.ListItemCreate, user_id: int):
    db_item = models.ListItem(
        **item.dict(),
        status='pendiente',
        creado_por_id=user_id
    )
    db.add(db_item)
    db.flush()  # Flush to get the ID of the new item

    # Blame entry for item creation
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
    return db_item

def update_item_status(db: Session, item_id: int, status: str, user_id: int):
    db_item = db.query(models.ListItem).filter(models.ListItem.id == item_id).first()
    if db_item:
        original_status = db_item.status
        db_item.status = status

        blame_entry = models.Blame(
            user_id=user_id,
            action="update",
            entity_type="item",
            entity_id=item_id,
            detalles=f"Estado del producto '{db_item.nombre}' cambiado de '{original_status}' a '{status}'."
        )
        db.add(blame_entry)

        db.commit()
        db.refresh(db_item)
    return db_item

def delete_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(models.ListItem).filter(models.ListItem.id == item_id).first()
    if db_item:
        blame_entry = models.Blame(
            user_id=user_id,
            action="delete",
            entity_type="item",
            entity_id=item_id,
            detalles=f"Item '{db_item.nombre}' eliminado de la lista."
        )
        db.add(blame_entry)

        db.delete(db_item)
        db.commit()
    return db_item

def create_blame_for_item(db: Session, item_id: int, user_id: int, blame: schemas.BlameCreate, action: str = "blame"):
    db_blame = models.Blame(
        user_id=user_id,
        action=action,
        entity_type="item",
        entity_id=item_id,
        detalles=blame.detalles
    )
    db.add(db_blame)
    db.commit()
    db.refresh(db_blame)
    return db_blame

def create_blame_for_list(db: Session, list_id: int, user_id: int, blame: schemas.BlameCreate, action: str = "blame"):
    db_blame = models.Blame(
        user_id=user_id,
        action=action,
        entity_type="lista",
        entity_id=list_id,
        detalles=blame.detalles
    )
    db.add(db_blame)
    db.commit()
    db.refresh(db_blame)
    return db_blame
