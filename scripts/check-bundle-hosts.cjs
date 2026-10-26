// Lists every http(s) host written in the code files of the build output and fails
// on a host missing from bundle-hosts.txt. Catches hard-coded endpoints; a URL
// assembled or encoded at runtime is not caught. Data files (STAC catalog, font
// notices) and source maps are not scanned: they do not run. Node built-ins only.
//   node scripts/check-bundle-hosts.cjs dist [--list]
const fs = require('fs');
const path = require('path');

const ALLOWED = new Set(
  fs.readFileSync(path.join(__dirname, 'bundle-hosts.txt'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

const TEXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html']);
const URL_PATTERN = /https?:\/\/([a-z0-9.-]+)/gi;

const [dir, flag] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/check-bundle-hosts.cjs <dist> [--list]');
  process.exit(2);
}

const hosts = new Map();
for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !TEXT.has(path.extname(entry.name).toLowerCase())) continue;
  const file = path.join(entry.parentPath, entry.name);
  for (const [, host] of fs.readFileSync(file, 'utf8').matchAll(URL_PATTERN)) {
    const name = host.toLowerCase().replace(/\.$/, '');
    if (!hosts.has(name)) hosts.set(name, new Set());
    hosts.get(name).add(path.relative(dir, file));
  }
}

let unknown = 0;
for (const [host, files] of [...hosts].sort()) {
  const known = ALLOWED.has(host);
  if (!known) unknown++;
  if (flag === '--list' || !known) {
    console.log(`${known ? 'allowed' : 'UNKNOWN'} ${host}  (${[...files].slice(0, 3).join(', ')}${files.size > 3 ? ', ...' : ''})`);
  }
}
console.log(`${hosts.size} hosts, ${unknown} not allowed`);
process.exitCode = unknown ? 1 : 0;
