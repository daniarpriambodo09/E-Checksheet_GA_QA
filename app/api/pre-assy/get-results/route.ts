// app/api/pre-assy/get-results/route.ts
// UPDATED: Tambah device_code support
// PERUBAHAN DARI VERSI SEBELUMNYA:
//   1. SELECT query: tambah r.device_code
//   2. formatted object: tambah deviceCode: row.device_code || null
// TIDAK DIUBAH: semua logic lain, filter conveyor, specificArea, CC Stripping, dll.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const CS_REMOVE_DBID_TO_FRONTEND_ID: Record<number, string> = {
  1102: "1-X-1-A", 1103: "1-X-1-B", 1104: "1-X-2-A", 1105: "1-X-2-B",
  1106: "1-X-3-A", 1107: "1-X-3-B", 1108: "1-X-4-A", 1109: "1-X-4-B",
  1110: "2-X-1-A", 1111: "2-X-1-B", 1112: "2-X-2-A", 1113: "2-X-2-B",
  1114: "2-X-3-A", 1115: "2-X-3-B", 1116: "2-X-4-A", 1117: "2-X-4-B",
  1118: "3-X-1-A", 1119: "3-X-1-B", 1120: "3-X-2-A", 1121: "3-X-2-B",
  1122: "3-X-3-A", 1123: "3-X-3-B", 1124: "3-X-4-A", 1125: "3-X-4-B",
  1126: "4-X-1-A", 1127: "4-X-1-B", 1128: "4-X-2-A", 1129: "4-X-2-B",
  1130: "4-X-3-A", 1131: "4-X-3-B", 1132: "4-X-4-A", 1133: "4-X-4-B",
  1134: "5-X-1-A", 1135: "5-X-1-B", 1136: "5-X-2-A", 1137: "5-X-2-B",
  1138: "5-X-3-A", 1139: "5-X-3-B", 1140: "5-X-4-A", 1141: "5-X-4-B",
  1142: "6-X-1-A", 1143: "6-X-1-B", 1144: "6-X-2-A", 1145: "6-X-2-B",
  1146: "6-X-3-A", 1147: "6-X-3-B", 1148: "6-X-4-A", 1149: "6-X-4-B",
  1150: "7-X-1-A", 1151: "7-X-1-B", 1152: "7-X-2-A", 1153: "7-X-2-B",
  1154: "7-X-3-A", 1155: "7-X-3-B", 1156: "7-X-4-A", 1157: "7-X-4-B",
  1158: "8-X-1-A", 1159: "8-X-1-B", 1160: "8-X-2-A", 1161: "8-X-2-B",
  1162: "8-X-3-A", 1163: "8-X-3-B", 1164: "8-X-4-A", 1165: "8-X-4-B",
  1166: "9-X-1-A", 1167: "9-X-1-B", 1168: "9-X-2-A", 1169: "9-X-2-B",
  1170: "9-X-3-A", 1171: "9-X-3-B", 1172: "9-X-4-A", 1173: "9-X-4-B",
  1174: "10-X-1-A", 1175: "10-X-1-B", 1176: "10-X-2-A", 1177: "10-X-2-B",
  1178: "10-X-3-A", 1179: "10-X-3-B", 1180: "10-X-4-A", 1181: "10-X-4-B",
  1182: "11-X-1-A", 1183: "11-X-1-B", 1184: "11-X-2-A", 1185: "11-X-2-B",
  1186: "11-X-3-A", 1187: "11-X-3-B", 1188: "11-X-4-A", 1189: "11-X-4-B",
  1190: "12-X-1-A", 1191: "12-X-1-B", 1192: "12-X-2-A", 1193: "12-X-2-B",
  1194: "12-X-3-A", 1195: "12-X-3-B", 1196: "12-X-4-A", 1197: "12-X-4-B",
  1198: "13-X-1-A", 1199: "13-X-1-B", 1200: "13-X-2-A", 1201: "13-X-2-B",
  1202: "13-X-3-A", 1203: "13-X-3-B", 1204: "13-X-4-A", 1205: "13-X-4-B",
  1206: "14-X-1-A", 1207: "14-X-1-B", 1208: "14-X-2-A", 1209: "14-X-2-B",
  1210: "14-X-3-A", 1211: "14-X-3-B", 1212: "14-X-4-A", 1213: "14-X-4-B",
  1214: "15-R-1-A", 1215: "15-R-1-B", 1216: "15-R-2-A", 1217: "15-R-2-B",
  1218: "15-R-3-A", 1219: "15-R-3-B",
  1220: "15-G-1-A", 1221: "15-G-1-B", 1222: "15-G-2-A", 1223: "15-G-2-B",
  1224: "15-G-3-A", 1225: "15-G-3-B",
  1226: "15-W-1-A", 1227: "15-W-1-B", 1228: "15-W-2-A", 1229: "15-W-2-B",
  1230: "15-W-3-A", 1231: "15-W-3-B",
  1232: "15-Y-1-A", 1233: "15-Y-1-B", 1234: "15-Y-2-A", 1235: "15-Y-2-B",
  1236: "15-Y-3-A", 1237: "15-Y-3-B",
  1238: "16-X-1-A", 1239: "16-X-1-B", 1240: "16-X-2-A", 1241: "16-X-2-B",
  1242: "16-X-3-A", 1243: "16-X-3-B",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId       = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month        = searchParams.get('month');
    const areaCode     = searchParams.get('areaCode');
    const carline      = searchParams.get('carline');
    const timeSlot     = searchParams.get('timeSlot');
    const conveyor     = searchParams.get('conveyor');
    const specificArea = searchParams.get('specificArea');

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [userId]
    );
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    const categoryResult = await pool.query(
      'SELECT id FROM checklist_categories WHERE category_code = $1', [categoryCode]
    );
    if (categoryResult.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categoryResult.rows[0].id;

    // ── Resolve area_id ───────────────────────────────────────────────
    let areaId: number | null = null;
    const conditions: string[] = ['r.user_id = $1', 'r.category_id = $2', 'r.date_key LIKE $3'];
    const params: any[] = [userId, categoryId, `${month}%`];

    if (areaCode) {
      const areaResult = await pool.query(
        `SELECT id FROM checklist_areas
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE`,
        [areaCode, categoryId]
      );
      if (areaResult.rows.length > 0) {
        areaId = areaResult.rows[0].id;
        params.push(areaId);
        conditions.push(`r.area_id = $${params.length}`);
      }
    }

    // ── Filter conveyor ───────────────────────────────────────────────
    const conveyorValue =
      (conveyor && conveyor.trim()) ? conveyor.trim() :
      (carline  && carline.trim())  ? carline.trim()  :
      null;

    if (conveyorValue) {
      params.push(conveyorValue);
      conditions.push(
        `COALESCE(NULLIF(r.conveyor, ''), NULLIF(r.carline, '')) = $${params.length}`
      );
      console.log(
        `✅ [Pre-Assy Get Results] Filter conveyor="${conveyorValue}" ` +
        `category=${categoryCode} area=${areaCode ?? 'ALL'}`
      );
    } else {
      console.warn(`⚠️ [Pre-Assy Get Results] No conveyor param — returning empty`);
      return NextResponse.json({
        success: true, formatted: {}, count: 0,
        areaCode: areaCode || null, areaId,
        conveyor: null,
        warning: 'No conveyor filter — empty result returned',
      });
    }

    // ── Filter time slot (CC Stripping) ──────────────────────────────
    if (timeSlot && categoryCode === 'pre-assy-cc-stripping-gl') {
      params.push(timeSlot.trim());
      conditions.push(`r.time_slot = $${params.length}`);
    }

    // ── Filter specific area (Daily Check Ins) ────────────────────────
    if (specificArea && categoryCode === 'pre-assy-daily-check-ins') {
      params.push(specificArea.trim());
      conditions.push(`COALESCE(r.specific_area, '') = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // ← [PERUBAHAN 1] Tambah r.device_code di SELECT
    const resultsQuery = await pool.query(
      `SELECT
         r.date_key, r.item_id, r.shift, r.status,
         r.ng_description, r.ng_department, r.ng_photos,
         r.submitted_at, r.time_slot, r.area_id,
         r.carline, r.line, r.specific_area, r.conveyor,
         r.device_code,
         COALESCE(u.full_name, u.username, 'System') AS submitted_by_name
       FROM checklist_results r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE ${whereClause}
       ORDER BY r.date_key, r.item_id, r.shift`,
      params
    );

    const isCCStripping   = categoryCode === 'pre-assy-cc-stripping-gl';
    const isDailyCheckIns = categoryCode === 'pre-assy-daily-check-ins';
    const isCSRemoveTool  = categoryCode === 'pre-assy-cs-remove-tool';

    const formatted: Record<string, Record<string, any>> = {};

    resultsQuery.rows.forEach((row: any) => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};

      let itemKey: string;

      if (isCSRemoveTool) {
        const frontendId = CS_REMOVE_DBID_TO_FRONTEND_ID[row.item_id];
        itemKey = frontendId ?? `${row.item_id}-${row.shift}`;

      } else if (isDailyCheckIns) {
        const rowSpecArea = row.specific_area || 'TENSILE';
        itemKey = `${row.item_id}-${rowSpecArea}-${row.shift}`;

      } else if (isCCStripping) {
        itemKey = row.time_slot && row.time_slot !== ''
          ? `${row.item_id}-${row.shift}-${row.time_slot}`
          : `${row.item_id}-${row.shift}`;

      } else {
        itemKey = row.time_slot
          ? `${row.item_id}-${row.shift}-${row.time_slot}`
          : `${row.item_id}-${row.shift}`;
      }

      // ← [PERUBAHAN 2] Tambah deviceCode: row.device_code || null
      formatted[row.date_key][itemKey] = {
        status:        row.status,
        ngCount:       row.status === 'NG' ? 1 : 0,
        items:         [],
        notes:         '',
        submittedAt:   row.submitted_at,
        submittedBy:   row.submitted_by_name || 'System',
        ngDescription: row.ng_description || '',
        ngDepartment:  row.ng_department  || 'QA',
        ngPhotos:      row.ng_photos      || null,
        areaId:        row.area_id,
        conveyor:      row.conveyor || row.carline || '',
        carline:       row.carline || '',
        line:          row.line    || '',
        specificArea:  row.specific_area || null,
        deviceCode:    row.device_code   || null,   // ← TAMBAHAN
      };
    });

    console.log(
      `✅ [Pre-Assy Get Results] ${resultsQuery.rows.length} rows | ` +
      `${categoryCode} | conveyor="${conveyorValue}" | specificArea=${specificArea ?? 'ALL'}`
    );

    return NextResponse.json({
      success:      true,
      formatted,
      areaCode:     areaCode || null,
      areaId,
      count:        resultsQuery.rows.length,
      conveyor:     conveyorValue,
      carline:      carline || null,
      line:         null,
    });

  } catch (error) {
    console.error('❌ Get results error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}