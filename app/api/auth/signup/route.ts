// app/api/auth/signup.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, fullName, nik, department, role, password, confirmPassword } = await request.json();

    // Validasi required fields
    if (!username || !fullName || !nik || !department || !role || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi!' },
        { status: 400 }
      );
    }

    // Validasi role
    const validRoles = ['group-leader-qa', 'inspector-qa', 'inspector-ga'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Role tidak valid!' },
        { status: 400 }
      );
    }

    // Validasi password
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter!' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Password dan konfirmasi tidak cocok!' },
        { status: 400 }
      );
    }

    // Validasi role ↔ departemen
    const validDepartments: Record<string, string[]> = {
      'group-leader-qa': ['quality-assurance'],
      'inspector-qa': ['quality-assurance'],
      'inspector-ga': ['general-affairs'],
    };

    if (!validDepartments[role].includes(department)) {
      const deptLabels = validDepartments[role]
        .map(d => d === 'quality-assurance' ? 'Quality Assurance' : 'General Affairs')
        .join(', ');
      return NextResponse.json(
        { error: `Role ${role} hanya boleh memilih departemen: ${deptLabels}` },
        { status: 400 }
      );
    }

    // Cek duplikat username atau NIK di database
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR nik = ?',
      [username.trim(), nik.trim()]
    );

    if ((existingUsers as any[]).length > 0) {
      return NextResponse.json(
        { error: 'Username atau NIK sudah terdaftar!' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate ID unik
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Simpan ke database
    await pool.execute(
      `INSERT INTO users 
       (id, username, full_name, nik, department, role, password_hash, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        userId,
        username.trim(),
        fullName.trim(),
        nik.trim(),
        department,
        role,
        hashedPassword
      ]
    );

    console.log('[API] User berhasil didaftarkan:', { id: userId, username, role, department });
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Pendaftaran berhasil! Silakan login.',
        userId 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error during signup:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat pendaftaran. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}