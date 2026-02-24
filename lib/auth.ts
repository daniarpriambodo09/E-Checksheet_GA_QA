// lib/auth.ts

import { NextRequest } from 'next/server';
import pool from './db';

export interface User {
  id: string;
  username: string;
  fullName: string;
  nik: string;
  department: string;
  role: string;
}

export interface Session {
  user: User;
}

export const authOptions = {
  // Placeholder for compatibility
};

export async function getServerSession(authOptions?: any, request?: NextRequest): Promise<Session | null> {
  try {
    // Try to get user from Authorization header
    if (!request) return null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // For now, assume token is username:password encoded
      const decoded = Buffer.from(token, 'base64').toString().split(':');
      if (decoded.length === 2) {
        const [username, password] = decoded;

        // Verify user in database
        const result = await pool.query(
          'SELECT id, username, full_name, nik, department, role FROM users WHERE username = ? AND is_active = 1',
          [username]
        );

        const userArray = result.rows as any[];
        if (userArray.length > 0) {
          const user = userArray[0];
          return {
            user: {
              id: user.id.toString(),
              username: user.username,
              fullName: user.full_name,
              nik: user.nik,
              department: user.department,
              role: user.role,
            },
          };
        }
      }
    }

    // Fallback: try to get from cookies or other methods
    // For now, return null if no valid auth
    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}