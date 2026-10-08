# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: inventory\inventory.spec.js >> Inventory Multi-Device Synchronization >> Cross-tab edit cost and stock persists when switching between Tab A and Tab B
- Location: tests\inventory\inventory.spec.js:84:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#inv-tbody')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img "Route 98" [ref=e7]
    - generic [ref=e8]:
      - strong [ref=e9]: Route 98
      - generic [ref=e10]: Route98 POS System
  - generic [ref=e11]:
    - button "Cashier" [ref=e12] [cursor=pointer]
    - button "Admin" [ref=e16] [cursor=pointer]
  - combobox [ref=e23]:
    - option "Owner/Admin" [selected]
    - option "JP"
    - option "Sharon"
    - option "Elaicka / Ike"
  - paragraph [ref=e24]: Enter your 4-digit PIN
  - generic [ref=e30]:
    - button "1" [ref=e31] [cursor=pointer]
    - button "2" [ref=e32] [cursor=pointer]
    - button "3" [ref=e33] [cursor=pointer]
    - button "4" [ref=e34] [cursor=pointer]
    - button "5" [ref=e35] [cursor=pointer]
    - button "6" [ref=e36] [cursor=pointer]
    - button "7" [ref=e37] [cursor=pointer]
    - button "8" [ref=e38] [cursor=pointer]
    - button "9" [ref=e39] [cursor=pointer]
    - button "C" [ref=e40] [cursor=pointer]
    - button "0" [ref=e41] [cursor=pointer]
    - button [ref=e42] [cursor=pointer]
  - button "Change PIN" [ref=e46] [cursor=pointer]
```

# Test source

```ts
  9   |   test('Live snapshot sync reflects new and edited products across devices', async ({ browser }) => {
  10  |     logStep(1, 'Launch Store PC (Device A) and Home PC (Device B) contexts');
  11  |     const contextA = await browser.newContext({ viewport: { width: 780, height: 850 } });
  12  |     const contextB = await browser.newContext({ viewport: { width: 780, height: 850 } });
  13  | 
  14  |     const pageA = await contextA.newPage();
  15  |     const pageB = await contextB.newPage();
  16  | 
  17  |     await pageA.goto('http://127.0.0.1:8181/');
  18  |     await pageB.goto('http://127.0.0.1:8181/');
  19  |     await pageA.waitForLoadState('domcontentloaded');
  20  |     await pageB.waitForLoadState('domcontentloaded');
  21  |     logPass('Device A & B Loaded', 'Both browser contexts connected');
  22  | 
  23  |     logStep(2, 'Navigate both devices to Inventory table');
  24  |     await pageA.evaluate(() => {
  25  |       const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { role: 'admin', name: 'Admin' };
  26  |       if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
  27  |       if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
  28  |     });
  29  |     await pageB.evaluate(() => {
  30  |       const admin = (typeof DB !== 'undefined' ? DB.getUsers().find(u => u.role === 'admin') : null) || { role: 'admin', name: 'Admin' };
  31  |       if (typeof Auth !== 'undefined' && Auth.login) Auth.login(admin);
  32  |       if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
  33  |     });
  34  |     logPass('Navigation', 'Navigated to Inventory view');
  35  | 
  36  |     await pageA.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });
  37  |     await pageB.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });
  38  | 
  39  |     const countA = await pageA.evaluate(() => (typeof DB !== 'undefined' ? DB.getProducts().length : 0));
  40  |     const countB = await pageB.evaluate(() => (typeof DB !== 'undefined' ? DB.getProducts().length : 0));
  41  |     expect(countA).toBeGreaterThan(0);
  42  |     expect(countB).toBeGreaterThan(0);
  43  |     logPass('Catalog Verify', `Device A: ${countA} items | Device B: ${countB} items`);
  44  | 
  45  |     logStep(3, 'Device A adds a new product');
  46  |     const testBarcode = '99990002' + Math.floor(Math.random() * 1000);
  47  |     const testName = 'LIVE SYNC PRODUCT ' + Date.now();
  48  | 
  49  |     await pageA.locator('#btn-add-product, button:has-text("Add Product")').first().click();
  50  |     await pageA.waitForSelector('#prod-modal, .modal-dialog, #product-form', { timeout: 5000 });
  51  | 
  52  |     await pageA.fill('#prod-barcode, input[name="barcode"]', testBarcode);
  53  |     await pageA.fill('#prod-name, input[name="name"]', testName);
  54  |     await pageA.fill('#prod-price, input[name="price"]', '45.00');
  55  |     await pageA.fill('#prod-cost, input[name="cost"]', '30.00');
  56  |     await pageA.fill('#prod-stock, input[name="stock"]', '10');
  57  | 
  58  |     await pageA.locator('#btn-save-product, button:has-text("Save Product"), button:has-text("Save")').first().click();
  59  |     logPass('Device A Product Created', `${testName} saved`);
  60  | 
  61  |     logStep(4, 'Device B verifies real-time reflection via onSnapshot');
  62  |     let found = false;
  63  |     for (let i = 0; i < 20; i++) {
  64  |       found = await pageB.evaluate((name) => {
  65  |         return (typeof DB !== 'undefined' ? DB.getProducts() : []).some(p => p.name === name);
  66  |       }, testName);
  67  |       if (found) break;
  68  |       await pageB.waitForTimeout(600);
  69  |     }
  70  | 
  71  |     expect(found).toBeTruthy();
  72  |     logPass('Device B Real-Time Sync', `Product appeared on Device B via onSnapshot`);
  73  | 
  74  |     // Clean up
  75  |     await pageA.evaluate((code) => {
  76  |       DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
  77  |     }, testBarcode);
  78  |     logPass('Cleanup', `Test product removed`);
  79  | 
  80  |     await contextA.close();
  81  |     await contextB.close();
  82  |   });
  83  | 
  84  |   test('Cross-tab edit cost and stock persists when switching between Tab A and Tab B', async ({ browser }) => {
  85  |     logStep(1, 'Open Tab A and Tab B within the same browser context');
  86  |     const context = await browser.newContext({ viewport: { width: 800, height: 850 } });
  87  |     const tabA = await context.newPage();
  88  |     const tabB = await context.newPage();
  89  | 
  90  |     await tabA.goto('http://127.0.0.1:8181/');
  91  |     await tabB.goto('http://127.0.0.1:8181/');
  92  |     await tabA.waitForLoadState('domcontentloaded');
  93  |     await tabB.waitForLoadState('domcontentloaded');
  94  |     logPass('Tabs Loaded', 'Tab A and Tab B initialized');
  95  | 
  96  |     logStep(2, 'Navigate both tabs to Inventory');
  97  |     await tabA.evaluate(() => {
  98  |       sessionStorage.setItem("mm_session", JSON.stringify({ id: "u_admin", name: "Owner/Admin", role: "admin" }));
  99  |       if (typeof Auth !== 'undefined' && Auth.restoreSession) Auth.restoreSession();
  100 |       if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
  101 |     });
  102 |     await tabB.evaluate(() => {
  103 |       sessionStorage.setItem("mm_session", JSON.stringify({ id: "u_admin", name: "Owner/Admin", role: "admin" }));
  104 |       if (typeof Auth !== 'undefined' && Auth.restoreSession) Auth.restoreSession();
  105 |       if (typeof App !== 'undefined' && App.navigate) App.navigate('inventory');
  106 |     });
  107 |     logPass('Navigation', 'Navigated to Inventory view');
  108 | 
> 109 |     await tabA.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  110 |     await tabB.waitForSelector('#inv-tbody', { state: 'attached', timeout: 10000 });
  111 | 
  112 |     logStep(3, 'Tab B edits product cost and stock and saves');
  113 |     const testBarcode = 'EDIT-SYNC-' + Date.now();
  114 |     // Add product baseline
  115 |     await tabB.evaluate((code) => {
  116 |       DB.addProduct({
  117 |         name: 'SYNC TEST PRODUCT',
  118 |         barcode: code,
  119 |         cost: 0,
  120 |         price: 100,
  121 |         stock: 0,
  122 |         category: 'Misc'
  123 |       });
  124 |       if (typeof Sync !== 'undefined' && Sync.pushSnapshot) Sync.pushSnapshot(true);
  125 |     }, testBarcode);
  126 |     await tabB.waitForTimeout(1000);
  127 | 
  128 |     // Tab B updates cost to 75 and stock to 25
  129 |     await tabB.evaluate((code) => {
  130 |       const prod = DB.getProducts().find(p => p.barcode === code);
  131 |       if (prod) {
  132 |         DB.updateProduct(prod.id, { cost: 75, stock: 25, price: 120 });
  133 |         if (typeof Sync !== 'undefined' && Sync.pushSnapshot) Sync.pushSnapshot(true);
  134 |       }
  135 |     }, testBarcode);
  136 |     await tabB.waitForTimeout(1000);
  137 |     logPass('Tab B Edited', 'Updated cost to 75 and stock to 25');
  138 | 
  139 |     logStep(4, 'Switch to Tab A (simulating visibilitychange)');
  140 |     await tabA.bringToFront();
  141 |     await tabA.evaluate(() => {
  142 |       document.dispatchEvent(new Event('visibilitychange'));
  143 |       if (typeof Sync !== 'undefined' && Sync.pullSnapshot) return Sync.pullSnapshot(true);
  144 |     });
  145 |     await tabA.waitForTimeout(1500);
  146 | 
  147 |     const productInA = await tabA.evaluate((code) => {
  148 |       return DB.getProducts().find(p => p.barcode === code);
  149 |     }, testBarcode);
  150 | 
  151 |     expect(productInA).toBeTruthy();
  152 |     expect(productInA.cost).toBe(75);
  153 |     expect(productInA.stock).toBe(25);
  154 |     logPass('Tab A Verified', `Cost is ${productInA.cost}, Stock is ${productInA.stock}`);
  155 | 
  156 |     logStep(5, 'Switch back to Tab B and verify no reset occurred');
  157 |     await tabB.bringToFront();
  158 |     await tabB.evaluate(() => {
  159 |       document.dispatchEvent(new Event('visibilitychange'));
  160 |     });
  161 |     await tabB.waitForTimeout(1000);
  162 | 
  163 |     const productInB = await tabB.evaluate((code) => {
  164 |       return DB.getProducts().find(p => p.barcode === code);
  165 |     }, testBarcode);
  166 | 
  167 |     expect(productInB).toBeTruthy();
  168 |     expect(productInB.cost).toBe(75);
  169 |     expect(productInB.stock).toBe(25);
  170 |     logPass('Tab B Verified', `Cost remained ${productInB.cost}, Stock remained ${productInB.stock} (No reset to 0)`);
  171 | 
  172 |     // Clean up
  173 |     await tabA.evaluate((code) => {
  174 |       DB.setProducts(DB.getProducts().filter(p => p.barcode !== code));
  175 |       if (typeof Sync !== 'undefined' && Sync.pushSnapshot) Sync.pushSnapshot(true);
  176 |     }, testBarcode);
  177 | 
  178 |     await context.close();
  179 |   });
  180 | });
  181 | 
```