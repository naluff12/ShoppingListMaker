"""Router de imágenes: galería, búsqueda por motores configurables y subida."""
import json
import re
from typing import List, Optional

import httpx
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import crud, models, schemas, shared_images
from ..deps import get_current_admin_user, get_current_user, get_db
from ..services.scraping import extract_images_from_client_response
from ..utils import _safe_eval_arithmetic

router = APIRouter(tags=["images"])


def _process_string_with_vars(input_str, q, context):
    """Sustituye {{q}}, {{page}}, {{start}}... y expresiones aritméticas seguras."""
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
                return str(_safe_eval_arithmetic(safe_expr))
            except (ValueError, ZeroDivisionError):
                return match.group(0)
        return match.group(0)

    return re.sub(r'\{\{(.*?)\}\}', evaluate_expr, result)


def _build_search_params(config, q, page):
    """Construye el dict de params para la búsqueda según la config del motor."""
    limit = config.results_per_page or 20
    start_val = (page - 1) * limit
    context = {
        "page": page,
        "limit": limit,
        "start": start_val,
        "offset": start_val,
        "end": start_val + limit,
    }

    params = {}
    if config.params_config:
        try:
            config_list = json.loads(config.params_config)
            for item in config_list:
                k = item.get('key')
                v = item.get('value', '')
                if k:
                    params[k] = _process_string_with_vars(v, q, context)
        except Exception as e:
            print(f"Error parsing params_config: {e}")
            if not params:
                params = {"q": q}
    else:
        params = {"q": q}

    return params


@router.get("/images/engines", response_model=List[schemas.ImageSearchConfig])
def get_available_engines(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_image_search_configs(db, active_only=True)


@router.get("/images/search")
async def search_images(
    q: str,
    engine_id: Optional[int] = None,
    page: int = 1,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Proxies image search requests using configurable engines."""
    if engine_id:
        config = crud.get_image_search_config(db, engine_id)
    else:
        config = crud.get_default_image_search_config(db)

    if not config:
        # Fallback to mock search if no config exists
        return []

    parsed_base_url = _process_string_with_vars(config.base_url, q, {
        "page": page,
        "limit": config.results_per_page or 20,
        "start": (page - 1) * (config.results_per_page or 20),
        "offset": (page - 1) * (config.results_per_page or 20),
        "end": (page - 1) * (config.results_per_page or 20) + (config.results_per_page or 20),
    })
    params = _build_search_params(config, q, page)

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(parsed_base_url, params=params, timeout=15.0)
            response.raise_for_status()

            extraction_config = {
                "json_list_path": config.json_list_path,
                "json_preview_path": config.json_preview_path,
                "json_large_path": config.json_large_path,
                "image_selector": config.image_selector,
                "image_attribute": config.image_attribute,
            }

            return extract_images_from_client_response(config.response_type, response.text, extraction_config)

    except Exception as e:
        print(f"Error in dynamic search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/images/gallery", response_model=List[schemas.SharedImage])
def get_image_gallery(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return shared_images.get_shared_images(db=db)


@router.post("/images/upload", response_model=schemas.SharedImage)
async def upload_generic_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Generic image upload endpoint for new products or miscellaneous items."""
    try:
        shared_image = await shared_images.save_image(db, file, current_user.id)
        return shared_image
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@router.post("/images/from-url", response_model=schemas.SharedImage)
async def upload_image_from_url(
    image_data: dict,  # {"image_url": "..."}
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    url = image_data.get("image_url")
    if not url:
        raise HTTPException(status_code=400, detail="image_url is required")
    return await shared_images.save_image_from_url(db, url, current_user.id)


# --- ADMIN: IMAGE SEARCH CONFIG ---
@router.post("/admin/image-search-configs/test", dependencies=[Depends(get_current_admin_user)])
async def admin_test_image_search_config(
    test_data: dict = Body(...),  # {"base_url": "...", "params_config": "...", "q": "..."}
):
    """Tests a search configuration and returns the raw response."""
    base_url = test_data.get("base_url")
    params_config = test_data.get("params_config")
    q = test_data.get("q", "tomate")
    page = 1
    limit = 20
    start_val = 0

    if not base_url:
        raise HTTPException(status_code=400, detail="base_url is required")

    context = {
        "page": page,
        "limit": limit,
        "start": start_val,
        "offset": start_val,
        "end": start_val + limit,
    }

    params = {}
    if params_config:
        try:
            config_list = json.loads(params_config)
            for item in config_list:
                k = item.get('key')
                v = item.get('value', '')
                if k:
                    params[k] = _process_string_with_vars(v, q, context)
        except Exception as e:
            print(f"Error parsing params_config: {e}")
            if not params:
                params = {"q": q}
    else:
        params = {"q": q}

    parsed_base_url = _process_string_with_vars(base_url, q, context)

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(parsed_base_url, params=params, timeout=10.0)

            extraction_config = {
                "json_list_path": test_data.get("json_list_path"),
                "json_preview_path": test_data.get("json_preview_path"),
                "json_large_path": test_data.get("json_large_path"),
                "image_selector": test_data.get("image_selector"),
                "image_attribute": test_data.get("image_attribute"),
            }

            extracted_images = extract_images_from_client_response(
                test_data.get("response_type", "json"),
                response.text,
                extraction_config,
            )

            raw_data = None
            is_json = False
            try:
                raw_data = response.json()
                is_json = True
            except Exception:
                raw_data = response.text
                is_json = False

            return {
                "url": str(response.url),
                "status": response.status_code,
                "is_json": is_json,
                "data": raw_data,
                "extracted_images": extracted_images,
            }
    except Exception as e:
        return {
            "error": str(e),
            "status": 500,
        }


@router.get("/admin/image-search-configs", response_model=List[schemas.ImageSearchConfig], dependencies=[Depends(get_current_admin_user)])
def admin_get_image_search_configs(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_image_search_configs(db, active_only=active_only)


@router.post("/admin/image-search-configs", response_model=schemas.ImageSearchConfig, dependencies=[Depends(get_current_admin_user)])
def admin_create_image_search_config(config: schemas.ImageSearchConfigCreate, db: Session = Depends(get_db)):
    return crud.create_image_search_config(db, config=config)


@router.put("/admin/image-search-configs/{config_id}", response_model=schemas.ImageSearchConfig, dependencies=[Depends(get_current_admin_user)])
def admin_update_image_search_config(config_id: int, config: schemas.ImageSearchConfigBase, db: Session = Depends(get_db)):
    db_config = crud.update_image_search_config(db, config_id, config)
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")
    return db_config


@router.delete("/admin/image-search-configs/{config_id}", response_model=schemas.ImageSearchConfig, dependencies=[Depends(get_current_admin_user)])
def admin_delete_image_search_config(config_id: int, db: Session = Depends(get_db)):
    db_config = crud.delete_image_search_config(db, config_id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")
    return db_config
