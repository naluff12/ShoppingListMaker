"""Router de familias, miembros y calendarios."""
import random
import string
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import crud, models, schemas
from ..deps import get_current_user, get_db, get_family_for_user, get_family_owner

router = APIRouter(tags=["families"])


# --- FAMILY ADMIN (owner) ---
@router.delete("/families/{family_id}/members/{user_id}", response_model=schemas.FamilyWithDetails)
async def remove_family_member(
    family_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    family: models.Family = Depends(get_family_owner)
):
    user_to_remove = crud.get_user(db, user_id)
    if not user_to_remove or user_to_remove not in family.users:
        raise HTTPException(status_code=404, detail="User not found in this family")
    if user_to_remove.id == family.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the family owner")

    family.users.remove(user_to_remove)
    db.commit()
    db.refresh(family)
    return family


@router.post("/families/{family_id}/transfer-ownership", response_model=schemas.Family)
async def transfer_family_ownership(
    family_id: int,
    request: schemas.TransferOwnershipRequest,
    db: Session = Depends(get_db),
    family: models.Family = Depends(get_family_owner)
):
    new_owner = crud.get_user(db, request.new_owner_id)
    if not new_owner or new_owner not in family.users:
        raise HTTPException(status_code=404, detail="New owner is not a member of this family.")

    updated_family = crud.transfer_ownership(db, family, request.new_owner_id)
    return updated_family


# --- FAMILY ENDPOINTS ---
@router.post("/families", response_model=schemas.Family)
def create_family(family_data: schemas.FamilyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    fam_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    while db.query(models.Family).filter(models.Family.code == fam_code).first():
        fam_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    new_family = models.Family(
        nombre=family_data.nombre,
        notas=family_data.notas,
        code=fam_code,
        owner_id=current_user.id
    )
    new_family.users.append(current_user)
    db.add(new_family)
    db.commit()
    db.refresh(new_family)
    return new_family


@router.post("/families/join", response_model=schemas.Family)
def join_family(join_data: schemas.FamilyJoin, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    family = db.query(models.Family).filter(models.Family.code == join_data.code).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family code not found")

    if current_user in family.users:
        raise HTTPException(status_code=400, detail="User is already in this family")

    family.users.append(current_user)
    db.commit()
    db.refresh(family)
    return family


@router.get("/families/my", response_model=List[schemas.Family])
def get_my_families(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.is_admin:
        return crud.get_families(db)
    return current_user.families


@router.get("/families/{family_id}", response_model=schemas.FamilyWithDetails)
def get_family_details(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    family = db.query(models.Family).options(joinedload(models.Family.users), joinedload(models.Family.owner)).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    is_member = any(user.id == current_user.id for user in family.users)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this family")

    return family


@router.get("/families/{family_id}/members-status")
def get_family_members_status(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    family = get_family_for_user(family_id, current_user)
    from ..websockets import manager
    online_ids = manager.get_online_user_ids(family_id)
    members = []
    for member in family.users:
        members.append({
            "id": member.id,
            "username": member.username,
            "nombre": member.nombre,
            "is_online": member.id in online_ids,
            "last_seen": manager.last_seen.get(member.id)
        })
    return members


# --- CALENDAR ENDPOINTS ---
@router.post("/families/{family_id}/calendars", response_model=schemas.Calendar)
def create_calendar_for_family(family_id: int, calendar_data: schemas.CalendarCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    get_family_for_user(family_id, current_user)

    new_calendar = models.Calendar(
        **calendar_data.dict(),
        family_id=family_id,
        owner_id=current_user.id
    )
    db.add(new_calendar)
    db.commit()
    db.refresh(new_calendar)
    return new_calendar


@router.get("/families/{family_id}/calendars", response_model=List[schemas.Calendar])
def get_calendars_for_family(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    get_family_for_user(family_id, current_user)
    return db.query(models.Calendar).filter(models.Calendar.family_id == family_id).all()


@router.get("/calendars/{calendar_id}", response_model=schemas.Calendar)
def get_calendar_by_id(calendar_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    cal = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    get_family_for_user(cal.family_id, current_user)
    return cal
