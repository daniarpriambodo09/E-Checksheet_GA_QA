// app/api/pre-assy/delete-conveyor/route.ts
//
// ✅ FIX: Root cause "Conveyor tidak ditemukan"
//
// MASALAH SEBELUMNYA:
//   Route lama mencari conveyor di tabel `carline_line_mapping`.
//   Namun `get-carline-line` membaca daftar conveyor dari
//   `checklist_results.conveyor` (bukan dari carline_line_mapping).
//   Akibatnya: record ada di checklist_results tapi tidak ditemukan
//   di carline_line_mapping → error "Conveyor tidak ditemukan".
//
// FIX:
//   NULL-kan kolom `conveyor` dan `carline` di `checklist_results`
//   untuk semua baris yang memiliki nilai conveyor tersebut pada area ini.
//   Dengan begitu get-carline-line tidak lagi mengembalikan conveyor tsb
//   di daftar dropdown.
//   Juga tetap coba hapus dari carline_line_mapping (jika ada).
//
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conveyor, categoryCode, userId, areaCode } = body;

    if (!conveyor) {
      return NextResponse.json(
        { error: 'Conveyor wajib diisi.' },
        { status: 400 }
      );
    }

    const conveyorVal     = String(conveyor).trim().toUpperCase();
    const categoryCodeVal = categoryCode ? String(categoryCode).trim() : null;
    const userIdVal       = userId       ? String(userId).trim()       : null;

    if (!conveyorVal) {
      return NextResponse.json(
        { error: 'Nama conveyor tidak boleh kosong.' },
        { status: 400 }
      );
    }

    console.log(
      `🗑️ [PA Delete Conveyor] conveyor="${conveyorVal}" ` +
      `category="${categoryCodeVal}" user="${userIdVal}" area="${areaCode}"`
    );

    // ── 1. Resolve area_id dari areaCode ─────────────────────────────
    let areaIds: number[] = [];

    if (areaCode) {
      const prefixes = [
        'pre-assy-cc-stripping-gl-',
        'pre-assy-cc-stripping-ins-',
        'pre-assy-cc-stripping-',
        'pre-assy-gl-',
        'pre-assy-ins-',
        'pre-assy-',
      ];
      let slug = String(areaCode);
      for (const prefix of prefixes) {
        if (slug.startsWith(prefix)) { slug = slug.slice(prefix.length); break; }
      }

      const areaRows = await pool.query<{ id: number }>(
        `SELECT id FROM checklist_areas WHERE area_code LIKE $1 AND is_active = TRUE`,
        [`%-${slug}`]
      );

      if (areaRows.rows.length > 0) {
        areaIds = areaRows.rows.map(r => r.id);
      } else {
        const exactRows = await pool.query<{ id: number }>(
          `SELECT id FROM checklist_areas WHERE area_code = $1 AND is_active = TRUE`,
          [areaCode]
        );
        areaIds = exactRows.rows.map(r => r.id);
      }
    }

    // ── 2. Cek keberadaan conveyor di checklist_results ──────────────
    // Ini adalah source of truth yang dibaca oleh get-carline-line.
    const checkQuery = areaIds.length > 0
      ? await pool.query(
          `SELECT COUNT(*) AS cnt FROM checklist_results
           WHERE COALESCE(NULLIF(conveyor,''), NULLIF(carline,'')) = $1
             AND area_id = ANY($2)`,
          [conveyorVal, areaIds]
        )
      : await pool.query(
          `SELECT COUNT(*) AS cnt FROM checklist_results
           WHERE COALESCE(NULLIF(conveyor,''), NULLIF(carline,'')) = $1`,
          [conveyorVal]
        );

    const countInResults = parseInt(checkQuery.rows[0]?.cnt ?? '0', 10);

    // ── 3. Cek di carline_line_mapping ────────────────────────────────
    let countInMapping = 0;
    try {
      const mappingCheck = await pool.query(
        `SELECT COUNT(*) AS cnt FROM carline_line_mapping
         WHERE conveyor = $1 AND is_active = TRUE`,
        [conveyorVal]
      );
      countInMapping = parseInt(mappingCheck.rows[0]?.cnt ?? '0', 10);
    } catch { /* tabel mungkin tidak ada kolom conveyor */ }

    if (countInResults === 0 && countInMapping === 0) {
      console.warn(`⚠️ [PA Delete Conveyor] Tidak ditemukan di mana pun: "${conveyorVal}"`);
      return NextResponse.json(
        { error: `Conveyor "${conveyorVal}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    let deletedFromResults = 0;
    let deletedFromMapping = 0;

    // ── 4. NULL-kan conveyor di checklist_results ────────────────────
    // Membuat get-carline-line tidak lagi mengembalikan conveyor ini.
    // Data checklist tetap ada, hanya tag konveyor-nya yang dihapus.
    if (countInResults > 0) {
      const updateResult = areaIds.length > 0
        ? await pool.query(
            `UPDATE checklist_results
             SET conveyor = NULL, carline = NULL, updated_at = NOW()
             WHERE COALESCE(NULLIF(conveyor,''), NULLIF(carline,'')) = $1
               AND area_id = ANY($2)`,
            [conveyorVal, areaIds]
          )
        : await pool.query(
            `UPDATE checklist_results
             SET conveyor = NULL, carline = NULL, updated_at = NOW()
             WHERE COALESCE(NULLIF(conveyor,''), NULLIF(carline,'')) = $1`,
            [conveyorVal]
          );

      deletedFromResults = updateResult.rowCount ?? 0;
      console.log(`✅ [PA Delete Conveyor] Updated ${deletedFromResults} rows in checklist_results`);
    }

    // ── 5. Soft-delete di carline_line_mapping jika ada ──────────────
    if (countInMapping > 0) {
      try {
        const mappingUpdate = await pool.query(
          `UPDATE carline_line_mapping
           SET is_active = FALSE, updated_at = NOW()
           WHERE conveyor = $1 AND is_active = TRUE`,
          [conveyorVal]
        );
        deletedFromMapping = mappingUpdate.rowCount ?? 0;
        console.log(`✅ [PA Delete Conveyor] Soft-deleted ${deletedFromMapping} rows in carline_line_mapping`);
      } catch (err: any) {
        console.warn(`⚠️ [PA Delete Conveyor] carline_line_mapping update skipped: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Conveyor "${conveyorVal}" berhasil dihapus dari daftar.`,
      deletedFromResults,
      deletedFromMapping,
    });

  } catch (error: any) {
    console.error('❌ [PA Delete Conveyor] Error:', error.message);
    return NextResponse.json(
      { error: 'Gagal menghapus conveyor.', detail: error.message },
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