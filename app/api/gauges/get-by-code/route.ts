// app/api/gauges/get-by-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// =====================================================================
// === AUTHENTICATION CHECK HELPER ===
// =====================================================================
function checkAuth(request: NextRequest): { authenticated: boolean; userId?: string; error?: string } {
  try {
    // Check session token dari header atau localStorage (via cookie)
    const sessionToken = request.headers.get('authorization') || 
                         request.headers.get('x-session-token');
    
    // Jika tidak ada token, cek dari cookies (jika ada)
    if (!sessionToken) {
      const cookies = request.cookies;
      const token = cookies.get('auth_session_token')?.value;
      if (token) {
        return { authenticated: true };
      }
      
      // ⚠️ Untuk development, bisa bypass auth (HAPUS di production!)
      // return { authenticated: true };
      
      return { 
        authenticated: false, 
        error: 'Unauthorized - No session token found' 
      };
    }
    
    // Validasi token format (optional - bisa diperkuat dengan JWT verification)
    if (!sessionToken.startsWith('sess_')) {
      console.warn('⚠️ Invalid token format:', sessionToken.substring(0, 10) + '...');
      // Tetap allow untuk sekarang (bisa diperketat nanti)
    }
    
    return { authenticated: true };
  } catch (error) {
    console.error('❌ Auth check error:', error);
    return { 
      authenticated: false, 
      error: 'Authentication check failed' 
    };
  }
}

// =====================================================================
// === MAIN API HANDLER ===
// =====================================================================
export async function GET(request: NextRequest) {
  // ✅ STEP 1: Authentication Check
  const auth = checkAuth(request);
  if (!auth.authenticated) {
    console.warn('🚫 Unauthorized access attempt to /api/gauges/get-by-code');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unauthorized',
        message: 'Silakan login kembali'
      }, 
      { status: 401 }
    );
  }
  
  try {
    // ✅ STEP 2: Parse query parameters
    const { searchParams } = new URL(request.url);
    const gaugeCode = searchParams.get('gaugeCode');
    
    // Validate gaugeCode parameter
    if (!gaugeCode) {
      console.warn('⚠️ Missing gaugeCode parameter');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing gaugeCode parameter',
          message: 'Parameter gaugeCode wajib diisi'
        }, 
        { status: 400 }
      );
    }
    
    // ✅ STEP 3: Log request for debugging
    console.log('🔍 [Gauge API] Fetching gauge:', gaugeCode);
    
    // ✅ STEP 4: Query database
    const result = await pool.query(
      `SELECT 
        g.id,
        g.gauge_code,
        g.gauge_type,
        g.gauge_name,
        g.category_id,
        g.area_id,
        g.calibration_due,
        g.is_active,
        ca.area_name,
        ca.area_code
       FROM gauges g
       LEFT JOIN checklist_areas ca ON g.area_id = ca.id
       WHERE g.gauge_code = $1 AND g.is_active = TRUE`,
      [gaugeCode]
    );
    
    // ✅ STEP 5: Handle not found
    if (result.rows.length === 0) {
      console.warn('⚠️ [Gauge API] Gauge not found:', gaugeCode);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Gauge tidak ditemukan',
          message: `Gauge dengan kode "${gaugeCode}" tidak ditemukan atau tidak aktif`
        }, 
        { status: 404 }
      );
    }
    
    // ✅ STEP 6: Return success response
    const gauge = result.rows[0];
    console.log('✅ [Gauge API] Gauge found:', gauge.gauge_code, gauge.gauge_name);
    
    return NextResponse.json({
      success: true,
      gauge: {
        id: gauge.id,
        gauge_code: gauge.gauge_code,
        gauge_type: gauge.gauge_type,
        gauge_name: gauge.gauge_name,
        category_id: gauge.category_id,
        area_id: gauge.area_id,
        calibration_due: gauge.calibration_due,
        is_active: gauge.is_active,
        area_name: gauge.area_name,
        area_code: gauge.area_code
      }
    });
    
  } catch (error) {
    // ✅ STEP 7: Error handling
    console.error('❌ [Gauge API] Get gauge error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        message: 'Terjadi kesalahan pada server',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// =====================================================================
// === OPTIONS HANDLER (for CORS if needed) ===
// =====================================================================
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    },
  });
}