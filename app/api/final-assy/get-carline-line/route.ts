import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface CarlineLine {
  carline: string;
  line: string;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch all unique carline-line combinations from history
    const results = await executeQuery<CarlineLine>(
      `SELECT DISTINCT carline, line 
       FROM carline_line_mapping 
       WHERE carline IS NOT NULL AND line IS NOT NULL
       ORDER BY carline ASC, line ASC`,
      []
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching carline-line data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carline-line data' },
      { status: 500 }
    );
  }
}
