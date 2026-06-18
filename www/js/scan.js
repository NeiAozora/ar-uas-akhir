/* =====================================================================
 * UNEJ Heritage AR — SCANNER (html5-qrcode)
 * ===================================================================== */

let Scanner = (function () {
  let html5QrCode = null;
  let currentBuilding = null;
  let lastQR = null;
  let isRunning = false;
  let invalidTimeout = null;

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

  function onScanSuccess(decodedText) {
    // Abaikan kalau QR sama persis dengan yang terakhir diproses
    if (decodedText === lastQR) return;
    lastQR = decodedText;

    const b = DB.byQR(decodedText);
    if (b) {
      // ✅ QR valid — stop scanner dulu, baru tampilkan info
      stop();
      currentBuilding = b;
      setLabel(b.name, "ok");
      fillSheet(b);
      openSheet();
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    } else {
      // ❌ QR terbaca tapi bukan gedung UNEJ — kasih feedback, lanjut scan
      setLabel("❌ Bukan QR gedung UNEJ", "invalid");
      clearTimeout(invalidTimeout);
      invalidTimeout = setTimeout(() => {
        lastQR = null; // boleh scan lagi
        setLabel("Arahkan ke QR gedung…", "idle");
      }, 2000);
    }
  }

  function start() {
    cacheUI();
    setLabel("Mengaktifkan kamera…", "idle");

    html5QrCode = new Html5Qrcode("qr-reader");

    Html5Qrcode.getCameras().then(cameras => {
      if (!cameras || cameras.length === 0) {
        setLabel("Kamera tidak ditemukan", "idle");
        return;
      }

      const backCam = cameras.find(c =>
        /back|rear|environment/i.test(c.label)
      ) || cameras[cameras.length - 1];

      html5QrCode.start(
        backCam.id,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        onScanSuccess,
        () => {} // abaikan error per-frame (bukan QR = normal)
      ).then(() => {
        isRunning = true;
        setLabel("Arahkan ke QR gedung…", "idle");
      }).catch(err => {
        console.error("Kamera gagal start:", err);
        setLabel("Kamera tidak tersedia", "idle");
      });

    }).catch(err => {
      console.error("getCameras gagal:", err);
      setLabel("Izin kamera ditolak", "idle");
    });
  }

  function stop() {
    if (html5QrCode && isRunning) {
      html5QrCode.stop().catch(() => {});
      isRunning = false;
    }
  }

  // Restart scanner (dipanggil saat sheet ditutup)
  function resume() {
    currentBuilding = null;
    lastQR = null;
    if (html5QrCode && !isRunning) {
      html5QrCode.resume ? html5QrCode.resume() : start();
    } else if (!html5QrCode) {
      start();
    }
    // Kalau sudah running (sheet ditutup tapi kamera masih jalan), reset saja label
    setLabel("Arahkan ke QR gedung…", "idle");
  }

  function setLabel(txt, state) {
    if (ui.label) ui.label.textContent = txt;
    if (ui.dot) {
      const colors = { ok: "#4ade80", invalid: "#f87171", idle: "#facc15" };
      ui.dot.style.background = colors[state] || "#facc15";
    }
  }

  function fillSheet(b) {
    ui.sheetTag.textContent   = b.tag;
    ui.sheetTitle.textContent = b.name;
    ui.sheetImg.src           = b.image;
    ui.sheetDesc.textContent  = b.short + " " + b.history.slice(0, 90) + "…";
    ui.sheetBtn.onclick       = () => App.goDetail(b.id);
  }

  function openSheet() {
    ui.sheet.classList.add("open");
    ui.backdrop.classList.add("show");
  }

  function closeSheet() {
    ui.sheet.classList.remove("open");
    ui.backdrop.classList.remove("show");
    resume(); // restart scan setelah sheet ditutup
  }

  return { start, stop, resume, openSheet, closeSheet, getCurrent: () => currentBuilding };
})();
