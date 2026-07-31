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
          <a href="{prefix}account.html" class="navigation-item w-nav-link">ACCOUNT</a>
        </nav>
        <div class="navicons">
          <!-- Simplified cart icon for now -->
          <div class="w-commerce-commercecartwrapper" data-node-type="commerce-cart-wrapper">
            <a class="w-commerce-commercecartopenlink cart-button w-inline-block" role="button" aria-haspopup="dialog" aria-label="Open cart" href="#" id="cart-icon-btn">
              <svg class="w-commerce-commercecartopenlinkicon icon-8" width="17px" height="17px" viewBox="0 0 17 17">
                <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                  <path d="M2.60592789,2 L0,2 L0,0 L4.39407211,0 L4.84288393,4 L16,4 L16,9.93844589 L3.76940945,12.3694378 L2.60592789,2 Z M15.5,17 C14.6715729,17 14,16.3284271 14,15.5 C14,14.6715729 14.6715729,14 15.5,14 C16.3284271,14 17,14.6715729 17,15.5 C17,16.3284271 16.3284271,17 15.5,17 Z M5.5,17 C4.67157288,17 4,16.3284271 4,15.5 C4,14.6715729 4.67157288,14 5.5,14 C6.32842712,14 7,14.6715729 7,15.5 C7,16.3284271 6.32842712,17 5.5,17 Z" fill="currentColor" fill-rule="nonzero"></path>
                </g>
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


// 2. Update aboutus.html and contact.html
const files = ['aboutus.html', 'contact.html'];
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
