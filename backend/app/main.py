"""Punto de entrada de la API ShoppingListMaker.

Ensambla la aplicación FastAPI: lifespan (migración de esquema), CORS,
archivos estáticos y los routers por dominio.
"""
import json
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

    if inspector.has_table('image_search_configs'):
        columns = [c['name'] for c in inspector.get_columns('image_search_configs')]
        with engine.connect() as conn:
            if 'result_type' not in columns:
                conn.execute(text("ALTER TABLE image_search_configs ADD COLUMN result_type VARCHAR(20) DEFAULT 'images'"))
            if 'json_name_path' not in columns:
                conn.execute(text('ALTER TABLE image_search_configs ADD COLUMN json_name_path VARCHAR(100) NULL'))
            if 'json_price_path' not in columns:
                conn.execute(text('ALTER TABLE image_search_configs ADD COLUMN json_price_path VARCHAR(100) NULL'))
            if 'json_description_path' not in columns:
                conn.execute(text('ALTER TABLE image_search_configs ADD COLUMN json_description_path VARCHAR(100) NULL'))
            if 'json_url_path' not in columns:
                conn.execute(text('ALTER TABLE image_search_configs ADD COLUMN json_url_path VARCHAR(100) NULL'))
            conn.commit()

    if inspector.has_table('push_subscriptions'):
        columns = [c['name'] for c in inspector.get_columns('push_subscriptions')]
        with engine.connect() as conn:
            if 'user_id' not in columns:
                conn.execute(text('ALTER TABLE push_subscriptions ADD COLUMN user_id INTEGER NOT NULL'))
            if 'endpoint' not in columns:
                conn.execute(text('ALTER TABLE push_subscriptions ADD COLUMN endpoint TEXT NOT NULL'))
            if 'p256dh' not in columns:
                conn.execute(text('ALTER TABLE push_subscriptions ADD COLUMN p256dh TEXT NOT NULL'))
            if 'auth' not in columns:
                conn.execute(text('ALTER TABLE push_subscriptions ADD COLUMN auth TEXT NOT NULL'))
            if 'created_at' not in columns:
                conn.execute(text('ALTER TABLE push_subscriptions ADD COLUMN created_at DATETIME NULL'))
            conn.commit()

    if inspector.has_table('store_connector_configs'):
        columns = [c['name'] for c in inspector.get_columns('store_connector_configs')]
        with engine.connect() as conn:
            for col, ddl in [
                ('search_url', 'VARCHAR(500) NULL'),
                ('search_params_config', 'TEXT NULL'),
                ('search_response_type', "VARCHAR(20) NULL"),
                ('search_list_path', 'VARCHAR(100) NULL'),
                ('search_name_path', 'VARCHAR(100) NULL'),
                ('search_price_path', 'VARCHAR(100) NULL'),
                ('search_image_path', 'VARCHAR(100) NULL'),
                ('search_url_path', 'VARCHAR(100) NULL'),
                ('search_item_selector', 'VARCHAR(100) NULL'),
                ('search_image_attribute', "VARCHAR(50) DEFAULT 'src'"),
                ('price_pid_url', 'VARCHAR(500) NULL'),
                ('price_pid_param', 'VARCHAR(50) NULL'),
            ]:
                if col not in columns:
                    conn.execute(text(f'ALTER TABLE store_connector_configs ADD COLUMN {col} {ddl}'))
            conn.commit()


def seed_default_search_engines():
    """Siembra los motores de búsqueda por defecto (idempotente: solo si la tabla está vacía)."""
    from .database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(models.ImageSearchConfig).count() > 0:
            logger.info("Search engines already seeded (%d).", db.query(models.ImageSearchConfig).count())
            return
        defaults = [
            # 1) PRODUCTOS de despensa — API pública sin key (Open Food Facts)
            dict(
                name='OpenFoodFacts (productos)', base_url='https://world.openfoodfacts.org/cgi/search.pl',
                result_type='products', response_type='json',
                params_config=json.dumps([
                    {'key': 'search_terms', 'value': '{{q}}'},
                    {'key': 'search_simple', 'value': '1'},
                    {'key': 'action', 'value': 'process'},
                    {'key': 'json', 'value': '1'},
                    {'key': 'page_size', 'value': '{{limit}}'},
                    {'key': 'page', 'value': '{{page}}'},
                ]),
                results_per_page=12,
                json_list_path='products', json_name_path='product_name',
                json_preview_path='image_front_small_url', json_large_path='image_front_url',
                json_description_path='generic_name', json_url_path='url',
                is_active=True, is_default=True,
            ),
            # 2) Artículos/imágenes de Wikipedia ES — API pública sin key
            dict(
                name='Wikipedia (artículos)', base_url='https://es.wikipedia.org/w/api.php',
                result_type='products', response_type='json',
                params_config=json.dumps([
                    {'key': 'action', 'value': 'query'},
                    {'key': 'generator', 'value': 'search'},
                    {'key': 'gsrsearch', 'value': '{{q}}'},
                    {'key': 'gsrlimit', 'value': '{{limit}}'},
                    {'key': 'prop', 'value': 'pageimages|extracts'},
                    {'key': 'piprop', 'value': 'thumbnail'},
                    {'key': 'pithumbsize', 'value': '400'},
                    {'key': 'exintro', 'value': '1'},
                    {'key': 'explaintext', 'value': '1'},
                    {'key': 'format', 'value': 'json'},
                ]),
                results_per_page=10,
                json_list_path='query.pages', json_name_path='title',
                json_preview_path='thumbnail.source', json_large_path='thumbnail.source',
                json_description_path='extract', json_url_path='canonicalurl',
                is_active=False, is_default=False,
            ),
            # 3) Imágenes libres — Openverse (WordPress). No es tienda: inactivo por defecto
            dict(
                name='Openverse (imágenes)', base_url='https://api.openverse.org/v1/images/',
                result_type='images', response_type='json',
                params_config=json.dumps([
                    {'key': 'q', 'value': '{{q}}'},
                    {'key': 'page_size', 'value': '{{limit}}'},
                ]),
                results_per_page=20,
                json_list_path='results', json_name_path='title',
                json_preview_path='thumbnail', json_large_path='url',
                json_url_path='foreign_landing_url',
                is_active=False, is_default=False,
            ),
            # 4) Pixabay — requiere API key gratuita (ponerla en params_config)
            dict(
                name='Pixabay (imágenes)', base_url='https://pixabay.com/api/',
                result_type='images', response_type='json',
                params_config=json.dumps([
                    {'key': 'key', 'value': 'PON_TU_API_KEY'},
                    {'key': 'q', 'value': '{{q}}'},
                    {'key': 'per_page', 'value': '{{limit}}'},
                ]),
                results_per_page=12,
                json_list_path='hits',
                json_preview_path='previewURL', json_large_path='largeImageURL',
                is_active=False, is_default=False,
            ),
            # 5) Unsplash — requiere API key gratuita
            dict(
                name='Unsplash (imágenes)', base_url='https://api.unsplash.com/search/photos',
                result_type='images', response_type='json',
                params_config=json.dumps([
                    {'key': 'client_id', 'value': 'PON_TU_API_KEY'},
                    {'key': 'query', 'value': '{{q}}'},
                    {'key': 'per_page', 'value': '{{limit}}'},
                ]),
                results_per_page=12,
                json_list_path='results', json_name_path='alt_description',
                json_preview_path='urls.small', json_large_path='urls.regular',
                is_active=False, is_default=False,
            ),
            # 6) DuckDuckGo imágenes — sin key pero frágil (token vqd); útil como fallback manual
            dict(
                name='DuckDuckGo (imágenes)', base_url='https://duckduckgo.com/i.js',
                result_type='images', response_type='json',
                params_config=json.dumps([
                    {'key': 'q', 'value': '{{q}}'},
                    {'key': 'o', 'value': 'json'},
                ]),
                results_per_page=12,
                json_list_path='results',
                json_preview_path='thumbnail', json_large_path='image',
                json_name_path='title',
                is_active=False, is_default=False,
            ),
        ]
        for cfg in defaults:
            db.add(models.ImageSearchConfig(**cfg))
        db.commit()
        logger.info("Seeded %d default search engines.", len(defaults))
    except Exception as e:
        logger.warning("Could not seed search engines: %s", e)
        db.rollback()
    finally:
        db.close()


def seed_default_store_connectors():
    """Siembra los conectores de tiendas por defecto (idempotente: solo si la tabla está vacía).

    Solo las tiendas funcionales (Soriana, HEB, MercadoLibre, Amazon) se crean activas.
    """
    from .database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(models.StoreConnectorConfig).count() > 0:
            return
        defaults = [
            # 1) Soriana — motor completo (pipeline SFCC con precio por AJAX por pid)
            dict(
                name='Soriana', domain_match='soriana.com', response_type='json',
                json_name_path='name', json_price_path='offers.price',
                json_image_path='image',
                search_url='https://www.soriana.com/on/demandware.store/Sites-Soriana-Site/es_MX/Search-Show?q={{q}}',
                search_response_type='html',
                search_item_selector='product-name',
                price_pid_url='https://www.soriana.com/on/demandware.store/Sites-Soriana-Site/es_MX/Product-Show?pid={{pid}}&format=ajax',
                price_pid_param='pid',
                is_active=True, is_default=True,
            ),
            # 2) HEB México — Next.js; búsqueda real en /search?q= (driver _extract_heb_products)
            dict(
                name='HEB México', domain_match='heb.com.mx', response_type='json',
                json_name_path='name', json_price_path='price',
                search_url='https://www.heb.com.mx/search?q={{q}}',
                search_response_type='html',
                search_item_selector='block w-full text-inherit no-underline',
                is_active=True, is_default=False,
            ),
            # 3) MercadoLibre MX — HTML renderizado por JS: activo con driver + navegador headless
            dict(
                name='MercadoLibre', domain_match='mercadolibre.com.mx', response_type='json',
                json_name_path='title', json_price_path='price', json_image_path='thumbnail',
                search_url='https://listado.mercadolibre.com.mx/{{q}}',
                search_response_type='html',
                search_item_selector='poly-component',
                search_url_path='permalink',
                is_active=True, is_default=False,
            ),
            # 4) Amazon MX — HTML renderizado (intermitente): driver por data-asin + navegador
            dict(
                name='Amazon México', domain_match='amazon.com.mx', response_type='json',
                json_name_path='title', json_price_path='price',
                search_url='https://www.amazon.com.mx/s?k={{q}}',
                search_response_type='html',
                search_item_selector='s-result-item',
                is_active=True, is_default=False,
            ),
            # (Walmart, Smart, Cyberpuerta, Liverpool, Coppel, Sanborns se omiten — siempre fallan)
        ]
        for cfg in defaults:
            db.add(models.StoreConnectorConfig(**cfg))
        db.commit()
        logger.info("Seeded %d default store connectors.", len(defaults))
    except Exception as e:
        logger.warning("Could not seed store connectors: %s", e)
        db.rollback()
    finally:
        db.close()


def ensure_active_store_connectors():
    """Garantiza que las tiendas funcionales (Soriana, HEB, MercadoLibre, Amazon) estén
    activas en cada arranque, aún si la base ya estaba poblada.
    """
    from .database import SessionLocal
    db = SessionLocal()
    try:
        connectors = db.query(models.StoreConnectorConfig).all()
        functional_domains = ['soriana.com', 'heb.com.mx', 'mercadolibre.com.mx', 'amazon.com.mx']
        for c in connectors:
            if c.domain_match and any(func in c.domain_match.lower() for func in functional_domains):
                if not c.is_active:
                    logger.info(f"Activando tienda funcional: {c.name} ({c.domain_match})")
                    c.is_active = True
        db.commit()
    except Exception as e:
        logger.warning(f"Could not enforce active store connectors: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    max_retries = 10
    retries = 0
    while retries < max_retries:
        try:
            models.Base.metadata.create_all(bind=engine)
            ensure_database_schema()
            seed_default_search_engines()
            seed_default_store_connectors()
            ensure_active_store_connectors()
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
