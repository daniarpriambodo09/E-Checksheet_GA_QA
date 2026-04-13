// app/api/pre-assy/check-duplicate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, categoryCode, gaugeId, dateKey, shift, areaCode, carline, line, specificArea } = body;

    if (!userId || !categoryCode || !dateKey || !shift) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Hanya berlaku untuk daily-check-ins
    if (categoryCode !== 'pre-assy-daily-check-ins') {
      return NextResponse.json({ isDuplicate: false });
    }

    // Jika tidak ada gaugeId → skip
    if (!gaugeId || !gaugeId.trim()) {
      return NextResponse.json({ isDuplicate: false });
    }

    const gaugeIdVal = gaugeId.trim();

    // Get category_id
    const catRes = await pool.query(
      `SELECT id FROM checklist_categories WHERE category_code = $1`,
      [categoryCode]
    );
    if ((catRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = catRes.rows[0].id;

    // Resolve area_id untuk lokasi saat ini
    let currentAreaId: number | null = null;
    if (areaCode) {
      const areaRes = await pool.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE LIMIT 1`,
        [areaCode, categoryId]
      );
      if ((areaRes.rowCount ?? 0) > 0) currentAreaId = areaRes.rows[0].id;
    }

    const carlineVal      = carline?.trim()     || null;
    const lineVal         = line?.trim()         || null;
    const specificAreaVal = (typeof specificArea === 'string' && specificArea.trim())
      ? specificArea.trim() : null;

    // ================================================================
    // ATURAN A: CEK GLOBAL — gauge sudah ada di lokasi BERBEDA hari ini
    //
    // Cek tanpa filter shift (lintas shift) dan lintas user.
    // "Lokasi berbeda" = (area_id, carline, line, specific_area) berbeda
    // dari kombinasi yang sedang dicoba.
    //
    // Shift B di lokasi SAMA tetap diizinkan (lolos karena NOT clause
    // akan false jika lokasi sama persis).
    // ================================================================
    const globalDupRes = await pool.query(
      `SELECT
         r.id,
         r.shift,
         r.carline,
         r.line,
         r.specific_area,
         ca.area_name,
         ca.area_code,
         ci.item_check
       FROM checklist_results r
       LEFT JOIN checklist_areas ca ON r.area_id = ca.id
       LEFT JOIN checklist_items  ci ON r.item_id = ci.id
       WHERE r.category_id = $1
         AND r.time_slot   = $2
         AND r.date_key    = $3
         AND NOT (
           COALESCE(r.area_id,           -1) = COALESCE($4, -1)
           AND COALESCE(r.carline,       '') = COALESCE($5, '')
           AND COALESCE(r.line,          '') = COALESCE($6, '')
           AND COALESCE(r.specific_area, '') = COALESCE($7, '')
         )
       ORDER BY r.shift, r.submitted_at DESC
       LIMIT 5`,
      [categoryId, gaugeIdVal, dateKey,
       currentAreaId, carlineVal, lineVal, specificAreaVal]
    );

    if ((globalDupRes.rowCount ?? 0) > 0) {
      const duplicates = globalDupRes.rows.map((row: any) => {
        const parts: string[] = [];
        if (row.area_name)           parts.push(row.area_name);
        if (row.specific_area)       parts.push(row.specific_area);
        if (row.carline && row.line) parts.push(`${row.carline} - ${row.line}`);
        return {
          description:  parts.join(' / '),
          areaName:     row.area_name     || null,
          specificArea: row.specific_area || null,
          carline:      row.carline       || null,
          line:         row.line          || null,
          shift:        row.shift         || null,
          itemCheck:    row.item_check    || null,
          ruleType:     'GLOBAL',
        };
      });

      console.warn(
        `⚠️ [Global Dup] gauge=${gaugeIdVal} date=${dateKey}`,
        `current=(area=${currentAreaId} carline=${carlineVal} line=${lineVal} spec=${specificAreaVal})`,
        `found=${globalDupRes.rowCount} conflict rows`
      );

      return NextResponse.json({
        isDuplicate: true,
        ruleType:    'GLOBAL',
        message:     'Gauge ini sudah pernah di-check di lokasi lain hari ini.',
        duplicates,
      });
    }

    // Lolos semua pengecekan
    return NextResponse.json({ isDuplicate: false });

  } catch (err: any) {
    console.error('❌ [Pre-Assy Check Duplicate] Error:', err.message);
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
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