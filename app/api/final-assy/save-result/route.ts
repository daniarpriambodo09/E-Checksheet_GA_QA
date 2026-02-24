// app/api/final-assy/save-result/route.ts

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  const client = await pool.connect()

  try {
    const body = await request.json()
    const {
      userId,
      categoryCode,
      itemId,
      dateKey,
      shift,
      status,
      ngDescription,
      ngDepartment,
      areaCode
    } = body

    if (!userId || !categoryCode || !itemId || !dateKey || !shift || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await client.query('BEGIN')

    /* ======================================================
       VALIDASI USER
    ====================================================== */
    const userRes = await client.query(
      `SELECT nik FROM users WHERE id = $1 AND is_active = TRUE`,
      [userId]
    )
    if (userRes.rowCount === 0) {
      throw new Error('Invalid user')
    }
    const nik = userRes.rows[0].nik

    /* ======================================================
       CATEGORY
    ====================================================== */
    const catRes = await client.query(
      `SELECT id FROM checklist_categories WHERE category_code = $1`,
      [categoryCode]
    )
    if (catRes.rowCount === 0) {
      throw new Error('Category not found')
    }
    const categoryId = catRes.rows[0].id

    /* ======================================================
       AREA (OPTIONAL)
    ====================================================== */
    let areaId: number | null = null
    if (areaCode) {
      const areaRes = await client.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE`,
        [areaCode, categoryId]
      )
      if ((areaRes.rowCount ?? 0) > 0) {
        areaId = areaRes.rows[0].id
      }
    }

    const actualItemId = Math.floor(Number(itemId))
    const timeSlot = ''   // 🔒 WAJIB ADA (BIAR TIDAK NULL)

    /* ======================================================
       DELETE MODE
    ====================================================== */
    if (status === '-') {
      await client.query(
        `DELETE FROM checklist_results
         WHERE user_id = $1
           AND category_id = $2
           AND item_id = $3
           AND date_key = $4
           AND shift = $5
           AND COALESCE(time_slot,'') = $6
           AND COALESCE(area_id,-1) = COALESCE($7,-1)`,
        [
          userId,
          categoryId,
          actualItemId,
          dateKey,
          shift,
          timeSlot,
          areaId
        ]
      )

      await client.query('COMMIT')
      return NextResponse.json({ success: true, deleted: true })
    }

    /* ======================================================
       MANUAL UPSERT (AMAN)
    ====================================================== */
    const updateRes = await client.query(
      `UPDATE checklist_results
       SET status = $1,
           ng_description = $2,
           ng_department = $3,
           area_id = $4,
           updated_at = NOW()
       WHERE user_id = $5
         AND category_id = $6
         AND item_id = $7
         AND date_key = $8
         AND shift = $9
         AND COALESCE(time_slot,'') = $10
         AND COALESCE(area_id,-1) = COALESCE($4,-1)`,
      [
        status,
        ngDescription || null,
        ngDepartment || null,
        areaId,
        userId,
        categoryId,
        actualItemId,
        dateKey,
        shift,
        timeSlot
      ]
    )

    if (updateRes.rowCount === 0) {
      await client.query(
        `INSERT INTO checklist_results (
          user_id, nik, category_id, item_id,
          date_key, shift, time_slot,
          status, ng_description, ng_department,
          area_id, submitted_at
        ) VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,
          $8,$9,$10,
          $11,NOW()
        )`,
        [
          userId,
          nik,
          categoryId,
          actualItemId,
          dateKey,
          shift,
          timeSlot,
          status,
          ngDescription || null,
          ngDepartment || null,
          areaId
        ]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true })

  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('❌ SAVE RESULT ERROR:', err.message)
    return NextResponse.json(
      { error: 'Failed to save result', detail: err.message },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}