// app/api/gauges/save-inspection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const body = await request.json();
    const { 
      gaugeId, 
      userId, 
      nik, 
      dateKey, 
      shift, 
      status, 
      ngDescription, 
      ngDepartment 
    } = body;

    if (!gaugeId || !userId || !dateKey || !shift || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Validasi gauge
    const gaugeCheck = await client.query(
      'SELECT id, is_active FROM gauges WHERE id = $1',
      [gaugeId]
    );

    if (gaugeCheck.rows.length === 0) {
      throw new Error('Gauge tidak ditemukan');
    }

    if (!gaugeCheck.rows[0].is_active) {
      throw new Error('Gauge tidak aktif');
    }

    // UPSERT: Insert atau Update jika sudah ada
    if (status === '-') {
      // Delete jika status "-"
      await client.query(
        `DELETE FROM gauge_inspections
         WHERE gauge_id = $1 AND date_key = $2 AND shift = $3`,
        [gaugeId, dateKey, shift]
      );

      await client.query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        message: 'Inspeksi dihapus',
        deleted: true
      });

    } else {
      // Insert atau Update
      await client.query(
        `INSERT INTO gauge_inspections 
         (gauge_id, user_id, date_key, shift, status, ng_description, ng_department, scanned_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (gauge_id, date_key, shift)
         DO UPDATE SET
           status = EXCLUDED.status,
           ng_description = EXCLUDED.ng_description,
           ng_department = EXCLUDED.ng_department,
           scanned_at = NOW()`,
        [gaugeId, userId, dateKey, shift, status, ngDescription || null, ngDepartment || null]
      );

      await client.query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        message: 'Inspeksi berhasil disimpan'
      });
    }

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Save inspection error:', error.message);
    return NextResponse.json({ 
      error: 'Gagal menyimpan inspeksi',
      detail: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}