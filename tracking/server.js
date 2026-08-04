require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const https = require('https');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const app = express();
const PORT = process.env.PORT || 4055;
const JWT_SECRET = process.env.JWT_SECRET || 'cp_jwt_user_secret_2026_atelier';

app.use(cors());

// Raw body parser for Stripe Webhook BEFORE express.json()
app.use('/api/checkout/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Parse sendBeacon text/plain payloads
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'text/plain' || req.headers['content-type'] === 'text/plain;charset=UTF-8') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { req.body = JSON.parse(body); } catch(e) { req.body = {}; }
      next();
    });
  } else {
    next();
  }
});

const pool = new Pool({
  user: process.env.DB_USER || 'custompatike_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'custompatike',
  password: process.env.DB_PASSWORD || 'CustomPatike2026',
  port: parseInt(process.env.DB_PORT) || 5432,
});

pool.on('error', () => {});

// ===== IP GEOLOCATION =====
const geoCache = {};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function geolocateIP(ip) {
  if (!ip || ip.includes('127.0.0.1') || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('fe80')) {
    return { city: 'Local Dev', country: 'Localhost' };
  }

  const cleanIp = ip.split(',')[0].trim().replace('::ffff:', '');
  if (geoCache[cleanIp]) return geoCache[cleanIp];

  // DB cache check
  try {
    const existing = await pool.query(
      "SELECT city, country FROM visitor_sessions WHERE ip_address LIKE $1 AND city IS NOT NULL AND city != 'Unknown City' AND city != 'Local Dev' LIMIT 1",
      [`%${cleanIp}%`]
    );
    if (existing.rows.length > 0) {
      const geo = { city: existing.rows[0].city, country: existing.rows[0].country };
      geoCache[cleanIp] = geo;
      return geo;
    }
  } catch(e) {}

  // Primary: ip-api.com
  try {
    const data = await fetchJson(`http://ip-api.com/json/${cleanIp}`);
    if (data && data.status === 'success') {
      const geo = { city: data.city || 'Unknown City', country: data.country || 'Unknown Country' };
      geoCache[cleanIp] = geo;
      return geo;
    }
  } catch(e) {}

  // Fallback: ipapi.co
  try {
    const data = await fetchJson(`https://ipapi.co/${cleanIp}/json/`);
    if (data && !data.error) {
      const geo = { city: data.city || 'Unknown City', country: data.country_name || 'Unknown Country' };
      geoCache[cleanIp] = geo;
      return geo;
    }
  } catch(e) {}

  return { city: 'Unknown City', country: 'Unknown Country' };
}

// ===== POST /api/analytics/session =====
app.post('/api/analytics/session', async (req, res) => {
  const { sessionToken, email, isVerified, userAgent } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'sessionToken required' });

  const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const geo = await geolocateIP(rawIp);

  try {
    const check = await pool.query('SELECT id FROM visitor_sessions WHERE session_token = $1', [sessionToken]);

    if (check.rows.length === 0) {
      await pool.query(
        `INSERT INTO visitor_sessions (session_token, ip_address, city, country, user_agent, email, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [sessionToken, rawIp, geo.city, geo.country, userAgent || null, email || null, isVerified || false]
      );
    } else {
      await pool.query(
        `UPDATE visitor_sessions
         SET email = COALESCE($2, email),
             is_verified = COALESCE($3, is_verified),
             ip_address = COALESCE(ip_address, $4),
             city = CASE WHEN city IS NULL OR city = 'Unknown City' OR city = 'Local Dev' THEN $5 ELSE city END,
             country = CASE WHEN country IS NULL OR country = 'Unknown Country' OR country = 'Localhost' THEN $6 ELSE country END,
             user_agent = COALESCE(user_agent, $7),
             updated_at = NOW()
         WHERE session_token = $1`,
        [sessionToken, email || null, isVerified, rawIp, geo.city, geo.country, userAgent || null]
      );
    }
    res.json({ success: true });
  } catch(err) {
    console.error('Session error:', err.message);
    res.json({ success: true });
  }
});

// ===== POST /api/analytics/activity =====
app.post('/api/analytics/activity', async (req, res) => {
  const { sessionToken, pageUrl, actionType, actionDetails, timeSpent } = req.body || {};
  if (!sessionToken || !actionType) return res.status(400).json({ error: 'Missing parameters' });

  const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const geo = await geolocateIP(rawIp);

  try {
    // Upsert session to prevent FK violation
    await pool.query(
      `INSERT INTO visitor_sessions (session_token, ip_address, city, country, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (session_token) DO UPDATE SET updated_at = NOW()`,
      [sessionToken, rawIp, geo.city, geo.country]
    );

    // Heartbeat: increment time_spent on last page_view
    if (actionType === 'heartbeat') {
      const lastAct = await pool.query(
        `SELECT id FROM visitor_activities
         WHERE session_token = $1 AND page_url = $2 AND action_type = 'page_view'
         ORDER BY created_at DESC LIMIT 1`,
        [sessionToken, pageUrl || '/']
      );
      if (lastAct.rows.length > 0) {
        await pool.query(
          'UPDATE visitor_activities SET time_spent = time_spent + $1 WHERE id = $2',
          [timeSpent || 10, lastAct.rows[0].id]
        );
        return res.json({ success: true });
      }
    }

    // Insert activity
    await pool.query(
      `INSERT INTO visitor_activities (session_token, page_url, action_type, action_details, time_spent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sessionToken, pageUrl || '/', actionType, actionDetails || null, timeSpent || 0]
    );

    res.json({ success: true });
  } catch(err) {
    console.error('Activity error:', err.message);
    res.json({ success: true });
  }
});

// ===== POST /api/cart/sync (Abandoned Cart Sync) =====
app.post('/api/cart/sync', async (req, res) => {
  const { sessionToken, email, phone, items } = req.body || {};
  const cartItems = items || [];
  
  if (!sessionToken && !email && !phone) {
    return res.status(400).json({ error: 'Session token, email, or phone required' });
  }

  const tokenKey = sessionToken || ('cp_cart_' + Date.now());

  try {
    // Update visitor_sessions with phone / email
    if (sessionToken && (phone || email)) {
      await pool.query(
        `UPDATE visitor_sessions
         SET phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             is_verified = TRUE,
             updated_at = NOW()
         WHERE session_token = $1`,
        [sessionToken, phone || null, email || null]
      );
    }

    // Upsert into abandoned_carts
    const existing = await pool.query(
      'SELECT id FROM abandoned_carts WHERE cart_token = $1 OR (phone IS NOT NULL AND phone = $2) OR (email IS NOT NULL AND email = $3)',
      [tokenKey, phone || '___', email || '___']
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE abandoned_carts
         SET cart_data = $2,
             email = COALESCE($3, email),
             phone = COALESCE($4, phone),
             status = 'captured',
             updated_at = NOW()
         WHERE id = $1`,
        [existing.rows[0].id, JSON.stringify(cartItems), email || null, phone || null]
      );
    } else {
      await pool.query(
        `INSERT INTO abandoned_carts (cart_token, email, phone, cart_data, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'captured', NOW(), NOW())`,
        [tokenKey, email || null, phone || null, JSON.stringify(cartItems)]
      );
    }

    res.json({ success: true });
  } catch(err) {
    console.error('Cart sync error:', err.message);
    res.json({ success: true });
  }
});

// ===== CUSTOMER USER AUTHENTICATION & DASHBOARD API =====

// Helper: verify JWT from Authorization header
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// 1. POST /api/user/register
app.post('/api/user/register', async (req, res) => {
  const { email, password, firstName, lastName, phone, sessionToken } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, email, first_name, last_name, phone, address, city, postal_code, country, created_at`,
      [cleanEmail, hash, firstName || null, lastName || null, phone || null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    // Link visitor_sessions if token provided
    if (sessionToken) {
      await pool.query(
        'UPDATE visitor_sessions SET email = $1, is_verified = true WHERE session_token = $2',
        [cleanEmail, sessionToken]
      ).catch(() => {});
    }

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// 2. POST /api/user/login
app.post('/api/user/login', async (req, res) => {
  const { email, password, sessionToken } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, phone, address, city, postal_code, country, created_at FROM users WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    delete user.password_hash;
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    // Link visitor_sessions if token provided
    if (sessionToken) {
      await pool.query(
        'UPDATE visitor_sessions SET email = $1, is_verified = true WHERE session_token = $2',
        [cleanEmail, sessionToken]
      ).catch(() => {});
    }

    res.json({ success: true, token, user });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 3. GET /api/user/me
app.get('/api/user/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, address, city, postal_code, country, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(444).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// 4. PUT /api/user/profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { firstName, lastName, phone, address, city, postalCode, country } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           city = COALESCE($5, city),
           postal_code = COALESCE($6, postal_code),
           country = COALESCE($7, country)
       WHERE id = $8
       RETURNING id, email, first_name, last_name, phone, address, city, postal_code, country, created_at`,
      [firstName, lastName, phone, address, city, postalCode, country, req.user.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 5. PUT /api/user/password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isValid) return res.status(400).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// 6. GET /api/user/orders
app.get('/api/user/orders', authenticateToken, async (req, res) => {
  try {
    const ordersRes = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 OR LOWER(user_id::text) = $2 ORDER BY created_at DESC`,
      [req.user.id, req.user.email]
    );
    const orders = ordersRes.rows;

    for (let order of orders) {
      const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      order.items = itemsRes.rows;
    }

    res.json({ orders });
  } catch (err) {
    res.json({ orders: [] });
  }
});

// 7. GET /api/user/commissions
app.get('/api/user/commissions', authenticateToken, async (req, res) => {
  try {
    const commsRes = await pool.query(
      `SELECT * FROM custom_commissions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ commissions: commsRes.rows });
  } catch (err) {
    res.json({ commissions: [] });
  }
});

// ===== STRIPE EMBEDDED CHECKOUT & WEBHOOK API =====

function calculateShipping(items, countryCode) {
  if (!items || items.length === 0) return 0;
  const subtotal = items.reduce((total, item) => total + (item.price * (item.qty || item.quantity || 1)), 0);
  if (subtotal >= 300) return 0;

  if (!countryCode) return 12.50;
  const country = countryCode.toUpperCase();

  if (country === 'BA') return 6.00;
  if (country === 'HR' || country === 'ME' || country === 'RS') return 10.00;

  const euCountries = ['SI', 'DE', 'FR', 'IT', 'AT', 'BE', 'ES', 'SE', 'NL', 'PL', 'PT', 'IE', 'DK', 'FI', 'GR', 'CZ', 'HU', 'RO', 'BG', 'SK', 'LT', 'LV', 'EE', 'CY', 'MT', 'LU'];
  if (euCountries.includes(country)) return 12.50;

  const nonEuEurope = ['MK', 'AL', 'GB', 'CH', 'NO', 'IS', 'UA', 'BY', 'MD', 'AD', 'MC', 'SM', 'VA', 'LI', 'GI'];
  if (nonEuEurope.includes(country)) return 18.00;

  return 32.50;
}

// 1. POST /api/checkout/create-intent
app.post('/api/checkout/create-intent', async (req, res) => {
  try {
    const { items, email, phone } = req.body || {};
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured on server' });
    }

    const subtotal = items.reduce((total, item) => total + (item.price * (item.qty || item.quantity || 1)), 0);
    const shippingFee = calculateShipping(items, null);
    const totalAmount = Math.round((subtotal + shippingFee) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'eur',
      receipt_email: email || undefined,
      metadata: {
        customerEmail: email || '',
        customerPhone: phone || '',
        items: JSON.stringify(items.map(i => ({ id: i.id, name: i.name || i.title, price: i.price, qty: i.qty || i.quantity || 1 })))
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      subtotal,
      shippingFee,
      total: subtotal + shippingFee
    });
  } catch (err) {
    console.error('Create PaymentIntent error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. POST /api/checkout/update-intent
app.post('/api/checkout/update-intent', async (req, res) => {
  try {
    const { paymentIntentId, country, items } = req.body || {};
    if (!paymentIntentId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured on server' });
    }

    const subtotal = items.reduce((total, item) => total + (item.price * (item.qty || item.quantity || 1)), 0);
    const shippingFee = calculateShipping(items, country);
    const totalAmount = Math.round((subtotal + shippingFee) * 100);

    await stripe.paymentIntents.update(paymentIntentId, {
      amount: totalAmount,
      currency: 'eur',
      metadata: {
        shippingCountry: country || '',
        shippingFee: shippingFee
      }
    });

    res.json({ success: true, subtotal, shippingFee, total: subtotal + shippingFee });
  } catch (err) {
    console.error('Update PaymentIntent error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update shipping' });
  }
});

// 3. POST /api/checkout/webhook (Stripe Payment Event Listener)
app.post('/api/checkout/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig && stripe) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { customerEmail, customerPhone, items } = paymentIntent.metadata || {};

    const shippingObj = paymentIntent.shipping || {};
    const shippingAddress = {
      name: shippingObj.name || '',
      phone: shippingObj.phone || customerPhone || '',
      address: shippingObj.address || {}
    };

    const email = paymentIntent.receipt_email || customerEmail || (shippingObj.name ? `${shippingObj.name.toLowerCase().replace(/\s+/g, '')}@guest.com` : null);
    const phone = shippingObj.phone || customerPhone || null;

    const subtotal = (paymentIntent.amount / 100);
    const orderNumber = 'CP-' + Date.now().toString().slice(-6);

    try {
      // 1. Insert order record into PostgreSQL orders table
      const orderRes = await pool.query(
        `INSERT INTO orders (order_number, customer_email, customer_phone, shipping_address, payment_intent_id, status, subtotal, shipping, total, created_at)
         VALUES ($1, $2, $3, $4, $5, 'In Hand-Painting', $6, 0.00, $7, NOW())
         RETURNING id`,
        [orderNumber, email, phone, JSON.stringify(shippingAddress), paymentIntent.id, subtotal, subtotal]
      );

      const orderId = orderRes.rows[0].id;

      // 2. Insert items into order_items table
      if (items) {
        try {
          const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
          for (const item of parsedItems) {
            await pool.query(
              `INSERT INTO order_items (order_id, product_name, size, price, quantity)
               VALUES ($1, $2, $3, $4, $5)`,
              [orderId, item.name || item.title || 'Custom Sneakers', item.size || 'Standard', item.price || 0, item.qty || item.quantity || 1]
            );
          }
        } catch(e) {}
      }

      // 3. Mark abandoned cart as 'recovered'
      if (email || phone) {
        await pool.query(
          `UPDATE abandoned_carts
           SET status = 'recovered', updated_at = NOW()
           WHERE (email IS NOT NULL AND email = $1) OR (phone IS NOT NULL AND phone = $2)`,
          [email || '___', phone || '___']
        );
      }

      console.log(`Order #${orderNumber} successfully created from Stripe PaymentIntent ${paymentIntent.id}`);
    } catch(err) {
      console.error('Error inserting order from webhook:', err.message);
    }
  }

  res.json({ received: true });
});

// Health check
app.get('/api/analytics/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Custom Patike Tracking & User Auth API running on port ${PORT}`);
});
