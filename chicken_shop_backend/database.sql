-- database.sql
CREATE DATABASE chicken_shop;

\c chicken_shop;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'cashier'
);

CREATE TABLE customers (
    phone_no VARCHAR(20) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    description TEXT,
    qty INT DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(255)
);

CREATE TABLE pending_bills (
    id SERIAL PRIMARY KEY,
    items JSONB NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE completed_bills (
    bill_no SERIAL PRIMARY KEY,
    customer_phone VARCHAR(20) REFERENCES customers(phone_no),
    items JSONB NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    final_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin user (password: admin123)
INSERT INTO users (username, password_hash, role) VALUES ('admin', '$2b$10$wY9Pj/xR6G9l9w4S8K9xOeb1l1w4Z4.K/K3rK9l9w4S8K9xOeb1l', 'admin');
