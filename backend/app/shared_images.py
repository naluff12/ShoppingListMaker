import os
import uuid
import httpx
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from typing import Optional

from . import models
from . import crud

# Define the static directory for images
# This should be configured appropriately for production
STATIC_DIR = "backend/static"
IMAGES_SUBDIR = os.path.join(STATIC_DIR, "images")

# Ensure the static directories exist
os.makedirs(IMAGES_SUBDIR, exist_ok=True)

async def save_image(db: Session, file: UploadFile, user_id: Optional[int] = None) -> models.SharedImage:
    # ... existing save_image implementation ...
    # (Rest of the file remains same, I will add the new function below)
    """
    Saves an uploaded image file to the static directory and creates a record in the database.
    """
    try:
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'png'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path_on_disk = os.path.join(IMAGES_SUBDIR, unique_filename)

        print(f"Attempting to save image to: {file_path_on_disk}") # Added logging

        # Save the file to disk
        with open(file_path_on_disk, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        print(f"Image successfully saved to disk: {file_path_on_disk}") # Added logging

        # Create a database record
        db_shared_image = models.SharedImage(
            file_path=f"/static/images/{unique_filename}", # Stored as a URL-friendly path
            uploaded_by_user_id=user_id
        )
        db.add(db_shared_image)
        db.commit()
        db.refresh(db_shared_image)
        return db_shared_image
    except Exception as e:
        print(f"Error saving image to {file_path_on_disk}: {e}") # Added detailed error logging
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save image: {e}")

async def save_image_from_url(db: Session, url: str, user_id: Optional[int] = None) -> models.SharedImage:
    """
    Downloads an image from a URL, saves it to the static directory, and creates a database record.
    """
    print(f"DEBUG: Starting download from URL: {url}")
    try:
        async with httpx.AsyncClient() as client:
            # Longer timeout for heavy downloads or slow servers
            response = await client.get(url, timeout=60.0)
            response.raise_for_status()
            
            content_type = response.headers.get("content-type", "")
            print(f"DEBUG: Downloaded {len(response.content)} bytes. Content-type: {content_type}")
            
            if not content_type.startswith("image/"):
                print(f"DEBUG: Invalid content-type {content_type}")
                raise HTTPException(status_code=400, detail="URL does not point to a valid image")
            
            # Extract extension from content type or URL
            extension = "png"
            if "image/jpeg" in content_type: extension = "jpg"
            elif "image/webp" in content_type: extension = "webp"
            elif "image/gif" in content_type: extension = "gif"
            
            unique_filename = f"{uuid.uuid4()}.{extension}"
            file_path_on_disk = os.path.join(IMAGES_SUBDIR, unique_filename)
            
            print(f"DEBUG: Writing image to disk: {file_path_on_disk}")
            with open(file_path_on_disk, "wb") as buffer:
                buffer.write(response.content)
            
            print(f"DEBUG: Creating database record for {unique_filename}")
            db_shared_image = models.SharedImage(
                file_path=f"/static/images/{unique_filename}",
                uploaded_by_user_id=user_id
            )
            db.add(db_shared_image)
            db.commit()
            db.refresh(db_shared_image)
            print(f"DEBUG: Database record created with ID: {db_shared_image.id}")
            return db_shared_image
            
    except httpx.HTTPError as e:
        print(f"DEBUG: HTTP error downloading image from {url}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to download image from URL: {str(e)}")
    except Exception as e:
        print(f"DEBUG: Error saving image from URL {url}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save image from URL: {str(e)}")

def get_shared_images(db: Session, skip: int = 0, limit: int = 100):
    """
    Retrieves a list of shared images from the database.
    """
    return db.query(models.SharedImage).offset(skip).limit(limit).all()

def get_shared_image_by_id(db: Session, image_id: int):
    """
    Retrieves a shared image by its ID from the database.
    """
    return db.query(models.SharedImage).filter(models.SharedImage.id == image_id).first()

# You might add functions for deleting images, handling image resizing, etc.