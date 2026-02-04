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
// KATEGORI YANG TERSEDIA (DITAMBAHKAN PRE-ASSY + PRESSURE JIG)
// ============================================
const CATEGORIES = [
  "All Category",
  // Final Assy Categories
  "Daily Check Inspector Final Assy",
  "Daily Check Group Leader Final Assy",
  // Pre Assy Categories (BARU)
  "Daily Check Group Leader Pre Assy",
  "CallCheck CC & Stripping GL Pre Assy",
  "Daily Check Ins. Inspector Pre Assy",
  "CS Remove Tool Pre Assy",
  "Daily Check Pressure Jig Inspector Pre Assy" // 🔹 BARU
];

// ============================================
// MAPPING KATEGORI KE STORAGE KEY (DITAMBAHKAN PRE-ASSY + PRESSURE JIG)
// ============================================
const CATEGORY_STORAGE_MAP = {
  // Final Assy (Existing)
  "Daily Check Inspector Final Assy": {
    storageKey: "finalAssy_inspector_DailyCheckResults",
    type: "inspector"
  },
  "Daily Check Group Leader Final Assy": {
    storageKey: "finalAssy_group-leader_DailyCheckResults",
    type: "group-leader"
  },
  // Pre Assy (BARU)
  "Daily Check Group Leader Pre Assy": {
    storageKey: "preAssyGroupLeaderDailyCheckResults",
    type: "group-leader"
  },
  "CallCheck CC & Stripping GL Pre Assy": {
    storageKey: "preAssyGroupLeaderCcStrippingDailyCheckResults",
    type: "group-leader"
  },
  "Daily Check Ins. Inspector Pre Assy": {
    storageKey: "preAssyInspectorDailyCheckResults",
    type: "inspector"
  },
  "CS Remove Tool Pre Assy": {
    storageKey: "csRemoveControlResults",
    type: "inspector"
  },
  // 🔹 BARU - Pressure Jig
  "Daily Check Pressure Jig Inspector Pre Assy": {
    storageKey: "preAssyPressureJigInspectorDailyCheckResults",
    type: "inspector"
  }
};

// ============================================
// HELPER FUNCTION: Parse tanggal dari dateKey
// ============================================
const parseDateFromKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// ============================================
// HELPER FUNCTION: Parse info dari checkpointKey
// ============================================
const parseChecksheetInfo = (checkpointKey: string, category: string): {
  shift: string;
  type: string;
} => {
  // Format checkpointKey: "id-shift" atau "id-shift-timeslot"
  const parts = checkpointKey.split('-');
  let shift = parts[1] || "Unknown";
  
  // Untuk CC & Stripping yang punya timeSlot
  if (category === "CallCheck CC & Stripping GL Pre Assy" && parts.length > 2) {
    shift = parts[1]; // shift tetap di index 1
  }
  
  // Determine type from category
  const type = category.includes("Inspector") ? "inspector" : "group-leader";
  return { shift, type };
};

// ============================================
// AMBIL DATA DARI LOCALSTORAGE BERDASARKAN KATEGORI
// ============================================
const getResultsByCategory = (category: string) => {
  if (category === "All Category") {
    const allResults: any[] = [];
    // Ambil semua kategori
    Object.entries(CATEGORY_STORAGE_MAP).forEach(([catName, config]) => {
      try {
        const dataStr = localStorage.getItem(config.storageKey);
        const data = dataStr ? JSON.parse(dataStr) : {};
        Object.entries(data).forEach(([dateKey, checkpoints]: [string, any]) => {
          Object.entries(checkpoints).forEach(([checkpointKey, result]: [string, any]) => {
            allResults.push({
              category: catName,
              dateKey,
              checkpointKey,
              result,
              type: config.type
            });
          });
        });
      } catch (error) {
        console.error(`Error loading data for ${catName}:`, error);
      }
    });
    return allResults;
  }
  
  // Untuk kategori tertentu
  const config = CATEGORY_STORAGE_MAP[category as keyof typeof CATEGORY_STORAGE_MAP];
  if (!config) return [];
  
  try {
    const dataStr = localStorage.getItem(config.storageKey);
    const data = dataStr ? JSON.parse(dataStr) : {};
    const results: any[] = [];
    
    Object.entries(data).forEach(([dateKey, checkpoints]: [string, any]) => {
      Object.entries(checkpoints).forEach(([checkpointKey, result]: [string, any]) => {
        results.push({
          category,
          dateKey,
          checkpointKey,
          result,
          type: config.type
        });
      });
    });
    
    return results;
  } catch (error) {
    console.error(`Error loading data for ${category}:`, error);
    return [];
  }
};

// ============================================
// HITUNG STATISTIK BERDASARKAN KATEGORI (LOGIKA BARU)
// ============================================
const calculateStats = (category: string, activeMonth: number, activeYear: number) => {
  const allData = getResultsByCategory(category);
  
  // Filter berdasarkan bulan aktif
  const filteredData = allData.filter(item => {
    const date = parseDateFromKey(item.dateKey);
    return date.getMonth() === activeMonth && date.getFullYear() === activeYear;
  });

  if (filteredData.length === 0) {
    return { total: 0, completed: 0, pending: 0, completionRate: "0.0" };
  }

  // 🔹 LANGKAH 1: Group by Date + Category untuk unique table count
  const tablesByDate: Record<string, Set<string>> = {};
  const tableStatuses: Record<string, Record<string, { hasOK: boolean; hasNG: boolean; ngCount: number }>> = {};
  
  filteredData.forEach(item => {
    const { dateKey, category: itemCategory, checkpointKey, result } = item;
    const tableKey = `${dateKey}_${itemCategory}`;
    
    // Initialize table tracking
    if (!tablesByDate[dateKey]) {
      tablesByDate[dateKey] = new Set();
    }
    tablesByDate[dateKey].add(itemCategory);
    
    // Track status per table
    if (!tableStatuses[dateKey]) {
      tableStatuses[dateKey] = {};
    }
    if (!tableStatuses[dateKey][itemCategory]) {
      tableStatuses[dateKey][itemCategory] = { hasOK: false, hasNG: false, ngCount: 0 };
    }
    
    // Update status
    if (result.status === "OK") {
      tableStatuses[dateKey][itemCategory].hasOK = true;
    } else if (result.status === "NG") {
      tableStatuses[dateKey][itemCategory].hasNG = true;
      tableStatuses[dateKey][itemCategory].ngCount += result.ngCount || 1;
    }
  });

  // 🔹 LANGKAH 2: Hitung Total Checklist (1 tabel per tanggal = +1)
  const totalChecklist = Object.values(tablesByDate).reduce(
    (sum, categories) => sum + categories.size,
    0
  );

  // 🔹 LANGKAH 3: Hitung Completed (OK) - tabel yang SEMUA kolomnya OK
  let completedChecklist = 0;
  Object.entries(tableStatuses).forEach(([dateKey, categories]) => {
    Object.entries(categories).forEach(([categoryName, status]) => {
      // Completed jika ada OK dan TIDAK ADA NG
      if (status.hasOK && !status.hasNG) {
        completedChecklist++;
      }
    });
  });

  // 🔹 LANGKAH 4: Hitung Total NG (sum semua ngCount)
  let totalNG = 0;
  Object.values(tableStatuses).forEach(categories => {
    Object.values(categories).forEach(status => {
      totalNG += status.ngCount;
    });
  });

  // 🔹 LANGKAH 5: Hitung Completion Rate
  const completionRate = totalChecklist > 0
    ? ((completedChecklist / totalChecklist) * 100).toFixed(1)
    : "0.0";

  return {
    total: totalChecklist,
    completed: completedChecklist,
    pending: totalNG,
    completionRate
  };
};

// ============================================
// HITUNG RATA-RATA PER HARI (7 HARI TERAKHIR) - DIPERBAIKI
// ============================================
const calculateAvgPerDay = (category: string) => {
  const allData = getResultsByCategory(category);
  const now = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return d;
  });

  const dailyCounts: number[] = [];
  last7Days.forEach(day => {
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const dayData = allData.filter(item => item.dateKey === dateKey);
    
    // 🔹 Group by unique category per date (avoid double counting)
    const uniqueCategories = new Set<string>();
    dayData.forEach(item => {
      uniqueCategories.add(item.category);
    });

    dailyCounts.push(uniqueCategories.size);
  });

  const avg = dailyCounts.reduce((sum, val) => sum + val, 0) / 7;
  return avg.toFixed(1);
};

// ============================================
// HITUNG TREND DATA 7 HARI TERAKHIR - DIPERBAIKI
// ============================================
const calculateTrendData = (category: string) => {
  const allData = getResultsByCategory(category);
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return d;
  }).reverse();

  const labels = days.map(d =>
    d.toLocaleDateString("id-ID", { weekday: 'short', day: 'numeric' })
  );

  const dailyCounts = days.map(day => {
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const dayData = allData.filter(item => item.dateKey === dateKey);
    
    // 🔹 Count unique categories per day
    const uniqueCategories = new Set<string>();
    dayData.forEach(item => {
      uniqueCategories.add(item.category);
    });

    return uniqueCategories.size;
  });

  return { labels, data: dailyCounts };
};

// ============================================
// HITUNG DISTRIBUSI PER KATEGORI
// ============================================
const calculateDistributionData = (category: string) => {
  const allData = getResultsByCategory(category);
  
  if (category !== "All Category") {
    // Untuk kategori tertentu, tampilkan OK vs NG
    const okCount = allData.filter(item => item.result.status === "OK").length;
    const ngCount = allData.filter(item => item.result.status === "NG").length;
    
    return {
      labels: ["OK", "NG"],
      data: [okCount, ngCount]
    };
  }
  
  // Untuk All Category, tampilkan per kategori
  const categoryCounts: Record<string, number> = {};
  allData.forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });
  
  return {
    labels: Object.keys(categoryCounts),
    data: Object.values(categoryCounts)
  };
};

// ============================================
// HITUNG RASIO OK vs NG PER KATEGORI
// ============================================
const calculateRatioData = (category: string) => {
  const allData = getResultsByCategory(category);
  
  if (category !== "All Category") {
    // Untuk kategori tertentu, tampilkan rasio OK vs NG
    const okCount = allData.filter(item => item.result.status === "OK").length;
    const ngCount = allData.filter(item => item.result.status === "NG").length;
    
    return {
      labels: [category],
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
  
  // Untuk All Category, hitung per kategori
  const categoryMap: Record<string, { ok: number; ng: number }> = {};
  allData.forEach(item => {
    if (!categoryMap[item.category]) {
      categoryMap[item.category] = { ok: 0, ng: 0 };
    }
    if (item.result.status === "OK") {
      categoryMap[item.category].ok++;
    } else {
      categoryMap[item.category].ng++;
    }
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
};

// ============================================
// HITUNG TOP USERS
// ============================================
const calculateTopUsers = (category: string) => {
  const allData = getResultsByCategory(category);
  const userCount: Record<string, number> = {};
  
  allData.forEach(item => {
    const userName = item.result.submittedBy || "Unknown";
    userCount[userName] = (userCount[userName] || 0) + 1;
  });
  
  return Object.entries(userCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
};

// ============================================
// BUAT RIWAYAT CHECKLIST
// ============================================
const createHistoryData = (category: string) => {
  const allData = getResultsByCategory(category);
  
  return allData.map(item => {
    // Parse info dari checkpointKey
    const { shift } = parseChecksheetInfo(item.checkpointKey, item.category);
    
    return {
      filledAt: item.result.submittedAt || new Date().toISOString(),
      area: item.category.includes("Pre Assy") ? "Pre Assy" : "Final Assy",
      category: item.category,
      shift: shift,
      status: item.result.status,
      ngCount: item.result.ngCount || 0,
      filledBy: item.result.submittedBy || "Unknown"
    };
  }).sort((a, b) => new Date(b.filledAt).getTime() - new Date(a.filledAt).getTime());
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function ModernDashboard() {
  const { user } = useAuth();
  
  // State untuk filter kategori
  const [selectedCategory, setSelectedCategory] = useState("All Category");
  
  // State untuk bulan aktif (sinkron dengan checksheet)
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  
  // Hitung statistik dengan useMemo untuk efisiensi
  const stats = useMemo(() => {
    return calculateStats(selectedCategory, activeMonth, activeYear);
  }, [selectedCategory, activeMonth, activeYear]);
  
  const avgPerDay = useMemo(() => {
    return calculateAvgPerDay(selectedCategory);
  }, [selectedCategory]);
  
  const trendData = useMemo(() => {
    const { labels, data } = calculateTrendData(selectedCategory);
    return {
      labels,
      datasets: [{
        label: "Jumlah Checklist/Hari",
        data,
        borderColor: "#8B5CF6",
        backgroundColor: "rgba(139, 92, 246, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#8B5CF6",
        pointRadius: 4,
      }],
    };
  }, [selectedCategory]);
  
  const distributionData = useMemo(() => {
    return calculateDistributionData(selectedCategory);
  }, [selectedCategory]);
  
  const ratioData = useMemo(() => {
    return calculateRatioData(selectedCategory);
  }, [selectedCategory]);
  
  const topUsers = useMemo(() => {
    return calculateTopUsers(selectedCategory);
  }, [selectedCategory]);
  
  const historyData = useMemo(() => {
    return createHistoryData(selectedCategory);
  }, [selectedCategory]);
  
  const userName = user?.fullName || "User";
  
  if (!user) return null;
  
  return (
    <>
      <Sidebar userName={userName} />
      
      <div className="dashboard-container">
        <main className="main-content">
          <div className="header">
            <div>
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
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Checklist</div>
            </div>
            <div className="stat-card success">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Selesai (OK)</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Temuan (NG)</div>
            </div>
            <div className="stat-card info">
              <div className="stat-value">{stats.completionRate}%</div>
              <div className="stat-label">Tingkat Kelengkapan</div>
            </div>
            <div className="stat-card accent">
              <div className="stat-value">{avgPerDay}</div>
              <div className="stat-label">Rata-rata/Hari (7H)</div>
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
              {trendData.labels.length > 0 ? (
                <Line
                  data={trendData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: true, position: "top" },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${context.raw} checklist`
                        }
                      }
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    },
                  }}
                />
              ) : (
                <p className="empty-chart">Belum ada data checklist.</p>
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
                        legend: { position: "bottom" },
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
                {topUsers.length > 0 ? (
                  topUsers.map((user, i) => (
                    <div key={i} className="user-item">
                      <div className="user-info">
                        <span className="user-rank">#{i + 1}</span>
                        <span className="user-name">{user.name}</span>
                      </div>
                      <span className="user-count">{user.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-chart">Belum ada data.</p>
                )}
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">📜 Riwayat Checklist Lengkap</h2>
            {historyData.length > 0 ? (
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
                    {historyData.map((item, i) => (
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
            ) : (
              <p className="empty-activity">Belum ada riwayat checklist.</p>
            )}
          </div>
        </main>
      </div>

      <style jsx>{`
        .dashboard-container {
          display: flex;
          min-height: 100vh;
          background-color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .main-content {
          flex: 1;
          padding: 24px;
          min-height: calc(100vh - 64px);
          max-width: 1400px;
          margin: 0 auto;
          padding-top: 20px;
        }

        .header {
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }

        .page-title {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }

        .page-subtitle {
          font-size: 16px;
          color: #ffffff;
          margin-top: 4px;
        }

        .filter-container {
          display: flex;
          align-items: center;
          gap: 12px;
          background: white;
          padding: 12px 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .filter-label {
          font-weight: 600;
          color: #334155;
          margin: 0;
        }

        .category-dropdown {
          padding: 8px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          background-color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-dropdown:focus {
          outline: none;
          border-color: #8B5CF6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: all 0.3s ease;
          border-left: 4px solid #cbd5e1;
        }

        .stat-card.primary { border-left-color: #8B5CF6; }
        .stat-card.success { border-left-color: #10B981; }
        .stat-card.warning { border-left-color: #F59E0B; }
        .stat-card.info { border-left-color: #3B82F6; }
        .stat-card.accent { border-left-color: #EC4899; }

        .stat-value {
          font-size: 26px;
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
          gap: 14px;
        }

        .user-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          background: #f8fafc;
          border-radius: 12px;
          transition: background 0.2s;
        }

        .user-item:hover {
          background: #eef2ff;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .user-rank {
          font-weight: 700;
          color: #8B5CF6;
          background: #ede9fe;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 13px;
        }

        .user-name {
          color: #1e293b;
          font-weight: 600;
        }

        .user-count {
          background: #e0e7ff;
          color: #4f46e5;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .section {
          margin-top: 32px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 16px 0;
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
          background: #f8fafc;
          font-weight: 700;
          color: #334155;
          position: sticky;
          top: 0;
        }

        .history-table tbody tr:last-child td {
          border-bottom: none;
        }

        .history-table tbody tr:hover {
          background: #f8fafc;
        }

        .area-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
        }

        .area-badge.pre-assy {
          background: #fee2e2;
          color: #b91c1c;
        }

        .area-badge.final-assy {
          background: #dbeafe;
          color: #1e40af;
        }

        .status-badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.ok {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.ng {
          background: #fef3c7;
          color: #92400e;
        }

        .empty-activity {
          padding: 24px;
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          background: white;
          border-radius: 16px;
          margin-top: 16px;
        }

        @media (max-width: 768px) {
          .dashboard-container {
            flex-direction: column;
          }
          .main-content {
            padding: 16px;
          }
          .header {
            flex-direction: column;
            align-items: stretch;
          }
          .filter-container {
            width: 100%;
          }
          .category-dropdown {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}