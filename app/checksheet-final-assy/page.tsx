// app/checksheet-final-assy/page.tsx
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";

// =====================================================================
// === TYPE DEFINITIONS ===
// =====================================================================
interface ChecklistItem {
  id: number;
  no: string;
  itemCheck: string;
  checkPoint: string;
  metodeCheck: string;
  area: string;
  shifts: Array<{ shift: "A" | "B" }>;
  showIn?: {
    wpCheck: boolean;
    checker: boolean;
    visual1: boolean;
    visual2: boolean;
    doubleCheck: boolean;
  };
}

interface ChecklistResult {
  itemId: number;
  status: "OK" | "NG" | null;
  notes: string;
  photo?: string;
}

type ChecklistType = "inspector" | "group-leader";

// =====================================================================
// === MAIN COMPONENT ===
// =====================================================================
export default function ChecksheetFinalAssyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isInitialized } = useAuth();

  // ===== STATE =====
  const [area, setArea] = useState("Checker Station");
  const [shift, setShift] = useState<"A" | "B">("A");
  const [currentDate] = useState(new Date());
  const [checklistType, setChecklistType] = useState<ChecklistType>("inspector");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Record<number, ChecklistResult>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ===== AUTH CHECK =====
  useEffect(() => {
    // ✅ Tunggu isInitialized true dulu
    if (!isInitialized || authLoading) return;
    
    if (!user) {
      router.push("/login-page");
      return;
    }
    if (user.role === "inspector-qa") {
      setChecklistType("inspector");
    }
  }, [user, authLoading, isInitialized, router]);

  // ===== LOAD CHECKLIST ITEMS =====
  useEffect(() => {
    const loadChecklistItems = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const areaParam = searchParams.get("area");
        const shiftParam = searchParams.get("shift");
        
        if (areaParam) setArea(areaParam);
        if (shiftParam === "A" || shiftParam === "B") setShift(shiftParam);

        console.log(`📡 Fetching checklist for type: ${checklistType}`);

        const response = await fetch(
          `/api/final-assy/get-checklist-items?type=${checklistType}`
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ Loaded ${data.data?.length || 0} items`);
        
        if (data.success && Array.isArray(data.data)) {
          const filteredItems = data.data.filter(
            (item: ChecklistItem) => 
              item.shifts?.some((s: any) => s.shift === shift)
          );
          setChecklistItems(filteredItems);
          
          await loadSavedResults(filteredItems);
        } else {
          throw new Error(data.error || "No data received");
        }
      } catch (err) {
        console.error("❌ Error loading checklist items:", err);
        setError(err instanceof Error ? err.message : "Gagal memuat checklist");
      } finally {
        setIsLoading(false);
      }
    };

    if (user && !authLoading) {
      loadChecklistItems();
    }
  }, [user, authLoading, searchParams, shift, checklistType]);

  // ===== LOAD SAVED RESULTS FROM DATABASE =====
  const loadSavedResults = useCallback(async (items: ChecklistItem[]) => {
    if (!user) return;
    
    try {
      const dateKey = currentDate.toISOString().split("T")[0];
      const categoryCode = checklistType === "group-leader" 
        ? "final-assy-gl" 
        : "final-assy-inspector";
      
      console.log(`🔍 Loading saved results for: ${dateKey}, shift: ${shift}, area: ${area}`);

      const response = await fetch(
        `/api/final-assy/get-results?userId=${user.id}&categoryCode=${categoryCode}&month=${dateKey.slice(0, 7)}&role=${user.role}&areaCode=${encodeURIComponent(area)}`
      );
      
      if (!response.ok) {
        console.warn("⚠️ Could not load saved results (might be first time)");
        return;
      }

      const data = await response.json();
      
      if (data.success && data.formatted) {
        const loadedResults: Record<number, ChecklistResult> = {};
        
        Object.values(data.formatted).forEach((dateResults: any) => {
          Object.entries(dateResults).forEach(([key, result]: [string, any]) => {
            const parts = key.split("-");
            const itemId = parseInt(parts[0]);
            
            if (!isNaN(itemId) && items.some(i => i.id === itemId)) {
              loadedResults[itemId] = {
                itemId,
                status: result.status === "OK" ? "OK" : result.status === "NG" ? "NG" : null,
                notes: result.ngDescription || "",
              };
            }
          });
        });
        
        if (Object.keys(loadedResults).length > 0) {
          console.log(`✅ Loaded ${Object.keys(loadedResults).length} saved results`);
          setResults(prev => ({ ...prev, ...loadedResults }));
        }
      }
    } catch (err) {
      console.error("❌ Error loading saved results:", err);
    }
  }, [user, currentDate, checklistType, shift, area]);

  // ===== PROGRESS CALCULATION =====
  const completedCount = useMemo(() => 
    Object.values(results).filter((r) => r.status !== null).length,
    [results]
  );

  const totalCount = checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // ===== HANDLERS =====
  // ✅ MODIFIED: Toggle status - klik lagi untuk deselect
  const handleStatusChange = useCallback((itemId: number, clickedStatus: "OK" | "NG") => {
    setResults((prev) => {
      const currentItem = prev[itemId];
      const currentStatus = currentItem?.status || null;
      
      // ✅ TOGGLE LOGIC: Jika klik status yang SAMA dengan status saat ini, maka deselect (kembali ke null)
      if (currentStatus === clickedStatus) {
        console.log(`🔄 Toggle off: Item ${itemId} dari ${clickedStatus} ke null`);
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }
      
      // Jika status berbeda atau dari null, update dengan status baru
      console.log(`🔄 Update: Item ${itemId} dari ${currentStatus} ke ${clickedStatus}`);
      return {
        ...prev,
        [itemId]: {
          itemId,
          status: clickedStatus,
          notes: currentItem?.notes || "",
        },
      };
    });

    setSaveSuccess(false);
  }, []);

  const handleNotesChange = useCallback((itemId: number, notes: string) => {
    setResults((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        notes,
        status: prev[itemId]?.status || null,
      },
    }));
    setSaveSuccess(false);
  }, []);

  const handlePhotoUpload = useCallback((itemId: number, photo: string) => {
    setResults((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        photo,
        status: prev[itemId]?.status || null,
        notes: prev[itemId]?.notes || "",
      },
    }));
    setSaveSuccess(false);
  }, []);

  // ===== SUBMIT =====
  const handleSubmit = async () => {
    if (!user) return;

    const filledItems = checklistItems.filter(
      (item) => results[item.id]?.status !== null
    );

    if (filledItems.length === 0) {
      const confirmEmpty = window.confirm(
        "Tidak ada item yang diisi. Yakin ingin menyimpan checklist kosong?"
      );
      if (!confirmEmpty) return;
    }

    setIsSubmitting(true);
    setSaveSuccess(false);

    try {
      const dateKey = currentDate.toISOString().split("T")[0];
      const categoryCode = checklistType === "group-leader" 
        ? "final-assy-gl" 
        : "final-assy-inspector";
      
      const itemsToSave = checklistItems.filter(
        (item) => results[item.id]?.status !== null
      );
      
      if (itemsToSave.length === 0) {
        setSaveSuccess(true);
        setIsSubmitting(false);
        return;
      }

      const savePromises = itemsToSave.map((item) => {
        const result = results[item.id];
        return fetch("/api/final-assy/save-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            categoryCode,
            itemId: item.id,
            dateKey,
            shift,
            status: result.status!,
            ngDescription: result.status === "NG" ? result.notes : null,
            ngDepartment: result.status === "NG" ? "QA" : null,
            areaCode: area.toLowerCase().replace(/\s+/g, "-"),
          }),
        });
      });

      await Promise.all(savePromises);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (err) {
      console.error("❌ Error saving checklist:", err);
      alert("❌ Gagal menyimpan checklist. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== UTILS =====
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getChecklistTypeLabel = (type: ChecklistType) => {
    return type === "group-leader" ? "Daily Group Leader" : "Daily Inspector";
  };

  // ===== EARLY RETURNS =====
  if (!isInitialized || authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat autentikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ===== RENDER =====
  return (
    <>
      <Sidebar userName={user.fullName || user.username} />
      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <button
            onClick={() => router.back()}
            className="back-button"
            aria-label="Kembali"
          >
            ←
          </button>
          <h1 className="page-title">Final Assy Checksheet</h1>
          <div className="header-actions">
            {user.role === "group-leader-qa" && (
              <select
                value={checklistType}
                onChange={(e) => setChecklistType(e.target.value as ChecklistType)}
                className="type-selector"
                aria-label="Pilih tipe checklist"
              >
                <option value="inspector">Daily Inspector</option>
                <option value="group-leader">Daily Group Leader</option>
              </select>
            )}
            <button className="icon-button" aria-label="Notifikasi">🔔</button>
            <button className="icon-button" aria-label="Profile">👤</button>
          </div>
        </div>

        {/* Info Card */}
        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Tipe Checklist:</span>
            <span className="info-value">{getChecklistTypeLabel(checklistType)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Area:</span>
            <span className="info-value">{area}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Shift:</span>
            <span className="info-value">{shift}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Tanggal:</span>
            <span className="info-value">{formatDate(currentDate)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-card">
          <div className="progress-header">
            <span className="progress-text">
              Progress: {completedCount} / {totalCount} item selesai
            </span>
            <span className="progress-percent">{Math.round(progressPercent)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="success-banner">
            <span className="success-icon">✅</span>
            <span className="success-text">Checklist berhasil disimpan!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button 
              onClick={() => window.location.reload()}
              className="error-retry"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="info-box-partial">
          <span className="info-icon">ℹ️</span>
          <span className="info-text">
            <strong>Simpan Parsial:</strong> Anda dapat menyimpan checklist meskipun belum semua item terisi. 
            <strong>Klik status yang sama 2x untuk membatalkan pilihan.</strong>
          </span>
        </div>

        {/* Checklist Items */}
        <div className="checklist-container">
          {checklistItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p className="empty-title">Tidak ada item checklist</p>
              <p className="empty-desc">
                Pastikan area dan shift sudah dipilih dengan benar.
              </p>
            </div>
          ) : (
            checklistItems.map((item, index) => {
              const result = results[item.id];
              const isExpanded = expandedItem === item.id;
              const isFilled = result?.status !== null;

              return (
                <div 
                  key={item.id} 
                  className={`checklist-item-card ${isExpanded ? "expanded" : ""} ${isFilled ? "filled" : ""}`}
                >
                  <div
                    className="item-header"
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedItem(isExpanded ? null : item.id);
                      }
                    }}
                  >
                    <div className="item-number">{index + 1}.</div>
                    <div className="item-content">
                      <h3 className="item-title">{item.checkPoint}</h3>
                      <p className="item-standard">Standard: {item.metodeCheck}</p>
                    </div>
                    {isFilled ? (
                      <span className="status-indicator filled" title="Sudah diisi">✓</span>
                    ) : (
                      <span className="status-indicator empty" title="Belum diisi">○</span>
                    )}
                    <button className="expand-button" aria-expanded={isExpanded}>
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="item-details">
                      {/* Status Options - Modified untuk toggle */}
                      <div className="status-options">
                        <div 
                          className={`status-option ${result?.status === "OK" ? "selected ok" : ""}`}
                          onClick={() => handleStatusChange(item.id, "OK")}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleStatusChange(item.id, "OK");
                            }
                          }}
                        >
                          <span className="option-circle" />
                          <span className="option-label">OK</span>
                        </div>
                        <div 
                          className={`status-option ${result?.status === "NG" ? "selected ng" : ""}`}
                          onClick={() => handleStatusChange(item.id, "NG")}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleStatusChange(item.id, "NG");
                            }
                          }}
                        >
                          <span className="option-circle" />
                          <span className="option-label">NG</span>
                        </div>
                      </div>

                      {/* Notes Field */}
                      <div className="form-group">
                        <label className="form-label">
                          Keterangan 
                          {result?.status === "NG" && <span className="required">*</span>}
                          <span className="optional">(Opsional)</span>
                        </label>
                        <textarea
                          className="form-textarea"
                          placeholder={result?.status === "NG" 
                            ? "Deskripsikan temuan NG..." 
                            : "Masukkan keterangan (opsional)"
                          }
                          value={result?.notes || ""}
                          onChange={(e) => handleNotesChange(item.id, e.target.value)}
                          rows={3}
                          disabled={result?.status === null}
                        />
                      </div>

                      {/* Photo Upload */}
                      <div className="form-group">
                        <label className="form-label">
                          Upload Foto
                          <span className="optional">(Opsional)</span>
                        </label>
                        <div className="photo-upload">
                          <button 
                            className="upload-button"
                            type="button"
                            onClick={() => {
                              alert("Fitur upload foto akan segera tersedia!");
                            }}
                          >
                            📷 Ambil / Upload Foto
                          </button>
                          {result?.photo && (
                            <div className="photo-preview">
                              <img src={result.photo} alt="Preview" />
                              <button 
                                className="photo-remove"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePhotoUpload(item.id, "");
                                }}
                              >
                                ✕
                              </button>
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

        {/* Submit Button */}
        <div className="submit-section">
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" />
                Menyimpan...
              </>
            ) : (
              `💾 SIMPAN CHECKLIST${completedCount > 0 ? ` (${completedCount} item)` : ""}`
            )}
          </button>
          {completedCount > 0 && (
            <p className="submit-hint">
              {totalCount - completedCount} item belum diisi • Data tersimpan dapat dilanjutkan nanti
            </p>
          )}
        </div>
      </main>

      <style jsx>{`
        .main-content {
          margin-left: 80px;
          padding: 20px;
          min-height: 100vh;
          background: #f5f7fa;
          max-width: 900px;
        }

        /* Header */
        .header-section {
          background: linear-gradient(135deg, #1e88e5, #1565c0);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 12px rgba(30, 136, 229, 0.2);
        }

        .back-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .page-title {
          flex: 1;
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .type-selector {
          padding: 8px 12px;
          border-radius: 8px;
          border: none;
          background: rgba(255, 255, 255, 0.9);
          color: #1e88e5;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .type-selector:hover {
          background: white;
        }

        .icon-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Info Card */
        .info-card {
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-weight: 600;
          color: #64748b;
        }

        .info-value {
          color: #1e293b;
          font-weight: 500;
        }

        /* Progress Bar */
        .progress-card {
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
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
        }

        .progress-bar {
          width: 100%;
          height: 10px;
          background: #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1e88e5, #42a5f5);
          border-radius: 10px;
          transition: width 0.3s ease;
        }

        /* Success Banner */
        .success-banner {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-left: 4px solid #22c55e;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: slideIn 0.3s ease;
        }

        .success-icon {
          font-size: 20px;
        }

        .success-text {
          flex: 1;
          color: #166534;
          font-size: 14px;
          font-weight: 500;
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

        /* Error Banner */
        .error-banner {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .error-icon {
          font-size: 20px;
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
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .error-retry:hover {
          background: #dc2626;
        }

        /* Info Box */
        .info-box-partial {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #3b82f6;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .info-icon {
          font-size: 18px;
        }

        .info-text {
          color: #1e40af;
          font-size: 13px;
          line-height: 1.4;
        }

        /* Checklist Container */
        .checklist-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 100px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          background: white;
          border-radius: 12px;
          border: 2px dashed #cbd5e1;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .empty-title {
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 8px 0;
        }

        .empty-desc {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        /* Checklist Item Card */
        .checklist-item-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          border: 2px solid transparent;
          transition: all 0.2s;
          position: relative;
        }

        .checklist-item-card:hover {
          border-color: #1e88e5;
          box-shadow: 0 4px 12px rgba(30, 136, 229, 0.1);
        }

        .checklist-item-card.expanded {
          border-color: #1e88e5;
          box-shadow: 0 4px 16px rgba(30, 136, 229, 0.15);
        }

        .checklist-item-card.filled {
          border-left: 4px solid #22c55e;
        }

        .checklist-item-card.filled::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(180deg, #22c55e, transparent);
          border-radius: 0 12px 12px 0;
        }

        .item-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
        }

        .item-number {
          font-weight: 700;
          color: #1e88e5;
          font-size: 18px;
          min-width: 30px;
        }

        .item-content {
          flex: 1;
        }

        .item-title {
          margin: 0 0 6px 0;
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          line-height: 1.4;
        }

        .item-standard {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }

        .status-indicator {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
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
          padding: 4px;
          transition: all 0.2s;
        }

        .expand-button:hover {
          color: #1e88e5;
        }

        .item-details {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Status Options - MODIFIED untuk toggle */
        .status-options {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          align-items: center;
        }

        .status-option {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          user-select: none;
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
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .status-option.selected .option-circle {
          border-color: currentColor;
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

        /* Form Fields */
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
        }

        .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          transition: all 0.2s;
          background: white;
        }

        .form-textarea:focus {
          outline: none;
          border-color: #1e88e5;
          box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.1);
        }

        .form-textarea:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        /* Photo Upload */
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
          transition: all 0.2s;
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
          width: 100px;
          height: 100px;
          border-radius: 8px;
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
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .photo-remove:hover {
          background: #dc2626;
        }

        /* Submit Section */
        .submit-section {
          position: fixed;
          bottom: 0;
          left: 80px;
          right: 0;
          background: white;
          padding: 16px 24px;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
          z-index: 100;
        }

        .submit-button {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 16px 32px;
          background: linear-gradient(135deg, #1e88e5, #1565c0);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(30, 136, 229, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-hint {
          text-align: center;
          font-size: 12px;
          color: #64748b;
          margin-top: 8px;
          margin-bottom: 0;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
            padding: 12px;
          }

          .header-section {
            padding: 12px 16px;
            flex-wrap: wrap;
          }

          .page-title {
            font-size: 16px;
            order: 3;
            width: 100%;
            margin-top: 8px;
          }

          .type-selector {
            order: 2;
          }

          .checklist-item-card {
            padding: 16px;
          }

          .item-title {
            font-size: 14px;
          }

          .submit-section {
            left: 0;
            padding: 12px 16px;
          }

          .submit-button {
            padding: 14px 24px;
            font-size: 15px;
          }
        }

        @media (max-width: 480px) {
          .header-section {
            padding: 10px 12px;
          }

          .back-button,
          .icon-button {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }

          .page-title {
            font-size: 15px;
          }

          .info-card {
            padding: 12px 16px;
          }

          .info-label,
          .info-value {
            font-size: 13px;
          }

          .progress-card {
            padding: 12px 16px;
          }

          .progress-text {
            font-size: 13px;
          }

          .progress-percent {
            font-size: 14px;
          }

          .checklist-item-card {
            padding: 14px;
          }

          .item-number {
            font-size: 16px;
          }

          .item-title {
            font-size: 13px;
          }

          .item-standard {
            font-size: 12px;
          }

          .status-options {
            gap: 12px;
          }

          .status-option {
            padding: 10px 14px;
          }

          .form-textarea {
            padding: 10px;
            font-size: 13px;
          }

          .submit-button {
            padding: 14px 20px;
            font-size: 14px;
          }
        }
      `}</style>
    </>
  );
}