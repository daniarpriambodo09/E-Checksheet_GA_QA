// app/api/gauges/checkpoints/get/route.ts
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
    const dateKey = searchParams.get('dateKey');
    const shift = searchParams.get('shift');

    if (!gaugeId || !dateKey || !shift) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log('🔍 [Checkpoint Results] Fetching for:', { gaugeId, dateKey, shift });

    const result = await pool.query(
      `SELECT 
        gcr.checkpoint_id,
        gc.checkpoint_name,
        gcr.status,
        gcr.notes,
        gcr.checked_at
       FROM gauge_checkpoint_results gcr
       JOIN gauge_checkpoints gc ON gcr.checkpoint_id = gc.id
       WHERE gcr.gauge_id = $1 
         AND gcr.date_key = $2 
         AND gcr.shift = $3
       ORDER BY gc.checkpoint_order ASC`,
      [gaugeId, dateKey, shift]
    );

    console.log('✅ [Checkpoint Results] Found:', result.rows.length);

    return NextResponse.json({
      success: true,
      checkpointResults: result.rows.map(row => ({
        checkpointId: row.checkpoint_id,
        checkpointName: row.checkpoint_name,
        status: row.status,
        notes: row.notes,
        checkedAt: row.checked_at
      }))
    });
  } catch (error) {
    console.error('❌ [Checkpoint Results] Error:', error);
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