"""Helpers de scraping: extracción de imágenes y datos de producto desde URLs.

Estas funciones se movieron de main.py (monolito) para poder reutilizarlas
desde los routers de imágenes y tiendas sin duplicación.
"""
import html
import json
import re
import os
import asyncio
import random
from html.parser import HTMLParser
from types import SimpleNamespace
from urllib.parse import urljoin, urlparse, unquote
from typing import List, Optional

import httpx
from curl_cffi.requests import AsyncSession

from .. import crud
from ..models import StoreConnectorConfig

# User-Agent de navegador real para evitar bloqueos anti-bot
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.5",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

async def fetch_url_with_retry(url: str, max_retries: int = 3, timeout: float = 20.0):
    """GET con fingerprint TLS de Chrome (curl_cffi) y retry con backoff exponencial.

    El fingerprint de navegador real evita bloqueos anti-bot por TLS (Wikimedia,
    Walmart, Akamai) que httpx no puede superar.
    """
    last_exc = None
    for attempt in range(max_retries):
        try:
            # impersonate='chrome' ya envía los headers auténticos de Chrome;
            # headers extra (Pragma/Cache-Control) disparan WAFs como Akamai.
            async with AsyncSession(impersonate='chrome', timeout=timeout) as client:
                response = await client.get(url)
            # 418/403 = bloqueo anti-bot; reintentar no ayuda, pero avisamos claro
            if response.status_code in (403, 418):
                raise ValueError(f"Bloqueado por la tienda (HTTP {response.status_code}) — requiere navegador/cookies")
            # Challenge anti-bot con HTTP 200 (Akamai/WAF): reintentar puede dar la página real
            blocked_signal = detect_antiblock(response.text)
            if blocked_signal and attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt + random.uniform(0, 1))
                continue
            response.raise_for_status()
            return response
        except Exception as e:
            last_exc = e
            # 4xx (excepto 429) no se benefician de retry
            resp = getattr(e, 'response', None)
            if resp is not None and resp.status_code < 500 and resp.status_code != 429:
                raise
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt + random.uniform(0, 1))  # backoff 1-3-7s
    raise last_exc if last_exc else RuntimeError(f"Fallo al obtener {url}")


# ---------------------------------------------------------------------------
# Extracción de imágenes desde respuestas JSON/HTML (motores de búsqueda)
# ---------------------------------------------------------------------------

def extract_images_from_client_response(response_type: str, response_text: str, extraction_config: dict):
    """
    Helper function to extract images from a response based on config.
    extraction_config: {json_list_path, json_preview_path, json_large_path, image_selector, image_attribute}
    """
    if response_type == 'json':
        try:
            data = json.loads(response_text)
        except Exception:
            return []

        # Extract list of items
        items = data
        list_path = extraction_config.get('json_list_path')
        if list_path:
            for part in list_path.split('.'):
                if isinstance(items, dict):
                    items = items.get(part, [])

        results = []
        if not isinstance(items, (list, tuple)):
            return []

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue

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

    else:  # HTML
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
                            if match:
                                val = match.group(1)
                        val = val.strip().strip('"').strip("'")
                        if val:
                            self.results.append(val)

            def handle_endtag(self, tag):
                if self.matching_stack and self.matching_stack[-1] == tag:
                    self.matching_stack.pop()

        parser = MyHTMLParser(extraction_config.get('image_selector') or "", extraction_config.get('image_attribute') or "src")
        parser.feed(response_text)

        return [
            {"id": i, "previewURL": url, "largeImageURL": url}
            for i, url in enumerate(parser.results[:30])
        ]


def extract_value_from_json(data, path):
    if not path or data is None:
        return None
    current = data
    for part in path.split('.'):
        if isinstance(current, list):
            try:
                idx = int(part)
                current = current[idx]
            except Exception:
                return None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
        if current is None:
            return None
    return current


# Señales de challenge anti-bot / páginas de bloqueo (self-healing: detectar y avisar claro)
ANTIBOT_SIGNALS = [
    'verifica tu identidad', 'verify you are human', 'are you a robot',
    'access denied', 'robot check', 'captcha', 'just a moment',
    'enable javascript and cookies', 'request unsuccessful',
]

def detect_antiblock(html_text: str) -> Optional[str]:
    """Devuelve la señal de bloqueo encontrada o None si la página parece normal."""
    if not html_text:
        return None
    lower = html_text.lower()[:200000]  # solo el inicio, donde viven los challenges
    for signal in ANTIBOT_SIGNALS:
        if signal in lower:
            return signal
    return None


def normalize_price_string(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value)
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[^0-9,.\-]', ' ', text)
    text = text.replace(',', '.')
    match = re.search(r'-?\d+(?:\.\d+)?', text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def extract_jsonld_products(html_text):
    """Extrae productos desde bloques JSON-LD (schema.org).

    Fuente mas confiable: casi todas las tiendas grandes (Walmart, Soriana,
    Amazon, Liverpool) incrustan <script type="application/ld+json"> con el
    objeto Product (name, offers.price, image, description).
    """
    products = []
    for match in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html_text, re.IGNORECASE | re.DOTALL):
        raw = match.group(1).strip()
        try:
            data = json.loads(raw)
        except Exception:
            continue
        candidates = []
        if isinstance(data, dict):
            candidates.append(data)
            if isinstance(data.get('@graph'), list):
                candidates.extend(data['@graph'])
        elif isinstance(data, list):
            candidates.extend(data)

        for node in candidates:
            if not isinstance(node, dict):
                continue
            node_type = node.get('@type')
            if isinstance(node_type, list):
                node_type = node_type[0] if node_type else None
            if node_type in ('Product', 'IndividualProduct', 'ProductModel'):
                name = node.get('name') or node.get('headline')
                offers = node.get('offers') or {}
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                price = None
                if isinstance(offers, dict):
                    price = offers.get('price') or offers.get('lowPrice')
                    if price is None and isinstance(offers.get('priceSpecification'), dict):
                        price = offers['priceSpecification'].get('price')
                image = node.get('image')
                if isinstance(image, list):
                    image = image[0] if image else None
                if isinstance(image, dict):
                    image = image.get('url') or image.get('contentUrl')
                products.append({
                    'name': html.unescape(name) if name else None,
                    'price': normalize_price_string(price),
                    'image_url': image,
                    'description': html.unescape(node.get('description')) if node.get('description') else None,
                })
    return products


def extract_microdata_products(html_text):
    """Extrae productos desde microdatos (itemprop) — estandar schema.org en HTML."""
    items = []
    pattern = re.compile(r'itemtype=["\'][^"\']*schema\.org/(Product|IndividualProduct)["\']', re.IGNORECASE)
    for m in pattern.finditer(html_text):
        start = m.start()
        end = min(len(html_text), start + 12000)
        window = html_text[start:end]
        name = re.search(r'itemprop=["\']name["\'][^>]*>([^<]{2,200})<', window)
        price = (re.search(r'itemprop=["\']price["\']\s+content=["\']([\d.,]+)["\']', window)
                 or re.search(r'itemprop=["\']price["\']>([^<]+)<', window))
        image = (re.search(r'itemprop=["\']image["\']\s+content=["\']([^"\']+)["\']', window)
                 or re.search(r'itemprop=["\']image["\'][^>]*src=["\']([^"\']+)["\']', window))
        items.append({
            'name': name.group(1).strip() if name else None,
            'price': normalize_price_string(price.group(1)) if price else None,
            'image_url': image.group(1) if image else None,
            'description': None,
        })
    return items


def extract_products_from_response(response_type: str, response_text: str, extraction_config: dict):
    """Extrae PRODUCTOS (nombre/precio/imagen/descripción/url) desde la respuesta.

    Similar a extract_images_from_client_response pero enriquece cada resultado con
    los campos del producto definidos en el motor:
      json_list_path, json_name_path, json_price_path, json_preview_path,
      json_large_path, json_description_path, json_url_path
    Soporta listas y dicts (ej. query.pages de Wikipedia, keyed por id).
    """
    if response_type == 'json':
        try:
            data = json.loads(response_text)
        except Exception:
            return []

        items = data
        list_path = extraction_config.get('json_list_path')
        if list_path:
            for part in list_path.split('.'):
                if isinstance(items, dict):
                    items = items.get(part, [])

        # Wikipedia y similares devuelven dict keyed por id → tomamos los values
        if isinstance(items, dict):
            items = list(items.values())

        results = []
        if not isinstance(items, (list, tuple)):
            return []

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue

            def get_path(obj, path):
                if not path:
                    return None
                current = obj
                for part in path.split('.'):
                    if isinstance(current, list) and part.isdigit():
                        current = current[int(part)] if int(part) < len(current) else None
                    elif isinstance(current, dict):
                        current = current.get(part)
                    else:
                        return None
                    if current is None:
                        return None
                return current

            preview = get_path(item, extraction_config.get('json_preview_path'))
            large = get_path(item, extraction_config.get('json_large_path'))
            name = get_path(item, extraction_config.get('json_name_path'))
            price = get_path(item, extraction_config.get('json_price_path'))
            description = get_path(item, extraction_config.get('json_description_path'))
            url = get_path(item, extraction_config.get('json_url_path'))

            image = preview or large
            if not image and not name:
                continue  # sin imagen ni nombre no aporta nada

            if name:
                name = html.unescape(str(name))
            if description:
                description = html.unescape(str(description))[:300]

            results.append({
                'id': idx,
                'name': name or None,
                'price': normalize_price_string(price) if price else None,
                'description': description or None,
                'previewURL': preview or large,
                'largeImageURL': large or preview,
                'url': url or None,
            })
        return results

    # HTML: igual que imágenes, con nombre opcional desde alt/title
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
                        if match:
                            val = match.group(1)
                    val = val.strip().strip('"').strip("'")
                    if val:
                        self.results.append({
                            'src': val,
                            'alt': attrs_dict.get('alt'),
                            'href': attrs_dict.get('href'),
                        })

        def handle_endtag(self, tag):
            if self.matching_stack and self.matching_stack[-1] == tag:
                self.matching_stack.pop()

    parser = MyHTMLParser(extraction_config.get('image_selector') or '', extraction_config.get('image_attribute') or 'src')
    parser.feed(response_text)
    out = []
    for i, r in enumerate(parser.results[:30]):
        out.append({
            'id': i,
            'name': r.get('alt') or None,
            'price': None,
            'description': None,
            'previewURL': r['src'],
            'largeImageURL': r['src'],
            'url': r.get('href') or None,
        })
    return out


def extract_meta_value(html_text, meta_name):
    match = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]+content=["\']([^"\']+)["\']' % re.escape(meta_name), html_text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def extract_text_from_html(selector_str, html_text, attr='text'):
    class MyHTMLParser(HTMLParser):
        def __init__(self, selector_str, attr):
            super().__init__(convert_charrefs=True)
            self.selectors = [s.strip('.') for s in selector_str.split() if s.strip()]
            self.attr = attr
            self.results = []
            self.matching_stack = []
            self.accumulated = []

        def handle_starttag(self, tag, attrs):
            attrs_dict = dict(attrs)
            classes = attrs_dict.get('class', '').split()
            target_idx = len(self.matching_stack)
            if target_idx < len(self.selectors) and self.selectors[target_idx] in classes:
                self.matching_stack.append(tag)
            if len(self.matching_stack) == len(self.selectors):
                if self.attr != 'text':
                    val = attrs_dict.get(self.attr)
                    if val:
                        if self.attr == 'style' and 'url(' in val:
                            val = html.unescape(val)
                            match = re.search(r'url\([\"\']?(.*?)[\"\']?\)', val)
                            if match:
                                val = match.group(1)
                        val = val.strip().strip('"').strip("'")
                        if val:
                            self.results.append(val)
                else:
                    self.accumulated = []

        def handle_data(self, data):
            if self.attr == 'text' and len(self.matching_stack) == len(self.selectors):
                self.accumulated.append(data)

        def handle_endtag(self, tag):
            if self.matching_stack and self.matching_stack[-1] == tag:
                if self.attr == 'text' and self.accumulated:
                    text = ' '.join(self.accumulated).strip()
                    if text:
                        self.results.append(text)
                    self.accumulated = []
                self.matching_stack.pop()

    parser = MyHTMLParser(selector_str or '', attr)
    parser.feed(html_text)
    return parser.results


# ---------------------------------------------------------------------------
# Extracción de producto desde URL de tienda (conectores configurables)
# ---------------------------------------------------------------------------

def resolve_store_connector(db, url):
    connector = None
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
    except Exception:
        host = url

    connectors = crud.get_store_connectors(db, active_only=True)
    for c in connectors:
        if c.domain_match and c.domain_match.lower() in host:
            return c
    return crud.get_default_store_connector(db)

async def extract_product_from_store_url(url: str, connector: Optional[StoreConnectorConfig], db):
    if not url:
        raise ValueError('URL is required')

    def parse(text: str) -> dict:
        # Self-healing: si la tienda nos bloqueó (challenge/captcha), se avisa
        # claro al final; aquí solo se parsea el HTML que recibimos.
        blocked_signal = detect_antiblock(text)
        product_name = None
        price = None
        image_url = None
        description = None
        store_name = connector.name if connector else None

        # 1) JSON-LD (schema.org) — fuente más confiable en tiendas grandes
        jsonld = extract_jsonld_products(text)
        if jsonld:
            product_name = jsonld[0].get('name')
            price = jsonld[0].get('price')
            image_url = jsonld[0].get('image_url')
            description = jsonld[0].get('description')

        # 2) Microdatos (itemprop)
        if not (product_name and price):
            micro = extract_microdata_products(text)
            if micro:
                product_name = product_name or micro[0].get('name')
                price = price or micro[0].get('price')
                image_url = image_url or micro[0].get('image_url')

        # 3) Conector configurado (JSON paths)
        if connector and connector.response_type == 'json':
            try:
                json_data = json.loads(text)
                product_name = product_name or extract_value_from_json(json_data, connector.json_name_path)
                price = price or normalize_price_string(extract_value_from_json(json_data, connector.json_price_path))
                image_url = image_url or extract_value_from_json(json_data, connector.json_image_path)
                description = description or extract_value_from_json(json_data, connector.json_description_path)
            except Exception:
                pass

        # 4) Selectores HTML del conector
        if not product_name and connector and connector.html_name_selector:
            names = extract_text_from_html(connector.html_name_selector, text, attr='text')
            product_name = names[0] if names else None

        if not price and connector and connector.html_price_selector:
            values = extract_text_from_html(connector.html_price_selector, text, attr='text')
            price = normalize_price_string(values[0]) if values else None

        if not image_url and connector and connector.html_image_selector:
            values = extract_text_from_html(connector.html_image_selector, text, attr=connector.html_image_attribute or 'src')
            image_url = values[0] if values else None

        if not description and connector and connector.html_description_selector:
            values = extract_text_from_html(connector.html_description_selector, text, attr='text')
            description = values[0] if values else None

        # 5) Fallback genérico: meta tags → title → primer <img> → regex de precio
        if not product_name:
            product_name = extract_meta_value(text, 'og:title') or extract_meta_value(text, 'twitter:title')
            if not product_name:
                title_match = re.search(r'<title>(.*?)</title>', text, re.IGNORECASE | re.DOTALL)
                if title_match:
                    product_name = title_match.group(1).strip()
            if product_name:
                product_name = html.unescape(product_name)
                # Limpiar sufijos de tienda: "Producto | Gran Barata", "Producto - Walmart"
                for sep in (' | ', ' - ', ' — '):
                    if sep in product_name:
                        parts = product_name.split(sep)
                        # El sufijo típico de tienda es corto y sin dígitos
                        if len(parts) > 1 and len(parts[-1]) <= 30 and not re.search(r'\d', parts[-1]):
                            product_name = parts[0].strip()
                        break

        if not image_url:
            image_url = extract_meta_value(text, 'og:image') or extract_meta_value(text, 'twitter:image')
            if not image_url:
                img_matches = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', text, re.IGNORECASE)
                image_url = img_matches[0] if img_matches else None

        if not price:
            # Algunas tiendas exponen el precio en meta tags
            price = (normalize_price_string(extract_meta_value(text, 'og:price:amount'))
                     or normalize_price_string(extract_meta_value(text, 'product:price:amount'))
                     or normalize_price_string(extract_meta_value(text, 'og:price')))
            if not price:
                price_match = re.search(r'[\$€¥]\s*\d+[\d,\.]*', text)
                price = normalize_price_string(price_match.group(0) if price_match else None)

        if not description:
            description = extract_meta_value(text, 'description')

        if image_url and image_url.startswith('/'):
            image_url = urljoin(url, image_url)

        result = {
            'name': product_name,
            'price': price,
            'image_url': image_url,
            'description': description,
            'store_name': store_name or urlparse(url).netloc,
            'product_url': url
        }
        result['_blocked'] = blocked_signal
        return result

    server_text = (await fetch_url_with_retry(url)).text
    data = parse(server_text)

    # Fallback con navegador headless: tiendas que bloquean server-side
    # (MercadoLibre, Amazon, Walmart...) o SPA sin contenido en el HTML inicial.
    # Se dispara si falta nombre O precio (el shell server-side a veces trae el
    # <title> pero no el precio, p.ej. MercadoLibre).
    if (not data.get('name') or data.get('_blocked') or not data.get('price')) and BROWSER_URL:
        rendered = await browser_render(url, wait_ms=5000)
        if rendered:
            data2 = parse(rendered)
            if data2.get('name'):
                data = data2

    if not data.get('name'):
        blocked = detect_antiblock(server_text)
        if blocked:
            raise ValueError(
                f"La tienda solicitó verificación anti-bot (detectado: '{blocked}'). "
                f"Prueba con otra tienda o agrega el producto manualmente."
            )
    data.pop('_blocked', None)
    return data



def connector_from_config(config: dict) -> SimpleNamespace:
    """Convierte un dict de configuración (prueba de conector) en un objeto con la
    misma interfaz que StoreConnectorConfig, sin tocar la BD."""
    return SimpleNamespace(**{
        'name': config.get('name', 'Test Connector'),
        'domain_match': config.get('domain_match'),
        'response_type': config.get('response_type', 'html'),
        'json_name_path': config.get('json_name_path'),
        'json_price_path': config.get('json_price_path'),
        'json_image_path': config.get('json_image_path'),
        'json_description_path': config.get('json_description_path'),
        'html_name_selector': config.get('html_name_selector'),
        'html_price_selector': config.get('html_price_selector'),
        'html_image_selector': config.get('html_image_selector'),
        'html_image_attribute': config.get('html_image_attribute', 'src'),
        'html_description_selector': config.get('html_description_selector'),
        'search_url': config.get('search_url'),
        'search_params_config': config.get('search_params_config'),
        'search_response_type': config.get('search_response_type'),
        'search_list_path': config.get('search_list_path'),
        'search_name_path': config.get('search_name_path'),
        'search_price_path': config.get('search_price_path'),
        'search_image_path': config.get('search_image_path'),
        'search_url_path': config.get('search_url_path'),
        'search_item_selector': config.get('search_item_selector'),
        'search_image_attribute': config.get('search_image_attribute', 'src'),
        'price_pid_url': config.get('price_pid_url'),
        'price_pid_param': config.get('price_pid_param', 'pid'),
        'is_active': config.get('is_active', True),
        'is_default': config.get('is_default', False)
    })


# ---------------------------------------------------------------------------
# Búsqueda de productos DENTRO de una tienda (con precios reales)
# ---------------------------------------------------------------------------

STORE_ALIASES = {
    'soriana': 'soriana',
    'soriana.com': 'soriana',
}

SORIANA_SEARCH_URL = 'https://www.soriana.com/on/demandware.store/Sites-Soriana-Site/es_MX/Search-Show'
SORIANA_PRODUCT_AJAX = 'https://www.soriana.com/on/demandware.store/Sites-Soriana-Site/es_MX/Product-Show'

# Navegador headless (Playwright) para tiendas que bloquean server-side
BROWSER_URL = os.getenv('BROWSER_URL', 'http://browser:8580/render')


async def browser_render(url: str, wait_ms: int = 4000, selector=None) -> Optional[str]:
    """Renderiza una URL en un navegador headless y devuelve su HTML.

    Usado como fallback cuando una tienda devuelve anti-bot o una SPA sin
    contenido server-side (Walmart/Akamai, MercadoLibre, Smart, Cyberpuerta...).
    Devuelve None si el servicio de navegador no está disponible.
    """
    if not BROWSER_URL:
        return None
    try:
        payload = {'url': url, 'wait_ms': wait_ms}
        if selector:
            payload['selector'] = selector
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(BROWSER_URL, json=payload)
            r.raise_for_status()
            data = r.json()
            if data.get('ok') and data.get('html'):
                return data['html']
    except Exception:
        pass
    return None


async def _search_soriana_products(q: str, limit: int = 8) -> List[dict]:
    """Busca productos en soriana.com con su PRECIO real.

    SFCC (Salesforce Commerce Cloud): la búsqueda devuelve tiles con
    nombre/imagen/URL pero SIN precio (se carga por AJAX por producto).
    Pipeline: Search-Show → pids → Product-Show?format=ajax en paralelo → precio.
    """
    async with AsyncSession(impersonate='chrome', timeout=20.0) as client:
        response = await client.get(SORIANA_SEARCH_URL, params={'q': q})
        response.raise_for_status()
        text = response.text

    tiles = []
    # Solo tiles reales: <div class="product" data-pid="..."> (evita ids de analytics JS)
    pid_matches = list(re.finditer(r'data-pid="(\d+)"[^>]*>', text))
    for i, m in enumerate(pid_matches):
        pid = m.group(1)
        # El tile termina donde empieza el siguiente (los tiles son grandes)
        end = pid_matches[i + 1].start() if i + 1 < len(pid_matches) else min(len(text), m.start() + 30000)
        window = text[m.start():end]
        href = re.search(r'href="(/[^"]+\.html)"', window)
        name = re.search(r'class="[^"]*product-name[^"]*"[^>]*>([^<]{3,100})<', window)
        img = re.search(r'(?:data-src|src)="([^"]*(?:dw/image|images/product)[^"]*)"', window)
        if not href or not name:
            continue
        img_url = img.group(1).replace('&amp;', '&') if img else None
        if img_url and img_url.startswith('/'):
            img_url = urljoin('https://www.soriana.com', img_url)
        tiles.append({
            'pid': pid,
            'name': html.unescape(name.group(1).strip()),
            'image_url': img_url,
            'url': urljoin('https://www.soriana.com', href.group(1)),
        })
        if len(tiles) >= limit:
            break

    # dedupe por pid
    seen = set()
    tiles = [t for t in tiles if not (t['pid'] in seen or seen.add(t['pid']))][:limit]
    if not tiles:
        return []

    sem = asyncio.Semaphore(3)

    async def fetch_price(tile: dict) -> dict:
        async with sem:
            for attempt in range(2):
                try:
                    async with AsyncSession(impersonate='chrome', timeout=20.0) as c:
                        r = await c.get(SORIANA_PRODUCT_AJAX, params={'pid': tile['pid'], 'format': 'ajax'})
                        r.raise_for_status()
                        ajax_text = r.text
                        tile['price'] = _first_positive_price(ajax_text)
                        # La imagen del producto vive en el ajax (og:image o primer dw/image)
                        if not tile.get('image_url'):
                            img = re.search(r'property=["\']og:image["\'] content=["\']([^"\']+)["\']', ajax_text, re.I)
                            if not img:
                                img = re.search(r'(?:data-src|src)="([^"]*dw/image/[^"]+)"', ajax_text)
                            if img:
                                tile['image_url'] = img.group(1).replace('&amp;', '&')
                        break
                except Exception:
                    tile['price'] = None
                    if attempt == 0:
                        await asyncio.sleep(0.5)
        return tile

    results = await asyncio.gather(*[fetch_price(t) for t in tiles])
    # Con precio primero, sin precio al final (igual se devuelven)
    return sorted(results, key=lambda t: (t.get('price') is None, t.get('name') or ''))


def _first_positive_price(html_text: str) -> Optional[float]:
    """Primer precio > 0 en el HTML (ignora placeholders $0.00)."""
    for m in re.finditer(r'\$\s*(\d+[\d,]*\.?\d*)', html_text):
        try:
            val = float(m.group(1).replace(',', ''))
        except ValueError:
            continue
        if val > 0:
            return val
    return None


def _extract_mercadolibre_products(html_text: str, limit: int = 8) -> List[dict]:
    """Driver MercadoLibre: items poly-component con nombre (alt), precio, imagen y URL."""
    results = []
    seen = set()
    # Cada item de resultados tiene un <img class="poly-component__picture" ... alt="Nombre" ... src="...">
    for m in re.finditer(r'<img[^>]*class="poly-component__picture"[^>]*alt="([^"]+)"', html_text):
        start = m.start()
        window = html_text[start:start + 4000]
        img = re.search(r'src="(https://http2\.mlstatic\.com/[^"]+)"', window)
        frac = re.search(r'class="[^"]*andes-money-amount__fraction[^"]*"[^>]*>([\d.,]+)<', window)
        cents = re.search(r'class="[^"]*andes-money-amount__cents[^"]*"[^>]*>(\d+)<', window)
        link = re.search(r'href="(https://www\.mercadolibre\.com\.mx/[^"]+)"', window)
        if not frac or not link:
            continue
        price = frac.group(1)
        if cents:
            price += '.' + cents.group(1)
        # URL canónica: sin query de tracking ni fragmento
        url = re.sub(r'[?#].*$', '', link.group(1))
        if url in seen:
            continue
        seen.add(url)
        results.append({
            'name': html.unescape(m.group(1).strip()),
            'price': _first_positive_price(f'${price}') if price else None,
            'image_url': img.group(1) if img else None,
            'url': url,
        })
        if len(results) >= limit:
            break
    return results


def _extract_amazon_products(html_text: str, limit: int = 8) -> List[dict]:
    """Driver Amazon MX: items s-result-item por data-asin con título, precio e imagen."""
    results = []
    seen = set()
    for m in re.finditer(r'data-asin="([A-Z0-9]{10})"', html_text):
        asin = m.group(1)
        if asin in seen:
            continue
        seen.add(asin)
        start = m.start()
        window = html_text[start:start + 6000]
        # Primer h2 > span del bloque (evita el header de resultados)
        name = re.search(r'<h2[^>]*>\s*<span[^>]*>([^<]{4,150})</span>', window)
        price = re.search(r'class="a-offscreen">\$([\d.,]+)<', window)
        img = re.search(r'class="s-image"[^>]*src="([^"]+)"', window)
        link = re.search(r'href="([^"]*/dp/[A-Z0-9]{10}[^"]*)"', window)
        if not name and not price:
            continue
        dp_path = re.sub(r'[?#].*$', '', link.group(1)) if link else f'/dp/{asin}'
        url = f'https://www.amazon.com.mx{dp_path}'
        results.append({
            'name': html.unescape(name.group(1).strip()) if name else None,
            'price': _first_positive_price(f'${price.group(1)}') if price else None,
            'image_url': img.group(1) if img else None,
            'url': url,
        })
        if len(results) >= limit:
            break
    return results


def _extract_heb_products(html_text: str, limit: int = 8) -> List[dict]:
    """Driver HEB México (Next.js): items <a href="/slug-123/p"> con nombre, precio e imagen."""
    results = []
    seen = set()
    blocks = html_text.split('class="block w-full text-inherit no-underline"')
    for block in blocks[1:]:
        link = re.search(r'href="(/[^"]*-(\d+)/p)"', block)
        if not link:
            continue
        slug_url = link.group(1)
        if slug_url in seen:
            continue
        seen.add(slug_url)
        # Nombre: primer texto con mayúscula inicial largo, o alt de imagen de producto
        name = None
        texts = re.findall(r'>([A-ZÁÉÍÓÚÑ][^<>]{15,90})<', block)
        if texts:
            name = texts[0].strip()
        if not name:
            alt = re.search(r'alt="([^"]{4,80})"', block)
            if alt and 'HEB PRIME' not in alt.group(1):
                name = alt.group(1).strip()
        # Precio: el real está en span con clase text-gray-900 (precio actual);
        # los demás $X.XX del bloque son precios anteriores/descuentos
        price = None
        price_m = re.search(r'text-gray-900">\$?\s*(\d[\d,]*\.?\d*)<', block)
        if price_m:
            try:
                price = float(price_m.group(1).replace(',', ''))
            except ValueError:
                price = None
        # Imagen: ctfassets o styrk.io (a través de /_next/image?url=...)
        img = None
        img_m = re.search(r'<img[^>]*src="(https://[^"]*(?:ctfassets|styrk\.io)[^"]*)"[^>]*>', block)
        if img_m:
            img = html.unescape(img_m.group(1))
            # Des-URL-encodear el ?url= interno de _next/image si aplica
            m2 = re.search(r'url=([^&]+)', img)
            if m2:
                img = unquote(m2.group(1))
        results.append({
            'name': html.unescape(name) if name else None,
            'price': price,
            'image_url': img,
            'url': f'https://www.heb.com.mx{slug_url}',
        })
        if len(results) >= limit:
            break
    return results


async def search_products_in_store(store: str, q: str, limit: int = 8, db=None) -> List[dict]:
    """Busca productos con precio dentro de una tienda soportada.

    - Tiendas con motor integrado (soriana): pipeline especializado.
    - Tiendas configuradas como conectores con search_url: búsqueda genérica
      (JSON paths / selectores HTML + precio por pid si aplica).
    - store: 'soriana' (alias 'soriana.com'), o nombre/dominio de un conector.
    """
    store_key = STORE_ALIASES.get(store.strip().lower(), store.strip().lower())
    if store_key == 'soriana':
        return await _search_soriana_products(q, limit)

    connector = None
    if db is not None:
        try:
            connectors = crud.get_store_connectors(db, active_only=True)
            for c in connectors:
                if c.domain_match and store_key in c.domain_match.lower():
                    connector = c
                    break
                if c.name and store_key in c.name.lower():
                    connector = c
                    break
        except Exception:
            connector = None

    if connector and connector.search_url:
        return await _search_generic_connector(connector, q, limit)
    raise ValueError(
        f"Búsqueda por tienda no disponible para '{store}'. "
        f"Tiendas integradas: {', '.join(sorted(set(STORE_ALIASES.values())))}. "
        "Configura la tienda en el panel de conectores (con su URL de búsqueda) o usa 'agregar por URL'."
    )


async def _search_generic_connector(connector, q: str, limit: int = 8) -> List[dict]:
    """Búsqueda genérica usando la config de búsqueda del conector.

    Soporta respuestas JSON (paths) o HTML (selector de item), y precio por
    producto vía price_pid_url (SFCC-style) cuando la lista no trae precios.
    Para tiendas con estructura conocida (MercadoLibre, Amazon) usa un driver
    de extracción especializado.
    """
    from urllib.parse import quote, urlparse

    if not connector.search_url:
        raise ValueError(f"El conector '{connector.name}' no tiene URL de búsqueda configurada")

    # Plantillas {{q}} / {{limit}} en la URL
    search_url = connector.search_url.replace('{{q}}', quote(q)).replace('{{limit}}', str(limit))

    params = {}
    if connector.search_params_config:
        try:
            for item in json.loads(connector.search_params_config):
                k = item.get('key')
                v = item.get('value', '')
                if k:
                    params[k] = v.replace('{{q}}', q).replace('{{limit}}', str(limit))
        except Exception:
            params = {}

    async with AsyncSession(impersonate='chrome', timeout=20.0) as client:
        response = await client.get(search_url, params=params)
        response.raise_for_status()
        text = response.text

    domain = (connector.domain_match or connector.name or '').lower()

    def extract_from(html_text):
        # Drivers especializados por estructura conocida (funcionan con el DOM
        # renderizado y con el HTML server-side cuando existe)
        if 'mercadolibre' in domain:
            return _extract_mercadolibre_products(html_text, limit)
        if 'amazon' in domain:
            return _extract_amazon_products(html_text, limit)
        if 'heb.com' in domain:
            return _extract_heb_products(html_text, limit)
        resp_type = connector.search_response_type or 'json'
        if resp_type == 'json':
            return extract_products_from_response('json', html_text, {
                'json_list_path': connector.search_list_path,
                'json_name_path': connector.search_name_path,
                'json_price_path': connector.search_price_path,
                'json_preview_path': connector.search_image_path,
                'json_large_path': connector.search_image_path,
                'json_url_path': connector.search_url_path,
            })
        return extract_products_from_response('html', html_text, {
            'image_selector': connector.search_item_selector,
            'image_attribute': connector.search_image_attribute,
        })

    results = extract_from(text)

    # Fallback con navegador headless si el server-side no devuelve nada
    # (SPAs sin contenido, o tiendas con anti-bot).
    if not results:
        rendered = await browser_render(search_url, selector=connector.search_item_selector)
        if rendered:
            results = extract_from(rendered)
    elif BROWSER_URL and any(not r.get('image_url') for r in results):
        # Enriquecer con imágenes: el server-side a veces trae la lista pero
        # sin imágenes (loading="lazy" requiere render del navegador, p.ej. HEB).
        rendered = await browser_render(search_url, selector=connector.search_item_selector)
        if rendered:
            enriched = extract_from(rendered)
            if enriched:
                by_url = {r.get('url'): r for r in enriched if r.get('url')}
                for r in results:
                    if not r.get('image_url') and r.get('url') in by_url:
                        r['image_url'] = by_url[r['url']].get('image_url')
    results = results[:limit]

    # Precios por pid (tiendas que cargan precio por AJAX por producto)
    if connector.price_pid_url and results:
        sem = asyncio.Semaphore(3)

        async def enrich(r: dict) -> dict:
            if r.get('price') is not None:
                return r
            # Extraer pid de la URL del resultado o del primer query param
            pid = None
            if r.get('url'):
                parsed = urlparse(r['url'])
                for key in (connector.price_pid_param or 'pid', 'id', 'p', 'productId'):
                    pid = pid or (dict(pair.split('=') for pair in parsed.query.split('&') if '=' in pair).get(key))
                if not pid:
                    # último segmento de la ruta con dígitos
                    m = re.search(r'/(\d{4,})(?:\.html)?/?$', parsed.path)
                    pid = m.group(1) if m else None
            if not pid:
                return r
            async with sem:
                try:
                    async with AsyncSession(impersonate='chrome', timeout=20.0) as c:
                        pid_url = connector.price_pid_url.replace('{{pid}}', quote(str(pid)))
                        rr = await c.get(pid_url)
                        rr.raise_for_status()
                        r['price'] = _first_positive_price(rr.text)
                except Exception:
                    pass
            return r

        results = await asyncio.gather(*[enrich(r) for r in results])

    # URL absoluta si es relativa
    base = urlparse(search_url)
    for r in results:
        if r.get('url') and r['url'].startswith('/'):
            r['url'] = f"{base.scheme}://{base.netloc}{r['url']}"
    return sorted(results, key=lambda t: (t.get('price') is None, t.get('name') or ''))
