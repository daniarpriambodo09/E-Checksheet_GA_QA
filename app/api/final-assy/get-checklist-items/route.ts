// app/api/final-assy/get-checklist-items/route.ts
// UPDATE: Tambah filter schedule_type berdasarkan tanggal & shift.
//
// Weekly check rules (dari Excel):
//   Item 3  (GO NO GO)               - checkpoint "BISA MENDETEKSI..." saja
//   Item 6  (IMPORTANT/INSPECTION POINT) - semua checkpoint
//   Item 10 (INSPECTION BOARD)           - semua checkpoint
//
// Jadwal aktif:
//   Shift A → tanggal dimana (date - 1) % 7 == 0  → tgl 1,8,15,22,29
//   Shift B → tanggal dimana (date - 3) % 7 == 0  → tgl 3,10,17,24,31
//
// Query param:
//   type     : 'inspector' | 'group-leader'
//   areaCode : string (optional)
//   dateKey  : 'YYYY-MM-DD' (optional, default = today)
//              Jika tidak dikirim, backend pakai tanggal server.

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface ChecklistItem {
  id: number;
  no: string;
  item_check: string;
  check_point: string;
  metode_check: string;
  area: string;
  shift: string;
  schedule_type: string;          // 'daily' | 'weekly'
  weekly_shift_anchor: number | null;  // 1 (shift A) | 3 (shift B)
}

// ── Helper: apakah item aktif untuk tanggal & shift tertentu ─────────────────
function isItemActiveForDate(
  scheduleType: string,
  weeklyShiftAnchor: number | null,
  shift: string,
  dateDay: number  // day of month (1-31)
): boolean {
  if (scheduleType === 'daily') return true;

  if (scheduleType === 'weekly') {
    if (weeklyShiftAnchor === null) return true; // fallback: tampilkan
    // Formula: (dateDay - anchor) % 7 === 0
    return (dateDay - weeklyShiftAnchor) % 7 === 0;
  }

  return true; // default: tampilkan
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type    = searchParams.get('type');
    const dateKey = searchParams.get('dateKey'); // 'YYYY-MM-DD'

    if (!type) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    // Parse tanggal
    let targetDateDay: number;
    if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      targetDateDay = parseInt(dateKey.split('-')[2], 10);
    } else {
      // Pakai hari ini (timezone WIB = UTC+7)
      const now = new Date();
      const wibOffset = 7 * 60;
      const wibMs = now.getTime() + (wibOffset - now.getTimezoneOffset()) * 60000;
      targetDateDay = new Date(wibMs).getDate();
    }

    let categoryCode: string;
    if (type === 'inspector') {
      categoryCode = 'final-assy-inspector';
    } else if (type === 'group-leader') {
      categoryCode = 'final-assy-gl';
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // ── Fetch semua item (termasuk schedule metadata) ─────────────────────────
    // Jika kolom schedule_type / weekly_shift_anchor belum ada di DB,
    // query fallback menggunakan COALESCE ke default 'daily' / NULL.
    const items = await executeQuery<ChecklistItem>(
      `SELECT
         ci.id,
         ci.item_no          AS no,
         ci.item_check,
         ci.check_point,
         ci.metode_check,
         ci.area,
         ci.shift,
         COALESCE(ci.schedule_type, 'daily')       AS schedule_type,
         ci.weekly_shift_anchor,
         ci.show_in_wp_check,
         ci.show_in_checker,
         ci.show_in_visual_1,
         ci.show_in_visual_2,
         ci.show_in_double_check,
         ci.sort_order
       FROM checklist_items ci
       JOIN checklist_categories cc ON ci.category_id = cc.id
       WHERE cc.category_code = $1
         AND ci.is_active = TRUE
       ORDER BY ci.sort_order, ci.id`,
      [categoryCode]
    );

    // ── Kelompokkan per (item_no, item_check, check_point) ───────────────────
    // Setiap grup punya shift A dan shift B.
    // shiftIdMap: { "A": db_id_A, "B": db_id_B }
    const groupedItems: Record<string, any> = {};

    items.forEach((row) => {
      const key = `${row.no}-${row.item_check}-${row.check_point}-${row.metode_check}`;

      if (!groupedItems[key]) {
        groupedItems[key] = {
          id:           row.id,
          no:           row.no,
          itemCheck:    row.item_check,
          checkPoint:   row.check_point,
          metodeCheck:  row.metode_check,
          area:         row.area,
          shifts:       [],
          shiftIdMap:   {} as Record<string, number>,
          scheduleInfo: {} as Record<string, { type: string; anchor: number | null; activeToday: boolean }>,
          showIn: {
            wpCheck:     (row as any).show_in_wp_check,
            checker:     (row as any).show_in_checker,
            visual1:     (row as any).show_in_visual_1,
            visual2:     (row as any).show_in_visual_2,
            doubleCheck: (row as any).show_in_double_check,
          },
        };
      }

      const g = groupedItems[key];
      const shift = row.shift as 'A' | 'B';

      // Cek apakah item aktif untuk tanggal ini
      const activeToday = isItemActiveForDate(
        row.schedule_type,
        row.weekly_shift_anchor,
        shift,
        targetDateDay
      );

      // Simpan info schedule per shift
      g.scheduleInfo[shift] = {
        type:        row.schedule_type,
        anchor:      row.weekly_shift_anchor,
        activeToday,
      };

      if (!g.shifts.some((s: any) => s.shift === shift)) {
        g.shifts.push({ shift });
      }
      g.shiftIdMap[shift] = row.id;
    });

    // Untuk inspector: pastikan kedua shift ada di shiftIdMap
    if (type === 'inspector') {
      Object.values(groupedItems).forEach((item: any) => {
        const hasShiftB = item.shifts.some((s: any) => s.shift === 'B');
        if (!hasShiftB) {
          item.shifts.push({ shift: 'B' });
          item.shiftIdMap['B'] = item.shiftIdMap['A'] ?? item.id;
          // Shift B schedule: salin dari shift A tapi dengan anchor 3
          const aInfo = item.scheduleInfo['A'];
          if (aInfo) {
            const bAnchor = aInfo.type === 'weekly' ? 3 : null;
            item.scheduleInfo['B'] = {
              type:        aInfo.type,
              anchor:      bAnchor,
              activeToday: aInfo.type === 'weekly'
                ? isItemActiveForDate(aInfo.type, bAnchor, 'B', targetDateDay)
                : true,
            };
          }
        }
      });
    }

    const allItems = Object.values(groupedItems);

    // ── Pisahkan: activeItems vs weeklySkippedItems ───────────────────────────
    // Frontend akan menerima SEMUA item beserta flag activeToday per shift,
    // sehingga frontend bisa:
    //   1. Menyembunyikan item yang tidak aktif hari ini
    //   2. Menampilkan info "Item ini hanya dicek 1x seminggu"
    //
    // Untuk backward compat, field lama tetap ada.

    console.log(
      `✅ [FA get-checklist-items] type=${type} dateDay=${targetDateDay} ` +
      `total=${allItems.length} items`
    );

    return NextResponse.json({
      success:    true,
      data:       allItems,
      type,
      categoryCode,
      dateDay:    targetDateDay,  // hari dalam bulan yang digunakan untuk filter
    });

  } catch (error) {
    console.error('❌ Error fetching checklist items:', error);
    return NextResponse.json({
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}