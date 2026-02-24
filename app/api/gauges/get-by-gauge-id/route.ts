// app/api/gauges/get-by-gauge-id/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function checkAuth(request: NextRequest) {
  const sessionToken = request.headers.get('authorization') || request.headers.get('x-session-token');
  if (!sessionToken) {
    const token = request.cookies.get('auth_session_token')?.value;
    if (token) return { authenticated: true };
    return { authenticated: false };
  }
  return { authenticated: true };
}

export async function GET(request: NextRequest) {
  const auth = checkAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const gaugeId = searchParams.get('gaugeId');

    if (!gaugeId) {
      return NextResponse.json({ error: 'Missing gaugeId parameter' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT 
        g.id,
        g.gauge_code,
        g.gauge_type,
        g.gauge_name,
        g.category_id,
        g.area_id,
        g.calibration_due,
        g.is_active,
        ca.area_name,
        ca.area_code
       FROM gauges g
       LEFT JOIN checklist_areas ca ON g.area_id = ca.id
       WHERE g.id = $1 AND g.is_active = TRUE`,
      [gaugeId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Gauge not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      gauge: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Get gauge by ID error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
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