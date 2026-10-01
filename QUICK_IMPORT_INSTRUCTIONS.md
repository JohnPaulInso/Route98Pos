# Quick Import Instructions - Use Browser Console

Since the UI import is timing out, here's how to import directly using the browser console:

## Method 1: Use the Direct Import Script (RECOMMENDED)

1. **Open your Route 98 POS in the browser**

2. **Make sure the CSV files are in the root folder** (they should be accessible at these URLs):
   - `http://localhost:your-port/receipts-2026-09-20-2026-10-02.csv`
   - `http://localhost:your-port/receipts-by-item-2026-09-20-2026-10-02.csv`

3. **Open Browser Console**:
   - Press `F12` or
   - Right-click → Inspect → Console tab

4. **Copy and paste this entire script into the console and press Enter**:

```javascript
(async function() {
  console.log("🚀 Starting direct CSV import...");
  
  try {
    const receiptsResponse = await fetch('receipts-2026-09-20-2026-10-02.csv');
    const itemsResponse = await fetch('receipts-by-item-2026-09-20-2026-10-02.csv');
    
    const receiptsText = await receiptsResponse.text();
    const itemsText = await itemsResponse.text();
    
    console.log("📄 CSV files loaded");
    
    function parseCSV(text) {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          rows.push(row);
        }
      }
      return rows;
    }
    
    function parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    }
    
    function parseDate(dateStr) {
      const [datePart, timePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute).getTime();
    }
    
    const receipts = parseCSV(receiptsText);
    const items = parseCSV(itemsText);
    
    console.log(`📊 Found ${receipts.length} receipts and ${items.length} line items`);
    
    const itemsByReceipt = new Map();
    items.forEach(item => {
      const receiptNo = item['Receipt number'];
      if (!itemsByReceipt.has(receiptNo)) {
        itemsByReceipt.set(receiptNo, []);
      }
      itemsByReceipt.get(receiptNo).push(item);
    });
    
    const existingSales = DB.getSales();
    const existingReceiptNos = new Set(existingSales.map(s => s.receiptNo));
    
    let imported = 0;
    let skipped = 0;
    
    const batchSize = 50;
    for (let i = 0; i < receipts.length; i += batchSize) {
      const batch = receipts.slice(i, i + batchSize);
      
      for (const receipt of batch) {
        const receiptNo = receipt['Receipt number'];
        
        if (existingReceiptNos.has(receiptNo)) {
          skipped++;
          continue;
        }
        
        const receiptItems = itemsByReceipt.get(receiptNo) || [];
        
        const sale = {
          id: `TXN-${receiptNo.replace(/[^0-9]/g, '')}`,
          receiptNo: receiptNo,
          ts: parseDate(receipt['Date']),
          date: receipt['Date'],
          total: parseFloat(receipt['Total collected']) || 0,
          subtotal: parseFloat(receipt['Net sales']) || 0,
          discount: parseFloat(receipt['Discounts']) || 0,
          tax: parseFloat(receipt['Taxes']) || 0,
          tendered: parseFloat(receipt['Total collected']) || 0,
          change: 0,
          method: receipt['Payment type'] || 'Cash',
          cashier: receipt['Cashier name'] || 'Owner',
          status: 'completed',
          source: 'imported',
          isImported: true,
          importedAt: Date.now(),
          items: receiptItems.map(item => ({
            id: item['SKU'] || `item_${Date.now()}_${Math.random()}`,
            name: item['Item'],
            category: item['Category'] || 'MISC',
            sku: item['SKU'],
            qty: parseFloat(item['Quantity']) || 1,
            price: parseFloat(item['Gross sales']) / (parseFloat(item['Quantity']) || 1),
            cost: parseFloat(item['Cost of goods']) / (parseFloat(item['Quantity']) || 1),
            total: parseFloat(item['Gross sales']) || 0,
            discount: parseFloat(item['Discounts']) || 0
          }))
        };
        
        existingSales.push(sale);
        imported++;
      }
      
      DB.setSales(existingSales);
      console.log(`✅ Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(receipts.length/batchSize)} (${imported} transactions)`);
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    DB.setSales(existingSales);
    
    console.log(`✨ Import complete!`);
    console.log(`✅ Imported: ${imported} transactions`);
    console.log(`⏭️ Skipped: ${skipped} duplicates`);
    
    if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
      console.log("☁️ Syncing to cloud...");
      await Sync.pushSnapshot(true);
      console.log("✅ Cloud sync complete!");
    }
    
    Utils.toast(`Successfully imported ${imported} transactions!`, 'success', 5000);
    
    if (typeof Reports !== 'undefined' && App.currentView === 'reports') {
      Reports.render();
    }
    
  } catch (error) {
    console.error("❌ Import failed:", error);
    Utils.toast('Import failed. Check console for details.', 'error');
  }
})();
```

5. **Wait for it to complete** - You'll see progress messages in the console like:
   ```
   📄 CSV files loaded
   📊 Found 633 receipts and 3829 line items
   ✅ Imported batch 1/13 (50 transactions)
   ✅ Imported batch 2/13 (100 transactions)
   ...
   ✨ Import complete!
   ✅ Imported: 633 transactions
   ⏭️ Skipped: 0 duplicates
   ☁️ Syncing to cloud...
   ✅ Cloud sync complete!
   ```

6. **Done!** All transactions are now imported and synced.

## Troubleshooting

### "Failed to fetch" Error
The CSV files need to be accessible via HTTP. If you get this error:

**Option A**: Put the CSV files in the `www/` folder instead of root
- Move both CSV files to `www/` folder
- Update the fetch URLs in the script to just the filenames (no path needed)

**Option B**: Use a local web server
- Make sure you're running the app through a web server (not just opening index.html directly)

### Still Having Issues?
Check the console for specific error messages and let me know what you see.

## What Gets Imported?

For each receipt, the script imports:
- ✅ Receipt number and date
- ✅ Total amount and payment method
- ✅ Cashier name
- ✅ All line items with:
  - Product name and SKU
  - Quantity and price
  - Category
  - Cost (for profit calculations)
- ✅ Marked as `imported` source
- ✅ Synced to cloud immediately after import

## After Import

1. Go to **Reports** section
2. You should see all imported transactions in your sales history
3. All reports will now include the imported data
4. The data is automatically synced to cloud for all devices
