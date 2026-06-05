// components/ConveyorPatternSelector.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { saveCache, getCache } from "@/lib/offline/cache";

export const CONVEYOR_PATTERN_MAP: Record<string, string[]> = {
  AB1:  ["LHD", "RHD"],
  AB3:  ["LHD"],
  AB6:  ["67120", "67240", "675J0"],
  AB8:  ["LHD", "RHD"],
  AB9:  ["LHD", "RHD"],
  AB15: ["MINICO AX"],
  AB16: ["GT43"],
  "12B": ["LHD"],
  "16C": ["LHD"],
};

export const CONVEYOR_LIST = Object.keys(CONVEYOR_PATTERN_MAP);

export const FA_SPECIFIC_AREAS = [
  "WP CHECK",
  "CHECKER",
  "VISUAL 1",
  "VISUAL 2",
  "DOUBLE CHECK (RI)",
];

interface ConveyorData {
  id: number;
  conveyor: string;
  sort_order: number;
  patterns: { id: number; pattern: string; sort_order: number }[];
}

interface SelectionResult {
  conveyor: string;
  pattern: string;
  specificArea: string;
}

interface ConveyorPatternSelectorProps {
  areaName: string;
  areaCode: string;
  onConfirm: (result: SelectionResult) => void;
  onCancel: () => void;
}

export function ConveyorPatternSelector({
  areaName,
  areaCode,
  onConfirm,
  onCancel,
}: ConveyorPatternSelectorProps) {
  const [conveyors, setConveyors]           = useState<ConveyorData[]>([]);
  const [isLoadingConv, setIsLoadingConv]   = useState(true);
  const [selectedConveyor, setSelectedConveyor]   = useState("");
  const [selectedPattern, setSelectedPattern]     = useState("");
  const [selectedSpecArea, setSelectedSpecArea]   = useState("");
  const [availablePatterns, setAvailablePatterns] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Prevent body scroll when modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const CACHE_KEY = "conveyors:list";
    const HARDCODED_FALLBACK = CONVEYOR_LIST.map((conv, i) => ({
      id: i + 1,
      conveyor: conv,
      sort_order: i + 1,
      patterns: CONVEYOR_PATTERN_MAP[conv].map((p, j) => ({
        id: j + 1, pattern: p, sort_order: j + 1,
      })),
    }));

    const load = async () => {
      try {
        // Offline: langsung pakai cache, skip fetch
        if (!navigator.onLine) {
          const cached = await getCache(CACHE_KEY);
          setConveyors(cached ?? HARDCODED_FALLBACK);
          return;
        }
        // Online: fetch → saveCache
        const res  = await fetch("/e-checksheet-qa/api/conveyors");
        const data = await res.json();
        if (data.success && data.conveyors?.length > 0) {
          setConveyors(data.conveyors);
          await saveCache(CACHE_KEY, data.conveyors);
        } else {
          throw new Error("empty");
        }
      } catch {
        // Fetch gagal → fallback ke cache, lalu hardcoded
        const cached = await getCache(CACHE_KEY);
        setConveyors(cached ?? HARDCODED_FALLBACK);
      } finally {
        setIsLoadingConv(false);
        setTimeout(() => setIsAnimating(true), 30);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setSelectedPattern("");
    setSelectedSpecArea("");
    if (!selectedConveyor) { setAvailablePatterns([]); return; }
    const found = conveyors.find(c => c.conveyor === selectedConveyor);
    const pats  = found
      ? found.patterns.map(p => p.pattern)
      : (CONVEYOR_PATTERN_MAP[selectedConveyor] || []);
    setAvailablePatterns(pats);
    if (pats.length === 1) setSelectedPattern(pats[0]);
  }, [selectedConveyor, conveyors]);

  useEffect(() => { setSelectedSpecArea(""); }, [selectedPattern]);

  const isComplete = !!selectedConveyor && !!selectedPattern && !!selectedSpecArea;

  const handleConfirm = useCallback(() => {
    if (!isComplete) return;
    onConfirm({ conveyor: selectedConveyor, pattern: selectedPattern, specificArea: selectedSpecArea });
  }, [isComplete, selectedConveyor, selectedPattern, selectedSpecArea, onConfirm]);

  return (
    <>
      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.72)",
          zIndex: 9000,
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />

      {/* ── Modal wrapper — full-height scroll on mobile ─────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9001,
          display: "flex",
          alignItems: "flex-end",     /* snap to bottom on mobile */
          justifyContent: "center",
          padding: "0",
          /* desktop: center vertically */
          // overridden via media query below via inline + class
        }}
        className="cps-overlay"
      >
        <div
          style={{
            background: "white",
            borderRadius: "20px 20px 0 0",
            width: "100%",
            maxWidth: 520,
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
            transform: isAnimating ? "translateY(0)" : "translateY(100%)",
            opacity: isAnimating ? 1 : 0,
            transition: "transform 0.32s cubic-bezier(0.34,1.1,0.64,1), opacity 0.2s ease",
          }}
          className="cps-sheet"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 99 }} />
          </div>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{
            background: "linear-gradient(135deg,#1e3a5f,#1e88e5)",
            padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 12,
            flexShrink: 0,
          }}>
            <div style={{
              width: 38, height: 38,
              background: "rgba(255,255,255,0.18)", borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>📋</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 800, color: "white" }}>
                Pilih Lokasi Kerja
              </p>
              <p style={{
                margin: 0, fontSize: 11, color: "rgba(255,255,255,0.8)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                Area: <strong>{areaName}</strong>
              </p>
            </div>
            <button
              onClick={onCancel}
              style={{
                background: "rgba(255,255,255,0.15)", border: "none", color: "white",
                width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}
            >✕</button>
          </div>

          {/* ── Step indicator ─────────────────────────────────────────── */}
          <div style={{
            display: "flex", borderBottom: "1px solid #f1f5f9",
            background: "#fafafa", flexShrink: 0,
          }}>
            {[
              { step: 1, label: "Conveyor", done: !!selectedConveyor },
              { step: 2, label: "Pattern",  done: !!selectedPattern  },
              { step: 3, label: "Area",     done: !!selectedSpecArea  },
            ].map(({ step, label, done }, i) => {
              const active = step === 1 || (step === 2 && !!selectedConveyor) || (step === 3 && !!selectedPattern);
              return (
                <div key={step} style={{
                  flex: 1, padding: "10px 4px",
                  display: "flex", alignItems: "center", gap: 5, justifyContent: "center",
                  borderRight: i < 2 ? "1px solid #f1f5f9" : "none",
                  opacity: active ? 1 : 0.38,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: done ? "#22c55e" : active ? "#1e88e5" : "#e2e8f0",
                    color: (done || active) ? "white" : "#94a3b8",
                  }}>
                    {done ? "✓" : step}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: done ? 700 : 600,
                    color: done ? "#16a34a" : active ? "#1e88e5" : "#94a3b8",
                  }}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch" as any,
            padding: "16px 16px 8px",
            display: "flex", flexDirection: "column", gap: 12,
          }}>

            {/* 1. Conveyor */}
            <DropdownField
              step={1} label="Conveyor" icon="🏭"
              value={selectedConveyor}
              placeholder={isLoadingConv ? "Memuat..." : "Pilih Conveyor"}
              disabled={isLoadingConv}
              color="#1e88e5" bgColor="#eff6ff" borderColor="#bfdbfe"
              onChange={setSelectedConveyor}
              options={conveyors.map(c => ({ value: c.conveyor, label: c.conveyor }))}
            />

            {/* 2. Pattern */}
            <DropdownField
              step={2} label="Pattern" icon="🔖"
              value={selectedPattern}
              placeholder={!selectedConveyor ? "Pilih Conveyor dulu" : availablePatterns.length === 0 ? "Tidak ada pattern" : "Pilih Pattern"}
              disabled={!selectedConveyor || availablePatterns.length === 0}
              color="#7c3aed" bgColor="#f5f3ff" borderColor="#ddd6fe"
              onChange={setSelectedPattern}
              options={availablePatterns.map(p => ({ value: p, label: p }))}
            />

            {/* 3. Spesifik Area */}
            <DropdownField
              step={3} label="Spesifik Area" icon="🔍"
              value={selectedSpecArea}
              placeholder={!selectedPattern ? "Pilih Pattern dulu" : "Pilih Spesifik Area"}
              disabled={!selectedPattern}
              color="#059669" bgColor="#f0fdf4" borderColor="#bbf7d0"
              onChange={setSelectedSpecArea}
              options={FA_SPECIFIC_AREAS.map(a => ({ value: a, label: a }))}
            />

            {/* Preview ringkasan */}
            {isComplete && (
              <div style={{
                background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                border: "1.5px solid #86efac", borderRadius: 12,
                padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
              }}>
                <p style={{
                  margin: 0, fontSize: 10, fontWeight: 800, color: "#166534",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>✅ Ringkasan Pilihan</p>
                {[
                  { label: "Area",         value: areaName,          color: "#1e40af" },
                  { label: "Conveyor",     value: selectedConveyor,  color: "#1e88e5" },
                  { label: "Pattern",      value: selectedPattern,   color: "#7c3aed" },
                  { label: "Spesifik Area",value: selectedSpecArea,  color: "#059669" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#4b5563", minWidth: 80, flexShrink: 0 }}>{label}:</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color,
                      background: "white", padding: "2px 10px",
                      borderRadius: 20, border: `1.5px solid ${color}40`,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sticky footer ────────────────────────────────────────────── */}
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex", gap: 10,
            background: "white",
            flexShrink: 0,
            /* safe area for iOS home bar */
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: "13px 0",
                background: "#f1f5f9", color: "#475569",
                border: "1.5px solid #e2e8f0", borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >← Batal</button>
            <button
              onClick={handleConfirm}
              disabled={!isComplete}
              style={{
                flex: 2, padding: "13px 0",
                background: isComplete ? "linear-gradient(135deg,#1e88e5,#1565c0)" : "#cbd5e1",
                color: "white", border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: 700,
                cursor: isComplete ? "pointer" : "not-allowed",
                boxShadow: isComplete ? "0 4px 12px rgba(30,136,229,0.3)" : "none",
                transition: "all 0.2s",
              }}
            >
              {isComplete ? "✅ Mulai Checklist →" : "⚠️ Lengkapi semua pilihan"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        /* Desktop: center vertically instead of bottom-snap */
        @media (min-width: 640px) {
          .cps-overlay {
            align-items: center !important;
            padding: 20px !important;
          }
          .cps-sheet {
            border-radius: 20px !important;
            max-height: 88vh !important;
          }
        }
      `}</style>
    </>
  );
}

// ── DropdownField ─────────────────────────────────────────────────────────────
function DropdownField({
  step, label, icon, value, placeholder, disabled,
  color, bgColor, borderColor, onChange, options,
}: {
  step: number; label: string; icon: string; value: string;
  placeholder: string; disabled: boolean;
  color: string; bgColor: string; borderColor: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const isDone = !!value;
  return (
    <div style={{
      background: isDone ? bgColor : "#f8fafc",
      border: `2px solid ${isDone ? borderColor : "#e2e8f0"}`,
      borderRadius: 12, padding: "12px 14px",
      transition: "border-color 0.15s, background 0.15s",
      opacity: disabled && !isDone ? 0.45 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: isDone ? color : "#e2e8f0",
          color: isDone ? "white" : "#94a3b8",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>{isDone ? "✓" : step}</div>
        <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? color : "#475569" }}>
          {icon} {label}
        </span>
        {isDone && (
          <span style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 700,
            padding: "2px 10px", borderRadius: 20,
            background: color, color: "white",
            maxWidth: 140, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{value}</span>
        )}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%", padding: "11px 36px 11px 12px",
          border: `1.5px solid ${isDone ? borderColor : "#e2e8f0"}`,
          borderRadius: 8, fontSize: 14, fontWeight: 600,
          color: value ? "#1e293b" : "#9ca3af",
          background: disabled ? "#f1f5f9" : "white",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none", appearance: "none" as any,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}