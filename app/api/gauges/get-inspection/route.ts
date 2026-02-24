// app/api/gauges/get-inspection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gaugeId = searchParams.get('gaugeId');
    const dateKey = searchParams.get('dateKey');
    const shift = searchParams.get('shift');

    if (!gaugeId || !dateKey || !shift) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT 
        gi.id,
        gi.gauge_id,
        gi.user_id,
        gi.date_key,
        gi.shift,
        gi.status,
        gi.ng_description,
        gi.ng_department,
        gi.scanned_at,
        u.full_name as scanned_by
       FROM gauge_inspections gi
       LEFT JOIN users u ON gi.user_id = u.id
       WHERE gi.gauge_id = $1 AND gi.date_key = $2 AND gi.shift = $3`,
      [gaugeId, dateKey, shift]
    );

    return NextResponse.json({
      success: true,
      inspection: result.rows[0] || null
    });

  } catch (error) {
    console.error('❌ Get inspection error:', error);
    return NextResponse.json({ 
      error: 'Server error'
    }, { status: 500 });
  }
}