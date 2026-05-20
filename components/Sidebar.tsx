// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useState, useEffect, useRef, memo } from "react";
import { useAuth } from "@/lib/auth-context";

interface NgReport {
  id: string;
  title: string;
  area: string;
  timestamp: string;
  url: string;
}

interface SidebarProps {
  userName?: string;
  userRole?: string;
}

// ✅ React.memo — Sidebar tidak re-render saat parent re-render
// (kecuali props userName/userRole benar-benar berubah)
export const Sidebar = memo(function Sidebar({ userName = "User", userRole = "Role" }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-expanded") === "true";
    }
    return false;
  });
  const [ngReports, setNgReports] = useState<NgReport[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNotificationHovered, setIsNotificationHovered] = useState(false);

  // ✅ TIDAK pakai useRouter() atau usePathname() — keduanya subscribe ke router context
  // dan menyebabkan re-render setiap kali Next.js internal router berubah.
  // Navigasi dilakukan via window.location (tidak ada subscription).
  // pathname dibaca sekali dari window.location.pathname saat mount.
  const [currentPath, setCurrentPath] = useState("");

  const { user, logout } = useAuth();
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  // ✅ Baca pathname SEKALI saat mount — tidak subscribe ke apapun
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  // ✅ Extract primitif dari user — bukan object langsung
  // useAuth() sudah memo-ized di auth-context, tapi untuk keamanan
  // kita ekstrak primitif agar tidak tergantung referensi object
  const currentRole     = user?.role     ?? "";
  const currentUserName = user?.username ?? userName;

  // Deteksi ukuran layar — hanya baca sekali saat mount + resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []); // ✅ deps kosong — tidak trigger saat parent re-render

  // ✅ SIMPAN STATE SIDEBAR KE LOCALSTORAGE + DISPATCH EVENT
  // CustomEvent "sidebar-toggle" dipakai oleh halaman lain untuk
  // sync margin-left konten secara real-time tanpa polling.
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("sidebar-expanded", String(isExpanded));
    // Dispatch event agar consumer (home, status, dll) langsung tahu
    window.dispatchEvent(new CustomEvent("sidebar-toggle", {
      detail: { expanded: isExpanded, isMobile: window.innerWidth <= 768 }
    }));
  }, [isExpanded]);

  // ✅ Fetch NG reports — deps hanya currentRole (primitif string, stabil)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchNgReports = () => {
      try {
        if (currentRole !== "inspector-ga") {
          setNgReports([]);
          return;
        }
        const historyStr = localStorage.getItem("checksheet_history");
        if (!historyStr) { setNgReports([]); return; }
        const history = JSON.parse(historyStr);
        if (!Array.isArray(history)) { setNgReports([]); return; }
        const ngItems = history
          .filter((item: any) => item?.status === "NG")
          .sort((a: any, b: any) => new Date(b.filledAt).getTime() - new Date(a.filledAt).getTime())
          .slice(0, 10)
          .map((item: any) => ({
            id: item.id || `ng-${Date.now()}-${Math.random()}`,
            title: `Masalah di ${item.area || "Area Tidak Diketahui"}`,
            area: item.area || "Area Tidak Diketahui",
            timestamp: new Date(item.filledAt).toLocaleDateString("id-ID"),
            url: `/pelaporan-list?reportId=${item.id || ""}`,
          }));
        setNgReports(ngItems);
      } catch {
        setNgReports([]);
      }
    };

    fetchNgReports();
    window.addEventListener("storage", fetchNgReports);
    return () => window.removeEventListener("storage", fetchNgReports);
  }, [currentRole]); // currentRole adalah primitif string — stabil setelah login

  // Tutup popup saat klik di luar (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !isMobile &&
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        notificationButtonRef.current &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    };
    if (isNotificationOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationOpen, isMobile]);

  type MenuItem = {
    label: string;
    href: string;
    icon: React.ReactNode;
  };

  const menuByRole: Record<string, MenuItem[]> = {
    admin: [
      {
        label: "Checking Process",
        href: "/home",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
      {
        label: "QR Generator",
        href: "/admin/qr-generator",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="3" width="5" height="5" />
            <rect x="16" y="3" width="5" height="5" />
            <rect x="3" y="16" width="5" height="5" />
            <path d="M16 16h2v2h-2zM20 16h1v5h-5v-1" />
          </svg>
        ),
      },
      {
        label: "Device ID Register",
        href: "/admin/devices",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        ),
      },
      {
        label: "Status Final Assy",
        href: "/status-final-assy",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
      {
        label: "Status Pre Assy",
        href: "/status-pre-assy",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <path d="M12 3v4" />
            <rect x="5" y="7" width="14" height="14" rx="2" />
          </svg>
        ),
      },
    ],

    "inspector-qa": [
      {
        label: "Checking Process",
        href: "/home",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
      {
        label: "Status Pre-Assy",
        href: "/status-pre-assy",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <path d="M12 3v4" />
            <rect x="5" y="7" width="14" height="14" rx="2" />
          </svg>
        ),
      },
      {
        label: "Status Final-Assy",
        href: "/status-final-assy",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ],

    "group-leader-qa": [
      {
        label: "Checking Process",
        href: "/home",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
      {
        label: "Status Pre-Assy",
        href: "/status-pre-assy",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <path d="M12 3v4" />
            <rect x="5" y="7" width="14" height="14" rx="2" />
          </svg>
        ),
      },
      {
        label: "Status Final-Assy",
        href: "/status-final-assy",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ],
  };

  const sidebarMenus = menuByRole[currentRole] || [];

  // ✅ Logout: gunakan window.location, bukan router.push
  const handleLogout = () => {
    if (logout) logout();
    window.location.href = "/login-page";
  };

  const openNotifications = () => setIsNotificationOpen((v) => !v);

  const handleNotificationItemClick = (url: string) => {
    setIsNotificationOpen(false);
    window.location.href = url;
  };

  return (
    <>
      {/* 📱 Mobile Toggle Button */}
      {isMobile && (
        <button
          className="mobile-toggle-btn"
          onClick={() => setIsExpanded((v) => !v)}
          aria-label={isExpanded ? "Close sidebar" : "Open sidebar"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            {isExpanded
              ? <path d="M18 6L6 18M6 6l12 12" />
              : <path d="M3 12h18M3 6h18M3 18h18" />
            }
          </svg>
        </button>
      )}

      {/* 📱 Mobile Overlay */}
      {isMobile && isExpanded && (
        <div className="mobile-sidebar-overlay" onClick={() => setIsExpanded(false)} />
      )}

      <div className={`sidebar-container ${isExpanded ? "expanded" : "collapsed"} ${isMobile ? "mobile" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo-section">
            {isExpanded ? (
              <div className="logo-wrapper">
                <img src="/images/yazaki-logo.jpg" alt="YAZAKI Logo" className="logo-img" />
              </div>
            ) : (
              <div className="icon-wrapper">
                <img src="/images/logo.png" alt="YAZAKI Icon" className="icon-img" />
              </div>
            )}
          </div>
          {!isMobile && (
            <button
              className="sidebar-toggle-btn"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                {isExpanded
                  ? <path d="M15 18l-6-6 6-6" />
                  : <path d="M9 6l6 6-6 6" />
                }
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="sidebar-body">
          <nav className="sidebar-navigation">
            {sidebarMenus.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className={`menu-item ${currentPath === menu.href ? "active" : ""}`}
                onClick={() => {
                  if (isMobile) setIsExpanded(false);
                }}
              >
                <span className="menu-icon">
                  {menu.icon}
                </span>

                {isExpanded && (
                  <span className="menu-label">
                    {menu.label}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar">
                {currentUserName.charAt(0).toUpperCase()}
              </div>
              {isExpanded && (
                <div className="user-info">
                  <p className="user-name">{currentUserName}</p>
                  <p className="user-role">{currentRole}</p>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="menu-item logout-button" title="Logout">
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              {isExpanded && <span className="menu-label">Logout</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Popup Notifikasi */}
      {isNotificationOpen && (
        <div className="notification-popup-container">
          <div
            className="notification-popup-overlay"
            onClick={() => { if (!isMobile) setIsNotificationOpen(false); }}
          />
          <div
            ref={notificationRef}
            className={`notification-popup ${isMobile ? "mobile" : ""}`}
            style={isMobile ? {} : {
              top: `${(notificationButtonRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY}px`,
              left: `${(notificationButtonRef.current?.getBoundingClientRect().right ?? 0) + window.scrollX + 12}px`,
              transform: "translateY(-50%)",
            }}
          >
            <div className="notification-popup-header">
              <h3 className="notification-popup-title">Notifikasi Masalah</h3>
              <span className="notification-popup-count">{ngReports.length} masalah</span>
              <button className="notification-popup-close" onClick={() => setIsNotificationOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="notification-popup-content">
              {ngReports.length > 0 ? (
                ngReports.map((report) => (
                  <div key={report.id} onClick={() => handleNotificationItemClick(report.url)} className="notification-item-row">
                    <div className="notification-item-icon">
                      <div className="notification-item-icon-bg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                    </div>
                    <div className="notification-item-content">
                      <p className="notification-item-title">{report.title}</p>
                      <p className="notification-item-area">{report.area}</p>
                      <p className="notification-item-time">{report.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="notification-empty">
                  <p>Tidak ada masalah NG.</p>
                  <p className="notification-empty-subtitle">Semua sistem berjalan normal</p>
                </div>
              )}
            </div>
            {ngReports.length > 0 && (
              <div className="notification-popup-footer">
                <button
                  onClick={() => { setIsNotificationOpen(false); window.location.href = "/pelaporan-list"; }}
                  className="notification-view-all"
                >
                  Lihat Semua Laporan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .sidebar-container{position:fixed;left:0;top:0;height:100vh;display:flex;flex-direction:column;transition:width 0.3s ease,transform 0.3s ease;z-index:101;box-shadow:4px 0 12px rgba(0,0,0,0.1);background:linear-gradient(180deg,#1e40af 0%,#1e3a8a 100%);}
        .sidebar-container.collapsed{width:70px;}
        .sidebar-container.expanded{width:240px;}
        .sidebar-container.mobile.collapsed{transform:translateX(-100%);width:240px;}
        .sidebar-container.mobile.expanded{transform:translateX(0);width:240px;}
        .sidebar-header{padding:20px 16px;display:flex;justify-content:space-between;align-items:center;min-height:80px;position:relative;background:white;border-bottom:1px solid #e5e7eb;}
        .logo-section{display:flex;align-items:center;justify-content:center;flex:1;}
        .logo-wrapper{width:100%;max-width:180px;text-align:center;}
        .logo-img{width:100%;height:auto;max-height:40px;}
        .icon-wrapper{display:flex;justify-content:center;align-items:center;}
        .icon-img{width:28px;height:28px;}
        .sidebar-toggle-btn{background:#1e40af;border:1px solid rgba(30,64,175,0.3);width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s ease;flex-shrink:0;margin-left:12px;}
        .sidebar-toggle-btn:hover{background:#1e3a8a;transform:scale(1.05);}
        .sidebar-body{flex:1;background:linear-gradient(180deg,#1e40af 0%,#1e3a8a 100%);color:white;display:flex;flex-direction:column;}
        .sidebar-navigation{flex:1;padding:20px 0;display:flex;flex-direction:column;gap:8px;}
        .menu-item{display:flex;align-items:center;gap:12px;padding:12px 16px;color:rgba(255,255,255,0.85);text-decoration:none;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);border-left:3px solid transparent;background:transparent;border:none;cursor:pointer;width:100%;text-align:left;position:relative;font-weight:400;}
        .menu-item:hover{background:rgba(255,255,255,0.18)!important;color:white!important;border-left-color:rgba(96,165,250,0.7)!important;transform:translateX(2px);font-weight:500!important;}
        .menu-item.active{background:rgba(255,255,255,0.15);color:white;border-left-color:#60a5fa;font-weight:500;box-shadow:inset 0 0 10px rgba(96,165,250,0.2);}
        .menu-item.active:hover{background:rgba(255,255,255,0.25)!important;border-left-color:#93c5fd!important;}
        .menu-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;transition:transform 0.2s ease;}
        .menu-item:hover .menu-icon{transform:scale(1.1);}
        .menu-label{font-size:14px;white-space:nowrap;opacity:0;animation:fadeIn 0.3s ease forwards;}
        .sidebar-footer{padding:20px 16px;border-top:1px solid rgba(255,255,255,0.1);}
        .user-profile{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
        .user-avatar{width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px;color:white;flex-shrink:0;}
        .user-info{opacity:0;animation:fadeIn 0.3s ease forwards;}
        .user-name{font-size:14px;font-weight:600;margin:0;line-height:1.2;}
        .user-role{font-size:12px;opacity:0.8;margin:0;line-height:1.2;}
        .logout-button:hover{background:rgba(255,255,255,0.18)!important;color:white!important;border-left-color:rgba(248,113,113,0.7)!important;transform:translateX(2px);}
        .mobile-toggle-btn{position:fixed;top:16px;right:16px;background:linear-gradient(135deg,#1e40af 0%,#1e3a8a 100%);border:none;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(30,64,175,0.3);z-index:50;transition:all 0.2s ease;}
        .mobile-toggle-btn:hover{transform:scale(1.05);}
        .mobile-sidebar-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:35;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:fadeInOverlay 0.3s ease;cursor:pointer;}
        .notification-badge{position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;font-size:10px;font-weight:600;border-radius:9999px;height:18px;min-width:18px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #1e40af;animation:pulse 2s infinite;z-index:10;}
        .notification-popup-container{position:fixed;inset:0;z-index:50;pointer-events:none;}
        .notification-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.2);pointer-events:auto;}
        .notification-popup{background:white;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.1);width:380px;max-height:500px;overflow:hidden;pointer-events:auto;animation:slideIn 0.2s ease-out;position:fixed;transform-origin:left top;}
        .notification-popup.mobile{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:calc(100vw - 32px);max-width:400px;max-height:80vh;}
        .notification-popup-header{padding:16px 20px;border-bottom:1px solid #f3f4f6;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;}
        .notification-popup-title{font-size:16px;font-weight:600;color:#1f2937;margin:0;}
        .notification-popup-count{background:#ef4444;color:white;font-size:12px;font-weight:500;padding:4px 10px;border-radius:9999px;}
        .notification-popup-close{background:transparent;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;color:#6b7280;}
        .notification-popup-content{max-height:350px;overflow-y:auto;}
        .notification-popup-footer{padding:16px 20px;border-top:1px solid #f3f4f6;background:#f8fafc;}
        .notification-view-all{width:100%;padding:10px 16px;background:#1e40af;color:white;border:none;border-radius:8px;font-weight:500;cursor:pointer;}
        .notification-view-all:hover{background:#1e3a8a;}
        .notification-item-row{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid #f3f4f6;}
        .notification-item-row:hover{background:#f8fafc;}
        .notification-item-icon-bg{width:32px;height:32px;background:#fef2f2;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#ef4444;}
        .notification-item-title{font-size:13px;font-weight:600;color:#1f2937;margin:0 0 2px;}
        .notification-item-area{font-size:12px;color:#6b7280;margin:0 0 2px;}
        .notification-item-time{font-size:11px;color:#9ca3af;margin:0;}
        .notification-empty{padding:24px;text-align:center;color:#6b7280;}
        .notification-empty-subtitle{font-size:12px;color:#9ca3af;margin-top:4px;}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-10px);}to{opacity:1;transform:translateX(0);}}
        @keyframes fadeInOverlay{from{opacity:0;}to{opacity:1;}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-10px) scale(0.95);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}
        @media(max-width:768px){
          .sidebar-container{box-shadow:0 0 20px rgba(0,0,0,0.2);}
          .sidebar-container.mobile.collapsed{transform:translateX(-100%);}
          .notification-popup{width:calc(100vw - 32px);max-width:400px;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;}
        }
      `}</style>
    </>
  );
});