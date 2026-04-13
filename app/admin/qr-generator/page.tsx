// app/admin/qr-generator/page.tsx
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
      options.headers = { "Content-Type": "application/json", ...options.headers, "x-user-id": String(u.id || ""), "x-user-role": String(u.role || ""), "x-username": String(u.username || "") };
    }
  } catch {}
  return fetch(url, options);
}

interface Area { id: number; category_id: number; area_name: string; area_code: string; is_active: boolean; }
interface Category { id: number; category_name: string; category_code: string; table_type: string; area_type: string; }
interface QRConfig { areaCode: string; areaName: string; shift: "A" | "B" | "AB"; categoryCode: string; checklistType: "inspector" | "group-leader"; }
interface GaugeQRRow { id: number; gauge_type_id: number; gauge_type_slug: string; gauge_type_name: string; area_type: "pre-assy" | "final-assy"; gauge_id: string; qr_value: string; display_name: string; seq_number: number; notes: string | null; is_active: boolean; }

declare global { interface Window { QRCode: any; _qrcodeScriptLoading?: boolean; _qrcodeScriptLoaded?: boolean; } }

const PA_GAUGE_TYPE_LIST = [
  { dciItemId: 2, slug: "micrometer", name: "MICROMETER", abbrev: "MCR" },
  { dciItemId: 3, slug: "caliper", name: "CALIPER", abbrev: "CAL" },
  { dciItemId: 4, slug: "tensile", name: "MESIN TENSILE", abbrev: "TNS" },
  { dciItemId: 5, slug: "steel-ruler", name: "STEEL RULER", abbrev: "STR" },
  { dciItemId: 6, slug: "bent-gauge", name: "BENT UP/DOWN GAUGE", abbrev: "BNG" },
  { dciItemId: 7, slug: "thickness-gauge", name: "THICKNESS GAUGE / GO NO GO", abbrev: "THG" },
  { dciItemId: 8, slug: "pocket-comparator", name: "POCKET COMPARATOR", abbrev: "PKC" },
  { dciItemId: 9, slug: "crimping-standard", name: "CRIMPING STANDARD & IS", abbrev: "CRS" },
];

const FA_GAUGE_TYPE_LIST = [
  { dciItemId: 1, slug: "pipo", name: "PIPO", abbrev: "PPO" },
  { dciItemId: 2, slug: "roll-meter", name: "ROLL METER / MISTAR BAJA", abbrev: "RMT" },
  { dciItemId: 3, slug: "go-no-go", name: "GO NO GO", abbrev: "GNG" },
  { dciItemId: 4, slug: "push-gauge-rb", name: "PUSH GAUGE RB", abbrev: "PGR" },
  { dciItemId: 5, slug: "dummy-sample", name: "DUMMY SAMPLE OK & N-OK", abbrev: "DMS" },
  { dciItemId: 6, slug: "inspection-point", name: "IMPORTANT / INSPECTION POINT", abbrev: "INP" },
  { dciItemId: 7, slug: "fuse-plate", name: "FUSE PLATE", abbrev: "FSP" },
  { dciItemId: 8, slug: "lampu-navigasi", name: "LAMPU NAVIGASI", abbrev: "LMN" },
  { dciItemId: 9, slug: "tape-navigasi", name: "TAPE NAVIGASI", abbrev: "TPN" },
  { dciItemId: 10, slug: "inspection-board", name: "INSPECTION BOARD", abbrev: "ISB" },
  { dciItemId: 11, slug: "dry-surf", name: "DRY SURF", abbrev: "DRS" },
  { dciItemId: 12, slug: "packing", name: "PACKING", abbrev: "PKG" },
];

function getGaugeList(areaType: "pre-assy" | "final-assy") { return areaType === "pre-assy" ? PA_GAUGE_TYPE_LIST : FA_GAUGE_TYPE_LIST; }
function buildDefaultGaugeId(areaType: "pre-assy" | "final-assy", slug: string, seq: number): string { const ac = areaType === "pre-assy" ? "PA" : "FA"; const ab = getGaugeList(areaType).find(t => t.slug === slug)?.abbrev ?? slug.slice(0, 3).toUpperCase(); return `GAUGE-${ac}-${ab}-${String(seq).padStart(3, "0")}`; }
function buildQrValue(dciItemId: number, gaugeId: string): string { return `DCI-${dciItemId}-${gaugeId}`; }

function loadQRScript(cb: () => void) {
  if (window._qrcodeScriptLoaded) { cb(); return; }
  if (window._qrcodeScriptLoading) { const p = setInterval(() => { if (window._qrcodeScriptLoaded) { clearInterval(p); cb(); } }, 80); return; }
  window._qrcodeScriptLoading = true;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  s.onload = () => { window._qrcodeScriptLoaded = true; window._qrcodeScriptLoading = false; cb(); };
  s.onerror = () => { window._qrcodeScriptLoading = false; };
  document.head.appendChild(s);
}

// ──────────────────────────────────────────────────────────────────────────────
// Area QR Card — REDESIGNED sesuai gambar kedua
// ──────────────────────────────────────────────────────────────────────────────
function generateQRPath(config: QRConfig): string {
  const sp = config.shift === "AB" ? "A" : config.shift;
  return `/checksheet-final-assy?areaCode=${encodeURIComponent(config.areaCode)}&areaName=${encodeURIComponent(config.areaName)}&shift=${sp}`;
}

function AreaQRCard({ config, index }: { config: QRConfig; index: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [qrPath] = useState(() => generateQRPath(config));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const c = document.createElement("div"); c.style.cssText = "width:160px;height:160px;";
    qrRef.current = c; wrapperRef.current.appendChild(c);
    loadQRScript(() => {
      if (!window.QRCode || !qrRef.current) return;
      try { new window.QRCode(qrRef.current, { text: qrPath, width: 160, height: 160, colorDark: "#1e293b", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M }); setLoaded(true); } catch {}
    });
    const cc = c, ww = wrapperRef.current;
    return () => { try { if (ww?.contains(cc)) ww.removeChild(cc); } catch {} qrRef.current = null; };
  }, [qrPath]);

  const dl = () => {
    const src = qrRef.current?.querySelector("canvas"); if (!src) { alert("QR belum siap."); return; }
    const ec = document.createElement("canvas"); ec.width = 300; ec.height = 360; const ctx = ec.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 300, 360); ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.strokeRect(1, 1, 298, 358);
    ctx.fillStyle = "#1e3a5f"; ctx.fillRect(0, 0, 300, 52); ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
    ctx.fillText("E-CheckSheet QA", 150, 22); ctx.font = "11px Arial";
    ctx.fillText("Final Assembly - " + (config.checklistType === "inspector" ? "Inspector" : "Group Leader"), 150, 40);
    ctx.drawImage(src, 60, 62, 180, 180); ctx.fillStyle = "#1e293b"; ctx.font = "bold 13px Arial";
    const dn = config.areaName.length > 24 ? config.areaName.slice(0, 24) + "..." : config.areaName; ctx.fillText(dn, 150, 264);
    const sc = config.shift === "A" ? "#1e88e5" : config.shift === "B" ? "#9c27b0" : "#43a047";
    const [bx, by, bw, bh, br] = [100, 274, 100, 26, 13]; ctx.fillStyle = sc; ctx.beginPath();
    ctx.moveTo(bx + br, by); ctx.lineTo(bx + bw - br, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br); ctx.quadraticCurveTo(bx, by, bx + br, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px Arial";
    ctx.fillText(config.shift === "AB" ? "Shift A & B" : `Shift ${config.shift}`, 150, 291);
    const sp2 = qrPath.length > 48 ? qrPath.slice(0, 48) + "..." : qrPath; ctx.fillStyle = "#94a3b8"; ctx.font = "8px monospace";
    ctx.fillText(sp2, 150, 342);
    const a = document.createElement("a"); a.download = `QR_${config.areaCode}_Shift${config.shift}.png`; a.href = ec.toDataURL("image/png"); a.click();
  };

  const shiftBadgeColor = config.shift === "A" ? "#dbeafe" : config.shift === "B" ? "#f3e5f5" : "#dcfce7";
  const shiftBadgeText = config.shift === "A" ? "#1565c0" : config.shift === "B" ? "#7b1fa2" : "#166534";

  return (
    <div style={{ background: "#ffffff", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.2s" }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>#{index + 1}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: shiftBadgeColor, color: shiftBadgeText, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Shift {config.shift === "AB" ? "A & B" : config.shift}
        </span>
      </div>

      {/* QR Code */}
      <div style={{ position: "relative", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 12, padding: 10 }}>
        <div ref={wrapperRef} />
        {!loaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite" }} /></div>}
      </div>

      {/* Area Info */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>{config.areaName}</p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{config.areaCode}</p>
      </div>

      {/* Path Box */}
      <div style={{ width: "100%", background: "#f1f5f9", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "#475569", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5, maxHeight: 48, overflow: "hidden" }}>
        {qrPath}
      </div>

      {/* Actions */}
      <div style={{ width: "100%", display: "flex", gap: 8 }}>
        <button onClick={dl} style={{ flex: 1, background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          ⬇ Download
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(qrPath).catch(() => {}); alert("✅ Path disalin!"); }} style={{ flex: 1, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📋 Salin
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Gauge QR Card — REDESIGNED
// ──────────────────────────────────────────────────────────────────────────────
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

    // ─── Helper: Auto-wrap text di Canvas ──────────────────────────────────
    const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(' ');
      let line = '';
      const lines = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
      lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
      return lines.length * lineHeight; // Return total tinggi yang dipakai
    };
    // ──────────────────────────────────────────────────────────────────────

    const ec = document.createElement("canvas");
    ec.width = 280;
    ec.height = 380; // Dinaikkan agar aman untuk 2-3 baris teks
    const ctx = ec.getContext("2d")!;
    
    // Background & Border
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 280, 380);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, 278, 378);

    // Header
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 280, 48);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("E-CheckSheet QA — Gauge", 140, 17);
    ctx.font = "10px Arial";
    ctx.fillText((isPre ? "Pre-Assembly" : "Final Assembly") + " · Daily Check Inspector", 140, 34);

    // QR Code
    ctx.drawImage(src, 60, 56, 160, 160);

    // ─── Display Name (Auto-Wrap) ─────────────────────────────────────────
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 40px Cambria";
    ctx.textAlign = "center";
    
    const nameMaxWidth = 250;      // Lebar maksimal sebelum turun baris
    const nameLineHeight = 35;     // Jarak antar baris
    const nameStartY = 255;        // Posisi Y awal nama
    const usedNameHeight = wrapText(ctx, row.display_name, 140, nameStartY, nameMaxWidth, nameLineHeight);
    // ──────────────────────────────────────────────────────────────────────

    // ─── Gauge ID Box (Posisi dinamis) ────────────────────────────────────
    const boxY = nameStartY + usedNameHeight - 15; // Geser ke bawah sesuai tinggi teks
    const [bx, by, bw, bh, br] = [50, boxY, 180, 24, 12];
    
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(bx + br, by); ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br); ctx.quadraticCurveTo(bx, by, bx + br, by); 
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px monospace";
    ctx.fillText(row.gauge_id, 140, boxY + 16);
    // ──────────────────────────────────────────────────────────────────────

    // // ─── QR Value ─────────────────────────────────────────────────────────
    // const qvY = boxY + bh + 9;
    // const qv = row.qr_value.length > 42 ? row.qr_value.slice(0, 42) + "..." : row.qr_value;
    // ctx.fillStyle = "#94a3b8";
    // ctx.font = "8px monospace";
    // ctx.fillText(qv, 140, qvY);
    // // ──────────────────────────────────────────────────────────────────────

    const a = document.createElement("a");
    a.download = `QR_${row.gauge_id}.png`;
    a.href = ec.toDataURL("image/png");
    a.click();
  };

  return (
    <div style={{ background: "#ffffff", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.2s" }}>
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.04em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.gauge_type_name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: accentBg, color: accentText, whiteSpace: "nowrap" }}>{isPre ? "Pre-Assy" : "Final-Assy"}</span>
      </div>

      <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 12, padding: 10, border: `2px solid ${accent}20` }}>
        <div ref={wrapperRef} />
        {!loaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 24, height: 24, border: "3px solid #e2e8f0", borderTopColor: accent, borderRadius: "50%", animation: "spin .8s linear infinite" }} /></div>}
      </div>

      <div style={{ textAlign: "center", width: "100%" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>{row.display_name}</p>
        <code style={{ display: "inline-block", fontSize: 11, fontFamily: "monospace", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: accentBg, color: accentText, letterSpacing: "0.04em", marginTop: 4 }}>{row.gauge_id}</code>
      </div>

      <div style={{ width: "100%", display: "flex", gap: 6 }}>
        <button onClick={dl} style={{ flex: 2, background: accent, color: "white", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ Download</button>
        <button onClick={() => onEdit(row)} style={{ flex: 1.5, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✏ Edit</button>
        <button onClick={() => { if (window.confirm(`Hapus "${row.gauge_id}"?`)) onDelete(row.id); }} style={{ flex: "0 0 32px", background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>🗑</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Edit Modal
// ──────────────────────────────────────────────────────────────────────────────
function EditGaugeModal({ row, onSave, onClose }: { row: GaugeQRRow; onSave: (id: number, gaugeId: string, displayName: string, notes: string) => Promise<void>; onClose: () => void; }) {
  const [gaugeId, setGaugeId] = useState(row.gauge_id);
  const [displayName, setDisplayName] = useState(row.display_name);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const qrPreview = buildQrValue(row.gauge_type_id, gaugeId);
  const aColor = row.area_type === "pre-assy" ? "#4f46e5" : "#0891b2";

  const save = async () => {
    if (!gaugeId.trim()) { setErr("Gauge ID tidak boleh kosong."); return; }
    setSaving(true); setErr("");
    try { await onSave(row.id, gaugeId.trim().toUpperCase(), displayName.trim(), notes.trim()); onClose(); }
    catch (e: any) { setErr(e.message ?? "Gagal menyimpan."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 8px 40px rgba(0,0,0,.2)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: aColor, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "white" }}>✏️ Edit Gauge QR</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "white", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 5px" }}>Tipe Gauge</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0, background: "#f8fafc", padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0" }}>{row.gauge_type_name} — {row.area_type === "pre-assy" ? "Pre-Assembly" : "Final-Assembly"}</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 5px" }}>Gauge ID</p>
          <input value={gaugeId} onChange={e => setGaugeId(e.target.value.toUpperCase().replace(/\s+/g, ""))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
          <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>QR Value: <code style={{ background: "#ede9fe", color: "#3730a3", padding: "2px 6px", borderRadius: 4 }}>{qrPreview}</code></p>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 5px" }}>Display Name</p>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 5px" }}>Catatan <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>(opsional)</span></p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Lokasi, nomor register, dll." style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          {err && <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, margin: 0, background: "#fef2f2", padding: "8px 12px", borderRadius: 7 }}>⚠ {err}</p>}
          <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} disabled={saving} style={{ padding: "9px 20px", background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>Batal</button>
            <button onClick={save} disabled={saving} style={{ padding: "9px 24px", background: aColor, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? .6 : 1 }}>{saving ? "Menyimpan..." : "💾 Simpan"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Add Modal
// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// Add Modal — FIXED: gauge_type_id sebagai identifier
// ──────────────────────────────────────────────────────────────────────────────
function AddGaugeModal({
  areaType,
  existingRows,
  onSave,
  onClose
}: {
  areaType: "pre-assy" | "final-assy";
  existingRows: GaugeQRRow[];
  onSave: (row: any) => Promise<void>;
  onClose: () => void;
}) {
  const [gaugeTypes, setGaugeTypes] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | "new">(-1);
  const [newTypeName, setNewTypeName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const aColor = areaType === "pre-assy" ? "#4f46e5" : "#0891b2";

  // Helper: Generate slug dari nama (lowercase, spasi jadi hyphen)
  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  // Helper: Generate abbrev dari nama (4 huruf pertama, uppercase, tanpa spasi)
  const generateAbbrev = (name: string) => {
    return name.replace(/\s+/g, "").slice(0, 4).toUpperCase();
  };

  // Fetch gauge types dari database via API
  useEffect(() => {
    const fetchGaugeTypes = async () => {
      try {
        const res = await authFetch(`/api/admin/gauge-types?areaType=${areaType}`);
        const data = await res.json();
        if (data.success) {
          setGaugeTypes(data.data);
          if (data.data.length > 0) {
            // ✅ PERBAIKAN: Gunakan gauge_type_id, bukan id
            setSelectedTypeId(data.data[0].gauge_type_id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch gauge types:", error);
      }
    };
    fetchGaugeTypes();
  }, [areaType]);

  // Cari selected type dari list menggunakan gauge_type_id
  const selectedType = gaugeTypes.find((t) => t.gauge_type_id === selectedTypeId);

  // Hitung sequence number untuk gauge type ini
  const calcSeq = (gaugeTypeId: number) =>
    existingRows.filter(
      (r) => r.gauge_type_id === gaugeTypeId && r.area_type === areaType
    ).length + 1;

  const seq = selectedType ? calcSeq(selectedType.gauge_type_id) : 1;

  // State untuk Gauge ID dan Display Name
  const [gaugeId, setGaugeId] = useState(() => {
    if (!selectedType) return "";
    const ac = areaType === "pre-assy" ? "PA" : "FA";
    // ✅ Generate abbrev dari gauge_type_name karena tidak ada di database
    const abbrev = generateAbbrev(selectedType.gauge_type_name);
    return `GAUGE-${ac}-${abbrev}-${String(seq).padStart(3, "0")}`;
  });

  const [displayName, setDisplayName] = useState(() => {
    if (!selectedType) return "";
    return `${selectedType.gauge_type_name} ${areaType === "pre-assy" ? "PA" : "FA"} #${seq}`;
  });

  const [notes, setNotes] = useState("");

  // Update gaugeId dan displayName saat type atau seq berubah
  useEffect(() => {
    if (selectedType) {
      const s = calcSeq(selectedType.gauge_type_id);
      const ac = areaType === "pre-assy" ? "PA" : "FA";
      const abbrev = generateAbbrev(selectedType.gauge_type_name);
      setGaugeId(`GAUGE-${ac}-${abbrev}-${String(s).padStart(3, "0")}`);
      setDisplayName(
        `${selectedType.gauge_type_name} ${areaType === "pre-assy" ? "PA" : "FA"} #${s}`
      );
    }
  }, [selectedType, areaType]);

  const qrPreview = selectedType
    ? `DCI-${selectedType.gauge_type_id}-${gaugeId}`
    : "";

  // Handler: Buat gauge type baru via API
  const handleCreateNewType = async () => {
    if (!newTypeName.trim()) {
      setErr("Nama tipe gauge wajib diisi");
      return;
    }
    setSaving(true);
    setErr("");

    try {
      const res = await authFetch("/api/admin/gauge-types", {
        method: "POST",
        body: JSON.stringify({
          gaugeTypeName: newTypeName.trim(),
          areaType: areaType
          // slug, abbrev, gauge_type_id akan auto-generated di backend
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Refresh gauge types dari database
        const res2 = await authFetch(
          `/api/admin/gauge-types?areaType=${areaType}`
        );
        const data2 = await res2.json();
        if (data2.success) {
          setGaugeTypes(data2.data);
          // ✅ PERBAIKAN: Gunakan gauge_type_id untuk setSelectedTypeId
          const newType = data2.data.find(
            (t: any) => t.gauge_type_slug === data.data.gauge_type_slug
          );
          if (newType) {
            setSelectedTypeId(newType.gauge_type_id);
          }
          setNewTypeName("");
        }
      } else {
        setErr(data.error || "Gagal membuat gauge type baru");
      }
    } catch (e: any) {
      setErr(e.message ?? "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  // Handler: Simpan gauge QR dengan tipe yang sudah ada
  const handleSaveExistingType = async () => {
    if (!selectedType) {
      setErr("Pilih tipe gauge terlebih dahulu");
      return;
    }
    if (!gaugeId.trim()) {
      setErr("Gauge ID tidak boleh kosong");
      return;
    }
    setSaving(true);
    setErr("");

    try {
      await onSave({
        gauge_type_id: selectedType.gauge_type_id,
        gauge_type_slug: selectedType.gauge_type_slug,
        gauge_type_name: selectedType.gauge_type_name,
        area_type: areaType,
        gauge_id: gaugeId.trim().toUpperCase(),
        qr_value: `DCI-${selectedType.gauge_type_id}-${gaugeId.trim().toUpperCase()}`,
        display_name: displayName.trim() || gaugeId.trim().toUpperCase(),
        seq_number: seq,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 8px 40px rgba(0,0,0,.2)",
          overflow: "hidden",
          marginTop: "auto",
          marginBottom: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: aColor,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
            ➕ Tambah Gauge QR —{" "}
            {areaType === "pre-assy" ? "Pre-Assembly" : "Final-Assembly"}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.15)",
              border: "none",
              color: "white",
              width: 28,
              height: 28,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* SECTION: TIPE GAUGE */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: ".04em",
                margin: "0 0 10px",
              }}
            >
              Tipe Gauge / Item Check
            </p>

            {/* List gauge types dari database */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {gaugeTypes.map((t) => (
                <button
                  key={t.gauge_type_id} // ✅ PERBAIKAN: Gunakan gauge_type_id
                  onClick={() => {
                    setSelectedTypeId(t.gauge_type_id); // ✅ PERBAIKAN
                    setNewTypeName("");
                  }}
                  style={{
                    padding: "6px 10px",
                    border: `1.5px solid ${
                      selectedTypeId === t.gauge_type_id ? aColor : "#e2e8f0"
                    }`, // ✅ PERBAIKAN
                    borderRadius: 7,
                    background:
                      selectedTypeId === t.gauge_type_id
                        ? areaType === "pre-assy"
                          ? "#ede9fe"
                          : "#e0f2fe"
                        : "#f8fafc",
                    fontSize: 11,
                    fontWeight: selectedTypeId === t.gauge_type_id ? 700 : 500, // ✅ PERBAIKAN
                    cursor: "pointer",
                    color: selectedTypeId === t.gauge_type_id ? aColor : "#475569", // ✅ PERBAIKAN
                    transition: "all .12s",
                  }}
                >
                  {t.gauge_type_name}
                </button>
              ))}
            </div>

            {/* Tombol tambah tipe baru */}
            <button
              onClick={() => setSelectedTypeId("new")}
              style={{
                width: "100%",
                padding: "10px",
                border: `2px dashed ${
                  selectedTypeId === "new" ? aColor : "#cbd5e1"
                }`,
                borderRadius: 8,
                background:
                  selectedTypeId === "new"
                    ? areaType === "pre-assy"
                      ? "#ede9fe"
                      : "#e0f2fe"
                    : "#f8fafc",
                fontSize: 12,
                fontWeight: 600,
                color: selectedTypeId === "new" ? aColor : "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              ➕ Tambah Tipe Gauge Baru
            </button>

            {/* Form untuk tipe baru */}
            {selectedTypeId === "new" && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "#f8fafc",
                  border: `1px solid ${aColor}40`,
                  borderRadius: 8,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: aColor,
                    margin: "0 0 8px",
                  }}
                >
                  📝 Definisi Tipe Gauge Baru
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Contoh: DIAL GAUGE atau push gauge"
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                    💡 Slug akan otomatis:{" "}
                    <strong>
                      {newTypeName
                        ? generateSlug(newTypeName)
                        : "contoh-slug"}
                    </strong>
                    <br />
                    💡 Nama akan otomatis UPPERCASE:{" "}
                    <strong>
                      {newTypeName ? newTypeName.toUpperCase() : "CONTOH NAMA"}
                    </strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: GAUGE ID */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: ".04em",
                margin: "0 0 5px",
              }}
            >
              Gauge ID <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>(bisa diedit)</span>
            </p>
            <input
              value={gaugeId}
              onChange={(e) =>
                setGaugeId(e.target.value.toUpperCase().replace(/\s+/g, ""))
              }
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "monospace",
                fontWeight: 600,
                color: "#1e293b",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>
              QR Value:{" "}
              <code
                style={{
                  background: "#ede9fe",
                  color: "#3730a3",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                {qrPreview}
              </code>
            </p>
          </div>

          {/* SECTION: DISPLAY NAME */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: ".04em",
                margin: "0 0 5px",
              }}
            >
              Display Name
            </p>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                color: "#1e293b",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* SECTION: CATATAN */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: ".04em",
                margin: "0 0 5px",
              }}
            >
              Catatan <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>(opsional)</span>
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Lokasi fisik, nomor register, dll."
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {err && (
            <p
              style={{
                fontSize: 12,
                color: "#dc2626",
                fontWeight: 600,
                margin: 0,
                background: "#fef2f2",
                padding: "8px 12px",
                borderRadius: 7,
              }}
            >
              ⚠ {err}
            </p>
          )}

          {/* FOOTER ACTIONS */}
          <div
            style={{
              padding: "16px 20px 0",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "9px 20px",
                background: "#f1f5f9",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              Batal
            </button>
            <button
              onClick={
                selectedTypeId === "new" ? handleCreateNewType : handleSaveExistingType
              }
              disabled={saving}
              style={{
                padding: "9px 24px",
                background: aColor,
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Menyimpan..." : "➕ Tambah"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delete Gauge Modal
function DeleteGaugeModal({ areaType, gaugeTypes, onClose, onSuccess }: { 
  areaType: "pre-assy" | "final-assy"; 
  gaugeTypes: any[]; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [selectedGaugeType, setSelectedGaugeType] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const aColor = areaType === "pre-assy" ? "#4f46e5" : "#0891b2";

  const handleDelete = async () => {
    if (!selectedGaugeType) {
      setErr("Pilih tipe gauge yang akan dihapus");
      return;
    }

    setDeleting(true);
    setErr("");

    try {
      const res = await authFetch(
        `/api/admin/gauge-types?gaugeTypeSlug=${encodeURIComponent(selectedGaugeType)}&areaType=${areaType}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErr(data.error || "Gagal menghapus gauge type");
      }
    } catch (e: any) {
      setErr(e.message ?? "Gagal menghapus.");
    } finally {
      setDeleting(false);
    }
  };

  const selectedTypeInfo = gaugeTypes.find(t => t.gauge_type_slug === selectedGaugeType);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,.2)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#dc2626", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "white" }}>🗑️ Hapus Gauge Type</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "white", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕</button>
        </div>
        
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 13, color: "#991b1b", margin: 0, fontWeight: 600 }}>⚠️ Peringatan</p>
            <p style={{ fontSize: 12, color: "#7f1d1d", margin: "4px 0 0" }}>
              Tindakan ini akan menghapus tipe gauge secara permanen dan tidak dapat dikembalikan. Pastikan tidak ada gauge QR yang menggunakan tipe ini.
            </p>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 8px" }}>Pilih Tipe Gauge yang Akan Dihapus</p>
            <select 
              value={selectedGaugeType} 
              onChange={e => setSelectedGaugeType(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1e293b", outline: "none", boxSizing: "border-box" }}
            >
              <option value="">-- Pilih Tipe Gauge --</option>
              {gaugeTypes.map(t => (
                <option key={t.gauge_type_slug} value={t.gauge_type_slug}>
                  {t.gauge_type_name} ({t.gauge_type_slug})
                </option>
              ))}
            </select>
          </div>

          {selectedTypeInfo && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 8px" }}>Detail Tipe Gauge:</p>
              <div style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 4 }}>
                <span><strong>Nama:</strong> {selectedTypeInfo.gauge_type_name}</span>
                <span><strong>Slug:</strong> {selectedTypeInfo.gauge_type_slug}</span>
                <span><strong>Area:</strong> {selectedTypeInfo.area_type === "pre-assy" ? "Pre-Assembly" : "Final-Assembly"}</span>
              </div>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, margin: 0, background: "#fef2f2", padding: "8px 12px", borderRadius: 7 }}>⚠ {err}</p>}

          <div style={{ padding: "16px 20px 0", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} disabled={deleting} style={{ padding: "9px 20px", background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>Batal</button>
            <button 
              onClick={handleDelete} 
              disabled={deleting || !selectedGaugeType} 
              style={{ 
                padding: "9px 24px", 
                background: "#dc2626", 
                color: "white", 
                border: "none", 
                borderRadius: 8, 
                fontSize: 13, 
                fontWeight: 700, 
                cursor: deleting || !selectedGaugeType ? "not-allowed" : "pointer",
                opacity: deleting || !selectedGaugeType ? 0.6 : 1
              }}
            >
              {deleting ? "Menghapus..." : "🗑️ Hapus Permanen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: 1, category_name: "Daily Check Group Leader Final Assy", category_code: "final-assy-gl", table_type: "group-leader", area_type: "final-assy" },
  { id: 2, category_name: "Daily Check Inspector Final Assy", category_code: "final-assy-inspector", table_type: "inspector", area_type: "final-assy" },
  { id: 3, category_name: "Daily Check Group Leader Pre Assy", category_code: "pre-assy-daily-gl", table_type: "group-leader", area_type: "pre-assy" },
  { id: 5, category_name: "Daily Check Inspector Pre Assy", category_code: "pre-assy-daily-check-ins", table_type: "inspector", area_type: "pre-assy" },
];

const FALLBACK_AREAS: Area[] = [
  { id: 5, category_id: 2, area_name: "Genba A - Mazda", area_code: "final-assy-insp-genba-a-mazda", is_active: true },
  { id: 6, category_id: 2, area_name: "Genba A - Toyota TRX", area_code: "final-assy-insp-genba-a-toyota-trx", is_active: true },
  { id: 7, category_id: 2, area_name: "Genba B - Nissan", area_code: "final-assy-insp-genba-b-nissan", is_active: true },
  { id: 8, category_id: 2, area_name: "Genba C - Corola", area_code: "final-assy-insp-genba-c-corola", is_active: true },
  { id: 26, category_id: 2, area_name: "Genba C - TNGA", area_code: "final-assy-insp-genba-c-tnga", is_active: true },
  { id: 38, category_id: 5, area_name: "Genba A - Mazda", area_code: "pre-assy-ins-genba-a-mazda", is_active: true },
  { id: 39, category_id: 5, area_name: "Genba A - Toyota TRX", area_code: "pre-assy-ins-genba-a-toyota-trx", is_active: true },
  { id: 40, category_id: 5, area_name: "Genba B - Nissan", area_code: "pre-assy-ins-genba-b-nissan", is_active: true },
  { id: 41, category_id: 5, area_name: "Genba C - Corola", area_code: "pre-assy-ins-genba-c-corola", is_active: true },
  { id: 42, category_id: 5, area_name: "Genba C - TNGA", area_code: "pre-assy-ins-genba-c-tnga", is_active: true },
];

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────
export default function QRGeneratorPage() {
  const router = useRouter();
  const { user, loading: authLoading, isInitialized } = useAuth();
  const [mainTab, setMainTab] = useState<"area" | "gauge">("area");
  const [gaugeAreaTab, setGaugeAreaTab] = useState<"pre-assy" | "final-assy">("pre-assy");
  const [areaType, setAreaType] = useState<"pre-assy" | "final-assy">("final-assy");
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(2);
  const [selectedShift, setSelectedShift] = useState<"A" | "B" | "AB">("A");
  const [searchQuery, setSearchQuery] = useState("");
  const [qrConfigs, setQrConfigs] = useState<QRConfig[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [gaugeRows, setGaugeRows] = useState<GaugeQRRow[]>([]);
  const [gaugeLoading, setGaugeLoading] = useState(false);
  const [gaugeError, setGaugeError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<GaugeQRRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [gaugeFilterType, setGaugeFilterType] = useState<number | "all">("all");
  const [gaugeSearch, setGaugeSearch] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [gaugeTypes, setGaugeTypes] = useState<any[]>([]);

  useEffect(() => {
    if (mainTab === "gauge") {
      const fetchGaugeTypes = async () => {
        try {
          const res = await authFetch(`/api/admin/gauge-types?areaType=${gaugeAreaTab}`);
          const data = await res.json();
          if (data.success) {
            setGaugeTypes(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch gauge types:", error);
        }
      };
      fetchGaugeTypes();
    }
  }, [mainTab, gaugeAreaTab]);

  // Refresh gauge types setelah delete
  const handleDeleteSuccess = async () => {
    try {
      const res = await authFetch(`/api/admin/gauge-types?areaType=${gaugeAreaTab}`);
      const data = await res.json();
      if (data.success) {
        setGaugeTypes(data.data);
      }
    } catch (error) {
      console.error("Failed to refresh gauge types:", error);
    }
    alert("✅ Gauge type berhasil dihapus!");
  };

  useEffect(() => { if (!isInitialized || authLoading) return; if (!user) { router.push("/login-page"); return; } if (!["admin", "superadmin"].includes(user.role)) router.push("/home"); }, [user, authLoading, isInitialized, router]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try { const res = await authFetch(`/api/admin/categories?areaType=${areaType}`); if (!res.ok) throw new Error(); const d = await res.json(); const cats = d.success && d.data?.length ? d.data : FALLBACK_CATEGORIES.filter(c => c.area_type === areaType); setCategories(cats); if (cats.length > 0) { const inspCat = cats.find((c: Category) => c.table_type === "inspector"); setSelectedCategoryId(inspCat?.id ?? cats[0].id); } }
      catch { const cats = FALLBACK_CATEGORIES.filter(c => c.area_type === areaType); setCategories(cats); setApiError("API tidak tersedia, menggunakan data bawaan."); if (cats.length > 0) { const inspCat = cats.find((c: Category) => c.table_type === "inspector"); setSelectedCategoryId(inspCat?.id ?? cats[0].id); } }
      finally { setIsLoading(false); }
    }; load();
  }, [areaType]);

  const loadAreas = useCallback(async (catId: number) => { setAreasLoading(true); setIsGenerated(false); setQrConfigs([]); try { const res = await authFetch(`/api/admin/areas?categoryId=${catId}`); if (!res.ok) throw new Error(); const d = await res.json(); setAreas(d.success && d.data?.length ? d.data : FALLBACK_AREAS.filter(a => a.category_id === catId)); } catch { setAreas(FALLBACK_AREAS.filter(a => a.category_id === catId)); } finally { setAreasLoading(false); } }, []);
  useEffect(() => { if (!isLoading) loadAreas(selectedCategoryId); }, [selectedCategoryId, isLoading, loadAreas]);

  const loadGauge = useCallback(async (at: "pre-assy" | "final-assy") => { setGaugeLoading(true); setGaugeError(null); try { const res = await authFetch(`/api/admin/gauge-qr-codes?areaType=${at}`); if (!res.ok) throw new Error(`HTTP ${res.status}`); const d = await res.json(); setGaugeRows(d.data ?? []); } catch { setGaugeError("Gagal memuat data gauge QR."); setGaugeRows([]); } finally { setGaugeLoading(false); } }, []);
  useEffect(() => { if (mainTab === "gauge") loadGauge(gaugeAreaTab); }, [mainTab, gaugeAreaTab, loadGauge]);

  const filteredAreas = areas.filter(a => a.is_active && a.area_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selCat = categories.find((c: Category) => c.id === selectedCategoryId);

  const handleGenerate = () => { setQrConfigs(filteredAreas.map(a => ({ areaCode: a.area_code, areaName: a.area_name, shift: selectedShift, categoryCode: selCat?.category_code ?? "", checklistType: (selCat?.table_type as "inspector" | "group-leader") ?? "inspector" }))); setIsGenerated(true); setTimeout(() => document.getElementById("qr-grid")?.scrollIntoView({ behavior: "smooth" }), 100); };

  const handleEditSave = async (id: number, gaugeId: string, displayName: string, notes: string) => { const res = await authFetch("/api/admin/gauge-qr-codes", { method: "PATCH", body: JSON.stringify({ id, gaugeId, displayName, notes }) }); const d = await res.json(); if (!res.ok) throw new Error(d.error ?? "Gagal."); setGaugeRows(prev => prev.map(r => r.id === id ? { ...r, gauge_id: d.data.gauge_id, qr_value: d.data.qr_value, display_name: d.data.display_name, notes } : r)); };
  const handleAddSave = async (row: any) => { const res = await authFetch("/api/admin/gauge-qr-codes", { method: "POST", body: JSON.stringify({ gaugeTypeId: row.gauge_type_id, gaugeTypeSlug: row.gauge_type_slug, gaugeTypeName: row.gauge_type_name, areaType: row.area_type, gaugeId: row.gauge_id, qrValue: row.qr_value, displayName: row.display_name, seqNumber: row.seq_number, notes: row.notes }) }); const d = await res.json(); if (!res.ok) throw new Error(d.error ?? "Gagal."); await loadGauge(gaugeAreaTab); };
  const handleDelete = async (id: number) => { const res = await authFetch(`/api/admin/gauge-qr-codes?id=${id}`, { method: "DELETE" }); if (!res.ok) { alert("Gagal menghapus."); return; } setGaugeRows(prev => prev.filter(r => r.id !== id)); };

  const filteredGauge = gaugeRows.filter(r => { const tm = gaugeFilterType === "all" || r.gauge_type_id === gaugeFilterType; const sm = gaugeSearch === "" || r.display_name.toLowerCase().includes(gaugeSearch.toLowerCase()) || r.gauge_id.toLowerCase().includes(gaugeSearch.toLowerCase()); return tm && sm; });

  if (authLoading || !isInitialized || isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0f4f8" }}>
      <div style={{ textAlign: "center" }}><div style={{ width: 48, height: 48, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} /><p style={{ color: "#64748b", fontSize: 14 }}>Memuat...</p></div>
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

      {apiError && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>⚠️ {apiError}</div>}

      {/* Main Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "white", padding: 6, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <button onClick={() => setMainTab("area")} style={{ flex: 1, padding: "11px 16px", border: mainTab === "area" ? "2px solid #1e88e5" : "2px solid transparent", borderRadius: 9, background: mainTab === "area" ? "#eff6ff" : "transparent", fontSize: 14, fontWeight: 600, color: mainTab === "area" ? "#1565c0" : "#64748b", cursor: "pointer" }}>🏭 QR Area Checklist</button>
        <button onClick={() => setMainTab("gauge")} style={{ flex: 1, padding: "11px 16px", border: mainTab === "gauge" ? "2px solid #4f46e5" : "2px solid transparent", borderRadius: 9, background: mainTab === "gauge" ? "#f5f3ff" : "transparent", fontSize: 14, fontWeight: 600, color: mainTab === "gauge" ? "#3730a3" : "#64748b", cursor: "pointer" }}>🔧 QR Gauge / Alat Ukur</button>
      </div>

      {/* ══ TAB AREA ══ */}
      {mainTab === "area" && (
        <>
          <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
            {/* Sub-tabs Pre-assy / Final-assy */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["pre-assy", "final-assy"] as const).map(at => (
                <button key={at} onClick={() => { setAreaType(at); setIsGenerated(false); setQrConfigs([]); }} style={{ padding: "10px 20px", border: `2px solid ${areaType === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#e2e8f0"}`, borderRadius: 10, background: areaType === at ? (at === "pre-assy" ? "#ede9fe" : "#e0f2fe") : "white", fontSize: 14, fontWeight: 600, color: areaType === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#64748b", cursor: "pointer" }}>{at === "pre-assy" ? "🔵 Pre-Assembly" : "🟦 Final-Assembly"}</button>
              ))}
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: "0 0 20px", paddingBottom: 12, borderBottom: "2px solid #f1f5f9" }}>⚙️ Konfigurasi QR Code Area</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, color: "#475569", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Tipe Checklist</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", border: selectedCategoryId === cat.id ? "2px solid #1e88e5" : "2px solid #e2e8f0", borderRadius: 10, cursor: "pointer", background: selectedCategoryId === cat.id ? "#eff6ff" : "#f8fafc", fontSize: 14, color: selectedCategoryId === cat.id ? "#1565c0" : "#475569", fontWeight: selectedCategoryId === cat.id ? 600 : 400 }}>
                    <span>{cat.table_type === "inspector" ? "🔍" : "👔"}</span><span>{cat.category_name}</span>
                  </button>
                ))}</div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, color: "#475569", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Shift</label>
                <div style={{ display: "flex", gap: 10 }}>{(["A", "B", "AB"] as const).map(s => { const isActive = selectedShift === s; const bgColor = s === "A" ? "#dbeafe" : s === "B" ? "#f3e5f5" : "#dcfce7"; const txtColor = s === "A" ? "#1565c0" : s === "B" ? "#7b1fa2" : "#166534"; return (<button key={s} onClick={() => { setSelectedShift(s); setIsGenerated(false); }} style={{ flex: 1, padding: 12, border: `2px solid ${isActive ? (s === "A" ? "#1e88e5" : s === "B" ? "#9c27b0" : "#43a047") : "#e2e8f0"}`, borderRadius: 10, cursor: "pointer", background: isActive ? bgColor : "#f8fafc", fontWeight: 600, fontSize: 14, color: isActive ? txtColor : "#475569" }}>{s === "AB" ? "A & B" : `Shift ${s}`}</button>); })}</div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, color: "#475569", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Filter Area ({areasLoading ? "..." : filteredAreas.length + " aktif"})</label>
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input type="text" placeholder="Cari nama area..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setIsGenerated(false); }} style={{ width: "100%", padding: "12px 12px 12px 40px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>

            <div style={{ border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "14px 16px", marginBottom: 20, background: "#f8fafc" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".04em" }}>Area yang akan di-generate:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {areasLoading ? <span style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>Memuat...</span>
                  : filteredAreas.length === 0 ? <span style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>Tidak ada area</span>
                  : filteredAreas.map(a => <span key={a.id} style={{ background: "#dbeafe", color: "#1e40af", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{a.area_name}</span>)}
              </div>
            </div>

            <div>{isGenerated ? (<div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}><button onClick={() => { setIsGenerated(false); setQrConfigs([]); }} style={{ padding: "10px 20px", background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: 10, color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>← Ubah</button><span style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>✅ {qrConfigs.length} QR berhasil dibuat</span></div>)
              : (<button onClick={handleGenerate} disabled={filteredAreas.length === 0 || areasLoading} style={{ padding: "14px 28px", background: "linear-gradient(135deg, #1e88e5, #1565c0)", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: filteredAreas.length === 0 || areasLoading ? "not-allowed" : "pointer", opacity: filteredAreas.length === 0 || areasLoading ? 0.5 : 1, boxShadow: "0 4px 12px rgba(30,136,229,.3)" }}>🔲 Generate {filteredAreas.length} QR Code</button>)}</div>
          </div>

          {isGenerated && qrConfigs.length > 0 && (
            <div id="qr-grid" style={{ marginBottom: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>QR Code Area Siap Download</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Klik <strong>⬇ Download</strong> untuk PNG.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {qrConfigs.map((cfg, i) => <AreaQRCard key={`${cfg.areaCode}-${cfg.shift}-${i}`} config={cfg} index={i} />)}
              </div>
            </div>
          )}

          <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 40 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>📖 Format Path QR Code Area</h2>
            <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>Format:</p>
              <code style={{ display: "block", color: "#67e8f9", fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6 }}>{areaType === "pre-assy" ? "/checksheet-pre-assy" : "/checksheet-final-assy"}?areaCode=&#123;code&#125;&amp;areaName=&#123;name&#125;&amp;shift=&#123;A|B&#125;</code>
            </div>
          </div>
        </>
      )}

      {/* ══ TAB GAUGE ══ */}
      {mainTab === "gauge" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["pre-assy", "final-assy"] as const).map(at => (
              <button key={at} onClick={() => { setGaugeAreaTab(at); setGaugeFilterType("all"); }} style={{ padding: "10px 20px", border: `2px solid ${gaugeAreaTab === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#e2e8f0"}`, borderRadius: 10, background: gaugeAreaTab === at ? (at === "pre-assy" ? "#ede9fe" : "#e0f2fe") : "white", fontSize: 14, fontWeight: 600, color: gaugeAreaTab === at ? (at === "pre-assy" ? "#4f46e5" : "#0891b2") : "#64748b", cursor: "pointer" }}>{at === "pre-assy" ? "🔵 Pre-Assembly" : "🟦 Final-Assembly"}</button>
            ))}
          </div>

          <div style={{ background: "white", borderLeft: `4px solid ${gColor}`, borderRadius: 8, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#1e293b", lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <p style={{ margin: 0 }}><strong>Format QR Value:</strong> <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>DCI-&#123;itemId&#125;-&#123;gaugeId&#125;</code> — contoh: <code style={{ background: "#ede9fe", color: "#3730a3", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>DCI-2-GAUGE-PA-MCR-001</code></p>
          </div>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input type="text" className="si" placeholder="Cari gauge..." value={gaugeSearch} onChange={e => setGaugeSearch(e.target.value)} style={{ maxWidth: 220 }} />
              </div>
              <select value={gaugeFilterType} onChange={e => setGaugeFilterType(e.target.value === "all" ? "all" : parseInt(e.target.value))} style={{ padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#1e293b", outline: "none", background: "white", cursor: "pointer" }}>
                <option value="all">Semua Tipe</option>
                {getGaugeList(gaugeAreaTab).map(t => (<option key={t.dciItemId} value={t.dciItemId}>{t.name}</option>))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDelete(true)} style={{ padding: "11px 20px", background: "#dc2626", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(220,38,38,0.3)", transition: "all .2s" }}>
                🗑️ Hapus Gauge
              </button>
              <button onClick={() => setShowAdd(true)} style={{ padding: "11px 20px", background: gColor, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: `0 3px 10px ${gColor}50`, transition: "all .2s" }}>
                ➕ Tambah Gauge QR
              </button>
            </div>
          </div>

          {gaugeError && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>⚠️ {gaugeError}</div>}

          {gaugeLoading ? (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: 48, background: "white", borderRadius: 12 }}><div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: gColor, borderRadius: "50%", animation: "spin .8s linear infinite" }} /><p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Memuat...</p></div>)
            : filteredGauge.length === 0 ? (<div style={{ background: "white", borderRadius: 12, padding: 48, textAlign: "center", color: "#64748b", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}><p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>🔧 Belum ada data gauge QR</p><p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Pastikan migration SQL sudah dijalankan.</p></div>)
            : (<><p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginBottom: 12 }}>{filteredGauge.length} QR Code gauge</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>{filteredGauge.map(row => <GaugeQRCard key={row.id} row={row} onEdit={setEditingRow} onDelete={handleDelete} />)}</div>
            </>)}

          <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginTop: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>📖 Panduan QR Gauge</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {[{ n: 1, title: "Generate & Download", desc: "Klik ⬇ Download pada kartu gauge." }, { n: 2, title: "Scan di TC 21", desc: "Buka /checksheet-pre-assy, arahkan scanner." }, { n: 3, title: "Card muncul", desc: "Sistem baca Gauge ID → tampilkan checklist." }, { n: 4, title: "Isi status", desc: "Pilih OK/NG, lalu lanjut." }].map(({ n, title, desc }) => (
                <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 32, height: 32, background: `linear-gradient(135deg,${gColor},${gColor}cc)`, color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{n}</div>
                  <div><h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{title}</h3><p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {editingRow && <EditGaugeModal row={editingRow} onSave={handleEditSave} onClose={() => setEditingRow(null)} />}
      {showAdd && <AddGaugeModal areaType={gaugeAreaTab} existingRows={gaugeRows} onSave={handleAddSave} onClose={() => setShowAdd(false)} />}
      {showDelete && <DeleteGaugeModal areaType={gaugeAreaTab} gaugeTypes={gaugeTypes} onClose={() => setShowDelete(false)} onSuccess={handleDeleteSuccess} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}