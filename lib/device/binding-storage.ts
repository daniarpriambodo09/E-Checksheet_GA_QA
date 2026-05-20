// lib/device/binding-storage.ts
//
// Storage helpers khusus untuk Physical Device Binding.
//
// DIPISAH dari storage.ts agar tidak merusak sistem storage existing.
// storage.ts (UUID, DeviceIdentity) → TIDAK dimodifikasi.
//
// Key yang digunakan:
//   device_physical_binding_v1  → PhysicalBindingCache
//
// Diakses oleh:
//   - useDeviceBind hook (halaman /device-bind)
//   - DeviceGuard (untuk cek apakah binding diperlukan)

import type { PhysicalBindingCache } from './types';

// ── Key ───────────────────────────────────────────────────────────────────────

const BINDING_KEY = 'device_physical_binding_v1';

// ── Safe storage accessor ─────────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    localStorage.setItem('__binding_storage_test__', '1');
    localStorage.removeItem('__binding_storage_test__');
    return localStorage;
  } catch {
    try {
      return sessionStorage;
    } catch {
      return null;
    }
  }
}

// ── Save binding result ───────────────────────────────────────────────────────

export function savePhysicalBinding(cache: PhysicalBindingCache): void {
  const storage = getStorage();
  if (!storage) {
    console.warn('⚠️ [BindingStorage] Storage tidak tersedia, binding tidak dapat disimpan');
    return;
  }
  try {
    const json = JSON.stringify(cache);
    storage.setItem(BINDING_KEY, json);
    console.log(`💾 [BindingStorage] Binding disimpan: device_code="${cache.device_code}", uuid="${cache.device_uuid?.substring(0, 12)}..."`);
  } catch (e) {
    console.warn('⚠️ [BindingStorage] Storage penuh, mencoba clear dan simpan ulang', e);
    try {
      storage.removeItem(BINDING_KEY);
      storage.setItem(BINDING_KEY, JSON.stringify(cache));
      console.log(`💾 [BindingStorage] Binding disimpan setelah clear`);
    } catch {
      console.error('❌ [BindingStorage] Gagal menyimpan binding bahkan setelah clear');
    }
  }
}

// ── Load binding result ───────────────────────────────────────────────────────

export function loadPhysicalBinding(): PhysicalBindingCache | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(BINDING_KEY);
  if (!raw) {
    console.log(`🔍 [BindingStorage] Tidak ada binding di storage (key: ${BINDING_KEY})`);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PhysicalBindingCache;
    console.log(`📖 [BindingStorage] Binding loaded: device_code="${parsed.device_code}", bound_at="${parsed.bound_at}"`);
    return parsed;
  } catch {
    console.warn('⚠️ [BindingStorage] Data binding korup, menghapus...');
    storage.removeItem(BINDING_KEY);
    return null;
  }
}

// ── Cek apakah device sudah bound ────────────────────────────────────────────
//
// Digunakan oleh DeviceGuard untuk early guard sebelum API selesai.
// Tidak log setiap call karena dipanggil sangat sering.

export function isDeviceBound(): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;

    const raw = storage.getItem(BINDING_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as PhysicalBindingCache;
    return !!parsed?.device_code;
  } catch {
    return false;
  }
}

// ── Clear binding (untuk reset / admin purposes) ──────────────────────────────

export function clearPhysicalBinding(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(BINDING_KEY);
  console.log(`🗑️ [BindingStorage] Binding dihapus`);
}