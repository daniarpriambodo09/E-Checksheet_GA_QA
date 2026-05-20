// lib/device/storage.ts
//
// Persistent storage untuk device identity.
//
// Menggunakan localStorage sebagai primary storage (konsisten dengan auth-context.tsx).
// Tidak menggunakan IndexedDB di sini — IndexedDB digunakan untuk data checksheet,
// bukan untuk identity kecil seperti UUID yang harus tersedia instan saat boot.
//
// Fallback ke sessionStorage jika localStorage tidak tersedia
// (mode incognito / storage penuh di TC21).
//
// Key naming: konsisten dengan pola di auth-context.tsx
//   auth_current_user_v2
//   auth_session_token
// → device keys menggunakan prefix "device_" dengan suffix "_v1"

import type { DeviceIdentity } from "./types";

// ── Konstanta key ─────────────────────────────────────────────────────────────

const DEVICE_UUID_KEY      = 'device_uuid_v1';
const DEVICE_IDENTITY_KEY  = 'device_identity_v1';

// ── Safe storage accessor ─────────────────────────────────────────────────────
// TC21 WebView kadang throw SecurityError saat akses localStorage di beberapa kondisi

function getStorage(): Storage | null {
  try {
    // Test bahwa localStorage benar-benar bisa digunakan
    localStorage.setItem('__device_storage_test__', '1');
    localStorage.removeItem('__device_storage_test__');
    return localStorage;
  } catch {
    try {
      return sessionStorage;
    } catch {
      return null;
    }
  }
}

// ── UUID ──────────────────────────────────────────────────────────────────────

export function saveDeviceUUID(uuid: string): void {
  const storage = getStorage();
  if (!storage) {
    console.warn('⚠️ [Device] Storage tidak tersedia, UUID tidak dapat disimpan');
    return;
  }
  storage.setItem(DEVICE_UUID_KEY, uuid);
}

export function loadDeviceUUID(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(DEVICE_UUID_KEY);
}

export function clearDeviceUUID(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(DEVICE_UUID_KEY);
}

// ── Device identity lengkap ───────────────────────────────────────────────────

export function saveDeviceIdentity(identity: DeviceIdentity): void {
  const storage = getStorage();
  if (!storage) {
    console.warn('⚠️ [Device] Storage tidak tersedia, identity tidak dapat disimpan');
    return;
  }
  try {
    storage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(identity));
  } catch (e) {
    // Storage penuh — coba hapus data lama lalu simpan ulang
    console.warn('⚠️ [Device] Storage penuh, mencoba clear dan simpan ulang', e);
    try {
      storage.removeItem(DEVICE_IDENTITY_KEY);
      storage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      console.error('❌ [Device] Gagal menyimpan identity bahkan setelah clear');
    }
  }
}

export function loadDeviceIdentity(): DeviceIdentity | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(DEVICE_IDENTITY_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DeviceIdentity;
  } catch {
    // Data korup — hapus
    console.warn('⚠️ [Device] Data identity korup, menghapus...');
    storage.removeItem(DEVICE_IDENTITY_KEY);
    return null;
  }
}

export function clearDeviceIdentity(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(DEVICE_UUID_KEY);
  storage.removeItem(DEVICE_IDENTITY_KEY);
}