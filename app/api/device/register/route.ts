// app/api/device/register/route.ts
//
// POST /api/device/register
//
// Hanya admin yang bisa mendaftarkan device baru.
// registered_by menggunakan user.id (VARCHAR) sesuai struktur users tabel.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getServerAuth, shouldSkipAuth, isAdminRole } from '@/lib/auth-server';
import type { DeviceRegisterPayload } from '@/lib/types/device.types';

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

// ── Validasi payload ──────────────────────────────────────────────────────────

function validatePayload(body: any): { valid: boolean; error?: string } {
  if (!body.device_uuid || typeof body.device_uuid !== 'string') {
    return { valid: false, error: 'device_uuid wajib diisi' };
  }
  if (!body.fingerprint_hash || typeof body.fingerprint_hash !== 'string') {
    return { valid: false, error: 'fingerprint_hash wajib diisi' };
  }
  if (body.device_uuid.length > 64) {
    return { valid: false, error: 'device_uuid terlalu panjang (max 64 karakter)' };
  }
  if (body.fingerprint_hash.length > 128) {
    return { valid: false, error: 'fingerprint_hash terlalu panjang (max 128 karakter)' };
  }
  if (body.shift_default !== undefined && !['A', 'B', 'C'].includes(body.shift_default)) {
    return { valid: false, error: 'shift_default harus A, B, atau C' };
  }
  return { valid: true };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await checkAdminAuth(request);
    if (!authorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body: DeviceRegisterPayload = await request.json();

    const { valid, error: validationError } = validatePayload(body);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const {
      device_uuid,
      fingerprint_hash,
      platform,
      user_agent,
      screen_resolution,
      device_name,
      device_label,
      area_code,
      area_name,
      shift_default = 'A',
      notes,
    } = body;

    // ── Cek duplikat UUID ─────────────────────────────────────────────────────
    const dupUuid = await pool.query(
      `SELECT id, device_uuid
       FROM registered_devices
       WHERE device_uuid = $1
       LIMIT 1`,
      [device_uuid]
    );
    if (dupUuid.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Device UUID "${device_uuid}" sudah terdaftar.`,
          existing_id: dupUuid.rows[0].id,
        },
        { status: 409 }
      );
    }

    // ── Cek duplikat fingerprint ──────────────────────────────────────────────
    // Satu fingerprint = satu device fisik. Jika sudah ada, tolak.
    const dupFingerprint = await pool.query(
      `SELECT id, device_uuid, device_name
       FROM registered_devices
       WHERE fingerprint_hash = $1
         AND is_active = TRUE
       LIMIT 1`,
      [fingerprint_hash]
    );
    if (dupFingerprint.rows.length > 0) {
      const existing = dupFingerprint.rows[0];
      return NextResponse.json(
        {
          success: false,
          error: `Fingerprint ini sudah dipakai oleh device "${existing.device_name ?? existing.device_uuid}" (ID: ${existing.id}). Setiap device harus memiliki fingerprint unik.`,
          existing_id: existing.id,
          existing_uuid: existing.device_uuid,
        },
        { status: 409 }
      );
    }

    // ── Insert device baru ────────────────────────────────────────────────────
    // registered_by = user.id (VARCHAR) — tidak perlu cast ke integer
    const result = await pool.query(
      `INSERT INTO registered_devices (
         device_uuid,
         fingerprint_hash,
         platform,
         user_agent,
         screen_resolution,
         device_name,
         device_label,
         area_code,
         area_name,
         shift_default,
         notes,
         registered_by,
         is_active,
         is_blocked,
         recovery_count,
         registered_at,
         updated_at
       ) VALUES (
         $1,  $2,  $3,  $4,  $5,
         $6,  $7,  $8,  $9,  $10,
         $11, $12,
         TRUE, FALSE, 0,
         NOW(), NOW()
       )
       RETURNING
         id, device_uuid, device_name, device_label,
         area_code, area_name, shift_default, registered_at`,
      [
        device_uuid,
        fingerprint_hash,
        platform          ?? null,
        user_agent        ?? null,
        screen_resolution ?? null,
        device_name       ?? null,
        device_label      ?? null,
        area_code         ?? null,
        area_name         ?? null,
        shift_default,
        notes             ?? null,
        user.id,           // ← langsung string, tidak perlu String() cast
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Device "${device_name ?? device_uuid}" berhasil didaftarkan.`,
      data: result.rows[0],
    });

  } catch (error: any) {
    console.error('❌ Device register error:', error);

    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Device UUID atau fingerprint sudah ada.' },
        { status: 409 }
      );
    }

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-username',
    },
  });
}