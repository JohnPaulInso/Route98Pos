# 📋 Physical Count Audit - Catch Theft Immediately!

## 🎯 How It Works

### The Smart Way to Catch Theft

Instead of checking random items, the audit now shows **only items from recent sales** - the ones most likely to have theft!

### Real Example

```
Scenario: You sold 1 bar of soap

Expected: Stock should decrease by 1
System shows: Stock decreased by 4

Result: Someone stole 3 bars! 🚨
```

---

## 🔍 What Gets Audited

The system analyzes the **last 50 sales** and shows:

1. **Items that were actually sold** (not random items)
2. **Sorted by sale frequency** (most sold items first)
3. **Up to 25 items** from recent transactions
4. **Includes zero-stock items** (catches total theft)

### Why This is Better

| Old Way | New Way |
|---------|---------|
| Check 20 random low-stock items | Check 25 recently sold items |
| Might miss theft entirely | Catches theft right after it happens |
| No context on sales | Shows how many times sold |
| Can't verify specific transactions | Direct verification of recent sales |

---

## 📱 How to Use

### Step 1: Complete Some Sales
```
Customer buys:
- 1x Soap (₱25)
- 2x Shampoo (₱150)
- 1x Toothpaste (₱45)

Total: ₱220
```

### Step 2: Open Physical Count Audit
1. Go to **Inventory** view
2. Click **"Physical Count Audit"** button
3. Modal opens with recently sold items

### Step 3: Verify Physical Counts

The audit shows:

```
┌─────────────────────────────────────────────────────────┐
│ 📌 Physical Count Audit - Recent Transactions           │
├─────────────────────────────────────────────────────────┤
│ Verify items from last 50 sales to catch theft          │
│                                                          │
│ 💡 Tip: If you sold 1 soap but stock decreased by 4,    │
│         someone stole 3!                                 │
├─────────────────────────────────────────────────────────┤
│ Item        Times Sold  System  Physical  Status        │
│ Soap           15x        40      [37]      −3 ⚠️       │
│ Shampoo         8x        25      [25]       ✓          │
│ Toothpaste      6x        30      [30]       ✓          │
├─────────────────────────────────────────────────────────┤
│ ⚠️ Stock Discrepancies Detected                         │
│    Physical counts don't match. Could indicate theft.   │
├─────────────────────────────────────────────────────────┤
│ [Log Theft/Discrepancies] [Save & Update Stock]         │
└─────────────────────────────────────────────────────────┘
```

### Step 4: Log Theft

If discrepancies found:
1. Click **"Log Theft/Discrepancies"**
2. System shows each mismatch
3. Select reason:
   - ✅ Theft / Shoplifting
   - ✅ Damaged / Spoiled
   - ✅ Employee Consumption
   - ✅ Miscount / Data Entry Error
4. Click **"Save Audit Logs"**

### Step 5: Review Logs

All theft/shrinkage logged in:
- **Restock Log** (red negative entries)
- **Stock Log** (complete audit trail)

---

## 🎨 Visual Features

### "Times Sold" Badge
Shows how many times the item was sold recently:
```
Soap: [15x] ← Sold 15 times in last 50 sales
```

### Status Indicator
- **✓** = Counts match (green)
- **−3** = Missing 3 units (red)
- **+2** = Found 2 extra (orange)

### Alert Banner
Only appears when discrepancies detected:
```
⚠️ Stock Discrepancies Detected
   Physical counts don't match system.
   This could indicate theft, damage, or errors.
```

---

## 🔥 Real-World Scenarios

### Scenario 1: Shoplifting During Rush Hour
```
Sold: 5x Chocolate bars at lunch rush
Expected Stock: 50 - 5 = 45
Physical Count: 42
Discrepancy: −3 bars missing

Action: Log as "Theft / Shoplifting"
Result: −3 logged in restock log (red entry)
```

### Scenario 2: Damaged Goods
```
Sold: 2x Bottles of cooking oil
Expected Stock: 20 - 2 = 18
Physical Count: 17
Discrepancy: −1 bottle missing

Action: Log as "Damaged / Spoiled"
Result: −1 logged with damage reason
```

### Scenario 3: Data Entry Error
```
Sold: 1x Rice bag
Expected Stock: 100 - 1 = 99
Physical Count: 102
Discrepancy: +3 bags found

Action: Log as "Miscount / Data Entry Error"
Result: +3 correction logged
```

### Scenario 4: Everything Matches
```
All physical counts match system stock

Action: Click "Save & Update Stock"
Result: ✓ No theft detected! (success message)
```

---

## 📊 Benefits

### For Store Owners
✅ **Immediate theft detection** - Catch it right after sales
✅ **Context-aware** - Only check items that were actually sold
✅ **Time-efficient** - No need to count entire inventory
✅ **Complete audit trail** - Every discrepancy logged with reason

### For Managers
✅ **Prioritized items** - Most sold items shown first
✅ **Easy verification** - Just count and enter numbers
✅ **Quick theft logging** - One-click reason selection
✅ **Historical tracking** - Review patterns in restock log

### For Cashiers
✅ **No interruption** - Audit happens when convenient
✅ **Not forced** - Admin does it during quiet times
✅ **Fast checkout** - No verification slowing down sales

---

## 🎯 Best Practices

### When to Run Audit

**Best Times:**
- After lunch rush (12-2 PM)
- After school dismissal rush (3-5 PM)
- End of shift
- After busy Saturday/Sunday
- When suspicious activity noticed

**Don't Run:**
- During active checkout (blocks admin)
- When no recent sales (nothing to verify)
- Too frequently (trust your staff)

### How Often

- **High theft risk area:** 2-3 times per day
- **Normal store:** Once per day (end of shift)
- **Low risk:** 2-3 times per week

### What to Check

The system automatically prioritizes:
1. Most frequently sold items first
2. Items with recent price changes
3. High-value items
4. Previously flagged items

---

## 🔒 Security Features

### Admin-Only Access
```javascript
if(user.role !== "admin"){
  toast("Admin-only feature");
  return;
}
```

Only users with admin role can access the audit.

### Complete Logging
Every discrepancy creates:
- Restock log entry (with negative quantity if theft)
- Stock log entry (audit trail)
- Timestamp and reason
- Admin name who logged it

### Theft Prevention
- Makes staff aware of monitoring
- Provides evidence for investigations
- Tracks patterns over time
- Identifies high-risk products

---

## 📈 Sample Audit Report

After running audit, check **Restock Log**:

```
Wed, Aug 26, 2026  |  −8 units  |  −₱240.00

Time   Product       Supplier  Qty    Reason
10:30  Soap          N/A       −3    ⚠️ Theft/Shoplifting
11:45  Chocolate     N/A       −5    ⚠️ Theft/Shoplifting
```

Red entries = Losses
Reason shown below product name
Total loss calculated automatically

---

## ✅ Testing Checklist

- [ ] Complete some sales first
- [ ] Click "Physical Count Audit" button
- [ ] See only recently sold items
- [ ] "Times Sold" badge shows correct count
- [ ] Enter different physical count
- [ ] Status indicator turns red with difference
- [ ] Alert banner appears
- [ ] Click "Log Theft/Discrepancies"
- [ ] Select theft reason
- [ ] Save logs
- [ ] Check Restock Log for red entry
- [ ] Verify stock updated correctly

---

## 🚀 Summary

**Before:** Random low-stock audit, might miss theft entirely

**After:** Smart audit of recently sold items, catches theft immediately

**Example:**
```
You sold 1 soap, system says stock -4

The audit will show:
- Soap was sold 1 time (badge: 1x)
- System stock: 36 (after -4 deduction)
- Physical count: [39] (you count and enter this)
- Discrepancy: +3 (you realize system deducted 4 instead of 1!)

OR if theft:
- Physical count: [33] (3 bars missing from shelf)
- Discrepancy: −3 (theft detected!)
```

**Perfect for:** Catching shoplifting, employee theft, and inventory errors right after they happen!
