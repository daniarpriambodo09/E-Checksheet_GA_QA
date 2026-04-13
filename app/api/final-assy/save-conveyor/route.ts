// app/api/final-assy/save-conveyor/route.ts
// API baru untuk menyimpan Conveyor di final-assy inspector.
// Konsisten dengan /api/pre-assy/save-conveyor namun untuk category final-assy-inspector.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conveyor, areaCode, userId, categoryCode } = body;

    // 1. Validasi
    if (!conveyor || !areaCode) {
      return NextResponse.json(
        { error: 'Conveyor dan Area wajib diisi.' },
        { status: 400 }
      );
    }

    const conveyorVal     = String(conveyor).trim().toUpperCase();
    const categoryCodeVal = categoryCode
      ? String(categoryCode).trim()
      : 'final-assy-inspector';
    const userIdVal       = userId || 'system';

    if (conveyorVal.length === 0) {
      return NextResponse.json(
        { error: 'Nama conveyor tidak boleh kosong.' },
        { status: 400 }
      );
    }

    console.log(
      `📥 [FA Save Conveyor] conveyor="${conveyorVal}" ` +
      `category="${categoryCodeVal}" user="${userIdVal}"`
    );

    // 2. Cek duplikasi — hanya cek kolom `conveyor` (kolom carline/line sudah dihapus)
    const existing = await pool.query(
      `SELECT 1 FROM carline_line_mapping
       WHERE conveyor       = $1
         AND category_code  = $2
         AND user_id        = $3
         AND is_active      = TRUE
       LIMIT 1`,
      [conveyorVal, categoryCodeVal, userIdVal]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(
        `ℹ️ [FA Save Conveyor] Sudah ada: "${conveyorVal}" ` +
        `user="${userIdVal}" category="${categoryCodeVal}"`
      );
      return NextResponse.json(
        { error: `Conveyor "${conveyorVal}" sudah terdaftar.` },
        { status: 409 }
      );
    }

    // 3. INSERT — hanya kolom yang ada di skema tabel saat ini:
    //    id, user_id, category_code, is_active, created_at, updated_at, conveyor
    //    (kolom carline dan line sudah di-DROP via migrasi)
    await pool.query(
      `INSERT INTO carline_line_mapping
         (user_id, category_code, conveyor, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
      [userIdVal, categoryCodeVal, conveyorVal]
    );

    console.log(
      `✅ [FA Save Conveyor] Berhasil: "${conveyorVal}" ` +
      `category="${categoryCodeVal}"`
    );

    return NextResponse.json({
      success:  true,
      conveyor: conveyorVal,
      message:  'Conveyor berhasil ditambahkan.',
    });

  } catch (error: any) {
    console.error('❌ [FA Save Conveyor] Error:', error.message, '| code:', error.code);

    // Unique constraint: carline_line_mapping_user_id_conveyor_category_code_key
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Conveyor sudah terdaftar.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:  'Gagal menyimpan conveyor.',
        detail: error.message,
        code:   error.code || null,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}