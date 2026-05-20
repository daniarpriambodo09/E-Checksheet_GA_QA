// lib/pwa/register.ts
//
// Script ini dipanggil dari layout root (app/layout.tsx) untuk:
//   1. Mendaftarkan Service Worker
//   2. Warm-up cache halaman penting setelah SW aktif
//
// CATATAN PENTING — Kenapa warm-up diperlukan:
//   `additionalManifestEntries` di next.config.mjs mendaftarkan URL ke
//   precache manifest, tetapi untuk App Router (Next.js 13+), entry tersebut
//   hanya berisi metadata URL — SW tidak otomatis melakukan fetch ke halaman
//   tersebut saat install.
//
//   Warm-up di sini melakukan fetch manual ke halaman-halaman penting
//   SETELAH SW terdaftar, sehingga response masuk ke `pages-cache`
//   (NetworkFirst cache). Dengan begitu, halaman tersedia di cache
//   sebelum pengguna pernah mengunjunginya.

const PAGES_TO_WARMUP = [
  "/home",
  "/checksheet-final-assy",
  "/status-final-assy",
];

// Delay antar fetch agar tidak membebani network sekaligus
const FETCH_DELAY_MS = 300;

async function warmupPageCache(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;

  for (let i = 0; i < PAGES_TO_WARMUP.length; i++) {
    const url = PAGES_TO_WARMUP[i];

    // Delay antar request
    if (i > 0) {
      await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
    }

    try {
      // Cek dulu apakah sudah ada di cache — jangan fetch ulang jika ada
      const cached = await caches.match(url, { ignoreSearch: true });
      if (cached) {
        console.log(`[PWA warmup] ✓ Already cached: ${url}`);
        continue;
      }

      // Fetch dengan mode "no-cors" tidak bisa dicache dengan benar —
      // gunakan fetch biasa agar response masuk ke NetworkFirst cache via SW.
      const res = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          // Tandai sebagai warmup request agar mudah diidentifikasi di logs
          "x-pwa-warmup": "1",
        },
      });

      if (res.ok) {
        console.log(`[PWA warmup] ✓ Fetched & cached: ${url}`);
      }
    } catch (err) {
      // Tidak perlu throw — warmup adalah best-effort
      console.log(`[PWA warmup] ✗ Skipped (offline or error): ${url}`);
    }
  }
}

export function registerPWA(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) {
    console.log("[PWA] Service Worker not supported");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log("[PWA] Service Worker registered:", registration.scope);

      // Warm-up setelah SW aktif
      // Tunggu SW controlling sebelum fetch agar request di-intercept oleh SW
      if (navigator.serviceWorker.controller) {
        // SW sudah aktif dari sebelumnya — langsung warmup
        warmupPageCache();
      } else {
        // SW baru install — tunggu controllerchange
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            console.log("[PWA] SW now controlling — starting warmup");
            warmupPageCache();
          },
          { once: true }
        );

        // Timeout fallback: jika controllerchange tidak fire dalam 3 detik
        setTimeout(() => {
          if (navigator.serviceWorker.controller) return; // sudah handle
          console.log("[PWA] Warmup timeout fallback triggered");
          warmupPageCache();
        }, 3000);
      }
    } catch (err) {
      console.error("[PWA] Service Worker registration failed:", err);
    }
  });
}