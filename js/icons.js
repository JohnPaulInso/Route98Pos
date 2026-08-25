// ============================================================
// icons.js — self-contained line-icon set (no emojis, no CDN).
// Every icon is hand-drawn as a 24x24 stroke SVG so the app
// stays fully offline-capable and visually consistent.
// ============================================================
const Icons = (() => {
  const PATHS = {
    cart: `<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.4l2.2 11.6a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6.2"/>`,
    fuel: `<path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M3 21h12"/><path d="M14 9h2.2l2.6 2.6V17a1.5 1.5 0 0 1-3 0v-1"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M6 5.5h5"/>`,
    package: `<path d="M21 8.5 12 4 3 8.5 12 13l9-4.5Z"/><path d="M3 8.5V17l9 4.5 9-4.5V8.5"/><path d="M12 13v8.5"/>`,
    "bar-chart": `<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/><path d="M2 20h20"/>`,
    clipboard: `<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.3" width="6" height="3.4" rx="1"/><path d="M8.5 11h7"/><path d="M8.5 15h7"/><path d="M8.5 19h4"/>`,
    party: `<path d="M4 21 8.5 9.7c.3-.8 1.3-1 1.9-.4l4.2 4.2c.6.6.4 1.6-.4 1.9L4 21Z"/><path d="M14 6.5 17.5 3"/><path d="M18 9.5 21 8"/><path d="M11 3.5 12.5 6"/><circle cx="19" cy="5" r=".9"/>`,
    settings: `<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>`,
    search: `<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    // (2026-07-13) Add plus-circle icon path; was not present
    "plus-circle": `<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>`,
    minus: `<path d="M5 12h14"/>`,
    x: `<path d="M18 6 6 18M6 6l12 12"/>`,
    "x-circle": `<circle cx="12" cy="12" r="9"/><path d="m14.5 9.5-5 5M9.5 9.5l5 5"/>`,
    edit: `<path d="M4 20.5h4l11-11a2.1 2.1 0 0 0-4-4l-11 11v4Z"/><path d="M13 6.5 17.5 11"/>`,
    trash: `<path d="M4 7h16"/><path d="M9 7V4.6c0-.6.4-1 1-1h4c.6 0 1 .4 1 1V7"/><path d="M6.5 7 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10.3 11v6M13.7 11v6"/>`,
    camera: `<path d="M4 8.5A1.6 1.6 0 0 1 5.6 7h2.1l1-1.7c.2-.4.6-.6 1-.6h4.6c.4 0 .8.2 1 .6l1 1.7h2.1A1.6 1.6 0 0 1 20 8.5v9.9a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V8.5Z"/><circle cx="12" cy="13" r="3.4"/>`,
    scan: `<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>`,
    check: `<path d="m5 13 4.5 4.5L19 8"/>`,
    "check-circle": `<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9"/>`,
    "alert-triangle": `<path d="M10.6 4.3a1.6 1.6 0 0 1 2.8 0l8 14.2a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4l8-14.2Z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>`,
    cloud: `<path d="M7 18.5a4.3 4.3 0 0 1-.5-8.6 5.5 5.5 0 0 1 10.7-1.7A4 4 0 0 1 17 18.5H7Z"/>`,
    "cloud-check": `<path d="M7 17.5a4.3 4.3 0 0 1-.5-8.6 5.5 5.5 0 0 1 10.7-1.7A4 4 0 0 1 17 17.5H7Z"/><path d="m9.5 13.2 1.8 1.8 3.2-3.4"/>`,
    lock: `<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>`,
    key: `<circle cx="7.5" cy="15.5" r="3.7"/><path d="m10.7 12.7 8.8-8.8"/><path d="M16.5 6.5 19 9"/><path d="M14 9l2 2"/>`,
    receipt: `<path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6V3Z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5"/>`,
    printer: `<path d="M6.5 8.5V4h11v4.5"/><rect x="4" y="8.5" width="16" height="7.5" rx="1.5"/><path d="M6.5 14.5h11V20h-11v-5.5Z"/>`,
    truck: `<rect x="2.5" y="7" width="11.5" height="9.5" rx="1"/><path d="M14 10.5h3.5L20 13v3.5h-6V10.5Z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/>`,
    droplet: `<path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0c0-4.2 6-10.6 6-10.6Z"/>`,
    tag: `<path d="M3.5 11.5 12 3h6a2.5 2.5 0 0 1 2.5 2.5v6L12 20.5a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1Z"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/>`,
    user: `<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>`,
    users: `<circle cx="9" cy="8" r="3.2"/><path d="M2.7 20a6.3 6.3 0 0 1 12.6 0"/><path d="M15.3 5.5a3.2 3.2 0 0 1 0 6.2"/><path d="M17.5 14.2a6.3 6.3 0 0 1 3.8 5.8"/>`,
    "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
    "chevron-left": `<path d="m15 18-6-6 6-6"/>`,
    calendar: `<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>`,
    "trending-up": `<path d="m3 16.5 6.5-6.5 4 4L21 6"/><path d="M15.5 6H21v5.5"/>`,
    "trending-down": `<path d="m3 7.5 6.5 6.5 4-4L21 18"/><path d="M15.5 18H21v-5.5"/>`,
    percent: `<path d="m5 19 14-14"/><circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/>`,
    moon: `<path d="M20.5 14.8A8.5 8.5 0 1 1 9.2 3.5a7 7 0 0 0 11.3 11.3Z"/>`,
    "log-out": `<path d="M9 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/><path d="M16 16.5 21 12l-5-4.5"/><path d="M21 12H9"/>`,
    upload: `<path d="M12 16.5V4.5"/><path d="m6.5 9.5 5.5-5 5.5 5"/><path d="M4.5 16.5v2a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-2"/>`,
    download: `<path d="M12 4.5v12"/><path d="m6.5 11.5 5.5 5 5.5-5"/><path d="M4.5 19.5h15"/>`,
    store: `<path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2.4 2.4 0 0 0 4.6 1.1A2.4 2.4 0 0 0 13 9.5a2.4 2.4 0 0 0 4.4 1.1A2.4 2.4 0 0 0 20 9.5"/><path d="M5 11v9.5h14V11"/><path d="M9.5 20.5V15h5v5.5"/>`,
    filter: `<path d="M3.5 5h17L14 13v5.5l-4 2V13L3.5 5Z"/>`,
    "pause-circle": `<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>`,
    "refresh-cw": `<path d="M20 11a8 8 0 0 0-14.6-4.4M4 13a8 8 0 0 0 14.6 4.4"/><path d="M20 4v5h-5"/><path d="M4 20v-5h5"/>`,
    image: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m6 17 4.2-4.5a1.5 1.5 0 0 1 2.2 0L15 15.3l1.4-1.5a1.5 1.5 0 0 1 2.2 0L20.5 16"/>`,
    building: `<rect x="4" y="3.5" width="10" height="17" rx="1"/><path d="M14 9.5h6v11h-6"/><path d="M7 7h1.2M10.8 7H12M7 10.5h1.2M10.8 10.5H12M7 14h1.2M10.8 14H12M17 12.5h1.2M17 16h1.2"/>`,
    "sun": `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>`,
    box: `<path d="M21 8.5 12 4 3 8.5 12 13l9-4.5Z"/><path d="M3 8.5V17l9 4.5 9-4.5V8.5"/><path d="M12 13v8.5"/>`,
    home: `<path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-6h4v6"/>`,
    wallet: `<rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><circle cx="17.5" cy="14" r="1.1" fill="currentColor" stroke="none"/>`,
    "credit-card": `<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 15h4"/>`,
    smartphone: `<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M11 18.5h2"/>`,
    "more-horizontal": `<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>`,
    zap: `<path d="M12.5 3 5 13.5h5.5L11 21l7.5-10.5H13L12.5 3Z"/>`,
    "shield-check": `<path d="M12 3.5 19 6.3v5.4c0 5-3 8.4-7 9.8-4-1.4-7-4.8-7-9.8V6.3L12 3.5Z"/><path d="m9.2 12.2 1.9 1.9 3.7-4"/>`,
    // (2026-07-13) Add redo SVG path; was undo only
    undo: `<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>`,
    redo: `<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>`,
    // (2026-07-13) Add utensils SVG path for restaurant booking; was not present
    utensils: `<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 11v11"/><path d="M6 2v20"/><path d="M9 2v4a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/>`,
    // (2026-07-13) Add dollar-sign SVG path for expenses; was not present
    "dollar-sign": `<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`
  };

  function get(name, opts = {}){
    const size = opts.size || 18;
    const cls = opts.cls ? ` ${opts.cls}` : "";
    const stroke = opts.strokeWidth || 2;
    const body = PATHS[name] || PATHS.package;
    return `<svg class="ic-svg${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  return { get, names: Object.keys(PATHS) };
})();
