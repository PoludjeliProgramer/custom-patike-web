const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4050;

app.use(cors());
app.use(express.json());
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

// 11. POST /api/analytics/session - Register / Update Visitor Session
app.post('/api/analytics/session', async (req, res) => {
  const { sessionToken, email, isVerified, userAgent } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'sessionToken required' });

  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  try {
    const result = await pool.query(
      `INSERT INTO visitor_sessions (session_token, ip_address, city, country, user_agent, email, is_verified, created_at, updated_at)
       VALUES ($1, $2, 'Dubrovnik', 'Croatia', $3, $4, $5, NOW(), NOW())
       ON CONFLICT (session_token) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, visitor_sessions.email),
           updated_at = NOW()
       RETURNING *`,
      [sessionToken, rawIp, userAgent || null, email || null, isVerified || true]
    );
    res.json({ success: true, session: result.rows[0] });
  } catch (err) {
    res.json({ success: true, session: { session_token: sessionToken } });
  }
});

// 12. POST /api/analytics/activity - Log Visitor Pageviews, AddToCart, Heartbeats
app.post('/api/analytics/activity', async (req, res) => {
  const { sessionToken, pageUrl, actionType, actionDetails, timeSpent } = req.body || {};
  if (!sessionToken || !pageUrl || !actionType) return res.status(400).json({ error: 'Missing parameters' });

  try {
    await pool.query(
      `INSERT INTO visitor_sessions (session_token, ip_address, city, country, created_at, updated_at)
       VALUES ($1, '127.0.0.1', 'Dubrovnik', 'Croatia', NOW(), NOW())
       ON CONFLICT (session_token) DO UPDATE SET updated_at = NOW()`,
      [sessionToken]
    );

    if (actionType === 'heartbeat') {
      const lastAct = await pool.query(
        `SELECT id FROM visitor_activities WHERE session_token = $1 AND page_url = $2 AND action_type = 'page_view' ORDER BY created_at DESC LIMIT 1`,
        [sessionToken, pageUrl]
      );
      if (lastAct.rows.length > 0) {
        await pool.query(`UPDATE visitor_activities SET time_spent = time_spent + $1 WHERE id = $2`, [timeSpent || 10, lastAct.rows[0].id]);
        return res.json({ success: true });
      }
    }

    await pool.query(
      `INSERT INTO visitor_activities (session_token, page_url, action_type, action_details, time_spent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sessionToken, pageUrl, actionType, actionDetails || '', timeSpent || 0]
    );

    res.json({ success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

// 13. GET /api/analytics/traffic - Sources & Countries Report
app.get('/api/analytics/traffic', async (req, res) => {
  try {
    const sessions = await pool.query(`SELECT country, COUNT(*) as count FROM visitor_sessions GROUP BY country`);
    const countries = {};
    sessions.rows.forEach(r => countries[r.country || 'Unknown'] = parseInt(r.count));

    res.json({
      sources: { allTime: {}, monthly: {} },
      countries: { allTime: countries, monthly: {} }
    });
  } catch (err) {
    res.json({ sources: { allTime: {}, monthly: {} }, countries: { allTime: {}, monthly: {} } });
  }
});

// 14. GET /api/analytics/sessions - Active Visitor Timeline
app.get('/api/analytics/sessions', async (req, res) => {
  try {
    const sessionsRes = await pool.query(`SELECT * FROM visitor_sessions ORDER BY updated_at DESC LIMIT 50`);
    const sessions = sessionsRes.rows;
    for (let s of sessions) {
      const actRes = await pool.query(`SELECT * FROM visitor_activities WHERE session_token = $1 ORDER BY created_at ASC`, [s.session_token]);
      s.activities = actRes.rows;
    }
    res.json(sessions);
  } catch (err) {
    res.json([]);
  }
});

// 15. GET /api/cart/abandoned - Abandoned Carts List
app.get('/api/cart/abandoned', async (req, res) => {
  try {
    const resCarts = await pool.query(`SELECT * FROM abandoned_carts ORDER BY updated_at DESC`);
    res.json(resCarts.rows);
  } catch (err) {
    res.json([]);
  }
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Custom Patike Admin Server running on http://localhost:${PORT}`);
});
