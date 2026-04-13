// app/status-final-assy/page.tsx
"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { ScanGaugeButton } from "@/components/ScanGaugeButton";

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================
interface CheckPoint {
  id: number;
  idB?: number;
  no: string;
  checkPoint: string;
  shifts: Array<{ shift: "A" | "B"; waktuCheck: string }>;
  standard: string;
  type?: "normal" | "special" | "weekly";
}

interface CheckResult {
  status: "OK" | "NG" | "-";
  submittedAt: string;
  submittedBy: string;
  ngDescription?: string;
  ngDepartment?: string;
  ngPhotos?: string | null;
}

interface InspectorItem {
  no: string;
  itemCheck: string;
}

interface NGModal {
  date: number;
  shift: "A" | "B";
  itemName: string;
  ngChoices: string[];
  ngOtherNote: string;
  ngPhotos: string[];
  ngDepartment: string;
  submittedBy: string;
  submittedAt: string;
}

// =====================================================================
// AREA FILTER
// =====================================================================
interface AreaOption { id: number; area_name: string; area_code: string; sort_order: number; }

function AreaFilter({ categoryCode, selectedArea, onAreaChange, isLoading = false, defaultAreaCode }: {
  categoryCode: string; selectedArea: string;
  onAreaChange: (v: string) => void; isLoading?: boolean; defaultAreaCode?: string;
}) {
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!categoryCode) return;
    let mounted = true;
    setIsFetching(true);
    fetch(`/api/areas/get-by-category?categoryCode=${encodeURIComponent(categoryCode)}`)
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        if (data.success && data.areas?.length > 0) {
          setAreas(data.areas);
          if (!selectedArea) {
            const def = defaultAreaCode && data.areas.some((a: AreaOption) => a.area_code === defaultAreaCode)
              ? defaultAreaCode : data.areas[0].area_code;
            onAreaChange(def);
          }
        }
      })
      .catch(console.error)
      .finally(() => { if (mounted) setIsFetching(false); });
    return () => { mounted = false; };
  }, [categoryCode]);

  const disabled = isLoading || isFetching || areas.length === 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      <select value={selectedArea} onChange={e => onAreaChange(e.target.value)} disabled={disabled}
        style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 500, color: "#1e293b", backgroundColor: disabled ? "#f1f5f9" : "white", cursor: disabled ? "not-allowed" : "pointer", minWidth: 0, width: "100%" }}>
        {areas.map(a => <option key={a.area_code} value={a.area_code}>{a.area_name}</option>)}
      </select>
      {isFetching && <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", whiteSpace: "nowrap" }}>Memuat...</span>}
    </div>
  );
}

const DEFAULT_AREA: Record<string, string> = {
  "final-assy-gl":        "final-assy-gl-genba-a-mazda",
  "final-assy-inspector": "final-assy-insp-genba-a-mazda",
};

// =====================================================================
// PARSE NG DESCRIPTION
// =====================================================================
function parseNgDescription(raw: string | undefined | null): { choices: string[]; otherNote: string } {
  if (!raw) return { choices: [], otherNote: "" };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const choices: string[] = [];
      let otherNote = "";
      parsed.forEach((item: any) => {
        if (typeof item === "string") {
          try {
            const inner = JSON.parse(item);
            if (inner && typeof inner === "object") {
              if (Array.isArray(inner.choices)) choices.push(...inner.choices);
              if (inner.other) otherNote += (otherNote ? "\n" : "") + inner.other;
            } else {
              choices.push(item);
            }
          } catch {
            choices.push(item);
          }
        }
      });
      return { choices, otherNote };
    }
    if (parsed && typeof parsed === "object") {
      return {
        choices: Array.isArray(parsed.choices) ? parsed.choices : [],
        otherNote: parsed.other || "",
      };
    }
    return { choices: [String(parsed)], otherNote: "" };
  } catch {
    return { choices: raw ? [raw] : [], otherNote: "" };
  }
}

// =====================================================================
// SPECIFIC AREA OPTIONS
// =====================================================================
const SPECIFIC_AREA_ITEMS: Record<string, string[]> = {
  "WP CHECK":          ["1","3","5","6"],
  "CHECKER":           ["1","3","5","6","7","9","10"],
  "VISUAL 1":          ["1","2","3","5","6","8","9","10"],
  "VISUAL 2":          ["1","2","3","4","5","6","7","8","9","10","11"],
  "DOUBLE CHECK (RI)": ["1","3","4","5","6","10","12"],
};
const SPECIFIC_AREA_OPTIONS = ["WP CHECK","CHECKER","VISUAL 1","VISUAL 2","DOUBLE CHECK (RI)"];

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function FinalAssyStatusPage() {
  const router = useRouter();
  const { user, loading, isInitialized } = useAuth();
  const hasAuth = useRef(false);

  const [viewAs, setViewAs]           = useState<"group-leader" | "inspector">("inspector");
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear]   = useState(new Date().getFullYear());
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA["final-assy-inspector"]);
  const [selectedSpecificArea, setSelectedSpecificArea] = useState("WP CHECK");

  const [checkpoints, setCheckpoints]               = useState<CheckPoint[]>([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);
  const [glResults, setGlResults]   = useState<Record<string, Record<string, CheckResult>>>({});
  const [inspResults, setInspResults] = useState<Record<string, Record<string, CheckResult>>>({});
  const [glSigs, setGlSigs]         = useState<Record<string, Record<string, "-" | "OK">>>({});
  const [inspSigs, setInspSigs]     = useState<Record<string, Record<string, "-" | "OK">>>({});
  const [gaugeResults, setGaugeResults] = useState<Record<string, { gaugeId: string; status: "OK" | "NG" | "-" }>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [ngModal, setNgModal]       = useState<NGModal | null>(null);
  const [photoZoom, setPhotoZoom]   = useState<string | null>(null);

  // ── Conveyor state (menggantikan carlineOptions + selectedCL) ─────
  const [conveyorOptions, setConveyorOptions] = useState<string[]>([]);
  const [selectedConveyor, setSelectedConveyor] = useState("");
  const [isFetchingConveyors, setIsFetchingConveyors] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) setExpandedDates(new Set([new Date().getDate()]));
  }, [isMobile, activeMonth, activeYear]);

  useEffect(() => {
    if (user) hasAuth.current = true;
    if (isInitialized && !loading && !user && !hasAuth.current) router.push("/login-page");
  }, [user, loading, isInitialized, router]);

  const isGL = user?.role === "group-leader-qa";
  const categoryCode = viewAs === "group-leader" ? "final-assy-gl" : "final-assy-inspector";

  // Reset saat viewAs berubah
  useEffect(() => {
    setSelectedArea(DEFAULT_AREA[categoryCode] || "");
    setSelectedConveyor("");
    setConveyorOptions([]);
  }, [viewAs]);

  // ── Fetch daftar conveyor saat area berubah ───────────────────────
  useEffect(() => {
    if (!selectedArea) {
      setConveyorOptions([]);
      setSelectedConveyor("");
      setGlResults({});
      setInspResults({});
      return;
    }

    setSelectedConveyor("");
    setConveyorOptions([]);
    setGlResults({});
    setInspResults({});
    setIsFetchingConveyors(true);

    fetch(`/api/final-assy/get-carline-line?areaCode=${encodeURIComponent(selectedArea)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // API mengembalikan [{conveyor, carline, line}] — ambil nilai conveyor
          const conveyors = [
            ...new Set(
              data
                .map((d: any) => String(d.conveyor || d.carline || "").trim().toUpperCase())
                .filter(Boolean)
            ),
          ] as string[];
          setConveyorOptions(conveyors);
        }
      })
      .catch(() => {})
      .finally(() => setIsFetchingConveyors(false));
  }, [selectedArea]);

  const inspectorItems: InspectorItem[] = useMemo(() => [
    { no: "1",  itemCheck: "PIPO" },
    { no: "2",  itemCheck: "ROLL METER / MISTAR BAJA" },
    { no: "3",  itemCheck: "GO NO GO" },
    { no: "4",  itemCheck: "PUSH GAUGE RB" },
    { no: "5",  itemCheck: "DUMMY SAMPLE OK & N-OK" },
    { no: "6",  itemCheck: "IMPORTANT / INSPECTION POINT" },
    { no: "7",  itemCheck: "FUSE PLATE" },
    { no: "8",  itemCheck: "LAMPU NAVIGASI" },
    { no: "9",  itemCheck: "TAPE NAVIGASI" },
    { no: "10", itemCheck: "INSPECTION BOARD" },
    { no: "11", itemCheck: "DRY SURF" },
    { no: "12", itemCheck: "PACKING" },
  ], []);

  const filteredInspectorItems = useMemo(() => {
    const allowed = SPECIFIC_AREA_ITEMS[selectedSpecificArea] ?? null;
    if (!allowed) return inspectorItems;
    return inspectorItems.filter(item => allowed.includes(item.no));
  }, [inspectorItems, selectedSpecificArea]);

  // =====================================================================
  // FETCH GL CHECKPOINTS
  // =====================================================================
  useEffect(() => {
    if (viewAs !== "group-leader") return;
    setCheckpointsLoading(true);

    const waktuFallback: Record<string, string> = {
      "1-A":"07:30 - 08:00","1-B":"19:30 - 20:00","2-A":"08:00 - 09:00","2-B":"20:00 - 21:00",
      "3-A":"08:00 - 09:00","3-B":"20:00 - 21:00","4-A":"09:00 - 11:00","4-B":"21:00 - 23:00",
      "5-A":"09:00 - 11:00","5-B":"21:00 - 23:00","6-A":"09:00 - 11:00","6-B":"21:00 - 23:00",
      "7-A":"11:00 - 12:00","7-B":"23:00 - 24:00","8-A":"11:00 - 12:00","8-B":"23:00 - 24:00",
      "9-A":"13:00 - 14:00","9-B":"01:00 - 02:00","10-A":"14:00 - 15:00","10-B":"02:00 - 03:00",
      "11-A":"Setiap Hari Senin","11-B":"Setiap Hari Senin","12-A":"Setiap Hari Senin","12-B":"Setiap Hari Senin",
      "13-A":"Setiap Hari Selasa","13-B":"Setiap Hari Selasa","14-A":"Setiap Hari Rabu","14-B":"Setiap Hari Rabu",
      "15-A":"Setiap Hari Selasa","15-B":"Setiap Hari Selasa","16-A":"Setiap Hari","16-B":"Setiap Hari",
      "17-A":"Setiap Hari Selasa","17-B":"Setiap Hari Selasa","18-A":"Setiap Hari Selasa","18-B":"Setiap Hari Selasa",
    };

    fetch("/api/final-assy/get-checklist-items?type=group-leader")
      .then(r => r.json())
      .then(data => {
        if (!data.success || !Array.isArray(data.data)) return;

        interface Exp {
          id: number; no: string; checkPoint: string;
          shift: "A" | "B"; waktuCheck: string; metodeCheck: string;
        }
        const expanded: Exp[] = [];

        (data.data as any[]).forEach(item => {
          const shiftsArr: any[] = item.shifts || [];
          if (shiftsArr.length === 0) {
            const realId = item.shiftIdMap?.["A"] ?? item.id;
            const realIdB = item.shiftIdMap?.["B"] ?? item.id;
            expanded.push({ id: realId,  no: item.no||"", checkPoint: item.checkPoint, shift: "A", waktuCheck: item.waktuCheck||"", metodeCheck: item.metodeCheck||"" });
            expanded.push({ id: realIdB, no: item.no||"", checkPoint: item.checkPoint, shift: "B", waktuCheck: item.waktuCheck||"", metodeCheck: item.metodeCheck||"" });
          } else {
            const hasA = shiftsArr.some((sd: any) => sd.shift === "A");
            const hasB = shiftsArr.some((sd: any) => sd.shift === "B");

            shiftsArr.forEach((sd: any) => {
              const s: "A" | "B" = sd.shift === "B" ? "B" : "A";
              const realId = item.shiftIdMap?.[s] ?? item.id;
              expanded.push({
                id: realId, no: item.no||"", checkPoint: item.checkPoint,
                shift: s, waktuCheck: sd.waktuCheck||item.waktuCheck||"",
                metodeCheck: item.metodeCheck||"",
              });
            });

            if (!hasA) {
              const realId = item.shiftIdMap?.["A"] ?? item.id;
              expanded.push({ id: realId, no: item.no||"", checkPoint: item.checkPoint, shift: "A", waktuCheck: waktuFallback[`${item.no}-A`]||"", metodeCheck: item.metodeCheck||"" });
            }
            if (!hasB) {
              const realId = item.shiftIdMap?.["B"] ?? item.id;
              expanded.push({ id: realId, no: item.no||"", checkPoint: item.checkPoint, shift: "B", waktuCheck: waktuFallback[`${item.no}-B`]||"", metodeCheck: item.metodeCheck||"" });
            }
          }
        });

        const normalizeText = (s: string) => s.trim().replace(/\s+/g, " ");

        const grouped = new Map<string, { shiftA?: Exp; shiftB?: Exp }>();
        expanded.forEach(e => {
          const key = normalizeText(e.checkPoint);
          if (!grouped.has(key)) grouped.set(key, {});
          const g = grouped.get(key)!;
          if (e.shift === "A") {
            if (!g.shiftA) g.shiftA = e;
          } else {
            if (!g.shiftB) g.shiftB = e;
          }
        });

        const result: CheckPoint[] = [];
        grouped.forEach((g, cpText) => {
          const rep = g.shiftA || g.shiftB!;
          const no = rep.no || "";
          let type: "normal" | "special" | "weekly" = "normal";
          if (!no || no.trim() === "") type = "special";
          else if (cpText.toLowerCase().includes("swct")) type = "weekly";

          const shifts: Array<{ shift: "A" | "B"; waktuCheck: string }> = [];

          if (g.shiftA) {
            shifts.push({ shift: "A", waktuCheck: g.shiftA.waktuCheck || waktuFallback[`${no}-A`] || "" });
          } else {
            shifts.push({ shift: "A", waktuCheck: waktuFallback[`${no}-A`] || "" });
          }

          if (g.shiftB) {
            shifts.push({ shift: "B", waktuCheck: g.shiftB.waktuCheck || waktuFallback[`${no}-B`] || "" });
          } else {
            shifts.push({ shift: "B", waktuCheck: waktuFallback[`${no}-B`] || "" });
          }

          result.push({
            id:  g.shiftA?.id ?? rep.id,
            idB: g.shiftB?.id ?? (g.shiftA?.id ?? rep.id),
            no,
            checkPoint: cpText,
            shifts,
            standard: rep.metodeCheck || "",
            type,
          });
        });

        setCheckpoints(result);
      })
      .catch(err => console.error("❌ GL checkpoints:", err))
      .finally(() => setCheckpointsLoading(false));
  }, [viewAs]);

  // =====================================================================
  // LOAD DATA — menggunakan conveyor sebagai filter
  // =====================================================================
  const loadData = useCallback(async (conveyor: string) => {
    if (!user || !conveyor) return;
    setIsLoading(true); setError(null);
    try {
      const monthKey = `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}`;
      const areaP = selectedArea ? `&areaCode=${encodeURIComponent(selectedArea)}` : "";
      // ✅ Kirim sebagai `conveyor` (bukan carline/line) sesuai format baru
      const conveyorP = `&conveyor=${encodeURIComponent(conveyor)}`;
      const base = `/api/final-assy`;

      if (viewAs === "group-leader") {
        const [rRes, sRes] = await Promise.all([
          fetch(`${base}/get-results?userId=${user.id}&categoryCode=final-assy-gl&month=${monthKey}&role=${user.role}${areaP}${conveyorP}`),
          fetch(`${base}/get-signatures?userId=${user.id}&categoryCode=final-assy-gl&month=${monthKey}&role=${user.role}${areaP}${conveyorP}`),
        ]);
        const rData = await rRes.json(); const sData = await sRes.json();
        if (rData.success) setGlResults(rData.formatted);
        if (sData.success) setGlSigs(sData.formatted);
      } else {
        const [rRes, sRes] = await Promise.all([
          fetch(`${base}/get-results?userId=${user.id}&categoryCode=final-assy-inspector&month=${monthKey}&role=${user.role}${areaP}${conveyorP}`),
          fetch(`${base}/get-signatures?userId=${user.id}&categoryCode=final-assy-inspector&month=${monthKey}&role=${user.role}${areaP}${conveyorP}`),
        ]);
        const rData = await rRes.json(); const sData = await sRes.json();
        if (rData.success) setInspResults(rData.formatted);
        if (sData.success) setInspSigs(sData.formatted);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally { setIsLoading(false); }
  }, [user, activeMonth, activeYear, viewAs, selectedArea]);

  useEffect(() => {
    if (!user?.id || !selectedConveyor) {
      setGlResults({});
      setInspResults({});
      return;
    }
    loadData(selectedConveyor);
  }, [user?.id, activeMonth, activeYear, viewAs, selectedArea, selectedConveyor]);

  // =====================================================================
  // UTILITY
  // =====================================================================
  const getDateKey = (d: number) =>
    `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getMonthName = (m: number) =>
    ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][m];

  const changeMonth = (dir: number) => {
    let m = activeMonth + dir, y = activeYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setActiveMonth(m); setActiveYear(y);
  };

  const dynamicDates = useMemo(() =>
    Array.from({ length: getDaysInMonth(activeYear, activeMonth) }, (_, i) => i + 1),
  [activeMonth, activeYear]);

  const today       = new Date().getDate();
  const isCurrentMo = activeMonth === new Date().getMonth() && activeYear === new Date().getFullYear();

  // =====================================================================
  // GET RESULT HELPERS
  // =====================================================================
  const getGLResult = (date: number, cp: CheckPoint, shift: "A" | "B"): CheckResult | null => {
    const dateData = glResults[getDateKey(date)];
    if (!dateData) return null;

    if (shift === "A") {
      return dateData[`${cp.id}-A`] || null;
    }

    if (cp.idB !== undefined && cp.idB !== cp.id) {
      const result = dateData[`${cp.idB}-B`];
      if (result) return result;
    }

    const result2 = dateData[`${cp.id}-B`];
    if (result2) return result2;

    return null;
  };

  // ✅ Inspector result — menggunakan selectedSpecificArea sebagai bagian key
  const getInspResult = (date: number, item: InspectorItem, shift: "A" | "B") =>
    inspResults[getDateKey(date)]?.[`${item.no}-${selectedSpecificArea}-${shift}`] || null;

  const getGLSig = (date: number, shift: "A" | "B", type: "gl" | "insp"): "-" | "OK" =>
    (type === "gl" ? glSigs : inspSigs)[getDateKey(date)]?.[shift] || "-";

  // =====================================================================
  // OPEN NG MODAL
  // =====================================================================
  const openNgModal = (date: number, shift: "A" | "B", itemName: string, result: CheckResult) => {
    const { choices, otherNote } = parseNgDescription(result.ngDescription);
    let photos: string[] = [];
    try {
      if (result.ngPhotos) {
        const p = JSON.parse(result.ngPhotos);
        if (Array.isArray(p)) photos = p;
      }
    } catch {}
    setNgModal({
      date, shift, itemName, ngChoices: choices,
      ngOtherNote: otherNote,
      ngPhotos: photos,
      ngDepartment: result.ngDepartment || "-",
      submittedBy:  result.submittedBy  || "-",
      submittedAt:  result.submittedAt  || "-",
    });
  };

  // =====================================================================
  // RENDER STATUS BADGE
  // =====================================================================
  const badge = (status: string, onClick?: () => void) => (
    <span onClick={onClick} style={{
      display: "inline-block", width: "100%",
      backgroundColor: status === "OK" ? "#4caf50" : status === "NG" ? "#f44336" : "#9e9e9e",
      color: "white", padding: "6px 8px", borderRadius: 4,
      fontWeight: 600, fontSize: 12, textAlign: "center",
      cursor: status === "NG" ? "pointer" : "default",
    }} title={status === "NG" ? "Klik untuk lihat detail NG" : undefined}>
      {status === "OK" ? "✓ OK" : status === "NG" ? "✗ NG" : "-"}
    </span>
  );

  const renderGLCell = (date: number, cp: CheckPoint, shift: "A" | "B") => {
    const isGauge = cp.checkPoint.toLowerCase().includes("kondisi tool dan gauge");
    if (isGauge) {
      const dk = getDateKey(date);
      const gk = `${dk}-${shift}-${selectedArea}`;
      const result = getGLResult(date, cp, shift);
      const gs = (gaugeResults[gk]?.status || result?.status || "-") as "OK" | "NG" | "-";

      if (gs === "NG" && result) {
        return badge("NG", () => openNgModal(date, shift, cp.checkPoint, result));
      }

      return (
        <ScanGaugeButton dateKey={dk} shift={shift}
          userId={user?.id || ""} nik={user?.nik || ""} areaCode={selectedArea}
          existingStatus={gs} editable={false}
          onSaved={(gId, st) => setGaugeResults(p => ({ ...p, [`${dk}-${shift}-${selectedArea}`]: { gaugeId: gId, status: st } }))}
        />
      );
    }
    const result = getGLResult(date, cp, shift);
    const st = result?.status || "-";
    return badge(st, st === "NG" && result ? () => openNgModal(date, shift, cp.checkPoint, result) : undefined);
  };

  const renderInspCell = (date: number, item: InspectorItem, shift: "A" | "B") => {
    const result = getInspResult(date, item, shift);
    const st = result?.status || "-";
    return badge(st, st === "NG" && result ? () => openNgModal(date, shift, item.itemCheck, result) : undefined);
  };

  const renderESOCell = (date: number, shift: "A" | "B") => {
    const dow = new Date(activeYear, activeMonth, date).getDay();
    if (dow !== 2 && dow !== 4) return <span style={{ color: "#cbd5e1" }}>-</span>;
    const cp = checkpoints.find(c => c.type === "special");
    if (!cp) return <span style={{ color: "#cbd5e1" }}>-</span>;
    const result = getGLResult(date, cp, shift);
    const st = result?.status || "-";
    return <span style={{
      display: "inline-block", width: "100%",
      backgroundColor: st === "OK" ? "#4caf50" : st === "NG" ? "#f44336" : "#9e9e9e",
      color: "white", padding: "4px 6px", borderRadius: 4,
      fontWeight: 600, fontSize: 11, textAlign: "center",
      cursor: st === "NG" ? "pointer" : "default",
    }} onClick={st === "NG" && result ? () => openNgModal(date, shift, cp.checkPoint, result) : undefined}>
      {st === "OK" ? "✓ OK" : st === "NG" ? "✗ NG" : "-"}
    </span>;
  };

  const th = (style?: React.CSSProperties): React.CSSProperties => ({ border: "1px solid #000", padding: "6px 4px", textAlign: "center", ...style });
  const td = (style?: React.CSSProperties): React.CSSProperties => ({ border: "1px solid #000", padding: "4px 6px", textAlign: "center", ...style });
  const todayStyle = (date: number): React.CSSProperties =>
    isCurrentMo && date === today ? { backgroundColor: "#fff8e1", color: "#e65100", fontWeight: "bold" } : {};

  if (loading || !isInitialized) return <div style={{ textAlign: "center", padding: 50 }}><p>Memuat...</p></div>;
  if (!user) return null;

  return (
    <>
      <Sidebar userName={user.fullName || user.username} />
      <div style={{ marginLeft: isMobile ? 0 : 80, padding: isMobile ? "10px 8px" : 20, minHeight: "100vh", background: "#f5f7fa" }}>

        {/* HEADER */}
        <div style={{ background: "linear-gradient(135deg,#1e88e5,#1565c0)", color: "white", padding: isMobile ? "12px 14px" : "16px 20px", borderRadius: 12, marginBottom: isMobile ? 12 : 20, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 0, boxShadow: "0 4px 12px rgba(30,136,229,0.2)" }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 14 : 18, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
            {viewAs === "group-leader" ? "📊 Summary GL - Final Assy" : "📊 Summary Inspector - Final Assy"}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}>
            {isGL && (
              <select value={viewAs} onChange={e => setViewAs(e.target.value as any)}
                style={{ padding: isMobile ? "6px 10px" : "8px 12px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "white", fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: "pointer", outline: "none", minWidth: 0 }}>
                <option value="group-leader">Daily Check GL</option>
                <option value="inspector">Daily Check Inspector</option>
              </select>
            )}
            <span style={{ fontSize: isMobile ? 11 : 13, color: "rgba(255,255,255,0.85)" }}>
              Role: <span style={{ background: "rgba(255,255,255,0.2)", padding: isMobile ? "2px 8px" : "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                {isGL ? "Group Leader QA" : "Inspector QA"}
              </span>
            </span>
          </div>
        </div>

        {/* FILTER */}
        <div style={{ background: "white", borderRadius: 10, padding: isMobile ? "10px 12px" : "14px 16px", marginBottom: isMobile ? 10 : 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12 }}>

          {/* Area filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, color: "#1e293b", whiteSpace: "nowrap", flexShrink: 0 }}>📍 Area:</label>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AreaFilter categoryCode={categoryCode} selectedArea={selectedArea} onAreaChange={setSelectedArea} isLoading={isLoading} defaultAreaCode={DEFAULT_AREA[categoryCode]} />
            </div>
          </div>

          {/* ✅ Conveyor filter — menggantikan Carline - Line */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, color: "#1e293b", whiteSpace: "nowrap", flexShrink: 0 }}>🏭 Conveyor:</label>
            {isFetchingConveyors ? (
              <span style={{ fontSize: isMobile ? 11 : 13, color: "#94a3b8", fontStyle: "italic", padding: "6px 10px", background: "#f1f5f9", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                Memuat conveyor...
              </span>
            ) : conveyorOptions.length === 0 ? (
              <span style={{ fontSize: isMobile ? 11 : 13, color: "#94a3b8", fontStyle: "italic", padding: "6px 10px", background: "#f1f5f9", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                Belum ada data conveyor
              </span>
            ) : (
              <select
                value={selectedConveyor}
                onChange={e => setSelectedConveyor(e.target.value)}
                disabled={isLoading || isFetchingConveyors}
                style={{
                  flex: 1, minWidth: 0,
                  padding: isMobile ? "6px 10px" : "8px 14px",
                  borderRadius: 8,
                  border: `2px solid ${selectedConveyor ? "#f59e0b" : "#e2e8f0"}`,
                  fontSize: isMobile ? 12 : 14,
                  fontWeight: 600,
                  color: selectedConveyor ? "#92400e" : "#64748b",
                  background: selectedConveyor ? "#fffbeb" : "white",
                  cursor: "pointer",
                  outline: "none",
                  width: "100%",
                }}
              >
                <option value="">-- Pilih Conveyor --</option>
                {conveyorOptions.map(cv => (
                  <option key={cv} value={cv}>{cv}</option>
                ))}
              </select>
            )}
            {/* Badge conveyor terpilih */}
            {selectedConveyor && (
              <span style={{
                fontSize: isMobile ? 10 : 11, fontWeight: 700,
                background: "#fef3c7", color: "#92400e",
                padding: "3px 10px", borderRadius: 20,
                border: "1.5px solid #fcd34d", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                🏭 {selectedConveyor}
              </span>
            )}
          </div>

          {/* Spesifik Area — hanya untuk Inspector */}
          {viewAs === "inspector" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, color: "#1e293b", whiteSpace: "nowrap", flexShrink: 0 }}>🔍 Spesifik Area:</label>
              <select value={selectedSpecificArea} onChange={e => setSelectedSpecificArea(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: isMobile ? "6px 10px" : "8px 14px", borderRadius: 8, border: "2px solid #7c3aed", fontSize: isMobile ? 12 : 14, fontWeight: 600, color: "#5b21b6", background: "#f5f3ff", cursor: "pointer", outline: "none", width: "100%" }}>
                {SPECIFIC_AREA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <span style={{ fontSize: isMobile ? 10 : 11, color: "#7c3aed", fontWeight: 600, background: "#ede9fe", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
                {filteredInspectorItems.length} item
              </span>
            </div>
          )}
        </div>

        {/* INFO */}
        <div style={{ backgroundColor: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 8, padding: "10px 16px", marginBottom: isMobile ? 8 : 12, fontSize: isMobile ? 12 : 14 }}>
          <strong>📌 Mode View Only:</strong> Klik status <span style={{ color: "#f44336", fontWeight: "bold" }}>NG</span> untuk melihat detail kondisi NG.
        </div>

        {viewAs === "inspector" && !isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderLeft: "4px solid #7c3aed", borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6" }}>Spesifik Area: {selectedSpecificArea}</span>
            <span style={{ fontSize: 12, color: "#7c3aed", background: "#ede9fe", padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>{filteredInspectorItems.length} item ditampilkan</span>
          </div>
        )}

        {/* MONTH NAV */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 10 : 15, background: "white", borderRadius: 10, padding: isMobile ? "8px 12px" : "10px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
          <button onClick={() => changeMonth(-1)} style={{ padding: isMobile ? "6px 10px" : "8px 16px", background: "#1e88e5", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: isMobile ? 12 : 14 }}>
            {isMobile ? "←" : "← Bulan Lalu"}
          </button>
          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#1e293b" }}>{getMonthName(activeMonth)} {activeYear}</span>
          <button onClick={() => changeMonth(1)} style={{ padding: isMobile ? "6px 10px" : "8px 16px", background: "#1e88e5", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: isMobile ? 12 : 14 }}>
            {isMobile ? "→" : "Bulan Depan →"}
          </button>
        </div>

        {/* LOADING / ERROR */}
        {(isLoading || checkpointsLoading) && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ display: "inline-block", width: 40, height: 40, border: "4px solid #1976d2", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 10, color: "#666" }}>Memuat data...</p>
          </div>
        )}
        {error && <div style={{ backgroundColor: "#fee", color: "#c33", padding: 12, borderRadius: 8, marginBottom: 15, borderLeft: "4px solid #c33" }}><strong>Error: </strong>{error}</div>}

        {/* EMPTY STATE — Conveyor belum dipilih */}
        {!selectedConveyor && (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: 12, border: "2px dashed #e2e8f0", marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
            <p style={{ fontWeight: 700, color: "#1e293b", fontSize: 16, margin: "0 0 8px" }}>Pilih Conveyor terlebih dahulu</p>
            <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
              {conveyorOptions.length === 0
                ? "Belum ada data Conveyor. Isi checklist terlebih dahulu."
                : "Pilih dari dropdown Conveyor di atas."}
            </p>
          </div>
        )}

        {/* TABLE DESKTOP */}
        {selectedConveyor && !isMobile && (
          <div style={{ overflowX: "auto", borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.09)", background: "white", marginBottom: 12 }}>

            {/* GL TABLE */}
            {viewAs === "group-leader" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <thead>
                  <tr>
                    <th style={th({ minWidth: 40 })} rowSpan={2}>NO</th>
                    <th style={th({ minWidth: 280 })} rowSpan={2}>CHECK POINT</th>
                    <th style={th({ minWidth: 45 })} rowSpan={2}>SHIFT</th>
                    <th style={th({ minWidth: 90 })} rowSpan={2}>WAKTU CHECK</th>
                    <th style={th({ minWidth: 90 })} rowSpan={2}>STANDARD / METODE</th>
                    <th colSpan={dynamicDates.length} style={th({ backgroundColor: "#e3f2fd", fontWeight: "bold", fontSize: "1rem" })}>{getMonthName(activeMonth)} {activeYear}</th>
                  </tr>
                  <tr>
                    {dynamicDates.map(d => <th key={d} style={th({ minWidth: 32, ...todayStyle(d) })}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map(cp => {
                    const sameNo  = checkpoints.filter(c => c.no === cp.no);
                    const isFirst = sameNo[0].id === cp.id;
                    const rowSpan = sameNo.reduce((s, i) => s + i.shifts.length, 0);

                    if (cp.type === "special") {
                      return (
                        <React.Fragment key={`cp-${cp.id}-special`}>
                          <tr>
                            <td style={td()} />
                            <td rowSpan={2} colSpan={3} style={td({ textAlign: "left" })}>{cp.checkPoint}</td>
                            <td rowSpan={2} style={td()}>{cp.standard}</td>
                            {dynamicDates.map(d => <td key={d} style={td(todayStyle(d))}>{renderESOCell(d, "A")}</td>)}
                          </tr>
                          <tr>
                            {dynamicDates.map(d => <td key={d} style={td(todayStyle(d))}>{renderESOCell(d, "B")}</td>)}
                          </tr>
                        </React.Fragment>
                      );
                    }

                    if (cp.type === "weekly") return (
                      <React.Fragment key={`cp-${cp.id}`}>
                        <tr>
                          {isFirst && <td rowSpan={3} style={td()}>{cp.no}</td>}
                          <td rowSpan={3} style={td({ textAlign: "left" })}>{cp.checkPoint}</td>
                          <td style={td()} /><td style={td()} />
                          {isFirst && <td rowSpan={3} style={td()}>{cp.standard}</td>}
                          {dynamicDates.map(d => <td key={d} style={td()}>{`wk${Math.ceil(d / 7)}`}</td>)}
                        </tr>
                        {(["A", "B"] as const).map(s => (
                          <tr key={s}>
                            <td style={td()}>{s}</td>
                            <td style={td()}>{cp.shifts.find(sh => sh.shift === s)?.waktuCheck || ""}</td>
                            {dynamicDates.map(d => <td key={d} style={td(todayStyle(d))}>{renderGLCell(d, cp, s)}</td>)}
                          </tr>
                        ))}
                      </React.Fragment>
                    );

                    return (
                      <React.Fragment key={`cp-${cp.id}`}>
                        {cp.shifts.map((shiftData, si) => (
                          <tr key={`${cp.id}-${si}`}>
                            {si === 0 && isFirst && <td rowSpan={rowSpan} style={td()}>{cp.no}</td>}
                            {si === 0 && <td rowSpan={cp.shifts.length} style={td({ textAlign: "left" })}>{cp.checkPoint}</td>}
                            <td style={td()}>{shiftData.shift}</td>
                            <td style={td()}>{shiftData.waktuCheck}</td>
                            {si === 0 && isFirst && <td rowSpan={rowSpan} style={td()}>{cp.standard}</td>}
                            {dynamicDates.map(d => (
                              <td key={d} style={td(todayStyle(d))}>
                                {renderGLCell(d, cp, shiftData.shift)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {/* SIGNATURE ROW GL */}
                  <tr>
                    <td style={td()} /><td colSpan={4} style={td()}>Tanda tangan GL Inspector</td>
                    {dynamicDates.map(d => {
                      const s = getGLSig(d, "A", "gl");
                      return <td key={d} style={td()}><span style={{ display: "inline-block", width: "100%", backgroundColor: s === "OK" ? "#4caf50" : "#9e9e9e", color: "white", padding: "4px 8px", borderRadius: 4, fontWeight: "bold", fontSize: 11 }}>{s === "OK" ? "✓ OK" : "-"}</span></td>;
                    })}
                  </tr>
                </tbody>
              </table>
            )}

            {/* INSPECTOR TABLE */}
            {viewAs === "inspector" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={th({ minWidth: 40 })}>NO</th>
                    <th rowSpan={2} style={th({ minWidth: 160 })}>ITEM CHECK</th>
                    <th rowSpan={2} style={th({ minWidth: 45 })}>SHIFT</th>
                    <th colSpan={dynamicDates.length} style={th({ backgroundColor: "#e3f2fd", fontWeight: "bold", fontSize: "1rem" })}>{getMonthName(activeMonth)} {activeYear}</th>
                  </tr>
                  <tr>
                    {dynamicDates.map(d => <th key={d} style={th({ minWidth: 34, ...todayStyle(d) })}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredInspectorItems.map(item => (
                    <React.Fragment key={item.no}>
                      <tr>
                        <td rowSpan={2} style={td()}>{item.no}</td>
                        <td rowSpan={2} style={td({ textAlign: "left", fontWeight: 600, color: "#1e293b" })}>{item.itemCheck}</td>
                        <td style={td({ fontWeight: 700 })}>A</td>
                        {dynamicDates.map(d => (
                          <td key={d} style={td({ minWidth: 34, ...todayStyle(d) })}>
                            {renderInspCell(d, item, "A")}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={td({ fontWeight: 700 })}>B</td>
                        {dynamicDates.map(d => (
                          <td key={d} style={td({ minWidth: 34, ...todayStyle(d) })}>
                            {renderInspCell(d, item, "B")}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr>
                    <td style={{ border: "none" }} rowSpan={2} colSpan={2} />
                    <td style={td({ fontWeight: 700 })}>A</td>
                    {dynamicDates.map(d => {
                      const s = getGLSig(d, "A", "insp");
                      return <td key={d} style={td(todayStyle(d))}><span style={{ display: "inline-block", width: "100%", backgroundColor: s === "OK" ? "#4caf50" : "#9e9e9e", color: "white", padding: "2px 4px", borderRadius: 3, fontSize: "0.65rem", fontWeight: 600 }}>{s === "OK" ? "✓ OK" : "-"}</span></td>;
                    })}
                  </tr>
                  <tr>
                    <td style={td({ fontWeight: 700 })}>B</td>
                    {dynamicDates.map(d => {
                      const s = getGLSig(d, "B", "insp");
                      return <td key={d} style={td(todayStyle(d))}><span style={{ display: "inline-block", width: "100%", backgroundColor: s === "OK" ? "#4caf50" : "#9e9e9e", color: "white", padding: "2px 4px", borderRadius: 3, fontSize: "0.65rem", fontWeight: 600 }}>{s === "OK" ? "✓ OK" : "-"}</span></td>;
                    })}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MOBILE CARD VIEW */}
        {selectedConveyor && isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
              <button onClick={() => setExpandedDates(new Set(dynamicDates))} style={{ flex: 1, padding: "8px", background: "#1e88e5", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>▼ Buka Semua</button>
              <button onClick={() => setExpandedDates(new Set())} style={{ flex: 1, padding: "8px", background: "#64748b", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>▲ Tutup Semua</button>
            </div>
            {viewAs === "inspector" && (
              <div style={{ padding: "8px 12px", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 12, color: "#5b21b6", fontWeight: 600 }}>
                🔍 {selectedSpecificArea} — menampilkan {filteredInspectorItems.length} item check
              </div>
            )}
            {/* Conveyor badge di mobile */}
            <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12, color: "#92400e", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🏭</span>
              <span>Conveyor: <strong>{selectedConveyor}</strong></span>
            </div>

            {dynamicDates.map(date => {
              const dayOfWeek = new Date(activeYear, activeMonth, date).getDay();
              const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
              const dayName = dayNames[dayOfWeek];
              const isToday = isCurrentMo && date === today;
              const isExpanded = expandedDates.has(date);

              const hasData = viewAs === "group-leader"
                ? checkpoints.some(cp => {
                    const shiftA = getGLResult(date, cp, "A"), shiftB = getGLResult(date, cp, "B");
                    return (shiftA && shiftA.status !== "-") || (shiftB && shiftB.status !== "-");
                  })
                : filteredInspectorItems.some(item => {
                    const a = getInspResult(date, item, "A"), b = getInspResult(date, item, "B");
                    return (a && a.status !== "-") || (b && b.status !== "-");
                  });

              const hasNG = viewAs === "group-leader"
                ? checkpoints.some(cp => getGLResult(date, cp, "A")?.status === "NG" || getGLResult(date, cp, "B")?.status === "NG")
                : filteredInspectorItems.some(item => getInspResult(date, item, "A")?.status === "NG" || getInspResult(date, item, "B")?.status === "NG");

              const cardBorder = hasNG ? "2px solid #ef4444" : isToday ? "2px solid #f59e0b" : "1px solid #e2e8f0";
              const cardBg = isToday ? "#fffbeb" : hasData ? "white" : "#f8fafc";

              return (
                <div key={date} style={{ border: cardBorder, borderRadius: 12, background: cardBg, overflow: "hidden", opacity: hasData ? 1 : 0.7 }}>
                  <div
                    onClick={() => setExpandedDates(prev => {
                      const next = new Set(prev);
                      next.has(date) ? next.delete(date) : next.add(date);
                      return next;
                    })}
                    style={{ display: "flex", alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 10, background: isToday ? "#fef3c7" : hasNG ? "#fef2f2" : hasData ? "#f0f9ff" : "#f8fafc" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 38, height: 38, background: isToday ? "#f59e0b" : hasNG ? "#ef4444" : hasData ? "#1e88e5" : "#94a3b8", borderRadius: 8, justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "white", fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{date}</span>
                      <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: 600, lineHeight: 1 }}>{dayName}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? "#92400e" : hasNG ? "#b91c1c" : hasData ? "#1e3a8a" : "#64748b" }}>
                        {isToday ? "📅 Hari Ini" : `${date} ${getMonthName(activeMonth)}`}
                      </div>
                      {hasNG && <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>⚠️ Ada temuan NG</div>}
                      {!hasData && <div style={{ fontSize: 11, color: "#94a3b8" }}>Belum ada data</div>}
                      {hasData && !hasNG && <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Semua OK</div>}
                    </div>
                    <span style={{ color: "#94a3b8", fontSize: 14, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {viewAs === "inspector" ? (
                        <>
                          {filteredInspectorItems.map(item => {
                            const rA = getInspResult(date, item, "A");
                            const rB = getInspResult(date, item, "B");
                            const stA = rA?.status || "-";
                            const stB = rB?.status || "-";
                            const isNG = stA === "NG" || stB === "NG";
                            return (
                              <div key={item.no} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: isNG ? "#fef2f2" : "#f8fafc", borderRadius: 8, border: isNG ? "1px solid #fca5a5" : "1px solid #e2e8f0" }}>
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{item.no}.</span>
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1e293b", lineHeight: 1.3 }}>{item.itemCheck}</span>
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                  {(["A", "B"] as const).map(sh => {
                                    const r = sh === "A" ? rA : rB;
                                    const st = sh === "A" ? stA : stB;
                                    return (
                                      <div key={sh} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>{sh}</span>
                                        <span onClick={st === "NG" && r ? () => openNgModal(date, sh, item.itemCheck, r) : undefined}
                                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 700, color: "white", cursor: st === "NG" ? "pointer" : "default", background: st === "OK" ? "#22c55e" : st === "NG" ? "#ef4444" : "#d1d5db" }}>
                                          {st === "OK" ? "✓" : st === "NG" ? "✗" : "-"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #86efac", marginTop: 4 }}>
                            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#166534" }}>✍️ Tanda tangan GL</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {(["A", "B"] as const).map(sh => {
                                const s = getGLSig(date, sh, "insp");
                                return (
                                  <div key={sh} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                    <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>{sh}</span>
                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 700, color: "white", background: s === "OK" ? "#22c55e" : "#d1d5db" }}>{s === "OK" ? "✓" : "-"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {checkpoints.map(cp => {
                            if (cp.type === "special") {
                              const dow = new Date(activeYear, activeMonth, date).getDay();
                              if (dow !== 2 && dow !== 4) return null;
                            }
                            const rA = getGLResult(date, cp, "A");
                            const rB = getGLResult(date, cp, "B");
                            const stA = rA?.status || "-";
                            const stB = rB?.status || "-";
                            const isNG = stA === "NG" || stB === "NG";
                            return (
                              <div key={cp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: isNG ? "#fef2f2" : "#f8fafc", borderRadius: 8, border: isNG ? "1px solid #fca5a5" : "1px solid #e2e8f0" }}>
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{cp.no}.</span>
                                <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: "#1e293b", lineHeight: 1.3 }}>{cp.checkPoint}</span>
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                  {(["A", "B"] as const).map(sh => {
                                    const r = sh === "A" ? rA : rB;
                                    const st = sh === "A" ? stA : stB;
                                    return (
                                      <div key={sh} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>{sh}</span>
                                        <span onClick={st === "NG" && r ? () => openNgModal(date, sh, cp.checkPoint, r) : undefined}
                                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 700, color: "white", cursor: st === "NG" ? "pointer" : "default", background: st === "OK" ? "#22c55e" : st === "NG" ? "#ef4444" : "#d1d5db" }}>
                                          {st === "OK" ? "✓" : st === "NG" ? "✗" : "-"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #86efac", marginTop: 4 }}>
                            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#166534" }}>✍️ Tanda tangan GL</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {(["A", "B"] as const).map(sh => {
                                const s = getGLSig(date, sh, "gl");
                                return (
                                  <div key={sh} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                    <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>{sh}</span>
                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 700, color: "white", background: s === "OK" ? "#22c55e" : "#d1d5db" }}>{s === "OK" ? "✓" : "-"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NG DETAIL MODAL */}
      {ngModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: 16 }} onClick={() => setNgModal(null)}>
          <div style={{ backgroundColor: "white", borderRadius: 14, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)", padding: "18px 22px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)", color: "white", fontSize: 12, fontWeight: 800, padding: "3px 12px", borderRadius: 20, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>✗ NG</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "white" }}>{ngModal.itemName}</p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                  {activeYear}-{String(activeMonth + 1).padStart(2, "0")}-{String(ngModal.date).padStart(2, "0")} · Shift {ngModal.shift}
                  {selectedConveyor && <span style={{ marginLeft: 6 }}>· 🏭 {selectedConveyor}</span>}
                </p>
              </div>
              <button onClick={() => setNgModal(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ background: "#fffbeb", border: "2px solid #fed7aa", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e", flex: 1 }}>
                    Kondisi NG yang ditemukan
                    {ngModal.ngChoices.length > 0 && (
                      <span style={{ background: "#ef4444", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, marginLeft: 8 }}>{ngModal.ngChoices.length} kondisi</span>
                    )}
                  </span>
                </div>
                {ngModal.ngChoices.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {ngModal.ngChoices.map((choice, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 13px", background: "white", border: "1.5px solid #fca5a5", borderRadius: 9 }}>
                        <span style={{ color: "#ef4444", fontWeight: 800, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✗</span>
                        <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, lineHeight: 1.4 }}>{choice}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "10px 12px", background: "white", border: "1.5px dashed #e2e8f0", borderRadius: 8, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                    Tidak ada detail kondisi NG yang tercatat
                  </div>
                )}
              </div>

              {ngModal.ngOtherNote && (
                <div style={{ background: "#fffbeb", border: "1.5px solid #fed7aa", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                    <span style={{ fontSize: 14 }}>✏️</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Keterangan Tambahan</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#1e293b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ngModal.ngOtherNote}</p>
                </div>
              )}

              {ngModal.ngPhotos.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>📷</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Foto Dokumentasi</span>
                    <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20 }}>{ngModal.ngPhotos.length} foto</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ngModal.ngPhotos.map((src, pi) => (
                      <img key={pi} src={src} alt={`Foto NG ${pi + 1}`} onClick={() => setPhotoZoom(src)}
                        style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "2px solid #e2e8f0", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", background: "#f8fafc", borderRadius: 8, padding: "8px 12px", flexWrap: "wrap", gap: 6 }}>
                <span>Dilaporkan oleh: <strong style={{ color: "#475569" }}>{ngModal.submittedBy}</strong></span>
                <span>{ngModal.submittedAt ? new Date(ngModal.submittedAt).toLocaleString("id-ID") : "-"}</span>
              </div>
            </div>

            <div style={{ padding: "12px 22px", borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setNgModal(null)} style={{ width: "100%", padding: 12, backgroundColor: "#1e88e5", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom */}
      {photoZoom && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setPhotoZoom(null)}>
          <div style={{ position: "relative", maxWidth: "95vw", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoZoom(null)} style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, background: "#ef4444", color: "white", border: "3px solid white", borderRadius: "50%", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✕</button>
            <img src={photoZoom} alt="Foto NG" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 10, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", display: "block" }} />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}