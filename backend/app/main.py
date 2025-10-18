from datetime import timedelta, datetime
from typing import List
import time
import os
import random
import base64
import string
import io
from PIL import Image
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import OperationalError
from .schemas import ListItem as ListItemSchema

from fastapi import Depends, FastAPI, HTTPException, status, Body, UploadFile, File
from fastapi.staticfiles import StaticFiles

from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt

from . import crud, models, schemas, security
from .database import SessionLocal, engine

app = FastAPI()

# --- Static files for images ---
UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

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

@app.get("/api/status")
def get_status(db: Session = Depends(get_db)):
    return {"needs_setup": db.query(models.User).count() == 0}

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

def get_family_owner(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    family = db.query(models.Family).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    if family.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the family owner can perform this action")
    return family

# --- FAMILY ADMIN ---
@app.delete("/families/{family_id}/members/{user_id}", response_model=schemas.FamilyWithDetails)
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

@app.post("/families/{family_id}/transfer-ownership", response_model=schemas.Family)
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

@app.post("/families/{family_id}/products", response_model=schemas.Product, dependencies=[Depends(get_family_owner)])
def create_product_for_family(family_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db)):
    return crud.create_family_product(db=db, product=product, family_id=family_id)

@app.put("/families/{family_id}/products/{product_id}", response_model=schemas.Product, dependencies=[Depends(get_family_owner)])
def update_product_for_family(family_id: int, product_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id)
    if not db_product or db_product.family_id != family_id:
        raise HTTPException(status_code=404, detail="Product not found in this family")
    return crud.update_family_product(db=db, product_id=product_id, product_update=product)

@app.delete("/families/{family_id}/products/{product_id}", response_model=schemas.Product, dependencies=[Depends(get_family_owner)])
def delete_product_for_family(family_id: int, product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id)
    if not db_product or db_product.family_id != family_id:
        raise HTTPException(status_code=404, detail="Product not found in this family")
    return crud.delete_family_product(db=db, product_id=product_id)




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
            pass
            
    return new_user


@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# --- USER PROFILE ---
@app.put("/users/me", response_model=schemas.User)
def update_current_user(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_me(db=db, user=current_user, user_update=user_update)

@app.post("/users/me/change-password", response_model=schemas.User)
def change_current_user_password(
    password_change: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not security.verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    return crud.change_password(db=db, user=current_user, new_password=password_change.new_password)


# --- ADMIN: USER MANAGEMENT ---
@app.post("/admin/users", response_model=schemas.User, dependencies=[Depends(get_current_admin_user)])
def admin_create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.get("/admin/users", response_model=List[schemas.User], dependencies=[Depends(get_current_admin_user)])
def admin_get_all_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_users(db, skip=skip, limit=limit)

@app.get("/admin/users/{user_id}", response_model=schemas.User, dependencies=[Depends(get_current_admin_user)])
def admin_get_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.put("/admin/users/{user_id}", response_model=schemas.User, dependencies=[Depends(get_current_admin_user)])
def admin_update_user(user_id: int, user: schemas.UserUpdateByAdmin, db: Session = Depends(get_db)):
    db_user = crud.update_user(db, user_id=user_id, user_update=user)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.delete("/admin/users/{user_id}", response_model=schemas.User, dependencies=[Depends(get_current_admin_user)])
def admin_delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.delete_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


# --- ADMIN: FAMILY MANAGEMENT ---
@app.post("/admin/families/{family_id}/members/{user_id}", response_model=schemas.Family, dependencies=[Depends(get_current_admin_user)])
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

@app.delete("/admin/families/{family_id}/members/{user_id}", response_model=schemas.Family, dependencies=[Depends(get_current_admin_user)])
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
@app.get("/admin/families", response_model=List[schemas.FamilyWithDetails], dependencies=[Depends(get_current_admin_user)])
def admin_get_all_families(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_families(db, skip=skip, limit=limit)

@app.post("/admin/families", response_model=schemas.Family, dependencies=[Depends(get_current_admin_user)])
def admin_create_family(family: schemas.FamilyCreateByAdmin, db: Session = Depends(get_db)):
    return crud.create_family_by_admin(db, family=family)

@app.get("/admin/families/{family_id}", response_model=schemas.FamilyWithDetails, dependencies=[Depends(get_current_admin_user)])
def admin_get_family(family_id: int, db: Session = Depends(get_db)):
    db_family = crud.get_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family

@app.put("/admin/families/{family_id}", response_model=schemas.Family, dependencies=[Depends(get_current_admin_user)])
def admin_update_family(family_id: int, family: schemas.FamilyUpdateByAdmin, db: Session = Depends(get_db)):
    db_family = crud.update_family(db, family_id=family_id, family_update=family)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family

@app.delete("/admin/families/{family_id}", response_model=schemas.Family, dependencies=[Depends(get_current_admin_user)])
def admin_delete_family(family_id: int, db: Session = Depends(get_db)):
    db_family = crud.delete_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family
@app.get("/families/{family_id}/products", response_model=List[schemas.Product])
def get_products_for_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    return crud.get_products_by_family(db=db, family_id=family_id)

@app.get("/products/search", response_model=List[schemas.Product])
def search_products_endpoint(q: str, family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    get_family_for_user(family_id, current_user)
    return crud.search_products(db=db, name=q, family_id=family_id)

@app.post("/products/{product_id}/upload-image", response_model=schemas.Product)
def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # In a real app, you'd check if the user has permission to edit this product.
    # For now, we'll allow any authenticated user.

    try:
        contents = file.file.read()
        img = Image.open(io.BytesIO(contents))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        buffer = io.BytesIO()
        img.save(buffer, format="webp", quality=80)
        webp_image_bytes = buffer.getvalue()
        
        base64_encoded_image = base64.b64encode(webp_image_bytes).decode('utf-8')
        data_url = f"{base64_encoded_image}"

        db_product.image_url = data_url
        db.commit()
        db.refresh(db_product)
        return db_product

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

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

# --- SHOPPING LIST & ITEMS ---
@app.post("/items/", response_model=schemas.ListItem)
def create_item_for_list(
    item: schemas.ListItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping_list = crud.get_list(db, list_id=item.list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    family_id = None
    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
        family_id = shopping_list.calendar.family_id
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if not family_id:
        if not current_user.families:
            raise HTTPException(status_code=400, detail="User does not belong to any family.")
        family_id = current_user.families[0].id

    return crud.create_list_item(db=db, item=item, user_id=current_user.id, family_id=family_id)


@app.put("/items/{item_id}", response_model=schemas.ListItem)
def update_item_endpoint(
    item_id: int,
    item_update: schemas.ListItemUpdate,
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

    return crud.update_item(db=db, item_id=item_id, item_update=item_update, user_id=current_user.id)


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

@app.delete("/listas/{lista_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    
    crud.delete_shopping_list(db=db, list_id=lista_id)
    return

@app.put("/listas/{lista_id}", response_model=schemas.ShoppingList)
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

@app.get("/listas/{lista_id}", response_model=schemas.ShoppingList)
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

@app.get("/blame/lista/{list_id}", response_model=List[schemas.Blame])
def get_blame_for_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    # Verificación de permisos
    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta lista")

    return crud.get_blame_for_list(db=db, list_id=list_id)

@app.get("/families/{id_familia}/products", response_model=List[schemas.Product])
def get_products_for_family_alias(
    id_familia: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(id_familia, current_user)
    return crud.get_products_by_family(db=db, family_id=id_familia)

@app.get("/blame/item/{item_id}", response_model=List[schemas.Blame])
def get_blame_for_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verificar que el ítem exista
    item = crud.get_item(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    # Verificar permisos (según el dueño o la familia del calendario)
    lista = crud.get_list(db, list_id=item.list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver este ítem")

    return crud.get_blame_for_item(db=db, item_id=item_id)

@app.post("/listas/{list_id}/blames", response_model=schemas.Blame)
def create_blame_for_list(
    list_id: int,
    blame_data: schemas.BlameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=list_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    # Verificar permisos
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

@app.post("/items/{item_id}/blames", response_model=schemas.Blame)
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

@app.post("/items/{item_id}/upload-image")
def upload_image_for_item(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = crud.get_item(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    product = item.product
    if not product:
        raise HTTPException(status_code=404, detail="Product not found for this item")

    family = product.family
    if not family:
        raise HTTPException(status_code=400, detail="El producto no pertenece a ninguna familia")

    if current_user not in family.users and current_user.id != family.owner_id:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar este producto")

    try:
        image = Image.open(file.file)
    except Exception:
        raise HTTPException(status_code=400, detail="El archivo no es una imagen válida")

    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="WEBP", quality=80)
    buffer.seek(0)

    image_base64 = base64.b64encode(buffer.read()).decode("utf-8")

    product.image_url = image_base64
    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)

    return {
        "message": "Imagen convertida y guardada correctamente",
        "product_id": product.id,
        "image_url": image_base64
    }

@app.get("/api/home/last-lists", response_model=List[schemas.ShoppingList])
def get_last_lists(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_last_lists_for_user_families(db=db, user=current_user)

@app.get("/api/home/last-products", response_model=List[schemas.Product])
def get_last_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_last_products_for_user_families(db=db, user=current_user)