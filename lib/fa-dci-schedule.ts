// lib/fa-dci-schedule.ts
// Logika schedule weekly Final Assy Inspector.
//
// Sumber: analisis Excel "Daily Check Inspector Final Assy" (grey cell = skip).
//
// WEEKLY ITEMS:
//   Item 3  (GO NO GO)                   — checkpoint index 5 saja yang weekly
//   Item 6  (IMPORTANT / INSPECTION POINT) — SEMUA checkpoint weekly
//   Item 10 (INSPECTION BOARD)            — SEMUA checkpoint weekly
//
// JADWAL:
//   Shift A aktif: tgl 1, 8, 15, 22, 29  → ((dateDay - 1) % 7 + 7) % 7 === 0
//   Shift B aktif: tgl 3, 10, 17, 24, 31 → ((dateDay - 3) % 7 + 7) % 7 === 0
//
// ─── BUG FIXES (dari versi sebelumnya) ──────────────────────────────────────
//
// BUG 1 — isDciItemActiveToday dipanggil untuk item 3 (GO NO GO):
//   Item 3 punya scheduleType='daily' (karena item-level daily, hanya 1
//   checkpoint yang weekly). Fungsi lama langsung return true karena
//   scheduleType='daily', tanpa memeriksa weeklyCheckpointIndex.
//   Akibatnya getActiveNgChoices/getActiveCheckpoints selalu mengembalikan
//   SEMUA pilihan termasuk yang seharusnya di-skip.
//   FIX: Pisahkan isWeeklyScheduleActive() yang murni cek tanggal/shift,
//   tanpa mempedulikan scheduleType item.
//
// BUG 2 — JavaScript modulo negatif:
//   (dateDay - anchor) % 7 bisa bernilai negatif di JS (misal dateDay=1,
//   anchor=3 → (1-3)%7 = -2, bukan 5). Harus pakai:
//   ((dateDay - anchor) % 7 + 7) % 7 === 0
// ─────────────────────────────────────────────────────────────────────────────

export interface FADciItem {
  id: number;
  itemCheck: string;
  checkpoints: string[];
  ngChoices: string[];
  /**
   * 'daily'  = item selalu aktif.
   * 'weekly' = SEMUA checkpoint item ini weekly (item 6, 10).
   */
  scheduleType: 'daily' | 'weekly';
  /**
   * Index checkpoint (0-based) yang bersifat weekly DALAM item yang
   * otherwise daily. Hanya item 3 (GO NO GO) yang punya nilai ini.
   * Checkpoint lain di item tersebut tetap daily.
   */
  weeklyCheckpointIndex?: number;
}

// ─── DCI Items ────────────────────────────────────────────────────────────────
export const FA_DCI_ITEMS: FADciItem[] = [
  {
    id: 1, scheduleType: 'daily',
    itemCheck: "PIPO",
    checkpoints: [
      "Ada nomor register",
      "PIPO dalam kondisi baik dan tidak rusak",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER",
      "PIPO TIDAK DALAM KONDISI BAIK / RUSAK",
    ],
  },
  {
    id: 2, scheduleType: 'daily',
    itemCheck: "ROLL METER / MISTAR BAJA",
    checkpoints: [
      "Ada nomor register + kalibrasi tidak expired",
      "Garis angka terbaca dengan jelas / tidak berkarat",
      "Roll meter / mistar baja dalam kondisi baik dan tidak rusak",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED",
      "GARIS ANGKA TIDAK TERBACA DENGAN JELAS / BERKARAT",
      "ROLL METER / MISTAR BAJA TIDAK DALAM KONDISI BAIK / RUSAK",
    ],
  },
  {
    id: 3,
    scheduleType: 'daily',         // item-level = daily (5 cp pertama daily)
    weeklyCheckpointIndex: 5,      // cp ke-6 (index 5) = weekly
    itemCheck: "GO NO GO",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",              // 0 daily
      "Tidak ada skrup yang kendor / hilang",                       // 1 daily
      "Kondisi GO NO GO dalam keadaan baik & bagian belakang (wire) dilindungi tape / spiral", // 2 daily
      "Ada stiker warna hijau pada GO NO GO terminal (M terminal) dan tidak lepas",            // 3 daily
      "Kondisi GO NO GO terminal dalam keadaan OK (tidak aus, tidak bent, tidak patah, tidak deformasi)", // 4 daily
      "Bisa mendeteksi kondisi OK dan N-OK melalui sample OK dan N-OK", // 5 ← WEEKLY
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",        // 0 daily
      "ADA SKRUP YANG KENDOR / HILANG",                             // 1 daily
      "KONDISI GO NO GO TIDAK BAIK / BAGIAN BELAKANG (WIRE) TIDAK DILINDUNGI TAPE / SPIRAL", // 2 daily
      "TIDAK ADA STIKER WARNA HIJAU PADA GO NO GO TERMINAL (M TERMINAL) / LEPAS",            // 3 daily
      "KONDISI GO NO GO TERMINAL TIDAK OK (AUS / BENT / PATAH / DEFORMASI)",                 // 4 daily
      "TIDAK BISA MENDETEKSI KONDISI OK DAN N-OK",                  // 5 ← WEEKLY
    ],
  },
  {
    id: 4, scheduleType: 'daily',
    itemCheck: "PUSH GAUGE RB",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Tidak ada skrup yang kendor / hilang",
      "Ada bantalan karet (cushion) pada ujungnya",
      "Lampu indikator menyala",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "ADA SKRUP YANG KENDOR / HILANG",
      "TIDAK ADA BANTALAN KARET (CUSHION) PADA UJUNGNYA",
      "LAMPU INDIKATOR TIDAK MENYALA",
    ],
  },
  {
    id: 5, scheduleType: 'daily',
    itemCheck: "DUMMY SAMPLE OK & N-OK",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Sample dalam kondisi baik dan tidak rusak",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "SAMPLE TIDAK DALAM KONDISI BAIK / RUSAK",
    ],
  },
  {
    id: 6,
    scheduleType: 'weekly',        // ← SEMUA checkpoint weekly
    itemCheck: "IMPORTANT / INSPECTION POINT",
    checkpoints: [
      "Important / Inspection Point terbaca dengan jelas dan tidak rusak",
      "Isi Important / Inspection Point sesuai dengan level terbaru",
    ],
    ngChoices: [
      "IMPORTANT / INSPECTION POINT TIDAK TERBACA DENGAN JELAS / RUSAK",
      "ISI IMPORTANT / INSPECTION POINT TIDAK SESUAI DENGAN LEVEL TERBARU",
    ],
  },
  {
    id: 7, scheduleType: 'daily',
    itemCheck: "FUSE PLATE",
    checkpoints: [
      "Ada nomor register + verifikasi tidak expired",
      "Warna dan angka ada dan terbaca dengan jelas",
      "Fuse plate dalam kondisi baik dan tidak rusak",
      "Fuse insertion / penekan fuse dalam kondisi OK",
    ],
    ngChoices: [
      "TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED",
      "WARNA DAN ANGKA TIDAK ADA / TIDAK TERBACA DENGAN JELAS",
      "FUSE PLATE TIDAK DALAM KONDISI BAIK / RUSAK",
      "FUSE INSERTION / PENEKAN FUSE TIDAK DALAM KONDISI OK",
    ],
  },
  {
    id: 8, scheduleType: 'daily',
    itemCheck: "LAMPU NAVIGASI",
    checkpoints: [
      "Lampu LED kondisi menyala",
      "Cover LED tidak hilang atau pecah",
      "Lampu LED terpasang sempurna / tidak lepas",
    ],
    ngChoices: [
      "LAMPU LED TIDAK MENYALA / MATI",
      "COVER LED HILANG ATAU PECAH",
      "LAMPU LED TIDAK TERPASANG SEMPURNA / LEPAS",
    ],
  },
  {
    id: 9, scheduleType: 'daily',
    itemCheck: "TAPE NAVIGASI",
    checkpoints: [
      "Lampu LED kondisi menyala",
      "Kondisi switch tidak rusak",
      "Ada identitas tape",
    ],
    ngChoices: [
      "LAMPU LED TIDAK MENYALA / MATI",
      "KONDISI SWITCH RUSAK",
      "TIDAK ADA IDENTITAS TAPE",
    ],
  },
  {
    id: 10,
    scheduleType: 'weekly',        // ← SEMUA checkpoint weekly
    itemCheck: "INSPECTION BOARD",
    checkpoints: [
      "Tidak ada skrup & baut yang menonjol dan tajam",
      "Approval sheet sesuai level terakhir",
      "Approval sheet ditanda tangani QA",
      "Kondisi sample dan plastik tidak rusak",
    ],
    ngChoices: [
      "ADA SKRUP & BAUT YANG MENONJOL DAN TAJAM",
      "APPROVAL SHEET TIDAK SESUAI LEVEL TERAKHIR",
      "APPROVAL SHEET TIDAK DITANDA TANGANI QA",
      "KONDISI SAMPLE DAN PLASTIK RUSAK",
    ],
  },
  {
    id: 11, scheduleType: 'daily',
    itemCheck: "DRY SURF",
    checkpoints: [
      "Botol tidak bocor / rusak & ada sticker B3",
      "Spons / kuas tidak rusak / aus",
      "Ada tanda MAX & MIN pada botol dan isi cairan sesuai rentang MAX dan MIN",
    ],
    ngChoices: [
      "BOTOL BOCOR / RUSAK / TIDAK ADA STICKER B3",
      "SPONS / KUAS RUSAK / AUS",
      "TIDAK ADA TANDA MAX & MIN PADA BOTOL / ISI CAIRAN TIDAK SESUAI RENTANG MAX DAN MIN",
    ],
  },
  {
    id: 12, scheduleType: 'daily',
    itemCheck: "PACKING",
    checkpoints: [
      "Kondisi tutup polytainer tidak rusak dan jumlahnya sudah sesuai (TNGA: 5 pcs, selain TNGA: 4 pcs per pattern yang jalan)",
      "HT scan bisa berfungsi dengan baik",
      "Majun dan sikat polytainer ada pada tempatnya dan sesuai dengan jumlahnya (majun 1 pc, sikat 1 pc)",
    ],
    ngChoices: [
      "KONDISI TUTUP POLYTAINER RUSAK / JUMLAH TIDAK SESUAI",
      "HT SCAN TIDAK BISA BERFUNGSI DENGAN BAIK",
      "MAJUN DAN SIKAT POLYTAINER TIDAK ADA / JUMLAH TIDAK SESUAI",
    ],
  },
];

// ─── Specific area → item IDs ─────────────────────────────────────────────────
export const FA_SPECIFIC_AREA_ITEMS: Record<string, number[]> = {
  "WP CHECK":          [1, 3, 5, 6],
  "CHECKER":           [1, 3, 5, 6, 7, 9, 10],
  "VISUAL 1":          [1, 2, 3, 5, 6, 8, 9, 10],
  "VISUAL 2":          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "DOUBLE CHECK (RI)": [1, 3, 4, 5, 6, 10, 12],
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNGSI INTI (FIXED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ✅ FIX BUG 2: Cek apakah jadwal weekly aktif untuk tanggal & shift tertentu.
 *
 * Murni berbasis tanggal + shift, TIDAK melihat scheduleType item.
 * Dipakai sebagai building block oleh fungsi lain.
 *
 * Formula: ((dateDay - anchor) % 7 + 7) % 7 === 0
 * +7 sebelum modulo kedua mencegah hasil negatif di JavaScript.
 *
 * Shift A anchor=1 → aktif tgl 1, 8, 15, 22, 29
 * Shift B anchor=3 → aktif tgl 3, 10, 17, 24, 31
 */
export function isWeeklyScheduleActive(shift: 'A' | 'B', dateDay: number): boolean {
  const anchor = shift === 'A' ? 1 : 3;
  return ((dateDay - anchor) % 7 + 7) % 7 === 0;
}

/**
 * ✅ FIX BUG 1 + BUG 2: Apakah item DCI (atau checkpoint weekly-nya) aktif?
 *
 * - scheduleType='daily'  → selalu aktif (item bisa tampil setiap hari)
 * - scheduleType='weekly' → aktif hanya di jadwal mingguan
 * - weeklyCheckpointIndex → item-level daily, TAPI ada checkpoint tertentu
 *   yang weekly; fungsi ini mengembalikan apakah checkpoint weekly-nya aktif.
 *   (Dipakai oleh getActiveCheckpoints / getActiveNgChoices)
 */
export function isDciWeeklyPartActive(
  item: FADciItem,
  shift: 'A' | 'B',
  dateDay: number,
): boolean {
  // Item sepenuhnya weekly (item 6, 10)
  if (item.scheduleType === 'weekly') {
    return isWeeklyScheduleActive(shift, dateDay);
  }
  // Item dengan satu checkpoint weekly (item 3 - GO NO GO)
  // weeklyCheckpointIndex ada → kita cek jadwal untuk checkpoint itu
  if (item.weeklyCheckpointIndex !== undefined) {
    return isWeeklyScheduleActive(shift, dateDay);
  }
  // Item daily murni
  return true;
}

/**
 * Apakah item harus disembunyikan SEPENUHNYA dari daftar checklist?
 *
 * Aturan:
 * - scheduleType='weekly' yang tidak aktif → sembunyikan
 * - scheduleType='daily' dengan weeklyCheckpointIndex → TIDAK sembunyikan
 *   (checkpoint lain tetap harus dicek)
 */
export function shouldHideDciItem(
  item: FADciItem,
  shift: 'A' | 'B',
  dateDay: number,
): boolean {
  if (item.scheduleType === 'weekly') {
    return !isWeeklyScheduleActive(shift, dateDay);
  }
  // Item daily (dengan atau tanpa weeklyCheckpointIndex) tidak disembunyikan
  return false;
}

/**
 * ✅ FIX BUG 1: Kembalikan checkpoints yang aktif untuk item ini.
 *
 * Untuk item 3 (GO NO GO, weeklyCheckpointIndex=5):
 *   - Jika jadwal weekly TIDAK aktif → filter keluar checkpoint index 5
 *   - Jika aktif → kembalikan semua
 *
 * Untuk item daily lain → kembalikan semua checkpoint.
 * Untuk item weekly (6, 10) → sudah di-hide via shouldHideDciItem,
 *   fungsi ini tidak akan dipanggil; tapi jika dipanggil, kembalikan semua.
 */
export function getActiveCheckpoints(
  item: FADciItem,
  shift: 'A' | 'B',
  dateDay: number,
): string[] {
  // Tidak ada checkpoint partial yang weekly → kembalikan semua
  if (item.weeklyCheckpointIndex === undefined) return item.checkpoints;

  // ✅ FIX: pakai isWeeklyScheduleActive(), BUKAN isDciWeeklyPartActive(item,...)
  // Sebelumnya memanggil isDciItemActiveToday(item,...) yang langsung return
  // true untuk scheduleType='daily', sehingga checkpoint 5 selalu muncul.
  const weeklyActive = isWeeklyScheduleActive(shift, dateDay);
  if (weeklyActive) return item.checkpoints;

  // Jadwal weekly tidak aktif → filter keluar checkpoint weekly
  return item.checkpoints.filter((_, i) => i !== item.weeklyCheckpointIndex);
}

/**
 * ✅ FIX BUG 1: Kembalikan ngChoices yang aktif untuk item ini.
 *
 * Sama seperti getActiveCheckpoints, untuk item 3 (GO NO GO):
 * jika jadwal weekly tidak aktif, filter keluar ngChoice index 5.
 */
export function getActiveNgChoices(
  item: FADciItem,
  shift: 'A' | 'B',
  dateDay: number,
): string[] {
  if (item.weeklyCheckpointIndex === undefined) return item.ngChoices;

  // ✅ FIX: pakai isWeeklyScheduleActive() langsung
  const weeklyActive = isWeeklyScheduleActive(shift, dateDay);
  if (weeklyActive) return item.ngChoices;

  return item.ngChoices.filter((_, i) => i !== item.weeklyCheckpointIndex);
}

/**
 * Fungsi utama: dapatkan semua item DCI yang aktif untuk specific area,
 * shift, dan tanggal tertentu.
 */
export function getActiveDciItems(
  specificArea: string,
  shift: 'A' | 'B',
  dateDay: number,
): FADciItem[] {
  const allowedIds = FA_SPECIFIC_AREA_ITEMS[specificArea];
  let items = allowedIds
    ? FA_DCI_ITEMS.filter(item => allowedIds.includes(item.id))
    : FA_DCI_ITEMS;

  // Sembunyikan item yang sepenuhnya tidak aktif (item 6, 10 saat bukan jadwal)
  return items.filter(item => !shouldHideDciItem(item, shift, dateDay));
}

/**
 * Item weekly yang di-skip hari ini (untuk info box).
 */
export function getSkippedWeeklyItems(
  specificArea: string,
  shift: 'A' | 'B',
  dateDay: number,
): FADciItem[] {
  const allowedIds = FA_SPECIFIC_AREA_ITEMS[specificArea];
  const items = allowedIds
    ? FA_DCI_ITEMS.filter(item => allowedIds.includes(item.id))
    : FA_DCI_ITEMS;

  return items.filter(item => shouldHideDciItem(item, shift, dateDay));
}

/** Deskripsi jadwal weekly untuk UI. */
export function getWeeklyScheduleDesc(shift: 'A' | 'B'): string {
  return shift === 'A'
    ? 'Setiap tanggal 1, 8, 15, 22, 29'
    : 'Setiap tanggal 3, 10, 17, 24, 31';
}

/**
 * Badge info schedule untuk DCI card header.
 * Hanya muncul untuk item yang punya komponen weekly.
 */
export function getScheduleBadge(
  item: FADciItem,
  shift: 'A' | 'B',
  dateDay: number,
): { label: string; color: string; bg: string } | null {
  // Item daily murni → tidak ada badge
  if (item.scheduleType === 'daily' && item.weeklyCheckpointIndex === undefined) {
    return null;
  }

  // ✅ FIX: pakai isWeeklyScheduleActive() untuk konsistensi
  const active = isWeeklyScheduleActive(shift, dateDay);
  const anchor = shift === 'A' ? 1 : 3;

  if (!active) {
    return {
      label: `📅 Weekly — jadwal: tgl ${anchor}, ${anchor+7}, ${anchor+14}...`,
      color: '#92400e',
      bg:    '#fef3c7',
    };
  }
  return {
    label: '✅ Weekly check aktif hari ini',
    color: '#166534',
    bg:    '#dcfce7',
  };
}

// ─── Unit-test kecil (jalankan di Node.js untuk verifikasi) ──────────────────
// Uncomment untuk testing:
/*
function runTests() {
  const item3 = FA_DCI_ITEMS.find(i => i.id === 3)!;
  const item6 = FA_DCI_ITEMS.find(i => i.id === 6)!;

  // Tgl 18 Shift A: bukan jadwal weekly → cp index 5 harus hilang
  console.assert(!isWeeklyScheduleActive('A', 18), 'tgl 18 shift A bukan weekly');
  console.assert(getActiveCheckpoints(item3, 'A', 18).length === 5, 'GO NO GO: 5 cp aktif');
  console.assert(getActiveNgChoices(item3, 'A', 18).length === 5, 'GO NO GO: 5 ngChoice aktif');
  console.assert(shouldHideDciItem(item6, 'A', 18), 'Item 6 hidden tgl 18');

  // Tgl 1 Shift A: jadwal weekly aktif → semua cp muncul
  console.assert(isWeeklyScheduleActive('A', 1), 'tgl 1 shift A adalah weekly');
  console.assert(getActiveCheckpoints(item3, 'A', 1).length === 6, 'GO NO GO: 6 cp aktif');
  console.assert(getActiveNgChoices(item3, 'A', 1).length === 6, 'GO NO GO: 6 ngChoice aktif');
  console.assert(!shouldHideDciItem(item6, 'A', 1), 'Item 6 tampil tgl 1');

  // Tgl 3 Shift B: jadwal weekly aktif
  console.assert(isWeeklyScheduleActive('B', 3), 'tgl 3 shift B adalah weekly');
  console.assert(!shouldHideDciItem(item6, 'B', 3), 'Item 6 tampil tgl 3 shift B');

  // Edge case: modulo negatif tidak terjadi
  console.assert(!isWeeklyScheduleActive('B', 1), 'tgl 1 shift B bukan weekly (cek negatif modulo)');

  console.log('✅ All tests passed');
}
runTests();
*/