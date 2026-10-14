// ============================================================
// tests/helpers/test-runner.js
// Shared helper for multi-device live sync automated tests
// ============================================================
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function logPass(action, detail = '') {
  console.log(`${COLORS.green}${COLORS.bold}[PASS]${COLORS.reset} ${action} ${detail ? '→ ' + detail : ''}`);
}

function logSkip(action, reason = '') {
  console.log(`${COLORS.yellow}${COLORS.bold}[SKIP]${COLORS.reset} ${action} ${reason ? '→ ' + reason : ''}`);
}

function logFail(action, error = '') {
  console.log(`${COLORS.red}${COLORS.bold}[FAIL]${COLORS.reset} ${action} ${error ? '→ ' + error : ''}`);
}

// (2026-07-13) Add action loggers for click, fill, eval; was basic logs only
async function tryAction(label, fn) {
  try {
    const res = await fn();
    logPass(label, 'succeeded');
    return res;
  } catch (err) {
    logFail(label, err.message || String(err));
    throw err;
  }
}

async function clickAction(target, selector, label = '') {
  const desc = label || `Click ${selector}`;
  return tryAction(desc, async () => {
    if (typeof target.click === 'function') {
      await target.click(selector);
    } else {
      await target.locator(selector).first().click();
    }
  });
}

async function fillAction(target, selector, val, label = '') {
  const desc = label || `Fill ${selector}`;
  return tryAction(desc, async () => {
    await target.fill(selector, String(val));
  });
}

async function selectAction(target, selector, val, label = '') {
  const desc = label || `Select ${selector} -> ${val}`;
  return tryAction(desc, async () => {
    await target.selectOption(selector, val);
  });
}

async function evalAction(target, fn, arg, label = '') {
  const desc = label || `Evaluate expression`;
  return tryAction(desc, async () => {
    return await target.evaluate(fn, arg);
  });
}

function logStep(stepNum, title) {
  console.log(`\n${COLORS.cyan}${COLORS.bold}▶ STEP ${stepNum}:${COLORS.reset} ${COLORS.bold}${title}${COLORS.reset}`);
}

function logHeader(suiteName) {
  console.log(`\n============================================================`);
  console.log(`${COLORS.magenta}${COLORS.bold}  TEST SUITE: ${suiteName}${COLORS.reset}`);
  console.log(`============================================================\n`);
}

function isServerRunning(port = 8181) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/index.html`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.abort(); resolve(false); });
  });
}

function startServer(port = 8181) {
  const root = path.resolve(__dirname, '..', '..');
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function launchMultiDeviceSession({ port = 8181, slowMo = 300 } = {}) {
  let server = null;
  const running = await isServerRunning(port);
  if (!running) {
    server = await startServer(port);
    logPass('Local Test Server', `Started on http://127.0.0.1:${port}/`);
  } else {
    logPass('Local Test Server', `Already running on http://127.0.0.1:${port}/`);
  }

  // (2026-07-13) Launch maximized fullscreen view mode; was 800x900 window
  const browserA = await chromium.launch({
    headless: false,
    slowMo,
    args: ['--start-maximized']
  });

  const browserB = await chromium.launch({
    headless: false,
    slowMo,
    args: ['--start-maximized']
  });

  const contextA = await browserA.newContext({ viewport: null });
  const contextB = await browserB.newContext({ viewport: null });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  return { browserA, browserB, pageA, pageB, server };
}

module.exports = {
  logPass,
  logSkip,
  logFail,
  logStep,
  logHeader,
  tryAction,
  clickAction,
  fillAction,
  selectAction,
  evalAction,
  launchMultiDeviceSession,
  COLORS
};
