"""Router de tiendas: conectores configurables y extracción de productos por URL."""
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas, shared_images
from ..deps import get_current_admin_user, get_current_user, get_db, get_family_for_user
from ..services.scraping import (
    connector_from_config,
    extract_product_from_store_url,
    resolve_store_connector,
)
from ..websockets import manager

router = APIRouter(tags=["stores"])


@router.post('/stores/extract-product')
async def extract_product_endpoint(
    request_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    url = request_data.get('url')
    connector_id = request_data.get('connector_id')
    if not url:
        raise HTTPException(status_code=400, detail='URL is required')

    connector = None
    if connector_id:
        connector = crud.get_store_connector(db, connector_id)
    else:
        connector = resolve_store_connector(db, url)

    try:
        result = await extract_product_from_store_url(url, connector, db)
        return {'connector': connector.name if connector else None, 'data': result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/items/add-by-url', response_model=schemas.ListItem)
async def add_item_by_store_url(
    background_tasks: BackgroundTasks,
    item_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    url = item_data.get('url')
    list_id = item_data.get('list_id')
    connector_id = item_data.get('connector_id')

    if not url or not list_id:
        raise HTTPException(status_code=400, detail='list_id and url are required')

    shopping_list = crud.get_list(db, list_id=list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail='Shopping list not found')

    family_id = None
    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
        family_id = shopping_list.calendar.family_id
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not enough permissions')

    if not family_id:
        if not current_user.families:
            raise HTTPException(status_code=400, detail='User does not belong to any family.')
        family_id = current_user.families[0].id

    connector = None
    if connector_id:
        connector = crud.get_store_connector(db, connector_id)
    else:
        connector = resolve_store_connector(db, url)

    try:
        extracted = await extract_product_from_store_url(url, connector, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error extracting product data: {e}')

    if not extracted.get('name'):
        raise HTTPException(status_code=400, detail='Could not extract product name from the provided URL')

    product = crud.get_or_create_product(
        db=db,
        product_name=extracted['name'],
        family_id=family_id,
        category=item_data.get('category'),
        brand=item_data.get('brand'),
        product_url=extracted.get('product_url'),
        store_name=extracted.get('store_name')
    )

    if extracted.get('image_url'):
        try:
            shared_image = await shared_images.save_image_from_url(db, extracted['image_url'], current_user.id)
            product.shared_image_id = shared_image.id
            db.commit()
            db.refresh(product)
        except Exception:
            pass

    list_item = schemas.ListItemCreate(
        nombre=product.name,
        cantidad=item_data.get('cantidad', 1),
        unit=item_data.get('unit', 'piezas'),
        list_id=list_id,
        comentario=item_data.get('comentario'),
        precio_estimado=extracted.get('price') or item_data.get('precio_estimado'),
        precio_confirmado=item_data.get('precio_confirmado'),
        category=product.category,
        brand=product.brand
    )

    new_item, merged = crud.create_list_item(db=db, item=list_item, user_id=current_user.id, family_id=family_id)
    background_tasks.add_task(
        manager.broadcast_to_family,
        family_id,
        {"action": "ITEM_CREATED", "list_id": new_item.list_id, "item_id": new_item.id}
    )
    return new_item


@router.get("/stores/connectors", response_model=List[schemas.StoreConnectorConfig])
def get_store_connectors(active_only: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_store_connectors(db, active_only=active_only)


@router.get("/stores/default-connector", response_model=schemas.StoreConnectorConfig)
def get_default_store_connector(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    connector = crud.get_default_store_connector(db)
    if not connector:
        raise HTTPException(status_code=404, detail="No default connector configured")
    return connector


@router.get("/products/fetch-from-url")
async def fetch_product_from_url(url: str, connector_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    connector = None
    if connector_id:
        connector = crud.get_store_connector(db, connector_id)
    else:
        connector = resolve_store_connector(db, url)
    result = await extract_product_from_store_url(url, connector, db)
    return {"connector": connector.name if connector else None, "data": result}


# --- ADMIN: STORE CONNECTORS ---
@router.get("/admin/store-connectors", response_model=List[schemas.StoreConnectorConfig], dependencies=[Depends(get_current_admin_user)])
def admin_get_store_connectors(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_store_connectors(db, active_only=active_only)


@router.post("/admin/store-connectors", response_model=schemas.StoreConnectorConfig, dependencies=[Depends(get_current_admin_user)])
def admin_create_store_connector(config: schemas.StoreConnectorConfigCreate, db: Session = Depends(get_db)):
    return crud.create_store_connector(db, config=config)


@router.put("/admin/store-connectors/{connector_id}", response_model=schemas.StoreConnectorConfig, dependencies=[Depends(get_current_admin_user)])
def admin_update_store_connector(connector_id: int, config: schemas.StoreConnectorConfigBase, db: Session = Depends(get_db)):
    db_config = crud.update_store_connector(db, connector_id, config)
    if not db_config:
        raise HTTPException(status_code=404, detail="Connector not found")
    return db_config


@router.delete("/admin/store-connectors/{connector_id}", response_model=schemas.StoreConnectorConfig, dependencies=[Depends(get_current_admin_user)])
def admin_delete_store_connector(connector_id: int, db: Session = Depends(get_db)):
    db_config = crud.delete_store_connector(db, connector_id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Connector not found")
    return db_config


@router.post("/admin/store-connectors/test", dependencies=[Depends(get_current_admin_user)])
async def admin_test_store_connector(
    test_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    url = test_data.get('url')
    connector_id = test_data.get('connector_id')
    config = test_data.get('config')

    if not url:
        raise HTTPException(status_code=400, detail='URL is required for connector test')

    connector = None
    if connector_id:
        connector = crud.get_store_connector(db, connector_id)
        if not connector:
            raise HTTPException(status_code=404, detail='Connector not found')
    elif config:
        connector = connector_from_config(config)
    else:
        connector = resolve_store_connector(db, url)

    try:
        result = await extract_product_from_store_url(url, connector, db)
        return {'connector': connector.name if connector else None, 'data': result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
