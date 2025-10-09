from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import date, datetime

# Forward references for circular dependencies
class UserInDBBase(BaseModel):
    id: int
    username: str
    email: EmailStr
    nombre: Optional[str] = None

    class Config:
        from_attributes = True

class Family(BaseModel):
    id: int
    code: str
    nombre: str
    notas: Optional[str] = None
    owner: Optional[UserInDBBase] = None

    class Config:
        from_attributes = True

# ---------- PRODUCT ----------
class Product(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- LIST ITEMS ----------
class ListItemBase(BaseModel):
    nombre: str
    comentario: Optional[str] = None
    cantidad: str
    status: str


class ListItemCreate(BaseModel):
    nombre: str
    cantidad: str
    list_id: int
    comentario: Optional[str] = None


class ListItem(ListItemBase):
    id: int
    creado_por: Optional[UserInDBBase] = None

    class Config:
        from_attributes = True


class ListItemStatusUpdate(BaseModel):
    status: str


# ---------- SHOPPING LIST ----------
class ShoppingListBase(BaseModel):
    name: str
    notas: Optional[str] = None
    comentarios: Optional[str] = None
    calendar_id: Optional[int] = None


class ShoppingListCreate(ShoppingListBase):
    list_for_date: Optional[date] = None  # permite enviar la fecha deseada


class ShoppingList(ShoppingListBase):
    id: int
    owner_id: int
    list_for_date: Optional[datetime] = None
    items: List[ListItem] = []

    class Config:
        from_attributes = True


# ---------- FAMILY ----------
class FamilyBase(BaseModel):
    nombre: str
    notas: Optional[str] = None

class FamilyCreate(FamilyBase):
    pass

class FamilyJoin(BaseModel):
    code: str

class FamilyWithDetails(Family):
    users: List[UserInDBBase] = []


# ---------- USER ----------
class UserBase(BaseModel):
    email: EmailStr
    username: str
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserRegister(BaseModel):
    user: UserCreate
    family_code: Optional[str] = None

class User(UserBase):
    id: int
    is_admin: bool
    families: List[Family] = []
    blames: List["Blame"] = []

    class Config:
        from_attributes = True


# ---------- CALENDAR ----------
class CalendarBase(BaseModel):
    nombre: str
    notas: Optional[str] = None
    comentarios: Optional[str] = None

class CalendarCreate(CalendarBase):
    pass

class Calendar(CalendarBase):
    id: int
    family_id: int
    owner: Optional[UserInDBBase] = None

    class Config:
        from_attributes = True

# ---------- SETUP ----------
class SetupRequest(BaseModel):
    family: FamilyCreate
    admin: UserCreate


class SetupResponse(BaseModel):
    family: Family
    admin: User


# ---------- TOKEN ----------
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# ---------- BLAME ----------
class BlameBase(BaseModel):
    detalles: str


class BlameCreate(BlameBase):
    pass


class Blame(BlameBase):
    id: int
    user_id: int
    action: str
    entity_type: str
    entity_id: int
    timestamp: datetime
    user: "User"

    class Config:
        from_attributes = True


User.model_rebuild()
Blame.model_rebuild()

