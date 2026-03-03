// app/api/admin/categories/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaType = searchParams.get('areaType'); // e.g. "final-assy"
    const tableType = searchParams.get('tableType'); // e.g. "inspector"

    let query = `
      SELECT id, category_name, category_code, table_type, area_type, is_active, sort_order
      FROM checklist_categories
      WHERE is_active = TRUE
    `;
    const params: any[] = [];

    if (areaType) {
      params.push(areaType);
      query += ` AND area_type = $${params.length}`;
    }

    if (tableType) {
      params.push(tableType);
      query += ` AND table_type = $${params.length}`;
    }

    query += ` ORDER BY sort_order ASC`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });

  } catch (error: any) {
    console.error('❌ Get categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', detail: error.message },
      { status: 500 }
    );
  }
}