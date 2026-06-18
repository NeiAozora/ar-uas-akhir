#!/usr/bin/env node
/**
 * UNEJ Heritage AR — QR Code Generator
 * 
 * Usage:
 *   node generate-qr.js              → generate semua gedung
 *   node generate-qr.js rektorat     → generate satu gedung
 *   node generate-qr.js --list       → tampilkan daftar gedung & QR value-nya
 * 
 * Output: folder ./qr-codes/<id>.png
 * 
 * Install dulu: npm install qrcode
 */

const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

// Data gedung (mirror dari www/js/data.js)
const BUILDINGS = [
  { id: "rektorat",     qr: "UNEJ-REKTORAT",  name: "Gedung Rektorat" },
  { id: "perpustakaan", qr: "UNEJ-PERPUS",     name: "UPA Perpustakaan" },
  { id: "fasilkom",     qr: "UNEJ-FASILKOM",   name: "Fakultas Ilmu Komputer" },
  { id: "sastra",       qr: "UNEJ-SASTRA",     name: "Fakultas Sastra" },
];

const OUT_DIR = path.join(__dirname, "qr-codes");
const args = process.argv.slice(2);

// --list
if (args.includes("--list")) {
  console.log("\nDaftar gedung & nilai QR code:\n");
  BUILDINGS.forEach(b => {
    console.log(`  ${b.id.padEnd(15)} → "${b.qr}"  (${b.name})`);
  });
  console.log();
  process.exit(0);
}

// Tentukan gedung yang di-generate
let targets = BUILDINGS;
if (args.length > 0 && !args[0].startsWith("--")) {
  const id = args[0].toLowerCase();
  const found = BUILDINGS.find(b => b.id === id);
  if (!found) {
    console.error(`\n❌ Gedung "${id}" tidak ditemukan.`);
    console.error(`   Pilihan: ${BUILDINGS.map(b => b.id).join(", ")}\n`);
    process.exit(1);
  }
  targets = [found];
}

// Buat folder output
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// Generate
async function generate() {
  console.log(`\nGenerating ${targets.length} QR code(s) ke folder ./qr-codes/\n`);

  for (const b of targets) {
    const outFile = path.join(OUT_DIR, `${b.id}.png`);
    await QRCode.toFile(outFile, b.qr, {
      errorCorrectionLevel: "H",
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#083478", light: "#FFFFFF" },
    });
    console.log(`  ✅ ${b.name.padEnd(30)} → qr-codes/${b.id}.png  (value: "${b.qr}")`);
  }

  console.log("\nSelesai! Print file PNG-nya dan tempel di gedung masing-masing.\n");
}

generate().catch(err => {
  if (err.code === "MODULE_NOT_FOUND") {
    console.error("\n❌ Module 'qrcode' belum terinstall.");
    console.error("   Jalankan dulu: npm install qrcode\n");
  } else {
    console.error("\n❌ Error:", err.message);
  }
  process.exit(1);
});
