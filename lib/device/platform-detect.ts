// lib/device/platform-detect.ts
//
// Helper untuk mendeteksi apakah device saat ini adalah
// "production mobile device" yang wajib Physical Device Binding.
//
// Prinsip:
//   - Desktop / laptop / PC admin → bypass binding
//   - Android mobile / TC21 handheld → binding required
//
// Strategi deteksi (berlapis, dari yang paling reliable):
//   1. Screen width  < MOBILE_MAX_WIDTH  → indikasi mobile
//   2. userAgent     mengandung Android  → konfirmasi mobile
//   3. Touch support sebagai tiebreaker
//
// Mengapa TIDAK menggunakan satu sinyal saja:
//   - userAgent bisa di-spoof, tapi tidak dikombinasikan dgn screen width
//   - Screen width saja bisa salah (browser di-resize ke narrow)
//   - Kombinasi dua sinyal memperketat false positive
//
// TC21 Zebra profile:
//   - userAgent: "... Android ... Mobile ..."
//   - screen.width: 480px (portrait) atau 800px (landscape)
//   - maxTouchPoints: >= 1
//
// Desktop/laptop profile:
//   - userAgent: "... Windows/Mac/Linux ..."
//   - screen.width: >= 1024px (biasanya 1366–2560px)
//   - maxTouchPoints: 0 (kebanyakan)
//
// iPad / tablet dengan lebar besar sengaja TIDAK di-force binding
// karena lebih mirip laptop dari sisi operasional admin.

// ── Konstanta ─────────────────────────────────────────────────────────────────

// Layar lebih lebar dari ini dianggap desktop/laptop
// TC21: max ~800px landscape. Tablet admin biasanya 1024px+.
const MOBILE_MAX_SCREEN_WIDTH = 900;

// ── UA patterns yang mengindikasikan mobile OS ────────────────────────────────
// Tidak perlu exhaustive — fokus pada OS yang dipakai TC21 (Android)
const MOBILE_UA_PATTERNS = [
  /Android/i,
  /iPhone/i,
  /iPod/i,
  // Tambahkan pola lain jika ada device mobile lain di environment ini
];

// ── Fungsi deteksi ─────────────────────────────────────────────────────────────

/**
 * Deteksi apakah kode ini berjalan di browser (bukan SSR).
 * DeviceGuard adalah 'use client' tapi fungsi ini bisa dipanggil dari mana saja.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

/**
 * Apakah screen width mengindikasikan mobile device?
 * Menggunakan screen.width (ukuran fisik layar), bukan window.innerWidth
 * yang bisa berubah saat browser di-resize.
 */
function hasMobileScreenWidth(): boolean {
  try {
    return screen.width <= MOBILE_MAX_SCREEN_WIDTH;
  } catch {
    return false;
  }
}

/**
 * Apakah userAgent mengindikasikan mobile OS?
 */
function hasMobileUserAgent(): boolean {
  try {
    const ua = navigator.userAgent;
    return MOBILE_UA_PATTERNS.some((pattern) => pattern.test(ua));
  } catch {
    return false;
  }
}

/**
 * Apakah device memiliki touch screen?
 * Digunakan sebagai tiebreaker — bukan sinyal utama.
 */
function hasTouchScreen(): boolean {
  try {
    return navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}

/**
 * Tentukan apakah device saat ini adalah "production mobile device"
 * yang wajib Physical Device Binding.
 *
 * ── STRATEGI DETEKSI (DISEDERHANAKAN) ────────────────────────────────────────
 *
 * Sebelumnya: screen width AND Android UA → terlalu ketat.
 * Masalah: TC21 Zebra kadang punya resolusi besar (720p, 1080p) sehingga
 * hasMobileScreenWidth() return false → binding di-skip → stuck loading.
 *
 * Sekarang: cukup cek Android UA saja.
 * Alasan:
 *   - TC21 Zebra SELALU punya "Android" di userAgent
 *   - Desktop/laptop Windows & Mac TIDAK punya "Android" di userAgent
 *   - Sederhana, stabil, tidak bergantung resolusi layar
 *
 * Edge case yang disengaja di-accept:
 *   - Android tablet admin yang buka browser → akan kena binding check.
 *     Ini acceptable — admin menggunakan PC/laptop, bukan Android tablet.
 *   - Desktop Chrome dengan DevTools mobile emulation → kena binding.
 *     Ini OK untuk dev — tinggal disable emulation atau pakai skip=true di guard.
 */
export function isProductionMobileDevice(): boolean {
  if (!isBrowser()) {
    console.log('[PlatformDetect] SSR — return false (server side)');
    return false;
  }

  const ua          = (() => { try { return navigator.userAgent; } catch { return ''; } })();
  const isAndroid   = /Android/i.test(ua);
  const screenW     = (() => { try { return screen.width;  } catch { return -1; } })();
  const screenH     = (() => { try { return screen.height; } catch { return -1; } })();
  const touchPoints = (() => { try { return navigator.maxTouchPoints; } catch { return -1; } })();

  console.log('[PlatformDetect] Detection result:', {
    userAgent:       ua.substring(0, 100),
    isAndroid,
    screenWidth:     screenW,
    screenHeight:    screenH,
    maxTouchPoints:  touchPoints,
    requiresBinding: isAndroid,
  });

  // Satu sinyal sudah cukup: Android UA = TC21/mobile = wajib binding
  return isAndroid;
}

/**
 * Alias yang lebih ekspresif untuk dipakai di DeviceGuard.
 * Mengembalikan true jika device ini wajib Physical Device Binding.
 *
 * Usage:
 *   if (shouldRequirePhysicalBinding()) {
 *     // cek isDeviceBound(), redirect ke /device-bind jika perlu
 *   }
 */
export function shouldRequirePhysicalBinding(): boolean {
  return isProductionMobileDevice();
}

/**
 * Debug info — untuk logging saat development.
 * Tidak dipakai di production logic.
 */
export function getPlatformDebugInfo(): Record<string, unknown> {
  if (!isBrowser()) return { env: 'server' };
  return {
    screenWidth:         screen.width,
    screenHeight:        screen.height,
    userAgent:           navigator.userAgent.substring(0, 80) + '...',
    maxTouchPoints:      navigator.maxTouchPoints,
    mobileScreen:        hasMobileScreenWidth(),
    mobileUA:            hasMobileUserAgent(),
    touchScreen:         hasTouchScreen(),
    requiresBinding:     shouldRequirePhysicalBinding(),
  };
}