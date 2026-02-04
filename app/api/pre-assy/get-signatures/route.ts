import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month = searchParams.get('month');

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validasi user
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

    // Ambil signatures
    const [signatures] = await pool.execute(
      `SELECT date_key, shift, signature_status
       FROM checklist_signatures
       WHERE user_id = ? AND category_id = ? AND date_key LIKE ?
       ORDER BY date_key, shift`,
      [userId, categoryId, `${month}%`]
    );

    // Format data
    const formatted: Record<string, Record<string, string>> = {};
    (signatures as any[]).forEach(row => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};
      formatted[row.date_key][row.shift] = row.signature_status;
    });

    return NextResponse.json({ success: true, formatted });
  } catch (error) {
    console.error('❌ Get signatures error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}