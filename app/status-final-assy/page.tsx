"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { ScanGaugeButton } from "@/components/ScanGaugeButton";
import CarlineLineFilter from "@/components/ChecksheetComponents/CarlineLineFilter";

// =====================================================================
// === TYPE DEFINITIONS ===
// =====================================================================
interface CheckPoint {
  id: number;       // ← ID shift A dari DATABASE
  idB?: number;     // ← ID shift B dari DATABASE (untuk lookup hasil shift B)
  no: string;
  checkPoint: string;
  shifts: Array<{
    shift: "A" | "B";
    waktuCheck: string;
  }>;
  standard: string;
  type?: "normal" | "special" | "weekly";
}

interface CheckResult {
  status: "OK" | "NG" | "-";
  ngCount: number;
  items: Array<{ name: string; status: "OK" | "NG" | "N/A"; notes: string; }>;
  notes: string;
  submittedAt: string;
  submittedBy: string;
  ngDescription?: string;
  ngDepartment?: string;
}

interface InspectorCheckItem {
  id: number;
  no: string;
  itemCheck: string;
  checkPoint: string;
  metodeCheck: string;
  area: string;
  shifts: Array<{ shift: "A" | "B" }>;
}

interface NGDetailModal {
  date: number;
  itemId: number;
  itemName: string;
  checkPoint: string;
  shift: "A" | "B";
  ngDescription: string;
  ngDepartment: string;
  submittedBy: string;
  submittedAt: string;
}

// =====================================================================
// === AREA FILTER COMPONENT ===
// =====================================================================
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
  defaultAreaCode?: string;
}

function AreaFilter({ categoryCode, selectedArea, onAreaChange, isLoading = false, defaultAreaCode }: AreaFilterProps) {
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!categoryCode) return;
    let isMounted = true;

    const fetchAreas = async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/areas/get-by-category?categoryCode=${encodeURIComponent(categoryCode)}`);
        const data = await res.json();
        if (!isMounted) return;
        if (data.success && data.areas?.length > 0) {
          setAreas(data.areas);
          if (!selectedArea) {
            if (defaultAreaCode && data.areas.some((a: AreaOption) => a.area_code === defaultAreaCode)) {
              onAreaChange(defaultAreaCode);
            } else {
              onAreaChange(data.areas[0].area_code);
            }
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch areas:", error);
      } finally {
        if (isMounted) setIsFetching(false);
      }
    };

    fetchAreas();
    return () => { isMounted = false; };
  }, [categoryCode]);

  const isDisabled = isLoading || isFetching || areas.length === 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
      <label htmlFor="area-select" style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>Area:</label>
      <select
        id="area-select"
        value={selectedArea}
        onChange={(e) => onAreaChange(e.target.value)}
        disabled={isDisabled}
        style={{
          backgroundColor: isDisabled ? "#f1f5f9" : "white",
          cursor: isDisabled ? "not-allowed" : "pointer",
          padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1",
          fontSize: "14px", fontWeight: "500", color: "#1e293b", minWidth: "200px",
        }}
      >
        {areas.map((area) => (
          <option key={area.area_code} value={area.area_code}>{area.area_name}</option>
        ))}
      </select>
      {(isFetching || areas.length === 0) && (
        <span style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
          {isFetching ? "Memuat..." : "Tidak ada area"}
        </span>
      )}
    </div>
  );
}

const DEFAULT_AREA_BY_CATEGORY: Record<string, string> = {
  // GL areas punya prefix "final-assy-gl-", Inspector areas punya prefix "final-assy-insp-"
  // Keduanya punya area terpisah di DB dengan area_id berbeda
  "final-assy-gl": "final-assy-gl-genba-a-mazda",
  "final-assy-inspector": "final-assy-insp-genba-a-mazda",
};

// =====================================================================
// === MAIN COMPONENT ===
// =====================================================================
export default function FinalAssyStatusPage() {
  const router = useRouter();
  const { user, loading, isInitialized } = useAuth();

  const [gaugeResults, setGaugeResults] = useState<Record<string, { gaugeId: string; status: "OK" | "NG" | "-" }>>({});
  const [viewAs, setViewAs] = useState<"group-leader" | "inspector">("inspector");
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [selectedArea, setSelectedArea] = useState<string>(() => DEFAULT_AREA_BY_CATEGORY["final-assy-inspector"] || "");
  const [selectedAreaId, setSelectedAreaId] = useState<number | undefined>();
  const [selectedCarline, setSelectedCarline] = useState<string>("");
  const [selectedLine, setSelectedLine] = useState<string>("");

  // ✅ FIX: checkpoints GL dari DB
  const [checkpoints, setCheckpoints] = useState<CheckPoint[]>([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);

  // ✅ FIX INSPECTOR: Map dari checkPoint text → real DB item_id
  // inspectorCheckItems hardcoded pakai id=1000-1038 (fake), tapi DB pakai id=1,2,3...
  // formatted result key = "1-A" tapi lookup pakai "1000-A" → tidak pernah match
  const [inspectorIdMap, setInspectorIdMap] = useState<Record<string, number>>({});

  const [groupLeaderResults, setGroupLeaderResults] = useState<Record<string, Record<string, CheckResult>>>({});
  const [inspectorResults, setInspectorResults] = useState<Record<string, Record<string, CheckResult>>>({});
  const [glSignaturesGroupLeader, setGlSignaturesGroupLeader] = useState<Record<string, Record<string, "-" | "OK">>>({});
  const [glSignaturesInspector, setGlSignaturesInspector] = useState<Record<string, Record<string, "-" | "OK">>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ngDetailModal, setNgDetailModal] = useState<NGDetailModal | null>(null);
  const hasBeenAuthenticated = useRef(false);

  // ===== AUTH CHECK =====
  useEffect(() => {
    if (user) hasBeenAuthenticated.current = true;
    if (isInitialized && !loading && !user && !hasBeenAuthenticated.current) {
      router.push("/login-page");
    }
  }, [user, loading, isInitialized, router]);

  // ===== INSPECTOR CHECK ITEMS (tetap hardcoded karena ID-nya sudah benar di DB) =====
  const [inspectorCheckItems] = useState<InspectorCheckItem[]>([
    { id: 1000, no: "1", itemCheck: "PIPO", checkPoint: "ADA NOMOR REGISTER", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1001, no: "1", itemCheck: "PIPO", checkPoint: "PIPO DALAM KONDISI BAIK DAN TIDAK RUSAK", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1002, no: "2", itemCheck: "ROLL METER / MISTAR BAJA", checkPoint: "ADA NOMOR REGISTER + KALIBRASI TIDAK EXPIRED", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1003, no: "2", itemCheck: "ROLL METER / MISTAR BAJA", checkPoint: "GARIS ANGKA TERBACA DENGAN JELAS / TIDAK BERKARAT", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1004, no: "2", itemCheck: "ROLL METER / MISTAR BAJA", checkPoint: "ROLLMETER / MISTAR BAJA DALAM KONDISI BAIK DAN TIDAK RUSAK", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1005, no: "3", itemCheck: "GO NO GO", checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1006, no: "3", itemCheck: "GO NO GO", checkPoint: "TIDAK ADA SKRUP YANG KENDOR / HILANG", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1007, no: "3", itemCheck: "GO NO GO", checkPoint: "KONDISI GO NO GO DALAM KEADAAN BAIK & BAGIAN BELAKANG (WIRE) DILINDUNGI TAPE / SPIRAL", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1008, no: "3", itemCheck: "GO NO GO", checkPoint: "ADA STIKER WARNA HIJAU PADA GO NO GO TERMINAL (M TERMINAL) DAN TIDAK LEPAS", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1009, no: "3", itemCheck: "GO NO GO", checkPoint: "KONDISI GO NO GO TERMINAL DALAM KEADAAN OK (TIDAK AUS, TIDAK BENT, TIDAK PATAH, TIDAK DEFORMASI)", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1010, no: "3", itemCheck: "GO NO GO", checkPoint: "BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK", metodeCheck: "DICOBA", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1011, no: "4", itemCheck: "PUSH GAUGE RB", checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1012, no: "4", itemCheck: "PUSH GAUGE RB", checkPoint: "TIDAK ADA SKRUP YANG KENDOR / HILANG", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1013, no: "4", itemCheck: "PUSH GAUGE RB", checkPoint: "ADA BANTALAN KARET (CUSHION) PADA UJUNGNYA", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1014, no: "4", itemCheck: "PUSH GAUGE RB", checkPoint: "LAMPU INDIKATOR MENYALA", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1015, no: "5", itemCheck: "DUMMY SAMPLE OK & N-OK", checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1016, no: "5", itemCheck: "DUMMY SAMPLE OK & N-OK", checkPoint: "SAMPLE DALAM KONDISI BAIK DAN TIDAK RUSAK", metodeCheck: "VISUAL", area: "CHECKER", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1017, no: "6", itemCheck: "IMPORTANT / INSPECTION POINT", checkPoint: "IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1018, no: "6", itemCheck: "IMPORTANT / INSPECTION POINT", checkPoint: "ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1019, no: "7", itemCheck: "FUSE PLATE", checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1020, no: "7", itemCheck: "FUSE PLATE", checkPoint: "WARNA DAN ANGKA ADA DAN TERBACA DENGAN JELAS", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1021, no: "7", itemCheck: "FUSE PLATE", checkPoint: "FUSE PLATE DALAM KONDISI BAIK DAN TIDAK RUSAK", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1022, no: "7", itemCheck: "FUSE PLATE", checkPoint: "FUSE INSERTION / PENEKAN FUSE DALAM KONDISI OK", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1023, no: "8", itemCheck: "LAMPU NAVIGASI", checkPoint: "LAMPU LED KONDISI MENYALA", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1024, no: "8", itemCheck: "LAMPU NAVIGASI", checkPoint: "COVER LED TIDAK HILANG ATAU PECAH", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1025, no: "8", itemCheck: "LAMPU NAVIGASI", checkPoint: "LAMPU LED TERPASANG SEMPURNA/TIDAK LEPAS", metodeCheck: "VISUAL", area: "VISUAL 1", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1026, no: "9", itemCheck: "TAPE NAVIGASI", checkPoint: "LAMPU LED KONDISI MENYALA", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1027, no: "9", itemCheck: "TAPE NAVIGASI", checkPoint: "KONDISI SWITCH TIDAK RUSAK", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1028, no: "9", itemCheck: "TAPE NAVIGASI", checkPoint: "ADA IDENTITAS TAPE", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1029, no: "10", itemCheck: "INSPECTION BOARD", checkPoint: "TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1030, no: "10", itemCheck: "INSPECTION BOARD", checkPoint: "APPROVAL SHEET SESUAI LEVEL TERAKHIR", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1031, no: "10", itemCheck: "INSPECTION BOARD", checkPoint: "APPROVAL SHEET DITANDA TANGANI QA", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1032, no: "10", itemCheck: "INSPECTION BOARD", checkPoint: "KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK", metodeCheck: "VISUAL", area: "VISUAL 2", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1033, no: "11", itemCheck: "DRY SURF", checkPoint: "BOTOL TIDAK BOCOR / RUSAK & ADA STICKER B3", metodeCheck: "VISUAL", area: "DOUBLE CHECK (RI)", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1034, no: "11", itemCheck: "DRY SURF", checkPoint: "SPONS / KUAS TIDAK RUSAK / AUS", metodeCheck: "VISUAL", area: "DOUBLE CHECK (RI)", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1035, no: "11", itemCheck: "DRY SURF", checkPoint: "ADA TANDA MAX & MIN PADA BOTOL DAN ISI CAIRAN SESUAI RENTANG MAX DAN MIN", metodeCheck: "VISUAL", area: "DOUBLE CHECK (RI)", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1036, no: "12", itemCheck: "PACKING", checkPoint: "KONDISI TUTUP POLYTAINER TIDAK RUSAK DAN JUMLAHNYA SUDAH SESUAI", metodeCheck: "VISUAL", area: "DOUBLE CHECK (RI)", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1037, no: "12", itemCheck: "PACKING", checkPoint: "HT SCAN BISA BERFUNGSI DENGAN BAIK", metodeCheck: "VISUAL", area: "DOUBLE CHECK (RI)", shifts: [{ shift: "A" }, { shift: "B" }] },
    { id: 1038, no: "12", itemCheck: "PACKING", checkPoint: "MAJUN DAN SIKAT POLYTAINER ADA PADA TEMPATNYA DAN SESUAI DENGAN JUMLAHNYA", metodeCheck: "VISUAL", area: "DOUBLE CHECK (RI)", shifts: [{ shift: "A" }, { shift: "B" }] },
  ]);

  // ===== ROLE =====
  const currentRole = user?.role || "inspector-qa";
  const isGroupLeader = currentRole === "group-leader-qa";
  const isInspector = currentRole === "inspector-qa";

  useEffect(() => {
    if (!loading && user) {
      setViewAs(isGroupLeader ? "group-leader" : "inspector");
    }
  }, [isGroupLeader, loading, user]);

  useEffect(() => {
    const currentCategory = viewAs === "group-leader" ? "final-assy-gl" : "final-assy-inspector";
    setSelectedArea(DEFAULT_AREA_BY_CATEGORY[currentCategory] || "");
  }, [viewAs]);

  const showGroupLeaderTable = viewAs === "group-leader";
  const showInspectorTable = viewAs === "inspector";

  // ===== UTILITY =====
  const getDateKey = (date: number) =>
    `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const getMonthName = (monthIndex: number) => [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ][monthIndex];

  const changeMonth = (direction: number) => {
    let newMonth = activeMonth + direction;
    let newYear = activeYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    else if (newMonth > 11) { newMonth = 0; newYear++; }
    setActiveMonth(newMonth);
    setActiveYear(newYear);
  };

  const categoryCode = useMemo(() => showGroupLeaderTable ? "final-assy-gl" : "final-assy-inspector", [showGroupLeaderTable]);

  const handleViewChange = useCallback((newView: "group-leader" | "inspector") => {
    const newCategory = newView === "group-leader" ? "final-assy-gl" : "final-assy-inspector";
    setViewAs(newView);
    setSelectedArea(DEFAULT_AREA_BY_CATEGORY[newCategory] || "");
  }, []);

  const handleGaugeSaved = useCallback((date: number, shift: "A" | "B", gaugeId: string, status: "OK" | "NG" | "-") => {
    const dateKey = getDateKey(date);
    const key = `${dateKey}-${shift}-${selectedArea}`;
    setGaugeResults(prev => ({ ...prev, [key]: { gaugeId, status } }));
  }, [selectedArea]);

  // ===== ✅ FETCH GL CHECKPOINTS FROM DB =====
  useEffect(() => {
    if (!showGroupLeaderTable) return;

    const fetchGLCheckpoints = async () => {
      setCheckpointsLoading(true);
      try {
        const res = await fetch(`/api/final-assy/get-checklist-items?type=group-leader`);
        const data = await res.json();

        if (!data.success || !Array.isArray(data.data)) {
          console.error("❌ Failed to fetch GL checkpoints:", data.error);
          return;
        }

        // Waktu check fallback (kolom waktu_check di DB kosong untuk GL)
        const waktuCheckFallback: Record<string, string> = {
          "1-A": "07:30 - 08:00", "1-B": "19:30 - 20:00",
          "2-A": "08:00 - 09:00", "2-B": "20:00 - 21:00",
          "3-A": "08:00 - 09:00", "3-B": "20:00 - 21:00",
          "4-A": "09:00 - 11:00", "4-B": "21:00 - 23:00",
          "5-A": "09:00 - 11:00", "5-B": "21:00 - 23:00",
          "6-A": "09:00 - 11:00", "6-B": "21:00 - 23:00",
          "7-A": "11:00 - 12:00", "7-B": "23:00 - 24:00",
          "8-A": "11:00 - 12:00", "8-B": "23:00 - 24:00",
          "9-A": "13:00 - 14:00", "9-B": "01:00 - 02:00",
          "10-A": "14:00 - 15:00", "10-B": "02:00 - 03:00",
          "11-A": "Setiap Hari Senin", "11-B": "Setiap Hari Senin",
          "12-A": "Setiap Hari Senin", "12-B": "Setiap Hari Senin",
          "13-A": "Setiap Hari Selasa", "13-B": "Setiap Hari Selasa",
          "14-A": "Setiap Hari Rabu", "14-B": "Setiap Hari Rabu",
          "15-A": "Setiap Hari Selasa", "15-B": "Setiap Hari Selasa",
          "16-A": "Setiap Hari", "16-B": "Setiap Hari",
          "17-A": "Setiap Hari Selasa", "17-B": "Setiap Hari Selasa",
          "18-A": "Setiap Hari Selasa", "18-B": "Setiap Hari Selasa",
        };

        // Standard / Metode fallback dari Excel (jika DB kolom metode_check kosong)
        const metodeCheckFallback: Record<string, string> = {
          "Check 4M kondisi, product yang mengalami perubahan 4M sudah di check dan tidak ada masalah": "Absensi Inspector",
          "Dilakukan pengecheckan HLC checker fixture dengan alignment gauge oleh inspector checker di akhir shift / checker fixture tidak terpakai": "Check Sheet HLC Checker",
          "Torque wrench ada nomor registrasi & kalibrasi tidak expired": "Check Actual Torque Wrench",
          "Jarum penunjukan cocok dengan titik nol dan semua bagian torque wrench tidak ada yang rusak": "Check Actual Torque Wrench",
          "Kondisi tool dan gauge di area inspection tidak ada yang rusak atau hilang dan ada identitasnya": "Check Actual Tool / Gauge",
          "Setting connector ke checker fixture dilakukan dengan hati-hati, tidak menimbulkan defect damaged connector / bent terminal": "QA-ACL-FA-IS-046",
          "Inspection board dipasang cover jika tidak ada loading": "Check Actual Kondisi Board",
          "Box / politener harness finish good yang quantity-nya tidak standard diberi identitas yang jelas": "Ada Identitas Qty Tidak Standard",
          "Box / politener pada saat proses dipasang tutup pada bagian atasnya": "Check Actual Polinter",
          "Pengisian LKI dan DP oleh inspector sudah dilakukan dengan benar": "Check Actual LKI",
          "Harness defect di hanger merah dipasang defect tag dan pengisian defect tag sudah dilakukan dengan benar": "Check Deffect Tag",
          "Identitas Assy number pada visual board sudah update sesuai D/C terakhir": "Check Actual",
          "Cek license card inspector (ada license card, tidak rusak, tidak expired, terpasang dengan benar)": "Check Actual",
          "Inspection point / Important point yang dipasang tidak ada yang rusak dan up to date, check area Sub Assy sampai Receiving Inspection": "Check important Point",
          "Inspector bekerja sesuai dengan SWCT": "SWCT Inspector",
          "Stop kontak dalam keadaan bersih tidak berdebu dan lubang yang tidak dipergunakan ditutup dengan cover (SAFETY)": "Check Actual",
          "Memastikan semua inspector menggunakan penutup kepala (Topi / Jilbab)": "Check Actual",
          "Cek Magic Pile yang digunakan di area inspeksi & produksi dalam kondisi baik (tidak sobek, tidak berserabut & resleting dalam kondisi baik)": "Check Actual",
          "Dummy Sample OK & N-OK Air Checker di area Sigage ada no registrasi, verifikasi tidak expired serta dalam kondisi baik dan tidak rusak": "Check Actual",
        };

        // API bisa mengembalikan data dalam 2 format:
        // Format A: satu item per shift → {id:1, shifts:[{shift:"A"}]}, {id:2, shifts:[{shift:"B"}]}
        // Format B: satu item dengan kedua shift → {id:1, shifts:[{shift:"A"},{shift:"B"}]}
        //
        // Kita handle kedua format dengan "expand" setiap item menjadi entri per shift
        interface ExpandedItem { id: number; no: string; checkPoint: string; shift: "A" | "B"; waktuCheck: string; metodeCheck: string; standard: string; }
        const expanded: ExpandedItem[] = [];

        (data.data as any[]).forEach((item) => {
          const shiftsArr: Array<{shift: string}> = item.shifts || [];
          if (shiftsArr.length === 0) {
            // Tidak ada shifts info, assume A
            expanded.push({ id: item.id, no: item.no || "", checkPoint: item.checkPoint, shift: "A", waktuCheck: item.waktuCheck || "", metodeCheck: item.metodeCheck || item.standard || "" , standard: item.metodeCheck || item.standard || ""});
          } else if (shiftsArr.length === 1) {
            // Satu shift per item (Format A - flat)
            const s = (shiftsArr[0].shift as string) === "B" ? "B" : "A";
            expanded.push({ id: item.id, no: item.no || "", checkPoint: item.checkPoint, shift: s, waktuCheck: item.waktuCheck || "", metodeCheck: item.metodeCheck || item.standard || "", standard: item.metodeCheck || item.standard || "" });
          } else {
            // Multiple shifts dalam satu item (Format B) - expand
            shiftsArr.forEach((sd: any) => {
              const s = (sd.shift as string) === "B" ? "B" : "A";
              expanded.push({ id: item.id, no: item.no || "", checkPoint: item.checkPoint, shift: s, waktuCheck: sd.waktuCheck || item.waktuCheck || "", metodeCheck: item.metodeCheck || item.standard || "", standard: item.metodeCheck || item.standard || "" });
            });
          }
        });

        // Group per checkPoint, pisahkan shift A dan B
        const grouped = new Map<string, { shiftA?: ExpandedItem; shiftB?: ExpandedItem }>();
        expanded.forEach((e) => {
          if (!grouped.has(e.checkPoint)) grouped.set(e.checkPoint, {});
          const g = grouped.get(e.checkPoint)!;
          if (e.shift === "A") g.shiftA = e;
          else g.shiftB = e;
        });

        const result: CheckPoint[] = [];
        grouped.forEach((g, checkPointText) => {
          const rep = g.shiftA || g.shiftB!;
          const no = rep.no || "";

          let type: "normal" | "special" | "weekly" = "normal";
          if (!no || no.trim() === "") type = "special";
          else if (checkPointText.toLowerCase().includes("swct")) type = "weekly";

          const shifts: Array<{ shift: "A" | "B"; waktuCheck: string }> = [];
          if (g.shiftA) shifts.push({ shift: "A", waktuCheck: g.shiftA.waktuCheck || waktuCheckFallback[`${no}-A`] || "" });
          if (g.shiftB) shifts.push({ shift: "B", waktuCheck: g.shiftB.waktuCheck || waktuCheckFallback[`${no}-B`] || "" });
          else {
            // Jika tidak ada shift B dari API, buat tetap tampil dengan waktu fallback
            shifts.push({ shift: "B", waktuCheck: waktuCheckFallback[`${no}-B`] || "" });
          }

          result.push({
            id: g.shiftA?.id ?? rep.id,   // ← ID shift A dari DB
            idB: g.shiftB?.id ?? (g.shiftA?.id ?? rep.id) + 1, // ← ID shift B (estimasi jika tidak ada)
            no,
            checkPoint: checkPointText,
            shifts,
            // Prioritas: dari DB (metodeCheck/standard) → fallback dari Excel data
            standard: rep.metodeCheck || rep.standard || metodeCheckFallback[checkPointText] || "",
            type,
          });
        });

        console.log(`✅ Loaded ${result.length} GL checkpoints from DB`);
        setCheckpoints(result);
      } catch (err) {
        console.error("❌ Error fetching GL checkpoints:", err);
      } finally {
        setCheckpointsLoading(false);
      }
    };

    fetchGLCheckpoints();
  }, [showGroupLeaderTable]);

  // ===== ✅ FETCH INSPECTOR ITEM IDs FROM DB =====
  // Inspector hardcoded items pakai id=1000-1038 (fake untuk rendering)
  // tapi DB menyimpan hasil dengan item_id yang asli (1, 2, 3...)
  // Kita buat map: checkPoint_text → real_db_id untuk lookup yang benar
  useEffect(() => {
    if (showGroupLeaderTable) return; // hanya fetch saat inspector view

    const fetchInspectorIds = async () => {
      try {
        const res = await fetch(`/api/final-assy/get-checklist-items?type=inspector`);
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) return;

        // Buat map: checkPoint text → DB item_id (shift A)
        // Key: "checkPoint|shift" → DB id
        const idMap: Record<string, number> = {};
        (data.data as any[]).forEach((item: any) => {
          const shiftsArr: Array<{shift: string}> = item.shifts || [];
          if (shiftsArr.length <= 1) {
            // Flat format: satu item per shift
            const s = item.shift || shiftsArr[0]?.shift || "A";
            const key = `${item.checkPoint}|${s}`;
            idMap[key] = item.id;
          } else {
            // Semua shift dalam satu item
            shiftsArr.forEach((sd: any) => {
              const key = `${item.checkPoint}|${sd.shift}`;
              idMap[key] = item.id;
            });
          }
        });

        console.log(`✅ Loaded inspector ID map: ${Object.keys(idMap).length} entries`);
        setInspectorIdMap(idMap);
      } catch (err) {
        console.error("❌ Error fetching inspector IDs:", err);
      }
    };

    fetchInspectorIds();
  }, [showGroupLeaderTable]);

  // ===== CHECK DATE RULES =====
  const checkpointDateRules: Record<string, number[]> = {
    "GO NO GO: BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK: A": [1, 8, 15, 22, 29],
    "GO NO GO: BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK: B": [3, 10, 17, 24, 31],
    "IMPORTANT / INSPECTION POINT: IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK: A": [1, 8, 15, 22, 29],
    "IMPORTANT / INSPECTION POINT: IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK: B": [3, 10, 17, 24, 31],
    "IMPORTANT / INSPECTION POINT: ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU: A": [1, 8, 15, 22, 29],
    "IMPORTANT / INSPECTION POINT: ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: APPROVAL SHEET SESUAI LEVEL TERAKHIR: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: APPROVAL SHEET SESUAI LEVEL TERAKHIR: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: APPROVAL SHEET DITANDA TANGANI QA: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: APPROVAL SHEET DITANDA TANGANI QA: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK: B": [3, 10, 17, 24, 31],
  };

  const isCheckDate = (item: InspectorCheckItem | CheckPoint, shift: "A" | "B", date: number): boolean => {
    if ("itemCheck" in item) {
      const ruleKey = `${item.itemCheck}: ${item.checkPoint}: ${shift}`;
      const checkDates = checkpointDateRules[ruleKey];
      if (!checkDates) return true;
      return checkDates.includes(date);
    }
    const ruleKey = item.checkPoint;
    const checkDates = checkpointDateRules[ruleKey];
    if (!checkDates) return true;
    return checkDates.includes(date);
  };

  // ===== API CALLS =====
  const loadDataFromDB = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const monthKey = `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}`;
      const areaParam = selectedArea ? `&areaCode=${encodeURIComponent(selectedArea)}` : "";
      const carlineParam = selectedCarline ? `&carline=${encodeURIComponent(selectedCarline)}` : "";
      const lineParam = selectedLine ? `&line=${encodeURIComponent(selectedLine)}` : "";

      if (showGroupLeaderTable) {
        const [resultsRes, signaturesRes] = await Promise.all([
          fetch(`/api/final-assy/get-results?userId=${user.id}&categoryCode=final-assy-gl&month=${monthKey}&role=${currentRole}${areaParam}${carlineParam}${lineParam}`),
          fetch(`/api/final-assy/get-signatures?userId=${user.id}&categoryCode=final-assy-gl&month=${monthKey}&role=${currentRole}${areaParam}${carlineParam}${lineParam}`),
        ]);
        if (!resultsRes.ok || !signaturesRes.ok) throw new Error("Gagal memuat data dari server");
        const resultsData = await resultsRes.json();
        const signaturesData = await signaturesRes.json();
        if (resultsData.success) setGroupLeaderResults(resultsData.formatted);
        if (signaturesData.success) setGlSignaturesGroupLeader(signaturesData.formatted);
      }

      if (showInspectorTable) {
        const [resultsRes, signaturesRes] = await Promise.all([
          fetch(`/api/final-assy/get-results?userId=${user.id}&categoryCode=final-assy-inspector&month=${monthKey}&role=${currentRole}${areaParam}${carlineParam}${lineParam}`),
          fetch(`/api/final-assy/get-signatures?userId=${user.id}&categoryCode=final-assy-inspector&month=${monthKey}&role=${currentRole}${areaParam}${carlineParam}${lineParam}`),
        ]);
        if (!resultsRes.ok || !signaturesRes.ok) throw new Error("Gagal memuat data inspector dari server");
        const resultsData = await resultsRes.json();
        const signaturesData = await signaturesRes.json();
        if (resultsData.success) setInspectorResults(resultsData.formatted);
        if (signaturesData.success) setGlSignaturesInspector(signaturesData.formatted);
      }
    } catch (error) {
      console.error("❌ Error loading from DB:", error);
      setError(error instanceof Error ? error.message : "Gagal memuat data dari database");
    } finally {
      setIsLoading(false);
    }
  };

  // Load area_id when selectedArea changes and reset carline/line
  useEffect(() => {
    if (!selectedArea) return;
    
    // Reset carline and line when area changes
    setSelectedCarline("");
    setSelectedLine("");
    
    const loadAreaId = async () => {
      try {
        const res = await fetch(`/api/final-assy/get-area-id?areaCode=${encodeURIComponent(selectedArea)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.id) {
            setSelectedAreaId(data.id);
          }
        }
      } catch (error) {
        console.error('Error loading area_id:', error);
      }
    };
    
    loadAreaId();
  }, [selectedArea]);

  useEffect(() => {
    if (!user?.id || !selectedArea) return;
    loadDataFromDB();
  }, [user?.id, activeMonth, activeYear, viewAs, selectedArea, selectedCarline, selectedLine];

  // ===== DYNAMIC DATES =====
  const dynamicDates = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [activeMonth, activeYear]);

  const today = new Date().getDate();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isCurrentMonth = activeMonth === currentMonth && activeYear === currentYear;

  // ===== GET RESULT & SIGNATURE =====
  // ✅ FIX SHIFT B: getResult untuk GL checkpoints perlu ID yang berbeda per shift
  // DB: id=1 (checkpoint 1 shift A), id=2 (checkpoint 1 shift B)
  // Untuk shift A → cari dengan checkpoint.id (ID shift A)
  // Untuk shift B → cari dengan checkpoint.idB (ID shift B)
  const getResultForCheckpoint = (date: number, checkpoint: CheckPoint, shift: "A" | "B") => {
    const dateKey = getDateKey(date);
    const results = groupLeaderResults;
    const itemId = shift === "B" && checkpoint.idB ? checkpoint.idB : checkpoint.id;
    const key = `${itemId}-${shift}`;
    return results[dateKey]?.[key] || null;
  };

  const getResult = (date: number, checkpointId: number, shift: "A" | "B", type: "group-leader" | "inspector") => {
    const dateKey = getDateKey(date);
    const key = `${checkpointId}-${shift}`;
    const results = type === "group-leader" ? groupLeaderResults : inspectorResults;
    return results[dateKey]?.[key] || null;
  };

  const getGLSignature = (date: number, shift: "A" | "B", type: "group-leader" | "inspector"): "-" | "OK" => {
    const dateKey = getDateKey(date);
    const signatures = type === "group-leader" ? glSignaturesGroupLeader : glSignaturesInspector;
    return signatures[dateKey]?.[shift] || "-";
  };

  // ===== NG DETAIL MODAL =====
  const openNgDetailModal = (date: number, itemId: number, shift: "A" | "B", type: "group-leader" | "inspector") => {
    const result = getResult(date, itemId, shift, type);
    if (!result || result.status !== "NG") return;

    let itemName = "";
    let checkPoint = "";
    if (type === "inspector") {
      const item = inspectorCheckItems.find((i) => i.id === itemId);
      if (item) { itemName = item.itemCheck; checkPoint = item.checkPoint; }
    } else {
      // itemId bisa berupa ID shift A atau shift B
      const cp = checkpoints.find((c) => c.id === itemId || c.idB === itemId);
      if (cp) { itemName = `Checkpoint ${cp.no}`; checkPoint = cp.checkPoint; }
    }

    setNgDetailModal({
      date, itemId, itemName, checkPoint, shift,
      ngDescription: result.ngDescription || "-",
      ngDepartment: result.ngDepartment || "-",
      submittedBy: result.submittedBy || "-",
      submittedAt: result.submittedAt || "-",
    });
  };

  // ===== RENDER STATUS CELL =====
  const getBgColor = (status: string) => {
    if (status === "OK") return "#4caf50";
    if (status === "NG") return "#f44336";
    return "#9e9e9e";
  };

  const renderStatusBadge = (currentStatus: string, onClick?: () => void) => (
    <span
      onClick={onClick}
      style={{
        display: "inline-block", width: "100%",
        backgroundColor: getBgColor(currentStatus), color: "white",
        padding: "6px 8px", borderRadius: "4px",
        fontWeight: "600", fontSize: "12px", textAlign: "center",
        cursor: currentStatus === "NG" ? "pointer" : "default",
      }}
      title={currentStatus === "NG" ? "Klik untuk lihat detail NG" : undefined}
    >
      {currentStatus === "OK" ? "✓ OK" : currentStatus === "NG" ? "✗ NG" : "-"}
    </span>
  );

  const renderStatusCell = (date: number, checkpoint: CheckPoint, shift: "A" | "B") => {
    const shouldCheck = isCheckDate(checkpoint, shift, date);
    if (!shouldCheck) return <span style={{ color: "#cbd5e1" }}>-</span>;

    // ✅ Gunakan getResultForCheckpoint agar shift B pakai ID shift B yang benar
    const result = getResultForCheckpoint(date, checkpoint, shift);
    const currentStatus = result?.status || "-";

    // Khusus checkpoint "Kondisi tool dan gauge" (Scan QR Button)
    // Cari berdasarkan checkPoint text karena ID bisa beda
    const isGaugeCheckpoint = checkpoint.checkPoint.toLowerCase().includes("kondisi tool dan gauge");
    if (isGaugeCheckpoint) {
      const dateKey = getDateKey(date);
      const gaugeKey = `${dateKey}-${shift}-${selectedArea}`;
      const gaugeResult = gaugeResults[gaugeKey];
      const gaugeStatus = gaugeResult?.status || currentStatus;
      return (
        <ScanGaugeButton
          dateKey={dateKey} shift={shift}
          userId={user?.id || ""} nik={user?.nik || ""}
          areaCode={selectedArea}
          existingStatus={gaugeStatus as "OK" | "NG" | "-"}
          editable={false}
          onSaved={(gaugeId, status) => handleGaugeSaved(date, shift, gaugeId, status)}
        />
      );
    }

    const itemId = shift === "B" && checkpoint.idB ? checkpoint.idB : checkpoint.id;
    return renderStatusBadge(
      currentStatus,
      currentStatus === "NG" ? () => openNgDetailModal(date, itemId, shift, "group-leader") : undefined
    );
  };

  const renderInspectorStatusCell = (date: number, itemId: number, shift: "A" | "B") => {
    const item = inspectorCheckItems.find((i) => i.id === itemId);
    if (!item) return null;
    if (!isCheckDate(item, shift, date)) return <span style={{ color: "#cbd5e1" }}>-</span>;

    // ✅ FIX: Gunakan real DB id dari inspectorIdMap, bukan hardcoded id (1000-1038)
    // DB menyimpan hasil dengan item_id asli dari tabel checklist_items
    // inspectorCheckItems.id adalah fake id (1000-1038) untuk kebutuhan rendering saja
    const dbItemId = inspectorIdMap[`${item.checkPoint}|${shift}`] || itemId;
    const result = getResult(date, dbItemId, shift, "inspector");
    const currentStatus = result?.status || "-";
    return renderStatusBadge(
      currentStatus,
      currentStatus === "NG" ? () => openNgDetailModal(date, dbItemId, shift, "inspector") : undefined
    );
  };

  const renderESOCell = (date: number, shift: "A" | "B") => {
    const dayOfWeek = new Date(activeYear, activeMonth, date).getDay();
    if (dayOfWeek !== 2 && dayOfWeek !== 4) return <span style={{ color: "#cbd5e1" }}>-</span>;

    const esoCheckpoint = checkpoints.find((cp) => cp.type === "special");
    if (!esoCheckpoint) return <span style={{ color: "#cbd5e1" }}>-</span>;

    const result = getResult(date, esoCheckpoint.id, shift, "group-leader");
    const currentStatus = result?.status || "-";
    return (
      <span
        onClick={() => currentStatus === "NG" ? openNgDetailModal(date, esoCheckpoint.id, shift, "group-leader") : undefined}
        style={{
          display: "inline-block", width: "100%",
          backgroundColor: getBgColor(currentStatus), color: "white",
          padding: "4px 6px", borderRadius: "4px",
          fontWeight: "600", fontSize: "11px", textAlign: "center",
          cursor: currentStatus === "NG" ? "pointer" : "default",
        }}
      >
        {currentStatus === "OK" ? "✓ OK" : currentStatus === "NG" ? "✗ NG" : "-"}
      </span>
    );
  };

  const title = showGroupLeaderTable
    ? "📊 Summary Checklist Group Leader - Final Assy"
    : "📊 Summary Checklist Inspector - Final Assy";

  if (loading) return <div style={{ textAlign: "center", padding: "50px" }}><p>Memuat...</p></div>;
  if (!user) return null;

  const userName = user.fullName || user.username;

  return (
    <>
      <Sidebar userName={userName} />
      <div className="page-content">
        {/* HEADER */}
        <div className="header">
          <h1>{title}</h1>
          <div className="header-controls">
            {isGroupLeader && (
              <select value={viewAs} onChange={(e) => handleViewChange(e.target.value as "group-leader" | "inspector")} className="view-dropdown-fa">
                <option value="group-leader">Daily Check GL</option>
                <option value="inspector">Daily Check Inspector</option>
              </select>
            )}
            <div className="role-info">Role: <span className="role-badge">{isGroupLeader ? "Group Leader QA" : "Inspector QA"}</span></div>
          </div>
        </div>

  {/* AREA, CARLINE, LINE FILTERS */}
  <div className="filter-area" style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap", justifyContent: "space-between" }}>
    <AreaFilter
      categoryCode={categoryCode}
      selectedArea={selectedArea}
      onAreaChange={setSelectedArea}
      isLoading={isLoading}
      defaultAreaCode={DEFAULT_AREA_BY_CATEGORY[categoryCode]}
    />
    <CarlineLineFilter
      selectedCarline={selectedCarline}
      selectedLine={selectedLine}
      onCarlineChange={setSelectedCarline}
      onLineChange={setSelectedLine}
      isLoading={isLoading}
      areaId={selectedAreaId}
      selectedArea={selectedArea}
    />
  </div>

        {/* INFO BOX */}
        <div style={{ backgroundColor: "#e3f2fd", border: "1px solid #90caf9", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px" }}>
          <strong>📌 Mode View Only:</strong> Halaman ini hanya menampilkan hasil checklist yang telah diisi. Klik status{" "}
          <span style={{ color: "#f44336", fontWeight: "bold" }}>NG</span> untuk melihat detail temuan.
        </div>

        {/* MONTH NAVIGATION */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <button className="month-button" onClick={() => changeMonth(-1)}>← Bulan Lalu</button>
          <span style={{ fontSize: "14px", fontWeight: "bold" }}>{getMonthName(activeMonth)} {activeYear}</span>
          <button className="month-button" onClick={() => changeMonth(1)}>Bulan Depan →</button>
        </div>

        {/* LOADING */}
        {(isLoading || checkpointsLoading) && (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div style={{ display: "inline-block", width: "40px", height: "40px", border: "4px solid #1976d2", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <p style={{ marginTop: "10px", color: "#666" }}>Memuat data...</p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div style={{ backgroundColor: "#fee", color: "#c33", padding: "12px", borderRadius: "8px", marginBottom: "15px", borderLeft: "4px solid #c33" }}>
            <strong>Error: </strong>{error}
          </div>
        )}

        {/* TABLE */}
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          {showGroupLeaderTable ? (
            <table className="status-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", minWidth: "40px" }}>NO</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", minWidth: "280px" }}>CHECK POINT</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", minWidth: "45px" }}>SHIFT</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", minWidth: "90px" }}>WAKTU CHECK</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", minWidth: "90px" }}>STANDARD / METODE</th>
                  <th colSpan={dynamicDates.length} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", backgroundColor: "#e3f2fd", fontWeight: "bold", fontSize: "1rem" }}>
                    {getMonthName(activeMonth)} {activeYear}
                  </th>
                </tr>
                <tr>
                  {dynamicDates.map((date) => (
                    <th key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", minWidth: "32px", backgroundColor: isCurrentMonth && date === today ? "#fff8e1" : "inherit", color: isCurrentMonth && date === today ? "#e65100" : "inherit", fontWeight: isCurrentMonth && date === today ? "bold" : "normal" }}>
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checkpoints.length === 0 && !checkpointsLoading ? (
                  <tr><td colSpan={5 + dynamicDates.length} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Tidak ada data checkpoint</td></tr>
                ) : (
                  checkpoints.map((cp) => {
                    const currentNo = cp.no;
                    const sameNoItems = checkpoints.filter((c) => c.no === currentNo);
                    const isFirstOfGroup = sameNoItems[0].id === cp.id;
                    const groupRowSpan = sameNoItems.reduce((sum, item) => sum + item.shifts.filter((s) => s.waktuCheck !== " ").length, 0);

                    if (cp.type === "special") {
                      return (
                        <tr key={`cp-${cp.id}`}>
                          <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}></td>
                          <td colSpan={3} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "left" }}>{cp.checkPoint}</td>
                          <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.standard}</td>
                          {dynamicDates.map((date) => (
                            <td key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", backgroundColor: isCurrentMonth && date === today ? "#e3f2fd" : "inherit" }}>
                              {renderESOCell(date, "A")}
                            </td>
                          ))}
                        </tr>
                      );
                    }

                    if (cp.type === "weekly") {
                      return (
                        <React.Fragment key={`cp-${cp.id}`}>
                          <tr>
                            {isFirstOfGroup && <td rowSpan={3} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.no}</td>}
                            <td rowSpan={3} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "left" }}>{cp.checkPoint}</td>
                            <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}></td>
                            <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}></td>
                            {isFirstOfGroup && <td rowSpan={3} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.standard}</td>}
                            {dynamicDates.map((date) => (
                              <td key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{`week-${Math.ceil(date / 7)}`}</td>
                            ))}
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>A</td>
                            <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.shifts[0]?.waktuCheck}</td>
                            {dynamicDates.map((date) => (
                              <td key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", backgroundColor: isCurrentMonth && date === today ? "#e3f2fd" : "inherit" }}>
                                {renderStatusCell(date, cp, "A")}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>B</td>
                            <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.shifts[1]?.waktuCheck}</td>
                            {dynamicDates.map((date) => (
                              <td key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", backgroundColor: isCurrentMonth && date === today ? "#e3f2fd" : "inherit" }}>
                                {renderStatusCell(date, cp, "B")}
                              </td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={`cp-${cp.id}`}>
                        {cp.shifts.map((shiftData, shiftIdx) => {
                          if (shiftData.waktuCheck === " ") return null;
                          return (
                            <tr key={`${cp.id}-${shiftIdx}`}>
                              {shiftIdx === 0 && isFirstOfGroup && (
                                <td rowSpan={groupRowSpan} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.no}</td>
                              )}
                              {shiftIdx === 0 && (
                                <td rowSpan={cp.shifts.filter((s) => s.waktuCheck !== " ").length} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "left" }}>{cp.checkPoint}</td>
                              )}
                              <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{shiftData.shift}</td>
                              <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{shiftData.waktuCheck}</td>
                              {shiftIdx === 0 && isFirstOfGroup && (
                                <td rowSpan={groupRowSpan} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>{cp.standard}</td>
                              )}
                              {dynamicDates.map((date) => (
                                <td key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", backgroundColor: isCurrentMonth && date === today ? "#e3f2fd" : "inherit" }}>
                                  {renderStatusCell(date, cp, shiftData.shift)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}

                {/* SIGNATURE ROW */}
                <tr>
                  <td style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}></td>
                  <td colSpan={4} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>Tanda tangan GL Inspector</td>
                  {dynamicDates.map((date) => {
                    const signatureStatus = getGLSignature(date, "A", "group-leader");
                    return (
                      <td key={date} style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center" }}>
                        <span style={{ display: "inline-block", width: "100%", backgroundColor: signatureStatus === "OK" ? "#4caf50" : "#9e9e9e", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px" }}>
                          {signatureStatus === "OK" ? "✓ OK" : "-"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          ) : showInspectorTable ? (
            // Inspector table — sama seperti sebelumnya
            <table className="status-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-no">NO</th>
                  <th rowSpan={2} className="col-item-check">ITEM CHECK</th>
                  <th rowSpan={2} className="col-checkpoint">CHECK POINT</th>
                  <th rowSpan={2} className="col-metode">METODE CHECK</th>
                  <th colSpan={5} className="col-area">AREA</th>
                  <th rowSpan={2} className="col-shift">SHIFT</th>
                  <th colSpan={dynamicDates.length} className="month-header">{getMonthName(activeMonth)} {activeYear}</th>
                </tr>
                <tr>
                  <th className="col-wp-check">WP CHECK</th>
                  <th className="col-checker">CHECKER</th>
                  <th className="col-visual-1">VISUAL 1</th>
                  <th className="col-visual-2">VISUAL 2</th>
                  <th className="col-double-check">DOUBLE CHECK (RI)</th>
                  {dynamicDates.map((date) => (
                    <th key={date} className={`col-date ${isCurrentMonth && date === today ? "col-date-today" : ""}`}>{date}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  inspectorCheckItems.reduce((groups, item) => {
                    const group = groups[item.no] || [];
                    group.push(item);
                    groups[item.no] = group;
                    return groups;
                  }, {} as Record<string, InspectorCheckItem[]>)
                ).map(([no, items]) => {
                  return items.map((item, itemIdx) => {
                    let itemCheckCount = 1;
                    let nextIdx = itemIdx + 1;
                    while (nextIdx < items.length && items[nextIdx].itemCheck === item.itemCheck) { itemCheckCount++; nextIdx++; }
                    let checkPointCount = 1;
                    let nextCheckIdx = itemIdx + 1;
                    while (nextCheckIdx < items.length && items[nextCheckIdx].checkPoint === item.checkPoint) { checkPointCount++; nextCheckIdx++; }
                    const itemCheckRows = itemCheckCount * 2;
                    const checkPointRows = checkPointCount * 2;

                    return (
                      <React.Fragment key={`item-${item.id}`}>
                        <tr>
                          {itemIdx === 0 && <td className="col-no" rowSpan={items.length * 2}>{no}</td>}
                          {(itemIdx === 0 || items[itemIdx - 1].itemCheck !== item.itemCheck) && (
                            <td className="col-item-check" rowSpan={itemCheckRows}>{item.itemCheck}</td>
                          )}
                          {(itemIdx === 0 || items[itemIdx - 1].checkPoint !== item.checkPoint) && (
                            <td className="col-checkpoint" rowSpan={checkPointRows}>{item.checkPoint}</td>
                          )}
                          <td className="col-metode" rowSpan={2}>{item.metodeCheck}</td>
                          {(itemIdx === 0 || items[itemIdx - 1].itemCheck !== item.itemCheck) && (
                            <>
                              <td className="col-wp-check" rowSpan={itemCheckRows}>O</td>
                              <td className="col-checker" rowSpan={itemCheckRows}>O</td>
                              <td className="col-visual-1" rowSpan={itemCheckRows}>O</td>
                              <td className="col-visual-2" rowSpan={itemCheckRows}>O</td>
                              <td className="col-double-check" rowSpan={itemCheckRows}>O</td>
                            </>
                          )}
                          <td className="col-shift">A</td>
                          {dynamicDates.map((date) => (
                            <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${!isCheckDate(item, "A", date) ? "bg-gray-200" : ""}`}>
                              {renderInspectorStatusCell(date, item.id, "A")}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="col-shift">B</td>
                          {dynamicDates.map((date) => (
                            <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${!isCheckDate(item, "B", date) ? "bg-gray-200" : ""}`}>
                              {renderInspectorStatusCell(date, item.id, "B")}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  });
                })}
                {/* SIGNATURE ROW */}
                <tr>
                  <td style={{ border: "none" }} rowSpan={2} colSpan={5}></td>
                  <td rowSpan={2} colSpan={4} className="col-wp-check">SIGN / CHECK OLEH GL INSPECTOR</td>
                  <td className="col-shift">A</td>
                  {dynamicDates.map((date) => {
                    const s = getGLSignature(date, "A", "inspector");
                    return (
                      <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}>
                        <span className="status-dropdown" style={{ backgroundColor: s === "OK" ? "#4caf50" : "#9e9e9e", color: "white" }}>
                          {s === "OK" ? "✓ OK" : "-"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="col-shift">B</td>
                  {dynamicDates.map((date) => {
                    const s = getGLSignature(date, "B", "inspector");
                    return (
                      <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}>
                        <span className="status-dropdown" style={{ backgroundColor: s === "OK" ? "#4caf50" : "#9e9e9e", color: "white" }}>
                          {s === "OK" ? "✓ OK" : "-"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {/* NG DETAIL MODAL */}
      {ngDetailModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }} onClick={() => setNgDetailModal(null)}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "24px", maxWidth: "500px", width: "90%", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "12px", borderBottom: "2px solid #f0f0f0" }}>
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "20px", fontWeight: "700" }}>⚠️ Detail Temuan NG</h2>
              <button onClick={() => setNgDetailModal(null)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#64748b" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "16px" }}>
                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#991b1b", fontWeight: "600" }}>ITEM CHECK</p>
                <p style={{ margin: "0 0 12px", fontSize: "16px", color: "#7f1d1d", fontWeight: "600" }}>{ngDetailModal.itemName}</p>
                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#991b1b", fontWeight: "600" }}>CHECK POINT</p>
                <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#7f1d1d" }}>{ngDetailModal.checkPoint}</p>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#991b1b", fontWeight: "600" }}>TANGGAL</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "#7f1d1d" }}>{activeYear}-{String(activeMonth + 1).padStart(2, "0")}-{String(ngDetailModal.date).padStart(2, "0")}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#991b1b", fontWeight: "600" }}>SHIFT</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "#7f1d1d" }}>{ngDetailModal.shift}</p>
                  </div>
                </div>
              </div>
              <div>
                <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#1e293b", fontWeight: "600" }}>📝 Keterangan NG:</p>
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>
                  {ngDetailModal.ngDescription}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Departemen</p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#1e293b" }}>{ngDetailModal.ngDepartment}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Diisi Oleh</p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#1e293b" }}>{ngDetailModal.submittedBy}</p>
                </div>
              </div>
              <button onClick={() => setNgDetailModal(null)} style={{ width: "100%", padding: "12px", backgroundColor: "#1e88e5", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "20px" }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .status-dropdown { width: 100%; padding: 2px 4px; font-size: 0.65rem; font-weight: 600; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; text-align: center; }
        .bg-blue-50 { background-color: #e3f2fd !important; }
        .bg-gray-200 { background-color: #e0e0e0 !important; }
        .col-date-today { background-color: #fff8e1 !important; color: #e65100 !important; font-weight: bold !important; }
        .status-table { width: 100%; border-collapse: collapse; font-size: 0.7rem; }
        .status-table th, .status-table td { border: 1px solid #000; padding: 4px 6px; text-align: center; }
        .col-no { min-width: 30px; }
        .col-item-check { min-width: 120px; }
        .col-checkpoint { min-width: 200px; }
        .col-metode { min-width: 70px; }
        .col-area { min-width: 60px; }
        .col-shift { min-width: 40px; }
        .col-date { min-width: 35px; }
        .col-wp-check, .col-checker, .col-visual-1, .col-visual-2, .col-double-check { min-width: 50px; }
        .month-header { background-color: #e3f2fd; font-weight: bold; font-size: 1rem; }
        @media (max-width: 768px) {
          .status-table { font-size: 0.6rem; }
          .status-table th, .status-table td { padding: 2px 4px; border: 0.5px solid #999; }
          .col-item-check { min-width: 80px; }
          .col-checkpoint { min-width: 100px; }
          .col-date { min-width: 28px; }
        }
      `}</style>
    </>
  );
}
