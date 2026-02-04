// app/api/auth/login.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

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

    // Cari user di database
    const [users] = await pool.execute(
      'SELECT id, username, full_name, nik, department, role, password_hash, is_active FROM users WHERE username = ?',
      [username.trim()]
    );

    const userArray = users as any[];
    if (userArray.length === 0) {
      return NextResponse.json(
        { error: 'Username tidak ditemukan!' },
        { status: 401 }
      );
    }

    const user = userArray[0];

    // Cek status akun
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Akun tidak aktif. Hubungi administrator.' },
        { status: 403 }
      );
    }

    // Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Password salah!' },
        { status: 401 }
      );
    }

    // Return user data (tanpa password hash)
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          nik: user.nik,
          department: user.department,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}