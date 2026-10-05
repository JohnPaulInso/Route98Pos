// ============================================================
// app.js — bootstraps the app: routing, shell, nav
// ============================================================
// (2026-07-13) Group sidebar by 4 businesses & overview; was single list
const App = (() => {
  // (2026-07-13) Hide inactive pages & dashboard on desktop/mobile; was visible
  const NAV_SECTIONS = [
    {
      group: "OVERVIEW",
      views: [
        { id:"shift", label:"Shift", ic:"clock", mod:Shift, roles:["admin","cashier"], color:"#0284C7" }
      ]
    },
    // (2026-07-13) Core retail business units; separated venue and restaurant
    {
      group: "BUSINESS UNITS",
      views: [
        { id:"pos", label:"Minimart Store", ic:"store", mod:POS, roles:["admin","cashier"], color:"#2563EB" },
        { id:"gasoline", label:"Gasoline Station", ic:"fuel", mod:Gas, roles:["admin","cashier"], color:"#D97706" }
      ]
    },
    {
      group: "OPERATIONS",
      views: [
        // (2026-07-13) Sort operations: Reports, Inventory, Expenses (OPEX); was unsorted
        { id:"reports", label:"Reports", ic:"clipboard", mod:Reports, roles:["admin","cashier"], color:"#4B5563" },
        // (2026-07-13) Restrict inventory view to admin; was admin,cashier
        { id:"inventory", label:"Inventory", ic:"package", mod:Inventory, roles:["admin"], color:"#4B5563" },
        { id:"expenses", label:"Expenses (OPEX)", ic:"dollar-sign", mod:Expenses, roles:["admin"], color:"#DC2626" }
      ]
    },
    {
      group: "SYSTEM",
      views: [
        { id:"settings", label:"Settings", ic:"gear", mod:Settings, roles:["admin"], color:"#4B5563" }
      ]
    }
  ];
  // (2026-07-13) Restore VIEWS definition from NAV_SECTIONS; was missing
  const VIEWS = NAV_SECTIONS.flatMap(s => s.views);
  // (2026-07-13) Add inventory to bottom nav; was pos/shift/reports/dash/gas only
  const BOTTOM_NAV_IDS = ["pos","inventory","shift","reports","gasoline"];
  let currentView = "pos";

  function accessibleViews(){
    const role = Auth.currentUser()?.role || "cashier";
    return VIEWS.filter(v => v.roles.includes(role));
  }

  function lowStockCount(){
    return DB.getProducts().filter(p => p.stock <= p.lowStockThreshold).length;
  }

  // (2026-07-13) Auto-clear module search filters on navigation; was persistent
  function navigate(id){
    const view = VIEWS.find(v => v.id === id);
    if(!view) return;
    if(!view.roles.includes(Auth.currentUser()?.role)){ Utils.toast("You don't have access to this section.", "warn"); return; }
    currentView = id;
    const s = DB.getSettings();
    if(s.lastView !== id){ s.lastView = id; DB.setSettings(s); }
    Scanner.clearContext();
    POS.resetSearch?.();
    Inventory.resetSearch?.();
    if(id !== "reports"){ document.getElementById("back-to-top-btn")?.remove(); }
    paintNav();
    view.mod.render();
  }

  // (2026-07-13) Prevent random sync reload on reports; was full rerender
  function rerenderCurrentView(){
    if(currentView === "reports") return;
    const active = document.activeElement;
    if(active && ["INPUT","TEXTAREA","SELECT"].includes(active.tagName)){
      if(active.id === "pos-search" && currentView === "pos"){
        POS.renderCatalog?.();
      }
      return;
    }
    if(currentView === "pos" && document.getElementById("product-grid")){
      POS.renderCatalog?.();
      return;
    }
    const winY = window.scrollY || document.documentElement.scrollTop;
    const vb = document.querySelector(".view-body");
    const vbScroll = vb ? vb.scrollTop : 0;
    const view = VIEWS.find(v => v.id === currentView);
    view?.mod.render();
    if(winY > 0) window.scrollTo(0, winY);
    if(vbScroll > 0){
      const newVb = document.querySelector(".view-body");
      if(newVb) newVb.scrollTop = vbScroll;
    }
  }

  function paintNav(){
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === currentView));
    document.querySelectorAll(".bn-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === currentView));
    const dot = document.getElementById("inv-badge-dot");
    const count = lowStockCount();
    if(dot){ dot.textContent = count; dot.style.display = count > 0 ? "inline-flex" : "none"; }
    const dotB = document.getElementById("inv-badge-dot-bn");
    if(dotB){ dotB.style.display = count > 0 ? "block" : "none"; }
    document.getElementById("topbar-title-view") && (document.getElementById("topbar-title-view").textContent = VIEWS.find(v=>v.id===currentView)?.label || "");
    paintShiftIndicator();
  }

  // (2026-07-13) Responsive shift badge with extra text wrap; was static span
  function paintShiftIndicator(){
    const el = document.getElementById("topbar-shift-indicator");
    if(!el) return;
    const s = DB.getShift ? DB.getShift() : null;
    const isOpen = Boolean(s && s.status === "open");
    if(isOpen){
      el.className = "topbar-shift-badge shift-open";
      el.innerHTML = `<span class="shift-dot green"></span><span>Open<span class="shift-text-extra"> Shift</span></span>`;
      el.title = `Shift is Open (${s.cashier || "Cashier"}) — Click to manage`;
    } else {
      el.className = "topbar-shift-badge shift-closed";
      el.innerHTML = `<span class="shift-dot red"></span><span>Closed<span class="shift-text-extra"> Shift</span></span>`;
      el.title = "Shift is Closed — Click to open shift";
    }
  }

  function paintTopbar(){
    const s = DB.getSettings();
    const title = document.getElementById("topbar-title");
    if(title) title.textContent = s.businessName;
    const user = Auth.currentUser();
    const chip = document.getElementById("user-chip-label");
    if(chip) chip.textContent = user?.name || "";
    const av = document.getElementById("user-chip-av");
    if(av) av.textContent = (user?.name||"?").slice(0,1).toUpperCase();
    paintShiftIndicator();
  }

  // (2026-07-13) Real-time clock updating every 1s; was static/30s interval
  function tickClock(){
    const now = new Date();
    const str = now.toLocaleString("en-PH", { weekday:"short", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
    const el = document.getElementById("topbar-clock");
    if(el) el.textContent = str;
    const posSub = document.getElementById("pos-view-sub");
    if(posSub){
      const user = Auth.currentUser();
      posSub.textContent = `${user?.name || "Cashier"} · ${now.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}, ${now.toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`;
    }
  }

  // (2026-07-13) Full mobile navigation modal grid; was inaccessible modules
  function openMobileNav(){
    const role = Auth.currentUser()?.role || "cashier";
    const body = `
      <div class="mobile-nav-sheet">
        ${NAV_SECTIONS.map(sec => {
          const visible = sec.views.filter(v => v.roles.includes(role));
          if(!visible.length) return "";
          return `
            <div style="margin-bottom:14px;">
              <div style="font-size:.68rem;font-weight:800;letter-spacing:.06em;color:var(--ink-faint);text-transform:uppercase;margin-bottom:6px;">${sec.group}</div>
              <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;">
                ${visible.map(v => `
                  <button class="mobile-nav-tile ${v.id===currentView?'active':''}" data-mob-nav="${v.id}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;border:1.5px solid ${v.id===currentView?'var(--brand)':'var(--line)'};background:${v.id===currentView?'var(--brand-tint)':'var(--paper-raised)'};color:${v.id===currentView?'var(--brand-deep)':'var(--ink)'};cursor:pointer;font-family:var(--font-body);text-align:left;">
                    <span style="color:${v.color||'inherit'};display:flex;align-items:center;">${Icons.get(v.ic,{size:20})}</span>
                    <div style="min-width:0;flex:1;">
                      <div style="font-weight:700;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.label}</div>
                      ${v.id==="inventory"?`<span class="badge badge-rust text-xs" style="font-size:.60rem;padding:1px 4px;margin-top:2px;">${lowStockCount()} low stock</span>`:""}
                    </div>
                  </button>
                `).join("")}
              </div>
            </div>`;
        }).join("")}
      </div>`;
    const m = Modal.open({
      title: `${Icons.get("grid",{size:18})} All Modules & Navigation`,
      body,
      actions: [{ label:"Close", cls:"btn-ghost" }]
    });
    m.querySelectorAll("[data-mob-nav]").forEach(btn => {
      btn.onclick = () => {
        Modal.close();
        navigate(btn.dataset.mobNav);
      };
    });
  }

  // (2026-07-13) Define views in shell for bottom nav; was missing views var
  function shell(){
    const role = Auth.currentUser()?.role || "cashier";
    const views = accessibleViews();
    const root = document.getElementById("root");
    root.innerHTML = `
      <div id="app">
        <nav class="sidebar" style="overflow-y:auto;">
          <!-- (2026-07-13) Fix brand logo markup without stray text. Prev: broken onerror -->
          <div class="brand">
            <div class="brand-mark"><img src="route98_logo.png?v=6" alt="Route 98" onerror="this.onerror=null;this.src='icon.png';"></div>
            <div class="brand-text"><strong id="topbar-title">Route 98</strong><span>Route98 POS System</span></div>
          </div>
          ${NAV_SECTIONS.map(sec => {
            const visible = sec.views.filter(v => v.roles.includes(role));
            if(!visible.length) return "";
            return `
              <div class="nav-group" style="margin-bottom:12px;">
                <div class="nav-label" style="font-size:.66rem;font-weight:800;letter-spacing:.08em;color:#94A3B8;text-transform:uppercase;padding:4px 14px 6px;">${sec.group}</div>
                ${visible.map(v => `
                  <button class="nav-btn" data-nav="${v.id}" style="display:flex;align-items:center;gap:10px;">
                    <span class="ic" style="color:${v.color||'inherit'};display:flex;align-items:center;">${Icons.get(v.ic,{size:17})}</span>
                    <span>${v.label}</span>
                    ${v.id==="inventory"?`<span class="badge-dot" id="inv-badge-dot" style="display:none;">0</span>`:""}
                  </button>
                `).join("")}
              </div>
            `;
          }).join("")}
          <div class="sidebar-foot">
            <div class="sync-pill" id="sync-pill"><span class="sync-dot"></span><span class="lbl">Local only</span></div>
          </div>
        </nav>

        <div class="main-col">
          <header class="topbar">
            <!-- (2026-07-13) Add mobile menu button in topbar; was desktop title only -->
            <button class="icon-btn mobile-menu-btn" id="btn-topbar-menu" title="Navigation Menu" style="display:none;margin-right:6px;flex-shrink:0;">${Icons.get("menu",{size:18})}</button>
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <h1 id="topbar-title-view">${VIEWS.find(v=>v.id===currentView)?.label || ""}</h1>
              <!-- (2026-07-13) Topbar shift status indicator badge; was missing -->
              <button type="button" id="topbar-shift-indicator" class="topbar-shift-badge" title="Shift status"></button>
            </div>
            <span class="topbar-spacer"></span>
            <span class="topbar-clock" id="topbar-clock"></span>
            <button class="icon-btn" id="theme-toggle-btn" title="Toggle theme"></button>
            <div class="user-chip" id="user-chip">
              <span class="av" id="user-chip-av"></span>
              <span id="user-chip-label"></span>
            </div>
          </header>
          <main class="view" id="view-root"></main>
        </div>
      </div>

      <nav class="bottom-nav">
        <!-- (2026-07-13) Render 6 bottom nav items; was 5 tabs with more -->
        <div class="bottom-nav-inner">
          ${BOTTOM_NAV_IDS.map(id => {
            const v = views.find(item => item.id === id);
            if(!v) return "";
            const lbl = v.id === "dashboard" ? "Dashboard" : (v.id === "gasoline" ? "Gasoline" : (v.id === "pos" ? "Minimart" : v.label.split(" ")[0]));
            return `
            <button class="bn-btn" data-nav="${v.id}" title="${v.label}">
              <!-- (2026-07-13) Nav icons gray when inactive; was colored -->
              <span class="ic" style="position:relative;">${Icons.get(v.ic,{size:20})}${v.id==="inventory"?`<span id="inv-badge-dot-bn" style="display:none;position:absolute;top:-2px;right:-2px;width:6px;height:6px;border-radius:50%;background:var(--danger);"></span>`:""}</span>
              <span>${lbl}</span>
            </button>`;
          }).join("")}
        </div>
      </nav>

      <div id="toast-stack"></div>`;

    document.querySelectorAll(".nav-btn, .bn-btn[data-nav]").forEach(b => b.onclick = () => navigate(b.dataset.nav));
    document.getElementById("btn-topbar-menu")?.addEventListener("click", openMobileNav);
    document.getElementById("btn-bn-more")?.addEventListener("click", openMobileNav);
    // (2026-07-13) Click shift indicator to open shift management; was no handler
    document.getElementById("topbar-shift-indicator")?.addEventListener("click", () => navigate("shift"));
    document.getElementById("user-chip").onclick = () => {
      Modal.confirm({ title:"Log out?", message:`Sign out ${Auth.currentUser()?.name}?`, onConfirm: () => Auth.logout() });
    };
    const themeBtn = document.getElementById("theme-toggle-btn");
    const paintThemeIcon = () => { themeBtn.innerHTML = Icons.get(document.documentElement.dataset.theme === "dark" ? "sun" : "moon", { size:16 }); };
    themeBtn.onclick = () => {
      const s = DB.getSettings();
      s.theme = s.theme === "dark" ? "light" : "dark";
      DB.setSettings(s);
      document.documentElement.dataset.theme = s.theme;
      paintThemeIcon();
    };
    paintThemeIcon();

    paintTopbar();
    tickClock();
    setInterval(tickClock, 1000);
    Sync.paintStatus();
  }

  function boot(){
    document.documentElement.dataset.theme = DB.getSettings().theme || "light";
    shell();
    const views = accessibleViews();
    const isMobile = (typeof MobileUtils !== "undefined" && MobileUtils.isMobile()) || window.innerWidth <= 768 || Boolean(window.Capacitor?.isNativePlatform?.());
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const isShiftTime = (h === 7) || (h === 8 && m <= 30);
    // (2026-07-13) Set shift 7-8:30am else minimart pos on mobile; was remembered
    if(isMobile){
      currentView = (isShiftTime && views.find(v => v.id === "shift")) ? "shift" : (views.find(v => v.id === "pos")?.id || "pos");
    } else {
      const remembered = DB.getSettings().lastView;
      if(remembered && !["dashboard","venue","restaurant"].includes(remembered) && views.find(v => v.id === remembered)) currentView = remembered;
      else currentView = views.find(v => v.id === "pos")?.id || views[0]?.id || "pos";
    }
    navigate(currentView);
  }

  // (2026-07-13) Init app without pull-to-refresh listeners; was initPullToRefresh
  function init(){
    DB.init();
    Auth.restoreSession();
    Sync.init();
    Scanner.init();
    if(Auth.currentUser()) boot();
    else Auth.render();
  }

  return { init, boot, navigate, rerenderCurrentView, paintTopbar, getCurrentView: () => currentView };
})();

// (2026-07-13) Horizontal mouse wheel scroll for category-chips; was default vertical
document.addEventListener("wheel", (e) => {
  const chips = e.target.closest(".category-chips");
  if(chips && e.deltaY !== 0){
    e.preventDefault();
    e.stopPropagation();
    chips.scrollLeft += e.deltaY;
  }
}, { passive: false, capture: true });

// ✅ Desktop-only drag-to-scroll for category-chips (skip on mobile/APK)
(function initCategoryChipsDragScroll(){
  // ✅ Check if mobile/Capacitor - skip drag-scroll entirely on mobile
  const isMobileContext = () =>
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    window.matchMedia("(max-width: 768px)").matches ||
    /Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobileContext()) {
    console.log("✅ Mobile/Capacitor detected - skipping drag-scroll listeners");
    // Still setup gradient fade without drag handlers
    function updateGradientFade(chips){
      if(!chips) return;
      const isAtEnd = chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 5;
      chips.classList.toggle("scrolled-end", isAtEnd);
    }

    const sharedResizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(entries => {
      for(const entry of entries) updateGradientFade(entry.target);
    }) : null;

    const observer = new MutationObserver(() => {
      document.querySelectorAll(".category-chips, .rpt-subnav-tabs").forEach(chips => {
        if(chips.dataset.dragScrollInit) return;
        chips.dataset.dragScrollInit = "true";
        updateGradientFade(chips);
        chips.addEventListener("scroll", () => updateGradientFade(chips), { passive: true });
        sharedResizeObserver?.observe(chips);
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    document.querySelectorAll(".category-chips, .rpt-subnav-tabs").forEach(chips => {
      updateGradientFade(chips);
      chips.addEventListener("scroll", () => updateGradientFade(chips), { passive: true });
    });
    return; // ✅ EXIT - no drag handlers
  }

  // ✅ Desktop only: full drag-scroll implementation
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;
  let targetChips = null;
  let hasDragged = false;

  document.addEventListener("mousedown", (e) => {
    hasDragged = false;
    if(e.button !== 0) return;
    const chips = e.target.closest(".category-chips");
    if(!chips) return;

    isDragging = true;
    targetChips = chips;
    startX = e.pageX - chips.offsetLeft;
    scrollLeft = chips.scrollLeft;
    chips.style.scrollBehavior = "auto";
  });

  document.addEventListener("mousemove", (e) => {
    if(!isDragging || !targetChips) return;
    e.preventDefault();
    const x = e.pageX - targetChips.offsetLeft;
    const walk = (x - startX) * 1.5;

    if(Math.abs(walk) > 5){
      hasDragged = true;
    }

    targetChips.scrollLeft = scrollLeft - walk;
  });

  document.addEventListener("mouseup", (e) => {
    if(isDragging && targetChips){
      targetChips.style.scrollBehavior = "";
      if(hasDragged){
        e.preventDefault();
        e.stopPropagation();
      }
    }
    isDragging = false;
    targetChips = null;
    hasDragged = false;
  }, true);

  document.addEventListener("click", (e) => {
    if(hasDragged && e.target.closest(".category-chips .chip")){
      e.preventDefault();
      e.stopPropagation();
      hasDragged = false;
      return false;
    }
  }, true);

  document.addEventListener("mouseleave", () => {
    if(isDragging && targetChips){
      targetChips.style.scrollBehavior = "";
    }
    isDragging = false;
    targetChips = null;
    hasDragged = false;
  });

  // Update gradient fade visibility on scroll
  function updateGradientFade(chips){
    if(!chips) return;
    const isAtEnd = chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 5;
    chips.classList.toggle("scrolled-end", isAtEnd);
  }

  const sharedResizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(entries => {
    for(const entry of entries) updateGradientFade(entry.target);
  }) : null;

  const observer = new MutationObserver(() => {
    document.querySelectorAll(".category-chips, .rpt-subnav-tabs").forEach(chips => {
      if(chips.dataset.dragScrollInit) return;
      chips.dataset.dragScrollInit = "true";
      updateGradientFade(chips);
      chips.addEventListener("scroll", () => updateGradientFade(chips), { passive: true });
      sharedResizeObserver?.observe(chips);
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  
  document.querySelectorAll(".category-chips, .rpt-subnav-tabs").forEach(chips => {
    updateGradientFade(chips);
    chips.addEventListener("scroll", () => updateGradientFade(chips), { passive: true });
  });
})();

document.addEventListener("DOMContentLoaded", App.init);
