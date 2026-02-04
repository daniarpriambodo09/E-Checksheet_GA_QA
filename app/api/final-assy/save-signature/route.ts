// app/api/final-assy/save-signature/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, categoryCode, dateKey, shift, signatureStatus, tableType } = body;

    if (!userId || !categoryCode || !dateKey || !shift || !signatureStatus || !tableType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validasi user
    const [userCheck] = await pool.execute(
      'SELECT id, nik FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );
    const userArray = userCheck as any[];
    if (userArray.length === 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 });
    }
    const nik = userArray[0].nik;

    // Cari kategori di database
    const [categories] = await pool.execute(
      'SELECT id FROM checklist_categories WHERE category_code = ?',
      [categoryCode]
    );
    const catArray = categories as any[];
    if (catArray.length === 0) {
      console.error(`❌ Kategori tidak ditemukan: ${categoryCode}`);
      return NextResponse.json({ 
        error: `Category "${categoryCode}" not found. Please run initial setup!` 
      }, { status: 404 });
    }
    const categoryId = catArray[0].id;

    // Jika signature status adalah "-", hapus data jika ada
    if (signatureStatus === '-') {
      await pool.execute(
        `DELETE FROM checklist_signatures 
         WHERE user_id = ? AND category_id = ? AND date_key = ? AND shift = ?`,
        [userId, categoryId, dateKey, shift]
      );
      return NextResponse.json({ success: true, message: 'Tanda tangan berhasil dihapus' });
    }

    // Cek existing signature
    const [existing] = await pool.execute(
      `SELECT id FROM checklist_signatures 
       WHERE user_id = ? AND category_id = ? AND date_key = ? AND shift = ?`,
      [userId, categoryId, dateKey, shift]
    );

    if ((existing as any[]).length > 0) {
      // Update existing signature
      await pool.execute(
        `UPDATE checklist_signatures 
         SET signature_status = ?, updated_at = NOW()
         WHERE user_id = ? AND category_id = ? AND date_key = ? AND shift = ?`,
        [signatureStatus, userId, categoryId, dateKey, shift]
      );
    } else {
      // Insert new signature
      await pool.execute(
        `INSERT INTO checklist_signatures 
         (user_id, nik, category_id, date_key, shift, signature_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, nik, categoryId, dateKey, shift, signatureStatus]
      );
    }

    return NextResponse.json({ success: true, message: 'Tanda tangan berhasil disimpan' });
  } catch (error) {
    console.error('❌ Save signature error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan tanda tangan' }, { status: 500 });
  }
}