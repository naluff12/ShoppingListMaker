"""Router de productos (catálogo familiar, precios, favoritos, sugerencias)."""
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import crud, models, schemas, shared_images
from ..deps import get_current_user, get_db, get_family_for_user, get_family_owner

router = APIRouter(tags=["products"])


@router.post("/families/{family_id}/products", response_model=schemas.Product, dependencies=[Depends(get_family_owner)])
def create_product_for_family(family_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db)):
    return crud.create_family_product(db=db, product=product, family_id=family_id)


@router.put("/families/{family_id}/products/{product_id}", response_model=schemas.Product, dependencies=[Depends(get_family_owner)])
def update_product_for_family(family_id: int, product_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id)
    if not db_product or db_product.family_id != family_id:
        raise HTTPException(status_code=404, detail="Product not found in this family")
    return crud.update_family_product(db=db, product_id=product_id, product_update=product)


@router.delete("/families/{family_id}/products/{product_id}", response_model=schemas.Product, dependencies=[Depends(get_family_owner)])
def delete_product_for_family(family_id: int, product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id)
    if not db_product or db_product.family_id != family_id:
        raise HTTPException(status_code=404, detail="Product not found in this family")
    return crud.delete_family_product(db=db, product_id=product_id)


@router.put("/products/{product_id}", response_model=schemas.Product)
def update_product(
    product_id: int,
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_product = crud.get_product(db, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    family = crud.get_family(db, db_product.family_id)
    if not family or current_user not in family.users:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return crud.update_family_product(db=db, product_id=product_id, product_update=product)


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_product = crud.get_product(db, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    family = crud.get_family(db, db_product.family_id)
    if not family or current_user not in family.users:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    crud.safe_delete_product(db, product_id)
    return {"message": "Product deleted successfully"}


@router.get("/products/{product_id}/prices", response_model=List[schemas.PriceHistory])
def get_product_price_history(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_product = crud.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if the user belongs to the family of the product
    get_family_for_user(db_product.family_id, current_user)

    return crud.get_price_history_for_product(db=db, product_id=product_id)


@router.get("/families/{family_id}/products", response_model=schemas.Page[schemas.Product])
def get_products_for_family(
    family_id: int,
    page: int = 1,
    size: int = 10,
    category: str = None,
    brand: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    result = crud.get_products_by_family(db=db, family_id=family_id, skip=(page - 1) * size, limit=size, category=category, brand=brand)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)


@router.get("/families/{id_familia}/products", response_model=List[schemas.Product])
def get_products_for_family_alias(
    id_familia: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(id_familia, current_user)
    return crud.get_products_by_family(db=db, family_id=id_familia)


@router.get("/families/{family_id}/filters")
def get_filters_for_family(
    family_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # This endpoint is accessed by both regular users and admins
    # If family_id is "all", we only proceed if user is admin
    if family_id == 'all':
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        products = db.query(models.Product).all()
    else:
        fam_id_int = int(family_id)
        get_family_for_user(fam_id_int, current_user)
        products = db.query(models.Product).filter(models.Product.family_id == fam_id_int).all()

    categories = list(set([p.category for p in products if p.category]))
    brands = list(set([p.brand for p in products if p.brand]))

    return {"categories": categories, "brands": brands}


@router.get("/products/search", response_model=schemas.Page[schemas.Product])
def search_products_endpoint(q: str, family_id: int, page: int = 1, size: int = 10, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    get_family_for_user(family_id, current_user)
    result = crud.search_products(db=db, name=q, family_id=family_id, skip=(page - 1) * size, limit=size)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)


@router.get("/families/{family_id}/favorite-products", response_model=List[schemas.Product])
def get_favorite_products_for_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    return crud.get_favorite_products_by_family(db=db, family_id=family_id)


@router.post("/products/{product_id}/favorite", response_model=schemas.Product)
def mark_product_favorite(
    product_id: int,
    favorite: bool = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_product = crud.get_product(db, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    family = crud.get_family(db, db_product.family_id)
    if not family or current_user not in family.users:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.set_product_favorite(db=db, product_id=product_id, is_favorite=favorite)


@router.get("/families/{family_id}/suggested-products", response_model=List[schemas.Product])
def get_suggested_products_for_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    return crud.get_suggested_products_for_family(db=db, family_id=family_id)


@router.post("/products/{product_id}/upload-image", response_model=schemas.Product)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if the user belongs to the family of the product
    get_family_for_user(db_product.family_id, current_user)

    try:
        shared_image = await shared_images.save_image(db, file, current_user.id)

        # Update product shared_image_id
        db_product.shared_image_id = shared_image.id
        db.commit()
        db.refresh(db_product)
        return db_product

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@router.post("/products/{product_id}/image-from-url", response_model=schemas.Product)
async def update_product_image_from_url(
    product_id: int,
    image_data: dict,  # {"image_url": "..."}
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Permission check (admin or family member)
    if not current_user.is_admin:
        get_family_for_user(product.family_id, current_user)

    url = image_data.get("image_url")
    if not url:
        raise HTTPException(status_code=400, detail="image_url is required")

    shared_image = await shared_images.save_image_from_url(db, url, current_user.id)
    product.shared_image_id = shared_image.id
    db.commit()
    db.refresh(product)

    # Notify family members via WebSocket
    if product.family_id:
        from ..websockets import manager
        await manager.broadcast_to_family(product.family_id, {
            "type": "product_update",
            "product_id": product.id,
            "action": "image_updated",
            "new_image_url": shared_image.file_path
        })

    return product
