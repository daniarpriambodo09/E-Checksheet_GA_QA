// app/api/final-assy/get-carline-line/route.ts
// Diupdate: membaca conveyor dari checklist_results (kolom conveyor DAN carline)
// serta dari carline_line_mapping (kolom conveyor).
// Return format tetap [{carline, line, conveyor}] untuk backward compat.

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface AreaRow    { id: number; }
interface ConveyorRow { conveyor: string | null; carline: string | null; line: string | null; }

function extractLocationSlug(areaCode: string): string {
  const prefixes = [
    'final-assy-gl-',
    'final-assy-insp-',
    'final-assy-',
  ];
  for (const prefix of prefixes) {
    if (areaCode.startsWith(prefix)) return areaCode.slice(prefix.length);
  }
  return areaCode;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaCode = searchParams.get('areaCode');
    const areaId   = searchParams.get('areaId');

    if (!areaCode && !areaId) {
      return NextResponse.json(
        { error: 'areaCode or areaId is required' },
        { status: 400 }
      );
    }

    // ── Resolve areaIds ────────────────────────────────────────────
    let areaIds: number[] = [];

    if (areaCode) {
      const slug = extractLocationSlug(areaCode);

      const areaRows = await executeQuery<AreaRow>(
        `SELECT id FROM checklist_areas
         WHERE area_code LIKE $1
           AND is_active = TRUE`,
        [`%-${slug}`]
      );

      if (areaRows.length === 0) {
        const exactRows = await executeQuery<AreaRow>(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND is_active = TRUE`,
          [areaCode]
        );
        areaIds = exactRows.map(r => r.id);
      } else {
        areaIds = areaRows.map(r => r.id);
      }
    } else if (areaId) {
      areaIds = [parseInt(areaId)];
    }

    if (areaIds.length === 0) {
      return NextResponse.json([]);
    }

    if (areaIds.length === 0) {
      return NextResponse.json([]);
    }

    // ── Baca conveyor dari carline_line_mapping yang aktif ──────────
    // Dropdown hanya menampilkan conveyor yang tersedia di mapping aktif.
    // Tidak termasuk dari checklist_results untuk menghindari data lama.
    const mappingRows = await executeQuery<ConveyorRow>(
      `SELECT DISTINCT conveyor, NULL AS carline, NULL AS line
       FROM carline_line_mapping
       WHERE is_active = TRUE
         AND category_code IN ('final-assy-inspector', 'final-assy-gl')
       ORDER BY conveyor ASC`
    );

    // Deduplikasi dan format output
    const seen = new Set<string>();
    const output: Array<{ carline: string; line: string; conveyor: string }> = [];

    for (const row of mappingRows) {
      const cv = String(row.conveyor || '').trim().toUpperCase();
      if (!cv || seen.has(cv)) continue;
      seen.add(cv);
      output.push({
        conveyor: cv,
        carline: cv,
        line: '',
      });
    }

    console.log(
      `✅ [FA get-carline-line] ${output.length} active conveyor(s) from mapping`
    );

    return NextResponse.json(output);

  } catch (error) {
    console.error('❌ [FA get-carline-line] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conveyor data' },
      { status: 500 }
    );
  }
}