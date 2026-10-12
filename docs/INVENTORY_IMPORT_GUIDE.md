# Inventory Import Guide

## Overview
The inventory importer allows you to import products from Loyverse CSV export files into Route 98 POS system.

## How to Import Inventory

### Step 1: Export from Loyverse
1. In Loyverse, go to **Inventory** → **Items**
2. Click **Export** and download the CSV file
3. The file will be named something like `export_items (8).csv`

### Step 2: Import into Route 98
1. Open Route 98 POS
2. Navigate to **Inventory** view
3. Click the **Import** button in the toolbar
4. Select your exported CSV file
5. Choose whether to update existing products (checked by default)
6. Click **Import Inventory**

## CSV Column Mapping

The importer uses the following columns from the Loyverse CSV:

| Loyverse Column | Route 98 Field | Notes |
|----------------|----------------|-------|
| Name | Product Name | Required |
| SKU | SKU | Optional |
| Barcode | Barcode | Used to match existing products |
| Category | Category | Defaults to "Misc" if empty |
| **Cost** (Column M) | Cost Price | Unit cost of the product |
| **Price [Route 98 - Minimart]** (Column S) | Selling Price | Selling price with profit |
| In stock [Route 98 - Minimart] | Stock Quantity | Current stock level |
| Low stock [Route 98 - Minimart] | Low Stock Threshold | Alert threshold (default: 5) |
| Track stock | Track Stock | Y/N |
| Available for sale [Route 98 - Minimart] | Import Filter | Only imports items marked "Y" |

## Important Notes

### Cost vs Price
- **Column M (Cost)**: This is your cost/purchase price
- **Column S (Price)**: This is your selling price with profit included
- The importer correctly uses these columns to set both cost and price

### Update Existing Products
- **Checked**: Updates cost, price, and stock for existing products (matched by barcode or name)
- **Unchecked**: Skips products that already exist

### What Gets Imported
- ✅ Products with `Available for sale = Y`
- ✅ Products with a valid name
- ❌ Products with `Available for sale = N` (skipped)
- ❌ Products with empty names (skipped)

### Local Save Only
- Imported products are saved **locally only**
- No automatic cloud sync is triggered
- To sync to cloud: Go to **Settings** → **Data & Backups** → Manual sync

## Import Results

After import, you'll see:
- ✅ **New products**: Items added to inventory
- 🔄 **Updated**: Existing items that were updated
- ⏭️ **Skipped**: Items not available for sale or duplicates (when update disabled)
- ❌ **Errors**: Items that failed to import (if any)

## Troubleshooting

### Products Not Importing
- Check that `Available for sale [Route 98 - Minimart]` is set to "Y"
- Ensure product has a name in the CSV
- Verify the CSV file is not corrupted

### Wrong Prices
- Verify **Column M** has your cost price
- Verify **Column S** has your selling price
- If columns are swapped, you'll need to fix the CSV before importing

### Duplicates
- Products are matched by barcode first, then by exact name match
- To update existing products, keep "Update Existing Products" checked
- To only add new products, uncheck "Update Existing Products"

## Performance

- Imports in batches of 50 items to keep UI responsive
- Progress is saved after each batch
- Typical import time: ~5-10 seconds per 100 items

## Example Workflow

1. Export inventory from Loyverse: `export_items (8).csv`
2. Open Route 98 → Inventory
3. Click Import button
4. Select `export_items (8).csv`
5. Keep "Update Existing Products" checked
6. Click "Import Inventory"
7. Wait for completion (~700 items takes ~35-70 seconds)
8. Review results: New products, Updated items, Skipped items
9. Optional: Sync to cloud via Settings if needed

## Related Files

- `js/inventory-importer.js` - Main importer logic
- `js/inventory.js` - Import button integration
- `js/csv-importer.js` - Transaction CSV importer (different feature)
