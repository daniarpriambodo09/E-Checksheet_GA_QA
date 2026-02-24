// app/api/dashboard/get-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('categoryCode'); // optional
    const month = searchParams.get('month'); // format: YYYY-MM
    const days = searchParams.get('days') || '7'; // default 7 days for trend

    if (!month) {
      return NextResponse.json({ error: 'Missing month parameter' }, { status: 400 });
    }

    // Build query based on category filter
    let categoryCondition = '';
    let categoryParams: any[] = [];

    if (categoryCode && categoryCode !== 'All Category') {
      categoryCondition = 'AND c.category_code = $2';
      categoryParams = [categoryCode];
    }

    // ============================================
    // 1. GET TOTAL CHECKLIST COUNT (per date + category)
    // ============================================
    // Hitung jumlah date_key unik per kategori (bukan per item)
    const totalQuery = `
      SELECT 
        COUNT(DISTINCT CONCAT(r.date_key, '-', c.id)) as table_count
      FROM checklist_results r
      INNER JOIN checklist_categories c ON r.category_id = c.id
      WHERE r.date_key LIKE $1 
        ${categoryCondition}
        AND r.status IN ('OK', 'NG')
    `;

    const totalParams = [`${month}%`, ...categoryParams];
    const totalResult = await pool.query(totalQuery, totalParams);
    const totalChecklist = totalResult.rows[0]?.table_count || 0;

    // ============================================
    // 2. GET COMPLETED CHECKLIST (SEMUA status OK, tidak ada NG)
    // ============================================
    // ✅ FIX: Hitung date_key di mana SEMUA item statusnya OK (tidak ada satupun NG)
    const completedQuery = `
      SELECT 
        COUNT(*) as completed_count
      FROM (
        SELECT r.date_key, c.id as category_id
        FROM checklist_results r
        INNER JOIN checklist_categories c ON r.category_id = c.id
        WHERE r.date_key LIKE $1
          ${categoryCondition}
          AND r.status IN ('OK', 'NG')  -- Hanya hitung yang sudah diisi
        GROUP BY r.date_key, c.id
        -- ✅ TIDAK ADA satupun NG pada date_key ini
        HAVING COUNT(CASE WHEN r.status = 'NG' THEN 1 END) = 0
          -- ✅ Minimal ada 1 OK (agar tidak hitung data kosong)
          AND COUNT(CASE WHEN r.status = 'OK' THEN 1 END) > 0
      ) as completed_tables
    `;

    const completedResult = await pool.query(completedQuery, totalParams);
    const completedChecklist = completedResult.rows[0]?.completed_count || 0;

    // ============================================
    // 3. GET TOTAL NG COUNT
    // ============================================
    // Hitung total item berstatus NG
    const ngQuery = `
      SELECT 
        COUNT(*) as total_ng
      FROM checklist_results r
      INNER JOIN checklist_categories c ON r.category_id = c.id
      WHERE r.date_key LIKE $1
        ${categoryCondition}
        AND r.status = 'NG'
    `;

    const ngResult = await pool.query(ngQuery, totalParams);
    const totalNG = ngResult.rows[0]?.total_ng || 0;

    // ============================================
    // 4. GET TREND DATA (last 7 days)
    // ============================================
    const trendDays = parseInt(days);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - trendDays + 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Hitung jumlah checklist per hari (per date_key per category)
    const trendQuery = `
      SELECT 
        r.date_key,
        COUNT(DISTINCT CONCAT(r.date_key, '-', c.id)) as daily_count
      FROM checklist_results r
      INNER JOIN checklist_categories c ON r.category_id = c.id
      WHERE r.date_key >= $1
        ${categoryCondition}
        AND r.status IN ('OK', 'NG')
      GROUP BY r.date_key
      ORDER BY r.date_key ASC
    `;

    const trendParams = [startDateStr, ...categoryParams];
    const trendResult = await pool.query(trendQuery, trendParams);
    const trendData = trendResult.rows.map(row => ({
      date: row.date_key,
      count: parseInt(row.daily_count)
    }));

    // ============================================
    // 5. GET DISTRIBUTION (OK vs NG)
    // ============================================
    const distributionQuery = `
      SELECT 
        r.status,
        COUNT(*) as count,
        c.category_code,
        c.category_name
      FROM checklist_results r
      INNER JOIN checklist_categories c ON r.category_id = c.id
      WHERE r.date_key >= $1
        ${categoryCondition}
        AND r.status IN ('OK', 'NG')
      GROUP BY r.status, c.id, c.category_code, c.category_name
      ORDER BY c.category_name, r.status
    `;

    const distributionResult = await pool.query(distributionQuery, trendParams);
    const distributionData = distributionResult.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count),
      category: row.category_name || row.category_code
    }));

    // ============================================
    // 6. GET TOP USERS
    // ============================================
    const topUsersQuery = `
      SELECT 
        u.full_name as user_name,
        COUNT(DISTINCT CONCAT(r.date_key, '-', r.category_id)) as submission_count
      FROM checklist_results r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN checklist_categories c ON r.category_id = c.id
      WHERE r.date_key >= $1
        ${categoryCondition}
      GROUP BY u.id, u.full_name
      ORDER BY submission_count DESC
      LIMIT 5
    `;

    const topUsersResult = await pool.query(topUsersQuery, trendParams);
    const topUsers = topUsersResult.rows.map(row => ({
      name: row.user_name,
      count: parseInt(row.submission_count)
    }));

    // ============================================
    // 7. GET HISTORY DATA
    // ============================================
    const historyQuery = `
      SELECT 
        r.date_key,
        r.submitted_at,
        c.category_name,
        c.area_type,
        r.shift,
        r.status,
        COUNT(CASE WHEN r.status = 'NG' THEN 1 END) OVER (PARTITION BY r.date_key, r.category_id) as ng_count,
        u.full_name as submitted_by
      FROM checklist_results r
      INNER JOIN checklist_categories c ON r.category_id = c.id
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.date_key LIKE $1
        ${categoryCondition}
      ORDER BY r.submitted_at DESC
      LIMIT 50
    `;

    const historyResult = await pool.query(historyQuery, totalParams);
    const historyData = historyResult.rows.map(row => ({
      filledAt: row.submitted_at,
      area: row.area_type === 'pre-assy' ? 'Pre Assy' : 'Final Assy',
      category: row.category_name,
      shift: row.shift,
      status: row.status,
      ngCount: row.ng_count || 0,
      filledBy: row.submitted_by
    }));

    // ============================================
    // 8. CALCULATE COMPLETION RATE
    // ============================================
    // Jika All Category → pembagi = total semua tabel aktif
    // Jika kategori tertentu → pembagi = 1 per date_key
    let totalActiveTables = 1; // Default untuk 1 kategori
    
    if (categoryCode === 'All Category' || !categoryCode) {
      // Hitung jumlah kategori aktif
      const activeCategoriesQuery = `
        SELECT COUNT(*) as count
        FROM checklist_categories
        WHERE is_active = TRUE
      `;
      const activeCategoriesResult = await pool.query(activeCategoriesQuery);
      totalActiveTables = parseInt(activeCategoriesResult.rows[0]?.count || '1');
    }

    // Rumus: (Completed / Total Active Tables) × 100%
    const completionRate = totalActiveTables > 0 
      ? ((completedChecklist / totalActiveTables) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      success: true,
      stats: {
        total: totalChecklist,
        completed: completedChecklist,
        pending: totalNG,
        completionRate
      },
      trendData,
      distributionData,
      topUsers,
      historyData
    });
  } catch (error) {
    console.error('❌ Dashboard API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}