/**
 * sheetsAPI.js — Client API untuk Google Apps Script Backend
 * AbsenQR Production Utility
 *
 * CARA PAKAI:
 *   import { SheetsAPI } from "./sheetsAPI";
 *   const api = new SheetsAPI(import.meta.env.VITE_API_URL);
 *   const { participants } = await api.getParticipants("EVT001");
 */

// ─── Base request ─────────────────────────────────────────────────────────────
async function request(url, params = {}, method = "GET", body = null) {
  // URLSearchParams menstringkan `undefined`/`null` jadi teks literal "undefined" —
  // buang dulu key yang kosong supaya param opsional (mis. eventId) benar-benar tidak terkirim.
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  );
  const fullUrl = method === "GET"
    ? url + "?" + new URLSearchParams(cleanParams).toString()
    : url;

  const opts = {
    method,
    // Apps Script Web App tidak menangani preflight OPTIONS (balas 405), jadi header
    // apapun di GET atau "Content-Type: application/json" di POST akan membuat browser
    // mengirim preflight dan request aslinya gagal ("Failed to fetch"). "text/plain" ada
    // di CORS safelist sehingga tidak memicu preflight — Apps Script tetap bisa
    // JSON.parse(e.postData.contents) di sisi server seperti biasa.
    ...(body ? { headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(fullUrl, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const json = await res.json();
  if (json.status === "error") throw new Error(json.data?.message || "API error");
  return json.data;
}

// ─── SheetsAPI class ─────────────────────────────────────────────────────────
export class SheetsAPI {
  /**
   * @param {string} baseUrl - URL Web App dari Google Apps Script
   */
  constructor(baseUrl) {
    if (!baseUrl) throw new Error("baseUrl diperlukan. Isi VITE_API_URL di file .env");
    this.url = baseUrl;
  }

  // ── Cek koneksi ─────────────────────────────────────────────────────────
  async ping() {
    return request(this.url, { action: "ping" });
  }

  // ── Ambil daftar event ──────────────────────────────────────────────────
  async getEvents() {
    const data = await request(this.url, { action: "getEvents" });
    return data.events || [];
  }

  // ── Buat event baru ─────────────────────────────────────────────────────
  async createEvent({ name, date, location }) {
    if (!name) throw new Error("Nama event wajib diisi");
    return request(this.url, {}, "POST", { action: "createEvent", name, date, location });
  }

  // ── Update status event ─────────────────────────────────────────────────
  async updateEventStatus(eventId, status) {
    return request(this.url, {}, "POST", { action: "updateEvent", eventId, status });
  }

  // ── Ambil daftar peserta ────────────────────────────────────────────────
  async getParticipants(eventId) {
    const data = await request(this.url, { action: "getParticipants", eventId });
    return { participants: data.participants || [], total: data.total || 0 };
  }

  // ── Catat kehadiran (dari scan QR) ─────────────────────────────────────
  /**
   * @param {object} qrData - Data hasil parse QR Code (generik, tidak terikat event tertentu)
   *   { id, nama_ortu, nama_anak, kelas, korlas, divisi, hp }
   * @param {string} overrideEventId - Event yang sedang aktif/dipilih panitia saat scan
   * @returns {{ success, duplicate, message, waktuScan }}
   */
  async recordAttendance(qrData, overrideEventId) {
    const payload = {
      action:        "recordAttendance",
      participantId: qrData.id,
      eventId:       overrideEventId,
      namaAnak:      qrData.nama_anak  || qrData.namaAnak  || "",
      namaOrtu:      qrData.nama_ortu  || qrData.namaOrtu  || "",
      kelas:         qrData.kelas      || "",
      korlas:        qrData.korlas     || "",
      divisi:        qrData.divisi     || "",
      hp:            qrData.hp         || "",
    };

    if (!payload.participantId) throw new Error("ID peserta tidak ditemukan di QR Code");
    if (!payload.eventId)       throw new Error("Event ID tidak ditemukan");

    return request(this.url, {}, "POST", payload);
  }

  // ── Ambil data kehadiran ────────────────────────────────────────────────
  // Backend (Apps Script) membalas record attendance dengan field snake_case
  // (participant_id, event_id, waktu_scan, dst) — sedangkan seluruh App.jsx
  // membaca camelCase (participantId, eventId, waktuScan). Tanpa normalisasi
  // di sini, semua filter by eventId/participantId di frontend selalu gagal
  // match (selalu undefined) sehingga Dashboard/Event/Laporan tampil 0 walau
  // datanya sudah tersimpan benar di sheet.
  async getAttendance(eventId) {
    const data = await request(this.url, { action: "getAttendance", eventId });
    const attendance = (data.attendance || []).map(a => ({
      participantId: a.participantId ?? a.participant_id,
      eventId:       a.eventId       ?? a.event_id,
      namaAnak:      a.namaAnak      ?? a.nama_anak,
      namaOrtu:      a.namaOrtu      ?? a.nama_ortu,
      kelas:         a.kelas,
      korlas:        a.korlas,
      divisi:        a.divisi,
      hp:            a.hp,
      waktuScan:     a.waktuScan     ?? a.waktu_scan,
    }));
    return { attendance, total: data.total || 0 };
  }

  // ── Ambil statistik kehadiran ───────────────────────────────────────────
  async getStats(eventId) {
    return request(this.url, { action: "getStats", eventId });
  }

  // ── Import peserta dari Sheets lain ────────────────────────────────────
  async importPeserta({ sourceSheetId, sourceSheetName, eventId }) {
    return request(this.url, {}, "POST", {
      action: "importPeserta",
      sourceSheetId, sourceSheetName, eventId,
    });
  }
}

// ─── Singleton helper ─────────────────────────────────────────────────────────
let _instance = null;

/**
 * Dapatkan instance SheetsAPI (singleton).
 * URL diambil dari environment variable VITE_API_URL.
 */
export function getAPI() {
  if (!_instance) {
    const url = import.meta.env?.VITE_API_URL;
    if (!url) {
      throw new Error(
        "VITE_API_URL belum diatur.\n" +
        "Buat file .env di root project:\n" +
        "  VITE_API_URL=https://script.google.com/macros/s/YOUR_ID/exec"
      );
    }
    _instance = new SheetsAPI(url);
  }
  return _instance;
}

// ─── useSheets Hook (React) ───────────────────────────────────────────────────
/**
 * React hook untuk menggunakan SheetsAPI dengan loading/error state.
 *
 * Contoh:
 *   const { data, loading, error, execute } = useSheets(api => api.getParticipants("EVT001"));
 */
export function useSheets(apiFn, deps = []) {
  // Import useState & useEffect dari React jika digunakan sebagai hook
  // Pastikan React sudah diimport di file yang menggunakan ini:
  //   import { useState, useEffect } from "react";
  //   import { useSheets } from "./sheetsAPI";
  const { useState, useEffect, useCallback } = window.React || {};

  if (!useState) {
    throw new Error("useSheets hanya bisa digunakan dalam komponen React");
  }

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const api    = getAPI();
      const result = await apiFn(api, ...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => { execute(); }, []); // eslint-disable-line

  return { data, loading, error, execute, refetch: execute };
}

// ─── Contoh penggunaan lengkap ────────────────────────────────────────────────
/*

// 1. Setup di .env:
//    VITE_API_URL=https://script.google.com/macros/s/ABC123/exec

// 2. Di komponen ScannerPage:

import { getAPI } from "./sheetsAPI";

async function handleScan(qrData) {
  try {
    const api    = getAPI();
    const result = await api.recordAttendance(qrData, currentEventId);

    if (result.duplicate) {
      showAlert("⚠️ Sudah Hadir", result.message);
    } else if (result.success) {
      showAlert("✅ Hadir Tercatat", result.message);
    }
  } catch (err) {
    showAlert("❌ Error", err.message);
  }
}

// 3. Di komponen ParticipantsPage untuk import dari Form:

async function handleImport(googleSheetsUrl) {
  // Extract spreadsheet ID dari URL
  const match = googleSheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) { alert("URL tidak valid"); return; }

  const api    = getAPI();
  const result = await api.importPeserta({
    sourceSheetId:   match[1],
    sourceSheetName: "Form Responses 1", // nama sheet response Form
    eventId:         currentEventId,
  });
  alert(`Berhasil import ${result.imported} peserta`);
}

*/
