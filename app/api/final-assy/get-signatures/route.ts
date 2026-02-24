// app/api/final-assy/get-signatures/route.ts
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

interface Signature {
  date_key: string;
  shift: string;
  signature_status: string;
  area_id: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month = searchParams.get('month');
    const role = searchParams.get('role');
    const areaCode = searchParams.get('areaCode');

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validasi userId
    const users = await pool.query<User>(
      'SELECT id, username, full_name, nik, department, role FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );
    if (users.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    // Ambil category_id
    const categories = await pool.query<Category>(
      'SELECT id FROM checklist_categories WHERE category_code = $1',
      [categoryCode]
    );
    if (categories.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categories.rows[0].id;

    // =========================================================
    // 🔹 BUILD QUERY - Filter signature berdasarkan area_id
    // =========================================================
    let query = '';
    let queryParams: any[] = [];

    // ✅ RESOLVE AREA_ID DARI AREA_CODE
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

    if (categoryCode === 'final-assy-inspector') {
      // === TABEL INSPECTOR ===
      if (areaId !== null) {
        query = `
          SELECT s.date_key, s.shift, s.signature_status, s.area_id
          FROM checklist_signatures s
          WHERE s.user_id = $1 
            AND s.category_id = $2 
            AND s.date_key LIKE $3
            AND (s.area_id = $4 OR s.area_id IS NULL)
          ORDER BY s.date_key, s.shift
        `;
        queryParams = [userId, categoryId, `${month}%`, areaId];
      } else {
        query = `
          SELECT s.date_key, s.shift, s.signature_status, s.area_id
          FROM checklist_signatures s
          WHERE s.user_id = $1 
            AND s.category_id = $2 
            AND s.date_key LIKE $3
          ORDER BY s.date_key, s.shift
        `;
        queryParams = [userId, categoryId, `${month}%`];
      }
    } else {
      // === TABEL GROUP LEADER ===
      // ✅ FIX: Filter signature berdasarkan area_id (LANGSUNG, TANPA EXISTS)
      if (areaId !== null) {
        query = `
          SELECT s.date_key, s.shift, s.signature_status, s.area_id
          FROM checklist_signatures s
          WHERE s.user_id = $1 
            AND s.category_id = $2 
            AND s.date_key LIKE $3
            AND (s.area_id = $4 OR s.area_id IS NULL)
          ORDER BY s.date_key, s.shift
        `;
        queryParams = [userId, categoryId, `${month}%`, areaId];
      } else {
        query = `
          SELECT s.date_key, s.shift, s.signature_status, s.area_id
          FROM checklist_signatures s
          WHERE s.user_id = $1 
            AND s.category_id = $2 
            AND s.date_key LIKE $3
          ORDER BY s.date_key, s.shift
        `;
        queryParams = [userId, categoryId, `${month}%`];
      }
    }

    // Eksekusi query
    const signatures = await pool.query<Signature>(query, queryParams);

    // Format response
    const formatted: Record<string, Record<string, string>> = {};
    signatures.rows.forEach((row: any) => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};
      formatted[row.date_key][row.shift] = row.signature_status;
    });

    return NextResponse.json({
      success: true,
      formatted,
      count: signatures.rows.length,
      role,
      categoryCode,
      areaCode: areaCode || null,
      areaId
    });
  } catch (error) {
    console.error('❌ Get signatures error:', error);
    return NextResponse.json({
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}