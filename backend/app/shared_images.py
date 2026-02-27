import os
import uuid
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