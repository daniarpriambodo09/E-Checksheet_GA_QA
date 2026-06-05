// app/status-pre-assy/page.tsx
"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
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
  // ── Fields tambahan dari API ──────────────────────────────────────────
  areaCode?: string          // area code tempat checklist dilakukan
  carlineLine?: string       // format "{carline}|{line}" digabung di frontend
  ngPhotos?: string          // raw JSON string dari DB (array base64)
  gaugeId?: string | null    // gauge ID dari gauge_qr_codes (item DCI 2-9)
  // ── Fields DCI yang di-parse di frontend sebelum masuk modal ──────────
  dciOtherNote?: string      // keterangan NG tambahan (parsed dari ng_description)
  dciPhotos?: string[]       // foto dokumentasi NG (parsed dari ng_photos, base64[])
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
        const res = await fetch(`/e-checksheet-qa/api/areas/get-by-category?categoryCode=${encodeURIComponent(categoryCode)}`);
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
  const { user, loading: authLoading, isInitialized } = useAuth()
  const hasBeenAuthenticated = useRef(false)
  
  // 🔹 Validasi role — tunggu auth selesai initialize dulu
  useEffect(() => {
    if (user) hasBeenAuthenticated.current = true
    if (isInitialized && !authLoading && !user && !hasBeenAuthenticated.current) {
      router.push("/login-page")
    }
    if (isInitialized && !authLoading && user &&
        user.role !== "group-leader-qa" && user.role !== "inspector-qa") {
      router.push("/home")
    }
  }, [user, authLoading, isInitialized, router])
  
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

  // === STATE CARLINE / LINE (untuk CC & Stripping) ===
  const [carlineOptions, setCarlineOptions]     = useState<{carline: string; line: string}[]>([])
  const [selectedCarlineLine, setSelectedCarlineLine] = useState<string>("")

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
  const apiBaseUrl = '/e-checksheet-qa/api/pre-assy'
  
  // Fetch carline-line options setiap kali area atau viewMode berubah
  useEffect(() => {
    if (!selectedArea) {
      setCarlineOptions([])
      setSelectedCarlineLine("")
      return
    }
    const fetchCarlines = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/get-carline-line?areaCode=${encodeURIComponent(selectedArea)}`)
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data)) {
          setCarlineOptions(data)
          // Auto-select pertama jika belum ada pilihan
          if (data.length > 0 && !selectedCarlineLine) {
            setSelectedCarlineLine(`${data[0].carline}|${data[0].line}`)
          }
        }
      } catch {}
    }
    fetchCarlines()
  }, [viewMode, selectedArea])

  // Load data dari database
  const loadDataFromDB = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const monthKey = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;
      const areaParam = selectedArea ? `&areaCode=${encodeURIComponent(selectedArea)}` : '';
      // Tambah filter carline+line untuk CC & Stripping
      let carlineParam = ''
      if (selectedCarlineLine) {
        const [carline, line] = selectedCarlineLine.split('|')
        carlineParam = `&carline=${encodeURIComponent(carline)}&line=${encodeURIComponent(line)}`
      }

      const [resultsRes, signaturesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/get-results?userId=${user.id}&categoryCode=${categoryCode}&month=${monthKey}${areaParam}${carlineParam}`),
        fetch(`${apiBaseUrl}/get-signatures?userId=${user.id}&categoryCode=${categoryCode}&month=${monthKey}${areaParam}`)
      ]);
      
      if (!resultsRes.ok || !signaturesRes.ok) {
        throw new Error('Gagal memuat data dari server');
      }
      
      const resultsData = await resultsRes.json();
      const signaturesData = await signaturesRes.json();
      
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
  
  // Load data saat component mount atau saat bulan/view/area/carline berubah
  useEffect(() => {
    loadDataFromDB()
  }, [user?.id, activeMonth, activeYear, viewMode, selectedArea, selectedCarlineLine])
  
  // =====================================================================
  // === FUNGSI HELPER: SLOT WAKTU ===
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
  // NO 1 — 1-150A
  { id: "1-X-1-A", dbId: 1102, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "1-X-1-B", dbId: 1103, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "1-X-2-A", dbId: 1104, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "1-X-2-B", dbId: 1105, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "1-X-3-A", dbId: 1106, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "1-X-3-B", dbId: 1107, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "1-X-4-A", dbId: 1108, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "1-X-4-B", dbId: 1109, no: 1, toolType: "1-150A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 2 — PA
  { id: "2-X-1-A", dbId: 1110, no: 2, toolType: "PA", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "2-X-1-B", dbId: 1111, no: 2, toolType: "PA", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "2-X-2-A", dbId: 1112, no: 2, toolType: "PA", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "2-X-2-B", dbId: 1113, no: 2, toolType: "PA", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "2-X-3-A", dbId: 1114, no: 2, toolType: "PA", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "2-X-3-B", dbId: 1115, no: 2, toolType: "PA", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "2-X-4-A", dbId: 1116, no: 2, toolType: "PA", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "2-X-4-B", dbId: 1117, no: 2, toolType: "PA", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 3 — DLI
  { id: "3-X-1-A", dbId: 1118, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "3-X-1-B", dbId: 1119, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "3-X-2-A", dbId: 1120, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "3-X-2-B", dbId: 1121, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "3-X-3-A", dbId: 1122, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "3-X-3-B", dbId: 1123, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "3-X-4-A", dbId: 1124, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "3-X-4-B", dbId: 1125, no: 3, toolType: "DLI", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 4 — CNR
  { id: "4-X-1-A", dbId: 1126, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "4-X-1-B", dbId: 1127, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "4-X-2-A", dbId: 1128, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "4-X-2-B", dbId: 1129, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "4-X-3-A", dbId: 1130, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "4-X-3-B", dbId: 1131, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "4-X-4-A", dbId: 1132, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "4-X-4-B", dbId: 1133, no: 4, toolType: "CNR", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 5 — TCNR
  { id: "5-X-1-A", dbId: 1134, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "5-X-1-B", dbId: 1135, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "5-X-2-A", dbId: 1136, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "5-X-2-B", dbId: 1137, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "5-X-3-A", dbId: 1138, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "5-X-3-B", dbId: 1139, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "5-X-4-A", dbId: 1140, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "5-X-4-B", dbId: 1141, no: 5, toolType: "TCNR", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 6 — 1-72A
  { id: "6-X-1-A", dbId: 1142, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "6-X-1-B", dbId: 1143, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "6-X-2-A", dbId: 1144, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "6-X-2-B", dbId: 1145, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "6-X-3-A", dbId: 1146, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "6-X-3-B", dbId: 1147, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "6-X-4-A", dbId: 1148, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "6-X-4-B", dbId: 1149, no: 6, toolType: "1-72A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 7 — 1-114
  { id: "7-X-1-A", dbId: 1150, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "7-X-1-B", dbId: 1151, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "7-X-2-A", dbId: 1152, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "7-X-2-B", dbId: 1153, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "7-X-3-A", dbId: 1154, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "7-X-3-B", dbId: 1155, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "7-X-4-A", dbId: 1156, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "7-X-4-B", dbId: 1157, no: 7, toolType: "1-114", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 8 — 1-42A
  { id: "8-X-1-A", dbId: 1158, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "8-X-1-B", dbId: 1159, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "8-X-2-A", dbId: 1160, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "8-X-2-B", dbId: 1161, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "8-X-3-A", dbId: 1162, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "8-X-3-B", dbId: 1163, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "8-X-4-A", dbId: 1164, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "8-X-4-B", dbId: 1165, no: 8, toolType: "1-42A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 9 — 1-35
  { id: "9-X-1-A", dbId: 1166, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "9-X-1-B", dbId: 1167, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "9-X-2-A", dbId: 1168, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "9-X-2-B", dbId: 1169, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "9-X-3-A", dbId: 1170, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "9-X-3-B", dbId: 1171, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "9-X-4-A", dbId: 1172, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "9-X-4-B", dbId: 1173, no: 9, toolType: "1-35", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 10 — 1-85
  { id: "10-X-1-A", dbId: 1174, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "10-X-1-B", dbId: 1175, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "10-X-2-A", dbId: 1176, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "10-X-2-B", dbId: 1177, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "10-X-3-A", dbId: 1178, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "10-X-3-B", dbId: 1179, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "10-X-4-A", dbId: 1180, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "10-X-4-B", dbId: 1181, no: 10, toolType: "1-85", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 11 — 1-83A
  { id: "11-X-1-A", dbId: 1182, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "11-X-1-B", dbId: 1183, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "11-X-2-A", dbId: 1184, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "11-X-2-B", dbId: 1185, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "11-X-3-A", dbId: 1186, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "11-X-3-B", dbId: 1187, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "11-X-4-A", dbId: 1188, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "11-X-4-B", dbId: 1189, no: 11, toolType: "1-83A", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 12 — 1-73
  { id: "12-X-1-A", dbId: 1190, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "12-X-1-B", dbId: 1191, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "12-X-2-A", dbId: 1192, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "12-X-2-B", dbId: 1193, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "12-X-3-A", dbId: 1194, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "12-X-3-B", dbId: 1195, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "12-X-4-A", dbId: 1196, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "12-X-4-B", dbId: 1197, no: 12, toolType: "1-73", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 13 — 1-105
  { id: "13-X-1-A", dbId: 1198, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "13-X-1-B", dbId: 1199, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "13-X-2-A", dbId: 1200, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "13-X-2-B", dbId: 1201, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "13-X-3-A", dbId: 1202, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "13-X-3-B", dbId: 1203, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "13-X-4-A", dbId: 1204, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "13-X-4-B", dbId: 1205, no: 13, toolType: "1-105", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 14 — TLC
  { id: "14-X-1-A", dbId: 1206, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "14-X-1-B", dbId: 1207, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "14-X-2-A", dbId: 1208, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "14-X-2-B", dbId: 1209, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "14-X-3-A", dbId: 1210, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Terpasang Cover", shift: "A" },
  { id: "14-X-3-B", dbId: 1211, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Terpasang Cover", shift: "B" },
  { id: "14-X-4-A", dbId: 1212, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "14-X-4-B", dbId: 1213, no: 14, toolType: "TLC", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 15 — EXTRACTION JIG / GO NO GO TERMINAL
  // Color R
  { id: "15-R-1-A", dbId: 1214, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-R-1-B", dbId: 1215, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "15-R-2-A", dbId: 1216, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "15-R-2-B", dbId: 1217, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "15-R-3-A", dbId: 1218, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "15-R-3-B", dbId: 1219, no: 15, toolType: "EXTRACTION JIG R", controlNo: "R", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
  // Color G
  { id: "15-G-1-A", dbId: 1220, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-G-1-B", dbId: 1221, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "15-G-2-A", dbId: 1222, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "15-G-2-B", dbId: 1223, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "15-G-3-A", dbId: 1224, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "15-G-3-B", dbId: 1225, no: 15, toolType: "EXTRACTION JIG G", controlNo: "G", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
  // Color W
  { id: "15-W-1-A", dbId: 1226, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-W-1-B", dbId: 1227, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "15-W-2-A", dbId: 1228, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "15-W-2-B", dbId: 1229, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "15-W-3-A", dbId: 1230, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "15-W-3-B", dbId: 1231, no: 15, toolType: "EXTRACTION JIG W", controlNo: "W", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
  // Color Y
  { id: "15-Y-1-A", dbId: 1232, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "15-Y-1-B", dbId: 1233, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "15-Y-2-A", dbId: 1234, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "15-Y-2-B", dbId: 1235, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "15-Y-3-A", dbId: 1236, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "15-Y-3-B", dbId: 1237, no: 15, toolType: "EXTRACTION JIG Y", controlNo: "Y", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },

  // NO 16 — CLIPPER
  { id: "16-X-1-A", dbId: 1238, no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "A" },
  { id: "16-X-1-B", dbId: 1239, no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak patah / bengkok", shift: "B" },
  { id: "16-X-2-A", dbId: 1240, no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak berkarat", shift: "A" },
  { id: "16-X-2-B", dbId: 1241, no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Tidak berkarat", shift: "B" },
  { id: "16-X-3-A", dbId: 1242, no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "A" },
  { id: "16-X-3-B", dbId: 1243, no: 16, toolType: "CLIPPER", controlNo: "", itemCheck: "Ada dan sesuai control numbernya", shift: "B" },
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
  // === RENDER STATUS CELL ===
  // =====================================================================
  const renderStatusCell = useCallback((date: number, checkpoint: any, timeSlot?: string) => {
    const id = checkpoint.id
    const shift = checkpoint.shift
    const baseId = Math.floor(id)
    const dateKey = getDateKey(date)
    const itemKey = timeSlot ? `${baseId}-${shift}-${timeSlot}` : `${baseId}-${shift}`
    const status = results[dateKey]?.[itemKey]?.status || "-"
    const result = results[dateKey]?.[itemKey]

    const getBgColor = (s: string) => s === "OK" ? "#4caf50" : s === "NG" ? "#f44336" : "#9e9e9e"

    if (status === "NG") {
      return (
        <span
          className="status-badge status-badge-ng"
          style={{ display: "inline-block", width: "100%", backgroundColor: "#f44336", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "500", fontSize: "12px", textAlign: "center", cursor: "pointer" }}
          title={result?.ngDescription ? `NG: ${result.ngDescription}` : "NG"}
          onClick={() => setNgModal({ status: "NG", label: checkpoint.checkPoint || checkpoint.machine || String(id), date, shift, ngDescription: result?.ngDescription || "", ngDepartment: result?.ngDepartment || "", submittedBy: result?.submittedBy || "", submittedAt: result?.submittedAt || "" })}
        >
          ✗ NG
        </span>
      )
    }
    if (status === "OK") {
      return (
        <span
          className="status-badge status-badge-ok"
          style={{ display: "inline-block", width: "100%", backgroundColor: "#4caf50", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "500", fontSize: "12px", textAlign: "center" }}
        >
          ✓ OK
        </span>
      )
    }
    return <span style={{ color: "#9e9e9e", fontSize: "12px" }}>-</span>
  }, [results, getDateKey])

  // =====================================================================
  // === RENDER STATUS CELL UNTUK CS REMOVE TOOL ===
  // =====================================================================
  const renderCSRemoveStatusCell = useCallback((date: number, item: CSRemoveToolItem) => {
    const result = getCSRemoveResult(date, item.id)
    const dateKey = getDateKey(date)
    const status = result?.status || results[dateKey]?.[item.id]?.status || "-"
    const r = result || results[dateKey]?.[item.id]

    if (status === "NG") {
      // Parse ng_description: { choices: string[], other: string }
      let crtNgChoices: string[] = []
      let crtOtherNote = ""
      let crtPhotos: string[] = []
      try {
        const parsed = JSON.parse(r?.ngDescription || "{}")
        if (Array.isArray(parsed.choices)) crtNgChoices = parsed.choices
        crtOtherNote = parsed.other || ""
      } catch {}
      try {
        const parsedPhotos = JSON.parse(r?.ngPhotos || "[]")
        if (Array.isArray(parsedPhotos)) crtPhotos = parsedPhotos
      } catch {}
      return (
        <span
          className="status-badge status-badge-ng"
          style={{ display: "inline-block", width: "100%", backgroundColor: "#f44336", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "500", fontSize: "12px", textAlign: "center", cursor: "pointer" }}
          onClick={() => setNgModal({
            status: "NG",
            label: item.toolType,
            date,
            shift: item.shift,
            ngDescription: r?.ngDescription || "",
            ngDepartment: r?.ngDepartment || "",
            submittedBy: r?.submittedBy || "",
            submittedAt: r?.submittedAt || "",
            isDCI: true,
            dciItemCheck: item.toolType,
            dciArea: r?.areaCode || "",
            dciCarlineLine: r?.carlineLine || "",
            dciNgChoices: crtNgChoices,
            dciOtherNote: crtOtherNote,
            dciPhotos: crtPhotos,
          })}
        >
          ✗ NG
        </span>
      )
    }
    if (status === "OK") {
      return (
        <span
          className="status-badge status-badge-ok"
          style={{ display: "inline-block", width: "100%", backgroundColor: "#4caf50", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "500", fontSize: "12px", textAlign: "center" }}
        >
          ✓ OK
        </span>
      )
    }
    return <span style={{ color: "#9e9e9e" }}>-</span>
  }, [getCSRemoveResult, results, getDateKey])

  // =====================================================================
  // === RENDER STATUS CELL UNTUK DAILY CHECK INS ===
  // =====================================================================
  const renderStatusCellDailyCheckIns = useCallback((weekIndex: number, dayIndex: number, checkpoint: any) => {
    const checkpointId = checkpoint.id
    const shift = checkpoint.shift
    if (!getWeeksInMonth[weekIndex]) return <span style={{ color: "#9e9e9e" }}>-</span>
    const day = getWeeksInMonth[weekIndex].days[dayIndex]
    if (!day) return <span style={{ color: "#9e9e9e" }}>-</span>
    const result = getResultDailyCheckIns(weekIndex, dayIndex, checkpointId, shift)
    const dateKey = getDateKey(day.date)
    const checkpointKey = `${checkpointId}-${shift}`
    const status = result?.status || results[dateKey]?.[checkpointKey]?.status || "-"
    const r = result || results[dateKey]?.[checkpointKey]

    if (status === "NG") {
      // Parse ng_description: JSON array (DCI baru) atau string biasa
      let dciNgChoices: string[] = []
      let dciOtherNote = ""
      try {
        // Format baru: { choices: [...], other: "..." }
        const parsed = JSON.parse(r?.ngDescription || "{}")
        if (Array.isArray(parsed)) {
          dciNgChoices = parsed  // backward compat — format lama
        } else if (parsed && typeof parsed === "object") {
          dciNgChoices = Array.isArray(parsed.choices) ? parsed.choices : []
          dciOtherNote = parsed.other || ""
        }
      } catch {
        if (r?.ngDescription) dciNgChoices = [r.ngDescription]
      }
      // Parse foto dokumentasi NG
      let dciPhotos: string[] = []
      try {
        const parsedPhotos = JSON.parse(r?.ngPhotos || "[]")
        if (Array.isArray(parsedPhotos)) dciPhotos = parsedPhotos
      } catch { dciPhotos = [] }
      const carlineLineLabel = selectedCarlineLine ? selectedCarlineLine.replace("|", " - ") : "-"
      return (
        <span
          className="status-badge status-badge-ng"
          style={{ display: "inline-block", width: "100%", backgroundColor: "#f44336", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "500", fontSize: "12px", textAlign: "center", cursor: "pointer" }}
          onClick={() => setNgModal({
            status: "NG",
            label: checkpoint.itemCheck || checkpoint.checkPoint || String(checkpointId),
            date: day.date,
            shift,
            ngDescription: r?.ngDescription || "",
            ngDepartment: r?.ngDepartment || "",
            submittedBy: r?.submittedBy || "",
            submittedAt: r?.submittedAt || "",
            isDCI: true,
            dciItemCheck: checkpoint.itemCheck || checkpoint.checkPoint || String(checkpointId),
            dciArea: selectedArea,
            dciCarlineLine: carlineLineLabel,
            dciNgChoices,
            dciOtherNote,
            dciPhotos,
            dciGaugeId: r?.gaugeId || null,
          })}
        >
          ✗ NG
        </span>
      )
    }
    if (status === "OK") {
      return (
        <span
          className="status-badge status-badge-ok"
          style={{ display: "inline-block", width: "100%", backgroundColor: "#4caf50", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "500", fontSize: "12px", textAlign: "center" }}
        >
          ✓ OK
        </span>
      )
    }
    return <span style={{ color: "#9e9e9e" }}>-</span>
  }, [getWeeksInMonth, getResultDailyCheckIns, results, getDateKey, selectedCarlineLine, selectedArea])

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
  const [photoZoomSrc, setPhotoZoomSrc] = useState<string | null>(null)
  const [ngModal, setNgModal] = useState<{
    status: "NG"
    label: string
    date: number
    shift: "A" | "B"
    ngDescription: string
    ngDepartment: string
    submittedBy: string
    submittedAt: string
    // Extra fields khusus Daily Check Ins
    isDCI?: boolean
    dciItemCheck?: string
    dciArea?: string
    dciCarlineLine?: string
    dciNgChoices?: string[]   // parsed dari ng_description JSON array
    dciOtherNote?: string     // keterangan NG tambahan
    dciPhotos?: string[]      // foto dokumentasi NG (base64)
    dciGaugeId?: string | null  // gauge ID dari gauge_qr_codes
  } | null>(null)
  
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
  
  if (authLoading || !isInitialized || !user) return null
  
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
          <h1>📊 {renderActiveTitle()}</h1>
          <div className="role-info">
            Role: <span className="role-badge">{user.role === "group-leader-qa" ? "👤 Group Leader" : "🔍 Inspector"}</span>
          </div>
        </div>
        <div className="button-group">
          {renderViewModeButtons()}
          
          {/* ✅ AREA FILTER */}
          <AreaFilter
            categoryCode={categoryCode}
            selectedArea={selectedArea}
            onAreaChange={setSelectedArea}
            isLoading={isLoading}
            defaultAreaCode={DEFAULT_AREA_BY_CATEGORY[categoryCode]}
          />

          {/* ✅ CARLINE / LINE FILTER — semua tipe pre-assy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e3a8a', whiteSpace: 'nowrap' }}>
              🏭 Carline - Line:
            </span>
            {carlineOptions.length > 0 ? (
              <select
                value={selectedCarlineLine}
                onChange={(e) => setSelectedCarlineLine(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '2px solid #1976d2',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1e3a8a',
                  background: '#eff6ff',
                  cursor: 'pointer',
                  minWidth: '170px',
                }}
              >
                <option value="">-- Pilih Carline --</option>
                {carlineOptions.map(opt => (
                  <option key={`${opt.carline}|${opt.line}`} value={`${opt.carline}|${opt.line}`}>
                    {opt.carline} - {opt.line}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                Belum ada data carline
              </span>
            )}
          </div>
        </div>

        {/* PERINGATAN jika carline belum dipilih */}
        {!selectedCarlineLine && !isLoading && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '14px',
            fontSize: '13px',
            color: '#92400e',
            fontWeight: '500',
          }}>
            ⚠️ Pilih <strong>Carline - Line</strong> terlebih dahulu untuk menampilkan data checklist.
          </div>
        )}
        
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
                    <th rowSpan={2} className="col-standard">Standard / Metode</th>
                    <th rowSpan={2} className="col-waktu">Waktu Check</th>
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
                        <td rowSpan={2} className="col-checkpoint">{shiftA!.checkPoint}</td>
                        <td className="col-standard">{shiftA!.standard}</td>
                        <td className="col-waktu">{shiftA!.waktuCheck}</td>
                        <td className="col-shift">{shiftA!.shift}</td>
                        {dynamicDates.map((date) => (
                          <td key={`A-${id}-${date}`} className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}>
                            {renderStatusCell(date, shiftA!)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="col-standard">{shiftB!.standard}</td>
                        <td className="col-waktu">{shiftB!.waktuCheck}</td>
                        <td className="col-shift">{shiftB!.shift}</td>
                        {dynamicDates.map((date) => (
                          <td key={`B-${id}-${date}`} className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}>
                            {renderStatusCell(date, shiftB!)}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  )
                })
              ) : viewMode === "daily-check-ins" ? (
                // Per item: ambil unique no, render 2 row (shift A & B)
                Array.from(new Set(DAILY_CHECK_INS_CHECKPOINTS.map(cp => cp.no))).map((no) => {
                  // Ambil 1 representatif per item per shift (checkpoint pertama dari grup)
                  const repA = DAILY_CHECK_INS_CHECKPOINTS.find(cp => cp.no === no && cp.shift === "A")
                  const repB = DAILY_CHECK_INS_CHECKPOINTS.find(cp => cp.no === no && cp.shift === "B")
                  if (!repA || !repB) return null

                  return (
                    <React.Fragment key={no}>
                      {([repA, repB] as const).map((rep, rowIdx) => {
                        // Untuk mencari result: cari dari semua checkpoint dgn no ini & shift ini
                        const groupCheckpoints = DAILY_CHECK_INS_CHECKPOINTS.filter(
                          cp => cp.no === no && cp.shift === rep.shift
                        )

                        return (
                          <tr key={`${no}-${rep.shift}`}>
                            {rowIdx === 0 && <td rowSpan={2} className="col-no">{rep.no}</td>}
                            {rowIdx === 0 && <td rowSpan={2} className="col-item dci-item-cell">{rep.itemCheck}</td>}
                            <td className="col-shift">{rep.shift}</td>
                            {getWeeksInMonth.map((week, wIdx) =>
                              week.days.map((day, dIdx) => {
                                // Cek apakah hari ini dibutuhkan (gunakan schedule dari rep)
                                const needed = isDayNeeded(rep.schedule, day.dayName)

                                const isToday = (() => {
                                  const now = new Date()
                                  const cellDate = new Date(activeYear, activeMonth, day.date)
                                  return cellDate.getDate() === now.getDate() &&
                                    cellDate.getMonth() === now.getMonth() &&
                                    cellDate.getFullYear() === now.getFullYear()
                                })()

                                const isTodayOrBefore = isTodayOrPast(wIdx, dIdx)

                                // Ambil result dari checkpoint pertama grup (item-level result)
                                const result = getResultDailyCheckIns(wIdx, dIdx, rep.id, rep.shift)

                                if (!needed) {
                                  return <td key={`${wIdx}-${dIdx}`} className="col-date-cell bg-gray-200"></td>
                                }

                                if (isToday) {
                                  return (
                                    <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                      {renderStatusCellDailyCheckIns(wIdx, dIdx, rep)}
                                    </td>
                                  )
                                }

                                if (result && !isToday) {
                                  // Parse ng_description: bisa JSON array (DCI baru) atau string biasa
                                  let ngChoices: string[] = []
                                  try {
                                    const parsed = JSON.parse(result.ngDescription || "[]")
                                    if (Array.isArray(parsed)) ngChoices = parsed
                                  } catch {
                                    if (result.ngDescription) ngChoices = [result.ngDescription]
                                  }

                                  // Tentukan carline-line dari selectedCarlineLine
                                  const carlineLineLabel = selectedCarlineLine
                                    ? selectedCarlineLine.replace("|", " - ")
                                    : "-"

                                  return (
                                    <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                      <span
                                        className={`status-badge ${result.status === "OK" ? "status-badge-ok" : "status-badge-ng"}`}
                                        style={result.status === "NG" ? { cursor: "pointer" } : {}}
                                        onClick={() => {
                                          if (result.status === "NG") {
                                            setNgModal({
                                              status: "NG",
                                              label: rep.itemCheck,
                                              date: day.date,
                                              shift: rep.shift,
                                              ngDescription: result.ngDescription || "",
                                              ngDepartment: result.ngDepartment || "QA",
                                              submittedBy: result.submittedBy || "",
                                              submittedAt: result.submittedAt || "",
                                              isDCI: true,
                                              dciItemCheck: rep.itemCheck,
                                              dciArea: selectedArea,
                                              dciCarlineLine: carlineLineLabel,
                                              dciNgChoices: ngChoices,
                                              dciOtherNote: result.dciOtherNote || "",
                                              dciPhotos: result.dciPhotos || [],
                                              dciGaugeId: result.gaugeId || null,
                                            })
                                          }
                                        }}
                                      >
                                        {result.status === "OK" ? "OK" : "NG"}
                                      </span>
                                    </td>
                                  )
                                }

                                if (isTodayOrBefore) {
                                  return (
                                    <td key={`${wIdx}-${dIdx}`} className="col-date-cell">
                                      {renderStatusCellDailyCheckIns(wIdx, dIdx, rep)}
                                    </td>
                                  )
                                }

                                return <td key={`${wIdx}-${dIdx}`} className="col-date-cell bg-gray-100"></td>
                              })
                            )}
                          </tr>
                        )
                      })}
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
                        <td rowSpan={2} className="col-machine">{shiftA!.machine}</td>
                        <td rowSpan={2} className="col-kind">{shiftA!.kind}</td>
                        <td rowSpan={2} className="col-size">{shiftA!.size}</td>
                        {getSelectedWeekDays.flatMap((day, dayIndex) =>
                          TIME_SLOTS.map((timeSlot) => (
                            <td key={`${dayIndex}-${timeSlot}-A`} className="col-date-cell">
                              {renderStatusCell(day.date, shiftA!, timeSlot)}
                            </td>
                          ))
                        )}
                      </tr>
                      <tr>
                        {getSelectedWeekDays.flatMap((day, dayIndex) =>
                          TIME_SLOTS.map((timeSlot) => (
                            <td key={`${dayIndex}-${timeSlot}-B`} className="col-date-cell">
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
                                className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}
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
                              className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}
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
                              className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}
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
                    <td colSpan={2} rowSpan={2} style={{ fontSize: "12px", fontWeight: "700", textAlign: "center", background: "#f8fafc", padding: "8px" }}>
                      Check dan Tanda tangan GL Inspector
                    </td>
                    <td rowSpan={2}></td>
                    <td>A</td>
                    {dynamicDates.map((date) => {
                      const value = getGLSignature(date, "A", "gl")
                      return (
                        <td key={`gl-A-${date}`} className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}>
                          <span style={{ display: "inline-block", width: "100%", backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e", color: "white", padding: "3px 0", borderRadius: "4px", textAlign: "center", fontSize: "11px", fontWeight: "600" }}>{value}</span>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>B</td>
                    {dynamicDates.map((date) => {
                      const value = getGLSignature(date, "B", "gl")
                      return (
                        <td key={`gl-B-${date}`} className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}>
                          <span style={{ display: "inline-block", width: "100%", backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e", color: "white", padding: "3px 0", borderRadius: "4px", textAlign: "center", fontSize: "11px", fontWeight: "600" }}>{value}</span>
                        </td>
                      )
                    })}
                  </tr>
                  {/* === Baris: Verifikasi dan Tanda tangan ESO === */}
                  <tr>
                    <td colSpan={2} rowSpan={2} style={{ fontSize: "12px", fontWeight: "700", textAlign: "center", background: "#f8fafc", padding: "8px" }}>
                      Verifikasi dan Tanda tangan ESO (Setiap Hari Selasa & Kamis)
                    </td>
                    <td rowSpan={2}></td>
                    <td>A</td>
                    {dynamicDates.map((date) => {
                      const dayOfWeek = new Date(activeYear, activeMonth, date).getDay()
                      const isSelasaKamis = dayOfWeek === 2 || dayOfWeek === 4
                      const value = getGLSignature(date, "A", "eso")
                      if (!isSelasaKamis) {
                        return <td key={`eso-A-${date}`} style={{ background: "#f8fafc" }}></td>
                      }
                      return (
                        <td key={`eso-A-${date}`} className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}>
                          <span style={{ display: "inline-block", width: "100%", backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e", color: "white", padding: "3px 0", borderRadius: "4px", textAlign: "center", fontSize: "11px", fontWeight: "600" }}>{value}</span>
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
                        return <td key={`eso-B-${date}`} style={{ background: "#f8fafc" }}></td>
                      }
                      return (
                        <td key={`eso-B-${date}`} className={`col-date-cell${isCurrentMonth && date === today ? " bg-blue-50" : ""}`}>
                          <span style={{ display: "inline-block", width: "100%", backgroundColor: value === "☑" ? "#4caf50" : "#9e9e9e", color: "white", padding: "3px 0", borderRadius: "4px", textAlign: "center", fontSize: "11px", fontWeight: "600" }}>{value}</span>
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
      
      {/* MODAL NG — READ ONLY */}
      {ngModal && (
        <div className="ng-modal-overlay" onClick={() => setNgModal(null)}>
          <div className={`ng-modal${ngModal.isDCI ? " ng-modal--dci" : ""}`} onClick={(e) => e.stopPropagation()}>

            {ngModal.isDCI ? (
              /* ── DCI Modal: tampilan khusus dengan daftar kondisi NG ── */
              <>
                {/* Header */}
                <div className="dci-modal-header">
                  <div className="dci-modal-badge-ng">✗ NG</div>
                  <div className="dci-modal-title-block">
                    <h3 className="dci-modal-title">Detail Kondisi NG</h3>
                    <p className="dci-modal-subtitle">Daily Check Ins. Inspector Pre Assy</p>
                  </div>
                  <button className="dci-modal-close" onClick={() => setNgModal(null)}>✕</button>
                </div>

                {/* Info rows */}
                <div className="dci-modal-info-grid">
                  <div className="dci-modal-info-row">
                    <span className="dci-modal-info-label">Item Check</span>
                    <span className="dci-modal-info-value dci-modal-item-name">
                      {ngModal.dciItemCheck || ngModal.label}
                      {ngModal.dciGaugeId && (
                        <span className="dci-modal-gauge-badge">{ngModal.dciGaugeId}</span>
                      )}
                    </span>
                  </div>
                  <div className="dci-modal-info-row">
                    <span className="dci-modal-info-label">Tanggal &amp; Shift</span>
                    <span className="dci-modal-info-value">
                      {ngModal.date} {getMonthName(activeMonth)} {activeYear}
                      <span className="dci-modal-shift-badge">Shift {ngModal.shift}</span>
                    </span>
                  </div>
                  <div className="dci-modal-info-row">
                    <span className="dci-modal-info-label">Area</span>
                    <span className="dci-modal-info-value dci-modal-area">{ngModal.dciArea || "-"}</span>
                  </div>
                  <div className="dci-modal-info-row">
                    <span className="dci-modal-info-label">Carline — Line</span>
                    <span className="dci-modal-info-value dci-modal-carline">{ngModal.dciCarlineLine || "-"}</span>
                  </div>
                </div>

                {/* Daftar kondisi NG */}
                <div className="dci-modal-ng-section">
                  <div className="dci-modal-ng-section-header">
                    <span className="dci-modal-ng-section-icon">⚠️</span>
                    <span className="dci-modal-ng-section-title">
                      Kondisi NG yang ditemukan
                      {ngModal.dciNgChoices && ngModal.dciNgChoices.length > 0 && (
                        <span className="dci-modal-ng-count">{ngModal.dciNgChoices.length} kondisi</span>
                      )}
                    </span>
                  </div>
                  {ngModal.dciNgChoices && ngModal.dciNgChoices.length > 0 ? (
                    <div className="dci-modal-ng-list">
                      {ngModal.dciNgChoices.map((choice, i) => (
                        <div key={i} className="dci-modal-ng-item">
                          <span className="dci-modal-ng-bullet">✗</span>
                          <span className="dci-modal-ng-text">{choice}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dci-modal-ng-empty">Tidak ada detail kondisi NG yang tercatat</div>
                  )}
                </div>

                {/* Keterangan Tambahan */}
                {ngModal.dciOtherNote && (
                  <div className="dci-modal-other-section">
                    <div className="dci-modal-other-header">
                      <span>✏️</span>
                      <span className="dci-modal-other-title">Keterangan Tambahan</span>
                    </div>
                    <div className="dci-modal-other-text">{ngModal.dciOtherNote}</div>
                  </div>
                )}

                {/* Foto Dokumentasi */}
                {ngModal.dciPhotos && ngModal.dciPhotos.length > 0 && (
                  <div className="dci-modal-photo-section">
                    <div className="dci-modal-photo-header">
                      <span>📷</span>
                      <span className="dci-modal-photo-title">Foto Dokumentasi NG</span>
                      <span className="dci-modal-photo-count">{ngModal.dciPhotos.length} foto</span>
                    </div>
                    <div className="dci-modal-photo-grid">
                      {ngModal.dciPhotos.map((src, pi) => (
                        <img
                          key={pi}
                          src={src}
                          alt={`Foto NG ${pi + 1}`}
                          className="dci-modal-photo-thumb"
                          onClick={() => setPhotoZoomSrc(src)}
                          title="Klik untuk zoom"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer info */}
                <div className="dci-modal-footer-info">
                  <span>Dilaporkan oleh: <strong>{ngModal.submittedBy && ngModal.submittedBy !== "System" ? ngModal.submittedBy : (ngModal.submittedBy || "-")}</strong></span>
                  <span>{ngModal.submittedAt ? new Date(ngModal.submittedAt).toLocaleString("id-ID") : "-"}</span>
                </div>

                <div className="ng-modal-actions">
                  <button onClick={() => setNgModal(null)} className="btn-primary">Tutup</button>
                </div>
              </>
            ) : (
              /* ── Modal lainnya: tampilan standar ── */
              <>
                <h3>⚠️ Detail Kondisi NG</h3>
                <div className="ng-form-group">
                  <label>Item Check</label>
                  <div style={{ padding: "8px", background: "#f8f8f8", borderRadius: "4px", fontSize: "13px" }}>{ngModal.label}</div>
                </div>
                <div className="ng-form-group">
                  <label>Tanggal &amp; Shift</label>
                  <div style={{ padding: "8px", background: "#f8f8f8", borderRadius: "4px", fontSize: "13px" }}>{ngModal.date} {getMonthName(activeMonth)} {activeYear} — Shift {ngModal.shift}</div>
                </div>
                <div className="ng-form-group">
                  <label>Departemen</label>
                  <div style={{ padding: "8px", background: "#fff3cd", borderRadius: "4px", fontSize: "13px", fontWeight: "600" }}>{ngModal.ngDepartment || "-"}</div>
                </div>
                <div className="ng-form-group">
                  <label>Keterangan NG</label>
                  <div style={{ padding: "8px", background: "#fee", borderRadius: "4px", fontSize: "13px", borderLeft: "3px solid #f44336", minHeight: "60px" }}>{ngModal.ngDescription || "-"}</div>
                </div>
                <div className="ng-form-group">
                  <label>Dilaporkan oleh</label>
                  <div style={{ padding: "8px", background: "#f8f8f8", borderRadius: "4px", fontSize: "13px" }}>{ngModal.submittedBy || "-"}</div>
                </div>
                <div className="ng-form-group">
                  <label>Waktu Submit</label>
                  <div style={{ padding: "8px", background: "#f8f8f8", borderRadius: "4px", fontSize: "13px" }}>{ngModal.submittedAt ? new Date(ngModal.submittedAt).toLocaleString("id-ID") : "-"}</div>
                </div>
                <div className="ng-modal-actions">
                  <button onClick={() => setNgModal(null)} className="btn-primary">Tutup</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── PAGE LAYOUT ── */
        .page-content {
          max-width: 1800px;
          padding-left: 95px;
          padding-top: 25px;
          padding-right: 25px;
          padding-bottom: 40px;
          background: #f0f4f8;
          min-height: 100vh;
        }

        /* ── HEADER ── */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #1565c0, #1976d2);
          color: white;
          padding: 16px 22px;
          border-radius: 12px;
          margin-bottom: 14px;
          box-shadow: 0 4px 14px rgba(21, 101, 192, 0.3);
        }
        .header h1 {
          margin: 0;
          color: white;
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .role-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
          color: rgba(255,255,255,0.85);
          font-weight: 600;
        }
        .role-badge {
          background: rgba(255,255,255,0.2);
          color: white;
          padding: 5px 14px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.85rem;
          border: 1px solid rgba(255,255,255,0.3);
        }

        /* ── BUTTON GROUP ── */
        .button-group {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
          padding: 12px 16px;
          background: white;
          border-radius: 10px;
          border: 1px solid #dde3ea;
          flex-wrap: wrap;
          align-items: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .btn-mode {
          padding: 8px 18px;
          border: 2px solid #dde3ea;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 13px;
        }
        .btn-mode:hover {
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1d4ed8;
        }
        .btn-mode.active {
          background: #1976d2;
          color: white;
          border-color: #1565c0;
          box-shadow: 0 2px 8px rgba(25, 118, 210, 0.35);
        }

        /* ── MONTH NAV AREA ── */
        .month-header {
          text-align: center;
          font-size: 1rem;
          font-weight: 700;
          color: #0d47a1;
          background: #dbeafe;
          padding: 8px 0;
        }
        .week-header {
          text-align: center;
          font-weight: 600;
          background: #f0f7ff;
          border-bottom: 1px solid #ddd;
          color: #1565c0;
        }

        /* ── TABLE ── */
        .table-wrapper {
          overflow-x: auto;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.09);
          background: white;
          margin-bottom: 12px;
        }
        .status-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 0.82rem;
        }
        .status-table th,
        .status-table td {
          padding: 7px 6px;
          text-align: center;
          border: 1px solid #dde3ea;
          vertical-align: middle;
        }
        .status-table th {
          background: #1e3a8a;
          color: white;
          font-weight: 700;
          position: sticky;
          top: 0;
          z-index: 2;
          font-size: 12px;
          padding: 7px 6px;
        }

        /* ── LEFT-SIDE COLUMNS (text data) ── */
        .status-table td.col-machine,
        .status-table td.col-kind,
        .status-table td.col-size {
          text-align: left;
          padding: 7px 10px;
          font-size: 0.82rem;
          font-weight: 500;
          color: #1e293b;
        }
        .status-table td.col-time-cell {
          text-align: center;
          padding: 4px;
          vertical-align: middle;
        }
        .status-table td.col-checkpoint {
          min-width: 230px;
          max-width: 300px;
          text-align: left;
          word-break: break-word;
          white-space: pre-wrap;
          font-size: 11.5px;
          font-weight: 500;
          color: #334155;
          padding: 7px 10px;
        }

        /* ── COLUMN WIDTHS ── */
        .col-checkpoint { min-width: 230px; }
        .col-standard { min-width: 160px; text-align: left; font-size: 11px; color: #475569; }
        .col-waktu { min-width: 110px; font-size: 11px; color: #64748b; }
        .col-machine { min-width: 110px; }
        .col-kind { min-width: 90px; }
        .col-size { min-width: 55px; }
        .col-no { min-width: 36px; font-weight: 700; color: #1e3a8a; }
        .col-item { min-width: 130px; text-align: left; font-weight: 600; padding-left: 8px; }
        .col-method { min-width: 90px; font-size: 11px; }
        .col-area { min-width: 60px; font-size: 11px; }
        .col-shift { min-width: 46px; font-weight: 700; font-size: 12px; }
        .col-freq { min-width: 90px; font-size: 11px; }
        .col-judge { min-width: 90px; font-size: 11px; }
        .col-tool { min-width: 100px; text-align: left; font-weight: 600; }
        .col-control { min-width: 80px; }
        .col-time { min-width: 46px; font-size: 11px; }
        .col-day { min-width: 36px; font-size: 11px; }
        .col-week-header { font-size: 11px; }

        /* Date columns */
        .col-date { min-width: 34px; font-size: 11px; }
        .col-date-pa { min-width: 34px; font-size: 11px; background: #f0f7ff; color: #0369a1; font-weight: 700; }
        .col-date-today {
          background: #fef3c7 !important;
          color: #b45309 !important;
          font-weight: 800 !important;
        }
        .col-date-cell {
          min-width: 34px;
          height: 34px;
          padding: 2px 1px;
        }

        /* ── STATUS BADGE ── */
        .status-badge {
          display: inline-block;
          width: 100%;
          padding: 3px 4px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 11px;
          text-align: center;
          user-select: none;
        }
        .status-badge-ok {
          background: #22c55e;
          color: white;
        }
        .status-badge-ng {
          background: #ef4444;
          color: white;
          cursor: pointer;
        }
        .status-badge-ng:hover {
          background: #dc2626;
        }

        /* ── HELPER CLASSES ── */
        .bg-gray-200 { background-color: #e0e0e0 !important; }
        .bg-gray-100 { background-color: #f5f5f5 !important; }
        .bg-blue-50  { background-color: #eff6ff !important; }
        .text-center { text-align: center; }

        /* ── MODAL ── */
        .ng-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.52);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 16px;
        }
        .ng-modal {
          background: white;
          padding: 0;
          border-radius: 12px;
          width: 90%;
          max-width: 480px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.22);
          overflow: hidden;
        }
        .ng-modal h3 {
          margin: 0;
          padding: 14px 20px;
          background: #fef2f2;
          color: #b91c1c;
          border-bottom: 1px solid #fecaca;
          font-size: 15px;
          font-weight: 700;
        }
        .ng-form-group {
          margin: 0;
          padding: 10px 20px 0;
        }
        .ng-form-group:last-of-type {
          padding-bottom: 6px;
        }
        .ng-form-group label {
          display: block;
          margin-bottom: 4px;
          font-weight: 600;
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ng-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 12px 20px;
          border-top: 1px solid #e2e8f0;
          margin-top: 10px;
        }
        /* ── DCI Item Cell ── */
        .dci-modal-other-section { margin-top: 14px; padding: 12px 14px; background: #fffbeb; border: 1.5px solid #fed7aa; border-radius: 8px; }
        .dci-modal-other-header  { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; }
        .dci-modal-other-title   { font-size: 13px; font-weight: 700; color: #92400e; }
        .dci-modal-other-text    { font-size: 13px; color: #1e293b; line-height: 1.5; white-space: pre-wrap; }
        .dci-modal-photo-section { margin-top: 14px; }
        .dci-modal-photo-header  { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .dci-modal-photo-title   { font-size: 13px; font-weight: 700; color: #1e293b; }
        .dci-modal-photo-count   { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 20px; }
        .dci-modal-photo-grid    { display: flex; flex-wrap: wrap; gap: 8px; }
        .dci-modal-photo-thumb   { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 2px solid #e2e8f0; cursor: pointer; transition: transform 0.15s; }
        .dci-modal-photo-thumb:hover { transform: scale(1.05); border-color: #7c3aed; }
        .dci-item-cell { font-weight: 700; color: #1e293b; font-size: 13px; line-height: 1.3; }

        /* ── DCI Modal ── */
        .ng-modal--dci { max-width: 520px; padding: 0; overflow: hidden; }

        .dci-modal-header { display: flex; align-items: center; gap: 14px; padding: 20px 24px 16px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; }
        .dci-modal-badge-ng { background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4); color: white; font-size: 13px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.05em; white-space: nowrap; }
        .dci-modal-title-block { flex: 1; }
        .dci-modal-title { margin: 0 0 2px; font-size: 16px; font-weight: 800; color: white; }
        .dci-modal-subtitle { margin: 0; font-size: 11px; color: rgba(255,255,255,0.8); font-weight: 500; }
        .dci-modal-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; }
        .dci-modal-close:hover { background: rgba(255,255,255,0.35); }

        .dci-modal-info-grid { padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid #f1f5f9; }
        .dci-modal-info-row { display: flex; align-items: flex-start; gap: 12px; }
        .dci-modal-info-label { min-width: 120px; font-size: 12px; font-weight: 600; color: #64748b; padding-top: 2px; }
        .dci-modal-info-value { flex: 1; font-size: 13px; font-weight: 500; color: #1e293b; }
        .dci-modal-item-name { font-weight: 700; font-size: 14px; color: #0f172a; letter-spacing: 0.01em; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .dci-modal-gauge-badge { display: inline-block; background: #0f172a; color: #67e8f9; font-size: 10px; font-weight: 700; font-family: monospace; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.05em; white-space: nowrap; }
        .dci-modal-shift-badge { display: inline-block; margin-left: 8px; background: #1e3a8a; color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
        .dci-modal-area { color: #7c3aed; font-weight: 600; }
        .dci-modal-carline { color: #0369a1; font-weight: 700; font-family: monospace; font-size: 14px; }

        .dci-modal-ng-section { padding: 16px 24px; background: #fffbeb; }
        .dci-modal-ng-section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .dci-modal-ng-section-icon { font-size: 16px; }
        .dci-modal-ng-section-title { font-size: 13px; font-weight: 700; color: #92400e; flex: 1; }
        .dci-modal-ng-count { display: inline-block; margin-left: 8px; background: #ef4444; color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; vertical-align: middle; }
        .dci-modal-ng-list { display: flex; flex-direction: column; gap: 7px; }
        .dci-modal-ng-item { display: flex; align-items: flex-start; gap: 10px; padding: 9px 13px; background: white; border: 1.5px solid #fca5a5; border-radius: 8px; }
        .dci-modal-ng-bullet { color: #ef4444; font-weight: 800; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
        .dci-modal-ng-text { font-size: 13px; color: #1e293b; font-weight: 500; line-height: 1.4; }
        .dci-modal-ng-empty { padding: 12px; background: white; border: 1.5px dashed #e2e8f0; border-radius: 8px; font-size: 13px; color: #94a3b8; text-align: center; }

        .dci-modal-footer-info { padding: 10px 24px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #f1f5f9; gap: 8px; flex-wrap: wrap; }
        .ng-modal--dci .ng-modal-actions { padding: 12px 24px; border-top: none; }

        .ng-modal-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
        .btn-primary {
          background: #1976d2;
          color: white;
        }
        .btn-primary:hover {
          background: #1565c0;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .page-content {
            padding-left: 70px;
            padding-top: 20px;
            padding-right: 16px;
          }
          .header h1 { font-size: 1rem; }
          .status-table { font-size: 0.76rem; }
          .status-table th,
          .status-table td { padding: 5px 4px; font-size: 0.76rem; }
          .col-machine { min-width: 80px; }
          .col-kind { min-width: 70px; }
        }

        @media (max-width: 768px) {
          .page-content {
            padding-left: 16px;
            padding-top: 16px;
            padding-right: 12px;
          }
          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 14px 16px;
          }
          .header h1 { font-size: 0.95rem; }
          .role-info { font-size: 0.8rem; }
          .button-group { gap: 6px; padding: 10px 12px; }
          .btn-mode { padding: 6px 12px; font-size: 0.75rem; }
          .status-table { font-size: 0.72rem; }
          .status-table th,
          .status-table td { padding: 4px 3px; font-size: 0.7rem; }
          .col-checkpoint { min-width: 160px; }
          .col-machine { min-width: 70px; }
          .col-kind { min-width: 60px; }
          .col-size { min-width: 40px; }
          .col-shift,
          .col-waktu,
          .col-standard { min-width: 60px; }
          .col-date-cell { min-width: 28px; height: 28px; }
          .status-badge { font-size: 10px; padding: 2px 3px; }
        }

        @media (max-width: 600px) {
          .page-content {
            padding-left: 6px;
            padding-top: 8px;
            padding-right: 6px;
          }
          .header {
            padding: 10px;
            border-radius: 8px;
          }
          .header h1 { font-size: 0.8rem; }
          .button-group {
            gap: 4px;
            padding: 8px;
          }
          .btn-mode {
            padding: 5px 8px;
            font-size: 0.65rem;
            flex: 1;
            min-width: 60px;
            text-align: center;
          }
          .status-table { font-size: 0.65rem; }
          .status-table th,
          .status-table td { padding: 3px 2px; font-size: 0.65rem; border: 0.5px solid #cbd5e1; }
          .col-checkpoint { min-width: 120px; font-size: 10px; }
          .col-machine { min-width: 60px; }
          .col-kind { min-width: 50px; }
          .col-size { min-width: 30px; }
          .ng-modal { width: 96%; }
          .ng-modal h3 { font-size: 0.95rem; }
        }
      `}</style>

      {/* Photo Zoom Modal */}
      {photoZoomSrc && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
          onClick={() => setPhotoZoomSrc(null)}
        >
          <div style={{ position:"relative", maxWidth:"95vw", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPhotoZoomSrc(null)}
              style={{ position:"absolute", top:-14, right:-14, width:32, height:32, background:"#ef4444", color:"white", border:"3px solid white", borderRadius:"50%", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}
            >✕</button>
            <img src={photoZoomSrc} alt="Foto NG" style={{ maxWidth:"100%", maxHeight:"90vh", borderRadius:10, objectFit:"contain", boxShadow:"0 8px 40px rgba(0,0,0,0.5)", display:"block" }} />
          </div>
        </div>
      )}
    </>
  )
}