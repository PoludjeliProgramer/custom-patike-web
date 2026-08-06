// Cart System using LocalStorage

let cart = JSON.parse(localStorage.getItem('custom_patike_cart')) || [];

function getCart() {
    return JSON.parse(localStorage.getItem('custom_patike_cart')) || cart || [];
}

function saveCart() {
    localStorage.setItem('custom_patike_cart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity += item.quantity;
    } else {
        cart.push(item);
    }
    saveCart();
    openCartDrawer();

    // Auto-sync abandoned cart when item is added to bag
    syncCartToAbandoned();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
}

function updateQuantity(id, change) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(id);
        } else {
            saveCart();
        }
    }
}

function updateCartUI() {
    // Update all quantity badges
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.cart-quantity-2').forEach(badge => {
        badge.textContent = totalQty;
    });

    // Update drawer content
    const drawerItems = document.getElementById('cart-drawer-items');
    if (!drawerItems) return;

    if (cart.length === 0) {
        drawerItems.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Your cart is empty.</div>';
        document.getElementById('cart-total-price').textContent = '€0.00';
        return;
    }

    let html = '';
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
        html += `
            <div style="display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h4 style="margin: 0; font-size: 14px; font-weight: 500;">${item.name}</h4>
                        <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; cursor: pointer; color: #999; padding: 5px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                    <div style="color: #666; font-size: 14px;">€${item.price}</div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                        <button onclick="updateQuantity('${item.id}', -1)" style="border: 1px solid #ddd; background: #fff; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                        <span style="font-size: 13px;">${item.quantity}</span>
                        <button onclick="updateQuantity('${item.id}', 1)" style="border: 1px solid #ddd; background: #fff; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                    </div>
                </div>
            </div>
        `;
    });
    drawerItems.innerHTML = html;
    document.getElementById('cart-total-price').textContent = `€${total.toFixed(2)}`;
}

function injectCartDrawer() {
    if (document.getElementById('cart-drawer')) return;

    // Adjust link for checkout depending on if we are in product/ folder or root
    const isProductPage = window.location.pathname.includes('/product/');
    const prefix = isProductPage ? '../' : '';

    const drawerHTML = `
        <div id="cart-drawer-overlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9998; opacity: 0; transition: opacity 0.3s ease;"></div>
        <div id="cart-drawer" style="position: fixed; top: 0; right: -400px; width: 100%; max-width: 400px; height: 100vh; background: #fff; z-index: 9999; box-shadow: -2px 0 15px rgba(0,0,0,0.1); transition: right 0.3s ease; display: flex; flex-direction: column;">
            <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 500;">Your Cart</h2>
                <button onclick="closeCartDrawer()" style="background: none; border: none; cursor: pointer; padding: 5px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div id="cart-drawer-items" style="flex: 1; overflow-y: auto; padding: 20px;">
                <!-- Items injected here -->
            </div>
            <div style="padding: 20px; border-top: 1px solid #eee; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: 600; font-size: 16px;">
                    <span>Total</span>
                    <span id="cart-total-price">€0.00</span>
                </div>
                <button id="cart-checkout-btn" onclick="handleCheckoutProceed('${prefix}')" style="display: block; width: 100%; text-align: center; background: #000; color: #fff; border: none; padding: 15px 0; font-family: inherit; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; font-size: 13px; cursor: pointer; transition: background 0.2s;">Proceed to Checkout</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', drawerHTML);

    document.getElementById('cart-drawer-overlay').addEventListener('click', closeCartDrawer);
}

function openCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if(drawer && overlay) {
        overlay.style.display = 'block';
        setTimeout(() => overlay.style.opacity = '1', 10);
        drawer.style.right = '0';
    }
}

function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if(drawer && overlay) {
        drawer.style.right = '-400px';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    injectCartDrawer();
    updateCartUI();

    // Bind cart icon clicks
    const cartIcons = document.querySelectorAll('.cart-button, #cart-icon-btn');
    cartIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            openCartDrawer();
        });
    });

    // Size selection logic
    let selectedSize = null;
    const sizeBtns = document.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            sizeBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked
            btn.classList.add('active');
            // Save selected size
            selectedSize = btn.textContent.trim();
        });
    });

    // Bind Add to Cart buttons on product pages
    const addToBagBtns = document.querySelectorAll('.add-to-cart-btn');
    addToBagBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Check if sizes exist on page
            if (sizeBtns.length > 0 && !selectedSize) {
                alert('Please select a size first.');
                return;
            }

            const baseId = btn.getAttribute('data-id');
            const baseName = btn.getAttribute('data-name');
            const price = parseFloat(btn.getAttribute('data-price'));
            const image = btn.getAttribute('data-image');
            
            const id = baseId + (selectedSize ? '-' + selectedSize : '');
            const name = baseName + (selectedSize ? ' - Size ' + selectedSize : '');
            
            // Read quantity if available on the page
            let quantity = 1;
            const qtyElem = document.getElementById('productQty');
            if (qtyElem) {
                quantity = parseInt(qtyElem.textContent) || 1;
            }

            addToCart({
                id: id,
                name: name,
                price: price,
                image: image,
                quantity: quantity
            });

            // Track add-to-cart event for analytics
            if (typeof trackAddToCart === 'function') {
              trackAddToCart(baseName, selectedSize || 'Default', price, quantity);
            }
        });
    });
    
    // Product page qty +/- buttons
    const qtyMinus = document.querySelector('.qty-btn.minus');
    const qtyPlus = document.querySelector('.qty-btn.plus');
    const qtyVal = document.getElementById('productQty');
    
    if (qtyMinus && qtyPlus && qtyVal) {
        qtyMinus.addEventListener('click', () => {
            let val = parseInt(qtyVal.textContent);
            if (val > 1) qtyVal.textContent = val - 1;
        });
        qtyPlus.addEventListener('click', () => {
            let val = parseInt(qtyVal.textContent);
            qtyVal.textContent = val + 1;
        });
    }
});

// ===== CHECKOUT INTERCEPTOR & GUEST PHONE GATE =====
function handleCheckoutProceed(prefix) {
    const isProductPage = window.location.pathname.includes('/product/');
    const pathPrefix = prefix || (isProductPage ? '../' : '');
    const cart = getCart();

    if (!cart || cart.length === 0) {
        alert('Your shopping bag is empty.');
        return;
    }

    // 1. Check if user is logged in (has account data)
    let isLoggedIn = false;
    let userEmail = null;
    let userPhone = null;

    try {
        const token = localStorage.getItem('cp_token');
        const userObj = JSON.parse(localStorage.getItem('cp_user') || localStorage.getItem('user') || 'null');
        if (token || (userObj && (userObj.email || userObj.phone))) {
            isLoggedIn = true;
            userEmail = userObj ? userObj.email : null;
            userPhone = userObj ? userObj.phone : null;
        }
    } catch(e) {}

    // Check if guest already provided phone/email in this browser session
    const existingGuestPhone = localStorage.getItem('cp_guest_phone');
    const existingGuestEmail = localStorage.getItem('cp_guest_email');

    if (isLoggedIn || existingGuestPhone) {
        // Logged-in user or guest with phone -> sync cart & proceed directly
        syncCartToAbandoned(userEmail || existingGuestEmail, userPhone || existingGuestPhone, cart);
        window.location.href = `${pathPrefix}checkout.html`;
    } else {
        // GUEST VISITOR -> Open Guest Contact Phone Gate Modal
        closeCartDrawer();
        openGuestPhoneModal(pathPrefix);
    }
}

function openGuestPhoneModal(pathPrefix) {
    let modal = document.getElementById('guest-phone-modal-overlay');
    if (!modal) {
        const modalHTML = `
            <div id="guest-phone-modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;">
                <div style="background: #111419; border: 1px solid #272f3d; width: 440px; max-width: 92%; padding: 35px 30px; border-radius: 12px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); text-align: center; color: #fff; position: relative;">
                    <button onclick="closeGuestPhoneModal()" style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; line-height: 1;">&times;</button>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #38bdf8; font-weight: 600; margin-bottom: 8px;">Atelier Checkout Gate</div>
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #ffffff; font-family: 'Poppins', sans-serif;">Enter Phone Number</h3>
                    <p style="font-size: 13px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; font-family: 'Poppins', sans-serif;">Please provide your phone number to reserve your order allocation and proceed to checkout.</p>
                    <form onsubmit="submitGuestPhoneModal(event, '${pathPrefix || ''}')">
                        <div style="margin-bottom: 16px; text-align: left;">
                            <label style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Phone Number <span style="color: #ef4444;">*</span></label>
                            <input type="tel" id="guestPhoneInput" placeholder="+385 91 234 5678" required style="width: 100%; padding: 14px; background: #161a22; border: 1px solid #272f3d; border-radius: 6px; color: #ffffff; font-size: 14px; font-family: 'Poppins', sans-serif; outline: none; transition: border-color 0.2s;">
                        </div>
                        <div style="margin-bottom: 24px; text-align: left;">
                            <label style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Email Address (Optional)</label>
                            <input type="email" id="guestEmailInput" placeholder="your.email@domain.com" style="width: 100%; padding: 14px; background: #161a22; border: 1px solid #272f3d; border-radius: 6px; color: #ffffff; font-size: 14px; font-family: 'Poppins', sans-serif; outline: none; transition: border-color 0.2s;">
                        </div>
                        <button type="submit" style="width: 100%; padding: 15px; background: #ffffff; color: #000000; border: none; border-radius: 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; cursor: pointer; font-family: 'Poppins', sans-serif; transition: background 0.2s;">Continue to Checkout &rarr;</button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('guest-phone-modal-overlay');
    }
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
}

function closeGuestPhoneModal() {
    const modal = document.getElementById('guest-phone-modal-overlay');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function submitGuestPhoneModal(e, pathPrefix) {
    e.preventDefault();
    const phone = document.getElementById('guestPhoneInput').value.trim();
    const email = document.getElementById('guestEmailInput').value.trim();

    if (!phone) return;

    localStorage.setItem('cp_guest_phone', phone);
    if (email) localStorage.setItem('cp_guest_email', email);

    // Sync abandoned cart
    const cart = getCart();
    syncCartToAbandoned(email, phone, cart);

    // Verify telemetry
    if (typeof cpMarkVerified === 'function') {
        cpMarkVerified(email || null, phone);
    }

    closeGuestPhoneModal();
    window.location.href = `${pathPrefix || ''}checkout.html`;
}

function syncCartToAbandoned(email, phone, items) {
    const token = localStorage.getItem('cp_analytics_token') || sessionStorage.getItem('cp_analytics_token');
    const guestPhone = phone || localStorage.getItem('cp_guest_phone');
    const guestEmail = email || localStorage.getItem('cp_guest_email');

    fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionToken: token,
            phone: guestPhone || null,
            email: guestEmail || null,
            items: items || getCart()
        })
    }).catch(() => {});
}

// ===== LANGUAGE SWITCHER HELPERS =====
function toggleLangMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('cpLangDropdownMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('cpLangDropdownMenu');
    if (menu && !menu.contains(e.target) && e.target.id !== 'cpLangToggleBtn') {
        menu.style.display = 'none';
    }
});

function switchLanguage(targetLang, e) {
    if (e) e.preventDefault();
    const currentPath = window.location.pathname;
    const langs = ['de', 'hr', 'es', 'it', 'fr', 'ru', 'pl'];
    
    let cleanPath = currentPath;
    langs.forEach(l => {
        if (cleanPath.startsWith('/' + l + '/')) {
            cleanPath = cleanPath.substring(l.length + 1);
        } else if (cleanPath === '/' + l) {
            cleanPath = '/';
        }
    });

    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

    if (targetLang === 'en') {
        window.location.href = cleanPath;
    } else {
        window.location.href = '/' + targetLang + cleanPath;
    }
}

// Auto update language button label based on current language
document.addEventListener('DOMContentLoaded', () => {
    const lang = document.body.getAttribute('data-lang') || 'en';
    const labelElem = document.getElementById('cpCurrentLangLabel');
    if (labelElem) {
        const langMap = {
            en: '🌐 EN', de: '🇩🇪 DE', hr: '🇭🇷 HR', es: '🇪🇸 ES',
            it: '🇮🇹 IT', fr: '🇫🇷 FR', ru: '🇷🇺 RU', pl: '🇵🇱 PL'
        };
        labelElem.textContent = langMap[lang] || '🌐 ' + lang.toUpperCase();
    }
});
