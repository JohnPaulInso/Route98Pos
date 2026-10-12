# Route 98 POS — Comprehensive Database, Sync & Calculation Audit Report

**Updated Audit Date**: October 2026  
**System Target**: Route 98 Minimart POS (`c:\Users\Lenovo\Desktop\Minimart POS`)  
**Scope**: Full end-to-end audit of all database operations across Minimart, Gasoline, Venue, and Restaurant units: fetching (`read`, getters), posting (`write`, setters, checkout, adjustments), displaying (filtering, date ranges, UI cards), financial calculations (P&L, COGS, OPEX, Net Profit, Shift drawer variance), and multi-device / cross-tab synchronization.

---

## Executive Summary

A comprehensive, line-by-line inspection of all database getters, setters, data pipelines, caching mechanisms, UI aggregations, and synchronization layers was conducted across the codebase.

While basic single-device point-of-sale functionality works on initial load, **critical discrepancies permeate database fetching, posting, displaying, and financial calculations**. Left uncorrected, these discrepancies cause severe accounting inaccuracies (such as double-deducting fuel tanker deliveries as both COGS and OPEX, and ghost shortages on shift closing), inventory corruption during physical counts, multi-device fuel tank level wipes, and permanent data loss from LocalStorage quota exhaustion.

---

## Comprehensive Discrepancy Matrix

| # | Discrepancy Category | Affected File(s) & Line(s) | Severity | Root Cause & Operational Impact |
|---|---|---|---|---|
| 1 | **Tombstone Auto-Purge Bug** | `js/db.js:404-416` | 🔴 **CRITICAL** | `getSales()` iterates through sales and executes `deletedIds.delete(sId)`. This deletes tombstone markers from `deletedSaleIds` in `localStorage`, destroying deletion history and causing voided/deleted sales to resurrect upon subsequent page loads or sync pulls. |
| 2 | **Cross-Tab Memory Cache Desynchronization** | `js/db.js:23-45` | 🔴 **CRITICAL** | `read(key)` checks in-memory `memCache.get(key)`. The app lacks a `window.addEventListener("storage", ...)` listener. If the POS is open across multiple tabs or windows, updates made in Tab A are completely invisible to Tab B until the entire browser page is hard-reloaded. |
| 3 | **Fuel Tank Delivery Erased by Sync** | `js/sync.js:163`<br>`js/db.js:1107` | 🔴 **CRITICAL** | During sync, fuel tanks are merged via `tank: Math.min(curFuel.tank, remoteFuel.tank)`. If Device A records a 4,000L fuel tanker delivery, Device B (which has not yet received the delivery) will push its lower tank level and `Math.min` will instantly erase the 4,000L delivery from the system. |
| 4 | **Physical Count Audit Stock Corruption** | `js/pos.js:578-586`<br>`js/inventory.js:786-806, 939-955` | 🔴 **CRITICAL** | Physical audit updates assign `product.stock = physicalCount`, immediately call `DB.adjustStock(id, diff)`, and then call `DB.setProducts(products)`. This double-adjusts stock (e.g. system stock 10, counted 8, diff -2 results in stock 6) and overwrites the database with stale product arrays. |
| 5 | **Fuel Delivery Double-Deduction in P&L** | `js/analytics.js:159-166`<br>`js/dashboard.js:186` | 🔴 **CRITICAL** | Tanker deliveries (`fuelDeliveries.totalCost`) are summed into `totalOperatingExpenses`. However, fuel COGS is already calculated when liters are sold (`liters * costPerL`). Counting deliveries as OPEX double-counts fuel inventory cost (once on delivery and again upon sale), severely distorting profitability. |
| 6 | **Executive Dashboard Net Profit Math Discrepancy** | `js/analytics.js:166`<br>`js/dashboard.js:186` | 🔴 **CRITICAL** | In `analytics.js`, `netProfit = grossProfit - shrinkage - opExpenses` (which excludes `fuelExpenses`). However, Card 3 on the Executive Dashboard displays `totalOperatingExpenses` (which includes `fuelExpenses`). Consequently, Gross Profit minus OPEX does not equal the Net Profit displayed on the executive strip. |
| 7 | **Wholesale Inventory Purchase Double-Deduction** | `js/expenses.js:273,298`<br>`js/analytics.js:158` | 🔴 **CRITICAL** | When a user records a "Wholesale Purchase" in Expenses, `expenses.js` logs an expense AND increases product stock/unit cost. When products sell, POS deducts COGS. However, `analytics.js` includes Wholesale Purchases in OPEX, resulting in double-deduction of inventory costs. |
| 8 | **UTC vs Local Philippines Timezone Cutoff (12 AM - 8 AM)** | `js/expenses.js:25,45`<br>`js/db.js:668,695,773`<br>`js/venue.js:18`<br>`js/restaurant.js:18` | 🔴 **CRITICAL** | Core modules use `new Date().toISOString().split("T")[0]`. In UTC+8 (Philippines), from 12:00 AM to 7:59 AM local time, `toISOString()` returns the previous day in UTC. Deliveries, expenses, and bookings entered early morning are stamped with yesterday's date and vanish from today's reports and shift reconciliations. |
| 9 | **Shift Z-Report Expected Cash & Variance Bug** | `js/reports.js:79,140`<br>`js/shift.js:86` | 🔴 **CRITICAL** | `reports.js` calculates expected drawer cash as `openingCash + cashSales`, completely omitting `cashIn` and `cashOut`. In contrast, `shift.js` uses `openingCash + cashSales + cashIn - cashOut`. Cashiers closing shifts from the Reports Z-Report receive false cash shortage errors when legitimate cash drops occurred. |
| 10 | **Zero Tombstones for Deleted Products** | `js/db.js:799-801`<br>`js/inventory.js:1001` | 🔴 **CRITICAL** | `deleteProduct` only filters the local memory array. There is no `deletedProductIds` set. Any sync pull or snapshot restore from another device immediately resurrects deleted products back into the catalog. |
| 11 | **Zero Tombstones for Fuel, Expenses & Bookings** | `js/db.js:682,762`<br>`js/sync.js:120-144` | 🔴 **HIGH RISK** | Voiding or deleting fuel sales, operating expenses, venue leads, bookings, or restaurant reservations has no tombstone tracking. Secondary devices resurrect deleted records upon synchronization. |
| 12 | **LocalStorage Quota Explosion via Backups & Offline Queue** | `js/sync.js:465`<br>`js/db.js:925`<br>`js/pos.js:836` | 🔴 **CRITICAL** | `saveBackup` saves full, uncompressed database snapshots into `localStorage`. Storing 4-5 backups easily exceeds the 5MB browser quota, causing `QuotaExceededError` and breaking data persistence. Furthermore, `pos.js` queues every online transaction to `offlineQueue`, which is only drained on reconnect events. |
| 13 | **Destructive `restoreSnapshot` Overwrite** | `js/db.js:1092-1135` | 🔴 **CRITICAL** | `restoreSnapshot` executes direct assignment (`setExpenses(snap.expenses)`, `setBookings(snap.bookings)`, `setFuelSales(snap.fuelSales)`) without 3-way merging local offline records. Local transactions and bookings created while offline are wiped out if a snapshot is restored. |
| 14 | **Missing `updatedAt` on Stock & Entity Mutations** | `js/db.js:792,795,813`<br>`js/expenses.js:273` | 🔴 **HIGH RISK** | `adjustStock`, `addProduct`, `updateProduct`, and wholesale inventory restocks do not assign `updatedAt: Date.now()`. Three-way merge cannot resolve conflict based on recency and defaults to local or remote arbitrarily. |
| 15 | **Sale Alteration / Item Void Leaves VAT Incoherent** | `js/reports.js:508-513` | 🟡 **MEDIUM** | When items are voided from a sale, `reports.js` updates `subtotal` and `total` but fails to recalculate `vat` and `netOfVat`, breaking tax coherence (`total !== netOfVat + vat`). Additionally, it sets `alteredAt` instead of `ts`, causing `threeWayMerge` (which compares `ts`) to discard the void during sync. |
| 16 | **Expense Timestamp vs Incurred Date in Analytics** | `js/analytics.js:158-159` | 🟡 **MEDIUM** | `analytics.js` filters expenses by `e.ts >= r.start && e.ts <= r.end` (the entry timestamp) rather than `e.date` (when the bill was incurred). Backdated expenses entered today distort current period's P&L. |
| 17 | **Hardcoded All-Time Purchases Filter in Analytics** | `js/analytics.js:168` | 🟡 **MEDIUM** | `computeStats` unconditionally passes `"all"` to `restockSummary("all")`. The Total Purchases metric on the Dashboard always displays all-time capital spent regardless of whether Today or This Week is selected. |
| 18 | **Single Global Shift Overwrite Across Registers** | `js/shift.js:52-87`<br>`js/db.js:630` | 🔴 **HIGH RISK** | `DB.getShift()` stores a single active shift object. Multiple devices operating concurrent shifts (e.g. Minimart cashier and Gas Station pump attendant) overwrite each other's open shift. Furthermore, all sales across all business units get combined into the single active drawer. |
| 19 | **Multi-Shift Day Balances Overwrite** | `js/shift.js:381-384`<br>`js/reports.js:175-178` | 🟡 **MEDIUM** | `dayBalances[todayKey]` stores a single `endingBalance` per calendar date. When a morning shift and an evening shift run on the same day, the second shift overwrites the first shift's closing balance. |
| 20 | **Admin Checkout Cashier Display Mismatch** | `js/auth.js:89-91`<br>`js/pos.js:832` | 🟡 **MEDIUM** | Admin login does not set `pos_cashier` in `localStorage`. When an Admin checks out a sale, the sale record and printed receipt attribute the transaction to whichever cashier was logged in previously. |
| 21 | **Complete Absence of Tax & VAT Reporting** | `js/reports.js` | 🟡 **MEDIUM** | While `pos.js` computes 12% VAT, stores `vat` on transactions, and prints tax breakdowns on receipts, `reports.js` contains zero VAT calculations, summaries, or tax liability reporting. |
| 22 | **Unloaded `realtime-sync.js` Dead Code** | `js/realtime-sync.js`<br>`index.html` | 🟡 **MEDIUM** | `realtime-sync.js` was created as a Firebase Realtime Database multi-device sync module, but is not included in `index.html`. All multi-device sync remains dependent on snapshot polling in `sync.js`. |

---

## Detailed Technical Analysis

### 1. Database Fetching & Caching Layer

#### 1.1 `getSales()` Tombstone Auto-Purge (`js/db.js:404-416`)
- **Mechanism**: When `getSales()` is called, it loads all deduplicated sales and retrieves `deletedSaleIds`. It then iterates through all sales:
  ```javascript
  if (deletedIds.has(sId) || deletedIds.has(clean)) {
    deletedIds.delete(sId);
    cleaned = true;
  }
  if (cleaned) write(KEYS.deletedSaleIds, Array.from(deletedIds), true);
  ```
- **Consequence**: Any deleted sale still lingering in raw memory or LocalStorage purges its own tombstone from `deletedSaleIds`. On subsequent calls, `deletedIds` is empty, causing deleted transactions to resurrect and re-appear in reports and sales history.
- **Remedy**: Never delete IDs from `deletedSaleIds` inside `getSales()`. Deletion markers must remain persistent until explicitly purged by user action.

#### 1.2 Cross-Tab Memory Cache Staleness (`js/db.js:23-45`)
- **Mechanism**: `DB.read(key)` caches results in `memCache = new Map()`.
- **Consequence**: When Tab A performs a write, Tab B never receives a notification because there is no `window.addEventListener("storage", ...)` listener to clear `memCache`. Tab B continues serving stale data indefinitely.
- **Remedy**: Attach a `window.addEventListener("storage", (e) => { memCache.delete(e.key); })` event handler to invalidate memory cache on external storage events.

#### 1.3 LocalStorage Quota Depletion (`js/sync.js:465`, `js/db.js:925`)
- **Mechanism**: `Sync.createDailyBackup` and `DB.saveBackup` serialize the entire database snapshot and prepend it to an array under `mm_backups`.
- **Consequence**: Full snapshots average 500KB - 1.5MB. Storing multiple backups rapidly hits the browser's 5MB LocalStorage limit, throwing unhandled `QuotaExceededError` exceptions that silently drop subsequent sales writes.
- **Remedy**: Strip full data snapshots from LocalStorage backups, storing only metadata summaries locally while uploading full payloads to Firestore or IndexedDB.

---

### 2. Posting, Adjustments & Inventory Operations

#### 2.1 Physical Count Audit Stock Corruption (`js/pos.js:578-586`, `js/inventory.js:786-806`)
- **Mechanism**: In both POS stock verification and Inventory physical count audits:
  ```javascript
  product.stock = physicalCount;
  DB.adjustStock(product.id, diff, ...);
  DB.setProducts(products);
  ```
- **Consequence**: `product.stock` is updated in the local array to `physicalCount`. Then `DB.adjustStock` applies `diff` (`physicalCount - systemStock`) to the database. Finally, `DB.setProducts(products)` overwrites the database with the pre-adjustment array. If multiple items are audited, adjustments compound incorrectly, corrupting physical inventory counts.
- **Remedy**: Directly assign `product.stock = physicalCount`, assign `product.updatedAt = Date.now()`, record the audit log, and perform a single `DB.setProducts(products)` write.

#### 2.2 Missing Tombstones for Products, Expenses & Bookings
- **Mechanism**: `DB.deleteProduct(id)`, `DB.deleteExpense(id)`, and `DB.deleteBooking(id)` simply filter the local array.
- **Consequence**: During multi-device 3-way merge, the remote device still contains the item in its catalog. Because there is no tombstone record, the remote item is merged back in, resurrecting deleted products, expenses, and bookings.
- **Remedy**: Implement dedicated tombstone sets (`deletedProductIds`, `deletedExpenseIds`, `deletedBookingIds`) mirrored in snapshots and 3-way merge.

---

### 3. Financial Calculations & Reporting Modules

#### 3.1 Fuel Delivery Double-Deduction in Analytics (`js/analytics.js:159-166`)
- **Mechanism**:
  ```javascript
  const fuelCOGS = fuelSales.reduce((s,x)=> s + (x.costPerL ?? fuelCfg.fuels[x.fuelType]?.cost ?? 65) * x.liters, 0);
  const fuelExpenses = DB.getFuelDeliveries().reduce((s,x)=>s+(x.totalCost||0), 0);
  const totalOperatingExpenses = opExpenses + fuelExpenses;
  ```
- **Consequence**: Fuel tanker deliveries represent inventory acquisition, not operating expenses. Adding tanker costs to OPEX while simultaneously deducting fuel COGS on sales double-deducts the cost of fuel.
- **Remedy**: Classify fuel tanker deliveries as Inventory Restock (Capital Outlay), excluding them from Operating Expenses (OPEX).

#### 3.2 Shift Z-Report Expected Drawer Cash Variance (`js/reports.js:79,140`)
- **Mechanism**: In `reports.js`, expected cash is computed as:
  ```javascript
  const expected = (currentShift.openingCash || 0) + cashIn; // cashIn is cashSales
  const variance = actualCash - expected;
  ```
- **Consequence**: Petty cash drops (`cashOut`) and cash injections (`cashIn`) recorded during the shift are omitted from the equation. Cashiers closing shifts through Reports receive severe false shortage variances.
- **Remedy**: Align `reports.js` shift calculation with `shift.js`: `expectedCash = openingCash + cashSales + cashIn - cashOut`.

#### 3.3 Wholesale Purchases Double-Deduction (`js/expenses.js:273,298`)
- **Mechanism**: Wholesale purchases recorded under Expenses log an operating expense AND increase product stock with `cost = unitCost`.
- **Consequence**: When items are sold, POS deducts their COGS. Operating expenses also deduct the purchase price, double-counting the inventory cost against Net Profit.
- **Remedy**: Filter out `category === "Wholesale Purchases"` from operating expenses when calculating Net Profit in `analytics.js`.

---

### 4. Timezone & Temporal Discrepancies

#### 4.1 Midnight to 8:00 AM UTC+8 Date Split
- **Mechanism**: `expenses.js`, `db.js`, `venue.js`, `restaurant.js`, and `importExport.js` generate date strings using `new Date().toISOString().split("T")[0]`.
- **Consequence**: In Philippine Standard Time (UTC+8), the local date changes at 12:00 AM, but `toISOString()` remains on the previous UTC day until 8:00 AM.
  - Transactions, expenses, tanker deliveries, and bookings recorded between 12:00 AM and 7:59 AM receive yesterday's calendar date.
  - Reports and shifts use local date (`toLocaleDateString("en-CA")`), causing morning entries to disappear from "Today's" reports and daily summaries.
- **Remedy**: Standardize all date string generation on local timezone formatting (`new Date().toLocaleDateString("en-CA")`).

---

## Prioritized Implementation Roadmap

1. **Phase 1: High-Risk Data Loss & Corruption Fixes**
   - Eliminate tombstone auto-purge in `DB.getSales()` (`js/db.js`).
   - Fix physical count audit double-adjustment in `js/pos.js` and `js/inventory.js`.
   - Prevent fuel tank delivery erasure in `threeWayMerge` and `restoreSnapshot`.
   - Add cross-tab storage event listener in `js/db.js`.
   - Stop unbounded growth of `offlineQueue` in `js/pos.js`.

2. **Phase 2: Financial & Accounting Rectification**
   - Correct P&L double-deductions (fuel deliveries and wholesale purchases excluded from OPEX in `js/analytics.js`).
   - Reconcile shift Z-report expected cash formula in `js/reports.js` to account for `cashIn` and `cashOut`.
   - Align Executive Dashboard net profit formula and OPEX card display.
   - Recalculate VAT and net of VAT upon sale alteration / item voiding in `js/reports.js`.

3. **Phase 3: Timezone & Date Consistency**
   - Replace all instances of `toISOString().split("T")[0]` with `toLocaleDateString("en-CA")` across `expenses.js`, `db.js`, `venue.js`, `restaurant.js`, and `importExport.js`.
   - Filter expenses in `analytics.js` by incurred date (`e.date`) instead of entry timestamp.

4. **Phase 4: Multi-Device Tombstones & Storage Safety**
   - Add tombstone tracking for products (`deletedProductIds`), expenses (`deletedExpenseIds`), and bookings (`deletedBookingIds`).
   - Strip full data snapshots from LocalStorage backup entries (`mm_backups`), retaining only lightweight summaries locally.

---

## 5. Deep Scan: Inventory, POS, Shift & Restock Discrepancies

| ID | Discrepancy | Location | Severity | Root Cause & Real-World Impact | Resolution Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 23 | **Batch Product Delete Tombstone Omission** | `js/inventory.js:1030` | 🔴 **HIGH RISK** | Batch delete (`deleteSelected`) directly filtered the array via `DB.setProducts` instead of invoking `DB.deleteProduct`, omitting `deletedProductIds` tombstones and causing deleted products to resurrect on subsequent cloud sync cycles. | ✅ **FIXED** (Invokes `DB.deleteProduct` per item) |
| 24 | **Batch Restock Missing `p.updatedAt` & ID Mismatch** | `js/inventory.js:1500-1518` | 🔴 **HIGH RISK** | Batch restock increments `p.stock` without updating `p.updatedAt`. When syncing with another device, remote items with older unchanged timestamps overwrote the restocked quantities. Also passed `p.barcode` instead of `p.id` into restock logs. | ✅ **FIXED** (`p.updatedAt` set and `p.id` assigned) |
| 25 | **Restock Log Conflict Resolution Timestamp Failure** | `js/db.js:533-542`<br>`js/sync.js:80-96` | 🔴 **HIGH RISK** | `addRestockLog` populated `timestamp` but omitted `ts` and `updatedAt`. `mergeArray3Way` defaulted conflict resolution timestamps to `0 > 0`, breaking 3-way merge and always favoring local records regardless of cloud recency. | ✅ **FIXED** (`ts` and `updatedAt` added to logs and 3-way merge fallback) |
| 26 | **Restock Log Edit & Delete Product Rollback Missing Timestamp** | `js/db.js:559, 577` | 🔴 **HIGH RISK** | Rolling back product stock on restock log deletion or editing did not assign `p.updatedAt = Date.now()`, causing remote products to overwrite the rolled back inventory count upon sync. Also failed to roll back negative shrinkage adjustments. | ✅ **FIXED** (`p.updatedAt` set and negative delta rollbacks supported) |
| 27 | **Product Form Edit Stock Audit Trail Bypass** | `js/inventory.js:279-294` | 🟡 **MEDIUM** | Editing an existing product in the product modal and changing its stock quantity directly bypassed restock logs and stock audit logs, leaving zero audit trail for inventory variance. | ✅ **FIXED** (Audit log recorded on stock delta) |
| 28 | **Unprotected `RealtimeSync` Exceptions in Shift & Inventory** | `js/shift.js:214, 275, 401`<br>`js/inventory.js:372` | 🔴 **HIGH RISK** | `RealtimeSync.openShift`, `closeShift`, and `adjustStockAtomic` were invoked without `typeof RealtimeSync !== "undefined"` checks, throwing fatal `ReferenceError` crashes that halted cash drawer opening and modal dismissal when realtime sync is disabled. | ✅ **FIXED** (Safely guarded with `typeof RealtimeSync !== "undefined"`) |
| 29 | **Camera Continuous Scan Pack-Pricing Defect** | `js/pos.js:908-912` | 🔴 **HIGH RISK** | Continuous camera scanning added items using default piece price and 1 unit of stock even when scanning full pack barcodes (`packBarcode`), undercharging customers and under-deducting stock. | ✅ **FIXED** (Detects `packBarcode` and adds as `pack` unitType) |
| 30 | **Shift Log Duplication on Re-save** | `js/db.js:646-649` | 🟡 **MEDIUM** | `DB.saveShiftLog` prepended logs without filtering existing records with the same `id`, causing duplicate shift history records on repeated saves or re-syncs. | ✅ **FIXED** (Deduplicates by `l.id !== item.id`) |

