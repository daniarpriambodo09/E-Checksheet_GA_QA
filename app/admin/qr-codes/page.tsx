// app/admin/qr-codes/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { QRCodeCanvas } from "qrcode.react";

// =====================================================================
// === TYPE DEFINITIONS ===
// =====================================================================
interface CategoryOption {
  id?: number;
  label: string;
  value: string;
  type: string;
  area: string;
  description?: string;
  areas?: AreaOption[];
}

interface AreaOption {
  id: number;
  label: string;
  value: string;
  description?: string;
}

interface QRCodeConfig {
  id: string;
  category: string;
  categoryLabel: string;
  areaCode: string;
  areaLabel: string;
  qrValue: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

interface GeneratedQR {
  category: string;
  categoryLabel: string;
  areaCode: string;
  areaLabel: string;
  qrValue: string;
}

// =====================================================================
// === HELPER FUNCTIONS ===
// =====================================================================
const generateQRValue = (
  category: string,
  areaCode: string,
  type: "checklist" | "gauge" = "checklist",
  gaugeCode?: string
): string => {
  if (type === "gauge" && gaugeCode) {
    return `GAUGE:MULTI:${gaugeCode}:${areaCode}`;
  }
  return `CHECKLIST:${category}:${areaCode}`;
};

// =====================================================================
// === MAIN COMPONENT ===
// =====================================================================
export default function AdminQRCodesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ===== STATE =====
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [qrType, setQrType] = useState<"checklist" | "gauge">("checklist");
  const [gaugeCode, setGaugeCode] = useState("");
  const [generatedQR, setGeneratedQR] = useState<GeneratedQR | null>(null);
  const [savedQRCodes, setSavedQRCodes] = useState<QRCodeConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ===== LOAD CATEGORIES =====
  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/dashboard/get-categories?includeAreas=true");
      
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Filter: hanya kategori yang support QR checklist
        const qrCompatible = data.categories.filter((cat: CategoryOption) => 
          cat.value !== "All Category" && 
          ["final-assy", "pre-assy", "general", "safety"].includes(cat.type)
        );
        setCategories(qrCompatible);
        
        // Set default selection
        if (qrCompatible.length > 0 && !selectedCategory) {
          setSelectedCategory(qrCompatible[0].value);
        }
      }
    } catch (err) {
      console.error("❌ Error loading categories:", err);
      setError("Gagal memuat daftar kategori");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  // ===== LOAD SAVED QR CODES =====
  const loadSavedQRCodes = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/qr-codes");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSavedQRCodes(data.qrCodes);
        }
      }
    } catch (err) {
      console.warn("⚠️ Could not load saved QR codes:", err);
    }
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    if (authLoading) return;
    
    // ✅ Role check: hanya admin yang bisa akses
    if (!user || user.role !== "admin") {
      router.push("/home");
      return;
    }

    loadCategories();
    loadSavedQRCodes();
  }, [user, authLoading, router, loadCategories, loadSavedQRCodes]);

  // ===== UPDATE AREA OPTIONS WHEN CATEGORY CHANGES =====
  const currentCategory = categories.find(c => c.value === selectedCategory);
  const areaOptions: AreaOption[] = currentCategory?.areas || [];

  useEffect(() => {
    // Reset area ketika category berubah
    if (areaOptions.length > 0) {
      setSelectedArea(areaOptions[0].value);
    } else {
      setSelectedArea("");
    }
  }, [areaOptions, selectedCategory]);

  // ===== GENERATE QR PREVIEW =====
  const handleGeneratePreview = useCallback(() => {
    if (!selectedCategory || !selectedArea) {
      setError("Pilih kategori dan area terlebih dahulu");
      return;
    }
    
    if (qrType === "gauge" && !gaugeCode.trim()) {
      setError("Masukkan kode gauge untuk QR tipe Gauge");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const category = categories.find(c => c.value === selectedCategory);
      const area = areaOptions.find(a => a.value === selectedArea);

      const qrValue = generateQRValue(
        selectedCategory,
        selectedArea,
        qrType,
        qrType === "gauge" ? gaugeCode.trim() : undefined
      );

      setGeneratedQR({
        category: selectedCategory,
        categoryLabel: category?.label || selectedCategory,
        areaCode: selectedArea,
        areaLabel: area?.label || selectedArea,
        qrValue
      });

      setShowPreview(true);
      setSuccess("QR Code berhasil digenerate! Silakan preview atau simpan.");
    } catch (err) {
      setError("Gagal generate QR Code");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedCategory, selectedArea, qrType, gaugeCode, categories, areaOptions]);

  // ===== SAVE QR CODE TO DATABASE =====
  const handleSaveQRCode = useCallback(async () => {
    if (!generatedQR || !user) return;
    
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryCode: generatedQR.category,
          categoryLabel: generatedQR.categoryLabel,
          areaCode: generatedQR.areaCode,
          areaLabel: generatedQR.areaLabel,
          qrValue: generatedQR.qrValue,
          createdBy: user.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save QR code");
      }

      setSuccess("✅ QR Code berhasil disimpan ke database!");
      
      // Refresh list
      loadSavedQRCodes();
      
      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error("❌ Error saving QR code:", err);
      setError(err.message || "Gagal menyimpan QR Code");
    } finally {
      setIsSaving(false);
    }
  }, [generatedQR, user, loadSavedQRCodes]);

  // ===== DELETE QR CODE =====
  const handleDeleteQRCode = useCallback(async (qrId: string) => {
    if (!confirm("Yakin ingin menghapus QR Code ini?")) return;
    
    try {
      const response = await fetch(`/api/admin/qr-codes?id=${qrId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setSuccess("QR Code berhasil dihapus");
        loadSavedQRCodes();
        setTimeout(() => setSuccess(null), 2000);
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghapus QR Code");
    }
  }, [loadSavedQRCodes]);

  // ===== DOWNLOAD QR AS PNG =====
  const handleDownloadQR = useCallback(() => {
    if (!generatedQR) return;
    
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `QR-${generatedQR.category}-${generatedQR.areaCode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    setSuccess("✅ QR Code berhasil diunduh!");
    setTimeout(() => setSuccess(null), 2000);
  }, [generatedQR]);

  // ===== COPY QR VALUE TO CLIPBOARD =====
  const handleCopyQRValue = useCallback(() => {
    if (!generatedQR) return;
    
    navigator.clipboard.writeText(generatedQR.qrValue);
    setSuccess("✅ QR Value disalin ke clipboard!");
    setTimeout(() => setSuccess(null), 2000);
  }, [generatedQR]);

  // ===== EARLY RETURNS =====
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }
  
  if (!user || user.role !== "admin") {
    return null; // Will redirect via useEffect
  }

  // ===== RENDER =====
  return (
    <>
      <Sidebar userName={user.fullName || user.username} />
      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <button
            onClick={() => router.back()}
            className="back-button"
            aria-label="Kembali"
          >
            ←
          </button>
          <h1 className="page-title">🔲 Manajemen QR Code</h1>
          <div className="header-badge">
            <span className="badge-admin">Admin</span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="alert-close">✕</button>
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            <span className="alert-icon">✅</span>
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="alert-close">✕</button>
          </div>
        )}

        {/* Generator Section */}
        <section className="card">
          <h2 className="card-title">🎨 Generate QR Code Baru</h2>
          
          <div className="form-grid">
            {/* Category Select */}
            <div className="form-group">
              <label className="form-label">Kategori Checklist *</label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={isLoading}
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label} ({cat.type})
                  </option>
                ))}
              </select>
              {currentCategory?.description && (
                <p className="form-hint">{currentCategory.description}</p>
              )}
            </div>

            {/* Area Select */}
            <div className="form-group">
              <label className="form-label">Area / Lokasi *</label>
              <select
                className="form-select"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                disabled={!selectedCategory || areaOptions.length === 0}
              >
                <option value="">-- Pilih Area --</option>
                {areaOptions.map((area) => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
              </select>
              {areaOptions.length === 0 && selectedCategory && (
                <p className="form-hint text-orange-600">
                  ⚠️ Tidak ada area terdaftar untuk kategori ini
                </p>
              )}
            </div>

            {/* QR Type Toggle */}
            <div className="form-group">
              <label className="form-label">Tipe QR Code</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${qrType === "checklist" ? "active" : ""}`}
                  onClick={() => setQrType("checklist")}
                >
                  📋 Checklist
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${qrType === "gauge" ? "active" : ""}`}
                  onClick={() => setQrType("gauge")}
                >
                  📏 Gauge
                </button>
              </div>
            </div>

            {/* Gauge Code Input (conditional) */}
            {qrType === "gauge" && (
              <div className="form-group">
                <label className="form-label">Kode Gauge *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: GAUGE-001"
                  value={gaugeCode}
                  onChange={(e) => setGaugeCode(e.target.value.toUpperCase())}
                  maxLength={20}
                />
                <p className="form-hint">Kode unik untuk identifikasi gauge</p>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleGeneratePreview}
              disabled={isGenerating || !selectedCategory || !selectedArea || (qrType === "gauge" && !gaugeCode)}
            >
              {isGenerating ? (
                <>
                  <span className="spinner-small"></span>
                  Generating...
                </>
              ) : (
                "🔲 Generate Preview"
              )}
            </button>
            
            {generatedQR && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? "🔙 Sembunyikan Preview" : "👁️ Tampilkan Preview"}
              </button>
            )}
          </div>
        </section>

        {/* Preview Section */}
        {showPreview && generatedQR && (
          <section className="card">
            <h2 className="card-title">👁️ Preview QR Code</h2>
            
            <div className="qr-preview-container">
              <div className="qr-code-display">
                <QRCodeCanvas
                  id="qr-canvas"
                  value={generatedQR.qrValue}
                  size={200}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            
              <div className="qr-details">
                <div className="detail-row">
                  <span className="detail-label">Format:</span>
                  <code className="detail-value">{generatedQR.qrValue}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Kategori:</span>
                  <span className="detail-value">{generatedQR.categoryLabel}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Area:</span>
                  <span className="detail-value">{generatedQR.areaLabel}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tipe:</span>
                  <span className="detail-value">
                    {qrType === "gauge" ? "📏 Gauge" : "📋 Checklist"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="qr-actions">
              <button
                className="btn btn-success"
                onClick={handleSaveQRCode}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-small"></span>
                    Menyimpan...
                  </>
                ) : (
                  "💾 Simpan ke Database"
                )}
              </button>
            
              <button
                className="btn btn-outline"
                onClick={handleDownloadQR}
              >
                📥 Download PNG
              </button>
            
              <button
                className="btn btn-outline"
                onClick={handleCopyQRValue}
              >
                📋 Copy Value
              </button>
            </div>
          </section>
        )}

        {/* Saved QR Codes List */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">📦 QR Codes Tersimpan</h2>
            <span className="badge-count">{savedQRCodes.length} items</span>
          </div>

          {savedQRCodes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔲</div>
              <p className="empty-title">Belum ada QR Code tersimpan</p>
              <p className="empty-desc">
                Generate QR Code baru menggunakan form di atas untuk mulai mengelola.
              </p>
            </div>
          ) : (
            <div className="qr-list">
              {savedQRCodes.map((qr) => (
                <div key={qr.id} className="qr-list-item">
                  <div className="qr-item-info">
                    <div className="qr-mini-code">
                      <QRCodeCanvas
                        value={qr.qrValue}
                        size={60}
                        level="M"
                      />
                    </div>
                    <div className="qr-item-details">
                      <div className="qr-item-header">
                        <span className="qr-category">{qr.categoryLabel}</span>
                      </div>
                      <p className="qr-area">📍 {qr.areaLabel}</p>
                      <code className="qr-value">{qr.qrValue}</code>
                      <p className="qr-meta">
                        Dibuat: {new Date(qr.createdAt).toLocaleDateString("id-ID")} 
                        oleh {qr.createdBy}
                      </p>
                    </div>
                  </div>
                
                  <div className="qr-item-actions">
                    <button
                      className="btn-icon btn-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(qr.qrValue);
                        setSuccess("✅ Disalin!");
                        setTimeout(() => setSuccess(null), 1500);
                      }}
                      title="Copy QR Value"
                    >
                      📋
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => handleDeleteQRCode(qr.id)}
                      title="Hapus QR Code"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info Box */}
        <section className="info-box">
          <h3>📚 Panduan Format QR Code</h3>
          <div className="info-grid">
            <div className="info-item">
              <strong>Checklist:</strong>
              <code>CHECKLIST:{'{CATEGORY}:{AREA}'}</code>
              <p className="info-desc">Untuk membuka halaman checklist sesuai kategori dan area</p>
            </div>
            <div className="info-item">
              <strong>Gauge:</strong>
              <code>GAUGE:{'{TYPE}:{CODE}:{AREA}'}</code>
              <p className="info-desc">Untuk membuka halaman inspeksi gauge/alat ukur</p>
            </div>
            <div className="info-item">
              <strong>Contoh:</strong>
              <code>CHECKLIST:final-assy:genba-a-mazda</code>
              <p className="info-desc">Scan ini akan membuka checklist Final Assy di area Genba A Mazda</p>
            </div>
          </div>
        </section>
      </main>

      {/* Styles */}
      <style jsx>{`
        .main-content {
          margin-left: 80px;
          padding: 24px;
          min-height: 100vh;
          background: #f8fafc;
          max-width: 1400px;
        }

        /* Header */
        .header-section {
          background: linear-gradient(135deg, #1e40af, #1d4ed8);
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 14px rgba(30, 64, 175, 0.25);
        }

        .back-button {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .page-title {
          flex: 1;
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }

        .badge-admin {
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        /* Alerts */
        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: slideIn 0.3s ease;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          color: #dc2626;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-left: 4px solid #22c55e;
          color: #166534;
        }

        .alert-icon {
          font-size: 18px;
        }

        .alert-close {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          opacity: 0.7;
        }

        .alert-close:hover {
          opacity: 1;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Cards */
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .card-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 20px 0;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .badge-count {
          background: #e0e7ff;
          color: #3730a3;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        /* Form Grid */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-weight: 600;
          color: #334155;
          font-size: 14px;
        }

        .form-select,
        .form-input {
          padding: 10px 14px;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          transition: all 0.2s;
        }

        .form-select:focus,
        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-select:disabled,
        .form-input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        .form-hint {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }

        .form-hint.text-orange-600 {
          color: #ea580c;
        }

        /* Toggle Group */
        .toggle-group {
          display: flex;
          gap: 8px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          width: fit-content;
        }

        .toggle-btn {
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: white;
          color: #1e40af;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .toggle-btn:hover:not(.active) {
          color: #1e293b;
        }

        /* Form Actions */
        .form-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* Buttons */
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #1e40af, #1d4ed8);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #1e40af;
          border: 2px solid #3b82f6;
        }

        .btn-secondary:hover {
          background: #eff6ff;
        }

        .btn-success {
          background: #22c55e;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #16a34a;
        }

        .btn-outline {
          background: white;
          color: #334155;
          border: 2px solid #cbd5e1;
        }

        .btn-outline:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* QR Preview */
        .qr-preview-container {
          display: flex;
          gap: 32px;
          align-items: flex-start;
          padding: 24px;
          background: #f8fafc;
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .qr-code-display {
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .qr-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .detail-label {
          font-weight: 600;
          color: #64748b;
          min-width: 100px;
          font-size: 14px;
        }

        .detail-value {
          color: #1e293b;
          font-size: 14px;
        }

        .detail-value code {
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }

        /* QR Actions */
        .qr-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }

        /* QR List */
        .qr-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .qr-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s;
        }

        .qr-list-item:hover {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .qr-item-info {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }

        .qr-mini-code {
          background: white;
          padding: 8px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .qr-item-details {
          flex: 1;
        }

        .qr-item-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;
        }

        .qr-category {
          font-weight: 700;
          color: #1e293b;
          font-size: 14px;
        }

        .qr-area {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 6px 0;
        }

        .qr-value {
          display: block;
          background: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 11px;
          color: #475569;
          margin-bottom: 6px;
          word-break: break-all;
        }

        .qr-meta {
          font-size: 11px;
          color: #94a3b8;
          margin: 0;
        }

        .qr-item-actions {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          background: white;
        }

        .btn-copy:hover {
          background: #dbeafe;
          color: #1e40af;
        }

        .btn-delete:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 40px 20px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .empty-title {
          font-weight: 600;
          color: #334155;
          margin: 0 0 8px 0;
          font-size: 16px;
        }

        .empty-desc {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        /* Info Box */
        .info-box {
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          border: 1px solid #bfdbfe;
          border-left: 4px solid #3b82f6;
          border-radius: 12px;
          padding: 20px 24px;
        }

        .info-box h3 {
          margin: 0 0 16px 0;
          color: #1e40af;
          font-size: 16px;
          font-weight: 700;
        }

        .info-grid {
          display: grid;
          gap: 16px;
        }

        .info-item {
          background: rgba(255, 255, 255, 0.7);
          padding: 12px 16px;
          border-radius: 8px;
        }

        .info-item strong {
          color: #1e40af;
          font-size: 13px;
        }

        .info-item code {
          display: block;
          background: #f1f5f9;
          padding: 8px 12px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          color: #475569;
          margin: 6px 0;
          word-break: break-all;
        }

        .info-desc {
          font-size: 12px;
          color: #475569;
          margin: 0;
          line-height: 1.4;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .main-content {
            margin-left: 0;
            padding: 16px;
          }

          .qr-preview-container {
            flex-direction: column;
            text-align: center;
          }

          .detail-row {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .qr-list-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .qr-item-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .header-section {
            flex-wrap: wrap;
          }

          .page-title {
            order: 3;
            width: 100%;
            margin-top: 8px;
            font-size: 18px;
          }
        }

        @media (max-width: 480px) {
          .card {
            padding: 16px;
          }

          .btn {
            padding: 8px 16px;
            font-size: 13px;
          }

          .qr-actions {
            flex-direction: column;
          }

          .qr-actions .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}