// Tests the decisions of scripts/check-dependencies.cjs on fixed npm audit and OSV
// answers, without npm or network. Node built-ins only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readAudit, lockedPackages, readOsv, decide } = require('../check-dependencies.cjs');

const audit = (vulnerabilities, counts = {}) => JSON.stringify({ vulnerabilities, metadata: { vulnerabilities: counts } });
const clean = { counts: { critical: 0, high: 0, moderate: 0, low: 0 }, blocking: [] };
const scanned = (malicious = [], affected = []) => ({ checked: 300, malicious, affected });

test('npm audit: a clean report blocks nothing', () => {
  assert.deepEqual(readAudit(audit({}, { high: 0 })).blocking, []);
});

test('npm audit: high and critical advisories block, moderate and low do not', () => {
  const result = readAudit(audit({
    vite: { severity: 'high' }, dompurify: { severity: 'critical' }, nanoid: { severity: 'moderate' }, chai: { severity: 'low' },
  }));
  assert.deepEqual(result.blocking, ['vite (high)', 'dompurify (critical)']);
});

test('npm audit: an error report (no network) is offline, not clean', () => {
  const result = readAudit(JSON.stringify({ error: { code: 'ENOTFOUND', summary: '' } }));
  assert.equal(result.offline, true);
  assert.equal(result.reason, 'ENOTFOUND');
});

for (const [name, stdout] of [['empty output', ''], ['undefined output', undefined], ['not JSON', 'npm ERR! oops'], ['JSON null', 'null']]) {
  test(`npm audit: ${name} is offline, not clean`, () => {
    assert.equal(readAudit(stdout).offline, true);
  });
}

test('lockfile: skips the root entry, links and entries without a version', () => {
  const list = lockedPackages({ packages: {
    '': { name: 'app', version: '1.0.0' },
    'node_modules/linked': { link: true, resolved: 'packages/linked' },
    'node_modules/bundled': { inBundle: true },
    'node_modules/vite': { version: '8.3.4' },
  } });
  assert.deepEqual(list, [{ name: 'vite', version: '8.3.4' }]);
});

test('lockfile: names nested and scoped packages, and deduplicates', () => {
  const list = lockedPackages({ packages: {
    'node_modules/@cesium/engine': { version: '24.0.0' },
    'node_modules/vite/node_modules/picomatch': { version: '4.0.7' },
    'node_modules/rolldown/node_modules/picomatch': { version: '4.0.7' },
    'node_modules/alias': { name: 'real-name', version: '1.0.0' },
  } });
  assert.deepEqual(list, [
    { name: '@cesium/engine', version: '24.0.0' },
    { name: 'picomatch', version: '4.0.7' },
    { name: 'real-name', version: '1.0.0' },
  ]);
});

test('lockfile: no packages at all', () => {
  assert.deepEqual(lockedPackages({}), []);
  assert.deepEqual(lockedPackages(null), []);
});

const list = [{ name: 'a', version: '1.0.0' }, { name: 'b', version: '2.0.0' }, { name: 'c', version: '3.0.0' }];

test('OSV: a MAL- id makes a package malicious, even with other advisories', () => {
  const result = readOsv(list, { results: [{ vulns: [{ id: 'GHSA-x' }, { id: 'MAL-2025-1' }] }, {}, {}] });
  assert.deepEqual(result.malicious, ['a@1.0.0 (MAL-2025-1)']);
  assert.deepEqual(result.affected, []);
});

test('OSV: other advisories are reported, not malicious', () => {
  const result = readOsv(list, { results: [{}, { vulns: [{ id: 'GHSA-y' }] }, { vulns: [] }] });
  assert.deepEqual(result.malicious, []);
  assert.deepEqual(result.affected, ['b@2.0.0 (GHSA-y)']);
});

for (const [name, body] of [
  ['no body', null],
  ['no results', {}],
  ['fewer results than packages', { results: [{}] }],
  ['results not a list', { results: 'oops' }],
]) {
  test(`OSV: ${name} is offline, not clean`, () => {
    assert.equal(readOsv(list, body).offline, true);
  });
}

test('decide: clean on both sides starts the launch', () => {
  const result = decide(clean, scanned());
  assert.equal(result.blocked, false);
  assert.deepEqual(result.err, []);
});

test('decide: a high advisory stops the launch and offers the bypass', () => {
  const result = decide({ ...clean, blocking: ['vite (high)'] }, scanned());
  assert.equal(result.blocked, true);
  assert.ok(result.err.some((l) => l.includes('vite (high)')));
  assert.ok(result.err.some((l) => l.includes('--no-deps')));
});

test('decide: a malicious package stops the launch with no bypass', () => {
  const result = decide(clean, scanned(['flatmap-stream@0.1.1 (MAL-2025-20690)']));
  assert.equal(result.blocked, true);
  assert.ok(result.err.some((l) => l.includes('MAL-2025-20690')));
  assert.ok(!result.err.some((l) => l.includes('--no-deps')));
});

test('decide: no bypass when npm audit is offline but OSV finds a malicious package', () => {
  const result = decide({ offline: true, reason: 'ENOTFOUND' }, scanned(['x@1 (MAL-1)']));
  assert.equal(result.blocked, true);
  assert.ok(!result.err.some((l) => l.includes('--no-deps')));
});

test('decide: offline on both sides warns and starts the launch', () => {
  const result = decide({ offline: true, reason: 'ENOTFOUND' }, { offline: true, reason: 'EAI_AGAIN' });
  assert.equal(result.blocked, false);
  assert.equal(result.out.filter((l) => l.startsWith('WARNING')).length, 2);
});

test('decide: advisories reported by OSV alone do not stop the launch', () => {
  const result = decide(clean, scanned([], ['b@2.0.0 (GHSA-y)']));
  assert.equal(result.blocked, false);
  assert.ok(result.out.some((l) => l.includes('advisory  b@2.0.0')));
});
