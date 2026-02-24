// app/api/final-assy/save-signature/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface User {
  id: string;
  username: string;
  full_name: string;
  nik: string;
  department: string;
  role: string;
}

interface Category {
  id: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, categoryCode, dateKey, shift, signatureStatus, tableType, areaCode } = body;

    // Validasi required fields
    if (!userId || !categoryCode || !dateKey || !shift || !signatureStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // =========================================================
    // 🔹 VALIDASI USER
    // =========================================================
    const users = await pool.query<User>(
      'SELECT id, username, full_name, nik, department, role FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );

    if (users.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 });
    }

    const nik = users.rows[0].nik;

    // =========================================================
    // 🔹 VALIDASI CATEGORY
    // =========================================================
    const categories = await pool.query<Category>(
      'SELECT id FROM checklist_categories WHERE category_code = $1',
      [categoryCode]
    );

    if (categories.rows.length === 0) {
      return NextResponse.json({
        error: `Category "${categoryCode}" not found in database.`
      }, { status: 404 });
    }

    const categoryId = categories.rows[0].id;

    // =========================================================
    // 🔹 RESOLVE AREA_ID DARI AREA_CODE (OPTIONAL)
    // =========================================================
    let areaId: number | null = null;
    if (areaCode) {
      const areaResult = await pool.query(
        `SELECT id FROM checklist_areas 
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE`,
        [areaCode, categoryId]
      );
      if (areaResult.rows.length > 0) {
        areaId = areaResult.rows[0].id;
      }
    }

    // =========================================================
    // 🔹 JIKA STATUS = "-", HAPUS DARI DATABASE
    // =========================================================
    if (signatureStatus === '-') {
      if (areaId !== null) {
        // Delete dengan filter area_id (match area_id yang sama atau NULL)
        await pool.query(
          `DELETE FROM checklist_signatures 
           WHERE user_id = $1 
             AND category_id = $2 
             AND date_key = $3 
             AND shift = $4 
             AND (area_id = $5 OR area_id IS NULL)`,
          [userId, categoryId, dateKey, shift, areaId]
        );
      } else {
        // Delete tanpa filter area_id (hanya record dengan area_id NULL)
        await pool.query(
          `DELETE FROM checklist_signatures 
           WHERE user_id = $1 
             AND category_id = $2 
             AND date_key = $3 
             AND shift = $4 
             AND area_id IS NULL`,
          [userId, categoryId, dateKey, shift]
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Signature berhasil dihapus',
        deleted: true
      });
    }

    // =========================================================
    // 🔹 JIKA STATUS = "OK", SIMPAN/UPDATE KE DATABASE
    // =========================================================
    
    // Cek existing signature dengan filter area_id yang konsisten
    let existing;
    if (areaId !== null) {
      existing = await pool.query(
        `SELECT id FROM checklist_signatures 
         WHERE user_id = $1 
           AND category_id = $2 
           AND date_key = $3 
           AND shift = $4 
           AND (area_id = $5 OR area_id IS NULL)`,
        [userId, categoryId, dateKey, shift, areaId]
      );
    } else {
      existing = await pool.query(
        `SELECT id FROM checklist_signatures 
         WHERE user_id = $1 
           AND category_id = $2 
           AND date_key = $3 
           AND shift = $4 
           AND area_id IS NULL`,
        [userId, categoryId, dateKey, shift]
      );
    }

    if (existing.rows.length > 0) {
      // ✅ UPDATE: Update existing signature dengan area_id
      await pool.query(
        `UPDATE checklist_signatures 
         SET signature_status = $1, 
             area_id = $2, 
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 
           AND category_id = $4 
           AND date_key = $5 
           AND shift = $6`,
        [signatureStatus, areaId, userId, categoryId, dateKey, shift]
      );

      return NextResponse.json({
        success: true,
        message: 'Signature berhasil diupdate',
        areaId,
        action: 'updated'
      });
    } else {
      // ✅ INSERT: Insert new signature dengan area_id
      await pool.query(
        `INSERT INTO checklist_signatures 
         (user_id, nik, category_id, date_key, shift, signature_status, area_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [userId, nik, categoryId, dateKey, shift, signatureStatus, areaId]
      );

      return NextResponse.json({
        success: true,
        message: 'Signature berhasil disimpan',
        areaId,
        action: 'inserted'
      });
    }

  } catch (error) {
    console.error('❌ Save signature error:', error);
    return NextResponse.json({
      error: 'Gagal menyimpan signature ke database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}