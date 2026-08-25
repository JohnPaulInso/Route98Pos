// ============================================================
// inventory.js — product & category management
// ============================================================
const Inventory = (() => {
  let searchTerm = "";
  let categoryFilter = "All";
  let sortBy = "name";
  let sortOrder = "asc";
  let stockFilter = "all"; // all | in | low | out

  function brandList(){
    return [...new Set(DB.getProducts().map(p=>p.brand).filter(Boolean))].sort();
  }
  function distributorList(){
    return [...new Set(DB.getProducts().map(p=>p.distributor).filter(Boolean))].sort();
  }

  // (2026-07-13) Add in-stock filter & bidirectional column sorting; was fixed name
  function list(){
    const catFilterLower = (categoryFilter || "All").trim().toLowerCase();
    let items = DB.getProducts().filter(p => {
      const prodCatLower = (p.category || "").trim().toLowerCase();
      const matchCat = catFilterLower === "all" || prodCatLower === catFilterLower;
      const term = searchTerm.toLowerCase();
      // (2026-07-13) Include category name in inventory search; was brand/distributor
      const matchSearch = !term ||
        p.name.toLowerCase().includes(term) ||
        (p.brand||"").toLowerCase().includes(term) ||
        (p.distributor||"").toLowerCase().includes(term) ||
        (p.category||"").toLowerCase().includes(term) ||
        (p.barcode||"").includes(searchTerm);
      const matchStock = stockFilter === "all" ||
        (stockFilter === "in" && p.stock > 0) ||
        (stockFilter === "low" && p.stock > 0 && p.stock <= p.lowStockThreshold) ||
        (stockFilter === "out" && p.stock <= 0);
      return matchCat && matchSearch && matchStock;
    });
    items.sort((a,b) => {
      let res = 0;
      if(sortBy === "name") res = a.name.localeCompare(b.name);
      else if(sortBy === "barcode") res = (a.barcode||"").localeCompare(b.barcode||"");
      else if(sortBy === "category") res = (a.category||"").localeCompare(b.category||"");
      else if(sortBy === "cost") res = (a.cost||0) - (b.cost||0);
      else if(sortBy === "price") res = (a.price||0) - (b.price||0);
      else if(sortBy === "potential") res = ((a.stock||0)*(a.price||0)) - ((b.stock||0)*(b.price||0));
      else if(sortBy === "profit") res = (((a.price||0)-(a.cost||0))*(a.stock||0)) - (((b.price||0)-(b.cost||0))*(b.stock||0));
      else if(sortBy === "stock") res = (a.stock||0) - (b.stock||0);
      else if(sortBy === "brand") res = (a.brand||"").localeCompare(b.brand||"");
      else if(sortBy === "status"){
        const sv = p => p.stock <= 0 ? 0 : p.stock <= p.lowStockThreshold ? 1 : 2;
        res = sv(a) - sv(b);
      }
      return sortOrder === "desc" ? -res : res;
    });
    return items;
  }

  function openProductForm(product = null){
    const cats = DB.getCategories();
    const isEdit = !!product;
    const brands = brandList(), distributors = distributorList();
    const body = `
      <div class="input-row" style="align-items:flex-start;">
        <div class="image-preview" id="img-preview">${Utils.productThumb(product || { category: cats[0] }, { iconSize:30 })}</div>
        <div style="flex:1;">
          <div class="field"><label>Product name</label><input class="input" id="f-name" value="${product?Utils.escapeHtml(product.name):""}" placeholder="e.g. Instant Noodles"></div>
          <div class="field"><label>Image URL <span class="text-faint" style="text-transform:none;font-weight:500;">(paste a real photo link — optional)</span></label>
            <input class="input" id="f-image" value="${product?.imageUrl?Utils.escapeHtml(product.imageUrl):""}" placeholder="https://…">
          </div>
        </div>
      </div>
      <div class="input-row">
        <div class="field"><label>Brand</label><input class="input" id="f-brand" list="brand-list" value="${product?Utils.escapeHtml(product.brand||""):""}" placeholder="e.g. Lucky Me!"></div>
        <div class="field"><label>Manufacturer / Distributor</label><input class="input" id="f-distributor" list="dist-list" value="${product?Utils.escapeHtml(product.distributor||""):""}" placeholder="e.g. Monde Nissin Corp."></div>
      </div>
      <datalist id="brand-list">${brands.map(b=>`<option value="${Utils.escapeHtml(b)}">`).join("")}</datalist>
      <datalist id="dist-list">${distributors.map(d=>`<option value="${Utils.escapeHtml(d)}">`).join("")}</datalist>
      <div class="input-row">
        <div class="field"><label>Barcode / SKU</label>
          <div style="display:flex;gap:6px;">
            <input class="input scan-target" id="f-barcode" value="${product?.barcode||""}" placeholder="Scan or type">
            <button type="button" class="btn btn-ghost btn-icon" id="f-scan-btn" title="Scan with camera">${Icons.get("camera",{size:16})}</button>
          </div>
        </div>
        <div class="field"><label>Category</label><div id="f-category-wrap"></div></div>
      </div>
      <div class="input-row">
        <div class="field"><label>Cost price</label><input class="input" id="f-cost" type="number" step="0.01" value="${product?.cost??""}"></div>
        <div class="field"><label>Selling price</label><input class="input" id="f-price" type="number" step="0.01" value="${product?.price??""}"></div>
      </div>
      <div class="input-row">
        <div class="field"><label>Stock quantity (total pieces)</label><input class="input" id="f-stock" type="number" step="1" value="${product?.stock??""}"></div>
        <div class="field"><label>Unit</label><div id="f-unit-wrap"></div></div>
      </div>
      <!-- (2026-07-13) Add dual-unit pack & piece tracking in inventory; was piece only -->
      <div class="field" style="margin-top:10px;padding:12px;background:var(--paper-dim);border-radius:var(--r-md);border:1px solid var(--line);">
        <label class="switch-row" style="cursor:pointer;margin-bottom:0;">
          <div>
            <strong>Dual-Unit Tracking (Packs & Pieces)</strong>
            <div class="text-xs text-faint">Sell by full pack and loose pieces from shared piece stock.</div>
          </div>
          <span class="switch">
            <input type="checkbox" id="f-has-dual" ${product?.piecesPerPack > 1 ? "checked" : ""}>
            <span class="track"></span>
          </span>
        </label>
        <div id="f-dual-fields" style="display:${product?.piecesPerPack > 1 ? "block" : "none"};margin-top:10px;padding-top:10px;border-top:1px dashed var(--line-strong);">
          <div class="input-row">
            <div class="field">
              <label>Pieces per Pack</label>
              <input class="input" id="f-pack-size" type="number" min="2" step="1" value="${product?.piecesPerPack || 10}" placeholder="e.g. 10">
            </div>
            <div class="field">
              <label>Pack Selling Price</label>
              <input class="input" id="f-pack-price" type="number" min="0" step="0.01" value="${product?.packPrice ?? (product?.price ? product.price * 10 : "")}" placeholder="e.g. 90.00">
            </div>
          </div>
          <div class="input-row" style="margin-top:8px;">
            <div class="field">
              <label>Pack Cost Price</label>
              <input class="input" id="f-pack-cost" type="number" min="0" step="0.01" value="${product?.packCost ?? (product?.cost ? product.cost * 10 : "")}" placeholder="e.g. 70.00">
            </div>
            <div class="field">
              <label>Pack Barcode <span class="text-faint">(optional)</span></label>
              <input class="input" id="f-pack-barcode" value="${product?.packBarcode || ""}" placeholder="Outer pack barcode">
            </div>
          </div>
        </div>
      </div>
      <div class="field" style="margin-top:10px;"><label>Low stock alert threshold</label><input class="input" id="f-lowstock" type="number" step="1" value="${product?.lowStockThreshold??5}"></div>`;
    const modal = Modal.open({
      title: isEdit ? `${Icons.get("edit",{size:17})} Edit Product` : `${Icons.get("plus",{size:17})} Add Product`,
      body, wide:true,
      actions: [
        { label:"Cancel", cls:"btn-ghost" },
        { label: isEdit ? "Save Changes" : "Add Product", cls:"btn-primary", onClick: () => saveProduct(product, modal) }
      ]
    });

    modal.querySelector("#f-category-wrap").innerHTML = UISelect.render("f-category", cats, product?.category || cats[0]);
    UISelect.bind("f-category", () => updatePreview(modal));
    modal.querySelector("#f-unit-wrap").innerHTML = UISelect.render("f-unit", ["pc","pack","kg","g","L","ml","box"], product?.unit || "pc");
    UISelect.bind("f-unit");

    const dualCheck = modal.querySelector("#f-has-dual");
    if(dualCheck){
      dualCheck.onchange = (e) => {
        modal.querySelector("#f-dual-fields").style.display = e.target.checked ? "block" : "none";
      };
    }

    modal.querySelector("#f-scan-btn").onclick = () => Scanner.openCameraScan((code)=>{ modal.querySelector("#f-barcode").value = code; });
    modal.querySelector("#f-image").addEventListener("input", Utils.debounce(()=>updatePreview(modal), 250));
    modal.querySelector("#f-name").focus();

    function updatePreview(m){
      const url = m.querySelector("#f-image").value.trim();
      const cat = UISelect.getValue("f-category");
      m.querySelector("#img-preview").innerHTML = Utils.productThumb({ imageUrl:url, category:cat, name:"" }, { iconSize:30 });
    }
  }

  function saveProduct(product, modal){
    const name = modal.querySelector("#f-name").value.trim();
    if(!name){ Utils.toast("Product name is required.", "error"); return; }
    const hasDual = modal.querySelector("#f-has-dual")?.checked;
    const piecesPerPack = hasDual ? Math.max(2, Number(modal.querySelector("#f-pack-size")?.value)||10) : 1;
    const price = Number(modal.querySelector("#f-price").value)||0;
    const cost = Number(modal.querySelector("#f-cost").value)||0;
    const payload = {
      name,
      imageUrl: modal.querySelector("#f-image").value.trim(),
      brand: modal.querySelector("#f-brand").value.trim(),
      distributor: modal.querySelector("#f-distributor").value.trim(),
      barcode: modal.querySelector("#f-barcode").value.trim(),
      category: UISelect.getValue("f-category"),
      cost,
      price,
      stock: Number(modal.querySelector("#f-stock").value)||0,
      unit: UISelect.getValue("f-unit"),
      lowStockThreshold: Number(modal.querySelector("#f-lowstock").value)||5,
      piecesPerPack,
      packPrice: hasDual ? (Number(modal.querySelector("#f-pack-price")?.value) || (price * piecesPerPack)) : 0,
      packCost: hasDual ? (Number(modal.querySelector("#f-pack-cost")?.value) || (cost * piecesPerPack)) : 0,
      packBarcode: hasDual ? modal.querySelector("#f-pack-barcode")?.value.trim() || "" : ""
    };
    if(product) DB.updateProduct(product.id, payload);
    else {
      DB.addProduct(payload);
      if(payload.stock > 0){
        DB.addRestockLog({
          product_id: payload.barcode || payload.name,
          product_name: payload.name,
          quantity_added: payload.stock,
          unit_cost: cost,
          total_cost: payload.stock * cost,
          supplier_name: payload.distributor || payload.brand || "Initial Stock",
          timestamp: Date.now()
        });
      }
    }
    Utils.toast(product ? "Product updated." : "Product added.", "success");
    Modal.close();
    renderTable();
  }

  // (2026-07-13) Format stock adjust modal with large typography; was small text
  function openStockAdjust(product){
    const hasDual = product.piecesPerPack > 1;
    const fullPacks = hasDual ? Math.floor(product.stock / product.piecesPerPack) : 0;
    const loose = hasDual ? product.stock % product.piecesPerPack : 0;
    const body = `
      <div class="card card-tight" style="margin-bottom:16px;background:var(--paper-dim);border:1.5px solid var(--line);padding:12px 18px;border-radius:12px;">
        <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Current Stock Level</div>
        <div class="mono" style="font-size:1.55rem;font-weight:900;color:var(--brand-deep);">${product.stock} ${product.unit||"pc"}${hasDual ? ` <span class="text-sm text-faint font-normal">(${fullPacks} pk + ${loose} loose)</span>` : ""}</div>
      </div>
      <div class="field"><label>Direction</label><div id="adj-dir-wrap"></div></div>
      ${hasDual ? `<div class="field"><label>Adjustment Unit</label><div id="adj-unit-wrap"></div></div>` : ""}
      <div class="field"><label>Quantity</label><input class="input mono" id="adj-qty" type="number" min="0" step="1" placeholder="Quantity" style="font-size:1.35rem;font-weight:800;text-align:center;"></div>
      <div class="field"><label>Reason</label><div id="adj-reason-wrap"></div></div>`;
    const modal = Modal.open({
      title:`${Icons.get("package",{size:17})} Adjust Stock — ${Utils.escapeHtml(product.name)}`, body,
      actions:[{label:"Cancel",cls:"btn-ghost"},{label:"Apply",cls:"btn-primary", onClick:()=>{
        const dir = Number(UISelect.getValue("adj-dir"));
        const qty = Number(document.getElementById("adj-qty").value)||0;
        if(qty<=0){ Utils.toast("Enter a quantity.","warn"); return; }
        const adjUnit = hasDual ? UISelect.getValue("adj-unit") : "piece";
        const totalDeltaPieces = dir * qty * (adjUnit === "pack" ? product.piecesPerPack : 1);
        const reason = UISelect.getValue("adj-reason");
        DB.adjustStock(product.id, totalDeltaPieces, reason);
        Utils.toast("Stock updated.","success");
        Modal.close(); renderTable();
      }}]
    });
    modal.querySelector("#adj-dir-wrap").innerHTML = UISelect.render("adj-dir", [
      { value:"1", label:"Add stock (restock)" }, { value:"-1", label:"Remove stock" }
    ], "1");
    UISelect.bind("adj-dir");
    if(hasDual){
      modal.querySelector("#adj-unit-wrap").innerHTML = UISelect.render("adj-unit", [
        { value:"piece", label:`Pieces (x1 pc)` },
        { value:"pack",  label:`Packs (x${product.piecesPerPack} pcs)` }
      ], "piece");
      UISelect.bind("adj-unit");
    }
    modal.querySelector("#adj-reason-wrap").innerHTML = UISelect.render("adj-reason",
      ["Restock / Delivery","Damaged / Spoiled","Stock count correction","Return to supplier","Other"], "Restock / Delivery");
    UISelect.bind("adj-reason");
  }

  function deleteProduct(product){
    Modal.confirm({
      title:"Delete product?", message:`"${Utils.escapeHtml(product.name)}" will be permanently removed from inventory.`, danger:true,
      onConfirm: () => { DB.deleteProduct(product.id); Utils.toast("Product deleted.","success"); renderTable(); }
    });
  }

  // (2026-07-13) Uppercase categories & export button; was mixed unexported
  function manageCategories(){
    const cats = DB.getCategories();
    const body = `
      <div class="flex-between" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span class="text-sm text-faint"><strong>${cats.length}</strong> Category(ies)</span>
        <button class="btn btn-sm btn-outline" id="btn-export-cats">${Icons.get("download",{size:13})} Export Categories (.csv)</button>
      </div>
      <div class="table-wrap" style="max-height:280px;overflow-y:auto;margin-bottom:12px;"><table class="data"><tbody>
        ${cats.map(c=>`<tr><td><strong style="letter-spacing:.02em;">${Utils.escapeHtml(c.toUpperCase())}</strong></td><td style="text-align:right;"><button class="btn btn-sm btn-ghost" data-del-cat="${Utils.escapeHtml(c)}">${Icons.get("x",{size:13})} Remove</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="input-row"><input class="input" id="new-cat" placeholder="NEW CATEGORY NAME (ALL CAPS)" style="text-transform:uppercase;"><button class="btn btn-primary" id="add-cat">Add</button></div>`;
    const modal = Modal.open({ title:`${Icons.get("tag",{size:17})} Manage Categories`, body, actions:[{label:"Done",cls:"btn-primary"}] });
    modal.querySelector("#btn-export-cats")?.addEventListener("click", ImportExport.exportCategoriesCSV);
    modal.querySelectorAll("[data-del-cat]").forEach(btn => btn.onclick = () => {
      const name = btn.dataset.delCat.toUpperCase();
      const inUse = DB.getProducts().some(p => (p.category || "").toUpperCase() === name);
      if(inUse){ Utils.toast("Can't remove — products still use this category.","warn"); return; }
      DB.setCategories(DB.getCategories().filter(c => c.toUpperCase() !== name));
      manageCategories();
      renderTable();
    });
    modal.querySelector("#add-cat").onclick = () => {
      const val = modal.querySelector("#new-cat").value.trim().toUpperCase();
      if(!val) return;
      const cats2 = DB.getCategories();
      if(cats2.includes(val)){ Utils.toast("Category already exists.","warn"); return; }
      DB.setCategories([...cats2, val]);
      manageCategories();
      renderTable();
    };
  }

  // (2026-07-13) Add 100/page pagination & category badges; was unpaginated text
  let selectMode = false;
  let selectedIds = new Set();
  let currentPage = 1;
  const PAGE_SIZE = 100;

  function toggleSelectMode(enable){
    selectMode = typeof enable === "boolean" ? enable : !selectMode;
    if(!selectMode) selectedIds.clear();
    renderHeaderActions();
    renderTable();
  }

  function deleteSelectedProducts(){
    const count = selectedIds.size;
    if(count <= 0) return;
    Modal.confirm({
      title: `Delete ${count} product${count===1?"":"s"}?`,
      message: `${count} selected product${count===1?"":"s"} will be permanently removed from inventory.`,
      danger: true,
      onConfirm: () => {
        DB.setProducts(DB.getProducts().filter(p => !selectedIds.has(p.id)));
        Utils.toast(`${count} product${count===1?"":"s"} deleted.`, "success");
        selectedIds.clear();
        toggleSelectMode(false);
      }
    });
  }

  function renderHeaderActions(){
    const act = document.getElementById("inv-actions");
    if(!act) return;
    const items = list();
    const count = selectedIds.size;
    if(selectMode){
      const allSelected = items.length > 0 && items.every(p => selectedIds.has(p.id));
      act.innerHTML = `
        <button class="btn btn-ghost" id="btn-select-all">${allSelected ? "Deselect All" : "Select All"}</button>
        <button class="btn btn-danger" id="btn-delete-selected" ${count === 0 ? "disabled" : ""}>${Icons.get("trash",{size:15})} Delete (${count})</button>
        <button class="btn btn-ghost" id="btn-cancel-select">${Icons.get("x",{size:15})} Done</button>
      `;
      document.getElementById("btn-select-all").onclick = () => {
        if(allSelected){
          items.forEach(p => selectedIds.delete(p.id));
        } else {
          items.forEach(p => selectedIds.add(p.id));
        }
        renderHeaderActions();
        renderTable();
      };
      document.getElementById("btn-delete-selected").onclick = () => deleteSelectedProducts();
      document.getElementById("btn-cancel-select").onclick = () => toggleSelectMode(false);
    } else {
      act.innerHTML = `
        <button class="btn btn-ghost" id="btn-select-mode">${Icons.get("check",{size:15})} Select</button>
        <button class="btn btn-ghost" id="btn-restock-logs">${Icons.get("truck",{size:15})} Restock Log</button>
        <button class="btn btn-ghost" id="btn-categories">${Icons.get("tag",{size:15})} Categories</button>
        <button class="btn btn-ghost" id="btn-export-inv">${Icons.get("download",{size:15})} Export</button>
        <button class="btn btn-ghost" id="btn-import-inv">${Icons.get("upload",{size:15})} Import</button>
        <button class="btn btn-primary" id="btn-add-product">${Icons.get("plus",{size:15})} Add Product</button>
      `;
      document.getElementById("btn-select-mode").onclick = () => toggleSelectMode(true);
      document.getElementById("btn-restock-logs").onclick = openRestockLogModal;
      document.getElementById("btn-add-product").onclick = () => openProductForm();
      document.getElementById("btn-categories").onclick = manageCategories;
      document.getElementById("btn-export-inv").onclick = ImportExport.exportInventoryCSV;
      document.getElementById("btn-import-inv").onclick = () => document.getElementById("inv-import-file").click();
    }
  }

  // (2026-07-13) Add potential rev column & restock log modal; was plain inventory
  // (2026-07-13) Group restock logs by day & add batch scanner; was single PO
  function openRestockLogModal(){
    let filter = "all";
    function renderModalBody(modal){
      const summary = Analytics.restockSummary(filter);
      const dayGroups = {};
      (summary.logs || []).forEach(l => {
        const ts = l.timestamp || l.ts || Date.now();
        const d = new Date(ts);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
        if(!dayGroups[dayKey]){
          dayGroups[dayKey] = { label: dayLabel, logs: [], totalCost: 0, totalUnits: 0 };
        }
        dayGroups[dayKey].logs.push(l);
        dayGroups[dayKey].totalCost += (l.total_cost || ((l.unit_cost || 0) * (l.quantity_added || l.quantity || 0)));
        dayGroups[dayKey].totalUnits += (l.quantity_added || l.quantity || 0);
      });

      const dayKeys = Object.keys(dayGroups).sort((a,b) => b.localeCompare(a));

      modal.querySelector("#restock-modal-content").innerHTML = `
        <div class="grid-3" style="margin-bottom:16px;gap:12px;">
          <div class="card card-tight" style="border:1.5px solid var(--brand);background:var(--brand-tint);padding:14px 18px;border-radius:12px;">
            <div class="text-faint text-xs" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;color:var(--brand-deep);">Total Capital Spent</div>
            <strong class="mono" style="font-size:1.65rem;font-weight:900;color:var(--brand-deep);">${Utils.money(summary.totalCapitalSpent)}</strong>
          </div>
          <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:14px 18px;border-radius:12px;">
            <div class="text-faint text-xs" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Total Units Added</div>
            <strong class="mono" style="font-size:1.65rem;font-weight:850;">${summary.totalUnitsPurchased.toLocaleString()} pcs</strong>
          </div>
          <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:14px 18px;border-radius:12px;">
            <div class="text-faint text-xs" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Restock Orders</div>
            <strong class="mono" style="font-size:1.65rem;font-weight:850;">${summary.count} orders</strong>
          </div>
        </div>
        <div style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;">
          ${dayKeys.length ? dayKeys.map(k => {
            const grp = dayGroups[k];
            return `
            <div class="card" style="padding:0;overflow:hidden;border:1.5px solid var(--line);">
              <div class="flex-between" style="background:var(--paper-dim);padding:12px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <strong style="font-size:1.15rem;color:var(--ink);">${grp.label}</strong>
                  <span class="badge badge-brand" style="font-size:.84rem;font-weight:800;">${grp.logs.length} item(s)</span>
                </div>
                <div style="font-size:1rem;font-weight:750;">
                  <span class="text-faint">+${grp.totalUnits.toLocaleString()} units</span> · <strong class="mono" style="color:var(--brand-deep);font-size:1.15rem;">${Utils.money(grp.totalCost)}</strong>
                </div>
              </div>
              <div class="table-wrap" style="border:none;border-radius:0;">
                <table class="data" style="font-size:1.02rem;">
                  <thead>
                    <tr style="font-size:.82rem;text-transform:uppercase;background:transparent;">
                      <th style="padding:10px 14px;">Time</th>
                      <th style="padding:10px 14px;">Product</th>
                      <th style="padding:10px 14px;">Supplier</th>
                      <th style="padding:10px 14px;text-align:center;">Qty Added</th>
                      <th style="padding:10px 14px;text-align:right;">Unit Cost</th>
                      <th style="padding:10px 14px;text-align:right;">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${grp.logs.map(l => `
                      <tr>
                        <td class="text-sm text-faint" style="font-size:.92rem;">${new Date(l.timestamp||l.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</td>
                        <td><strong style="font-size:1.04rem;">${Utils.escapeHtml(l.product_name||l.productName)}</strong></td>
                        <td class="text-sm text-faint" style="font-size:.95rem;">${Utils.escapeHtml(l.supplier_name||l.supplierName||"—")}</td>
                        <td class="mono font-bold" style="font-size:1.12rem;color:var(--success-deep);text-align:center;">+${l.quantity_added||l.quantity}</td>
                        <td class="mono" style="font-size:1.02rem;text-align:right;">${Utils.money(l.unit_cost||l.unitCost||0)}</td>
                        <td class="mono font-bold" style="font-size:1.12rem;color:var(--brand-deep);text-align:right;">${Utils.money(l.total_cost||0)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>`;
          }).join("") : `<div class="empty" style="padding:36px;"><p class="text-faint" style="font-size:1.1rem;">No purchase/restock records found for this period.</p></div>`}
        </div>`;
    }

    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;" id="restock-period-pills">
          <button class="chip active" data-p="all">All Time</button>
          <button class="chip" data-p="today">Today</button>
          <button class="chip" data-p="month">This Month</button>
          <button class="chip" data-p="30d">Last 30 Days</button>
        </div>
        <button class="btn btn-primary" id="btn-manual-restock" style="font-size:1.05rem;padding:9px 18px;border-radius:10px;">${Icons.get("plus",{size:16})} Restock Item</button>
      </div>
      <div id="restock-modal-content"></div>`;

    const modal = Modal.open({
      title: `${Icons.get("truck",{size:18})} Purchase Expense Tracking & Restock Log`,
      body,
      wide: true,
      actions: [{ label:"Close", cls:"btn-ghost btn-lg" }]
    });

    renderModalBody(modal);

    modal.querySelectorAll("#restock-period-pills .chip").forEach(c => {
      c.onclick = () => {
        modal.querySelectorAll("#restock-period-pills .chip").forEach(x => x.classList.remove("active"));
        c.classList.add("active");
        filter = c.dataset.p;
        renderModalBody(modal);
      };
    });

    modal.querySelector("#btn-manual-restock").onclick = () => {
      openBatchRestockModal(() => renderModalBody(modal));
    };
  }

  function openBatchRestockModal(onSaved){
    const allProducts = DB.getProducts();
    let restockList = [];
    let supplier = "";

    function renderRestockBody(modal){
      const listWrap = modal.querySelector("#restock-items-list");
      const totalUnits = restockList.reduce((s,i)=> s + (i.unitType === "pack" && i.product.piecesPerPack > 1 ? i.qty * i.product.piecesPerPack : i.qty), 0);
      const totalCost = restockList.reduce((s,i)=> s + (i.qty * (i.cost || 0)), 0);

      modal.querySelector("#restock-summary-bar").innerHTML = `
        <div class="flex-between" style="font-size:1.1rem;background:var(--brand-tint);padding:12px 18px;border-radius:12px;border:1.5px solid var(--brand);">
          <span style="font-weight:800;color:var(--brand-deep);"><strong>${restockList.length}</strong> items in batch · <strong>+${totalUnits.toLocaleString()}</strong> units</span>
          <strong class="mono" style="font-size:1.35rem;font-weight:900;color:var(--brand-deep);">Total Cost: ${Utils.money(totalCost)}</strong>
        </div>
      `;

      if(!restockList.length){
        listWrap.innerHTML = `
          <div class="empty" style="padding:36px 20px;background:var(--paper-dim);border:1.5px dashed var(--line-strong);border-radius:12px;">
            ${Icons.get("scan",{size:40})}
            <h4 style="font-size:1.25rem;font-weight:850;margin-top:10px;color:var(--ink);">Scan Barcode or Search Items Above</h4>
            <p class="text-sm text-faint" style="font-size:1rem;margin-top:4px;">Scan all items delivered in this batch, review quantities, then confirm.</p>
          </div>
        `;
        return;
      }

      listWrap.innerHTML = `
        <div class="table-wrap" style="max-height:320px;overflow-y:auto;border:1.5px solid var(--line);">
          <table class="data" style="font-size:1.02rem;">
            <thead>
              <tr style="font-size:.84rem;text-transform:uppercase;">
                <th style="padding:12px 14px;">Product</th>
                <th style="text-align:center;padding:12px 14px;">Current Stock</th>
                <th style="text-align:center;width:180px;padding:12px 14px;">Qty to Add</th>
                <th style="text-align:right;width:120px;padding:12px 14px;">Unit Cost</th>
                <th style="text-align:right;width:130px;padding:12px 14px;">Subtotal</th>
                <th style="width:44px;padding:12px 10px;"></th>
              </tr>
            </thead>
            <tbody>
              ${restockList.map((item, idx) => {
                const p = item.product;
                const lineTotal = (item.cost || 0) * item.qty;
                return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span class="prod-thumb-sm">${Utils.productThumb(p, { iconSize:18 })}</span>
                      <div>
                        <strong style="font-size:1.08rem;">${Utils.escapeHtml(p.name)}</strong>
                        <div class="text-xs text-faint" style="font-size:.86rem;">${p.barcode ? `Barcode: ${p.barcode}` : (p.category || "")}</div>
                      </div>
                    </div>
                  </td>
                  <td style="text-align:center;">
                    <span class="badge badge-neutral mono" style="font-size:1rem;font-weight:900;padding:6px 12px;border-radius:10px;background:var(--paper-dim);border:1.5px solid var(--line-strong);">
                      ${p.stock} ${p.unit||"pc"}
                    </span>
                  </td>
                  <td style="text-align:center;">
                    <div style="display:inline-flex;align-items:center;gap:4px;border:1.5px solid var(--line-strong);border-radius:10px;padding:2px;background:var(--paper);">
                      <button type="button" class="btn btn-sm btn-ghost" data-dec="${idx}" style="padding:6px 12px;font-size:1.25rem;font-weight:900;">−</button>
                      <input type="number" class="input mono font-bold" data-qty-idx="${idx}" min="1" value="${item.qty}" style="width:68px;padding:4px 6px;text-align:center;font-size:1.25rem;border:none;background:transparent;">
                      <button type="button" class="btn btn-sm btn-ghost" data-inc="${idx}" style="padding:6px 12px;font-size:1.25rem;font-weight:900;">+</button>
                    </div>
                  </td>
                  <td style="text-align:right;">
                    <input type="number" class="input mono font-bold" data-cost-idx="${idx}" min="0" step="0.01" value="${item.cost}" style="width:96px;padding:8px 10px;font-size:1.05rem;text-align:right;border-radius:8px;">
                  </td>
                  <td class="mono font-bold" style="text-align:right;font-size:1.18rem;color:var(--brand-deep);">
                    ${Utils.money(lineTotal)}
                  </td>
                  <td style="text-align:center;">
                    <button type="button" class="btn btn-sm btn-ghost" data-remove="${idx}" title="Remove item" style="color:var(--danger);padding:6px;">${Icons.get("trash",{size:16})}</button>
                  </td>
                </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      listWrap.querySelectorAll("[data-dec]").forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.dec);
          if(restockList[idx].qty > 1){
            restockList[idx].qty--;
            renderRestockBody(modal);
          }
        };
      });

      listWrap.querySelectorAll("[data-inc]").forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.inc);
          restockList[idx].qty++;
          renderRestockBody(modal);
        };
      });

      listWrap.querySelectorAll("[data-qty-idx]").forEach(input => {
        input.onchange = () => {
          const idx = Number(input.dataset.qtyIdx);
          const v = Math.max(1, Number(input.value) || 1);
          restockList[idx].qty = v;
          renderRestockBody(modal);
        };
      });

      listWrap.querySelectorAll("[data-cost-idx]").forEach(input => {
        input.onchange = () => {
          const idx = Number(input.dataset.costIdx);
          const v = Math.max(0, Number(input.value) || 0);
          restockList[idx].cost = v;
          renderRestockBody(modal);
        };
      });

      listWrap.querySelectorAll("[data-remove]").forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.remove);
          restockList.splice(idx, 1);
          renderRestockBody(modal);
        };
      });
    }

    function addProductToBatch(p, qty = 10){
      const existing = restockList.find(i => i.product.id === p.id);
      if(existing){
        existing.qty += qty;
      } else {
        restockList.push({
          product: p,
          qty,
          cost: p.cost || 0,
          unitType: "piece"
        });
      }
      Utils.Sound.beep();
    }

    const body = `
      <div style="margin-bottom:14px;">
        <div class="field" style="margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:.92rem;font-weight:850;">${Icons.get("scan",{size:16})} Scan Barcode or Search Product to Restock</label>
          <div style="display:flex;gap:8px;">
            <input class="input scan-target" id="batch-restock-search" placeholder="Scan barcode or type product name…" autofocus style="font-size:1.20rem;padding:12px 16px;border-radius:12px;">
            <button type="button" class="btn btn-outline" id="btn-batch-scan-cam" title="Scan with camera">${Icons.get("camera",{size:18})}</button>
          </div>
          <div id="batch-search-results" style="margin-top:6px;max-height:220px;overflow-y:auto;display:none;background:var(--paper-dim);border:1.5px solid var(--line-strong);border-radius:10px;"></div>
        </div>
        <div class="input-row">
          <div class="field" style="margin-bottom:0;">
            <label style="font-size:.88rem;font-weight:850;">Supplier / Delivery Batch Note</label>
            <input class="input" id="batch-supplier" placeholder="e.g. San Miguel, Universal Robina, Direct Delivery" style="font-size:1.1rem;padding:10px 14px;">
          </div>
        </div>
      </div>
      <div id="restock-summary-bar" style="margin-bottom:12px;"></div>
      <div id="restock-items-list"></div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("plus-circle",{size:18})} Restock Items / Receive Inventory`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { label: "Confirm & Apply Restock", cls: "btn-primary btn-lg", onClick: () => {
          if(!restockList.length){ Utils.toast("No items added to restock list.", "warn"); return; }
          const sup = (modal.querySelector("#batch-supplier")?.value || "").trim() || "Delivery";
          const now = Date.now();

          // Apply stock increments & log restock entries
          const products = DB.getProducts();
          restockList.forEach(item => {
            const p = products.find(x => x.id === item.product.id);
            if(p){
              const pieces = item.unitType === "pack" && p.piecesPerPack > 1 ? item.qty * p.piecesPerPack : item.qty;
              p.stock = Utils.round2((p.stock || 0) + pieces);
              if(item.cost > 0 && item.cost !== p.cost){
                p.cost = item.cost;
              }
              DB.addRestockLog({
                product_id: p.barcode || p.name,
                product_name: p.name,
                quantity_added: pieces,
                unit_cost: item.cost,
                total_cost: pieces * item.cost,
                supplier_name: sup,
                timestamp: now
              });
            }
          });
          DB.setProducts(products);

          Utils.Sound.cashChime();
          Utils.toast(`Restock complete! +${restockList.length} products updated.`, "success");
          Modal.close();
          if(onSaved) onSaved();
          renderTable();
        }}
      ]
    });

    renderRestockBody(modal);

    const searchInput = modal.querySelector("#batch-restock-search");
    const resultsBox = modal.querySelector("#batch-search-results");

    function handleSearch(term){
      term = (term || "").trim().toLowerCase();
      if(!term){ resultsBox.style.display = "none"; resultsBox.innerHTML = ""; return; }
      const matches = allProducts.filter(p =>
        (p.barcode || "").toLowerCase() === term ||
        p.name.toLowerCase().includes(term) ||
        (p.brand || "").toLowerCase().includes(term)
      ).slice(0, 8);

      if(!matches.length){
        resultsBox.style.display = "block";
        resultsBox.innerHTML = `<div style="padding:12px 16px;color:var(--ink-faint);font-size:1.05rem;">No products match "${Utils.escapeHtml(term)}"</div>`;
        return;
      }

      resultsBox.style.display = "block";
      resultsBox.innerHTML = matches.map(p => `
        <div class="clickable-row" data-pick-id="${p.id}" style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);cursor:pointer;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="prod-thumb-sm">${Utils.productThumb(p, { iconSize:16 })}</span>
            <div>
              <strong style="font-size:1.08rem;">${Utils.escapeHtml(p.name)}</strong>
              <div class="text-xs text-faint" style="font-size:.86rem;">${p.barcode ? `Barcode: ${p.barcode}` : (p.category || "")}</div>
            </div>
          </div>
          <span class="badge badge-neutral mono font-bold" style="font-size:.95rem;padding:4px 10px;">Current Stock: ${p.stock}</span>
        </div>
      `).join("");

      resultsBox.querySelectorAll("[data-pick-id]").forEach(row => {
        row.onclick = () => {
          const p = allProducts.find(x => x.id === row.dataset.pickId);
          if(p){
            addProductToBatch(p, 10);
            renderRestockBody(modal);
            searchInput.value = "";
            resultsBox.style.display = "none";
            searchInput.focus();
          }
        };
      });
    }

    searchInput.addEventListener("input", (e) => handleSearch(e.target.value));

    // Handle barcode scanner inside modal
    Scanner.setContext((code) => {
      const p = allProducts.find(x => (x.barcode || "").toLowerCase() === code.trim().toLowerCase());
      if(p){
        addProductToBatch(p, 1);
        renderRestockBody(modal);
        Utils.toast(`Scanned: ${p.name} (+1)`, "success", 900);
        searchInput.value = "";
        resultsBox.style.display = "none";
      } else {
        searchInput.value = code;
        handleSearch(code);
      }
    });

    modal.querySelector("#btn-batch-scan-cam")?.addEventListener("click", () => {
      Scanner.openCamera((code) => {
        const p = allProducts.find(x => (x.barcode || "").toLowerCase() === code.trim().toLowerCase());
        if(p){
          addProductToBatch(p, 1);
          renderRestockBody(modal);
          Utils.toast(`Scanned: ${p.name}`, "success");
        }
      });
    });
  }

  function renderTable(){
    const thead = document.getElementById("inv-thead");
    const tbody = document.getElementById("inv-tbody");
    const allItems = list();
    const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const items = allItems.slice(startIndex, startIndex + PAGE_SIZE);

    const allSelected = allItems.length > 0 && allItems.every(p => selectedIds.has(p.id));
    const sortIcon = (col) => sortBy === col ? `<span class="sort-arrow">${sortOrder==="asc"?"▲":"▼"}</span>` : "";
    // (2026-07-13) Reverted row count column 1; was showing # number column
    if(thead){
      thead.innerHTML = `<tr>
        ${selectMode ? `<th class="inv-select-col"><input type="checkbox" id="inv-master-check" class="inv-checkbox" ${allSelected?"checked":""}></th>` : ""}
        <th class="sortable-th" data-sort="name">Product${sortIcon("name")}</th>
        <th class="sortable-th" data-sort="barcode">Barcode${sortIcon("barcode")}</th>
        <th class="sortable-th" data-sort="category">Category${sortIcon("category")}</th>
        <th class="sortable-th" data-sort="cost">Cost${sortIcon("cost")}</th>
        <th class="sortable-th" data-sort="price">Price${sortIcon("price")}</th>
        <th class="sortable-th" data-sort="potential">Potential Rev.${sortIcon("potential")}</th>
        <th class="sortable-th" data-sort="profit">Potential Profit${sortIcon("profit")}</th>
        <th class="sortable-th" data-sort="stock">Stock${sortIcon("stock")}</th>
        <th class="sortable-th" data-sort="status">Status${sortIcon("status")}</th>
        <th></th>
      </tr>`;
      thead.querySelectorAll("[data-sort]").forEach(th => {
        th.onclick = () => {
          const col = th.dataset.sort;
          if(sortBy === col){
            sortOrder = sortOrder === "asc" ? "desc" : "asc";
          } else {
            sortBy = col;
            sortOrder = "asc";
          }
          renderTable();
        };
      });
      if(selectMode){
        const masterCheck = document.getElementById("inv-master-check");
        if(masterCheck){
          masterCheck.onchange = (e) => {
            if(e.target.checked){
              allItems.forEach(p => selectedIds.add(p.id));
            } else {
              allItems.forEach(p => selectedIds.delete(p.id));
            }
            renderHeaderActions();
            renderTable();
          };
        }
      }
    }
    const totalStockPcs = allItems.reduce((s,p)=>s + (p.stock||0), 0);
    const totalCostVal = allItems.reduce((s,p)=>s + (p.cost||0)*(p.stock||0), 0);
    const totalPotentialRev = allItems.reduce((s,p)=>s + (p.price||0)*(p.stock||0), 0);
    const totalPotentialProfit = Math.max(0, totalPotentialRev - totalCostVal);
    const avgMargin = totalPotentialRev > 0 ? (totalPotentialProfit / totalPotentialRev) * 100 : 0;

    // (2026-07-13) Add profit column & bottom totals row for inventory; was rev only
    document.getElementById("inv-count").innerHTML = `${allItems.length} product${allItems.length===1?"":"s"}${allItems.length > PAGE_SIZE ? ` · Page ${currentPage} of ${totalPages}` : ""}${selectMode ? ` · ${selectedIds.size} selected` : ""} · <strong>Potential Rev: <span style="color:var(--brand-deep);">${Utils.money(totalPotentialRev)}</span></strong> · <strong>Profit: <span style="color:var(--success-deep);">${Utils.money(totalPotentialProfit)}</span></strong> <span class="text-faint">(Cost: ${Utils.money(totalCostVal)})</span>`;
    tbody.innerHTML = items.length ? items.map(p => {
      const pct = p.lowStockThreshold ? Math.min(100, Math.round((p.stock/(p.lowStockThreshold*3))*100)) : 100;
      const low = p.stock <= p.lowStockThreshold;
      const isSelected = selectedIds.has(p.id);
      const hasDual = p.piecesPerPack > 1;
      const fullPacks = hasDual ? Math.floor(p.stock / p.piecesPerPack) : 0;
      const loose = hasDual ? p.stock % p.piecesPerPack : 0;
      const packPrice = p.packPrice || (p.price * (p.piecesPerPack || 1));
      const potentialRev = (p.stock || 0) * (p.price || 0);
      const unitProfit = (p.price || 0) - (p.cost || 0);
      const potentialProfit = Math.max(0, (p.stock || 0) * unitProfit);
      const marginPct = (p.price || 0) > 0 ? (unitProfit / p.price) * 100 : 0;
      // (2026-07-13) Fix stock wrap, compact category & enlarge table numbers; was small
      return `
      <tr class="${p.stock<=0 || low ? "low-stock":""} ${isSelected ? "inv-row-selected" : ""}" ${selectMode ? `data-select-row="${p.id}" style="cursor:pointer;"` : ""}>
       ${selectMode ? `<td class="inv-select-col"><input type="checkbox" class="inv-checkbox inv-item-check" data-id="${p.id}" ${isSelected?"checked":""}></td>` : ""}
        <td>
          <span class="prod-thumb-sm" style="width:28px;height:28px;">${Utils.productThumb(p, { iconSize:15 })}</span>
          <strong style="font-size:.88rem;max-width:220px;">${Utils.escapeHtml(p.name)}</strong>
          ${hasDual ? `<span class="badge badge-brand text-xs" style="font-size:.62rem;padding:1px 5px;margin-left:3px;font-weight:800;">${p.piecesPerPack} pcs/pack</span>` : ""}
          ${p.brand ? `<span class="brand-cell" style="font-size:.72rem;">${Utils.escapeHtml(p.brand)}${p.distributor?` · ${Utils.escapeHtml(p.distributor)}`:""}</span>` : ""}
        </td>
        <td class="mono font-bold" style="font-size:.80rem;letter-spacing:-.02em;">${p.barcode||"—"}${hasDual && p.packBarcode ? `<div class="text-xs text-faint">Pk: ${p.packBarcode}</div>` : ""}</td>
        <td><span class="badge badge-brand" style="font-size:.70rem;font-weight:750;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;padding:2px 6px;" title="${Utils.escapeHtml(p.category)}">${Utils.escapeHtml(p.category)}</span></td>
        <td class="mono font-bold" style="font-size:.86rem;color:var(--ink-soft);">${Utils.money(p.cost)}</td>
        <td class="mono">
          <div style="font-size:.88rem;font-weight:800;color:var(--ink);">${Utils.money(p.price)}<span class="text-xs text-faint font-normal">/pc</span></div>
          ${hasDual ? `<div style="font-size:.68rem;color:var(--brand-deep);font-weight:750;">${Utils.money(packPrice)}<span class="text-faint">/pk</span></div>` : ""}
        </td>
        <td class="mono font-bold" style="font-size:.88rem;color:var(--brand-deep);">${Utils.money(potentialRev)}</td>
        <td class="mono">
          <div style="font-size:.88rem;font-weight:850;color:var(--success-deep);">${Utils.money(potentialProfit)}</div>
          <div class="text-xs text-faint mono" style="font-size:.70rem;font-weight:600;">${Utils.money(unitProfit)}/pc (${marginPct.toFixed(0)}%)</div>
        </td>
        <td style="white-space:nowrap;">
          <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
            <span class="stock-bar ${low?"low":""}" style="width:44px;flex-shrink:0;"><i style="width:${pct}%"></i></span>
            <strong class="mono" style="font-size:.88rem;font-weight:850;color:var(--ink);">${p.stock}</strong>
            <span class="text-xs text-faint font-bold">${p.unit||"pc"}</span>
          </div>
          ${hasDual ? `<div style="font-size:.68rem;color:var(--ink-faint);font-weight:600;margin-top:2px;white-space:nowrap;">${fullPacks} pk · ${loose} loose</div>` : ""}
        </td>
        <td>${p.stock<=0?`<span class="badge badge-rust font-bold" style="font-size:.72rem;padding:2px 6px;">Out of stock</span>`:low?`<span class="badge badge-amber font-bold" style="font-size:.72rem;padding:2px 6px;">Low stock</span>`:`<span class="badge badge-green font-bold" style="font-size:.72rem;padding:2px 6px;">OK</span>`}</td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-sm btn-ghost" data-adj="${p.id}" title="Adjust stock">${Icons.get("package",{size:14})}</button>
          <button class="btn btn-sm btn-ghost" data-edit="${p.id}" title="Edit">${Icons.get("edit",{size:14})}</button>
          <button class="btn btn-sm btn-ghost" data-del="${p.id}" title="Delete">${Icons.get("trash",{size:14})}</button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="${selectMode ? 11 : 10}"><div class="empty">${Icons.get("package",{size:34})}<h3>No products match</h3><p>Try clearing filters or add a new product.</p></div></td></tr>`;

    const tfoot = document.getElementById("inv-tfoot");
    if(tfoot){
      tfoot.innerHTML = `
        <tr style="background:var(--paper-dim);border-top:2px solid var(--line-strong);font-size:.84rem;">
          ${selectMode ? '<th></th>' : ''}
          <th style="padding:10px 12px;text-align:left;font-weight:850;font-size:.86rem;">TOTALS (${allItems.length} prods)</th>
          <th></th>
          <th></th>
          <th class="mono font-bold" style="font-size:.88rem;padding:10px 6px;color:var(--ink-soft);">${Utils.money(totalCostVal)}</th>
          <th></th>
          <th class="mono font-bold" style="font-size:.92rem;color:var(--brand-deep);padding:10px 6px;">${Utils.money(totalPotentialRev)}</th>
          <th class="mono font-bold" style="font-size:.92rem;color:var(--success-deep);padding:10px 6px;">${Utils.money(totalPotentialProfit)}</th>
          <th class="mono font-bold" style="font-size:.88rem;padding:10px 6px;white-space:nowrap;">${totalStockPcs.toLocaleString()} pcs</th>
          <th></th>
          <th></th>
        </tr>`;
    }

    if(selectMode){
      tbody.querySelectorAll("[data-select-row]").forEach(row => {
        row.onclick = (e) => {
          if(e.target.closest("button")) return;
          const id = row.dataset.selectRow;
          if(selectedIds.has(id)){
            selectedIds.delete(id);
          } else {
            selectedIds.add(id);
          }
          renderHeaderActions();
          renderTable();
        };
      });
      tbody.querySelectorAll(".inv-item-check").forEach(chk => {
        chk.onclick = (e) => e.stopPropagation();
        chk.onchange = (e) => {
          const id = chk.dataset.id;
          if(e.target.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          renderHeaderActions();
          renderTable();
        };
      });
    }

    tbody.querySelectorAll("[data-edit]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); openProductForm(DB.getProducts().find(p=>p.id===b.dataset.edit)); });
    tbody.querySelectorAll("[data-adj]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); openStockAdjust(DB.getProducts().find(p=>p.id===b.dataset.adj)); });
    tbody.querySelectorAll("[data-del]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); deleteProduct(DB.getProducts().find(p=>p.id===b.dataset.del)); });

    const pag = document.getElementById("inv-pagination");
    if(pag){
      if(allItems.length > PAGE_SIZE){
        const startItem = startIndex + 1;
        const endItem = Math.min(allItems.length, startIndex + PAGE_SIZE);
        let pageBtnsHtml = "";
        for(let i = 1; i <= totalPages; i++){
          if(i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)){
            pageBtnsHtml += `<button class="btn-page ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
          } else if(i === currentPage - 2 || i === currentPage + 2){
            pageBtnsHtml += `<span style="padding:0 4px;color:var(--ink-faint);">…</span>`;
          }
        }
        pag.style.display = "flex";
        pag.innerHTML = `
          <div>Showing <strong>${startItem}–${endItem}</strong> of <strong>${allItems.length}</strong> products</div>
          <div class="pagination-controls">
            <button class="btn-page" id="inv-prev-page" ${currentPage<=1?"disabled":""} title="Previous">${Icons.get("chevron-left",{size:13})}</button>
            ${pageBtnsHtml}
            <button class="btn-page" id="inv-next-page" ${currentPage>=totalPages?"disabled":""} title="Next"><span style="display:inline-flex;transform:rotate(180deg);">${Icons.get("chevron-left",{size:13})}</span></button>
          </div>
        `;
        const prevBtn = pag.querySelector("#inv-prev-page");
        if(prevBtn) prevBtn.onclick = () => { if(currentPage > 1){ currentPage--; renderTable(); } };
        const nextBtn = pag.querySelector("#inv-next-page");
        if(nextBtn) nextBtn.onclick = () => { if(currentPage < totalPages){ currentPage++; renderTable(); } };
        pag.querySelectorAll("[data-page]").forEach(btn => {
          btn.onclick = () => { currentPage = Number(btn.dataset.page); renderTable(); };
        });
      } else {
        pag.style.display = "none";
        pag.innerHTML = "";
      }
    }
  }

  function render(){
    selectMode = false;
    selectedIds.clear();
    currentPage = 1;
    const view = document.getElementById("view-root");
    const cats = DB.getCategories();
    view.innerHTML = `
      <div class="view-head">
        <div><h2>${Icons.get("package",{size:22})} Inventory</h2><div class="view-sub" id="inv-count"></div></div>
        <div class="input-row" id="inv-actions" style="width:auto;"></div>
      </div>
      <div class="inv-toolbar">
        <div class="input-icon-wrap">
          ${Icons.get("search",{size:15})}
          <input class="input scan-target" id="inv-search" placeholder="Search name, brand, distributor, or barcode…">
        </div>
        <div id="inv-cat-filter-wrap"></div>
        <div id="inv-stock-filter-wrap"></div>
        <div id="inv-sort-wrap"></div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead id="inv-thead"></thead>
          <tbody id="inv-tbody"></tbody>
          <tfoot id="inv-tfoot"></tfoot>
        </table>
      </div>
      <div id="inv-pagination" class="pagination-bar" style="display:none;"></div>
      <input type="file" id="inv-import-file" accept=".csv,.json" class="hidden">`;

    renderHeaderActions();
    document.getElementById("inv-import-file").addEventListener("change", (e)=> ImportExport.importInventoryFile(e.target.files[0], renderTable));

    document.getElementById("inv-search").addEventListener("input", Utils.debounce((e)=>{ searchTerm=e.target.value; currentPage=1; renderTable(); },150));

    document.getElementById("inv-cat-filter-wrap").innerHTML = UISelect.render("inv-cat-filter", ["All", ...cats], "All");
    UISelect.bind("inv-cat-filter", (v)=>{ categoryFilter=v; currentPage=1; renderTable(); });
    document.getElementById("inv-stock-filter-wrap").innerHTML = UISelect.render("inv-stock-filter", [
      { value:"all", label:"All stock levels" },
      { value:"in",  label:"In stock" },
      { value:"low", label:"Low stock" },
      { value:"out", label:"Out of stock" }
    ], "all");
    UISelect.bind("inv-stock-filter", (v)=>{ stockFilter=v; currentPage=1; renderTable(); });
    document.getElementById("inv-sort-wrap").innerHTML = UISelect.render("inv-sort", [
      { value:"name", label:"Sort: Name" }, { value:"brand", label:"Sort: Brand" }, { value:"stock", label:"Sort: Stock" }, { value:"price", label:"Sort: Price" }, { value:"potential", label:"Sort: Potential Rev" }, { value:"profit", label:"Sort: Potential Profit" }
    ], "name");
    UISelect.bind("inv-sort", (v)=>{ sortBy=v; currentPage=1; renderTable(); });

    Scanner.setContext((code)=>{ document.getElementById("inv-search").value = code; searchTerm = code; currentPage=1; renderTable(); });
    renderTable();
  }

  return { render, openProductForm };
})();
