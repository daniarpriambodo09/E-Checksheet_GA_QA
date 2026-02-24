// components/ScanGaugeButton.tsx
// Komponen tombol "Scan Gauge" untuk menggantikan dropdown pada checkpoint no.4
// Digunakan di: app/status-final-assy/page.tsx
"use client";
import { useState } from "react";
import { GaugeScanModal } from "./GaugeScanModal";

// =====================================================================
// === TYPE ===
// =====================================================================

interface ScanGaugeButtonProps {
  /** Tanggal inspeksi format YYYY-MM-DD */
  dateKey: string;
  shift: "A" | "B";
  userId: string;
  nik: string;
  existingStatus?: "OK" | "NG" | "-";
  onSaved?: (gaugeId: string, status: "OK" | "NG" | "-") => void;
  editable?: boolean;
  areaCode?: string;
}

// =====================================================================
// === COMPONENT ===
// =====================================================================

export function ScanGaugeButton({
  dateKey,
  shift,
  userId,
  nik,
  existingStatus = "-",
  onSaved,
  editable = false,
  areaCode,
}: ScanGaugeButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getStatusStyle = (status: "OK" | "NG" | "-") => {
    if (status === "OK") return { bg: "#4caf50", label: "✓ OK", text: "white" };
    if (status === "NG") return { bg: "#f44336", label: "✗ NG", text: "white" };
    return { bg: "#9e9e9e", label: "-", text: "white" };
  };

  const style = getStatusStyle(existingStatus);

  // Jika tidak editable → tampilkan badge status saja
  if (!editable) {
    return (
      <span
        style={{
          display: "inline-block",
          backgroundColor: style.bg,
          color: style.text,
          padding: "4px 8px",
          borderRadius: "4px",
          fontWeight: 600,
          fontSize: "12px",
          minWidth: "40px",
          textAlign: "center",
        }}
      >
        {style.label}
      </span>
    );
  }

  return (
    <>
      {/* Tombol utama */}
      <button
        onClick={() => setIsModalOpen(true)}
        title="Scan QR Gauge"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          border: "none",
          borderRadius: "4px",
          backgroundColor:
            existingStatus === "OK"
              ? "#4caf50"
              : existingStatus === "NG"
              ? "#f44336"
              : "#1976d2",
          color: "white",
          fontWeight: 600,
          fontSize: "11px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <span>📷</span>
        <span>
          {existingStatus !== "-" ? style.label : "Scan"}
        </span>
      </button>

      {/* Modal scan */}
      {isModalOpen && (
        <GaugeScanModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={(gaugeId, status) => {
            onSaved?.(gaugeId, status);
            setIsModalOpen(false);
          }}
          dateKey={dateKey}
          shift={shift}
          userId={userId}
          nik={nik}
          areaCode={areaCode}
        />
      )}
    </>
  );
}