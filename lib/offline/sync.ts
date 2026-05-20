// lib/offline/sync.ts
// Support endpoint: /api/final-assy/save-result dan /api/pre-assy/save-result
// Setelah setiap item berhasil disync ke server, cache GET lokal diupdate
// agar halaman tidak perlu round-trip ke server saat refresh.
//
// [OFFLINE PHOTO SYNC]
// Jika ngPhotos berisi data URL (base64), gambar diupload ke /api/upload-image
// terlebih dahulu, lalu URL server menggantikan base64 di payload sebelum dikirim.

import { db } from './db';
import { getCache, saveCache } from './cache';

// ─── Helper: apakah string adalah base64 data URL gambar ─────────────────────
function isBase64Photo(url: string): boolean {
  return typeof url === "string" && url.startsWith("data:image/");
}

// ─── Upload satu base64 data URL ke server ────────────────────────────────────
async function uploadBase64Photo(dataUrl: string, index: number): Promise<string> {
  // Konversi data URL → Blob
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime      = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary    = atob(base64);
  const bytes     = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });

  const ext      = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1] || "jpg";
  const filename = `offline-sync-${Date.now()}-${index}.${ext}`;
  const file     = new File([blob], filename, { type: mime });

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload-image", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Upload foto gagal: HTTP ${res.status}`);

  const data = await res.json();
  if (!data.success || !data.url) throw new Error(`Upload foto: response tidak valid`);

  console.log(`[sync] foto offline terupload → ${data.url}`);
  return data.url as string;
}

// ─── Resolve semua base64 photos dalam payload → upload → ganti dengan URL ───
async function resolvePhotos(ngPhotos: any): Promise<string[]> {
  if (!ngPhotos) return [];
  const urls: string[] = Array.isArray(ngPhotos) ? ngPhotos : [ngPhotos];
  const resolved: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    if (isBase64Photo(url)) {
      try {
        const serverUrl = await uploadBase64Photo(url, i);
        resolved.push(serverUrl);
      } catch (err) {
        console.error(`[sync] Gagal upload foto offline[${i}]:`, err);
        // Skip foto yang gagal — jangan batalkan seluruh sync
      }
    } else {
      // Sudah berupa server URL — langsung pakai
      resolved.push(url);
    }
  }
  return resolved;
}

// ─── Helper: buat cacheKey yang konsisten ─────────────────────────────────────

function buildPreAssyCacheKey(payload: any): string | null {
  const { categoryCode, areaCode, shift, dateKey, conveyor, specificArea } = payload;
  if (!categoryCode || !areaCode || !shift || !dateKey) return null;
  const conveyorNorm     = (conveyor || 'default').toString().trim().toUpperCase();
  const specificAreaNorm = (typeof specificArea === 'string' && specificArea.trim())
    ? specificArea.trim() : 'all';
  return `pre-assy-${categoryCode}-${areaCode}-${shift}-${dateKey}-${conveyorNorm}-${specificAreaNorm}`;
}

function buildFinalAssyCacheKey(payload: any): string | null {
  const { areaCode, shift, dateKey, conveyor, specificArea } = payload;
  if (!areaCode || !shift || !dateKey) return null;
  const locationKey      = (conveyor || 'default').toString().trim().toUpperCase() || 'default';
  const specificAreaNorm = (typeof specificArea === 'string' && specificArea.trim())
    ? specificArea.trim() : 'all';
  return `checklist-results-${areaCode}-${shift}-${dateKey}-${specificAreaNorm}-${locationKey}`;
}

function buildItemKey(payload: any, endpoint: string): string {
  const { categoryCode, itemId, shift, specificArea, timeSlot } = payload;

  if (endpoint.includes('final-assy')) {
    if (categoryCode === 'final-assy-inspector') {
      const spec = (typeof specificArea === 'string' && specificArea.trim())
        ? specificArea.trim() : 'WP CHECK';
      return `${itemId}-${spec}-${shift}`;
    }
    return `${itemId}-${shift}`;
  }

  if (categoryCode === 'pre-assy-daily-check-ins') {
    const spec = (typeof specificArea === 'string' && specificArea.trim())
      ? specificArea.trim() : 'TENSILE';
    return `${itemId}-${spec}-${shift}`;
  }
  if (categoryCode === 'pre-assy-cc-stripping-gl') {
    return timeSlot ? `${itemId}-${shift}-${timeSlot}` : `${itemId}-${shift}`;
  }
  return `${itemId}-${shift}`;
}

// ─── Update cache setelah 1 item berhasil disync ──────────────────────────────

async function updateCacheAfterSync(payload: any, endpoint: string): Promise<void> {
  try {
    const { itemId, status, ngDescription, ngPhotos, shift, dateKey } = payload;
    if (!itemId || !status || !shift || !dateKey) return;

    const isPreAssy   = endpoint.includes('pre-assy');
    const isFinalAssy = endpoint.includes('final-assy');
    if (!isPreAssy && !isFinalAssy) return;

    const cacheKey = isPreAssy
      ? buildPreAssyCacheKey(payload)
      : buildFinalAssyCacheKey(payload);
    if (!cacheKey) return;

    const existing = await getCache(cacheKey);
    const base =
      existing && existing.success && existing.formatted
        ? { ...existing, formatted: { ...existing.formatted } }
        : { success: true, formatted: {} };

    if (!base.formatted[dateKey]) base.formatted[dateKey] = {};

    const entryKey = buildItemKey(payload, endpoint);

    const ngPhotosStr = Array.isArray(ngPhotos) && ngPhotos.length > 0
      ? JSON.stringify(ngPhotos)
      : null;

    const existing_entry = base.formatted[dateKey][entryKey];
    if (existing_entry && existing_entry.status === status) {
      if (ngPhotosStr && !existing_entry.ngPhotos) {
        base.formatted[dateKey][entryKey] = { ...existing_entry, ngPhotos: ngPhotosStr };
      }
    } else {
      base.formatted[dateKey][entryKey] = {
        status,
        ngDescription: ngDescription || '',
        ngPhotos:      ngPhotosStr,
        ngDepartment:  status === 'NG' ? 'QA' : null,
      };
    }

    await saveCache(cacheKey, base);
    console.log(`[sync] cache updated key=${entryKey} cacheKey=${cacheKey}`);
  } catch (err) {
    console.log('[sync] cache update after sync failed (non-fatal):', err);
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function syncChecklist(): Promise<void> {
  console.log('[syncChecklist] Starting sync process');

  try {
    const allChecklists    = await db.checklists.toArray();
    const unsyncedChecklists = allChecklists.filter(item => item.synced === false);
    console.log('[syncChecklist] Unsynced items found:', unsyncedChecklists.length);

    for (const item of unsyncedChecklists) {
      try {
        console.log('[syncChecklist] Syncing item', item.id, 'to', item.endpoint);

        // [OFFLINE PHOTO] Upload base64 photos terlebih dahulu
        // Ganti base64 strings di payload.ngPhotos dengan server URL
        let resolvedPayload = item.payload;
        if (
          item.payload.ngPhotos &&
          Array.isArray(item.payload.ngPhotos) &&
          item.payload.ngPhotos.some(isBase64Photo)
        ) {
          console.log('[syncChecklist] Uploading offline photos for item', item.id);
          const resolvedPhotos = await resolvePhotos(item.payload.ngPhotos);
          resolvedPayload = { ...item.payload, ngPhotos: resolvedPhotos };
          // Simpan URL yang sudah ter-resolve ke DB agar retry berikutnya
          // tidak upload ulang foto yang sama
          await db.checklists.update(item.id, { payload: resolvedPayload });
        }

        const response = await fetch(item.endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(resolvedPayload),
        });

        if (!response.ok) {
          console.log('[syncChecklist] Failed to sync item', item.id, 'status:', response.status);
          continue;
        }

        console.log('[syncChecklist] Successfully synced item', item.id);
        await db.checklists.update(item.id, { synced: true });

        // Update cache GET lokal setelah sync berhasil
        await updateCacheAfterSync(resolvedPayload, item.endpoint);

      } catch (error) {
        console.log('[syncChecklist] Error syncing item', item.id, error);
        // Keep item for future retry
      }
    }
  } catch (error) {
    console.error('[syncChecklist] Error accessing database:', error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offlineSyncCompleted'));
  }

  console.log('[syncChecklist] Sync process completed');
}