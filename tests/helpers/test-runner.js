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

  // Launch two separate browser instances with distinct windows so user sees everything side-by-side
  const browserA = await chromium.launch({
    headless: false,
    slowMo,
    args: ['--window-size=800,900', '--window-position=50,50']
  });

  const browserB = await chromium.launch({
    headless: false,
    slowMo,
    args: ['--window-size=800,900', '--window-position=870,50']
  });

  const contextA = await browserA.newContext({ viewport: { width: 780, height: 850 } });
  const contextB = await browserB.newContext({ viewport: { width: 780, height: 850 } });

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
  launchMultiDeviceSession,
  COLORS
};
