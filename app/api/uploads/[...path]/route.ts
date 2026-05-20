// app/api/uploads/[...path]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve, extname } from "path";
import { existsSync } from "fs";
import path from "path";

// Root folder upload (harus sama dengan upload API)
const UPLOAD_BASE = resolve(process.cwd(), "public", "uploads");

// MIME types yang diizinkan
const ALLOWED_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

// Cache browser + CDN
const CACHE_HEADER = "public, max-age=3600, s-maxage=86400";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await context.params;
    const relativePath = filePath.join("/");

    // ── VALIDASI EXTENSION ─────────────────────────────
    const ext = extname(relativePath).toLowerCase();
    const mimeType = ALLOWED_MIME[ext];

    if (!mimeType) {
      return NextResponse.json(
        { error: "Tipe file tidak diizinkan." },
        { status: 403 }
      );
    }

    // ── RESOLVE PATH ───────────────────────────────────
    const targetPath = resolve(UPLOAD_BASE, relativePath);

    // ── FIX SECURITY (WINDOWS + LINUX SAFE) ────────────
    const normalizedBase = UPLOAD_BASE.endsWith(path.sep)
      ? UPLOAD_BASE
      : UPLOAD_BASE + path.sep;

    if (!targetPath.startsWith(normalizedBase)) {
      console.warn(`[serve] ❌ Path traversal dicegah: ${relativePath}`);
      return NextResponse.json(
        { error: "Akses tidak diizinkan." },
        { status: 403 }
      );
    }

    // ── CEK FILE ADA ───────────────────────────────────
    if (!existsSync(targetPath)) {
      console.warn(`[serve] ❌ File tidak ditemukan: ${targetPath}`);
      return NextResponse.json(
        { error: "File tidak ditemukan." },
        { status: 404 }
      );
    }

    // ── BACA FILE ──────────────────────────────────────
    const fileBuffer = await readFile(targetPath);

    console.log(
      `[serve] ✅ ${relativePath} (${(fileBuffer.length / 1024).toFixed(0)} KB)`
    );

    // ── RETURN RESPONSE ────────────────────────────────
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": CACHE_HEADER,
        "Content-Disposition": "inline",
      },
    });

  } catch (error: any) {
    console.error("[serve] ❌ Error:", error.message);
    return NextResponse.json(
      { error: "Gagal membaca file.", detail: error.message },
      { status: 500 }
    );
  }
}