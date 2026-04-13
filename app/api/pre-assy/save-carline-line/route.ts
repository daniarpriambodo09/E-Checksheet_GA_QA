// app/api/pre-assy/save-carline-line/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Save Carline & Line untuk Pre-Assy CC & Stripping.
 * Data disimpan ke tabel checklist_carline_lines (shared table),
 * atau jika tabel tersebut tidak ada, cukup return success karena
 * carline-line di-derive dari checklist_results yang sudah ada.
 *
 * NOTE: Tidak seperti final-assy yang mungkin punya tabel terpisah,
 * di pre-assy carline+line tersimpan langsung di kolom checklist_results.
 * API ini hanya digunakan untuk pre-register / validasi saja.
 * Actual save terjadi saat handleSubmit → /api/pre-assy/save-result.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carline, line, areaCode, userId, categoryCode } = body;

    if (!carline || !line) {
      return NextResponse.json({ error: 'carline and line are required' }, { status: 400 });
    }

    // Validasi format (hanya alfanumerik dan strip)
    const carlineTrimmed = String(carline).trim().toUpperCase();
    const lineTrimmed    = String(line).trim().toUpperCase();

    if (!carlineTrimmed || !lineTrimmed) {
      return NextResponse.json({ error: 'carline and line cannot be empty' }, { status: 400 });
    }

    // Cari area_id dari areaCode (jika dikirim)
    let areaId: number | null = null;
    if (areaCode) {
      // Cari category_id dulu jika categoryCode dikirim
      let categoryId: number | null = null;
      if (categoryCode) {
        const catRes = await pool.query(
          `SELECT id FROM checklist_categories WHERE category_code = $1`,
          [categoryCode]
        );
        if (catRes.rows.length > 0) categoryId = catRes.rows[0].id;
      }

      // Cari area
      if (categoryId) {
        const areaRes = await pool.query(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE
           LIMIT 1`,
          [areaCode, categoryId]
        );
        if (areaRes.rows.length > 0) areaId = areaRes.rows[0].id;
      }

      // Fallback tanpa category filter
      if (!areaId) {
        const areaRes = await pool.query(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND is_active = TRUE
           ORDER BY id ASC LIMIT 1`,
          [areaCode]
        );
        if (areaRes.rows.length > 0) areaId = areaRes.rows[0].id;
      }
    }

    console.log(`✅ [Pre-Assy save-carline-line] carline=${carlineTrimmed} line=${lineTrimmed} areaId=${areaId}`);

    // Cek apakah tabel checklist_carline_lines ada (opsional)
    // Jika tidak ada, tidak apa-apa — carline-line akan tersimpan saat save-result
    try {
      const tableCheck = await pool.query(
        `SELECT to_regclass('public.checklist_carline_lines') AS tbl`
      );
      if (tableCheck.rows[0]?.tbl) {
        // Tabel ada, simpan ke sana
        await pool.query(
          `INSERT INTO checklist_carline_lines (carline, line, area_id, created_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [carlineTrimmed, lineTrimmed, areaId, userId]
        );
      }
    } catch {
      // Tabel tidak ada, diabaikan — carline akan tersimpan via save-result
    }

    return NextResponse.json({
      success: true,
      carline: carlineTrimmed,
      line: lineTrimmed,
      areaId,
    });
  } catch (error) {
    console.error('❌ [Pre-Assy save-carline-line] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}