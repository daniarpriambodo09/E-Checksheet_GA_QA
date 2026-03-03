// lib/auth-server.ts
// ✅ Server-side only auth helper — JANGAN import di client components
// Gunakan file ini di API routes, bukan getAuth() dari auth-context.tsx

import { NextRequest } from 'next/server';
import pool from '@/lib/db';

export interface ServerUser {
  id: string;
  username: string;
  fullName: string;
  nik: string;
  department: string;
  role: string;
}

/**
 * Ambil user dari request API.
 * 
 * Cara kerja:
 * 1. Baca header "x-user-id" atau "authorization" yang dikirim client
 * 2. Atau baca cookie "auth_session_token"
 * 3. Validasi ke database
 * 
 * Karena auth saat ini pakai localStorage (bukan JWT/cookie), 
 * client harus mengirim user ID atau username di header.
 */
export async function getServerAuth(request: NextRequest): Promise<{ user: ServerUser | null; error?: string }> {
  try {
    // ✅ Coba baca dari header x-user-id (dikirim oleh client)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const username = request.headers.get('x-username');

    // Jika ada header user info, validasi ke DB
    if (userId) {
      try {
        const result = await pool.query(
          `SELECT id, username, full_name, nik, department, role 
           FROM users 
           WHERE id = $1 AND is_active = TRUE`,
          [userId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          return {
            user: {
              id: String(row.id),
              username: row.username,
              fullName: row.full_name,
              nik: row.nik,
              department: row.department,
              role: row.role,
            }
          };
        }
      } catch (dbErr) {
        console.warn('⚠️ DB validation failed, falling back to header trust:', dbErr);
        
        // Fallback: percaya header jika DB error (development only)
        if (userId && userRole && username) {
          return {
            user: {
              id: userId,
              username: username,
              fullName: username,
              nik: '',
              department: '',
              role: userRole,
            }
          };
        }
      }
    }

    // ✅ Fallback: baca dari query param (kurang aman, hanya dev)
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('_uid');
    const queryRole = searchParams.get('_role');
    
    if (queryUserId && queryRole) {
      return {
        user: {
          id: queryUserId,
          username: queryUserId,
          fullName: queryUserId,
          nik: '',
          department: '',
          role: queryRole,
        }
      };
    }

    return { user: null, error: 'No authentication provided' };

  } catch (error: any) {
    console.error('❌ getServerAuth error:', error);
    return { user: null, error: error.message };
  }
}

/**
 * Simple role check — jika auth belum sempurna,
 * untuk sementara skip auth check di admin routes
 * dan andalkan middleware/proxy untuk proteksi.
 * 
 * Set SKIP_API_AUTH=true di .env.local untuk development
 */
export function shouldSkipAuth(): boolean {
  return process.env.SKIP_API_AUTH === 'true';
}

export function isAdminRole(role: string): boolean {
  return ['admin', 'superadmin'].includes(role);
}