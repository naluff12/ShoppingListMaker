"""Punto de entrada de la API ShoppingListMaker.

Ensambla la aplicación FastAPI: lifespan (migración de esquema), CORS,
archivos estáticos y los routers por dominio.
"""
import logging
import os
import time

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from . import models
from .database import engine
from .routers import admin, auth, families, home, images, lists, products, stores, ws

logger = logging.getLogger(__name__)


def ensure_database_schema():
    inspector = inspect(engine)

    if inspector.has_table('products'):
        columns = [c['name'] for c in inspector.get_columns('products')]
        with engine.connect() as conn:
            if 'product_url' not in columns:
                conn.execute(text('ALTER TABLE products ADD COLUMN product_url VARCHAR(255) NULL'))
            if 'store_name' not in columns:
                conn.execute(text('ALTER TABLE products ADD COLUMN store_name VARCHAR(100) NULL'))
            if 'is_favorite' not in columns:
                conn.execute(text('ALTER TABLE products ADD COLUMN is_favorite BOOLEAN DEFAULT 0'))
            if 'peso_promedio' not in columns:
                conn.execute(text('ALTER TABLE products ADD COLUMN peso_promedio FLOAT NULL'))
            if 'precio_base' not in columns:
                conn.execute(text('ALTER TABLE products ADD COLUMN precio_base FLOAT NULL'))
            if 'precio_base_unit' not in columns:
                conn.execute(text("ALTER TABLE products ADD COLUMN precio_base_unit VARCHAR(10) NULL"))
            conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    max_retries = 10
    retries = 0
    while retries < max_retries:
        try:
            models.Base.metadata.create_all(bind=engine)
            ensure_database_schema()
            logger.info("Database tables created and schema ensured.")
            break
        except OperationalError as e:
            logger.warning(f"Database connection failed: {e}")
            retries += 1
            logger.info(f"Retrying connection ({retries}/{max_retries})...")
            time.sleep(5)
    if retries == max_retries:
        logger.error("Could not connect to the database. Exiting.")
        raise RuntimeError("Could not connect to the database.")
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Middleware
frontend_url = os.getenv("FRONTEND_URL", "*")
allowed_origins = [o.strip() for o in frontend_url.split(",")] if frontend_url != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Routers por dominio ---
app.include_router(auth.router)
app.include_router(families.router)
app.include_router(products.router)
app.include_router(lists.router)
app.include_router(home.router)
app.include_router(images.router)
app.include_router(stores.router)
app.include_router(admin.router)
app.include_router(ws.router)
