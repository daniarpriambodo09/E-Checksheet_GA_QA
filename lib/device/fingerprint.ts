// lib/device/fingerprint.ts
//
// Menghasilkan fingerprint_hash yang stabil dari karakteristik hardware device.
//
// Prinsip:
//   - Hanya menggunakan data yang STABIL — tidak berubah antar session/reboot
//   - Tidak menggunakan data yang volatile: waktu, IP, battery, dll
//   - Kompatibel dengan TC21 Zebra (Android WebView, tidak ada SubtleCrypto di non-HTTPS)
//   - Fallback ke hash sederhana jika SubtleCrypto tidak tersedia
//
// Data yang diambil (semua string statis dari browser):
//   platform + screenW + screenH + colorDepth + timezone + language + hardwareConcurrency
//
// Output: hex string 64 karakter (SHA-256) atau 32 karakter (fallback djb2)

// ── Tipe ─────────────────────────────────────────────────────────────────────

export interface FingerprintComponents {
  platform:            string;
  screenResolution:    string;   // "1280x720"
  colorDepth:          string;   // "24"
  timezone:            string;   // "Asia/Jakarta"
  language:            string;   // "id-ID"
  hardwareConcurrency: string;   // "4"
  pixelRatio:          string;   // "2"
}

export interface FingerprintResult {
  hash:       string;
  components: FingerprintComponents;
  method:     'sha256' | 'djb2';   // untuk debugging
}

// ── Kumpulkan komponen ────────────────────────────────────────────────────────

export function collectFingerprintComponents(): FingerprintComponents {
  // Semua akses ke navigator/screen dibungkus try-catch agar aman di WebView lama

  const platform = (() => {
    try { return navigator.platform || navigator.userAgent.substring(0, 50) || 'unknown'; }
    catch { return 'unknown'; }
  })();

  const screenResolution = (() => {
    try { return `${screen.width}x${screen.height}`; }
    catch { return '0x0'; }
  })();

  const colorDepth = (() => {
    try { return String(screen.colorDepth ?? screen.pixelDepth ?? 0); }
    catch { return '0'; }
  })();

  const timezone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { return 'UTC'; }
  })();

  const language = (() => {
    try { return navigator.language || (navigator as any).userLanguage || 'en'; }
    catch { return 'en'; }
  })();

  const hardwareConcurrency = (() => {
    try { return String(navigator.hardwareConcurrency ?? 1); }
    catch { return '1'; }
  })();

  const pixelRatio = (() => {
    try { return String(Math.round((window.devicePixelRatio ?? 1) * 10) / 10); }
    catch { return '1'; }
  })();

  return {
    platform,
    screenResolution,
    colorDepth,
    timezone,
    language,
    hardwareConcurrency,
    pixelRatio,
  };
}

// ── Hash via SubtleCrypto (SHA-256) — tersedia di HTTPS ──────────────────────

async function sha256Hash(input: string): Promise<string> {
  const encoder  = new TextEncoder();
  const data     = encoder.encode(input);
  const hashBuf  = await crypto.subtle.digest('SHA-256', data);
  const hashArr  = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Hash fallback djb2 — tidak butuh crypto, output 32 hex karakter ───────────
// Digunakan saat SubtleCrypto tidak tersedia (HTTP / WebView lama)

function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // Convert ke unsigned 32-bit agar tidak negatif
  }
  // Tambah second pass dengan seed berbeda untuk perpanjang output
  let hash2 = 52711;
  for (let i = input.length - 1; i >= 0; i--) {
    hash2 = ((hash2 << 5) + hash2) ^ input.charCodeAt(i);
    hash2 = hash2 >>> 0;
  }
  // Gabungkan dua hash jadi string 16 karakter hex, lalu ulangi untuk mencapai 32
  const part1 = hash.toString(16).padStart(8, '0');
  const part2 = hash2.toString(16).padStart(8, '0');
  const combined = part1 + part2;
  // Tambahkan versi reversed untuk mencapai 32 karakter
  return (combined + combined.split('').reverse().join('')).substring(0, 32);
}

// ── Cek ketersediaan SubtleCrypto ────────────────────────────────────────────

function isSubtleCryptoAvailable(): boolean {
  try {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.subtle.digest === 'function'
    );
  } catch {
    return false;
  }
}

// ── Fungsi utama: generate fingerprint ───────────────────────────────────────

export async function generateFingerprint(): Promise<FingerprintResult> {
  const components = collectFingerprintComponents();

  // Format string yang akan di-hash: urutan tetap, separator konsisten
  const raw = [
    `plat:${components.platform}`,
    `res:${components.screenResolution}`,
    `cd:${components.colorDepth}`,
    `tz:${components.timezone}`,
    `lang:${components.language}`,
    `cpu:${components.hardwareConcurrency}`,
    `dpr:${components.pixelRatio}`,
  ].join('|');

  if (isSubtleCryptoAvailable()) {
    try {
      const hash = await sha256Hash(raw);
      return { hash, components, method: 'sha256' };
    } catch {
      // Fall through ke djb2 jika SHA-256 error (misalnya di HTTP page dengan CORS)
    }
  }

  // Fallback: djb2 (synchronous, selalu tersedia)
  const hash = djb2Hash(raw);
  return { hash, components, method: 'djb2' };
}