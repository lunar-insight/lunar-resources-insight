// Fails when a security setting of the repository is missing or loosened: npm
// settings, container restrictions, pinned base images, build checks, the scripts
// that run containers or Firefox, and the CSP and headers. Runs in the production
// build; run it on the host after editing the files in FILES. A local pre-edit hook
// also runs it on each proposed edit of those files. Node built-ins only.
//   node scripts/check-hardening.cjs [repository root] [--list]
//   node scripts/check-hardening.cjs --files     prints the files it reads
const fs = require('fs');
const path = require('path');

const FILES = [
  '.npmrc', '.dockerignore', 'Dockerfile', 'Dockerfile.dev', 'Dockerfile.proxy',
  'docker-compose.yml', 'nginx.conf', 'nginx.dev.conf.template', '.vscode/settings.json',
  'scripts/deps.sh', 'scripts/sync-node-modules.sh', 'scripts/osv-scan.sh', 'scripts/open-app.sh',
  'scripts/firefox-bidi/locked.user.js', 'scripts/firefox-bidi/drive.mjs',
];

const args = process.argv.slice(2);
if (args.includes('--files')) {
  console.log(FILES.join('\n'));
  process.exit(0);
}
const list = args.includes('--list');
const root = args.find((a) => !a.startsWith('--')) ?? path.join(__dirname, '..');

const results = [];
const check = (file, rule, ok) => results.push({ file, rule, ok: Boolean(ok) });
const read = (file) => {
  const p = path.join(root, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
};

// --- .npmrc ---
const npmrc = read('.npmrc') ?? '';
// npm applies the last occurrence of a repeated key.
const npmSetting = (key) => [...npmrc.matchAll(new RegExp(`^\\s*${key}\\s*=\\s*(\\S+)`, 'gm'))].at(-1)?.[1];
check('.npmrc', 'ignore-scripts=true', npmSetting('ignore-scripts') === 'true');
check('.npmrc', 'allow-git=none', npmSetting('allow-git') === 'none');
check('.npmrc', 'min-release-age of 7 days or more', Number(npmSetting('min-release-age')) >= 7);
check('.npmrc', 'save-exact=true', npmSetting('save-exact') === 'true');

// --- Dockerfiles ---
const PINNED = /@sha256:[0-9a-f]{64}\b/;
for (const file of ['Dockerfile', 'Dockerfile.dev', 'Dockerfile.proxy']) {
  const text = read(file) ?? '';
  const froms = text.split('\n').filter((l) => /^FROM\s/i.test(l));
  // FROM <earlier stage> names no image.
  const stages = [...text.matchAll(/^FROM\s.+\sAS\s+(\S+)\s*$/gim)].map((m) => m[1].toLowerCase());
  const image = (line) => line.replace(/^FROM\s+(--\S+\s+)*/i, '').split(/\s+/)[0].toLowerCase();
  check(file, 'has a FROM line', froms.length > 0);
  check(file, 'every base image pinned by digest', froms.every((l) => PINNED.test(l) || stages.includes(image(l))));
  check(file, 'no "|| true" hiding a failing step', !text.includes('|| true'));
}
// Environment variables and command-line flags take precedence over .npmrc.
const NPM_OVERRIDE = /npm_config_(ignore_scripts|min_release_age|allow_git|save_exact)|--(ignore-scripts|min-release-age|allow-git)\b/i;
for (const file of ['Dockerfile', 'Dockerfile.dev', 'docker-compose.yml']) {
  check(file, 'does not override the .npmrc settings', !NPM_OVERRIDE.test(read(file) ?? ''));
}
for (const file of ['Dockerfile', 'Dockerfile.dev']) {
  const text = read(file) ?? '';
  check(file, 'RUN npm audit signatures', /^RUN npm audit signatures$/m.test(text));
  check(file, 'RUN npm audit --audit-level=high', /^RUN npm audit --audit-level=high$/m.test(text));
}
const prodDockerfile = read('Dockerfile') ?? '';
check('Dockerfile', 'RUN node scripts/check-dependencies.cjs', /^RUN node scripts\/check-dependencies\.cjs$/m.test(prodDockerfile));
for (const step of [
  'node scripts/check-hardening.cjs',
  'node --test "scripts/tests/*.test.cjs"',
  './node_modules/.bin/vitest run',
  'npm run build',
  'node scripts/check-bundle-hosts.cjs dist',
]) {
  check('Dockerfile', `RUN --network=none ${step}`, prodDockerfile.includes(`RUN --network=none ${step}`));
}

// --- docker-compose.yml ---
// Reads the block under a key by indentation; enough for this file, not general YAML.
function block(text, key, indent) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `${' '.repeat(indent)}${key}:` || l.startsWith(`${' '.repeat(indent)}${key}: `));
  if (start < 0) return null;
  const out = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    const content = line.trim();
    if (content && !content.startsWith('#') && line.length - line.trimStart().length <= indent) break;
    out.push(line);
  }
  return out.join('\n');
}
const compose = read('docker-compose.yml') ?? '';
const services = block(compose, 'services', 0) ?? '';
const anchor = block(compose, 'x-node-app', 0) ?? '';
const service = (name) => {
  const own = block(services, name, 2) ?? '';
  return own.includes('<<: *node-app') ? `${anchor}\n${own}` : own;
};
// A service-level key sits at indent 4, or at indent 2 in the merged anchor; deeper
// lines (a mount's own read_only) do not count.
const serviceKey = (name, pattern) => {
  const own = block(services, name, 2) ?? '';
  const at = (text, indent) => new RegExp(`^ {${indent}}${pattern}$`, 'm').test(text);
  return at(own, 4) || (own.includes('<<: *node-app') && at(anchor, 2));
};
const C = 'docker-compose.yml';
// Comments may name what is forbidden.
const composeCode = compose.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n');
check(C, 'no Docker socket mounted', !composeCode.includes('docker.sock'));
check(C, 'no privileged container', !/privileged:\s*["']?true/.test(composeCode));
check(C, 'network frontend is internal', /internal: true/.test(block(block(compose, 'networks', 0) ?? '', 'frontend', 2) ?? ''));
check(C, 'network terrain-net is internal', /internal: true/.test(block(block(compose, 'networks', 0) ?? '', 'terrain-net', 2) ?? ''));
for (const name of ['launch-check', 'dev', 'test', 'terrain', 'proxy']) {
  const s = service(name);
  check(C, `${name}: defined`, s.length > 0);
  // Flow ([ALL]) and block (- ALL) list styles are equivalent.
  check(C, `${name}: cap_drop [ALL]`, /cap_drop:\s*(\[\s*["']?ALL["']?\s*\]|\n\s+-\s*["']?ALL["']?\s*$)/m.test(s));
  check(C, `${name}: no-new-privileges`, /no-new-privileges(:true)?(?!:)/.test(s) && !/no-new-privileges:false/.test(s));
  check(C, `${name}: read_only root filesystem`, serviceKey(name, 'read_only: true'));
  check(C, `${name}: pids_limit`, /pids_limit: \d+/.test(s));
  check(C, `${name}: mem_limit`, /mem_limit: \S+/.test(s));
}
for (const name of ['launch-check', 'dev', 'test', 'terrain']) {
  check(C, `${name}: runs as user node`, /^\s*user:\s*["']?node["']?\s*$/m.test(service(name)));
}
for (const name of ['dev', 'test']) {
  check(C, `${name}: starts only after launch-check succeeds`,
    /depends_on:\n\s+launch-check:\n\s+condition: service_completed_successfully/.test(block(services, name, 2) ?? ''));
}
check(C, 'launch-check: runs scripts/check-dependencies.cjs', /check-dependencies\.cjs"\]/.test(service('launch-check')));
for (const name of ['launch-check', 'dev', 'test']) {
  const mounts = service(name).split('\n').filter((l) => /^\s*- \.\//.test(l));
  check(C, `${name}: every bind mount of the repository read-only`, mounts.length > 0 && mounts.every((l) => /:ro\s*(#.*)?$/.test(l)));
  check(C, `${name}: does not mount the whole repository`, !/- \.:/.test(service(name)));
}
check(C, 'dev: only on the frontend network', /networks: \[frontend\]/.test(service('dev')));
check(C, 'test: network_mode none', /network_mode: none/.test(service('test')));
check(C, 'terrain: image pinned by digest', PINNED.test(service('terrain')));
check(C, 'proxy: adds only CHOWN, SETUID, SETGID', /cap_add: \[CHOWN, SETUID, SETGID\]/.test(service('proxy')));
const published = (block(service('proxy'), 'ports', 4) ?? '').split('\n').filter((l) => /^\s*- /.test(l));
check(C, 'proxy: every published port bound to 127.0.0.1',
  published.length > 0 && published.every((l) => /^\s*- "127\.0\.0\.1:/.test(l)));
check(C, 'only the proxy publishes ports',
  ['dev', 'test', 'terrain'].every((name) => !/^ {4}ports:/m.test(block(services, name, 2) ?? '')));

// --- .dockerignore ---
const dockerignore = (read('.dockerignore') ?? '').split('\n').map((l) => l.trim());
for (const entry of ['.env', '.env.*', '.git', 'node_modules', '.claude', 'CLAUDE.md']) {
  check('.dockerignore', `excludes ${entry} from the build context`, dockerignore.includes(entry));
}

// --- editor settings ---
const vscode = read('.vscode/settings.json');
if (vscode === null) {
  console.log('skipped .vscode/settings.json (not present; outside the build context)');
} else {
  check('.vscode/settings.json', 'automatic type acquisition off', /"typescript\.disableAutomaticTypeAcquisition":\s*true/.test(vscode));
  check('.vscode/settings.json', 'npm script detection off', /"npm\.autoDetect":\s*"off"/.test(vscode));
}

// --- scripts that start containers or Firefox ---
// A mount flag of docker, not the -v of `command -v`.
const MOUNT = /(?<!command)\s(-v|--volume|--mount)[\s=]/;
const deps = read('scripts/deps.sh') ?? '';
check('scripts/deps.sh', 'container runs as node, no capabilities, no privilege escalation',
  deps.includes('--user node') && deps.includes('--cap-drop ALL') && deps.includes('--security-opt no-new-privileges'));
check('scripts/deps.sh', 'no mounts (files go in and out with docker cp)', !MOUNT.test(deps));
check('scripts/deps.sh', 'no privileged container', !deps.includes('--privileged'));
const sync = read('scripts/sync-node-modules.sh') ?? '';
check('scripts/sync-node-modules.sh', 'copy runs without network', sync.includes('--network none'));
for (const excluded of ['node_modules/.bin', 'node_modules/@parcel/watcher-*', 'node_modules/@rolldown/binding-*', 'node_modules/lightningcss-*']) {
  check('scripts/sync-node-modules.sh', `leaves out ${excluded}`, sync.includes(`--exclude='${excluded}'`));
}
const osvScan = read('scripts/osv-scan.sh') ?? '';
check('scripts/osv-scan.sh', 'scanner image pinned by digest', /^IMAGE=".*@sha256:[0-9a-f]{64}"$/m.test(osvScan));
check('scripts/osv-scan.sh', 'container without capabilities or privilege escalation',
  osvScan.includes('--cap-drop ALL') && osvScan.includes('--security-opt no-new-privileges'));
check('scripts/osv-scan.sh', 'no mounts (the lockfile is copied in)', !MOUNT.test(osvScan));
const openApp = read('scripts/open-app.sh') ?? '';
check('scripts/open-app.sh', 'profile gets locked.user.js as user.js', /cp "\$DIR\/scripts\/firefox-bidi\/locked\.user\.js" "\$PROFILE\/user\.js"/.test(openApp));
check('scripts/open-app.sh', 'separate Firefox instance (--no-remote)', openApp.includes('--no-remote'));
const drive = read('scripts/firefox-bidi/drive.mjs') ?? '';
check('scripts/firefox-bidi/drive.mjs', 'profile gets locked.user.js as user.js', /copyFileSync\(fileURLToPath\(new URL\('locked\.user\.js'/.test(drive));
const userJs = read('scripts/firefox-bidi/locked.user.js') ?? '';
const pref = (name, value) => new RegExp(`^user_pref\\("${name.replace(/\./g, '\\.')}", ${value}\\);$`, 'm').test(userJs);
for (const [name, value] of [
  ['network.proxy.type', '1'], ['network.proxy.http', '"127.0.0.1"'], ['network.proxy.http_port', '9'],
  ['network.proxy.ssl', '"127.0.0.1"'], ['network.proxy.ssl_port', '9'], ['network.proxy.no_proxies_on', '"localhost, 127.0.0.1"'],
  ['media.peerconnection.enabled', 'false'], ['network.dns.disablePrefetch', 'true'], ['network.prefetch-next', 'false'],
  ['network.http.speculative-parallel-limit', '0'], ['network.trr.mode', '5'],
]) {
  check('scripts/firefox-bidi/locked.user.js', `${name} = ${value}`, pref(name, value));
}

// --- nginx: CSP and headers ---
// Splits a config into nested blocks of statements. Comments, quoted strings,
// ${VARIABLES} and Lua code blocks are not read as structure.
function nginxBlocks(text) {
  const top = { head: '', statements: [], children: [] };
  const stack = [top];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '#') {
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end;
    } else if (ch === '"' || ch === "'") {
      const end = text.indexOf(ch, i + 1);
      buf += text.slice(i, end + 1);
      i = end;
    } else if (ch === '$' && text[i + 1] === '{') {
      const end = text.indexOf('}', i);
      buf += text.slice(i, end + 1);
      i = end;
    } else if (ch === '{') {
      const head = buf.trim().replace(/\s+/g, ' ');
      buf = '';
      if (/_by_lua_block$/.test(head)) {
        for (let depth = 1; depth > 0 && i < text.length - 1;) {
          i++;
          if (text[i] === '{') depth++;
          if (text[i] === '}') depth--;
        }
      } else {
        const node = { head, statements: [], children: [] };
        stack.at(-1).children.push(node);
        stack.push(node);
      }
    } else if (ch === '}') {
      stack.pop();
      buf = '';
    } else if (ch === ';') {
      stack.at(-1).statements.push(buf.trim().replace(/\s+/g, ' '));
      buf = '';
    } else {
      buf += ch;
    }
  }
  return top;
}
const headersOf = (node) => node.statements.filter((s) => s.startsWith('add_header ')).map((s) => {
  const m = s.match(/^add_header (\S+) (?:"([^"]*)"|'([^']*)'|(\S+))( always)?$/);
  return m ? { name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4], always: Boolean(m[5]) } : { name: '', value: s, always: false };
});
const locationsOf = (node) => node.children.filter((c) => c.head.startsWith('location '))
  .flatMap((c) => [c, ...locationsOf(c)]);
const has = (headers, name, value) => headers.some((h) => h.name === name && h.value === value && h.always);
const DOCUMENT_HEADERS = ['content-security-policy', 'permissions-policy', 'cross-origin-opener-policy', 'referrer-policy'];

// Header rules shared by both configs; returns every header of every block.
function nginxHeaderRules(file, text) {
  const servers = nginxBlocks(text).children.filter((c) => c.head === 'server');
  check(file, 'has a server block', servers.length > 0);
  const all = [];
  servers.forEach((server, i) => {
    const label = `server ${server.statements.find((s) => s.startsWith('listen '))?.slice(7) ?? i}`;
    const own = headersOf(server);
    all.push(...own);
    check(file, `${label}: server_tokens off`, server.statements.includes('server_tokens off'));
    check(file, `${label}: nosniff on every response`, has(own, 'x-content-type-options', 'nosniff'));
    const locations = locationsOf(server);
    const servesPage = locations.some((l) => headersOf(l).some((h) => h.name === 'content-security-policy'));
    const referrer = has(own, 'referrer-policy', 'no-referrer');
    if (servesPage) check(file, `${label}: Referrer-Policy no-referrer`, referrer);
    for (const location of locations) {
      const headers = headersOf(location);
      all.push(...headers);
      if (!headers.length) continue;
      // A location that sets any header inherits none from the server.
      const where = `${label}, ${location.head}`;
      check(file, `${where}: repeats nosniff`, has(headers, 'x-content-type-options', 'nosniff'));
      if (referrer) check(file, `${where}: repeats Referrer-Policy`, has(headers, 'referrer-policy', 'no-referrer'));
      for (const h of headers.filter((x) => DOCUMENT_HEADERS.includes(x.name))) {
        check(file, `${where}: ${h.name} with "always" (sent on errors too)`, h.always);
      }
    }
  });
  return all;
}
const cspDirectives = (value) => Object.fromEntries(value.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [name, ...sources] = d.split(/\s+/);
  return [name.toLowerCase(), sources];
}));
const only = (sources, allowed) => Array.isArray(sources) && sources.length > 0 && sources.every((s) => allowed.includes(s));
// Every CSP in the file must pass the rule, so a second, weaker one is caught.
const everyCsp = (csps, directive, allowed) => csps.length > 0 && csps.every((c) => only(c[directive], allowed));

const N = 'nginx.conf';
const prodHeaders = nginxHeaderRules(N, read(N) ?? '');
const prodCsps = prodHeaders.filter((h) => h.name === 'content-security-policy').map((h) => cspDirectives(h.value));
const pageLocation = locationsOf(nginxBlocks(read(N) ?? '').children.find((c) => c.head === 'server') ?? { children: [] })
  .find((l) => l.head === 'location /');
check(N, 'location / (the page) sends the CSP', pageLocation && headersOf(pageLocation).some((h) => h.name === 'content-security-policy'));
check(N, "default-src 'self'", everyCsp(prodCsps, 'default-src', ["'self'"]));
check(N, "script-src only 'self' and 'wasm-unsafe-eval' (no eval, no inline, no hosts)", everyCsp(prodCsps, 'script-src', ["'self'", "'wasm-unsafe-eval'"]));
check(N, "connect-src 'self'", everyCsp(prodCsps, 'connect-src', ["'self'"]));
check(N, "worker-src only 'self' and blob:", everyCsp(prodCsps, 'worker-src', ["'self'", 'blob:']));
check(N, "object-src 'none'", everyCsp(prodCsps, 'object-src', ["'none'"]));
check(N, "base-uri 'self'", everyCsp(prodCsps, 'base-uri', ["'self'"]));
check(N, "form-action 'none'", everyCsp(prodCsps, 'form-action', ["'none'"]));
check(N, "frame-ancestors 'none'", everyCsp(prodCsps, 'frame-ancestors', ["'none'"]));
const permissions = prodHeaders.filter((h) => h.name === 'permissions-policy');
for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
  check(N, `Permissions-Policy: ${feature}=()`, permissions.length > 0 && permissions.every((h) => h.value.includes(`${feature}=()`)));
}
check(N, 'Cross-Origin-Opener-Policy same-origin', has(prodHeaders, 'cross-origin-opener-policy', 'same-origin'));

const D = 'nginx.dev.conf.template';
const devNginx = read(D);
if (devNginx === null) {
  console.log(`skipped ${D} (not present; outside the build context)`);
} else {
  const devCsps = nginxHeaderRules(D, devNginx).filter((h) => h.name === 'content-security-policy').map((h) => cspDirectives(h.value));
  check(D, 'connect-src only same origin, the HMR socket and the terrain port',
    everyCsp(devCsps, 'connect-src', ["'self'", 'ws://localhost:5173', 'http://localhost:${TERRAIN_PORT}']));
  check(D, "object-src 'none'", everyCsp(devCsps, 'object-src', ["'none'"]));
  check(D, "form-action 'none'", everyCsp(devCsps, 'form-action', ["'none'"]));
  check(D, "frame-ancestors 'none'", everyCsp(devCsps, 'frame-ancestors', ["'none'"]));
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  if (list || !r.ok) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}: ${r.rule}`);
}
console.log(`${results.length} checks, ${failed.length} failed`);
process.exitCode = failed.length ? 1 : 0;
