// app/api/areas/generate-qr/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import QRCode from 'qrcode';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('categoryCode');

    if (!categoryCode) {
      return NextResponse.json(
        { error: 'Missing categoryCode parameter' },
        { status: 400 }
      );
    }

    // Get all areas for this category
    const areas = await pool.query(
      `SELECT id, area_name, area_code, description 
       FROM checklist_areas 
       WHERE category_id = (SELECT id FROM checklist_categories WHERE category_code = $1)
       AND is_active = TRUE
       ORDER BY sort_order`,
      [categoryCode]
    );

    // Generate QR codes for each area
    const qrCodes = await Promise.all(
      areas.rows.map(async (area: any) => {
        // Generate URL for checksheet
        const checksheetUrl = `${process.env.NEXT_PUBLIC_DEV_ORIGIN || 'http://localhost:3093'}/checksheet-final-assy?areaCode=${area.area_code}&areaName=${encodeURIComponent(area.area_name)}&shift=A`;

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(checksheetUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        return {
          id: area.id,
          area_name: area.area_name,
          area_code: area.area_code,
          description: area.description,
          checksheet_url: checksheetUrl,
          qr_code: qrCodeDataUrl
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: qrCodes.length,
      qrCodes
    });

  } catch (error) {
    console.error('❌ Error generating QR codes:', error);
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Generate single QR code for specific area
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { areaCode, areaName, shift = 'A' } = body;

    if (!areaCode || !areaName) {
      return NextResponse.json(
        { error: 'Missing areaCode or areaName' },
        { status: 400 }
      );
    }

    // Generate URL
    const checksheetUrl = `${process.env.NEXT_PUBLIC_DEV_ORIGIN || 'http://localhost:3093'}/checksheet-final-assy?areaCode=${areaCode}&areaName=${encodeURIComponent(areaName)}&shift=${shift}`;

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(checksheetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return NextResponse.json({
      success: true,
      area_code: areaCode,
      area_name: areaName,
      shift,
      checksheet_url: checksheetUrl,
      qr_code: qrCodeDataUrl
    });

  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}