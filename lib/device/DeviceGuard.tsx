// lib/device/DeviceGuard.tsx

'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname }       from 'next/navigation';
import { useDevice }                    from './useDevice';
import { isDeviceBound }                from './binding-storage';
import { shouldRequirePhysicalBinding } from './platform-detect';
import type { DeviceStatus }            from './types';

// ── Halaman yang dikecualikan dari SEMUA device check ────────────────────────
//
// Path ini adalah onboarding/bootstrap pages.
// Mereka HARUS render tanpa useDevice(), tanpa server fetch, tanpa loading.
// Menambah path di sini berarti halaman tersebut sepenuhnya bebas dari guard.

const BINDING_EXEMPT_PATHS = [
  '/device-bind',
  '/device-blocked',
  '/device-inactive',
  '/device-not-registered',
];

// ── Helper: apakah status ini harus memblok akses? ───────────────────────────

function shouldBlockStatus(
  status:          DeviceStatus | null,
  requiresBinding: boolean,
): boolean {
  if (!status) return false;
  if (status === 'blocked')   return true;
  if (status === 'inactive')  return true;
  // not_found: blok hanya di TC21 yang belum bound
  if (status === 'not_found') return requiresBinding && !isDeviceBound();
  return false;
}

// ── Mapping status ke redirect path ──────────────────────────────────────────

function getRedirectPath(
  status:          DeviceStatus | null,
  requiresBinding: boolean,
): string | null {
  if (!status) return null;
  if (status === 'blocked')  return '/device-blocked';
  if (status === 'inactive') return '/device-inactive';
  if (status === 'not_found') {
    if (!requiresBinding) return null;   // desktop → allow
    if (isDeviceBound())  return null;   // sudah bound → jangan redirect ke bind lagi
    return '/device-bind';
  }
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DeviceGuardProps {
  children:         ReactNode;
  skip?:            boolean;
  loadingFallback?: ReactNode;
}

// ── Loading UI default ────────────────────────────────────────────────────────

function DefaultLoadingScreen() {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100dvh',
        width:          '100%',
        background:     '#f8f9fa',
        gap:            '16px',
        fontFamily:     'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width:        '40px',
          height:       '40px',
          border:       '3px solid #e0e0e0',
          borderTop:    '3px solid #1976d2',
          borderRadius: '50%',
          animation:    'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#555', fontSize: '14px', margin: 0 }}>
        Memverifikasi perangkat...
      </p>
    </div>
  );
}

// ── Inner Component 1: Exempt path ───────────────────────────────────────────
//
// Dirender HANYA saat pathname ada di BINDING_EXEMPT_PATHS.
//
// Tidak memanggil useDevice() — zero server fetch, zero loading state.
// Children dirender langsung tanpa kondisi apapun.
//
// Ini adalah kunci fix: React tidak memperbolehkan hook kondisional,
// tapi kita boleh kondisional MERENDER komponen yang berbeda.
// Komponen ini sama sekali tidak punya hook device.

function DeviceGuardExempt({ children }: { children: ReactNode }) {
  console.log('[DeviceGuard] Exempt path — skip all device checks, render langsung');
  // Tidak ada useDevice(), tidak ada useEffect device, tidak ada server fetch.
  // Render children sepenuhnya tanpa intervensi.
  return <>{children}</>;
}

// ── Inner Component 2: Active guard ──────────────────────────────────────────
//
// Dirender untuk semua route NON-exempt.
// Memanggil useDevice() dan menjalankan semua guard + redirect logic.
// Komponen ini tidak pernah dirender saat pathname adalah exempt path.

function DeviceGuardActive({
  children,
  loadingFallback,
}: {
  children:        ReactNode;
  loadingFallback: ReactNode;
}) {
  const router          = useRouter();
  const pathname        = usePathname();
  const { deviceState, isLoading } = useDevice();
  const requiresBinding = shouldRequirePhysicalBinding();

  // ── Redirect flag (anti-loop) ─────────────────────────────────────────────
  //
  // Mencegah router.replace() dipanggil berulang sebelum pathname update.
  // Direset setiap kali pathname berubah (navigation selesai).

  const isRedirectingRef = useRef(false);

  useEffect(() => {
    isRedirectingRef.current = false;
  }, [pathname]);

  function redirectOnce(path: string, reason: string) {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    console.warn(`[DeviceGuard] ${reason} → redirect ke ${path}`);
    router.replace(path);
  }

  // ── Effect: Binding check untuk TC21 ─────────────────────────────────────
  //
  // Jalan saat mount dan setiap kali phase berubah (setelah useDevice selesai).
  // Jika TC21 belum bound → redirect /device-bind.
  // Jika sudah bound → tidak redirect, biarkan useDevice selesai check server.
  //
  // Catatan: effect ini tidak perlu cek isExemptPath karena DeviceGuardActive
  // TIDAK PERNAH dirender saat pathname adalah exempt path (dihandle di root).

  useEffect(() => {
    if (!requiresBinding) return;
    if (!isDeviceBound()) {
      console.log(`[DeviceGuard] TC21 belum bound → redirect /device-bind`);
      redirectOnce('/device-bind', 'TC21 belum bound');
    }
    // Jika sudah bound → tidak redirect, biarkan useDevice check server ✓
  }, [requiresBinding, deviceState.phase]);

  // ── Effect: Status redirect setelah server check selesai ─────────────────

  useEffect(() => {
    if (deviceState.phase !== 'done' && deviceState.phase !== 'offline') return;

    const status = deviceState.status;
    console.log(
      `[DeviceGuard] Status check: phase="${deviceState.phase}", status="${status}", ` +
      `requiresBinding=${requiresBinding}, isBound=${isDeviceBound()}`
    );

    if (!shouldBlockStatus(status, requiresBinding)) return;

    const redirectPath = getRedirectPath(status, requiresBinding);
    if (!redirectPath) return;

    redirectOnce(
      redirectPath,
      `Status "${status}" (requiresBinding=${requiresBinding}, isBound=${isDeviceBound()})`,
    );
  }, [deviceState.phase, deviceState.status, requiresBinding]);

  // ── Render guard: TC21 belum bound ───────────────────────────────────────
  //
  // Tahan render sambil menunggu redirect ke /device-bind.
  // Setelah redirect selesai, pathname berubah ke /device-bind →
  // root DeviceGuard render DeviceGuardExempt, bukan DeviceGuardActive.

  if (requiresBinding && !isDeviceBound()) {
    console.log(`[DeviceGuard] Render guard: TC21 belum bound, menunggu redirect...`);
    return <>{loadingFallback}</>;
  }

  // ── Render guard: useDevice masih loading ─────────────────────────────────

  if (isLoading && deviceState.phase !== 'offline') {
    return <>{loadingFallback}</>;
  }

  // ── Render guard: status blocking (blocked / inactive) ───────────────────

  if (shouldBlockStatus(deviceState.status, requiresBinding)) {
    return <>{loadingFallback}</>;
  }

  // Semua check lulus → render app
  return <>{children}</>;
}

// ── Root Component ────────────────────────────────────────────────────────────
//
// Satu-satunya tugas: tentukan apakah pathname adalah exempt path atau tidak,
// lalu render komponen inner yang tepat.
//
// KRITIS: Pengecekan pathname dilakukan DI SINI sebelum komponen inner dirender.
// Ini yang memungkinkan DeviceGuardExempt tidak punya hook device sama sekali —
// karena dia komponen terpisah yang baru dimount saat dibutuhkan, bukan
// kondisi di dalam satu komponen yang selalu mount.
//
// Urutan keputusan:
//   1. skip=true          → render children langsung (prop override)
//   2. isExemptPath=true  → <DeviceGuardExempt>  (zero hooks, zero fetch)
//   3. else               → <DeviceGuardActive>   (full guard + useDevice)

export function DeviceGuard({
  children,
  skip             = false,
  loadingFallback  = <DefaultLoadingScreen />,
}: DeviceGuardProps) {
  const pathname = usePathname();

  // Prop override: skip semua guard
  if (skip) {
    return <>{children}</>;
  }

  // Cek exempt path SEBELUM render inner component apapun.
  // Ini memutuskan apakah useDevice() akan dipanggil atau tidak.
  const isExemptPath = BINDING_EXEMPT_PATHS.some(p => pathname?.startsWith(p));

  if (isExemptPath) {
    // Exempt path: /device-bind, /device-blocked, dll
    // → render tanpa device check, tanpa useDevice, tanpa server fetch
    return (
      <DeviceGuardExempt>
        {children}
      </DeviceGuardExempt>
    );
  }

  // Route normal → full guard dengan useDevice aktif
  return (
    <DeviceGuardActive loadingFallback={loadingFallback}>
      {children}
    </DeviceGuardActive>
  );
}