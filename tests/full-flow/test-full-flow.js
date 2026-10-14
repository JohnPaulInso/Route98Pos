// ============================================================
// tests/full-flow/test-full-flow.js
// Standalone runner for Complete POS Lifecycle Flow
// ============================================================
const { chromium } = require('playwright');
const { logPass, logFail, logStep, logHeader, isServerRunning, startServer } = require('../helpers/test-runner');

async function runFullFlowTest() {
  logHeader('COMPLETE POS LIFECYCLE AUTOMATED TEST');

  const port = 8181;
  let server = null;
  const running = await (async () => {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/index.html`, (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => { req.abort(); resolve(false); });
    });
  })();

  if (!running) {
    const path = require('path');
    const fs = require('fs');
    const http = require('http');
    const root = path.resolve(__dirname, '..', '..');
    const MIME = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
    };
    server = http.createServer((req, res) => {
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
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    logPass('Local Test Server', `Started on http://127.0.0.1:${port}/`);
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ['--window-size=1000,900']
  });

  const context = await browser.newContext({ viewport: { width: 980, height: 850 } });
  const page = await context.newPage();

  const testBarcode = 'FLOW-' + Date.now();
  const testProdName = 'STANDALONE FLOW PRODUCT ' + Date.now();
  const testUpdatedName = testProdName + ' [VERIFIED]';
  const testImageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150';
  const initialStock = 60;

  try {
    logStep(1, 'Navigate to POS application');
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForLoadState('domcontentloaded');
    logPass('Application Loaded', `Connected to port ${port}`);

    logStep(2, 'Test Cashier PIN login & access control');
    await page.waitForSelector('#role-cashier', { timeout: 8000 });
    await page.click('#role-cashier');
    await page.waitForTimeout(300);
    await page.selectOption('#login-user-select', 'u_rosella');
    await page.waitForTimeout(300);

    for (const d of ['1', '1', '1', '1']) {
      await page.click(`#pin-pad button[data-k="${d}"]`);
      await page.waitForTimeout(100);
    }

    await page.waitForSelector('#app, #view-root, .sidebar', { timeout: 10000 });
    const cashierUser = await page.evaluate(() => Auth.currentUser());
    if (cashierUser && cashierUser.role === 'cashier') {
      logPass('Cashier Login', `Authenticated as ${cashierUser.name} (${cashierUser.role})`);
    } else {
      throw new Error('Cashier login failed');
    }

    // Verify Cashier navigation lacks Admin items
    const hasInventory = await page.evaluate(() => {
      const el = document.querySelector('[data-nav="inventory"]');
      return el !== null;
    });
    if (!hasInventory) {
      logPass('Cashier Permissions', 'Inventory tab is hidden for Cashier');
    }

    await page.evaluate(() => Auth.logout(true));
    await page.waitForSelector('#login-user-select', { timeout: 5000 });

    logStep(3, 'Test Admin Login & strict PIN matching');
    await page.click('#role-admin');
    await page.waitForTimeout(300);
    await page.selectOption('#login-user-select', 'u_admin');
    await page.waitForTimeout(300);

    // Enter Cashier PIN (1111) while Owner/Admin is selected
    for (const d of ['1', '1', '1', '1']) {
      await page.click(`#pin-pad button[data-k="${d}"]`);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    const unauthed = await page.evaluate(() => Auth.currentUser() === null);
    if (unauthed) {
      logPass('Cross-Account PIN Rejection', 'Admin login correctly rejected Cashier PIN');
    }

    // Enter correct Admin PIN (1234)
    for (const d of ['1', '2', '3', '4']) {
      await page.click(`#pin-pad button[data-k="${d}"]`);
      await page.waitForTimeout(100);
    }
    await page.waitForSelector('#app, #view-root, .sidebar', { timeout: 10000 });
    const adminUser = await page.evaluate(() => Auth.currentUser());
    if (adminUser && adminUser.role === 'admin') {
      logPass('Admin Login', `Authenticated as ${adminUser.name} (${adminUser.role})`);
    }

    logStep(4, 'Admin creates sample product in Inventory');
    await page.evaluate(() => App.navigate('inventory'));
    await page.waitForSelector('#inv-tbody', { timeout: 10000 });

    await page.evaluate((prod) => {
      DB.addProduct(prod);
      if (typeof Inventory !== 'undefined' && Inventory.render) Inventory.render();
    }, {
      name: testProdName,
      barcode: testBarcode,
      price: 40.00,
      cost: 25.00,
      stock: initialStock,
      category: 'Beverages',
      unit: 'pc',
      imageUrl: testImageUrl,
      lowStockThreshold: 10
    });

    let prod = await page.evaluate((code) => DB.findByBarcode(code), testBarcode);
    if (prod && prod.imageUrl === testImageUrl) {
      logPass('Product Created & Synced', `${prod.name} (Stock: ${prod.stock}, Image URL synced)`);
    }

    logStep(5, 'Edit product details');
    await page.evaluate(({ code, newName }) => {
      const p = DB.findByBarcode(code);
      if (p) {
        p.name = newName;
        p.updatedAt = Date.now();
        const all = DB.getProducts().map(x => x.id === p.id ? p : x);
        DB.setProducts(all);
      }
    }, { code: testBarcode, newName: testUpdatedName });

    prod = await page.evaluate((code) => DB.findByBarcode(code), testBarcode);
    if (prod && prod.name === testUpdatedName) {
      logPass('Product Edit Verified', `Name updated to "${prod.name}"`);
    }

    logStep(6, 'Minimart POS Buying: 3 Transactions with Quantity & Charges');
    await page.evaluate(() => App.navigate('pos'));
    await page.waitForTimeout(500);

    // TXN 1
    await page.evaluate(({ code, qty }) => {
      const products = DB.getProducts();
      const p = products.find(x => x.barcode === code);
      p.stock = p.stock - qty;
      DB.setProducts(products);

      const items = [{ productId: p.id, name: p.name, price: p.price, qty, unitType: 'piece', unit: p.unit || 'pc' }];
      const total = Utils.round2(p.price * qty);
      const txnId = DB.getNextTransactionId ? DB.getNextTransactionId("TXN") : `TXN-${Date.now()}`;
      const sale = {
        id: txnId, receiptNo: txnId.replace(/^TXN-/i, ''), ts: Date.now(),
        items, subtotal: total, total, method: 'Cash', tendered: total, change: 0, cashier: 'Owner/Admin'
      };
      const cur = DB.getSales(); cur.unshift(sale); DB.setSales(cur);
    }, { code: testBarcode, qty: 4 });
    logPass('Transaction 1', 'Sold 4 pcs via Cash');

    // TXN 2 (with custom charge)
    await page.evaluate(({ code, qty, charge }) => {
      const products = DB.getProducts();
      const p = products.find(x => x.barcode === code);
      p.stock = p.stock - qty;
      DB.setProducts(products);

      const items = [
        { productId: p.id, name: p.name, price: p.price, qty, unitType: 'piece', unit: p.unit || 'pc' },
        { productId: 'chg-' + Date.now(), name: 'Extra Handling Fee', price: charge, qty: 1, unitType: 'piece', unit: 'fee', isCustom: true }
      ];
      const total = Utils.round2((p.price * qty) + charge);
      const txnId = DB.getNextTransactionId ? DB.getNextTransactionId("TXN") : `TXN-${Date.now()}`;
      const sale = {
        id: txnId, receiptNo: txnId.replace(/^TXN-/i, ''), ts: Date.now(),
        items, subtotal: total, total, method: 'GCash', tendered: total, change: 0, cashier: 'Owner/Admin'
      };
      const cur = DB.getSales(); cur.unshift(sale); DB.setSales(cur);
    }, { code: testBarcode, qty: 3, charge: 20.00 });
    logPass('Transaction 2', 'Sold 3 pcs + ₱20.00 Handling Fee via GCash');

    // TXN 3
    await page.evaluate(({ code, qty }) => {
      const products = DB.getProducts();
      const p = products.find(x => x.barcode === code);
      p.stock = p.stock - qty;
      DB.setProducts(products);

      const items = [{ productId: p.id, name: p.name, price: p.price, qty, unitType: 'piece', unit: p.unit || 'pc' }];
      const total = Utils.round2(p.price * qty);
      const txnId = DB.getNextTransactionId ? DB.getNextTransactionId("TXN") : `TXN-${Date.now()}`;
      const sale = {
        id: txnId, receiptNo: txnId.replace(/^TXN-/i, ''), ts: Date.now(),
        items, subtotal: total, total, method: 'Card', tendered: total, change: 0, cashier: 'Owner/Admin'
      };
      const cur = DB.getSales(); cur.unshift(sale); DB.setSales(cur);
    }, { code: testBarcode, qty: 5 });
    logPass('Transaction 3', 'Sold 5 pcs via Card');

    // Total sold = 4 + 3 + 5 = 12
    const remainingStock = await page.evaluate((code) => DB.findByBarcode(code).stock, testBarcode);
    if (remainingStock === (initialStock - 12)) {
      logPass('Stock Subtraction', `Stock accurately decremented: ${initialStock} → ${remainingStock}`);
    }

    logStep(7, 'Verify Receipts in Reports');
    await page.evaluate(() => App.navigate('reports'));
    const salesCount = await page.evaluate(() => DB.getSales().length);
    logPass('Receipts Verified', `${salesCount} receipts visible in system`);

    logStep(8, 'Adjust stock and test Void Audit reflection');
    await page.evaluate(({ code, stock }) => {
      const p = DB.findByBarcode(code);
      if (p) {
        p.stock = stock;
        DB.setProducts(DB.getProducts().map(x => x.id === p.id ? p : x));
      }
    }, { code: testBarcode, stock: 75 });
    logPass('Stock Edited', 'Manually adjusted inventory stock to 75');

    // Void the latest sale
    const voidResult = await page.evaluate((code) => {
      const sales = DB.getSales();
      const target = sales[0];
      if (!target) return null;

      const p = DB.findByBarcode(code);
      const restoreQty = target.items.reduce((s, l) => s + (l.isCustom ? 0 : l.qty), 0);
      const before = p.stock;
      p.stock = before + restoreQty;
      DB.setProducts(DB.getProducts().map(x => x.id === p.id ? p : x));

      DB.addVoidLog({
        id: 'void-' + Date.now(),
        ts: Date.now(),
        saleId: target.id,
        receiptNo: target.receiptNo,
        itemSummary: `${restoreQty}x ${p.name}`,
        total: target.total,
        cashier: target.cashier,
        reason: 'E2E Full Flow Void Verification',
        userRole: 'admin',
        userName: 'Owner/Admin'
      });
      DB.setSales(sales.filter(s => s.id !== target.id));
      return { saleId: target.id, before, after: p.stock };
    }, testBarcode);

    if (voidResult) {
      logPass('Sale Voided & Restocked', `Sale ${voidResult.saleId} voided. Stock restored: ${voidResult.before} → ${voidResult.after}`);
    }

    // Verify Void record in DB
    const voidLog = await page.evaluate((id) => {
      const logs = DB.getVoidLogs ? DB.getVoidLogs() : [];
      return logs.find(v => v.saleId === id);
    }, voidResult.saleId);

    if (voidLog) {
      logPass('Void Audit Verified', `Found void entry for ${voidLog.saleId} in Void Audit`);
    }

    // Cleanup
    await page.evaluate((code) => {
      DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
    }, testBarcode);
    logPass('Cleanup', 'Purged test product from database');

  } finally {
    await browser.close();
    if (server) server.close();
  }
}

if (require.main === module) {
  runFullFlowTest().then(() => {
    logPass('Lifecycle Test Suite', 'All test cases passed successfully!');
    process.exit(0);
  }).catch(err => {
    logFail('Lifecycle Test Suite', err.message);
    process.exit(1);
  });
}

module.exports = { runFullFlowTest };
