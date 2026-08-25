// ============================================================
// gasoline.js — Fuel Station, 4000L Tanker Deliveries, Volatile Daily Pricing & Telemetry
// ============================================================
const Gas = (() => {
  // (2026-07-13) Fix duplicate pump fuel & high-contrast dispenser UI; was faint
  let selectedPump = "pump1";
  let mode = "amount"; // "amount" | "liters"
  let periodFilter = "today"; // "today" | "this_week" | "last_week" | "this_month" | "last_month" | "all"

  function getRange(p){
    if(typeof Analytics !== "undefined" && typeof Analytics.getPeriodRange === "function"){
      return Analytics.getPeriodRange(p);
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { start: todayStart, end: Date.now(), label: "Today" };
  }

  function filteredFuelSales(){
    const r = getRange(periodFilter);
    return DB.getFuelSales().filter(s => s.ts >= r.start && s.ts <= r.end);
  }

  function selectPump(pumpId){
    selectedPump = pumpId;
    renderPumps();
    renderSalePanel();
  }

  function setMode(newMode){
    mode = newMode;
    renderSalePanel();
  }

  function calculateSRP(cost, margin = 6.50){
    const baseCost = Number(cost) || 65.00;
    return Utils.round2(baseCost + margin);
  }  // (2026-07-13) SaaS redesign for gasoline charts & KPI cards; was colorful
  // Generate SVG Donut Chart with Gasoline (Green), Diesel (Yellow), Premium (Red), and Empty Space (Gray)
  function renderDonutChartSvg(cfg){
    const fuels = Object.entries(cfg.fuels);
    const totalCapacity = fuels.reduce((s, [,f]) => s + (f.capacity || 10000), 0);
    const totalInTanks = fuels.reduce((s, [,f]) => s + (f.tank || 0), 0);
    const emptySpace = Math.max(0, totalCapacity - totalInTanks);

    const segments = [];
    fuels.forEach(([k, f]) => {
      let col = f.color;
      if(!col){
        col = k === "diesel" ? "#F59E0B" : k === "premium" ? "#EF4444" : "#10B981";
      }
      segments.push({
        key: k,
        name: f.name,
        liters: f.tank,
        capacity: f.capacity || 10000,
        color: col,
        pct: totalCapacity > 0 ? (f.tank / totalCapacity) : 0
      });
    });

    segments.push({
      key: "empty",
      name: "Empty Tank Space",
      liters: emptySpace,
      capacity: totalCapacity,
      color: "#E5E7EB",
      pct: totalCapacity > 0 ? (emptySpace / totalCapacity) : 0,
      isEmpty: true
    });

    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    const circlesHtml = segments.map(seg => {
      const dashLength = seg.pct * circumference;
      const spaceLength = circumference - dashLength;
      const strokeDasharray = `${dashLength} ${spaceLength}`;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += dashLength;

      return `
        <circle cx="75" cy="75" r="${radius}" fill="none"
          stroke="${seg.color}" stroke-width="18"
          stroke-dasharray="${strokeDasharray}"
          stroke-dashoffset="${strokeDashoffset}"
          stroke-linecap="butt"
          style="transition: stroke-dasharray .5s ease, stroke-dashoffset .5s ease; opacity:${seg.isEmpty?0.4:1};" />
      `;
    }).join("");

    const overallPct = totalCapacity > 0 ? Math.round((totalInTanks / totalCapacity) * 100) : 0;

    return `
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
          <svg viewBox="0 0 150 150" width="140" height="140" style="transform:rotate(-90deg);">
            ${circlesHtml}
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;">
            <strong style="font-size:1.50rem;font-weight:700;color:#111827;font-family:var(--font-mono);line-height:1;">${overallPct}%</strong>
            <span style="font-size:.68rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Station Full</span>
          </div>
        </div>
        <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px;">
          ${segments.map(seg => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:.82rem;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${seg.color};opacity:${seg.isEmpty?0.5:1};"></span>
                <span style="font-weight:500;color:${seg.isEmpty?"#9CA3AF":"#374151"};">${Utils.escapeHtml(seg.name)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <strong class="mono" style="font-weight:600;color:${seg.isEmpty?"#9CA3AF":"#111827"};">${seg.liters.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} L</strong>
                <span class="badge badge-neutral mono" style="font-size:.70rem;padding:2px 6px;background:#F3F4F6;color:#4B5563;border:none;border-radius:4px;">${Math.round(seg.pct*100)}%</span>
              </div>
            </div>
          `).join("")}
          <div style="border-top:1px solid #E5E7EB;padding-top:10px;margin-top:2px;display:flex;justify-content:space-between;font-size:.78rem;font-weight:500;color:#6B7280;">
            <span>ECC 3-Tank Capacity:</span>
            <span class="mono" style="font-weight:700;color:#111827;">${totalCapacity.toLocaleString()} Liters</span>
          </div>
        </div>
      </div>
    `;
  }

  // (2026-07-13) Fix trend chart overlap and flex layout; was absolute/wrapping
  function renderWeeklyTrends(cfg){
    const r = getRange(periodFilter);
    const allSales = DB.getFuelSales();
    const days = [];

    const numDays = periodFilter === "today" ? 1 : periodFilter === "last_week" || periodFilter === "this_week" || periodFilter === "7d" ? 7 : 14;
    const endTs = r.end;

    for(let i = numDays - 1; i >= 0; i--){
      const d = new Date(endTs);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;

      const salesOnDay = allSales.filter(s => s.ts >= dayStart && s.ts < dayEnd);
      const gasLiters = salesOnDay.filter(s => s.fuelType === "gasoline").reduce((s,x) => s + (x.liters||0), 0);
      const dieselLiters = salesOnDay.filter(s => s.fuelType === "diesel").reduce((s,x) => s + (x.liters||0), 0);
      const premLiters = salesOnDay.filter(s => s.fuelType === "premium").reduce((s,x) => s + (x.liters||0), 0);
      const totalRev = salesOnDay.reduce((s,x) => s + (x.amount||0), 0);

      days.push({
        label: numDays <= 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : `${d.getMonth()+1}/${d.getDate()}`,
        iso,
        gasLiters,
        dieselLiters,
        premLiters,
        totalLiters: gasLiters + dieselLiters + premLiters,
        totalRev,
        isToday: i === 0
      });
    }

    const maxLiters = Math.max(100, ...days.map(d => d.totalLiters));
    const periodSales = filteredFuelSales();
    const gasTot = periodSales.filter(s => s.fuelType === "gasoline").reduce((s,x) => s + (x.liters||0), 0);
    const dieselTot = periodSales.filter(s => s.fuelType === "diesel").reduce((s,x) => s + (x.liters||0), 0);
    const premTot = periodSales.filter(s => s.fuelType === "premium").reduce((s,x) => s + (x.liters||0), 0);
    const sumTot = gasTot + dieselTot + premTot;

    return `
      <div style="display:flex;gap:16px;align-items:stretch;justify-content:space-between;width:100%;">
        <!-- Left: Stacked Bar Chart -->
        <div style="flex:1;min-width:0;display:flex;align-items:flex-end;gap:6px;height:140px;padding-top:14px;border-bottom:1px solid #E5E7EB;overflow-x:auto;">
          ${days.map(d => {
            const heightPct = Math.max(8, Math.round((d.totalLiters / maxLiters) * 100));
            const gasH = d.totalLiters > 0 ? Math.round((d.gasLiters / d.totalLiters) * heightPct) : 0;
            const premH = d.totalLiters > 0 ? Math.round((d.premLiters / d.totalLiters) * heightPct) : 0;
            const dieselH = Math.max(0, heightPct - gasH - premH);

            return `
              <div style="flex:1;min-width:22px;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:3px;" title="${d.iso}: ${d.totalLiters.toFixed(1)}L (${Utils.money(d.totalRev)})">
                <div style="font-size:.64rem;font-family:var(--font-mono);font-weight:600;color:#4B5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center;">${d.totalLiters>0?d.totalLiters.toFixed(1):""}</div>
                <div style="width:100%;max-width:28px;height:${heightPct}%;display:flex;flex-direction:column;border-radius:4px;overflow:hidden;background:#F3F4F6;">
                  <div style="height:${premH}%;background:#EF4444;" title="Premium: ${d.premLiters.toFixed(1)}L"></div>
                  <div style="height:${dieselH}%;background:#F59E0B;" title="Diesel: ${d.dieselLiters.toFixed(1)}L"></div>
                  <div style="height:${gasH}%;background:#10B981;" title="Gasoline: ${d.gasLiters.toFixed(1)}L"></div>
                </div>
                <div style="font-size:.68rem;font-weight:${d.isToday?700:500};color:${d.isToday?"#4F46E5":"#6B7280"};margin-top:2px;white-space:nowrap;">${d.label}</div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- Right: Breakdown Box without overlapping -->
        <div style="width:185px;flex-shrink:0;background:#F9FAFB;padding:12px 14px;border-radius:8px;border:1px solid #E5E7EB;display:flex;flex-direction:column;justify-content:center;gap:7px;">
          <div style="display:flex;justify-content:space-between;font-size:.76rem;font-weight:700;border-bottom:1px solid #E5E7EB;padding-bottom:5px;color:#111827;">
            <span>Total (${r.label}):</span>
            <strong class="mono" style="color:#111827;font-weight:700;">${sumTot.toFixed(1)} L</strong>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:.74rem;">
            <span style="display:flex;align-items:center;gap:6px;color:#374151;font-weight:500;">
              <span style="width:6px;height:6px;border-radius:50%;background:#10B981;"></span>Gasoline
            </span>
            <span class="mono" style="font-weight:600;color:#111827;">${gasTot.toFixed(1)} L <span style="color:#9CA3AF;font-weight:400;">(${sumTot>0?Math.round((gasTot/sumTot)*100):0}%)</span></span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:.74rem;">
            <span style="display:flex;align-items:center;gap:6px;color:#374151;font-weight:500;">
              <span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;"></span>Diesel
            </span>
            <span class="mono" style="font-weight:600;color:#111827;">${dieselTot.toFixed(1)} L <span style="color:#9CA3AF;font-weight:400;">(${sumTot>0?Math.round((dieselTot/sumTot)*100):0}%)</span></span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:.74rem;">
            <span style="display:flex;align-items:center;gap:6px;color:#374151;font-weight:500;">
              <span style="width:6px;height:6px;border-radius:50%;background:#EF4444;"></span>Premium
            </span>
            <span class="mono" style="font-weight:600;color:#111827;">${premTot.toFixed(1)} L <span style="color:#9CA3AF;font-weight:400;">(${sumTot>0?Math.round((premTot/sumTot)*100):0}%)</span></span>
          </div>
        </div>
      </div>
    `;
  }

  // Top KPI Stat Strip with Clean Corporate SaaS Architecture
  function renderTodayStrip(){
    const wrap = document.getElementById("today-fuel-strip");
    if(!wrap) return;
    const cfg = DB.getFuelConfig();
    const r = getRange(periodFilter);
    const sales = filteredFuelSales();

    const byFuel = {
      gasoline: { liters:0, amount:0, cost:0 },
      diesel:   { liters:0, amount:0, cost:0 },
      premium:  { liters:0, amount:0, cost:0 }
    };

    sales.forEach(s => {
      const type = s.fuelType || "gasoline";
      const fCost = s.costPerL || cfg.fuels[type]?.cost || 0;
      if(byFuel[type]){
        byFuel[type].liters += (s.liters || 0);
        byFuel[type].amount += (s.amount || 0);
        byFuel[type].cost += ((s.liters || 0) * fCost);
      }
    });

    const totalRevenue = sales.reduce((s,x) => s + (x.amount||0), 0);
    const totalCOGS = Object.values(byFuel).reduce((s,x) => s + x.cost, 0);
    const totalProfit = Math.max(0, totalRevenue - totalCOGS);
    const marginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;
    const totalLiters = sales.reduce((s,x) => s + (x.liters||0), 0);

    const periodDeliveries = (DB.getFuelDeliveries ? DB.getFuelDeliveries() : []).filter(d => (d.ts >= r.start && d.ts <= r.end));
    const deliveryExpense = periodDeliveries.reduce((s,x) => s + (x.totalCost||0), 0);
    const periodOpEx = (DB.getExpenses ? DB.getExpenses() : []).filter(e => (e.ts >= r.start && e.ts <= r.end)).reduce((s,x) => s + (x.amount||0), 0);
    const totalExpenses = deliveryExpense + periodOpEx;

    // (2026-07-13) Net profit visual priority & SaaS KPI strip; was equal weight
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;width:100%;">
        <!-- 1. Revenue Card -->
        <div style="padding:20px 22px;border-radius:10px;background:#FFFFFF;border:1px solid #E5E7EB;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="lbl" style="font-size:.75rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:6px;">
                <span style="color:#9CA3AF;">${Icons.get("dollar-sign",{size:14})}</span> ${r.label} Revenue
              </div>
              <div class="val" style="font-size:1.55rem;font-weight:700;color:#111827;margin:8px 0 4px;font-family:var(--font-mono);">${Utils.money(totalRevenue)}</div>
              <div style="font-size:.75rem;font-weight:500;color:#6B7280;">${sales.length} dispense sales</div>
            </div>
            <svg width="60" height="28" viewBox="0 0 60 28" fill="none" style="opacity:.6;">
              <path d="M2 24 Q 16 8, 30 18 T 58 4" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
        </div>

        <!-- 2. Gross Fuel Profit Card (Standout Priority Hero) -->
        <div style="padding:20px 22px;border-radius:10px;background:#FFFFFF;border:1px solid #D1FAE5;border-top:2px solid #059669;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="lbl" style="font-size:.75rem;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:6px;">
                <span style="color:#059669;">${Icons.get("trending-up",{size:14})}</span> ${r.label} Net Profit
              </div>
              <div class="val" style="font-size:1.80rem;font-weight:850;color:#059669;margin:8px 0 4px;font-family:var(--font-mono);">+${Utils.money(totalProfit)}</div>
              <div style="font-size:.75rem;font-weight:600;color:#059669;">${marginPct.toFixed(1)}% gross margin</div>
            </div>
            <svg width="60" height="28" viewBox="0 0 60 28" fill="none" style="opacity:.8;">
              <path d="M2 22 Q 16 20, 32 10 T 58 3" stroke="#059669" stroke-width="2" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
        </div>

        <!-- 3. Expenses Card -->
        <div style="padding:20px 22px;border-radius:10px;background:#FFFFFF;border:1px solid #E5E7EB;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="lbl" style="font-size:.75rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:6px;">
                <span style="color:#9CA3AF;">${Icons.get("truck",{size:14})}</span> ${r.label} Expenses
              </div>
              <div class="val" style="font-size:1.55rem;font-weight:700;color:#111827;margin:8px 0 4px;font-family:var(--font-mono);">${Utils.money(totalExpenses)}</div>
              <div style="font-size:.75rem;font-weight:500;color:#6B7280;">${periodDeliveries.length} bulk tankers logged</div>
            </div>
            <svg width="60" height="28" viewBox="0 0 60 28" fill="none" style="opacity:.6;">
              <path d="M2 26 Q 18 22, 34 12 T 58 6" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
        </div>

        <!-- 4. Total Volume Dispensed Card -->
        <div style="padding:20px 22px;border-radius:10px;background:#FFFFFF;border:1px solid #E5E7EB;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div class="lbl" style="font-size:.75rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:6px;">
                <span style="color:#9CA3AF;">${Icons.get("droplet",{size:14})}</span> Volume (${r.label})
            </div>
            <div class="val" style="font-size:1.55rem;font-weight:700;color:#111827;margin:8px 0 4px;font-family:var(--font-mono);">
              ${totalLiters.toFixed(1)} <span style="font-size:1rem;color:#6B7280;font-weight:500;">L</span>
            </div>
          </div>
          <div style="font-size:.74rem;font-weight:500;color:#6B7280;display:flex;align-items:center;gap:10px;">
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#10B981;"></span> G: ${byFuel.gasoline.liters.toFixed(0)}L</span>
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;"></span> D: ${byFuel.diesel.liters.toFixed(0)}L</span>
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#EF4444;"></span> P: ${byFuel.premium.liters.toFixed(0)}L</span>
          </div>
        </div>
      </div>
    `;
  }

  // (2026-07-13) Refined pump cards color & button radius; was tied to fuel type
  // Dispenser Terminals with Neutral Modern Cards & Active Accent
  // (2026-07-13) Hide pump stat cards & tanker cost for cashiers; was shown to all
  function renderPumps(){
    const cfg = DB.getFuelConfig();
    const grid = document.getElementById("pump-grid");
    if(!grid) return;
    const r = getRange(periodFilter);
    const allSales = filteredFuelSales();
    const isAdmin = Auth.isAdmin();

    grid.innerHTML = cfg.pumps.map(pump => {
      const fuel = cfg.fuels[pump.fuelType] || cfg.fuels.gasoline;
      const pct = Math.min(100, Math.round((fuel.tank / (fuel.capacity || 10000)) * 100));
      const low = fuel.tank <= (fuel.lowLevel || 2000);
      const isSelected = selectedPump === pump.id;
      const color = fuel.color || (pump.fuelType === "diesel" ? "#F59E0B" : pump.fuelType === "premium" ? "#EF4444" : "#10B981");
      const tankBarColor = pct <= 15 || low ? "#EF4444" : pct <= 25 ? "#F59E0B" : "#4F46E5";

      const tankerCost = fuel.cost || 65.00;
      const suggestedSRP = calculateSRP(tankerCost, 6.50);

      const pumpSales = allSales.filter(s => s.pumpId === pump.id || s.fuelType === pump.fuelType);
      const pumpLiters = pumpSales.reduce((s,x) => s + (x.liters || 0), 0);
      const pumpRevenue = pumpSales.reduce((s,x) => s + (x.amount || 0), 0);
      const pumpCOGS = pumpSales.reduce((s,x) => s + ((x.liters || 0) * (x.costPerL ?? tankerCost)), 0);
      const pumpProfit = Math.max(0, pumpRevenue - pumpCOGS);
      const pumpMarginPerL = pumpLiters > 0 ? (pumpProfit / pumpLiters) : (fuel.price - tankerCost);

      return `
        <div class="pump-terminal-card ${isSelected ? "selected" : ""}" data-id="${pump.id}" style="padding:20px;border-radius:10px;border:${isSelected ? "1.5px solid #4F46E5" : "1px solid #E5E7EB"};background:#FFFFFF;cursor:pointer;position:relative;transition:all .2s ease;display:flex;flex-direction:column;justify-content:space-between;box-shadow:${isSelected ? "0 4px 12px rgba(79,70,229,0.08)" : "0 1px 3px rgba(0,0,0,0.03)"};">
          <div>
            <!-- Header Row: Neutral Pump Badge, Dot-identified Fuel Name, Status Badge -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="badge" style="background:#F3F4F6;color:#4B5563;border:1px solid #E5E7EB;font-size:.74rem;padding:2px 8px;border-radius:6px;font-weight:600;">
                  ${pump.label}
                </span>
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;"></span>
                  <strong style="font-size:1.05rem;color:#111827;font-weight:700;">
                    ${Utils.escapeHtml(fuel.name)}
                  </strong>
                </span>
              </div>
              <span class="badge" style="font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:5px;background:${low ? "#FEF2F2" : "#ECFDF5"};color:${low ? "#DC2626" : "#059669"};border:1px solid ${low ? "#FECACA" : "#A7F3D0"};">
                <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;"></span>
                ${low ? "LOW TANK" : "READY"}
              </span>
            </div>

            ${isAdmin ? `
              <!-- Admin: Price Management & SRP Guidance Box -->
              <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px 14px;margin-bottom:14px;" onclick="event.stopPropagation();">
                <!-- Live Rate Edit Row -->
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:1.25rem;font-weight:700;color:#111827;font-family:var(--font-mono);">₱</span>
                    <input class="input font-bold live-pump-price-input" data-fuel-key="${pump.fuelType}" type="number" step="0.05" min="0" value="${fuel.price.toFixed(2)}" style="width:105px;font-size:1.35rem;font-weight:700;padding:4px 8px;border-radius:7px;border:1px solid #D1D5DB;color:#111827;background:#FFFFFF;text-align:center;" title="Edit live selling price">
                    <span style="font-size:.82rem;font-weight:500;color:#6B7280;">/ Liter</span>
                  </div>
                  <button class="btn btn-sm btn-primary font-bold btn-save-live-price" data-fuel-key="${pump.fuelType}" style="padding:6px 14px;font-size:.78rem;border-radius:7px;background:#4F46E5;color:#FFFFFF;border:none;cursor:pointer;" title="Save live price">
                    ${Icons.get("check",{size:13})} Save
                  </button>
                </div>

                <!-- Cost & SRP Guidance Bar -->
                <div style="display:flex;align-items:center;justify-content:space-between;font-size:.76rem;border-top:1px dashed #E5E7EB;padding-top:8px;flex-wrap:wrap;gap:6px;">
                  <div style="color:#6B7280;font-weight:500;">
                    Tanker Cost: <strong style="color:#374151;font-weight:600;font-family:var(--font-mono);">${Utils.money(tankerCost)}/L</strong>
                  </div>
                  <div style="background:#EEF2FF;border:1px solid #C7D2FE;color:#4338CA;padding:3px 8px;border-radius:7px;font-size:.74rem;display:inline-flex;align-items:center;gap:6px;">
                    <span class="mono" style="font-weight:600;">SRP: ₱${suggestedSRP.toFixed(2)}/L</span>
                    <button class="btn btn-xs btn-apply-srp" data-fuel-key="${pump.fuelType}" data-srp="${suggestedSRP.toFixed(2)}" style="background:#4F46E5;color:#FFFFFF;border:none;border-radius:7px;padding:2px 8px;font-size:.70rem;font-weight:600;cursor:pointer;line-height:1.2;transition:all .15s ease;" title="Apply Suggested Retail Price">
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <!-- Admin: Performance Metrics Strip (3 Columns with Clear Hierarchy) -->
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px;">
                <!-- Col 1: Volume -->
                <div style="background:#F9FAFB;padding:10px 8px;border-radius:8px;border:1px solid #E5E7EB;text-align:center;">
                  <div style="font-size:.68rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px;">Volume (${r.label})</div>
                  <div style="font-size:1.05rem;font-weight:600;color:#111827;font-family:var(--font-mono);">${pumpLiters.toFixed(1)} <span style="font-size:.74rem;font-weight:500;color:#6B7280;">L</span></div>
                </div>
                <!-- Col 2: Revenue -->
                <div style="background:#F9FAFB;padding:10px 8px;border-radius:8px;border:1px solid #E5E7EB;text-align:center;">
                  <div style="font-size:.68rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px;">Pump Revenue</div>
                  <div style="font-size:1.05rem;font-weight:600;color:#111827;font-family:var(--font-mono);">${Utils.money(pumpRevenue)}</div>
                </div>
                <!-- Col 3: Profit (Visually Dominant) -->
                <div style="background:#F9FAFB;padding:10px 8px;border-radius:8px;border:1px solid #E5E7EB;text-align:center;">
                  <div style="font-size:.68rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px;">Net Profit</div>
                  <div style="font-size:1.15rem;font-weight:700;color:#059669;font-family:var(--font-mono);">+${Utils.money(pumpProfit)}</div>
                  <div style="font-size:.66rem;font-weight:500;color:#6B7280;margin-top:2px;">(+₱${pumpMarginPerL.toFixed(2)}/L)</div>
                </div>
              </div>
            ` : `
              <!-- Cashier: Clean Operational Rate Display -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:14px;">
                <span style="font-size:.80rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">Dispense Rate</span>
                <span class="mono font-bold" style="font-size:1.40rem;color:#111827;">${Utils.money(fuel.price)} <span style="font-size:.80rem;font-weight:500;color:#6B7280;">/ Liter</span></span>
              </div>
            `}
          </div>

          <!-- Bottom Continuous ECC Tank Level Bar (Neutral Indigo, Alerts on Low) -->
          <div style="margin-top:4px;">
            <div style="display:flex;justify-content:space-between;font-size:.76rem;font-weight:500;margin-bottom:6px;">
              <span style="color:#6B7280;">ECC Tank (10k L):</span>
              <strong style="font-weight:600;color:${pct <= 15 || low ? "#DC2626" : pct <= 25 ? "#D97706" : "#111827"};font-family:var(--font-mono);">${fuel.tank.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} / ${(fuel.capacity||10000).toLocaleString()} L (${pct}%)</strong>
            </div>
            <div class="tank-bar" style="height:6px;border-radius:4px;background:#E5E7EB;overflow:hidden;">
              <i style="width:${pct}%;background:${tankBarColor};display:block;height:100%;border-radius:4px;transition:width .4s;"></i>
            </div>
          </div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll(".pump-terminal-card").forEach(c => {
      c.onclick = () => selectPump(c.dataset.id);
    });

    grid.querySelectorAll(".btn-apply-srp").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const fuelKey = btn.dataset.fuelKey;
        const newSRP = Number(btn.dataset.srp) || 0;
        if(newSRP <= 0) return;
        const cfgNow = DB.getFuelConfig();
        const f = cfgNow.fuels[fuelKey];
        if(f){
          f.priceLog = f.priceLog || [];
          f.priceLog.unshift({ ts: Date.now(), price: newSRP, prev: f.price, by: Auth.currentUser()?.name });
          f.price = newSRP;
          DB.setFuelConfig(cfgNow);
          Utils.toast(`Applied Suggested SRP: ${f.name} at ₱${newSRP.toFixed(2)}/L`, "success");
          renderPumps();
          renderSalePanel();
          renderTodayStrip();
        }
      };
    });

    grid.querySelectorAll(".live-pump-price-input").forEach(inp => {
      const savePrice = () => {
        const fuelKey = inp.dataset.fuelKey;
        const newPrice = Number(inp.value) || 0;
        if(newPrice <= 0) return;
        const cfgNow = DB.getFuelConfig();
        const f = cfgNow.fuels[fuelKey];
        if(f && newPrice !== f.price){
          f.priceLog = f.priceLog || [];
          f.priceLog.unshift({ ts: Date.now(), price: newPrice, prev: f.price, by: Auth.currentUser()?.name });
          f.price = newPrice;
          DB.setFuelConfig(cfgNow);
          Utils.toast(`Updated ${f.name} to ₱${newPrice.toFixed(2)}/L`, "success");
          renderSalePanel();
          renderTodayStrip();
        }
      };

      inp.addEventListener("change", savePrice);
      inp.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){
          e.preventDefault();
          savePrice();
          inp.blur();
        }
      });
    });

    grid.querySelectorAll(".btn-save-live-price").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const fuelKey = btn.dataset.fuelKey;
        const inp = grid.querySelector(`.live-pump-price-input[data-fuel-key="${fuelKey}"]`);
        if(inp){
          const newPrice = Number(inp.value) || 0;
          if(newPrice <= 0) return;
          const cfgNow = DB.getFuelConfig();
          const f = cfgNow.fuels[fuelKey];
          if(f){
            f.priceLog = f.priceLog || [];
            f.priceLog.unshift({ ts: Date.now(), price: newPrice, prev: f.price, by: Auth.currentUser()?.name });
            f.price = newPrice;
            DB.setFuelConfig(cfgNow);
            Utils.toast(`Updated ${f.name} to ₱${newPrice.toFixed(2)}/L`, "success");
            renderSalePanel();
            renderTodayStrip();
          }
        }
      };
    });
  }

  // (2026-07-13) POS redesign for dispenser panel; was basic inputs & bias
  // Dispenser Terminal Action Panel with Clean Corporate SaaS Architecture
  function renderSalePanel(){
    const panel = document.getElementById("fuel-sale-panel");
    if(!panel) return;
    const cfg = DB.getFuelConfig();
    const pump = cfg.pumps.find(p => p.id === selectedPump) || cfg.pumps[0];
    if(!pump){ panel.innerHTML = ""; return; }
    let fuel = cfg.fuels[pump.fuelType] || cfg.fuels.gasoline;

    panel.innerHTML = `
      <div class="card" style="padding:20px 24px;border-radius:10px;border:1px solid #E5E7EB;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;">${pump.label} Dispenser Active</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
              <h3 style="font-size:1.20rem;font-weight:700;margin:0;color:#111827;">Dispense Fuel</h3>
              <span class="badge" style="display:inline-flex;align-items:center;gap:6px;background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;font-size:.80rem;padding:3px 10px;border-radius:6px;font-weight:600;">
                <span style="width:6px;height:6px;border-radius:50%;background:${fuel.color||'#10B981'};"></span>
                ${Utils.escapeHtml(fuel.name)}
              </span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;background:#F3F4F6;padding:3px;border-radius:6px;border:1px solid #E5E7EB;">
            <button class="chip ${mode==="amount"?"active":""}" id="btn-mode-amt" style="margin:0;font-size:.76rem;padding:4px 12px;font-weight:600;border-radius:4px;">By Amount (₱)</button>
            <button class="chip ${mode==="liters"?"active":""}" id="btn-mode-lit" style="margin:0;font-size:.76rem;padding:4px 12px;font-weight:600;border-radius:4px;">By Volume (L)</button>
          </div>
        </div>

        <div class="grid-2" style="gap:18px;">
          <!-- Left: Input & Presets -->
          <div>
            <label style="font-size:.74rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;display:block;">
              ${mode === "amount" ? "Enter Cash / Peso Amount" : "Enter Dispense Volume"}
            </label>
            <div style="position:relative;margin-bottom:14px;">
              <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:1.35rem;font-weight:700;color:#9CA3AF;font-family:var(--font-mono);pointer-events:none;">
                ${mode === "amount" ? "₱" : "L"}
              </span>
              <input class="input mono font-bold" id="fuel-input" type="number" step="${mode==='amount'?'1':'0.1'}" min="1" placeholder="0.00" autofocus style="font-size:1.65rem;font-weight:700;padding:12px 16px 12px 38px;border:1.5px solid #D1D5DB;border-radius:8px;background:#FFFFFF;color:#111827;width:100%;box-sizing:border-box;">
            </div>

            <!-- Quick Presets -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${mode === "amount" ? `
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="100">₱100</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="200">₱200</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="500">₱500</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="1000">₱1,000</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="1500">₱1,500</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="2000">₱2,000</button>
              ` : `
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="5">5 Liters</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="10">10 Liters</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="20">20 Liters</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="30">30 Liters</button>
                <button class="btn fuel-preset fuel-preset-pill font-bold" data-val="40">40 Liters</button>
              `}
            </div>
          </div>

          <!-- Right: Real-time Dispense Receipt & Equal-weight Tender -->
          <div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:8px;padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.72rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">Selling Rate (${fuel.name})</span>
                <strong class="mono font-bold" id="panel-locked-price" style="font-size:1rem;color:#111827;">${Utils.money(fuel.price)} / L</strong>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.72rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">Tanker Buy Cost</span>
                <span class="mono" style="font-size:.88rem;color:#6B7280;font-weight:500;">${Utils.money(fuel.cost || 65.00)} / L</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.72rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">Volume to Dispense</span>
                <strong class="mono font-bold" id="preview-liters" style="font-size:1.15rem;color:#111827;">0.00 L</strong>
              </div>
              <div style="border-top:1px solid #E5E7EB;margin:4px 0 2px;"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.75rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.04em;">Total Amount Due</span>
                <strong class="mono font-bold" id="preview-amount" style="font-size:1.45rem;color:#4F46E5;">₱0.00</strong>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.72rem;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:.04em;">Est. Transaction Profit</span>
                <strong class="mono font-bold" id="preview-profit" style="font-size:1.15rem;color:#059669;">+₱0.00</strong>
              </div>
            </div>

            <!-- Payment Tender Buttons -->
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;">
              <button class="btn btn-tender-btn font-bold" id="btn-tender-cash" data-method="Cash">
                ${Icons.get("wallet",{size:15})} Cash
              </button>
              <button class="btn btn-tender-btn font-bold" id="btn-tender-gcash" data-method="GCash">
                ${Icons.get("smartphone",{size:15})} GCash
              </button>
              <button class="btn btn-tender-btn font-bold" id="btn-tender-card" data-method="Card">
                ${Icons.get("credit-card",{size:15})} Card
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const input = panel.querySelector("#fuel-input");
    const previewLiters = panel.querySelector("#preview-liters");
    const previewAmount = panel.querySelector("#preview-amount");
    const previewProfit = panel.querySelector("#preview-profit");

    function calcDispense(){
      const val = Number(input.value) || 0;
      let lit = 0;
      let amt = 0;

      if(mode === "amount"){
        amt = val;
        lit = fuel.price > 0 ? (amt / fuel.price) : 0;
      } else {
        lit = val;
        amt = lit * fuel.price;
      }

      const fCost = fuel.cost || 65.00;
      const estProfit = Math.max(0, (fuel.price - fCost) * lit);

      previewLiters.textContent = `${lit.toFixed(2)} L`;
      previewAmount.textContent = Utils.money(amt);
      if(previewProfit) previewProfit.textContent = `+${Utils.money(estProfit)}`;
      return { lit, amt, estProfit };
    }

    input.oninput = calcDispense;

    panel.querySelectorAll(".fuel-preset").forEach(btn => {
      btn.onclick = () => {
        input.value = btn.dataset.val;
        calcDispense();
      };
    });

    panel.querySelector("#btn-mode-amt").onclick = () => setMode("amount");
    panel.querySelector("#btn-mode-lit").onclick = () => setMode("liters");

    function processDispense(paymentMethod){
      const { lit, amt } = calcDispense();
      if(amt <= 0 || lit <= 0){
        Utils.toast("Enter a valid amount or volume to dispense.", "warn");
        return;
      }

      if(fuel.tank < lit){
        Utils.toast(`Insufficient fuel in tank! Only ${fuel.tank.toFixed(1)}L remaining.`, "danger", 3500);
        return;
      }

      const sale = {
        id: Utils.uid("fsale"),
        ts: Date.now(),
        pumpId: pump.id,
        pumpLabel: pump.label,
        fuelType: pump.fuelType,
        fuelName: fuel.name,
        liters: Utils.round2(lit),
        pricePerL: fuel.price,
        costPerL: fuel.cost || 0,
        amount: Utils.round2(amt),
        method: paymentMethod,
        cashier: Auth.currentUser()?.name || "Cashier"
      };

      const allSales = DB.getFuelSales();
      allSales.unshift(sale);
      DB.setFuelSales(allSales);

      const cfgNow = DB.getFuelConfig();
      cfgNow.fuels[pump.fuelType].tank = Math.max(0, Utils.round2(cfgNow.fuels[pump.fuelType].tank - lit));
      DB.setFuelConfig(cfgNow);

      Utils.Sound.cashChime();
      Utils.toast(`Dispensed ${lit.toFixed(2)}L of ${fuel.name} (${Utils.money(amt)}) via ${paymentMethod}`, "success");

      input.value = "";
      calcDispense();
      renderTodayStrip();
      renderPumps();
      renderTelemetry();
      renderLog();
    }

    panel.querySelector("#btn-tender-cash").onclick = () => processDispense("Cash");
    panel.querySelector("#btn-tender-gcash").onclick = () => processDispense("GCash");
    panel.querySelector("#btn-tender-card").onclick = () => processDispense("Card");
  }

  // 4,000L Bulk Tanker Truck Receiving Modal
  function openBulkDeliveryModal(){
    if(!Auth.isAdmin()){ Auth.requireAdminPin(openBulkDeliveryModal); return; }
    const cfg = DB.getFuelConfig();
    const today = new Date().toISOString().split("T")[0];

    const gasAvailable = Math.max(0, (cfg.fuels.gasoline.capacity||10000) - cfg.fuels.gasoline.tank);
    const dieselAvailable = Math.max(0, (cfg.fuels.diesel.capacity||10000) - cfg.fuels.diesel.tank);
    const premAvailable = Math.max(0, ((cfg.fuels.premium?.capacity)||10000) - (cfg.fuels.premium?.tank||0));
    const totalStationSpace = gasAvailable + dieselAvailable + premAvailable;

    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card card-tight" style="padding:12px 16px;background:var(--brand-tint);border:1.5px solid var(--brand);border-radius:12px;margin:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${Icons.get("truck",{size:18})}
              <strong style="font-size:.95rem;color:var(--brand-deep);">4,000 Liters Bulk Tanker Offload (ECC 30k L Station)</strong>
            </div>
            <span class="badge badge-brand font-bold" style="font-size:.82rem;">Station Space: ${totalStationSpace.toLocaleString()} L Available</span>
          </div>
          <p class="text-xs text-faint" style="margin-top:4px;color:var(--ink-soft);">
            Track offloading into your 10,000L ECC tanks and compute weighted average buying cost per liter.
          </p>
        </div>

        <div class="input-row">
          <div class="field" style="margin-bottom:0;">
            <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);">Delivery Date (PHT)</label>
            <input class="input font-bold" id="deliv-date" type="date" value="${today}">
          </div>
          <div class="field" style="margin-bottom:0;">
            <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);">Supplier Buying Rate (₱ / Liter)</label>
            <input class="input mono font-bold" id="deliv-supplier-price" type="number" step="0.10" value="65.00" style="font-size:1.15rem;">
          </div>
        </div>

        <!-- Live SRP Recommendation Banner -->
        <div class="card card-tight" style="padding:10px 14px;background:var(--paper-dim);border:1.5px solid var(--line-strong);border-radius:10px;margin:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:6px;">
            <strong style="font-size:.84rem;color:var(--brand-deep);display:flex;align-items:center;gap:4px;">
              ${Icons.get("tag",{size:13})} Suggested Selling Price (SRP Calculator)
            </strong>
            <span class="badge badge-amber font-bold mono" id="deliv-srp-badge" style="font-size:.76rem;">Suggested SRP: ₱71.50/L (+₱6.50 margin)</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:.76rem;color:var(--ink-soft);flex-wrap:wrap;gap:8px;">
            <span>Est. Profit on 4,000L Tanker: <strong class="mono" id="deliv-tanker-profit" style="color:var(--success-deep);font-size:.86rem;">₱26,000.00</strong></span>
            <span>Est. Profit on 10,000L ECC Tank: <strong class="mono" id="deliv-tank-profit" style="color:#059669;font-size:.86rem;">₱65,000.00</strong></span>
          </div>
        </div>

        <div class="grid-3" style="gap:8px;">
          <!-- Gasoline Intake -->
          <div class="card card-tight" style="padding:10px 12px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:.82rem;font-weight:600;color:#111827;">
                <span style="width:6px;height:6px;border-radius:50%;background:#10B981;"></span>Gasoline
              </span>
              <span class="text-xs" style="color:#6B7280;">${gasAvailable.toLocaleString()}L left</span>
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.72rem;color:#6B7280;">Offload Liters</label>
              <input class="input mono font-bold" id="deliv-gas-liters" type="number" min="0" max="${gasAvailable}" step="10" placeholder="0" value="2000" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>
          </div>

          <!-- Diesel Intake -->
          <div class="card card-tight" style="padding:10px 12px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:.82rem;font-weight:600;color:#111827;">
                <span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;"></span>Diesel
              </span>
              <span class="text-xs" style="color:#6B7280;">${dieselAvailable.toLocaleString()}L left</span>
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.72rem;color:#6B7280;">Offload Liters</label>
              <input class="input mono font-bold" id="deliv-diesel-liters" type="number" min="0" max="${dieselAvailable}" step="10" placeholder="0" value="2000" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>
          </div>

          <!-- Premium Intake -->
          <div class="card card-tight" style="padding:10px 12px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:.82rem;font-weight:600;color:#111827;">
                <span style="width:6px;height:6px;border-radius:50%;background:#EF4444;"></span>Premium
              </span>
              <span class="text-xs" style="color:#6B7280;">${premAvailable.toLocaleString()}L left</span>
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.72rem;color:#6B7280;">Offload Liters</label>
              <input class="input mono font-bold" id="deliv-prem-liters" type="number" min="0" max="${premAvailable}" step="10" placeholder="0" value="0" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>
          </div>
        </div>

        <div class="card card-tight" style="padding:12px 16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
          <div class="input-row" style="margin-bottom:6px;">
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.78rem;color:#6B7280;">Supplier / Hauler Name</label>
              <input class="input font-bold" id="deliv-supplier-name" placeholder="e.g. Petron Bulk / Shell Tankers" value="Bulk Fuel Distributor" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.78rem;color:#6B7280;">Invoice / Delivery Receipt Ref #</label>
              <input class="input mono" id="deliv-ref" placeholder="e.g. DR-89218" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;padding-top:8px;margin-top:6px;">
            <span style="font-weight:600;font-size:.85rem;color:#6B7280;">Total Tanker Purchase Expense:</span>
            <strong class="mono font-bold" id="deliv-total-expense" style="font-size:1.25rem;color:#111827;">₱0.00</strong>
          </div>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("truck",{size:18})} Log 4,000L Bulk Tanker Intake`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: "Confirm Fuel Intake", cls: "btn-primary", onClick: () => {
          const supplierPrice = Number(modal.querySelector("#deliv-supplier-price").value) || 65.00;
          const gasLiters = Number(modal.querySelector("#deliv-gas-liters").value) || 0;
          const dieselLiters = Number(modal.querySelector("#deliv-diesel-liters").value) || 0;
          const premLiters = Number(modal.querySelector("#deliv-prem-liters").value) || 0;
          const totalLiters = gasLiters + dieselLiters + premLiters;

          if(totalLiters <= 0){
            Utils.toast("Please enter liters to offload into tanks.", "warn");
            return;
          }

          if(totalLiters > 4000){
            Utils.toast(`Warning: Total offloaded (${totalLiters}L) exceeds 4,000L truck capacity!`, "warn", 3500);
          }

          const cfgNow = DB.getFuelConfig();

          function updateFuelTank(type, addedLiters){
            if(addedLiters <= 0) return;
            const f = cfgNow.fuels[type];
            const oldTank = f.tank || 0;
            const oldCost = f.cost || supplierPrice;
            const newTank = Math.min(f.capacity || 10000, oldTank + addedLiters);
            const weightedCost = newTank > 0 ? ((oldTank * oldCost) + (addedLiters * supplierPrice)) / newTank : supplierPrice;

            f.tank = Utils.round2(newTank);
            f.cost = Utils.round2(weightedCost);

            DB.addFuelDelivery({
              date: modal.querySelector("#deliv-date").value,
              truckCapacity: 4000,
              supplierPricePerL: supplierPrice,
              fuelType: type,
              litersOffloaded: addedLiters,
              totalCost: addedLiters * supplierPrice,
              supplierName: modal.querySelector("#deliv-supplier-name").value,
              invoiceRef: modal.querySelector("#deliv-ref").value
            });
          }

          updateFuelTank("gasoline", gasLiters);
          updateFuelTank("diesel", dieselLiters);
          updateFuelTank("premium", premLiters);

          DB.setFuelConfig(cfgNow);
          Utils.Sound.cashChime();
          Utils.toast(`Successfully offloaded ${totalLiters.toLocaleString()}L into ECC tanks!`, "success");
          Modal.close();
          render();
        }}
      ]
    });

    function recalcExpense(){
      const sp = Number(modal.querySelector("#deliv-supplier-price")?.value) || 0;
      const gL = Number(modal.querySelector("#deliv-gas-liters")?.value) || 0;
      const dL = Number(modal.querySelector("#deliv-diesel-liters")?.value) || 0;
      const pL = Number(modal.querySelector("#deliv-prem-liters")?.value) || 0;
      const tot = (gL + dL + pL) * sp;
      const expEl = modal.querySelector("#deliv-total-expense");
      if(expEl) expEl.textContent = Utils.money(tot);

      const srpBadge = modal.querySelector("#deliv-srp-badge");
      const tankerProfit = modal.querySelector("#deliv-tanker-profit");
      const tankProfit = modal.querySelector("#deliv-tank-profit");

      const srpVal = sp + 6.50;
      if(srpBadge) srpBadge.textContent = `Suggested SRP: ₱${srpVal.toFixed(2)}/L (+₱6.50 margin)`;
      if(tankerProfit) tankerProfit.textContent = Utils.money(6.50 * 4000);
      if(tankProfit) tankProfit.textContent = Utils.money(6.50 * 10000);
    }

    modal.querySelector("#deliv-supplier-price")?.addEventListener("input", recalcExpense);
    modal.querySelector("#deliv-gas-liters")?.addEventListener("input", recalcExpense);
    modal.querySelector("#deliv-diesel-liters")?.addEventListener("input", recalcExpense);
    modal.querySelector("#deliv-prem-liters")?.addEventListener("input", recalcExpense);
    recalcExpense();
  }

  // Daily Volatile Price Manager for Gasoline, Diesel & Premium
  function openDailyPriceManager(){
    if(!Auth.isAdmin()){ Auth.requireAdminPin(openDailyPriceManager); return; }
    const cfg = DB.getFuelConfig();
    const today = new Date().toISOString().split("T")[0];

    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card card-tight" style="padding:12px 16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="color:#4F46E5;">${Icons.get("tag",{size:16})}</span>
            <strong style="font-size:.95rem;color:#111827;">Daily Volatile Fuel Pricing & SRP Profit Calculator</strong>
          </div>
          <p class="text-xs" style="margin:0;color:#6B7280;">
            Update daily retail selling rates based on current tanker buy costs. Click any SRP quick preset or enter custom prices.
          </p>
        </div>

        <div class="grid-3" style="gap:10px;">
          <!-- Gasoline Pricing Card -->
          <div class="card card-tight" style="padding:12px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:.88rem;font-weight:600;color:#111827;">
                <span style="width:6px;height:6px;border-radius:50%;background:#10B981;"></span>Gasoline
              </span>
              <span class="badge badge-neutral mono" style="font-size:.70rem;background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;">Cost: ${Utils.money(cfg.fuels.gasoline.cost || 65.00)}</span>
            </div>
            
            <div class="field" style="margin-bottom:6px;">
              <label style="font-size:.76rem;font-weight:600;color:#6B7280;">Selling Price (₱/L)</label>
              <input class="input mono font-bold" id="dprice-gas" type="number" step="0.05" value="${cfg.fuels.gasoline.price}" style="font-size:1.20rem;background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>

            <!-- Quick SRP Margin Presets -->
            <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="gas" data-margin="4.50" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:4px;">+₱4.50</button>
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="gas" data-margin="6.50" style="font-weight:600;color:#4F46E5;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:4px;">+₱6.50 (Rec)</button>
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="gas" data-margin="8.00" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:4px;">+₱8.00</button>
            </div>

            <div class="field" style="margin-bottom:6px;">
              <label style="font-size:.76rem;font-weight:600;color:#6B7280;">Target Margin (₱/L)</label>
              <input class="input mono" id="dmargin-gas" type="number" step="0.10" value="${((cfg.fuels.gasoline.price) - (cfg.fuels.gasoline.cost || 65.00)).toFixed(2)}" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>

            <div style="font-size:.72rem;color:#6B7280;background:#FFFFFF;padding:6px 8px;border-radius:6px;border:1px solid #E5E7EB;">
              Profit on 4k L Tanker: <strong class="mono" id="dprofit-gas" style="color:#059669;">₱0.00</strong>
            </div>
          </div>

          <!-- Diesel Pricing Card -->
          <div class="card card-tight" style="padding:12px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:.88rem;font-weight:600;color:#111827;">
                <span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;"></span>Diesel
              </span>
              <span class="badge badge-neutral mono" style="font-size:.70rem;background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;">Cost: ${Utils.money(cfg.fuels.diesel.cost || 65.00)}</span>
            </div>

            <div class="field" style="margin-bottom:6px;">
              <label style="font-size:.76rem;font-weight:600;color:#6B7280;">Selling Price (₱/L)</label>
              <input class="input mono font-bold" id="dprice-diesel" type="number" step="0.05" value="${cfg.fuels.diesel.price}" style="font-size:1.20rem;background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>

            <!-- Quick SRP Margin Presets -->
            <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="diesel" data-margin="4.50" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:4px;">+₱4.50</button>
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="diesel" data-margin="6.50" style="font-weight:600;color:#4F46E5;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:4px;">+₱6.50 (Rec)</button>
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="diesel" data-margin="8.00" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:4px;">+₱8.00</button>
            </div>

            <div class="field" style="margin-bottom:6px;">
              <label style="font-size:.76rem;font-weight:600;color:#6B7280;">Target Margin (₱/L)</label>
              <input class="input mono" id="dmargin-diesel" type="number" step="0.10" value="${((cfg.fuels.diesel.price) - (cfg.fuels.diesel.cost || 65.00)).toFixed(2)}" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>

            <div style="font-size:.72rem;color:#6B7280;background:#FFFFFF;padding:6px 8px;border-radius:6px;border:1px solid #E5E7EB;">
              Profit on 4k L Tanker: <strong class="mono" id="dprofit-diesel" style="color:#059669;">₱0.00</strong>
            </div>
          </div>

          <!-- Premium Pricing Card -->
          <div class="card card-tight" style="padding:12px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:.88rem;font-weight:600;color:#111827;">
                <span style="width:6px;height:6px;border-radius:50%;background:#EF4444;"></span>Premium
              </span>
              <span class="badge badge-neutral mono" style="font-size:.70rem;background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;">Cost: ${Utils.money(cfg.fuels.premium?.cost || 65.00)}</span>
            </div>

            <div class="field" style="margin-bottom:6px;">
              <label style="font-size:.76rem;font-weight:600;color:#6B7280;">Selling Price (₱/L)</label>
              <input class="input mono font-bold" id="dprice-prem" type="number" step="0.05" value="${cfg.fuels.premium?.price || 76.50}" style="font-size:1.20rem;background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>

            <!-- Quick SRP Margin Presets -->
            <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="prem" data-margin="5.50" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:4px;">+₱5.50</button>
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="prem" data-margin="7.50" style="font-weight:600;color:#4F46E5;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:4px;">+₱7.50 (Rec)</button>
              <button class="btn btn-xs btn-outline btn-srp-preset" data-target="prem" data-margin="9.00" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:4px;">+₱9.00</button>
            </div>

            <div class="field" style="margin-bottom:6px;">
              <label style="font-size:.76rem;font-weight:600;color:#6B7280;">Target Margin (₱/L)</label>
              <input class="input mono" id="dmargin-prem" type="number" step="0.10" value="${(((cfg.fuels.premium?.price)||76.50) - ((cfg.fuels.premium?.cost)||65.00)).toFixed(2)}" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:6px;">
            </div>

            <div style="font-size:.72rem;color:#6B7280;background:#FFFFFF;padding:6px 8px;border-radius:6px;border:1px solid #E5E7EB;">
              Profit on 4k L Tanker: <strong class="mono" id="dprofit-prem" style="color:#059669;">₱0.00</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("tag",{size:18})} Set Daily Fuel Selling Prices (SRP Manager)`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        { label: "Lock In Today's Prices", cls: "btn-primary font-bold", onClick: () => {
          const cfgNow = DB.getFuelConfig();
          const newGasPrice = Number(modal.querySelector("#dprice-gas").value) || cfgNow.fuels.gasoline.price;
          const newDieselPrice = Number(modal.querySelector("#dprice-diesel").value) || cfgNow.fuels.diesel.price;
          const newPremPrice = Number(modal.querySelector("#dprice-prem").value) || (cfgNow.fuels.premium?.price || 76.50);

          function updatePrice(type, newP){
            const f = cfgNow.fuels[type];
            if(!f) return;
            if(newP !== f.price){
              f.priceLog = f.priceLog || [];
              f.priceLog.unshift({ ts: Date.now(), date: today, price: newP, prev: f.price, by: Auth.currentUser()?.name });
              f.price = newP;
            }
          }

          updatePrice("gasoline", newGasPrice);
          updatePrice("diesel", newDieselPrice);
          updatePrice("premium", newPremPrice);

          DB.setFuelConfig(cfgNow);
          Utils.toast("Daily fuel prices updated successfully.", "success");
          Modal.close();
          render();
        }}
      ]
    });

    const gasInp = modal.querySelector("#dprice-gas");
    const gasMargin = modal.querySelector("#dmargin-gas");
    const gasCost = cfg.fuels.gasoline.cost || 65.00;

    const dieselInp = modal.querySelector("#dprice-diesel");
    const dieselMargin = modal.querySelector("#dmargin-diesel");
    const dieselCost = cfg.fuels.diesel.cost || 65.00;

    const premInp = modal.querySelector("#dprice-prem");
    const premMargin = modal.querySelector("#dmargin-prem");
    const premCost = cfg.fuels.premium?.cost || 65.00;

    function updateGuidance(){
      const gp = Number(gasInp?.value) || 0;
      const dp = Number(dieselInp?.value) || 0;
      const pp = Number(premInp?.value) || 0;

      const pGas = modal.querySelector("#dprofit-gas");
      if(pGas) pGas.textContent = Utils.money((gp - gasCost) * 4000);

      const pDiesel = modal.querySelector("#dprofit-diesel");
      if(pDiesel) pDiesel.textContent = Utils.money((dp - dieselCost) * 4000);

      const pPrem = modal.querySelector("#dprofit-prem");
      if(pPrem) pPrem.textContent = Utils.money((pp - premCost) * 4000);
    }

    gasInp?.addEventListener("input", updateGuidance);
    dieselInp?.addEventListener("input", updateGuidance);
    premInp?.addEventListener("input", updateGuidance);

    gasMargin?.addEventListener("input", () => {
      gasInp.value = (gasCost + (Number(gasMargin.value)||0)).toFixed(2);
      updateGuidance();
    });

    dieselMargin?.addEventListener("input", () => {
      dieselInp.value = (dieselCost + (Number(dieselMargin.value)||0)).toFixed(2);
      updateGuidance();
    });

    premMargin?.addEventListener("input", () => {
      premInp.value = (premCost + (Number(premMargin.value)||0)).toFixed(2);
      updateGuidance();
    });

    modal.querySelectorAll(".btn-srp-preset").forEach(btn => {
      btn.onclick = () => {
        const target = btn.dataset.target;
        const m = Number(btn.dataset.margin) || 0;
        if(target === "gas"){
          gasMargin.value = m.toFixed(2);
          gasInp.value = (gasCost + m).toFixed(2);
        } else if(target === "diesel"){
          dieselMargin.value = m.toFixed(2);
          dieselInp.value = (dieselCost + m).toFixed(2);
        } else if(target === "prem"){
          premMargin.value = m.toFixed(2);
          premInp.value = (premCost + m).toFixed(2);
        }
        updateGuidance();
      };
    });

    updateGuidance();
  }

  // (2026-07-13) SaaS redesign for telemetry charts and page layout; was colorful
  function renderTelemetry(){
    const wrap = document.getElementById("fuel-telemetry-wrap");
    if(!wrap) return;
    const cfg = DB.getFuelConfig();

    wrap.innerHTML = `
      <div class="grid-2" style="gap:16px;margin-bottom:16px;">
        <!-- Left: Donut Chart with Gray Empty Space -->
        <div class="card" style="padding:20px 24px;border-radius:10px;border:1px solid #E5E7EB;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size:.75rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px;display:flex;align-items:center;gap:6px;">
            <span style="color:#9CA3AF;">${Icons.get("droplet",{size:14})}</span> Station Underground Tanks (3x 10,000L ECC)
          </div>
          ${renderDonutChartSvg(cfg)}
        </div>

        <!-- Right: Volume & Revenue Trends for Selected Period -->
        <div class="card" style="padding:20px 24px;border-radius:10px;border:1px solid #E5E7EB;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size:.75rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:#9CA3AF;">${Icons.get("bar-chart",{size:14})}</span> Dispense Volume Trend
            </div>
            <div style="display:flex;align-items:center;gap:12px;font-size:.72rem;font-weight:500;text-transform:none;">
              <span style="display:flex;align-items:center;gap:5px;color:#4B5563;"><i style="width:6px;height:6px;background:#10B981;border-radius:50%;display:inline-block;"></i> Gas</span>
              <span style="display:flex;align-items:center;gap:5px;color:#4B5563;"><i style="width:6px;height:6px;background:#F59E0B;border-radius:50%;display:inline-block;"></i> Diesel</span>
              <span style="display:flex;align-items:center;gap:5px;color:#4B5563;"><i style="width:6px;height:6px;background:#EF4444;border-radius:50%;display:inline-block;"></i> Premium</span>
            </div>
          </div>
          ${renderWeeklyTrends(cfg)}
        </div>
      </div>
    `;
  }

  // (2026-07-13) Added edit/delete fuel sales & tank recalculation; was view-only
  function openEditFuelTransactionModal(sale){
    const cfg = DB.getFuelConfig();
    const fuel = cfg.fuels[sale.fuelType] || cfg.fuels.gasoline;

    const body = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="card card-tight" style="padding:14px 16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge font-bold" style="background:#4F46E5;color:#FFFFFF;font-size:.78rem;padding:3px 8px;border-radius:6px;">${Utils.escapeHtml(sale.pumpLabel || "Pump")}</span>
              <strong style="font-size:.95rem;color:#111827;">${Utils.escapeHtml(sale.fuelName || fuel.name)}</strong>
            </div>
            <span class="mono text-xs text-faint">${Utils.fmtDate(sale.ts)}</span>
          </div>
        </div>

        <div class="input-row" style="gap:12px;">
          <div class="field" style="margin-bottom:0;flex:1;">
            <label style="font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px;display:block;">Volume Dispensed (Liters) <span style="color:#EF4444;">*</span></label>
            <input class="input mono font-bold" id="edit-fsale-liters" type="number" step="0.01" min="0.01" value="${sale.liters.toFixed(2)}" style="border:1px solid #D1D5DB;border-radius:7px;font-size:1.05rem;padding:8px 12px;">
          </div>
          <div class="field" style="margin-bottom:0;flex:1;">
            <label style="font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px;display:block;">Locked Rate (₱/L) <span style="color:#EF4444;">*</span></label>
            <input class="input mono font-bold" id="edit-fsale-price" type="number" step="0.05" min="0.01" value="${sale.pricePerL.toFixed(2)}" style="border:1px solid #D1D5DB;border-radius:7px;font-size:1.05rem;padding:8px 12px;">
          </div>
        </div>

        <div class="input-row" style="gap:12px;">
          <div class="field" style="margin-bottom:0;flex:1;">
            <label style="font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px;display:block;">Total Amount Due (₱) <span style="color:#EF4444;">*</span></label>
            <input class="input mono font-bold" id="edit-fsale-amount" type="number" step="0.01" min="0.01" value="${sale.amount.toFixed(2)}" style="border:1px solid #D1D5DB;border-radius:7px;font-size:1.15rem;color:#4F46E5;padding:8px 12px;">
          </div>
          <div class="field" style="margin-bottom:0;flex:1;">
            <label style="font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px;display:block;">Payment Method <span style="color:#EF4444;">*</span></label>
            <div id="edit-fsale-method-wrap"></div>
          </div>
        </div>

        <div class="field" style="margin-bottom:0;">
          <label style="font-size:.78rem;font-weight:600;color:#374151;margin-bottom:5px;display:block;">Cashier / Attendant Name</label>
          <input class="input font-bold" id="edit-fsale-cashier" value="${Utils.escapeHtml(sale.cashier || "Cashier")}" style="border:1px solid #D1D5DB;border-radius:7px;font-size:.92rem;padding:8px 12px;">
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("edit",{size:18})} Edit Fuel Transaction`,
      body,
      wide: false,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { label: "Save Changes", cls: "btn-primary btn-lg", onClick: () => {
          const newLiters = Number(modal.querySelector("#edit-fsale-liters")?.value) || 0;
          const newPrice = Number(modal.querySelector("#edit-fsale-price")?.value) || 0;
          const newAmt = Number(modal.querySelector("#edit-fsale-amount")?.value) || 0;
          const newMethod = UISelect.getValue("edit-fsale-method") || sale.method || "Cash";
          const newCashier = (modal.querySelector("#edit-fsale-cashier")?.value || "").trim() || "Cashier";

          if(newLiters <= 0 || newAmt <= 0){
            Utils.toast("Please enter valid volume and amount.", "warn");
            return;
          }

          const literDiff = newLiters - sale.liters;
          const cfgNow = DB.getFuelConfig();
          if(cfgNow.fuels[sale.fuelType]){
            cfgNow.fuels[sale.fuelType].tank = Math.max(0, Utils.round2(cfgNow.fuels[sale.fuelType].tank - literDiff));
            DB.setFuelConfig(cfgNow);
          }

          const allSales = DB.getFuelSales();
          const target = allSales.find(s => s.id === sale.id);
          if(target){
            target.liters = Utils.round2(newLiters);
            target.pricePerL = Utils.round2(newPrice);
            target.amount = Utils.round2(newAmt);
            target.method = newMethod;
            target.cashier = newCashier;
            DB.setFuelSales(allSales);
          }

          Modal.close();
          Utils.toast("Fuel transaction updated successfully.", "success");
          renderTodayStrip();
          renderPumps();
          renderTelemetry();
          renderLog();
        }}
      ]
    });

    modal.querySelector("#edit-fsale-method-wrap").innerHTML = UISelect.render("edit-fsale-method", ["Cash","GCash","Card","Bank Transfer"], sale.method || "Cash");
    UISelect.bind("edit-fsale-method");

    const litInput = modal.querySelector("#edit-fsale-liters");
    const prInput = modal.querySelector("#edit-fsale-price");
    const amtInput = modal.querySelector("#edit-fsale-amount");

    litInput.oninput = () => {
      const l = Number(litInput.value) || 0;
      const p = Number(prInput.value) || 0;
      amtInput.value = (l * p).toFixed(2);
    };
    prInput.oninput = () => {
      const l = Number(litInput.value) || 0;
      const p = Number(prInput.value) || 0;
      amtInput.value = (l * p).toFixed(2);
    };
  }

  function deleteFuelTransactionConfirm(sale){
    Modal.confirm({
      title: "Delete Fuel Transaction?",
      message: `Permanently delete ${sale.liters.toFixed(2)}L of ${sale.fuelName} (${Utils.money(sale.amount)})? The ${sale.liters.toFixed(2)}L will be returned to the ${sale.fuelName} tank.`,
      danger: true,
      onConfirm: () => {
        const cfgNow = DB.getFuelConfig();
        if(cfgNow.fuels[sale.fuelType]){
          cfgNow.fuels[sale.fuelType].tank = Math.min(cfgNow.fuels[sale.fuelType].capacity || 10000, Utils.round2(cfgNow.fuels[sale.fuelType].tank + sale.liters));
          DB.setFuelConfig(cfgNow);
        }

        const allSales = DB.getFuelSales().filter(s => s.id !== sale.id);
        DB.setFuelSales(allSales);

        Utils.toast("Fuel transaction deleted and volume returned to tank.", "success");
        renderTodayStrip();
        renderPumps();
        renderTelemetry();
        renderLog();
      }
    });
  }

  function renderLog(){
    const wrap = document.getElementById("fuel-log");
    if(!wrap) return;
    const sales = filteredFuelSales().slice(0, 50);
    const r = getRange(periodFilter);

    // (2026-07-13) Neutral pump badges & sticky header; was colored badges
    wrap.innerHTML = sales.length ? `
      <div class="table-wrap" style="border:1px solid #E5E7EB;border-radius:8px;overflow-y:auto;max-height:460px;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <table class="data fuel-log-table" style="font-size:.92rem;width:100%;border-collapse:collapse;">
          <thead>
            <tr style="font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;background:#F9FAFB;color:#6B7280;border-bottom:1px solid #E5E7EB;">
              <th style="padding:12px 14px;font-weight:600;text-align:left;position:sticky;top:0;background:#F9FAFB;z-index:2;">Time</th>
              <th style="padding:12px 14px;font-weight:600;text-align:left;position:sticky;top:0;background:#F9FAFB;z-index:2;">Pump</th>
              <th style="padding:12px 14px;font-weight:600;text-align:left;position:sticky;top:0;background:#F9FAFB;z-index:2;">Fuel Type</th>
              <th style="padding:12px 14px;font-weight:600;text-align:right;position:sticky;top:0;background:#F9FAFB;z-index:2;">Volume (L)</th>
              <th style="padding:12px 14px;font-weight:600;text-align:right;position:sticky;top:0;background:#F9FAFB;z-index:2;">Locked Rate</th>
              <th style="padding:12px 14px;font-weight:600;text-align:right;position:sticky;top:0;background:#F9FAFB;z-index:2;">Amount (₱)</th>
              <th style="padding:12px 14px;font-weight:600;text-align:center;position:sticky;top:0;background:#F9FAFB;z-index:2;">Tender</th>
              <th style="padding:12px 14px;font-weight:600;text-align:left;position:sticky;top:0;background:#F9FAFB;z-index:2;">Attendant</th>
              <th style="padding:12px 14px;font-weight:600;text-align:right;position:sticky;top:0;background:#F9FAFB;z-index:2;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${sales.map((s, idx) => {
              const col = s.fuelType === "diesel" ? "#F59E0B" : s.fuelType === "premium" ? "#EF4444" : "#10B981";
              return `
              <tr style="border-bottom:1px solid #F3F4F6;background:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'};">
                <td class="mono" style="padding:11px 14px;font-size:.86rem;color:#374151;">${Utils.fmtDate(s.ts)}</td>
                <td style="padding:11px 14px;">
                  <span class="badge" style="background:#F3F4F6;color:#4B5563;border:1px solid #E5E7EB;font-size:.74rem;padding:2px 8px;border-radius:6px;font-weight:600;">
                    ${Utils.escapeHtml(s.pumpLabel)}
                  </span>
                </td>
                <td style="padding:11px 14px;">
                  <span style="display:inline-flex;align-items:center;gap:6px;font-size:.88rem;font-weight:600;color:#111827;">
                    <span style="width:6px;height:6px;border-radius:50%;background:${col};display:inline-block;"></span>
                    ${Utils.escapeHtml(s.fuelName)}
                  </span>
                </td>
                <td class="mono font-bold" style="padding:11px 14px;text-align:right;font-size:.92rem;color:#111827;">${s.liters.toFixed(2)} L</td>
                <td class="mono" style="padding:11px 14px;text-align:right;font-size:.88rem;color:#6B7280;">${Utils.money(s.pricePerL)}</td>
                <td class="mono font-bold" style="padding:11px 14px;text-align:right;font-size:.98rem;color:#111827;">${Utils.money(s.amount)}</td>
                <td style="padding:11px 14px;text-align:center;">
                  <span class="badge" style="font-size:.74rem;background:#F3F4F6;color:#4B5563;border:1px solid #E5E7EB;border-radius:6px;padding:2px 8px;font-weight:500;">
                    ${s.method}
                  </span>
                </td>
                <td style="padding:11px 14px;font-size:.84rem;color:#6B7280;">${Utils.escapeHtml(s.cashier || "Cashier")}</td>
                <td style="padding:11px 14px;text-align:right;white-space:nowrap;">
                  <button class="btn btn-xs btn-ghost btn-edit-fuel-tx" data-id="${s.id}" title="Edit" style="padding:4px 6px;color:#4B5563;border-radius:6px;cursor:pointer;">
                    ${Icons.get("edit",{size:14})}
                  </button>
                  <button class="btn btn-xs btn-ghost btn-del-fuel-tx" data-id="${s.id}" title="Delete" style="padding:4px 6px;color:#DC2626;border-radius:6px;cursor:pointer;">
                    ${Icons.get("trash",{size:14})}
                  </button>
                </td>
              </tr>
            `;}).join("")}
          </tbody>
        </table>
      </div>
    ` : `<div class="empty" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;padding:32px;text-align:center;"><span style="color:#9CA3AF;">${Icons.get("fuel",{size:32})}</span><h3 style="font-size:1rem;color:#111827;margin:8px 0 4px;">No fuel sales recorded for ${r.label.toLowerCase()}</h3><p style="color:#6B7280;font-size:.85rem;margin:0;">Select another time filter or choose a pump to dispense fuel.</p></div>`;

    wrap.querySelectorAll(".btn-edit-fuel-tx").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const all = DB.getFuelSales();
        const s = all.find(x => x.id === id);
        if(s) openEditFuelTransactionModal(s);
      };
    });

    wrap.querySelectorAll(".btn-del-fuel-tx").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const all = DB.getFuelSales();
        const s = all.find(x => x.id === id);
        if(s) deleteFuelTransactionConfirm(s);
      };
    });
  }

  function exportFuelSalesCSV(){
    const list = filteredFuelSales();
    if(!list.length){ Utils.toast("No fuel sales to export for this period.", "warn"); return; }
    const rows = [
      ["Date Time", "Pump", "Fuel Type", "Liters", "Price Per Liter", "Total Amount", "Payment Method", "Cashier"],
      ...list.map(s => [
        `"${Utils.fmtDate(s.ts)}"`,
        `"${s.pumpLabel || ""}"`,
        `"${s.fuelName || ""}"`,
        (s.liters || 0).toFixed(2),
        (s.pricePerL || 0).toFixed(2),
        (s.amount || 0).toFixed(2),
        s.method || "Cash",
        `"${s.cashier || ""}"`
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Route98_Fuel_Sales_${periodFilter}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    Utils.toast("Fuel sales exported to CSV.", "success");
  }

  function render(){
    const view = document.getElementById("view-root");
    view.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <div class="view-head" style="margin-bottom:12px;flex-shrink:0;">
          <div>
            <h2 style="font-size:1.35rem;font-weight:700;color:#111827;display:flex;align-items:center;gap:8px;margin:0 0 2px;">
              <span style="color:#9CA3AF;">${Icons.get("fuel",{size:20})}</span> Gasoline Station Management
            </h2>
            <div class="view-sub" style="font-size:.80rem;color:#6B7280;font-weight:400;">3 Pumps · 3x 10,000L ECC Tanks (30k L) · 4,000L Bulk Tanker Intake</div>
          </div>
          <div class="input-row" style="width:auto;gap:8px;">
            <button class="btn btn-outline" id="btn-export-fuel" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:7px;font-weight:500;">
              ${Icons.get("download",{size:14})} Export Sales
            </button>
            <button class="btn btn-outline" id="btn-bulk-delivery" style="background:#FFFFFF;border:1px solid #E5E7EB;color:#374151;border-radius:7px;font-weight:500;">
              ${Icons.get("truck",{size:14})} 4,000L Tanker Intake
            </button>
            <button class="btn btn-primary" id="btn-daily-price" style="background:#4F46E5;color:#FFFFFF;border:none;border-radius:7px;font-weight:500;">
              ${Icons.get("tag",{size:14})} Set Daily Prices
            </button>
          </div>
        </div>

        <div style="flex:1;min-height:0;overflow-y:auto;padding-right:6px;padding-bottom:80px;">
          <!-- Performance Period Filter Navigation -->
          <div class="card card-tight" style="padding:8px 16px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex;align-items:center;gap:6px;font-size:.75rem;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">
              <span style="color:#9CA3AF;">${Icons.get("calendar",{size:14})}</span> Performance Period
            </div>
            <div style="display:flex;align-items:center;gap:4px;background:#F3F4F6;padding:3px;border-radius:7px;border:1px solid #E5E7EB;" id="fuel-period-chips">
              <button class="chip ${periodFilter==='today'?'active':''}" data-period="today" style="margin:0;font-size:.76rem;padding:4px 10px;font-weight:500;border-radius:7px;">Today</button>
              <button class="chip ${periodFilter==='this_week'?'active':''}" data-period="this_week" style="margin:0;font-size:.76rem;padding:4px 10px;font-weight:500;border-radius:7px;">This Week</button>
              <button class="chip ${periodFilter==='last_week'?'active':''}" data-period="last_week" style="margin:0;font-size:.76rem;padding:4px 10px;font-weight:500;border-radius:7px;">Last Week</button>
              <button class="chip ${periodFilter==='this_month'?'active':''}" data-period="this_month" style="margin:0;font-size:.76rem;padding:4px 10px;font-weight:500;border-radius:7px;">This Month</button>
              <button class="chip ${periodFilter==='last_month'?'active':''}" data-period="last_month" style="margin:0;font-size:.76rem;padding:4px 10px;font-weight:500;border-radius:7px;">Last Month</button>
              <button class="chip ${periodFilter==='all'?'active':''}" data-period="all" style="margin:0;font-size:.76rem;padding:4px 10px;font-weight:500;border-radius:7px;">All Time</button>
            </div>
          </div>

          <!-- Key Metrics Banner (Revenue, Profit, Expenses, Volume) -->
          <div id="today-fuel-strip" style="margin-bottom:16px;"></div>

          <!-- Station Telemetry (Donut & Weekly Trend) -->
          <div id="fuel-telemetry-wrap" style="margin-bottom:20px;"></div>

          <!-- Station Dispenser Terminals -->
          <div style="font-size:.74rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
            <span style="color:#9CA3AF;">${Icons.get("fuel",{size:14})}</span> Station Dispenser Terminals (Tap to select pump)
          </div>
          <div class="grid-3" id="pump-grid" style="gap:16px;margin-bottom:20px;"></div>

          <!-- Dispense Panel -->
          <div id="fuel-sale-panel" style="margin-bottom:24px;"></div>

          <!-- Recent Fuel Sales Ledger (Receded Header Treatment) -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 10px;padding-top:14px;border-top:1px solid #E5E7EB;">
            <div style="font-size:.74rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;display:flex;align-items:center;gap:6px;">
              <span style="color:#9CA3AF;">${Icons.get("receipt",{size:14})}</span> Recent Fuel Transactions
            </div>
            <span style="font-size:.74rem;color:#9CA3AF;font-weight:500;">Up to 50 recent records</span>
          </div>
          <div id="fuel-log" style="margin-bottom:28px;"></div>
          <div style="height:40px;"></div>
        </div>
      </div>
    `;

    document.getElementById("btn-bulk-delivery").onclick = openBulkDeliveryModal;
    document.getElementById("btn-daily-price").onclick = openDailyPriceManager;
    document.getElementById("btn-export-fuel").onclick = exportFuelSalesCSV;

    document.querySelectorAll("#fuel-period-chips .chip").forEach(btn => {
      btn.onclick = () => {
        periodFilter = btn.dataset.period;
        document.querySelectorAll("#fuel-period-chips .chip").forEach(c => c.classList.toggle("active", c.dataset.period === periodFilter));
        renderTodayStrip();
        renderTelemetry();
        renderPumps();
        renderSalePanel();
        renderLog();
      };
    });

    renderTodayStrip();
    renderTelemetry();
    renderPumps();
    renderSalePanel();
    renderLog();
  }

  return { render };
})();
