// ============================================================
// analytics.js — shared revenue/profit/loss calculations used by
// both the Dashboard tab and the Reports > Overview tab, so the
// numbers are always computed one way, in one place.
// ============================================================
const Analytics = (() => {
  // (2026-07-13) Fix period ranges & labels for full sync; was days only
  function getPeriodRange(p){
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon
    const mondayOffset = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0, 0).getTime();
    const thisWeekEnd = thisWeekStart + (7 * 86400000) - 1;

    const lastWeekStart = thisWeekStart - (7 * 86400000);
    const lastWeekEnd = thisWeekStart - 1;

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

    if(typeof p === "number"){
      const start = Utils.daysAgo(p - 1);
      return { start, end: Date.now(), key: `${p}d`, label: `Last ${p} Days`, subtitle: `${new Date(start).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} – ${now.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}` };
    }
    if(p && typeof p === "object" && p.start !== undefined){
      return { ...p, key: p.key || "custom", subtitle: p.subtitle || `${new Date(p.start).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} – ${new Date(p.end).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}` };
    }

    const fmtMonth = (d) => d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
    const fmtDayRange = (s, e) => `${new Date(s).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} – ${new Date(e).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`;

    switch(p){
      case "today":
        return { start: todayStart, end: todayEnd, key: "today", label: "Today", subtitle: `Today · ${now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` };
      case "this_week":
        return { start: thisWeekStart, end: thisWeekEnd, key: "this_week", label: "This Week", subtitle: `This Week · ${fmtDayRange(thisWeekStart, thisWeekEnd)}` };
      case "last_week":
        return { start: lastWeekStart, end: lastWeekEnd, key: "last_week", label: "Last Week", subtitle: `Last Week · ${fmtDayRange(lastWeekStart, lastWeekEnd)}` };
      case "this_month":
        return { start: thisMonthStart, end: thisMonthEnd, key: "this_month", label: "This Month", subtitle: `This Month · ${fmtMonth(now)}` };
      case "last_month": {
        const lmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { start: lastMonthStart, end: lastMonthEnd, key: "last_month", label: "Last Month", subtitle: `Last Month · ${fmtMonth(lmDate)}` };
      }
      // (2026-07-13) Add 10-timeframe filter ranges (3m, 6m, years); was 5 ranges
      case "last_3m": {
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0).getTime();
        return { start, end: todayEnd, key: "last_3m", label: "Last 3 Months", subtitle: `Last 3 Months · ${fmtMonth(new Date(start))} – ${fmtMonth(now)}` };
      }
      case "last_6m": {
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0).getTime();
        return { start, end: todayEnd, key: "last_6m", label: "Last 6 Months", subtitle: `Last 6 Months · ${fmtMonth(new Date(start))} – ${fmtMonth(now)}` };
      }
      case "this_year": {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
        return { start, end, key: "this_year", label: "This Year", subtitle: `Year ${now.getFullYear()}` };
      }
      case "last_year": {
        const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime();
        return { start, end, key: "last_year", label: "Last Year", subtitle: `Year ${now.getFullYear() - 1}` };
      }
      case "all":
      default:
        return { start: 0, end: Date.now() + 86400000, key: "all", label: "All Time", subtitle: `All Time Records up to ${now.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}` };
    }
  }

  function inRange(ts, rangeParam){
    const r = getPeriodRange(rangeParam);
    return ts >= r.start && ts <= r.end;
  }

  function productCostMap(){
    const map = {};
    DB.getProducts().forEach(p => map[p.id] = p.cost);
    return map;
  }

  function sanitizeCategory(cat){
    if(!cat || typeof cat !== "string") return "Uncategorized";
    const trimmed = cat.trim();
    if(!trimmed || trimmed === "—" || trimmed === "-" || trimmed === "--") return "Uncategorized";
    return trimmed;
  }

  // (2026-07-13) Multi-business unit financial aggregation (4 businesses); was 2 units
  function computeStats(rangeParam){
    const r = getPeriodRange(rangeParam);
    const sales = DB.getSales().filter(s => s.ts >= r.start && s.ts <= r.end);
    const fuelSales = DB.getFuelSales().filter(s => s.ts >= r.start && s.ts <= r.end);
    const bookings = (DB.getBookings ? DB.getBookings() : []).filter(b => {
      const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
      return bTs >= r.start && bTs <= r.end;
    });
    const restBookings = (DB.getRestaurantBookings ? DB.getRestaurantBookings() : []).filter(b => {
      const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
      return bTs >= r.start && bTs <= r.end;
    });

    const products = DB.getProducts();
    const costMap = productCostMap();
    const fuelCfg = DB.getFuelConfig();

    // 1. Minimart
    const storeNetRevenue = sales.reduce((s,x)=> s + (x.total - (x.vat||0)), 0);
    const storeCOGS = sales.reduce((s,x)=> s + x.items.reduce((s2,l)=> s2 + (costMap[l.productId] ?? 0) * l.qty, 0), 0);
    const storeGrossProfit = Math.max(0, storeNetRevenue - storeCOGS);
    const storeTotal = sales.reduce((s,x)=>s+x.total,0);
    const storeTxCount = sales.length;

    // 2. Gasoline
    const fuelRevenue = fuelSales.reduce((s,x)=>s+x.amount,0);
    const fuelCOGS = fuelSales.reduce((s,x)=> s + (x.costPerL ?? fuelCfg.fuels[x.fuelType]?.cost ?? 65) * x.liters, 0);
    const fuelGrossProfit = Math.max(0, fuelRevenue - fuelCOGS);
    const fuelTotal = fuelRevenue;
    const fuelLiters = fuelSales.reduce((s,x)=>s+(x.liters||0),0);
    const fuelTxCount = fuelSales.length;

    // 3. Event Venue
    const venueRevenue = bookings.reduce((s,x)=>s+(Number(x.fee)||0),0);
    const venuePaid = bookings.reduce((s,x)=>s+(Number(x.paid)||0),0);
    const venueBalance = bookings.reduce((s,x)=>s+(Number(x.balance)||0),0);
    const venueCOGS = 0;
    const venueGrossProfit = venueRevenue;
    const venueTxCount = bookings.length;

    // 4. Restaurant
    const restRevenue = restBookings.reduce((s,x)=>s+(Number(x.spent||x.fee||x.paid||x.deposit||0)),0);
    const restCOGS = Utils.round2(restRevenue * 0.38);
    const restGrossProfit = Math.max(0, restRevenue - restCOGS);
    const restGuestCount = restBookings.reduce((s,x)=>s+(Number(x.pax)||1),0);
    const restTxCount = restBookings.length;

    // General Assets & Stock
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;
    const inventoryValue = products.reduce((s,p)=>s + p.cost*p.stock, 0);
    const potentialRevenue = products.reduce((s,p)=>s + (p.price||0)*(p.stock||0), 0);
    const txCount = storeTxCount + fuelTxCount + venueTxCount + restTxCount;

    // Expenses (OPEX + Tanker Logistics)
    const shrinkage = DB.getStockLog().filter(l => l.ts >= r.start && l.ts <= r.end && l.delta < 0 && l.reason !== "Restock / Delivery")
      .reduce((s,l) => s + Math.abs(l.delta) * (costMap[l.productId] ?? 0), 0);
    const opExpenses = (DB.getExpenses ? DB.getExpenses() : []).filter(e => e.ts >= r.start && e.ts <= r.end).reduce((s,x)=>s+(x.amount||0), 0);
    const fuelExpenses = (DB.getFuelDeliveries ? DB.getFuelDeliveries() : []).filter(d => d.ts >= r.start && d.ts <= r.end).reduce((s,x)=>s+(x.totalCost||0), 0);
    const totalOperatingExpenses = opExpenses + fuelExpenses;

    // Combined Executive P&L
    const netRevenue = storeNetRevenue + fuelRevenue + venueRevenue + restRevenue;
    const totalCOGS = storeCOGS + fuelCOGS + venueCOGS + restCOGS;
    const grossProfit = storeGrossProfit + fuelGrossProfit + venueGrossProfit + restGrossProfit;
    const netProfit = grossProfit - shrinkage - opExpenses;
    const margin = netRevenue > 0 ? (grossProfit/netRevenue)*100 : 0;
    const totalPurchases = restockSummary("all").totalCapitalSpent;

    return {
      periodRange: r, sales, fuelSales, bookings, restBookings, costMap,
      storeTotal, fuelTotal, venueRevenue, restRevenue,
      storeGrossProfit, fuelGrossProfit, venueGrossProfit, restGrossProfit,
      storeCOGS, fuelCOGS, venueCOGS, restCOGS,
      storeTxCount, fuelTxCount, venueTxCount, restTxCount,
      fuelLiters, venuePaid, venueBalance, restGuestCount,
      lowStock, outOfStock, inventoryValue, potentialRevenue, totalPurchases, txCount,
      totalOperatingExpenses, opExpenses, fuelExpenses,
      pl: { netRevenue, totalCOGS, grossProfit, shrinkage, netProfit, margin, storeGrossProfit, fuelGrossProfit, venueGrossProfit, restGrossProfit, storeNetRevenue, fuelRevenue, venueRevenue, restRevenue, storeCOGS, fuelCOGS, venueCOGS, restCOGS }
    };
  }

  // (2026-07-13) Synchronize trend buckets strictly with active range; was rolling days
  function computeTrendData(rangeParam){
    const r = getPeriodRange(rangeParam);
    const labels = [];
    const storeData = [];
    const fuelData = [];
    const venueData = [];
    const restData = [];
    const fuelLitersData = [];
    const profitData = [];
    const dayStarts = [];

    const bookings = DB.getBookings ? DB.getBookings() : [];
    const restBookings = DB.getRestaurantBookings ? DB.getRestaurantBookings() : [];
    const allSales = DB.getSales();
    const allFuel = DB.getFuelSales();
    const costMap = productCostMap();
    const fuelCfg = DB.getFuelConfig();

    const pKey = r.key;

    if(pKey === "today"){
      // 8 time slots across the 24 hours of today
      const baseDate = new Date(r.start);
      const hours = [6, 9, 12, 15, 18, 21, 24];
      let prevTs = r.start;
      for(let i = 0; i < hours.length; i++){
        const h = hours[i];
        const slotEnd = h === 24 ? r.end : new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, 0, 0, 0).getTime();
        const slotStart = prevTs;
        prevTs = slotEnd;

        dayStarts.push(slotStart);
        const labelText = h === 24 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
        labels.push(labelText);

        const sSum = allSales.filter(s => s.ts >= slotStart && s.ts < slotEnd).reduce((sum,x)=>sum+x.total,0);
        const fSum = allFuel.filter(s => s.ts >= slotStart && s.ts < slotEnd).reduce((sum,x)=>sum+x.amount,0);
        const fLit = allFuel.filter(s => s.ts >= slotStart && s.ts < slotEnd).reduce((sum,x)=>sum+(x.liters||0),0);
        const vSum = bookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= slotStart && bTs < slotEnd;
        }).reduce((sum,x)=>sum+(Number(x.fee)||0),0);
        const rSum = restBookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= slotStart && bTs < slotEnd;
        }).reduce((sum,x)=>sum+(Number(x.spent||x.fee||x.paid||x.deposit||0)),0);

        storeData.push(Utils.round2(sSum));
        fuelData.push(Utils.round2(fSum));
        venueData.push(Utils.round2(vSum));
        restData.push(Utils.round2(rSum));
        fuelLitersData.push(Utils.round2(fLit));
        profitData.push(Utils.round2((sSum * 0.25) + (fSum * 0.10) + vSum + (rSum * 0.62)));
      }
    } else if(pKey === "this_week" || pKey === "last_week"){
      // 7 day buckets for the exact week
      for(let i = 0; i < 7; i++){
        const dStart = r.start + (i * 86400000);
        const dEnd = dStart + 86400000;
        dayStarts.push(dStart);
        labels.push(new Date(dStart).toLocaleDateString("en-PH", { weekday: "short", month: "numeric", day: "numeric" }));

        const sSum = allSales.filter(s => s.ts >= dStart && s.ts < dEnd).reduce((sum,x)=>sum+x.total,0);
        const fSum = allFuel.filter(s => s.ts >= dStart && s.ts < dEnd).reduce((sum,x)=>sum+x.amount,0);
        const fLit = allFuel.filter(s => s.ts >= dStart && s.ts < dEnd).reduce((sum,x)=>sum+(x.liters||0),0);
        const vSum = bookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= dStart && bTs < dEnd;
        }).reduce((sum,x)=>sum+(Number(x.fee)||0),0);
        const rSum = restBookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= dStart && bTs < dEnd;
        }).reduce((sum,x)=>sum+(Number(x.spent||x.fee||x.paid||x.deposit||0)),0);

        storeData.push(Utils.round2(sSum));
        fuelData.push(Utils.round2(fSum));
        venueData.push(Utils.round2(vSum));
        restData.push(Utils.round2(rSum));
        fuelLitersData.push(Utils.round2(fLit));
        profitData.push(Utils.round2((sSum * 0.25) + (fSum * 0.10) + vSum + (rSum * 0.62)));
      }
    } else if(pKey === "this_month" || pKey === "last_month"){
      // Days of the month
      const sDate = new Date(r.start);
      const eDate = new Date(r.end);
      const totalDays = eDate.getDate();

      for(let day = 1; day <= totalDays; day++){
        const dStart = new Date(sDate.getFullYear(), sDate.getMonth(), day, 0, 0, 0, 0).getTime();
        const dEnd = new Date(sDate.getFullYear(), sDate.getMonth(), day, 23, 59, 59, 999).getTime();
        dayStarts.push(dStart);
        labels.push(new Date(dStart).toLocaleDateString("en-PH", { month: "short", day: "numeric" }));

        const sSum = allSales.filter(s => s.ts >= dStart && s.ts <= dEnd).reduce((sum,x)=>sum+x.total,0);
        const fSum = allFuel.filter(s => s.ts >= dStart && s.ts <= dEnd).reduce((sum,x)=>sum+x.amount,0);
        const fLit = allFuel.filter(s => s.ts >= dStart && s.ts <= dEnd).reduce((sum,x)=>sum+(x.liters||0),0);
        const vSum = bookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= dStart && bTs <= dEnd;
        }).reduce((sum,x)=>sum+(Number(x.fee)||0),0);
        const rSum = restBookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= dStart && bTs <= dEnd;
        }).reduce((sum,x)=>sum+(Number(x.spent||x.fee||x.paid||x.deposit||0)),0);

        storeData.push(Utils.round2(sSum));
        fuelData.push(Utils.round2(fSum));
        venueData.push(Utils.round2(vSum));
        restData.push(Utils.round2(rSum));
        fuelLitersData.push(Utils.round2(fLit));
        profitData.push(Utils.round2((sSum * 0.25) + (fSum * 0.10) + vSum + (rSum * 0.62)));
      }
    } else {
      // All Time or custom days
      const daysCount = 14;
      for(let i = daysCount - 1; i >= 0; i--){
        const dStart = Utils.daysAgo(i);
        const dEnd = dStart + 86400000;
        dayStarts.push(dStart);
        labels.push(new Date(dStart).toLocaleDateString("en-PH", { month: "short", day: "numeric" }));

        const sSum = allSales.filter(s => s.ts >= dStart && s.ts < dEnd).reduce((sum,x)=>sum+x.total,0);
        const fSum = allFuel.filter(s => s.ts >= dStart && s.ts < dEnd).reduce((sum,x)=>sum+x.amount,0);
        const fLit = allFuel.filter(s => s.ts >= dStart && s.ts < dEnd).reduce((sum,x)=>sum+(x.liters||0),0);
        const vSum = bookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= dStart && bTs < dEnd;
        }).reduce((sum,x)=>sum+(Number(x.fee)||0),0);
        const rSum = restBookings.filter(b => {
          const bTs = typeof b.date === "string" ? new Date(b.date + "T00:00:00").getTime() : (b.ts || new Date(b.date).getTime());
          return bTs >= dStart && bTs < dEnd;
        }).reduce((sum,x)=>sum+(Number(x.spent||x.fee||x.paid||x.deposit||0)),0);

        storeData.push(Utils.round2(sSum));
        fuelData.push(Utils.round2(fSum));
        venueData.push(Utils.round2(vSum));
        restData.push(Utils.round2(rSum));
        fuelLitersData.push(Utils.round2(fLit));
        profitData.push(Utils.round2((sSum * 0.25) + (fSum * 0.10) + vSum + (rSum * 0.62)));
      }
    }

    const totalRev = storeData.reduce((a,b)=>a+b,0) + fuelData.reduce((a,b)=>a+b,0) + venueData.reduce((a,b)=>a+b,0) + restData.reduce((a,b)=>a+b,0);
    const hasData = totalRev > 0;

    return {
      labels,
      storeData,
      fuelData,
      venueData,
      restData,
      fuelLitersData,
      profitData,
      dayStarts,
      hasData,
      totalRev: Utils.round2(totalRev)
    };
  }

  // Backwards compatibility alias for older calls
  function salesTrendData(rangeDays){
    return computeTrendData(rangeDays);
  }

  // (2026-07-13) Fix uncategorized product labeling; was dash placeholder
  function topSellers(stats, limit = 100){
    const map = {};
    stats.sales.forEach(s => s.items.forEach(l => {
      const cat = sanitizeCategory(l.category);
      if(!map[l.productId]) map[l.productId] = { productId:l.productId, name:l.name, category:cat, units:0, revenue:0 };
      map[l.productId].units += l.qty;
      map[l.productId].revenue += l.price*l.qty;
    }));
    return Object.values(map).map(row => {
      const cost = stats.costMap[row.productId] ?? 0;
      const cogs = cost * row.units;
      const profit = row.revenue - cogs;
      return { ...row, revenue:Utils.round2(row.revenue), profit:Utils.round2(profit), margin: row.revenue>0 ? (profit/row.revenue)*100 : 0 };
    }).sort((a,b)=>b.revenue-a.revenue).slice(0,limit);
  }

  // (2026-07-13) Map product categories from catalog fallback; was empty on missing item tag
  function categoryPL(stats){
    const prods = DB.getProducts() || [];
    const prodCatMap = {};
    prods.forEach(p => { if(p.id) prodCatMap[p.id] = p.category; });
    const map = {};
    (stats.sales || []).forEach(s => {
      (s.items || s.lines || []).forEach(l => {
        const rawCat = l.category || prodCatMap[l.productId] || "GENERAL";
        const cat = sanitizeCategory(rawCat);
        if(!map[cat]) map[cat] = { category:cat, revenue:0, cogs:0 };
        const price = Number(l.price) || 0;
        const qty = Number(l.qty) || 1;
        map[cat].revenue += price * qty;
        map[cat].cogs += (stats.costMap?.[l.productId] ?? 0) * qty;
      });
    });
    if(Object.keys(map).length === 0 && prods.length > 0){
      prods.forEach(p => {
        const cat = sanitizeCategory(p.category || "GENERAL");
        if(!map[cat]) map[cat] = { category:cat, revenue:0, cogs:0 };
        const val = (Number(p.price) || 0) * (Number(p.pieceStock ?? p.stock) || 1);
        map[cat].revenue += val;
      });
    }
    return Object.values(map).map(c => ({ ...c, revenue:Utils.round2(c.revenue), profit:Utils.round2(c.revenue-c.cogs) })).sort((a,b)=>b.revenue-a.revenue);
  }

  function paymentBreakdown(stats){
    const map = {};
    [...stats.sales, ...stats.fuelSales].forEach(s => {
      const amt = s.total ?? s.amount;
      map[s.method] = (map[s.method]||0) + amt;
    });
    return map;
  }

  // (2026-07-13) Implement transactionsOnDay day drilldown filter; was undefined
  function transactionsOnDay(dayStart){
    const dayEnd = dayStart + 86400000;
    return {
      store: DB.getSales().filter(s => s.ts >= dayStart && s.ts < dayEnd),
      fuel: DB.getFuelSales().filter(s => s.ts >= dayStart && s.ts < dayEnd)
    };
  }

  // (2026-07-13) Aggregate purchase expenses and restock logs with range; was static
  function restockSummary(period = "all"){
    const logs = DB.getRestockLogs();
    const r = getPeriodRange(period);
    const filtered = logs.filter(l => {
      const ts = l.timestamp || l.ts || 0;
      return ts >= r.start && ts <= r.end;
    });
    const totalCapitalSpent = filtered.reduce((sum, l) => sum + (l.total_cost || 0), 0);
    const totalUnitsPurchased = filtered.reduce((sum, l) => sum + (l.quantity_added || 0), 0);
    return {
      totalCapitalSpent: Utils.round2(totalCapitalSpent),
      totalUnitsPurchased,
      count: filtered.length,
      logs: filtered
    };
  }

  // (2026-07-13) Export computeTrendData & helpers; was salesTrendData only
  return { getPeriodRange, computeStats, computeTrendData, salesTrendData, topSellers, categoryPL, paymentBreakdown, transactionsOnDay, productCostMap, restockSummary, sanitizeCategory };
})();
