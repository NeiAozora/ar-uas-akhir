/* =====================================================================
 * UNEJ Heritage AR — APP CORE (navigasi & util bersama)
 * ===================================================================== */

const App = {
  /* Navigasi antar-halaman (route berbasis file untuk Cordova) */
  go(page)            { window.location.href = page; },
  goDetail(id)        { window.location.href = "detail.html?id=" + encodeURIComponent(id); },

  /* Ambil parameter dari URL, mis. detail.html?id=rektorat -> "rektorat" */
  param(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  /* Render satu kartu (dipakai di beranda & daftar) */
  buildingCardHTML(b) {
    return `
      <div class="building-card" onclick="App.goDetail('${b.id}')">
        <img src="${b.image}" alt="${b.name}">
        <div class="card-content">
          <span class="tag">${b.tag}</span>
          <h4 class="card-title">${b.name}</h4>
          <div class="card-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#718096" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
            </svg>${b.location}
          </div>
        </div>
      </div>`;
  },

  listCardHTML(b) {
    return `
      <div class="list-card" onclick="App.goDetail('${b.id}')">
        <img src="${b.image}" alt="${b.name}">
        <div class="card-info">
          <h4>${b.name}</h4>
          <p>${b.short}</p>
        </div>
        <div class="arrow-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>`;
  },

  /* Minta izin kamera saat runtime.
     Menggunakan Permissions API standar — tidak butuh plugin tambahan.
     getUserMedia() sendiri sudah memunculkan dialog izin Android secara native. */
  ensureCameraPermission() {
    return new Promise((resolve) => {
      // Jika Permissions API tersedia, cek dulu sebelum meminta
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' })
          .then((result) => {
            // 'granted' atau 'prompt' → lanjut, getUserMedia yang akan minta izin
            resolve(result.state !== 'denied');
          })
          .catch(() => resolve(true)); // API tidak support 'camera' query → lanjut saja
      } else {
        // Fallback: langsung lanjut, getUserMedia akan trigger dialog izin sendiri
        resolve(true);
      }
    });
  }
};

/* Jika dijalankan di Cordova, tunggu deviceready sebelum aksi device.
   Di browser, langsung jalan. Halaman bisa pakai App.onReady(cb). */
App.onReady = function (cb) {
  if (window.cordova) {
    document.addEventListener("deviceready", cb, false);
  } else {
    if (document.readyState !== "loading") cb();
    else document.addEventListener("DOMContentLoaded", cb);
  }
};
