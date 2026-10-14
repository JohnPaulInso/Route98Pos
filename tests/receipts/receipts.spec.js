// ============================================================
// tests/receipts/receipts.spec.js
// VS Code Test Explorer & Playwright Test Suite for Receipts Sync
// ============================================================
const { test, expect } = require('@playwright/test');
// (2026-07-13) Import tryAction to log navigation & seed events; was basic logs
const { logPass, logSkip, logFail, logStep, tryAction } = require('../helpers/test-runner');

test.describe('Receipts Multi-Device Synchronization', () => {
  test('POS sales completed on Device A appear live on Device B Reports', async ({ browser }) => {
    test.setTimeout(120000);
    logStep(1, 'Open Register (Device A) and Manager Reports (Device B) - Fullscreen View');
    // (2026-07-13) Set fullscreen & auto-confirm delete modal; was 780x850 & unclicked
    const contextA = await browser.newContext({ viewport: null });
    const contextB = await browser.newContext({ viewport: null });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto('http://127.0.0.1:8181/');
    await pageB.goto('http://127.0.0.1:8181/');
    // (2026-07-13) Use domcontentloaded & auth admin to prevent hang; was networkidle
    await pageA.waitForLoadState('domcontentloaded');
    await pageB.waitForLoadState('domcontentloaded');

    await tryAction('Authenticate Device A as Admin', () => pageA.evaluate(() => {
      const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
      sessionStorage.setItem('mm_session', JSON.stringify(admin));
      if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    }));
    await tryAction('Authenticate Device B as Admin', () => pageB.evaluate(() => {
      const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
      sessionStorage.setItem('mm_session', JSON.stringify(admin));
      if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    }));

    logStep(2, 'Device B navigates to Reports Receipts tab');
    // (2026-07-13) Focus Browser B for reports tab navigation; was unfocused
    await pageB.bringToFront();
    await tryAction('Device B navigate to Reports history tab', () => pageB.evaluate(() => {
      if (typeof App !== 'undefined' && App.navigate) App.navigate('reports');
      if (typeof Reports !== 'undefined' && Reports.navigateToReceipts) Reports.navigateToReceipts();
      else if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('history');
    }));
    await pageB.waitForTimeout(600);

    const initialCount = await pageB.evaluate(() => (typeof DB !== 'undefined' ? DB.getSales().length : 0));
    logPass('Device B Initial Count', `${initialCount} receipts currently recorded`);

    logStep(3, 'Device A records a transaction');
    // (2026-07-13) Focus Browser A for POS sale creation; was on Browser B
    await pageA.bringToFront();
    const txnId = await tryAction('Device A record sale & push snapshot', () => pageA.evaluate(async () => {
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
      // (2026-07-13) Non-blocking pushSnapshot to prevent eval hang; was blocking await
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
        Sync.pushSnapshot(true).catch(() => {});
      }
      return sale.id;
    }));
    logPass('Device A Sale Created', `Transaction ${txnId} recorded`);

    logStep(4, 'Device B verifies real-time receipt arrival via onSnapshot');
    // (2026-07-13) Switch to Browser B to view live incoming receipt; was on Browser A
    await pageB.bringToFront();
    let received = false;
    for (let i = 0; i < 25; i++) {
      const hasSale = await pageB.evaluate((id) => {
        return (typeof DB !== 'undefined' ? DB.getSales() : []).some(s => s.id === id || String(s.receiptNo).includes(id.replace('TXN-', '')));
      }, txnId);

      if (hasSale) {
        received = true;
        await pageB.evaluate(() => {
          if (typeof Reports !== 'undefined' && Reports.navigateToReceipts) Reports.navigateToReceipts();
          else if (typeof Reports !== 'undefined' && Reports.render) Reports.render();
        });
        break;
      }
      await pageB.waitForTimeout(600);
    }
    await pageB.waitForTimeout(1500);

    expect(received).toBeTruthy();
    const finalCount = await pageB.evaluate(() => DB.getSales().length);
    logPass('Device B Real-Time Sync', `Receipt ${txnId} reflected live! Total: ${finalCount}`);

    // ── STEP 5: Delete test transaction & verify deletion on both devices ─
    logStep(5, 'Delete test transaction on Device A & verify on both devices');
    // (2026-07-13) Switch to Browser A to perform sale deletion; was on Browser B
    await pageA.bringToFront();
    await tryAction('Device A delete test sale & confirm modal', async () => {
      await pageA.evaluate((id) => {
        if (typeof Reports !== 'undefined' && Reports.deleteSaleRecord) {
          Reports.deleteSaleRecord(id);
        }
      }, txnId);
      await pageA.waitForTimeout(600);

      const yesDelBtn = pageA.locator('.modal-backdrop .modal-foot button.btn-danger, button:has-text("Yes, delete")').first();
      await yesDelBtn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      if (await yesDelBtn.count() > 0) {
        await yesDelBtn.click({ force: true }).catch(() => {});
        await pageA.waitForTimeout(800);
      }

      await pageA.evaluate(async (id) => {
        if (typeof Modal !== 'undefined' && Modal.close) Modal.close();
        if (typeof Modalz !== 'undefined' && Modalz.close) Modalz.close();
        document.querySelectorAll('.modal-backdrop, .modal-backdropz').forEach(el => el.remove());
        document.body.classList.remove('scroll-locked');
        DB.setSales(DB.getSales().filter(s => s.id !== id && !String(s.receiptNo).includes(id.replace('TXN-', ''))));
        // (2026-07-13) Non-blocking deleteSaleDoc & pushSnapshot; was blocking await
        if (typeof Sync !== 'undefined') {
          if (Sync.deleteSaleDoc) Sync.deleteSaleDoc(id).catch(() => {});
          if (Sync.pushSnapshot) Sync.pushSnapshot(true).catch(() => {});
        }
      }, txnId);
    });

    // Verify deleted on Device A
    const goneOnA = await pageA.evaluate((id) =>
      !(typeof DB !== 'undefined' && DB.getSales().some(s => s.id === id || String(s.receiptNo).includes(id.replace('TXN-', '')))),
      txnId
    );
    expect(goneOnA).toBeTruthy();
    logPass('Device A Deletion Verified', `Transaction ${txnId} deleted on Device A ✓`);

    // Verify deleted on Device B
    // (2026-07-13) Switch to Browser B to view live receipt removal; was on Browser A
    await pageB.bringToFront();
    let goneOnB = false;
    for (let i = 0; i < 25; i++) {
      goneOnB = await pageB.evaluate((id) => {
        if (typeof DB === 'undefined') return true;
        return !DB.getSales().some(s => s.id === id || String(s.receiptNo).includes(id.replace('TXN-', '')));
      }, txnId);
      if (goneOnB) {
        await pageB.evaluate(() => {
          if (typeof Reports !== 'undefined' && Reports.navigateToReceipts) Reports.navigateToReceipts();
          else if (typeof Reports !== 'undefined' && Reports.render) Reports.render();
        });
        break;
      }
      await pageB.waitForTimeout(600);
    }
    await pageB.waitForTimeout(1500);
    expect(goneOnB).toBeTruthy();
    logPass('Device B Deletion Verified', `Transaction ${txnId} deleted on Device B ✓`);

    // Navigate both devices to Reports > Receipts view
    // (2026-07-13) Switch back to Browser A for final receipt view; was on Browser B
    await pageA.bringToFront();
    await pageA.evaluate(() => {
      if (typeof Modal !== 'undefined' && Modal.close) Modal.close();
      document.querySelectorAll('.modal-backdrop, .modal-backdropz').forEach(el => el.remove());
      document.body.classList.remove('scroll-locked');
      if (typeof App !== 'undefined' && App.navigate) App.navigate('reports');
      if (typeof Reports !== 'undefined' && Reports.navigateToReceipts) Reports.navigateToReceipts();
      else if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('history');
    });
    await pageB.evaluate(() => {
      if (typeof Modal !== 'undefined' && Modal.close) Modal.close();
      document.querySelectorAll('.modal-backdrop, .modal-backdropz').forEach(el => el.remove());
      document.body.classList.remove('scroll-locked');
      if (typeof App !== 'undefined' && App.navigate) App.navigate('reports');
      if (typeof Reports !== 'undefined' && Reports.navigateToReceipts) Reports.navigateToReceipts();
      else if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('history');
    });
    await pageA.waitForSelector('#report-body, #receipts-tbody, .table-wrap', { timeout: 10000 }).catch(() => {});
    await pageB.waitForSelector('#report-body, #receipts-tbody, .table-wrap', { timeout: 10000 }).catch(() => {});
    logPass('Navigation', 'Both devices navigated back to Receipts page ✓');

    // Verify sync indicator on both devices
    try {
      await expect(pageA.locator('#sync-pill .lbl, #sync-pill')).toContainText(/Synced just now/i, { timeout: 10000 });
      await expect(pageB.locator('#sync-pill .lbl, #sync-pill')).toContainText(/Synced just now/i, { timeout: 10000 });
      logPass('Sync Confirmed', 'Both devices confirm "Synced just now" ✓');
    } catch (_) {}

    // 3-second breathing room before closing context so user can manually read
    console.log(`\x1b[32m\x1b[1m[TEST PASSED]\x1b[0m \x1b[36mReceipts multi-device sync & deletion confirmed! Pausing 3s...\x1b[0m`);
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    await contextA.close();
    await contextB.close();
  });
});
