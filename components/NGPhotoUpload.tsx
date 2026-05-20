// components/NGPhotoUpload.tsx
//
// ═══════════════════════════════════════════════════════════════════════════════
// ARSITEKTUR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Masalah yang diselesaikan:
//   ❌ File kamera asli bisa 4–10 MB  → API reject atau timeout
//   ❌ Validasi size di client langsung reject sebelum kompres
//   ❌ Preview tidak muncul saat upload error
//
// Solusi:
//   1. Kompresi Canvas API (tanpa library eksternal) — jalankan SEBELUM upload
//   2. Target: ≤ 1 MB, max dimensi 1280px, quality iteratif 0.80→0.65→0.50
//   3. blobUrl dibuat dari file ASLI → preview instan, tidak tunggu kompres
//   4. Setelah kompres selesai, blob preview diganti dengan compressedBlobUrl
//   5. Upload ke server hanya file hasil kompresi
//
// Flow per capture:
//   [kamera] → [file asli] → [blobUrl preview SEGERA]
//             → [compressImage()] → [compressedBlob]
//             → [ganti blobUrl ke compressedBlobUrl]
//             → [uploadToServer(compressedBlob)]
//             → [serverUrl → onPhotosChange]
//
// State dua lapis:
//   entries[]   — state internal, sumber kebenaran UI
//   props.photos — array serverUrl, dikelola parent, hanya diupdate post-upload
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";

// ─── Konfigurasi kompresi ─────────────────────────────────────────────────────

const COMPRESS_CONFIG = {
  /** Panjang sisi terpanjang maksimal (px) */
  maxDimension: 1280,
  /** Ukuran target setelah kompresi (bytes) — 1 MB */
  targetSizeBytes: 1 * 1024 * 1024,
  /** Batas akhir yang masih diterima server — 2 MB */
  hardLimitBytes: 2 * 1024 * 1024,
  /** Langkah kualitas yang dicoba: mulai dari paling baik */
  qualitySteps: [0.80, 0.65, 0.50, 0.35],
  /** Output MIME type */
  outputMime: "image/jpeg",
} as const;

// ─── Fungsi kompresi (Canvas API, tanpa library) ──────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  const { maxDimension, targetSizeBytes, hardLimitBytes, qualitySteps, outputMime } = COMPRESS_CONFIG;

  if (file.size <= targetSizeBytes && file.type === outputMime) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = async () => {
        try {
          const bm = await createImageBitmap(img);
          URL.revokeObjectURL(objUrl);
          resolve(bm);
        } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("Gagal decode gambar")); };
      img.src = objUrl;
    });
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  let dstW = srcW;
  let dstH = srcH;

  if (srcW > maxDimension || srcH > maxDimension) {
    const ratio = Math.min(maxDimension / srcW, maxDimension / srcH);
    dstW = Math.round(srcW * ratio);
    dstH = Math.round(srcH * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width  = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close();

  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(canvas, outputMime, quality);
    if (blob.size <= targetSizeBytes) {
      console.log(
        `[compress] ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB` +
        ` (${dstW}×${dstH} q=${quality})`
      );
      return blob;
    }
    if (blob.size <= hardLimitBytes) {
      console.log(
        `[compress] ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB` +
        ` (${dstW}×${dstH} q=${quality}, melebihi target tapi di bawah hard limit)`
      );
      return blob;
    }
  }

  const fallback = await canvasToBlob(canvas, outputMime, qualitySteps[qualitySteps.length - 1]);
  if (fallback.size > hardLimitBytes) {
    throw new Error(
      `Gambar terlalu besar (${(fallback.size / 1024 / 1024).toFixed(1)} MB) ` +
      `setelah kompresi. Coba foto dengan resolusi lebih rendah.`
    );
  }
  return fallback;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas.toBlob gagal menghasilkan blob."));
      },
      mime,
      quality
    );
  });
}

// ─── Upload ke server ─────────────────────────────────────────────────────────

// [FIX] Validasi URL server sebelum diterima sebagai hasil upload.
// Hanya izinkan path relatif yang dimulai /uploads/... (bukan blob:, data:, dsb)
function isValidServerUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;
  // data URL → tidak pernah valid sebagai server URL
  if (url.startsWith("data:")) return false;
  // blob: URL diterima sebagai "local offline photo" — akan diupload saat sync
  if (url.startsWith("blob:")) return true;
  // Path server normal
  if (
    url.startsWith("/api/uploads/") ||
    url.startsWith("/uploads/") ||
    /^https?:\/\//.test(url)
  ) return true;
  return false;
}

/** Foto sudah ter-upload ke server (bukan hanya tersimpan lokal offline) */
function isUploadedServerUrl(url: string): boolean {
  return (
    url.startsWith("/api/uploads/") ||
    url.startsWith("/uploads/") ||
    /^https?:\/\//.test(url)
  );
}

async function uploadToServer(blob: Blob, originalName: string): Promise<string> {
  const ext  = COMPRESS_CONFIG.outputMime.split("/")[1];
  const name = originalName.replace(/\.[^.]+$/, "") + "." + ext;
  const file = new File([blob], name, { type: COMPRESS_CONFIG.outputMime });

  const fd = new FormData();
  fd.append("file", file);

  console.log(`[upload] Memulai upload: ${name} (${(blob.size / 1024).toFixed(0)} KB)`);

  // [FIX] Gunakan try/catch ketat & log status HTTP agar debug mudah
  let res: Response;
  try {
    res = await fetch("/api/upload-image", { method: "POST", body: fd });
  } catch (networkErr: any) {
    console.error("[upload] Network error:", networkErr);
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi jaringan.");
  }

  console.log(`[upload] Response: HTTP ${res.status} (${res.statusText})`);

  // [FIX] Selalu parse body terlepas dari status agar pesan error server terbaca
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // Body bukan JSON (misal: HTML error page dari Next.js)
    throw new Error(`Upload gagal (HTTP ${res.status}). Server tidak mengembalikan JSON.`);
  }

  if (!res.ok) {
    const msg = data?.error ?? `Upload gagal (HTTP ${res.status})`;
    console.error("[upload] Server error:", data);
    throw new Error(msg);
  }

  // [FIX] Validasi URL yang dikembalikan server sebelum dipakai
  if (!isValidServerUrl(data.url)) {
    console.error("[upload] URL tidak valid dari server:", data);
    throw new Error(
      `Server mengembalikan URL tidak valid: "${data.url ?? "(kosong)"}". ` +
      `Pastikan folder public/uploads/checksheet dapat diakses.`
    );
  }

  const serverUrl = normalizePhotoUrl(data.url as string);
  console.log(`[upload] ✅ Berhasil → ${serverUrl} (${(data.size / 1024).toFixed(0)} KB)`);
  return serverUrl;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadStatus = "compressing" | "uploading" | "done" | "error";

// [FIX] normalizePhotoUrl: strip /public prefix jika ada, pastikan path mulai /.
// Tidak mengubah /api/uploads/... maupun /uploads/... — keduanya sudah benar.
// Blob & data URL dikembalikan apa adanya (hanya untuk preview lokal).
function normalizePhotoUrl(url: string): string {
  if (!url) return url;
  // Blob & data URL → kembalikan apa adanya (untuk preview, BUKAN untuk serverUrl)
  if (url.startsWith("blob:")) return url;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("//")) return url;
  // [FIX] Strip /public/ prefix — Next.js serve dari /public sebagai root
  const cleaned = url.replace(/^\/public\//, "/").replace(/^public\//, "/");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

interface PhotoEntry {
  id: string;
  blobUrl: string;
  compressedBlobUrl: string | null;
  originalName: string;
  serverUrl: string | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  compressInfo: string | null;
}

export interface NGPhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onPhotoClick?: (url: string) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

// ─── Komponen utama ───────────────────────────────────────────────────────────

export default function NGPhotoUpload({
  photos,
  onPhotosChange,
  onPhotoClick,
  maxPhotos = 3,
  disabled = false,
}: NGPhotoUploadProps) {
  const [entries, setEntries] = useState<PhotoEntry[]>(() =>
    photos
      // [FIX] Filter hanya URL server yang valid saat inisialisasi dari props
      .filter(isValidServerUrl)
      .map((url) => {
        const normalizedUrl = normalizePhotoUrl(url);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          blobUrl: normalizedUrl,
          compressedBlobUrl: normalizedUrl,
          originalName: "restored",
          serverUrl: normalizedUrl,
          uploadStatus: "done" as UploadStatus,
          uploadError: null,
          compressInfo: null,
        };
      })
  );

  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Sinkronisasi entries → parent ─────────────────────────────────────────
  // [FIX] Hanya emit serverUrl yang valid (bukan blob, bukan null)
  const prevEmittedRef = useRef("");
  useEffect(() => {
    const serverUrls = entries
      .filter((e) => e.uploadStatus === "done" && e.serverUrl && isValidServerUrl(e.serverUrl))
      .map((e) => e.serverUrl as string);
    const key = JSON.stringify(serverUrls);
    if (key !== prevEmittedRef.current) {
      prevEmittedRef.current = key;
      onPhotosChange(serverUrls);
    }
  }, [entries, onPhotosChange]);

  // ── Cleanup blob URLs saat unmount ────────────────────────────────────────
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    return () => {
      entriesRef.current.forEach((e) => {
        if (e.blobUrl.startsWith("blob:"))           URL.revokeObjectURL(e.blobUrl);
        if (e.compressedBlobUrl?.startsWith("blob:")) URL.revokeObjectURL(e.compressedBlobUrl);
      });
    };
  }, []);

  useEffect(() => {
    setEntries((prev) => {
      const hasPending = prev.some((entry) => entry.uploadStatus !== "done");
      if (hasPending) return prev;

      const prevUrls = prev
        .filter((entry) => entry.uploadStatus === "done" && entry.serverUrl)
        .map((entry) => entry.serverUrl as string);
      // [FIX] Filter incoming URLs — tolak yang tidak valid
      const incomingUrls = photos.filter(isValidServerUrl);
      const same = prevUrls.length === incomingUrls.length && prevUrls.every((url, idx) => url === incomingUrls[idx]);
      if (same) return prev;

      return incomingUrls.map((url) => {
        const normalizedUrl = normalizePhotoUrl(url);
        const matched = prev.find((entry) => entry.serverUrl === normalizedUrl);
        return matched
          ? {
              ...matched,
              blobUrl: normalizedUrl,
              compressedBlobUrl: normalizedUrl,
              originalName: matched.originalName || "restored",
              serverUrl: normalizedUrl,
              uploadStatus: "done" as UploadStatus,
              uploadError: null,
              compressInfo: null,
            }
          : {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              blobUrl: normalizedUrl,
              compressedBlobUrl: normalizedUrl,
              originalName: "restored",
              serverUrl: normalizedUrl,
              uploadStatus: "done" as UploadStatus,
              uploadError: null,
              compressInfo: null,
            };
      });
    });
  }, [photos]);

  const canAddMore = entries.length < maxPhotos && !disabled;

  // ── Handler utama: capture dari kamera ────────────────────────────────────
  const handleCapture = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      e.target.value = "";

      if (!file) return;

      const rawBlobUrl = URL.createObjectURL(file);
      const entryId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const newEntry: PhotoEntry = {
        id: entryId,
        blobUrl: rawBlobUrl,
        compressedBlobUrl: null,
        originalName: file.name || "photo.jpg",
        serverUrl: null,
        uploadStatus: "compressing",
        uploadError: null,
        compressInfo: null,
      };

      setEntries((prev) => {
        if (prev.length >= maxPhotos) {
          URL.revokeObjectURL(rawBlobUrl);
          return prev;
        }
        return [...prev, newEntry];
      });

      // ── Kompres ───────────────────────────────────────────────────────────
      let compressedBlob: Blob;
      let compressedBlobUrl: string | null = null;
      let compressInfo = "";
      try {
        compressedBlob = await compressImage(file);
        compressedBlobUrl = URL.createObjectURL(compressedBlob);

        compressInfo =
          file.size !== compressedBlob.size
            ? `${(file.size / 1024).toFixed(0)}KB → ${(compressedBlob.size / 1024).toFixed(0)}KB`
            : `${(file.size / 1024).toFixed(0)}KB`;

        setEntries((prev) =>
          prev.map((en) =>
            en.id === entryId
              ? { ...en, compressedBlobUrl, uploadStatus: "uploading", compressInfo }
              : en
          )
        );

        URL.revokeObjectURL(rawBlobUrl);

      } catch (compressErr: any) {
        console.error("[compress] Error:", compressErr);
        setEntries((prev) =>
          prev.map((en) =>
            en.id === entryId
              ? {
                  ...en,
                  uploadStatus: "error",
                  uploadError: `Gagal memproses gambar: ${compressErr.message ?? "Unknown error"}`,
                }
              : en
          )
        );
        return;
      }

      if (!compressedBlobUrl) {
        setEntries((prev) =>
          prev.map((en) =>
            en.id === entryId
              ? { ...en, uploadStatus: "error", uploadError: "Gagal membuat preview gambar." }
              : en
          )
        );
        return;
      }

      // ── Upload / Offline local save ───────────────────────────────────────
      if (!navigator.onLine) {
        // Offline: simpan blob URL sebagai serverUrl sementara.
        // Saat sync, blob:// URL akan dideteksi, diupload ke server, lalu diganti.
        console.log("[upload] Offline — foto disimpan lokal, akan diupload saat online.");
        setEntries((prev) =>
          prev.map((en) =>
            en.id === entryId && en.uploadStatus === "uploading"
              ? {
                  ...en,
                  // compressedBlobUrl dipakai sebagai serverUrl sementara
                  serverUrl: compressedBlobUrl,
                  uploadStatus: "done",
                  compressInfo: (en.compressInfo ?? "") + " 📴lokal",
                }
              : en
          )
        );
        return;
      }

      try {
        const serverUrl = await uploadToServer(compressedBlob, file.name || "photo.jpg");

        if (!isValidServerUrl(serverUrl)) {
          throw new Error(`URL hasil upload tidak valid: "${serverUrl}"`);
        }

        setEntries((prev) =>
          prev.map((en) =>
            en.id === entryId && en.uploadStatus === "uploading"
              ? { ...en, serverUrl, uploadStatus: "done" }
              : en
          )
        );

      } catch (uploadErr: any) {
        console.error("[upload] Gagal:", uploadErr);
        setEntries((prev) =>
          prev.map((en) =>
            en.id === entryId && en.uploadStatus === "uploading"
              ? {
                  ...en,
                  uploadStatus: "error",
                  uploadError: uploadErr.message ?? "Upload gagal. Coba lagi.",
                }
              : en
          )
        );
      }
    },
    [maxPhotos]
  );

  // ── Hapus foto ────────────────────────────────────────────────────────────
  const handleDelete = useCallback((idx: number) => {
    setDeletingIdx(idx);
    setTimeout(() => {
      setEntries((prev) => {
        const removed = prev[idx];
        if (removed?.blobUrl.startsWith("blob:"))
          URL.revokeObjectURL(removed.blobUrl);
        if (removed?.compressedBlobUrl?.startsWith("blob:"))
          URL.revokeObjectURL(removed.compressedBlobUrl);
        return prev.filter((_, i) => i !== idx);
      });
      setDeletingIdx(null);
    }, 180);
  }, []);

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(async (idx: number) => {
    handleDelete(idx);
    setTimeout(() => inputRef.current?.click(), 250);
  }, [handleDelete]);

  // ── Klik foto → zoom ──────────────────────────────────────────────────────
  const handlePhotoClick = useCallback(
    (entry: PhotoEntry) => {
      if (!onPhotoClick) return;
      const url = entry.serverUrl ?? entry.compressedBlobUrl ?? entry.blobUrl;
      if (url) onPhotoClick(url);
    },
    [onPhotoClick]
  );

  // ── Fallback SVG saat image gagal load ────────────────────────────────────
  // [FIX] Tampilkan pesan lebih informatif dan badge warna berbeda untuk error server
  const handleImageError = useCallback(
    (ev: React.SyntheticEvent<HTMLImageElement>, entry: PhotoEntry) => {
      const img = ev.currentTarget as HTMLImageElement;
      // Hindari infinite loop jika fallback sendiri gagal
      img.onerror = null;

      const isServerUrl = entry.serverUrl && isValidServerUrl(entry.serverUrl);
      const label = isServerUrl
        ? "Gagal%20muat%0A(404%3F)"  // URL server ada tapi gambar tidak bisa dimuat
        : "No%20Preview";

      img.src =
        `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E` +
        `%3Crect fill='%23fef2f2' width='80' height='80'/%3E` +
        `%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' ` +
        `fill='%23ef4444' font-size='9' font-family='sans-serif'%3E${label}%3C/text%3E%3C/svg%3E`;

      // [FIX] Jika status "done" tapi image 404 → ubah ke error agar user tahu
      if (entry.uploadStatus === "done" && isServerUrl) {
        setEntries((prev) =>
          prev.map((en) =>
            en.id === entry.id
              ? {
                  ...en,
                  uploadStatus: "error",
                  uploadError:
                    `File tidak ditemukan di server (404). ` +
                    `URL: ${entry.serverUrl}. ` +
                    `Kemungkinan server restart / folder uploads hilang.`,
                }
              : en
          )
        );
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ngpu-root">

      {/* ── Grid preview foto ── */}
      {entries.length > 0 && (
        <div className="ngpu-grid">
          {entries.map((entry, i) => {
            const isDeleting    = deletingIdx === i;
            const isCompressing = entry.uploadStatus === "compressing";
            const isUploading   = entry.uploadStatus === "uploading";
            const isError       = entry.uploadStatus === "error";
            const isBusy        = isCompressing || isUploading;

            // [FIX] Saat done → pakai serverUrl (path publik yang bisa diakses browser)
            //        Saat masih proses → pakai compressedBlobUrl / blobUrl (preview lokal)
            const displayUrl =
              entry.uploadStatus === "done" && entry.serverUrl
                ? normalizePhotoUrl(entry.serverUrl)
                : normalizePhotoUrl(
                    entry.compressedBlobUrl ?? entry.blobUrl
                  );

            return (
              <div
                key={`photo-${entry.id}`}
                className={[
                  "ngpu-item",
                  isDeleting    ? "is-deleting"    : "",
                  isCompressing ? "is-compressing" : "",
                  isUploading   ? "is-uploading"   : "",
                  isError       ? "is-error"        : "",
                ].filter(Boolean).join(" ")}
              >
                {/* Gambar preview */}
                <img
                  src={displayUrl}
                  alt={`Foto NG ${i + 1}`}
                  className="ngpu-img"
                  onClick={() => { if (!isBusy && !isError) handlePhotoClick(entry); }}
                  onError={(ev) => handleImageError(ev, entry)}
                  draggable={false}
                />

                {/* Overlay: compressing */}
                {isCompressing && (
                  <div className="ngpu-overlay ov-busy">
                    <div className="ngpu-spinner" />
                    <span className="ov-txt">Memproses…</span>
                  </div>
                )}

                {/* Overlay: uploading */}
                {isUploading && (
                  <div className="ngpu-overlay ov-busy">
                    <div className="ngpu-spinner" />
                    <span className="ov-txt">Mengunggah…</span>
                    {entry.compressInfo && (
                      <span className="ov-info">{entry.compressInfo}</span>
                    )}
                  </div>
                )}

                {/* Overlay: error — [FIX] tampilkan pesan lengkap */}
                {isError && (
                  <div className="ngpu-overlay ov-error">
                    <span className="ov-icon">⚠️</span>
                    <span className="ov-txt" title={entry.uploadError ?? ""}>
                      {/* Truncate panjang — detail di title tooltip */}
                      {(entry.uploadError ?? "Gagal").length > 60
                        ? (entry.uploadError ?? "Gagal").slice(0, 58) + "…"
                        : (entry.uploadError ?? "Gagal")}
                    </span>
                    <button
                      type="button"
                      className="ov-retry"
                      onClick={(ev) => { ev.stopPropagation(); handleRetry(i); }}
                    >
                      📷 Foto ulang
                    </button>
                  </div>
                )}

                {/* Action bar: zoom + hapus — hanya saat selesai */}
                {!isBusy && !isError && (
                  <div className="ngpu-actions">
                    <button
                      type="button"
                      className="act-btn act-zoom"
                      onClick={(ev) => { ev.stopPropagation(); handlePhotoClick(entry); }}
                      aria-label="Lihat foto besar"
                    >🔍</button>
                    <button
                      type="button"
                      className="act-btn act-del"
                      onClick={(ev) => { ev.stopPropagation(); handleDelete(i); }}
                      disabled={disabled}
                      aria-label="Hapus foto"
                    >🗑️</button>
                  </div>
                )}

                {/* Hapus saja jika error */}
                {isError && (
                  <button
                    type="button"
                    className="err-del-btn"
                    onClick={(ev) => { ev.stopPropagation(); handleDelete(i); }}
                    aria-label="Hapus"
                  >✕</button>
                )}

                {/* Nomor urut */}
                <span className="ngpu-num" aria-hidden="true">{i + 1}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tombol kamera ── */}
      {canAddMore && (
        <>
          <button
            type="button"
            className="ngpu-cam-btn"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            aria-label="Ambil foto dengan kamera"
          >
            <span className="cam-icon" aria-hidden="true">📷</span>
            <span className="cam-label">
              {entries.length === 0 ? "Ambil Foto" : "Tambah Foto"}
            </span>
            <span className="cam-counter">
              {entries.length}/{maxPhotos}
            </span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </>
      )}

      {/* Slot penuh */}
      {entries.length >= maxPhotos && (
        <p className="ngpu-full">
          ✅ Maksimal {maxPhotos} foto. Hapus foto untuk menambah baru.
        </p>
      )}

      {/* ─── Styles ───────────────────────────────────────────────────────── */}
      <style jsx>{`
        .ngpu-root {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Grid */
        .ngpu-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* Kartu foto */
        .ngpu-item {
          position: relative;
          width: 90px;
          height: 90px;
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
          flex-shrink: 0;
          background: #f1f5f9;
          transition: opacity 0.18s, transform 0.18s, border-color 0.15s;
        }
        .ngpu-item:hover          { border-color: #94a3b8; }
        .ngpu-item.is-deleting    { opacity: 0; transform: scale(0.8); pointer-events: none; }
        .ngpu-item.is-compressing { border-color: #a78bfa; }
        .ngpu-item.is-uploading   { border-color: #93c5fd; }
        .ngpu-item.is-error       { border-color: #fca5a5; }

        /* Gambar */
        .ngpu-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          cursor: pointer;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
          will-change: transform;
        }

        /* Overlay generik */
        .ngpu-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px;
          text-align: center;
        }
        .ov-busy  { background: rgba(0, 0, 0, 0.60); }
        .ov-error { background: rgba(185, 28, 28, 0.88); }

        .ov-txt {
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          word-break: break-all;
        }
        .ov-info {
          font-size: 8px;
          color: rgba(255,255,255,0.75);
          font-weight: 500;
        }
        .ov-icon { font-size: 16px; line-height: 1; }

        /* Spinner */
        .ngpu-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: ngpu-spin 0.75s linear infinite;
          flex-shrink: 0;
        }
        @keyframes ngpu-spin { to { transform: rotate(360deg); } }

        /* Retry di overlay error */
        .ov-retry {
          background: #fff;
          border: none;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 700;
          color: #b91c1c;
          padding: 3px 7px;
          cursor: pointer;
          margin-top: 2px;
          white-space: nowrap;
        }
        .ov-retry:hover { background: #fef2f2; }

        /* Tombol hapus entry error (pojok kanan atas) */
        .err-del-btn {
          position: absolute;
          top: 3px;
          right: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: none;
          background: rgba(0,0,0,0.55);
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          line-height: 1;
        }

        /* Action bar zoom + hapus */
        .ngpu-actions {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: rgba(0,0,0,0.52);
          opacity: 1;
        }
        @media (hover: hover) and (pointer: fine) {
          .ngpu-actions {
            opacity: 0;
            transition: opacity 0.15s;
          }
          .ngpu-item:hover .ngpu-actions { opacity: 1; }
        }

        .act-btn {
          flex: 1;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          padding: 5px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s;
          line-height: 1;
        }
        .act-btn:hover  { background: rgba(255,255,255,0.18); }
        .act-btn:active { background: rgba(255,255,255,0.30); }
        .act-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .act-zoom:hover { background: rgba(59,130,246,0.35); }
        .act-del:hover  { background: rgba(239,68,68,0.45);  }

        /* Nomor urut */
        .ngpu-num {
          position: absolute;
          top: 3px;
          left: 3px;
          background: rgba(0,0,0,0.50);
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          line-height: 1;
        }

        /* Tombol kamera */
        .ngpu-cam-btn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 11px 18px;
          min-height: 46px;
          background: #fffbeb;
          border: 2px dashed #f59e0b;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.12s;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .ngpu-cam-btn:hover:not(:disabled) {
          background: #fef3c7;
          border-color: #d97706;
          transform: translateY(-1px);
        }
        .ngpu-cam-btn:active:not(:disabled) { transform: scale(0.97); }
        .ngpu-cam-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .cam-icon    { font-size: 20px; flex-shrink: 0; line-height: 1; }
        .cam-label   { font-size: 13px; font-weight: 700; color: #92400e; white-space: nowrap; }
        .cam-counter {
          font-size: 11px;
          font-weight: 700;
          color: #a16207;
          background: rgba(245,158,11,0.15);
          padding: 2px 8px;
          border-radius: 20px;
          white-space: nowrap;
        }

        /* Slot penuh */
        .ngpu-full {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #16a34a;
          padding: 7px 11px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 7px;
        }

        /* Mobile */
        @media (max-width: 480px) {
          .ngpu-item     { width: 80px; height: 80px; }
          .ngpu-cam-btn  { width: 100%; justify-content: center; }
          .cam-label     { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}