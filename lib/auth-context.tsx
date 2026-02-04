// lib/auth-context.tsx
"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// 🔹 Role yang didukung
export type Role = "group-leader-qa" | "inspector-qa" | "inspector-ga" | "eso" | "admin";

// 🔹 Struktur pengguna
export interface User {
  id: string;
  username: string;
  fullName: string;
  nik: string;
  department: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  currentUser: User | null;
  loading: boolean;
  signup: (
    data: {
      username: string;
      fullName: string;
      nik: string;
      department: string;
      role: Role;
      password: string;
      confirmPassword: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🔑 Kunci localStorage
const USER_STORAGE_KEY = "auth_users_v2";
const CURRENT_USER_KEY = "auth_current_user_v2";
const SESSION_TOKEN_KEY = "auth_session_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<Record<string, User & { password: string }>>({});
  const [loading, setLoading] = useState(true);

  // 🔄 Load dari localStorage saat pertama kali
  useEffect(() => {
    try {
      const savedUsers = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUsers) {
        setUsers(JSON.parse(savedUsers));
      }

      const savedCurrentUser = localStorage.getItem(CURRENT_USER_KEY);
      if (savedCurrentUser) {
        const user = JSON.parse(savedCurrentUser);
        if (["group-leader-qa", "inspector-qa", "inspector-ga", "eso", "admin"].includes(user.role)) {
          setCurrentUser({
            id: user.id || user.username, // Add id field
            username: user.username,
            fullName: user.fullName,
            nik: user.nik,
            department: user.department,
            role: user.role as Role,
          });
        }
      }
    } catch (e) {
      console.warn("Gagal memuat data auth dari localStorage", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔄 Simpan users ke localStorage
  useEffect(() => {
    if (Object.keys(users).length > 0) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
    }
  }, [users]);

  // 🔄 Simpan currentUser ke localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify({
          id: currentUser.id,
          username: currentUser.username,
          fullName: currentUser.fullName,
          nik: currentUser.nik,
          department: currentUser.department,
          role: currentUser.role,
        })
      );
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, [currentUser]);

  // Di dalam AuthProvider, ganti fungsi signup dengan versi berikut:

  const signup = useCallback(
    async ({
      username,
      fullName,
      nik,
      department,
      role,
      password,
      confirmPassword,
    }: {
      username: string;
      fullName: string;
      nik: string;
      department: string;
      role: Role;
      password: string;
      confirmPassword: string;
    }) => {
      // Validasi sisi klien (UX lebih cepat)
      if (!username.trim() || !fullName.trim() || !nik.trim() || !department.trim()) {
        return { success: false, error: "Semua field wajib diisi!" };
      }

      if (!role || !["group-leader-qa", "inspector-qa", "inspector-ga"].includes(role)) {
        return { success: false, error: "Pilih role yang valid!" };
      }

      if (password.length < 6) {
        return { success: false, error: "Password minimal 6 karakter!" };
      }

      if (password !== confirmPassword) {
        return { success: false, error: "Password dan konfirmasi tidak cocok!" };
      }

      // Validasi role ↔ departemen
      const validDepartments: Record<Role, string[]> = {
        "group-leader-qa": ["quality-assurance"],
        "inspector-qa": ["quality-assurance"],
        "inspector-ga": ["general-affairs"],
        'admin': ["admin"],
        'eso' : ['k3']
      };

      if (!validDepartments[role].includes(department)) {
        const deptLabels = validDepartments[role]
          .map((d) => {
            const map: Record<string, string> = {
              "quality-assurance": "Quality Assurance",
              "general-affairs": "General Affairs",
            };
            return map[d] || d;
          })
          .join(", ");
        return { success: false, error: `Role ${role} hanya boleh memilih departemen: ${deptLabels}` };
      }

      // KIRIM KE API DATABASE
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            fullName: fullName.trim(),
            nik: nik.trim(),
            department,
            role,
            password,
            confirmPassword,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Tangani error spesifik dari API
          if (response.status === 409) {
            return { success: false, error: "Username atau NIK sudah terdaftar!" };
          }
          return { success: false, error: result.error || "Pendaftaran gagal!" };
        }

        // Simpan ke localStorage UNTUK SESI INI SAJA (hybrid approach)
        // Catatan: Login tetap menggunakan database di masa depan
        const newUser = {
          id: result.userId,
          username: username.trim(),
          fullName: fullName.trim(),
          nik: nik.trim(),
          department,
          role,
          password, // Hanya untuk keperluan localStorage (tidak aman untuk production)
        };

        setUsers((prev) => ({
          ...prev,
          [username.trim()]: newUser,
        }));

        console.log("[Auth] User berhasil didaftarkan:", {
          id: result.userId,
          username: username.trim(),
          fullName: fullName.trim(),
          department,
          role,
        });
        
        return { success: true };
      } catch (error) {
        console.error("Error during signup API call:", error);
        return { success: false, error: "Gagal terhubung ke server. Periksa koneksi Anda." };
      }
    },
    []
  );
  
  // GANTI FUNGSI login YANG LAMA DENGAN INI
  const login = useCallback(
    async (username: string, password: string) => {
      if (!username.trim() || !password) {
        return { success: false, error: "Username dan password harus diisi!" };
      }

      try {
        // Kirim ke API database
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Tangani error spesifik
          if (response.status === 401) {
            return { success: false, error: result.error || "Username atau password salah!" };
          }
          if (response.status === 403) {
            return { success: false, error: result.error || "Akun tidak aktif!" };
          }
          return { success: false, error: result.error || "Login gagal!" };
        }

        // Simpan user ke state dan localStorage
        const safeUser: User = {
          id: result.user.id,
          username: result.user.username,
          fullName: result.user.fullName,
          nik: result.user.nik,
          department: result.user.department,
          role: result.user.role as Role,
        };

        setCurrentUser(safeUser);

        // Set session token
        const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);

        console.log("[Auth] Login berhasil:", safeUser.fullName, "Role:", safeUser.role);
        return { success: true };
      } catch (error) {
        console.error("Error during login API call:", error);
        return { success: false, error: "Gagal terhubung ke server. Periksa koneksi Anda." };
      }
    },
    [] // HAPUS dependency [users] - tidak diperlukan lagi
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    console.log("[Auth] Logout berhasil");
    router.push("/login-page");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        currentUser,
        loading,
        signup,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// ============================================
// 🔐 SERVER-SIDE AUTHENTICATION HELPER
// ============================================
// Fungsi ini digunakan di API routes untuk mendapatkan user yang sedang login
export async function getAuth(request?: Request): Promise<{ user: User | null; error?: string }> {
  try {
    // Jika dipanggil dari client-side (bukan API route)
    if (typeof window !== "undefined") {
      const currentUserStr = localStorage.getItem(CURRENT_USER_KEY);
      const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

      if (!currentUserStr || !sessionToken) {
        return { user: null };
      }

      const currentUser = JSON.parse(currentUserStr);
      return {
        user: {
          id: currentUser.id || currentUser.username,
          username: currentUser.username,
          fullName: currentUser.fullName,
          nik: currentUser.nik,
          department: currentUser.department,
          role: currentUser.role as Role,
        },
      };
    }

    // Jika dipanggil dari server-side (API route)
    // Parse cookies dari request
    let sessionToken: string | null = null;
    let currentUserStr: string | null = null;

    if (request) {
      // Parse cookies dari headers
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").reduce((acc: Record<string, string>, cookie) => {
          const [name, value] = cookie.trim().split("=");
          acc[name] = value;
          return acc;
        }, {});

        sessionToken = cookies[SESSION_TOKEN_KEY] || null;
        currentUserStr = cookies[CURRENT_USER_KEY] || null;

        // Jika tidak ada di cookies, coba dari localStorage (fallback)
        if (!currentUserStr) {
          currentUserStr = localStorage.getItem(CURRENT_USER_KEY);
          sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
        }
      }
    }

    // Validasi session
    if (!currentUserStr || !sessionToken) {
      return { user: null };
    }

    const currentUser = JSON.parse(currentUserStr);

    // Validasi user
    if (
      !currentUser ||
      !currentUser.username ||
      !["group-leader-qa", "inspector-qa", "inspector-ga", "eso", "admin"].includes(currentUser.role)
    ) {
      return { user: null };
    }

    return {
      user: {
        id: currentUser.id || currentUser.username,
        username: currentUser.username,
        fullName: currentUser.fullName,
        nik: currentUser.nik,
        department: currentUser.department,
        role: currentUser.role as Role,
      },
    };
  } catch (error) {
    console.error("Error in getAuth:", error);
    return { user: null, error: "Authentication error" };
  }
}

// ============================================
// 🔐 CHECK AUTHENTICATION STATUS
// ============================================
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

  return !!currentUser && !!sessionToken;
}

// ============================================
// 🔐 GET CURRENT USER (CLIENT-SIDE)
// ============================================
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;

  const currentUserStr = localStorage.getItem(CURRENT_USER_KEY);
  if (!currentUserStr) return null;

  try {
    const currentUser = JSON.parse(currentUserStr);
    return {
      id: currentUser.id || currentUser.username,
      username: currentUser.username,
      fullName: currentUser.fullName,
      nik: currentUser.nik,
      department: currentUser.department,
      role: currentUser.role as Role,
    };
  } catch (error) {
    console.error("Error parsing current user:", error);
    return null;
  }
}