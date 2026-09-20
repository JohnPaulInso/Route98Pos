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
  if (str.includes('.')) {
    str = str.split('.')[0];
  }
  return str.replace(/[^0-9]/g, '');
}

function normalizeItemName(rawName) {
  if (!rawName) return 'Custom Item';
  let name = rawName.trim().replace(/\s+/g, ' ');
  if (/^CREAMLINE FAMILY DOU /i.test(name)) {
    name = name.replace(/^CREAMLINE FAMILY DOU /i, 'CREAMLINE FAMILY DUO ');
  }
  if (/COBRA RISE ENERGY PO /i.test(name)) {
    name = name.replace(/COBRA RISE ENERGY PO /i, 'COBRA RISE ENERGY PRO ');
  }
  if (/MIGHTY PULA\s+STICK/i.test(name)) {
    name = 'MIGHTY PULA STICK';
  }
  if (/MR\.\s*CHIPS\s+NACHO CHEEZE/i.test(name)) {
    name = name.replace(/CHEEZE/i, 'CHEESE');
  }
  if (/CREAMLINE PINOY CLASSIC.*MANGGO/i.test(name)) {
    name = name.replace(/MANGGO/i, 'MANGO');
  }
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

console.log('1. Reading items.csv...');
const itemsRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'items.csv'), 'utf8');
const itemCatalogRows = parseCSV(itemsRaw);
console.log(`Parsed ${itemCatalogRows.length} catalog item rows.`);

const categoriesSet = new Set();
const productMap = new Map();
const barcodeMap = new Map();

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
  const imageUrl = (r['IMAGE LINK'] || r['Image'] || '').trim();

  const id = sku ? `p_${sku}` : `p_item_${idx + 1}`;
  const prod = {
    id,
    sku: sku || '',
    name,
    category,
    cost,
    price,
    stock: inStock,
    lowStockThreshold: lowStock,
    trackStock,
    unit: 'pc',
    unitType: 'piece',
    piecesPerPack: 1,
    barcode,
    imageUrl: imageUrl.startsWith('http') ? imageUrl : ''
  };

  productMap.set(id, prod);
  if (sku) productMap.set(`sku:${sku}`, prod);
  if (barcode) barcodeMap.set(barcode, prod);
  productMap.set(`name:${name.toLowerCase()}`, prod);
});

const uniqueProducts = Array.from(new Set(Array.from(productMap.values())));
const catalogSeed = {
  categories: Array.from(categoriesSet).sort(),
  products: uniqueProducts
};

console.log(`Generated ${catalogSeed.categories.length} categories and ${catalogSeed.products.length} products.`);
fs.writeFileSync(
  path.join(__dirname, '..', 'js', 'catalog_seed.js'),
  `// Auto-generated catalog seed from Loyverse export\nconst CATALOG_SEED = ${JSON.stringify(catalogSeed, null, 2)};\nif (typeof module !== 'undefined') module.exports = CATALOG_SEED;\n`,
  'utf8'
);

console.log('2. Reading receipts and receipts_by_item...');
const receiptsRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'receipts.csv'), 'utf8');
const receiptsItemsRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'receipts_by_item.csv'), 'utf8');

const summaryRows = parseCSV(receiptsRaw);
const itemRows = parseCSV(receiptsItemsRaw);
console.log(`Parsed ${summaryRows.length} receipt summaries and ${itemRows.length} receipt items.`);

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
    category: category || 'MISC',
    unitType: 'piece',
    unit: 'pc',
    piecesPerPack: 1,
    isCustom: name.startsWith('#') || name.toLowerCase() === 'custom item' || !sku,
    imageUrl: matchedProd ? matchedProd.imageUrl : ''
  };

  if (!itemsByReceipt.has(rNo)) {
    itemsByReceipt.set(rNo, []);
  }
  itemsByReceipt.get(rNo).push(itemObj);
});

const processedSales = [];
summaryRows.forEach(s => {
  const rNo = (s['Receipt number'] || '').trim();
  if (!rNo) return;
  const status = (s['Status'] || '').trim().toLowerCase();
  const rType = (s['Receipt type'] || '').trim().toLowerCase();
  if (status.includes('cancel') || rType.includes('cancel')) return;

  const dateStr = (s['Date'] || '').trim();
  const ts = parseDateToTimestamp(dateStr);
  const total = parseFloat(s['Total collected'] || s['Net sales'] || s['Gross sales']) || 0;
  const discountAmt = parseFloat(s['Discounts']) || 0;
  const taxAmt = parseFloat(s['Taxes']) || 0;
  const paymentMethod = (s['Payment type'] || 'Cash').trim();
  const cashier = (s['Cashier name'] || 'Owner').trim();

  let items = itemsByReceipt.get(rNo) || [];
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
          price: items.length === 1 ? total : 0,
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

  const orderSig = items.map(it => `${it.qty}x${it.name.toLowerCase()}`).sort().join('|');
  const dupKey = `${ts}_${total.toFixed(2)}_${orderSig}`;

  processedSales.push({
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
    dupKey
  });
});

const mergedSalesMap = new Map();
processedSales.forEach(sale => {
  if (mergedSalesMap.has(sale.dupKey)) {
    const ex = mergedSalesMap.get(sale.dupKey);
    ex.id = sale.id;
    ex.receiptNo = `${ex.receiptNo}, ${sale.receiptNo}`;
    if (sale.items && sale.items.length) ex.items = sale.items;
    ex.method = sale.method || ex.method;
    ex.cashier = sale.cashier || ex.cashier;
  } else {
    mergedSalesMap.set(sale.dupKey, sale);
  }
});

const finalSales = Array.from(mergedSalesMap.values()).map(s => {
  const copy = { ...s };
  delete copy.dupKey;
  return copy;
}).sort((a, b) => (b.ts || 0) - (a.ts || 0));

console.log(`Generated ${finalSales.length} unique sales transactions.`);
fs.writeFileSync(
  path.join(__dirname, '..', 'js', 'sales_seed.js'),
  `// Auto-generated Loyverse receipts seed\nconst SALES_SEED = ${JSON.stringify(finalSales, null, 2)};\nif (typeof module !== 'undefined') module.exports = SALES_SEED;\n`,
  'utf8'
);

console.log('Done generating catalog_seed.js and sales_seed.js.');
