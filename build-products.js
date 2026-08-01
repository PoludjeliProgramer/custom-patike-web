const fs = require('fs');
const path = require('path');
const https = require('https');

const dirs = ['assets/images/products', 'product'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    const lines = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                current += '"'; i++;
            } else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            lines.push(current.trim()); current = '';
        } else if (ch === '\n' && !inQuotes) {
            lines.push(current.trim()); current = ''; rows.push(lines.splice(0));
        } else if (ch === '\r' && !inQuotes) {
        } else current += ch;
    }
    if (current.length || lines.length) {
        lines.push(current.trim()); rows.push(lines.splice(0));
    }
    return rows;
}

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) return resolve(dest);
        const file = fs.createWriteStream(dest);
        https.get(url, response => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(dest); });
            } else {
                file.close(); fs.unlink(dest, () => reject(`Status: ${response.statusCode}`));
            }
        }).on('error', err => fs.unlink(dest, () => reject(err.message)));
    });
}

async function main() {
    const raw = fs.readFileSync('Custom Patike - Products (4).csv', 'utf-8');
    const rows = parseCSV(raw);
    const headers = rows[0];
    const data = rows.slice(1).filter(r => r.length === headers.length);
    
    const products = {};
    data.forEach(r => {
        const productId = r[1];
        if (!products[productId]) {
            products[productId] = {
                id: productId, handle: r[4], name: r[5], category: r[8] || 'Sneakers',
                description: r[7], imageUrl: r[9],
                price: parseFloat(r[11].replace('€', '').replace(',', '')),
                compareAtPrice: r[12] ? parseFloat(r[12].replace('€', '').replace(',', '')) : null,
                variants: []
            };
        }
        if (r[24]) products[productId].variants.push({ size: r[24] });
    });
    
    // Filter out handbag / bag products
    const productList = Object.values(products).filter(p => {
        const h = (p.handle || '').toLowerCase();
        const n = (p.name || '').toLowerCase();
        const c = (p.category || '').toLowerCase();
        return !h.includes('bag') && !n.includes('bag') && !c.includes('bag') && !h.includes('handbag') && !n.includes('handbag');
    });

    for (const p of productList) {
        let imageExt = '.jpg';
        try {
            const urlObj = new URL(p.imageUrl);
            const ext = path.extname(urlObj.pathname);
            if (ext) imageExt = ext;
        } catch (e) {}
        const imagePath = `assets/images/products/${p.handle}${imageExt}`;
        try {
            await downloadImage(p.imageUrl, imagePath);
            p.localImage = imagePath;
        } catch (err) {}
        generateProductPage(p);
    }
    generateShopPage(productList);
    console.log('Build complete!');
}

function getHeaderHTML(isProductPage) {
    const prefix = isProductPage ? '../' : '';
    return `
  <!-- Top Announcement Bar -->
  <section class="aboveheadsection">
    <div data-delay="2000" data-animation="slide" class="slider w-slider" data-autoplay="true" data-easing="ease" data-hide-arrows="false" data-disable-swipe="false" data-autoplay-limit="0" data-nav-spacing="3" data-duration="500" data-infinite="true">
      <div class="w-slider-mask">
        <div class="nav-slide w-slide">
          <div class="head-div">
            <div class="shippingworldwide">Shipping worldwide!</div>
            <a href="{prefix}shop.html" class="shop-now">SHOP NOW!</a>
          </div>
        </div>
        <div class="nav-slide w-slide">
          <div class="head-div">
            <div>100% Handmade &amp; Luxury Sneakers</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Navigation -->
  <div data-collapse="medium" data-animation="default" data-duration="400" data-easing="ease" data-easing2="ease" role="banner" class="navigation w-nav">
    <div class="navigation-items">
      <a href="{prefix}index.html" class="logo-link-image w-nav-brand">
        <img src="{prefix}assets/images/logo.png" width="50" alt="" class="logo-image"/>
      </a>
      <div class="navigation-wrap">
        <nav role="navigation" class="navigation-items w-nav-menu">
          <a href="{prefix}shop.html" class="navigation-item w-nav-link">SHOP</a>
          <a href="{prefix}aboutus.html" class="navigation-item w-nav-link">ABOUT US</a>
          <a href="{prefix}contact.html" class="navigation-item w-nav-link">CONTACT</a>
        </nav>
        <div class="navicons" style="display: flex; align-items: center; gap: 15px;">
          <!-- Account Icon SVG -->
          <a href="{prefix}account.html" class="account-button w-inline-block" aria-label="Account" title="My Account" style="color: currentColor; display: flex; align-items: center; justify-content: center; text-decoration: none;">
            <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </a>
          <!-- Cart Icon SVG -->
          <div class="w-commerce-commercecartwrapper" data-node-type="commerce-cart-wrapper">
            <a class="w-commerce-commercecartopenlink cart-button w-inline-block" role="button" aria-haspopup="dialog" aria-label="Open cart" href="#" id="cart-icon-btn" style="color: currentColor; display: flex; align-items: center; justify-content: center;">
              <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <div class="w-commerce-commercecartopenlinkcount cart-quantity-2" id="cart-count">0</div>
            </a>
          </div>
          <!-- Mobile Menu Button -->
          <div class="menu-button w-nav-button">
            <img src="{prefix}assets/images/menu-icon.png" width="22" alt="" class="menu-icon"/>
          </div>
        </div>
      </div>
    </div>
  </div>`.replace(/\{prefix\}/g, prefix);
}

function getFooterHTML(isProductPage) {
    const prefix = isProductPage ? '../' : '';
    return `
  <!-- Footer -->
  <div class="section">
    <div class="container">
      <div class="w-layout-grid footer">
        <div class="columns w-row">
          <div class="column-2 w-col w-col-6">
            <a href="${prefix}index.html" class="logo-link-image w-nav-brand">
              <img src="${prefix}assets/images/logo.png" width="150" alt="" class="logo-image"/>
            </a>
            <div>
              <a href="#" target="_blank" class="logo-link-image social w-nav-brand">
                <img src="${prefix}assets/images/tiktok.png" alt="" class="image"/>
              </a>
              <a href="#" target="_blank" class="logo-link-image social w-nav-brand">
                <img src="${prefix}assets/images/instagram.png" alt="" class="image"/>
              </a>
            </div>
          </div>
          <div class="column w-col w-col-6">
            <div class="getintouchdiv">
              <h1 class="getintouch">Customer Support</h1>
              <div class="infofooter">patikecustom@gmail.com<br/>Dubrovnik 20236, Croatia<br/></div>
            </div>
          </div>
        </div>
      </div>
      <div class="text-block-2">© Copyright 2026 Custom Patike</div>
    </div>
  </div>
  <!-- Cart script -->
  <script src="${prefix}js/cart.js"></script>`;
}

function generateProductPage(product) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${product.name} | Custom Patike</title>
    <link href="https://fonts.googleapis.com" rel="preconnect"/>
  <link href="https://fonts.gstatic.com" rel="preconnect" crossorigin="anonymous"/>
  <script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" type="text/javascript"></script>
  <script type="text/javascript">
    WebFont.load({  google: {    families: ["Montserrat:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic","Great Vibes:400","Exo:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic","Lato:100,100italic,300,300italic,400,400italic,700,700italic,900,900italic","League Spartan:300,400,500,600,700","Poppins:300,400,500,600,700"]  }});
  </script>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/vandal-style.css">
</head>
<body>
${getHeaderHTML(true)}
  <main>
    <nav class="breadcrumbs">
      <a href="../index.html">Home</a><span>/</span>
      <a href="../shop.html">Shop</a><span>/</span>
      <span style="color: var(--text);">Product</span>
    </nav>
    <section class="product-detail-section">
      <div class="product-gallery footwear-gallery" id="footwearGallery">
        <div class="img-container">
          <img src="../${product.localImage}" alt="${product.name}" id="mainProdImg" style="width: 100%; aspect-ratio: 4/5; object-fit: cover;">
        </div>
      </div>
      <div class="product-info-detail">
        <h1 class="product-title">${product.name}</h1>
        <div class="product-price">€${product.price}</div>
        <p class="product-description">${product.description || 'Hand-painted on an authentic sneaker. Each pair is a 1-of-1 original — hand-drawn, hand-mixed, and hand-applied brushwork. Sealed with UV-resistant varnish. Never printed, never stenciled.'}</p>
        
        <div class="size-selector">
          <div class="size-selector-header" style="align-items: center;">
            <span>Select Size <span id="currentSizeType">(EU)</span></span>
          </div>
          <div class="size-grid">
            <button class="size-btn">36</button>
            <button class="size-btn">36.5</button>
            <button class="size-btn">37.5</button>
            <button class="size-btn">38</button>
            <button class="size-btn">38.5</button>
            <button class="size-btn">39</button>
            <button class="size-btn">40</button>
            <button class="size-btn">41</button>
            <button class="size-btn">42</button>
            <button class="size-btn">42.5</button>
            <button class="size-btn">43</button>
            <button class="size-btn">44</button>
            <button class="size-btn">44.5</button>
            <button class="size-btn">45</button>
            <button class="size-btn">45.5</button>
            <button class="size-btn">46</button>
          </div>
        </div>

        <div class="action-row" style="display: flex; gap: 20px; margin-bottom: 40px; margin-top: 20px;">
          <div class="qty-selector" style="display: flex; border: 1px solid var(--border); align-items: center; width: 120px; justify-content: space-between; padding: 0 15px;">
            <button class="qty-btn minus" style="background:none; border:none; cursor:pointer; font-size:18px;">-</button>
            <span class="qty-val" id="productQty" style="font-family: var(--font-sans); font-size: 14px;">1</span>
            <button class="qty-btn plus" style="background:none; border:none; cursor:pointer; font-size:18px;">+</button>
          </div>
          <button class="btn-primary add-to-cart-btn" id="addToBagBtn" data-id="${product.handle}" data-name="${product.name}" data-price="${product.price}" data-image="../${product.localImage}" style="flex: 1; margin: 0;">Add to Cart</button>
        </div>
        
        <div class="product-trust-signals" style="margin-bottom: 40px; padding-top: 10px; border-top: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #222; font-weight: 600;">Secure Checkout via Stripe</span>
          </div>
        </div>
      </div>
    </section>
  </main>
${getFooterHTML(true)}
</body>
</html>`;
    fs.writeFileSync(`product/${product.handle}.html`, html);
}

function generateShopPage(products) {
    const productCardsHtml = products.map(p => `
        <a href="product/${p.handle}.html" class="product-card">
          <div class="img-wrapper" style="width: 100%; aspect-ratio: 4/5; overflow: hidden; margin-bottom: 20px;">
            <img src="${p.localImage}" alt="${p.name}" class="product-img" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          </div>
          <div class="product-info">
            <h3 class="product-title">${p.name}</h3>
            <span class="product-price">€${p.price}</span>
            <span class="product-meta">${p.category}</span>
          </div>
        </a>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shop | Custom Patike</title>
    <link href="https://fonts.googleapis.com" rel="preconnect"/>
  <link href="https://fonts.gstatic.com" rel="preconnect" crossorigin="anonymous"/>
  <script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" type="text/javascript"></script>
  <script type="text/javascript">
    WebFont.load({  google: {    families: ["Montserrat:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic","Great Vibes:400","Exo:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic","Lato:100,100italic,300,300italic,400,400italic,700,700italic,900,900italic","League Spartan:300,400,500,600,700","Poppins:300,400,500,600,700"]  }});
  </script>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/vandal-style.css">
</head>
<body>
${getHeaderHTML(false)}
  <main>
    <section class="shop-section">
      <div class="section-header" style="margin-bottom: 20px;">
        <h2>The Custom Collection</h2>
        <p style="color: var(--text-muted); font-size: 15px; max-width: 600px; margin: 15px auto; line-height: 1.6;">
          Hand-painted, UV-sealed, and strictly 1-of-1.
        </p>
      </div>
      <div class="grid">
        ${productCardsHtml}
      </div>
    </section>
  </main>
${getFooterHTML(false)}
</body>
</html>`;
    fs.writeFileSync('shop.html', html);
}

main().catch(console.error);
