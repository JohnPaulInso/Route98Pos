// ============================================================
// barcode.js — external scanner (keyboard-wedge) support +
// on-device camera scanning (native BarcodeDetector, no
// external library needed): a single-shot mode (fill one field)
// and a continuous mode (keep camera open, auto-add every hit).
// ============================================================
const Scanner = (() => {
  let buffer = "";
  let lastKeyTime = 0;
  let listener = null; // active context callback: (code) => void
  const FAST_KEY_THRESHOLD = 40; // ms between keystrokes = scanner speed, not human typing

  function setContext(fn){ listener = fn; }
  function clearContext(){ listener = null; }

  function flashBanner(code){
    const el = document.createElement("div");
    el.className = "scanner-live";
    el.innerHTML = `${Icons.get("scan",{size:15})}<span>Scanned: ${Utils.escapeHtml(code)}</span>`;
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 1400);
  }

  function handleGlobalKeydown(e){
    // Ignore when typing in a normal text field that isn't the dedicated scan target,
    // UNLESS the keystroke cadence looks like a hardware scanner (very fast).
    const now = Date.now();
    const gap = now - lastKeyTime;
    lastKeyTime = now;

    const isTypingField = ["INPUT","TEXTAREA"].includes(document.activeElement?.tagName) &&
                            !document.activeElement.classList.contains("scan-target");

    if(e.key === "Enter"){
      if(buffer.length >= 3){
        const code = buffer;
        buffer = "";
        if(isTypingField) return; // let normal Enter behave normally in forms
        e.preventDefault();
        flashBanner(code);
        if(listener) listener(code);
        else Utils.toast(`Scanned ${code} — open POS or Inventory to use it.`, "info");
      }
      return;
    }

    if(e.key.length === 1){
      if(gap > FAST_KEY_THRESHOLD + 60 && !isTypingField){
        buffer = ""; // reset — this looks like a fresh human keypress, not scanner burst
      }
      if(!isTypingField || gap < FAST_KEY_THRESHOLD){
        buffer += e.key;
      }
    }
  }

  function init(){
    document.addEventListener("keydown", handleGlobalKeydown);
  }

  // ---------- single-shot camera scan (fills one field, then closes) ----------
  // (2026-07-13) Request camera stream first for Android permission prompt; was failing early
  async function openCameraScan(onResult){
    let stream;
    try{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        throw new Error("getUserMedia not supported");
      }
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
    }catch(err){
      Utils.toast("Camera permission denied or unavailable on this device.", "error");
      return;
    }
    if(!("BarcodeDetector" in window)){
      stream.getTracks().forEach(t => t.stop());
      Utils.toast("BarcodeDetector not enabled in this browser. Use manual/scanner input.", "warn");
      return;
    }
    const detector = new BarcodeDetector({ formats:["qr_code","ean_13","ean_8","upc_a","upc_e","code_128","code_39"] });
    const body = `<video id="cam-preview" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000;"></video>
                  <p class="text-sm text-faint" style="margin-top:10px;">Point the camera at a barcode or QR code.</p>`;
    const modal = Modal.open({ title:`${Icons.get("camera",{size:17})} Scan with camera`, body, actions:[{ label:"Cancel", cls:"btn-ghost" }], onClose:()=>stopCam() });
    const video = modal.querySelector("#cam-preview");
    video.srcObject = stream;

    let raf, stopped = false;
    function stopCam(){
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach(t => t.stop());
    }
    async function tick(){
      if(stopped) return;
      try{
        const codes = await detector.detect(video);
        if(codes.length){
          stopCam(); Modal.close();
          flashBanner(codes[0].rawValue);
          onResult(codes[0].rawValue);
          return;
        }
      }catch(err){ /* keep trying */ }
      raf = requestAnimationFrame(tick);
    }
    tick();
  }

  // ---------- continuous camera scan (stays open, fires onHit for every new code) ----------
  // onHit(code) is called for every distinct detection (with a per-code cooldown so
  // holding the same barcode in frame doesn't add it 30 times a second).
  // (2026-07-13) Request camera stream first for continuous scan prompt; was checking detector
  async function openContinuousScan({ onHit, onClose, title = "Scan items", subtitle = "Point at a barcode — it'll add automatically" }){
    let stream;
    try{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        throw new Error("getUserMedia not supported");
      }
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
    }catch(err){
      Utils.toast("Camera permission denied or unavailable on this device.", "error");
      return;
    }
    if(!("BarcodeDetector" in window)){
      stream.getTracks().forEach(t => t.stop());
      Utils.toast("BarcodeDetector not enabled in this browser. Use manual/scanner input.", "warn");
      return;
    }
    const detector = new BarcodeDetector({ formats:["qr_code","ean_13","ean_8","upc_a","upc_e","code_128","code_39"] });

    const overlay = document.createElement("div");
    overlay.className = "scan-overlay";
    overlay.innerHTML = `
      <div class="scan-overlay-top">
        <strong>${Utils.escapeHtml(title)}</strong>
        <button class="icon-btn" id="scan-close-btn">${Icons.get("x",{size:17})}</button>
      </div>
      <video id="scan-video" autoplay playsinline muted></video>
      <div class="scan-frame"></div>
      <div class="scan-overlay-bottom">
        <div class="scan-count-pill" id="scan-count-pill">${Icons.get("cart",{size:15})}<span>0 scanned</span></div>
        <div class="scan-recent-list" id="scan-recent-list"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("scroll-locked");
    const video = overlay.querySelector("#scan-video");
    video.srcObject = stream;

    let stopped = false, raf, count = 0;
    const lastByCode = {};
    const COOLDOWN_MS = 1400;

    function stop(){
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach(t => t.stop());
      overlay.remove();
      document.body.classList.remove("scroll-locked");
      onClose?.(count);
    }
    overlay.querySelector("#scan-close-btn").onclick = stop;

    function pushRecent(label, ok){
      const list = overlay.querySelector("#scan-recent-list");
      const item = document.createElement("div");
      item.className = "scan-recent-item";
      item.innerHTML = `${Icons.get(ok ? "check" : "x", { size:13 })}<span>${Utils.escapeHtml(label)}</span>`;
      list.prepend(item);
      while(list.children.length > 6) list.lastChild.remove();
    }

    async function tick(){
      if(stopped) return;
      try{
        const codes = await detector.detect(video);
        if(codes.length){
          const code = codes[0].rawValue;
          const now = Date.now();
          if(!lastByCode[code] || (now - lastByCode[code]) > COOLDOWN_MS){
            lastByCode[code] = now;
            const result = onHit(code); // returns { ok, label } from the caller
            count++;
            overlay.querySelector("#scan-count-pill span").textContent = `${count} scanned`;
            pushRecent(result?.label || code, result?.ok !== false);
          }
        }
      }catch(err){ /* keep trying */ }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return { stop };
  }

  return { init, setContext, clearContext, openCameraScan, openContinuousScan };
})();
