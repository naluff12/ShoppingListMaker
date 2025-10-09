from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Enum, Boolean, Float, Text, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

user_families = Table('user_families', Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('family_id', Integer, ForeignKey('families.id'), primary_key=True)
)

class Family(Base):
    __tablename__ = 'families'
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    notas = Column(Text)
    owner_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="owned_families")
    users = relationship("User", secondary=user_families, back_populates="families")
    calendars = relationship("Calendar", back_populates="family")

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    nombre = Column(String(100))
    direccion = Column(String(255))
    telefono = Column(String(50))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    families = relationship("Family", secondary=user_families, back_populates="users")
    owned_families = relationship("Family", back_populates="owner")
    lists = relationship("ShoppingList", back_populates="owner")
    blame = relationship("Blame", back_populates="user")
    items_creados = relationship("ListItem", back_populates="creado_por")

class Calendar(Base):
    __tablename__ = 'calendars'
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    notas = Column(Text)
    comentarios = Column(Text)
    family_id = Column(Integer, ForeignKey('families.id'))
    owner_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    family = relationship("Family", back_populates="calendars")
    owner = relationship("User")
    lists = relationship("ShoppingList", back_populates="calendar")

class ShoppingList(Base):
    __tablename__ = 'shopping_lists'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    notas = Column(Text)
    comentarios = Column(Text)
    calendar_id = Column(Integer, ForeignKey('calendars.id'))
    owner_id = Column(Integer, ForeignKey('users.id'))
    list_for_date = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    calendar = relationship("Calendar", back_populates="lists")
    owner = relationship("User", back_populates="lists")
    items = relationship("ListItem", back_populates="list")

    # Relación hacia Blame (una lista puede tener varios registros de blame)
    blame = relationship(
        "Blame",
        primaryjoin="and_(ShoppingList.id==Blame.entity_id, Blame.entity_type=='lista')",
        back_populates="shopping_list",
        foreign_keys="[Blame.entity_id]",
        uselist=True,
        viewonly=True  # evita intentar insertar FK inexistente
    )



class ListItem(Base):
    __tablename__ = 'list_items'
    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey('shopping_lists.id'))
    nombre = Column(String(255), nullable=False)
    comentario = Column(Text)
    cantidad = Column(String(50), default='1')
    status = Column(Enum('pendiente', 'comprado', 'ya no se necesita', name='item_status'), default='pendiente')
    precio_estimado = Column(Float)
    precio_confirmado = Column(Float)
    creado_por_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    list = relationship("ShoppingList", back_populates="items")
    creado_por = relationship("User", back_populates="items_creados")
    blame = relationship(
        "Blame",
        primaryjoin="and_(ListItem.id==foreign(Blame.entity_id), Blame.entity_type=='item')",
        back_populates="list_item"
    )


class Blame(Base):
    __tablename__ = 'blames'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    action = Column(String(50))  # creado, editado, borrado
    entity_type = Column(String(50))  # familia, calendario, lista, item
    entity_id = Column(Integer)  # no tiene FK directa
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    detalles = Column(Text)

    user = relationship("User", back_populates="blame")

    # Asociación manual con ShoppingList (N:1)
    shopping_list = relationship(
        "ShoppingList",
        primaryjoin="and_(Blame.entity_id==ShoppingList.id, Blame.entity_type=='lista')",
        back_populates="blame",
        foreign_keys="[Blame.entity_id]",
        uselist=False,
        viewonly=True
    )

    # Asociación manual con ListItem (N:1)
    list_item = relationship(
        "ListItem",
        primaryjoin="and_(Blame.entity_id==ListItem.id, Blame.entity_type=='item')",
        back_populates="blame",
        foreign_keys="[Blame.entity_id]",
        uselist=False,
        viewonly=True
    )