// app/api/dashboard/get-categories/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // ✅ GUNAKAN pool.query() bukan pool.execute()
    const categoriesResult = await pool.query(`
      SELECT 
        category_name, 
        category_code, 
        table_type, 
        area_type 
      FROM checklist_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order, category_name
    `);

    // Format untuk dropdown
    const categoryList = categoriesResult.rows.map((cat: any) => ({
      label: cat.category_name,
      value: cat.category_code,
      type: cat.table_type,
      area: cat.area_type
    }));

    return NextResponse.json({
      success: true,
      categories: [
        { label: 'All Category', value: 'All Category', type: 'all', area: 'all' },
        ...categoryList
      ]
    });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}