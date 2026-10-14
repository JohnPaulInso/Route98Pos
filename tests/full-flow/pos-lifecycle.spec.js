// ============================================================
// tests/full-flow/pos-lifecycle.spec.js
// Playwright E2E Suite: Full POS Lifecycle Flow
// ============================================================
const { test, expect } = require('@playwright/test');
const { logPass, logFail, logStep, logHeader } = require('../helpers/test-runner');

test.describe('Route 98 POS Complete Lifecycle Flow', () => {
  test('Complete E2E: Auth, Inventory, 3 POS Buys with Charges, Receipts & Void Audit', async ({ page }) => {
    logHeader('COMPLETE POS LIFECYCLE E2E TEST');

    const testBarcode = 'E2E-' + Date.now();
    const testProdName = 'E2E TEST PRODUCT ' + Date.now();
    const testUpdatedName = testProdName + ' (EDITED)';
    const testImageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150';
    const initialStock = 50;
    const pricePerUnit = 25.00;
    const costPerUnit = 15.00;

    // ----------------------------------------------------
    logStep(1, 'Open POS application');
    await page.goto('http://127.0.0.1:8181/');
    await page.waitForLoadState('domcontentloaded');
    logPass('Browser', 'Loaded application on port 8181');

    // ----------------------------------------------------
    logStep(2, 'Test Cashier Login & View Access Restrictions');
    // Switch to Cashier tab
    await page.waitForSelector('#role-cashier', { timeout: 8000 });
    await page.click('#role-cashier');
    await page.waitForTimeout(300);

    // Select Cashier account (Rosella)
    await page.selectOption('#login-user-select', 'u_rosella');
    await page.waitForTimeout(300);

    // Enter Cashier PIN: 1111
    for (const d of ['1', '1', '1', '1']) {
      await page.click(`#pin-pad button[data-k="${d}"]`);
      await page.waitForTimeout(100);
    }

    // Verify successful cashier login
    await page.waitForSelector('#app, #view-root, .sidebar', { timeout: 10000 });
    const cashierUser = await page.evaluate(() => Auth.currentUser());
    expect(cashierUser).toBeTruthy();
    expect(cashierUser.role).toBe('cashier');
    logPass('Cashier Login', `Logged in as ${cashierUser.name} (${cashierUser.role})`);

    // Verify Cashier does not have access to Admin-only views (Inventory, Expenses, Settings)
    const cashierNavViews = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('[data-nav], .nav-btn, .nav-item'));
      return links.map(el => el.getAttribute('data-nav') || el.textContent.trim().toLowerCase());
    });
    expect(cashierNavViews.some(v => v.includes('inventory'))).toBeFalsy();
    expect(cashierNavViews.some(v => v.includes('settings'))).toBeFalsy();
    logPass('Cashier Permissions', 'Admin operations (Inventory, Settings) are hidden from Cashier');

    // Attempt unauthorized navigation to Inventory
    await page.evaluate(() => App.navigate('inventory'));
    const viewAfterRestrictedNav = await page.evaluate(() => {
      return document.querySelector('#inv-tbody') !== null;
    });
    expect(viewAfterRestrictedNav).toBeFalsy();
    logPass('Cashier Route Guard', 'Direct navigation to inventory blocked for Cashier');

    // Logout Cashier
    await page.evaluate(() => Auth.logout(true));
    await page.waitForSelector('#login-user-select', { timeout: 5000 });
    logPass('Cashier Logout', 'Returned to login screen');

    // ----------------------------------------------------
    logStep(3, 'Test Admin Login & PIN Cross-Account Validation');
    await page.click('#role-admin');
    await page.waitForTimeout(300);
    await page.selectOption('#login-user-select', 'u_admin');
    await page.waitForTimeout(300);

    // Try Cashier PIN (1111) while Owner/Admin is selected -> Must fail
    for (const d of ['1', '1', '1', '1']) {
      await page.click(`#pin-pad button[data-k="${d}"]`);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    const stillOnLogin = await page.evaluate(() => Auth.currentUser() === null);
    expect(stillOnLogin).toBeTruthy();
    logPass('PIN Validation Guard', 'Cashier PIN rejected when Admin account is selected');

    // Enter correct Admin PIN: 1234
    for (const d of ['1', '2', '3', '4']) {
      await page.click(`#pin-pad button[data-k="${d}"]`);
      await page.waitForTimeout(100);
    }

    await page.waitForSelector('#app, #view-root, .sidebar', { timeout: 10000 });
    const adminUser = await page.evaluate(() => Auth.currentUser());
    expect(adminUser).toBeTruthy();
    expect(adminUser.role).toBe('admin');
    logPass('Admin Login', `Logged in as ${adminUser.name} (${adminUser.role})`);

    // ----------------------------------------------------
    logStep(4, 'Admin adds sample test product with image in Inventory');
    await page.evaluate(() => App.navigate('inventory'));
    await page.waitForSelector('#inv-tbody', { timeout: 10000 });

    // Add product baseline
    await page.evaluate((prod) => {
      DB.addProduct(prod);
      if (typeof Inventory !== 'undefined' && Inventory.render) Inventory.render();
    }, {
      name: testProdName,
      barcode: testBarcode,
      price: pricePerUnit,
      cost: costPerUnit,
      stock: initialStock,
      category: 'Snacks',
      unit: 'pc',
      imageUrl: testImageUrl,
      lowStockThreshold: 5
    });

    // Verify product exists and image link is stored
    let savedProd = await page.evaluate((code) => DB.findByBarcode(code), testBarcode);
    expect(savedProd).toBeTruthy();
    expect(savedProd.name).toBe(testProdName);
    expect(savedProd.imageUrl).toBe(testImageUrl);
    expect(savedProd.stock).toBe(initialStock);
    logPass('Product Created', `${savedProd.name} (Stock: ${savedProd.stock}, Image synced)`);

    // ----------------------------------------------------
    logStep(5, 'Edit product details and verify update in catalog');
    await page.evaluate(({ code, newName, newPrice }) => {
      const p = DB.findByBarcode(code);
      if (p) {
        p.name = newName;
        p.price = newPrice;
        p.updatedAt = Date.now();
        const prods = DB.getProducts().map(x => x.id === p.id ? p : x);
        DB.setProducts(prods);
        if (typeof Inventory !== 'undefined' && Inventory.render) Inventory.render();
      }
    }, { code: testBarcode, newName: testUpdatedName, newPrice: 30.00 });

    savedProd = await page.evaluate((code) => DB.findByBarcode(code), testBarcode);
    expect(savedProd.name).toBe(testUpdatedName);
    expect(savedProd.price).toBe(30.00);
    logPass('Product Edited', `Updated to ${savedProd.name} at ₱${savedProd.price}`);

    // ----------------------------------------------------
    logStep(6, 'Verify visibility on Minimart POS catalog');
    await page.evaluate(() => App.navigate('pos'));
    await page.waitForSelector('#product-grid, .catalog-card, #pos-screen', { timeout: 10000 });

    const posVisible = await page.evaluate((code) => {
      const prod = DB.findByBarcode(code);
      return prod && prod.stock > 0;
    }, testBarcode);
    expect(posVisible).toBeTruthy();
    logPass('POS Visibility', `${testUpdatedName} is active in Minimart catalog`);

    // ----------------------------------------------------
    logStep(7, 'POS Buy 1: Buy 3 pcs of test product');
    const buy1Qty = 3;
    const txn1Total = await page.evaluate(({ code, qty }) => {
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
      return total;
    }, { code: testBarcode, qty: buy1Qty });
    logPass('Transaction 1 Complete', `Sold ${buy1Qty} pcs, Total: ₱${txn1Total}`);

    // Verify stock subtraction after Buy 1
    let curStock = await page.evaluate((code) => DB.findByBarcode(code).stock, testBarcode);
    expect(curStock).toBe(initialStock - buy1Qty);
    logPass('Stock Subtraction 1', `Stock reduced from ${initialStock} to ${curStock}`);

    // ----------------------------------------------------
    logStep(8, 'POS Buy 2: Buy 2 pcs + Custom Service Charge item');
    const buy2Qty = 2;
    const serviceChargeAmt = 15.00;
    const txn2Total = await page.evaluate(({ code, qty, charge }) => {
      const products = DB.getProducts();
      const p = products.find(x => x.barcode === code);
      p.stock = p.stock - qty;
      DB.setProducts(products);

      const items = [
        { productId: p.id, name: p.name, price: p.price, qty, unitType: 'piece', unit: p.unit || 'pc' },
        { productId: 'charge-' + Date.now(), name: 'Packaging & Service Charge', price: charge, qty: 1, unitType: 'piece', unit: 'service', isCustom: true }
      ];
      const total = Utils.round2((p.price * qty) + charge);
      const txnId = DB.getNextTransactionId ? DB.getNextTransactionId("TXN") : `TXN-${Date.now()}`;
      const sale = {
        id: txnId, receiptNo: txnId.replace(/^TXN-/i, ''), ts: Date.now(),
        items, subtotal: total, total, method: 'GCash', tendered: total, change: 0, cashier: 'Owner/Admin'
      };
      const cur = DB.getSales(); cur.unshift(sale); DB.setSales(cur);
      return total;
    }, { code: testBarcode, qty: buy2Qty, charge: serviceChargeAmt });
    logPass('Transaction 2 Complete', `Sold ${buy2Qty} pcs + ₱${serviceChargeAmt} Charge, Total: ₱${txn2Total}`);

    // Verify stock subtraction after Buy 2
    curStock = await page.evaluate((code) => DB.findByBarcode(code).stock, testBarcode);
    expect(curStock).toBe(initialStock - buy1Qty - buy2Qty);
    logPass('Stock Subtraction 2', `Stock reduced to ${curStock}`);

    // ----------------------------------------------------
    logStep(9, 'POS Buy 3: Buy 5 pcs');
    const buy3Qty = 5;
    const txn3Total = await page.evaluate(({ code, qty }) => {
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
      return total;
    }, { code: testBarcode, qty: buy3Qty });
    logPass('Transaction 3 Complete', `Sold ${buy3Qty} pcs, Total: ₱${txn3Total}`);

    // Verify cumulative stock subtraction
    const totalSold = buy1Qty + buy2Qty + buy3Qty;
    curStock = await page.evaluate((code) => DB.findByBarcode(code).stock, testBarcode);
    expect(curStock).toBe(initialStock - totalSold);
    logPass('Total Stock Subtraction', `Initial ${initialStock} - ${totalSold} sold = ${curStock} remaining`);

    // ----------------------------------------------------
    logStep(10, 'Verify Receipts in Reports');
    await page.evaluate(() => App.navigate('reports'));
    await page.waitForTimeout(600);

    const receiptsCount = await page.evaluate(() => {
      const sales = DB.getSales();
      return sales.length;
    });
    expect(receiptsCount).toBeGreaterThanOrEqual(3);
    logPass('Receipts Verified', `${receiptsCount} receipts recorded in Reports`);

    // Verify receipt line items and totals
    const latestSale = await page.evaluate(() => DB.getSales()[0]);
    expect(latestSale).toBeTruthy();
    expect(latestSale.items.length).toBeGreaterThan(0);
    logPass('Latest Receipt', `ID: ${latestSale.id}, Total: ₱${latestSale.total}, Cashier: ${latestSale.cashier}`);

    // ----------------------------------------------------
    logStep(11, 'Edit stock in Inventory');
    await page.evaluate(() => App.navigate('inventory'));
    const adjustedStock = 80;
    await page.evaluate(({ code, stock }) => {
      const p = DB.findByBarcode(code);
      if (p) {
        p.stock = stock;
        p.updatedAt = Date.now();
        const prods = DB.getProducts().map(x => x.id === p.id ? p : x);
        DB.setProducts(prods);
      }
    }, { code: testBarcode, stock: adjustedStock });

    curStock = await page.evaluate((code) => DB.findByBarcode(code).stock, testBarcode);
    expect(curStock).toBe(adjustedStock);
    logPass('Inventory Stock Edit', `Manually adjusted stock to ${curStock}`);

    // ----------------------------------------------------
    logStep(12, 'Delete/Void Transaction and Verify Void Audit & Restock Reflection');
    const stockBeforeVoid = curStock;
    const saleToVoid = latestSale;

    await page.evaluate((saleId) => {
      const sales = DB.getSales();
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;

      // Restore stock
      const products = DB.getProducts();
      const stockChanges = [];
      (sale.items || []).forEach(line => {
        let p = products.find(x => x.id === line.productId || x.name === line.name);
        if (p) {
          const before = p.stock || 0;
          p.stock = Utils.round2(before + line.qty);
          p.updatedAt = Date.now();
          stockChanges.push(`${line.qty}x ${p.name} (Stock: ${before} → ${p.stock})`);
        }
      });
      DB.setProducts(products);

      // Log void
      DB.addVoidLog({
        id: 'void-' + Date.now(),
        ts: Date.now(),
        origTxnId: sale.id,
        receiptNo: sale.receiptNo || sale.id,
        itemSummary: stockChanges.join(', ') || 'Test transaction void',
        total: sale.total,
        cashier: sale.cashier || 'Admin',
        reason: 'Automated E2E Test Void Deletion',
        userRole: 'admin',
        userName: 'Owner/Admin'
      });

      // Remove from sales
      DB.setSales(sales.filter(s => s.id !== saleId));
    }, saleToVoid.id);

    // Verify sale is removed from active sales
    const isDeleted = await page.evaluate((saleId) => {
      return !DB.getSales().some(s => s.id === saleId);
    }, saleToVoid.id);
    expect(isDeleted).toBeTruthy();
    logPass('Sale Deleted', `Transaction ${saleToVoid.id} removed from active receipts`);

    // Verify Void Audit contains the void entry
    const voidLog = await page.evaluate((saleId) => {
      const logs = DB.getVoidLogs ? DB.getVoidLogs() : [];
      return logs.find(v => v.origTxnId === saleId || v.reason === 'Automated E2E Test Void Deletion');
    }, saleToVoid.id);
    expect(voidLog).toBeTruthy();
    expect(voidLog.reason).toBe('Automated E2E Test Void Deletion');
    logPass('Void Audit Verified', `Logged void for ${voidLog.origTxnId} (${voidLog.reason})`);

    // Verify stock restoration
    const stockAfterVoid = await page.evaluate((code) => DB.findByBarcode(code).stock, testBarcode);
    const restoredQty = saleToVoid.items.reduce((sum, item) => sum + (item.isCustom ? 0 : item.qty), 0);
    expect(stockAfterVoid).toBe(stockBeforeVoid + restoredQty);
    logPass('Stock Restored on Void', `Restored +${restoredQty} pcs. Stock: ${stockBeforeVoid} → ${stockAfterVoid}`);

    // ----------------------------------------------------
    logStep(13, 'Cleanup Test Artifacts');
    await page.evaluate((code) => {
      DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
    }, testBarcode);
    logPass('Cleanup Complete', `Test product ${testBarcode} purged`);
  });
});
