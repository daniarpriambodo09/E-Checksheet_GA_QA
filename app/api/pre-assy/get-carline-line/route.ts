// app/api/pre-assy/get-carline-line/route.ts
//
// ✅ FIX Bug 2: Conveyor dari specific area lain ikut muncul
//
// MASALAH LAMA:
//   Query hanya filter WHERE area_id = ANY($1) tanpa filter specific_area.
//   Akibatnya CONV-9 yang dibuat di TENSILE juga muncul di CUTTING/PA/CROSS SECTION
//   karena semua specific area punya area_id yang sama.
//
// FIX:
//   Terima param `specificArea` dari frontend.
//   Jika ada, tambahkan filter AND specific_area = $N ke query.
//   Jika tidak ada (mode GL/CC Stripping/dll), tampilkan semua conveyor di area tsb.
//
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface CarlineLine {
  carline: string;
  line:    string;
}

function extractLocationSlug(areaCode: string): string {
  const prefixes = [
    'pre-assy-cc-stripping-gl-',
    'pre-assy-cc-stripping-ins-',
    'pre-assy-cc-stripping-',
    'pre-assy-gl-',
    'pre-assy-ins-',
    'pre-assy-',
  ];
  for (const prefix of prefixes) {
    if (areaCode.startsWith(prefix)) return areaCode.slice(prefix.length);
  }
  return areaCode;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaCode    = searchParams.get('areaCode');
    const areaId      = searchParams.get('areaId');
    // ✅ FIX Bug 2: terima specificArea dari frontend
    const specificArea = searchParams.get('specificArea');

    if (!areaCode && !areaId) {
      return NextResponse.json({ error: 'areaCode or areaId is required' }, { status: 400 });
    }

    // ── Resolve area_id(s) ────────────────────────────────────────────
    let areaIds: number[] = [];

    if (areaCode) {
      const slug = extractLocationSlug(areaCode);
      const areaRows = await pool.query<{ id: number }>(
        `SELECT id FROM checklist_areas
         WHERE area_code LIKE $1
           AND is_active = TRUE`,
        [`%-${slug}`]
      );
      if (areaRows.rows.length === 0) {
        const exactRows = await pool.query<{ id: number }>(
          `SELECT id FROM checklist_areas WHERE area_code = $1 AND is_active = TRUE`,
          [areaCode]
        );
        areaIds = exactRows.rows.map(r => r.id);
      } else {
        areaIds = areaRows.rows.map(r => r.id);
      }
    } else if (areaId) {
      areaIds = [parseInt(areaId)];
    }

    if (areaIds.length === 0) return NextResponse.json([]);

    // ── Cek apakah kolom conveyor sudah ada ──────────────────────────
    const columnCheck = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'checklist_results' AND column_name = 'conveyor'`
    );
    const hasConveyorColumn = columnCheck.rows.length > 0;

    if (hasConveyorColumn) {
      // ── Mode baru: gunakan kolom conveyor ────────────────────────────
      //
      // ✅ FIX Bug 2:
      // Jika specificArea dikirim → filter AND COALESCE(specific_area,'') = specificArea
      // Ini memastikan CONV-9 yang dibuat di TENSILE tidak muncul di CUTTING/PA/dll.
      //
      const params: any[] = [areaIds];
      let specificAreaClause = '';

      if (specificArea && specificArea.trim()) {
        params.push(specificArea.trim());
        specificAreaClause = `AND COALESCE(specific_area, '') = $${params.length}`;
      }

      const results = await pool.query<{ conveyor: string }>(
        `SELECT DISTINCT conveyor
         FROM checklist_results
         WHERE area_id = ANY($1)
           AND conveyor IS NOT NULL
           AND conveyor != ''
           ${specificAreaClause}
         ORDER BY conveyor ASC`,
        params
      );

      const rows = results.rows.map(r => ({
        carline:  r.conveyor,
        line:     '',
        conveyor: r.conveyor,
      }));

      console.log(
        `✅ [Pre-Assy get-carline-line] conveyor mode — ${rows.length} options` +
        ` | areaCode=${areaCode} | specificArea=${specificArea ?? 'ALL'}`
      );
      return NextResponse.json(rows);

    } else {
      // ── Mode lama: kolom carline + line ──────────────────────────────
      const results = await pool.query<CarlineLine>(
        `SELECT DISTINCT carline, line
         FROM checklist_results
         WHERE area_id = ANY($1)
           AND carline IS NOT NULL AND carline != ''
           AND line    IS NOT NULL AND line    != ''
         ORDER BY carline ASC, line ASC`,
        [areaIds]
      );

      console.log(
        `✅ [Pre-Assy get-carline-line] legacy mode — ${results.rows.length} options` +
        ` | areaCode=${areaCode}`
      );
      return NextResponse.json(results.rows);
    }

  } catch (error) {
    console.error('❌ [Pre-Assy get-carline-line] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}