/**
 * QRScannerCamera.jsx — Komponen Scanner Kamera Real
 * AbsenQR Production Component
 *
 * INSTALL:  npm install html5-qrcode lucide-react
 *
 * CARA PAKAI di ScannerPage (AbsenQR.jsx):
 *   import QRScannerCamera from "./QRScannerCamera";
 *   <QRScannerCamera
 *     eventId={evId}
 *     onScanSuccess={(qrData) => doScan(qrData)}
 *     onScanError={(msg) => console.error(msg)}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, CameraOff, SwitchCamera, Zap, ZapOff,
  CheckCircle, AlertCircle, RefreshCw
} from "lucide-react";

// ─── Konstanta state scanner ──────────────────────────────────────────────────
const STATE = {
  IDLE:     "idle",
  LOADING:  "loading",  // memuat library & kamera
  SCANNING: "scanning", // kamera aktif & scan berjalan
  PAUSED:   "paused",   // jeda sementara setelah scan
  ERROR:    "error",
};

// Deteksi gagal-muat chunk JS (bukan library beneran hilang) — khas terjadi
// saat tab dibuka sejak sebelum deploy terbaru, sehingga browser masih minta
// file dengan hash lama yang sudah tidak ada di server setelah redeploy SPA.
const isModuleLoadError = (err) =>
  /fetch dynamically imported module|failed to fetch|loading chunk|importing a module script failed/i
    .test(err?.message || String(err));

/**
 * QRScannerCamera
 * @param {function} onScanSuccess  - dipanggil dengan objek data QR { id, nama_anak, ... } — QR bersifat generik, tidak terikat event tertentu
 * @param {function} onScanError    - dipanggil dengan string pesan error
 * @param {boolean}  autoStart      - otomatis mulai kamera (default: true)
 * @param {number}   pauseMs        - jeda (ms) antar scan, mencegah scan ganda (default: 1500)
 * @param {node}     overlay        - konten opsional ditampilkan di atas viewport kamera (mis. hasil scan)
 */
export default function QRScannerCamera({
  onScanSuccess,
  onScanError,
  autoStart = true,
  pauseMs   = 1500,
  overlay   = null,
}) {
  const [state, setState]             = useState(STATE.IDLE);
  const [cameras, setCameras]         = useState([]);
  const [camIdx, setCamIdx]           = useState(0);
  const [errorMsg, setErrorMsg]       = useState(null);
  const [torchOn, setTorchOn]         = useState(false);
  // Selama user belum memilih kamera secara manual, selalu minta kamera
  // belakang lewat facingMode — lebih andal daripada mengandalkan label
  // device (label "back/rear" tidak selalu tersedia di semua HP/browser).
  const [manualCam, setManualCam]     = useState(false);
  // true jika error disebabkan chunk JS gagal dimuat (mis. tab dibuka sejak
  // sebelum deploy terbaru, jadi hash file lama sudah tidak ada di server) —
  // kasus ini butuh reload penuh, bukan retry di dalam state React.
  const [needsReload, setNeedsReload] = useState(false);
  const scannerRef   = useRef(null);
  const mountedRef   = useRef(true);
  const pauseTimer   = useRef(null);

  // ── Cleanup saat unmount ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(pauseTimer.current);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ── Deteksi kamera yang tersedia ──────────────────────────────────────────
  useEffect(() => {
    setState(STATE.LOADING);
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      Html5Qrcode.getCameras()
        .then(devices => {
          if (!mountedRef.current) return;
          if (!devices?.length) {
            setErrorMsg("Tidak ada kamera terdeteksi di perangkat ini.");
            setState(STATE.ERROR);
            return;
          }
          setCameras(devices);
          // Utamakan kamera belakang untuk mobile
          const backIdx = devices.findIndex(d => /back|rear|environment/i.test(d.label));
          setCamIdx(backIdx >= 0 ? backIdx : 0);
          if (autoStart) setState(STATE.SCANNING);
          else           setState(STATE.IDLE);
        })
        .catch(err => {
          if (!mountedRef.current) return;
          const msg = /NotAllowed|Permission/i.test(err.message)
            ? "Izin kamera ditolak. Buka pengaturan browser → Izinkan akses kamera untuk situs ini."
            : "Gagal mendeteksi kamera: " + err.message;
          setErrorMsg(msg);
          setState(STATE.ERROR);
          onScanError?.(msg);
        });
    }).catch((err) => {
      if (!mountedRef.current) return;
      console.error("[QRScannerCamera] Gagal memuat modul html5-qrcode:", err);
      if (isModuleLoadError(err)) {
        setNeedsReload(true);
        setErrorMsg("Gagal memuat modul pemindai QR. Ini biasanya terjadi setelah aplikasi baru saja diperbarui — muat ulang halaman untuk mengambil versi terbaru.");
      } else {
        setErrorMsg("Library html5-qrcode belum terinstall. Jalankan: npm install html5-qrcode");
      }
      setState(STATE.ERROR);
    });
  }, [autoStart, onScanError]);

  // ── Start kamera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!cameras.length || !mountedRef.current) return;
    setState(STATE.LOADING);
    setErrorMsg(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Bersihkan instance lama
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); }  catch {}
        try { scannerRef.current.clear(); }        catch {}
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode("absenqr-camera-view", { verbose: false });
      scannerRef.current = scanner;

      // Default: minta kamera belakang via facingMode (tidak bergantung pada
      // urutan/label device — paling andal untuk mobile). Setelah user
      // memilih kamera lain secara manual, pakai deviceId spesifik itu.
      // Catatan: html5-qrcode hanya menerima facingMode berupa string
      // (diperlakukan browser sebagai constraint "ideal", bukan wajib) atau
      // objek { exact }. String di sini paling aman — tetap fallback ke
      // kamera lain bila perangkat cuma punya 1 kamera (mis. laptop/desktop).
      const cameraTarget = manualCam
        ? cameras[camIdx].id
        : { facingMode: "environment" };

      await scanner.start(
        cameraTarget,
        {
          fps: 15,
          qrbox: (vw, vh) => {
            const size = Math.round(Math.min(vw, vh) * 0.85);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: false,
          // Catatan: sengaja TIDAK memakai config.videoConstraints di sini —
          // html5-qrcode akan mengabaikan cameraTarget (facingMode) di atas
          // dan hanya memakai videoConstraints jika field itu diisi. Autofocus
          // diterapkan lewat applyConstraints() setelah track aktif (di bawah).
        },
        // ✅ Berhasil baca QR
        (decodedText) => { if (mountedRef.current) handleResult(decodedText); },
        // ⚠️ Frame error (normal, abaikan)
        () => {}
      );

      // Paksa continuous autofocus lewat track langsung — sebagian browser
      // hanya menerima constraint ini setelah track aktif, bukan saat start().
      try {
        const caps = scanner.getRunningTrackCapabilities?.();
        if (caps?.focusMode?.includes?.("continuous")) {
          await scanner.applyVideoConstraints({ advanced: [{ focusMode: "continuous" }] });
        }
      } catch {
        // Autofocus manual tidak didukung perangkat ini — abaikan, kamera tetap jalan
      }

      if (mountedRef.current) setState(STATE.SCANNING);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("[QRScannerCamera] Gagal memulai kamera:", err);
      let msg;
      if (isModuleLoadError(err)) {
        setNeedsReload(true);
        msg = "Gagal memuat modul pemindai QR. Ini biasanya terjadi setelah aplikasi baru saja diperbarui — muat ulang halaman untuk mengambil versi terbaru.";
      } else if (/NotAllowed|Permission/i.test(err.message)) {
        msg = "Akses kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi.";
      } else {
        msg = "Gagal memulai kamera: " + (err.message || err);
      }
      setErrorMsg(msg);
      setState(STATE.ERROR);
      onScanError?.(msg);
    }
  }, [cameras, camIdx, manualCam, onScanError]);

  // ── Stop kamera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    clearTimeout(pauseTimer.current);
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); }  catch {}
      try { scannerRef.current.clear(); }        catch {}
      scannerRef.current = null;
    }
    if (mountedRef.current) setState(STATE.IDLE);
  }, []);

  // ── Efek: mulai kamera ketika state berubah ke SCANNING ───────────────────
  useEffect(() => {
    if (state === STATE.SCANNING && !scannerRef.current) {
      startCamera();
    }
  }, [state, startCamera]);

  // ── Proses hasil scan ─────────────────────────────────────────────────────
  const handleResult = (rawText) => {
    // Pause scanner sementara — param `false` memastikan video tetap jalan
    // (kamera tidak mati), hanya loop pembacaan QR yang dijeda.
    setState(STATE.PAUSED);
    if (scannerRef.current) {
      try { scannerRef.current.pause(false); } catch {}
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      const msg = "QR Code tidak valid. Pastikan menggunakan ID Card dari sistem AbsenQR.";
      setErrorMsg(msg);
      onScanError?.(msg);
      resumeAfterDelay(2500);
      return;
    }

    // ✅ Data valid → kirim ke parent (kehadiran dicatat ke event yang sedang aktif di scanner)
    setErrorMsg(null);
    onScanSuccess(data);
    resumeAfterDelay(pauseMs);
  };

  // Resume scanning setelah jeda
  const resumeAfterDelay = (ms) => {
    pauseTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setErrorMsg(null);
      if (scannerRef.current) {
        try {
          scannerRef.current.resume();
        } catch {
          // resume() gagal (jarang, tergantung browser) — restart penuh
          // supaya kamera tidak terlihat "mati"/freeze setelah scan.
          scannerRef.current = null;
        }
      }
      setState(STATE.SCANNING);
    }, ms);
  };

  // ── Switch kamera (depan/belakang) ────────────────────────────────────────
  const switchCamera = async () => {
    if (cameras.length < 2) return;
    await stopCamera();
    setManualCam(true);
    const next = (camIdx + 1) % cameras.length;
    setCamIdx(next);
    setTimeout(() => { if (mountedRef.current) setState(STATE.SCANNING); }, 300);
  };

  // ── Toggle flash/torch ─────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!scannerRef.current?.isScanning) return;
    try {
      const newVal = !torchOn;
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: newVal }] });
      setTorchOn(newVal);
    } catch {
      // Torch tidak didukung perangkat ini — silent fail
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const isActive  = state === STATE.SCANNING || state === STATE.PAUSED;
  const isLoading = state === STATE.LOADING;
  const isError   = state === STATE.ERROR;
  const isIdle    = state === STATE.IDLE;

  return (
    <div className="w-full space-y-3">
      {/* ── Viewport kamera ────────────────────────────────────────────── */}
      <div
        className="relative bg-slate-900 rounded-3xl overflow-hidden"
        style={{ aspectRatio: "1/1", minHeight: 280 }}
      >
        {/* html5-qrcode mounts its own video element di sini */}
        <div
          id="absenqr-camera-view"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            // Override style bawaan html5-qrcode agar full
          }}
        />

        {/* Overlay frame sudut — ukuran mengikuti proporsi qrbox aktual (85%) */}
        {!isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <style>{`
              @keyframes scanBounce{0%,100%{top:8%}50%{top:92%}}
              .scan-beam{animation:scanBounce 2s ease-in-out infinite;position:absolute;left:0;right:0}
            `}</style>
            <div className="relative" style={{ width: "85%", height: "85%" }}>
              {[
                "top-0 left-0  border-t-4 border-l-4 rounded-tl-2xl",
                "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
                "bottom-0 left-0  border-b-4 border-l-4 rounded-bl-2xl",
                "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-10 h-10 border-indigo-400 ${cls}`} />
              ))}
              {isActive && (
                <div className="scan-beam h-0.5 bg-indigo-400"
                  style={{ boxShadow: "0 0 10px rgba(129,140,248,1),0 0 22px rgba(129,140,248,0.5)" }}
                />
              )}
            </div>

            {/* Petunjuk visual */}
            {isActive && !errorMsg && (
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-xs font-semibold bg-black/50 backdrop-blur-sm px-3.5 py-1.5 rounded-full whitespace-nowrap">
                Arahkan QR Code ke dalam kotak
              </p>
            )}
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20"
            style={{ background: "rgba(2,6,23,0.85)" }}>
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white text-sm font-semibold">Memulai kamera...</p>
            <p className="text-slate-400 text-xs mt-1">Izinkan akses kamera bila diminta</p>
          </div>
        )}

        {/* Idle state */}
        {isIdle && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <Camera size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm font-semibold">Kamera belum aktif</p>
            <p className="text-slate-600 text-xs mt-1">Klik tombol di bawah untuk memulai</p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-6"
            style={{ background: "rgba(2,6,23,0.93)" }}>
            <CameraOff size={40} className="text-red-400 mb-3" />
            <p className="text-red-300 text-sm text-center font-semibold leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => {
                if (needsReload) { window.location.reload(); return; }
                setErrorMsg(null);
                setState(STATE.LOADING);
                setTimeout(() => setState(STATE.SCANNING), 200);
              }}
              className="mt-4 flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-indigo-500 transition-colors">
              <RefreshCw size={15} /> {needsReload ? "Muat Ulang Halaman" : "Coba Lagi"}
            </button>
          </div>
        )}

        {/* Error sementara (event mismatch / format invalid) */}
        {!isError && errorMsg && (
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <div className="bg-red-900 border border-red-700 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-xs">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Tombol kontrol overlay (atas kanan) */}
        {isActive && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
            {cameras.length > 1 && (
              <button onClick={switchCamera} title="Ganti kamera"
                className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-white hover:bg-slate-700 transition-colors">
                <SwitchCamera size={17} />
              </button>
            )}
            <button onClick={toggleTorch} title="Flash"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                torchOn ? "bg-amber-500 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
              }`}>
              {torchOn ? <Zap size={17} /> : <ZapOff size={17} />}
            </button>
          </div>
        )}

        {/* Overlay hasil scan (dikontrol oleh parent) */}
        {overlay && <div className="absolute inset-0 z-50">{overlay}</div>}
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <div className={`py-2.5 px-4 rounded-2xl flex items-center gap-2 text-sm font-semibold transition-all border ${
        isActive  ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
        isLoading ? "bg-indigo-50  text-indigo-600  border-indigo-200"  :
        isError   ? "bg-red-50    text-red-600     border-red-200"     :
                    "bg-slate-50  text-slate-500   border-slate-200"
      }`}>
        {isActive  && <><CheckCircle size={16}/><span>Kamera aktif — arahkan ke QR Code ID Card</span></>}
        {isLoading && <><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/><span>Menghubungkan kamera...</span></>}
        {isError   && <><CameraOff size={16}/><span>Kamera tidak tersedia</span></>}
        {isIdle    && <><Camera size={16}/><span>Siap memulai scan</span></>}
      </div>

      {/* ── Tombol Start / Stop ─────────────────────────────────────────── */}
      <div className="flex gap-2">
        {(isIdle || isError) && (
          <button onClick={() => setState(STATE.SCANNING)}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-2xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all">
            <Camera size={18} /> Mulai Scan Kamera
          </button>
        )}
        {(isActive || isLoading) && (
          <button onClick={stopCamera}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-sm hover:bg-slate-300 transition-colors">
            <CameraOff size={18} /> Stop Kamera
          </button>
        )}
      </div>

      {/* ── Pilih kamera (jika > 1 kamera & tidak aktif) ─────────────── */}
      {cameras.length > 1 && !isActive && !isLoading && (
        <select
          value={camIdx}
          onChange={e => { setManualCam(true); setCamIdx(Number(e.target.value)); }}
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {cameras.map((cam, i) => (
            <option key={cam.id} value={i}>
              {cam.label || `Kamera ${i + 1}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
