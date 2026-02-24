// app/home/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  FileText,
  Wrench,
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";

interface CardData {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  href: string;
}

interface ActivityItem {
  title: string;
  user: string;
  time: string;
  status: "OK" | "NG";
}

export default function ModernHomePage() {
  // ✅ SEMUA HOOKS DIPANGGIL PERTAMA KALI, TANPA KONDISI
  const { user, loading } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // 🔁 Muat aktivitas hari ini - DIPINDAH KE ATAS SEBELUM CONDITIONAL LOGIC
  useEffect(() => {
    let isMounted = true; // Safety flag untuk hindari state update setelah unmount

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
      isMounted = false; // Cleanup: tandai komponen sudah unmount
    };
  }, []); // Hanya jalan sekali saat mount

  // ✅ CONDITIONAL LOGIC DILAKUKAN SETELAH SEMUA HOOKS
  if (loading) {
    return (
      <div className="modern-home-page">
        <Sidebar userName="Loading..." />
        <main className="main-content">
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            Memuat data...
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null; // Redirect ke login sebaiknya ditangani di layout/route level
  }

  // ✅ LOGIC BISNIS SETELAH VALIDASI AUTH
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

  const roleCards: Record<string, CardData[]> = {
    "group-leader-qa": [
      {
        id: "final-assy",
        icon: Wrench,
        title: "Final Assy",
        description: "Daily check untuk Final Assembly",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        href: "/status-final-assy?subType=group-leader-qa",
      },
      {
        id: "pre-assy",
        icon: Wrench,
        title: "Pre-Assy",
        description: "Daily check dan CC Stripping",
        gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        href: "/status-pre-assy?subType=group-leader-qa",
      },
    ],
    "inspector-qa": [
      {
        id: "final-assy",
        icon: Wrench,
        title: "Final Assy",
        description: "Inspeksi Final Assembly",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        href: "/status-final-assy?subType=inspector-qa",
      },
      {
        id: "pre-assy",
        icon: Wrench,
        title: "Pre-Assy",
        description: "Inspeksi Pre-Assembly",
        gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        href: "/status-pre-assy?subType=inspector-qa",
      },
    ],
    "inspector-ga": [
      {
        id: "checklist-ga",
        icon: Building2,
        title: "Checklist GA",
        description: "Kebersihan, keamanan, fasilitas",
        gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        href: "/status-ga",
      },
    ],
  };

  const currentRoleCards = roleCards[currentRole] || [];

  return (
    <div className="modern-home-page">
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

        {/* Role-based Cards */}
        {currentRoleCards.length > 0 && (
          <section className="section">
            <div className="section-header">
              <div>
                <h2 className="section-title">📋 Menu Utama</h2>
                <p className="section-desc">Akses area checklist sesuai role Anda</p>
              </div>
            </div>
            <div className="cards-grid">
              {currentRoleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.id} href={card.href} className="feature-card-link">
                    <div className="feature-card" style={{ background: card.gradient }}>
                      <div className="card-header">
                        <div className="card-icon">
                          <Icon size={24} color="white" aria-hidden="true" />
                        </div>
                        <ChevronRight size={18} color="white" aria-hidden="true" />
                      </div>
                      <h3 className="card-title">{card.title}</h3>
                      <p className="card-desc">{card.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        <section className="section">
          <div className="section-header">
            <div>
              <h2 className="section-title">🕐 Aktivitas Terbaru</h2>
              <p className="section-desc">Checklist yang baru saja diselesaikan</p>
            </div>
            <Link href={dashboardLink} className="view-all-btn">
              Lihat Semua →
            </Link>
          </div>
          <div className="activity-list">
            {activities.length > 0 ? (
              activities.map((act, i) => (
                <div key={i} className="activity-item">
                  <div className={`activity-icon ${act.status === "OK" ? "ok" : "ng"}`} aria-hidden="true">
                    {act.status === "OK" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
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
        /* ... (style tetap sama, tidak diubah) ... */
        .modern-home-page {
          display: flex;
          min-height: 100vh;
          background-color: #f5f6fa;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .feature-card-link {
          text-decoration: none;
          display: block;
        }

        .feature-card {
          border-radius: 16px;
          padding: 24px;
          color: white;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
          gap: 12px;
        }

        .card-icon {
          width: 52px;
          height: 52px;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          flex-shrink: 0;
        }

        .card-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.3;
        }

        .card-desc {
          font-size: 13px;
          opacity: 0.9;
          margin: 0 0 20px 0;
          line-height: 1.5;
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

        .activity-icon.ok {
          background: #d1fae5;
          color: #10b981;
        }
        .activity-icon.ng {
          background: #fee2e2;
          color: #ef4444;
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

        @media (max-width: 768px) {
          .modern-home-page {
            flex-direction: column;
          }
          .main-content {
            padding: 16px;
          }
          .welcome-banner {
            flex-direction: column;
            text-align: center;
            padding: 20px;
          }
          .cards-grid {
            grid-template-columns: 1fr;
          }
          .section-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .view-all-btn {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
}