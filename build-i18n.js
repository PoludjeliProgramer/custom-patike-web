/**
 * Custom Patike — i18n Build & SEO Indexing Script
 * 
 * Generates translated HTML pages in language subdirectories.
 * English remains at root. Each language gets its own /lang/ subdirectory.
 * Also generates sitemap.xml with hreflang annotations.
 *
 * Usage: node build-i18n.js
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// ─── Configuration ──────────────────────────────────────────────────────────

const DOMAIN = 'https://custompatike.com';
const ROOT_DIR = __dirname;
const TRANSLATIONS_DIR = path.join(ROOT_DIR, 'translations');

const LANGUAGES = ['de', 'hr', 'es', 'it', 'fr', 'ru', 'pl'];
const DEFAULT_LANG = 'en';

// Root HTML files to translate
const HTML_FILES = [
  'index.html',
  'shop.html',
  'aboutus.html',
  'contact.html',
  'checkout.html',
  'account.html',
  'confirmation.html'
];

// Dynamically add all product HTML files from /product/ directory
const PRODUCT_DIR = path.join(ROOT_DIR, 'product');
if (fs.existsSync(PRODUCT_DIR)) {
  const prodFiles = fs.readdirSync(PRODUCT_DIR).filter(f => f.endsWith('.html'));
  prodFiles.forEach(f => {
    HTML_FILES.push("product/" + f);
  });
}

// ─── Load Translations ─────────────────────────────────────────────────────

function loadTranslation(langCode) {
  const filePath = path.join(TRANSLATIONS_DIR, `${langCode}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ Translation file not found: ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ─── Get page name from filename ────────────────────────────────────────────

function getPageName(filename) {
  if (filename.startsWith('product/')) {
    return 'product';
  }
  return filename.replace('.html', '');
}

// ─── Translate HTML Content ─────────────────────────────────────────────────

function translateHTML(html, translation, filename, langCode) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const strings = translation.strings || {};
  const pages = translation.pages || {};
  const pageName = getPageName(filename);
  const pageMeta = pages[pageName] || {};

  // 1. Update <html lang>
  $('html').attr('lang', langCode);

  // 2. Update page metadata if present in translation dictionary
  if (pageMeta.title) {
    $('title').text(pageMeta.title);
  }
  if (pageMeta.meta_description) {
    $('meta[name="description"]').attr('content', pageMeta.meta_description);
  }
  if (pageMeta.og_title) {
    $('meta[property="og:title"]').attr('content', pageMeta.og_title);
  }
  if (pageMeta.og_description) {
    $('meta[property="og:description"]').attr('content', pageMeta.og_description);
  }
  if (pageMeta.twitter_title) {
    $('meta[name="twitter:title"]').attr('content', pageMeta.twitter_title);
  }
  if (pageMeta.twitter_description) {
    $('meta[name="twitter:description"]').attr('content', pageMeta.twitter_description);
  }

  // 3. Update canonical URL
  let canonical = $('link[rel="canonical"]');
  if (!canonical.length) {
    $('head').append('<link rel="canonical" href="" />');
    canonical = $('link[rel="canonical"]');
  }
  const cleanPath = filename === 'index.html' ? '' : '/' + filename;
  canonical.attr('href', `${DOMAIN}/${langCode}${cleanPath}`);

  // 4. Add/update hreflang tags
  $('link[rel="alternate"][hreflang]').remove();

  const pagePath = filename === 'index.html' ? '' : '/' + filename;

  // Add hreflang for default (English)
  $('head').append(`\n  <link rel="alternate" hreflang="en" href="${DOMAIN}${pagePath}" />`);
  $('head').append(`\n  <link rel="alternate" hreflang="x-default" href="${DOMAIN}${pagePath}" />`);

  // Add hreflang for each language
  for (const lang of LANGUAGES) {
    $('head').append(`\n  <link rel="alternate" hreflang="${lang}" href="${DOMAIN}/${lang}${pagePath}" />`);
  }

  // 5. Replace text content in elements
  const textElements = 'h1, h2, h3, h4, h5, h6, p, span, a, button, label, strong, em, li, td, th, option';
  
  $(textElements).each(function () {
    const el = $(this);
    
    // Skip elements that contain block-level elements
    if (el.find('h1, h2, h3, h4, h5, h6, p, div, section').length > 0) return;
    
    const innerHTML = el.html();
    if (!innerHTML) return;

    const trimmedHTML = innerHTML.trim();
    if (strings[trimmedHTML]) {
      el.html(strings[trimmedHTML]);
      return;
    }

    const textContent = el.text().trim();
    if (textContent && strings[textContent] && textContent === trimmedHTML) {
      el.html(strings[textContent]);
      return;
    }
  });

  // 6. Translate placeholder attributes
  $('input[placeholder], textarea[placeholder]').each(function () {
    const el = $(this);
    const placeholder = el.attr('placeholder');
    if (placeholder && strings[placeholder]) {
      el.attr('placeholder', strings[placeholder]);
    }
  });

  // 7. Translate title attributes
  $('[title]').each(function () {
    const el = $(this);
    const title = el.attr('title');
    if (title && strings[title]) {
      el.attr('title', strings[title]);
    }
  });

  // 8. Translate alt attributes
  $('img[alt]').each(function () {
    const el = $(this);
    const alt = el.attr('alt');
    if (alt && strings[alt]) {
      el.attr('alt', strings[alt]);
    }
  });

  // 9. Fix internal navigation links (add language prefix)
  $('a[href]').each(function () {
    const el = $(this);
    const href = el.attr('href');
    if (!href) return;
    
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|mp4|webm|pdf)$/i)) return;
    
    let cleanHref = href;
    if (cleanHref.startsWith('../')) {
      cleanHref = cleanHref.replace('../', '');
    }
    if (cleanHref.startsWith('./')) {
      cleanHref = cleanHref.replace('./', '');
    }

    if (cleanHref.startsWith('/')) {
      el.attr('href', `/${langCode}${cleanHref}`);
    } else {
      el.attr('href', `/${langCode}/${cleanHref}`);
    }
  });

  // 10. Fix asset paths — make them absolute from root
  $('link[rel="stylesheet"][href]').each(function () {
    const el = $(this);
    let href = el.attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('/')) {
      if (href.startsWith('../')) href = href.replace('../', '');
      el.attr('href', '/' + href);
    }
  });

  $('script[src]').each(function () {
    const el = $(this);
    let src = el.attr('src');
    if (src && !src.startsWith('http') && !src.startsWith('/')) {
      if (src.startsWith('../')) src = src.replace('../', '');
      el.attr('src', '/' + src);
    }
  });

  $('img[src]').each(function () {
    const el = $(this);
    let src = el.attr('src');
    if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
      if (src.startsWith('../')) src = src.replace('../', '');
      el.attr('src', '/' + src);
    }
  });

  $('source[src]').each(function () {
    const el = $(this);
    let src = el.attr('src');
    if (src && !src.startsWith('http') && !src.startsWith('/')) {
      if (src.startsWith('../')) src = src.replace('../', '');
      el.attr('src', '/' + src);
    }
  });

  $('link[rel="icon"][href], link[rel="shortcut icon"][href]').each(function () {
    const el = $(this);
    let href = el.attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('/')) {
      if (href.startsWith('../')) href = href.replace('../', '');
      el.attr('href', '/' + href);
    }
  });

  // Fix background-image URLs in inline styles
  $('[style]').each(function () {
    const el = $(this);
    let style = el.attr('style');
    if (style && style.includes("url('") && !style.includes("url('http") && !style.includes("url('/")) {
      style = style.replace(/url\('([^']+)'\)/g, (match, p1) => {
        if (p1.startsWith('http') || p1.startsWith('/') || p1.startsWith('data:')) return match;
        const cleanP1 = p1.replace('../', '');
        return `url('/${cleanP1}')`;
      });
      el.attr('style', style);
    }
  });

  // 11. Add data-lang attribute to body for JS runtime detection
  $('body').attr('data-lang', langCode);

  return $.html();
}

// ─── Add hreflang to English source files ───────────────────────────────────

function addHreflangToEnglish(html, filename) {
  const $ = cheerio.load(html, { decodeEntities: false });

  $('html').attr('lang', 'en');
  $('link[rel="alternate"][hreflang]').remove();

  const pagePath = filename === 'index.html' ? '' : '/' + filename;

  // Add hreflang for English (self)
  $('head').append(`\n  <link rel="alternate" hreflang="en" href="${DOMAIN}${pagePath}" />`);
  $('head').append(`\n  <link rel="alternate" hreflang="x-default" href="${DOMAIN}${pagePath}" />`);

  // Add hreflang for each language
  for (const lang of LANGUAGES) {
    $('head').append(`\n  <link rel="alternate" hreflang="${lang}" href="${DOMAIN}/${lang}${pagePath}" />`);
  }

  // Canonical
  let canonical = $('link[rel="canonical"]');
  if (!canonical.length) {
    $('head').append('<link rel="canonical" href="" />');
    canonical = $('link[rel="canonical"]');
  }
  canonical.attr('href', `${DOMAIN}${pagePath}`);

  return $.html();
}

// ─── Generate Sitemap ───────────────────────────────────────────────────────

function generateSitemap() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  for (const file of HTML_FILES) {
    const pagePath = file === 'index.html' ? '' : '/' + file;
    const baseName = file.replace('product/', '').replace('.html', '');

    // Skip private pages from sitemap indexing
    if (['checkout', 'confirmation', 'account'].includes(baseName)) continue;

    // English URL Entry
    xml += '  <url>\n';
    xml += `    <loc>${DOMAIN}${pagePath}</loc>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="en" href="${DOMAIN}${pagePath}" />\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${DOMAIN}${pagePath}" />\n`;

    for (const lang of LANGUAGES) {
      xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${DOMAIN}/${lang}${pagePath}" />\n`;
    }

    xml += '  </url>\n';

    // Each Language URL Entry
    for (const lang of LANGUAGES) {
      xml += '  <url>\n';
      xml += `    <loc>${DOMAIN}/${lang}${pagePath}</loc>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${DOMAIN}${pagePath}" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${DOMAIN}${pagePath}" />\n`;

      for (const l of LANGUAGES) {
        xml += `    <xhtml:link rel="alternate" hreflang="${l}" href="${DOMAIN}/${l}${pagePath}" />\n`;
      }

      xml += '  </url>\n';
    }
  }

  xml += '</urlset>\n';
  return xml;
}

// ─── Main Build ─────────────────────────────────────────────────────────────

function build() {
  console.log('🌐 Custom Patike — i18n & SEO Indexing Build');
  console.log('═══════════════════════════════════════════════════');

  const translations = {};
  for (const lang of LANGUAGES) {
    console.log(`📖 Loading translation: ${lang}`);
    translations[lang] = loadTranslation(lang);
  }

  // Phase 1: Update English source files with hreflang tags & canonicals
  console.log('\n📝 Adding hreflang tags & canonicals to English source files...');
  for (const file of HTML_FILES) {
    const filePath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ File not found: ${file}`);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const updatedHTML = addHreflangToEnglish(html, file);
    fs.writeFileSync(filePath, updatedHTML, 'utf8');
    console.log(`  ✓ ${file}`);
  }

  // Phase 2: Generate translated subdirectories
  for (const lang of LANGUAGES) {
    const translation = translations[lang];
    if (!translation) {
      console.warn(`\n⚠ Skipping ${lang} — no translation file`);
      continue;
    }

    const langDir = path.join(ROOT_DIR, lang);
    console.log(`\n🔨 Building: ${lang} (${translation._meta?.name || lang})`);

    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const file of HTML_FILES) {
      const filePath = path.join(ROOT_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠ File not found: ${file}`);
        continue;
      }

      const html = fs.readFileSync(filePath, 'utf8');
      const translatedHTML = translateHTML(html, translation, file, lang);

      const outputPath = path.join(langDir, file);
      if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      }
      fs.writeFileSync(outputPath, translatedHTML, 'utf8');
      console.log(`  ✓ ${lang}/${file}`);
    }
  }

  // Phase 3: Generate sitemap.xml
  console.log('\n📋 Generating multi-language sitemap.xml...');
  const sitemap = generateSitemap();
  fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemap, 'utf8');
  console.log('  ✓ sitemap.xml');

  // Summary
  const langCount = LANGUAGES.filter(l => translations[l]).length;
  const fileCount = HTML_FILES.length;
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`✅ i18n & SEO Build complete!`);
  console.log(`   ${langCount} languages × ${fileCount} pages = ${langCount * fileCount} translated pages generated`);
  console.log(`   + sitemap.xml generated with multi-language hreflang annotations`);
  console.log('═══════════════════════════════════════════════════\n');
}

build();
