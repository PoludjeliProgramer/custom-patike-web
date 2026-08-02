// ===== CUSTOM PATIKE TELEMETRY & PIXEL TRACKING SYSTEM =====

const CP_PIXELS = {
  META_PIXEL_ID:      'YOUR_META_PIXEL_ID',
  GOOGLE_ADS_ID:      'AW-XXXXXXXXXX',
  GOOGLE_CONV_LABEL:  'XXXXXXXXXXXXXXXXXXX',
  TIKTOK_PIXEL_ID:    'YOUR_TIKTOK_PIXEL_ID'
};

const API_TRACKING_ENDPOINT = 'http://localhost:4050/api/analytics';

// ===== SESSION TOKEN GENERATOR & STORE =====
function getOrCreateSessionToken() {
  let token = sessionStorage.getItem('cp_session_token');
  if (!token) {
    token = 'sess_cp_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    sessionStorage.setItem('cp_session_token', token);
  }
  return token;
}

// ===== TELEMETRY REPORTERS =====
async function sendSessionTelemetry(email = null, isVerified = true) {
  const sessionToken = getOrCreateSessionToken();
  try {
    await fetch(`${API_TRACKING_ENDPOINT}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        email,
        isVerified,
        userAgent: navigator.userAgent
      })
    });
  } catch (e) {
    // Silent fail if analytics backend unavailable
  }
}

async function sendActivityTelemetry(actionType, actionDetails = '', timeSpent = 0) {
  const sessionToken = getOrCreateSessionToken();
  try {
    await fetch(`${API_TRACKING_ENDPOINT}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        pageUrl: window.location.href,
        actionType,
        actionDetails,
        timeSpent
      })
    });
  } catch (e) {
    // Silent fail
  }
}

// ===== BASE INITIALIZATION =====
function initPixels() {
  if (window._pixelsInitialized) return;
  window._pixelsInitialized = true;

  // 1. Save UTM parameters for attribution
  const params = new URLSearchParams(window.location.search);
  const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  utmParams.forEach(param => {
    if (params.has(param)) {
      sessionStorage.setItem(`cp_${param}`, params.get(param));
    }
  });

  // 2. Telemetry Session Init
  sendSessionTelemetry();
  sendActivityTelemetry('page_view', `Viewed ${document.title}`);

  // 3. Heartbeat for Time Spent (every 10 seconds)
  setInterval(() => {
    sendActivityTelemetry('heartbeat', 'Active user heartbeat', 10);
  }, 10000);
}

// ===== EVENT TRACKING HELPERS =====
function trackViewContent(name, category, price) {
  sendActivityTelemetry('view_content', `Viewed Product: ${name} (€${price})`);
}

function trackAddToCart(name, category, price, quantity = 1) {
  sendActivityTelemetry('add_to_cart', `Added ${name} (x${quantity}) - €${price * quantity}`);
}

function trackInitiateCheckout(totalValue, numItems) {
  sendActivityTelemetry('initiate_checkout', `Started Checkout for ${numItems} items (€${totalValue})`);
}

function trackPurchase(orderId, totalValue) {
  sendActivityTelemetry('purchase', `Completed Order #${orderId} (€${totalValue})`);
}

document.addEventListener('DOMContentLoaded', () => {
  initPixels();
});
