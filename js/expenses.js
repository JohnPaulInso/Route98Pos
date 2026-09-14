// ============================================================
// expenses.js — Operating expenses & payroll tracking (Admin only)
// ============================================================
const Expenses = (() => {
  let periodFilter = "all"; // all | month | today | 30d
  let categoryFilter = "All";

  // (2026-07-13) Add Wholesale Purchases category; was utilities/salaries only
  const CATEGORIES = [
    "Wholesale Purchases",
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

  // (2026-07-13) Retrieve all recorded brand names from prods & exp; was none
  function getAllRecordedBrands(){
    const fromProds = DB.getProducts().map(p => (p.brand || "").trim()).filter(Boolean);
    const fromExp = (DB.getExpenses() || []).map(e => (e.purchaseDetails?.brand || "").trim()).filter(Boolean);
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem("mm_custom_brands") || "[]"); } catch(e){}
    return [...new Set([...fromProds, ...fromExp, ...custom])].sort((a,b) => a.localeCompare(b));
  }

  function recordBrandName(name){
    if(!name) return;
    const clean = name.replace(/^New Brand\s*["']?/i, "").replace(/["']?$/i, "").trim();
    if(!clean) return;
    try {
      let custom = JSON.parse(localStorage.getItem("mm_custom_brands") || "[]");
      if(!custom.some(b => b.toLowerCase() === clean.toLowerCase())){
        custom.push(clean);
        localStorage.setItem("mm_custom_brands", JSON.stringify(custom));
      }
    } catch(e){}
  }

  // (2026-07-13) Log Purchases modal with brand & prod autosuggest; was none
  function openPurchaseModal(){
    const today = new Date().toISOString().split("T")[0];
    const products = DB.getProducts();
    let selectedProduct = null;

    const body = `
      <!-- (2026-07-13) Unified product name input with autosuggest; was 2 fields -->
      <div class="field" style="position:relative;">
        <label style="font-weight:750;">Product Name <span class="text-xs text-faint font-normal">(search existing or type new)</span></label>
        <div style="position:relative;">
          <input class="input" id="f-pur-name" placeholder="Type product name (e.g. 1 Case Softdrinks, Oreo Vanilla)…" autocomplete="off">
          <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--ink-faint);">${Icons.get("search",{size:15})}</span>
        </div>
        <div id="pur-prod-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:120;background:var(--paper-raised);border:1.5px solid var(--brand);border-radius:var(--r-md);box-shadow:var(--shadow-lg);max-height:220px;overflow-y:auto;padding:4px;">
        </div>
        <div id="pur-selected-card" style="display:none;margin-top:8px;padding:8px 12px;background:var(--brand-tint);border:1.5px solid var(--brand);border-radius:var(--r-md);align-items:center;justify-content:space-between;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
            <span id="pur-selected-thumb" class="prod-thumb-sm" style="width:34px;height:34px;flex-shrink:0;margin:0;"></span>
            <div style="min-width:0;flex:1;">
              <strong id="pur-selected-name" style="font-size:.92rem;color:var(--brand-deep);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></strong>
              <div id="pur-selected-meta" class="text-xs text-faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-ghost" id="btn-pur-clear-prod" style="font-weight:700;flex-shrink:0;">Clear</button>
        </div>
      </div>

      <div class="field" style="margin-top:10px;position:relative;">
        <label style="font-weight:750;">Brand Name</label>
        <div style="position:relative;">
          <input class="input" id="f-pur-brand" placeholder="Type or choose brand (e.g. Palmolive, Oreo)…" autocomplete="off">
        </div>
        <div id="pur-brand-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:120;background:var(--paper-raised);border:1.5px solid var(--brand);border-radius:var(--r-md);box-shadow:var(--shadow-lg);max-height:180px;overflow-y:auto;padding:4px;">
        </div>
      </div>

      <div class="field" style="margin-top:10px;">
        <label style="font-weight:750;">Wholesale Seller / Supplier</label>
        <input class="input" id="f-pur-seller" placeholder="e.g. Direct Wholesale Agent, Monde Nissin, San Miguel Distributor">
      </div>

      <div class="input-row" style="margin-top:10px;">
        <div class="field">
          <label style="font-weight:750;">Quantity Bought</label>
          <input class="input mono font-bold" id="f-pur-qty" type="number" min="1" step="1" value="1" style="font-size:1.15rem;">
        </div>
        <div class="field">
          <label style="font-weight:750;">Unit Cost (₱)</label>
          <input class="input mono font-bold" id="f-pur-unit-cost" type="number" min="0" step="0.01" placeholder="0.00" style="font-size:1.15rem;">
        </div>
        <div class="field">
          <label style="font-weight:750;">Total Purchase (₱)</label>
          <input class="input mono font-bold" id="f-pur-total" type="number" min="0" step="0.01" placeholder="0.00" style="font-size:1.25rem;color:var(--danger-deep);">
        </div>
      </div>

      <div class="input-row" style="margin-top:10px;">
        <div class="field">
          <label>Purchase Date</label>
          <input class="input" id="f-pur-date" type="date" value="${today}">
        </div>
        <div class="field">
          <label>Payment Method</label>
          <div id="pur-method-wrap"></div>
        </div>
        <div class="field">
          <label>Receipt / Reference No. <span class="text-xs text-faint font-normal">(Optional)</span></label>
          <input class="input mono" id="f-pur-ref" placeholder="e.g. SI-88219, Cash Slip">
        </div>
      </div>

      <div class="field" style="margin-top:12px;padding:10px 14px;background:var(--paper-dim);border-radius:var(--r-md);border:1px solid var(--line);">
        <label class="switch-row" style="cursor:pointer;margin-bottom:0;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <strong style="font-size:.92rem;">Update Inventory Stock & Cost Automatically</strong>
            <div class="text-xs text-faint">Adds purchased pieces to stock and updates product unit cost.</div>
          </div>
          <span class="switch">
            <input type="checkbox" id="f-pur-sync-inv" checked>
            <span class="track"></span>
          </span>
        </label>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("shopping-cart",{size:18})} Log Wholesale Purchase`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { label: "Log Purchase", cls: "btn-primary btn-lg", onClick: () => {
          const prodName = (modal.querySelector("#f-pur-name").value || "").trim();
          let brand = (modal.querySelector("#f-pur-brand").value || "").trim();
          const seller = (modal.querySelector("#f-pur-seller").value || "").trim() || "Wholesale Seller";
          const qty = parseInt(modal.querySelector("#f-pur-qty").value, 10) || 0;
          const unitCost = parseFloat(modal.querySelector("#f-pur-unit-cost").value) || 0;
          const totalCost = parseFloat(modal.querySelector("#f-pur-total").value) || (qty * unitCost);
          const date = modal.querySelector("#f-pur-date").value || today;
          const method = UISelect.getValue("pur-method") || "Cash";
          const refNo = (modal.querySelector("#f-pur-ref").value || "").trim();
          const syncInv = modal.querySelector("#f-pur-sync-inv").checked;

          if(!prodName){
            Utils.toast("Please select or enter a product name.", "warn");
            return;
          }
          if(qty <= 0){
            Utils.toast("Quantity bought must be at least 1.", "warn");
            return;
          }
          if(totalCost <= 0){
            Utils.toast("Total purchase cost must be greater than zero.", "warn");
            return;
          }

          if(brand){
            const cleanBrand = brand.replace(/^New Brand\s*["']?/i, "").replace(/["']?$/i, "").trim();
            recordBrandName(cleanBrand || brand);
          }

          if(syncInv){
            const allProds = DB.getProducts();
            let p = selectedProduct ? allProds.find(x => x.id === selectedProduct.id) : allProds.find(x => x.name.toLowerCase() === prodName.toLowerCase());
            if(p){
              p.stock = (p.stock || 0) + qty;
              if(unitCost > 0) p.cost = unitCost;
              if(brand && !p.brand) p.brand = brand.replace(/^New Brand\s*["']?/i, "").replace(/["']?$/i, "").trim();
              DB.setProducts(allProds);
              DB.addRestockLog({ product_id: p.id, product_name: p.name, quantity_added: qty, unit_cost: unitCost, total_cost: totalCost, supplier_name: seller });
            } else {
              const cleanB = brand.replace(/^New Brand\s*["']?/i, "").replace(/["']?$/i, "").trim();
              const newProd = {
                id: Utils.uid("prod"),
                name: prodName,
                brand: cleanB,
                category: "Misc",
                cost: unitCost,
                price: unitCost > 0 ? Utils.round2(unitCost * 1.25) : 0,
                stock: qty,
                unit: "pc",
                lowStockThreshold: 5
              };
              allProds.unshift(newProd);
              DB.setProducts(allProds);
              DB.addRestockLog({ product_id: newProd.id, product_name: newProd.name, quantity_added: qty, unit_cost: unitCost, total_cost: totalCost, supplier_name: seller });
            }
          }

          const desc = `Wholesale Purchase: ${qty}x ${prodName}${brand ? ` [Brand: ${brand}]` : ""}`;
          DB.addExpense({
            category: "Wholesale Purchases",
            description: desc,
            amount: totalCost,
            date,
            method,
            recipient: seller,
            refNo,
            isPurchase: true,
            purchaseDetails: {
              productId: selectedProduct?.id || null,
              productName: prodName,
              brand,
              qty,
              unitCost,
              totalCost,
              seller
            }
          });

          Utils.Sound.cashChime();
          Utils.toast(`Logged purchase: ${Utils.money(totalCost)} (${qty}x ${prodName})`, "success");
          Modal.close();
          render();
        }}
      ]
    });

    modal.querySelector("#pur-method-wrap").innerHTML = UISelect.render("pur-method", ["Cash","Bank Transfer","GCash","Check","Card","Other"], "Cash");
    UISelect.bind("pur-method");

    // (2026-07-13) Combine select & name inputs into single field; was 2 inputs
    const prodDropdown = modal.querySelector("#pur-prod-dropdown");
    const selectedProdCard = modal.querySelector("#pur-selected-card");
    const selectedThumb = modal.querySelector("#pur-selected-thumb");
    const selectedName = modal.querySelector("#pur-selected-name");
    const selectedMeta = modal.querySelector("#pur-selected-meta");
    const nameInput = modal.querySelector("#f-pur-name");
    const brandInput = modal.querySelector("#f-pur-brand");
    const sellerInput = modal.querySelector("#f-pur-seller");
    const qtyInput = modal.querySelector("#f-pur-qty");
    const unitCostInput = modal.querySelector("#f-pur-unit-cost");
    const totalInput = modal.querySelector("#f-pur-total");

    function calcTotal(){
      const q = parseInt(qtyInput.value, 10) || 0;
      const c = parseFloat(unitCostInput.value) || 0;
      if(q > 0 && c >= 0){
        totalInput.value = (q * c).toFixed(2);
      }
    }
    qtyInput.oninput = calcTotal;
    unitCostInput.oninput = calcTotal;
    totalInput.oninput = () => {
      const q = parseInt(qtyInput.value, 10) || 0;
      const t = parseFloat(totalInput.value) || 0;
      if(q > 0 && t >= 0){
        unitCostInput.value = (t / q).toFixed(2);
      }
    };

    function renderProdDropdown(query = ""){
      const q = query.trim();
      const lower = q.toLowerCase();
      const isExactMatch = products.some(p => p.name.toLowerCase() === lower);
      const matches = products.filter(p => !q || p.name.toLowerCase().includes(lower) || (p.brand||"").toLowerCase().includes(lower) || (p.barcode||"").includes(q)).slice(0, 30);
      let html = "";
      if(q && !isExactMatch){
        html += `
          <div class="pur-prod-opt" data-new-prod="1" data-val="${Utils.escapeHtml(q)}" style="padding:8px 10px;border-radius:6px;cursor:pointer;background:var(--brand-tint);color:var(--brand-deep);font-weight:750;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span>✨ New Product &ldquo;${Utils.escapeHtml(q)}&rdquo;</span>
            <span class="badge badge-brand" style="font-size:.65rem;font-weight:800;">NEW PRODUCT</span>
          </div>`;
      }
      if(matches.length){
        html += matches.map(p => `
          <div class="pur-prod-opt" data-id="${p.id}" style="padding:7px 10px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line-faint);">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
              <span class="prod-thumb-sm" style="width:28px;height:28px;flex-shrink:0;margin:0;">${Utils.productThumb(p, { iconSize:14 })}</span>
              <div style="min-width:0;flex:1;">
                <div style="font-size:.88rem;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(p.name)}</div>
                <div class="text-xs text-faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.brand ? `<span class="badge badge-brand" style="font-size:.64rem;padding:1px 4px;margin-right:4px;">${Utils.escapeHtml(p.brand)}</span>` : ""}${Utils.escapeHtml(p.category || "")}</div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div class="mono font-bold" style="font-size:.84rem;color:var(--ink);">${Utils.money(p.cost || 0)}</div>
              <div class="text-xs text-faint mono">Stock: ${p.stock || 0}</div>
            </div>
          </div>
        `).join("");
      } else if(!q){
        html += `<div style="padding:10px;text-align:center;color:var(--ink-faint);font-size:.84rem;">Type product name to search or add new.</div>`;
      }
      prodDropdown.innerHTML = html;
      prodDropdown.style.display = "block";

      prodDropdown.querySelectorAll(".pur-prod-opt").forEach(el => {
        el.onmouseenter = () => el.style.background = el.dataset.newProd ? "var(--brand-tint)" : "var(--paper-dim)";
        el.onmouseleave = () => el.style.background = el.dataset.newProd ? "var(--brand-tint)" : "transparent";
        el.onclick = (e) => {
          e.stopPropagation();
          if(el.dataset.newProd){
            selectedProduct = null;
            selectedProdCard.style.display = "none";
            nameInput.value = el.dataset.val;
          } else {
            const p = products.find(x => x.id === el.dataset.id);
            if(p){
              selectedProduct = p;
              nameInput.value = p.name;
              brandInput.value = p.brand || "";
              if(p.cost) unitCostInput.value = p.cost;
              if(p.distributor && !sellerInput.value) sellerInput.value = p.distributor;
              calcTotal();
              selectedThumb.innerHTML = Utils.productThumb(p, { iconSize:16 });
              selectedName.textContent = p.name;
              selectedMeta.textContent = `Stock: ${p.stock} pcs · Cost: ${Utils.money(p.cost || 0)}${p.brand ? ` · Brand: ${p.brand}` : ""}`;
              selectedProdCard.style.display = "flex";
            }
          }
          prodDropdown.style.display = "none";
        };
      });
    }

    modal.querySelector("#btn-pur-clear-prod").onclick = () => {
      selectedProduct = null;
      selectedProdCard.style.display = "none";
      nameInput.value = "";
      nameInput.focus();
    };

    nameInput.onfocus = () => renderProdDropdown(nameInput.value);
    nameInput.oninput = () => {
      if(selectedProduct && nameInput.value.trim().toLowerCase() !== selectedProduct.name.toLowerCase()){
        selectedProduct = null;
        selectedProdCard.style.display = "none";
      }
      renderProdDropdown(nameInput.value);
    };

    const brandDropdown = modal.querySelector("#pur-brand-dropdown");
    function renderBrandDropdown(query = ""){
      const q = query.trim();
      const allBrands = getAllRecordedBrands();
      const lower = q.toLowerCase();
      const isExactMatch = allBrands.some(b => b.toLowerCase() === lower);
      const filtered = q ? allBrands.filter(b => b.toLowerCase().includes(lower)) : allBrands;

      let html = "";
      if(q && !isExactMatch){
        html += `
          <div class="pur-brand-item" data-new-brand="1" data-val="New Brand &quot;${Utils.escapeHtml(q)}&quot;" data-raw="${Utils.escapeHtml(q)}" style="padding:8px 10px;border-radius:6px;cursor:pointer;background:var(--brand-tint);color:var(--brand-deep);font-weight:750;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span>✨ New Brand &ldquo;${Utils.escapeHtml(q)}&rdquo;</span>
            <span class="badge badge-brand" style="font-size:.65rem;font-weight:800;">NEW BRAND</span>
          </div>`;
      }
      if(filtered.length){
        html += filtered.slice(0, 25).map(b => `
          <div class="pur-brand-item" data-val="${Utils.escapeHtml(b)}" style="padding:6px 10px;border-radius:6px;cursor:pointer;font-size:.86rem;font-weight:600;display:flex;align-items:center;justify-content:space-between;">
            <span>${Utils.escapeHtml(b)}</span>
            <span class="text-xs text-faint">Recorded</span>
          </div>
        `).join("");
      } else if(!q){
        html += `<div style="padding:10px;text-align:center;color:var(--ink-faint);font-size:.82rem;">No brands recorded yet. Type any brand name.</div>`;
      }
      brandDropdown.innerHTML = html;
      brandDropdown.style.display = "block";

      brandDropdown.querySelectorAll(".pur-brand-item").forEach(item => {
        item.onmouseenter = () => item.style.background = item.dataset.newBrand ? "var(--brand-tint)" : "var(--paper-dim)";
        item.onmouseleave = () => item.style.background = item.dataset.newBrand ? "var(--brand-tint)" : "transparent";
        item.onclick = (e) => {
          e.stopPropagation();
          const val = item.dataset.val;
          const raw = item.dataset.raw || val;
          brandInput.value = val;
          recordBrandName(raw);
          brandDropdown.style.display = "none";
        };
      });
    }

    brandInput.onfocus = () => renderBrandDropdown(brandInput.value);
    brandInput.oninput = () => renderBrandDropdown(brandInput.value);

    modal.addEventListener("click", (e) => {
      if(!e.target.closest("#pur-prod-dropdown") && e.target !== nameInput){
        prodDropdown.style.display = "none";
      }
      if(!e.target.closest("#pur-brand-dropdown") && e.target !== brandInput){
        brandDropdown.style.display = "none";
      }
    });
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
        <!-- (2026-07-13) Add Log Purchases button; was Record Expense only -->
        <div class="input-row" style="width:auto;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline" id="btn-export-exp">${Icons.get("download",{size:15})} Export CSV</button>
          <button class="btn btn-outline" id="btn-add-exp">${Icons.get("dollar-sign",{size:15})} Log Expense</button>
          <button class="btn btn-primary" id="btn-add-purchase">${Icons.get("shopping-bag",{size:15})} Log Purchases</button>
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

    // (2026-07-13) Bind Log Purchases button to openPurchaseModal; was none
    document.getElementById("btn-add-exp").onclick = () => openExpenseModal();
    document.getElementById("btn-add-purchase").onclick = () => openPurchaseModal();
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
