// app/api/pre-assy/save-signature/route.ts

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
    const userCheckResult = await pool.query(
      'SELECT id, nik FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );
    if (userCheckResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 });
    }
    const nik = userCheckResult.rows[0].nik;

    // Cari kategori
    const categoryResult = await pool.query(
      'SELECT id FROM checklist_categories WHERE category_code = $1',
      [categoryCode]
    );
    if (categoryResult.rows.length === 0) {
      return NextResponse.json({ 
        error: `Category "${categoryCode}" not found` 
      }, { status: 404 });
    }
    const categoryId = categoryResult.rows[0].id;

    // Jika "-", hapus
    if (signatureStatus === '-') {
      await pool.query(
        `DELETE FROM checklist_signatures 
         WHERE user_id = $1 AND category_id = $2 AND date_key = $3 AND shift = $4`,
        [userId, categoryId, dateKey, shift]
      );
      return NextResponse.json({ success: true, message: 'Tanda tangan dihapus' });
    }

    // PostgreSQL upsert menggunakan ON CONFLICT
    await pool.query(
      `INSERT INTO checklist_signatures 
       (user_id, nik, category_id, date_key, shift, signature_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, category_id, date_key, shift)
       DO UPDATE SET
         signature_status = EXCLUDED.signature_status,
         updated_at = NOW()`,
      [userId, nik, categoryId, dateKey, shift, signatureStatus]
    );

    return NextResponse.json({ success: true, message: 'Tanda tangan tersimpan' });
  } catch (error) {
    console.error('❌ Save signature error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan tanda tangan' }, { status: 500 });
  }
}