import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, categoryCode, dateKey, shift, signatureStatus } = body;

    if (!userId || !categoryCode || !dateKey || !shift || !signatureStatus) {
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

    // Cari kategori
    const [categories] = await pool.execute(
      'SELECT id FROM checklist_categories WHERE category_code = ?',
      [categoryCode]
    );
    const catArray = categories as any[];
    if (catArray.length === 0) {
      return NextResponse.json({ 
        error: `Category "${categoryCode}" not found` 
      }, { status: 404 });
    }
    const categoryId = catArray[0].id;

    // Jika "-", hapus
    if (signatureStatus === '-') {
      await pool.execute(
        `DELETE FROM checklist_signatures 
         WHERE user_id = ? AND category_id = ? AND date_key = ? AND shift = ?`,
        [userId, categoryId, dateKey, shift]
      );
      return NextResponse.json({ success: true, message: 'Tanda tangan dihapus' });
    }

    // Cek existing
    const [existing] = await pool.execute(
      `SELECT id FROM checklist_signatures 
       WHERE user_id = ? AND category_id = ? AND date_key = ? AND shift = ?`,
      [userId, categoryId, dateKey, shift]
    );

    if ((existing as any[]).length > 0) {
      // Update
      await pool.execute(
        `UPDATE checklist_signatures 
         SET signature_status = ?, updated_at = NOW()
         WHERE user_id = ? AND category_id = ? AND date_key = ? AND shift = ?`,
        [signatureStatus, userId, categoryId, dateKey, shift]
      );
    } else {
      // Insert
      await pool.execute(
        `INSERT INTO checklist_signatures 
         (user_id, nik, category_id, date_key, shift, signature_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, nik, categoryId, dateKey, shift, signatureStatus]
      );
    }

    return NextResponse.json({ success: true, message: 'Tanda tangan tersimpan' });
  } catch (error) {
    console.error('❌ Save signature error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan tanda tangan' }, { status: 500 });
  }
}