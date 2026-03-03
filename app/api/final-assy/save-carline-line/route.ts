import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface SaveCarlineLineRequest {
  carline: string;
  line: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveCarlineLineRequest = await request.json();
    const { carline, line } = body;

    if (!carline || !line) {
      return NextResponse.json(
        { error: 'Carline and line are required' },
        { status: 400 }
      );
    }

    // Check if this combination already exists
    const existing = await executeQuery(
      `SELECT id FROM carline_line_mapping 
       WHERE carline = $1 AND line = $2`,
      [carline, line]
    );

    // Only insert if it doesn't exist
    if (existing.length === 0) {
      await executeQuery(
        `INSERT INTO carline_line_mapping (carline, line, created_at) 
         VALUES ($1, $2, NOW())`,
        [carline, line]
      );
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
