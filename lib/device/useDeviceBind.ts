// lib/device/useDeviceBind.ts
//
// Hook untuk menangani Physical Device Binding via QR scan.
// Digunakan di halaman /device-bind saja.
//
// ── PERUBAHAN dari versi sebelumnya ─────────────────────────────────────────
//
//   1. Payload ke server sekarang menyertakan platform, user_agent,
//      screen_resolution — agar DB terupdate dengan data TC21 asli.
//
//   2. Setelah bind sukses, identity di localStorage di-reset (lastCheckedAt = null)
//      sehingga DeviceGuard tidak pakai cache stale yang masih punya UUID lama.
//      Ini mencegah redirect loop setelah bind.
//
//   3. Tambahan console.log detail di setiap step untuk debugging.
//
//   4. QR parser juga menerima format uppercase dari TC21 hardware scanner.

'use client';

import { useState, useCallback } from 'react';
import { generateFingerprint }   from './fingerprint';
import { loadDeviceUUID, saveDeviceIdentity, loadDeviceIdentity } from './storage';
import { savePhysicalBinding }   from './binding-storage';
import type {
  BindingPhase,
  DeviceBindResult,
  PhysicalBindingCache,
} from './types';

// ── Types lokal ───────────────────────────────────────────────────────────────

export interface BindState {
  phase:       BindingPhase;
  error:       string | null;
  deviceCode:  string | null;
  message:     string | null;
}

const INITIAL_STATE: BindState = {
  phase:      'idle',
  error:      null,
  deviceCode: null,
  message:    null,
};

// ── QR Parser ─────────────────────────────────────────────────────────────────
//
// TC21 Zebra hardware scanner biasanya inject raw string langsung.
// QR bisa berupa:
//   - JSON: { "device_code": "HT_SCANQA30" }
//   - Plain string: "HT_SCANQA30"
//
// Output selalu uppercase untuk konsistensi dengan DB.

function parseQRResult(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  console.log(`🔍 [useDeviceBind] Parsing QR raw input: "${trimmed.substring(0, 80)}"`);

  // Coba parse JSON dulu
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.device_code && typeof parsed.device_code === 'string') {
      const code = parsed.device_code.trim().toUpperCase();
      console.log(`✅ [useDeviceBind] QR parsed as JSON → device_code: "${code}"`);
      return code;
    }
    console.warn(`⚠️ [useDeviceBind] QR adalah JSON tapi tidak ada field device_code:`, parsed);
    return null;
  } catch {
    // Bukan JSON — cek apakah raw string langsung device_code
    if (/^[A-Za-z0-9\-_]{3,50}$/.test(trimmed)) {
      const code = trimmed.toUpperCase();
      console.log(`✅ [useDeviceBind] QR parsed as plain string → device_code: "${code}"`);
      return code;
    }
    console.warn(`⚠️ [useDeviceBind] QR tidak valid (bukan JSON, bukan plain device_code): "${trimmed.substring(0, 40)}"`);
    return null;
  }
}

// ── Hook utama ────────────────────────────────────────────────────────────────

export function useDeviceBind() {
  const [bindState, setBindState] = useState<BindState>(INITIAL_STATE);

  // ── Fungsi utama: proses QR scan result ──────────────────────────────────

  const processQRScan = useCallback(async (rawQRData: string) => {
    console.log(`📥 [useDeviceBind] processQRScan dipanggil dengan: "${rawQRData.substring(0, 80)}"`);

    // Step 1: Parse QR
    const deviceCode = parseQRResult(rawQRData);

    if (!deviceCode) {
      console.error(`❌ [useDeviceBind] QR parse gagal`);
      setBindState({
        phase:      'error',
        error:      'Format QR tidak valid. Pastikan Anda scan stiker QR yang benar pada device TC21.',
        deviceCode: null,
        message:    null,
      });
      return;
    }

    console.log(`✅ [useDeviceBind] device_code dari QR: "${deviceCode}"`);
    setBindState({ phase: 'validating', error: null, deviceCode, message: null });

    // Step 2: Load UUID dari storage
    const uuid = loadDeviceUUID();
    console.log(`🔑 [useDeviceBind] UUID dari storage: ${uuid ? uuid.substring(0, 12) + '...' : 'TIDAK ADA'}`);

    if (!uuid) {
      setBindState({
        phase:      'error',
        error:      'Device belum memiliki UUID. Coba restart aplikasi dan ulangi proses binding.',
        deviceCode: null,
        message:    null,
      });
      return;
    }

    // Step 3: Generate fingerprint + kumpulkan info platform TC21
    let fingerprintHash: string;
    let platform: string;
    let userAgent: string;
    let screenResolution: string;

    try {
      console.log(`🔬 [useDeviceBind] Generating fingerprint...`);
      const fp      = await generateFingerprint();
      fingerprintHash  = fp.hash;
      platform         = fp.components.platform;
      screenResolution = fp.components.screenResolution;
      userAgent        = (() => { try { return navigator.userAgent; } catch { return 'unknown'; } })();
      console.log(`✅ [useDeviceBind] Fingerprint: ${fingerprintHash.substring(0, 16)}... (method: ${fp.method})`);
      console.log(`📱 [useDeviceBind] Platform: "${platform}", UA: "${userAgent.substring(0, 50)}..."`);
    } catch (err) {
      console.error(`❌ [useDeviceBind] Fingerprint generation gagal:`, err);
      setBindState({
        phase:      'error',
        error:      'Gagal membaca informasi hardware device. Coba ulangi proses binding.',
        deviceCode: null,
        message:    null,
      });
      return;
    }

    // Step 4: Kirim ke server
    const requestBody = {
      device_code:       deviceCode,
      device_uuid:       uuid,
      fingerprint_hash:  fingerprintHash,
      platform,
      user_agent:        userAgent,
      screen_resolution: screenResolution,
    };

    console.log(`📤 [useDeviceBind] Mengirim ke POST /api/device/bind:`, {
      device_code:       requestBody.device_code,
      device_uuid:       requestBody.device_uuid.substring(0, 12) + '...',
      fingerprint_hash:  requestBody.fingerprint_hash.substring(0, 12) + '...',
      platform:          requestBody.platform,
      screen_resolution: requestBody.screen_resolution,
    });

    try {
      const response = await fetch('/e-checksheet-qa/api/device/bind', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(requestBody),
        credentials: 'same-origin',
      });

      console.log(`📬 [useDeviceBind] Response status: ${response.status} ${response.statusText}`);

      let data: DeviceBindResult;
      try {
        data = await response.json();
        console.log(`📬 [useDeviceBind] Response body:`, data);
      } catch (parseErr) {
        console.error(`❌ [useDeviceBind] Gagal parse JSON response:`, parseErr);
        setBindState({
          phase:      'error',
          error:      `Server mengembalikan response tidak valid (HTTP ${response.status}). Hubungi admin.`,
          deviceCode: null,
          message:    null,
        });
        return;
      }

      if (!data.success) {
        console.error(`❌ [useDeviceBind] Server menolak binding:`, data.error, data.message);
        setBindState({
          phase:      'error',
          error:      data.message ?? data.error ?? 'Binding gagal. Hubungi admin.',
          deviceCode: null,
          message:    null,
        });
        return;
      }

      // Step 5: Simpan ke binding-storage (terpisah dari storage existing)
      const bindingCache: PhysicalBindingCache = {
        device_code: data.device_code!,
        bound_at:    data.bound_at ?? new Date().toISOString(),
        device_uuid: uuid,
      };
      savePhysicalBinding(bindingCache);
      console.log(`💾 [useDeviceBind] Binding cache disimpan:`, bindingCache);

      // Step 6: Update DeviceIdentity di localStorage
      //
      // PENTING: Setelah bind, identity HARUS di-refresh agar DeviceGuard
      // tidak pakai cache stale. Caranya: set lastCheckedAt = null agar
      // isIdentityFresh() return false → DeviceGuard akan fetch ulang dari server
      // dengan UUID asli TC21, dan server akan return 'registered'.
      //
      // Juga update deviceCode, isBound, uuid, fingerprintHash.

      const existingIdentity = loadDeviceIdentity();
      if (existingIdentity) {
        const updatedIdentity = {
          ...existingIdentity,
          // Update ke UUID asli TC21 (bukan placeholder admin)
          uuid:            uuid,
          fingerprintHash: fingerprintHash,
          // Reset lastCheckedAt agar DeviceGuard re-fetch dari server
          // dengan UUID terbaru → tidak stuck di cache stale
          lastCheckedAt:   null,
          // Binding info
          deviceCode:      data.device_code!,
          isBound:         true,
          boundAt:         data.bound_at ?? new Date().toISOString(),
          // Info device dari server (jika ada)
          ...(data.device && {
            deviceName:   data.device.device_name,
            deviceLabel:  data.device.device_label,
            areaCode:     data.device.area_code,
            areaName:     data.device.area_name,
            shiftDefault: data.device.shift_default,
          }),
        };
        saveDeviceIdentity(updatedIdentity);
        console.log(`💾 [useDeviceBind] DeviceIdentity diupdate: uuid=${uuid.substring(0, 12)}..., isBound=true, lastCheckedAt=null (akan re-fetch)`);
      } else {
        console.warn(`⚠️ [useDeviceBind] Tidak ada existing identity di storage — skip update identity`);
      }

      console.log(`🎉 [useDeviceBind] BINDING SUKSES! device_code="${data.device_code}"`);
      setBindState({
        phase:      'success',
        error:      null,
        deviceCode: data.device_code!,
        message:    data.message,
      });

    } catch (err: any) {
      // Network error atau server tidak bisa dijangkau
      const isTimeout = err?.name === 'AbortError';
      console.error(`❌ [useDeviceBind] Network/fetch error:`, err?.name, err?.message);
      setBindState({
        phase:      'error',
        error:      isTimeout
          ? 'Koneksi timeout. Pastikan device terhubung ke jaringan dan coba lagi.'
          : `Tidak dapat menghubungi server (${err?.message ?? 'network error'}). Periksa koneksi dan coba lagi.`,
        deviceCode: null,
        message:    null,
      });
    }
  }, []);

  // ── Reset ke idle (untuk coba ulang) ──────────────────────────────────────

  const resetBind = useCallback(() => {
    console.log(`🔄 [useDeviceBind] Reset ke idle`);
    setBindState(INITIAL_STATE);
  }, []);

  return {
    bindState,
    processQRScan,
    resetBind,
    isValidating: bindState.phase === 'validating',
    isSuccess:    bindState.phase === 'success',
    isError:      bindState.phase === 'error',
  };
}