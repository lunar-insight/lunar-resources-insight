// Contrast audit of the visible text and icons of the page, as rendered.
//
// For each visible text and icon, the background seen behind it is composited from the element and
// its ancestors (background colors, gradient ends, opacity), over a white and a black backdrop:
// the globe canvas behind the panes is not in their ancestors, so the backdrop stands for it.
// html and body backgrounds are skipped for that reason. The worst ratio is kept.
//
// A brightness() in an element's backdrop-filter scales what lies behind it before its background
// is composited. Blur is ignored: it averages the backdrop and does not change the extremes.
//
// Text needs 4.5:1, large text (24 px, or 18.66 px bold) and icons 3:1. Disabled elements are skipped.
// Text over an image (background-image url) is reported as unmeasured. Emoji are skipped.
//
// Load in the page and run:  (await import('/docs/measurements/dark-contrast/audit.js')).audit('label')

const BACKDROPS = { white: [255, 255, 255], black: [0, 0, 0] };

function parseColors(str) {
  const out = [];
  const re = /rgba?\(([^)]+)\)|color\(srgb ([^)]+)\)|transparent/g;
  let m;
  while ((m = re.exec(str))) {
    if (m[0] === 'transparent') { out.push([0, 0, 0, 0]); continue; }
    if (m[1]) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      out.push([p[0], p[1], p[2], p[3] ?? 1]);
    } else {
      const p = m[2].split(/[\s/]+/).filter(Boolean).map(Number);
      out.push([p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]);
    }
  }
  return out;
}

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (c, under) => [0, 1, 2].map(i => c[3] * c[i] + (1 - c[3]) * under[i]);
const blend = (c, o, under) => [0, 1, 2].map(i => o * c[i] + (1 - o) * under[i]);

// The background layers an element paints: its color, then each gradient's ends. Images are flagged.
function layersOf(el) {
  const cs = getComputedStyle(el);
  const bgColor = parseColors(cs.backgroundColor)[0];
  const img = cs.backgroundImage;
  const hasImage = /url\(/.test(img);
  const stops = img && img !== 'none' ? parseColors(img) : [];
  const b = /brightness\(([\d.]+)(%?)\)/.exec(cs.backdropFilter || '');
  const brightness = b ? Number(b[1]) / (b[2] ? 100 : 1) : 1;
  return { bgColor, stops, hasImage, opacity: Number(cs.opacity), brightness };
}

function isLarge(cs) {
  const size = parseFloat(cs.fontSize);
  const weight = Number(cs.fontWeight) || 400;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

function describe(el) {
  const parts = [];
  for (let n = el; n && n !== document.body && parts.length < 4; n = n.parentElement) {
    const cls = [...n.classList].map(c => c.replace(/^_/, '').replace(/_[a-z0-9]{5}$/i, '')).slice(0, 2).join('.');
    parts.unshift(n.tagName.toLowerCase() + (cls ? '.' + cls : ''));
  }
  return parts.join(' > ');
}

// Every color pair (seen background, seen foreground) for one backdrop, over the gradient end choices
function seenPairs(chain, fg, backdrop) {
  function walk(i, under) {
    const node = chain[i];
    const L = node.layers;
    const bases = [];
    const behind = L.brightness < 1 ? under.map(v => v * L.brightness) : under;
    let b = L.bgColor && L.bgColor[3] > 0 ? over(L.bgColor, behind) : behind;
    if (L.stops.length) L.stops.forEach(s => bases.push(over(s, b)));
    else bases.push(b);
    const out = [];
    for (const base of bases) {
      let pairs;
      if (i === chain.length - 1) pairs = [{ bg: base, fg: over(fg, base) }];
      else pairs = walk(i + 1, base);
      for (const p of pairs) {
        out.push(L.opacity < 1 ? { bg: blend(p.bg, L.opacity, under), fg: blend(p.fg, L.opacity, under) } : p);
      }
    }
    return out;
  }
  return walk(0, backdrop);
}

function isDisabled(el) {
  return !!el.closest('[disabled], [aria-disabled="true"], [data-disabled]');
}

function visible(el) {
  if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  // A closed sidebar slides behind the navigation
  if (el.closest('[class*="closed"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
}

function targets() {
  const found = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    if (t.nodeValue.trim() && t.parentElement) found.add(t.parentElement);
  }
  return [...found].filter(el => !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName));
}

export function audit(label = '') {
  const rows = [];
  for (const el of targets()) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const isSvgText = el instanceof SVGElement;
    const fg = parseColors(isSvgText ? cs.fill : cs.color)[0];
    if (!fg || fg[3] === 0) continue;
    // Emoji draw in their own colors
    if (/^[s←-⯿️🀀-🫿]+$/u.test(el.textContent.trim())) continue;
    const icon = /Material Symbols/.test(cs.fontFamily);
    const need = icon || isLarge(cs) ? 3 : 4.5;
    const chain = [];
    let image = false;
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const layers = layersOf(n);
      if (layers.hasImage) image = true;
      chain.unshift({ el: n, layers });
    }
    const text = (el.textContent || '').trim().slice(0, 40);
    if (image) { rows.push({ label, path: describe(el), text, status: 'over image', need }); continue; }
    let worst = Infinity, worstBackdrop = '', worstBg = null, worstFg = null;
    for (const [name, backdrop] of Object.entries(BACKDROPS)) {
      for (const p of seenPairs(chain, fg, backdrop)) {
        const r = ratio(p.fg, p.bg);
        if (r < worst) { worst = r; worstBackdrop = name; worstBg = p.bg; worstFg = p.fg; }
      }
    }
    const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    rows.push({
      label, path: describe(el), text, color: hex(fg.slice(0, 3)) + (fg[3] < 1 ? ` @${fg[3]}` : ''),
      need, ratio: +worst.toFixed(2), over: worstBackdrop, seenBg: hex(worstBg), seenFg: hex(worstFg),
      disabled: isDisabled(el), status: isDisabled(el) ? 'disabled' : worst >= need ? 'pass' : 'fail',
    });
  }
  return rows;
}
