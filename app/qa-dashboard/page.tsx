// app/qa-dashboard/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

// ============================================
// TYPE DEFINITIONS
// ============================================
interface CategoryOption {
  label: string;
  value: string;
  type?: string;
  area?: string;
}

interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  completionRate: string;
}

interface TrendItem {
  date: string;
  count: number;
}

interface DistributionItem {
  status: string;
  count: number;
  category: string;
}

interface UserItem {
  name: string;
  count: number;
}

interface HistoryItem {
  filledAt: string;
  area: string;
  category: string;
  shift: string;
  status: string;
  ngCount: number;
  filledBy: string;
}

interface DashboardData {
  success: boolean;
  stats: DashboardStats;
  trendData: TrendItem[];
  distributionData: DistributionItem[];
  topUsers: UserItem[];
  historyData: HistoryItem[];
}

interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  fill?: boolean;
  tension?: number;
  pointBackgroundColor?: string;
  pointRadius?: number;
  pointHoverRadius?: number;
  borderRadius?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate last 7 days with proper date formatting
 */
const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    days.push(date);
  }
  return days;
};

/**
 * Merge 7-day default data with actual API data
 */
const mergeWith7DaysData = (apiData: TrendItem[]) => {
  const last7Days = getLast7Days();
  const dataMap = new Map(apiData.map(item => [
    new Date(item.date).toDateString(),
    item.count
  ]));

  return last7Days.map(date => ({
    date: date.toISOString(),
    count: dataMap.get(date.toDateString()) || 0
  }));
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function ModernDashboard() {
  const { user } = useAuth();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<string>("All Category");
  const [activeMonth, setActiveMonth] = useState<number>(new Date().getMonth());
  const [activeYear, setActiveYear] = useState<number>(new Date().getFullYear());
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const HISTORY_PER_PAGE = 10;

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Load dashboard data when filters change
  useEffect(() => {
    if (categories.length > 0) {
      loadDashboardData();
    }
  }, [selectedCategory, activeMonth, activeYear, categories]);

  // ============================================
  // LOAD CATEGORIES
  // ============================================
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/dashboard/get-categories');
      if (!response.ok) throw new Error('Failed to load categories');
      const data = await response.json();
      setCategories(data.categories as CategoryOption[]);
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Gagal memuat daftar kategori');
    }
  };

  // ============================================
  // LOAD DASHBOARD DATA
  // ============================================
  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const monthKey = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;
      const categoryParam = selectedCategory !== "All Category" 
        ? `&categoryCode=${encodeURIComponent(selectedCategory)}` 
        : '';
      
      const response = await fetch(
        `/api/dashboard/get-data?month=${monthKey}${categoryParam}&days=7`
      );

      if (!response.ok) throw new Error('Failed to load dashboard data');
      const data = await response.json();
      setDashboardData(data as DashboardData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Gagal memuat data dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // MEMOIZED CALCULATIONS
  // ============================================
  const stats = useMemo<DashboardStats>(() => {
    return dashboardData?.stats || { total: 0, completed: 0, pending: 0, completionRate: "0.0" };
  }, [dashboardData]);

  const trendData = useMemo<ChartData>(() => {
    if (!dashboardData?.trendData) return { labels: [], datasets: [] };
    
    // Always show 7 days, fill missing with 0
    const mergedData = mergeWith7DaysData(dashboardData.trendData);
    
    const labels = mergedData.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString("id-ID", { weekday: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [{
        label: "Jumlah Checklist/Hari",
        data: mergedData.map((item) => Number(item.count)),
        borderColor: "#8B5CF6",
        backgroundColor: "rgba(139, 92, 246, 0.08)",
        fill: true,
        tension: 0.5,
        pointBackgroundColor: "#8B5CF6",
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2
      }]
    };
  }, [dashboardData]);

  const distributionData = useMemo<{ labels: string[]; data: number[] }>(() => {
    if (!dashboardData?.distributionData) return { labels: [], data: [] };

    if (selectedCategory === "All Category") {
      // Group by category
      const categoryMap: Record<string, number> = {};
      dashboardData.distributionData.forEach((item) => {
        categoryMap[item.category] = (categoryMap[item.category] || 0) + item.count;
      });
      return {
        labels: Object.keys(categoryMap),
        data: Object.values(categoryMap)
      };
    } else {
      // OK vs NG for specific category
      const okCount = dashboardData.distributionData
        .filter((item) => item.status === 'OK')
        .reduce((sum, item) => sum + item.count, 0);
      const ngCount = dashboardData.distributionData
        .filter((item) => item.status === 'NG')
        .reduce((sum, item) => sum + item.count, 0);
      
      return {
        labels: ["OK", "NG"],
        data: [okCount, ngCount]
      };
    }
  }, [dashboardData, selectedCategory]);

  const ratioData = useMemo<ChartData>(() => {
    if (!dashboardData?.distributionData) return { labels: [], datasets: [] };

    if (selectedCategory === "All Category") {
      // Per category OK vs NG
      const categoryMap: Record<string, { ok: number; ng: number }> = {};
      dashboardData.distributionData.forEach((item) => {
        if (!categoryMap[item.category]) {
          categoryMap[item.category] = { ok: 0, ng: 0 };
        }
        if (item.status === 'OK') categoryMap[item.category].ok += item.count;
        if (item.status === 'NG') categoryMap[item.category].ng += item.count;
      });

      const categories = Object.keys(categoryMap);
      return {
        labels: categories,
        datasets: [
          {
            label: "OK",
            data: categories.map(cat => categoryMap[cat].ok),
            backgroundColor: "#10B981",
            borderRadius: 4,
          },
          {
            label: "NG",
            data: categories.map(cat => categoryMap[cat].ng),
            backgroundColor: "#F59E0B",
            borderRadius: 4,
          },
        ],
      };
    } else {
      // Single category OK vs NG
      const okCount = dashboardData.distributionData
        .filter((item) => item.status === 'OK')
        .reduce((sum, item) => sum + item.count, 0);
      const ngCount = dashboardData.distributionData
        .filter((item) => item.status === 'NG')
        .reduce((sum, item) => sum + item.count, 0);

      return {
        labels: [selectedCategory],
        datasets: [
          {
            label: "OK",
            data: [okCount],
            backgroundColor: "#10B981",
            borderRadius: 4,
          },
          {
            label: "NG",
            data: [ngCount],
            backgroundColor: "#F59E0B",
            borderRadius: 4,
          },
        ],
      };
    }
  }, [dashboardData, selectedCategory]);

  const topUsers = useMemo<UserItem[]>(() => {
    return dashboardData?.topUsers || [];
  }, [dashboardData]);

  const historyData = useMemo<HistoryItem[]>(() => {
    const data = dashboardData?.historyData || [];
    // Sort by newest first (descending by filledAt)
    return [...data].sort((a, b) => 
      new Date(b.filledAt).getTime() - new Date(a.filledAt).getTime()
    );
  }, [dashboardData]);

  const paginatedHistoryData = useMemo<HistoryItem[]>(() => {
    const startIdx = (historyPage - 1) * HISTORY_PER_PAGE;
    const endIdx = startIdx + HISTORY_PER_PAGE;
    return historyData.slice(startIdx, endIdx);
  }, [historyData, historyPage]);

  const totalHistoryPages = Math.ceil(historyData.length / HISTORY_PER_PAGE);

  const userName = user?.fullName || "User";
  if (!user) return null;

  // Helper function untuk nama bulan
  const getMonthName = (monthIndex: number): string => {
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return monthNames[monthIndex];
  };

  // Change month handler
  const changeMonth = (direction: number) => {
    let newMonth = activeMonth + direction;
    let newYear = activeYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setActiveMonth(newMonth);
    setActiveYear(newYear);
  };

  return (
    <>
      <Sidebar userName={userName} />
      <div className="dashboard-container">
        <main className="main-content">
          <div className="header-section">
            <div className="header-content">
              <div className="header-text">
                <h1 className="page-title">📊 QA Dashboard</h1>
                <p className="page-subtitle">
                  Wawasan berbasis data untuk peningkatan kualitas inspeksi
                </p>
              </div>
              
              {/* === DROPDOWN FILTER KATEGORI GLOBAL === */}
              <div className="filter-container">
                <label htmlFor="categoryFilter" className="filter-label">Filter Kategori:</label>
                <select
                  id="categoryFilter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="category-dropdown"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* === NAVIGASI BULAN === */}
          <div className="month-navigation">
            <button
              onClick={() => changeMonth(-1)}
              className="month-btn month-btn-prev"
              title="Bulan sebelumnya"
            >
              ← Bulan Lalu
            </button>
            
            <span className="month-display">
              {getMonthName(activeMonth)} {activeYear}
            </span>
            
            <button
              onClick={() => changeMonth(1)}
              className="month-btn month-btn-next"
              title="Bulan berikutnya"
            >
              Bulan Depan →
            </button>
          </div>

          {/* === LOADING & ERROR === */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ 
                display: 'inline-block', 
                width: '60px', 
                height: '60px', 
                border: '6px solid #1976d2', 
                borderTopColor: 'transparent', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}></div>
              <p style={{ marginTop: '16px', color: '#666', fontSize: '1.1rem' }}>
                Memuat data dashboard...
              </p>
            </div>
          )}

          {error && (
            <div style={{ 
              backgroundColor: '#fee', 
              color: '#c33', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '24px',
              borderLeft: '4px solid #c33'
            }}>
              <strong>Error: </strong> {error}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-icon">📋</div>
                  <div className="stat-value">{stats.total}</div>
                  <div className="stat-label">Total Checklist</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-icon">✓</div>
                  <div className="stat-value">{stats.completed}</div>
                  <div className="stat-label">Selesai (OK)</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-icon">✗</div>
                  <div className="stat-value">{stats.pending}</div>
                  <div className="stat-label">Temuan (NG)</div>
                </div>
                <div className="stat-card info">
                  <div className="stat-icon">📊</div>
                  <div className="stat-value">{stats.completionRate}%</div>
                  <div className="stat-label">Tingkat Kelengkapan</div>
                </div>
              </div>

              {stats.total > 0 && (
                <div className="insight-banner">
                  <span className="insight-text">
                    📌 Performa {selectedCategory !== "All Category" ? selectedCategory : "semua kategori"}: <strong>{stats.completionRate}%</strong> checklist dalam kondisi OK.
                    {selectedCategory === "All Category" && " Fokus pada area dengan temuan NG tertinggi!"}
                  </span>
                </div>
              )}

              <div className="chart-box large">
                <h3 className="chart-title">📈 Aktivitas Checklist (7 Hari Terakhir)</h3>
                <div className="chart-container large">
                  {trendData.labels.length > 0 && trendData.datasets[0].data.some(val => val > 0) ? (
                    <Line
                      data={trendData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { 
                            display: true, 
                            position: "top",
                            labels: {
                              font: {
                                size: 12
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => `${context.dataset.label}: ${context.raw} checklist`
                            }
                          }
                        },
                        scales: {
                          y: { 
                            beginAtZero: true, 
                            ticks: { 
                              stepSize: 1,
                              precision: 0
                            },
                            grid: {
                              color: 'rgba(0, 0, 0, 0.05)'
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            }
                          }
                        },
                      }}
                    />
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%',
                      padding: '20px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontSize: '48px', 
                        marginBottom: '16px',
                        color: '#cbd5e1'
                      }}>
                        📉
                      </div>
                      <p style={{ 
                        fontSize: '16px', 
                        color: '#64748b',
                        marginBottom: '8px',
                        fontWeight: 500
                      }}>
                        Belum ada data checklist
                      </p>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#94a3b8',
                        maxWidth: '300px'
                      }}>
                        {selectedCategory === "All Category" 
                          ? "Isi checklist pada halaman Final Assy atau Pre Assy untuk melihat aktivitas"
                          : `Isi checklist "${selectedCategory}" untuk melihat aktivitas`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="charts-section">
                <div className="chart-box">
                  <h3 className="chart-title">
                    {selectedCategory === "All Category"
                      ? "🔍 Distribusi Jenis Checklist"
                      : "🔍 Distribusi Status (OK vs NG)"}
                  </h3>
                  <div className="chart-container small">
                    {distributionData.labels.length > 0 ? (
                      <Doughnut
                        data={{
                          labels: distributionData.labels,
                          datasets: [{
                            data: distributionData.data,
                            backgroundColor: [
                              "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#3B82F6",
                              "#EF4444", "#06B6D4", "#84CC16"
                            ],
                            borderWidth: 0,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: "bottom",
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => `${context.label}: ${context.raw} kali`
                              }
                            }
                          },
                        }}
                      />
                    ) : (
                      <p className="empty-chart">Belum ada data.</p>
                    )}
                  </div>
                </div>

                <div className="chart-box">
                  <h3 className="chart-title">⚖️ Rasio OK vs NG</h3>
                  <div className="chart-container">
                    {ratioData.labels.length > 0 ? (
                      <Bar
                        data={ratioData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y',
                          scales: {
                            x: { stacked: true, beginAtZero: true },
                            y: { stacked: true },
                          },
                          plugins: {
                            legend: { position: "top" },
                            tooltip: {
                              callbacks: {
                                label: (context) => `${context.dataset.label}: ${context.raw}`
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <p className="empty-chart">Belum ada data.</p>
                    )}
                  </div>
                </div>

                <div className="chart-box">
                  <h3 className="chart-title">🏆 Top 5 Pengisi Checklist</h3>
                  <div className="top-users">
                    {topUsers.slice(0, 5).length > 0 ? (
                      topUsers.slice(0, 5).map((userItem, i) => {
                        const maxCount = topUsers[0]?.count || 1;
                        const progress = (userItem.count / maxCount) * 100;
                        return (
                          <div key={i} className="user-item">
                            <div className="user-rank-badge">{i + 1}</div>
                            <div className="user-content">
                              <div className="user-header">
                                <span className="user-name">{userItem.name}</span>
                                <span className="user-count">{userItem.count}</span>
                              </div>
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill" 
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="empty-chart">Belum ada data.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-header">
                  <h2 className="section-title">📜 Riwayat Checklist Lengkap</h2>
                  {historyData.length > 0 && (
                    <span className="record-count">Total: {historyData.length} records</span>
                  )}
                </div>
                {historyData.length > 0 ? (
                  <>
                    <div className="history-table-container">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Tanggal & Waktu</th>
                            <th>Area</th>
                            <th>Jenis / Kategori</th>
                            <th>Status</th>
                            <th>Pengisi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedHistoryData.map((item, i) => (
                            <tr key={i}>
                              <td>
                                {new Date(item.filledAt).toLocaleString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td>
                                <span className={`area-badge ${item.area === "Pre Assy" ? "pre-assy" : "final-assy"}`}>
                                  {item.area}
                                </span>
                              </td>
                              <td>
                                <div>{item.category}</div>
                                <div style={{ fontSize: '0.8em', color: '#64748b' }}>
                                  Shift {item.shift}
                                </div>
                              </td>
                              <td>
                                <span className={`status-badge ${item.status === "OK" ? "ok" : "ng"}`}>
                                  {item.status}
                                </span>
                                {item.ngCount > 0 && (
                                  <div style={{ fontSize: '0.8em', marginTop: '4px' }}>
                                    <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                                      {item.ngCount} temuan NG
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td>{item.filledBy || "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalHistoryPages > 1 && (
                      <div className="pagination-container">
                        <button 
                          className="pagination-btn"
                          onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                          disabled={historyPage === 1}
                        >
                          ← Back
                        </button>
                        <span className="pagination-info">
                          Page {historyPage} of {totalHistoryPages}
                        </span>
                        <button 
                          className="pagination-btn"
                          onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                          disabled={historyPage === totalHistoryPages}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="empty-activity">Belum ada riwayat checklist.</p>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .dashboard-container {
          display: flex;
          min-height: 100vh;
          background-color: #f5f7fa;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .main-content {
          flex: 1;
          padding-left: 70px;
          padding-top : 20px;
          min-height: calc(100vh - 64px);
          max-width: 1500px;
          margin: 0 auto;
          width: 100%;
        }

        /* HEADER SECTION */
        .header-section {
          background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 32px;
          box-shadow: 0 8px 24px rgba(25, 118, 210, 0.15);
          color: white;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
        }

        .header-text {
          flex: 1;
          min-width: 250px;
        }

        .page-title {
          font-size: 32px;
          font-weight: 800;
          color: white;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.9);
          margin-top: 8px;
          opacity: 0.95;
        }

        .filter-container {
          display: flex;
          align-items: center;
          gap: 14px;
          background: white;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          min-width: 300px;
        }

        .filter-label {
          font-weight: 600;
          color: #334155;
          margin: 0;
          white-space: nowrap;
        }

        .category-dropdown {
          flex: 1;
          padding: 10px 14px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          background-color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-dropdown:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }

        .category-dropdown:focus {
          outline: none;
          border-color: #1976d2;
          box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.1);
        }

        /* MONTH NAVIGATION */
        .month-navigation {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-bottom: 32px;
          padding: 20px;
          background: white;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          animation: slideInUp 0.3s ease-out;
        }

        .month-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #1976d2, #1565c0);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
        }

        .month-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(25, 118, 210, 0.3);
        }

        .month-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .month-display {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          min-width: 180px;
          text-align: center;
        }

        /* STATS GRID */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
          border-left: 5px solid #cbd5e1;
          position: relative;
          overflow: hidden;
          animation: fadeIn 0.4s ease-out;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, currentColor, transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .stat-card.primary { border-left-color: #8B5CF6; }
        .stat-card.success { border-left-color: #10B981; }
        .stat-card.warning { border-left-color: #F59E0B; }
        .stat-card.info { border-left-color: #3B82F6; }

        .stat-icon {
          font-size: 28px;
          margin-bottom: 12px;
          opacity: 0.8;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .stat-label {
          font-size: 13px;
          color: #64748b;
          text-align: center;
          line-height: 1.4;
        }

        .insight-banner {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 28px;
          border-left: 4px solid #3B82F6;
        }

        .insight-text {
          color: #1e40af;
          font-size: 15px;
          font-weight: 600;
        }

        .chart-box.large {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          margin-bottom: 24px;
        }

        .charts-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .chart-box {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s ease;
        }

        .chart-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }

        .chart-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 16px;
        }

        .chart-container {
          height: 280px;
          min-height: 280px;
          width: 100%;
        }

        .chart-container.large {
          height: 340px;
          min-height: 340px;
        }

        .chart-container.small {
          height: 220px;
          min-height: 220px;
        }

        .empty-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #94a3b8;
          font-style: italic;
          font-size: 14px;
        }

        .top-users {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .user-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          transition: all 0.2s ease;
          border: 1px solid #e2e8f0;
        }

        .user-item:hover {
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
        }

        .user-rank-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #8B5CF6, #7c3aed);
          color: white;
          font-weight: 700;
          font-size: 16px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
        }

        .user-content {
          flex: 1;
          min-width: 0;
        }

        .user-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .user-name {
          color: #1e293b;
          font-weight: 600;
          font-size: 14px;
        }

        .user-count {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #0c4a6e;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8B5CF6, #7c3aed);
          border-radius: 3px;
          transition: width 0.3s ease;
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
        }

        .section {
          margin-top: 40px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .record-count {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          background: #f1f5f9;
          padding: 6px 12px;
          border-radius: 20px;
        }

        .history-table-container {
          overflow-x: auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .history-table th,
        .history-table td {
          padding: 16px 18px;
          text-align: left;
          border-bottom: 1px solid #f1f5f9;
        }

        .history-table th {
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          font-weight: 700;
          color: #334155;
          position: sticky;
          top: 0;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .history-table tbody tr {
          transition: all 0.2s ease;
        }

        .history-table tbody tr:last-child td {
          border-bottom: none;
        }

        .history-table tbody tr:hover {
          background: linear-gradient(90deg, #f8fafc, #eef2ff);
          box-shadow: inset 2px 0 0 #8B5CF6;
        }

        .pagination-container {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
          padding: 20px;
          background: #f8fafc;
          border-radius: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .pagination-btn {
          padding: 10px 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
        }

        .pagination-btn:hover:not(:disabled) {
          border-color: #1976d2;
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #0c4a6e;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #f1f5f9;
        }

        .pagination-info {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
          min-width: 120px;
          text-align: center;
        }

        .area-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
          transition: all 0.2s ease;
        }

        .area-badge.pre-assy {
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          color: #991b1b;
          border: 1px solid #fca5a5;
        }

        .area-badge.final-assy {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #0c4a6e;
          border: 1px solid #93c5fd;
        }

        .status-badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
          transition: all 0.2s ease;
        }

        .status-badge.ok {
          background: linear-gradient(135deg, #dcfce7, #c6f6d5);
          color: #15803d;
          border: 1px solid #86efac;
        }

        .status-badge.ng {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          color: #854d0e;
          border: 1px solid #fcd34d;
        }

        .empty-activity {
          padding: 40px 24px;
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border-radius: 16px;
          margin-top: 20px;
          border: 2px dashed #cbd5e1;
          font-size: 15px;
        }

        /* RESPONSIVE DESIGN */
        @media (max-width: 1024px) {
          .main-content {
            padding: 24px;
            max-width: 100%;
          }

          .header-section {
            padding: 24px;
          }

          .header-content {
            flex-direction: column;
            gap: 16px;
          }

          .filter-container {
            width: 100%;
            min-width: auto;
          }

          .category-dropdown {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .charts-section {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .main-content {
            padding: 16px;
          }

          .header-section {
            padding: 20px;
            border-radius: 12px;
          }

          .page-title {
            font-size: 24px;
          }

          .page-subtitle {
            font-size: 14px;
          }

          .filter-container {
            flex-direction: column;
            gap: 10px;
            width: 100%;
            padding: 12px 16px;
          }

          .filter-label {
            width: 100%;
          }

          .category-dropdown {
            width: 100%;
          }

          .month-navigation {
            flex-wrap: wrap;
            gap: 12px;
            padding: 16px;
          }

          .month-btn {
            padding: 10px 16px;
            font-size: 13px;
          }

          .month-display {
            width: 100%;
            order: 3;
            font-size: 16px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .stat-card {
            padding: 16px 12px;
          }

          .stat-value {
            font-size: 24px;
          }

          .stat-label {
            font-size: 12px;
          }

          .chart-container {
            height: 220px;
          }

          .chart-container.large {
            height: 260px;
          }

          .chart-container.small {
            height: 180px;
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .history-table-container {
            border-radius: 12px;
            font-size: 12px;
          }

          .history-table th,
          .history-table td {
            padding: 12px 10px;
          }

          .pagination-container {
            flex-wrap: wrap;
            gap: 12px;
            padding: 16px;
          }

          .pagination-btn {
            padding: 8px 16px;
            font-size: 13px;
          }

          .pagination-info {
            width: 100%;
          }

          .user-item {
            padding: 12px;
            gap: 10px;
          }

          .user-rank-badge {
            width: 32px;
            height: 32px;
            font-size: 14px;
          }

          .user-count {
            font-size: 11px;
          }
        }

        @media (max-width: 480px) {
          .main-content {
            padding: 12px;
          }

          .header-section {
            padding: 16px;
            border-radius: 10px;
          }

          .page-title {
            font-size: 20px;
          }

          .page-subtitle {
            font-size: 13px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .stat-card {
            padding: 14px 12px;
          }

          .stat-value {
            font-size: 20px;
          }

          .chart-box {
            padding: 16px;
          }

          .chart-title {
            font-size: 14px;
          }

          .history-table {
            font-size: 11px;
          }

          .history-table th,
          .history-table td {
            padding: 8px 6px;
          }

          .filter-container {
            flex-wrap: wrap;
          }

          .category-dropdown {
            min-width: auto;
          }

          .section-title {
            font-size: 18px;
            margin: 24px 0 12px 0;
          }

          .user-item {
            padding: 10px;
          }

          .user-rank-badge {
            width: 28px;
            height: 28px;
            font-size: 12px;
          }
        }

        /* ADDITIONAL MOBILE RESPONSIVE - PHONES */
        @media (max-width: 640px) {
          .main-content {
            padding: 10px;
          }

          .header-section {
            padding: 12px;
          }

          .page-title {
            font-size: 18px;
          }

          .page-subtitle {
            font-size: 12px;
          }

          .filter-container {
            flex-direction: column;
            gap: 8px;
            padding: 10px 12px;
          }

          .filter-label {
            font-size: 12px;
          }

          .category-dropdown {
            width: 100%;
            padding: 8px;
            font-size: 13px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .stat-card {
            padding: 12px 10px;
          }

          .stat-value {
            font-size: 18px;
          }

          .stat-label {
            font-size: 11px;
          }

          .month-navigation {
            gap: 8px;
            padding: 12px;
          }

          .month-btn {
            padding: 8px 12px;
            font-size: 12px;
          }

          .month-display {
            font-size: 14px;
          }

          .section-title {
            font-size: 16px;
            margin: 18px 0 10px 0;
          }

          .chart-box {
            padding: 12px;
            border-radius: 10px;
          }

          .chart-title {
            font-size: 13px;
            margin-bottom: 10px;
          }

          .chart-container {
            height: 180px;
          }

          .chart-container.large {
            height: 220px;
          }

          .chart-container.small {
            height: 160px;
          }

          .history-table-container {
            border-radius: 10px;
          }

          .history-table {
            font-size: 10px;
          }

          .history-table th,
          .history-table td {
            padding: 6px 4px;
            font-size: 9px;
          }

          .pagination-container {
            gap: 8px;
            padding: 12px;
          }

          .pagination-btn {
            padding: 6px 12px;
            font-size: 12px;
          }

          .pagination-info {
            font-size: 11px;
          }

          .user-item {
            padding: 8px;
            gap: 8px;
          }

          .user-rank-badge {
            width: 26px;
            height: 26px;
            font-size: 10px;
          }

          .user-count {
            font-size: 10px;
          }
        }
      `}</style>
    </>
  );
}
