const fs = require('fs');
const path = require('path');

function parseCSVLine(line) {
  const values = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      values.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  values.push(cur);
  return values;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0].replace(/^\uFEFF/, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(row);
  }
  return rows;
}

function cleanBarcode(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (!str || str === '0' || str === '-' || str === '—') return '';
  if (/[eE][+-]?\d+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && num > 0) {
      try { return BigInt(Math.round(num)).toString(); } catch (e) {}
    }
  }
  if (str.includes('.')) str = str.split('.')[0];
  return str.replace(/[^0-9]/g, '');
}

function normalizeItemName(rawName) {
  if (!rawName) return 'Custom Item';
  let name = rawName.trim().replace(/\s+/g, ' ');
  if (/^CREAMLINE FAMILY DOU /i.test(name)) name = name.replace(/^CREAMLINE FAMILY DOU /i, 'CREAMLINE FAMILY DUO ');
  if (/COBRA RISE ENERGY PO /i.test(name)) name = name.replace(/COBRA RISE ENERGY PO /i, 'COBRA RISE ENERGY PRO ');
  if (/MIGHTY PULA\s+STICK/i.test(name)) name = 'MIGHTY PULA STICK';
  if (/MR\.\s*CHIPS\s+NACHO CHEEZE/i.test(name)) name = name.replace(/CHEEZE/i, 'CHEESE');
  if (/CREAMLINE PINOY CLASSIC.*MANGGO/i.test(name)) name = name.replace(/MANGGO/i, 'MANGO');
  return name;
}

function parseDateToTimestamp(dateStr) {
  if (!dateStr) return Date.now();
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (dmyMatch) {
    const [_, d, m, y, h, min] = dmyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)).getTime();
  }
  const textDate = new Date(dateStr);
  if (!isNaN(textDate.getTime())) return textDate.getTime();
  return Date.now();
}

console.log('=== STARTING AUDITED LOYVERSE IMPORT ===');

// 1. Load existing CATALOG_SEED to preserve images and product details
const existingCatalogPath = path.join(__dirname, '..', 'js', 'catalog_seed.js');
let existingCatalog = { categories: [], products: [] };
if (fs.existsSync(existingCatalogPath)) {
  try {
    existingCatalog = require(existingCatalogPath);
    console.log(`Loaded existing catalog with ${existingCatalog.products.length} products.`);
  } catch (e) {
    console.warn('Could not load existing catalog:', e.message);
  }
}

const existingProdBySku = new Map();
const existingProdByName = new Map();
const existingProdById = new Map();
const existingProdByBarcode = new Map();

existingCatalog.products.forEach(p => {
  if (p.id) existingProdById.set(p.id.trim(), p);
  if (p.sku) existingProdBySku.set(p.sku.trim(), p);
  if (p.barcode) existingProdByBarcode.set(p.barcode.trim(), p);
  if (p.name) existingProdByName.set(normalizeItemName(p.name).toLowerCase(), p);
});

// 2. Parse items.csv
const itemsCsvPath = path.join(__dirname, 'temp_receipts', 'items.csv');
const itemsRaw = fs.readFileSync(itemsCsvPath, 'utf8');
const itemCatalogRows = parseCSV(itemsRaw);
console.log(`Parsed ${itemCatalogRows.length} items from CSV.`);

const categoriesSet = new Set(existingCatalog.categories || []);
const productMap = new Map();
const inventoryChanges = [];
let imagesPreservedCount = 0;
let newProductsCount = 0;
let stockUpdatedCount = 0;
let priceOrCostUpdatedCount = 0;

itemCatalogRows.forEach((r, idx) => {
  const rawName = (r['Name'] || r['Item'] || '').trim();
  if (!rawName) return;
  const name = normalizeItemName(rawName);
  const rawCat = (r['Category'] || 'MISC').trim();
  const category = (rawCat || 'MISC').toUpperCase();
  categoriesSet.add(category);

  const sku = (r['SKU'] || '').trim();
  const barcode = cleanBarcode(r['Barcode']);
  const priceVal = r['Price [Route 98 - Minimart]'] || r['Price'] || '0';
  const price = priceVal.toLowerCase().includes('variable') ? 0 : (parseFloat(priceVal) || 0);
  const cost = parseFloat(r['Cost'] || '0') || 0;
  const inStock = parseFloat(r['In stock [Route 98 - Minimart]'] || r['In stock'] || '0') || 0;
  const lowStock = parseFloat(r['Low stock [Route 98 - Minimart]'] || r['Low stock'] || '5') || 5;
  const trackStock = (r['Track stock'] || 'Y').toUpperCase() === 'Y';

  // Check matching existing product to retain image and custom properties
  const matched = (sku && existingProdBySku.get(sku)) ||
                  (barcode && existingProdByBarcode.get(barcode)) ||
                  existingProdByName.get(name.toLowerCase()) ||
                  (sku && existingProdById.get(`p_${sku}`));

  let imageUrl = '';
  if (matched && matched.imageUrl) {
    imageUrl = matched.imageUrl;
    imagesPreservedCount++;
  } else if ((r['IMAGE LINK'] || r['Image'] || '').trim().startsWith('http')) {
    imageUrl = (r['IMAGE LINK'] || r['Image'] || '').trim();
  }

  const id = matched ? matched.id : (sku ? `p_${sku}` : `p_item_${idx + 1}`);

  if (matched) {
    let changed = false;
    const diff = { name, sku, changes: {} };
    if (matched.stock !== inStock) {
      diff.changes.stock = { old: matched.stock, new: inStock };
      stockUpdatedCount++;
      changed = true;
    }
    if (matched.price !== price) {
      diff.changes.price = { old: matched.price, new: price };
      priceOrCostUpdatedCount++;
      changed = true;
    }
    if (matched.cost !== cost) {
      diff.changes.cost = { old: matched.cost, new: cost };
      priceOrCostUpdatedCount++;
      changed = true;
    }
    if (barcode && matched.barcode !== barcode) {
      diff.changes.barcode = { old: matched.barcode, new: barcode };
      changed = true;
    }
    if (changed) inventoryChanges.push(diff);
  } else {
    newProductsCount++;
    inventoryChanges.push({ name, sku, isNew: true, stock: inStock, price, cost });
  }

  const prod = {
    id,
    sku: sku || (matched ? matched.sku : ''),
    name,
    category,
    cost,
    price,
    stock: inStock,
    lowStockThreshold: lowStock,
    trackStock,
    unit: (matched && matched.unit) || 'pc',
    unitType: (matched && matched.unitType) || 'piece',
    piecesPerPack: (matched && matched.piecesPerPack) || 1,
    barcode: barcode || (matched ? matched.barcode : ''),
    imageUrl
  };

  productMap.set(id, prod);
  if (sku) productMap.set(`sku:${sku}`, prod);
  if (barcode) productMap.set(`barcode:${barcode}`, prod);
  productMap.set(`name:${name.toLowerCase()}`, prod);
});

// Also make sure any existing catalog product not in items.csv is preserved
existingCatalog.products.forEach(p => {
  if (!productMap.has(p.id) && !productMap.has(`name:${normalizeItemName(p.name).toLowerCase()}`)) {
    productMap.set(p.id, p);
    if (p.imageUrl) imagesPreservedCount++;
  }
});

// 3. Parse receipts and receipts_by_item
const receiptsRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'receipts.csv'), 'utf8');
const receiptsItemsRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'receipts_by_item.csv'), 'utf8');

const summaryRows = parseCSV(receiptsRaw);
const itemRows = parseCSV(receiptsItemsRaw);
console.log(`Parsed ${summaryRows.length} receipt summaries and ${itemRows.length} line items.`);

const itemsByReceipt = new Map();
itemRows.forEach(r => {
  const rNo = (r['Receipt number'] || '').trim();
  if (!rNo) return;
  const status = (r['Status'] || '').trim().toLowerCase();
  const rType = (r['Receipt type'] || '').trim().toLowerCase();
  if (status.includes('cancel') || rType.includes('cancel')) return;

  const rawName = (r['Item'] || '').trim();
  const name = normalizeItemName(rawName);
  const sku = (r['SKU'] || '').trim().replace(/[@Q]$/, '');
  const qty = parseFloat(r['Quantity']) || 1;
  const grossSales = parseFloat(r['Gross sales']) || 0;
  const price = qty > 0 ? parseFloat((grossSales / qty).toFixed(2)) : 0;
  const cost = parseFloat(r['Cost of goods']) || 0;
  const unitCost = qty > 0 ? parseFloat((cost / qty).toFixed(2)) : 0;
  const category = (r['Category'] || 'MISC').trim().toUpperCase();

  let matchedProd = null;
  if (sku) matchedProd = productMap.get(`sku:${sku}`);
  if (!matchedProd) matchedProd = productMap.get(`name:${name.toLowerCase()}`);

  const itemObj = {
    productId: matchedProd ? matchedProd.id : (sku ? `p_${sku}` : `prod_${Math.random().toString(36).slice(2, 9)}`),
    name,
    price,
    cost: unitCost,
    qty,
    category: category || (matchedProd ? matchedProd.category : 'MISC'),
    unitType: 'piece',
    unit: 'pc',
    piecesPerPack: 1,
    isCustom: name.startsWith('#') || name.toLowerCase() === 'custom item' || !sku,
    imageUrl: matchedProd ? matchedProd.imageUrl : ''
  };

  if (!itemsByReceipt.has(rNo)) {
    itemsByReceipt.set(rNo, {
      items: [],
      dateStr: r['Date'] || '',
      cashier: (r['Cashier name'] || 'Owner').trim(),
      totalNet: 0,
      totalGross: 0,
      totalCost: 0
    });
  }
  const entry = itemsByReceipt.get(rNo);
  entry.items.push(itemObj);
  entry.totalNet += (itemObj.price * itemObj.qty);
  entry.totalGross += grossSales;
  entry.totalCost += cost;
});

// 4. Duplicate detection against existing SALES_SEED
const existingSalesPath = path.join(__dirname, '..', 'js', 'sales_seed.js');
let existingSales = [];
if (fs.existsSync(existingSalesPath)) {
  try {
    existingSales = require(existingSalesPath);
    console.log(`Loaded existing sales seed with ${existingSales.length} transactions.`);
  } catch (e) {
    console.warn('Could not load existing sales seed:', e.message);
  }
}

const existingReceiptMap = new Map();
const existingSignatureSet = new Set();

existingSales.forEach(s => {
  const normNo = String(s.receiptNo || s.id || '').replace(/^TXN-/, '').trim();
  if (normNo) existingReceiptMap.set(normNo, s);
  if (s.ts && s.total !== undefined) {
    existingSignatureSet.add(`${s.ts}_${parseFloat(s.total).toFixed(2)}`);
  }
});

let duplicateSalesCount = 0;
let newSalesCount = 0;
let cancelledCount = 0;
const newSalesList = [];

summaryRows.forEach(s => {
  const rNo = (s['Receipt number'] || '').trim();
  if (!rNo) return;
  const status = (s['Status'] || '').trim().toLowerCase();
  const rType = (s['Receipt type'] || '').trim().toLowerCase();
  if (status.includes('cancel') || rType.includes('cancel')) {
    cancelledCount++;
    return;
  }

  // Duplicate detection by receipt number
  if (existingReceiptMap.has(rNo)) {
    duplicateSalesCount++;
    return;
  }

  const dateStr = (s['Date'] || '').trim();
  const ts = parseDateToTimestamp(dateStr);
  const itemsEntry = itemsByReceipt.get(rNo);
  const itemsSum = itemsEntry ? parseFloat(itemsEntry.items.reduce((acc, it) => acc + (it.price * it.qty), 0).toFixed(2)) : 0;
  const totalCollectedVal = parseFloat(s['Total collected']);
  const netSalesVal = parseFloat(s['Net sales']);
  const grossSalesVal = parseFloat(s['Gross sales']);
  const total = (itemsSum > 0) ? itemsSum
              : (!isNaN(totalCollectedVal) && totalCollectedVal > 0) ? totalCollectedVal
              : (!isNaN(netSalesVal) && netSalesVal > 0) ? netSalesVal
              : (!isNaN(grossSalesVal) && grossSalesVal > 0) ? grossSalesVal
              : 0;

  // Secondary signature check for timestamp and exact total
  const sig = `${ts}_${total.toFixed(2)}`;
  if (existingSignatureSet.has(sig)) {
    // Check if receipt number already recorded
    const existing = Array.from(existingReceiptMap.values()).find(ex => ex.ts === ts && Math.abs(ex.total - total) < 0.01);
    if (existing && existing.receiptNo === rNo) {
      duplicateSalesCount++;
      return;
    }
  }

  const discountAmt = parseFloat(s['Discounts']) || 0;
  const taxAmt = parseFloat(s['Taxes']) || 0;
  const paymentMethod = (s['Payment type'] || 'Cash').trim();
  const cashier = (s['Cashier name'] || 'Owner').trim();

  let items = itemsEntry ? itemsEntry.items : [];
  if (!items.length) {
    const desc = (s['Description'] || '').trim();
    if (desc) {
      const parts = desc.split(',').map(p => p.trim());
      parts.forEach(p => {
        const m = p.match(/^(\d+)\s*x\s*(.+)$/i);
        const q = m ? parseFloat(m[1]) : 1;
        const n = normalizeItemName(m ? m[2] : p);
        const matched = productMap.get(`name:${n.toLowerCase()}`);
        items.push({
          productId: matched ? matched.id : `prod_${Math.random().toString(36).slice(2, 9)}`,
          name: n,
          price: items.length === 1 ? total : (matched ? matched.price : 0),
          cost: matched ? matched.cost : 0,
          qty: q,
          category: matched ? matched.category : 'MISC',
          unitType: 'piece',
          unit: 'pc',
          piecesPerPack: 1,
          isCustom: n.startsWith('#'),
          imageUrl: matched ? matched.imageUrl : ''
        });
      });
    }
  }

  const newSale = {
    id: `TXN-${rNo}`,
    receiptNo: rNo,
    ts,
    items,
    subtotal: parseFloat((total + discountAmt).toFixed(2)),
    discountType: 'percent',
    discountValue: 0,
    discountAmt,
    vat: taxAmt,
    total,
    method: paymentMethod,
    tendered: total,
    change: 0,
    cashier,
    status: 'Closed',
    source: 'imported',
    isImported: true
  };

  newSalesCount++;
  newSalesList.push(newSale);
  existingReceiptMap.set(rNo, newSale);
  existingSignatureSet.add(sig);
});

// Check if any receipts in receipts_by_item were missed in summary
itemsByReceipt.forEach((val, rNo) => {
  if (!existingReceiptMap.has(rNo)) {
    const ts = parseDateToTimestamp(val.dateStr);
    const total = parseFloat(val.totalNet.toFixed(2));
    const subtotal = parseFloat(val.totalGross.toFixed(2));
    const discountAmt = parseFloat(Math.max(0, subtotal - total).toFixed(2));
    const newSale = {
      id: `TXN-${rNo}`,
      receiptNo: rNo,
      ts,
      items: val.items,
      subtotal: subtotal || total,
      discountType: 'percent',
      discountValue: 0,
      discountAmt,
      vat: 0,
      total,
      method: 'Cash',
      tendered: total,
      change: 0,
      cashier: val.cashier || 'Owner',
      status: 'Closed',
      source: 'imported',
      isImported: true
    };
    newSalesCount++;
    newSalesList.push(newSale);
    existingReceiptMap.set(rNo, newSale);
  }
});

// 5. Build merged catalog
const uniqueProducts = Array.from(new Set(Array.from(productMap.values()))).filter(p => p && p.id && !p.id.includes(':'));
const catalogSeed = {
  categories: Array.from(categoriesSet).sort(),
  products: uniqueProducts
};
console.log(`Writing catalog_seed.js: ${catalogSeed.categories.length} categories, ${catalogSeed.products.length} products (${imagesPreservedCount} images preserved).`);

fs.writeFileSync(
  path.join(__dirname, '..', 'js', 'catalog_seed.js'),
  `// Auto-generated catalog seed from Loyverse export\nconst CATALOG_SEED = ${JSON.stringify(catalogSeed, null, 2)};\nif (typeof module !== 'undefined') module.exports = CATALOG_SEED;\n`,
  'utf8'
);

// 6. Build merged sales list
const finalSales = Array.from(existingReceiptMap.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
console.log(`Writing sales_seed.js: ${finalSales.length} total transactions (${newSalesCount} new added, ${duplicateSalesCount} duplicates preserved).`);

fs.writeFileSync(
  path.join(__dirname, '..', 'js', 'sales_seed.js'),
  `// Auto-generated Loyverse receipts seed\nconst SALES_SEED = ${JSON.stringify(finalSales, null, 2)};\nif (typeof module !== 'undefined') module.exports = SALES_SEED;\n`,
  'utf8'
);

// 7. Write change record to data/import_records.json
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const recordsPath = path.join(dataDir, 'import_records.json');
let history = [];
if (fs.existsSync(recordsPath)) {
  try {
    history = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    if (!Array.isArray(history)) history = [];
  } catch (e) {
    history = [];
  }
}

const nowIso = new Date().toISOString();
const record = {
  importId: `import_${Date.now()}`,
  timestamp: nowIso,
  source: 'Loyverse AI prompt CSV export (Receipts, Receipts by Item, Inventory, Daily Sales)',
  summary: {
    inventoryRowsProcessed: itemCatalogRows.length,
    inventoryNewAdded: newProductsCount,
    inventoryStockUpdated: stockUpdatedCount,
    inventoryPriceOrCostUpdated: priceOrCostUpdatedCount,
    inventoryImagesPreserved: imagesPreservedCount,
    salesSummariesProcessed: summaryRows.length,
    salesLineItemsProcessed: itemRows.length,
    salesNewImported: newSalesCount,
    salesExistingDuplicatesPreserved: duplicateSalesCount,
    salesCancelledIgnored: cancelledCount,
    totalSalesInDatabase: finalSales.length
  },
  newSalesTransactions: newSalesList.map(s => ({
    id: s.id,
    receiptNo: s.receiptNo,
    date: new Date(s.ts).toLocaleString(),
    total: s.total,
    method: s.method,
    cashier: s.cashier,
    itemsCount: s.items.length,
    items: s.items.map(it => `${it.qty}x ${it.name} (@₱${it.price})`).join(', ')
  })),
  inventoryHighlights: inventoryChanges.slice(0, 30)
};

history.unshift(record);
fs.writeFileSync(recordsPath, JSON.stringify(history, null, 2), 'utf8');
console.log(`Saved change record to data/import_records.json (Total records in history: ${history.length})`);

// Also save record copy in scripts/temp_receipts/latest_import_report.json for reference
fs.writeFileSync(
  path.join(__dirname, 'temp_receipts', 'latest_import_report.json'),
  JSON.stringify(record, null, 2),
  'utf8'
);

console.log('=== IMPORT COMPLETE ===');
