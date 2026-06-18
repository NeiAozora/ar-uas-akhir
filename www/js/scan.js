/* =====================================================================
 * UNEJ Heritage AR — SCANNER
 * Menggunakan html5-qrcode (scanapp-org/html5-qrcode)
 * - Kamera live + scan otomatis
 * - Notifikasi valid/invalid + animasi
 * - Upload gambar untuk tes QR
 * ===================================================================== */

let Scanner = (function () {
  let html5QrCode   = null;
  let currentBuilding = null;
  let lastQR        = null;
  let invalidTimeout = null;
  let scannerRunning = false;

  const ui = {};

  /* ---- Cache semua elemen DOM ---- */
  function cacheUI() {
    ui.label       = document.getElementById("detected-text");
    ui.dot         = document.getElementById("dot-indicator");
    ui.sheet       = document.getElementById("bottom-sheet");
    ui.backdrop    = document.getElementById("popup-backdrop");
    ui.sheetTag    = document.getElementById("sheet-tag");
    ui.sheetTitle  = document.getElementById("sheet-title");
    ui.sheetImg    = document.getElementById("sheet-thumb");
    ui.sheetDesc   = document.getElementById("sheet-desc");
    ui.sheetBtn    = document.getElementById("sheet-action");
    ui.toast       = document.getElementById("scan-toast");
    ui.toastIcon   = document.getElementById("toast-icon");
    ui.toastMsg    = document.getElementById("toast-msg");
    ui.imgInput    = document.getElementById("img-file-input");
    ui.imgResult   = document.getElementById("img-test-result");
    ui.viewfinder  = document.getElementById("viewfinder");
  }

  /* ---- Callback QR berhasil terbaca ---- */
  function onScanSuccess(decodedText) {
    if (decodedText === lastQR) return;
    lastQR = decodedText;
    clearTimeout(invalidTimeout);

    const b = DB.byQR(decodedText);
    if (b) {
      currentBuilding = b;
      setLabel(b.name, "ok");
      showToast("✅ QR Valid: " + b.name, "ok");
      pulseViewfinder("ok");
      fillSheet(b);
      openSheet();
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    } else {
      currentBuilding = null;
      setLabel("❌ Bukan QR gedung UNEJ", "invalid");
      showToast("❌ QR tidak dikenali", "invalid");
      pulseViewfinder("invalid");
      invalidTimeout = setTimeout(() => {
        lastQR = null;
        setLabel("Arahkan ke QR gedung…", "idle");
      }, 2500);
    }
  }

  /* ---- Mulai scanner kamera ---- */
  function start() {
    cacheUI();
    setLabel("Mengaktifkan kamera…", "idle");

    html5QrCode = new Html5Qrcode("qr-reader");

    Html5Qrcode.getCameras()
      .then(cameras => {
        if (!cameras || cameras.length === 0) {
          setLabel("Kamera tidak ditemukan", "idle");
          return;
        }
        /* Prioritas: kamera belakang */
        const backCam = cameras.find(c =>
          /back|rear|environment/i.test(c.label)
        ) || cameras[cameras.length - 1];

        html5QrCode.start(
          backCam.id,
          {
            fps: 12,
            qrbox: { width: 250, height: 250 },
            aspectRatio: window.innerWidth < 480 ? 1.0 : 1.333,
          },
          onScanSuccess,
          () => {} // per-frame error diabaikan
        ).then(() => {
          scannerRunning = true;
          setLabel("Arahkan ke QR gedung…", "idle");
        }).catch(err => {
          console.error("Kamera gagal start:", err);
          setLabel("Kamera tidak tersedia", "idle");
        });
      })
      .catch(err => {
        console.error("getCameras gagal:", err);
        setLabel("Izin kamera ditolak", "idle");
      });

    /* --- Event upload gambar untuk tes QR --- */
    if (ui.imgInput) {
      ui.imgInput.addEventListener("change", onImageFileSelected);
    }
  }

  /* ---- Stop scanner ---- */
  function stop() {
    if (html5QrCode && scannerRunning) {
      html5QrCode.stop().catch(() => {});
      scannerRunning = false;
    }
  }

  /* ---- Tes QR dari gambar yang di-upload ---- */
  function onImageFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!ui.imgResult) return;

    ui.imgResult.className = "img-result scanning";
    ui.imgResult.textContent = "🔍 Memproses gambar…";

    // scanFile adalah instance method, bukan static — pakai instance html5QrCode
    // Jika scanner sedang jalan, gunakan instance yang sudah ada.
    // Jika belum (misal kamera belum ready), buat instance sementara.
    const scanner = html5QrCode || new Html5Qrcode("qr-reader-img-dummy");

    scanner.scanFile(file, /* showImage= */ false)
      .then(decodedText => {
        const b = DB.byQR(decodedText);
        if (b) {
          ui.imgResult.className = "img-result valid";
          ui.imgResult.innerHTML =
            "✅ <strong>QR Valid!</strong><br>Gedung: " + b.name +
            "<br><small>Nilai: " + decodedText + "</small>";
          showToast("✅ Gambar valid: " + b.name, "ok");
        } else {
          ui.imgResult.className = "img-result invalid";
          ui.imgResult.innerHTML =
            "⚠️ <strong>QR terbaca tapi tidak dikenali</strong><br>" +
            "<small>Nilai: " + decodedText + "</small>";
          showToast("⚠️ QR terbaca tapi bukan gedung UNEJ", "invalid");
        }
      })
      .catch(() => {
        ui.imgResult.className = "img-result invalid";
        ui.imgResult.innerHTML =
          "❌ <strong>Tidak ditemukan QR code</strong><br>" +
          "<small>Pastikan gambar memuat QR code yang jelas</small>";
        showToast("❌ QR tidak ditemukan di gambar", "invalid");
      });

    // Reset input agar file yang sama bisa dipilih ulang
    e.target.value = "";
  }

  /* ---- Toast notifikasi ---- */
  function showToast(msg, state) {
    if (!ui.toast) return;
    ui.toastMsg.textContent = msg;
    ui.toast.className = "scan-toast show " + state;
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(() => {
      ui.toast.className = "scan-toast";
    }, 2800);
  }

  /* ---- Animasi viewfinder saat scan ---- */
  function pulseViewfinder(state) {
    if (!ui.viewfinder) return;
    ui.viewfinder.classList.remove("pulse-ok", "pulse-invalid");
    void ui.viewfinder.offsetWidth; // reflow
    ui.viewfinder.classList.add("pulse-" + state);
    setTimeout(() => ui.viewfinder.classList.remove("pulse-ok", "pulse-invalid"), 900);
  }

  /* ---- Ubah label + warna dot status ---- */
  function setLabel(txt, state) {
    if (ui.label) ui.label.textContent = txt;
    if (ui.dot) {
      const colors = { ok: "#4ade80", invalid: "#f87171", idle: "#facc15" };
      ui.dot.style.background = colors[state] || "#facc15";
      ui.dot.style.boxShadow  = "0 0 8px " + (colors[state] || "#facc15");
    }
  }

  /* ---- Isi bottom-sheet dengan data gedung ---- */
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
    lastQR = null;
    currentBuilding = null;
    setLabel("Arahkan ke QR gedung…", "idle");
  }

  return { start, stop, openSheet, closeSheet, getCurrent: () => currentBuilding };
})();
