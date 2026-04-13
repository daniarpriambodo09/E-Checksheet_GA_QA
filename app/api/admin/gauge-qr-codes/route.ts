// app/api/admin/gauge-qr-codes/route.ts
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

// ── GET: list semua gauge QR codes (optional filter: ?areaType=pre-assy) ──────
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const areaType = searchParams.get('areaType'); // 'pre-assy' | 'final-assy' | null

    const query = areaType
      ? `SELECT * FROM gauge_qr_codes WHERE is_active = TRUE AND area_type = $1 ORDER BY gauge_type_id, seq_number`
      : `SELECT * FROM gauge_qr_codes WHERE is_active = TRUE ORDER BY area_type, gauge_type_id, seq_number`;

    const result = areaType
      ? await pool.query(query, [areaType])
      : await pool.query(query);

    return NextResponse.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err: any) {
    console.error('❌ GET gauge-qr-codes error:', err);
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

// ── POST: tambah gauge QR code baru ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await checkAdminAuth(request);
    if (!authorized || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await request.json();
    const {
      gaugeTypeId, gaugeTypeSlug, gaugeTypeName,
      areaType, gaugeId, qrValue, displayName, seqNumber, notes,
    } = body;

    if (!gaugeTypeId || !areaType || !gaugeId || !qrValue || !displayName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['pre-assy', 'final-assy'].includes(areaType)) {
      return NextResponse.json({ error: 'Invalid areaType' }, { status: 400 });
    }

    // Cek duplikat gauge_id atau qr_value
    const dup = await pool.query(
      `SELECT id, gauge_id FROM gauge_qr_codes WHERE (gauge_id = $1 OR qr_value = $2) AND is_active = TRUE`,
      [gaugeId, qrValue]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { error: `Gauge ID "${dup.rows[0].gauge_id}" sudah digunakan.` },
        { status: 409 }
      );
    }

    const result = await pool.query(
      `INSERT INTO gauge_qr_codes
         (gauge_type_id, gauge_type_slug, gauge_type_name, area_type, gauge_id, qr_value,
          display_name, seq_number, notes, created_by, created_at, updated_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW(),TRUE)
       RETURNING id, gauge_id, qr_value, created_at`,
      [gaugeTypeId, gaugeTypeSlug, gaugeTypeName, areaType, gaugeId, qrValue,
       displayName, seqNumber ?? 1, notes ?? null, String(user.id)]
    );

    return NextResponse.json({
      success: true,
      message: `Gauge QR "${gaugeId}" berhasil ditambahkan.`,
      data: result.rows[0],
    });
  } catch (err: any) {
    console.error('❌ POST gauge-qr-codes error:', err);
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Gauge ID atau QR value sudah ada.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

// ── PATCH: update gauge_id / display_name / notes ────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await request.json();
    const { id, gaugeId, displayName, notes } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Recalculate qr_value dari gaugeId baru jika berubah
    // qr_value = "DCI-{gauge_type_id}-{gaugeId}"
    const existing = await pool.query(
      `SELECT gauge_type_id, gauge_id FROM gauge_qr_codes WHERE id = $1 AND is_active = TRUE`,
      [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    const { gauge_type_id, gauge_id: oldGaugeId } = existing.rows[0];

    // Cek duplikat gauge_id baru (jika berubah)
    if (gaugeId && gaugeId !== oldGaugeId) {
      const dup = await pool.query(
        `SELECT id FROM gauge_qr_codes WHERE gauge_id = $1 AND is_active = TRUE AND id != $2`,
        [gaugeId, id]
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ error: `Gauge ID "${gaugeId}" sudah digunakan.` }, { status: 409 });
      }
    }

    const newGaugeId    = gaugeId ?? oldGaugeId;
    const newQrValue    = `DCI-${gauge_type_id}-${newGaugeId}`;

    const result = await pool.query(
      `UPDATE gauge_qr_codes
       SET gauge_id     = $1,
           qr_value     = $2,
           display_name = COALESCE($3, display_name),
           notes        = $4,
           updated_at   = NOW()
       WHERE id = $5 AND is_active = TRUE
       RETURNING id, gauge_id, qr_value, display_name, updated_at`,
      [newGaugeId, newQrValue, displayName ?? null, notes ?? null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Gauge QR berhasil diperbarui.',
      data: result.rows[0],
    });
  } catch (err: any) {
    console.error('❌ PATCH gauge-qr-codes error:', err);
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Gauge ID sudah ada.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

// ── DELETE: soft-delete ───────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth(request);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const result = await pool.query(
      `UPDATE gauge_qr_codes SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Gauge QR berhasil dihapus.', deletedId: id });
  } catch (err: any) {
    console.error('❌ DELETE gauge-qr-codes error:', err);
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-role, x-username',
    },
  });
}