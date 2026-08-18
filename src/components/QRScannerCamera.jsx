/**
 * QRScannerCamera.jsx — Komponen Scanner Kamera Real
 * AbsenQR Production Component
 *
 * INSTALL:  npm install jsqr lucide-react
 *
 * Pendekatan native: getUserMedia() langsung untuk akses kamera + BarcodeDetector
 * API bawaan Chrome Android sebagai scanner utama (tanpa library eksternal untuk
 * decode). Fallback ke jsQR (dimuat dinamis, hanya saat dibutuhkan) di browser
 * yang belum punya BarcodeDetector (mis. Safari/Firefox desktop, Chrome lama).
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
  LOADING:  "loading",  // minta izin & buka stream kamera
  SCANNING: "scanning", // kamera aktif & scan berjalan
  PAUSED:   "paused",   // jeda sementara setelah scan (video tetap jalan)
  ERROR:    "error",
};

// Jeda setelah melepas track kamera sebelum minta stream baru. Chrome Android
// (dan beberapa browser mobile lain) butuh waktu untuk benar-benar melepas
// handle hardware kamera ke OS — request stream baru langsung setelah stop()
// tanpa jeda adalah penyebab umum error "Could not start video source".
const CAMERA_RELEASE_DELAY_MS = 500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Jarak minimum (ms) antar upaya decode. BarcodeDetector.detect() & jsQR
// keduanya cukup berat untuk dipanggil di setiap frame (~60fps); throttle ke
// ~10fps sudah lebih dari cukup untuk QR statis dan menghindari jank/flicker
// pada video akibat main thread sibuk terus-menerus.
const DETECT_INTERVAL_MS = 100;

const hasBarcodeDetector = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window;

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
  const [state, setState]         = useState(STATE.IDLE);
  const [cameras, setCameras]     = useState([]);
  const [camIdx, setCamIdx]       = useState(0);
  const [errorMsg, setErrorMsg]   = useState(null);
  const [torchOn, setTorchOn]     = useState(false);
  const [manualCam, setManualCam] = useState(false);

  const videoRef      = useRef(null);
  const canvasRef      = useRef(null); // dipakai hanya oleh fallback jsQR
  const streamRef      = useRef(null);
  const rafRef          = useRef(null);
  const detectorRef     = useRef(null); // instance BarcodeDetector
  const jsQRRef          = useRef(null); // fungsi jsQR (dimuat dinamis, lazy)
  const detectBusyRef    = useRef(false); // guard: cegah detect() tumpang tindih
  const lastDetectAtRef  = useRef(0);
  const pausedRef        = useRef(false); // skip decode tanpa hentikan video (no flicker)
  const mountedRef       = useRef(true);
  const pauseTimer       = useRef(null);
  // Ref (bukan state) — perlu bisa dibaca/ditulis secara sinkron agar benar-
  // benar mencegah 2 pemanggilan startCamera() berjalan bersamaan (mis. efek
  // re-run + klik tombol di tick yang sama). State React tidak cukup cepat
  // untuk guard reentrancy semacam ini karena update-nya async/batched.
  const isStartingRef = useRef(false);

  // ── Hentikan loop rAF ──────────────────────────────────────────────────────
  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Lepas stream kamera yang berjalan (best-effort) ─────────────────────────
  const releaseStream = useCallback(async () => {
    stopLoop();
    const stream = streamRef.current;
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (!stream) return;
    stream.getTracks().forEach(t => { try { t.stop(); } catch {} });
  }, [stopLoop]);

  // ── Cleanup saat unmount ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(pauseTimer.current);
      stopLoop();
      streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch {} });
    };
  }, [stopLoop]);

  // ── Proses hasil scan ─────────────────────────────────────────────────────
  const handleResult = useCallback((rawText) => {
    // Jeda decode sementara — video TIDAK dihentikan, hanya loop pembacaan QR
    // yang dijeda (pausedRef), supaya tidak ada flicker/black-frame di preview.
    pausedRef.current = true;
    setState(STATE.PAUSED);

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

    setErrorMsg(null);
    onScanSuccess(data);
    resumeAfterDelay(pauseMs);
  }, [onScanSuccess, onScanError, pauseMs]);

  // Resume decode setelah jeda (video sudah tetap jalan selama ini)
  const resumeAfterDelay = (ms) => {
    pauseTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setErrorMsg(null);
      pausedRef.current = false;
      if (streamRef.current) setState(STATE.SCANNING);
    }, ms);
  };

  // ── Loop scanning (requestAnimationFrame) ───────────────────────────────────
  const tick = useCallback((ts) => {
    if (!mountedRef.current || !streamRef.current) return;
    const video = videoRef.current;

    const shouldDecode =
      !pausedRef.current &&
      video && video.readyState >= 2 /* HAVE_CURRENT_DATA */ &&
      !detectBusyRef.current &&
      ts - lastDetectAtRef.current >= DETECT_INTERVAL_MS;

    if (shouldDecode) {
      lastDetectAtRef.current = ts;
      detectBusyRef.current = true;

      const finish = () => { detectBusyRef.current = false; };

      if (detectorRef.current) {
        detectorRef.current.detect(video)
          .then(codes => {
            if (codes?.length && mountedRef.current && !pausedRef.current) {
              handleResult(codes[0].rawValue);
            }
          })
          .catch(() => {}) // frame sesaat tidak valid untuk detect — abaikan, coba lagi frame berikutnya
          .finally(finish);
      } else if (jsQRRef.current) {
        const canvas = canvasRef.current;
        const vw = video.videoWidth, vh = video.videoHeight;
        if (vw && vh) {
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
          }
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, vw, vh);
          try {
            const imgData = ctx.getImageData(0, 0, vw, vh);
            const result = jsQRRef.current(imgData.data, vw, vh, { inversionAttempts: "dontInvert" });
            if (result?.data && mountedRef.current && !pausedRef.current) {
              handleResult(result.data);
            }
          } catch {}
        }
        finish();
      } else {
        finish();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [handleResult]);

  // ── Terapkan autofocus kontinu (best-effort, tidak semua device dukung) ────
  const applyContinuousFocus = async (track) => {
    try {
      const caps = track.getCapabilities?.();
      if (caps?.focusMode?.includes?.("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
      }
    } catch {
      // Autofocus manual tidak didukung perangkat ini — abaikan, kamera tetap jalan
    }
  };

  // ── Start kamera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async (targetIdx = camIdx, useManual = manualCam) => {
    // Cegah double-start: dua permintaan getUserMedia() bersamaan di Android
    // adalah penyebab umum "Could not start video source".
    if (isStartingRef.current || !mountedRef.current) return;
    isStartingRef.current = true;
    setState(STATE.LOADING);
    setErrorMsg(null);

    try {
      // Pastikan stream lama benar-benar dilepas, lalu beri jeda ke OS sebelum
      // minta stream baru (lihat CAMERA_RELEASE_DELAY_MS).
      if (streamRef.current) {
        await releaseStream();
        await sleep(CAMERA_RELEASE_DELAY_MS);
        if (!mountedRef.current) return;
      }

      // Default: minta kamera belakang via facingMode (tidak bergantung pada
      // urutan/label device — paling andal untuk mobile). Setelah user
      // memilih kamera lain secara manual, pakai deviceId spesifik itu.
      const videoConstraints = useManual && cameras[targetIdx]
        ? { deviceId: { exact: cameras[targetIdx].deviceId } }
        : { facingMode: { ideal: "environment" } };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...videoConstraints, width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      await applyContinuousFocus(track);

      // Susun ulang daftar kamera (label baru tersedia setelah izin diberikan)
      // hanya sekali — supaya dropdown & tombol switch-camera bisa dipakai.
      if (!cameras.length) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const vids = devices.filter(d => d.kind === "videoinput");
          if (vids.length) {
            setCameras(vids);
            const activeId = track.getSettings?.().deviceId;
            const idx = vids.findIndex(d => d.deviceId === activeId);
            setCamIdx(idx >= 0 ? idx : 0);
          }
        } catch {
          // enumerateDevices gagal — tidak fatal, hanya tombol ganti kamera yang tidak muncul
        }
      }

      // Siapkan mesin decode: BarcodeDetector (native) bila tersedia, kalau
      // tidak fallback ke jsQR (lazy-loaded, hanya diunduh saat dibutuhkan).
      if (!detectorRef.current && !jsQRRef.current) {
        if (hasBarcodeDetector()) {
          try {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            if (formats.includes("qr_code")) {
              detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
            }
          } catch {
            // getSupportedFormats gagal — anggap tidak didukung, pakai fallback
          }
        }
        if (!detectorRef.current) {
          const mod = await import("jsqr");
          jsQRRef.current = mod.default;
        }
      }

      pausedRef.current = false;
      lastDetectAtRef.current = 0;
      if (mountedRef.current) {
        setState(STATE.SCANNING);
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
      if (!mountedRef.current) return;
      console.error("[QRScannerCamera] Gagal memulai kamera:", err);
      let msg;
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "Akses kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        msg = "Tidak ada kamera terdeteksi di perangkat ini.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        msg = "Kamera sedang dipakai proses lain atau belum sempat dilepas. Tunggu sebentar lalu coba lagi.";
      } else if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
        msg = "Kamera yang dipilih tidak didukung. Coba kamera lain.";
      } else {
        msg = "Gagal memulai kamera: " + (err.message || err);
      }
      setErrorMsg(msg);
      setState(STATE.ERROR);
      onScanError?.(msg);
    } finally {
      isStartingRef.current = false;
    }
  }, [cameras, camIdx, manualCam, onScanError, releaseStream, tick]);

  // ── Stop kamera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    clearTimeout(pauseTimer.current);
    await releaseStream();
    if (mountedRef.current) setState(STATE.IDLE);
  }, [releaseStream]);

  // ── Autostart saat mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (autoStart) startCamera(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch kamera (depan/belakang) ────────────────────────────────────────
  const switchCamera = async () => {
    if (cameras.length < 2 || isStartingRef.current) return;
    const next = (camIdx + 1) % cameras.length;
    setManualCam(true);
    setCamIdx(next);
    await startCamera(next, true);
  };

  // ── Mulai / coba lagi setelah error ────────────────────────────────────────
  const handleStartClick = async () => {
    if (isStartingRef.current) return;
    await startCamera(camIdx, manualCam);
  };

  // ── Toggle flash/torch ─────────────────────────────────────────────────────
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      const newVal = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newVal }] });
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
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: isActive ? "block" : "none" }}
        />
        {/* Canvas offscreen — hanya dipakai fallback jsQR untuk decode, tidak ditampilkan */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Overlay frame sudut — ukuran mengikuti proporsi kotak scan (85%) */}
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
              onClick={handleStartClick}
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
          <button onClick={handleStartClick}
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
            <option key={cam.deviceId} value={i}>
              {cam.label || `Kamera ${i + 1}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
