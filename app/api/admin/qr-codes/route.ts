// app/api/admin/qr-codes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuth } from '@/lib/auth-context';

// ✅ GET: Ambil semua QR codes tersimpan
export async function GET(request: NextRequest) {
  try {
    // ✅ Auth check server-side
    const { user, error } = await getAuth(request);
    
    if (error || !user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const result = await pool.query(`
      SELECT 
        qrc.*,
        u.username as created_by_username
      FROM qr_codes qrc
      LEFT JOIN users u ON qrc.created_by = u.id
      WHERE qrc.is_active = TRUE
      ORDER BY qrc.created_at DESC
    `);

    const qrCodes = result.rows.map((row: any) => ({
      id: row.id,
      category: row.category_code,
      categoryLabel: row.category_label,
      role: row.role,
      roleLabel: row.role_label,
      areaCode: row.area_code,
      areaLabel: row.area_label,
      qrValue: row.qr_value,
      createdAt: row.created_at,
      createdBy: row.created_by_username || row.created_by,
      isActive: row.is_active
    }));

    return NextResponse.json({
      success: true,
      qrCodes,
      count: qrCodes.length
    });

  } catch (error: any) {
    console.error('❌ Get QR codes error:', error);
    return NextResponse.json(
      { error: 'Server error', detail: error.message },
      { status: 500 }
    );
  }
}

// ✅ POST: Simpan QR code baru
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuth(request);
    
    if (error || !user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      categoryCode,
      categoryLabel,
      role,
      roleLabel,
      areaCode,
      areaLabel,
      qrValue,
      createdBy
    } = body;

    // ✅ Validasi required fields
    if (!categoryCode || !role || !areaCode || !qrValue) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ✅ Validasi uniqueness (opsional: prevent duplicate)
    const existing = await pool.query(
      `SELECT id FROM qr_codes 
       WHERE category_code = $1 AND role = $2 AND area_code = $3 AND qr_value = $4`,
      [categoryCode, role, areaCode, qrValue]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { 
          error: 'QR Code dengan konfigurasi ini sudah ada',
          existingId: existing.rows[0].id
        },
        { status: 409 }
      );
    }

    // ✅ Insert ke database
    const result = await pool.query(
      `INSERT INTO qr_codes (
         category_code,
         category_label,
         role,
         role_label,
         area_code,
         area_label,
         qr_value,
         created_by,
         created_at,
         updated_at,
         is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), TRUE)
       RETURNING id, created_at`,
      [
        categoryCode,
        categoryLabel,
        role,
        roleLabel,
        areaCode,
        areaLabel,
        qrValue,
        createdBy || user.id
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'QR Code berhasil disimpan',
      data: {
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at
      }
    });

  } catch (error: any) {
    console.error('❌ Save QR code error:', error);
    
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Duplicate entry' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save QR code', detail: error.message },
      { status: 500 }
    );
  }
}

// ✅ DELETE: Hapus QR code
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await getAuth(request);
    
    if (error || !user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'QR Code ID required' },
        { status: 400 }
      );
    }

    // ✅ Soft delete (update is_active = false)
    const result = await pool.query(
      `UPDATE qr_codes 
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'QR Code not found or already deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'QR Code berhasil dihapus',
      deletedId: id
    });

  } catch (error: any) {
    console.error('❌ Delete QR code error:', error);
    return NextResponse.json(
      { error: 'Failed to delete QR code', detail: error.message },
      { status: 500 }
    );
  }
}

// ✅ OPTIONS untuk CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}