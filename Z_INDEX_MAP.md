# Z-Index Stacking Map - Complete Reference

## Overview
This document maps all z-index values used in the Route 98 POS application to help understand the stacking context hierarchy and prevent z-index conflicts.

---

## 🏔️ Z-Index Hierarchy (Highest to Lowest)

### **MAXIMUM PRIORITY** (2147483647 - JavaScript Max Safe Integer)

#### **Modal System** - `z-index: 2147483647`
- **Portal Container** (`#cap-modal-portal`)
  - Location: `index.html` inline style
  - Purpose: Container for all modals - highest possible z-index
  - Context: Fixed positioned, covers entire viewport
  - Status: ✅ CRITICAL - Must be highest

- **Modal Element** (`.modal`)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css` (assumed from previous context)
  - Purpose: Individual modal dialogs
  - Context: Inside portal, relative positioned
  - Status: ✅ CRITICAL

#### **Modal Backdrop** - `z-index: 2147483646`
- **Backdrop** (`.modal-backdrop`, `.modal-product-form-backdrop`)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css`
  - Purpose: Dark overlay behind modals
  - Context: Fixed positioned, full viewport
  - Status: ✅ CRITICAL - One less than modal portal

---

### **VERY HIGH PRIORITY** (10000+)

#### **UI Select Dropdowns** - `z-index: 10005`
- **Open Select Container** (`.ui-select.open`, `.select-field-open`)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css`
  - Purpose: Dropdown container when expanded
  - Context: Relative positioned
  - Status: ✅ Ensures dropdowns appear above other content

#### **Scanner Overlay** - `z-index: 10002`
- **Scanner Container** (`#scanner-overlay`)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css`
  - Purpose: Barcode scanner camera overlay
  - Context: Fixed positioned, full screen
  - Status: ✅ CRITICAL for scanner functionality

#### **Flying Product Ghost** - `z-index: 9999`
- **Product Animation** (`.flying-product-ghost`)
  - Location: `www/css/views.css` line 270
  - Purpose: Animated product image when adding to cart
  - Context: Fixed positioned
  - Status: ✅ Visual feedback for cart actions

#### **UI Select Dropdown List** - `z-index: 9999`
- **Dropdown Options** (`.ui-select-list`)
  - Location: Multiple CSS files
  - Purpose: Dropdown menu options list
  - Context: Absolute positioned
  - Status: ✅ Must appear above page content

#### **Report Breadcrumb Menu** - `z-index: 9999`
- **Crumb Menu** (`#rpt-crumb-menu`)
  - Location: `www/js/reports.js` line 3524
  - Purpose: Report navigation dropdown
  - Context: Absolute positioned
  - Status: ✅ Navigation overlay

#### **Balance Hover Tooltip** - `z-index: 999999` (! very high)
- **Tooltip** (`.date-col-cell:hover .balance-hover-tip`)
  - Location: `www/css/views.css` line 1668
  - Purpose: Balance information tooltip
  - Context: Absolute positioned on hover
  - Status: ⚠️ REVIEW - Extremely high value

---

### **HIGH PRIORITY** (1000-9999)

#### **Toast Stack** - `z-index: 999999` (! duplicate very high)
- **Toast Container** (`#toast-stack`)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css`
  - Purpose: Notification toasts
  - Context: Fixed positioned
  - Status: ⚠️ REVIEW - Same as tooltip above

#### **Audit Disc Card Select** - `z-index: 9999`
- **Select Dropdown** (`.audit-disc-card .ui-select-list`)
  - Location: `www/css/views.css` line 789
  - Purpose: Dropdown in audit cards
  - Context: Absolute positioned
  - Status: ✅ High priority for form dropdowns

#### **Hover Cell** - `z-index: 9999`
- **Date Cell Hover** (`.date-col-cell:hover`)
  - Location: `www/css/views.css` line 1652
  - Purpose: Elevate cell on hover for tooltip
  - Context: Relative positioned
  - Status: ✅ Supports tooltip display

#### **Product Tooltip** - `z-index: 999`
- **Tooltip** (`.prod-card-tooltip`)
  - Location: `www/css/views.css` line 496
  - Purpose: Product information tooltip
  - Context: Absolute positioned
  - Status: ✅ Above cards but below major overlays

#### **Scanner Overlay** - `z-index: 250`
- **Camera View** (`.scan-overlay`)
  - Location: `www/css/views.css` line 434
  - Purpose: Continuous camera scan overlay
  - Context: Fixed positioned, full screen
  - Status: ✅ High priority scanner UI

---

### **MEDIUM PRIORITY** (100-999)

#### **Report Dropdown Menu** - `z-index: 200`
- **Dropdowns** (`.rpt-dropdown-menu`, `.inv-tools-menu`)
  - Location: `www/css/mobile.css` (mobile fixes)
  - Purpose: Report and inventory tool dropdowns
  - Context: Fixed positioned on mobile
  - Status: ✅ Above content, below modals

#### **Report Dropdown** - `z-index: 120`
- **Menu** (`.rpt-dropdown-menu`)
  - Location: `www/css/views.css` line 630
  - Purpose: Report filter dropdowns
  - Context: Absolute positioned
  - Status: ✅ Above tables and content

#### **Audit Select** - `z-index: 100`
- **Select Field** (`.audit-disc-card .ui-select`)
  - Location: `www/css/views.css` line 768
  - Purpose: Dropdown in audit cards
  - Context: Relative positioned
  - Status: ✅ Above card content

#### **Inventory Tools Dropdown** - `z-index: 100`
- **Tools Wrapper** (`.inv-mobile-actions`, `.inv-tools-dropdown-wrap`)
  - Location: `www/js/inventory.js` line 1277-1278
  - Purpose: Mobile inventory tools menu
  - Context: Relative positioned
  - Status: ✅ Above search bar

---

### **LOW PRIORITY** (10-99)

#### **Mobile Cart** - `z-index: 95`
- **Cart Container** (`.pos-cart.mobile-open`)
  - Location: `www/css/views.css` line 1433
  - Purpose: Mobile slide-up cart
  - Context: Fixed positioned
  - Status: ✅ Above content, below modals

#### **Back to Top Button** - `z-index: 90`
- **Button** (`.back-to-top-btn`)
  - Location: `www/css/views.css` line 1399
  - Purpose: Scroll to top button
  - Context: Fixed positioned
  - Status: ✅ Above content

#### **Report Breadcrumb Button** - `z-index: 50`
- **Button** (`.rpt-crumb-curr-btn`)
  - Location: `www/css/mobile.css` (mobile fixes)
  - Purpose: Current report breadcrumb
  - Context: Relative positioned
  - Status: ✅ Above siblings for clickability

#### **Tooltip Container** - `z-index: 50`
- **Tooltip** (`.loy-tooltip`)
  - Location: `www/css/views.css` line 1532
  - Purpose: Loyalty program tooltip
  - Context: Absolute positioned
  - Status: ✅ Above cards

#### **Topbar** - `z-index: 30`
- **Header Bar** (`.topbar`)
  - Location: `www/css/mobile.css` line 102
  - Purpose: Sticky top navigation bar
  - Context: Sticky positioned
  - Status: ✅ Above page content

#### **Venue/Restaurant Table Headers** - `z-index: 20`
- **Sticky Headers** (venue/restaurant booking tables)
  - Location: `www/js/venue.js`, `www/js/restaurant.js`
  - Purpose: Sticky table header (time column)
  - Context: Sticky positioned
  - Status: ✅ Above table rows

#### **Mobile Cart** - `z-index: 25`
- **Cart Drawer** (`.pos-cart`)
  - Location: `www/css/mobile.css` line 435
  - Purpose: Mobile bottom cart drawer
  - Context: Fixed positioned
  - Status: ✅ Above bottom nav

#### **POS Resizer** - `z-index: 10`
- **Column Resizer** (`.pos-resizer`)
  - Location: `www/css/views.css` line 28
  - Purpose: Draggable column resize handle
  - Context: Relative positioned
  - Status: ✅ Above adjacent columns

#### **Table Headers** - `z-index: 10-11`
- **Sticky Headers** (`table.data th`)
  - Location: `www/css/mobile.css` line 300, 327
  - Purpose: Sticky table headers
  - Context: Sticky positioned
  - Status: ✅ Above table body

#### **General UI Elements** - `z-index: 10`
- `.scan-frame-message` - Scan overlay message (line 1478)
- `.loy-cal-nav` - Calendar navigation (line 651)
- Various loading indicators

---

### **MINIMAL PRIORITY** (1-9)

#### **Table Cells** - `z-index: 5-9`
- **Sticky Cells** (table first column)
  - Location: `www/css/mobile.css`, `www/js/venue.js`, `www/js/restaurant.js`
  - Purpose: Sticky first column in tables
  - Context: Sticky positioned
  - Status: ✅ Above table content

#### **Currency Symbol** - `z-index: 2`
- **Symbol Overlay** (shift cash input symbol)
  - Location: `www/js/shift.js` lines 162, 253, 329
  - Purpose: Currency symbol overlay on input
  - Context: Absolute positioned
  - Status: ✅ Above input field

#### **Icon Overlays** - `z-index: 2`
- **Search Icons** (`.pos-search-row .input-icon-wrap .ic-svg`)
  - Location: `www/css/views.css` lines 34, 52, 64, 67
  - Purpose: Icons inside input fields
  - Context: Absolute positioned
  - Status: ✅ Above input background

#### **Shift Change Button** - `z-index: 2`
- **Button** (`#btn-shift-change-cashier`)
  - Location: `www/css/mobile.css` line 75
  - Purpose: Ensure button is clickable
  - Context: Relative positioned
  - Status: ✅ Above siblings

#### **Product Image** - `z-index: 1`
- **Image** (product thumbnails)
  - Location: `www/js/utils.js` line 50
  - Purpose: Product image above icon placeholder
  - Context: Absolute positioned
  - Status: ✅ Above placeholder icon

---

### **ROOT LEVEL** - `z-index: 0-1`

#### **Root Container** - `z-index: 1`
- **App Root** (`#root`)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css`
  - Purpose: Main app container
  - Context: Relative positioned
  - Status: ✅ Base stacking context

#### **Disabled Elements** - `z-index: 0`
- **Modal-Blocked Elements** (`.topbar`, `.pos-cart` when modal open)
  - Location: `android/app/src/main/assets/public/css/apk-fixes.css`
  - Purpose: Push behind modal system
  - Context: Various positioning
  - Status: ✅ Intentionally behind modals

---

## 🎯 Common Z-Index Ranges

| Range | Purpose | Examples |
|-------|---------|----------|
| **2147483647** | Modal System | Portal, modals, modal backdrops |
| **10000+** | Critical Overlays | Scanner, dropdowns in modals |
| **1000-9999** | Tooltips & Toasts | Toast notifications, hover tooltips |
| **100-999** | Dropdowns & Menus | Report filters, inventory tools |
| **10-99** | Navigation & UI | Cart, topbar, back-to-top |
| **1-9** | Minor Overlays | Icons, sticky cells |
| **0** | Base/Blocked | Root, modal-blocked elements |

---

## ⚠️ Issues & Recommendations

### 1. **Duplicate Very High Values**
- Both toast stack and balance tooltip use `z-index: 999999`
- **Recommendation**: Toast should be `999999`, tooltip should be `999998`

### 2. **Scanner Overlay Inconsistency**
- Scanner has two different z-index values:
  - `250` for `.scan-overlay` (views.css)
  - `10002` for `#scanner-overlay` (apk-fixes.css)
- **Recommendation**: Use consistent value `10002`

### 3. **Mobile Cart Multiple Values**
- Cart has `z-index: 25` and `z-index: 95` (when open)
- **Recommendation**: This is intentional - OK

### 4. **Report Dropdown Inconsistency**
- Desktop: `z-index: 120`
- Mobile: `z-index: 200`
- **Recommendation**: Keep mobile higher due to bottom nav

---

## 🔧 How to Add New Z-Index

### **Step 1: Determine Priority Level**
- Is it a modal/overlay? → Use 10000+
- Is it a dropdown? → Use 100-999
- Is it a sticky header? → Use 10-99
- Is it a minor decoration? → Use 1-9

### **Step 2: Check for Conflicts**
- Search this document for existing values in your range
- Ensure your element will stack correctly above/below neighbors

### **Step 3: Document Your Addition**
- Add entry to this document
- Include: element, location, purpose, context

### **Step 4: Test Stacking**
- Open modal → Verify your element appears correctly
- Open dropdowns → Verify no overlap issues
- Test on mobile → Verify responsive behavior

---

## 📚 CSS Files with Z-Index

1. `www/css/views.css` - Main view styles
2. `www/css/mobile.css` - Mobile responsive styles
3. `android/app/src/main/assets/public/css/apk-fixes.css` - APK-specific fixes
4. `www/js/reports.js` - Report inline styles
5. `www/js/venue.js` - Venue booking styles
6. `www/js/restaurant.js` - Restaurant booking styles
7. `www/js/shift.js` - Shift management styles
8. `www/js/inventory.js` - Inventory inline styles
9. `www/js/utils.js` - Utility inline styles
10. `index.html` - Portal container inline style

---

## 🎨 Visual Stacking Hierarchy

```
┌─────────────────────────────────────────┐
│ Modal Portal (2147483647)               │ ← ABSOLUTE TOP
│  ├─ Modal (2147483647)                  │
│  └─ Backdrop (2147483646)               │
├─────────────────────────────────────────┤
│ Scanner Overlay (10002)                 │
│ UI Select Dropdowns (10005)             │
│ Flying Product (9999)                   │
├─────────────────────────────────────────┤
│ Toasts & Tooltips (999-999999)          │
│ Report Menus (120-200)                  │
│ Audit Dropdowns (100-9999)              │
├─────────────────────────────────────────┤
│ Mobile Cart Open (95)                   │
│ Back to Top (90)                        │
│ Breadcrumb Button (50)                  │
│ Topbar (30)                             │
│ Mobile Cart (25)                        │
├─────────────────────────────────────────┤
│ Table Headers (10-20)                   │
│ Calendar Nav (10)                       │
│ Resizer (10)                            │
├─────────────────────────────────────────┤
│ Sticky Cells (5-9)                      │
│ Icons (2)                               │
│ Images (1)                              │
├─────────────────────────────────────────┤
│ Root & Base (0-1)                       │ ← BOTTOM
└─────────────────────────────────────────┘
```

---

**Last Updated:** 2026-10-06  
**Total Unique Z-Index Values:** 30+  
**Highest Value:** 2147483647 (Modal Portal)  
**Lowest Value:** 0 (Blocked elements)

**Note:** This map is based on the current codebase. Always update this document when adding new z-index values!
