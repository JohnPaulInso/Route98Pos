// ============================================================
// importExport.js — CSV (inventory) + full JSON backup/restore.
// Inventory CSV import auto-detects two formats:
//   1. This app's own export (round-trips everything including
//      products you've added manually — see CSV_HEADERS below)
//   2. A raw Loyverse "Items" export — mapped automatically so
//      you can bring your real catalog in directly.
// ============================================================
const ImportExport = (() => {
  const CSV_HEADERS = ["name","brand","distributor","barcode","category","cost","price","stock","unit","lowStockThreshold","imageUrl"];

  // (2026-07-13) Add exportCategoriesCSV; was inventory and full backup only
  function exportCategoriesCSV(){
    const cats = DB.getCategories();
    const rows = cats.map((name, i) => ({ id: i + 1, category_name: name.toUpperCase() }));
    const csv = Utils.toCSV(rows, ["id", "category_name"]);
    Utils.downloadFile(`categories_${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv");
    Utils.toast(`Exported ${cats.length} categories.`, "success");
  }

  function exportInventoryCSV(){
    const rows = DB.getProducts();
    const csv = Utils.toCSV(rows, CSV_HEADERS);
    Utils.downloadFile(`inventory_${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv");
    Utils.toast(`Inventory exported — ${rows.length} product(s), including anything you've added in the app.`, "success");
  }

  function exportFullBackup(){
    const json = JSON.stringify(DB.snapshot(), null, 2);
    Utils.downloadFile(`minimart_backup_${new Date().toISOString().slice(0,10)}.json`, json, "application/json");
    Utils.toast("Full backup downloaded.", "success");
  }

  function isLoyverseFormat(headers){
    return headers.includes("Handle") && headers.includes("Cost / Manufacturer Price") && headers.includes("Barcode");
  }

  // Loyverse "Items" export has per-store-location columns like
  // "Price [Your Store Name]" — find them by prefix since the
  // exact store name varies per user.
  function findCol(headers, prefix){ return headers.find(h => h.startsWith(prefix)); }

  // Excel/Sheets silently mangles long numeric barcodes into scientific notation
  // (e.g. "748485200019" -> "7.48E+11") the moment the CSV is opened and re-saved.
  // That's genuine, unrecoverable precision loss — NOT something we can safely
  // reconstruct — so we treat those as blank rather than importing a wrong number
  // that could ring up the wrong item at checkout.
  const SCI_NOTATION = /^\d+(\.\d+)?E\+\d+$/i;
  function cleanBarcode(raw){
    const trimmed = (raw||"").trim();
    if(!trimmed) return { value:"", corrupted:false };
    if(SCI_NOTATION.test(trimmed)) return { value:"", corrupted:true };
    return { value: trimmed.replace(/[^0-9]/g,""), corrupted:false };
  }

  function importLoyverseRows(rows, existing, cats){
    const headers = Object.keys(rows[0]);
    const priceKey = findCol(headers, "Price [");
    const stockKey = findCol(headers, "In stock [");
    const lowStockKey = findCol(headers, "Low stock [");
    const availKey = findCol(headers, "Available for sale [");
    const imageKey = headers.includes("IMAGE LINK") ? "IMAGE LINK" : findCol(headers, "IMAGE");

    let added = 0, updated = 0, skipped = 0, untracked = 0, withImages = 0, corruptedBarcodes = 0;

    rows.forEach(r => {
      const name = (r["Name"]||"").trim();
      if(!name || name.startsWith("#")){ skipped++; return; } // Loyverse placeholder/"custom amount" rows
      if(availKey && r[availKey] && r[availKey] !== "Y"){ skipped++; return; }

      const priceRaw = priceKey ? r[priceKey] : "";
      const price = Number(priceRaw);
      if(priceRaw === "" || priceRaw === undefined || isNaN(price)){ skipped++; return; } // e.g. "variable" priced items

      // (2026-07-13) Fix CSV import blank stock to 0 & merge by name/barcode; was 9999
      const category = ((r["Category"]||"").trim() || "MISC").toUpperCase();
      cats.add(category);
      const cost = Number(r["Cost / Manufacturer Price"]) || 0;

      // Column N (Barcode). SKU column is ignored entirely, per your instructions.
      const { value: barcode, corrupted } = cleanBarcode(r["Barcode"]);
      if(corrupted) corruptedBarcodes++;

      const stockRaw = stockKey ? r[stockKey] : "";
      let stock = 0;
      if(stockRaw !== "" && stockRaw !== undefined && !isNaN(Number(stockRaw))) {
        stock = Number(stockRaw);
      } else {
        stock = 0; // Blank stock column converts to 0 pcs instead of 9999
      }

      const lowStockRaw = lowStockKey ? r[lowStockKey] : "";
      const lowStockThreshold = (lowStockRaw !== "" && lowStockRaw !== undefined && !isNaN(Number(lowStockRaw))) ? Number(lowStockRaw) : 5;

      const imageUrl = imageKey ? (r[imageKey]||"").trim() : "";
      if(imageUrl) withImages++;

      // Build the update payload. Core catalog fields always sync from source file.
      const payload = { name, category, cost, price, stock, unit:"pc", lowStockThreshold };
      if(barcode) payload.barcode = barcode;
      if(imageUrl) payload.imageUrl = imageUrl;

      let match = barcode ? existing.find(p => p.barcode === barcode) : null;
      if(!match) match = existing.find(p => p.name && p.name.trim().toLowerCase() === name.toLowerCase());

      if(match){ Object.assign(match, payload); updated++; }
      else { existing.push({ id: Utils.uid("prod"), createdAt: Date.now(), barcode:"", brand:"", distributor:"", imageUrl:"", ...payload }); added++; }
    });

    return { added, updated, skipped, untracked, withImages, corruptedBarcodes };
  }

  function importGenericRows(rows, existing, cats){
    let added = 0, updated = 0;
    rows.forEach(r => {
      if(!r.name) return;
      const cat = (r.category || "MISC").trim().toUpperCase();
      cats.add(cat);
      const payload = {
        name: r.name, brand: r.brand||"", distributor: r.distributor||"", barcode: r.barcode||"", category: cat,
        cost: Number(r.cost)||0, price: Number(r.price)||0, stock: Number(r.stock)||0,
        unit: r.unit||"pc", lowStockThreshold: Number(r.lowStockThreshold)||5, imageUrl: r.imageUrl||""
      };
      let match = r.barcode ? existing.find(p => p.barcode === r.barcode) : null;
      if(!match) match = existing.find(p => p.name && p.name.trim().toLowerCase() === r.name.trim().toLowerCase());
      if(match){ Object.assign(match, payload); updated++; }
      else { existing.push({ id: Utils.uid("prod"), createdAt: Date.now(), ...payload }); added++; }
    });
    return { added, updated, skipped:0, untracked:0 };
  }

  async function importInventoryFile(file, onDone){
    if(!file) return;
    try{
      const text = await Utils.readFile(file);
      let rows, loyverse = false;
      if(file.name.endsWith(".json")){
        rows = JSON.parse(text);
      } else {
        rows = Utils.fromCSV(text);
        if(rows.length && isLoyverseFormat(Object.keys(rows[0]))) loyverse = true;
      }
      if(!Array.isArray(rows) || !rows.length){ Utils.toast("No rows found in file.", "warn"); return; }

      const existing = DB.getProducts();
      const cats = new Set(DB.getCategories());
      const result = loyverse ? importLoyverseRows(rows, existing, cats) : importGenericRows(rows, existing, cats);

      DB.setProducts(existing);
      DB.setCategories([...cats]);

      const parts = [`${result.added} added`, `${result.updated} updated`];
      if(result.skipped) parts.push(`${result.skipped} skipped`);
      if(loyverse && result.withImages) parts.push(`${result.withImages} with images`);
      Utils.toast(`${loyverse ? "Loyverse import" : "Import"} complete — ${parts.join(", ")}.`, "success");
      if(loyverse && result.untracked){
        setTimeout(() => Utils.toast(`${result.untracked} item(s) had stock-tracking off in Loyverse — imported as always-in-stock. Adjust stock manually if needed.`, "info", 5000), 400);
      }
      if(loyverse && result.corruptedBarcodes){
        setTimeout(() => Utils.toast(`${result.corruptedBarcodes} barcode(s) in this file were corrupted into scientific notation (e.g. "7.48E+11") — almost always from opening the export in Excel/Sheets before importing. Those products were matched by name instead and left without a barcode rather than risk scanning the wrong item. Re-export from Loyverse without editing it in a spreadsheet, or format column N as Text first, to fix.`, "warn", 9000), 900);
      }
      onDone?.();
    }catch(err){
      console.error(err);
      Utils.toast("Import failed — check the file format.", "error");
    }
  }

  async function importFullBackupFile(file, onDone){
    if(!file) return;
    try{
      const text = await Utils.readFile(file);
      const snap = JSON.parse(text);
      Modal.confirm({
        title:"Restore full backup?",
        message:"This will replace ALL current data (products, sales, settings, fuel config) with the contents of this backup file. This can't be undone.",
        danger:true,
        onConfirm: () => { DB.restoreSnapshot(snap); Utils.toast("Backup restored.", "success"); onDone?.(); }
      });
    }catch(err){
      console.error(err);
      Utils.toast("Restore failed — invalid backup file.", "error");
    }
  }

  return { exportCategoriesCSV, exportInventoryCSV, exportFullBackup, importInventoryFile, importFullBackupFile };
})();
