// app/api/final-assy/get-results/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month = searchParams.get('month');
    const role = searchParams.get('role');
    const areaCode = searchParams.get('areaCode'); // ✅ Ambil areaCode

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validasi user
    const users = await pool.query(
      'SELECT id, username, full_name, nik, department, role FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );
    if (users.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    // Ambil category_id
    const categories = await pool.query(
      'SELECT id FROM checklist_categories WHERE category_code = $1',
      [categoryCode]
    );
    if (categories.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categories.rows[0].id;

    // ✅ BUILD QUERY DENGAN FILTER AREA
    let query = '';
    let queryParams: any[] = [];
    let areaId: number | null = null;

    // Resolve area_id dari areaCode
    if (areaCode) {
      const areaResult = await pool.query(
        `SELECT id FROM checklist_areas 
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE`,
        [areaCode, categoryId]
      );
      if (areaResult.rows.length > 0) {
        areaId = areaResult.rows[0].id;
      }
    }

    // Tentukan query berdasarkan role dan area
    if (categoryCode === 'final-assy-inspector') {
      if (role === 'group-leader-qa') {
        // Group-leader: lihat SEMUA data inspector
        if (areaId) {
          query = `
            SELECT r.date_key, r.item_id, r.shift, r.status, r.ng_description, 
                   r.ng_department, r.submitted_at, r.user_id, r.nik, u.full_name, r.area_id
            FROM checklist_results r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.category_id = $1 
              AND r.date_key LIKE $2
              AND COALESCE(r.area_id, -1) = $3  -- ✅ Filter by area_id
            ORDER BY r.date_key, r.item_id, r.shift
          `;
          queryParams = [categoryId, `${month}%`, areaId];
        } else {
          query = `
            SELECT r.date_key, r.item_id, r.shift, r.status, r.ng_description, 
                   r.ng_department, r.submitted_at, r.user_id, r.nik, u.full_name, r.area_id
            FROM checklist_results r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.category_id = $1 
              AND r.date_key LIKE $2
            ORDER BY r.date_key, r.item_id, r.shift
          `;
          queryParams = [categoryId, `${month}%`];
        }
      } else {
        // Inspector: hanya data sendiri
        if (areaId) {
          query = `
            SELECT r.date_key, r.item_id, r.shift, r.status, r.ng_description, 
                   r.ng_department, r.submitted_at, r.user_id, r.nik, u.full_name, r.area_id
            FROM checklist_results r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.user_id = $1 
              AND r.category_id = $2 
              AND r.date_key LIKE $3
              AND COALESCE(r.area_id, -1) = $4  -- ✅ Filter by area_id
            ORDER BY r.date_key, r.item_id, r.shift
          `;
          queryParams = [userId, categoryId, `${month}%`, areaId];
        } else {
          query = `
            SELECT r.date_key, r.item_id, r.shift, r.status, r.ng_description, 
                   r.ng_department, r.submitted_at, r.user_id, r.nik, u.full_name, r.area_id
            FROM checklist_results r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.user_id = $1 
              AND r.category_id = $2 
              AND r.date_key LIKE $3
            ORDER BY r.date_key, r.item_id, r.shift
          `;
          queryParams = [userId, categoryId, `${month}%`];
        }
      }
    } else {
      // Group Leader table
      if (areaId) {
        query = `
          SELECT r.date_key, r.item_id, r.shift, r.status, r.ng_description, 
                 r.ng_department, r.submitted_at, r.user_id, r.nik, u.full_name, r.area_id
          FROM checklist_results r
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.user_id = $1 
            AND r.category_id = $2 
            AND r.date_key LIKE $3
            AND COALESCE(r.area_id, -1) = $4  -- ✅ Filter by area_id
          ORDER BY r.date_key, r.item_id, r.shift
        `;
        queryParams = [userId, categoryId, `${month}%`, areaId];
      } else {
        query = `
          SELECT r.date_key, r.item_id, r.shift, r.status, r.ng_description, 
                 r.ng_department, r.submitted_at, r.user_id, r.nik, u.full_name, r.area_id
          FROM checklist_results r
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.user_id = $1 
            AND r.category_id = $2 
            AND r.date_key LIKE $3
          ORDER BY r.date_key, r.item_id, r.shift
        `;
        queryParams = [userId, categoryId, `${month}%`];
      }
    }

    // Eksekusi query
    const results = await pool.query(query, queryParams);

    // Format response
    const formatted: Record<string, Record<string, any>> = {};
    results.rows.forEach((row: any) => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};
      formatted[row.date_key][`${row.item_id}-${row.shift}`] = {
        status: row.status,
        ngCount: row.status === 'NG' ? 1 : 0,
        items: [],
        notes: '',
        submittedAt: row.submitted_at,
        submittedBy: row.full_name || row.user_id || 'System',
        ngDescription: row.ng_description || '',
        ngDepartment: row.ng_department || 'QA',
        areaId: row.area_id  // ✅ Include areaId di response
      };
    });

    return NextResponse.json({
      success: true,
      formatted,
      count: results.rows.length,
      role,
      categoryCode,
      areaId
    });

  } catch (error) {
    console.error('❌ Get results error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}