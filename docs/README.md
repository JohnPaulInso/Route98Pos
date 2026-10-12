# Route 98 — Route98 POS System (POS · Inventory · Gasoline)

A single, offline-first web app for your minimart counter, gas pumps, and back office. Royal-blue, Montserrat-based design, icon-driven UI (no emojis, no native browser dropdowns/alerts), pure HTML/CSS/JS — no build step, no framework, no server required to run it.

## 1. Running it

**Fastest way:** double-click `index.html`. It works, but for barcode-scanner input and the "Add to Home Screen" install prompt to behave correctly, it's better to serve it over a local server:

```bash
cd minimart-pos
python3 -m http.server 8080
# then open http://localhost:8080 on your phone/tablet/PC (same Wi-Fi)
```

Or use the free "Live Server" extension in VS Code, or upload the folder to any static host (Netlify, Vercel, GitHub Pages, Firebase Hosting) for a permanent URL you can open from any device.

## 2. Logging in

- **Cashier PIN:** `1111`
- **Admin PIN:** `1234`

Change both any time under **Settings → Staff** (Admin only). Cashiers can use POS, Gasoline, Inventory, and Reports (without the Overview analytics — see below). Only Admin sees Dashboard, Reports → Overview, and Settings. The app remembers whichever tab you were last on, so a reload (or reopening the app) drops you back where you left off instead of the login/onboarding screen — as long as your session is still active.

## 3. Starting inventory: blank slate + CSV import

The app ships with **zero demo products** — just import your real catalog. The Inventory → **Import** button auto-detects two formats:

- **A raw Loyverse "Items" export**, mapped automatically: Name, Category, Cost, and the store's Price/In-stock/Low-stock columns are read directly; the **SKU column is ignored** per your instructions, and **Barcode (column N)** is stripped down to digits only and stored as a clean numeric barcode. If your export also has an **IMAGE LINK** column, it's imported straight into each product's photo — no manual work needed. Items with "Track stock" off in Loyverse (no in-stock count) are imported as always-in-stock; a toast tells you how many. Rows matched by an existing barcode are updated in place instead of duplicated; if a row has no usable barcode, it's matched by name + category instead so re-imports (like adding photos later) merge into your existing catalog rather than duplicating it.

> ⚠️ **A note on barcodes and Excel/Google Sheets:** if you open a Loyverse export in Excel or Sheets and save it again before importing, long barcodes get silently mangled into scientific notation (e.g. `748485200019` becomes `7.48E+11`) — and that's *real* data loss; the original digits are gone from the file, not just hidden. The import detects this and, rather than guess a wrong number that could ring up the wrong item at checkout, leaves that product's barcode blank and matches it by name instead, then warns you with a count. To avoid it entirely, import Loyverse's export directly without opening it in a spreadsheet app first, or format column N as **Text** before saving if you need to edit it.
- **This app's own exported CSV** (see below) — a normal round-trip import.

Product photos aren't part of either format — add them later per-product in Inventory (see "Product images" below).

## 4. What's inside

| Tab | What it does |
|---|---|
| **POS** | Search or scan products into a cart, adjust qty, apply a discount as **either a percentage or a fixed ₱ amount** (toggle right next to the discount field), checkout by Cash/Card/GCash/Other, print an 80mm-style receipt, hold/recall parked sales, or use **Scan Mode** to keep the camera open and auto-add every item you scan straight into the cart. |
| **Gasoline** | Separate ledger from the store. Pick a pump, enter liters or a peso amount (auto-converts), track tank levels per fuel type, log fuel deliveries, and **edit prices any time** — every past sale keeps the price it was actually charged at, so daily price changes never distort your history. A "Today" strip shows the day's fuel volume and transaction count at a glance. |
| **Inventory** | Searchable/sortable product table with brand and manufacturer/distributor fields, a real photo per product (paste any image URL), low-stock highlighting, stock adjustments with a reason log, category manager, and the CSV/JSON import described above. |
| **Dashboard** | A profit & loss summary (net revenue, COGS, gross profit, shrinkage/loss, net profit, margin %) plus odometer-style stat cards and five Chart.js graphs. |
| **Reports** | Full sales/fuel history with reprint and a Today-only toggle, X/Z shift reports — **plus, for Admin, an Overview sub-tab**: a deeper, clickable analytics dashboard (see below). |
| **Venue Booking** | "Coming Soon" page for The Good Venue, with an email waitlist that saves locally. |
| **Settings** | Business info, VAT on/off + rate (changeable any time), staff PINs, pump configuration, dark mode, full backup/restore, Firestore sync. |

## 5. Reports → Overview — the detailed, clickable analytics dashboard

This is the deep-dive view, separate from the Dashboard tab, built for actually digging into performance (Admin only):

- **P&L stat cards**: Net Revenue, COGS, Gross Profit, Net Profit, Margin %, Transaction count — for whatever date range you pick (7/14/30/90 days).
- **Revenue Trend chart — clickable.** Click any point on the line and a modal opens showing every store and fuel transaction from that exact day.
- **Revenue vs Profit by Category chart — clickable.** Click a bar and the Top Sellers table below instantly filters to that category (with a chip to clear the filter).
- **Top Selling Items table**, ranked by revenue, showing units sold, revenue, profit, and margin % per product — click any row to drill into every individual sale of that item in the period.

## 6. Product images — how they work

Rather than hotlinking random photos from the internet (a real copyright risk for branded packaging, plus links break and it wouldn't be *your* actual product), every product has a proper **Image URL** field. Paste in any real photo — a picture you took, one from your supplier's site, anything — and it displays immediately in the POS grid, inventory table, and cart. If the link is ever broken, or you're offline, it gracefully falls back to a clean icon tile for that product's category instead of a broken-image icon. No product photo required to get started; the icon tiles look good on their own.

## 7. Barcode / QR scanning

- **External USB/Bluetooth scanner:** works out of the box — just plug it in (or pair it) and scan. The scanner types like a fast keyboard, so the app auto-detects the burst of characters + Enter and adds the item automatically, from almost anywhere in the app.
- **Scan Mode (POS):** tap **Scan Mode** to open the camera full-screen — it stays open and keeps scanning continuously. Every new barcode it sees gets added straight to the cart automatically (with a short cooldown per code so holding one item in frame doesn't add it 20 times — rescan deliberately to add more of the same item). A running "scanned" counter and a live list of the last few items scanned sit at the bottom of the camera view. Tap the ✕ to close it and review your full cart for checkout.
- **Single-shot camera scan (Inventory):** tap the camera icon next to the barcode field to scan once and fill that field.
- Camera scanning uses your browser's built-in scanner — no extra app needed. It currently works best in Chrome/Edge on Android and desktop; Safari/iOS support depends on OS version.

## 8. Saving your data — how it works

Everything you do (a sale, a stock edit, a settings change) is saved **immediately to your device** (localStorage) — this is the source of truth and works with zero internet connection.

If you want your data to also back up to the cloud and sync across multiple devices (e.g. a tablet at the counter + your phone for checking the dashboard), set up Firestore sync:

1. Create a free Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore Database** (start in production mode, then open the Rules tab and set rules appropriate for your use — see note below).
3. In your Firebase project settings, copy your **Web app config** (the `{ apiKey: ..., projectId: ..., ... }` object).
4. In the app: **Settings → Data & Sync**, paste that JSON into "Firebase config", save, then hit **Sync Now**.
5. Turn on **Auto-sync** if you want every change to push automatically (it batches changes every few seconds so it doesn't spam Firestore).

> ⚠️ **Security note:** this app talks to Firestore directly from the browser with no login layer of its own beyond the on-device PIN. For a single-device setup this is fine. If you connect multiple devices, set Firestore security rules that at minimum restrict access to your project (e.g. require Firebase Auth, or IP-restrict, or keep the config private) — don't leave Firestore in fully public test mode long-term.

## 9. Import / Export

- **Settings → Data & Sync → Full Backup (.json):** everything — products, sales, fuel logs, settings, staff. Use this for your real backup routine.
- **Inventory → Export/Import:** the product list as CSV (name, brand, distributor, barcode, category, cost, price, stock, unit, low-stock threshold, image URL). **This always exports your full current catalog** — so if you import your Loyverse data and then add more products by hand in the app, exporting later includes everything, verified with an automated round-trip test.

## 10. Works offline / installable

The app registers a service worker that caches itself, so once you've opened it once, it keeps working with no signal — perfect for spotty internet at the counter or pumps. On a phone or tablet, use your browser's **"Add to Home Screen" / "Install App"** option to get it as a full-screen app icon. (Custom product photos need a connection to load the first time; the app itself and all transactions work fully offline either way.)

## 11. Design notes

- **Typography:** Montserrat throughout the interface; a monospace face (IBM Plex Mono) is used only for the digit-style "odometer" displays and printed receipts, where fixed-width digits genuinely matter for alignment.
- **Color:** a royal-blue brand identity (`#2F42D8`) for navigation, buttons, and the primary accents, with an independent amber/rust/green trio reserved specifically for telling Gasoline/Diesel/Premium apart at a glance, and standard green/amber/red used semantically for success/warning/danger states. Glass-blurred topbar/sidebar, soft colored shadows, and hover-lift on cards for a more modern layered feel.
- **No native browser UI:** every dropdown, alert, and confirmation in the app is a custom-built component (see `js/uiselect.js` and `js/modal.js`) styled to match the rest of the interface, rather than the browser's default `<select>`/`alert()`/`confirm()` look.
- **Icons, not emojis:** every icon in the app is a hand-drawn inline SVG (`js/icons.js`) — no emoji characters, and no external icon-font CDN dependency, so the whole thing keeps working offline.

## 12. Structure

```
minimart-pos/
  index.html
  manifest.json         (PWA install config)
  sw.js                 (offline cache)
  icon.svg
  css/
    tokens.css           (design tokens — royal-blue palette, Montserrat, spacing)
    base.css              (shell, buttons, forms, custom dropdowns, tables, modals, toasts)
    views.css              (POS/Gasoline/Inventory/Dashboard/Venue/print layouts + responsive rules)
  js/
    icons.js        — self-contained SVG icon set
    uiselect.js       — custom dropdown component (replaces native <select>)
    utils.js           — formatting, toasts, CSV, odometer digits, product-thumbnail rendering
    db.js                — localStorage data layer (source of truth, blank-slate products)
    modal.js               — reusable dialog system (scroll-locked, animated, Escape-to-close)
    auth.js                  — PIN login, roles
    sync.js                    — Firestore snapshot push/pull
    barcode.js                   — external scanner + single-shot & continuous camera scan
    importExport.js                — CSV/JSON import/export, Loyverse-format auto-detection
    analytics.js                     — shared revenue/COGS/profit calculations
    pos.js                              — point of sale, % or ₱ discounts
    gasoline.js                           — fuel station, price history, today's totals
    inventory.js                            — product/category/brand/distributor management
    dashboard.js                              — stats, profit & loss, charts
    venue.js                                    — venue booking teaser
    reports.js                                    — history, Today filter, X/Z reports, clickable Overview
    settings.js                                     — admin config
    app.js                                            — shell, routing, boot, last-tab memory
```

Everything is vanilla JS (no bundler) so you can open any file and edit it directly — e.g. change the brand color in `css/tokens.css`, add more icons in `js/icons.js`, or add a new fuel type in Settings → Fuel Pumps.

