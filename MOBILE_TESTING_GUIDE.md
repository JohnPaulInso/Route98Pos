# Mobile Testing Guide - Route 98 POS

## Quick Start Testing

### Browser DevTools Testing (Fastest)

1. **Chrome DevTools**:
   ```
   1. Open Chrome
   2. Press F12 or Cmd+Option+I
   3. Click device toolbar icon (Cmd+Shift+M)
   4. Select device preset or enter custom dimensions
   5. Refresh page
   ```

2. **Common Test Devices**:
   - iPhone SE: 375 x 667
   - iPhone 12/13/14: 390 x 844
   - iPhone 14 Pro Max: 430 x 932
   - Samsung Galaxy S21: 360 x 800
   - iPad Mini: 768 x 1024
   - iPad Pro: 1024 x 1366

### Live Device Testing

1. **Connect via USB**:
   ```bash
   # For Android
   npx cap run android
   
   # For iOS (Mac only)
   npx cap run ios
   ```

2. **Local Network Testing**:
   ```bash
   # Start a local server
   npx http-server -p 8080
   
   # Access from mobile:
   # http://YOUR_COMPUTER_IP:8080
   ```

3. **ngrok Tunnel** (Share with others):
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Create tunnel
   ngrok http 8080
   
   # Use the https URL on any device
   ```

## Feature Testing Checklist

### ✅ Layout & Navigation

- [ ] **Bottom Navigation** (Mobile only)
  - [ ] Appears on screens < 768px
  - [ ] Hides on desktop > 768px
  - [ ] All 5 icons visible
  - [ ] Active state shows on current view
  - [ ] Safe area padding on iPhone notch
  - [ ] Doesn't overlap content

- [ ] **Sidebar** (Desktop/Tablet)
  - [ ] Visible on screens > 768px
  - [ ] Hidden on mobile < 768px
  - [ ] Navigation works correctly
  - [ ] Active states working

- [ ] **Topbar**
  - [ ] Adjusts height on mobile
  - [ ] User chip text truncates
  - [ ] Icons properly sized
  - [ ] Safe area padding at top

### ✅ POS Features

- [ ] **Product Grid**
  - [ ] 2 columns on mobile
  - [ ] 3+ columns on tablet/desktop
  - [ ] Smooth scrolling
  - [ ] Cards properly sized
  - [ ] Images load correctly
  - [ ] Touch targets adequate (44px+)

- [ ] **Cart Drawer** (Mobile)
  - [ ] Starts collapsed (60px peek)
  - [ ] Expands to 40vh on tap
  - [ ] Smooth slide animation
  - [ ] Auto-expands when item added
  - [ ] Collapses on backdrop tap
  - [ ] Doesn't block content when collapsed

- [ ] **Search Bar**
  - [ ] Full width on mobile
  - [ ] No zoom on focus (16px font)
  - [ ] Clear button appears
  - [ ] Rounded corners (24px)

- [ ] **Category Chips**
  - [ ] Horizontal scroll works
  - [ ] Chips properly sized
  - [ ] Active state visible
  - [ ] Touch targets adequate

### ✅ Forms & Inputs

- [ ] **Form Fields**
  - [ ] Stack vertically on mobile
  - [ ] Side-by-side on desktop
  - [ ] Labels readable (0.9rem)
  - [ ] Inputs 44px height
  - [ ] No zoom on focus
  - [ ] Proper keyboard types

- [ ] **Buttons**
  - [ ] Minimum 44x44px
  - [ ] Full width on mobile when stacked
  - [ ] Proper spacing
  - [ ] Active states work
  - [ ] Icons properly sized

- [ ] **Modals**
  - [ ] Slide up from bottom (mobile)
  - [ ] Centered on desktop
  - [ ] Rounded top corners (20px)
  - [ ] Swipe down to close (mobile)
  - [ ] Backdrop tap closes
  - [ ] Action buttons stacked (mobile)

### ✅ Reports & Charts

- [ ] **Chart Grid**
  - [ ] Single column on mobile
  - [ ] 2 columns on tablet
  - [ ] Multi-column on desktop
  - [ ] Charts render correctly
  - [ ] Tooltips visible
  - [ ] Touch interaction works

- [ ] **Tables**
  - [ ] Horizontal scroll on mobile
  - [ ] First column sticky
  - [ ] Headers sticky on scroll
  - [ ] Readable font sizes
  - [ ] Touch-friendly rows

- [ ] **Inventory Cards**
  - [ ] Stack on mobile
  - [ ] 2x2 grid on mobile
  - [ ] Compact spacing
  - [ ] Numbers readable

### ✅ Interactions

- [ ] **Haptic Feedback**
  - [ ] Vibrates on button tap
  - [ ] Different patterns for actions
  - [ ] Can be felt on device
  - [ ] Doesn't lag

- [ ] **Swipe Gestures**
  - [ ] Detects left/right swipes
  - [ ] Provides feedback
  - [ ] Doesn't interfere with scrolling
  - [ ] Works on all touch devices

- [ ] **Splash Screen**
  - [ ] Shows on initial load
  - [ ] Logo animates (pulse)
  - [ ] Spinner rotates
  - [ ] Fades out smoothly
  - [ ] Doesn't flash

- [ ] **Scroll Behavior**
  - [ ] Smooth momentum scrolling
  - [ ] Back to top appears > 300px
  - [ ] Back to top positioned correctly
  - [ ] No overscroll bounce
  - [ ] Content doesn't jump

### ✅ PWA Features

- [ ] **Installation**
  - [ ] "Add to Home Screen" prompt
  - [ ] Installs correctly
  - [ ] Icon appears on home screen
  - [ ] Opens in standalone mode
  - [ ] No browser chrome

- [ ] **App Shortcuts** (Long press icon)
  - [ ] "New Sale" shortcut
  - [ ] "Inventory" shortcut
  - [ ] "Reports" shortcut
  - [ ] Shortcuts work correctly

- [ ] **Offline**
  - [ ] Service worker registers
  - [ ] Works offline (cached)
  - [ ] Shows offline indicator
  - [ ] Syncs when back online

### ✅ Performance

- [ ] **Load Time**
  - [ ] Initial load < 3s
  - [ ] Splash shows immediately
  - [ ] Content loads progressively
  - [ ] No layout shifts

- [ ] **Scroll Performance**
  - [ ] 60fps scrolling
  - [ ] No jank or stutter
  - [ ] Smooth animations
  - [ ] Touch responds instantly

- [ ] **Memory Usage**
  - [ ] No memory leaks
  - [ ] Doesn't slow down
  - [ ] Can use for hours

### ✅ Accessibility

- [ ] **Touch Targets**
  - [ ] All buttons 44px minimum
  - [ ] Adequate spacing between
  - [ ] Easy to tap accurately

- [ ] **Text Readability**
  - [ ] Minimum 14px font
  - [ ] High contrast maintained
  - [ ] Readable in sunlight
  - [ ] No text cut off

- [ ] **Focus States**
  - [ ] Visible on keyboard nav
  - [ ] 3px brand color outline
  - [ ] Tab order logical
  - [ ] Skip links work

### ✅ Edge Cases

- [ ] **Landscape Orientation**
  - [ ] Layout adjusts correctly
  - [ ] No overflow issues
  - [ ] Content accessible
  - [ ] Charts responsive

- [ ] **Notched Devices** (iPhone X+)
  - [ ] Top safe area respected
  - [ ] Bottom safe area respected
  - [ ] Content not under notch
  - [ ] Navigation above home bar

- [ ] **Small Screens** (< 375px)
  - [ ] Layout doesn't break
  - [ ] Text still readable
  - [ ] Buttons still tappable
  - [ ] No horizontal scroll

- [ ] **Large Screens** (Tablets)
  - [ ] Doesn't look stretched
  - [ ] Proper grid layouts
  - [ ] Optimal column count
  - [ ] Good spacing

## Browser Testing

### Required Browsers

- [ ] **Safari iOS** (WebKit)
  - [ ] Latest version
  - [ ] iOS 14+
  - [ ] iPad Safari

- [ ] **Chrome Android**
  - [ ] Latest version
  - [ ] Android 10+

- [ ] **Samsung Internet**
  - [ ] Latest version
  - [ ] Test on Samsung devices

- [ ] **Firefox Mobile**
  - [ ] iOS & Android
  - [ ] Latest version

### Known Issues to Check

1. **Safari iOS**:
   - [ ] Safe areas working
   - [ ] Momentum scrolling enabled
   - [ ] No position:fixed issues
   - [ ] Viewport height correct

2. **Chrome Android**:
   - [ ] Address bar hides on scroll
   - [ ] vh units correct
   - [ ] Touch events work

3. **Samsung Internet**:
   - [ ] Styles render correctly
   - [ ] Fonts load properly
   - [ ] No vendor prefix issues

## Performance Testing

### Lighthouse Audit

```bash
# Run Lighthouse
npx lighthouse http://localhost:8080 --view

# Target Scores:
# Performance: 95+
# Accessibility: 100
# Best Practices: 95+
# SEO: 90+
# PWA: 100
```

### Manual Performance Checks

- [ ] **Network Throttling**
  - [ ] Test on 3G
  - [ ] Test on 4G
  - [ ] Test on WiFi
  - [ ] Offline mode

- [ ] **CPU Throttling**
  - [ ] 4x slowdown test
  - [ ] Still usable
  - [ ] No blocking

## Bug Reporting Template

```markdown
### Bug Description
[Clear description of the issue]

### Device Info
- Device: [e.g., iPhone 13]
- OS: [e.g., iOS 16.2]
- Browser: [e.g., Safari 16]
- Screen Size: [e.g., 390x844]

### Steps to Reproduce
1. [First step]
2. [Second step]
3. [Third step]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots
[Attach screenshots if applicable]

### Additional Context
[Any other relevant information]
```

## Quick Fixes

### Common Issues

**Issue**: Zoom on input focus
```css
/* Fix: Ensure 16px font */
input { font-size: 16px !important; }
```

**Issue**: Content under notch
```css
/* Fix: Add safe area padding */
padding-top: env(safe-area-inset-top);
```

**Issue**: Bottom nav covers content
```css
/* Fix: Add bottom padding to view */
.view { padding-bottom: calc(var(--bottomnav-h) + 20px); }
```

**Issue**: Horizontal scroll on mobile
```css
/* Fix: Constrain width */
body { overflow-x: hidden; }
* { max-width: 100%; }
```

## Success Criteria

✅ App is fully functional on all tested devices
✅ No critical bugs or layout issues
✅ Touch interactions feel natural
✅ Performance meets targets (95+ Lighthouse)
✅ Accessibility requirements met (WCAG AAA)
✅ PWA installs and works offline
✅ Users say it "feels like a native app"

## Final Checklist

Before declaring mobile optimization complete:

- [ ] All features tested on at least 3 different devices
- [ ] No critical bugs remaining
- [ ] Performance targets met
- [ ] Accessibility audit passed
- [ ] PWA features working
- [ ] Documentation complete
- [ ] Team approval received
- [ ] Ready for production deployment

---

**Need Help?**
- Check MOBILE_IMPROVEMENTS.md for implementation details
- Review browser console for errors
- Test on actual devices (not just emulators)
- Clear cache and hard reload (Cmd+Shift+R)
