// ============================================================
// reports.js — X / Z shift reports, sales history browser, and
// (admin-only) a detailed clickable Overview dashboard.
// ============================================================
const Reports = (() => {
  // (2026-07-13) Add period filters (this/last week, month) in reports; was days
  let tab = "overview"; // overview | history | fuel
  let todayOnly = false;
  let periodKey = "this_week";
  let categoryFilter = null;
  let overviewCharts = {};

  // ---------------- shift reports (X/Z) ----------------
  function shiftSales(){
    const shift = DB.getShift();
    return {
      store: DB.getSales().filter(s => s.ts >= shift.openedAt),
      fuel: DB.getFuelSales().filter(s => s.ts >= shift.openedAt)
    };
  }
  function paymentTotals(sales, fuel){
    const map = {};
    [...sales, ...fuel].forEach(s => { const amt = s.total ?? s.amount; map[s.method] = (map[s.method]||0) + amt; });
    return map;
  }
  function shiftReportHTML(closing = false){
    const { store, fuel } = shiftSales();
    const shift = DB.getShift();
    const storeTotal = store.reduce((s,x)=>s+x.total,0);
    const fuelTotal = fuel.reduce((s,x)=>s+x.amount,0);
    const pay = paymentTotals(store, fuel);
    const cashIn = pay["Cash"]||0;
    const expectedCash = shift.openingCash + cashIn;
    return `
      <div class="card" style="margin-bottom:14px;">
        <div class="flex-between"><span class="text-sm text-faint">Shift opened</span><strong>${Utils.fmtDate(shift.openedAt)}</strong></div>
        <div class="flex-between"><span class="text-sm text-faint">Opening cash</span><strong>${Utils.money(shift.openingCash)}</strong></div>
      </div>
      <div class="grid-2" style="margin-bottom:14px;">
        <div class="card"><div class="text-faint text-sm">Store Sales</div>${Utils.odometer(storeTotal.toFixed(2))}<div class="text-sm text-faint" style="margin-top:6px;">${store.length} transaction(s)</div></div>
        <div class="card"><div class="text-faint text-sm">Fuel Sales</div>${Utils.odometer(fuelTotal.toFixed(2))}<div class="text-sm text-faint" style="margin-top:6px;">${fuel.length} transaction(s)</div></div>
      </div>
      <h3 style="margin-bottom:8px;">Payment Method Breakdown</h3>
      <div class="table-wrap" style="margin-bottom:14px;"><table class="data"><tbody>
        ${Object.entries(pay).map(([m,v])=>`<tr><td>${m}</td><td style="text-align:right;" class="mono">${Utils.money(v)}</td></tr>`).join("") || `<tr><td colspan="2" class="text-faint">No sales this shift.</td></tr>`}
        <tr style="font-weight:800;"><td>Total</td><td style="text-align:right;" class="mono">${Utils.money(storeTotal+fuelTotal)}</td></tr>
      </tbody></table></div>
      ${closing ? `
      <div class="card surface-dim">
        <div class="field"><label>Expected cash in drawer (opening + cash sales)</label><input class="input" value="${expectedCash.toFixed(2)}" disabled></div>
        <div class="field"><label>Actual cash counted</label><input class="input" id="actual-cash" type="number" step="0.01" placeholder="Count the drawer and enter here"></div>
        <div class="flex-between"><span class="text-sm">Variance</span><strong id="cash-variance" class="mono">₱0.00</strong></div>
      </div>` : ""}`;
  }
  function openXReport(){
    Modal.open({ title:`${Icons.get("clipboard",{size:17})} X Report (Shift Snapshot)`, body: shiftReportHTML(false), wide:true, actions:[{label:"Close",cls:"btn-ghost"}] });
  }
  function openZReport(){
    const modal = Modal.open({
      title:`${Icons.get("lock",{size:17})} Z Report (End of Shift)`, body: shiftReportHTML(true), wide:true,
      actions:[{label:"Cancel",cls:"btn-ghost"},{label:"Close Shift",cls:"btn-danger", onClick:()=>closeShift(modal)}]
    });
    const actual = modal.querySelector("#actual-cash");
    const { store, fuel } = shiftSales();
    const shift = DB.getShift();
    const cashIn = paymentTotals(store, fuel)["Cash"]||0;
    const expected = shift.openingCash + cashIn;
    actual.addEventListener("input", () => {
      const variance = Number(actual.value||0) - expected;
      const el = modal.querySelector("#cash-variance");
      el.textContent = Utils.money(variance);
      el.style.color = variance < 0 ? "var(--danger)" : variance > 0 ? "var(--warning-deep)" : "var(--success-deep)";
    });
  }
  function closeShift(modal){
    Modal.confirm({
      title:"Close this shift?",
      message:"This starts a fresh shift counter. Sales history is kept — this only resets the X/Z shift window and sets a new opening cash amount.",
      onConfirm: () => {
        const actual = document.querySelector("#actual-cash")?.value;
        DB.setShift({ openedAt: Date.now(), openingCash: Number(actual)||0 });
        Modal.close();
        Utils.toast("Shift closed. New shift started.", "success");
      }
    });
  }

  // (2026-07-13) Copiable clean TXN ID pill with copy feedback; was static text
  function openReceiptModal(sale){
    if(!sale) return;
    const settings = DB.getSettings();
    const cleanId = (sale.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-8);
    const txnId = `TXN-${cleanId || "00000000"}`;
    const allProds = DB.getProducts();

    const body = `
      <div class="card" style="margin-bottom:14px;background:var(--paper-dim);padding:14px 18px;border-radius:var(--r-lg);">
        <div class="flex-between" style="margin-bottom:8px;align-items:center;">
          <span class="text-sm text-faint" style="font-weight:700;text-transform:uppercase;">Transaction ID</span>
          <button type="button" class="btn btn-sm" id="btn-copy-txnid" style="background:var(--brand-tint);color:var(--brand-deep);border:1.5px solid var(--brand);font-family:var(--font-mono);font-size:1.2rem;font-weight:900;letter-spacing:.04em;padding:4px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;" title="Click to copy Transaction ID">
            <span id="txnid-text">${txnId}</span>
            <span id="txnid-icon" style="display:flex;align-items:center;">${Icons.get("clipboard",{size:14})}</span>
          </button>
        </div>
        <div class="flex-between" style="margin-bottom:6px;"><span class="text-sm text-faint" style="font-weight:700;">Date & Time</span><strong style="font-size:1rem;">${Utils.fmtDate(sale.ts)}</strong></div>
        <div class="flex-between" style="margin-bottom:6px;"><span class="text-sm text-faint" style="font-weight:700;">Cashier</span><strong style="font-size:1.05rem;">${Utils.escapeHtml(sale.cashier || "Cashier")}</strong></div>
        <div class="flex-between" style="align-items:center;${sale.refCode ? "margin-bottom:6px;" : ""}"><span class="text-sm text-faint" style="font-weight:700;">Payment Method</span><span class="badge badge-brand" style="font-size:.92rem;font-weight:800;padding:4px 12px;border-radius:10px;">${sale.method}</span></div>
        ${sale.refCode ? `
          <div class="flex-between" style="align-items:center;"><span class="text-sm text-faint" style="font-weight:700;">Reference No.</span><strong class="mono" style="font-size:1.1rem;color:var(--brand-deep);">${Utils.escapeHtml(sale.refCode)}</strong></div>
        ` : ""}
      </div>
      <h4 style="font-size:var(--fs-sm);margin-bottom:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-faint);">Items Purchased (${sale.items ? sale.items.length : 0})</h4>
      <div class="table-wrap" style="max-height:280px;overflow-y:auto;margin-bottom:14px;border:1px solid var(--line);border-radius:var(--r-md);">
        <table class="data" style="font-size:1rem;">
          <thead>
            <tr style="font-size:.84rem;text-transform:uppercase;letter-spacing:.03em;">
              <th style="padding:10px 12px;">Product</th>
              <th style="text-align:center;padding:10px 8px;width:70px;">Qty</th>
              <th style="text-align:right;padding:10px 8px;width:110px;">Price</th>
              <th style="text-align:right;padding:10px 12px;width:120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(sale.items || []).map(l => {
              const matched = allProds.find(p => p.id === l.productId) || {};
              const img = l.imageUrl || matched.imageUrl;
              const cat = l.category || matched.category;
              return `
              <tr>
                <td style="padding:10px 12px;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div class="prod-thumb-sm" style="width:42px;height:42px;border-radius:10px;flex-shrink:0;border:1px solid var(--line);">
                      ${Utils.productThumb({ ...l, imageUrl: img, category: cat }, { iconSize:22 })}
                    </div>
                    <div>
                      <strong style="font-size:1.08rem;line-height:1.25;display:block;">${Utils.escapeHtml(l.name)}</strong>
                      ${l.unitType==="pack" ? `<span class="badge badge-brand" style="font-size:.70rem;padding:2px 6px;margin-top:3px;">PACK (${l.piecesPerPack||1} pcs)</span>` : l.isCustom ? `<span class="badge badge-neutral" style="font-size:.70rem;padding:2px 6px;margin-top:3px;">Custom Item</span>` : ""}
                    </div>
                  </div>
                </td>
                <td style="text-align:center;font-size:1.25rem;font-weight:850;padding:10px 8px;" class="mono">${l.qty}</td>
                <td style="text-align:right;font-size:1.05rem;font-weight:700;padding:10px 8px;" class="mono text-faint">${Utils.money(l.price)}</td>
                <td style="text-align:right;font-size:1.2rem;font-weight:850;color:var(--brand-deep);padding:10px 12px;" class="mono">${Utils.money(l.price * l.qty)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div class="totals-summary" style="background:var(--paper-raised);border:1.5px solid var(--line-strong);border-radius:var(--r-lg);padding:14px 18px;">
        <div class="totals-row" style="font-size:1.05rem;margin-bottom:6px;"><span>Subtotal</span><span class="mono" style="font-weight:700;">${Utils.money(sale.subtotal ?? sale.total)}</span></div>
        ${sale.discountAmt ? `<div class="totals-row" style="font-size:1.05rem;margin-bottom:6px;"><span class="text-faint">Discount</span><span class="mono font-bold" style="color:var(--danger);">-${Utils.money(sale.discountAmt)}</span></div>` : ""}
        ${settings.vatEnabled && sale.vat ? `<div class="totals-row" style="font-size:1.02rem;margin-bottom:6px;"><span>VAT incl. (${settings.vatRate}%)</span><span class="mono font-bold">${Utils.money(sale.vat)}</span></div>` : ""}
        <div class="totals-row grand" style="padding-top:8px;margin-top:6px;border-top:1.5px solid var(--line);">
          <span style="font-size:1.25rem;font-weight:800;">Total Paid</span>
          <span class="mono" style="font-size:2.3rem;font-weight:900;color:var(--brand);">${Utils.money(sale.total)}</span>
        </div>
        ${sale.method === "Cash" && sale.tendered !== undefined ? `
          <div class="totals-row" style="margin-top:10px;border-top:1px dashed var(--line);padding-top:10px;font-size:1.15rem;">
            <span class="text-faint" style="font-weight:700;">Cash Tendered</span>
            <span class="mono font-bold" style="font-size:1.35rem;">${Utils.money(sale.tendered)}</span>
          </div>
          <div class="totals-row" style="margin-top:4px;font-size:1.25rem;">
            <span style="font-weight:800;color:var(--success-deep);">Change Given</span>
            <span class="mono font-bold" style="font-size:1.75rem;font-weight:900;color:var(--success-deep);">${Utils.money(sale.change || 0)}</span>
          </div>
        ` : ""}
      </div>`;

    const modal = Modal.open({
      title: `${Icons.get("receipt",{size:18})} Receipt & Transaction Details`,
      body,
      wide: true,
      actions: [
        { label: "Close", cls: "btn-ghost btn-lg", onClick: Modal.close },
        { label: "Print Receipt", cls: "btn-primary btn-lg", onClick: () => { POS.printByRecord(sale); } }
      ]
    });

    const copyBtn = modal.querySelector("#btn-copy-txnid");
    if(copyBtn){
      copyBtn.onclick = async () => {
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(txnId);
          } else {
            const ta = document.createElement("textarea");
            ta.value = txnId; document.body.appendChild(ta);
            ta.select(); document.execCommand("copy"); ta.remove();
          }
          const iconEl = copyBtn.querySelector("#txnid-icon");
          if(iconEl) iconEl.innerHTML = Icons.get("check-circle",{size:14});
          Utils.toast(`Copied ${txnId} to clipboard!`, "success", 1500);
          setTimeout(() => { if(iconEl) iconEl.innerHTML = Icons.get("clipboard",{size:14}); }, 1800);
        }catch(err){
          Utils.toast(`Transaction ID: ${txnId}`, "info", 2000);
        }
      };
    }
  }

  // ---------------- plain history tables ----------------
  function historyTable(){
    let sales = DB.getSales();
    if(todayOnly) sales = sales.filter(s => s.ts >= Utils.startOfDay());
    sales = sales.slice(0,100);
    return sales.length ? `
      <div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Items</th><th>Total</th><th>Method</th><th>Cashier</th><th style="text-align:right;">Actions</th></tr></thead><tbody>
      ${sales.map(s => `<tr>
        <td style="cursor:pointer;" data-view-receipt="${s.id}">${Utils.fmtDate(s.ts)}</td>
        <td style="cursor:pointer;" data-view-receipt="${s.id}"><button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:var(--fs-xs);">${Icons.get("receipt",{size:12})} ${s.items.length} item(s)</button></td>
        <td class="mono font-bold" style="cursor:pointer;" data-view-receipt="${s.id}">${Utils.money(s.total)}</td>
        <td style="cursor:pointer;" data-view-receipt="${s.id}"><span class="badge badge-neutral">${s.method}</span></td>
        <td style="cursor:pointer;" data-view-receipt="${s.id}">${s.cashier}</td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-outline" data-view-receipt="${s.id}">${Icons.get("receipt",{size:13})} View Receipt</button>
          <button class="btn btn-sm btn-ghost" data-reprint="${s.id}" style="margin-left:4px;">${Icons.get("printer",{size:13})} Print</button>
        </td>
      </tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">${Icons.get("receipt",{size:34})}<h3>No sales ${todayOnly?"today":"yet"}</h3></div>`;
  }
  function fuelHistoryTable(){
    let sales = DB.getFuelSales();
    if(todayOnly) sales = sales.filter(s => s.ts >= Utils.startOfDay());
    sales = sales.slice(0,100);
    return sales.length ? `
      <div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Pump</th><th>Fuel</th><th>Liters</th><th>Total</th><th>Method</th><th>Cashier</th></tr></thead><tbody>
      ${sales.map(s => `<tr><td>${Utils.fmtDate(s.ts)}</td><td>${s.pumpLabel}</td><td>${s.fuelName}</td><td class="mono">${s.liters.toFixed(2)} L</td><td class="mono">${Utils.money(s.amount)}</td><td>${s.method}</td><td>${s.cashier}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">${Icons.get("fuel",{size:34})}<h3>No fuel sales ${todayOnly?"today":"yet"}</h3></div>`;
  }

  // (2026-07-13) Add purchases restock tab & table in reports; was store/fuel only
  function purchasesTable(){
    const summary = Analytics.restockSummary(todayOnly ? "today" : "all");
    return `
      <div class="grid-3" style="margin-bottom:14px;">
        <div class="card card-tight" style="border:1px solid var(--line);background:var(--brand-tint);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Capital Spent</div>
          <strong style="font-size:1.25rem;color:var(--brand-deep);">${Utils.money(summary.totalCapitalSpent)}</strong>
        </div>
        <div class="card card-tight" style="border:1px solid var(--line);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Units Restocked</div>
          <strong style="font-size:1.25rem;">${summary.totalUnitsPurchased} pcs</strong>
        </div>
        <div class="card card-tight" style="border:1px solid var(--line);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Restock Orders</div>
          <strong style="font-size:1.25rem;">${summary.count} orders</strong>
        </div>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Time</th><th>Product</th><th>Supplier</th><th>Qty Added</th><th>Unit Cost</th><th>Total Cost</th></tr></thead>
        <tbody>
          ${summary.logs.length ? summary.logs.map(l => `
            <tr>
              <td class="text-sm text-faint">${Utils.fmtDate(l.timestamp||l.ts)}</td>
              <td><strong>${Utils.escapeHtml(l.product_name||l.productName)}</strong></td>
              <td class="text-sm text-faint">${Utils.escapeHtml(l.supplier_name||l.supplierName||"—")}</td>
              <td class="mono font-bold">+${l.quantity_added||l.quantity}</td>
              <td class="mono">${Utils.money(l.unit_cost||l.unitCost||0)}</td>
              <td class="mono" style="font-weight:700;color:var(--brand-deep);">${Utils.money(l.total_cost||0)}</td>
            </tr>`).join("") : `<tr><td colspan="6" class="text-faint text-center" style="padding:24px;">No purchase/restock records found ${todayOnly?"today":""}.</td></tr>`
          }
        </tbody>
      </table></div>`;
  }

  // ---------------- Overview (admin only): stats, clickable charts, top sellers ----------------
  function destroyOverviewCharts(){ Object.values(overviewCharts).forEach(c=>c?.destroy()); overviewCharts = {}; }

  function openDayDrilldown(dayStart){
    const { store, fuel } = Analytics.transactionsOnDay(dayStart);
    const label = new Date(dayStart).toLocaleDateString("en-PH", { weekday:"long", month:"long", day:"numeric" });
    const total = store.reduce((s,x)=>s+x.total,0) + fuel.reduce((s,x)=>s+x.amount,0);
    const body = `
      <div class="flex-between" style="margin-bottom:12px;"><span class="text-sm text-faint">Total that day</span><strong class="mono">${Utils.money(total)}</strong></div>
      ${store.length ? `<h3 style="margin-bottom:8px;">${Icons.get("cart",{size:14})} Store (${store.length})</h3>
      <div class="table-wrap" style="margin-bottom:14px;"><table class="data"><tbody>
      ${store.map(s=>`<tr><td>${Utils.fmtDate(s.ts)}</td><td>${s.items.length} item(s)</td><td>${s.method}</td><td style="text-align:right;" class="mono">${Utils.money(s.total)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
      ${fuel.length ? `<h3 style="margin-bottom:8px;">${Icons.get("fuel",{size:14})} Fuel (${fuel.length})</h3>
      <div class="table-wrap"><table class="data"><tbody>
      ${fuel.map(s=>`<tr><td>${Utils.fmtDate(s.ts)}</td><td>${s.fuelName}</td><td>${s.liters.toFixed(2)} L</td><td style="text-align:right;" class="mono">${Utils.money(s.amount)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
      ${!store.length && !fuel.length ? `<div class="empty">${Icons.get("calendar",{size:30})}<h3>No transactions this day</h3></div>` : ""}`;
    Modal.open({ title:`${Icons.get("calendar",{size:17})} ${label}`, body, wide:true, actions:[{label:"Close",cls:"btn-ghost"}] });
  }

  function openProductDrilldown(row, stats){
    const lines = [];
    stats.sales.forEach(s => s.items.forEach(l => { if(l.productId === row.productId) lines.push({ ts:s.ts, qty:l.qty, amount:l.price*l.qty, method:s.method }); }));
    lines.sort((a,b)=>b.ts-a.ts);
    const body = `
      <div class="grid-3" style="margin-bottom:14px;">
        <div class="card card-tight"><div class="text-faint text-sm">Units sold</div><strong style="font-size:1.15rem;">${row.units}</strong></div>
        <div class="card card-tight"><div class="text-faint text-sm">Revenue</div><strong style="font-size:1.15rem;">${Utils.money(row.revenue)}</strong></div>
        <div class="card card-tight"><div class="text-faint text-sm">Profit</div><strong style="font-size:1.15rem;">${Utils.money(row.profit)}</strong></div>
      </div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Qty</th><th>Amount</th><th>Method</th></tr></thead><tbody>
      ${lines.map(l=>`<tr><td>${Utils.fmtDate(l.ts)}</td><td>${l.qty}</td><td class="mono">${Utils.money(l.amount)}</td><td>${l.method}</td></tr>`).join("")}
      </tbody></table></div>`;
    Modal.open({ title:`${Icons.get("package",{size:17})} ${Utils.escapeHtml(row.name)}`, body, wide:true, actions:[{label:"Close",cls:"btn-ghost"}] });
  }

  // (2026-07-13) Add period chips (this/last week, month) to overview; was days
  function renderOverviewStats(stats){
    const wrap = document.getElementById("ov-pl");
    if(!wrap) return;
    const p = stats.pl;
    const cards = [
      { lbl:"Total Net Revenue", val: p.netRevenue, hero:true },
      { lbl:"Store Gross Profit", val: p.storeGrossProfit },
      { lbl:"Gasoline Gross Profit", val: p.fuelGrossProfit },
      { lbl:"Operating Expenses", val: -stats.totalOperatingExpenses, neg:true },
      { lbl:"Net Operating Profit", val: p.netProfit, big:true },
      { lbl:"Profit Margin", val: p.margin, isPct:true }
    ];
    wrap.innerHTML = cards.map(c => `
      <div class="pl-card ${c.hero||c.big?"hero":""}">
        <div class="lbl">${c.lbl}</div>
        <div class="amt ${c.val<0?"neg":c.val>0 && !c.hero && !c.big?"pos":""}">
          ${c.isPct ? `${c.val>=0?"+":""}${c.val.toFixed(1)}%` : c.isInt ? c.val : `${c.val<0?"−":""}${Utils.money(Math.abs(c.val))}`}
        </div>
      </div>`).join("");
  }

  function renderTopSellersTable(stats){
    const wrap = document.getElementById("ov-top-table");
    let rows = Analytics.topSellers(stats, 500);
    if(categoryFilter) rows = rows.filter(r => r.category === categoryFilter);
    const filterChip = categoryFilter ? `<div class="chip active" id="clear-cat-filter" style="margin-bottom:10px;">${Icons.get("filter",{size:12})}Filtered: ${Utils.escapeHtml(categoryFilter)} ${Icons.get("x",{size:11})}</div>` : "";
    wrap.innerHTML = filterChip + (rows.length ? `
      <div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Units</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead><tbody>
      ${rows.slice(0,50).map((r,i)=>`<tr class="clickable-row" data-drill="${r.productId}"><td class="text-faint">${i+1}</td><td><strong>${Utils.escapeHtml(r.name)}</strong></td><td class="text-sm text-faint">${Utils.escapeHtml(r.category)}</td><td class="mono">${r.units}</td><td class="mono">${Utils.money(r.revenue)}</td><td class="mono">${Utils.money(r.profit)}</td><td class="mono">${r.margin.toFixed(0)}%</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">${Icons.get("package",{size:30})}<h3>No sales in this period</h3></div>`);
    document.getElementById("clear-cat-filter")?.addEventListener("click", () => { categoryFilter = null; renderTopSellersTable(stats); });
    wrap.querySelectorAll("[data-drill]").forEach(tr => tr.onclick = () => {
      const row = Analytics.topSellers(stats, 500).find(r => r.productId === tr.dataset.drill);
      if(row) openProductDrilldown(row, stats);
    });
  }

  // (2026-07-13) Fix reports charts sync with computeTrendData; was rolling days
  function buildOverviewCharts(stats){
    destroyOverviewCharts();
    const gridColor = getComputedStyle(document.body).getPropertyValue("--line").trim() || "#E2E8F0";
    const inkColor = getComputedStyle(document.body).getPropertyValue("--ink-soft").trim() || "#475569";
    Chart.defaults.color = inkColor;
    Chart.defaults.font.family = "Montserrat, sans-serif";
    Chart.defaults.font.size = 12;

    const trend = Analytics.computeTrendData(periodKey);
    const trendEl = document.getElementById("ov-chart-trend");
    if(trendEl){
      overviewCharts.trend = new Chart(trendEl, {
        type:"line",
        data:{ labels:trend.labels, datasets:[
          { label:"Store Sales", data:trend.storeData, borderColor:"#2563EB", backgroundColor:"rgba(37,99,235,.10)", fill:true, tension:0.4, pointRadius:4, pointHoverRadius:6 },
          { label:"Fuel Sales", data:trend.fuelData, borderColor:"#D97706", backgroundColor:"rgba(217,119,6,.10)", fill:true, tension:0.4, pointRadius:4, pointHoverRadius:6 }
        ]},
        options:{
          responsive:true, maintainAspectRatio:false, onHover:(evt,els)=>{ evt.native.target.style.cursor = els.length?"pointer":"default"; },
          onClick:(evt,els)=>{ if(els.length && trend.dayStarts[els[0].index]) openDayDrilldown(trend.dayStarts[els[0].index]); },
          plugins:{
            legend:{ position:"bottom", labels: { font: { weight: "600" } } },
            tooltip:{
              callbacks:{
                label: (ctx) => `${ctx.dataset.label}: ${Utils.money(ctx.parsed.y)}`,
                footer:()=>"Click a point to see that day's transactions"
              }
            }
          },
          scales:{
            x:{ grid:{ color:gridColor }, ticks:{ font:{ weight:"600" } } },
            y:{ grid:{ color:gridColor }, ticks:{ callback:v=>"₱"+Number(v).toLocaleString() } }
          }
        }
      });
    }

    const catPL = Analytics.categoryPL(stats);
    const catEl = document.getElementById("ov-chart-category");
    if(catEl){
      const hasCatData = catPL.length > 0 && catPL.some(c => c.revenue > 0);
      overviewCharts.cat = new Chart(catEl, {
        type:"bar",
        data:{
          labels: hasCatData ? catPL.map(c=>c.category) : ["No Category Data"],
          datasets:[
            { label:"Revenue", data: hasCatData ? catPL.map(c=>c.revenue) : [0], backgroundColor:"#2563EB", borderRadius:6 },
            { label:"Profit", data: hasCatData ? catPL.map(c=>c.profit) : [0], backgroundColor:"#059669", borderRadius:6 }
          ]
        },
        options:{
          responsive:true, maintainAspectRatio:false, onHover:(evt,els)=>{ evt.native.target.style.cursor = els.length?"pointer":"default"; },
          onClick:(evt,els)=>{ if(els.length && hasCatData){ categoryFilter = catPL[els[0].index].category; renderTopSellersTable(stats); } },
          plugins:{
            legend:{ position:"bottom", labels: { font: { weight: "600" } } },
            tooltip:{
              callbacks:{
                label: (ctx) => `${ctx.dataset.label}: ${Utils.money(ctx.parsed.y)}`,
                footer:()=> hasCatData ? "Click a bar to filter Top Sellers below" : ""
              }
            }
          },
          scales:{
            x:{ grid:{ display:false }, ticks:{ font:{ weight:"600" } } },
            y:{ grid:{ color:gridColor }, ticks:{ callback:v=>"₱"+Number(v).toLocaleString() } }
          }
        }
      });
    }
  }

  function renderOverview(){
    const wrap = document.getElementById("report-body");
    const r = Analytics.getPeriodRange(periodKey);
    wrap.innerHTML = `
      <div class="flex-between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <span class="text-md font-bold" style="color:var(--ink);">${r.subtitle}</span>
          <div class="text-sm text-faint">Click any chart point or category bar to drill in.</div>
        </div>
        <div class="date-range-bar" id="ov-period-bar" style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="chip ${periodKey==="today"?"active":""}" data-p="today" style="min-height:44px;padding:8px 16px;font-weight:700;">Today</button>
          <button class="chip ${periodKey==="this_week"?"active":""}" data-p="this_week" style="min-height:44px;padding:8px 16px;font-weight:700;">This Week</button>
          <button class="chip ${periodKey==="last_week"?"active":""}" data-p="last_week" style="min-height:44px;padding:8px 16px;font-weight:700;">Last Week</button>
          <button class="chip ${periodKey==="this_month"?"active":""}" data-p="this_month" style="min-height:44px;padding:8px 16px;font-weight:700;">This Month</button>
          <button class="chip ${periodKey==="last_month"?"active":""}" data-p="last_month" style="min-height:44px;padding:8px 16px;font-weight:700;">Last Month</button>
          <button class="chip ${periodKey==="all"?"active":""}" data-p="all" style="min-height:44px;padding:8px 16px;font-weight:700;">All Time</button>
        </div>
      </div>
      <div class="pl-summary" id="ov-pl"></div>
      <div class="chart-grid">
        <div class="chart-card">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);">
            ${Icons.get("trending-up",{size:18})} Revenue Trend — Store vs Fuel
          </h3>
          <div style="position:relative;height:240px;width:100%;"><canvas id="ov-chart-trend"></canvas></div>
        </div>
        <div class="chart-card">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);">
            ${Icons.get("tag",{size:18})} Revenue vs Profit by Category
          </h3>
          <div style="position:relative;height:240px;width:100%;"><canvas id="ov-chart-category"></canvas></div>
        </div>
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);">${Icons.get("package",{size:18})} Top Selling Items — click a row for details</h3>
        <div id="ov-top-table"></div>
      </div>`;

    wrap.querySelectorAll("#ov-period-bar .chip").forEach(chip => {
      chip.onclick = () => {
        periodKey = chip.dataset.p;
        categoryFilter = null;
        refreshOverview();
      };
    });

    refreshOverview();
  }

  function refreshOverview(){
    const stats = Analytics.computeStats(periodKey);
    renderOverviewStats(stats);
    buildOverviewCharts(stats);
    renderTopSellersTable(stats);
    document.querySelectorAll("#ov-period-bar .chip").forEach(c => c.classList.toggle("active", c.dataset.p === periodKey));
  }

  // ---------------- shell ----------------
  function render(){
    const view = document.getElementById("view-root");
    const admin = Auth.isAdmin();
    if(!admin && tab === "overview") tab = "history";
    view.innerHTML = `
      <div class="view-head">
        <div><h2>${Icons.get("clipboard",{size:22})} Reports</h2><div class="view-sub">Sales history, analytics, and shift reconciliation</div></div>
        <div class="input-row" style="width:auto;">
          <button class="btn btn-ghost" id="btn-xreport">${Icons.get("clipboard",{size:15})} X Report</button>
          <button class="btn btn-danger" id="btn-zreport">${Icons.get("lock",{size:15})} Z Report</button>
        </div>
      </div>
      <div class="category-chips">
        ${admin ? `<div class="chip ${tab==="overview"?"active":""}" data-t="overview">${Icons.get("bar-chart",{size:13})}Overview</div>` : ""}
        <div class="chip ${tab==="history"?"active":""}" data-t="history">${Icons.get("cart",{size:13})}Store Sales</div>
        <div class="chip ${tab==="fuel"?"active":""}" data-t="fuel">${Icons.get("fuel",{size:13})}Fuel Sales</div>
        <div class="chip ${tab==="purchases"?"active":""}" data-t="purchases">${Icons.get("truck",{size:13})}Purchases & Restock</div>
        ${tab!=="overview" ? `<div class="chip ${todayOnly?"active":""}" id="toggle-today">${Icons.get("calendar",{size:13})}Today only</div>` : ""}
      </div>
      <div id="report-body" style="margin-top:14px;"></div>`;
    document.getElementById("btn-xreport").onclick = openXReport;
    document.getElementById("btn-zreport").onclick = openZReport;
    document.querySelectorAll("[data-t]").forEach(c=>c.onclick=()=>{ tab=c.dataset.t; render(); });
    document.getElementById("toggle-today")?.addEventListener("click", () => { todayOnly = !todayOnly; render(); });

    if(tab === "overview") renderOverview();
    else if(tab === "purchases") document.getElementById("report-body").innerHTML = purchasesTable();
    else{
      document.getElementById("report-body").innerHTML = tab==="history" ? historyTable() : fuelHistoryTable();
      document.querySelectorAll("[data-view-receipt]").forEach(b=>b.onclick=()=>{
        const s = DB.getSales().find(x=>x.id===b.dataset.viewReceipt);
        if(s) openReceiptModal(s);
      });
      document.querySelectorAll("[data-reprint]").forEach(b=>b.onclick=(e)=>{
        e.stopPropagation();
        const s = DB.getSales().find(x=>x.id===b.dataset.reprint);
        if(s) POS.printByRecord(s);
      });
    }
  }

  return { render };
})();
