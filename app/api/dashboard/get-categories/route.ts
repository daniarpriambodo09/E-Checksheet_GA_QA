// app/api/dashboard/get-categories/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAreas = searchParams.get('includeAreas') === 'true';

    // ✅ Hapus description dari query
    const categoriesResult = await pool.query(`
      SELECT 
        id,
        category_name, 
        category_code, 
        table_type, 
        area_type,
        sort_order,
        is_active,
        created_at
      FROM checklist_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order, category_name
    `);

    let categories = categoriesResult.rows.map((cat: any) => ({
      id: cat.id,
      label: cat.category_name,
      value: cat.category_code,
      type: cat.table_type,
      area: cat.area_type,
      description: cat.description || '', // ✅ Fallback ke empty string
      sortOrder: cat.sort_order
    }));

    // ✅ Jika includeAreas=true, tambahkan daftar area untuk setiap kategori
    if (includeAreas) {
      for (const cat of categories) {
        const areasResult = await pool.query(`
          SELECT 
            id,
            area_name,
            area_code,
            description,
            sort_order,
            is_active
          FROM checklist_areas 
          WHERE category_id = $1 AND is_active = TRUE
          ORDER BY sort_order, area_name
        `, [cat.id]);

        cat.area = areasResult.rows.map((area: any) => ({
          id: area.id,
          label: area.area_name,
          value: area.area_code,
          description: area.description
        }));
      }
    }

    // ✅ Tambahkan opsi "All Category" di awal
    const categoryList = [
      { 
        label: 'All Category', 
        value: 'All Category', 
        type: 'all', 
        area: 'all',
        description: 'Semua kategori checklist'
      },
      ...categories
    ];

    return NextResponse.json({
      success: true,
      categories: categoryList,
      count: categories.length
    });
  } catch (error: any) {
    console.error('❌ Get categories error:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch categories',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    );
  }
}

// ✅ OPTIONS handler untuk CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}