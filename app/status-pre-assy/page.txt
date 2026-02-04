// app/status-pre-assy/page.tsx
"use client"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/Sidebar"
import React from "react"
import { Weight } from "lucide-react"

// 🔹 Tipe ViewMode yang lebih strict
type ViewMode =
  | "daily"
  | "cc-stripping"
  | "daily-check-ins"
  | "cs-remove-tool"
  | "pressure-jig";

// 🔹 Mapping role ke view modes yang diizinkan
const ROLE_ACCESS_MAP: Record<string, ViewMode[]> = {
  "group-leader-qa": ["daily", "cc-stripping"],
  "inspector-qa": ["daily-check-ins", "cs-remove-tool", "pressure-jig"]
};

// 🔹 Mapping view mode ke label yang ditampilkan
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  "daily": "Daily Check Group Leader Pre Assy",
  "cc-stripping": "CallCheck CC & Stripping GL Pre Assy",
  "daily-check-ins": "Daily Check Ins. Inspector Pre Assy",
  "cs-remove-tool": "Check Sheet Control Remove Tool",
  "pressure-jig": "Daily Check Pressure Jig Inspector Pre Assy"
};

// 🔹 Mapping view mode ke button label
const VIEW_MODE_BUTTONS: Record<ViewMode, { label: string; }> = {
  "daily": { label: "Daily Check" },
  "cc-stripping": { label: "CC & Stripping" },
  "daily-check-ins": { label: "Daily Check Ins." },
  "cs-remove-tool": { label: "CS Remove Tool" },
  "pressure-jig": { label: "Pressure Jig" }
};

// 🔹 Tipe Umum
interface CheckResult {
  status: "OK" | "NG" | "-"
  ngCount: number
  items: Array<{ name: string; status: "OK" | "NG" | "N/A"; notes: string }>
  notes: string
  submittedAt: string
  submittedBy: string
  ngDescription?: string
  ngDepartment?: string
}

// 🔹 Tipe Daily Check
interface DailyCheckPoint {
  id: number
  checkPoint: string
  shift: "A" | "B"
  waktuCheck: string
  standard: string
}

// 🔹 Tipe CC & Stripping
interface CcStrippingCheckPoint {
  id: number
  machine: string
  kind: string
  size: string
  shift: "A" | "B"
}

// 🔹 Tipe Daily Check Ins.
interface DailyCheckInsPoint {
  id: number
  no: number
  itemCheck: string
  checkPoint: string
  method: string
  area: {
    tensile: boolean
    crossSection: boolean
    cutting: boolean
    pa: boolean
  }
  shift: "A" | "B"
  schedule: string
}

// 🔹 Tipe CS Remove Tool
interface CSRemoveToolItem {
  id: string
  no: number
  toolType: string
  controlNo: string
  itemCheck: string
  shift: "A" | "B"
}

// 🔹 Tipe Pressure Jig (BARU)
interface PressureJigCheckPoint {
  id: number
  checkPoint: string
  shift: "A" | "B"
  frequency: string
  judge: string
}

export default function PreAssyGLStatusPage() {
  const router = useRouter()
  const { user } = useAuth()

  // 🔹 Validasi role
  useEffect(() => {
    if (!user || (user.role !== "group-leader-qa" && user.role !== "inspector-qa")) {
      router.push("/login-page")
    }
  }, [user, router])

  // 🔹 Dapatkan view modes yang diizinkan berdasarkan role
  const allowedViewModes = useMemo(() => {
    return ROLE_ACCESS_MAP[user?.role || ""] || []
  }, [user?.role])

  // 🔹 Set default view mode berdasarkan role
  const getDefaultViewMode = useCallback((): ViewMode => {
    if (allowedViewModes.length === 0) return "daily"
    return allowedViewModes[0]
  }, [allowedViewModes])

  // 🔹 State dengan validasi
  const [viewMode, setViewMode] = useState(getDefaultViewMode())

  // 🔹 Validasi viewMode saat role berubah
  useEffect(() => {
    if (!allowedViewModes.includes(viewMode)) {
      setViewMode(getDefaultViewMode())
    }
  }, [allowedViewModes, viewMode, getDefaultViewMode])

  // === STATE BARU UNTUK SISTEM BULAN DINAMIS ===
  const [activeMonth, setActiveMonth] = useState(() => new Date().getMonth())
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear())

  // === STATE BARU UNTUK MINGGU (HANYA UNTUK CC & Stripping) ===
  const [selectedWeek, setSelectedWeek] = useState(1)

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
    status: "OK" | "NG" | "-",
    timeSlot?: string
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
    
    // Untuk hari ini: cek interval waktu jika ada timeSlot
    if (timeSlot) {
      const [slotHourStr, slotMinuteStr] = timeSlot.split('.')
      const slotHour = parseInt(slotHourStr)
      const slotMinute = parseInt(slotMinuteStr) || 0
      
      // Interval waktu untuk CC & Stripping
      const timeSlots = ["01.00", "04.00", "08.00", "13.00", "16.00", "20.00"]
      const currentIndex = timeSlots.findIndex(ts => ts === timeSlot)
      
      if (currentIndex === -1) return false
      
      const nextSlot = timeSlots[(currentIndex + 1) % timeSlots.length]
      const [nextHourStr, nextMinuteStr] = nextSlot.split('.')
      const nextHour = parseInt(nextHourStr)
      const nextMinute = parseInt(nextMinuteStr) || 0
      
      const currentTimeInMinutes = currentHour * 60 + currentMinute
      const slotTimeInMinutes = slotHour * 60 + slotMinute
      const nextTimeInMinutes = nextHour * 60 + nextMinute
      
      // Untuk slot 20:00 → 01:00 (hari berikutnya)
      if (timeSlot === "20.00") {
        // Masih aktif jika waktu sekarang >= 20:00 atau < 01:00
        const isActive = currentTimeInMinutes >= slotTimeInMinutes || currentTimeInMinutes < nextTimeInMinutes
        
        if (isActive) {
          // Interval aktif: semua status bisa diubah
          return true
        } else {
          // Interval sudah lewat
          if (status === "OK") return false  // OK locked
          if (status === "NG") return true   // NG masih bisa diperbaiki
          return false  // "-" tidak bisa diisi
        }
      }
      
      // Untuk interval lainnya
      if (currentTimeInMinutes >= slotTimeInMinutes && currentTimeInMinutes < nextTimeInMinutes) {
        // Interval aktif: semua status bisa diubah
        return true
      } else {
        // Interval sudah lewat
        if (status === "OK") return false  // OK locked
        if (status === "NG") return true   // NG masih bisa diperbaiki
        return false  // "-" tidak bisa diisi
      }
    }
    
    // Untuk tabel tanpa timeSlot (daily, pressure-jig, dll)
    // Hari ini: semua status editable
    // Hari lalu: OK locked, NG editable
    if (status === "OK") return false
    if (status === "NG") return true
    return false
  }, [activeMonth, activeYear])

  // =====================================================================
  // === FUNGSI UNTUK CEK APAKAH TIME SLOT MASIH AKTIF (DIPERBAIKI) ===
  // =====================================================================
  const isTimeSlotActive = useCallback((date: number, timeSlot: string): boolean => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    // Parse time slot (format: "01.00")
    const [slotHourStr, slotMinuteStr] = timeSlot.split('.')
    const slotHour = parseInt(slotHourStr)
    const slotMinute = parseInt(slotMinuteStr) || 0
    
    // Buat Date object untuk tanggal yang dipilih
    const checkDate = new Date(activeYear, activeMonth, date)
    
    // Jika tanggal berbeda dengan hari ini
    if (checkDate.getDate() !== now.getDate() || 
        checkDate.getMonth() !== now.getMonth() || 
        checkDate.getFullYear() !== now.getFullYear()) {
      // Untuk tanggal masa lalu: tidak aktif
      if (checkDate < now) return false
      // Untuk tanggal masa depan: tidak aktif
      return false
    }
    
    // Untuk hari ini: cek interval waktu
    const currentTimeInMinutes = currentHour * 60 + currentMinute
    const slotTimeInMinutes = slotHour * 60 + slotMinute
    
    // Interval waktu:
    const timeSlots = ["01.00", "04.00", "08.00", "13.00", "16.00", "20.00"]
    const currentIndex = timeSlots.findIndex(ts => ts === timeSlot)
    
    if (currentIndex === -1) return false
    
    const nextSlot = timeSlots[(currentIndex + 1) % timeSlots.length]
    const [nextHourStr, nextMinuteStr] = nextSlot.split('.')
    const nextHour = parseInt(nextHourStr)
    const nextMinute = parseInt(nextMinuteStr) || 0
    
    const nextTimeInMinutes = nextHour * 60 + nextMinute
    
    // Untuk slot 20:00 → 01:00 (hari berikutnya)
    if (timeSlot === "20.00") {
      return currentTimeInMinutes >= slotTimeInMinutes || currentTimeInMinutes < nextTimeInMinutes
    }
    
    return currentTimeInMinutes >= slotTimeInMinutes && currentTimeInMinutes < nextTimeInMinutes
  }, [activeMonth, activeYear])

  // === FUNGSI UNTUK MENDAPATKAN MINGGU DALAM BULAN (MEMOIZED) ===
  const getWeeksInMonth = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    const firstDay = new Date(activeYear, activeMonth, 1).getDay() // 0=Sun, 6=Sat
    const totalDays = daysInMonth + firstDay
    const weeksCount = Math.ceil(totalDays / 7)
    const weeks = []
    for (let i = 0; i < weeksCount; i++) {
      const weekDays = []
      for (let j = 0; j < 7; j++) {
        const dayNum = i * 7 + j - firstDay + 1
        if (dayNum >= 1 && dayNum <= daysInMonth) {
          const date = new Date(activeYear, activeMonth, dayNum)
          const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' })
          weekDays.push({
            date: dayNum,
            dayName: dayName,
            isWeekend: date.getDay() === 0 || date.getDay() === 6
          })
        }
      }
      if (weekDays.length > 0) {
        weeks.push({
          weekNum: i + 1,
          days: weekDays
        })
      }
    }
    return weeks
  }, [activeMonth, activeYear])

  // === FUNGSI UNTUK MENDAPATKAN HARI KERJA PER MINGGU (MEMOIZED) ===
  const getWorkDaysByWeek = useMemo(() => {
    return getWeeksInMonth.map(week => {
      const workDays = week.days.filter(day => !day.isWeekend)
      return {
        weekNum: week.weekNum,
        days: workDays
      }
    }).filter(week => week.days.length > 0)
  }, [getWeeksInMonth])

  // === FUNGSI UNTUK MENDAPATKAN HARI KERJA MINGGU TERPILIH ===
  const getSelectedWeekDays = useMemo(() => {
    if (selectedWeek < 1 || selectedWeek > getWorkDaysByWeek.length) {
      return []
    }
    return getWorkDaysByWeek[selectedWeek - 1].days
  }, [selectedWeek, getWorkDaysByWeek])

  const getWorkDaysInMonth = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    const workDays = []
    for (let date = 1; date <= daysInMonth; date++) {
      const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workDays.push({
          date,
          dayName: new Date(activeYear, activeMonth, date).toLocaleDateString('id-ID', { weekday: 'short' })
        })
      }
    }
    return workDays
  }, [activeMonth, activeYear])

  const dynamicDates = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [activeMonth, activeYear])

  const today = new Date().getDate()
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const isCurrentMonth = activeMonth === currentMonth && activeYear === currentYear

  const DAILY_CHECKPOINTS: DailyCheckPoint[] = useMemo(() => [
    { id: 1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", standard: "Check pengisian C/S 4M", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 1.1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", standard: "Check pengisian C/S 4M", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 2, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 2.1, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 3, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", standard: "    ", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 3.1, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", standard: "    ", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 4, checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian...", standard: "Sesuai IS no. QA-ACL-PA-IS-031", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 4.1, checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian...", standard: "Sesuai IS no. QA-ACL-PA-IS-031", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 5, checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 5.1, checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 6, checkPoint: "Circuit di supply dan di letakan di store sesuai dengan address...", standard: "Sampling check circuit yang ada di store", shift: "A", waktuCheck: "Setiap Senin & Kamis" },
    { id: 6.1, checkPoint: "Circuit di supply dan di letakan di store sesuai dengan address...", standard: "Sampling check circuit yang ada di store", shift: "B", waktuCheck: "Setiap Senin & Kamis" },
    { id: 7, checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly...", standard: "Check kondisi actual (sampling check min. 3 inspector)", shift: "A", waktuCheck: "Setiap Senin & Kamis" },
    { id: 7.1, checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly...", standard: "Check kondisi actual (sampling check min. 3 inspector)", shift: "B", waktuCheck: "Setiap Senin & Kamis" },
    { id: 8, checkPoint: "Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan...", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "A", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 8.1, checkPoint: "Cup di trolly di tempatkan sesuai dengan tempat yang di sediakan...", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "B", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 9, checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "A", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 9.1, checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "B", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 10, checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "A", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 10.1, checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", standard: "Check kondisi actual sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012", shift: "B", waktuCheck: "Setiap Selasa & Jumat" },
    { id: 11, checkPoint: "Tidak ada bagian trolly inspector yang rusak", standard: "Check kondisi actual", shift: "A", waktuCheck: "1 Inspector / Minggu" },
    { id: 11.1, checkPoint: "Tidak ada bagian trolly inspector yang rusak", standard: "Check kondisi actual", shift: "B", waktuCheck: "1 Inspector / Minggu" },
    { id: 12, checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", standard: "Check actual dengan SWCT", shift: "A", waktuCheck: "1 Inspector / Minggu" },
    { id: 12.1, checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", standard: "Check actual dengan SWCT", shift: "B", waktuCheck: "1 Inspector / Minggu" },
    { id: 13, checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu...", standard: "Check kondisi actual", shift: "A", waktuCheck: "Setiap Selasa" },
    { id: 13.1, checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu...", standard: "Check kondisi actual", shift: "B", waktuCheck: "Setiap Selasa" },
    { id: 14, checkPoint: "Memastikan semua inspector menggunakan penutup kepala...", standard: "Check kondisi actual", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 14.1, checkPoint: "Memastikan semua inspector menggunakan penutup kepala...", standard: "Check kondisi actual", shift: "B", waktuCheck: "Setiap Hari" },
  ], [])

  const CC_STRIPPING_CHECKPOINTS: CcStrippingCheckPoint[] = useMemo(() => [
    { id: 1, machine: "AC90 TRX 01", kind: "IA-CIVUS", size: "0.13", shift: "A" },
    { id: 1.1, machine: "AC90 TRX 01", kind: "IA-CIVUS", size: "0.13", shift: "B" },
    { id: 2, machine: "AC90 TRX 02", kind: "IA-CIVUS", size: "0.13", shift: "A" },
    { id: 2.1, machine: "AC90 TRX 02", kind: "IA-CIVUS", size: "0.13", shift: "B" },
    { id: 3, machine: "AC90 TRX 03", kind: "IA-CIVUS", size: "0.13", shift: "A" },
    { id: 3.1, machine: "AC90 TRX 03", kind: "IA-CIVUS", size: "0.13", shift: "B" },
    { id: 4, machine: "AC90 TRX 04", kind: "CIVUS", size: "0.35", shift: "A" },
    { id: 4.1, machine: "AC90 TRX 04", kind: "CIVUS", size: "0.35", shift: "B" },
    { id: 5, machine: "AC90 TRX 05", kind: "AVSS", size: "2.0", shift: "A" },
    { id: 5.1, machine: "AC90 TRX 05", kind: "AVSS", size: "2.0", shift: "B" },
    { id: 6, machine: "AC90 TRX 06", kind: "ALVUS", size: "2.0", shift: "A" },
    { id: 6.1, machine: "AC90 TRX 06", kind: "ALVUS", size: "2.0", shift: "B" },
    { id: 7, machine: "AC90 TRX 06", kind: "ALVUS", size: "2.5", shift: "A" },
    { id: 7.1, machine: "AC90 TRX 06", kind: "ALVUS", size: "2.5", shift: "B" },
    { id: 8, machine: "AC90 TRX 07", kind: "ALVUS", size: "0.75", shift: "A" },
    { id: 8.1, machine: "AC90 TRX 07", kind: "ALVUS", size: "0.75", shift: "B" },
    { id: 9, machine: "AC90 TRX 07", kind: "ALVUS", size: "1.25", shift: "A" },
    { id: 9.1, machine: "AC90 TRX 07", kind: "ALVUS", size: "1.25", shift: "B" },
    { id: 10, machine: "AC90 TRX 08", kind: "ALVUS", size: "0.5", shift: "A" },
    { id: 10.1, machine: "AC90 TRX 08", kind: "ALVUS", size: "0.5", shift: "B" },
    { id: 11, machine: "AC90 TRX 08", kind: "ALVUS", size: "0.75", shift: "A" },
    { id: 11.1, machine: "AC90 TRX 08", kind: "ALVUS", size: "0.75", shift: "B" },
    { id: 12, machine: "AC90 TRX 09", kind: "ALVUS", size: "0.5", shift: "A" },
    { id: 12.1, machine: "AC90 TRX 09", kind: "ALVUS", size: "0.5", shift: "B" },
    { id: 13, machine: "AC90 TRX 10", kind: "CAVS", size: "0.3", shift: "A" },
    { id: 13.1, machine: "AC90 TRX 10", kind: "CAVS", size: "0.3", shift: "B" },
    { id: 14, machine: "AC90 TRX 10", kind: "CAVS", size: "0.5", shift: "A" },
    { id: 14.1, machine: "AC90 TRX 10", kind: "CAVS", size: "0.5", shift: "B" },
    { id: 15, machine: "AC90 TRX 10", kind: "CAVS", size: "0.85", shift: "A" },
    { id: 15.1, machine: "AC90 TRX 10", kind: "CAVS", size: "0.85", shift: "B" },
    { id: 16, machine: "AC90 TRX 10", kind: "AESSX", size: "0.3", shift: "A" },
    { id: 16.1, machine: "AC90 TRX 10", kind: "AESSX", size: "0.3", shift: "B" },
    { id: 17, machine: "AC90 TRX 10", kind: "CIVUS", size: "0.35", shift: "A" },
    { id: 17.1, machine: "AC90 TRX 10", kind: "CIVUS", size: "0.35", shift: "B" },
  ], [])

  const DAILY_CHECK_INS_CHECKPOINTS: DailyCheckInsPoint[] = useMemo(() => [
    // No 1 - BOLPOINT & MARKER
    { id: 1, no: 1, itemCheck: "BOLPOINT & MARKER", checkPoint: "1A. TERDAPAT STICKER \"E\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 1.1, no: 1, itemCheck: "BOLPOINT & MARKER", checkPoint: "1A. TERDAPAT STICKER \"E\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 2 - MICROMETER
    { id: 2, no: 2, itemCheck: "MICROMETER", checkPoint: "2A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 2.1, no: 2, itemCheck: "MICROMETER", checkPoint: "2A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 2.2, no: 2, itemCheck: "MICROMETER", checkPoint: "2B. ANGKA TERBACA DENGAN JELAS (LAYAR TIDAK MUNCUL HURUF \"B\", \"H\", \"INS\" atau \"P\").", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 2.3, no: 2, itemCheck: "MICROMETER", checkPoint: "2B. ANGKA TERBACA DENGAN JELAS (LAYAR TIDAK MUNCUL HURUF \"B\", \"H\", \"INS\" atau \"P\").", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 2.4, no: 2, itemCheck: "MICROMETER", checkPoint: "2C. ZERO SETTING OK (LAYAR MENUNJUKKAN \"0.000\").", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 2.5, no: 2, itemCheck: "MICROMETER", checkPoint: "2C. ZERO SETTING OK (LAYAR MENUNJUKKAN \"0.000\").", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 2.6, no: 2, itemCheck: "MICROMETER", checkPoint: "2D. KONDISI ANVIL DAN SPINDLE OK (TIDAK ADA KARAT DAN BERPUTAR LONGGAR PADA BAGIAN PENGUKURAN).", method: "VISUAL, SENTUH", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 2.7, no: 2, itemCheck: "MICROMETER", checkPoint: "2D. KONDISI ANVIL DAN SPINDLE OK (TIDAK ADA KARAT DAN BERPUTAR LONGGAR PADA BAGIAN PENGUKURAN).", method: "VISUAL, SENTUH", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 2.8, no: 2, itemCheck: "MICROMETER", checkPoint: "2E. BAUT PENGUNCI TIDAK LONGGAR / DOL (CEK TANDA PADA SCREW)", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 2.9, no: 2, itemCheck: "MICROMETER", checkPoint: "2E. BAUT PENGUNCI TIDAK LONGGAR / DOL (CEK TANDA PADA SCREW)", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 3 - CALIPER
    { id: 3, no: 3, itemCheck: "CALIPER", checkPoint: "3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 3.1, no: 3, itemCheck: "CALIPER", checkPoint: "3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 3.2, no: 3, itemCheck: "CALIPER", checkPoint: "3B. ZERO SETTING OK (LAYAR MENUNJUKKAN \"0.00\").", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 3.3, no: 3, itemCheck: "CALIPER", checkPoint: "3B. ZERO SETTING OK (LAYAR MENUNJUKKAN \"0.00\").", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 3.4, no: 3, itemCheck: "CALIPER", checkPoint: "3C. PENGGESER BERGERAK DENGAN LANCAR, TIDAK ADA BAGIAN YANG DEFORMASI, BERKARAT, RUSAK DAN TIDAK ADA BENDA YANG MENEMPEL PADA BAGIAN PENGUKURAN", method: "VISUAL, SENTUH", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 3.5, no: 3, itemCheck: "CALIPER", checkPoint: "3C. PENGGESER BERGERAK DENGAN LANCAR, TIDAK ADA BAGIAN YANG DEFORMASI, BERKARAT, RUSAK DAN TIDAK ADA BENDA YANG MENEMPEL PADA BAGIAN PENGUKURAN", method: "VISUAL, SENTUH", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 4 - MESIN TENSILE
    { id: 4, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.1, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.2, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4B. ANGKA HASIL PENGUKURAN PADA LAYAR TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.3, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4B. ANGKA HASIL PENGUKURAN PADA LAYAR TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.4, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4C. MESIN TENSILE DALAM KONDISI BAIK DAN BAGIANNYA TIDAK ADA YANG RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.5, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4C. MESIN TENSILE DALAM KONDISI BAIK DAN BAGIANNYA TIDAK ADA YANG RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.6, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4D. SAAT DI OPERASIKAN TIDAK ADA KONDISI ATAU MUNCUL SUARA YANG ABNORMAL.", method: "VISUAL / DI DENGARKAN", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.7, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4D. SAAT DI OPERASIKAN TIDAK ADA KONDISI ATAU MUNCUL SUARA YANG ABNORMAL.", method: "VISUAL / DI DENGARKAN", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.8, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4E. SAAT DI OPERASIKAN ANGKA PENGUKURAN DI LAYAR STABIL ATAU TIDAK BERUBAH-UBAH", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.9, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4E. SAAT DI OPERASIKAN ANGKA PENGUKURAN DI LAYAR STABIL ATAU TIDAK BERUBAH-UBAH", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.10, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4F. SEBELUM DI LAKUKAN PENGUKURAN, BISA DI SETTING \"0\" UNTUK ANGKA PENGUKURAN.", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.11, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4F. SEBELUM DI LAKUKAN PENGUKURAN, BISA DI SETTING \"0\" UNTUK ANGKA PENGUKURAN.", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.12, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4G. PASTIKAN GRIPER BISA BERHENTI PADA POSISI STOPPER YANG DITENTUKAN", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.13, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4G. PASTIKAN GRIPER BISA BERHENTI PADA POSISI STOPPER YANG DITENTUKAN", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 4.14, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4H. TOMBOL EMERGENCY BISA BERFUNGSI", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 4.15, no: 4, itemCheck: "MESIN TENSILE", checkPoint: "4H. TOMBOL EMERGENCY BISA BERFUNGSI", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    // No 5 - STEEL RULER
    { id: 5, no: 5, itemCheck: "STEEL RULER", checkPoint: "5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 5.1, no: 5, itemCheck: "STEEL RULER", checkPoint: "5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 5.2, no: 5, itemCheck: "STEEL RULER", checkPoint: "5B. STEEL RULER TIDAK BERKARAT DAN ANGKA TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 5.3, no: 5, itemCheck: "STEEL RULER", checkPoint: "5B. STEEL RULER TIDAK BERKARAT DAN ANGKA TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 6 - BENT UP/DOWN GAUGE
    { id: 6, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 6.1, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 6.2, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6B. GAUGE DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 6.3, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6B. GAUGE DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 6.4, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6C. BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 6.5, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6C. BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    // No 7 - THICKNESS GAUGE / GO NO GO
    { id: 7, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED (EXPIRED DATE HANYA UNTUK THICKENESS GAUGE)", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 7.1, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED (EXPIRED DATE HANYA UNTUK THICKENESS GAUGE)", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 7.2, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7B. GAUGE / GO NO GO DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 7.3, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7B. GAUGE / GO NO GO DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 8 - POCKET COMPARATOR
    { id: 8, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 8.1, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 8.2, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8B. POCKET COMPARATOR DALAM KONDISI BAIK, TIDAK RUSAK DAN BISA MELIHAT SECARA JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 8.3, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8B. POCKET COMPARATOR DALAM KONDISI BAIK, TIDAK RUSAK DAN BISA MELIHAT SECARA JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    // No 9 - CRIMPING STANDARD & IS
    { id: 9, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9A. TIDAK RUSAK / TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 9.1, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9A. TIDAK RUSAK / TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 9.2, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9B. ADA STAMP CONTROL DAN STAMP \"CONFIDENTIAL\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 9.3, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9B. ADA STAMP CONTROL DAN STAMP \"CONFIDENTIAL\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 10 - TROLLY INSPECTOR
    { id: 10, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10A. TROLLY DALAM KONDISI BAIK DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 10.1, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10A. TROLLY DALAM KONDISI BAIK DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 10.2, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10B. TEMPAT CUP TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 10.3, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10B. TEMPAT CUP TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 11 - LAMPU UV
    { id: 11, no: 11, itemCheck: "LAMPU UV", checkPoint: "11A. ADA 2 LAMPU DI AREA INSPEKSI UV", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 11.1, no: 11, itemCheck: "LAMPU UV", checkPoint: "11A. ADA 2 LAMPU DI AREA INSPEKSI UV", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 11.2, no: 11, itemCheck: "LAMPU UV", checkPoint: "11B. SAAT DIOPERASIKAN LAMPU MENYALA TERANG (TIDAK ADA LAMPU LED YANG MATI ≥ 3 PCS DALAM LENSA UV)", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 11.3, no: 11, itemCheck: "LAMPU UV", checkPoint: "11B. SAAT DIOPERASIKAN LAMPU MENYALA TERANG (TIDAK ADA LAMPU LED YANG MATI ≥ 3 PCS DALAM LENSA UV)", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    // No 12 - MESIN SIMPLE CROSS SECTION
    { id: 12, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12A. TOMBOL ON OFF BERFUNGSI, TIDAK RUSAK DAN LAMPU INDIKATOR MENYALA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 12.1, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12A. TOMBOL ON OFF BERFUNGSI, TIDAK RUSAK DAN LAMPU INDIKATOR MENYALA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 12.2, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12B. TIDAK BERBAU ASAP DAN STOP KONTAK TERPASANG SEMPURNA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 12.3, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12B. TIDAK BERBAU ASAP DAN STOP KONTAK TERPASANG SEMPURNA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
  ], [])

  const CS_REMOVE_TOOL_ITEMS: CSRemoveToolItem[] = useMemo(() => [
    // NO 1 - PA
    { id: "1-X-1-A", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "1-X-1-B", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "1-X-2-A", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "1-X-2-B", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "1-X-3-A", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "1-X-3-B", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "1-X-4-A", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "1-X-4-B", no: 1, toolType: "PA", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 2 - DLI
    { id: "2-X-1-A", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "2-X-1-B", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "2-X-2-A", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "2-X-2-B", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "2-X-3-A", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "2-X-3-B", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "2-X-4-A", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "2-X-4-B", no: 2, toolType: "DLI", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 3 - 1-85
    { id: "3-X-1-A", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "3-X-1-B", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "3-X-2-A", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "3-X-2-B", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "3-X-3-A", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "3-X-3-B", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "3-X-4-A", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "3-X-4-B", no: 3, toolType: "1-85", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 4 - 1-73
    { id: "4-X-1-A", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "4-X-1-B", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "4-X-2-A", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "4-X-2-B", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "4-X-3-A", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "4-X-3-B", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "4-X-4-A", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "4-X-4-B", no: 4, toolType: "1-73", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 5 - 1-79
    { id: "5-X-1-A", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "5-X-1-B", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "5-X-2-A", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "5-X-2-B", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "5-X-3-A", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "5-X-3-B", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "5-X-4-A", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "5-X-4-B", no: 5, toolType: "1-79", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 6 - 1-83A
    { id: "6-X-1-A", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "6-X-1-B", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "6-X-2-A", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "6-X-2-B", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "6-X-3-A", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "6-X-3-B", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "6-X-4-A", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "6-X-4-B", no: 6, toolType: "1-83A", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 7 - 1-114
    { id: "7-X-1-A", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "7-X-1-B", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "7-X-2-A", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "7-X-2-B", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "7-X-3-A", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "7-X-3-B", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "7-X-4-A", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "7-X-4-B", no: 7, toolType: "1-114", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 8 - 5
    { id: "8-X-1-A", no: 8, toolType: "5", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "8-X-1-B", no: 8, toolType: "5", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "8-X-2-A", no: 8, toolType: "5", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "8-X-2-B", no: 8, toolType: "5", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "8-X-3-A", no: 8, toolType: "5", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "8-X-3-B", no: 8, toolType: "5", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "8-X-4-A", no: 8, toolType: "5", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "8-X-4-B", no: 8, toolType: "5", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 9 - THNH
    { id: "9-X-1-A", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "9-X-1-B", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "9-X-2-A", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "9-X-2-B", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "9-X-3-A", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "9-X-3-B", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "9-X-4-A", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "9-X-4-B", no: 9, toolType: "THNH", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 10 - 1-08
    { id: "10-X-1-A", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "10-X-1-B", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "10-X-2-A", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "10-X-2-B", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "10-X-3-A", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "10-X-3-B", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "10-X-4-A", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "10-X-4-B", no: 10, toolType: "1-08", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 11 - 3-07
    { id: "11-X-1-A", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "11-X-1-B", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "11-X-2-A", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "11-X-2-B", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "11-X-3-A", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "11-X-3-B", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "11-X-4-A", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "11-X-4-B", no: 11, toolType: "3-07", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 12 - 1-35
    { id: "12-X-1-A", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "12-X-1-B", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "12-X-2-A", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "12-X-2-B", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "12-X-3-A", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "12-X-3-B", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "12-X-4-A", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "12-X-4-B", no: 12, toolType: "1-35", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 13 - 1-105
    { id: "13-X-1-A", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "13-X-1-B", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "13-X-2-A", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "13-X-2-B", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "13-X-3-A", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "13-X-3-B", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "13-X-4-A", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "13-X-4-B", no: 13, toolType: "1-105", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 14 - TLC
    { id: "14-X-1-A", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "14-X-1-B", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "14-X-2-A", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "14-X-2-B", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "14-X-3-A", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Terpasang Cover", shift: "A" },
    { id: "14-X-3-B", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Terpasang Cover", shift: "B" },
    { id: "14-X-4-A", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "14-X-4-B", no: 14, toolType: "TLC", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
    // NO 15 - EXTRACTION JIG / GO NO GO TERMINAL (R, G, W, Y)
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
    { id: "16-X-1-A", no: 16, toolType: "CLIPPER", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "A" },
    { id: "16-X-1-B", no: 16, toolType: "CLIPPER", controlNo: " ", itemCheck: "Tidak patah / bengkok", shift: "B" },
    { id: "16-X-2-A", no: 16, toolType: "CLIPPER", controlNo: " ", itemCheck: "Tidak berkarat", shift: "A" },
    { id: "16-X-2-B", no: 16, toolType: "CLIPPER", controlNo: " ", itemCheck: "Tidak berkarat", shift: "B" },
    { id: "16-X-3-A", no: 16, toolType: "CLIPPER", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
    { id: "16-X-3-B", no: 16, toolType: "CLIPPER", controlNo: " ", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
  ], [])

  const PRESSURE_JIG_CHECKPOINTS: PressureJigCheckPoint[] = useMemo(() => [
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
    { id: 7, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift: "A", frequency: "1x /Bulan", judge: " " },
    { id: 7.1, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift: "B", frequency: "1x /Bulan", judge: " " },
  ], [])

  // === GANTI STORAGE KEY DENGAN POLA KONSISTEN + TAMBAHKAN pressure-jig ===
  const storageKey = useMemo(
    () => {
      if (viewMode === "daily") {
        return "preAssyGroupLeaderDailyCheckResults"
      } else if (viewMode === "cc-stripping") {
        return "preAssyGroupLeaderCcStrippingDailyCheckResults"
      } else if (viewMode === "daily-check-ins") {
        return "preAssyInspectorDailyCheckResults"
      } else if (viewMode === "cs-remove-tool") {
        return "csRemoveControlResults"
      } else if (viewMode === "pressure-jig") {
        return "preAssyPressureJigInspectorDailyCheckResults"
      }
      return "preAssy_unknown"
    },
    [viewMode]
  )

  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  useEffect(() => {
    const load = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(storageKey)
        setResults(saved ? JSON.parse(saved) : {})
      }
    }
    load()
    const handler = () => load()
    window.addEventListener("storage", handler)
    const interval = setInterval(load, 500)
    const focusHandler = () => load()
    window.addEventListener("focus", focusHandler)
    return () => {
      window.removeEventListener("storage", handler)
      window.removeEventListener("focus", focusHandler)
      clearInterval(interval)
    }
  }, [storageKey])

  // 🔹 Render tombol berdasarkan role
  const renderViewModeButtons = () => {
    return allowedViewModes.map((mode) => {
      const { label } = VIEW_MODE_BUTTONS[mode]
      return (
        <button
          style={{
            padding: "10px 20px",
            border: "2px solid transparent",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          key={mode}
          className={`btn-mode ${viewMode === mode ? "active" : ""}`}
          onClick={() => setViewMode(mode)}
          title={VIEW_MODE_LABELS[mode]}
        >{label}
        </button>
      )
    })
  }

  // 🔹 Render header dengan judul yang sesuai
  const renderActiveTitle = () => {
    return VIEW_MODE_LABELS[viewMode]
  }

  const weekdays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
  const timeSlots = ["01.00", "04.00", "08.00", "13.00", "16.00", "20.00"]

  // === FUNGSI GET RESULT DINAMIS ===
  const getResult = (date: number, id: number, shift: "A" | "B", timeSlot?: string) => {
    const dateKey = getDateKey(date)
    const key = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    return results[dateKey]?.[key] || null
  }

  // === FUNGSI GET RESULT UNTUK CS REMOVE TOOL ===
  const getCSRemoveResult = (date: number, itemId: string) => {
    const dateKey = getDateKey(date)
    return results[dateKey]?.[itemId] || null
  }

  // === FUNGSI GET RESULT UNTUK DAILY CHECK INS (MINGGU-HARI) ===
  const getResultDailyCheckIns = (weekIndex: number, dayIndex: number, checkpointId: number, shift: "A" | "B") => {
    if (!getWeeksInMonth[weekIndex]) return null
    const day = getWeeksInMonth[weekIndex].days[dayIndex]
    if (!day) return null
    const dateKey = getDateKey(day.date)
    const checkpointKey = `${checkpointId}-${shift}`
    return results[dateKey]?.[checkpointKey] || null
  }

  const handleStatusChange = useCallback((
    date: number,
    id: number,
    shift: "A" | "B",
    newStatus: "OK" | "NG" | "-",
    type: "daily" | "cc-stripping" | "daily-check-ins" | "cs-remove-tool" | "pressure-jig",
    timeSlot?: string
  ) => {
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    
    // DEEP CLONE untuk menghindari reference issues
    const newResults = JSON.parse(JSON.stringify(results))
    
    if (newStatus === "-") {
      if (newResults[dateKey]?.[itemKey]) {
        delete newResults[dateKey][itemKey]
        if (Object.keys(newResults[dateKey]).length === 0) {
          delete newResults[dateKey]
        }
      }
    } else if (newStatus === "NG") {
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
        ngDepartment: existing?.ngDepartment || "QA"
      }
      setNgModal({
        date,
        checkpoint: { id, shift },
        shift,
        type,
        notes: existing?.ngDescription || "     ",
        department: existing?.ngDepartment || "QA"
      })
    } else {
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
        ngDepartment: existing?.ngDepartment || "QA"
      }
    }
    
    setResults(newResults)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newResults))
    }
  }, [results, user?.fullName, storageKey, setResults])

  // === FUNGSI HANDLE STATUS CHANGE UNTUK CS REMOVE TOOL ===
  const handleCSRemoveStatusChange = useCallback((
    date: number,
    itemId: string,
    newStatus: "OK" | "NG" | "-"
  ) => {
    const dateKey = getDateKey(date)
    const newResults = JSON.parse(JSON.stringify(results))
    
    if (newStatus === "-") {
      if (newResults[dateKey]?.[itemId]) {
        delete newResults[dateKey][itemId]
        if (Object.keys(newResults[dateKey]).length === 0) {
          delete newResults[dateKey]
        }
      }
    } else if (newStatus === "NG") {
      const existing = newResults[dateKey]?.[itemId]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemId] = {
        status: "NG",
        ngCount: 1,
        items: [],
        notes: "     ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "     ",
        ngDepartment: existing?.ngDepartment || "QA"
      }
      setNgModal({
        date,
        checkpoint: { id: itemId },
        shift: "A",
        type: "cs-remove-tool",
        notes: existing?.ngDescription || "     ",
        department: existing?.ngDepartment || "QA"
      })
    } else {
      const existing = newResults[dateKey]?.[itemId]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemId] = {
        status: "OK",
        ngCount: 0,
        items: [],
        notes: "     ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "     ",
        ngDepartment: existing?.ngDepartment || "QA"
      }
    }
    
    setResults(newResults)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newResults))
    }
  }, [results, user?.fullName, storageKey, setResults])

  // === FUNGSI HANDLE STATUS CHANGE UNTUK DAILY CHECK INS ===
  const handleStatusChangeDailyCheckIns = useCallback((
    weekIndex: number,
    dayIndex: number,
    checkpointId: number,
    shift: "A" | "B",
    newStatus: "OK" | "NG" | "-"
  ) => {
    if (!getWeeksInMonth[weekIndex]) return
    const day = getWeeksInMonth[weekIndex].days[dayIndex]
    if (!day) return
    
    const date = day.date
    const dateKey = getDateKey(date)
    const checkpointKey = `${checkpointId}-${shift}`
    
    const newResults = JSON.parse(JSON.stringify(results))
    
    if (newStatus === "-") {
      if (newResults[dateKey]?.[checkpointKey]) {
        delete newResults[dateKey][checkpointKey]
        if (Object.keys(newResults[dateKey]).length === 0) {
          delete newResults[dateKey]
        }
      }
    } else if (newStatus === "NG") {
      const existing = newResults[dateKey]?.[checkpointKey]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][checkpointKey] = {
        status: "NG",
        ngCount: 1,
        items: [],
        notes: "     ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "     ",
        ngDepartment: existing?.ngDepartment || "QA"
      }
      setNgModal({
        weekIndex,
        dayIndex,
        checkpoint: { id: checkpointId, shift },
        shift,
        type: "daily-check-ins",
        notes: existing?.ngDescription || "     ",
        department: existing?.ngDepartment || "QA"
      })
    } else {
      const existing = newResults[dateKey]?.[checkpointKey]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][checkpointKey] = {
        status: "OK",
        ngCount: 0,
        items: [],
        notes: "     ",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || "Unknown",
        ngDescription: existing?.ngDescription || "     ",
        ngDepartment: existing?.ngDepartment || "QA"
      }
    }
    
    setResults(newResults)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newResults))
    }
  }, [results, user?.fullName, storageKey, getWeeksInMonth, setResults])

  // === FUNGSI SAVE NG REPORT ===
  const saveNgReport = () => {
    if (!ngModal) return
    
    const { date, weekIndex, dayIndex, checkpoint, shift, type, notes, department } = ngModal
    let dateKey = ""
    
    if (type === "daily-check-ins" && weekIndex !== undefined && dayIndex !== undefined) {
      const day = getWeeksInMonth[weekIndex].days[dayIndex]
      dateKey = getDateKey(day.date)
    } else if (date) {
      dateKey = getDateKey(date)
    }
    
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

  const renderStatusCell = useCallback((date: number, checkpoint: any, timeSlot?: string) => {
    const id = checkpoint.id
    const shift = checkpoint.shift
    const result = getResult(date, id, shift, timeSlot)
    
    // Ambil status dari result atau localStorage
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    const storedStatus = results[dateKey]?.[itemKey]?.status || "-"
    
    // Gunakan storedStatus sebagai currentStatus
    const currentStatus = storedStatus
    
    // Tentukan apakah cell editable menggunakan fungsi helper
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-", timeSlot)
    
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
          onChange={(e) => handleStatusChange(
            date, 
            id, 
            shift, 
            e.target.value as "OK" | "NG" | "-", 
            viewMode as any, 
            timeSlot
          )}
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
  }, [getResult, results, isCellEditable, handleStatusChange, viewMode])

  const renderCSRemoveStatusCell = useCallback((date: number, item: CSRemoveToolItem) => {
    const result = getCSRemoveResult(date, item.id)
    const dateKey = getDateKey(date)
    const currentStatus = result?.status || results[dateKey]?.[item.id]?.status || "-"
    
    // Tentukan apakah cell editable
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
          onChange={(e) => handleCSRemoveStatusChange(date, item.id, e.target.value as "OK" | "NG" | "-")}
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
  }, [getCSRemoveResult, results, isCellEditable, handleCSRemoveStatusChange])

  const renderStatusCellDailyCheckIns = useCallback((weekIndex: number, dayIndex: number, checkpoint: any) => {
    const checkpointId = checkpoint.id
    const shift = checkpoint.shift
    
    if (!getWeeksInMonth[weekIndex]) return "-"
    const day = getWeeksInMonth[weekIndex].days[dayIndex]
    if (!day) return "-"
    
    const date = day.date
    const result = getResultDailyCheckIns(weekIndex, dayIndex, checkpointId, shift)
    const dateKey = getDateKey(date)
    const checkpointKey = `${checkpointId}-${shift}`
    const currentStatus = result?.status || results[dateKey]?.[checkpointKey]?.status || "-"
    
    // Tentukan apakah cell editable
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
          onChange={(e) => handleStatusChangeDailyCheckIns(
            weekIndex, 
            dayIndex, 
            checkpointId, 
            shift, 
            e.target.value as "OK" | "NG" | "-"
          )}
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
  }, [getWeeksInMonth, getResultDailyCheckIns, results, isCellEditable, handleStatusChangeDailyCheckIns])

  // === FUNGSI UNTUK MENDAPATKAN HARI DALAM BULAN ===
  const getHari = (date: number): string | null => {
    const d = new Date(activeYear, activeMonth, date)
    const dayIndex = d.getDay()
    if (dayIndex === 0 || dayIndex === 6) return null
    return weekdays[dayIndex - 1]
  }

  // === FUNGSI UNTUK MENGECEK APAKAH HARI INI ATAU SUDAH LEWAT ===
  const isDayNeeded = (schedule: string, dayName: string): boolean => {
    if (schedule === "Setiap Hari") return true
    return false
  }

  const isTodayOrPast = (weekIndex: number, dayIndex: number): boolean => {
    const day = getWeeksInMonth[weekIndex]?.days[dayIndex]
    if (!day) return false
    const todayDate = new Date()
    const checkDate = new Date(activeYear, activeMonth, day.date)
    return checkDate <= todayDate
  }

  // === STATE UNTUK MODAL ===
  const [ngModal, setNgModal] = useState<{
    date?: number
    weekIndex?: number
    dayIndex?: number
    checkpoint: any
    shift: "A" | "B"
    type: "daily" | "cc-stripping" | "daily-check-ins" | "cs-remove-tool" | "pressure-jig"
    notes: string
    department: string
  } | null>(null)

  const departments = ["QA", "Produksi", "Maintenance", "Logistik", "Engineering"]

  // === EFFECT UNTUK RESET SELECTED WEEK SAAT BULAN BERUBAH ===
  useEffect(() => {
    setSelectedWeek(1)
  }, [activeMonth, activeYear])

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
        {/* === HEADER DENGAN JUDUL AKTIF === */}
        <div className="header">
          <h1>{renderActiveTitle()}</h1>
          <div className="role-info">
            <span>Role:</span>
            <span className="role-badge">
              {user.role === "group-leader-qa" ? "Group Leader" : "Inspector"}
            </span>
          </div>
        </div>

        {/* === BUTTON GROUP FILTERED BY ROLE === */}
        <div className="button-group">
          {renderViewModeButtons()}
        </div>

        {/* === NAVIGASI BULAN - DITAMPILKAN UNTUK cc-stripping DAN pressure-jig === */}
        {(viewMode === "cc-stripping" || viewMode === "pressure-jig" ||
          viewMode === "daily-check-ins" || viewMode === "cs-remove-tool") && (
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
            
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="month-title" style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                {getMonthName(activeMonth)} {activeYear}
              </span>
              
              {/* Week selector hanya untuk cc-stripping */}
              {viewMode === "cc-stripping" && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Minggu ke:</span>
                  <select 
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    style={{ 
                      paddingRight: "12px",
                      paddingTop: "8px",
                      paddingBottom: "8px", 
                      borderRadius: '6px', 
                      border: '1px solid #ccc',
                      fontSize: '1rem',
                      minWidth: '120px'
                    }}
                  >
                    {getWorkDaysByWeek.map((week) => (
                      <option key={week.weekNum} value={week.weekNum}>
                        Minggu {week.weekNum}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
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

        {/* =====================================================================
           === RENDER TABEL BERDASARKAN VIEW MODE ===
           ===================================================================== */}
        <div className="table-wrapper">
          <table className="status-table">
            <thead>
              {viewMode === "daily" ? (
                <>
                  <tr>
                    <th className="col-checkpoint text-center align-middle" rowSpan={2}>
                      Check Point
                    </th>
                    <th className="col-standard text-center align-middle" rowSpan={2}>
                      Standard / Metode
                    </th>
                    <th className="col-waktu text-center align-middle" rowSpan={2}>
                      Waktu Check
                    </th>
                    <th className="col-shift text-center align-middle" rowSpan={2}>
                      Shift
                    </th>
                    <th colSpan={4}></th>
                    <th colSpan={dynamicDates.length} className="month-header">
                      {getMonthName(activeMonth)} {activeYear}
                    </th>
                  </tr>
                  <tr>
                    {dynamicDates.map((date) => (
                      <th key={date} className={`col-date ${isCurrentMonth && date === today ? "col-date-today" : ""}`}>
                        {date}
                      </th>
                    ))}
                  </tr>
                </>
              ) : viewMode === "daily-check-ins" ? (
                <>
                  <tr>
                    <th rowSpan={2} className="col-no">No</th>
                    <th rowSpan={2} className="col-item">Item Check</th>
                    <th rowSpan={2} className="col-checkpoint">Check Point</th>
                    <th rowSpan={2} className="col-method">Metode</th>
                    <th rowSpan={2} className="col-area">TENSILE</th>
                    <th rowSpan={2} className="col-area">CROSS SECTION</th>
                    <th rowSpan={2} className="col-area">CUTTING</th>
                    <th rowSpan={2} className="col-area">PA</th>
                    <th rowSpan={2} className="col-shift">Shift</th>
                    {getWeeksInMonth.map((week, wIdx) => (
                      <th key={wIdx} colSpan={week.days.length} className="col-week-header">
                        Minggu {week.weekNum}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {getWeeksInMonth.map((week, wIdx) =>
                      week.days.map((day, dIdx) => (
                        <th key={`${wIdx}-${dIdx}`} className="col-day">
                          {day.dayName.substring(0, 2).toUpperCase()}
                        </th>
                      ))
                    )}
                  </tr>
                </>
              ) : viewMode === "cc-stripping" ? (
                <>
                  <tr>
                    <th colSpan={3 + getSelectedWeekDays.length * timeSlots.length} className="month-header" style={{ 
                      textAlign: 'center',
                      fontSize: '1.2rem',
                      padding: '10px 0'
                    }}>
                      {getMonthName(activeMonth)} {activeYear}
                    </th>
                  </tr>
                  <tr>
                    <th rowSpan={2} className="col-machine align-middle" style={{ 
                      minWidth: '100px',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}>
                      MESIN
                    </th>
                    <th rowSpan={2} className="col-kind align-middle" style={{ 
                      minWidth: '90px',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}>
                      KIND
                    </th>
                    <th rowSpan={2} className="col-size align-middle" style={{ 
                      minWidth: '50px',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}>
                      SIZE
                    </th>
                    {getSelectedWeekDays.map((day, index) => (
                      <th key={index} colSpan={timeSlots.length} style={{ 
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        padding: '8px 0',
                        textAlign: 'center'
                      }}>
                        {day.dayName} {day.date}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {getSelectedWeekDays.flatMap((day, dayIndex) => 
                      timeSlots.map((timeSlot, timeIndex) => (
                        <th key={`${dayIndex}-${timeIndex}`} className="col-time" style={{ 
                          fontWeight: 'normal',
                          fontSize: '0.9rem',
                          padding: '5px 0',
                          textAlign: 'center'
                        }}>
                          {timeSlot}
                        </th>
                      ))
                    )}
                  </tr>
                </>
              ) : viewMode === "cs-remove-tool" ? (
                <>
                  <tr>
                    <th className="col-no" rowSpan={2}>NO</th>
                    <th className="col-tool" rowSpan={2}>TOOL TYPE</th>
                    <th className="col-control" rowSpan={2}>CONTROL NO</th>
                    <th className="col-item" rowSpan={2}>ITEM CHECK</th>
                    <th className="col-shift" rowSpan={2}>SHIFT</th>
                    <th colSpan={dynamicDates.length} style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold" }}>
                      DATE
                    </th>
                  </tr>
                  <tr>
                    {dynamicDates.map((date) => (
                      <th key={date} className={`col-date ${isCurrentMonth && date === today ? "col-date-today" : ""}`}>
                        {date}
                      </th>
                    ))}
                  </tr>
                </>
              ) : viewMode === "pressure-jig" ? (
                <>
                  <tr>
                    <th rowSpan={2} className="col-no">No</th>
                    <th rowSpan={2} className="col-checkpoint">Item Check</th>
                    <th rowSpan={2} className="col-freq">Freq</th>
                    <th rowSpan={2} className="col-judge">Judge</th>
                    <th rowSpan={2} className="col-shift">Shift</th>
                    <th colSpan={dynamicDates.length} className="month-header">
                      {getMonthName(activeMonth)} {activeYear}
                    </th>
                  </tr>
                  <tr>
                    {dynamicDates.map((date) => (
                      <th key={date} className={`col-date ${isCurrentMonth && date === today ? "col-date-today" : ""}`}>
                        {date}
                      </th>
                    ))}
                  </tr>
                </>
              ) : null}
            </thead>
            <tbody>
              {/* ... isi tabel tetap sama seperti sebelumnya ... */}
              {/* Saya akan menampilkan bagian body tabel untuk setiap viewMode */}
              
              {viewMode === "daily" ? (
                Array.from({ length: 14 }, (_, i) => i + 1).map((id) => {
                  const shiftA = DAILY_CHECKPOINTS.find((cp) => cp.id === id && cp.shift === "A")
                  const shiftB = DAILY_CHECKPOINTS.find((cp) => cp.id === id + 0.1 && cp.shift === "B")
                  if (!shiftA || !shiftB) return null
                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td className="col-checkpoint" rowSpan={2}>
                          {shiftA!.checkPoint}
                        </td>
                        <td className="col-standard">{shiftA!.standard}</td>
                        <td className="col-waktu">{shiftA!.waktuCheck}</td>
                        <td className="col-shift">{shiftA!.shift}</td>
                        {dynamicDates.map((date) => (
                          <td
                            key={`A-${id}-${date}`}
                            className={`col-date px-1.5 py-1 text-xs border ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                          >
                            {renderStatusCell(date, shiftA!)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="col-standard">{shiftB!.standard}</td>
                        <td className="col-waktu">{shiftB!.waktuCheck}</td>
                        <td className="col-shift">{shiftB!.shift}</td>
                        {dynamicDates.map((date) => (
                          <td
                            key={`B-${id}-${date}`}
                            className={`col-date px-1.5 py-1 text-xs border ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                          >
                            {renderStatusCell(date, shiftB!)}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  )
                })
              ) : viewMode === "daily-check-ins" ? (
                Array.from(
                  new Map(
                    DAILY_CHECK_INS_CHECKPOINTS.map((cp) => [cp.no, cp])
                  ).keys()
                ).map((no) => {
                  const group = DAILY_CHECK_INS_CHECKPOINTS.filter(cp => cp.no === no)
                  const rowCount = group.length
                  return (
                    <React.Fragment key={no}>
                      {group.map((checkpoint, idx) => (
                        <tr key={`${checkpoint.id}-${checkpoint.shift}`}>
                          {idx === 0 && <td rowSpan={rowCount} className="col-no">{checkpoint.no}</td>}
                          {idx === 0 && <td rowSpan={rowCount} className="col-item">{checkpoint.itemCheck}</td>}
                          <td className="col-checkpoint">{checkpoint.checkPoint}</td>
                          <td className="col-method">{checkpoint.method}</td>
                          <td className="col-area text-center">{checkpoint.area.tensile ? "√" : "-"}</td>
                          <td className="col-area text-center">{checkpoint.area.crossSection ? "√" : "-"}</td>
                          <td className="col-area text-center">{checkpoint.area.cutting ? "√" : "-"}</td>
                          <td className="col-area text-center">{checkpoint.area.pa ? "√" : "-"}</td>
                          <td className="col-shift">{checkpoint.shift}</td>
                          {getWeeksInMonth.map((week, wIdx) =>
                            week.days.map((day, dIdx) => {
                              const needed = isDayNeeded(checkpoint.schedule, day.dayName)
                              const isTodayOrBefore = isTodayOrPast(wIdx, dIdx)
                              const result = getResultDailyCheckIns(wIdx, dIdx, checkpoint.id, checkpoint.shift)
                              if (!needed) {
                                return <td key={`${wIdx}-${dIdx}`} className="col-date-cell bg-gray-200"></td>
                              }
                              if (result) {
                                return (
                                  <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                    <span
                                      className={`status-badge ${
                                        result.status === "OK" ? "status-badge-ok" : "status-badge-ng"
                                      } text-xs px-1 py-0.5 rounded cursor-pointer inline-block`}
                                      onClick={() =>
                                        setNgModal({
                                          weekIndex: wIdx,
                                          dayIndex: dIdx,
                                          checkpoint,
                                          shift: checkpoint.shift,
                                          type: "daily-check-ins",
                                          notes: result.ngDescription || "    ",
                                          department: result.ngDepartment || "QA"
                                        })
                                      }
                                    >
                                      {result.status === "OK" ? "OK" : `NG (${result.ngCount})`}
                                    </span>
                                  </td>
                                )
                              }
                              if (isTodayOrBefore) {
                                return (
                                  <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                    {renderStatusCellDailyCheckIns(wIdx, dIdx, checkpoint)}
                                  </td>
                                )
                              }
                              return <td key={`${wIdx}-${dIdx}`} className="col-date-cell bg-gray-100"></td>
                            })
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })
              ) : viewMode === "cc-stripping" ? (
                Array.from({ length: 17 }, (_, i) => i + 1).map((id) => {
                  const shiftA = CC_STRIPPING_CHECKPOINTS.find((cp) => cp.id === id && cp.shift === "A")
                  const shiftB = CC_STRIPPING_CHECKPOINTS.find((cp) => cp.id === id + 0.1 && cp.shift === "B")
                  if (!shiftA || !shiftB) return null
                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td className="col-machine" rowSpan={2} style={{ 
                          textAlign: 'left',
                          padding: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}>
                          {shiftA!.machine}
                        </td>
                        <td className="col-kind" rowSpan={2} style={{ 
                          textAlign: 'left',
                          padding: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}>
                          {shiftA!.kind}
                        </td>
                        <td className="col-size" rowSpan={2} style={{ 
                          textAlign: 'center',
                          padding: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}>
                          {shiftA!.size}
                        </td>
                        {getSelectedWeekDays.flatMap((day, dayIndex) => 
                          timeSlots.map((timeSlot) => {
                            const isActive = isTimeSlotActive(day.date, timeSlot)
                            return (
                              <td key={`${dayIndex}-${timeSlot}-A`} className="col-time-cell" style={{ 
                                textAlign: 'center',
                                padding: '5px',
                                verticalAlign: 'middle'
                              }}>
                                {isActive ? (
                                  renderStatusCell(day.date, shiftA!, timeSlot)
                                ) : (
                                  <span className="status-badge status-badge-past text-xs px-1 py-0.5 rounded" style={{ 
                                    display: 'inline-block',
                                    width: '100%',
                                    height: '100%'
                                  }}>
                                    -
                                  </span>
                                )}
                              </td>
                            )
                          })
                        )}
                      </tr>
                      <tr>
                        {getSelectedWeekDays.flatMap((day, dayIndex) => 
                          timeSlots.map((timeSlot) => {
                            const isActive = isTimeSlotActive(day.date, timeSlot)
                            return (
                              <td key={`${dayIndex}-${timeSlot}-B`} className="col-time-cell" style={{ 
                                textAlign: 'center',
                                padding: '5px',
                                verticalAlign: 'middle'
                              }}>
                                {isActive ? (
                                  renderStatusCell(day.date, shiftB!, timeSlot)
                                ) : (
                                  <span className="status-badge status-badge-past text-xs px-1 py-0.5 rounded" style={{ 
                                    display: 'inline-block',
                                    width: '100%',
                                    height: '100%'
                                  }}>
                                    -
                                  </span>
                                )}
                              </td>
                            )
                          })
                        )}
                      </tr>
                    </React.Fragment>
                  )
                })
              ) : viewMode === "cs-remove-tool" ? (
                <>
                  {Object.values(
                    CS_REMOVE_TOOL_ITEMS.reduce<Record<number, CSRemoveToolItem[]>>((acc, item) => {
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
                            {dynamicDates.map((date) => (
                              <td
                                key={`${item.id}-${date}`}
                                className={`col-date px-1.5 py-1 text-xs border ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                              >
                                {renderStatusCell(date, item)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </>
              ) : viewMode === "pressure-jig" ? (
                <>
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((id) => {
                    const shiftA = PRESSURE_JIG_CHECKPOINTS.find((cp) => cp.id === id && cp.shift === "A")
                    const shiftB = PRESSURE_JIG_CHECKPOINTS.find((cp) => cp.id === id + 0.1 && cp.shift === "B")
                    if (!shiftA || !shiftB) return null
                    return (
                      <React.Fragment key={id}>
                        <tr>
                          <td className="col-no" rowSpan={2}>{id}</td>
                          <td className="col-checkpoint" rowSpan={2}>{shiftA!.checkPoint}</td>
                          <td className="col-freq" rowSpan={2}>{shiftA!.frequency}</td>
                          <td className="col-judge" rowSpan={2}>{shiftA!.judge}</td>
                          <td className="col-shift">{shiftA!.shift}</td>
                          {dynamicDates.map((date) => (
                            <td
                              key={`A-${id}-${date}`}
                              className={`col-date px-1.5 py-1 text-xs border ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                            >
                              {renderStatusCell(date, shiftA!)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="col-shift">{shiftB!.shift}</td>
                          {dynamicDates.map((date) => (
                            <td
                              key={`B-${id}-${date}`}
                              className={`col-date px-1.5 py-1 text-xs border ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                            >
                              {renderStatusCell(date, shiftB!)}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </>
              ) : null}

              {/* BARIS CUSTOM – HANYA UNTUK DAILY */}
              {viewMode === "daily" && (
                <React.Fragment>
                  {/* === Baris: Check dan Tanda tangan GL Inspector === */}
                  <tr>
                    <td colSpan={2} rowSpan={2} className="border text-xs font-bold text-center bg-gray-50 py-2">
                      Check dan Tanda tangan GL Inspector
                    </td>
                    <td className="col-waktu" rowSpan={2}></td>
                    <td className="col-shift">A</td>
                    {dynamicDates.map((date) => {
                      const dateKey = getDateKey(date)
                      const storageKeyGL = "preAssyGroupLeaderSignatureGL"
                      const savedGL = typeof window !== "undefined" ? localStorage.getItem(storageKeyGL) : null
                      const glData = savedGL ? JSON.parse(savedGL) : {}
                      const value = glData[dateKey]?.["A"] || "-"
                      if (user?.role === "group-leader-qa") {
                        return (
                          <td
                            key={`gl-A-${date}`}
                            className={`border text-xs ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                          >
                            <select
                              className="status-dropdown"
                              style={{
                                backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e",
                                color: "white",
                                width: '100%',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              value={value}
                              onChange={(e) => {
                                const newValue = e.target.value
                                const newData = {
                                  ...glData,
                                  [dateKey]: { ...(glData[dateKey] || {}), A: newValue },
                                }
                                localStorage.setItem(storageKeyGL, JSON.stringify(newData))
                                setResults((prev) => ({ ...prev }))
                              }}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          </td>
                        )
                      } else {
                        return (
                          <td key={`gl-A-${date}`} className="border text-xs bg-gray-200 text-gray-500">
                            {value === "-" ? "-" : value}
                          </td>
                        )
                      }
                    })}
                  </tr>
                  <tr>
                    <td className="col-shift">B</td>
                    {dynamicDates.map((date) => {
                      const dateKey = getDateKey(date)
                      const storageKeyGL = "preAssyGroupLeaderSignatureGL"
                      const savedGL = typeof window !== "undefined" ? localStorage.getItem(storageKeyGL) : null
                      const glData = savedGL ? JSON.parse(savedGL) : {}
                      const value = glData[dateKey]?.["B"] || "-"
                      if (user?.role === "group-leader-qa") {
                        return (
                          <td
                            key={`gl-B-${date}`}
                            className={`border text-xs ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                          >
                            <select
                              className="status-dropdown"
                              style={{
                                backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e",
                                color: "white",
                                width: '100%',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              value={value}
                              onChange={(e) => {
                                const newValue = e.target.value
                                const newData = {
                                  ...glData,
                                  [dateKey]: { ...(glData[dateKey] || {}), B: newValue },
                                }
                                localStorage.setItem(storageKeyGL, JSON.stringify(newData))
                                setResults((prev) => ({ ...prev }))
                              }}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          </td>
                        )
                      } else {
                        return (
                          <td key={`gl-B-${date}`} className="border text-xs bg-gray-200 text-gray-500">
                            {value === "-" ? "-" : value}
                          </td>
                        )
                      }
                    })}
                  </tr>
                  {/* === Baris: Verifikasi dan Tanda tangan ESO === */}
                  <tr>
                    <td colSpan={2} rowSpan={2} className="border text-xs font-bold text-center bg-gray-50 py-2">
                      Verifikasi dan Tanda tangan ESO (Setiap Hari Selasa & Kamis)
                    </td>
                    <td className="col-waktu" rowSpan={2}></td>
                    <td className="col-shift">A</td>
                    {dynamicDates.map((date) => {
                      const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
                      const isSelasaKamis = dayOfWeek === 2 || dayOfWeek === 4
                      const dateKey = getDateKey(date)
                      const storageKeyESO = "preAssyGroupLeaderSignatureESO"
                      const savedESO = typeof window !== "undefined" ? localStorage.getItem(storageKeyESO) : null
                      const esoData = savedESO ? JSON.parse(savedESO) : {}
                      const value = esoData[dateKey]?.["A"] || "-"
                      if (!isSelasaKamis) {
                        return <td key={`eso-A-${date}`} className="border text-xs"></td>
                      }
                      if (user?.role === "group-leader-qa") {
                        return (
                          <td
                            key={`eso-A-${date}`}
                            className={`border text-xs ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                          >
                            <select
                              className="status-dropdown"
                              style={{
                                backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e",
                                color: "white",
                                width: '100%',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              value={value}
                              onChange={(e) => {
                                const newValue = e.target.value
                                const newData = {
                                  ...esoData,
                                  [dateKey]: { ...(esoData[dateKey] || {}), A: newValue },
                                }
                                localStorage.setItem(storageKeyESO, JSON.stringify(newData))
                                setResults((prev) => ({ ...prev }))
                              }}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          </td>
                        )
                      } else {
                        return (
                          <td key={`eso-A-${date}`} className="border text-xs bg-gray-200 text-gray-500">
                            {value === "-" ? "-" : value}
                          </td>
                        )
                      }
                    })}
                  </tr>
                  <tr>
                    <td className="col-shift">B</td>
                    {dynamicDates.map((date) => {
                      const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
                      const isSelasaKamis = dayOfWeek === 2 || dayOfWeek === 4
                      const dateKey = getDateKey(date)
                      const storageKeyESO = "preAssyGroupLeaderSignatureESO"
                      const savedESO = typeof window !== "undefined" ? localStorage.getItem(storageKeyESO) : null
                      const esoData = savedESO ? JSON.parse(savedESO) : {}
                      const value = esoData[dateKey]?.["B"] || "-"
                      if (!isSelasaKamis) {
                        return <td key={`eso-B-${date}`} className="border text-xs"></td>
                      }
                      if (user?.role === "group-leader-qa") {
                        return (
                          <td
                            key={`eso-B-${date}`}
                            className={`border text-xs ${isCurrentMonth && date === today ? "bg-blue-50" : ""}`}
                          >
                            <select
                              className="status-dropdown"
                              style={{
                                backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e",
                                color: "white",
                                width: '100%',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              value={value}
                              onChange={(e) => {
                                const newValue = e.target.value
                                const newData = {
                                  ...esoData,
                                  [dateKey]: { ...(esoData[dateKey] || {}), B: newValue },
                                }
                                localStorage.setItem(storageKeyESO, JSON.stringify(newData))
                                setResults((prev) => ({ ...prev }))
                              }}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          </td>
                        )
                      } else {
                        return (
                          <td key={`eso-B-${date}`} className="border text-xs bg-gray-200 text-gray-500">
                            {value === "-" ? "-" : value}
                          </td>
                        )
                      }
                    })}
                  </tr>
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>
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

      {/* =====================================================================
         === STYLES (DIPERBAIKI) ===
         ===================================================================== */}
      <style jsx>{`
        .page-content {
          max-width: 1800px;
          padding-left: 95px;
          padding-top: 25px;
          padding-right: 25px;
          padding-bottom: 25px;
        }
        .header {
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 {
          margin: 0;
          color: #ffffff;
          font-size: 1.6rem;
        }
        .role-info {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 0.95rem;
          color: #ffffff;
          font-weight: bold;
        }
        .role-badge {
          background: #e3f2fd;
          color: #1976d2;
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.9rem;
        }
        .button-group {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          padding: 16px;
          background: #f8fbff;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        .btn-mode {
          padding: 10px 20px;
          border: 2px solid transparent;
          border-radius: 6px;
          background: #e3f2fd;
          color: #1976d2;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-mode:hover {
          background: #bbdefb;
        }
        .btn-mode.active {
          background: #1976d2;
          color: white;
          border-color: #0d47a1;
        }
        .month-header {
          text-align: center;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0d47a1;
          background: #e3f2fd;
          padding: 8px 0;
        }
        .week-header {
          text-align: center;
          font-weight: 600;
          background: #f5f9ff;
          border-bottom: 1px solid #ddd;
        }
        .table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .status-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 0.85rem;
        }
        .status-table th,
        .status-table td {
          padding: 8px 6px;
          text-align: center;
          border: 1px solid #e0e0e0;
          vertical-align: middle;
        }
        .status-table th {
          background: #f5f9ff;
          font-weight: 700;
          position: sticky;
          top: 0;
          z-index: 2;
          font-size: 14px;
          padding: 5px 6px;
        }
        .status-table td.col-machine,
        .status-table td.col-kind,
        .status-table td.col-size {
          text-align: left;
          padding: 8px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .status-table td.col-time-cell {
          text-align: center;
          padding: 5px;
          vertical-align: middle;
        }
        .status-table td.col-checkpoint {
          min-width: 250px;
          text-align: left;
          word-break: break-word;
          white-space: pre-wrap;
          font-size: 12px;
          font-weight: 500;
        }
        .col-machine {
          min-width: 100px;
        }
        .col-kind {
          min-width: 90px;
        }
        .col-size {
          min-width: 50px;
        }
        .col-shift,
        .col-waktu,
        .col-standard {
          min-width: 80px;
        }
        .col-date {
          min-width: 36px;
        }
        .col-date-today {
          background: #fff8e1;
          color: #e65100;
        }
        .col-date-cell {
          min-width: 36px;
          height: 36px;
          padding: 2px;
        }

        /* =====================================================================
           === CSS BARU UNTUK DROPDOWN DAN BADGE ===
           ===================================================================== */
        .status-dropdown {
          width: 100%;
          height: 100%;
          border: none;
          cursor: pointer;
          font-weight: 500;
          font-size: 12px;
          text-align: center;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        .status-dropdown option {
          text-align: center;
        }
        .status-badge {
          display: inline-block;
          width: 100%;
          height: 100%;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 12px;
          text-align: center;
        }
        .status-badge-ok {
          background: #4caf50;
          color: white;
        }
        .status-badge-ng {
          background: #f44336;
          color: white;
          cursor: pointer;
        }
        .status-badge-locked {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .bg-gray-200 {
          background-color: #e0e0e0 !important;
        }
        .bg-gray-100 {
          background-color: #f5f5f5 !important;
        }

        /* MODAL STYLES */
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