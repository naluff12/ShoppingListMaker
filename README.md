# ShoppingListMaker

## Descripción general

ShoppingListMaker es una aplicación de lista de compras colaborativa diseñada para familias y grupos.
Permite crear familias, compartir listas, reutilizar productos frecuentes y administrar imágenes de productos desde una galería compartida.

## Objetivo del sistema

El objetivo es facilitar la gestión de compras recurrentes y mejorar la productividad familiar al centralizar:

- registro y control de usuarios
- organización de familias y miembros
- gestión de listas de compras y elementos
- reutilización de productos frecuentes y plantillas
- administración de imágenes compartidas para productos
- seguimiento por historial de compras y sugerencias inteligentes

## Funcionalidades principales

### Gestión de usuarios y familias

- Registro y login de usuarios
- Autenticación basada en JWT y cookies HttpOnly
- Creación de familias y administración de miembros
- Unión a familias mediante código de invitación
- Control de acceso por familia en todas las operaciones

### Listas de compras y productos

- Crear, editar y eliminar listas de compras
- Agregar y actualizar productos con nombre, cantidad, unidad, categoría, marca y precio estimado
- Guardar productos como favoritos rápidos
- Ver el estado de los productos en lista (`pendiente`, `comprado`, etc.)

### Historial recurrente de productos

- Historial familiar de productos usados anteriormente
- Filtro por período: **30 días**, **90 días**, **180 días**
- Búsqueda de historial por nombre, marca o categoría
- Selección múltiple para agregar productos recurrentes a la lista actual
- Visualización de la fecha de última aparición y origen de lista anterior

### Plantillas de lista

- Guardar una lista existente como plantilla
- Aplicar una plantilla a otra lista
- Reutilizar estructuras de compras frecuentes sin recrearlas desde cero

### Sugerencias y favoritos

- Productos sugeridos según el historial familiar
- Favoritos rápidos para cargar elementos recurrentes de forma inmediata
- Interfaz directa para agregar sugerencias a la lista activa

### Galería de imágenes compartida

- Subida de imágenes mediante `UploadFile` desde el frontend
- Almacenamiento de imágenes en el sistema de archivos del servidor
- Galería centralizada de imágenes reutilizables
- Selección de imagen de la galería al crear o editar un producto

## Arquitectura y stack tecnológico

### Backend

- FastAPI
- SQLAlchemy
- MariaDB (MySQL compatible)
- Pydantic
- Uvicorn
- Autenticación JWT con cookies
- Almacenamiento de imágenes estáticas en `backend/static/images`

### Frontend

- React
- Vite
- React Router
- React Calendar
- React Hot Toast
- Lucide icons

### Contenedores

- Docker Compose para orquestar:
  - `db` (MariaDB)
  - `backend` (FastAPI)
  - `frontend` (React + Nginx)

## Instalación y configuración

### Requisitos previos

- Docker
- Docker Compose
- Python 3.11+ (para desarrollo backend local y generación de llaves VAPID)
- Node.js / npm (para desarrollo frontend local)

### Configuración de entorno

1. Crea un archivo `.env` en la raíz del proyecto.
   Si existe un ejemplo, cópialo con:

   ```bash
   cp .env.example .env
   ```

2. Llena los valores en `.env` para el entorno local.
   - `MYSQL_ROOT_PASSWORD`
   - `MYSQL_DATABASE`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `DB_PORT`
   - `TZ`
   - `BACKEND_PORT`
   - `SECRET_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_PUBLIC_KEY`
   - `FRONTEND_PORT`
   - `FRONTEND_URL`
   - `COOKIE_SECURE`
   - `VITE_API_BASE_URL`
   - `VITE_WS_URL`
   - `VAPID_SUB_MAIL`

3. Genera las llaves VAPID si aún no las tienes:

   ```bash
   python backend/app/generate_keys.py
   ```

   Copia las llaves generadas a `VAPID_PRIVATE_KEY` y `VAPID_PUBLIC_KEY`.

4. Asegúrate de que `VITE_API_BASE_URL` apunte al backend y `VITE_WS_URL` apunte al WebSocket del backend. En desarrollo local suelen ser:

   - `VITE_API_BASE_URL=http://localhost:8000`
   - `VITE_WS_URL=ws://localhost:8000/ws`

5. Si trabajas localmente sin HTTPS, deja `COOKIE_SECURE=false` para que las cookies de sesión funcionen en `http://`.

### Levantar la aplicación con Docker Compose

```bash
docker compose up --build -d
```

### Acceder a los servicios

- Frontend: `http://localhost:<FRONTEND_PORT>`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### Desarrollo local sin Docker

#### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno importantes

- `MYSQL_ROOT_PASSWORD` – contraseña root de MariaDB
- `MYSQL_DATABASE` – nombre de la base de datos
- `MYSQL_USER` – usuario de base de datos
- `MYSQL_PASSWORD` – contraseña del usuario de base de datos
- `DB_PORT` – puerto de MariaDB en el host
- `TZ` – zona horaria del contenedor
- `BACKEND_PORT` – puerto en el que se expone el backend
- `SECRET_KEY` – clave secreta para JWT y sesiones
- `COOKIE_SECURE` – `false` en desarrollo local, `true` solo en HTTPS de producción
- `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` – llaves para notificaciones push
- `FRONTEND_URL` – URL pública del frontend, usada por el backend para CORS
- `VITE_API_BASE_URL` – URL base de la API usada por el frontend
- `VITE_WS_URL` – URL del WebSocket usada por el frontend
- `VAPID_SUB_MAIL` – correo de suscripción push

## Casos de uso

### 1. Registro y autenticación

- Crear una cuenta nueva
- Iniciar sesión
- El backend guarda la sesión en una cookie segura
- El usuario puede navegar a la pantalla principal y ver su familia

### 2. Creación y unión de familias

- Crear una familia propia
- Invitar a otros usuarios o unirse a una familia existente
- Compartir listas y datos dentro de la familia

### 3. Gestión de listas de compras

- Crear una nueva lista de compras
- Agregar productos con cantidad, unidad y precio
- Editar o eliminar productos existentes
- Marcar productos como comprados

### 4. Uso de historial recurrente

- Abrir el modal de productos anteriores
- Seleccionar el período de historial: `30`, `90` o `180` días
- Ver productos recurrentes usados por la familia
- Agregar productos recurrentes a la lista actual

### 5. Plantillas de compras

- Guardar una lista como plantilla
- Aplicar una plantilla a otra lista
- Reutilizar listas predefinidas rápidamente

### 6. Manejo de imágenes

- Subir una imagen para un producto
- Escoger una imagen almacenada en la galería compartida
- Reutilizar imágenes para varios productos
- Ver las imágenes desde la galería global

### 7. Sugerencias y favoritos

- Consultar productos sugeridos para la familia
- Agregar productos favoritos rápidamente con un clic
- Mantener la lista principal organizada y eficiente

## Endpoints clave

- `POST /api/token` – login
- `GET /api/users/me` – información de usuario actual
- `POST /api/families/join` – unirse a una familia
- `GET /api/families/{family_id}/previous_products?days={30|90|180}` – historial recurrente
- `GET /api/families/{family_id}/suggested-products` – productos sugeridos
- `GET /api/families/{family_id}/favorite-products` – favoritos rápidos
- `GET /api/images/gallery` – lista de imágenes compartidas
- `POST /api/products/{product_id}/favorite` – marcar favorito
- `POST /api/templates` – crear plantilla
- `POST /api/templates/{template_id}/apply?list_id={list_id}` – aplicar plantilla

## Estructura del proyecto

- `backend/` – servidor FastAPI y modelos de datos
- `frontend/` – interfaz React y componentes de UI
- `docker-compose.yml` – orquestación de contenedores
- `init.sql` – script inicial de base de datos
- `uploads/` – almacenamiento de imágenes compartidas

## Notas finales

ShoppingListMaker está diseñado para facilitar la colaboración familiar en la gestión de compras.
El sistema cubre desde la entrada de productos hasta la reutilización de listas y el uso de historial recurrente para agilizar las compras semanales o mensuales.

Para cualquier mejora, revisa `backend/app/main.py` y `frontend/src/PreviousItemsModal.jsx` para extender las funciones de historial y sugerencias.
