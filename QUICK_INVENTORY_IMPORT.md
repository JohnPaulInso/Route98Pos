# Quick Inventory Import Reference

## 🚀 Fast Import Steps

1. **Open Inventory View** in Route 98 POS
2. **Click "Import"** button (toolbar or Tools menu)
3. **Select** `export_items (8).csv`
4. **Keep checked**: "Update Existing Products"
5. **Click** "Import Inventory"
6. **Wait** ~14 seconds for 703 items
7. **Done!** ✅

---

## 📊 What Gets Imported

```
Your CSV → Route 98
─────────────────────────────────────────
Column M (Cost)      → Cost Price
Column S (Price)     → Selling Price ✅
Name                 → Product Name
Barcode              → Barcode
Category             → Category
In stock             → Stock Quantity
Low stock            → Alert Threshold
```

---

## ⚙️ Important Settings

### ✅ Update Existing Products (Checked)
- Updates cost, price, stock for existing items
- Matches by barcode or name
- **Recommended for re-importing**

### ⬜ Update Existing Products (Unchecked)  
- Only adds new products
- Skips products that already exist
- Use for first-time import

---

## 🎯 What Happens

- ✅ Imports items with "Available for sale = Y"
- ⏭️ Skips items with "Available for sale = N"
- 🔄 Updates/adds ~50 items per second
- 💾 Saves locally (no cloud sync)
- 📊 Shows results: New, Updated, Skipped, Errors

---

## ⚠️ Important Notes

1. **Cost is accurate**: Uses Column M (not Column S)
2. **Price is accurate**: Uses Column S (with profit)
3. **Local only**: No automatic cloud sync
4. **Manual sync**: Settings → Data & Backups (if needed)
5. **No duplicates**: Matches by barcode/name

---

## 🐛 Troubleshooting

**Nothing imported?**
- Check "Available for sale" column = Y

**Wrong prices?**
- Column M should have cost
- Column S should have selling price

**Too many skipped?**
- Either duplicates (good)
- Or "Available for sale" = N

**Need help?**
- See `INVENTORY_IMPORT_GUIDE.md` for full details

---

## 📁 Your File

**File**: `export_items (8).csv`
**Items**: ~703 products
**Time**: ~14 seconds to import
**Storage**: Local database only

---

## ✨ You're Ready!

Just click Import in the Inventory view and select your CSV file. The system will handle the rest!
