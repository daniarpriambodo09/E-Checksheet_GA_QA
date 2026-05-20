// app/admin/qr-generator/page.tsx
// REVISI: QR Area sekarang HANYA berisi "Nama Area" (plain text)
//         Conveyor, Pattern, Spesifik Area dipilih SETELAH scan di card /home

"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";

function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (typeof window === "undefined") return fetch(url, options);
  try {
    const userStr = localStorage.getItem("auth_current_user_v2");
    if (userStr) {
      const u = JSON.parse(userStr);
      options.headers = {
        "Content-Type": "application/json",
        ...options.headers,
        "x-user-id":   String(u.id || ""),
        "x-user-role": String(u.role || ""),
        "x-username":  String(u.username || ""),
      };
    }
  } catch {}
  return fetch(url, options);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Area     { id: number; category_id: number; area_name: string; area_code: string; is_active: boolean; }
interface Category { id: number; category_name: string; category_code: string; table_type: string; area_type: string; }

interface GaugeQRRow {
  id: number; gauge_type_id: number; gauge_type_slug: string; gauge_type_name: string;
  area_type: "pre-assy" | "final-assy"; gauge_id: string; qr_value: string;
  display_name: string; seq_number: number; notes: string | null; is_active: boolean;
}

declare global { interface Window { QRCode: any; _qrcodeScriptLoading?: boolean; _qrcodeScriptLoaded?: boolean; } }

const PA_GAUGE_TYPE_LIST = [
  { dciItemId: 2, slug: "micrometer",         name: "MICROMETER",                abbrev: "MCR" },
  { dciItemId: 3, slug: "caliper",             name: "CALIPER",                   abbrev: "CAL" },
  { dciItemId: 4, slug: "tensile",             name: "MESIN TENSILE",             abbrev: "TNS" },
  { dciItemId: 5, slug: "steel-ruler",         name: "STEEL RULER",               abbrev: "STR" },
  { dciItemId: 6, slug: "bent-gauge",          name: "BENT UP/DOWN GAUGE",        abbrev: "BNG" },
  { dciItemId: 7, slug: "thickness-gauge",     name: "THICKNESS GAUGE / GO NO GO", abbrev: "THG" },
  { dciItemId: 8, slug: "pocket-comparator",  name: "POCKET COMPARATOR",         abbrev: "PKC" },
  { dciItemId: 9, slug: "crimping-standard",  name: "CRIMPING STANDARD & IS",    abbrev: "CRS" },
];

const FA_GAUGE_TYPE_LIST = [
  { dciItemId: 1,  slug: "pipo",             name: "PIPO",                         abbrev: "PPO" },
  { dciItemId: 2,  slug: "roll-meter",       name: "ROLL METER / MISTAR BAJA",     abbrev: "RMT" },
  { dciItemId: 3,  slug: "go-no-go",         name: "GO NO GO",                     abbrev: "GNG" },
  { dciItemId: 4,  slug: "push-gauge-rb",    name: "PUSH GAUGE RB",                abbrev: "PGR" },
  { dciItemId: 5,  slug: "dummy-sample",     name: "DUMMY SAMPLE OK & N-OK",       abbrev: "DMS" },
  { dciItemId: 6,  slug: "inspection-point", name: "IMPORTANT / INSPECTION POINT", abbrev: "INP" },
  { dciItemId: 7,  slug: "fuse-plate",       name: "FUSE PLATE",                   abbrev: "FSP" },
  { dciItemId: 8,  slug: "lampu-navigasi",   name: "LAMPU NAVIGASI",               abbrev: "LMN" },
  { dciItemId: 9,  slug: "tape-navigasi",    name: "TAPE NAVIGASI",                abbrev: "TPN" },
  { dciItemId: 10, slug: "inspection-board", name: "INSPECTION BOARD",             abbrev: "ISB" },
  { dciItemId: 11, slug: "dry-surf",         name: "DRY SURF",                     abbrev: "DRS" },
  { dciItemId: 12, slug: "packing",          name: "PACKING",                      abbrev: "PKG" },
];

function getGaugeList(areaType: "pre-assy" | "final-assy") {
  return areaType === "pre-assy" ? PA_GAUGE_TYPE_LIST : FA_GAUGE_TYPE_LIST;
}

// ── QR Script loader ──────────────────────────────────────────────────────────
function loadQRScript(cb: () => void) {
  if (window._qrcodeScriptLoaded) { cb(); return; }
  if (window._qrcodeScriptLoading) {
    const p = setInterval(() => { if (window._qrcodeScriptLoaded) { clearInterval(p); cb(); } }, 80);
    return;
  }
  window._qrcodeScriptLoading = true;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  s.onload = () => { window._qrcodeScriptLoaded = true; window._qrcodeScriptLoading = false; cb(); };
  s.onerror = () => { window._qrcodeScriptLoading = false; };
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// AreaQRCard — REVISI: QR hanya encode "Nama Area" saja
// ─────────────────────────────────────────────────────────────────────────────
function AreaQRCard({ area, shift, index }: {
  area: Area;
  shift: "A" | "B" | "AB";
  index: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qrRef      = useRef<HTMLDivElement | null>(null);

  // QR text = area_name saja (plain text)
  const qrText = area.area_name;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const c = document.createElement("div");
    c.style.cssText = "width:160px;height:160px;";
    qrRef.current = c;
    wrapperRef.current.appendChild(c);
    loadQRScript(() => {
      if (!window.QRCode || !qrRef.current) return;
      try {
        new window.QRCode(qrRef.current, {
          text: qrText,
          width: 160, height: 160,
          colorDark: "#1e293b", colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M,
        });
        setLoaded(true);
      } catch {}
    });
    const cc = c, ww = wrapperRef.current;
    return () => { try { if (ww?.contains(cc)) ww.removeChild(cc); } catch {} qrRef.current = null; };
  }, [qrText]);

  // Download dengan canvas
  const dl = () => {
    const src = qrRef.current?.querySelector("canvas");
    if (!src) { alert("QR belum siap."); return; }

    const canvasH = 340;
    const ec = document.createElement("canvas");
    ec.width = 280; ec.height = canvasH;
    const ctx = ec.getContext("2d")!;

    // Background
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 280, canvasH);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.strokeRect(1, 1, 278, canvasH - 2);

    // Header bar
    ctx.fillStyle = "#1e3a5f"; ctx.fillRect(0, 0, 280, 52);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
    ctx.font = "bold 13px Arial"; ctx.fillText("E-CheckSheet QA", 140, 22);
    ctx.font = "11px Arial"; ctx.fillText("Final Assembly — Scan & Pilih Area", 140, 40);

    // QR code
    ctx.drawImage(src, 60, 60, 160, 160);

    // Area name
    ctx.fillStyle = "#1e293b"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
    const areaDisplay = area.area_name.length > 28 ? area.area_name.slice(0, 28) + "…" : area.area_name;
    ctx.fillText(areaDisplay, 140, 248);

    // Area code (kecil)
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px monospace";
    ctx.fillText(area.area_code, 140, 264);

    // Info box: "Pilih Conveyor, Pattern & Area setelah scan"
    ctx.fillStyle = "#eff6ff";
    ctx.beginPath();
    ctx.roundRect(16, 274, 248, 44, 8);
    ctx.fill();
    ctx.strokeStyle = "#bfdbfe"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#1e40af"; ctx.font = "bold 10px Arial";
    ctx.fillText("📷 Scan → Pilih Conveyor → Pattern → Spesifik Area", 140, 290);
    ctx.fillStyle = "#3b82f6"; ctx.font = "9px Arial";
    ctx.fillText("Shift " + (shift === "AB" ? "A & B" : shift), 140, 308);

    const fn = `QR_Area_${area.area_name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}_Shift${shift}.png`;
    const a = document.createElement("a");
    a.download = fn; a.href = ec.toDataURL("image/png"); a.click();
  };

  const shiftBadgeColor = shift === "A" ? "#dbeafe" : shift === "B" ? "#f3e5f5" : "#dcfce7";
  const shiftBadgeText  = shift === "A" ? "#1565c0" : shift === "B" ? "#7b1fa2" : "#166534";

  return (
    <div style={{
      background: "#ffffff", borderRadius: 16, padding: 20,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      transition: "all 0.2s",
    }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>#{index + 1}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
          background: shiftBadgeColor, color: shiftBadgeText,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Shift {shift === "AB" ? "A & B" : shift}
        </span>
      </div>

      {/* QR Code */}
      <div style={{
        position: "relative", width: 180, height: 180,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f8fafc", borderRadius: 12, padding: 10,
      }}>
        <div ref={wrapperRef} />
        {!loaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          </div>
        )}
      </div>

      {/* Area info */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
          {area.area_name}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
          {area.area_code}
        </p>
      </div>

      {/* Info badge */}
      <div style={{
        width: "100%", background: "#eff6ff", borderRadius: 8, padding: "8px 10px",
        border: "1px solid #bfdbfe", textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 11, color: "#1e40af", fontWeight: 600 }}>
          📋 QR berisi nama area saja
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#3b82f6" }}>
          Conveyor · Pattern · Spesifik Area dipilih setelah scan
        </p>
      </div>

      {/* QR Text preview */}
      <div style={{
        width: "100%", background: "#1e293b", borderRadius: 8, padding: "8px 10px",
        fontSize: 12, color: "#67e8f9", fontFamily: "monospace", wordBreak: "break-all",
        textAlign: "center",
      }}>
        {qrText}
      </div>

      {/* Actions */}
      <div style={{ width: "100%", display: "flex", gap: 8 }}>
        <button onClick={dl} style={{
          flex: 1, background: "#2563eb", color: "white", border: "none",
          borderRadius: 8, padding: "10px 0", fontSize: 12, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          ⬇ Download
        </button>
        <button onClick={() => {
          navigator.clipboard?.writeText(qrText).catch(() => {});
          alert("✅ QR text disalin!");
        }} style={{
          flex: 1, background: "#f8fafc", color: "#475569",
          border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 0",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          📋 Salin
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GaugeQRCard, EditGaugeModal, AddGaugeModal, DeleteGaugeModal
// (tidak berubah dari versi sebelumnya — di-include lengkap)
// ─────────────────────────────────────────────────────────────────────────────
function GaugeQRCard({ row, onEdit, onDelete }: { row: GaugeQRRow; onEdit: (r: GaugeQRRow) => void; onDelete: (id: number) => void; }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const isPre = row.area_type === "pre-assy";
  const accent = isPre ? "#4f46e5" : "#0891b2";
  const accentBg = isPre ? "#ede9fe" : "#e0f2fe";
  const accentText = isPre ? "#3730a3" : "#0e7490";

  useEffect(() => {
    if (!wrapperRef.current) return;
    const c = document.createElement("div"); c.style.cssText = "width:140px;height:140px;";
    qrRef.current = c; wrapperRef.current.appendChild(c);
    loadQRScript(() => {
      if (!window.QRCode || !qrRef.current) return;
      try { new window.QRCode(qrRef.current, { text: row.qr_value, width: 140, height: 140, colorDark: "#1e293b", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M }); setLoaded(true); } catch {}
    });
    const cc = c, ww = wrapperRef.current;
    return () => { try { if (ww?.contains(cc)) ww.removeChild(cc); } catch {} qrRef.current = null; };
  }, [row.qr_value]);

  const dl = () => {
    const src = qrRef.current?.querySelector("canvas");
    if (!src) { alert("QR belum siap."); return; }
    const ec = document.createElement("canvas"); ec.width = 280; ec.height = 360;
    const ctx = ec.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 280, 360);
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.strokeRect(1, 1, 278, 358);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 280, 48);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
    ctx.fillText("E-CheckSheet QA — Gauge", 140, 17); ctx.font = "10px Arial";
    ctx.fillText((isPre ? "Pre-Assembly" : "Final Assembly") + " · Daily Check Inspector", 140, 34);
    ctx.drawImage(src, 70, 58, 140, 140);
    ctx.fillStyle = "#1e293b"; ctx.font = "bold 14px Arial";
    ctx.fillText(row.display_name.slice(0, 32), 140, 222);
    ctx.fillStyle = accent; ctx.font = "bold 11px monospace";
    ctx.fillText(row.qr_value, 140, 244);
    ctx.fillStyle = "#64748b"; ctx.font = "8px monospace";
    ctx.fillText(row.gauge_id, 140, 264);
    const a = document.createElement("a"); a.download = `QR_Gauge_${row.gauge_id}.png`; a.href = ec.toDataURL("image/png"); a.click();
  };

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: `2px solid ${accentBg}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: accentBg, color: accentText }}>{row.area_type === "pre-assy" ? "Pre-Assy" : "Final-Assy"}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onEdit(row)} style={{ background: "#f1f5f9", border: "none", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✏️</button>
          <button onClick={() => { if (window.confirm(`Hapus "${row.display_name}"?`)) onDelete(row.id); }} style={{ background: "#fef2f2", border: "none", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🗑️</button>
        </div>
      </div>
      <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 10, padding: 8 }}>
        <div ref={wrapperRef} />
        {!loaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 24, height: 24, border: "3px solid #e2e8f0", borderTopColor: accent, borderRadius: "50%", animation: "spin .8s linear infinite" }} /></div>}
      </div>
      <div style={{ textAlign: "center", width: "100%" }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{row.display_name}</p>
        <code style={{ fontSize: 10, color: accent, background: accentBg, padding: "2px 8px", borderRadius: 4 }}>{row.qr_value}</code>
      </div>
      <div style={{ width: "100%", display: "flex", gap: 6 }}>
        <button onClick={dl} style={{ flex: 1, background: accent, color: "white", border: "none", borderRadius: 7, padding: "9px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⬇ Download</button>
        <button onClick={() => { navigator.clipboard?.writeText(row.qr_value).catch(() => {}); alert("✅ QR Value disalin!"); }} style={{ flex: 1, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 0", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📋 Salin</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Static fallback data
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_CATEGORIES: Category[] = [
  { id: 1, category_name: "Daily Check Group Leader Final Assy", category_code: "final-assy-gl",             table_type: "group-leader", area_type: "final-assy" },
  { id: 2, category_name: "Daily Check Inspector Final Assy",    category_code: "final-assy-inspector",      table_type: "inspector",    area_type: "final-assy" },
  { id: 3, category_name: "Daily Check Group Leader Pre Assy",   category_code: "pre-assy-daily-gl",         table_type: "group-leader", area_type: "pre-assy"   },
  { id: 5, category_name: "Daily Check Inspector Pre Assy",      category_code: "pre-assy-daily-check-ins",  table_type: "inspector",    area_type: "pre-assy"   },
];

const FALLBACK_AREAS: Area[] = [
  { id: 5,  category_id: 2, area_name: "Genba A - Mazda",      area_code: "final-assy-insp-genba-a-mazda",      is_active: true },
  { id: 6,  category_id: 2, area_name: "Genba A - Toyota TRX", area_code: "final-assy-insp-genba-a-toyota-trx", is_active: true },
  { id: 7,  category_id: 2, area_name: "Genba B - Nissan",     area_code: "final-assy-insp-genba-b-nissan",     is_active: true },
  { id: 8,  category_id: 2, area_name: "Genba C - Corola",     area_code: "final-assy-insp-genba-c-corola",     is_active: true },
  { id: 26, category_id: 2, area_name: "Genba C - TNGA",       area_code: "final-assy-insp-genba-c-tnga",       is_active: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function QRGeneratorPage() {
  const router = useRouter();
  const { user, loading: authLoading, isInitialized } = useAuth();

  const [mainTab, setMainTab]           = useState<"area" | "gauge">("area");
  const [gaugeAreaTab, setGaugeAreaTab] = useState<"pre-assy" | "final-assy">("pre-assy");
  const [areaType, setAreaType]         = useState<"pre-assy" | "final-assy">("final-assy");
  const [categories, setCategories]     = useState<Category[]>([]);
  const [areas, setAreas]               = useState<Area[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [areasLoading, setAreasLoading] = useState(false);
  const [apiError, setApiError]         = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(2);
  const [selectedShift, setSelectedShift]   = useState<"A" | "B" | "AB">("A");
  const [searchQuery, setSearchQuery]       = useState("");
  const [isGenerated, setIsGenerated]       = useState(false);

  // Gauge state
  const [gaugeRows, setGaugeRows]         = useState<GaugeQRRow[]>([]);
  const [gaugeLoading, setGaugeLoading]   = useState(false);
  const [gaugeError, setGaugeError]       = useState<string | null>(null);
  const [editingRow, setEditingRow]       = useState<GaugeQRRow | null>(null);
  const [gaugeFilterType, setGaugeFilterType] = useState<number | "all">("all");
  const [gaugeSearch, setGaugeSearch]     = useState("");
  const [gaugeTypes, setGaugeTypes]       = useState<any[]>([]);

  useEffect(() => {
    if (mainTab === "gauge") {
      authFetch(`/api/admin/gauge-types?areaType=${gaugeAreaTab}`).then(r => r.json()).then(d => { if (d.success) setGaugeTypes(d.data); }).catch(console.error);
    }
  }, [mainTab, gaugeAreaTab]);

  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!user) { router.push("/login-page"); return; }
    if (!["admin", "superadmin"].includes(user.role)) router.push("/home");
  }, [user, authLoading, isInitialized, router]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await authFetch(`/api/admin/categories?areaType=${areaType}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        const cats = d.success && d.data?.length ? d.data : FALLBACK_CATEGORIES.filter(c => c.area_type === areaType);
        setCategories(cats);
        if (cats.length > 0) {
          const ic = cats.find((c: Category) => c.table_type === "inspector");
          setSelectedCategoryId(ic?.id ?? cats[0].id);
        }
      } catch {
        const cats = FALLBACK_CATEGORIES.filter(c => c.area_type === areaType);
        setCategories(cats);
        setApiError("API tidak tersedia, menggunakan data bawaan.");
        if (cats.length > 0) {
          const ic = cats.find((c: Category) => c.table_type === "inspector");
          setSelectedCategoryId(ic?.id ?? cats[0].id);
        }
      } finally { setIsLoading(false); }
    };
    load();
  }, [areaType]);

  const loadAreas = useCallback(async (catId: number) => {
    setAreasLoading(true); setIsGenerated(false);
    try {
      const res = await authFetch(`/api/admin/areas?categoryId=${catId}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setAreas(d.success && d.data?.length ? d.data : FALLBACK_AREAS.filter(a => a.category_id === catId));
    } catch {
      setAreas(FALLBACK_AREAS.filter(a => a.category_id === catId));
    } finally { setAreasLoading(false); }
  }, []);

  useEffect(() => { if (!isLoading) loadAreas(selectedCategoryId); }, [selectedCategoryId, isLoading, loadAreas]);

  const loadGauge = useCallback(async (at: "pre-assy" | "final-assy") => {
    setGaugeLoading(true); setGaugeError(null);
    try {
      const res = await authFetch(`/api/admin/gauge-qr-codes?areaType=${at}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setGaugeRows(d.data ?? []);
    } catch {
      setGaugeError("Gagal memuat data gauge QR."); setGaugeRows([]);
    } finally { setGaugeLoading(false); }
  }, []);

  useEffect(() => { if (mainTab === "gauge") loadGauge(gaugeAreaTab); }, [mainTab, gaugeAreaTab, loadGauge]);

  const filteredAreas = areas.filter(a => a.is_active && a.area_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredGauge = gaugeRows.filter(r => {
    const tm = gaugeFilterType === "all" || r.gauge_type_id === gaugeFilterType;
    const sm = gaugeSearch === "" || r.display_name.toLowerCase().includes(gaugeSearch.toLowerCase()) || r.gauge_id.toLowerCase().includes(gaugeSearch.toLowerCase());
    return tm && sm;
  });

  const handleDelete = async (id: number) => {
    const res = await authFetch(`/api/admin/gauge-qr-codes?id=${id}`, { method: "DELETE" });
    if (!res.ok) { alert("Gagal menghapus."); return; }
    setGaugeRows(prev => prev.filter(r => r.id !== id));
  };

  if (authLoading || !isInitialized || isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0f4f8" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#64748b", fontSize: 14 }}>Memuat...</p>
      </div>
    </div>
  );
  if (!user) return null;

  const gColor = gaugeAreaTab === "pre-assy" ? "#4f46e5" : "#0891b2";

  return (
    <div style={{ marginLeft: 80, padding: 24, minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sidebar userName={user.fullName || user.username} />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1e88e5)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, marginBottom: 20, boxShadow: "0 4px 16px rgba(30,136,229,.25)" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "white", width: 40, height: 40, borderRadius: 10, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "white" }}>🔲 Generator QR Code</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.8)" }}>Buat & unduh QR Code untuk area checklist dan alat gauge</p>
        </div>
      </div>

      {apiError && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
          ⚠️ {apiError}
        </div>
      )}

      {/* Main Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "white", padding: 6, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <button onClick={() => setMainTab("area")}  style={{ flex: 1, padding: "11px 16px", border: mainTab === "area"  ? "2px solid #1e88e5" : "2px solid transparent", borderRadius: 9, background: mainTab === "area"  ? "#eff6ff" : "transparent", fontSize: 14, fontWeight: 600, color: mainTab === "area"  ? "#1565c0" : "#64748b", cursor: "pointer" }}>🏭 QR Area Checklist</button>
        <button onClick={() => setMainTab("gauge")} style={{ flex: 1, padding: "11px 16px", border: mainTab === "gauge" ? "2px solid #4f46e5" : "2px solid transparent", borderRadius: 9, background: mainTab === "gauge" ? "#f5f3ff" : "transparent", fontSize: 14, fontWeight: 600, color: mainTab === "gauge" ? "#3730a3" : "#64748b", cursor: "pointer" }}>🔧 QR Gauge / Alat Ukur</button>
      </div>

      {/* ══ TAB AREA ══ */}
      {mainTab === "area" && (
        <>
          {/* Info box: Format QR baru */}
          <div style={{ background: "#eff6ff", border: "2px solid #bfdbfe", borderLeft: "5px solid #1e88e5", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#1e40af" }}>📋 Format QR Code Area (Revisi Terbaru)</p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#1e40af", lineHeight: 1.6 }}>
              QR Code hanya meng-encode <strong>Nama Area</strong> saja.
              Setelah scan, sistem menampilkan card untuk memilih <strong>Conveyor → Pattern → Spesifik Area</strong>.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {["📍 Scan QR (Nama Area)", "→", "🏭 Pilih Conveyor", "→", "🔖 Pilih Pattern", "→", "🔍 Pilih Spesifik Area", "→", "✅ Mulai Checklist"].map((s, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: s === "→" ? 400 : 700, color: s === "→" ? "#64748b" : "#1e40af", background: s === "→" ? "transparent" : "#dbeafe", padding: s === "→" ? 0 : "3px 8px", borderRadius: 20 }}>{s}</span>
              ))}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
            {/* Sub-tab Pre/Final */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["pre-assy", "final-assy"] as const).map(at => (
                <button key={at} onClick={() => { setAreaType(at); setIsGenerated(false); }} style={{ padding: "10px 20px", border: `2px solid ${areaType === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#e2e8f0"}`, borderRadius: 10, background: areaType === at ? (at === "pre-assy" ? "#ede9fe" : "#e0f2fe") : "white", fontSize: 14, fontWeight: 600, color: areaType === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#64748b", cursor: "pointer" }}>
                  {at === "pre-assy" ? "🔵 Pre-Assembly" : "🟦 Final-Assembly"}
                </button>
              ))}
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: "0 0 20px", paddingBottom: 12, borderBottom: "2px solid #f1f5f9" }}>
              ⚙️ Konfigurasi QR Code Area
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
              {/* Tipe Checklist */}
              <div>
                <label style={{ display: "block", fontWeight: 600, color: "#475569", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Tipe Checklist</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", border: selectedCategoryId === cat.id ? "2px solid #1e88e5" : "2px solid #e2e8f0", borderRadius: 10, cursor: "pointer", background: selectedCategoryId === cat.id ? "#eff6ff" : "#f8fafc", fontSize: 14, color: selectedCategoryId === cat.id ? "#1565c0" : "#475569", fontWeight: selectedCategoryId === cat.id ? 600 : 400 }}>
                      <span>{cat.table_type === "inspector" ? "🔍" : "👔"}</span>
                      <span>{cat.category_name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shift */}
              <div>
                <label style={{ display: "block", fontWeight: 600, color: "#475569", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Shift (untuk label pada QR)</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["A", "B", "AB"] as const).map(s => {
                    const isActive = selectedShift === s;
                    const bg = s === "A" ? "#dbeafe" : s === "B" ? "#f3e5f5" : "#dcfce7";
                    const tc = s === "A" ? "#1565c0" : s === "B" ? "#7b1fa2" : "#166534";
                    return <button key={s} onClick={() => { setSelectedShift(s); setIsGenerated(false); }} style={{ flex: 1, padding: 12, border: `2px solid ${isActive ? (s === "A" ? "#1e88e5" : s === "B" ? "#9c27b0" : "#43a047") : "#e2e8f0"}`, borderRadius: 10, cursor: "pointer", background: isActive ? bg : "#f8fafc", fontWeight: 600, fontSize: 14, color: isActive ? tc : "#475569" }}>
                      {s === "AB" ? "A & B" : `Shift ${s}`}
                    </button>;
                  })}
                </div>
              </div>

              {/* Filter Area */}
              <div>
                <label style={{ display: "block", fontWeight: 600, color: "#475569", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Filter Area ({areasLoading ? "..." : filteredAreas.length + " aktif"})
                </label>
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input type="text" placeholder="Cari nama area..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setIsGenerated(false); }} style={{ width: "100%", padding: "12px 12px 12px 40px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>

            {/* Area preview chips */}
            <div style={{ border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "14px 16px", marginBottom: 20, background: "#f8fafc" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".04em" }}>Area yang akan di-generate:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {areasLoading
                  ? <span style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>Memuat...</span>
                  : filteredAreas.length === 0
                  ? <span style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>Tidak ada area</span>
                  : filteredAreas.map(a => (
                      <span key={a.id} style={{ background: "#dbeafe", color: "#1e40af", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                        {a.area_name}
                      </span>
                    ))}
              </div>
            </div>

            <div>
              {isGenerated ? (
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <button onClick={() => setIsGenerated(false)} style={{ padding: "10px 20px", background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: 10, color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>← Ubah</button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>✅ {filteredAreas.length} QR berhasil dibuat</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsGenerated(true)}
                  disabled={filteredAreas.length === 0 || areasLoading}
                  style={{ padding: "14px 28px", background: "linear-gradient(135deg, #1e88e5, #1565c0)", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(30,136,229,.3)", opacity: (filteredAreas.length === 0 || areasLoading) ? 0.5 : 1 }}
                >
                  🔲 Generate {filteredAreas.length} QR Code
                </button>
              )}
            </div>
          </div>

          {/* QR Grid */}
          {isGenerated && filteredAreas.length > 0 && (
            <div id="qr-grid" style={{ marginBottom: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>QR Code Area Siap Download</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                  Setiap QR berisi <strong>Nama Area</strong> saja. Total: <strong>{filteredAreas.length}</strong> QR Code.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                {filteredAreas.map((area, i) => (
                  <AreaQRCard key={area.id} area={area} shift={selectedShift} index={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TAB GAUGE ══ */}
      {mainTab === "gauge" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["pre-assy", "final-assy"] as const).map(at => (
              <button key={at} onClick={() => { setGaugeAreaTab(at); setGaugeFilterType("all"); }} style={{ padding: "10px 20px", border: `2px solid ${gaugeAreaTab === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#e2e8f0"}`, borderRadius: 10, background: gaugeAreaTab === at ? (at === "pre-assy" ? "#ede9fe" : "#e0f2fe") : "white", fontSize: 14, fontWeight: 600, color: gaugeAreaTab === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#64748b", cursor: "pointer" }}>
                {at === "pre-assy" ? "🔵 Pre-Assembly" : "🟦 Final-Assembly"}
              </button>
            ))}
          </div>
          <div style={{ background: "white", borderLeft: `4px solid ${gColor}`, borderRadius: 8, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#1e293b", lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <p style={{ margin: 0 }}><strong>Format QR Value:</strong> <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>DCI-&#123;itemId&#125;-&#123;gaugeId&#125;</code></p>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input type="text" placeholder="Cari gauge..." value={gaugeSearch} onChange={e => setGaugeSearch(e.target.value)} style={{ padding: "10px 10px 10px 36px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 13, outline: "none", maxWidth: 220 }} />
              </div>
              <select value={gaugeFilterType} onChange={e => setGaugeFilterType(e.target.value === "all" ? "all" : parseInt(e.target.value))} style={{ padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#1e293b", outline: "none", background: "white", cursor: "pointer" }}>
                <option value="all">Semua Tipe</option>
                {getGaugeList(gaugeAreaTab).map(t => <option key={t.dciItemId} value={t.dciItemId}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {gaugeError && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>⚠️ {gaugeError}</div>}
          {gaugeLoading
            ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: 48, background: "white", borderRadius: 12 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: gColor, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Memuat...</p>
              </div>
            : filteredGauge.length === 0
            ? <div style={{ background: "white", borderRadius: 12, padding: 48, textAlign: "center", color: "#64748b" }}>
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>🔧 Belum ada data gauge QR</p>
              </div>
            : <>
                <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginBottom: 12 }}>{filteredGauge.length} QR Code gauge</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
                  {filteredGauge.map(row => <GaugeQRCard key={row.id} row={row} onEdit={setEditingRow} onDelete={handleDelete} />)}
                </div>
              </>}
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}