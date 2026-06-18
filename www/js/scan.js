// =====================================================================
// UNEJ Heritage AR — SCANNER (Dengan Switch Camera & Zoom)
// - Filter OBS otomatis
// - Zoom hanya muncul jika didukung
// - Switch kamera depan/belakang
// =====================================================================

let Scanner = (function () {
  let html5QrCode   = null;
  let currentBuilding = null;
  let lastQR        = null;
  let invalidTimeout = null;
  let scannerRunning = false;
  let selectedCameraId = null;
  let allCameras = [];
  let mediaStream = null;
  let zoomCapabilities = null;
  let currentZoom = 1.0;
  let isZoomSupported = false;
  let cameraIndex = 0; // untuk cycle kamera

  const ui = {};

  // Cache DOM
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
    ui.zoomSlider  = document.getElementById("zoom-slider");
    ui.zoomValue   = document.getElementById("zoom-value");
    ui.zoomContainer = document.getElementById("zoom-controls");
    ui.switchBtn   = document.getElementById("switch-camera-btn");
  }

  // Callback QR
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

  // ========== START ==========
  function start() {
    cacheUI();
    setLabel("Mengaktifkan kamera…", "idle");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLabel("❌ Browser tidak support kamera", "invalid");
      return;
    }

    // Sembunyikan zoom dulu
    if (ui.zoomContainer) ui.zoomContainer.style.display = "none";

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        initScanner();
      })
      .catch(err => {
        console.error("❌ Izin kamera ditolak:", err);
        setLabel("❌ Izin kamera ditolak", "invalid");
        showToast("⚠️ Izin kamera diperlukan", "invalid");
      });
  }

  // ========== INIT SCANNER ==========
  function initScanner() {
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

        allCameras = cameras;
        console.log("📷 Daftar semua kamera:", allCameras.map(c => c.label));

        // Filter OBS / virtual
        const virtualKeywords = ["obs", "virtual", "manycam", "screen", "display", "capture"];
        let filtered = allCameras.filter(cam => {
          const label = cam.label.toLowerCase();
          const isVirtual = virtualKeywords.some(kw => label.includes(kw));
          const isPhysical = label.includes("back") || label.includes("rear") || label.includes("environment");
          return !isVirtual || isPhysical;
        });
        if (filtered.length === 0) {
          filtered = allCameras.filter(cam => {
            const label = cam.label.toLowerCase();
            return !label.includes("obs") && !label.includes("virtual");
          });
        }
        if (filtered.length === 0) filtered = allCameras;

        // Pilih kamera pertama (biasanya belakang)
        let selected = filtered.find(c =>
          /back|rear|environment/i.test(c.label)
        ) || filtered[0];

        // Jika masih OBS, paksa ambil terakhir
        if (selected && selected.label.toLowerCase().includes("obs")) {
          selected = allCameras[allCameras.length - 1];
        }

        // Simpan indeks kamera yang dipilih untuk switch
        cameraIndex = allCameras.indexOf(selected);
        if (cameraIndex === -1) cameraIndex = 0;

        selectedCameraId = selected.id;
        console.log("✅ Kamera dipilih:", selected.label);

        // Tampilkan tombol switch jika ada >1 kamera
        if (ui.switchBtn) {
          ui.switchBtn.style.display = (allCameras.length > 1) ? "flex" : "none";
          ui.switchBtn.onclick = switchCamera;
        }

        startScannerWithCamera(selectedCameraId);
      })
      .catch(err => {
        console.error("❌ getCameras gagal:", err);
        setLabel("❌ " + err.message, "invalid");
      });
  }

  // ========== MULAI SCANNER DENGAN KAMERA TERTENTU ==========
  function startScannerWithCamera(cameraId) {
    const container = document.getElementById("qr-reader");
    const rect = container.getBoundingClientRect();
    const viewportSize = Math.min(rect.width, rect.height);
    const qrSize = Math.min(Math.max(200, viewportSize * 0.7), 350);

    html5QrCode.start(
      cameraId,
      {
        fps: 12,
        qrbox: { width: qrSize, height: qrSize },
        aspectRatio: 1.333,
      },
      onScanSuccess,
      (err) => {}
    )
    .then(() => {
      scannerRunning = true;
      setLabel("Arahkan ke QR gedung…", "idle");
      console.log("✅ Kamera berjalan dengan ID:", cameraId);

      // Ambil stream untuk zoom
      const videoElement = document.querySelector("#qr-reader video");
      if (videoElement && videoElement.srcObject) {
        mediaStream = videoElement.srcObject;
        setupZoom(mediaStream);
      } else {
        // Fallback
        const stream = html5QrCode.getMediaStream ? html5QrCode.getMediaStream() : null;
        if (stream) {
          mediaStream = stream;
          setupZoom(stream);
        }
      }
    })
    .catch(err => {
      console.error("❌ Gagal start kamera:", err);
      setLabel("❌ " + err.message, "invalid");
    });
  }

  // ========== SETUP ZOOM ==========
  function setupZoom(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.warn("Tidak ada video track");
      return;
    }

    const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
    if (capabilities.zoom && capabilities.zoom.max > 1) {
      isZoomSupported = true;
      zoomCapabilities = capabilities.zoom;
      const min = zoomCapabilities.min || 1;
      const max = zoomCapabilities.max || 4;
      const step = zoomCapabilities.step || 0.1;
      currentZoom = Math.min(Math.max(1, min), max);

      // Tampilkan slider zoom
      if (ui.zoomContainer) {
        ui.zoomContainer.style.display = "flex";
      }
      if (ui.zoomSlider) {
        ui.zoomSlider.min = min;
        ui.zoomSlider.max = max;
        ui.zoomSlider.step = step;
        ui.zoomSlider.value = currentZoom;
        ui.zoomSlider.disabled = false;
        updateZoomDisplay(currentZoom);

        ui.zoomSlider.oninput = function () {
          const val = parseFloat(this.value);
          applyZoom(val);
        };
      }
      console.log("✅ Zoom didukung:", zoomCapabilities);
    } else {
      isZoomSupported = false;
      if (ui.zoomContainer) {
        ui.zoomContainer.style.display = "none";
      }
      console.warn("❌ Zoom tidak didukung oleh kamera ini");
    }
  }

  // ========== APPLY ZOOM ==========
  function applyZoom(value) {
    if (!mediaStream) return;
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const clamped = Math.min(Math.max(value, zoomCapabilities?.min || 1), zoomCapabilities?.max || 4);
    currentZoom = clamped;

    videoTrack.applyConstraints({
      advanced: [{ zoom: clamped }]
    })
    .then(() => {
      updateZoomDisplay(clamped);
      console.log("Zoom applied:", clamped);
    })
    .catch(err => {
      console.error("Gagal apply zoom:", err);
    });
  }

  function updateZoomDisplay(val) {
    if (ui.zoomValue) {
      ui.zoomValue.textContent = val.toFixed(1) + "x";
    }
  }

  // ========== SWITCH CAMERA ==========
  function switchCamera() {
    if (!allCameras || allCameras.length < 2) {
      showToast("Hanya ada 1 kamera", "invalid");
      return;
    }

    // Pilih kamera berikutnya secara round-robin
    cameraIndex = (cameraIndex + 1) % allCameras.length;
    const nextCam = allCameras[cameraIndex];
    selectedCameraId = nextCam.id;
    console.log("🔄 Switch ke:", nextCam.label);

    // Hentikan scanner lama
    if (html5QrCode && scannerRunning) {
      html5QrCode.stop().catch(() => {});
      scannerRunning = false;
    }

    // Mulai dengan kamera baru
    setLabel("Mengganti kamera…", "idle");
    // Sembunyikan zoom dulu
    if (ui.zoomContainer) ui.zoomContainer.style.display = "none";

    // Tunggu sebentar lalu start ulang
    setTimeout(() => {
      startScannerWithCamera(selectedCameraId);
    }, 300);
  }

  // ========== STOP ==========
  function stop() {
    if (html5QrCode && scannerRunning) {
      html5QrCode.stop().catch(() => {});
      scannerRunning = false;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
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

  // ========== UI HELPERS ==========
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

  // ========== PUBLIC ==========
  return {
    start,
    stop,
    openSheet,
    closeSheet,
    getCurrent: () => currentBuilding,
    switchCamera,
    getZoom: () => currentZoom
  };
})();