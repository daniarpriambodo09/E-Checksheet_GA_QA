"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { NavbarFixed } from "@/components/navbar-fixed"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await login(username, password) // ✅ await di sini
      if (result.success) {
        router.push("/home")
      } else {
        setError(result.error || "Login gagal!")
      }
    } catch (err) {
      setError("Terjadi kesalahan saat login")
    } finally {
      setLoading(false)
    }
  }


  return (
    <>
      <NavbarFixed />
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-text-section">
            <h1>Selamat Datang</h1>
            <h2>Sistem E-Checksheet</h2>
            <p>
              Kelola checklist Anda dengan efisien menggunakan platform digital kami. Akses mudah, monitoring real-time,
              dan laporan komprehensif.
            </p>
            <Link href="/signup-page" className="btn-outline">
              Daftar Sekarang
            </Link>
          </div>

          <div className="login-form-section">
            <div className="login-card">
              <div className="login-card-header">
                <h2>Login</h2>
                <p>Masuk ke akun Anda</p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="input-wrapper">
                  <label htmlFor="username">Username</label>
                  <div className="input-field">
                    <input
                      id="username"
                      type="text"
                      placeholder="Masukkan username Anda"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="input-wrapper">
                  <label htmlFor="password">Password</label>
                  <div className="input-field">
                    <input
                      id="password"
                      type="password"
                      placeholder="Masukkan password Anda"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

              <div className="switch-link">
                Belum punya akun? <Link href="/signup-page">Daftar di sini</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
