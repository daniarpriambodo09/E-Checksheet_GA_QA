// lib/device/useDevice.ts
//
// React hook untuk device validation.
// Dipanggil SEKALI di root layout atau root component — bukan di setiap halaman.
//
// Prinsip:
//   - Minimal re-render: state hanya berubah saat phase atau status berubah signifikan
//   - Tidak menggunakan context — consumer langsung import hook ini
//   - Side effect (redirect) dilakukan di luar hook — caller yang memutuskan
//   - Aman untuk strict mode React (useEffect dijalankan dua kali di development)
//
// Usage:
//   const { deviceState, identity } = useDevice();
//   if (deviceState.phase === 'loading') return <Spinner />;
//   if (deviceState.status === 'blocked') router.push('/device-blocked');

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { initDevice, isIdentityFresh }               from './index';
import { loadDeviceIdentity }                        from './storage';
import type { DeviceState, DeviceIdentity, DeviceCheckOptions } from './types';

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: DeviceState = {
  identity: null,
  status:   null,
  phase:    'idle',
  error:    null,
  isReady:  false,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDevice(options: DeviceCheckOptions = {}) {
  const [deviceState, setDeviceState] = useState<DeviceState>(() => {
    // Inisialisasi state dengan cached identity jika ada
    // Ini mencegah flash kosong di awal render
    if (typeof window === 'undefined') return INITIAL_STATE;

    const cached = loadDeviceIdentity();
    if (cached && isIdentityFresh(cached)) {
      // Ada cache segar — langsung set state 'done' tanpa tunggu server
      // Server check tetap jalan di background via useEffect
      return {
        identity: cached,
        status:   'registered' as const,
        phase:    'done' as const,
        error:    null,
        isReady:  true,
      };
    }

    return INITIAL_STATE;
  });

  // Guard: jangan jalankan check lebih dari sekali dalam satu session
  const hasCheckedRef     = useRef(false);
  // Guard: jangan setState jika component sudah unmount (strict mode safety)
  const isMountedRef      = useRef(true);

  const runDeviceCheck = useCallback(async () => {
    // Skip jika sudah pernah check di session ini
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Set loading state — tapi hanya jika saat ini bukan 'done'
    // (agar tidak flash loading jika sudah ada cache segar)
    setDeviceState(prev => {
      if (prev.phase === 'done') return prev;
      return { ...prev, phase: 'loading' };
    });

    const result = await initDevice(options);

    // Jangan update state jika component sudah unmount
    if (!isMountedRef.current) return;

    setDeviceState(result);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // options sengaja tidak masuk deps — tidak ingin check ulang jika options berubah

  useEffect(() => {
    isMountedRef.current = true;

    // Jalankan check. Jika sudah ada cache segar, initDevice akan skip server check.
    runDeviceCheck();

    return () => {
      isMountedRef.current = false;
      // Catatan: TIDAK reset hasCheckedRef saat cleanup.
      // Ini sengaja — React strict mode menjalankan effect dua kali di dev,
      // dan kita tidak ingin check server dua kali.
    };
  }, [runDeviceCheck]);

  // ── Fungsi untuk force refresh (misalnya setelah user tekan "Coba Lagi") ──

  const retryCheck = useCallback(async () => {
    if (!isMountedRef.current) return;

    // Reset guard agar bisa check ulang
    hasCheckedRef.current = false;

    setDeviceState(prev => ({ ...prev, phase: 'loading', error: null }));

    const result = await initDevice({ ...options, skipIfCheckedThisSession: false });

    if (!isMountedRef.current) return;
    setDeviceState(result);

    // Set guard kembali setelah selesai
    hasCheckedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    deviceState,
    identity:  deviceState.identity,
    isLoading: deviceState.phase === 'loading' || deviceState.phase === 'idle',
    isReady:   deviceState.isReady,
    isOffline: deviceState.phase === 'offline',
    retryCheck,
  };
}