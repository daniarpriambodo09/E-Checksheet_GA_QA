// app/api/admin/areas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const categoryCode = searchParams.get('categoryCode');
    const areaType = searchParams.get('areaType');

    let query = `
      SELECT 
        ca.id, ca.category_id, ca.area_name, ca.area_code, 
        ca.description, ca.is_active, ca.sort_order, ca.created_at,
        cc.category_code, cc.category_name, cc.table_type, cc.area_type
      FROM checklist_areas ca
      JOIN checklist_categories cc ON ca.category_id = cc.id
      WHERE ca.is_active = TRUE
    `;
    const params: any[] = [];

    if (categoryId) {
      params.push(categoryId);
      query += ` AND ca.category_id = $${params.length}`;
    }

    if (categoryCode) {
      params.push(categoryCode);
      query += ` AND cc.category_code = $${params.length}`;
    }

    if (areaType) {
      params.push(areaType);
      query += ` AND cc.area_type = $${params.length}`;
    }

    query += ` ORDER BY ca.sort_order ASC`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });

  } catch (error: any) {
    console.error('❌ Get areas error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch areas', detail: error.message },
      { status: 500 }
    );
  }
}