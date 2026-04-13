// app/api/final-assy/get-checklist-items/route.ts
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
  show_in_wp_check: boolean;
  show_in_checker: boolean;
  show_in_visual_1: boolean;
  show_in_visual_2: boolean;
  show_in_double_check: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    let categoryId: number;

    if (type === 'inspector') {
      const categories = await executeQuery<{ id: number }>(
        'SELECT id FROM checklist_categories WHERE category_code = $1',
        ['final-assy-inspector']
      );
      if (categories.length === 0) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      categoryId = categories[0].id;
    } else if (type === 'group-leader') {
      const categories = await executeQuery<{ id: number }>(
        'SELECT id FROM checklist_categories WHERE category_code = $1',
        ['final-assy-gl']
      );
      if (categories.length === 0) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      categoryId = categories[0].id;
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const items = await executeQuery<ChecklistItem>(
      `SELECT
         id,
         item_no as no,
         item_check,
         check_point,
         metode_check,
         area,
         shift,
         show_in_wp_check,
         show_in_checker,
         show_in_visual_1,
         show_in_visual_2,
         show_in_double_check
       FROM checklist_items
       WHERE category_id = $1 AND is_active = TRUE
       ORDER BY sort_order, id`,
      [categoryId]
    );

    // ✅ FIX: Kelompokkan per (no, item_check, check_point, metode_check)
    // dan simpan shiftIdMap = { "A": db_id_shift_a, "B": db_id_shift_b }
    // Catatan: untuk final-assy-inspector, semua item di DB hanya shift A.
    // shiftIdMap["B"] akan fallback ke id shift A sehingga lookup di status page
    // tetap menemukan data yang tersimpan (karena save-result juga pakai id shift A).
    const groupedItems: Record<string, any> = {};

    items.forEach((row) => {
      const key = `${row.no}-${row.item_check}-${row.check_point}-${row.metode_check}`;

      if (!groupedItems[key]) {
        groupedItems[key] = {
          id: row.id,
          no: row.no,
          itemCheck: row.item_check,
          checkPoint: row.check_point,
          metodeCheck: row.metode_check,
          area: row.area,
          shifts: [],
          shiftIdMap: {} as Record<string, number>,
          showIn: {
            wpCheck: row.show_in_wp_check,
            checker: row.show_in_checker,
            visual1: row.show_in_visual_1,
            visual2: row.show_in_visual_2,
            doubleCheck: row.show_in_double_check,
          },
        };
      }

      if (!groupedItems[key].shifts.some((s: any) => s.shift === row.shift)) {
        groupedItems[key].shifts.push({ shift: row.shift });
      }

      // Simpan id real DB per shift
      groupedItems[key].shiftIdMap[row.shift] = row.id;
    });

    // ✅ FIX KRITIS: Untuk inspector, DB hanya punya shift A.
    // Tambahkan shift B ke shifts array dan shiftIdMap["B"] = id shift A
    // agar status page bisa menampilkan data untuk kedua shift.
    if (type === 'inspector') {
      Object.values(groupedItems).forEach((item: any) => {
        const hasShiftB = item.shifts.some((s: any) => s.shift === 'B');
        if (!hasShiftB) {
          item.shifts.push({ shift: 'B' });
          // Shift B pakai id yang sama dengan shift A
          // karena DB inspector hanya punya 1 item_id per checkpoint
          item.shiftIdMap['B'] = item.shiftIdMap['A'] ?? item.id;
        }
      });
    }

    console.log(`✅ Loaded ${Object.values(groupedItems).length} checklist items for type: ${type}`);

    return NextResponse.json({
      success: true,
      data: Object.values(groupedItems),
      type,
      categoryId,
    });

  } catch (error) {
    console.error('❌ Error fetching checklist items:', error);
    return NextResponse.json({
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}