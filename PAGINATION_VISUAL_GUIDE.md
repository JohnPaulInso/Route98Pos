# Pagination Visual Style Guide

## Uniform Design (All Modules EXCEPT POS)

### Layout Structure
```
┌────────────────────────────────────────────────────────────────┐
│                   CENTERED PAGINATION BAR                       │
│                                                                 │
│   ┌──────────┐     ┌──────────────────┐    ┌─────────────────┐│
│   │  [<] [>] │     │ Page: [1] of 6  │    │ Rows per page: 10│
│   └──────────┘     └──────────────────┘    └─────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Navigation Arrows
```
┌──────────────┐
│   [<]  [>]   │  ← White box with border
└──────────────┘
```
- **Container**: White background, 1px border, 8px border-radius, 4px padding
- **Buttons**: 8px × 12px padding, no border, transparent background
- **Icons**: chevron-left, chevron-right (18px size)
- **Disabled State**: Opacity 0.3, cursor not-allowed
- **Active State**: Opacity 1, cursor pointer

#### 2. Page Display
```
Page: [  1  ] of 6
      └─┬─┘
    70px input
```
- **Label**: "Page:" in 16px, font-weight 500
- **Input**: 70px wide, centered text, 16px font-size, font-weight 600
- **Input Style**: 8px × 12px padding, 1px border, 6px border-radius
- **Separator**: " of " text
- **Total**: "{totalPages}" in 16px, font-weight 500

#### 3. Rows Per Page Selector
```
Rows per page: [ 10 ▼ ]
               └───┬──┘
              Select dropdown
```
- **Label**: "Rows per page:" in 16px, font-weight 500
- **Select**: 8px × 12px padding (32px right for arrow)
- **Select Style**: 1px border, 6px border-radius, 16px font-size, font-weight 600
- **Options**: 10, 25, 50, 100
- **Background**: White

### Spacing & Alignment
- **Container Gap**: 16px between each component
- **Container Padding**: 16px all sides
- **Flex**: `justify-content: center`, `align-items: center`
- **Wrap**: `flex-wrap: wrap` for responsive behavior

### Colors (CSS Variables)
- **Text**: `var(--ink)` → #333 or theme color
- **Border**: `var(--line)` → #e0e0e0 or theme border
- **Background**: `var(--paper-raised)` → #fafafa or raised surface

### Complete HTML Template
```html
<div class="card-pagination" style="display:flex;align-items:center;justify-content:center;gap:16px;padding:16px;background:var(--paper-raised);border-radius:8px;flex-wrap:wrap;">
  
  <!-- Arrow Navigation -->
  <div style="display:flex;align-items:center;gap:8px;background:white;border:1px solid var(--line);border-radius:8px;padding:4px;">
    <button id="prev-btn" style="padding:8px 12px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;color:var(--ink);">
      ← (chevron-left icon)
    </button>
    <button id="next-btn" style="padding:8px 12px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;color:var(--ink);">
      → (chevron-right icon)
    </button>
  </div>
  
  <!-- Page Input -->
  <div style="display:flex;align-items:center;gap:8px;font-size:16px;color:var(--ink);">
    <span style="font-weight:500;">Page:</span>
    <input type="number" value="1" min="1" max="6" style="width:70px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;text-align:center;font-size:16px;font-weight:600;" />
    <span style="font-weight:500;">of 6</span>
  </div>
  
  <!-- Rows Per Page -->
  <div style="display:flex;align-items:center;gap:8px;font-size:16px;color:var(--ink);">
    <span style="font-weight:500;">Rows per page:</span>
    <select style="padding:8px 32px 8px 12px;border:1px solid var(--line);border-radius:6px;font-size:16px;font-weight:600;background:white;cursor:pointer;">
      <option value="10">10</option>
      <option value="25">25</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>
  </div>
  
</div>
```

## Responsive Behavior

### Desktop (> 768px)
```
[<] [>]    Page: [1] of 6    Rows per page: [10▼]
```
- All components in single row
- Full spacing maintained

### Tablet (480px - 768px)
```
[<] [>]    Page: [1] of 6
    Rows per page: [10▼]
```
- Wraps to 2 rows if needed
- Components remain centered

### Mobile (< 480px)
```
     [<] [>]
  Page: [1] of 6
Rows per page: [10▼]
```
- Each component may stack
- Maintains center alignment
- Touch-friendly button sizes

## State Variations

### First Page (Prev Disabled)
```
[[<]] [>]    Page: [1] of 6    Rows per page: [10▼]
  ↑
Faded/disabled
```

### Last Page (Next Disabled)
```
[<] [[>]]    Page: [6] of 6    Rows per page: [10▼]
      ↑
Faded/disabled
```

### Single Page (No Pagination)
```
(Pagination hidden entirely)
```

## DO NOT Use This Design In

### ❌ POS/Minimart Module
The POS module uses a custom compact design:
```
┌─────────────────────────┐
│ [<] Page 1 of 5  [>]   │  ← Compact pill design
└─────────────────────────┘
```
**Reason**: Space-constrained POS interface needs simpler design

## Implementation Modules

### ✅ Uses Uniform Design
1. **Reports Module**
   - Receipt Browser
   - Void Audit Logs
   - Daily Sales Table
   
2. **Inventory Module**
   - Physical Count Audit Modal
   
3. **Future Modules** (when implemented)
   - Expenses list
   - Fuel sales history
   - Restaurant bookings list

### ❌ Custom Design (Excluded)
1. **POS Module**
   - Product catalog pagination
   - Keep existing compact design

## Accessibility Features

### Keyboard Navigation
- **Tab**: Move between buttons/inputs
- **Enter**: Activate focused button
- **Arrow Keys**: Increment/decrement page input
- **Space**: Open dropdown (on select)

### Screen Readers
- Buttons have clear labels
- Disabled state announced
- Input has min/max attributes
- Select has descriptive text

### Touch Targets
- Minimum 44×44px touch areas
- Adequate spacing between elements
- Large, easy-to-tap buttons

## Animation & Transitions

### Hover States
```css
button:hover {
  background: rgba(0,0,0,0.05);
  transition: background 0.15s ease;
}
```

### Disabled State
```css
button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}
```

### Focus States
```css
input:focus, select:focus {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
```

## Best Practices

### ✅ DO
- Center the entire pagination bar
- Use consistent 16px font size
- Maintain 16px gaps between components
- Disable prev on first page, next on last page
- Show pagination only when items > rows per page
- Use semantic HTML (button, input, select)

### ❌ DON'T
- Add extra decorative elements
- Use different font sizes/weights
- Add First/Last buttons (removed for simplicity)
- Show "Showing X-Y of Z" text (keep it clean)
- Use complex multi-row layouts
- Override user's system font

## Testing Checklist

When implementing in a new module:

- [ ] Pagination hidden for single page
- [ ] Prev disabled on page 1
- [ ] Next disabled on last page
- [ ] Page input validates (1 to totalPages)
- [ ] Rows per page changes reset to page 1
- [ ] Design matches visual specification exactly
- [ ] Responsive on mobile/tablet/desktop
- [ ] Keyboard navigation works
- [ ] Touch targets are adequate (44×44px min)
- [ ] Works in all supported browsers

## Code Snippet

### Reusable Function (JavaScript)
```javascript
function uniformPaginationHTML(prefix, curPage, totalPages, rowsPerPage) {
  return `
    <div class="card-pagination" style="display:flex;align-items:center;justify-content:center;gap:16px;padding:16px;background:var(--paper-raised);border-radius:8px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;background:white;border:1px solid var(--line);border-radius:8px;padding:4px;">
        <button id="${prefix}-prev" ${curPage <= 1 ? 'disabled' : ''} style="padding:8px 12px;border:none;background:transparent;cursor:${curPage <= 1 ? 'not-allowed' : 'pointer'};display:flex;align-items:center;opacity:${curPage <= 1 ? '0.3' : '1'};">
          ${Icons.get("chevron-left", {size:18})}
        </button>
        <button id="${prefix}-next" ${curPage >= totalPages ? 'disabled' : ''} style="padding:8px 12px;border:none;background:transparent;cursor:${curPage >= totalPages ? 'not-allowed' : 'pointer'};display:flex;align-items:center;opacity:${curPage >= totalPages ? '0.3' : '1'};">
          ${Icons.get("chevron-right", {size:18})}
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:16px;">
        <span style="font-weight:500;">Page:</span>
        <input type="number" id="${prefix}-page" value="${curPage}" min="1" max="${totalPages}" style="width:70px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;text-align:center;font-size:16px;font-weight:600;" />
        <span style="font-weight:500;">of ${totalPages}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:16px;">
        <span style="font-weight:500;">Rows per page:</span>
        <select id="${prefix}-rpp" style="padding:8px 32px 8px 12px;border:1px solid var(--line);border-radius:6px;font-size:16px;font-weight:600;background:white;">
          <option value="10" ${rowsPerPage === 10 ? 'selected' : ''}>10</option>
          <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
        </select>
      </div>
    </div>
  `;
}
```

---

**Version**: 1.0.0  
**Last Updated**: October 3, 2026  
**Status**: Official Design Specification ✅
