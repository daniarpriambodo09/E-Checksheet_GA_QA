import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, categoryCode, itemId, dateKey, shift, status, 
      ngDescription, ngDepartment, timeSlot 
    } = body;

    if (!userId || !categoryCode || itemId === undefined || !dateKey || !shift || !status) {
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
      console.error(`❌ Kategori tidak ditemukan: ${categoryCode}`);
      return NextResponse.json({ 
        error: `Category "${categoryCode}" not found` 
      }, { status: 404 });
    }
    const categoryId = catArray[0].id;

    // Jika status "-", hapus data
    if (status === '-') {
      const deleteQuery = timeSlot
        ? `DELETE FROM checklist_results 
           WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ? AND time_slot = ?`
        : `DELETE FROM checklist_results 
           WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ? AND (time_slot IS NULL OR time_slot = '')`;
      
      const deleteParams = timeSlot
        ? [userId, categoryId, itemId, dateKey, shift, timeSlot]
        : [userId, categoryId, itemId, dateKey, shift];
      
      await pool.execute(deleteQuery, deleteParams);
      return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
    }

    // Cek existing data
    const checkQuery = timeSlot
      ? `SELECT id FROM checklist_results 
         WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ? AND time_slot = ?`
      : `SELECT id FROM checklist_results 
         WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ? AND (time_slot IS NULL OR time_slot = '')`;
    
    const checkParams = timeSlot
      ? [userId, categoryId, itemId, dateKey, shift, timeSlot]
      : [userId, categoryId, itemId, dateKey, shift];
    
    const [existing] = await pool.execute(checkQuery, checkParams);

    if ((existing as any[]).length > 0) {
      // Update
      const updateQuery = timeSlot
        ? `UPDATE checklist_results 
           SET status = ?, ng_description = ?, ng_department = ?, updated_at = NOW()
           WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ? AND time_slot = ?`
        : `UPDATE checklist_results 
           SET status = ?, ng_description = ?, ng_department = ?, updated_at = NOW()
           WHERE user_id = ? AND category_id = ? AND item_id = ? AND date_key = ? AND shift = ? AND (time_slot IS NULL OR time_slot = '')`;
      
      const updateParams = timeSlot
        ? [status, ngDescription || null, ngDepartment || null, userId, categoryId, itemId, dateKey, shift, timeSlot]
        : [status, ngDescription || null, ngDepartment || null, userId, categoryId, itemId, dateKey, shift];
      
      await pool.execute(updateQuery, updateParams);
    } else {
      // Insert
      await pool.execute(
        `INSERT INTO checklist_results 
         (user_id, nik, category_id, item_id, date_key, shift, status, ng_description, ng_department, time_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, nik, categoryId, itemId, dateKey, shift, status, ngDescription || null, ngDepartment || null, timeSlot || null]
      );
    }

    return NextResponse.json({ success: true, message: 'Data berhasil disimpan' });
  } catch (error) {
    console.error('❌ Save result error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan data' }, { status: 500 });
  }
}