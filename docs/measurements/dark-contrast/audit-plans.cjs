// Writes the BiDi plans that run the contrast audit (audit.js) through the app's panes.
//
//   node docs/measurements/dark-contrast/audit-plans.cjs <out-dir>
//   node scripts/firefox-bidi/drive.mjs <out-dir>/app.json > <out-dir>/app.txt
//   node docs/measurements/dark-contrast/audit-report.cjs <out-dir>/app.txt fail
//
// Four plans: app.json walks the dialogs, modals, layer list, scanner, catalog and search;
// inspector.json draws a point and opens its Inspector. The -adjusted variants load overrides.css
// first, so they measure the proposed values on the app at commit 4dd51167 only. Screenshots land in
// <out-dir>.
// Needs the development server on http://127.0.0.1:5173/, and the tiler for map data.

const fs = require('fs');
const path = require('path');

const out = path.resolve(process.argv[2] || '.');
fs.mkdirSync(out, { recursive: true });
const shot = name => path.join(out, name + '.png').replace(/\\/g, '/');

const run = label => `(async () => { const { audit } = await import("/docs/measurements/dark-contrast/audit.js?" + Date.now()); `
  + `const r = audit(${JSON.stringify(label)}); window.__audit = (window.__audit || []).concat(r); `
  + `return ${JSON.stringify(label)} + ": " + r.length + " checked, " + r.filter(x => x.status === "fail").length + " fail"; })()`;
// The last step prints every non-passing row as JSON, which audit-report.cjs reads
const dump = 'JSON.stringify(window.__audit.filter(r => r.status !== "pass"))';
const overrides = 'document.head.append(Object.assign(document.createElement("link"), '
  + '{ rel: "stylesheet", href: "/docs/measurements/dark-contrast/overrides.css?" + Date.now() })); 1';
const ready = '[...document.querySelectorAll("button")].some(b => b.textContent.trim().endsWith("Chemistry"))';

// Page helpers. Clicks go to the last visible match, which is the most recent overlay.
const helpers = `window.H = {
  vis: e => e.checkVisibility() && e.getBoundingClientRect().width > 0,
  click(sel, test) { const all = [...document.querySelectorAll(sel)].filter(e => H.vis(e) && test(e.textContent.trim(), e)); const e = all[all.length - 1]; if (e) { e.click(); return e.textContent.trim().slice(0, 30); } return 'not found'; },
  nav(t) { const b = [...document.querySelectorAll('[class*="SectionNavigation"] button')].find(b => [...b.querySelectorAll('span')].some(e => e.textContent.trim() === t)); if (!b) return 'no nav ' + t; b.click(); return t; },
  btn(t) { return H.click('button, [role=button], [role=gridcell], [role=row], [role=menuitemcheckbox], [role=checkbox], [role=switch]', s => s === t || s.endsWith(t)); },
  has(t) { return H.click('button, [role=button], [role=gridcell], [role=row], [role=checkbox]', s => s.includes(t)); },
  aria(l) { const e = [...document.querySelectorAll('[aria-label="' + l + '"]')].filter(H.vis).pop(); if (e) { e.click(); return l; } return 'no ' + l; },
  esc() { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc'; },
  text(t) { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const hits = []; for (let n; (n = w.nextNode());) if (n.nodeValue.trim() === t && H.vis(n.parentElement)) hits.push(n.parentElement); const e = hits.pop(); if (!e) return 'no text ' + t; (e.closest('button, [role=button], [role=gridcell], [role=row], [role=checkbox], [role=option], [tabindex]') || e).click(); return t; },
  closeLast() { return H.click('button', s => s === 'close'); },
}; 1`;
const s = (js, wait = 1200, extra = {}) => ({ js, wait, ...extra });

const appSteps = suffix => [
  s(helpers, 200),
  s(run('start')),
  ...['Home', 'Base Maps', 'Geology', 'Features', 'Analysis', 'Viewer', 'Settings'].flatMap(n => [
    s(`H.nav(${JSON.stringify(n)})`, 1500), s(run('dialog ' + n), 300), s(`H.nav(${JSON.stringify(n)})`, 800)]),
  s('H.nav("Chemistry")', 1500), s(run('dialog Chemistry'), 300),
  s('H.has("Periodic Table")', 2500), s(run('modal periodic table'), 300),
  s('H.text("Iron")', 700), s('H.text("Calcium")', 700), s('H.text("Thorium")', 700), s(run('periodic table selected'), 300),
  s('H.closeLast()', 1200),
  s('H.has("Compound")', 2500), s(run('modal compound'), 300), s('H.text("Iron(II) oxide")', 800), s('H.closeLast()', 1200),
  s('H.has("Derived Indices")', 2500), s(run('modal derived indices'), 300), s('H.closeLast()', 1200),
  s('H.nav("Chemistry")', 800),
  s('H.nav("Geology")', 1500), s('H.has("Rocks")', 2500), s(run('modal rocks and minerals'), 300),
  s('H.text("Plagioclase")', 800), s('H.click("button", s => s === "info")', 1200), s(run('info popover'), 300), s('H.esc()', 800),
  s('H.closeLast()', 1200), s('H.nav("Geology")', 800),
  s('H.nav("Layers")', 1500), s(run('layer list'), 300, { shot: shot('layers' + suffix) }),
  s('H.aria("Scanner")', 1000), s(run('scanner menu'), 300),
  s('H.btn("Chemical Elements")', 400), s('H.btn("Compound")', 400), s('H.btn("Mineral")', 400), s(run('scanner menu selected'), 300),
  s('H.esc()', 800),
  s('H.nav("Layers")', 1000),
  { click: [900, 500], wait: 4000 }, { click: [905, 505], wait: 4000 }, s(run('scanner windows'), 300, { shot: shot('scanner' + suffix) }),
  s('H.closeLast(); H.closeLast(); H.closeLast(); 1', 800),
  s('H.click("button", s => s === "table_view")', 2500), s(run('layers catalog'), 300, { shot: shot('catalog' + suffix) }), s('H.closeLast()', 1200),
  s('H.click("button", s => s === "search")', 1000),
  s('(() => { const i = [...document.querySelectorAll("input")].filter(H.vis).pop(); if (!i) return "no input"; i.focus(); '
    + 'const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "Tycho"); '
    + 'i.dispatchEvent(new Event("input", { bubbles: true })); return "typed"; })()', 2000),
  s(run('nomenclature search'), 300, { shot: shot('search' + suffix) }), s('H.esc()', 800),
  s(dump, 100),
];

const inspectorSteps = suffix => [
  s(helpers, 200),
  s('H.nav("Features")', 1500), s('H.aria("Draw points")', 800), { click: [990, 380], wait: 3000 }, s('H.aria("Draw points")', 800),
  s(run('features with a point'), 300), s('H.aria("Inspect")', 12000), s(run('inspector point'), 300, { shot: shot('inspector' + suffix) }),
  s(dump, 100),
];

const page = steps => ({ pages: [{ url: 'http://127.0.0.1:5173/', width: 1500, height: 950, waitFor: ready, delay: 6000, steps }] });
for (const [name, build] of [['app', appSteps], ['inspector', inspectorSteps]]) {
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(page(build(''))));
  fs.writeFileSync(path.join(out, name + '-adjusted.json'), JSON.stringify(page([s(overrides, 800), ...build('-adjusted')])));
}
console.log('Plans written to ' + out);
