// app/checksheet-final-assy/page.tsx
"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import ConveyorSection from "@/components/ChecksheetComponents/ConveyorSection";

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
  ngPhotos?: string[];
}

interface FADciItem {
  id: number;
  itemCheck: string;
  checkpoints: string[];
  ngChoices: string[];
}

interface FADciResult {
  itemId: number;
  status: "OK" | "NG" | null;
  selectedNgChoices: string[];
  ngOtherNote: string;
  ngPhotos: string[];
}

type ChecklistType = "inspector" | "group-leader";

const getLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const FA_DCI_ITEMS: FADciItem[] = [
  {
    id: 1, itemCheck: "PIPO",
    checkpoints: ["Ada nomor register", "PIPO dalam kondisi baik dan tidak rusak"],
    ngChoices: ["TIDAK ADA NOMOR REGISTER", "PIPO TIDAK DALAM KONDISI BAIK / RUSAK"],
  },
  {
    id: 2, itemCheck: "ROLL METER / MISTAR BAJA",
    checkpoints: [
      "Ada nomor register + kalibrasi tidak expired",
      "Garis angka terbaca dengan jelas / tidak berkarat",
      "Roll meter / mistar baja dalam kondisi baik dan tidak rusak",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED",
      "GARIS ANGKA TIDAK TERBACA DENGAN JELAS / BERKARAT",
      "ROLL METER / MISTAR BAJA TIDAK DALAM KONDISI BAIK / RUSAK",
    ],
  },
  {
    id: 3, itemCheck: "GO NO GO",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Tidak ada skrup yang kendor / hilang",
      "Kondisi GO NO GO dalam keadaan baik & bagian belakang (wire) dilindungi tape / spiral",
      "Ada stiker warna hijau pada GO NO GO terminal (M terminal) dan tidak lepas",
      "Kondisi GO NO GO terminal dalam keadaan OK (tidak aus, tidak bent, tidak patah, tidak deformasi)",
      "Bisa mendeteksi kondisi OK dan N-OK melalui sample OK dan N-OK",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "ADA SKRUP YANG KENDOR / HILANG",
      "KONDISI GO NO GO TIDAK BAIK / BAGIAN BELAKANG (WIRE) TIDAK DILINDUNGI TAPE / SPIRAL",
      "TIDAK ADA STIKER WARNA HIJAU PADA GO NO GO TERMINAL (M TERMINAL) / LEPAS",
      "KONDISI GO NO GO TERMINAL TIDAK OK (AUS / BENT / PATAH / DEFORMASI)",
      "TIDAK BISA MENDETEKSI KONDISI OK DAN N-OK",
    ],
  },
  {
    id: 4, itemCheck: "PUSH GAUGE RB",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Tidak ada skrup yang kendor / hilang",
      "Ada bantalan karet (cushion) pada ujungnya",
      "Lampu indikator menyala",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "ADA SKRUP YANG KENDOR / HILANG",
      "TIDAK ADA BANTALAN KARET (CUSHION) PADA UJUNGNYA",
      "LAMPU INDIKATOR TIDAK MENYALA",
    ],
  },
  {
    id: 5, itemCheck: "DUMMY SAMPLE OK & N-OK",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Sample dalam kondisi baik dan tidak rusak",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "SAMPLE TIDAK DALAM KONDISI BAIK / RUSAK",
    ],
  },
  {
    id: 6, itemCheck: "IMPORTANT / INSPECTION POINT",
    checkpoints: [
      "Important / Inspection Point terbaca dengan jelas dan tidak rusak",
      "Isi Important / Inspection Point sesuai dengan level terbaru",
    ],
    ngChoices: [
      "IMPORTANT / INSPECTION POINT TIDAK TERBACA DENGAN JELAS / RUSAK",
      "ISI IMPORTANT / INSPECTION POINT TIDAK SESUAI DENGAN LEVEL TERBARU",
    ],
  },
  {
    id: 7, itemCheck: "FUSE PLATE",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Warna dan angka ada dan terbaca dengan jelas",
      "Fuse plate dalam kondisi baik dan tidak rusak",
      "Fuse insertion / penekan fuse dalam kondisi OK",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "WARNA DAN ANGKA TIDAK ADA / TIDAK TERBACA DENGAN JELAS",
      "FUSE PLATE TIDAK DALAM KONDISI BAIK / RUSAK",
      "FUSE INSERTION / PENEKAN FUSE TIDAK DALAM KONDISI OK",
    ],
  },
  {
    id: 8, itemCheck: "LAMPU NAVIGASI",
    checkpoints: [
      "Lampu LED kondisi menyala",
      "Cover LED tidak hilang atau pecah",
      "Lampu LED terpasang sempurna / tidak lepas",
    ],
    ngChoices: [
      "LAMPU LED TIDAK MENYALA / MATI",
      "COVER LED HILANG ATAU PECAH",
      "LAMPU LED TIDAK TERPASANG SEMPURNA / LEPAS",
    ],
  },
  {
    id: 9, itemCheck: "TAPE NAVIGASI",
    checkpoints: [
      "Lampu LED kondisi menyala",
      "Kondisi switch tidak rusak",
      "Ada identitas tape",
    ],
    ngChoices: [
      "LAMPU LED TIDAK MENYALA / MATI",
      "KONDISI SWITCH RUSAK",
      "TIDAK ADA IDENTITAS TAPE",
    ],
  },
  {
    id: 10, itemCheck: "INSPECTION BOARD",
    checkpoints: [
      "Tidak ada skrup & baut yang menonjol dan tajam",
      "Approval sheet sesuai level terakhir",
      "Approval sheet ditanda tangani QA",
      "Kondisi sample dan plastik tidak rusak",
    ],
    ngChoices: [
      "ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM",
      "APPROVAL SHEET TIDAK SESUAI LEVEL TERAKHIR",
      "APPROVAL SHEET TIDAK DITANDA TANGANI QA",
      "KONDISI SAMPLE DAN PLASTIK RUSAK",
    ],
  },
  {
    id: 11, itemCheck: "DRY SURF",
    checkpoints: [
      "Botol tidak bocor / rusak & ada sticker B3",
      "Spons / kuas tidak rusak / aus",
      "Ada tanda MAX & MIN pada botol dan isi cairan sesuai rentang MAX dan MIN",
    ],
    ngChoices: [
      "BOTOL BOCOR / RUSAK / TIDAK ADA STICKER B3",
      "SPONS / KUAS RUSAK / AUS",
      "TIDAK ADA TANDA MAX & MIN PADA BOTOL / ISI CAIRAN TIDAK SESUAI RENTANG MAX DAN MIN",
    ],
  },
  {
    id: 12, itemCheck: "PACKING",
    checkpoints: [
      "Kondisi tutup polytainer tidak rusak dan jumlahnya sudah sesuai (TNGA: 5 pcs, selain TNGA: 4 pcs per pattern yang jalan)",
      "HT scan bisa berfungsi dengan baik",
      "Majun dan sikat polytainer ada pada tempatnya dan sesuai dengan jumlahnya (majun 1 pc, sikat 1 pc)",
    ],
    ngChoices: [
      "KONDISI TUTUP POLYTAINER RUSAK / JUMLAH TIDAK SESUAI",
      "HT SCAN TIDAK BISA BERFUNGSI DENGAN BAIK",
      "MAJUN DAN SIKAT POLYTAINER TIDAK ADA / JUMLAH TIDAK SESUAI",
    ],
  },
];

const FA_SPECIFIC_AREA_ITEMS: Record<string, number[]> = {
  "WP CHECK": [1, 3, 5, 6],
  "CHECKER": [1, 3, 5, 6, 7, 9, 10],
  "VISUAL 1": [1, 2, 3, 5, 6, 8, 9, 10],
  "VISUAL 2": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "DOUBLE CHECK (RI)": [1, 3, 4, 5, 6, 10, 12],
};

const FA_SPECIFIC_AREA_OPTIONS = ["WP CHECK", "CHECKER", "VISUAL 1", "VISUAL 2", "DOUBLE CHECK (RI)"];

export default function ChecksheetFinalAssyPage() {
  const { user, loading: authLoading, isInitialized } = useAuth();
  const userId = user?.id ?? null;
  const userRole = user?.role ?? null;
  const userFullName = user?.fullName ?? null;
  const userUsername = user?.username ?? null;

  const [areaCode, setAreaCode] = useState("");
  const [areaName, setAreaName] = useState("");
  const [shift, setShift] = useState<"A" | "B">("A");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate] = useState(new Date());
  const [checklistType, setChecklistType] = useState<ChecklistType>("inspector");

  const isGroupLeader = userRole === "group-leader-qa";
  const isDailyInspector = checklistType === "inspector";

  const effectiveAreaCode = useMemo(() => {
    if (!areaCode) return areaCode;
    if (checklistType === "group-leader" && areaCode.startsWith("final-assy-insp-"))
      return areaCode.replace("final-assy-insp-", "final-assy-gl-");
    if (checklistType === "inspector" && areaCode.startsWith("final-assy-gl-"))
      return areaCode.replace("final-assy-gl-", "final-assy-insp-");
    return areaCode;
  }, [areaCode, checklistType]);

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Record<number, ChecklistResult>>({});
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [faResults, setFaResults] = useState<Record<number, FADciResult>>({});
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Record<number, boolean>>({});
  const [photoZoomSrc, setPhotoZoomSrc] = useState<string | null>(null);
  const [dciScannedItemId, setDciScannedItemId] = useState<number | null>(null);
  const [dciCardVisible, setDciCardVisible] = useState(false);
  const [dciSaveToast, setDciSaveToast] = useState(false);

  // ── State Conveyor (untuk kedua mode: Inspector dan GL) ─────────────────
  const [conveyor, setConveyor] = useState("");

  const [selectedSpecificArea, setSelectedSpecificArea] = useState("WP CHECK");

  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanFocusInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const dciSaveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // State untuk peringatan duplikat item
  interface DuplicateWarning {
    itemId: number;
    itemCheck: string;
    duplicateLocations: string[];
    onConfirm: () => void;
  }
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<number | null>(null);
  const [scannedGaugeIds, setScannedGaugeIds] = useState<Record<number, string>>({});

  // Computed: apakah ada conveyor yang dipilih (untuk disable tombol simpan)
  const hasLocation = !!conveyor;

  // ── 1. Auth check ────────────────────────────────────────────────────────
  const checklistTypeInitRef = useRef(false);
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!userId) { window.location.href = '/login-page'; return; }
    if (!checklistTypeInitRef.current) {
      checklistTypeInitRef.current = true;
      if (userRole === "inspector-qa") setChecklistType("inspector");
      else if (userRole === "group-leader-qa") setChecklistType("inspector");
    }
  }, [userId, userRole, authLoading, isInitialized]);

  // ── 2. Baca URL params SEKALI saat mount ─────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const areaCodeParam = params.get("areaCode");
    const areaNameParam = params.get("areaName");
    const shiftParam = params.get("shift");
    if (!areaCodeParam) return;
    setAreaCode(areaCodeParam);
    if (areaNameParam) setAreaName(decodeURIComponent(areaNameParam));
    if (shiftParam === "A" || shiftParam === "B") setShift(shiftParam as "A" | "B");
  }, []);

  // ── 3. Fetch conveyor options (untuk kedua mode) ──────────────────────────
  // Tidak perlu fetch di sini karena ConveyorSection akan menangani semuanya

  // ── 4. Load checklist items (hanya untuk GL mode) ────────────────────────
  useEffect(() => {
    if (!userId || !areaCode || authLoading || isDailyInspector) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setResults({});
      setExpandedItem(null);
      try {
        const res = await fetch(
          `/api/final-assy/get-checklist-items?type=${checklistType}&areaCode=${effectiveAreaCode}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const ESO_KEYWORDS = ["ESO", "selasa dan kamis", "Selasa dan Kamis", "Selasa & Kamis"];
          setChecklistItems(data.data.filter((item: ChecklistItem) => {
            const shiftOk = item.shifts?.some((s: any) => s.shift === shift);
            const isESO = ESO_KEYWORDS.some(kw => item.checkPoint?.toLowerCase().includes(kw.toLowerCase()));
            return shiftOk && !isESO;
          }));
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
  }, [userId, authLoading, checklistType, shift, areaCode, effectiveAreaCode, isDailyInspector]);

  // ── 5. Load saved results ─────────────────────────────────────────────────
  const loadSavedResultsFn = useCallback(async (locationKey: string) => {
    if (!userId || !areaCode || !locationKey) return;
    try {
      const dateKey = getLocalDateKey(selectedDate);
      const categoryCode = checklistType === "inspector" ? "final-assy-inspector" : "final-assy-gl";

      // Kedua mode menggunakan conveyor sebagai location key
      const specificAreaParam = (checklistType === "inspector" && selectedSpecificArea)
        ? `&specificArea=${encodeURIComponent(selectedSpecificArea)}`
        : "";

      const fetchUrl =
        `/api/final-assy/get-results?userId=${userId}` +
        `&categoryCode=${categoryCode}` +
        `&month=${dateKey.slice(0, 7)}` +
        `&role=${userRole}` +
        `&areaCode=${encodeURIComponent(effectiveAreaCode)}` +
        `&conveyor=${encodeURIComponent(locationKey)}` +
        `&shift=${encodeURIComponent(shift)}` +
        specificAreaParam;

      const res = await fetch(fetchUrl);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.formatted) {
        const todayResults = data.formatted[dateKey] || {};

        if (checklistType === "inspector") {
          const loaded: Record<number, FADciResult> = {};
          const allowedItemIds = FA_SPECIFIC_AREA_ITEMS[selectedSpecificArea] || [];

          Object.entries(todayResults).forEach(([key, val]: [string, any]) => {
            const firstDash = key.indexOf("-");
            const lastDash  = key.lastIndexOf("-");
            if (firstDash === -1 || lastDash === -1 || firstDash === lastDash) return;

            const itemNoStr   = key.slice(0, firstDash);
            const keySpecArea = key.slice(firstDash + 1, lastDash);
            const resultShift = key.slice(lastDash + 1);
            const itemNo      = parseInt(itemNoStr, 10);

            if (
              !isNaN(itemNo) &&
              resultShift === shift &&
              keySpecArea === selectedSpecificArea &&
              allowedItemIds.includes(itemNo)
            ) {
              let selectedNgChoices: string[] = [], ngOtherNote = "", ngPhotos: string[] = [];
              try {
                const parsed = JSON.parse(val.ngDescription || "{}");
                if (Array.isArray(parsed)) selectedNgChoices = parsed;
                else if (parsed && typeof parsed === "object") {
                  selectedNgChoices = Array.isArray(parsed.choices) ? parsed.choices : [];
                  ngOtherNote = parsed.other || "";
                }
              } catch { selectedNgChoices = []; }
              try { const pp = JSON.parse(val.ngPhotos || "[]"); if (Array.isArray(pp)) ngPhotos = pp; } catch { ngPhotos = []; }

              loaded[itemNo] = {
                itemId: itemNo,
                status: val.status === "OK" ? "OK" : val.status === "NG" ? "NG" : null,
                selectedNgChoices,
                ngOtherNote,
                ngPhotos
              };
            }
          });

          setFaResults(prev => {
            if (JSON.stringify(prev) === JSON.stringify(loaded)) return prev;
            return loaded;
          });
        } else {
          // GL mode - menggunakan struktur yang sama untuk kompatibilitas
          const loaded: Record<number, ChecklistResult> = {};
          Object.entries(todayResults).forEach(([key, result]: [string, any]) => {
            const lastDash = key.lastIndexOf("-");
            if (lastDash === -1) return;
            const itemId = parseInt(key.slice(0, lastDash), 10);
            const resultShift = key.slice(lastDash + 1);

            if (!isNaN(itemId) && resultShift === shift) {
              let ngPhotos: string[] = [];
              try { const pp = JSON.parse(result.ngPhotos || "[]"); if (Array.isArray(pp)) ngPhotos = pp; } catch { ngPhotos = []; }

              loaded[itemId] = {
                itemId,
                status: result.status === "OK" ? "OK" : result.status === "NG" ? "NG" : null,
                notes: result.ngDescription || "",
                ngPhotos
              };
            }
          });

          setResults(prev => {
            if (JSON.stringify(prev) === JSON.stringify(loaded)) return prev;
            return loaded;
          });
        }
      }
    } catch (err) {
      console.error("Load error:", err);
    }
  }, [userId, checklistType, areaCode, effectiveAreaCode, userRole, shift, selectedDate, selectedSpecificArea]);

  // ── Trigger load ketika conveyor berubah ──────────────────────────────────
  useEffect(() => {
    if (!conveyor) {
      if (isDailyInspector) {
        setFaResults({});
      } else {
        setResults({});
      }
      return;
    }
    loadSavedResultsFn(conveyor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conveyor, selectedDate, selectedSpecificArea, isDailyInspector]);

  // ── Reset conveyor saat ganti mode ────────────────────────────────────────
  useEffect(() => {
    setConveyor("");
    if (isDailyInspector) {
      setFaResults({});
    } else {
      setResults({});
    }
    setSaveSuccess(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDailyInspector]);

  // ── filteredFaDciItems ────────────────────────────────────────────────────
  const filteredFaDciItems = useMemo(() => {
    const allowed = FA_SPECIFIC_AREA_ITEMS[selectedSpecificArea];
    if (!allowed) return FA_DCI_ITEMS;
    return FA_DCI_ITEMS.filter(item => allowed.includes(item.id));
  }, [selectedSpecificArea]);

  const filteredFaDciItemsRef = useRef(FA_DCI_ITEMS);
  useEffect(() => { filteredFaDciItemsRef.current = filteredFaDciItems; }, [filteredFaDciItems]);

  const completedCount = useMemo(() => {
    if (checklistType === "inspector") {
      return Object.values(faResults).filter(r => r.status !== null).length;
    }
    return Object.values(results).filter(r => r.status !== null).length;
  }, [checklistType, faResults, results]);

  const totalCount = isDailyInspector ? filteredFaDciItems.length : checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    setResults(prev => {
      if (prev[itemId]?.status === clicked) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [itemId]: {
          itemId,
          status: clicked,
          notes: prev[itemId]?.notes || "",
          ngPhotos: prev[itemId]?.ngPhotos || []
        }
      };
    });
    setSaveSuccess(false);
  }, []);

  const handleNotesChange = useCallback((itemId: number, notes: string) => {
    setResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        notes,
        status: prev[itemId]?.status || null
      }
    }));
    setSaveSuccess(false);
  }, []);

  const handleGLPhotoAdd = useCallback((itemId: number, base64: string) => {
    setResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        status: prev[itemId]?.status || "NG",
        notes: prev[itemId]?.notes || "",
        ngPhotos: [...(prev[itemId]?.ngPhotos || []), base64]
      }
    }));
    setSaveSuccess(false);
  }, []);

  const handleGLPhotoRemove = useCallback((itemId: number, photoIdx: number) => {
    setResults(prev => {
      const photos = [...(prev[itemId]?.ngPhotos || [])];
      photos.splice(photoIdx, 1);
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          itemId,
          ngPhotos: photos
        }
      };
    });
    setSaveSuccess(false);
  }, []);

  const handleDciScanInput = useCallback((raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    const match = trimmed.match(/^DCI-(\d+)(?:-(.+))?$/);
    if (match) {
      const itemId  = parseInt(match[1], 10);
      const gaugeId = match[2] ? match[2].trim() : null;

      const currentFiltered = filteredFaDciItemsRef.current;
      const inFiltered = currentFiltered.some(i => i.id === itemId);
      const inAll = FA_DCI_ITEMS.some(i => i.id === itemId);
      if (inFiltered || inAll) {
        if (gaugeId) {
          setScannedGaugeIds(prev => ({ ...prev, [itemId]: gaugeId }));
        }
        setDciScannedItemId(itemId);
        setDciCardVisible(false);
        setTimeout(() => setDciCardVisible(true), 30);
      }
    }
  }, []);

  useEffect(() => {
    if (!isDailyInspector) return;

    const stealFocusIfSafe = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) {
        scanInputRef.current?.focus({ preventScroll: true });
        return;
      }
      const tag = active.tagName;
      const isFormField =
        (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
        active !== scanInputRef.current;
      const isInNgPanel = active.closest?.(".dci-ng-panel") !== null;
      const isInCheckpointList = active.closest?.(".dci-checkpoint-list") !== null;
      if (!isFormField && !isInNgPanel && !isInCheckpointList) {
        scanInputRef.current?.focus({ preventScroll: true });
      }
    };

    stealFocusIfSafe();
    scanFocusInterval.current = setInterval(stealFocusIfSafe, 300);
    return () => {
      if (scanFocusInterval.current) clearInterval(scanFocusInterval.current);
    };
  }, [isDailyInspector]);

  const handleDciCloseCard = useCallback(() => {
    setDciCardVisible(false);
    setTimeout(() => setDciScannedItemId(null), 220);
  }, []);

  const flashDciSaveToast = useCallback(() => {
    setDciSaveToast(true);
    if (dciSaveToastTimer.current) clearTimeout(dciSaveToastTimer.current);
    dciSaveToastTimer.current = setTimeout(() => setDciSaveToast(false), 1400);
  }, []);

  // ── Cek duplikat sebelum set status ─────────────────────────────────────
  const checkDuplicate = useCallback(async (
    itemId: number,
    clicked: "OK" | "NG",
    doSetStatus: () => void
  ) => {
    if (faResults[itemId]?.status === clicked) {
      doSetStatus();
      return;
    }
    if (!conveyor || !userId || !areaCode || !effectiveAreaCode) {
      doSetStatus();
      return;
    }

    const gaugeId = scannedGaugeIds[itemId] || null;
    if (!gaugeId) {
      doSetStatus();
      return;
    }

    const itemInfo = FA_DCI_ITEMS.find(i => i.id === itemId);
    const itemCheck = itemInfo?.itemCheck ?? `Item ${itemId}`;
    const dateKey = getLocalDateKey(selectedDate);

    setIsCheckingDuplicate(itemId);
    try {
      const res = await fetch("/api/final-assy/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          categoryCode: "final-assy-inspector",
          itemId,
          gaugeId,
          dateKey,
          shift,
          areaCode: effectiveAreaCode,
          // Kirim conveyor sebagai carline untuk backward compat dengan check-duplicate
          carline: conveyor,
          line: null,
          specificArea: selectedSpecificArea,
        }),
      });

      const data = await res.json();

      if (data.isDuplicate && data.duplicates?.length > 0) {
        const locations: string[] = data.duplicates.map((d: any) => d.description).filter(Boolean);
        setDuplicateWarning({
          itemId,
          itemCheck,
          duplicateLocations: locations,
          onConfirm: () => {
            setDuplicateWarning(null);
            doSetStatus();
          },
        });
      } else {
        doSetStatus();
      }
    } catch {
      doSetStatus();
    } finally {
      setIsCheckingDuplicate(null);
    }
  }, [faResults, conveyor, userId, areaCode, effectiveAreaCode,
      selectedSpecificArea, shift, selectedDate, scannedGaugeIds]);

  const handleDciScanStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    const doSetStatus = () => {
      setFaResults(prev => {
        if (prev[itemId]?.status === clicked) {
          const { [itemId]: _, ...rest } = prev;
          return rest;
        }
        return {
          ...prev,
          [itemId]: {
            itemId,
            status: clicked,
            selectedNgChoices: clicked === "OK" ? [] : (prev[itemId]?.selectedNgChoices || []),
            ngOtherNote: clicked === "OK" ? "" : (prev[itemId]?.ngOtherNote || ""),
            ngPhotos: clicked === "OK" ? [] : (prev[itemId]?.ngPhotos || [])
          }
        };
      });
      setSaveSuccess(false);
      if (clicked === "OK") {
        flashDciSaveToast();
      }
    };

    checkDuplicate(itemId, clicked, doSetStatus);
  }, [flashDciSaveToast, checkDuplicate]);

  const toggleCheckpoints = useCallback((itemId: number) => {
    setExpandedCheckpoints(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const handleDciNgChoiceToggle = useCallback((itemId: number, choice: string) => {
    setFaResults(prev => {
      const current = prev[itemId]?.selectedNgChoices || [];
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          itemId,
          status: "NG",
          selectedNgChoices: current.includes(choice)
            ? current.filter(c => c !== choice)
            : [...current, choice],
          ngOtherNote: prev[itemId]?.ngOtherNote || "",
          ngPhotos: prev[itemId]?.ngPhotos || []
        }
      };
    });
    setSaveSuccess(false);
  }, []);

  const handleDciOtherNoteChange = useCallback((itemId: number, note: string) => {
    setFaResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        status: "NG",
        selectedNgChoices: prev[itemId]?.selectedNgChoices || [],
        ngOtherNote: note,
        ngPhotos: prev[itemId]?.ngPhotos || []
      }
    }));
    setSaveSuccess(false);
  }, []);

  const handleDciPhotoAdd = useCallback((itemId: number, base64: string) => {
    setFaResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        status: "NG",
        selectedNgChoices: prev[itemId]?.selectedNgChoices || [],
        ngOtherNote: prev[itemId]?.ngOtherNote || "",
        ngPhotos: [...(prev[itemId]?.ngPhotos || []), base64]
      }
    }));
    setSaveSuccess(false);
  }, []);

  const handleDciPhotoRemove = useCallback((itemId: number, photoIdx: number) => {
    setFaResults(prev => {
      const photos = [...(prev[itemId]?.ngPhotos || [])];
      photos.splice(photoIdx, 1);
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          itemId,
          ngPhotos: photos
        }
      };
    });
    setSaveSuccess(false);
  }, []);

  // ── handleSubmit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId || !areaCode) return;

    if (!conveyor) {
      alert("⚠️ Silakan pilih atau tambahkan Conveyor terlebih dahulu.");
      return;
    }

    const categoryCode = isDailyInspector ? "final-assy-inspector" : "final-assy-gl";
    const dateKey = getLocalDateKey(selectedDate);

    if (isDailyInspector) {
      const ngWithoutInfo = filteredFaDciItems.filter(item => {
        const r = faResults[item.id];
        return (
          r?.status === "NG" &&
          (r.selectedNgChoices?.length ?? 0) === 0 &&
          !(r.ngOtherNote?.trim()) &&
          (r.ngPhotos?.length ?? 0) === 0
        );
      });
      if (ngWithoutInfo.length > 0) {
        alert(
          `⚠️ Untuk item NG, wajib mengisi kondisi NG, keterangan, atau foto.\n\nItem belum lengkap:\n${ngWithoutInfo
            .map(i => i.itemCheck)
            .join(", ")}`
        );
        return;
      }
    }

    if (!isDailyInspector) {
      const glNgWithoutInfo = checklistItems.filter(item => {
        const r = results[item.id];
        return r?.status === "NG" && (r.ngPhotos?.length ?? 0) === 0 && !(r.notes?.trim());
      });
      if (glNgWithoutInfo.length > 0) {
        alert(
          `⚠️ Untuk item NG (Group Leader), wajib mengisi keterangan atau menambahkan foto.\n\nItem belum lengkap:\n${glNgWithoutInfo
            .map(i => i.checkPoint)
            .join(", ")}`
        );
        return;
      }
    }

    const itemsToSave = isDailyInspector
      ? filteredFaDciItems.filter(
          item =>
            faResults[item.id]?.status !== null &&
            faResults[item.id]?.status !== undefined
        )
      : checklistItems.filter(
          item =>
            results[item.id]?.status !== null &&
            results[item.id]?.status !== undefined
        );

    if (itemsToSave.length === 0 && !window.confirm("Tidak ada item yang diisi. Yakin ingin menyimpan?")) {
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setIsSubmitting(true);
    setSaveSuccess(false);

    try {
      await Promise.all(
        itemsToSave.map(item => {
          let status: "OK" | "NG";
          let ngDescription: string | null;
          let ngPhotos: string[] | null = null;

          if (isDailyInspector) {
            const r = faResults[item.id];
            if (!r || r.status === null) return Promise.resolve();
            status = r.status;
            ngDescription =
              status === "NG"
                ? JSON.stringify({
                    choices: r.selectedNgChoices || [],
                    other: r.ngOtherNote?.trim() || ""
                  })
                : null;
            ngPhotos = status === "NG" ? (r.ngPhotos || []) : null;
          } else {
            const r = results[item.id];
            if (!r || r.status === null) return Promise.resolve();
            status = r.status;
            ngDescription = status === "NG" ? (r.notes || null) : null;
            ngPhotos = status === "NG" ? (r.ngPhotos || []) : null;
          }

          const payload = {
            userId,
            categoryCode,
            itemId: item.id,
            dateKey,
            shift,
            status,
            ngDescription,
            ngDepartment: status === "NG" ? "QA" : null,
            ngPhotos,
            areaCode: effectiveAreaCode,
            // Kedua mode menggunakan conveyor
            conveyor: conveyor,
            carline: null,
            line: null,
            specificArea: isDailyInspector ? selectedSpecificArea : null,
            timeSlot: isDailyInspector ? (scannedGaugeIds[item.id] || '') : '',
          };

          return fetch("/api/final-assy/save-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              if (res.status === 409 && errData.error === "DUPLICATE_ITEM") {
                setFaResults(prev => {
                  const { [item.id]: _, ...rest } = prev;
                  return rest;
                });
                setScannedGaugeIds(prev => {
                  const { [item.id]: _, ...rest } = prev;
                  return rest;
                });

                const itemInfo = FA_DCI_ITEMS.find(i => i.id === item.id);
                const itemCheck = itemInfo?.itemCheck ?? `Item ${item.id}`;
                const locations: string[] = (errData.duplicates || [])
                  .map((d: any) => d.description)
                  .filter(Boolean);
                throw {
                  isDuplicateError: true,
                  itemCheck,
                  locations,
                };
              }
              throw new Error(errData.error || `HTTP ${res.status}`);
            }
          });
        })
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      if (err?.isDuplicateError) {
        alert(
          `⚠️ Item "${err.itemCheck}" sudah pernah di-check di:` + err.locations.map((l: string) => `• ${l}`).join("") +
          `Setiap item hanya boleh di-check 1 kali per hari per shift.`
        );
      } else {
        alert("❌ Gagal menyimpan checklist. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const checklistTypeLabel = (type: ChecklistType) =>
    type === "group-leader" ? "Daily Group Leader" : "Daily Check Inspector Final Assy";

  const isDateEditable = (date: Date) => {
    const diffTime = Math.abs(currentDate.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  };

  if (authLoading || !isInitialized) {
    return <div className="loading-page">Memuat...</div>;
  }
  if (!userId) return null;
  if (!areaCode || !areaName) {
    return (
      <>
        <Sidebar userName={userFullName || userUsername || ""} />
        <main className="main-content">
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-text">
              Area tidak ditemukan. Silakan scan QR Code pada area yang ingin diperiksa.
            </span>
            <button onClick={() => (window.location.href = "/home")} className="error-retry">
              Kembali ke Home
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <button onClick={() => window.history.back()} className="back-button" aria-label="Kembali">
        ←
      </button>

      <main className="main-content">
        <div className="header-section">
          <h1 className="page-title">Final Assy Checksheet</h1>
          <div className="header-actions">
            <button className="icon-button">🔔</button>
            <button className="icon-button">👤</button>
          </div>
        </div>

        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Tipe Checklist:</span>
            {isGroupLeader ? (
              <div className="checklist-type-selector">
                <select
                  className="type-dropdown"
                  value={checklistType}
                  onChange={e => {
                    setChecklistType(e.target.value as ChecklistType);
                    setSaveSuccess(false);
                  }}
                >
                  <option value="inspector">Daily Check Inspector</option>
                  <option value="group-leader">Daily Group Leader</option>
                </select>
                <span className="dropdown-badge gl">GL Mode</span>
              </div>
            ) : (
              <div className="checklist-type-static">
                <span className="info-value">
                  {checklistTypeLabel(checklistType as ChecklistType)}
                </span>
                <span className="dropdown-badge ins">Inspector</span>
              </div>
            )}
          </div>

          <div className="info-row">
            <span className="info-label">Area:</span>
            <span className="info-value area-value">{areaName}</span>
          </div>

          <div className="info-row">
            <span className="info-label">Shift:</span>
            <select
              className="shift-dropdown"
              value={shift}
              onChange={e => {
                const newShift = e.target.value as "A" | "B";
                setShift(newShift);
                setFaResults({});
                setResults({});
                setChecklistItems([]);
                setSaveSuccess(false);
                if (conveyor) {
                  loadSavedResultsFn(conveyor);
                }
              }}
            >
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
            </select>
          </div>

          <div className="info-row">
            <span className="info-label">Tanggal:</span>
            <input
              type="date"
              value={getLocalDateKey(selectedDate)}
              onChange={e => {
                const newDate = new Date(e.target.value);
                setSelectedDate(newDate);
                setFaResults({});
                setResults({});
                setChecklistItems([]);
                setSaveSuccess(false);
                if (conveyor) {
                  loadSavedResultsFn(conveyor);
                }
              }}
              max={getLocalDateKey(currentDate)}
              min={getLocalDateKey(new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000))}
              className="date-input"
              style={{
                padding: "7px 12px",
                borderRadius: "8px",
                border: "2px solid #1e88e5",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1e293b",
                background: "white",
                cursor: "pointer",
                outline: "none",
              }}
            />
            {!isDateEditable(selectedDate) && (
              <span style={{ fontSize: "11px", color: "#ef4444", marginLeft: "8px" }}>
                ⚠️ Hanya bisa edit max 30 hari ke belakang
              </span>
            )}
          </div>

          <div className="info-row">
            <span className="info-label">Tanggal Hari Ini:</span>
            <span className="info-value">
              {formatDate(currentDate)}
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                ({getLocalDateKey(currentDate)})
              </span>
            </span>
          </div>

          {isDailyInspector && (
            <div className="info-row">
              <span className="info-label">🔍 Spesifik Area:</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  justifyContent: "flex-end"
                }}
              >
                <select
                  className="specific-area-dropdown"
                  value={selectedSpecificArea}
                  onChange={e => {
                    const newArea = e.target.value;
                    setSelectedSpecificArea(newArea);
                    setDciScannedItemId(null);
                    setDciCardVisible(false);
                    setSaveSuccess(false);
                    if (conveyor) {
                      loadSavedResultsFn(conveyor);
                    }
                  }}
                >
                  {FA_SPECIFIC_AREA_OPTIONS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <span className="specific-area-badge">{filteredFaDciItems.length} item</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Conveyor Section (untuk kedua mode) ───────────────────────────── */}
        <ConveyorSection
          conveyor={conveyor}
          setConveyor={val => {
            setConveyor(val);
            if (isDailyInspector) {
              setFaResults({});
            } else {
              setResults({});
            }
            setSaveSuccess(false);
          }}
          areaCode={effectiveAreaCode}
          userId={userId ?? undefined}
          categoryCode={isDailyInspector ? "final-assy-inspector" : "final-assy-gl"}
          isLoading={isLoading}
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
                <span className="progress-text">
                  Progress: {completedCount} / {totalCount} item selesai
                </span>
                <span className="progress-percent">{Math.round(progressPercent)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            {saveSuccess && (
              <div className="success-banner">
                <span>✅</span>
                <span>Checklist berhasil disimpan!</span>
              </div>
            )}
            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{error}</span>
                <button onClick={() => window.location.reload()} className="error-retry">
                  Coba Lagi
                </button>
              </div>
            )}

            {isDailyInspector ? (
              <div
                className="info-box-partial"
                style={{
                  borderLeftColor: "#7c3aed",
                  background: "#f5f3ff",
                  borderColor: "#ddd6fe"
                }}
              >
                <span>📡</span>
                <span className="info-text">
                  <strong>Scan Mode Aktif:</strong> Arahkan scanner TC21 ke QR Code pada Item
                  Check untuk memulai. QR Code format:{" "}
                  <code
                    style={{
                      background: "#ede9fe",
                      padding: "1px 5px",
                      borderRadius: 4,
                      fontSize: 11
                    }}
                  >
                    DCI-1
                  </code>{" "}
                  s/d{" "}
                  <code
                    style={{
                      background: "#ede9fe",
                      padding: "1px 5px",
                      borderRadius: 4,
                      fontSize: 11
                    }}
                  >
                    DCI-{filteredFaDciItems[filteredFaDciItems.length - 1]?.id || FA_DCI_ITEMS.length}
                  </code>
                </span>
              </div>
            ) : (
              <div className="info-box-partial">
                <span>ℹ️</span>
                <span className="info-text">
                  <strong>Simpan Parsial:</strong> Anda dapat menyimpan meskipun belum semua item
                  terisi. <strong>Klik status yang sama 2x untuk membatalkan pilihan.</strong>
                </span>
              </div>
            )}

            <div className="checklist-container">
              {isDailyInspector ? (
                <div className="dci-scan-wrapper">
                  <input
                    ref={scanInputRef}
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      val.split(/[\r\n]+/).forEach(line => {
                        const trimmed = line.trim();
                        if (trimmed.length >= 3) handleDciScanInput(trimmed);
                      });
                      e.target.value = "";
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const inp = e.currentTarget;
                        const val = inp.value.trim();
                        if (val.length >= 3) handleDciScanInput(val);
                        inp.value = "";
                        e.preventDefault();
                      }
                    }}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 1,
                      height: 1,
                      top: 0,
                      left: 0,
                      pointerEvents: "none",
                    }}
                    inputMode="none"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    tabIndex={-1}
                    readOnly={false}
                    aria-hidden="true"
                  />

                  {dciSaveToast && <div className="dci-save-toast">✓ TERSIMPAN</div>}

                  {dciScannedItemId === null && (
                    <div className="dci-standby">
                      <div className="dci-standby-scan-zone">
                        <div className="dci-reticle">
                          <div className="dci-reticle-corner dci-tl" />
                          <div className="dci-reticle-corner dci-tr" />
                          <div className="dci-reticle-corner dci-bl" />
                          <div className="dci-reticle-corner dci-br" />
                          <div className="dci-scan-line" />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <span className="scanner-active-badge">🔴 Scanner Aktif</span>
                          <p className="dci-standby-hint" style={{ marginTop: 8 }}>
                            {conveyor
                              ? "Arahkan scanner TC21 ke QR Code pada Item Check"
                              : "Scanner siap — pilih atau tambahkan Conveyor untuk menyimpan hasil"}
                          </p>
                        </div>
                        {conveyor && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: "6px 14px",
                              background: "#ede9fe",
                              borderRadius: 20,
                              border: "1px solid #c4b5fd"
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#5b21b6", fontWeight: 700 }}>
                              🔍 {selectedSpecificArea}
                            </span>
                            <span style={{ fontSize: 11, color: "#7c3aed", marginLeft: 8 }}>
                              {filteredFaDciItems.length} item check
                            </span>
                          </div>
                        )}
                      </div>
                      {Object.keys(faResults).length > 0 && (
                        <div className="dci-done-list">
                          <p className="dci-done-list-title">
                            Sudah di-check ({Object.values(faResults).filter(r => r.status).length})
                          </p>
                          {filteredFaDciItems
                            .filter(item => faResults[item.id]?.status != null)
                            .map(item => {
                              const r = faResults[item.id];
                              const isOk = r?.status === "OK";
                              return (
                                <div
                                  key={item.id}
                                  className="dci-done-row"
                                  onClick={() => {
                                    setDciScannedItemId(item.id);
                                    setDciCardVisible(false);
                                    setTimeout(() => setDciCardVisible(true), 30);
                                  }}
                                >
                                  <span className="dci-done-no">#{item.id}</span>
                                  <span className="dci-done-name">{item.itemCheck}</span>
                                  <span
                                    className={`dci-done-badge ${
                                      isOk ? "dci-done-badge--ok" : "dci-done-badge--ng"
                                    }`}
                                  >
                                    {isOk ? "✓ OK" : "✗ NG"}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {dciScannedItemId !== null &&
                    (() => {
                      const item =
                        filteredFaDciItems.find(i => i.id === dciScannedItemId) ||
                        FA_DCI_ITEMS.find(i => i.id === dciScannedItemId)!;
                      const dciResult = faResults[item.id];
                      const isFilled = dciResult?.status != null;
                      const isNg = dciResult?.status === "NG";
                      const isOk = dciResult?.status === "OK";
                      const ngEmpty =
                        isNg &&
                        (dciResult.selectedNgChoices?.length ?? 0) === 0 &&
                        !(dciResult.ngOtherNote?.trim()) &&
                        (dciResult.ngPhotos?.length ?? 0) === 0;
                      const checkpointsOpen = expandedCheckpoints[item.id] ?? false;
                      const indexNum =
                        filteredFaDciItems.indexOf(item) + 1 || FA_DCI_ITEMS.indexOf(item) + 1;
                      return (
                        <div
                          className={`dci-scan-card${dciCardVisible ? " dci-scan-card--visible" : ""}`}
                        >
                          <div className="dci-scan-card-topbar">
                            <button className="dci-scan-back-btn" onClick={handleDciCloseCard}>
                              ← Kembali
                            </button>
                            <div className="dci-scan-card-meta">
                              <span className="dci-scan-card-id">ID: DCI-{item.id}</span>
                              <span className="dci-scan-card-name">{item.itemCheck}</span>
                            </div>
                            <div
                              className={`dci-badge ${
                                isFilled
                                  ? isOk
                                    ? "dci-badge--ok"
                                    : "dci-badge--ng"
                                  : "dci-badge--empty"
                              }`}
                            >
                              {isFilled ? (isOk ? "OK" : "NG") : String(indexNum).padStart(2, "0")}
                            </div>
                          </div>
                          {isFilled && (
                            <div
                              className={`dci-scan-status-banner ${
                                isOk ? "dci-scan-status-banner--ok" : "dci-scan-status-banner--ng"
                              }`}
                            >
                              {isOk
                                ? "✓ KONDISI NORMAL — SEMUA OK"
                                : `✗ KONDISI NG${
                                    (dciResult.selectedNgChoices?.length ?? 0) > 0
                                      ? ` — ${dciResult.selectedNgChoices.length} TEMUAN`
                                      : " — PILIH KONDISI"
                                  }`}
                            </div>
                          )}
                          <button
                            className="dci-checkpoint-toggle"
                            onClick={() => toggleCheckpoints(item.id)}
                            aria-expanded={checkpointsOpen}
                          >
                            <span className="dci-cp-icon">📋</span>
                            <span>Lihat Checkpoint ({item.checkpoints.length} poin)</span>
                            <span className="dci-cp-arrow">{checkpointsOpen ? "▲" : "▼"}</span>
                          </button>
                          {checkpointsOpen && (
                            <div className="dci-checkpoint-list">
                              <p className="dci-cp-title">✅ Kondisi OK / Normal:</p>
                              {item.checkpoints.map((cp, ci) => (
                                <div key={ci} className="dci-cp-item">
                                  <span className="dci-cp-bullet">✓</span>
                                  <span className="dci-cp-text">{cp}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="dci-scan-status-row">
                            {(["OK", "NG"] as const).map(s => {
                              const isChecking = isCheckingDuplicate === item.id;
                              return (
                                <button
                                  key={s}
                                  className={[
                                    "dci-scan-status-btn",
                                    s === "OK" ? "dci-scan-status-btn--ok" : "dci-scan-status-btn--ng",
                                    dciResult?.status === s ? "dci-scan-status-btn--active" : ""
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={() => handleDciScanStatusChange(item.id, s)}
                                  disabled={isChecking}
                                  style={isChecking ? { opacity: 0.7, cursor: "wait" } : undefined}
                                >
                                  {isChecking ? (
                                    <>
                                      <span style={{
                                        width: 20, height: 20, border: "2px solid currentColor",
                                        borderTopColor: "transparent", borderRadius: "50%",
                                        display: "inline-block",
                                        animation: "spin 0.7s linear infinite"
                                      }} />
                                      <span className="dci-scan-btn-label" style={{ fontSize: 12 }}>Cek...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="dci-scan-btn-icon">{s === "OK" ? "✓" : "✗"}</span>
                                      <span className="dci-scan-btn-label">{s}</span>
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {isNg && (
                            <div
                              className={`dci-ng-panel${ngEmpty ? " dci-ng-panel--warn" : ""}`}
                            >
                              <div className="dci-ng-panel-header">
                                <span className="dci-ng-panel-icon">⚠️</span>
                                <span className="dci-ng-panel-title">
                                  Pilih kondisi NG yang ditemukan:
                                </span>
                                {ngEmpty && (
                                  <span className="dci-ng-required-badge">Wajib pilih ≥ 1</span>
                                )}
                              </div>
                              <div className="dci-ng-choices-list">
                                {item.ngChoices.map((choice, ci) => {
                                  const isSelected = dciResult.selectedNgChoices.includes(choice);
                                  return (
                                    <button
                                      key={ci}
                                      className={`dci-ng-choice-btn${
                                        isSelected ? " dci-ng-choice-btn--active" : ""
                                      }`}
                                      onClick={() => handleDciNgChoiceToggle(item.id, choice)}
                                      role="checkbox"
                                      aria-checked={isSelected}
                                    >
                                      <span className="dci-ng-check-box">
                                        {isSelected ? "✓" : " "}
                                      </span>
                                      <span className="dci-ng-choice-text">{choice}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {ngEmpty && (
                                <div className="dci-ng-empty-warn">
                                  ⚠ Wajib pilih kondisi NG, isi keterangan, atau tambah foto
                                </div>
                              )}
                              <div className="dci-ng-other-section">
                                <label className="dci-ng-other-label">
                                  <span className="dci-ng-other-icon">✏️</span>
                                  Tambahan Lainnya
                                  <span className="dci-ng-other-hint">(opsional)</span>
                                </label>
                                <textarea
                                  className="dci-ng-other-input"
                                  placeholder="Deskripsikan kondisi NG lainnya..."
                                  value={dciResult.ngOtherNote || ""}
                                  onChange={e => handleDciOtherNoteChange(item.id, e.target.value)}
                                  rows={2}
                                />
                              </div>
                              <div className="dci-ng-photo-section">
                                <div className="dci-ng-photo-header">
                                  <span className="dci-ng-photo-icon">📷</span>
                                  <span className="dci-ng-photo-label">Foto Dokumentasi</span>
                                  <span className="dci-ng-photo-hint">(opsional, maks. 5 foto)</span>
                                </div>
                                {(dciResult.ngPhotos?.length ?? 0) > 0 && (
                                  <div className="dci-photo-grid">
                                    {dciResult.ngPhotos.map((src, pi) => (
                                      <div key={pi} className="dci-photo-thumb-wrap">
                                        <img
                                          src={src}
                                          alt={`Foto NG ${pi + 1}`}
                                          className="dci-photo-thumb"
                                          onClick={() => setPhotoZoomSrc(src)}
                                        />
                                        <button
                                          className="dci-photo-remove-btn"
                                          onClick={() => handleDciPhotoRemove(item.id, pi)}
                                        >
                                          ✕
                                        </button>
                                        <div className="dci-photo-zoom-hint">🔍</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(dciResult.ngPhotos?.length ?? 0) < 5 && (
                                  <label className="dci-photo-add-btn">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      style={{ display: "none" }}
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = ev => {
                                          const img = new Image();
                                          img.onload = () => {
                                            const canvas = document.createElement("canvas");
                                            const MAX = 1024;
                                            let w = img.width;
                                            let h = img.height;
                                            if (w > MAX || h > MAX) {
                                              if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
                                              else { w = Math.round((w * MAX) / h); h = MAX; }
                                            }
                                            canvas.width = w;
                                            canvas.height = h;
                                            canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
                                            handleDciPhotoAdd(item.id, canvas.toDataURL("image/jpeg", 0.75));
                                          };
                                          img.src = ev.target?.result as string;
                                        };
                                        reader.readAsDataURL(file);
                                        e.target.value = "";
                                      }}
                                    />
                                    <span className="dci-photo-add-icon">📸</span>
                                    <span>
                                      {(dciResult.ngPhotos?.length ?? 0) === 0
                                        ? "Ambil / Pilih Foto"
                                        : `Tambah Foto (${dciResult.ngPhotos.length}/5)`}
                                    </span>
                                  </label>
                                )}
                              </div>
                              <button
                                className="dci-scan-ng-save-btn"
                                disabled={ngEmpty}
                                onClick={() => {
                                  flashDciSaveToast();
                                  setTimeout(() => handleDciCloseCard(), 600);
                                }}
                              >
                                {ngEmpty
                                  ? "Pilih kondisi NG terlebih dahulu"
                                  : `✓ SIMPAN — ${(dciResult.selectedNgChoices?.length ?? 0)} TEMUAN NG`}
                              </button>
                            </div>
                          )}
                          {isFilled && (
                            <button
                              className="dci-scan-next-btn"
                              onClick={() => {
                                if (isNg && ngEmpty) {
                                  alert("⚠️ Lengkapi kondisi NG terlebih dahulu.");
                                  return;
                                }
                                flashDciSaveToast();
                                handleDciCloseCard();
                              }}
                            >
                              <span>📡</span>
                              <span>Scan Item Berikutnya</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                </div>
              ) : checklistItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <p className="empty-title">Tidak ada item checklist</p>
                  <p className="empty-desc">
                    Pastikan area, shift, dan tipe checklist sudah benar.
                  </p>
                </div>
              ) : (
                checklistItems.map((item, index) => {
                  const result = results[item.id];
                  const isExpanded = expandedItem === item.id;
                  const isFilled = result?.status != null;
                  const isNg = result?.status === "NG";
                  return (
                    <div
                      key={item.id}
                      className={`checklist-item-card ${isExpanded ? "expanded" : ""} ${
                        isFilled ? "filled" : ""
                      }`}
                    >
                      <div
                        className="item-header"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
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
                        <span className={`status-indicator ${isFilled ? "filled" : "empty"}`}>
                          {isFilled ? "✓" : "○"}
                        </span>
                        <button className="expand-button" aria-expanded={isExpanded}>
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="item-details">
                          <div className="status-options">
                            {(["OK", "NG"] as const).map(s => (
                              <div
                                key={s}
                                className={`status-option ${
                                  result?.status === s ? `selected ${s.toLowerCase()}` : ""
                                }`}
                                onClick={() => handleStatusChange(item.id, s)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleStatusChange(item.id, s);
                                  }
                                }}
                              >
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
                            <textarea
                              className="form-textarea"
                              placeholder={
                                result?.status === "NG"
                                  ? "Deskripsikan temuan NG..."
                                  : "Masukkan keterangan (opsional)"
                              }
                              value={result?.notes || ""}
                              onChange={e => handleNotesChange(item.id, e.target.value)}
                              rows={3}
                              disabled={!result?.status}
                            />
                          </div>
                          {isNg && (
                            <div
                              className="gl-photo-section"
                              style={{
                                marginTop: "14px",
                                paddingTop: "14px",
                                borderTop: "1px dashed #e2e8f0"
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  marginBottom: "10px"
                                }}
                              >
                                <span style={{ fontSize: "16px" }}>📷</span>
                                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                                  Foto Dokumentasi NG
                                </span>
                                <span style={{ fontSize: "11px", color: "#64748b" }}>
                                  (opsional, maks. 5 foto)
                                </span>
                              </div>
                              {(result?.ngPhotos?.length ?? 0) > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                    marginBottom: "10px"
                                  }}
                                >
                                  {(result?.ngPhotos ?? []).map((src, pi) => (
                                    <div
                                      key={pi}
                                      style={{
                                        position: "relative",
                                        width: "80px",
                                        height: "80px",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        border: "2px solid #e2e8f0",
                                        cursor: "pointer",
                                        flexShrink: 0
                                      }}
                                    >
                                      <img
                                        src={src}
                                        alt={`Foto NG ${pi + 1}`}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                          display: "block"
                                        }}
                                        onClick={() => setPhotoZoomSrc(src)}
                                      />
                                      <button
                                        onClick={() => handleGLPhotoRemove(item.id, pi)}
                                        style={{
                                          position: "absolute",
                                          top: "3px",
                                          right: "3px",
                                          width: "20px",
                                          height: "20px",
                                          background: "rgba(239,68,68,0.9)",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "50%",
                                          cursor: "pointer",
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          zIndex: 2
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(result?.ngPhotos?.length ?? 0) < 5 && (
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "9px 16px",
                                    background: "white",
                                    border: "2px dashed #f59e0b",
                                    borderRadius: "9px",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "#92400e",
                                    width: "100%",
                                    boxSizing: "border-box" as const
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: "none" }}
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = ev => {
                                        const img = new Image();
                                        img.onload = () => {
                                          const canvas = document.createElement("canvas");
                                          const MAX = 1024;
                                          let w = img.width;
                                          let h = img.height;
                                          if (w > MAX || h > MAX) {
                                            if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
                                            else { w = Math.round((w * MAX) / h); h = MAX; }
                                          }
                                          canvas.width = w;
                                          canvas.height = h;
                                          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
                                          handleGLPhotoAdd(item.id, canvas.toDataURL("image/jpeg", 0.75));
                                        };
                                        img.src = ev.target?.result as string;
                                      };
                                      reader.readAsDataURL(file);
                                      e.target.value = "";
                                    }}
                                  />
                                  <span style={{ fontSize: "18px" }}>📸</span>
                                  <span>
                                    {(result?.ngPhotos?.length ?? 0) === 0
                                      ? "Ambil / Pilih Foto"
                                      : `Tambah Foto (${(result?.ngPhotos?.length ?? 0)}/5)`}
                                  </span>
                                </label>
                              )}
                            </div>
                          )}
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
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !hasLocation}
            aria-busy={isSubmitting}
            title={!hasLocation
              ? isDailyInspector
                ? "Pilih atau tambahkan Conveyor terlebih dahulu"
                : "Pilih Carline - Line terlebih dahulu"
              : ""}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" /> Menyimpan...
              </>
            ) : !hasLocation ? (
              isDailyInspector ? "⚠️ Pilih Conveyor dulu" : "⚠️ Pilih Carline - Line dulu"
            ) : (
              `💾 SIMPAN CHECKLIST${completedCount > 0 ? ` (${completedCount} item)` : ""}`
            )}
          </button>
          {completedCount > 0 && (
            <p className="submit-hint">{totalCount - completedCount} item belum diisi</p>
          )}
        </div>
      </main>

      {/* ── Duplicate Warning Modal ─────────────────────────────────────── */}
      {duplicateWarning && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 9998, display: "flex", alignItems: "center",
            justifyContent: "center", padding: "16px"
          }}
          onClick={() => setDuplicateWarning(null)}
        >
          <div
            style={{
              background: "white", borderRadius: 16, maxWidth: 440, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              padding: "18px 22px", display: "flex", alignItems: "center", gap: 12
            }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>
                  Item Sudah Pernah Di-Check
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.85)" }}>
                  Peringatan duplikasi checklist
                </p>
              </div>
            </div>

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{
                background: "#fffbeb", border: "1.5px solid #fcd34d",
                borderRadius: 10, padding: "14px 16px"
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                  Item yang ingin di-check:
                </p>
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b",
                  padding: "8px 12px", background: "white", borderRadius: 8,
                  border: "1px solid #e2e8f0"
                }}>
                  {duplicateWarning.itemCheck}
                </p>
              </div>

              <div style={{
                background: "#fef2f2", border: "1.5px solid #fca5a5",
                borderRadius: 10, padding: "14px 16px"
              }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#991b1b", fontWeight: 700 }}>
                  ✗ Sudah pernah di-check di:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {duplicateWarning.duplicateLocations.map((loc, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 8,
                      padding: "8px 12px", background: "white",
                      borderRadius: 8, border: "1px solid #fecaca"
                    }}>
                      <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>📍</span>
                      <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, lineHeight: 1.4 }}>
                        {loc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
                Setiap item hanya boleh di-check <strong>1 kali per hari per shift</strong>.<br />
                Apakah Anda yakin ingin melanjutkan?
              </p>
            </div>

            <div style={{
              padding: "14px 22px", borderTop: "1px solid #e2e8f0",
              display: "flex", gap: 10
            }}>
              <button
                onClick={() => setDuplicateWarning(null)}
                style={{
                  flex: 1, padding: "11px 16px", background: "#f1f5f9",
                  color: "#475569", border: "1.5px solid #e2e8f0",
                  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}
              >
                ← Batalkan
              </button>
              <button
                onClick={duplicateWarning.onConfirm}
                style={{
                  flex: 1, padding: "11px 16px", background: "#f59e0b",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}
              >
                Tetap Lanjut →
              </button>
            </div>
          </div>
        </div>
      )}

      {photoZoomSrc && (
        <div className="photo-zoom-overlay" onClick={() => setPhotoZoomSrc(null)}>
          <div className="photo-zoom-container" onClick={e => e.stopPropagation()}>
            <button className="photo-zoom-close" onClick={() => setPhotoZoomSrc(null)}>
              ✕
            </button>
            <img src={photoZoomSrc} alt="Foto NG" className="photo-zoom-img" />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .main-content{margin-left:80px;padding:20px;min-height:100vh;background:#f5f7fa;}
        .header-section{background:linear-gradient(135deg,#1e88e5,#1565c0);color:white;padding:16px 20px;border-radius:12px;margin-bottom:20px;display:flex;align-items:center;gap:16px;box-shadow:0 4px 12px rgba(30,136,229,0.2);}
        .back-button{position:fixed;top:16px;left:86px;background:rgba(30,136,229,0.15);border:none;color:#1e88e5;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:50;}
        .back-button:hover{background:rgba(30,136,229,0.25);}
        .page-title{flex:1;margin:0;font-size:20px;font-weight:700;}
        .header-actions{display:flex;gap:8px;}
        .icon-button{background:rgba(255,255,255,0.2);border:none;color:white;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:18px;transition:all 0.2s;}
        .info-card{background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .info-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;}
        .info-row:last-child{border-bottom:none;}
        .info-label{font-weight:600;color:#64748b;font-size:14px;}
        .info-value{color:#1e293b;font-weight:500;font-size:14px;}
        .area-value{color:#1e88e5;font-weight:700;}
        .checklist-type-selector{display:flex;align-items:center;gap:8px;}
        .type-dropdown{padding:7px 32px 7px 12px;border:2px solid #1e88e5;border-radius:8px;font-size:13px;font-weight:600;color:#1565c0;background:#eff6ff;cursor:pointer;outline:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231e88e5' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;transition:all 0.2s;}
        .checklist-type-static{display:flex;align-items:center;gap:8px;}
        .dropdown-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.05em;}
        .dropdown-badge.gl{background:#f3e5f5;color:#7b1fa2;}
        .dropdown-badge.ins{background:#e0f2fe;color:#0277bd;}
        .loading-items{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;background:white;border-radius:12px;margin-bottom:20px;}
        .loading-spinner{width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#1e88e5;border-radius:50%;animation:spin 0.8s linear infinite;}
        .loading-items p{color:#64748b;font-size:14px;margin:0;}
        .progress-card{background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
        .progress-text{font-weight:600;color:#1e293b;font-size:14px;}
        .progress-percent{font-weight:700;color:#1e88e5;font-size:16px;}
        .progress-bar{width:100%;height:10px;background:#e2e8f0;border-radius:10px;overflow:hidden;}
        .progress-fill{height:100%;background:linear-gradient(90deg,#1e88e5,#42a5f5);border-radius:10px;transition:width 0.3s ease;}
        .success-banner{background:#f0fdf4;border:1px solid #86efac;border-left:4px solid #22c55e;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;color:#166534;font-size:14px;font-weight:500;animation:slideIn 0.3s ease;}
        .error-banner{background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;}
        .error-icon{font-size:20px;}.error-text{flex:1;color:#dc2626;font-size:14px;}
        .error-retry{background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;}
        .info-box-partial{background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;}
        .info-text{color:#1e40af;font-size:13px;line-height:1.4;}
        .checklist-container{display:flex;flex-direction:column;gap:12px;margin-bottom:100px;}
        .empty-state{text-align:center;padding:40px 20px;background:white;border-radius:12px;border:2px dashed #cbd5e1;}
        .empty-icon{font-size:48px;margin-bottom:12px;}.empty-title{font-weight:600;color:#1e293b;margin:0 0 8px;}.empty-desc{color:#64748b;font-size:14px;margin:0;}
        .checklist-item-card{background:white;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid transparent;transition:all 0.2s;}
        .checklist-item-card:hover{border-color:#1e88e5;}.checklist-item-card.expanded{border-color:#1e88e5;}.checklist-item-card.filled{border-left:4px solid #22c55e;}
        .item-header{display:flex;align-items:flex-start;gap:12px;cursor:pointer;}
        .item-number{font-weight:700;color:#1e88e5;font-size:16px;min-width:28px;}
        .item-content{flex:1;}.item-title{margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;line-height:1.4;}.item-standard{margin:0;font-size:12px;color:#64748b;}
        .status-indicator{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;}
        .status-indicator.filled{background:#22c55e;color:white;}.status-indicator.empty{background:#e2e8f0;color:#94a3b8;border:2px solid #cbd5e1;}
        .expand-button{background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;padding:4px;}
        .item-details{margin-top:18px;padding-top:18px;border-top:1px solid #e2e8f0;animation:slideIn 0.2s ease;}
        .status-options{display:flex;gap:12px;margin-bottom:18px;}
        .status-option{flex:1;display:flex;align-items:center;gap:10px;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;transition:all 0.2s;user-select:none;}
        .status-option.selected.ok{border-color:#10b981;background:#f0fdf4;}.status-option.selected.ng{border-color:#ef4444;background:#fef2f2;}
        .option-circle{width:20px;height:20px;border:2px solid #cbd5e1;border-radius:50%;transition:all 0.2s;flex-shrink:0;}
        .status-option.selected.ok .option-circle{background:#10b981;border-color:#10b981;}.status-option.selected.ng .option-circle{background:#ef4444;border-color:#ef4444;}
        .option-label{font-weight:600;color:#1e293b;}.status-option.selected.ok .option-label{color:#10b981;}.status-option.selected.ng .option-label{color:#ef4444;}
        .form-group{margin-bottom:14px;}.form-label{display:block;font-weight:600;color:#1e293b;margin-bottom:8px;font-size:14px;}
        .required{color:#ef4444;margin-left:2px;}.optional{color:#94a3b8;font-weight:400;margin-left:4px;font-size:12px;}
        .form-textarea{width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:14px;resize:vertical;transition:all 0.2s;background:white;box-sizing:border-box;}
        .form-textarea:focus{outline:none;border-color:#1e88e5;}.form-textarea:disabled{background:#f8fafc;cursor:not-allowed;}
        .submit-section{position:fixed;bottom:0;left:80px;right:0;background:white;padding:14px 24px;box-shadow:0 -4px 12px rgba(0,0,0,0.1);z-index:100;}
        .submit-button{width:100%;max-width:800px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px 32px;background:linear-gradient(135deg,#1e88e5,#1565c0);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 12px rgba(30,136,229,0.3);}
        .submit-button:hover:not(:disabled){transform:translateY(-2px);}.submit-button:disabled{opacity:0.6;cursor:not-allowed;}
        .submit-hint{text-align:center;font-size:12px;color:#64748b;margin:8px 0 0;}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;}
        .carline-card{background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid #f59e0b;}
        .carline-card-header{display:flex;align-items:center;gap:8px;margin-bottom:14px;}.carline-icon{font-size:18px;}.carline-title{margin:0;font-size:15px;font-weight:700;color:#1e293b;}
        .carline-row{margin-bottom:14px;}.carline-label{display:block;font-size:13px;font-weight:600;color:#64748b;margin-bottom:6px;}
        .carline-select{width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;font-weight:600;color:#1e293b;background:#f8fafc;cursor:pointer;outline:none;transition:all 0.2s;}
        .carline-select:focus{border-color:#f59e0b;}
        .carline-add-section{background:#fffbeb;border:1px dashed #fcd34d;border-radius:10px;padding:12px 14px;}
        .carline-add-label{margin:0 0 10px;font-size:13px;color:#92400e;font-weight:600;}
        .carline-inputs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .carline-input{flex:1;min-width:100px;padding:9px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;color:#1e293b;background:white;outline:none;text-transform:uppercase;transition:all 0.2s;}
        .carline-input:focus{border-color:#f59e0b;}.carline-dash{font-weight:700;color:#64748b;font-size:16px;}
        .carline-add-btn{padding:9px 16px;background:#f59e0b;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.2s;}
        .carline-add-btn:hover:not(:disabled){background:#d97706;}.carline-add-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .carline-error{margin:8px 0 0;font-size:12px;color:#dc2626;font-weight:500;}
        .date-input:focus{outline:none;border-color:#1565c0 !important;}
        @keyframes slideIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes dciToastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes dciToastOut{from{opacity:1;}to{opacity:0;}}
        @keyframes dciScanline{0%,100%{transform:translateY(-38px);opacity:0;}10%{opacity:1;}90%{opacity:1;}50%{transform:translateY(38px);}}
        @media(max-width:768px){.main-content{margin-left:0;padding:12px;}.submit-section{left:0;padding:10px 16px;}.carline-inputs{flex-direction:column;align-items:stretch;}.carline-dash{text-align:center;}.back-button{left:8px;}}
        .dci-scan-wrapper{position:relative;min-height:300px;}
        .scanner-active-badge{display:inline-block;background:#22c55e;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.05em;animation:scannerPulse 2s ease-in-out infinite;}
        @keyframes scannerPulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
        .dci-save-toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:9px 22px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:0.06em;white-space:nowrap;z-index:9000;pointer-events:none;animation:dciToastIn 0.2s ease,dciToastOut 0.2s ease 1.2s forwards;box-shadow:0 4px 16px rgba(16,185,129,0.4);}
        .dci-standby{display:flex;flex-direction:column;gap:16px;}
        .dci-standby-scan-zone{background:white;border-radius:16px;padding:32px 20px;display:flex;flex-direction:column;align-items:center;gap:20px;border:2px dashed #c4b5fd;box-shadow:0 2px 8px rgba(124,58,237,0.06);}
        .dci-reticle{width:140px;height:96px;position:relative;}
        .dci-reticle-corner{position:absolute;width:18px;height:18px;border-color:#7c3aed;border-style:solid;}
        .dci-tl{top:0;left:0;border-width:3px 0 0 3px;border-radius:3px 0 0 0;}.dci-tr{top:0;right:0;border-width:3px 3px 0 0;border-radius:0 3px 0 0;}
        .dci-bl{bottom:0;left:0;border-width:0 0 3px 3px;border-radius:0 0 0 3px;}.dci-br{bottom:0;right:0;border-width:0 3px 3px 0;border-radius:0 0 3px 0;}
        .dci-scan-line{position:absolute;left:8px;right:8px;height:2px;background:linear-gradient(90deg,transparent,#7c3aed,transparent);top:50%;animation:dciScanline 2s ease-in-out infinite;}
        .dci-standby-hint{font-size:13px;color:#64748b;text-align:center;margin:0;line-height:1.5;max-width:260px;}
        .dci-done-list{background:white;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);}
        .dci-done-list-title{font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;}
        .dci-done-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f1f5f9;}
        .dci-done-row:last-child{border-bottom:none;}.dci-done-row:hover{background:#f8fafc;}
        .dci-done-no{font-size:11px;font-weight:700;color:#94a3b8;min-width:28px;}.dci-done-name{flex:1;font-size:13px;font-weight:600;color:#1e293b;}
        .dci-done-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;}
        .dci-done-badge--ok{background:#dcfce7;color:#16a34a;}.dci-done-badge--ng{background:#fee2e2;color:#dc2626;}
        .dci-scan-card{background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.12);border:2px solid #e2e8f0;overflow:hidden;transform:translateY(24px);opacity:0;transition:transform 0.28s cubic-bezier(0.34,1.3,0.64,1),opacity 0.2s ease;}
        .dci-scan-card--visible{transform:translateY(0);opacity:1;}
        .dci-scan-card-topbar{background:#f8fafc;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0;}
        .dci-scan-back-btn{background:#e2e8f0;border:none;border-radius:8px;color:#475569;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;}
        .dci-scan-back-btn:hover{background:#cbd5e1;}
        .dci-scan-card-meta{flex:1;overflow:hidden;}.dci-scan-card-id{display:block;font-size:10px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;}
        .dci-scan-card-name{display:block;font-size:15px;font-weight:700;color:#1e293b;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dci-badge{min-width:38px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;letter-spacing:0.05em;flex-shrink:0;}
        .dci-badge--empty{background:#f1f5f9;color:#94a3b8;border:1.5px solid #e2e8f0;}.dci-badge--ok{background:#dcfce7;color:#16a34a;border:1.5px solid #86efac;}.dci-badge--ng{background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;}
        .dci-scan-status-banner{padding:10px 16px;font-size:12px;font-weight:700;letter-spacing:0.04em;animation:slideIn 0.2s ease;}
        .dci-scan-status-banner--ok{background:#f0fdf4;color:#15803d;border-bottom:1px solid #bbf7d0;}.dci-scan-status-banner--ng{background:#fef2f2;color:#b91c1c;border-bottom:1px solid #fecaca;}
        .dci-checkpoint-toggle{width:calc(100% - 32px);display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:12.5px;color:#475569;font-weight:600;margin:12px 16px 0;transition:all 0.15s;text-align:left;}
        .dci-checkpoint-toggle:hover{background:#f1f5f9;border-color:#c4b5fd;color:#5b21b6;}
        .dci-cp-icon{font-size:14px;}.dci-cp-arrow{margin-left:auto;font-size:11px;color:#94a3b8;}
        .dci-checkpoint-list{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin:10px 16px 4px;animation:slideIn 0.2s ease;}
        .dci-cp-title{margin:0 0 8px;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;}
        .dci-cp-item{display:flex;align-items:flex-start;gap:8px;padding:4px 0;}.dci-cp-bullet{color:#22c55e;font-weight:700;font-size:13px;flex-shrink:0;margin-top:1px;}.dci-cp-text{font-size:13px;color:#166534;line-height:1.4;}
        .dci-scan-status-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px;}
        .dci-scan-status-btn{border:2.5px solid;border-radius:14px;padding:20px 12px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;transition:all 0.15s;background:white;}
        .dci-scan-status-btn--ok{border-color:#e2e8f0;color:#16a34a;}.dci-scan-status-btn--ng{border-color:#e2e8f0;color:#dc2626;}
        .dci-scan-status-btn--ok:hover:not(.dci-scan-status-btn--active){border-color:#86efac;background:#f0fdf4;}
        .dci-scan-status-btn--ng:hover:not(.dci-scan-status-btn--active){border-color:#fca5a5;background:#fef2f2;}
        .dci-scan-status-btn--ok.dci-scan-status-btn--active{background:#22c55e;border-color:#22c55e;color:white;box-shadow:0 4px 14px rgba(34,197,94,0.35);}
        .dci-scan-status-btn--ng.dci-scan-status-btn--active{background:#ef4444;border-color:#ef4444;color:white;box-shadow:0 4px 14px rgba(239,68,68,0.35);}
        .dci-scan-btn-icon{font-size:24px;font-weight:700;line-height:1;}.dci-scan-btn-label{font-size:15px;font-weight:800;letter-spacing:0.06em;}
        .dci-ng-panel{margin:0 16px 16px;background:#fff7ed;border:2px solid #fed7aa;border-radius:10px;padding:14px;animation:slideIn 0.2s ease;}
        .dci-ng-panel--warn{border-color:#f59e0b;background:#fffbeb;}
        .dci-ng-panel-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;}.dci-ng-panel-icon{font-size:16px;}.dci-ng-panel-title{font-size:13px;font-weight:700;color:#92400e;flex:1;}
        .dci-ng-required-badge{background:#ef4444;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
        .dci-ng-choices-list{display:flex;flex-direction:column;gap:7px;}
        .dci-ng-choice-btn{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;background:white;border:2px solid #e2e8f0;border-radius:9px;cursor:pointer;text-align:left;transition:all 0.15s;}
        .dci-ng-choice-btn:hover{border-color:#fca5a5;background:#fff5f5;}.dci-ng-choice-btn--active{border-color:#ef4444;background:#fef2f2;}
        .dci-ng-check-box{min-width:20px;height:20px;border:2px solid #e2e8f0;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;background:#f1f5f9;transition:all 0.15s;margin-top:1px;}
        .dci-ng-choice-btn--active .dci-ng-check-box{background:#ef4444;border-color:#ef4444;}
        .dci-ng-choice-text{font-size:13px;color:#1e293b;line-height:1.4;font-weight:500;}.dci-ng-choice-btn--active .dci-ng-choice-text{color:#991b1b;font-weight:600;}
        .dci-ng-empty-warn{margin-top:10px;padding:8px 12px;background:#fef3c7;border-radius:7px;font-size:12px;color:#92400e;font-weight:600;text-align:center;}
        .dci-ng-other-section{margin-top:12px;padding-top:12px;border-top:1px dashed #fed7aa;}
        .dci-ng-other-label{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#92400e;margin-bottom:7px;}
        .dci-ng-other-icon{font-size:14px;}.dci-ng-other-hint{font-weight:400;color:#a16207;font-size:11px;margin-left:2px;}
        .dci-ng-other-input{width:100%;padding:9px 12px;border:2px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;transition:all 0.15s;background:white;box-sizing:border-box;color:#1e293b;line-height:1.5;}
        .dci-ng-other-input:focus{outline:none;border-color:#f59e0b;}.dci-ng-other-input::placeholder{color:#94a3b8;font-size:12px;}
        .dci-ng-photo-section{margin-top:14px;padding-top:13px;border-top:1px dashed #fed7aa;}
        .dci-ng-photo-header{display:flex;align-items:center;gap:6px;margin-bottom:10px;}.dci-ng-photo-icon{font-size:16px;}.dci-ng-photo-label{font-size:13px;font-weight:700;color:#92400e;}.dci-ng-photo-hint{font-size:11px;color:#a16207;margin-left:2px;}
        .dci-photo-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
        .dci-photo-thumb-wrap{position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid #e2e8f0;cursor:pointer;flex-shrink:0;}
        .dci-photo-thumb-wrap:hover .dci-photo-zoom-hint{opacity:1;}.dci-photo-thumb{width:100%;height:100%;object-fit:cover;display:block;}
        .dci-photo-zoom-hint{position:absolute;inset:0;background:rgba(0,0,0,0.4);color:white;display:flex;align-items:center;justify-content:center;font-size:20px;opacity:0;transition:opacity 0.15s;pointer-events:none;}
        .dci-photo-remove-btn{position:absolute;top:3px;right:3px;width:20px;height:20px;background:rgba(239,68,68,0.9);color:white;border:none;border-radius:50%;cursor:pointer;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:2;}
        .dci-photo-add-btn{display:flex;align-items:center;gap:8px;padding:9px 16px;background:white;border:2px dashed #f59e0b;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;color:#92400e;transition:all 0.15s;width:100%;box-sizing:border-box;}
        .dci-photo-add-btn:hover{background:#fffbeb;border-color:#d97706;}.dci-photo-add-icon{font-size:18px;}
        .dci-scan-ng-save-btn{width:100%;background:#ef4444;color:white;border:none;border-radius:10px;padding:13px;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer;margin-top:10px;transition:all 0.15s;}
        .dci-scan-ng-save-btn:disabled{background:#cbd5e1;color:#94a3b8;cursor:not-allowed;}
        .dci-scan-next-btn{display:flex;align-items:center;gap:8px;margin:0 16px 16px;padding:13px 16px;background:#ede9fe;border:1.5px solid #c4b5fd;border-radius:12px;font-size:13px;font-weight:700;color:#5b21b6;cursor:pointer;letter-spacing:0.04em;transition:all 0.15s;width:calc(100% - 32px);animation:slideIn 0.25s ease;}
        .dci-scan-next-btn:hover{background:#ddd6fe;border-color:#a78bfa;}
        .photo-zoom-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.15s ease;}
        .photo-zoom-container{position:relative;max-width:95vw;max-height:90vh;}
        .photo-zoom-img{max-width:100%;max-height:90vh;border-radius:10px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,0.5);display:block;}
        .photo-zoom-close{position:absolute;top:-14px;right:-14px;width:32px;height:32px;background:#ef4444;color:white;border:3px solid white;border-radius:50%;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .shift-dropdown{padding:7px 32px 7px 12px;border:2px solid #1e88e5;border-radius:8px;font-size:13px;font-weight:600;color:#1565c0;background:#eff6ff;cursor:pointer;outline:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231e88e5' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;transition:all 0.2s;}
        .shift-dropdown:hover{border-color:#1565c0;background:#dbeafe;}
        .specific-area-dropdown{padding:7px 32px 7px 12px;border:2px solid #7c3aed;border-radius:8px;font-size:13px;font-weight:600;color:#5b21b6;background:#f5f3ff;cursor:pointer;outline:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237c3aed' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;transition:all 0.2s;}
        .specific-area-dropdown:hover{border-color:#5b21b6;background:#ede9fe;}
        .specific-area-badge{display:inline-block;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #c4b5fd;white-space:nowrap;}
        .loading-page{display:flex;align-items:center;justify-content:center;min-height:100vh;font-size:16px;color:#64748b;}
      `}</style>
    </>
  );
}