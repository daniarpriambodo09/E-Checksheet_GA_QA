"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { NavbarStatic } from "@/components/navbar-static"
import { DetailModal } from "@/components/ui/detailmodal"
import React from "react"
import Link from "next/link"

interface CheckPoint {
  id: number
  checkPoint: string
  shift: "A" | "B"
  waktuCheck: string
  standard: string
}

interface CheckResult {
  status: "OK" | "NG"
  ngCount: number
  items: Array<{
    name: string
    status: "OK" | "NG" | "N/A"
    notes: string
  }>
  notes: string
  submittedAt: string
  submittedBy: string
}

export default function PreAssyInspectorStatusPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (redirected) return;
    if (!user || user.role !== "inspector-qa") {
      setRedirected(true)
      router.push("/login-page")
    }
  }, [user, router, redirected])

  const [checkpoints] = useState<CheckPoint[]>([
    { id: 1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", shift: "A", waktuCheck: "Setiap Hari", standard: "Check pengisian C/S 4M" },
    { id: 1.1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", shift: "B", waktuCheck: "Setiap Hari", standard: "Check pengisian C/S 4M" },
    { id: 2, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", shift: "A", waktuCheck: "Setiap Hari", standard: "Check actual pengisian LKI ( Sampling check min. 3 inspector )" },
    { id: 2.1, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", shift: "B", waktuCheck: "Setiap Hari", standard: "Check actual pengisian LKI ( Sampling check min. 3 inspector )" },
    { id: 3, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", shift: "A", waktuCheck: "Setiap Hari", standard: "" },
    { id: 3.1, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", shift: "B", waktuCheck: "Setiap Hari", standard: "" },
    { id: 4, checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian...", shift: "A", waktuCheck: "Setiap Hari", standard: "Sesuai IS no. QA-ACL-PA-IS-031" },
    { id: 4.1, checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian...", shift: "B", waktuCheck: "Setiap Hari", standard: "Sesuai IS no. QA-ACL-PA-IS-031" },
    { id: 5, checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", shift: "A", waktuCheck: "Setiap Hari", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4" },
    { id: 5.1, checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", shift: "B", waktuCheck: "Setiap Hari", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4" },
    { id: 6, checkPoint: "Circuit di supply dan di letakan di store sesuai dengan address...", shift: "A", waktuCheck: "Setiap Senin & Kamis", standard: "Sampling check circuit yang ada di store" },
    { id: 6.1, checkPoint: "Circuit di supply dan di letakan di store sesuai dengan address...", shift: "B", waktuCheck: "Setiap Senin & Kamis", standard: "Sampling check circuit yang ada di store" },
    { id: 7, checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly...", shift: "A", waktuCheck: "Setiap Senin & Kamis", standard: "Check kondisi actual ( sampling check min. 3 inspector )" },
    { id: 7.1, checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly...", shift: "B", waktuCheck: "Setiap Senin & Kamis", standard: "Check kondisi actual ( sampling check min. 3 inspector )" },
    { id: 8, checkPoint: "Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan...", shift: "A", waktuCheck: "Setiap Selasa & Jumat", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 8.1, checkPoint: "Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan...", shift: "B", waktuCheck: "Setiap Selasa & Jumat", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 9, checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", shift: "A", waktuCheck: "Setiap Selasa & Jumat", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 9.1, checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", shift: "B", waktuCheck: "Setiap Selasa & Jumat", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 10, checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", shift: "A", waktuCheck: "Setiap Selasa & Jumat", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 10.1, checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", shift: "B", waktuCheck: "Setiap Selasa & Jumat", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 11, checkPoint: "Tidak ada bagian trolly inspector yang rusak", shift: "A", waktuCheck: "1 Inspector / Minggu", standard: "Check kondisi actual" },
    { id: 11.1, checkPoint: "Tidak ada bagian trolly inspector yang rusak", shift: "B", waktuCheck: "1 Inspector / Minggu", standard: "Check kondisi actual" },
    { id: 12, checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", shift: "A", waktuCheck: "1 Inspector / Minggu", standard: "Check actual dengan SWCT" },
    { id: 12.1, checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", shift: "B", waktuCheck: "1 Inspector / Minggu", standard: "Check actual dengan SWCT" },
    { id: 13, checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu...", shift: "A", waktuCheck: "Setiap Selasa", standard: "Check kondisi actual" },
    { id: 13.1, checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu...", shift: "B", waktuCheck: "Setiap Selasa", standard: "Check kondisi actual" },
    { id: 14, checkPoint: "Memastikan semua inspector menggunakan penutup kepala...", shift: "A", waktuCheck: "Setiap Hari", standard: "Check kondisi actual" },
    { id: 14.1, checkPoint: "Memastikan semua inspector menggunakan penutup kepala...", shift: "B", waktuCheck: "Setiap Hari", standard: "Check kondisi actual" },
  ])

  const storageKey = "preAssyInspectorDailyCheckResults"

  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  useEffect(() => {
    if (redirected) return;
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

  const getResult = (date: number, checkpointId: number, shift: "A" | "B") => {
    const dateKey = `2026-01-${String(date).padStart(2, "0")}`
    const checkpointKey = `${checkpointId}-${shift}`
    return results[dateKey]?.[checkpointKey] || null
  }

  const [modalData, setModalData] = useState<{
    date: number
    checkpoint: CheckPoint
    result: CheckResult
  } | null>(null)

  const renderStatusCell = (date: number, checkpoint: CheckPoint) => {
    const result = getResult(date, checkpoint.id, checkpoint.shift)
    if (result) {
      return (
        <span
          className={`status-badge ${result.status === "OK" ? "status-badge-ok" : "status-badge-ng"} text-xs px-1 py-0.5 rounded cursor-pointer inline-block`}
          onClick={() => setModalData({ date, checkpoint, result })}
          title={`Status: ${result.status}${result.status === "NG" ? ` (${result.ngCount})` : ""}`}
        >
          {result.status === "OK" ? "OK" : `NG (${result.ngCount})`}
        </span>
      )
    }
    if (date === today) {
      const dateStr = `2026-01-${String(date).padStart(2, "0")}`
      return (
        <Link
          href={`/e-checksheet?id=${checkpoint.id}&shift=${checkpoint.shift}&date=${dateStr}&mainType=pre-assy&subType=inspector`}
          className="block w-full"
        >
          <span className="status-badge status-badge-check text-xs px-1 py-0.5 rounded cursor-pointer inline-block w-full text-center">
            CHECK
          </span>
        </Link>
      )
    }
    return null
  }

  if (!user) return null

  return (
    <div className="app-page">
      <NavbarStatic userName={user.fullName} />

      <div className="page-content">
        <div className="header">
          <h1>Daily Check Inspector Pre Assy</h1>
          <div className="user-info">
            <span>Selamat datang, {user.fullName}</span>
            <a href="/login-page" className="logout-link">
              Logout
            </a>
          </div>
        </div>

        <div className="status-table-section">
          <div className="table-wrapper">
            <table className="status-table">
              <thead>
                <tr>
                  <th colSpan={4}></th>
                  <th colSpan={31} style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold" }}>
                    JANUARI
                  </th>
                </tr>
                <tr>
                  <th className="col-checkpoint">Check Point</th>
                  <th className="col-shift">Shift</th>
                  <th className="col-waktu">Waktu Check</th>
                  <th className="col-standard">Standard / Metode</th>
                  {januaryDates.map((date) => (
                    <th key={date} className={`col-date ${date === today ? "col-date-today" : ""}`}>
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  new Map(
                    checkpoints.map((cp) => [
                      Math.floor(cp.id),
                      checkpoints.filter((item) => Math.floor(item.id) === Math.floor(cp.id)),
                    ])
                  ).values()
                ).map((group, groupIndex) => (
                  <React.Fragment key={groupIndex}>
                    <tr>
                      <td className="col-checkpoint" rowSpan={2}>
                        {group[0].checkPoint}
                      </td>
                      <td className="col-shift">{group[0].shift}</td>
                      <td className="col-waktu">{group[0].waktuCheck}</td>
                      <td className="col-standard">{group[0].standard}</td>
                      {januaryDates.map((date) => (
                        <td
                          key={date}
                          className={`col-date px-1.5 py-1 text-xs border ${
                            date === today ? "bg-blue-50" : ""
                          }`}
                        >
                          {renderStatusCell(date, group[0])}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-shift">{group[1].shift}</td>
                      <td className="col-waktu">{group[1].waktuCheck}</td>
                      <td className="col-standard">{group[1].standard}</td>
                      {januaryDates.map((date) => (
                        <td
                          key={date}
                          className={`col-date px-1.5 py-1 text-xs border ${
                            date === today ? "bg-blue-50" : ""
                          }`}
                        >
                          {renderStatusCell(date, group[1])}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalData && (
          <DetailModal
            data={{
              date: modalData.date,
              checkpoint: modalData.checkpoint,
              result: modalData.result,
            }}
            onClose={() => setModalData(null)}
          />
        )}
      </div>

      <style jsx>{`
        .status-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 12px;
        }

        .status-table th,
        .status-table td {
          padding: 8px 4px;
          text-align: center;
          border: 1px solid #ddd;
        }

        .status-table th {
          background-color: #e3f2fd;
          font-weight: 600;
          color: #0d47a1;
        }

        .col-checkpoint {
          text-align: left;
          min-width: 250px;
          word-wrap: break-word;
        }

        .col-shift {
          min-width: 50px;
        }

        .col-waktu {
          min-width: 80px;
        }

        .col-standard {
          min-width: 100px;
        }

        .col-date {
          min-width: 40px;
        }

        .col-date-today {
          background-color: #e8f5e9;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
          display: inline-block;
          text-decoration: none;
        }

        .status-badge-ok {
          background-color: #4caf50;
          color: white;
        }

        .status-badge-ng {
          background-color: #f44336;
          color: white;
        }

        .status-badge-check {
          background-color: #2196f3;
          color: white;
        }

        .table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  )
}
