/**
 * pdfGenerator.js — Generator PDF ID Card Peserta
 * AbsenQR Production Utility
 *
 * INSTALL: npm install jspdf qrcode
 *
 * CARA PAKAI di IDCardsPage:
 *   import { downloadAllIDCards, downloadSingleIDCard } from "./pdfGenerator";
 *
 *   // Download semua kartu (1 PDF multi-halaman)
 *   await downloadAllIDCards(participants, event, { onProgress: (cur, tot) => setProgress(cur/tot*100) });
 *
 *   // Download satu kartu
 *   await downloadSingleIDCard(participant, event);
 */

import { jsPDF }  from "jspdf";
import QRCodeLib  from "qrcode";

// ─── Dimensi kartu (mm) ──────────────────────────────────────────────────────
const C = {
  W: 85.6, H: 54.0,          // Ukuran kartu nama standar (ISO 7810 ID-1)
  R:  2.0,                   // Border radius
  P:  2.5,                   // Padding
  HDR: 13.5,                 // Tinggi header
  FTR:  6.5,                 // Tinggi footer
  QR:  22,                   // Ukuran QR code
};

// ─── Palette warna (RGB) ─────────────────────────────────────────────────────
const K = {
  hdrBg:    [55,  48, 163],   // indigo-800
  hdrLbl:   [199,210,254],    // indigo-200
  hdrText:  [255,255,255],    // white
  body:     [ 15, 23, 42],    // slate-900
  muted:    [148,163,184],    // slate-400
  sub:      [ 71, 85,105],    // slate-600
  accent:   [ 99,102,241],    // indigo-500
  ftrBg:    [238,242,255],    // indigo-50
  ftrText:  [ 99,102,241],    // indigo-500
  border:   [226,232,240],    // slate-200
};

// ─── Util ────────────────────────────────────────────────────────────────────
const trunc = (s, n) => (s || "").length > n ? (s || "").slice(0, n - 1) + "…" : (s || "");

async function buildQR(data) {
  try {
    return await QRCodeLib.toDataURL(JSON.stringify(data), {
      width: 220, margin: 1, errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  } catch { return null; }
}

// ─── Gambar satu ID Card di halaman PDF ──────────────────────────────────────
async function drawCard(doc, p, event, ox, oy) {
  const { W, H, R, P, HDR, FTR, QR } = C;

  // Bayangan tipis (simulasi dengan persegi abu-abu offset)
  doc.setFillColor(210, 215, 220);
  doc.roundedRect(ox + 0.6, oy + 0.6, W, H, R, R, "F");

  // Card background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(ox, oy, W, H, R, R, "F");

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(...K.hdrBg);
  doc.roundedRect(ox, oy, W, HDR, R, R, "F");
  doc.rect(ox, oy + HDR - 3, W, 3, "F");          // flatten bottom

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(...K.hdrLbl);
  doc.text("✦  ID CARD PESERTA  ✦", ox + P, oy + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...K.hdrText);
  doc.text(trunc(event?.name || "Event", 42), ox + P, oy + 10.5);

  // ── QR Code ──────────────────────────────────────────────────────────────
  const qrX = ox + W - QR - P;
  const qrY = oy + HDR + 1.5;

  const qrImg = await buildQR({
    id:        p.id,       event_id: p.eventId || event?.id,
    nama_ortu: p.namaOrtu, nama_anak: p.namaAnak,
    kelas:     p.kelas,    korlas:    p.korlas,
    divisi:    p.divisi,   hp:        p.hp,
  });

  if (qrImg) {
    // QR border
    doc.setDrawColor(...K.border);
    doc.setLineWidth(0.2);
    doc.rect(qrX - 0.5, qrY - 0.5, QR + 1, QR + 1, "S");
    doc.addImage(qrImg, "PNG", qrX, qrY, QR, QR);
  } else {
    doc.setFillColor(240, 240, 245);
    doc.rect(qrX, qrY, QR, QR, "F");
    doc.setTextColor(...K.muted);
    doc.setFontSize(5);
    doc.text("QR Code", qrX + QR / 2, qrY + QR / 2, { align: "center" });
  }

  // ID peserta di bawah QR
  doc.setTextColor(...K.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  doc.text(p.id || "", qrX + QR / 2, qrY + QR + 3.5, { align: "center" });

  // ── Body text ─────────────────────────────────────────────────────────────
  const bx = ox + P;
  let   by = oy + HDR + 4;
  const bw = W - QR - P * 3.5;  // max lebar teks area kiri

  // Nama Anak
  doc.setTextColor(...K.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Nama Anak", bx, by);

  by += 3.5;
  doc.setTextColor(...K.body);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(trunc(p.namaAnak, 16), bx, by);

  // Nama Orang Tua
  by += 5;
  doc.setTextColor(...K.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Nama Orang Tua", bx, by);

  by += 3;
  doc.setTextColor(...K.sub);
  doc.setFontSize(6);
  doc.text(trunc(p.namaOrtu, 20), bx, by);

  // Kelas & Divisi (2 kolom)
  by += 4.5;
  doc.setTextColor(...K.muted);
  doc.setFontSize(5.5);
  doc.text("Kelas", bx,       by);
  doc.text("Divisi", bx + 15, by);

  by += 3;
  doc.setTextColor(...K.accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(p.kelas || "-", bx, by);

  doc.setTextColor(...K.sub);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(trunc(p.divisi, 12), bx + 15, by);

  // Korlas
  by += 4.5;
  doc.setTextColor(...K.muted);
  doc.setFontSize(5.5);
  doc.text("Korlas", bx, by);

  by += 3;
  doc.setTextColor(...K.sub);
  doc.setFontSize(5.5);
  doc.text(trunc(p.korlas, 22), bx, by);

  // ── Footer ────────────────────────────────────────────────────────────────
  const fy = oy + H - FTR;

  // Garis pemisah tipis
  doc.setDrawColor(...K.border);
  doc.setLineWidth(0.2);
  doc.line(ox, fy, ox + W, fy);

  doc.setFillColor(...K.ftrBg);
  doc.rect(ox, fy, W, FTR, "F");
  doc.roundedRect(ox, fy + 0.1, W, FTR, 0, R, "F");  // round bottom corners

  doc.setTextColor(...K.ftrText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);

  // HP kiri
  doc.text(p.hp || "", ox + P, fy + 4.2);

  // Tanggal kanan
  if (event?.date) {
    const d = new Date(event.date + "T00:00:00");
    const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    doc.text(dateStr, ox + W - P, fy + 4.2, { align: "right" });
  }
}

// ─── EXPORT: Download semua kartu sebagai 1 PDF ───────────────────────────────
/**
 * @param {Array}    participants  - Array peserta dari database
 * @param {Object}   event         - { id, name, date, location }
 * @param {Object}   options
 * @param {number}   options.cols       - Kartu per baris (default: 2)
 * @param {number}   options.rows       - Baris per halaman (default: 3)
 * @param {number}   options.marginMm   - Margin halaman mm (default: 8)
 * @param {number}   options.gapMm      - Jarak antar kartu mm (default: 4)
 * @param {function} options.onProgress - (current, total) => void
 */
export async function downloadAllIDCards(participants, event, options = {}) {
  const {
    cols       = 2,
    rows       = 3,
    marginMm   = 8,
    gapMm      = 4,
    onProgress = null,
  } = options;

  const cardsPerPage = cols * rows;
  const pageW = marginMm * 2 + C.W * cols  + gapMm * (cols - 1);
  const pageH = marginMm * 2 + C.H * rows  + gapMm * (rows - 1);

  const doc = new jsPDF({
    orientation: pageW > pageH ? "landscape" : "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  for (let i = 0; i < participants.length; i++) {
    const pageIdx = Math.floor(i / cardsPerPage);
    const cardIdx = i % cardsPerPage;

    if (i > 0 && cardIdx === 0) doc.addPage();

    const col = cardIdx % cols;
    const row = Math.floor(cardIdx / cols);
    const ox  = marginMm + col * (C.W + gapMm);
    const oy  = marginMm + row * (C.H + gapMm);

    await drawCard(doc, participants[i], event, ox, oy);
    onProgress?.(i + 1, participants.length);
  }

  const safeName = (event?.name || "Event").replace(/[^a-z0-9\s]/gi, "").trim().replace(/\s+/g, "_");
  const dateStr  = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
  doc.save(`IDCard_${safeName}_${dateStr}.pdf`);

  return { totalCards: participants.length };
}

// ─── EXPORT: Download satu kartu ──────────────────────────────────────────────
/**
 * @param {Object} participant - Data satu peserta
 * @param {Object} event       - Data event
 */
export async function downloadSingleIDCard(participant, event) {
  const margin = 6;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [C.W + margin * 2, C.H + margin * 2],
  });

  await drawCard(doc, participant, event, margin, margin);

  const safeName = (participant.namaAnak || participant.id).replace(/[^a-z0-9\s]/gi, "").trim().replace(/\s+/g, "_");
  doc.save(`IDCard_${safeName}.pdf`);

  return { success: true };
}
