// Controls a headless Firefox over WebDriver BiDi. A JSON plan lists the pages
// to open and, for each, what to wait for, what to run and click, and when to
// take a screenshot. README.md describes the plan.
//
//   node scripts/firefox-bidi/drive.mjs <plan.json>
//
// Firefox starts from FIREFOX_PATH, or from its default install location, with
// the prefs in locked.user.js. Needs Node 22 or later, which has WebSocket built in.

import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// A new profile, so an open Firefox or a profile left by a crashed run does not
// get in the way. Port 0 lets Firefox pick a free port, which it writes to
// WebDriverBiDiServer.json in the profile; Windows reserves port ranges that
// change between reboots.
const profile = mkdtempSync(path.join(tmpdir(), 'firefox-bidi-'));
copyFileSync(fileURLToPath(new URL('locked.user.js', import.meta.url)), path.join(profile, 'user.js'));
const firefox = spawn(
  process.env.FIREFOX_PATH ?? DEFAULT_FIREFOX,
  ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', '0'],
  { stdio: 'ignore' },
);
const firefoxExited = new Promise(resolve => firefox.once('exit', resolve));

function readPort() {
  try {
    return JSON.parse(readFileSync(path.join(profile, 'WebDriverBiDiServer.json'), 'utf8')).ws_port;
  } catch {
    return undefined;
  }
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
    socket.onopen = () => resolve(socket);
    socket.onerror = reject;
  });
}

let socket;
for (let attempt = 0; attempt < CONNECT_ATTEMPTS && !socket; attempt++) {
  await sleep(CONNECT_INTERVAL_MS);
  const port = readPort();
  if (port) socket = await connect(port).catch(() => undefined);
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
  if (!socket) throw new Error('No BiDi connection to Firefox');

  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    // Errors the page logs or throws, printed as they arrive.
    if (message.method === 'log.entryAdded' && message.params.level === 'error') {
      console.log(`  page error: ${message.params.text}`);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.type === 'error') request.reject(new Error(`${request.method}: ${message.error}: ${message.message}`));
    else request.resolve(message.result);
  };

  await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
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

  // Button 0 is the left button, 2 the right.
  const click = ([x, y], button = 0) => send('input.performActions', {
    context,
    actions: [{
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', x, y },
        { type: 'pause', duration: 100 },
        { type: 'pointerDown', button },
        { type: 'pause', duration: 80 },
        { type: 'pointerUp', button },
      ],
    }],
  });

  // Moves the mouse to [x, y] without a click, over the given milliseconds.
  const move = ([x, y, duration = 0]) => send('input.performActions', {
    context,
    actions: [{
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [{ type: 'pointerMove', x, y, duration }],
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
      if (step.rightClick) await click(step.rightClick, 2);
      if (step.move) await move(step.move);
      if (step.js) {
        const result = await evaluate(step.js);
        console.log(`  js: ${JSON.stringify(result.value ?? null)}`);
      }
      await sleep(step.wait ?? DEFAULT_STEP_WAIT_MS);
      if (step.shot) await screenshot(step.shot);
    }
    if (page.shot) await screenshot(page.shot);
  }

} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  // browser.close ends every Firefox process. The spawned process is only the
  // launcher on Windows, so kill() is the fallback when there is no session.
  if (socket) await Promise.race([send('browser.close', {}).catch(() => {}), sleep(3000)]);
  socket?.close();
  const exited = await Promise.race([firefoxExited.then(() => true), sleep(10000).then(() => false)]);
  if (!exited) firefox.kill();
  // Firefox locks the profile until it has exited.
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

process.exit(failed ? 1 : 0);
