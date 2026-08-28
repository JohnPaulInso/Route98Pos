// ============================================================
// venue.js — Venue Booking, Drag-to-Select Time & Hotel Tape Chart
// ============================================================
const Venue = (() => {
  // (2026-07-13) Add vertical scroll, drag-to-select & Jan 1, 2026 date; was static
  let viewMode = "week"; // week | tape | list
  let currentAnchorDate = new Date();
  let selectedAreaFilter = "All";

  // Drag selection state for time slot creation
  let isDragging = false;
  let dragDate = "";
  let dragStartH = null;
  let dragEndH = null;
  let dragArea = "";

  function getTodayStr(){
    return new Date().toISOString().split("T")[0];
  }

  // Format date in Philippine format: e.g. "Aug 21, 2026" or "Jan 1, 2026"
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

  const VENUE_AREAS = [
    "Whole Route 98 Venue",
    "Function Hall / Pavilion",
    "Gazebo & Garden Area",
    "Poolside & Deck",
    "Private VIP Room"
  ];

  const EVENT_TYPES = [
    "Birthday Celebration",
    "Wedding & Reception",
    "Company / Team Building",
    "Reunion / Family Gathering",
    "Christening / Baptismal",
    "Meeting / Seminar",
    "Other Event"
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

  // (2026-07-13) Organize reservation modal with icon sections; was cluttered
  function openBookingModal(booking = null, prefillDate = "", prefillStartHour = "08:00", prefillArea = "", prefillEndHour = ""){
    const isEdit = !!booking;
    const today = getTodayStr();
    const curDate = booking ? booking.date : (prefillDate && prefillDate >= today ? prefillDate : today);

    // (2026-07-13) Refined venue booking modal UI & balance badge; was inconsistent
    const body = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <!-- Section 1: Client & Venue Facility -->
        <div class="card card-tight" style="padding:16px 18px;background:#FFFFFF;border:1px solid #E5E7EB;border-top:2px solid #4F46E5;border-radius:10px;margin:0;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:700;color:#111827;margin-bottom:12px;">
            <span style="color:#4F46E5;display:flex;align-items:center;">${Icons.get("user",{size:16})}</span> Client & Venue Facility
          </div>
          <div class="input-row" style="margin-bottom:10px;gap:12px;">
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Client Full Name <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <input class="input font-bold" id="bk-client" placeholder="e.g. Maria Santos" value="${booking ? Utils.escapeHtml(booking.clientName) : ""}" autofocus style="border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:.92rem;padding:9px 12px;">
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Contact Mobile <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <input class="input font-bold" id="bk-phone" placeholder="09XX-XXX-XXXX" value="${booking ? Utils.escapeHtml(booking.phone || "") : ""}" style="border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:.92rem;padding:9px 12px;">
            </div>
          </div>
          <div class="input-row" style="gap:12px;">
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Venue Area / Facility <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div id="bk-area-wrap"></div>
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Event Type <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div id="bk-type-wrap"></div>
            </div>
          </div>
        </div>

        <!-- Section 2: Date & Time Schedule -->
        <div class="card card-tight" style="padding:16px 18px;background:#FAFBFF;border:1px solid #E0E7FF;border-top:2px solid #6366F1;border-radius:10px;margin:0;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:700;color:#111827;">
              <span style="color:#4F46E5;display:flex;align-items:center;">${Icons.get("calendar",{size:16})}</span> Schedule (8:00 AM – 12:00 AM PHT)
            </div>
            <span id="bk-duration-tag" class="badge" style="background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:6px;">4 Hours Duration</span>
          </div>
          <div class="input-row" style="gap:12px;">
            <div class="field" style="margin-bottom:0;flex:1.2;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Booking Date (PHT) <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div style="position:relative;display:flex;align-items:center;">
                <input class="input font-bold" id="bk-date" type="date" min="${today}" value="${curDate}" style="border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:.92rem;padding:9px 36px 9px 12px;width:100%;box-sizing:border-box;cursor:pointer;">
                <span style="position:absolute;right:12px;pointer-events:none;color:#6B7280;display:flex;align-items:center;">
                  ${Icons.get("calendar",{size:15})}
                </span>
              </div>
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Start Time <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div id="bk-start-wrap"></div>
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                End Time <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div id="bk-end-wrap"></div>
            </div>
          </div>
        </div>

        <!-- Section 3: Billing & Deposit -->
        <div class="card card-tight" style="padding:16px 18px;background:#FFFFFF;border:1px solid #E5E7EB;border-top:2px solid #4F46E5;border-radius:10px;margin:0;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:700;color:#111827;">
              <span style="color:#4F46E5;display:flex;align-items:center;">${Icons.get("wallet",{size:16})}</span> Billing & Deposit
            </div>
            <span id="bk-balance-badge" class="badge mono font-bold" style="background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;font-size:.80rem;padding:3px 10px;border-radius:6px;">Balance: ₱4,000.00</span>
          </div>
          <div class="input-row" style="margin-bottom:10px;gap:12px;">
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Package Rate (₱) <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <input class="input mono font-bold" id="bk-fee" type="number" min="0" step="100" placeholder="0.00" value="${booking ? booking.fee : "5000"}" style="border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:1.10rem;padding:8px 12px;">
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Downpayment Paid (₱)
              </label>
              <input class="input mono font-bold" id="bk-paid" type="number" min="0" step="100" placeholder="0.00" value="${booking ? booking.paid : "1000"}" style="border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:1.10rem;padding:8px 12px;">
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Payment Method <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div id="bk-method-wrap"></div>
            </div>
          </div>
          <div class="input-row" style="gap:12px;">
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Reference No. <span class="text-xs text-faint font-normal" style="color:#6B7280;">(Optional)</span>
              </label>
              <input class="input mono" id="bk-ref" placeholder="e.g. GCash 109283749" value="${booking ? Utils.escapeHtml(booking.refNo || "") : ""}" style="border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:.90rem;padding:9px 12px;">
            </div>
            <div class="field" style="margin-bottom:0;flex:1;">
              <label style="font-size:.78rem;font-weight:600;color:#374151;text-transform:none;margin-bottom:5px;display:block;">
                Booking Status <span style="color:#EF4444;font-weight:700;">*</span>
              </label>
              <div id="bk-status-wrap"></div>
            </div>
          </div>
        </div>

        <!-- Section 4: Special Requests & Setup Instructions -->
        <div class="card card-tight" style="padding:16px 18px;background:#FAFBFF;border:1px solid #E0E7FF;border-top:2px solid #6366F1;border-radius:10px;margin:0;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="display:flex;align-items:center;gap:8px;font-size:.88rem;font-weight:700;color:#111827;margin-bottom:10px;">
            <span style="color:#4F46E5;display:flex;align-items:center;">${Icons.get("clipboard",{size:16})}</span> Special Requests & Setup Instructions <span class="text-xs text-faint font-normal" style="color:#6B7280;">(Optional)</span>
          </div>
          <textarea class="input" id="bk-notes" rows="2" placeholder="e.g. 50 chairs setup, sound system, catering prep at 1pm" style="width:100%;box-sizing:border-box;border:1px solid #D1D5DB;border-radius:7px;background:#FFFFFF;font-size:.88rem;padding:10px 12px;resize:vertical;">${booking ? Utils.escapeHtml(booking.notes || "") : ""}</textarea>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: `${Icons.get("party",{size:18})} ${isEdit ? "Edit Venue Reservation" : "New Venue Reservation"}`,
      body,
      wide: true,
      actions: [
        { label: "Cancel", cls: "btn-ghost btn-lg" },
        { label: isEdit ? "Save Changes" : "Confirm Booking", cls: "btn-primary btn-lg", onClick: () => {
          const clientName = (modal.querySelector("#bk-client").value || "").trim();
          if(!clientName){ Utils.toast("Please enter the client's name.", "warn"); return; }
          const phone = (modal.querySelector("#bk-phone").value || "").trim();
          const venueArea = UISelect.getValue("bk-area") || VENUE_AREAS[0];
          const eventType = UISelect.getValue("bk-type") || EVENT_TYPES[0];
          const date = modal.querySelector("#bk-date").value;
          if(!date || date < today){
            Utils.toast("Please select today or a future date.", "warn");
            return;
          }
          const startTime = UISelect.getValue("bk-start") || "08:00";
          const endTime = UISelect.getValue("bk-end") || "12:00";
          const fee = Number(modal.querySelector("#bk-fee").value) || 0;
          const paid = Number(modal.querySelector("#bk-paid").value) || 0;
          const method = UISelect.getValue("bk-method") || "Cash";
          const refNo = (modal.querySelector("#bk-ref").value || "").trim();
          const status = UISelect.getValue("bk-status") || "Confirmed";
          const notes = (modal.querySelector("#bk-notes").value || "").trim();

          const payload = {
            clientName, phone, venueArea, eventType, date,
            startTime, endTime, fee, paid, method, refNo, status, notes
          };

          if(isEdit){
            DB.updateBooking(booking.id, payload);
            Utils.toast("Booking updated.", "success");
          } else {
            DB.addBooking(payload);
            Utils.Sound.cashChime();
            Utils.toast(`Venue booked for ${clientName}!`, "success");
          }

          currentAnchorDate = new Date(date + "T00:00:00");
          Modal.close();
          render();
        }}
      ]
    });

    modal.querySelector("#bk-area-wrap").innerHTML = UISelect.render("bk-area", VENUE_AREAS, booking?.venueArea || prefillArea || VENUE_AREAS[0]);
    UISelect.bind("bk-area");

    modal.querySelector("#bk-type-wrap").innerHTML = UISelect.render("bk-type", EVENT_TYPES, booking?.eventType || EVENT_TYPES[0]);
    UISelect.bind("bk-type");

    const timeOptions = HOURS.map(h => ({ value: h.val, label: h.full }));
    modal.querySelector("#bk-start-wrap").innerHTML = UISelect.render("bk-start", timeOptions, booking?.startTime || prefillStartHour);
    UISelect.bind("bk-start", () => updateModalStats(modal));

    let defaultEndVal = prefillEndHour;
    if(!defaultEndVal){
      const startHNum = parseInt((booking?.startTime || prefillStartHour).split(":")[0], 10);
      const endHourNum = Math.min(24, startHNum + 4);
      defaultEndVal = `${String(endHourNum).padStart(2,"0")}:00`;
    }
    modal.querySelector("#bk-end-wrap").innerHTML = UISelect.render("bk-end", timeOptions, booking?.endTime || defaultEndVal);
    UISelect.bind("bk-end", () => updateModalStats(modal));

    modal.querySelector("#bk-method-wrap").innerHTML = UISelect.render("bk-method", ["Cash","GCash","Bank Transfer","Card","Check"], booking?.method || "Cash");
    UISelect.bind("bk-method");

    modal.querySelector("#bk-status-wrap").innerHTML = UISelect.render("bk-status", ["Confirmed","Reserved (Downpayment)","Paid in Full","Completed","Cancelled"], booking?.status || "Confirmed");
    UISelect.bind("bk-status");

    function updateModalStats(m){
      const fee = Number(m.querySelector("#bk-fee")?.value) || 0;
      const paid = Number(m.querySelector("#bk-paid")?.value) || 0;
      const bal = Math.max(0, fee - paid);
      const balBadge = m.querySelector("#bk-balance-badge");
      if(balBadge){
        if(bal === 0 && fee > 0){
          balBadge.style.background = "#ECFDF5";
          balBadge.style.color = "#059669";
          balBadge.style.border = "1px solid #A7F3D0";
          balBadge.textContent = "Paid in full";
        } else {
          balBadge.style.background = "#EEF2FF";
          balBadge.style.color = "#4338CA";
          balBadge.style.border = "1px solid #C7D2FE";
          balBadge.textContent = `Balance: ${Utils.money(bal)}`;
        }
      }

      const sH = parseInt((UISelect.getValue("bk-start") || "08:00").split(":")[0], 10);
      const eH = parseInt((UISelect.getValue("bk-end") || "12:00").split(":")[0], 10);
      const dur = Math.max(1, eH - sH);
      const durTag = m.querySelector("#bk-duration-tag");
      if(durTag){
        durTag.textContent = `${dur} Hour${dur===1?"":"s"} Duration`;
      }
    }

    modal.querySelector("#bk-fee")?.addEventListener("input", () => updateModalStats(modal));
    modal.querySelector("#bk-paid")?.addEventListener("input", () => updateModalStats(modal));
    updateModalStats(modal);
  }

  function deleteBookingConfirm(b){
    Modal.confirm({
      title: "Cancel & Delete Booking?",
      message: `Permanently remove reservation for ${Utils.escapeHtml(b.clientName)} on ${fmtPHTDate(b.date)}?`,
      danger: true,
      onConfirm: () => {
        DB.deleteBooking(b.id);
        Utils.toast("Booking removed.", "success");
        render();
      }
    });
  }

  function render(){
    const view = document.getElementById("view-root");
    const today = getTodayStr();
    const allBookings = DB.getBookings();

    const weekStart = getStartOfWeek(currentAnchorDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekRangeLabel = `${fmtPHTDate(weekStart)} – ${fmtPHTDate(weekEnd)}`;

    // Get 7 days array
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

    // Filter bookings for this active week
    const weekBookings = allBookings.filter(b => {
      const matchArea = selectedAreaFilter === "All" || b.venueArea === selectedAreaFilter;
      return b.date >= weekDays[0].iso && b.date <= weekDays[6].iso && b.status !== "Cancelled" && matchArea;
    });

    const totalWeekRev = weekBookings.reduce((s,b) => s + (b.fee || 0), 0);
    const totalWeekPaid = weekBookings.reduce((s,b) => s + (b.paid || 0), 0);

    view.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <div class="view-head" style="margin-bottom:8px;">
          <div>
            <h2>${Icons.get("party",{size:22})} Route 98 Venue Booking</h2>
            <div class="view-sub">Hold & drag across hours to reserve · 8:00 AM to 12:00 AM Philippine Time</div>
          </div>
          <div class="input-row" style="width:auto;">
            <button class="btn btn-outline" id="btn-export-bk">${Icons.get("download",{size:15})} Export Bookings</button>
            <button class="btn btn-primary" id="btn-new-booking">${Icons.get("plus",{size:16})} New Reservation</button>
          </div>
        </div>

        <!-- Top Control Bar (Zoho / Hotel Tape Chart Style) -->
        <div class="card" style="margin-bottom:10px;background:var(--paper-dim);border:1.5px solid var(--line);padding:8px 16px;border-radius:12px;flex-shrink:0;">
          <div class="flex-between" style="flex-wrap:wrap;gap:10px;">
            <!-- Left: Nav Controls -->
            <div style="display:flex;align-items:center;gap:6px;">
              <button class="btn btn-sm btn-outline font-bold" id="btn-nav-today" style="border-radius:8px;padding:6px 14px;">Today</button>
              <div style="display:flex;gap:2px;">
                <button class="btn btn-sm btn-ghost" id="btn-nav-prev" title="Previous week/period" style="padding:6px 8px;">${Icons.get("chevron-left",{size:16})}</button>
                <button class="btn btn-sm btn-ghost" id="btn-nav-next" title="Next week/period" style="padding:6px 8px;"><span style="display:inline-flex;transform:rotate(180deg);">${Icons.get("chevron-left",{size:16})}</span></button>
              </div>
              <strong style="font-size:1.18rem;color:var(--ink);margin-left:6px;font-family:var(--font-mono);">${weekRangeLabel}</strong>
            </div>

            <!-- Middle: Area / Room Filter -->
            <div style="width:220px;" id="venue-area-filter-wrap"></div>

            <!-- Right: View Mode Toggle Tabs -->
            <div style="display:flex;gap:4px;background:var(--paper-raised);padding:3px;border-radius:10px;border:1px solid var(--line-strong);">
              <button class="chip ${viewMode==="week"?"active":""}" id="tab-v-week" style="margin:0;border:none;border-radius:8px;font-size:.82rem;padding:5px 12px;">${Icons.get("calendar",{size:13})} Week Calendar</button>
              <button class="chip ${viewMode==="tape"?"active":""}" id="tab-v-tape" style="margin:0;border:none;border-radius:8px;font-size:.82rem;padding:5px 12px;">${Icons.get("clipboard",{size:13})} Area Tape Chart</button>
              <button class="chip ${viewMode==="list"?"active":""}" id="tab-v-list" style="margin:0;border:none;border-radius:8px;font-size:.82rem;padding:5px 12px;">${Icons.get("tag",{size:13})} All Reservations</button>
            </div>
          </div>
        </div>

        <!-- Quick Metrics Summary -->
        <div class="grid-3" style="margin-bottom:10px;gap:10px;flex-shrink:0;">
          <div class="card card-tight" style="border:1.5px solid var(--brand);background:var(--brand-tint);padding:10px 16px;border-radius:10px;">
            <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;color:var(--brand-deep);margin-bottom:2px;">Events (This Week)</div>
            <strong class="mono font-bold" style="font-size:1.45rem;color:var(--brand-deep);">${weekBookings.length} event(s)</strong>
          </div>
          <div class="card card-tight" style="border:1.5px solid var(--line);background:var(--paper-dim);padding:10px 16px;border-radius:10px;">
            <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;margin-bottom:2px;">Projected Revenue</div>
            <strong class="mono font-bold" style="font-size:1.45rem;color:var(--ink);">${Utils.money(totalWeekRev)}</strong>
          </div>
          <div class="card card-tight" style="border:1.5px solid var(--success-deep);background:var(--success-tint);padding:10px 16px;border-radius:10px;">
            <div class="text-xs text-faint" style="font-weight:800;text-transform:uppercase;color:var(--success-deep);margin-bottom:2px;">Downpayments Collected</div>
            <strong class="mono font-bold" style="font-size:1.45rem;color:var(--success-deep);">${Utils.money(totalWeekPaid)}</strong>
          </div>
        </div>

        <!-- Main Scrollable Schedule View Port -->
        <div id="venue-scroll-wrapper" style="flex:1;min-height:0;overflow-y:auto;overflow-x:auto;border:1.5px solid var(--line);border-radius:14px;background:var(--paper-raised);">
          ${viewMode === "week"
            ? renderWeekCalendarTapeChart(weekDays, weekBookings, today)
            : viewMode === "tape"
            ? renderAreaTapeChart(weekDays, allBookings, today)
            : renderBookingsList(allBookings)
          }
        </div>
      </div>
    `;

    document.getElementById("btn-new-booking").onclick = () => openBookingModal();
    document.getElementById("btn-export-bk").onclick = exportBookingsCSV;

    document.getElementById("tab-v-week").onclick = () => { viewMode = "week"; render(); };
    document.getElementById("tab-v-tape").onclick = () => { viewMode = "tape"; render(); };
    document.getElementById("tab-v-list").onclick = () => { viewMode = "list"; render(); };

    document.getElementById("btn-nav-today").onclick = () => {
      currentAnchorDate = new Date();
      render();
    };

    document.getElementById("btn-nav-prev").onclick = () => {
      const d = new Date(currentAnchorDate);
      d.setDate(d.getDate() - 7);
      currentAnchorDate = d;
      render();
    };

    document.getElementById("btn-nav-next").onclick = () => {
      const d = new Date(currentAnchorDate);
      d.setDate(d.getDate() + 7);
      currentAnchorDate = d;
      render();
    };

    document.getElementById("venue-area-filter-wrap").innerHTML = UISelect.render("v-area-filter", ["All Areas", ...VENUE_AREAS], selectedAreaFilter === "All" ? "All Areas" : selectedAreaFilter);
    UISelect.bind("v-area-filter", (val) => {
      selectedAreaFilter = val === "All Areas" ? "All" : val;
      render();
    });

    // Initialize drag-to-select time interaction
    bindDragSelection();

    view.querySelectorAll("[data-open-booking]").forEach(block => {
      block.onclick = (e) => {
        e.stopPropagation();
        const b = DB.getBookings().find(x => x.id === block.dataset.openBooking);
        if(b) openBookingModal(b);
      };
    });

    view.querySelectorAll("[data-edit-booking]").forEach(btn => {
      btn.onclick = () => {
        const b = DB.getBookings().find(x => x.id === btn.dataset.editBooking);
        if(b) openBookingModal(b);
      };
    });

    view.querySelectorAll("[data-del-booking]").forEach(btn => {
      btn.onclick = () => {
        const b = DB.getBookings().find(x => x.id === btn.dataset.delBooking);
        if(b) deleteBookingConfirm(b);
      };
    });
  }

  // (2026-07-13) Smooth touch scrolling & tap-to-select on mobile/tablet; was e.preventDefault
  function bindDragSelection(){
    const scrollWrap = document.getElementById("venue-scroll-wrapper");
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

    // (2026-07-13) Hold long-press then drag for venue booking; was click only
    let longPressTimer = null;
    let touchStartX = 0, touchStartY = 0;
    let hasMovedDuringDrag = false;

    scrollWrap.querySelectorAll(".venue-cell-slot").forEach(cell => {
      cell.addEventListener("mousedown", (e) => {
        if(e.button !== 0) return;
        if(cell.dataset.past === "true") return;
        isDragging = true;
        hasMovedDuringDrag = false;
        dragDate = cell.dataset.date;
        dragStartH = parseInt(cell.dataset.hour.split(":")[0], 10);
        dragEndH = dragStartH;
        dragArea = cell.dataset.area || "";
        updateHighlight();
      });

      cell.addEventListener("mouseenter", () => {
        if(!isDragging) return;
        if(cell.dataset.date !== dragDate) return;
        hasMovedDuringDrag = true;
        dragEndH = parseInt(cell.dataset.hour.split(":")[0], 10);
        updateHighlight();
      });

      cell.addEventListener("touchstart", (e) => {
        if(cell.dataset.past === "true" || e.touches.length > 1) return;
        if(longPressTimer) clearTimeout(longPressTimer);
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        hasMovedDuringDrag = false;
        longPressTimer = setTimeout(() => {
          isDragging = true;
          dragDate = cell.dataset.date;
          dragStartH = parseInt(cell.dataset.hour.split(":")[0], 10);
          dragEndH = dragStartH;
          dragArea = cell.dataset.area || "";
          if(navigator.vibrate) navigator.vibrate(25);
          updateHighlight();
        }, 220);
      }, { passive: true });

      cell.addEventListener("click", () => {
        if(cell.dataset.past === "true" || hasMovedDuringDrag) return;
        const date = cell.dataset.date;
        const h = parseInt(cell.dataset.hour.split(":")[0], 10);
        const startVal = `${String(h).padStart(2,"0")}:00`;
        const endVal = `${String(Math.min(24, h + 4)).padStart(2,"0")}:00`;
        openBookingModal(null, date, startVal, cell.dataset.area || "", endVal);
      });
    });

    const handleMouseUp = () => {
      if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer = null; }
      if(isDragging){
        isDragging = false;
        if(dragDate && dragStartH !== null && hasMovedDuringDrag){
          const minH = Math.min(dragStartH, dragEndH !== null ? dragEndH : dragStartH);
          const maxH = Math.max(dragStartH, dragEndH !== null ? dragEndH : dragStartH);
          const startVal = `${String(minH).padStart(2,"0")}:00`;
          const endVal = `${String(Math.min(24, maxH + 1)).padStart(2,"0")}:00`;
          clearHighlight();
          openBookingModal(null, dragDate, startVal, dragArea, endVal);
        }
        clearHighlight();
        dragDate = "";
        dragStartH = null;
        dragEndH = null;
      }
    };

    const handleTouchMove = (e) => {
      if(!isDragging){
        if(longPressTimer){
          const touch = e.touches[0];
          if(Math.abs(touch.clientX - touchStartX) > 8 || Math.abs(touch.clientY - touchStartY) > 8){
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
        return;
      }
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const slot = target ? target.closest(".venue-cell-slot") : null;
      if(slot && slot.dataset.date === dragDate){
        hasMovedDuringDrag = true;
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

  // ============ 7-DAY CALENDAR TAPE CHART (ZOHO / HOTEL STYLE) ============
  function renderWeekCalendarTapeChart(weekDays, weekBookings, today){
    return `
      <table style="width:100%;min-width:880px;border-collapse:collapse;table-layout:fixed;">
        <!-- Header Row: Timezone + 7 Days (Sticky Top) -->
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

        <!-- Body Rows: Hours 8:00 AM to 12:00 AM -->
        <tbody>
          ${HOURS.slice(0, HOURS.length - 1).map((hourObj, hIdx) => {
            const hourNum = hourObj.h;
            return `
              <tr style="border-bottom:1px solid var(--line);">
                <!-- Time Label Column (Sticky Left) -->
                <td style="padding:10px 8px;text-align:right;font-size:.82rem;font-family:var(--font-mono);font-weight:800;color:var(--ink-soft);background:var(--paper-dim);border-right:1.5px solid var(--line);vertical-align:top;user-select:none;position:sticky;left:0;z-index:5;">
                  ${hourObj.label}
                </td>

                <!-- 7 Day Columns for this hour -->
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
                          <div class="venue-booking-tape-card" data-open-booking="${bookingAtHour.id}" style="height:100%;min-height:${durationHours*42}px;background:linear-gradient(135deg, var(--brand), var(--brand-deep));color:#fff;border-radius:8px;padding:8px 10px;box-shadow:var(--shadow-sm);cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;transition:transform .12s, box-shadow .12s;">
                            <div>
                              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                                <strong style="font-size:.92rem;line-height:1.2;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(bookingAtHour.clientName)}</strong>
                                <span class="badge" style="background:rgba(255,255,255,.25);color:#fff;font-size:.65rem;padding:1px 5px;font-weight:800;">${bookingAtHour.status}</span>
                              </div>
                              <div style="font-size:.76rem;color:#CFDAFF;margin-top:2px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${Utils.escapeHtml(bookingAtHour.eventType)}
                              </div>
                              <div style="font-size:.72rem;color:#BACBFF;margin-top:1px;">
                                ${bookingAtHour.startTime} – ${bookingAtHour.endTime}
                              </div>
                            </div>
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-family:var(--font-mono);font-size:.82rem;font-weight:850;color:#FFE58F;">
                              <span>${Utils.money(bookingAtHour.fee)}</span>
                              ${bookingAtHour.balance > 0 ? `<span style="font-size:.68rem;color:#FFA39E;">Bal: ${Utils.money(bookingAtHour.balance)}</span>` : `<span style="font-size:.68rem;color:#B7EB8F;">Paid</span>`}
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
                        <td class="venue-cell-slot" data-book-slot="true" data-past="false" data-date="${d.iso}" data-hour="${hourObj.val}" style="padding:0;border-right:1px solid var(--line);background:${d.isToday?"rgba(47,66,216,0.03)":"transparent"};cursor:pointer;transition:background .12s;user-select:none;" title="Click or drag to book ${d.dayName} at ${hourObj.full}">
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

  // ============ AREA / ROOM TAPE CHART VIEW ============
  function renderAreaTapeChart(weekDays, allBookings, today){
    return `
      <table style="width:100%;min-width:880px;border-collapse:collapse;table-layout:fixed;">
        <thead>
          <tr style="border-bottom:1.5px solid var(--line-strong);">
            <th style="width:200px;padding:12px 14px;text-align:left;font-size:.82rem;font-weight:850;color:var(--ink-soft);border-right:1.5px solid var(--line);text-transform:uppercase;position:sticky;top:0;left:0;z-index:20;background:var(--paper-dim);">
              Venue Facility / Area
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
          ${VENUE_AREAS.map(area => {
            return `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:14px 16px;background:var(--paper-dim);border-right:1.5px solid var(--line);font-size:.95rem;font-weight:800;color:var(--ink);position:sticky;left:0;z-index:5;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${Icons.get("party",{size:15})}
                    <span>${Utils.escapeHtml(area)}</span>
                  </div>
                </td>
                ${weekDays.map(d => {
                  const bookingsForAreaDay = allBookings.filter(b => b.date === d.iso && b.venueArea === area && b.status !== "Cancelled");
                  if(bookingsForAreaDay.length){
                    return `
                      <td style="padding:6px;border-right:1px solid var(--line);vertical-align:top;background:${d.isToday?"rgba(47,66,216,0.04)":"transparent"};">
                        <div style="display:flex;flex-direction:column;gap:6px;">
                          ${bookingsForAreaDay.map(b => `
                            <div class="venue-booking-tape-card" data-open-booking="${b.id}" style="background:linear-gradient(135deg, var(--brand), var(--brand-deep));color:#fff;border-radius:8px;padding:6px 8px;box-shadow:var(--shadow-sm);cursor:pointer;">
                              <strong style="font-size:.85rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(b.clientName)}</strong>
                              <div style="font-size:.70rem;color:#CFDAFF;">${b.startTime} – ${b.endTime}</div>
                              <div class="mono" style="font-size:.76rem;font-weight:800;color:#FFE58F;margin-top:2px;">${Utils.money(b.fee)}</div>
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
                        <td class="venue-cell-slot" data-book-slot="true" data-past="false" data-date="${d.iso}" data-hour="08:00" data-area="${area}" style="padding:12px 6px;text-align:center;border-right:1px solid var(--line);background:${d.isToday?"rgba(47,66,216,0.03)":"transparent"};cursor:pointer;" title="Click to book ${area} on ${fmtPHTDate(d.iso)}">
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

  // ============ ALL RESERVATIONS TABLE LIST ============
  function renderBookingsList(allBookings){
    return `
      <div class="table-wrap">
        <table class="data" style="font-size:1.02rem;">
          <thead>
            <tr style="font-size:.84rem;text-transform:uppercase;">
              <th style="padding:12px 14px;">Date (PHT)</th>
              <th style="padding:12px 14px;">Client Name</th>
              <th style="padding:12px 14px;">Event & Area</th>
              <th style="padding:12px 14px;text-align:center;">Time (8am - 12am)</th>
              <th style="padding:12px 14px;text-align:right;">Fee</th>
              <th style="padding:12px 14px;text-align:right;">Paid / Balance</th>
              <th style="padding:12px 14px;text-align:center;">Status</th>
              <th style="width:80px;"></th>
            </tr>
          </thead>
          <tbody>
            ${allBookings.length ? allBookings.map(b => `
              <tr>
                <td class="mono font-bold" style="font-size:1.05rem;">${fmtPHTDate(b.date)}</td>
                <td>
                  <strong style="font-size:1.10rem;">${Utils.escapeHtml(b.clientName)}</strong>
                  ${b.phone ? `<div class="text-xs text-faint mono">${Utils.escapeHtml(b.phone)}</div>` : ""}
                </td>
                <td>
                  <span class="badge badge-brand" style="font-size:.84rem;font-weight:800;">${Utils.escapeHtml(b.eventType)}</span>
                  <div class="text-xs text-faint" style="margin-top:2px;">${Utils.escapeHtml(b.venueArea || "Whole Route 98 Venue")}</div>
                </td>
                <td class="mono font-bold" style="text-align:center;font-size:1.02rem;">${b.startTime} – ${b.endTime}</td>
                <td class="mono font-bold" style="text-align:right;font-size:1.15rem;color:var(--brand-deep);">${Utils.money(b.fee)}</td>
                <td class="mono" style="text-align:right;">
                  <div style="font-weight:800;color:var(--success-deep);">${Utils.money(b.paid)}</div>
                  ${b.balance > 0 ? `<div class="text-xs text-faint" style="color:var(--danger-deep);">Bal: ${Utils.money(b.balance)}</div>` : `<span class="text-xs badge badge-green">Paid in full</span>`}
                </td>
                <td style="text-align:center;"><span class="badge ${b.status==="Confirmed"?"badge-green":b.status==="Cancelled"?"badge-rust":"badge-amber"}" style="font-size:.88rem;font-weight:800;padding:4px 10px;">${b.status}</span></td>
                <td style="text-align:right;white-space:nowrap;">
                  <button class="btn btn-sm btn-ghost" data-edit-booking="${b.id}" title="Edit">${Icons.get("edit",{size:15})}</button>
                  <button class="btn btn-sm btn-ghost" data-del-booking="${b.id}" title="Delete" style="color:var(--danger);">${Icons.get("trash",{size:15})}</button>
                </td>
              </tr>
            `).join("") : `
              <tr><td colspan="8" class="text-center text-faint" style="padding:36px;font-size:1.05rem;">No venue reservations found. Click "New Reservation" to add.</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  function exportBookingsCSV(){
    const list = DB.getBookings();
    if(!list.length){ Utils.toast("No reservations to export.", "warn"); return; }
    const rows = [
      ["Date (PHT)", "Client Name", "Phone", "Venue Area", "Event Type", "Start Time", "End Time", "Total Fee", "Amount Paid", "Balance", "Payment Method", "Status", "Reference No", "Notes"],
      ...list.map(b => [
        fmtPHTDate(b.date),
        `"${(b.clientName||"").replace(/"/g, '""')}"`,
        b.phone || "",
        `"${(b.venueArea||"").replace(/"/g, '""')}"`,
        `"${(b.eventType||"").replace(/"/g, '""')}"`,
        b.startTime || "",
        b.endTime || "",
        (b.fee || 0).toFixed(2),
        (b.paid || 0).toFixed(2),
        (b.balance || 0).toFixed(2),
        b.method || "Cash",
        b.status || "Confirmed",
        b.refNo || "",
        `"${(b.notes||"").replace(/"/g, '""')}"`
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Route98_Venue_Reservations_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    Utils.toast("Reservations exported to CSV.", "success");
  }

  return { render };
})();
