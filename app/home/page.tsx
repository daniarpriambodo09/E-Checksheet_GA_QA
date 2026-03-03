// app/home/page.tsx
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";

interface ActivityItem {
  title: string;
  user: string;
  time: string;
  status: "OK" | "NG";
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, isInitialized } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // ===== QR SCANNER: pakai hidden input sebagai target =====
  // TC21 kirim input ke element yang sedang fokus.
  // Jika fokus ada di window/body, event kadang tidak ter-capture.
  // Solusi: hidden input yang selalu re-fokus otomatis.
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // ===== DEBUG STATE =====
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [lastScan, setLastScan] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const addLog = useCallback((msg: string) => {
    console.log("[SCANNER]", msg);
    setDebugLog(prev => [`${new Date().toLocaleTimeString("id-ID")} | ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // ===== AUTH CHECK =====
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!user) router.push("/login-page");
  }, [user, authLoading, isInitialized, router]);

  // ===== LOAD ACTIVITIES =====
  useEffect(() => {
    let mounted = true;
    try {
      const historyStr = localStorage.getItem("checksheet_history");
      if (!historyStr) { if (mounted) setActivities([]); return; }
      const history = JSON.parse(historyStr);
      if (!Array.isArray(history)) { if (mounted) setActivities([]); return; }
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const recent = history
        .filter((i: any) => { const d = new Date(i.filledAt); return d >= start && d < end; })
        .sort((a: any, b: any) => new Date(b.filledAt).getTime() - new Date(a.filledAt).getTime())
        .slice(0, 3)
        .map((i: any) => ({
          title: String(i.area || "Checklist Tanpa Nama"),
          user: String(i.filledBy || "Unknown"),
          time: new Date(i.filledAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          status: (i.status === "NG" ? "NG" : "OK") as "OK" | "NG",
        }));
      if (mounted) setActivities(recent);
    } catch { if (mounted) setActivities([]); }
    return () => { mounted = false; };
  }, []);

  // ===== PROCESS QR CODE =====
  const processQRCode = useCallback((raw: string) => {
    const data = raw.trim().replace(/[\x00-\x1F\x7F]/g, "");
    addLog(`PROCESS: "${data}" (len=${data.length})`);
    setLastScan(data);

    if (!user) { router.push("/login-page"); return; }
    if (!data) return;

    // FORMAT 1: /checksheet-final-assy?...
    if (data.startsWith("/checksheet-final-assy")) {
      addLog(`✅ FORMAT 1 → redirect`);
      router.push(data);
      return;
    }
    // FORMAT 2: path langsung lainnya
    if (data.startsWith("/") && data.length > 1) {
      addLog(`✅ FORMAT 2 → redirect`);
      router.push(data);
      return;
    }
    // FORMAT 3: URL lengkap
    if (data.startsWith("http://") || data.startsWith("https://")) {
      addLog(`✅ FORMAT 3 → URL`);
      try {
        const url = new URL(data);
        router.push(url.pathname + url.search);
      } catch {
        const m = data.match(/https?:\/\/[^/]+(\/.*)/);
        if (m) router.push(m[1]);
      }
      return;
    }
    // FORMAT 4: CHECKLIST:...
    if (data.toUpperCase().startsWith("CHECKLIST:")) {
      const parts = data.split(":");
      if (parts.length >= 4) {
        const cat = parts[1].toUpperCase();
        const role = parts[2].toUpperCase();
        const area = parts[3];
        const shift = parts[4] || "A";
        if (cat === "FINAL-ASSY") {
          if (role === "INSPECTOR" || role === "INS") {
            router.push(`/checksheet-final-assy?areaCode=${encodeURIComponent(area)}&shift=${shift}`);
            return;
          }
          if (role === "GL" || role === "GROUP-LEADER") {
            router.push(`/status-final-assy?viewAs=group-leader&area=${encodeURIComponent(area)}`);
            return;
          }
        }
        if (cat === "PRE-ASSY") {
          router.push(`/status-pre-assy?area=${encodeURIComponent(area)}&shift=${shift}`);
          return;
        }
      }
      return;
    }

    addLog(`❌ Format tidak dikenali: "${data}"`);
    alert(`Format QR tidak dikenali:\n"${data}"`);
  }, [user, router, addLog]);

  // ===== FOKUS OTOMATIS KE HIDDEN INPUT =====
  // Ini kunci utama: pastikan hidden input selalu fokus
  // sehingga TC21 scanner selalu punya target untuk mengirim input.
  const refocusInput = useCallback(() => {
    // Jangan refocus jika user sedang klik/interaksi dengan elemen lain
    const active = document.activeElement;
    const isInteractive = active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      (active as HTMLElement).isContentEditable
    );
    if (!isInteractive) {
      hiddenInputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    // Fokus saat page load
    const timer = setTimeout(() => {
      hiddenInputRef.current?.focus({ preventScroll: true });
    }, 300);

    // Refocus setiap kali user klik area kosong
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.tagName === "INPUT" ||
        target.tagName === "BUTTON" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "A" ||
        target.tagName === "SELECT";
      if (!isInteractive) {
        setTimeout(refocusInput, 100);
      }
    };

    // Refocus saat visibilitychange (user kembali ke tab)
    const handleVisibility = () => {
      if (!document.hidden) setTimeout(refocusInput, 200);
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refocusInput);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refocusInput);
    };
  }, [refocusInput]);

  // ===== HANDLER INPUT DARI HIDDEN INPUT =====
  // TC21 scanner mengirim karakter satu per satu lalu Enter.
  // Kita tangkap via onChange + onKeyDown pada hidden input.
  const handleScannerInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    addLog(`onChange: "${val}"`);
    setInputValue(val);

    // Clear timeout sebelumnya
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    // Timeout fallback jika tidak ada Enter
    scanTimeoutRef.current = setTimeout(() => {
      const current = hiddenInputRef.current?.value || "";
      if (current.trim().length > 2) {
        addLog(`TIMEOUT: "${current}"`);
        processQRCode(current);
      }
      setInputValue("");
      if (hiddenInputRef.current) hiddenInputRef.current.value = "";
      refocusInput();
    }, 800);
  }, [addLog, processQRCode, refocusInput]);

  const handleScannerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    addLog(`keyDown: key="${e.key}"`);

    if (e.key === "Enter" || e.key === "\r") {
      e.preventDefault();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

      const val = hiddenInputRef.current?.value || "";
      addLog(`ENTER: "${val}"`);

      if (val.trim().length > 2) {
        processQRCode(val);
      }

      setInputValue("");
      if (hiddenInputRef.current) hiddenInputRef.current.value = "";
      setTimeout(refocusInput, 100);
    }
  }, [addLog, processQRCode, refocusInput]);

  // ===== DASHBOARD LINK =====
  const dashboardLink = (() => {
    switch (user?.role) {
      case "inspector-ga": return "/ga-dashboard";
      case "inspector-qa": return "/qa-dashboard";
      case "group-leader-qa": return "/gl-dashboard";
      default: return "/dashboard";
    }
  })();

  if (authLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Memuat autentikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userName = user.fullName || "User";

  return (
    <>
      <Sidebar userName={userName} />

      {/*
        ===== HIDDEN INPUT: TARGET SCAN TC21 =====
        - opacity:0 dan ukuran 1px agar tidak terlihat
        - readOnly=false agar bisa menerima input
        - position:fixed agar tidak affect layout
        - tabIndex=-1 agar tidak ikut Tab navigation user
      */}
      <input
        ref={hiddenInputRef}
        type="text"
        value={inputValue}
        onChange={handleScannerInput}
        onKeyDown={handleScannerKeyDown}
        onBlur={() => {
          // Refocus setelah blur kecuali ke elemen interaktif
          setTimeout(refocusInput, 150);
        }}
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: 1, height: 1,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <main className="main-content" onClick={refocusInput}>
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="welcome-content">
            <h1 className="welcome-title">👋 Halo, {userName}!</h1>
            <p className="welcome-text">
              Selamat datang di E-CheckSheet. Kelola checklist dan laporan Anda dengan mudah.
            </p>
          </div>
          <div className="welcome-illustration" aria-hidden="true">
            <svg width="160" height="120" viewBox="0 0 200 150" fill="none">
              <circle cx="100" cy="75" r="60" fill="#EDE9FE" opacity="0.5" />
              <circle cx="100" cy="75" r="40" fill="#A78BFA" opacity="0.3" />
              <path d="M80 75L95 90L120 60" stroke="#8B5CF6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Scanner Status Card */}
        <section className="section">
          <div className="scanner-info-card">
            <div className="scanner-icon-wrapper">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="15" x2="15" y2="15" />
                <line x1="9" y1="9" x2="9" y2="15" />
                <line x1="15" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="scanner-content">
              <h2 className="scanner-title">📷 Scan QR Code untuk Mulai</h2>
              <p className="scanner-description">
                Tekan tombol scanner pada device TC21 dan arahkan ke QR Code area checklist.
                Halaman akan otomatis terbuka sesuai area yang di-scan.
              </p>
              {/* Indikator apakah hidden input sedang fokus */}
              <div className="scanner-status">
                <span className={`status-dot ${document?.activeElement === hiddenInputRef.current ? "active" : "inactive"}`} />
                <span className="status-text">
                  {inputValue
                    ? `Scanning... "${inputValue}"`
                    : "Scanner siap — arahkan TC21 ke QR Code"}
                </span>
              </div>
              <div className="scanner-hint">
                <strong>Format:</strong> /checksheet-final-assy?areaCode=&#123;code&#125;&amp;areaName=&#123;name&#125;&amp;shift=&#123;A|B&#125;
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="section">
          <div className="section-header">
            <div>
              <h2 className="section-title">🕐 Aktivitas Terbaru</h2>
              <p className="section-desc">Checklist yang baru saja diselesaikan</p>
            </div>
            <a href={dashboardLink} className="view-all-btn">Lihat Semua →</a>
          </div>
          <div className="activity-list">
            {activities.length > 0 ? (
              activities.map((act, i) => (
                <div key={i} className="activity-item">
                  <div className={`activity-icon ${act.status === "OK" ? "ok" : "ng"}`}>
                    {act.status === "OK" ? "✓" : "✗"}
                  </div>
                  <div className="activity-content">
                    <h3 className="activity-title">{act.title}</h3>
                    <p className="activity-desc">Diselesaikan oleh {act.user}</p>
                  </div>
                  <div className="activity-meta">
                    <span className="activity-time">{act.time}</span>
                    <span className={`activity-status ${act.status === "OK" ? "ok" : "ng"}`}>{act.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-activity">Belum ada aktivitas checklist hari ini.</p>
            )}
          </div>
        </section>
      </main>

      {/* Debug Panel */}
      {showDebug && (
        <div className="debug-panel">
          <div className="debug-header">
            <span className="debug-title">🔍 Scanner Debug</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="debug-btn" onClick={() => { setDebugLog([]); setLastScan(""); }}>Clear</button>
              <button className="debug-btn" onClick={() => setShowDebug(false)}>✕</button>
            </div>
          </div>
          <div className="debug-row">
            <span className="debug-label">INPUT FOKUS:</span>
            <code className={`debug-val ${document?.activeElement === hiddenInputRef.current ? "ok" : "warn"}`}>
              {document?.activeElement === hiddenInputRef.current ? "✅ YA (siap scan)" : "⚠️ TIDAK (klik area kosong)"}
            </code>
          </div>
          {lastScan && (
            <div className="debug-row">
              <span className="debug-label">LAST SCAN:</span>
              <code className="debug-val" style={{ color: "#67e8f9", wordBreak: "break-all" }}>{lastScan}</code>
            </div>
          )}
          {inputValue && (
            <div className="debug-row">
              <span className="debug-label">BUFFER:</span>
              <code className="debug-val" style={{ color: "#fbbf24" }}>{inputValue}</code>
            </div>
          )}
          <div className="debug-logs">
            {debugLog.length === 0
              ? <div style={{ color: "#475569", fontSize: 11 }}>Scan QR Code untuk melihat log...</div>
              : debugLog.map((l, i) => (
                <div key={i} className={`debug-line ${l.includes("✅") ? "s" : l.includes("❌") ? "e" : l.includes("ENTER") || l.includes("PROCESS") || l.includes("TIMEOUT") ? "h" : ""}`}>
                  {l}
                </div>
              ))
            }
          </div>
        </div>
      )}

      <button className="debug-toggle" onClick={() => setShowDebug(d => !d)} title="Scanner Debug">
        {showDebug ? "✕" : "🔍"}
      </button>

      <style jsx>{`
        .main-content {
          flex: 1; padding: 24px; min-height: calc(100vh - 64px);
          max-width: 1200px; margin: 0 auto; padding-top: 20px;
        }
        .welcome-banner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px; padding: 24px;
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 28px; box-shadow: 0 4px 12px rgba(102,126,234,0.2); gap: 24px;
        }
        .welcome-title { font-size: 26px; font-weight: 700; color: white; margin: 0 0 12px; }
        .welcome-text { font-size: 15px; color: rgba(255,255,255,0.9); margin: 0; line-height: 1.6; }
        .welcome-illustration { flex-shrink: 0; }

        .scanner-info-card {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border-radius: 16px; padding: 24px;
          display: flex; align-items: flex-start; gap: 20px;
          box-shadow: 0 4px 12px rgba(59,130,246,0.15);
          border-left: 5px solid #3b82f6; margin-bottom: 32px;
        }
        .scanner-icon-wrapper {
          background: white; width: 64px; height: 64px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #3b82f6; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .scanner-title { font-size: 20px; font-weight: 700; color: #1e40af; margin: 0 0 8px; }
        .scanner-description { font-size: 14px; color: #1e40af; margin: 0 0 12px; line-height: 1.6; }
        .scanner-status {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.6); padding: 7px 12px;
          border-radius: 8px; margin-bottom: 10px;
        }
        .status-dot {
          width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
        }
        .status-dot.active { background: #10b981; animation: pulse 1.5s infinite; }
        .status-dot.inactive { background: #f59e0b; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.2)} }
        .status-text { font-size: 13px; color: #1e40af; font-weight: 500; }
        .scanner-hint {
          background: rgba(255,255,255,0.5); padding: 7px 12px;
          border-radius: 6px; font-size: 11px; color: #1e40af; font-family: monospace;
        }

        .section { margin-bottom: 32px; }
        .section-header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
        }
        .section-title { font-size: 20px; font-weight: 700; color: #1a202c; margin: 0 0 4px; }
        .section-desc { font-size: 14px; color: #718096; margin: 0; }
        .view-all-btn {
          color: #8b5cf6; text-decoration: none; font-size: 14px; font-weight: 600;
          padding: 8px 16px; border-radius: 8px; transition: all 0.2s;
        }
        .view-all-btn:hover { background: #f3f4f6; transform: translateX(4px); }
        .activity-list { display: flex; flex-direction: column; gap: 12px; }
        .activity-item {
          background: white; border-radius: 12px; padding: 18px;
          display: flex; align-items: center; gap: 14px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05); transition: all 0.3s; border: 1px solid #f5f5f5;
        }
        .activity-item:hover { background: #f8fafc; transform: translateX(4px); }
        .activity-icon {
          width: 40px; height: 40px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-size: 18px; flex-shrink: 0;
        }
        .activity-icon.ok { background: #d1fae5; color: #10b981; }
        .activity-icon.ng { background: #fee2e2; color: #ef4444; }
        .activity-content { flex: 1; min-width: 0; }
        .activity-title { font-size: 14px; font-weight: 600; color: #1a202c; margin: 0 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .activity-desc { font-size: 12px; color: #718096; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .activity-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .activity-time { font-size: 11px; color: #a0aec0; }
        .activity-status { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
        .activity-status.ok { background: #d1fae5; color: #059669; }
        .activity-status.ng { background: #fee2e2; color: #dc2626; }
        .empty-activity {
          padding: 16px; text-align: center; color: #94a3b8;
          font-style: italic; background: white; border-radius: 12px; border: 1px solid #f1f5f9;
        }

        /* Debug */
        .debug-panel {
          position: fixed; bottom: 80px; right: 16px;
          width: 360px; max-width: calc(100vw - 32px);
          background: #0f172a; border: 1px solid #1e3a5f; border-radius: 12px;
          padding: 14px; z-index: 9999; max-height: 340px;
          display: flex; flex-direction: column; gap: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5); font-family: monospace;
        }
        .debug-header { display: flex; justify-content: space-between; align-items: center; }
        .debug-title { color: #38bdf8; font-weight: 700; font-size: 13px; }
        .debug-btn {
          background: #1e293b; border: 1px solid #334155; color: #94a3b8;
          border-radius: 4px; padding: 3px 10px; cursor: pointer; font-size: 11px;
        }
        .debug-btn:hover { background: #334155; }
        .debug-row {
          background: #1e293b; padding: 6px 10px; border-radius: 6px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .debug-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
        .debug-val { font-size: 11px; color: #94a3b8; }
        .debug-val.ok { color: #4ade80; }
        .debug-val.warn { color: #fbbf24; }
        .debug-logs { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .debug-line { font-size: 10px; padding: 2px 4px; color: #64748b; word-break: break-all; border-radius: 3px; }
        .debug-line.s { color: #4ade80; }
        .debug-line.e { color: #f87171; }
        .debug-line.h { color: #a78bfa; }

        .debug-toggle {
          position: fixed; bottom: 24px; right: 16px;
          width: 48px; height: 48px; background: #1e3a5f; color: white;
          border: none; border-radius: 50%; font-size: 20px; cursor: pointer;
          z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .debug-toggle:hover { background: #1e88e5; transform: scale(1.1); }

        @media (max-width: 768px) {
          .main-content { padding: 14px; }
          .welcome-banner { flex-direction: column; text-align: center; padding: 16px; }
          .scanner-info-card { flex-direction: column; padding: 16px; }
          .debug-panel { bottom: 70px; left: 16px; right: 16px; width: auto; }
        }
        @media (max-width: 480px) {
          .main-content { padding: 10px; }
          .welcome-title { font-size: 18px; }
          .welcome-text { font-size: 12px; }
        }
      `}</style>
    </>
  );
}