// app/api/final-assy-save-result.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, categoryCode, itemId, dateKey, shift, status, ngDescription, ngDepartment } = body;

    // ✅ Validasi input
    if (!userId || !categoryCode || !itemId || !dateKey || !shift || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ Validasi userId di database
    const [userCheck] = await pool.execute(
      'SELECT id, nik FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );
    const userArray = userCheck as any[];
    if (userArray.length === 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 });
    }
    const nik = userArray[0].nik;

    // ✅ Ambil category_id
    const [categories] = await pool.execute(
      'SELECT id FROM checklist_categories WHERE category_code = ?',
      [categoryCode]
    );
    const catArray = categories as any[];
    if (catArray.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = catArray[0].id;

    // ✅ Cek existing data
    const [existing] = await pool.execute(
      `SELECT id FROM checklist_results 
       WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ?`,
      [userId, categoryId, itemId, dateKey, shift]
    );

    if ((existing as any[]).length > 0) {
      // Update existing
      await pool.execute(
        `UPDATE checklist_results 
         SET status = ?, ng_description = ?, ng_department = ?, updated_at = NOW()
         WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ?`,
        [status, ngDescription || null, ngDepartment || null, userId, categoryId, itemId, dateKey, shift]
      );
    } else {
      // Insert baru
      await pool.execute(
        `INSERT INTO checklist_results 
         (user_id, nik, category_id, item_id, date_key, shift, status, ng_description, ng_department)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, nik, categoryId, itemId, dateKey, shift, status, ngDescription || null, ngDepartment || null]
      );
    }

    return NextResponse.json({ success: true, message: 'Data berhasil disimpan' });
  } catch (error) {
    console.error('Save result error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan data' }, { status: 500 });
  }
}