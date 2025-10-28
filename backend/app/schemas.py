from pydantic import BaseModel, EmailStr
from typing import List, Optional, TypeVar, Generic
from datetime import date, datetime

T = TypeVar('T')

class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int


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

# ---------- PRICE HISTORY ----------
class PriceHistoryBase(BaseModel):
    price: float
    created_at: datetime

class PriceHistoryCreate(PriceHistoryBase):
    product_id: int

class PriceHistory(PriceHistoryBase):
    id: int

    class Config:
        from_attributes = True

# ---------- PRODUCT ----------
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    family_id: Optional[int] = None
    last_price: Optional[float] = None

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    price_history: List[PriceHistory] = []

    class Config:
        from_attributes = True


# ---------- LIST ITEMS ----------
class ListItemBase(BaseModel):
    comentario: Optional[str] = None
    cantidad: float
    unit: Optional[str] = None
    status: str
    product_id: Optional[int] = None
    nombre: str
    image_url: Optional[str] = None


class ListItemCreate(BaseModel):
    nombre: str # Frontend will send the name of the product
    cantidad: float
    unit: Optional[str] = None
    list_id: int
    comentario: Optional[str] = None
    precio_estimado: Optional[float] = None
    precio_confirmado: Optional[float] = None


class ListItem(ListItemBase):
    id: int
    list_id: int
    creado_por: Optional[UserInDBBase] = None
    precio_estimado: Optional[float] = None
    precio_confirmado: Optional[float] = None
    product: Optional[Product] = None # Nested product information

    class Config:
        from_attributes = True

class ListItemUpdate(BaseModel):
    product_id: Optional[int] = None
    comentario: Optional[str] = None
    cantidad: Optional[float] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    precio_estimado: Optional[float] = None
    precio_confirmado: Optional[float] = None


class ListItemStatusUpdate(BaseModel):
    status: str


# ---------- SHOPPING LIST ----------
class ShoppingListBase(BaseModel):
    name: str
    notas: Optional[str] = None
    comentarios: Optional[str] = None
    calendar_id: Optional[int] = None
    status: Optional[str] = None
    budget: Optional[float] = None


class ShoppingListCreate(ShoppingListBase):
    list_for_date: Optional[date] = None  # permite enviar la fecha deseada

class ShoppingListUpdate(BaseModel):
    name: Optional[str] = None
    notas: Optional[str] = None
    comentarios: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None


class ShoppingList(ShoppingListBase):
    id: int
    owner_id: int
    list_for_date: Optional[datetime] = None
    items: List[ListItem] = []
    calendar: Optional["Calendar"] = None
    budget: Optional[float] = None

    class Config:
        from_attributes = True


class ShoppingListResponse(ShoppingListBase):
    id: int
    owner_id: int
    list_for_date: Optional[datetime] = None
    calendar: Optional["Calendar"] = None
    budget: Optional[float] = None

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

class FamilyUpdateByAdmin(BaseModel):
    nombre: Optional[str] = None
    notas: Optional[str] = None
    owner_id: Optional[int] = None

class FamilyCreateByAdmin(BaseModel):
    nombre: str
    owner_id: int
    notas: Optional[str] = None

class TransferOwnershipRequest(BaseModel):
    new_owner_id: int




# ---------- USER ----------
class UserBase(BaseModel):
    email: EmailStr
    username: str
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

class UserCreate(UserBase):
    password: str
    is_admin: Optional[bool] = False

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

class UserUpdateByAdmin(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    nombre: Optional[str] = None
    is_admin: Optional[bool] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    nombre: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str




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


# ---------- NOTIFICATION ----------
class NotificationBase(BaseModel):
    message: str
    link: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: int
    family_id: int
    created_by_id: int

class Notification(NotificationBase):
    id: int
    is_read: bool
    created_at: datetime
    created_by: UserInDBBase

    class Config:
        from_attributes = True

class NotificationUpdate(BaseModel):
    is_read: bool


class ShoppingListInfo(BaseModel):
    id: int
    name: str
    list_for_date: datetime

    class Config:
        from_attributes = True

class ListItemCreateBulk(BaseModel):
    nombre: str
    cantidad: float
    unit: Optional[str] = None
    comentario: Optional[str] = None
    precio_estimado: Optional[float] = None

class ListItemsBulkCreate(BaseModel):
    items: List[ListItemCreateBulk]

class BudgetDetails(BaseModel):
    total_estimado: float
    total_comprado: float


User.model_rebuild()
Blame.model_rebuild()
ShoppingList.model_rebuild()