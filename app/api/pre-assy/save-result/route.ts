// app/api/pre-assy/save-result/route.ts

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  const client = await pool.connect()

  try {
    const body = await request.json()

    console.log("🔥 SAVE RESULT BODY:", body)

    const {
      userId,
      categoryCode,
      itemId,
      dateKey,
      shift,
      status,
      ngDescription,
      ngDepartment,
      timeSlot,
      areaCode
    } = body

    /* ======================================================
       VALIDATION
    ====================================================== */
    if (
      !userId ||
      !categoryCode ||
      itemId === undefined ||
      !dateKey ||
      !shift ||
      !status
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await client.query('BEGIN')

    /* ======================================================
       VALIDATE USER
    ====================================================== */
    const userRes = await client.query(
      `SELECT nik FROM users 
       WHERE id = $1 AND is_active = TRUE`,
      [userId]
    )

    if (userRes.rowCount === 0) {
      throw new Error('Invalid user')
    }

    const nik = userRes.rows[0].nik

    /* ======================================================
       GET CATEGORY
    ====================================================== */
    const catRes = await client.query(
      `SELECT id FROM checklist_categories 
       WHERE category_code = $1`,
      [categoryCode]
    )

    if (catRes.rowCount === 0) {
      throw new Error('Category not found')
    }

    const categoryId = catRes.rows[0].id

    /* ======================================================
       NORMALIZE ITEM ID
    ====================================================== */
    const actualItemId =
      typeof itemId === 'number'
        ? Math.floor(itemId)
        : Math.floor(parseFloat(itemId))

    /* ======================================================
       RESOLVE AREA
    ====================================================== */
    let areaId: number | null = null

    if (areaCode) {
      const areaRes = await client.query(
        `SELECT id 
         FROM checklist_areas
         WHERE area_code = $1
           AND category_id = $2
           AND is_active = TRUE`,
        [areaCode, categoryId]
      )

      if (areaRes.rowCount != null && areaRes.rowCount > 0) {
        areaId = areaRes.rows[0].id
      }
    }

    /* ======================================================
       NORMALIZE TIME SLOT
       Semua kategori gunakan timeSlot dari request.
       Jika tidak ada, default ke string kosong ''.
    ====================================================== */
    const normalizedTimeSlot = timeSlot ?? ''

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
           AND time_slot = $6
           AND COALESCE(area_id,-1) = COALESCE($7,-1)`,
        [
          userId,
          categoryId,
          actualItemId,
          dateKey,
          shift,
          normalizedTimeSlot,
          areaId
        ]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        deleted: true
      })
    }

    /* ======================================================
       ✅ UPSERT YANG BENAR
       
       PENYEBAB DOUBLE NG:
       Ketika user pilih "NG", frontend memanggil saveResultToDB DUA KALI:
         1. Di handleStatusChange → save "NG" dengan ngDescription kosong
         2. Di saveNgReport (setelah modal) → save "NG" lagi dengan ngDescription terisi

       Upsert ini HARUS selalu UPDATE jika sudah ada record dengan
       kombinasi (user_id, category_id, item_id, date_key, shift, time_slot, area_id)
       yang sama — tidak boleh INSERT baru.

       ✅ SOLUSI: Gunakan INSERT ... ON CONFLICT DO UPDATE dengan
       conflict target yang benar menggunakan expression index.
    ====================================================== */
    await client.query(
      `
      INSERT INTO checklist_results (
        user_id,
        nik,
        category_id,
        item_id,
        date_key,
        shift,
        time_slot,
        status,
        ng_description,
        ng_department,
        area_id,
        submitted_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()
      )
      ON CONFLICT (
        user_id,
        category_id,
        item_id,
        date_key,
        shift,
        time_slot,
        COALESCE(area_id,-1)
      )
      DO UPDATE SET
        status        = EXCLUDED.status,
        ng_description = EXCLUDED.ng_description,
        ng_department  = EXCLUDED.ng_department,
        area_id        = EXCLUDED.area_id,
        updated_at     = NOW()
      `,
      [
        userId,
        nik,
        categoryId,
        actualItemId,
        dateKey,
        shift,
        normalizedTimeSlot,
        status,
        ngDescription?.trim() || null,
        ngDepartment?.trim() || null,
        areaId
      ]
    )

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      areaId
    })

  } catch (err: any) {
    await client.query('ROLLBACK')

    console.error('❌ PRE-ASSY SAVE ERROR:', err.message)

    return NextResponse.json(
      { error: 'Failed to save result', detail: err.message },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}