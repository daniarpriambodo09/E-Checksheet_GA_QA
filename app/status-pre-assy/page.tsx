// app/status-pre-assy/page.tsx
"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/Sidebar"
import React from "react"

type ViewMode = "daily" | "cc-stripping" | "daily-check-ins" | "cs-remove-tool" | "pressure-jig";

const ROLE_ACCESS_MAP: Record<string, ViewMode[]> = {
  "group-leader-qa": ["daily", "cc-stripping"],
  "inspector-qa": ["daily-check-ins", "cs-remove-tool", "pressure-jig"]
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  "daily": "Daily Check Group Leader Pre Assy",
  "cc-stripping": "CallCheck CC & Stripping GL Pre Assy",
  "daily-check-ins": "Daily Check Ins. Inspector Pre Assy",
  "cs-remove-tool": "Check Sheet Control Remove Tool",
  "pressure-jig": "Daily Check Pressure Jig Inspector Pre Assy"
};

const VIEW_MODE_BUTTONS: Record<ViewMode, { label: string }> = {
  "daily": { label: "Daily Check" },
  "cc-stripping": { label: "CC & Stripping" },
  "daily-check-ins": { label: "Daily Check Ins." },
  "cs-remove-tool": { label: "CS Remove Tool" },
  "pressure-jig": { label: "Pressure Jig" }
};

const VIEW_MODE_CATEGORY_CODE: Record<ViewMode, string> = {
  "daily": "pre-assy-daily-gl",
  "cc-stripping": "pre-assy-cc-stripping-gl",
  "daily-check-ins": "pre-assy-daily-check-ins",
  "cs-remove-tool": "pre-assy-cs-remove-tool",
  "pressure-jig": "pre-assy-pressure-jig"
};

const DEFAULT_AREA_BY_CATEGORY: Record<string, string> = {
  "pre-assy-daily-gl": "pre-assy-gl-crimping",
  "pre-assy-cc-stripping-gl": "pre-assy-cc-zone",
  "pre-assy-daily-check-ins": "pre-assy-ins-tensile",
  "pre-assy-cs-remove-tool": "pre-assy-tool-crib",
  "pre-assy-pressure-jig": "pre-assy-jig-storage"
};

const PRE_ASSY_SPECIFIC_AREA_ITEMS: Record<string, number[]> = {
  "TENSILE":       [1, 2, 4, 6, 7, 8, 9],
  "CROSS SECTION": [1, 8, 9, 12],
  "CUTTING":       [1, 2, 7, 9, 10],
  "PA":            [1, 2, 3, 5, 7, 9, 10, 11],
};
const PRE_ASSY_SPECIFIC_AREA_OPTIONS = ["TENSILE", "CROSS SECTION", "CUTTING", "PA"];

interface CheckResult {
  status: "OK" | "NG" | "-"
  ngCount: number
  items: Array<{ name: string; status: "OK" | "NG" | "N/A"; notes: string }>
  notes: string
  submittedAt: string
  submittedBy: string
  ngDescription?: string
  ngDepartment?: string
  areaCode?: string
  carlineLine?: string
  ngPhotos?: string
  gaugeId?: string | null
  dciOtherNote?: string
  dciPhotos?: string[]
}

interface DailyCheckPoint { id: number; checkPoint: string; shift: "A" | "B"; waktuCheck: string; standard: string }
interface CcStrippingCheckPoint { id: number; machine: string; kind: string; size: string; shift: "A" | "B" }
interface DailyCheckInsPoint { id: number; no: number; itemCheck: string; checkPoint: string; method: string; area: { tensile: boolean; crossSection: boolean; cutting: boolean; pa: boolean }; shift: "A" | "B"; schedule: string }
interface CSRemoveToolItem { id: string; dbId?: number; no: number; toolType: string; controlNo: string; itemCheck: string; shift: "A" | "B" }
interface PressureJigCheckPoint { id: number; checkPoint: string; shift: "A" | "B"; frequency: string; judge: string }

interface AreaOption { id: number; area_name: string; area_code: string; description?: string; sort_order: number }

function AreaFilter({ categoryCode, selectedArea, onAreaChange, isLoading = false, defaultAreaCode }: {
  categoryCode: string; selectedArea: string; onAreaChange: (v: string) => void; isLoading?: boolean; defaultAreaCode?: string;
}) {
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  useEffect(() => {
    if (!categoryCode) return;
    setIsFetching(true);
    fetch(`/api/areas/get-by-category?categoryCode=${encodeURIComponent(categoryCode)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.areas?.length > 0) {
          setAreas(data.areas);
          if (!selectedArea) {
            const def = defaultAreaCode && data.areas.some((a: AreaOption) => a.area_code === defaultAreaCode) ? defaultAreaCode : data.areas[0].area_code;
            onAreaChange(def);
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsFetching(false));
  }, [categoryCode, selectedArea, onAreaChange, defaultAreaCode]);
  const isDisabled = isLoading || isFetching || areas.length === 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, width:"100%" }}>
      <label style={{ fontWeight:600, fontSize:12, color:"#334155", whiteSpace:"nowrap", flexShrink:0 }}>📍 Area:</label>
      <select value={selectedArea} onChange={e => onAreaChange(e.target.value)} disabled={isDisabled}
        style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1.5px solid #cbd5e1", fontSize:13, fontWeight:600, color:"#1e293b",
          backgroundColor:isDisabled?"#f1f5f9":"white", cursor:isDisabled?"not-allowed":"pointer", minWidth:0, outline:"none" }}>
        {areas.map(a => <option key={a.area_code} value={a.area_code}>{a.area_name}</option>)}
      </select>
      {(isFetching || areas.length === 0) && <span style={{ fontSize:11, color:"#64748b", fontStyle:"italic" }}>{isFetching?"Memuat...":"Tidak ada area"}</span>}
    </div>
  );
}

// DailyCheckIns checkpoints
const DAILY_CHECK_INS_CHECKPOINTS_FULL: DailyCheckInsPoint[] = [
    {id:1,no:1,itemCheck:"BOLPOINT & MARKER",checkPoint:'1A. TERDAPAT STICKER "E"',method:"VISUAL",area:{tensile:true,crossSection:true,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:1.1,no:1,itemCheck:"BOLPOINT & MARKER",checkPoint:'1A. TERDAPAT STICKER "E"',method:"VISUAL",area:{tensile:true,crossSection:true,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:2,no:2,itemCheck:"MICROMETER",checkPoint:"2A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:2.1,no:2,itemCheck:"MICROMETER",checkPoint:"2A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:2.2,no:2,itemCheck:"MICROMETER",checkPoint:'2B. ANGKA TERBACA DENGAN JELAS',method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:2.3,no:2,itemCheck:"MICROMETER",checkPoint:'2B. ANGKA TERBACA DENGAN JELAS',method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:2.4,no:2,itemCheck:"MICROMETER",checkPoint:'2C. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.000")',method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:2.5,no:2,itemCheck:"MICROMETER",checkPoint:'2C. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.000")',method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:2.6,no:2,itemCheck:"MICROMETER",checkPoint:"2D. KONDISI ANVIL DAN SPINDLE OK",method:"VISUAL, SENTUH",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:2.7,no:2,itemCheck:"MICROMETER",checkPoint:"2D. KONDISI ANVIL DAN SPINDLE OK",method:"VISUAL, SENTUH",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:2.8,no:2,itemCheck:"MICROMETER",checkPoint:"2E. BAUT PENGUNCI TIDAK LONGGAR / DOL",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:2.9,no:2,itemCheck:"MICROMETER",checkPoint:"2E. BAUT PENGUNCI TIDAK LONGGAR / DOL",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:3,no:3,itemCheck:"CALIPER",checkPoint:"3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:3.1,no:3,itemCheck:"CALIPER",checkPoint:"3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:3.2,no:3,itemCheck:"CALIPER",checkPoint:'3B. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.00")',method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:3.3,no:3,itemCheck:"CALIPER",checkPoint:'3B. ZERO SETTING OK (LAYAR MENUNJUKKAN "0.00")',method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:3.4,no:3,itemCheck:"CALIPER",checkPoint:"3C. PENGGESER BERGERAK DENGAN LANCAR",method:"VISUAL, SENTUH",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:3.5,no:3,itemCheck:"CALIPER",checkPoint:"3C. PENGGESER BERGERAK DENGAN LANCAR",method:"VISUAL, SENTUH",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:4,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.1,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.2,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4B. ANGKA PADA LAYAR TERBACA DENGAN JELAS",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.3,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4B. ANGKA PADA LAYAR TERBACA DENGAN JELAS",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.4,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4C. MESIN DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.5,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4C. MESIN DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.6,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4D. TIDAK ADA KONDISI/SUARA ABNORMAL",method:"VISUAL/DIDENGARKAN",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.7,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4D. TIDAK ADA KONDISI/SUARA ABNORMAL",method:"VISUAL/DIDENGARKAN",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.8,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4E. ANGKA PENGUKURAN STABIL",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.9,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4E. ANGKA PENGUKURAN STABIL",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.10,no:4,itemCheck:"MESIN TENSILE",checkPoint:'4F. BISA DI-SETTING "0"',method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.11,no:4,itemCheck:"MESIN TENSILE",checkPoint:'4F. BISA DI-SETTING "0"',method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.12,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4G. GRIPER BISA BERHENTI DI POSISI STOPPER",method:"DICOBA",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.13,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4G. GRIPER BISA BERHENTI DI POSISI STOPPER",method:"DICOBA",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:4.14,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4H. TOMBOL EMERGENCY BISA BERFUNGSI",method:"DICOBA",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:4.15,no:4,itemCheck:"MESIN TENSILE",checkPoint:"4H. TOMBOL EMERGENCY BISA BERFUNGSI",method:"DICOBA",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:5,no:5,itemCheck:"STEEL RULER",checkPoint:"5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:5.1,no:5,itemCheck:"STEEL RULER",checkPoint:"5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:5.2,no:5,itemCheck:"STEEL RULER",checkPoint:"5B. TIDAK BERKARAT DAN ANGKA TERBACA JELAS",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:5.3,no:5,itemCheck:"STEEL RULER",checkPoint:"5B. TIDAK BERKARAT DAN ANGKA TERBACA JELAS",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:6,no:6,itemCheck:"BENT UP/DOWN GAUGE",checkPoint:"6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:6.1,no:6,itemCheck:"BENT UP/DOWN GAUGE",checkPoint:"6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:6.2,no:6,itemCheck:"BENT UP/DOWN GAUGE",checkPoint:"6B. GAUGE DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:6.3,no:6,itemCheck:"BENT UP/DOWN GAUGE",checkPoint:"6B. GAUGE DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:6.4,no:6,itemCheck:"BENT UP/DOWN GAUGE",checkPoint:"6C. BISA MENDETEKSI KONDISI OK DAN N-OK",method:"DICOBA",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:6.5,no:6,itemCheck:"BENT UP/DOWN GAUGE",checkPoint:"6C. BISA MENDETEKSI KONDISI OK DAN N-OK",method:"DICOBA",area:{tensile:true,crossSection:false,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:7,no:7,itemCheck:"THICKNESS GAUGE / GO NO GO M TERMINAL",checkPoint:"7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:7.1,no:7,itemCheck:"THICKNESS GAUGE / GO NO GO M TERMINAL",checkPoint:"7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:7.2,no:7,itemCheck:"THICKNESS GAUGE / GO NO GO M TERMINAL",checkPoint:"7B. GAUGE / GO NO GO DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:7.3,no:7,itemCheck:"THICKNESS GAUGE / GO NO GO M TERMINAL",checkPoint:"7B. GAUGE / GO NO GO DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:true,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:8,no:8,itemCheck:"POCKET COMPARATOR",checkPoint:"8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:true,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:8.1,no:8,itemCheck:"POCKET COMPARATOR",checkPoint:"8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED",method:"VISUAL",area:{tensile:true,crossSection:true,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:8.2,no:8,itemCheck:"POCKET COMPARATOR",checkPoint:"8B. DALAM KONDISI BAIK, BISA MELIHAT DENGAN JELAS",method:"VISUAL",area:{tensile:true,crossSection:true,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:8.3,no:8,itemCheck:"POCKET COMPARATOR",checkPoint:"8B. DALAM KONDISI BAIK, BISA MELIHAT DENGAN JELAS",method:"VISUAL",area:{tensile:true,crossSection:true,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:9,no:9,itemCheck:"CRIMPING STANDARD & IS",checkPoint:"9A. TIDAK RUSAK / TERBACA DENGAN JELAS",method:"VISUAL",area:{tensile:true,crossSection:true,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:9.1,no:9,itemCheck:"CRIMPING STANDARD & IS",checkPoint:"9A. TIDAK RUSAK / TERBACA DENGAN JELAS",method:"VISUAL",area:{tensile:true,crossSection:true,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:9.2,no:9,itemCheck:"CRIMPING STANDARD & IS",checkPoint:'9B. ADA STAMP CONTROL DAN STAMP "CONFIDENTIAL"',method:"VISUAL",area:{tensile:true,crossSection:true,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:9.3,no:9,itemCheck:"CRIMPING STANDARD & IS",checkPoint:'9B. ADA STAMP CONTROL DAN STAMP "CONFIDENTIAL"',method:"VISUAL",area:{tensile:true,crossSection:true,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:10,no:10,itemCheck:"TROLLY INSPECTOR",checkPoint:"10A. TROLLY DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:10.1,no:10,itemCheck:"TROLLY INSPECTOR",checkPoint:"10A. TROLLY DALAM KONDISI BAIK",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:10.2,no:10,itemCheck:"TROLLY INSPECTOR",checkPoint:"10B. TEMPAT CUP TIDAK RUSAK",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:true,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:10.3,no:10,itemCheck:"TROLLY INSPECTOR",checkPoint:"10B. TEMPAT CUP TIDAK RUSAK",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:true,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:11,no:11,itemCheck:"LAMPU UV",checkPoint:"11A. ADA 2 LAMPU DI AREA INSPEKSI UV",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:11.1,no:11,itemCheck:"LAMPU UV",checkPoint:"11A. ADA 2 LAMPU DI AREA INSPEKSI UV",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:11.2,no:11,itemCheck:"LAMPU UV",checkPoint:"11B. LAMPU MENYALA TERANG",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"A",schedule:"Setiap Hari"},
    {id:11.3,no:11,itemCheck:"LAMPU UV",checkPoint:"11B. LAMPU MENYALA TERANG",method:"VISUAL",area:{tensile:false,crossSection:false,cutting:false,pa:true},shift:"B",schedule:"Setiap Hari"},
    {id:12,no:12,itemCheck:"MESIN SIMPLE CROSS SECTION",checkPoint:"12A. TOMBOL ON OFF BERFUNGSI",method:"VISUAL",area:{tensile:false,crossSection:true,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:12.1,no:12,itemCheck:"MESIN SIMPLE CROSS SECTION",checkPoint:"12A. TOMBOL ON OFF BERFUNGSI",method:"VISUAL",area:{tensile:false,crossSection:true,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
    {id:12.2,no:12,itemCheck:"MESIN SIMPLE CROSS SECTION",checkPoint:"12B. TIDAK BERBAU ASAP",method:"VISUAL",area:{tensile:false,crossSection:true,cutting:false,pa:false},shift:"A",schedule:"Setiap Hari"},
    {id:12.3,no:12,itemCheck:"MESIN SIMPLE CROSS SECTION",checkPoint:"12B. TIDAK BERBAU ASAP",method:"VISUAL",area:{tensile:false,crossSection:true,cutting:false,pa:false},shift:"B",schedule:"Setiap Hari"},
  ]

const CS_REMOVE_TOOL_ITEMS_FULL: CSRemoveToolItem[] = [
    { id:"1-X-1-A",dbId:1102,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"1-X-1-B",dbId:1103,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"1-X-2-A",dbId:1104,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"1-X-2-B",dbId:1105,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"1-X-3-A",dbId:1106,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"1-X-3-B",dbId:1107,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"1-X-4-A",dbId:1108,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"1-X-4-B",dbId:1109,no:1,toolType:"1-150A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"2-X-1-A",dbId:1110,no:2,toolType:"PA",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"2-X-1-B",dbId:1111,no:2,toolType:"PA",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"2-X-2-A",dbId:1112,no:2,toolType:"PA",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"2-X-2-B",dbId:1113,no:2,toolType:"PA",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"2-X-3-A",dbId:1114,no:2,toolType:"PA",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"2-X-3-B",dbId:1115,no:2,toolType:"PA",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"2-X-4-A",dbId:1116,no:2,toolType:"PA",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"2-X-4-B",dbId:1117,no:2,toolType:"PA",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"3-X-1-A",dbId:1118,no:3,toolType:"DLI",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"3-X-1-B",dbId:1119,no:3,toolType:"DLI",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"3-X-2-A",dbId:1120,no:3,toolType:"DLI",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"3-X-2-B",dbId:1121,no:3,toolType:"DLI",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"3-X-3-A",dbId:1122,no:3,toolType:"DLI",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"3-X-3-B",dbId:1123,no:3,toolType:"DLI",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"3-X-4-A",dbId:1124,no:3,toolType:"DLI",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"3-X-4-B",dbId:1125,no:3,toolType:"DLI",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"4-X-1-A",dbId:1126,no:4,toolType:"CNR",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"4-X-1-B",dbId:1127,no:4,toolType:"CNR",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"4-X-2-A",dbId:1128,no:4,toolType:"CNR",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"4-X-2-B",dbId:1129,no:4,toolType:"CNR",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"4-X-3-A",dbId:1130,no:4,toolType:"CNR",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"4-X-3-B",dbId:1131,no:4,toolType:"CNR",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"4-X-4-A",dbId:1132,no:4,toolType:"CNR",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"4-X-4-B",dbId:1133,no:4,toolType:"CNR",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"5-X-1-A",dbId:1134,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"5-X-1-B",dbId:1135,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"5-X-2-A",dbId:1136,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"5-X-2-B",dbId:1137,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"5-X-3-A",dbId:1138,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"5-X-3-B",dbId:1139,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"5-X-4-A",dbId:1140,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"5-X-4-B",dbId:1141,no:5,toolType:"TCNR",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"6-X-1-A",dbId:1142,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"6-X-1-B",dbId:1143,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"6-X-2-A",dbId:1144,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"6-X-2-B",dbId:1145,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"6-X-3-A",dbId:1146,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"6-X-3-B",dbId:1147,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"6-X-4-A",dbId:1148,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"6-X-4-B",dbId:1149,no:6,toolType:"1-72A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"7-X-1-A",dbId:1150,no:7,toolType:"1-114",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"7-X-1-B",dbId:1151,no:7,toolType:"1-114",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"7-X-2-A",dbId:1152,no:7,toolType:"1-114",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"7-X-2-B",dbId:1153,no:7,toolType:"1-114",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"7-X-3-A",dbId:1154,no:7,toolType:"1-114",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"7-X-3-B",dbId:1155,no:7,toolType:"1-114",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"7-X-4-A",dbId:1156,no:7,toolType:"1-114",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"7-X-4-B",dbId:1157,no:7,toolType:"1-114",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"8-X-1-A",dbId:1158,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"8-X-1-B",dbId:1159,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"8-X-2-A",dbId:1160,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"8-X-2-B",dbId:1161,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"8-X-3-A",dbId:1162,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"8-X-3-B",dbId:1163,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"8-X-4-A",dbId:1164,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"8-X-4-B",dbId:1165,no:8,toolType:"1-42A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"9-X-1-A",dbId:1166,no:9,toolType:"1-35",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"9-X-1-B",dbId:1167,no:9,toolType:"1-35",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"9-X-2-A",dbId:1168,no:9,toolType:"1-35",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"9-X-2-B",dbId:1169,no:9,toolType:"1-35",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"9-X-3-A",dbId:1170,no:9,toolType:"1-35",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"9-X-3-B",dbId:1171,no:9,toolType:"1-35",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"9-X-4-A",dbId:1172,no:9,toolType:"1-35",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"9-X-4-B",dbId:1173,no:9,toolType:"1-35",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"10-X-1-A",dbId:1174,no:10,toolType:"1-85",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"10-X-1-B",dbId:1175,no:10,toolType:"1-85",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"10-X-2-A",dbId:1176,no:10,toolType:"1-85",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"10-X-2-B",dbId:1177,no:10,toolType:"1-85",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"10-X-3-A",dbId:1178,no:10,toolType:"1-85",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"10-X-3-B",dbId:1179,no:10,toolType:"1-85",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"10-X-4-A",dbId:1180,no:10,toolType:"1-85",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"10-X-4-B",dbId:1181,no:10,toolType:"1-85",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"11-X-1-A",dbId:1182,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"11-X-1-B",dbId:1183,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"11-X-2-A",dbId:1184,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"11-X-2-B",dbId:1185,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"11-X-3-A",dbId:1186,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"11-X-3-B",dbId:1187,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"11-X-4-A",dbId:1188,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"11-X-4-B",dbId:1189,no:11,toolType:"1-83A",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"12-X-1-A",dbId:1190,no:12,toolType:"1-73",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"12-X-1-B",dbId:1191,no:12,toolType:"1-73",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"12-X-2-A",dbId:1192,no:12,toolType:"1-73",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"12-X-2-B",dbId:1193,no:12,toolType:"1-73",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"12-X-3-A",dbId:1194,no:12,toolType:"1-73",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"12-X-3-B",dbId:1195,no:12,toolType:"1-73",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"12-X-4-A",dbId:1196,no:12,toolType:"1-73",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"12-X-4-B",dbId:1197,no:12,toolType:"1-73",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"13-X-1-A",dbId:1198,no:13,toolType:"1-105",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"13-X-1-B",dbId:1199,no:13,toolType:"1-105",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"13-X-2-A",dbId:1200,no:13,toolType:"1-105",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"13-X-2-B",dbId:1201,no:13,toolType:"1-105",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"13-X-3-A",dbId:1202,no:13,toolType:"1-105",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"13-X-3-B",dbId:1203,no:13,toolType:"1-105",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"13-X-4-A",dbId:1204,no:13,toolType:"1-105",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"13-X-4-B",dbId:1205,no:13,toolType:"1-105",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"14-X-1-A",dbId:1206,no:14,toolType:"TLC",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"14-X-1-B",dbId:1207,no:14,toolType:"TLC",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"14-X-2-A",dbId:1208,no:14,toolType:"TLC",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"14-X-2-B",dbId:1209,no:14,toolType:"TLC",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"14-X-3-A",dbId:1210,no:14,toolType:"TLC",controlNo:"",itemCheck:"Terpasang Cover",shift:"A"},{ id:"14-X-3-B",dbId:1211,no:14,toolType:"TLC",controlNo:"",itemCheck:"Terpasang Cover",shift:"B"},
    { id:"14-X-4-A",dbId:1212,no:14,toolType:"TLC",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"14-X-4-B",dbId:1213,no:14,toolType:"TLC",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"15-R-1-A",dbId:1214,no:15,toolType:"EXTRACTION JIG R",controlNo:"R",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"15-R-1-B",dbId:1215,no:15,toolType:"EXTRACTION JIG R",controlNo:"R",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"15-R-2-A",dbId:1216,no:15,toolType:"EXTRACTION JIG R",controlNo:"R",itemCheck:"Tidak berkarat",shift:"A"},{ id:"15-R-2-B",dbId:1217,no:15,toolType:"EXTRACTION JIG R",controlNo:"R",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"15-R-3-A",dbId:1218,no:15,toolType:"EXTRACTION JIG R",controlNo:"R",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"15-R-3-B",dbId:1219,no:15,toolType:"EXTRACTION JIG R",controlNo:"R",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"15-G-1-A",dbId:1220,no:15,toolType:"EXTRACTION JIG G",controlNo:"G",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"15-G-1-B",dbId:1221,no:15,toolType:"EXTRACTION JIG G",controlNo:"G",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"15-G-2-A",dbId:1222,no:15,toolType:"EXTRACTION JIG G",controlNo:"G",itemCheck:"Tidak berkarat",shift:"A"},{ id:"15-G-2-B",dbId:1223,no:15,toolType:"EXTRACTION JIG G",controlNo:"G",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"15-G-3-A",dbId:1224,no:15,toolType:"EXTRACTION JIG G",controlNo:"G",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"15-G-3-B",dbId:1225,no:15,toolType:"EXTRACTION JIG G",controlNo:"G",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"15-W-1-A",dbId:1226,no:15,toolType:"EXTRACTION JIG W",controlNo:"W",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"15-W-1-B",dbId:1227,no:15,toolType:"EXTRACTION JIG W",controlNo:"W",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"15-W-2-A",dbId:1228,no:15,toolType:"EXTRACTION JIG W",controlNo:"W",itemCheck:"Tidak berkarat",shift:"A"},{ id:"15-W-2-B",dbId:1229,no:15,toolType:"EXTRACTION JIG W",controlNo:"W",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"15-W-3-A",dbId:1230,no:15,toolType:"EXTRACTION JIG W",controlNo:"W",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"15-W-3-B",dbId:1231,no:15,toolType:"EXTRACTION JIG W",controlNo:"W",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"15-Y-1-A",dbId:1232,no:15,toolType:"EXTRACTION JIG Y",controlNo:"Y",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"15-Y-1-B",dbId:1233,no:15,toolType:"EXTRACTION JIG Y",controlNo:"Y",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"15-Y-2-A",dbId:1234,no:15,toolType:"EXTRACTION JIG Y",controlNo:"Y",itemCheck:"Tidak berkarat",shift:"A"},{ id:"15-Y-2-B",dbId:1235,no:15,toolType:"EXTRACTION JIG Y",controlNo:"Y",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"15-Y-3-A",dbId:1236,no:15,toolType:"EXTRACTION JIG Y",controlNo:"Y",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"15-Y-3-B",dbId:1237,no:15,toolType:"EXTRACTION JIG Y",controlNo:"Y",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
    { id:"16-X-1-A",dbId:1238,no:16,toolType:"CLIPPER",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"A"},{ id:"16-X-1-B",dbId:1239,no:16,toolType:"CLIPPER",controlNo:"",itemCheck:"Tidak patah / bengkok",shift:"B"},
    { id:"16-X-2-A",dbId:1240,no:16,toolType:"CLIPPER",controlNo:"",itemCheck:"Tidak berkarat",shift:"A"},{ id:"16-X-2-B",dbId:1241,no:16,toolType:"CLIPPER",controlNo:"",itemCheck:"Tidak berkarat",shift:"B"},
    { id:"16-X-3-A",dbId:1242,no:16,toolType:"CLIPPER",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"A"},{ id:"16-X-3-B",dbId:1243,no:16,toolType:"CLIPPER",controlNo:"",itemCheck:"Ada dan sesuai control numbernya",shift:"B"},
  ]

export default function PreAssyGLStatusPage() {
  const { user, loading: authLoading, isInitialized } = useAuth()
  const hasBeenAuthenticated = useRef(false)

  useEffect(() => {
    if (user) hasBeenAuthenticated.current = true
    if (isInitialized && !authLoading && !user && !hasBeenAuthenticated.current) {
      window.location.href = "/login-page"
    }
    if (isInitialized && !authLoading && user &&
        user.role !== "group-leader-qa" && user.role !== "inspector-qa") {
      window.location.href = "/home"
    }
  }, [user, authLoading, isInitialized])

  const allowedViewModes = useMemo(() => ROLE_ACCESS_MAP[user?.role || ""] || [], [user?.role])
  const getDefaultViewMode = useCallback((): ViewMode => allowedViewModes.length === 0 ? "daily" : allowedViewModes[0], [allowedViewModes])

  const [viewMode, setViewMode] = useState(getDefaultViewMode())
  useEffect(() => { if (!allowedViewModes.includes(viewMode)) setViewMode(getDefaultViewMode()) }, [allowedViewModes, viewMode, getDefaultViewMode])

  const [activeMonth, setActiveMonth] = useState(() => new Date().getMonth())
  const [activeYear, setActiveYear]   = useState(() => new Date().getFullYear())
  const [selectedWeek, setSelectedWeek] = useState(1)
  // ✅ FIX Bug 1: Inisialisasi selectedArea langsung dari viewMode awal user
  // (bukan dari "daily" hardcode) agar nilai sudah benar sejak render pertama.
  // getDefaultViewMode() dipanggil di useState sehingga nilainya konsisten
  // dengan viewMode yang pertama kali di-set.
  const [selectedArea, setSelectedArea] = useState("");

  useEffect(() => {
    if (!user || !viewMode) return; 
    
    const defaultArea = DEFAULT_AREA_BY_CATEGORY[VIEW_MODE_CATEGORY_CODE[viewMode]];
    if (defaultArea && defaultArea !== selectedArea) {
      setSelectedArea(defaultArea);
    }
  }, [user, viewMode]); //

  const [selectedSpecificArea, setSelectedSpecificArea] = useState("TENSILE")

  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>({})
  const [glSignaturesGL, setGlSignaturesGL] = useState<Record<string, Record<string, "-" | "☑">>>({})
  const [glSignaturesESO, setGlSignaturesESO] = useState<Record<string, Record<string, "-" | "☑">>>({})

  // ✅ CONVEYOR: menggantikan carlineOptions + selectedCarlineLine
  const [conveyorOptions, setConveyorOptions] = useState<string[]>([])
  const [selectedConveyor, setSelectedConveyor] = useState<string>("")
  const [isFetchingConveyors, setIsFetchingConveyors] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isMobile, setIsMobile] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<number>>(new Set())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    if (isMobile) setExpandedDates(new Set([new Date().getDate()]))
  }, [isMobile, activeMonth, activeYear])

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getMonthName  = (m: number) => ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][m]
  const changeMonth   = (d: number) => {
    let m = activeMonth+d, y = activeYear
    if (m<0) { m=11; y-- } else if (m>11) { m=0; y++ }
    setActiveMonth(m); setActiveYear(y)
  }
  const getDateKey = useCallback((date: number) =>
    `${activeYear}-${String(activeMonth+1).padStart(2,"0")}-${String(date).padStart(2,"0")}`,
  [activeYear, activeMonth])

  const categoryCode = useMemo(() => VIEW_MODE_CATEGORY_CODE[viewMode], [viewMode])

  const TIME_SLOTS = ["01.00","04.00","08.00","13.00","16.00","20.00"]

  const getWeeksInMonth = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    const firstDay = new Date(activeYear, activeMonth, 1).getDay()
    const weeksCount = Math.ceil((daysInMonth + firstDay) / 7)
    const weeks = []
    for (let i=0; i<weeksCount; i++) {
      const weekDays = []
      for (let j=0; j<7; j++) {
        const dayNum = i*7+j-firstDay+1
        if (dayNum >= 1 && dayNum <= daysInMonth) {
          const date = new Date(activeYear, activeMonth, dayNum)
          weekDays.push({ date: dayNum, dayName: date.toLocaleDateString("id-ID",{weekday:"short"}), isWeekend: date.getDay()===0||date.getDay()===6 })
        }
      }
      if (weekDays.length > 0) weeks.push({ weekNum: i+1, days: weekDays })
    }
    return weeks
  }, [activeMonth, activeYear])

  const getWorkDaysByWeek = useMemo(() =>
    getWeeksInMonth.map(w => ({ weekNum: w.weekNum, days: w.days.filter(d => !d.isWeekend) })).filter(w => w.days.length > 0),
  [getWeeksInMonth])

  const getSelectedWeekDays = useMemo(() => {
    if (selectedWeek < 1 || selectedWeek > getWorkDaysByWeek.length) return []
    return getWorkDaysByWeek[selectedWeek-1].days
  }, [selectedWeek, getWorkDaysByWeek])

  const dynamicDates = useMemo(() => Array.from({length: getDaysInMonth(activeYear, activeMonth)}, (_,i) => i+1), [activeMonth, activeYear])
  const today = new Date().getDate(), currentMonth = new Date().getMonth(), currentYear = new Date().getFullYear()
  const isCurrentMonth = activeMonth === currentMonth && activeYear === currentYear

  const filteredDciNos = useMemo(
    () => PRE_ASSY_SPECIFIC_AREA_ITEMS[selectedSpecificArea] || [],
    [selectedSpecificArea]
  )
  const filteredDciCheckpoints = useMemo(
    () => DAILY_CHECK_INS_CHECKPOINTS_FULL.filter(c => filteredDciNos.includes(c.no)),
    [filteredDciNos]
  )
  const filteredDciUnique = useMemo(
    () => Array.from(new Set(filteredDciCheckpoints.map(c => c.no)))
           .map(no => filteredDciCheckpoints.find(c => c.no === no)!)
           .filter(Boolean),
    [filteredDciCheckpoints]
  )

  // ── Fetch conveyor options ───────────────────────────────────────────────────
  //
  // ✅ FIX Bug 1: Pisahkan fungsi fetch agar bisa dipanggil ulang secara
  // imperatif (tidak hanya reaktif via deps). Tambahkan user?.id ke deps
  // sehingga fetch terjadi ulang saat user selesai ter-load, bukan hanya
  // saat selectedArea berubah. Ini menyelesaikan race condition dimana
  // useEffect([selectedArea]) berjalan sebelum user ready.
  //
  // ✅ FIX Bug 2: Kirim specificArea ke backend agar hanya conveyor yang
  // pernah digunakan di specific area tersebut yang dikembalikan.
  // CONV-9 di TENSILE tidak akan muncul di CUTTING/PA/CROSS SECTION.
  const fetchConveyorOptions = useCallback(async (area: string, specArea: string) => {
    if (!area) {
      setConveyorOptions([])
      setSelectedConveyor("")
      setResults({})
      return
    }

    setIsFetchingConveyors(true)

    try {
      // ✅ FIX Bug 2: Kirim specificArea ke backend hanya untuk Daily Check Ins
      // Mode lain (GL, CC Stripping, dll) tidak punya specific area
      const specAreaParam = (viewMode === "daily-check-ins" && specArea)
        ? `&specificArea=${encodeURIComponent(specArea)}`
        : ""
      const url = `/api/pre-assy/get-carline-line?areaCode=${encodeURIComponent(area)}${specAreaParam}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        const conveyors = [
          ...new Set(
            data
              .map((d: any) => String(d.conveyor || d.carline || "").trim().toUpperCase())
              .filter(Boolean)
          )
        ] as string[]
        setConveyorOptions(conveyors)
      }
    } catch {}
    finally { setIsFetchingConveyors(false) }
  // viewMode masuk deps karena menentukan apakah specificArea dikirim atau tidak
  }, [viewMode])

  useEffect(() => {
    setSelectedConveyor("")
    
    setResults({})
    
    fetchConveyorOptions(selectedArea, selectedSpecificArea)
  }, [selectedArea, viewMode, selectedSpecificArea, user?.id, fetchConveyorOptions])

  // ── Load data dari DB ─────────────────────────────────────────────
  const loadDataFromDB = useCallback(async (conveyor: string) => {
    if (!user || !conveyor) return
    setIsLoading(true); setError(null)
    try {
      const monthKey = `${activeYear}-${String(activeMonth+1).padStart(2,"0")}`
      const areaParam = selectedArea ? `&areaCode=${encodeURIComponent(selectedArea)}` : ""

      // ✅ FIX 1: Kirim `conveyor` secara eksplisit — backend get-results (yang sudah
      //    di-fix) menggunakan param ini untuk filter COALESCE(r.conveyor, r.carline).
      //    Juga kirim `carline` sebagai backward compat untuk backend lama.
      //    TIDAK kirim `line` karena akan membuat filter gagal (line="" = falsy).
      const conveyorParam =
        `&conveyor=${encodeURIComponent(conveyor)}` +
        `&carline=${encodeURIComponent(conveyor)}`

      // ✅ FIX 2: Untuk Daily Check Ins, kirim specificArea agar backend memfilter
      //    data hanya untuk specific area yang sedang dipilih.
      //    Tanpa ini, semua data semua specific area dikembalikan sekaligus,
      //    sehingga data TENSILE ikut muncul saat user pilih CUTTING, dsb.
      const specificAreaParam = (categoryCode === "pre-assy-daily-check-ins" && selectedSpecificArea)
        ? `&specificArea=${encodeURIComponent(selectedSpecificArea)}`
        : ""

      const [rRes, sRes] = await Promise.all([
        fetch(`/api/pre-assy/get-results?userId=${user.id}&categoryCode=${categoryCode}&month=${monthKey}${areaParam}${conveyorParam}${specificAreaParam}`),
        fetch(`/api/pre-assy/get-signatures?userId=${user.id}&categoryCode=${categoryCode}&month=${monthKey}${areaParam}`)
      ])
      if (!rRes.ok || !sRes.ok) throw new Error("Gagal memuat data")
      const rData = await rRes.json(), sData = await sRes.json()
      if (rData.success) setResults(rData.formatted)
      if (sData.success) setGlSignaturesGL(sData.formatted)
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat data") }
    finally { setIsLoading(false) }
  // ✅ FIX 3: Tambah selectedSpecificArea ke deps agar reload saat ganti specific area
  }, [user, activeMonth, activeYear, categoryCode, selectedArea, selectedSpecificArea])

  useEffect(() => {
    if (!user?.id || !selectedConveyor) {
      setResults({})
      return
    }
    loadDataFromDB(selectedConveyor)
  // ✅ FIX 4: Tambah selectedSpecificArea ke deps useEffect agar trigger reload
  }, [user?.id, activeMonth, activeYear, viewMode, selectedArea, selectedConveyor, selectedSpecificArea, loadDataFromDB])

  useEffect(() => { setSelectedWeek(1) }, [activeMonth, activeYear])

  // ── Get results helpers ───────────────────────────────────────────
  const getResult = useCallback((date: number, id: number|string, shift: "A"|"B", timeSlot?: string) => {
    const dateKey = getDateKey(date)
    const key = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    return results[dateKey]?.[key] || null
  }, [results, getDateKey])

  const getInspResult = useCallback((date: number, itemNo: number, shift: "A"|"B") => {
    const dateKey = getDateKey(date)
    const key = `${itemNo}-${selectedSpecificArea}-${shift}`
    return results[dateKey]?.[key] || null
  }, [results, getDateKey, selectedSpecificArea])

  const getGLSignature = useCallback((date: number, shift: "A"|"B", type: "gl"|"eso") => {
    const dateKey = getDateKey(date)
    const signatures = type === "gl" ? glSignaturesGL : glSignaturesESO
    return signatures[dateKey]?.[shift] || "-"
  }, [glSignaturesGL, glSignaturesESO, getDateKey])

  // ── NG Modal ─────────────────────────────────────────────────────
  const [photoZoomSrc, setPhotoZoomSrc] = useState<string | null>(null)
  const [ngModal, setNgModal] = useState<{
    status: "NG"; label: string; date: number; shift: "A"|"B";
    ngDescription: string; ngDepartment: string; submittedBy: string; submittedAt: string;
    isDCI?: boolean; dciItemCheck?: string; dciArea?: string; dciConveyor?: string;
    dciNgChoices?: string[]; dciOtherNote?: string; dciPhotos?: string[]; dciGaugeId?: string|null;
  } | null>(null)

  const renderStatusCell = useCallback((date: number, checkpoint: any, timeSlot?: string) => {
    const id = checkpoint.id, shift = checkpoint.shift
    const baseId = Math.floor(id)
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${baseId}-${shift}-${timeSlot}` : `${baseId}-${shift}`
    const status = results[dateKey]?.[itemKey]?.status || "-"
    const result = results[dateKey]?.[itemKey]
    if (status === "NG") {
      return <span className="status-badge status-badge-ng"
        style={{display:"inline-block",width:"100%",backgroundColor:"#f44336",color:"white",padding:"4px 8px",borderRadius:4,fontWeight:500,fontSize:12,textAlign:"center",cursor:"pointer"}}
        onClick={() => setNgModal({ status:"NG", label: checkpoint.checkPoint||checkpoint.machine||String(id), date, shift, ngDescription: result?.ngDescription||"", ngDepartment: result?.ngDepartment||"", submittedBy: result?.submittedBy||"", submittedAt: result?.submittedAt||"" })}>✗ NG</span>
    }
    if (status === "OK") return <span className="status-badge status-badge-ok" style={{display:"inline-block",width:"100%",backgroundColor:"#4caf50",color:"white",padding:"4px 8px",borderRadius:4,fontWeight:500,fontSize:12,textAlign:"center"}}>✓ OK</span>
    return <span style={{color:"#9e9e9e",fontSize:12}}>-</span>
  }, [results, getDateKey])

  const renderStatusCellDailyCheckIns = useCallback((date: number, itemNo: number, shift: "A"|"B", itemCheck: string) => {
    const result = getInspResult(date, itemNo, shift)
    const status = result?.status || "-"
    if (status === "NG") {
      let dciNgChoices: string[] = [], dciOtherNote = "", dciPhotos: string[] = []
      try { const p=JSON.parse(result?.ngDescription||"{}"); if(Array.isArray(p))dciNgChoices=p; else if(p&&typeof p==="object"){dciNgChoices=Array.isArray(p.choices)?p.choices:[];dciOtherNote=p.other||"";} } catch { if(result?.ngDescription)dciNgChoices=[result.ngDescription] }
      try { const pp=JSON.parse(result?.ngPhotos||"[]"); if(Array.isArray(pp))dciPhotos=pp; } catch {}
      return <span className="status-badge status-badge-ng" style={{display:"inline-block",width:"100%",backgroundColor:"#f44336",color:"white",padding:"4px 8px",borderRadius:4,fontWeight:500,fontSize:12,textAlign:"center",cursor:"pointer"}}
        onClick={() => setNgModal({status:"NG",label:itemCheck,date,shift,ngDescription:result?.ngDescription||"",ngDepartment:result?.ngDepartment||"",submittedBy:result?.submittedBy||"",submittedAt:result?.submittedAt||"",isDCI:true,dciItemCheck:itemCheck,dciArea:selectedArea,dciConveyor:selectedConveyor,dciNgChoices,dciOtherNote,dciPhotos})}>✗ NG</span>
    }
    if (status === "OK") return <span className="status-badge status-badge-ok" style={{display:"inline-block",width:"100%",backgroundColor:"#4caf50",color:"white",padding:"4px 8px",borderRadius:4,fontWeight:500,fontSize:12,textAlign:"center"}}>✓ OK</span>
    return <span style={{color:"#9e9e9e"}}>-</span>
  }, [getInspResult, selectedArea, selectedConveyor])

  const renderCSRemoveCellByNoShift = useCallback((date: number, no: number, shift: "A"|"B", toolType: string) => {
    const dateKey = getDateKey(date)
    const dateResults = results[dateKey] || {}
    const matchingItems = CS_REMOVE_TOOL_ITEMS_FULL.filter(it => it.no === no && it.shift === shift)
    const matchingResults = matchingItems.map(it => dateResults[it.id]).filter(Boolean)

    if (matchingResults.length === 0) return <span style={{color:"#9e9e9e"}}>-</span>

    const ngResults = matchingResults.filter(r => r?.status === "NG")
    if (ngResults.length > 0) {
      const allNgChoices: string[] = []
      let firstNgResult = ngResults[0]
      ngResults.forEach(r => {
        try {
          const p = JSON.parse(r?.ngDescription || "{}")
          if (Array.isArray(p.choices)) allNgChoices.push(...p.choices)
          else if (Array.isArray(p)) allNgChoices.push(...p)
          else if (r?.ngDescription) allNgChoices.push(r.ngDescription)
        } catch { if (r?.ngDescription) allNgChoices.push(r.ngDescription) }
      })
      let crtPhotos: string[] = []
      try { const pp = JSON.parse(firstNgResult?.ngPhotos || "[]"); if (Array.isArray(pp)) crtPhotos = pp } catch {}
      return (
        <span className="status-badge status-badge-ng"
          style={{display:"inline-block",width:"100%",backgroundColor:"#f44336",color:"white",padding:"4px 8px",borderRadius:4,fontWeight:500,fontSize:12,textAlign:"center",cursor:"pointer"}}
          onClick={() => setNgModal({status:"NG",label:toolType,date,shift,ngDescription:firstNgResult?.ngDescription||"",ngDepartment:firstNgResult?.ngDepartment||"",submittedBy:firstNgResult?.submittedBy||"",submittedAt:firstNgResult?.submittedAt||"",isDCI:true,dciItemCheck:toolType,dciArea:firstNgResult?.areaCode||"",dciConveyor:selectedConveyor,dciNgChoices:allNgChoices,dciPhotos:crtPhotos})}>
          ✗ NG
        </span>
      )
    }

    return <span className="status-badge status-badge-ok" style={{display:"inline-block",width:"100%",backgroundColor:"#4caf50",color:"white",padding:"4px 8px",borderRadius:4,fontWeight:500,fontSize:12,textAlign:"center"}}>✓ OK</span>
  }, [results, getDateKey, selectedConveyor])

  if (authLoading || !isInitialized || !user) return null

  // ── Checkpoint data ───────────────────────────────────────────────
  const DAILY_CHECKPOINTS: DailyCheckPoint[] = [
    { id: 1,   checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", standard: "Check pengisian C/S 4M", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 1.1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", standard: "Check pengisian C/S 4M", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 2,   checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 2.1, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 3,   checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", standard: "      ", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 3.1, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", standard: "      ", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 4,   checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian...", standard: "Sesuai IS no. QA-ACL-PA-IS-031", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 4.1, checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian...", standard: "Sesuai IS no. QA-ACL-PA-IS-031", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 5,   checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 5.1, checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 6,   checkPoint: "Circuit di supply dan di letakan di store sesuai dengan address...", standard: "Sampling check circuit yang ada di store", shift: "A", waktuCheck: "Setiap Senin & Kamis" },
    { id: 6.1, checkPoint: "Circuit di supply dan di letakan di store sesuai dengan address...", standard: "Sampling check circuit yang ada di store", shift: "B", waktuCheck: "Setiap Senin & Kamis" },
    { id: 7,   checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly...", standard: "Check kondisi actual (sampling check min. 3 inspector)", shift: "A", waktuCheck: "Setiap Senin & Kamis" },
    { id: 7.1, checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly...", standard: "Check kondisi actual (sampling check min. 3 inspector)", shift: "B", waktuCheck: "Setiap Senin & Kamis" },
    { id: 8,   checkPoint: "Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan...", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "A", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 8.1, checkPoint: "Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan...", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "B", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 9,   checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "A", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 9.1, checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "B", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 10,  checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "A", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 10.1,checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "B", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 11,  checkPoint: "Tidak ada bagian trolly inspector yang rusak", standard: "Check kondisi actual", shift: "A", waktuCheck: "1 Inspector / Minggu" },
    { id: 11.1,checkPoint: "Tidak ada bagian trolly inspector yang rusak", standard: "Check kondisi actual", shift: "B", waktuCheck: "1 Inspector / Minggu" },
    { id: 12,  checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", standard: "Check actual dengan SWCT", shift: "A", waktuCheck: "1 Inspector / Minggu" },
    { id: 12.1,checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", standard: "Check actual dengan SWCT", shift: "B", waktuCheck: "1 Inspector / Minggu" },
    { id: 13,  checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu...", standard: "Check kondisi actual", shift: "A", waktuCheck: "Setiap Selasa" },
    { id: 13.1,checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu...", standard: "Check kondisi actual", shift: "B", waktuCheck: "Setiap Selasa" },
    { id: 14,  checkPoint: "Memastikan semua inspector menggunakan penutup kepala...", standard: "Check kondisi actual", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 14.1,checkPoint: "Memastikan semua inspector menggunakan penutup kepala...", standard: "Check kondisi actual", shift: "B", waktuCheck: "Setiap Hari" },
  ]

  const CC_STRIPPING_CHECKPOINTS: CcStrippingCheckPoint[] = [
    { id: 1,   machine:"AC90 TRX 01", kind:"IA-CIVUS", size:"0.13", shift:"A" },
    { id: 1.1, machine:"AC90 TRX 01", kind:"IA-CIVUS", size:"0.13", shift:"B" },
    { id: 2,   machine:"AC90 TRX 02", kind:"IA-CIVUS", size:"0.13", shift:"A" },
    { id: 2.1, machine:"AC90 TRX 02", kind:"IA-CIVUS", size:"0.13", shift:"B" },
    { id: 3,   machine:"AC90 TRX 03", kind:"IA-CIVUS", size:"0.13", shift:"A" },
    { id: 3.1, machine:"AC90 TRX 03", kind:"IA-CIVUS", size:"0.13", shift:"B" },
    { id: 4,   machine:"AC90 TRX 04", kind:"CIVUS",    size:"0.35", shift:"A" },
    { id: 4.1, machine:"AC90 TRX 04", kind:"CIVUS",    size:"0.35", shift:"B" },
    { id: 5,   machine:"AC90 TRX 05", kind:"AVSS",     size:"2.0",  shift:"A" },
    { id: 5.1, machine:"AC90 TRX 05", kind:"AVSS",     size:"2.0",  shift:"B" },
    { id: 6,   machine:"AC90 TRX 06", kind:"ALVUS",    size:"2.0",  shift:"A" },
    { id: 6.1, machine:"AC90 TRX 06", kind:"ALVUS",    size:"2.0",  shift:"B" },
    { id: 7,   machine:"AC90 TRX 06", kind:"ALVUS",    size:"2.5",  shift:"A" },
    { id: 7.1, machine:"AC90 TRX 06", kind:"ALVUS",    size:"2.5",  shift:"B" },
    { id: 8,   machine:"AC90 TRX 07", kind:"ALVUS",    size:"0.75", shift:"A" },
    { id: 8.1, machine:"AC90 TRX 07", kind:"ALVUS",    size:"0.75", shift:"B" },
    { id: 9,   machine:"AC90 TRX 07", kind:"ALVUS",    size:"1.25", shift:"A" },
    { id: 9.1, machine:"AC90 TRX 07", kind:"ALVUS",    size:"1.25", shift:"B" },
    { id: 10,  machine:"AC90 TRX 08", kind:"ALVUS",    size:"0.5",  shift:"A" },
    { id: 10.1,machine:"AC90 TRX 08", kind:"ALVUS",    size:"0.5",  shift:"B" },
    { id: 11,  machine:"AC90 TRX 08", kind:"ALVUS",    size:"0.75", shift:"A" },
    { id: 11.1,machine:"AC90 TRX 08", kind:"ALVUS",    size:"0.75", shift:"B" },
    { id: 12,  machine:"AC90 TRX 09", kind:"ALVUS",    size:"0.5",  shift:"A" },
    { id: 12.1,machine:"AC90 TRX 09", kind:"ALVUS",    size:"0.5",  shift:"B" },
    { id: 13,  machine:"AC90 TRX 10", kind:"CAVS",     size:"0.3",  shift:"A" },
    { id: 13.1,machine:"AC90 TRX 10", kind:"CAVS",     size:"0.3",  shift:"B" },
    { id: 14,  machine:"AC90 TRX 10", kind:"CAVS",     size:"0.5",  shift:"A" },
    { id: 14.1,machine:"AC90 TRX 10", kind:"CAVS",     size:"0.5",  shift:"B" },
    { id: 15,  machine:"AC90 TRX 10", kind:"CAVS",     size:"0.85", shift:"A" },
    { id: 15.1,machine:"AC90 TRX 10", kind:"CAVS",     size:"0.85", shift:"B" },
    { id: 16,  machine:"AC90 TRX 10", kind:"AESSX",    size:"0.3",  shift:"A" },
    { id: 16.1,machine:"AC90 TRX 10", kind:"AESSX",    size:"0.3",  shift:"B" },
    { id: 17,  machine:"AC90 TRX 10", kind:"CIVUS",    size:"0.35", shift:"A" },
    { id: 17.1,machine:"AC90 TRX 10", kind:"CIVUS",    size:"0.35", shift:"B" },
  ]

  const CS_REMOVE_TOOL_UNIQUE_GROUPS = [
    { no:1,  toolType:"1-150A"          }, { no:2,  toolType:"PA"               },
    { no:3,  toolType:"DLI"             }, { no:4,  toolType:"CNR"              },
    { no:5,  toolType:"TCNR"            }, { no:6,  toolType:"1-72A"            },
    { no:7,  toolType:"1-114"           }, { no:8,  toolType:"1-42A"            },
    { no:9,  toolType:"1-35"            }, { no:10, toolType:"1-85"             },
    { no:11, toolType:"1-83A"           }, { no:12, toolType:"1-73"             },
    { no:13, toolType:"1-105"           }, { no:14, toolType:"TLC"              },
    { no:15, toolType:"EXTRACTION JIG R"}, { no:16, toolType:"EXTRACTION JIG G" },
    { no:17, toolType:"EXTRACTION JIG W"}, { no:18, toolType:"EXTRACTION JIG Y" },
    { no:19, toolType:"CLIPPER"         },
  ]

  const PRESSURE_JIG_CHECKPOINTS: PressureJigCheckPoint[] = [
    { id:1,   checkPoint:"Apakah pressure jig diletakkan sesuai dengan tempatnya.", shift:"A", frequency:"1x /Hari",  judge:"O/X" },
    { id:1.1, checkPoint:"Apakah pressure jig diletakkan sesuai dengan tempatnya.", shift:"B", frequency:"1x /Hari",  judge:"O/X" },
    { id:2,   checkPoint:"Tidak ada pressure jig yang hilang.", shift:"A", frequency:"1x /Hari",  judge:"O/X" },
    { id:2.1, checkPoint:"Tidak ada pressure jig yang hilang.", shift:"B", frequency:"1x /Hari",  judge:"O/X" },
    { id:3,   checkPoint:"Tidak ada pressure jig yang rusak/bent/damage.", shift:"A", frequency:"1x /Hari",  judge:"O/X" },
    { id:3.1, checkPoint:"Tidak ada pressure jig yang rusak/bent/damage.", shift:"B", frequency:"1x /Hari",  judge:"O/X" },
    { id:4,   checkPoint:"Apakah pin dari contact pressure jig bisa digunakan dengan mudah.", shift:"A", frequency:"1x /Hari",  judge:"O/X" },
    { id:4.1, checkPoint:"Apakah pin dari contact pressure jig bisa digunakan dengan mudah.", shift:"B", frequency:"1x /Hari",  judge:"O/X" },
    { id:5,   checkPoint:"Tidak ada identitas warna tape pada pressure jig yang terkelupas.", shift:"A", frequency:"1x /Hari",  judge:"O/X" },
    { id:5.1, checkPoint:"Tidak ada identitas warna tape pada pressure jig yang terkelupas.", shift:"B", frequency:"1x /Hari",  judge:"O/X" },
    { id:6,   checkPoint:"Tidak ada jig yang tidak diperlukan di area proses.", shift:"A", frequency:"1x /Hari",  judge:"O/X" },
    { id:6.1, checkPoint:"Tidak ada jig yang tidak diperlukan di area proses.", shift:"B", frequency:"1x /Hari",  judge:"O/X" },
    { id:7,   checkPoint:"Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift:"A", frequency:"1x /Bulan", judge:"   " },
    { id:7.1, checkPoint:"Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift:"B", frequency:"1x /Bulan", judge:"   " },
  ]

  // ── Mobile card renderer ──────────────────────────────────────────
  const renderMobileCards = () => {
    const dayNames = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"]

    if (viewMode === "cc-stripping") {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {getSelectedWeekDays.map(day => {
            const dow = new Date(activeYear, activeMonth, day.date).getDay()
            const dayName = dayNames[dow]
            const isToday = isCurrentMonth && day.date === today
            const hasNG = CC_STRIPPING_CHECKPOINTS.some(cp =>
              TIME_SLOTS.some(ts => getResult(day.date, Math.floor(cp.id), cp.shift, ts)?.status === "NG")
            )
            const hasData = CC_STRIPPING_CHECKPOINTS.some(cp =>
              TIME_SLOTS.some(ts => { const r = getResult(day.date, Math.floor(cp.id), cp.shift, ts); return r && r.status !== "-"; })
            )
            const isExpanded = expandedDates.has(day.date)
            return (
              <div key={day.date} style={{border: hasNG?"2px solid #ef4444":isToday?"2px solid #f59e0b":"1px solid #e2e8f0", borderRadius:12, background:isToday?"#fffbeb":hasData?"white":"#f8fafc", overflow:"hidden"}}>
                <div onClick={() => setExpandedDates(prev => { const n=new Set(prev); n.has(day.date)?n.delete(day.date):n.add(day.date); return n; })}
                  style={{display:"flex",alignItems:"center",padding:"10px 14px",cursor:"pointer",gap:10,background:isToday?"#fef3c7":hasNG?"#fef2f2":hasData?"#f0f9ff":"#f8fafc"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:38,height:38,background:isToday?"#f59e0b":hasNG?"#ef4444":hasData?"#1e88e5":"#94a3b8",borderRadius:8,justifyContent:"center",flexShrink:0}}>
                    <span style={{color:"white",fontSize:15,fontWeight:800,lineHeight:1}}>{day.date}</span>
                    <span style={{color:"rgba(255,255,255,0.85)",fontSize:9,fontWeight:600,lineHeight:1}}>{dayName}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:isToday?"#92400e":hasNG?"#b91c1c":hasData?"#1e3a8a":"#64748b"}}>{isToday?"📅 Hari Ini":`${day.dayName} ${day.date}`}</div>
                    {hasNG && <div style={{fontSize:11,color:"#ef4444",fontWeight:600}}>⚠️ Ada temuan NG</div>}
                    {!hasData && <div style={{fontSize:11,color:"#94a3b8"}}>Belum ada data</div>}
                    {hasData && !hasNG && <div style={{fontSize:11,color:"#10b981",fontWeight:600}}>✓ Semua OK</div>}
                  </div>
                  <span style={{color:"#94a3b8",fontSize:14,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
                </div>
                {isExpanded && (
                  <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                    {Array.from({length:17},(_,i)=>i+1).map(id => {
                      const cpA = CC_STRIPPING_CHECKPOINTS.find(c => c.id===id && c.shift==="A")
                      if (!cpA) return null
                      return (
                        <div key={id}>
                          <div style={{fontSize:11,fontWeight:700,color:"#1e3a8a",marginBottom:4,padding:"4px 8px",background:"#f0f9ff",borderRadius:6}}>
                            {cpA.machine} — {cpA.kind} {cpA.size}
                          </div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {TIME_SLOTS.map(ts => {
                              const stA = getResult(day.date, id, "A", ts)?.status || "-"
                              const stB = getResult(day.date, id+0.1, "B", ts)?.status || "-"
                              const rA = getResult(day.date, id, "A", ts)
                              const rB = getResult(day.date, id+0.1, "B", ts)
                              return (
                                <div key={ts} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"#f8fafc",borderRadius:6,padding:"4px 6px",border:"1px solid #e2e8f0",minWidth:52}}>
                                  <span style={{fontSize:9,color:"#64748b",fontWeight:700}}>{ts}</span>
                                  <div style={{display:"flex",gap:3}}>
                                    {([["A",stA,rA],["B",stB,rB]] as [string,string,any][]).map(([sh,st,r]) => (
                                      <div key={sh} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                                        <span style={{fontSize:8,color:"#94a3b8"}}>{sh}</span>
                                        <span onClick={st==="NG"&&r?()=>setNgModal({status:"NG",label:`${cpA.machine} ${cpA.kind} ${cpA.size}`,date:day.date,shift:sh as "A"|"B",ngDescription:r?.ngDescription||"",ngDepartment:r?.ngDepartment||"",submittedBy:r?.submittedBy||"",submittedAt:r?.submittedAt||""}):undefined}
                                          style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:18,borderRadius:4,fontSize:10,fontWeight:700,color:"white",cursor:st==="NG"?"pointer":"default",background:st==="OK"?"#22c55e":st==="NG"?"#ef4444":"#d1d5db"}}>
                                          {st==="OK"?"✓":st==="NG"?"✗":"-"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    if (viewMode === "daily-check-ins") {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {/* Conveyor badge mobile */}
          {selectedConveyor && (
            <div style={{padding:"8px 12px",background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,fontSize:12,color:"#92400e",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
              <span>🏭</span><span>Conveyor: <strong>{selectedConveyor}</strong></span>
            </div>
          )}
          {dynamicDates.map(date => {
            const dow = new Date(activeYear, activeMonth, date).getDay()
            const dayName = dayNames[dow]
            const isToday = isCurrentMonth && date === today
            const hasNG = filteredDciNos.some(no =>
              (["A","B"] as const).some(sh => getInspResult(date, no, sh)?.status === "NG")
            )
            const hasData = filteredDciNos.some(no =>
              (["A","B"] as const).some(sh => { const r = getInspResult(date, no, sh); return r && r.status !== "-"; })
            )
            const isExpanded = expandedDates.has(date)
            return (
              <div key={date} style={{border:hasNG?"2px solid #ef4444":isToday?"2px solid #f59e0b":"1px solid #e2e8f0",borderRadius:12,background:isToday?"#fffbeb":hasData?"white":"#f8fafc",overflow:"hidden",opacity:hasData?1:0.7}}>
                <div onClick={() => setExpandedDates(prev => { const n=new Set(prev); n.has(date)?n.delete(date):n.add(date); return n; })}
                  style={{display:"flex",alignItems:"center",padding:"10px 14px",cursor:"pointer",gap:10,background:isToday?"#fef3c7":hasNG?"#fef2f2":hasData?"#f0f9ff":"#f8fafc"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:38,height:38,background:isToday?"#f59e0b":hasNG?"#ef4444":hasData?"#1e88e5":"#94a3b8",borderRadius:8,justifyContent:"center",flexShrink:0}}>
                    <span style={{color:"white",fontSize:15,fontWeight:800,lineHeight:1}}>{date}</span>
                    <span style={{color:"rgba(255,255,255,0.85)",fontSize:9,fontWeight:600,lineHeight:1}}>{dayName}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:isToday?"#92400e":hasNG?"#b91c1c":hasData?"#1e3a8a":"#64748b"}}>{isToday?"📅 Hari Ini":`${date} ${getMonthName(activeMonth)}`}</div>
                    {hasNG && <div style={{fontSize:11,color:"#ef4444",fontWeight:600}}>⚠️ Ada temuan NG</div>}
                    {!hasData && <div style={{fontSize:11,color:"#94a3b8"}}>Belum ada data</div>}
                    {hasData && !hasNG && <div style={{fontSize:11,color:"#10b981",fontWeight:600}}>✓ Semua OK</div>}
                  </div>
                  <span style={{color:"#94a3b8",fontSize:14,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
                </div>
                {isExpanded && (
                  <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                    {filteredDciUnique.map(item => {
                      const rA = getInspResult(date, item.no, "A")
                      const rB = getInspResult(date, item.no, "B")
                      const stA = rA?.status || "-"
                      const stB = rB?.status || "-"
                      const isNG = stA === "NG" || stB === "NG"
                      return (
                        <div key={item.no} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:isNG?"#fef2f2":"#f8fafc",borderRadius:8,border:isNG?"1px solid #fca5a5":"1px solid #e2e8f0"}}>
                          <span style={{fontSize:11,color:"#64748b",fontWeight:700,minWidth:20,flexShrink:0}}>{item.no}.</span>
                          <span style={{flex:1,fontSize:12,fontWeight:600,color:"#1e293b",lineHeight:1.3}}>{item.itemCheck}</span>
                          <div style={{display:"flex",gap:4,flexShrink:0}}>
                            {(["A","B"] as const).map(sh => {
                              const r = sh === "A" ? rA : rB
                              const st = sh === "A" ? stA : stB
                              let ngChoices: string[] = [], dciOtherNote = "", dciPhotos: string[] = []
                              if (st === "NG" && r) {
                                try { const p=JSON.parse(r.ngDescription||"{}"); if(Array.isArray(p))ngChoices=p; else if(p&&typeof p==="object"){ngChoices=Array.isArray(p.choices)?p.choices:[];dciOtherNote=p.other||"";} } catch {}
                                try { const pp=JSON.parse(r.ngPhotos||"[]"); if(Array.isArray(pp)) dciPhotos=pp; } catch {}
                              }
                              return (
                                <div key={sh} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                  <span style={{fontSize:9,color:"#64748b",fontWeight:700}}>{sh}</span>
                                  <span
                                    onClick={st==="NG"&&r?()=>setNgModal({status:"NG",label:item.itemCheck,date,shift:sh,ngDescription:r.ngDescription||"",ngDepartment:r.ngDepartment||"",submittedBy:r.submittedBy||"",submittedAt:r.submittedAt||"",isDCI:true,dciItemCheck:item.itemCheck,dciArea:selectedArea,dciConveyor:selectedConveyor,dciNgChoices:ngChoices,dciOtherNote,dciPhotos}):undefined}
                                    style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:36,height:22,borderRadius:5,fontSize:11,fontWeight:700,color:"white",cursor:st==="NG"?"pointer":"default",background:st==="OK"?"#22c55e":st==="NG"?"#ef4444":"#d1d5db"}}>
                                    {st==="OK"?"✓":st==="NG"?"✗":"-"}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    if (viewMode === "cs-remove-tool") {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {dynamicDates.map(date => {
            const dow = new Date(activeYear, activeMonth, date).getDay()
            const dayName = dayNames[dow]
            const isToday = isCurrentMonth && date === today
            const hasNG = CS_REMOVE_TOOL_UNIQUE_GROUPS.some(g => {
              const dateKey = getDateKey(date)
              return Object.keys(results[dateKey]||{}).some(k => k.startsWith(`${g.no}-`) && results[dateKey][k]?.status === "NG")
            })
            const hasData = CS_REMOVE_TOOL_UNIQUE_GROUPS.some(g => {
              const dateKey = getDateKey(date)
              return Object.keys(results[dateKey]||{}).some(k => k.startsWith(`${g.no}-`))
            })
            const isExpanded = expandedDates.has(date)
            return (
              <div key={date} style={{border:hasNG?"2px solid #ef4444":isToday?"2px solid #f59e0b":"1px solid #e2e8f0",borderRadius:12,background:isToday?"#fffbeb":hasData?"white":"#f8fafc",overflow:"hidden",opacity:hasData?1:0.7}}>
                <div onClick={() => setExpandedDates(prev => { const n=new Set(prev); n.has(date)?n.delete(date):n.add(date); return n; })}
                  style={{display:"flex",alignItems:"center",padding:"10px 14px",cursor:"pointer",gap:10,background:isToday?"#fef3c7":hasNG?"#fef2f2":hasData?"#f0f9ff":"#f8fafc"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:38,height:38,background:isToday?"#f59e0b":hasNG?"#ef4444":hasData?"#1e88e5":"#94a3b8",borderRadius:8,justifyContent:"center",flexShrink:0}}>
                    <span style={{color:"white",fontSize:15,fontWeight:800,lineHeight:1}}>{date}</span>
                    <span style={{color:"rgba(255,255,255,0.85)",fontSize:9,fontWeight:600,lineHeight:1}}>{dayName}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:isToday?"#92400e":hasNG?"#b91c1c":hasData?"#1e3a8a":"#64748b"}}>{isToday?"📅 Hari Ini":`${date} ${getMonthName(activeMonth)}`}</div>
                    {hasNG && <div style={{fontSize:11,color:"#ef4444",fontWeight:600}}>⚠️ Ada temuan NG</div>}
                    {!hasData && <div style={{fontSize:11,color:"#94a3b8"}}>Belum ada data</div>}
                    {hasData && !hasNG && <div style={{fontSize:11,color:"#10b981",fontWeight:600}}>✓ Semua OK</div>}
                  </div>
                  <span style={{color:"#94a3b8",fontSize:14,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
                </div>
                {isExpanded && (
                  <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                    {CS_REMOVE_TOOL_UNIQUE_GROUPS.map(g => {
                      const matchingItemsA = CS_REMOVE_TOOL_ITEMS_FULL.filter(it => it.no === g.no && it.shift === "A")
                      const matchingItemsB = CS_REMOVE_TOOL_ITEMS_FULL.filter(it => it.no === g.no && it.shift === "B")
                      const dateKey = getDateKey(date)
                      const dateResults = results[dateKey] || {}

                      const getAggStatus = (items: CSRemoveToolItem[]) => {
                        const matched = items.map(it => dateResults[it.id]).filter(Boolean)
                        if (matched.length === 0) return { st: "-", r: null, ngChoices: [] as string[], photos: [] as string[] }
                        const ngR = matched.find(r => r?.status === "NG")
                        if (ngR) {
                          let ngChoices: string[] = []
                          try { const p=JSON.parse(ngR.ngDescription||"{}"); if(Array.isArray(p.choices))ngChoices=p.choices; else if(Array.isArray(p))ngChoices=p; else if(ngR.ngDescription)ngChoices=[ngR.ngDescription] } catch {}
                          let photos: string[] = []
                          try { const pp=JSON.parse(ngR.ngPhotos||"[]"); if(Array.isArray(pp))photos=pp } catch {}
                          return { st: "NG", r: ngR, ngChoices, photos }
                        }
                        return { st: "OK", r: matched[0], ngChoices: [], photos: [] }
                      }

                      const aggA = getAggStatus(matchingItemsA)
                      const aggB = getAggStatus(matchingItemsB)
                      const hasNGTool = aggA.st === "NG" || aggB.st === "NG"
                      const hasDataTool = aggA.st !== "-" || aggB.st !== "-"

                      return (
                        <div key={g.no} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:hasNGTool?"#fef2f2":"#f8fafc",borderRadius:8,border:hasNGTool?"1px solid #fca5a5":"1px solid #e2e8f0",opacity:hasDataTool?1:0.6}}>
                          <span style={{fontSize:11,color:"#64748b",fontWeight:700,minWidth:20,flexShrink:0}}>{g.no}.</span>
                          <span style={{flex:1,fontSize:12,fontWeight:600,color:"#1e293b"}}>{g.toolType}</span>
                          <div style={{display:"flex",gap:4,flexShrink:0}}>
                            {(["A","B"] as const).map(sh => {
                              const agg = sh === "A" ? aggA : aggB
                              return (
                                <div key={sh} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                  <span style={{fontSize:9,color:"#64748b",fontWeight:700}}>{sh}</span>
                                  <span
                                    onClick={agg.st==="NG"&&agg.r?()=>setNgModal({status:"NG",label:g.toolType,date,shift:sh,ngDescription:agg.r!.ngDescription||"",ngDepartment:agg.r!.ngDepartment||"",submittedBy:agg.r!.submittedBy||"",submittedAt:agg.r!.submittedAt||"",isDCI:true,dciItemCheck:g.toolType,dciArea:selectedArea,dciConveyor:selectedConveyor,dciNgChoices:agg.ngChoices,dciPhotos:agg.photos}):undefined}
                                    style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:36,height:22,borderRadius:5,fontSize:11,fontWeight:700,color:"white",cursor:agg.st==="NG"?"pointer":"default",background:agg.st==="OK"?"#22c55e":agg.st==="NG"?"#ef4444":"#d1d5db"}}>
                                    {agg.st==="OK"?"✓":agg.st==="NG"?"✗":"-"}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    // Pressure Jig & Daily GL
    const items = viewMode === "pressure-jig"
      ? Array.from({length:7},(_,i)=>i+1).map(id => {
          const cp = PRESSURE_JIG_CHECKPOINTS.find(c => c.id===id && c.shift==="A")
          return { id, label: cp?.checkPoint || "" }
        })
      : Array.from({length:14},(_,i)=>i+1).map(id => {
          const cp = DAILY_CHECKPOINTS.find(c => c.id===id && c.shift==="A")
          return { id, label: cp?.checkPoint || "" }
        })

    return (
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {dynamicDates.map(date => {
          const dow = new Date(activeYear, activeMonth, date).getDay()
          const dayName = dayNames[dow]
          const isToday = isCurrentMonth && date === today
          const hasNG = items.some(it => getResult(date,it.id,"A")?.status==="NG" || getResult(date,it.id+0.1,"B")?.status==="NG")
          const hasData = items.some(it => {
            const rA = getResult(date,it.id,"A"), rB = getResult(date,it.id+0.1,"B")
            return (rA&&rA.status!=="-")||(rB&&rB.status!=="-")
          })
          const isExpanded = expandedDates.has(date)
          return (
            <div key={date} style={{border:hasNG?"2px solid #ef4444":isToday?"2px solid #f59e0b":"1px solid #e2e8f0",borderRadius:12,background:isToday?"#fffbeb":hasData?"white":"#f8fafc",overflow:"hidden",opacity:hasData?1:0.7}}>
              <div onClick={() => setExpandedDates(prev => { const n=new Set(prev); n.has(date)?n.delete(date):n.add(date); return n; })}
                style={{display:"flex",alignItems:"center",padding:"10px 14px",cursor:"pointer",gap:10,background:isToday?"#fef3c7":hasNG?"#fef2f2":hasData?"#f0f9ff":"#f8fafc"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:38,height:38,background:isToday?"#f59e0b":hasNG?"#ef4444":hasData?"#1e88e5":"#94a3b8",borderRadius:8,justifyContent:"center",flexShrink:0}}>
                  <span style={{color:"white",fontSize:15,fontWeight:800,lineHeight:1}}>{date}</span>
                  <span style={{color:"rgba(255,255,255,0.85)",fontSize:9,fontWeight:600,lineHeight:1}}>{dayName}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:isToday?"#92400e":hasNG?"#b91c1c":hasData?"#1e3a8a":"#64748b"}}>{isToday?"📅 Hari Ini":`${date} ${getMonthName(activeMonth)}`}</div>
                  {hasNG && <div style={{fontSize:11,color:"#ef4444",fontWeight:600}}>⚠️ Ada temuan NG</div>}
                  {!hasData && <div style={{fontSize:11,color:"#94a3b8"}}>Belum ada data</div>}
                  {hasData && !hasNG && <div style={{fontSize:11,color:"#10b981",fontWeight:600}}>✓ Semua OK</div>}
                </div>
                <span style={{color:"#94a3b8",fontSize:14,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
              </div>
              {isExpanded && (
                <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                  {items.map(it => {
                    const rA = getResult(date,it.id,"A"), rB = getResult(date,it.id+0.1,"B")
                    const stA = rA?.status||"-", stB = rB?.status||"-"
                    const isNG = stA==="NG"||stB==="NG"
                    return (
                      <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:isNG?"#fef2f2":"#f8fafc",borderRadius:8,border:isNG?"1px solid #fca5a5":"1px solid #e2e8f0"}}>
                        <span style={{fontSize:11,color:"#64748b",fontWeight:700,minWidth:20,flexShrink:0}}>{it.id}.</span>
                        <span style={{flex:1,fontSize:11,fontWeight:500,color:"#1e293b",lineHeight:1.3}}>{it.label}</span>
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          {(["A","B"] as const).map(sh => {
                            const r = sh==="A"?rA:rB, st = sh==="A"?stA:stB
                            const cpId = sh==="A"?it.id:it.id+0.1
                            const cpLabel = viewMode==="pressure-jig" ? PRESSURE_JIG_CHECKPOINTS.find(c=>c.id===cpId)?.checkPoint : DAILY_CHECKPOINTS.find(c=>c.id===cpId)?.checkPoint
                            return (
                              <div key={sh} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                <span style={{fontSize:9,color:"#64748b",fontWeight:700}}>{sh}</span>
                                <span onClick={st==="NG"&&r?()=>setNgModal({status:"NG",label:cpLabel||it.label,date,shift:sh,ngDescription:r.ngDescription||"",ngDepartment:r.ngDepartment||"",submittedBy:r.submittedBy||"",submittedAt:r.submittedAt||""}):undefined}
                                  style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:36,height:22,borderRadius:5,fontSize:11,fontWeight:700,color:"white",cursor:st==="NG"?"pointer":"default",background:st==="OK"?"#22c55e":st==="NG"?"#ef4444":"#d1d5db"}}>
                                  {st==="OK"?"✓":st==="NG"?"✗":"-"}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {viewMode === "daily" && (
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#f0fdf4",borderRadius:8,border:"1px solid #86efac",marginTop:4}}>
                      <span style={{flex:1,fontSize:11,fontWeight:600,color:"#166534"}}>✍️ Tanda tangan GL</span>
                      <div style={{display:"flex",gap:4}}>
                        {(["A","B"] as const).map(sh => {
                          const s = getGLSignature(date,sh,"gl")
                          return (
                            <div key={sh} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                              <span style={{fontSize:9,color:"#64748b",fontWeight:700}}>{sh}</span>
                              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:36,height:22,borderRadius:5,fontSize:11,fontWeight:700,color:"white",background:s==="☑"?"#22c55e":"#d1d5db"}}>{s==="☑"?"✓":"-"}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <>
      <Sidebar userName={user.fullName || user.username || " "} />
      <div style={{maxWidth:1800,paddingLeft: isMobile?"10px":"95px",paddingRight: isMobile?"10px":"25px",paddingTop:isMobile?"12px":"25px",paddingBottom:25}} className="page-content">

        {/* HEADER */}
        <div className="header">
          <h1>📊 {VIEW_MODE_LABELS[viewMode]}</h1>
          <div className="role-info">
            Role: <span className="role-badge">{user.role==="group-leader-qa"?"👤 Group Leader":"🔍 Inspector"}</span>
          </div>
        </div>

        {/* CONTROL PANEL */}
        <div className="ctrl-panel">
          {/* Row 1 — View mode tabs */}
          <div className="ctrl-tabs">
            {allowedViewModes.map(mode => (
              <button key={mode} className={`ctrl-tab ${viewMode===mode?"ctrl-tab--active":""}`} onClick={() => setViewMode(mode)}>
                {VIEW_MODE_BUTTONS[mode].label}
              </button>
            ))}
          </div>

          {/* Row 2 — Area selector */}
          <div className="ctrl-row">
            <AreaFilter categoryCode={categoryCode} selectedArea={selectedArea} onAreaChange={setSelectedArea} isLoading={isLoading} defaultAreaCode={DEFAULT_AREA_BY_CATEGORY[categoryCode]} />
          </div>

          {/* Row 3 — Specific Area (DCI only) */}
          {viewMode === "daily-check-ins" && (
            <div className="ctrl-row">
              <div className="ctrl-spec-area-wrap">
                <span className="ctrl-label" style={{color:"#5b21b6"}}>🔍 Spesifik Area</span>
                <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                  <select value={selectedSpecificArea} onChange={e => setSelectedSpecificArea(e.target.value)}
                    className="ctrl-spec-area-select">
                    {PRE_ASSY_SPECIFIC_AREA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <span className="ctrl-badge-count">{filteredDciNos.length} item</span>
                </div>
              </div>
            </div>
          )}

          {/* Row 4 — ✅ CONVEYOR (menggantikan Carline - Line) */}
          <div className="ctrl-row">
            <div className="ctrl-carline-wrap">
              <span className="ctrl-label">🏭 Conveyor:</span>
              {isFetchingConveyors ? (
                <span style={{fontSize:12,color:"#94a3b8",fontStyle:"italic",padding:"8px 10px",background:"#f8fafc",borderRadius:8,border:"1.5px solid #e2e8f0",display:"inline-block"}}>
                  Memuat conveyor...
                </span>
              ) : conveyorOptions.length === 0 ? (
                <span style={{fontSize:12,color:"#94a3b8",fontStyle:"italic",padding:"8px 10px",background:"#f8fafc",borderRadius:8,border:"1.5px solid #e2e8f0",display:"inline-block"}}>
                  Belum ada data conveyor
                </span>
              ) : (
                <select
                  value={selectedConveyor}
                  onChange={e => setSelectedConveyor(e.target.value)}
                  disabled={isLoading || isFetchingConveyors}
                  className="ctrl-carline-select"
                  style={{
                    borderColor: selectedConveyor ? "#f59e0b" : "#e2e8f0",
                    color: selectedConveyor ? "#92400e" : "#64748b",
                    background: selectedConveyor ? "#fffbeb" : "white",
                  }}
                >
                  <option value="">— Pilih Conveyor —</option>
                  {conveyorOptions.map(cv => (
                    <option key={cv} value={cv}>{cv}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Warning belum pilih conveyor */}
        {!selectedConveyor && !isLoading && (
          <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderLeft:"4px solid #f59e0b",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#92400e",fontWeight:600}}>
            ⚠️ Pilih <strong>Conveyor</strong> untuk menampilkan data.
          </div>
        )}
        {error && <div style={{backgroundColor:"#fee",color:"#c33",padding:12,borderRadius:8,marginBottom:15,borderLeft:"4px solid #c33"}}><strong>Error: </strong>{error}</div>}
        {isLoading && (
          <div style={{textAlign:"center",padding:20}}>
            <div style={{display:"inline-block",width:40,height:40,border:"4px solid #1976d2",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
            <p style={{marginTop:10,color:"#666"}}>Memuat data...</p>
          </div>
        )}

        {/* Info bar DCI */}
        {viewMode === "daily-check-ins" && (
          <div style={{background:"#ede9fe",border:"1px solid #c4b5fd",borderLeft:"4px solid #7c3aed",borderRadius:8,padding:"7px 12px",marginBottom:10,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:"#5b21b6",background:"#ddd6fe",padding:"2px 8px",borderRadius:20}}>🔍 {selectedSpecificArea}</span>
            <span style={{fontSize:11,fontWeight:700,color:"#166534",background:"#bbf7d0",padding:"2px 8px",borderRadius:20}}>📋 {filteredDciNos.length} item</span>
            {selectedConveyor && (
              <span style={{fontSize:11,fontWeight:600,color:"#92400e",background:"#fde68a",padding:"2px 8px",borderRadius:20}}>
                🏭 {selectedConveyor}
              </span>
            )}
          </div>
        )}

        {/* MONTH NAVIGATION */}
        {(viewMode==="cc-stripping"||viewMode==="pressure-jig"||viewMode==="daily-check-ins"||viewMode==="cs-remove-tool") && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isMobile?10:15,gap:8}}>
            <button onClick={() => changeMonth(-1)} style={{padding:isMobile?"6px 10px":"8px 16px",backgroundColor:"#1976d2",color:"white",border:"none",borderRadius:6,cursor:"pointer",fontWeight:"bold",fontSize:isMobile?12:14,whiteSpace:"nowrap"}}>
              {isMobile ? "← Lalu" : "← Bulan Lalu"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1,justifyContent:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:isMobile?"0.85rem":"1rem",fontWeight:"bold"}}>{getMonthName(activeMonth)} {activeYear}</span>
              {viewMode==="cc-stripping" && (
                <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))}
                  style={{padding:isMobile?"4px 6px":"8px 12px",borderRadius:6,border:"1px solid #ccc",fontSize:isMobile?"0.78rem":"1rem",minWidth:isMobile?90:120}}>
                  {getWorkDaysByWeek.map(w => <option key={w.weekNum} value={w.weekNum}>Minggu {w.weekNum}</option>)}
                </select>
              )}
            </div>
            <button onClick={() => changeMonth(1)} style={{padding:isMobile?"6px 10px":"8px 16px",backgroundColor:"#1976d2",color:"white",border:"none",borderRadius:6,cursor:"pointer",fontWeight:"bold",fontSize:isMobile?12:14,whiteSpace:"nowrap"}}>
              {isMobile ? "Depan →" : "Bulan Depan →"}
            </button>
          </div>
        )}

        {/* MOBILE CARD VIEW */}
        {isMobile && selectedConveyor && (
          <div style={{marginBottom:16}}>
            {viewMode === "daily" && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:6}}>
                <button onClick={() => changeMonth(-1)} style={{padding:"6px 10px",backgroundColor:"#1976d2",color:"white",border:"none",borderRadius:6,cursor:"pointer",fontWeight:"bold",fontSize:12}}>← Lalu</button>
                <span style={{fontWeight:"bold",fontSize:13}}>{getMonthName(activeMonth)} {activeYear}</span>
                <button onClick={() => changeMonth(1)} style={{padding:"6px 10px",backgroundColor:"#1976d2",color:"white",border:"none",borderRadius:6,cursor:"pointer",fontWeight:"bold",fontSize:12}}>Depan →</button>
              </div>
            )}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <button onClick={() => setExpandedDates(new Set(dynamicDates))} style={{flex:1,padding:"7px 8px",background:"#1e88e5",color:"white",border:"none",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer"}}>▼ Buka Semua</button>
              <button onClick={() => setExpandedDates(new Set())} style={{flex:1,padding:"7px 8px",background:"#64748b",color:"white",border:"none",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer"}}>▲ Tutup Semua</button>
            </div>
            {renderMobileCards()}
          </div>
        )}

        {/* DESKTOP TABLE VIEW */}
        {!isMobile && (
          <div className="table-wrapper">
            <table className="status-table">
              <thead>
                {viewMode === "daily" ? (
                  <>
                    <tr>
                      <th rowSpan={2}>Check Point</th>
                      <th rowSpan={2} className="col-standard">Standard / Metode</th>
                      <th rowSpan={2} className="col-waktu">Waktu Check</th>
                      <th rowSpan={2}>Shift</th>
                      <th colSpan={dynamicDates.length} className="month-header">{getMonthName(activeMonth)} {activeYear}</th>
                    </tr>
                    <tr>
                      {dynamicDates.map(date => <th key={date} className={isCurrentMonth&&date===today?"col-date-today":"col-date-pa"}>{date}</th>)}
                    </tr>
                  </>
                ) : viewMode === "daily-check-ins" ? (
                  <>
                    <tr>
                      <th rowSpan={2} className="col-no">No</th>
                      <th rowSpan={2} className="col-item">Item Check — {selectedSpecificArea}</th>
                      <th rowSpan={2} className="col-shift-dci">Shift</th>
                      <th colSpan={dynamicDates.length} className="month-header">
                        {getMonthName(activeMonth)} {activeYear} | {selectedSpecificArea}
                        {selectedConveyor && <span style={{marginLeft:8,fontSize:11,fontWeight:600,background:"rgba(255,255,255,0.2)",padding:"2px 8px",borderRadius:10}}>🏭 {selectedConveyor}</span>}
                      </th>
                    </tr>
                    <tr>
                      {dynamicDates.map(d => <th key={d} className={`col-date ${isCurrentMonth&&d===today?"col-date-today":""}`}>{d}</th>)}
                    </tr>
                  </>
                ) : viewMode === "cc-stripping" ? (
                  <>
                    <tr>
                      <th colSpan={3+getSelectedWeekDays.length*TIME_SLOTS.length} className="month-header">{getMonthName(activeMonth)} {activeYear}</th>
                    </tr>
                    <tr>
                      <th rowSpan={2} className="col-mesin">MESIN</th>
                      <th rowSpan={2} className="col-kind">KIND</th>
                      <th rowSpan={2} className="col-size">SIZE</th>
                      {getSelectedWeekDays.map((d,i) => <th key={i} colSpan={TIME_SLOTS.length}>{d.dayName} {d.date}</th>)}
                    </tr>
                    <tr>
                      {getSelectedWeekDays.flatMap((_d,di) => TIME_SLOTS.map((_ts,ti) => <th key={`${di}-${ti}`} className="col-time">{TIME_SLOTS[ti]}</th>))}
                    </tr>
                  </>
                ) : viewMode === "cs-remove-tool" ? (
                  <>
                    <tr>
                      <th className="col-no" rowSpan={2}>NO</th>
                      <th className="col-tool" rowSpan={2}>TOOL TYPE</th>
                      <th className="col-control" rowSpan={2}>CONTROL NO</th>
                      <th className="col-shift" rowSpan={2}>SHIFT</th>
                      <th colSpan={dynamicDates.length} style={{textAlign:"center",fontSize:12,fontWeight:"bold"}}>DATE</th>
                    </tr>
                    <tr>{dynamicDates.map(d => <th key={d} className={`col-date ${isCurrentMonth&&d===today?"col-date-today":""}`}>{d}</th>)}</tr>
                  </>
                ) : viewMode === "pressure-jig" ? (
                  <>
                    <tr>
                      <th rowSpan={2} className="col-no">No</th>
                      <th rowSpan={2} className="col-checkpoint">Item Check</th>
                      <th rowSpan={2} className="col-freq">Freq</th>
                      <th rowSpan={2} className="col-judge">Judge</th>
                      <th rowSpan={2} className="col-shift">Shift</th>
                      <th colSpan={dynamicDates.length} className="month-header">{getMonthName(activeMonth)} {activeYear}</th>
                    </tr>
                    <tr>{dynamicDates.map(d => <th key={d} className={`col-date ${isCurrentMonth&&d===today?"col-date-today":""}`}>{d}</th>)}</tr>
                  </>
                ) : null}
              </thead>
              <tbody>
                {viewMode === "daily" && (
                  <>
                    {Array.from({length:14},(_,i)=>i+1).map(id => {
                      const sA = DAILY_CHECKPOINTS.find(c => c.id===id&&c.shift==="A")
                      const sB = DAILY_CHECKPOINTS.find(c => c.id===id+0.1&&c.shift==="B")
                      if (!sA||!sB) return null
                      return (
                        <React.Fragment key={id}>
                          <tr>
                            <td rowSpan={2} className="col-checkpoint">{sA.checkPoint}</td>
                            <td className="col-standard">{sA.standard}</td>
                            <td className="col-waktu">{sA.waktuCheck}</td>
                            <td className="col-shift">{sA.shift}</td>
                            {dynamicDates.map(d => <td key={`A-${id}-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>{renderStatusCell(d,sA)}</td>)}
                          </tr>
                          <tr>
                            <td className="col-standard">{sB.standard}</td>
                            <td className="col-waktu">{sB.waktuCheck}</td>
                            <td className="col-shift">{sB.shift}</td>
                            {dynamicDates.map(d => <td key={`B-${id}-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>{renderStatusCell(d,sB)}</td>)}
                          </tr>
                        </React.Fragment>
                      )
                    })}
                    <React.Fragment>
                      <tr>
                        <td colSpan={2} rowSpan={2} style={{fontSize:12,fontWeight:700,textAlign:"center",background:"#f8fafc",padding:8}}>Check dan Tanda tangan GL Inspector</td>
                        <td rowSpan={2}></td>
                        <td>A</td>
                        {dynamicDates.map(d => { const v=getGLSignature(d,"A","gl"); return <td key={`gl-A-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}><span style={{display:"inline-block",width:"100%",backgroundColor:v==="☑"?"#4caf50":"#9e9e9e",color:"white",padding:"3px 0",borderRadius:4,textAlign:"center",fontSize:11,fontWeight:600}}>{v}</span></td> })}
                      </tr>
                      <tr>
                        <td>B</td>
                        {dynamicDates.map(d => { const v=getGLSignature(d,"B","gl"); return <td key={`gl-B-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}><span style={{display:"inline-block",width:"100%",backgroundColor:v==="☑"?"#4caf50":"#9e9e9e",color:"white",padding:"3px 0",borderRadius:4,textAlign:"center",fontSize:11,fontWeight:600}}>{v}</span></td> })}
                      </tr>
                      <tr>
                        <td colSpan={2} rowSpan={2} style={{fontSize:12,fontWeight:700,textAlign:"center",background:"#f8fafc",padding:8}}>Verifikasi dan Tanda tangan ESO (Setiap Hari Selasa & Kamis)</td>
                        <td rowSpan={2}></td>
                        <td>A</td>
                        {dynamicDates.map(d => { const dow=new Date(activeYear,activeMonth,d).getDay(); const ok=dow===2||dow===4; const v=getGLSignature(d,"A","eso"); if(!ok) return <td key={`eso-A-${d}`} style={{background:"#f8fafc"}}></td>; return <td key={`eso-A-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}><span style={{display:"inline-block",width:"100%",backgroundColor:v==="☑"?"#4caf50":"#9e9e9e",color:"white",padding:"3px 0",borderRadius:4,textAlign:"center",fontSize:11,fontWeight:600}}>{v}</span></td> })}
                      </tr>
                      <tr>
                        <td>B</td>
                        {dynamicDates.map(d => { const dow=new Date(activeYear,activeMonth,d).getDay(); const ok=dow===2||dow===4; const v=getGLSignature(d,"B","eso"); if(!ok) return <td key={`eso-B-${d}`} style={{background:"#f8fafc"}}></td>; return <td key={`eso-B-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}><span style={{display:"inline-block",width:"100%",backgroundColor:v==="☑"?"#4caf50":"#9e9e9e",color:"white",padding:"3px 0",borderRadius:4,textAlign:"center",fontSize:11,fontWeight:600}}>{v}</span></td> })}
                      </tr>
                    </React.Fragment>
                  </>
                )}

                {viewMode === "daily-check-ins" && filteredDciUnique.map(item => (
                  <React.Fragment key={`dci-${item.no}`}>
                    <tr>
                      <td rowSpan={2} className="col-no" style={{fontWeight:700,color:"#1e3a8a",verticalAlign:"middle"}}>{item.no}</td>
                      <td rowSpan={2} className="col-item dci-item-cell" style={{verticalAlign:"middle"}}>{item.itemCheck}</td>
                      <td className="col-shift-dci shift-badge-a">A</td>
                      {dynamicDates.map(d => (
                        <td key={`dci-${item.no}-A-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>
                          {renderStatusCellDailyCheckIns(d, item.no, "A", item.itemCheck)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-shift-dci shift-badge-b">B</td>
                      {dynamicDates.map(d => (
                        <td key={`dci-${item.no}-B-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>
                          {renderStatusCellDailyCheckIns(d, item.no, "B", item.itemCheck)}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}

                {viewMode === "cc-stripping" && Array.from({length:17},(_,i)=>i+1).map(id => {
                  const sA = CC_STRIPPING_CHECKPOINTS.find(c=>c.id===id&&c.shift==="A")
                  const sB = CC_STRIPPING_CHECKPOINTS.find(c=>c.id===id+0.1&&c.shift==="B")
                  if (!sA||!sB) return null
                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td rowSpan={2} className="col-machine">{sA.machine}</td>
                        <td rowSpan={2} className="col-kind">{sA.kind}</td>
                        <td rowSpan={2} className="col-size">{sA.size}</td>
                        {getSelectedWeekDays.flatMap((d,di) => TIME_SLOTS.map(ts => <td key={`${di}-${ts}-A`} className="col-date-cell">{renderStatusCell(d.date,sA,ts)}</td>))}
                      </tr>
                      <tr>
                        {getSelectedWeekDays.flatMap((d,di) => TIME_SLOTS.map(ts => <td key={`${di}-${ts}-B`} className="col-date-cell">{renderStatusCell(d.date,sB,ts)}</td>))}
                      </tr>
                    </React.Fragment>
                  )
                })}

                {viewMode === "cs-remove-tool" && CS_REMOVE_TOOL_UNIQUE_GROUPS.map(group => {
                  const repItem = CS_REMOVE_TOOL_ITEMS_FULL.find(it => it.no === group.no)
                  if (!repItem) return null
                  return (
                    <React.Fragment key={group.no}>
                      <tr>
                        <td rowSpan={2} className="col-no">{group.no}</td>
                        <td rowSpan={2} className="col-tool">{group.toolType}</td>
                        <td rowSpan={2} className="col-control">{repItem.controlNo}</td>
                        <td className="col-shift shift-badge-a">A</td>
                        {dynamicDates.map(d => (
                          <td key={`crt-${group.no}-A-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>
                            {renderCSRemoveCellByNoShift(d, group.no, "A", group.toolType)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="col-shift shift-badge-b">B</td>
                        {dynamicDates.map(d => (
                          <td key={`crt-${group.no}-B-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>
                            {renderCSRemoveCellByNoShift(d, group.no, "B", group.toolType)}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  )
                })}

                {viewMode === "pressure-jig" && Array.from({length:7},(_,i)=>i+1).map(id => {
                  const sA = PRESSURE_JIG_CHECKPOINTS.find(c=>c.id===id&&c.shift==="A")
                  const sB = PRESSURE_JIG_CHECKPOINTS.find(c=>c.id===id+0.1&&c.shift==="B")
                  if (!sA||!sB) return null
                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td className="col-no" rowSpan={2}>{id}</td>
                        <td className="col-checkpoint" rowSpan={2}>{sA.checkPoint}</td>
                        <td className="col-freq" rowSpan={2}>{sA.frequency}</td>
                        <td className="col-judge" rowSpan={2}>{sA.judge}</td>
                        <td className="col-shift">{sA.shift}</td>
                        {dynamicDates.map(d => <td key={`A-${id}-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>{renderStatusCell(d,sA)}</td>)}
                      </tr>
                      <tr>
                        <td className="col-shift">{sB.shift}</td>
                        {dynamicDates.map(d => <td key={`B-${id}-${d}`} className={`col-date-cell${isCurrentMonth&&d===today?" bg-blue-50":""}`}>{renderStatusCell(d,sB)}</td>)}
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NG MODAL */}
      {ngModal && (
        <div className="ng-modal-overlay" onClick={() => setNgModal(null)}>
          <div className={`ng-modal${ngModal.isDCI?" ng-modal--dci":""}`} onClick={e => e.stopPropagation()}>
            {ngModal.isDCI ? (
              <>
                <div className="dci-modal-header">
                  <div className="dci-modal-badge-ng">✗ NG</div>
                  <div className="dci-modal-title-block">
                    <h3 className="dci-modal-title">Detail Kondisi NG</h3>
                    <p className="dci-modal-subtitle">{VIEW_MODE_LABELS[viewMode]}</p>
                  </div>
                  <button className="dci-modal-close" onClick={() => setNgModal(null)}>✕</button>
                </div>
                <div className="dci-modal-info-grid">
                  <div className="dci-modal-info-row"><span className="dci-modal-info-label">Item Check</span><span className="dci-modal-info-value dci-modal-item-name">{ngModal.dciItemCheck||ngModal.label}{ngModal.dciGaugeId&&<span className="dci-modal-gauge-badge">{ngModal.dciGaugeId}</span>}</span></div>
                  <div className="dci-modal-info-row"><span className="dci-modal-info-label">Tanggal &amp; Shift</span><span className="dci-modal-info-value">{ngModal.date} {getMonthName(activeMonth)} {activeYear}<span className="dci-modal-shift-badge">Shift {ngModal.shift}</span></span></div>
                  <div className="dci-modal-info-row"><span className="dci-modal-info-label">Area</span><span className="dci-modal-info-value dci-modal-area">{ngModal.dciArea||"-"}</span></div>
                  {/* ✅ Tampilkan Conveyor (bukan Carline - Line) */}
                  <div className="dci-modal-info-row">
                    <span className="dci-modal-info-label">Conveyor</span>
                    <span className="dci-modal-info-value dci-modal-carline">{ngModal.dciConveyor||"-"}</span>
                  </div>
                </div>
                <div className="dci-modal-ng-section">
                  <div className="dci-modal-ng-section-header">
                    <span className="dci-modal-ng-section-icon">⚠️</span>
                    <span className="dci-modal-ng-section-title">Kondisi NG yang ditemukan{ngModal.dciNgChoices&&ngModal.dciNgChoices.length>0&&<span className="dci-modal-ng-count">{ngModal.dciNgChoices.length} kondisi</span>}</span>
                  </div>
                  {ngModal.dciNgChoices&&ngModal.dciNgChoices.length>0 ? (
                    <div className="dci-modal-ng-list">
                      {ngModal.dciNgChoices.map((c,i) => <div key={i} className="dci-modal-ng-item"><span className="dci-modal-ng-bullet">✗</span><span className="dci-modal-ng-text">{c}</span></div>)}
                    </div>
                  ) : <div className="dci-modal-ng-empty">Tidak ada detail kondisi NG yang tercatat</div>}
                </div>
                {ngModal.dciOtherNote && (
                  <div className="dci-modal-other-section">
                    <div className="dci-modal-other-header"><span>✏️</span><span className="dci-modal-other-title">Keterangan Tambahan</span></div>
                    <div className="dci-modal-other-text">{ngModal.dciOtherNote}</div>
                  </div>
                )}
                {ngModal.dciPhotos&&ngModal.dciPhotos.length>0 && (
                  <div className="dci-modal-photo-section">
                    <div className="dci-modal-photo-header"><span>📷</span><span className="dci-modal-photo-title">Foto Dokumentasi NG</span><span className="dci-modal-photo-count">{ngModal.dciPhotos.length} foto</span></div>
                    <div className="dci-modal-photo-grid">
                      {ngModal.dciPhotos.map((src,pi) => <img key={pi} src={src} alt={`Foto NG ${pi+1}`} className="dci-modal-photo-thumb" onClick={() => setPhotoZoomSrc(src)} title="Klik untuk zoom" />)}
                    </div>
                  </div>
                )}
                <div className="dci-modal-footer-info">
                  <span>Dilaporkan oleh: <strong>{ngModal.submittedBy||"-"}</strong></span>
                  <span>{ngModal.submittedAt?new Date(ngModal.submittedAt).toLocaleString("id-ID"):"-"}</span>
                </div>
                <div className="ng-modal-actions"><button onClick={() => setNgModal(null)} className="btn-primary">Tutup</button></div>
              </>
            ) : (
              <>
                <h3>⚠️ Detail Kondisi NG</h3>
                <div className="ng-form-group"><label>Item Check</label><div style={{padding:8,background:"#f8f8f8",borderRadius:4,fontSize:13}}>{ngModal.label}</div></div>
                <div className="ng-form-group"><label>Tanggal &amp; Shift</label><div style={{padding:8,background:"#f8f8f8",borderRadius:4,fontSize:13}}>{ngModal.date} {getMonthName(activeMonth)} {activeYear} — Shift {ngModal.shift}</div></div>
                <div className="ng-form-group"><label>Departemen</label><div style={{padding:8,background:"#fff3cd",borderRadius:4,fontSize:13,fontWeight:600}}>{ngModal.ngDepartment||"-"}</div></div>
                <div className="ng-form-group"><label>Keterangan NG</label><div style={{padding:8,background:"#fee",borderRadius:4,fontSize:13,borderLeft:"3px solid #f44336",minHeight:60}}>{ngModal.ngDescription||"-"}</div></div>
                <div className="ng-form-group"><label>Dilaporkan oleh</label><div style={{padding:8,background:"#f8f8f8",borderRadius:4,fontSize:13}}>{ngModal.submittedBy||"-"}</div></div>
                <div className="ng-form-group"><label>Waktu Submit</label><div style={{padding:8,background:"#f8f8f8",borderRadius:4,fontSize:13}}>{ngModal.submittedAt?new Date(ngModal.submittedAt).toLocaleString("id-ID"):"-"}</div></div>
                <div className="ng-modal-actions"><button onClick={() => setNgModal(null)} className="btn-primary">Tutup</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photo Zoom */}
      {photoZoomSrc && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={() => setPhotoZoomSrc(null)}>
          <div style={{position:"relative",maxWidth:"95vw",maxHeight:"90vh"}} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoZoomSrc(null)} style={{position:"absolute",top:-14,right:-14,width:32,height:32,background:"#ef4444",color:"white",border:"3px solid white",borderRadius:"50%",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>✕</button>
            <img src={photoZoomSrc} alt="Foto NG" style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:10,objectFit:"contain",boxShadow:"0 8px 40px rgba(0,0,0,0.5)",display:"block"}} />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .page-content { background: #f0f4f8; min-height: 100vh; }
        .header { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#1565c0,#1976d2); color:white; padding:16px 22px; border-radius:12px; margin-bottom:14px; box-shadow:0 4px 14px rgba(21,101,192,0.3); flex-wrap:wrap; gap:10px; }
        .header h1 { margin:0; color:white; font-size:1.1rem; font-weight:700; }
        .role-info { display:flex; align-items:center; gap:10px; font-size:0.88rem; color:rgba(255,255,255,0.85); font-weight:600; }
        .role-badge { background:rgba(255,255,255,0.2); color:white; padding:5px 14px; border-radius:20px; font-weight:600; font-size:0.85rem; border:1px solid rgba(255,255,255,0.3); }
        .month-header { text-align:center; font-size:1rem; font-weight:700; color:#0d47a1; background:#dbeafe; padding:8px 0; }
        .table-wrapper { overflow-x:auto; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.09); background:white; margin-bottom:12px; }
        .status-table { width:100%; border-collapse:collapse; background:white; font-size:0.82rem; }
        .status-table th,.status-table td { padding:7px 6px; text-align:center; border:1px solid #dde3ea; vertical-align:middle; }
        .status-table th { background:#1e3a8a; color:white; font-weight:700; position:sticky; top:0; z-index:2; font-size:12px; }
        .status-table td.col-machine,.status-table td.col-kind,.status-table td.col-size { text-align:left; padding:7px 10px; font-size:0.82rem; font-weight:500; color:#1e293b; }
        .status-table td.col-checkpoint { min-width:230px; max-width:300px; text-align:left; word-break:break-word; white-space:pre-wrap; font-size:11.5px; font-weight:500; color:#334155; padding:7px 10px; }
        .col-checkpoint { min-width:230px; }
        .col-standard { min-width:160px; text-align:left; font-size:11px; color:#475569; }
        .col-waktu { min-width:110px; font-size:11px; color:#64748b; }
        .col-machine { min-width:110px; } .col-kind { min-width:90px; } .col-size { min-width:55px; }
        .col-no { min-width:36px; font-weight:700; color:#1e3a8a; }
        .col-item { min-width:150px; text-align:left; font-weight:600; padding-left:8px; }
        .col-shift { min-width:46px; font-weight:700; font-size:12px; }
        .col-shift-dci { min-width:42px; font-weight:800; font-size:12px; letter-spacing:0.04em; }
        .shift-badge-a { background:#eff6ff !important; color:#1d4ed8 !important; }
        .shift-badge-b { background:#f0fdf4 !important; color:#15803d !important; }
        .col-freq { min-width:90px; font-size:11px; } .col-judge { min-width:90px; font-size:11px; }
        .col-tool { min-width:100px; text-align:left; font-weight:600; } .col-control { min-width:80px; }
        .col-time { min-width:46px; font-size:11px; }
        .col-date { min-width:34px; font-size:11px; }
        .col-date-pa { min-width:34px; font-size:11px; background:#f0f7ff; color:#0369a1; font-weight:700; }
        .col-date-today { background:#fef3c7 !important; color:#b45309 !important; font-weight:800 !important; }
        .col-date-cell { min-width:34px; height:34px; padding:2px 1px; }
        .status-badge { display:inline-block; width:100%; padding:3px 4px; border-radius:4px; font-weight:600; font-size:11px; text-align:center; user-select:none; }
        .status-badge-ok { background:#22c55e; color:white; }
        .status-badge-ng { background:#ef4444; color:white; cursor:pointer; }
        .bg-gray-200 { background-color:#e0e0e0 !important; } .bg-gray-100 { background-color:#f5f5f5 !important; } .bg-blue-50 { background-color:#eff6ff !important; }
        .dci-item-cell { font-weight:700; color:#1e293b; font-size:13px; line-height:1.3; }
        .ng-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.52); display:flex; justify-content:center; align-items:center; z-index:1000; padding:16px; }
        .ng-modal { background:white; padding:0; border-radius:12px; width:90%; max-width:480px; box-shadow:0 20px 50px rgba(0,0,0,0.22); overflow:hidden; max-height:90vh; overflow-y:auto; }
        .ng-modal h3 { margin:0; padding:14px 20px; background:#fef2f2; color:#b91c1c; border-bottom:1px solid #fecaca; font-size:15px; font-weight:700; }
        .ng-form-group { margin:0; padding:10px 20px 0; }
        .ng-form-group label { display:block; margin-bottom:4px; font-weight:600; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; }
        .ng-modal-actions { display:flex; justify-content:flex-end; gap:10px; padding:12px 20px; border-top:1px solid #e2e8f0; margin-top:10px; }
        .ng-modal--dci { max-width:520px; }
        .dci-modal-header { display:flex; align-items:center; gap:14px; padding:20px 24px 16px; background:linear-gradient(135deg,#ef4444,#b91c1c); color:white; }
        .dci-modal-badge-ng { background:rgba(255,255,255,0.2); border:2px solid rgba(255,255,255,0.4); color:white; font-size:13px; font-weight:800; padding:4px 12px; border-radius:20px; letter-spacing:0.05em; white-space:nowrap; }
        .dci-modal-title-block { flex:1; }
        .dci-modal-title { margin:0 0 2px; font-size:16px; font-weight:800; color:white; }
        .dci-modal-subtitle { margin:0; font-size:11px; color:rgba(255,255,255,0.8); font-weight:500; }
        .dci-modal-close { background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .dci-modal-info-grid { padding:16px 24px; display:flex; flex-direction:column; gap:10px; border-bottom:1px solid #f1f5f9; }
        .dci-modal-info-row { display:flex; align-items:flex-start; gap:12px; }
        .dci-modal-info-label { min-width:120px; font-size:12px; font-weight:600; color:#64748b; padding-top:2px; }
        .dci-modal-info-value { flex:1; font-size:13px; font-weight:500; color:#1e293b; }
        .dci-modal-item-name { font-weight:700; font-size:14px; color:#0f172a; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .dci-modal-gauge-badge { background:#0f172a; color:#67e8f9; font-size:10px; font-weight:700; font-family:monospace; padding:3px 9px; border-radius:6px; }
        .dci-modal-shift-badge { display:inline-block; margin-left:8px; background:#1e3a8a; color:white; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; }
        .dci-modal-area { color:#7c3aed; font-weight:600; }
        .dci-modal-carline { color:#92400e; font-weight:700; font-size:14px; }
        .dci-modal-ng-section { padding:16px 24px; background:#fffbeb; }
        .dci-modal-ng-section-header { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
        .dci-modal-ng-section-icon { font-size:16px; }
        .dci-modal-ng-section-title { font-size:13px; font-weight:700; color:#92400e; flex:1; }
        .dci-modal-ng-count { display:inline-block; margin-left:8px; background:#ef4444; color:white; font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; vertical-align:middle; }
        .dci-modal-ng-list { display:flex; flex-direction:column; gap:7px; }
        .dci-modal-ng-item { display:flex; align-items:flex-start; gap:10px; padding:9px 13px; background:white; border:1.5px solid #fca5a5; border-radius:8px; }
        .dci-modal-ng-bullet { color:#ef4444; font-weight:800; font-size:13px; flex-shrink:0; margin-top:1px; }
        .dci-modal-ng-text { font-size:13px; color:#1e293b; font-weight:500; line-height:1.4; }
        .dci-modal-ng-empty { padding:12px; background:white; border:1.5px dashed #e2e8f0; border-radius:8px; font-size:13px; color:#94a3b8; text-align:center; }
        .dci-modal-other-section { margin-top:14px; padding:12px 14px; background:#fffbeb; border:1.5px solid #fed7aa; border-radius:8px; }
        .dci-modal-other-header { display:flex; align-items:center; gap:6px; margin-bottom:7px; }
        .dci-modal-other-title { font-size:13px; font-weight:700; color:#92400e; }
        .dci-modal-other-text { font-size:13px; color:#1e293b; line-height:1.5; white-space:pre-wrap; }
        .dci-modal-photo-section { margin-top:14px; }
        .dci-modal-photo-header { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
        .dci-modal-photo-title { font-size:13px; font-weight:700; color:#1e293b; }
        .dci-modal-photo-count { font-size:11px; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:20px; }
        .dci-modal-photo-grid { display:flex; flex-wrap:wrap; gap:8px; }
        .dci-modal-photo-thumb { width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0; cursor:pointer; transition:transform 0.15s; }
        .dci-modal-footer-info { padding:10px 24px; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; background:#f8fafc; border-top:1px solid #f1f5f9; gap:8px; flex-wrap:wrap; }
        .ng-modal--dci .ng-modal-actions { padding:12px 24px; border-top:none; }
        .ng-modal-actions button { padding:8px 16px; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; }
        .btn-primary { background:#1976d2; color:white; }

        .ctrl-panel { background:white; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 4px rgba(0,0,0,0.06); padding:12px; margin-bottom:14px; display:flex; flex-direction:column; gap:10px; }
        .ctrl-tabs  { display:flex; gap:6px; flex-wrap:wrap; }
        .ctrl-tab   { flex:1; min-width:80px; padding:9px 8px; border:2px solid #dde3ea; border-radius:9px; background:#f8fafc; color:#475569; font-weight:600; cursor:pointer; transition:all 0.15s; font-size:13px; text-align:center; }
        .ctrl-tab:hover { background:#dbeafe; border-color:#93c5fd; color:#1d4ed8; }
        .ctrl-tab--active { background:#1976d2; color:white; border-color:#1565c0; box-shadow:0 2px 8px rgba(25,118,210,0.3); }
        .ctrl-row   { display:flex; align-items:center; gap:8px; width:100%; }
        .ctrl-label { font-size:12px; font-weight:700; color:#334155; white-space:nowrap; flex-shrink:0; min-width:fit-content; }
        .ctrl-spec-area-wrap   { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
        .ctrl-spec-area-select { flex:1; min-width:0; padding:8px 10px; border-radius:8px; border:2px solid #7c3aed; font-size:13px; font-weight:700; color:#5b21b6; background:#f5f3ff; cursor:pointer; outline:none; }
        .ctrl-badge-count      { font-size:11px; color:#7c3aed; background:#ede9fe; padding:3px 8px; border-radius:20px; font-weight:700; white-space:nowrap; flex-shrink:0; }
        .ctrl-carline-wrap   { display:flex; align-items:center; gap:8px; width:100%; flex-wrap:wrap; }
        .ctrl-carline-select { flex:1; min-width:0; padding:8px 10px; border-radius:8px; border:2px solid #f59e0b; font-size:13px; font-weight:600; cursor:pointer; outline:none; transition:all 0.15s; }

        @media (min-width: 769px) {
          .ctrl-panel { flex-direction:row; flex-wrap:wrap; align-items:center; gap:10px; padding:14px 16px; }
          .ctrl-tabs  { flex-wrap:nowrap; flex-shrink:0; }
          .ctrl-tab   { flex:none; padding:8px 18px; font-size:13px; }
          .ctrl-row   { width:auto; flex:1; min-width:0; }
          .ctrl-carline-wrap { flex:1; min-width:200px; }
          .ctrl-spec-area-wrap { flex:1; }
        }

        @media (max-width: 768px) {
          .header { padding:10px 12px; border-radius:8px; margin-bottom:10px; }
          .header h1 { font-size:0.85rem; }
          .role-info { font-size:0.75rem; }
          .ctrl-panel { border-radius:10px; padding:10px; gap:8px; }
          .ctrl-tab { font-size:12px; padding:8px 6px; }
          .ctrl-carline-select { font-size:12px; padding:7px 8px; }
          .table-wrapper { border-radius:6px; }
          .status-table { font-size:0.72rem; }
          .status-table th, .status-table td { padding:4px 3px; }
        }
      `}</style>
    </>
  )
}