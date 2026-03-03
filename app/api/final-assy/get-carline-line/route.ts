import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface CarlineLine {
  carline: string;
  line: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');
    const categoryCode = searchParams.get('categoryCode');

    if (!areaId) {
      return NextResponse.json(
        { error: 'areaId is required' },
        { status: 400 }
      );
    }

    // Fetch unique carline-line combinations from checklist_results for specific area
    // This ensures we only show carline/line that have been used in that area
    const results = await executeQuery<CarlineLine>(
      `SELECT DISTINCT carline, line 
       FROM checklist_results 
       WHERE area_id = $1 
         AND carline IS NOT NULL 
         AND line IS NOT NULL
       ORDER BY carline ASC, line ASC`,
      [parseInt(areaId)]
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
