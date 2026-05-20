// app/api/device/bind/route.ts
//
// POST /api/device/bind
//
// Endpoint binding device fisik (QR code) ke device lokal (UUID + fingerprint).
//
// Tidak butuh auth — dipanggil saat device boot sebelum user login.
//
// ── PENTING: LOOKUP ORDER ────────────────────────────────────────────────────
//
//   Sebelumnya (BUGGY): lookup by device_uuid → fallback fingerprint
//   Masalah: admin pre-register pakai UUID placeholder, TC21 baru punya UUID
//   berbeda → tidak ketemu → 404 → bind gagal terus.
//
//   Sekarang (FIXED): lookup by device_code DULU → fallback device_uuid → fallback fingerprint
//   Alasan: device_code adalah satu-satunya identifier yang PASTI sama antara
//   DB (admin set saat pre-register) dan TC21 (scan QR stiker yang sama).
//
// ── APA YANG DIUPDATE SAAT BIND SUKSES ──────────────────────────────────────
//
//   - device_code  = device_code dari QR (konfirmasi)
//   - is_bound     = TRUE
//   - device_uuid  = UUID ASLI TC21 (ganti placeholder admin)
//   - fingerprint_hash = fingerprint ASLI TC21 (ganti placeholder admin)
//   - platform, user_agent, screen_resolution = dari TC21 jika dikirim
//   - last_seen_at, updated_at = NOW()
//
// ── FLOW ─────────────────────────────────────────────────────────────────────
//
// 1. Validasi payload (device_code wajib; device_uuid & fingerprint_hash opsional tapi disarankan)
// 2. Cari device: by device_code → by device_uuid → by fingerprint_hash
// 3. Validasi status device (active, not blocked)
// 4. SINGLE-DEVICE ENFORCEMENT:
//    a. is_bound = false                    → lanjut ke bind (Step 5)
//    b. is_bound = true + caller = SAMA     → idempotent, return success, NO overwrite
//    c. is_bound = true + caller = BERBEDA  → HARD REJECT 409
// 5. UPDATE binding dengan WHERE is_bound = FALSE (anti race condition)
//    Cek rowCount — jika 0 → race condition → REJECT
// 6. Return hasil

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { DeviceBindPayload, DeviceBindResult } from '@/lib/device/types';

// ── Validasi payload ──────────────────────────────────────────────────────────
//
// device_code WAJIB — ini adalah kunci utama lookup sekarang.
// device_uuid & fingerprint_hash SANGAT DISARANKAN — untuk update DB setelah bind.
// platform, user_agent, screen_resolution OPSIONAL — untuk audit trail.

function validatePayload(body: any): { valid: boolean; error?: string } {
  if (!body.device_code || typeof body.device_code !== 'string') {
    return { valid: false, error: 'device_code wajib diisi' };
  }
  if (body.device_code.length > 50) {
    return { valid: false, error: 'device_code terlalu panjang (max 50 karakter)' };
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(body.device_code)) {
    return { valid: false, error: 'device_code hanya boleh mengandung huruf, angka, dash (-), underscore (_)' };
  }
  // device_uuid & fingerprint_hash tidak wajib untuk validasi awal
  // tapi akan dipakai untuk update jika tersedia
  if (body.device_uuid && typeof body.device_uuid !== 'string') {
    return { valid: false, error: 'device_uuid harus berupa string' };
  }
  if (body.fingerprint_hash && typeof body.fingerprint_hash !== 'string') {
    return { valid: false, error: 'fingerprint_hash harus berupa string' };
  }
  return { valid: true };
}

// ── Tipe row device dari DB ───────────────────────────────────────────────────

interface DeviceRow {
  id:                number;
  device_uuid:       string;
  device_name:       string | null;
  device_label:      string | null;
  area_code:         string | null;
  area_name:         string | null;
  shift_default:     string;
  is_active:         boolean;
  is_blocked:        boolean;
  block_reason:      string | null;
  device_code:       string | null;
  is_bound:          boolean;
}

const DEVICE_SELECT = `
  SELECT
    id, device_uuid, device_name, device_label,
    area_code, area_name, shift_default,
    is_active, is_blocked, block_reason,
    device_code, is_bound
  FROM registered_devices
`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log('📥 [DeviceBind] POST /api/device/bind - request masuk');

  try {
    const body = await request.json();
    console.log('📋 [DeviceBind] Payload diterima:', {
      device_code:      body.device_code,
      device_uuid:      body.device_uuid ? body.device_uuid.substring(0, 12) + '...' : '(tidak ada)',
      fingerprint_hash: body.fingerprint_hash ? body.fingerprint_hash.substring(0, 12) + '...' : '(tidak ada)',
      platform:         body.platform ?? '(tidak ada)',
    });

    // ── Step 1: Validasi payload ──────────────────────────────────────────────

    const { valid, error: validationError } = validatePayload(body);
    if (!valid) {
      console.warn('⚠️ [DeviceBind] Validasi gagal:', validationError);
      return NextResponse.json(
        {
          success:     false,
          message:     validationError ?? 'Payload tidak valid',
          error:       validationError,
          device_code: null,
          bound_at:    null,
        } satisfies DeviceBindResult,
        { status: 400 }
      );
    }

    const {
      device_code,
      device_uuid,
      fingerprint_hash,
      platform,
      user_agent,
      screen_resolution,
    } = body as DeviceBindPayload & {
      platform?:         string;
      user_agent?:       string;
      screen_resolution?: string;
    };

    // ── Step 2: Cari device di DB ─────────────────────────────────────────────
    //
    // ORDER LOOKUP (KRITIS):
    //   1. by device_code  ← UTAMA! Admin set ini saat pre-register
    //   2. by device_uuid  ← Fallback jika device sudah pernah bind sebelumnya
    //   3. by fingerprint  ← Recovery path untuk device lama
    //
    // Kenapa device_code dulu?
    //   Skenario pre-registration:
    //   - Admin buat row dengan device_uuid = "ADMIN_HT_SCANQA30_..." (placeholder)
    //   - Admin set device_code = "HT_SCANQA30"
    //   - TC21 baru scan QR → punya UUID ASLI yang beda dari placeholder
    //   - Jika lookup by UUID dulu → tidak ketemu → 404
    //   - Jika lookup by device_code → ketemu! ✓

    let deviceRow: DeviceRow | null = null;
    let lookupMethod = '';

    // Lookup 1: by device_code (PRIORITAS UTAMA)
    console.log(`🔍 [DeviceBind] Lookup by device_code: "${device_code}"`);
    const byCode = await pool.query<DeviceRow>(
      `${DEVICE_SELECT} WHERE device_code = $1 LIMIT 1`,
      [device_code]
    );
    if (byCode.rows.length > 0) {
      deviceRow    = byCode.rows[0];
      lookupMethod = 'device_code';
      console.log(`✅ [DeviceBind] Device ditemukan by device_code → id=${deviceRow.id}, device_uuid=${deviceRow.device_uuid.substring(0, 12)}...`);
    }

    // Lookup 2: by device_uuid (jika device_code tidak ketemu)
    if (!deviceRow && device_uuid) {
      console.log(`🔍 [DeviceBind] Lookup by device_uuid: "${device_uuid.substring(0, 12)}..."`);
      const byUuid = await pool.query<DeviceRow>(
        `${DEVICE_SELECT} WHERE device_uuid = $1 LIMIT 1`,
        [device_uuid]
      );
      if (byUuid.rows.length > 0) {
        deviceRow    = byUuid.rows[0];
        lookupMethod = 'device_uuid';
        console.log(`✅ [DeviceBind] Device ditemukan by device_uuid → id=${deviceRow.id}`);
      }
    }

    // Lookup 3: by fingerprint_hash (recovery path)
    if (!deviceRow && fingerprint_hash) {
      console.log(`🔍 [DeviceBind] Lookup by fingerprint_hash: "${fingerprint_hash.substring(0, 12)}..."`);
      const byFingerprint = await pool.query<DeviceRow>(
        `${DEVICE_SELECT}
         WHERE fingerprint_hash = $1
           AND is_active = TRUE
           AND is_blocked = FALSE
         ORDER BY last_seen_at DESC NULLS LAST
         LIMIT 1`,
        [fingerprint_hash]
      );
      if (byFingerprint.rows.length > 0) {
        deviceRow    = byFingerprint.rows[0];
        lookupMethod = 'fingerprint_hash';
        console.log(`✅ [DeviceBind] Device ditemukan by fingerprint → id=${deviceRow.id}`);
      }
    }

    // Device tidak ditemukan sama sekali
    if (!deviceRow) {
      console.error(`❌ [DeviceBind] Device tidak ditemukan. device_code="${device_code}", uuid="${device_uuid?.substring(0, 12)}...", fp="${fingerprint_hash?.substring(0, 12)}..."`);
      return NextResponse.json(
        {
          success:     false,
          message:     `Device dengan kode "${device_code}" tidak ditemukan di sistem. Pastikan kode QR benar atau hubungi admin untuk mendaftarkan device ini.`,
          device_code: null,
          bound_at:    null,
          error:       'device_not_found',
        } satisfies DeviceBindResult,
        { status: 404 }
      );
    }

    console.log(`📊 [DeviceBind] Device row: id=${deviceRow.id}, is_active=${deviceRow.is_active}, is_blocked=${deviceRow.is_blocked}, is_bound=${deviceRow.is_bound}, device_code_in_db="${deviceRow.device_code}", lookup_method="${lookupMethod}"`);

    // ── Step 3: Validasi status device ───────────────────────────────────────

    if (deviceRow.is_blocked) {
      console.warn(`🚫 [DeviceBind] Device diblokir. Alasan: ${deviceRow.block_reason}`);
      return NextResponse.json(
        {
          success:     false,
          message:     `Device diblokir. ${deviceRow.block_reason ?? ''}`.trim(),
          device_code: null,
          bound_at:    null,
          error:       'device_blocked',
        } satisfies DeviceBindResult,
        { status: 403 }
      );
    }

    if (!deviceRow.is_active) {
      console.warn(`🚫 [DeviceBind] Device tidak aktif.`);
      return NextResponse.json(
        {
          success:     false,
          message:     'Device tidak aktif. Hubungi admin untuk mengaktifkan kembali.',
          device_code: null,
          bound_at:    null,
          error:       'device_inactive',
        } satisfies DeviceBindResult,
        { status: 403 }
      );
    }

    // ── Step 4: HARD BLOCK — is_bound = true dari device BERBEDA ───────────────
    //
    // Ini adalah inti dari single-device enforcement.
    //
    // Kasus yang harus dibedakan:
    //
    //   A) is_bound = false
    //      → Device belum pernah di-bind siapapun → lanjut ke Step 7 (bind)
    //
    //   B) is_bound = true, caller adalah device YANG SAMA (UUID atau fingerprint cocok)
    //      → Idempotent re-bind: device scan ulang QR-nya sendiri (misalnya app restart)
    //      → Allow, tapi TIDAK overwrite UUID/fingerprint (sudah benar di DB)
    //      → Return success tanpa UPDATE hardware fields
    //
    //   C) is_bound = true, caller adalah device BERBEDA (UUID DAN fingerprint tidak cocok)
    //      → TOLAK KERAS — ini adalah percobaan bind oleh device lain
    //      → Return 409 already_bound
    //
    // Mengapa cek UUID ATAU fingerprint (bukan AND)?
    //   Karena device yang sama bisa punya UUID sama tapi fingerprint sedikit beda
    //   (misalnya setelah update OS) — atau sebaliknya. Satu saja yang cocok = device sama.
    //
    // TIDAK ADA fallback "jika code sama return success" tanpa identity check.
    // Itu adalah celah yang memungkinkan double-bind.

    if (deviceRow.is_bound) {
      const callerUuid        = device_uuid        ?? null;
      const callerFingerprint = fingerprint_hash   ?? null;
      const storedUuid        = deviceRow.device_uuid;

      // Cek apakah caller adalah device yang sama:
      // UUID cocok ATAU fingerprint cocok → device sama
      const uuidMatch        = callerUuid        && callerUuid        === storedUuid;

      // Fingerprint match perlu query DB karena fingerprint_hash tidak ada di DeviceRow saat ini
      // Ambil dari DB untuk perbandingan yang akurat
      const fpRow = await pool.query<{ fingerprint_hash: string | null }>(
        `SELECT fingerprint_hash FROM registered_devices WHERE id = $1 LIMIT 1`,
        [deviceRow.id]
      );
      const storedFingerprint = fpRow.rows[0]?.fingerprint_hash ?? null;
      const fingerprintMatch  = callerFingerprint && storedFingerprint &&
                                callerFingerprint === storedFingerprint;

      const isSameDevice = uuidMatch || fingerprintMatch;

      console.log(`🔐 [DeviceBind] is_bound=true check: uuidMatch=${uuidMatch}, fpMatch=${fingerprintMatch}, isSameDevice=${isSameDevice}`);

      if (!isSameDevice) {
        // Device BERBEDA mencoba bind ke device_code yang sudah bound
        // → HARD REJECT, tidak ada pengecualian
        console.error(`🚫 [DeviceBind] DITOLAK — device_code "${device_code}" sudah bound ke device lain. ` +
          `stored_uuid=${storedUuid?.substring(0, 12)}..., caller_uuid=${callerUuid?.substring(0, 12) ?? 'N/A'}...`);
        return NextResponse.json(
          {
            success:     false,
            message:     `Kode device "${device_code}" sudah terikat ke perangkat lain dan tidak dapat digunakan lagi. Hubungi admin jika perangkat perlu diganti.`,
            device_code: null,
            bound_at:    null,
            error:       'already_bound_by_other_device',
          } satisfies DeviceBindResult,
          { status: 409 }
        );
      }

      // Device SAMA melakukan re-bind (idempotent) — misalnya app restart atau re-scan
      // Update last_seen_at saja — TIDAK overwrite UUID/fingerprint/platform
      // karena data di DB sudah benar dari bind pertama
      console.log(`ℹ️ [DeviceBind] Re-bind idempotent oleh device yang sama. Update last_seen_at saja.`);
      await pool.query(
        `UPDATE registered_devices
         SET last_seen_at = NOW(),
             updated_at   = NOW()
         WHERE id = $1`,
        [deviceRow.id]
      );

      return NextResponse.json(
        {
          success:     true,
          message:     'Device sudah terikat. Binding dikonfirmasi ulang.',
          device_code,
          bound_at:    new Date().toISOString(),
          device: {
            id:            deviceRow.id,
            device_uuid:   deviceRow.device_uuid,
            device_name:   deviceRow.device_name,
            device_label:  deviceRow.device_label,
            area_code:     deviceRow.area_code,
            area_name:     deviceRow.area_name,
            shift_default: deviceRow.shift_default,
          },
        } satisfies DeviceBindResult
      );
    }

    // ── Step 5: Lakukan binding (is_bound = false) ────────────────────────────
    //
    // Sampai di sini berarti device belum pernah di-bind siapapun.
    //
    // ANTI RACE CONDITION:
    //   UPDATE menggunakan WHERE is_bound = FALSE sebagai kondisi tambahan.
    //   Jika dua request datang bersamaan:
    //     - Request pertama: UPDATE berhasil, rowCount = 1 → bind sukses
    //     - Request kedua: UPDATE tidak ada row yang cocok (is_bound sudah TRUE),
    //       rowCount = 0 → return error 'bind_race_condition'
    //   Tanpa transaction terpisah, WHERE is_bound = FALSE sudah atomic di PostgreSQL.

    const now = new Date().toISOString();

    console.log(`🔒 [DeviceBind] Melakukan binding... id=${deviceRow.id}, device_code="${device_code}", uuid="${device_uuid?.substring(0, 12)}..."`);

    const updateResult = await pool.query(
      `UPDATE registered_devices
       SET
         device_code       = $1,
         is_bound          = TRUE,
         device_uuid       = COALESCE($2, device_uuid),
         fingerprint_hash  = COALESCE($3, fingerprint_hash),
         platform          = COALESCE($4, platform),
         user_agent        = COALESCE($5, user_agent),
         screen_resolution = COALESCE($6, screen_resolution),
         last_seen_at      = NOW(),
         updated_at        = NOW()
       WHERE id = $7
         AND is_bound = FALSE`,
      [
        device_code,
        device_uuid       ?? null,
        fingerprint_hash  ?? null,
        platform          ?? null,
        user_agent        ?? null,
        screen_resolution ?? null,
        deviceRow.id,
      ]
    );

    // ── Cek apakah UPDATE benar-benar berhasil ────────────────────────────────
    //
    // rowCount = 0 berarti row tidak ter-update.
    // Kemungkinan: race condition — device lain berhasil bind lebih dulu
    // di antara SELECT (Step 2) dan UPDATE ini.

    if ((updateResult.rowCount ?? 0) === 0) {
      console.error(`🚫 [DeviceBind] Race condition! UPDATE rowCount=0. id=${deviceRow.id}, device_code="${device_code}"`);
      return NextResponse.json(
        {
          success:     false,
          message:     `Kode device "${device_code}" baru saja digunakan oleh perangkat lain. Hubungi admin.`,
          device_code: null,
          bound_at:    null,
          error:       'bind_race_condition',
        } satisfies DeviceBindResult,
        { status: 409 }
      );
    }

    console.log(`✅ [DeviceBind] BINDING SUKSES! id=${deviceRow.id}, device_code="${device_code}", is_bound=TRUE, rowCount=${updateResult.rowCount}`);

    // ── Step 6: Return hasil ──────────────────────────────────────────────────

    const result: DeviceBindResult = {
      success:     true,
      message:     `Device berhasil diikat ke kode fisik "${device_code}".`,
      device_code,
      bound_at:    now,
      device: {
        id:            deviceRow.id,
        device_uuid:   device_uuid ?? deviceRow.device_uuid,
        device_name:   deviceRow.device_name,
        device_label:  deviceRow.device_label,
        area_code:     deviceRow.area_code,
        area_name:     deviceRow.area_name,
        shift_default: deviceRow.shift_default,
      },
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ [DeviceBind] Unexpected error:', error);
    console.error('❌ [DeviceBind] Stack:', error?.stack);

    if (error.code === '23505') {
      // Unique constraint violation — race condition, device_code sudah dipakai
      return NextResponse.json(
        {
          success:     false,
          message:     'Kode device sudah digunakan (race condition). Coba lagi atau hubungi admin.',
          device_code: null,
          bound_at:    null,
          error:       'unique_violation',
        } satisfies DeviceBindResult,
        { status: 409 }
      );
    }

    if (error.code === '42703') {
      // Column does not exist — schema mismatch
      console.error('❌ [DeviceBind] Schema error — kolom tidak ada:', error.message);
      return NextResponse.json(
        {
          success:     false,
          message:     'Server error: schema DB tidak sesuai. Hubungi developer.',
          device_code: null,
          bound_at:    null,
          error:       'schema_mismatch',
        } satisfies DeviceBindResult,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success:     false,
        message:     'Server error saat proses binding. Coba lagi atau hubungi admin.',
        device_code: null,
        bound_at:    null,
        error:       error.message ?? 'unknown',
      } satisfies DeviceBindResult,
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}