// app/api/pre-assy/save-conveyor/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conveyor, areaCode, userId, categoryCode } = body;

    // 1. Validasi input wajib
    if (!conveyor || !areaCode) {
      return NextResponse.json(
        { error: 'Conveyor dan Area wajib diisi.' },
        { status: 400 }
      );
    }

    const conveyorVal    = String(conveyor).trim().toUpperCase();
    const categoryCodeVal = categoryCode ? String(categoryCode).trim() : 'pre-assy-daily-check-ins';
    const userIdVal      = userId || 'system';

    // Validasi panjang conveyor
    if (conveyorVal.length === 0) {
      return NextResponse.json(
        { error: 'Nama conveyor tidak boleh kosong.' },
        { status: 400 }
      );
    }

    console.log(`📥 [Save Conveyor] conveyor="${conveyorVal}" category="${categoryCodeVal}" user="${userIdVal}"`);

    // =========================================================
    // 2. Cek duplikasi — HANYA cek kolom `conveyor`
    //
    // ✅ FIX: Kolom `carline` dan `line` sudah DIHAPUS dari tabel
    // carline_line_mapping (sesuai struktur DB terbaru).
    // Query lama: WHERE (carline = $1 OR COALESCE(conveyor, carline) = $1)
    // → Error: "column carline does not exist"
    //
    // Query baru: hanya cek kolom `conveyor` yang memang ada.
    // Unique constraint sudah ada: (user_id, conveyor, category_code)
    // sehingga per-user, conveyor yang sama di category yang sama tidak duplikat.
    // =========================================================
    const existing = await pool.query(
      `SELECT 1 FROM carline_line_mapping
       WHERE conveyor = $1
         AND category_code = $2
         AND user_id = $3
         AND is_active = TRUE
       LIMIT 1`,
      [conveyorVal, categoryCodeVal, userIdVal]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`ℹ️ [Save Conveyor] Sudah ada: "${conveyorVal}" untuk user="${userIdVal}"`);
      return NextResponse.json(
        { error: `Conveyor "${conveyorVal}" sudah terdaftar di sistem.` },
        { status: 409 }
      );
    }

    // =========================================================
    // 3. INSERT ke tabel carline_line_mapping
    //
    // ✅ FIX: Hapus kolom `carline` dan `line` dari INSERT karena
    // sudah tidak ada di skema tabel (sudah di-drop via migrasi).
    //
    // Kolom yang ada: id, user_id, category_code, is_active,
    //                 created_at, updated_at, conveyor
    //
    // Query lama (BERMASALAH):
    //   INSERT INTO carline_line_mapping
    //     (user_id, carline, line, category_code, conveyor, ...)
    //   → PostgreSQL error: "column 'carline' of relation does not exist"
    //
    // Query baru (BENAR):
    //   INSERT INTO carline_line_mapping
    //     (user_id, category_code, conveyor, is_active, created_at, updated_at)
    // =========================================================
    await pool.query(
      `INSERT INTO carline_line_mapping
         (user_id, category_code, conveyor, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
      [userIdVal, categoryCodeVal, conveyorVal]
    );

    console.log(`✅ [Save Conveyor] Berhasil disimpan: "${conveyorVal}" | category="${categoryCodeVal}" | user="${userIdVal}"`);

    return NextResponse.json({
      success: true,
      conveyor: conveyorVal,
      message: 'Conveyor berhasil ditambahkan.',
    });

  } catch (error: any) {
    console.error('❌ [Save Conveyor] Error:', error.message, '| code:', error.code);

    // Handle unique constraint violation (PostgreSQL code 23505)
    // Unique index: carline_line_mapping_user_id_conveyor_category_code_key
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Conveyor sudah terdaftar.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Gagal menyimpan conveyor.',
        detail: error.message,
        code: error.code || null,
      },
      { status: 500 }
    );
  }
}

// Handler untuk CORS preflight
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