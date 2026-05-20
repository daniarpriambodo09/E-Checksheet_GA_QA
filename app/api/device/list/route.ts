// app/api/device/list/route.ts
//
// GET    /api/device/list             → list semua device (admin only)
// PATCH  /api/device/list             → update device (admin only)
// DELETE /api/device/list?id=X        → soft delete device (admin only)
//
// Query params GET (semua opsional):
//   ?areaCode=FA-01
//   ?isActive=true|false
//   ?isBlocked=true|false
//   ?search=TC21                      → cari di device_name, device_label, device_uuid

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getServerAuth, shouldSkipAuth, isAdminRole } from '@/lib/auth-server';
import type { DeviceListItem, DeviceUpdatePayload } from '@/lib/types/device.types';

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const areaCode  = searchParams.get('areaCode');
    const isActive  = searchParams.get('isActive');
    const isBlocked = searchParams.get('isBlocked');
    const search    = searchParams.get('search');

    // JOIN ke users menggunakan VARCHAR — tidak ada cast tipe
    let query = `
      SELECT
        rd.id,
        rd.device_uuid,
        rd.device_name,
        rd.device_label,
        rd.fingerprint_hash,
        rd.platform,
        rd.screen_resolution,
        rd.area_code,
        rd.area_name,
        rd.shift_default,
        rd.is_active,
        rd.is_blocked,
        rd.block_reason,
        rd.recovery_count,
        rd.registered_by,
        rd.registered_at,
        rd.last_seen_at,
        rd.notes,
        u.username AS registered_by_username
      FROM registered_devices rd
      LEFT JOIN users u ON u.id = rd.registered_by
      WHERE 1 = 1
    `;
    const params: any[] = [];

    if (areaCode) {
      params.push(areaCode);
      query += ` AND rd.area_code = $${params.length}`;
    }

    if (isActive !== null && isActive !== '') {
      params.push(isActive === 'true');
      query += ` AND rd.is_active = $${params.length}`;
    }

    if (isBlocked !== null && isBlocked !== '') {
      params.push(isBlocked === 'true');
      query += ` AND rd.is_blocked = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        rd.device_name  ILIKE $${params.length}
        OR rd.device_label ILIKE $${params.length}
        OR rd.device_uuid  ILIKE $${params.length}
        OR rd.area_code    ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY rd.registered_at DESC`;

    const result = await pool.query<DeviceListItem>(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });

  } catch (error: any) {
    console.error('❌ Device list error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', detail: error.message },
      { status: 500 }
    );
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body: DeviceUpdatePayload = await request.json();
    const {
      id,
      device_name,
      device_label,
      area_code,
      area_name,
      shift_default,
      is_active,
      is_blocked,
      block_reason,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id wajib diisi' }, { status: 400 });
    }

    if (shift_default !== undefined && !['A', 'B', 'C'].includes(shift_default)) {
      return NextResponse.json(
        { success: false, error: 'shift_default harus A, B, atau C' },
        { status: 400 }
      );
    }

    // Cek device ada
    const existing = await pool.query(
      `SELECT id FROM registered_devices WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device tidak ditemukan' },
        { status: 404 }
      );
    }

    const result = await pool.query(
      `UPDATE registered_devices SET
         device_name   = COALESCE($1,  device_name),
         device_label  = COALESCE($2,  device_label),
         area_code     = COALESCE($3,  area_code),
         area_name     = COALESCE($4,  area_name),
         shift_default = COALESCE($5,  shift_default),
         is_active     = COALESCE($6,  is_active),
         is_blocked    = COALESCE($7,  is_blocked),
         block_reason  = $8,
         notes         = COALESCE($9,  notes),
         updated_at    = NOW()
       WHERE id = $10
       RETURNING
         id, device_uuid, device_name, device_label,
         area_code, area_name, shift_default,
         is_active, is_blocked, block_reason, updated_at`,
      [
        device_name   ?? null,
        device_label  ?? null,
        area_code     ?? null,
        area_name     ?? null,
        shift_default ?? null,
        is_active     ?? null,
        is_blocked    ?? null,
        block_reason  ?? null,   // sengaja null-able: bisa unset block_reason
        notes         ?? null,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Device berhasil diperbarui.',
      data: result.rows[0],
    });

  } catch (error: any) {
    console.error('❌ Device update error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', detail: error.message },
      { status: 500 }
    );
  }
}

// ── DELETE (soft delete) ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id wajib diisi' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE registered_devices
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING id, device_uuid, device_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device tidak ditemukan atau sudah dinonaktifkan' },
        { status: 404 }
      );
    }

    const deleted = result.rows[0];
    return NextResponse.json({
      success: true,
      message: `Device "${deleted.device_name ?? deleted.device_uuid}" berhasil dinonaktifkan.`,
      deleted_id: deleted.id,
    });

  } catch (error: any) {
    console.error('❌ Device delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', detail: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-username',
    },
  });
}