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
    const areaCode = searchParams.get('areaCode');
    const carline = searchParams.get('carline');
    const line = searchParams.get('line');

    if (!userId || !categoryCode || !month) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, categoryCode, month' },
        { status: 400 }
      );
    }

    // 1. Validasi user
    const users = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND is_active = TRUE`,
      [userId]
    );
    if (users.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    // 2. Ambil category_id — untuk filter checklist_results
    const categories = await pool.query(
      `SELECT id FROM checklist_categories WHERE category_code = $1`,
      [categoryCode]
    );
    if (categories.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categories.rows[0].id;

    // 3. Resolve area_id
    // GL dan Inspector punya area terpisah di DB dengan area_code berbeda:
    //   GL:        "final-assy-gl-genba-a-mazda"       → area_id=1
    //   Inspector: "final-assy-insp-genba-a-mazda"     → area_id=5
    // Cari area berdasarkan area_code + category_id agar dapat area yang tepat.
    // Fallback: jika tidak ketemu dengan category filter, cari tanpa filter (backward compat).
    let areaId: number | null = null;
    if (areaCode) {
      // Coba dulu dengan category_id (paling tepat)
      let areaResult = await pool.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [areaCode, categoryId]
      );

      // Fallback: cari tanpa category filter (untuk backward compatibility)
      if (areaResult.rows.length === 0) {
        areaResult = await pool.query(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND is_active = TRUE
           ORDER BY id ASC
           LIMIT 1`,
          [areaCode]
        );
      }

      if (areaResult.rows.length > 0) {
        areaId = areaResult.rows[0].id;
        console.log('✅ [Get Results] Area resolved:', { areaCode, areaId, categoryId });
      } else {
        console.warn('⚠️ [Get Results] Area not found:', areaCode);
        return NextResponse.json({
          success: true,
          formatted: {},
          count: 0,
          warning: `Area not found: ${areaCode}`
        });
      }
    }

    // 4. Build query
    // Filter ketat: area_id = $n (exact match, tanpa OR area_id IS NULL)
    const selectCols = `
      r.date_key, r.item_id, r.shift, r.status,
      r.ng_description, r.ng_department,
      r.submitted_at, r.user_id, r.nik,
      u.full_name, r.area_id, r.carline, r.line
    `;

    let query = '';
    let queryParams: any[] = [];

    // Logika query berdasarkan categoryCode dan role:
    //
    // CASE 1: categoryCode=final-assy-inspector (siapapun role-nya)
    //   → Tampilkan SEMUA data inspector di area tersebut (semua user_id)
    //   → Alasan: GL bisa mengisi checklist inspector atas nama area,
    //     sehingga inspector yang login harus bisa melihat data yang diisi GL
    //
    // CASE 2: categoryCode=final-assy-gl
    //   → Tampilkan data GL milik user yang login saja (user_id = userId)
    //   → Alasan: GL checklist bersifat personal per GL
    //
    if (categoryCode === 'final-assy-inspector') {
      // Semua user bisa melihat data inspector di area ini (GL maupun Inspector)
      let whereConditions = [
        'r.category_id = $1',
        'r.date_key LIKE $2'
      ];
      queryParams = [categoryId, `${month}%`];
      let paramCount = 2;

      if (areaId !== null) {
        whereConditions.push(`r.area_id = $${++paramCount}`);
        queryParams.push(areaId);
      }

      if (carline) {
        whereConditions.push(`r.carline = $${++paramCount}`);
        queryParams.push(carline);
      }

      if (line) {
        whereConditions.push(`r.line = $${++paramCount}`);
        queryParams.push(line);
      }

      query = `
        SELECT ${selectCols}
        FROM checklist_results r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY r.date_key, r.item_id, r.shift
      `;
    } else {
      // GL melihat data GL miliknya sendiri (user_id filter)
      let whereConditions = [
        'r.user_id = $1',
        'r.category_id = $2',
        'r.date_key LIKE $3'
      ];
      queryParams = [userId, categoryId, `${month}%`];
      let paramCount = 3;

      if (areaId !== null) {
        whereConditions.push(`r.area_id = $${++paramCount}`);
        queryParams.push(areaId);
      }

      if (carline) {
        whereConditions.push(`r.carline = $${++paramCount}`);
        queryParams.push(carline);
      }

      if (line) {
        whereConditions.push(`r.line = $${++paramCount}`);
        queryParams.push(line);
      }

      query = `
        SELECT ${selectCols}
        FROM checklist_results r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY r.date_key, r.item_id, r.shift
      `;
    }

    const results = await pool.query(query, queryParams);
    console.log(`✅ [Get Results] Found ${results.rows.length} results | category=${categoryCode} area_id=${areaId} role=${role}`);

    // 5. Format response
    const formatted: Record<string, Record<string, any>> = {};
    results.rows.forEach((row: any) => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};
      const itemKey = `${row.item_id}-${row.shift}`;
      formatted[row.date_key][itemKey] = {
        status: row.status,
        ngCount: row.status === 'NG' ? 1 : 0,
        items: [],
        notes: '',
        submittedAt: row.submitted_at,
        submittedBy: row.full_name || row.user_id || 'System',
        ngDescription: row.ng_description || '',
        ngDepartment: row.ng_department || 'QA',
        areaId: row.area_id,
      };
    });

    return NextResponse.json({
      success: true,
      formatted,
      count: results.rows.length,
      role,
      categoryCode,
      areaCode: areaCode || null,
      areaId,
    });

  } catch (error) {
    console.error('❌ [Get Results] Error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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
