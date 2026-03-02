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
  isInitialized: boolean;
  signup: (data: {
    username: string;
    fullName: string;
    nik: string;
    department: string;
    role: Role;
    password: string;
    confirmPassword: string;
  }) => Promise<{ success: boolean; error?: string }>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🔑 Kunci localStorage
const CURRENT_USER_KEY = "auth_current_user_v2";
const SESSION_TOKEN_KEY = "auth_session_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false); // ✅ STATE TERPISAH

  // 🔄 Load dari localStorage saat pertama kali mount
  useEffect(() => {
    try {
      const savedCurrentUser = localStorage.getItem(CURRENT_USER_KEY);
      const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

      console.log('🔍 Loading auth from localStorage:', {
        hasUser: !!savedCurrentUser,
        hasToken: !!sessionToken
      });

      if (savedCurrentUser && sessionToken) {
        const user = JSON.parse(savedCurrentUser);
        if (user.role && ["group-leader-qa", "inspector-qa", "inspector-ga", "eso", "admin"].includes(user.role)) {
          setCurrentUser({
            id: user.id || user.username,
            username: user.username,
            fullName: user.fullName,
            nik: user.nik,
            department: user.department,
            role: user.role as Role,
          });
          console.log('✅ User loaded:', user.username);
        } else {
          console.warn('⚠️ Invalid role:', user.role);
        }
      } else {
        console.log('ℹ️ No saved session found');
      }
    } catch (e) {
      console.warn("⚠️ Gagal memuat data auth dari localStorage", e);
    } finally {
      setLoading(false);
      setIsInitialized(true); // ✅ SET TRUE SETELAH LOAD SELESAI
    }
  }, []);

  // ✅ FIX: HANYA simpan ke localStorage saat currentUser BERUBAH (JANGAN HAPUS!)
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
      console.log('💾 Session saved for:', currentUser.username);
    }
    // ❌ JANGAN HAPUS localStorage saat currentUser null!
    // Hapus hanya saat logout eksplisit
  }, [currentUser]);

  // ✅ SIGNUP
  const signup = useCallback(async ({
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
    if (!username.trim() || !fullName.trim() || !nik.trim() || !department.trim()) {
      return { success: false, error: "Semua field wajib diisi!" };
    }

    if (!role || !["group-leader-qa", "inspector-qa", "inspector-ga", "admin", "eso"].includes(role)) {
      return { success: false, error: "Pilih role yang valid!" };
    }

    if (password.length < 6) {
      return { success: false, error: "Password minimal 6 karakter!" };
    }

    if (password !== confirmPassword) {
      return { success: false, error: "Password dan konfirmasi tidak cocok!" };
    }

    const validDepartments: Record<Role, string[]> = {
      "group-leader-qa": ["quality-assurance"],
      "inspector-qa": ["quality-assurance"],
      "inspector-ga": ["general-affairs"],
      'admin': ["admin"],
      'eso': ['k3']
    };

    if (!validDepartments[role].includes(department)) {
      const deptLabels = validDepartments[role]
        .map((d) => {
          const map: Record<string, string> = {
            "quality-assurance": "Quality Assurance",
            "general-affairs": "General Affairs",
            "admin": "Admin",
            "k3": "K3/ESO"
          };
          return map[d] || d;
        })
        .join(", ");
      return { success: false, error: `Role ${role} hanya boleh memilih departemen: ${deptLabels}` };
    }

    try {
      console.log('📤 Sending signup request to API...');
      
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
        console.error('❌ Signup failed:', result.error);
        
        if (response.status === 409) {
          return { success: false, error: "Username atau NIK sudah terdaftar!" };
        }
        return { success: false, error: result.error || "Pendaftaran gagal!" };
      }

      console.log('✅ Signup successful:', result.userId);
      return { success: true };
      
    } catch (error) {
      console.error("❌ Error during signup API call:", error);
      return { success: false, error: "Gagal terhubung ke server. Periksa koneksi Anda." };
    }
  }, []);

  // ✅ LOGIN
  const login = useCallback(async (username: string, password: string) => {
    if (!username.trim() || !password) {
      return { success: false, error: "Username dan password harus diisi!" };
    }

    try {
      console.log('📤 Sending login request to API...');
      
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
        console.error('❌ Login failed:', result.error);
        
        if (response.status === 401) {
          return { success: false, error: result.error || "Username atau password salah!" };
        }
        if (response.status === 403) {
          return { success: false, error: result.error || "Akun tidak aktif!" };
        }
        return { success: false, error: result.error || "Login gagal!" };
      }

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

      console.log('✅ Login successful:', safeUser.fullName, 'Role:', safeUser.role);
      return { success: true };
      
    } catch (error) {
      console.error("❌ Error during login API call:", error);
      return { success: false, error: "Gagal terhubung ke server. Periksa koneksi Anda." };
    }
  }, []);

  // ✅ LOGOUT - HAPUS localStorage DI SINI (bukan di useEffect)
  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);  // ✅ HAPUS SAAT LOGOUT
    localStorage.removeItem(SESSION_TOKEN_KEY); // ✅ HAPUS SAAT LOGOUT
    console.log('👋 Logout successful');
    router.push("/login-page");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        currentUser,
        loading,
        isInitialized, // ✅ GUNAKAN STATE ASLI
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

// Server-side helpers (tetap sama)
export async function getAuth(request?: Request): Promise<{ user: User | null; error?: string }> {
  try {
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
    return { user: null };
  } catch (error) {
    console.error("Error in getAuth:", error);
    return { user: null, error: "Authentication error" };
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
  return !!currentUser && !!sessionToken;
}

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