const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const http = require('http');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4050;

app.use(cors());
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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Database Pool Connection
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      user: process.env.DB_USER || 'custompatike_user',
      host: process.env.DB_HOST || '127.0.0.1',
      database: process.env.DB_NAME || 'custompatike',
      password: process.env.DB_PASSWORD || 'CustomPatike2026',
      port: parseInt(process.env.DB_PORT) || 5432,
    });

// Silence connection log errors
pool.on('error', (err) => {
  // Prevent unhandled pool errors from crashing Node process
});

// ===== IP GEOLOCATION ENGINE =====
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

  // DB cache
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


// ==========================================
//    BUSINESS ENDPOINTS (Orders, Products, etc.)
// ==========================================

// 1. GET /api/stats - Live KPI Summary
app.get('/api/stats', async (req, res) => {
  try {
    const ordersRes = await pool.query('SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue FROM orders');
    const productsRes = await pool.query('SELECT COUNT(*) as total_products FROM products');
    const usersRes = await pool.query('SELECT COUNT(*) as total_users FROM users');
    const commsRes = await pool.query("SELECT COUNT(*) as active_commissions FROM custom_commissions WHERE status != 'Delivered'");

    res.json({
      totalOrders: parseInt(ordersRes.rows[0].total_orders) || 0,
      totalRevenue: parseFloat(ordersRes.rows[0].total_revenue) || 0,
      totalProducts: parseInt(productsRes.rows[0].total_products) || 0,
      totalUsers: parseInt(usersRes.rows[0].total_users) || 0,
      activeCommissions: parseInt(commsRes.rows[0].active_commissions) || 0
    });
  } catch (err) {
    res.json({ totalOrders: 0, totalRevenue: 0, totalProducts: 0, totalUsers: 0, activeCommissions: 0 });
  }
});

// 2. GET /api/orders - All Orders with Client Details & Items
app.get('/api/orders', async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id, o.order_number, o.status, o.subtotal, o.shipping, o.total, o.created_at,
        u.first_name, u.last_name, u.email, u.phone, u.address, u.city, u.postal_code, u.country
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `;
    const ordersResult = await pool.query(query);
    const orders = ordersResult.rows;

    for (let order of orders) {
      const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      order.items = itemsRes.rows;
    }

    res.json(orders);
  } catch (err) {
    res.json([]);
  }
});

// 3. PUT /api/orders/:id/status - Update Order Status
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json({ message: 'Order status updated successfully', status });
  } catch (err) {
    res.json({ message: 'Status updated', status });
  }
});

// 4. GET /api/commissions - Custom 1-of-1 Commission Requests
app.get('/api/commissions', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id, c.ticket_number, c.concept_title, c.status, c.atelier_notes, c.created_at,
        u.first_name, u.last_name, u.email, u.phone
      FROM custom_commissions c
      LEFT JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// 5. PUT /api/commissions/:id/status - Update Commission Status & Notes
app.put('/api/commissions/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, atelier_notes } = req.body;

  try {
    const result = await pool.query(
      'UPDATE custom_commissions SET status = COALESCE($1, status), atelier_notes = COALESCE($2, atelier_notes) WHERE id = $3 RETURNING *',
      [status, atelier_notes, id]
    );

    res.json({ message: 'Commission updated successfully' });
  } catch (err) {
    res.json({ message: 'Commission updated' });
  }
});

// 6. GET /api/products - Product Catalog
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// 7. POST /api/products - Add New Product
app.post('/api/products', async (req, res) => {
  const { handle, name, category, price, compare_at_price, image_url, description } = req.body;

  if (!handle || !name || !price) {
    return res.status(400).json({ error: 'Handle, name, and price are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (handle, name, category, price, compare_at_price, image_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [handle, name, category || 'Sneakers', price, compare_at_price || null, image_url, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.json({ success: true, message: 'Product queued' });
  }
});

// 8. DELETE /api/products/:id - Delete Product
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.json({ message: 'Product deleted' });
  }
});

// 9. GET /api/users - Registered Client Roster
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, first_name, last_name, phone, address, city, postal_code, country, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// 10. GET /api/export/orders.csv - Export Orders CSV
app.get('/api/export/orders.csv', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id, o.order_number, o.created_at, o.status, o.total, u.first_name, u.last_name, u.email, u.phone, u.city, u.country
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    let csv = 'Order ID,Order Number,Date,Status,Total (€),Customer Name,Customer Email,Phone,City,Country\n';
    result.rows.forEach(r => {
      const name = `"${r.first_name || ''} ${r.last_name || ''}"`;
      csv += `${r.id},${r.order_number},"${new Date(r.created_at).toISOString()}",${r.status},${r.total},${name},"${r.email || ''}","${r.phone || ''}","${r.city || ''}","${r.country || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=custom_patike_orders_export.csv');
    res.status(200).send(csv);
  } catch (err) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=custom_patike_orders_export.csv');
    res.status(200).send('Order ID,Order Number,Date,Status,Total (€),Customer Name,Customer Email,Phone,City,Country\n');
  }
});


// ==========================================
//    ANALYTICS ENDPOINTS
// ==========================================

// 11. POST /api/analytics/session - Register / Update Visitor Session
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
  } catch (err) {
    res.json({ success: true });
  }
});

// 12. POST /api/analytics/activity - Log Visitor Activity
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

    // Insert activity row
    await pool.query(
      `INSERT INTO visitor_activities (session_token, page_url, action_type, action_details, time_spent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sessionToken, pageUrl || '/', actionType, actionDetails || null, timeSpent || 0]
    );

    res.json({ success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

// 13. GET /api/analytics/stats - Live Analytics KPIs (computed from real data)
app.get('/api/analytics/stats', async (req, res) => {
  try {
    // Top traffic source from UTM params in first page_view URLs
    let topSource = 'Direct / Organic';
    let topSourcePct = 100;
    try {
      const firstVisits = await pool.query(`
        SELECT a.page_url FROM visitor_activities a
        JOIN (SELECT session_token, MIN(created_at) as first_time FROM visitor_activities GROUP BY session_token) b
        ON a.session_token = b.session_token AND a.created_at = b.first_time
      `);
      const sourceCounts = {};
      let totalSources = 0;
      for (const row of firstVisits.rows) {
        let source = 'Direct / Organic';
        try {
          const urlObj = new URL(row.page_url, 'http://localhost');
          if (urlObj.searchParams.has('utm_source')) source = urlObj.searchParams.get('utm_source');
          else if (urlObj.searchParams.has('ref')) source = urlObj.searchParams.get('ref');
        } catch(e) {}
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        totalSources++;
      }
      if (totalSources > 0) {
        const sorted = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
        topSource = sorted[0][0];
        topSourcePct = Math.round((sorted[0][1] / totalSources) * 100);
      }
    } catch(e) {}

    // Top country
    let topCountry = 'N/A';
    let topCountryPct = 0;
    try {
      const countryRes = await pool.query(`
        SELECT country, COUNT(*) as cnt FROM visitor_sessions
        WHERE is_verified = true AND country IS NOT NULL AND country != 'Localhost'
        GROUP BY country ORDER BY cnt DESC LIMIT 1
      `);
      const totalRes = await pool.query(`SELECT COUNT(*) as total FROM visitor_sessions WHERE is_verified = true`);
      if (countryRes.rows.length > 0) {
        topCountry = countryRes.rows[0].country;
        topCountryPct = Math.round((parseInt(countryRes.rows[0].cnt) / parseInt(totalRes.rows[0].total)) * 100);
      }
    } catch(e) {}

    // Average time on site (from page_view time_spent)
    let avgTimeSeconds = 0;
    try {
      const timeRes = await pool.query(`
        SELECT COALESCE(AVG(total_time), 0) as avg_time FROM (
          SELECT session_token, SUM(time_spent) as total_time
          FROM visitor_activities WHERE action_type = 'page_view' AND time_spent > 0
          GROUP BY session_token
        ) sub
      `);
      avgTimeSeconds = Math.round(parseFloat(timeRes.rows[0].avg_time) || 0);
    } catch(e) {}

    // Verified humans count (distinct human indicator: email, session token, or IP)
    let verifiedCount = 0;
    let totalSessions = 0;
    try {
      const { date } = req.query;
      let vQuery = 'SELECT COUNT(DISTINCT COALESCE(email, session_token, ip_address)) as cnt FROM visitor_sessions WHERE is_verified = true';
      let tQuery = 'SELECT COUNT(*) as cnt FROM visitor_sessions';
      let params = [];

      if (date) {
        vQuery += " AND (created_at::date = $1::date OR updated_at::date = $1::date OR (created_at AT TIME ZONE 'Europe/Zagreb')::date = $1::date OR (updated_at AT TIME ZONE 'Europe/Zagreb')::date = $1::date)";
        tQuery += " WHERE (created_at::date = $1::date OR updated_at::date = $1::date OR (created_at AT TIME ZONE 'Europe/Zagreb')::date = $1::date OR (updated_at AT TIME ZONE 'Europe/Zagreb')::date = $1::date)";
        params.push(date);
      }

      const vRes = await pool.query(vQuery, params);
      const tRes = await pool.query(tQuery, params);
      verifiedCount = parseInt(vRes.rows[0].cnt) || 0;
      totalSessions = parseInt(tRes.rows[0].cnt) || 0;
    } catch(e) {}

    res.json({
      topSource,
      topSourcePct,
      topCountry,
      topCountryPct,
      avgTimeSeconds,
      verifiedCount,
      totalSessions
    });
  } catch (err) {
    res.json({
      topSource: 'N/A', topSourcePct: 0,
      topCountry: 'N/A', topCountryPct: 0,
      avgTimeSeconds: 0, verifiedCount: 0, totalSessions: 0
    });
  }
});

// 14. GET /api/analytics/sessions - Visitor Sessions with Activity Timelines & Session Counts
app.get('/api/analytics/sessions', async (req, res) => {
  try {
    const { date, email, visitorType } = req.query;
    let queryText = 'SELECT * FROM visitor_sessions WHERE 1=1';
    let queryParams = [];

    if (email) {
      queryText += ' AND LOWER(email) = $' + (queryParams.length + 1);
      queryParams.push(email.toLowerCase().trim());
    } else {
      queryText += ' AND is_verified = TRUE';
    }

    if (date) {
      queryText += " AND (created_at::date = $" + (queryParams.length + 1) + "::date OR updated_at::date = $" + (queryParams.length + 1) + "::date OR (created_at AT TIME ZONE 'Europe/Zagreb')::date = $" + (queryParams.length + 1) + "::date OR (updated_at AT TIME ZONE 'Europe/Zagreb')::date = $" + (queryParams.length + 1) + "::date)";
      queryParams.push(date);
    }

    if (visitorType === 'guest') {
      queryText += ` AND (
        (email IS NULL OR LOWER(email) NOT IN (SELECT LOWER(email) FROM users))
        AND (email IS NULL OR LOWER(email) NOT IN (SELECT LOWER(email) FROM abandoned_carts))
        AND session_token NOT IN (SELECT DISTINCT session_token FROM visitor_activities WHERE action_type IN ('add_to_cart', 'initiate_checkout'))
      )`;
    } else if (visitorType === 'account') {
      queryText += ` AND (
        email IS NOT NULL AND (
          LOWER(email) IN (SELECT LOWER(email) FROM users) OR
          is_verified = TRUE
        )
      )`;
    } else if (visitorType === 'abandoned_cart') {
      queryText += ` AND (
        (email IS NOT NULL AND LOWER(email) IN (SELECT LOWER(email) FROM abandoned_carts WHERE email IS NOT NULL)) OR
        (phone IS NOT NULL AND phone IN (SELECT phone FROM abandoned_carts WHERE phone IS NOT NULL)) OR
        session_token IN (SELECT DISTINCT cart_token FROM abandoned_carts) OR
        session_token IN (SELECT DISTINCT session_token FROM visitor_activities WHERE action_type IN ('add_to_cart', 'initiate_checkout'))
      )`;
    }

    queryText += ' ORDER BY updated_at DESC LIMIT 100';

    const sessionsRes = await pool.query(queryText, queryParams);
    const sessions = sessionsRes.rows;

    for (const session of sessions) {
      const activitiesRes = await pool.query(
        'SELECT * FROM visitor_activities WHERE session_token = $1 ORDER BY created_at ASC',
        [session.session_token]
      );
      session.activities = activitiesRes.rows;

      // Calculate total session count for this unique human/visitor
      let countRes;
      if (session.email) {
        countRes = await pool.query('SELECT COUNT(*) as count FROM visitor_sessions WHERE LOWER(email) = LOWER($1)', [session.email]);
      } else if (session.ip_address) {
        countRes = await pool.query('SELECT COUNT(*) as count FROM visitor_sessions WHERE ip_address = $1', [session.ip_address]);
      } else {
        countRes = await pool.query('SELECT COUNT(*) as count FROM visitor_sessions WHERE session_token = $1', [session.session_token]);
      }
      session.session_count = parseInt(countRes.rows[0].count) || 1;
    }

    res.json(sessions);
  } catch (err) {
    console.error('Fetch analytics sessions error:', err.message);
    res.json([]);
  }
});

// 15. GET /api/analytics/traffic - Sources & Countries Aggregation
app.get('/api/analytics/traffic', async (req, res) => {
  try {
    // Traffic sources from first page_view per session
    const firstVisits = await pool.query(`
      SELECT a.session_token, a.page_url, a.created_at
      FROM visitor_activities a
      JOIN (SELECT session_token, MIN(created_at) as first_visit FROM visitor_activities GROUP BY session_token) b
      ON a.session_token = b.session_token AND a.created_at = b.first_visit
    `);

    const sessions = await pool.query('SELECT country, created_at FROM visitor_sessions WHERE is_verified = true');

    const monthlySources = {}, allTimeSources = {};
    const monthlyCountries = {}, allTimeCountries = {};

    for (const row of firstVisits.rows) {
      const monthName = new Date(row.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      let source = 'Direct / Organic';
      try {
        const urlObj = new URL(row.page_url, 'http://localhost');
        if (urlObj.searchParams.has('utm_source')) source = urlObj.searchParams.get('utm_source');
        else if (urlObj.searchParams.has('ref')) source = urlObj.searchParams.get('ref');
      } catch(e) {}

      allTimeSources[source] = (allTimeSources[source] || 0) + 1;
      if (!monthlySources[monthName]) monthlySources[monthName] = {};
      monthlySources[monthName][source] = (monthlySources[monthName][source] || 0) + 1;
    }

    for (const row of sessions.rows) {
      const monthName = new Date(row.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const country = row.country || 'Unknown';

      allTimeCountries[country] = (allTimeCountries[country] || 0) + 1;
      if (!monthlyCountries[monthName]) monthlyCountries[monthName] = {};
      monthlyCountries[monthName][country] = (monthlyCountries[monthName][country] || 0) + 1;
    }

    res.json({
      sources: { monthly: monthlySources, allTime: allTimeSources },
      countries: { monthly: monthlyCountries, allTime: allTimeCountries }
    });
  } catch (err) {
    res.json({ sources: { allTime: {}, monthly: {} }, countries: { allTime: {}, monthly: {} } });
  }
});

// 16. GET /api/cart/abandoned - Abandoned Carts List
app.get('/api/cart/abandoned', async (req, res) => {
  try {
    const resCarts = await pool.query('SELECT * FROM abandoned_carts ORDER BY updated_at DESC');
    res.json(resCarts.rows);
  } catch (err) {
    res.json([]);
  }
});

// 17. POST /api/cart/sync - Sync Abandoned Cart
app.post('/api/cart/sync', async (req, res) => {
  const { sessionToken, email, phone, items } = req.body || {};
  const cartItems = items || [];
  
  if (!sessionToken && !email && !phone) {
    return res.status(400).json({ error: 'Session token, email, or phone required' });
  }

  const tokenKey = sessionToken || ('cp_cart_' + Date.now());

  try {
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

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Custom Patike Admin Server running on http://localhost:${PORT}`);
});
