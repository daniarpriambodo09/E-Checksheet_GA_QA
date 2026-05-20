// components/ConveyorOnlySelector.tsx
// Selector khusus untuk "Daily Check Group Leader Final Assy".
// Hanya memilih Conveyor — tanpa Pattern dan tanpa Spesifik Area.
// Muncul sebagai overlay card setelah scan QR pada halaman /home.

"use client";
import { useState, useEffect, useCallback } from "react";
import { saveCache, getCache } from "@/lib/offline/cache";

interface ConveyorOnlySelectorProps {
  areaName: string;
  areaCode: string;                         
  categoryCode: string;               
  onConfirm: (result: { conveyor: string }) => void;
  onCancel: () => void;
}

export function ConveyorOnlySelector({
  areaName,
  areaCode,
  categoryCode,
  onConfirm,
  onCancel,
}: ConveyorOnlySelectorProps) {
  const [conveyorOptions, setConveyorOptions] = useState<string[]>([]);
  const [selectedConveyor, setSelectedConveyor] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchConveyors = useCallback(async () => {
    const CACHE_KEY = "conveyors:list";
    setIsFetching(true);
    setFetchError(null);

    const toStringList = (conveyors: any[]): string[] =>
      conveyors
        .filter((c: any) => c.is_active !== false)
        .map((c: any) => String(c.conveyor || "").trim().toUpperCase())
        .filter(Boolean);

    try {
      // Offline: langsung pakai cache, skip fetch
      if (!navigator.onLine) {
        const cached = await getCache(CACHE_KEY);
        if (cached) setConveyorOptions(toStringList(cached));
        // tidak set error — cache cukup, atau biarkan kosong dengan pesan "tidak ada"
        return;
      }
      // Online: fetch → saveCache
      const res = await fetch("/api/conveyors");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.conveyors)) {
        setConveyorOptions(toStringList(data.conveyors));
        await saveCache(CACHE_KEY, data.conveyors);
      }
    } catch (err: any) {
      // Fetch gagal → fallback ke cache
      console.error("[ConveyorOnlySelector] fetch error:", err);
      const cached = await getCache(CACHE_KEY);
      if (cached) {
        setConveyorOptions(toStringList(cached));
      } else {
        setFetchError("Gagal memuat daftar conveyor. Coba lagi.");
      }
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchConveyors();
  }, [fetchConveyors]);

  const canConfirm = !!selectedConveyor;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ conveyor: selectedConveyor });
  };

  return (
    <>
      {/* ── Overlay backdrop ──────────────────────────────────────────── */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 200,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 201,
        width: "calc(100% - 32px)",
        maxWidth: 440,
        maxHeight: "90vh",
        background: "white",
        borderRadius: 20,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "slideUp 0.28s cubic-bezier(0.34,1.3,0.64,1)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#1e88e5,#1565c0)",
          padding: "18px 20px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>🏭</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "white" }}>
              Pilih Conveyor
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Daily Check GL — {areaName || areaCode}
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Body — scrollable agar tombol footer selalu terlihat */}
        <div style={{ padding: "20px 20px 0", overflowY: "auto", flex: 1 }}>
          {/* Area info badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#eff6ff", borderRadius: 10, padding: "10px 14px",
            marginBottom: 18, border: "1px solid #bfdbfe",
          }}>
            <span style={{ fontSize: 16 }}>📍</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
              {areaName || areaCode}
            </span>
          </div>

          {/* Conveyor Section */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🏭</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Conveyor</span>
              <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, background: "#fee2e2", padding: "1px 7px", borderRadius: 20 }}>Wajib</span>
            </div>

            {isFetching ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ width: 18, height: 18, border: "2px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#64748b" }}>Memuat daftar conveyor...</span>
              </div>
            ) : fetchError ? (
              <div style={{ padding: "12px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#dc2626" }}>⚠️ {fetchError}</p>
                <button
                  onClick={() => fetchConveyors()}
                  style={{ padding: "6px 14px", background: "#ef4444", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Coba Lagi
                </button>
              </div>
            ) : conveyorOptions.length === 0 ? (
              <div style={{ padding: "12px 14px", background: "#fffbeb", borderRadius: 10, border: "1px dashed #fcd34d" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#92400e", fontWeight: 500 }}>
                  ⚠️ Tidak ada conveyor aktif ditemukan di database.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {conveyorOptions.map(cv => {
                  const isSelected = selectedConveyor === cv;
                  return (
                    <button
                      key={cv}
                      onClick={() => setSelectedConveyor(isSelected ? "" : cv)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "10px 8px",
                        border: `2px solid ${isSelected ? "#1e88e5" : "#e2e8f0"}`,
                        borderRadius: 10,
                        background: isSelected ? "#eff6ff" : "white",
                        cursor: "pointer",
                        transition: "all .15s",
                        boxShadow: isSelected ? "0 2px 8px rgba(30,136,229,0.2)" : "none",
                      }}
                    >
                      <div style={{
                        width: 14, height: 14,
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "#1e88e5" : "#cbd5e1"}`,
                        background: isSelected ? "#1e88e5" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#1e40af" : "#1e293b" }}>
                        {cv}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected summary */}
          {selectedConveyor && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f0fdf4", border: "1.5px solid #86efac",
              borderRadius: 10, padding: "10px 14px", marginBottom: 18,
            }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#166534", fontWeight: 600 }}>Siap Lanjut:</p>
                <p style={{ margin: 0, fontSize: 13, color: "#15803d", fontWeight: 700 }}>
                  🏭 {selectedConveyor}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons — selalu terlihat di bawah */}
        <div style={{ padding: "12px 20px 20px", display: "flex", gap: 10, flexShrink: 0, borderTop: "1px solid #f1f5f9" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "12px 16px", background: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}
          >
            ← Kembali
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              flex: 2, padding: "12px 16px",
              background: canConfirm ? "linear-gradient(135deg,#1e88e5,#1565c0)" : "#cbd5e1",
              color: canConfirm ? "white" : "#94a3b8",
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 800,
              cursor: canConfirm ? "pointer" : "not-allowed",
              transition: "all .15s",
              boxShadow: canConfirm ? "0 4px 12px rgba(30,136,229,0.3)" : "none",
            }}
          >
            {canConfirm ? "Mulai Checklist GL →" : "⚠️ Pilih Conveyor"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -44%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}