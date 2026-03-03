import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db-helpers';

interface AreaResult {
  id: number;
  area_code: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaCode = searchParams.get('areaCode');

    if (!areaCode) {
      return NextResponse.json(
        { error: 'areaCode is required' },
        { status: 400 }
      );
    }

    // Query database to get area_id from area_code
    const results = await executeQuery<AreaResult>(
      `SELECT id FROM areas WHERE area_code = $1 LIMIT 1`,
      [areaCode]
    );

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'Area not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: results[0].id });
  } catch (error) {
    console.error('Error fetching area_id:', error);
    return NextResponse.json(
      { error: 'Failed to fetch area_id' },
      { status: 500 }
    );
  }
}
