// =====================================================================
// UNEJ Heritage AR — SCANNER FINAL (dengan deteksi mobile/PC)
// - Mobile: hanya kamera "back" / "rear"
// - PC: filter OBS/virtual
// - Zoom slider vertikal di kiri (hanya jika support)
// - Tombol ganti kamera
// - Popup debug jika error
// =====================================================================

let Scanner = (function () {
  let html5QrCode   = null;
  let currentBuilding = null;
  let lastQR        = null;
  let invalidTimeout = null;
  let scannerRunning = false;

  let cameraList = [];
  let currentCameraIndex = 0;
  let currentStream = null;
  let zoomCapabilities = null;

  const ui = {};

  // ---------- DETEKSI MOBILE ----------
  function isMobile() {
    // Cek lebar layar atau user agent
    const width = window.innerWidth;
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    // Jika lebar <= 768px atau user agent mengandung mobile keyword
    const mobileKeywords = /android|iphone|ipad|ipod|blackberry|windows phone/i;
    return (width <= 768) || mobileKeywords.test(ua);
  }

  // ---------- CACHE UI ----------
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
    ui.toastMsg    = document.getElementById("toast-msg");
    ui.imgInput    = document.getElementById("img-file-input");
    ui.imgResult   = document.getElementById("img-test-result");
    ui.viewfinder  = document.getElementById("viewfinder");
    ui.zoomSlider  = document.getElementById("zoom-slider");
    ui.zoomValue   = document.getElementById("zoom-value");
    ui.zoomControls = document.getElementById("zoom-controls");
    ui.debugModal  = document.getElementById("debug-modal");
    ui.debugContent = document.getElementById("debug-content");
  }

  // ---------- TOAST / LABEL ----------
  function showToast(msg, state) {
    if (!ui.toast) return;
    ui.toastMsg.textContent = msg;
    ui.toast.className = "scan-toast show " + state;
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(() => {
      ui.toast.className = "scan-toast";
    }, 2800);
  }

  function setLabel(txt, state) {
    if (ui.label) ui.label.textContent = txt;
    if (ui.dot) {
      const colors = { ok: "#4ade80", invalid: "#f87171", idle: "#facc15" };
      ui.dot.style.background = colors[state] || "#facc15";
      ui.dot.style.boxShadow  = "0 0 8px " + (colors[state] || "#facc15");
    }
  }

  function pulseViewfinder(state) {
    if (!ui.viewfinder) return;
    ui.viewfinder.classList.remove("pulse-ok", "pulse-invalid");
    void ui.viewfinder.offsetWidth;
    ui.viewfinder.classList.add("pulse-" + state);
    setTimeout(() => ui.viewfinder.classList.remove("pulse-ok", "pulse-invalid"), 900);
  }

  // ---------- DEBUG POPUP ----------
  function showDebugLog(error, extra) {
    if (!ui.debugModal) return;
    let content = "🚨 ERROR START VIDEO\n\n";
    content += "Message: " + (error.message || error) + "\n";
    if (extra) content += extra + "\n";
    content += "Stack:\n" + (error.stack || "Tidak ada stack");
    ui.debugContent.textContent = content;
    ui.debugModal.classList.add("show");
  }

  // ---------- QR CALLBACK ----------
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

  // ---------- START ----------
  function start() {
    cacheUI();
    setLabel("Mengaktifkan kamera…", "idle");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLabel("❌ Browser tidak support kamera", "invalid");
      showDebugLog(new Error("getUserMedia tidak tersedia"), "Periksa browser Anda");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        return Html5Qrcode.getCameras();
      })
      .then(cameras => {
        if (!cameras || cameras.length === 0) {
          setLabel("❌ Tidak ada kamera", "invalid");
          showDebugLog(new Error("Tidak ada kamera terdeteksi"), "Pastikan perangkat memiliki kamera");
          return;
        }

        // ===== FILTER KAMERA BERDASARKAN PERANGKAT =====
        let filtered = [];
        const mobile = isMobile();
        console.log("📱 Perangkat mobile?", mobile);

        if (mobile) {
          // MOBILE: cari kamera dengan label "back" atau "rear"
          filtered = cameras.filter(cam => {
            const label = cam.label.toLowerCase();
            return label.includes("back") || label.includes("rear");
          });
          // Jika tidak ada, ambil semua (tapi tetap buang OBS/virtual)
          if (filtered.length === 0) {
            console.warn("Tidak ada kamera 'back', ambil semua kamera fisik");
            filtered = cameras.filter(cam => {
              const label = cam.label.toLowerCase();
              return !label.includes("obs") && !label.includes("virtual");
            });
          }
        } else {
          // PC: filter OBS / virtual seperti sebelumnya
          const virtualKeywords = ["obs", "virtual", "manycam", "screen", "display", "capture"];
          filtered = cameras.filter(cam => {
            const label = cam.label.toLowerCase();
            const isVirtual = virtualKeywords.some(kw => label.includes(kw));
            const isPhysical = label.includes("back") || label.includes("rear") || label.includes("environment");
            return !isVirtual || isPhysical;
          });
          if (filtered.length === 0) {
            filtered = cameras.filter(cam => {
              const label = cam.label.toLowerCase();
              return !label.includes("obs") && !label.includes("virtual");
            });
          }
          if (filtered.length === 0) filtered = cameras; // fallback
        }

        cameraList = filtered;
        currentCameraIndex = 0;
        console.log("📷 Kamera setelah filter:", cameraList.map(c => c.label));
        if (cameraList.length === 0) {
          setLabel("❌ Tidak ada kamera yang sesuai", "invalid");
          showDebugLog(new Error("Tidak ada kamera setelah filter"), "Coba nonaktifkan OBS atau periksa kamera");
          return;
        }

        startCamera(cameraList[currentCameraIndex].id);
      })
      .catch(err => {
        console.error("❌ Error inisialisasi:", err);
        setLabel("❌ Gagal akses kamera", "invalid");
        showDebugLog(err, "Coba periksa izin kamera di browser");
      });
  }

  // ---------- STOP ----------
  function stopCamera() {
    if (html5QrCode && scannerRunning) {
      html5QrCode.stop().catch(() => {});
      scannerRunning = false;
    }
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    if (ui.zoomControls) ui.zoomControls.style.display = "none";
  }

  // ---------- START KAMERA DENGAN ID ----------
  function startCamera(cameraId) {
    stopCamera();

    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qr-reader");
    }

    const container = document.getElementById("qr-reader");
    const rect = container.getBoundingClientRect();
    const viewportSize = Math.min(rect.width, rect.height);
    const qrSize = Math.min(Math.max(200, viewportSize * 0.7), 350);

    setLabel("Memulai kamera…", "idle");

    html5QrCode.start(
      cameraId,
      {
        fps: 12,
        qrbox: { width: qrSize, height: qrSize },
        aspectRatio: 1.333,
      },
      onScanSuccess,
      (err) => {} // abaikan frame error
    )
    .then(() => {
      scannerRunning = true;
      setLabel("Arahkan ke QR gedung…", "idle");
      console.log("✅ Kamera berhasil menyala, ID:", cameraId);

      const video = document.querySelector("#qr-reader video");
      if (video && video.srcObject) {
        currentStream = video.srcObject;
        setupZoom(currentStream);
      } else {
        try {
          if (html5QrCode.getMediaStream) {
            currentStream = html5QrCode.getMediaStream();
            setupZoom(currentStream);
          }
        } catch(e) {}
      }
    })
    .catch(err => {
      console.error("❌ Gagal start kamera:", err);
      setLabel("❌ Gagal start kamera", "invalid");
      showDebugLog(err, "ID kamera: " + cameraId + "\nDaftar kamera: " + JSON.stringify(cameraList.map(c => c.label)));
    });
  }

  // ---------- SWITCH KAMERA ----------
  function switchCamera() {
    if (!cameraList || cameraList.length < 2) {
      showToast("Hanya ada 1 kamera", "invalid");
      return;
    }
    currentCameraIndex = (currentCameraIndex + 1) % cameraList.length;
    const cam = cameraList[currentCameraIndex];
    showToast("🔄 Beralih ke: " + cam.label, "ok");
    startCamera(cam.id);
  }

  // ---------- ZOOM ----------
  function setupZoom(stream) {
    if (!ui.zoomControls) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      ui.zoomControls.style.display = "none";
      return;
    }

    const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
    if (capabilities.zoom) {
      zoomCapabilities = capabilities.zoom;
      const min = zoomCapabilities.min || 1;
      const max = zoomCapabilities.max || 4;
      const step = zoomCapabilities.step || 0.1;

      ui.zoomSlider.min = min;
      ui.zoomSlider.max = max;
      ui.zoomSlider.step = step;
      ui.zoomSlider.value = Math.min(Math.max(1, min), max);
      ui.zoomSlider.disabled = false;
      updateZoomDisplay(ui.zoomSlider.value);

      ui.zoomControls.style.display = "flex";

      ui.zoomSlider.oninput = function() {
        const val = parseFloat(this.value);
        applyZoom(val);
      };
    } else {
      ui.zoomControls.style.display = "none";
      console.log("Zoom tidak didukung oleh kamera ini");
    }
  }

  function applyZoom(value) {
    if (!currentStream) return;
    const videoTrack = currentStream.getVideoTracks()[0];
    if (!videoTrack) return;
    const clamped = Math.min(Math.max(value, zoomCapabilities?.min || 1), zoomCapabilities?.max || 4);
    videoTrack.applyConstraints({
      advanced: [{ zoom: clamped }]
    })
    .then(() => {
      updateZoomDisplay(clamped);
    })
    .catch(err => console.error("Gagal apply zoom:", err));
  }

  function updateZoomDisplay(val) {
    if (ui.zoomValue) {
      ui.zoomValue.textContent = parseFloat(val).toFixed(1) + "x";
    }
  }

  // ---------- BOTTOM SHEET ----------
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

  // ---------- UPLOAD GAMBAR ----------
  function onImageFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!ui.imgResult) return;

    ui.imgResult.className = "img-result scanning";
    ui.imgResult.textContent = "🔍 Memproses gambar…";

    const scanner = html5QrCode || new Html5Qrcode("qr-reader-img-dummy");

    scanner.scanFile(file, false)
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

  // ========== PUBLIC API ==========
  return {
    start,
    stop: stopCamera,
    openSheet,
    closeSheet,
    getCurrent: () => currentBuilding,
    switchCamera,
    onImageFileSelected,
  };
})();

// ---------- EVENT UPLOAD ----------
document.addEventListener("DOMContentLoaded", function() {
  const input = document.getElementById("img-file-input");
  if (input) {
    input.addEventListener("change", function(e) {
      Scanner.onImageFileSelected(e);
    });
  }
});