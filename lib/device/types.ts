// lib/device/types.ts
//
// Types khusus untuk sisi frontend device system.
// Berbeda dari lib/types/device.types.ts yang dipakai di API routes.
//
// CHANGELOG:
//   - Tambah PhysicalBindingState, BindingCheckResult, DeviceBindPayload
//   - Tambah field device_code & is_bound di DeviceIdentity
//   - TIDAK mengubah field existing

import type { DeviceStatus } from '@/lib/types/device.types';

// Re-export DeviceStatus agar consumer tidak perlu import dari dua tempat
export type { DeviceStatus };

// ── Identity yang disimpan di localStorage ────────────────────────────────────

export interface DeviceIdentity {
  uuid:              string;
  fingerprintHash:   string;
  platform:          string;
  userAgent:         string;
  screenResolution:  string;
  // Info dari server setelah check berhasil
  deviceName:        string | null;
  deviceLabel:       string | null;
  areaCode:          string | null;
  areaName:          string | null;
  shiftDefault:      string;
  // Metadata lokal
  registeredAt:      string | null;   // ISO string dari server, null jika belum pernah check
  lastCheckedAt:     string | null;   // ISO string kapan terakhir /api/device/check berhasil
  recoveryCount:     number;

  // ── Physical Binding fields (NEW) ─────────────────────────────────────────
  // null = device lama yang belum punya device_code / belum bound
  deviceCode:        string | null;   // e.g. "TC21-QA-001"
  isBound:           boolean;         // true setelah QR scan binding berhasil
  boundAt:           string | null;   // ISO string kapan binding dilakukan
}

// ── State untuk hook useDevice ────────────────────────────────────────────────

export type DeviceCheckPhase =
  | 'idle'          // belum mulai
  | 'loading'       // sedang proses check ke server
  | 'done'          // check selesai (apapun hasilnya)
  | 'offline';      // tidak bisa reach server, pakai cached identity

export interface DeviceState {
  identity:    DeviceIdentity | null;
  status:      DeviceStatus | null;
  phase:       DeviceCheckPhase;
  error:       string | null;
  isReady:     boolean;   // true jika phase === 'done' || phase === 'offline'
}

// ── Konfigurasi behavior ──────────────────────────────────────────────────────

export interface DeviceCheckOptions {
  // Berapa lama (ms) menunggu response sebelum fallback ke offline mode
  // Default: 8000ms — cukup lama untuk TC21 yang koneksinya bisa lambat
  timeoutMs?: number;

  // Jika true, skip server check jika sudah pernah check dalam window ini
  // Berguna untuk mencegah check ulang saat component re-mount
  skipIfCheckedThisSession?: boolean;
}

// ── Hasil dari checkDeviceOnServer ───────────────────────────────────────────

export interface ServerCheckResult {
  success:  boolean;
  status:   DeviceStatus | null;
  identity: Partial<DeviceIdentity> | null;
  newUuid:  string | null;
  error:    string | null;
}

// ── Physical Binding types (NEW) ──────────────────────────────────────────────

// Phase state di halaman /device-bind
export type BindingPhase =
  | 'idle'        // Menunggu user scan QR
  | 'scanning'    // Kamera aktif / menunggu hasil scan
  | 'validating'  // Mengirim ke server, menunggu response
  | 'success'     // Binding berhasil
  | 'error';      // Binding gagal

// Payload yang dikirim ke POST /api/device/bind
export interface DeviceBindPayload {
  device_code:      string;   // dari QR scan
  device_uuid:      string;   // dari localStorage
  fingerprint_hash: string;   // dari generateFingerprint()
}

// Response dari POST /api/device/bind
export interface DeviceBindResult {
  success:     boolean;
  message:     string;
  device_code: string | null;
  bound_at:    string | null;   // ISO timestamp
  device?:     {
    id:            number;
    device_uuid:   string;
    device_name:   string | null;
    device_label:  string | null;
    area_code:     string | null;
    area_name:     string | null;
    shift_default: string;
  };
  error?:      string;
}

// State local storage untuk binding — disimpan terpisah dari DeviceIdentity
// agar tidak merusak format identity yang sudah ada
export interface PhysicalBindingCache {
  device_code:  string;
  bound_at:     string;   // ISO string
  device_uuid:  string;   // UUID yang dipakai saat binding
}