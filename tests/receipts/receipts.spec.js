// ============================================================
// tests/receipts/receipts.spec.js
// VS Code Test Explorer & Playwright Test Suite for Receipts Sync
// ============================================================
const { test, expect } = require('@playwright/test');
const { logPass, logSkip, logFail, logStep } = require('../helpers/test-runner');

test.describe('Receipts Multi-Device Synchronization', () => {
  test('POS sales completed on Device A appear live on Device B Reports', async ({ browser }) => {
    logStep(1, 'Open Register (Device A) and Manager Reports (Device B)');
    const contextA = await browser.newContext({ viewport: { width: 780, height: 850 } });
    const contextB = await browser.newContext({ viewport: { width: 780, height: 850 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto('http://127.0.0.1:8181/');
    await pageB.goto('http://127.0.0.1:8181/');
    // (2026-07-13) Use domcontentloaded & auth admin to prevent hang; was networkidle
    await pageA.waitForLoadState('domcontentloaded');
    await pageB.waitForLoadState('domcontentloaded');

    await pageA.evaluate(() => {
      const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
      sessionStorage.setItem('mm_session', JSON.stringify(admin));
      if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    });
    await pageB.evaluate(() => {
      const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
      sessionStorage.setItem('mm_session', JSON.stringify(admin));
      if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    });

    logStep(2, 'Device B navigates to Reports Receipts tab');
    // (2026-07-13) Direct navigate to reports history tab; was brittle hidden nav click
    await pageB.evaluate(() => {
      if (typeof App !== 'undefined' && App.navigate) App.navigate('reports');
      if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('history');
    });
    await pageB.waitForTimeout(600);

    const initialCount = await pageB.evaluate(() => (typeof DB !== 'undefined' ? DB.getSales().length : 0));
    logPass('Device B Initial Count', `${initialCount} receipts currently recorded`);

    logStep(3, 'Device A records a transaction');
    const txnId = await pageA.evaluate(() => {
      const sale = {
        id: 'TXN-TEST-' + Date.now(),
        receiptNo: 'TEST-' + Date.now(),
        ts: Date.now(),
        items: [{ name: 'Realtime Sync Test Item', price: 120.00, qty: 1 }],
        subtotal: 120.00,
        total: 120.00,
        method: 'Cash',
        tendered: 150.00,
        change: 30.00,
        cashier: 'Automated Tester'
      };
      const cur = DB.getSales();
      cur.unshift(sale);
      DB.setSales(cur);
      return sale.id;
    });
    logPass('Device A Sale Created', `Transaction ${txnId} recorded`);

    logStep(4, 'Device B verifies real-time receipt arrival via onSnapshot');
    let received = false;
    for (let i = 0; i < 25; i++) {
      const hasSale = await pageB.evaluate((id) => {
        return (typeof DB !== 'undefined' ? DB.getSales() : []).some(s => s.id === id);
      }, txnId);

      if (hasSale) {
        received = true;
        break;
      }
      await pageB.waitForTimeout(600);
    }

    expect(received).toBeTruthy();
    const finalCount = await pageB.evaluate(() => DB.getSales().length);
    logPass('Device B Real-Time Sync', `Receipt ${txnId} reflected live! Total: ${finalCount}`);

    // Clean up
    await pageA.evaluate((id) => {
      DB.setSales(DB.getSales().filter(s => s.id !== id));
    }, txnId);
    logPass('Cleanup', `Test transaction removed`);

    await contextA.close();
    await contextB.close();
  });
});
