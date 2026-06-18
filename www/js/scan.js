// =====================================================================
// UNEJ Heritage AR — SCANNER
// - Upload gambar: stop camera dengan promise, scan, restart
// - Zoom slider: 0.3x – 4.0x (soft zoom via CSS)
// - Filter OBS, deteksi mobile (kamera belakang)
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
  let useSoftZoom = true;
  let currentZoom = 1.0;
  let videoElement = null;
  let currentCameraId = null;

  const ui = {};

  // ---------- DETEKSI MOBILE ----------
  function isMobile() {
    const width = window.innerWidth;
    const ua = navigator.userAgent || navigator.vendor || window.opera;
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

        let filtered = [];
        const mobile = isMobile();
        console.log("📱 Perangkat mobile?", mobile);

        if (mobile) {
          filtered = cameras.filter(cam => {
            const label = cam.label.toLowerCase();
            return label.includes("back") || label.includes("rear");
          });
          if (filtered.length === 0) {
            console.warn("Tidak ada kamera 'back', ambil semua kecuali OBS/virtual");
            filtered = cameras.filter(cam => {
              const label = cam.label.toLowerCase();
              return !label.includes("obs") && !label.includes("virtual");
            });
          }
        } else {
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
          if (filtered.length === 0) filtered = cameras;
        }

        cameraList = filtered;
        currentCameraIndex = 0;
        console.log("📷 Kamera setelah filter:", cameraList.map(c => c.label));
        if (cameraList.length === 0) {
          setLabel("❌ Tidak ada kamera yang sesuai", "invalid");
          showDebugLog(new Error("Tidak ada kamera setelah filter"), "Coba nonaktifkan OBS atau periksa kamera");
          return;
        }

        currentCameraId = cameraList[currentCameraIndex].id;
        startCamera(currentCameraId);
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
    videoElement = null;
    if (ui.zoomControls) ui.zoomControls.style.display = "none";
  }

  // ---------- START KAMERA ----------
  function startCamera(cameraId) {
    // Stop dulu (dengan promise) untuk memastikan bersih
    if (html5QrCode && scannerRunning) {
      html5QrCode.stop()
        .then(() => {
          scannerRunning = false;
          _startCamera(cameraId);
        })
        .catch(() => {
          scannerRunning = false;
          _startCamera(cameraId);
        });
    } else {
      _startCamera(cameraId);
    }
  }

  function _startCamera(cameraId) {
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
      (err) => {}
    )
    .then(() => {
      scannerRunning = true;
      setLabel("Arahkan ke QR gedung…", "idle");
      console.log("✅ Kamera berhasil menyala, ID:", cameraId);
      currentCameraId = cameraId;

      videoElement = document.querySelector("#qr-reader video");
      if (videoElement && videoElement.srcObject) {
        currentStream = videoElement.srcObject;
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
    currentCameraId = cam.id;
    startCamera(cam.id);
  }

  // ========== ZOOM : RANGE 0.3 – 4.0 ==========
  function setupZoom(stream) {
    if (!ui.zoomControls) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      useSoftZoom = true;
      initZoomSlider(0.3, 4.0, 0.1);
      return;
    }

    const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
    if (capabilities.zoom) {
      zoomCapabilities = capabilities.zoom;
      useSoftZoom = false;
      initZoomSlider(0.3, Math.max(4.0, zoomCapabilities.max || 4.0), 0.1);
      console.log("✅ Hardware zoom tersedia (min:", zoomCapabilities.min, "max:", zoomCapabilities.max, ")");
    } else {
      useSoftZoom = true;
      initZoomSlider(0.3, 4.0, 0.1);
      console.log("⚠️ Zoom hardware tidak support, pakai soft zoom (CSS)");
    }
  }

  function initZoomSlider(min, max, step) {
    if (!ui.zoomSlider) return;
    if (min >= max) { min = 0.3; max = 4.0; }

    ui.zoomSlider.min = min;
    ui.zoomSlider.max = max;
    ui.zoomSlider.step = step;
    let defaultValue = Math.min(Math.max(1.0, min), max);
    ui.zoomSlider.value = defaultValue;
    ui.zoomSlider.disabled = false;
    updateZoomDisplay(defaultValue);

    ui.zoomControls.style.display = "flex";

    ui.zoomSlider.oninput = function() {
      const val = parseFloat(this.value);
      applyZoom(val);
    };

    applyZoom(defaultValue);
  }

  function applyZoom(value) {
    const min = parseFloat(ui.zoomSlider.min) || 0.3;
    const max = parseFloat(ui.zoomSlider.max) || 4.0;
    const clamped = Math.min(Math.max(value, min), max);
    currentZoom = clamped;
    updateZoomDisplay(clamped);

    let useHardware = false;
    if (!useSoftZoom && zoomCapabilities && clamped >= 1.0) {
      useHardware = true;
    }

    if (useHardware && currentStream) {
      const videoTrack = currentStream.getVideoTracks()[0];
      if (videoTrack) {
        const hwMin = zoomCapabilities.min || 1;
        const hwMax = zoomCapabilities.max || 4;
        const hwVal = Math.min(Math.max(clamped, hwMin), hwMax);
        videoTrack.applyConstraints({
          advanced: [{ zoom: hwVal }]
        })
        .then(() => {
          console.log("Hardware zoom applied:", hwVal);
        })
        .catch(err => {
          console.error("Hardware zoom gagal, fallback ke soft:", err);
          applySoftZoom(clamped);
        });
        return;
      }
    }

    applySoftZoom(clamped);
  }

  function applySoftZoom(scale) {
    if (videoElement) {
      videoElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
      videoElement.style.transformOrigin = 'center center';
    } else {
      videoElement = document.querySelector("#qr-reader video");
      if (videoElement) {
        videoElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
        videoElement.style.transformOrigin = 'center center';
      }
    }
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

  // ========== UPLOAD GAMBAR — FIX "ongoing camera scan" ==========
  function onImageFileSelected(e) {
    const file = e.target.files[0];
    if (!file) {
      console.warn("Tidak ada file dipilih");
      return;
    }
    if (!ui.imgResult) {
      console.error("Element img-result tidak ditemukan");
      return;
    }

    ui.imgResult.className = "img-result scanning";
    ui.imgResult.textContent = "🔍 Memproses gambar…";

    // Flag apakah kamera sedang berjalan
    const wasRunning = scannerRunning;

    // Fungsi untuk melakukan scan setelah kamera berhenti
    function performScan() {
      // Pastikan scanner sudah berhenti
      let scanner = html5QrCode;
      if (!scanner) {
        try {
          scanner = new Html5Qrcode("qr-reader-img-dummy");
        } catch (err) {
          ui.imgResult.className = "img-result invalid";
          ui.imgResult.innerHTML = "❌ Gagal inisialisasi scanner: " + err.message;
          showToast("❌ Error scanner", "invalid");
          e.target.value = "";
          // Restart kamera jika perlu
          if (wasRunning && currentCameraId) {
            startCamera(currentCameraId);
          }
          return;
        }
      }

      scanner.scanFile(file, false)
        .then(decodedText => {
          console.log("Decoded:", decodedText);
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
            showToast("⚠️ QR bukan gedung UNEJ", "invalid");
          }
        })
        .catch(err => {
          console.error("Scan file error:", err);
          ui.imgResult.className = "img-result invalid";
          ui.imgResult.innerHTML =
            "❌ <strong>Tidak ditemukan QR code</strong><br>" +
            "<small>Pastikan gambar memuat QR code yang jelas</small><br>" +
            "<span style='font-size:11px;color:#888;'>Error: " + (err.message || err) + "</span>";
          showToast("❌ QR tidak ditemukan", "invalid");
        })
        .finally(() => {
          // Reset input
          e.target.value = "";

          // Restart kamera jika sebelumnya berjalan
          if (wasRunning && currentCameraId) {
            console.log("Restart kamera setelah scan file...");
            // Tunggu sebentar agar resource bersih
            setTimeout(() => {
              startCamera(currentCameraId);
            }, 300);
          }
        });
    }

    // Jika kamera sedang berjalan, hentikan dulu dengan promise
    if (wasRunning && html5QrCode) {
      console.log("Menghentikan kamera sementara untuk scan file...");
      html5QrCode.stop()
        .then(() => {
          scannerRunning = false;
          performScan();
        })
        .catch(err => {
          console.warn("Gagal stop kamera, lanjutkan scan:", err);
          scannerRunning = false;
          performScan();
        });
    } else {
      // Kamera tidak berjalan, langsung scan
      performScan();
    }
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

// ---------- EVENT UPLOAD (dipasang ulang) ----------
document.addEventListener("DOMContentLoaded", function() {
  const input = document.getElementById("img-file-input");
  if (input) {
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener("change", function(e) {
      Scanner.onImageFileSelected(e);
    });
    console.log("✅ Event listener upload terpasang");
  } else {
    console.warn("Element #img-file-input tidak ditemukan");
  }
});