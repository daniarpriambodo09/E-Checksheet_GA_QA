// app/home/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
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
  // ✅ PENTING: Ambil isInitialized dari useAuth()
  const { user, loading: authLoading, isInitialized } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [scanBuffer, setScanBuffer] = useState("");
  const scanTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastInputTimeRef = useRef(0);

  // ===== AUTH CHECK YANG BENAR =====
  // ✅ Hanya redirect jika:
  // 1. isInitialized sudah true (AuthContext sudah selesai load)
  // 2. authLoading sudah false
  // 3. user masih null
  useEffect(() => {
    // ❌ JANGAN redirect jika masih loading atau belum initialized
    if (!isInitialized || authLoading) {
      return;
    }
    
    // ✅ Baru redirect jika sudah initialized tapi user null
    if (!user) {
      console.log("🚫 User not authenticated, redirecting to login...");
      router.push("/login-page");
      return;
    }
    
    console.log("✅ User authenticated:", user.username);
  }, [user, authLoading, isInitialized, router]);

  // ===== LOAD RECENT ACTIVITIES =====
  useEffect(() => {
    let isMounted = true;
    
    try {
      const historyStr = localStorage.getItem("checksheet_history");
      if (!historyStr) {
        if (isMounted) setActivities([]);
        return;
      }

      const history = JSON.parse(historyStr);
      if (!Array.isArray(history)) {
        if (isMounted) setActivities([]);
        return;
      }

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const todayEntries = history.filter((item: any) => {
        const filledDate = new Date(item.filledAt);
        return filledDate >= todayStart && filledDate < todayEnd;
      });

      const sorted = [...todayEntries].sort(
        (a: any, b: any) => new Date(b.filledAt).getTime() - new Date(a.filledAt).getTime()
      );

      const recent = sorted.slice(0, 3).map((item: any) => ({
        title: String(item.area || "Checklist Tanpa Nama"),
        user: String(item.filledBy || "Unknown User"),
        time: new Date(item.filledAt).toLocaleString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: (item.status === "NG" ? "NG" : "OK") as "OK" | "NG",
      }));

      if (isMounted) {
        setActivities(recent);
      }
    } catch (e) {
      console.error("[Home] Gagal memuat riwayat checklist:", e);
      if (isMounted) {
        setActivities([]);
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // ===== QR SCANNER HANDLER (TC21) =====
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLast = now - lastInputTimeRef.current;
      lastInputTimeRef.current = now;

      // Scanner biasanya mengirim karakter dengan cepat (< 100ms)
      // dan diakhiri dengan Enter
      if (e.key === "Enter" || e.key === "\n") {
        e.preventDefault();
        const qrData = scanBuffer.trim();
        
        if (qrData.length > 3) {
          console.log("📷 QR Code scanned:", qrData);
          processQRCode(qrData);
        }
        
        setScanBuffer("");
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        return;
      }

      // Reset buffer jika jeda terlalu lama (> 500ms)
      if (timeSinceLast > 500 && scanBuffer.length > 0) {
        setScanBuffer("");
      }

      // Tambahkan karakter ke buffer (hanya karakter yang bisa dicetak)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setScanBuffer((prev) => prev + e.key);

        // Auto-process setelah 500ms tidak ada input
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          const qrData = scanBuffer.trim();
          if (qrData.length > 3) {
            console.log("📷 QR Code scanned (timeout):", qrData);
            processQRCode(qrData);
          }
          setScanBuffer("");
        }, 500);
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyPress);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanBuffer, user]);

  // ===== PARSE QR CODE DAN REDIRECT =====
  const processQRCode = (qrData: string) => {
    console.log("🔄 Processing QR:", qrData);
    
    if (!user) {
      alert("Silakan login terlebih dahulu!");
      router.push("/login-page");
      return;
    }

    try {
      const parts = qrData.split(":");

      // Format: CHECKLIST:CATEGORY:ROLE:AREA_CODE
      if (parts[0] === "CHECKLIST" && parts.length >= 4) {
        const [, category, role, areaCode] = parts;

        // Validasi role sesuai user yang login
        const userRole = user?.role || "";
        
        if (category === "FINAL-ASSY") {
          if (
            (role === "GL" || role === "GROUP-LEADER") &&
            (userRole === "group-leader-qa" || userRole === "inspector-qa")
          ) {
            router.push(`/status-final-assy?viewAs=group-leader&area=${areaCode}`);
            return;
          } else if (
            (role === "INSPECTOR" || role === "INS") &&
            (userRole === "inspector-qa" || userRole === "group-leader-qa")
          ) {
            router.push(`/status-final-assy?viewAs=inspector&area=${areaCode}`);
            return;
          }
        }

        if (category === "PRE-ASSY") {
          if (
            (role === "GL" || role === "GROUP-LEADER") &&
            (userRole === "group-leader-qa" || userRole === "inspector-qa")
          ) {
            router.push(`/status-pre-assy?viewAs=group-leader&area=${areaCode}`);
            return;
          } else if (
            (role === "INSPECTOR" || role === "INS") &&
            (userRole === "inspector-qa" || userRole === "group-leader-qa")
          ) {
            router.push(`/status-pre-assy?viewAs=inspector&area=${areaCode}`);
            return;
          }
        }
      }

      // Format: GAUGE:TYPE:CODE:AREA
      if (parts[0] === "GAUGE" && parts.length >= 4) {
        const [, type, code, area] = parts;
        router.push(`/status-final-assy?gauge=${code}&type=${type}&area=${area}`);
        return;
      }

      // Format langsung URL
      if (qrData.startsWith("/")) {
        router.push(qrData);
        return;
      }

      if (qrData.startsWith("http://") || qrData.startsWith("https://")) {
        const url = new URL(qrData);
        router.push(url.pathname + url.search);
        return;
      }

      // Jika format tidak dikenali
      alert("QR Code tidak dikenali atau format tidak valid");
    } catch (error) {
      console.error("Error parsing QR code:", error);
      alert("Gagal memproses QR Code");
    }
  };

  // ===== EARLY RETURN: LOADING STATE =====
  // ✅ Tampilkan loading selama authLoading ATAU belum isInitialized
  if (authLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat autentikasi...</p>
        </div>
      </div>
    );
  }

  // ✅ Setelah initialized, jika user masih null akan redirect di useEffect
  if (!user) {
    return null;
  }

  const userName = user.fullName || "User";
  const currentRole = user.role;
  
  const dashboardLink = (() => {
    switch (currentRole) {
      case "inspector-ga": return "/ga-dashboard";
      case "inspector-qa": return "/qa-dashboard";
      case "group-leader-qa": return "/gl-dashboard";
      default: return "/dashboard";
    }
  })();

  return (
    <>
      <Sidebar userName={userName} />
      
      <main className="main-content">
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
              <path
                d="M80 75L95 90L120 60"
                stroke="#8B5CF6"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* QR Scanner Info Card */}
        <section className="section">
          <div className="scanner-info-card">
            <div className="scanner-icon-wrapper">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="15" x2="15" y2="15" />
                <line x1="9" y1="9" x2="9" y2="15" />
                <line x1="15" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="scanner-content">
              <h2 className="scanner-title">📷 Scan QR Code untuk Mulai</h2>
              <p className="scanner-description">
                Tekan tombol scanner infra merah pada device TC21 (tombol kuning di samping) 
                untuk scan QR Code checklist. Halaman akan otomatis terbuka sesuai kode yang discan.
              </p>
              <div className="scanner-hint">
                <strong>Format QR Code:</strong> CHECKLIST:CATEGORY:ROLE:AREA_CODE
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
            <a href={dashboardLink} className="view-all-btn">
              Lihat Semua →
            </a>
          </div>
          <div className="activity-list">
            {activities.length > 0 ? (
              activities.map((act, i) => (
                <div key={i} className="activity-item">
                  <div className={`activity-icon ${act.status === "OK" ? "ok" : "ng"}`} aria-hidden="true">
                    {act.status === "OK" ? "✓" : "✗"}
                  </div>
                  <div className="activity-content">
                    <h3 className="activity-title">{act.title}</h3>
                    <p className="activity-desc">Diselesaikan oleh {act.user}</p>
                  </div>
                  <div className="activity-meta">
                    <span className="activity-time">{act.time}</span>
                    <span className={`activity-status ${act.status === "OK" ? "ok" : "ng"}`}>
                      {act.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-activity">Belum ada aktivitas checklist hari ini.</p>
            )}
          </div>
        </section>
      </main>

      <style jsx>{`
        .main-content {
          flex: 1;
          padding: 24px;
          min-height: calc(100vh - 64px);
          max-width: 1200px;
          margin: 0 auto;
          padding-top: 20px;
        }

        .welcome-banner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
          gap: 24px;
        }

        .welcome-title {
          font-size: 26px;
          font-weight: 700;
          color: white;
          margin: 0 0 12px 0;
        }

        .welcome-text {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          line-height: 1.6;
        }

        .welcome-illustration {
          flex-shrink: 0;
        }

        .scanner-info-card {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
          border-left: 5px solid #3b82f6;
          margin-bottom: 32px;
        }

        .scanner-icon-wrapper {
          background: white;
          width: 64px;
          height: 64px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b82f6;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .scanner-content {
          flex: 1;
        }

        .scanner-title {
          font-size: 20px;
          font-weight: 700;
          color: #1e40af;
          margin: 0 0 8px 0;
        }

        .scanner-description {
          font-size: 14px;
          color: #1e40af;
          margin: 0 0 12px 0;
          line-height: 1.6;
        }

        .scanner-hint {
          background: rgba(255, 255, 255, 0.6);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          color: #1e40af;
          font-family: monospace;
        }

        .section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #1a202c;
          margin: 0 0 4px 0;
        }

        .section-desc {
          font-size: 14px;
          color: #718096;
          margin: 0;
        }

        .view-all-btn {
          color: #8b5cf6;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .view-all-btn:hover {
          background: #f3f4f6;
          transform: translateX(4px);
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          background: white;
          border-radius: 12px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
          border: 1px solid #f5f5f5;
        }

        .activity-item:hover {
          background: #f8fafc;
          transform: translateX(4px);
        }

        .activity-icon.ok {
          background: #d1fae5;
          color: #10b981;
        }

        .activity-icon.ng {
          background: #fee2e2;
          color: #ef4444;
        }

        .activity-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
          flex-shrink: 0;
        }

        .activity-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a202c;
          margin: 0 0 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-desc {
          font-size: 12px;
          color: #718096;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }

        .activity-time {
          font-size: 11px;
          color: #a0aec0;
          white-space: nowrap;
        }

        .activity-status {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .activity-status.ok {
          background: #d1fae5;
          color: #059669;
        }

        .activity-status.ng {
          background: #fee2e2;
          color: #dc2626;
        }

        .empty-activity {
          padding: 16px;
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          background: white;
          border-radius: 12px;
          border: 1px solid #f1f5f9;
        }

        @media (max-width: 768px) {
          .main-content {
            padding: 14px;
            width: 100%;
          }

          .welcome-banner {
            flex-direction: column;
            text-align: center;
            padding: 16px;
            margin-bottom: 20px;
            gap: 16px;
          }

          .welcome-illustration {
            width: 100%;
            display: flex;
            justify-content: center;
          }

          .welcome-illustration svg {
            max-width: 140px;
            height: auto;
          }

          .welcome-title {
            font-size: 20px;
            margin-bottom: 8px;
          }

          .welcome-text {
            font-size: 13px;
            line-height: 1.5;
          }

          .scanner-info-card {
            flex-direction: column;
            padding: 16px;
          }

          .scanner-icon-wrapper {
            width: 56px;
            height: 56px;
          }

          .scanner-title {
            font-size: 17px;
          }

          .scanner-description {
            font-size: 13px;
          }

          .section-title {
            font-size: 17px;
          }

          .section-desc {
            font-size: 12px;
          }

          .view-all-btn {
            align-self: flex-start;
            font-size: 13px;
            padding: 6px 12px;
          }

          .activity-item {
            padding: 14px;
            gap: 12px;
            border-radius: 10px;
          }

          .activity-icon {
            min-width: 40px;
            width: 40px;
            height: 40px;
          }

          .activity-title {
            font-size: 13px;
          }

          .activity-desc {
            font-size: 11px;
          }

          .activity-meta {
            gap: 4px;
          }

          .activity-time {
            font-size: 10px;
          }

          .activity-status {
            font-size: 10px;
            padding: 3px 8px;
          }

          .empty-activity {
            padding: 14px;
            font-size: 12px;
            border-radius: 10px;
          }
        }

        @media (max-width: 480px) {
          .main-content {
            padding: 10px;
          }

          .welcome-banner {
            padding: 12px;
            margin-bottom: 16px;
          }

          .welcome-title {
            font-size: 18px;
            margin-bottom: 6px;
          }

          .welcome-text {
            font-size: 12px;
            line-height: 1.4;
          }

          .welcome-illustration svg {
            width: 120px;
            height: auto;
          }

          .section {
            margin-bottom: 18px;
          }

          .scanner-info-card {
            padding: 14px;
            border-radius: 10px;
          }

          .scanner-icon-wrapper {
            width: 48px;
            height: 48px;
            border-radius: 8px;
          }

          .scanner-title {
            font-size: 15px;
            margin-bottom: 4px;
          }

          .scanner-description {
            font-size: 11px;
            margin-bottom: 10px;
          }

          .scanner-hint {
            font-size: 10px;
            padding: 6px 8px;
          }

          .section-header {
            margin-bottom: 12px;
            gap: 8px;
          }

          .section-title {
            font-size: 16px;
            margin-bottom: 2px;
          }

          .section-desc {
            font-size: 11px;
          }

          .view-all-btn {
            font-size: 12px;
            padding: 6px 10px;
            border-radius: 6px;
          }

          .activity-list {
            gap: 8px;
          }

          .activity-item {
            padding: 12px;
            gap: 10px;
            flex-wrap: wrap;
            border-radius: 9px;
          }

          .activity-icon {
            min-width: 36px;
            width: 36px;
            height: 36px;
            border-radius: 6px;
          }

          .activity-content {
            flex: 1;
            min-width: 0;
          }

          .activity-title {
            font-size: 12px;
            margin-bottom: 2px;
          }

          .activity-desc {
            font-size: 10px;
          }

          .activity-meta {
            width: 100%;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
          }

          .activity-time {
            font-size: 9px;
          }

          .activity-status {
            font-size: 9px;
            padding: 3px 8px;
            border-radius: 4px;
          }

          .empty-activity {
            padding: 12px;
            font-size: 11px;
            border-radius: 8px;
          }
        }
      `}</style>
    </>
  );
}