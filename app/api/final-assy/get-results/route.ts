// app/api/final-assy/get-results/route.ts
// Diupdate: terima query param `conveyor` (selain carline/line lama),
// filter berdasarkan kolom conveyor di checklist_results,
// dan sertakan field conveyor di response formatted.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId       = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month        = searchParams.get('month');
    const role         = searchParams.get('role');
    const areaCode     = searchParams.get('areaCode');
    const carline      = searchParams.get('carline');
    const line         = searchParams.get('line');
    const conveyor     = searchParams.get('conveyor'); // ← param baru
    const shift        = searchParams.get('shift');
    const specificArea = searchParams.get('specificArea');

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

    // 2. category_id
    const categories = await pool.query(
      `SELECT id FROM checklist_categories WHERE category_code = $1`,
      [categoryCode]
    );
    if (categories.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categories.rows[0].id;

    // 3. Resolve area_id
    let areaId: number | null = null;
    if (areaCode) {
      let areaResult = await pool.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE LIMIT 1`,
        [areaCode, categoryId]
      );
      if (areaResult.rows.length === 0) {
        areaResult = await pool.query(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND is_active = TRUE ORDER BY id ASC LIMIT 1`,
          [areaCode]
        );
      }
      if (areaResult.rows.length > 0) {
        areaId = areaResult.rows[0].id;
        console.log('✅ [FA Get Results] Area resolved:', { areaCode, areaId, categoryId });
      } else {
        console.warn('⚠️ [FA Get Results] Area not found:', areaCode);
        return NextResponse.json({
          success: true, formatted: {}, count: 0,
          warning: `Area not found: ${areaCode}`,
        });
      }
    }

    // 4. Resolve conveyor value untuk filter
    // Frontend baru mengirim `conveyor`; frontend lama mengirim `carline`.
    // Gunakan salah satunya sebagai filter karena carlineVal=conveyor di save.
    const conveyorFilter = conveyor?.trim() || carline?.trim() || null;

    // 5. Build query
    const selectCols = `
      r.date_key, r.item_id, r.shift, r.status,
      r.ng_description, r.ng_department, r.ng_photos,
      r.submitted_at, r.user_id, r.nik,
      r.specific_area, r.conveyor,
      u.full_name, r.area_id, r.carline, r.line,
      ci.item_no
    `;

    let query       = '';
    let queryParams: any[] = [];

    if (categoryCode === 'final-assy-inspector') {
      let whereConditions = ['r.category_id = $1', 'r.date_key LIKE $2'];
      queryParams = [categoryId, `${month}%`];
      let paramCount = 2;

      if (shift) {
        whereConditions.push(`r.shift = $${++paramCount}`);
        queryParams.push(shift);
      }
      if (areaId !== null) {
        whereConditions.push(`r.area_id = $${++paramCount}`);
        queryParams.push(areaId);
      }
      if (conveyorFilter) {
        // Filter: cocokkan kolom conveyor atau carline (backward compat)
        whereConditions.push(
          `(COALESCE(r.conveyor, r.carline, '') = $${++paramCount})`
        );
        queryParams.push(conveyorFilter);
      }
      if (specificArea) {
        whereConditions.push(`COALESCE(r.specific_area, '') = $${++paramCount}`);
        queryParams.push(specificArea);
      }

      query = `
        SELECT ${selectCols}
        FROM checklist_results r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN checklist_items ci ON r.item_id = ci.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY r.date_key, ci.item_no, r.item_id, r.shift
      `;
    } else {
      // GL mode — tidak berubah
      let whereConditions = [
        'r.user_id = $1', 'r.category_id = $2', 'r.date_key LIKE $3',
      ];
      queryParams = [userId, categoryId, `${month}%`];
      let paramCount = 3;

      if (shift) {
        whereConditions.push(`r.shift = $${++paramCount}`);
        queryParams.push(shift);
      }
      if (areaId !== null) {
        whereConditions.push(`r.area_id = $${++paramCount}`);
        queryParams.push(areaId);
      }
      if (conveyorFilter) {
        whereConditions.push(
          `(COALESCE(r.conveyor, r.carline, '') = $${++paramCount})`
        );
        queryParams.push(conveyorFilter);
      }

      query = `
        SELECT ${selectCols}
        FROM checklist_results r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN checklist_items ci ON r.item_id = ci.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY r.date_key, r.item_id, r.shift
      `;
    }

    const results = await pool.query(query, queryParams);
    console.log(
      `✅ [FA Get Results] Found ${results.rows.length} rows | ` +
      `category=${categoryCode} area_id=${areaId} ` +
      `conveyor=${conveyorFilter ?? 'ALL'} specificArea=${specificArea ?? 'ALL'}`
    );

    // 6. Format response
    const formatted: Record<string, Record<string, any>> = {};

    if (categoryCode === 'final-assy-inspector') {
      results.rows.forEach((row: any) => {
        const itemNo      = row.item_no ?? String(row.item_id);
        const rowSpecArea = row.specific_area || 'WP CHECK';

        if (!formatted[row.date_key]) formatted[row.date_key] = {};

        const key = `${itemNo}-${rowSpecArea}-${row.shift}`;
        formatted[row.date_key][key] = {
          status:        row.status,
          ngCount:       row.status === 'NG' ? 1 : 0,
          items:         [],
          notes:         '',
          submittedAt:   row.submitted_at,
          submittedBy:   row.full_name || row.user_id || 'System',
          ngDescription: row.ng_description || '',
          ngDepartment:  row.ng_department  || 'QA',
          ngPhotos:      row.ng_photos      || null,
          areaId:        row.area_id,
          // Sertakan keduanya untuk compat
          conveyor:      row.conveyor || row.carline || null,
          carline:       row.carline  || null,
          line:          row.line     || null,
          specificArea:  row.specific_area || null,
        };
      });
    } else {
      results.rows.forEach((row: any) => {
        if (!formatted[row.date_key]) formatted[row.date_key] = {};
        const itemKey = `${row.item_id}-${row.shift}`;
        formatted[row.date_key][itemKey] = {
          status:        row.status,
          ngCount:       row.status === 'NG' ? 1 : 0,
          items:         [],
          notes:         '',
          submittedAt:   row.submitted_at,
          submittedBy:   row.full_name || row.user_id || 'System',
          ngDescription: row.ng_description || '',
          ngDepartment:  row.ng_department  || 'QA',
          ngPhotos:      row.ng_photos      || null,
          areaId:        row.area_id,
          conveyor:      row.conveyor || row.carline || null,
          carline:       row.carline  || null,
          line:          row.line     || null,
        };
      });
    }

    return NextResponse.json({
      success:      true,
      formatted,
      count:        results.rows.length,
      role,
      categoryCode,
      areaCode:     areaCode || null,
      areaId,
      conveyor:     conveyorFilter || null,
    });

  } catch (error) {
    console.error('❌ [FA Get Results] Error:', error);
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
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}