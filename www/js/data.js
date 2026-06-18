/* =====================================================================
 * UNEJ Heritage AR — DATA OFFLINE
 * ---------------------------------------------------------------------
 * Semua data gedung disimpan di sini (tanpa internet / tanpa server).
 * Field `qr` = isi teks di dalam QR code yang dipakai sebagai MARKER.
 * Saat kamera memindai QR berisi teks ini, aplikasi mencocokkannya
 * ke gedung yang sesuai. File QR siap-cetak ada di folder /markers.
 * ===================================================================== */

const BUILDINGS = [
  {
    id: "rektorat",
    qr: "UNEJ-REKTORAT",              // <- isi QR code (marker)
    name: "Gedung Rektorat",
    tag: "Bersejarah",
    location: "Kampus Pusat, Jember",
    image: "img/rektorat.jpg",
    featured: true,                    // tampil di "Bangunan Unggulan"
    category: "bersejarah",            // untuk filter di halaman Daftar
    year: 1964,
    style: "Modern Tropis",
    short: "Pusat administrasi Universitas Jember sejak 1964.",
    history:
      "Gedung Rektorat merupakan bangunan utama di Universitas Jember. " +
      "Mulai dibangun pada awal tahun 1960-an, gedung ini menjadi saksi " +
      "bisu perkembangan akademik di Jawa Timur dan pusat administrasi " +
      "penting bagi ribuan mahasiswa sejak berdirinya.",
    architecture: [
      { title: "Pilar Utama", text: "Struktur pilar yang kokoh melambangkan kekuatan fondasi ilmu pengetahuan yang diberikan universitas." },
      { title: "Jendela Tropis", text: "Desain jendela yang luas dirancang untuk memaksimalkan sirkulasi udara alami khas bangunan tropis." }
    ],
    trivia: [
      "Jam di bagian atas didatangkan langsung dari luar negeri pada masa pembangunannya.",
      "Terdapat kapsul waktu yang dikubur di pelataran utama pada perayaan dies natalis ke-50."
    ],
    nearby: ["perpustakaan", "sastra", "fasilkom"]
  },
  {
    id: "perpustakaan",
    qr: "UNEJ-PERPUS",
    name: "UPA Perpustakaan",
    tag: "Bersejarah",
    location: "Kampus Tegalboto, Jember",
    image: "img/perpustakaan.webp",
    featured: false,
    category: "bersejarah",
    year: 1982,
    style: "Modern",
    short: "Pusat literasi dengan koleksi digital terlengkap.",
    history:
      "UPA Perpustakaan menjadi jantung literasi kampus, menyimpan koleksi " +
      "cetak dan digital yang terus berkembang untuk mendukung kegiatan " +
      "akademik seluruh fakultas di Universitas Jember.",
    architecture: [
      { title: "Ruang Baca Terbuka", text: "Tata ruang terbuka memaksimalkan pencahayaan alami untuk kenyamanan membaca." },
      { title: "Fasad Kaca", text: "Dinding kaca lebar menghubungkan ruang baca dengan taman di sekitarnya." }
    ],
    trivia: [
      "Menyimpan koleksi skripsi dan tesis lintas dekade dalam bentuk digital.",
      "Memiliki ruang diskusi kelompok yang dapat dipesan secara daring."
    ],
    nearby: ["rektorat", "fasilkom"]
  },
  {
    id: "fasilkom",
    qr: "UNEJ-FASILKOM",
    name: "Fakultas Ilmu Komputer",
    tag: "Fakultas",
    location: "Kampus Timur, Jember",
    image: "img/fasilkom.webp",
    featured: true,
    category: "fakultas",
    year: 2014,
    style: "Kontemporer",
    short: "Gedung modern untuk inovasi teknologi informasi.",
    history:
      "Fakultas Ilmu Komputer menempati gedung modern yang dirancang untuk " +
      "mendukung riset dan inovasi di bidang teknologi informasi, lengkap " +
      "dengan laboratorium komputer dan ruang kolaborasi.",
    architecture: [
      { title: "Lab Komputer", text: "Beberapa laboratorium komputer mendukung praktikum dan riset mahasiswa." },
      { title: "Desain Modular", text: "Tata ruang modular memudahkan penyesuaian fungsi ruang sesuai kebutuhan." }
    ],
    trivia: [
      "Salah satu fakultas termuda namun berkembang pesat di UNEJ.",
      "Sering menjadi tuan rumah kompetisi pemrograman tingkat regional."
    ],
    nearby: ["sastra", "rektorat"]
  },
  {
    id: "sastra",
    qr: "UNEJ-SASTRA",
    name: "Fakultas Ilmu Budaya",
    tag: "Fakultas",
    location: "Kampus Timur, Jember",
    image: "img/sastra.jpg",
    featured: false,
    category: "fakultas",
    year: 1972,
    style: "Klasik Tropis",
    short: "Pusat kajian bahasa, sastra, dan budaya.",
    history:
      "Fakultas Sastra (kini Fakultas Ilmu Budaya) merupakan salah satu " +
      "fakultas tertua di Universitas Jember, menjadi pusat kajian bahasa, " +
      "sastra, sejarah, dan budaya.",
    architecture: [
      { title: "Koridor Terbuka", text: "Koridor panjang dengan ventilasi silang khas bangunan tropis lama." },
      { title: "Aula Pertunjukan", text: "Memiliki ruang yang kerap dipakai untuk pementasan seni dan sastra." }
    ],
    trivia: [
      "Menjadi rumah bagi komunitas teater dan sastra mahasiswa.",
      "Banyak alumni menjadi sastrawan dan budayawan terkenal."
    ],
    nearby: ["fasilkom", "rektorat", "perpustakaan"]
  }
];

/* ------- Helper akses data (dipakai semua halaman) ------- */
const DB = {
  all()            { return BUILDINGS; },
  byId(id)         { return BUILDINGS.find(b => b.id === id) || null; },
  byQR(text)       { return BUILDINGS.find(b => b.qr === (text || "").trim().toUpperCase()) || null; },
  featured()       { return BUILDINGS.filter(b => b.featured); },
  byCategory(cat)  { return cat === "semua" ? BUILDINGS : BUILDINGS.filter(b => b.category === cat); },
  search(q) {
    q = (q || "").toLowerCase().trim();
    if (!q) return BUILDINGS;
    return BUILDINGS.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.short.toLowerCase().includes(q) ||
      b.tag.toLowerCase().includes(q)
    );
  }
};
