"""Router de listas de compra, items, plantillas y blame (auditoría)."""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import crud, models, schemas
from ..deps import get_current_user, get_db, get_family_for_user
from ..websockets import manager

router = APIRouter(tags=["lists"])


def _resolve_family_for_list(db: Session, lista: models.ShoppingList, current_user: models.User) -> Optional[int]:
    """Devuelve el family_id de una lista verificando permisos, o None si la lista
    no pertenece a un calendario (lista personal del dueño)."""
    family_id = None
    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
        family_id = lista.calendar.family_id
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if not family_id:
        if not current_user.families:
            raise HTTPException(status_code=400, detail="User does not belong to any family.")
        family_id = current_user.families[0].id
    return family_id


# --- ITEMS ---
@router.post("/items/", response_model=schemas.ListItem)
def create_item_for_list(
    item: schemas.ListItemCreate,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping_list = crud.get_list(db, list_id=item.list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    family_id = _resolve_family_for_list(db, shopping_list, current_user)

    new_item, merged = crud.create_list_item(db=db, item=item, user_id=current_user.id, family_id=family_id)
    if merged:
        # El item ya existía: se incrementó su cantidad. Avisar al frontend.
        response.headers["X-Item-Merged"] = "true"
    background_tasks.add_task(
        manager.broadcast_to_family,
        family_id,
        {"action": "ITEM_CREATED", "list_id": new_item.list_id, "item_id": new_item.id}
    )
    return new_item


@router.post("/listas/{list_id}/items/bulk", response_model=List[schemas.ListItem])
def create_bulk_items_for_list(
    list_id: int,
    items: schemas.ListItemsBulkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping_list = crud.get_list(db, list_id=list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    family_id = _resolve_family_for_list(db, shopping_list, current_user)

    return crud.create_list_items_bulk(db=db, items=items.items, list_id=list_id, user_id=current_user.id, family_id=family_id)


@router.put("/items/{item_id}", response_model=schemas.ListItem)
def update_item_endpoint(
    item_id: int,
    item_update: schemas.ListItemUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    shopping_list = db_item.list
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found for this item")

    family_id = None
    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
        family_id = shopping_list.calendar.family_id
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if not family_id and current_user.families:
        family_id = current_user.families[0].id

    updated_item = crud.update_item(db=db, item_id=item_id, item_update=item_update, user_id=current_user.id)
    if family_id:
        background_tasks.add_task(
            manager.broadcast_to_family,
            family_id,
            {"action": "ITEM_UPDATED", "list_id": updated_item.list_id, "item_id": updated_item.id}
        )
    return updated_item


@router.delete("/items/{item_id}", response_model=schemas.ListItem)
def delete_item_endpoint(
    item_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    shopping_list = db_item.list
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found for this item")

    family_id = None
    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
        family_id = shopping_list.calendar.family_id
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if not family_id and current_user.families:
        family_id = current_user.families[0].id
    list_id = db_item.list_id

    # Evitar DetachedInstanceError: acceder a relaciones antes de eliminar
    _ = db_item.creado_por  # forzar carga si es necesario

    crud.delete_item(db=db, item_id=item_id, user_id=current_user.id)

    if family_id:
        background_tasks.add_task(
            manager.broadcast_to_family,
            family_id,
            {"action": "ITEM_DELETED", "list_id": list_id, "item_id": item_id}
        )
    return db_item


@router.get("/listas/{lista_id}/items", response_model=schemas.Page[schemas.ListItem])
def get_items_for_list(
    lista_id: int,
    page: int = 1,
    size: int = 10,
    status: str = Query(None, alias="status"),
    category: str = None,
    brand: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    # Verificar permisos
    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta lista")

    query = db.query(models.ListItem).filter(models.ListItem.list_id == lista_id)
    if status:
        query = query.filter(models.ListItem.status == status)

    product_filters = []
    if category:
        product_filters.append(func.lower(models.Product.category).like(f"%{category.lower()}%"))
    if brand:
        product_filters.append(func.lower(models.Product.brand).like(f"%{brand.lower()}%"))

    if product_filters:
        query = query.join(models.Product)
        for f in product_filters:
            query = query.filter(f)

    if search:
        query = query.filter(func.lower(models.ListItem.nombre).like(f"%{search.lower()}%"))

    total = query.count()
    items = (
        query.options(joinedload(models.ListItem.product))
        .order_by(models.ListItem.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return schemas.Page(items=items, total=total, page=page, size=size)


@router.get("/listas/{lista_id}/filter-options")
def get_list_filter_options_endpoint(
    lista_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta lista")

    return crud.get_list_filter_options(db=db, list_id=lista_id)


# --- SHOPPING LISTS ---
@router.post("/listas/", response_model=schemas.ShoppingListResponse)
def create_shopping_list_endpoint(
    list_data: schemas.ShoppingListCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if list_data.calendar_id:
        calendar = db.query(models.Calendar).filter(models.Calendar.id == list_data.calendar_id).first()
        if not calendar:
            raise HTTPException(status_code=404, detail="Calendar not found")
        get_family_for_user(calendar.family_id, current_user)

    return crud.create_shopping_list(db=db, list_data=list_data, owner_id=current_user.id)


@router.get("/listas/", response_model=schemas.Page[schemas.ShoppingListResponse])
def get_shopping_lists(
    calendar_id: int,
    page: int = 1,
    size: int = 10,
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    get_family_for_user(calendar.family_id, current_user)

    no_pagination = start_date is not None and end_date is not None
    limit = None if no_pagination else size
    skip = 0 if no_pagination else (page - 1) * size

    result = crud.get_lists_by_calendar(
        db=db,
        calendar_id=calendar_id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )

    return schemas.Page(
        items=result["items"],
        total=result["total"],
        page=1 if no_pagination else page,
        size=result["total"] if no_pagination else size,
    )


@router.delete("/listas/{lista_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shopping_list_endpoint(
    lista_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)

    crud.delete_shopping_list(db=db, list_id=lista_id, user_id=current_user.id)
    return


@router.put("/listas/{lista_id}", response_model=schemas.ShoppingList)
def update_shopping_list(
    lista_id: int,
    list_update: schemas.ShoppingListUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    updated_list = crud.update_shopping_list(db=db, list_id=lista_id, list_update=list_update, user_id=current_user.id)
    return updated_list


@router.get("/listas/{lista_id}", response_model=schemas.ShoppingList)
def obtener_lista(
    lista_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)

    return lista


@router.get("/listas/{lista_id}/budget-details", response_model=schemas.BudgetDetails)
def get_budget_details(
    lista_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta lista")

    return crud.get_budget_details_for_list(db=db, list_id=lista_id)


# --- TEMPLATES ---
@router.get("/families/{family_id}/templates", response_model=List[schemas.ShoppingListTemplate])
def get_templates_for_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    return crud.get_templates_by_family(db=db, family_id=family_id)


@router.post("/templates", response_model=schemas.ShoppingListTemplate)
def create_template(
    template_data: schemas.ShoppingListTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping_list = crud.get_list(db, list_id=template_data.list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para usar esta lista")

    template = crud.create_template_from_list(db=db, template_data=template_data, owner_id=current_user.id)
    if not template:
        raise HTTPException(status_code=400, detail="No se pudo crear la plantilla")
    return template


@router.post("/templates/{template_id}/apply", response_model=List[schemas.ListItem])
def apply_template(
    template_id: int,
    list_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping_list = crud.get_list(db, list_id=list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta lista")

    items = crud.apply_template_to_list(db=db, template_id=template_id, list_id=list_id, user_id=current_user.id)
    if items is None:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada o no se puede aplicar")
    return items


# --- BLAME (auditoría) ---
@router.get("/blame/lista/{list_id}", response_model=List[schemas.Blame])
def get_blame_for_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta lista")

    return crud.get_blame_for_list(db=db, list_id=list_id)


@router.get("/blame/item/{item_id}", response_model=List[schemas.Blame])
def get_blame_for_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = crud.get_item(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    lista = crud.get_list(db, list_id=item.list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver este ítem")

    return crud.get_blame_for_item(db=db, item_id=item_id)


@router.post("/listas/{list_id}/blames", response_model=schemas.Blame)
def create_blame_for_list(
    list_id: int,
    blame_data: schemas.BlameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta lista")

    return crud.create_blame(
        db=db,
        user_id=current_user.id,
        entity_type="lista",
        entity_id=list_id,
        action="comment",
        detalles=blame_data.detalles
    )


@router.post("/items/{item_id}/blames", response_model=schemas.Blame)
def create_blame_for_item(
    item_id: int,
    blame_data: schemas.BlameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = crud.get_item(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    lista = crud.get_list(db, list_id=item.list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar este ítem")

    return crud.create_blame(
        db=db,
        user_id=current_user.id,
        entity_type="item",
        entity_id=item_id,
        action="comment",
        detalles=blame_data.detalles
    )


@router.post("/items/{item_id}/upload-image", response_model=schemas.ListItem)
async def upload_image_for_item(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    from .. import shared_images
    item = crud.get_item(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    shopping_list = item.list
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found for this item")

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to update this item")

    try:
        shared_image = await shared_images.save_image(db, file, current_user.id)

        # Update associated product shared_image_id (images are strictly global)
        if item.product:
            item.product.shared_image_id = shared_image.id

        db.commit()
        db.refresh(item)
        return item

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
