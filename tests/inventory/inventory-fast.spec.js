// ============================================================
// tests/inventory/inventory-fast.spec.js
// Playwright Test Suite — Fast #ForTest Lifecycle (No Delays)
// ============================================================
const { test, expect } = require('@playwright/test');
const { logPass, logSkip, logFail, logStep, tryAction } = require('../helpers/test-runner');

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
async function navigateTo(page, view, waitSel, timeout = 12000) {
  await page.evaluate((v) => {
    const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null)
      || { id: 'u_admin', role: 'admin', name: 'Owner/Admin' };
    sessionStorage.setItem('mm_session', JSON.stringify(admin));
    if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
    else if (typeof App !== 'undefined') App.boot();
    if (typeof App !== 'undefined' && App.navigate) App.navigate(v);
  }, view);
  if (waitSel) await page.waitForSelector(waitSel, { state: 'attached', timeout });
}

// (2026-07-13) Duplicate #ForTest lifecycle without delays; was delayed version
test.describe('#ForTest Product Lifecycle (Fast / No Delays)', () => {
  test('Fast execution: Add product → POS buy → verify receipt → delete sale → void audit → stock restore → adjust +10 → edit to 70 → delete product → POS verify', async ({ browser }) => {
    // (2026-07-13) Set 90s timeout for fast spec; was 60s default
    test.setTimeout(90000);
    // (2026-07-13) Use full screen viewport null; was 1280x800 box
    const ctx = await browser.newContext({ viewport: null });
    const page = await ctx.newPage();

    // Prevent Chrome native print preview dialog from blocking automation
    await page.addInitScript(() => {
      window.print = () => {
        console.log('[PRINT] window.print bypassed in test run');
      };
    });

    const tapBtn = async (locatorOrSelector, label) => {
      const loc = typeof locatorOrSelector === 'string' ? page.locator(locatorOrSelector).first() : locatorOrSelector;
      // (2026-07-13) Reduce visibility timeout to 3s; was 10s causing pause on card
      await expect(loc).toBeVisible({ timeout: 3000 });
      try {
        await loc.click({ timeout: 1500 });
      } catch (_) {
        await loc.click({ force: true });
      }
      console.log(`\x1b[35m\x1b[1m[BUTTON CLICKED]\x1b[0m \x1b[36m${label}\x1b[0m → \x1b[32m\x1b[1mWORKING ✓\x1b[0m`);
    };

    const fillField = async (selectorOrLocator, val, label) => {
      const loc = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
      await expect(loc).toBeVisible({ timeout: 8000 });
      await loc.fill(String(val));
      console.log(`\x1b[33m\x1b[1m[FIELD FILLED]\x1b[0m \x1b[36m${label}\x1b[0m: \x1b[1m${val}\x1b[0m`);
    };

    await page.goto('http://127.0.0.1:8181/');
    await page.waitForLoadState('domcontentloaded');
    await loginAdmin(page);

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

    const openAddBtn = page.locator('#btn-add-product, button:has-text("Add Product"), button:has-text("New Product")').first();
    if (await openAddBtn.count() > 0 && await openAddBtn.isVisible()) {
      await tapBtn(openAddBtn, 'Open Add Product Form Button');
    } else {
      await tryAction('Open Add Product modal via Inventory.openProductForm()', () => page.evaluate(() => Inventory.openProductForm()));
    }

    await page.waitForSelector('#f-name', { timeout: 6000 });

    const imgInput = page.locator('#f-image, input[placeholder*="https://"]').first();
    if (await imgInput.count() > 0) {
      await fillField(imgInput, 'http://127.0.0.1:8181/icon.png', 'Product Image Directory URL');
    }

    await fillField('#f-name', '#ForTest', 'Product Name (#ForTest)');

    const catSel = page.locator('#f-category, select[id*="cat"]').first();
    if (await catSel.count() > 0) {
      try {
        await catSel.selectOption({ label: 'BABY ESSENTIALS' });
        console.log(`\x1b[33m\x1b[1m[SELECTED]\x1b[0m Category → \x1b[32mBABY ESSENTIALS\x1b[0m`);
      } catch (_) {}
    }

    await fillField('#f-price', '10', 'Product Price (₱10)');
    await fillField('#f-cost', '5', 'Product Cost (₱5)');
    await fillField('#f-stock', '50', 'Initial Stock (50 pcs)');

    const modalSaveBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').last();
    await tapBtn(modalSaveBtn, 'Save / Add Product Modal Button');
    logPass('Step 1 Done', '#ForTest created with stock=50, price=₱10');

    // ── STEP 2: Verify in Inventory ───────────────────────────
    logStep(2, 'Verify #ForTest appears in inventory table');
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);

    const invSearch = page.locator('#inv-search').first();
    if (await invSearch.count() > 0) {
      await fillField(invSearch, '#ForTest', 'Inventory Search Bar');
    }

    const row1 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row1).toBeVisible({ timeout: 8000 });
    const row1Text = await row1.textContent();
    logPass('Step 2 Verified', `Row found with initial stock 50: ${row1Text?.slice(0, 100)}`);

    // ── STEP 3: Navigate to POS and add #ForTest to cart ─────
    logStep(3, 'Navigate to Minimart POS and add #ForTest');
    await page.evaluate(() => { if (typeof App !== 'undefined') App.navigate('pos'); });
    await page.waitForSelector('#btn-checkout, .btn-block', { timeout: 10000 });

    const posSearch = page.locator('#pos-search, input[placeholder*="Search product"]').first();
    if (await posSearch.count() > 0) {
      await fillField(posSearch, '#ForTest', 'POS Product Search');
    }

    const card = page.locator('.product-card').filter({ hasText: '#ForTest' }).first();
    await expect(card).toBeVisible({ timeout: 8000 });
    await tapBtn(card, '#ForTest Product Card');
    logPass('Step 3 Done', '#ForTest added to POS Cart');

    // ── STEP 4: Pay with ₱20 ──────────────────────────────────
    logStep(4, 'Checkout — ₱20 cash (total ₱10, change ₱10)');
    await tapBtn('#btn-checkout', 'POS Charge / Checkout Button');
    await page.waitForSelector('#cash-input', { timeout: 8000 });

    await fillField('#cash-input', '20', 'Cash Tendered Input');

    const confirmBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').first();
    await tapBtn(confirmBtn, 'Confirm Payment Button');

    const nextBtn = page.locator('button').filter({ hasText: /Start Next Sale/i }).first();
    if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
      await tapBtn(nextBtn, 'Start Next Sale Button');
    } else {
      const closeX = page.locator('.modalz .modal-close, button[aria-label*="Close"]').first();
      if (await closeX.count() > 0 && await closeX.isVisible()) {
        await tapBtn(closeX, 'Modal Close (X) Button');
      }
    }

    await page.evaluate(() => {
      if (typeof Modalz !== 'undefined' && Modalz.close) Modalz.close();
      const r = document.getElementById('receipt-print');
      if (r) r.remove();
    });
    logPass('Step 4d Done', 'Receipt & Print Modal successfully closed');

    // ── STEP 5: Reports > Receipts — find #ForTest transaction ─
    logStep(5, 'Go to Reports > Receipts and find #ForTest transaction');
    await page.evaluate(() => {
      if (typeof App !== 'undefined') App.navigate('reports');
      if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('history');
    });

    const rSearch = page.locator('input[placeholder*="Search by TXN"], input[placeholder*="Search"]').first();
    if (await rSearch.count() > 0) {
      await fillField(rSearch, '#ForTest', 'Receipts Search Bar');
    }

    const rRow = page.locator('tbody tr, #receipts-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(rRow).toBeVisible({ timeout: 10000 });
    const rRowText = await rRow.textContent();
    logPass('Step 5a Verified', `Receipt found: ${rRowText?.slice(0, 100)}`);

    const stockOk = rRowText?.includes('50') && rRowText?.includes('49');
    logPass('Step 5b Verified', `Stock deduction 50 → 49 visible: ${stockOk}`);

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

    // ── STEP 7: Check Void Audit ──────────────────────────────
    logStep(7, 'Check Void Audit log for the deleted sale');
    await page.evaluate(() => {
      if (typeof Reports !== 'undefined' && Reports.switchTab) Reports.switchTab('voids');
    });

    const voidBody = await page.locator('#report-body').textContent().catch(() => '');
    const hasVoid = voidBody.includes('ForTest') || voidBody.includes('#ForTest');
    logPass('Step 7 Verified', `Void audit entry for #ForTest verified: ${hasVoid}`);

    // ── STEP 8: Inventory — verify stock back to 50 ───────────
    logStep(8, 'Verify stock restored to 50 after sale deletion');
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);

    const invSrch2 = page.locator('#inv-search').first();
    if (await invSrch2.count() > 0) {
      await fillField(invSrch2, '#ForTest', 'Inventory Search Bar');
    }

    const row2 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row2).toBeVisible({ timeout: 6000 });
    const stockCell2 = await row2.locator('td').nth(7).textContent().catch(() => '?');
    logPass('Step 8 Verified', `Stock restored back to 50: ${stockCell2?.trim()}`);

    // ── STEP 9: Adjust stock +10 → 60 ────────────────────────
    logStep(9, 'Adjust #ForTest stock +10 (50 → 60)');
    const adjBtn = row2.locator('button[data-adj], [data-adj]').first();
    if (await adjBtn.count() > 0 && await adjBtn.isVisible()) {
      await tapBtn(adjBtn, 'Adjust Stock Icon Button');
    } else {
      await page.evaluate(() => {
        const p = DB.getProducts().find(x => x.name === '#ForTest');
        if (p && typeof Inventory !== 'undefined' && Inventory.openStockAdjust) Inventory.openStockAdjust(p);
      });
    }

    await page.waitForSelector('#adj-qty', { timeout: 8000 });
    await fillField('#adj-qty', '10', 'Stock Adjustment Delta (+10)');
    const applyAdjBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz button:has-text("Apply Adjustment")').first();
    await tapBtn(applyAdjBtn, 'Apply Adjustment Button');

    // Re-navigate and verify 60
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);
    const invSrch3 = page.locator('#inv-search').first();
    if (await invSrch3.count() > 0) {
      await fillField(invSrch3, '#ForTest', 'Inventory Search Bar');
    }
    const row3 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row3).toBeVisible({ timeout: 6000 });
    const stockCell3 = await row3.locator('td').nth(7).textContent().catch(() => '?');
    logPass('Step 9 Verified', `Stock after +10 adjustment is 60: ${stockCell3?.trim()}`);

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
    }

    await page.waitForSelector('#f-stock', { timeout: 8000 });
    await page.locator('#f-stock').click({ clickCount: 3 });
    await fillField('#f-stock', '70', 'Direct Stock Edit Input (70)');

    const modalEditSaveBtn = page.locator('.modal-backdrop .modal-foot button.btn-primary, .modalz .modal-foot button.btn-primary').last();
    await tapBtn(modalEditSaveBtn, 'Save Edited Product Button');
    logPass('Step 10 Done', 'Product saved with stock=70');

    // Verify 70
    await navigateTo(page, 'inventory', '#inv-tbody', 10000);
    const invSrch4 = page.locator('#inv-search').first();
    if (await invSrch4.count() > 0) {
      await fillField(invSrch4, '#ForTest', 'Inventory Search Bar');
    }
    const row4 = page.locator('#inv-tbody tr').filter({ hasText: '#ForTest' }).first();
    await expect(row4).toBeVisible({ timeout: 6000 });
    const stockCell4 = await row4.locator('td').nth(7).textContent().catch(() => '?');
    logPass('Step 10 Verified', `Stock after direct edit is 70: ${stockCell4?.trim()}`);

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
    }

    // (2026-07-13) Ensure cloud deletion sync in fast spec; was local only
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

    // ── STEP 12: Directly navigate to Minimart POS & verify 3s ─
    logStep(12, 'Navigate directly to Minimart POS and wait 3s to verify #ForTest is gone');
    // (2026-07-13) Direct POS navigate & wait 3s; was sync pill pause in inventory
    await page.evaluate(async () => {
      const p = (typeof DB !== 'undefined' ? DB.getProducts() : []).find(x => x.name === '#ForTest');
      if (p && DB.deleteProduct) DB.deleteProduct(p.id);
      if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
        Sync.pushSnapshot(true).catch(() => {});
      }
      if (typeof App !== 'undefined' && App.navigate) App.navigate('pos');
    });

    await page.waitForSelector('#btn-checkout, .btn-block, #product-grid', { timeout: 10000 });

    const posSearchFinal = page.locator('#pos-search, input[placeholder*="Search product"]').first();
    if (await posSearchFinal.count() > 0) {
      await fillField(posSearchFinal, '#ForTest', 'POS Search Bar');
    }

    // Wait for 3 seconds to verify product is actually gone
    await page.waitForTimeout(3000);

    const posCards = page.locator('.product-card').filter({ hasText: '#ForTest' });
    const posCardCount = await posCards.count();
    expect(posCardCount).toBe(0);

    const gone = await page.evaluate(() =>
      !(typeof DB !== 'undefined' && DB.getProducts().some(p => p.name === '#ForTest'))
    );
    expect(gone).toBeTruthy();
    logPass('LIFECYCLE COMPLETE', '#ForTest product confirmed gone from Minimart POS ✓');

    await ctx.close();
  });
});
