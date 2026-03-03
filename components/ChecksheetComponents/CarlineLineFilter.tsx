"use client";

import { useState, useEffect } from "react";

interface CarlineLineOption {
  carline: string;
  line: string;
}

interface CarlineLineFilterProps {
  selectedCarline: string;
  selectedLine: string;
  onCarlineChange: (carline: string) => void;
  onLineChange: (line: string) => void;
  isLoading?: boolean;
}

export default function CarlineLineFilter({
  selectedCarline,
  selectedLine,
  onCarlineChange,
  onLineChange,
  isLoading = false,
}: CarlineLineFilterProps) {
  const [history, setHistory] = useState<CarlineLineOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      setIsFetching(true);
      try {
        const res = await fetch("/api/final-assy/get-carline-line");
        if (res.ok) {
          const data = await res.json();
          setHistory(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch carline/line history:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchHistory();
  }, []);

  // Get unique carlines from history
  const uniqueCarlines = Array.from(
    new Set(history.map((h) => h.carline).filter(Boolean))
  );

  // Get lines for selected carline
  const availableLines = history
    .filter((h) => h.carline === selectedCarline)
    .map((h) => h.line)
    .filter(Boolean);

  const uniqueLinesForCarline = Array.from(new Set(availableLines));

  const isDisabled = isLoading || isFetching;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginLeft: "auto",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {/* Carline Dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label
          htmlFor="carline-select"
          style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", whiteSpace: "nowrap" }}
        >
          Carline:
        </label>
        <select
          id="carline-select"
          value={selectedCarline}
          onChange={(e) => {
            onCarlineChange(e.target.value);
            onLineChange(""); // Reset line when carline changes
          }}
          disabled={isDisabled || uniqueCarlines.length === 0}
          style={{
            backgroundColor: isDisabled || uniqueCarlines.length === 0 ? "#f1f5f9" : "white",
            cursor:
              isDisabled || uniqueCarlines.length === 0 ? "not-allowed" : "pointer",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            fontSize: "14px",
            fontWeight: "500",
            color: "#1e293b",
            minWidth: "160px",
          }}
        >
          <option value="">Pilih Carline</option>
          {uniqueCarlines.map((carline) => (
            <option key={carline} value={carline}>
              {carline}
            </option>
          ))}
        </select>
      </div>

      {/* Line Dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label
          htmlFor="line-select"
          style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", whiteSpace: "nowrap" }}
        >
          Line:
        </label>
        <select
          id="line-select"
          value={selectedLine}
          onChange={(e) => onLineChange(e.target.value)}
          disabled={isDisabled || !selectedCarline || uniqueLinesForCarline.length === 0}
          style={{
            backgroundColor:
              isDisabled || !selectedCarline || uniqueLinesForCarline.length === 0
                ? "#f1f5f9"
                : "white",
            cursor:
              isDisabled || !selectedCarline || uniqueLinesForCarline.length === 0
                ? "not-allowed"
                : "pointer",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            fontSize: "14px",
            fontWeight: "500",
            color: "#1e293b",
            minWidth: "160px",
          }}
        >
          <option value="">Pilih Line</option>
          {uniqueLinesForCarline.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
      </div>

      {/* Loading indicator */}
      {(isFetching || uniqueCarlines.length === 0) && !isDisabled && (
        <span style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
          {isFetching ? "Memuat..." : "Tidak ada data"}
        </span>
      )}
    </div>
  );
}
