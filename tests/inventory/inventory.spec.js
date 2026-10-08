// ============================================================
// tests/inventory/inventory.spec.js
// VS Code Test Explorer & Playwright Test Suite for Inventory Sync
// ============================================================
const { test, expect } = require('@playwright/test');
const { logPass, logSkip, logFail, logStep } = require('../helpers/test-runner');

test.describe('Inventory Multi-Device Synchronization', () => {
  test('Live snapshot sync reflects new and edited products across devices', async ({ browser }) => {
    logStep(1, 'Launch Store PC (Device A) and Home PC (Device B) contexts');
    const contextA = await browser.newContext({ viewport: { width: 780, height: 850 } });
    const contextB = await browser.newContext({ viewport: { width: 780, height: 850 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto('http://127.0.0.1:8181/');
    await pageB.goto('http://127.0.0.1:8181/');
    await pageA.waitForLoadState('domcontentloaded');
    await pageB.waitForLoadState('domcontentloaded');
    logPass('Device A & B Loaded', 'Both browser contexts connected');

    logStep(2, 'Navigate both devices to Inventory table');
    await pageA.evaluate(() => {
      const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { role: 'admin', name: 'Admin' };
      if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
      if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
    });
    await pageB.evaluate(() => {
      const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { role: 'admin', name: 'Admin' };
      if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
      if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
    });
    logPass('Navigation', 'Navigated to Inventory view');

    await pageA.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });
    await pageB.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });

    const countA = await pageA.evaluate(() => (typeof DB !== 'undefined' ? DB.getProducts().length : 0));
    const countB = await pageB.evaluate(() => (typeof DB !== 'undefined' ? DB.getProducts().length : 0));
    expect(countA).toBeGreaterThan(0);
    expect(countB).toBeGreaterThan(0);
    logPass('Catalog Verify', `Device A: ${countA} items | Device B: ${countB} items`);

    logStep(3, 'Device A adds a new product');
    const testBarcode = '99990002' + Math.floor(Math.random() * 1000);
    const testName = 'LIVE SYNC PRODUCT ' + Date.now();

    await pageA.locator('#btn-add-product, button:has-text("Add Product")').first().click();
    await pageA.waitForSelector('#prod-modal, .modal-dialog, #product-form', { timeout: 5000 });

    await pageA.fill('#prod-barcode, input[name="barcode"]', testBarcode);
    await pageA.fill('#prod-name, input[name="name"]', testName);
    await pageA.fill('#prod-price, input[name="price"]', '45.00');
    await pageA.fill('#prod-cost, input[name="cost"]', '30.00');
    await pageA.fill('#prod-stock, input[name="stock"]', '10');

    await pageA.locator('#btn-save-product, button:has-text("Save Product"), button:has-text("Save")').first().click();
    logPass('Device A Product Created', `${testName} saved`);

    logStep(4, 'Device B verifies real-time reflection via onSnapshot');
    let found = false;
    for (let i = 0; i < 20; i++) {
      found = await pageB.evaluate((name) => {
        return (typeof DB !== 'undefined' ? DB.getProducts() : []).some(p => p.name === name);
      }, testName);
      if (found) break;
      await pageB.waitForTimeout(600);
    }

    expect(found).toBeTruthy();
    logPass('Device B Real-Time Sync', `Product appeared on Device B via onSnapshot`);

    // Clean up
    await pageA.evaluate((code) => {
      DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
    }, testBarcode);
    logPass('Cleanup', `Test product removed`);

    await contextA.close();
    await contextB.close();
  });

  test('Cross-tab edit cost and stock persists when switching between Tab A and Tab B', async ({ browser }) => {
    logStep(1, 'Open Tab A and Tab B within the same browser context');
    const context = await browser.newContext({ viewport: { width: 800, height: 850 } });
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('http://127.0.0.1:8181/');
    await tabB.goto('http://127.0.0.1:8181/');
    await tabA.waitForLoadState('domcontentloaded');
    await tabB.waitForLoadState('domcontentloaded');
    logPass('Tabs Loaded', 'Tab A and Tab B initialized');

    logStep(2, 'Navigate both tabs to Inventory');
    await tabA.evaluate(() => {
      sessionStorage.setItem("mm_session", JSON.stringify({ id: "u_admin", name: "Owner/Admin", role: "admin" }));
      if (typeof Auth !== 'undefined' && Auth.restoreSession) Auth.restoreSession();
      if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
    });
    await tabB.evaluate(() => {
      sessionStorage.setItem("mm_session", JSON.stringify({ id: "u_admin", name: "Owner/Admin", role: "admin" }));
      if (typeof Auth !== 'undefined' && Auth.restoreSession) Auth.restoreSession();
      if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
    });
    logPass('Navigation', 'Navigated to Inventory view');

    await tabA.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });
    await tabB.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });

    logStep(3, 'Tab B edits product cost and stock and saves');
    const testBarcode = 'EDIT-SYNC-' + Date.now();
    // Add product baseline
    await tabB.evaluate((code) => {
      DB.addProduct({
        name: 'SYNC TEST PRODUCT',
        barcode: code,
        cost: 0,
        price: 100,
        stock: 0,
        category: 'Misc'
      });
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) Sync.pushSnapshot(true);
    }, testBarcode);
    await tabB.waitForTimeout(1000);

    // Tab B updates cost to 75 and stock to 25
    await tabB.evaluate((code) => {
      const prod = DB.getProducts().find(p => p.barcode === code);
      if (prod) {
        DB.updateProduct(prod.id, { cost: 75, stock: 25, price: 120 });
        if (typeof Sync !== 'undefined' && Sync.pushSnapshot) Sync.pushSnapshot(true);
      }
    }, testBarcode);
    await tabB.waitForTimeout(1000);
    logPass('Tab B Edited', 'Updated cost to 75 and stock to 25');

    logStep(4, 'Switch to Tab A (simulating visibilitychange)');
    await tabA.bringToFront();
    await tabA.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      if (typeof Sync !== 'undefined' && Sync.pullSnapshot) return Sync.pullSnapshot(true);
    });
    await tabA.waitForTimeout(1500);

    const productInA = await tabA.evaluate((code) => {
      return DB.getProducts().find(p => p.barcode === code);
    }, testBarcode);

    expect(productInA).toBeTruthy();
    expect(productInA.cost).toBe(75);
    expect(productInA.stock).toBe(25);
    logPass('Tab A Verified', `Cost is ${productInA.cost}, Stock is ${productInA.stock}`);

    logStep(5, 'Switch back to Tab B and verify no reset occurred');
    await tabB.bringToFront();
    await tabB.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tabB.waitForTimeout(1000);

    const productInB = await tabB.evaluate((code) => {
      return DB.getProducts().find(p => p.barcode === code);
    }, testBarcode);

    expect(productInB).toBeTruthy();
    expect(productInB.cost).toBe(75);
    expect(productInB.stock).toBe(25);
    logPass('Tab B Verified', `Cost remained ${productInB.cost}, Stock remained ${productInB.stock} (No reset to 0)`);

    // Clean up
    await tabA.evaluate((code) => {
      DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) Sync.pushSnapshot(true);
    }, testBarcode);

    await context.close();
  });
});
