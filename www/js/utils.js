// ============================================================
// utils.js — shared helpers used across every module
// ============================================================
const Utils = (() => {

  function uid(prefix = "id"){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function money(n, opts = {}){
    const settings = DB.getSettings();
    const symbol = opts.symbol ?? settings.currencySymbol ?? "₱";
    const val = Number(n || 0);
    return `${symbol}${val.toLocaleString("en-PH", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  }

  function round2(n){ return Math.round((Number(n)+Number.EPSILON)*100)/100; }

  function fmtDate(ts, withTime = true){
    const d = new Date(ts);
    const date = d.toLocaleDateString("en-PH", { month:"short", day:"2-digit", year:"numeric" });
    if(!withTime) return date;
    const time = d.toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" });
    return `${date}, ${time}`;
  }

  function startOfDay(ts = Date.now()){
    const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime();
  }
  function daysAgo(n){ return startOfDay(Date.now()) - n*86400000; }

  function productThumb(product, opts = {}){
    // Real photo if the product has one (onerror gracefully reveals the icon behind it —
    // handles broken links or being offline without ever showing a broken-image glyph).
    const iconName = DB.categoryIcon(product.category);
    const size = opts.iconSize || 28;
    const tint = product.category ? "" : "";
    const img = product.imageUrl
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none'">`
      : "";
    return `${Icons.get(iconName, { size })}${img}`;
  }

  function toast(msg, type = "info", ms = 3200){
    const stack = document.getElementById("toast-stack");
    if(!stack) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    const iconNames = { success:"check-circle", error:"x-circle", warn:"alert-triangle", info:"info" };
    el.innerHTML = `${Icons.get(iconNames[type]||iconNames.info, { size:17 })}<span>${msg}</span>`;
    stack.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateX(20px)"; el.style.transition="all .18s"; setTimeout(()=>el.remove(),200); }, ms);
  }

  function odometer(value, opts = {}){
    // renders a fuel-pump style digit counter; value can be number or preformatted string
    const digits = String(value);
    const size = opts.size ? ` ${opts.size}` : "";
    let html = `<span class="odometer${size}">`;
    for(const ch of digits){
      if(/[0-9]/.test(ch)) html += `<span class="digit">${ch}</span>`;
      else html += `<span class="digit sep">${ch}</span>`;
    }
    html += `</span>`;
    return html;
  }

  function debounce(fn, wait = 300){
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
  }

  function escapeHtml(str=""){
    return String(str).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  function downloadFile(filename, content, mime = "application/json"){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function readFile(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  function toCSV(rows, headers){
    const esc = v => `"${String(v??"").replace(/"/g,'""')}"`;
    const lines = [headers.map(esc).join(",")];
    for(const row of rows) lines.push(headers.map(h => esc(row[h])).join(","));
    return lines.join("\n");
  }

  // (2026-07-13) Strip BOM & unwrap quoted/concatenated CSV rows. Prev: raw split
  function fromCSV(text){
    if(!text) return [];
    if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if(!lines.length) return [];

    if(lines[0].startsWith('"') && lines[0].includes("Handle,") && lines[0].includes("Barcode")){
      const unpacked = lines.map(line => {
        if(line.startsWith('"')){
          const endIdx = line.indexOf('",');
          if(endIdx !== -1) return line.slice(1, endIdx);
          if(line.endsWith('"')) return line.slice(1, -1);
        }
        return line;
      });
      return fromCSV(unpacked.join("\n"));
    }

    const parseLine = (line) => {
      const out = []; let cur = ""; let inQ = false;
      for(let i=0;i<line.length;i++){
        const c = line[i];
        if(inQ){
          if(c === '"' && line[i+1] === '"'){ cur+='"'; i++; }
          else if(c === '"'){ inQ = false; }
          else cur += c;
        } else {
          if(c === '"') inQ = true;
          else if(c === ","){ out.push(cur.trim()); cur=""; }
          else cur += c;
        }
      }
      out.push(cur.trim());
      return out;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      const vals = parseLine(line);
      const obj = {};
      headers.forEach((h,i)=> obj[h]=vals[i]);
      return obj;
    });
  }

  function randColor(seed){
    const palette = ["#0B6E4F","#E8A33D","#C1441E","#2464B4","#7A5CC7","#1B8A99","#B85C9E","#5F7A2E"];
    let h = 0; for(const c of String(seed)) h = (h*31 + c.charCodeAt(0)) >>> 0;
    return palette[h % palette.length];
  }

  // (2026-07-13) Add SoundFX Web Audio API synthesizer; was none
  let audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(AudioCtx) audioCtx = new AudioCtx();
    }
    if(audioCtx && audioCtx.state === "suspended"){
      audioCtx.resume().catch(()=>{});
    }
    return audioCtx;
  }

  function playTone(freq, type = "sine", duration = 0.08, gainVal = 0.15, startTime = 0){
    try{
      const ctx = getAudioCtx();
      if(!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    }catch(e){}
  }

  const Sound = {
    beep: () => { playTone(1900, "sine", 0.07, 0.18, 0); },
    cashChime: () => {
      playTone(1046.50, "sine", 0.12, 0.16, 0);
      playTone(1318.51, "sine", 0.14, 0.16, 0.07);
      playTone(1567.98, "triangle", 0.28, 0.22, 0.14);
      playTone(2093.00, "sine", 0.35, 0.18, 0.21);
    },
    click: () => { playTone(1200, "sine", 0.035, 0.10, 0); },
    remove: () => {
      try{
        const ctx = getAudioCtx();
        if(!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.10);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.10);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.10);
      }catch(e){}
    },
    hold: () => {
      playTone(587.33, "sine", 0.09, 0.12, 0);
      playTone(880.00, "sine", 0.15, 0.14, 0.08);
    },
    error: () => {
      playTone(220, "sawtooth", 0.08, 0.15, 0);
      playTone(180, "sawtooth", 0.12, 0.15, 0.09);
    }
  };

  return { uid, money, round2, fmtDate, startOfDay, daysAgo, toast, odometer, productThumb, debounce, escapeHtml, downloadFile, readFile, toCSV, fromCSV, randColor, Sound };
})();
