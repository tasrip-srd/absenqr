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

/**
 * QRScannerCamera
 * @param {function} onScanSuccess  - dipanggil dengan objek data QR { id, event_id, nama_anak, ... }
 * @param {function} onScanError    - dipanggil dengan string pesan error
 * @param {string}   eventId        - ID event aktif untuk validasi
 * @param {boolean}  autoStart      - otomatis mulai kamera (default: true)
 * @param {number}   pauseMs        - jeda (ms) antar scan, mencegah scan ganda (default: 1500)
 * @param {node}     overlay        - konten opsional ditampilkan di atas viewport kamera (mis. hasil scan)
 */
export default function QRScannerCamera({
  onScanSuccess,
  onScanError,
  eventId,
  autoStart = true,
  pauseMs   = 1500,
  overlay   = null,
}) {
  const [state, setState]             = useState(STATE.IDLE);
  const [cameras, setCameras]         = useState([]);
  const [camIdx, setCamIdx]           = useState(0);
  const [errorMsg, setErrorMsg]       = useState(null);
  const [torchOn, setTorchOn]         = useState(false);
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
    }).catch(() => {
      setErrorMsg("Library html5-qrcode belum terinstall. Jalankan: npm install html5-qrcode");
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

      await scanner.start(
        cameras[camIdx].id,
        {
          fps: 15,
          qrbox: (vw, vh) => {
            const size = Math.round(Math.min(vw, vh) * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        // ✅ Berhasil baca QR
        (decodedText) => { if (mountedRef.current) handleResult(decodedText); },
        // ⚠️ Frame error (normal, abaikan)
        () => {}
      );

      if (mountedRef.current) setState(STATE.SCANNING);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = /NotAllowed|Permission/i.test(err.message)
        ? "Akses kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi."
        : "Gagal memulai kamera: " + (err.message || err);
      setErrorMsg(msg);
      setState(STATE.ERROR);
      onScanError?.(msg);
    }
  }, [cameras, camIdx, onScanError]);

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
    // Pause scanner sementara
    setState(STATE.PAUSED);
    if (scannerRef.current) {
      try { scannerRef.current.pause(); } catch {}
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

    // Validasi event
    if (eventId && data.event_id && data.event_id !== eventId) {
      const msg = `QR Code ini untuk event lain (${data.event_id}). Event aktif: ${eventId}`;
      setErrorMsg(msg);
      onScanError?.(msg);
      resumeAfterDelay(2500);
      return;
    }

    // ✅ Data valid → kirim ke parent
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
        try { scannerRef.current.resume(); } catch {}
      }
      setState(STATE.SCANNING);
    }, ms);
  };

  // ── Switch kamera (depan/belakang) ────────────────────────────────────────
  const switchCamera = async () => {
    if (cameras.length < 2) return;
    await stopCamera();
    const next = (camIdx + 1) % cameras.length;
    setCamIdx(next);
    setTimeout(() => { if (mountedRef.current) setState(STATE.SCANNING); }, 300);
  };

  // ── Toggle flash/torch ─────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!scannerRef.current?.isScanning) return;
    try {
      // Akses video track langsung
      const tracks = scannerRef.current._localMediaStream?.getVideoTracks();
      if (tracks?.length) {
        const newVal = !torchOn;
        await tracks[0].applyConstraints({ advanced: [{ torch: newVal }] });
        setTorchOn(newVal);
      }
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

        {/* Overlay frame sudut */}
        {!isError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <style>{`
              @keyframes scanBounce{0%,100%{top:8%}50%{top:82%}}
              .scan-beam{animation:scanBounce 2s ease-in-out infinite;position:absolute;left:0;right:0}
            `}</style>
            <div className="relative w-56 h-56">
              {[
                "top-0 left-0  border-t-2 border-l-2 rounded-tl-xl",
                "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
                "bottom-0 left-0  border-b-2 border-l-2 rounded-bl-xl",
                "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-indigo-400 ${cls}`} />
              ))}
              {isActive && (
                <div className="scan-beam h-0.5 bg-indigo-400"
                  style={{ boxShadow: "0 0 10px rgba(129,140,248,1),0 0 22px rgba(129,140,248,0.5)" }}
                />
              )}
            </div>
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
                setErrorMsg(null);
                setState(STATE.LOADING);
                setTimeout(() => setState(STATE.SCANNING), 200);
              }}
              className="mt-4 flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-indigo-500 transition-colors">
              <RefreshCw size={15} /> Coba Lagi
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
          onChange={e => setCamIdx(Number(e.target.value))}
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
