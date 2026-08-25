// ============================================================
// expenses.js — Operating expenses & payroll tracking (Admin only)
// ============================================================
const Expenses = (() => {
  let periodFilter = "all"; // all | month | today | 30d
  let categoryFilter = "All";

  const CATEGORIES = [
    "Electricity / Power",
    "Water & Utilities",
    "Staff Salaries / Wages",
    "Store & Station Rent",
    "Maintenance & Repairs",
    "Internet & Supplies",
    "Gasoline Station Operations",
    "Permits, Licenses & Taxes",
    "Other OPEX"
  ];

  function getFilteredExpenses(){
    const all = DB.getExpenses();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

    return all.filter(e => {
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      let matchPeriod = true;
      if(periodFilter === "today"){
        matchPeriod = (e.date === todayStr);
      } else if(periodFilter === "month"){
        matchPeriod = (e.date && e.date.startsWith(curMonthStr));
      } else if(periodFilter === "30d"){
        const diffDays = (Date.now() - (e.ts || new Date(e.date).getTime())) / (1000*60*60*24);
        matchPeriod = diffDays <= 30;
      }
      return matchCat && matchPeriod;
    });
  }

  function openExpenseModal(expense = null){
    const isEdit = !!expense;
    const today = new Date().toISOString().split("T")[0];

    const body = `
      <div class="field">
        <label>Expense Category</label>
        <div id="exp-cat-wrap"></div>
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Description / Details</label>
        <input class="input" id="f-exp-desc" placeholder="e.g. VECO Electricity Bill July, Cashier Salary" value="${expense ? Utils.escapeHtml(expense.description) : ""}" autofocus>
      </div>
      <div class="input-row" style="margin-top:10px;">
        <div class="field">
          <label>Amount (₱)</label>
          <input class="input mono font-bold" id="f-exp-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${expense ? expense.amount : ""}" style="font-size:1.25rem;">
        </div>
        <div class="field">
          <label>Expense Date</label>
          <input class="input" id="f-exp-date" type="date" value="${expense ? expense.date : today}">
        </div>
      </div>
      <div class="input-row" style="margin-top:10px;">
        <div class="field">
          <label>Payment Method</label>
          <div id="exp-method-wrap"></div>
        </div>
        <div class="field">
          <label>Paid To / Recipient</label>
          <input class="input" id="f-exp-recipient" placeholder="e.g. VECO, Employee Name, Landlord" value="${expense ? Utils.escapeHtml(expense.recipient || "") : ""}">
        </div>
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Receipt / Reference No. <span class="text-xs text-faint font-normal">(Optional)</span></label>
        <input class="input mono" id="f-exp-ref" placeholder="e.g. OR-891029, GCash Ref" value="${expense ? Utils.escapeHtml(expense.refNo || "") : ""}">
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("dollar-sign",{size:18})} ${isEdit ? "Edit Operating Expense" : "Record Operating Expense"}`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { label: isEdit ? "Save Changes" : "Save Expense", cls: "btn-primary btn-lg", onClick: () => {
          const category = UISelect.getValue("exp-cat") || "Other OPEX";
          const description = (modal.querySelector("#f-exp-desc").value || "").trim() || category;
          const amount = Number(modal.querySelector("#f-exp-amount").value) || 0;
          const date = modal.querySelector("#f-exp-date").value || today;
          const method = UISelect.getValue("exp-method") || "Cash";
          const recipient = (modal.querySelector("#f-exp-recipient").value || "").trim();
          const refNo = (modal.querySelector("#f-exp-ref").value || "").trim();

          if(amount <= 0){
            Utils.toast("Enter an expense amount greater than zero.", "warn");
            return;
          }

          if(isEdit){
            const all = DB.getExpenses().map(x => x.id === expense.id ? { ...x, category, description, amount, date, method, recipient, refNo } : x);
            DB.setExpenses(all);
            Utils.toast("Expense updated.", "success");
          } else {
            DB.addExpense({ category, description, amount, date, method, recipient, refNo });
            Utils.Sound.cashChime();
            Utils.toast(`Recorded expense: ${Utils.money(amount)} (${category})`, "success");
          }

          Modal.close();
          render();
        }}
      ]
    });

    modal.querySelector("#exp-cat-wrap").innerHTML = UISelect.render("exp-cat", CATEGORIES, expense?.category || CATEGORIES[0]);
    UISelect.bind("exp-cat");

    modal.querySelector("#exp-method-wrap").innerHTML = UISelect.render("exp-method", ["Cash","Bank Transfer","GCash","Check","Card","Other"], expense?.method || "Cash");
    UISelect.bind("exp-method");
  }

  function deleteExpense(exp){
    Modal.confirm({
      title: "Delete Expense Record?",
      message: `Delete ${exp.category} (${Utils.money(exp.amount)}) dated ${exp.date}?`,
      danger: true,
      onConfirm: () => {
        DB.deleteExpense(exp.id);
        Utils.toast("Expense record deleted.", "success");
        render();
      }
    });
  }

  function exportExpensesCSV(){
    const list = getFilteredExpenses();
    if(!list.length){ Utils.toast("No expense records to export.", "warn"); return; }
    const rows = [
      ["Date", "Category", "Description", "Amount", "Payment Method", "Recipient", "Reference No", "Logged By"],
      ...list.map(e => [
        e.date || "",
        e.category || "",
        `"${(e.description||"").replace(/"/g, '""')}"`,
        (e.amount || 0).toFixed(2),
        e.method || "Cash",
        `"${(e.recipient||"").replace(/"/g, '""')}"`,
        e.refNo || "",
        e.loggedBy || ""
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Route98_Operating_Expenses_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    Utils.toast("Expenses exported to CSV.", "success");
  }

  function render(){
    const view = document.getElementById("view-root");
    const expenses = getFilteredExpenses();

    const totalOpex = expenses.reduce((s,e) => s + (e.amount || 0), 0);
    const salaryTotal = expenses.filter(e => e.category.includes("Salaries")).reduce((s,e) => s + (e.amount || 0), 0);
    const utilTotal = expenses.filter(e => e.category.includes("Electricity") || e.category.includes("Water")).reduce((s,e) => s + (e.amount || 0), 0);

    // Compute sales gross profit to show Net Bottom Line
    const sales = DB.getSales();
    const products = DB.getProducts();
    let totalGrossRev = 0;
    let totalCogs = 0;
    sales.forEach(s => {
      totalGrossRev += (s.total || 0);
      (s.items || []).forEach(l => {
        const prod = products.find(p => p.id === l.productId);
        const cost = prod ? (prod.cost || 0) : 0;
        totalCogs += (cost * (l.qty || 1));
      });
    });
    const grossProfit = Math.max(0, totalGrossRev - totalCogs);
    const netProfit = grossProfit - totalOpex;

    view.innerHTML = `
      <div class="view-head">
        <div>
          <h2>${Icons.get("dollar-sign",{size:22})} Operating Expenses (OPEX)</h2>
          <div class="view-sub">Track utilities, salaries, maintenance, and store overhead · Admin only</div>
        </div>
        <div class="input-row" style="width:auto;">
          <button class="btn btn-outline" id="btn-export-exp">${Icons.get("download",{size:15})} Export CSV</button>
          <button class="btn btn-primary" id="btn-add-exp">${Icons.get("plus",{size:15})} Record Expense</button>
        </div>
      </div>

      <div class="grid-4" style="margin-bottom:16px;gap:12px;">
        <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:14px 18px;border-radius:12px;">
          <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Total OPEX Spent</div>
          <strong class="mono font-bold" style="font-size:1.65rem;color:var(--danger-deep);">${Utils.money(totalOpex)}</strong>
        </div>
        <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:14px 18px;border-radius:12px;">
          <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Salaries & Payroll</div>
          <strong class="mono font-bold" style="font-size:1.65rem;color:var(--ink);">${Utils.money(salaryTotal)}</strong>
        </div>
        <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:14px 18px;border-radius:12px;">
          <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Power & Utilities</div>
          <strong class="mono font-bold" style="font-size:1.65rem;color:var(--ink);">${Utils.money(utilTotal)}</strong>
        </div>
        <div class="card card-tight" style="border:1.5px solid var(--success-deep);background:var(--success-tint);padding:14px 18px;border-radius:12px;">
          <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;color:var(--success-deep);">Estimated Net Profit</div>
          <strong class="mono font-bold" style="font-size:1.65rem;color:var(--success-deep);">${Utils.money(netProfit)}</strong>
        </div>
      </div>

      <div class="inv-toolbar" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;" id="exp-period-pills">
          <button class="chip ${periodFilter==="all"?"active":""}" data-p="all">All Time</button>
          <button class="chip ${periodFilter==="month"?"active":""}" data-p="month">This Month</button>
          <button class="chip ${periodFilter==="30d"?"active":""}" data-p="30d">Last 30 Days</button>
          <button class="chip ${periodFilter==="today"?"active":""}" data-p="today">Today</button>
        </div>
        <div style="width:260px;" id="exp-cat-filter-wrap"></div>
      </div>

      <div class="table-wrap">
        <table class="data" style="font-size:1.02rem;">
          <thead>
            <tr style="font-size:.84rem;text-transform:uppercase;">
              <th style="padding:12px 14px;">Date</th>
              <th style="padding:12px 14px;">Category</th>
              <th style="padding:12px 14px;">Description / Details</th>
              <th style="padding:12px 14px;">Paid To</th>
              <th style="padding:12px 14px;">Method</th>
              <th style="padding:12px 14px;text-align:right;">Amount</th>
              <th style="width:70px;"></th>
            </tr>
          </thead>
          <tbody>
            ${expenses.length ? expenses.map(e => `
              <tr>
                <td class="mono font-bold" style="font-size:1.02rem;">${e.date}</td>
                <td><span class="badge badge-brand" style="font-size:.86rem;font-weight:800;padding:4px 10px;">${Utils.escapeHtml(e.category)}</span></td>
                <td>
                  <strong style="font-size:1.05rem;">${Utils.escapeHtml(e.description)}</strong>
                  ${e.refNo ? `<div class="text-xs text-faint mono">Ref: ${Utils.escapeHtml(e.refNo)}</div>` : ""}
                </td>
                <td style="font-size:.98rem;">${Utils.escapeHtml(e.recipient || "—")}</td>
                <td><span class="badge badge-neutral" style="font-size:.82rem;font-weight:700;">${e.method || "Cash"}</span></td>
                <td class="mono font-bold" style="text-align:right;font-size:1.18rem;color:var(--danger-deep);">${Utils.money(e.amount)}</td>
                <td style="text-align:right;white-space:nowrap;">
                  <button class="btn btn-sm btn-ghost" data-edit-exp="${e.id}" title="Edit">${Icons.get("edit",{size:15})}</button>
                  <button class="btn btn-sm btn-ghost" data-del-exp="${e.id}" title="Delete" style="color:var(--danger);">${Icons.get("trash",{size:15})}</button>
                </td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="7" class="text-center text-faint" style="padding:36px;font-size:1.05rem;">No operating expenses logged for this period. Click "Record Expense" to add.</td>
              </tr>
            `}
          </tbody>
          ${expenses.length ? `
            <tfoot id="exp-tfoot">
              <tr style="background:var(--paper-dim);border-top:2px solid var(--line-strong);font-size:.92rem;">
                <th colspan="5" style="padding:12px 14px;text-align:left;font-weight:850;">TOTAL OPEX (${expenses.length} records)</th>
                <th class="mono font-bold" style="text-align:right;font-size:1.25rem;color:var(--danger-deep);padding:12px 14px;">${Utils.money(totalOpex)}</th>
                <th></th>
              </tr>
            </tfoot>
          ` : ""}
        </table>
      </div>
    `;

    document.getElementById("btn-add-exp").onclick = () => openExpenseModal();
    document.getElementById("btn-export-exp").onclick = exportExpensesCSV;

    document.querySelectorAll("#exp-period-pills .chip").forEach(c => {
      c.onclick = () => {
        periodFilter = c.dataset.p;
        render();
      };
    });

    document.getElementById("exp-cat-filter-wrap").innerHTML = UISelect.render("exp-cat-filter", ["All", ...CATEGORIES], categoryFilter);
    UISelect.bind("exp-cat-filter", (val) => {
      categoryFilter = val;
      render();
    });

    view.querySelectorAll("[data-edit-exp]").forEach(btn => {
      btn.onclick = () => {
        const exp = DB.getExpenses().find(x => x.id === btn.dataset.editExp);
        if(exp) openExpenseModal(exp);
      };
    });

    view.querySelectorAll("[data-del-exp]").forEach(btn => {
      btn.onclick = () => {
        const exp = DB.getExpenses().find(x => x.id === btn.dataset.delExp);
        if(exp) deleteExpense(exp);
      };
    });
  }

  return { render };
})();
