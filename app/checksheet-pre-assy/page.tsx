// app/checksheet-pre-assy/page.tsx
// [OFFLINE SAVE] Tambah support offline via saveChecklistOffline (IndexedDB).
// Perubahan dari versi sebelumnya:
//   1. Import saveChecklistOffline dari lib/offline/saveOffline
//   2. Import saveCache, getCache untuk cache GET offline-first
//   3. loadSavedResults: cache-first, API background merge, tidak ada reset setelah load
//   4. updateLocalCachePreAssy: update cache GET lokal setelah setiap save
//   5. handleSubmit: offline fallback via saveChecklistOffline
// UI, payload, dan semua logika bisnis TIDAK berubah.

"use client";
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { saveChecklistOffline } from "@/lib/offline/saveOffline";
import { saveCache, getCache } from "@/lib/offline/cache";
import { loadPhysicalBinding } from "@/lib/device/binding-storage";

interface ChecklistItem { id: number; checkPoint: string; standard: string; }
interface ChecklistResult { itemId: number; status: "OK" | "NG" | null; notes: string; }
interface DailyCheckInsItem { id: number; itemCheck: string; checkpoints: string[]; ngChoices: string[]; }
interface DailyCheckInsResult {
  itemId: number; status: "OK" | "NG" | null;
  selectedNgChoices: string[]; ngOtherNote: string; ngPhotos: string[];
}
interface CSRemoveToolChecksheetItem { id: number; toolType: string; ngChoices: string[]; }
interface CSRemoveToolResult {
  itemId: number; status: "OK" | "NG" | null;
  selectedNgChoices: string[]; ngPhotos: string[];
}

type PreAssyCategoryCode =
  | "pre-assy-daily-gl" | "pre-assy-cc-stripping-gl"
  | "pre-assy-daily-check-ins" | "pre-assy-cs-remove-tool" | "pre-assy-pressure-jig";

const getLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getSelectableDates = (): { label: string; value: string; date: Date }[] => {
  const today = new Date();
  const dates: { label: string; value: string; date: Date }[] = [];
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getLocalDateKey(d);
    const label = i === 0 ? `Hari Ini (${key})` : i === 1 ? `Kemarin (${key})` : key;
    dates.push({ label, value: key, date: d });
  }
  return dates;
};

const CC_TIME_SLOTS = ["01.00", "04.00", "08.00", "13.00", "16.00", "20.00"];
const CC_TIME_SLOT_MINUTES = [60, 240, 480, 780, 960, 1200];
const getCurrentTimeSlot = (now: Date = new Date()): string => {
  const total = now.getHours() * 60 + now.getMinutes();
  let idx = -1;
  for (let i = CC_TIME_SLOT_MINUTES.length - 1; i >= 0; i--) {
    if (total >= CC_TIME_SLOT_MINUTES[i]) { idx = i; break; }
  }
  if (idx === -1) idx = CC_TIME_SLOT_MINUTES.length - 1;
  return CC_TIME_SLOTS[idx];
};

const CATEGORY_LABELS: Record<PreAssyCategoryCode, string> = {
  "pre-assy-daily-gl":        "Daily Check Group Leader",
  "pre-assy-cc-stripping-gl": "CallCheck CC & Stripping GL",
  "pre-assy-daily-check-ins": "Daily Check Inspector",
  "pre-assy-cs-remove-tool":  "Check Sheet Control Remove Tool",
  "pre-assy-pressure-jig":    "Daily Check Pressure Jig",
};
const CATEGORY_ALLOWED_ROLES: Record<PreAssyCategoryCode, string[]> = {
  "pre-assy-daily-gl":        ["group-leader-qa"],
  "pre-assy-cc-stripping-gl": ["group-leader-qa"],
  "pre-assy-daily-check-ins": ["inspector-qa"],
  "pre-assy-cs-remove-tool":  ["inspector-qa"],
  "pre-assy-pressure-jig":    ["inspector-qa"],
};
const CATEGORY_ROLE_BADGE: Record<PreAssyCategoryCode, { label: string; cls: string }> = {
  "pre-assy-daily-gl":        { label: "GL",        cls: "gl"  },
  "pre-assy-cc-stripping-gl": { label: "GL",        cls: "gl"  },
  "pre-assy-daily-check-ins": { label: "Inspector", cls: "ins" },
  "pre-assy-cs-remove-tool":  { label: "Inspector", cls: "ins" },
  "pre-assy-pressure-jig":    { label: "Inspector", cls: "ins" },
};
function getDefaultCategoryForRole(role: string): PreAssyCategoryCode {
  return role === "group-leader-qa" ? "pre-assy-daily-gl" : "pre-assy-daily-check-ins";
}

// ─── Helper: buat cacheKey konsisten ─────────────────────────────────────────
// Format: `pre-assy-${categoryCode}-${areaCode}-${shift}-${dateKey}-${conveyor}-${specificArea||'all'}`
// IDENTIK dengan yang dipakai sync.ts → tidak ada key mismatch
function buildPreAssyCacheKey(
  categoryCode: string,
  areaCode: string,
  shift: string,
  dateKey: string,
  conveyor: string,
  specificArea: string
): string {
  const conveyorNorm     = conveyor.trim().toUpperCase() || 'default';
  const specificAreaNorm = specificArea.trim() || 'all';
  return `pre-assy-${categoryCode}-${areaCode}-${shift}-${dateKey}-${conveyorNorm}-${specificAreaNorm}`;
}

// ─── Helper: update cache GET lokal setelah save ─────────────────────────────
// WAJIB dipanggil SECARA SERIAL — ini melakukan READ-MODIFY-WRITE ke key yang sama.
// Jika diparalelkan (Promise.all), setiap call baca snapshot lama → item lain hilang.
//
// Format itemKey IDENTIK dengan API get-results (backend-pre-assy.txt):
//   DCI:       `${itemId}-${specificArea || 'TENSILE'}-${shift}`
//   CCStrip:   `${itemId}-${shift}-${timeSlot}` atau `${itemId}-${shift}`
//   GL/Pjig:   `${itemId}-${shift}`
//   CRT:       `${itemId}-${shift}` (resolvedItemId sudah merupakan DB id)
async function updateLocalCachePreAssy(params: {
  categoryCode: PreAssyCategoryCode;
  areaCode: string;
  shift: "A" | "B";
  dateKey: string;
  conveyor: string;
  specificArea: string;
  itemId: number;
  status: "OK" | "NG";
  ngDescription: string | null;
  ngPhotos: string[] | null;
  timeSlot: string;
}): Promise<void> {
  try {
    const cacheKey = buildPreAssyCacheKey(
      params.categoryCode, params.areaCode, params.shift,
      params.dateKey, params.conveyor, params.specificArea
    );

    const existing = await getCache(cacheKey);
    const base =
      existing && existing.success && existing.formatted
        ? { ...existing, formatted: { ...existing.formatted } }
        : { success: true, formatted: {} };

    if (!base.formatted[params.dateKey]) base.formatted[params.dateKey] = {};

    // Build itemKey — format identik dengan API response
    let itemKey: string;
    if (params.categoryCode === 'pre-assy-daily-check-ins') {
      const spec = params.specificArea.trim() || 'TENSILE';
      itemKey = `${params.itemId}-${spec}-${params.shift}`;
    } else if (params.categoryCode === 'pre-assy-cc-stripping-gl') {
      itemKey = params.timeSlot
        ? `${params.itemId}-${params.shift}-${params.timeSlot}`
        : `${params.itemId}-${params.shift}`;
    } else {
      // pre-assy-daily-gl, pre-assy-pressure-jig, pre-assy-cs-remove-tool
      itemKey = `${params.itemId}-${params.shift}`;
    }

    // ngPhotos: null jika kosong — konsisten dengan API response
    const ngPhotosStr = Array.isArray(params.ngPhotos) && params.ngPhotos.length > 0
      ? JSON.stringify(params.ngPhotos)
      : null;

    base.formatted[params.dateKey][itemKey] = {
      status:        params.status,
      ngDescription: params.ngDescription || '',
      ngPhotos:      ngPhotosStr,
      ngDepartment:  params.status === 'NG' ? 'QA' : null,
    };

    await saveCache(cacheKey, base);
    console.log(`[updateLocalCachePreAssy] key=${itemKey} cacheKey=${cacheKey}`);
  } catch (err) {
    console.log('[updateLocalCachePreAssy] Error (non-fatal):', err);
  }
}

const ITEMS_BY_CATEGORY: Record<PreAssyCategoryCode, ChecklistItem[]> = {
  "pre-assy-daily-gl": [
    { id: 1,  checkPoint: "Inspector check product yang mengalami perubahan 4M dan hasilnya di update di C/S 4M", standard: "Check pengisian C/S 4M" },
    { id: 2,  checkPoint: "Pengisian LKI dilakukan setelah proses inspection dan diisi secara benar", standard: "Check actual pengisian LKI (Sampling check min. 3 inspector)" },
    { id: 3,  checkPoint: "Circuit defect yang ada di hanger merah sudah terpasang defective tag", standard: "Check kondisi actual" },
    { id: 4,  checkPoint: "Inspector check visual terminal dengan memisahkan 1 lot menjadi beberapa bagian", standard: "Sesuai IS no. QA-ACL-PA-IS-031" },
    { id: 5,  checkPoint: "Cek implementasi pengecekan circuit A/B (Countermeasure claim no stripping J53C)", standard: "Sesuai IS no. QA-ACL-PA-IS-031 hal. 4" },
    { id: 6,  checkPoint: "Circuit di supply dan diletakkan di store sesuai dengan address", standard: "Sampling check circuit yang ada di store" },
    { id: 7,  checkPoint: "Jumlah circuit di troli tidak melebihi kapasitas trolly", standard: "Check kondisi actual (sampling check min. 3 inspector)" },
    { id: 8,  checkPoint: "Cup di trolly ditempatkan sesuai dengan tempat yang disediakan", standard: "Sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 9,  checkPoint: "Cek kondisi Micrometer, Gauge, Tool dan Alat Potong", standard: "Sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 10, checkPoint: "Daily Check Inspector sudah diisi dan update sesuai kondisi actual", standard: "Sesuai IS no. QA-ACL-PA-IS-074, QA-ACL-IS-012" },
    { id: 11, checkPoint: "Tidak ada bagian trolly inspector yang rusak", standard: "Check kondisi actual" },
    { id: 12, checkPoint: "Inspector bekerja sesuai dengan urutan yang ada di SWCT", standard: "Check actual dengan SWCT" },
    { id: 13, checkPoint: "Stop kontak dalam keadaan bersih tidak berdebu", standard: "Check kondisi actual" },
    { id: 14, checkPoint: "Memastikan semua inspector menggunakan penutup kepala", standard: "Check kondisi actual" },
  ],
  "pre-assy-cc-stripping-gl": [
    { id: 1,  checkPoint: "AC90 TRX 01 — IA-CIVUS 0.13: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 2,  checkPoint: "AC90 TRX 02 — IA-CIVUS 0.13: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 3,  checkPoint: "AC90 TRX 03 — IA-CIVUS 0.13: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 4,  checkPoint: "AC90 TRX 04 — CIVUS 0.35: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 5,  checkPoint: "AC90 TRX 05 — AVSS 2.0: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 6,  checkPoint: "AC90 TRX 06 — ALVUS 2.0: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 7,  checkPoint: "AC90 TRX 06 — ALVUS 2.5: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 8,  checkPoint: "AC90 TRX 07 — ALVUS 0.75: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 9,  checkPoint: "AC90 TRX 07 — ALVUS 1.25: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 10, checkPoint: "AC90 TRX 08 — ALVUS 0.5: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 11, checkPoint: "AC90 TRX 08 — ALVUS 0.75: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 12, checkPoint: "AC90 TRX 09 — ALVUS 0.5: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 13, checkPoint: "AC90 TRX 10 — CAVS 0.3: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 14, checkPoint: "AC90 TRX 10 — CAVS 0.5: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 15, checkPoint: "AC90 TRX 10 — CAVS 0.85: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 16, checkPoint: "AC90 TRX 10 — AESSX 0.3: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
    { id: 17, checkPoint: "AC90 TRX 10 — CIVUS 0.35: Hasil CC & Stripping sesuai standard", standard: "Sesuai IS CC & Stripping" },
  ],
  "pre-assy-daily-check-ins": [],
  "pre-assy-cs-remove-tool": [
    { id: 1, checkPoint: "1-150A — Tidak patah / bengkok", standard: "Visual check" },
    { id: 2, checkPoint: "1-150A — Tidak berkarat", standard: "Visual check" },
    { id: 3, checkPoint: "1-150A — Terpasang Cover", standard: "Visual check" },
    { id: 4, checkPoint: "1-150A — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 5, checkPoint: "PA — Tidak patah / bengkok", standard: "Visual check" },
    { id: 6, checkPoint: "PA — Tidak berkarat", standard: "Visual check" },
    { id: 7, checkPoint: "PA — Terpasang Cover", standard: "Visual check" },
    { id: 8, checkPoint: "PA — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 9, checkPoint: "DLI — Tidak patah / bengkok", standard: "Visual check" },
    { id: 10, checkPoint: "DLI — Tidak berkarat", standard: "Visual check" },
    { id: 11, checkPoint: "DLI — Terpasang Cover", standard: "Visual check" },
    { id: 12, checkPoint: "DLI — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 13, checkPoint: "CNR — Tidak patah / bengkok", standard: "Visual check" },
    { id: 14, checkPoint: "CNR — Tidak berkarat", standard: "Visual check" },
    { id: 15, checkPoint: "CNR — Terpasang Cover", standard: "Visual check" },
    { id: 16, checkPoint: "CNR — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 17, checkPoint: "TCNR — Tidak patah / bengkok", standard: "Visual check" },
    { id: 18, checkPoint: "TCNR — Tidak berkarat", standard: "Visual check" },
    { id: 19, checkPoint: "TCNR — Terpasang Cover", standard: "Visual check" },
    { id: 20, checkPoint: "TCNR — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 21, checkPoint: "1-72A — Tidak patah / bengkok", standard: "Visual check" },
    { id: 22, checkPoint: "1-72A — Tidak berkarat", standard: "Visual check" },
    { id: 23, checkPoint: "1-72A — Terpasang Cover", standard: "Visual check" },
    { id: 24, checkPoint: "1-72A — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 25, checkPoint: "1-114 — Tidak patah / bengkok", standard: "Visual check" },
    { id: 26, checkPoint: "1-114 — Tidak berkarat", standard: "Visual check" },
    { id: 27, checkPoint: "1-114 — Terpasang Cover", standard: "Visual check" },
    { id: 28, checkPoint: "1-114 — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 29, checkPoint: "1-42A — Tidak patah / bengkok", standard: "Visual check" },
    { id: 30, checkPoint: "1-42A — Tidak berkarat", standard: "Visual check" },
    { id: 31, checkPoint: "1-42A — Terpasang Cover", standard: "Visual check" },
    { id: 32, checkPoint: "1-42A — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 33, checkPoint: "1-35 — Tidak patah / bengkok", standard: "Visual check" },
    { id: 34, checkPoint: "1-35 — Tidak berkarat", standard: "Visual check" },
    { id: 35, checkPoint: "1-35 — Terpasang Cover", standard: "Visual check" },
    { id: 36, checkPoint: "1-35 — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 37, checkPoint: "1-85 — Tidak patah / bengkok", standard: "Visual check" },
    { id: 38, checkPoint: "1-85 — Tidak berkarat", standard: "Visual check" },
    { id: 39, checkPoint: "1-85 — Terpasang Cover", standard: "Visual check" },
    { id: 40, checkPoint: "1-85 — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 41, checkPoint: "1-83A — Tidak patah / bengkok", standard: "Visual check" },
    { id: 42, checkPoint: "1-83A — Tidak berkarat", standard: "Visual check" },
    { id: 43, checkPoint: "1-83A — Terpasang Cover", standard: "Visual check" },
    { id: 44, checkPoint: "1-83A — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 45, checkPoint: "1-73 — Tidak patah / bengkok", standard: "Visual check" },
    { id: 46, checkPoint: "1-73 — Tidak berkarat", standard: "Visual check" },
    { id: 47, checkPoint: "1-73 — Terpasang Cover", standard: "Visual check" },
    { id: 48, checkPoint: "1-73 — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 49, checkPoint: "1-105 — Tidak patah / bengkok", standard: "Visual check" },
    { id: 50, checkPoint: "1-105 — Tidak berkarat", standard: "Visual check" },
    { id: 51, checkPoint: "1-105 — Terpasang Cover", standard: "Visual check" },
    { id: 52, checkPoint: "1-105 — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 53, checkPoint: "TLC — Tidak patah / bengkok", standard: "Visual check" },
    { id: 54, checkPoint: "TLC — Tidak berkarat", standard: "Visual check" },
    { id: 55, checkPoint: "TLC — Terpasang Cover", standard: "Visual check" },
    { id: 56, checkPoint: "TLC — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 57, checkPoint: "Extraction Jig R — Tidak patah / bengkok", standard: "Visual check" },
    { id: 58, checkPoint: "Extraction Jig R — Tidak berkarat", standard: "Visual check" },
    { id: 59, checkPoint: "Extraction Jig R — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 60, checkPoint: "Extraction Jig G — Tidak patah / bengkok", standard: "Visual check" },
    { id: 61, checkPoint: "Extraction Jig G — Tidak berkarat", standard: "Visual check" },
    { id: 62, checkPoint: "Extraction Jig G — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 63, checkPoint: "Extraction Jig W — Tidak patah / bengkok", standard: "Visual check" },
    { id: 64, checkPoint: "Extraction Jig W — Tidak berkarat", standard: "Visual check" },
    { id: 65, checkPoint: "Extraction Jig W — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 66, checkPoint: "Extraction Jig Y — Tidak patah / bengkok", standard: "Visual check" },
    { id: 67, checkPoint: "Extraction Jig Y — Tidak berkarat", standard: "Visual check" },
    { id: 68, checkPoint: "Extraction Jig Y — Ada dan sesuai control numbernya", standard: "Visual check" },
    { id: 69, checkPoint: "Clipper — Tidak patah / bengkok", standard: "Visual check" },
    { id: 70, checkPoint: "Clipper — Tidak berkarat", standard: "Visual check" },
    { id: 71, checkPoint: "Clipper — Ada dan sesuai control numbernya", standard: "Visual check" },
  ],
  "pre-assy-pressure-jig": [
    { id: 1, checkPoint: "Apakah pressure jig diletakkan sesuai dengan tempatnya", standard: "1x / Hari" },
    { id: 2, checkPoint: "Tidak ada pressure jig yang hilang", standard: "1x / Hari" },
    { id: 3, checkPoint: "Tidak ada pressure jig yang rusak / bent / damage", standard: "1x / Hari" },
    { id: 4, checkPoint: "Apakah pin dari contact pressure jig bisa digunakan dengan mudah", standard: "1x / Hari" },
    { id: 5, checkPoint: "Tidak ada identitas warna tape pada pressure jig yang terkelupas", standard: "1x / Hari" },
    { id: 6, checkPoint: "Tidak ada jig yang tidak diperlukan di area proses", standard: "1x / Hari" },
    { id: 7, checkPoint: "Apakah tekanan dari contact pressure jig masih dalam skala rata-rata", standard: "1x / Bulan" },
  ],
};

const DAILY_CHECK_INS_ITEMS: DailyCheckInsItem[] = [
  { id: 1,  itemCheck: "BOLPOINT & MARKER",          checkpoints: ['TERDAPAT STICKER "E" pada bolpoint & marker'],                                                                                                                                                                              ngChoices: ['TIDAK TERDAPAT STICKER "E"'] },
  { id: 2,  itemCheck: "MICROMETER",                 checkpoints: ["Ada nomor register & kalibrasi tidak expired", 'Angka terbaca dengan jelas (layar tidak muncul huruf "B", "H", "INS", atau "P")', 'Zero setting OK (layar menunjukkan "0.000")', "Kondisi anvil / spindle OK (tidak ada karat, tidak berputar longgar)", "Baut pengunci tidak longgar / dol"],                               ngChoices: ["TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED", 'ANGKA TIDAK TERBACA (LAYAR MUNCUL HURUF "B", "H", "INS" ATAU "P")', 'ZERO SETTING TIDAK OK (LAYAR TIDAK MENUNJUKKAN "0.000")', "KONDISI ANVIL / SPINDLE TIDAK OK (ADA KARAT / BERPUTAR LONGGAR)", "BAUT PENGUNCI LONGGAR / DOL"] },
  { id: 3,  itemCheck: "CALIPER",                    checkpoints: ["Ada nomor register & kalibrasi tidak expired", 'Zero setting OK (layar menunjukkan "0.00")', "Penggeser lancar, tidak ada bagian deformasi / berkarat / rusak"],                                                              ngChoices: ["TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED", 'ZERO SETTING TIDAK OK (LAYAR TIDAK MENUNJUKKAN "0.00")', "PENGGESER TIDAK LANCAR / ADA BAGIAN DEFORMASI / BERKARAT / RUSAK"] },
  { id: 4,  itemCheck: "MESIN TENSILE",              checkpoints: ["Ada nomor register & kalibrasi tidak expired", "Angka pada layar terbaca dengan jelas", "Mesin dalam kondisi baik, tidak ada bagian yang rusak", "Saat dioperasikan tidak ada kondisi / suara abnormal", "Angka pengukuran di layar stabil (tidak berubah-ubah)", 'Bisa di-setting "0" untuk angka pengukuran', "Griper bisa berhenti di posisi stopper yang ditentukan", "Tombol emergency berfungsi"],   ngChoices: ["TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED", "ANGKA PADA LAYAR TIDAK TERBACA DENGAN JELAS", "MESIN DALAM KONDISI RUSAK / BAGIAN ADA YANG RUSAK", "SAAT DIOPERASIKAN ADA KONDISI / SUARA YANG ABNORMAL", "ANGKA PENGUKURAN DI LAYAR TIDAK STABIL / BERUBAH-UBAH", 'TIDAK BISA DI SETTING "0" UNTUK ANGKA PENGUKURAN', "GRIPER TIDAK BISA BERHENTI DI POSISI STOPPER YANG DITENTUKAN", "TOMBOL EMERGENCY TIDAK BERFUNGSI"] },
  { id: 5,  itemCheck: "STEEL RULER",                checkpoints: ["Ada nomor register & kalibrasi tidak expired", "Steel ruler tidak berkarat dan angka terbaca dengan jelas"],                                                                                                                  ngChoices: ["TIDAK ADA NOMOR REGISTER / KALIBRASI SUDAH EXPIRED", "STEEL RULER BERKARAT DAN ANGKA TIDAK TERBACA DENGAN JELAS"] },
  { id: 6,  itemCheck: "BENT UP/DOWN GAUGE",         checkpoints: ["Ada nomor register & verifikasi tidak expired", "Gauge dalam kondisi baik (tidak bent / tajam / rusak)", "Bisa mendeteksi kondisi OK dan N-OK"],                                                                             ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED", "GAUGE DALAM KONDISI BENT / TAJAM / RUSAK", "TIDAK BISA MENDETEKSI KONDISI OK DAN N-OK"] },
  { id: 7,  itemCheck: "THICKNESS GAUGE / GO NO GO M TERMINAL", checkpoints: ["Ada nomor register & verifikasi tidak expired", "Gauge / Go No Go dalam kondisi baik (tidak bent / tajam / rusak)"],                                                                                           ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED", "GAUGE / GO NO GO DALAM KONDISI BENT / TAJAM / RUSAK"] },
  { id: 8,  itemCheck: "POCKET COMPARATOR",          checkpoints: ["Ada nomor register & verifikasi tidak expired", "Pocket comparator dalam kondisi baik, bisa melihat dengan jelas"],                                                                                                         ngChoices: ["TIDAK ADA NOMOR REGISTER / VERIFIKASI SUDAH EXPIRED", "POCKET COMPARATOR RUSAK / TIDAK BISA MELIHAT DENGAN JELAS"] },
  { id: 9,  itemCheck: "CRIMPING STANDARD & IS",     checkpoints: ["Tidak rusak dan terbaca dengan jelas", 'Ada stamp control / stamp "CONFIDENTIAL"'],                                                                                                                                        ngChoices: ["RUSAK / TIDAK TERBACA DENGAN JELAS", 'TIDAK ADA STAMP CONTROL / STAMP "CONFIDENTIAL"'] },
  { id: 10, itemCheck: "TROLLY INSPECTOR",           checkpoints: ["Trolly dalam kondisi baik (tidak rusak)", "Tempat cup dalam kondisi baik (tidak rusak)"],                                                                                                                                  ngChoices: ["TROLLY DALAM KONDISI RUSAK", "TEMPAT CUP RUSAK"] },
  { id: 11, itemCheck: "LAMPU UV",                   checkpoints: ["Jumlah lampu ada 2 di area inspeksi UV", "Lampu menyala terang (lampu LED mati < 3 pcs dalam lensa UV)"],                                                                                                                  ngChoices: ["JUMLAH LAMPU TIDAK ADA 2 DI AREA INSPEKSI UV", "LAMPU TIDAK MENYALA TERANG (ADA LAMPU LED MATI ≥ 3 PCS DALAM LENSA UV)"] },
  { id: 12, itemCheck: "MESIN SIMPLE CROSS SECTION", checkpoints: ["Tombol ON/OFF berfungsi / tidak rusak / lampu indikator menyala", "Tidak berbau asap / stop kontak terpasang sempurna"],                                                                                                    ngChoices: ["TOMBOL ON/OFF TIDAK BERFUNGSI / RUSAK / LAMPU INDIKATOR MATI", "BERBAU ASAP / STOP KONTAK TIDAK TERPASANG SEMPURNA"] },
];

const CRT_FRONTEND_TO_DB_ITEMID: Record<string, number> = {
  "1-A": 1102, "1-B": 1103, "2-A": 1110, "2-B": 1111, "3-A": 1118, "3-B": 1119,
  "4-A": 1126, "4-B": 1127, "5-A": 1134, "5-B": 1135, "6-A": 1142, "6-B": 1143,
  "7-A": 1150, "7-B": 1151, "8-A": 1158, "8-B": 1159, "9-A": 1166, "9-B": 1167,
  "10-A": 1174, "10-B": 1175, "11-A": 1182, "11-B": 1183, "12-A": 1190, "12-B": 1191,
  "13-A": 1198, "13-B": 1199, "14-A": 1206, "14-B": 1207, "15-A": 1214, "15-B": 1215,
  "16-A": 1220, "16-B": 1221, "17-A": 1226, "17-B": 1227, "18-A": 1232, "18-B": 1233,
  "19-A": 1238, "19-B": 1239,
};

const PRE_ASSY_SPECIFIC_AREA_ITEMS: Record<string, number[]> = {
  "TENSILE":       [1, 2, 4, 6, 7, 8, 9],
  "CROSS SECTION": [1, 8, 9, 12],
  "CUTTING":       [1, 2, 7, 9, 10],
  "PA":            [1, 2, 3, 5, 7, 9, 10, 11],
};
const PRE_ASSY_SPECIFIC_AREA_OPTIONS = ["TENSILE", "CROSS SECTION", "CUTTING", "PA"];

const CS_REMOVE_TOOL_CHECKSHEET_ITEMS: CSRemoveToolChecksheetItem[] = [
  { id: 1,  toolType: "1-150A",           ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 2,  toolType: "PA",               ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 3,  toolType: "DLI",              ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 4,  toolType: "CNR",              ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 5,  toolType: "TCNR",             ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 6,  toolType: "1-72A",            ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 7,  toolType: "1-114",            ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 8,  toolType: "1-42A",            ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 9,  toolType: "1-35",             ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 10, toolType: "1-85",             ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 11, toolType: "1-83A",            ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 12, toolType: "1-73",             ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 13, toolType: "1-105",            ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 14, toolType: "TLC",              ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak terpasang cover", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 15, toolType: "EXTRACTION JIG R", ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 16, toolType: "EXTRACTION JIG G", ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 17, toolType: "EXTRACTION JIG W", ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 18, toolType: "EXTRACTION JIG Y", ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak ada / tidak sesuai control numbernya"] },
  { id: 19, toolType: "CLIPPER",          ngChoices: ["Patah / Bengkok", "Berkarat", "Tidak ada / tidak sesuai control numbernya"] },
];

// =====================================================================
// INNER COMPONENT
// =====================================================================
function ChecksheetPreAssyPageInner() {
  const { user, loading: authLoading, isInitialized } = useAuth();
  const userId       = user?.id       ?? null;
  const userRole     = user?.role     ?? null;
  const userFullName = user?.fullName ?? null;
  const userUsername = user?.username ?? null;

  const [areaCode, setAreaCode]         = useState("");
  const [areaName, setAreaName]         = useState("");
  const [shift, setShift]               = useState<"A" | "B">("A");
  const [categoryCode, setCategoryCode] = useState<PreAssyCategoryCode>("pre-assy-daily-gl");
  const [currentTimeSlot, setCurrentTimeSlot] = useState<string>(() => getCurrentTimeSlot());
  const currentTimeSlotRef = useRef<string>(getCurrentTimeSlot());

  const selectableDates = useMemo(() => getSelectableDates(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateKey(new Date()));
  const [selectedSpecificArea, setSelectedSpecificArea] = useState<string>("TENSILE");

  const [conveyorInput, setConveyorInput]       = useState("");
  const [conveyorOptions, setConveyorOptions]   = useState<string[]>([]);
  const [selectedConveyor, setSelectedConveyor] = useState("");
  const [isSavingConveyor, setIsSavingConveyor] = useState(false);
  const [conveyorError, setConveyorError]       = useState<string | null>(null);
  const [isDeleting, setIsDeleting]             = useState(false);
  const [deleteError, setDeleteError]           = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen]     = useState(false);

  interface DuplicateWarning {
    itemId: number;
    itemCheck: string;
    duplicateLocations: string[];
    onConfirm: () => void;
  }
  const [duplicateWarning, setDuplicateWarning]       = useState<DuplicateWarning | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<number | null>(null);
  const [scannedGaugeIds, setScannedGaugeIds]         = useState<Record<number, string>>({});
  const isSubmittingRef = useRef(false);
  // Request guard untuk loadSavedResults — hanya request terakhir yang update state
  const loadSavedResultsRequestRef = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const s = getCurrentTimeSlot();
      currentTimeSlotRef.current = s;
      setCurrentTimeSlot(prev => prev === s ? prev : s);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!userId) { window.location.href = "/login-page"; return; }
    if (userRole !== "inspector-qa" && userRole !== "group-leader-qa") {
      window.location.href = "/home";
    }
  }, [userId, userRole, authLoading, isInitialized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ac  = params.get("areaCode");
    const an  = params.get("areaName");
    const sh  = params.get("shift");
    const cat = params.get("categoryCode") as PreAssyCategoryCode | null;
    if (!ac && !cat) return;
    if (ac) setAreaCode(ac);
    if (an) setAreaName(decodeURIComponent(an));
    if (sh === "A" || sh === "B") setShift(sh as "A" | "B");
    if (cat && cat in CATEGORY_LABELS) setCategoryCode(cat);
    else if (userRole) setCategoryCode(getDefaultCategoryForRole(userRole));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRoleAllowed = useMemo(() => {
    if (!userRole) return false;
    return CATEGORY_ALLOWED_ROLES[categoryCode]?.includes(userRole) ?? false;
  }, [userRole, categoryCode]);

  const checklistItems = useMemo(() => ITEMS_BY_CATEGORY[categoryCode] || [], [categoryCode]);

  const [results, setResults]             = useState<Record<number, ChecklistResult>>({});
  const [dciResults, setDciResults]       = useState<Record<number, DailyCheckInsResult>>({});
  const [crtResults, setCrtResults]       = useState<Record<number, CSRemoveToolResult>>({});
  const [crtPhotoZoomSrc, setCrtPhotoZoomSrc] = useState<string | null>(null);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading]         = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [expandedItem, setExpandedItem]   = useState<number | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess]     = useState(false);
  const [photoZoomSrc, setPhotoZoomSrc]   = useState<string | null>(null);

  // [PERUBAHAN 2] State baru untuk feedback offline save
  const [offlineSaveCount, setOfflineSaveCount] = useState(0);

  const isDailyCheckIns = categoryCode === "pre-assy-daily-check-ins";
  const isCSRemoveTool  = categoryCode === "pre-assy-cs-remove-tool";

  const filteredDciItems = useMemo(() => {
    if (!isDailyCheckIns) return DAILY_CHECK_INS_ITEMS;
    const allowed = PRE_ASSY_SPECIFIC_AREA_ITEMS[selectedSpecificArea];
    if (!allowed) return DAILY_CHECK_INS_ITEMS;
    return DAILY_CHECK_INS_ITEMS.filter(item => allowed.includes(item.id));
  }, [isDailyCheckIns, selectedSpecificArea]);

  const [dciScannedItemId, setDciScannedItemId] = useState<number | null>(null);
  const [dciCardVisible, setDciCardVisible]     = useState(false);
  const [dciSaveToast, setDciSaveToast]         = useState(false);
  const dciScanInputRef   = useRef<HTMLInputElement>(null);
  const scanFocusInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const dciSaveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDailyCheckIns || !selectedConveyor) {
      if (scanFocusInterval.current) {
        clearInterval(scanFocusInterval.current);
        scanFocusInterval.current = null;
      }
      return;
    }

    const stealFocusIfSafe = () => {
      if (dciScannedItemId !== null) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active) {
        if (dciScanInputRef.current) {
          dciScanInputRef.current.setAttribute("inputmode", "none");
          dciScanInputRef.current.focus({ preventScroll: true });
        }
        return;
      }
      const tag = active.tagName.toUpperCase();
      const isOtherFormField =
        (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
        active !== dciScanInputRef.current;
      const isInNgPanel        = !!active.closest?.(".dci-ng-panel");
      const isInCheckpointList = !!active.closest?.(".dci-checkpoint-list");
      const isInCarlineCard    = !!active.closest?.(".carline-card");
      const isInInfoCard       = !!active.closest?.(".info-card");

      if (!isOtherFormField && !isInNgPanel && !isInCheckpointList && !isInCarlineCard && !isInInfoCard) {
        if (dciScanInputRef.current) {
          dciScanInputRef.current.setAttribute("inputmode", "none");
          dciScanInputRef.current.focus({ preventScroll: true });
        }
      }
    };

    stealFocusIfSafe();
    scanFocusInterval.current = setInterval(stealFocusIfSafe, 300);

    return () => {
      if (scanFocusInterval.current) {
        clearInterval(scanFocusInterval.current);
        scanFocusInterval.current = null;
      }
    };
  }, [isDailyCheckIns, selectedConveyor, dciScannedItemId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.pa-conveyor-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleDciScanInput = useCallback((raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    const match = trimmed.match(/^DCI-(\d+)(?:-(.+))?$/);
    if (match) {
      const itemId  = parseInt(match[1], 10);
      const gaugeId = match[2] ? match[2].trim() : null;
      if (DAILY_CHECK_INS_ITEMS.some(i => i.id === itemId)) {
        if (gaugeId) {
          setScannedGaugeIds(prev => ({ ...prev, [itemId]: gaugeId }));
        }
        setDciScannedItemId(itemId);
        setDciCardVisible(false);
        setTimeout(() => setDciCardVisible(true), 30);
      }
    }
  }, []);

  const handleDciCloseCard = useCallback(() => {
    setDciCardVisible(false);
    setTimeout(() => setDciScannedItemId(null), 220);
  }, []);

  const flashDciSaveToast = useCallback(() => {
    setDciSaveToast(true);
    if (dciSaveToastTimer.current) clearTimeout(dciSaveToastTimer.current);
    dciSaveToastTimer.current = setTimeout(() => setDciSaveToast(false), 1400);
  }, []);

  const checkDuplicate = useCallback(async (
    itemId: number,
    clicked: "OK" | "NG",
    doSetStatus: () => void
  ) => {
    if (dciResults[itemId]?.status === clicked) { doSetStatus(); return; }
    if (!selectedConveyor || !userId || !areaCode) { doSetStatus(); return; }

    const gaugeId = scannedGaugeIds[itemId] || null;
    if (!gaugeId) { doSetStatus(); return; }

    const itemInfo  = DAILY_CHECK_INS_ITEMS.find(i => i.id === itemId);
    const itemCheck = itemInfo?.itemCheck ?? `Item ${itemId}`;

    setIsCheckingDuplicate(itemId);
    try {
      const res = await fetch("/api/pre-assy/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          categoryCode: "pre-assy-daily-check-ins",
          gaugeId,
          dateKey: selectedDate,
          shift,
          areaCode,
          carline: selectedConveyor,
          line: null,
          conveyor: selectedConveyor,
          specificArea: selectedSpecificArea,
        }),
      });
      const data = await res.json();
      if (data.isDuplicate && data.duplicates?.length > 0) {
        const locations: string[] = data.duplicates.map((d: any) => d.description).filter(Boolean);
        setDuplicateWarning({
          itemId, itemCheck, duplicateLocations: locations,
          onConfirm: () => { setDuplicateWarning(null); doSetStatus(); },
        });
      } else {
        doSetStatus();
      }
    } catch {
      doSetStatus();
    } finally {
      setIsCheckingDuplicate(null);
    }
  }, [dciResults, selectedConveyor, userId, areaCode, scannedGaugeIds, shift, selectedDate, selectedSpecificArea]);

  const handleDciScanStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    const doSetStatus = () => {
      setDciResults(prev => {
        if (prev[itemId]?.status === clicked) { const { [itemId]: _, ...rest } = prev; return rest; }
        return { ...prev, [itemId]: { itemId, status: clicked, selectedNgChoices: clicked === "OK" ? [] : (prev[itemId]?.selectedNgChoices || []), ngOtherNote: clicked === "OK" ? "" : (prev[itemId]?.ngOtherNote || ""), ngPhotos: clicked === "OK" ? [] : (prev[itemId]?.ngPhotos || []) } };
      });
      setSaveSuccess(false);
      if (clicked === "OK") { flashDciSaveToast(); }
    };
    checkDuplicate(itemId, clicked, doSetStatus);
  }, [flashDciSaveToast, checkDuplicate]);

  const loadSavedResults = useCallback(async (conveyor?: string) => {
    if (!userId || !areaCode || !conveyor) {
      setDciResults({});
      setResults({});
      setCrtResults({});
      return;
    }

    // TIDAK reset state di sini — biarkan data lama tampil selama load
    // State akan di-replace (bukan merge) setelah data baru siap
    setIsLoading(true);
    setError(null);

    const dateKey      = selectedDate;
    const safeConveyor = conveyor.trim().toUpperCase();
    const safeSpecArea = isDailyCheckIns ? selectedSpecificArea : '';

    // ── Build cacheKey — konsisten dengan updateLocalCachePreAssy dan sync.ts ──
    const cacheKey = buildPreAssyCacheKey(
      categoryCode, areaCode, shift, dateKey, safeConveyor, safeSpecArea
    );

    // ── Request guard — hanya request terakhir yang boleh update state ────────
    const requestId = Date.now();
    loadSavedResultsRequestRef.current = requestId;
    const isCurrentRequest = () => loadSavedResultsRequestRef.current === requestId;

    // ── Helper: parse formatted data → set state ──────────────────────────────
    const applyFormattedData = (formatted: Record<string, any>) => {
      if (!isCurrentRequest()) return;
      const todayData = formatted[dateKey] || {};

      if (categoryCode === "pre-assy-daily-check-ins") {
        const loadedDci: Record<number, DailyCheckInsResult> = {};
        const allowedIds = new Set(
          (PRE_ASSY_SPECIFIC_AREA_ITEMS[selectedSpecificArea] || []).map(Number)
        );
        Object.entries(todayData).forEach(([key, val]: [string, any]) => {
          const lastDash  = key.lastIndexOf("-");
          const firstDash = key.indexOf("-");
          if (firstDash === -1 || lastDash === -1 || firstDash === lastDash) return;
          const itemId      = parseInt(key.slice(0, firstDash), 10);
          const keySpecArea = key.slice(firstDash + 1, lastDash);
          const keyShift    = key.slice(lastDash + 1);
          if (!isNaN(itemId) && keySpecArea === selectedSpecificArea && keyShift === shift && allowedIds.has(itemId) && DAILY_CHECK_INS_ITEMS.some(i => i.id === itemId)) {
            let selectedNgChoices: string[] = [], ngOtherNote = "", ngPhotos: string[] = [];
            try {
              const parsed = JSON.parse(val.ngDescription || "{}");
              if (Array.isArray(parsed)) selectedNgChoices = parsed;
              else if (parsed && typeof parsed === "object") {
                selectedNgChoices = Array.isArray(parsed.choices) ? parsed.choices : [];
                ngOtherNote = parsed.other || "";
              }
            } catch { selectedNgChoices = []; }
            try { const pp = JSON.parse(val.ngPhotos || "[]"); if (Array.isArray(pp)) ngPhotos = pp; } catch { ngPhotos = []; }
            loadedDci[itemId] = {
              itemId,
              status: val.status === "OK" ? "OK" : val.status === "NG" ? "NG" : null,
              selectedNgChoices, ngOtherNote, ngPhotos,
            };
          }
        });
        if (isCurrentRequest()) setDciResults(loadedDci);

      } else if (categoryCode === "pre-assy-cs-remove-tool") {
        const loadedCrt: Record<number, CSRemoveToolResult> = {};
        Object.entries(todayData).forEach(([key, val]: [string, any]) => {
          const parts  = key.split("-");
          const toolNo = parseInt(parts[0], 10);
          let crtItemId: number;
          if (toolNo === 15) {
            const colorMap: Record<string, number> = { R: 15, G: 16, W: 17, Y: 18 };
            crtItemId = colorMap[parts[1]] ?? 15;
          } else if (toolNo === 16) {
            crtItemId = 19;
          } else {
            crtItemId = toolNo;
          }
          if (isNaN(crtItemId)) return;
          if (val.status === "NG" || !loadedCrt[crtItemId]) {
            let selectedNgChoices: string[] = [], ngPhotos: string[] = [];
            try { const p = JSON.parse(val.ngDescription || "{}"); if (Array.isArray(p.choices)) selectedNgChoices = p.choices; } catch {}
            try { const pp = JSON.parse(val.ngPhotos || "[]"); if (Array.isArray(pp)) ngPhotos = pp; } catch {}
            loadedCrt[crtItemId] = {
              itemId: crtItemId,
              status: val.status === "OK" ? "OK" : val.status === "NG" ? "NG" : null,
              selectedNgChoices, ngPhotos,
            };
          }
        });
        if (isCurrentRequest()) setCrtResults(loadedCrt);

      } else {
        const itemsForCategory = ITEMS_BY_CATEGORY[categoryCode] || [];
        const loaded: Record<number, ChecklistResult> = {};
        Object.entries(todayData).forEach(([key, val]: [string, any]) => {
          const dashIdx = key.indexOf("-");
          const itemId  = parseInt(dashIdx > 0 ? key.slice(0, dashIdx) : key, 10);
          if (!isNaN(itemId) && itemsForCategory.some(i => i.id === itemId)) {
            loaded[itemId] = {
              itemId,
              status: val.status === "OK" ? "OK" : val.status === "NG" ? "NG" : null,
              notes: val.ngDescription || "",
            };
          }
        });
        if (isCurrentRequest()) setResults(loaded);
      }
    };

    // ── STEP 1: Cache-first — tampilkan segera tanpa tunggu API ───────────────
    // Ini yang fix "refresh offline → data hilang":
    // cache sudah ada sejak save terakhir → langsung tampil di refresh pertama
    try {
      const cachedData = await getCache(cacheKey);
      if (cachedData && cachedData.success && cachedData.formatted) {
        const todayEntries = Object.keys(cachedData.formatted[dateKey] || {});
        console.log(`[loadSavedResults] cache hit: ${todayEntries.length} entries`, cacheKey);
        applyFormattedData(cachedData.formatted);
      } else {
        console.log(`[loadSavedResults] cache miss`, cacheKey);
      }
    } catch (cacheErr) {
      console.log('[loadSavedResults] cache read error:', cacheErr);
    }

    // Unlock UI setelah cache diproses — tidak tunggu API
    if (isCurrentRequest()) {
      setIsLoading(false);
    }

    // ── STEP 2: API background fetch — hanya saat online ─────────────────────
    // API response di-MERGE ke state yang sudah ada dari cache.
    // Data offline yang belum tersync (ada di cache tapi belum di API) dipertahankan.
    if (!navigator.onLine) return;

    try {
      const monthKey = dateKey.slice(0, 7);
      const isCCStripping = categoryCode === "pre-assy-cc-stripping-gl";
      const timeSlotParam = isCCStripping
        ? `&timeSlot=${encodeURIComponent(currentTimeSlotRef.current)}` : "";
      const specificAreaParam = isDailyCheckIns
        ? `&specificArea=${encodeURIComponent(selectedSpecificArea)}` : "";

      const url =
        `/api/pre-assy/get-results?userId=${userId}` +
        `&categoryCode=${categoryCode}` +
        `&month=${monthKey}` +
        `&areaCode=${encodeURIComponent(areaCode)}` +
        `&conveyor=${encodeURIComponent(safeConveyor)}` +
        `&carline=${encodeURIComponent(safeConveyor)}` +
        `&line=` +
        timeSlotParam +
        specificAreaParam;

      const res = await fetch(url);
      if (!res.ok) {
        console.log(`[loadSavedResults] API HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (!data.success || !data.formatted) return;

      // Simpan ke cache untuk request berikutnya / offline
      await saveCache(cacheKey, data);

      if (!isCurrentRequest()) return;

      // Apply data API — ini menggantikan state dari cache dengan data server terbaru
      // Aman karena: jika item ada di cache (offline) tapi tidak di API,
      // setelah sync berhasil API akan mengembalikan item tersebut
      applyFormattedData(data.formatted);
      console.log(`[loadSavedResults] API applied & cached`, cacheKey);

    } catch (apiErr) {
      console.log('[loadSavedResults] API fetch error (cache masih tampil):', apiErr);
    }
  }, [userId, areaCode, categoryCode, selectedDate, selectedSpecificArea, shift, isDailyCheckIns]);

  useEffect(() => {
    if (!areaCode || !userId || !categoryCode) return;

    if (!selectedConveyor) {
      setDciResults({});
      setResults({});
      setCrtResults({});
      setScannedGaugeIds({});
      return;
    }

    loadSavedResults(selectedConveyor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCode, userId, categoryCode, selectedConveyor, selectedDate, selectedSpecificArea, shift]);

  const prevTimeSlotRef = useRef<string>(currentTimeSlot);
  useEffect(() => {
    if (categoryCode !== "pre-assy-cc-stripping-gl") return;
    if (currentTimeSlot === prevTimeSlotRef.current) return;
    prevTimeSlotRef.current = currentTimeSlot;
    setResults({});
    setDciResults({});
    if (selectedConveyor) loadSavedResults(selectedConveyor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTimeSlot]);

  const fetchConveyorOptions = useCallback(async (code: string) => {
    if (!code) return;
    try {
      const res  = await fetch(`/api/pre-assy/get-carline-line?areaCode=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        const conveyors = [
          ...new Set(
            data
              .map((d: any) => String(d.conveyor || d.carline || "").trim().toUpperCase())
              .filter(Boolean)
          ),
        ] as string[];
        setConveyorOptions(conveyors);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (areaCode) {
      setConveyorOptions([]);
      setSelectedConveyor("");
      fetchConveyorOptions(areaCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCode, fetchConveyorOptions]);

  const handleAddConveyor = async () => {
    const cv = conveyorInput.trim().toUpperCase();
    if (!cv) { setConveyorError("Nama conveyor harus diisi."); return; }

    if (conveyorOptions.some(o => o.toUpperCase() === cv)) {
      setDciResults({});
      setResults({});
      setCrtResults({});
      setScannedGaugeIds({});
      setSaveSuccess(false);
      setSelectedConveyor(cv);
      setConveyorInput("");
      setConveyorError(null);
      return;
    }

    setIsSavingConveyor(true); setConveyorError(null);
    try {
      const res = await fetch("/api/pre-assy/save-conveyor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conveyor: cv,
          areaCode,
          userId,
          categoryCode: isDailyCheckIns ? "pre-assy-daily-check-ins" : categoryCode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setConveyorOptions(prev => prev.includes(cv) ? prev : [...prev, cv]);
          setDciResults({});
          setResults({});
          setCrtResults({});
          setScannedGaugeIds({});
          setSaveSuccess(false);
          setSelectedConveyor(cv);
          setConveyorInput("");
          return;
        }
        throw new Error(errData.error || "Gagal menyimpan");
      }

      setConveyorOptions(prev => [...prev, cv]);
      setDciResults({});
      setResults({});
      setCrtResults({});
      setScannedGaugeIds({});
      setSaveSuccess(false);
      setSelectedConveyor(cv);
      setConveyorInput("");
    } catch (err: any) {
      setConveyorError(err.message || "Gagal menyimpan Conveyor. Coba lagi.");
    } finally {
      setIsSavingConveyor(false);
    }
  };

  const handleDeleteConveyor = async (cv: string) => {
    if (!window.confirm(`Hapus conveyor "${cv}" dari daftar?`)) return;

    setIsDeleting(true);
    setDeleteError(null);
    setIsDropdownOpen(false);

    try {
      const res = await fetch('/api/pre-assy/delete-conveyor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conveyor:     cv,
          categoryCode: isDailyCheckIns ? 'pre-assy-daily-check-ins' : categoryCode,
          userId,
          areaCode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal menghapus conveyor.');
      }

      setConveyorOptions(prev => prev.filter(item => item !== cv));

      if (selectedConveyor === cv) {
        setSelectedConveyor('');
        setDciResults({});
        setResults({});
        setCrtResults({});
        setScannedGaugeIds({});
        setSaveSuccess(false);
      }

      if (areaCode) fetchConveyorOptions(areaCode);

    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus conveyor.');
    } finally {
      setIsDeleting(false);
    }
  };

  const completedCount = useMemo(() => {
    if (isDailyCheckIns) {
      const allowedIds = new Set(filteredDciItems.map(i => i.id));
      return Object.entries(dciResults).filter(([id, r]) => allowedIds.has(Number(id)) && r.status !== null).length;
    }
    if (isCSRemoveTool) return Object.values(crtResults).filter(r => r.status !== null).length;
    return Object.values(results).filter(r => r.status !== null).length;
  }, [results, dciResults, crtResults, isDailyCheckIns, isCSRemoveTool, filteredDciItems]);

  const totalCount = isDailyCheckIns ? filteredDciItems.length
    : isCSRemoveTool ? CS_REMOVE_TOOL_CHECKSHEET_ITEMS.length
    : checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    setResults(prev => {
      if (prev[itemId]?.status === clicked) { const { [itemId]: _, ...rest } = prev; return rest; }
      return { ...prev, [itemId]: { itemId, status: clicked, notes: prev[itemId]?.notes || "" } };
    });
    setSaveSuccess(false);
  }, []);

  const handleNotesChange = useCallback((itemId: number, notes: string) => {
    setResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], itemId, notes, status: prev[itemId]?.status || null } }));
    setSaveSuccess(false);
  }, []);

  const toggleCheckpoints = useCallback((itemId: number) => {
    setExpandedCheckpoints(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const handleDciNgChoiceToggle = useCallback((itemId: number, choice: string) => {
    setDciResults(prev => {
      const current = prev[itemId]?.selectedNgChoices || [];
      return { ...prev, [itemId]: { ...prev[itemId], itemId, status: "NG", selectedNgChoices: current.includes(choice) ? current.filter(c => c !== choice) : [...current, choice], ngOtherNote: prev[itemId]?.ngOtherNote || "", ngPhotos: prev[itemId]?.ngPhotos || [] } };
    });
    setSaveSuccess(false);
  }, []);

  const handleDciOtherNoteChange = useCallback((itemId: number, note: string) => {
    setDciResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], itemId, status: "NG", selectedNgChoices: prev[itemId]?.selectedNgChoices || [], ngOtherNote: note, ngPhotos: prev[itemId]?.ngPhotos || [] } }));
    setSaveSuccess(false);
  }, []);

  const handleDciPhotoAdd = useCallback((itemId: number, base64: string) => {
    setDciResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], itemId, status: "NG", selectedNgChoices: prev[itemId]?.selectedNgChoices || [], ngOtherNote: prev[itemId]?.ngOtherNote || "", ngPhotos: [...(prev[itemId]?.ngPhotos || []), base64] } }));
    setSaveSuccess(false);
  }, []);

  const handleDciPhotoRemove = useCallback((itemId: number, photoIdx: number) => {
    setDciResults(prev => { const photos = [...(prev[itemId]?.ngPhotos || [])]; photos.splice(photoIdx, 1); return { ...prev, [itemId]: { ...prev[itemId], itemId, ngPhotos: photos } }; });
    setSaveSuccess(false);
  }, []);

  const handleCrtStatusChange = useCallback((itemId: number, clicked: "OK" | "NG") => {
    setCrtResults(prev => {
      if (prev[itemId]?.status === clicked) { const { [itemId]: _, ...rest } = prev; return rest; }
      return { ...prev, [itemId]: { itemId, status: clicked, selectedNgChoices: clicked === "OK" ? [] : (prev[itemId]?.selectedNgChoices || []), ngPhotos: clicked === "OK" ? [] : (prev[itemId]?.ngPhotos || []) } };
    });
    setSaveSuccess(false);
  }, []);

  const handleCrtNgChoiceToggle = useCallback((itemId: number, choice: string) => {
    setCrtResults(prev => {
      const current = prev[itemId]?.selectedNgChoices || [];
      return { ...prev, [itemId]: { ...prev[itemId], itemId, status: "NG", selectedNgChoices: current.includes(choice) ? current.filter(c => c !== choice) : [...current, choice], ngPhotos: prev[itemId]?.ngPhotos || [] } };
    });
    setSaveSuccess(false);
  }, []);

  const handleCrtPhotoAdd = useCallback((itemId: number, base64: string) => {
    setCrtResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], itemId, status: "NG", selectedNgChoices: prev[itemId]?.selectedNgChoices || [], ngPhotos: [...(prev[itemId]?.ngPhotos || []), base64] } }));
    setSaveSuccess(false);
  }, []);

  const handleCrtPhotoRemove = useCallback((itemId: number, photoIdx: number) => {
    setCrtResults(prev => { const photos = [...(prev[itemId]?.ngPhotos || [])]; photos.splice(photoIdx, 1); return { ...prev, [itemId]: { ...prev[itemId], itemId, ngPhotos: photos } }; });
    setSaveSuccess(false);
  }, []);

  // ── handleSubmit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId || !areaCode) { alert("❌ User atau area tidak ditemukan. Silakan scan ulang QR Code."); return; }
    if (!selectedConveyor) { alert("⚠️ Silakan pilih atau tambahkan Conveyor terlebih dahulu."); return; }
    if (isSubmittingRef.current) return;

    const itemsToProcess = isDailyCheckIns
      ? DAILY_CHECK_INS_ITEMS.filter(item => dciResults[item.id]?.status !== null && dciResults[item.id]?.status !== undefined)
      : isCSRemoveTool
        ? CS_REMOVE_TOOL_CHECKSHEET_ITEMS.filter(item => crtResults[item.id]?.status !== null && crtResults[item.id]?.status !== undefined)
        : checklistItems.filter(item => results[item.id]?.status !== null && results[item.id]?.status !== undefined);

    if (itemsToProcess.length === 0) {
      if (!window.confirm("Tidak ada item yang diisi. Yakin ingin menyimpan checklist kosong?")) return;
    }

    if (isDailyCheckIns) {
      const ngWithoutChoices = DAILY_CHECK_INS_ITEMS.filter(item => {
        const r = dciResults[item.id];
        return r?.status === "NG" && (r.selectedNgChoices?.length ?? 0) === 0 && !(r.ngOtherNote?.trim()) && (r.ngPhotos?.length ?? 0) === 0;
      });
      if (ngWithoutChoices.length > 0) {
        alert(`⚠️ Untuk item NG, wajib mengisi:\n• Pilih kondisi NG\n• Isi keterangan\n• Tambahkan foto\n\nItem belum lengkap:\n${ngWithoutChoices.map(i => i.itemCheck).join(", ")}`);
        return;
      }
    }

    if (isCSRemoveTool) {
      const ngWithoutInfo = CS_REMOVE_TOOL_CHECKSHEET_ITEMS.filter(item => {
        const r = crtResults[item.id];
        return r?.status === "NG" && (r.selectedNgChoices?.length ?? 0) === 0 && (r.ngPhotos?.length ?? 0) === 0;
      });
      if (ngWithoutInfo.length > 0) {
        alert(`⚠️ Untuk item NG, wajib mengisi kondisi atau foto.\n\nItem belum lengkap:\n${ngWithoutInfo.map(i => i.toolType).join(", ")}`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSaveSuccess(false);
    setOfflineSaveCount(0);

    try {
      // ── TAHAP 1: Kumpulkan semua data item ────────────────────────────────
      type PreparedItem = {
        item: typeof itemsToProcess[0];
        resolvedItemId: number;
        status: "OK" | "NG";
        ngDescription: string | null;
        ngPhotosVal: string[] | null;
        timeSlotVal: string;
      };
      const preparedItems: PreparedItem[] = [];

      for (const item of itemsToProcess) {
        let status: "OK" | "NG", ngDescription: string | null, ngPhotosVal: string[] | null = null;

        if (isDailyCheckIns) {
          const r = dciResults[item.id]; if (!r || r.status === null) continue;
          status = r.status;
          ngDescription = status === "NG" ? JSON.stringify({ choices: r.selectedNgChoices || [], other: r.ngOtherNote?.trim() || "" }) : null;
          ngPhotosVal = status === "NG" ? (r.ngPhotos || []) : null;
        } else if (isCSRemoveTool) {
          const r = crtResults[item.id]; if (!r || r.status === null) continue;
          status = r.status;
          ngDescription = status === "NG" ? JSON.stringify({ choices: r.selectedNgChoices || [], other: "" }) : null;
          ngPhotosVal = status === "NG" ? (r.ngPhotos || []) : null;
        } else {
          const r = results[item.id]; if (!r || r.status === null) continue;
          status = r.status; ngDescription = status === "NG" ? (r.notes || "") : null;
        }

        const resolvedItemId = isCSRemoveTool
          ? (CRT_FRONTEND_TO_DB_ITEMID[`${item.id}-${shift}`] ?? item.id)
          : item.id;

        const timeSlotVal = isDailyCheckIns
          ? (scannedGaugeIds[item.id] || "")
          : categoryCode === "pre-assy-cc-stripping-gl" ? currentTimeSlotRef.current : "";

        preparedItems.push({ item, resolvedItemId, status, ngDescription, ngPhotosVal, timeSlotVal });
      }

      // ── TAHAP 2: Kirim ke API atau simpan offline — boleh parallel ────────
      type SaveResult = { ok: boolean; offline: boolean; resolvedItemId: number; status: "OK"|"NG"; ngDescription: string|null; ngPhotosVal: string[]|null; timeSlotVal: string; };
      const saveResults: SaveResult[] = await Promise.all(
        preparedItems.map(async ({ item, resolvedItemId, status, ngDescription, ngPhotosVal, timeSlotVal }) => {
          const payload = {
            userId,
            categoryCode,
            itemId: resolvedItemId,
            dateKey: selectedDate,
            shift,
            status,
            ngDescription,
            ngDepartment: status === "NG" ? "QA" : null,
            ngPhotos: ngPhotosVal,
            timeSlot: timeSlotVal,
            areaCode,
            conveyor: selectedConveyor || null,
            carline:  selectedConveyor || null,
            line:     "",
            specificArea: isDailyCheckIns ? selectedSpecificArea : null,
            deviceCode: loadPhysicalBinding()?.device_code ?? null,
          };

          if (!navigator.onLine) {
            await saveChecklistOffline("/api/pre-assy/save-result", payload);
            return { ok: true, offline: true, resolvedItemId, status, ngDescription, ngPhotosVal, timeSlotVal };
          }

          try {
            const res = await fetch("/api/pre-assy/save-result", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              if (res.status === 409 && errData.error === "DUPLICATE_ITEM") {
                const itemInfo  = DAILY_CHECK_INS_ITEMS.find(i => i.id === item.id);
                const itemCheck = itemInfo?.itemCheck ?? `Item ${item.id}`;
                const locations: string[] = (errData.duplicates || []).map((d: any) => d.description).filter(Boolean);
                setDciResults(prev => { const { [item.id]: _, ...rest } = prev; return rest; });
                setScannedGaugeIds(prev => { const { [item.id]: _, ...rest } = prev; return rest; });
                throw { isDuplicateError: true, itemCheck, locations };
              }
              await saveChecklistOffline("/api/pre-assy/save-result", payload);
              return { ok: true, offline: true, resolvedItemId, status, ngDescription, ngPhotosVal, timeSlotVal };
            }

            return { ok: true, offline: false, resolvedItemId, status, ngDescription, ngPhotosVal, timeSlotVal };

          } catch (fetchErr: any) {
            if (fetchErr?.isDuplicateError) throw fetchErr;
            await saveChecklistOffline("/api/pre-assy/save-result", payload);
            return { ok: true, offline: true, resolvedItemId, status, ngDescription, ngPhotosVal, timeSlotVal };
          }
        })
      );

      // ── TAHAP 3: Update cache GET — WAJIB SERIAL (bukan Promise.all) ──────
      // READ-MODIFY-WRITE ke cacheKey yang sama.
      // Jika diparalelkan: semua baca snapshot lama → item lain hilang dari cache.
      for (const r of saveResults) {
        await updateLocalCachePreAssy({
          categoryCode,
          areaCode,
          shift,
          dateKey: selectedDate,
          conveyor: selectedConveyor || '',
          specificArea: isDailyCheckIns ? selectedSpecificArea : '',
          itemId: r.resolvedItemId,
          status: r.status,
          ngDescription: r.ngDescription,
          ngPhotos: r.ngPhotosVal,
          timeSlot: r.timeSlotVal,
        });
      }

      const offlineItems = saveResults.filter(r => r.offline).length;
      const failedItems  = saveResults.filter(r => !r.ok).length;

      if (failedItems > 0) {
        alert(`⚠️ ${failedItems} item gagal disimpan.`);
      } else {
        setSaveSuccess(true);
        setOfflineSaveCount(offlineItems);
        setTimeout(() => {
          setSaveSuccess(false);
          setOfflineSaveCount(0);
        }, 4000);
      }

    } catch (err: any) {
      console.error("❌ Save error:", err);
      if (err?.isDuplicateError) {
        alert(
          `⚠️ Gauge "${err.itemCheck}" sudah di-check di lokasi lain hari ini:\n` +
          err.locations.map((l: string) => `• ${l}`).join("\n") +
          `\n\nSatu gauge hanya boleh digunakan di 1 lokasi per hari.\nGauge tidak dapat di-check di Area, Conveyor, atau Spesifik Area yang berbeda.`
        );
      } else {
        alert("❌ Gagal menyimpan checklist. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const today = new Date();

  if (authLoading || !isInitialized) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:40, height:40, border:"3px solid #e2e8f0", borderTopColor:"#7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
          <p style={{ color:"#64748b" }}>Memuat...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }
  if (!userId) return null;

  if (!isRoleAllowed) {
    return (
      <>
        <Sidebar userName={userFullName || userUsername || ""} />
        <main style={{ marginLeft:80, padding:20 }}>
          <div className="error-banner">
            <span className="error-icon">🚫</span>
            <span className="error-text">Tipe checklist <strong>{CATEGORY_LABELS[categoryCode]}</strong> tidak dapat diakses oleh role <strong>{userRole}</strong>.</span>
            <button onClick={() => { window.location.href = "/home"; }} className="error-retry">Kembali</button>
          </div>
        </main>
        <style jsx>{`.error-banner{background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:12px;}.error-icon{font-size:20px;}.error-text{flex:1;color:#dc2626;font-size:14px;}.error-retry{background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;}`}</style>
      </>
    );
  }

  if (!areaCode || !areaName) {
    return (
      <>
        <Sidebar userName={userFullName || userUsername || ""} />
        <main style={{ marginLeft:80, padding:20 }}>
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-text">Area tidak ditemukan. Silakan scan QR Code pada area yang ingin diperiksa.</span>
            <button onClick={() => { window.location.href = "/home"; }} className="error-retry">Kembali ke Home</button>
          </div>
        </main>
        <style jsx>{`.error-banner{background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:12px;}.error-icon{font-size:20px;}.error-text{flex:1;color:#dc2626;font-size:14px;}.error-retry{background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;}`}</style>
      </>
    );
  }

  const badge = CATEGORY_ROLE_BADGE[categoryCode];
  const isEditingPast = selectedDate !== getLocalDateKey(today);

  return (
    <>
      <Sidebar userName={userFullName || userUsername || ""} />
      <main className="main-content">
        {/* HEADER */}
        <div className="header-section">
          <button onClick={() => window.history.back()} className="back-button">←</button>
          <h1 className="page-title">Pre Assy Checksheet</h1>
          <div className="header-actions">
            <button className="icon-button">🔔</button>
            <button className="icon-button">👤</button>
          </div>
        </div>

        {/* INFO CARD */}
        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Tipe Checklist:</span>
            <div className="checklist-type-static">
              <span className="info-value">{CATEGORY_LABELS[categoryCode]}</span>
              <span className={`dropdown-badge ${badge.cls}`}>{badge.label}</span>
            </div>
          </div>
          <div className="info-row">
            <span className="info-label">Area:</span>
            <span className="info-value area-value">{areaName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">🔄 Shift:</span>
            <select
              value={shift}
              onChange={e => {
                setShift(e.target.value as "A" | "B");
                setDciResults({});
                setResults({});
                setCrtResults({});
                setSaveSuccess(false);
              }}
              style={{ padding:"6px 12px", borderRadius:8, fontSize:13, fontWeight:700, border:"2px solid #7c3aed", color:"#5b21b6", background:"#f5f3ff", cursor:"pointer", outline:"none" }}
            >
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
            </select>
          </div>
          <div className="info-row">
            <span className="info-label">📅 Tanggal:</span>
            <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, justifyContent:"flex-end" }}>
              <select
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setResults({});
                  setDciResults({});
                  setCrtResults({});
                  setScannedGaugeIds({});
                  setSaveSuccess(false);
                }}
                style={{ padding:"6px 10px", borderRadius:8, fontSize:13, fontWeight:600, border:`2px solid ${isEditingPast ? "#f59e0b" : "#e2e8f0"}`, color: isEditingPast ? "#92400e" : "#1e293b", background: isEditingPast ? "#fffbeb" : "white", cursor:"pointer", outline:"none", maxWidth:220 }}
              >
                {selectableDates.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              {isEditingPast && (
                <span style={{ fontSize:11, color:"#92400e", background:"#fef3c7", padding:"2px 8px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap" }}>
                  Edit Data Lama
                </span>
              )}
            </div>
          </div>
          {isDailyCheckIns && (
            <div className="info-row">
              <span className="info-label">🔍 Spesifik Area:</span>
              <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, justifyContent:"flex-end" }}>
                <select
                  value={selectedSpecificArea}
                  onChange={e => {
                    setSelectedSpecificArea(e.target.value);
                    setDciResults({});
                    setScannedGaugeIds({});
                    setSaveSuccess(false);
                  }}
                  style={{ padding:"6px 12px", borderRadius:8, fontSize:13, fontWeight:700, border:"2px solid #7c3aed", color:"#5b21b6", background:"#f5f3ff", cursor:"pointer", outline:"none", maxWidth:200 }}
                >
                  {PRE_ASSY_SPECIFIC_AREA_OPTIONS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <span style={{ fontSize:11, color:"#7c3aed", background:"#ede9fe", padding:"2px 8px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap" }}>
                  {filteredDciItems.length} item
                </span>
              </div>
            </div>
          )}
          {categoryCode === "pre-assy-cc-stripping-gl" && (
            <div className="info-row">
              <span className="info-label">Slot Jam:</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span className="time-slot-badge">{currentTimeSlot}</span>
                <span style={{ fontSize:11, color:"#64748b" }}>(Data akan tersimpan di kolom jam <strong>{currentTimeSlot}</strong>)</span>
              </div>
            </div>
          )}
        </div>

        {/* CONVEYOR CARD */}
        <div className="carline-card">
          <div className="carline-card-header">
            <span className="carline-icon">🏭</span>
            <h3 className="carline-title">Conveyor</h3>
            {selectedConveyor && (
              <span style={{ fontSize:12, fontWeight:700, background:"#d1fae5", color:"#065f46", padding:"3px 10px", borderRadius:20, border:"1.5px solid #6ee7b7", marginLeft:"auto" }}>
                ✓ {selectedConveyor}
              </span>
            )}
          </div>

          {conveyorOptions.length > 0 && (
            <div className="carline-row">
              <label className="carline-label">Pilih Conveyor</label>

              <div className={`pa-conveyor-dropdown-container ${isDropdownOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="pa-conveyor-dropdown-trigger"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  disabled={isLoading || isDeleting}
                >
                  <span>{selectedConveyor || "-- Pilih Conveyor --"}</span>
                  <span className="pa-conveyor-dropdown-arrow">▼</span>
                </button>

                {isDropdownOpen && (
                  <div className="pa-conveyor-dropdown-menu">
                    {conveyorOptions.map(cv => (
                      <div
                        key={cv}
                        className={`pa-conveyor-dropdown-item ${selectedConveyor === cv ? "selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="pa-conveyor-dropdown-item-btn"
                          onClick={() => {
                            setDciResults({});
                            setResults({});
                            setCrtResults({});
                            setScannedGaugeIds({});
                            setSaveSuccess(false);
                            setSelectedConveyor(cv);
                            setIsDropdownOpen(false);
                          }}
                          disabled={isLoading || isDeleting}
                        >
                          {cv}
                        </button>

                        <button
                          type="button"
                          className="pa-conveyor-delete-btn"
                          onClick={e => { e.stopPropagation(); handleDeleteConveyor(cv); }}
                          disabled={isLoading || isDeleting}
                          aria-label={`Hapus ${cv}`}
                          title={`Hapus ${cv}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isDeleting && (
                <span style={{ fontSize:12, color:"#64748b", fontStyle:"italic", marginTop:6, display:"block" }}>
                  Menghapus...
                </span>
              )}
              {deleteError && (
                <p style={{ margin:"6px 0 0", fontSize:12, color:"#dc2626", fontWeight:500 }}>
                  ⚠️ {deleteError}
                </p>
              )}
            </div>
          )}

          <div className="carline-add-section">
            <p className="carline-add-label">
              {conveyorOptions.length === 0 ? "Belum ada Conveyor. Tambahkan:" : "Tambah Conveyor baru:"}
            </p>
            <div className="carline-inputs">
              <input
                className="carline-input"
                type="text"
                placeholder="Nama Conveyor (cth: CONVEYOR-1)"
                value={conveyorInput}
                onChange={e => { setConveyorInput(e.target.value); setConveyorError(null); }}
                maxLength={40}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddConveyor(); } }}
              />
              <button
                className="carline-add-btn"
                onClick={handleAddConveyor}
                disabled={isSavingConveyor || !conveyorInput.trim()}
              >
                {isSavingConveyor ? "..." : "+ Tambah"}
              </button>
            </div>
            {conveyorError && <p className="carline-error">⚠️ {conveyorError}</p>}
          </div>

          {!selectedConveyor && (
            <div className="carline-warning">
              ⚠️ Pilih atau tambahkan Conveyor sebelum mengisi checklist.
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="loading-items">
            <div className="loading-spinner" />
            <p>Memuat data checklist...</p>
          </div>
        ) : (
          <>
            <div className="progress-card">
              <div className="progress-header">
                <span className="progress-text">Progress: {completedCount} / {totalCount} item selesai</span>
                <span className="progress-percent">{Math.round(progressPercent)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${progressPercent}%` }} />
              </div>
            </div>

            {/* [PERUBAHAN 2] Banner sukses — bedakan online vs offline */}
            {saveSuccess && offlineSaveCount === 0 && (
              <div className="success-banner">
                <span>✅</span>
                <span>Checklist berhasil disimpan!</span>
              </div>
            )}
            {saveSuccess && offlineSaveCount > 0 && (
              <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderLeft:"4px solid #f59e0b", borderRadius:8, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12, color:"#92400e", fontSize:14, fontWeight:500 }}>
                <span>🟡</span>
                <span>
                  <strong>{offlineSaveCount} item</strong> disimpan offline (tidak ada koneksi).
                  Data akan otomatis dikirim saat online kembali.
                </span>
              </div>
            )}
            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{error}</span>
              </div>
            )}

            {isDailyCheckIns ? (
              <div className="info-box-partial" style={{ borderLeftColor:"#7c3aed", background:"#f5f3ff", borderColor:"#ddd6fe" }}>
                <span>📡</span>
                <span className="info-text">
                  <strong>Scan Mode Aktif [{selectedSpecificArea}]:</strong> Arahkan scanner TC 21 ke QR Code pada Item Check.
                  Menampilkan <strong>{filteredDciItems.length}</strong> item dari total {DAILY_CHECK_INS_ITEMS.length} item.
                </span>
              </div>
            ) : (
              <div className="info-box-partial">
                <span>ℹ️</span>
                <span className="info-text">
                  <strong>Simpan Parsial:</strong> Anda dapat menyimpan meskipun belum semua item terisi.{" "}
                  <strong>Klik status yang sama 2x untuk membatalkan pilihan.</strong>
                </span>
              </div>
            )}

            <div className="checklist-container">
              {/* ── DCI SCAN MODE ── */}
              {isDailyCheckIns ? (
                <div className="dci-scan-wrapper">
                  {selectedConveyor && (
                    <input
                      ref={dciScanInputRef}
                      className="dci-scan-hidden-input"
                      type="text"
                      inputMode="none"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      tabIndex={0}
                      aria-label="Scanner input"
                      onFocus={e => {
                        if (window.matchMedia("(pointer: coarse)").matches) {
                          const el = e.currentTarget;
                          el.setAttribute("inputmode", "none");
                          el.setAttribute("readonly", "readonly");
                          setTimeout(() => { el.removeAttribute("readonly"); }, 100);
                        }
                      }}
                      onInput={e => {
                        const val = (e.currentTarget as HTMLInputElement).value.trim().toUpperCase();
                        if (/^DCI-\d+(-[A-Z0-9-]+)?$/.test(val)) {
                          handleDciScanInput(val);
                          (e.currentTarget as HTMLInputElement).value = "";
                        }
                      }}
                      onChange={e => {
                        const val = e.target.value.trim().toUpperCase();
                        if (/^DCI-\d+(-[A-Z0-9-]+)?$/.test(val)) {
                          handleDciScanInput(val);
                          e.target.value = "";
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = e.currentTarget.value.trim().toUpperCase();
                          if (val.length > 0) { handleDciScanInput(val); e.currentTarget.value = ""; }
                          e.preventDefault();
                        }
                      }}
                    />
                  )}

                  {dciSaveToast && <div className="dci-save-toast">✓ TERSIMPAN</div>}

                  {dciScannedItemId === null && (
                    <div className="dci-standby">
                      <div className="dci-standby-scan-zone">
                        <div className="dci-reticle">
                          <div className="dci-reticle-corner dci-tl" />
                          <div className="dci-reticle-corner dci-tr" />
                          <div className="dci-reticle-corner dci-bl" />
                          <div className="dci-reticle-corner dci-br" />
                          <div className="dci-scan-line" />
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                          <span className="scanner-active-badge">🔴 Scanner Aktif</span>
                          <p className="dci-standby-hint">
                            {selectedConveyor
                              ? "Arahkan scanner TC 21 ke QR Code pada Item Check"
                              : "⚠️ Pilih Conveyor terlebih dahulu"}
                          </p>
                        </div>
                        {selectedConveyor && (
                          <div style={{ marginTop:8, padding:"5px 12px", background:"#ede9fe", borderRadius:20, border:"1px solid #c4b5fd" }}>
                            <span style={{ fontSize:12, color:"#5b21b6", fontWeight:700 }}>
                              🏭 {selectedConveyor} · 🔍 {selectedSpecificArea} · {filteredDciItems.length} item
                            </span>
                          </div>
                        )}
                      </div>

                      {Object.keys(dciResults).length > 0 && (
                        <div className="dci-done-list">
                          <p className="dci-done-list-title">
                            Sudah di-check ({Object.values(dciResults).filter(r => r.status).length})
                          </p>
                          {filteredDciItems.filter(item => dciResults[item.id]?.status != null).map(item => {
                            const r = dciResults[item.id], isOk = r?.status === "OK";
                            return (
                              <div
                                key={item.id}
                                className="dci-done-row"
                                onClick={() => {
                                  setDciScannedItemId(item.id);
                                  setDciCardVisible(false);
                                  setTimeout(() => setDciCardVisible(true), 30);
                                }}
                              >
                                <span className="dci-done-no">#{item.id}</span>
                                <span className="dci-done-name">{item.itemCheck}</span>
                                <span className={`dci-done-badge ${isOk ? "dci-done-badge--ok" : "dci-done-badge--ng"}`}>
                                  {isOk ? "✓ OK" : "✗ NG"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {dciScannedItemId !== null && (() => {
                    const item = DAILY_CHECK_INS_ITEMS.find(i => i.id === dciScannedItemId)!;
                    const dciResult = dciResults[item.id];
                    const isFilled  = dciResult?.status != null;
                    const isNg      = dciResult?.status === "NG";
                    const isOk      = dciResult?.status === "OK";
                    const ngEmpty   = isNg &&
                      (dciResult.selectedNgChoices?.length ?? 0) === 0 &&
                      !(dciResult.ngOtherNote?.trim()) &&
                      (dciResult.ngPhotos?.length ?? 0) === 0;
                    const checkpointsOpen = expandedCheckpoints[item.id] ?? false;
                    const indexNum = DAILY_CHECK_INS_ITEMS.indexOf(item) + 1;
                    const isChecking = isCheckingDuplicate === item.id;

                    return (
                      <div className={`dci-scan-card${dciCardVisible ? " dci-scan-card--visible" : ""}`}>
                        <div className="dci-scan-card-topbar">
                          <button className="dci-scan-back-btn" onClick={handleDciCloseCard}>← Kembali</button>
                          <div className="dci-scan-card-meta">
                            <span className="dci-scan-card-id">ID: DCI-{item.id}</span>
                            <span className="dci-scan-card-name">{item.itemCheck}</span>
                          </div>
                          <div className={`dci-badge ${isFilled ? (isOk ? "dci-badge--ok" : "dci-badge--ng") : "dci-badge--empty"}`}>
                            {isFilled ? (isOk ? "OK" : "NG") : String(indexNum).padStart(2, "0")}
                          </div>
                        </div>

                        {isFilled && (
                          <div className={`dci-scan-status-banner ${isOk ? "dci-scan-status-banner--ok" : "dci-scan-status-banner--ng"}`}>
                            {isOk ? "✓ KONDISI NORMAL — SEMUA OK" : `✗ KONDISI NG${(dciResult.selectedNgChoices?.length ?? 0) > 0 ? ` — ${dciResult.selectedNgChoices.length} TEMUAN` : " — PILIH KONDISI"}`}
                          </div>
                        )}

                        <button className="dci-checkpoint-toggle" onClick={() => toggleCheckpoints(item.id)} aria-expanded={checkpointsOpen}>
                          <span className="dci-cp-icon">📋</span>
                          <span>Lihat Checkpoint ({item.checkpoints.length} poin)</span>
                          <span className="dci-cp-arrow">{checkpointsOpen ? "▲" : "▼"}</span>
                        </button>

                        {checkpointsOpen && (
                          <div className="dci-checkpoint-list">
                            <p className="dci-cp-title">✅ Kondisi OK / Normal:</p>
                            {item.checkpoints.map((cp, ci) => (
                              <div key={ci} className="dci-cp-item">
                                <span className="dci-cp-bullet">✓</span>
                                <span className="dci-cp-text">{cp}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="dci-scan-status-row">
                          {(["OK", "NG"] as const).map(s => (
                            <button
                              key={s}
                              className={[
                                "dci-scan-status-btn",
                                s === "OK" ? "dci-scan-status-btn--ok" : "dci-scan-status-btn--ng",
                                dciResult?.status === s ? "dci-scan-status-btn--active" : ""
                              ].filter(Boolean).join(" ")}
                              onClick={() => handleDciScanStatusChange(item.id, s)}
                              disabled={isChecking}
                              style={isChecking ? { opacity:0.7, cursor:"wait" } : undefined}
                            >
                              {isChecking ? (
                                <>
                                  <span style={{ width:20, height:20, border:"2px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
                                  <span className="dci-scan-btn-label" style={{ fontSize:12 }}>Cek...</span>
                                </>
                              ) : (
                                <>
                                  <span className="dci-scan-btn-icon">{s === "OK" ? "✓" : "✗"}</span>
                                  <span className="dci-scan-btn-label">{s}</span>
                                </>
                              )}
                            </button>
                          ))}
                        </div>

                        {isNg && (
                          <div className={`dci-ng-panel${ngEmpty ? " dci-ng-panel--warn" : ""}`}>
                            <div className="dci-ng-panel-header">
                              <span className="dci-ng-panel-icon">⚠️</span>
                              <span className="dci-ng-panel-title">Pilih kondisi NG yang ditemukan:</span>
                              {ngEmpty && <span className="dci-ng-required-badge">Wajib pilih ≥ 1</span>}
                            </div>
                            <div className="dci-ng-choices-list">
                              {item.ngChoices.map((choice, ci) => {
                                const isSelected = dciResult.selectedNgChoices.includes(choice);
                                return (
                                  <button
                                    key={ci}
                                    className={`dci-ng-choice-btn${isSelected ? " dci-ng-choice-btn--active" : ""}`}
                                    onClick={() => handleDciNgChoiceToggle(item.id, choice)}
                                    role="checkbox"
                                    aria-checked={isSelected}
                                  >
                                    <span className="dci-ng-check-box">{isSelected ? "✓" : ""}</span>
                                    <span className="dci-ng-choice-text">{choice}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {ngEmpty && <div className="dci-ng-empty-warn">⚠ Wajib pilih kondisi NG, isi keterangan, atau tambah foto</div>}
                            <div className="dci-ng-other-section">
                              <label className="dci-ng-other-label">
                                <span className="dci-ng-other-icon">✏️</span>
                                Tambahan Lainnya
                                <span className="dci-ng-other-hint">(opsional)</span>
                              </label>
                              <textarea
                                className="dci-ng-other-input"
                                placeholder="Deskripsikan kondisi NG lainnya..."
                                value={dciResult.ngOtherNote || ""}
                                onChange={e => handleDciOtherNoteChange(item.id, e.target.value)}
                                rows={2}
                              />
                            </div>
                            <div className="dci-ng-photo-section">
                              <div className="dci-ng-photo-header">
                                <span className="dci-ng-photo-icon">📷</span>
                                <span className="dci-ng-photo-label">Foto Dokumentasi</span>
                                <span className="dci-ng-photo-hint">(opsional, maks. 5 foto)</span>
                              </div>
                              {(dciResult.ngPhotos?.length ?? 0) > 0 && (
                                <div className="dci-photo-grid">
                                  {dciResult.ngPhotos.map((src, pi) => (
                                    <div key={pi} className="dci-photo-thumb-wrap">
                                      <img src={src} alt={`Foto NG ${pi+1}`} className="dci-photo-thumb" onClick={() => setPhotoZoomSrc(src)} />
                                      <button className="dci-photo-remove-btn" onClick={() => handleDciPhotoRemove(item.id, pi)}>✕</button>
                                      <div className="dci-photo-zoom-hint">🔍</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(dciResult.ngPhotos?.length ?? 0) < 5 && (
                                <label className="dci-photo-add-btn">
                                  <input
                                    type="file" accept="image/*" capture="environment"
                                    style={{ display:"none" }}
                                    onChange={e => {
                                      const file = e.target.files?.[0]; if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = ev => {
                                        const img = new Image();
                                        img.onload = () => {
                                          const canvas = document.createElement("canvas");
                                          const MAX = 1024; let w = img.width, h = img.height;
                                          if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h*MAX/w); w = MAX; } else { w = Math.round(w*MAX/h); h = MAX; } }
                                          canvas.width = w; canvas.height = h;
                                          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
                                          handleDciPhotoAdd(item.id, canvas.toDataURL("image/jpeg", 0.75));
                                        };
                                        img.src = ev.target?.result as string;
                                      };
                                      reader.readAsDataURL(file); e.target.value = "";
                                    }}
                                  />
                                  <span className="dci-photo-add-icon">📸</span>
                                  <span>{(dciResult.ngPhotos?.length ?? 0) === 0 ? "Ambil / Pilih Foto" : `Tambah Foto (${dciResult.ngPhotos.length}/5)`}</span>
                                </label>
                              )}
                            </div>
                            <button
                              className="dci-scan-ng-save-btn"
                              disabled={ngEmpty}
                              onClick={() => { flashDciSaveToast(); setTimeout(() => handleDciCloseCard(), 600); }}
                            >
                              {ngEmpty ? "Pilih kondisi NG terlebih dahulu" : `✓ SIMPAN — ${(dciResult.selectedNgChoices?.length ?? 0)} TEMUAN NG`}
                            </button>
                          </div>
                        )}

                        {isFilled && (
                          <button
                            className="dci-scan-next-btn"
                            onClick={() => {
                              if (isNg && (dciResult.selectedNgChoices?.length ?? 0) === 0 && !(dciResult.ngOtherNote?.trim()) && (dciResult.ngPhotos?.length ?? 0) === 0) return;
                              handleDciCloseCard();
                            }}
                          >
                            <span>⬡</span><span>SCAN ITEM BERIKUTNYA</span><span style={{ marginLeft:"auto", opacity:0.6 }}>→</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

              ) : isCSRemoveTool ? (
                CS_REMOVE_TOOL_CHECKSHEET_ITEMS.map((item, index) => {
                  const crtResult = crtResults[item.id];
                  const isFilled  = crtResult?.status != null;
                  const isNg      = crtResult?.status === "NG";
                  const isOk      = crtResult?.status === "OK";
                  const ngEmpty   = isNg && (crtResult.selectedNgChoices?.length ?? 0) === 0 && (crtResult.ngPhotos?.length ?? 0) === 0;
                  return (
                    <div key={item.id} className={["dci-card", isOk ? "dci-card--ok" : "", isNg ? "dci-card--ng" : "", ngEmpty ? "dci-card--warn" : ""].filter(Boolean).join(" ")}>
                      <div className="dci-top-row">
                        <div className="dci-index">{index + 1}</div>
                        <div className="dci-main">
                          <div className="dci-item-name">{item.toolType}</div>
                          {isFilled && (
                            <div className={`dci-summary ${isOk ? "dci-summary--ok" : "dci-summary--ng"}`}>
                              {isOk ? <><span className="dci-sum-icon">✓</span> Semua kondisi normal</> : <><span className="dci-sum-icon">✗</span>{crtResult.selectedNgChoices.length > 0 ? `${crtResult.selectedNgChoices.length} kondisi NG` : (crtResult.ngPhotos?.length ?? 0) > 0 ? `${crtResult.ngPhotos.length} foto` : "Belum pilih kondisi NG"}</>}
                            </div>
                          )}
                        </div>
                        <div className={`dci-badge ${isFilled ? (isOk ? "dci-badge--ok" : "dci-badge--ng") : "dci-badge--empty"}`}>{isFilled ? (isOk ? "OK" : "NG") : "—"}</div>
                      </div>
                      <div className="dci-status-row">
                        {(["OK", "NG"] as const).map(s => (
                          <button key={s} className={["dci-status-btn", s === "OK" ? "dci-status-btn--ok" : "dci-status-btn--ng", crtResult?.status === s ? "dci-status-btn--active" : ""].filter(Boolean).join(" ")} onClick={() => handleCrtStatusChange(item.id, s)}>
                            <span className="dci-btn-circle" /><span className="dci-btn-label">{s === "OK" ? "✓ OK" : "✗ NG"}</span>
                          </button>
                        ))}
                      </div>
                      {isNg && (
                        <div className={`dci-ng-panel${ngEmpty ? " dci-ng-panel--warn" : ""}`}>
                          <div className="dci-ng-panel-header">
                            <span className="dci-ng-panel-icon">⚠️</span>
                            <span className="dci-ng-panel-title">Pilih kondisi NG:</span>
                            {ngEmpty && <span className="dci-ng-required-badge">Wajib pilih ≥ 1 atau tambah foto</span>}
                          </div>
                          <div className="dci-ng-choices-list">
                            {item.ngChoices.map((choice, ci) => {
                              const isSelected = crtResult.selectedNgChoices.includes(choice);
                              return (
                                <button key={ci} className={`dci-ng-choice-btn${isSelected ? " dci-ng-choice-btn--active" : ""}`} onClick={() => handleCrtNgChoiceToggle(item.id, choice)} role="checkbox" aria-checked={isSelected}>
                                  <span className="dci-ng-check-box">{isSelected ? "✓" : ""}</span>
                                  <span className="dci-ng-choice-text">{choice}</span>
                                </button>
                              );
                            })}
                          </div>
                          {ngEmpty && <div className="dci-ng-empty-warn">⚠ Wajib pilih kondisi NG atau tambah foto</div>}
                          <div className="dci-ng-photo-section">
                            <div className="dci-ng-photo-header">
                              <span className="dci-ng-photo-icon">📷</span>
                              <span className="dci-ng-photo-label">Foto Dokumentasi</span>
                              <span className="dci-ng-photo-hint">(opsional, maks. 5)</span>
                            </div>
                            {(crtResult.ngPhotos?.length ?? 0) > 0 && (
                              <div className="dci-photo-grid">
                                {crtResult.ngPhotos.map((src, pi) => (
                                  <div key={pi} className="dci-photo-thumb-wrap">
                                    <img src={src} alt={`Foto NG ${pi+1}`} className="dci-photo-thumb" onClick={() => setCrtPhotoZoomSrc(src)} />
                                    <button className="dci-photo-remove-btn" onClick={() => handleCrtPhotoRemove(item.id, pi)}>✕</button>
                                    <div className="dci-photo-zoom-hint">🔍</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {(crtResult.ngPhotos?.length ?? 0) < 5 && (
                              <label className="dci-photo-add-btn">
                                <input type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => {
                                  const file = e.target.files?.[0]; if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = ev => { const img = new Image(); img.onload = () => { const canvas = document.createElement("canvas"); const MAX=1024; let w=img.width,h=img.height; if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}} canvas.width=w;canvas.height=h;canvas.getContext("2d")?.drawImage(img,0,0,w,h);handleCrtPhotoAdd(item.id,canvas.toDataURL("image/jpeg",0.75));}; img.src=ev.target?.result as string; };
                                  reader.readAsDataURL(file); e.target.value="";
                                }} />
                                <span className="dci-photo-add-icon">📸</span>
                                <span>{(crtResult.ngPhotos?.length ?? 0) === 0 ? "Ambil / Pilih Foto" : `Tambah Foto (${crtResult.ngPhotos.length}/5)`}</span>
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })

              ) : (
                checklistItems.map((item, index) => {
                  const result = results[item.id];
                  const isExpanded = expandedItem === item.id;
                  const isFilled = result?.status != null;
                  return (
                    <div key={item.id} className={`checklist-item-card${isExpanded ? " expanded" : ""}${isFilled ? " filled" : ""}`}>
                      <div
                        className="item-header"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); setExpandedItem(isExpanded?null:item.id); } }}
                      >
                        <div className="item-number">{index + 1}.</div>
                        <div className="item-content">
                          <h3 className="item-title">{item.checkPoint}</h3>
                          <p className="item-standard">Standard: {item.standard}</p>
                        </div>
                        <span className={`status-indicator ${isFilled ? "filled" : "empty"}`}>{isFilled ? "✓" : "○"}</span>
                        <button className="expand-button" aria-expanded={isExpanded}>{isExpanded ? "▲" : "▼"}</button>
                      </div>
                      {isExpanded && (
                        <div className="item-details">
                          <div className="status-options">
                            {(["OK", "NG"] as const).map(s => (
                              <div
                                key={s}
                                className={`status-option${result?.status===s ? ` selected ${s.toLowerCase()}` : ""}`}
                                onClick={() => handleStatusChange(item.id, s)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); handleStatusChange(item.id, s); } }}
                              >
                                <span className="option-circle" />
                                <span className="option-label">{s}</span>
                              </div>
                            ))}
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              Keterangan
                              {result?.status==="NG" && <span className="required">*</span>}
                              <span className="optional">(Opsional)</span>
                            </label>
                            <textarea
                              className="form-textarea"
                              placeholder={result?.status==="NG" ? "Deskripsikan temuan NG..." : "Masukkan keterangan (opsional)"}
                              value={result?.notes || ""}
                              onChange={e => handleNotesChange(item.id, e.target.value)}
                              rows={3}
                              disabled={!result?.status}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* SUBMIT */}
        <div className="submit-section">
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? <><span className="spinner" /> Menyimpan...</> : `💾 SIMPAN CHECKLIST${completedCount > 0 ? ` (${completedCount} item)` : ""}`}
          </button>
          {completedCount > 0 && (
            <p className="submit-hint">{totalCount - completedCount} item belum diisi • Data tersimpan dapat dilanjutkan nanti</p>
          )}
          {isEditingPast && (
            <p style={{ textAlign:"center", fontSize:12, color:"#92400e", marginTop:4, fontWeight:600 }}>
              ⚠️ Sedang mengedit data tanggal {selectedDate}
            </p>
          )}
        </div>
      </main>

      {/* Duplicate Warning Modal */}
      {duplicateWarning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setDuplicateWarning(null)}>
          <div style={{ background:"white", borderRadius:16, maxWidth:440, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", padding:"18px 22px", display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:28 }}>⚠️</span>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:"white" }}>Gauge Sudah Pernah Di-Check</p>
                <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.85)" }}>Peringatan duplikasi checklist</p>
              </div>
            </div>
            <div style={{ padding:"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:10, padding:"14px 16px" }}>
                <p style={{ margin:"0 0 8px", fontSize:13, color:"#92400e", fontWeight:600 }}>Gauge yang ingin di-check:</p>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#1e293b", padding:"8px 12px", background:"white", borderRadius:8, border:"1px solid #e2e8f0" }}>{duplicateWarning.itemCheck}</p>
              </div>
              <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:10, padding:"14px 16px" }}>
                <p style={{ margin:"0 0 10px", fontSize:13, color:"#991b1b", fontWeight:700 }}>✗ Sudah pernah di-check di:</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {duplicateWarning.duplicateLocations.map((loc, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px", background:"white", borderRadius:8, border:"1px solid #fecaca" }}>
                      <span style={{ color:"#ef4444", fontWeight:700, fontSize:13, flexShrink:0 }}>📍</span>
                      <span style={{ fontSize:13, color:"#1e293b", fontWeight:500, lineHeight:1.4 }}>{loc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ margin:0, fontSize:12, color:"#64748b", textAlign:"center", lineHeight:1.5 }}>
                Setiap gauge hanya boleh digunakan di <strong>1 lokasi per hari</strong>. Apakah Anda yakin ingin melanjutkan?
              </p>
            </div>
            <div style={{ padding:"14px 22px", borderTop:"1px solid #e2e8f0", display:"flex", gap:10 }}>
              <button onClick={() => setDuplicateWarning(null)} style={{ flex:1, padding:"11px 16px", background:"#f1f5f9", color:"#475569", border:"1.5px solid #e2e8f0", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer" }}>← Batalkan</button>
              <button onClick={duplicateWarning.onConfirm} style={{ flex:1, padding:"11px 16px", background:"#f59e0b", color:"white", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer" }}>Tetap Lanjut →</button>
            </div>
          </div>
        </div>
      )}

      {photoZoomSrc && (
        <div className="photo-zoom-overlay" onClick={() => setPhotoZoomSrc(null)}>
          <div className="photo-zoom-container" onClick={e => e.stopPropagation()}>
            <button className="photo-zoom-close" onClick={() => setPhotoZoomSrc(null)}>✕</button>
            <img src={photoZoomSrc} alt="Foto NG" className="photo-zoom-img" />
          </div>
        </div>
      )}
      {crtPhotoZoomSrc && (
        <div className="photo-zoom-overlay" onClick={() => setCrtPhotoZoomSrc(null)}>
          <div className="photo-zoom-container" onClick={e => e.stopPropagation()}>
            <button className="photo-zoom-close" onClick={() => setCrtPhotoZoomSrc(null)}>✕</button>
            <img src={crtPhotoZoomSrc} alt="Foto NG" className="photo-zoom-img" />
          </div>
        </div>
      )}

      <style jsx>{`
        .main-content{margin-left:80px;padding:20px;min-height:100vh;background:#f5f7fa;}
        .header-section{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;padding:16px 20px;border-radius:12px;margin-bottom:20px;display:flex;align-items:center;gap:16px;box-shadow:0 4px 12px rgba(124,58,237,0.2);}
        .back-button{background:rgba(255,255,255,0.2);border:none;color:white;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
        .back-button:hover{background:rgba(255,255,255,0.3);}
        .page-title{flex:1;margin:0;font-size:20px;font-weight:700;}
        .header-actions{display:flex;gap:8px;}
        .icon-button{background:rgba(255,255,255,0.2);border:none;color:white;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:18px;}
        .info-card{background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .info-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;}
        .info-row:last-child{border-bottom:none;}
        .info-label{font-weight:600;color:#64748b;font-size:14px;}
        .info-value{color:#1e293b;font-weight:500;font-size:14px;}
        .area-value{color:#7c3aed;font-weight:700;}
        .checklist-type-static{display:flex;align-items:center;gap:8px;}
        .dropdown-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.05em;}
        .dropdown-badge.gl{background:#f3e5f5;color:#7b1fa2;}
        .dropdown-badge.ins{background:#e0f2fe;color:#0277bd;}
        .time-slot-badge{background:#1e3a8a;color:white;padding:3px 12px;border-radius:20px;font-weight:700;font-size:13px;letter-spacing:0.05em;font-family:monospace;}
        .carline-card{background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid #f59e0b;}
        .carline-card-header{display:flex;align-items:center;gap:8px;margin-bottom:14px;}
        .carline-icon{font-size:18px;}
        .carline-title{margin:0;font-size:15px;font-weight:700;color:#1e293b;}
        .carline-row{margin-bottom:14px;}
        .carline-label{display:block;font-size:13px;font-weight:600;color:#64748b;margin-bottom:6px;}
        .carline-add-section{background:#fffbeb;border:1px dashed #fcd34d;border-radius:10px;padding:12px 14px;}
        .carline-add-label{margin:0 0 10px;font-size:13px;color:#92400e;font-weight:600;}
        .carline-inputs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .carline-input{flex:1;min-width:100px;padding:9px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;color:#1e293b;background:white;outline:none;text-transform:uppercase;transition:border-color 0.2s;}
        .carline-input:focus{border-color:#f59e0b;}
        .carline-add-btn{padding:9px 16px;background:#f59e0b;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background 0.15s;}
        .carline-add-btn:hover:not(:disabled){background:#d97706;}
        .carline-add-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .carline-error{margin:8px 0 0;font-size:12px;color:#dc2626;font-weight:500;}
        .carline-warning{margin-top:10px;padding:8px 12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e;font-weight:500;}
        .loading-items{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;background:white;border-radius:12px;margin-bottom:20px;}
        .loading-spinner{width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;animation:spin 0.8s linear infinite;}
        .loading-items p{color:#64748b;font-size:14px;margin:0;}
        .progress-card{background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
        .progress-text{font-weight:600;color:#1e293b;font-size:14px;}
        .progress-percent{font-weight:700;color:#7c3aed;font-size:16px;}
        .progress-bar{width:100%;height:10px;background:#e2e8f0;border-radius:10px;overflow:hidden;}
        .progress-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:10px;transition:width 0.3s ease;}
        .success-banner{background:#f0fdf4;border:1px solid #86efac;border-left:4px solid #22c55e;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;color:#166534;font-size:14px;font-weight:500;}
        .error-banner{background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;}
        .error-icon{font-size:20px;}
        .error-text{flex:1;color:#dc2626;font-size:14px;}
        .error-retry{background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;}
        .info-box-partial{background:#f5f3ff;border:1px solid #ddd6fe;border-left:4px solid #7c3aed;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;}
        .info-text{color:#5b21b6;font-size:13px;line-height:1.4;}
        .checklist-container{display:flex;flex-direction:column;gap:12px;margin-bottom:130px;}
        .checklist-item-card{background:white;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid transparent;transition:all 0.2s;}
        .checklist-item-card:hover,.checklist-item-card.expanded{border-color:#7c3aed;}
        .checklist-item-card.filled{border-left:4px solid #22c55e;}
        .item-header{display:flex;align-items:flex-start;gap:12px;cursor:pointer;}
        .item-number{font-weight:700;color:#7c3aed;font-size:16px;min-width:28px;}
        .item-content{flex:1;}
        .item-title{margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;line-height:1.4;}
        .item-standard{margin:0;font-size:12px;color:#64748b;}
        .status-indicator{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;}
        .status-indicator.filled{background:#22c55e;color:white;}
        .status-indicator.empty{background:#e2e8f0;color:#94a3b8;border:2px solid #cbd5e1;}
        .expand-button{background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;padding:4px;}
        .item-details{margin-top:18px;padding-top:18px;border-top:1px solid #e2e8f0;}
        .status-options{display:flex;gap:12px;margin-bottom:18px;}
        .status-option{flex:1;display:flex;align-items:center;gap:10px;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;transition:all 0.2s;user-select:none;}
        .status-option.selected.ok{border-color:#10b981;background:#f0fdf4;}
        .status-option.selected.ng{border-color:#ef4444;background:#fef2f2;}
        .option-circle{width:20px;height:20px;border:2px solid #cbd5e1;border-radius:50%;transition:all 0.2s;flex-shrink:0;}
        .status-option.selected.ok .option-circle{background:#10b981;border-color:#10b981;}
        .status-option.selected.ng .option-circle{background:#ef4444;border-color:#ef4444;}
        .option-label{font-weight:600;color:#1e293b;}
        .status-option.selected.ok .option-label{color:#10b981;}
        .status-option.selected.ng .option-label{color:#ef4444;}
        .form-group{margin-bottom:14px;}
        .form-label{display:block;font-weight:600;color:#1e293b;margin-bottom:8px;font-size:14px;}
        .required{color:#ef4444;margin-left:2px;}
        .optional{color:#94a3b8;font-weight:400;margin-left:4px;font-size:12px;}
        .form-textarea{width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:14px;resize:vertical;transition:all 0.2s;background:white;box-sizing:border-box;}
        .form-textarea:focus{outline:none;border-color:#7c3aed;}
        .form-textarea:disabled{background:#f8fafc;cursor:not-allowed;}
        .submit-section{position:fixed;bottom:0;left:80px;right:0;background:white;padding:14px 24px;box-shadow:0 -4px 12px rgba(0,0,0,0.1);z-index:100;}
        .submit-button{width:100%;max-width:800px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px 32px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 12px rgba(124,58,237,0.3);}
        .submit-button:hover:not(:disabled){transform:translateY(-2px);}
        .submit-button:disabled{opacity:0.6;cursor:not-allowed;}
        .submit-hint{text-align:center;font-size:12px;color:#64748b;margin:8px 0 0;}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;}
        .dci-card{background:white;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:2px solid #e2e8f0;transition:all 0.2s;}
        .dci-card--ok{border-left:5px solid #22c55e;background:#fafffe;}
        .dci-card--ng{border-left:5px solid #ef4444;background:#fffafa;}
        .dci-card--warn{border-left:5px solid #f59e0b;}
        .dci-top-row{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;}
        .dci-index{min-width:32px;height:32px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
        .dci-main{flex:1;}
        .dci-item-name{font-size:15px;font-weight:700;color:#1e293b;line-height:1.3;}
        .dci-summary{display:inline-flex;align-items:center;gap:5px;margin-top:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;}
        .dci-summary--ok{background:#dcfce7;color:#166534;}
        .dci-summary--ng{background:#fee2e2;color:#991b1b;}
        .dci-sum-icon{font-size:13px;}
        .dci-badge{min-width:38px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;letter-spacing:0.05em;flex-shrink:0;}
        .dci-badge--empty{background:#f1f5f9;color:#94a3b8;border:1.5px solid #e2e8f0;}
        .dci-badge--ok{background:#dcfce7;color:#16a34a;border:1.5px solid #86efac;}
        .dci-badge--ng{background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;}
        .dci-checkpoint-toggle{width:100%;display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:12.5px;color:#475569;font-weight:600;margin-bottom:12px;transition:all 0.15s;text-align:left;}
        .dci-checkpoint-toggle:hover{background:#f1f5f9;border-color:#c4b5fd;color:#5b21b6;}
        .dci-cp-icon{font-size:14px;}
        .dci-cp-arrow{margin-left:auto;font-size:11px;color:#94a3b8;}
        .dci-checkpoint-list{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-bottom:14px;}
        .dci-cp-title{margin:0 0 8px;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;}
        .dci-cp-item{display:flex;align-items:flex-start;gap:8px;padding:4px 0;}
        .dci-cp-bullet{color:#22c55e;font-weight:700;font-size:13px;flex-shrink:0;margin-top:1px;}
        .dci-cp-text{font-size:13px;color:#166534;line-height:1.4;}
        .dci-status-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:0;}
        .dci-status-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;background:white;transition:all 0.15s;font-size:14px;font-weight:700;}
        .dci-status-btn--ok:hover{border-color:#22c55e;background:#f0fdf4;color:#16a34a;}
        .dci-status-btn--ng:hover{border-color:#ef4444;background:#fef2f2;color:#dc2626;}
        .dci-status-btn--ok.dci-status-btn--active{border-color:#22c55e;background:#22c55e;color:white;box-shadow:0 3px 10px rgba(34,197,94,0.3);}
        .dci-status-btn--ng.dci-status-btn--active{border-color:#ef4444;background:#ef4444;color:white;box-shadow:0 3px 10px rgba(239,68,68,0.3);}
        .dci-btn-circle{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:0.6;}
        .dci-status-btn--active .dci-btn-circle{background:rgba(255,255,255,0.4);border-color:white;opacity:1;}
        .dci-btn-label{font-size:14px;font-weight:700;letter-spacing:0.03em;}
        .dci-ng-panel{margin-top:14px;background:#fff7ed;border:2px solid #fed7aa;border-radius:10px;padding:14px;}
        .dci-ng-panel--warn{border-color:#f59e0b;background:#fffbeb;}
        .dci-ng-panel-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
        .dci-ng-panel-icon{font-size:16px;}
        .dci-ng-panel-title{font-size:13px;font-weight:700;color:#92400e;flex:1;}
        .dci-ng-required-badge{background:#ef4444;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
        .dci-ng-choices-list{display:flex;flex-direction:column;gap:7px;}
        .dci-ng-choice-btn{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;background:white;border:2px solid #e2e8f0;border-radius:9px;cursor:pointer;text-align:left;transition:all 0.15s;}
        .dci-ng-choice-btn:hover{border-color:#fca5a5;background:#fff5f5;}
        .dci-ng-choice-btn--active{border-color:#ef4444;background:#fef2f2;}
        .dci-ng-check-box{min-width:20px;height:20px;border:2px solid #e2e8f0;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;background:#f1f5f9;transition:all 0.15s;margin-top:1px;}
        .dci-ng-choice-btn--active .dci-ng-check-box{background:#ef4444;border-color:#ef4444;}
        .dci-ng-choice-text{font-size:13px;color:#1e293b;line-height:1.4;font-weight:500;}
        .dci-ng-choice-btn--active .dci-ng-choice-text{color:#991b1b;font-weight:600;}
        .dci-ng-empty-warn{margin-top:10px;padding:8px 12px;background:#fef3c7;border-radius:7px;font-size:12px;color:#92400e;font-weight:600;text-align:center;}
        .dci-ng-other-section{margin-top:12px;padding-top:12px;border-top:1px dashed #fed7aa;}
        .dci-ng-other-label{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#92400e;margin-bottom:7px;}
        .dci-ng-other-icon{font-size:14px;}
        .dci-ng-other-hint{font-weight:400;color:#a16207;font-size:11px;margin-left:2px;}
        .dci-ng-other-input{width:100%;padding:9px 12px;border:2px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;transition:all 0.15s;background:white;box-sizing:border-box;color:#1e293b;line-height:1.5;}
        .dci-ng-other-input:focus{outline:none;border-color:#f59e0b;}
        .dci-ng-other-input::placeholder{color:#94a3b8;font-size:12px;}
        .dci-ng-photo-section{margin-top:14px;padding-top:13px;border-top:1px dashed #fed7aa;}
        .dci-ng-photo-header{display:flex;align-items:center;gap:6px;margin-bottom:10px;}
        .dci-ng-photo-icon{font-size:16px;}
        .dci-ng-photo-label{font-size:13px;font-weight:700;color:#92400e;}
        .dci-ng-photo-hint{font-size:11px;color:#a16207;margin-left:2px;}
        .dci-photo-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
        .dci-photo-thumb-wrap{position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid #e2e8f0;cursor:pointer;flex-shrink:0;}
        .dci-photo-thumb-wrap:hover .dci-photo-zoom-hint{opacity:1;}
        .dci-photo-thumb{width:100%;height:100%;object-fit:cover;display:block;}
        .dci-photo-zoom-hint{position:absolute;inset:0;background:rgba(0,0,0,0.4);color:white;display:flex;align-items:center;justify-content:center;font-size:20px;opacity:0;transition:opacity 0.15s;pointer-events:none;}
        .dci-photo-remove-btn{position:absolute;top:3px;right:3px;width:20px;height:20px;background:rgba(239,68,68,0.9);color:white;border:none;border-radius:50%;cursor:pointer;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;z-index:2;}
        .dci-photo-add-btn{display:flex;align-items:center;gap:8px;padding:9px 16px;background:white;border:2px dashed #f59e0b;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;color:#92400e;transition:all 0.15s;width:100%;box-sizing:border-box;}
        .dci-photo-add-btn:hover{background:#fffbeb;border-color:#d97706;}
        .dci-photo-add-icon{font-size:18px;}
        .photo-zoom-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;}
        .photo-zoom-container{position:relative;max-width:95vw;max-height:90vh;}
        .photo-zoom-img{max-width:100%;max-height:90vh;border-radius:10px;object-fit:contain;display:block;}
        .photo-zoom-close{position:absolute;top:-14px;right:-14px;width:32px;height:32px;background:#ef4444;color:white;border:3px solid white;border-radius:50%;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .dci-scan-wrapper{position:relative;min-height:300px;}
        .dci-scan-hidden-input{position:fixed;opacity:0;width:1px;height:1px;top:0;left:0;border:none;outline:none;background:transparent;color:transparent;caret-color:transparent;}
        .dci-save-toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:9px 22px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:0.06em;white-space:nowrap;z-index:9000;pointer-events:none;animation:dciToastIn 0.2s ease,dciToastOut 0.2s ease 1.2s forwards;box-shadow:0 4px 16px rgba(16,185,129,0.4);}
        @keyframes dciToastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes dciToastOut{from{opacity:1;}to{opacity:0;}}
        .dci-standby{display:flex;flex-direction:column;gap:16px;}
        .dci-standby-scan-zone{background:white;border-radius:16px;padding:32px 20px;display:flex;flex-direction:column;align-items:center;gap:20px;border:2px dashed #c4b5fd;box-shadow:0 2px 8px rgba(124,58,237,0.06);}
        .dci-reticle{width:140px;height:96px;position:relative;}
        .dci-reticle-corner{position:absolute;width:18px;height:18px;border-color:#7c3aed;border-style:solid;}
        .dci-tl{top:0;left:0;border-width:3px 0 0 3px;border-radius:3px 0 0 0;}
        .dci-tr{top:0;right:0;border-width:3px 3px 0 0;border-radius:0 3px 0 0;}
        .dci-bl{bottom:0;left:0;border-width:0 0 3px 3px;border-radius:0 0 0 3px;}
        .dci-br{bottom:0;right:0;border-width:0 3px 3px 0;border-radius:0 0 3px 0;}
        .dci-scan-line{position:absolute;left:8px;right:8px;height:2px;background:linear-gradient(90deg,transparent,#7c3aed,transparent);top:50%;animation:dciScanline 2s ease-in-out infinite;}
        @keyframes dciScanline{0%,100%{transform:translateY(-38px);opacity:0;}10%{opacity:1;}90%{opacity:1;}50%{transform:translateY(38px);}}
        .scanner-active-badge{display:inline-flex;align-items:center;gap:5px;background:#fef2f2;color:#dc2626;border:1.5px solid #fca5a5;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.03em;animation:scannerPulse 2s ease-in-out infinite;}
        @keyframes scannerPulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
        .dci-standby-hint{font-size:13px;color:#64748b;text-align:center;margin:0;line-height:1.5;max-width:260px;}
        .dci-done-list{background:white;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);}
        .dci-done-list-title{font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;}
        .dci-done-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.12s;border:1px solid #f1f5f9;margin-bottom:6px;}
        .dci-done-row:hover{background:#f8fafc;}
        .dci-done-no{font-size:11px;color:#94a3b8;font-weight:600;min-width:28px;}
        .dci-done-name{flex:1;font-size:13px;font-weight:600;color:#1e293b;}
        .dci-done-badge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;flex-shrink:0;}
        .dci-done-badge--ok{background:#dcfce7;color:#16a34a;}
        .dci-done-badge--ng{background:#fee2e2;color:#dc2626;}
        .dci-scan-card{background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.12);border:2px solid #e2e8f0;overflow:hidden;transform:translateY(24px);opacity:0;transition:transform 0.28s cubic-bezier(0.34,1.3,0.64,1),opacity 0.2s ease;}
        .dci-scan-card--visible{transform:translateY(0);opacity:1;}
        .dci-scan-card-topbar{background:#f8fafc;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0;}
        .dci-scan-back-btn{background:#e2e8f0;border:none;border-radius:8px;color:#475569;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;}
        .dci-scan-back-btn:hover{background:#cbd5e1;}
        .dci-scan-card-meta{flex:1;overflow:hidden;}
        .dci-scan-card-id{display:block;font-size:10px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;}
        .dci-scan-card-name{display:block;font-size:15px;font-weight:700;color:#1e293b;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dci-scan-status-banner{padding:10px 16px;font-size:12px;font-weight:700;letter-spacing:0.04em;}
        .dci-scan-status-banner--ok{background:#f0fdf4;color:#15803d;border-bottom:1px solid #bbf7d0;}
        .dci-scan-status-banner--ng{background:#fef2f2;color:#b91c1c;border-bottom:1px solid #fecaca;}
        .dci-scan-status-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px;}
        .dci-scan-status-btn{border:2.5px solid;border-radius:14px;padding:20px 12px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;transition:all 0.15s;background:white;}
        .dci-scan-status-btn--ok{border-color:#e2e8f0;color:#16a34a;}
        .dci-scan-status-btn--ng{border-color:#e2e8f0;color:#dc2626;}
        .dci-scan-status-btn--ok:hover:not(.dci-scan-status-btn--active){border-color:#86efac;background:#f0fdf4;}
        .dci-scan-status-btn--ng:hover:not(.dci-scan-status-btn--active){border-color:#fca5a5;background:#fef2f2;}
        .dci-scan-status-btn--ok.dci-scan-status-btn--active{background:#22c55e;border-color:#22c55e;color:white;box-shadow:0 4px 14px rgba(34,197,94,0.35);}
        .dci-scan-status-btn--ng.dci-scan-status-btn--active{background:#ef4444;border-color:#ef4444;color:white;box-shadow:0 4px 14px rgba(239,68,68,0.35);}
        .dci-scan-btn-icon{font-size:24px;font-weight:700;line-height:1;}
        .dci-scan-btn-label{font-size:15px;font-weight:800;letter-spacing:0.06em;}
        .dci-scan-card .dci-ng-panel{margin:0 16px 16px;}
        .dci-scan-ng-save-btn{width:100%;background:#ef4444;color:white;border:none;border-radius:10px;padding:13px;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer;margin-top:10px;transition:all 0.15s;}
        .dci-scan-ng-save-btn:disabled{background:#cbd5e1;color:#94a3b8;cursor:not-allowed;}
        .dci-scan-next-btn{display:flex;align-items:center;gap:8px;margin:0 16px 16px;padding:13px 16px;background:#ede9fe;border:1.5px solid #c4b5fd;border-radius:12px;font-size:13px;font-weight:700;color:#5b21b6;cursor:pointer;letter-spacing:0.04em;transition:all 0.15s;width:calc(100% - 32px);}
        .dci-scan-next-btn:hover{background:#ddd6fe;border-color:#a78bfa;}
        .dci-scan-card .dci-checkpoint-toggle{margin:0 16px 0;width:calc(100% - 32px);}
        .dci-scan-card .dci-checkpoint-list{margin:0 16px 12px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @media(max-width:768px){.main-content{margin-left:0;padding:12px;}.submit-section{left:0;padding:10px 16px;}.carline-inputs{flex-direction:column;align-items:stretch;}}

        .pa-conveyor-dropdown-container{position:relative;width:100%;}
        .pa-conveyor-dropdown-trigger{width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;background:white;font-size:14px;font-weight:600;color:#1e293b;cursor:pointer;display:flex;justify-content:space-between;align-items:center;text-align:left;text-transform:uppercase;transition:border-color 0.15s;box-sizing:border-box;}
        .pa-conveyor-dropdown-trigger:hover:not(:disabled){border-color:#f59e0b;background:#fffbeb;}
        .pa-conveyor-dropdown-trigger:focus{outline:none;border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,0.1);}
        .pa-conveyor-dropdown-trigger:disabled{opacity:0.6;cursor:not-allowed;background:#f8fafc;}
        .pa-conveyor-dropdown-arrow{font-size:11px;color:#64748b;transition:transform 0.15s;flex-shrink:0;margin-left:8px;}
        .pa-conveyor-dropdown-container.open .pa-conveyor-dropdown-arrow{transform:rotate(180deg);}
        .pa-conveyor-dropdown-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:50;background:white;border:2px solid #e2e8f0;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.12);max-height:220px;overflow-y:auto;}
        .pa-conveyor-dropdown-item{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid #f1f5f9;transition:background 0.1s;}
        .pa-conveyor-dropdown-item:last-child{border-bottom:none;}
        .pa-conveyor-dropdown-item:hover{background:#f8fafc;}
        .pa-conveyor-dropdown-item.selected{background:#fef3c7;}
        .pa-conveyor-dropdown-item-btn{flex:1;background:none;border:none;padding:0;font-size:14px;font-weight:600;color:#1e293b;cursor:pointer;text-align:left;text-transform:uppercase;line-height:1.4;}
        .pa-conveyor-dropdown-item.selected .pa-conveyor-dropdown-item-btn{color:#92400e;}
        .pa-conveyor-dropdown-item-btn:disabled{cursor:not-allowed;opacity:0.6;}
        .pa-conveyor-delete-btn{flex-shrink:0;margin-left:10px;width:28px;height:28px;background:none;border:none;border-radius:6px;color:#dc2626;font-size:18px;font-weight:700;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background 0.15s;}
        .pa-conveyor-delete-btn:hover:not(:disabled){background:#fef2f2;}
        .pa-conveyor-delete-btn:disabled{opacity:0.4;cursor:not-allowed;}
      `}</style>
    </>
  );
}

export default function ChecksheetPreAssyPage() {
  return (
    <Suspense fallback={
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:40, height:40, border:"3px solid #e2e8f0", borderTopColor:"#7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
          <p style={{ color:"#64748b" }}>Memuat...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    }>
      <ChecksheetPreAssyPageInner />
    </Suspense>
  );
}