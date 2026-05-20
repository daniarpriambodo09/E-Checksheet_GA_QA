// app/_offline/page.tsx
//
// Halaman fallback yang ditampilkan oleh Service Worker saat:
//   1. Pengguna offline
//   2. NetworkFirst gagal (timeout 5 detik)
//   3. Cache untuk halaman yang diminta juga kosong
//
// PENTING: File ini WAJIB ada agar `fallbacks: { document: "/_offline" }`
// di next.config.mjs bekerja. next-pwa akan otomatis precache URL ini
// saat build, sehingga SW selalu bisa serve halaman ini bahkan saat offline.
//
// Alur SW (simplified):
//   navigate request
//     → try network (5s timeout)
//     → gagal → try pages-cache
//     → tidak ada → serve /_offline  ← halaman ini

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Cek status online saat mount
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-redirect ke /home saat koneksi kembali
      setTimeout(() => router.push("/home"), 800);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Coba navigasi balik ke /home — jika ada di cache, berhasil
      router.push("/home");
    } catch {
      setRetrying(false);
    }
  };

  const handleGoToChecklist = () => {
    // Coba navigasi ke halaman utama yang mungkin sudah ada di pages-cache
    router.push("/checksheet-final-assy");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "40px 32px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 64, marginBottom: 20 }}>
          {isOnline ? "🟢" : "📡"}
        </div>

        {/* Status badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 999,
            background: isOnline
              ? "rgba(34,197,94,0.15)"
              : "rgba(239,68,68,0.15)",
            border: `1px solid ${isOnline ? "#22c55e" : "#ef4444"}`,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isOnline ? "#22c55e" : "#ef4444",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: isOnline ? "#22c55e" : "#ef4444",
              letterSpacing: "0.05em",
            }}
          >
            {isOnline ? "ONLINE — Mengalihkan..." : "TIDAK ADA KONEKSI"}
          </span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "white",
            margin: "0 0 12px",
          }}
        >
          {isOnline ? "Koneksi Kembali!" : "Halaman Belum Tersedia Offline"}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.6,
            margin: "0 0 28px",
          }}
        >
          {isOnline
            ? "Koneksi internet tersedia. Sedang mengalihkan ke halaman utama..."
            : "Halaman ini belum pernah dibuka sebelumnya sehingga belum ada di cache. Coba navigasi ke halaman yang pernah dibuka saat online."}
        </p>

        {/* Action buttons */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{
              padding: "13px 20px",
              background: "linear-gradient(135deg, #1e88e5, #1565c0)",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: retrying ? "wait" : "pointer",
              opacity: retrying ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {retrying ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Mencoba...
              </>
            ) : (
              "🏠 Ke Halaman Utama"
            )}
          </button>

          <button
            onClick={handleGoToChecklist}
            style={{
              padding: "13px 20px",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📋 Buka Checklist Final Assy
          </button>
        </div>

        {/* Info: halaman yang mungkin tersedia di cache */}
        <div
          style={{
            marginTop: 28,
            padding: "14px 16px",
            background: "rgba(30,136,229,0.1)",
            border: "1px solid rgba(30,136,229,0.2)",
            borderRadius: 10,
            textAlign: "left",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              color: "#60a5fa",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            💾 Halaman yang mungkin tersedia offline:
          </p>
          {[
            { path: "/home", label: "Home" },
            { path: "/checksheet-final-assy", label: "Checksheet Final Assy" },
            { path: "/status-final-assy", label: "Status Final Assy" },
          ].map(({ path, label }) => (
            <button
              key={path}
              onClick={() => router.push(path)}
              style={{
                display: "block",
                width: "100%",
                padding: "7px 10px",
                marginBottom: 4,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.65)",
                fontSize: 13,
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 6,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              → {label}
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginLeft: 6,
                }}
              >
                {path}
              </span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}