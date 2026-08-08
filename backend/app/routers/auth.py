"""Router de autenticación, setup inicial y perfil de usuario."""
import random
import string
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import crud, models, schemas, security
from ..deps import get_current_user, get_db

router = APIRouter(tags=["auth"])


@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    return {"needs_setup": db.query(models.User).count() == 0}


@router.post("/setup", response_model=schemas.SetupResponse)
def setup_inicial(payload: schemas.SetupRequest, db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="Setup is only allowed on an empty database.")

    hashed_password = security.get_password_hash(payload.admin.password)
    admin = models.User(
        email=payload.admin.email,
        username=payload.admin.username,
        hashed_password=hashed_password,
        is_admin=True,
        nombre=payload.admin.nombre
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    fam_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    fam = models.Family(
        code=fam_code,
        nombre=payload.family.nombre,
        notas=payload.family.notas,
        owner_id=admin.id
    )
    fam.users.append(admin)
    db.add(fam)
    db.commit()
    db.refresh(fam)

    return {"family": fam, "admin": admin}


@router.post("/token", response_model=schemas.Token)
def login_for_access_token(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, username=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    # Set HttpOnly Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=security.COOKIE_SECURE,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.post("/users/register", response_model=schemas.User)
def register_user(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=payload.user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = crud.create_user(db=db, user=payload.user)

    if payload.family_code:
        family = db.query(models.Family).filter(models.Family.code == payload.family_code).first()
        if family:
            if new_user not in family.users:
                family.users.append(new_user)
                db.commit()

    return new_user


# --- USER PROFILE ---
@router.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/users/me", response_model=schemas.User)
def update_current_user(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_me(db=db, user=current_user, user_update=user_update)


@router.post("/users/me/change-password", response_model=schemas.User)
def change_current_user_password(
    password_change: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not security.verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    return crud.change_password(db=db, user=current_user, new_password=password_change.new_password)
