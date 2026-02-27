# Refactorización del Almacenamiento de Imágenes e Implementación de Galería Compartida

## Descripción

Este proyecto ha sido refactorizado para cambiar el sistema de almacenamiento de imágenes. Anteriormente, las imágenes se guardaban en la base de datos en formato base64. Ahora, las imágenes se guardan en el sistema de archivos del servidor y se ha implementado un sistema de galería de imágenes reutilizables.

## Cambios Realizados

### Backend (FastAPI)

- **Modelos de Base de Datos:**
    - Se ha modificado la tabla `products` y `list_items` para cambiar la columna `image_url` de `LONGTEXT` a `String(255)`. Esta columna ahora guarda la ruta (URL) al archivo de imagen estático.
    - Se ha creado una nueva tabla en la base de datos llamada `shared_images` que contiene `id`, `file_path` y `uploaded_by_user_id`.
- **Endpoints de Carga:**
    - Se han modificado los endpoints que suben imágenes para que acepten un archivo (`UploadFile`) en lugar de un string base64.
    - Al recibir un archivo, el servidor lo guarda en una carpeta estática en el sistema de archivos (`backend/static/images`) con un nombre de archivo único (UUID).
    - Cada vez que se sube una nueva imagen, se crea un nuevo registro en la tabla `shared_images` con la ruta al archivo.
- **Endpoints para la Galería:**
    - Se ha creado un nuevo endpoint `GET /api/images/gallery` que devuelve una lista de todas las imágenes disponibles en la tabla `shared_images`.
    - Se han modificado los endpoints de creación/actualización de productos para que, para asignar una imagen a un producto, el frontend pueda enviar el `id` de una imagen existente de la galería.

### Frontend (React)

- **Carga de Imágenes:**
    - Se ha modificado el componente `ImageUploader.jsx` para que use `FormData` para enviar el archivo de imagen completo al backend.
- **Componente de Galería:**
    - Se ha creado un nuevo componente `ImageGalleryModal.jsx` que hace una llamada al endpoint `GET /api/images/gallery` y muestra las imágenes en una grilla seleccionable.
- **Integración en el Flujo de Usuario:**
    - Al crear o editar un producto, el usuario ahora tiene dos opciones: "Subir nueva imagen" o "Elegir de la galería".
    - Al hacer clic en "Elegir de la galería", se abre el `ImageGalleryModal.jsx`. Al seleccionar una imagen de la galería, su ID se asocia con el producto que se está editando.

## ¿Cómo Probar?

1.  Ejecuta el backend y el frontend.
2.  Navega a una lista de compras.
3.  Intenta agregar un nuevo producto. Verás la opción de subir una imagen o elegir una de la galería.
4.  Sube una nueva imagen. Deberías ver la imagen en la lista de productos.
5.  Elige una imagen de la galería. Deberías ver la imagen en la lista de productos.
6.  La imagen subida también debería estar disponible en la galería para otros productos.
