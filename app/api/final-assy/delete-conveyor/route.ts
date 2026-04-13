import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conveyor, categoryCode, userId, areaCode } = body;

    if (!conveyor || !categoryCode) {
      return NextResponse.json(
        { error: 'Conveyor dan categoryCode wajib diisi.' },
        { status: 400 }
      );
    }

    const conveyorVal = String(conveyor).trim().toUpperCase();
    const categoryCodeVal = String(categoryCode).trim();
    const userIdVal = userId || 'system';

    if (!conveyorVal) {
      return NextResponse.json(
        { error: 'Nama conveyor tidak boleh kosong.' },
        { status: 400 }
      );
    }

    console.log(`🔍 [FA Delete Conveyor] Searching for conveyor="${conveyorVal}" category="${categoryCodeVal}" user="${userIdVal}"`);

    let existing = await pool.query(
      `SELECT id FROM carline_line_mapping
       WHERE conveyor = $1
         AND category_code = $2
         AND user_id = $3
         AND is_active = TRUE
       LIMIT 1`,
      [conveyorVal, categoryCodeVal, userIdVal]
    );

    console.log(`📊 [FA Delete Conveyor] Exact match found: ${existing.rowCount} rows`);

    if (existing.rowCount === 0) {
      const alternateCategory = categoryCodeVal === 'final-assy-inspector'
        ? 'final-assy-gl'
        : 'final-assy-inspector';

      existing = await pool.query(
        `SELECT id FROM carline_line_mapping
         WHERE conveyor = $1
           AND category_code IN ($2, $3)
           AND is_active = TRUE
         LIMIT 1`,
        [conveyorVal, categoryCodeVal, alternateCategory]
      );

      console.log(`📊 [FA Delete Conveyor] Alternate category match found: ${existing.rowCount} rows`);
    }

    if (existing.rowCount === 0) {
      existing = await pool.query(
        `SELECT id FROM carline_line_mapping
         WHERE conveyor = $1
           AND is_active = TRUE
         LIMIT 1`,
        [conveyorVal]
      );

      console.log(`📊 [FA Delete Conveyor] Any active match found: ${existing.rowCount} rows`);
    }

    if (existing.rowCount === 0) {
      console.log(`❌ [FA Delete Conveyor] No conveyor found for deletion`);
      return NextResponse.json(
        { error: 'Conveyor tidak ditemukan.' },
        { status: 404 }
      );
    }

    console.log(`✅ [FA Delete Conveyor] Deleting conveyor id=${existing.rows[0].id}`);

    // ── Soft delete: hanya set is_active = FALSE ────────────────────
    // Tidak perlu cek penggunaan karena penghapusan hanya dari dropdown,
    // data checklist tetap aman.
    await pool.query(
      `UPDATE carline_line_mapping
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id]
    );

    console.log(`✅ [FA Delete Conveyor] Successfully soft-deleted conveyor`);

    return NextResponse.json({ success: true, message: 'Conveyor berhasil dihapus dari daftar.' });
  } catch (error: any) {
    console.error('❌ [FA Delete Conveyor] Error:', error.message, '| code:', error.code);
    return NextResponse.json(
      { error: 'Gagal menghapus conveyor.', detail: error.message, code: error.code || null },
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
