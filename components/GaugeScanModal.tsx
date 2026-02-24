// components/GaugeScanModal.tsx
// ✅ FIXED: 1 gauge = 1 checklist per shift, cross-area protection
"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export interface GaugeData {
  id: string;
  gauge_code: string;
  gauge_type: string;
  gauge_name: string;
  area_name: string;
  area_code: string;
  calibration_due: string;
  is_active: boolean;
}

export interface GaugeCheckpoint {
  id: string;
  gauge_type: string;
  checkpoint_name: string;
  checkpoint_order: number;
  is_required: boolean;
  is_active: boolean;
}

export interface InspectionData {
  id: string;
  status: "OK" | "NG" | "-";
  ng_description: string;
  ng_department: string;
  scanned_by: string;
  scanned_at: string;
}

export interface ScannedGaugeHistory {
  gauge_id: string;
  gauge_code: string;
  gauge_type: string;
  gauge_name: string;
  area_code: string;   // ✅ Tambah
  area_name: string;   // ✅ Tambah
  overall_status: "OK" | "NG" | "-";
  has_ng: boolean;
  checked_at: string;
  checkpoint_count: number;
  ng_count: number;
}

export interface CheckpointResult {
  checkpointId: string;
  checkpointName: string;
  status: "-" | "OK" | "NG";
  notes?: string;
}

export interface GaugeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (gaugeId: string, status: "OK" | "NG" | "-") => void;
  dateKey: string;
  shift: "A" | "B";
  userId: string;
  nik: string;
  areaCode?: string;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_session_token");
}

function parseQRCode(raw: string) {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");
  if (parts.length < 3 || parts[0].toUpperCase() !== "GAUGE") return null;
  return { type: parts[1] || "", code: parts[2] || "", area: parts[3] || "" };
}

function isCalibrationExpired(calibrationDue: string): boolean {
  if (!calibrationDue) return false;
  return new Date(calibrationDue) < new Date();
}

// =====================================================================
// === useQRScanner — pakai ref agar tidak stale ===
// =====================================================================
function useQRScanner(onScan: (value: string) => void, isActive: boolean) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCharTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!isActive) return;
    console.log("🔍 QR Scanner activated");

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLast = now - lastCharTimeRef.current;
      lastCharTimeRef.current = now;

      if (e.key === "Enter" || e.key === "\n") {
        const buf = bufferRef.current.trim();
        if (buf.length > 3) {
          console.log("📷 QR Scan detected (Enter):", buf);
          onScanRef.current(buf);
        }
        bufferRef.current = "";
        if (timerRef.current) clearTimeout(timerRef.current);
        e.preventDefault();
        return;
      }

      if (timeSinceLast > 300 && bufferRef.current.length > 0) bufferRef.current = "";
      if (e.key.length === 1) bufferRef.current += e.key;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const buf = bufferRef.current.trim();
        if (buf.length > 3) {
          console.log("📷 QR Scan detected (timeout):", buf);
          onScanRef.current(buf);
        }
        bufferRef.current = "";
      }, 150);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
      console.log("🔍 QR Scanner deactivated");
    };
  }, [isActive]);
}

// --- Helper Components ---
function InfoRow({ label, value, valueStyle = {} }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <>
      <p style={{ margin: 0, fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 600, color: "#1e293b", ...valueStyle }}>{value}</p>
    </>
  );
}

function CheckpointCard({ checkpoint, index, status, notes, onStatusChange, onNotesChange, disabled = false }: {
  checkpoint: GaugeCheckpoint; index: number; status: "-" | "OK" | "NG"; notes: string;
  onStatusChange: (s: "-" | "OK" | "NG") => void; onNotesChange: (n: string) => void; disabled?: boolean;
}) {
  const isNG = status === "NG";
  const showNotes = isNG || !checkpoint.is_required;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px", backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "8px", opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#1976d2", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "4px" }}>
          {checkpoint.checkpoint_name}
          {checkpoint.is_required && <span style={{ fontSize: "10px", color: "#dc2626" }}>*</span>}
        </p>
        {showNotes && (
          <input type="text" value={notes} onChange={(e) => onNotesChange(e.target.value)}
            placeholder={isNG ? "Deskripsikan temuan NG..." : "Catatan (opsional)"}
            style={{ marginTop: "6px", width: "100%", padding: "6px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "4px", backgroundColor: isNG ? "#fff5f5" : "#f8fafc", outline: "none", boxSizing: "border-box" }}
            disabled={disabled} />
        )}
      </div>
      <select value={status} onChange={(e) => onStatusChange(e.target.value as "-" | "OK" | "NG")}
        style={{ padding: "6px 10px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", backgroundColor: status === "OK" ? "#4caf50" : status === "NG" ? "#f44336" : "#9e9e9e", color: "white", cursor: disabled ? "not-allowed" : "pointer", minWidth: "70px", textAlign: "center" }}
        disabled={disabled}>
        <option value="-">-</option>
        <option value="OK">✓ OK</option>
        <option value="NG">✗ NG</option>
      </select>
    </div>
  );
}

// ✅ UPDATED: ScannedGaugeItem dengan badge area
function ScannedGaugeItem({ gauge, onClick, isFromOtherArea }: {
  gauge: ScannedGaugeHistory;
  onClick: () => void;
  isFromOtherArea: boolean;
}) {
  const statusStyle = gauge.overall_status === "OK"
    ? { bg: "#4caf50", label: "✓ OK" }
    : gauge.overall_status === "NG"
    ? { bg: "#f44336", label: "✗ NG" }
    : { bg: "#9e9e9e", label: "-" };

  return (
    <button onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: isFromOtherArea ? "#fffbeb" : "white", border: `1px solid ${isFromOtherArea ? "#fcd34d" : "#e2e8f0"}`, borderRadius: "8px", cursor: "pointer", textAlign: "left" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1976d2"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(25,118,210,0.15)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isFromOtherArea ? "#fcd34d" : "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", fontFamily: "monospace" }}>{gauge.gauge_code}</span>
          <span style={{ fontSize: "11px", padding: "2px 8px", backgroundColor: "#e2e8f0", borderRadius: "4px", color: "#64748b" }}>{gauge.gauge_type}</span>
          {/* ✅ Badge area */}
          {gauge.area_name && (
            <span style={{ fontSize: "11px", padding: "2px 8px", backgroundColor: isFromOtherArea ? "#fef3c7" : "#dbeafe", borderRadius: "4px", color: isFromOtherArea ? "#92400e" : "#1d4ed8", fontWeight: 600 }}>
              📍 {gauge.area_name}
            </span>
          )}
          {/* ✅ Label "Area Lain" jika beda area */}
          {isFromOtherArea && (
            <span style={{ fontSize: "10px", padding: "2px 6px", backgroundColor: "#fde68a", borderRadius: "4px", color: "#78350f", fontWeight: 700 }}>
              AREA LAIN
            </span>
          )}
        </div>
        <span style={{ fontSize: "12px", color: "#64748b" }}>{gauge.gauge_name}</span>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
          Dicek: {new Date(gauge.checked_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          {gauge.ng_count > 0 && <span style={{ marginLeft: "8px", color: "#dc2626", fontWeight: 600 }}>⚠️ {gauge.ng_count} NG</span>}
        </span>
      </div>
      <span style={{ padding: "6px 12px", backgroundColor: statusStyle.bg, color: "white", borderRadius: "6px", fontSize: "12px", fontWeight: 700, minWidth: "60px", textAlign: "center", flexShrink: 0 }}>
        {statusStyle.label}
      </span>
    </button>
  );
}

// =====================================================================
// === MAIN COMPONENT ===
// =====================================================================
export function GaugeScanModal({ isOpen, onClose, onSaved, dateKey, shift, userId, nik, areaCode }: GaugeScanModalProps) {
  const [phase, setPhase] = useState<"scanning" | "detail" | "saving" | "history">("history");
  const [gauge, setGauge] = useState<GaugeData | null>(null);
  const [isAlreadyChecked, setIsAlreadyChecked] = useState(false); // ✅ Flag: gauge sudah dichecklist
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [checkpoints, setCheckpoints] = useState<GaugeCheckpoint[]>([]);
  const [checkpointResults, setCheckpointResults] = useState<Record<string, "-" | "OK" | "NG">>({});
  const [checkpointNotes, setCheckpointNotes] = useState<Record<string, string>>({});
  const [scannedHistory, setScannedHistory] = useState<ScannedGaugeHistory[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCheckpoints, setIsFetchingCheckpoints] = useState(false);
  const [error, setError] = useState("");
  const [scanFeedback, setScanFeedback] = useState<"idle" | "success" | "error">("idle");

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPhase("history");
      setGauge(null);
      setIsAlreadyChecked(false);
      setInspection(null);
      setCheckpoints([]);
      setCheckpointResults({});
      setCheckpointNotes({});
      setError("");
      setScanFeedback("idle");
      fetchScannedHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (phase === "scanning" && manualInputRef.current) {
      setTimeout(() => { manualInputRef.current?.focus(); }, 100);
    }
  }, [phase]);

  // ✅ scanned-history TANPA areaCode filter
  const fetchScannedHistory = useCallback(async () => {
    setIsFetchingHistory(true);
    try {
      const authToken = getAuthToken();
      // ✅ Tidak kirim areaCode — tampilkan semua gauge yang sudah dicek
      const params = new URLSearchParams({ dateKey, shift });
      const res = await fetch(`/api/gauges/scanned-history?${params}`, {
        headers: { Authorization: authToken || "", "X-Session-Token": authToken || "" },
      });
      const data = await res.json();
      setScannedHistory(data.success && data.history?.length > 0 ? data.history : []);
    } catch (error) {
      console.error("❌ Failed to fetch scanned history:", error);
      setScannedHistory([]);
    } finally {
      setIsFetchingHistory(false);
    }
  }, [dateKey, shift]); // ✅ Tidak ada areaCode

  const fetchCheckpoints = useCallback(async (gaugeType: string) => {
    setIsFetchingCheckpoints(true);
    try {
      const authToken = getAuthToken();
      const res = await fetch(`/api/gauges/checkpoints?gaugeType=${encodeURIComponent(gaugeType)}`, {
        headers: { Authorization: authToken || "", "X-Session-Token": authToken || "" },
      });
      const data = await res.json();
      if (data.success && data.checkpoints?.length > 0) {
        setCheckpoints(data.checkpoints);
        const initialResults: Record<string, "-" | "OK" | "NG"> = {};
        const initialNotes: Record<string, string> = {};
        data.checkpoints.forEach((cp: GaugeCheckpoint) => { initialResults[cp.id] = "-"; initialNotes[cp.id] = ""; });
        setCheckpointResults(initialResults);
        setCheckpointNotes(initialNotes);
      } else {
        setCheckpoints([]);
        setError(`Tidak ada checklist untuk gauge type "${gaugeType}". Hubungi admin.`);
      }
    } catch {
      setCheckpoints([]);
      setError("Gagal memuat checklist.");
    } finally {
      setIsFetchingCheckpoints(false);
    }
  }, []);

  const fetchCheckpointHistory = useCallback(async (gaugeId: string): Promise<boolean> => {
    // ✅ Return true jika gauge sudah pernah dichecklist
    try {
      const authToken = getAuthToken();
      const res = await fetch(`/api/gauges/checkpoints/get?gaugeId=${gaugeId}&dateKey=${dateKey}&shift=${shift}`, {
        headers: { Authorization: authToken || "", "X-Session-Token": authToken || "" },
      });
      const data = await res.json();
      if (data.success && data.checkpointResults?.length > 0) {
        const results: Record<string, "-" | "OK" | "NG"> = {};
        const notes: Record<string, string> = {};
        data.checkpointResults.forEach((item: any) => {
          results[item.checkpointId] = item.status;
          notes[item.checkpointId] = item.notes || "";
        });
        setCheckpointResults(prev => ({ ...prev, ...results }));
        setCheckpointNotes(prev => ({ ...prev, ...notes }));
        return true; // ✅ Sudah ada data = sudah pernah dichecklist
      }
      return false;
    } catch {
      return false;
    }
  }, [dateKey, shift]);

  // =====================================================================
  // === ✅ processQRCode — dengan cek duplikat cross-area ===
  // =====================================================================
  const processQRCode = useCallback(async (rawQR: string) => {
    console.log("📷 [processQRCode] Raw input:", rawQR);

    if (phaseRef.current !== "scanning") {
      console.warn("⚠️ Ignoring scan - wrong phase:", phaseRef.current);
      return;
    }

    const parsed = parseQRCode(rawQR);
    if (!parsed) {
      setScanFeedback("error");
      setError(`Format QR tidak valid: "${rawQR}"\nFormat: GAUGE:TYPE:CODE:AREA`);
      setTimeout(() => setScanFeedback("idle"), 2000);
      return;
    }

    setScanFeedback("success");
    setIsLoading(true);
    setError("");

    try {
      const authToken = getAuthToken();

      // 1. Fetch gauge data
      const gaugeRes = await fetch(`/api/gauges/get-by-code?gaugeCode=${encodeURIComponent(parsed.code)}`, {
        headers: { Authorization: authToken || "", "X-Session-Token": authToken || "" },
      });
      const gaugeData = await gaugeRes.json();

      if (gaugeRes.status === 401) throw new Error("Sesi expired. Silakan login kembali.");
      if (!gaugeData.success) throw new Error(gaugeData.error || `Gauge "${parsed.code}" tidak ditemukan`);

      setGauge(gaugeData.gauge);

      // 2. Fetch checkpoints
      await fetchCheckpoints(gaugeData.gauge.gauge_type);

      // 3. ✅ Fetch history & cek apakah sudah pernah dichecklist
      const alreadyChecked = await fetchCheckpointHistory(gaugeData.gauge.id);
      setIsAlreadyChecked(alreadyChecked);

      if (alreadyChecked) {
        console.log("⚠️ Gauge sudah pernah dichecklist hari ini:", gaugeData.gauge.gauge_code);
      }

      // 4. Fetch inspection
      try {
        const inspRes = await fetch(`/api/gauges/get-inspection?gaugeId=${gaugeData.gauge.id}&dateKey=${dateKey}&shift=${shift}`, {
          headers: { Authorization: authToken || "", "X-Session-Token": authToken || "" },
        });
        const inspData = await inspRes.json();
        if (inspData.success && inspData.inspection) setInspection(inspData.inspection);
      } catch { /* optional */ }

      setPhase("detail");

    } catch (err: any) {
      setScanFeedback("error");
      setError(err.message || "Gagal memuat data gauge");
      if (err.message?.includes("Sesi expired")) setTimeout(() => onClose(), 1500);
      setTimeout(() => setScanFeedback("idle"), 2000);
    } finally {
      setIsLoading(false);
    }
  }, [dateKey, shift, onClose, fetchCheckpoints, fetchCheckpointHistory]);

  useQRScanner(processQRCode, isOpen && phase === "scanning");

  const handleCheckpointStatusChange = useCallback((checkpointId: string, status: "-" | "OK" | "NG") => {
    setCheckpointResults(prev => ({ ...prev, [checkpointId]: status }));
  }, []);

  const handleCheckpointNotesChange = useCallback((checkpointId: string, notes: string) => {
    setCheckpointNotes(prev => ({ ...prev, [checkpointId]: notes }));
  }, []);

  const handleSave = async () => {
    if (!gauge) return;
    const hasUnfilledRequired = checkpoints.some(cp => cp.is_required && checkpointResults[cp.id] === "-");
    if (hasUnfilledRequired) { setError("Semua checkpoint wajib (*) harus diisi sebelum menyimpan"); return; }

    setPhase("saving");
    setError("");

    try {
      const authToken = getAuthToken();
      const resultsToSave = checkpoints.map(cp => ({
        checkpointId: cp.id,
        checkpointName: cp.checkpoint_name,
        status: checkpointResults[cp.id] || "-",
        notes: checkpointNotes[cp.id] || "",
      }));

      const response = await fetch("/api/gauges/checkpoints/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authToken || "", "X-Session-Token": authToken || "" },
        body: JSON.stringify({ gaugeId: gauge.id, gaugeType: gauge.gauge_type, userId, nik, dateKey, shift, checkpointResults: resultsToSave }),
      });

      const result = await response.json();
      if (response.status === 401) throw new Error("Sesi expired. Silakan login kembali.");
      if (!result.success) throw new Error(result.error || "Gagal menyimpan hasil checkpoint");

      const hasNG = resultsToSave.some(r => r.status === "NG");
      const allOK = resultsToSave.every(r => r.status === "OK");
      const overallStatus: "OK" | "NG" | "-" = hasNG ? "NG" : allOK ? "OK" : "-";

      onSaved?.(gauge.id, overallStatus);
      setIsAlreadyChecked(true); // ✅ Setelah save, tandai sebagai sudah dichecklist
      await fetchScannedHistory();
      setPhase("history");

    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan");
      setPhase("detail");
      if (err.message?.includes("Sesi expired")) setTimeout(() => onClose(), 1500);
    }
  };

  const handleScannedGaugeClick = useCallback(async (gaugeId: string) => {
    setIsLoading(true);
    try {
      const authToken = getAuthToken();
      const gaugeRes = await fetch(`/api/gauges/get-by-gauge-id?gaugeId=${gaugeId}`, {
        headers: { Authorization: authToken || "", "X-Session-Token": authToken || "" },
      });
      const gaugeData = await gaugeRes.json();
      if (!gaugeData.success) throw new Error("Gauge not found");
      setGauge(gaugeData.gauge);
      await fetchCheckpoints(gaugeData.gauge.gauge_type);
      const alreadyChecked = await fetchCheckpointHistory(gaugeId);
      setIsAlreadyChecked(alreadyChecked);
      setPhase("detail");
    } catch {
      setError("Gagal memuat data gauge");
    } finally {
      setIsLoading(false);
    }
  }, [fetchCheckpoints, fetchCheckpointHistory]);

  const handleStartNewScan = () => {
    setGauge(null);
    setIsAlreadyChecked(false);
    setInspection(null);
    setCheckpoints([]);
    setCheckpointResults({});
    setCheckpointNotes({});
    setError("");
    setScanFeedback("idle");
    setPhase("scanning");
  };

  const handleBackToHistory = () => {
    setGauge(null);
    setIsAlreadyChecked(false);
    setInspection(null);
    setCheckpoints([]);
    setCheckpointResults({});
    setCheckpointNotes({});
    setError("");
    setPhase("history");
  };

  const overallStatus = useMemo(() => {
    if (checkpoints.length === 0) return "-" as const;
    const statuses = Object.values(checkpointResults);
    if (statuses.some(s => s === "NG")) return "NG" as const;
    if (statuses.every(s => s === "OK")) return "OK" as const;
    return "-" as const;
  }, [checkpoints, checkpointResults]);

  // ✅ Apakah gauge ini berasal dari area lain?
  const isGaugeFromOtherArea = (g: ScannedGaugeHistory) => {
    if (!areaCode) return false;
    return g.area_code !== areaCode;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "white", borderRadius: "16px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", margin: "16px" }}>
        {/* HEADER */}
        <div style={{ background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)", borderRadius: "16px 16px 0 0", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: "white", fontSize: "18px", fontWeight: 700 }}>
              {phase === "history" ? "📋 Gauge yang Sudah Dicek" : "🔍 Inspeksi Gauge"}
            </h2>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.8)", fontSize: "13px" }}>
              {dateKey} · Shift {shift}
              {areaCode && <span style={{ marginLeft: "8px", opacity: 0.8 }}>· {areaCode}</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {phase !== "history" && (
              <button onClick={handleBackToHistory} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "8px", width: "36px", height: "36px", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            )}
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "8px", width: "36px", height: "36px", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "24px" }}>

          {/* ===== FASE: HISTORY ===== */}
          {phase === "history" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>📊 Semua Gauge Hari Ini</h3>
                <button onClick={handleStartNewScan} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", backgroundColor: "#1976d2", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  📷 Scan Baru
                </button>
              </div>

              {/* ✅ Info bahwa list ini lintas area */}
              <div style={{ marginBottom: "12px", padding: "10px 14px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", fontSize: "12px", color: "#1d4ed8" }}>
                ℹ️ Menampilkan semua gauge yang sudah dicek hari ini (semua area) — untuk mencegah pengecekan ganda.
              </div>

              {isFetchingHistory && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                  <div style={{ display: "inline-block", width: "24px", height: "24px", border: "3px solid #90caf9", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "12px" }} />
                  <p>Memuat data gauge...</p>
                </div>
              )}

              {!isFetchingHistory && scannedHistory.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "2px dashed #cbd5e1" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>📷</div>
                  <p style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "14px" }}>Belum ada gauge yang discan</p>
                  <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "13px" }}>Klik "Scan Baru" untuk memulai</p>
                  <button onClick={handleStartNewScan} style={{ marginTop: "16px", padding: "10px 20px", backgroundColor: "#1976d2", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    📷 Mulai Scan
                  </button>
                </div>
              )}

              {!isFetchingHistory && scannedHistory.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {scannedHistory.map((g) => (
                    <ScannedGaugeItem
                      key={g.gauge_id}
                      gauge={g}
                      onClick={() => handleScannedGaugeClick(g.gauge_id)}
                      isFromOtherArea={isGaugeFromOtherArea(g)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== FASE: SCANNING ===== */}
          {phase === "scanning" && (
            <>
              <input
                ref={manualInputRef}
                type="text"
                style={{ position: "absolute", opacity: 0, width: "1px", height: "1px", pointerEvents: "none" }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.endsWith("\n") || val.includes("GAUGE:")) {
                    const cleaned = val.replace(/\n/g, "").trim();
                    if (cleaned.length > 3) { processQRCode(cleaned); e.target.value = ""; }
                  }
                }}
                autoComplete="off"
              />

              <div style={{ border: `3px dashed ${scanFeedback === "success" ? "#4caf50" : scanFeedback === "error" ? "#f44336" : "#90caf9"}`, borderRadius: "12px", padding: "32px 24px", textAlign: "center", backgroundColor: scanFeedback === "success" ? "#f1faf1" : scanFeedback === "error" ? "#fff5f5" : "#f5f9ff", marginBottom: "20px", transition: "all 0.3s ease" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>
                  {scanFeedback === "success" ? "✅" : scanFeedback === "error" ? "❌" : "📷"}
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: scanFeedback === "success" ? "#2e7d32" : scanFeedback === "error" ? "#c62828" : "#1565c0" }}>
                  {isLoading ? "Memuat data gauge..." : scanFeedback === "success" ? "QR terbaca!" : scanFeedback === "error" ? "QR tidak dikenali" : "Arahkan scanner ke QR Code Gauge"}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Gunakan Zebra TC21 · Halaman siap menerima scan
                </p>
              </div>

              <div style={{ padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" }}>
                <p style={{ margin: 0, fontFamily: "monospace" }}><strong>Format QR:</strong> GAUGE:TYPE:CODE:AREA</p>
                <p style={{ margin: "4px 0 0", fontFamily: "monospace", color: "#94a3b8" }}>Contoh: GAUGE:PUSH-GAUGE:PG001:CHECKER</p>
              </div>

              {error && (
                <div style={{ marginTop: "12px", padding: "12px 14px", backgroundColor: "#fff5f5", border: "1px solid #fca5a5", borderRadius: "8px", color: "#dc2626", fontSize: "13px", whiteSpace: "pre-line" }}>
                  ⚠️ {error}
                </div>
              )}

              <button onClick={handleBackToHistory} style={{ marginTop: "16px", width: "100%", padding: "12px", backgroundColor: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                ← Kembali ke Daftar Gauge
              </button>
            </>
          )}

          {/* ===== FASE: DETAIL / SAVING ===== */}
          {(phase === "detail" || phase === "saving") && gauge && (
            <>
              {/* ✅ Banner jika sudah pernah dichecklist */}
              {isAlreadyChecked && (
                <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "10px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <span style={{ fontSize: "20px", flexShrink: 0 }}>⚠️</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "13px", color: "#92400e" }}>
                      Gauge ini sudah pernah dichecklist hari ini
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#78350f" }}>
                      Shift {shift} · {dateKey}. Anda dapat melihat dan memperbarui hasil jika diperlukan.
                    </p>
                  </div>
                </div>
              )}

              {/* Gauge Info */}
              <div style={{ backgroundColor: "#f0f7ff", border: "1px solid #93c5fd", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Kode Gauge</p>
                    <p style={{ margin: "2px 0 0", fontSize: "20px", fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>{gauge.gauge_code}</p>
                  </div>
                  <span style={{ padding: "4px 10px", backgroundColor: "#dbeafe", color: "#1d4ed8", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>{gauge.gauge_type}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <InfoRow label="Nama" value={gauge.gauge_name} />
                  <InfoRow label="Area" value={gauge.area_name || "-"} />
                  <InfoRow label="Kalibrasi s/d"
                    value={gauge.calibration_due ? new Date(gauge.calibration_due).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                    valueStyle={{ color: isCalibrationExpired(gauge.calibration_due) ? "#dc2626" : "#15803d", fontWeight: 700 }} />
                </div>
                {isCalibrationExpired(gauge.calibration_due) && (
                  <div style={{ marginTop: "10px", padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px", fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
                    ⚠️ Kalibrasi sudah expired! Segera laporkan ke bagian QA.
                  </div>
                )}
              </div>

              {/* Checkpoint Cards */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                    📋 Checklist {gauge.gauge_type}
                    {isAlreadyChecked && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#92400e", backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "4px" }}>Sudah Dicek</span>}
                  </h4>
                  <span style={{ padding: "4px 12px", backgroundColor: overallStatus === "OK" ? "#4caf50" : overallStatus === "NG" ? "#f44336" : "#9e9e9e", color: "white", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>
                    {overallStatus === "OK" ? "✓ Semua OK" : overallStatus === "NG" ? "✗ Ada NG" : "- Belum Lengkap"}
                  </span>
                </div>

                {isFetchingCheckpoints && (
                  <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "13px" }}>
                    <div style={{ display: "inline-block", width: "20px", height: "20px", border: "2px solid #90caf9", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "8px", verticalAlign: "middle" }} />
                    Memuat checklist...
                  </div>
                )}

                {!isFetchingCheckpoints && checkpoints.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {checkpoints.sort((a, b) => a.checkpoint_order - b.checkpoint_order).map((checkpoint, index) => (
                      <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} index={index}
                        status={checkpointResults[checkpoint.id] || "-"}
                        notes={checkpointNotes[checkpoint.id] || ""}
                        onStatusChange={(s) => handleCheckpointStatusChange(checkpoint.id, s)}
                        onNotesChange={(n) => handleCheckpointNotesChange(checkpoint.id, n)}
                        disabled={phase === "saving"}
                      />
                    ))}
                  </div>
                )}

                {!isFetchingCheckpoints && checkpoints.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "13px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                    ⚠️ Tidak ada checklist untuk gauge type ini.
                  </div>
                )}

                {checkpoints.some(cp => cp.is_required && checkpointResults[cp.id] === "-") && (
                  <div style={{ marginTop: "12px", padding: "8px 12px", backgroundColor: "#fff7ed", border: "1px solid #fdba74", borderRadius: "6px", fontSize: "12px", color: "#c2410c" }}>
                    ⚠️ Beberapa checkpoint wajib (*) belum diisi
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: "16px", padding: "12px 14px", backgroundColor: "#fff5f5", border: "1px solid #fca5a5", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", position: "sticky", bottom: 0, backgroundColor: "white", padding: "12px 0", borderTop: "1px solid #e2e8f0" }}>
                <button onClick={handleBackToHistory} disabled={phase === "saving"}
                  style={{ flex: 1, padding: "12px", border: "2px solid #e2e8f0", borderRadius: "10px", backgroundColor: "white", color: "#475569", fontWeight: 600, fontSize: "14px", cursor: "pointer", opacity: phase === "saving" ? 0.5 : 1 }}>
                  📋 Daftar
                </button>
                <button onClick={handleSave}
                  disabled={phase === "saving" || checkpoints.length === 0 || checkpoints.some(cp => cp.is_required && checkpointResults[cp.id] === "-")}
                  style={{ flex: 2, padding: "12px", border: "none", borderRadius: "10px", backgroundColor: checkpoints.length === 0 || checkpoints.some(cp => cp.is_required && checkpointResults[cp.id] === "-") ? "#94a3b8" : isAlreadyChecked ? "#059669" : "#1565c0", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer", opacity: phase === "saving" ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  {phase === "saving"
                    ? <><span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Menyimpan...</>
                    : isAlreadyChecked ? "✏️ Perbarui Checklist" : "💾 Simpan Checklist"
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}