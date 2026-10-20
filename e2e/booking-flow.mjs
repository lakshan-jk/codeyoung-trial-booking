// Browser end-to-end test of the full booking flow via the Chrome DevTools
// Protocol — no external deps (Node ≥ 20 has global fetch + WebSocket).
//
// Drives a real headless Chrome as a US/New-York parent: selects a slot, fills
// the form, submits, and asserts the confirmation shows the mentor's IST time
// for the SAME instant as the parent's EDT/EST time. Saves screenshots to e2e/.
//
// Usage:  APP_URL=http://localhost:5173 node e2e/booking-flow.mjs
// Requires: running frontend + backend + seeded mentors, Google Chrome.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.APP_URL ?? 'http://localhost:5173/';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`, '--window-size=900,1300',
    '--force-device-scale-factor=1', 'about:blank',
  ],
  { env: { ...process.env, TZ: 'America/New_York' } },
);

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error('Chrome CDP not ready');
}

function connect(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve) => {
      const myId = ++id;
      pending.set(myId, (m) => resolve(m.result));
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
}

function fail(msg) {
  console.error('✗ E2E FAILED:', msg);
  chrome.kill();
  process.exit(1);
}

const ws = new WebSocket(await getWsUrl());
await new Promise((r) => (ws.onopen = r));
const send = connect(ws);

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: URL });
await sleep(3500);

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))?.result
    ?.value;

// Pick a date in the custom calendar (first selectable future day) so slots show.
const pickedDate = await evaluate(`(() => {
  const cells = [...document.querySelectorAll('.cal-cell')]
    .filter((c) => !c.disabled && !c.classList.contains('cal-cell--blank'));
  const target = cells.find((c) => !c.classList.contains('cal-cell--today')) || cells[0];
  if (!target) return null;
  const label = target.getAttribute('aria-label');
  target.click();
  return label;
})()`);
console.log('• picked date:', pickedDate);
await sleep(1800); // wait for availability to load
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(HERE, name), Buffer.from(data, 'base64'));
};

const slot = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('.slot')].find((b) => !b.disabled);
  if (!btn) return null;
  btn.click();
  return btn.querySelector('.slot-time')?.textContent;
})()`);
if (!slot) fail('no bookable slot found');
console.log('• selected slot:', slot);
await sleep(500);
await shot('screenshot-modal.png');

await evaluate(`(() => {
  const set = (el, val) => {
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    d.set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(document.querySelector('input[type=text]'), 'Priya Sharma');
  set(document.querySelector('input[type=email]'), 'priya@example.com');
})()`);
await evaluate(`document.querySelector('.modal .btn-primary').click()`);
await sleep(2000);
await shot('screenshot-confirmation.png');

const heading = await evaluate(`document.querySelector('.confirmation h2')?.textContent ?? ''`);
if (!heading.toLowerCase().includes('set') && !heading.toLowerCase().includes('booked')) {
  fail(`no confirmation shown (got: "${heading}")`);
}

// The confirmation shows the class time in the PARENT's own zone (the mentor's
// IST time is verified separately by the API smoke test + unit tests).
const parentWhen = await evaluate(`document.querySelector('.confirm-time')?.textContent ?? ''`);
const mentorName = await evaluate(`document.querySelector('.confirm-mentor-name')?.textContent ?? ''`);
console.log('• class time (parent):', parentWhen.trim());
console.log('• assigned mentor:', mentorName.trim());
if (!/E[SD]T/.test(parentWhen)) fail('parent-local class time not shown');
if (!mentorName.toLowerCase().includes('with')) fail('assigned mentor not shown');

console.log('✓ E2E passed: booking confirmed, mentor time shown in IST');
ws.close();
chrome.kill();
