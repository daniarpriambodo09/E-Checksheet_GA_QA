// app/api/device/check/route.ts
//
// POST /api/device/check
//
// Tidak butuh auth — dipanggil saat device boot sebelum user login.
//
// Flow:
// 1. Cari by device_uuid → cocok: validasi status → 'registered' / 'blocked' / 'inactive'
// 2. UUID tidak ada → cari by fingerprint_hash → cocok: update UUID → 'recovered'
// 3. Tidak ketemu keduanya → 'not_found'

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type {
  DeviceCheckPayload,
  DeviceCheckResult,
  RegisteredDeviceRow,
} from '@/lib/types/device.types';

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
  return { valid: true };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: DeviceCheckPayload = await request.json();

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
    } = body;

    // ── Step 1: Cari by UUID ──────────────────────────────────────────────────
    const byUuid = await pool.query<RegisteredDeviceRow>(
      `SELECT
         id, device_uuid, device_name, device_label,
         fingerprint_hash, is_active, is_blocked, block_reason,
         area_code, area_name, shift_default, recovery_count
       FROM registered_devices
       WHERE device_uuid = $1
       LIMIT 1`,
      [device_uuid]
    );

    if (byUuid.rows.length > 0) {
      const device = byUuid.rows[0];

      // Update last_seen_at setiap kali device check
      await pool.query(
        `UPDATE registered_devices
         SET last_seen_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [device.id]
      );

      if (device.is_blocked) {
        const result: DeviceCheckResult = {
          success: true,
          status: 'blocked',
          message: `Device diblokir. ${device.block_reason ?? ''}`.trim(),
        };
        return NextResponse.json(result);
      }

      if (!device.is_active) {
        const result: DeviceCheckResult = {
          success: true,
          status: 'inactive',
          message: 'Device tidak aktif. Hubungi admin untuk mengaktifkan kembali.',
        };
        return NextResponse.json(result);
      }

      // ✅ Valid
      const result: DeviceCheckResult = {
        success: true,
        status: 'registered',
        message: 'Device terdaftar dan aktif.',
        device: {
          id: device.id,
          device_uuid: device.device_uuid,
          device_name: device.device_name,
          device_label: device.device_label,
          area_code: device.area_code,
          area_name: device.area_name,
          shift_default: device.shift_default,
          recovery_count: device.recovery_count,
        },
      };
      return NextResponse.json(result);
    }

    // ── Step 2: UUID tidak ada → coba recovery via fingerprint ───────────────
    const byFingerprint = await pool.query<RegisteredDeviceRow>(
      `SELECT
         id, device_uuid, device_name, device_label,
         fingerprint_hash, is_active, is_blocked, block_reason,
         area_code, area_name, shift_default, recovery_count
       FROM registered_devices
       WHERE fingerprint_hash = $1
         AND is_active  = TRUE
         AND is_blocked = FALSE
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT 1`,
      [fingerprint_hash]
    );

    if (byFingerprint.rows.length > 0) {
      const device = byFingerprint.rows[0];

      // Update UUID baru + increment recovery_count
      await pool.query(
        `UPDATE registered_devices
         SET
           device_uuid           = $1,
           last_uuid_recovery_at = NOW(),
           recovery_count        = recovery_count + 1,
           last_seen_at          = NOW(),
           updated_at            = NOW(),
           platform              = COALESCE($2, platform),
           user_agent            = COALESCE($3, user_agent),
           screen_resolution     = COALESCE($4, screen_resolution)
         WHERE id = $5`,
        [
          device_uuid,
          platform          ?? null,
          user_agent        ?? null,
          screen_resolution ?? null,
          device.id,
        ]
      );

      // ✅ Recovery berhasil
      const result: DeviceCheckResult = {
        success: true,
        status: 'recovered',
        message: 'UUID device berhasil di-recovery menggunakan fingerprint. Simpan UUID baru ke localStorage.',
        new_uuid: device_uuid,
        device: {
          id: device.id,
          device_uuid: device_uuid,
          device_name: device.device_name,
          device_label: device.device_label,
          area_code: device.area_code,
          area_name: device.area_name,
          shift_default: device.shift_default,
          recovery_count: device.recovery_count + 1,
        },
      };
      return NextResponse.json(result);
    }

    // ── Step 3: Tidak ditemukan sama sekali ───────────────────────────────────
    const result: DeviceCheckResult = {
      success: true,
      status: 'not_found',
      message: 'Device tidak terdaftar. Hubungi admin untuk mendaftarkan device ini.',
    };
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Device check error:', error);
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}