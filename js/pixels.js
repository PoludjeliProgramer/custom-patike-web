// ===== CUSTOM PATIKE — VISITOR TELEMETRY & PIXEL TRACKING =====
// Production tracking endpoint
const CP_TRACKING_API = '/api/analytics';

// Ad Pixel IDs (configure when ready)
const CP_PIXELS = {
  META_PIXEL_ID:     '',
  GOOGLE_ADS_ID:     '',
  GOOGLE_CONV_LABEL: '',
  TIKTOK_PIXEL_ID:   ''
};

// ===== VISITOR TOKEN (PERSISTENT DEVICE/HUMAN INDICATOR) =====
let cpVisitorToken = localStorage.getItem('cp_analytics_token') || sessionStorage.getItem('cp_analytics_token');
if (!cpVisitorToken) {
  cpVisitorToken = 'cp_anon_' + Date.now() + Math.random().toString(36).substring(2, 11);
}
// Store persistently in localStorage so 1 human/device keeps the same token across tabs & visits
localStorage.setItem('cp_analytics_token', cpVisitorToken);
sessionStorage.setItem('cp_analytics_token', cpVisitorToken);

// Excluded admin/owner emails that should NOT be tracked
const EXCLUDED_EMAILS = ['larivepolleo@gmail.com'];

function cpIsExcluded(email) {
  const checkEmail = (email || localStorage.getItem('cp_guest_email') || '').toLowerCase().trim();
  if (checkEmail && EXCLUDED_EMAILS.includes(checkEmail)) return true;
  try {
    const userObj = JSON.parse(localStorage.getItem('cp_user') || localStorage.getItem('user') || 'null');
    if (userObj && userObj.email && EXCLUDED_EMAILS.includes(userObj.email.toLowerCase().trim())) return true;
  } catch(e) {}
  return false;
}

// ===== VERIFIED VISITOR GATE =====
function cpIsVerified() {
  if (cpIsExcluded()) return false;
  return localStorage.getItem('cp_verified_visitor') === 'true';
}

function cpMarkVerified(email, phone) {
  localStorage.setItem('cp_verified_visitor', 'true');
  if (email) localStorage.setItem('cp_guest_email', email);
  if (phone) localStorage.setItem('cp_guest_phone', phone);
  cpSendSession(email, phone);
  cpLogActivity('page_view', document.title);
  cpStartHeartbeat();
}

// ===== SESSION REPORTER =====
async function cpSendSession(email, phone) {
  try {
    await fetch(`${CP_TRACKING_API}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: cpVisitorToken,
        email: email || localStorage.getItem('cp_guest_email') || null,
        phone: phone || localStorage.getItem('cp_guest_phone') || null,
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

// ===== EVENT TRACKING HELPERS =====
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

// ===== THE WELCOME POPUP (EXACT COPY FROM VANDAL MADE) =====
function initWelcomePopup() {
  // Check if customer is logged in
  const storedUser = localStorage.getItem('cp_user') || localStorage.getItem('user');
  let loggedInEmail = null;
  if (storedUser) {
    try {
      const userObj = JSON.parse(storedUser);
      if (userObj && userObj.email) {
        loggedInEmail = userObj.email;
      }
    } catch (e) {}
  }

  if (loggedInEmail) {
    // Automatically verify and skip welcome popup
    localStorage.setItem('cp_verified_visitor', 'true');
    localStorage.setItem('cp_guest_email', loggedInEmail);
    cpSendSession(loggedInEmail);
    cpLogActivity('page_view', 'Logged in registered customer session started');
    cpStartHeartbeat();
    return;
  }

  const isVerified = localStorage.getItem('cp_verified_visitor');
  if (isVerified === 'true') {
    // Register returning verified session in DB
    const guestEmail = localStorage.getItem('cp_guest_email');
    cpSendSession(guestEmail);
    cpLogActivity('page_view');
    cpStartHeartbeat();
    return;
  }

  // Insert popup HTML into the body dynamically
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    .atelier-popup-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.92); backdrop-filter: blur(20px);
      display: flex; justify-content: center; align-items: center; z-index: 1000000;
      opacity: 0; transition: opacity 0.8s ease;
    }
    .atelier-popup-overlay.show { opacity: 1; }
    .atelier-popup-card {
      background: #111;
      border: 1px solid rgba(255,255,255,0.08);
      padding: 60px 40px; width: 90%; max-width: 500px;
      text-align: center; border-radius: 4px; box-shadow: 0 40px 100px rgba(0,0,0,0.9);
      transform: translateY(20px); transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; gap: 25px;
    }
    .atelier-popup-overlay.show .atelier-popup-card { transform: translateY(0); }
    .popup-brand { font-family: var(--font-serif, serif); font-size: 16px; letter-spacing: 4px; text-transform: uppercase; color: #888; }
    .popup-title { font-family: var(--font-serif, serif); font-size: 32px; font-weight: 300; letter-spacing: -0.5px; line-height: 1.2; color: #fff; }
    .popup-desc { font-family: var(--font-sans, sans-serif); font-size: 13px; line-height: 1.6; color: #888; font-weight: 300; max-width: 380px; }
    .popup-input {
      width: 100%; padding: 18px; background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: var(--font-sans, sans-serif);
      font-size: 13px; text-align: center; outline: none; transition: border-color 0.3s;
    }
    .popup-input:focus { border-color: rgba(255,255,255,0.4); }
    .popup-btn-claim {
      width: 100%; padding: 18px; background: #fff; color: #000; border: none;
      font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;
      cursor: pointer; transition: all 0.3s ease;
    }
    .popup-btn-claim:hover { background: #d4af37; color: #000; }
    .popup-btn-browse {
      background: none; border: none; color: #888; font-size: 11px;
      text-transform: uppercase; letter-spacing: 2px; cursor: pointer; transition: color 0.3s;
      border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;
    }
    .popup-btn-browse:hover { color: #fff; border-bottom-color: #fff; }
  `;
  document.head.appendChild(styleEl);

  const overlay = document.createElement('div');
  overlay.className = 'atelier-popup-overlay';
  overlay.innerHTML = `
    <div class="atelier-popup-card">
      <div class="popup-brand">Custom Patike</div>
      <div class="popup-title">Welcome to<br>The Atelier</div>
      <div class="popup-desc">Unlock an exclusive €100 welcome credit toward your first bespoke creation. Share your email to receive the private access key.</div>
      <input type="email" id="popupEmail" class="popup-input" placeholder="Enter Your Email Address">
      <button id="btnPopupClaim" class="popup-btn-claim">Claim €100 Welcome Credit</button>
      <button id="btnPopupBrowse" class="popup-btn-browse">No thanks, browse the collections</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Show with a smooth transition
  setTimeout(() => overlay.classList.add('show'), 1500);

  const emailInput = document.getElementById('popupEmail');
  
  // Action 1: Email submit (Claim credit)
  document.getElementById('btnPopupClaim').addEventListener('click', async () => {
    const emailVal = emailInput.value.trim();
    if (!emailVal || !emailVal.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    // 1. Set verified human state
    localStorage.setItem('cp_verified_visitor', 'true');
    localStorage.setItem('cp_guest_email', emailVal);

    // 2. Fetch/register verified session
    cpSendSession(emailVal);

    // 5. Dismiss with beauty
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      cpLogActivity('page_view', 'Welcomed with €100 newsletter subscription');
      cpStartHeartbeat();
    }, 800);
  });

  // Action 2: No thanks, browse
  document.getElementById('btnPopupBrowse').addEventListener('click', async () => {
    // 1. Set verified human state
    localStorage.setItem('cp_verified_visitor', 'true');

    // 2. Fetch/register verified session
    cpSendSession();

    // 3. Dismiss
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      cpLogActivity('page_view', 'Welcomed and bypassed popups');
      cpStartHeartbeat();
    }, 800);
  });
}

// DEV RESET HOOK
if (window.location.search.includes('reset_popup=1')) {
  localStorage.removeItem('cp_verified_visitor');
  localStorage.removeItem('cp_guest_email');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  cpCaptureUtms();
  initWelcomePopup();
});
