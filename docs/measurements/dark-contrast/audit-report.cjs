// Groups the failures of an audit run by component, color and requirement.
//
//   node docs/measurements/dark-contrast/audit-report.cjs <driver output> [fail|disabled|over image]
//
// The driver output is what drive.mjs printed for a plan from audit-plans.cjs; its last step prints
// the non-passing rows as JSON. A row's component is the last two elements of its path, with the
// CSS module hashes removed.

const fs = require('fs');

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(l => l.startsWith('  js: "['));
if (!lines.length) {
  console.error('No audit dump in ' + process.argv[2]);
  process.exit(1);
}
const rows = JSON.parse(JSON.parse(lines.pop().slice(6)));
const only = process.argv[3];

const groups = new Map();
for (const r of rows) {
  if (only && r.status !== only) continue;
  const comp = r.path.split(' > ').slice(-2)
    .map(x => x.replace(/-module__/g, ':').replace(/--[\w-]{5}(?=\.|$)/g, '').replace(/material-symbols-outlined\.?/, 'icon.'))
    .join(' > ');
  const key = [r.status, comp, r.color, r.need].join('|');
  const g = groups.get(key) || { ...r, comp, min: Infinity, texts: new Set(), labels: new Set() };
  g.min = Math.min(g.min, r.ratio ?? Infinity);
  g.texts.add(r.text);
  g.labels.add(r.label);
  groups.set(key, g);
}

const sorted = [...groups.values()].sort((a, b) => a.status.localeCompare(b.status) || a.min - b.min);
for (const g of sorted) {
  const texts = [...g.texts].slice(0, 3).join(', ').slice(0, 60) + (g.texts.size > 3 ? `, +${g.texts.size - 3}` : '');
  const labels = [...g.labels][0] + (g.labels.size > 1 ? ` +${g.labels.size - 1}` : '');
  console.log(`${g.status.padEnd(10)} ${String(g.min === Infinity ? '-' : g.min).padEnd(5)} ${g.need} ${String(g.color).padEnd(13)} `
    + `bg ${String(g.seenBg).padEnd(8)} ${g.comp}  [${texts}]  (${labels})`);
}
console.log(sorted.length + ' groups');
