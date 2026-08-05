/**
 * scanSounds.js — Efek suara hasil scan (Web Audio API, tanpa file audio eksternal)
 * AbsenQR Production Utility
 *
 * CARA PAKAI:
 *   import { playSuccessSound, playDuplicateSound, playErrorSound } from "./scanSounds";
 *   playSuccessSound();   // hadir tercatat
 *   playDuplicateSound(); // sudah hadir sebelumnya
 *   playErrorSound();     // peserta tidak ditemukan
 */

// ─── Singleton AudioContext ────────────────────────────────────────────────
let ctx = null;

function getCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// ─── Satu nada dengan envelope attack/decay agar tidak "klik" ──────────────
function tone(audioCtx, freq, startTime, duration, { type = "sine", gain = 0.22, glideTo = null } = {}) {
  const osc  = audioCtx.createOscillator();
  const gn   = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, startTime + duration);

  gn.gain.setValueAtTime(0, startTime);
  gn.gain.linearRampToValueAtTime(gain, startTime + 0.012);          // attack halus
  gn.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // decay halus

  osc.connect(gn).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.03);
}

// ─── ✅ Hadir tercatat — beep pendek 1x, nada tinggi & menyenangkan ─────────
export function playSuccessSound() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  tone(audioCtx, 1318.5, now, 0.16, { type: "sine", gain: 0.25 });        // E6 — jernih
  tone(audioCtx, 2637.0, now, 0.16, { type: "sine", gain: 0.08 });        // overtone oktaf, bikin terdengar "berkilau"
}

// ─── ⚠️ Sudah hadir (duplikat) — beep 2x, nada sedang ───────────────────────
export function playDuplicateSound() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  tone(audioCtx, 740, now,        0.11, { type: "sine", gain: 0.22 });
  tone(audioCtx, 740, now + 0.16, 0.11, { type: "sine", gain: 0.22 });
}

// ─── ❌ Tidak ditemukan — bunyi error nada rendah ───────────────────────────
export function playErrorSound() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  tone(audioCtx, 220, now, 0.32, { type: "sawtooth", gain: 0.18, glideTo: 110 });
}
