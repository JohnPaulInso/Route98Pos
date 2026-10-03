// ============================================================
// csv-importer.js — CSV Transaction Import Tool
// Import Loyverse receipts into Route 98 POS system
// ============================================================

const CSVImporter = (() => {
  
  // Parse CSV text into array of objects
  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
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
  
  // Parse a single CSV line handling quoted fields
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
  
  // Parse date from DD/MM/YYYY HH:MM format
  function parseDate(dateStr) {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime();
  }
  
  // Import receipts from CSV data
  async function importReceipts(receiptsCSV, itemsCSV) {
    try {
      const receipts = parseCSV(receiptsCSV);
      const items = parseCSV(itemsCSV);
      
      console.log(`[CSV Import] Found ${receipts.length} receipts and ${items.length} line items`);
      
      // Group items by receipt number
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
      let errors = 0;
      
      // Process in smaller batches to avoid UI freeze
      const batchSize = 25;
      const totalBatches = Math.ceil(receipts.length / batchSize);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const start = batchNum * batchSize;
        const end = Math.min(start + batchSize, receipts.length);
        const batch = receipts.slice(start, end);
        
        // Process batch
        for (const receipt of batch) {
          const receiptNo = receipt['Receipt number'];
          
          // Skip if already imported
          if (existingReceiptNos.has(receiptNo)) {
            skipped++;
            continue;
          }
          
          try {
            const receiptItems = itemsByReceipt.get(receiptNo) || [];
            
            // Convert to POS sale format
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
                id: item['SKU'] || Utils.uid('item'),
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
            
            // Add to database
            existingSales.push(sale);
            imported++;
            
          } catch (err) {
            console.error(`[CSV Import] Error importing receipt ${receiptNo}:`, err);
            errors++;
          }
        }
        
        // Save after each batch to avoid losing progress
        DB.setSales(existingSales);
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 10));
        
        console.log(`[CSV Import] Batch ${batchNum + 1}/${totalBatches} complete (${imported} imported so far)`);
      }
      
      // Final save
      DB.setSales(existingSales);
      
      // Note: CSV imports are saved locally only. User can manually sync to cloud if needed.
      console.log('[CSV Import] Import complete. Data saved locally.');
      
      return {
        success: true,
        imported,
        skipped,
        errors,
        total: receipts.length
      };
      
    } catch (err) {
      console.error('[CSV Import] Import failed:', err);
      return {
        success: false,
        error: err.message,
        imported: 0,
        skipped: 0,
        errors: 0,
        total: 0
      };
    }
  }
  
  // Show import modal
  function openImportModal() {
    const body = `
      <div style="padding: 12px 0;">
        <div class="field" style="margin-bottom: 16px;">
          <label style="font-weight: 700; display: block; margin-bottom: 8px;">
            Step 1: Upload Receipts CSV
          </label>
          <input type="file" id="receipts-csv-file" accept=".csv" class="input" 
                 style="font-size: 0.95rem; padding: 8px;">
          <span class="text-xs text-faint" style="display: block; margin-top: 4px;">
            Select the main receipts CSV file (receipts-2026-*.csv)
          </span>
        </div>
        
        <div class="field" style="margin-bottom: 16px;">
          <label style="font-weight: 700; display: block; margin-bottom: 8px;">
            Step 2: Upload Items CSV
          </label>
          <input type="file" id="items-csv-file" accept=".csv" class="input" 
                 style="font-size: 0.95rem; padding: 8px;">
          <span class="text-xs text-faint" style="display: block; margin-top: 4px;">
            Select the items breakdown CSV file (receipts-by-item-2026-*.csv)
          </span>
        </div>
        
        <div id="import-preview" style="display: none; margin-top: 16px; padding: 12px; 
             background: var(--paper-dim); border-radius: 8px; border: 1px solid var(--line);">
          <div class="flex-between" style="margin-bottom: 8px;">
            <span class="text-sm text-faint" style="font-weight: 700;">Ready to Import</span>
            <strong id="preview-count">0 receipts</strong>
          </div>
          <div id="preview-details" class="text-xs text-faint" style="line-height: 1.6;"></div>
        </div>
        
        <div id="import-progress" style="display: none; margin-top: 16px;">
          <div style="text-align: center; padding: 20px;">
            <div style="margin-bottom: 12px;">
              ${Icons.get('loader', {size: 32})}
            </div>
            <strong>Importing transactions...</strong>
          </div>
        </div>
        
        <div id="import-results" style="display: none; margin-top: 16px;"></div>
      </div>
    `;
    
    let receiptsData = null;
    let itemsData = null;
    
    const modal = Modal.open({
      title: `${Icons.get('upload', {size: 18})} Import Transactions from CSV`,
      body,
      wide: true,
      preventBackdropClose: false,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        { 
          label: 'Import Transactions', 
          cls: 'btn-primary font-bold',
          id: 'btn-start-import',
          disabled: true,
          onClick: async () => {
            await startImport(modal, receiptsData, itemsData);
          }
        }
      ]
    });
    
    // Handle file uploads
    const receiptsInput = modal.querySelector('#receipts-csv-file');
    const itemsInput = modal.querySelector('#items-csv-file');
    const previewDiv = modal.querySelector('#import-preview');
    const importBtn = modal.querySelector('#btn-start-import');
    
    receiptsInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        receiptsData = await readFileAsText(file);
        checkFilesReady();
      }
    });
    
    itemsInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        itemsData = await readFileAsText(file);
        checkFilesReady();
      }
    });
    
    function checkFilesReady() {
      if (receiptsData && itemsData) {
        const receipts = parseCSV(receiptsData);
        const items = parseCSV(itemsData);
        
        previewDiv.style.display = 'block';
        modal.querySelector('#preview-count').textContent = `${receipts.length} receipts`;
        modal.querySelector('#preview-details').innerHTML = `
          • ${receipts.length} total transactions<br>
          • ${items.length} line items<br>
          • Date range: ${receipts[receipts.length - 1]?.Date} to ${receipts[0]?.Date}
        `;
        
        // Find and enable button
        const backdrop = document.querySelector('.modal-backdrop');
        const importBtn = backdrop?.querySelector('#btn-start-import') || document.querySelector('#btn-start-import');
        
        if (importBtn) {
          importBtn.disabled = false;
        }
      }
    }
    
    async function startImport(modal, receiptsCSV, itemsCSV) {
      const progressDiv = modal.querySelector('#import-progress');
      const resultsDiv = modal.querySelector('#import-results');
      const previewDiv = modal.querySelector('#import-preview');
      
      progressDiv.style.display = 'block';
      if (previewDiv) previewDiv.style.display = 'none';
      
      const result = await importReceipts(receiptsCSV, itemsCSV);
      
      progressDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      
      if (result.success) {
        resultsDiv.innerHTML = `
          <div class="card" style="padding: 16px; background: var(--success-bg); border: 1px solid var(--success); border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 12px;">
              ${Icons.get('check-circle', {size: 48, style: 'color: var(--success);'})}
            </div>
            <h3 style="text-align: center; font-size: 1.2rem; font-weight: 800; margin: 0 0 16px; color: var(--success-deep);">
              Import Successful!
            </h3>
            <div style="text-align: left; background: white; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
              <div class="flex-between" style="margin-bottom: 6px;">
                <span class="text-sm">✅ Imported:</span>
                <strong>${result.imported} transactions</strong>
              </div>
              <div class="flex-between" style="margin-bottom: 6px;">
                <span class="text-sm">⏭️ Skipped (duplicates):</span>
                <strong>${result.skipped} transactions</strong>
              </div>
              ${result.errors > 0 ? `
              <div class="flex-between">
                <span class="text-sm">❌ Errors:</span>
                <strong style="color: var(--danger);">${result.errors} transactions</strong>
              </div>
              ` : ''}
            </div>
            <p class="text-sm text-faint" style="text-align: center; margin: 0;">
              All transactions have been saved locally. Use <strong>Settings → Data & Backups</strong> to manually sync to cloud if needed.
            </p>
          </div>
        `;
        
        Utils.toast(`Successfully imported ${result.imported} transactions!`, 'success', 3000);
        
        // Refresh reports view if open
        if (typeof Reports !== 'undefined' && App.currentView === 'reports') {
          setTimeout(() => {
            Reports.render();
            Modal.close();
          }, 2000);
        }
      } else {
        resultsDiv.innerHTML = `
          <div class="card" style="padding: 16px; background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 12px;">
              ${Icons.get('x-circle', {size: 48, style: 'color: var(--danger);'})}
            </div>
            <h3 style="text-align: center; font-size: 1.2rem; font-weight: 800; margin: 0 0 12px; color: var(--danger-deep);">
              Import Failed
            </h3>
            <p class="text-sm" style="text-align: center; margin: 0;">
              ${result.error || 'An unknown error occurred during import.'}
            </p>
          </div>
        `;
        
        Utils.toast('Import failed. Please check the CSV files.', 'error');
      }
    }
  }
  
  // Read file as text
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }
  
  return {
    openImportModal,
    importReceipts,
    parseCSV
  };
})();
