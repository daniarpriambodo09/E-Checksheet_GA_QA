// app/api/upload-image/route.ts
//
// API upload foto dokumentasi kondisi NG.
// Limit: 2 MB (cukup untuk gambar sudah dikompresi dari frontend).
// Frontend melakukan kompresi Canvas API sebelum upload,
// sehingga file yang masuk sudah ≤ 1 MB dalam kondisi normal.
//
// Penyimpanan: {cwd}/public/uploads/checksheet/{timestamp}-{random}.jpg
//
// [FIX] Return URL diubah dari:
//   /uploads/checksheet/...         ← hanya works di dev / static build
// Menjadi:
//   /api/uploads/checksheet/...     ← works di dev + production runtime

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "checksheet");

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan dalam request." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Hanya file gambar yang diizinkan." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 413 }
      );
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const random    = Math.random().toString(36).substring(2, 8);
    const rawExt    = file.type.split("/")[1] || file.name.split(".").pop() || "jpg";
    const ext       = rawExt === "jpeg" ? "jpg" : rawExt;
    const filename  = `${timestamp}-${random}.${ext}`;
    const filepath  = join(UPLOAD_DIR, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // [FIX] Gunakan /api/uploads/... agar file bisa diakses di production.
    // Static path /uploads/... hanya bisa diakses di development atau jika
    // file sudah ada sejak build time.
    const url = `/e-checksheet-qa/api/uploads/checksheet/${filename}`;

    console.log(
      `✅ [Upload] ${filename} | ${(file.size / 1024).toFixed(0)} KB | ${file.type}`
    );

    return NextResponse.json({ success: true, url, filename, size: file.size });

  } catch (error: any) {
    console.error("❌ [Upload] Error:", error.message);
    return NextResponse.json(
      { error: "Gagal menyimpan file.", detail: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}