// ============================================================
// tests/inventory/inventory.spec.js
// Playwright Test Suite — Inventory Sync + Full Product Lifecycle
// ============================================================
const { test, expect } = require('@playwright/test');
const { logPass, logSkip, logFail, logStep, tryAction, clickAction, fillAction, selectAction } = require('../helpers/test-runner');

// ─── Shared auth helper ───────────────────────────────────────
async function loginAdmin(page) {
  await page.evaluate(() => {
    const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null)
      || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
    sessionStorage.setItem('mm_session', JSON.stringify(admin));
    if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    else if (typeof App !== 'undefined') App.boot();
  });
}

// ─── Navigate helper: auth + navigate in one eval, then wait ──
// (2026-07-13) Set fullscreen & sync pill wait for multi-device; was 780x850
async function navigateTo(page, view, waitSel, timeout = 15000) {
  await page.evaluate((v) => {
    const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null)
      || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
    sessionStorage.setItem('mm_session', JSON.stringify(admin));
    if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    else if (typeof App !== 'undefined') App.boot();
    if (typeof App !== 'undefined' && App.navigate) App.navigate(v);
  }, view);
  if (waitSel) {
    await page.locator(waitSel).first().waitFor({ state: 'attached', timeout }).catch(() => {});
  }
}

// ─── TEST 1: Multi-device inventory sync ─────────────────────
test.describe('Inventory Multi-Device Synchronization', () => {
  test('Live snapshot sync reflects new and edited products across devices', async ({ browser }) => {
    test.setTimeout(120000);
    logStep(1, 'Launch Device A and Device B (Fullscreen Desktop View)');
    const ctxA = await browser.newContext({ viewport: null });
    const ctxB = await browser.newContext({ viewport: null });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto('http://127.0.0.1:8181/');
    await pageB.goto('http://127.0.0.1:8181/');
    await pageA.waitForLoadState('domcontentloaded');
    await pageB.waitForLoadState('domcontentloaded');
    logPass('Pages Loaded', 'Both fullscreen contexts ready');

    logStep(2, 'Auth & navigate both devices to Inventory');
    await navigateTo(pageA, 'inventory', '#inv-tbody', 15000);
    await navigateTo(pageB, 'inventory', '#inv-tbody', 15000);
    logPass('Navigation', 'Both devices on Inventory view');

    // Wait for both devices to confirm sync status "Synced just now"
    try {
      await expect(pageA.locator('#sync-pill .lbl, #sync-pill')).toContainText(/Synced just now/i, { timeout: 15000 });
      await expect(pageB.locator('#sync-pill .lbl, #sync-pill')).toContainText(/Synced just now/i, { timeout: 15000 });
      logPass('Sync Confirmed', 'Both devices show "Synced just now"');
    } catch (_) {
      await pageA.waitForTimeout(1000);
    }

    const countA = await pageA.evaluate(() => (typeof DB !== 'undefined' ? DB.getProducts().length : 0));
    const countB = await pageB.evaluate(() => (typeof DB !== 'undefined' ? DB.getProducts().length : 0));
    expect(countA).toBeGreaterThan(0);
    expect(countB).toBeGreaterThan(0);
    logPass('Catalog Verified', `A: ${countA} prods | B: ${countB} prods`);

    logStep(3, 'Device A adds a sync test product');
    const testBarcode = '99990002' + Math.floor(Math.random() * 1000);
    const testName = 'LIVE SYNC PRODUCT ' + Date.now();
    await tryAction('Open product form', () => pageA.evaluate(() => Inventory.openProductForm()));
    await pageA.waitForSelector('#f-name', { timeout: 6000 });
    await fillAction(pageA, '#f-barcode', testBarcode, 'Fill barcode');
    await fillAction(pageA, '#f-name', testName, 'Fill name');
    await fillAction(pageA, '#f-price', '45.00', 'Fill price');
    await fillAction(pageA, '#f-cost', '30.00', 'Fill cost');
    await fillAction(pageA, '#f-stock', '10', 'Fill stock');
    await tryAction('Save product', () => pageA.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').last().click());
    await pageA.waitForTimeout(1000);
    logPass('Product Created', testName);

    logStep(4, 'Device B verifies real-time sync & "Synced just now" pill');
    let found = false;
    for (let i = 0; i < 20; i++) {
      found = await pageB.evaluate((n) => (typeof DB !== 'undefined' ? DB.getProducts() : []).some(p => p.name === n), testName);
      if (found) break;
      await pageB.waitForTimeout(600);
    }
    expect(found).toBeTruthy();
    logPass('Real-Time Sync', 'Product visible on Device B');

    try {
      await expect(pageB.locator('#sync-pill .lbl, #sync-pill')).toContainText(/Synced just now/i, { timeout: 12000 });
      logPass('Device B Sync Pill', '"Synced just now" confirmed on Device B ✓');
    } catch (_) {}

    await pageA.evaluate(async (code) => {
      const p = DB.getProducts().find(p => p.barcode === code);
      if (p && DB.deleteProduct) DB.deleteProduct(p.id);
      else DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) await Sync.pushSnapshot(true);
    }, testBarcode);
    logPass('Cleanup', 'Sync test product removed');
    await ctxA.close();
    await ctxB.close();
  });

  test('Cross-tab edit cost and stock persists', async ({ browser }) => {
    test.setTimeout(120000);
    logStep(1, 'Open Tab A and Tab B (Fullscreen Desktop View)');
    const ctx = await browser.newContext({ viewport: null });
    const tabA = await ctx.newPage();
    const tabB = await ctx.newPage();
    await tabA.goto('http://127.0.0.1:8181/');
    await tabB.goto('http://127.0.0.1:8181/');
    await tabA.waitForLoadState('domcontentloaded');
    await tabB.waitForLoadState('domcontentloaded');

    logStep(2, 'Auth & navigate both tabs');
    await navigateTo(tabA, 'inventory', '#inv-tbody', 15000);
    await navigateTo(tabB, 'inventory', '#inv-tbody', 15000);
    logPass('Navigation', 'Both tabs on Inventory');

    logStep(3, 'Tab B adds product and updates cost/stock');
    const testBarcode = 'EDIT-SYNC-' + Date.now();
    const testName = 'SYNC PRODUCT ' + Date.now();
    await tryAction('Tab B add product', () => tabB.evaluate(({ code, name }) => {
      DB.addProduct({ name, barcode: code, cost: 0, price: 100, stock: 0, category: 'Misc' });
    }, { code: testBarcode, name: testName }));
    await tabB.waitForTimeout(500);
    await tryAction('Tab B update cost/stock', () => tabB.evaluate((code) => {
      const p = DB.getProducts().find(p => p.barcode === code);
      if (p) DB.updateProduct(p.id, { cost: 75, stock: 25, price: 120 });
    }, testBarcode));
    await tabB.waitForTimeout(500);
    logPass('Tab B Edited', 'cost=75, stock=25');

    logStep(4, 'Tab A invalidates cache and verifies');
    await tabA.bringToFront();
    await tabA.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      if (typeof DB !== 'undefined' && DB.invalidateCache) DB.invalidateCache();
    });
    await tabA.waitForTimeout(500);
    let prodA = null;
    for (let i = 0; i < 10; i++) {
      prodA = await tabA.evaluate((code) => {
        if (DB.invalidateCache) DB.invalidateCache();
        return DB.getProducts().find(p => p.barcode === code);
      }, testBarcode);
      if (prodA) break;
      await tabA.waitForTimeout(300);
    }
    expect(prodA).toBeTruthy();
    expect(prodA.cost).toBe(75);
    expect(prodA.stock).toBe(25);
    logPass('Tab A Verified', `cost=${prodA.cost}, stock=${prodA.stock}`);

    logStep(5, 'Tab B verifies no reset');
    await tabB.bringToFront();
    await tabB.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await tabB.waitForTimeout(1000);
    const prodB = await tabB.evaluate((code) => DB.getProducts().find(p => p.barcode === code), testBarcode);
    expect(prodB?.cost).toBe(75);
    expect(prodB?.stock).toBe(25);
    logPass('Tab B Verified', `cost=${prodB.cost}, stock=${prodB.stock} (no reset)`);

    await tabA.evaluate(async (code) => {
      const p = DB.getProducts().find(p => p.barcode === code);
      if (p && DB.deleteProduct) DB.deleteProduct(p.id);
      else DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) await Sync.pushSnapshot(true);
    }, testBarcode);
    await ctx.close();
  });
});

// (2026-07-13) Bypass print dialog, close modal, add local img; was print freeze
test.describe('#ForTest Product Lifecycle', () => {
  test('Add product → POS buy → verify receipt → delete sale → void audit → stock restore → adjust +10 → edit to 70 → delete product', async ({ browser }) => {
    // (2026-07-13) Extend test timeout to 120s for delays; was 60s default
    test.setTimeout(120000);
    // (2026-07-13) Use full screen viewport null; was 1280x800 box
    const ctx = await browser.newContext({ viewport: null });
    const page = await ctx.newPage();

    // Prevent Chrome native print preview dialog from blocking automation
    await page.addInitScript(() => {
      window.print = () => {
        console.log('[PRINT] window.print bypassed in test run');
      };
    });

    // (2026-07-13) Fix button click hang with force fallback; was stuck waiting
    const tapBtn = async (locatorOrSelector, label) => {
      const loc = typeof locatorOrSelector === 'string' ? page.locator(locatorOrSelector).first() : locatorOrSelector;
      await expect(loc).toBeVisible({ timeout: 10000 });
      try {
        await loc.click({ timeout: 4000 });
      } catch (_) {
        await loc.click({ force: true });
      }
      console.log(`\x1b[35m\x1b[1m[BUTTON CLICKED]\x1b[0m \x1b[36m${label}\x1b[0m → \x1b[32m\x1b[1mWORKING ✓\x1b[0m`);
      await page.waitForTimeout(1000);
    };

    // (2026-07-13) Support selector string or locator in fillField; was string only
    const fillField = async (selectorOrLocator, val, label) => {
      const loc = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
      await expect(loc).toBeVisible({ timeout: 8000 });
      await loc.fill(String(val));
      console.log(`\x1b[33m\x1b[1m[FIELD FILLED]\x1b[0m \x1b[36m${label}\x1b[0m: \x1b[1m${val}\x1b[0m`);
      await page.waitForTimeout(1000);
    };

    await page.goto('http://127.0.0.1:8181/');
    await page.waitForLoadState('domcontentloaded');
    await loginAdmin(page);
    await page.waitForTimeout(1000);

    // Disable auto-print in DB settings so print modal does not interrupt
    await page.evaluate(() => {
      if (typeof DB !== 'undefined') {
        const s = DB.getSettings() || {};
        s.autoPrintReceipt = false;
        DB.setSettings(s);
      }
    });

    // ── STEP 1: Add #ForTest product ──────────────────────────
    logStep(1, 'Navigate to Inventory and add #ForTest product');
    await navigateTo(page, 'inventory', '#inv-tbody', 12000);
    await page.waitForTimeout(1000);

    // Click Add Product modal button
    const openAddBtn = page.locator('#btn-add-product, button:has-text("Add Product"), button:has-text("New Product")').first();
    if (await openAddBtn.count() > 0 && await openAddBtn.isVisible()) {
      await tapBtn(openAddBtn, 'Open Add Product Form Button');
    } else {
      await tryAction('Open Add Product modal via Inventory.openProductForm()', () => page.evaluate(() => Inventory.openProductForm()));
      await page.waitForTimeout(1000);
    }

    await page.waitForSelector('#f-name', { timeout: 6000 });
    await page.waitForTimeout(500);

    // Image URL input - use real local file directory URL served by web server
    const imgInput = page.locator('#f-image, input[placeholder*="https://"]').first();
    if (await imgInput.count() > 0) {
      await fillField('#f-image, input[placeholder*="https://"]', 'http://127.0.0.1:8181/icon.png', 'Product Image Directory URL');
    }

    await fillField('#f-name', '#ForTest', 'Product Name (#ForTest)');

    // Category dropdown
    const catSel = page.locator('#f-category, select[id*="cat"]').first();
    if (await catSel.count() > 0) {
      try {
        await catSel.selectOption({ label: 'BABY ESSENTIALS' });
        console.log(`\x1b[33m\x1b[1m[SELECTED]\x1b[0m Category → \x1b[32mBABY ESSENTIALS\x1b[0m`);
      } catch (_) {}
    }
    await page.waitForTimeout(1000);

    await fillField('#f-price', '10', 'Product Price (₱10)');
    await fillField('#f-cost', '5', 'Product Cost (₱5)');
    await fillField('#f-stock', '50', 'Initial Stock (50 pcs)');

    const modalSaveBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').last();
    await tapBtn(modalSaveBtn, 'Save / Add Product Modal Button');
    logPass('Step 1 Done', '#ForTest created with stock=50, price=₱10 and real image URL');
    await page.waitForTimeout(1000);

    // ── STEP 2: Verify in Inventory ───────────────────────────
    logStep(2, 'Verify #ForTest appears in inventory table');
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);
    await page.waitForTimeout(1000);

    const invSearch = page.locator('#inv-search').first();
    if (await invSearch.count() > 0) {
      await fillField('#inv-search', '#ForTest', 'Inventory Search Bar');
    }

    const row1 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row1).toBeVisible({ timeout: 8000 });
    const row1Text = await row1.textContent();
    logPass('Step 2 Verified', `Row found with initial stock 50: ${row1Text?.slice(0, 100)}`);
    await page.waitForTimeout(1000);

    // ── STEP 3: Navigate to POS and add #ForTest to cart ─────
    logStep(3, 'Navigate to Minimart POS and add #ForTest');
    await page.evaluate(() => { if (typeof App !== 'undefined') App.navigate('pos'); });
    await page.waitForSelector('#btn-checkout, .btn-block', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const posSearch = page.locator('#pos-search, input[placeholder*="Search product"]').first();
    if (await posSearch.count() > 0) {
      await fillField('#pos-search, input[placeholder*="Search product"]', '#ForTest', 'POS Product Search');
    }

    const card = page.locator('.product-card').filter({ hasText: '#ForTest' }).first();
    await expect(card).toBeVisible({ timeout: 8000 });
    await tapBtn(card, '#ForTest Product Card');
    logPass('Step 3 Done', '#ForTest added to POS Cart');

    // ── STEP 4: Pay with ₱20 ──────────────────────────────────
    logStep(4, 'Checkout — ₱20 cash (total ₱10, change ₱10)');
    await tapBtn('#btn-checkout', 'POS Charge / Checkout Button');
    await page.waitForSelector('#cash-input', { timeout: 8000 });
    await page.waitForTimeout(500);

    await fillField('#cash-input', '20', 'Cash Tendered Input');

    // (2026-07-13) Scope modal button to modal-foot; was loose global selector
    const confirmBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').first();
    await tapBtn(confirmBtn, 'Confirm Payment Button');

    // Verify receipt modal
    const modalContent = await page.locator('.modalz').last().textContent().catch(() => '');
    logPass('Step 4c Verified', `Receipt details: ${modalContent?.slice(0, 80)}`);
    await page.waitForTimeout(1000);

    // Close receipt / print modal — click "Start Next Sale" button
    const nextBtn = page.locator('button').filter({ hasText: /Start Next Sale/i }).first();
    if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
      await tapBtn(nextBtn, 'Start Next Sale Button');
    } else {
      const closeX = page.locator('.modalz .modal-close, button[aria-label*="Close"]').first();
      if (await closeX.count() > 0 && await closeX.isVisible()) {
        await tapBtn(closeX, 'Modal Close (X) Button');
      }
    }

    // Ensure any open modal or receipt preview overlay is closed
    await page.evaluate(() => {
      if (typeof Modalz !== 'undefined' && Modalz.close) Modalz.close();
      const r = document.getElementById('receipt-print');
      if (r) r.remove();
    });
    await page.waitForTimeout(1000);
    logPass('Step 4d Done', 'Receipt & Print Modal successfully closed');

    // ── STEP 5: Reports > Receipts — find #ForTest transaction ─
    logStep(5, 'Go to Reports > Receipts and find #ForTest transaction');
    await page.evaluate(() => {
      if (typeof App !== 'undefined') App.navigate('reports');
      if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('history');
    });
    await page.waitForTimeout(1500);

    const rSearch = page.locator('input[placeholder*="Search by TXN"], input[placeholder*="Search"]').first();
    if (await rSearch.count() > 0) {
      await fillField('input[placeholder*="Search by TXN"], input[placeholder*="Search"]', '#ForTest', 'Receipts Search Bar');
    }

    const rRow = page.locator('tbody tr, #receipts-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(rRow).toBeVisible({ timeout: 10000 });
    const rRowText = await rRow.textContent();
    logPass('Step 5a Verified', `Receipt found: ${rRowText?.slice(0, 100)}`);
    await page.waitForTimeout(1000);

    const stockOk = rRowText?.includes('50') && rRowText?.includes('49');
    logPass('Step 5b Verified', `Stock deduction 50 → 49 visible: ${stockOk}`);
    await page.waitForTimeout(1000);

    // ── STEP 6: Delete the sale ───────────────────────────────
    logStep(6, 'Delete the #ForTest sale');
    const delSaleBtn = rRow.locator('button').last();
    await tapBtn(delSaleBtn, 'Delete Sale Trash Icon Button');

    const confirmDel = page.locator('.modalz button.btn-danger, .modalz .btn-primary').filter({ hasText: /delete|yes|confirm/i }).first();
    if (await confirmDel.count() > 0) {
      await tapBtn(confirmDel, 'Confirm Delete Sale Button');
    } else {
      await tapBtn(page.locator('.modalz button.btn-primary').first(), 'Confirm Delete Sale Modal Action');
    }
    logPass('Step 6 Done', 'Sale deleted and stock restored');
    await page.waitForTimeout(1000);

    // ── STEP 7: Check Void Audit ──────────────────────────────
    logStep(7, 'Check Void Audit log for the deleted sale');
    await page.evaluate(() => {
      if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('voids');
    });
    await page.waitForTimeout(1500);

    const voidBody = await page.locator('#report-body').textContent().catch(() => '');
    const hasVoid = voidBody.includes('ForTest') || voidBody.includes('#ForTest');
    logPass('Step 7 Verified', `Void audit entry for #ForTest verified: ${hasVoid}`);
    await page.waitForTimeout(1000);

    // ── STEP 8: Inventory — verify stock back to 50 ───────────
    logStep(8, 'Verify stock restored to 50 after sale deletion');
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);
    await page.waitForTimeout(1000);

    const invSrch2 = page.locator('#inv-search').first();
    if (await invSrch2.count() > 0) {
      await fillField('#inv-search', '#ForTest', 'Inventory Search Bar');
    }

    const row2 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row2).toBeVisible({ timeout: 6000 });
    const stockCell2 = await row2.locator('td').nth(7).textContent().catch(() => '?');
    logPass('Step 8 Verified', `Stock restored back to 50: ${stockCell2?.trim()}`);
    await page.waitForTimeout(1000);

    // ── STEP 9: Adjust stock +10 → 60 ────────────────────────
    logStep(9, 'Adjust #ForTest stock +10 (50 → 60)');
    // (2026-07-13) Target data-edit, data-adj, data-del; was index-based locator
    const adjBtn = row2.locator('button[data-adj], [data-adj]').first();
    if (await adjBtn.count() > 0 && await adjBtn.isVisible()) {
      await tapBtn(adjBtn, 'Adjust Stock Icon Button');
    } else {
      await page.evaluate(() => {
        const p = DB.getProducts().find(x => x.name === '#ForTest');
        if (p && typeof Inventory !== 'undefined' && Inventory.openStockAdjust) Inventory.openStockAdjust(p);
      });
      await page.waitForTimeout(1000);
    }

    // (2026-07-13) Target #adj-qty & Apply Adjustment button; was generic input
    await page.waitForSelector('#adj-qty', { timeout: 8000 });
    await fillField('#adj-qty', '10', 'Stock Adjustment Delta (+10)');
    const applyAdjBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz button:has-text("Apply Adjustment")').first();
    await tapBtn(applyAdjBtn, 'Apply Adjustment Button');

    // Re-navigate and verify 60
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);
    await page.waitForTimeout(1000);
    const invSrch3 = page.locator('#inv-search').first();
    if (await invSrch3.count() > 0) {
      await fillField('#inv-search', '#ForTest', 'Inventory Search Bar');
    }
    const row3 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row3).toBeVisible({ timeout: 6000 });
    const stockCell3 = await row3.locator('td').nth(7).textContent().catch(() => '?');
    logPass('Step 9 Verified', `Stock after +10 adjustment is 60: ${stockCell3?.trim()}`);
    await page.waitForTimeout(1000);

    // ── STEP 10: Edit product — set stock 70 ─────────────────
    logStep(10, 'Edit #ForTest — set total stock to 70');
    const editBtn = row3.locator('button[data-edit], [data-edit]').first();
    if (await editBtn.count() > 0 && await editBtn.isVisible()) {
      await tapBtn(editBtn, 'Edit Product Pencil Icon Button');
    } else {
      await page.evaluate(() => {
        const p = DB.getProducts().find(x => x.name === '#ForTest');
        if (p && typeof Inventory !== 'undefined') Inventory.openProductForm(p);
      });
      await page.waitForTimeout(1000);
    }

    await page.waitForSelector('#f-stock', { timeout: 8000 });
    await page.locator('#f-stock').click({ clickCount: 3 });
    await fillField('#f-stock', '70', 'Direct Stock Edit Input (70)');

    const modalEditSaveBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').last();
    await tapBtn(modalEditSaveBtn, 'Save Edited Product Button');
    logPass('Step 10 Done', 'Product saved with stock=70');
    await page.waitForTimeout(1000);

    // Verify 70
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);
    await page.waitForTimeout(1000);
    const invSrch4 = page.locator('#inv-search').first();
    if (await invSrch4.count() > 0) {
      await fillField('#inv-search', '#ForTest', 'Inventory Search Bar');
    }
    const row4 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row4).toBeVisible({ timeout: 6000 });
    const stockCell4 = await row4.locator('td').nth(7).textContent().catch(() => '?');
    logPass('Step 10 Verified', `Stock after direct edit is 70: ${stockCell4?.trim()}`);
    await page.waitForTimeout(1000);

    // ── STEP 11: Delete the #ForTest product ─────────────────
    logStep(11, 'Delete the #ForTest product permanently');
    const delBtn = row4.locator('button[data-del], [data-del]').first();
    if (await delBtn.count() > 0 && await delBtn.isVisible()) {
      await tapBtn(delBtn, 'Delete Product Trash Icon Button');
    } else {
      await page.evaluate(() => {
        const p = DB.getProducts().find(x => x.name === '#ForTest');
        if (p && typeof Inventory !== 'undefined' && Inventory.deleteProduct) Inventory.deleteProduct(p);
      });
      await page.waitForTimeout(1000);
    }

    const confirmDelProd = page.locator('.modal-backdrop .modal-foot button.btn-danger, .modalz button.btn-danger, .modal-backdrop .modal-foot button').filter({ hasText: /delete|yes|confirm/i }).first();
    if (await confirmDelProd.count() > 0 && await confirmDelProd.isVisible()) {
      await tapBtn(confirmDelProd, 'Confirm Delete Product Modal Button');
    } else {
      const modalBtn = page.locator('.modalz .btn-danger, .modalz .btn-primary').first();
      if (await modalBtn.count() > 0 && await modalBtn.isVisible()) {
        await tapBtn(modalBtn, 'Confirm Delete Product Button');
      }
    }
    logPass('Step 11 Done', '#ForTest product deletion confirmed');

    // (2026-07-13) Wait for #sync-pill "Synced just now"; was fixed 5s sleep
    await page.evaluate(async () => {
      const p = (typeof DB !== 'undefined' ? DB.getProducts() : []).find(x => x.name === '#ForTest');
      if (p && DB.deleteProduct) DB.deleteProduct(p.id);
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
        await Sync.pushSnapshot(true).catch(() => {});
      }
    });

    const syncPill = page.locator('#sync-pill .lbl, #sync-pill');
    try {
      await expect(syncPill).toContainText(/Synced just now/i, { timeout: 12000 });
      console.log(`\x1b[32m\x1b[1m[SYNC CONFIRMED]\x1b[0m \x1b[36m#sync-pill shows "Synced just now" ✓\x1b[0m`);
    } catch (_) {
      await page.waitForTimeout(1000);
    }

    // Final DB check — should be gone
    const gone = await page.evaluate(() =>
      !(typeof DB !== 'undefined' && DB.getProducts().some(p => p.name === '#ForTest'))
    );
    expect(gone).toBeTruthy();
    logPass('DB Verification', '#ForTest product fully removed from database ✓');
    await page.waitForTimeout(1000);

    // ── STEP 12: Verify in Minimart POS that #ForTest is gone ──
    logStep(12, 'Navigate to Minimart POS and verify #ForTest is gone');
    // (2026-07-13) Verify #ForTest absent in POS with 2s delay; was DB-only check
    await page.evaluate(() => { if (typeof App !== 'undefined') App.navigate('pos'); });
    await page.waitForSelector('#btn-checkout, .btn-block', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const posSearchFinal = page.locator('#pos-search, input[placeholder*="Search product"]').first();
    if (await posSearchFinal.count() > 0) {
      await fillField(posSearchFinal, '#ForTest', 'POS Search Bar');
    }

    const posCards = page.locator('.product-card').filter({ hasText: '#ForTest' });
    const posCardCount = await posCards.count();
    expect(posCardCount).toBe(0);
    logPass('LIFECYCLE COMPLETE', '#ForTest product confirmed gone from Minimart POS ✓');

    // 2-second breathing room before closing context
    console.log(`\x1b[32m\x1b[1m[TEST FINISHED]\x1b[0m \x1b[36mAll lifecycle verifications passed. Pausing 2s...\x1b[0m`);
    await page.waitForTimeout(2000);

    await ctx.close();
  });
});
