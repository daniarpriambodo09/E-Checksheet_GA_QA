// app/api/areas/get-all/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT 
        a.id,
        a.area_code,
        a.area_name,
        a.category_id,
        a.description,
        a.sort_order,
        a.is_active,
        c.category_code,
        c.category_name
      FROM checklist_areas a
      LEFT JOIN checklist_categories c ON a.category_id = c.id
      WHERE a.is_active = TRUE
      ORDER BY c.category_code, a.sort_order, a.area_name`
    );

    return NextResponse.json({
      success: true,
      areas: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching areas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch areas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}