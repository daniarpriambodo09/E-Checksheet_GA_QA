// app/checksheet-final-assy/page.tsx

"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import CarlineLineSection from "@/components/ChecksheetComponents/CarlineLineSection";

interface ChecklistItem {
  id: number;
  no: string;
  itemCheck: string;
  checkPoint: string;
  metodeCheck: string;
  area: string;
  shifts: Array<{ shift: "A" | "B" }>;
}

interface ChecklistResult {
  itemId: number;
  status: "OK" | "NG" | null;
  notes: string;
  photo?: string;
}

type ChecklistType = "inspector" | "group-leader";

// ✅ FIX TIMEZONE: Gunakan local date, bukan UTC
// toISOString() → UTC time → jam 04:xx WIB = hari sebelumnya di UTC
// Solusi: format tanggal dari komponen lokal (getFullYear, getMonth, getDate)
const getLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function ChecksheetFinalAssyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isInitialized } = useAuth();

  const [areaCode, setAreaCode] = useState<string>("");
  const [areaName, setAreaName] = useState<string>("");
  const [shift, setShift] = useState<"A" | "B">("A");
  const [currentDate] = useState(new Date());

  const [checklistType, setChecklistType] = useState<ChecklistType>("inspector");
  const isGroupLeader = user?.role === "group-leader-qa";

  // Remap areaCode sesuai checklistType
  // GL areas: "final-assy-gl-{loc}", Inspector areas: "final-assy-insp-{loc}"
  // Ketika GL switch ke inspector view, areaCode perlu diremap ke area inspector
  const getRemappedAreaCode = (code: string, type: ChecklistType): string => {
    if (!code) return code;
    if (type === "group-leader" && code.startsWith("final-assy-insp-")) {
      return code.replace("final-assy-insp-", "final-assy-gl-");
    }
    if (type === "inspector" && code.startsWith("final-assy-gl-")) {
      return code.replace("final-assy-gl-", "final-assy-insp-");
    }
    return code;
  };

  const effectiveAreaCode = getRemappedAreaCode(areaCode, checklistType);

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Record<number, ChecklistResult>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Carline & Line state
  const [carline, setCarline] = useState<string>("");
  const [line, setLine] = useState<string>("");
  const [carlineLineHistory, setCarlineLineHistory] = useState<Array<{ carline: string; line: string }>>([]);

  // ===== AUTH CHECK =====
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!user) { router.push("/login-page"); return; }
    if (user.role === "inspector-qa") setChecklistType("inspector");
    else if (user.role === "group-leader-qa") setChecklistType("inspector");
  }, [user, authLoading, isInitialized, router]);

  // ===== LOAD CARLINE/LINE HISTORY =====
  useEffect(() => {
    const loadCarlineLineHistory = async () => {
      if (!effectiveAreaCode) return;
      try {
        // Extract area_id from area code format: "final-assy-insp-26" or "final-assy-gl-26"
        const parts = effectiveAreaCode.split('-');
        const areaId = parts[parts.length - 1];
        
        if (!areaId || isNaN(Number(areaId))) {
          console.error('Invalid area code format:', effectiveAreaCode);
          return;
        }
        
        const res = await fetch(`/api/final-assy/get-carline-line?areaId=${areaId}`);
        if (res.ok) {
          const data = await res.json();
          setCarlineLineHistory(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error loading carline/line history:', err);
      }
    };
    loadCarlineLineHistory();
  }, [effectiveAreaCode]);

  // ===== GET AREA FROM URL PARAMS =====
  useEffect(() => {
    const areaCodeParam = searchParams.get("areaCode");
    const areaNameParam = searchParams.get("areaName");
    const shiftParam = searchParams.get("shift");
    if (areaCodeParam) setAreaCode(areaCodeParam);
    if (areaNameParam) setAreaName(decodeURIComponent(areaNameParam));
    if (shiftParam === "A" || shiftParam === "B") setShift(shiftParam);
  }, [searchParams]);

  // ===== LOAD CHECKLIST ITEMS =====
  useEffect(() => {
    if (!user || !areaCode || authLoading) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setResults({});
      setExpandedItem(null);
      try {
        const res = await fetch(`/api/final-assy/get-checklist-items?type=${checklistType}&areaCode=${effectiveAreaCode}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const filtered = data.data.filter((item: ChecklistItem) =>
            item.shifts?.some((s: any) => s.shift === shift)
          );
          setChecklistItems(filtered);
          await loadSavedResults(filtered);
        } else {
          throw new Error(data.error || "No data received");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat checklist");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, checklistType, shift, areaCode]);

  // ===== LOAD SAVED RESULTS =====
  const loadSavedResults = useCallback(async (items: ChecklistItem[]) => {
    if (!user || !areaCode) return;
    try {
      // ✅ FIX: Pakai getLocalDateKey bukan toISOString
      const dateKey = getLocalDateKey(currentDate);
      const categoryCode = checklistType === "group-leader" ? "final-assy-gl" : "final-assy-inspector";
      const res = await fetch(
        `/api/final-assy/get-results?userId=${user.id}&categoryCode=${categoryCode}&month=${dateKey.slice(0, 7)}&role=${user.role}&areaCode=${encodeURIComponent(effectiveAreaCode)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.formatted) {
        const loaded: Record<number, ChecklistResult> = {};
        // ✅ Filter hanya hasil untuk HARI INI (dateKey), bukan semua hari di bulan ini
        // Tanpa filter ini, data dari hari lain bisa ter-load ke checksheet hari ini
        const todayResults = data.formatted[dateKey] || {};
        Object.entries(todayResults).forEach(([key, result]: [string, any]) => {
          const itemId = parseInt(key.split("-")[0]);
          if (!isNaN(itemId) && items.some(i => i.id === itemId)) {
            loaded[itemId] = {
              itemId,
              status: result.status === "OK" ? "OK" : result.status === "NG" ? "NG" : null,
              notes: (result as any).ngDescription || "",
            };
          }
        });
        if (Object.keys(loaded).length > 0) setResults(prev => ({ ...prev, ...loaded }));
      }
    } catch (err) {
      console.error("❌ Load saved results error:", err);
    }
  }, [user, currentDate, checklistType, shift, areaCode]);

  // ===== PROGRESS =====
  const completedCount = useMemo(
    () => Object.values(results).filter(r => r.status !== null).length,
    [results]
  );
  const totalCount = checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // ===== HANDLERS =====
  const handleStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    setResults(prev => {
      const cur = prev[itemId]?.status || null;
      if (cur === clicked) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: { itemId, status: clicked, notes: prev[itemId]?.notes || "" } };
    });
    setSaveSuccess(false);
  }, []);

  const handleNotesChange = useCallback((itemId: number, notes: string) => {
    setResults(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], itemId, notes, status: prev[itemId]?.status || null },
    }));
    setSaveSuccess(false);
  }, []);

  const handlePhotoUpload = useCallback((itemId: number, photo: string) => {
    setResults(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], itemId, photo, status: prev[itemId]?.status || null, notes: prev[itemId]?.notes || "" },
    }));
    setSaveSuccess(false);
  }, []);

  // ===== SUBMIT =====
  const handleSubmit = async () => {
    if (!user || !areaCode) return;
    if (!carline || !line) {
      alert("Silakan isi Carline dan Line sebelum menyimpan.");
      return;
    }
    
    const itemsToSave = checklistItems.filter(item => results[item.id]?.status !== null && results[item.id]?.status !== undefined);
    if (itemsToSave.length === 0) {
      if (!window.confirm("Tidak ada item yang diisi. Yakin ingin menyimpan checklist kosong?")) return;
    }
    setIsSubmitting(true);
    setSaveSuccess(false);
    try {
      // ✅ FIX: Pakai getLocalDateKey bukan toISOString
      const dateKey = getLocalDateKey(currentDate);
      const categoryCode = checklistType === "group-leader" ? "final-assy-gl" : "final-assy-inspector";

      console.log(`💾 Saving checklist: dateKey=${dateKey}, category=${categoryCode}, area=${effectiveAreaCode}, carline=${carline}, line=${line}`);

      // Save carline/line history
      const categoryCode = checklistType === "group-leader" ? "final-assy-gl" : "final-assy-inspector";
      await fetch("/api/final-assy/save-carline-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          carline, 
          line,
          userId: user.id,
          categoryCode,
        }),
      });

      await Promise.all(
        itemsToSave.map(item => {
          const result = results[item.id];
          if (!result || result.status === null) return Promise.resolve();
          return fetch("/api/final-assy/save-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              categoryCode,
              itemId: item.id,
              dateKey,
              shift,
              status: result.status,
              ngDescription: result.status === "NG" ? result.notes : null,
              ngDepartment: result.status === "NG" ? "QA" : null,
              areaCode: effectiveAreaCode,
              carline,
              line,
            }),
          });
        })
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("❌ Gagal menyimpan checklist. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const checklistTypeLabel = (type: ChecklistType) =>
    type === "group-leader" ? "Daily Group Leader" : "Daily Inspector";

  if (authLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!areaCode || !areaName) {
    return (
      <>
        <Sidebar userName={user.fullName || user.username} />
        <main style={{ marginLeft: 80, padding: 20 }}>
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-text">Area tidak ditemukan. Silakan scan QR Code pada area yang ingin diperiksa.</span>
            <button onClick={() => router.push("/home")} className="error-retry">Kembali ke Home</button>
          </div>
        </main>
        <style jsx>{`
          .error-banner { background:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; border-radius:8px; padding:16px 20px; display:flex; align-items:center; gap:12px; }
          .error-icon { font-size:20px; }
          .error-text { flex:1; color:#dc2626; font-size:14px; }
          .error-retry { background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Sidebar userName={user.fullName || user.username} />
      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <button onClick={() => router.back()} className="back-button" aria-label="Kembali">←</button>
          <h1 className="page-title">Final Assy Checksheet</h1>
          <div className="header-actions">
            <button className="icon-button" aria-label="Notifikasi">🔔</button>
            <button className="icon-button" aria-label="Profile">👤</button>
          </div>
        </div>

        {/* Info Card */}
        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Tipe Checklist:</span>
            {isGroupLeader ? (
              <div className="checklist-type-selector">
                <select
                  className="type-dropdown"
                  value={checklistType}
                  onChange={e => { setChecklistType(e.target.value as ChecklistType); setSaveSuccess(false); }}
                >
                  <option value="inspector">Daily Inspector</option>
                  <option value="group-leader">Daily Group Leader</option>
                </select>
                <span className="dropdown-badge gl">GL Mode</span>
              </div>
            ) : (
              <div className="checklist-type-static">
                <span className="info-value">{checklistTypeLabel(checklistType)}</span>
                <span className="dropdown-badge ins">Inspector</span>
              </div>
            )}
          </div>
          <div className="info-row">
            <span className="info-label">Area:</span>
            <span className="info-value area-value">
              {areaName}
              {effectiveAreaCode !== areaCode && (
                <span style={{fontSize:"11px", color:"#64748b", fontWeight:"normal", marginLeft:"6px"}}>
                  ({checklistType === "group-leader" ? "GL" : "Inspector"} area)
                </span>
              )}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Shift:</span>
            <span className="info-value">{shift}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Tanggal:</span>
            {/* ✅ Tampilkan tanggal lokal untuk konfirmasi visual */}
            <span className="info-value">{formatDate(currentDate)} <span style={{fontSize:"11px",color:"#64748b"}}>({getLocalDateKey(currentDate)})</span></span>
          </div>
        </div>

        {/* Carline & Line Section */}
        <CarlineLineSection
          carline={carline}
          setCarline={setCarline}
          line={line}
          setLine={setLine}
          history={carlineLineHistory}
          areaCode={effectiveAreaCode}
        />

        {isLoading ? (
          <div className="loading-items">
            <div className="loading-spinner" />
            <p>Memuat data checklist...</p>
          </div>
        ) : (
          <>
            <div className="progress-card">
              <div className="progress-header">
                <span className="progress-text">Progress: {completedCount} / {totalCount} item selesai</span>
                <span className="progress-percent">{Math.round(progressPercent)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} />
              </div>
            </div>

            {saveSuccess && (
              <div className="success-banner"><span>✅</span><span>Checklist berhasil disimpan!</span></div>
            )}
            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{error}</span>
                <button onClick={() => window.location.reload()} className="error-retry">Coba Lagi</button>
              </div>
            )}

            <div className="info-box-partial">
              <span>ℹ️</span>
              <span className="info-text">
                <strong>Simpan Parsial:</strong> Anda dapat menyimpan meskipun belum semua item terisi.{" "}
                <strong>Klik status yang sama 2x untuk membatalkan pilihan.</strong>
              </span>
            </div>

            <div className="checklist-container">
              {checklistItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <p className="empty-title">Tidak ada item checklist</p>
                  <p className="empty-desc">Pastikan area, shift, dan tipe checklist sudah benar.</p>
                </div>
              ) : (
                checklistItems.map((item, index) => {
                  const result = results[item.id];
                  const isExpanded = expandedItem === item.id;
                  const isFilled = result?.status != null;
                  return (
                    <div key={item.id} className={`checklist-item-card ${isExpanded ? "expanded" : ""} ${isFilled ? "filled" : ""}`}>
                      <div className="item-header" onClick={() => setExpandedItem(isExpanded ? null : item.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedItem(isExpanded ? null : item.id); } }}>
                        <div className="item-number">{index + 1}.</div>
                        <div className="item-content">
                          <h3 className="item-title">{item.checkPoint}</h3>
                          <p className="item-standard">Standard: {item.metodeCheck}</p>
                        </div>
                        <span className={`status-indicator ${isFilled ? "filled" : "empty"}`}>{isFilled ? "✓" : "○"}</span>
                        <button className="expand-button" aria-expanded={isExpanded}>{isExpanded ? "▲" : "▼"}</button>
                      </div>
                      {isExpanded && (
                        <div className="item-details">
                          <div className="status-options">
                            {(["OK", "NG"] as const).map(s => (
                              <div key={s} className={`status-option ${result?.status === s ? `selected ${s.toLowerCase()}` : ""}`} onClick={() => handleStatusChange(item.id, s)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStatusChange(item.id, s); } }}>
                                <span className="option-circle" />
                                <span className="option-label">{s}</span>
                              </div>
                            ))}
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              Keterangan
                              {result?.status === "NG" && <span className="required">*</span>}
                              <span className="optional">(Opsional)</span>
                            </label>
                            <textarea className="form-textarea" placeholder={result?.status === "NG" ? "Deskripsikan temuan NG..." : "Masukkan keterangan (opsional)"} value={result?.notes || ""} onChange={e => handleNotesChange(item.id, e.target.value)} rows={3} disabled={!result?.status} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Upload Foto <span className="optional">(Opsional)</span></label>
                            <div className="photo-upload">
                              <button className="upload-button" type="button" onClick={() => alert("Fitur upload foto akan segera tersedia!")}>📷 Ambil / Upload Foto</button>
                              {result?.photo && (
                                <div className="photo-preview">
                                  <img src={result.photo} alt="Preview" />
                                  <button className="photo-remove" onClick={e => { e.stopPropagation(); handlePhotoUpload(item.id, ""); }}>✕</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        <div className="submit-section">
          <button className="submit-button" onClick={handleSubmit} disabled={isSubmitting || isLoading} aria-busy={isSubmitting}>
            {isSubmitting ? (<><span className="spinner" /> Menyimpan...</>) : (`💾 SIMPAN CHECKLIST${completedCount > 0 ? ` (${completedCount} item)` : ""}`)}
          </button>
          {completedCount > 0 && (
            <p className="submit-hint">{totalCount - completedCount} item belum diisi • Data tersimpan dapat dilanjutkan nanti</p>
          )}
        </div>
      </main>

      <style jsx>{`
        .main-content {
          margin-left: 80px;
          padding: 20px;
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f4f8 0%, #f5f7fa 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        .header-section {
          background: linear-gradient(135deg, #1e88e5, #1565c0);
          color: white;
          padding: 18px 24px;
          border-radius: 14px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 16px rgba(30, 136, 229, 0.25);
        }

        .back-button {
          background: rgba(255, 255, 255, 0.25);
          border: none;
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.35);
          transform: translateX(-2px);
        }

        .page-title {
          flex: 1;
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .icon-button {
          background: rgba(255, 255, 255, 0.25);
          border: none;
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .icon-button:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        .info-card {
          background: white;
          border-radius: 14px;
          padding: 18px 24px;
          margin-bottom: 16px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(226, 232, 240, 0.5);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-weight: 600;
          color: #64748b;
          font-size: 14px;
          flex-shrink: 0;
        }

        .info-value {
          color: #1e293b;
          font-weight: 500;
          font-size: 14px;
          text-align: right;
        }

        .area-value {
          color: #1e88e5;
          font-weight: 700;
        }

        .checklist-type-selector {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .type-dropdown {
          padding: 8px 32px 8px 14px;
          border: 2px solid #1e88e5;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #1565c0;
          background: #eff6ff;
          cursor: pointer;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231e88e5' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          transition: all 0.2s ease;
        }

        .type-dropdown:hover {
          background-color: #e0f2fe;
        }

        .checklist-type-static {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dropdown-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .dropdown-badge.gl {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .dropdown-badge.ins {
          background: #e0f2fe;
          color: #0277bd;
        }

        .loading-items {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
          background: white;
          border-radius: 14px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #1e88e5;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-items p {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .progress-card {
          background: white;
          border-radius: 14px;
          padding: 18px 24px;
          margin-bottom: 16px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(226, 232, 240, 0.5);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .progress-text {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
        }

        .progress-percent {
          font-weight: 700;
          color: #1e88e5;
          font-size: 16px;
          min-width: 40px;
          text-align: right;
        }

        .progress-bar {
          width: 100%;
          height: 12px;
          background: #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #cbd5e1;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1e88e5, #42a5f5);
          border-radius: 12px;
          transition: width 0.3s ease;
        }

        .success-banner {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-left: 4px solid #22c55e;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #166534;
          font-size: 14px;
          font-weight: 500;
          animation: slideIn 0.3s ease;
        }

        .error-banner {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .error-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .error-text {
          flex: 1;
          color: #dc2626;
          font-size: 14px;
        }

        .error-retry {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .error-retry:hover {
          background: #dc2626;
        }

        .info-box-partial {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #3b82f6;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .info-text {
          color: #1e40af;
          font-size: 13px;
          line-height: 1.5;
          flex: 1;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .checklist-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 120px;
        }

        .empty-state {
          text-align: center;
          padding: 50px 30px;
          background: white;
          border-radius: 14px;
          border: 2px dashed #cbd5e1;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
        }

        .empty-icon {
          font-size: 52px;
          margin-bottom: 16px;
        }

        .empty-title {
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 8px;
          font-size: 16px;
        }

        .empty-desc {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .checklist-item-card {
          background: white;
          border-radius: 12px;
          padding: 18px 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          border: 2px solid transparent;
          transition: all 0.2s ease;
          border: 1px solid #f1f5f9;
        }

        .checklist-item-card:hover {
          border-color: #1e88e5;
          box-shadow: 0 4px 16px rgba(30, 136, 229, 0.12);
          transform: translateY(-1px);
        }

        .checklist-item-card.expanded {
          border-color: #1e88e5;
          box-shadow: 0 4px 16px rgba(30, 136, 229, 0.15);
        }

        .checklist-item-card.filled {
          border-left: 4px solid #22c55e;
        }

        .item-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          cursor: pointer;
          user-select: none;
        }

        .item-number {
          font-weight: 700;
          color: #1e88e5;
          font-size: 16px;
          min-width: 28px;
          margin-top: 2px;
        }

        .item-content {
          flex: 1;
          min-width: 0;
        }

        .item-title {
          margin: 0 0 6px;
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .item-standard {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }

        .status-indicator {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .status-indicator.filled {
          background: #22c55e;
          color: white;
        }

        .status-indicator.empty {
          background: #e2e8f0;
          color: #94a3b8;
          border: 2px solid #cbd5e1;
        }

        .expand-button {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 16px;
          padding: 6px;
          flex-shrink: 0;
          transition: color 0.2s ease;
        }

        .expand-button:hover {
          color: #1e88e5;
        }

        .item-details {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid #e2e8f0;
          animation: slideIn 0.2s ease;
        }

        .status-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }

        .status-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          background: white;
        }

        .status-option:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .status-option.selected.ok {
          border-color: #10b981;
          background: #f0fdf4;
        }

        .status-option.selected.ng {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .option-circle {
          width: 20px;
          height: 20px;
          border: 2px solid #cbd5e1;
          border-radius: 50%;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .status-option.selected.ok .option-circle {
          background: #10b981;
          border-color: #10b981;
        }

        .status-option.selected.ng .option-circle {
          background: #ef4444;
          border-color: #ef4444;
        }

        .option-label {
          font-weight: 600;
          color: #1e293b;
        }

        .status-option.selected.ok .option-label {
          color: #10b981;
        }

        .status-option.selected.ng .option-label {
          color: #ef4444;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .required {
          color: #ef4444;
          margin-left: 2px;
        }

        .optional {
          color: #94a3b8;
          font-weight: 400;
          margin-left: 4px;
          font-size: 12px;
        }

        .form-textarea {
          width: 100%;
          padding: 11px 14px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          transition: all 0.2s ease;
          background: white;
          box-sizing: border-box;
          line-height: 1.4;
        }

        .form-textarea:focus {
          outline: none;
          border-color: #1e88e5;
          box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.1);
        }

        .form-textarea:disabled {
          background: #f8fafc;
          cursor: not-allowed;
          color: #94a3b8;
        }

        .photo-upload {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .upload-button {
          padding: 12px 16px;
          background: #f1f5f9;
          border: 2px dashed #cbd5e1;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          color: #64748b;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .upload-button:hover {
          background: #e2e8f0;
          border-color: #1e88e5;
          color: #1e88e5;
        }

        .photo-preview {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
        }

        .photo-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .photo-remove {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .photo-remove:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .submit-section {
          position: fixed;
          bottom: 0;
          left: 80px;
          right: 0;
          background: linear-gradient(to bottom, white, white);
          padding: 16px 24px;
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
          z-index: 100;
          border-top: 1px solid #e2e8f0;
        }

        .submit-button {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 32px;
          background: linear-gradient(135deg, #1e88e5, #1565c0);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(30, 136, 229, 0.3);
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(30, 136, 229, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-hint {
          text-align: center;
          font-size: 12px;
          color: #64748b;
          margin: 10px 0 0;
          line-height: 1.4;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @media (max-width: 1024px) {
          .main-content {
            padding: 16px;
          }

          .page-title {
            font-size: 20px;
          }

          .submit-section {
            left: 60px;
          }
        }

        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
            padding: 12px;
            background: #f5f7fa;
          }

          .header-section {
            padding: 14px 16px;
            border-radius: 12px;
            gap: 12px;
          }

          .page-title {
            font-size: 18px;
          }

          .back-button,
          .icon-button {
            width: 40px;
            height: 40px;
            font-size: 18px;
          }

          .info-card {
            padding: 14px 16px;
            margin-bottom: 14px;
          }

          .info-row {
            flex-direction: column;
            align-items: flex-start;
            padding: 10px 0;
          }

          .info-value {
            text-align: left;
            margin-top: 4px;
          }

          .progress-card {
            padding: 14px 16px;
          }

          .status-options {
            grid-template-columns: 1fr;
          }

          .item-header {
            gap: 10px;
          }

          .item-title {
            font-size: 14px;
          }

          .checklist-container {
            gap: 12px;
            margin-bottom: 100px;
          }

          .submit-section {
            left: 0;
            padding: 12px 16px;
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
          }

          .submit-button {
            padding: 14px 24px;
            font-size: 14px;
            gap: 8px;
          }

          .empty-state {
            padding: 40px 20px;
          }

          .loading-items {
            padding: 50px 16px;
          }
        }

        @media (max-width: 480px) {
          .main-content {
            padding: 8px;
          }

          .header-section {
            padding: 12px 12px;
            gap: 8px;
          }

          .page-title {
            font-size: 16px;
          }

          .back-button,
          .icon-button {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }

          .header-actions {
            gap: 4px;
          }

          .info-card,
          .progress-card {
            padding: 12px 14px;
            border-radius: 10px;
          }

          .info-label,
          .info-value {
            font-size: 13px;
          }

          .progress-header {
            font-size: 12px;
          }

          .submit-button {
            padding: 12px 16px;
            font-size: 13px;
            gap: 6px;
          }

          .checklist-item-card {
            padding: 14px 14px;
          }

          .item-number {
            font-size: 14px;
          }

          .item-title {
            font-size: 13px;
          }

          .checklist-container {
            margin-bottom: 90px;
          }
        }
      `}</style>
    </>
  );
}
