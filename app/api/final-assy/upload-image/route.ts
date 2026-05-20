import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'checksheet');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Cek ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Buat direktori jika belum ada
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate nama file unik
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const rawExt = file.type?.split('/')[1] || file.name.split('.').pop() || 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const filename = `${timestamp}-${random}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Simpan file
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // Return URL relatif
    const url = `/uploads/checksheet/${filename}`;

    console.log(`✅ [Upload Image] File saved: ${filename}, URL: ${url}`);

    return NextResponse.json({
      success: true,
      url,  // Gunakan URL relatif
      filename,
      message: 'Image uploaded successfully',
    });
  } catch (error: any) {
    console.error('❌ [Upload Image] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to upload image', detail: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
