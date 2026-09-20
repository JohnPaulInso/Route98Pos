// ============================================================
// reports.js — X / Z shift reports, sales history browser, and
// (admin-only) a detailed clickable Overview dashboard.
// ============================================================
const Reports = (() => {
  // (2026-07-13) Set All Time as default period filter in reports; was this_week
  let tab = "overview"; // overview | history | fuel
  let todayOnly = false;
  let periodKey = "all";
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
        // (2026-07-13) Auto-create daily backup on shift close; was unbacked
        if(typeof Sync !== "undefined" && Sync.createDailyBackup){
          Sync.createDailyBackup("automatic_daily");
        }
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
        // (2026-07-13) Restore item stock on sale deletion; was deleted without restore
        const products = DB.getProducts();
        (sale.items || []).forEach(line => {
          if(line.isCustom) return;
          const p = products.find(x => x.id === line.productId);
          if(p){
            const pieces = (line.unitType === "pack" && p.piecesPerPack > 1) ? (line.qty * p.piecesPerPack) : line.qty;
            p.stock = Utils.round2(p.stock + pieces);
          }
        });
        DB.setProducts(products);
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

  // (2026-07-13) Place All Time first before Today; was last in list
  const PERIOD_FILTERS = [
    ["all", "All Time"],
    ["today", "Today"],
    ["this_week", "This Week"],
    ["last_week", "Last Week"],
    ["this_month", "This Month"],
    ["last_month", "Last Month"],
    ["last_3m", "Last 3 Months"],
    ["last_6m", "Last 6 Months"],
    ["this_year", "This Year"],
    ["last_year", "Last Year"]
  ];

  // (2026-07-13) Add Loyverse date/time/staff report filters; was static chips
  let activeRange = null;
  let timeFilter = "all";
  let employeeFilter = "all";

  function getActiveRange(){
    if(activeRange) return activeRange;
    return Analytics.getPeriodRange(periodKey);
  }

  function fmtDateRangeLabel(r){
    const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString("en-PH", { month: "short" })} ${d.getFullYear()}`;
    if(!r || r.key === "all" || r.start <= 86400000){
      const sales = DB.getSales ? DB.getSales() : [];
      const fuel = DB.getFuelSales ? DB.getFuelSales() : [];
      const allTs = [...sales, ...fuel].map(x => x.ts).filter(Boolean);
      const minTs = allTs.length ? Math.min(...allTs) : new Date(new Date().getFullYear(), 5, 1).getTime();
      return `${fmt(new Date(minTs))} - ${fmt(new Date())}`;
    }
    const dStart = new Date(r.start);
    const dEnd = new Date(r.end);
    if(fmt(dStart) === fmt(dEnd)){
      return fmt(dStart);
    }
    return `${fmt(dStart)} - ${fmt(dEnd)}`;
  }

  function matchTimeFilter(ts){
    if(timeFilter === "all") return true;
    const d = new Date(ts);
    const min = d.getHours() * 60 + d.getMinutes();
    if(timeFilter === "morning") return min >= 6 * 60 && min < 14 * 60;
    if(timeFilter === "afternoon") return min >= 14 * 60 && min < 22 * 60;
    if(timeFilter === "night") return min >= 22 * 60 || min < 6 * 60;
    return true;
  }

  function matchEmployeeFilter(record){
    if(employeeFilter === "all") return true;
    const emp = record.cashier || record.attendant || record.cashierName || "Admin";
    return emp.toLowerCase() === employeeFilter.toLowerCase();
  }

  function getReportFilterFn(){
    return (s) => matchTimeFilter(s.ts) && matchEmployeeFilter(s);
  }

  function shiftPeriod(dir){
    const r = getActiveRange();
    let { start, end, key } = r;
    const oneDay = 86400000;
    if(key === "all" || start <= oneDay){
      const cur = new Date();
      const s = new Date(cur.getFullYear(), cur.getMonth() + dir, 1, 0, 0, 0, 0).getTime();
      const e = new Date(cur.getFullYear(), cur.getMonth() + dir + 1, 0, 23, 59, 59, 999).getTime();
      start = s; end = e;
    } else {
      const dur = end - start;
      if(dur <= oneDay + 1000){
        start = start + dir * oneDay;
        end = end + dir * oneDay;
      } else if(dur <= 7 * oneDay + 1000){
        start = start + dir * 7 * oneDay;
        end = end + dir * 7 * oneDay;
      } else {
        const dStart = new Date(start);
        const dEnd = new Date(end);
        if(dStart.getDate() === 1 && new Date(dEnd.getTime() + 1000).getDate() === 1){
          const newStart = new Date(dStart.getFullYear(), dStart.getMonth() + dir, 1, 0, 0, 0, 0);
          const newEnd = new Date(dStart.getFullYear(), dStart.getMonth() + dir + 1, 0, 23, 59, 59, 999);
          start = newStart.getTime();
          end = newEnd.getTime();
        } else {
          start = start + dir * (dur + 1);
          end = end + dir * (dur + 1);
        }
      }
    }
    const label = fmtDateRangeLabel({ start, end });
    const subtitle = `${new Date(start).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} – ${new Date(end).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`;
    activeRange = { start, end, key: "custom", label, subtitle };
    periodKey = "custom";
    render();
  }

  // (2026-07-13) Match Loyverse custom date range picker; was basic inputs
  function openDatePickerModal(){
    const r = getActiveRange();
    const oneDay = 86400000;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let tempStart = (r.start && r.start > oneDay) ? new Date(r.start).setHours(0,0,0,0) : new Date(now.getFullYear(), 5, 1).getTime();
    let tempEnd = (r.end && r.end < Date.now() + oneDay * 365) ? new Date(r.end).setHours(0,0,0,0) : todayStart;
    if(tempStart > tempEnd) tempStart = tempEnd;

    let viewMonth = new Date(tempEnd).getMonth();
    let viewYear = new Date(tempEnd).getFullYear();
    let selPhase = "done";

    const fmtDDMM = (ts) => {
      const d = new Date(ts);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    };

    const parseDDMM = (str) => {
      const parts = str.trim().split(/[\/\-\.]/);
      if(parts.length !== 3) return null;
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if(isNaN(day) || isNaN(month) || isNaN(year)) return null;
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    const modal = Modal.open({
      title: "",
      body: `
        <div class="loy-picker-wrap">
          <div class="loy-cal-panel">
            <div class="loy-cal-header">
              <button class="loy-cal-nav" id="loy-prev-month" type="button">${Icons.get("chevron-left", {size:16})}</button>
              <div class="loy-cal-title" id="loy-month-title"></div>
              <button class="loy-cal-nav" id="loy-next-month" type="button">${Icons.get("chevron-right", {size:16})}</button>
            </div>
            <div class="loy-cal-weekdays">
              <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
            </div>
            <div class="loy-cal-grid" id="loy-days-grid"></div>
            <div class="loy-cal-inputs">
              <div class="loy-cal-input-wrap">
                <label>Start date</label>
                <input type="text" id="loy-start-input" placeholder="DD/MM/YYYY">
              </div>
              <div class="loy-cal-input-wrap">
                <label>End date</label>
                <input type="text" id="loy-end-input" placeholder="DD/MM/YYYY">
              </div>
            </div>
          </div>
          <div class="loy-presets-panel">
            <button class="loy-preset-btn" type="button" data-loy-preset="today">Today</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="yesterday">Yesterday</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="this_week">This week</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="last_week">Last week</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="this_month">This month</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="last_month">Last month</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="last_7d">Last 7 days</button>
            <button class="loy-preset-btn" type="button" data-loy-preset="last_30d">Last 30 days</button>
          </div>
        </div>
        <div class="loy-picker-footer">
          <button class="loy-btn-cancel" id="loy-cancel-btn" type="button">CANCEL</button>
          <button class="loy-btn-done" id="loy-done-btn" type="button">DONE</button>
        </div>
      `
    });
    modal.querySelector(".modal")?.classList.add("modal-loy-dialog");

    function renderGrid(){
      const titleEl = modal.querySelector("#loy-month-title");
      const gridEl = modal.querySelector("#loy-days-grid");
      const startInp = modal.querySelector("#loy-start-input");
      const endInp = modal.querySelector("#loy-end-input");
      const nextBtn = modal.querySelector("#loy-next-month");

      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      titleEl.textContent = `${monthNames[viewMonth]} ${viewYear}`;

      if(viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())){
        nextBtn.style.visibility = "hidden";
      } else {
        nextBtn.style.visibility = "visible";
      }

      startInp.value = fmtDDMM(tempStart);
      endInp.value = fmtDDMM(tempEnd);

      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

      let html = "";
      let cellIdx = 0;

      for(let i = firstDay - 1; i >= 0; i--){
        const day = daysInPrev - i;
        const cellTs = new Date(viewYear, viewMonth - 1, day).setHours(0,0,0,0);
        const inRange = cellTs >= tempStart && cellTs <= tempEnd;
        const isStart = cellTs === tempStart;
        const isEnd = cellTs === tempEnd;
        const isFuture = cellTs > todayStart;
        const isSun = (cellIdx % 7 === 0);
        const isSat = (cellIdx % 7 === 6);
        html += `
          <div class="loy-cal-cell other-month ${isFuture ? "is-future" : ""} ${inRange ? "in-range" : ""} ${isSun ? "col-sun" : ""} ${isSat ? "col-sat" : ""} ${isStart ? "range-start is-selected" : ""} ${isEnd ? "range-end is-selected" : ""}" data-ts="${cellTs}">
            <div class="loy-cal-day-bubble">${String(day).padStart(2,"0")}</div>
          </div>`;
        cellIdx++;
      }
      for(let d = 1; d <= daysInMonth; d++){
        const cellTs = new Date(viewYear, viewMonth, d).setHours(0,0,0,0);
        const inRange = cellTs >= tempStart && cellTs <= tempEnd;
        const isStart = cellTs === tempStart;
        const isEnd = cellTs === tempEnd;
        const isFuture = cellTs > todayStart;
        const isSun = (cellIdx % 7 === 0);
        const isSat = (cellIdx % 7 === 6);
        html += `
          <div class="loy-cal-cell ${isFuture ? "is-future" : ""} ${inRange ? "in-range" : ""} ${isSun ? "col-sun" : ""} ${isSat ? "col-sat" : ""} ${isStart ? "range-start is-selected" : ""} ${isEnd ? "range-end is-selected" : ""}" data-ts="${cellTs}">
            <div class="loy-cal-day-bubble">${String(d).padStart(2,"0")}</div>
          </div>`;
        cellIdx++;
      }
      const totalCells = firstDay + daysInMonth;
      const totalRows = totalCells > 35 ? 42 : 35;
      const remaining = totalRows - totalCells;
      for(let d = 1; d <= remaining; d++){
        const cellTs = new Date(viewYear, viewMonth + 1, d).setHours(0,0,0,0);
        const inRange = cellTs >= tempStart && cellTs <= tempEnd;
        const isStart = cellTs === tempStart;
        const isEnd = cellTs === tempEnd;
        const isFuture = cellTs > todayStart;
        const isSun = (cellIdx % 7 === 0);
        const isSat = (cellIdx % 7 === 6);
        html += `
          <div class="loy-cal-cell other-month ${isFuture ? "is-future" : ""} ${inRange ? "in-range" : ""} ${isSun ? "col-sun" : ""} ${isSat ? "col-sat" : ""} ${isStart ? "range-start is-selected" : ""} ${isEnd ? "range-end is-selected" : ""}" data-ts="${cellTs}">
            <div class="loy-cal-day-bubble">${String(d).padStart(2,"0")}</div>
          </div>`;
        cellIdx++;
      }

      gridEl.innerHTML = html;

      gridEl.querySelectorAll(".loy-cal-cell").forEach(cell => {
        cell.onclick = () => {
          if(cell.classList.contains("is-future")) return;
          const ts = Number(cell.dataset.ts);
          if(selPhase === "done" || ts < tempStart){
            tempStart = ts;
            tempEnd = ts;
            selPhase = "end";
          } else {
            tempEnd = ts;
            selPhase = "done";
          }
          modal.querySelectorAll(".loy-preset-btn").forEach(b => b.classList.remove("active"));
          renderGrid();
        };
      });
    }

    modal.querySelector("#loy-prev-month").onclick = () => {
      viewMonth--;
      if(viewMonth < 0){ viewMonth = 11; viewYear--; }
      renderGrid();
    };
    modal.querySelector("#loy-next-month").onclick = () => {
      viewMonth++;
      if(viewMonth > 11){ viewMonth = 0; viewYear++; }
      renderGrid();
    };

    const handleDateInput = (inp, isStart) => {
      const parsed = parseDDMM(inp.value);
      if(parsed && parsed <= todayStart + oneDay){
        if(isStart){
          tempStart = parsed;
          if(tempStart > tempEnd) tempEnd = tempStart;
          viewMonth = new Date(tempStart).getMonth();
          viewYear = new Date(tempStart).getFullYear();
        } else {
          tempEnd = parsed;
          if(tempEnd < tempStart) tempStart = tempEnd;
          viewMonth = new Date(tempEnd).getMonth();
          viewYear = new Date(tempEnd).getFullYear();
        }
        renderGrid();
      }
    };

    const startInpEl = modal.querySelector("#loy-start-input");
    const endInpEl = modal.querySelector("#loy-end-input");
    startInpEl.onchange = () => handleDateInput(startInpEl, true);
    endInpEl.onchange = () => handleDateInput(endInpEl, false);
    startInpEl.oninput = () => { if(startInpEl.value.trim().length === 10) handleDateInput(startInpEl, true); };
    endInpEl.oninput = () => { if(endInpEl.value.trim().length === 10) handleDateInput(endInpEl, false); };

    modal.querySelectorAll("[data-loy-preset]").forEach(btn => {
      btn.onclick = () => {
        const p = btn.dataset.loyPreset;
        modal.querySelectorAll(".loy-preset-btn").forEach(b => b.classList.toggle("active", b === btn));
        if(p === "today"){
          tempStart = todayStart;
          tempEnd = todayStart;
        } else if(p === "yesterday"){
          tempStart = todayStart - oneDay;
          tempEnd = todayStart - oneDay;
        } else if(p === "this_week"){
          const dIdx = new Date(todayStart).getDay();
          tempStart = todayStart - (dIdx * oneDay);
          tempEnd = todayStart;
        } else if(p === "last_week"){
          const dIdx = new Date(todayStart).getDay();
          const prevSun = todayStart - (dIdx * oneDay) - (7 * oneDay);
          tempStart = prevSun;
          tempEnd = prevSun + (6 * oneDay);
        } else if(p === "this_month"){
          tempStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          tempEnd = todayStart;
        } else if(p === "last_month"){
          tempStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
          tempEnd = new Date(now.getFullYear(), now.getMonth(), 0).getTime();
        } else if(p === "last_7d"){
          tempStart = todayStart - (6 * oneDay);
          tempEnd = todayStart;
        } else if(p === "last_30d"){
          tempStart = todayStart - (29 * oneDay);
          tempEnd = todayStart;
        }
        viewMonth = new Date(tempEnd).getMonth();
        viewYear = new Date(tempEnd).getFullYear();
        selPhase = "done";
        renderGrid();
      };
    });

    modal.querySelector("#loy-cancel-btn").onclick = () => Modal.close();

    modal.querySelector("#loy-done-btn").onclick = () => {
      const s = new Date(tempStart).setHours(0,0,0,0);
      const e = new Date(tempEnd).setHours(23,59,59,999);
      activeRange = {
        start: s,
        end: e,
        key: "custom",
        label: fmtDateRangeLabel({ start: s, end: e }),
        subtitle: `${new Date(s).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} – ${new Date(e).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`
      };
      periodKey = "custom";
      Modal.close();
      render();
    };

    renderGrid();
  }

  function reportsToolbarHtml(){
    const r = getActiveRange();
    const dateLabel = fmtDateRangeLabel(r);
    const timeBtnLabel = timeFilter === "all" ? "All day" : (timeFilter === "morning" ? "Morning" : (timeFilter === "afternoon" ? "Afternoon" : (timeFilter === "night" ? "Night" : "Custom")));
    const empBtnLabel = employeeFilter === "all" ? "All employees" : employeeFilter;

    const users = DB.getUsers ? DB.getUsers() : [];
    const salesCashiers = [...new Set([...(DB.getSales ? DB.getSales() : []).map(s => s.cashier), ...(DB.getFuelSales ? DB.getFuelSales() : []).map(s => s.cashier || s.attendant)].filter(Boolean))];
    const allEmps = [...new Set([...users.map(u => u.name), ...salesCashiers])].filter(Boolean);

    return `
      <!-- (2026-07-13) Reports filter toolbar matching Loyverse; was missing -->
      <div class="rpt-toolbar" id="reports-filter-bar">
        <div class="rpt-date-group">
          <button class="rpt-nav-btn" id="rpt-btn-prev" title="Previous period">${Icons.get("chevron-left", {size:15})}</button>
          <button class="rpt-date-btn" id="rpt-btn-date" title="Select date range">
            ${Icons.get("calendar", {size:15})}
            <span id="rpt-date-display">${dateLabel}</span>
          </button>
          <button class="rpt-nav-btn" id="rpt-btn-next" title="Next period">${Icons.get("chevron-right", {size:15})}</button>
        </div>
        <div class="rpt-dropdown-wrap">
          <button class="rpt-dropdown-btn" id="rpt-btn-time" title="Filter by time of day">
            ${Icons.get("clock", {size:15})}
            <span>${timeBtnLabel}</span>
            ${Icons.get("chevron-down", {size:13})}
          </button>
          <div class="rpt-dropdown-menu" id="rpt-menu-time">
            <div class="rpt-menu-item ${timeFilter === "all" ? "active" : ""}" data-time="all">All day</div>
            <div class="rpt-menu-item ${timeFilter === "morning" ? "active" : ""}" data-time="morning">Morning (06:00 - 14:00)</div>
            <div class="rpt-menu-item ${timeFilter === "afternoon" ? "active" : ""}" data-time="afternoon">Afternoon (14:00 - 22:00)</div>
            <div class="rpt-menu-item ${timeFilter === "night" ? "active" : ""}" data-time="night">Night (22:00 - 06:00)</div>
          </div>
        </div>
        <div class="rpt-dropdown-wrap">
          <button class="rpt-dropdown-btn" id="rpt-btn-emp" title="Filter by employee">
            ${Icons.get("user", {size:15})}
            <span>${empBtnLabel}</span>
            ${Icons.get("chevron-down", {size:13})}
          </button>
          <div class="rpt-dropdown-menu" id="rpt-menu-emp">
            <div class="rpt-menu-item ${employeeFilter === "all" ? "active" : ""}" data-emp="all">All employees</div>
            ${allEmps.map(emp => `
              <div class="rpt-menu-item ${employeeFilter.toLowerCase() === emp.toLowerCase() ? "active" : ""}" data-emp="${Utils.escapeHtml(emp)}">${Utils.escapeHtml(emp)}</div>
            `).join("")}
          </div>
        </div>
      </div>`;
  }

  function bindToolbarEvents(){
    const prevBtn = document.getElementById("rpt-btn-prev");
    const nextBtn = document.getElementById("rpt-btn-next");
    const dateBtn = document.getElementById("rpt-btn-date");
    const timeBtn = document.getElementById("rpt-btn-time");
    const empBtn = document.getElementById("rpt-btn-emp");
    const menuTime = document.getElementById("rpt-menu-time");
    const menuEmp = document.getElementById("rpt-menu-emp");

    if(prevBtn) prevBtn.onclick = () => shiftPeriod(-1);
    if(nextBtn) nextBtn.onclick = () => shiftPeriod(1);
    if(dateBtn) dateBtn.onclick = () => openDatePickerModal();

    if(timeBtn && menuTime){
      timeBtn.onclick = (e) => {
        e.stopPropagation();
        if(menuEmp) menuEmp.classList.remove("show");
        menuTime.classList.toggle("show");
      };
      menuTime.querySelectorAll("[data-time]").forEach(item => {
        item.onclick = (e) => {
          e.stopPropagation();
          timeFilter = item.dataset.time;
          menuTime.classList.remove("show");
          render();
        };
      });
    }

    if(empBtn && menuEmp){
      empBtn.onclick = (e) => {
        e.stopPropagation();
        if(menuTime) menuTime.classList.remove("show");
        menuEmp.classList.toggle("show");
      };
      menuEmp.querySelectorAll("[data-emp]").forEach(item => {
        item.onclick = (e) => {
          e.stopPropagation();
          employeeFilter = item.dataset.emp;
          menuEmp.classList.remove("show");
          render();
        };
      });
    }

    document.addEventListener("click", () => {
      if(menuTime) menuTime.classList.remove("show");
      if(menuEmp) menuEmp.classList.remove("show");
    }, { once: true });
  }

  // (2026-07-13) Timeframe chips bar with period selector; was plain list
  function timeframeBarHtml(activeKey){
    return `
      <div class="date-range-bar" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;overflow-x:auto;padding-bottom:2px;">
        ${PERIOD_FILTERS.map(([k, lbl]) => `
          <button class="chip ${activeKey === k ? "active" : ""}" data-period="${k}" style="padding:5px 12px;font-size:var(--fs-xs);font-weight:700;cursor:pointer;">${lbl}</button>
        `).join("")}
      </div>`;
  }

  // (2026-07-13) Add total row to sales by item table; was missing tfoot
  function salesByItemTable(){
    const r = getActiveRange();
    const filterFn = getReportFilterFn();
    const stats = Analytics.computeStats(r, { filterFn });
    const items = (stats.topSellers && stats.topSellers.length) ? stats.topSellers : Analytics.topSellers(stats, 500);
    const totalRev = items.reduce((s,x)=>s+x.revenue,0);
    const totalUnits = items.reduce((s,x)=>s+x.units,0);
    const totalProfit = items.reduce((s,x)=>s+x.profit,0);
    const totalCost = items.reduce((s,x)=>s+(x.revenue - x.profit),0);
    const totalMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100) : 0;
    return `
      ${timeframeBarHtml(periodKey)}
      <div class="grid-3" style="margin-bottom:14px;gap:10px;">
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Units Sold</div>
          <div class="mono font-bold" style="font-size:1.25rem;">${totalUnits} pcs</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Net Sales</div>
          <div class="mono font-bold" style="font-size:1.25rem;color:var(--brand-deep);">${Utils.money(totalRev)}</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Gross Profit</div>
          <div class="mono font-bold" style="font-size:1.25rem;color:var(--success-deep);">${Utils.money(totalProfit)}</div>
        </div>
      </div>
      ${items.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>#</th><th>Item</th><th>Category</th><th>Units Sold</th><th>Net Sales</th><th>Cost</th><th>Gross Profit</th><th>Margin</th></tr></thead>
          <tbody>
            ${items.map((it, idx) => {
              const cogs = it.revenue - it.profit;
              return `<tr class="clickable-row" data-top-prod="${Utils.escapeHtml(it.productId || it.name)}">
                <td class="text-faint">${idx + 1}</td>
                <td><strong>${Utils.escapeHtml(it.name)}</strong></td>
                <td><span class="badge badge-brand">${Utils.escapeHtml(it.category)}</span></td>
                <td class="mono font-bold">${it.units}</td>
                <td class="mono font-bold">${Utils.money(it.revenue)}</td>
                <td class="mono">${Utils.money(cogs)}</td>
                <td class="mono font-bold" style="color:var(--success-deep);">${Utils.money(it.profit)}</td>
                <td class="mono">${it.margin.toFixed(1)}%</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:900;border-top:2px solid var(--line);background:var(--paper-raised);color:var(--ink);">
              <td colspan="3" style="font-weight:900;text-transform:uppercase;">Total</td>
              <td class="mono font-bold">${totalUnits}</td>
              <td class="mono font-bold">${Utils.money(totalRev)}</td>
              <td class="mono font-bold">${Utils.money(totalCost)}</td>
              <td class="mono font-bold" style="color:var(--success-deep);">${Utils.money(totalProfit)}</td>
              <td class="mono font-bold">${totalMargin.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table></div>
      ` : `<div class="empty">${Icons.get("package",{size:34})}<h3>No item sales in ${r.label}</h3></div>`}`;
  }

  // (2026-07-13) Add total row to category sales table; was missing tfoot
  function salesByCategoryTable(){
    const r = getActiveRange();
    const filterFn = getReportFilterFn();
    const stats = Analytics.computeStats(r, { filterFn });
    const cats = (stats.categoryBreakdown && stats.categoryBreakdown.length) ? stats.categoryBreakdown : Analytics.categoryPL(stats);
    const totalRev = cats.reduce((s,x)=>s+x.revenue,0);
    const totalProfit = cats.reduce((s,x)=>s+x.profit,0);
    const totalCost = cats.reduce((s,x)=>s+(x.cogs ?? (x.revenue - x.profit)),0);
    const totalMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100) : 0;
    return `
      ${timeframeBarHtml(periodKey)}
      <div class="grid-3" style="margin-bottom:14px;gap:10px;">
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Categories Active</div>
          <div class="mono font-bold" style="font-size:1.25rem;">${cats.length}</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Category Revenue</div>
          <div class="mono font-bold" style="font-size:1.25rem;color:var(--brand-deep);">${Utils.money(totalRev)}</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Category Profit</div>
          <div class="mono font-bold" style="font-size:1.25rem;color:var(--success-deep);">${Utils.money(totalProfit)}</div>
        </div>
      </div>
      ${cats.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>#</th><th>Category</th><th>Net Sales</th><th>Cost</th><th>Gross Profit</th><th>Margin</th><th>Share</th></tr></thead>
          <tbody>
            ${cats.map((c, idx) => {
              const cogs = c.cogs ?? (c.revenue - c.profit);
              const margin = c.revenue > 0 ? ((c.profit / c.revenue) * 100) : 0;
              const share = totalRev > 0 ? ((c.revenue / totalRev) * 100) : 0;
              return `<tr>
                <td class="text-faint">${idx + 1}</td>
                <td><span class="badge badge-brand" style="font-size:0.85rem;padding:4px 10px;">${Utils.escapeHtml(c.category)}</span></td>
                <td class="mono font-bold">${Utils.money(c.revenue)}</td>
                <td class="mono">${Utils.money(cogs)}</td>
                <td class="mono font-bold" style="color:var(--success-deep);">${Utils.money(c.profit)}</td>
                <td class="mono">${margin.toFixed(1)}%</td>
                <td class="mono font-bold">${share.toFixed(1)}%</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:900;border-top:2px solid var(--line);background:var(--paper-raised);color:var(--ink);">
              <td colspan="2" style="font-weight:900;text-transform:uppercase;">Total</td>
              <td class="mono font-bold">${Utils.money(totalRev)}</td>
              <td class="mono font-bold">${Utils.money(totalCost)}</td>
              <td class="mono font-bold" style="color:var(--success-deep);">${Utils.money(totalProfit)}</td>
              <td class="mono font-bold">${totalMargin.toFixed(1)}%</td>
              <td class="mono font-bold">100.0%</td>
            </tr>
          </tfoot>
        </table></div>
      ` : `<div class="empty">${Icons.get("tag",{size:34})}<h3>No category data in ${r.label}</h3></div>`}`;
  }

  // (2026-07-13) Add total row to employee sales table; was missing tfoot
  function salesByEmployeeTable(){
    const r = getActiveRange();
    let sales = DB.getSales().filter(s => s.ts >= r.start && s.ts <= r.end && matchTimeFilter(s.ts));
    let fuelSales = DB.getFuelSales().filter(s => s.ts >= r.start && s.ts <= r.end && matchTimeFilter(s.ts));
    if(employeeFilter !== "all"){
      sales = sales.filter(s => (s.cashier || "Admin").toLowerCase() === employeeFilter.toLowerCase());
      fuelSales = fuelSales.filter(s => (s.cashier || s.attendant || "Gas Attendant").toLowerCase() === employeeFilter.toLowerCase());
    }
    const empMap = {};

    sales.forEach(s => {
      const emp = s.cashier || "Admin";
      if(!empMap[emp]) empMap[emp] = { name: emp, receipts: 0, storeSales: 0, fuelSales: 0, total: 0 };
      empMap[emp].receipts++;
      empMap[emp].storeSales += s.total;
      empMap[emp].total += s.total;
    });

    fuelSales.forEach(s => {
      const emp = s.cashier || s.attendant || "Gas Attendant";
      if(!empMap[emp]) empMap[emp] = { name: emp, receipts: 0, storeSales: 0, fuelSales: 0, total: 0 };
      empMap[emp].receipts++;
      empMap[emp].fuelSales += s.amount;
      empMap[emp].total += s.amount;
    });

    const list = Object.values(empMap).sort((a,b)=>b.total-a.total);
    const grandTotal = list.reduce((s,x)=>s+x.total,0);
    const totalReceipts = list.reduce((s,x)=>s+x.receipts,0);
    const totalStore = list.reduce((s,x)=>s+x.storeSales,0);
    const totalFuel = list.reduce((s,x)=>s+x.fuelSales,0);
    const totalAvg = totalReceipts > 0 ? (grandTotal / totalReceipts) : 0;

    return `
      ${timeframeBarHtml(periodKey)}
      <div class="grid-3" style="margin-bottom:14px;gap:10px;">
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Active Employees</div>
          <div class="mono font-bold" style="font-size:1.25rem;">${list.length} staff</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Receipts</div>
          <div class="mono font-bold" style="font-size:1.25rem;">${totalReceipts}</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Processed</div>
          <div class="mono font-bold" style="font-size:1.25rem;color:var(--brand-deep);">${Utils.money(grandTotal)}</div>
        </div>
      </div>
      ${list.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>#</th><th>Employee</th><th>Receipts</th><th>Store Sales</th><th>Fuel Sales</th><th>Total Sales</th><th>Avg Ticket</th><th>Share</th></tr></thead>
          <tbody>
            ${list.map((e, idx) => {
              const avg = e.receipts > 0 ? (e.total / e.receipts) : 0;
              const share = grandTotal > 0 ? ((e.total / grandTotal) * 100) : 0;
              return `<tr>
                <td class="text-faint">${idx + 1}</td>
                <td><strong>${Utils.escapeHtml(e.name)}</strong></td>
                <td class="mono font-bold">${e.receipts}</td>
                <td class="mono">${Utils.money(e.storeSales)}</td>
                <td class="mono">${Utils.money(e.fuelSales)}</td>
                <td class="mono font-bold" style="color:var(--brand-deep);">${Utils.money(e.total)}</td>
                <td class="mono">${Utils.money(avg)}</td>
                <td class="mono font-bold">${share.toFixed(1)}%</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:900;border-top:2px solid var(--line);background:var(--paper-raised);color:var(--ink);">
              <td colspan="2" style="font-weight:900;text-transform:uppercase;">Total</td>
              <td class="mono font-bold">${totalReceipts}</td>
              <td class="mono font-bold">${Utils.money(totalStore)}</td>
              <td class="mono font-bold">${Utils.money(totalFuel)}</td>
              <td class="mono font-bold" style="color:var(--brand-deep);">${Utils.money(grandTotal)}</td>
              <td class="mono font-bold">${Utils.money(totalAvg)}</td>
              <td class="mono font-bold">100.0%</td>
            </tr>
          </tfoot>
        </table></div>
      ` : `<div class="empty">${Icons.get("user",{size:34})}<h3>No employee sales in ${r.label}</h3></div>`}`;
  }

  // (2026-07-13) Add total row to payment sales table; was missing tfoot
  function salesByPaymentTable(){
    const r = getActiveRange();
    const filterFn = getReportFilterFn();
    const sales = DB.getSales().filter(s => s.ts >= r.start && s.ts <= r.end && filterFn(s));
    const fuelSales = DB.getFuelSales().filter(s => s.ts >= r.start && s.ts <= r.end && filterFn(s));
    const payMap = {};

    [...sales, ...fuelSales].forEach(s => {
      const m = s.method || "Cash";
      if(!payMap[m]) payMap[m] = { method: m, count: 0, amount: 0 };
      payMap[m].count++;
      payMap[m].amount += (s.total ?? s.amount ?? 0);
    });

    const list = Object.values(payMap).sort((a,b)=>b.amount-a.amount);
    const totalAmt = list.reduce((s,x)=>s+x.amount,0);
    const totalCount = list.reduce((s,x)=>s+x.count,0);

    return `
      ${timeframeBarHtml(periodKey)}
      <div class="grid-3" style="margin-bottom:14px;gap:10px;">
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Payment Types</div>
          <div class="mono font-bold" style="font-size:1.25rem;">${list.length}</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Transactions Count</div>
          <div class="mono font-bold" style="font-size:1.25rem;">${totalCount}</div>
        </div>
        <div class="card card-tight" style="padding:10px 14px;border:1px solid var(--line);background:var(--paper-dim);">
          <div class="text-faint text-xs" style="font-weight:700;text-transform:uppercase;">Total Collected</div>
          <div class="mono font-bold" style="font-size:1.25rem;color:var(--brand-deep);">${Utils.money(totalAmt)}</div>
        </div>
      </div>
      ${list.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>#</th><th>Payment Type</th><th>Transactions</th><th>Total Collected</th><th>Share</th></tr></thead>
          <tbody>
            ${list.map((p, idx) => {
              const share = totalAmt > 0 ? ((p.amount / totalAmt) * 100) : 0;
              return `<tr>
                <td class="text-faint">${idx + 1}</td>
                <td><span class="badge badge-brand" style="font-size:0.85rem;padding:4px 10px;">${Utils.escapeHtml(p.method)}</span></td>
                <td class="mono font-bold">${p.count}</td>
                <td class="mono font-bold" style="color:var(--brand-deep);">${Utils.money(p.amount)}</td>
                <td class="mono font-bold">${share.toFixed(1)}%</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight:900;border-top:2px solid var(--line);background:var(--paper-raised);color:var(--ink);">
              <td colspan="2" style="font-weight:900;text-transform:uppercase;">Total</td>
              <td class="mono font-bold">${totalCount}</td>
              <td class="mono font-bold" style="color:var(--brand-deep);">${Utils.money(totalAmt)}</td>
              <td class="mono font-bold">100.0%</td>
            </tr>
          </tfoot>
        </table></div>
      ` : `<div class="empty">${Icons.get("credit-card",{size:34})}<h3>No payment records in ${r.label}</h3></div>`}`;
  }

  // (2026-07-13) Add transaction count # & Source column to Store Sales table. Prev: unindexed
  function historyTable(){
    const r = getActiveRange();
    const filterFn = getReportFilterFn();
    let sales = DB.getSales().filter(s => s.ts >= r.start && s.ts <= r.end && filterFn(s));
    return `
      <div class="flex-between" style="margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        ${timeframeBarHtml(periodKey)}
        <div class="input-row" style="width:auto;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-outline" id="btn-export-sales-report" style="font-weight:700;">
            ${Icons.get("download",{size:13})} Export Sales (.csv)
          </button>
          ${Auth.isAdmin() ? `
            <label class="btn btn-sm btn-outline" style="cursor:pointer;margin:0;font-weight:700;">
              ${Icons.get("upload",{size:13})} Import Sales (CSV/JSON)
              <input type="file" id="file-sales-import" accept=".csv,.json" style="display:none;">
            </label>
          ` : ""}
        </div>
      </div>
      ${sales.length ? `
        <div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Time</th><th>Txn ID</th><th>Source</th><th>Items</th><th>Total</th><th>Method</th><th>Cashier</th><th style="text-align:right;">Actions</th></tr></thead><tbody>
        ${sales.map((s, idx) => {
          const isImp = s.isImported || s.source === "imported" || (typeof s.id === "string" && (s.id.includes("OLD") || /^(?:TXN-)?(?:1|2)-\d+/.test(s.id)));
          return `<tr>
          <td class="text-faint mono font-bold" style="cursor:pointer;" data-view-receipt="${s.id}">${sales.length - idx}</td>
          <td style="cursor:pointer;" data-view-receipt="${s.id}">${Utils.fmtDate(s.ts)}</td>
          <td class="mono font-bold" style="cursor:pointer;" data-view-receipt="${s.id}">${fmtTxnId(s.id)}</td>
          <td style="cursor:pointer;" data-view-receipt="${s.id}"><span class="badge ${isImp ? "badge-neutral" : "badge-brand"}" style="font-size:0.75rem;font-weight:800;">${isImp ? "Imported" : "Manual"}</span></td>
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
        </tr>`;
        }).join("")}
        </tbody></table></div>` : `<div class="empty">${Icons.get("receipt",{size:34})}<h3>No sales in ${r.label}</h3></div>`
      }`;
  }

  function fuelHistoryTable(){
    const r = getActiveRange();
    const filterFn = getReportFilterFn();
    let sales = DB.getFuelSales().filter(s => s.ts >= r.start && s.ts <= r.end && filterFn(s));
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
    const r = getActiveRange();
    const summary = Analytics.restockSummary(r);
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

  function paginationBarHtml(idPrefix, curPage, totalPages, pageSize, totalItems){
    if(!totalItems) return "";
    return `
      <div class="card-pagination">
        <div class="pg-nav-group">
          <button class="pg-btn" id="${idPrefix}-prev" type="button" ${curPage > 1 ? "" : "disabled"}>
            ${Icons.get("chevron-left", {size:15})}
          </button>
          <button class="pg-btn" id="${idPrefix}-next" type="button" ${curPage < totalPages ? "" : "disabled"}>
            ${Icons.get("chevron-right", {size:15})}
          </button>
        </div>
        <div class="pg-page-box">
          <span>Page:</span>
          <input type="number" class="pg-input" id="${idPrefix}-page-inp" min="1" max="${totalPages}" value="${curPage}" />
          <span>of ${totalPages}</span>
        </div>
        <div class="pg-divider"></div>
        <div class="pg-rpp-box">
          <span>Rows per page:</span>
          <select class="pg-select" id="${idPrefix}-rpp">
            <option value="10" ${pageSize === 10 ? "selected" : ""}>10</option>
            <option value="25" ${pageSize === 25 ? "selected" : ""}>25</option>
            <option value="50" ${pageSize === 50 ? "selected" : ""}>50</option>
            <option value="100" ${pageSize === 100 ? "selected" : ""}>100</option>
          </select>
        </div>
      </div>
    `;
  }

  // (2026-07-13) Add pagination to void audit logs; was unpaginated list
  let voidLogsPage = 1;
  let voidLogsRPP = 100;

  function voidLogsCard(isDedicated = false){
    const logs = DB.getVoidLogs ? DB.getVoidLogs() : [];
    const totalLogs = logs.length;
    const totalPages = Math.max(1, Math.ceil(totalLogs / voidLogsRPP));
    if(voidLogsPage > totalPages) voidLogsPage = totalPages;
    if(voidLogsPage < 1) voidLogsPage = 1;

    const startIdx = (voidLogsPage - 1) * voidLogsRPP;
    const pagedLogs = logs.slice(startIdx, startIdx + voidLogsRPP);

    const cardStyle = "margin-top:16px;margin-bottom:20px;";
    const tableStyle = "overflow-x:auto;overflow-y:visible;";
    return `
      <div class="card" style="${cardStyle}">
        <div class="flex-between" style="margin-bottom:10px;flex-shrink:0;">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--danger-deep);margin:0;">
            ${Icons.get("alert-triangle",{size:18})} Voided & Altered Items Audit Log (${logs.length})
          </h3>
        </div>
        ${logs.length ? `
          <div class="table-wrap" style="${tableStyle}">
            <table class="data">
              <thead><tr><th>Time</th><th>Txn ID</th><th>Items Altered</th><th>Price Diff</th><th>Admin</th><th>Reason</th></tr></thead>
              <tbody>
                ${pagedLogs.map(l => `
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
          ${paginationBarHtml("void-pg", voidLogsPage, totalPages, voidLogsRPP, totalLogs)}
        ` : `
          <p class="text-sm text-faint" style="margin:0;padding:12px 0;">No altered or voided items recorded. All transactions are intact.</p>
        `}
      </div>`;
  }

  function bindVoidLogsEvents(isDedicated = false){
    const logs = DB.getVoidLogs ? DB.getVoidLogs() : [];
    const totalPages = Math.max(1, Math.ceil(logs.length / voidLogsRPP));

    const rerender = () => {
      if(isDedicated){
        const body = document.getElementById("report-body");
        if(body){
          body.innerHTML = voidLogsCard(true);
          bindVoidLogsEvents(true);
        }
      } else {
        const wrap = document.getElementById("ov-void-wrap");
        if(wrap){
          wrap.innerHTML = voidLogsCard(false);
          bindVoidLogsEvents(false);
        }
      }
    };

    const prevBtn = document.getElementById("void-pg-prev");
    if(prevBtn){
      prevBtn.onclick = () => {
        if(voidLogsPage > 1){ voidLogsPage--; rerender(); }
      };
    }
    const nextBtn = document.getElementById("void-pg-next");
    if(nextBtn){
      nextBtn.onclick = () => {
        if(voidLogsPage < totalPages){ voidLogsPage++; rerender(); }
      };
    }
    const pageInp = document.getElementById("void-pg-page-inp");
    if(pageInp){
      pageInp.onchange = (e) => {
        const val = parseInt(e.target.value, 10);
        if(!isNaN(val) && val >= 1 && val <= totalPages){
          voidLogsPage = val;
          rerender();
        } else {
          pageInp.value = voidLogsPage;
        }
      };
    }
    const rppSel = document.getElementById("void-pg-rpp");
    if(rppSel){
      rppSel.onchange = (e) => {
        voidLogsRPP = parseInt(e.target.value, 10) || 100;
        voidLogsPage = 1;
        rerender();
      };
    }
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

  // (2026-07-13) Match product drilldown by name and id fallback; was id only
  function openProductDrilldown(row, stats){
    const lines = [];
    (stats.sales || []).forEach(s => (s.items || s.lines || []).forEach(l => {
      const match = (l.productId && row.productId && l.productId === row.productId) ||
                    ((l.name || "").trim().toLowerCase() === (row.name || "").trim().toLowerCase());
      if(match){
        lines.push({ ts: s.ts, qty: Number(l.qty)||1, amount: (Number(l.price)||0) * (Number(l.qty)||1), method: s.method || "Cash" });
      }
    }));
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

  // (2026-07-13) Store sales summary card modeled after Loyverse; was missing
  function renderStoreSalesCard(stats){
    const el = document.getElementById("ov-store-sales");
    if(!el) return;
    const storeSales = stats.sales || [];
    const discounts = storeSales.reduce((s,x) => s + (Number(x.discount) || 0), 0);
    const grossSales = stats.storeTotal + discounts;
    const refunds = 0;
    const netSales = stats.storeNetRevenue || stats.storeTotal;
    const grossProfit = stats.storeGrossProfit || 0;
    const txCount = stats.storeTxCount || 0;
    const avgSale = txCount > 0 ? (netSales / txCount) : 0;
    const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    el.innerHTML = `
      <div class="card" style="margin-bottom:16px;padding:16px 18px;">
        <div class="flex-between" style="margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);margin:0;">
            ${Icons.get("cart",{size:18})} Store Sales Summary
          </h3>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge-brand" style="font-size:0.75rem;padding:3px 8px;">${txCount} receipts</span>
            <span class="text-sm text-faint">Avg Ticket: <strong class="mono" style="color:var(--ink);">${Utils.money(avgSale)}</strong></span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;">
          <div style="background:var(--paper-dim);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--line);">
            <div class="text-sm text-faint" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Gross Sales</div>
            <div class="mono font-bold" style="font-size:1.15rem;color:var(--ink);">${Utils.money(grossSales)}</div>
          </div>
          <div style="background:var(--paper-dim);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--line);">
            <div class="text-sm text-faint" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Refunds</div>
            <div class="mono font-bold" style="font-size:1.15rem;color:var(--ink-soft);">${Utils.money(refunds)}</div>
          </div>
          <div style="background:var(--paper-dim);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--line);">
            <div class="text-sm text-faint" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Discounts</div>
            <div class="mono font-bold" style="font-size:1.15rem;color:var(--ink-soft);">${Utils.money(discounts)}</div>
          </div>
          <div style="background:var(--paper-dim);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--line);">
            <div class="text-sm text-faint" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Net Sales</div>
            <div class="mono font-bold" style="font-size:1.15rem;color:var(--brand-deep);">${Utils.money(netSales)}</div>
          </div>
          <div style="background:var(--paper-dim);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--line);">
            <div class="text-sm text-faint" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Gross Profit</div>
            <div class="mono font-bold" style="font-size:1.15rem;color:var(--success-deep);">${Utils.money(grossProfit)} <span style="font-size:0.72rem;font-weight:600;color:var(--ink-faint);">(${margin.toFixed(1)}%)</span></div>
          </div>
        </div>
      </div>`;
  }

  // (2026-07-13) Add Loyverse daily sales table to overview; was missing
  function computeDailySales(stats){
    const sales = stats.sales || [];
    const fuelSales = stats.fuelSales || [];
    const costMap = stats.costMap || Analytics.productCostMap();
    const fuelCfg = DB.getFuelConfig ? DB.getFuelConfig() : { fuels: {} };
    const dayMap = {};

    sales.forEach(s => {
      const d = new Date(s.ts);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if(!dayMap[dayKey]){
        dayMap[dayKey] = {
          dateTs: dayStart,
          dateLabel: `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-PH", { month: "short" })} ${d.getFullYear()}`,
          grossSales: 0,
          refunds: 0,
          discounts: 0,
          netSales: 0,
          cogs: 0,
          grossProfit: 0
        };
      }
      const disc = Number(s.discount) || 0;
      const tot = Number(s.total) || 0;
      const sCOGS = (s.items || []).reduce((sum, l) => sum + (costMap[l.productId] ?? 0) * (l.qty || 1), 0);
      dayMap[dayKey].grossSales += (tot + disc);
      dayMap[dayKey].discounts += disc;
      dayMap[dayKey].netSales += tot;
      dayMap[dayKey].cogs += sCOGS;
    });

    fuelSales.forEach(f => {
      const d = new Date(f.ts);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if(!dayMap[dayKey]){
        dayMap[dayKey] = {
          dateTs: dayStart,
          dateLabel: `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-PH", { month: "short" })} ${d.getFullYear()}`,
          grossSales: 0,
          refunds: 0,
          discounts: 0,
          netSales: 0,
          cogs: 0,
          grossProfit: 0
        };
      }
      const amt = Number(f.amount) || 0;
      const fCOGS = (f.costPerL ?? fuelCfg.fuels[f.fuelType]?.cost ?? 65) * (f.liters || 0);
      dayMap[dayKey].grossSales += amt;
      dayMap[dayKey].netSales += amt;
      dayMap[dayKey].cogs += fCOGS;
    });

    const sortedAsc = Object.values(dayMap).sort((a, b) => a.dateTs - b.dateTs);
    let runningBalance = (DB.getShift ? (DB.getShift().openingCash || 0) : 0);
    sortedAsc.forEach(row => {
      row.grossProfit = row.netSales - row.cogs;
      row.openingBalance = runningBalance;
      row.closingBalance = runningBalance + row.netSales;
      runningBalance = row.closingBalance;
    });
    return sortedAsc.sort((a, b) => b.dateTs - a.dateTs);
  }

  function exportDailySalesCSV(days){
    const headers = ["Date", "Opening balance", "Gross sales", "Refunds", "Discounts", "Net sales", "Cost of goods", "Gross profit", "Closing balance"];
    const rows = days.map(d => [
      `"${d.dateLabel}"`,
      d.openingBalance.toFixed(2),
      d.grossSales.toFixed(2),
      d.refunds.toFixed(2),
      d.discounts.toFixed(2),
      d.netSales.toFixed(2),
      d.cogs.toFixed(2),
      d.grossProfit.toFixed(2),
      d.closingBalance.toFixed(2)
    ]);
    const totalGross = days.reduce((sum, d) => sum + d.grossSales, 0);
    const totalRefunds = days.reduce((sum, d) => sum + d.refunds, 0);
    const totalDiscounts = days.reduce((sum, d) => sum + d.discounts, 0);
    const totalNet = days.reduce((sum, d) => sum + d.netSales, 0);
    const totalCogs = days.reduce((sum, d) => sum + d.cogs, 0);
    const totalProfit = days.reduce((sum, d) => sum + d.grossProfit, 0);
    const periodOpeningBalance = days.length ? days[days.length - 1].openingBalance : 0;
    const periodClosingBalance = days.length ? days[0].closingBalance : 0;
    rows.push([
      `"Total"`,
      periodOpeningBalance.toFixed(2),
      totalGross.toFixed(2),
      totalRefunds.toFixed(2),
      totalDiscounts.toFixed(2),
      totalNet.toFixed(2),
      totalCogs.toFixed(2),
      totalProfit.toFixed(2),
      periodClosingBalance.toFixed(2)
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    Utils.downloadFile(csv, `daily_sales_${periodKey || "report"}.csv`, "text/csv");
  }

  // (2026-07-13) Add opening/closing cash & totals row; was sales-only table
  let dailySalesPage = 1;
  let dailySalesRPP = 100;

  function renderDailySalesTable(stats){
    const el = document.getElementById("ov-daily-sales");
    if(!el) return;
    const days = computeDailySales(stats);
    const totalDays = days.length;
    const totalPages = Math.max(1, Math.ceil(totalDays / dailySalesRPP));
    if(dailySalesPage > totalPages) dailySalesPage = totalPages;
    if(dailySalesPage < 1) dailySalesPage = 1;

    const startIdx = (dailySalesPage - 1) * dailySalesRPP;
    const pagedDays = days.slice(startIdx, startIdx + dailySalesRPP);

    const totalGross = days.reduce((sum, d) => sum + d.grossSales, 0);
    const totalRefunds = days.reduce((sum, d) => sum + d.refunds, 0);
    const totalDiscounts = days.reduce((sum, d) => sum + d.discounts, 0);
    const totalNet = days.reduce((sum, d) => sum + d.netSales, 0);
    const totalCogs = days.reduce((sum, d) => sum + d.cogs, 0);
    const totalProfit = days.reduce((sum, d) => sum + d.grossProfit, 0);
    const periodOpeningBalance = days.length ? days[days.length - 1].openingBalance : 0;
    const periodClosingBalance = days.length ? days[0].closingBalance : 0;

    el.innerHTML = `
      <div class="card" style="margin-bottom:16px;padding:16px 18px;">
        <div class="flex-between" style="margin-bottom:12px;align-items:center;flex-wrap:wrap;gap:8px;">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);margin:0;">
            ${Icons.get("calendar",{size:18})} Daily Sales
          </h3>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="text-xs text-faint font-bold" style="text-transform:uppercase;">
              ${days.length} Day(s) Recorded
            </div>
            <button class="btn btn-sm btn-outline" id="btn-export-daily-sales" style="font-weight:700;font-size:0.75rem;letter-spacing:0.04em;">
              ${Icons.get("download",{size:13})} EXPORT
            </button>
          </div>
        </div>
        ${days.length ? `
          <div class="table-wrap" style="overflow-x:auto;">
            <table class="data" style="width:100%;">
              <thead>
                <tr>
                  <th style="text-align:left;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Date</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Opening balance</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Gross sales</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Refunds</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Discounts</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Net sales</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Cost of goods</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Gross profit</th>
                  <th style="text-align:right;font-size:0.8rem;color:var(--ink-faint);font-weight:700;">Closing balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style="font-weight:800;background:var(--paper-dim);border-bottom:1.5px solid var(--line);">
                  <td>Closing balance</td>
                  <td colspan="7"></td>
                  <td style="text-align:right;" class="mono font-bold text-success">${Utils.money(periodClosingBalance)}</td>
                </tr>
                ${pagedDays.map(d => `
                  <tr>
                    <td style="font-weight:600;">${d.dateLabel}</td>
                    <td style="text-align:right;" class="mono text-faint">${Utils.money(d.openingBalance)}</td>
                    <td style="text-align:right;" class="mono">${Utils.money(d.grossSales)}</td>
                    <td style="text-align:right;" class="mono text-faint">${Utils.money(d.refunds)}</td>
                    <td style="text-align:right;" class="mono text-faint">${Utils.money(d.discounts)}</td>
                    <td style="text-align:right;" class="mono font-bold">${Utils.money(d.netSales)}</td>
                    <td style="text-align:right;" class="mono">${Utils.money(d.cogs)}</td>
                    <td style="text-align:right;color:${d.grossProfit > 0 ? "var(--success-deep)" : d.grossProfit < 0 ? "var(--danger)" : "var(--ink)"};" class="mono font-bold">${Utils.money(d.grossProfit)}</td>
                    <td style="text-align:right;" class="mono font-bold">${Utils.money(d.closingBalance)}</td>
                  </tr>
                `).join("")}
                <tr style="font-weight:800;background:var(--paper-dim);border-top:1.5px solid var(--line);">
                  <td>Opening balance</td>
                  <td style="text-align:right;" class="mono font-bold">${Utils.money(periodOpeningBalance)}</td>
                  <td colspan="7"></td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="font-weight:900;border-top:2px solid var(--line);background:var(--paper-raised);color:var(--ink);">
                  <td style="font-weight:900;text-transform:uppercase;">Total</td>
                  <td style="text-align:right;" class="mono">${Utils.money(periodOpeningBalance)}</td>
                  <td style="text-align:right;" class="mono">${Utils.money(totalGross)}</td>
                  <td style="text-align:right;" class="mono text-faint">${Utils.money(totalRefunds)}</td>
                  <td style="text-align:right;" class="mono text-faint">${Utils.money(totalDiscounts)}</td>
                  <td style="text-align:right;" class="mono font-bold">${Utils.money(totalNet)}</td>
                  <td style="text-align:right;" class="mono">${Utils.money(totalCogs)}</td>
                  <td style="text-align:right;color:${totalProfit > 0 ? "var(--success-deep)" : totalProfit < 0 ? "var(--danger)" : "var(--ink)"};" class="mono font-bold">${Utils.money(totalProfit)}</td>
                  <td style="text-align:right;" class="mono font-bold">${Utils.money(periodClosingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          ${paginationBarHtml("ds-pg", dailySalesPage, totalPages, dailySalesRPP, totalDays)}
        ` : `
          <div class="empty" style="padding:24px 0;">
            ${Icons.get("calendar",{size:28})}
            <h3>No daily sales in this period</h3>
          </div>
        `}
      </div>`;

    const exportBtn = document.getElementById("btn-export-daily-sales");
    if(exportBtn && days.length){
      exportBtn.onclick = () => exportDailySalesCSV(days);
    }
    const prevBtn = document.getElementById("ds-pg-prev");
    if(prevBtn){
      prevBtn.onclick = () => {
        if(dailySalesPage > 1){ dailySalesPage--; renderDailySalesTable(stats); }
      };
    }
    const nextBtn = document.getElementById("ds-pg-next");
    if(nextBtn){
      nextBtn.onclick = () => {
        if(dailySalesPage < totalPages){ dailySalesPage++; renderDailySalesTable(stats); }
      };
    }
    const pageInp = document.getElementById("ds-pg-page-inp");
    if(pageInp){
      pageInp.onchange = (e) => {
        const val = parseInt(e.target.value, 10);
        if(!isNaN(val) && val >= 1 && val <= totalPages){
          dailySalesPage = val;
          renderDailySalesTable(stats);
        } else {
          pageInp.value = dailySalesPage;
        }
      };
    }
    const rppSel = document.getElementById("ds-pg-rpp");
    if(rppSel){
      rppSel.onchange = (e) => {
        dailySalesRPP = parseInt(e.target.value, 10) || 100;
        dailySalesPage = 1;
        renderDailySalesTable(stats);
      };
    }
  }

  // (2026-07-13) Render top sellers with item name fallback; was missing items
  function renderTopSellersTable(stats){
    const el = document.getElementById("ov-top-table");
    if(!el) return;
    const top = (stats.topSellers && stats.topSellers.length) ? stats.topSellers : Analytics.topSellers(stats);
    el.innerHTML = top.length ? `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>#</th><th>Product</th><th>Category</th><th>Units</th><th>Revenue</th><th>Profit</th></tr></thead>
        <tbody>
          ${top.slice(0, 15).map((r, i) => `
            <tr class="clickable-row" data-top-prod="${Utils.escapeHtml(r.productId || r.name)}">
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
        const item = top.find(x => (x.productId && x.productId === row.dataset.topProd) || x.name === row.dataset.topProd);
        if(item) openProductDrilldown(item, stats);
      };
    });
  }

  // (2026-07-13) Guard trend and category charts with safe fallbacks; was crashing
  function buildOverviewCharts(stats){
    destroyOverviewCharts();
    const trendCtx = document.getElementById("ov-chart-trend")?.getContext("2d");
    if(trendCtx && typeof Chart !== "undefined"){
      const trendData = stats.trend || Analytics.computeTrendData(periodKey);
      const store = trendData.store || trendData.storeData || [];
      const fuel = trendData.fuel || trendData.fuelData || [];
      const labels = trendData.labels || [];
      const timestamps = trendData.timestamps || trendData.dayStarts || [];
      overviewCharts.trend = new Chart(trendCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            { label: "Store", data: store, borderColor: "#4F46E5", backgroundColor: "rgba(79,70,229,0.1)", fill: true, tension: 0.3 },
            { label: "Fuel", data: fuel, borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.1)", fill: true, tension: 0.3 }
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
              const dayStart = timestamps[idx];
              if(dayStart) openDayDrilldown(dayStart);
            }
          }
        }
      });
    }

    const catCtx = document.getElementById("ov-chart-category")?.getContext("2d");
    if(catCtx && typeof Chart !== "undefined"){
      const cats = (stats.categoryBreakdown && stats.categoryBreakdown.length) ? stats.categoryBreakdown : Analytics.categoryPL(stats);
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
    const r = getActiveRange();
    wrap.innerHTML = `
      <div class="flex-between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px;align-items:center;">
        <div>
          <span class="text-md font-bold" style="color:var(--ink);">${r.subtitle || r.label}</span>
          <div class="text-sm text-faint">Click any chart point or category bar to drill in.</div>
        </div>
        ${timeframeBarHtml(periodKey)}
      </div>
      <div class="pl-summary" id="ov-pl"></div>
      <div class="chart-grid">
        <div class="chart-card">
          <!-- (2026-07-13) Place period dropdown in revenue trend header; was outer banner -->
          <div class="flex-between" style="margin-bottom:10px;align-items:center;flex-wrap:wrap;gap:8px;">
            <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);margin:0;">
              ${Icons.get("trending-up",{size:18})} Revenue Trend — Store vs Fuel
            </h3>
            <select class="input" id="trend-period-select" style="height:32px;padding:2px 10px;font-size:var(--fs-xs);font-weight:700;border-radius:var(--r-md);background:var(--paper-raised);border:1px solid var(--line);color:var(--ink);cursor:pointer;width:auto;">
              ${PERIOD_FILTERS.map(([k, lbl]) => `<option value="${k}" ${periodKey === k ? "selected" : ""}>${lbl}</option>`).join("")}
            </select>
          </div>
          <div style="position:relative;height:240px;width:100%;"><canvas id="ov-chart-trend"></canvas></div>
        </div>
        <div class="chart-card">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);">
            ${Icons.get("tag",{size:18})} Revenue vs Profit by Category
          </h3>
          <div style="position:relative;height:240px;width:100%;"><canvas id="ov-chart-category"></canvas></div>
        </div>
      </div>
      <div id="ov-store-sales"></div>
      <div id="ov-daily-sales"></div>
      <div class="card">
        <h3 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:800;color:var(--ink);">${Icons.get("package",{size:18})} Top Selling Items</h3>
        <div id="ov-top-table"></div>
      </div>
      <div id="ov-void-wrap">
        ${voidLogsCard(false)}
      </div>`;

    const trendSel = document.getElementById("trend-period-select");
    if(trendSel){
      trendSel.onchange = (e) => {
        periodKey = e.target.value;
        activeRange = null;
        render();
      };
    }

    wrap.querySelectorAll("[data-period]").forEach(chip => {
      chip.onclick = () => {
        periodKey = chip.dataset.period;
        activeRange = null;
        render();
      };
    });

    refreshOverview();
    bindVoidLogsEvents(false);
  }

  function refreshOverview(){
    const r = getActiveRange();
    const filterFn = getReportFilterFn();
    const stats = Analytics.computeStats(r, { filterFn });
    renderOverviewStats(stats);
    renderStoreSalesCard(stats);
    renderDailySalesTable(stats);
    buildOverviewCharts(stats);
    renderTopSellersTable(stats);
    const trendSel = document.getElementById("trend-period-select");
    if(trendSel) trendSel.value = periodKey;
    document.querySelectorAll("[data-period]").forEach(c => c.classList.toggle("active", c.dataset.period === periodKey));
  }

  // ---------------- shell ----------------
  function render(){
    const view = document.getElementById("view-root");
    const admin = Auth.isAdmin();
    if(!admin && tab !== "history" && tab !== "fuel") tab = "history";
    // (2026-07-13) Allow scroll chaining on view body; was overscroll:contain
    view.innerHTML = `
      <div class="view-body" style="overflow-y:auto;flex:1;min-height:0;height:100%;padding-bottom:6rem;-webkit-overflow-scrolling:touch;overscroll-behavior:auto;">
        <div class="view-head">
          <div><h2>${Icons.get("clipboard",{size:22})} Reports</h2><div class="view-sub">Sales history, analytics, shift reconciliation & void audit</div></div>
          <div class="input-row" style="width:auto;gap:8px;align-items:center;">
            <button class="btn btn-ghost" id="btn-xreport">${Icons.get("clipboard",{size:15})} X Report</button>
            <button class="btn btn-danger" id="btn-zreport">${Icons.get("lock",{size:15})} Z Report</button>
          </div>
        </div>
        ${reportsToolbarHtml()}
        <div class="category-chips" style="margin-bottom:14px;overflow-x:auto;display:flex;gap:6px;padding-bottom:4px;">
          ${admin ? `<div class="chip ${tab==="overview"?"active":""}" data-t="overview">${Icons.get("bar-chart",{size:13})}Sales summary</div>` : ""}
          <!-- (2026-07-13) Move Receipts chip 2nd after Sales summary; was 6th chip -->
          <div class="chip ${tab==="history"?"active":""}" data-t="history">${Icons.get("receipt",{size:13})}Receipts</div>
          ${admin ? `<div class="chip ${tab==="by_item"?"active":""}" data-t="by_item">${Icons.get("package",{size:13})}Sales by item</div>` : ""}
          ${admin ? `<div class="chip ${tab==="by_category"?"active":""}" data-t="by_category">${Icons.get("tag",{size:13})}Sales by category</div>` : ""}
          ${admin ? `<div class="chip ${tab==="by_employee"?"active":""}" data-t="by_employee">${Icons.get("user",{size:13})}Sales by employee</div>` : ""}
          ${admin ? `<div class="chip ${tab==="by_payment"?"active":""}" data-t="by_payment">${Icons.get("credit-card",{size:13})}Sales by payment type</div>` : ""}
          <div class="chip ${tab==="fuel"?"active":""}" data-t="fuel">${Icons.get("fuel",{size:13})}Fuel Sales</div>
          <div class="chip ${tab==="purchases"?"active":""}" data-t="purchases">${Icons.get("truck",{size:13})}Purchases & Restock</div>
          ${admin ? `<div class="chip ${tab==="voids"?"active":""}" data-t="voids">${Icons.get("alert-triangle",{size:13})}Void Audit</div>` : ""}
        </div>
        <div id="report-body"></div>
      </div>`;
    document.getElementById("btn-xreport").onclick = openXReport;
    document.getElementById("btn-zreport").onclick = openZReport;
    document.querySelectorAll("[data-t]").forEach(c=>c.onclick=()=>{ tab=c.dataset.t; render(); });
    bindToolbarEvents();

    if(tab === "overview") renderOverview();
    else if(tab === "by_item"){
      document.getElementById("report-body").innerHTML = salesByItemTable();
      document.querySelectorAll("[data-period]").forEach(chip => chip.onclick = () => { periodKey = chip.dataset.period; activeRange = null; render(); });
      document.querySelectorAll("[data-top-prod]").forEach(row => {
        row.onclick = () => {
          const r = getActiveRange();
          const filterFn = getReportFilterFn();
          const stats = Analytics.computeStats(r, { filterFn });
          const top = (stats.topSellers && stats.topSellers.length) ? stats.topSellers : Analytics.topSellers(stats, 500);
          const item = top.find(x => (x.productId && x.productId === row.dataset.topProd) || x.name === row.dataset.topProd);
          if(item) openProductDrilldown(item, stats);
        };
      });
    } else if(tab === "by_category"){
      document.getElementById("report-body").innerHTML = salesByCategoryTable();
      document.querySelectorAll("[data-period]").forEach(chip => chip.onclick = () => { periodKey = chip.dataset.period; activeRange = null; render(); });
    } else if(tab === "by_employee"){
      document.getElementById("report-body").innerHTML = salesByEmployeeTable();
      document.querySelectorAll("[data-period]").forEach(chip => chip.onclick = () => { periodKey = chip.dataset.period; activeRange = null; render(); });
    } else if(tab === "by_payment"){
      document.getElementById("report-body").innerHTML = salesByPaymentTable();
      document.querySelectorAll("[data-period]").forEach(chip => chip.onclick = () => { periodKey = chip.dataset.period; activeRange = null; render(); });
    } else if(tab === "voids"){
      document.getElementById("report-body").innerHTML = voidLogsCard(true);
      bindVoidLogsEvents(true);
    } else if(tab === "purchases"){
      document.getElementById("report-body").innerHTML = purchasesTable();
      document.querySelectorAll("[data-period]").forEach(chip => {
        chip.onclick = () => { periodKey = chip.dataset.period; activeRange = null; render(); };
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
        chip.onclick = () => { periodKey = chip.dataset.period; activeRange = null; render(); };
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
      document.getElementById("btn-export-sales-report")?.addEventListener("click", () => {
        ImportExport.exportSalesCSV(periodKey);
      });
      document.getElementById("file-sales-import")?.addEventListener("change", (e) => {
        if(e.target.files?.[0]){
          ImportExport.importSalesFile(e.target.files[0], () => {
            render();
          });
          e.target.value = "";
        }
      });
    }

  }

  return { render };
})();
