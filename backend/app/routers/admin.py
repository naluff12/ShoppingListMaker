"""Router administrativo: usuarios, familias y productos (solo admin)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..deps import get_current_admin_user, get_db

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin_user)])


# --- USERS ---
@router.post("/users", response_model=schemas.User)
def admin_create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


@router.get("/users", response_model=List[schemas.User])
def admin_get_all_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_users(db, skip=skip, limit=limit)


@router.get("/users/{user_id}", response_model=schemas.User)
def admin_get_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.put("/users/{user_id}", response_model=schemas.User)
def admin_update_user(user_id: int, user: schemas.UserUpdateByAdmin, db: Session = Depends(get_db)):
    db_user = crud.update_user(db, user_id=user_id, user_update=user)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.delete("/users/{user_id}", response_model=schemas.User)
def admin_delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.delete_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


# --- FAMILIES ---
@router.post("/families/{family_id}/members/{user_id}", response_model=schemas.Family)
def admin_add_family_member(family_id: int, user_id: int, db: Session = Depends(get_db)):
    family = crud.get_family(db, family_id=family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user in family.users:
        raise HTTPException(status_code=400, detail="User is already in this family")

    family.users.append(user)
    db.commit()
    db.refresh(family)
    return family


@router.delete("/families/{family_id}/members/{user_id}", response_model=schemas.Family)
def admin_remove_family_member(family_id: int, user_id: int, db: Session = Depends(get_db)):
    family = crud.get_family(db, family_id=family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user not in family.users:
        raise HTTPException(status_code=400, detail="User is not in this family")

    if user.id == family.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the family owner")

    family.users.remove(user)
    db.commit()
    db.refresh(family)
    return family


@router.get("/families", response_model=List[schemas.FamilyWithDetails])
def admin_get_all_families(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_families(db, skip=skip, limit=limit)


@router.post("/families", response_model=schemas.Family)
def admin_create_family(family: schemas.FamilyCreateByAdmin, db: Session = Depends(get_db)):
    return crud.create_family_by_admin(db, family=family)


@router.get("/families/{family_id}", response_model=schemas.FamilyWithDetails)
def admin_get_family(family_id: int, db: Session = Depends(get_db)):
    db_family = crud.get_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family


@router.put("/families/{family_id}", response_model=schemas.Family)
def admin_update_family(family_id: int, family: schemas.FamilyUpdateByAdmin, db: Session = Depends(get_db)):
    db_family = crud.update_family(db, family_id=family_id, family_update=family)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family


@router.delete("/families/{family_id}", response_model=schemas.Family)
def admin_delete_family(family_id: int, db: Session = Depends(get_db)):
    db_family = crud.delete_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family


# --- PRODUCTS ---
@router.get("/products/all", response_model=schemas.Page[schemas.Product])
def admin_get_all_products(
    page: int = 1,
    size: int = 10,
    category: str = None,
    brand: str = None,
    q: str = None,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * size
    if q:
        result = crud.search_all_products(db=db, name=q, skip=skip, limit=size)
    else:
        result = crud.get_all_products(db=db, skip=skip, limit=size, category=category, brand=brand)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)
