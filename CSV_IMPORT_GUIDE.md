# CSV Transaction Import Guide

## Overview
The CSV Import feature allows you to import transaction history from Loyverse or other POS systems into Route 98. This is perfect for migrating historical sales data or importing bulk transactions.

## How to Import Transactions

### Step 1: Prepare Your CSV Files
You need TWO CSV files for a complete import:

1. **Receipts CSV** (main file)
   - Filename example: `receipts-2026-09-20-2026-10-02.csv`
   - Contains: Receipt-level data (date, total, payment method, cashier, etc.)

2. **Items CSV** (line items breakdown)
   - Filename example: `receipts-by-item-2026-09-20-2026-10-02.csv`
   - Contains: Individual items sold in each receipt with quantities and prices

### Step 2: Access the Import Tool
1. Open Route 98 POS
2. Go to **Reports** section
3. Click the **⋯ (More)** button in the top toolbar
4. Select **"Import from CSV"** from the dropdown menu

### Step 3: Upload Files
1. **Upload Receipts CSV**:
   - Click "Choose File" for Step 1
   - Select your main receipts CSV file
   
2. **Upload Items CSV**:
   - Click "Choose File" for Step 2
   - Select your receipts-by-item CSV file

### Step 4: Review Preview
Once both files are uploaded, you'll see a preview showing:
- Total number of transactions to import
- Total line items
- Date range of transactions

### Step 5: Start Import
1. Click **"Import Transactions"** button
2. Wait for the import to complete (usually takes 5-10 seconds for 100s of transactions)
3. Review the results:
   - ✅ **Imported**: New transactions added
   - ⏭️ **Skipped**: Duplicate transactions (already exist)
   - ❌ **Errors**: Failed transactions (if any)

## CSV File Format

### Receipts CSV Format
Required columns:
- `Date` - Format: DD/MM/YYYY HH:MM (e.g., "01/10/2026 23:50")
- `Receipt number` - Unique receipt ID (e.g., "2-1678")
- `Total collected` - Final amount paid
- `Net sales` - Sales amount before tax
- `Discounts` - Discount amount
- `Taxes` - Tax amount
- `Payment type` - Cash, GCash, Card, etc.
- `Cashier name` - Staff member who processed sale
- `Status` - Usually "Closed"

### Items CSV Format
Required columns:
- `Receipt number` - Must match receipt number from receipts CSV
- `Item` - Product name
- `SKU` - Product code/barcode
- `Category` - Product category
- `Quantity` - Number of items sold
- `Gross sales` - Total for this line item
- `Cost of goods` - Cost per unit
- `Discounts` - Discount on this item

## Features

### ✅ Duplicate Detection
- The system automatically detects and skips receipts that already exist
- Matching is done by receipt number
- No duplicate transactions will be created

### ✅ Data Validation
- Dates are parsed and validated
- Numeric fields are converted properly
- Missing or invalid data is handled gracefully

### ✅ Automatic Sync
- Imported transactions are automatically saved to local database
- Cloud sync is triggered after successful import
- All devices will receive the imported data

### ✅ Import Status Tracking
- All imported transactions are marked with `isImported: true`
- Source field set to `"imported"` for tracking
- Import timestamp recorded in `importedAt` field

## Best Practices

### Before Import
1. **Backup your data** - Always create a backup before bulk imports
2. **Test with small batch** - Try importing a few transactions first
3. **Check CSV format** - Ensure your CSVs match the expected format
4. **Verify dates** - Make sure dates are in DD/MM/YYYY format

### During Import
1. **Stay on the page** - Don't navigate away during import
2. **Wait for completion** - Large imports may take 30-60 seconds
3. **Check results** - Review the import summary

### After Import
1. **Verify data** - Check a few imported transactions in Reports
2. **Check totals** - Ensure sales totals match expected values
3. **Sync status** - Wait for cloud sync to complete (check sync pill)

## Troubleshooting

### "Import Failed" Error
**Possible causes:**
- CSV file format is incorrect
- Required columns are missing
- Date format is wrong
- File is corrupted

**Solution:**
- Open CSV in Excel/Sheets and verify format
- Check that all required columns exist
- Ensure dates match DD/MM/YYYY HH:MM format
- Re-export CSV from source system

### Some Transactions Skipped
**Cause:** These receipts already exist in your database

**Solution:** This is normal! The system prevents duplicates automatically

### High Error Count
**Possible causes:**
- Malformed data in CSV
- Invalid characters in product names
- Missing required fields

**Solution:**
- Check the browser console (F12) for detailed error messages
- Review the CSV for unusual characters or formatting
- Try importing a smaller batch to isolate the problem

### Import Button Disabled
**Cause:** Both CSV files haven't been uploaded yet

**Solution:** Upload both the receipts CSV AND items CSV

## Data Mapping

### From Loyverse to Route 98

| Loyverse Field | Route 98 Field | Notes |
|----------------|----------------|-------|
| Date | ts (timestamp) | Converted from DD/MM/YYYY HH:MM |
| Receipt number | receiptNo | Used as-is |
| Total collected | total | Main total amount |
| Net sales | subtotal | Before tax |
| Payment type | method | Cash, GCash, Card, etc. |
| Cashier name | cashier | Staff member |
| Item | items[].name | Product name |
| SKU | items[].sku | Product code |
| Category | items[].category | Product category |
| Quantity | items[].qty | Number sold |

## Performance

### Import Speed
- **Small batches** (1-50 receipts): ~1-2 seconds
- **Medium batches** (50-200 receipts): ~5-10 seconds  
- **Large batches** (200-500 receipts): ~15-30 seconds
- **Very large batches** (500+ receipts): ~30-60 seconds

### Limitations
- Maximum recommended: 1000 receipts per import
- For larger datasets, split into multiple CSV files
- Browser memory limits may affect very large imports (3000+ receipts)

## Example CSV Data

### Receipts CSV Sample
```csv
Date,Receipt number,Receipt type,Gross sales,Discounts,Net sales,Taxes,Total collected,Cost of goods,Gross profit,Payment type,Description,Dining option,POS,Store,Cashier name,Customer name,Customer contacts,Status
01/10/2026 23:50,2-1678,Sale,148.88,0.00,148.88,0.00,148.88,114.05,34.83,Cash,"1 x GREAT TASTE CHOCO, 1 x ARIEL POWDER",Dine in,POS 2,Route 98 - Minimart,Owner,,,Closed
01/10/2026 23:48,2-1677,Sale,68.00,0.00,68.00,0.00,68.00,50.25,17.75,Cash,"1 x CHUCKIE 110ML, 2 x MAGIC CREAMS BUTTER",Dine in,POS 2,Route 98 - Minimart,Owner,,,Closed
```

### Items CSV Sample
```csv
Date,Receipt number,Receipt type,Category,SKU,Item,Variant,Modifiers applied,Quantity,Gross sales,Discounts,Net sales,Cost of goods,Gross profit,Taxes,Dining option,POS,Store,Cashier name,Customer name,Customer contacts,Comment,Status
01/10/2026 23:50,2-1678,Sale,FOOD,10221,GREAT TASTE CHOCO,,,1.000,15.00,0.00,15.00,12.50,2.50,0.00,Dine in,POS 2,Route 98 - Minimart,Owner,,,,Closed
01/10/2026 23:50,2-1678,Sale,Cleaning/Laundry Supplies,98000001,ARIEL POWDER TWIN JUMBO PACK,,,6.000,119.88,0.00,119.88,90.72,29.16,0.00,Dine in,POS 2,Route 98 - Minimart,Owner,,,,Closed
```

## Support

### Getting Help
If you encounter issues:
1. Check this guide first
2. Open browser console (F12) to see detailed errors
3. Try with a smaller CSV file to test
4. Contact system administrator

### Common Questions

**Q: Can I import the same data twice?**
A: Yes, but duplicates will be automatically skipped. Only new transactions will be imported.

**Q: What happens if I close the browser during import?**
A: The import will be interrupted. You'll need to start over, but already-imported transactions won't be duplicated.

**Q: Can I undo an import?**
A: Not automatically. You would need to manually delete the imported transactions or restore from a backup.

**Q: Does import work offline?**
A: Yes, the import works offline. Data will be synced to cloud when internet is restored.

**Q: Can I import from other POS systems?**
A: Yes, as long as the CSV format matches the expected structure. You may need to reformat your CSV files.

## Files Updated
- ✅ `js/csv-importer.js` - Main import logic
- ✅ `js/reports.js` - Added import button
- ✅ `index.html` - Included CSV importer script
- ✅ `www/*` - Web build updated
- ✅ `android/app/src/main/assets/public/*` - Android build updated

## Version History
- **2026-10-02**: Initial CSV import feature released
  - Support for Loyverse receipts format
  - Dual-file import (receipts + items)
  - Duplicate detection
  - Progress tracking
  - Automatic cloud sync
