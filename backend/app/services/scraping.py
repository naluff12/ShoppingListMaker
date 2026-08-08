"""Helpers de scraping: extracción de imágenes y datos de producto desde URLs.

Estas funciones se movieron de main.py (monolito) para poder reutilizarlas
desde los routers de imágenes y tiendas sin duplicación.
"""
import html
import json
import re
from html.parser import HTMLParser
from types import SimpleNamespace
from urllib.parse import urljoin, urlparse
from typing import List, Optional

import httpx

from .. import crud
from ..models import StoreConnectorConfig


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


def normalize_price_string(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value)
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[^0-9,\.\-]', ' ', text)
    text = text.replace(',', '.')
    match = re.search(r'-?\d+(?:\.\d+)?', text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


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

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, timeout=20.0)
        response.raise_for_status()
        content_type = response.headers.get('content-type', '')
        text = response.text

    product_name = None
    price = None
    image_url = None
    description = None
    store_name = connector.name if connector else None

    if connector and connector.response_type == 'json':
        try:
            json_data = json.loads(text)
            product_name = extract_value_from_json(json_data, connector.json_name_path)
            price = normalize_price_string(extract_value_from_json(json_data, connector.json_price_path))
            image_url = extract_value_from_json(json_data, connector.json_image_path)
            description = extract_value_from_json(json_data, connector.json_description_path)
        except Exception:
            pass

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

    # Generic fallback extraction
    if not product_name:
        product_name = extract_meta_value(text, 'og:title') or extract_meta_value(text, 'twitter:title')
        if not product_name:
            title_match = re.search(r'<title>(.*?)</title>', text, re.IGNORECASE | re.DOTALL)
            if title_match:
                product_name = title_match.group(1).strip()

    if not image_url:
        image_url = extract_meta_value(text, 'og:image') or extract_meta_value(text, 'twitter:image')
        if not image_url:
            img_matches = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', text, re.IGNORECASE)
            image_url = img_matches[0] if img_matches else None

    if not price:
        price_match = re.search(r'[\$€¥]\s*\d+[\d,\.]*', text)
        price = normalize_price_string(price_match.group(0) if price_match else None)

    if not description:
        description = extract_meta_value(text, 'description')

    if image_url and image_url.startswith('/'):
        image_url = urljoin(url, image_url)

    return {
        'name': product_name,
        'price': price,
        'image_url': image_url,
        'description': description,
        'store_name': store_name or urlparse(url).netloc,
        'product_url': url
    }


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
        'is_active': config.get('is_active', True),
        'is_default': config.get('is_default', False)
    })
