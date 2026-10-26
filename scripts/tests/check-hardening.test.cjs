// Tests scripts/check-hardening.cjs on copies of the repository files: each loosened
// copy must fail with the named rule, and each equivalent rewrite must still pass.
// A case whose file is absent (the dev nginx template and the editor settings in the
// Docker build context) is skipped. Node built-ins only.
//   node --test "scripts/tests/*.test.cjs"
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.join(__dirname, '..', '..');
const checker = path.join(repo, 'scripts', 'check-hardening.cjs');
const files = execFileSync(process.execPath, [checker, '--files'], { encoding: 'utf8' }).trim().split('\n');

function copyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-hardening-test-'));
  for (const file of files) {
    const from = path.join(repo, file);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(from, path.join(dir, file));
  }
  return dir;
}

function failures(dir) {
  try {
    execFileSync(process.execPath, [checker, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return [];
  } catch (error) {
    return error.stdout.split('\n').filter((l) => l.startsWith('FAIL ')).map((l) => l.slice(5));
  }
}

// Runs the check after one change; returns the failures, or null when the file is absent.
function afterChange(file, change) {
  const dir = copyRepo();
  try {
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) return null;
    const before = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    const after = change(before);
    assert.notEqual(after, before, `the change to ${file} did not apply; update the test`);
    fs.writeFileSync(target, after);
    return failures(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the repository passes', () => {
  const dir = copyRepo();
  try {
    assert.deepEqual(failures(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Windows line endings still pass', () => {
  const dir = copyRepo();
  try {
    for (const file of files) {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
    }
    assert.deepEqual(failures(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const SPA = '    # SPA fallback';
const loosened = [
  // npm settings
  ['install scripts enabled', '.npmrc', (s) => s.replace('ignore-scripts=true', 'ignore-scripts=false'), '.npmrc: ignore-scripts=true'],
  ['a later duplicate re-enables install scripts', '.npmrc', (s) => `${s}ignore-scripts=false\n`, '.npmrc: ignore-scripts=true'],
  ['release age lowered', '.npmrc', (s) => s.replace('min-release-age=7', 'min-release-age=3'), 'min-release-age of 7 days or more'],
  ['git dependencies allowed', '.npmrc', (s) => s.replace('allow-git=none', 'allow-git=all'), 'allow-git=none'],
  ['ranges saved', '.npmrc', (s) => s.replace('save-exact=true', 'save-exact=false'), 'save-exact=true'],
  ['npm ci re-enables install scripts by flag', 'Dockerfile', (s) => s.replace('RUN npm ci', 'RUN npm ci --ignore-scripts=false'), 'Dockerfile: does not override the .npmrc settings'],
  ['install scripts re-enabled by environment', 'Dockerfile.dev', (s) => s.replace('WORKDIR /app', 'WORKDIR /app\nENV npm_config_ignore_scripts=false'), 'Dockerfile.dev: does not override the .npmrc settings'],
  ['release age disabled by environment', 'docker-compose.yml', (s) => s.replace('      - npm_config_cache=/tmp/npm-cache', '      - npm_config_cache=/tmp/npm-cache\n      - NPM_CONFIG_MIN_RELEASE_AGE=0'), 'docker-compose.yml: does not override the .npmrc settings'],
  // Dockerfiles
  ['dev base image unpinned', 'Dockerfile.dev', (s) => s.replace(/^FROM .*$/m, 'FROM node:24-alpine'), 'Dockerfile.dev: every base image pinned by digest'],
  ['proxy base image unpinned', 'Dockerfile.proxy', (s) => s.replace(/^FROM .*$/m, 'FROM openresty/openresty:alpine'), 'Dockerfile.proxy: every base image pinned by digest'],
  ['audit made non-blocking', 'Dockerfile.dev', (s) => s.replace('RUN npm audit --audit-level=high', 'RUN npm audit --audit-level=high || true'), 'no "|| true" hiding a failing step'],
  ['signature check removed', 'Dockerfile', (s) => s.replace('RUN npm audit signatures\n', ''), 'Dockerfile: RUN npm audit signatures'],
  ['dependency check removed from the prod build', 'Dockerfile', (s) => s.replace('RUN node scripts/check-dependencies.cjs\n', ''), 'RUN node scripts/check-dependencies.cjs'],
  ['hardening check removed from the prod build', 'Dockerfile', (s) => s.replace('RUN --network=none node scripts/check-hardening.cjs\n', ''), 'RUN --network=none node scripts/check-hardening.cjs'],
  ['guard tests removed from the prod build', 'Dockerfile', (s) => s.replace('RUN --network=none node --test "scripts/tests/*.test.cjs"\n', ''), 'RUN --network=none node --test'],
  ['app tests removed from the prod build', 'Dockerfile', (s) => s.replace('RUN --network=none ./node_modules/.bin/vitest run\n', ''), 'RUN --network=none ./node_modules/.bin/vitest run'],
  ['bundle host check removed', 'Dockerfile', (s) => s.replace('RUN --network=none node scripts/check-bundle-hosts.cjs dist\n', ''), 'check-bundle-hosts.cjs dist'],
  // docker-compose.yml
  ['dev and test lose the read-only root', 'docker-compose.yml', (s) => s.replace('  read_only: true\n  tmpfs: [/tmp]\n  pids_limit: 512', '  tmpfs: [/tmp]\n  pids_limit: 512'), 'dev: read_only root filesystem'],
  ['proxy loses the read-only root', 'docker-compose.yml', (s) => s.replace('    read_only: true\n    pids_limit: 128\n    mem_limit: 512m\n    environment', '    pids_limit: 128\n    mem_limit: 512m\n    environment'), 'proxy: read_only root filesystem'],
  ['dev and test keep their capabilities', 'docker-compose.yml', (s) => s.replace('  cap_drop: [ALL]\n  security_opt', '  security_opt'), 'dev: cap_drop [ALL]'],
  ['privilege escalation allowed', 'docker-compose.yml', (s) => s.replace('no-new-privileges:true', 'no-new-privileges:false'), 'dev: no-new-privileges'],
  ['a privileged container', 'docker-compose.yml', (s) => s.replace('    networks: [terrain-net]\n', '    networks: [terrain-net]\n    privileged: true\n'), 'no privileged container'],
  ['Docker socket mounted', 'docker-compose.yml', (s) => s.replace('      - tiler-cache:/var/cache/nginx', '      - tiler-cache:/var/cache/nginx\n      - /var/run/docker.sock:/var/run/docker.sock'), 'no Docker socket mounted'],
  ['test gets a network', 'docker-compose.yml', (s) => s.replace('    network_mode: none\n', ''), 'test: network_mode none'],
  ['dev mount writable', 'docker-compose.yml', (s) => s.replace('- ./src:/app/src:ro\n      - ./public', '- ./src:/app/src\n      - ./public'), 'dev: every bind mount of the repository read-only'],
  ['whole repository mounted', 'docker-compose.yml', (s) => s.replace('      - ./src:/app/src:ro\n      - ./public:/app/public:ro\n      - ./index.html', '      - .:/app:ro\n      - ./index.html'), 'dev: does not mount the whole repository'],
  ['dev no longer waits for the launch check', 'docker-compose.yml', (s) => s.replace('  dev:\n    <<: *node-app\n    depends_on:\n      launch-check:\n        condition: service_completed_successfully\n', '  dev:\n    <<: *node-app\n'), 'dev: starts only after launch-check succeeds'],
  ['launch check replaced by a no-op', 'docker-compose.yml', (s) => s.replace('entrypoint: ["node", "/check/check-dependencies.cjs"]', 'entrypoint: ["true"]'), 'launch-check: runs scripts/check-dependencies.cjs'],
  ['launch check mount writable', 'docker-compose.yml', (s) => s.replace('./package-lock.json:/check/package-lock.json:ro', './package-lock.json:/check/package-lock.json'), 'launch-check: every bind mount of the repository read-only'],
  ['port open to the network', 'docker-compose.yml', (s) => s.replace('"127.0.0.1:5173:5173"', '"5173:5173"'), 'proxy: every published port bound to 127.0.0.1'],
  ['dev publishes a port', 'docker-compose.yml', (s) => s.replace('    mem_limit: 2g\n', '    mem_limit: 2g\n    ports: ["9229:9229"]\n'), 'only the proxy publishes ports'],
  ['proxy gains a capability', 'docker-compose.yml', (s) => s.replace('cap_add: [CHOWN, SETUID, SETGID]', 'cap_add: [CHOWN, SETUID, SETGID, NET_ADMIN]'), 'proxy: adds only CHOWN, SETUID, SETGID'],
  ['terrain image unpinned', 'docker-compose.yml', (s) => s.replace(/image: node:24\.22\.0-alpine@sha256:[0-9a-f]+/, 'image: node:24-alpine'), 'terrain: image pinned by digest'],
  ['frontend network gets internet', 'docker-compose.yml', (s) => s.replace('  frontend:\n    internal: true\n', '  frontend:\n'), 'network frontend is internal'],
  // build context and editor
  ['private files sent to the build', '.dockerignore', (s) => s.replace('.claude\n', ''), 'excludes .claude from the build context'],
  ['.env sent to the build', '.dockerignore', (s) => s.replace(/^\.env$\n/m, ''), 'excludes .env from the build context'],
  ['editor downloads type packages', '.vscode/settings.json', (s) => s.replace('"typescript.disableAutomaticTypeAcquisition": true', '"typescript.disableAutomaticTypeAcquisition": false'), 'automatic type acquisition off'],
  // scripts
  ['deps.sh mounts a host folder', 'scripts/deps.sh', (s) => s.replace('--network "$NET"', '--network "$NET" -v "$HOME:/home"'), 'scripts/deps.sh: no mounts'],
  ['deps.sh privileged', 'scripts/deps.sh', (s) => s.replace('--cap-drop ALL', '--cap-drop ALL --privileged'), 'scripts/deps.sh: no privileged container'],
  ['deps.sh keeps capabilities', 'scripts/deps.sh', (s) => s.replace('--cap-drop ALL ', ''), 'scripts/deps.sh: container runs as node'],
  ['node_modules copy with network', 'scripts/sync-node-modules.sh', (s) => s.replace('--network none ', ''), 'copy runs without network'],
  ['node_modules copy keeps .bin', 'scripts/sync-node-modules.sh', (s) => s.replace("  --exclude='node_modules/.bin' \\\n", ''), 'leaves out node_modules/.bin'],
  ['OSV image unpinned', 'scripts/osv-scan.sh', (s) => s.replace(/@sha256:[0-9a-f]{64}"/, '"'), 'scanner image pinned by digest'],
  ['Firefox without the locked prefs', 'scripts/open-app.sh', (s) => s.replace(/^cp .*user\.js"$\n/m, ''), 'open-app.sh: profile gets locked.user.js'],
  ['driver without the locked prefs', 'scripts/firefox-bidi/drive.mjs', (s) => s.replace(/^copyFileSync\(fileURLToPath.*\n/m, ''), 'drive.mjs: profile gets locked.user.js'],
  ['prefs: proxy port changed', 'scripts/firefox-bidi/locked.user.js', (s) => s.replace('"network.proxy.http_port", 9', '"network.proxy.http_port", 8080'), 'network.proxy.http_port = 9'],
  ['prefs: WebRTC on', 'scripts/firefox-bidi/locked.user.js', (s) => s.replace('"media.peerconnection.enabled", false', '"media.peerconnection.enabled", true'), 'media.peerconnection.enabled = false'],
  ['prefs: DNS over HTTPS on', 'scripts/firefox-bidi/locked.user.js', (s) => s.replace('"network.trr.mode", 5', '"network.trr.mode", 2'), 'network.trr.mode = 5'],
  // production nginx
  ['prod CSP allows eval', 'nginx.conf', (s) => s.replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'"), "script-src only 'self' and 'wasm-unsafe-eval'"],
  ['prod CSP allows inline scripts', 'nginx.conf', (s) => s.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"), "script-src only 'self' and 'wasm-unsafe-eval'"],
  ['prod CSP connects to another host', 'nginx.conf', (s) => s.replace("connect-src 'self';", "connect-src 'self' https://evil.example;"), "connect-src 'self'"],
  ['prod CSP allows frames from anywhere', 'nginx.conf', (s) => s.replace("frame-ancestors 'none'", 'frame-ancestors *'), "frame-ancestors 'none'"],
  ['prod CSP loses form-action', 'nginx.conf', (s) => s.replace(" form-action 'none';", ''), "form-action 'none'"],
  ['a second, weaker CSP in a new location', 'nginx.conf', (s) => s.replace(SPA, `    location /legacy/ {\n        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval'" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header Referrer-Policy "no-referrer" always;\n    }\n\n${SPA}`), "script-src only 'self' and 'wasm-unsafe-eval'"],
  ['the page loses its CSP', 'nginx.conf', (s) => s.replace(/^\s*add_header Content-Security-Policy .*\n/m, ''), 'location / (the page) sends the CSP'],
  ['CSP not sent on errors', 'nginx.conf', (s) => s.replace("frame-ancestors 'none';\" always;", "frame-ancestors 'none';\";"), 'content-security-policy with "always"'],
  ['Permissions-Policy allows the camera', 'nginx.conf', (s) => s.replace('camera=(), ', ''), 'Permissions-Policy: camera=()'],
  ['opener policy removed', 'nginx.conf', (s) => s.replace(/^\s*add_header Cross-Origin-Opener-Policy .*\n/m, ''), 'Cross-Origin-Opener-Policy same-origin'],
  ['server version shown', 'nginx.conf', (s) => s.replace('    server_tokens off;\n', ''), 'server 80: server_tokens off'],
  ['nosniff missing at server level', 'nginx.conf', (s) => s.replace('\n    add_header X-Content-Type-Options "nosniff" always;\n', '\n'), 'server 80: nosniff on every response'],
  ['Referrer-Policy missing at server level', 'nginx.conf', (s) => s.replace('\n    add_header Referrer-Policy "no-referrer" always;\n', '\n'), 'server 80: Referrer-Policy no-referrer'],
  ['a location drops nosniff', 'nginx.conf', (s) => s.replace('        add_header Cache-Control "public, immutable";\n        add_header X-Content-Type-Options "nosniff" always;\n', '        add_header Cache-Control "public, immutable";\n'), 'location /cesiumStatic/: repeats nosniff'],
  ['a new location sets only a cache header', 'nginx.conf', (s) => s.replace(SPA, `    location /downloads/ {\n        add_header Cache-Control "no-store";\n    }\n\n${SPA}`), 'location /downloads/: repeats nosniff'],
  // development nginx
  ['dev CSP allows any websocket', 'nginx.dev.conf.template', (s) => s.replace('ws://localhost:5173', 'ws:'), 'connect-src only same origin, the HMR socket and the terrain port'],
  ['dev server version shown', 'nginx.dev.conf.template', (s) => s.replace('    server_tokens off;\n', ''), 'server 5173: server_tokens off'],
  ['dev page loses nosniff', 'nginx.dev.conf.template', (s) => s.replace(/(frame-ancestors 'none';" always;\n)\s*add_header X-Content-Type-Options "nosniff" always;\n/, '$1'), 'server 5173, location /: repeats nosniff'],
];

for (const [name, file, change, rule] of loosened) {
  test(`caught: ${name}`, (t) => {
    const failed = afterChange(file, change);
    if (failed === null) return t.skip(`${file} is not present`);
    assert.ok(failed.some((f) => f.includes(rule)), `expected a failure containing "${rule}", got: ${failed.join(' | ') || 'none'}`);
  });
}

const equivalent = [
  ['spaces around = in .npmrc', '.npmrc', (s) => s.replace('ignore-scripts=true', 'ignore-scripts = true')],
  ['an earlier duplicate overridden by a later correct value', '.npmrc', (s) => `ignore-scripts=false\n${s}`],
  ['a comment naming the Docker socket and privileged mode', 'docker-compose.yml', (s) => `# Never mount /var/run/docker.sock; never set privileged: true.\n${s}`],
  ['cap_drop as a block list', 'docker-compose.yml', (s) => s.replace('    cap_drop: [ALL]\n', '    cap_drop:\n      - ALL\n')],
  ['security_opt as a block list', 'docker-compose.yml', (s) => s.replace('    security_opt: [no-new-privileges:true]\n    read_only: true\n    tmpfs: [/tmp]\n    pids_limit: 128', '    security_opt:\n      - no-new-privileges:true\n    read_only: true\n    tmpfs: [/tmp]\n    pids_limit: 128')],
  ['user without quotes', 'docker-compose.yml', (s) => s.replace('    user: "node"\n', '    user: node\n')],
  ['a build stage based on an earlier stage', 'Dockerfile', (s) => `${s}\nFROM builder AS inspect\n`],
  ['a commented-out weaker CSP in nginx', 'nginx.conf', (s) => s.replace(SPA, `    # add_header Content-Security-Policy "script-src 'unsafe-eval'";\n${SPA}`)],
  ['a new location without headers (inherits the server ones)', 'nginx.conf', (s) => s.replace(SPA, `    location = /robots.txt {\n        return 200 "User-agent: *\\n";\n    }\n\n${SPA}`)],
];

for (const [name, file, change] of equivalent) {
  test(`still passes: ${name}`, (t) => {
    const failed = afterChange(file, change);
    if (failed === null) return t.skip(`${file} is not present`);
    assert.deepEqual(failed, []);
  });
}
