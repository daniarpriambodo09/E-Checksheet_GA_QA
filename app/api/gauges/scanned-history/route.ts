// app/api/gauges/scanned-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function checkAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  try {
    const sessionToken = request.headers.get('authorization') || request.headers.get('x-session-token');
    if (!sessionToken) {
      const token = request.cookies.get('auth_session_token')?.value;
      if (token) return { authenticated: true };
      return { authenticated: false, error: 'Unauthorized' };
    }
    return { authenticated: true };
  } catch (error) {
    return { authenticated: false, error: 'Authentication failed' };
  }
}

export async function GET(request: NextRequest) {
  const auth = checkAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateKey = searchParams.get('dateKey');
    const shift = searchParams.get('shift');
    // ✅ areaCode TIDAK dipakai untuk filter — semua gauge ditampilkan

    if (!dateKey || !shift) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: dateKey, shift' },
        { status: 400 }
      );
    }

    console.log('🔍 [Scanned History] Fetching ALL gauges for:', { dateKey, shift });

    // ✅ Query tanpa filter area — semua gauge yang sudah dicek hari ini
    const query = `
      SELECT 
        g.id as gauge_id,
        g.gauge_code,
        g.gauge_type,
        g.gauge_name,
        g.area_id,
        ca.area_code,
        ca.area_name,
        CASE 
          WHEN COUNT(CASE WHEN gcr.status = 'NG' THEN 1 END) > 0 THEN 'NG'
          WHEN COUNT(CASE WHEN gcr.status = '-' THEN 1 END) > 0 THEN '-'
          ELSE 'OK'
        END as overall_status,
        COUNT(CASE WHEN gcr.status = 'NG' THEN 1 END) as ng_count,
        COUNT(*) as checkpoint_count,
        MAX(gcr.checked_at) as checked_at
      FROM gauge_checkpoint_results gcr
      JOIN gauges g ON gcr.gauge_id = g.id
      JOIN gauge_checkpoints gc ON gcr.checkpoint_id = gc.id
      LEFT JOIN checklist_areas ca ON g.area_id = ca.id
      WHERE gcr.date_key = $1 
        AND gcr.shift = $2
      GROUP BY g.id, g.gauge_code, g.gauge_type, g.gauge_name, g.area_id, ca.area_code, ca.area_name
      ORDER BY MAX(gcr.checked_at) DESC
    `;

    const result = await pool.query(query, [dateKey, shift]);

    console.log('✅ [Scanned History] Results found:', result.rows.length);

    return NextResponse.json({
      success: true,
      history: result.rows.map(row => ({
        gauge_id: row.gauge_id,
        gauge_code: row.gauge_code,
        gauge_type: row.gauge_type,
        gauge_name: row.gauge_name,
        area_code: row.area_code,    // ✅ Tambah info area
        area_name: row.area_name,    // ✅ Tambah info area
        overall_status: row.overall_status,
        has_ng: row.ng_count > 0,
        checked_at: row.checked_at,
        checkpoint_count: parseInt(row.checkpoint_count),
        ng_count: parseInt(row.ng_count)
      }))
    });

  } catch (error) {
    console.error('❌ [Scanned History] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    },
  });
}