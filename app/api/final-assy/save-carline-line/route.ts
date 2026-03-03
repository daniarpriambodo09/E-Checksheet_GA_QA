import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface SaveCarlineLineRequest {
  carline: string;
  line: string;
  areaId?: number;
  userId?: string;
  categoryCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveCarlineLineRequest = await request.json();
    const { carline, line, areaId, userId, categoryCode } = body;

    if (!carline || !line) {
      return NextResponse.json(
        { error: 'Carline and line are required' },
        { status: 400 }
      );
    }

    // Save to carline_line_mapping for history tracking
    if (userId && categoryCode) {
      const existing = await executeQuery(
        `SELECT id FROM carline_line_mapping 
         WHERE user_id = $1 AND carline = $2 AND line = $3 AND category_code = $4`,
        [userId, carline, line, categoryCode]
      );

      if (existing.length === 0) {
        await executeQuery(
          `INSERT INTO carline_line_mapping (user_id, carline, line, category_code, is_active, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())`,
          [userId, carline, line, categoryCode]
        );
      } else {
        // Update is_active if it was previously disabled
        await executeQuery(
          `UPDATE carline_line_mapping 
           SET is_active = TRUE, updated_at = NOW()
           WHERE user_id = $1 AND carline = $2 AND line = $3 AND category_code = $4`,
          [userId, carline, line, categoryCode]
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Carline and line saved successfully' 
    });
  } catch (error) {
    console.error('Error saving carline-line data:', error);
    return NextResponse.json(
      { error: 'Failed to save carline-line data' },
      { status: 500 }
    );
  }
}
