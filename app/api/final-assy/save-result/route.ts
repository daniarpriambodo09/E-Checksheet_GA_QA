// app/api/final-assy/save-result/route.ts
// Diupdate: terima field `conveyor` dari frontend (untuk inspector mode),
// simpan ke kolom `conveyor` DAN `carline` di checklist_results agar
// get-carline-line dapat membaca data dari kedua kolom (backward compat).
// Diupdate: terima field `device_code` dari frontend (TC21 physical binding),
// simpan ke kolom `device_code` di checklist_results untuk audit trail perangkat.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();

    console.log('📥 [FA Save] Body received:', JSON.stringify({
      userId:       body.userId,
      categoryCode: body.categoryCode,
      itemId:       body.itemId,
      shift:        body.shift,
      status:       body.status,
      specificArea: body.specificArea,
      carline:      body.carline,
      line:         body.line,
      conveyor:     body.conveyor,    // ← field baru
      pattern:      body.pattern,     // ← field baru
      deviceCode:   body.deviceCode,  // ← TC21 device code
      timeSlot:     body.timeSlot,
    }));

    const {
      userId,
      categoryCode,
      itemId,
      dateKey,
      shift,
      status,
      ngDescription,
      ngDepartment,
      ngPhotos,
      areaCode,
      timeSlot = '',
      carline,
      line,
      specificArea,
      conveyor,    // ← field baru dari frontend
      pattern,     // ← field baru dari frontend
      deviceCode,  // ← TC21 physical device code untuk audit trail
    } = body;

    if (!userId || !categoryCode || itemId === undefined || !dateKey || !shift || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validStatuses = ['OK', 'NG', '-'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Validasi user
    const userRes = await client.query(
      `SELECT nik FROM users WHERE id = $1 AND is_active = TRUE`,
      [userId]
    );
    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }
    const nik = userRes.rows[0].nik;

    // 2. Get category_id
    const catRes = await client.query(
      `SELECT id FROM checklist_categories WHERE category_code = $1`,
      [categoryCode]
    );
    if (catRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = catRes.rows[0].id;

    // 3. Resolve area_id
    let areaId: number | null = null;
    if (areaCode) {
      let areaRes = await client.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE LIMIT 1`,
        [areaCode, categoryId]
      );
      if ((areaRes.rowCount ?? 0) === 0) {
        areaRes = await client.query(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND is_active = TRUE ORDER BY id ASC LIMIT 1`,
          [areaCode]
        );
      }
      if ((areaRes.rowCount ?? 0) > 0) {
        areaId = areaRes.rows[0].id;
      } else {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: `Area not found: ${areaCode}` }, { status: 404 });
      }
    }

    // 4. Resolve itemId → DB checklist_items.id (inspector: pakai shift A)
    const rawItemId = Math.floor(
      typeof itemId === 'number' ? itemId : parseFloat(itemId)
    );
    let actualItemId = rawItemId;

    if (categoryCode === 'final-assy-inspector') {
      const itemRes = await client.query(
        `SELECT id FROM checklist_items
         WHERE category_id = $1 AND item_no = $2 AND shift = 'A' AND is_active = TRUE
         ORDER BY sort_order ASC, id ASC LIMIT 1`,
        [categoryId, String(rawItemId)]
      );
      if ((itemRes.rowCount ?? 0) > 0) {
        actualItemId = itemRes.rows[0].id;
      } else {
        const fallbackRes = await client.query(
          `SELECT DISTINCT item_no, MIN(id) as first_id
           FROM checklist_items
           WHERE category_id = $1 AND shift = 'A' AND is_active = TRUE
           GROUP BY item_no ORDER BY MIN(sort_order) ASC`,
          [categoryId]
        );
        const map: Record<string, number> = {};
        fallbackRes.rows.forEach((row: any) => {
          map[String(row.item_no)] = parseInt(row.first_id);
        });
        if (map[String(rawItemId)]) actualItemId = map[String(rawItemId)];
      }
    }

    // 5. Normalize nilai
    const gaugeId         = (typeof timeSlot === 'string') ? timeSlot.trim() : '';
    const ngPhotosVal     = ngPhotos ? JSON.stringify(ngPhotos) : null;
    const ngDescVal       = ngDescription?.trim() || null;
    const ngDeptVal       = ngDepartment?.trim()  || null;
    const specificAreaVal = (typeof specificArea === 'string' && specificArea.trim())
      ? specificArea.trim() : null;

    // ✅ Conveyor normalization:
    // Frontend mengirim `conveyor` (field baru) DAN `carline` (compat lama).
    // Jika conveyor ada → gunakan sebagai nilai utama.
    // carlineVal diisi dengan nilai conveyor juga (agar query lama tetap bisa filter).
    // lineVal dibiarkan null/kosong karena sudah tidak relevan.
    const normalizedConveyor = (typeof conveyor === 'string' && conveyor.trim())
      ? conveyor.trim().toUpperCase()
      : (typeof carline === 'string' && carline.trim())
        ? carline.trim().toUpperCase()
        : null;

    const carlineVal    = normalizedConveyor;   // isi carline = conveyor (compat)
    const lineVal: null = null;                  // line selalu null untuk conveyor mode

    // device_code: dari TC21 physical binding — null untuk desktop/browser biasa
    const deviceCodeVal = (typeof deviceCode === 'string' && deviceCode.trim())
      ? deviceCode.trim().toUpperCase()
      : null;

    console.log(
      `✅ [FA Save] gaugeId="${gaugeId}" specificArea="${specificAreaVal}" ` +
      `conveyor="${normalizedConveyor}"`
    );

    // 6. Handle DELETE
    if (status === '-') {
      await client.query(
        `DELETE FROM checklist_results
         WHERE user_id     = $1
           AND category_id = $2
           AND item_id     = $3
           AND date_key    = $4
           AND shift       = $5
           AND COALESCE(area_id,       -1) = COALESCE($6, -1)
           AND COALESCE(carline,       '') = COALESCE($7, '')
           AND COALESCE(line,          '') = COALESCE($8, '')
           AND COALESCE(specific_area, '') = COALESCE($9, '')`,
        [userId, categoryId, actualItemId, dateKey, shift,
         areaId, carlineVal, lineVal, specificAreaVal]
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, deleted: true });
    }

    // 7. VALIDASI DUPLIKAT GAUGE
    if (categoryCode === 'final-assy-inspector' && gaugeId !== '') {
      const dupRes = await client.query(
        `SELECT
           r.id, r.carline, r.line, r.conveyor, r.specific_area,
           ca.area_name, ci.item_check
         FROM checklist_results r
         LEFT JOIN checklist_areas ca ON r.area_id = ca.id
         LEFT JOIN checklist_items  ci ON r.item_id = ci.id
         WHERE r.user_id     = $1
           AND r.category_id = $2
           AND r.time_slot   = $3
           AND r.date_key    = $4
           AND r.shift       = $5
           AND NOT (
             COALESCE(r.area_id,           -1) = COALESCE($6,  -1)
             AND COALESCE(r.carline,       '') = COALESCE($7,  '')
             AND COALESCE(r.line,          '') = COALESCE($8,  '')
             AND COALESCE(r.specific_area, '') = COALESCE($9,  '')
           )
         LIMIT 3`,
        [userId, categoryId, gaugeId, dateKey, shift,
         areaId, carlineVal, lineVal, specificAreaVal]
      );

      if ((dupRes.rowCount ?? 0) > 0) {
        const duplicates = dupRes.rows.map((row: any) => {
          const parts: string[] = [];
          if (row.area_name) parts.push(row.area_name);
          // Tampilkan conveyor atau carline sebagai label lokasi
          const cvLabel = row.conveyor || row.carline;
          if (cvLabel) parts.push(cvLabel);
          if (row.specific_area) parts.push(row.specific_area);
          return {
            description:  parts.join(' / '),
            areaName:     row.area_name     || null,
            conveyor:     row.conveyor      || row.carline || null,
            carline:      row.carline       || null,
            line:         row.line          || null,
            specificArea: row.specific_area || null,
            itemCheck:    row.item_check    || null,
          };
        });
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'DUPLICATE_ITEM', duplicates }, { status: 409 });
      }
    }

    // 8. UPSERT — cek existing row berdasarkan lokasi
    const existingRow = await client.query(
      `SELECT id FROM checklist_results
       WHERE user_id     = $1
         AND category_id = $2
         AND item_id     = $3
         AND date_key    = $4
         AND shift       = $5
         AND COALESCE(area_id,       -1) = COALESCE($6, -1)
         AND COALESCE(carline,       '') = COALESCE($7, '')
         AND COALESCE(line,          '') = COALESCE($8, '')
         AND COALESCE(specific_area, '') = COALESCE($9, '')
       LIMIT 1`,
      [userId, categoryId, actualItemId, dateKey, shift,
       areaId, carlineVal, lineVal, specificAreaVal]
    );

    if ((existingRow.rowCount ?? 0) > 0) {
      // UPDATE — update juga kolom conveyor dan pattern
      await client.query(
        `UPDATE checklist_results SET
          status         = $1,
          ng_description = $2,
          ng_department  = $3,
          ng_photos      = $4,
          time_slot      = $5,
          conveyor       = $6,
          pattern        = $7,
          device_code    = COALESCE($8, device_code),
          updated_at     = NOW()
         WHERE id = $9`,
        [status, ngDescVal, ngDeptVal, ngPhotosVal, gaugeId,
         normalizedConveyor, pattern, deviceCodeVal, existingRow.rows[0].id]
      );
      console.log(
        `✅ [FA Save] UPDATE id=${existingRow.rows[0].id} ` +
        `item=${actualItemId} shift=${shift} conveyor="${normalizedConveyor}"`
      );
    } else {
      // INSERT — sertakan kolom conveyor dan pattern
      await client.query(
        `INSERT INTO checklist_results (
          user_id, nik, category_id, item_id,
          date_key, shift, time_slot, status,
          ng_description, ng_department, ng_photos,
          area_id, carline, line, conveyor, specific_area, pattern,
          device_code,
          submitted_at, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
          NOW(),NOW(),NOW()
        )
        ON CONFLICT (
          user_id, category_id, item_id, date_key, shift,
          COALESCE(time_slot,     ''::character varying),
          COALESCE(area_id,       '-1'::integer),
          COALESCE(carline,       ''::character varying),
          COALESCE(line,          ''::character varying),
          COALESCE(specific_area, ''::character varying)
        )
        DO UPDATE SET
          status         = EXCLUDED.status,
          ng_description = EXCLUDED.ng_description,
          ng_department  = EXCLUDED.ng_department,
          ng_photos      = EXCLUDED.ng_photos,
          time_slot      = EXCLUDED.time_slot,
          specific_area  = EXCLUDED.specific_area,
          conveyor       = EXCLUDED.conveyor,
          carline        = EXCLUDED.carline,
          pattern        = EXCLUDED.pattern,
          device_code    = COALESCE(EXCLUDED.device_code, checklist_results.device_code),
          updated_at     = NOW()`,
        [
          userId, nik, categoryId, actualItemId,
          dateKey, shift, gaugeId, status,
          ngDescVal, ngDeptVal, ngPhotosVal,
          areaId, carlineVal, lineVal, normalizedConveyor, specificAreaVal, pattern,
          deviceCodeVal,
        ]
      );
      console.log(
        `✅ [FA Save] INSERT item=${actualItemId} shift=${shift} ` +
        `conveyor="${normalizedConveyor}" specific_area="${specificAreaVal}"`
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        userId, categoryId, itemId: actualItemId, rawItemId,
        dateKey, shift, status, areaId,
        specificArea: specificAreaVal,
        conveyor:     normalizedConveyor,
        deviceCode:   deviceCodeVal,
        gaugeId,
      },
    });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ FA SAVE RESULT ERROR:', err.message, err.code);
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Duplicate record', detail: err.detail }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to save result', detail: err.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}