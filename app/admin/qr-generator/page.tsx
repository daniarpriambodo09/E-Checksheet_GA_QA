// app/admin/qr-generator/page.tsx
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";

// ========== AUTH FETCH HELPER ==========
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (typeof window === "undefined") return fetch(url, options);
  try {
    const userStr = localStorage.getItem("auth_current_user_v2");
    if (userStr) {
      const u = JSON.parse(userStr);
      options.headers = {
        "Content-Type": "application/json",
        ...options.headers,
        "x-user-id": String(u.id || ""),
        "x-user-role": String(u.role || ""),
        "x-username": String(u.username || ""),
      };
    }
  } catch {}
  return fetch(url, options);
}

// ========== TYPES ==========
interface Area {
  id: number;
  category_id: number;
  area_name: string;
  area_code: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface Category {
  id: number;
  category_name: string;
  category_code: string;
  table_type: string;
  area_type: string;
}

interface QRConfig {
  areaCode: string;
  areaName: string;
  shift: "A" | "B" | "AB";
  categoryCode: string;
  checklistType: "inspector" | "group-leader";
}

declare global {
  interface Window {
    QRCode: any;
    _qrcodeScriptLoading?: boolean;
    _qrcodeScriptLoaded?: boolean;
  }
}

function generateQRPath(config: QRConfig): string {
  const shiftParam = config.shift === "AB" ? "A" : config.shift;
  return `/checksheet-final-assy?areaCode=${encodeURIComponent(config.areaCode)}&areaName=${encodeURIComponent(config.areaName)}&shift=${shiftParam}`;
}

// ========== QR CARD COMPONENT ==========
// Kunci fix: qrcodejs memanipulasi DOM langsung & konflik dengan React.
// Solusi: buat div container MANUAL (bukan dirender React), append ke wrapperRef.
// React hanya menyentuh wrapperRef sebagai "anchor", isinya dikelola sendiri.
function QRCard({ config, index }: { config: QRConfig; index: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const [qrPath] = useState(() => generateQRPath(config));
  const [qrLoaded, setQrLoaded] = useState(false);

  useEffect(() => {
    if (!wrapperRef.current) return;

    // Buat container div manual — tidak dikelola React tree
    const container = document.createElement("div");
    container.style.cssText = "width:172px;height:172px;";
    qrContainerRef.current = container;
    wrapperRef.current.appendChild(container);

    const renderQR = () => {
      if (!window.QRCode || !qrContainerRef.current) return;
      try {
        new window.QRCode(qrContainerRef.current, {
          text: qrPath,
          width: 172,
          height: 172,
          colorDark: "#1e293b",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M,
        });
        setQrLoaded(true);
      } catch (e) {
        console.error("QR render error:", e);
      }
    };

    if (window._qrcodeScriptLoaded) {
      renderQR();
    } else if (window._qrcodeScriptLoading) {
      const poll = setInterval(() => {
        if (window._qrcodeScriptLoaded) {
          clearInterval(poll);
          renderQR();
        }
      }, 100);
    } else {
      window._qrcodeScriptLoading = true;
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      script.onload = () => {
        window._qrcodeScriptLoaded = true;
        window._qrcodeScriptLoading = false;
        renderQR();
      };
      script.onerror = () => { window._qrcodeScriptLoading = false; };
      document.head.appendChild(script);
    }

    // Cleanup: hapus container manual saat unmount
    const containerToRemove = container;
    const wrapperAtCleanup = wrapperRef.current;
    return () => {
      try {
        if (wrapperAtCleanup && wrapperAtCleanup.contains(containerToRemove)) {
          wrapperAtCleanup.removeChild(containerToRemove);
        }
      } catch {}
      qrContainerRef.current = null;
    };
  }, [qrPath]);

  const handleDownload = () => {
    const sourceCanvas = qrContainerRef.current?.querySelector("canvas");
    if (!sourceCanvas) {
      alert("QR Code belum siap. Tunggu beberapa detik lalu coba lagi.");
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 300;
    exportCanvas.height = 360;
    const ctx = exportCanvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 300, 360);

    // Border
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, 298, 358);

    // Header bar
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(0, 0, 300, 52);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("E-CheckSheet QA", 150, 22);
    ctx.font = "11px Arial";
    ctx.fillText(
      "Final Assembly - " + (config.checklistType === "inspector" ? "Inspector" : "Group Leader"),
      150, 40
    );

    // QR Code
    ctx.drawImage(sourceCanvas, 60, 62, 180, 180);

    // Area name
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    const displayName = config.areaName.length > 24
      ? config.areaName.substring(0, 24) + "..."
      : config.areaName;
    ctx.fillText(displayName, 150, 264);

    // Shift badge — roundRect polyfill (quadraticCurveTo)
    const shiftColor = config.shift === "A" ? "#1e88e5" : config.shift === "B" ? "#9c27b0" : "#43a047";
    const bx = 100, by = 274, bw = 100, bh = 26, br = 13;
    ctx.fillStyle = shiftColor;
    ctx.beginPath();
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(config.shift === "AB" ? "Shift A & B" : `Shift ${config.shift}`, 150, 291);

    // Path
    ctx.fillStyle = "#94a3b8";
    ctx.font = "8px monospace";
    const shortPath = qrPath.length > 48 ? qrPath.substring(0, 48) + "..." : qrPath;
    ctx.fillText(shortPath, 150, 342);

    const link = document.createElement("a");
    link.download = `QR_${config.areaCode}_Shift${config.shift}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyPath = () => {
    const copy = (text: string) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => alert("✅ Path berhasil disalin!")).catch(fallback);
      } else fallback();
      function fallback() {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        alert("✅ Path berhasil disalin!");
      }
    };
    copy(qrPath);
  };

  return (
    <div className="qr-card">
      <div className="qr-header">
        <span className="qr-index">#{index + 1}</span>
        <div className={`shift-badge shift-${config.shift.toLowerCase()}`}>
          {config.shift === "AB" ? "Shift A & B" : `Shift ${config.shift}`}
        </div>
      </div>

      {/* Wrapper: React hanya pegang ref-nya, isi dikelola manual */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          ref={wrapperRef}
          style={{
            width: 180,
            height: 180,
            border: "2px solid #e2e8f0",
            borderRadius: 8,
            overflow: "hidden",
            background: "white",
            padding: 4,
            boxSizing: "border-box",
          }}
        />
        {!qrLoaded && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "white", borderRadius: 8,
          }}>
            <div className="qr-spinner" />
          </div>
        )}
      </div>

      <div className="qr-info">
        <h3 className="qr-area-name">{config.areaName}</h3>
        <p className="qr-area-code">{config.areaCode}</p>
        <code className="qr-path">{qrPath}</code>
      </div>

      <div className="qr-actions">
        <button className="btn-download" onClick={handleDownload}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </button>
        <button className="btn-copy" onClick={handleCopyPath}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Salin Path
        </button>
      </div>

      <style jsx>{`
        .qr-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          border: 2px solid #f1f5f9;
          transition: all 0.2s;
        }
        .qr-card:hover {
          border-color: #1e88e5;
          box-shadow: 0 4px 20px rgba(30, 136, 229, 0.12);
          transform: translateY(-2px);
        }
        .qr-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .qr-index {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          background: #f1f5f9;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .shift-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .shift-badge.shift-a { background: #dbeafe; color: #1565c0; }
        .shift-badge.shift-b { background: #f3e5f5; color: #7b1fa2; }
        .shift-badge.shift-ab { background: #e8f5e9; color: #2e7d32; }
        .qr-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: #1e88e5;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .qr-info { width: 100%; text-align: center; }
        .qr-area-name { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #1e293b; }
        .qr-area-code { margin: 0 0 8px; font-size: 11px; color: #94a3b8; }
        .qr-path {
          display: block;
          font-size: 9px;
          color: #64748b;
          background: #f8fafc;
          padding: 6px;
          border-radius: 6px;
          word-break: break-all;
          text-align: left;
          font-family: monospace;
          border: 1px solid #e2e8f0;
          line-height: 1.5;
        }
        .qr-actions { width: 100%; display: flex; gap: 8px; }
        .btn-download, .btn-copy {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-download { background: #1e88e5; color: white; }
        .btn-download:hover { background: #1565c0; }
        .btn-copy { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
        .btn-copy:hover { background: #e2e8f0; }
      `}</style>
    </div>
  );
}

// ========== FALLBACK DATA ==========
const FALLBACK_CATEGORIES: Category[] = [
  { id: 1, category_name: "Daily Check Group Leader Final Assy", category_code: "final-assy-gl", table_type: "group-leader", area_type: "final-assy" },
  { id: 2, category_name: "Daily Check Inspector Final Assy", category_code: "final-assy-inspector", table_type: "inspector", area_type: "final-assy" },
];

const FALLBACK_AREAS: Area[] = [
  { id: 5, category_id: 2, area_name: "Genba A - Mazda", area_code: "final-assy-insp-genba-a-mazda", description: "", is_active: true, sort_order: 1 },
  { id: 6, category_id: 2, area_name: "Genba A - Toyota TRX", area_code: "final-assy-insp-genba-a-toyota-trx", description: "", is_active: true, sort_order: 2 },
  { id: 7, category_id: 2, area_name: "Genba B - Nissan", area_code: "final-assy-insp-genba-b-nissan", description: "", is_active: true, sort_order: 3 },
  { id: 8, category_id: 2, area_name: "Genba C - Corola", area_code: "final-assy-insp-genba-c-corola", description: "", is_active: true, sort_order: 4 },
  { id: 26, category_id: 2, area_name: "Genba C - TNGA", area_code: "final-assy-insp-genba-c-tnga", description: "", is_active: true, sort_order: 5 },
];

// ========== MAIN PAGE ==========
export default function QRGeneratorPage() {
  const router = useRouter();
  const { user, loading: authLoading, isInitialized } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(2);
  const [selectedShift, setSelectedShift] = useState<"A" | "B" | "AB">("A");
  const [searchQuery, setSearchQuery] = useState("");

  const [qrConfigs, setQrConfigs] = useState<QRConfig[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  // ===== AUTH CHECK =====
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!user) { router.push("/login-page"); return; }
    if (!["admin", "superadmin"].includes(user.role)) { router.push("/home"); return; }
  }, [user, authLoading, isInitialized, router]);

  // ===== LOAD CATEGORIES =====
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await authFetch("/api/admin/categories?areaType=final-assy");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCategories(data.success && data.data?.length > 0 ? data.data : FALLBACK_CATEGORIES);
      } catch {
        setCategories(FALLBACK_CATEGORIES);
        setApiError("API tidak tersedia, menggunakan data bawaan.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ===== LOAD AREAS =====
  const loadAreas = useCallback(async (categoryId: number) => {
    setAreasLoading(true);
    setIsGenerated(false);
    setQrConfigs([]);
    try {
      const res = await authFetch(`/api/admin/areas?categoryId=${categoryId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAreas(data.success && data.data?.length > 0
        ? data.data
        : FALLBACK_AREAS.filter(a => a.category_id === categoryId)
      );
    } catch {
      setAreas(FALLBACK_AREAS.filter(a => a.category_id === categoryId));
    } finally {
      setAreasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) loadAreas(selectedCategoryId);
  }, [selectedCategoryId, isLoading, loadAreas]);

  // ===== DERIVED =====
  const filteredAreas = areas.filter(a =>
    a.is_active && a.area_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleGenerate = () => {
    const configs: QRConfig[] = filteredAreas.map(area => ({
      areaCode: area.area_code,
      areaName: area.area_name,
      shift: selectedShift,
      categoryCode: selectedCategory?.category_code || "final-assy-inspector",
      checklistType: (selectedCategory?.table_type as "inspector" | "group-leader") || "inspector",
    }));
    setQrConfigs(configs);
    setIsGenerated(true);
    setTimeout(() => {
      document.getElementById("qr-grid-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // ===== LOADING STATE =====
  if (authLoading || !isInitialized || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0f4f8" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#64748b", fontSize: 14 }}>Memuat data...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <Sidebar userName={user.fullName || user.username} />
      <main className="main-content">

        <div className="page-header">
          <button onClick={() => router.back()} className="back-btn">←</button>
          <div>
            <h1 className="header-title">🔲 Generator QR Code</h1>
            <p className="header-sub">Buat & unduh QR Code untuk area checklist Final Assembly</p>
          </div>
        </div>

        {apiError && <div className="notice-warning">⚠️ {apiError}</div>}

        <div className="config-panel">
          <h2 className="panel-title">⚙️ Konfigurasi QR Code</h2>
          <div className="config-grid">

            <div className="config-field">
              <label className="field-label">Tipe Checklist</label>
              <div className="category-options">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`cat-option ${selectedCategoryId === cat.id ? "active" : ""}`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    <span className="cat-icon">{cat.table_type === "inspector" ? "🔍" : "👔"}</span>
                    <span className="cat-label">{cat.category_name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="config-field">
              <label className="field-label">Shift</label>
              <div className="shift-options">
                {(["A", "B", "AB"] as const).map(s => (
                  <button
                    key={s}
                    className={`shift-option ${selectedShift === s ? `active shift-${s.toLowerCase()}` : ""}`}
                    onClick={() => { setSelectedShift(s); setIsGenerated(false); }}
                  >
                    {s === "AB" ? "A & B" : `Shift ${s}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="config-field">
              <label className="field-label">
                Filter Area ({areasLoading ? "..." : `${filteredAreas.length} aktif`})
              </label>
              <div className="search-wrapper">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari nama area..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setIsGenerated(false); }}
                />
              </div>
            </div>
          </div>

          <div className="area-preview">
            <p className="area-preview-label">Area yang akan di-generate:</p>
            <div className="area-chips">
              {areasLoading ? (
                <span className="area-empty">Memuat area...</span>
              ) : filteredAreas.length === 0 ? (
                <span className="area-empty">Tidak ada area ditemukan</span>
              ) : (
                filteredAreas.map(area => (
                  <span key={area.id} className="area-chip">{area.area_name}</span>
                ))
              )}
            </div>
          </div>

          <div className="generate-section">
            {isGenerated ? (
              <div className="generated-actions">
                <button className="btn-reset" onClick={() => { setIsGenerated(false); setQrConfigs([]); }}>
                  ← Ubah Konfigurasi
                </button>
                <span className="generated-count">✅ {qrConfigs.length} QR Code berhasil dibuat</span>
              </div>
            ) : (
              <button
                className="btn-generate"
                onClick={handleGenerate}
                disabled={filteredAreas.length === 0 || areasLoading}
              >
                🔲 Generate {filteredAreas.length} QR Code
              </button>
            )}
          </div>
        </div>

        {isGenerated && qrConfigs.length > 0 && (
          <div id="qr-grid-section" className="qr-section">
            <div className="qr-section-header">
              <h2 className="qr-section-title">QR Code Siap Download</h2>
              <p className="qr-section-sub">
                Klik <strong>Download</strong> untuk PNG, atau <strong>Salin Path</strong> untuk URL-nya.
              </p>
            </div>
            <div className="qr-grid">
              {qrConfigs.map((config, i) => (
                <QRCard key={`${config.areaCode}-${config.shift}-${i}`} config={config} index={i} />
              ))}
            </div>
          </div>
        )}

        <div className="guide-section">
          <h2 className="guide-title">📖 Cara Penggunaan QR Code</h2>
          <div className="guide-steps">
            {[
              { n: 1, title: "Generate QR Code", desc: "Pilih tipe checklist, shift, dan area. Klik 'Generate'." },
              { n: 2, title: "Download & Cetak", desc: "Download sebagai PNG, cetak dan tempel di area produksi." },
              { n: 3, title: "Scan dengan TC21", desc: "Tekan tombol kuning TC21, arahkan ke QR Code." },
              { n: 4, title: "Otomatis Redirect", desc: "Halaman checklist terbuka sesuai area yang di-scan." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="guide-step">
                <div className="step-number">{n}</div>
                <div className="step-content"><h3>{title}</h3><p>{desc}</p></div>
              </div>
            ))}
          </div>
          <div className="format-box">
            <p className="format-title">📋 Format Path QR Code:</p>
            <code className="format-code">/checksheet-final-assy?areaCode=&#123;code&#125;&amp;areaName=&#123;name&#125;&amp;shift=&#123;A|B&#125;</code>
            <p className="format-example">Contoh:</p>
            <code className="format-code">/checksheet-final-assy?areaCode=final-assy-insp-genba-a-mazda&amp;areaName=Genba%20A%20-%20Mazda&amp;shift=A</code>
          </div>
        </div>

      </main>

      <style jsx>{`
        .main-content { margin-left: 80px; padding: 24px; min-height: 100vh; background: #f0f4f8; }

        .page-header {
          background: linear-gradient(135deg, #1e3a5f, #1e88e5);
          border-radius: 16px; padding: 20px 24px;
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 20px;
          box-shadow: 0 4px 16px rgba(30,136,229,0.25);
        }
        .back-btn {
          background: rgba(255,255,255,0.15); border: none; color: white;
          width: 40px; height: 40px; border-radius: 10px; cursor: pointer;
          font-size: 20px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.25); }
        .header-title { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: white; }
        .header-sub { margin: 0; font-size: 13px; color: rgba(255,255,255,0.8); }

        .notice-warning {
          background: #fffbeb; border: 1px solid #fde68a;
          border-left: 4px solid #f59e0b; border-radius: 8px;
          padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #92400e;
        }

        .config-panel {
          background: white; border-radius: 16px; padding: 24px;
          margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .panel-title {
          font-size: 17px; font-weight: 700; color: #1e293b; margin: 0 0 20px;
          padding-bottom: 12px; border-bottom: 2px solid #f1f5f9;
        }
        .config-grid { display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px; }
        .field-label {
          display: block; font-weight: 600; color: #475569;
          font-size: 12px; margin-bottom: 10px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .category-options { display: flex; flex-direction: column; gap: 8px; }
        .cat-option {
          display: flex; align-items: center; gap: 10px; padding: 12px 16px;
          border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer;
          background: #f8fafc; text-align: left; transition: all 0.2s;
          font-size: 14px; color: #475569;
        }
        .cat-option:hover { border-color: #1e88e5; color: #1e88e5; }
        .cat-option.active { border-color: #1e88e5; background: #eff6ff; color: #1565c0; font-weight: 600; }
        .cat-icon { font-size: 18px; flex-shrink: 0; }
        .cat-label { flex: 1; }

        .shift-options { display: flex; gap: 10px; }
        .shift-option {
          flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px;
          cursor: pointer; background: #f8fafc; font-weight: 600; font-size: 14px;
          color: #475569; transition: all 0.2s;
        }
        .shift-option:hover { border-color: #94a3b8; }
        .shift-option.active.shift-a { border-color: #1e88e5; background: #eff6ff; color: #1565c0; }
        .shift-option.active.shift-b { border-color: #9c27b0; background: #f3e5f5; color: #7b1fa2; }
        .shift-option.active.shift-ab { border-color: #43a047; background: #e8f5e9; color: #2e7d32; }

        .search-wrapper { position: relative; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-input {
          width: 100%; padding: 12px 12px 12px 40px;
          border: 2px solid #e2e8f0; border-radius: 10px;
          font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box;
        }
        .search-input:focus { border-color: #1e88e5; }

        .area-preview {
          border: 1.5px dashed #cbd5e1; border-radius: 10px;
          padding: 14px 16px; margin-bottom: 20px; background: #f8fafc;
        }
        .area-preview-label {
          font-size: 11px; font-weight: 600; color: #64748b; margin: 0 0 10px;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .area-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .area-chip {
          background: #dbeafe; color: #1e40af;
          padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;
        }
        .area-empty { color: #94a3b8; font-size: 13px; font-style: italic; }

        .generate-section { display: flex; align-items: center; }
        .btn-generate {
          padding: 14px 28px;
          background: linear-gradient(135deg, #1e88e5, #1565c0);
          color: white; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(30,136,229,0.3);
        }
        .btn-generate:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(30,136,229,0.4); }
        .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }
        .generated-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .btn-reset {
          padding: 10px 20px; background: #f1f5f9; border: 2px solid #e2e8f0;
          border-radius: 10px; color: #475569; font-weight: 600; cursor: pointer;
          font-size: 14px; transition: all 0.2s;
        }
        .btn-reset:hover { background: #e2e8f0; }
        .generated-count { font-size: 14px; font-weight: 600; color: #22c55e; }

        .qr-section { margin-bottom: 32px; }
        .qr-section-header { margin-bottom: 20px; }
        .qr-section-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0 0 6px; }
        .qr-section-sub { font-size: 13px; color: #64748b; margin: 0; }
        .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }

        .guide-section {
          background: white; border-radius: 16px; padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 40px;
        }
        .guide-title { font-size: 17px; font-weight: 700; color: #1e293b; margin: 0 0 20px; }
        .guide-steps {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px; margin-bottom: 24px;
        }
        .guide-step { display: flex; gap: 12px; align-items: flex-start; }
        .step-number {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #1e88e5, #1565c0);
          color: white; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;
        }
        .step-content h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #1e293b; }
        .step-content p { margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; }
        .format-box { background: #1e293b; border-radius: 10px; padding: 16px; }
        .format-title { margin: 0 0 8px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .format-code { display: block; color: #67e8f9; font-size: 11px; font-family: monospace; word-break: break-all; margin-bottom: 8px; line-height: 1.6; }
        .format-example { font-size: 11px; color: #64748b; margin: 8px 0 4px; }

        @media (max-width: 768px) {
          .main-content { margin-left: 0; padding: 12px; }
          .qr-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
          .guide-steps { grid-template-columns: 1fr; }
          .shift-options { flex-wrap: wrap; }
        }
      `}</style>
    </>
  );
}