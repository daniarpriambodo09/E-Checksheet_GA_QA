// app/status-final-assy/page_backup.tsx
"use client"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DetailModal } from "@/components/ui/detailmodal"
import React from "react"
import { Sidebar } from "@/components/Sidebar"

interface CheckPoint {
  id: number
  no: string
  checkPoint: string
  shifts: Array<{
    shift: "A" | "B"
    waktuCheck: string
  }>
  standard: string
  type?: "normal" | "special" | "weekly"
}

interface CheckResult {
  status: "OK" | "NG" | "-"
  ngCount: number
  items: Array<{
    name: string
    status: "OK" | "NG" | "N/A"
    notes: string
  }>
  notes: string
  submittedAt: string
  submittedBy: string
  ngDescription?: string
  ngDepartment?: string
}

interface InspectorCheckItem {
  id: number
  no: string
  itemCheck: string
  checkPoint: string
  metodeCheck: string
  area: string
  shifts: Array<{
    shift: "A" | "B"
  }>
}

export default function FinalAssyStatusPage() {
  const router = useRouter()
  const { user } = useAuth()
  const currentRole = user?.role || "inspector-qa"

  useEffect(() => {
    if (!user) router.push("/login-page")
  }, [user, router])

  const isGroupLeader = currentRole === "group-leader-qa"
  const isInspector = currentRole === "inspector-qa"

  const [viewAs, setViewAs] = useState<"group-leader" | "inspector">(
    isGroupLeader ? "group-leader" : "inspector"
  )

  useEffect(() => {
    if (!isGroupLeader) {
      setViewAs("inspector")
    }
  }, [isGroupLeader])

  const showGroupLeaderTable = viewAs === "group-leader"
  const showInspectorTable = viewAs === "inspector"

  // === STATE BARU UNTUK SISTEM BULAN DINAMIS ===
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth())
  const [activeYear, setActiveYear] = useState(new Date().getFullYear())

  // === FUNGSI UTILITAS BARU ===
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getMonthName = (monthIndex: number): string => {
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ]
    return monthNames[monthIndex]
  }

  const changeMonth = (direction: number) => {
    let newMonth = activeMonth + direction
    let newYear = activeYear
    if (newMonth < 0) {
      newMonth = 11
      newYear--
    } else if (newMonth > 11) {
      newMonth = 0
      newYear++
    }
    setActiveMonth(newMonth)
    setActiveYear(newYear)
  }

  const getDateKey = (date: number): string => {
    return `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
  }

  // =====================================================================
  // === FUNGSI HELPER BARU: PENENTU EDITABLE CELL (INTI SOLUSI) ===
  // =====================================================================
  const isCellEditable = useCallback((
    cellDate: number,
    status: "OK" | "NG" | "-"
  ): boolean => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    // Buat Date object untuk tanggal cell
    const cellDateTime = new Date(activeYear, activeMonth, cellDate)
    
    // Jika tanggal berbeda dengan hari ini
    if (cellDateTime.getDate() !== now.getDate() || 
        cellDateTime.getMonth() !== now.getMonth() || 
        cellDateTime.getFullYear() !== now.getFullYear()) {
      
      // Tanggal masa lalu
      if (cellDateTime < now) {
        // OK yang sudah berlalu = locked (tidak bisa diedit)
        if (status === "OK") return false
        // NG yang sudah berlalu = masih bisa diubah menjadi OK
        if (status === "NG") return true
        // "-" pada tanggal lalu = tidak bisa diisi
        return false
      }
      
      // Tanggal masa depan = tidak bisa diedit
      return false
    }
    
    // Untuk hari ini: semua status editable
    return true
  }, [activeMonth, activeYear])

  const [checkpoints] = useState<CheckPoint[]>([
    {
      id: 1,
      no: "1",
      checkPoint: "Check 4M kondisi, product yang mengalami perubahan 4M sudah di check dan tidak ada masalah",
      shifts: [
        { shift: "A", waktuCheck: "07:30 - 08:00" },
        { shift: "B", waktuCheck: "19:30 - 20:00" }
      ],
      standard: "Absensi Inspector",
      type: "normal"
    },
    {
      id: 2,
      no: "2",
      checkPoint: "Di lakukan pengecheckan HLC checker fixture dengan alignment gauge oleh inspector checker di akhir shift / checker fixture tidak terpakai",
      shifts: [
        { shift: "A", waktuCheck: "08:00 - 09:00" },
        { shift: "B", waktuCheck: "20:00 - 21:00" }
      ],
      standard: "Check Sheet HLC Checker",
      type: "normal"
    },
    {
      id: 3,
      no: "3",
      checkPoint: "Torque wrench ada nomor registrasi & kalibrasi tidak expired",
      shifts: [
        { shift: "A", waktuCheck: "08:00 - 09:00" },
        { shift: "B", waktuCheck: "20:00 - 21:00" }
      ],
      standard: "Check Actual Torque Wrench",
      type: "normal"
    },
    {
      id: 3.1,
      no: "3",
      checkPoint: "Jarum penunjukan cocok dengan titik nol dan semua bagian torque wrench tidak ada yang rusak",
      shifts: [
        { shift: "A", waktuCheck: "08:00 - 09:00" },
        { shift: "B", waktuCheck: "20:00 - 21:00" }
      ],
      standard: "Check Actual Torque Wrench",
      type: "normal"
    },
    {
      id: 4,
      no: "4",
      checkPoint: "Kondisi tool dan gauge di area inspection tidak ada yang rusak atau hilang dan ada identitasnya",
      shifts: [
        { shift: "A", waktuCheck: "09:00 - 11:00" },
        { shift: "B", waktuCheck: "21:00 - 23:00" }
      ],
      standard: "Check Actual Tool / Gauge",
      type: "normal"
    },
    {
      id: 5,
      no: "5",
      checkPoint: "Setting connector ke checker fixture di lakukan dengan hati-hati, tidak menimbulkan defect damaged connector / bent terminal",
      shifts: [
        { shift: "A", waktuCheck: "09:00 - 11:00" },
        { shift: "B", waktuCheck: "21:00 - 23:00" }
      ],
      standard: "QA-ACL-FA-IS-046",
      type: "normal"
    },
    {
      id: 6,
      no: "6",
      checkPoint: "Inspection board di pasang cover jika tidak ada loading.",
      shifts: [
        { shift: "A", waktuCheck: "09:00 - 11:00" },
        { shift: "B", waktuCheck: "21:00 - 23:00" }
      ],
      standard: "Check Actual Kondisi Board",
      type: "normal"
    },
    {
      id: 7,
      no: "7",
      checkPoint: "Box / politener harness finish good yang quantitynya tidak standart di beri identitas yang jelas",
      shifts: [
        { shift: "A", waktuCheck: "11:00 - 12:00" },
        { shift: "B", waktuCheck: "23:00 - 24:00" }
      ],
      standard: "Ada Identitas Qty Tidak Standard",
      type: "normal"
    },
    {
      id: 8,
      no: "8",
      checkPoint: "Box / Politener pada saat proses di pasang tutup pada bagian atasnya",
      shifts: [
        { shift: "A", waktuCheck: "11:00 - 12:00" },
        { shift: "B", waktuCheck: "23:00 - 24:00" }
      ],
      standard: "Check Actual Politener",
      type: "normal"
    },
    {
      id: 9,
      no: "9",
      checkPoint: "Pengisian LKI dan DP oleh inspector sudah di lakukan dengan benar",
      shifts: [
        { shift: "A", waktuCheck: "13:00 - 14:00" },
        { shift: "B", waktuCheck: "01:00 - 02:00" }
      ],
      standard: "Check Actual LKI",
      type: "normal"
    },
    {
      id: 10,
      no: "10",
      checkPoint: "Harness defect di hanger merah dipasang defect tag dan pengisian defect tag sudah dilakukan dengan benar",
      shifts: [
        { shift: "A", waktuCheck: "14:00 - 15:00" },
        { shift: "B", waktuCheck: "02:00 - 03:00" }
      ],
      standard: "Check Defect Tag",
      type: "normal"
    },
    {
      id: 11,
      no: "11",
      checkPoint: "Identitas Assy number pada visual board sudah update sesuai D/C terakhir",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Senin" },
        { shift: "B", waktuCheck: "Setiap Hari Senin" }
      ],
      standard: "Check Actual",
      type: "normal"
    },
    {
      id: 12,
      no: "12",
      checkPoint: "Cek License card inspector (ada license card, tidak rusak, tidak expired, terpasang dengan benar)",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Senin" },
        { shift: "B", waktuCheck: "Setiap Hari Senin" }
      ],
      standard: "Check Actual",
      type: "normal"
    },
    {
      id: 13,
      no: "13",
      checkPoint: "Inspection point/Important point yang di pasang tidak ada yang rusak dan up date, check area Sub Assy sampai Receiving Inspection",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Selasa" },
        { shift: "B", waktuCheck: "Setiap Hari Selasa" }
      ],
      standard: "Check Important Point",
      type: "normal"
    },
    {
      id: 14,
      no: "14",
      checkPoint: "Inspector bekerja sesuai dengan SWCT *",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Rabu" },
        { shift: "B", waktuCheck: "Setiap Hari Rabu" }
      ],
      standard: "SWCT Inspector",
      type: "weekly"
    },
    {
      id: 15,
      no: "15",
      checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu dan lubang yang tidak dipergunakan ditutup dengan cover (SAFETY)",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Selasa" },
        { shift: "B", waktuCheck: "Setiap Hari Selasa" }
      ],
      standard: "Check Actual",
      type: "normal"
    },
    {
      id: 16,
      no: "16",
      checkPoint: "Memastikan semua inspector menggunakan penutup kepala (Topi / Jilbab)",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari" },
        { shift: "B", waktuCheck: "Setiap Hari" }
      ],
      standard: "Check Actual",
      type: "normal"
    },
    {
      id: 17,
      no: "17",
      checkPoint: "Cek Megic Pile yang digunakan diarea inspeksi & produksi dalam kondisi baik (tidak sobek, tidak berserabut & resleting dalam kondisi baik)",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Selasa" },
        { shift: "B", waktuCheck: "Setiap Hari Selasa" }
      ],
      standard: "Check Actual",
      type: "normal"
    },
    {
      id: 18,
      no: "18",
      checkPoint: "Dummy Sample OK & N-OK Air Checker diarea Siage ada no registrasi, verifikasi tidak expired serta dalam kondisi baik dan tidak rusak",
      shifts: [
        { shift: "A", waktuCheck: "Setiap Hari Selasa" },
        { shift: "B", waktuCheck: "Setiap Hari Selasa" }
      ],
      standard: "Check Actual",
      type: "normal"
    },
    {
      id: 100,
      no: "",
      checkPoint: "Check ESO ( setiap hari selasa dan kamis )",
      shifts: [
        { shift: "A", waktuCheck: "CHECK SETIAP HARI SELASA & KAMIS" },
        { shift: "B", waktuCheck: "CHECK SETIAP HARI SELASA & KAMIS" }
      ],
      standard: "CHECK SETIAP HARI SELASA & KAMIS",
      type: "special"
    }
  ])

  const [inspectorCheckItems] = useState<InspectorCheckItem[]>([
    {
      id: 1,
      no: "1",
      itemCheck: "PIPO",
      checkPoint: "ADA NOMOR REGISTER",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 2,
      no: "1",
      itemCheck: "PIPO",
      checkPoint: "PIPO DALAM KONDISI BAIK DAN TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 3,
      no: "2",
      itemCheck: "ROLL METER / MISTAR BAJA",
      checkPoint: "ADA NOMOR REGISTER + KALIBRASI TIDAK EXPIRED",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 4,
      no: "2",
      itemCheck: "ROLL METER / MISTAR BAJA",
      checkPoint: "GARIS ANGKA TERBACA DENGAN JELAS / TIDAK BERKARAT",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 5,
      no: "2",
      itemCheck: "ROLL METER / MISTAR BAJA",
      checkPoint: "ROLLMETER / MISTAR BAJA DALAM KONDISI BAIK DAN TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 6,
      no: "3",
      itemCheck: "GO NO GO",
      checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 7,
      no: "3",
      itemCheck: "GO NO GO",
      checkPoint: "TIDAK ADA SKRUP YANG KENDOR / HILANG",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 8,
      no: "3",
      itemCheck: "GO NO GO",
      checkPoint: "KONDISI GO NO GO DALAM KEADAAN BAIK & BAGIAN BELAKANG (WIRE) DILINDUNGI TAPE / SPIRAL",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 9,
      no: "3",
      itemCheck: "GO NO GO",
      checkPoint: "ADA STIKER WARNA HIJAU PADA GO NO GO TERMINAL (M TERMINAL) DAN TIDAK LEPAS",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 10,
      no: "3",
      itemCheck: "GO NO GO",
      checkPoint: "KONDISI GO NO GO TERMINAL DALAM KEADAAN OK (TIDAK AUS, TIDAK BENT, TIDAK PATAH, TIDAK DEFORMASI)",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 11,
      no: "3",
      itemCheck: "GO NO GO",
      checkPoint: "BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK",
      metodeCheck: "DICOBA",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 12,
      no: "4",
      itemCheck: "PUSH GAUGE RB",
      checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 13,
      no: "4",
      itemCheck: "PUSH GAUGE RB",
      checkPoint: "TIDAK ADA SKRUP YANG KENDOR / HILANG",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 14,
      no: "4",
      itemCheck: "PUSH GAUGE RB",
      checkPoint: "ADA BANTALAN KARET (CUSHION) PADA UJUNGNYA",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 15,
      no: "4",
      itemCheck: "PUSH GAUGE RB",
      checkPoint: "LAMPU INDIKATOR MENYALA",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 16,
      no: "5",
      itemCheck: "DUMMY SAMPLE OK & N-OK",
      checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 17,
      no: "5",
      itemCheck: "DUMMY SAMPLE OK & N-OK",
      checkPoint: "SAMPLE DALAM KONDISI BAIK DAN TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "CHECKER",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 18,
      no: "6",
      itemCheck: "IMPORTANT / INSPECTION POINT",
      checkPoint: "IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 19,
      no: "6",
      itemCheck: "IMPORTANT / INSPECTION POINT",
      checkPoint: "ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 20,
      no: "7",
      itemCheck: "FUSE PLATE",
      checkPoint: "ADA NOMOR REGISTER + VERIFIKASI TIDAK EXPIRED",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 21,
      no: "7",
      itemCheck: "FUSE PLATE",
      checkPoint: "WARNA DAN ANGKA ADA DAN TERBACA DENGAN JELAS",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 22,
      no: "7",
      itemCheck: "FUSE PLATE",
      checkPoint: "FUSE PLATE DALAM KONDISI BAIK DAN TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 23,
      no: "7",
      itemCheck: "FUSE PLATE",
      checkPoint: "FUSE INSERTION / PENEKAN FUSE DALAM KONDISI OK",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 24,
      no: "8",
      itemCheck: "LAMPU NAVIGASI",
      checkPoint: "LAMPU LED KONDISI MENYALA",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 25,
      no: "8",
      itemCheck: "LAMPU NAVIGASI",
      checkPoint: "COVER LED TIDAK HILANG ATAU PECAH",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 26,
      no: "8",
      itemCheck: "LAMPU NAVIGASI",
      checkPoint: "LAMPU LED TERPASANG SEMPURNA/TIDAK LEPAS",
      metodeCheck: "VISUAL",
      area: "VISUAL 1",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 27,
      no: "9",
      itemCheck: "TAPE NAVIGASI",
      checkPoint: "LAMPU LED KONDISI MENYALA",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 28,
      no: "9",
      itemCheck: "TAPE NAVIGASI",
      checkPoint: "KONDISI SWITCH TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 29,
      no: "9",
      itemCheck: "TAPE NAVIGASI",
      checkPoint: "ADA IDENTITAS TAPE",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 30,
      no: "10",
      itemCheck: "INSPECTION BOARD",
      checkPoint: "TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 31,
      no: "10",
      itemCheck: "INSPECTION BOARD",
      checkPoint: "APPROVAL SHEET SESUAI LEVEL TERAKHIR",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 32,
      no: "10",
      itemCheck: "INSPECTION BOARD",
      checkPoint: "APPROVAL SHEET DITANDA TANGANI QA",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 33,
      no: "10",
      itemCheck: "INSPECTION BOARD",
      checkPoint: "KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK",
      metodeCheck: "VISUAL",
      area: "VISUAL 2",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 34,
      no: "11",
      itemCheck: "DRY SURF",
      checkPoint: "BOTOL TIDAK BOCOR / RUSAK & ADA STICKER B3",
      metodeCheck: "VISUAL",
      area: "DOUBLE CHECK (RI)",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 35,
      no: "11",
      itemCheck: "DRY SURF",
      checkPoint: "SPONS / KUAS TIDAK RUSAK / AUS",
      metodeCheck: "VISUAL",
      area: "DOUBLE CHECK (RI)",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 36,
      no: "11",
      itemCheck: "DRY SURF",
      checkPoint: "ADA TANDA MAX & MIN PADA BOTOL DAN ISI CAIRAN SESUAI RENTANG MAX DAN MIN",
      metodeCheck: "VISUAL",
      area: "DOUBLE CHECK (RI)",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 37,
      no: "12",
      itemCheck: "PACKING",
      checkPoint: "KONDISI TUTUP POLYTAINER TIDAK RUSAK DAN JUMLAHNYA SUDAH SESUAI",
      metodeCheck: "VISUAL",
      area: "DOUBLE CHECK (RI)",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 38,
      no: "12",
      itemCheck: "PACKING",
      checkPoint: "HT SCAN BISA BERFUNGSI DENGAN BAIK",
      metodeCheck: "VISUAL",
      area: "DOUBLE CHECK (RI)",
      shifts: [{ shift: "A" }, { shift: "B" }]
    },
    {
      id: 39,
      no: "12",
      itemCheck: "PACKING",
      checkPoint: "MAJUN DAN SIKAT POLYTAINER ADA PADA TEMPATNYA DAN SESUAI DENGAN JUMLAHNYA",
      metodeCheck: "VISUAL",
      area: "DOUBLE CHECK (RI)",
      shifts: [{ shift: "A" }, { shift: "B" }]
    }
  ])

  const checkpointDateRules: Record<string, number[]> = {
    "GO NO GO: BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK: A": [1, 8, 15, 22, 29],
    "GO NO GO: BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK: B": [3, 10, 17, 24, 31],
    "IMPORTANT / INSPECTION POINT: IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK: A": [1, 8, 15, 22, 29],
    "IMPORTANT / INSPECTION POINT: IMPORTANT/INSPECTION POINT TERBACA DENGAN JELAS DAN TIDAK RUSAK: B": [3, 10, 17, 24, 31],
    "IMPORTANT / INSPECTION POINT: ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU: A": [1, 8, 15, 22, 29],
    "IMPORTANT / INSPECTION POINT: ISI IMPORTANT/INSPECTION POINT SESUAI DENGAN LEVEL TERBARU: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: TIDAK ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: APPROVAL SHEET SESUAI LEVEL TERAKHIR: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: APPROVAL SHEET SESUAI LEVEL TERAKHIR: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: APPROVAL SHEET DITANDA TANGANI QA: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: APPROVAL SHEET DITANDA TANGANI QA: B": [3, 10, 17, 24, 31],
    "INSPECTION BOARD: KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK: A": [1, 8, 15, 22, 29],
    "INSPECTION BOARD: KONDISI SAMPLE DAN PLASTIK TIDAK RUSAK: B": [3, 10, 17, 24, 31],
  }

  const isCheckDate = (item: InspectorCheckItem | CheckPoint, shift: "A" | "B", date: number): boolean => {
    if ('itemCheck' in item) {
      const ruleKey = `${item.itemCheck}: ${item.checkPoint}: ${shift}`
      const checkDates = checkpointDateRules[ruleKey]
      if (!checkDates) return true
      return checkDates.includes(date)
    }
    const ruleKey = item.checkPoint
    const checkDates = checkpointDateRules[ruleKey]
    if (!checkDates) return true
    return checkDates.includes(date)
  }

  const getStorageKey = (type: "group-leader" | "inspector") => {
    return `finalAssy_${type}_DailyCheckResults`
  }

  const [groupLeaderResults, setGroupLeaderResults] = useState<Record<string, Record<string, CheckResult>>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(getStorageKey("group-leader"))
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  const [inspectorResults, setInspectorResults] = useState<Record<string, Record<string, CheckResult>>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(getStorageKey("inspector"))
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  // === STATE SIGNATURES TERPISAH ===
  const [glSignaturesGroupLeader, setGlSignaturesGroupLeader] = useState<Record<string, Record<string, "-" | "OK" | "NG">>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`finalAssy_gl_signatures_group_leader`)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  const [glSignaturesInspector, setGlSignaturesInspector] = useState<Record<string, Record<string, "-" | "OK" | "NG">>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`finalAssy_gl_signatures_inspector`)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  useEffect(() => {
    const loadResults = () => {
      if (typeof window !== "undefined") {
        const savedGL = localStorage.getItem(getStorageKey("group-leader"))
        setGroupLeaderResults(savedGL ? JSON.parse(savedGL) : {})
        
        const savedInsp = localStorage.getItem(getStorageKey("inspector"))
        setInspectorResults(savedInsp ? JSON.parse(savedInsp) : {})
        
        // Load signatures terpisah
        const savedSignaturesGL = localStorage.getItem(`finalAssy_gl_signatures_group_leader`)
        setGlSignaturesGroupLeader(savedSignaturesGL ? JSON.parse(savedSignaturesGL) : {})
        
        const savedSignaturesInsp = localStorage.getItem(`finalAssy_gl_signatures_inspector`)
        setGlSignaturesInspector(savedSignaturesInsp ? JSON.parse(savedSignaturesInsp) : {})
      }
    }

    loadResults()

    const handleStorage = () => loadResults()
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  // === GANTI januaryDates DENGAN dynamicDates ===
  const dynamicDates = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [activeMonth, activeYear])

  // === PERUBAHAN PADA TANGGAL HARI INI ===
  const today = new Date().getDate()
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const isCurrentMonth = activeMonth === currentMonth && activeYear === currentYear

  // === MODIFIKASI FUNGSI getResult ===
  const getResult = (date: number, checkpointId: number, shift: "A" | "B", type: "group-leader" | "inspector") => {
    const dateKey = getDateKey(date)
    const checkpointKey = `${checkpointId}-${shift}`
    const results = type === "group-leader" ? groupLeaderResults : inspectorResults
    return results[dateKey]?.[checkpointKey] || null
  }

  // === MODIFIKASI: TAMBAHKAN PARAMETER type ===
  const getGLSignature = (date: number, shift: "A" | "B", type: "group-leader" | "inspector"): "-" | "OK" | "NG" => {
    const dateKey = getDateKey(date)
    const signatures = type === "group-leader" ? glSignaturesGroupLeader : glSignaturesInspector
    return signatures[dateKey]?.[shift] || "-"
  }

  // === MODIFIKASI: TAMBAHKAN PARAMETER type ===
  const handleGLSignatureChange = (
    date: number,
    shift: "A" | "B",
    value: "-" | "OK" | "NG",
    type: "group-leader" | "inspector"
  ) => {
    const dateKey = getDateKey(date)
    const currentSignatures = type === "group-leader" ? glSignaturesGroupLeader : glSignaturesInspector
    const setSignatures = type === "group-leader" ? setGlSignaturesGroupLeader : setGlSignaturesInspector
    const storageKey = type === "group-leader"
      ? `finalAssy_gl_signatures_group_leader`
      : `finalAssy_gl_signatures_inspector`

    const newSignatures = {
      ...currentSignatures,
      [dateKey]: {
        ...currentSignatures[dateKey],
        [shift]: value
      }
    }

    setSignatures(newSignatures)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newSignatures))
    }
  }

  const [ngModal, setNgModal] = useState<{
    date: number
    itemId: number
    shift: "A" | "B"
    type: "group-leader" | "inspector"
    notes: string
    department: string
  } | null>(null)

  const [modalData, setModalData] = useState<{
    date: number
    checkpoint: {
      checkPoint?: string
      shift: string
      waktuCheck?: string
      standard?: string
    }
    result: CheckResult
  } | null>(null)

  const departments = ["QA", "Produksi", "Maintenance", "Logistik", "Engineering"]

  const getCheckpointName = (item: CheckPoint | InspectorCheckItem | undefined): string => {
    if (!item) return "Unknown";
    if ('checkPoint' in item) {
      return (item as CheckPoint).checkPoint;
    }
    if ('itemCheck' in item) {
      return (item as InspectorCheckItem).itemCheck;
    }
    return "Unknown";
  };

  // === PERBAIKAN UTAMA: HANDLE STATUS CHANGE DENGAN DEEP CLONE ===
  const handleStatusChange = (
    date: number,
    itemId: number,
    shift: "A" | "B",
    newStatus: "OK" | "NG" | "-",
    type: "group-leader" | "inspector"
  ) => {
    const dateKey = getDateKey(date)
    const itemKey = `${itemId}-${shift}`
    const currentResults = type === "group-leader" ? groupLeaderResults : inspectorResults
    const setResults = type === "group-leader" ? setGroupLeaderResults : setInspectorResults
    const storageKey = getStorageKey(type)

    // DEEP CLONE untuk menghindari reference issues pada nested objects
    const newResults = JSON.parse(JSON.stringify(currentResults))

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
        notes: existing?.notes || "     ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "     ",
        ngDepartment: existing?.ngDepartment || departments[0]
      }
      
      // Buka modal NG untuk edit notes
      setNgModal({
        date,
        itemId,
        shift,
        type,
        notes: existing?.ngDescription || "     ",
        department: existing?.ngDepartment || departments[0]
      })
    } else {
      // Update atau tambah entry OK
      const existing = newResults[dateKey]?.[itemKey]
      
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemKey] = {
        status: "OK",
        ngCount: 0,
        items: existing?.items || [],
        notes: existing?.notes || "     ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "     ",
        ngDepartment: existing?.ngDepartment || departments[0]
      }
    }

    // Update state dan localStorage
    setResults(newResults)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newResults))
    }
  }

  // === PERBAIKAN UTAMA: SAVE NG REPORT DENGAN DEEP CLONE ===
  const saveNgReport = () => {
    if (!ngModal) return

    const { date, itemId, shift, type, notes, department } = ngModal
    const dateKey = getDateKey(date)
    const itemKey = `${itemId}-${shift}`
    const currentResults = type === "group-leader" ? groupLeaderResults : inspectorResults
    const setResults = type === "group-leader" ? setGroupLeaderResults : setInspectorResults
    const storageKey = getStorageKey(type)

    // DEEP CLONE
    const newResults = JSON.parse(JSON.stringify(currentResults))

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

  // =====================================================================
  // === FUNGSI RENDER STATUS CELL - DIPERBAIKI DENGAN LOGIKA EDITABLE ===
  // =====================================================================
  const renderStatusCell = useCallback((date: number, checkpoint: CheckPoint, shift: "A" | "B") => {
    const shouldCheck = isCheckDate(checkpoint, shift, date)
    if (!shouldCheck) {
      return "-"
    }

    const result = getResult(date, checkpoint.id, shift, "group-leader")
    
    // Ambil status dari result atau localStorage
    const dateKey = getDateKey(date)
    const itemKey = `${checkpoint.id}-${shift}`
    const storedStatus = result?.status || groupLeaderResults[dateKey]?.[itemKey]?.status || "-"
    
    // Gunakan storedStatus sebagai currentStatus
    const currentStatus = storedStatus
    
    // Tentukan apakah cell editable menggunakan fungsi helper
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-")
    
    // Tentukan warna background
    const getBgColor = (status: string) => {
      if (status === "OK") return "#4caf50"
      if (status === "NG") return "#f44336"
      return "#9e9e9e"
    }
    
    // Jika tidak ada data dan bukan hari ini, tampilkan "-"
    if (currentStatus === "-" && !isEditable) {
      return <span style={{ color: "#9e9e9e" }}>-</span>
    }
    
    // Render dropdown jika editable, atau badge statis jika tidak
    if (isEditable) {
      return (
        <select
          className="status-dropdown"
          style={{
            backgroundColor: getBgColor(currentStatus),
            color: "white",
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '500',
            textAlign: 'center'
          }}
          value={currentStatus}
          onChange={(e) => handleStatusChange(date, checkpoint.id, shift, e.target.value as "OK" | "NG" | "-", "group-leader")}
        >
          <option value="-">-</option>
          <option value="OK">✓ OK</option>
          <option value="NG">✗ NG</option>
        </select>
      )
    } else {
      // Tampilkan badge statis (read-only)
      return (
        <span
          className={`status-badge ${
            currentStatus === "OK" ? "status-badge-ok" : "status-badge-ng"
          }`}
          style={{
            display: 'inline-block',
            width: '100%',
            backgroundColor: getBgColor(currentStatus),
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontWeight: '500',
            fontSize: '12px',
            textAlign: 'center'
          }}
        >
          {currentStatus}
        </span>
      )
    }
  }, [getResult, groupLeaderResults, isCellEditable, handleStatusChange])

  // =====================================================================
  // === FUNGSI RENDER INSPECTOR STATUS CELL - DIPERBAIKI ===
  // =====================================================================
  const renderInspectorStatusCell = useCallback((date: number, itemId: number, shift: "A" | "B") => {
    const item = inspectorCheckItems.find(i => i.id === itemId)
    if (!item) return null

    const shouldCheck = isCheckDate(item, shift, date)
    if (!shouldCheck) {
      return "-"
    }

    const result = getResult(date, itemId, shift, "inspector")
    
    // Ambil status dari result atau localStorage
    const dateKey = getDateKey(date)
    const itemKey = `${itemId}-${shift}`
    const storedStatus = result?.status || inspectorResults[dateKey]?.[itemKey]?.status || "-"
    
    // Gunakan storedStatus sebagai currentStatus
    const currentStatus = storedStatus
    
    // Tentukan apakah cell editable menggunakan fungsi helper
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-")
    
    // Tentukan warna background
    const getBgColor = (status: string) => {
      if (status === "OK") return "#4caf50"
      if (status === "NG") return "#f44336"
      return "#9e9e9e"
    }
    
    // Jika tidak ada data dan bukan hari ini, tampilkan "-"
    if (currentStatus === "-" && !isEditable) {
      return <span style={{ color: "#9e9e9e" }}>-</span>
    }
    
    // Render dropdown jika editable, atau badge statis jika tidak
    if (isEditable) {
      return (
        <select
          className="status-dropdown"
          style={{
            backgroundColor: getBgColor(currentStatus),
            color: "white",
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '500',
            textAlign: 'center'
          }}
          value={currentStatus}
          onChange={(e) => handleStatusChange(date, itemId, shift, e.target.value as "OK" | "NG" | "-", "inspector")}
        >
          <option value="-">-</option>
          <option value="OK">✓ OK</option>
          <option value="NG">✗ NG</option>
        </select>
      )
    } else {
      // Tampilkan badge statis (read-only)
      return (
        <span
          className={`status-badge ${
            currentStatus === "OK" ? "status-badge-ok" : "status-badge-ng"
          }`}
          style={{
            display: 'inline-block',
            width: '100%',
            backgroundColor: getBgColor(currentStatus),
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontWeight: '500',
            fontSize: '12px',
            textAlign: 'center'
          }}
        >
          {currentStatus}
        </span>
      )
    }
  }, [getResult, inspectorResults, isCellEditable, handleStatusChange])

  const renderWeeklyAssignment = (date: number) => {
    if (date >= 1 && date <= 7) return "week-1 : Checker"
    if (date >= 8 && date <= 14) return "week-2 : Visual 1"
    if (date >= 15 && date <= 21) return "week-3 : Visual 2"
    if (date >= 22 && date <= 31) return "week-4 : R.I / Double Check"
    return " "
  }

  const renderESOCell = (date: number, shift: "A" | "B") => {
    const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
    const isTuesdayOrThursday = dayOfWeek === 2 || dayOfWeek === 4
    if (!isTuesdayOrThursday) {
      return "-"
    }
    
    // Cek apakah sudah ada data untuk ESO
    const esoCheckpoint = checkpoints.find(cp => cp.type === "special")
    if (!esoCheckpoint) return "CHECK"

    const result = getResult(date, esoCheckpoint.id, shift, "group-leader")
    
    // Ambil status dari result atau localStorage
    const dateKey = getDateKey(date)
    const itemKey = `${esoCheckpoint.id}-${shift}`
    const storedStatus = result?.status || groupLeaderResults[dateKey]?.[itemKey]?.status || "-"
    
    // Gunakan storedStatus sebagai currentStatus
    const currentStatus = storedStatus
    
    // Tentukan apakah cell editable menggunakan fungsi helper
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-")
    
    // Tentukan warna background
    const getBgColor = (status: string) => {
      if (status === "OK") return "#4caf50"
      if (status === "NG") return "#f44336"
      return "#9e9e9e"
    }
    
    // Jika tidak ada data dan bukan hari ini, tampilkan "-"
    if (currentStatus === "-" && !isEditable) {
      return <span style={{ color: "#9e9e9e" }}>-</span>
    }
    
    // Render dropdown jika editable, atau badge statis jika tidak
    if (isEditable) {
      return (
        <select
          className="status-dropdown"
          style={{
            backgroundColor: getBgColor(currentStatus),
            color: "white",
            fontSize: '0.65rem',
            padding: '2px 4px'
          }}
          value={currentStatus}
          onChange={(e) => handleStatusChange(date, esoCheckpoint.id, shift, e.target.value as "OK" | "NG" | "-", "group-leader")}
        >
          <option value="-">-</option>
          <option value="OK">✓ OK</option>
          <option value="NG">✗ NG</option>
        </select>
      )
    } else {
      // Tampilkan badge statis (read-only)
      return (
        <span
          className={`status-badge ${
            currentStatus === "OK" ? "status-badge-ok" : "status-badge-ng"
          }`}
          style={{
            display: 'inline-block',
            width: '100%',
            backgroundColor: getBgColor(currentStatus),
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontWeight: '500',
            fontSize: '12px',
            textAlign: 'center'
          }}
        >
          {currentStatus}
        </span>
      )
    }
  }

  const shouldShowIcon = (item: InspectorCheckItem, areaType: string) => {
    switch (item.itemCheck) {
      case "PIPO":
        return true
      case "ROLL METER / MISTAR BAJA":
        return areaType === "visual-1" || areaType === "visual-2"
      case "GO NO GO":
        return true
      case "PUSH GAUGE RB":
        return areaType === "visual-2" || areaType === "double-check"
      case "DUMMY SAMPLE OK & N-OK":
        return true
      case "IMPORTANT / INSPECTION POINT":
        return true
      case "FUSE PLATE":
        return areaType === "checker" || areaType === "visual-2"
      case "LAMPU NAVIGASI":
        return areaType === "visual-1" || areaType === "visual-2"
      case "TAPE NAVIGASI":
        return areaType === "checker" || areaType === "visual-1" || areaType === "visual-2"
      case "INSPECTION BOARD":
        return areaType === "checker" || areaType === "visual-1" || areaType === "visual-2" || areaType === "double-check"
      case "DRY SURF":
        return areaType === "visual-2"
      case "PACKING":
        return areaType === "double-check"
      default:
        return false
    }
  }

  const title =
    showGroupLeaderTable
      ? "CHECK SHEET PATROLI HARIAN GROUP LEADER INSPEKSI F/A"
      : "Daily Check Inspector Final Assy"

  if (!user) return null

  return (
    <>
      <Sidebar userName={user.fullName} />
      <div
        style={{
          maxWidth: "1800px",
          paddingLeft: "95px",
          paddingRight: "25px",
          paddingTop: "25px",
          paddingBottom: "25px",
        }}
        className="page-content"
      >
        <div className="header">
          <h1>{title}</h1>
          <div className="role-info">
            {isGroupLeader && (
              <select
                value={viewAs}
                onChange={(e) => setViewAs(e.target.value as "group-leader" | "inspector")}
                className="view-dropdown"
              >
                <option value="group-leader">Daily Check GL</option>
                <option value="inspector">Daily Check Inspector</option>
              </select>
            )}
            <span>Role:</span>
            <span className="role-badge">
              {isGroupLeader ? "Group Leader" : "Inspector"}
            </span>
          </div>
        </div>

        {/* === NAVIGASI BULAN BARU === */}
        {showInspectorTable && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <button
              onClick={() => changeMonth(-1)}
              className="nav-button"
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ← Bulan Lalu
            </button>
            <span className="month-title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {getMonthName(activeMonth)} {activeYear}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="nav-button"
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Bulan Depan →
            </button>
          </div>
        )}

        <div className="table-wrapper">
          {showGroupLeaderTable ? (
            <table className="status-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-no">NO</th>
                  <th rowSpan={2} className="col-checkpoint">CHECK POINT</th>
                  <th rowSpan={2} className="col-shift">SHIFT</th>
                  <th rowSpan={2} className="col-waktu">WAKTU CHECK</th>
                  <th rowSpan={2} className="col-standard">STANDARD / METODE</th>
                  <th colSpan={dynamicDates.length} className="month-header">{getMonthName(activeMonth)} {activeYear}</th>
                </tr>
                <tr>
                  {dynamicDates.map((date) => (
                    <th key={date} className={`col-date ${isCurrentMonth && date === today ? "col-date-today" : ""}`}>
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checkpoints.map((cp) => {
                  const currentNo = cp.no
                  const sameNoItems = checkpoints.filter(c => c.no === currentNo)
                  const isFirstOfGroup = sameNoItems[0].id === cp.id
                  const groupRowSpan = sameNoItems.reduce((sum, item) => {
                    return sum + item.shifts.filter(s => s.waktuCheck !== " ").length
                  }, 0)

                  if (cp.type === "special") {
                    return (
                      <tr key={`cp-${cp.id}`}>
                        <td className="col-no"></td>
                        <td className="col-checkpoint" colSpan={3}>{cp.checkPoint}</td>
                        <td className="col-standard">{cp.standard}</td>
                        {dynamicDates.map((date) => {
                          const esoText = renderESOCell(date, "A")
                          return (
                            <td
                              key={date}
                              className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${esoText !== "CHECK" && esoText !== "-" ? "bg-yellow-100" : ""}`}
                            >
                              {esoText}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }

                  if (cp.type === "weekly" && cp.id === 14) {
                    return (
                      <React.Fragment key={`cp-${cp.id}`}>
                        <tr key={`${cp.id}-header`}>
                          {isFirstOfGroup && <td className="col-no" rowSpan={3}>{cp.no}</td>}
                          <td className="col-checkpoint" rowSpan={3}>{cp.checkPoint}</td>
                          <td className="col-shift"></td>
                          <td className="col-waktu"></td>
                          {isFirstOfGroup && <td className="col-standard" rowSpan={3}>{cp.standard}</td>}
                          {dynamicDates.map((date) => {
                            const weeklyText = renderWeeklyAssignment(date)
                            return (
                              <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}>
                                {weeklyText}
                              </td>
                            )
                          })}
                        </tr>
                        <tr key={`${cp.id}-A`}>
                          <td className="col-shift">A</td>
                          <td className="col-waktu">{cp.shifts[0].waktuCheck}</td>
                          {dynamicDates.map((date) => (
                            <td
                              key={date}
                              className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${!isCheckDate(cp, "A", date) ? "bg-gray-200" : ""}`}
                            >
                              {renderStatusCell(date, cp, "A")}
                            </td>
                          ))}
                        </tr>
                        <tr key={`${cp.id}-B`}>
                          <td className="col-shift">B</td>
                          <td className="col-waktu">{cp.shifts[1].waktuCheck}</td>
                          {dynamicDates.map((date) => (
                            <td
                              key={date}
                              className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${!isCheckDate(cp, "B", date) ? "bg-gray-200" : ""}`}
                            >
                              {renderStatusCell(date, cp, "B")}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    )
                  }

                  return (
                    <React.Fragment key={`cp-${cp.id}`}>
                      {cp.shifts.map((shiftData, shiftIdx) => {
                        if (shiftData.waktuCheck === " ") return null
                        return (
                          <tr key={`${cp.id}-${shiftIdx}`}>
                            {shiftIdx === 0 && isFirstOfGroup && (
                              <td className="col-no" rowSpan={groupRowSpan}>{cp.no}</td>
                            )}
                            {shiftIdx === 0 && (
                              <td
                                className="col-checkpoint"
                                rowSpan={cp.shifts.filter(s => s.waktuCheck !== " ").length}
                              >
                                {cp.checkPoint}
                              </td>
                            )}
                            <td className="col-shift">{shiftData.shift}</td>
                            <td className="col-waktu">{shiftData.waktuCheck}</td>
                            {shiftIdx === 0 && isFirstOfGroup && (
                              <td className="col-standard" rowSpan={groupRowSpan}>{cp.standard}</td>
                            )}
                            {dynamicDates.map((date) => (
                              <td
                                key={date}
                                className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${!isCheckDate(cp, shiftData.shift, date) ? "bg-gray-200" : ""}`}
                              >
                                {renderStatusCell(date, cp, shiftData.shift)}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })}

                <tr>
                  <td className="col-no"></td>
                  <td className="col-checkpoint" colSpan={4}>Tanda tangan GL Inspector</td>
                  {dynamicDates.map((date) => {
                    const signatureStatus = getGLSignature(date, "A", "group-leader")
                    const getBgColor = (status: string) => {
                      if (status === "OK") return "#4caf50"
                      if (status === "NG") return "#f44336"
                      return "#9e9e9e"
                    }
                    return (
                      <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}>
                        <select
                          className="status-dropdown"
                          style={{ backgroundColor: getBgColor(signatureStatus), color: "white" }}
                          value={signatureStatus}
                          onChange={(e) => handleGLSignatureChange(date, "A", e.target.value as "-" | "OK" | "NG", "group-leader")}
                        >
                          <option value="-">-</option>
                          <option value="OK">✓ OK</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          ) : showInspectorTable ? (
            <table className="status-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-no">NO</th>
                  <th rowSpan={2} className="col-item-check">ITEM CHECK</th>
                  <th rowSpan={2} className="col-checkpoint">CHECK POINT</th>
                  <th rowSpan={2} className="col-metode">METODE CHECK</th>
                  <th colSpan={5} className="col-area">AREA</th>
                  <th rowSpan={2} className="col-shift">SHIFT</th>
                  <th colSpan={dynamicDates.length} className="month-header">{getMonthName(activeMonth)} {activeYear}</th>
                </tr>
                <tr>
                  <th className="col-wp-check">WP CHECK</th>
                  <th className="col-checker">CHECKER</th>
                  <th className="col-visual-1">VISUAL 1</th>
                  <th className="col-visual-2">VISUAL 2</th>
                  <th className="col-double-check">DOUBLE CHECK (RI)</th>
                  {dynamicDates.map((date) => (
                    <th key={date} className={`col-date ${isCurrentMonth && date === today ? "col-date-today" : ""}`}>
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  inspectorCheckItems.reduce((groups, item) => {
                    const group = groups[item.no] || []
                    group.push(item)
                    groups[item.no] = group
                    return groups
                  }, {} as Record<string, InspectorCheckItem[]>)
                ).map(([no, items]) => {
                  const totalRows = items.length * 2
                  return (
                    <React.Fragment key={no}>
                      {items.map((item, itemIdx) => {
                        let itemCheckCount = 1
                        let nextIdx = itemIdx + 1
                        while (nextIdx < items.length && items[nextIdx].itemCheck === item.itemCheck) {
                          itemCheckCount++
                          nextIdx++
                        }

                        let checkPointCount = 1
                        let nextCheckIdx = itemIdx + 1
                        while (nextCheckIdx < items.length && items[nextCheckIdx].checkPoint === item.checkPoint) {
                          checkPointCount++
                          nextCheckIdx++
                        }

                        const itemCheckRows = itemCheckCount * 2
                        const checkPointRows = checkPointCount * 2

                        return (
                          <React.Fragment key={`item-${item.id}`}>
                            {item.shifts.map((shiftData, shiftIdx) => (
                              <tr key={`${item.id}-${shiftIdx}`}>
                                {itemIdx === 0 && shiftIdx === 0 && (
                                  <td className="col-no" rowSpan={totalRows}>{no}</td>
                                )}
                                {shiftIdx === 0 && itemIdx === 0 && (
                                  <td className="col-item-check" rowSpan={itemCheckRows}>{item.itemCheck}</td>
                                )}
                                {shiftIdx === 0 && itemIdx > 0 && items[itemIdx - 1].itemCheck !== item.itemCheck && (
                                  <td className="col-item-check" rowSpan={itemCheckRows}>{item.itemCheck}</td>
                                )}
                                {shiftIdx === 0 && itemIdx === 0 && (
                                  <td className="col-checkpoint" rowSpan={checkPointRows}>{item.checkPoint}</td>
                                )}
                                {shiftIdx === 0 && itemIdx > 0 && items[itemIdx - 1].checkPoint !== item.checkPoint && (
                                  <td className="col-checkpoint" rowSpan={checkPointRows}>{item.checkPoint}</td>
                                )}
                                {shiftIdx === 0 && <td className="col-metode" rowSpan={2}>{item.metodeCheck}</td>}
                                {itemIdx === 0 && shiftIdx === 0 && (
                                  <>
                                    <td className="col-wp-check" rowSpan={itemCheckRows}>
                                      {shouldShowIcon(item, "wp-check") ? "O" : " "}
                                    </td>
                                    <td className="col-checker" rowSpan={itemCheckRows}>
                                      {shouldShowIcon(item, "checker") ? "O" : " "}
                                    </td>
                                    <td className="col-visual-1" rowSpan={itemCheckRows}>
                                      {shouldShowIcon(item, "visual-1") ? "O" : " "}
                                    </td>
                                    <td className="col-visual-2" rowSpan={itemCheckRows}>
                                      {shouldShowIcon(item, "visual-2") ? "O" : " "}
                                    </td>
                                    <td className="col-double-check" rowSpan={itemCheckRows}>
                                      {shouldShowIcon(item, "double-check") ? "O" : " "}
                                    </td>
                                  </>
                                )}
                                <td className="col-shift">{shiftData.shift}</td>
                                {dynamicDates.map((date) => (
                                  <td
                                    key={date}
                                    className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""} ${!isCheckDate(item, shiftData.shift, date) ? "bg-gray-200" : ""}`}
                                  >
                                    {renderInspectorStatusCell(date, item.id, shiftData.shift)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </React.Fragment>
                  )
                })}

                <tr>
                  <td style={{ border: "none" }} rowSpan={2} colSpan={5} className="special-row"></td>
                  <td rowSpan={2} className="col-wp-check" colSpan={4}>SIGN / CHECK OLEH GL INSPECTOR</td>
                  <td className="col-shift">A</td>
                  {dynamicDates.map((date) => {
                    const signatureStatus = getGLSignature(date, "A", "inspector")
                    const getBgColor = (status: string) => {
                      if (status === "OK") return "#4caf50"
                      return "#9e9e9e"
                    }
                    return (
                      <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}>
                        <select
                          className="status-dropdown"
                          style={{ backgroundColor: getBgColor(signatureStatus), color: "white" }}
                          value={signatureStatus}
                          disabled={isInspector}
                          onChange={(e) => handleGLSignatureChange(date, "A", e.target.value as "-" | "OK" | "NG", "inspector")}
                        >
                          <option value="-">-</option>
                          <option value="OK">✓ OK</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="col-shift">B</td>
                  {dynamicDates.map((date) => {
                    const signatureStatus = getGLSignature(date, "B", "inspector")
                    const getBgColor = (status: string) => {
                      if (status === "OK") return "#4caf50"
                      if (status === "NG") return "#f44336"
                      return "#9e9e9e"
                    }
                    return (
                      <td key={date} className={`col-date ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}>
                        <select
                          className="status-dropdown"
                          style={{ backgroundColor: getBgColor(signatureStatus), color: "white" }}
                          value={signatureStatus}
                          disabled={isInspector}
                          onChange={(e) => handleGLSignatureChange(date, "B", e.target.value as "-" | "OK" | "NG", "inspector")}
                        >
                          <option value="-">-</option>
                          <option value="OK">✓ OK</option>
                          <option value="NG">✗ NG</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

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
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .role-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .role-badge {
          background: #e3f2fd;
          color: #1976d2;
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .view-dropdown {
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          background-size: 16px;
          padding-right: 28px;
        }
        .view-dropdown:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.5);
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
          font-size: 0.75rem;
        }
        .status-table th, .status-table td {
          padding: 6px 4px;
          text-align: center;
          border: 1px solid #000;
          vertical-align: middle;
        }
        .status-table th {
          background: #e3f2fd;
          font-weight: 600;
        }
        .month-header {
          text-align: center;
          font-size: 1rem;
          font-weight: bold;
          color: #0d47a1;
          background: #e3f2fd;
          padding: 10px 0;
        }
        .col-no { min-width: 40px; max-width: 50px; text-align: center; font-weight: 600; }
        .col-item-check { min-width: 120px; max-width: 150px; text-align: left; padding-left: 8px; }
        .col-checkpoint { min-width: 280px; max-width: 350px; text-align: left; padding-left: 8px; word-break: break-word; }
        .col-metode, .col-waktu, .col-standard { min-width: 90px; max-width: 110px; font-size: 0.7rem; }
        .col-area { min-width: 120px; max-width: 150px; font-size: 0.7rem; }
        .col-shift { min-width: 45px; max-width: 50px; font-weight: 600; }
        .col-date { min-width: 32px; max-width: 40px; text-align: center; font-size: 0.7rem; }
        .col-date-today { background: #fff8e1 !important; color: #e65100; font-weight: 700; }
        .bg-yellow-100 { background: #fff9c4; }
        .bg-blue-50 { background: #e3f2fd; }
        .bg-gray-200 { background-color: #e0e0e0 !important; color: #757575; }
        .status-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .status-badge-ok { background: #4caf50; color: white; }
        .status-badge-ng { background: #f44336; color: white; cursor: pointer; }
        .status-badge-check { background: #1e88e5; color: white; }

        .col-wp-check,
        .col-checker,
        .col-visual-1,
        .col-visual-2,
        .col-double-check {
          white-space: normal;
          min-width: 80px;
          max-width: 100px;
          font-size: 0.7rem;
          background-color: #e3f2fd;
          font-weight: 600;
        }

        .status-dropdown {
          width: 100%;
          padding: 2px 4px;
          font-size: 0.65rem;
          font-weight: 600;
          border: 1px solid #ccc;
          border-radius: 3px;
          cursor: pointer;
          text-align: center;
        }
        .status-dropdown:disabled {
          cursor: not-allowed;
          opacity: 0.6;
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
    </>
  )
}