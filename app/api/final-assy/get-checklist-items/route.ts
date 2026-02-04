import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // "inspector" atau "group-leader"

    if (!type) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    // Cari category_id berdasarkan type
    let categoryId;
    if (type === 'inspector') {
      const [catRes] = await pool.execute(
        'SELECT id FROM checklist_categories WHERE category_code = ?',
        ['final-assy-inspector']
      );
      if ((catRes as any[]).length === 0) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      categoryId = (catRes as any[])[0].id;
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Ambil data dari database
    const [items] = await pool.execute(
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
       WHERE category_id = ? AND is_active = TRUE
       ORDER BY sort_order`,
      [categoryId]
    );

    // Transformasi: Kelompokkan berdasarkan (no, item_check, check_point, metode_check)
    const groupedItems: Record<string, any> = {};
    
    (items as any[]).forEach((row) => {
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
      
      // Tambahkan shift (A/B) ke dalam array
      if (!groupedItems[key].shifts.some((s: any) => s.shift === row.shift)) {
        groupedItems[key].shifts.push({ shift: row.shift });
      }
    });

    return NextResponse.json({ success: true, data: Object.values(groupedItems) });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}