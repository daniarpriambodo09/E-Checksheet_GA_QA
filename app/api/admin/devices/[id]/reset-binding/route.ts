// app/api/admin/devices/[id]/reset-binding/route.ts
//
// POST /api/admin/devices/[id]/reset-binding - Reset device binding

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getServerAuth, shouldSkipAuth, isAdminRole } from '@/lib/auth-server';

async function checkAdminAuth(request: NextRequest) {
  if (shouldSkipAuth()) {
    return { authorized: true, user: { id: 'dev', role: 'admin', username: 'dev' } };
  }
  const { user, error } = await getServerAuth(request);
  if (error || !user || !isAdminRole(user.role)) {
    return { authorized: false, user: null };
  }
  return { authorized: true, user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const deviceId = parseInt(id);
    if (isNaN(deviceId)) {
      return NextResponse.json({ success: false, error: 'Invalid device ID' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE registered_devices
       SET device_code = NULL, is_bound = FALSE, bound_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, device_uuid`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device binding reset successfully',
    });
  } catch (error: any) {
    console.error('Error resetting device binding:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
}