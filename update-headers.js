const fs = require('fs');
const path = require('path');

const webflowHeaderTemplate = `
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
          <!-- Language Selector Dropdown -->
          <div class="cp-lang-wrapper" style="position: relative; display: inline-block;">
            <button id="cpLangToggleBtn" type="button" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 5px; font-family: sans-serif; font-weight: 500;" onclick="toggleLangMenu(event)">
              <span id="cpCurrentLangLabel">🌐 EN</span>
              <span style="font-size: 8px; opacity: 0.7;">▼</span>
            </button>
            <div id="cpLangDropdownMenu" style="display: none; position: absolute; right: 0; top: calc(100% + 6px); background: #111419; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 6px 0; min-width: 130px; z-index: 9999; box-shadow: 0 10px 25px rgba(0,0,0,0.6);">
              <a href="#" onclick="switchLanguage('en', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #fff; text-decoration: none; font-size: 12px;">🇬🇧 English</a>
              <a href="#" onclick="switchLanguage('de', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇩🇪 Deutsch</a>
              <a href="#" onclick="switchLanguage('hr', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇭🇷 Hrvatski</a>
              <a href="#" onclick="switchLanguage('es', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇪🇸 Español</a>
              <a href="#" onclick="switchLanguage('it', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇮🇹 Italiano</a>
              <a href="#" onclick="switchLanguage('fr', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇫🇷 Français</a>
              <a href="#" onclick="switchLanguage('ru', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇷🇺 Русский</a>
              <a href="#" onclick="switchLanguage('pl', event)" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: #ccc; text-decoration: none; font-size: 12px;">🇵🇱 Polski</a>
            </div>
          </div>
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
  </div>`;

const webflowFooterTemplate = `
  <!-- Footer -->
  <div class="section">
    <div class="container">
      <div class="w-layout-grid footer">
        <div class="columns w-row">
          <div class="column-2 w-col w-col-6">
            <a href="{prefix}index.html" class="logo-link-image w-nav-brand">
              <img src="{prefix}assets/images/logo.png" width="150" alt="" class="logo-image"/>
            </a>
            <div>
              <a href="#" target="_blank" class="logo-link-image social w-nav-brand">
                <img src="{prefix}assets/images/tiktok.png" alt="" class="image"/>
              </a>
              <a href="#" target="_blank" class="logo-link-image social w-nav-brand">
                <img src="{prefix}assets/images/instagram.png" alt="" class="image"/>
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
  <script src="{prefix}js/cart.js"></script>`;

// 1. Skip build-products.js since we already manually updated it.


// 2. Update all root HTML pages
const files = ['index.html', 'shop.html', 'aboutus.html', 'contact.html', 'account.html', 'checkout.html'];
const headerToInject = webflowHeaderTemplate.replace(/\{prefix\}/g, '');
const footerToInject = webflowFooterTemplate.replace(/\{prefix\}/g, '');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace header
  const regexHeader = /<!-- Top Announcement Bar -->[\s\S]*?<!-- Navigation -->[\s\S]*?(?=<main>|<div class="section|<section)/;
  content = content.replace(regexHeader, headerToInject + '\n\n  ');

  // Replace footer
  const regexFooter = /<footer class="site-footer">[\s\S]*?<\/footer>/;
  if(regexFooter.test(content)) {
      content = content.replace(regexFooter, footerToInject);
  } else {
      const oldFooterRegex = /<!-- Footer -->[\s\S]*?<\/html>/;
      content = content.replace(oldFooterRegex, footerToInject + '\n</body>\n</html>');
  }

  // Also ensure js/cart.js is loaded if it's not in the footer injection yet
  if (!content.includes('js/cart.js')) {
      content = content.replace('</body>', '  <script src="js/cart.js"></script>\n</body>');
  }

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
