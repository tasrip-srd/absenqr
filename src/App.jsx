import { useState } from "react";
import {
  Menu, QrCode, Users, Calendar, BarChart3, LogOut, Plus, Search,
  Printer, CheckCircle, AlertCircle, Home, ScanLine, Download,
  UserCheck, UserX, ArrowLeft, ArrowRight, Shield,
  RefreshCw, X, Check, Clock, Activity
} from "lucide-react";
import { downloadAllIDCards, downloadSingleIDCard } from "./utils/pdfGenerator";
import QRScannerCamera from "./components/QRScannerCamera";

const MOCK_USER = { name: "Sari Dewi", email: "panitia@sdharapan.sch.id", initials: "SD" };

const INIT_EVENTS = [
  { id: "EVT001", name: "Pentas Seni Akhir Tahun 2025", date: "2025-08-10", location: "Aula SD Harapan Bangsa", status: "active" },
  { id: "EVT002", name: "Rapat Wali Murid Semester 2",  date: "2025-07-20", location: "Ruang Rapat",            status: "completed" },
  { id: "EVT003", name: "Workshop Parenting 2025",      date: "2025-09-15", location: "Gedung Serba Guna",      status: "upcoming" },
];

const INIT_PARTICIPANTS = [
  { id:"PST001", eventId:"EVT001", namaOrtu:"Budi Santoso",    namaAnak:"Andi Budi Santoso",     kelas:"5A", korlas:"Ibu Dewi Rahayu",    divisi:"Divisi Seni",     hp:"081234567890" },
  { id:"PST002", eventId:"EVT001", namaOrtu:"Siti Nurhaliza",  namaAnak:"Bintang Cahya Pertiwi", kelas:"4B", korlas:"Pak Agus Setiawan",  divisi:"Divisi Dekorasi", hp:"082345678901" },
  { id:"PST003", eventId:"EVT001", namaOrtu:"Ahmad Fauzi",     namaAnak:"Rizki Ahmad Hidayat",   kelas:"6A", korlas:"Ibu Rini Wulandari", divisi:"Divisi Konsumsi", hp:"083456789012" },
  { id:"PST004", eventId:"EVT001", namaOrtu:"Dewi Kartika",    namaAnak:"Putri Dewi Lestari",    kelas:"5B", korlas:"Ibu Dewi Rahayu",    divisi:"Divisi Seni",     hp:"084567890123" },
  { id:"PST005", eventId:"EVT001", namaOrtu:"Roni Hakim",      namaAnak:"Farhan Roni Maulana",   kelas:"3A", korlas:"Pak Hendra Gunawan", divisi:"Divisi Dekorasi", hp:"085678901234" },
  { id:"PST006", eventId:"EVT002", namaOrtu:"Hendra Wijaya",   namaAnak:"Dani Hendra Wijaya",    kelas:"4A", korlas:"Pak Hendra Gunawan", divisi:"-",               hp:"086789012345" },
  { id:"PST007", eventId:"EVT002", namaOrtu:"Rina Susanti",    namaAnak:"Luna Rina Cantika",     kelas:"2B", korlas:"Ibu Yani Suryani",   divisi:"-",               hp:"087890123456" },
  { id:"PST008", eventId:"EVT003", namaOrtu:"Joko Susilo",     namaAnak:"Bagas Joko Pratama",    kelas:"1A", korlas:"Ibu Mira Sari",      divisi:"-",               hp:"088901234567" },
];

const INIT_ATTENDANCE = [
  { participantId:"PST001", eventId:"EVT001", waktuScan:"2025-08-10T08:15:32" },
  { participantId:"PST002", eventId:"EVT001", waktuScan:"2025-08-10T08:22:10" },
  { participantId:"PST004", eventId:"EVT001", waktuScan:"2025-08-10T09:01:05" },
  { participantId:"PST006", eventId:"EVT002", waktuScan:"2025-07-20T09:00:00" },
  { participantId:"PST007", eventId:"EVT002", waktuScan:"2025-07-20T09:05:00" },
];

const fmtDate = (s) => s ? new Date(s + (s.length===10?"T00:00:00":"")).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}) : "-";
const fmtTime = (s) => s ? new Date(s).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "-";

const STATUS_CFG = {
  active:    { label:"Aktif",       cls:"bg-emerald-100 text-emerald-700" },
  completed: { label:"Selesai",     cls:"bg-slate-100 text-slate-600"     },
  upcoming:  { label:"Akan Datang", cls:"bg-blue-100 text-blue-700"       },
};

const Badge = ({ status }) => {
  const { label, cls } = STATUS_CFG[status] || STATUS_CFG.upcoming;
  return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cls}`}>{label}</span>;
};

const Bar = ({ value, max, color="bg-indigo-500" }) => {
  const pct = max>0 ? Math.min(100,Math.round((value/max)*100)) : 0;
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{width:`${pct}%`}} />
    </div>
  );
};

const KPI = ({ label, value, sub, bg, ic, icon: Icon }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}><Icon size={16} className={ic}/></div>
    </div>
    <p className="text-3xl font-black text-slate-900">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-slate-900 text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, user, onLogout, open, onClose }) {
  const nav = [
    [Home,"Dashboard","dashboard"],
    [Calendar,"Event","events"],
    [Users,"Peserta","participants"],
    [QrCode,"ID Card & QR","id-cards"],
    [ScanLine,"Scan Absensi","scanner"],
    [BarChart3,"Laporan","report"],
  ];
  return (
    <aside className={`w-60 flex flex-col bg-slate-900 h-screen fixed lg:sticky top-0 left-0 z-50 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center">
          <QrCode size={15} className="text-white"/>
        </div>
        <div>
          <p className="font-black text-white text-sm leading-tight">AbsenQR</p>
          <p className="text-slate-500 text-xs">v1.0.0</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(([Icon,label,id]) => (
          <button key={id} onClick={()=>setPage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${page===id?"bg-indigo-600 text-white shadow-lg":"text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}>
            <Icon size={17} className="flex-shrink-0"/>{label}
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800 transition-colors">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{user.initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button onClick={onLogout} className="text-slate-500 hover:text-white transition-colors"><LogOut size={15}/></button>
        </div>
      </div>
    </aside>
  );
}

function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const go = () => { setLoading(true); setTimeout(()=>{setLoading(false);onLogin();},1800); };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#0f172a 100%)"}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{boxShadow:"0 0 40px rgba(99,102,241,0.45)"}}>
            <QrCode size={36} className="text-white"/>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">AbsenQR</h1>
          <p className="text-indigo-300 mt-2 text-sm">Sistem Absensi Digital Berbasis QR Code</p>
        </div>
        <div className="rounded-3xl p-8" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)"}}>
          <h2 className="text-white font-bold text-base mb-1">Masuk ke Dashboard Panitia</h2>
          <p className="text-slate-400 text-sm mb-6">Gunakan akun Google panitia untuk mengakses sistem.</p>
          <button onClick={go} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 font-semibold py-3.5 rounded-2xl hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-60">
            {loading
              ? <><RefreshCw size={18} className="animate-spin text-indigo-500"/><span>Sedang masuk...</span></>
              : <><svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg><span>Masuk dengan Google</span></>
            }
          </button>
          <div className="flex items-center justify-center gap-2 mt-5 text-slate-500 text-xs">
            <Shield size={12}/><span>Diamankan oleh Google OAuth 2.0</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[[ScanLine,"Scan QR"],[Users,"Kelola Peserta"],[BarChart3,"Laporan Real-time"]].map(([Icon,l])=>(
            <div key={l} className="text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                <Icon size={16} className="text-indigo-400"/>
              </div>
              <p className="text-xs text-slate-500">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ events, participants, attendance, setPage, setSelEvent }) {
  const active = events.find(e=>e.status==="active");
  const aP = participants.filter(p=>p.eventId===active?.id);
  const aA = attendance.filter(a=>a.eventId===active?.id);
  const pct = aP.length ? Math.round((aA.length/aP.length)*100) : 0;
  const recent = [...attendance].sort((a,b)=>b.waktuScan.localeCompare(a.waktuScan)).slice(0,5);
  return (
    <div className="p-6 space-y-6 max-w-full">
      <div><h1 className="text-xl font-black text-slate-900">Dashboard</h1><p className="text-slate-500 text-sm mt-0.5">Selamat datang, pantau aktivitas absensi Anda</p></div>
      {active && (
        <div className="relative overflow-hidden rounded-3xl p-6 text-white" style={{background:"linear-gradient(135deg,#4338ca 0%,#6366f1 100%)"}}>
          <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full pointer-events-none" style={{background:"rgba(255,255,255,0.05)"}}/>
          <div className="absolute right-4 bottom-0 w-20 h-20 rounded-full pointer-events-none" style={{background:"rgba(255,255,255,0.04)"}}/>
          <div className="relative">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div className="flex-1">
                <span className="text-xs rounded-full px-3 py-1 font-semibold" style={{background:"rgba(255,255,255,0.2)"}}>🟢 Event Sedang Berlangsung</span>
                <h2 className="text-xl font-black mt-2 leading-tight">{active.name}</h2>
                <p className="text-sm mt-1" style={{color:"rgba(199,210,254,1)"}}>{fmtDate(active.date)} · 📍 {active.location}</p>
              </div>
              <button onClick={()=>{setSelEvent(active.id);setPage("scanner");}}
                className="flex-shrink-0 bg-white text-indigo-700 text-sm font-bold px-3 py-2 rounded-xl hover:bg-indigo-50 flex items-center gap-2 transition-colors">
                <ScanLine size={16}/> Mulai Scan
              </button>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-2" style={{color:"rgba(199,210,254,0.8)"}}>
                <span>{aA.length} dari {aP.length} peserta hadir</span>
                <span className="font-bold text-white">{pct}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.2)"}}>
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{width:`${pct}%`}}/>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Event"   value={events.length}          sub="Semua event"          bg="bg-indigo-50"  ic="text-indigo-500"  icon={Calendar}/>
        <KPI label="Total Peserta" value={participants.length}    sub="Terdaftar"             bg="bg-sky-50"     ic="text-sky-500"     icon={Users}/>
        <KPI label="Sudah Hadir"   value={aA.length}              sub={`${pct}% kehadiran`}   bg="bg-emerald-50" ic="text-emerald-500" icon={UserCheck}/>
        <KPI label="Belum Hadir"   value={aP.length-aA.length}   sub="Perlu follow-up"       bg="bg-amber-50"   ic="text-amber-500"   icon={UserX}/>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-900">Scan Terbaru</h3>
          <button onClick={()=>setPage("report")} className="text-indigo-500 text-xs font-semibold flex items-center gap-1 hover:text-indigo-700">Lihat semua <ArrowRight size={12}/></button>
        </div>
        <div className="divide-y divide-slate-50">
          {recent.length===0
            ? <div className="py-12 text-center text-slate-400 text-sm"><ScanLine size={28} className="mx-auto mb-2 opacity-20"/>Belum ada scan</div>
            : recent.map((s,i)=>{
              const p=participants.find(x=>x.id===s.participantId);
              return (<div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0"><Check size={15} className="text-emerald-600"/></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{p?.namaAnak}</p><p className="text-xs text-slate-400">Kelas {p?.kelas} · {p?.divisi}</p></div>
                <span className="text-xs text-slate-400 font-mono">{fmtTime(s.waktuScan)}</span>
              </div>);
            })
          }
        </div>
      </div>
    </div>
  );
}

function EventsPage({ events, setEvents, participants, attendance, setPage, setSelEvent }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ name:"", date:"", location:"" });

  const handleCreate = () => {
    if (!form.name.trim()) return alert("Nama event wajib diisi");
    const ev = {
      id:       "EVT" + Date.now(),
      name:     form.name,
      date:     form.date,
      location: form.location,
      status:   "upcoming",
    };
    setEvents(prev => [...prev, ev]);
    setForm({ name:"", date:"", location:"" });
    setShowModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-full">
      {showModal && (
        <Modal title="Buat Event Baru" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Nama Event</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                placeholder="Contoh: Pentas Seni 2026"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Tanggal</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Lokasi</label>
              <input type="text" value={form.location} onChange={e => setForm({...form, location:e.target.value})}
                placeholder="Contoh: Aula Sekolah"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
            </div>
            <button onClick={handleCreate}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl hover:bg-indigo-700 transition-colors">
              Buat Event
            </button>
          </div>
        </Modal>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Event</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola semua event kegiatan</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-2xl transition-colors">
          <Plus size={16}/> Buat Event Baru
        </button>
      </div>

      <div className="space-y-3">
        {events.map(ev => {
          const evP = participants.filter(p => p.eventId === ev.id);
          const evA = attendance.filter(a => a.eventId === ev.id);
          const pct = evP.length ? Math.round((evA.length/evP.length)*100) : 0;
          return (
            <div key={ev.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5"><Badge status={ev.status}/><span className="text-xs text-slate-400 font-mono">{ev.id}</span></div>
                  <h3 className="font-bold text-slate-900 text-base">{ev.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{fmtDate(ev.date)} · 📍 {ev.location}</p>
                  <div className="mt-3 w-full">
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5"><span>{evA.length}/{evP.length} hadir</span><span className="font-bold text-slate-600">{pct}%</span></div>
                    <Bar value={evA.length} max={evP.length} color={ev.status==="completed"?"bg-emerald-500":"bg-indigo-500"}/>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {ev.status==="active" && <button onClick={()=>{setSelEvent(ev.id);setPage("scanner");}} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 font-bold"><ScanLine size={12}/>Scan</button>}
                  <button onClick={()=>{setSelEvent(ev.id);setPage("participants");}} className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl hover:bg-slate-50 flex items-center gap-1.5"><Users size={12}/>Peserta</button>
                  <button onClick={()=>{setSelEvent(ev.id);setPage("id-cards");}} className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl hover:bg-slate-50 flex items-center gap-1.5"><QrCode size={12}/>ID Card</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParticipantsPage({ participants, setParticipants, events, selEvent, attendance }) {
  const [evId, setEvId]         = useState(selEvent||events[0]?.id||"");
  const [q, setQ]               = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl]   = useState("");
  const [importing, setImporting]   = useState(false);

  const evP = participants.filter(p =>
    p.eventId === evId &&
    [p.namaAnak,p.namaOrtu,p.kelas,p.divisi].some(v => v.toLowerCase().includes(q.toLowerCase()))
  );
  const scanned = new Set(attendance.filter(a=>a.eventId===evId).map(a=>a.participantId));

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    const match = importUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { alert("URL tidak valid. Pastikan URL Google Sheets yang benar."); return; }
    setImporting(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res  = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          action:          "importPeserta",
          sourceSheetId:   match[1],
          sourceSheetName: "Form Responses 1",
          eventId:         evId,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        alert("✅ Berhasil import " + json.data.imported + " peserta!\nRefresh halaman untuk melihat data terbaru.");
        setShowImport(false);
        setImportUrl("");
      } else {
        alert("❌ Gagal: " + (json.data?.message || "Unknown error"));
      }
    } catch (err) {
      alert("❌ Error: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-full">
      {showImport && (
        <Modal title="Import dari Google Sheets" onClose={() => setShowImport(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Salin URL Google Sheets response Form Anda dan paste di bawah ini.</p>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">URL Google Sheets</label>
              <textarea value={importUrl} onChange={e => setImportUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                rows={3}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"/>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
              <span>Pastikan Google Sheets sudah dibagikan: klik <strong>Share → Anyone with the link → Viewer</strong></span>
            </div>
            <button onClick={handleImport} disabled={importing || !importUrl.trim()}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {importing ? "Mengimport data..." : "Import Peserta"}
            </button>
          </div>
        </Modal>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Data Peserta</h1>
          <p className="text-slate-500 text-sm mt-0.5">{evP.length} peserta ditemukan</p>
        </div>
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-2xl transition-colors">
          <Download size={16}/> Import dari Google Sheets
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" placeholder="Cari nama anak, orang tua, kelas..." value={q} onChange={e=>setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
        </div>
        <select value={evId} onChange={e=>setEvId(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["ID","Nama Anak","Nama Orang Tua","Kelas","Korlas","Divisi","No. HP","Status"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {evP.map(p=>(
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{p.id}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{p.namaAnak}</td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{p.namaOrtu}</td>
                  <td className="px-4 py-3.5"><span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg font-bold">{p.kelas}</span></td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{p.korlas}</td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{p.divisi}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs font-mono">{p.hp}</td>
                  <td className="px-4 py-3.5">
                    {scanned.has(p.id)
                      ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold"><Check size={10}/>Hadir</span>
                      : <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-semibold"><Clock size={10}/>Belum</span>}
                  </td>
                </tr>
              ))}
              {evP.length===0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm"><Users size={28} className="mx-auto mb-3 opacity-20"/>Tidak ada peserta ditemukan</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IDCardsPage({ participants, events, selEvent }) {
  const [evId, setEvId] = useState(selEvent||events[0]?.id||"");
  const [preview, setPreview] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [gen, setGen] = useState(false);
  const [pct, setPct] = useState(0);
  const ev = events.find(e=>e.id===evId);
  const evP = participants.filter(p=>p.eventId===evId);

  const IDCard = ({ p, large=false }) => {
    const qrData = encodeURIComponent(JSON.stringify({id:p.id,event_id:p.eventId,nama_ortu:p.namaOrtu,nama_anak:p.namaAnak,kelas:p.kelas,korlas:p.korlas,divisi:p.divisi,hp:p.hp}));
    const qrSize = large ? 100 : 80;
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-md">
        <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3" style={{background:"linear-gradient(90deg,#4338ca,#6366f1)"}}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.6)"}}>ID Card Peserta</p>
            <p className="text-white font-bold text-sm leading-tight mt-0.5 truncate max-w-xs">{ev?.name||""}</p>
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"rgba(255,255,255,0.2)"}}><QrCode size={14} className="text-white"/></div>
        </div>
        <div className={`flex gap-3 ${large?"p-6":"p-4"}`}>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-xs mb-0.5">Nama Anak</p>
            <p className={`font-black text-slate-900 leading-tight ${large?"text-lg":"text-sm"}`}>{p.namaAnak}</p>
            <p className="text-slate-400 text-xs mt-2 mb-0.5">Nama Orang Tua</p>
            <p className="text-slate-600 text-xs">{p.namaOrtu}</p>
            <div className="flex gap-4 mt-2">
              <div><p className="text-slate-400 text-xs mb-0.5">Kelas</p><p className="text-indigo-700 text-xs font-black">{p.kelas}</p></div>
              <div><p className="text-slate-400 text-xs mb-0.5">Korlas</p><p className="text-slate-700 text-xs font-semibold">{p.korlas}</p></div>
            </div>
            <div className="mt-2"><p className="text-slate-400 text-xs mb-0.5">Divisi</p><p className="text-slate-700 text-xs font-semibold">{p.divisi}</p></div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center">
            <img src={`https://quickchart.io/qr?text=${qrData}&size=${qrSize}&margin=1`} alt="QR Code"
              className={`${large?"w-24 h-24":"w-20 h-20"} rounded-lg border border-slate-100`}
              onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}/>
            <div className={`${large?"w-24 h-24":"w-20 h-20"} bg-slate-100 rounded-lg items-center justify-center`} style={{display:"none"}}><QrCode size={32} className="text-slate-300"/></div>
            <p className="text-center text-slate-400 text-xs mt-1 font-mono">{p.id}</p>
          </div>
        </div>
        <div className="bg-indigo-50 px-4 py-2 flex flex-wrap items-start justify-between gap-3">
          <p className="text-indigo-500 text-xs truncate">{p.korlas}</p>
          <p className="text-indigo-400 text-xs flex-shrink-0">{fmtDate(ev?.date)}</p>
        </div>
      </div>
    );
  };

  if (preview) return (
    <div className="p-6 max-w-full mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={()=>setPreview(null)} className="text-slate-500 hover:text-slate-800 p-1"><ArrowLeft size={20}/></button>
        <h1 className="text-xl font-black text-slate-900 flex-1">Preview ID Card</h1>
        <button onClick={()=>window.print()} className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-4 py-2.5 rounded-2xl hover:bg-indigo-700"><Printer size={16}/>Cetak Kartu</button>
      </div>
      <IDCard p={preview} large/>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
        <span>Klik <strong>Cetak Kartu</strong> untuk mencetak. Serahkan kartu ini kepada peserta <strong>sebelum hari H</strong>. QR Code berfungsi sebagai tanda masuk saat event berlangsung.</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-900">ID Card & QR Code</h1><p className="text-slate-500 text-sm mt-0.5">Generate dan cetak kartu identitas peserta</p></div>
        <div className="flex gap-2">
          <select value={evId} onChange={e=>setEvId(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none">
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button
  onClick={async () => {
    if (!evP.length) { alert("Tidak ada peserta untuk dicetak"); return; }
    setGen(true);
    try {
      await downloadAllIDCards(evP, ev, {
        onProgress: (c, t) => setPct(Math.round(c / t * 100)),
      });
    } catch (err) {
      alert("Gagal generate PDF: " + err.message);
    } finally {
      setGen(false); setPct(0);
    }
  }}
  disabled={gen || !evP.length}
  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50 transition-colors">
  {gen ? `Generating... ${pct}%` : <><Printer size={16}/> Cetak Semua</>}
</button>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5"/>
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-0.5">Alur penggunaan ID Card</p>
          <p>QR Code berisi data lengkap peserta (nama anak, ortu, kelas, korlas, divisi, HP). Cetak kartu → serahkan ke peserta sebelum hari H → panitia scan QR Code saat check-in → data masuk otomatis ke Google Sheets.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {evP.map(p=>(
          <div key={p.id} className="relative" onMouseEnter={()=>setHovered(p.id)} onMouseLeave={()=>setHovered(null)}>
            <IDCard p={p}/>
            {hovered===p.id && (
              <div className="absolute inset-0 rounded-2xl flex items-end justify-center pb-3" style={{background:"rgba(0,0,0,0.07)"}}>
                <button onClick={()=>setPreview(p)} className="bg-indigo-600 text-white text-xs font-bold px-5 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-lg"><Printer size={13}/>Preview & Cetak</button>
              </div>
            )}
          </div>
        ))}
        {evP.length===0 && <div className="col-span-3 py-16 text-center text-slate-400"><QrCode size={36} className="mx-auto mb-3 opacity-20"/><p className="text-sm">Tidak ada peserta untuk event ini</p></div>}
      </div>
    </div>
  );
}

function ScannerPage({ participants, events, attendance, setAttendance, selEvent }) {
  const [evId, setEvId] = useState(selEvent||events.find(e=>e.status==="active")?.id||events[0]?.id||"");
  const [result, setResult] = useState(null);
  const [manualId, setManualId] = useState("");

  const evP = participants.filter(p=>p.eventId===evId);
  const evA = attendance.filter(a=>a.eventId===evId);
  const scanned = new Set(evA.map(a=>a.participantId));
  const pct = evP.length ? Math.round((evA.length/evP.length)*100) : 0;

  const doScan = (pid) => {
    const p = evP.find(x=>x.id===String(pid).toUpperCase());
    if (!p)               { setResult({type:"notfound",p:null}); setTimeout(()=>setResult(null),2800); return; }
    if (scanned.has(p.id)){ setResult({type:"duplicate",p});     setTimeout(()=>setResult(null),2800); return; }
    setAttendance(prev=>[...prev,{participantId:p.id,eventId:evId,waktuScan:new Date().toISOString()}]);
    setResult({type:"success",p});
    setTimeout(()=>setResult(null),2800);
  };

  const handleCameraScan = (qrData) => {
    if (!qrData?.id) { setResult({type:"notfound",p:null}); setTimeout(()=>setResult(null),2800); return; }
    doScan(qrData.id);
  };

  const resultOverlay = result && (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{background:result.type==="success"?"rgba(2,44,28,0.96)":result.type==="duplicate"?"rgba(65,36,2,0.96)":"rgba(80,19,19,0.96)"}}>
      {result.type==="success" && <>
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-3"><Check size={32} className="text-white"/></div>
        <p className="text-white text-2xl font-black tracking-wide">HADIR ✓</p>
        <p className="text-emerald-300 font-semibold mt-2 text-lg">{result.p?.namaAnak}</p>
        <p className="text-emerald-500 text-sm">Kelas {result.p?.kelas} · {result.p?.divisi}</p>
        <p className="text-emerald-600 text-xs mt-3">Data tercatat di Google Sheets ✓</p>
      </>}
      {result.type==="duplicate" && <>
        <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mb-3"><AlertCircle size={32} className="text-white"/></div>
        <p className="text-white text-xl font-black">SUDAH HADIR</p>
        <p className="text-amber-300 font-semibold mt-2">{result.p?.namaAnak}</p>
        <p className="text-amber-500 text-sm mt-1">Data kehadiran sudah tercatat sebelumnya</p>
      </>}
      {result.type==="notfound" && <>
        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-3"><X size={32} className="text-white"/></div>
        <p className="text-white text-xl font-black">TIDAK DITEMUKAN</p>
        <p className="text-red-400 text-sm mt-2">Peserta tidak terdaftar pada event ini</p>
      </>}
    </div>
  );

  return (
    <div className="p-6 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div><h1 className="text-xl font-black text-slate-900">Scan Absensi</h1><p className="text-slate-500 text-sm mt-0.5">Arahkan kamera ke QR Code pada kartu peserta</p></div>
        <select value={evId} onChange={e=>setEvId(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none">
          {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <QRScannerCamera
            eventId={evId}
            autoStart
            pauseMs={2800}
            onScanSuccess={handleCameraScan}
            onScanError={(msg)=>console.error("[Scanner]", msg)}
            overlay={resultOverlay}
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-emerald-700">{evA.length}</p><p className="text-xs text-emerald-600 font-semibold">Hadir</p></div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-slate-600">{evP.length-evA.length}</p><p className="text-xs text-slate-500 font-semibold">Belum</p></div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-indigo-700">{pct}%</p><p className="text-xs text-indigo-500 font-semibold">Rate</p></div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Input Manual ID Peserta</p>
            <div className="flex gap-2">
              <input type="text" value={manualId} onChange={e=>setManualId(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&manualId.trim()){doScan(manualId.trim());setManualId("");}}}
                placeholder="Contoh: PST003"
                className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
              <button onClick={()=>{if(manualId.trim()){doScan(manualId.trim());setManualId("");}}} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">Scan</button>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">💡 Demo — klik nama untuk simulasi scan:</p>
            <div className="flex flex-wrap gap-2">
              {evP.map(p=>(
                <button key={p.id} onClick={()=>doScan(p.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${scanned.has(p.id)?"bg-emerald-50 border-emerald-200 text-emerald-700":"bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"}`}>
                  {scanned.has(p.id)?<span><Check size={10} className="inline mr-1"/>{p.namaAnak.split(" ")[0]}</span>:p.namaAnak.split(" ")[0]}
                </button>
              ))}
              {evP.length===0 && <p className="text-xs text-slate-400">Tidak ada peserta terdaftar</p>}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900">Log Kehadiran Real-time</h3>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {evA.length===0
              ? <div className="py-16 text-center text-slate-400 text-sm"><Activity size={28} className="mx-auto mb-2 opacity-20"/><p>Belum ada scan</p><p className="text-xs mt-1 text-slate-300">Mulai scan QR Code peserta</p></div>
              : <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {[...evA].reverse().map((s,i)=>{
                    const p=participants.find(x=>x.id===s.participantId);
                    return (<div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0"><Check size={14} className="text-emerald-600"/></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{p?.namaAnak}</p><p className="text-xs text-slate-400">{p?.kelas} · {p?.divisi}</p></div>
                      <p className="text-xs text-slate-400 font-mono whitespace-nowrap">{fmtTime(s.waktuScan)}</p>
                    </div>);
                  })}
                </div>
            }
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex justify-between text-sm mb-3"><span className="font-bold text-slate-900">Progress Kehadiran</span><span className="text-slate-500 font-medium">{evA.length}/{evP.length}</span></div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#10b981)"}}/>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2"><span>0%</span><span className="text-indigo-600 font-bold">{pct}% hadir</span><span>100%</span></div>
          </div>
          {evP.filter(p=>!scanned.has(p.id)).length>0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50"><h4 className="font-bold text-slate-700 text-sm">Belum Hadir ({evP.filter(p=>!scanned.has(p.id)).length})</h4></div>
              <div className="divide-y divide-slate-50 max-h-44 overflow-y-auto">
                {evP.filter(p=>!scanned.has(p.id)).map(p=>(
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0"><Clock size={12} className="text-slate-400"/></div>
                    <div className="flex-1 min-w-0"><p className="text-sm text-slate-700 font-medium truncate">{p.namaAnak}</p><p className="text-xs text-slate-400">{p.kelas} · {p.divisi}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportPage({ participants, events, attendance }) {
  const [evId, setEvId] = useState(events[0]?.id||"");
  const [tab, setTab] = useState("all");
  const evP = participants.filter(p=>p.eventId===evId);
  const evA = attendance.filter(a=>a.eventId===evId);
  const scanned = new Set(evA.map(a=>a.participantId));
  const displayed = evP.filter(p=>tab==="all"?true:tab==="hadir"?scanned.has(p.id):!scanned.has(p.id));
  const pct = evP.length?Math.round((evA.length/evP.length)*100):0;
  const byDiv = evP.reduce((acc,p)=>{if(!acc[p.divisi])acc[p.divisi]={t:0,h:0};acc[p.divisi].t++;if(scanned.has(p.id))acc[p.divisi].h++;return acc;},{});
  const byKelas = evP.reduce((acc,p)=>{if(!acc[p.kelas])acc[p.kelas]={t:0,h:0};acc[p.kelas].t++;if(scanned.has(p.id))acc[p.kelas].h++;return acc;},{});
  return (
    <div className="p-6 space-y-6 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-900">Laporan Kehadiran</h1><p className="text-slate-500 text-sm mt-0.5">Rekap data kehadiran peserta event</p></div>
        <div className="flex gap-2">
          <select value={evId} onChange={e=>setEvId(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none">
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button
  onClick={() => {
    const headers = ["Nama Anak","Nama Orang Tua","Kelas","Korlas","Divisi","No. HP","Waktu Hadir","Status"];
    const rows = evP.map(p => {
      const s = evA.find(a => a.participantId === p.id);
      return [
        p.namaAnak, p.namaOrtu, p.kelas, p.korlas,
        p.divisi, p.hp,
        s ? fmtTime(s.waktuScan) : "-",
        s ? "Hadir" : "Tidak Hadir",
      ];
    });
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Absensi-${(events.find(e=>e.id===evId)?.name||"Event").replace(/[^a-z0-9]/gi,"_")}-${new Date().toLocaleDateString("id-ID").replace(/\//g,"-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }}
  className="flex items-center gap-2 border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
  <Download size={16}/> Export CSV
</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center shadow-sm"><p className="text-4xl font-black text-slate-900">{evP.length}</p><p className="text-sm text-slate-500 mt-1 font-semibold">Total Peserta</p></div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 text-center shadow-sm"><p className="text-4xl font-black text-emerald-700">{evA.length}</p><p className="text-sm text-emerald-600 mt-1 font-semibold">Hadir</p><p className="text-xs text-emerald-500 mt-0.5">{pct}% dari total</p></div>
        <div className="bg-red-50 rounded-2xl border border-red-100 p-5 text-center shadow-sm"><p className="text-4xl font-black text-red-600">{evP.length-evA.length}</p><p className="text-sm text-red-500 mt-1 font-semibold">Tidak Hadir</p><p className="text-xs text-red-400 mt-0.5">{evP.length?100-pct:0}% dari total</p></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Kehadiran Per Divisi</h3>
          <div className="space-y-3.5">
            {Object.entries(byDiv).map(([d,v])=>{const p=v.t?Math.round((v.h/v.t)*100):0;return(<div key={d}><div className="flex justify-between text-sm mb-1.5"><span className="text-slate-700 font-semibold">{d}</span><span className="text-slate-400">{v.h}/{v.t} <span className="text-indigo-600 font-bold">({p}%)</span></span></div><Bar value={v.h} max={v.t} color="bg-indigo-500"/></div>);})}
            {!Object.keys(byDiv).length&&<p className="text-sm text-slate-400 text-center py-4">Tidak ada data</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Kehadiran Per Kelas</h3>
          <div className="space-y-3.5">
            {Object.entries(byKelas).map(([k,v])=>{const p=v.t?Math.round((v.h/v.t)*100):0;return(<div key={k}><div className="flex justify-between text-sm mb-1.5"><span className="text-slate-700 font-semibold">Kelas {k}</span><span className="text-slate-400">{v.h}/{v.t} <span className="text-emerald-600 font-bold">({p}%)</span></span></div><Bar value={v.h} max={v.t} color="bg-emerald-500"/></div>);})}
            {!Object.keys(byKelas).length&&<p className="text-sm text-slate-400 text-center py-4">Tidak ada data</p>}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-900">Daftar Lengkap Peserta</h3>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {[["all",`Semua (${evP.length})`],["hadir",`Hadir (${evA.length})`],["belum",`Tidak Hadir (${evP.length-evA.length})`]].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${tab===v?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Nama Anak","Nama Orang Tua","Kelas","Korlas","Divisi","No. HP","Waktu Hadir","Status"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayed.map(p=>{
                const s=evA.find(a=>a.participantId===p.id);
                return(<tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{p.namaAnak}</td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{p.namaOrtu}</td>
                  <td className="px-4 py-3.5"><span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg font-bold">{p.kelas}</span></td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{p.korlas}</td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{p.divisi}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs font-mono">{p.hp}</td>
                  <td className="px-4 py-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">{s?fmtTime(s.waktuScan):"—"}</td>
                  <td className="px-4 py-3.5">{s?<span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold"><Check size={10}/>Hadir</span>:<span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs px-2.5 py-1 rounded-full font-bold"><X size={10}/>Tidak Hadir</span>}</td>
                </tr>);
              })}
              {displayed.length===0&&<tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm"><CheckCircle size={24} className="mx-auto mb-2 opacity-20"/>Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [page, setPage]               = useState("dashboard");
  const [selEvent, setSelEvent]       = useState("EVT001");
  const [attendance, setAttendance]   = useState(INIT_ATTENDANCE);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents]           = useState(INIT_EVENTS);
  const [participants, setParticipants] = useState(INIT_PARTICIPANTS);

  if (!loggedIn) return <LoginPage onLogin={()=>setLoggedIn(true)}/>;

  const shared = { participants, setParticipants, events, setEvents, attendance, setPage };
  const pages = {
    dashboard:    <DashboardPage    {...shared} setSelEvent={setSelEvent}/>,
    events:       <EventsPage       {...shared} setSelEvent={setSelEvent}/>,
    participants: <ParticipantsPage {...shared} selEvent={selEvent}/>,
    "id-cards":   <IDCardsPage      {...shared} selEvent={selEvent}/>,
    scanner:      <ScannerPage      {...shared} setAttendance={setAttendance} selEvent={selEvent}/>,
    report:       <ReportPage       {...shared}/>,
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{background:"rgba(0,0,0,0.5)"}}
          onClick={() => setSidebarOpen(false)}/>
      )}
      <Sidebar
        page={page}
        setPage={p => { setPage(p); setSidebarOpen(false); }}
        user={MOCK_USER}
        onLogout={() => setLoggedIn(false)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu size={22}/>
          </button>
          <div className="w-6 h-6 bg-indigo-500 rounded-lg flex items-center justify-center">
            <QrCode size={12} className="text-white"/>
          </div>
          <span className="font-bold text-slate-900 text-sm">AbsenQR</span>
        </div>
        {pages[page]||pages.dashboard}
      </main>
    </div>
  );
}