// app/signup-page/page.tsx
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { NavbarFixed } from "@/components/navbar-fixed"
import { useAuth } from "@/lib/auth-context"

export default function SignupPage() {
  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    nik: "",
    password: "",
    confirmPassword: "",
    department: "",
    role: "" as "inspector-qa" | "group-leader-qa" | "admin" | "eso",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signup } = useAuth()

  // 🔹 Auto-set department berdasarkan role (dengan nilai yang sesuai auth context)
  useEffect(() => {
    if (formData.role === "group-leader-qa") {
      setFormData(prev => ({ ...prev, department: "quality-assurance" }))
    } else if (formData.role === "inspector-qa") {
      setFormData(prev => ({ ...prev, department: "quality-assurance" }))
    }
  }, [formData.role])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError("")
  setLoading(true)

  // Validasi role
  if (!formData.role || !['inspector-qa', 'group-leader-qa', 'admin', 'eso'].includes(formData.role)) {
    setError("Pilih role terlebih dahulu!")
    setLoading(false)
    return
  }

  try {
    const result = await signup({
      username: formData.username,
      fullName: formData.fullName,
      nik: formData.nik,
      department: formData.department,
      role: formData.role as any,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    })

    if (result.success) {
      alert("Pendaftaran berhasil! Silakan login.")
      router.push("/login-page")
    } else {
      setError(result.error || "Pendaftaran gagal!")
    }
  } catch (err) {
    setError("Terjadi kesalahan saat pendaftaran")
  } finally {
    setLoading(false)
  }
}

  return (
    <>
      <NavbarFixed />
      <div className="signup-container">
        <div className="signup-wrapper">
          <div className="signup-text-section">
            <h1>Bergabunglah</h1>
            <h2>Dengan E-Checksheet</h2>
            <p>
              Tingkatkan produktivitas tim Anda dengan sistem checklist yang modern dan terpadu. Kelola operasional
              dengan lebih efisien dan profesional.
            </p>
            <Link href="/login-page" className="btn-outline">
              Sudah Punya Akun?
            </Link>
          </div>

          <div className="signup-form-section">
            <div className="signup-card">
              <h2>Daftar</h2>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="input-wrapper">
                  <label htmlFor="username">Username</label>
                  <div className="input-field">
                    <input
                      id="username"
                      type="text"
                      name="username"
                      placeholder="Username"
                      value={formData.username}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="input-wrapper">
                  <label htmlFor="fullName">Nama Lengkap</label>
                  <div className="input-field">
                    <input
                      id="fullName"
                      type="text"
                      name="fullName"
                      placeholder="Nama Lengkap"
                      value={formData.fullName}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="input-wrapper">
                  <label htmlFor="nik">NIK</label>
                  <div className="input-field">
                    <input
                      id="nik"
                      type="text"
                      name="nik"
                      placeholder="nik"
                      value={formData.nik}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="input-wrapper">
                  <label htmlFor="department">Departemen</label>
                  <div className="input-field">
                    <select
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      disabled={true} // ✅ Nonaktifkan karena diatur otomatis berdasarkan role
                      required
                    >
                      <option value="">Pilih Departemen</option>
                      <option value="quality-assurance">Quality Assurance (QA)</option>
                    </select>
                  </div> 
                </div>

                <div className="input-wrapper">
                  <label htmlFor="role">Peran / Role</label>
                  <div className="input-field">
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    >
                      <option value="">Pilih Peran</option>
                      <option value="group-leader-qa">Group Leader QA</option>
                      <option value="inspector-qa">Inspector QA</option>
                    </select>
                  </div>
                </div>

                <div className="input-wrapper">
                  <label htmlFor="password">Password</label>
                  <div className="input-field">
                    <input
                      id="password"
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="input-wrapper">
                  <label htmlFor="confirmPassword">Konfirmasi Password</label>
                  <div className="input-field">
                    <input
                      id="confirmPassword"
                      type="password"
                      name="confirmPassword"
                      placeholder="Konfirmasi Password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? "Mendaftar..." : "Daftar"}
                </button>
              </form>
              <div className="switch-link">
                Sudah punya akun? <Link href="/login-page">Login di sini</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}