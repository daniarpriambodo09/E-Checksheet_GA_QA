// app/status-pre-assy/page.tsx
"use client"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/Sidebar"
import React from "react"

// =====================================================================
// === TYPE DEFINITIONS ===
// =====================================================================

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

// 🔹 Mapping view mode ke category code
const VIEW_MODE_CATEGORY_CODE: Record<ViewMode, string> = {
  "daily": "pre-assy-daily-gl",
  "cc-stripping": "pre-assy-cc-stripping-gl",
  "daily-check-ins": "pre-assy-daily-check-ins",
  "cs-remove-tool": "pre-assy-cs-remove-tool",
  "pressure-jig": "pre-assy-pressure-jig"
};

// ✅ DEFAULT AREA MAPPING - Tidak ada "Semua Area"
const DEFAULT_AREA_BY_CATEGORY: Record<string, string> = {
  "pre-assy-daily-gl": "pre-assy-gl-crimping",
  "pre-assy-cc-stripping-gl": "pre-assy-cc-zone",
  "pre-assy-daily-check-ins": "pre-assy-ins-tensile",
  "pre-assy-cs-remove-tool": "pre-assy-tool-crib",
  "pre-assy-pressure-jig": "pre-assy-jig-storage"
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

interface CSRemoveToolItem {
  id: string          // ID frontend (misal: "1-X-1-A")
  dbId?: number       // ID database (integer)
  no: number
  toolType: string
  controlNo: string
  itemCheck: string
  shift: "A" | "B"
}

// 🔹 Tipe Pressure Jig
interface PressureJigCheckPoint {
  id: number
  checkPoint: string
  shift: "A" | "B"
  frequency: string
  judge: string
}

// =====================================================================
// === AREA FILTER COMPONENT (UPDATED: Tanpa "Semua Area") ===
// =====================================================================

interface AreaOption {
  id: number;
  area_name: string;
  area_code: string;
  description?: string;
  sort_order: number;
}

interface AreaFilterProps {
  categoryCode: string;
  selectedArea: string;
  onAreaChange: (areaCode: string) => void;
  isLoading?: boolean;
  defaultAreaCode?: string;
}

function AreaFilter({ 
  categoryCode, 
  selectedArea, 
  onAreaChange, 
  isLoading = false,
  defaultAreaCode
}: AreaFilterProps) {
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  
  useEffect(() => {
    if (!categoryCode) return;
    
    const fetchAreas = async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/areas/get-by-category?categoryCode=${encodeURIComponent(categoryCode)}`);
        const data = await res.json();
        if (data.success && data.areas?.length > 0) {
          setAreas(data.areas);
          
          // ✅ AUTO-SET DEFAULT AREA JIKA selectedArea KOSONG
          if (!selectedArea) {
            if (defaultAreaCode && data.areas.some((a: AreaOption) => a.area_code === defaultAreaCode)) {
              onAreaChange(defaultAreaCode);
            } else {
              // Fallback ke area pertama yang tersedia
              onAreaChange(data.areas[0].area_code);
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch areas:', error);
      } finally {
        setIsFetching(false);
      }
    };
    
    fetchAreas();
  }, [categoryCode, selectedArea, onAreaChange, defaultAreaCode]);
  
  const isDisabled = isLoading || isFetching || areas.length === 0;
  
  return (
    <div className="area-filter-wrapper" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      marginLeft: 'auto'
    }}>
      <label htmlFor="area-select" className="filter-label" style={{ 
        fontWeight: '600',
        fontSize: '14px',
        color: '#334155'
      }}>Area:</label>
      <select
        id="area-select"
        value={selectedArea}
        onChange={(e) => onAreaChange(e.target.value)}
        disabled={isDisabled}
        className="area-dropdown"
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          fontSize: '14px',
          fontWeight: '500',
          color: '#1e293b',
          backgroundColor: isDisabled ? '#f1f5f9' : 'white',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          minWidth: '200px'
        }}
      >
        {/* ✅ TIDAK ADA OPSI "Semua Area" - Hanya daftar area dari DB */}
        {areas.map(area => (
          <option key={area.area_code} value={area.area_code}>
            {area.area_name}
          </option>
        ))}
      </select>
      {(isFetching || areas.length === 0) && (
        <span className="area-loading" style={{ 
          fontSize: '13px', 
          color: '#64748b',
          fontStyle: 'italic'
        }}>
          {isFetching ? 'Memuat...' : 'Tidak ada area'}
        </span>
      )}
    </div>
  );
}

// =====================================================================
// === MAIN COMPONENT ===
// =====================================================================

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
  
  // === STATE UNTUK SISTEM BULAN DINAMIS ===
  const [activeMonth, setActiveMonth] = useState(() => new Date().getMonth())
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear())
  
  // === STATE UNTUK MINGGU (HANYA UNTUK CC & Stripping) ===
  const [selectedWeek, setSelectedWeek] = useState(1)
  
  // === STATE UNTUK AREA FILTER ===
  // ✅ Initialize dengan default area berdasarkan viewMode saat ini
  const [selectedArea, setSelectedArea] = useState<string>(() => {
    const currentCategory = VIEW_MODE_CATEGORY_CODE["daily" as ViewMode];
    return DEFAULT_AREA_BY_CATEGORY[currentCategory] || "";
  })
  
  // ✅ Reset selectedArea saat viewMode berubah
  useEffect(() => {
    const currentCategory = VIEW_MODE_CATEGORY_CODE[viewMode];
    const defaultArea = DEFAULT_AREA_BY_CATEGORY[currentCategory];
    if (defaultArea) {
      setSelectedArea(defaultArea);
    }
  }, [viewMode])
  
  // === STATE DATA DARI DATABASE ===
  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>({})
  const [glSignaturesGL, setGlSignaturesGL] = useState<Record<string, Record<string, "-" | "☑">>>({})
  const [glSignaturesESO, setGlSignaturesESO] = useState<Record<string, Record<string, "-" | "☑">>>({})
  
  // === STATE LOADING & ERROR ===
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // === FUNGSI UTILITAS ===
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
  
  const getDateKey = useCallback((date: number): string => {
    return `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
  }, [activeYear, activeMonth])
  
  // === CATEGORY CODE BERDASARKAN VIEW MODE ===
  const categoryCode = useMemo(() => {
    return VIEW_MODE_CATEGORY_CODE[viewMode]
  }, [viewMode])
  
  // =====================================================================
  // === API CALLS ===
  // =====================================================================
  const apiBaseUrl = '/api/pre-assy'
  
  // Load data dari database
  const loadDataFromDB = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const monthKey = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;
      const areaParam = selectedArea ? `&areaCode=${encodeURIComponent(selectedArea)}` : '';
      
      console.log('🔄 Loading data:', {
        categoryCode,
        selectedArea,
        areaParam,
        viewMode
      });
      
      const [resultsRes, signaturesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/get-results?userId=${user.id}&categoryCode=${categoryCode}&month=${monthKey}${areaParam}`),
        fetch(`${apiBaseUrl}/get-signatures?userId=${user.id}&categoryCode=${categoryCode}&month=${monthKey}${areaParam}`)
      ]);
      
      if (!resultsRes.ok || !signaturesRes.ok) {
        throw new Error('Gagal memuat data dari server');
      }
      
      const resultsData = await resultsRes.json();
      const signaturesData = await signaturesRes.json();
      
      console.log('📊 Results data:', {
        count: Object.keys(resultsData.formatted || {}).length,
        areaCode: resultsData.areaCode,
        areaId: resultsData.areaId
      });
      
      if (resultsData.success) {
        setResults(resultsData.formatted);
      }
      
      if (signaturesData.success) {
        setGlSignaturesGL(signaturesData.formatted);
      }
      
      console.log('✅ Data berhasil dimuat dari PostgreSQL');
    } catch (error) {
      console.error('❌ Error loading from DB:', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat data dari database');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load data saat component mount atau saat bulan/view/area berubah
  useEffect(() => {
    loadDataFromDB()
  }, [user?.id, activeMonth, activeYear, viewMode, selectedArea])
  
  // Simpan hasil check ke database
  const saveResultToDB = async (
    itemId: number | string,
    dateKey: string,
    shift: "A" | "B",
    status: "OK" | "NG" | "-",
    ngDescription?: string,
    ngDepartment?: string,
    timeSlot?: string
  ) => {
    if (!user?.id) {
      setError("User tidak terautentikasi")
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/save-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          categoryCode,
          itemId,
          dateKey,
          shift,
          status,
          ngDescription: ngDescription || null,
          ngDepartment: ngDepartment || null,
          timeSlot: timeSlot || null,
          areaCode: selectedArea || null  // ✅ AreaCode selalu dikirim (default sudah diset)
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menyimpan ke database')
      }
      
      console.log('✅ Data tersimpan ke PostgreSQL')
    } catch (error) {
      console.error('❌ Error saving to DB:', error)
      setError(error instanceof Error ? error.message : 'Gagal menyimpan data ke database')
    }
  }
  
  // Simpan signature ke database
  const saveSignatureToDB = async (
    dateKey: string,
    shift: "A" | "B",
    signatureStatus: "-" | "☑"
  ) => {
    if (!user?.id) {
      setError("User tidak terautentikasi")
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/save-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          categoryCode,
          dateKey,
          shift,
          signatureStatus
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menyimpan tanda tangan ke database')
      }
      
      console.log('✅ Tanda tangan tersimpan ke PostgreSQL')
    } catch (error) {
      console.error('❌ Error saving signature to DB:', error)
      setError(error instanceof Error ? error.message : 'Gagal menyimpan tanda tangan ke database')
    }
  }
  
  // =====================================================================
  // === FUNGSI HELPER: VALIDASI SLOT WAKTU ===
  // =====================================================================
  const TIME_SLOTS = ["01.00", "04.00", "08.00", "13.00", "16.00", "20.00"]
  
  const isTimeSlotPassed = useCallback((date: number, timeSlot: string): boolean => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const cellDateTime = new Date(activeYear, activeMonth, date)
    const isSameDay =
      cellDateTime.getDate() === now.getDate() &&
      cellDateTime.getMonth() === now.getMonth() &&
      cellDateTime.getFullYear() === now.getFullYear()

    if (!isSameDay) {
      // Jika tanggal berbeda, cek apakah tanggal cell sudah lewat
      return cellDateTime < now
    }

    // ✅ FIX: Untuk hari ini, cek berdasarkan waktu
    const slotIndex = TIME_SLOTS.findIndex(ts => ts === timeSlot)
    if (slotIndex === -1) return false

    const currentTimeInMinutes = currentHour * 60 + currentMinute
    const slotTimeInMinutes = (() => {
      const [slotHourStr, slotMinuteStr] = timeSlot.split('.')
      const slotHour = parseInt(slotHourStr)
      const slotMinute = parseInt(slotMinuteStr) || 0
      return slotHour * 60 + slotMinute
    })()

    // ✅ FIX: Untuk time slot 20:00, dianggap passed hanya setelah tengah malam (00:00 hari berikutnya)
    if (timeSlot === "20.00") {
      // Slot 20:00 masih bisa diisi sampai tengah malam (00:00 hari berikutnya)
      // Jadi hanya return true jika sudah lewat tengah malam
      return false  // Selalu false untuk hari yang sama, agar bisa diisi sampai tengah malam
    }

    // Untuk time slot lainnya, cek apakah waktu sekarang sudah lewat dari next slot
    const nextSlot = TIME_SLOTS[(slotIndex + 1) % TIME_SLOTS.length]
    const [nextHourStr, nextMinuteStr] = nextSlot.split('.')
    const nextHour = parseInt(nextHourStr)
    const nextMinute = parseInt(nextMinuteStr) || 0
    const nextTimeInMinutes = nextHour * 60 + nextMinute

    return currentTimeInMinutes >= nextTimeInMinutes
  }, [activeMonth, activeYear])
  
  const isTimeSlotActive = useCallback((date: number, timeSlot: string): boolean => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const cellDateTime = new Date(activeYear, activeMonth, date)
    const isSameDay =
      cellDateTime.getDate() === now.getDate() &&
      cellDateTime.getMonth() === now.getMonth() &&
      cellDateTime.getFullYear() === now.getFullYear()

    if (!isSameDay) return false

    const slotIndex = TIME_SLOTS.findIndex(ts => ts === timeSlot)
    if (slotIndex === -1) return false

    const currentTimeInMinutes = currentHour * 60 + currentMinute
    const slotTimeInMinutes = (() => {
      const [slotHourStr, slotMinuteStr] = timeSlot.split('.')
      const slotHour = parseInt(slotHourStr)
      const slotMinute = parseInt(slotMinuteStr) || 0
      return slotHour * 60 + slotMinute
    })()

    // ✅ FIX: Untuk time slot 20:00, aktif dari 20:00 sampai tengah malam
    if (timeSlot === "20.00") {
      // Aktif dari 20:00 sampai 23:59
      return currentTimeInMinutes >= slotTimeInMinutes
    }

    const nextSlot = TIME_SLOTS[(slotIndex + 1) % TIME_SLOTS.length]
    const [nextHourStr, nextMinuteStr] = nextSlot.split('.')
    const nextHour = parseInt(nextHourStr)
    const nextMinute = parseInt(nextMinuteStr) || 0
    const nextTimeInMinutes = nextHour * 60 + nextMinute

    return currentTimeInMinutes >= slotTimeInMinutes && currentTimeInMinutes < nextTimeInMinutes
  }, [activeMonth, activeYear])
  
  // =====================================================================
  // === FUNGSI HELPER: PENENTU EDITABLE CELL ===
  // =====================================================================
  const isCellEditable = useCallback((
    cellDate: number,
    status: "OK" | "NG" | "-",
    timeSlot?: string
  ): boolean => {
    const now = new Date()
    const cellDateTime = new Date(activeYear, activeMonth, cellDate)
    
    if (status === "NG") {
      return true
    }
    
    if (cellDateTime.getDate() !== now.getDate() ||
      cellDateTime.getMonth() !== now.getMonth() ||
      cellDateTime.getFullYear() !== now.getFullYear()) {
      if (cellDateTime < now) {
        return false
      }
      return false
    }
    
    if (timeSlot) {
      if (isTimeSlotPassed(cellDate, timeSlot)) {
        return status !== "OK" && status !== "-"
      }
      
      if (isTimeSlotActive(cellDate, timeSlot)) {
        return true
      }
      
      return false
    }
    
    return true
  }, [activeMonth, activeYear, isTimeSlotPassed, isTimeSlotActive])
  
  // === FUNGSI UNTUK MENDAPATKAN MINGGU DALAM BULAN ===
  const getWeeksInMonth = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    const firstDay = new Date(activeYear, activeMonth, 1).getDay()
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
  
  // === FUNGSI UNTUK MENDAPATKAN HARI KERJA PER MINGGU ===
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
  
  const dynamicDates = useMemo(() => {
    const daysInMonth = getDaysInMonth(activeYear, activeMonth)
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [activeMonth, activeYear])
  
  const today = new Date().getDate()
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const isCurrentMonth = activeMonth === currentMonth && activeYear === currentYear
  
  // =====================================================================
  // === DATA CHECKPOINTS (HARDCODED) ===
  // =====================================================================
  
  const DAILY_CHECKPOINTS: DailyCheckPoint[] = useMemo(() => [
    { id: 1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", standard: "Check pengisian C/S 4M", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 1.1, checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di up date di C/S 4M", standard: "Check pengisian C/S 4M", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 2, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 2.1, checkPoint: "Pengisian LKI di lakukan setelah proses inspection dan di isi secara benar...", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)", shift: "B", waktuCheck: "Setiap Hari" },
    { id: 3, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", standard: "      ", shift: "A", waktuCheck: "Setiap Hari" },
    { id: 3.1, checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag...", standard: "      ", shift: "B", waktuCheck: "Setiap Hari" },
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
    { id: 1, no: 1, itemCheck: "BOLPOINT & MARKER", checkPoint: "1A. TERDAPAT STICKER \"E\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 1.1, no: 1, itemCheck: "BOLPOINT & MARKER", checkPoint: "1A. TERDAPAT STICKER \"E\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
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
    { id: 3, no: 3, itemCheck: "CALIPER", checkPoint: "3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 3.1, no: 3, itemCheck: "CALIPER", checkPoint: "3A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 3.2, no: 3, itemCheck: "CALIPER", checkPoint: "3B. ZERO SETTING OK (LAYAR MENUNJUKKAN \"0.00\").", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 3.3, no: 3, itemCheck: "CALIPER", checkPoint: "3B. ZERO SETTING OK (LAYAR MENUNJUKKAN \"0.00\").", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 3.4, no: 3, itemCheck: "CALIPER", checkPoint: "3C. PENGGESER BERGERAK DENGAN LANCAR, TIDAK ADA BAGIAN YANG DEFORMASI, BERKARAT, RUSAK DAN TIDAK ADA BENDA YANG MENEMPEL PADA BAGIAN PENGUKURAN", method: "VISUAL, SENTUH", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 3.5, no: 3, itemCheck: "CALIPER", checkPoint: "3C. PENGGESER BERGERAK DENGAN LANCAR, TIDAK ADA BAGIAN YANG DEFORMASI, BERKARAT, RUSAK DAN TIDAK ADA BENDA YANG MENEMPEL PADA BAGIAN PENGUKURAN", method: "VISUAL, SENTUH", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
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
    { id: 5, no: 5, itemCheck: "STEEL RULER", checkPoint: "5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 5.1, no: 5, itemCheck: "STEEL RULER", checkPoint: "5A. ADA NOMOR REGISTER & KALIBRASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 5.2, no: 5, itemCheck: "STEEL RULER", checkPoint: "5B. STEEL RULER TIDAK BERKARAT DAN ANGKA TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 5.3, no: 5, itemCheck: "STEEL RULER", checkPoint: "5B. STEEL RULER TIDAK BERKARAT DAN ANGKA TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 6, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 6.1, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 6.2, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6B. GAUGE DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 6.3, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6B. GAUGE DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 6.4, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6C. BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 6.5, no: 6, itemCheck: "BENT UP/DOWN GAUGE", checkPoint: "6C. BISA MENDETEKSI KONDISI OK DAN N-OK MELALUI SAMPLE OK DAN N-OK", method: "DICOBA", area: { tensile: true, crossSection: false, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 7, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED (EXPIRED DATE HANYA UNTUK THICKENESS GAUGE)", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 7.1, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED (EXPIRED DATE HANYA UNTUK THICKENESS GAUGE)", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 7.2, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7B. GAUGE / GO NO GO DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 7.3, no: 7, itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkPoint: "7B. GAUGE / GO NO GO DALAM KONDISI BAIK, TIDAK BENT, TIDAK TAJAM DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: true, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 8, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 8.1, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8A. ADA NOMOR REGISTER & VERIFIKASI TIDAK EXPIRED", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 8.2, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8B. POCKET COMPARATOR DALAM KONDISI BAIK, TIDAK RUSAK DAN BISA MELIHAT SECARA JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 8.3, no: 8, itemCheck: "POCKET COMPARATOR", checkPoint: "8B. POCKET COMPARATOR DALAM KONDISI BAIK, TIDAK RUSAK DAN BISA MELIHAT SECARA JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 9, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9A. TIDAK RUSAK / TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 9.1, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9A. TIDAK RUSAK / TERBACA DENGAN JELAS", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 9.2, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9B. ADA STAMP CONTROL DAN STAMP \"CONFIDENTIAL\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 9.3, no: 9, itemCheck: "CRIMPING STANDARD & IS", checkPoint: "9B. ADA STAMP CONTROL DAN STAMP \"CONFIDENTIAL\"", method: "VISUAL", area: { tensile: true, crossSection: true, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 10, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10A. TROLLY DALAM KONDISI BAIK DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 10.1, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10A. TROLLY DALAM KONDISI BAIK DAN TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 10.2, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10B. TEMPAT CUP TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 10.3, no: 10, itemCheck: "TROLLY INSPECTOR", checkPoint: "10B. TEMPAT CUP TIDAK RUSAK", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: true, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 11, no: 11, itemCheck: "LAMPU UV", checkPoint: "11A. ADA 2 LAMPU DI AREA INSPEKSI UV", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 11.1, no: 11, itemCheck: "LAMPU UV", checkPoint: "11A. ADA 2 LAMPU DI AREA INSPEKSI UV", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 11.2, no: 11, itemCheck: "LAMPU UV", checkPoint: "11B. SAAT DIOPERASIKAN LAMPU MENYALA TERANG (TIDAK ADA LAMPU LED YANG MATI ≥ 3 PCS DALAM LENSA UV)", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "A", schedule: "Setiap Hari" },
    { id: 11.3, no: 11, itemCheck: "LAMPU UV", checkPoint: "11B. SAAT DIOPERASIKAN LAMPU MENYALA TERANG (TIDAK ADA LAMPU LED YANG MATI ≥ 3 PCS DALAM LENSA UV)", method: "VISUAL", area: { tensile: false, crossSection: false, cutting: false, pa: true }, shift: "B", schedule: "Setiap Hari" },
    { id: 12, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12A. TOMBOL ON OFF BERFUNGSI, TIDAK RUSAK DAN LAMPU INDIKATOR MENYALA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 12.1, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12A. TOMBOL ON OFF BERFUNGSI, TIDAK RUSAK DAN LAMPU INDIKATOR MENYALA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
    { id: 12.2, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12B. TIDAK BERBAU ASAP DAN STOP KONTAK TERPASANG SEMPURNA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "A", schedule: "Setiap Hari" },
    { id: 12.3, no: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkPoint: "12B. TIDAK BERBAU ASAP DAN STOP KONTAK TERPASANG SEMPURNA", method: "VISUAL", area: { tensile: false, crossSection: true, cutting: false, pa: false }, shift: "B", schedule: "Setiap Hari" },
  ], [])
  
const CS_REMOVE_TOOL_ITEMS: CSRemoveToolItem[] = useMemo(() => [

  // NO 1 - PA
  { id: "1-X-1-A", dbId: 1102, no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "1-X-1-B", dbId: 1103, no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "1-X-2-A", dbId: 1104, no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "1-X-2-B", dbId: 1105, no: 1, toolType: "PA", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "1-X-3-A", dbId: 1106, no: 1, toolType: "PA", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "1-X-3-B", dbId: 1107, no: 1, toolType: "PA", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "1-X-4-A", dbId: 1108, no: 1, toolType: "PA", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "1-X-4-B", dbId: 1109, no: 1, toolType: "PA", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 2 - DLI
  { id: "2-X-1-A", dbId: 1110, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "2-X-1-B", dbId: 1111, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "2-X-2-A", dbId: 1112, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "2-X-2-B", dbId: 1113, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "2-X-3-A", dbId: 1114, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "2-X-3-B", dbId: 1115, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "2-X-4-A", dbId: 1116, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "2-X-4-B", dbId: 1117, no: 2, toolType: "DLI", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 3 - 1-85
  { id: "3-X-1-A", dbId: 1118, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "3-X-1-B", dbId: 1119, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "3-X-2-A", dbId: 1120, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "3-X-2-B", dbId: 1121, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "3-X-3-A", dbId: 1122, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "3-X-3-B", dbId: 1123, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "3-X-4-A", dbId: 1124, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "3-X-4-B", dbId: 1125, no: 3, toolType: "1-85", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 4 - 1-73
  { id: "4-X-1-A", dbId: 1126, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "4-X-1-B", dbId: 1127, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "4-X-2-A", dbId: 1128, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "4-X-2-B", dbId: 1129, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "4-X-3-A", dbId: 1130, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "4-X-3-B", dbId: 1131, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "4-X-4-A", dbId: 1132, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "4-X-4-B", dbId: 1133, no: 4, toolType: "1-73", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 5 - 1-79
  { id: "5-X-1-A", dbId: 1134, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "5-X-1-B", dbId: 1135, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "5-X-2-A", dbId: 1136, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "5-X-2-B", dbId: 1137, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "5-X-3-A", dbId: 1138, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "5-X-3-B", dbId: 1139, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "5-X-4-A", dbId: 1140, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "5-X-4-B", dbId: 1141, no: 5, toolType: "1-79", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 6 - 1-83A
  { id: "6-X-1-A", dbId: 1142, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "6-X-1-B", dbId: 1143, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "6-X-2-A", dbId: 1144, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "6-X-2-B", dbId: 1145, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "6-X-3-A", dbId: 1146, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "6-X-3-B", dbId: 1147, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "6-X-4-A", dbId: 1148, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "6-X-4-B", dbId: 1149, no: 6, toolType: "1-83A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 7 - 1-114
  { id: "7-X-1-A", dbId: 1150, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "7-X-1-B", dbId: 1151, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "7-X-2-A", dbId: 1152, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "7-X-2-B", dbId: 1153, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "7-X-3-A", dbId: 1154, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "7-X-3-B", dbId: 1155, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "7-X-4-A", dbId: 1156, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "7-X-4-B", dbId: 1157, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 8 - 5
  { id: "8-X-1-A", dbId: 1158, no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "8-X-1-B", dbId: 1159, no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "8-X-2-A", dbId: 1160, no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "8-X-2-B", dbId: 1161, no: 8, toolType: "5", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "8-X-3-A", dbId: 1162, no: 8, toolType: "5", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "8-X-3-B", dbId: 1163, no: 8, toolType: "5", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "8-X-4-A", dbId: 1164, no: 8, toolType: "5", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "8-X-4-B", dbId: 1165, no: 8, toolType: "5", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 9 - THNH
  { id: "9-X-1-A", dbId: 1166, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "9-X-1-B", dbId: 1167, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "9-X-2-A", dbId: 1168, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "9-X-2-B", dbId: 1169, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "9-X-3-A", dbId: 1170, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "9-X-3-B", dbId: 1171, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "9-X-4-A", dbId: 1172, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "9-X-4-B", dbId: 1173, no: 9, toolType: "THNH", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 10 - 1-08
  { id: "10-X-1-A", dbId: 1174, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "10-X-1-B", dbId: 1175, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "10-X-2-A", dbId: 1176, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "10-X-2-B", dbId: 1177, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "10-X-3-A", dbId: 1178, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "10-X-3-B", dbId: 1179, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "10-X-4-A", dbId: 1180, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "10-X-4-B", dbId: 1181, no: 10, toolType: "1-08", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 11 - 3-07
  { id: "11-X-1-A", dbId: 1182, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "11-X-1-B", dbId: 1183, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "11-X-2-A", dbId: 1184, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "11-X-2-B", dbId: 1185, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "11-X-3-A", dbId: 1186, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "11-X-3-B", dbId: 1187, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "11-X-4-A", dbId: 1188, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "11-X-4-B", dbId: 1189, no: 11, toolType: "3-07", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 12 - 1-35
  { id: "12-X-1-A", dbId: 1190, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "12-X-1-B", dbId: 1191, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "12-X-2-A", dbId: 1192, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "12-X-2-B", dbId: 1193, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "12-X-3-A", dbId: 1194, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "12-X-3-B", dbId: 1195, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "12-X-4-A", dbId: 1196, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "12-X-4-B", dbId: 1197, no: 12, toolType: "1-35", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 13 - 1-105
  { id: "13-X-1-A", dbId: 1198, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "13-X-1-B", dbId: 1199, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "13-X-2-A", dbId: 1200, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "13-X-2-B", dbId: 1201, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "13-X-3-A", dbId: 1202, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "13-X-3-B", dbId: 1203, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "13-X-4-A", dbId: 1204, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "13-X-4-B", dbId: 1205, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 14 - TLC
  { id: "14-X-1-A", dbId: 1206, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "14-X-1-B", dbId: 1207, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "14-X-2-A", dbId: 1208, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "14-X-2-B", dbId: 1209, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "14-X-3-A", dbId: 1210, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "14-X-3-B", dbId: 1211, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "14-X-4-A", dbId: 1212, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "14-X-4-B", dbId: 1213, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 15 - EXTRACTION JIG
  { id: "15-R-1-A", dbId: 1214, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-G-1-A", dbId: 1215, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-W-1-A", dbId: 1216, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-Y-1-A", dbId: 1217, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Tidak patah / bengkok", shift: "A" },

  { id: "15-W-1-B", dbId: 1218, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "15-R-1-B", dbId: 1219, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "15-G-1-B", dbId: 1220, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Tidak patah / bengkok", shift: "B" },

], []);
  
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
    { id: 7, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift: "A", frequency: "1x /Bulan", judge: "   " },
    { id: 7.1, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata.", shift: "B", frequency: "1x /Bulan", judge: "   " },
  ], [])
  
  // =====================================================================
  // === FUNGSI GET RESULT ===
  // =====================================================================
  const getResult = useCallback((date: number, id: number | string, shift: "A" | "B", timeSlot?: string) => {
    const dateKey = getDateKey(date)
    const key = timeSlot ? `${id}-${shift}-${timeSlot}` : `${id}-${shift}`
    return results[dateKey]?.[key] || null
  }, [results, getDateKey])
  
  const getCSRemoveResult = useCallback((date: number, itemId: string) => {
    const dateKey = getDateKey(date)
    return results[dateKey]?.[itemId] || null
  }, [results, getDateKey])
  
  const getResultDailyCheckIns = useCallback((weekIndex: number, dayIndex: number, checkpointId: number, shift: "A" | "B") => {
    if (!getWeeksInMonth[weekIndex]) return null
    const day = getWeeksInMonth[weekIndex].days[dayIndex]
    if (!day) return null
    const dateKey = getDateKey(day.date)
    const checkpointKey = `${checkpointId}-${shift}`
    return results[dateKey]?.[checkpointKey] || null
  }, [results, getDateKey, getWeeksInMonth])
  
  const getGLSignature = useCallback((date: number, shift: "A" | "B", type: "gl" | "eso") => {
    const dateKey = getDateKey(date)
    const signatures = type === "gl" ? glSignaturesGL : glSignaturesESO
    return signatures[dateKey]?.[shift] || "-"
  }, [glSignaturesGL, glSignaturesESO, getDateKey])
  
  // =====================================================================
  // === HANDLE GL SIGNATURE CHANGE ===
  // =====================================================================
  const handleGLSignatureChange = async (
    date: number,
    shift: "A" | "B",
    value: "-" | "☑",
    type: "gl" | "eso"
  ) => {
    if (user?.role !== "group-leader-qa") return
    const dateKey = getDateKey(date)
    if (type === "gl") {
      const newSignatures = {
        ...glSignaturesGL,
        [dateKey]: {
          ...glSignaturesGL[dateKey],
          [shift]: value
        }
      }
      setGlSignaturesGL(newSignatures)
    } else {
      const newSignatures = {
        ...glSignaturesESO,
        [dateKey]: {
          ...glSignaturesESO[dateKey],
          [shift]: value
        }
      }
      setGlSignaturesESO(newSignatures)
    }
    
    await saveSignatureToDB(dateKey, shift, value)
  }
  
  // =====================================================================
  // === HANDLE STATUS CHANGE ===
  // =====================================================================
  const handleStatusChange = useCallback(async (
    date: number,
    id: number | string,
    shift: "A" | "B",
    newStatus: "OK" | "NG" | "-",
    type: ViewMode,
    timeSlot?: string
  ) => {
    const baseId = typeof id === "number" ? Math.floor(id) : id
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${baseId}-${shift}-${timeSlot}` : `${baseId}-${shift}`
    const currentStatus = results[dateKey]?.[itemKey]?.status || "-"
    const isPassed = timeSlot ? isTimeSlotPassed(date, timeSlot) : false

    if (isPassed && currentStatus === "OK" && newStatus !== "OK") {
      console.warn("❌ Cannot change OK status after slot has passed")
      return
    }
    if (isPassed && currentStatus === "-" && newStatus !== "-") {
      console.warn("❌ Cannot fill empty slot after it has passed")
      return
    }

    const newResults = JSON.parse(JSON.stringify(results))

    if (newStatus === "-") {
      if (newResults[dateKey]?.[itemKey]) {
        delete newResults[dateKey][itemKey]
        if (Object.keys(newResults[dateKey]).length === 0) delete newResults[dateKey]
      }
      setResults(newResults)
      await saveResultToDB(baseId, dateKey, shift, newStatus, undefined, undefined, timeSlot)

    } else if (newStatus === "NG") {
      const existing = newResults[dateKey]?.[itemKey]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemKey] = {
        status: "NG",
        ngCount: 1,
        items: existing?.items || [],
        notes: existing?.notes || "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: existing?.ngDescription || "",
        ngDepartment: existing?.ngDepartment || "QA"
      }
      setResults(newResults)
      // ✅ FIX: Pass timeSlot ke ngModal
      setNgModal({
        date,
        checkpoint: { id, shift },
        shift,
        type,
        notes: existing?.ngDescription || "",
        department: existing?.ngDepartment || "QA",
        timeSlot  // ✅ Simpan timeSlot agar saveNgReport bisa pakai
      })

    } else {
      // Status "OK"
      const existing = newResults[dateKey]?.[itemKey]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][itemKey] = {
        status: "OK",
        ngCount: 0,
        items: existing?.items || [],
        notes: existing?.notes || "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: "",
        ngDepartment: ""
      }
      setResults(newResults)
      await saveResultToDB(baseId, dateKey, shift, newStatus, undefined, undefined, timeSlot)
    }
  }, [results, user, getDateKey, isTimeSlotPassed])
  
  // =====================================================================
  // === HANDLE STATUS CHANGE UNTUK CS REMOVE TOOL ===
  // =====================================================================
  const handleCSRemoveStatusChange = useCallback(async (
    date: number,
    item: CSRemoveToolItem,
    newStatus: "OK" | "NG" | "-"
  ) => {
    const dateKey = getDateKey(date);
    const newResults = JSON.parse(JSON.stringify(results));

    let actualItemId = item.dbId;
    if (!actualItemId) {
      const foundItem = CS_REMOVE_TOOL_ITEMS.find(i => i.id === item.id && i.shift === item.shift);
      if (foundItem?.dbId) {
        actualItemId = foundItem.dbId;
      } else {
        setError(`Item ${item.id} tidak memiliki ID database.`);
        return;
      }
    }

    if (newStatus === "-") {
      if (newResults[dateKey]?.[item.id]) {
        delete newResults[dateKey][item.id];
        if (Object.keys(newResults[dateKey]).length === 0) delete newResults[dateKey];
      }
      setResults(newResults);
      await saveResultToDB(actualItemId, dateKey, item.shift, newStatus);

    } else if (newStatus === "NG") {
      const existing = newResults[dateKey]?.[item.id];
      newResults[dateKey] = newResults[dateKey] || {};
      newResults[dateKey][item.id] = {
        status: "NG", ngCount: 1, items: [], notes: "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: existing?.ngDescription || "",
        ngDepartment: existing?.ngDepartment || "QA"
      };
      setResults(newResults);
      setNgModal({
        date,
        checkpoint: { id: item.id, dbId: actualItemId },
        shift: item.shift,
        type: "cs-remove-tool",
        notes: existing?.ngDescription || "",
        department: existing?.ngDepartment || "QA"
        // CS Remove Tool tidak pakai timeSlot, jadi tidak perlu set
      });

    } else {
      const existing = newResults[dateKey]?.[item.id];
      newResults[dateKey] = newResults[dateKey] || {};
      newResults[dateKey][item.id] = {
        status: "OK", ngCount: 0, items: [], notes: "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: "", ngDepartment: ""
      };
      setResults(newResults);
      await saveResultToDB(actualItemId, dateKey, item.shift, newStatus);
    }
  }, [results, user, CS_REMOVE_TOOL_ITEMS, getDateKey]);
  
  // =====================================================================
  // === HANDLE STATUS CHANGE UNTUK DAILY CHECK INS ===
  // =====================================================================
  const handleStatusChangeDailyCheckIns = useCallback(async (
    weekIndex: number,
    dayIndex: number,
    checkpointId: number,  // float: 1, 1.1, 2, 2.1, dst
    shift: "A" | "B",
    newStatus: "OK" | "NG" | "-"
  ) => {
    if (!getWeeksInMonth[weekIndex]) return
    const day = getWeeksInMonth[weekIndex].days[dayIndex]
    if (!day) return
    const date = day.date
    const dateKey = getDateKey(date)

    const intCheckpointId = Math.floor(checkpointId)
    const checkpointKey = `${checkpointId}-${shift}`
    const timeSlotForDailyCheckIns = String(checkpointId)

    const newResults = JSON.parse(JSON.stringify(results))

    if (newStatus === "-") {
      if (newResults[dateKey]?.[checkpointKey]) {
        delete newResults[dateKey][checkpointKey]
        if (Object.keys(newResults[dateKey]).length === 0) {
          delete newResults[dateKey]
        }
      }
      setResults(newResults)
      // ✅ Langsung save untuk status "-" (delete)
      await saveResultToDB(intCheckpointId, dateKey, shift, newStatus, undefined, undefined, timeSlotForDailyCheckIns)

    } else if (newStatus === "NG") {
      const existing = newResults[dateKey]?.[checkpointKey]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][checkpointKey] = {
        status: "NG",
        ngCount: 1,
        items: [],
        notes: "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: existing?.ngDescription || "",
        ngDepartment: existing?.ngDepartment || "QA"
      }
      // ✅ Update state, tapi JANGAN save ke DB — biarkan saveNgReport yang save
      setResults(newResults)
      setNgModal({
        weekIndex,
        dayIndex,
        checkpoint: { id: checkpointId, shift },
        shift,
        type: "daily-check-ins",
        notes: existing?.ngDescription || "",
        department: existing?.ngDepartment || "QA"
      })

    } else {
      // Status "OK"
      const existing = newResults[dateKey]?.[checkpointKey]
      newResults[dateKey] = newResults[dateKey] || {}
      newResults[dateKey][checkpointKey] = {
        status: "OK",
        ngCount: 0,
        items: [],
        notes: "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: "",
        ngDepartment: ""
      }
      setResults(newResults)
      // ✅ Langsung save untuk status "OK"
      await saveResultToDB(intCheckpointId, dateKey, shift, newStatus, undefined, undefined, timeSlotForDailyCheckIns)
    }
  }, [results, user, getWeeksInMonth, getDateKey])
  
  // =====================================================================
  // === RENDER STATUS CELL ===
  // =====================================================================
  const renderStatusCell = useCallback((date: number, checkpoint: any, timeSlot?: string) => {
    let id = checkpoint.id
    let shift = checkpoint.shift
    const baseId = Math.floor(id)
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${baseId}-${shift}-${timeSlot}` : `${baseId}-${shift}`
    const storedStatus = results[dateKey]?.[itemKey]?.status || "-"
    const currentStatus = storedStatus
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-", timeSlot)
    
    const getBgColor = (status: string) => {
      if (status === "OK") return "#4caf50"
      if (status === "NG") return "#f44336"
      return "#9e9e9e"
    }
    
    if (currentStatus !== "-") {
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
              textAlign: 'center',
              borderRadius: '4px'
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
        return (
          <span
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
    
    if (!isEditable) {
      return <span style={{ color: "#9e9e9e", fontSize: '12px' }}>-</span>
    }
    
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
          textAlign: 'center',
          borderRadius: '4px'
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
  }, [results, isCellEditable, handleStatusChange, viewMode, getDateKey])
  
  // =====================================================================
  // === RENDER STATUS CELL UNTUK CS REMOVE TOOL ===
  // =====================================================================
  const renderCSRemoveStatusCell = useCallback((date: number, item: CSRemoveToolItem) => {
    const result = getCSRemoveResult(date, item.id)
    const dateKey = getDateKey(date)
    const currentStatus = result?.status || results[dateKey]?.[item.id]?.status || "-"
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-")
    
    const getBgColor = (status: string) => {
      if (status === "OK") return "#4caf50"
      if (status === "NG") return "#f44336"
      return "#9e9e9e"
    }
    
    if (currentStatus === "-" && !isEditable) {
      return <span style={{ color: "#9e9e9e" }}>-</span>
    }
    
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
          onChange={(e) => handleCSRemoveStatusChange(date, item, e.target.value as "OK" | "NG" | "-")}
        >
          <option value="-">-</option>
          <option value="OK">✓ OK</option>
          <option value="NG">✗ NG</option>
        </select>
      )
    } else {
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
  
  // =====================================================================
  // === RENDER STATUS CELL UNTUK DAILY CHECK INS ===
  // =====================================================================
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
    
    const isEditable = isCellEditable(date, currentStatus as "OK" | "NG" | "-")
    
    const getBgColor = (status: string) => {
      if (status === "OK") return "#4caf50"
      if (status === "NG") return "#f44336"
      return "#9e9e9e"
    }
    
    if (currentStatus === "-" && !isEditable) {
      return <span style={{ color: "#9e9e9e" }}>-</span>
    }
    
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
  
  // =====================================================================
  // === HELPER FUNCTIONS ===
  // =====================================================================
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
  
  const departments = ["QA", "Produksi", "Maintenance", "Logistik", "Engineering"]
  
  // =====================================================================
  // === NG MODAL STATE ===
  // =====================================================================
  const [ngModal, setNgModal] = useState<{
    date?: number
    weekIndex?: number
    dayIndex?: number
    checkpoint: any
    shift: "A" | "B"
    type: ViewMode
    notes: string
    department: string
    timeSlot?: string  // ✅ TAMBAHAN: simpan timeSlot di modal state
  } | null>(null)
  
  // =====================================================================
  // === SAVE NG REPORT ===
  // =====================================================================
  const saveNgReport = async () => {
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

    const itemIdToSave = checkpoint.dbId ?? Math.floor(Number(checkpoint.id))
    const baseId = Math.floor(Number(checkpoint.id))

    // ✅ FIX: Prioritaskan ngModal.timeSlot (untuk CC Stripping & view mode lain yang punya timeSlot)
    //         Fallback ke checkpoint.id string hanya untuk daily-check-ins
    const timeSlotForSave = ngModal.timeSlot !== undefined
      ? ngModal.timeSlot                          // CC Stripping, dll: pakai timeSlot dari modal
      : (type === "daily-check-ins"
          ? String(checkpoint.id)                 // Daily Check Ins: pakai checkpoint.id sebagai timeSlot
          : undefined)                            // Tipe lain tanpa timeSlot

    // Bentuk itemKey yang konsisten dengan handleStatusChange
    const itemKey = timeSlotForSave
      ? `${baseId}-${shift}-${timeSlotForSave}`
      : `${baseId}-${shift}`

    // Update state dengan notes dan department
    const newResults = JSON.parse(JSON.stringify(results))
    newResults[dateKey] = newResults[dateKey] || {}
    if (newResults[dateKey][itemKey]) {
      newResults[dateKey][itemKey].ngDescription = notes
      newResults[dateKey][itemKey].ngDepartment = department
    } else {
      newResults[dateKey][itemKey] = {
        status: "NG", ngCount: 1, items: [], notes: "",
        submittedAt: new Date().toISOString(),
        submittedBy: user?.fullName || user?.username || "Unknown",
        ngDescription: notes, ngDepartment: department
      }
    }

    setResults(newResults)

    // ✅ Hanya satu kali save ke DB dengan timeSlot yang benar
    await saveResultToDB(itemIdToSave, dateKey, shift, "NG", notes, department, timeSlotForSave)
    setNgModal(null)
  }
  
  // =====================================================================
  // === RENDER VIEW MODE BUTTONS ===
  // =====================================================================
  const renderViewModeButtons = () => {
    return allowedViewModes.map((mode) => {
      const { label } = VIEW_MODE_BUTTONS[mode]
      return (
        <button
          key={mode}
          className={`btn-mode ${viewMode === mode ? "active" : ""}`}
          onClick={() => setViewMode(mode)}
        >
          {label}
        </button>
      )
    })
  }
  
  // =====================================================================
  // === RENDER ACTIVE TITLE ===
  // =====================================================================
  const renderActiveTitle = () => {
    return VIEW_MODE_LABELS[viewMode]
  }
  
  useEffect(() => {
    setSelectedWeek(1)
  }, [activeMonth, activeYear])
  
  if (!user) return null
  
  return (
    <>
      <Sidebar userName={user.fullName || user.username || " "} />
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
          {renderActiveTitle()}
          <div className="role-info">
            Role: <span className="role-badge">{user.role === "group-leader-qa" ? "Group Leader" : "Inspector"}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
          {renderViewModeButtons()}
          
          {/* ✅ AREA FILTER - Tanpa opsi "Semua Area", default area aktif */}
          <AreaFilter
            categoryCode={categoryCode}
            selectedArea={selectedArea}
            onAreaChange={setSelectedArea}
            isLoading={isLoading}
            defaultAreaCode={DEFAULT_AREA_BY_CATEGORY[categoryCode]}
          />
        </div>
        
        {/* ERROR MESSAGE */}
        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '15px',
            borderLeft: '4px solid #c33'
          }}>
            <strong>Error: </strong> {error}
          </div>
        )}
        
        {/* LOADING INDICATOR */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '4px solid #1976d2',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ marginTop: '10px', color: '#666' }}>Memuat data dari PostgreSQL...</p>
          </div>
        )}
        
        {/* NAVIGASI BULAN */}
        {(viewMode === "cc-stripping" || viewMode === "pressure-jig" ||
          viewMode === "daily-check-ins" || viewMode === "cs-remove-tool") && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <button
              onClick={() => changeMonth(-1)}
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
              <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                {getMonthName(activeMonth)} {activeYear}
              </span>
              
              {viewMode === "cc-stripping" && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Minggu ke: </span>
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
        
        {/* TABLE WRAPPER */}
        <div className="table-wrapper">
          <table className="status-table">
            <thead>
              {viewMode === "daily" ? (
                <>
                  <tr>
                    <th rowSpan={2}>Check Point</th>
                    <th rowSpan={2}>Standard / Metode</th>
                    <th rowSpan={2}>Waktu Check</th>
                    <th rowSpan={2}>Shift</th>
                    <th colSpan={dynamicDates.length} className="month-header">
                      {getMonthName(activeMonth)} {activeYear}
                    </th>
                  </tr>
                  <tr>
                    {dynamicDates.map((date) => (
                      <th key={date} className={isCurrentMonth && date === today ? "col-date-today" : "col-date-pa"}>
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
                    <th colSpan={3 + getSelectedWeekDays.length * TIME_SLOTS.length} className="month-header">
                      {getMonthName(activeMonth)} {activeYear}
                    </th>
                  </tr>
                  <tr>
                    <th rowSpan={2} className="col-mesin">MESIN</th>
                    <th rowSpan={2} className="col-kind">KIND</th>
                    <th rowSpan={2} className="col-size">SIZE</th>
                    {getSelectedWeekDays.map((day, index) => (
                      <th key={index} colSpan={TIME_SLOTS.length}>
                        {day.dayName} {day.date}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {getSelectedWeekDays.flatMap((day, dayIndex) =>
                      TIME_SLOTS.map((timeSlot, timeIndex) => (
                        <th key={`${dayIndex}-${timeIndex}`} className="col-time">
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
              {viewMode === "daily" ? (
                Array.from({ length: 14 }, (_, i) => i + 1).map((id) => {
                  const shiftA = DAILY_CHECKPOINTS.find((cp) => cp.id === id && cp.shift === "A")
                  const shiftB = DAILY_CHECKPOINTS.find((cp) => cp.id === id + 0.1 && cp.shift === "B")
                  if (!shiftA || !shiftB) return null
                  return (
                    <React.Fragment key={id}>
                      <tr>
                        <td rowSpan={2}>{shiftA!.checkPoint}</td>
                        <td>{shiftA!.standard}</td>
                        <td>{shiftA!.waktuCheck}</td>
                        <td>{shiftA!.shift}</td>
                        {dynamicDates.map((date) => (
                          <td key={`A-${id}-${date}`} className={isCurrentMonth && date === today ? "bg-blue-50" : ""}>
                            {renderStatusCell(date, shiftA!)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td>{shiftB!.standard}</td>
                        <td>{shiftB!.waktuCheck}</td>
                        <td>{shiftB!.shift}</td>
                        {dynamicDates.map((date) => (
                          <td key={`B-${id}-${date}`} className={isCurrentMonth && date === today ? "bg-blue-50" : ""}>
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
                              const dateKey = getDateKey(day.date)
                              const checkpointKey = `${checkpoint.id}-${checkpoint.shift}`
                              const currentStatus = result?.status || results[dateKey]?.[checkpointKey]?.status || "-"
                              
                              const isToday = (() => {
                                const now = new Date()
                                const cellDate = new Date(activeYear, activeMonth, day.date)
                                return cellDate.getDate() === now.getDate() &&
                                  cellDate.getMonth() === now.getMonth() &&
                                  cellDate.getFullYear() === now.getFullYear()
                              })()
                              
                              if (!needed) {
                                return <td key={`${wIdx}-${dIdx}`} className="col-date-cell bg-gray-200"></td>
                              }
                              
                              if (isToday) {
                                return (
                                  <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                    {renderStatusCellDailyCheckIns(wIdx, dIdx, checkpoint)}
                                  </td>
                                )
                              }
                              
                              if (result && !isToday) {
                                return (
                                  <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                    <span
                                      className={`status-badge ${
                                        result.status === "OK" ? "status-badge-ok" : "status-badge-ng"
                                      } text-xs px-1 py-0.5 rounded cursor-pointer inline-block`}
                                      onClick={() => {
                                        if (result.status === "NG") {
                                          setNgModal({
                                            weekIndex: wIdx,
                                            dayIndex: dIdx,
                                            checkpoint,
                                            shift: checkpoint.shift,
                                            type: "daily-check-ins",
                                            notes: result.ngDescription || "  ",
                                            department: result.ngDepartment || "QA"
                                          })
                                        }
                                      }}
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
                        <td rowSpan={2}>{shiftA!.machine}</td>
                        <td rowSpan={2}>{shiftA!.kind}</td>
                        <td rowSpan={2}>{shiftA!.size}</td>
                        {getSelectedWeekDays.flatMap((day, dayIndex) =>
                          TIME_SLOTS.map((timeSlot) => (
                            <td key={`${dayIndex}-${timeSlot}-A`}>
                              {renderStatusCell(day.date, shiftA!, timeSlot)}
                            </td>
                          ))
                        )}
                      </tr>
                      <tr>
                        {getSelectedWeekDays.flatMap((day, dayIndex) =>
                          TIME_SLOTS.map((timeSlot) => (
                            <td key={`${dayIndex}-${timeSlot}-B`}>
                              {renderStatusCell(day.date, shiftB!, timeSlot)}
                            </td>
                          ))
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
                                {renderCSRemoveStatusCell(date, item)}
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
                    <td rowSpan={2}></td>
                    <td>A</td>
                    {dynamicDates.map((date) => {
                      const value = getGLSignature(date, "A", "gl")
                      return (
                        <td key={`gl-A-${date}`} className={isCurrentMonth && date === today ? "bg-blue-50" : ""}>
                          {user?.role === "group-leader-qa" ? (
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
                              onChange={(e) => handleGLSignatureChange(date, "A", e.target.value as "-" | "☑", "gl")}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          ) : (
                            <span>{value}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>B</td>
                    {dynamicDates.map((date) => {
                      const value = getGLSignature(date, "B", "gl")
                      return (
                        <td key={`gl-B-${date}`} className={isCurrentMonth && date === today ? "bg-blue-50" : ""}>
                          {user?.role === "group-leader-qa" ? (
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
                              onChange={(e) => handleGLSignatureChange(date, "B", e.target.value as "-" | "☑", "gl")}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          ) : (
                            <span>{value}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {/* === Baris: Verifikasi dan Tanda tangan ESO === */}
                  <tr>
                    <td colSpan={2} rowSpan={2} className="border text-xs font-bold text-center bg-gray-50 py-2">
                      Verifikasi dan Tanda tangan ESO (Setiap Hari Selasa & Kamis)
                    </td>
                    <td rowSpan={2}></td>
                    <td>A</td>
                    {dynamicDates.map((date) => {
                      const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
                      const isSelasaKamis = dayOfWeek === 2 || dayOfWeek === 4
                      const value = getGLSignature(date, "A", "eso")
                      
                      if (!isSelasaKamis) {
                        return <td key={`eso-A-${date}`} className="border text-xs"></td>
                      }
                      
                      return (
                        <td key={`eso-A-${date}`} className={isCurrentMonth && date === today ? "bg-blue-50" : ""}>
                          {user?.role === "group-leader-qa" ? (
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
                              onChange={(e) => handleGLSignatureChange(date, "A", e.target.value as "-" | "☑", "eso")}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          ) : (
                            <span>{value}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>B</td>
                    {dynamicDates.map((date) => {
                      const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
                      const isSelasaKamis = dayOfWeek === 2 || dayOfWeek === 4
                      const value = getGLSignature(date, "B", "eso")
                      
                      if (!isSelasaKamis) {
                        return <td key={`eso-B-${date}`} className="border text-xs"></td>
                      }
                      
                      return (
                        <td key={`eso-B-${date}`} className={isCurrentMonth && date === today ? "bg-blue-50" : ""}>
                          {user?.role === "group-leader-qa" ? (
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
                              onChange={(e) => handleGLSignatureChange(date, "B", e.target.value as "-" | "☑", "eso")}
                            >
                              <option value="-">-</option>
                              <option value="☑">☑</option>
                            </select>
                          ) : (
                            <span>{value}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* MODAL NG */}
      {ngModal && (
        <div className="ng-modal-overlay">
          <div className="ng-modal">
            <h3>Edit Laporan Kondisi NG</h3>
            <div className="ng-form-group">
              <label>Keterangan NG: </label>
              <textarea
                value={ngModal.notes}
                onChange={(e) => setNgModal({ ...ngModal, notes: e.target.value })}
                rows={3}
                placeholder="Deskripsikan kondisi NG..."
              />
            </div>
            <div className="ng-form-group">
              <label>Departemen Tujuan: </label>
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
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
          background: #1e88e5;
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
          color: #666;
          font-weight: bold;
          margin-bottom: 10px;
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
        .bg-blue-50 {
          background-color: #e3f2fd !important;
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

        /* RESPONSIVE IMPROVEMENTS */
        @media (max-width: 1024px) {
          .page-content {
            padding-left: 70px;
            padding-top: 20px;
            padding-right: 16px;
            padding-bottom: 16px;
          }

          .header h1 {
            font-size: 1.3rem;
          }

          .button-group {
            gap: 8px;
            padding: 12px;
            margin-bottom: 18px;
          }

          .btn-mode {
            padding: 8px 16px;
            font-size: 0.85rem;
          }

          .status-table {
            font-size: 0.54rem;
            line-height: 1.05;
          }
          
          .status-table th,
          .status-table td {
            padding: 0.5px 0.3px;
            font-size: 0.54rem;
            border: 0.5px solid #cbd5e1;
            height: auto;
          }

          .status-table th {
            padding: 1px 0.3px;
            font-size: 0.54rem;
            background: #f1f5f9;
            color: #334155;
            font-weight: 600;
          }

          .status-table th,
          .status-table td {
            padding: 6px 5px;
          }

          .col-machine {
            min-width: 80px;
          }
          
          .col-kind {
            min-width: 70px;
          }

          .status-dropdown {
            font-size: 11px;
          }
        }

        @media (max-width: 768px) {
          .page-content {
            padding-left: 16px;
            padding-top: 16px;
            padding-right: 12px;
            padding-bottom: 12px;
            max-width: 100%;
          }

          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
          }

          .header h1 {
            font-size: 1.1rem;
          }

          .role-info {
            font-size: 0.85rem;
            gap: 10px;
            margin-bottom: 8px;
          }

          .role-badge {
            font-size: 0.8rem;
            padding: 4px 10px;
          }

          .button-group {
            gap: 6px;
            padding: 10px;
            margin-bottom: 16px;
            flex-wrap: wrap;
          }

          .btn-mode {
            padding: 7px 12px;
            font-size: 0.75rem;
          }

          .month-header {
            font-size: 0.95rem;
            padding: 6px 0;
          }

          .status-table {
            font-size: 0.75rem;
          }

          .status-table th,
          .status-table td {
            padding: 5px 4px;
            font-size: 0.7rem;
          }

          .status-table th {
            font-size: 0.7rem;
            padding: 4px 4px;
          }

          .col-machine {
            min-width: 70px;
          }
          
          .col-kind {
            min-width: 60px;
          }

          .col-size {
            min-width: 40px;
          }

          .col-shift,
          .col-waktu,
          .col-standard {
            min-width: 60px;
          }

          .col-date-cell {
            min-width: 30px;
            height: 30px;
          }

          .status-dropdown {
            font-size: 10px;
          }

          .status-badge {
            font-size: 10px;
            padding: 2px 4px;
          }

          /* Modal responsive */
          .ng-modal {
            width: 95%;
            max-width: 450px;
            padding: 16px;
          }

          .ng-modal h3 {
            font-size: 1rem;
          }

          .ng-form-group {
            margin-bottom: 12px;
          }

          .ng-form-group label {
            font-size: 0.9rem;
          }

          .ng-form-group textarea,
          .ng-form-group select {
            font-size: 0.85rem;
            padding: 6px;
          }
        }

        @media (max-width: 600px) {
          .page-content {
            padding-left: 6px;
            padding-top: 8px;
            padding-right: 6px;
            padding-bottom: 8px;
            max-width: 100%;
            width: 100%;
            background: #fafbfc;
          }

          .header {
            padding: 8px 8px;
            gap: 5px;
            margin-bottom: 8px;
            border-radius: 5px;
            background: #1976d2;
            color: white;
            flex-direction: column;
            align-items: flex-start;
          }

          .header h1 {
            font-size: 0.75rem;
            font-weight: 700;
            color: white;
            margin: 0;
            line-height: 1.1;
          }

          .role-info {
            font-size: 0.6rem;
            gap: 4px;
            margin-bottom: 0;
            flex-wrap: wrap;
            color: white;
          }

          .role-info span {
            color: white;
          }

          .role-badge {
            font-size: 0.55rem;
            padding: 2px 6px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-weight: 600;
          }

          .button-group {
            gap: 5px;
            padding: 6px;
            margin-bottom: 8px;
            flex-wrap: wrap;
            background: white;
            border-radius: 3px;
            border: 1px solid #e2e8f0;
          }

          .btn-mode {
            padding: 5px 8px;
            font-size: 0.6rem;
            border-radius: 3px;
            font-weight: 600;
            min-height: 28px;
            flex: 1;
            min-width: 70px;
            text-align: center;
          }

          .header {
            padding: 14px;
            gap: 10px;
            margin-bottom: 14px;
            border-radius: 8px;
            background: #1976d2;
            color: white;
          }

          .header h1 {
            font-size: 1rem;
            font-weight: 700;
            color: white;
            margin: 0;
          }

          .role-info {
            font-size: 0.8rem;
            gap: 8px;
            margin-bottom: 0;
            flex-wrap: wrap;
            color: white;
          }

          .role-info span {
            color: white;
          }

          .role-badge {
            font-size: 0.75rem;
            padding: 5px 10px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-weight: 600;
          }

          .button-group {
            gap: 8px;
            padding: 10px;
            margin-bottom: 12px;
            flex-wrap: wrap;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
          }

          .btn-mode {
            padding: 8px 14px;
            font-size: 0.8rem;
            border-radius: 5px;
            font-weight: 600;
            min-height: 36px;
            flex: 1;
            min-width: 100px;
          }

          .status-table {
            font-size: 0.57rem;
            border-collapse: collapse;
            line-height: 1.1;
          }

          .status-table th,
          .status-table td {
            padding: 1px 0.5px;
            font-size: 0.57rem;
            border: 0.5px solid #cbd5e1;
            text-align: center;
            height: auto;
          }

          .status-table th {
            font-size: 0.57rem;
            padding: 1.5px 0.5px;
            background: #f1f5f9;
            color: #334155;
            font-weight: 600;
          }

          .col-machine {
            min-width: 48px;
          }
          
          .col-kind {
            min-width: 45px;
          }

          .col-size {
            min-width: 30px;
          }

          .col-shift,
          .col-waktu,
          .col-standard {
            min-width: 38px;
          }

          .col-checkpoint {
            min-width: 70px;
            font-size: 0.64rem;
          }

          .col-date-cell {
            min-width: 24px;
            height: auto;
            padding: 1px;
          }

          .status-dropdown {
            font-size: 0.68rem;
            padding: 1px;
            line-height: 1.1;
            border-radius: 3px;
            border: 0.5px solid #cbd5e1;
          }

          .status-badge {
            font-size: 0.68rem;
            padding: 1px 2px;
            border-radius: 3px;
            font-weight: 600;
          }

          /* Modal responsive */
          .ng-modal-overlay {
            padding: 12px;
          }

          .ng-modal {
            width: 96%;
            max-width: 100%;
            padding: 16px;
            border-radius: 8px;
            background: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid #e2e8f0;
          }

          .ng-modal h3 {
            font-size: 0.95rem;
            margin-bottom: 12px;
            font-weight: 700;
            color: #0f172a;
          }

          .ng-form-group {
            margin-bottom: 8px;
          }

          .ng-form-group label {
            font-size: 0.75rem;
            margin-bottom: 3px;
          }

          .ng-form-group textarea,
          .ng-form-group select {
            font-size: 0.7rem;
            padding: 4px;
          }

          .ng-modal-actions {
            gap: 6px;
          }

          .ng-modal-actions button {
            padding: 5px 10px;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .page-content {
            padding: 6px 4px;
            background: #fafbfc;
          }

          .header {
            padding: 7px 7px;
            margin-bottom: 6px;
            gap: 4px;
          }

          .header h1 {
            font-size: 0.7rem;
            line-height: 1;
          }

          .month-nav {
            gap: 3px;
            padding: 4px;
            margin-bottom: 6px;
          }

          .month-btn {
            padding: 3px 5px;
            font-size: 0.55rem;
            min-height: 24px;
          }

          .month-display {
            font-size: 0.65rem;
            min-width: 70px;
          }

          .dropdown-group select {
            padding: 4px 7px;
            font-size: 0.65rem;
            min-height: 28px;
            border: 1px solid #cbd5e1;
          }

          .header {
            padding: 14px;
            gap: 12px;
            margin-bottom: 14px;
            border-radius: 8px;
            background: #1976d2;
            color: white;
            flex-direction: column;
            align-items: flex-start;
          }

          .header h1 {
            font-size: 1.1rem;
            font-weight: 700;
            color: white;
            margin-bottom: 8px;
          }

          .role-info {
            font-size: 0.8rem;
            gap: 8px;
            margin-bottom: 8px;
            flex-wrap: wrap;
            color: white;
          }

          .role-info span {
            color: white;
          }

          .role-badge {
            font-size: 0.75rem;
            padding: 5px 12px;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-weight: 600;
          }

          .button-group {
            gap: 8px;
            padding: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
            background: #f5f5f5;
            border-radius: 8px;
            width: 100%;
          }

          .btn-mode {
            padding: 10px 16px;
            font-size: 0.8rem;
            border-radius: 6px;
            font-weight: 600;
            min-height: 40px;
            flex: 1;
            min-width: 100px;
            text-align: center;
          }

          .month-header {
            font-size: 0.95rem;
            padding: 8px 0;
            font-weight: 700;
          }

          .week-header {
            font-size: 0.85rem;
            padding: 6px 0;
            font-weight: 600;
          }

          .status-table {
            font-size: 0.66rem;
            border-collapse: collapse;
            line-height: 1.2;
          }

          .status-table th,
          .status-table td {
            padding: 2px 1px;
            font-size: 0.66rem;
            border: 0.5px solid #cbd5e1;
            text-align: center;
            height: auto;
          }

          .status-table th {
            font-size: 0.66rem;
            padding: 3px 1px;
            font-weight: 600;
            background: #f1f5f9;
            color: #334155;
          }

          .col-machine {
            min-width: 50px;
          }
          
          .col-kind {
            min-width: 46px;
          }

          .col-size {
            min-width: 32px;
          }

          .col-shift,
          .col-waktu,
          .col-standard {
            min-width: 40px;
          }

          .col-checkpoint {
            min-width: 72px;
            font-size: 0.62rem;
            text-align: left;
          }

          .col-date-cell {
            min-width: 24px;
            height: auto;
            padding: 1px;
          }

          .status-dropdown {
            font-size: 0.66rem;
            padding: 1px 1px;
            line-height: 1.1;
            border-radius: 3px;
            border: 0.5px solid #cbd5e1;
          }

          .status-badge {
            font-size: 0.66rem;
            padding: 1px 2px;
            border-radius: 3px;
            font-weight: 600;
          }

          /* Modal responsive */
          .ng-modal-overlay {
            padding: 12px;
          }

          .ng-modal {
            width: 96%;
            max-width: 100%;
            padding: 16px;
            border-radius: 8px;
            background: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }

          .ng-modal h3 {
            font-size: 0.95rem;
            margin-bottom: 12px;
            font-weight: 700;
            color: #1e293b;
          }

          .ng-form-group {
            margin-bottom: 12px;
          }

          .ng-form-group label {
            font-size: 0.8rem;
            margin-bottom: 6px;
            display: block;
            font-weight: 600;
            color: #334155;
          }

          .ng-form-group textarea,
          .ng-form-group select {
            font-size: 0.8rem;
            padding: 10px;
            line-height: 1.4;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            width: 100%;
            min-height: 40px;
          }

          .ng-modal-actions {
            gap: 10px;
            display: flex;
            margin-top: 16px;
          }

          .ng-modal-actions button {
            padding: 10px 16px;
            font-size: 0.85rem;
            font-weight: 600;
            border-radius: 6px;
            min-height: 40px;
            flex: 1;
          }
        }

        @media (max-width: 414px) {
          .page-content {
            padding-left: 10px;
            padding-top: 10px;
            padding-right: 10px;
            padding-bottom: 10px;
            max-width: 100%;
            width: 100%;
          }

          .header {
            padding: 12px;
            gap: 10px;
            margin-bottom: 12px;
            border-radius: 6px;
          }

          .header h1 {
            font-size: 1rem;
            margin-bottom: 6px;
          }

          .role-info {
            font-size: 0.75rem;
            gap: 6px;
            margin-bottom: 6px;
            flex-wrap: wrap;
          }

          .role-badge {
            font-size: 0.7rem;
            padding: 4px 10px;
            border-radius: 16px;
          }

          .button-group {
            gap: 6px;
            padding: 10px;
            margin-bottom: 12px;
            flex-wrap: wrap;
            border-radius: 6px;
            width: 100%;
          }

          .btn-mode {
            padding: 9px 14px;
            font-size: 0.75rem;
            border-radius: 5px;
            min-height: 36px;
            flex: 1;
            min-width: 90px;
          }

          .month-header {
            font-size: 0.9rem;
            padding: 6px 0;
          }

          .week-header {
            font-size: 0.8rem;
            padding: 4px 0;
          }

          .status-table {
            font-size: 0.64rem;
            line-height: 1.2;
          }

          .status-table th,
          .status-table td {
            padding: 2px 1px;
            font-size: 0.64rem;
            border: 0.5px solid #cbd5e1;
            height: auto;
          }

          .status-table th {
            font-size: 0.64rem;
            padding: 3px 1px;
            background: #f1f5f9;
            color: #334155;
            font-weight: 600;
          }

          .col-machine {
            min-width: 46px;
          }
          
          .col-kind {
            min-width: 44px;
          }

          .col-size {
            min-width: 30px;
          }

          .col-shift,
          .col-waktu,
          .col-standard {
            min-width: 36px;
          }

          .col-checkpoint {
            min-width: 68px;
            font-size: 0.60rem;
          }

          .col-date-cell {
            min-width: 24px;
            height: 24px;
            padding: 1px;
          }

          .status-dropdown {
            font-size: 0.64rem;
            padding: 1px 1px;
            line-height: 1.1;
            border-radius: 3px;
            border: 0.5px solid #cbd5e1;
          }

          .status-badge {
            font-size: 0.64rem;
            padding: 1px 2px;
            border-radius: 3px;
            font-weight: 600;
          }

          /* Modal responsive */
          .ng-modal-overlay {
            padding: 10px;
          }

          .ng-modal {
            width: 96%;
            max-width: 100%;
            padding: 14px;
            border-radius: 6px;
          }

          .ng-modal h3 {
            font-size: 0.9rem;
            margin-bottom: 10px;
            font-weight: 700;
          }

          .ng-form-group {
            margin-bottom: 10px;
          }

          .ng-form-group label {
            font-size: 0.75rem;
            margin-bottom: 4px;
            font-weight: 600;
          }

          .ng-form-group textarea,
          .ng-form-group select {
            font-size: 0.75rem;
            padding: 8px;
            line-height: 1.3;
            min-height: 36px;
          }

          .ng-modal-actions {
            gap: 8px;
            margin-top: 12px;
          }

          .ng-modal-actions button {
            padding: 8px 12px;
            font-size: 0.8rem;
            min-height: 36px;
          }
        }
      `}</style>
    </>
  )
}
