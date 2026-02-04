// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface SidebarProps {
  userName?: string;
  userRole?: string;
}

export function Sidebar({ userName = "User", userRole = "Role" }: SidebarProps) {
  // 🔁 Ubah default sidebar ke TERTUTUP
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeMenu, setActiveMenu] = useState("/ga-home");
  const [screenSize, setScreenSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const router = useRouter();
  const { user, logout } = useAuth();
  const isMobile = screenSize === "mobile";

  const currentRole = user?.role || "";
  const currentUserName = user?.username || "User";

  // Deteksi ukuran layar dengan 3 breakpoint
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 480) {
        setScreenSize("mobile");
        setIsMobileOpen(false);
      } else if (width <= 1024) {
        setScreenSize("tablet");
        setIsMobileOpen(false);
      } else {
        setScreenSize("desktop");
        setIsMobileOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getHomeRoute = () => {
    const role = currentRole.toLowerCase();
    if (role.includes("inspector-ga") || role === "ga") return "/home";
    if (role.includes("inspector-qa") || role === "qa") return "/home";
    if (role.includes("group-leader-qa") || role === "qa") return "/home";
    return "/home";
  };

  const getDashboardRoute = () => {
    const role = currentRole.toLowerCase();
    if (role.includes("inspector-ga") || role === "ga") return "/ga-dashboard";
    if (role.includes("inspector-qa") || role === "group-leader-qa") return "/qa-dashboard";
    return "/dashboard";
  };

  const getLaporanRoute = () => {
    const role = currentRole.toLowerCase();
    if (role.includes("admin")) {
      return "/pelaporan-list";
    }
    return "/laporan";
  };

  const toggleSidebar = () => {
    if (screenSize === "mobile") {
      setIsMobileOpen(!isMobileOpen);
    } else {
      // Both tablet and desktop use collapse mode
      setIsExpanded(!isExpanded);
    }
  };

  const closeMobileSidebar = () => {
    if (screenSize !== "desktop") setIsMobileOpen(false);
  };

  const handleLogout = () => {
    if (logout) logout();
    closeMobileSidebar();
    router.push("/login-page");
  };

  const handleNavClick = (route: string) => {
    setActiveMenu(route);
    closeMobileSidebar();
  };

  if (!isMounted) return null;

  // Di mobile, sidebar jadi drawer. Di tablet, sidebar tetap visible (fixed)
  if (screenSize === "mobile") {
    return (
      <>
        {/* Overlay hanya untuk mobile */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Drawer Sidebar untuk mobile */}
        <aside
          className={`fixed left-0 top-0 z-50 h-full w-64 bg-[#0d47a1] text-white transform transition-transform duration-300 ease-in-out ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Header dengan tombol tutup */}
            <div className="sidebar-header relative p-5 border-b border-white/10 bg-black/10">
              <div className="logo-wrapper flex items-center gap-3">
                <div className="logo-icon w-10 h-10 rounded-md bg-white/15 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <div className="logo-content">
                  <h1 className="logo-title font-bold">E-Checksheet</h1>
                  <p className="logo-subtitle text-xs opacity-80">Management System</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 right-4 text-white"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar-navigation flex-1 p-4 space-y-2">
              <Link
                href={getHomeRoute()}
                className={`menu-item flex items-center gap-3 px-3 py-2 rounded-lg ${
                  activeMenu === getHomeRoute() ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`}
                onClick={() => handleNavClick(getHomeRoute())}
              >
                <span className="menu-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </span>
                <span>Home</span>
              </Link>

              <Link
                href={getDashboardRoute()}
                className={`menu-item flex items-center gap-3 px-3 py-2 rounded-lg ${
                  activeMenu === getDashboardRoute() ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`}
                onClick={() => handleNavClick(getDashboardRoute())}
              >
                <span className="menu-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </span>
                <span>Dashboard</span>
              </Link>

              <Link
                href={getLaporanRoute()}
                className={`menu-item flex items-center gap-3 px-3 py-2 rounded-lg ${
                  activeMenu === getLaporanRoute() ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`}
                onClick={() => handleNavClick(getLaporanRoute())}
              >
                <span className="menu-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <span>Laporan</span>
              </Link>
            </nav>

            {/* Footer */}
            <div className="sidebar-footer p-4 border-t border-white/10 bg-black/10">
              <div className="user-profile flex items-center gap-3 mb-4">
                <div className="user-avatar w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-bold">
                  {currentUserName.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <p className="user-name text-sm font-semibold">{currentUserName}</p>
                  <p className="user-role text-xs opacity-80">{currentRole}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="logout-button flex items-center gap-2 w-full px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 hover:bg-red-800/50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Tombol "Menu" hanya muncul di mobile saat sidebar tertutup */}
        {!isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(true)}
            className="fixed top-4 left-4 z-50 bg-blue-600 text-white p-2 rounded-md shadow-lg"
            aria-label="Open menu"
          >
            ☰
          </button>
        )}
      </>
    );
  }

  // Tablet mode (481px - 1024px): Sidebar fixed, dapat collapse
  if (screenSize === "tablet") {
    return (
      <div className={`sidebar-container ${isExpanded ? '' : 'collapsed'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            {!isExpanded && <div className="flex-1"></div>}
            {isExpanded && (
              <div className="logo-content">
                <h1 className="logo-title">E-Checksheet</h1>
                <p className="logo-subtitle">Management System</p>
              </div>
            )}
          </div>
          <button className="toggle-button" onClick={toggleSidebar} aria-label="Toggle sidebar">
            {isExpanded ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-navigation">
          <Link 
            href={getHomeRoute()} 
            className={`menu-item ${activeMenu === getHomeRoute() ? 'active' : ''}`}
            onClick={() => handleNavClick(getHomeRoute())}
          >
            <span className="menu-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            {isExpanded && <span className="menu-label">Home</span>}
          </Link>

          <Link 
            href={getDashboardRoute()} 
            className={`menu-item ${activeMenu === getDashboardRoute() ? 'active' : ''}`}
            onClick={() => handleNavClick(getDashboardRoute())}
          >
            <span className="menu-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            {isExpanded && <span className="menu-label">Dashboard</span>}
          </Link>

          <Link 
            href={getLaporanRoute()} 
            className={`menu-item ${activeMenu === getLaporanRoute() ? 'active' : ''}`}
            onClick={() => handleNavClick(getLaporanRoute())}
          >
            <span className="menu-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            {isExpanded && <span className="menu-label">Laporan</span>}
          </Link>
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
          <button
            onClick={handleLogout}
            className="logout-button"
            aria-label="Logout"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            {isExpanded && <span>Logout</span>}
          </button>
        </div>
      </div>
    );
  }

  // Desktop mode (> 1024px)
  return (
    <div className={`sidebar-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo-wrapper">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          {isExpanded && (
            <div className="logo-content">
              <h1 className="logo-title">E-Checksheet</h1>
              <p className="logo-subtitle">Management System</p>
            </div>
          )}
        </div>
        <button className="toggle-button" onClick={toggleSidebar} aria-label="Toggle sidebar">
          {isExpanded ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-navigation">
        <Link 
          href={getHomeRoute()} 
          className={`menu-item ${activeMenu === getHomeRoute() ? 'active' : ''}`}
          onClick={() => handleNavClick(getHomeRoute())}
        >
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          {isExpanded && <span className="menu-label">Home</span>}
        </Link>

        <Link 
          href={getDashboardRoute()} 
          className={`menu-item ${activeMenu === getDashboardRoute() ? 'active' : ''}`}
          onClick={() => handleNavClick(getDashboardRoute())}
        >
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>
          {isExpanded && <span className="menu-label">Dashboard</span>}
        </Link>

        <Link 
          href={getLaporanRoute()} 
          className={`menu-item ${activeMenu === getLaporanRoute() ? 'active' : ''}`}
          onClick={() => handleNavClick(getLaporanRoute())}
        >
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          {isExpanded && <span className="menu-label">Laporan</span>}
        </Link>
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
        
        <button onClick={handleLogout} className="logout-button" title="Logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          {isExpanded && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}