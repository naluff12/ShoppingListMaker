from sqlalchemy import func, desc, or_
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger(__name__)
from . import models, schemas, security
from .utils import calc_price_from_base

# CRUD for Products
def get_or_create_product(db: Session, product_name: str, family_id: int, category: str = None, brand: str = None, product_url: str = None, store_name: str = None) -> models.Product:
    # Check if product exists (case-insensitive)
    db_product = db.query(models.Product).filter(
        func.lower(models.Product.name) == func.lower(product_name),
        models.Product.family_id == family_id
    ).first()
    if db_product:
        # If product exists, update category, brand or store info if they are provided
        if category and db_product.category != category:
            db_product.category = category
        if brand and db_product.brand != brand:
            db_product.brand = brand
        if product_url and db_product.product_url != product_url:
            db_product.product_url = product_url
        if store_name and db_product.store_name != store_name:
            db_product.store_name = store_name
        db.commit()
        db.refresh(db_product)
        return db_product
    # Create new product if not found
    db_product = models.Product(
        name=product_name,
        family_id=family_id,
        category=category,
        brand=brand,
        product_url=product_url,
        store_name=store_name
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

from sqlalchemy import func, or_

def search_products(db: Session, name: str, family_id: int, skip: int = 0, limit: int = 10):
    lower_name = name.lower()
    query = db.query(models.Product).options(joinedload(models.Product.family), joinedload(models.Product.shared_image)).filter(
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

def search_all_products(db: Session, name: str, skip: int = 0, limit: int = 10):
    lower_name = name.lower()
    query = db.query(models.Product).options(joinedload(models.Product.family), joinedload(models.Product.shared_image)).filter(
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
    query = db.query(models.Product).options(joinedload(models.Product.family), joinedload(models.Product.shared_image)).filter(models.Product.family_id == family_id)
    if category:
        query = query.filter(func.lower(models.Product.category).like(f"%{category.lower()}%"))
    if brand:
        query = query.filter(func.lower(models.Product.brand).like(f"%{brand.lower()}%"))
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"items": items, "total": total}


def get_favorite_products_by_family(db: Session, family_id: int, limit: int = 10):
    return db.query(models.Product).options(joinedload(models.Product.shared_image)).filter(
        models.Product.family_id == family_id,
        models.Product.is_favorite == True
    ).order_by(models.Product.updated_at.desc()).limit(limit).all()


def set_product_favorite(db: Session, product_id: int, is_favorite: bool):
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    db_product.is_favorite = is_favorite
    db.commit()
    db.refresh(db_product)
    return db_product


def get_suggested_products_for_family(db: Session, family_id: int, limit: int = 8):
    usage_subquery = db.query(
        models.ListItem.product_id.label('product_id'),
        func.count(models.ListItem.id).label('usage_count')
    ).filter(
        models.ListItem.product_id != None
    ).group_by(models.ListItem.product_id).subquery()

    query = db.query(models.Product).join(
        usage_subquery,
        models.Product.id == usage_subquery.c.product_id
    ).filter(
        models.Product.family_id == family_id
    ).order_by(desc(usage_subquery.c.usage_count), models.Product.created_at.desc()).limit(limit)

    return query.all()


def get_all_products(db: Session, skip: int = 0, limit: int = 100, category: str = None, brand: str = None):
    query = db.query(models.Product).options(joinedload(models.Product.family), joinedload(models.Product.shared_image))
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

    # Si cambió la base de precio o el peso promedio, recalcular el precio de todos
    # los items PENDIENTES de este producto (candado de precio).
    if 'precio_base' in update_data or 'precio_base_unit' in update_data or 'peso_promedio' in update_data:
        pending_items = db.query(models.ListItem).filter(
            models.ListItem.product_id == db_product.id,
            models.ListItem.status == 'pendiente'
        ).all()
        for it in pending_items:
            precio_calc = calc_price_from_base(
                it.cantidad, it.unit or 'piezas',
                db_product.precio_base, db_product.precio_base_unit, db_product.peso_promedio
            )
            if precio_calc is not None:
                it.precio_confirmado = precio_calc
        if pending_items:
            db.commit()

    db.refresh(db_product)
    return db_product

def delete_family_product(db: Session, product_id: int):
    db_product = get_product(db, product_id)
    if db_product:
        db.delete(db_product)
        db.commit()
    return db_product

def safe_delete_product(db: Session, product_id: int):
    """
    Eliminación segura del producto.
    Desvincula el producto de cualquier list_item anterior (dejando el product_id en NULL),
    elimina el historial de precios y finalmente elimina el producto.
    """
    db_product = get_product(db, product_id)
    if not db_product:
        return None

    # Step 1: Unlink from existing list items
    db.query(models.ListItem).filter(models.ListItem.product_id == product_id).update({
        models.ListItem.product_id: None
    }, synchronize_session=False)

    # Step 2: Delete price history
    db.query(models.PriceHistory).filter(models.PriceHistory.product_id == product_id).delete(synchronize_session=False)

    # Step 3: Delete product
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


def get_previous_product_history_by_family(db: Session, family_id: int, days: int = 90, limit: int = 50):
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    items = db.query(models.ListItem).join(models.ShoppingList).join(models.Calendar).options(
        joinedload(models.ListItem.product).joinedload(models.Product.shared_image),
        joinedload(models.ListItem.list)
    ).filter(
        models.Calendar.family_id == family_id,
        models.ListItem.created_at >= cutoff_date
    ).order_by(models.ListItem.created_at.desc()).all()

    history = {}
    for item in items:
        category = (item.product.category if item.product and item.product.category else '')
        brand = (item.product.brand if item.product and item.product.brand else '')
        key = (item.product_id, item.nombre.strip().lower(), category.strip().lower(), brand.strip().lower())
        if key not in history:
            history[key] = {
                'product_id': item.product_id,
                'name': item.nombre,
                'category': category,
                'brand': brand,
                'occurrences': 0,
                'pending_count': 0,
                'purchased_count': 0,
                'last_seen': item.created_at,
                'last_list_name': item.list.name if item.list else None,
                'last_list_date': item.list.list_for_date if item.list else None,
                'last_price': item.precio_confirmado if item.precio_confirmado is not None else (item.product.last_price if item.product else None),
                'shared_image': item.product.shared_image if item.product else None,
            }
        entry = history[key]
        entry['occurrences'] += 1
        if item.status == 'pendiente':
            entry['pending_count'] += 1
        elif item.status == 'comprado':
            entry['purchased_count'] += 1
        if item.created_at > entry['last_seen']:
            entry['last_seen'] = item.created_at
            entry['last_list_name'] = item.list.name if item.list else entry['last_list_name']
            entry['last_list_date'] = item.list.list_for_date if item.list else entry['last_list_date']
            entry['last_price'] = item.precio_confirmado if item.precio_confirmado is not None else (item.product.last_price if item.product else entry['last_price'])
            entry['shared_image'] = item.product.shared_image if item.product else entry['shared_image']

    sorted_history = sorted(history.values(), key=lambda x: x['last_seen'], reverse=True)
    return sorted_history[:limit]


def get_templates_by_family(db: Session, family_id: int):
    return db.query(models.ShoppingListTemplate).options(joinedload(models.ShoppingListTemplate.items)).filter(models.ShoppingListTemplate.family_id == family_id).order_by(models.ShoppingListTemplate.created_at.desc()).all()


def get_template(db: Session, template_id: int):
    return db.query(models.ShoppingListTemplate).options(joinedload(models.ShoppingListTemplate.items)).filter(models.ShoppingListTemplate.id == template_id).first()


def create_template_from_list(db: Session, template_data: schemas.ShoppingListTemplateCreate, owner_id: int):
    shopping_list = get_list(db, template_data.list_id)
    if not shopping_list:
        return None

    family_id = shopping_list.calendar.family_id if shopping_list.calendar else None

    db_template = models.ShoppingListTemplate(
        name=template_data.name,
        description=template_data.description,
        owner_id=owner_id,
        family_id=family_id
    )
    db.add(db_template)
    db.flush()

    for item in shopping_list.items:
        template_item = models.ShoppingListTemplateItem(
            template_id=db_template.id,
            nombre=item.nombre,
            cantidad=item.cantidad,
            unit=item.unit,
            category=item.product.category if item.product else None,
            brand=item.product.brand if item.product else None,
            precio_estimado=item.precio_estimado,
            precio_confirmado=item.precio_confirmado
        )
        db.add(template_item)

    db.commit()
    db.refresh(db_template)
    return db_template


def apply_template_to_list(db: Session, template_id: int, list_id: int, user_id: int):
    db_template = get_template(db, template_id)
    if not db_template:
        return None

    shopping_list = get_list(db, list_id)
    if not shopping_list:
        return None

    family_id = shopping_list.calendar.family_id if shopping_list.calendar else db_template.family_id
    if not family_id:
        return None

    new_items = []
    for template_item in db_template.items:
        product = get_or_create_product(
            db,
            template_item.nombre,
            family_id,
            template_item.category,
            template_item.brand
        )

        db_item = models.ListItem(
            list_id=list_id,
            product_id=product.id,
            nombre=template_item.nombre,
            cantidad=template_item.cantidad,
            unit=template_item.unit,
            comentario=None,
            precio_estimado=template_item.precio_estimado,
            precio_confirmado=template_item.precio_confirmado,
            status='pendiente',
            creado_por_id=user_id
        )
        db.add(db_item)
        new_items.append(db_item)

        if template_item.precio_confirmado is not None:
            product.last_price = template_item.precio_confirmado
            db.add(product)
            price_history_entry = models.PriceHistory(
                product_id=product.id,
                price=template_item.precio_confirmado
            )
            db.add(price_history_entry)

    db.flush()

    for item in new_items:
        blame_entry = models.Blame(
            user_id=user_id,
            action="create",
            entity_type="item",
            entity_id=item.id,
            detalles=f"Producto '{item.nombre}' agregado desde plantilla '{db_template.name}'."
        )
        db.add(blame_entry)

    db.commit()
    return new_items


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

def _normalize_name(name: str) -> str:
    """Normaliza un nombre para detectar duplicados: minúsculas, sin acentos, sin espacios extra."""
    import unicodedata
    if not name:
        return ''
    nfkd = unicodedata.normalize('NFKD', name)
    ascii_str = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return ' '.join(ascii_str.lower().split())


def create_list_item(db: Session, item: schemas.ListItemCreate, user_id: int, family_id: int):
    """Crea un item en la lista.

    Prevención de duplicados: si ya existe un item PENDIENTE en la misma lista con
    el mismo nombre (normalizado: sin acentos/case/espacios), incrementa su cantidad
    y devuelve (item_existente, True). Si no existe, crea uno nuevo y devuelve (item, False).
    """
    normalized = _normalize_name(item.nombre)

    # --- Prevención de duplicados: buscar item pendiente con el mismo nombre ---
    existing_items = (
        db.query(models.ListItem)
        .filter(models.ListItem.list_id == item.list_id, models.ListItem.status == 'pendiente')
        .all()
    )
    for existing in existing_items:
        if _normalize_name(existing.nombre) == normalized:
            extra_qty = item.cantidad or 1
            existing.cantidad = (existing.cantidad or 1) + extra_qty
            if item.precio_confirmado is not None:
                if existing.precio_confirmado is None:
                    existing.precio_confirmado = item.precio_confirmado
                if existing.product:
                    existing.product.last_price = item.precio_confirmado
                    price_history_entry = models.PriceHistory(
                        product_id=existing.product.id,
                        price=item.precio_confirmado
                    )
                    db.add(price_history_entry)
            blame_entry = models.Blame(
                user_id=user_id,
                action="update",
                entity_type="item",
                entity_id=existing.id,
                detalles=f"'{item.nombre}' ya estaba en la lista; cantidad incrementada a {existing.cantidad:g}."
            )
            db.add(blame_entry)
            db.commit()
            db.refresh(existing)
            db.refresh(existing, attribute_names=['product'])
            return existing, True

    # --- Creación normal ---
    product = get_or_create_product(db, item.nombre, family_id, item.category, item.brand)

    precio_final = item.precio_confirmado
    # Candado de precio: si el producto tiene precio_base, calcular el precio desde la base
    if product.precio_base:
        precio_calculado = calc_price_from_base(
            item.cantidad, item.unit or 'piezas',
            product.precio_base, product.precio_base_unit, product.peso_promedio
        )
        if precio_calculado is not None:
            precio_final = precio_calculado

    db_item = models.ListItem(
        list_id=item.list_id,
        product_id=product.id,
        nombre=item.nombre,
        cantidad=item.cantidad,
        unit=item.unit,
        comentario=item.comentario,
        precio_estimado=item.precio_estimado,
        precio_confirmado=precio_final,
        status='pendiente',
        creado_por_id=user_id
    )

    db.add(db_item)
    db.flush()  # Flush to get the ID

    if precio_final is not None:
        product.last_price = precio_final
        price_history_entry = models.PriceHistory(
            product_id=product.id,
            price=precio_final
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
    return db_item, False

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

    update_data = item_update.model_dump(exclude_unset=True)
    blame_details = []

    # shared_image_id handling to enforce global product images

    if 'precio_confirmado' in update_data and update_data['precio_confirmado'] is not None:
        if db_item.product:
            db_item.product.last_price = update_data['precio_confirmado']
            price_history_entry = models.PriceHistory(
                product_id=db_item.product.id,
                price=update_data['precio_confirmado']
            )
            db.add(price_history_entry)

    # Candado de precio: si el producto tiene precio_base definido, el precio del
    # item SIEMPRE se recalcula desde la base (kg o pieza) — el precio manual se ignora.
    product = db_item.product
    if product and product.precio_base:
        final_cantidad = update_data.get('cantidad', db_item.cantidad)
        final_unit = update_data.get('unit', db_item.unit)
        precio_calculado = calc_price_from_base(
            final_cantidad, final_unit,
            product.precio_base, product.precio_base_unit, product.peso_promedio
        )
        if precio_calculado is not None:
            update_data.pop('precio_confirmado', None)
            db_item.precio_confirmado = precio_calculado
            product.last_price = precio_calculado
            price_history_entry = models.PriceHistory(
                product_id=product.id,
                price=precio_calculado
            )
            db.add(price_history_entry)
            blame_details.append(f"precio recalculado desde base (${precio_calculado:g})")

    for key, value in update_data.items():
        if key == 'shared_image_id':
            blame_details.append(f"imagen cambiada")
            # Update product shared_image_id if item has a product
            if db_item.product:
                db_item.product.shared_image_id = value
                db.add(db_item.product)
            # Also update item itself if it has the attribute (which it will after models.py fix)
            setattr(db_item, key, value)
            continue

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
    # Enviar notificaciones push a todos los miembros (excepto creador)
    try:
        from .services.push_service import send_push_to_family
        sent, total = send_push_to_family(db, family_id, message, link, created_by_id)
        if sent > 0:
            logger.info(f"Push notifications sent to family {family_id}: {sent}/{total}")
    except Exception as e:
        logger.warning(f"Could not send push notifications: {e}")
        # No fallar la operación principal si las push fallan

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


def create_chat_message(db: Session, family_id: int, user_id: int, message: str, list_id: int = None, is_private: bool = False, recipient_id: int = None):
    chat_message = models.ChatMessage(
        family_id=family_id,
        user_id=user_id,
        list_id=list_id,
        message=message,
        is_private=is_private,
        recipient_id=recipient_id
    )
    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)
    return chat_message


def get_chat_messages_by_family(db: Session, family_id: int, current_user_id: int, limit: int = 100):
    query = db.query(models.ChatMessage).filter(
        models.ChatMessage.family_id == family_id,
        or_(
            models.ChatMessage.is_private == False,
            models.ChatMessage.user_id == current_user_id,
            models.ChatMessage.recipient_id == current_user_id
        )
    ).order_by(models.ChatMessage.created_at.desc()).limit(limit)
    messages = query.all()
    return list(reversed(messages))


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

def get_image_search_configs(db: Session, active_only: bool = False):
    query = db.query(models.ImageSearchConfig)
    if active_only:
        query = query.filter(models.ImageSearchConfig.is_active == True)
    return query.order_by(models.ImageSearchConfig.name).all()

def get_image_search_config(db: Session, config_id: int):
    return db.query(models.ImageSearchConfig).filter(models.ImageSearchConfig.id == config_id).first()

def get_default_image_search_config(db: Session):
    return db.query(models.ImageSearchConfig).filter(models.ImageSearchConfig.is_default == True).first()

def create_image_search_config(db: Session, config: schemas.ImageSearchConfigCreate):
    db_config = models.ImageSearchConfig(**config.dict())
    if db_config.is_default:
        # Reset other defaults
        db.query(models.ImageSearchConfig).update({models.ImageSearchConfig.is_default: False})
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_image_search_config(db: Session, config_id: int, config_update: schemas.ImageSearchConfigBase):
    db_config = get_image_search_config(db, config_id)
    if not db_config:
        return None
    
    update_data = config_update.dict(exclude_unset=True)
    if update_data.get('is_default'):
        # Reset other defaults
        db.query(models.ImageSearchConfig).filter(models.ImageSearchConfig.id != config_id).update({models.ImageSearchConfig.is_default: False})
        
    for key, value in update_data.items():
        setattr(db_config, key, value)
        
    db.commit()
    db.refresh(db_config)
    return db_config

def delete_image_search_config(db: Session, config_id: int):
    db_config = get_image_search_config(db, config_id)
    if db_config:
        db.delete(db_config)
        db.commit()
    return db_config


def get_store_connectors(db: Session, active_only: bool = False):
    query = db.query(models.StoreConnectorConfig)
    if active_only:
        query = query.filter(models.StoreConnectorConfig.is_active == True)
    return query.order_by(models.StoreConnectorConfig.name).all()


def get_store_connector(db: Session, connector_id: int):
    return db.query(models.StoreConnectorConfig).filter(models.StoreConnectorConfig.id == connector_id).first()


def get_default_store_connector(db: Session):
    return db.query(models.StoreConnectorConfig).filter(models.StoreConnectorConfig.is_default == True).first()


def create_store_connector(db: Session, config: schemas.StoreConnectorConfigCreate):
    db_config = models.StoreConnectorConfig(**config.dict())
    if db_config.is_default:
        db.query(models.StoreConnectorConfig).update({models.StoreConnectorConfig.is_default: False})
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


def update_store_connector(db: Session, connector_id: int, config_update: schemas.StoreConnectorConfigBase):
    db_config = get_store_connector(db, connector_id)
    if not db_config:
        return None
    update_data = config_update.model_dump(exclude_unset=True)
    if update_data.get('is_default'):
        db.query(models.StoreConnectorConfig).filter(models.StoreConnectorConfig.id != connector_id).update({models.StoreConnectorConfig.is_default: False})
    for key, value in update_data.items():
        setattr(db_config, key, value)
    db.commit()
    db.refresh(db_config)
    return db_config


def delete_store_connector(db: Session, connector_id: int):
    db_config = get_store_connector(db, connector_id)
    if db_config:
        db.delete(db_config)
        db.commit()
    return db_config


