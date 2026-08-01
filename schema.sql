-- Database Schema for Custom Patike (PostgreSQL)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    address VARCHAR(255),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Croatia',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    handle VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Sneakers',
    price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),
    image_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'In Hand-Painting',
    subtotal DECIMAL(10,2) NOT NULL,
    shipping DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    size VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT DEFAULT 1
);

-- 5. Custom Commissions Table
CREATE TABLE IF NOT EXISTS custom_commissions (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    concept_title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Mockup Approved',
    atelier_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Sample User
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, city, postal_code, country)
VALUES ('alexander.novak@example.com', '$2b$10$e8T7Qz_mock_hash_custompatike', 'Alexander', 'Novak', '+385 91 234 5678', 'Stradun 42', 'Dubrovnik', '20000', 'Croatia')
ON CONFLICT (email) DO NOTHING;

-- Seed Sample Orders
INSERT INTO orders (order_number, user_id, status, subtotal, shipping, total, created_at)
VALUES 
('CP-8492', 1, 'In Hand-Painting (Phase 2)', 170.00, 0.00, 170.00, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('CP-7104', 1, 'Delivered & Sealed', 170.00, 0.00, 170.00, CURRENT_TIMESTAMP - INTERVAL '78 days')
ON CONFLICT (order_number) DO NOTHING;

-- Seed Sample Order Items
INSERT INTO order_items (order_id, product_name, size, price, quantity)
VALUES 
(1, 'Nike Air Force 1 BMW Custom', 'EU 42', 170.00, 1),
(2, 'Nike Air Force 1 - Audi RS', 'EU 43', 170.00, 1);

-- Seed Sample Custom Commission
INSERT INTO custom_commissions (ticket_number, user_id, concept_title, status, atelier_notes, created_at)
VALUES 
('CUSTOM-9021', 1, 'Porsche 911 GT3 RS Lizard Green Edition on Air Jordan 1 Low', 'Mockup Approved (In Queue)', 'Leather preparation & primer coat scheduled for Monday.', CURRENT_TIMESTAMP - INTERVAL '12 days')
ON CONFLICT (ticket_number) DO NOTHING;
