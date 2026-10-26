// Checks package-lock.json before the dev server or the tests start, so new advisories
// are seen without anyone running a scan. npm audit blocks the launch on a high or
// critical advisory; the OSV database blocks it on a known malicious package (MAL- ids)
// and reports its other advisories. Without network, it warns and lets the launch go on.
// Runs in the launch-check container from the directory holding the package files.
// Node built-ins and npm only. The functions below main() carry the decisions and are
// tested in scripts/tests/check-dependencies.test.cjs.
const { execFileSync } = require('child_process');
const fs = require('fs');

const TIMEOUT_MS = 30000;
const BLOCKING = ['high', 'critical'];

// npm audit --json output to { offline, reason } or { counts, blocking }.
function readAudit(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { offline: true, reason: 'no report from npm audit' };
  }
  if (!report || typeof report !== 'object') return { offline: true, reason: 'no report from npm audit' };
  if (report.error) return { offline: true, reason: report.error.summary || report.error.code || 'registry unreachable' };
  const blocking = Object.entries(report.vulnerabilities ?? {})
    .filter(([, v]) => BLOCKING.includes(v?.severity))
    .map(([name, v]) => `${name} (${v.severity})`);
  return { counts: report.metadata?.vulnerabilities ?? {}, blocking };
}

// Locked packages, deduplicated, as { name, version }.
function lockedPackages(lock) {
  const packages = new Map();
  for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
    if (!key || !entry || entry.link || !entry.version) continue;
    const name = entry.name ?? key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    packages.set(`${name}@${entry.version}`, { name, version: entry.version });
  }
  return [...packages.values()];
}

// OSV querybatch answer, in the order of the queried packages, to
// { offline, reason } or { checked, malicious, affected }.
function readOsv(list, body) {
  if (!body || !Array.isArray(body.results) || body.results.length !== list.length) {
    return { offline: true, reason: 'unexpected OSV answer' };
  }
  const malicious = [];
  const affected = [];
  body.results.forEach((result, i) => {
    const ids = (result?.vulns ?? []).map((v) => v.id);
    const label = `${list[i].name}@${list[i].version}`;
    const mal = ids.filter((id) => id.startsWith('MAL-'));
    if (mal.length) malicious.push(`${label} (${mal.join(', ')})`);
    else if (ids.length) affected.push(`${label} (${ids.join(', ')})`);
  });
  return { checked: list.length, malicious, affected };
}

// Both results to the lines to print and whether the launch stops.
function decide(audit, scan) {
  const out = [];
  const err = [];
  let blocked = false;
  if (audit.offline) {
    out.push(`WARNING npm audit did not run (${audit.reason}); the launch continues unchecked.`);
  } else {
    const c = audit.counts;
    out.push(`npm audit: ${c.critical ?? 0} critical, ${c.high ?? 0} high, ${c.moderate ?? 0} moderate, ${c.low ?? 0} low`);
    if (audit.blocking.length) {
      blocked = true;
      err.push(`BLOCKED  advisories of high or critical severity: ${audit.blocking.join(', ')}`);
    }
  }
  if (scan.offline) {
    out.push(`WARNING OSV query failed (${scan.reason}); the launch continues unchecked.`);
  } else {
    out.push(`OSV: ${scan.checked} packages, ${scan.malicious.length} malicious, ${scan.affected.length} with advisories`);
    out.push(...scan.affected.map((line) => `  advisory  ${line}`));
    if (scan.malicious.length) {
      blocked = true;
      err.push(`BLOCKED  known malicious packages: ${scan.malicious.join(', ')}`);
    }
  }
  if (blocked) {
    err.push('Launch stopped. Fix the dependencies with scripts/deps.sh (README, Dependencies).');
    // Starting with a malicious package installed runs it, so no bypass is offered then.
    if (!scan.malicious?.length) err.push('To start anyway: docker compose up -d --no-deps dev terrain proxy');
  }
  return { blocked, out, err };
}

async function main() {
  let stdout;
  try {
    stdout = execFileSync('npm', ['audit', '--package-lock-only', '--json', '--fetch-retries=1', `--fetch-timeout=${TIMEOUT_MS}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    // npm audit exits 1 when it finds advisories; the report is still on stdout.
    stdout = error.stdout;
  }
  const audit = readAudit(stdout);

  const list = lockedPackages(JSON.parse(fs.readFileSync('package-lock.json', 'utf8')));
  let scan;
  try {
    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: list.map((p) => ({ package: { name: p.name, ecosystem: 'npm' }, version: p.version })) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    scan = response.ok ? readOsv(list, await response.json()) : { offline: true, reason: `HTTP ${response.status}` };
  } catch (error) {
    scan = { offline: true, reason: error.cause?.code ?? error.name };
  }

  const { blocked, out, err } = decide(audit, scan);
  for (const line of out) console.log(line);
  for (const line of err) console.error(line);
  if (blocked) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { readAudit, lockedPackages, readOsv, decide };
