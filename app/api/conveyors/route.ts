// app/api/conveyors/route.ts
// GET  /api/conveyors          → list semua conveyor aktif
// GET  /api/conveyors?conveyorId=X  → patterns untuk conveyor tertentu

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conveyorId = searchParams.get('conveyorId');
    const conveyor   = searchParams.get('conveyor'); // bisa query by name

    // ── Ambil patterns untuk conveyor tertentu ──────────────────────────────
    if (conveyorId || conveyor) {
      const result = await pool.query(
        `SELECT
           cp.id,
           cp.pattern,
           cp.sort_order,
           c.conveyor,
           c.id AS conveyor_id
         FROM conveyor_patterns cp
         JOIN conveyors c ON c.id = cp.conveyor_id
         WHERE cp.is_active = TRUE
           AND (
             ($1::integer IS NOT NULL AND c.id = $1::integer)
             OR ($2::text IS NOT NULL AND c.conveyor = $2)
           )
         ORDER BY cp.sort_order, cp.pattern`,
        [conveyorId ? parseInt(conveyorId) : null, conveyor || null]
      );

      return NextResponse.json({
        success: true,
        patterns: result.rows,
        count: result.rows.length,
      });
    }

    // ── Ambil semua conveyor (dengan patterns-nya sekalian) ─────────────────
    const result = await pool.query(
      `SELECT
         c.id,
         c.conveyor,
         c.sort_order,
         COALESCE(
           json_agg(
             json_build_object('id', cp.id, 'pattern', cp.pattern, 'sort_order', cp.sort_order)
             ORDER BY cp.sort_order
           ) FILTER (WHERE cp.id IS NOT NULL),
           '[]'
         ) AS patterns
       FROM conveyors c
       LEFT JOIN conveyor_patterns cp
         ON cp.conveyor_id = c.id AND cp.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id, c.conveyor, c.sort_order
       ORDER BY c.sort_order`
    );

    return NextResponse.json({
      success: true,
      conveyors: result.rows,
      count: result.rows.length,
    });

  } catch (error) {
    console.error('❌ Error fetching conveyors:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}