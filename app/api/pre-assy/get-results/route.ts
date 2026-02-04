import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month = searchParams.get('month'); // format: YYYY-MM

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validasi userId
    const [userCheck] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );
    if ((userCheck as any[]).length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    // Ambil category_id
    const [cats] = await pool.execute(
      'SELECT id FROM checklist_categories WHERE category_code = ?',
      [categoryCode]
    );
    if ((cats as any[]).length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = (cats as any[])[0].id;

    // Query results
    const [results] = await pool.execute(
      `SELECT date_key, item_id, shift, status, ng_description, ng_department, submitted_at, time_slot
       FROM checklist_results
       WHERE user_id = ? AND category_id = ? AND date_key LIKE ?
       ORDER BY date_key, item_id, shift`,
      [userId, categoryId, `${month}%`]
    );

    // Format data
    const formatted: Record<string, Record<string, any>> = {};
    (results as any[]).forEach(row => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};
      
      // Key dengan atau tanpa time_slot
      const itemKey = row.time_slot 
        ? `${row.item_id}-${row.shift}-${row.time_slot}` 
        : `${row.item_id}-${row.shift}`;
      
      formatted[row.date_key][itemKey] = {
        status: row.status,
        ngCount: row.status === 'NG' ? 1 : 0,
        items: [],
        notes: '',
        submittedAt: row.submitted_at,
        submittedBy: 'System',
        ngDescription: row.ng_description || '',
        ngDepartment: row.ng_department || 'QA'
      };
    });

    return NextResponse.json({ success: true, formatted });
  } catch (error) {
    console.error('❌ Get results error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}