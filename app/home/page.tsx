// app/home/page.tsx
// UPDATED: Pisahkan flow selector berdasarkan categoryCode:
//   - "final-assy-gl"       → ConveyorOnlySelector (hanya Conveyor, tanpa Pattern/SpesifikArea)
//   - "final-assy-inspector"→ ConveyorPatternSelector (Conveyor + Pattern + SpesifikArea)
//   - Lainnya               → Langsung redirect tanpa selector

"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter }    from "next/navigation";
import { Sidebar }      from "@/components/Sidebar";  
import { useAuth }      from "@/lib/auth-context";
import { ConveyorPatternSelector } from "@/components/ConveyorPatternSelector";
import { ConveyorOnlySelector }   from "@/components/ConveyorOnlySelector";
import { saveCache, getCache }    from "@/lib/offline/cache";

// ── Hook: sync lebar sidebar secara real-time ───────────────────────────────
// Mendengarkan CustomEvent "sidebar-toggle" yang di-dispatch oleh Sidebar
// setiap kali user klik toggle. Tidak pakai polling — zero lag, zero drift.
//
// Lebar:
//   Desktop collapsed  → 70px
//   Desktop expanded   → 240px
//   Mobile (semua)     → 0px  (sidebar overlay, konten tidak bergeser)
function useSidebarWidth(): number {
  const computeWidth = (expanded?: boolean): number => {
    if (typeof window === "undefined") return 70;
    const mobile = window.innerWidth <= 768;
    if (mobile) return 0;
    const isExp = expanded ?? (localStorage.getItem("sidebar-expanded") === "true");
    return isExp ? 240 : 70;
  };

  const [width, setWidth] = useState<number>(() => computeWidth());

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── Listener utama: CustomEvent dari Sidebar ──────────────────────────
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail as { expanded: boolean; isMobile: boolean };
      // Mobile: sidebar overlay → tidak geser konten
      if (detail.isMobile || window.innerWidth <= 768) {
        setWidth(0);
        return;
      }
      setWidth(detail.expanded ? 240 : 70);
    };
    window.addEventListener("sidebar-toggle", onToggle);

    // ── Fallback: resize window → recalculate ─────────────────────────────
    const onResize = () => setWidth(computeWidth());
    window.addEventListener("resize", onResize);

    // ── Inisialisasi saat mount (baca localStorage) ───────────────────────
    setWidth(computeWidth());

    return () => {
      window.removeEventListener("sidebar-toggle", onToggle);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return width;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: number;
  category_name: string;
  category_code: string;
  table_type: string;
  area_type: string;
  sort_order: number;
}

interface ActivityItem {
  title: string;
  user: string;
  time: string;
  status: "OK" | "NG";
}

// ─── Routing map ──────────────────────────────────────────────────────────────
const CATEGORY_ROUTE: Record<string, string> = {
  "final-assy-gl":              "/checksheet-final-assy",
  "final-assy-inspector":       "/checksheet-final-assy",
  "pre-assy-daily-gl":          "/checksheet-pre-assy",
  "pre-assy-daily-check-ins":   "/checksheet-pre-assy",
  "pre-assy-call-check-gl":     "/checksheet-pre-assy",
  "pre-assy-control-remove":    "/checksheet-pre-assy",
  "pre-assy-pressure-jig":      "/checksheet-pre-assy",
};

// ── Kategorisasi selector ─────────────────────────────────────────────────────
// "inspector" → ConveyorPatternSelector (Conveyor + Pattern + SpesifikArea)
// "gl"        → ConveyorOnlySelector   (Conveyor saja)
// null        → langsung redirect (tidak butuh selector tambahan)
type SelectorMode = "inspector" | "gl" | null;

function getSelectorMode(categoryCode: string): SelectorMode {
  if (categoryCode === "final-assy-inspector") return "inspector";
  if (categoryCode === "final-assy-gl")        return "gl";
  return null;
}

// Warna kartu per category_code
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  "final-assy-gl":            { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", icon: "👔" },
  "final-assy-inspector":     { bg: "#f5f3ff", border: "#7c3aed", text: "#5b21b6", icon: "🔍" },
  "pre-assy-daily-gl":        { bg: "#f0fdf4", border: "#22c55e", text: "#166534", icon: "👔" },
  "pre-assy-daily-check-ins": { bg: "#fefce8", border: "#eab308", text: "#713f12", icon: "🔍" },
  "pre-assy-call-check-gl":   { bg: "#fff7ed", border: "#f97316", text: "#7c2d12", icon: "📞" },
  "pre-assy-control-remove":  { bg: "#fdf2f8", border: "#d946ef", text: "#701a75", icon: "🔧" },
  "pre-assy-pressure-jig":    { bg: "#f0f9ff", border: "#0ea5e9", text: "#075985", icon: "⚙️" },
};
function getCategoryColor(code: string) {
  return CATEGORY_COLORS[code] ?? { bg: "#f8fafc", border: "#94a3b8", text: "#475569", icon: "📋" };
}

// ─── Resolve areaCode from areaName via API ───────────────────────────────────
async function resolveAreaCode(areaName: string, categoryCode: string): Promise<string | null> {
  const norm = areaName.trim().toLowerCase();

  const findInList = (list: any[]): string | null => {
    const found = list.find((a: any) => a.area_name?.trim().toLowerCase() === norm);
    return found?.area_code ?? null;
  };

  // Offline: langsung pakai cache, skip fetch
  if (!navigator.onLine) {
    const cached = await getCache("areas:list");
    return cached ? findInList(cached) : null;
  }

  // Online: fetch → saveCache
  try {
    const res  = await fetch(`/api/admin/areas?categoryCode=${encodeURIComponent(categoryCode)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) throw new Error("invalid response");
    await saveCache("areas:list", data.data);
    return findInList(data.data);
  } catch {
    // Fetch gagal → fallback ke cache
    const cached = await getCache("areas:list");
    return cached ? findInList(cached) : null;
  }
}

// ─── Detect plain-area QR ────────────────────────────────────────────────────
function isAreaQR(raw: string): boolean {
  if (!raw) return false;
  if (raw.startsWith("/"))                        return false;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return false;
  if (raw.toUpperCase().startsWith("CHECKLIST:")) return false;
  if (raw.toUpperCase().startsWith("DCI-"))       return false;
  return raw.length >= 3 && !raw.includes("?") && !raw.includes("=");
}

// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, isInitialized } = useAuth();

  // ── Sidebar width untuk push layout ─────────────────────────────────────
  const sidebarWidth = useSidebarWidth();

  // ── Category state ────────────────────────────────────────────────────────
  const [categories, setCategories]               = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory]   = useState<Category | null>(null);
  const [scanReady, setScanReady]                 = useState(false);

  // ── Scanner state ─────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState("");
  const [lastScan, setLastScan]     = useState("");
  const [debugLog, setDebugLog]     = useState<string[]>([]);
  const [showDebug, setShowDebug]   = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // ── Pending state — berlaku untuk KEDUA mode selector ─────────────────────
  const [pendingAreaName, setPendingAreaName]   = useState<string | null>(null);
  const [resolvedAreaCode, setResolvedAreaCode] = useState<string | null>(null);
  const [isResolvingArea, setIsResolvingArea]   = useState(false);

  // ── Selector mode yang aktif ──────────────────────────────────────────────
  // "inspector" → ConveyorPatternSelector, "gl" → ConveyorOnlySelector, null → tidak ada
  const [activeSelectorMode, setActiveSelectorMode] = useState<SelectorMode>(null);

  // ── Activity ──────────────────────────────────────────────────────────────
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("id-ID");
    setDebugLog(prev => [`${ts} | ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // Auth guard
  useEffect(() => {
    if (isInitialized && !authLoading && !user) router.push("/login-page");
  }, [user, authLoading, isInitialized, router]);

  // Fetch categories
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch("/api/admin/categories");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) setCategories(data.data);
      } catch (e) { console.error("categories fetch:", e); }
      finally { setCategoriesLoading(false); }
    };
    load();
  }, []);

  // Preload conveyors ke cache saat online — agar tersedia saat pertama kali offline
  useEffect(() => {
    if (!navigator.onLine) return;
    fetch("/api/conveyors")
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.conveyors) && data.conveyors.length > 0)
          saveCache("conveyors:list", data.conveyors);
      })
      .catch(() => { /* ignore — tidak perlu error, ini preload saja */ });
  }, []);

  // Preload areas ke cache saat online — agar resolveAreaCode tetap bekerja saat offline
  useEffect(() => {
    if (!navigator.onLine) return;
    fetch("/api/admin/areas")
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0)
          saveCache("areas:list", data.data);
      })
      .catch(() => { /* ignore — preload saja */ });
  }, []);

  // Prefetch halaman checksheet agar navigasi tetap bisa saat offline
  const [isPrefetchReady, setIsPrefetchReady] = useState(false);
  useEffect(() => {
    if (!navigator.onLine) { setIsPrefetchReady(true); return; }
    const prefetchPages = async () => {
      await router.prefetch("/checksheet-final-assy");
      await router.prefetch("/status-final-assy");
      setIsPrefetchReady(true);
    };
    prefetchPages();
  }, [router]);

  // Recent activities
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("checksheet_history") || "[]");
      if (!Array.isArray(h)) return;
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      setActivities(
        h.filter((i: any) => { const d = new Date(i.filledAt); return d >= start && d < end; })
         .sort((a: any, b: any) => new Date(b.filledAt).getTime() - new Date(a.filledAt).getTime())
         .slice(0, 3)
         .map((i: any) => ({
           title:  String(i.area || "Checklist Tanpa Nama"),
           user:   String(i.filledBy || "Unknown"),
           time:   new Date(i.filledAt).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" }),
           status: (i.status === "NG" ? "NG" : "OK") as "OK"|"NG",
         }))
      );
    } catch {}
  }, []);

  // ── Build redirect URL ────────────────────────────────────────────────────
  const buildRedirectUrl = useCallback((
    category: Category,
    areaName: string,
    areaCode: string | null,
    extras?: { conveyor?: string; pattern?: string; specificArea?: string }
  ): string => {
    const basePath =
      CATEGORY_ROUTE[category.category_code] ??
      (category.area_type === "final-assy" ? "/checksheet-final-assy" : "/checksheet-pre-assy");

    const qp = new URLSearchParams();
    qp.set("categoryCode", category.category_code);
    qp.set("areaName",     areaName);
    qp.set("fromQR",       "1");
    if (areaCode) qp.set("areaCode", areaCode);
    if (extras?.conveyor)     qp.set("conveyor",     extras.conveyor);
    if (extras?.pattern)      qp.set("pattern",      extras.pattern);
    if (extras?.specificArea) qp.set("specificArea", extras.specificArea);
    return `${basePath}?${qp.toString()}`;
  }, []);

  // ── Trigger resolver saat pending area di-set ────────────────────────────
  const triggerAreaResolve = useCallback((areaName: string, category: Category) => {
    setPendingAreaName(areaName);
    setResolvedAreaCode(null);
    setIsResolvingArea(true);
    resolveAreaCode(areaName, category.category_code)
      .then(code => { addLog(`→ resolved: "${code}"`); setResolvedAreaCode(code); })
      .catch(() => {})
      .finally(() => setIsResolvingArea(false));
  }, [addLog]);

  // ── processQRCode ─────────────────────────────────────────────────────────
  const processQRCode = useCallback(async (raw: string) => {
    const data = raw.trim().replace(/[\x00-\x1F\x7F]/g, "");
    addLog(`SCAN: "${data}"`);
    setLastScan(data);
    if (!user) { router.push("/login-page"); return; }
    if (!data) return;

    // — Legacy formats —
    if (data.startsWith("/")) {
      addLog("→ path langsung"); router.push(data); return;
    }
    if (data.startsWith("http://") || data.startsWith("https://")) {
      addLog("→ URL");
      try { const u = new URL(data); router.push(u.pathname + u.search); }
      catch { const m = data.match(/https?:\/\/[^/]+(\/.*)/); if (m) router.push(m[1]); }
      return;
    }
    if (data.toUpperCase().startsWith("CHECKLIST:")) {
      addLog("→ CHECKLIST:");
      const parts = data.split(":");
      if (parts.length >= 4) {
        const cat  = parts[1].toUpperCase();
        const area = parts[3];
        const path = cat === "FINAL-ASSY" ? "/checksheet-final-assy" : "/checksheet-pre-assy";
        router.push(`${path}?areaCode=${encodeURIComponent(area)}`);
      }
      return;
    }

    // — Format baru: plain-text "Nama Area" —
    if (isAreaQR(data)) {
      if (!selectedCategory) {
        addLog("❌ Kategori belum dipilih");
        alert("⚠️ Pilih kategori checksheet terlebih dahulu sebelum scan QR.");
        return;
      }

      const mode = getSelectorMode(selectedCategory.category_code);
      addLog(`→ Area QR | cat="${selectedCategory.category_code}" mode="${mode ?? "direct"}"`);

      // ── Flow 1: Inspector Final Assy → ConveyorPatternSelector ───────────
      if (mode === "inspector") {
        addLog("→ Flow: inspector → ConveyorPatternSelector");
        setActiveSelectorMode("inspector");
        triggerAreaResolve(data, selectedCategory);
        return;
      }

      // ── Flow 2: GL Final Assy → ConveyorOnlySelector ─────────────────────
      if (mode === "gl") {
        addLog("→ Flow: GL → ConveyorOnlySelector");
        setActiveSelectorMode("gl");
        triggerAreaResolve(data, selectedCategory);
        return;
      }

      // ── Flow 3: Semua kategori lain → langsung redirect ───────────────────
      addLog("→ Flow: kategori lain → langsung redirect");
      const code = await resolveAreaCode(data, selectedCategory.category_code);
      const url  = buildRedirectUrl(selectedCategory, data, code);
      addLog(`→ redirect: ${url}`);
      router.push(url);
      return;
    }

    addLog(`❌ Format tidak dikenali`);
    alert(`Format QR tidak dikenali:\n"${data}"`);
  }, [user, router, addLog, selectedCategory, buildRedirectUrl, triggerAreaResolve]);

  // ── ConveyorPatternSelector handler (Inspector) ───────────────────────────
  const handleInspectorConfirm = useCallback((result: {
    conveyor: string; pattern: string; specificArea: string;
  }) => {
    if (!pendingAreaName || !selectedCategory) return;
    const url = buildRedirectUrl(selectedCategory, pendingAreaName, resolvedAreaCode, result);
    setPendingAreaName(null);
    setResolvedAreaCode(null);
    setActiveSelectorMode(null);
    router.push(url);
  }, [pendingAreaName, selectedCategory, resolvedAreaCode, buildRedirectUrl, router]);

  // ── ConveyorOnlySelector handler (GL) ────────────────────────────────────
  const handleGLConfirm = useCallback((result: { conveyor: string }) => {
    if (!pendingAreaName || !selectedCategory) return;
    const url = buildRedirectUrl(selectedCategory, pendingAreaName, resolvedAreaCode, {
      conveyor: result.conveyor,
      // GL tidak menggunakan pattern dan specificArea
    });
    setPendingAreaName(null);
    setResolvedAreaCode(null);
    setActiveSelectorMode(null);
    router.push(url);
  }, [pendingAreaName, selectedCategory, resolvedAreaCode, buildRedirectUrl, router]);

  // ── Cancel handler (berlaku untuk kedua selector) ─────────────────────────
  const handleSelectorCancel = useCallback(() => {
    setPendingAreaName(null);
    setResolvedAreaCode(null);
    setIsResolvingArea(false);
    setActiveSelectorMode(null);
  }, []);

  // ── Scanner focus ─────────────────────────────────────────────────────────
  const refocusInput = useCallback(() => {
    if (activeSelectorMode) return;  // jangan rebut fokus saat selector terbuka
    hiddenInputRef.current?.focus({ preventScroll: true });
  }, [activeSelectorMode]);

  useEffect(() => {
    if (!scanReady) return;
    const t = setTimeout(() => hiddenInputRef.current?.focus({ preventScroll: true }), 300);
    return () => clearTimeout(t);
  }, [scanReady]);

  const handleScannerInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      const cur = hiddenInputRef.current?.value || "";
      if (cur.trim().length > 2) processQRCode(cur);
      setInputValue("");
      if (hiddenInputRef.current) hiddenInputRef.current.value = "";
      refocusInput();
    }, 800);
  }, [processQRCode, refocusInput]);

  const handleScannerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      const val = hiddenInputRef.current?.value || "";
      if (val.trim().length > 2) processQRCode(val);
      setInputValue("");
      if (hiddenInputRef.current) hiddenInputRef.current.value = "";
      setTimeout(refocusInput, 100);
    }
  }, [processQRCode, refocusInput]);

  // ── Category select / back ────────────────────────────────────────────────
  const handleCategorySelect = useCallback((cat: Category) => {
    setSelectedCategory(cat);
    setScanReady(true);
    setPendingAreaName(null);
    setResolvedAreaCode(null);
    setIsResolvingArea(false);
    setActiveSelectorMode(null);
    setInputValue("");
  }, []);

  const handleBackToCategories = useCallback(() => {
    setSelectedCategory(null);
    setScanReady(false);
    setPendingAreaName(null);
    setResolvedAreaCode(null);
    setIsResolvingArea(false);
    setActiveSelectorMode(null);
    setInputValue("");
  }, []);

  const dashboardLink = (() => {
    switch (user?.role) {
      case "inspector-ga":    return "/ga-dashboard";
      case "inspector-qa":    return "/qa-dashboard";
      case "group-leader-qa": return "/gl-dashboard";
      default:                return "/dashboard";
    }
  })();

  if (authLoading || !isInitialized) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8fafc" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:44, height:44, border:"3px solid #e2e8f0", borderTopColor:"#3b82f6", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:"#64748b", fontSize:14 }}>Memuat...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!user) return null;

  const userName = user.fullName || user.username || "User";

  // ── Helper: deskripsi flow per kategori ──────────────────────────────────
  const getFlowDescription = (cat: Category): React.ReactNode => {
    const mode = getSelectorMode(cat.category_code);
    if (mode === "inspector") {
      return <>QR berisi <strong>Nama Area</strong> — lalu pilih Conveyor, Pattern &amp; Spesifik Area.</>;
    }
    if (mode === "gl") {
      return <>QR berisi <strong>Nama Area</strong> — lalu pilih Conveyor.</>; 
    }
    return <>QR berisi <strong>Nama Area</strong> — akan langsung masuk ke halaman checklist.</>;
  };

  const getFlowSteps = (cat: Category): string[] => {
    const mode = getSelectorMode(cat.category_code);
    if (mode === "inspector") return ["📷 Scan QR", "→", "🏭 Conveyor", "→", "🔖 Pattern", "→", "🔍 Spesifik Area", "→", "✅ Mulai"];
    if (mode === "gl")        return ["📷 Scan QR", "→", "🏭 Conveyor", "→", "✅ Mulai GL"];
    return ["📷 Scan QR", "→", "✅ Langsung Masuk Checklist"];
  };

  return (
    <>
      <Sidebar userName={userName} />

      {/* Hidden scanner input */}
      <input
        ref={hiddenInputRef}
        type="text" value={inputValue}
        onChange={handleScannerInput}
        onKeyDown={handleScannerKeyDown}
        onBlur={() => { if (!activeSelectorMode && scanReady) setTimeout(refocusInput, 150); }}
        inputMode="none"
        style={{ position:"fixed", top:0, left:0, width:1, height:1, opacity:0, pointerEvents:"none", zIndex:-1 }}
        aria-hidden="true" tabIndex={-1}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      />

      {/* ── Selector: Inspector → ConveyorPatternSelector ─────────────────── */}
      {activeSelectorMode === "inspector" && pendingAreaName && selectedCategory && (
        <ConveyorPatternSelector
          areaName={pendingAreaName}
          areaCode={resolvedAreaCode ?? ""}
          onConfirm={handleInspectorConfirm}
          onCancel={handleSelectorCancel}
        />
      )}

      {/* ── Selector: GL → ConveyorOnlySelector ───────────────────────────── */}
      {activeSelectorMode === "gl" && pendingAreaName && selectedCategory && (
        <ConveyorOnlySelector
          areaName={pendingAreaName}
          areaCode={resolvedAreaCode ?? ""}
          categoryCode={selectedCategory.category_code}
          onConfirm={handleGLConfirm}
          onCancel={handleSelectorCancel}
        />
      )}

      <main
        className="home-main"
        style={{ marginLeft: sidebarWidth }}
        onClick={() => { if (scanReady && !activeSelectorMode) refocusInput(); }}
      >
        <div className="home-inner">
        {/* ── Welcome banner ─────────────────────────────────────────── */}
        <div className="welcome-banner">
          <div>
            <h1 className="welcome-title">👋 Halo, {userName}!</h1>
            <p className="welcome-text">Pilih kategori checksheet, lalu scan QR Code area untuk memulai.</p>
          </div>
          <div className="welcome-ilu" aria-hidden="true">
            <svg width="110" height="80" viewBox="0 0 200 150" fill="none">
              <circle cx="100" cy="75" r="60" fill="#EDE9FE" opacity="0.5"/>
              <circle cx="100" cy="75" r="40" fill="#A78BFA" opacity="0.3"/>
              <path d="M80 75L95 90L120 60" stroke="#8B5CF6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* ── PHASE 1: Pilih Kategori ──────────────────────────────────── */}
        {!scanReady && (
          <section className="section">
            <div className="section-hdr">
              <div>
                <h2 className="section-title">📋 Pilih Kategori Checksheet</h2>
                <p className="section-desc">Tap kategori yang ingin diperiksa</p>
              </div>
            </div>

            {categoriesLoading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ height:64, background:"#f1f5f9", borderRadius:12, opacity:1-i*0.12 }} />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", background:"white", borderRadius:12, border:"2px dashed #e2e8f0" }}>
                <p style={{ color:"#64748b", fontSize:14 }}>Tidak ada kategori tersedia.</p>
              </div>
            ) : (
              <div className="cat-grid">
                {categories.map(cat => {
                  const c    = getCategoryColor(cat.category_code);
                  const mode = getSelectorMode(cat.category_code);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat)}
                      style={{ background:c.bg, border:`2px solid ${c.border}`, color:c.text }}
                      className="cat-card"
                    >
                      <span className="cat-icon">{c.icon}</span>
                      <div className="cat-info">
                        <span className="cat-name">{cat.category_name}</span>
                        <span className="cat-meta">
                          {cat.area_type === "final-assy" ? "Final Assembly" : "Pre Assembly"}
                          {" · "}
                          {cat.table_type === "inspector" ? "Inspector" : "Group Leader"}
                          {/* Badge penanda tipe filter */}
                          {mode === "inspector" && (
                            <span style={{ marginLeft:6, fontSize:10, fontWeight:700, background:"#7c3aed", color:"white", padding:"1px 6px", borderRadius:20, verticalAlign:"middle" }}>
                              + Conveyor & Pattern
                            </span>
                          )}
                          {mode === "gl" && (
                            <span style={{ marginLeft:6, fontSize:10, fontWeight:700, background:"#1e88e5", color:"white", padding:"1px 6px", borderRadius:20, verticalAlign:"middle" }}>
                              + Conveyor
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="cat-arrow" style={{ color:c.border }}>›</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── PHASE 2: Scan QR ──────────────────────────────────────────── */}
        {scanReady && selectedCategory && (
          <section className="section">
            {/* Active category chip + back */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <button onClick={handleBackToCategories} className="back-btn">← Kembali</button>
              <div className="active-cat-chip" style={{
                background: getCategoryColor(selectedCategory.category_code).bg,
                border: `2px solid ${getCategoryColor(selectedCategory.category_code).border}`,
              }}>
                <span>{getCategoryColor(selectedCategory.category_code).icon}</span>
                <span style={{
                  color: getCategoryColor(selectedCategory.category_code).text,
                  fontSize:12, fontWeight:700,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{selectedCategory.category_name}</span>
              </div>
            </div>

            {/* Scanner card */}
            <div className="scanner-card">
              <div className="scanner-icon-box">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/>
                  <line x1="9" y1="9" x2="9" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <div className="scanner-body">
                <h2 className="scanner-title">📷 Scan QR Code Area</h2>
                <p className="scanner-desc">
                  Arahkan scanner TC21 ke QR Code di area kerja.{" "}
                  {getFlowDescription(selectedCategory)}
                </p>

                {/* Flow indicator */}
                <div className="flow-row">
                  {getFlowSteps(selectedCategory).map((s, i) => (
                    <span key={i} className={s === "→" ? "flow-arrow" : "flow-step"}>{s}</span>
                  ))}
                </div>

                <div className="scanner-status">
                  <span className={`dot ${inputValue || isResolvingArea ? "active" : "idle"}`} />
                  <span className="status-txt">
                    {isResolvingArea
                      ? "Memverifikasi area..."
                      : inputValue
                      ? `Scanning... "${inputValue}"`
                      : "Scanner siap — arahkan TC21 ke QR Code"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Aktivitas Terbaru ─────────────────────────────────────────── */}
        <section className="section">
          <div className="section-hdr">
            <div>
              <h2 className="section-title">🕐 Aktivitas Terbaru</h2>
              <p className="section-desc">Checklist yang baru saja diselesaikan hari ini</p>
            </div>
            <a href={dashboardLink} className="view-all">Lihat Semua →</a>
          </div>
          <div className="activity-list">
            {activities.length > 0 ? activities.map((act, i) => (
              <div key={i} className="act-item">
                <div className={`act-icon ${act.status==="OK"?"ok":"ng"}`}>{act.status==="OK"?"✓":"✗"}</div>
                <div className="act-content">
                  <p className="act-title">{act.title}</p>
                  <p className="act-sub">Diselesaikan oleh {act.user}</p>
                </div>
                <div className="act-meta">
                  <span className="act-time">{act.time}</span>
                  <span className={`act-badge ${act.status==="OK"?"ok":"ng"}`}>{act.status}</span>
                </div>
              </div>
            )) : (
              <p className="empty-act">Belum ada aktivitas checklist hari ini.</p>
            )}
          </div>
        </section>
      {/* Debug panel */}
      {showDebug && (
        <div className="dbg-panel">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:"#38bdf8", fontWeight:700, fontSize:13 }}>🔍 Scanner Debug</span>
            <div style={{ display:"flex", gap:6 }}>
              <button className="dbg-btn" onClick={() => { setDebugLog([]); setLastScan(""); }}>Clear</button>
              <button className="dbg-btn" onClick={() => setShowDebug(false)}>✕</button>
            </div>
          </div>
          {selectedCategory && (
            <div className="dbg-row">
              <span className="dbg-lbl">KATEGORI</span>
              <code style={{ color:"#a78bfa", fontSize:11 }}>{selectedCategory.category_code}</code>
              <code style={{ color:"#64748b", fontSize:10 }}>
                {getSelectorMode(selectedCategory.category_code) === "inspector" ? "→ inspector (Conveyor+Pattern+Area)" :
                 getSelectorMode(selectedCategory.category_code) === "gl"        ? "→ GL (Conveyor only)" :
                 "→ langsung redirect"}
              </code>
            </div>
          )}
          {lastScan && (
            <div className="dbg-row">
              <span className="dbg-lbl">LAST SCAN</span>
              <code style={{ color:"#67e8f9", fontSize:11, wordBreak:"break-all" }}>{lastScan}</code>
            </div>
          )}
          {pendingAreaName && (
            <div className="dbg-row">
              <span className="dbg-lbl">PENDING AREA</span>
              <code style={{ color:"#fbbf24", fontSize:11 }}>{pendingAreaName}</code>
              <code style={{ color:"#64748b", fontSize:10 }}>mode={activeSelectorMode ?? "none"}</code>
            </div>
          )}
          <div style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:1 }}>
            {debugLog.length === 0
              ? <span style={{ color:"#475569", fontSize:11 }}>Scan QR untuk melihat log...</span>
              : debugLog.map((l, i) => (
                <div key={i} style={{
                  fontSize:10, padding:"2px 4px", wordBreak:"break-all",
                  color: l.includes("GL →") ? "#60a5fa"
                       : l.includes("inspector →") ? "#f59e0b"
                       : l.includes("kategori lain →") ? "#4ade80"
                       : l.includes("❌") ? "#f87171"
                       : "#94a3b8",
                }}>{l}</div>
              ))}
          </div>
        </div>
      )}
      </div>{/* end .home-inner */}
      </main>

      <button className="dbg-toggle" onClick={() => setShowDebug(d => !d)}>{showDebug ? "✕" : "🔍"}</button>

      <style jsx>{`
        .home-main{padding:28px 32px 56px;min-height:100vh;background:#f8fafc;transition:margin-left 0.3s ease;}
        .home-inner{max-width:1200px;margin:0 auto;}
        .welcome-banner{background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;box-shadow:0 4px 12px rgba(102,126,234,0.25);gap:16px;}
        .welcome-title{font-size:22px;font-weight:700;color:white;margin:0 0 6px;}
        .welcome-text{font-size:13px;color:rgba(255,255,255,0.9);margin:0;line-height:1.5;}
        .welcome-ilu{flex-shrink:0;}
        .section{margin-bottom:28px;}
        .section-hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;gap:10px;}
        .section-title{font-size:18px;font-weight:700;color:#1a202c;margin:0 0 4px;}
        .section-desc{font-size:13px;color:#718096;margin:0;}
        .view-all{color:#8b5cf6;text-decoration:none;font-size:13px;font-weight:600;padding:7px 14px;border-radius:8px;transition:background .2s;}
        .view-all:hover{background:#f3f4f6;}

        .cat-grid{display:flex;flex-direction:column;gap:10px;}
        .cat-card{display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:12px;cursor:pointer;text-align:left;transition:transform .18s,box-shadow .18s;width:100%;}
        .cat-card:hover{transform:translateX(4px);box-shadow:0 4px 14px rgba(0,0,0,0.09);}
        .cat-card:active{transform:scale(0.98);}
        .cat-icon{font-size:20px;flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.55);border-radius:9px;}
        .cat-info{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;}
        .cat-name{font-size:14px;font-weight:700;line-height:1.3;}
        .cat-meta{font-size:11px;font-weight:500;opacity:0.65;}
        .cat-arrow{font-size:22px;font-weight:700;flex-shrink:0;opacity:0.6;}

        .back-btn{padding:8px 14px;background:white;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:600;color:#475569;cursor:pointer;flex-shrink:0;white-space:nowrap;transition:background .15s;}
        .back-btn:hover{background:#f1f5f9;}
        .active-cat-chip{flex:1;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;overflow:hidden;min-width:0;}

        .scanner-card{background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:16px;padding:20px;display:flex;align-items:flex-start;gap:16px;border-left:5px solid #3b82f6;box-shadow:0 4px 12px rgba(59,130,246,0.15);}
        .scanner-icon-box{background:white;width:52px;height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#3b82f6;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
        .scanner-body{flex:1;}
        .scanner-title{font-size:16px;font-weight:700;color:#1e40af;margin:0 0 6px;}
        .scanner-desc{font-size:13px;color:#1e40af;margin:0 0 10px;line-height:1.55;}
        .flow-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:8px 10px;background:rgba(255,255,255,0.6);border-radius:8px;margin-bottom:10px;}
        .flow-step{font-size:11px;font-weight:700;color:#1e40af;background:rgba(255,255,255,0.85);padding:2px 7px;border-radius:20px;}
        .flow-arrow{font-size:11px;color:#64748b;}
        .scanner-status{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.6);padding:7px 12px;border-radius:8px;}
        .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
        .dot.active{background:#10b981;animation:pdot 1.5s infinite;}
        .dot.idle{background:#f59e0b;}
        .status-txt{font-size:13px;color:#1e40af;font-weight:500;}

        .activity-list{display:flex;flex-direction:column;gap:10px;}
        .act-item{background:white;border-radius:12px;padding:13px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,0.05);transition:all .2s;border:1px solid #f5f5f5;}
        .act-item:hover{background:#f8fafc;transform:translateX(3px);}
        .act-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:15px;flex-shrink:0;}
        .act-icon.ok{background:#d1fae5;color:#10b981;}
        .act-icon.ng{background:#fee2e2;color:#ef4444;}
        .act-content{flex:1;min-width:0;}
        .act-title{font-size:13px;font-weight:600;color:#1a202c;margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .act-sub{font-size:11px;color:#718096;margin:0;}
        .act-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;}
        .act-time{font-size:10px;color:#a0aec0;}
        .act-badge{padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;}
        .act-badge.ok{background:#d1fae5;color:#059669;}
        .act-badge.ng{background:#fee2e2;color:#dc2626;}
        .empty-act{padding:16px;text-align:center;color:#94a3b8;font-style:italic;background:white;border-radius:12px;border:1px solid #f1f5f9;font-size:13px;}

        .dbg-panel{position:fixed;bottom:80px;right:16px;width:340px;max-width:calc(100vw - 32px);background:#0f172a;border:1px solid #1e3a5f;border-radius:12px;padding:14px;z-index:9999;max-height:340px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);font-family:monospace;}
        .dbg-btn{background:#1e293b;border:1px solid #334155;color:#94a3b8;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px;}
        .dbg-row{background:#1e293b;padding:6px 10px;border-radius:6px;display:flex;flex-direction:column;gap:1px;}
        .dbg-lbl{font-size:9px;color:#475569;text-transform:uppercase;letter-spacing:.05em;}
        .dbg-toggle{position:fixed;bottom:24px;right:16px;width:44px;height:44px;background:#1e3a5f;color:white;border:none;border-radius:50%;font-size:17px;cursor:pointer;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .dbg-toggle:hover{background:#1e88e5;transform:scale(1.08);}

        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.2)}}

        /* Tablet: 2 kolom */
        @media(min-width:640px){
          .cat-grid{display:grid;grid-template-columns:repeat(2,1fr);}
        }
        /* Desktop: tetap 2 kolom tapi lebih luas */
        @media(min-width:1024px){
          .cat-grid{grid-template-columns:repeat(2,1fr);gap:14px;}
          .welcome-title{font-size:26px;}
          .welcome-text{font-size:15px;}
          .section-title{font-size:20px;}
          .cat-name{font-size:15px;}
          .cat-meta{font-size:12px;}
          .welcome-banner{padding:28px 32px;}
        }
        /* Mobile */
        @media(max-width:768px){
          .home-main{padding:14px 12px 48px;}
          .welcome-banner{flex-direction:column;text-align:center;padding:16px;}
          .welcome-ilu{display:none;}
          .welcome-title{font-size:18px;}
          .scanner-card{flex-direction:column;padding:14px;}
          .section-title{font-size:16px;}
          .dbg-panel{bottom:70px;left:16px;right:16px;width:auto;}
        }
      `}</style>
    </>
  );
}