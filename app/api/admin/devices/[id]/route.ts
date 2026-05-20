// app/api/admin/devices/[id]/route.ts
//
// PUT /api/admin/devices/[id] - Update device
// DELETE /api/admin/devices/[id] - Delete device (if not bound)

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

export async function PUT(
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

    const body = await request.json();
    const { device_name, device_label, is_active } = body;

    const result = await pool.query(
      `UPDATE registered_devices
       SET device_name = $1, device_label = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [device_name, device_label, is_active, deviceId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating device:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Check if device is bound
    const device = await pool.query(
      'SELECT is_bound FROM registered_devices WHERE id = $1',
      [deviceId]
    );

    if (device.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    if (device.rows[0].is_bound) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete bound device' },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM registered_devices WHERE id = $1', [deviceId]);

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting device:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
}