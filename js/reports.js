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
  // (2026-07-13) Enhanced X & Z cashier shift reports; was basic count
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
    const gcashIn = pay["GCash"]||0;
    const cardIn = pay["Card"]||0;
    const expectedCash = (shift.openingCash || 0) + cashIn;
    const totalTransactions = store.length + fuel.length;
    return `
      <div class="card" style="margin-bottom:14px;background:var(--paper-dim);padding:14px 18px;border-radius:12px;">
        <div class="flex-between"><span class="text-sm text-faint" style="font-weight:700;">Shift Opened</span><strong>${Utils.fmtDate(shift.openedAt)}</strong></div>
        <div class="flex-between" style="margin-top:4px;"><span class="text-sm text-faint" style="font-weight:700;">Shift Opening Cash</span><strong class="mono">${Utils.money(shift.openingCash || 0)}</strong></div>
        <div class="flex-between" style="margin-top:4px;"><span class="text-sm text-faint" style="font-weight:700;">Total Transactions</span><strong>${totalTransactions} total (${store.length} store · ${fuel.length} fuel)</strong></div>
      </div>
      <div class="grid-3" style="margin-bottom:14px;gap:10px;">
        <div class="card card-tight" style="padding:10px 14px;"><div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Cash Inflow</div><div class="mono font-bold" style="font-size:1.25rem;color:var(--brand-deep);">${Utils.money(cashIn)}</div></div>
        <div class="card card-tight" style="padding:10px 14px;"><div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">GCash / Digital</div><div class="mono font-bold" style="font-size:1.25rem;color:var(--brand);">${Utils.money(gcashIn)}</div></div>
        <div class="card card-tight" style="padding:10px 14px;"><div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Current Drawer Cash</div><div class="mono font-bold" style="font-size:1.25rem;color:var(--success-deep);">${Utils.money(expectedCash)}</div></div>
      </div>
      <h3 style="margin-bottom:8px;font-size:.95rem;">Payment Method Breakdown</h3>
      <div class="table-wrap" style="margin-bottom:14px;"><table class="data"><tbody>
        ${Object.entries(pay).map(([m,v])=>`<tr><td><strong>${m}</strong></td><td style="text-align:right;" class="mono font-bold">${Utils.money(v)}</td></tr>`).join("") || `<tr><td colspan="2" class="text-faint">No sales recorded during this shift window.</td></tr>`}
        <tr style="font-weight:900;background:var(--paper-dim);"><td>Total Revenue (Store + Fuel)</td><td style="text-align:right;" class="mono" style="color:var(--brand);">${Utils.money(storeTotal+fuelTotal)}</td></tr>
      </tbody></table></div>
      ${closing ? `
      <div class="card surface-dim" style="border:1.5px solid var(--danger);">
        <div class="field"><label>Expected Cash in Drawer (Opening Cash + Cash Sales)</label><input class="input mono font-bold" value="${expectedCash.toFixed(2)}" disabled style="font-size:1.15rem;"></div>
        <div class="field" style="margin-top:10px;"><label>Actual Cash Counted in Drawer</label><input class="input mono font-bold" id="actual-cash" type="number" step="0.01" placeholder="Enter counted physical cash" autofocus style="font-size:1.25rem;"></div>
        <div class="flex-between" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:1.1rem;"><span style="font-weight:700;">Cash Over / Short Discrepancy</span><strong id="cash-variance" class="mono" style="font-size:1.4rem;">₱0.00</strong></div>
      </div>` : ""}`;
  }
  function openXReport(){
    Modal.open({ title:`${Icons.get("clipboard",{size:17})} X Report (Mid-Shift Snapshot)`, body: shiftReportHTML(false), wide:true, actions:[{label:"Close",cls:"btn-ghost"}] });
  }
  function openZReport(){
    const modal = Modal.open({
      title:`${Icons.get("lock",{size:17})} Z Report (End-of-Shift Reset & Drawer Lock)`, body: shiftReportHTML(true), wide:true,
      actions:[{label:"Cancel",cls:"btn-ghost"},{label:"Lock Drawer & Close Shift",cls:"btn-danger font-bold", onClick:()=>closeShift(modal)}]
    });
    const actual = modal.querySelector("#actual-cash");
    const { store, fuel } = shiftSales();
    const shift = DB.getShift();
    const cashIn = paymentTotals(store, fuel)["Cash"]||0;
    const expected = (shift.openingCash || 0) + cashIn;
    actual.addEventListener("input", () => {
      const variance = Number(actual.value||0) - expected;
      const el = modal.querySelector("#cash-variance");
      el.textContent = `${variance >= 0 ? "+" : ""}${Utils.money(variance)}`;
      el.style.color = variance < 0 ? "var(--danger)" : variance > 0 ? "var(--warning-deep)" : "var(--success-deep)";
    });
  }
  function closeShift(modal){
    Modal.confirm({
      title:"Close and Reset Shift?",
      message:"This archives the current shift, locks the drawer, and resets shift sales counters. Sales history remains safely in database.",
      danger: true,
      onConfirm: () => {
        const actual = document.querySelector("#actual-cash")?.value;
        DB.setShift({ openedAt: Date.now(), openingCash: Number(actual)||0, closedAt: Date.now() });
        Modal.close();
        Utils.toast("Shift archived and reset successfully.", "success");
        render();
      }
    });
  }

  // (2026-07-13) Shared TXN ID formatter; was inline per-call, inconsistent
  function fmtTxnId(id){ const c=(id||"").replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(-8); return `TXN-${c||"00000000"}`; }

  // (2026-07-13) Copiable clean TXN ID pill with copy feedback; was static text
  function openReceiptModal(sale){
    if(!sale) return;
    const settings = DB.getSettings();
    const txnId = fmtTxnId(sale.id);
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

    // (2026-07-13) Edit sale, void logs & restock rollbacks for Admin; was delete only
    const actions = [
      { label: "Close", cls: "btn-ghost btn-lg", onClick: Modal.close }
    ];
    if(Auth.isAdmin()){
      actions.push({ label: "Edit Sale", cls: "btn-outline btn-lg", onClick: () => { Modal.close(); openEditSaleModal(sale); } });
      actions.push({ label: "Delete Sale", cls: "btn-danger btn-lg", onClick: () => { Modal.close(); deleteSaleRecord(sale.id); } });
    }
    actions.push({ label: "Print Receipt", cls: "btn-primary btn-lg", onClick: () => { POS.printByRecord(sale); } });

    const modal = Modal.open({
      title: `${Icons.get("receipt",{size:18})} Receipt & Transaction Details`,
      body,
      wide: true,
      actions
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

  function openEditSaleModal(sale){
    if(!Auth.isAdmin()){ Utils.toast("Admin access required.", "warn"); return; }
    let items = JSON.parse(JSON.stringify(sale.items || []));
    const renderEditRows = () => {
      const tbody = modal.querySelector("#edit-sale-items-tbody");
      if(!tbody) return;
      tbody.innerHTML = items.map((l, idx) => `
        <tr>
          <td><strong>${Utils.escapeHtml(l.name)}</strong></td>
          <td><input type="number" class="input mono font-bold" data-idx="${idx}" data-field="qty" value="${l.qty}" min="1" step="1" style="width:70px;padding:4px 8px;"></td>
          <td><input type="number" class="input mono" data-idx="${idx}" data-field="price" value="${l.price}" min="0" step="0.01" style="width:90px;padding:4px 8px;"></td>
          <td class="mono font-bold" style="text-align:right;">${Utils.money(l.qty * l.price)}</td>
          <td style="text-align:right;"><button class="btn btn-sm btn-ghost" data-del-line="${idx}" style="color:var(--danger);">${Icons.get("trash",{size:13})}</button></td>
        </tr>
      `).join("");
      const sub = items.reduce((s,x)=>s + (x.price * x.qty), 0);
      modal.querySelector("#edit-sale-subtotal").textContent = Utils.money(sub);
      const diff = sub - sale.total;
      const diffEl = modal.querySelector("#edit-sale-diff");
      diffEl.textContent = `${diff >= 0 ? "+" : ""}${Utils.money(diff)}`;
      diffEl.style.color = diff < 0 ? "var(--danger)" : diff > 0 ? "var(--success-deep)" : "var(--ink-faint)";
    };

    const body = `
      <div class="card card-tight" style="margin-bottom:12px;background:var(--paper-dim);padding:10px 14px;">
        <div class="flex-between"><span>Original Transaction ID</span><strong class="mono">${Utils.escapeHtml(sale.id)}</strong></div>
        <div class="flex-between" style="margin-top:4px;"><span>Original Total</span><strong class="mono">${Utils.money(sale.total)}</strong></div>
      </div>
      <div class="table-wrap" style="max-height:220px;overflow-y:auto;margin-bottom:12px;">
        <table class="data">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th style="text-align:right;">Total</th><th></th></tr></thead>
          <tbody id="edit-sale-items-tbody"></tbody>
        </table>
      </div>
      <div class="field"><label>Admin Alteration / Void Reason</label><input class="input" id="edit-sale-reason" placeholder="e.g. Cashier error, returned item, pricing adjustment" value="Post-sale cashier correction"></div>
      <div class="card" style="padding:10px 14px;background:var(--paper-raised);margin-top:10px;">
        <div class="flex-between"><span>New Total</span><strong class="mono font-bold" id="edit-sale-subtotal">${Utils.money(sale.total)}</strong></div>
        <div class="flex-between" style="margin-top:4px;"><span>Net Price Difference</span><strong class="mono" id="edit-sale-diff">₱0.00</strong></div>
      </div>`;

    const modal = Modal.open({
      title: `${Icons.get("edit",{size:17})} Alter Completed Transaction (${Utils.escapeHtml(sale.id)})`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: "Save Alteration & Log Audit", cls: "btn-primary font-bold", onClick: () => {
          if(!items.length){ Utils.toast("Transaction cannot be empty. Delete it instead to void entirely.", "warn"); return; }
          const reason = modal.querySelector("#edit-sale-reason")?.value.trim() || "Admin alteration";
          const newTotal = items.reduce((s,x)=>s + (x.price * x.qty), 0);
          const priceDiff = newTotal - sale.total;
          DB.addVoidLog({
            origTxnId: sale.id,
            itemSummary: items.map(l=>`${l.qty}x ${l.name}`).join(", "),
            priceDiff,
            reason,
            admin: Auth.currentUser()?.name || "Admin"
          });
          const sales = DB.getSales();
          const idx = sales.findIndex(x => x.id === sale.id);
          if(idx !== -1){
            sales[idx].items = items;
            sales[idx].subtotal = newTotal;
            sales[idx].total = newTotal;
            sales[idx].alteredAt = Date.now();
            sales[idx].alteredBy = Auth.currentUser()?.name || "Admin";
            DB.setSales(sales);
          }
          Utils.toast("Transaction updated & logged to Void Audit.", "success");
          Modal.close();
          render();
        }}
      ]
    });

    modal.querySelector("#edit-sale-items-tbody").addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      if(items[idx]){
        items[idx][field] = Math.max(0, Number(e.target.value) || 0);
        renderEditRows();
      }
    });

    modal.querySelector("#edit-sale-items-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-line]");
      if(btn){
        const idx = Number(btn.dataset.delLine);
        items.splice(idx, 1);
        renderEditRows();
      }
    });

    renderEditRows();
  }

  function openEditRestockModal(log){
    const body = `
      <div class="field"><label>Product Name</label><input class="input font-bold" id="erstk-name" value="${Utils.escapeHtml(log.product_name || log.productName || "")}" disabled></div>
      <div class="grid-2" style="gap:10px;margin-top:10px;">
        <div class="field"><label>Quantity Added</label><input class="input mono font-bold" id="erstk-qty" type="number" step="1" value="${log.quantity_added || log.quantity || 0}"></div>
        <div class="field"><label>Unit Cost (₱)</label><input class="input mono font-bold" id="erstk-cost" type="number" step="0.01" value="${log.unit_cost || log.unitCost || 0}"></div>
      </div>
      <div class="field" style="margin-top:10px;"><label>Supplier Name</label><input class="input" id="erstk-supplier" value="${Utils.escapeHtml(log.supplier_name || log.supplierName || "")}"></div>`;

    Modal.open({
      title: `${Icons.get("edit",{size:17})} Edit Restock Record`,
      body,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: "Save & Adjust Stock", cls: "btn-primary font-bold", onClick: () => {
          const qty = Number(document.getElementById("erstk-qty").value)||0;
          const cost = Number(document.getElementById("erstk-cost").value)||0;
          const supplier = document.getElementById("erstk-supplier").value.trim();
          DB.updateRestockLog(log.id, { quantity_added: qty, unit_cost: cost, supplier_name: supplier });
          Utils.toast("Restock record updated & inventory adjusted.", "success");
          Modal.close();
          render();
        }}
      ]
    });
  }

  function deleteRestockLogConfirm(log){
    Modal.confirm({
      title: "Delete Restock Record?",
      message: `Delete restock entry for ${log.product_name || log.productName} (+${log.quantity_added||0} pcs)? This will automatically roll back ${log.quantity_added||0} pcs from current inventory stock.`,
      danger: true,
      onConfirm: () => {
        DB.deleteRestockLog(log.id);
        Utils.toast("Restock log deleted & stock rolled back.", "success");
        render();
      }
    });
  }

  // (2026-07-13) Delete store & fuel sale records with confirmation. Prev: view only
  function deleteSaleRecord(saleId){
    const sale = DB.getSales().find(x => x.id === saleId);
    if(!sale) return;
    Modal.confirm({
      title: "Delete Sale Record?",
      message: `Delete transaction ${sale.receiptNo || sale.id} (${Utils.money(sale.total)})? This will log a complete transaction void.`,
      danger: true,
      onConfirm: () => {
        DB.addVoidLog({
          origTxnId: sale.id,
          itemSummary: (sale.items || []).map(l=>`${l.qty}x ${l.name}`).join(", ") || "Complete transaction void",
          priceDiff: -sale.total,
          reason: "Complete Transaction Deletion/Void",
          admin: Auth.currentUser()?.name || "Admin"
        });
        DB.setSales(DB.getSales().filter(x => x.id !== saleId));
        Utils.toast("Sale record deleted & logged to Void Audit.", "success");
        render();
      }
    });
  }

  // (2026-07-13) Log fuel sale deletions to void audit log; was silent delete
  function deleteFuelSaleRecord(fuelId){
    const sale = DB.getFuelSales().find(x => x.id === fuelId);
    if(!sale) return;
    Modal.confirm({
      title: "Delete Fuel Sale?",
      message: `Delete fuel sale ${sale.pumpLabel || ""} (${Utils.money(sale.amount)})? This will log a void record.`,
      danger: true,
      onConfirm: () => {
        DB.addVoidLog({
          origTxnId: sale.id || fuelId,
          itemSummary: `${sale.pumpLabel || "Pump"} · ${sale.fuelName || "Fuel"} (${sale.liters?.toFixed(2)||0} L)`,
          priceDiff: -sale.amount,
          reason: "Fuel Sale Deletion/Void",
          admin: Auth.currentUser()?.name || "Admin"
        });
        DB.setFuelSales(DB.getFuelSales().filter(x => x.id !== fuelId));
        Utils.toast("Fuel sale record deleted & logged to Void Audit.", "success");
        render();
      }
    });
  }

  const PERIOD_FILTERS = [
    ["today", "Today"],
    ["this_week", "This Week"],
    ["last_week", "Last Week"],
    ["this_month", "This Month"],
    ["last_month", "Last Month"],
    ["last_3m", "Last 3 Months"],
    ["last_6m", "Last 6 Months"],
    ["this_year", "This Year"],
    ["last_year", "Last Year"],
    ["all", "All Time"]
  ];

  function timeframeBarHtml(activeKey){
    return `
      <div class="date-range-bar" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;overflow-x:auto;padding-bottom:2px;">
        ${PERIOD_FILTERS.map(([k, lbl]) => `
          <button class="chip ${activeKey === k ? "active" : ""}" data-period="${k}" style="padding:5px 12px;font-size:var(--fs-xs);font-weight:700;cursor:pointer;">${lbl}</button>
        `).join("")}
      </div>`;
  }

  // ---------------- plain history tables ----------------
  function historyTable(){
    const r = Analytics.getPeriodRange(periodKey);
    let sales = DB.getSales().filter(s => s.ts >= r.start && s.ts <= r.end);
    return `
      ${timeframeBarHtml(periodKey)}
      ${sales.length ? `
        <div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Txn ID</th><th>Items</th><th>Total</th><th>Method</th><th>Cashier</th><th style="text-align:right;">Actions</th></tr></thead><tbody>
        ${sales.map(s => `<tr>
          <td style="cursor:pointer;" data-view-receipt="${s.id}">${Utils.fmtDate(s.ts)}</td>
          <td class="mono font-bold" style="cursor:pointer;" data-view-receipt="${s.id}">${fmtTxnId(s.id)}</td>
          <td style="cursor:pointer;" data-view-receipt="${s.id}"><button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:var(--fs-xs);">${Icons.get("receipt",{size:12})} ${s.items.length} item(s)</button></td>
          <td class="mono font-bold" style="cursor:pointer;" data-view-receipt="${s.id}">${Utils.money(s.total)}</td>
          <td style="cursor:pointer;" data-view-receipt="${s.id}"><span class="badge badge-neutral">${s.method}</span></td>
          <td style="cursor:pointer;" data-view-receipt="${s.id}">${s.cashier || "Cashier"}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button class="btn btn-sm btn-outline" data-view-receipt="${s.id}">${Icons.get("receipt",{size:13})} View</button>
            ${Auth.isAdmin() ? `<button class="btn btn-sm btn-ghost" data-edit-sale-row="${s.id}" style="margin-left:4px;" title="Edit Sale">${Icons.get("edit",{size:13})}</button>` : ""}
            <button class="btn btn-sm btn-ghost" data-reprint="${s.id}" style="margin-left:4px;">${Icons.get("printer",{size:13})}</button>
            ${Auth.isAdmin() ? `<button class="btn btn-sm btn-ghost" data-delete-sale="${s.id}" style="margin-left:4px;color:var(--danger);" title="Delete Sale">${Icons.get("trash",{size:13})}</button>` : ""}
          </td>
        </tr>`).join("")}
        </tbody></table></div>` : `<div class="empty">${Icons.get("receipt",{size:34})}<h3>No sales in ${r.label}</h3></div>`
      }`;
  }

  function fuelHistoryTable(){
    const r = Analytics.getPeriodRange(periodKey);
    let sales = DB.getFuelSales().filter(s => s.ts >= r.start && s.ts <= r.end);
    return `
      ${timeframeBarHtml(periodKey)}
      ${sales.length ? `
        <div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Txn ID</th><th>Pump</th><th>Fuel</th><th>Liters</th><th>Total</th><th>Method</th><th>Attendant</th><th style="text-align:right;">Actions</th></tr></thead><tbody>
        ${sales.map(s => `<tr>
          <td>${Utils.fmtDate(s.ts)}</td>
          <td class="mono font-bold">${fmtTxnId(s.id)}</td>
          <td>${s.pumpLabel}</td>
          <td>${s.fuelName}</td>
          <td class="mono">${s.liters.toFixed(2)} L</td>
          <td class="mono font-bold">${Utils.money(s.amount)}</td>
          <td>${s.method}</td>
          <td>${s.cashier}</td>
          <td style="text-align:right;">
            ${Auth.isAdmin() ? `<button class="btn btn-sm btn-ghost" data-delete-fuel-sale="${s.id}" style="color:var(--danger);" title="Delete Fuel Sale">${Icons.get("trash",{size:13})}</button>` : ""}
          </td>
        </tr>`).join("")}
        </tbody></table></div>` : `<div class="empty">${Icons.get("fuel",{size:34})}<h3>No fuel sales in ${r.label}</h3></div>`
      }`;
  }

  function purchasesTable(){
    const r = Analytics.getPeriodRange(periodKey);
    const summary = Analytics.restockSummary(periodKey);
    return `
      ${timeframeBarHtml(periodKey)}
      <div class="grid-3" style="margin-bottom:14px;gap:10px;">
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
        <thead><tr><th>Time</th><th>Product</th><th>Supplier</th><th>Qty Added</th><th>Unit Cost</th><th>Total Cost</th><th style="text-align:right;">Actions</th></tr></thead>
        <tbody>
          ${summary.logs.length ? summary.logs.map(l => `
            <tr>
              <td class="text-sm text-faint">${Utils.fmtDate(l.timestamp||l.ts)}</td>
              <td><strong>${Utils.escapeHtml(l.product_name||l.productName)}</strong></td>
              <td class="text-sm text-faint">${Utils.escapeHtml(l.supplier_name||l.supplierName||"—")}</td>
              <td class="mono font-bold">+${l.quantity_added||l.quantity}</td>
              <td class="mono">${Utils.money(l.unit_cost||l.unitCost||0)}</td>
              <td class="mono font-bold" style="color:var(--brand-deep);">${Utils.money(l.total_cost||0)}</td>
              <td style="text-align:right;white-space:nowrap;">
                ${Auth.isAdmin() ? `
                  <button class="btn btn-sm btn-ghost" data-edit-restock="${l.id}" title="Edit restock log">${Icons.get("edit",{size:13})}</button>
                  <button class="btn btn-sm btn-ghost" data-delete-restock="${l.id}" style="color:var(--danger);" title="Delete and roll back stock">${Icons.get("trash",{size:13})}</button>
                ` : "—"}
              </td>
            </tr>`).join("") : `<tr><td colspan="7" class="text-faint text-center" style="padding:24px;">No purchase/restock records found in ${r.label}.</td></tr>`
          }
        </tbody>
      </table></div>`;
  }

  function voidLogsCard(){
    const logs = DB.getVoidLogs ? DB.getVoidLogs() : [];
    return `
      <div class="card" style="margin-top:16px;">
        <div class="flex-between" style="margin-bottom:10px;">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--danger-deep);">
            ${Icons.get("alert-triangle",{size:18})} Voided & Altered Items Audit Log (${logs.length})
          </h3>
        </div>
        ${logs.length ? `
          <div class="table-wrap" style="max-height:240px;overflow-y:auto;">
            <table class="data">
              <thead><tr><th>Time</th><th>Txn ID</th><th>Items Altered</th><th>Price Diff</th><th>Admin</th><th>Reason</th></tr></thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td class="text-sm text-faint">${Utils.fmtDate(l.ts)}</td>
                    <td class="mono font-bold">${Utils.escapeHtml(l.origTxnId)}</td>
                    <td style="max-width:240px;">${Utils.escapeHtml(l.itemSummary)}</td>
                    <td class="mono font-bold" style="color:${l.priceDiff < 0 ? "var(--danger)" : l.priceDiff > 0 ? "var(--success-deep)" : "var(--ink)"};">${l.priceDiff >= 0 ? "+" : ""}${Utils.money(l.priceDiff)}</td>
                    <td>${Utils.escapeHtml(l.admin || "Admin")}</td>
                    <td class="text-sm text-faint">${Utils.escapeHtml(l.reason)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <p class="text-sm text-faint" style="margin:0;padding:12px 0;">No altered or voided items recorded. All transactions are intact.</p>
        `}
      </div>`;
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
      <div class="pl-card ${c.hero?"hero":""} ${c.big?"big":""}">
        <div class="lbl">${c.lbl}</div>
        <div class="val mono ${c.neg?"neg":""}">${c.isPct ? `${c.val.toFixed(1)}%` : Utils.money(c.val)}</div>
      </div>`).join("");
  }

  function renderTopSellersTable(stats){
    const el = document.getElementById("ov-top-table");
    if(!el) return;
    const top = stats.topSellers;
    el.innerHTML = top.length ? `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>#</th><th>Product</th><th>Category</th><th>Units</th><th>Revenue</th><th>Profit</th></tr></thead>
        <tbody>
          ${top.slice(0, 15).map((r, i) => `
            <tr class="clickable-row" data-top-prod="${r.productId}">
              <td class="text-faint">${i+1}</td>
              <td><strong>${Utils.escapeHtml(r.name)}</strong></td>
              <td><span class="badge badge-brand">${Utils.escapeHtml(r.category)}</span></td>
              <td class="mono">${r.units}</td>
              <td class="mono font-bold">${Utils.money(r.revenue)}</td>
              <td class="mono" style="color:var(--success-deep);">${Utils.money(r.profit)}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>` : `<div class="empty">${Icons.get("package",{size:28})}<h3>No sales in this period</h3></div>`;
    el.querySelectorAll("[data-top-prod]").forEach(row => {
      row.onclick = () => {
        const item = top.find(x => x.productId === row.dataset.topProd);
        if(item) openProductDrilldown(item, stats);
      };
    });
  }

  function buildOverviewCharts(stats){
    destroyOverviewCharts();
    const trendCtx = document.getElementById("ov-chart-trend")?.getContext("2d");
    if(trendCtx && typeof Chart !== "undefined"){
      const trendData = stats.trend;
      overviewCharts.trend = new Chart(trendCtx, {
        type: "line",
        data: {
          labels: trendData.labels,
          datasets: [
            { label: "Store", data: trendData.store, borderColor: "#4F46E5", backgroundColor: "rgba(79,70,229,0.1)", fill: true, tension: 0.3 },
            { label: "Fuel", data: trendData.fuel, borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.1)", fill: true, tension: 0.3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "top" } },
          onClick: (e, elements) => {
            if(elements.length > 0){
              const idx = elements[0].index;
              const dayStart = trendData.timestamps ? trendData.timestamps[idx] : null;
              if(dayStart) openDayDrilldown(dayStart);
            }
          }
        }
      });
    }

    const catCtx = document.getElementById("ov-chart-category")?.getContext("2d");
    if(catCtx && typeof Chart !== "undefined"){
      const cats = stats.categoryBreakdown || [];
      overviewCharts.category = new Chart(catCtx, {
        type: "bar",
        data: {
          labels: cats.map(c => c.category),
          datasets: [
            { label: "Revenue", data: cats.map(c => c.revenue), backgroundColor: "#4F46E5" },
            { label: "Profit", data: cats.map(c => c.profit), backgroundColor: "#10B981" }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } }
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
        ${timeframeBarHtml(periodKey)}
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
        <h3 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);">${Icons.get("package",{size:18})} Top Selling Items</h3>
        <div id="ov-top-table"></div>
      </div>
      ${voidLogsCard()}`;

    wrap.querySelectorAll("[data-period]").forEach(chip => {
      chip.onclick = () => {
        periodKey = chip.dataset.period;
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
    document.querySelectorAll("[data-period]").forEach(c => c.classList.toggle("active", c.dataset.period === periodKey));
  }

  // ---------------- shell ----------------
  function render(){
    const view = document.getElementById("view-root");
    const admin = Auth.isAdmin();
    if(!admin && tab === "overview") tab = "history";
    // (2026-07-13) Make reports view scrollable with view-body container; was fixed height
    view.innerHTML = `
      <div class="view-body" style="overflow-y:auto;flex:1;min-height:0;padding-bottom:6rem;-webkit-overflow-scrolling:touch;">
        <div class="view-head">
          <div><h2>${Icons.get("clipboard",{size:22})} Reports</h2><div class="view-sub">Sales history, analytics, shift reconciliation & void audit</div></div>
          <div class="input-row" style="width:auto;">
            <button class="btn btn-ghost" id="btn-xreport">${Icons.get("clipboard",{size:15})} X Report</button>
            <button class="btn btn-danger" id="btn-zreport">${Icons.get("lock",{size:15})} Z Report</button>
          </div>
        </div>
        <div class="category-chips" style="margin-bottom:14px;">
          ${admin ? `<div class="chip ${tab==="overview"?"active":""}" data-t="overview">${Icons.get("bar-chart",{size:13})}Overview</div>` : ""}
          <div class="chip ${tab==="history"?"active":""}" data-t="history">${Icons.get("cart",{size:13})}Store Sales</div>
          <div class="chip ${tab==="fuel"?"active":""}" data-t="fuel">${Icons.get("fuel",{size:13})}Fuel Sales</div>
          <div class="chip ${tab==="purchases"?"active":""}" data-t="purchases">${Icons.get("truck",{size:13})}Purchases & Restock</div>
          ${admin ? `<div class="chip ${tab==="voids"?"active":""}" data-t="voids">${Icons.get("alert-triangle",{size:13})}Void & Deletions Audit</div>` : ""}
        </div>
        <div id="report-body"></div>
      </div>`;
    document.getElementById("btn-xreport").onclick = openXReport;
    document.getElementById("btn-zreport").onclick = openZReport;
    document.querySelectorAll("[data-t]").forEach(c=>c.onclick=()=>{ tab=c.dataset.t; render(); });

    if(tab === "overview") renderOverview();
    else if(tab === "voids"){
      document.getElementById("report-body").innerHTML = voidLogsCard();
    } else if(tab === "purchases"){
      document.getElementById("report-body").innerHTML = purchasesTable();
      document.querySelectorAll("[data-period]").forEach(chip => {
        chip.onclick = () => { periodKey = chip.dataset.period; render(); };
      });
      document.querySelectorAll("[data-edit-restock]").forEach(b => {
        b.onclick = () => {
          const l = DB.getRestockLogs().find(x => x.id === b.dataset.editRestock);
          if(l) openEditRestockModal(l);
        };
      });
      document.querySelectorAll("[data-delete-restock]").forEach(b => {
        b.onclick = () => {
          const l = DB.getRestockLogs().find(x => x.id === b.dataset.deleteRestock);
          if(l) deleteRestockLogConfirm(l);
        };
      });
    } else {
      document.getElementById("report-body").innerHTML = tab==="history" ? historyTable() : fuelHistoryTable();
      document.querySelectorAll("[data-period]").forEach(chip => {
        chip.onclick = () => { periodKey = chip.dataset.period; render(); };
      });
      document.querySelectorAll("[data-view-receipt]").forEach(b=>b.onclick=()=>{
        const s = DB.getSales().find(x=>x.id===b.dataset.viewReceipt);
        if(s) openReceiptModal(s);
      });
      document.querySelectorAll("[data-edit-sale-row]").forEach(b=>b.onclick=(e)=>{
        e.stopPropagation();
        const s = DB.getSales().find(x=>x.id===b.dataset.editSaleRow);
        if(s) openEditSaleModal(s);
      });
      document.querySelectorAll("[data-reprint]").forEach(b=>b.onclick=(e)=>{
        e.stopPropagation();
        const s = DB.getSales().find(x=>x.id===b.dataset.reprint);
        if(s) POS.printByRecord(s);
      });
      document.querySelectorAll("[data-delete-sale]").forEach(b=>b.onclick=(e)=>{
        e.stopPropagation();
        deleteSaleRecord(b.dataset.deleteSale);
      });
      document.querySelectorAll("[data-delete-fuel-sale]").forEach(b=>b.onclick=(e)=>{
        e.stopPropagation();
        deleteFuelSaleRecord(b.dataset.deleteFuelSale);
      });
    }
  }

  return { render };
})();
