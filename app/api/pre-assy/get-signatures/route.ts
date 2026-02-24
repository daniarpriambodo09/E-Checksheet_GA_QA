// app/api/pre-assy/get-signatures/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month = searchParams.get('month');
    const areaCode = searchParams.get('areaCode'); // ← TAMBAHAN: Filter area

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validasi user
    const userCheckResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );
    if (userCheckResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    // Ambil category_id
    const categoryResult = await pool.query(
      'SELECT id FROM checklist_categories WHERE category_code = $1',
      [categoryCode]
    );
    if (categoryResult.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categoryResult.rows[0].id;

    // ✅ BUILD QUERY DENGAN FILTER AREA (OPTIONAL)
    let areaCondition = '';
    let areaParams: any[] = [];
    
    if (areaCode) {
      // Filter signature berdasarkan hasil checklist yang memiliki area_id terkait
      areaCondition = `
        AND EXISTS (
          SELECT 1 FROM checklist_results cr
          INNER JOIN checklist_items ci ON cr.item_id = ci.id
          WHERE cr.user_id = s.user_id
            AND cr.category_id = s.category_id
            AND cr.date_key = s.date_key
            AND cr.shift = s.shift
            AND ci.area_id = (
              SELECT id FROM checklist_areas 
              WHERE area_code = $4 AND category_id = s.category_id
            )
        )
      `;
      areaParams = [areaCode];
    }

    // Ambil signatures dengan filter area opsional
    const signaturesQuery = await pool.query(
      `SELECT s.date_key, s.shift, s.signature_status
       FROM checklist_signatures s
       WHERE s.user_id = $1 
         AND s.category_id = $2 
         AND s.date_key LIKE $3
         ${areaCondition}
       ORDER BY s.date_key, s.shift`,
      [userId, categoryId, `${month}%`, ...areaParams]
    );

    // Format data
    const formatted: Record<string, Record<string, string>> = {};
    signaturesQuery.rows.forEach(row => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};
      formatted[row.date_key][row.shift] = row.signature_status;
    });

    return NextResponse.json({ 
      success: true, 
      formatted,
      areaCode: areaCode || null
    });
    
  } catch (error) {
    console.error('❌ Get signatures error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}