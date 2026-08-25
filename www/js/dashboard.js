// ============================================================
// dashboard.js — Route 98 Consolidated Executive Dashboard
// Multi-business reporting & unit drilldown for Minimart, Gas, Venue & Restaurant
// ============================================================
// (2026-07-13) Synchronize dashboard filters, empty states & 4-unit views; was broken
const Dashboard = (() => {
  let periodKey = "this_week"; // "today" | "this_week" | "last_week" | "this_month" | "last_month" | "all"
  let scopeKey = "all"; // "all" | "minimart" | "gasoline" | "venue" | "restaurant"
  let charts = {};

  const BIZ_THEMES = {
    all: { name: "Consolidated Executive", color: "#312E81", bg: "#EEF2FF", border: "#C7D2FE", icon: "bar-chart" },
    minimart: { name: "Minimart Store", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", icon: "store" },
    gasoline: { name: "Gasoline Station", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: "fuel" },
    venue: { name: "Event Venue", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "party" },
    restaurant: { name: "Restaurant", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", icon: "utensils" }
  };

  function destroyCharts(){
    Object.values(charts).forEach(c => { try { c?.destroy(); } catch(e){} });
    charts = {};
  }

  // Helper to create smooth vertical linear gradients for Chart.js area fills
  function createGradient(ctx, colorHex, startAlpha = 0.22, endAlpha = 0.00){
    try {
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, hexToRgba(colorHex, startAlpha));
      gradient.addColorStop(1, hexToRgba(colorHex, endAlpha));
      return gradient;
    } catch(e){
      return hexToRgba(colorHex, 0.08);
    }
  }

  function hexToRgba(hex, alpha = 1){
    let c = hex.replace("#", "");
    if(c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  // Calculate previous period for trend comparisons
  function computePrevPeriodStats(){
    let prevRange = "last_week";
    if(periodKey === "today") prevRange = 1;
    else if(periodKey === "this_week") prevRange = "last_week";
    else if(periodKey === "this_month") prevRange = "last_month";
    else if(periodKey === "last_week") prevRange = "last_month";
    return Analytics.computeStats(prevRange);
  }

  function pctDelta(curr, prev){
    if(!prev || prev === 0) return curr > 0 ? "+100%" : "0%";
    const diff = ((curr - prev) / prev) * 100;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
  }

  // A. Top P&L Strip (6 cards with tooltips & senior-friendly 28-32px text)
  function renderExecutivePL(stats){
    const wrap = document.getElementById("dash-pl-strip");
    if(!wrap) return;
    const p = stats.pl;
    const isProfitable = p.netProfit >= 0;

    const cards = [
      {
        title: "Total Net Revenue",
        icon: "dollar-sign",
        val: Utils.money(p.netRevenue),
        sub: "Minimart, Fuel, Venue & Dining",
        tip: "Total combined earnings collected from Minimart POS, Gasoline pumps, Event bookings, and Restaurant dining.",
        hero: true
      },
      {
        title: "Cost of Goods (COGS)",
        icon: "shopping-bag",
        val: `−${Utils.money(p.totalCOGS)}`,
        sub: "Wholesale & supply cost",
        tip: "Direct wholesale cost of store inventory, base fuel tanker deliveries, and food ingredients sold.",
        color: "#DC2626"
      },
      {
        title: "Operating Expenses (OPEX)",
        icon: "truck",
        val: `−${Utils.money(stats.totalOperatingExpenses)}`,
        sub: "Logistics, utilities, staff",
        tip: "Day-to-day business expenses including electricity, water, staff salaries, repairs, and tanker logistics.",
        color: "#D97706"
      },
      {
        title: "Combined Gross Profit",
        icon: "trending-up",
        val: `+${Utils.money(p.grossProfit)}`,
        sub: `${p.margin.toFixed(1)}% Gross Margin`,
        tip: "Total revenue minus wholesale product costs, representing gross trading profit before paying bills.",
        color: "#059669"
      },
      {
        title: "Net Operating Profit",
        icon: isProfitable ? "check-circle" : "alert-triangle",
        val: `${p.netProfit < 0 ? "−" : "+"}${Utils.money(Math.abs(p.netProfit))}`,
        sub: isProfitable ? "Profitable after all bills" : "Operating at loss this period",
        tip: "True bottom-line money in pocket left after paying for all products, operating expenses, and logistics.",
        color: isProfitable ? "#059669" : "#DC2626",
        highlight: true
      },
      {
        title: "Overall Profit Margin",
        icon: "pie-chart",
        val: `${p.margin >= 0 ? "+" : ""}${p.margin.toFixed(1)}%`,
        sub: "Gross conversion efficiency",
        tip: "Percentage of total gross revenue retained as profit across all 4 commercial divisions.",
        color: "#312E81"
      }
    ];

    wrap.innerHTML = `
      <div class="dash-pl-grid">
        ${cards.map(c => `
          <div style="background:${c.hero ? 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)' : '#FFFFFF'};color:${c.hero ? '#FFFFFF' : '#0F172A'};border:1.5px solid ${c.hero ? '#312E81' : c.highlight ? (isProfitable ? '#A7F3D0' : '#FECACA') : '#E2E8F0'};border-top:${c.highlight ? `4px solid ${c.color}` : ''};border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;position:relative;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <div style="font-size:.70rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.hero ? '#C7D2FE' : '#64748B'};display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${Icons.get(c.icon,{size:14})} ${c.title}
              </div>
              <button class="dash-info-btn" aria-label="Explanation" tabindex="0" style="width:22px;height:22px;font-size:.80rem;">
                ⓘ
                <span class="dash-tooltip">${c.tip}</span>
              </button>
            </div>

            <div class="mono" style="font-size:1.32rem;font-weight:850;line-height:1.15;margin:4px 0;color:${c.hero ? '#FFFFFF' : c.color || '#0F172A'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${c.val}
            </div>

            <div style="font-size:.72rem;font-weight:600;color:${c.hero ? '#E0E7FF' : '#64748B'};display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${c.sub}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // B. Business Snapshot Row (4 equal cards, one per business, 3 numbers only)
  function renderBusinessSnapshotRow(stats, prevStats){
    const wrap = document.getElementById("dash-snapshot-row");
    if(!wrap) return;

    const units = [
      {
        id: "minimart",
        title: "Minimart Store",
        icon: "store",
        color: "#2563EB",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        rev: stats.storeTotal,
        profit: stats.storeGrossProfit,
        prevRev: prevStats?.storeTotal || 0
      },
      {
        id: "gasoline",
        title: "Gasoline Station",
        icon: "fuel",
        color: "#D97706",
        bg: "#FFFBEB",
        border: "#FDE68A",
        rev: stats.fuelTotal,
        profit: stats.fuelGrossProfit,
        prevRev: prevStats?.fuelTotal || 0
      },
      {
        id: "venue",
        title: "Event Venue",
        icon: "party",
        color: "#7C3AED",
        bg: "#F5F3FF",
        border: "#DDD6FE",
        rev: stats.venueRevenue,
        profit: stats.venueGrossProfit,
        prevRev: prevStats?.venueRevenue || 0
      },
      {
        id: "restaurant",
        title: "Restaurant",
        icon: "utensils",
        color: "#059669",
        bg: "#ECFDF5",
        border: "#A7F3D0",
        rev: stats.restRevenue,
        profit: stats.restGrossProfit,
        prevRev: prevStats?.restRevenue || 0
      }
    ];

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:1.02rem;font-weight:800;color:#0F172A;margin:0;display:flex;align-items:center;gap:8px;">
          ${Icons.get("grid",{size:17})} Business Snapshots <span style="font-size:.80rem;font-weight:600;color:#64748B;">(Click any card to open detailed dashboard)</span>
        </h3>
      </div>

      <div class="dash-snapshots-grid">
        ${units.map(u => {
          const delta = pctDelta(u.rev, u.prevRev);
          const isUp = !delta.startsWith("-");
          return `
            <div class="dash-snapshot-card" data-scope="${u.id}" style="border:1.5px solid ${u.border};position:relative;overflow:hidden;padding:16px 18px;">
              <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${u.color};"></div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:32px;height:32px;border-radius:8px;background:${u.bg};color:${u.color};display:flex;align-items:center;justify-content:center;">
                    ${Icons.get(u.icon,{size:17})}
                  </span>
                  <strong style="font-size:1.02rem;color:#0F172A;font-weight:800;">${u.title}</strong>
                </div>
                <span class="badge" style="background:${isUp ? '#ECFDF5' : '#FEF2F2'};color:${isUp ? '#059669' : '#DC2626'};font-weight:800;font-size:.74rem;padding:3px 7px;border-radius:6px;display:flex;align-items:center;gap:3px;">
                  ${Icons.get(isUp ? 'trending-up' : 'trending-down',{size:12})} ${delta}
                </span>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#F8FAFC;padding:10px 12px;border-radius:8px;border:1px solid #E2E8F0;margin-bottom:10px;">
                <div>
                  <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;color:#64748B;">1. Revenue</div>
                  <div class="mono" style="font-size:1.18rem;font-weight:850;color:#0F172A;margin-top:2px;">${Utils.money(u.rev)}</div>
                </div>
                <div>
                  <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;color:#64748B;">2. Gross Profit</div>
                  <div class="mono" style="font-size:1.18rem;font-weight:850;color:#059669;margin-top:2px;">+${Utils.money(u.profit)}</div>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;font-size:.80rem;font-weight:750;color:${u.color};">
                <span>View ${u.title} Dashboard</span>
                <span>→</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    wrap.querySelectorAll(".dash-snapshot-card").forEach(card => {
      card.onclick = () => {
        scopeKey = card.dataset.scope;
        render();
      };
    });
  }

  // C. Charts Section (Working Rendered Charts with center summary in Donut)
  function renderExecutiveCharts(stats){
    destroyCharts();
    const isDark = document.documentElement.dataset.theme === "dark";
    const gridColor = isDark ? "#334155" : "#E2E8F0";
    const textColor = isDark ? "#94A3B8" : "#475569";

    if(typeof Chart !== "undefined"){
      Chart.defaults.color = textColor;
      Chart.defaults.font.family = "Montserrat, sans-serif";
      Chart.defaults.font.size = 12;
    }

    const trend = Analytics.computeTrendData(periodKey);
    const totalRev = stats.pl.netRevenue;
    const hasData = totalRev > 0;

    // Update subtitles in chart headers
    const subEls = document.querySelectorAll(".dash-chart-sub");
    subEls.forEach(el => el.textContent = stats.periodRange.subtitle);

    // 1. Revenue Share Donut Chart
    const pieWrap = document.getElementById("wrap-chart-rev-share");
    const pieEl = document.getElementById("chart-rev-share");
    const centerRevEl = document.getElementById("donut-center-total");
    if(centerRevEl) centerRevEl.textContent = Utils.money(totalRev);

    if(pieWrap && pieEl && typeof Chart !== "undefined"){
      const emptyStateEl = document.getElementById("empty-rev-share");
      if(!hasData){
        if(emptyStateEl) emptyStateEl.style.display = "flex";
        pieEl.style.display = "none";
      } else {
        if(emptyStateEl) emptyStateEl.style.display = "none";
        pieEl.style.display = "block";
        charts.pie = new Chart(pieEl, {
          type: "doughnut",
          data: {
            labels: ["Minimart Store", "Gasoline Station", "Event Venue", "Restaurant"],
            datasets: [{
              data: [stats.storeTotal, stats.fuelTotal, stats.venueRevenue, stats.restRevenue],
              backgroundColor: ["#2563EB", "#D97706", "#7C3AED", "#059669"],
              borderWidth: 2,
              borderColor: isDark ? "#1E293B" : "#FFFFFF"
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom", labels: { padding: 14, font: { weight: "600", size: 12 }, boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const val = ctx.parsed;
                    const pct = totalRev > 0 ? ((val / totalRev) * 100).toFixed(1) : 0;
                    return ` ${ctx.label}: ${Utils.money(val)} (${pct}%)`;
                  }
                }
              }
            },
            cutout: "68%"
          }
        });
      }
    }

    // 2. Revenue Comparison Multi-line Chart
    const trendWrap = document.getElementById("wrap-chart-rev-trend");
    const trendEl = document.getElementById("chart-rev-trend");
    const emptyTrendEl = document.getElementById("empty-rev-trend");

    if(trendWrap && trendEl && typeof Chart !== "undefined"){
      if(!trend.hasData){
        if(emptyTrendEl) emptyTrendEl.style.display = "flex";
        trendEl.style.display = "none";
      } else {
        if(emptyTrendEl) emptyTrendEl.style.display = "none";
        trendEl.style.display = "block";
        const ctx = trendEl.getContext("2d");

        charts.trend = new Chart(trendEl, {
          type: "line",
          data: {
            labels: trend.labels,
            datasets: [
              { label: "Minimart", data: trend.storeData, borderColor: "#2563EB", backgroundColor: createGradient(ctx, "#2563EB"), tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 },
              { label: "Gasoline", data: trend.fuelData, borderColor: "#D97706", backgroundColor: createGradient(ctx, "#D97706"), tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 },
              { label: "Venue", data: trend.venueData, borderColor: "#7C3AED", backgroundColor: createGradient(ctx, "#7C3AED"), tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 },
              { label: "Restaurant", data: trend.restData, borderColor: "#059669", backgroundColor: createGradient(ctx, "#059669"), tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom", labels: { padding: 14, font: { weight: "600", size: 12 }, boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.dataset.label}: ${Utils.money(ctx.parsed.y)}`
                }
              }
            },
            scales: {
              x: { grid: { color: gridColor }, ticks: { font: { weight: "600" } } },
              y: { grid: { color: gridColor }, ticks: { callback: v => "₱" + Number(v).toLocaleString() } }
            }
          }
        });
      }
    }

    // 3. Profit Trend Over Time (Net Profit Day by Day)
    const profitEl = document.getElementById("chart-net-profit-trend");
    const emptyProfitEl = document.getElementById("empty-profit-trend");

    if(profitEl && typeof Chart !== "undefined"){
      if(!trend.hasData){
        if(emptyProfitEl) emptyProfitEl.style.display = "flex";
        profitEl.style.display = "none";
      } else {
        if(emptyProfitEl) emptyProfitEl.style.display = "none";
        profitEl.style.display = "block";

        charts.profit = new Chart(profitEl, {
          type: "bar",
          data: {
            labels: trend.labels,
            datasets: [{
              label: "Net Profit (₱)",
              data: trend.profitData,
              backgroundColor: "#059669",
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Net Profit: ${Utils.money(ctx.parsed.y)}`
                }
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { weight: "600" } } },
              y: { grid: { color: gridColor }, ticks: { callback: v => "₱" + Number(v).toLocaleString() } }
            }
          }
        });
      }
    }

    // 4. Payment Channels Chart
    const payEl = document.getElementById("chart-pay-channels");
    const emptyPayEl = document.getElementById("empty-pay-channels");

    if(payEl && typeof Chart !== "undefined"){
      const payMap = Analytics.paymentBreakdown(stats);
      const payLabels = Object.keys(payMap);
      const hasPay = payLabels.length > 0 && Object.values(payMap).some(v => v > 0);

      if(!hasPay){
        if(emptyPayEl) emptyPayEl.style.display = "flex";
        payEl.style.display = "none";
      } else {
        if(emptyPayEl) emptyPayEl.style.display = "none";
        payEl.style.display = "block";
        const payTotal = Object.values(payMap).reduce((a,b)=>a+b,0);

        charts.pay = new Chart(payEl, {
          type: "doughnut",
          data: {
            labels: payLabels,
            datasets: [{
              data: Object.values(payMap),
              backgroundColor: ["#2563EB", "#059669", "#D97706", "#7C3AED", "#64748B"],
              borderWidth: 2,
              borderColor: isDark ? "#1E293B" : "#FFFFFF"
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom", labels: { padding: 12, boxWidth: 10, font: { weight: "600" } } },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const val = ctx.parsed;
                    const pct = payTotal > 0 ? ((val / payTotal) * 100).toFixed(1) : 0;
                    return ` ${ctx.label}: ${Utils.money(val)} (${pct}%)`;
                  }
                }
              }
            },
            cutout: "60%"
          }
        });
      }
    }
  }

  // D. Below the Fold (Top 5 Products + Low Stock Alerts)
  function renderBelowFold(stats){
    const wrap = document.getElementById("dash-below-fold");
    if(!wrap) return;

    const top5 = Analytics.topSellers(stats, 5);
    const lowStockItems = DB.getProducts().filter(p => p.stock <= p.lowStockThreshold).slice(0, 6);

    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-bottom:40px;">
        <!-- Top 5 Minimart Products -->
        <div style="background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <h3 style="font-size:1.02rem;font-weight:800;color:#0F172A;margin:0;display:flex;align-items:center;gap:8px;">
                <span style="color:#2563EB;">${Icons.get("package",{size:18})}</span> Top Selling Products (Minimart)
              </h3>
              <button class="btn btn-sm btn-ghost" onclick="App.navigate('inventory')" style="font-size:.82rem;font-weight:700;color:#2563EB;">
                View All in Inventory →
              </button>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${top5.length ? top5.map((p, idx) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#F8FAFC;border-radius:8px;border:1px solid #F1F5F9;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="width:24px;height:24px;border-radius:50%;background:#EFF6FF;color:#2563EB;font-size:.78rem;font-weight:800;display:flex;align-items:center;justify-content:center;">${idx+1}</span>
                    <div>
                      <strong style="font-size:.90rem;color:#0F172A;display:block;">${Utils.escapeHtml(p.name)}</strong>
                      <span style="font-size:.74rem;color:#64748B;font-weight:600;">${Utils.escapeHtml(p.category)}</span>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div class="mono font-bold" style="font-size:.95rem;color:#2563EB;">${Utils.money(p.revenue)}</div>
                    <div class="text-xs text-faint">${p.units} units sold</div>
                  </div>
                </div>
              `).join("") : `<div style="padding:28px 16px;text-align:center;color:#64748B;font-weight:600;">No product sales recorded for this period.</div>`}
            </div>
          </div>
        </div>

        <!-- Payment Methods -->
        <div style="background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;position:relative;">
          <h3 style="font-size:1.02rem;font-weight:800;color:#0F172A;margin:0 0 14px;display:flex;align-items:center;gap:8px;">
            <span style="color:#7C3AED;">${Icons.get("wallet",{size:18})}</span> Payment Channels
          </h3>
          <div style="position:relative;height:200px;width:100%;">
            <canvas id="chart-pay-channels"></canvas>
            <div id="empty-pay-channels" class="chart-empty-state" style="display:none;">
              <div class="empty-icon">${Icons.get("wallet",{size:28})}</div>
              <div class="empty-title">No Transactions</div>
              <div class="empty-sub dash-chart-sub">${stats.periodRange.subtitle}</div>
            </div>
          </div>
        </div>

        <!-- Low Stock & Restock Alerts -->
        <div style="background:#FFFFFF;border:1.5px solid #FECACA;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <h3 style="font-size:1.02rem;font-weight:800;color:#DC2626;margin:0;display:flex;align-items:center;gap:8px;">
                ${Icons.get("alert-triangle",{size:18})} Low Stock Alerts
              </h3>
              <span class="badge badge-rust font-bold" style="font-size:.78rem;">${lowStockItems.length} Items</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${lowStockItems.length ? lowStockItems.map(item => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#FEF2F2;border-radius:8px;border:1px solid #FEE2E2;">
                  <strong style="font-size:.88rem;color:#991B1B;">${Utils.escapeHtml(item.name)}</strong>
                  <span class="mono font-bold" style="font-size:.88rem;color:#DC2626;">${item.stock} left (min: ${item.lowStockThreshold})</span>
                </div>
              `).join("") : `<div style="padding:28px 16px;text-align:center;color:#059669;font-weight:700;">All inventory levels healthy.</div>`}
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="App.navigate('inventory')" style="min-height:44px;margin-top:14px;border-color:#F87171;color:#DC2626;font-weight:750;border-radius:10px;">
            Open Stock Manager →
          </button>
        </div>
      </div>
    `;
  }

  // 5. Per-Business Dashboards Template (Minimart, Gasoline, Venue, Restaurant)
  function renderPerBusinessDashboard(stats){
    const wrap = document.getElementById("dash-scoped-view");
    if(!wrap) return;
    const theme = BIZ_THEMES[scopeKey] || BIZ_THEMES.minimart;
    const trend = Analytics.computeTrendData(periodKey);

    let kpiCards = [];
    let customChartHtml = "";
    let customTableHtml = "";

    if(scopeKey === "minimart"){
      const margin = stats.storeTotal > 0 ? (stats.storeGrossProfit / stats.storeTotal) * 100 : 0;
      kpiCards = [
        { label: "Minimart Revenue", val: Utils.money(stats.storeTotal), sub: `${stats.storeTxCount} Total Sales`, color: "#2563EB", icon: "shopping-bag" },
        { label: "Cost of Goods (COGS)", val: `−${Utils.money(stats.storeCOGS)}`, sub: "Wholesale inventory cost", color: "#DC2626", icon: "tag" },
        { label: "Store Gross Profit", val: `+${Utils.money(stats.storeGrossProfit)}`, sub: `${margin.toFixed(1)}% Gross Margin`, color: "#059669", icon: "trending-up" },
        { label: "Inventory Stock Value", val: Utils.money(stats.inventoryValue), sub: `${stats.lowStock} Low stock alerts`, color: "#312E81", icon: "package" }
      ];

      customChartHtml = `
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:22px;">
          <!-- Daily Store Revenue Trend -->
          <div style="background:#FFFFFF;border:1.5px solid #BFDBFE;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#1E3A8A;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("trending-up",{size:19})} Store Revenue Trend
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-trend"></canvas>
              <div id="empty-scoped-trend" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("trending-up",{size:32})}</div>
                <div class="empty-title">No Store Sales</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>

          <!-- Revenue by Product Category -->
          <div style="background:#FFFFFF;border:1.5px solid #BFDBFE;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#1E3A8A;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("tag",{size:19})} Revenue by Product Category
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-breakdown"></canvas>
              <div id="empty-scoped-break" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("tag",{size:32})}</div>
                <div class="empty-title">No Category Data</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>
        </div>
      `;

      customTableHtml = `
        <div style="background:#FFFFFF;border:1.5px solid #BFDBFE;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:1.10rem;font-weight:800;color:#1E3A8A;margin:0 0 2px;">Recent Minimart Sales & Checkout Logs</h3>
              <div style="font-size:.84rem;color:#64748B;font-weight:600;">Showing transactions recorded in ${stats.periodRange.label}</div>
            </div>
            <button class="btn btn-primary" onclick="App.navigate('pos')" style="min-height:44px;background:#2563EB;border-radius:10px;font-weight:750;padding:8px 18px;font-size:.90rem;">
              Open POS Cashier →
            </button>
          </div>
          <table class="data" style="width:100%;font-size:.92rem;">
            <thead>
              <tr style="background:#F8FAFC;color:#64748B;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em;">
                <th style="padding:12px 10px;">Transaction #</th>
                <th style="padding:12px 10px;">Items Purchased</th>
                <th style="padding:12px 10px;text-align:right;">Total Amount</th>
                <th style="padding:12px 10px;text-align:center;">Payment Method</th>
                <th style="padding:12px 10px;text-align:center;">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              ${stats.sales.slice(0, 8).map(s => `
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td class="mono font-bold" style="padding:12px 10px;color:#1E3A8A;">${s.id}</td>
                  <td style="padding:12px 10px;color:#0F172A;font-weight:600;">${s.items.length} items (${Utils.escapeHtml(s.items[0]?.name||"")}${s.items.length>1?` +${s.items.length-1}`:""})</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;color:#2563EB;font-size:1.05rem;">${Utils.money(s.total)}</td>
                  <td style="padding:12px 10px;text-align:center;"><span class="badge font-bold" style="background:#EFF6FF;color:#2563EB;padding:4px 10px;border-radius:6px;font-size:.78rem;">${s.method}</span></td>
                  <td class="mono text-sm text-faint" style="padding:12px 10px;text-align:center;">${Utils.fmtDate(s.ts)}</td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="text-center text-faint" style="padding:32px;font-size:1rem;">No store sales recorded for this period.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if(scopeKey === "gasoline"){
      const cfg = DB.getFuelConfig();
      const margin = stats.fuelTotal > 0 ? (stats.fuelGrossProfit / stats.fuelTotal) * 100 : 0;
      kpiCards = [
        { label: "Gasoline Revenue", val: Utils.money(stats.fuelTotal), sub: `${stats.fuelTxCount} Fuel Transactions`, color: "#D97706", icon: "fuel" },
        { label: "Tanker Supply Cost", val: `−${Utils.money(stats.fuelCOGS)}`, sub: "Wholesale bulk tanker cost", color: "#DC2626", icon: "truck" },
        { label: "Fuel Gross Profit", val: `+${Utils.money(stats.fuelGrossProfit)}`, sub: `${margin.toFixed(1)}% Gross Margin`, color: "#059669", icon: "trending-up" },
        { label: "Volume Dispensed", val: `${stats.fuelLiters.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})} L`, sub: "Across 3 pump terminals", color: "#312E81", icon: "droplet" }
      ];

      customChartHtml = `
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:22px;">
          <!-- Fuel Dispense Volume Trend -->
          <div style="background:#FFFFFF;border:1.5px solid #FDE68A;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#92400E;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("trending-up",{size:19})} Fuel Dispense Volume & Revenue Trend
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-trend"></canvas>
              <div id="empty-scoped-trend" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("fuel",{size:32})}</div>
                <div class="empty-title">No Fuel Dispensed</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>

          <!-- Revenue by Fuel Grade -->
          <div style="background:#FFFFFF;border:1.5px solid #FDE68A;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#92400E;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("fuel",{size:19})} Volume by Fuel Grade (Liters)
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-breakdown"></canvas>
              <div id="empty-scoped-break" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("fuel",{size:32})}</div>
                <div class="empty-title">No Fuel Grade Data</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>
        </div>
      `;

      customTableHtml = `
        <!-- Live Tank Levels and Pumps -->
        <div style="margin-bottom:20px;">
          <h3 style="font-size:1.10rem;font-weight:800;color:#92400E;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
            ${Icons.get("activity",{size:18})} Live Underground Tank Capacities
          </h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;">
            ${cfg.pumps.map(p => {
              const fuel = cfg.fuels[p.fuelType] || cfg.fuels.gasoline;
              const pct = Math.min(100, Math.round((fuel.tank / (fuel.capacity || 10000)) * 100));
              return `
                <div style="background:#FFFFFF;border:1.5px solid #FDE68A;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span class="badge font-bold" style="background:#FEF3C7;color:#D97706;padding:4px 10px;border-radius:6px;font-size:.78rem;">${p.label}</span>
                    <strong style="font-size:1.08rem;color:#0F172A;">${fuel.name}</strong>
                  </div>
                  <div class="mono font-bold" style="font-size:1.60rem;color:#D97706;margin-bottom:8px;">${Utils.money(fuel.price)}/L</div>
                  <div style="font-size:.82rem;color:#475569;font-weight:600;margin-bottom:6px;">Storage: ${fuel.tank.toLocaleString()} / ${(fuel.capacity||10000).toLocaleString()} L (${pct}%)</div>
                  <div style="height:10px;border-radius:5px;background:#F1F5F9;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${pct < 25 ? '#EF4444' : '#D97706'};border-radius:5px;"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Recent Fuel Sales -->
        <div style="background:#FFFFFF;border:1.5px solid #FDE68A;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:1.10rem;font-weight:800;color:#92400E;margin:0 0 2px;">Recent Fuel Dispense Logs</h3>
              <div style="font-size:.84rem;color:#64748B;font-weight:600;">Dispense history for ${stats.periodRange.label}</div>
            </div>
            <button class="btn btn-primary" onclick="App.navigate('gasoline')" style="min-height:44px;background:#D97706;border-radius:10px;font-weight:750;padding:8px 18px;font-size:.90rem;">
              Open Gasoline Station →
            </button>
          </div>
          <table class="data" style="width:100%;font-size:.92rem;">
            <thead>
              <tr style="background:#F8FAFC;color:#64748B;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em;">
                <th style="padding:12px 10px;">Receipt #</th>
                <th style="padding:12px 10px;">Fuel Grade</th>
                <th style="padding:12px 10px;text-align:right;">Liters</th>
                <th style="padding:12px 10px;text-align:right;">Price / L</th>
                <th style="padding:12px 10px;text-align:right;">Total Amount</th>
                <th style="padding:12px 10px;text-align:center;">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              ${stats.fuelSales.slice(0, 8).map(s => `
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td class="mono font-bold" style="padding:12px 10px;color:#92400E;">${s.id}</td>
                  <td style="padding:12px 10px;color:#0F172A;font-weight:700;">${Utils.escapeHtml(s.fuelName||"Fuel")}</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;">${(s.liters||0).toFixed(2)} L</td>
                  <td class="mono" style="padding:12px 10px;text-align:right;color:#64748B;">${Utils.money(s.pricePerL||0)}</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;color:#D97706;font-size:1.05rem;">${Utils.money(s.amount)}</td>
                  <td class="mono text-sm text-faint" style="padding:12px 10px;text-align:center;">${Utils.fmtDate(s.ts)}</td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="text-center text-faint" style="padding:32px;font-size:1rem;">No fuel sales recorded for this period.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if(scopeKey === "venue"){
      const r = stats.periodRange;
      const periodDays = Math.max(1, Math.round((r.end - r.start) / 86400000));
      const bookedDaysSet = new Set(stats.bookings.map(b => b.date));
      const occupancyPct = Math.min(100, Math.round((bookedDaysSet.size / periodDays) * 100));
      const avgBookingVal = stats.venueTxCount > 0 ? Utils.money(stats.venueRevenue / stats.venueTxCount) : "₱0.00";

      kpiCards = [
        { label: "Venue Revenue", val: Utils.money(stats.venueRevenue), sub: `${stats.venueTxCount} Reservations`, color: "#7C3AED", icon: "party" },
        { label: "Downpayments Collected", val: Utils.money(stats.venuePaid), sub: "Cash & electronic deposits", color: "#059669", icon: "check-circle" },
        { label: "Pending Balances", val: Utils.money(stats.venueBalance), sub: "Receivables upon check-in", color: "#D97706", icon: "clock" },
        { label: "Occupancy & Avg Value", val: `${occupancyPct}% Booked`, sub: `Avg Value: ${avgBookingVal}`, color: "#312E81", icon: "calendar" }
      ];

      customChartHtml = `
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:22px;">
          <!-- Venue Booking Revenue Trend -->
          <div style="background:#FFFFFF;border:1.5px solid #DDD6FE;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#5B21B6;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("trending-up",{size:19})} Venue Booking Revenue Trend
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-trend"></canvas>
              <div id="empty-scoped-trend" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("party",{size:32})}</div>
                <div class="empty-title">No Venue Bookings</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>

          <!-- Bookings by Event Type -->
          <div style="background:#FFFFFF;border:1.5px solid #DDD6FE;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#5B21B6;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("pie-chart",{size:19})} Bookings by Event Type
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-breakdown"></canvas>
              <div id="empty-scoped-break" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("pie-chart",{size:32})}</div>
                <div class="empty-title">No Event Type Data</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>
        </div>
      `;

      customTableHtml = `
        <div style="background:#FFFFFF;border:1.5px solid #DDD6FE;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:1.10rem;font-weight:800;color:#5B21B6;margin:0 0 2px;">Venue Reservations & Event Schedule</h3>
              <div style="font-size:.84rem;color:#64748B;font-weight:600;">Active reservations for ${stats.periodRange.label}</div>
            </div>
            <button class="btn btn-primary" onclick="App.navigate('venue')" style="min-height:44px;background:#7C3AED;border-radius:10px;font-weight:750;padding:8px 18px;font-size:.90rem;">
              Manage Bookings & Calendar →
            </button>
          </div>
          <table class="data" style="width:100%;font-size:.92rem;">
            <thead>
              <tr style="background:#F8FAFC;color:#64748B;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em;">
                <th style="padding:12px 10px;">Client Name</th>
                <th style="padding:12px 10px;">Event Type & Area</th>
                <th style="padding:12px 10px;text-align:center;">Date & Schedule</th>
                <th style="padding:12px 10px;text-align:right;">Total Fee</th>
                <th style="padding:12px 10px;text-align:right;">Deposit Paid</th>
                <th style="padding:12px 10px;text-align:right;">Balance</th>
                <th style="padding:12px 10px;text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${stats.bookings.slice(0, 8).map(b => `
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:12px 10px;font-weight:750;color:#0F172A;">${Utils.escapeHtml(b.clientName||"Guest")}</td>
                  <td style="padding:12px 10px;color:#475569;font-weight:600;">${Utils.escapeHtml(b.eventType||"Event")} · <span style="font-weight:500;">${Utils.escapeHtml(b.venueArea||"Main Area")}</span></td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:center;color:#5B21B6;">${b.date} (${b.startTime||"8:00"}–${b.endTime||"17:00"})</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;">${Utils.money(b.fee)}</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;color:#059669;">${Utils.money(b.paid)}</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;color:${b.balance > 0 ? '#D97706' : '#059669'};">${Utils.money(b.balance)}</td>
                  <td style="padding:12px 10px;text-align:center;"><span class="badge font-bold" style="background:#F5F3FF;color:#7C3AED;padding:4px 10px;border-radius:6px;font-size:.78rem;">${b.status||"Confirmed"}</span></td>
                </tr>
              `).join("") || `<tr><td colspan="7" class="text-center text-faint" style="padding:32px;font-size:1rem;">No venue bookings recorded for this period.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if(scopeKey === "restaurant"){
      const margin = stats.restRevenue > 0 ? (stats.restGrossProfit / stats.restRevenue) * 100 : 0;
      const avgSpendGuest = stats.restGuestCount > 0 ? Utils.money(stats.restRevenue / stats.restGuestCount) : "₱0.00";

      kpiCards = [
        { label: "Restaurant Revenue", val: Utils.money(stats.restRevenue), sub: `${stats.restTxCount} Table Bookings`, color: "#059669", icon: "utensils" },
        { label: "Food & Beverage Costs", val: `−${Utils.money(stats.restCOGS)}`, sub: "Estimated kitchen food cost (38%)", color: "#DC2626", icon: "shopping-bag" },
        { label: "Dining Gross Profit", val: `+${Utils.money(stats.restGrossProfit)}`, sub: `${margin.toFixed(1)}% Gross Margin`, color: "#059669", icon: "trending-up" },
        { label: "Guests Served (Pax)", val: `${stats.restGuestCount} Pax`, sub: `Avg Spend: ${avgSpendGuest}`, color: "#312E81", icon: "users" }
      ];

      customChartHtml = `
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:22px;">
          <!-- Restaurant Sales Trend -->
          <div style="background:#FFFFFF;border:1.5px solid #A7F3D0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#065F46;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("trending-up",{size:19})} Restaurant Dining Sales Trend
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-trend"></canvas>
              <div id="empty-scoped-trend" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("utensils",{size:32})}</div>
                <div class="empty-title">No Restaurant Sales</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>

          <!-- Revenue by Meal Type -->
          <div style="background:#FFFFFF;border:1.5px solid #A7F3D0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <h3 style="font-size:1.08rem;font-weight:800;color:#065F46;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                  ${Icons.get("pie-chart",{size:19})} Bookings by Meal Service
                </h3>
                <span class="dash-chart-sub" style="font-size:.84rem;color:#64748B;font-weight:600;">${stats.periodRange.subtitle}</span>
              </div>
            </div>
            <div style="position:relative;height:240px;width:100%;">
              <canvas id="chart-scoped-breakdown"></canvas>
              <div id="empty-scoped-break" class="chart-empty-state" style="display:none;">
                <div class="empty-icon">${Icons.get("pie-chart",{size:32})}</div>
                <div class="empty-title">No Meal Service Data</div>
                <div class="empty-sub">${stats.periodRange.subtitle}</div>
              </div>
            </div>
          </div>
        </div>
      `;

      customTableHtml = `
        <div style="background:#FFFFFF;border:1.5px solid #A7F3D0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:1.10rem;font-weight:800;color:#065F46;margin:0 0 2px;">Recent Table Reservations & Service Orders</h3>
              <div style="font-size:.84rem;color:#64748B;font-weight:600;">Dining service records for ${stats.periodRange.label}</div>
            </div>
            <button class="btn btn-primary" onclick="App.navigate('restaurant')" style="min-height:44px;background:#059669;border-radius:10px;font-weight:750;padding:8px 18px;font-size:.90rem;">
              Open Restaurant Manager →
            </button>
          </div>
          <table class="data" style="width:100%;font-size:.92rem;">
            <thead>
              <tr style="background:#F8FAFC;color:#64748B;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em;">
                <th style="padding:12px 10px;">Guest Name</th>
                <th style="padding:12px 10px;">Table & Meal Service</th>
                <th style="padding:12px 10px;text-align:center;">Party Size</th>
                <th style="padding:12px 10px;text-align:center;">Schedule</th>
                <th style="padding:12px 10px;text-align:right;">Amount / Deposit</th>
                <th style="padding:12px 10px;text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${stats.restBookings.slice(0, 8).map(r => `
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:12px 10px;font-weight:750;color:#0F172A;">${Utils.escapeHtml(r.guestName||r.name||"Guest")}</td>
                  <td style="padding:12px 10px;color:#475569;font-weight:600;">${Utils.escapeHtml(r.tableName||"Dining Table")} · <span style="font-weight:500;">${Utils.escapeHtml(r.mealType||"Dinner")}</span></td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:center;">${r.pax||2} pax</td>
                  <td class="mono" style="padding:12px 10px;text-align:center;">${r.date||""} ${r.startTime||""}</td>
                  <td class="mono font-bold" style="padding:12px 10px;text-align:right;color:#059669;font-size:1.05rem;">${Utils.money(r.spent||r.fee||r.deposit||r.paid||0)}</td>
                  <td style="padding:12px 10px;text-align:center;"><span class="badge font-bold" style="background:#ECFDF5;color:#059669;padding:4px 10px;border-radius:6px;font-size:.78rem;">${r.status||"Confirmed"}</span></td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="text-center text-faint" style="padding:32px;font-size:1rem;">No dining reservations recorded for this period.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    }

    wrap.innerHTML = `
      <!-- Back to All Businesses Header -->
      <div style="margin-bottom:20px;background:${theme.bg};border:1.5px solid ${theme.border};padding:18px 22px;border-radius:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="width:44px;height:44px;border-radius:12px;background:${theme.color};color:#FFFFFF;display:flex;align-items:center;justify-content:center;">
            ${Icons.get(theme.icon,{size:22})}
          </span>
          <div>
            <h2 style="font-size:1.45rem;font-weight:850;color:#0F172A;margin:0 0 2px;">${theme.name} Dashboard</h2>
            <div style="font-size:.88rem;color:#475569;font-weight:600;">Scoped Business Unit Performance for ${stats.periodRange.subtitle}</div>
          </div>
        </div>
        <button class="dash-tap-btn btn btn-outline" id="btn-back-all-dash" style="background:#FFFFFF;border:1.5px solid ${theme.border};color:${theme.color};font-weight:750;border-radius:10px;padding:8px 18px;">
          ← Back to All Businesses
        </button>
      </div>

      <!-- Scoped KPI Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:22px;">
        ${kpiCards.map(c => `
          <div style="background:#FFFFFF;border:1.5px solid ${theme.border};border-radius:14px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="font-size:.78rem;font-weight:800;text-transform:uppercase;color:#64748B;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ${Icons.get(c.icon || 'tag',{size:15})} ${c.label}
            </div>
            <div class="mono" style="font-size:1.85rem;font-weight:850;color:${c.color};line-height:1.15;margin-bottom:6px;">${c.val}</div>
            <div style="font-size:.82rem;font-weight:600;color:#64748B;">${c.sub}</div>
          </div>
        `).join("")}
      </div>

      <!-- Scoped Visual Charts -->
      ${customChartHtml}

      <!-- Scoped Operational Table -->
      ${customTableHtml}
    `;

    document.getElementById("btn-back-all-dash")?.addEventListener("click", () => {
      scopeKey = "all";
      render();
    });

    // Build Scoped Charts
    destroyCharts();
    const trendEl = document.getElementById("chart-scoped-trend");
    const breakEl = document.getElementById("chart-scoped-breakdown");
    const emptyTrendEl = document.getElementById("empty-scoped-trend");
    const emptyBreakEl = document.getElementById("empty-scoped-break");

    if(trendEl && typeof Chart !== "undefined"){
      let seriesData = trend.storeData;
      let hasScopedData = stats.storeTotal > 0;
      if(scopeKey === "gasoline") { seriesData = trend.fuelData; hasScopedData = stats.fuelTotal > 0; }
      else if(scopeKey === "venue") { seriesData = trend.venueData; hasScopedData = stats.venueRevenue > 0; }
      else if(scopeKey === "restaurant") { seriesData = trend.restData; hasScopedData = stats.restRevenue > 0; }

      if(!hasScopedData || !trend.hasData){
        if(emptyTrendEl) emptyTrendEl.style.display = "flex";
        trendEl.style.display = "none";
      } else {
        if(emptyTrendEl) emptyTrendEl.style.display = "none";
        trendEl.style.display = "block";
        const ctx = trendEl.getContext("2d");

        charts.scopedTrend = new Chart(trendEl, {
          type: "line",
          data: {
            labels: trend.labels,
            datasets: [{
              label: "Revenue",
              data: seriesData,
              borderColor: theme.color,
              backgroundColor: createGradient(ctx, theme.color),
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointHoverRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Revenue: ${Utils.money(ctx.parsed.y)}`
                }
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { weight: "600" } } },
              y: { grid: { color: "#E2E8F0" }, ticks: { callback: v => "₱" + Number(v).toLocaleString() } }
            }
          }
        });
      }
    }

    if(breakEl && typeof Chart !== "undefined"){
      if(scopeKey === "minimart"){
        const catPL = Analytics.categoryPL(stats);
        const hasCat = catPL.length > 0 && catPL.some(c => c.revenue > 0);
        if(!hasCat){
          if(emptyBreakEl) emptyBreakEl.style.display = "flex";
          breakEl.style.display = "none";
        } else {
          if(emptyBreakEl) emptyBreakEl.style.display = "none";
          breakEl.style.display = "block";
          charts.scopedBreak = new Chart(breakEl, {
            type: "doughnut",
            data: {
              labels: catPL.map(c => c.category),
              datasets: [{
                data: catPL.map(c => c.revenue),
                backgroundColor: ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE", "#DBEAFE"]
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "bottom", labels: { font: { weight: "600" } } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${Utils.money(ctx.parsed)}`
                  }
                }
              },
              cutout: "60%"
            }
          });
        }
      } else if(scopeKey === "gasoline"){
        const cfg = DB.getFuelConfig();
        const fuelTotals = {};
        stats.fuelSales.forEach(s => { fuelTotals[s.fuelName] = (fuelTotals[s.fuelName]||0) + s.liters; });
        const hasFuel = Object.keys(fuelTotals).length > 0 && Object.values(fuelTotals).some(v => v > 0);
        const fLabels = Object.keys(fuelTotals).length ? Object.keys(fuelTotals) : Object.values(cfg.fuels).map(f=>f.name);

        if(!hasFuel){
          if(emptyBreakEl) emptyBreakEl.style.display = "flex";
          breakEl.style.display = "none";
        } else {
          if(emptyBreakEl) emptyBreakEl.style.display = "none";
          breakEl.style.display = "block";
          charts.scopedBreak = new Chart(breakEl, {
            type: "bar",
            data: {
              labels: fLabels,
              datasets: [{
                label: "Liters Dispensed",
                data: fLabels.map(l => fuelTotals[l] || 0),
                backgroundColor: ["#10B981","#F59E0B","#EF4444"],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)} L`
                  }
                }
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { weight: "600" } } },
                y: { grid: { color: "#E2E8F0" }, ticks: { callback: v => Number(v).toLocaleString() + " L" } }
              }
            }
          });
        }
      } else if(scopeKey === "venue"){
        const typeMap = {};
        stats.bookings.forEach(b => {
          const t = b.eventType || "General Event";
          typeMap[t] = (typeMap[t]||0) + (Number(b.fee)||0);
        });
        const hasVenue = Object.keys(typeMap).length > 0 && Object.values(typeMap).some(v => v > 0);

        if(!hasVenue){
          if(emptyBreakEl) emptyBreakEl.style.display = "flex";
          breakEl.style.display = "none";
        } else {
          if(emptyBreakEl) emptyBreakEl.style.display = "none";
          breakEl.style.display = "block";
          charts.scopedBreak = new Chart(breakEl, {
            type: "doughnut",
            data: {
              labels: Object.keys(typeMap),
              datasets: [{
                data: Object.values(typeMap),
                backgroundColor: ["#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"]
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "bottom", labels: { font: { weight: "600" } } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${Utils.money(ctx.parsed)}`
                  }
                }
              },
              cutout: "60%"
            }
          });
        }
      } else if(scopeKey === "restaurant"){
        const mealMap = {};
        stats.restBookings.forEach(r => {
          const m = r.mealType || "Dinner Service";
          mealMap[m] = (mealMap[m]||0) + (Number(r.spent||r.fee||r.deposit||r.paid||0));
        });
        const hasRest = Object.keys(mealMap).length > 0 && Object.values(mealMap).some(v => v > 0);

        if(!hasRest){
          if(emptyBreakEl) emptyBreakEl.style.display = "flex";
          breakEl.style.display = "none";
        } else {
          if(emptyBreakEl) emptyBreakEl.style.display = "none";
          breakEl.style.display = "block";
          charts.scopedBreak = new Chart(breakEl, {
            type: "doughnut",
            data: {
              labels: Object.keys(mealMap),
              datasets: [{
                data: Object.values(mealMap),
                backgroundColor: ["#059669", "#10B981", "#34D399", "#6EE7B7", "#A7F3D0"]
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "bottom", labels: { font: { weight: "600" } } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${Utils.money(ctx.parsed)}`
                  }
                }
              },
              cutout: "60%"
            }
          });
        }
      }
    }
  }

  function render(){
    const view = document.getElementById("view-root");
    if(!view) return;

    view.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <!-- Sticky Header Bar: Business Groups & Time Periods -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;flex-shrink:0;">
          <div>
            <h2 style="font-size:1.60rem;font-weight:850;color:#0F172A;display:flex;align-items:center;gap:8px;margin:0 0 3px;">
              <span style="color:#312E81;">${Icons.get("bar-chart",{size:26})}</span> Executive Dashboard
            </h2>
            <div style="font-size:.90rem;color:#475569;font-weight:600;">
              Consolidated financial oversight & performance for Route 98 commercial group
            </div>
          </div>

          <!-- Sticky Period Filter Chips with 44px minimum tap targets -->
          <div style="display:flex;align-items:center;gap:6px;background:#F1F5F9;padding:4px;border-radius:12px;border:1px solid #CBD5E1;" id="dash-period-chips">
            <button class="dash-tap-btn chip ${periodKey==='today'?'active':''}" data-p="today" style="margin:0;padding:8px 16px;">Today</button>
            <button class="dash-tap-btn chip ${periodKey==='this_week'?'active':''}" data-p="this_week" style="margin:0;padding:8px 16px;">This Week</button>
            <button class="dash-tap-btn chip ${periodKey==='last_week'?'active':''}" data-p="last_week" style="margin:0;padding:8px 16px;">Last Week</button>
            <button class="dash-tap-btn chip ${periodKey==='this_month'?'active':''}" data-p="this_month" style="margin:0;padding:8px 16px;">This Month</button>
            <button class="dash-tap-btn chip ${periodKey==='last_month'?'active':''}" data-p="last_month" style="margin:0;padding:8px 16px;">Last Month</button>
            <button class="dash-tap-btn chip ${periodKey==='all'?'active':''}" data-p="all" style="margin:0;padding:8px 16px;">All Time</button>
          </div>
        </div>

        <!-- Scope Switcher Tabs (All Businesses vs Specific Business Units) -->
        <div style="display:flex;gap:8px;margin-bottom:18px;overflow-x:auto;padding-bottom:2px;flex-shrink:0;" id="dash-scope-tabs">
          <button class="dash-tap-btn chip font-bold ${scopeKey==='all'?'active':''}" data-scope="all" style="margin:0;padding:10px 18px;border-radius:10px;background:${scopeKey==='all'?'#312E81':'#FFFFFF'};color:${scopeKey==='all'?'#FFFFFF':'#334155'};border:1.5px solid ${scopeKey==='all'?'#312E81':'#CBD5E1'};display:inline-flex;align-items:center;gap:8px;">
            ${Icons.get("bar-chart",{size:16})} All Businesses (Executive)
          </button>
          <button class="dash-tap-btn chip font-bold ${scopeKey==='minimart'?'active':''}" data-scope="minimart" style="margin:0;padding:10px 18px;border-radius:10px;background:${scopeKey==='minimart'?'#2563EB':'#FFFFFF'};color:${scopeKey==='minimart'?'#FFFFFF':'#2563EB'};border:1.5px solid ${scopeKey==='minimart'?'#2563EB':'#BFDBFE'};display:inline-flex;align-items:center;gap:8px;">
            ${Icons.get("store",{size:16})} Minimart Store
          </button>
          <button class="dash-tap-btn chip font-bold ${scopeKey==='gasoline'?'active':''}" data-scope="gasoline" style="margin:0;padding:10px 18px;border-radius:10px;background:${scopeKey==='gasoline'?'#D97706':'#FFFFFF'};color:${scopeKey==='gasoline'?'#FFFFFF':'#D97706'};border:1.5px solid ${scopeKey==='gasoline'?'#D97706':'#FDE68A'};display:inline-flex;align-items:center;gap:8px;">
            ${Icons.get("fuel",{size:16})} Gasoline Station
          </button>
          <button class="dash-tap-btn chip font-bold ${scopeKey==='venue'?'active':''}" data-scope="venue" style="margin:0;padding:10px 18px;border-radius:10px;background:${scopeKey==='venue'?'#7C3AED':'#FFFFFF'};color:${scopeKey==='venue'?'#FFFFFF':'#7C3AED'};border:1.5px solid ${scopeKey==='venue'?'#7C3AED':'#DDD6FE'};display:inline-flex;align-items:center;gap:8px;">
            ${Icons.get("party",{size:16})} Event Venue
          </button>
          <button class="dash-tap-btn chip font-bold ${scopeKey==='restaurant'?'active':''}" data-scope="restaurant" style="margin:0;padding:10px 18px;border-radius:10px;background:${scopeKey==='restaurant'?'#059669':'#FFFFFF'};color:${scopeKey==='restaurant'?'#FFFFFF':'#059669'};border:1.5px solid ${scopeKey==='restaurant'?'#059669':'#A7F3D0'};display:inline-flex;align-items:center;gap:8px;">
            ${Icons.get("utensils",{size:16})} Restaurant
          </button>
        </div>

        <!-- Scrollable Main Content -->
        <div style="flex:1;min-height:0;overflow-y:auto;padding-right:6px;padding-bottom:50px;">
          <!-- A. Top P&L Strip -->
          <div id="dash-pl-strip"></div>

          ${scopeKey === "all" ? `
            <!-- B. Business Snapshot Row -->
            <div id="dash-snapshot-row"></div>

            <!-- C. Visual Charts Section -->
            <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:16px;margin-bottom:20px;">
              <!-- Combined Revenue Share Donut with Center Total -->
              <div id="wrap-chart-rev-share" style="background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                  <div>
                    <h3 style="font-size:1.05rem;font-weight:800;color:#0F172A;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                      <span style="color:#312E81;">${Icons.get("pie-chart",{size:19})}</span> Combined Revenue Share
                    </h3>
                    <span class="dash-chart-sub" style="font-size:.82rem;color:#64748B;font-weight:600;"></span>
                  </div>
                </div>
                <div style="position:relative;height:240px;width:100%;">
                  <canvas id="chart-rev-share"></canvas>
                  <div style="position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
                    <div style="font-size:.72rem;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.05em;">Total Rev</div>
                    <div id="donut-center-total" class="mono" style="font-size:1.25rem;font-weight:850;color:#0F172A;">₱0.00</div>
                  </div>
                  <div id="empty-rev-share" class="chart-empty-state" style="display:none;">
                    <div class="empty-icon">${Icons.get("pie-chart",{size:32})}</div>
                    <div class="empty-title">No Revenue Recorded</div>
                    <div class="empty-sub dash-chart-sub"></div>
                  </div>
                </div>
              </div>

              <!-- Revenue Comparison Chart -->
              <div id="wrap-chart-rev-trend" style="background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                  <div>
                    <h3 style="font-size:1.05rem;font-weight:800;color:#0F172A;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                      <span style="color:#2563EB;">${Icons.get("trending-up",{size:19})}</span> Revenue Comparison Across Divisions
                    </h3>
                    <span class="dash-chart-sub" style="font-size:.82rem;color:#64748B;font-weight:600;"></span>
                  </div>
                </div>
                <div style="position:relative;height:240px;width:100%;">
                  <canvas id="chart-rev-trend"></canvas>
                  <div id="empty-rev-trend" class="chart-empty-state" style="display:none;">
                    <div class="empty-icon">${Icons.get("trending-up",{size:32})}</div>
                    <div class="empty-title">No Transactions in Selected Period</div>
                    <div class="empty-sub dash-chart-sub"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Profit Trend Over Time Chart -->
            <div style="background:#FFFFFF;border:1.5px solid #E2E8F0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);margin-bottom:20px;position:relative;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <h3 style="font-size:1.05rem;font-weight:800;color:#0F172A;margin:0 0 2px;display:flex;align-items:center;gap:8px;">
                    <span style="color:#059669;">${Icons.get("bar-chart",{size:19})}</span> Combined Profit Trend Over Time
                  </h3>
                  <span class="dash-chart-sub" style="font-size:.82rem;color:#64748B;font-weight:600;"></span>
                </div>
              </div>
              <div style="position:relative;height:220px;width:100%;">
                <canvas id="chart-net-profit-trend"></canvas>
                <div id="empty-profit-trend" class="chart-empty-state" style="display:none;">
                  <div class="empty-icon">${Icons.get("bar-chart",{size:32})}</div>
                  <div class="empty-title">No Profit Trajectory Data</div>
                  <div class="empty-sub dash-chart-sub"></div>
                </div>
              </div>
            </div>

            <!-- D. Below the Fold -->
            <div id="dash-below-fold"></div>
          ` : `
            <!-- 5. Per-Business Scoped View -->
            <div id="dash-scoped-view"></div>
          `}
        </div>
      </div>
    `;

    document.querySelectorAll("#dash-period-chips .chip").forEach(chip => {
      chip.onclick = () => {
        periodKey = chip.dataset.p;
        render();
      };
    });

    document.querySelectorAll("#dash-scope-tabs .chip").forEach(chip => {
      chip.onclick = () => {
        scopeKey = chip.dataset.scope;
        render();
      };
    });

    refresh();
  }

  function refresh(){
    const stats = Analytics.computeStats(periodKey);
    const prevStats = computePrevPeriodStats();
    renderExecutivePL(stats);
    if(scopeKey === "all"){
      renderBusinessSnapshotRow(stats, prevStats);
      renderExecutiveCharts(stats);
      renderBelowFold(stats);
    } else {
      renderPerBusinessDashboard(stats);
    }
  }

  return { render };
})();
