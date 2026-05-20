// app/checksheet-final-assy/page.tsx

"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import NGPhotoUpload from "@/components/NGPhotoUpload";
import { getActiveNgChoices, getActiveCheckpoints, getWeeklyScheduleDesc, isWeeklyScheduleActive } from "@/lib/fa-dci-schedule";
import { saveChecklistOffline } from "@/lib/offline/saveOffline";
import { db } from "@/lib/offline/db";
import { saveCache, getCache } from "@/lib/offline/cache";
import { loadPhysicalBinding } from "@/lib/device/binding-storage";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  scheduleType?: "daily" | "weekly";
  weeklyCheckpointIndex?: number;
}

interface FADciResult {
  itemId: number;
  status: "OK" | "NG" | null;
  selectedNgChoices: string[];
  ngOtherNote: string;
  ngPhotos: string[];
}

type ChecklistType = "inspector" | "group-leader";

const CHECKLIST_TYPE_LABELS: Record<ChecklistType, string> = {
  "inspector":    "Daily Check Inspector Final Assy",
  "group-leader": "Daily Check Group Leader Final Assy",
};

const CATEGORY_TO_TYPE: Record<string, ChecklistType> = {
  "final-assy-inspector": "inspector",
  "final-assy-gl":        "group-leader",
};

const getLocalDateKey = (d: Date): string => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ─── Static DCI items ─────────────────────────────────────────────────────────
const FA_DCI_ITEMS: FADciItem[] = [
  { id: 1,  itemCheck: "PIPO",                         checkpoints: ["Ada nomor register","PIPO dalam kondisi baik dan tidak rusak"],                                                                                                                                                                                                                     ngChoices: ["TIDAK ADA NOMOR REGISTER","PIPO TIDAK DALAM KONDISI BAIK / RUSAK"] },
  { id: 2,  itemCheck: "ROLL METER / MISTAR BAJA",     checkpoints: ["Ada nomor register + kalibrasi tidak expired","Garis angka terbaca dengan jelas / tidak berkarat","Roll meter / mistar baja dalam kondisi baik dan tidak rusak"],                                                                                                                    ngChoices: ["TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED","GARIS ANGKA TIDAK TERBACA DENGAN JELAS / BERKARAT","ROLL METER / MISTAR BAJA TIDAK DALAM KONDISI BAIK / RUSAK"] },
  { id: 3,  weeklyCheckpointIndex: 5, itemCheck: "GO NO GO", checkpoints: ["Ada nomor register + verifikasi tidak expired","Tidak ada skrup yang kendor / hilang","Kondisi GO NO GO dalam keadaan baik & bagian belakang (wire) dilindungi tape / spiral","Ada stiker warna hijau pada GO NO GO terminal (M terminal) dan tidak lepas","Kondisi GO NO GO terminal dalam keadaan OK (tidak aus, tidak bent, tidak patah, tidak deformasi)","Bisa mendeteksi kondisi OK dan N-OK melalui sample OK dan N-OK"], ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED","ADA SKRUP YANG KENDOR / HILANG","KONDISI GO NO GO TIDAK BAIK / BAGIAN BELAKANG (WIRE) TIDAK DILINDUNGI TAPE / SPIRAL","TIDAK ADA STIKER WARNA HIJAU PADA GO NO GO TERMINAL (M TERMINAL) / LEPAS","KONDISI GO NO GO TERMINAL TIDAK OK (AUS / BENT / PATAH / DEFORMASI)","TIDAK BISA MENDETEKSI KONDISI OK DAN N-OK"] },
  { id: 4,  itemCheck: "PUSH GAUGE RB",                checkpoints: ["Ada nomor register + verifikasi tidak expired","Tidak ada skrup yang kendor / hilang","Ada bantalan karet (cushion) pada ujungnya","Lampu indikator menyala"],                                                                                                                       ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED","ADA SKRUP YANG KENDOR / HILANG","TIDAK ADA BANTALAN KARET (CUSHION) PADA UJUNGNYA","LAMPU INDIKATOR TIDAK MENYALA"] },
  { id: 5,  itemCheck: "DUMMY SAMPLE OK & N-OK",       checkpoints: ["Ada nomor register + verifikasi tidak expired","Sample dalam kondisi baik dan tidak rusak"],                                                                                                                                                                                         ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED","SAMPLE TIDAK DALAM KONDISI BAIK / RUSAK"] },
  { id: 6,  itemCheck: "IMPORTANT / INSPECTION POINT", checkpoints: ["Important / Inspection Point terbaca dengan jelas dan tidak rusak","Isi Important / Inspection Point sesuai dengan level terbaru"],                                                                                                                                                  ngChoices: ["IMPORTANT / INSPECTION POINT TIDAK TERBACA DENGAN JELAS / RUSAK","ISI IMPORTANT / INSPECTION POINT TIDAK SESUAI DENGAN LEVEL TERBARU"] },
  { id: 7,  itemCheck: "FUSE PLATE",                   checkpoints: ["Ada nomor register + verifikasi tidak expired","Warna dan angka ada dan terbaca dengan jelas","Fuse plate dalam kondisi baik dan tidak rusak","Fuse insertion / penekan fuse dalam kondisi OK"],                                                                                    ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED","WARNA DAN ANGKA TIDAK ADA / TIDAK TERBACA DENGAN JELAS","FUSE PLATE TIDAK DALAM KONDISI BAIK / RUSAK","FUSE INSERTION / PENEKAN FUSE TIDAK DALAM KONDISI OK"] },
  { id: 8,  itemCheck: "LAMPU NAVIGASI",               checkpoints: ["Lampu LED kondisi menyala","Cover LED tidak hilang atau pecah","Lampu LED terpasang sempurna / tidak lepas"],                                                                                                                                                                       ngChoices: ["LAMPU LED TIDAK MENYALA / MATI","COVER LED HILANG ATAU PECAH","LAMPU LED TIDAK TERPASANG SEMPURNA / LEPAS"] },
  { id: 9,  itemCheck: "TAPE NAVIGASI",                checkpoints: ["Lampu LED kondisi menyala","Kondisi switch tidak rusak","Ada identitas tape"],                                                                                                                                                                                                      ngChoices: ["LAMPU LED TIDAK MENYALA / MATI","KONDISI SWITCH RUSAK","TIDAK ADA IDENTITAS TAPE"] },
  { id: 10, itemCheck: "INSPECTION BOARD",             checkpoints: ["Tidak ada skrup & baut yang menonjol dan tajam","Approval sheet sesuai level terakhir","Approval sheet ditanda tangani QA","Kondisi sample dan plastik tidak rusak"],                                                                                                                ngChoices: ["ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM","APPROVAL SHEET TIDAK SESUAI LEVEL TERAKHIR","APPROVAL SHEET TIDAK DITANDA TANGANI QA","KONDISI SAMPLE DAN PLASTIK RUSAK"] },
  { id: 11, itemCheck: "DRY SURF",                     checkpoints: ["Botol tidak bocor / rusak & ada sticker B3","Spons / kuas tidak rusak / aus","Ada tanda MAX & MIN pada botol dan isi cairan sesuai rentang MAX dan MIN"],                                                                                                                            ngChoices: ["BOTOL BOCOR / RUSAK / TIDAK ADA STICKER B3","SPONS / KUAS RUSAK / AUS","TIDAK ADA TANDA MAX & MIN PADA BOTOL / ISI CAIRAN TIDAK SESUAI RENTANG MAX DAN MIN"] },
  { id: 12, itemCheck: "PACKING",                      checkpoints: ["Kondisi tutup polytainer tidak rusak dan jumlahnya sudah sesuai","HT scan bisa berfungsi dengan baik","Majun dan sikat polytainer ada pada tempatnya"],                                                                                                                             ngChoices: ["KONDISI TUTUP POLYTAINER RUSAK / JUMLAH TIDAK SESUAI","HT SCAN TIDAK BISA BERFUNGSI DENGAN BAIK","MAJUN DAN SIKAT POLYTAINER TIDAK ADA / JUMLAH TIDAK SESUAI"] },
];

const FA_SPECIFIC_AREA_ITEMS: Record<string, number[]> = {
  "WP CHECK":          [1, 3, 5, 6],
  "CHECKER":           [1, 3, 5, 6, 7, 9, 10],
  "VISUAL 1":          [1, 2, 3, 5, 6, 8, 9, 10],
  "VISUAL 2":          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "DOUBLE CHECK (RI)": [1, 3, 4, 5, 6, 10, 12],
};

// ─── [OFFLINE-1] resolveAreaCode — cache-first, tidak pernah block UI ─────────
// Offline: hanya baca cache, tidak fetch.
// Online: fetch → simpan ke cache.
// Tidak pernah throw — kembalikan null jika gagal.
async function resolveAreaCode(areaName: string, categoryCode = "final-assy-inspector"): Promise<string | null> {
  const norm   = areaName.trim().toLowerCase();
  const findIn = (list: any[]): string | null =>
    list.find((a: any) => a.area_name?.trim().toLowerCase() === norm)?.area_code ?? null;

  // Offline: langsung dari cache, skip fetch sama sekali
  if (!navigator.onLine) {
    try {
      const cached = await getCache("areas:list");
      if (cached && Array.isArray(cached)) return findIn(cached);
    } catch {}
    return null;
  }

  // Online: fetch → simpan ke cache
  try {
    const url = categoryCode
      ? `/api/admin/areas?categoryCode=${encodeURIComponent(categoryCode)}`
      : `/api/admin/areas`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return null;
    try { await saveCache("areas:list", data.data); } catch {}
    return findIn(data.data);
  } catch {
    // Fetch gagal (misal: server error) → coba cache sebagai fallback
    try {
      const cached = await getCache("areas:list");
      if (cached && Array.isArray(cached)) return findIn(cached);
    } catch {}
    return null;
  }
}

// ─── safeFetch: skip fetch saat offline ──────────────────────────────────────
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  if (!navigator.onLine) {
    console.log("[safeFetch] SKIP — offline:", url);
    throw new Error("OFFLINE_MODE");
  }
  return fetch(url, options);
}

// ─── Helper: update cache GET lokal setelah save ──────────────────────────────
async function updateLocalCache(params: {
  checklistType: "inspector" | "group-leader";
  effectiveAreaCode: string;
  shift: "A" | "B";
  selectedDate: Date;
  selectedSpecificArea: string;
  conveyor: string;
  itemId: number;
  status: "OK" | "NG";
  ngDescription: string | null;
  ngPhotos: string[] | null;
}): Promise<void> {
  try {
    const dateKey     = getLocalDateKey(params.selectedDate);
    const locationKey = params.conveyor?.trim().toUpperCase() || "default";
    const safeSpecificArea = (typeof params.selectedSpecificArea === "string" && params.selectedSpecificArea.trim())
      ? params.selectedSpecificArea.trim() : "";

    const cacheKey = `checklist-results-${params.effectiveAreaCode}-${params.shift}-${dateKey}-${safeSpecificArea || "all"}-${locationKey}`;

    const existing = await getCache(cacheKey);
    const base =
      existing && existing.success && existing.formatted
        ? { ...existing, formatted: { ...existing.formatted } }
        : { success: true, formatted: {} };

    if (!base.formatted[dateKey]) base.formatted[dateKey] = {};

    const normalizedSpecArea = safeSpecificArea || "WP CHECK";
    let entryKey: string;
    if (params.checklistType === "inspector") {
      entryKey = `${params.itemId}-${normalizedSpecArea}-${params.shift}`;
    } else {
      entryKey = `${params.itemId}-${params.shift}`;
    }

    const ngPhotosStr = Array.isArray(params.ngPhotos) && params.ngPhotos.length > 0
      ? JSON.stringify(params.ngPhotos) : null;

    base.formatted[dateKey][entryKey] = {
      status:        params.status,
      ngDescription: params.ngDescription || "",
      ngPhotos:      ngPhotosStr,
      ngDepartment:  params.status === "NG" ? "QA" : null,
    };

    await saveCache(cacheKey, base);
    console.log(`[updateLocalCache] written key=${entryKey} cacheKey=${cacheKey}`);
  } catch (err) {
    console.log("[updateLocalCache] Error (non-fatal):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ChecksheetFinalAssyPage() {
  const { user, loading: authLoading, isInitialized } = useAuth();
  const userId       = user?.id       ?? null;
  const userRole     = user?.role     ?? null;
  const userFullName = user?.fullName ?? null;
  const userUsername = user?.username ?? null;

  const isGroupLeader = userRole === "group-leader-qa";

  // ── Core state ────────────────────────────────────────────────────────────
  const [areaCode, setAreaCode]   = useState("");
  const [areaName, setAreaName]   = useState("");
  const [shift, setShift]         = useState<"A" | "B">("A");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate]                   = useState(new Date());

  const [checklistType, setChecklistType]           = useState<ChecklistType>("inspector");
  const [categoryCodeResolved, setCategoryCodeResolved] = useState(false);
  const [categoryCodeMissing, setCategoryCodeMissing]   = useState(false);

  const isDailyInspector = checklistType === "inspector";

  const [selectedSpecificArea, setSelectedSpecificArea] = useState("");
  const [conveyor, setConveyor]   = useState("");
  const [pattern, setPattern]     = useState("");
  const [qrScanned, setQrScanned] = useState(false);

  // ── localStorage session persistence ─────────────────────────────────────
  const SESSION_KEY = "checksheet_fa_session";

  const saveSession = useCallback((patch: Record<string, any>) => {
    try {
      const prev = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...prev, ...patch, _savedAt: Date.now() }));
    } catch {}
  }, []);

  // Rehydrate dari localStorage saat mount (survive refresh offline)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const age   = Date.now() - (saved._savedAt || 0);
      if (age > 12 * 60 * 60 * 1000) { localStorage.removeItem(SESSION_KEY); return; }

      if (!areaCode && saved.areaCode)             setAreaCode(saved.areaCode);
      if (!areaName && saved.areaName)             setAreaName(saved.areaName);
      if (!conveyor && saved.conveyor)             setConveyor(saved.conveyor);
      if (!selectedSpecificArea && saved.selectedSpecificArea) setSelectedSpecificArea(saved.selectedSpecificArea);
      if (saved.shift === "A" || saved.shift === "B") setShift(saved.shift);
      if (saved.areaCode && (saved.conveyor || !saved.isDailyInspector)) {
        setQrScanned(true);
        console.log("[session] rehydrated:", saved);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [urlCategoryCode, setUrlCategoryCode]     = useState<string>("");
  const [isResolvingArea, setIsResolvingArea]     = useState(false);
  const [resolveError, setResolveError]           = useState<string | null>(null);

  const effectiveAreaCode = useMemo(() => {
    if (!areaCode) return areaCode;
    if (checklistType === "group-leader" && areaCode.startsWith("final-assy-insp-"))
      return areaCode.replace("final-assy-insp-", "final-assy-gl-");
    if (checklistType === "inspector" && areaCode.startsWith("final-assy-gl-"))
      return areaCode.replace("final-assy-gl-", "final-assy-insp-");
    return areaCode;
  }, [areaCode, checklistType]);

  // ── Checklist state ───────────────────────────────────────────────────────
  const [checklistItems, setChecklistItems]   = useState<ChecklistItem[]>([]);
  const [results, setResults]                 = useState<Record<number, ChecklistResult>>({});
  const [expandedItem, setExpandedItem]       = useState<number | null>(null);
  const [faResults, setFaResults]             = useState<Record<number, FADciResult>>({});
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Record<number, boolean>>({});
  const [dciScannedItemId, setDciScannedItemId] = useState<number | null>(null);
  const [dciCardVisible, setDciCardVisible]   = useState(false);
  const [dciSaveToast, setDciSaveToast]       = useState(false);
  const [dciScanSuccessToast, setDciScanSuccessToast] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);

  const scanInputRef         = useRef<HTMLInputElement>(null);
  const scanFocusInterval    = useRef<number | null>(null);
  const dciSaveToastTimer    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const dciScanSuccessToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dciCloseCardTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef      = useRef(false);
  const isLoadingRef         = useRef(false);
  const latestKeyRef         = useRef("");
  const latestRequestRef     = useRef(0);
  const checklistItemsRef    = useRef<ChecklistItem[]>([]);
  const isDataReadyRef       = useRef(false);
  const loadSavedResultsFnRef = useRef<((locationKey: string) => Promise<void>) | null>(null);

  const [isLoading, setIsLoading]       = useState(false);
  const [isDataReady, setIsDataReady]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => { checklistItemsRef.current  = checklistItems; }, [checklistItems]);
  useEffect(() => { isDataReadyRef.current     = isDataReady; }, [isDataReady]);
  useEffect(() => {
    return () => {
      if (dciCloseCardTimer.current) clearTimeout(dciCloseCardTimer.current);
      if (dciScanSuccessToastTimer.current) clearTimeout(dciScanSuccessToastTimer.current);
      if (dciSaveToastTimer.current) clearTimeout(dciSaveToastTimer.current);
    };
  }, []);

  const [saveSuccess, setSaveSuccess]     = useState(false);
  const [photoZoomSrc, setPhotoZoomSrc]   = useState<string | null>(null);
  const [photoZoomLoading, setPhotoZoomLoading] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  useEffect(() => {
    if (!isDailyInspector || !selectedSpecificArea || !qrScanned) return;
    const stealFocusIfSafe = () => {
      if (dciScannedItemId !== null) return;
      const active = document.activeElement as HTMLElement | null;
      const isOtherFormField = active && active !== scanInputRef.current && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName.toUpperCase());
      if (isOtherFormField) return;
      if (scanInputRef.current) {
        scanInputRef.current.setAttribute("inputmode", "none");
        scanInputRef.current.focus({ preventScroll: true });
        console.log("[DCI SCANNER] focus granted", { selectedSpecificArea, qrScanned, dciScannedItemId, active: active?.tagName });
      }
    };

    stealFocusIfSafe();
    if (!scanFocusInterval.current) {
      scanFocusInterval.current = window.setInterval(stealFocusIfSafe, 300);
    }

    return () => {
      if (scanFocusInterval.current) {
        clearInterval(scanFocusInterval.current);
        scanFocusInterval.current = null;
      }
    };
  }, [isDailyInspector, qrScanned, selectedSpecificArea, dciScannedItemId]);

  const loadUnsyncedCount = useCallback(async () => {
    try {
      const all = await db.checklists.toArray();
      setUnsyncedCount(all.filter(i => i.synced === false).length);
    } catch { setUnsyncedCount(0); }
  }, []);

  interface DuplicateWarning { itemId: number; itemCheck: string; duplicateLocations: string[]; onConfirm: () => void; }
  const [duplicateWarning, setDuplicateWarning]       = useState<DuplicateWarning | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<number | null>(null);
  const [scannedGaugeIds, setScannedGaugeIds]         = useState<Record<number, string>>({});

  const hasLocation = isDailyInspector
    ? (!!conveyor && !!selectedSpecificArea && !!areaCode)
    : !!areaCode;

  useEffect(() => {
    loadUnsyncedCount();
    const h = () => loadUnsyncedCount();
    window.addEventListener("offlineSyncCompleted", h);
    return () => window.removeEventListener("offlineSyncCompleted", h);
  }, [loadUnsyncedCount]);

  // ── [OFFLINE-5] Offline mount fallback ────────────────────────────────────
  // Jika offline saat mount, langsung unlock UI tanpa menunggu fetch apapun.
  // Ini mencegah spinner infinite saat halaman di-refresh dalam kondisi offline.
  useEffect(() => {
    if (!navigator.onLine) {
      console.log("[OFFLINE] Offline detected on mount — unlocking UI immediately");
      setIsLoading(false);
      setIsDataReady(true);
      isDataReadyRef.current = true;
      isLoadingRef.current   = false;
    }
  }, []);

  // ── Save session saat state berubah ──────────────────────────────────────
  useEffect(() => {
    if (areaCode) {
      saveSession({ areaCode, areaName, conveyor, selectedSpecificArea, shift, isDailyInspector });
    }
  }, [areaCode, areaName, conveyor, selectedSpecificArea, shift, isDailyInspector, saveSession]);

  // ── 1. Auth check ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!userId) { window.location.href = "/login-page"; return; }
  }, [userId, authLoading, isInitialized]);

  // ── 2. Read URL params & tentukan checklistType ───────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const areaCodeParam     = params.get("areaCode");
    const areaNameParam     = params.get("areaName");
    const shiftParam        = params.get("shift");
    const specificAreaParam = params.get("specificArea");
    const conveyorParam     = params.get("conveyor");
    const patternParam      = params.get("pattern");
    const fromQR            = params.get("fromQR") === "1";
    const categoryCodeParam = params.get("categoryCode") ?? "";

    setUrlCategoryCode(categoryCodeParam);

    if (categoryCodeParam && CATEGORY_TO_TYPE[categoryCodeParam]) {
      setChecklistType(CATEGORY_TO_TYPE[categoryCodeParam]);
      setCategoryCodeResolved(true);
    } else if (!categoryCodeParam) {
      setCategoryCodeMissing(true);
      return;
    } else {
      setCategoryCodeMissing(true);
      return;
    }

    if (shiftParam === "A" || shiftParam === "B") setShift(shiftParam as "A" | "B");
    if (patternParam) setPattern(decodeURIComponent(patternParam));

    if (areaCodeParam && !fromQR) {
      setAreaCode(areaCodeParam);
      if (areaNameParam) setAreaName(decodeURIComponent(areaNameParam));
      if (specificAreaParam && conveyorParam) {
        // [FIX] trim + uppercase + mapping ke key asli FA_SPECIFIC_AREA_ITEMS
        const specU  = decodeURIComponent(specificAreaParam).trim().toUpperCase();
        const convU  = decodeURIComponent(conveyorParam).trim().toUpperCase();
        const matchedKey = Object.keys(FA_SPECIFIC_AREA_ITEMS).find(o => o.toUpperCase() === specU);
        // [FIX] fallback ke "WP CHECK" jika tidak ditemukan
        const valid  = matchedKey ?? "WP CHECK";
        console.log("[URL PARSE] specificArea:", { raw: specificAreaParam, specU, matchedKey, valid });
        setSelectedSpecificArea(valid);
        setConveyor(convU);
        setQrScanned(true);
      }
      return;
    }

    if (fromQR && areaNameParam) {
      const decodedAreaName = decodeURIComponent(areaNameParam);
      setAreaName(decodedAreaName);

      if (specificAreaParam && conveyorParam) {
        // [FIX] trim + uppercase + mapping ke key asli FA_SPECIFIC_AREA_ITEMS
        const specU  = decodeURIComponent(specificAreaParam).trim().toUpperCase();
        const convU  = decodeURIComponent(conveyorParam).trim().toUpperCase();
        const matchedKey = Object.keys(FA_SPECIFIC_AREA_ITEMS).find(o => o.toUpperCase() === specU);
        // [FIX] fallback ke "WP CHECK" jika tidak ditemukan
        const valid  = matchedKey ?? "WP CHECK";
        console.log("[URL PARSE fromQR] specificArea:", { raw: specificAreaParam, specU, matchedKey, valid });
        setSelectedSpecificArea(valid);
        setConveyor(convU);
        setQrScanned(true);
      } else {
        if (categoryCodeParam !== "final-assy-inspector") {
          if (conveyorParam) setConveyor(decodeURIComponent(conveyorParam).toUpperCase());
          setQrScanned(true);
        }
      }

      if (areaCodeParam) {
        setAreaCode(areaCodeParam);
        return;
      }

      const catForResolve = categoryCodeParam || "final-assy-inspector";
      setIsResolvingArea(true);
      setResolveError(null);

      resolveAreaCode(decodedAreaName, catForResolve)
        .then(code => {
          if (code) { setAreaCode(code); return; }
          return resolveAreaCode(decodedAreaName, "").then(fb => {
            if (fb) { setAreaCode(fb); return; }
            // [OFFLINE-1] Offline + cache miss → jangan block, tampilkan warning ringan
            if (!navigator.onLine) {
              console.warn("[resolveArea] Offline + cache miss untuk area:", decodedAreaName);
              // Tidak set resolveError agar UI tidak ter-block
              // User masih bisa pakai halaman dengan data dari session/cache
            } else {
              setResolveError(`Area "${decodedAreaName}" tidak ditemukan di database.`);
            }
          });
        })
        .catch(() => {
          // Offline + network error → jangan tampilkan error yang memblokir
          if (!navigator.onLine) {
            console.warn("[resolveArea] Offline, fetch gagal — biarkan areaCode dari session");
          } else {
            setResolveError("Gagal menghubungi server untuk memverifikasi area.");
          }
        })
        .finally(() => setIsResolvingArea(false));
    }
  }, []);

  // ── 3. [OFFLINE-3] Load GL checklist items — cache-first ─────────────────
  useEffect(() => {
    if (!userId || authLoading || isDailyInspector) return;

    let isMounted = true;

    const load = async () => {
      if (!isMounted) return;

      const dateKey  = getLocalDateKey(selectedDate);
      // [OFFLINE-3] Gunakan areaCode dari state — bisa kosong saat offline,
      // key tetap dibuat agar cache tetap bisa di-lookup
      const cacheKey = `checklist-items-${effectiveAreaCode}-${shift}-${dateKey}`;
      console.log("[checklist-items] Cache key:", cacheKey);

      const ESO     = ["ESO", "selasa dan kamis", "Selasa dan Kamis", "Selasa & Kamis"];
      const applyFilter = (items: ChecklistItem[]) =>
        items.filter(item => {
          const shiftOk = item.shifts?.some((s: any) => s.shift === shift);
          const isESO   = ESO.some(kw => item.checkPoint?.toLowerCase().includes(kw.toLowerCase()));
          return shiftOk && !isESO;
        });

      // STEP 1: Cache-first — tampilkan segera tanpa menunggu network
      try {
        const cachedData = await getCache(cacheKey);
        if (cachedData?.success && Array.isArray(cachedData.data) && cachedData.data.length > 0) {
          if (isMounted) {
            setChecklistItems(applyFilter(cachedData.data));
            setIsLoading(false);
            setIsDataReady(true);
            isDataReadyRef.current = true;
            console.log("[checklist-items] ✓ Loaded from cache:", cachedData.data.length, "items");
          }
        }
      } catch (cacheErr) {
        console.log("[checklist-items] Cache read error:", cacheErr);
      }

      // STEP 2: Offline → stop di sini, jangan fetch
      if (!navigator.onLine) {
        if (isMounted) {
          setIsLoading(false);
          setIsDataReady(true);
          isDataReadyRef.current = true;
          isLoadingRef.current   = false;
        }
        return;
      }

      // STEP 3: Online → areaCode harus ada untuk fetch
      if (!effectiveAreaCode) {
        if (isMounted) { setIsLoading(false); setIsDataReady(true); isDataReadyRef.current = true; }
        return;
      }

      // STEP 4: Fetch API di background (tidak block UI — cache sudah ditampilkan)
      if (isMounted) { setIsLoading(true); setError(null); }

      try {
        const res = await safeFetch(
          `/api/final-assy/get-checklist-items?type=${checklistType}&areaCode=${effectiveAreaCode}`
        );
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          await saveCache(cacheKey, data);
          if (isMounted) {
            setExpandedItem(null);
            setChecklistItems(applyFilter(data.data));
            console.log("[checklist-items] ✓ Updated from API:", data.data.length, "items");
          }
        } else throw new Error(data.error || "No data");
      } catch (e) {
        // API gagal → cache sudah ditampilkan di STEP 1, ini non-fatal
        if (e instanceof Error && e.message !== "OFFLINE_MODE") {
          console.log("[checklist-items] API error (cache tetap tampil):", e.message);
          // Hanya tampilkan error jika cache juga kosong
          const cachedData = await getCache(cacheKey);
          if (!cachedData?.data?.length && isMounted) {
            setError("Tidak ada data tersimpan dan tidak dapat terhubung ke server");
          }
        }
      }

      if (isMounted) { setIsLoading(false); }
    };

    load();
    return () => { isMounted = false; };
  }, [userId, authLoading, checklistType, shift, areaCode, effectiveAreaCode, isDailyInspector, selectedDate]);

  // ── 4. [OFFLINE-4] Load saved results — cache-first, API background ───────
  const loadSavedResultsFn = useCallback(async (locationKey: string) => {
    if (!userId || !locationKey) return;
    if (!shift || !selectedDate) return;

    // [OFFLINE-4] Tidak pernah block saat offline — lanjutkan selalu
    // Saat online: butuh areaCode dan specificArea untuk request API yang valid
    // Saat offline: skip validasi tersebut, pakai apa yang ada di cache

    const requestId = Date.now();
    latestRequestRef.current = requestId;

    const dateKey  = getLocalDateKey(selectedDate);
    const cacheKey = `checklist-results-${effectiveAreaCode}-${shift}-${dateKey}-${selectedSpecificArea || "all"}-${locationKey}`;
    latestKeyRef.current = cacheKey;

    const isCurrentRequest = () =>
      latestRequestRef.current === requestId && latestKeyRef.current === cacheKey;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsDataReady(false);

    const cacheResults:   Record<number, ChecklistResult> = {};
    const cacheFaResults: Record<number, FADciResult>     = {};
    const apiResults:     Record<number, ChecklistResult> = {};
    const apiFaResults:   Record<number, FADciResult>     = {};

    const parseFormatted = (
      formatted: Record<string, any>,
      target: { results: Record<number, ChecklistResult>; faResults: Record<number, FADciResult> }
    ) => {
      const todayResults = formatted[dateKey] || {};
      if (Object.keys(todayResults).length === 0) return;

      if (checklistType === "inspector") {
        const allowedIds = FA_SPECIFIC_AREA_ITEMS[selectedSpecificArea] || [];
        Object.entries(todayResults).forEach(([key, val]: [string, any]) => {
          const fd = key.indexOf("-");
          const ld = key.lastIndexOf("-");
          if (fd === -1 || ld === -1 || fd === ld) return;
          const no  = parseInt(key.slice(0, fd), 10);
          const ksa = key.slice(fd + 1, ld);
          const ksh = key.slice(ld + 1);
          if (!isNaN(no) && ksh === shift && ksa === selectedSpecificArea && allowedIds.includes(no)) {
            let choices: string[] = [], other = "", photos: string[] = [];
            try {
              const p = JSON.parse(val.ngDescription || "{}");
              if (Array.isArray(p)) choices = p;
              else if (p && typeof p === "object") { choices = p.choices || []; other = p.other || ""; }
            } catch {}
            try { const pp = JSON.parse(val.ngPhotos || "[]"); if (Array.isArray(pp)) photos = pp; } catch {}
            target.faResults[no] = {
              itemId: no, status: val.status === "OK" ? "OK" : val.status === "NG" ? "NG" : null,
              selectedNgChoices: choices, ngOtherNote: other, ngPhotos: photos,
            };
          }
        });
      } else {
        Object.entries(todayResults).forEach(([key, result]: [string, any]) => {
          const ld = key.lastIndexOf("-");
          if (ld === -1) return;
          const id  = parseInt(key.slice(0, ld), 10);
          const ksh = key.slice(ld + 1);
          if (!isNaN(id) && id > 0 && ksh === shift) {
            let photos: string[] = [];
            try { const pp = JSON.parse(result.ngPhotos || "[]"); if (Array.isArray(pp)) photos = pp; } catch {}
            target.results[id] = {
              itemId: id,
              status: result.status === "OK" ? "OK" : result.status === "NG" ? "NG" : null,
              notes:  result.ngDescription || "",
              ngPhotos: photos,
            };
          }
        });
      }
    };

    // STEP 1: Cache-first — selalu jalan, online maupun offline
    try {
      const cachedData = await getCache(cacheKey);
      console.log("[results] cache:", cacheKey, "found:", !!cachedData?.formatted);

      if (cachedData?.success && cachedData.formatted) {
        parseFormatted(cachedData.formatted, { results: cacheResults, faResults: cacheFaResults });

        if (!isCurrentRequest()) { isLoadingRef.current = false; setIsLoading(false); return; }

        if (checklistType === "inspector" && Object.keys(cacheFaResults).length > 0) {
          setFaResults(prev => ({ ...prev, ...cacheFaResults }));
        } else if (checklistType !== "inspector" && Object.keys(cacheResults).length > 0) {
          setResults(prev => ({ ...prev, ...cacheResults }));
        }
      }
    } catch (cacheErr) {
      console.log("[results] Cache read error:", cacheErr);
    }

    // STEP 2: UI ready — set setelah cache diproses, tidak tunggu API
    await new Promise(r => setTimeout(r, 50));
    if (isCurrentRequest()) {
      setIsDataReady(true);
      isDataReadyRef.current = true;
      setIsLoading(false);
      isLoadingRef.current   = false;
    }

    // STEP 3: API background fetch — hanya saat online DAN areaCode tersedia
    if (!navigator.onLine || !effectiveAreaCode) return;

    try {
      const categoryCode = checklistType === "inspector" ? "final-assy-inspector" : "final-assy-gl";
      const spParam      = (checklistType === "inspector" && selectedSpecificArea)
        ? `&specificArea=${encodeURIComponent(selectedSpecificArea)}` : "";
      const url =
        `/api/final-assy/get-results?userId=${userId}` +
        `&categoryCode=${categoryCode}&month=${dateKey.slice(0, 7)}` +
        `&role=${userRole}&areaCode=${encodeURIComponent(effectiveAreaCode)}` +
        `&conveyor=${encodeURIComponent(locationKey)}&shift=${encodeURIComponent(shift)}` +
        spParam;

      const res = await safeFetch(url);
      if (!res.ok) { console.log("[results] API failed:", res.status); return; }
      const data = await res.json();
      if (!data.success || !data.formatted) { console.log("[results] API empty"); return; }

      await saveCache(cacheKey, data);
      if (!isCurrentRequest()) return;

      parseFormatted(data.formatted, { results: apiResults, faResults: apiFaResults });
      if (!isCurrentRequest()) return;

      if (checklistType === "inspector") {
        setFaResults(prev => ({ ...prev, ...apiFaResults }));
      } else {
        setResults(prev => ({ ...prev, ...apiResults }));
      }
    } catch (fetchErr) {
      console.log("[results] API fetch error (cache sudah tampil):", fetchErr);
    }
  }, [userId, checklistType, areaCode, effectiveAreaCode, userRole, shift, selectedDate, selectedSpecificArea]);

  useEffect(() => { loadSavedResultsFnRef.current = loadSavedResultsFn; }, [loadSavedResultsFn]);

  // ── Trigger loadSavedResults ──────────────────────────────────────────────
  useEffect(() => {
    if (!shift || !selectedDate) return;

    // [OFFLINE-4] Saat offline: lanjutkan meskipun areaCode/conveyor kosong
    // Saat online: tetap validasi seperti semula
    if (navigator.onLine) {
      if (!areaCode) return;
      if (checklistType === "inspector" && (!conveyor || !selectedSpecificArea)) return;
    }

    const locationKey = conveyor || (isDailyInspector ? "" : "default");
    if (!locationKey) return;

    const dateKey  = getLocalDateKey(selectedDate);
    const cacheKey = `checklist-results-${effectiveAreaCode}-${shift}-${dateKey}-${selectedSpecificArea || "all"}-${locationKey}`;

    if (latestKeyRef.current === cacheKey && isDataReadyRef.current) return;
    if (isLoadingRef.current && latestKeyRef.current === cacheKey) return;

    setIsDataReady(false);
    isDataReadyRef.current = false;

    loadSavedResultsFnRef.current?.(locationKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conveyor, areaCode, selectedDate, selectedSpecificArea, isDailyInspector, shift, checklistType, effectiveAreaCode]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredFaDciItems = useMemo(() => {
    // [FIX] Normalize selectedSpecificArea: trim + uppercase + map ke key asli
    const rawArea = (selectedSpecificArea || "").trim().toUpperCase();
    const availableKeys = Object.keys(FA_SPECIFIC_AREA_ITEMS);
    const resolvedKey =
      availableKeys.find(k => k.toUpperCase() === rawArea) ||
      (rawArea ? null : null);

    // [FIX] Fallback ke "WP CHECK" jika key tidak ditemukan
    const effectiveKey = resolvedKey ?? "WP CHECK";
    const allowed = FA_SPECIFIC_AREA_ITEMS[effectiveKey];

    const filtered = allowed
      ? FA_DCI_ITEMS.filter(item => allowed.includes(item.id))
      : FA_DCI_ITEMS;

    // [FIX] Safety fallback: jangan biarkan filtered kosong
    const result = filtered.length > 0 ? filtered : FA_DCI_ITEMS;

    console.log("[SPECIFIC AREA]", {
      selectedSpecificArea,
      rawArea,
      resolvedKey,
      effectiveKey,
      availableKeys,
      filteredIds: result.map(i => i.id),
    });

    return result;
  }, [selectedSpecificArea]);

  const filteredFaDciItemsRef = useRef(FA_DCI_ITEMS);
  useEffect(() => { filteredFaDciItemsRef.current = filteredFaDciItems; }, [filteredFaDciItems]);

  const completedCount = useMemo(() => {
    if (checklistType === "inspector") return Object.values(faResults).filter(r => r.status !== null).length;
    return Object.values(results).filter(r => r.status !== null).length;
  }, [checklistType, faResults, results]);
  const totalCount      = isDailyInspector ? filteredFaDciItems.length : checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const progressDetails = useMemo(() => filteredFaDciItems.map(item => {
    const result = faResults[item.id];
    return {
      id: item.id,
      itemCheck: item.itemCheck,
      statusIcon: result?.status != null ? "✅" : "⏳",
      statusLabel: result?.status != null ? (result.status === "OK" ? "Sudah Check" : "Sudah Check") : "Belum dicheck",
      gaugeId: scannedGaugeIds[item.id] || null,
      isCompleted: result?.status != null,
    };
  }), [filteredFaDciItems, faResults, scannedGaugeIds]);

  // ── Handlers (tidak diubah) ───────────────────────────────────────────────
  const handleStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    setResults(prev => {
      if (prev[itemId]?.status === clicked) { const { [itemId]: _, ...rest } = prev; return rest; }
      return { ...prev, [itemId]: { itemId, status: clicked, notes: prev[itemId]?.notes || "", ngPhotos: clicked === "OK" ? [] : (prev[itemId]?.ngPhotos || []) } };
    });
    setSaveSuccess(false);
  }, []);

  const handleNotesChange = useCallback((itemId: number, notes: string) => {
    setResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], itemId, notes, status: prev[itemId]?.status || null } }));
    setSaveSuccess(false);
  }, []);

  const flashDciScanSuccessToast = useCallback(() => {
    setDciScanSuccessToast(true);
    if (dciScanSuccessToastTimer.current) clearTimeout(dciScanSuccessToastTimer.current);
    dciScanSuccessToastTimer.current = setTimeout(() => setDciScanSuccessToast(false), 2000);
  }, []);

  const handleDciScanInput = useCallback((raw: string) => {
    if (dciCloseCardTimer.current) {
      clearTimeout(dciCloseCardTimer.current);
      dciCloseCardTimer.current = null;
    }

    const t = raw.trim().toUpperCase();
    const m = t.match(/^DCI-(\d+)(?:-(.+))?$/);
    if (m) {
      const id = parseInt(m[1], 10);
      const g  = m[2] ? m[2].trim() : null;
      const inFiltered = filteredFaDciItemsRef.current.some(i => i.id === id);
      const inAll = FA_DCI_ITEMS.some(i => i.id === id);
      console.log("[DCI SCAN INPUT]", {
        raw,
        normalized: t,
        selectedSpecificArea,
        filteredIds: filteredFaDciItemsRef.current.map(i => i.id),
        id,
        gaugeId: g,
        inFiltered,
        inAll,
      });
      const ok = inFiltered || inAll;
      if (ok) {
        if (g) setScannedGaugeIds(prev => ({ ...prev, [id]: g }));
        setDciScannedItemId(id);
        setDciCardVisible(true);
        flashDciScanSuccessToast();
      } else {
        console.warn("[DCI SCAN INPUT] item tidak ada di filteredFaDciItems dan tidak ada di FA_DCI_ITEMS", { id, selectedSpecificArea });
      }
    } else {
      console.warn("[DCI SCAN INPUT] format QR tidak cocok", { raw, normalized: t });
    }
  }, [flashDciScanSuccessToast]);

  // [FIX] useEffect reopen card dihapus — visibility dikontrol langsung dari
  // handleDciScanInput (open) dan handleDciCloseCard (close) saja.

  const checkDuplicate = useCallback(async (itemId: number, clicked: "OK" | "NG", doSet: () => void) => {
    if (faResults[itemId]?.status === clicked) { doSet(); return; }
    if (!conveyor || !userId || !areaCode || !effectiveAreaCode) { doSet(); return; }
    const gId = scannedGaugeIds[itemId] || null;
    if (!gId) { doSet(); return; }
    setIsCheckingDuplicate(itemId);
    try {
      const res  = await safeFetch("/api/final-assy/check-duplicate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, categoryCode: "final-assy-inspector", itemId, gaugeId: gId, dateKey: getLocalDateKey(selectedDate), shift, areaCode: effectiveAreaCode, carline: conveyor, line: null, specificArea: selectedSpecificArea }),
      });
      const data = await res.json();
      if (data.isDuplicate && data.duplicates?.length > 0) {
        setDuplicateWarning({
          itemId,
          itemCheck: FA_DCI_ITEMS.find(i => i.id === itemId)?.itemCheck ?? `Item ${itemId}`,
          duplicateLocations: data.duplicates.map((d: any) => d.description).filter(Boolean),
          onConfirm: () => { setDuplicateWarning(null); doSet(); },
        });
      } else doSet();
    } catch { doSet(); }
    finally { setIsCheckingDuplicate(null); }
  }, [faResults, conveyor, userId, areaCode, effectiveAreaCode, selectedSpecificArea, shift, selectedDate, scannedGaugeIds]);

  const flashDciSaveToast = useCallback(() => {
    setDciSaveToast(true);
    if (dciSaveToastTimer.current) clearTimeout(dciSaveToastTimer.current);
    dciSaveToastTimer.current = setTimeout(() => setDciSaveToast(false), 1400);
  }, []);

  const handleDciCloseCard = useCallback(() => {
    if (dciCloseCardTimer.current) {
      clearTimeout(dciCloseCardTimer.current);
    }
    setDciCardVisible(false);
    dciCloseCardTimer.current = setTimeout(() => {
      setDciScannedItemId(null);
      dciCloseCardTimer.current = null;
    }, 220);
  }, []);

  const handleDciSaveAndClose = useCallback(async (itemId: number) => {
    const r = faResults[itemId];
    if (!r || r.status === null) return;
    const isNg = r.status === "NG";
    const ngEmpty = isNg
      && (r.selectedNgChoices?.length ?? 0) === 0
      && !(r.ngOtherNote?.trim())
      && !(Array.isArray(r.ngPhotos) && r.ngPhotos.length > 0);
    if (ngEmpty) { alert("⚠️ Lengkapi kondisi NG terlebih dahulu."); return; }

    const categoryCode  = "final-assy-inspector";
    const dateKey       = getLocalDateKey(selectedDate);
    const ngDescription = isNg
      ? JSON.stringify({ choices: r.selectedNgChoices || [], other: r.ngOtherNote?.trim() || "" })
      : null;
    const ngPhotos = isNg ? (r.ngPhotos || []) : null;

    try {
      await saveChecklistOffline("/api/final-assy/save-result", {
        userId, categoryCode, itemId, dateKey, shift, status: r.status,
        ngDescription, ngDepartment: isNg ? "QA" : null, ngPhotos,
        areaCode: effectiveAreaCode, conveyor: conveyor || null, carline: null, line: null,
        specificArea: selectedSpecificArea,
        timeSlot: scannedGaugeIds[itemId] || "",
        pattern: pattern || null,
        submittedAt: new Date().toISOString(),
        deviceCode: loadPhysicalBinding()?.device_code ?? null,
      });
      await updateLocalCache({
        checklistType, effectiveAreaCode, shift, selectedDate, selectedSpecificArea,
        conveyor: conveyor || "", itemId, status: r.status, ngDescription, ngPhotos,
      });
      await loadUnsyncedCount();
      flashDciSaveToast();
      handleDciCloseCard();
    } catch (err: any) {
      alert(`❌ Gagal menyimpan.\n\${err?.message || "Unknown error"}`);
    }
  }, [faResults, selectedDate, scannedGaugeIds, userId, shift, effectiveAreaCode, conveyor,
      selectedSpecificArea, pattern, checklistType, loadUnsyncedCount,
      flashDciSaveToast, handleDciCloseCard]);

  const handleDciScanStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    const doSet = () => {
      setFaResults(prev => {
        if (prev[itemId]?.status === clicked) { const { [itemId]: _, ...rest } = prev; return rest; }
        return { ...prev, [itemId]: { itemId, status: clicked, selectedNgChoices: clicked === "OK" ? [] : (prev[itemId]?.selectedNgChoices || []), ngOtherNote: clicked === "OK" ? "" : (prev[itemId]?.ngOtherNote || ""), ngPhotos: clicked === "OK" ? [] : (prev[itemId]?.ngPhotos || []) } };
      });
      setSaveSuccess(false);
      // card tetap terbuka — close hanya via tombol SIMPAN CHECKLIST
    };
    checkDuplicate(itemId, clicked, doSet);
  }, [checkDuplicate]);

  const toggleCheckpoints     = useCallback((id: number) => { setExpandedCheckpoints(prev => ({ ...prev, [id]: !prev[id] })); }, []);
  const handleDciNgChoiceToggle = useCallback((id: number, choice: string) => {
    setFaResults(prev => {
      const cur = prev[id]?.selectedNgChoices || [];
      return { ...prev, [id]: { ...prev[id], id, status: "NG" as const, selectedNgChoices: cur.includes(choice) ? cur.filter(c => c !== choice) : [...cur, choice], ngOtherNote: prev[id]?.ngOtherNote || "", ngPhotos: prev[id]?.ngPhotos || [] } };
    });
    setSaveSuccess(false);
  }, []);

  const handleDciOtherNoteChange = useCallback((id: number, note: string) => {
    setFaResults(prev => ({ ...prev, [id]: { ...prev[id], id, status: "NG" as const, selectedNgChoices: prev[id]?.selectedNgChoices || [], ngOtherNote: note, ngPhotos: prev[id]?.ngPhotos || [] } }));
    setSaveSuccess(false);
  }, []);

  const handleDciPhotosChange = useCallback((id: number, photos: string[]) => {
    const safePhotos = Array.isArray(photos) ? photos.filter(p => typeof p === "string" && p.length > 0) : [];
    setFaResults(prev => ({ ...prev, [id]: { ...prev[id], itemId: id, status: prev[id]?.status || ("NG" as const), selectedNgChoices: prev[id]?.selectedNgChoices || [], ngOtherNote: prev[id]?.ngOtherNote || "", ngPhotos: safePhotos } }));
    setSaveSuccess(false);
  }, []);

  const handleNotesPhotosChange = useCallback((id: number, photos: string[]) => {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], itemId: id, status: prev[id]?.status || "NG" as const, notes: prev[id]?.notes || "", ngPhotos: photos } }));
    setSaveSuccess(false);
  }, []);

  // ── handleSubmit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId || (navigator.onLine && !areaCode)) {
      if (isResolvingArea) { alert("⏳ Sedang memverifikasi area. Tunggu sebentar."); return; }
      if (resolveError && navigator.onLine) { alert(`❌ ${resolveError}`); return; }
      if (navigator.onLine) { alert("⚠️ Area tidak ditemukan. Scan ulang QR Code."); return; }
    }
    if (isDailyInspector && !conveyor && navigator.onLine)             { alert("⚠️ Data Conveyor tidak ditemukan."); return; }
    if (isDailyInspector && !selectedSpecificArea && navigator.onLine) { alert("⚠️ Data Spesifik Area tidak ditemukan."); return; }

    const categoryCode = isDailyInspector ? "final-assy-inspector" : "final-assy-gl";
    const dateKey      = getLocalDateKey(selectedDate);

    if (isDailyInspector) {
      const ngEmpty = filteredFaDciItems.filter(item => {
        const r = faResults[item.id];
        const hasPhoto = Array.isArray(r?.ngPhotos) && r.ngPhotos.length > 0;
        return r?.status === "NG" && (r.selectedNgChoices?.length ?? 0) === 0 && !(r.ngOtherNote?.trim()) && !hasPhoto;
      });
      if (ngEmpty.length > 0) { alert(`⚠️ Item NG wajib mengisi kondisi NG.\n\n${ngEmpty.map(i => i.itemCheck).join(", ")}`); return; }
    } else {
      const glNg = checklistItems.filter(item => {
        const r = results[item.id];
        return r?.status === "NG" && (r.ngPhotos?.length ?? 0) === 0 && !(r.notes?.trim());
      });
      if (glNg.length > 0) { alert(`⚠️ Item NG wajib mengisi keterangan atau foto dokumentasi.\n\n${glNg.map(i => i.checkPoint).join("\n")}`); return; }
    }

    const itemsToSave = isDailyInspector
      ? filteredFaDciItems.filter(item => faResults[item.id]?.status != null)
      : checklistItems.filter(item => results[item.id]?.status != null);

    if (itemsToSave.length === 0 && !window.confirm("Tidak ada item yang diisi. Yakin ingin menyimpan?")) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true); setSaveSuccess(false);

    try {
      type PreparedItem = {
        item: typeof itemsToSave[0];
        status: "OK" | "NG";
        ngDescription: string | null;
        ngPhotos: string[] | null;
        submittedAt: string;
      };

      const preparedItems: PreparedItem[] = [];
      const submittedAt = new Date().toISOString();

      for (const item of itemsToSave) {
        let status: "OK" | "NG";
        let ngDescription: string | null;
        let ngPhotos: string[] | null = null;

        if (isDailyInspector) {
          const r = faResults[item.id]; if (!r || r.status === null) continue;
          status        = r.status;
          ngDescription = status === "NG" ? JSON.stringify({ choices: r.selectedNgChoices || [], other: r.ngOtherNote?.trim() || "" }) : null;
          ngPhotos      = status === "NG" ? (r.ngPhotos || []) : null;
        } else {
          const r = results[item.id]; if (!r || r.status === null) continue;
          status        = r.status;
          ngDescription = status === "NG" ? (r.notes || null) : null;
          ngPhotos      = status === "NG" ? (r.ngPhotos || []) : null;
        }
        preparedItems.push({ item, status, ngDescription, ngPhotos, submittedAt });
      }

      // Simpan ke IndexedDB queue (bekerja online maupun offline)
      await Promise.all(preparedItems.map(({ item, status, ngDescription, ngPhotos, submittedAt }) =>
        saveChecklistOffline("/api/final-assy/save-result", {
          userId, categoryCode, itemId: item.id, dateKey, shift, status,
          ngDescription, ngDepartment: status === "NG" ? "QA" : null, ngPhotos,
          areaCode: effectiveAreaCode, conveyor: conveyor || null, carline: null, line: null,
          specificArea: isDailyInspector ? selectedSpecificArea : null,
          timeSlot: isDailyInspector ? (scannedGaugeIds[item.id] || "") : "",
          pattern: pattern || null, submittedAt,
          deviceCode: loadPhysicalBinding()?.device_code ?? null,
        })
      ));

      // Update cache GET lokal secara serial
      for (const { item, status, ngDescription, ngPhotos } of preparedItems) {
        await updateLocalCache({ checklistType, effectiveAreaCode, shift, selectedDate, selectedSpecificArea, conveyor: conveyor || "", itemId: item.id, status, ngDescription, ngPhotos });
      }

      setSaveSuccess(true);
      await loadUnsyncedCount();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      if (err?.isDuplicateError) {
        alert(`⚠️ Item "${err.itemCheck}" sudah pernah di-check di:\n${err.locations.map((l: string) => `• ${l}`).join("\n")}`);
      } else {
        alert(`❌ Gagal menyimpan checklist.\n\nDetail: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handlePhotoZoom      = useCallback((photoUrl: string) => { setPhotoZoomLoading(true); setPhotoZoomSrc(photoUrl); }, []);
  const handleClosePhotoZoom = useCallback(() => { setPhotoZoomSrc(null); setPhotoZoomLoading(false); }, []);
  const formatDate           = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const checklistTypeBadge = isDailyInspector
    ? { label: "Inspector", cls: "ins" }
    : { label: "Group Leader", cls: "gl" };

  // ── Guards ────────────────────────────────────────────────────────────────
  // [OFFLINE-2] Semua guard yang return JSX hanya aktif saat online.
  // Saat offline, halaman selalu lanjut ke main render agar tetap usable.

  if (authLoading || !isInitialized) return <div className="loading-page">Memuat...</div>;
  if (!userId) return null;

  if (categoryCodeMissing) return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <main style={{ marginLeft: 80, padding: 20, minHeight: "100vh", background: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "white", borderRadius: 16, padding: "36px 28px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "2px solid #fecaca" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", margin: "0 0 12px" }}>Kategori Belum Dipilih</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" }}>Silakan kembali ke halaman Home dan pilih kategori checksheet terlebih dahulu.</p>
          <button onClick={() => window.location.href = "/home"} style={{ padding: "13px 24px", background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>← Kembali ke Home untuk Pilih Kategori</button>
        </div>
      </main>
    </>
  );

  // [OFFLINE-2] isResolvingArea — hanya tampil jika online
  if (isResolvingArea && navigator.onLine) return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <main style={{ marginLeft: 80, padding: 20, minHeight: "100vh", background: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", background: "white", borderRadius: 16, padding: "40px 32px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", maxWidth: 400 }}>
          <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>Memverifikasi Area...</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Mengambil data area "<strong>{areaName}</strong>"</p>
        </div>
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );

  // [OFFLINE-2] resolveError — hanya blok saat online
  if (resolveError && navigator.onLine) return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <main style={{ marginLeft: 80, padding: 20, minHeight: "100vh", background: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "white", borderRadius: 16, padding: "36px 28px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "2px solid #fecaca" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", margin: "0 0 12px" }}>Area Tidak Ditemukan</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" }}>{resolveError}</p>
          <button onClick={() => window.location.href = "/home"} style={{ padding: "13px 24px", background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>← Kembali & Scan Ulang</button>
        </div>
      </main>
    </>
  );

  // [OFFLINE-2] No area guard — hanya blok saat online
  if (!areaCode && !areaName && navigator.onLine) return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <main style={{ marginLeft: 80, padding: 20, minHeight: "100vh", background: "#f5f7fa" }}>
        <div style={{ background: "#fef2f2", borderTop: "1px solid #fecaca", borderRight: "1px solid #fecaca", borderBottom: "1px solid #fecaca", borderLeft: "4px solid #ef4444", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ color: "#dc2626", fontSize: 14 }}>Area tidak ditemukan. Silakan scan QR Code pada area yang ingin diperiksa.</span>
          <button onClick={() => window.location.href = "/home"} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>Kembali</button>
        </div>
      </main>
    </>
  );

  // [OFFLINE-2] QR not scanned guard — hanya blok saat online
  if (isDailyInspector && !qrScanned && navigator.onLine) return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <button onClick={() => window.history.back()} style={{ position: "fixed", top: 16, left: 86, background: "rgba(30,136,229,0.15)", border: "none", color: "#1e88e5", width: 40, height: 40, borderRadius: 8, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>←</button>
      <main style={{ marginLeft: 80, padding: 20, minHeight: "100vh", background: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "white", borderRadius: 20, padding: "40px 32px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", border: "2px dashed #c4b5fd" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📷</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", margin: "0 0 12px" }}>Scan QR Code Area Terlebih Dahulu</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 20px" }}>Halaman ini memerlukan data <strong>Conveyor, Pattern &amp; Spesifik Area</strong> dari QR Code.</p>
          {areaName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", background: "#eff6ff", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>Area:</span>
              <span style={{ fontSize: 13, color: "#1e40af", fontWeight: 700 }}>{areaName}</span>
            </div>
          )}
          <button onClick={() => window.location.href = "/home"} style={{ padding: "13px 24px", background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>← Kembali ke Home untuk Scan</button>
        </div>
      </main>
    </>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <button onClick={() => window.history.back()} className="back-button" aria-label="Kembali">←</button>

      <main className="main-content">
        <div className="header-section">
          <h1 className="page-title">Final Assy Checksheet</h1>
          <div className="header-actions">
            <button className="icon-button">🔔</button>
            <button className="icon-button">👤</button>
          </div>
        </div>

        {/* Offline indicator banner */}
        {!navigator.onLine && (
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📡</span>
            <span style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>
              Mode Offline — Data diambil dari cache lokal. Checklist tetap bisa diisi dan akan disinkronkan saat online.
            </span>
          </div>
        )}

        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Tipe Checklist:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="info-value">{CHECKLIST_TYPE_LABELS[checklistType]}</span>
              <span className={`dropdown-badge ${checklistTypeBadge.cls}`}>{checklistTypeBadge.label}</span>
            </div>
          </div>

          <div className="info-row">
            <span className="info-label">Area:</span>
            <span className="info-value area-value">{areaName || areaCode || "—"}</span>
          </div>

          {conveyor && (
            <div className="info-row">
              <span className="info-label">🏭 Conveyor:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: "#d1fae5", color: "#065f46", border: "1.5px solid #6ee7b7" }}>🏭 {conveyor}</span>
                {qrScanned && <span style={{ fontSize: 10, fontWeight: 700, background: "#f0f9ff", color: "#0284c7", padding: "2px 7px", borderRadius: 20, border: "1px solid #bae6fd" }}>dari QR</span>}
              </div>
            </div>
          )}

          {pattern && (
            <div className="info-row">
              <span className="info-label">🔖 Pattern:</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: "#f5f3ff", color: "#5b21b6", border: "1.5px solid #ddd6fe" }}>🔖 {pattern}</span>
            </div>
          )}

          {isDailyInspector && selectedSpecificArea && (
            <div className="info-row">
              <span className="info-label">🔍 Spesifik Area:</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: "#ede9fe", color: "#5b21b6", border: "1.5px solid #c4b5fd" }}>📋 {selectedSpecificArea}</span>
            </div>
          )}

          <div style={{ marginTop: 16, marginBottom: 20, padding: 14, borderRadius: 12, background: unsyncedCount > 0 ? "#fef3c7" : "#ecfdf5", border: `1px solid ${unsyncedCount > 0 ? "#fde68a" : "#86efac"}`, color: unsyncedCount > 0 ? "#92400e" : "#166534", fontWeight: 700 }}>
            {unsyncedCount > 0
              ? `🟡 ${unsyncedCount} data belum tersinkron`
              : "🟢 Semua data sudah tersinkron"}
          </div>

          <div className="info-row">
            <span className="info-label">Shift:</span>
            <select className="shift-dropdown" value={shift} onChange={e => {
              const s = e.target.value as "A" | "B";
              setShift(s);
              if (isDailyInspector) setChecklistItems([]);
              setSaveSuccess(false);
            }}>
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
            </select>
          </div>

          <div className="info-row">
            <span className="info-label">Tanggal:</span>
            <input type="date" value={getLocalDateKey(selectedDate)}
              onChange={e => { const d = new Date(e.target.value); setSelectedDate(d); if (isDailyInspector) setChecklistItems([]); setSaveSuccess(false); }}
              max={getLocalDateKey(currentDate)}
              min={getLocalDateKey(new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000))}
              style={{ padding: "7px 12px", borderRadius: 8, border: "2px solid #1e88e5", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "white", cursor: "pointer", outline: "none" }}
            />
          </div>
          <div className="info-row">
            <span className="info-label">Hari Ini:</span>
            <span className="info-value">{formatDate(currentDate)}</span>
          </div>
        </div>

        {isLoading || !isDataReady ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 16, background: "white", borderRadius: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Memuat data checklist...</p>
          </div>
        ) : (
          <>
            <div className="progress-card" style={{ cursor: isDailyInspector ? "pointer" : "default" }} onClick={() => { if (isDailyInspector) setProgressModalOpen(true); }}>
              <div className="progress-header">
                <span className="progress-text">Progress: {completedCount} / {totalCount} item selesai</span>
                <span className="progress-percent">{Math.round(progressPercent)}%</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
              {isDailyInspector && <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>Klik progress untuk lihat detail gauge/checkpoint</div>}
            </div>

            {saveSuccess && <div className="success-banner"><span>✅</span><span>Checklist berhasil disimpan!</span></div>}
            {error && (
              <div className="error-banner">
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span style={{ flex: 1, color: "#dc2626", fontSize: 14 }}>{error}</span>
                <button onClick={() => window.location.reload()} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Coba Lagi</button>
              </div>
            )}

            {isDailyInspector && (
              <div style={{ background: "#f5f3ff", borderTop: "1px solid #ddd6fe", borderRight: "1px solid #ddd6fe", borderBottom: "1px solid #ddd6fe", borderLeft: "4px solid #7c3aed", borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <span>📡</span>
                <span style={{ color: "#1e40af", fontSize: 13 }}>
                  <strong>Scan Mode Aktif:</strong> Arahkan scanner TC21 ke QR Code Item Check. Format: <code style={{ background: "#ede9fe", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>DCI-1</code> s/d <code style={{ background: "#ede9fe", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>DCI-{FA_DCI_ITEMS.length}</code>
                </span>
              </div>
            )}

            {!isDailyInspector && (
              <div style={{ background: "#eff6ff", borderTop: "1px solid #bfdbfe", borderRight: "1px solid #bfdbfe", borderBottom: "1px solid #bfdbfe", borderLeft: "4px solid #3b82f6", borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <span>ℹ️</span>
                <span style={{ color: "#1e40af", fontSize: 13 }}>
                  <strong>Mode GL:</strong> Tap setiap item untuk mengisi status. Saat NG, wajib isi keterangan atau foto dokumentasi.
                </span>
              </div>
            )}

            {/* ── Checklist content ─────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 120 }}>
              {isDailyInspector ? (
                <div style={{ position: "relative", minHeight: 300 }}>
                  <input
                    ref={scanInputRef}
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      console.log("[DCI INPUT EVENT] onChange", { val, selectedSpecificArea, qrScanned });
                      if (!val) return;
                      val.split(/[\r\n]+/).forEach(line => { const t = line.trim(); if (t.length >= 3) handleDciScanInput(t); });
                      e.target.value = "";
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const t = e.currentTarget.value.trim();
                        console.log("[DCI INPUT EVENT] onKeyDown Enter", { t, selectedSpecificArea, qrScanned });
                        if (t.length >= 3) handleDciScanInput(t);
                        e.currentTarget.value = "";
                        e.preventDefault();
                      }
                    }}
                    style={{ position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0, pointerEvents: "none" }}
                    inputMode="none" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                    tabIndex={-1} aria-hidden="true"
                  />

                  {dciScanSuccessToast && (
                    <div style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "white", padding: "9px 22px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 9000, pointerEvents: "none", animation: "fadeInOut 2s ease-in-out" }}>✅ Scan Berhasil<br/><span style={{ fontSize: 11, fontWeight: 500 }}>Gauge berhasil dipindai</span></div>
                  )}

                  {dciSaveToast && (
                    <div style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "white", padding: "9px 22px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 9000, pointerEvents: "none" }}>✓ TERSIMPAN</div>
                  )}

                  {dciScannedItemId === null && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ background: "white", borderRadius: 16, padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, border: "2px dashed #c4b5fd" }}>
                        <div style={{ width: 140, height: 96, position: "relative" }}>
                          {["tl", "tr", "bl", "br"].map(c => <div key={c} style={{ position: "absolute", width: 18, height: 18, borderColor: "#7c3aed", borderStyle: "solid", ...(c === "tl" ? { top: 0, left: 0, borderWidth: "3px 0 0 3px", borderRadius: "3px 0 0 0" } : c === "tr" ? { top: 0, right: 0, borderWidth: "3px 3px 0 0", borderRadius: "0 3px 0 0" } : c === "bl" ? { bottom: 0, left: 0, borderWidth: "0 0 3px 3px", borderRadius: "0 0 0 3px" } : { bottom: 0, right: 0, borderWidth: "0 3px 3px 0", borderRadius: "0 0 3px 0" }) }} />)}
                          <div style={{ position: "absolute", left: 8, right: 8, height: 2, background: "linear-gradient(90deg,transparent,#7c3aed,transparent)", top: "50%", animation: "scanline 2s ease-in-out infinite" }} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <span style={{ display: "inline-block", background: "#22c55e", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>🔴 Scanner Aktif</span>
                          <p style={{ fontSize: 13, color: "#64748b", marginTop: 8, marginBottom: 0 }}>Arahkan scanner TC21 ke QR Code pada Item Check</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                          {selectedSpecificArea && <div style={{ padding: "6px 14px", background: "#ede9fe", borderRadius: 20, border: "1px solid #c4b5fd", textAlign: "center" }}><span style={{ fontSize: 12, color: "#5b21b6", fontWeight: 700 }}>🔍 {selectedSpecificArea}</span><span style={{ fontSize: 11, color: "#7c3aed", marginLeft: 8 }}>{filteredFaDciItems.length} item</span></div>}
                          {conveyor && <div style={{ padding: "6px 14px", background: "#d1fae5", borderRadius: 20, border: "1px solid #6ee7b7", textAlign: "center" }}><span style={{ fontSize: 12, color: "#065f46", fontWeight: 700 }}>🏭 {conveyor}</span>{pattern && <span style={{ fontSize: 11, color: "#059669", marginLeft: 6 }}>• {pattern}</span>}</div>}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* DCI Card */}
                  {dciScannedItemId !== null && (() => {
                    const item = filteredFaDciItems.find(i => i.id === dciScannedItemId) || FA_DCI_ITEMS.find(i => i.id === dciScannedItemId)!;
                    const itemFoundInFiltered = filteredFaDciItems.some(i => i.id === dciScannedItemId);
                    const itemFoundInAll = FA_DCI_ITEMS.some(i => i.id === dciScannedItemId);
                    console.log("[DCI CARD RENDER]", {
                      dciScannedItemId,
                      dciCardVisible,
                      selectedSpecificArea,
                      filteredIds: filteredFaDciItems.map(i => i.id),
                      itemFoundInFiltered,
                      itemFoundInAll,
                      itemId: item?.id,
                      itemLabel: item?.itemCheck,
                    });
                    const selectedDateDay = selectedDate.getDate();
                    const scheduleAwareItem = {
                      ...item,
                      scheduleType: item.scheduleType ?? (item.id === 6 || item.id === 10 ? "weekly" : "daily"),
                      weeklyCheckpointIndex: item.id === 3 ? 5 : item.weeklyCheckpointIndex,
                    } as import("@/lib/fa-dci-schedule").FADciItem;
                    const activeNgChoices   = getActiveNgChoices(scheduleAwareItem, shift, selectedDateDay);
                    const activeCheckpoints = getActiveCheckpoints(scheduleAwareItem, shift, selectedDateDay);
                    const r       = faResults[item.id];
                    const isFilled = r?.status != null;
                    const isNg    = r?.status === "NG";
                    const isOk    = r?.status === "OK";
                    const hasNgPhoto = Array.isArray(r?.ngPhotos) && r.ngPhotos.length > 0;
                    const ngEmpty = isNg && (r.selectedNgChoices?.length ?? 0) === 0 && !(r.ngOtherNote?.trim()) && !hasNgPhoto;
                    const cpOpen  = expandedCheckpoints[item.id] ?? false;
                    return (
                      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "2px solid #e2e8f0", overflow: "hidden", transform: dciCardVisible ? "translateY(0)" : "translateY(24px)", opacity: dciCardVisible ? 1 : 0, transition: "transform 0.28s cubic-bezier(0.34,1.3,0.64,1),opacity 0.2s ease" }}>
                        <div style={{ background: "#f8fafc", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #e2e8f0" }}>
                          <button onClick={handleDciCloseCard} style={{ background: "#e2e8f0", border: "none", borderRadius: 8, color: "#475569", padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Kembali</button>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <span style={{ display: "block", fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>ID: DCI-{item.id}</span>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.itemCheck}</span>
                          </div>
                          <div style={{ minWidth: 38, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: isFilled ? (isOk ? "#dcfce7" : "#fee2e2") : "#f1f5f9", color: isFilled ? (isOk ? "#16a34a" : "#dc2626") : "#94a3b8", border: `1.5px solid ${isFilled ? (isOk ? "#86efac" : "#fca5a5") : "#e2e8f0"}` }}>
                            {isFilled ? (isOk ? "OK" : "NG") : `${filteredFaDciItems.indexOf(item) + 1}`.padStart(2, "0")}
                          </div>
                        </div>
                        {item.id === 3 && !isWeeklyScheduleActive(shift, selectedDateDay) && (
                          <div style={{ padding: "10px 16px", background: "#fffbeb", borderBottom: "1px solid #fcd34d", fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>⏭️</span>
                            <span>Checkpoint <strong>"Bisa Mendeteksi OK/NG"</strong> tidak perlu dicek hari ini. Jadwal Shift {shift}: {getWeeklyScheduleDesc(shift)}.</span>
                          </div>
                        )}
                        {isFilled && <div style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, background: isOk ? "#f0fdf4" : "#fef2f2", color: isOk ? "#15803d" : "#b91c1c", borderBottom: `1px solid ${isOk ? "#bbf7d0" : "#fecaca"}` }}>{isOk ? "✓ KONDISI NORMAL — SEMUA OK" : `✗ KONDISI NG${(r.selectedNgChoices?.length ?? 0) > 0 ? ` — ${r.selectedNgChoices.length} TEMUAN` : " — PILIH KONDISI"}`}</div>}
                        <button onClick={() => toggleCheckpoints(item.id)} style={{ width: "calc(100% - 32px)", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 12.5, color: "#475569", fontWeight: 600, margin: "12px 16px 0", textAlign: "left" }}>
                          <span>📋</span><span>Lihat Checkpoint ({activeCheckpoints.length} poin)</span><span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{cpOpen ? "▲" : "▼"}</span>
                        </button>
                        {cpOpen && <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", margin: "10px 16px 4px" }}><p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>✅ Kondisi OK / Normal:</p>{activeCheckpoints.map((cp, ci) => <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0" }}><span style={{ color: "#22c55e", fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span><span style={{ fontSize: 13, color: "#166534", lineHeight: 1.4 }}>{cp}</span></div>)}</div>}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 16 }}>
                          {(["OK", "NG"] as const).map(s => {
                            const checking = isCheckingDuplicate === item.id;
                            return (
                              <button key={s} onClick={() => handleDciScanStatusChange(item.id, s)} disabled={checking} style={{ border: `2.5px solid ${r?.status === s ? (s === "OK" ? "#22c55e" : "#ef4444") : "#e2e8f0"}`, borderRadius: 14, padding: "20px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: checking ? "wait" : "pointer", background: r?.status === s ? (s === "OK" ? "#22c55e" : "#ef4444") : "white", color: r?.status === s ? "white" : (s === "OK" ? "#16a34a" : "#dc2626"), transition: "all .15s" }}>
                                {checking ? <><span style={{ width: 20, height: 20, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /><span style={{ fontSize: 12 }}>Cek...</span></> : <><span style={{ fontSize: 24, fontWeight: 700 }}>{s === "OK" ? "✓" : "✗"}</span><span style={{ fontSize: 15, fontWeight: 800 }}>{s}</span></>}
                              </button>
                            );
                          })}
                        </div>
                        {isNg && (
                          <div style={{ margin: "0 16px 16px", background: "#fff7ed", border: `2px solid ${ngEmpty ? "#f59e0b" : "#fed7aa"}`, borderRadius: 10, padding: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                              <span style={{ fontSize: 16 }}>⚠️</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e", flex: 1 }}>Pilih kondisi NG:</span>
                              {ngEmpty && <span style={{ background: "#ef4444", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>Wajib ≥ 1</span>}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              {activeNgChoices.map((choice, ci) => {
                                const sel = r.selectedNgChoices.includes(choice);
                                return (
                                  <button key={ci} onClick={() => handleDciNgChoiceToggle(item.id, choice)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 13px", border: `2px solid ${sel ? "#ef4444" : "#e2e8f0"}`, borderRadius: 9, cursor: "pointer", textAlign: "left", background: sel ? "#fef2f2" : "white" as any }}>
                                    <span style={{ minWidth: 20, height: 20, border: `2px solid ${sel ? "#ef4444" : "#e2e8f0"}`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0, background: sel ? "#ef4444" : "#f1f5f9", marginTop: 1 }}>{sel ? "✓" : " "}</span>
                                    <span style={{ fontSize: 13, color: sel ? "#991b1b" : "#1e293b", fontWeight: sel ? 600 : 500, lineHeight: 1.4 }}>{choice}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {ngEmpty && <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 7, fontSize: 12, color: "#92400e", fontWeight: 600, textAlign: "center" }}>⚠ Wajib pilih kondisi NG, isi keterangan, atau tambah foto</div>}
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #fed7aa" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#92400e", marginBottom: 7 }}>✏️ Tambahan Lainnya <span style={{ fontWeight: 400, color: "#a16207", fontSize: 11 }}>(opsional)</span></label>
                              <textarea className="dci-ng-other-input" placeholder="Deskripsikan kondisi NG lainnya..." value={r.ngOtherNote || ""} onChange={e => handleDciOtherNoteChange(item.id, e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", border: "2px solid #e2e8f0", borderRadius: 8, fontFamily: "inherit", fontSize: 13, resize: "vertical" as any, outline: "none", boxSizing: "border-box" as any }} />
                            </div>
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #fed7aa" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#92400e", marginBottom: 7 }}>📷 Dokumentasi Foto <span style={{ fontWeight: 400, color: "#a16207", fontSize: 11 }}>(opsional)</span></label>
                              <NGPhotoUpload
                                photos={Array.isArray(r.ngPhotos) ? r.ngPhotos : []}
                                onPhotosChange={(photos) => handleDciPhotosChange(item.id, Array.isArray(photos) ? photos : [])}
                                onPhotoClick={handlePhotoZoom}
                                maxPhotos={3}
                              />
                            </div>
                            <button onClick={() => handleDciSaveAndClose(item.id)} disabled={ngEmpty} style={{ width: "100%", background: ngEmpty ? "#cbd5e1" : "#ef4444", color: ngEmpty ? "#94a3b8" : "white", border: "none", borderRadius: 10, padding: 13, fontSize: 13, fontWeight: 700, cursor: ngEmpty ? "not-allowed" : "pointer", marginTop: 10 }}>
                              {ngEmpty ? "Pilih kondisi NG terlebih dahulu" : `💾 SIMPAN CHECKLIST — ${(r.selectedNgChoices?.length ?? 0)} TEMUAN NG`}
                            </button>
                          </div>
                        )}
                        {isFilled && !isNg && (
                          <button onClick={() => handleDciSaveAndClose(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 16px 16px", padding: "14px 16px", background: "linear-gradient(135deg,#1e88e5,#1565c0)", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer", width: "calc(100% - 32px)", boxShadow: "0 3px 10px rgba(30,136,229,0.3)" }}>
                            💾 SIMPAN CHECKLIST
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

              ) : checklistItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 12, border: "2px dashed #cbd5e1" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{!navigator.onLine ? "📡" : "📋"}</div>
                  <p style={{ fontWeight: 600, color: "#1e293b", margin: "0 0 8px" }}>
                    {!navigator.onLine ? "Data belum tersedia offline" : "Tidak ada item checklist"}
                  </p>
                  <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
                    {!navigator.onLine
                      ? "Buka halaman ini saat online minimal sekali agar data tersimpan di cache."
                      : "Pastikan area, shift, dan tipe checklist sudah benar."}
                  </p>
                </div>

              ) : (
                // GL mode items
                checklistItems.map((item, index) => {
                  const result     = results[item.id];
                  const isExpanded = expandedItem === item.id;
                  const isFilled   = result?.status != null;
                  const isNg       = result?.status === "NG";
                  const isOk       = result?.status === "OK";
                  const hasPhotos  = (result?.ngPhotos?.length ?? 0) > 0;
                  const hasNotes   = !!(result?.notes?.trim());
                  const ngIncomplete = isNg && !hasPhotos && !hasNotes;

                  return (
                    <div key={item.id} style={{
                      background: "white", borderRadius: 12, padding: 18,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      borderTop: `2px solid ${isExpanded ? "#1e88e5" : ngIncomplete ? "#f59e0b" : "transparent"}`,
                      borderRight: `2px solid ${isExpanded ? "#1e88e5" : ngIncomplete ? "#f59e0b" : "transparent"}`,
                      borderBottom: `2px solid ${isExpanded ? "#1e88e5" : ngIncomplete ? "#f59e0b" : "transparent"}`,
                      borderLeft: isFilled ? `4px solid ${isOk ? "#22c55e" : "#ef4444"}` : `2px solid ${isExpanded ? "#1e88e5" : ngIncomplete ? "#f59e0b" : "transparent"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }} onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                        <div style={{ fontWeight: 700, color: "#1e88e5", fontSize: 16, minWidth: 28 }}>{index + 1}.</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{item.checkPoint}</h3>
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Standard: {item.metodeCheck}</p>
                          {isFilled && (
                            <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                              {isOk && <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>✓ OK</span>}
                              {isNg && <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: 20 }}>✗ NG</span>}
                              {hasPhotos && <span style={{ fontSize: 11, color: "#0284c7", background: "#e0f2fe", padding: "2px 8px", borderRadius: 20 }}>📷 {result.ngPhotos!.length} foto</span>}
                              {hasNotes && <span style={{ fontSize: 11, color: "#475569", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20 }}>📝 Keterangan</span>}
                              {ngIncomplete && <span style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", padding: "2px 8px", borderRadius: 20 }}>⚠️ Perlu keterangan/foto</span>}
                            </div>
                          )}
                        </div>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, background: isFilled ? (isOk ? "#22c55e" : "#ef4444") : "#e2e8f0", color: isFilled ? "white" : "#94a3b8" }}>{isFilled ? (isOk ? "✓" : "✗") : "○"}</span>
                        <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 4 }}>{isExpanded ? "▲" : "▼"}</button>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                            {(["OK", "NG"] as const).map(s => (
                              <div key={s} onClick={() => handleStatusChange(item.id, s)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", border: `2px solid ${result?.status === s ? (s === "OK" ? "#10b981" : "#ef4444") : "#e2e8f0"}`, borderRadius: 10, cursor: "pointer", background: result?.status === s ? (s === "OK" ? "#f0fdf4" : "#fef2f2") : "white", transition: "all .15s" }}>
                                <span style={{ width: 20, height: 20, border: `2px solid ${result?.status === s ? (s === "OK" ? "#10b981" : "#ef4444") : "#cbd5e1"}`, borderRadius: "50%", background: result?.status === s ? (s === "OK" ? "#10b981" : "#ef4444") : "transparent", flexShrink: 0 }} />
                                <span style={{ fontWeight: 700, fontSize: 15, color: result?.status === s ? (s === "OK" ? "#10b981" : "#ef4444") : "#1e293b" }}>{s}</span>
                                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>{s === "OK" ? "Kondisi Normal" : "Ada Masalah"}</span>
                              </div>
                            ))}
                          </div>

                          {isNg && (
                            <div style={{ background: "#fff7ed", border: `2px solid ${ngIncomplete ? "#f59e0b" : "#fed7aa"}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                              {ngIncomplete && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fef3c7", borderRadius: 8, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                                  <span>⚠️</span><span>Wajib isi keterangan atau tambahkan foto dokumentasi untuk item NG</span>
                                </div>
                              )}
                              <div>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 7 }}>
                                  ✏️ Keterangan NG <span style={{ fontWeight: 400, color: "#a16207", fontSize: 11 }}>(opsional jika ada foto)</span>
                                </label>
                                <textarea style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontFamily: "inherit", fontSize: 14, resize: "vertical" as any, boxSizing: "border-box" as any, outline: "none", minHeight: 72, transition: "border-color .15s" }}
                                  placeholder="Deskripsikan kondisi NG yang ditemukan..."
                                  value={result?.notes || ""}
                                  onChange={e => handleNotesChange(item.id, e.target.value)}
                                  onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                                  onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                                />
                              </div>
                              <div>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 7 }}>
                                  📷 Foto Dokumentasi <span style={{ fontWeight: 400, color: "#a16207", fontSize: 11 }}>(opsional jika ada keterangan)</span>
                                  {hasPhotos && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "#0284c7", color: "white", padding: "2px 8px", borderRadius: 20 }}>{result.ngPhotos!.length} foto</span>}
                                </label>
                                <NGPhotoUpload
                                  photos={result?.ngPhotos || []}
                                  onPhotosChange={(photos) => handleNotesPhotosChange(item.id, photos)}
                                  onPhotoClick={handlePhotoZoom}
                                  maxPhotos={3}
                                />
                              </div>
                            </div>
                          )}

                          {isOk && (
                            <div>
                              <label style={{ display: "block", fontWeight: 600, color: "#1e293b", marginBottom: 8, fontSize: 14 }}>Keterangan <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}>(Opsional)</span></label>
                              <textarea style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontFamily: "inherit", fontSize: 14, resize: "vertical" as any, boxSizing: "border-box" as any }}
                                placeholder="Masukkan keterangan tambahan (opsional)"
                                value={result?.notes || ""}
                                onChange={e => handleNotesChange(item.id, e.target.value)}
                                rows={2}
                              />
                            </div>
                          )}

                          {!isFilled && <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>Pilih status OK atau NG di atas</p>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── Submit button ─────────────────────────────────────────────── */}
        {!isDailyInspector && (
          <div className="submit-bar">
            <div className="submit-inner">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isLoading || isResolvingArea}
                className={`submit-btn ${!hasLocation && navigator.onLine ? "disabled" : ""}`}
              >
                {isResolvingArea && navigator.onLine
                  ? "⏳ Memverifikasi area..."
                  : isSubmitting
                  ? <><span className="spin-dot" /> Menyimpan...</>
                  : !hasLocation && navigator.onLine
                  ? "⚠️ Data belum lengkap"
                  : `💾 SIMPAN CHECKLIST${completedCount > 0 ? ` (${completedCount} item)` : ""}`}
              </button>
              {completedCount > 0 && (
                <p className="submit-hint">{totalCount - completedCount} item belum diisi</p>
              )}
            </div>
          </div>
        )}
      </main>

      {progressModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.72)", zIndex: 9995, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setProgressModalOpen(false)}>
          <div style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", background: "white", borderRadius: 18, boxShadow: "0 25px 60px rgba(15,23,42,0.24)", padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Detail Progress</h2>
                <p style={{ margin: "8px 0 0", color: "#475569", fontSize: 13 }}>Spesifik area: <strong>{selectedSpecificArea || "-"}</strong></p>
                <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 13 }}>{completedCount} dari {totalCount} item sudah terisi</p>
              </div>
              <button onClick={() => setProgressModalOpen(false)} style={{ border: "none", background: "transparent", color: "#475569", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {progressDetails.map(detail => (
                <div key={detail.id} style={{ background: "#f8fafc", borderRadius: 14, padding: 16, border: detail.isCompleted ? "1px solid #10b981" : "1px solid #cbd5e1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{detail.statusIcon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{detail.itemCheck}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>{detail.statusLabel}</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, background: "white", border: "1px solid #e2e8f0" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#475569" }}><strong>Gauge:</strong> {detail.gaugeId ?? "Belum dicheck"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal */}
      {duplicateWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setDuplicateWarning(null)}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", padding: "18px 22px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div><p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>Item Sudah Pernah Di-Check</p><p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.85)" }}>Peringatan duplikasi checklist</p></div>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>Item:</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b", padding: "8px 12px", background: "white", borderRadius: 8 }}>{duplicateWarning.itemCheck}</p>
              </div>
              <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#991b1b", fontWeight: 700 }}>✗ Sudah di-check di:</p>
                {duplicateWarning.duplicateLocations.map((loc, i) => <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", background: "white", borderRadius: 8, border: "1px solid #fecaca", marginBottom: 4 }}><span style={{ color: "#ef4444" }}>📍</span><span style={{ fontSize: 13, color: "#1e293b" }}>{loc}</span></div>)}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", textAlign: "center" }}>Setiap item hanya boleh di-check <strong>1 kali per hari per shift</strong>.</p>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10 }}>
              <button onClick={() => setDuplicateWarning(null)} style={{ flex: 1, padding: "11px 16px", background: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Batalkan</button>
              <button onClick={duplicateWarning.onConfirm} style={{ flex: 1, padding: "11px 16px", background: "#f59e0b", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Tetap Lanjut →</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo zoom modal */}
      {photoZoomSrc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={handleClosePhotoZoom}>
          <div style={{ position: "relative", maxWidth: "95vw", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <button onClick={handleClosePhotoZoom} style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, background: "#ef4444", color: "white", border: "3px solid white", borderRadius: "50%", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕</button>
            {photoZoomLoading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", borderRadius: 10 }}>
                <div style={{ color: "white", fontSize: 16 }}>⏳ Memuat gambar...</div>
              </div>
            )}
            <img
              src={`${photoZoomSrc}?t=${Date.now()}`}
              alt="Foto NG"
              style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 10, objectFit: "contain", display: photoZoomLoading ? "none" : "block" }}
              onLoad={() => setPhotoZoomLoading(false)}
              onError={(e) => { setPhotoZoomLoading(false); e.currentTarget.style.display = "none"; }}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes scanline { 0%,100%{transform:translateY(-38px);opacity:0}10%{opacity:1}90%{opacity:1}50%{transform:translateY(38px)} }

        .main-content { margin-left:80px; padding:20px; min-height:100vh; background:#f5f7fa; }
        .header-section { background:linear-gradient(135deg,#1e88e5,#1565c0); color:white; padding:16px 20px; border-radius:12px; margin-bottom:20px; display:flex; align-items:center; gap:16px; box-shadow:0 4px 12px rgba(30,136,229,0.2); }
        .back-button { position:fixed; top:16px; left:86px; background:rgba(30,136,229,0.15); border:none; color:#1e88e5; width:40px; height:40px; border-radius:8px; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; z-index:50; }
        .page-title  { flex:1; margin:0; font-size:20px; font-weight:700; }
        .header-actions { display:flex; gap:8px; }
        .icon-button { background:rgba(255,255,255,0.2); border:none; color:white; width:40px; height:40px; border-radius:8px; cursor:pointer; font-size:18px; }
        .info-card   { background:white; border-radius:12px; padding:16px 20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .info-row    { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0; }
        .info-row:last-child { border-bottom:none; }
        .info-label  { font-weight:600; color:#64748b; font-size:14px; }
        .info-value  { color:#1e293b; font-weight:500; font-size:14px; }
        .area-value  { color:#1e88e5; font-weight:700; }
        .progress-card   { background:white; border-radius:12px; padding:16px 20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .progress-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .progress-text   { font-weight:600; color:#1e293b; font-size:14px; }
        .progress-percent{ font-weight:700; color:#1e88e5; font-size:16px; }
        .progress-bar    { width:100%; height:10px; background:#e2e8f0; border-radius:10px; overflow:hidden; }
        .progress-fill   { height:100%; background:linear-gradient(90deg,#1e88e5,#42a5f5); border-radius:10px; transition:width .3s ease; }
        .success-banner  { background:#f0fdf4; border:1px solid #86efac; border-left:4px solid #22c55e; border-radius:8px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; color:#166534; font-size:14px; font-weight:500; }
        .error-banner    { background:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; border-radius:8px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; }
        .shift-dropdown  { padding:7px 32px 7px 12px; border:2px solid #1e88e5; border-radius:8px; font-size:13px; font-weight:600; color:#1565c0; background:#eff6ff; cursor:pointer; outline:none; appearance:none; }
        .dropdown-badge  { font-size:10px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; }
        .dropdown-badge.gl  { background:#f3e5f5; color:#7b1fa2; }
        .dropdown-badge.ins { background:#e0f2fe; color:#0277bd; }
        .loading-page    { display:flex; align-items:center; justify-content:center; min-height:100vh; font-size:16px; color:#64748b; }
        .spin-dot        { width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:spin .8s linear infinite; display:inline-block; }

        .submit-bar {
          position:fixed; bottom:0;
          left:80px; right:0;
          background:white; padding:12px 20px;
          padding-bottom:calc(12px + env(safe-area-inset-bottom, 0px));
          box-shadow:0 -4px 16px rgba(0,0,0,0.10); z-index:100;
        }
        .submit-inner { max-width:800px; margin:0 auto; }
        .submit-btn {
          width:100%; display:flex; align-items:center; justify-content:center;
          gap:8px; padding:15px 24px;
          background:linear-gradient(135deg,#1e88e5,#1565c0);
          color:white; border:none; border-radius:12px;
          font-size:15px; font-weight:700; cursor:pointer;
          box-shadow:0 4px 12px rgba(30,136,229,0.3); transition:opacity .2s,background .2s;
        }
        .submit-btn.disabled { background:#94a3b8; box-shadow:none; cursor:not-allowed; }
        .submit-btn:disabled  { opacity:0.65; cursor:not-allowed; }
        .submit-hint { text-align:center; font-size:12px; color:#64748b; margin:6px 0 0; }

        @media (max-width:768px) {
          .main-content { margin-left:0; padding:12px; }
          .back-button  { left:8px; }
          .submit-bar   { left:0; }
        }
      `}</style>
    </>
  );
}