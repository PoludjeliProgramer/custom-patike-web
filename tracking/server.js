const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 4055;

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

// Health check
app.get('/api/analytics/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Custom Patike Tracking API running on port ${PORT}`);
});
