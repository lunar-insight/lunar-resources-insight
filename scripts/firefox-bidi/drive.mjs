// Controls a headless Firefox over WebDriver BiDi. A JSON plan lists the pages
// to open and, for each, what to wait for, what to run and click, and when to
// take a screenshot. README.md describes the plan.
//
//   node scripts/firefox-bidi/drive.mjs <plan.json>
//
// Firefox starts from FIREFOX_PATH, or from its default install location.
// Needs Node 22 or later, which has WebSocket built in.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DEFAULT_FIREFOX = process.platform === 'win32'
  ? 'C:/Program Files/Mozilla Firefox/firefox.exe'
  : 'firefox';

const CONNECT_ATTEMPTS = 40;
const CONNECT_INTERVAL_MS = 500;
const DEFAULT_WAIT_FOR_TIMEOUT_MS = 60000;
const DEFAULT_STEP_WAIT_MS = 700;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const planPath = process.argv[2];
if (!planPath) {
  console.error('Usage: node scripts/firefox-bidi/drive.mjs <plan.json>');
  process.exit(2);
}
const plan = JSON.parse(readFileSync(planPath, 'utf8'));

// A random port and a new profile, so an open Firefox or a profile left by a
// crashed run does not get in the way.
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(path.join(tmpdir(), 'firefox-bidi-'));
const firefox = spawn(
  process.env.FIREFOX_PATH ?? DEFAULT_FIREFOX,
  ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port)],
  { stdio: 'ignore' },
);

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
    socket.onopen = () => resolve(socket);
    socket.onerror = reject;
  });
}

let socket;
for (let attempt = 0; attempt < CONNECT_ATTEMPTS && !socket; attempt++) {
  await sleep(CONNECT_INTERVAL_MS);
  socket = await connect().catch(() => undefined);
}

let commandId = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

let failed = false;
try {
  if (!socket) throw new Error(`No BiDi connection on port ${port}`);

  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.type === 'error') request.reject(new Error(`${request.method}: ${message.error}: ${message.message}`));
    else request.resolve(message.result);
  };

  await send('session.new', { capabilities: {} });
  // Pages open in a new tab. The session's first tab is the browser's own
  // interface, which scripts cannot reach.
  const { context } = await send('browsingContext.create', { type: 'tab' });

  const evaluate = async expression => {
    const { result, exceptionDetails } = await send('script.evaluate', {
      expression, target: { context }, awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(`Script failed: ${exceptionDetails.text}`);
    return result;
  };

  const screenshot = async file => {
    const { data } = await send('browsingContext.captureScreenshot', { context });
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`  saved ${file}`);
  };

  const click = ([x, y]) => send('input.performActions', {
    context,
    actions: [{
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', x, y },
        { type: 'pause', duration: 100 },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 80 },
        { type: 'pointerUp', button: 0 },
      ],
    }],
  });

  for (const page of plan.pages) {
    console.log(page.url);
    await send('browsingContext.setViewport', {
      context, viewport: { width: page.width ?? 1400, height: page.height ?? 900 },
    });
    await send('browsingContext.navigate', { context, url: page.url, wait: 'complete' });

    if (page.waitFor) {
      const timeout = page.waitForTimeout ?? DEFAULT_WAIT_FOR_TIMEOUT_MS;
      const met = await evaluate(`new Promise(resolve => {
        const start = Date.now();
        const timer = setInterval(() => {
          let value = false;
          try { value = !!(${page.waitFor}); } catch {}
          if (value || Date.now() - start > ${timeout}) { clearInterval(timer); resolve(value); }
        }, 200);
      })`);
      if (!met.value) throw new Error(`Timed out waiting for: ${page.waitFor}`);
    }
    if (page.delay) await sleep(page.delay);

    // Text stays invisible until its font loads.
    await evaluate('document.fonts.ready.then(() => true)');

    for (const step of page.steps ?? []) {
      if (step.click) await click(step.click);
      if (step.js) {
        const result = await evaluate(step.js);
        console.log(`  js: ${JSON.stringify(result.value ?? null)}`);
      }
      await sleep(step.wait ?? DEFAULT_STEP_WAIT_MS);
      if (step.shot) await screenshot(step.shot);
    }
    if (page.shot) await screenshot(page.shot);
  }

  await send('session.end', {}).catch(() => {});
} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  socket?.close();
  firefox.kill();
  // Firefox locks the profile until it has exited.
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

process.exit(failed ? 1 : 0);
