// ============================================================
// restaurant.js — Restaurant Dining Table Booking & Tape Chart (Admin)
// ============================================================
const Restaurant = (() => {
  // (2026-07-13) Create restaurant table booking & tape chart; was not present
  let viewMode = "week"; // week | tape | list
  let currentAnchorDate = new Date();
  let selectedTableFilter = "All";

  // Drag selection state for time slot creation
  let isDragging = false;
  let dragDate = "";
  let dragStartH = null;
  let dragEndH = null;
  let dragTable = "";

  function getTodayStr(){
    return new Date().toISOString().split("T")[0];
  }

  function fmtPHTDate(d){
    if(!d) return "—";
    const date = typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function getStartOfWeek(d){
    const date = new Date(d);
    const day = date.getDay(); // 0 = Sunday
    const diff = date.getDate() - day;
    const start = new Date(date.setDate(diff));
    start.setHours(0,0,0,0);
    return start;
  }

  const DINING_TABLES = [
    "Table 1 (2-4 Pax) - Indoor",
    "Table 2 (2-4 Pax) - Indoor",
    "Table 3 (4-6 Pax) - Indoor",
    "Family Table 4 (8-10 Pax)",
    "Alfresco Garden Table A1",
    "Alfresco Garden Table A2",
    "Poolside Dining Table P1",
    "VIP Private Dining Room 1",
    "VIP Private Dining Room 2",
    "Bar Lounge High Table"
  ];

  const MEAL_TYPES = [
    "Dinner Service",
    "Lunch Service",
    "Breakfast / Brunch",
    "Afternoon Snacks & Coffee",
    "Late Night Drinks / Pulutan",
    "Special Dining Celebration"
  ];

  // Hours 8:00 AM to 12:00 AM (Midnight)
  const HOURS = [
    { h: 8,  label: "8am",  full: "8:00 AM",  val: "08:00" },
    { h: 9,  label: "9am",  full: "9:00 AM",  val: "09:00" },
    { h: 10, label: "10am", full: "10:00 AM", val: "10:00" },
    { h: 11, label: "11am", full: "11:00 AM", val: "11:00" },
    { h: 12, label: "12pm", full: "12:00 PM", val: "12:00" },
    { h: 13, label: "1pm",  full: "1:00 PM",  val: "13:00" },
    { h: 14, label: "2pm",  full: "2:00 PM",  val: "14:00" },
    { h: 15, label: "3pm",  full: "3:00 PM",  val: "15:00" },
    { h: 16, label: "4pm",  full: "4:00 PM",  val: "16:00" },
    { h: 17, label: "5pm",  full: "5:00 PM",  val: "17:00" },
    { h: 18, label: "6pm",  full: "6:00 PM",  val: "18:00" },
    { h: 19, label: "7pm",  full: "7:00 PM",  val: "19:00" },
    { h: 20, label: "8pm",  full: "8:00 PM",  val: "20:00" },
    { h: 21, label: "9pm",  full: "9:00 PM",  val: "21:00" },
    { h: 22, label: "10pm", full: "10:00 PM", val: "22:00" },
    { h: 23, label: "11pm", full: "11:00 PM", val: "23:00" },
    { h: 24, label: "12am", full: "12:00 AM (Mid)", val: "24:00" }
  ];

  function openBookingModal(booking = null, prefillDate = "", prefillStartHour = "12:00", prefillTable = "", prefillEndHour = ""){
    const isEdit = !!booking;
    const today = getTodayStr();
    const curDate = booking ? booking.date : (prefillDate && prefillDate >= today ? prefillDate : today);

    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <!-- Section 1: Guest & Table Details -->
        <div class="card card-tight" style="padding:14px 16px;background:var(--paper-dim);border:1px solid var(--line);border-radius:12px;margin:0;">
          <div style="display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:850;color:var(--brand-deep);margin-bottom:10px;">
            ${Icons.get("user",{size:16})} Guest Information & Table Assignment
          </div>
          <div class="input-row" style="margin-bottom:10px;">
            <div class="field" style="margin-bottom:0;flex:1.4;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Lead Guest Full Name</label>
              <input class="input font-bold" id="rbk-guest" placeholder="e.g. Juan dela Cruz" value="${booking ? Utils.escapeHtml(booking.guestName) : ""}" autofocus>
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Contact Mobile</label>
              <input class="input font-bold" id="rbk-phone" placeholder="09XX-XXX-XXXX" value="${booking ? Utils.escapeHtml(booking.phone || "") : ""}">
            </div>
            <div class="field" style="margin-bottom:0;width:90px;flex:none;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Guest Pax</label>
              <input class="input font-bold mono text-center" id="rbk-pax" type="number" min="1" max="50" value="${booking ? booking.pax : "4"}" style="font-size:1.10rem;">
            </div>
          </div>
          <div class="input-row">
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Table / Dining Area</label>
              <div id="rbk-table-wrap"></div>
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Dining Service / Event</label>
              <div id="rbk-meal-wrap"></div>
            </div>
          </div>
        </div>

        <!-- Section 2: Date & Dining Time -->
        <div class="card card-tight" style="padding:14px 16px;background:var(--paper-dim);border:1px solid var(--line);border-radius:12px;margin:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:850;color:var(--brand-deep);">
              ${Icons.get("calendar",{size:16})} Reservation Time (8:00 AM – 12:00 AM PHT)
            </div>
            <span id="rbk-duration-tag" class="badge badge-brand font-bold" style="font-size:.82rem;padding:3px 8px;">2 Hours Dining</span>
          </div>
          <div class="input-row">
            <div class="field" style="margin-bottom:0;flex:1.2;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Reservation Date (PHT)</label>
              <input class="input font-bold" id="rbk-date" type="date" min="${today}" value="${curDate}">
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Seating Time</label>
              <div id="rbk-start-wrap"></div>
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Departure Time</label>
              <div id="rbk-end-wrap"></div>
            </div>
          </div>
        </div>

        <!-- Section 3: Deposit & Status -->
        <div class="card card-tight" style="padding:14px 16px;background:var(--paper-dim);border:1px solid var(--line);border-radius:12px;margin:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:850;color:var(--brand-deep);">
              ${Icons.get("wallet",{size:16})} Table Deposit & Status
            </div>
          </div>
          <div class="input-row" style="margin-bottom:10px;">
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Advance Deposit (₱)</label>
              <input class="input mono font-bold" id="rbk-deposit" type="number" min="0" step="50" placeholder="0.00" value="${booking ? booking.deposit : "0"}" style="font-size:1.15rem;">
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Payment Method</label>
              <div id="rbk-method-wrap"></div>
            </div>
            <div class="field" style="margin-bottom:0;">
              <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;">Booking Status</label>
              <div id="rbk-status-wrap"></div>
            </div>
          </div>
        </div>

        <!-- Section 4: Special Dietary Requests -->
        <div class="field" style="margin-bottom:0;">
          <label style="font-size:.80rem;font-weight:750;color:var(--ink-soft);text-transform:none;display:flex;align-items:center;gap:6px;">
            ${Icons.get("clipboard",{size:15})} Dietary Preferences / Food Orders / High Chair Requests
          </label>
          <textarea class="input" id="rbk-requests" rows="2" placeholder="e.g. 1 baby high chair, birthday greeting cake prep, no onions in order">${booking ? Utils.escapeHtml(booking.specialRequests || "") : ""}</textarea>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("utensils",{size:18})} ${isEdit ? "Edit Table Reservation" : "New Table Reservation"}`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { label: isEdit ? "Save Changes" : "Confirm Reservation", cls: "btn-primary btn-lg", onClick: () => {
          const guestName = (modal.querySelector("#rbk-guest").value || "").trim();
          if(!guestName){ Utils.toast("Please enter the guest's name.", "warn"); return; }
          const phone = (modal.querySelector("#rbk-phone").value || "").trim();
          const pax = Number(modal.querySelector("#rbk-pax").value) || 2;
          const tableName = UISelect.getValue("rbk-table") || DINING_TABLES[0];
          const mealType = UISelect.getValue("rbk-meal") || MEAL_TYPES[0];
          const date = modal.querySelector("#rbk-date").value;
          if(!date || date < today){
            Utils.toast("Please select today or a future date.", "warn");
            return;
          }
          const startTime = UISelect.getValue("rbk-start") || "12:00";
          const endTime = UISelect.getValue("rbk-end") || "14:00";
          const deposit = Number(modal.querySelector("#rbk-deposit").value) || 0;
          const method = UISelect.getValue("rbk-method") || "Cash";
          const status = UISelect.getValue("rbk-status") || "Confirmed";
          const specialRequests = (modal.querySelector("#rbk-requests").value || "").trim();

          const payload = {
            guestName, phone, pax, tableName, mealType, date,
            startTime, endTime, deposit, method, status, specialRequests
          };

          if(isEdit){
            DB.updateRestaurantBooking(booking.id, payload);
            Utils.toast("Reservation updated.", "success");
          } else {
            DB.addRestaurantBooking(payload);
            Utils.Sound.cashChime();
            Utils.toast(`Table reserved for ${guestName} (${pax} pax)!`, "success");
          }

          currentAnchorDate = new Date(date + "T00:00:00");
          Modal.close();
          render();
        }}
      ]
    });

    modal.querySelector("#rbk-table-wrap").innerHTML = UISelect.render("rbk-table", DINING_TABLES, booking?.tableName || prefillTable || DINING_TABLES[0]);
    UISelect.bind("rbk-table");

    modal.querySelector("#rbk-meal-wrap").innerHTML = UISelect.render("rbk-meal", MEAL_TYPES, booking?.mealType || MEAL_TYPES[0]);
    UISelect.bind("rbk-meal");

    const timeOptions = HOURS.map(h => ({ value: h.val, label: h.full }));
    modal.querySelector("#rbk-start-wrap").innerHTML = UISelect.render("rbk-start", timeOptions, booking?.startTime || prefillStartHour);
    UISelect.bind("rbk-start", () => updateModalStats(modal));

    let defaultEndVal = prefillEndHour;
    if(!defaultEndVal){
      const startHNum = parseInt((booking?.startTime || prefillStartHour).split(":")[0], 10);
      const endHourNum = Math.min(24, startHNum + 2);
      defaultEndVal = `${String(endHourNum).padStart(2,"0")}:00`;
    }
    modal.querySelector("#rbk-end-wrap").innerHTML = UISelect.render("rbk-end", timeOptions, booking?.endTime || defaultEndVal);
    UISelect.bind("rbk-end", () => updateModalStats(modal));

    modal.querySelector("#rbk-method-wrap").innerHTML = UISelect.render("rbk-method", ["Cash","GCash","Bank Transfer","Card"], booking?.method || "Cash");
    UISelect.bind("rbk-method");

    modal.querySelector("#rbk-status-wrap").innerHTML = UISelect.render("rbk-status", ["Confirmed","Seated","Reserved (Deposit)","Completed","Cancelled"], booking?.status || "Confirmed");
    UISelect.bind("rbk-status");

    function updateModalStats(m){
      const sH = parseInt((UISelect.getValue("rbk-start") || "12:00").split(":")[0], 10);
      const eH = parseInt((UISelect.getValue("rbk-end") || "14:00").split(":")[0], 10);
      const dur = Math.max(1, eH - sH);
      const durTag = m.querySelector("#rbk-duration-tag");
      if(durTag){
        durTag.textContent = `${dur} Hour${dur===1?"":"s"} Dining`;
      }
    }
    updateModalStats(modal);
  }

  function deleteBookingConfirm(b){
    Modal.confirm({
      title: "Cancel & Delete Reservation?",
      message: `Permanently remove reservation for ${Utils.escapeHtml(b.guestName)} on ${fmtPHTDate(b.date)}?`,
      danger: true,
      onConfirm: () => {
        DB.deleteRestaurantBooking(b.id);
        Utils.toast("Reservation removed.", "success");
        render();
      }
    });
  }

  function render(){
    const view = document.getElementById("view-root");
    const today = getTodayStr();
    const allBookings = DB.getRestaurantBookings();

    const weekStart = getStartOfWeek(currentAnchorDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekRangeLabel = `${fmtPHTDate(weekStart)} – ${fmtPHTDate(weekEnd)}`;

    const weekDays = [];
    for(let i=0; i<7; i++){
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      weekDays.push({
        date: d,
        iso,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday: iso === today,
        isPast: iso < today
      });
    }

    const weekBookings = allBookings.filter(b => {
      const matchTable = selectedTableFilter === "All" || b.tableName === selectedTableFilter;
      return b.date >= weekDays[0].iso && b.date <= weekDays[6].iso && b.status !== "Cancelled" && matchTable;
    });

    const totalPax = weekBookings.reduce((s,b) => s + (b.pax || 0), 0);
    const totalDeposits = weekBookings.reduce((s,b) => s + (b.deposit || 0), 0);

    view.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <div class="view-head" style="margin-bottom:8px;">
          <div>
            <h2>${Icons.get("utensils",{size:22})} Restaurant Table Booking</h2>
            <div class="view-sub">Dining reservations, guest headcount & table tape chart · Philippine Time</div>
          </div>
          <div class="input-row" style="width:auto;">
            <button class="btn btn-outline" id="btn-export-rbk">${Icons.get("download",{size:15})} Export Bookings</button>
            <button class="btn btn-primary" id="btn-new-rbooking">${Icons.get("plus",{size:16})} New Table Reservation</button>
          </div>
        </div>

        <!-- Top Control Bar -->
        <div class="card" style="margin-bottom:10px;background:var(--paper-dim);border:1.5px solid var(--line);padding:8px 16px;border-radius:12px;flex-shrink:0;">
          <div class="flex-between" style="flex-wrap:wrap;gap:10px;">
            <!-- Left: Nav Controls -->
            <div style="display:flex;align-items:center;gap:6px;">
              <button class="btn btn-sm btn-outline font-bold" id="btn-rnav-today" style="border-radius:8px;padding:6px 14px;">Today</button>
              <div style="display:flex;gap:2px;">
                <button class="btn btn-sm btn-ghost" id="btn-rnav-prev" title="Previous week" style="padding:6px 8px;">${Icons.get("chevron-left",{size:16})}</button>
                <button class="btn btn-sm btn-ghost" id="btn-rnav-next" title="Next week" style="padding:6px 8px;"><span style="display:inline-flex;transform:rotate(180deg);">${Icons.get("chevron-left",{size:16})}</span></button>
              </div>
              <strong style="font-size:1.18rem;color:var(--ink);margin-left:6px;font-family:var(--font-mono);">${weekRangeLabel}</strong>
            </div>

            <!-- Middle: Table Filter -->
            <div style="width:230px;" id="rest-table-filter-wrap"></div>

            <!-- Right: View Mode Toggle Tabs -->
            <div style="display:flex;gap:4px;background:var(--paper-raised);padding:3px;border-radius:10px;border:1px solid var(--line-strong);">
              <button class="chip ${viewMode==="week"?"active":""}" id="tab-rv-week" style="margin:0;border:none;border-radius:8px;font-size:.82rem;padding:5px 12px;">${Icons.get("calendar",{size:13})} Week Calendar</button>
              <button class="chip ${viewMode==="tape"?"active":""}" id="tab-rv-tape" style="margin:0;border:none;border-radius:8px;font-size:.82rem;padding:5px 12px;">${Icons.get("clipboard",{size:13})} Table Tape Chart</button>
              <button class="chip ${viewMode==="list"?"active":""}" id="tab-rv-list" style="margin:0;border:none;border-radius:8px;font-size:.82rem;padding:5px 12px;">${Icons.get("tag",{size:13})} All Reservations</button>
            </div>
          </div>
        </div>

        <!-- Quick Metrics -->
        <div class="grid-3" style="margin-bottom:10px;gap:10px;flex-shrink:0;">
          <div class="card card-tight" style="border:1.5px solid var(--brand);background:var(--brand-tint);padding:10px 16px;border-radius:10px;">
            <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;color:var(--brand-deep);margin-bottom:2px;">Table Bookings (This Week)</div>
            <strong class="mono font-bold" style="font-size:1.45rem;color:var(--brand-deep);">${weekBookings.length} booking(s)</strong>
          </div>
          <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:10px 16px;border-radius:10px;">
            <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;margin-bottom:2px;">Total Expected Guests</div>
            <strong class="mono font-bold" style="font-size:1.45rem;color:var(--ink);">${totalPax} Guests</strong>
          </div>
          <div class="card card-tight" style="border:1.5px solid var(--success-deep);background:var(--success-tint);padding:10px 16px;border-radius:10px;">
            <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;color:var(--success-deep);margin-bottom:2px;">Advance Deposits Held</div>
            <strong class="mono font-bold" style="font-size:1.45rem;color:var(--success-deep);">${Utils.money(totalDeposits)}</strong>
          </div>
        </div>

        <!-- Scrollable Main Viewport -->
        <div id="rest-scroll-wrapper" style="flex:1;min-height:0;overflow-y:auto;overflow-x:auto;border:1.5px solid var(--line);border-radius:14px;background:var(--paper-raised);">
          ${viewMode === "week"
            ? renderWeekCalendar(weekDays, weekBookings, today)
            : viewMode === "tape"
            ? renderTableTapeChart(weekDays, allBookings, today)
            : renderBookingsList(allBookings)
          }
        </div>
      </div>
    `;

    document.getElementById("btn-new-rbooking").onclick = () => openBookingModal();
    document.getElementById("btn-export-rbk").onclick = exportBookingsCSV;

    document.getElementById("tab-rv-week").onclick = () => { viewMode = "week"; render(); };
    document.getElementById("tab-rv-tape").onclick = () => { viewMode = "tape"; render(); };
    document.getElementById("tab-rv-list").onclick = () => { viewMode = "list"; render(); };

    document.getElementById("btn-rnav-today").onclick = () => {
      currentAnchorDate = new Date();
      render();
    };

    document.getElementById("btn-rnav-prev").onclick = () => {
      const d = new Date(currentAnchorDate);
      d.setDate(d.getDate() - 7);
      currentAnchorDate = d;
      render();
    };

    document.getElementById("btn-rnav-next").onclick = () => {
      const d = new Date(currentAnchorDate);
      d.setDate(d.getDate() + 7);
      currentAnchorDate = d;
      render();
    };

    document.getElementById("rest-table-filter-wrap").innerHTML = UISelect.render("r-tbl-filter", ["All Tables", ...DINING_TABLES], selectedTableFilter === "All" ? "All Tables" : selectedTableFilter);
    UISelect.bind("r-tbl-filter", (val) => {
      selectedTableFilter = val === "All Tables" ? "All" : val;
      render();
    });

    bindDragSelection();

    view.querySelectorAll("[data-open-rbooking]").forEach(block => {
      block.onclick = (e) => {
        e.stopPropagation();
        const b = DB.getRestaurantBookings().find(x => x.id === block.dataset.openRbooking);
        if(b) openBookingModal(b);
      };
    });

    view.querySelectorAll("[data-edit-rbooking]").forEach(btn => {
      btn.onclick = () => {
        const b = DB.getRestaurantBookings().find(x => x.id === btn.dataset.editRbooking);
        if(b) openBookingModal(b);
      };
    });

    view.querySelectorAll("[data-del-rbooking]").forEach(btn => {
      btn.onclick = () => {
        const b = DB.getRestaurantBookings().find(x => x.id === btn.dataset.delRbooking);
        if(b) deleteBookingConfirm(b);
      };
    });
  }

  function bindDragSelection(){
    const scrollWrap = document.getElementById("rest-scroll-wrapper");
    if(!scrollWrap) return;

    function updateHighlight(){
      if(!isDragging || !dragDate || dragStartH === null || dragEndH === null) return;
      const minH = Math.min(dragStartH, dragEndH);
      const maxH = Math.max(dragStartH, dragEndH);
      const midH = Math.floor((minH + maxH) / 2);
      const dur = (maxH - minH) + 1;
      const startObj = HOURS.find(x => x.h === minH) || { label: `${minH}:00` };
      const endObj = HOURS.find(x => x.h === maxH + 1) || { label: `${maxH+1}:00` };

      scrollWrap.querySelectorAll(".venue-cell-slot").forEach(cell => {
        if(cell.dataset.date === dragDate){
          const h = parseInt(cell.dataset.hour.split(":")[0], 10);
          if(h >= minH && h <= maxH){
            cell.classList.add("slot-drag-highlight");
            cell.classList.remove("slot-drag-first", "slot-drag-mid", "slot-drag-last", "slot-drag-single");

            if(minH === maxH){
              cell.classList.add("slot-drag-single");
            } else if(h === minH){
              cell.classList.add("slot-drag-first");
            } else if(h === maxH){
              cell.classList.add("slot-drag-last");
            } else {
              cell.classList.add("slot-drag-mid");
            }

            const hint = cell.querySelector(".slot-hover-hint");
            if(hint){
              if(h === midH){
                hint.style.opacity = "1";
                hint.innerHTML = `<span class="badge badge-brand font-bold mono" style="font-size:.82rem;padding:4px 10px;box-shadow:var(--shadow-md);background:var(--brand);color:#fff;">${startObj.label} – ${endObj.label} (${dur}h)</span>`;
              } else {
                hint.style.opacity = "0";
                hint.innerHTML = "";
              }
            }
          } else {
            cell.classList.remove("slot-drag-highlight", "slot-drag-first", "slot-drag-mid", "slot-drag-last", "slot-drag-single");
            const hint = cell.querySelector(".slot-hover-hint");
            if(hint){
              hint.style.opacity = "0";
              hint.innerHTML = `<span style="font-size:.72rem;font-weight:800;color:var(--brand);background:var(--brand-tint);padding:2px 6px;border-radius:4px;">+ Drag</span>`;
            }
          }
        } else {
          cell.classList.remove("slot-drag-highlight", "slot-drag-first", "slot-drag-mid", "slot-drag-last", "slot-drag-single");
          const hint = cell.querySelector(".slot-hover-hint");
          if(hint){
            hint.style.opacity = "0";
            hint.innerHTML = `<span style="font-size:.72rem;font-weight:800;color:var(--brand);background:var(--brand-tint);padding:2px 6px;border-radius:4px;">+ Drag</span>`;
          }
        }
      });
    }

    function clearHighlight(){
      scrollWrap.querySelectorAll(".venue-cell-slot").forEach(c => {
        c.classList.remove("slot-drag-highlight", "slot-drag-first", "slot-drag-mid", "slot-drag-last", "slot-drag-single");
        const hint = c.querySelector(".slot-hover-hint");
        if(hint){
          hint.style.opacity = "0";
          hint.innerHTML = `<span style="font-size:.72rem;font-weight:800;color:var(--brand);background:var(--brand-tint);padding:2px 6px;border-radius:4px;">+ Drag</span>`;
        }
      });
    }

    // (2026-07-13) Touch & mouse table chart drag selection with passive:false; was mouse only
    scrollWrap.querySelectorAll(".venue-cell-slot").forEach(cell => {
      cell.addEventListener("mousedown", (e) => {
        if(e.button !== 0) return;
        if(cell.dataset.past === "true") return;
        isDragging = true;
        dragDate = cell.dataset.date;
        dragStartH = parseInt(cell.dataset.hour.split(":")[0], 10);
        dragEndH = dragStartH;
        dragTable = cell.dataset.table || "";
        updateHighlight();
      });

      cell.addEventListener("mouseenter", () => {
        if(!isDragging) return;
        if(cell.dataset.date !== dragDate) return;
        dragEndH = parseInt(cell.dataset.hour.split(":")[0], 10);
        updateHighlight();
      });

      cell.addEventListener("touchstart", (e) => {
        if(cell.dataset.past === "true" || e.touches.length > 1) return;
        e.preventDefault();
        isDragging = true;
        dragDate = cell.dataset.date;
        dragStartH = parseInt(cell.dataset.hour.split(":")[0], 10);
        dragEndH = dragStartH;
        dragTable = cell.dataset.table || "";
        updateHighlight();
      }, { passive: false });
    });

    const handleMouseUp = () => {
      if(isDragging){
        isDragging = false;
        if(dragDate && dragStartH !== null){
          const minH = Math.min(dragStartH, dragEndH !== null ? dragEndH : dragStartH);
          const maxH = Math.max(dragStartH, dragEndH !== null ? dragEndH : dragStartH);
          const startVal = `${String(minH).padStart(2,"0")}:00`;
          const endVal = `${String(Math.min(24, maxH + 1)).padStart(2,"0")}:00`;
          clearHighlight();
          openBookingModal(null, dragDate, startVal, dragTable, endVal);
        }
        clearHighlight();
        dragDate = "";
        dragStartH = null;
        dragEndH = null;
      }
    };

    const handleTouchMove = (e) => {
      if(!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const slot = target ? target.closest(".venue-cell-slot") : null;
      if(slot && slot.dataset.date === dragDate){
        dragEndH = parseInt(slot.dataset.hour.split(":")[0], 10);
        updateHighlight();
      }
    };

    window.removeEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseup", handleMouseUp);
    window.removeEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.removeEventListener("touchend", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp, { passive: false });
  }

  function renderWeekCalendar(weekDays, weekBookings, today){
    return `
      <table style="width:100%;min-width:880px;border-collapse:collapse;table-layout:fixed;">
        <thead>
          <tr style="border-bottom:1.5px solid var(--line-strong);">
            <th style="width:75px;padding:12px 8px;text-align:center;font-size:.74rem;color:var(--ink-faint);border-right:1.5px solid var(--line);font-family:var(--font-mono);font-weight:800;position:sticky;top:0;left:0;z-index:20;background:var(--paper-dim);">
              PHT<br>GMT+8
            </th>
            ${weekDays.map(d => `
              <th style="padding:10px 8px;text-align:center;border-right:1px solid var(--line);position:sticky;top:0;z-index:10;background:${d.isToday?"var(--brand-tint)":"var(--paper-dim)"};">
                <div style="font-size:.78rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase;">${d.dayName}</div>
                <div style="font-size:1.35rem;font-weight:900;color:${d.isToday?"var(--brand-deep)":d.isPast?"var(--ink-faint)":"var(--ink)"};">
                  ${d.dayNum}
                  ${d.isToday ? `<span class="badge badge-brand" style="font-size:.65rem;padding:1px 5px;margin-left:2px;vertical-align:middle;">Today</span>` : ""}
                </div>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${HOURS.slice(0, HOURS.length - 1).map(hourObj => {
            const hourNum = hourObj.h;
            return `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:10px 8px;text-align:right;font-size:.82rem;font-family:var(--font-mono);font-weight:800;color:var(--ink-soft);background:var(--paper-dim);border-right:1.5px solid var(--line);vertical-align:top;user-select:none;position:sticky;left:0;z-index:5;">
                  ${hourObj.label}
                </td>
                ${weekDays.map(d => {
                  const bookingAtHour = weekBookings.find(b => {
                    if(b.date !== d.iso) return false;
                    const startH = parseInt(b.startTime.split(":")[0], 10);
                    const endH = parseInt(b.endTime.split(":")[0], 10);
                    return hourNum >= startH && hourNum < endH;
                  });

                  if(bookingAtHour){
                    const startH = parseInt(bookingAtHour.startTime.split(":")[0], 10);
                    const isStartHour = (startH === hourNum);
                    if(isStartHour){
                      const endH = parseInt(bookingAtHour.endTime.split(":")[0], 10);
                      const durationHours = Math.max(1, endH - startH);
                      return `
                        <td rowspan="${durationHours}" style="padding:4px;border-right:1px solid var(--line);vertical-align:top;background:${d.isToday?"var(--brand-tint)":"transparent"};">
                          <div class="venue-booking-tape-card" data-open-rbooking="${bookingAtHour.id}" style="height:100%;min-height:${durationHours*42}px;background:linear-gradient(135deg, var(--brand-deep), #2A4590);color:#fff;border-radius:8px;padding:8px 10px;box-shadow:var(--shadow-sm);cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;transition:transform .12s, box-shadow .12s;">
                            <div>
                              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                                <strong style="font-size:.92rem;line-height:1.2;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(bookingAtHour.guestName)}</strong>
                                <span class="badge" style="background:rgba(255,255,255,.25);color:#fff;font-size:.65rem;padding:1px 5px;font-weight:800;">${bookingAtHour.pax} Pax</span>
                              </div>
                              <div style="font-size:.76rem;color:#CFDAFF;margin-top:2px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${Utils.escapeHtml(bookingAtHour.tableName)}
                              </div>
                              <div style="font-size:.72rem;color:#BACBFF;margin-top:1px;">
                                ${bookingAtHour.startTime} – ${bookingAtHour.endTime}
                              </div>
                            </div>
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-size:.76rem;font-weight:750;color:#FFE58F;">
                              <span>${bookingAtHour.mealType || "Dining"}</span>
                              <span class="badge" style="background:rgba(255,255,255,.2);color:#fff;font-size:.65rem;">${bookingAtHour.status}</span>
                            </div>
                          </div>
                        </td>
                      `;
                    } else {
                      return "";
                    }
                  } else {
                    if(d.isPast){
                      return `<td style="padding:0;border-right:1px solid var(--line);background:var(--paper-dim);opacity:.45;cursor:not-allowed;"></td>`;
                    } else {
                      return `
                        <td class="venue-cell-slot" data-book-slot="true" data-past="false" data-date="${d.iso}" data-hour="${hourObj.val}" style="padding:0;border-right:1px solid var(--line);background:${d.isToday?"rgba(47,66,216,0.03)":"transparent"};cursor:pointer;transition:background .12s;user-select:none;" title="Click or drag to reserve ${d.dayName} at ${hourObj.full}">
                          <div style="height:36px;display:flex;align-items:center;justify-content:center;opacity:0;" class="slot-hover-hint">
                            <span style="font-size:.72rem;font-weight:800;color:var(--brand);background:var(--brand-tint);padding:2px 6px;border-radius:4px;">+ Drag</span>
                          </div>
                        </td>
                      `;
                    }
                  }
                }).join("")}
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderTableTapeChart(weekDays, allBookings, today){
    return `
      <table style="width:100%;min-width:880px;border-collapse:collapse;table-layout:fixed;">
        <thead>
          <tr style="border-bottom:1.5px solid var(--line-strong);">
            <th style="width:220px;padding:12px 14px;text-align:left;font-size:.82rem;font-weight:850;color:var(--ink-soft);border-right:1.5px solid var(--line);text-transform:uppercase;position:sticky;top:0;left:0;z-index:20;background:var(--paper-dim);">
              Dining Table / Area
            </th>
            ${weekDays.map(d => `
              <th style="padding:10px 8px;text-align:center;border-right:1px solid var(--line);position:sticky;top:0;z-index:10;background:${d.isToday?"var(--brand-tint)":"var(--paper-dim)"};">
                <div style="font-size:.76rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase;">${d.dayName}</div>
                <div style="font-size:1.25rem;font-weight:900;color:${d.isToday?"var(--brand-deep)":d.isPast?"var(--ink-faint)":"var(--ink)"};">
                  ${d.dayNum}
                  ${d.isToday ? `<span class="badge badge-brand" style="font-size:.62rem;padding:1px 4px;margin-left:2px;">Today</span>` : ""}
                </div>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${DINING_TABLES.map(table => {
            return `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:14px 16px;background:var(--paper-dim);border-right:1.5px solid var(--line);font-size:.92rem;font-weight:800;color:var(--ink);position:sticky;left:0;z-index:5;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${Icons.get("utensils",{size:15})}
                    <span>${Utils.escapeHtml(table)}</span>
                  </div>
                </td>
                ${weekDays.map(d => {
                  const bookingsForTableDay = allBookings.filter(b => b.date === d.iso && b.tableName === table && b.status !== "Cancelled");
                  if(bookingsForTableDay.length){
                    return `
                      <td style="padding:6px;border-right:1px solid var(--line);vertical-align:top;background:${d.isToday?"rgba(47,66,216,0.04)":"transparent"};">
                        <div style="display:flex;flex-direction:column;gap:6px;">
                          ${bookingsForTableDay.map(b => `
                            <div class="venue-booking-tape-card" data-open-rbooking="${b.id}" style="background:linear-gradient(135deg, var(--brand-deep), #2A4590);color:#fff;border-radius:8px;padding:6px 8px;box-shadow:var(--shadow-sm);cursor:pointer;">
                              <div style="display:flex;align-items:center;justify-content:space-between;">
                                <strong style="font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(b.guestName)}</strong>
                                <span class="badge" style="background:rgba(255,255,255,.2);font-size:.62rem;padding:1px 4px;">${b.pax}p</span>
                              </div>
                              <div style="font-size:.70rem;color:#CFDAFF;margin-top:2px;">${b.startTime} – ${b.endTime}</div>
                            </div>
                          `).join("")}
                        </div>
                      </td>
                    `;
                  } else {
                    if(d.isPast){
                      return `<td style="padding:0;border-right:1px solid var(--line);background:var(--paper-dim);opacity:.45;cursor:not-allowed;"></td>`;
                    } else {
                      return `
                        <td class="venue-cell-slot" data-book-slot="true" data-past="false" data-date="${d.iso}" data-hour="12:00" data-table="${table}" style="padding:12px 6px;text-align:center;border-right:1px solid var(--line);background:${d.isToday?"rgba(47,66,216,0.03)":"transparent"};cursor:pointer;" title="Click to book ${table} on ${fmtPHTDate(d.iso)}">
                          <span style="font-size:.76rem;color:var(--success-deep);font-weight:750;">Available</span>
                        </td>
                      `;
                    }
                  }
                }).join("")}
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderBookingsList(allBookings){
    return `
      <div class="table-wrap">
        <table class="data" style="font-size:1.02rem;">
          <thead>
            <tr style="font-size:.84rem;text-transform:uppercase;">
              <th style="padding:12px 14px;">Date (PHT)</th>
              <th style="padding:12px 14px;">Guest Name</th>
              <th style="padding:12px 14px;">Pax</th>
              <th style="padding:12px 14px;">Table / Area</th>
              <th style="padding:12px 14px;text-align:center;">Time (8am - 12am)</th>
              <th style="padding:12px 14px;text-align:right;">Deposit</th>
              <th style="padding:12px 14px;text-align:center;">Status</th>
              <th style="width:80px;"></th>
            </tr>
          </thead>
          <tbody>
            ${allBookings.length ? allBookings.map(b => `
              <tr>
                <td class="mono font-bold" style="font-size:1.05rem;">${fmtPHTDate(b.date)}</td>
                <td>
                  <strong style="font-size:1.10rem;">${Utils.escapeHtml(b.guestName)}</strong>
                  ${b.phone ? `<div class="text-xs text-faint mono">${Utils.escapeHtml(b.phone)}</div>` : ""}
                </td>
                <td class="mono font-bold" style="font-size:1.10rem;">
                  <span class="badge badge-brand" style="font-size:.85rem;font-weight:800;">${b.pax} Pax</span>
                </td>
                <td>
                  <div style="font-weight:750;">${Utils.escapeHtml(b.tableName)}</div>
                  <div class="text-xs text-faint">${Utils.escapeHtml(b.mealType || "Dining")}</div>
                </td>
                <td class="mono font-bold" style="text-align:center;font-size:1.02rem;">${b.startTime} – ${b.endTime}</td>
                <td class="mono font-bold" style="text-align:right;font-size:1.10rem;color:var(--brand-deep);">${b.deposit > 0 ? Utils.money(b.deposit) : "—"}</td>
                <td style="text-align:center;"><span class="badge ${b.status==="Confirmed"?"badge-green":b.status==="Cancelled"?"badge-rust":"badge-amber"}" style="font-size:.88rem;font-weight:800;padding:4px 10px;">${b.status}</span></td>
                <td style="text-align:right;white-space:nowrap;">
                  <button class="btn btn-sm btn-ghost" data-edit-rbooking="${b.id}" title="Edit">${Icons.get("edit",{size:15})}</button>
                  <button class="btn btn-sm btn-ghost" data-del-rbooking="${b.id}" title="Delete" style="color:var(--danger);">${Icons.get("trash",{size:15})}</button>
                </td>
              </tr>
            `).join("") : `
              <tr><td colspan="8" class="text-center text-faint" style="padding:36px;font-size:1.05rem;">No table reservations found. Click "New Table Reservation" to add.</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  function exportBookingsCSV(){
    const list = DB.getRestaurantBookings();
    if(!list.length){ Utils.toast("No reservations to export.", "warn"); return; }
    const rows = [
      ["Date (PHT)", "Guest Name", "Phone", "Pax", "Table", "Meal Type", "Start Time", "End Time", "Deposit", "Payment Method", "Status", "Special Requests"],
      ...list.map(b => [
        fmtPHTDate(b.date),
        `"${(b.guestName||"").replace(/"/g, '""')}"`,
        b.phone || "",
        b.pax || 2,
        `"${(b.tableName||"").replace(/"/g, '""')}"`,
        `"${(b.mealType||"").replace(/"/g, '""')}"`,
        b.startTime || "",
        b.endTime || "",
        (b.deposit || 0).toFixed(2),
        b.method || "Cash",
        b.status || "Confirmed",
        `"${(b.specialRequests||"").replace(/"/g, '""')}"`
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Route98_Restaurant_Reservations_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    Utils.toast("Restaurant reservations exported to CSV.", "success");
  }

  return { render };
})();
