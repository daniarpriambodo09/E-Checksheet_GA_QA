// lib/device/api.ts
//
// Helper untuk memanggil /api/device/check dari client.
// Menangani: timeout, network error, offline detection.
//
// Tidak menggunakan library HTTP apapun — pakai fetch biasa seperti auth-context.tsx.

import type { DeviceCheckResult } from '@/lib/types/device.types';
import type { ServerCheckResult } from './types';

// ── Timeout wrapper untuk fetch ───────────────────────────────────────────────
// TC21 bisa lambat respond — gunakan timeout eksplisit
// bukan bergantung pada browser default (bisa sampai 60 detik)

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

// ── Cek apakah device sedang offline ─────────────────────────────────────────

function isOffline(): boolean {
  // navigator.onLine tidak 100% akurat tapi cukup untuk initial check
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

// ── Panggil /api/device/check ─────────────────────────────────────────────────

export async function callDeviceCheck(payload: {
  device_uuid:      string;
  fingerprint_hash: string;
  platform:         string;
  user_agent:       string;
  screen_resolution: string;
}, timeoutMs = 8000): Promise<ServerCheckResult> {

  // Early exit jika sudah pasti offline — tidak perlu coba fetch
  if (isOffline()) {
    console.log('[Device] navigator.onLine = false, skip server check');
    return { success: false, status: null, identity: null, newUuid: null, error: 'offline' };
  }

  try {
    const response = await fetchWithTimeout(
      '/e-checksheet-qa/api/device/check',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        // credentials: same-origin — tidak perlu kirim cookie, tapi tetap setting untuk konsistensi
        credentials: 'same-origin',
      },
      timeoutMs
    );

    // Server bisa return non-200 untuk error internal — tangkap dengan aman
    const data: DeviceCheckResult = await response.json();

    if (!response.ok) {
      console.error('❌ [Device] Server check error:', response.status, data);
      return {
        success:  false,
        status:   null,
        identity: null,
        newUuid:  null,
        error:    `Server error ${response.status}`,
      };
    }

    // Ekstrak info device dari response untuk disimpan ke storage
    const partialIdentity: Partial<import('./types').DeviceIdentity> | null =
      data.device
        ? {
            uuid:          data.device.device_uuid,
            deviceName:    data.device.device_name,
            deviceLabel:   data.device.device_label,
            areaCode:      data.device.area_code,
            areaName:      data.device.area_name,
            shiftDefault:  data.device.shift_default,
            recoveryCount: data.device.recovery_count,
            lastCheckedAt: new Date().toISOString(),
          }
        : null;

    return {
      success:  true,
      status:   data.status,
      identity: partialIdentity,
      newUuid:  data.new_uuid ?? null,
      error:    null,
    };

  } catch (err: any) {
    // AbortError = timeout
    if (err?.name === 'AbortError') {
      console.warn('⚠️ [Device] Check request timed out after', timeoutMs, 'ms');
      return { success: false, status: null, identity: null, newUuid: null, error: 'timeout' };
    }

    // TypeError biasanya network error (no connection, DNS fail, dsb)
    if (err instanceof TypeError) {
      console.warn('⚠️ [Device] Network error:', err.message);
      return { success: false, status: null, identity: null, newUuid: null, error: 'network_error' };
    }

    console.error('❌ [Device] Unexpected error during check:', err);
    return { success: false, status: null, identity: null, newUuid: null, error: err?.message ?? 'unknown' };
  }
}