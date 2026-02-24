// components/AreaFilter.tsx (atau inline di page.tsx)
"use client";
import { useState, useEffect } from "react";

interface AreaOption {
  id: number;
  area_name: string;
  area_code: string;
  description?: string;
  sort_order: number;
}

interface AreaFilterProps {
  categoryCode: string;
  selectedArea: string;
  onAreaChange: (areaCode: string) => void;
  isLoading?: boolean;
  defaultAreaCode?: string; // ← TAMBAHAN: Default area code
}

export function AreaFilter({ 
  categoryCode, 
  selectedArea, 
  onAreaChange, 
  isLoading = false,
  defaultAreaCode // ← TAMBAHAN
}: AreaFilterProps) {
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  
  useEffect(() => {
    if (!categoryCode) return;
    
    const fetchAreas = async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/areas/get-by-category?categoryCode=${encodeURIComponent(categoryCode)}`);
        const data = await res.json();
        if (data.success && data.areas?.length > 0) {
          setAreas(data.areas);
          
          // ✅ AUTO-SET DEFAULT AREA JIKA selectedArea KOSONG
          if (!selectedArea && defaultAreaCode) {
            // Cek apakah defaultAreaCode valid
            const isValidDefault = data.areas.some((a: AreaOption) => a.area_code === defaultAreaCode);
            if (isValidDefault) {
              onAreaChange(defaultAreaCode);
            } else {
              // Fallback ke area pertama
              onAreaChange(data.areas[0].area_code);
            }
          } else if (!selectedArea && data.areas.length > 0) {
            // Fallback: set ke area pertama jika tidak ada defaultAreaCode
            onAreaChange(data.areas[0].area_code);
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch areas:', error);
      } finally {
        setIsFetching(false);
      }
    };
    
    fetchAreas();
  }, [categoryCode, selectedArea, onAreaChange, defaultAreaCode]);
  
  const isDisabled = isLoading || isFetching || areas.length === 0;
  
  return (
    <div className="area-filter-wrapper" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      marginLeft: 'auto'
    }}>
      <label htmlFor="area-select" className="filter-label" style={{ 
        fontWeight: '600',
        fontSize: '14px',
        color: '#334155'
      }}>Area:</label>
      <select
        id="area-select"
        value={selectedArea}
        onChange={(e) => onAreaChange(e.target.value)}
        disabled={isDisabled}
        className="area-dropdown"
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          fontSize: '14px',
          fontWeight: '500',
          color: '#1e293b',
          backgroundColor: isDisabled ? '#f1f5f9' : 'white',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          minWidth: '200px'
        }}
      >
        {/* ✅ HAPUS: <option value="">Semua Area</option> */}
        {areas.map(area => (
          <option key={area.area_code} value={area.area_code}>
            {area.area_name}
          </option>
        ))}
      </select>
      {(isFetching || areas.length === 0) && (
        <span className="area-loading" style={{ 
          fontSize: '13px', 
          color: '#64748b',
          fontStyle: 'italic'
        }}>
          {isFetching ? 'Memuat...' : 'Tidak ada area'}
        </span>
      )}
    </div>
  );
}