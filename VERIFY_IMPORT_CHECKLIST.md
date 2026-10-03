# Import Verification Checklist

After importing `export_items (8).csv`, use this checklist to verify everything imported correctly.

---

## ✅ Step 1: Check Import Results Screen

Immediately after import, verify:

- [ ] **Total items processed**: Should be ~703
- [ ] **New products**: Number of items added
- [ ] **Updated**: Number of existing items updated  
- [ ] **Skipped**: Items not available for sale
- [ ] **Errors**: Should be 0 or very low
- [ ] **Success message**: Green checkmark displayed

---

## ✅ Step 2: Verify Product Count

1. Go to **Inventory** view
2. Check top bar shows total items
3. Expected: ~703 items (or your expected count)

**Check:**
- [ ] Item count matches expected number
- [ ] No error messages displayed

---

## ✅ Step 3: Spot Check Prices (Critical!)

Pick 3-5 random products from your CSV and verify:

### Example Product: "555 SARDINES 155G"

**From CSV:**
- Cost (Column M): ₱23.45
- Price (Column S): ₱26.00

**In Route 98:**
1. Search for "555 SARDINES"
2. Click to view details
3. Verify:
   - [ ] Cost = ₱23.45 ✅
   - [ ] Price = ₱26.00 ✅
   - [ ] Stock matches CSV
   - [ ] Barcode matches CSV

**Repeat for 2-4 more products.**

---

## ✅ Step 4: Check Categories

1. In Inventory, check category filter dropdown
2. Verify categories from CSV are present
3. Click each category chip
4. Verify products appear in correct categories

**Check:**
- [ ] All categories imported
- [ ] Products correctly categorized
- [ ] Category counts look reasonable

---

## ✅ Step 5: Verify Stock Levels

1. Sort by "Stock" column
2. Check a few high-stock items
3. Check a few low-stock items
4. Verify stock numbers match CSV

**Check:**
- [ ] Stock quantities match CSV
- [ ] Low stock alerts showing correctly
- [ ] Out of stock items marked correctly

---

## ✅ Step 6: Test Search & Barcode

1. Search for a product by name
2. Search for a product by barcode
3. Test barcode scanner (if available)

**Check:**
- [ ] Search by name works
- [ ] Search by barcode works
- [ ] Scanner finds products correctly

---

## ✅ Step 7: Check Cost vs Price

This is the **most important** verification!

### Manual Calculation:
Pick any product and verify profit calculation:

**Example:**
- Cost: ₱23.45
- Price: ₱26.00
- Expected Profit: ₱2.55 (26.00 - 23.45)
- Expected Margin: 9.8% (2.55 / 26.00 × 100)

**In Route 98:**
1. Find the product in inventory table
2. Check "Potential Profit" column
3. Verify profit per unit is correct

**Check:**
- [ ] Profit = Price - Cost (correct formula)
- [ ] Profit is positive (not negative!)
- [ ] Profit margin looks reasonable

---

## ⚠️ Red Flags (If You See These, Something's Wrong)

### ❌ **Negative Profit**
- Cost is higher than price
- **Likely cause**: Columns swapped
- **Fix**: Re-export CSV and verify Column M = Cost, Column S = Price

### ❌ **All Items Skipped**
- "Available for sale" might be "N" for all items
- **Fix**: Update CSV or Loyverse export settings

### ❌ **Prices Look Too Low**
- Cost and Price might be swapped
- **Check**: Cost should be lower than Price
- **Fix**: Verify CSV columns

### ❌ **0 Items Imported**
- CSV might be malformed
- **Fix**: Check CSV opens correctly in Excel
- Verify headers are in first row

---

## ✅ Step 8: Test a Sale (Optional but Recommended)

1. Go to **POS** view
2. Search for an imported product
3. Add to cart
4. Verify price shows correctly
5. Complete test sale (or cancel)

**Check:**
- [ ] Product appears in POS search
- [ ] Price matches inventory
- [ ] Sale calculates correctly

---

## ✅ Step 9: Backup (Recommended)

After verifying import is correct:

1. Go to **Settings** → **Data & Backups**
2. Click "Create Manual Backup"
3. Save backup file with date

**This protects your imported data!**

---

## ✅ Step 10: Sync to Cloud (If Needed)

If you want data on other devices:

1. Go to **Settings** → **Data & Backups**
2. Find "Manual Sync" section
3. Click "Sync Now"
4. Wait for completion
5. Check other devices see the data

**Check:**
- [ ] Sync completes successfully
- [ ] Other devices show imported products
- [ ] No sync errors

---

## 🎯 Final Verification Summary

### Must Check:
- ✅ Import completed with minimal errors
- ✅ Product count matches expected
- ✅ **Cost and Price are CORRECT** (most critical!)
- ✅ Stock levels match CSV
- ✅ Categories imported correctly

### Should Check:
- ✅ Search works correctly
- ✅ Barcodes work correctly
- ✅ Products appear in POS

### Nice to Check:
- ✅ Test sale completes
- ✅ Backup created
- ✅ Cloud sync (if needed)

---

## 📋 Common Values to Verify

Use these examples from your CSV to verify:

| Product | Cost (Col M) | Price (Col S) | Expected Profit |
|---------|-------------|---------------|-----------------|
| #StyroCups w/ stirrer | ₱0.00 | ₱5.00 | ₱5.00 |
| 1 Case Softdrinks | ₱210.00 | ₱230.00 | ₱20.00 |
| 555 SARDINES 155G | ₱23.45 | ₱26.00 | ₱2.55 |

Pick 3-5 of these and verify in your system.

---

## ✅ All Good?

If all checks pass, you're done! Your inventory is successfully imported with accurate cost and pricing.

## ❌ Found Issues?

See `INVENTORY_IMPORT_GUIDE.md` → Troubleshooting section for help.
