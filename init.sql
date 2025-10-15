CREATE DATABASE IF NOT EXISTS shopping_db;

USE shopping_db;

CREATE TABLE families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    notas TEXT,
    owner_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    nombre VARCHAR(100),
    direccion VARCHAR(255),
    telefono VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_families (
    user_id INT NOT NULL,
    family_id INT NOT NULL,
    PRIMARY KEY (user_id, family_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE
);

ALTER TABLE families
ADD FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE calendars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    notas TEXT,
    comentarios TEXT,
    family_id INT,
    owner_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families (id),
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE TABLE shopping_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    notas TEXT,
    comentarios TEXT,
    status ENUM(
        'pendiente',
        'revisada',
        'no revisada'
    ) DEFAULT 'pendiente',
    calendar_id INT,
    owner_id INT,
    list_for_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (calendar_id) REFERENCES calendars (id),
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    family_id INT,
    image_url LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    UNIQUE KEY (name, family_id)
);

CREATE TABLE list_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    list_id INT,
    product_id INT NULL,
    nombre VARCHAR(255) NOT NULL,
    comentario TEXT,
    cantidad FLOAT DEFAULT 1.0,
    unit VARCHAR(50) NULL,
    status ENUM(
        'pendiente',
        'comprado',
        'ya no se necesita'
    ) DEFAULT 'pendiente',
    precio_estimado FLOAT,
    precio_confirmado FLOAT,
    creado_por_id INT,
    image_url LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES shopping_lists (id),
    FOREIGN KEY (creado_por_id) REFERENCES users (id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE blames (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id INT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    detalles TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
);