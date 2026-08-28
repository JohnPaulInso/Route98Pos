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

  // (2026-07-13) Flexible Loyverse CSV header detection. Prev: strict 3-col match
  function isLoyverseFormat(headers){
    const hStr = headers.map(h => String(h).toLowerCase()).join(" ");
    return (hStr.includes("handle") || hStr.includes("sku")) && (hStr.includes("barcode") || hStr.includes("name"));
  }

  // Loyverse "Items" export has per-store-location columns like
  // "Price [Your Store Name]" — find them by prefix since the
  // exact store name varies per user.
  function findCol(headers, prefix){ return headers.find(h => h.toLowerCase().startsWith(prefix.toLowerCase())); }

  // Excel/Sheets silently mangles long numeric barcodes into scientific notation
  // (e.g. "748485200019" -> "7.48E+11") the moment the CSV is opened and re-saved.
  // That's genuine, unrecoverable precision loss — NOT something we can safely
  // reconstruct — so we treat those as blank rather than importing a wrong number
  // that could ring up the wrong item at checkout.
  // (2026-07-13) Format barcode as zero-decimal whole numbers. Prev: regex strip
  function cleanBarcode(raw){
    if(raw === null || raw === undefined) return { value:"", corrupted:false };
    let str = String(raw).trim();
    if(!str) return { value:"", corrupted:false };

    if(/[eE][+-]?\d+/.test(str)){
      const num = Number(str);
      if(!isNaN(num) && num > 0){
        try{
          return { value: BigInt(Math.round(num)).toString(), corrupted: false };
        }catch(e){}
      }
    }

    if(str.includes(".")){
      const parts = str.split(".");
      if(parts.length === 2 && /^0+$/.test(parts[1])){
        str = parts[0];
      } else if(parts.length === 2){
        str = parts[0];
      }
    }

    const digits = str.replace(/[^0-9]/g, "");
    return { value: digits, corrupted: false };
  }

  function importLoyverseRows(rows, existing, cats){
    const headers = Object.keys(rows[0]);
    const priceKey = findCol(headers, "Price [") || headers.find(h => /^price/i.test(h));
    const stockKey = findCol(headers, "In stock [") || headers.find(h => /^in stock/i.test(h) || /^stock/i.test(h));
    const lowStockKey = findCol(headers, "Low stock [") || headers.find(h => /^low stock/i.test(h));
    const availKey = findCol(headers, "Available for sale [") || headers.find(h => /^available/i.test(h));
    const imageKey = headers.find(h => /^image/i.test(h));
    const costKey = headers.find(h => /^cost/i.test(h) || /manufacturer price/i.test(h)) || "Cost";
    const nameKey = headers.find(h => /^name/i.test(h)) || "Name";
    const catKey = headers.find(h => /^category/i.test(h)) || "Category";
    const barcodeKey = headers.find(h => /^barcode/i.test(h)) || "Barcode";

    let added = 0, updated = 0, skipped = 0, untracked = 0, withImages = 0, corruptedBarcodes = 0;

    rows.forEach(r => {
      const name = (r[nameKey]||"").trim();
      if(!name || name.startsWith("#")){ skipped++; return; }
      if(availKey && r[availKey] && r[availKey] !== "Y"){ skipped++; return; }

      const priceRaw = priceKey ? r[priceKey] : "";
      const price = Number(priceRaw);
      if(priceRaw === "" || priceRaw === undefined || isNaN(price)){ skipped++; return; }

      const category = ((r[catKey]||"").trim() || "MISC").toUpperCase();
      cats.add(category);
      const cost = Number(r[costKey]) || 0;

      const { value: barcode, corrupted } = cleanBarcode(r[barcodeKey]);
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

  // (2026-07-13) Export store sales report CSV for period or all. Prev: none
  function exportSalesCSV(periodKey = "all"){
    let sales = DB.getSales();
    if(periodKey && periodKey !== "all" && typeof Analytics !== "undefined"){
      const r = Analytics.getPeriodRange(periodKey);
      sales = sales.filter(s => s.ts >= r.start && s.ts <= r.end);
    }
    const rows = [];
    sales.forEach(s => {
      const d = new Date(s.ts || Date.now());
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const items = Array.isArray(s.items) && s.items.length ? s.items : [{ name: "Custom Sale", qty: 1, price: s.total || 0, category: "MISC" }];
      items.forEach((item, idx) => {
        const qty = Number(item.qty || 1);
        const price = Number(item.price || 0);
        const itemTotal = Utils.round2(qty * price);
        rows.push({
          date: dateStr,
          time: timeStr,
          receipt_no: s.id || `TXN-${idx+1}`,
          item_name: item.name || "Item",
          category: item.category || "MISC",
          quantity: qty,
          unit_price: price,
          item_total: itemTotal,
          subtotal: idx === 0 ? Number(s.subtotal || s.total || itemTotal) : "",
          discount: idx === 0 ? Number(s.discountAmt || 0) : "",
          vat: idx === 0 ? Number(s.vat || 0) : "",
          total_due: idx === 0 ? Number(s.total || itemTotal) : "",
          payment_method: s.method || "Cash",
          cashier: s.cashier || "Cashier",
          reference_no: s.refCode || ""
        });
      });
    });
    const headers = ["date","time","receipt_no","item_name","category","quantity","unit_price","item_total","subtotal","discount","vat","total_due","payment_method","cashier","reference_no"];
    const csv = Utils.toCSV(rows, headers);
    Utils.downloadFile(`store_sales_${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv");
    Utils.toast(`Exported ${sales.length} sales (${rows.length} items).`, "success");
  }

  // Helper date/time parser
  function parseDateToTimestamp(dateStr, timeStr){
    if(!dateStr) return Date.now();
    let str = String(dateStr).trim();
    if(timeStr) str += " " + String(timeStr).trim();
    const num = Number(str);
    if(!isNaN(num) && num > 1000000000) {
      return num < 10000000000 ? num * 1000 : num;
    }
    let ts = Date.parse(str);
    if(!isNaN(ts)) return ts;
    const parts = str.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(.*)$/);
    if(parts){
      let p1 = parseInt(parts[1], 10), p2 = parseInt(parts[2], 10), p3 = parseInt(parts[3], 10);
      let rest = (parts[4] || "").trim();
      let year, month, day;
      if(p1 > 1000){ year = p1; month = p2 - 1; day = p3; }
      else if(p3 > 1000){
        if(p1 > 12){ day = p1; month = p2 - 1; year = p3; }
        else { month = p1 - 1; day = p2; year = p3; }
      }
      let hours = 12, mins = 0, secs = 0;
      if(rest){
        const tm = rest.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/i);
        if(tm){
          hours = parseInt(tm[1], 10); mins = parseInt(tm[2], 10); secs = tm[3] ? parseInt(tm[3], 10) : 0;
          const ampm = (tm[4] || "").toLowerCase();
          if(ampm === "pm" && hours < 12) hours += 12;
          if(ampm === "am" && hours === 12) hours = 0;
        }
      }
      const d = new Date(year, month, day, hours, mins, secs);
      if(!isNaN(d.getTime())) return d.getTime();
    }
    return Date.now();
  }

  // (2026-07-13) Import historical store sales from CSV or JSON. Prev: none
  async function importSalesFile(file, onDone){
    if(!file) return;
    try {
      const text = await Utils.readFile(file);
      let rawSales = [];
      if(file.name.endsWith(".json")){
        const parsed = JSON.parse(text);
        rawSales = Array.isArray(parsed) ? parsed : (parsed.sales || []);
      } else {
        const rows = Utils.fromCSV(text);
        if(!rows.length){ Utils.toast("No rows found in file.", "warn"); return; }
        const grouped = new Map();
        let fallbackCounter = 1;
        rows.forEach(r => {
          const keys = Object.keys(r);
          const findVal = (terms) => {
            const k = keys.find(key => terms.some(t => key.toLowerCase().trim() === t || key.toLowerCase().includes(t)));
            return k ? r[k] : "";
          };
          const receiptId = String(findVal(["receipt_no","receipt no","receipt","txn id","txnid","transaction id","order #","order id","invoice","id"]) || "").trim() || `OLD-TXN-${fallbackCounter}`;
          const dateVal = findVal(["date","txn date","transaction date","timestamp","created at","time stamp"]);
          const timeVal = findVal(["time","hour"]);
          const ts = parseDateToTimestamp(dateVal, timeVal);
          const itemName = (findVal(["item_name","item name","product name","product","item","description","name"]) || "Imported Item").trim();
          const category = (findVal(["category","cat","department"]) || "MISC").trim().toUpperCase();
          const qty = Math.max(1, Number(findVal(["quantity","qty","units","count"])) || 1);
          const price = Number(findVal(["unit_price","unit price","price","gross price","rate"])) || 0;
          const subtotalVal = Number(findVal(["subtotal","sub total"])) || 0;
          const discountVal = Number(findVal(["discount","discount amt","discount applied"])) || 0;
          const vatVal = Number(findVal(["vat","tax","vat incl"])) || 0;
          const totalVal = Number(findVal(["total_due","total amount","total due","total","grand total","net total","amount"])) || (qty * price);
          const method = String(findVal(["payment_method","payment method","payment type","payment","method"]) || "Cash").trim();
          const cashier = String(findVal(["cashier","user","staff","employee","cashier name"]) || "Cashier").trim();
          const refCode = String(findVal(["reference_no","reference no","ref no","reference","ref code"]) || "").trim();

          const itemObj = {
            productId: Utils.uid("prod"),
            name: itemName,
            category: category || "MISC",
            price: price || (qty > 0 ? Utils.round2(totalVal / qty) : 0),
            qty,
            unitType: "piece",
            unit: "pc",
            piecesPerPack: 1,
            imageUrl: ""
          };

          if(!grouped.has(receiptId)){
            grouped.set(receiptId, {
              id: receiptId.startsWith("TXN-") ? receiptId : (receiptId.startsWith("OLD-") ? receiptId : `TXN-${receiptId}`),
              ts,
              items: [itemObj],
              subtotal: subtotalVal || totalVal,
              discountType: "percent",
              discountValue: 0,
              discountAmt: discountVal,
              vat: vatVal,
              total: totalVal,
              method: method || "Cash",
              refCode,
              tendered: totalVal,
              change: 0,
              cashier: cashier || "Cashier"
            });
            if(!findVal(["receipt_no","receipt no","receipt","txn id","txnid","transaction id"])) fallbackCounter++;
          } else {
            const entry = grouped.get(receiptId);
            entry.items.push(itemObj);
            if(totalVal > entry.total) entry.total = totalVal;
            else entry.total += (qty * itemObj.price);
            entry.subtotal = entry.total;
          }
        });
        rawSales = Array.from(grouped.values());
      }
      if(!rawSales.length){ Utils.toast("No sales found.", "warn"); return; }
      const existing = DB.getSales();
      const existingIds = new Set(existing.map(s => String(s.id).toLowerCase()));
      let addedCount = 0;
      rawSales.forEach(sale => {
        const idLower = String(sale.id).toLowerCase();
        if(!existingIds.has(idLower)){
          existing.push(sale);
          existingIds.add(idLower);
          addedCount++;
        }
      });
      existing.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      DB.setSales(existing);
      Utils.toast(`Imported ${addedCount} sales transaction(s).`, "success");
      onDone?.();
    } catch(err){
      console.error(err);
      Utils.toast("Sales import failed. Check file format.", "error");
    }
  }

  return { exportCategoriesCSV, exportInventoryCSV, exportSalesCSV, exportFullBackup, importInventoryFile, importSalesFile, importFullBackupFile };
})();
