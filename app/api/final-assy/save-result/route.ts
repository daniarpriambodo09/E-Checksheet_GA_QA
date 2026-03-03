// app/api/final-assy/save-result/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const {
      userId,
      categoryCode,
      itemId,
      dateKey,
      shift,
      status,
      ngDescription,
      ngDepartment,
      areaCode,
      timeSlot = '',
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

    // 2. Get category_id — untuk menyimpan hasil checklist
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
    // GL dan Inspector punya area TERPISAH di DB dengan area_code berbeda:
    //   GL:        "final-assy-gl-genba-a-mazda"    → area_id=1
    //   Inspector: "final-assy-insp-genba-a-mazda"  → area_id=5
    // Harus resolve berdasarkan area_code + category_id agar simpan ke area yang tepat.
    // Jika pakai LIMIT 1 tanpa filter category, bisa dapat area yang salah.
    let areaId: number | null = null;
    if (areaCode) {
      // Cari area dengan category_id yang sesuai (paling tepat)
      let areaRes = await client.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [areaCode, categoryId]
      );

      // Fallback: cari tanpa category filter (backward compat untuk area_code yang unik)
      if ((areaRes.rowCount ?? 0) === 0) {
        areaRes = await client.query(
          `SELECT id FROM checklist_areas
           WHERE area_code = $1 AND is_active = TRUE
           ORDER BY id ASC
           LIMIT 1`,
          [areaCode]
        );
      }

      if ((areaRes.rowCount ?? 0) > 0) {
        areaId = areaRes.rows[0].id;
        console.log('✅ Area resolved:', { areaCode, areaId, categoryId });
      } else {
        await client.query('ROLLBACK');
        console.error('❌ Area not found:', areaCode);
        return NextResponse.json({ error: `Area not found: ${areaCode}` }, { status: 404 });
      }
    }

    const actualItemId = Math.floor(
      typeof itemId === 'number' ? itemId : parseFloat(itemId)
    );
    const ts = timeSlot || '';

    // 4. Handle DELETE
    if (status === '-') {
      if (areaId !== null) {
        await client.query(
          `DELETE FROM checklist_results
           WHERE user_id = $1
             AND category_id = $2
             AND item_id = $3
             AND date_key = $4
             AND shift = $5
             AND COALESCE(time_slot, '') = $6
             AND area_id = $7`,
          [userId, categoryId, actualItemId, dateKey, shift, ts, areaId]
        );
      } else {
        await client.query(
          `DELETE FROM checklist_results
           WHERE user_id = $1
             AND category_id = $2
             AND item_id = $3
             AND date_key = $4
             AND shift = $5
             AND COALESCE(time_slot, '') = $6
             AND area_id IS NULL`,
          [userId, categoryId, actualItemId, dateKey, shift, ts]
        );
      }
      await client.query('COMMIT');
      return NextResponse.json({ success: true, deleted: true });
    }

    // 5. Check existing record
    let existingRes;
    if (areaId !== null) {
      existingRes = await client.query(
        `SELECT id FROM checklist_results
         WHERE user_id = $1
           AND category_id = $2
           AND item_id = $3
           AND date_key = $4
           AND shift = $5
           AND COALESCE(time_slot, '') = $6
           AND area_id = $7`,
        [userId, categoryId, actualItemId, dateKey, shift, ts, areaId]
      );
    } else {
      existingRes = await client.query(
        `SELECT id FROM checklist_results
         WHERE user_id = $1
           AND category_id = $2
           AND item_id = $3
           AND date_key = $4
           AND shift = $5
           AND COALESCE(time_slot, '') = $6
           AND area_id IS NULL`,
        [userId, categoryId, actualItemId, dateKey, shift, ts]
      );
    }

    const isUpdate = (existingRes.rowCount ?? 0) > 0;

    if (isUpdate) {
      if (areaId !== null) {
        await client.query(
          `UPDATE checklist_results
           SET status = $1,
               ng_description = $2,
               ng_department = $3,
               updated_at = NOW()
           WHERE user_id = $4
             AND category_id = $5
             AND item_id = $6
             AND date_key = $7
             AND shift = $8
             AND COALESCE(time_slot, '') = $9
             AND area_id = $10`,
          [
            status, ngDescription?.trim() || null, ngDepartment?.trim() || null,
            userId, categoryId, actualItemId, dateKey, shift, ts, areaId,
          ]
        );
      } else {
        await client.query(
          `UPDATE checklist_results
           SET status = $1,
               ng_description = $2,
               ng_department = $3,
               updated_at = NOW()
           WHERE user_id = $4
             AND category_id = $5
             AND item_id = $6
             AND date_key = $7
             AND shift = $8
             AND COALESCE(time_slot, '') = $9
             AND area_id IS NULL`,
          [
            status, ngDescription?.trim() || null, ngDepartment?.trim() || null,
            userId, categoryId, actualItemId, dateKey, shift, ts,
          ]
        );
      }
    } else {
      await client.query(
        `INSERT INTO checklist_results (
           user_id, nik, category_id, item_id,
           date_key, shift, time_slot, status,
           ng_description, ng_department, area_id,
           submitted_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8,
           $9, $10, $11,
           NOW(), NOW(), NOW()
         )`,
        [
          userId, nik, categoryId, actualItemId,
          dateKey, shift, ts, status,
          ngDescription?.trim() || null,
          ngDepartment?.trim() || null,
          areaId,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ [Save Result] ${isUpdate ? 'Updated' : 'Inserted'} item=${actualItemId} category=${categoryCode} area_id=${areaId}`);

    return NextResponse.json({
      success: true,
      action: isUpdate ? 'updated' : 'inserted',
      data: { userId, categoryId, itemId: actualItemId, dateKey, shift, status, areaId },
    });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ SAVE RESULT ERROR:', err.message, err.code);

    if (err.code === '23505') {
      return NextResponse.json({ error: 'Duplicate record', detail: err.detail }, { status: 409 });
    }
    if (err.code === '23503') {
      return NextResponse.json({ error: 'Invalid reference', detail: err.detail }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to save result', detail: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}