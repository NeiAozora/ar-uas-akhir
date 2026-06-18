# UNEJ Heritage AR — VoltBuilder Package

AR app berbasis QR Code untuk menjelajahi gedung bersejarah Universitas Jember.

---

## Cara Build dengan VoltBuilder

### 1. Upload ke VoltBuilder
1. Zip seluruh folder ini (pastikan `config.xml` ada di root zip).
2. Buka [https://volt.build](https://volt.build)
3. Upload zip → pilih **Android** → klik **Build**.

### 2. Target Platform
| Setting               | Nilai       |
|-----------------------|-------------|
| Minimum SDK           | Android 10 (API 29) |
| Target SDK            | Android 10 (API 29) |
| cordova-android       | 9.1.0       |

### 3. Plugins yang digunakan
| Plugin                              | Fungsi                                    |
|-------------------------------------|-------------------------------------------|
| `cordova-plugin-camera`             | Akses kamera (getUserMedia + runtime permission) |
| `cordova-plugin-android-permissions`| Request izin CAMERA saat runtime          |
| `cordova-plugin-statusbar`          | Status bar styling                        |
| `cordova-plugin-splashscreen`       | Splash screen                             |

### 4. Izin Kamera
Izin `android.permission.CAMERA` sudah dideklarasikan di `config.xml` dan diminta saat runtime melalui `cordova-plugin-android-permissions` (lihat `www/js/app.js` → `App.ensureCameraPermission()`).

---

## Struktur File
```
config.xml          ← Konfigurasi Cordova / VoltBuilder (WAJIB di root)
package.json        ← Plugin & platform declarations
www/
  index.html        ← Halaman awal (redirect ke beranda)
  beranda.html      ← Beranda
  scan.html         ← Scanner QR + kamera AR
  daftar.html       ← Daftar gedung
  detail.html       ← Detail sejarah gedung
  tentang.html      ← Tentang aplikasi
  js/
    app.js          ← Core navigasi & camera permission helper
    scan.js         ← Scanner QR via jsQR + getUserMedia
    data.js         ← Database gedung offline
    jsQR.js         ← Library QR decode
  img/              ← Foto gedung & logo
  markers/          ← QR marker untuk dicetak
```
