// app/api/admin/gauge-types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getServerAuth, shouldSkipAuth, isAdminRole } from '@/lib/auth-server';

async function checkAdminAuth(request: NextRequest) {
  if (shouldSkipAuth()) {
    return { authorized: true, user: { id: 'dev', role: 'admin', username: 'dev' } };
  }
  const { user, error } = await getServerAuth(request);
  if (error || !user || !isAdminRole(user.role)) {
    return { authorized: false, user: null };
  }
  return { authorized: true, user };
}

// Helper: Generate slug dari nama (lowercase, spasi jadi hyphen)
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Helper: Generate abbrev dari nama (4 huruf pertama, uppercase, tanpa spasi)
function generateAbbrev(name: string): string {
  return name.replace(/\s+/g, '').slice(0, 4).toUpperCase();
}

// ──────────────────────────────────────────────────────────────────────────────
// GET: Ambil semua gauge types yang unik dan aktif dari database
// ──────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const areaType = searchParams.get('areaType');

    // ✅ PERBAIKAN: HAPUS 'abbrev' karena kolom tidak ada di database
    const query = areaType
      ? `SELECT DISTINCT gauge_type_id, gauge_type_slug, gauge_type_name, area_type 
         FROM gauge_qr_codes 
         WHERE area_type = $1 AND is_active = TRUE 
         ORDER BY gauge_type_name`
      : `SELECT DISTINCT gauge_type_id, gauge_type_slug, gauge_type_name, area_type 
         FROM gauge_qr_codes 
         WHERE is_active = TRUE 
         ORDER BY area_type, gauge_type_name`;

    const result = areaType
      ? await pool.query(query, [areaType])
      : await pool.query(query);

    return NextResponse.json({ 
      success: true, 
      data: result.rows, 
      count: result.rows.length 
    });
  } catch (err: any) {
    console.error('❌ GET gauge-types error:', err);
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST: Tambah gauge type baru
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await checkAdminAuth(request);
    if (!authorized || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await request.json();
    let { gaugeTypeName, gaugeTypeSlug, areaType, dciItemId, abbrev } = body;

    if (!gaugeTypeName || !areaType) {
      return NextResponse.json({ error: 'Missing required fields: gaugeTypeName, areaType' }, { status: 400 });
    }

    if (!['pre-assy', 'final-assy'].includes(areaType)) {
      return NextResponse.json({ error: 'Invalid areaType. Must be "pre-assy" or "final-assy"' }, { status: 400 });
    }

    // Auto-generate slug dari nama jika tidak disediakan
    if (!gaugeTypeSlug) {
      gaugeTypeSlug = generateSlug(gaugeTypeName);
    }

    // Auto-generate abbrev jika tidak disediakan (hanya untuk kalkulasi di frontend)
    if (!abbrev) {
      abbrev = generateAbbrev(gaugeTypeName);
    }

    // Auto-generate dciItemId (MAX + 1 untuk area_type ini)
    if (!dciItemId) {
      const maxIdResult = await pool.query(
        `SELECT COALESCE(MAX(gauge_type_id), 0) as max_id FROM gauge_qr_codes WHERE area_type = $1`,
        [areaType]
      );
      dciItemId = (maxIdResult.rows[0]?.max_id || 0) + 1;
    }

    // Convert nama ke UPPERCASE untuk konsistensi database
    const normalizedName = gaugeTypeName.trim().toUpperCase();
    const normalizedSlug = gaugeTypeSlug.trim().toLowerCase();

    // Cek apakah gauge type dengan slug+area_type ini sudah ada dan aktif
    const existing = await pool.query(
      `SELECT gauge_type_id, gauge_type_name FROM gauge_qr_codes 
       WHERE gauge_type_slug = $1 AND area_type = $2 AND is_active = TRUE 
       LIMIT 1`,
      [normalizedSlug, areaType]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Gauge type sudah ada',
        data: {
          gauge_type_id: existing.rows[0].gauge_type_id,
          gauge_type_slug: normalizedSlug,
          gauge_type_name: existing.rows[0].gauge_type_name,
          area_type: areaType
        },
        exists: true
      });
    }

    // ✅ PERBAIKAN: HAPUS 'abbrev' dari INSERT karena kolom tidak ada di database
    const result = await pool.query(
      `INSERT INTO gauge_qr_codes 
       (gauge_type_id, gauge_type_slug, gauge_type_name, area_type, 
        gauge_id, qr_value, display_name, seq_number, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, TRUE, $8, NOW(), NOW())
       ON CONFLICT (gauge_type_slug, area_type) DO UPDATE 
       SET updated_at = NOW()
       RETURNING gauge_type_id, gauge_type_slug, gauge_type_name, area_type`,
      [
        dciItemId,
        normalizedSlug,
        normalizedName,
        areaType,
        `TEMP-${normalizedSlug.toUpperCase()}`,  // gauge_id placeholder untuk template
        `DCI-${dciItemId}-TEMP`,                  // qr_value placeholder untuk template
        `${normalizedName} [Template]`,           // display_name placeholder untuk template
        String(user.id)
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Gauge type baru berhasil dibuat',
      data: result.rows[0],
      exists: false
    });

  } catch (err: any) {
    console.error('❌ POST gauge-types error:', err);
    
    if (err.code === '23505') {
      return NextResponse.json({ 
        error: 'Gauge type dengan slug ini sudah ada untuk area tersebut.',
        detail: 'Silakan gunakan nama atau slug yang berbeda.'
      }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE: Soft delete gauge type
// ──────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, user } = await checkAdminAuth(request);
    if (!authorized || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const gaugeTypeSlug = searchParams.get('gaugeTypeSlug');
    const areaType = searchParams.get('areaType');

    if (!gaugeTypeSlug || !areaType) {
      return NextResponse.json({ error: 'Missing required parameters: gaugeTypeSlug, areaType' }, { status: 400 });
    }

    if (!['pre-assy', 'final-assy'].includes(areaType)) {
      return NextResponse.json({ error: 'Invalid areaType' }, { status: 400 });
    }

    // Hitung berapa gauge QR aktif yang menggunakan tipe ini
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM gauge_qr_codes 
       WHERE gauge_type_slug = $1 AND area_type = $2 AND is_active = TRUE AND seq_number > 0`,
      [gaugeTypeSlug, areaType]
    );
    const activeGaugeCount = parseInt(countResult.rows[0].count);

    // Soft delete: Set is_active = FALSE untuk semua record dengan gauge_type_slug + area_type ini
    const result = await pool.query(
      `UPDATE gauge_qr_codes 
       SET is_active = FALSE, updated_at = NOW() 
       WHERE gauge_type_slug = $1 AND area_type = $2 AND is_active = TRUE`,
      [gaugeTypeSlug, areaType]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Gauge type tidak ditemukan atau sudah tidak aktif' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Gauge type "${gaugeTypeSlug}" berhasil dihapus (soft delete)`,
      deleted: true,
      details: {
        areaType,
        gaugeTypeSlug,
        affectedRecords: result.rowCount,
        activeGaugeQRCodesHidden: activeGaugeCount,
        note: activeGaugeCount > 0 
          ? `${activeGaugeCount} gauge QR yang sudah ada tetap dapat digunakan, hanya tidak muncul di form tambah baru`
          : 'Tidak ada gauge QR aktif yang terpengaruh'
      }
    });

  } catch (err: any) {
    console.error('❌ DELETE gauge-types error:', err);
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-role, x-username',
    },
  });
}