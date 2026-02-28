from datetime import date, timedelta, datetime
from typing import List, Optional
import time
import os
import random
import string

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from .schemas import ListItem as ListItemSchema

from fastapi import Depends, FastAPI, HTTPException, status, Body, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt

from . import crud, models, schemas, security, tz_util, shared_images
from .database import SessionLocal, engine
from .websockets import manager
import httpx

app = FastAPI()

app.mount("/static", StaticFiles(directory="backend/static"), name="static")

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

@app.get("/status")
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

@app.put("/products/{product_id}", response_model=schemas.Product)
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

@app.delete("/products/{product_id}")
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

@app.get("/products/{product_id}/prices", response_model=List[schemas.PriceHistory])
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

@app.get("/admin/products/all", response_model=schemas.Page[schemas.Product], dependencies=[Depends(get_current_admin_user)])
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
@app.get("/families/{family_id}/products", response_model=schemas.Page[schemas.Product])
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

@app.get("/families/{family_id}/filters")
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

@app.get("/products/search", response_model=schemas.Page[schemas.Product])
def search_products_endpoint(q: str, family_id: int, page: int = 1, size: int = 10, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    get_family_for_user(family_id, current_user)
    result = crud.search_products(db=db, name=q, family_id=family_id, skip=(page - 1) * size, limit=size)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)

@app.get("/images/gallery", response_model=List[schemas.SharedImage])
def get_image_gallery(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return shared_images.get_shared_images(db=db)


@app.post("/products/{product_id}/upload-image", response_model=schemas.Product)
async def upload_product_image(
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
def get_my_families(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.is_admin:
        return crud.get_families(db)
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

@app.get("/families/{family_id}/previous_lists", response_model=schemas.Page[schemas.ShoppingListResponse])
def get_previous_lists_for_family(
    family_id: int,
    page: int = 1,
    size: int = 10,
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_family_for_user(family_id, current_user)
    result = crud.get_lists_by_family(db=db, family_id=family_id, skip=(page - 1) * size, limit=size, start_date=start_date, end_date=end_date)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)

# --- SHOPPING LIST & ITEMS ---
@app.post("/items/", response_model=schemas.ListItem)
def create_item_for_list(
    item: schemas.ListItemCreate,
    background_tasks: BackgroundTasks,
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

    new_item = crud.create_list_item(db=db, item=item, user_id=current_user.id, family_id=family_id)
    background_tasks.add_task(
        manager.broadcast_to_family, 
        family_id, 
        {"action": "ITEM_CREATED", "list_id": new_item.list_id, "item_id": new_item.id}
    )
    return new_item

@app.post("/listas/{list_id}/items/bulk", response_model=List[schemas.ListItem])
def create_bulk_items_for_list(
    list_id: int,
    items: schemas.ListItemsBulkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping_list = crud.get_list(db, list_id=list_id)
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

    return crud.create_list_items_bulk(db=db, items=items.items, list_id=list_id, user_id=current_user.id, family_id=family_id)


@app.put("/items/{item_id}", response_model=schemas.ListItem)
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

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    family_id = shopping_list.calendar.family_id if shopping_list.calendar else None
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


@app.delete("/items/{item_id}", response_model=schemas.ListItem)
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

    if shopping_list.calendar:
        get_family_for_user(shopping_list.calendar.family_id, current_user)
    elif shopping_list.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    family_id = shopping_list.calendar.family_id if shopping_list.calendar else None
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



@app.post("/listas/", response_model=schemas.ShoppingListResponse)
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

@app.get("/listas/", response_model=schemas.Page[schemas.ShoppingListResponse])
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
    
    crud.delete_shopping_list(db=db, list_id=lista_id, user_id=current_user.id)
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

@app.get("/listas/{lista_id}/budget-details", response_model=schemas.BudgetDetails)
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

@app.post("/items/{item_id}/upload-image", response_model=schemas.ListItem)
async def upload_image_for_item(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
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

@app.get("/home/last-lists", response_model=List[schemas.ShoppingListResponse])
def get_last_lists(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_last_lists_for_user_families(db=db, user=current_user)

@app.get("/home/last-products", response_model=List[schemas.Product])
def get_last_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_last_products_for_user_families(db=db, user=current_user)

# --- NOTIFICATION ENDPOINTS ---
@app.get("/notifications", response_model=schemas.Page[schemas.Notification])
def get_notifications(
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = crud.get_notifications_by_user(db, user_id=current_user.id, skip=(page - 1) * size, limit=size)
    return schemas.Page(items=result["items"], total=result["total"], page=page, size=size)

@app.post("/notifications/{notification_id}/mark-as-read", response_model=schemas.Notification)
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notification = crud.mark_notification_as_read(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@app.post("/notifications/mark-all-as-read", response_model=List[schemas.Notification])
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.mark_all_notifications_as_read(db, user_id=current_user.id)

@app.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notification = crud.delete_notification(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return

@app.get("/listas/{lista_id}/items", response_model=schemas.Page[schemas.ListItem])
def get_items_for_list(
    lista_id: int,
    page: int = 1,
    size: int = 10,
    status: str = None,
    category: str = None,
    brand: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lista = crud.get_list(db, list_id=lista_id)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    # 🔐 Verificar permisos
    if lista.calendar:
        get_family_for_user(lista.calendar.family_id, current_user)
    elif lista.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta lista")

    # 🔹 Obtener ítems con paginación
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

@app.get("/listas/{lista_id}/filter-options")
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

# --- IMAGE SEARCH ENDPOINTS ---

def extract_images_from_client_response(response_type: str, response_text: str, extraction_config: dict):
    """
    Helper function to extract images from a response based on config.
    extraction_config: {json_list_path, json_preview_path, json_large_path, image_selector, image_attribute}
    """
    if response_type == 'json':
        import json
        try:
            data = json.loads(response_text)
        except: return []
        
        # Extract list of items
        items = data
        list_path = extraction_config.get('json_list_path')
        if list_path:
            for part in list_path.split('.'):
                if isinstance(items, dict):
                    items = items.get(part, [])
        
        results = []
        if not isinstance(items, (list, tuple)): return []
        
        for idx, item in enumerate(items):
            if not isinstance(item, dict): continue
            
            preview = item
            preview_path = extraction_config.get('json_preview_path')
            if preview_path:
                for part in preview_path.split('.'):
                    if isinstance(preview, dict):
                        preview = preview.get(part)
            
            large = item
            large_path = extraction_config.get('json_large_path')
            if large_path:
                for part in large_path.split('.'):
                    if isinstance(large, dict):
                        large = large.get(part)
            
            if preview and large and isinstance(preview, str) and isinstance(large, str):
                results.append({
                    "id": idx,
                    "previewURL": preview,
                    "largeImageURL": large
                })
        return results
    
    else: # HTML
        from html.parser import HTMLParser
        import html
        import re

        class MyHTMLParser(HTMLParser):
            def __init__(self, selector_str, attr):
                super().__init__()
                self.selectors = [s.strip('.') for s in selector_str.split() if s.strip()]
                self.attr = attr
                self.results = []
                self.matching_stack = []

            def handle_starttag(self, tag, attrs):
                attrs_dict = dict(attrs)
                classes = attrs_dict.get('class', '').split()
                target_idx = len(self.matching_stack)
                if target_idx < len(self.selectors):
                    if self.selectors[target_idx] in classes:
                        self.matching_stack.append(tag)
                
                if len(self.matching_stack) == len(self.selectors):
                    val = attrs_dict.get(self.attr)
                    if val:
                        if self.attr == 'style' and 'url(' in val:
                            val = html.unescape(val)
                            match = re.search(r'url\([\'"]?(.*?)[\'"]?\)', val)
                            if match: val = match.group(1)
                        val = val.strip().strip('"').strip("'")
                        if val: self.results.append(val)

            def handle_endtag(self, tag):
                if self.matching_stack and self.matching_stack[-1] == tag:
                    self.matching_stack.pop()

        parser = MyHTMLParser(extraction_config.get('image_selector') or "", extraction_config.get('image_attribute') or "src")
        parser.feed(response_text)
        
        return [
            {"id": i, "previewURL": url, "largeImageURL": url}
            for i, url in enumerate(parser.results[:30])
        ]

@app.get("/images/search")
async def search_images(
    q: str,
    engine_id: Optional[int] = None,
    page: int = 1,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Proxies image search requests using configurable engines.
    """
    if engine_id:
        config = crud.get_image_search_config(db, engine_id)
    else:
        config = crud.get_default_image_search_config(db)
        
    if not config:
        # Fallback to mock search if no config exists
        return []

    # Prepare parameters
    params = {}
    limit = config.results_per_page or 20
    start_val = (page - 1) * limit
    parsed_base_url = config.base_url
    
    import json
    import re
    
    context = {
        "page": page,
        "limit": limit,
        "start": start_val,
        "offset": start_val,
        "end": start_val + limit
    }

    def process_string_with_vars(input_str):
        if not input_str:
            return input_str
            
        # 1. Replace the search query (non-numeric)
        result = input_str.replace('{{q}}', q)
        
        # 2. Find complex expressions like {{page * 24}}
        def evaluate_expr(match):
            expr = match.group(1).strip()
            # Sanity check: allow only numbers, basic operators and context keys
            safe_expr = expr
            for key in context:
                safe_expr = safe_expr.replace(key, str(context[key]))
            
            # Remove whitespace and check if only valid chars remain
            clean_expr = re.sub(r'[\s\d\+\-\*\/\(\)]', '', safe_expr)
            if clean_expr == '':
                try:
                    # Safe eval since it's just numbers and operators now
                    return str(int(eval(safe_expr)))
                except:
                    return match.group(0)
            return match.group(0)

        return re.sub(r'\{\{(.*?)\}\}', evaluate_expr, result)

    parsed_base_url = process_string_with_vars(parsed_base_url)

    if config.params_config:
        try:
            config_list = json.loads(config.params_config)
            for item in config_list:
                k = item.get('key')
                v = item.get('value', '')
                if k:
                    params[k] = process_string_with_vars(v)
        except Exception as e:
            print(f"Error parsing params_config: {e}")
            # Fallback to basic q if parsing fails and it's missing
            if not params: params = {"q": q}
    else:
        # Default behavior if no config
        params = {"q": q}

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(parsed_base_url, params=params, timeout=15.0)
            response.raise_for_status()
            
            extraction_config = {
                "json_list_path": config.json_list_path,
                "json_preview_path": config.json_preview_path,
                "json_large_path": config.json_large_path,
                "image_selector": config.image_selector,
                "image_attribute": config.image_attribute
            }
            
            return extract_images_from_client_response(config.response_type, response.text, extraction_config)

    except Exception as e:
        print(f"Error in dynamic search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/image-search-configs/test", dependencies=[Depends(get_current_admin_user)])
async def admin_test_image_search_config(
    test_data: dict = Body(...), # {"base_url": "...", "params_config": "...", "q": "..."}
):
    """
    Tests a search configuration and returns the raw response.
    """
    base_url = test_data.get("base_url")
    params_config = test_data.get("params_config")
    q = test_data.get("q", "tomate")
    page = 1
    limit = 20
    start_val = 0

    if not base_url:
        raise HTTPException(status_code=400, detail="base_url is required")

    # Prepare parameters (copied logic from search_images)
    params = {}
    import json
    import re

    context = {
        "page": page,
        "limit": limit,
        "start": start_val,
        "offset": start_val,
        "end": start_val + limit
    }

    def process_string_with_vars(input_str):
        if not input_str:
            return input_str
        result = input_str.replace('{{q}}', q)
        def evaluate_expr(match):
            expr = match.group(1).strip()
            safe_expr = expr
            for key in context:
                safe_expr = safe_expr.replace(key, str(context[key]))
            clean_expr = re.sub(r'[\s\d\+\-\*\/\(\)]', '', safe_expr)
            if clean_expr == '':
                try:
                    return str(int(eval(safe_expr)))
                except: return match.group(0)
            return match.group(0)
        return re.sub(r'\{\{(.*?)\}\}', evaluate_expr, result)

    parsed_base_url = process_string_with_vars(base_url)

    if params_config:
        try:
            config_list = json.loads(params_config)
            for item in config_list:
                k = item.get('key')
                v = item.get('value', '')
                if k:
                    params[k] = process_string_with_vars(v)
        except Exception as e:
            print(f"Error parsing params_config: {e}")
            if not params: params = {"q": q}
    else:
        params = {"q": q}

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(parsed_base_url, params=params, timeout=10.0)
            
            # Extract visual results using the helper
            extraction_config = {
                "json_list_path": test_data.get("json_list_path"),
                "json_preview_path": test_data.get("json_preview_path"),
                "json_large_path": test_data.get("json_large_path"),
                "image_selector": test_data.get("image_selector"),
                "image_attribute": test_data.get("image_attribute")
            }
            
            extracted_images = extract_images_from_client_response(
                test_data.get("response_type", "json"), 
                response.text, 
                extraction_config
            )
                
            # Try to parse as JSON first
            raw_data = None
            is_json = False
            try:
                raw_data = response.json()
                is_json = True
            except:
                raw_data = response.text
                is_json = False
                
            return {
                "url": str(response.url),
                "status": response.status_code,
                "is_json": is_json,
                "data": raw_data,
                "extracted_images": extracted_images
            }
    except Exception as e:
        return {
            "error": str(e),
            "status": 500
        }

# --- ADMIN: IMAGE SEARCH CONFIG ENDPOINTS ---

@app.get("/admin/image-search-configs", response_model=List[schemas.ImageSearchConfig], dependencies=[Depends(get_current_admin_user)])
def admin_get_image_search_configs(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_image_search_configs(db, active_only=active_only)

@app.post("/admin/image-search-configs", response_model=schemas.ImageSearchConfig, dependencies=[Depends(get_current_admin_user)])
def admin_create_image_search_config(config: schemas.ImageSearchConfigCreate, db: Session = Depends(get_db)):
    return crud.create_image_search_config(db, config=config)

@app.put("/admin/image-search-configs/{config_id}", response_model=schemas.ImageSearchConfig, dependencies=[Depends(get_current_admin_user)])
def admin_update_image_search_config(config_id: int, config: schemas.ImageSearchConfigBase, db: Session = Depends(get_db)):
    db_config = crud.update_image_search_config(db, config_id, config)
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")
    return db_config

@app.delete("/admin/image-search-configs/{config_id}", response_model=schemas.ImageSearchConfig, dependencies=[Depends(get_current_admin_user)])
def admin_delete_image_search_config(config_id: int, db: Session = Depends(get_db)):
    db_config = crud.delete_image_search_config(db, config_id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")
    return db_config

@app.get("/images/engines", response_model=List[schemas.ImageSearchConfig])
def get_available_engines(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_image_search_configs(db, active_only=True)

@app.get("/products/search", response_model=schemas.Page[schemas.Product])
def search_products_endpoint(
    family_id: int,
    q: str,
    page: int = 1,
    size: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Authorization check
    get_family_for_user(family_id, current_user)
    
    products_list = crud.search_products(db, name=q, family_id=family_id, skip=(page-1)*size, limit=size)
    # We need total count for pagination
    # For now, let's just use a simple query
    total = db.query(models.Product).filter(
        models.Product.family_id == family_id,
        models.Product.name.ilike(f"%{q}%")
    ).count()
    
    return {
        "items": products_list,
        "total": total,
        "page": page,
        "size": size
    }

@app.post("/products/{product_id}/image-from-url", response_model=schemas.Product)
async def update_product_image_from_url(
    product_id: int,
    image_data: dict, # {"image_url": "..."}
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
        await manager.broadcast_to_family(product.family_id, {
            "type": "product_update",
            "product_id": product.id,
            "action": "image_updated",
            "new_image_url": shared_image.file_path
        })

    return product

@app.websocket("/ws/{family_id}")
async def websocket_endpoint(websocket: WebSocket, family_id: int):
    # Depending on auth, wait, how to auth a websocket?
    # For now, just accept
    await manager.connect(websocket, family_id)
    try:
        while True:
            data = await websocket.receive_text()
            # We don't really expect clients to send messages right now, but we keep the connection open
    except WebSocketDisconnect:
        manager.disconnect(websocket, family_id)
