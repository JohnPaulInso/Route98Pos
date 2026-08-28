// ============================================================
// pos.js — the point-of-sale screen
// ============================================================
const POS = (() => {
  // (2026-07-13) Auto-sync active held sale & persistent cart; was static cart
  const savedCartState = DB.getSavedCart ? DB.getSavedCart() : { cart: [], discount: { type:"percent", value:0 } };
  // (2026-07-13) Limit POS catalog to 50 per page; was 24 items
  let catalogPage = 1;
  const CATALOG_PAGE_SIZE = 50;
  let cart = Array.isArray(savedCartState.cart) ? savedCartState.cart : [];
  let searchTerm = "";
  let activeCategory = "ALL";
  let discount = savedCartState.discount || { type:"percent", value:0 };
  let activeHeldId = null;
  let undoStack = [];
  let redoStack = [];
  const PAY_ICON = { Cash:"wallet", Card:"credit-card", GCash:"smartphone", Other:"more-horizontal" };

  function syncHeldState(){
    if(!activeHeldId) return;
    const held = DB.getHeldSales();
    const idx = held.findIndex(x => x.id === activeHeldId);
    if(idx !== -1){
      if(cart.length){
        held[idx].items = JSON.parse(JSON.stringify(cart));
        held[idx].discount = { ...discount };
        held[idx].ts = Date.now();
      } else {
        held.splice(idx, 1);
        activeHeldId = null;
      }
      DB.setHeldSales(held);
      renderHeldButton();
    }
  }

  function pushState(){
    undoStack.push({
      cart: JSON.parse(JSON.stringify(cart)),
      discount: { ...discount }
    });
    redoStack = [];
    if(undoStack.length > 30) undoStack.shift();
  }

  function undo(){
    if(!undoStack.length){ Utils.toast("Nothing to undo.", "info"); return; }
    Utils.Sound.click();
    redoStack.push({
      cart: JSON.parse(JSON.stringify(cart)),
      discount: { ...discount }
    });
    const prev = undoStack.pop();
    cart = prev.cart;
    discount = prev.discount;
    renderCart();
    Utils.toast("Undone.", "info", 1000);
  }

  function redo(){
    if(!redoStack.length){ Utils.toast("Nothing to redo.", "info"); return; }
    Utils.Sound.click();
    undoStack.push({
      cart: JSON.parse(JSON.stringify(cart)),
      discount: { ...discount }
    });
    const next = redoStack.pop();
    cart = next.cart;
    discount = next.discount;
    renderCart();
    Utils.toast("Redone.", "info", 1000);
  }

  // (2026-07-13) Clamp flying target within visible cart bounds; was unconstrained
  function animateFlyToCart(fromEl, product){
    if(!fromEl) return;
    const startRect = (fromEl.querySelector(".thumb") || fromEl).getBoundingClientRect();
    const cartEl = document.getElementById("cart-items");
    if(!cartEl) return;
    const cartBox = cartEl.getBoundingClientRect();
    const targetRow = document.querySelector(`.cart-line[data-prod-id="${product.id || product.productId}"]`);

    let targetX = cartBox.left + 16;
    let targetY = cartBox.top + Math.max(20, Math.min(cartBox.height / 2, cartBox.height - 30));

    if(targetRow){
      const rowBox = targetRow.getBoundingClientRect();
      targetX = rowBox.left + 8;
      targetY = Math.max(cartBox.top + 16, Math.min(cartBox.bottom - 24, rowBox.top + (rowBox.height / 2) - 14));
    }

    const ghost = document.createElement("div");
    ghost.className = "flying-product-ghost";
    ghost.style.left = `${startRect.left}px`;
    ghost.style.top = `${startRect.top}px`;
    ghost.style.width = `${Math.max(50, Math.min(startRect.width, 95))}px`;
    ghost.style.height = `${Math.max(50, Math.min(startRect.height, 90))}px`;
    ghost.innerHTML = Utils.productThumb(product, { iconSize:28 });
    document.body.appendChild(ghost);

    const dx = targetX - startRect.left;
    const dy = targetY - startRect.top;

    const anim = ghost.animate([
      { transform: "translate3d(0,0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate3d(${dx * 0.45}px, ${dy * 0.3 - 40}px, 0) scale(0.82) rotate(-8deg)`, opacity: 0.95, offset: 0.4 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.35) rotate(4deg)`, opacity: 0.4 }
    ], {
      duration: 580,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards"
    });

    anim.onfinish = () => {
      ghost.remove();
      if(targetRow && targetRow.classList){
        targetRow.classList.add("cart-row-highlight");
        setTimeout(() => targetRow.classList.remove("cart-row-highlight"), 400);
      }
    };
  }

  // (2026-07-13) Support dual-unit pack/piece tracking in POS; was single unit
  function addToCart(product, qty = 1, unitType = "piece"){
    if(product.stock <= 0){ Utils.toast(`${product.name} is out of stock.`, "warn"); return false; }
    const piecesPerPack = product.piecesPerPack > 1 ? product.piecesPerPack : 1;
    const inCartPieces = cart.filter(l => l.productId === product.id)
      .reduce((sum, l) => sum + (l.unitType === "pack" ? l.qty * piecesPerPack : l.qty), 0);

    if(unitType === "pack"){
      const packsAvailable = Math.floor((product.stock - inCartPieces) / piecesPerPack);
      if(packsAvailable < qty){
        if(Math.floor(product.stock / piecesPerPack) < 1){
          Utils.toast(`Cannot sell full pack: only ${product.stock % piecesPerPack} loose piece(s) remaining (need ${piecesPerPack} pcs/pack).`, "warn", 3500);
        } else {
          Utils.toast(`Only ${packsAvailable} full pack(s) available in stock.`, "warn", 3000);
        }
        return false;
      }
      pushState();
      const line = cart.find(l => l.productId === product.id && l.unitType === "pack");
      const packPrice = product.packPrice || (product.price * piecesPerPack);
      if(line){
        line.qty += qty;
        renderCart();
        const row = document.querySelector(`.cart-line[data-prod-id="${product.id}"]`);
        if(row) row.scrollIntoView({ behavior:"smooth", block:"nearest" });
      } else {
        cart.push({
          productId: product.id,
          name: product.name,
          price: packPrice,
          qty,
          unitType: "pack",
          unit: product.packUnit || "pack",
          piecesPerPack,
          imageUrl: product.imageUrl,
          category: product.category
        });
        renderCart(true);
      }
      Utils.Sound.beep();
      return true;
    } else {
      const piecesAvailable = product.stock - inCartPieces;
      if(piecesAvailable < qty){
        Utils.Sound.error();
        Utils.toast(`Only ${piecesAvailable} piece(s) available in stock.`, "warn", 3000);
        return false;
      }
      pushState();
      const line = cart.find(l => l.productId === product.id && l.unitType === "piece");
      if(line){
        line.qty += qty;
        renderCart();
        const row = document.querySelector(`.cart-line[data-prod-id="${product.id}"]`);
        if(row) row.scrollIntoView({ behavior:"smooth", block:"nearest" });
      } else {
        cart.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          qty,
          unitType: "piece",
          unit: product.unit || "pc",
          piecesPerPack: 1,
          imageUrl: product.imageUrl,
          category: product.category
        });
        renderCart(true);
      }
      Utils.Sound.beep();
      return true;
    }
  }

  function addByBarcode(code){
    const clean = String(code).trim();
    const product = DB.findByBarcode(clean);
    if(!product){ Utils.toast(`No product found for barcode ${code}.`, "error"); return; }
    const isPack = product.packBarcode && product.packBarcode === clean;
    if(addToCart(product, 1, isPack ? "pack" : "piece")){
      Utils.toast(`Added ${product.name}${isPack ? " (Pack)" : ""}`, "success", 1200);
    }
  }

  function changeQty(cartIndex, delta){
    const line = cart[cartIndex];
    if(!line) return;
    const nextQty = line.qty + delta;
    if(nextQty <= 0){
      pushState();
      cart.splice(cartIndex, 1);
      Utils.Sound.remove();
      renderCart();
      return;
    }
    if(line.isCustom){
      pushState();
      line.qty = nextQty;
      Utils.Sound.click();
      renderCart();
      return;
    }
    const product = DB.getProducts().find(p => p.id === line.productId);
    if(!product) return;
    if(delta > 0){
      const otherPieces = cart.filter((l, i) => l.productId === line.productId && i !== cartIndex)
        .reduce((sum, l) => sum + (l.unitType === "pack" ? l.qty * piecesPerPack : l.qty), 0);
      const neededPieces = line.unitType === "pack" ? nextQty * piecesPerPack : nextQty;
      if(otherPieces + neededPieces > product.stock){
        Utils.Sound.error();
        if(line.unitType === "pack"){
          const availPacks = Math.floor((product.stock - otherPieces) / piecesPerPack);
          Utils.toast(`Cannot add full pack: only ${availPacks} pack(s) available.`, "warn");
        } else {
          Utils.toast(`Only ${product.stock - otherPieces} piece(s) available.`, "warn");
        }
        return;
      }
    }
    pushState();
    line.qty = nextQty;
    Utils.Sound.click();
    renderCart();
  }

  function removeLine(cartIndex){
    pushState();
    cart.splice(cartIndex, 1);
    Utils.Sound.remove();
    renderCart();
  }

  function clearCart(){
    if(!cart.length && discount.value === 0) return;
    pushState();
    cart = [];
    discount = { type:"percent", value:0 };
    Utils.Sound.remove();
    renderCart();
  }

  function totals(){
    const subtotal = cart.reduce((s,l) => s + l.price*l.qty, 0);
    const discountAmt = discount.type === "percent"
      ? Utils.round2(subtotal * (discount.value/100))
      : Utils.round2(Math.min(discount.value, subtotal));
    const afterDiscount = Math.max(0, subtotal - discountAmt);
    const settings = DB.getSettings();
    let vat = 0, netOfVat = afterDiscount;
    if(settings.vatEnabled){
      vat = Utils.round2(afterDiscount - (afterDiscount / (1 + settings.vatRate/100)));
      netOfVat = afterDiscount - vat;
    }
    const grand = Utils.round2(afterDiscount);
    return { subtotal:Utils.round2(subtotal), discountAmt, vat, netOfVat:Utils.round2(netOfVat), grand };
  }

  // (2026-07-13) Prioritize checkout typography and change display; was plain
  function openCheckout(){
    if(!cart.length){ Utils.toast("Cart is empty.", "warn"); return; }
    const t = totals();
    const body = `
      <div class="due-amount-card" style="margin-bottom:14px;">
        <div class="lbl">Amount Due</div>
        <div class="val">${Utils.money(t.grand)}</div>
      </div>
      <div class="pos-payment-methods" id="pay-methods">
        ${["Cash","Card","GCash","Other"].map((m,i)=>`<div class="chip ${i===0?"active":""}" data-m="${m}">${Icons.get(PAY_ICON[m],{size:16})}${m}</div>`).join("")}
      </div>
      <div class="field" id="cash-field" style="margin-bottom:12px;">
        <div class="flex-between" style="margin-bottom:6px;">
          <label style="font-size:.85rem;font-weight:800;letter-spacing:.04em;">Cash Tendered (₱)</label>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-exact-cash" style="font-size:.78rem;font-weight:700;color:var(--brand-deep);padding:2px 8px;">Exact (₱${t.grand.toFixed(2)})</button>
        </div>
        <input class="input" id="cash-input" type="number" min="0" step="0.01" placeholder="0.00" style="font-size:1.75rem;font-weight:800;font-family:var(--font-mono);padding:10px 14px;text-align:center;border-radius:12px;height:auto;">
        <div class="cash-presets-row" id="cash-presets">
          ${[20, 50, 100, 200, 500, 1000].map(v => `<button type="button" class="cash-preset-btn" data-v="${v}">₱${v}</button>`).join("")}
        </div>
      </div>
      <!-- (2026-07-13) Simplify checkout reference number field label; was verbose -->
      <div class="field" id="ref-code-field" style="margin-bottom:12px;display:none;">
        <label style="font-size:.85rem;font-weight:800;letter-spacing:.03em;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          ${Icons.get("hash",{size:14})} Reference No.
        </label>
        <input class="input mono" id="ref-code-input" type="text" placeholder="e.g. 1029 3847 2910" style="font-size:1.1rem;font-weight:700;padding:10px 14px;border-radius:10px;">
      </div>
      <div class="checkout-change-box" id="change-box">
        <div>
          <div class="lbl">Change Due</div>
          <div class="text-xs text-faint" id="change-status-lbl">Waiting for cash tendered…</div>
        </div>
        <div id="change-out" class="val mono">₱0.00</div>
      </div>`;
    const modal = Modal.open({
      title: `${Icons.get("wallet",{size:18})} Complete Sale`,
      body,
      actions: [
        { label:"Cancel", cls:"btn-ghost btn-lg" },
        { label:"Confirm Payment", cls:"btn-primary btn-lg", onClick: () => finalizeSale(modal) }
      ]
    });
    let method = "Cash";
    modal.querySelector("#pay-methods").addEventListener("click", (e)=>{
      const chip = e.target.closest(".chip"); if(!chip) return;
      modal.querySelectorAll("#pay-methods .chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      method = chip.dataset.m;
      modal.dataset.method = method;
      const isCash = method === "Cash";
      modal.querySelector("#cash-field").style.display = isCash ? "flex" : "none";
      modal.querySelector("#change-box").style.display = isCash ? "flex" : "none";
      const refField = modal.querySelector("#ref-code-field");
      if(refField){
        refField.style.display = !isCash ? "flex" : "none";
        if(!isCash) setTimeout(() => modal.querySelector("#ref-code-input")?.focus(), 80);
      }
    });
    modal.dataset.method = method;
    const cashInput = modal.querySelector("#cash-input");
    const updateChange = () => {
      const val = Number(cashInput.value||0);
      const diff = val - t.grand;
      const statusEl = modal.querySelector("#change-status-lbl");
      const outEl = modal.querySelector("#change-out");
      if(!val){
        outEl.textContent = "₱0.00";
        outEl.style.color = "var(--ink-faint)";
        statusEl.textContent = "Enter cash tendered";
      } else if(diff < 0){
        outEl.textContent = `-${Utils.money(Math.abs(diff))}`;
        outEl.style.color = "var(--danger)";
        statusEl.textContent = "Insufficient cash";
      } else {
        outEl.textContent = Utils.money(diff);
        outEl.style.color = "var(--success-deep)";
        statusEl.textContent = diff === 0 ? "Exact amount" : "Change to return";
      }
    };
    cashInput.addEventListener("input", updateChange);
    modal.querySelector("#btn-exact-cash")?.addEventListener("click", () => {
      cashInput.value = t.grand.toFixed(2);
      updateChange();
    });
    // (2026-07-13) Bind Enter key on cash input to confirm payment; was button-only
    cashInput.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){
        e.preventDefault();
        finalizeSale(modal);
      }
    });
    modal.querySelector("#ref-code-input")?.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){
        e.preventDefault();
        finalizeSale(modal);
      }
    });
    cashInput.focus();
  }

  function printReceipt(sale){
    const settings = DB.getSettings();
    const cleanId = (sale.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-8);
    const txnId = `TXN-${cleanId || "00000000"}`;
    let win = document.getElementById("receipt-print");
    if(!win){
      win = document.createElement("div");
      win.id = "receipt-print";
      document.body.appendChild(win);
    }
    win.innerHTML = `
      <div class="receipt">
        <div class="center">
          <strong>${Utils.escapeHtml(settings.businessName || "Route 98")}</strong><br>
          ${Utils.escapeHtml(settings.address || "Cebu City, Philippines")}<br>
          ${settings.tin ? `TIN: ${Utils.escapeHtml(settings.tin)}<br>` : ""}
        </div>
        <hr>
        <div class="row"><span>${Utils.fmtDate(sale.ts)}</span><span>${txnId}</span></div>
        <div class="row"><span>Cashier: ${Utils.escapeHtml(sale.cashier || "Cashier")}</span><span>${sale.method}</span></div>
        ${sale.refCode ? `<div class="row"><span>Ref #:</span><span class="mono">${Utils.escapeHtml(sale.refCode)}</span></div>` : ""}
        <hr>
        ${(sale.items || []).map(l => `
          <div class="row">
            <span>${l.qty}x ${Utils.escapeHtml(l.name)}${l.unitType==="pack"?` (PACK)`:""}</span>
            <span>${Utils.money(l.price * l.qty)}</span>
          </div>
        `).join("")}
        <hr>
        <div class="row"><span>Subtotal</span><span>${Utils.money(sale.subtotal ?? sale.total)}</span></div>
        ${sale.discountAmt ? `<div class="row"><span>Discount</span><span>-${Utils.money(sale.discountAmt)}</span></div>` : ""}
        ${settings.vatEnabled && sale.vat ? `<div class="row"><span>VAT (${settings.vatRate}%)</span><span>${Utils.money(sale.vat)}</span></div>` : ""}
        <div class="row" style="font-weight:700;font-size:1.1em;"><span>TOTAL</span><span>${Utils.money(sale.total)}</span></div>
        ${sale.method === "Cash" && sale.tendered !== undefined ? `
          <div class="row"><span>Cash Tendered</span><span>${Utils.money(sale.tendered)}</span></div>
          <div class="row"><span>Change</span><span>${Utils.money(sale.change || 0)}</span></div>
        ` : ""}
        <hr>
        <div class="center">${Utils.escapeHtml(settings.receiptFooter || "Salamat sa inyong pagbisita!")}</div>
      </div>`;
    setTimeout(() => window.print(), 150);
  }

  // (2026-08-26) Physical stock confirmation modal after checkout; prevents theft
  function openPhysicalStockConfirmation(sale, onComplete){
    // Get high-velocity items from the sale
    const itemsToVerify = sale.items.filter(item => !item.isCustom).slice(0, 8); // Top 8 items
    if(itemsToVerify.length === 0){
      onComplete();
      return;
    }

    const products = DB.getProducts();
    const verificationData = itemsToVerify.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        name: item.name,
        systemStock: product ? product.stock : 0,
        physicalCount: product ? product.stock : 0, // Default to system count
        imageUrl: item.imageUrl,
        category: item.category
      };
    });

    const body = `
      <div style="margin-bottom:18px;padding:14px;background:var(--paper-dim);border-radius:var(--r-lg);border:1.5px solid var(--brand);text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:var(--brand-tint);color:var(--brand-deep);margin-bottom:10px;">
          ${Icons.get("clipboard-check",{size:24})}
        </div>
        <h4 style="font-size:1.15rem;font-weight:800;margin-bottom:6px;color:var(--ink);">📌 Confirm Physical Stock</h4>
        <p style="font-size:.92rem;color:var(--ink-soft);line-height:1.4;">You are closing this transaction. Please verify the physical shelf count for these items matches the system inventory.</p>
      </div>

      <div class="table-wrap" style="max-height:380px;overflow-y:auto;margin-bottom:14px;">
        <table class="stock-confirm-table">
          <thead>
            <tr>
              <th style="width:45%;">Item</th>
              <th style="text-align:center;width:20%;">System Stock</th>
              <th style="text-align:center;width:25%;">Physical Count</th>
              <th style="text-align:center;width:10%;">Status</th>
            </tr>
          </thead>
          <tbody id="stock-verify-tbody">
            ${verificationData.map((item, idx) => `
              <tr data-idx="${idx}">
                <td>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div class="prod-thumb-sm" style="width:32px;height:32px;flex-shrink:0;">
                      ${Utils.productThumb({imageUrl:item.imageUrl, category:item.category, name:item.name}, {iconSize:18})}
                    </div>
                    <strong style="font-size:.95rem;">${Utils.escapeHtml(item.name)}</strong>
                  </div>
                </td>
                <td style="text-align:center;">
                  <span class="mono" style="font-size:1.15rem;font-weight:800;color:var(--brand-deep);">${item.systemStock}</span>
                </td>
                <td style="text-align:center;">
                  <input type="number" 
                    class="physical-count-input" 
                    data-idx="${idx}"
                    value="${item.physicalCount}" 
                    min="0" 
                    step="1"
                    style="width:90px;">
                </td>
                <td style="text-align:center;">
                  <span class="discrepancy-indicator match" data-idx="${idx}">✓</span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div id="discrepancy-alert" style="display:none;padding:12px 16px;background:var(--danger-tint);border:1.5px solid var(--danger);border-radius:var(--r-md);margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${Icons.get("alert-triangle",{size:20,color:"var(--danger)"})}
          <div style="flex:1;">
            <strong style="color:var(--danger);font-size:.95rem;">Discrepancies Detected</strong>
            <p style="font-size:.85rem;color:var(--ink-soft);margin-top:2px;">Some physical counts don't match system inventory. Please log the reason below.</p>
          </div>
        </div>
      </div>`;

    const modal = Modal.open({
      title: `${Icons.get("clipboard-check",{size:17})} Physical Stock Verification`,
      body,
      wide: true,
      actions: [
        { 
          label: `${Icons.get("alert-triangle",{size:15})} Log Discrepancy`, 
          cls: "btn-outline btn-lg", 
          id: "btn-log-discrepancy",
          onClick: () => openDiscrepancyLogger(verificationData, modal, sale, onComplete) 
        },
        { 
          label: `${Icons.get("check",{size:15})} Confirm & Continue`, 
          cls: "btn-primary btn-lg", 
          onClick: () => {
            // Update physical counts
            const inputs = modal.querySelectorAll(".physical-count-input");
            let hasDiscrepancy = false;
            
            inputs.forEach((input, idx) => {
              const physicalCount = Number(input.value) || 0;
              const item = verificationData[idx];
              const diff = physicalCount - item.systemStock;
              
              if(diff !== 0){
                hasDiscrepancy = true;
                const product = products.find(p => p.id === item.productId);
                if(product){
                  product.stock = physicalCount;
                  // Log as stock count correction
                  DB.adjustStock(product.id, diff, "Physical stock count correction", "");
                }
              }
            });
            
            if(hasDiscrepancy){
              DB.setProducts(products);
              Utils.toast("Physical stock counts updated in system.", "success");
            }
            
            Modal.close();
            onComplete();
          }
        }
      ]
    });

    // Bind input change listeners
    const inputs = modal.querySelectorAll(".physical-count-input");
    const alert = modal.querySelector("#discrepancy-alert");
    let hasAnyDiscrepancy = false;

    inputs.forEach(input => {
      input.addEventListener("input", () => {
        const idx = Number(input.dataset.idx);
        const physicalCount = Number(input.value) || 0;
        const systemStock = verificationData[idx].systemStock;
        const indicator = modal.querySelector(`.discrepancy-indicator[data-idx="${idx}"]`);
        
        if(physicalCount === systemStock){
          indicator.textContent = "✓";
          indicator.className = "discrepancy-indicator match";
        } else {
          const diff = physicalCount - systemStock;
          indicator.textContent = diff > 0 ? `+${diff}` : diff;
          indicator.className = "discrepancy-indicator mismatch";
        }

        // Check if any discrepancy exists
        hasAnyDiscrepancy = Array.from(inputs).some(inp => {
          const i = Number(inp.dataset.idx);
          return (Number(inp.value) || 0) !== verificationData[i].systemStock;
        });

        if(alert) alert.style.display = hasAnyDiscrepancy ? "block" : "none";
      });
    });

    // Focus first input
    if(inputs[0]) inputs[0].focus();
  }

  // (2026-08-26) Discrepancy logger for theft/damage/waste tracking
  function openDiscrepancyLogger(verificationData, parentModal, sale, onComplete){
    const discrepancies = verificationData.filter((item, idx) => {
      const input = parentModal.querySelector(`.physical-count-input[data-idx="${idx}"]`);
      const physicalCount = Number(input.value) || 0;
      return physicalCount !== item.systemStock;
    });

    if(discrepancies.length === 0){
      Utils.toast("No discrepancies to log. All counts match!", "info");
      return;
    }

    const body = `
      <div style="margin-bottom:16px;">
        <p class="text-sm text-faint" style="margin-bottom:12px;"><strong>${discrepancies.length}</strong> item(s) with count discrepancies detected.</p>
        ${discrepancies.map((item, idx) => {
          const input = parentModal.querySelector(`.physical-count-input[data-idx="${verificationData.indexOf(item)}"]`);
          const physicalCount = Number(input.value) || 0;
          const diff = physicalCount - item.systemStock;
          return `
            <div class="card" style="padding:12px 16px;margin-bottom:10px;background:var(--paper-dim);border:1.5px solid ${diff < 0 ? 'var(--danger)' : 'var(--warning)'};border-radius:var(--r-md);">
              <div class="flex-between" style="margin-bottom:8px;">
                <strong style="font-size:.95rem;">${Utils.escapeHtml(item.name)}</strong>
                <span class="badge ${diff < 0 ? 'badge-danger' : 'badge-warning'}" style="font-family:var(--font-mono);font-weight:800;font-size:.95rem;">${diff > 0 ? '+' : ''}${diff} pcs</span>
              </div>
              <div class="flex-between" style="font-size:.85rem;color:var(--ink-soft);">
                <span>System: <strong class="mono">${item.systemStock}</strong></span>
                <span>Physical: <strong class="mono">${physicalCount}</strong></span>
              </div>
              <div style="margin-top:10px;">
                <label style="font-size:.8rem;font-weight:700;margin-bottom:4px;display:block;">Reason for discrepancy:</label>
                <div id="reason-wrap-${idx}"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>`;

    const discModal = Modal.open({
      title: `${Icons.get("alert-triangle",{size:17})} Log Stock Discrepancies`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { 
          label: "Save Discrepancy Logs", 
          cls: "btn-primary btn-lg", 
          onClick: () => {
            const products = DB.getProducts();
            
            discrepancies.forEach((item, idx) => {
              const input = parentModal.querySelector(`.physical-count-input[data-idx="${verificationData.indexOf(item)}"]`);
              const physicalCount = Number(input.value) || 0;
              const diff = physicalCount - item.systemStock;
              const reason = UISelect.getValue(`disc-reason-${idx}`);
              
              const product = products.find(p => p.id === item.productId);
              if(product){
                product.stock = physicalCount;
                DB.adjustStock(product.id, diff, reason, "");
              }
            });
            
            DB.setProducts(products);
            Utils.toast(`${discrepancies.length} discrepancy log(s) saved.`, "success");
            Modal.close(); // Close discrepancy modal
            Modal.close(); // Close verification modal
            onComplete();
          }
        }
      ]
    });

    // Bind reason selectors
    discrepancies.forEach((item, idx) => {
      const wrapEl = discModal.querySelector(`#reason-wrap-${idx}`);
      const input = parentModal.querySelector(`.physical-count-input[data-idx="${verificationData.indexOf(item)}"]`);
      const physicalCount = Number(input.value) || 0;
      const diff = physicalCount - item.systemStock;
      
      const reasons = diff < 0 
        ? ["Theft / Shoplifting", "Damaged / Spoiled / Shrinkage", "Employee Consumption", "Miscount / Data Entry Error", "Returned to Supplier", "Other"]
        : ["Found Extra Stock", "Miscount / Data Entry Error", "Received but Not Logged", "Other"];
      
      wrapEl.innerHTML = UISelect.render(`disc-reason-${idx}`, reasons, reasons[0]);
      UISelect.bind(`disc-reason-${idx}`);
    });
  }

  // (2026-07-13) Show payment confirmation modal instead of auto-print; was print
  function openSaleSuccessModal(sale){
    const cleanId = (sale.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-8);
    const txnId = `TXN-${cleanId || "00000000"}`;
    const isCash = sale.method === "Cash";

    const body = `
      // (2026-07-13) Show prominent Transaction ID row; was subtitle only
      <div style="text-align:center;padding:10px 0 16px;">
        <div style="width:68px;height:68px;border-radius:50%;background:var(--success-tint);color:var(--success-deep);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 14px rgba(22,168,112,0.25);">
          ${Icons.get("check-circle",{size:38,strokeWidth:2.5})}
        </div>
        <h3 style="font-size:1.45rem;font-weight:850;margin-bottom:4px;color:var(--ink);">Payment Completed!</h3>
        <p class="text-sm text-faint" style="font-weight:600;">${sale.items.length} item(s) purchased</p>
      </div>

      <div class="card" style="margin-bottom:16px;background:var(--paper-dim);padding:14px 18px;border-radius:var(--r-lg);border:1.5px solid var(--line);">
        <div class="flex-between" style="margin-bottom:8px;font-size:1rem;border-bottom:1px solid var(--line);padding-bottom:8px;">
          <span class="text-faint" style="font-weight:700;">Transaction ID</span>
          <span class="badge badge-neutral mono font-bold" style="font-size:1.05rem;padding:4px 10px;letter-spacing:.03em;color:var(--brand-deep);">${txnId}</span>
        </div>
        <div class="flex-between" style="margin-bottom:8px;font-size:1.1rem;">
          <span class="text-faint" style="font-weight:700;">Amount Paid</span>
          <span class="mono" style="font-size:1.75rem;font-weight:900;color:var(--brand);">${Utils.money(sale.total)}</span>
        </div>
        <div class="flex-between" style="margin-bottom:6px;font-size:1rem;">
          <span class="text-faint" style="font-weight:700;">Payment Method</span>
          <span class="badge badge-brand" style="font-size:.92rem;font-weight:800;padding:4px 10px;">${sale.method}</span>
        </div>
        ${sale.refCode ? `
          <div class="flex-between" style="margin-bottom:6px;font-size:1rem;">
            <span class="text-faint" style="font-weight:700;">Reference No.</span>
            <strong class="mono" style="font-size:1.05rem;color:var(--brand-deep);">${Utils.escapeHtml(sale.refCode)}</strong>
          </div>
        ` : ""}
        ${isCash ? `
          <div class="flex-between" style="margin-bottom:6px;font-size:1.05rem;border-top:1px dashed var(--line);padding-top:8px;">
            <span class="text-faint" style="font-weight:700;">Cash Tendered</span>
            <span class="mono font-bold" style="font-size:1.25rem;">${Utils.money(sale.tendered)}</span>
          </div>
          <div class="flex-between" style="font-size:1.2rem;">
            <span style="font-weight:800;color:var(--success-deep);">Change Due</span>
            <span class="mono" style="font-size:2rem;font-weight:900;color:var(--success-deep);">${Utils.money(sale.change || 0)}</span>
          </div>
        ` : ""}
      </div>`;

    Modal.open({
      title: `${Icons.get("check-circle",{size:17})} Sale Confirmation`,
      body,
      wide: true,
      actions: [
        { label: "Print Receipt", cls: "btn-outline btn-lg", onClick: () => { printReceipt(sale); } },
        { label: "Start Next Sale", cls: "btn-primary btn-lg", onClick: Modal.close }
      ]
    });
  }

  function finalizeSale(modal){
    const t = totals();
    const method = modal.dataset.method;
    const refCode = (modal.querySelector("#ref-code-input")?.value || "").trim();
    const cashInput = modal.querySelector("#cash-input");
    const tendered = method === "Cash" ? Number(cashInput.value||0) : t.grand;
    if(method === "Cash" && tendered < t.grand){
      Utils.Sound.error();
      Utils.toast("Cash tendered is less than total due.", "error");
      return;
    }

    // decrement stock
    const products = DB.getProducts();
    cart.forEach(line => {
      if(line.isCustom) return;
      const p = products.find(x => x.id === line.productId);
      if(p){
        const pieces = (line.unitType === "pack" && p.piecesPerPack > 1) ? line.qty * p.piecesPerPack : line.qty;
        p.stock = Math.max(0, Utils.round2(p.stock - pieces));
      }
    });
    DB.setProducts(products);

    // (2026-07-13) Use sequential TXN-0001 IDs & auto-persist held sales; was uid
    const txnId = DB.getNextTransactionId ? DB.getNextTransactionId("TXN") : `TXN-${String(DB.getSales().length + 1).padStart(4, "0")}`;
    const sale = {
      id: txnId, ts: Date.now(), items: cart.map(l=>({...l})),
      subtotal:t.subtotal, discountType:discount.type, discountValue:discount.value, discountAmt:t.discountAmt, vat:t.vat, total:t.grand,
      method, refCode, tendered, change: Utils.round2(tendered - t.grand),
      cashier: Auth.currentUser()?.name || "Unknown"
    };
    const sales = DB.getSales(); sales.unshift(sale); DB.setSales(sales);
    if(activeHeldId){
      DB.setHeldSales(DB.getHeldSales().filter(x => x.id !== activeHeldId));
      activeHeldId = null;
      renderHeldButton();
    }

    Modal.close();
    clearCart();
    Utils.Sound.cashChime();
    Utils.toast(`Sale complete — ${Utils.money(t.grand)}`, "success");
    
    // (2026-08-26) Physical stock verification - ADMIN ONLY, not after every sale
    // Cashiers can continue serving customers without interruption
    // Admin can trigger verification manually from Inventory view
    openSaleSuccessModal(sale);
  }

  function holdSale(){
    if(!cart.length){ Utils.toast("Cart is empty.", "warn"); return; }
    const held = DB.getHeldSales();
    const existingIdx = activeHeldId ? held.findIndex(x => x.id === activeHeldId) : -1;
    if(existingIdx !== -1){
      held[existingIdx].items = JSON.parse(JSON.stringify(cart));
      held[existingIdx].discount = { ...discount };
      held[existingIdx].ts = Date.now();
    } else {
      held.unshift({ id: Utils.uid("hold"), ts: Date.now(), items: JSON.parse(JSON.stringify(cart)), discount, cashier: Auth.currentUser()?.name });
    }
    DB.setHeldSales(held);
    activeHeldId = null;
    clearCart();
    Utils.Sound.hold();
    Utils.toast("Sale parked. Recall it anytime from Held Sales.", "success");
    renderHeldButton();
  }

  function openHeldSales(){
    const held = DB.getHeldSales();
    const body = held.length ? `
      <div class="table-wrap"><table class="data"><thead><tr><th>Time</th><th>Items</th><th>Cashier</th><th></th></tr></thead><tbody>
      ${held.map(h => `<tr>
        <td>${Utils.fmtDate(h.ts)}</td>
        <td>${h.items.length} item(s)</td>
        <td>${h.cashier||"—"}</td>
        <td style="text-align:right;"><button class="btn btn-sm btn-primary" data-recall="${h.id}">Recall</button> <button class="btn btn-sm btn-ghost" data-del="${h.id}">${Icons.get("x",{size:14})}</button></td>
      </tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">${Icons.get("pause-circle",{size:34})}<h3>No parked sales</h3><p>Held carts will show up here.</p></div>`;
    const modal = Modal.open({ title:`${Icons.get("pause-circle",{size:17})} Held Sales`, body, wide:true, actions:[{label:"Close",cls:"btn-ghost"}] });
    modal.querySelectorAll("[data-recall]").forEach(btn => btn.onclick = () => {
      const h = DB.getHeldSales().find(x => x.id === btn.dataset.recall);
      if(!h) return;
      activeHeldId = h.id;
      cart = JSON.parse(JSON.stringify(h.items));
      discount = h.discount || { type:"percent", value:0 };
      renderCart(); Modal.close(); renderHeldButton();
      Utils.toast("Parked sale restored.", "info", 1500);
    });
    modal.querySelectorAll("[data-del]").forEach(btn => btn.onclick = () => {
      const delId = btn.dataset.del;
      if(activeHeldId === delId) activeHeldId = null;
      DB.setHeldSales(DB.getHeldSales().filter(x => x.id !== delId));
      openHeldSales();
      renderHeldButton();
    });
  }

  function renderHeldButton(){
    const b = document.getElementById("held-count");
    if(b) b.textContent = DB.getHeldSales().length;
  }

  // ---------- continuous camera scan mode ----------
  // (2026-07-13) Open continuous camera scan directly; prev: Modal.confirm prompt
  function openScanMode(){
    Scanner.openContinuousScan({
      title: "Scan items into cart",
      onHit: (code) => {
        const product = DB.findByBarcode(code);
        if(!product) return { ok:false, label:"Unknown code" };
        const ok = addToCart(product);
        return { ok, label: ok ? product.name : `${product.name} (max reached)` };
      },
      onClose: (count) => {
        if(count > 0) Utils.toast(`${count} item(s) scanned — review your cart below.`, "success");
        renderCart();
      }
    });
  }

  // ---------- receipt ----------
  function printReceipt(sale){
    const settings = DB.getSettings();
    const win = document.getElementById("receipt-print");
    win.innerHTML = `
      <div class="receipt">
        <div class="center"><strong>${Utils.escapeHtml(settings.businessName)}</strong><br>${Utils.escapeHtml(settings.address)}</div>
        <hr>
        <div class="row"><span>${Utils.fmtDate(sale.ts)}</span><span>#${sale.id.slice(-6)}</span></div>
        <div class="row"><span>Cashier</span><span>${Utils.escapeHtml(sale.cashier)}</span></div>
        <hr>
        ${sale.items.map(l => `<div class="row"><span>${l.qty}x ${Utils.escapeHtml(l.name)}</span><span>${Utils.money(l.price*l.qty)}</span></div>`).join("")}
        <hr>
        <div class="row"><span>Subtotal</span><span>${Utils.money(sale.subtotal)}</span></div>
        ${sale.discountAmt ? `<div class="row"><span>Discount (${sale.discountType==="percent" ? sale.discountValue+"%" : "fixed"})</span><span>-${Utils.money(sale.discountAmt)}</span></div>` : ""}
        ${settings.vatEnabled ? `<div class="row"><span>VAT incl. (${settings.vatRate}%)</span><span>${Utils.money(sale.vat)}</span></div>` : ""}
        <div class="row" style="font-weight:700;"><span>TOTAL</span><span>${Utils.money(sale.total)}</span></div>
        <div class="row"><span>${sale.method}</span><span>${Utils.money(sale.tendered)}</span></div>
        ${sale.method==="Cash" ? `<div class="row"><span>Change</span><span>${Utils.money(sale.change)}</span></div>` : ""}
        <hr>
        <div class="center">${Utils.escapeHtml(settings.receiptFooter)}</div>
      </div>`;
    setTimeout(()=> window.print(), 150);
  }

  // ---------- rendering ----------
  // (2026-07-13) Format categoryList as uppercase & match case-insensitively; was raw
  function categoryList(){
    const set = new Set(["ALL"]);
    DB.getCategories().forEach(c => {
      if(!c) return;
      const t = c.trim().toUpperCase();
      if(t) set.add(t);
    });
    return [...set];
  }

  // (2026-07-13) Include category name in search filtering; was name/brand/barcode
  function filteredProducts(){
    const products = DB.getProducts();
    const term = searchTerm.toLowerCase();
    const activeCatLower = (activeCategory || "All").trim().toLowerCase();
    return products.filter(p => {
      const prodCatLower = (p.category || "").trim().toLowerCase();
      const matchCat = activeCatLower === "all" || prodCatLower === activeCatLower;
      const matchSearch = !term ||
        p.name.toLowerCase().includes(term) ||
        (p.brand||"").toLowerCase().includes(term) ||
        (p.category||"").toLowerCase().includes(term) ||
        p.barcode?.includes(searchTerm);
      return matchCat && matchSearch;
    });
  }

  function promptDualUnitSale(product){
    const piecesPerPack = product.piecesPerPack || 10;
    const fullPacks = Math.floor(product.stock / piecesPerPack);
    const loose = product.stock % piecesPerPack;
    const inCartPieces = cart.filter(l => l.productId === product.id)
      .reduce((sum, l) => sum + (l.unitType === "pack" ? l.qty * piecesPerPack : l.qty), 0);
    const availPacks = Math.floor((product.stock - inCartPieces) / piecesPerPack);
    const availPieces = product.stock - inCartPieces;
    const packPrice = product.packPrice || (product.price * piecesPerPack);

    const body = `
      <div style="text-align:center;margin-bottom:14px;">
        <div class="prod-thumb-sm" style="width:46px;height:46px;border-radius:10px;margin:0 auto 8px;">
          ${Utils.productThumb(product, { iconSize:24 })}
        </div>
        <h3 style="font-size:1.05rem;margin-bottom:2px;">${Utils.escapeHtml(product.name)}</h3>
        <p class="text-sm text-faint">Stock: <strong>${product.stock} pcs</strong> (${fullPacks} packs + ${loose} loose)</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button class="card card-tight" id="opt-buy-pack" style="text-align:left;cursor:pointer;border:2px solid ${availPacks>0?"var(--brand)":"var(--line)"};background:var(--paper-raised);opacity:${availPacks>0?1:.5};">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="badge ${availPacks>0?"badge-brand":"badge-rust"}">Pack (${piecesPerPack} pcs)</span>
            <strong class="mono" style="font-size:1rem;color:var(--brand-deep);">${Utils.money(packPrice)}</strong>
          </div>
          <div style="font-size:.76rem;margin-top:6px;color:var(--ink-soft);font-weight:600;">
            ${availPacks > 0 ? `${availPacks} full pack(s) left` : `<span style="color:var(--danger);">0 packs (${loose} loose pcs)</span>`}
          </div>
        </button>
        <button class="card card-tight" id="opt-buy-piece" style="text-align:left;cursor:pointer;border:2px solid ${availPieces>0?"var(--line-strong)":"var(--line)"};background:var(--paper-raised);opacity:${availPieces>0?1:.5};">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="badge badge-neutral">Individual Piece</span>
            <strong class="mono" style="font-size:1rem;">${Utils.money(product.price)}</strong>
          </div>
          <div style="font-size:.76rem;margin-top:6px;color:var(--ink-soft);font-weight:600;">
            ${availPieces > 0 ? `${availPieces} piece(s) left` : `<span style="color:var(--danger);">Out of stock</span>`}
          </div>
        </button>
      </div>`;

    const modal = Modal.open({
      title: `${Icons.get("package",{size:17})} Select Sale Unit`,
      body,
      actions: [{ label:"Cancel", cls:"btn-ghost" }]
    });

    const packBtn = modal.querySelector("#opt-buy-pack");
    if(packBtn && availPacks > 0){
      packBtn.onclick = () => {
        if(addToCart(product, 1, "pack")){
          Utils.toast(`Added 1 Pack of ${product.name}`, "success", 1200);
          Modal.close();
        }
      };
    }
    const pcBtn = modal.querySelector("#opt-buy-piece");
    if(pcBtn && availPieces > 0){
      pcBtn.onclick = () => {
        if(addToCart(product, 1, "piece")){
          Utils.toast(`Added 1 pc ${product.name}`, "success", 1200);
          Modal.close();
        }
      };
    }
  }

  // (2026-07-13) Paginate catalog (24/pg) with delegated clicks; prev: all items
  function renderCatalog(){
    const grid = document.getElementById("product-grid");
    if(!grid) return;
    const allFiltered = filteredProducts();
    const totalPages = Math.max(1, Math.ceil(allFiltered.length / CATALOG_PAGE_SIZE));
    if(catalogPage > totalPages) catalogPage = totalPages;
    if(catalogPage < 1) catalogPage = 1;

    const startIndex = (catalogPage - 1) * CATALOG_PAGE_SIZE;
    const items = allFiltered.slice(startIndex, startIndex + CATALOG_PAGE_SIZE);

    // (2026-07-13) Render cards without tabindex for smooth scroll; was button
    const customCardHtml = catalogPage === 1 ? `
      <div class="product-card custom-item-card" id="btn-grid-custom-item" role="button">
        <div class="thumb" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
          <div class="custom-card-icon">
            ${Icons.get("plus",{size:22,strokeWidth:2.3})}
          </div>
        </div>
        <div class="info" style="text-align:center;align-items:center;padding:6px 8px 8px;">
          <span class="brand-lbl" style="color:var(--brand);font-weight:700;">+ Custom Item</span>
          <span class="name" style="color:var(--ink);font-weight:700;min-height:auto;">Open Price</span>
          <div class="price" style="font-size:.74rem;color:var(--brand-deep);font-weight:700;margin-top:2px;">₱ Tap to Set</div>
        </div>
      </div>` : "";

    const cardsHtml = items.map(p => {
      const hasDual = p.piecesPerPack > 1;
      const fullPacks = hasDual ? Math.floor(p.stock / p.piecesPerPack) : 0;
      const loose = hasDual ? p.stock % p.piecesPerPack : 0;
      const packPrice = p.packPrice || (p.price * (p.piecesPerPack || 1));
      const stockBadgeText = hasDual
        ? `${fullPacks}pk + ${loose}pc`
        : `${p.stock}`;
      // (2026-07-13) Tag cards with has-img for white background; was plain
      const hasImg = !!(p.imageUrl && p.imageUrl.trim());
      return `
      <div class="product-card ${p.stock<=0?"oos":""} ${hasImg?"has-img":""}" data-id="${p.id}" role="button">
        <div class="thumb">
          ${Utils.productThumb(p, { iconSize:30 })}
          <span class="stock-tag badge ${p.stock<=0?"badge-rust": p.stock<=p.lowStockThreshold ? "badge-amber":"badge-green"}">${stockBadgeText}</span>
        </div>
        <div class="info">
          ${p.brand ? `<span class="brand-lbl">${Utils.escapeHtml(p.brand)}</span>` : ""}
          <span class="name">${Utils.escapeHtml(p.name)}</span>
          <div class="price">
            ${hasDual
              ? `<span style="font-size:.82rem;">${Utils.money(packPrice)}/pk</span><span class="brand-cell" style="display:inline;margin-left:4px;font-size:.68rem;">${Utils.money(p.price)}/pc</span>`
              : Utils.money(p.price)
            }
          </div>
        </div>
      </div>`;
    }).join("");

    grid.innerHTML = customCardHtml + (items.length ? cardsHtml : `<div class="empty" style="grid-column:2/-1;">${Icons.get("search",{size:34})}<h3>No products found</h3><p>Try a different search or category.</p></div>`);

    // (2026-07-13) Add kinetic touch scroll on product cards; was plain click
    let isScrollDragging = false;
    let dragStartY = 0, dragStartScrollTop = 0, dragLastY = 0, dragLastTime = 0, dragVelocityY = 0;
    let momentumTimer = null;
    grid.onpointerdown = (e) => {
      if(momentumTimer) cancelAnimationFrame(momentumTimer);
      isScrollDragging = false;
      dragStartY = e.clientY;
      dragStartScrollTop = grid.scrollTop;
      dragLastY = e.clientY;
      dragLastTime = performance.now();
      dragVelocityY = 0;
    };
    grid.onpointermove = (e) => {
      const deltaY = e.clientY - dragStartY;
      if(!isScrollDragging && Math.abs(deltaY) > 6){
        isScrollDragging = true;
      }
      if(isScrollDragging){
        grid.scrollTop = dragStartScrollTop - deltaY;
        const now = performance.now();
        const dt = Math.max(1, now - dragLastTime);
        dragVelocityY = (dragLastY - e.clientY) / dt;
        dragLastY = e.clientY;
        dragLastTime = now;
      }
    };
    grid.onpointerup = () => {
      if(isScrollDragging){
        let v = dragVelocityY * 16;
        const step = () => {
          if(Math.abs(v) > 0.5){
            grid.scrollTop += v;
            v *= 0.92;
            momentumTimer = requestAnimationFrame(step);
          }
        };
        if(Math.abs(v) > 1) momentumTimer = requestAnimationFrame(step);
        setTimeout(() => { isScrollDragging = false; }, 80);
      }
    };
    grid.onpointercancel = () => { isScrollDragging = false; };
    grid.onclick = (e) => {
      if(isScrollDragging) return;
      const customBtn = e.target.closest("#btn-grid-custom-item");
      if(customBtn){
        openCustomItemModal();
        return;
      }
      const card = e.target.closest(".product-card[data-id]");
      if(!card || card.classList.contains("oos")) return;
      const pid = card.dataset.id;
      const p = DB.getProducts().find(x => x.id === pid);
      if(!p) return;
      if(p.piecesPerPack > 1){
        promptDualUnitSale(p, card);
      } else {
        if(addToCart(p, 1, "piece")){
          animateFlyToCart(card, p);
          Utils.toast(`Added ${p.name}`, "success", 1000);
        }
      }
    };

    const pag = document.getElementById("pos-pagination");
    if(pag){
      if(allFiltered.length > CATALOG_PAGE_SIZE){
        const startItem = startIndex + 1;
        const endItem = Math.min(allFiltered.length, startIndex + CATALOG_PAGE_SIZE);
        let pageBtnsHtml = "";
        for(let i = 1; i <= totalPages; i++){
          if(i === 1 || i === totalPages || (i >= catalogPage - 1 && i <= catalogPage + 1)){
            pageBtnsHtml += `<button class="btn-page ${i===catalogPage?"active":""}" data-pos-page="${i}">${i}</button>`;
          } else if(i === catalogPage - 2 || i === catalogPage + 2){
            pageBtnsHtml += `<span style="padding:0 4px;color:var(--ink-faint);">…</span>`;
          }
        }
        pag.style.display = "flex";
        pag.innerHTML = `
          <div style="font-size:.78rem;color:var(--ink-faint);">Showing <strong>${startItem}–${endItem}</strong> of <strong>${allFiltered.length}</strong> items</div>
          <div class="pagination-controls">
            <button class="btn-page" id="pos-prev-page" ${catalogPage<=1?"disabled":""} title="Previous">${Icons.get("chevron-left",{size:13})}</button>
            ${pageBtnsHtml}
            <button class="btn-page" id="pos-next-page" ${catalogPage>=totalPages?"disabled":""} title="Next"><span style="display:inline-flex;transform:rotate(180deg);">${Icons.get("chevron-left",{size:13})}</span></button>
          </div>`;
        pag.querySelector("#pos-prev-page")?.addEventListener("click", () => { if(catalogPage > 1){ catalogPage--; renderCatalog(); grid.scrollTop = 0; } });
        pag.querySelector("#pos-next-page")?.addEventListener("click", () => { if(catalogPage < totalPages){ catalogPage++; renderCatalog(); grid.scrollTop = 0; } });
        pag.querySelectorAll("[data-pos-page]").forEach(btn => {
          btn.onclick = () => { catalogPage = Number(btn.dataset.posPage); renderCatalog(); grid.scrollTop = 0; };
        });
      } else {
        pag.style.display = "none";
        pag.innerHTML = "";
      }
    }
  }

  function promptDualUnitSale(product, fromBtn){
    const piecesPerPack = product.piecesPerPack || 10;
    const packPrice = product.packPrice || (product.price * piecesPerPack);
    const fullPacks = Math.floor(product.stock / piecesPerPack);
    const loose = product.stock % piecesPerPack;
    const body = `
      <p class="text-sm text-faint" style="margin-bottom:12px;">Available: <strong>${fullPacks} full pack(s)</strong> (${piecesPerPack} pcs/pk) · <strong>${loose} loose piece(s)</strong> (Total: ${product.stock} pcs)</p>
      <div class="grid-2" style="gap:10px;">
        <button type="button" class="btn btn-outline" id="btn-buy-pack" style="padding:16px 10px;flex-direction:column;gap:4px;height:auto;" ${fullPacks<1?"disabled":""}>
          <strong style="font-size:1.05rem;">Sell Full Pack</strong>
          <span class="mono" style="color:var(--brand-deep);font-weight:700;">${Utils.money(packPrice)}</span>
          <span class="text-xs text-faint">${piecesPerPack} pcs/pack</span>
        </button>
        <button type="button" class="btn btn-outline" id="btn-buy-piece" style="padding:16px 10px;flex-direction:column;gap:4px;height:auto;" ${product.stock<1?"disabled":""}>
          <strong style="font-size:1.05rem;">Sell Loose Piece</strong>
          <span class="mono" style="color:var(--brand-deep);font-weight:700;">${Utils.money(product.price)}</span>
          <span class="text-xs text-faint">Individual pc</span>
        </button>
      </div>`;
    const modal = Modal.open({
      title: `${Icons.get("package",{size:17})} Select Sale Unit — ${Utils.escapeHtml(product.name)}`,
      body,
      actions: [{ label:"Cancel", cls:"btn-ghost" }]
    });
    modal.querySelector("#btn-buy-pack")?.addEventListener("click", () => {
      if(addToCart(product, 1, "pack")){
        if(fromBtn) animateFlyToCart(fromBtn, product);
        Utils.toast(`Added 1 pack of ${product.name}`, "success", 1200);
        Modal.close();
      }
    });
    modal.querySelector("#btn-buy-piece")?.addEventListener("click", () => {
      if(addToCart(product, 1, "piece")){
        if(fromBtn) animateFlyToCart(fromBtn, product);
        Utils.toast(`Added 1 pc of ${product.name}`, "success", 1200);
        Modal.close();
      }
    });
  }

  // (2026-07-13) Scroll cart-items to bottom on newly added items; was none
  function renderCart(scrollToBottom = false){
    const el = document.getElementById("cart-items");
    const settings = DB.getSettings();
    if(el){
      el.innerHTML = cart.length ? cart.map((l, idx) => `
        <div class="cart-line" data-prod-id="${l.productId}">
          <div class="thumb-sm">${l.isCustom ? `<span style="display:flex;align-items:center;justify-content:center;color:var(--brand);">${Icons.get("plus-circle",{size:18})}</span>` : Utils.productThumb({ ...l, category:l.category }, { iconSize:15 })}</div>
          <div class="info">
            <div class="n">${Utils.escapeHtml(l.name)} ${l.unitType==="pack" ? `<span class="badge badge-brand text-xs" style="font-size:.62rem;padding:1px 5px;margin-left:2px;">PACK (${l.piecesPerPack})</span>` : l.isCustom ? `<span class="badge badge-neutral text-xs" style="font-size:.60rem;padding:1px 4px;margin-left:2px;">Custom</span>` : ""}</div>
            <div class="p" style="display:flex;align-items:center;gap:3px;">
              ${l.isCustom
                ? `<span style="font-size:.70rem;color:var(--ink-faint);">₱</span><input type="number" class="custom-cart-price-input" data-price-idx="${idx}" value="${l.price}" min="0" step="0.01" title="Edit custom price"><span style="font-size:.68rem;color:var(--ink-faint);">/ ${l.unit}</span>`
                : `${Utils.money(l.price)} / ${l.unit}`
              }
            </div>
          </div>
          <div class="qty-stepper">
            <button data-dec="${idx}">${Icons.get("minus",{size:12})}</button>
            <span class="q">${l.qty}</span>
            <button data-inc="${idx}">${Icons.get("plus",{size:12})}</button>
          </div>
          <div class="lt">${Utils.money(l.price*l.qty)}</div>
          <button class="icon-btn btn-sm" data-rm="${idx}" style="width:26px;height:26px;">${Icons.get("x",{size:13})}</button>
        </div>`).join("") : `<div class="empty">${Icons.get("cart",{size:34})}<h3>Cart is empty</h3><p>Tap a product or scan a barcode.</p></div>`;

      if(scrollToBottom){
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
      }
      el.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.inc),1));
      el.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.dec),-1));
      el.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>removeLine(Number(b.dataset.rm)));
      el.querySelectorAll(".custom-cart-price-input").forEach(inp => {
        inp.addEventListener("change", (e) => {
          const idx = Number(e.target.dataset.priceIdx);
          const val = Math.max(0, Number(e.target.value) || 0);
          if(cart[idx]){
            pushState();
            cart[idx].price = Utils.round2(val);
            renderCart();
          }
        });
        inp.addEventListener("click", (e) => e.stopPropagation());
      });
    }
    const t = totals();
    const foot = document.getElementById("cart-foot");
    // (2026-07-13) Improve cart footer design & cleanup; was unstyled rows
    if(foot){
      foot.innerHTML = `
        <div class="totals-summary">
          <div class="totals-row"><span>Subtotal</span><span class="mono">${Utils.money(t.subtotal)}</span></div>
          <div class="totals-row" style="align-items:center;">
            <span>Discount</span>
            <span style="display:flex;gap:5px;align-items:center;">
              <span class="discount-type-toggle" id="discount-type-toggle">
                <button type="button" class="dt-btn ${discount.type==="percent"?"active":""}" data-type="percent">%</button>
                <button type="button" class="dt-btn ${discount.type==="amount"?"active":""}" data-type="amount">₱</button>
              </span>
              <input type="number" id="discount-input" value="${discount.value}" min="0" ${discount.type==="percent"?'max="100"':""} step="${discount.type==="percent"?"1":"0.01"}" class="discount-input">
            </span>
          </div>
          ${t.discountAmt ? `<div class="totals-row"><span class="text-faint">Discount applied</span><span class="mono">-${Utils.money(t.discountAmt)}</span></div>` : ""}
          ${settings.vatEnabled ? `<div class="totals-row"><span>VAT incl. (${settings.vatRate}%)</span><span class="mono">${Utils.money(t.vat)}</span></div>` : ""}
          <div class="totals-row grand"><span>Total</span><span class="mono">${Utils.money(t.grand)}</span></div>
        </div>
        <div class="cart-actions-row">
          <button class="btn btn-ghost btn-sm" id="btn-undo" ${undoStack.length===0?"disabled":""}>${Icons.get("undo",{size:13})} Undo</button>
          <button class="btn btn-ghost btn-sm" id="btn-redo" ${redoStack.length===0?"disabled":""}>${Icons.get("redo",{size:13})} Redo</button>
          <button class="btn btn-ghost btn-sm" id="btn-hold">${Icons.get("pause-circle",{size:13})} Hold</button>
          <button class="btn btn-ghost btn-sm" id="btn-clear">${Icons.get("trash",{size:13})} Clear</button>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:6px;padding:9px 12px;font-size:var(--fs-sm);" id="btn-checkout">
          ${Icons.get("credit-card",{size:14})} Charge ${Utils.money(t.grand)}
        </button>`;
      if(DB.saveCart) DB.saveCart({ cart, discount });
      document.getElementById("discount-input").addEventListener("change", (e)=>{
        const raw = Number(e.target.value)||0;
        pushState();
        discount.value = discount.type === "percent" ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw);
        renderCart();
      });
      document.getElementById("discount-type-toggle").addEventListener("click", (e)=>{
        const btn = e.target.closest(".dt-btn"); if(!btn) return;
        pushState();
        discount.type = btn.dataset.type;
        renderCart();
      });
      document.getElementById("btn-undo").onclick = undo;
      document.getElementById("btn-redo").onclick = redo;
      document.getElementById("btn-hold").onclick = holdSale;
      document.getElementById("btn-clear").onclick = () => Modal.confirm({ title:"Clear cart?", message:"This removes all items from the current sale.", onConfirm: clearCart });
      document.getElementById("btn-checkout").onclick = openCheckout;
    }
  }

  // (2026-07-13) Add custom priced product & item modal in POS; was catalog only
  function openCustomItemModal(){
    const body = `
      <div class="field">
        <label>Item Name / Description</label>
        <input class="input" id="custom-item-name" placeholder="e.g. Extra Packaging, Delivery, Custom Item" value="Custom Item">
      </div>
      <div class="input-row" style="margin-top:10px;">
        <div class="field">
          <label>Price (₱)</label>
          <input class="input" id="custom-item-price" type="number" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="field">
          <label>Quantity</label>
          <input class="input" id="custom-item-qty" type="number" min="1" step="1" value="1">
        </div>
      </div>`;

    const modal = Modal.open({
      title: `${Icons.get("plus-circle",{size:17})} Add Custom Item / Price`,
      body,
      actions: [
        { label:"Cancel", cls:"btn-ghost" },
        { label:"Add to Sale", cls:"btn-primary", onClick: () => {
          const name = modal.querySelector("#custom-item-name").value.trim() || "Custom Item";
          const price = Number(modal.querySelector("#custom-item-price").value) || 0;
          const qty = Math.max(1, Number(modal.querySelector("#custom-item-qty").value) || 1);
          if(price < 0){ Utils.toast("Price cannot be negative.", "warn"); return; }
          pushState();
          cart.push({
            productId: Utils.uid("cust"),
            name,
            price: Utils.round2(price),
            qty,
            unitType: "piece",
            unit: "pc",
            piecesPerPack: 1,
            isCustom: true,
            imageUrl: "",
            category: "Custom"
          });
          renderCart(true);
          Utils.toast(`Added ${name} (${Utils.money(price)})`, "success", 1200);
          Modal.close();
        }}
      ]
    });
    setTimeout(() => {
      const priceInput = modal.querySelector("#custom-item-price");
      if(priceInput) priceInput.focus();
    }, 80);
  }

  function render(){
    const view = document.getElementById("view-root");
    view.innerHTML = `
      <div class="view-head">
        <div>
          <h2>${Icons.get("cart",{size:22})} Point of Sale</h2>
          <!-- (2026-07-13) Real-time clock container; was static text -->
          <div class="view-sub" id="pos-view-sub">${Auth.currentUser()?.name} · ${Utils.fmtDate(Date.now())}</div>
        </div>
        <div class="input-row" style="width:auto;">
          <button class="btn btn-outline" id="btn-custom-item">${Icons.get("plus-circle",{size:15})} Custom Item</button>
          <button class="btn btn-primary" id="btn-scan-mode">${Icons.get("scan",{size:15})} Scan Mode</button>
          <button class="btn btn-ghost" id="btn-held">${Icons.get("pause-circle",{size:15})} Held (<span id="held-count">0</span>)</button>
        </div>
      </div>
      <div class="pos-layout">
        <div class="pos-catalog">
          <!-- (2026-07-13) Dynamic clear button in POS search bar; was plain input -->
          <div class="pos-search-row">
            <div class="input-icon-wrap" style="position:relative;width:100%;">
              ${Icons.get("search",{size:15})}
              <input class="input scan-target" id="pos-search" placeholder="Search product or brand, or scan a barcode…" autofocus>
              <button type="button" class="clear-search-btn" id="btn-clear-pos-search" title="Clear search">${Icons.get("x",{size:15})}</button>
            </div>
          </div>
          <div class="category-chips" id="cat-chips"></div>
          <div class="product-grid" id="product-grid"></div>
          <div class="pagination-bar" id="pos-pagination" style="display:none;margin-top:6px;padding:6px 2px;flex-shrink:0;"></div>
        </div>
        <div class="pos-cart">
          <div class="cart-head"><h3>${Icons.get("cart",{size:17})} Current Sale</h3><span class="badge badge-neutral" id="cart-count">0 items</span></div>
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-foot" id="cart-foot"></div>
        </div>
      </div>`;

    const chips = document.getElementById("cat-chips");
    chips.innerHTML = categoryList().map(c => `<div class="chip ${c===activeCategory?"active":""}" data-c="${c}">${c}</div>`).join("");
    chips.querySelectorAll(".chip").forEach(c => c.onclick = () => { activeCategory = c.dataset.c; catalogPage = 1; renderCatalog(); chips.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active", x===c)); });
    // (2026-07-13) Enable mouse wheel scroll on category chips; was vertical only
    chips.addEventListener("wheel", (e) => {
      if(e.deltaY !== 0){
        e.preventDefault();
        chips.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // (2026-07-13) Auto-reset POS search term on navigation; was persistent
    searchTerm = "";
    catalogPage = 1;
    const search = document.getElementById("pos-search");
    const clearBtn = document.getElementById("btn-clear-pos-search");
    const onSearchChange = (val) => {
      searchTerm = val;
      catalogPage = 1;
      if(clearBtn){
        if(val.length > 0){
          clearBtn.classList.add("visible");
        } else {
          clearBtn.classList.remove("visible");
        }
      }
      renderCatalog();
    };
    search.addEventListener("input", Utils.debounce((e)=>{ onSearchChange(e.target.value); }, 120));
    if(clearBtn){
      clearBtn.onclick = () => {
        search.value = "";
        onSearchChange("");
        search.focus();
      };
    }

    document.getElementById("btn-custom-item").onclick = openCustomItemModal;
    document.getElementById("btn-held").onclick = openHeldSales;
    document.getElementById("btn-scan-mode").onclick = openScanMode;

    Scanner.setContext(addByBarcode);
    renderCatalog();
    renderCart();
    renderHeldButton();
  }

  function resetSearch(){ searchTerm = ""; }

  return { render, addByBarcode, printByRecord: printReceipt, resetSearch };
})();
