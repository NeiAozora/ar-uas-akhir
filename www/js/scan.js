// =====================================================================
// UNEJ Heritage AR — SCANNER (PATCHED)
// - Pengecekan izin kamera eksplisit
// - qrbox dinamis menyesuaikan viewport
// - CSS dipastikan tidak menimpa video
// =====================================================================

let Scanner = (function () {
  let html5QrCode   = null;
  let currentBuilding = null;
  let lastQR        = null;
  let invalidTimeout = null;
  let scannerRunning = false;

  const ui = {};

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

  // ========== FUNGSI START YANG DIPERBAIKI ==========
  function start() {
    cacheUI();
    setLabel("Mengaktifkan kamera…", "idle");

    // 1️⃣ Cek dukungan getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLabel("❌ Browser tidak support kamera", "invalid");
      console.error("getUserMedia tidak tersedia");
      return;
    }

    // 2️⃣ Minta izin secara eksplisit (agar pengguna tidak bingung)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        // Izin diberikan, stop stream sementara
        stream.getTracks().forEach(t => t.stop());
        // Lanjut inisialisasi scanner
        initScanner();
      })
      .catch(err => {
        console.error("❌ Izin kamera ditolak:", err);
        setLabel("❌ Izin kamera ditolak — klik ikon gembok di URL", "invalid");
        // Tampilkan pesan di toast juga
        showToast("⚠️ Izin kamera diperlukan — periksa pengaturan browser", "invalid");
      });
  }

  // Fungsi inisialisasi scanner (dipanggil setelah izin OK)
  function initScanner() {
    // Hentikan scanner lama jika ada
    if (html5QrCode) {
      html5QrCode.stop().catch(() => {});
      html5QrCode.clear().catch(() => {});
      html5QrCode = null;
    }

    html5QrCode = new Html5Qrcode("qr-reader");

    Html5Qrcode.getCameras()
      .then(cameras => {
        if (!cameras || cameras.length === 0) {
          setLabel("❌ Tidak ada kamera terdeteksi", "invalid");
          return;
        }

        // Pilih kamera belakang jika ada
        const backCam = cameras.find(c =>
          /back|rear|environment/i.test(c.label)
        ) || cameras[cameras.length - 1];

        // Dapatkan ukuran container untuk qrbox dinamis
        const container = document.getElementById("qr-reader");
        const rect = container.getBoundingClientRect();
        const viewportSize = Math.min(rect.width, rect.height);
        // qrbox antara 200px dan 70% dari ukuran terkecil
        const qrSize = Math.min(Math.max(200, viewportSize * 0.7), 350);

        console.log("📐 qrbox size:", qrSize);

        html5QrCode.start(
          backCam.id,
          {
            fps: 12,
            qrbox: { width: qrSize, height: qrSize },
            aspectRatio: 1.333,
          },
          onScanSuccess,
          (err) => {
            // Abaikan error per-frame (biasanya noise)
          }
        )
        .then(() => {
          scannerRunning = true;
          setLabel("Arahkan ke QR gedung…", "idle");
          console.log("✅ Kamera berhasil menyala!");
        })
        .catch(err => {
          console.error("❌ Gagal start kamera:", err);
          setLabel("❌ " + err.message, "invalid");
        });
      })
      .catch(err => {
        console.error("❌ getCameras gagal:", err);
        setLabel("❌ " + err.message, "invalid");
      });
  }

  // ========== FUNGSI STOP ==========
  function stop() {
    if (html5QrCode && scannerRunning) {
      html5QrCode.stop().catch(() => {});
      scannerRunning = false;
    }
  }

  // ========== TES GAMBAR ==========
  function onImageFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!ui.imgResult) return;

    ui.imgResult.className = "img-result scanning";
    ui.imgResult.textContent = "🔍 Memproses gambar…";

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

    e.target.value = "";
  }

  // ========== UI HELPER ==========
  function showToast(msg, state) {
    if (!ui.toast) return;
    ui.toastMsg.textContent = msg;
    ui.toast.className = "scan-toast show " + state;
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(() => {
      ui.toast.className = "scan-toast";
    }, 2800);
  }

  function pulseViewfinder(state) {
    if (!ui.viewfinder) return;
    ui.viewfinder.classList.remove("pulse-ok", "pulse-invalid");
    void ui.viewfinder.offsetWidth;
    ui.viewfinder.classList.add("pulse-" + state);
    setTimeout(() => ui.viewfinder.classList.remove("pulse-ok", "pulse-invalid"), 900);
  }

  function setLabel(txt, state) {
    if (ui.label) ui.label.textContent = txt;
    if (ui.dot) {
      const colors = { ok: "#4ade80", invalid: "#f87171", idle: "#facc15" };
      ui.dot.style.background = colors[state] || "#facc15";
      ui.dot.style.boxShadow  = "0 0 8px " + (colors[state] || "#facc15");
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
    lastQR = null;
    currentBuilding = null;
    setLabel("Arahkan ke QR gedung…", "idle");
  }

  // ========== PUBLIC API ==========
  return {
    start,
    stop,
    openSheet,
    closeSheet,
    getCurrent: () => currentBuilding
  };
})();