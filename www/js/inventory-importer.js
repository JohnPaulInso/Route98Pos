// ============================================================
// inventory-importer.js — CSV Inventory Import Tool
// Import Loyverse inventory into Route 98 POS system
// ============================================================

const InventoryImporter = (() => {
  
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
  
  // Import inventory from CSV data
  async function importInventory(csvData, options = {}) {
    try {
      const items = parseCSV(csvData);
      
      console.log(`[Inventory Import] Found ${items.length} inventory items`);
      
      const products = DB.getProducts();
      const existingBarcodes = new Set(products.map(p => p.barcode).filter(Boolean));
      const existingNames = new Set(products.map(p => p.name.toLowerCase().trim()));
      
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      
      const updateMode = options.updateExisting !== false; // Default true
      
      // Process in smaller batches to avoid UI freeze
      const batchSize = 50;
      const totalBatches = Math.ceil(items.length / batchSize);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const start = batchNum * batchSize;
        const end = Math.min(start + batchSize, items.length);
        const batch = items.slice(start, end);
        
        // Process batch
        for (const item of batch) {
          try {
            const name = item['Name']?.trim();
            const sku = item['SKU']?.trim();
            const barcode = item['Barcode']?.trim();
            
            // Skip if no name
            if (!name) {
              skipped++;
              continue;
            }
            
            // Parse values (Column M = Cost, Column S = Price)
            const cost = parseFloat(item['Cost']) || 0;
            const price = parseFloat(item['Price [Route 98 - Minimart]']) || 0;
            const stock = parseFloat(item['In stock [Route 98 - Minimart]']) || 0;
            const lowStockThreshold = parseFloat(item['Low stock [Route 98 - Minimart]']) || 5;
            const category = item['Category']?.trim() || 'Misc';
            const trackStock = item['Track stock']?.toUpperCase() === 'Y';
            const availableForSale = item['Available for sale [Route 98 - Minimart]']?.toUpperCase() === 'Y';
            
            // Skip if not available for sale
            if (!availableForSale) {
              skipped++;
              continue;
            }
            
            // Check if product exists
            let existingProduct = null;
            if (barcode && barcode !== '') {
              existingProduct = products.find(p => p.barcode === barcode);
            }
            if (!existingProduct) {
              existingProduct = products.find(p => 
                p.name.toLowerCase().trim() === name.toLowerCase().trim()
              );
            }
            
            if (existingProduct) {
              if (updateMode) {
                // Update existing product
                existingProduct.cost = cost;
                existingProduct.price = price;
                existingProduct.stock = stock;
                existingProduct.lowStockThreshold = lowStockThreshold;
                existingProduct.category = category;
                existingProduct.barcode = barcode || existingProduct.barcode;
                existingProduct.updatedAt = Date.now();
                updated++;
              } else {
                skipped++;
              }
            } else {
              // Add new product
              const now = Date.now();
              const newProduct = {
                id: Utils.uid('prod'),
                name: name,
                sku: sku || '',
                barcode: barcode || '',
                category: category,
                cost: cost,
                price: price,
                stock: stock,
                lowStockThreshold: lowStockThreshold,
                unit: 'pc',
                brand: '',
                distributor: '',
                imageUrl: '',
                createdAt: now,
                updatedAt: now,
                source: 'imported',
                isImported: true,
                importedAt: now
              };
              
              products.push(newProduct);
              imported++;
            }
            
          } catch (err) {
            console.error(`[Inventory Import] Error importing item:`, item, err);
            errors++;
          }
        }
        
        // Save after each batch to avoid losing progress
        DB.setProducts(products);
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 10));
        
        console.log(`[Inventory Import] Batch ${batchNum + 1}/${totalBatches} complete (${imported} imported, ${updated} updated so far)`);
      }
      
      // Final save
      DB.setProducts(products);
      
      // Note: Inventory imports are saved locally only. User can manually sync to cloud if needed.
      console.log('[Inventory Import] Import complete. Data saved locally.');
      
      return {
        success: true,
        imported,
        updated,
        skipped,
        errors,
        total: items.length
      };
      
    } catch (err) {
      console.error('[Inventory Import] Import failed:', err);
      return {
        success: false,
        error: err.message,
        imported: 0,
        updated: 0,
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
            Upload Inventory CSV
          </label>
          <input type="file" id="inventory-csv-file" accept=".csv" class="input" 
                 style="font-size: 0.95rem; padding: 8px;">
          <span class="text-xs text-faint" style="display: block; margin-top: 4px;">
            Select the export_items CSV file from Loyverse
          </span>
        </div>
        
        <div class="field" style="margin-bottom: 16px; padding: 12px; background: var(--paper-dim); border-radius: 8px; border: 1px solid var(--line);">
          <label class="switch-row" style="cursor: pointer; margin-bottom: 0;">
            <div>
              <strong>Update Existing Products</strong>
              <div class="text-xs text-faint">Update cost, price, and stock for products that already exist (matched by barcode or name)</div>
            </div>
            <span class="switch">
              <input type="checkbox" id="f-update-existing" checked>
              <span class="track"></span>
            </span>
          </label>
        </div>
        
        <div id="import-preview" style="display: none; margin-top: 16px; padding: 12px; 
             background: var(--paper-dim); border-radius: 8px; border: 1px solid var(--line);">
          <div class="flex-between" style="margin-bottom: 8px;">
            <span class="text-sm text-faint" style="font-weight: 700;">Ready to Import</span>
            <strong id="preview-count">0 products</strong>
          </div>
          <div id="preview-details" class="text-xs text-faint" style="line-height: 1.6;"></div>
        </div>
        
        <div id="import-progress" style="display: none; margin-top: 16px;">
          <div style="text-align: center; padding: 20px;">
            <div style="margin-bottom: 12px;">
              ${Icons.get('loader', {size: 32})}
            </div>
            <strong>Importing inventory...</strong>
          </div>
        </div>
        
        <div id="import-results" style="display: none; margin-top: 16px;"></div>
      </div>
    `;
    
    let inventoryData = null;
    
    const modal = Modal.open({
      title: `${Icons.get('upload', {size: 18})} Import Inventory from CSV`,
      body,
      wide: true,
      preventBackdropClose: false,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        { 
          label: 'Import Inventory', 
          cls: 'btn-primary font-bold',
          id: 'btn-start-import',
          disabled: true,
          onClick: async () => {
            await startImport(modal, inventoryData);
          }
        }
      ]
    });
    
    // Handle file upload
    const fileInput = modal.querySelector('#inventory-csv-file');
    const previewDiv = modal.querySelector('#import-preview');
    
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        inventoryData = await readFileAsText(file);
        checkFileReady();
      }
    });
    
    function checkFileReady() {
      if (inventoryData) {
        const items = parseCSV(inventoryData);
        const availableItems = items.filter(item => 
          item['Available for sale [Route 98 - Minimart]']?.toUpperCase() === 'Y' && 
          item['Name']?.trim()
        );
        
        previewDiv.style.display = 'block';
        modal.querySelector('#preview-count').textContent = `${availableItems.length} products`;
        modal.querySelector('#preview-details').innerHTML = `
          • ${items.length} total items in CSV<br>
          • ${availableItems.length} available for sale<br>
          • ${items.length - availableItems.length} will be skipped (not available for sale or missing name)
        `;
        
        // Find and enable button
        const backdrop = document.querySelector('.modal-backdrop');
        const importBtn = backdrop?.querySelector('#btn-start-import') || document.querySelector('#btn-start-import');
        
        if (importBtn) {
          importBtn.disabled = false;
        }
      }
    }
    
    async function startImport(modal, csvData) {
      const progressDiv = modal.querySelector('#import-progress');
      const resultsDiv = modal.querySelector('#import-results');
      const previewDiv = modal.querySelector('#import-preview');
      const updateExisting = modal.querySelector('#f-update-existing')?.checked !== false;
      
      progressDiv.style.display = 'block';
      if (previewDiv) previewDiv.style.display = 'none';
      
      const result = await importInventory(csvData, { updateExisting });
      
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
                <span class="text-sm">✅ New products:</span>
                <strong>${result.imported} items</strong>
              </div>
              <div class="flex-between" style="margin-bottom: 6px;">
                <span class="text-sm">🔄 Updated:</span>
                <strong>${result.updated} items</strong>
              </div>
              <div class="flex-between" style="margin-bottom: 6px;">
                <span class="text-sm">⏭️ Skipped:</span>
                <strong>${result.skipped} items</strong>
              </div>
              ${result.errors > 0 ? `
              <div class="flex-between">
                <span class="text-sm">❌ Errors:</span>
                <strong style="color: var(--danger);">${result.errors} items</strong>
              </div>
              ` : ''}
            </div>
            <p class="text-sm text-faint" style="text-align: center; margin: 0;">
              All products have been saved locally. Use <strong>Settings → Data & Backups</strong> to manually sync to cloud if needed.
            </p>
          </div>
        `;
        
        Utils.toast(`Successfully imported ${result.imported} products, updated ${result.updated}!`, 'success', 3000);
        
        // Refresh inventory view if open
        if (typeof Inventory !== 'undefined' && App.currentView === 'inventory') {
          setTimeout(() => {
            Inventory.render();
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
        
        Utils.toast('Import failed. Please check the CSV file.', 'error');
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
    importInventory,
    parseCSV
  };
})();
