// lib/device/index.ts
//
// Core orchestrator untuk device identity system.
// Dipanggil dari useDevice hook — BUKAN langsung dari component.
//
// Urutan kerja:
//   1. Load UUID dari localStorage (atau generate baru jika tidak ada)
//   2. Generate fingerprint dari hardware info device
//   3. Panggil /api/device/check
//   4. Handle response: registered / recovered / blocked / inactive / not_found
//   5. Update localStorage jika ada perubahan (UUID recovery, dsb)
//
// Semua fungsi ini adalah pure async functions — tidak ada React di sini.
// Ini sengaja dipisah agar mudah di-test dan tidak coupling ke lifecycle React.

import { generateUUID }                   from '@/lib/utils/uuid';
import { generateFingerprint }            from './fingerprint';
import { saveDeviceUUID, loadDeviceUUID, saveDeviceIdentity, loadDeviceIdentity } from './storage';
import { callDeviceCheck }                from './api';
import type { DeviceIdentity, DeviceState, DeviceCheckOptions, ServerCheckResult } from './types';
import type { DeviceStatus }              from '@/lib/types/device.types';

// ── Konstanta ─────────────────────────────────────────────────────────────────

// Status yang berarti device tidak boleh lanjut menggunakan app
export const BLOCKING_STATUSES: DeviceStatus[] = ['blocked', 'inactive', 'not_found'];

// Berapa lama (ms) cache identity dianggap masih segar (tidak perlu server check)
// 30 menit — cukup lama untuk satu shift, cukup pendek untuk tetap valid
const IDENTITY_FRESH_WINDOW_MS = 30 * 60 * 1000;

// ── Cek apakah identity masih segar (tidak perlu check server lagi) ───────────

export function isIdentityFresh(identity: DeviceIdentity | null): boolean {
  if (!identity?.lastCheckedAt) return false;
  const lastChecked = new Date(identity.lastCheckedAt).getTime();
  const now         = Date.now();
  return now - lastChecked < IDENTITY_FRESH_WINDOW_MS;
}

// ── Buat DeviceIdentity awal (sebelum server check) ──────────────────────────

function buildBaseIdentity(
  uuid:             string,
  fingerprintHash:  string,
  platform:         string,
  userAgent:        string,
  screenResolution: string,
): DeviceIdentity {
  return {
    uuid,
    fingerprintHash,
    platform,
    userAgent,
    screenResolution,

    deviceName: null,
    deviceLabel: null,
    areaCode: null,
    areaName: null,
    shiftDefault: 'A',

    registeredAt: null,
    lastCheckedAt: null,
    recoveryCount: 0,

    // tambahkan ini
    deviceCode: null,
    isBound: false,
    boundAt: null,
  };
}

// ── Merge server response ke identity yang sudah ada ─────────────────────────

function mergeServerData(
  base:       DeviceIdentity,
  serverData: Partial<DeviceIdentity>,
): DeviceIdentity {
  return {
    ...base,
    ...serverData,
    // Pastikan field lokal yang penting tidak tertimpa null dari server
    uuid:            serverData.uuid            ?? base.uuid,
    fingerprintHash: base.fingerprintHash,   // tidak pernah berubah dari server
    platform:        base.platform,
    userAgent:       base.userAgent,
    screenResolution: base.screenResolution,
  };
}

// ── Fungsi utama: inisialisasi device ────────────────────────────────────────
//
// Return: DeviceState lengkap setelah semua proses selesai.
// Caller (useDevice hook) tinggal set state dari return value ini.

export async function initDevice(options: DeviceCheckOptions = {}): Promise<DeviceState> {
  const { timeoutMs = 8000 } = options;

  // ── Step 1: Load atau generate UUID ──────────────────────────────────────

  let uuid = loadDeviceUUID();
  let isNewDevice = false;

  if (!uuid) {
    uuid        = generateUUID();
    isNewDevice = true;
    saveDeviceUUID(uuid);
    console.log('[Device] UUID baru digenerate:', uuid);
  } else {
    console.log('[Device] UUID loaded dari storage:', uuid.substring(0, 8) + '...');
  }

  // ── Step 2: Load cached identity ─────────────────────────────────────────

  const cachedIdentity = loadDeviceIdentity();

  // Jika identity masih segar DAN bukan device baru → skip server check
  // Ini penting untuk offline-first: tidak perlu check setiap kali component mount
  if (!isNewDevice && isIdentityFresh(cachedIdentity)) {
    console.log('[Device] Identity masih segar, skip server check');
    return {
      identity: cachedIdentity,
      status:   'registered',   // asumsikan masih registered jika segar
      phase:    'done',
      error:    null,
      isReady:  true,
    };
  }

  // ── Step 3: Generate fingerprint ─────────────────────────────────────────

  let fingerprintResult;
  try {
    fingerprintResult = await generateFingerprint();
    console.log('[Device] Fingerprint method:', fingerprintResult.method);
  } catch (err) {
    console.error('❌ [Device] Fingerprint generation failed:', err);
    // Tidak bisa generate fingerprint — tidak bisa check server
    // Gunakan cached identity jika ada
    if (cachedIdentity) {
      return {
        identity: cachedIdentity,
        status:   'registered',
        phase:    'offline',
        error:    'Tidak bisa generate fingerprint',
        isReady:  true,
      };
    }
    return {
      identity: null,
      status:   null,
      phase:    'offline',
      error:    'Tidak bisa generate fingerprint',
      isReady:  false,
    };
  }

  const { hash: fingerprintHash, components } = fingerprintResult;

  // Buat base identity dengan data lokal
  const baseIdentity = buildBaseIdentity(
    uuid,
    fingerprintHash,
    components.platform,
    (() => { try { return navigator.userAgent; } catch { return 'unknown'; } })(),
    components.screenResolution,
  );

  // ── Step 4: Panggil server ────────────────────────────────────────────────

  const serverResult: ServerCheckResult = await callDeviceCheck(
    {
      device_uuid:       uuid,
      fingerprint_hash:  fingerprintHash,
      platform:          components.platform,
      user_agent:        baseIdentity.userAgent,
      screen_resolution: components.screenResolution,
    },
    timeoutMs
  );

  // ── Step 5: Handle offline / timeout ─────────────────────────────────────

  if (!serverResult.success) {
    const isNetworkError = ['offline', 'timeout', 'network_error'].includes(serverResult.error ?? '');

    if (isNetworkError && cachedIdentity) {
      // Gunakan cached identity — device tetap bisa operate
      console.log('[Device] Offline/timeout, menggunakan cached identity');
      return {
        identity: cachedIdentity,
        status:   'registered',   // asumsikan masih valid saat offline
        phase:    'offline',
        error:    null,
        isReady:  true,
      };
    }

    if (isNetworkError && !cachedIdentity) {
      // Tidak ada cache dan tidak bisa reach server
      // Untuk device baru ini bermasalah — tapi tetap berikan state offline
      console.warn('[Device] Offline dan tidak ada cached identity');
      return {
        identity: baseIdentity,
        status:   null,
        phase:    'offline',
        error:    'Tidak dapat menghubungi server dan tidak ada data tersimpan',
        isReady:  false,
      };
    }

    // Server error (bukan network error) — log dan fallback ke cache
    console.error('❌ [Device] Server returned error:', serverResult.error);
    if (cachedIdentity) {
      return {
        identity: cachedIdentity,
        status:   'registered',
        phase:    'offline',
        error:    serverResult.error,
        isReady:  true,
      };
    }

    return {
      identity: baseIdentity,
      status:   null,
      phase:    'done',
      error:    serverResult.error ?? 'Server error tidak diketahui',
      isReady:  false,
    };
  }

  // ── Step 6: Handle recovery — UUID berubah ────────────────────────────────

  if (serverResult.status === 'recovered' && serverResult.newUuid) {
    console.log('[Device] UUID di-recover oleh server, update storage');
    // Server sudah menerima UUID baru kita — tidak perlu update lagi
    // UUID yang kita kirim (device_uuid) sudah di-set sebagai UUID baru di server
    // Cukup pastikan UUID di storage adalah yang kita kirim tadi
    saveDeviceUUID(uuid);
  }

  // ── Step 7: Simpan identity yang sudah ter-verify oleh server ────────────

  const verifiedIdentity = mergeServerData(
    baseIdentity,
    serverResult.identity ?? {}
  );
  saveDeviceIdentity(verifiedIdentity);
  // Juga pastikan UUID key selalu sinkron
  saveDeviceUUID(verifiedIdentity.uuid);

  // ── Step 8: Kembalikan state final ───────────────────────────────────────

  const status = serverResult.status ?? 'not_found';

  return {
    identity: verifiedIdentity,
    status,
    phase:    'done',
    error:    null,
    isReady:  !BLOCKING_STATUSES.includes(status),
  };
}