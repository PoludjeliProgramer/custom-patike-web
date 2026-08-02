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

-- 6. Visitor Sessions Table
CREATE TABLE IF NOT EXISTS visitor_sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    city VARCHAR(100),
    country VARCHAR(100),
    user_agent TEXT,
    email VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Visitor Activities Table
CREATE TABLE IF NOT EXISTS visitor_activities (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) REFERENCES visitor_sessions(session_token) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'page_view', 'button_click', 'add_to_cart', 'heartbeat'
    action_details TEXT,
    time_spent INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Abandoned Carts Table
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id SERIAL PRIMARY KEY,
    cart_token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    cart_data JSONB,
    status VARCHAR(50) DEFAULT 'captured', -- 'captured', 'emailed', 'recovered'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Sample Visitor Sessions & Activities
INSERT INTO visitor_sessions (session_token, ip_address, city, country, email, is_verified, created_at, updated_at)
VALUES 
('sess_vandal_894201', '89.164.22.14', 'Zagreb', 'Croatia', 'alexander.novak@example.com', true, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('sess_vandal_310492', '185.220.101.5', 'Berlin', 'Germany', NULL, true, CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '4 hours')
ON CONFLICT (session_token) DO NOTHING;

INSERT INTO visitor_activities (session_token, page_url, action_type, action_details, time_spent, created_at)
VALUES
('sess_vandal_894201', 'https://custompatike.com/', 'page_view', 'Home Page View', 45, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('sess_vandal_894201', 'https://custompatike.com/product/nike-air-force-1-bmw.html?utm_source=instagram&utm_campaign=bmw_edition', 'page_view', 'Viewed Nike Air Force 1 BMW', 120, CURRENT_TIMESTAMP - INTERVAL '1 hour 50 min'),
('sess_vandal_894201', 'https://custompatike.com/product/nike-air-force-1-bmw.html', 'add_to_cart', 'Added Size EU 42', 0, CURRENT_TIMESTAMP - INTERVAL '1 hour 45 min')
ON CONFLICT DO NOTHING;

