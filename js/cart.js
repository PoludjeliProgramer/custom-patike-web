// Cart System using LocalStorage

let cart = JSON.parse(localStorage.getItem('custom_patike_cart')) || [];

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
                <a href="${prefix}checkout.html" style="display: block; width: 100%; text-align: center; background: #000; color: #fff; padding: 15px 0; text-decoration: none; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; font-size: 13px;">Proceed to Checkout</a>
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
