// lib/types/device.types.ts

// ── Row dari DB ────────────────────────────────────────────────────────────────

export interface RegisteredDeviceRow {
  id: number;
  device_uuid: string;
  device_name: string | null;
  device_label: string | null;
  fingerprint_hash: string;
  platform: string | null;
  user_agent: string | null;
  screen_resolution: string | null;
  area_code: string | null;
  area_name: string | null;
  shift_default: string;
  is_active: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  last_uuid_recovery_at: Date | null;
  recovery_count: number;
  registered_by: string | null;   // ← VARCHAR, mengikuti users.id
  registered_at: Date;
  last_seen_at: Date | null;
  updated_at: Date;
  notes: string | null;
}

// ── Payload dari frontend ──────────────────────────────────────────────────────

export interface DeviceCheckPayload {
  device_uuid: string;
  fingerprint_hash: string;
  platform?: string;
  user_agent?: string;
  screen_resolution?: string;
}

export interface DeviceRegisterPayload {
  device_uuid: string;
  fingerprint_hash: string;
  platform?: string;
  user_agent?: string;
  screen_resolution?: string;
  device_name?: string;
  device_label?: string;
  area_code?: string;
  area_name?: string;
  shift_default?: 'A' | 'B' | 'C';
  notes?: string;
}

export interface DeviceUpdatePayload {
  id: number;
  device_name?: string;
  device_label?: string;
  area_code?: string;
  area_name?: string;
  shift_default?: 'A' | 'B' | 'C';
  is_active?: boolean;
  is_blocked?: boolean;
  block_reason?: string | null;
  notes?: string;
}

// ── Response shapes ────────────────────────────────────────────────────────────

export type DeviceStatus =
  | 'registered'   // UUID cocok, aktif, tidak diblokir
  | 'recovered'    // UUID hilang, fingerprint cocok → UUID di-update
  | 'not_found'    // UUID & fingerprint tidak ditemukan
  | 'blocked'      // Device ditemukan tapi diblokir
  | 'inactive';    // Device ditemukan tapi is_active = false

export interface DeviceInfo {
  id: number;
  device_uuid: string;
  device_name: string | null;
  device_label: string | null;
  area_code: string | null;
  area_name: string | null;
  shift_default: string;
  recovery_count: number;
}

export interface DeviceCheckResult {
  success: true;
  status: DeviceStatus;
  device?: DeviceInfo;
  new_uuid?: string;   // diisi saat status = 'recovered'
  message: string;
}

export interface DeviceListItem {
  id: number;
  device_uuid: string;
  device_name: string | null;
  device_label: string | null;
  fingerprint_hash: string;
  platform: string | null;
  screen_resolution: string | null;
  area_code: string | null;
  area_name: string | null;
  shift_default: string;
  is_active: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  recovery_count: number;
  registered_by: string | null;            // VARCHAR, mengikuti users.id
  registered_by_username: string | null;   // JOIN dari tabel users
  registered_at: Date;
  last_seen_at: Date | null;
  notes: string | null;
}