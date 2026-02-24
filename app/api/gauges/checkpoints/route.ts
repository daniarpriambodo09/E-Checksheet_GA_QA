// app/api/gauges/checkpoints/route.ts
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
// === MAIN API HANDLER - GET CHECKPOINTS ===
// =====================================================================
export async function GET(request: NextRequest) {
  // ✅ STEP 1: Authentication Check
  const auth = checkAuth(request);
  if (!auth.authenticated) {
    console.warn('🚫 Unauthorized access attempt to /api/gauges/checkpoints');
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
    const gaugeType = searchParams.get('gaugeType');
    
    // Validate gaugeType parameter
    if (!gaugeType) {
      console.warn('⚠️ Missing gaugeType parameter');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing gaugeType parameter',
          message: 'Parameter gaugeType wajib diisi'
        }, 
        { status: 400 }
      );
    }
    
    // ✅ STEP 3: Log request for debugging
    console.log('🔍 [Checkpoints API] Fetching checkpoints for gauge_type:', gaugeType);
    
    // ✅ STEP 4: Query database
    const result = await pool.query(
      `SELECT 
        id,
        gauge_type,
        checkpoint_name,
        checkpoint_order,
        is_required,
        is_active,
        created_at,
        updated_at
       FROM gauge_checkpoints
       WHERE gauge_type = $1 AND is_active = TRUE
       ORDER BY checkpoint_order ASC`,
      [gaugeType]
    );
    
    // ✅ STEP 5: Handle no checkpoints found
    if (result.rows.length === 0) {
      console.warn('⚠️ [Checkpoints API] No checkpoints found for gauge_type:', gaugeType);
      return NextResponse.json(
        { 
          success: true,
          checkpoints: [],
          message: `Tidak ada checklist untuk gauge type "${gaugeType}"`
        }, 
        { status: 200 }
      );
    }
    
    // ✅ STEP 6: Return success response
    console.log('✅ [Checkpoints API] Checkpoints found:', result.rows.length);
    
    return NextResponse.json({
      success: true,
      checkpoints: result.rows.map(row => ({
        id: row.id,
        gauge_type: row.gauge_type,
        checkpoint_name: row.checkpoint_name,
        checkpoint_order: row.checkpoint_order,
        is_required: row.is_required,
        is_active: row.is_active
      }))
    });
    
  } catch (error) {
    // ✅ STEP 7: Error handling
    console.error('❌ [Checkpoints API] Get checkpoints error:', error);
    
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