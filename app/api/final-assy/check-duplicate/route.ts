// app/api/final-assy/check-duplicate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      categoryCode,
      gaugeId,      // ✅ KUNCI UTAMA: gauge_id dari QR code scan
      dateKey,
      shift,
      areaCode,
      carline,
      line,
      specificArea,
    } = body;

    if (!userId || !categoryCode || !dateKey || !shift) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Jika tidak ada gaugeId → tidak bisa cek duplikat per gauge → tidak ada duplikat
    if (!gaugeId || !gaugeId.trim()) {
      return NextResponse.json({ isDuplicate: false });
    }

    const gaugeIdVal = gaugeId.trim();

    // 1. Get category_id
    const catRes = await pool.query(
      `SELECT id FROM checklist_categories WHERE category_code = $1`,
      [categoryCode]
    );
    if (catRes.rowCount === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = catRes.rows[0].id;

    // 2. Resolve area_id dari areaCode yang dikirim sekarang
    let currentAreaId: number | null = null;
    if (areaCode) {
      let areaRes = await pool.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE LIMIT 1`,
        [areaCode, categoryId]
      );
      if ((areaRes.rowCount ?? 0) === 0) {
        areaRes = await pool.query(
          `SELECT id FROM checklist_areas WHERE area_code = $1 AND is_active = TRUE LIMIT 1`,
          [areaCode]
        );
      }
      if ((areaRes.rowCount ?? 0) > 0) currentAreaId = areaRes.rows[0].id;
    }

    // 3. Normalize nilai
    const carlineVal     = carline?.trim()     || null;
    const lineVal        = line?.trim()        || null;
    const specificAreaVal = (typeof specificArea === 'string' && specificArea.trim())
      ? specificArea.trim() : null;

    // 4. Cek apakah gauge_id ini sudah di-checklist di tanggal + shift yang sama
    //    tapi dengan kombinasi area/carline/line/specificArea yang BERBEDA.
    //
    //    gauge_id disimpan di kolom time_slot.
    //    Cari row dengan time_slot = gaugeId DAN kombinasi lokasi berbeda.
    const dupRes = await pool.query(
      `SELECT
         r.id,
         r.status,
         r.carline,
         r.line,
         r.specific_area,
         r.time_slot AS gauge_id,
         ca.area_name,
         ca.area_code,
         ci.item_check
       FROM checklist_results r
       LEFT JOIN checklist_areas ca ON r.area_id = ca.id
       LEFT JOIN checklist_items ci ON r.item_id = ci.id
       WHERE r.user_id     = $1
         AND r.category_id = $2
         AND r.time_slot   = $3
         AND r.date_key    = $4
         AND r.shift       = $5
         AND NOT (
           COALESCE(r.area_id,           -1) = COALESCE($6,  -1)
           AND COALESCE(r.carline,       '') = COALESCE($7,  '')
           AND COALESCE(r.line,          '') = COALESCE($8,  '')
           AND COALESCE(r.specific_area, '') = COALESCE($9,  '')
         )
       LIMIT 5`,
      [userId, categoryId, gaugeIdVal, dateKey, shift,
       currentAreaId, carlineVal, lineVal, specificAreaVal]
    );

    if ((dupRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ isDuplicate: false });
    }

    // Ada duplikat — kumpulkan info lokasi yang sudah check gauge ini
    const duplicates = dupRes.rows.map((row: any) => {
      const parts: string[] = [];
      if (row.area_name)  parts.push(row.area_name);
      if (row.carline && row.line) parts.push(`${row.carline} - ${row.line}`);
      else if (row.carline) parts.push(`Carline ${row.carline}`);
      if (row.specific_area) parts.push(row.specific_area);
      return {
        description:  parts.join(' / '),
        areaName:     row.area_name     || null,
        carline:      row.carline       || null,
        line:         row.line          || null,
        specificArea: row.specific_area || null,
        itemCheck:    row.item_check    || null,
        gaugeId:      row.gauge_id      || null,
      };
    });

    return NextResponse.json({
      isDuplicate: true,
      duplicates,
    });

  } catch (err: any) {
    console.error('❌ [Check Duplicate] Error:', err.message);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}