// app/api/admin/devices/route.ts
//
// GET  /api/admin/devices  - List all registered devices
// POST /api/admin/devices  - Create new device with device_code
//
// FIXES:
//   1. Hapus kolom bound_at dari SELECT (tidak ada di schema)
//   2. INSERT fingerprint_hash dengan placeholder PRE_REGISTERED_{device_code}
//      agar tidak melanggar NOT NULL constraint
//   3. device_uuid unik ADMIN_ prefix agar tidak konflik dengan runtime devices

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getServerAuth, shouldSkipAuth, isAdminRole } from '@/lib/auth-server';

async function checkAdminAuth(request: NextRequest) {
  // Dev bypass
  if (shouldSkipAuth()) {
    return { authorized: true, user: { id: 'dev', role: 'admin', username: 'dev' } };
  }

  // ── Baca header yang dikirim authFetch() dari frontend ────────────────────
  const xUserId   = request.headers.get("x-user-id")   || "";
  const xUserRole = request.headers.get("x-user-role") || "";
  const xUsername = request.headers.get("x-username")  || "";

  if (xUserId && xUserRole && isAdminRole(xUserRole)) {
    return {
      authorized: true,
      user: { id: xUserId, role: xUserRole, username: xUsername },
    };
  }

  // ── Fallback: session/cookie auth ─────────────────────────────────────────
  const { user, error } = await getServerAuth(request);
  if (error || !user || !isAdminRole(user.role)) {
    return { authorized: false, user: null };
  }
  return { authorized: true, user };
}

// ── GET — List all devices ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // FIX 1: Hanya pilih kolom yang ada di schema.
    // bound_at TIDAK ADA — dihapus dari query.
    // Kolom binding yang ada: is_bound (boolean)
    const result = await pool.query(`
      SELECT
        id,
        device_uuid,
        device_name,
        device_label,
        device_code,
        is_bound,
        fingerprint_hash,
        platform,
        area_code,
        area_name,
        is_active,
        is_blocked,
        block_reason,
        registered_by,
        registered_at,
        last_seen_at,
        updated_at,
        notes
      FROM registered_devices
      ORDER BY registered_at DESC
    `);

    return NextResponse.json({ success: true, devices: result.rows });

  } catch (error: any) {
    console.error('[devices/GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
}

// ── POST — Create new device (admin pre-registration) ────────────────────────
//
// FLOW ARSITEKTUR:
//   1. Admin create device_code di sini (pre-registration)
//   2. Device fisik TC21 scan QR di /device-bind
//   3. /api/device/bind melakukan UPDATE: set fingerprint_hash ke hash hardware asli,
//      set device_uuid ke UUID hardware asli, set is_bound = true
//
// FIX 2: fingerprint_hash diisi placeholder "PRE_REGISTERED_{device_code}"
//
// Kenapa aman:
//   • Fingerprint runtime (TC21 hardware) = SHA-256 hex, 64 karakter lowercase
//   • Placeholder "PRE_REGISTERED_..." tidak pernah match format hash asli → tidak ada false-match
//   • /api/device/check mencari: device_uuid + fingerprint_hash (keduanya berbeda)
//   • Saat binding (/api/device/bind), kedua field di-UPDATE ke nilai hardware asli
//   • Existing fingerprint system tidak terpengaruh sama sekali
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await checkAdminAuth(request);
    if (!authorized || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { device_code, device_name, device_label } = body;

    if (!device_code || typeof device_code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'device_code wajib diisi' },
        { status: 400 }
      );
    }

    const sanitizedCode = device_code.trim().toUpperCase();

    // Validasi format: hanya huruf kapital, angka, underscore, dash
    if (!/^[A-Z0-9_\-]+$/.test(sanitizedCode)) {
      return NextResponse.json(
        { success: false, error: 'Device code hanya boleh mengandung huruf, angka, underscore, dan dash' },
        { status: 400 }
      );
    }

    // Cek duplikat device_code
    const existing = await pool.query(
      'SELECT id FROM registered_devices WHERE device_code = $1',
      [sanitizedCode]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Device code "${sanitizedCode}" sudah terdaftar` },
        { status: 409 }
      );
    }

    // Placeholder fingerprint — unik per device_code, aman dari false-match
    const placeholderFingerprint = `PRE_REGISTERED_${sanitizedCode}`;

    // device_uuid sementara — prefix ADMIN_ untuk mudah dibedakan
    // Akan di-UPDATE ke UUID hardware saat binding di /api/device/bind
    const adminDeviceUuid = `ADMIN_${sanitizedCode}_${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO registered_devices
         (device_uuid, device_name, device_label, device_code,
          fingerprint_hash, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id, device_uuid, device_code, device_name, device_label,
         is_bound, is_active, is_blocked, registered_at, notes`,
      [
        adminDeviceUuid,
        device_name  ? device_name.trim()  : null,
        device_label ? device_label.trim() : null,
        sanitizedCode,
        placeholderFingerprint,
        user.id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Device "${sanitizedCode}" berhasil didaftarkan. Scan QR di /device-bind untuk aktivasi.`,
      device: result.rows[0],
    });

  } catch (error: any) {
    console.error('[devices/POST] Error:', error);

    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Device code sudah terdaftar' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Database error: ' + (error.message || 'Unknown') },
      { status: 500 }
    );
  }
}