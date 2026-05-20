// middleware.ts
//
// ── KENAPA MIDDLEWARE INI DISEDERHANAKAN ─────────────────────────────────────
//
// Auth sistem aplikasi ini SEPENUHNYA client-side (localStorage + AuthProvider).
// Middleware Next.js berjalan di server/edge — TIDAK bisa membaca localStorage.
//
// Akibat middleware auth sebelumnya:
//   1. sessionToken dari localStorage tidak pernah ada di cookies
//   2. Semua request dianggap "unauthenticated" oleh middleware
//   3. Middleware redirect ke /login-page
//   4. Di TC21: DeviceGuard redirect ke /device-bind
//   5. Middleware redirect lagi ke /login-page → INFINITE LOOP
//
// Solusi: Lepas auth redirect dari middleware sepenuhnya.
// Proteksi route dilakukan di client-side oleh AuthProvider + per-page guard.
//
// ── APA YANG MASIH DILAKUKAN MIDDLEWARE INI ──────────────────────────────────
//
//   - Skip API routes, static files, dan assets (tidak perlu middleware logic)
//   - Semua route lain: NextResponse.next() — biarkan client yang handle auth
//
// ── REDIRECT FLOW YANG BENAR (CLIENT-SIDE) ───────────────────────────────────
//
//   TC21 (belum bind):
//     open app → DeviceGuard deteksi Android → isDeviceBound()=false
//     → redirect /device-bind → scan QR → bind sukses → redirect /
//     → AuthProvider: belum login → redirect /login-page → login → /home ✓
//
//   TC21 (sudah bind, belum login):
//     open app → DeviceGuard: isDeviceBound()=true → pass
//     → useDevice: fetch server → status registered → pass
//     → AuthProvider: tidak ada user → /login-page → login → /home ✓
//
//   Desktop admin:
//     open app → DeviceGuard: isAndroid=false → skip binding
//     → AuthProvider: tidak ada user → /login-page → login → /home ✓
//
//   Desktop admin (sudah login):
//     open app → DeviceGuard: skip → AuthProvider: ada user → render ✓

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, Next.js internals, dan static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Semua route lain: biarkan client-side auth (AuthProvider) yang handle.
  // Middleware tidak bisa baca localStorage — jangan coba cek auth di sini.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};