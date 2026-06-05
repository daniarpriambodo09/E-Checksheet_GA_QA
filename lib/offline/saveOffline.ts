// lib/offline/saveOffline.ts
//
// Menyimpan hasil checklist ke IndexedDB saat offline.
//
// [OFFLINE PHOTO] Masalah blob URL:
//   blob:// URL hanya hidup selama tab browser terbuka.
//   Jika disimpan ke IndexedDB sebagai string blob URL, saat tab ditutup/reload
//   URL tersebut tidak bisa diakses lagi — foto hilang.
//
// Solusi: konversi blob URL → base64 data URL sebelum disimpan ke IndexedDB.
//   base64 data URL bisa disimpan sebagai string biasa dan tetap valid setelah reload.
//   Saat sync, string base64 dikonversi kembali ke File dan diupload ke server.

import { db } from './db';
import { generateUUID } from '@/lib/utils/uuid';

// ─── Blob URL → base64 data URL ───────────────────────────────────────────────

async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const res  = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader gagal konversi blob ke base64"));
    reader.readAsDataURL(blob);
  });
}

// ─── Normalisasi ngPhotos sebelum disimpan ────────────────────────────────────
// Terima: string[] | string | undefined
// Output: string[] — blob URL dikonversi ke base64, server URL dibiarkan

async function normalizePhotos(ngPhotos: any): Promise<string[]> {
  if (!ngPhotos) return [];

  const urls: string[] = Array.isArray(ngPhotos)
    ? ngPhotos.flat()
    : typeof ngPhotos === "string"
      ? [ngPhotos]
      : [];

  const result: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    if (url.startsWith("blob:")) {
      try {
        // Konversi blob → base64 sebelum disimpan agar survive reload
        const b64 = await blobUrlToBase64(url);
        result.push(b64);
        console.log(`[saveOffline] blob URL dikonversi ke base64 (${(b64.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.error("[saveOffline] Gagal konversi blob URL:", err);
        // Skip foto ini — lebih baik tidak ada foto dari pada crash
      }
    } else {
      // Server URL (sudah terupload online sebelumnya) — simpan langsung
      result.push(url);
    }
  }
  return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function saveChecklistOffline(endpoint: string, payload: any): Promise<void> {
  // Normalisasi ngPhotos: blob URL → base64
  const normalizedPayload = { ...payload };
  if (payload.ngPhotos !== undefined) {
    normalizedPayload.ngPhotos = await normalizePhotos(payload.ngPhotos);
  }

  const id = generateUUID();
  const data = {
    id,
    endpoint,
    payload: normalizedPayload,
    // [FIX] Simpan sebagai Boolean(false) eksplisit, bukan nilai truthy/falsy lainnya.
    // Beberapa browser menyimpan false sebagai 0 di IndexedDB, menyebabkan
    // strict filter `item.synced === false` di syncChecklist gagal mendeteksi item.
    synced: false as boolean,
    createdAt: Date.now(),
  };

  // [FIX] Gunakan put() bukan add() — put() bersifat upsert sehingga tidak
  // throw ConstraintError jika id sudah ada (race condition retry).
  await db.checklists.put(data);
  console.log(`[saveOffline] ✅ Checklist disimpan offline (id=${id}, endpoint=${endpoint})`);
}