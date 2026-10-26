// Compares two package-lock.json files: added, changed and removed packages, plus
// entries in the second file resolved from a host other than registry.npmjs.org or
// without an integrity hash. Node built-ins only.
//   git show HEAD:package-lock.json > old.json
//   node scripts/lockdiff.cjs old.json package-lock.json
const fs = require('fs');

const [fileA, fileB] = process.argv.slice(2);
if (!fileA || !fileB) {
  console.error('usage: node scripts/lockdiff.cjs <old-lockfile> <new-lockfile>');
  process.exit(2);
}
const [a, b] = [fileA, fileB].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')).packages);
const name = (k) => k.replace(/^node_modules\//, '');

for (const k of Object.keys(b)) {
  if (!k) continue;
  if (!a[k]) console.log('added  ', name(k), b[k].version);
  else if (a[k].version !== b[k].version) console.log('changed', name(k), a[k].version, '->', b[k].version);
}
for (const k of Object.keys(a)) if (k && !b[k]) console.log('removed', name(k), a[k].version);

let flagged = 0;
for (const [k, entry] of Object.entries(b)) {
  // Workspace links and the root entry have no tarball.
  if (!k || entry.link) continue;
  if (!entry.resolved || new URL(entry.resolved).host !== 'registry.npmjs.org') {
    console.log('HOST   ', name(k), entry.resolved ?? '(no resolved)');
    flagged++;
  }
  if (!entry.integrity) {
    console.log('NO-HASH', name(k));
    flagged++;
  }
}
process.exitCode = flagged ? 1 : 0;
