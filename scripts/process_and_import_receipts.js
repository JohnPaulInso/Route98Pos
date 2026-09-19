const fs = require('fs');
const path = require('path');

// Simple CSV Parser handling quoted cells and commas
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]);
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

// Spelling corrections map & normalizer
const SPELLING_CORRECTIONS = {
  'MANGGO': 'MANGO',
  'CHEEZE': 'CHEESE',
  'PZZA': 'PIZZA',
  'CHKN': 'CHICKEN',
  'STNGHN': 'SOTANGHON',
  'FLKSNOIL': 'FLAKES IN OIL',
  'AFRTDA': 'AFRITADA',
  'HOTSPCY': 'HOT & SPICY',
  'SPCYHTBF': 'SPICY HOT BEEF',
  'SPCYSF': 'SPICY SEAFOOD',
  'DOU': 'DUO'
};

function normalizeItemName(rawName) {
  if (!rawName) return 'Custom Item';
  let name = rawName.trim().replace(/\s+/g, ' ');
  
  // Specific known full replacements
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
  // Formats: "19/09/2026 22:16" or "16 Sept 2026 20:58"
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (dmyMatch) {
    const [_, d, m, y, h, min] = dmyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)).getTime();
  }
  const textDate = new Date(dateStr);
  if (!isNaN(textDate.getTime())) return textDate.getTime();
  return Date.now();
}

console.log('Loading CSV datasets...');
const receiptsSummaryRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'receipts.csv'), 'utf8');
const receiptsItemsRaw = fs.readFileSync(path.join(__dirname, 'temp_receipts', 'receipts_by_item.csv'), 'utf8');

const summaryRows = parseCSV(receiptsSummaryRaw);
const itemRows = parseCSV(receiptsItemsRaw);

console.log(`Parsed ${summaryRows.length} summary rows and ${itemRows.length} item rows.`);

// Group item rows by Receipt number
const itemsByReceipt = new Map();
const detectedMisspells = new Map();

itemRows.forEach(r => {
  const rNo = (r['Receipt number'] || '').trim();
  if (!rNo) return;
  const status = (r['Status'] || '').trim().toLowerCase();
  const rType = (r['Receipt type'] || '').trim().toLowerCase();
  if (status.includes('cancel') || rType.includes('cancel')) return;

  const rawName = (r['Item'] || '').trim();
  const normalizedName = normalizeItemName(rawName);
  if (rawName !== normalizedName && !detectedMisspells.has(rawName)) {
    detectedMisspells.set(rawName, normalizedName);
  }

  const sku = (r['SKU'] || '').trim().replace(/[@Q]$/, '');
  const qty = parseFloat(r['Quantity']) || 1;
  const grossSales = parseFloat(r['Gross sales']) || 0;
  const price = qty > 0 ? parseFloat((grossSales / qty).toFixed(2)) : 0;
  const cost = parseFloat(r['Cost of goods']) || 0;
  const unitCost = qty > 0 ? parseFloat((cost / qty).toFixed(2)) : 0;
  const category = (r['Category'] || 'MISC').trim().toUpperCase();
  const isCustom = normalizedName.startsWith('#') || normalizedName.toLowerCase() === 'custom item' || !sku || category === 'MISC' && cost === 0;

  const itemObj = {
    productId: sku || 'prod_' + Math.random().toString(36).slice(2, 9),
    name: normalizedName,
    price,
    cost: unitCost,
    qty,
    category: category || 'MISC',
    unitType: 'piece',
    unit: 'pc',
    piecesPerPack: 1,
    isCustom,
    imageUrl: ''
  };

  if (!itemsByReceipt.has(rNo)) {
    itemsByReceipt.set(rNo, []);
  }
  itemsByReceipt.get(rNo).push(itemObj);
});

console.log(`Detected and corrected ${detectedMisspells.size} misspelled/unnormalized product names:`);
for (const [bad, good] of detectedMisspells.entries()) {
  console.log(`  "${bad}" -> "${good}"`);
}

// Process summary rows into structured sales
const processedSales = [];
const duplicateReceipts = [];

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

  // Get items either from itemsByReceipt or fallback parse Description
  let items = itemsByReceipt.get(rNo) || [];
  if (!items.length) {
    const desc = (s['Description'] || '').trim();
    if (desc) {
      const parts = desc.split(',').map(p => p.trim());
      parts.forEach(p => {
        const m = p.match(/^(\d+)\s*x\s*(.+)$/i);
        const q = m ? parseFloat(m[1]) : 1;
        const n = normalizeItemName(m ? m[2] : p);
        items.push({
          productId: 'prod_' + Math.random().toString(36).slice(2, 9),
          name: n,
          price: items.length === 1 ? total : 0,
          qty: q,
          category: 'MISC',
          unitType: 'piece',
          unit: 'pc',
          piecesPerPack: 1,
          isCustom: n.startsWith('#'),
          imageUrl: ''
        });
      });
    }
  }

  // Signature for exact duplicate order detection:
  // Same date time, amount, and exact same items/quantities
  const orderSignature = items
    .map(it => `${it.qty}x${it.name.toLowerCase()}`)
    .sort()
    .join('|');
  const dupKey = `${ts}_${total.toFixed(2)}_${orderSignature}`;

  const saleRecord = {
    id: `TXN-${rNo}`,
    receiptNo: rNo,
    ts,
    dateStr,
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
  };

  processedSales.push(saleRecord);
});

console.log(`Constructed ${processedSales.length} total sales records.`);

// Deduplicate: "dont allow duplicated ones if its same date time and amount and exactly same order, just merge the old one with the new one that was recently imported"
const mergedSalesMap = new Map();
let duplicateCount = 0;

processedSales.forEach(sale => {
  if (mergedSalesMap.has(sale.dupKey)) {
    duplicateCount++;
    const existing = mergedSalesMap.get(sale.dupKey);
    // Merge: update with newer receipt info
    existing.id = sale.id; // merge id
    existing.receiptNo = `${existing.receiptNo}, ${sale.receiptNo}`;
    if (sale.items && sale.items.length) existing.items = sale.items;
    existing.method = sale.method || existing.method;
    existing.cashier = sale.cashier || existing.cashier;
  } else {
    mergedSalesMap.set(sale.dupKey, sale);
  }
});

const finalSales = Array.from(mergedSalesMap.values()).map(s => {
  const copy = { ...s };
  delete copy.dupKey;
  delete copy.dateStr;
  return copy;
});

// Sort by timestamp descending
finalSales.sort((a, b) => (b.ts || 0) - (a.ts || 0));

console.log(`Deduplicated: found ${duplicateCount} duplicate transactions.`);
console.log(`Final unique sales transactions count: ${finalSales.length}`);

// Write to JSON seed
const outJsonPath = path.join(__dirname, '..', 'js', 'sales_seed.js');
const fileContent = `// Auto-generated Loyverse receipts seed with duplicate detection and spell normalization
const SALES_SEED = ${JSON.stringify(finalSales, null, 2)};
if (typeof module !== 'undefined') module.exports = SALES_SEED;
`;

fs.writeFileSync(outJsonPath, fileContent, 'utf8');
console.log(`Saved ${finalSales.length} imported sales to js/sales_seed.js`);
