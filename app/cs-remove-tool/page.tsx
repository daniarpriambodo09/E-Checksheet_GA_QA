// /app/cs-remove-tool/page.tsx

"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { NavbarStatic } from "@/components/navbar-static"
import { DetailModal } from "@/components/ui/detailmodal"
import Link from "next/link"
import React from "react"
import { Sidebar } from "@/components/Sidebar"

interface CheckItem {
  id: string
  no: number
  toolType: string
  controlNo: string
  itemCheck: string
  shift: "A" | "B"
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

export default function CSRemoveControlPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user || (user.role !== "group-leader-qa" && user.role !== "inspector-qa")) {
      router.push("/login-page")
    }
  }, [user, router])

  // 🔹 Tanggal hari ini (real-time dari sistem)
  const todayDate = new Date().getDate() // Tanggal hari ini secara real-time
  const appStartDate = 8 // aplikasi mulai 8 Jan

  // 🔹 Data checklist dengan id unik
  const [checkItems] = useState<CheckItem[]>([
    // NO 1 - PA
    { id: "1-X-1-A", no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "1-X-1-B", no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "1-X-2-A", no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "1-X-2-B", no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "1-X-3-A", no: 1, toolType: "PA", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "1-X-3-B", no: 1, toolType: "PA", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "1-X-4-A", no: 1, toolType: "PA", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "1-X-4-B", no: 1, toolType: "PA", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 2 - DLI
    { id: "2-X-1-A", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "2-X-1-B", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "2-X-2-A", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "2-X-2-B", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "2-X-3-A", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "2-X-3-B", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "2-X-4-A", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "2-X-4-B", no: 2, toolType: "DLI", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 3 - 1-150A
    { id: "3-X-1-A", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "3-X-1-B", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "3-X-2-A", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "3-X-2-B", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "3-X-3-A", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "3-X-3-B", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "3-X-4-A", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "3-X-4-B", no: 3, toolType: "1-85", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 4 - CNR
    { id: "4-X-1-A", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "4-X-1-B", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "4-X-2-A", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "4-X-2-B", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "4-X-3-A", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "4-X-3-B", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "4-X-4-A", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "4-X-4-B", no: 4, toolType: "1-73", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 5 - TCNR
    { id: "5-X-1-A", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "5-X-1-B", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "5-X-2-A", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "5-X-2-B", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "5-X-3-A", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "5-X-3-B", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "5-X-4-A", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "5-X-4-B", no: 5, toolType: "1-79", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 6 - 1-72A
    { id: "6-X-1-A", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "6-X-1-B", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "6-X-2-A", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "6-X-2-B", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "6-X-3-A", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "6-X-3-B", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "6-X-4-A", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "6-X-4-B", no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 7 - 1-114
    { id: "7-X-1-A", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "7-X-1-B", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "7-X-2-A", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "7-X-2-B", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "7-X-3-A", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "7-X-3-B", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "7-X-4-A", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "7-X-4-B", no: 7, toolType: "1-114", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 8 - 1-42A
    { id: "8-X-1-A", no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "8-X-1-B", no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "8-X-2-A", no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "8-X-2-B", no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "8-X-3-A", no: 8, toolType: "5", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "8-X-3-B", no: 8, toolType: "5", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "8-X-4-A", no: 8, toolType: "5", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "8-X-4-B", no: 8, toolType: "5", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 9 - 1-35
    { id: "9-X-1-A", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "9-X-1-B", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "9-X-2-A", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "9-X-2-B", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "9-X-3-A", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "9-X-3-B", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "9-X-4-A", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "9-X-4-B", no: 9, toolType: "THNH", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 10 - 1-85
    { id: "10-X-1-A", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "10-X-1-B", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "10-X-2-A", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "10-X-2-B", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "10-X-3-A", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "10-X-3-B", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "10-X-4-A", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "10-X-4-B", no: 10, toolType: "1-08", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 11 - 1-83A
    { id: "11-X-1-A", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "11-X-1-B", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "11-X-2-A", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "11-X-2-B", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "11-X-3-A", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "11-X-3-B", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "11-X-4-A", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "11-X-4-B", no: 11, toolType: "3-07", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 12 - 1-73
    { id: "12-X-1-A", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "12-X-1-B", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "12-X-2-A", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "12-X-2-B", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "12-X-3-A", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "12-X-3-B", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "12-X-4-A", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "12-X-4-B", no: 12, toolType: "1-35", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 13 - 1-105
    { id: "13-X-1-A", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "13-X-1-B", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "13-X-2-A", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "13-X-2-B", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "13-X-3-A", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "13-X-3-B", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "13-X-4-A", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "13-X-4-B", no: 13, toolType: "1-105", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 14 - TLC
    { id: "14-X-1-A", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "14-X-1-B", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "14-X-2-A", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "14-X-2-B", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "14-X-3-A", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "14-X-3-B", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "14-X-4-A", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "14-X-4-B", no: 14, toolType: "TLC", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 15 - EXTRACTION JIG / GO NO GO TERMINAL
    // R
    { id: "15-R-1-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "R", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "15-R-1-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "R", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "15-R-2-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "R", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "15-R-2-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "R", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "15-R-3-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "R", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "15-R-3-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "R", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // G
    { id: "15-G-1-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "G", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "15-G-1-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "G", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "15-G-2-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "G", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "15-G-2-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "G", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "15-G-3-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "G", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "15-G-3-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "G", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // W
    { id: "15-W-1-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "W", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "15-W-1-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "W", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "15-W-2-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "W", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "15-W-2-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "W", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "15-W-3-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "W", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "15-W-3-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "W", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // Y
    { id: "15-Y-1-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "Y", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "15-Y-1-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "Y", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "15-Y-2-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "Y", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "15-Y-2-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "Y", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "15-Y-3-A", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "Y", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "15-Y-3-B", no: 15, toolType: "EXTRACTION JIG / GO NO GO TERMINAL", controlNo: "Y", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

    // NO 16 - CLIPPER
    { id: "16-X-1-A", no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "16-X-1-B", no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "16-X-2-A", no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "16-X-2-B", no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "16-X-3-A", no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "16-X-3-B", no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
  ])

  // 🔹 State hasil checklist
  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("csRemoveControlResults")
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  useEffect(() => {
    const loadResults = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("csRemoveControlResults")
        setResults(saved ? JSON.parse(saved) : {})
      }
    }
    loadResults()
    // Listen untuk perubahan dari tab/window lain atau dari /e-checksheet
    const handleStorage = () => loadResults()
    window.addEventListener("storage", handleStorage)
    // Listen untuk event custom dari /e-checksheet pada tab yang sama
    window.addEventListener("csRemoveControlUpdated", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("csRemoveControlUpdated", handleStorage)
    }
  }, [])

  // 🔹 Generate tanggal 1–31
  const dates = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])

  // 🔹 Ambil hasil dari localStorage
  const getResult = (date: number, itemId: string) => {
    const dateKey = `2026-01-${String(date).padStart(2, "0")}`
    return results[dateKey]?.[itemId] || null
  }

  // 🔹 Modal state
  const [modalData, setModalData] = useState<{
    date: number
    item: CheckItem
    result: CheckResult
  } | null>(null)

  // 🔹 Render status cell dengan logika real-time
  const renderStatusCell = (date: number, item: CheckItem) => {
    // Jika tanggal < tanggal mulai aplikasi → kosong
    if (date < appStartDate) {
      return null
    }

    // Jika tanggal > hari ini → kosong (belum waktunya)
    if (date > todayDate) {
      return null
    }

    // Ambil hasil dari localStorage
    const result = getResult(date, item.id)

    // Jika sudah dicek → tampilkan status
    if (result) {
      return (
        <span
          className={`status-badge ${result.status === "OK" ? "status-badge-ok" : "status-badge-ng"} text-xs px-1 py-0.5 rounded cursor-pointer`}
          onClick={() => setModalData({ date, item, result })}
        >
          {result.status === "OK" ? "OK" : `NG (${result.ngCount})`}
        </span>
      )
    }

    // Jika belum dicek dan tanggal = hari ini → tampilkan CHECK
    if (date === todayDate) {
      return (
        <Link href={`/e-checksheet?id=${item.id}&shift=${item.shift}&date=2026-01-${String(date).padStart(2, "0")}&mainType=cs-remove-tool`} className="block w-full">
          <span className="status-badge status-badge-check text-xs px-1 py-0.5 rounded cursor-pointer inline-block w-full text-center">
            CHECK
          </span>
        </Link>
      )
    }

    // Jika belum pernah dicek dan tanggal < hari ini → kosong
    return null
  }

  if (!user) return null

  return (
    <div className="app-page">
      <Sidebar userName={user.fullName} />

      <div 
        className="page-content"
        style={{
          paddingLeft: "95px",
          paddingRight: "25px",
          paddingTop: "25px",
          paddingBottom: "25px",
        }}>
        <div className="header">
          <h1>Check Sheet Control Remove Tool</h1>
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
                  <th className="col-no" rowSpan={2}>NO</th>
                  <th className="col-tool" rowSpan={2}>TOOL TYPE</th>
                  <th className="col-control" rowSpan={2}>CONTROL NO</th>
                  <th className="col-item" rowSpan={2}>ITEM CHECK</th>
                  <th className="col-shift" rowSpan={2}>SHIFT</th>
                  <th colSpan={31} style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold" }}>
                    DATE
                  </th>
                </tr>
                <tr>
                  {dates.map((date) => (
                    <th key={date} className={`col-date ${date === todayDate ? "col-date-today" : ""}`}>
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(
                  checkItems.reduce<Record<number, CheckItem[]>>((acc, item) => {
                    if (!acc[item.no]) acc[item.no] = []
                    acc[item.no].push(item)
                    return acc
                  }, {})
                ).map((group, idx) => {
                  const rowCount = group.length
                  return (
                    <React.Fragment key={group[0].no}>
                      {group.map((item, i) => (
                        <tr key={item.id}>
                          {i === 0 && <td rowSpan={rowCount} className="col-no">{item.no}</td>}
                          {i === 0 && <td rowSpan={rowCount} className="col-tool">{item.toolType}</td>}
                          {i === 0 && <td rowSpan={rowCount} className="col-control">{item.controlNo}</td>}
                          <td className="col-item">{item.itemCheck}</td>
                          <td className="col-shift">{item.shift}</td>
                          {dates.map((date) => (
                            <td
                              key={`${item.id}-${date}`}
                              className={`col-date px-1.5 py-1 text-xs border ${
                                date >= appStartDate && date <= todayDate ? "bg-white" : "bg-gray-200"
                              }`}
                            >
                              {renderStatusCell(date, item)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DetailModal */}
        {modalData && (
          <DetailModal
            data={{
              date: modalData.date,
              checkpoint: {
                checkPoint: modalData.item.itemCheck,
                shift: modalData.item.shift,
                waktuCheck: "",
                method: `${modalData.item.toolType} / ${modalData.item.controlNo || "-"}`,
              },
              result: modalData.result,
            }}
            onClose={() => setModalData(null)}
          />
        )}
      </div>
    </div>
  )
  
}