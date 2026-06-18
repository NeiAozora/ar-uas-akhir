/* =====================================================================
 * UNEJ Heritage AR — SCANNER (Marker-based AR via QR Code)
 * ---------------------------------------------------------------------
 * Alur:
 *   1. Aktifkan kamera belakang (getUserMedia).
 *   2. Tiap frame digambar ke <canvas> tersembunyi, lalu jsQR membaca
 *      isi QR code.
 *   3. Isi QR dicocokkan ke data gedung (DB.byQR). Jika cocok:
 *      - label "terdeteksi" di-update,
 *      - bottom sheet info muncul otomatis,
 *      - tombol "Buka Detail" mengarah ke detail.html?id=...
 * ===================================================================== */

let Scanner = (function () {
  let video, canvas, ctx, raf;
  let currentBuilding = null;
  let lastQR = null;

  const ui = {};

  function cacheUI() {
    ui.label      = document.getElementById("detected-text");
    ui.dot        = document.getElementById("dot-indicator");
    ui.sheet      = document.getElementById("bottom-sheet");
    ui.backdrop   = document.getElementById("popup-backdrop");
    ui.sheetTag   = document.getElementById("sheet-tag");
    ui.sheetTitle = document.getElementById("sheet-title");
    ui.sheetImg   = document.getElementById("sheet-thumb");
    ui.sheetDesc  = document.getElementById("sheet-desc");
    ui.sheetBtn   = document.getElementById("sheet-action");
  }

  async function start() {
    cacheUI();
    video  = document.getElementById("camera-stream");
    canvas = document.getElementById("scan-canvas");
    ctx    = canvas.getContext("2d", { willReadFrequently: true });

    const ok = await App.ensureCameraPermission();
    if (!ok) { setLabel("Izin kamera ditolak", false); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = stream;
      await video.play();
      setLabel("Arahkan ke QR gedung…", false);
      raf = requestAnimationFrame(tick);
    } catch (err) {
      console.error("Kamera gagal:", err);
      setLabel("Kamera tidak tersedia", false);
    }
  }

  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) handleQR(code.data);
    }
    raf = requestAnimationFrame(tick);
  }

  function handleQR(text) {
    if (text === lastQR) return;       // hindari proses berulang frame yang sama
    lastQR = text;
    const b = DB.byQR(text);
    if (b) {
      currentBuilding = b;
      setLabel(b.name, true);
      fillSheet(b);
      openSheet();
      if (navigator.vibrate) navigator.vibrate(120);
    } else {
      setLabel("QR tidak dikenal", false);
      setTimeout(() => { lastQR = null; }, 1500); // boleh coba lagi
    }
  }

  function setLabel(txt, active) {
    if (ui.label) ui.label.textContent = txt;
    if (ui.dot) ui.dot.style.background = active ? "#4ade80" : "#facc15";
  }

  function fillSheet(b) {
    ui.sheetTag.textContent   = b.tag;
    ui.sheetTitle.textContent = b.name;
    ui.sheetImg.src           = b.image;
    ui.sheetDesc.textContent  = b.short + " " + b.history.slice(0, 90) + "…";
    ui.sheetBtn.onclick       = () => App.goDetail(b.id);
  }

  function openSheet()  { ui.sheet.classList.add("open");  ui.backdrop.classList.add("show"); }
  function closeSheet() { ui.sheet.classList.remove("open"); ui.backdrop.classList.remove("show"); lastQR = null; }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  }

  return { start, stop, openSheet, closeSheet, getCurrent: () => currentBuilding };
})();
