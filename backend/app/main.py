from datetime import timedelta
from typing import List
import time
import random
import string
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import OperationalError
from .schemas import ListItem as ListItemSchema

from fastapi import Depends, FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt

from . import crud, models, schemas, security
from .database import SessionLocal, engine

app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.on_event("startup")
def on_startup():
    max_retries = 10
    retries = 0
    while retries < max_retries:
        try:
            models.Base.metadata.create_all(bind=engine)
            print("Database tables created.")
            break
        except OperationalError as e:
            print(f"Database connection failed: {e}")
            retries += 1
            print(f"Retrying connection ({retries}/{max_retries})...")
            time.sleep(5)
    if retries == max_retries:
        print("Could not connect to the database. Exiting.")
        exit(1)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(db: Session = Depends(get_db), token: str = Depends(security.oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user

# --- Helper for family authorization ---
def get_family_for_user(family_id: int, user: models.User):
    for family in user.families:
        if family.id == family_id:
            return family
    raise HTTPException(status_code=403, detail="User does not belong to this family")

# --- Endpoints ---

@app.post("/setup", response_model=schemas.SetupResponse)
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

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users/register", response_model=schemas.User)
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
        else:
            # Optionally, you could raise an error if the family code is invalid
            # For now, we just ignore it if the code is not found
            pass
            
    return new_user


@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# --- FAMILY ENDPOINTS ---
@app.post("/families", response_model=schemas.Family)
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

@app.post("/families/join", response_model=schemas.Family)
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

@app.get("/families/my", response_model=List[schemas.Family])
def get_my_families(current_user: models.User = Depends(get_current_user)):
    return current_user.families

@app.get("/families/{family_id}", response_model=schemas.FamilyWithDetails)
def get_family_details(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    family = db.query(models.Family).options(joinedload(models.Family.users), joinedload(models.Family.owner)).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    is_member = any(user.id == current_user.id for user in family.users)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this family")

    return family

# --- CALENDAR ENDPOINTS ---
@app.post("/families/{family_id}/calendars", response_model=schemas.Calendar)
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

@app.get("/families/{family_id}/calendars", response_model=List[schemas.Calendar])
def get_calendars_for_family(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    get_family_for_user(family_id, current_user)
    return db.query(models.Calendar).filter(models.Calendar.family_id == family_id).all()

# --- SHOPPING LIST & ITEMS (Blame needs user name) ---
@app.get("/blame/{entity_type}/{entity_id}", response_model=List[schemas.Blame])
def obtener_blame(entity_type: str, entity_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Eager load the user relationship to include user details in the response
    return db.query(models.Blame).options(joinedload(models.Blame.user)).filter(models.Blame.entity_type == entity_type, models.Blame.entity_id == entity_id).all()


@app.post("/items/{item_id}/blames", response_model=schemas.Blame)
def create_blame_for_item_endpoint(
    item_id: int,
    blame: schemas.BlameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Authorization check
    shopping_list = db_item.list
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found for this item")

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return crud.create_blame_for_item(db=db, item_id=item_id, user_id=current_user.id, blame=blame)


# ... (rest of the endpoints for shopping lists and items remain largely the same, but authorization might need checks)
# Make sure that when a user accesses a shopping list, they are part of the family that owns the calendar the list belongs to.

@app.post("/items/", response_model=schemas.ListItem)
def create_item_for_list(
    item: schemas.ListItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # First, check if the list exists
    shopping_list = crud.get_list(db, list_id=item.list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    # Then, check if the user has access to this list.
    # A user has access if they are part of the family that owns the calendar the list belongs to.
    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        # If there is no calendar, only the owner can add items.
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return crud.create_list_item(db=db, item=item, user_id=current_user.id)


@app.put("/items/{item_id}", response_model=schemas.ListItem)
def update_item_status_endpoint(
    item_id: int,
    status_update: schemas.ListItemStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    shopping_list = db_item.list
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found for this item")

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return crud.update_item_status(db=db, item_id=item_id, status=status_update.status, user_id=current_user.id)


@app.delete("/items/{item_id}", response_model=schemas.ListItem)
def delete_item_endpoint(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    shopping_list = db_item.list
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found for this item")

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    crud.delete_item(db=db, item_id=item_id, user_id=current_user.id)
    return db_item


@app.post("/listas/", response_model=schemas.ShoppingList)
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

@app.get("/listas/", response_model=List[schemas.ShoppingList])
def get_shopping_lists(
    calendar_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    calendar = db.query(models.Calendar).filter(models.Calendar.id == calendar_id).first()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    get_family_for_user(calendar.family_id, current_user)
    return crud.get_lists_by_calendar(db=db, calendar_id=calendar_id)


@app.get("/listas/{lista_id}", response_model=dict)
def obtener_lista(
    lista_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = db.query(models.ShoppingList).filter(models.ShoppingList.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    # Authorization check
    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)

    items_serializados = [ListItemSchema.model_validate(item).model_dump() for item in lista.items]

    return {
        "id": lista.id,
        "name": lista.name,
        "notas": lista.notas,
        "comentarios": lista.comentarios,
        "list_for_date": lista.list_for_date,
        "items": items_serializados
    }

@app.post("/listas/{lista_id}/blames", response_model=schemas.Blame)
def create_blame_for_list_endpoint(
    lista_id: int,
    blame: schemas.BlameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_list = crud.get_list(db, list_id=lista_id)
    if not db_list:
        raise HTTPException(status_code=404, detail="List not found")

    # Authorization check
    if db_list.calendar:
        get_family_for_user(db_list.calendar.family_id, current_user)
    elif db_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return crud.create_blame_for_list(db=db, list_id=lista_id, user_id=current_user.id, blame=blame)


# (The other endpoints like create_shopping_list, update_item, etc. should also have similar authorization checks)