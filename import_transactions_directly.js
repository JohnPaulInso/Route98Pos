// Direct import script - Run this in your browser console
// This will import all transactions from the CSV files

(async function() {
  console.log("🚀 Starting direct CSV import...");
  
  try {
    // Fetch both CSV files
    const receiptsResponse = await fetch('receipts-2026-09-20-2026-10-02.csv');
    const itemsResponse = await fetch('receipts-by-item-2026-09-20-2026-10-02.csv');
    
    const receiptsText = await receiptsResponse.text();
    const itemsText = await itemsResponse.text();
    
    console.log("📄 CSV files loaded");
    
    // Parse CSV helper
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
    
    // Group items by receipt
    const itemsByReceipt = new Map();
    items.forEach(item => {
      const receiptNo = item['Receipt number'];
      if (!itemsByReceipt.has(receiptNo)) {
        itemsByReceipt.set(receiptNo, []);
      }
      itemsByReceipt.get(receiptNo).push(item);
    });
    
    // Get existing sales
    const existingSales = DB.getSales();
    const existingReceiptNos = new Set(existingSales.map(s => s.receiptNo));
    
    let imported = 0;
    let skipped = 0;
    
    // Process each receipt in batches
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
      
      // Save after each batch
      DB.setSales(existingSales);
      console.log(`✅ Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(receipts.length/batchSize)} (${imported} transactions)`);
      
      // Small delay to prevent UI freeze
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Final save and sync
    DB.setSales(existingSales);
    
    console.log(`✨ Import complete!`);
    console.log(`✅ Imported: ${imported} transactions`);
    console.log(`⏭️ Skipped: ${skipped} duplicates`);
    
    // Trigger sync
    if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
      console.log("☁️ Syncing to cloud...");
      await Sync.pushSnapshot(true);
      console.log("✅ Cloud sync complete!");
    }
    
    // Show success message
    Utils.toast(`Successfully imported ${imported} transactions!`, 'success', 5000);
    
    // Refresh reports if on that view
    if (typeof Reports !== 'undefined' && App.currentView === 'reports') {
      Reports.render();
    }
    
  } catch (error) {
    console.error("❌ Import failed:", error);
    Utils.toast('Import failed. Check console for details.', 'error');
  }
})();
