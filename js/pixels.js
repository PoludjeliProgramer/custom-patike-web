// ===== CUSTOM PATIKE — VISITOR TELEMETRY & PIXEL TRACKING =====
// Production tracking endpoint (relative URL resolves to custompatike.com/api/analytics)
const CP_TRACKING_API = '/api/analytics';

// Ad Pixel IDs (configure when ready)
const CP_PIXELS = {
  META_PIXEL_ID:     '',
  GOOGLE_ADS_ID:     '',
  GOOGLE_CONV_LABEL: '',
  TIKTOK_PIXEL_ID:   ''
};

// ===== SESSION TOKEN =====
let cpVisitorToken = sessionStorage.getItem('cp_analytics_token');
if (!cpVisitorToken) {
  cpVisitorToken = 'cp_anon_' + Date.now() + Math.random().toString(36).substring(2, 11);
  sessionStorage.setItem('cp_analytics_token', cpVisitorToken);
}

// ===== VERIFIED VISITOR GATE =====
// Only track humans who have interacted with the site (not bots/crawlers)
function cpIsVerified() {
  return localStorage.getItem('cp_verified_visitor') === 'true';
}

function cpMarkVerified(email) {
  localStorage.setItem('cp_verified_visitor', 'true');
  if (email) localStorage.setItem('cp_guest_email', email);
  // Register/update session on server
  cpSendSession(email);
  // Start tracking
  cpLogActivity('page_view', document.title);
  cpStartHeartbeat();
}

// ===== SESSION REPORTER =====
async function cpSendSession(email) {
  try {
    await fetch(`${CP_TRACKING_API}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: cpVisitorToken,
        email: email || localStorage.getItem('cp_guest_email') || null,
        isVerified: true,
        userAgent: navigator.userAgent
      })
    });
  } catch(e) {}
}

// ===== ACTIVITY LOGGER =====
async function cpLogActivity(actionType, actionDetails, timeSpent) {
  if (!cpIsVerified()) return;
  try {
    await fetch(`${CP_TRACKING_API}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: cpVisitorToken,
        pageUrl: window.location.pathname + window.location.search,
        actionType: actionType,
        actionDetails: actionDetails || null,
        timeSpent: timeSpent || 0
      })
    });
  } catch(e) {}
}

// ===== HEARTBEAT (10s interval) =====
let cpHeartbeatInterval = null;
function cpStartHeartbeat() {
  if (cpHeartbeatInterval) clearInterval(cpHeartbeatInterval);
  cpHeartbeatInterval = setInterval(() => {
    if (!cpIsVerified()) return;
    fetch(`${CP_TRACKING_API}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: cpVisitorToken,
        pageUrl: window.location.pathname + window.location.search,
        actionType: 'heartbeat',
        timeSpent: 10
      })
    }).catch(() => {});
  }, 10000);
}

// ===== EXIT BEACON =====
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && cpIsVerified()) {
    const payload = JSON.stringify({
      sessionToken: cpVisitorToken,
      pageUrl: window.location.pathname + window.location.search,
      actionType: 'user_left'
    });
    navigator.sendBeacon(`${CP_TRACKING_API}/activity`, payload);
  }
});

// ===== EVENT TRACKING HELPERS (called from cart.js, product pages, etc.) =====
function trackViewContent(name, category, price) {
  cpLogActivity('view_content', `Viewed: ${name} (${category}) — €${price}`);
}

function trackAddToCart(name, size, price, quantity) {
  cpLogActivity('add_to_cart', `Added ${name} (Size: ${size}) x${quantity || 1} — €${(price * (quantity || 1)).toFixed(2)}`);
}

function trackInitiateCheckout(totalValue, numItems) {
  cpLogActivity('initiate_checkout', `Checkout started: ${numItems} items — €${totalValue}`);
}

function trackPurchase(orderId, totalValue) {
  cpLogActivity('purchase', `Order #${orderId} completed — €${totalValue}`);
}

// ===== UTM PARAMETER CAPTURE =====
function cpCaptureUtms() {
  const params = new URLSearchParams(window.location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
    if (params.has(param)) {
      sessionStorage.setItem(`cp_${param}`, params.get(param));
    }
  });
}

// ===== AUTO-VERIFICATION HOOKS =====
// These run on DOMContentLoaded to detect user interactions that verify them as human
function cpInitAutoVerification() {
  // Already verified from previous page? Resume tracking
  if (cpIsVerified()) {
    cpSendSession();
    cpLogActivity('page_view', document.title);
    cpStartHeartbeat();
    return;
  }

  // Check if user is logged in (has account data)
  const storedUser = localStorage.getItem('cp_user') || localStorage.getItem('user');
  if (storedUser) {
    try {
      const userObj = JSON.parse(storedUser);
      if (userObj && userObj.email) {
        cpMarkVerified(userObj.email);
        return;
      }
    } catch(e) {}
  }

  // Listen for first meaningful interaction to verify
  const verifyOnInteraction = () => {
    if (cpIsVerified()) return;
    cpMarkVerified();
    // Remove listeners after first verification
    document.removeEventListener('click', verifyOnInteraction);
    document.removeEventListener('scroll', verifyOnScroll);
  };

  const verifyOnScroll = () => {
    if (cpIsVerified()) return;
    // Only verify after meaningful scroll (200px+)
    if (window.scrollY > 200) {
      cpMarkVerified();
      document.removeEventListener('click', verifyOnInteraction);
      document.removeEventListener('scroll', verifyOnScroll);
    }
  };

  document.addEventListener('click', verifyOnInteraction);
  document.addEventListener('scroll', verifyOnScroll);

  // Capture checkout email fields
  setTimeout(() => {
    const emailInput = document.getElementById('email') || document.getElementById('checkout-email');
    if (emailInput) {
      const syncEmail = () => {
        const val = emailInput.value.trim();
        if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          localStorage.setItem('cp_guest_email', val);
          cpMarkVerified(val);
        }
      };
      emailInput.addEventListener('blur', syncEmail);
      emailInput.addEventListener('change', syncEmail);
    }
  }, 500);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  cpCaptureUtms();
  cpInitAutoVerification();
});
