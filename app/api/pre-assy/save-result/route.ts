// app/api/pre-assy/save-result/route.ts
// UPDATED: Tambah device_code support
// PERUBAHAN DARI VERSI SEBELUMNYA:
//   1. Destructure deviceCode dari body
//   2. Normalize deviceCode → normalizedDeviceCode
//   3. Log deviceCode di console log
//   4. UPDATE query: tambah device_code = $8 (setelah conveyor)
//   5. INSERT query: tambah kolom device_code + value $17 + DO UPDATE device_code
// TIDAK DIUBAH: semua logic lain, conveyor, specificArea, duplicate check, dll.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();

    console.log('🔥 PRE-ASSY SAVE BODY:', JSON.stringify({
      userId:       body.userId,
      categoryCode: body.categoryCode,
      itemId:       body.itemId,
      shift:        body.shift,
      status:       body.status,
      timeSlot:     body.timeSlot,
      areaCode:     body.areaCode,
      carline:      body.carline,
      line:         body.line,
      conveyor:     body.conveyor,
      deviceCode:   body.deviceCode,   // ← [PERUBAHAN 1] log deviceCode
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
      timeSlot,
      areaCode,
      carline,
      line,
      specificArea,
      conveyor,
      deviceCode,   // ← [PERUBAHAN 2] destructure deviceCode dari body
    } = body;

    if (!userId || !categoryCode || itemId === undefined || !dateKey || !shift || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Validate user
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
      return NextResponse.json({ error: `Category not found: ${categoryCode}` }, { status: 404 });
    }
    const categoryId = catRes.rows[0].id;

    // 3. Normalize item_id
    const actualItemId = typeof itemId === 'number'
      ? Math.floor(itemId)
      : Math.floor(parseFloat(itemId));

    // 4. Resolve area_id
    let areaId: number | null = null;
    if (areaCode) {
      const areaRes = await client.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE`,
        [areaCode, categoryId]
      );
      if ((areaRes.rowCount ?? 0) > 0) {
        areaId = areaRes.rows[0].id;
        console.log(`✅ Area resolved: ${areaCode} → id=${areaId}`);
      } else {
        console.warn(`⚠️ Area not found: ${areaCode} for category_id=${categoryId}`);
      }
    }

    // 5. Normalize values
    const normalizedTimeSlot  = (typeof timeSlot === 'string') ? timeSlot.trim() : '';
    const normalizedCarline   = (typeof carline === 'string' && carline.trim()) ? carline.trim() : null;
    const normalizedLine      = (typeof line === 'string' && line.trim()) ? line.trim() : null;
    const specificAreaVal     = (typeof specificArea === 'string' && specificArea.trim())
      ? specificArea.trim() : null;
    const ngPhotosVal         = ngPhotos ? JSON.stringify(ngPhotos) : null;
    const ngDescVal           = ngDescription?.trim() || null;
    const ngDeptVal           = ngDepartment?.trim()  || null;

    // Normalize conveyor
    const normalizedConveyor = (typeof conveyor === 'string' && conveyor.trim())
      ? conveyor.trim()
      : (normalizedCarline || null);

    // ← [PERUBAHAN 3] Normalize deviceCode
    // Terima dari frontend sebagai camelCase (deviceCode),
    // simpan ke DB sebagai snake_case (device_code).
    // null jika tidak dikirim atau kosong.
    const normalizedDeviceCode = (typeof deviceCode === 'string' && deviceCode.trim())
      ? deviceCode.trim()
      : null;

    // 6. Handle DELETE
    if (status === '-') {
      await client.query(
        `DELETE FROM checklist_results
         WHERE user_id     = $1
           AND category_id = $2
           AND item_id     = $3
           AND date_key    = $4
           AND shift       = $5
           AND COALESCE(time_slot, '') = $6
           AND COALESCE(area_id,   -1) = COALESCE($7, -1)
           AND COALESCE(carline,   '') = COALESCE($8, '')
           AND COALESCE(line,      '') = COALESCE($9, '')
           AND COALESCE(specific_area, '') = COALESCE($10, '')`,
        [userId, categoryId, actualItemId, dateKey, shift,
         normalizedTimeSlot, areaId, normalizedCarline, normalizedLine, specificAreaVal]
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, deleted: true });
    }

    // 7. VALIDASI DUPLIKAT GAUGE — ATURAN GLOBAL (tidak diubah)
    if (categoryCode === 'pre-assy-daily-check-ins' && normalizedTimeSlot !== '') {
      const dupRes = await client.query(
        `SELECT
           r.id,
           r.shift,
           r.carline,
           r.line,
           r.conveyor,
           r.specific_area,
           ca.area_name,
           ca.area_code,
           ci.item_check
         FROM checklist_results r
         LEFT JOIN checklist_areas ca ON r.area_id = ca.id
         LEFT JOIN checklist_items  ci ON r.item_id = ci.id
         WHERE r.category_id = $1
           AND r.time_slot   = $2
           AND r.date_key    = $3
           AND NOT (
             COALESCE(r.area_id,           -1) = COALESCE($4, -1)
             AND COALESCE(r.carline,       '') = COALESCE($5, '')
             AND COALESCE(r.line,          '') = COALESCE($6, '')
             AND COALESCE(r.specific_area, '') = COALESCE($7, '')
           )
         ORDER BY r.shift, r.submitted_at DESC
         LIMIT 3`,
        [categoryId, normalizedTimeSlot, dateKey,
         areaId, normalizedCarline, normalizedLine, specificAreaVal]
      );

      if ((dupRes.rowCount ?? 0) > 0) {
        const duplicates = dupRes.rows.map((row: any) => {
          const parts: string[] = [];
          if (row.area_name)  parts.push(row.area_name);
          if (row.specific_area) parts.push(row.specific_area);
          const conveyorLabel = row.conveyor || row.carline;
          if (conveyorLabel)  parts.push(conveyorLabel);
          return {
            description:  parts.join(' / '),
            areaName:     row.area_name     || null,
            specificArea: row.specific_area || null,
            carline:      row.carline       || null,
            conveyor:     row.conveyor      || null,
            line:         row.line          || null,
            shift:        row.shift         || null,
            itemCheck:    row.item_check    || null,
          };
        });
        await client.query('ROLLBACK');
        console.warn(`⚠️ [Pre-Assy Global Dup] gauge=${normalizedTimeSlot} on ${dateKey} — found at different location`);
        return NextResponse.json({ error: 'DUPLICATE_ITEM', duplicates }, { status: 409 });
      }
    }

    // 8. UPSERT — cek existing row berdasarkan kombinasi lokasi
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
       areaId, normalizedCarline, normalizedLine, specificAreaVal]
    );

    if ((existingRow.rowCount ?? 0) > 0) {
      // ← [PERUBAHAN 4] UPDATE: tambah device_code = $8
      // Parameter bergeser: conveyor=$6, device_code=$7, id=$8
      await client.query(
        `UPDATE checklist_results SET
          status         = $1,
          ng_description = $2,
          ng_department  = $3,
          ng_photos      = $4,
          time_slot      = $5,
          conveyor       = $6,
          device_code    = $7,
          updated_at     = NOW()
         WHERE id = $8`,
        [status, ngDescVal, ngDeptVal, ngPhotosVal, normalizedTimeSlot,
         normalizedConveyor, normalizedDeviceCode, existingRow.rows[0].id]
      );
      console.log(
        `✅ [Pre-Assy] UPDATE id=${existingRow.rows[0].id} ` +
        `item=${actualItemId} shift=${shift} conveyor="${normalizedConveyor}" device_code="${normalizedDeviceCode}"`
      );
    } else {
      // ← [PERUBAHAN 5] INSERT: tambah kolom device_code + value $17 + DO UPDATE device_code
      await client.query(
        `INSERT INTO checklist_results (
          user_id, nik, category_id, item_id, date_key, shift,
          time_slot, status, ng_description, ng_department, ng_photos,
          area_id, carline, line, conveyor, specific_area,
          device_code,
          submitted_at, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,
          NOW(),NOW(),NOW()
        )
        ON CONFLICT (
          user_id,
          category_id,
          item_id,
          date_key,
          shift,
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
          area_id        = EXCLUDED.area_id,
          carline        = EXCLUDED.carline,
          line           = EXCLUDED.line,
          conveyor       = EXCLUDED.conveyor,
          specific_area  = EXCLUDED.specific_area,
          device_code    = EXCLUDED.device_code,
          updated_at     = NOW()`,
        [
          userId, nik, categoryId, actualItemId, dateKey, shift,
          normalizedTimeSlot, status, ngDescVal, ngDeptVal, ngPhotosVal,
          areaId, normalizedCarline, normalizedLine, normalizedConveyor, specificAreaVal,
          normalizedDeviceCode,   // ← $17
        ]
      );
      console.log(
        `✅ [Pre-Assy] INSERT item=${actualItemId} (${categoryCode}) ` +
        `area_id=${areaId} conveyor="${normalizedConveyor}" device_code="${normalizedDeviceCode}"`
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, areaId, conveyor: normalizedConveyor });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ PRE-ASSY SAVE ERROR:', err.message, '| code:', err.code);
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