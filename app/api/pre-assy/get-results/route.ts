// app/api/pre-assy/get-results/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Mapping dbId → frontend string ID untuk CS Remove Tool
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

  // EXTRACTION JIG (NO 15)
  1214: "15-R-1-A",
  1215: "15-G-1-A",
  1216: "15-W-1-A",
  1217: "15-Y-1-A",
  1218: "15-W-1-B",
  1219: "15-R-1-B",
  1220: "15-G-1-B",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const categoryCode = searchParams.get('categoryCode');
    const month = searchParams.get('month');
    const areaCode = searchParams.get('areaCode');

    if (!userId || !categoryCode || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validasi user
    const userCheckResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );
    if (userCheckResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 });
    }

    // Ambil category_id
    const categoryResult = await pool.query(
      'SELECT id FROM checklist_categories WHERE category_code = $1',
      [categoryCode]
    );
    if (categoryResult.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    const categoryId = categoryResult.rows[0].id;

    // =========================================================
    // 🔹 BUILD QUERY - Filter area di checklist_results.area_id
    // =========================================================
    let areaCondition = '';
    let areaParams: any[] = [];
    let areaId: number | null = null;

    if (areaCode) {
      const areaResult = await pool.query(
        `SELECT id FROM checklist_areas 
         WHERE area_code = $1 AND category_id = $2 AND is_active = TRUE`,
        [areaCode, categoryId]
      );

      if (areaResult.rows.length > 0) {
        areaId = areaResult.rows[0].id;
        areaCondition = 'AND r.area_id = $4';
        areaParams = [areaId];
        console.log(`✅ Filtering by area_id: ${areaId} (${areaCode})`);
      } else {
        console.warn(`⚠️ Area tidak ditemukan: ${areaCode}`);
      }
    }

    // Query ke checklist_results
    const resultsQuery = await pool.query(
      `SELECT 
         r.date_key, 
         r.item_id, 
         r.shift, 
         r.status, 
         r.ng_description, 
         r.ng_department, 
         r.submitted_at, 
         r.time_slot,
         r.area_id
       FROM checklist_results r
       WHERE r.user_id = $1  
         AND r.category_id = $2 
         AND r.date_key LIKE $3 
         ${areaCondition}
       ORDER BY r.date_key, r.item_id, r.shift`,
      [userId, categoryId, `${month}%`, ...areaParams]
    );

    const isCSRemoveTool = categoryCode === 'pre-assy-cs-remove-tool';
    const isDailyCheckIns = categoryCode === 'pre-assy-daily-check-ins';
    const isCCStripping = categoryCode === 'pre-assy-cc-stripping-gl';

    const formatted: Record<string, Record<string, any>> = {};

    resultsQuery.rows.forEach((row: any) => {
      if (!formatted[row.date_key]) formatted[row.date_key] = {};

      let itemKey: string;

      if (isCSRemoveTool) {
        // Convert db item_id ke frontend string ID
        const frontendId = CS_REMOVE_DBID_TO_FRONTEND_ID[row.item_id];
        if (frontendId) {
          itemKey = frontendId;
        } else {
          console.warn(`⚠️ item_id ${row.item_id} tidak ditemukan di mapping`);
          itemKey = `${row.item_id}-${row.shift}`;
        }
      } else if (isDailyCheckIns) {
        // Daily Check Ins: gunakan time_slot sebagai checkpointId
        if (row.time_slot) {
          itemKey = `${row.time_slot}-${row.shift}`;
        } else {
          itemKey = `${row.item_id}-${row.shift}`;
        }
      } else if (isCCStripping) {
        // ✅ FIX: CC Stripping PAKAI time_slot karena frontend renderStatusCell
        // membentuk key dengan format: `${baseId}-${shift}-${timeSlot}`
        // Contoh: "1-A-01.00", "1-A-04.00", dst
        if (row.time_slot && row.time_slot !== '') {
          itemKey = `${row.item_id}-${row.shift}-${row.time_slot}`;
        } else {
          // Fallback untuk data lama yang tersimpan tanpa time_slot
          itemKey = `${row.item_id}-${row.shift}`;
        }
      } else {
        itemKey = row.time_slot
          ? `${row.item_id}-${row.shift}-${row.time_slot}`
          : `${row.item_id}-${row.shift}`;
      }

      formatted[row.date_key][itemKey] = {
        status: row.status,
        ngCount: row.status === 'NG' ? 1 : 0,
        items: [],
        notes: '',
        submittedAt: row.submitted_at,
        submittedBy: 'System',
        ngDescription: row.ng_description || '',
        ngDepartment: row.ng_department || 'QA',
        areaId: row.area_id
      };
    });

    console.log(`✅ Loaded ${resultsQuery.rows.length} results for ${categoryCode}`);

    return NextResponse.json({ 
      success: true, 
      formatted,
      areaCode: areaCode || null,
      areaId: areaId,
      count: resultsQuery.rows.length
    });
  } catch (error) {
    console.error('❌ Get results error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}