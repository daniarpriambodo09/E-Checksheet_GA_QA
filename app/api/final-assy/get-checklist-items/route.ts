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
    const type = searchParams.get('type'); // "inspector" atau "group-leader"

    if (!type) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    // ✅ Cari category_id berdasarkan type - SUPPORT KEDUA TYPE
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
    } else if (type === 'group-leader') {  // ✅ TAMBAHKAN INI
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

    // ✅ Ambil data dari database dengan category_id yang sesuai
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

    // ✅ Transformasi: Kelompokkan berdasarkan (no, item_check, check_point, metode_check)
    const groupedItems: Record<string, any> = {};
    
    items.forEach((row) => {
      // Key unik berdasarkan kombinasi item
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
          showIn: {
            wpCheck: row.show_in_wp_check,
            checker: row.show_in_checker,
            visual1: row.show_in_visual_1,
            visual2: row.show_in_visual_2,
            doubleCheck: row.show_in_double_check
          }
        };
      }
      
      // Tambahkan shift (A/B) ke dalam array jika belum ada
      if (!groupedItems[key].shifts.some((s: any) => s.shift === row.shift)) {
        groupedItems[key].shifts.push({ shift: row.shift });
      }
    });

    console.log(`✅ Loaded ${Object.values(groupedItems).length} checklist items for type: ${type}`);

    return NextResponse.json({ 
      success: true, 
      data: Object.values(groupedItems),
      type,
      categoryId
    });
    
  } catch (error) {
    console.error('❌ Error fetching checklist items:', error);
    return NextResponse.json({ 
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}