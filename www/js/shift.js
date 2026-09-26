// ============================================================
// shift.js — Loyverse-style Shift Management & Cashier Time In/Out
// ============================================================
const Shift = (() => {
  let activeTab = "active"; // "active" | "logs" | "staff"

  function getActiveShift(){
    const s = DB.getShift ? DB.getShift() : null;
    return s && s.status === "open" ? s : null;
  }

  function getShiftTransactions(shift){
    if(!shift || !shift.openedAt) return { store: [], fuel: [] };
    const closeTime = shift.closedAt || Date.now();
    const store = DB.getSales().filter(s => s.ts >= shift.openedAt && s.ts <= closeTime);
    const fuel = DB.getFuelSales ? DB.getFuelSales().filter(s => s.ts >= shift.openedAt && s.ts <= closeTime) : [];
    return { store, fuel };
  }

  function calculateShiftTotals(shift){
    const { store, fuel } = getShiftTransactions(shift);
    const openingCash = Number(shift.openingCash || 0);
    const payMap = { Cash: 0, GCash: 0, Card: 0, Other: 0 };

    store.forEach(s => {
      const m = s.method || "Cash";
      payMap[m] = (payMap[m] || 0) + (Number(s.total) || 0);
    });
    fuel.forEach(s => {
      const m = s.method || "Cash";
      payMap[m] = (payMap[m] || 0) + (Number(s.amount) || 0);
    });

    const cashSales = payMap["Cash"] || 0;
    const gcashSales = payMap["GCash"] || 0;
    const cardSales = payMap["Card"] || 0;
    const otherSales = payMap["Other"] || 0;
    const totalSales = store.reduce((sum, s) => sum + (Number(s.total) || 0), 0) +
                       fuel.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const cashIn = Number(shift.cashIn || 0);
    const cashOut = Number(shift.cashOut || 0);
    const expectedCash = openingCash + cashSales + cashIn - cashOut;

    return {
      storeCount: store.length,
      fuelCount: fuel.length,
      totalCount: store.length + fuel.length,
      openingCash,
      cashSales,
      gcashSales,
      cardSales,
      otherSales,
      totalSales,
      cashIn,
      cashOut,
      expectedCash,
      payMap,
      store
    };
  }

  // (2026-07-13) Format duration between two timestamps; was raw difference
  function fmtDuration(start, end){
    if(!start) return "0m";
    const diff = Math.max(0, (end || Date.now()) - start);
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if(hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }

  // (2026-07-13) Open shift modal with cashier selection & drawer cash; was closed
  function openStartShiftModal(){
    const cashiers = DB.getCashiers ? DB.getCashiers() : ["Rosella", "Cashier 1", "Cashier 2"];
    const currentUser = Auth.currentUser()?.name || cashiers[0] || "Rosella";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" });
    const timeStr = now.toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" });

    const body = `
      <div style="padding:4px 0 10px;">
        <div class="card card-tight" style="margin-bottom:14px;background:var(--paper-dim);padding:12px 16px;">
          <div class="flex-between">
            <span class="text-sm text-faint" style="font-weight:700;">Shift Date & Time</span>
            <strong>${dateStr}, ${timeStr}</strong>
          </div>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Select On-Duty Cashier</label>
          <select class="input" id="shift-start-cashier" style="font-size:1rem;height:42px;width:100%;">
            ${cashiers.map(c => `<option value="${Utils.escapeHtml(c)}" ${c===currentUser?"selected":""}>${Utils.escapeHtml(c)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Starting Cash in Drawer (Cash Register Float)</label>
          <div style="position:relative;display:flex;align-items:center;">
            <span style="position:absolute;left:12px;font-size:1.15rem;font-weight:700;color:var(--ink-soft);">₱</span>
            <input type="number" step="0.01" min="0" class="input mono font-bold" id="shift-start-cash" value="1000.00" placeholder="0.00" style="padding-left:32px;font-size:1.25rem;height:46px;width:100%;">
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;">
            <span class="text-xs text-faint" style="font-weight:600;">Presets:</span>
            <button type="button" class="btn btn-xs btn-outline shift-float-chip" data-amt="500" style="padding:2px 8px;border-radius:6px;font-size:0.75rem;">₱500</button>
            <button type="button" class="btn btn-xs btn-outline shift-float-chip" data-amt="1000" style="padding:2px 8px;border-radius:6px;font-size:0.75rem;">₱1,000</button>
            <button type="button" class="btn btn-xs btn-outline shift-float-chip" data-amt="1500" style="padding:2px 8px;border-radius:6px;font-size:0.75rem;">₱1,500</button>
            <button type="button" class="btn btn-xs btn-outline shift-float-chip" data-amt="2000" style="padding:2px 8px;border-radius:6px;font-size:0.75rem;">₱2,000</button>
          </div>
          <span class="text-xs text-faint" style="margin-top:4px;display:block;">Physical cash placed in register to start the shift change float.</span>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("clock",{size:18})} Open Shift (Time In)`,
      body,
      wide: false,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: "Open Shift", cls: "btn-primary font-bold", onClick: () => {
          const selCashier = document.getElementById("shift-start-cashier")?.value || currentUser;
          const openingCash = Number(document.getElementById("shift-start-cash")?.value) || 0;
          const shiftRecord = {
            id: Utils.uid("shift"),
            openedAt: Date.now(),
            openingCash,
            cashier: selCashier,
            status: "open",
            cashIn: 0,
            cashOut: 0
          };
          DB.setShift(shiftRecord);
          // Sync with today's starting balance in dayBalances
          const todayKey = new Date().toLocaleDateString("en-CA");
          const dayBalances = DB.getDayBalances ? DB.getDayBalances() : {};
          dayBalances[todayKey] = { ...(dayBalances[todayKey] || {}), startingBalance: openingCash };
          if(DB.setDayBalances) DB.setDayBalances(dayBalances);
          localStorage.setItem("pos_cashier", selCashier);
          Utils.toast(`Shift opened for ${selCashier} with ${Utils.money(openingCash)} float.`, "success");
          Utils.openCashDrawer();
          Modal.close();
          // (2026-07-13) Refresh topbar shift indicator on open; was render only
          if(typeof App !== "undefined" && App.paintTopbar) App.paintTopbar();
          render();
        }}
      ]
    });

    modal?.querySelectorAll(".shift-float-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const inp = modal.querySelector("#shift-start-cash");
        if(inp) inp.value = Number(btn.getAttribute("data-amt") || 0).toFixed(2);
      });
    });
  }

  // (2026-07-13) Modal for cash in / cash out drawer adjustments; was none
  function openCashAdjustmentModal(type = "in"){
    const active = getActiveShift();
    if(!active){ Utils.toast("No active open shift.", "warn"); return; }
    const isPayIn = type === "in";

    const body = `
      <div style="padding:4px 0 10px;">
        <div class="field" style="margin-bottom:14px;">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Amount to ${isPayIn ? "Add (Pay In)" : "Remove (Pay Out)"}</label>
          <div style="position:relative;display:flex;align-items:center;">
            <span style="position:absolute;left:12px;font-size:1.15rem;font-weight:700;color:var(--ink-soft);">₱</span>
            <input type="number" step="0.01" min="0" class="input mono font-bold" id="shift-adj-amount" placeholder="0.00" autofocus style="padding-left:32px;font-size:1.25rem;height:46px;width:100%;">
          </div>
        </div>
        <div class="field">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Reason / Description</label>
          <input type="text" class="input" id="shift-adj-reason" placeholder="${isPayIn ? 'e.g. Added change float' : 'e.g. Vendor payout, safe drop'}" style="font-size:0.95rem;height:40px;width:100%;">
        </div>
      </div>
    `;

    Modal.open({
      title: `${Icons.get("dollar-sign",{size:18})} ${isPayIn ? "Pay In (Add Drawer Cash)" : "Pay Out (Remove Drawer Cash)"}`,
      body,
      wide: false,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: isPayIn ? "Add Cash" : "Remove Cash", cls: isPayIn ? "btn-primary font-bold" : "btn-danger font-bold", onClick: () => {
          const amt = Number(document.getElementById("shift-adj-amount")?.value) || 0;
          const reason = document.getElementById("shift-adj-reason")?.value.trim() || (isPayIn ? "Pay In" : "Pay Out");
          if(amt <= 0){ Utils.toast("Please enter a valid amount.", "error"); return; }

          if(isPayIn){
            active.cashIn = (Number(active.cashIn) || 0) + amt;
          } else {
            active.cashOut = (Number(active.cashOut) || 0) + amt;
          }
          active.adjustments = active.adjustments || [];
          active.adjustments.push({ type, amount: amt, reason, ts: Date.now(), by: Auth.currentUser()?.name || active.cashier });
          DB.setShift(active);
          Utils.openCashDrawer();
          Utils.toast(`Recorded ${isPayIn ? 'Pay In' : 'Pay Out'} of ${Utils.money(amt)}.`, "success");
          Modal.close();
          render();
        }}
      ]
    });
  }

  // (2026-07-13) Close shift modal with cash counting & variance calculation; was manual
  function openEndShiftModal(){
    const active = getActiveShift();
    if(!active){ Utils.toast("No active open shift to close.", "warn"); return; }
    const totals = calculateShiftTotals(active);
    const expected = totals.expectedCash;

    const body = `
      <div style="padding:4px 0 10px;">
        <div class="card card-tight" style="margin-bottom:14px;background:var(--paper-dim);padding:12px 16px;">
          <div class="flex-between" style="margin-bottom:4px;">
            <span class="text-sm text-faint" style="font-weight:700;">On-Duty Cashier</span>
            <strong class="badge badge-brand">${Utils.escapeHtml(active.cashier || "Cashier")}</strong>
          </div>
          <div class="flex-between" style="margin-bottom:4px;">
            <span class="text-sm text-faint" style="font-weight:700;">Shift Opened</span>
            <span>${Utils.fmtDate(active.openedAt)} (${fmtDuration(active.openedAt)})</span>
          </div>
          <div class="flex-between">
            <span class="text-sm text-faint" style="font-weight:700;">Expected Cash in Drawer</span>
            <strong class="mono" style="color:var(--brand-deep);font-size:1.15rem;">${Utils.money(expected)}</strong>
          </div>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Actual Cash Counted in Drawer (Closing Count)</label>
          <div style="position:relative;display:flex;align-items:center;">
            <span style="position:absolute;left:12px;font-size:1.15rem;font-weight:700;color:var(--ink-soft);">₱</span>
            <input type="number" step="0.01" min="0" class="input mono font-bold" id="shift-close-actual" placeholder="0.00" autofocus style="padding-left:32px;font-size:1.35rem;height:48px;width:100%;">
          </div>
        </div>

        <div class="card surface-dim" style="padding:10px 14px;margin-bottom:14px;border:1px dashed var(--line);border-radius:8px;">
          <div class="flex-between">
            <span style="font-weight:700;">Cash Variance (Over / Short)</span>
            <strong id="shift-close-variance" class="mono font-bold" style="font-size:1.30rem;color:var(--ink-faint);">₱0.00</strong>
          </div>
        </div>

        <div class="field">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Closing Notes / Handover Remarks</label>
          <input type="text" class="input" id="shift-close-notes" placeholder="Optional notes for manager / next cashier" style="font-size:0.95rem;height:40px;width:100%;">
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("lock",{size:18})} Close Shift (Time Out)`,
      body,
      wide: false,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: "Confirm & Close Shift", cls: "btn-danger font-bold", onClick: () => {
          const actualVal = Number(document.getElementById("shift-close-actual")?.value) || 0;
          const variance = actualVal - expected;
          const notes = document.getElementById("shift-close-notes")?.value.trim() || "";
          const closedAt = Date.now();

          const logRecord = {
            id: active.id || Utils.uid("shift"),
            openedAt: active.openedAt,
            closedAt,
            duration: fmtDuration(active.openedAt, closedAt),
            cashier: active.cashier || "Cashier",
            openingCash: totals.openingCash,
            cashSales: totals.cashSales,
            gcashSales: totals.gcashSales,
            cardSales: totals.cardSales,
            otherSales: totals.otherSales,
            totalSales: totals.totalSales,
            totalCount: totals.totalCount,
            cashIn: totals.cashIn,
            cashOut: totals.cashOut,
            expectedCash: expected,
            actualCash: actualVal,
            variance,
            notes,
            status: "closed"
          };

          // Save to shift logs
          if(DB.saveShiftLog) DB.saveShiftLog(logRecord);

          // Update dayBalances ending balance
          const todayKey = new Date().toLocaleDateString("en-CA");
          const dayBalances = DB.getDayBalances ? DB.getDayBalances() : {};
          dayBalances[todayKey] = { ...(dayBalances[todayKey] || {}), endingBalance: actualVal };
          if(DB.setDayBalances) DB.setDayBalances(dayBalances);

          // Reset shift state
          DB.setShift({ openedAt: null, openingCash: 0, cashier: null, status: "closed", closedAt });

          // Pop cash drawer
          Utils.openCashDrawer();

          // Auto-backup
          if(typeof Sync !== "undefined" && Sync.createDailyBackup){
            Sync.createDailyBackup("shift_close");
          }

          Utils.toast(`Shift for ${logRecord.cashier} closed. Variance: ${variance >= 0 ? "+" : ""}${Utils.money(variance)}`, "success");
          Modal.close();
          // (2026-07-13) Refresh topbar shift indicator on close; was render only
          if(typeof App !== "undefined" && App.paintTopbar) App.paintTopbar();
          render();
        }}
      ]
    });

    const actualInput = modal.querySelector("#shift-close-actual");
    const varianceEl = modal.querySelector("#shift-close-variance");
    actualInput?.addEventListener("input", () => {
      const val = Number(actualInput.value) || 0;
      const diff = val - expected;
      varianceEl.textContent = `${diff >= 0 ? "+" : ""}${Utils.money(diff)}`;
      varianceEl.style.color = diff < -0.01 ? "var(--danger)" : diff > 0.01 ? "var(--warning-deep)" : "var(--success-deep)";
    });
  }

  // (2026-07-13) Render main Shift management interface; was missing
  function render(){
    const root = document.getElementById("view-root");
    if(!root) return;

    const activeShift = getActiveShift();
    const shiftLogs = DB.getShiftLogs ? DB.getShiftLogs() : [];
    const allCashiers = DB.getCashiers ? DB.getCashiers() : ["Rosella", "Cashier 1", "Cashier 2"];
    const totals = activeShift ? calculateShiftTotals(activeShift) : null;

    root.innerHTML = `
      <!-- (2026-07-13) Lock shift view full width to stabilize nav tabs; was shifting -->
      <div class="view-body shift-view-container" style="overflow-y:auto;flex:1;min-height:0;height:100%;width:100%;box-sizing:border-box;padding:16px;-webkit-overflow-scrolling:touch;">
        
        <!-- Header & Tab Navigation -->
        <!-- (2026-07-13) Segmented mobile top tab bar; was wrapping buttons -->
        <div class="shift-page-header">
          <div class="shift-title-block">
            <!-- (2026-07-13) Remove shift-page-sub subtitle; was subtitle paragraph -->
            <h2 class="shift-page-title">
              ${Icons.get("clock",{size:24})} Shift Management
            </h2>
          </div>
          <div class="shift-nav-tabs">
            <button class="btn btn-sm ${activeTab==='active'?'btn-primary':'btn-ghost'} shift-tab-btn" id="tab-shift-active">
              ${Icons.get("clock",{size:14})} <span>Active Shift</span>
            </button>
            <button class="btn btn-sm ${activeTab==='logs'?'btn-primary':'btn-ghost'} shift-tab-btn" id="tab-shift-logs">
              ${Icons.get("clipboard",{size:14})} <span>Shift Logs (${shiftLogs.length})</span>
            </button>
            <button class="btn btn-sm ${activeTab==='staff'?'btn-primary':'btn-ghost'} shift-tab-btn" id="tab-shift-staff">
              ${Icons.get("user",{size:14})} <span>Staff Status</span>
            </button>
          </div>
        </div>

        ${activeTab === "active" ? renderActiveTab(activeShift, totals) : ""}
        ${activeTab === "logs" ? renderLogsTab(shiftLogs) : ""}
        ${activeTab === "staff" ? renderStaffTab(allCashiers, activeShift, shiftLogs) : ""}

      </div>
    `;

    // Tab switcher events
    document.getElementById("tab-shift-active")?.addEventListener("click", () => { activeTab = "active"; render(); });
    document.getElementById("tab-shift-logs")?.addEventListener("click", () => { activeTab = "logs"; render(); });
    document.getElementById("tab-shift-staff")?.addEventListener("click", () => { activeTab = "staff"; render(); });

    // Action button listeners
    document.getElementById("btn-open-new-shift")?.addEventListener("click", openStartShiftModal);
    document.getElementById("btn-close-active-shift")?.addEventListener("click", openEndShiftModal);
    document.getElementById("btn-shift-pay-in")?.addEventListener("click", () => openCashAdjustmentModal("in"));
    document.getElementById("btn-shift-pay-out")?.addEventListener("click", () => openCashAdjustmentModal("out"));
    document.getElementById("btn-shift-open-drawer")?.addEventListener("click", () => {
      // (2026-07-13) Polished shift card layout and interactive receipts; was plain
      Utils.openCashDrawer();
      Utils.toast("Cash drawer kicked open.", "info");
    });

    root.querySelectorAll(".shift-sale-row").forEach(row => {
      row.addEventListener("click", () => {
        const saleId = row.getAttribute("data-sale-id");
        const sale = totals?.store?.find(s => String(s.id) === String(saleId) || String(s.receiptNo) === String(saleId));
        if(sale && typeof Reports !== "undefined" && Reports.openReceiptModal){
          Reports.openReceiptModal(sale);
        }
      });
    });
  }

  // (2026-07-13) Render active shift card and drawer metrics; was missing
  function renderActiveTab(active, totals){
    if(!active){
      return `
        <div class="card" style="padding:56px 24px;text-align:center;background:var(--paper-dim);border:2px dashed var(--line);border-radius:18px;box-shadow:var(--shadow-sm);max-width:640px;margin:24px auto;">
          <div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg, rgba(79,70,229,0.12), rgba(99,102,241,0.22));color:var(--brand);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 4px 12px rgba(79,70,229,0.15);">
            ${Icons.get("lock",{size:38})}
          </div>
          <h3 style="font-size:1.4rem;font-weight:800;margin:0 0 8px;color:var(--ink);">No Shift Currently Open</h3>
          <p class="text-sm text-faint" style="max-width:460px;margin:0 auto 24px;line-height:1.5;">
            The cash register drawer is locked and there is no cashier logged into this register session. Open a shift to set the cash float and begin ringing up sales.
          </p>
          <button class="btn btn-primary btn-lg font-bold" id="btn-open-new-shift" style="padding:12px 32px;border-radius:12px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
            ${Icons.get("clock",{size:18})} Open Shift (Time In)
          </button>
        </div>
      `;
    }

    return `
      <!-- Active Shift Banner -->
      <!-- (2026-07-13) 3-col quick actions and consolidated metrics list; was half-rows -->
      <!-- Active Shift Banner -->
      <div class="card shift-active-card">
        <div class="shift-active-header">
          <div class="shift-cashier-profile">
            <div class="shift-cashier-avatar">
              ${(active.cashier || "C").slice(0,1).toUpperCase()}
            </div>
            <div class="shift-cashier-details">
              <div class="shift-cashier-row">
                <h3 class="shift-cashier-name">${Utils.escapeHtml(active.cashier || "Cashier")}</h3>
                <span class="badge shift-badge-duty">
                  <span class="shift-duty-dot"></span> ACTIVE ON DUTY
                </span>
              </div>
              <div class="text-xs text-faint shift-cashier-meta">
                <span>Time In: <strong style="color:var(--ink);">${Utils.fmtDate(active.openedAt)}</strong></span>
                <span class="meta-sep">·</span>
                <span>Active Duration: <strong style="color:var(--brand);">${fmtDuration(active.openedAt)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div class="shift-action-cluster">
          <div class="shift-quick-actions">
            <button class="btn btn-outline shift-quick-btn font-bold" id="btn-shift-open-drawer">
              ${Icons.get("lock",{size:15})}
              <span>Pop Drawer</span>
            </button>
            <button class="btn btn-outline shift-quick-btn font-bold" id="btn-shift-pay-in">
              ${Icons.get("plus",{size:15})}
              <span>Pay In</span>
            </button>
            <button class="btn btn-outline shift-quick-btn font-bold" id="btn-shift-pay-out">
              ${Icons.get("minus",{size:15})}
              <span>Pay Out</span>
            </button>
          </div>
          <button class="btn btn-danger shift-close-btn font-bold" id="btn-close-active-shift">
            ${Icons.get("lock",{size:15})}
            <span>Close Shift</span>
          </button>
        </div>
      </div>

      <!-- Register & Drawer Cash Metrics Cards -->
      <div class="shift-metrics-container">
        <!-- Expected Drawer Cash Highlight Card -->
        <div class="card shift-hero-cash-card">
          <div class="shift-hero-cash-header">
            <span class="shift-hero-label">Expected Drawer Cash</span>
            <span class="shift-hero-icon">${Icons.get("lock",{size:18})}</span>
          </div>
          <div class="mono font-bold shift-hero-val">${Utils.money(totals.expectedCash)}</div>
          <div class="shift-hero-breakdown">
            <span>Float ${Utils.money(totals.openingCash)}</span>
            <span>+ Cash ${Utils.money(totals.cashSales)}</span>
            ${totals.cashIn ? `<span>+ In ${Utils.money(totals.cashIn)}</span>` : ""}
            ${totals.cashOut ? `<span>- Out ${Utils.money(totals.cashOut)}</span>` : ""}
          </div>
        </div>

        <!-- Consolidated Summary List -->
        <div class="card shift-metrics-summary">
          <div class="shift-metric-item">
            <div class="shift-metric-icon-wrap" style="background:rgba(100,116,139,0.12);color:var(--ink);">
              ${Icons.get("lock",{size:16})}
            </div>
            <div class="shift-metric-info">
              <span class="shift-metric-title">Starting Float</span>
              <span class="text-xs text-faint">Counted at Time In</span>
            </div>
            <div class="mono font-bold shift-metric-val">${Utils.money(totals.openingCash)}</div>
          </div>

          <div class="shift-metric-item">
            <div class="shift-metric-icon-wrap" style="background:rgba(16,185,129,0.12);color:#059669;">
              ${Icons.get("dollar-sign",{size:16})}
            </div>
            <div class="shift-metric-info">
              <span class="shift-metric-title">Cash Sales Inflow</span>
              <span class="text-xs text-faint">Physical cash received</span>
            </div>
            <div class="mono font-bold shift-metric-val" style="color:#059669;">${Utils.money(totals.cashSales)}</div>
          </div>

          <div class="shift-metric-item">
            <div class="shift-metric-icon-wrap" style="background:rgba(59,130,246,0.12);color:#2563EB;">
              ${Icons.get("credit-card",{size:16})}
            </div>
            <div class="shift-metric-info">
              <span class="shift-metric-title">Digital / Non-Cash</span>
              <span class="text-xs text-faint">GCash: ${Utils.money(totals.gcashSales)} · Card: ${Utils.money(totals.cardSales)}</span>
            </div>
            <div class="mono font-bold shift-metric-val">${Utils.money(totals.gcashSales + totals.cardSales + totals.otherSales)}</div>
          </div>
        </div>
      </div>

      <!-- Shift Sales & Recent Receipts -->
      <div class="card" style="padding:18px 22px;border-radius:16px;background:var(--paper-raised);border:1px solid var(--line);box-shadow:var(--shadow-xs);margin-bottom:18px;">
        <div class="flex-between" style="margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <h4 style="margin:0;font-size:1.10rem;font-weight:900;color:var(--ink);letter-spacing:-0.01em;">Shift Transactions & Receipts</h4>
            <span class="text-xs text-faint">${totals.totalCount} transaction(s) recorded (${totals.storeCount} store · ${totals.fuelCount} fuel)</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge-brand" style="font-size:0.88rem;padding:4px 10px;font-weight:800;">
              Total: ${Utils.money(totals.totalSales)}
            </span>
          </div>
        </div>

        ${totals.store.length ? `
          <div class="table-wrap" style="max-height:360px;overflow-y:auto;border-radius:10px;border:1px solid var(--line);">
            <table class="data" style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:var(--paper-dim);">
                  <th style="padding:10px 14px;font-size:0.78rem;">Time</th>
                  <th style="padding:10px 14px;font-size:0.78rem;">Receipt #</th>
                  <th style="padding:10px 14px;font-size:0.78rem;">Items Summary</th>
                  <th style="padding:10px 14px;font-size:0.78rem;">Payment Method</th>
                  <th style="padding:10px 14px;font-size:0.78rem;text-align:right;">Subtotal</th>
                  <th style="padding:10px 14px;font-size:0.78rem;text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${totals.store.slice(0, 30).map(s => `
                  <tr class="shift-sale-row" data-sale-id="${Utils.escapeHtml(s.id || s.receiptNo || '')}" style="cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='var(--paper-dim)'" onmouseout="this.style.background='transparent'">
                    <td class="text-xs" style="padding:10px 14px;color:var(--ink-soft);">${new Date(s.ts).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</td>
                    <td class="mono font-bold text-xs" style="padding:10px 14px;color:var(--brand);">#${Utils.escapeHtml(s.receiptNo || s.id || '')}</td>
                    <td class="text-xs text-soft" style="padding:10px 14px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      ${(s.items||[]).map(i=>`${i.qty}x ${i.name}`).join(", ") || "Sale item(s)"}
                    </td>
                    <td style="padding:10px 14px;">
                      <span class="badge ${s.method==='Cash'?'badge-neutral':'badge-brand'}" style="font-size:0.72rem;font-weight:700;">
                        ${s.method}
                      </span>
                    </td>
                    <td class="mono font-bold" style="padding:10px 14px;text-align:right;color:var(--ink);">${Utils.money(s.total)}</td>
                    <td style="padding:10px 14px;text-align:center;">
                      <button class="btn btn-xs btn-outline" style="font-size:0.72rem;padding:3px 8px;border-radius:6px;pointer-events:none;">
                        View Receipt
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty" style="padding:36px 0;text-align:center;">
            <div style="width:48px;height:48px;border-radius:50%;background:var(--paper-dim);display:inline-flex;align-items:center;justify-content:center;color:var(--ink-faint);margin-bottom:8px;">
              ${Icons.get("clipboard",{size:22})}
            </div>
            <p class="text-faint text-sm" style="margin:0 0 4px;font-weight:600;">No sales processed yet during this active shift window.</p>
            <p class="text-xs text-faint" style="margin:0;">Rung up sales from Minimart Store or Gasoline Station will appear here in real time.</p>
          </div>
        `}
      </div>
    `;
  }

  // (2026-07-13) Add mobile detailed table-card for shift logs; was wide table
  function renderLogsTab(logs){
    if(!logs || !logs.length){
      return `
        <div class="card" style="padding:48px 24px;text-align:center;background:var(--paper-dim);border:2px dashed var(--line);border-radius:16px;">
          <p class="text-faint text-sm">No past shift logs archived yet. Closed shifts will appear here with drawer balances & variances.</p>
        </div>
      `;
    }

    return `
      <div class="card shift-logs-wrapper" style="padding:16px 20px;border-radius:12px;background:var(--paper-raised);">
        <h4 style="margin:0 0 12px;font-size:1.05rem;font-weight:800;color:var(--ink);">Shift History & Cashier Time Records</h4>
        <div class="table-wrap shift-desktop-table">
          <table class="data" style="width:100%;">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Cashier</th>
                <th>Duration</th>
                <th>Starting Float</th>
                <th>Total Sales</th>
                <th>Expected Cash</th>
                <th>Actual Cash</th>
                <th>Variance (Over/Short)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => {
                const diff = Number(log.variance || 0);
                const diffColor = diff < -0.01 ? "var(--danger)" : diff > 0.01 ? "var(--warning-deep)" : "var(--success-deep)";
                return `
                  <tr>
                    <td class="text-xs">
                      <div>${new Date(log.openedAt).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</div>
                      <div class="text-faint">${new Date(log.openedAt).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})} – ${log.closedAt ? new Date(log.closedAt).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}) : "Now"}</div>
                    </td>
                    <td><strong>${Utils.escapeHtml(log.cashier || "Cashier")}</strong></td>
                    <td class="text-xs text-faint">${log.duration || "—"}</td>
                    <td class="mono text-xs">${Utils.money(log.openingCash || 0)}</td>
                    <td class="mono font-bold text-xs" style="color:var(--brand);">${Utils.money(log.totalSales || 0)}</td>
                    <td class="mono text-xs">${Utils.money(log.expectedCash || 0)}</td>
                    <td class="mono font-bold text-xs">${Utils.money(log.actualCash || 0)}</td>
                    <td class="mono font-bold text-xs" style="color:${diffColor};">${diff >= 0 ? "+" : ""}${Utils.money(diff)}</td>
                    <td class="text-xs text-soft">${Utils.escapeHtml(log.notes || "—")}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <!-- Mobile detailed table cards for shift history -->
        <div class="shift-mobile-cards">
          ${logs.map(log => {
            const diff = Number(log.variance || 0);
            const diffColor = diff < -0.01 ? "var(--danger)" : diff > 0.01 ? "var(--warning-deep)" : "var(--success-deep)";
            const openedStr = new Date(log.openedAt).toLocaleDateString("en-PH", {month:"short", day:"numeric", year:"numeric"});
            const openTimeStr = new Date(log.openedAt).toLocaleTimeString("en-PH", {hour:"2-digit", minute:"2-digit"});
            const closeTimeStr = log.closedAt ? new Date(log.closedAt).toLocaleTimeString("en-PH", {hour:"2-digit", minute:"2-digit"}) : "Now";
            return `
              <div class="shift-log-card">
                <div class="shift-card-top">
                  <div>
                    <div class="shift-card-title">${openedStr}</div>
                    <div class="shift-card-sub">${openTimeStr} – ${closeTimeStr} · <strong>${log.duration || "—"}</strong></div>
                  </div>
                  <span class="badge shift-cashier-badge">
                    ${Utils.escapeHtml(log.cashier || "Cashier")}
                  </span>
                </div>
                <table class="shift-card-table">
                  <tbody>
                    <tr>
                      <td class="sct-label">Starting Float</td>
                      <td class="sct-val mono">${Utils.money(log.openingCash || 0)}</td>
                    </tr>
                    <tr>
                      <td class="sct-label">Total Sales</td>
                      <td class="sct-val mono font-bold" style="color:var(--brand);">${Utils.money(log.totalSales || 0)}</td>
                    </tr>
                    <tr>
                      <td class="sct-label">Expected Cash</td>
                      <td class="sct-val mono">${Utils.money(log.expectedCash || 0)}</td>
                    </tr>
                    <tr>
                      <td class="sct-label">Actual Cash</td>
                      <td class="sct-val mono font-bold">${Utils.money(log.actualCash || 0)}</td>
                    </tr>
                    <tr class="sct-variance-row">
                      <td class="sct-label">Variance (Over/Short)</td>
                      <td class="sct-val mono font-bold" style="color:${diffColor};">${diff >= 0 ? "+" : ""}${Utils.money(diff)}</td>
                    </tr>
                    ${log.notes ? `
                    <tr>
                      <td class="sct-label">Notes</td>
                      <td class="sct-val text-soft">${Utils.escapeHtml(log.notes)}</td>
                    </tr>
                    ` : ""}
                  </tbody>
                </table>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // (2026-07-13) Render staff duty status tab; was missing
  function renderStaffTab(cashiers, activeShift, logs){
    const activeName = activeShift?.cashier?.toLowerCase();

    return `
      <div class="card" style="padding:16px 20px;border-radius:12px;background:var(--paper-raised);">
        <h4 style="margin:0 0 4px;font-size:1.05rem;font-weight:800;color:var(--ink);">Cashier Duty Status for Today</h4>
        <p class="text-xs text-faint" style="margin-bottom:16px;">Real-time overview of which staff members are currently on shift vs off duty.</p>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;">
          ${cashiers.map(c => {
            const isOnDuty = activeName && activeName === c.toLowerCase();
            const lastLog = logs.find(l => l.cashier?.toLowerCase() === c.toLowerCase());
            return `
              <div class="card card-tight" style="padding:14px 16px;border-radius:10px;border:1.5px solid ${isOnDuty ? 'var(--success-deep)' : 'var(--line)'};background:${isOnDuty ? 'var(--success-tint)' : 'var(--paper-dim)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:${isOnDuty?'var(--success-deep)':'var(--line)'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">
                      ${c.slice(0,1).toUpperCase()}
                    </div>
                    <div>
                      <strong style="font-size:0.95rem;color:var(--ink);">${Utils.escapeHtml(c)}</strong>
                      <div class="text-xs text-faint">Role: Cashier</div>
                    </div>
                  </div>
                  <span class="badge ${isOnDuty ? 'badge-green' : 'badge-neutral'}" style="font-size:0.72rem;">
                    ${isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
                  </span>
                </div>
                <div class="text-xs text-soft" style="padding-top:6px;border-top:1px dashed var(--line);">
                  ${isOnDuty ? `Logged In: <strong>${Utils.fmtDate(activeShift.openedAt)}</strong>` : (lastLog ? `Last Shift: <strong>${new Date(lastLog.openedAt).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} (${lastLog.duration || ''})</strong>` : 'No shifts logged yet')}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  return { render, openStartShiftModal, openEndShiftModal, getActiveShift };
})();
