"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { NavbarStatic } from "@/components/navbar-static"
import { DetailModal } from "@/components/ui/detailmodal"
import React from "react"
import Link from "next/link"
import { Sidebar } from "@/components/Sidebar"

interface CheckPoint {
  id: number
  checkPoint: string
  shift: "A" | "B"
  frequency: string
  judge: string
}

interface CheckResult {
  status: "OK" | "NG"
  ngCount: number
  items: Array<{ name: string; status: "OK" | "NG" | "N/A"; notes: string }>
  notes: string
  submittedAt: string
  submittedBy: string
}

export default function PressureJigPreAssyStatusPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (redirected) return
    if (!user) {
      setRedirected(true)
      router.push("/login-page")
    }
  }, [user, router, redirected])

  // 🔹 Hanya Inspector boleh akses. Jika Group Leader, redirect diam-diam.
  useEffect(() => {
    if (redirected) return
    if (user && user.role !== "inspector-qa") {
      setRedirected(true)
      router.push("/status-pre-assy")
    }
  }, [user, router, redirected])

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // 🔹 Data Pressure Jig (7 item × 2 shift)
  const checkpoints = useMemo<CheckPoint[]>(() => [
    { id: 1, checkPoint: "Apakah pressure jig diletakkan sesuai dengan tempatnya.", shift: "A", frequency: "1x /Hari", judge: "O/X" },
    { id: 1.1, checkPoint: "Apakah pressure jig diletakkan sesuai dengan tempatnya.", shift: "B", frequency: "1x /Hari", judge: "O/X" },
    { id: 2, checkPoint: "Tidak ada pressure jig yang hilang.", shift: "A", frequency: "1x /Hari", judge: "O/X" },
    { id: 2.1, checkPoint: "Tidak ada pressure jig yang hilang.", shift: "B", frequency: "1x /Hari", judge: "O/X" },
    { id: 3, checkPoint: "Tidak ada pressure jig yang rusak/bent/damage.", shift: "A", frequency: "1x /Hari", judge: "O/X" },
    { id: 3.1, checkPoint: "Tidak ada pressure jig yang rusak/bent/damage.", shift: "B", frequency: "1x /Hari", judge: "O/X" },
    { id: 4, checkPoint: "Apakah pin dari contact pressure jig bisa digunakan dengan mudah.", shift: "A", frequency: "1x /Hari", judge: "O/X" },
    { id: 4.1, checkPoint: "Apakah pin dari contact pressure jig bisa digunakan dengan mudah.", shift: "B", frequency: "1x /Hari", judge: "O/X" },
    { id: 5, checkPoint: "Tidak ada identitas warna tape pada pressure jig yang terkelupas.", shift: "A", frequency: "1x /Hari", judge: "O/X" },
    { id: 5.1, checkPoint: "Tidak ada identitas warna tape pada pressure jig yang terkelupas.", shift: "B", frequency: "1x /Hari", judge: "O/X" },
    { id: 6, checkPoint: "Tidak ada jig yang tidak diperlukan di area proses.", shift: "A", frequency: "1x /Hari", judge: "O/X" },
    { id: 6.1, checkPoint: "Tidak ada jig yang tidak diperlukan di area proses.", shift: "B", frequency: "1x /Hari", judge: "O/X" },
    { id: 7, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift: "A", frequency: "1x /Bulan", judge: "" },
    { id: 7.1, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift: "B", frequency: "1x /Bulan", judge: "" },
  ], [])

  const [activeMonth, setActiveMonth] = useState(() => new Date().getMonth())
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear())

  const storageKey = `preAssyPressureJigInspectorDailyCheckResults`
  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  useEffect(() => {
    const loadResults = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(storageKey)
        setResults(saved ? JSON.parse(saved) : {})
      }
    }
    loadResults()
    const handleStorage = () => loadResults()
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const januaryDates = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])
  const today = new Date().getDate()

  const getDateKey = (date: number): string => {
    return `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
  }

  const getResult = (date: number, id: number, shift: "A" | "B", timeSlot?: string) => {
    const dateKey = getDateKey(date)
    const key = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    return results[dateKey]?.[key] || null
  }

  const handleStatusChange = (
    date: number,
    id: number,
    shift: "A" | "B",
    newStatus: "OK" | "NG" | "-",
    timeSlot?: string
  ) => {
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    // DEEP CLONE untuk menghindari reference issues
    const newResults = JSON.parse(JSON.stringify(results))

    if (newStatus === "-") {
      // Hapus entry jika status diubah menjadi "-"
      if (newResults[dateKey]?.[itemKey]) {
        delete newResults[dateKey][itemKey]
        if (Object.keys(newResults[dateKey]).length === 0) {
          delete newResults[dateKey]
        }
      }
    } else if (newStatus === "NG") {
      // Update atau tambah entry NG
      const existing = newResults[dateKey]?.[itemKey]
      
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemKey] = {
        status: "NG",
        ngCount: 1,
        items: existing?.items || [],
        notes: existing?.notes || "  ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "  ",
        ngDepartment: existing?.ngDepartment || "QA"
      }
      
      // Buka modal NG untuk edit notes
      setNgModal({
        date,
        checkpoint: { id, shift },
        shift,
        notes: existing?.ngDescription || "  ",
        department: existing?.ngDepartment || "QA"
      })
    } else {
      // Update atau tambah entry OK
      const existing = newResults[dateKey]?.[itemKey]
      
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemKey] = {
        status: "OK",
        ngCount: 0,
        items: existing?.items || [],
        notes: existing?.notes || "  ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "  ",
        ngDepartment: existing?.ngDepartment || "QA"
      }
    }

    // Update state dan localStorage
    setResults(newResults)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newResults))
    }
  }

  const saveNgReport = () => {
    if (!ngModal) return
    const { date, weekIndex, dayIndex, checkpoint, shift, notes, department } = ngModal
    let dateKey = ""

    if (!dateKey) return

    const itemKey = `${checkpoint.id}-${shift}`
    const newResults = JSON.parse(JSON.stringify(results))

    newResults[dateKey] = newResults[dateKey] || {}
    newResults[dateKey][itemKey] = {
      ...newResults[dateKey][itemKey],
      ngDescription: notes,
      ngDepartment: department
    }

    setResults(newResults)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newResults))
    }
    setNgModal(null)
  }

  const [ngModal, setNgModal] = useState<{
    date?: number
    weekIndex?: number
    dayIndex?: number
    checkpoint: any
    shift: "A" | "B"
    notes: string
    department: string
  } | null>(null)

  const departments = ["QA", "Produksi", "Maintenance", "Logistik", "Engineering"]

  const [modalData, setModalData] = useState<{ date: number; checkpoint: CheckPoint; result: CheckResult } | null>(null)
  
  const isCurrentMonth = activeMonth === currentMonth && activeYear === currentYear

  const renderStatusCell = (date: number, checkpoint: any, timeSlot?: string) => {
    const id = checkpoint.id
    const shift = checkpoint.shift
    const result = getResult(date, id, shift, timeSlot)
    // Jika sudah ada hasil ATAU hari ini (untuk input baru), tampilkan dropdown yang editable
    if (result || (isCurrentMonth && date === today)) {
      const currentStatus = result?.status || 
        results[getDateKey(date)]?.[timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`]?.status || "-"
      
      const getBgColor = (status: string) => {
        if (status === "OK") return "#4caf50"
        if (status === "NG") return "#f44336"
        return "#9e9e9e"
      }
      
      return (
        <select
          className="status-dropdown"
          style={{
            backgroundColor: getBgColor(currentStatus),
            color: "white"
          }}
          value={currentStatus}
          onChange={(e) => handleStatusChange(date, id, shift, e.target.value as "OK" | "NG" | "-",  timeSlot)}
        >
          <option value="-">-</option>
          <option value="OK">✓ OK</option>
          <option value="NG">✗ NG</option>
        </select>
      )
    }

    // Untuk tanggal yang tidak perlu dicek
    return "-"
  }

  const title = "Daily Check Pressure Jig Inspector Pre Assy"

  if (!user) return null

  return (
    <div className="app-page">
      <Sidebar userName={user.fullName} />

      <div className="page-content">
        <div style={{
          textAlign : "center"
        }} className="header">
          <h1>{title}</h1>
          <p className="subtitle">Hanya untuk Inspector – Data tersimpan otomatis per shift.</p>
        </div>

        <div className="status-table-section">
          <div className="table-wrapper">
            <table className="status-table">
              <thead>
                <tr>
                  <th colSpan={5}></th>
                  <th colSpan={31} className="month-header">
                    JANUARI 2026
                  </th>
                </tr>
                <tr>
                  <th className="col-no">No</th>
                  <th className="col-checkpoint">Item Check</th>
                  <th className="col-freq">Freq</th>
                  <th className="col-judge">Judge</th>
                  <th className="col-shift">Shift</th>
                  {januaryDates.map((date) => (
                    <th key={date} className={`col-date ${date === today ? "col-date-today" : ""}`}>
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, i) => i + 1).map((id) => {
                  const shiftA = checkpoints.find(cp => cp.id === id && cp.shift === 'A')
                  const shiftB = checkpoints.find(cp => cp.id === id + 0.1 && cp.shift === 'B')
                  if (!shiftA || !shiftB) return null
                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td className="col-no" rowSpan={2}>{id}</td>
                        <td className="col-checkpoint" rowSpan={2}>{shiftA.checkPoint}</td>
                        <td className="col-freq" rowSpan={2}>{shiftA.frequency}</td>
                        <td className="col-judge" rowSpan={2}>{shiftA.judge}</td>
                        <td className="col-shift">{shiftA.shift}</td>
                        {januaryDates.map((date) => (
                          <td key={`A-${id}-${date}`} className={`col-date px-1.5 py-1 text-xs border ${date === today ? "bg-blue-50" : ""}`}>
                            {renderStatusCell(date, shiftA)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="col-shift">{shiftB.shift}</td>
                        {januaryDates.map((date) => (
                          <td key={`B-${id}-${date}`} className={`col-date px-1.5 py-1 text-xs border ${date === today ? "bg-blue-50" : ""}`}>
                            {renderStatusCell(date, shiftB)}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {modalData && <DetailModal data={modalData} onClose={() => setModalData(null)} />}
      </div>
      
      {/* === MODAL NG === */}
      {ngModal && (
        <div className="ng-modal-overlay">
          <div className="ng-modal">
            <h3>Edit Laporan Kondisi NG</h3>
            <div className="ng-form-group">
              <label>Keterangan NG:</label>
              <textarea
                value={ngModal.notes}
                onChange={(e) => setNgModal({ ...ngModal, notes: e.target.value })}
                rows={3}
                placeholder="Deskripsikan kondisi NG..."
              />
            </div>
            <div className="ng-form-group">
              <label>Departemen Tujuan:</label>
              <select
                value={ngModal.department}
                onChange={(e) => setNgModal({ ...ngModal, department: e.target.value })}
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="ng-modal-actions">
              <button onClick={() => setNgModal(null)}>Batal</button>
              <button onClick={saveNgReport} className="btn-primary">Simpan</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .header {
          margin-bottom: 24px;
        }
        .header h1 {
          margin: 0;
          color: #0d47a1;
          font-size: 1.75rem;
        }
        .subtitle {
          margin: 6px 0 0;
          color: #666;
          font-size: 0.95rem;
          font-style: italic;
        }

        .month-header {
          text-align: center;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0d47a1;
          background: #e3f2fd;
          padding: 12px 0;
        }
        .table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .status-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 0.875rem;
        }
        .status-table th,
        .status-table td {
          padding: 10px 6px;
          text-align: center;
          border: 1px solid #e0e0e0;
          vertical-align: top;
        }
        .status-table th {
          background: #f5f9ff;
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .col-no {
          width: 40px;
          text-align: center;
        }
        .col-checkpoint {
          min-width: 360px;
          word-break: break-word;
        }
        .col-freq,
        .col-judge,
        .col-shift {
          min-width: 80px;
          text-align: center;
        }
        .col-date {
          min-width: 36px;
          text-align: center;
        }
        .col-date-today {
          background: #fff8e1;
          color: #e65100;
          font-weight: 600;
        }
        .status-badge-ok {
          background: #4caf50;
          color: white;
        }
        .status-badge-ng {
          background: #f44336;
          color: white;
        }
        .status-badge-check {
          background: #1e88e5;
          color: white;
        }
        .ng-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .ng-modal {
          background: white;
          padding: 20px;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
        }
        .ng-modal h3 {
          margin-top: 0;
          color: #d32f2f;
        }
        .ng-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .ng-modal-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .ng-modal-actions button:first-child {
          background: #f5f5f5;
          color: #333;
        }
        .ng-form-group {
          margin-bottom: 15px;
        }
        .ng-form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        .ng-form-group textarea,
        .ng-form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .ng-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .ng-modal-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .ng-modal-actions button:first-child {
          background: #f5f5f5;
          color: #333;
        }
        .btn-primary {
          background: #1976d2;
          color: white;
        }
      `}</style>
    </div>
  )
}                   