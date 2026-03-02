// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validasi input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi!' },
        { status: 400 }
      );
    }

    // Sanitasi input (mencegah XSS/SQL injection dasar)
    const sanitizedUsername = username.trim().toLowerCase();
    
    console.log('🔐 Login attempt for username:', sanitizedUsername);

    // ✅ PostgreSQL: Gunakan parameterized query untuk mencegah SQL injection
    const result = await pool.query(
      `SELECT id, username, full_name, nik, department, role, password_hash, is_active, last_login
      FROM users
      WHERE username = $1 AND is_active = TRUE`,
      [username.trim()]
    );

    if (result.rows.length === 0) {
      console.log('❌ Username not found or inactive:', sanitizedUsername);
      // Gunakan pesan generik untuk mencegah user enumeration
      return NextResponse.json(
        { error: 'Username atau password salah!' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    console.log('✅ User found:', user.username, 'Role:', user.role);

    // Verifikasi password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', user.username);
      // Gunakan pesan generik untuk keamanan
      return NextResponse.json(
        { error: 'Username atau password salah!' },
        { status: 401 }
      );
    }

    // ✅ Generate session token yang aman
    const sessionToken = `sess_${randomUUID()}_${Date.now()}`;
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    // ✅ Update last_login di database (optional tapi direkomendasikan)
    await pool.query(
      `UPDATE users SET last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    console.log('✅ Login successful:', user.username);

    // ✅ Siapkan response user data (tanpa password_hash)
    const userData = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      nik: user.nik,
      department: user.department,
      role: user.role,
    };

    // ✅ Buat response dengan session token di HTTP-only cookie (lebih aman)
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login berhasil!',
        user: userData,
        // Opsional: kirim token ke client jika menggunakan localStorage
        sessionToken: process.env.NODE_ENV === 'development' ? sessionToken : undefined,
      },
      { status: 200 }
    );

    // ✅ Set HTTP-only cookie untuk session token (tidak bisa diakses JavaScript)
    response.cookies.set('auth_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Hanya HTTPS di production
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 jam dalam detik
      path: '/',
    });

    // ✅ Tambahkan security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;

  } catch (error) {
    console.error('❌ Login error:', error);
    
    // Log error detail hanya di development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', error instanceof Error ? error.stack : error);
    }
    
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}

// ✅ Optional: Tambahkan method handler untuk security
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';