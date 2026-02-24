// app/api/gauges/checkpoints/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// =====================================================================
// === TYPE DEFINITIONS ===
// =====================================================================
interface CheckpointResultInput {
  checkpointId: string;
  checkpointName: string;
  status: '-' | 'OK' | 'NG';
  notes?: string;
}

interface SaveCheckpointRequestBody {
  gaugeId: string;
  gaugeType: string;
  userId: string;
  nik: string;
  dateKey: string;      // YYYY-MM-DD
  shift: 'A' | 'B';
  checkpointResults: CheckpointResultInput[];
}

// =====================================================================
// === AUTHENTICATION CHECK HELPER ===
// =====================================================================
function checkAuth(request: NextRequest): { authenticated: boolean; userId?: string; error?: string } {
  try {
    const sessionToken = request.headers.get('authorization') || 
                         request.headers.get('x-session-token');
    
    if (!sessionToken) {
      const cookies = request.cookies;
      const token = cookies.get('auth_session_token')?.value;
      if (token) {
        return { authenticated: true };
      }
      
      return { 
        authenticated: false, 
        error: 'Unauthorized - No session token found' 
      };
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
// === MAIN API HANDLER - SAVE CHECKPOINT RESULTS ===
// =====================================================================
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    // ✅ STEP 1: Authentication Check
    const auth = checkAuth(request);
    if (!auth.authenticated) {
      console.warn('🚫 Unauthorized access attempt to /api/gauges/checkpoints/save');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized',
          message: 'Silakan login kembali'
        }, 
        { status: 401 }
      );
    }
    
    // ✅ STEP 2: Parse request body
    const body: SaveCheckpointRequestBody = await request.json();
    const {
      gaugeId,
      gaugeType,
      userId,
      nik,
      dateKey,
      shift,
      checkpointResults
    } = body;
    
    // ✅ STEP 3: Validate required fields
    if (!gaugeId || !userId || !dateKey || !shift || !checkpointResults?.length) {
      console.warn('⚠️ Missing required fields:', { gaugeId, userId, dateKey, shift, checkpointCount: checkpointResults?.length });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          message: 'Field gaugeId, userId, dateKey, shift, dan checkpointResults wajib diisi'
        }, 
        { status: 400 }
      );
    }
    
    console.log('💾 [Save Checkpoints] Saving results:', {
      gaugeId,
      gaugeType,
      userId,
      dateKey,
      shift,
      checkpointCount: checkpointResults.length
    });
    
    // ✅ STEP 4: Begin transaction
    await client.query('BEGIN');
    
    // ✅ STEP 5: Validasi gauge exists dan active
    const gaugeCheck = await client.query(
      'SELECT id, gauge_code, gauge_type, is_active FROM gauges WHERE id = $1',
      [gaugeId]
    );
    
    if (gaugeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error('❌ Gauge not found:', gaugeId);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Gauge tidak ditemukan',
          message: `Gauge dengan ID "${gaugeId}" tidak ditemukan`
        }, 
        { status: 404 }
      );
    }
    
    if (!gaugeCheck.rows[0].is_active) {
      await client.query('ROLLBACK');
      console.error('❌ Gauge not active:', gaugeId);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Gauge tidak aktif',
          message: `Gauge "${gaugeCheck.rows[0].gauge_code}" tidak aktif`
        }, 
        { status: 400 }
      );
    }
    
    // ✅ STEP 6: Validasi gauge_type match
    if (gaugeCheck.rows[0].gauge_type !== gaugeType) {
      console.warn('⚠️ Gauge type mismatch:', {
        expected: gaugeType,
        actual: gaugeCheck.rows[0].gauge_type
      });
      // Tidak reject, hanya warning (bisa diperketat nanti)
    }
    
    // ✅ STEP 7: UPSERT setiap checkpoint result
    const savedResults: any[] = [];
    
    for (const item of checkpointResults) {
      const { checkpointId, checkpointName, status, notes } = item;
      
      // Validasi checkpoint exists
      const checkpointCheck = await client.query(
        'SELECT id, gauge_type, is_active FROM gauge_checkpoints WHERE id = $1',
        [checkpointId]
      );
      
      if (checkpointCheck.rows.length === 0) {
        console.warn('⚠️ Checkpoint not found:', checkpointId);
        continue; // Skip checkpoint yang tidak ditemukan
      }
      
      if (!checkpointCheck.rows[0].is_active) {
        console.warn('⚠️ Checkpoint not active:', checkpointId);
        continue; // Skip checkpoint yang tidak aktif
      }
      
      // UPSERT: Insert atau Update jika sudah ada
      const upsertQuery = `
        INSERT INTO gauge_checkpoint_results 
        (gauge_id, checkpoint_id, user_id, nik, date_key, shift, status, notes, checked_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (gauge_id, checkpoint_id, date_key, shift)
        DO UPDATE SET
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          user_id = EXCLUDED.user_id,
          nik = EXCLUDED.nik,
          checked_at = NOW()
        RETURNING id, status, checked_at
      `;
      
      const upsertResult = await client.query(upsertQuery, [
        gaugeId,
        checkpointId,
        userId,
        nik,
        dateKey,
        shift,
        status,
        notes || null
      ]);
      
      savedResults.push({
        checkpointId,
        checkpointName,
        status,
        savedId: upsertResult.rows[0]?.id,
        checkedAt: upsertResult.rows[0]?.checked_at
      });
    }
    
    // ✅ STEP 8: Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ [Save Checkpoints] Successfully saved:', savedResults.length, 'checkpoint results');
    
    // ✅ STEP 9: Calculate summary
    const summary = {
      total: checkpointResults.length,
      ok: checkpointResults.filter(r => r.status === 'OK').length,
      ng: checkpointResults.filter(r => r.status === 'NG').length,
      pending: checkpointResults.filter(r => r.status === '-').length
    };
    
    // ✅ STEP 10: Return success response
    return NextResponse.json({
      success: true,
      message: 'Checkpoint results saved successfully',
      saved: savedResults.length,
      summary,
      gauge: {
        id: gaugeId,
        type: gaugeType,
        code: gaugeCheck.rows[0].gauge_code
      }
    });
    
  } catch (error: any) {
    // ✅ STEP 11: Rollback on error
    await client.query('ROLLBACK');
    
    console.error('❌ [Save Checkpoints] Error:', error.message);
    console.error('Stack:', error.stack);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal menyimpan hasil checkpoint',
        message: error.message || 'Terjadi kesalahan pada server',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  } finally {
    // ✅ STEP 12: Release client
    client.release();
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    },
  });
}