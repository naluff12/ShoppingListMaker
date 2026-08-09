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
    category: Optional[str] = None
    brand: Optional[str] = None
    family_id: Optional[int] = None
    product_url: Optional[str] = None
    store_name: Optional[str] = None
    last_price: Optional[float] = None
    is_favorite: Optional[bool] = False
    peso_promedio: Optional[float] = None  # gramos por pieza (equivalencia unidad/peso)
    precio_base: Optional[float] = None    # precio de referencia (por kg o por pieza)
    precio_base_unit: Optional[str] = None  # 'kg' | 'pieza'

class ProductCreate(ProductBase):
    shared_image_id: Optional[int] = None

class Product(ProductBase):
    id: int
    shared_image: Optional["SharedImage"] = None
    price_history: List[PriceHistory] = []
    family: Optional["Family"] = None

    class Config:
        from_attributes = True

class PreviousProductHistoryItem(BaseModel):
    product_id: Optional[int] = None
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    occurrences: int = 0
    pending_count: int = 0
    purchased_count: int = 0
    last_seen: datetime
    last_list_name: Optional[str] = None
    last_list_date: Optional[datetime] = None
    last_price: Optional[float] = None
    shared_image: Optional["SharedImage"] = None

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


class ListItemCreate(BaseModel):
    nombre: str # Frontend will send the name of the product
    cantidad: float
    unit: Optional[str] = None
    list_id: int
    comentario: Optional[str] = None
    precio_estimado: Optional[float] = None
    precio_confirmado: Optional[float] = None
    category: Optional[str] = None
    brand: Optional[str] = None


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
    shared_image_id: Optional[int] = None


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


class ChatMessageBase(BaseModel):
    message: str
    list_id: Optional[int] = None
    is_private: Optional[bool] = False
    recipient_id: Optional[int] = None

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessage(ChatMessageBase):
    id: int
    family_id: int
    user_id: int
    created_at: datetime
    user: "UserInDBBase"
    recipient: Optional["UserInDBBase"] = None

    class Config:
        from_attributes = True

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
    brand: Optional[str] = None
    category: Optional[str] = None

class ListItemsBulkCreate(BaseModel):
    items: List[ListItemCreateBulk]

class ShoppingListTemplateItem(BaseModel):
    id: int
    nombre: str
    cantidad: float
    unit: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    precio_estimado: Optional[float] = None
    precio_confirmado: Optional[float] = None

    class Config:
        from_attributes = True

class ShoppingListTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    family_id: Optional[int] = None

class ShoppingListTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    list_id: int

class ShoppingListTemplate(ShoppingListTemplateBase):
    id: int
    owner_id: int
    created_at: datetime
    items: List[ShoppingListTemplateItem] = []

    class Config:
        from_attributes = True

class BudgetDetails(BaseModel):
    total_estimado: float
    total_comprado: float

class SharedImage(BaseModel):
    id: int
    file_path: str
    uploaded_by_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


User.model_rebuild()
Blame.model_rebuild()
ShoppingList.model_rebuild()
Product.model_rebuild()
PreviousProductHistoryItem.model_rebuild()
ListItem.model_rebuild()

# ---------- IMAGE SEARCH CONFIG ----------
class ImageSearchConfigBase(BaseModel):
    name: str
    base_url: str
    params_config: Optional[str] = None # JSON string
    results_per_page: int = 20
    response_type: str = 'json'
    json_list_path: Optional[str] = None
    json_preview_path: Optional[str] = None
    json_large_path: Optional[str] = None
    image_selector: Optional[str] = None
    image_attribute: str = 'src'
    is_active: bool = True
    is_default: bool = False

class ImageSearchConfigCreate(ImageSearchConfigBase):
    pass

class ImageSearchConfig(ImageSearchConfigBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class StoreConnectorConfigBase(BaseModel):
    name: str
    domain_match: Optional[str] = None
    response_type: str = 'html'
    json_name_path: Optional[str] = None
    json_price_path: Optional[str] = None
    json_image_path: Optional[str] = None
    json_description_path: Optional[str] = None
    html_name_selector: Optional[str] = None
    html_price_selector: Optional[str] = None
    html_image_selector: Optional[str] = None
    html_image_attribute: str = 'src'
    html_description_selector: Optional[str] = None
    is_active: bool = True
    is_default: bool = False

class StoreConnectorConfigCreate(StoreConnectorConfigBase):
    pass

class StoreConnectorConfig(StoreConnectorConfigBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
