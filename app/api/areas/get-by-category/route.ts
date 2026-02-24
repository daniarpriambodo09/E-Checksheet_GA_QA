// File: app/api/areas/get-by-category/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('categoryCode');
    
    if (!categoryCode) {
      return NextResponse.json({ error: 'Missing categoryCode parameter' }, { status: 400 });
    }
    
    const result = await pool.query(
      `SELECT id, area_name, area_code, description, sort_order
       FROM checklist_areas
       WHERE category_id = (SELECT id FROM checklist_categories WHERE category_code = $1)
       AND is_active = TRUE
       ORDER BY sort_order, area_name`,
      [categoryCode]
    );
    
    return NextResponse.json({
      success: true,
      areas: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching areas:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

