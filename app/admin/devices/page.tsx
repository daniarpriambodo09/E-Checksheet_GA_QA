// app/admin/devices/page.tsx
// FEATURES:
//   - Create device (pre-registration)
//   - List & filter devices
//   - Generate QR per device_code
//   - Download PNG
//   - Print QR (print-only layout, no sidebar)

"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";

// ── Auth fetch ────────────────────────────────────────────────────────────────
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (typeof window === "undefined") return fetch(url, options);
  try {
    const userStr = localStorage.getItem("auth_current_user_v2");
    if (userStr) {
      const u = JSON.parse(userStr);
      options.headers = {
        "Content-Type": "application/json",
        ...options.headers,
        "x-user-id":   String(u.id || ""),
        "x-user-role": String(u.role || ""),
        "x-username":  String(u.username || ""),
      };
    }
  } catch {}
  return fetch(url, options);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Device {
  id: number;
  device_uuid: string;
  device_name: string | null;
  device_label: string | null;
  device_code: string;
  is_bound: boolean;
  fingerprint_hash: string | null;
  platform: string | null;
  area_code: string | null;
  area_name: string | null;
  is_active: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  registered_by: string | null;
  registered_at: string | null;
  last_seen_at: string | null;
  updated_at: string | null;
  notes: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ active, blocked }: { active: boolean; blocked: boolean }) {
  if (blocked) return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#fee2e2", color: "#b91c1c" }}>
      Blocked
    </span>
  );
  if (active) return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#dcfce7", color: "#15803d" }}>
      Active
    </span>
  );
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#f1f5f9", color: "#64748b" }}>
      Inactive
    </span>
  );
}

// ── QR Script loader (qrcodejs via CDN) ──────────────────────────────────────
declare global {
  interface Window {
    QRCode: any;
    _qrLoading?: boolean;
    _qrLoaded?: boolean;
  }
}

function loadQRScript(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window._qrLoaded) { cb(); return; }
  if (window._qrLoading) {
    const t = setInterval(() => { if (window._qrLoaded) { clearInterval(t); cb(); } }, 80);
    return;
  }
  window._qrLoading = true;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  s.onload  = () => { window._qrLoaded = true; window._qrLoading = false; cb(); };
  s.onerror = () => { window._qrLoading = false; };
  document.head.appendChild(s);
}

// ── QR Modal ──────────────────────────────────────────────────────────────────
function QRModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const qrWrapRef  = useRef<HTMLDivElement>(null);
  const qrElemRef  = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // QR content: JSON sederhana sesuai spec
  const qrContent = JSON.stringify({ device_code: device.device_code });

  // ── Render QR ke DOM ────────────────────────────────────────────────────
  useEffect(() => {
    if (!qrWrapRef.current) return;

    const container = document.createElement("div");
    container.style.cssText = "width:200px;height:200px;";
    qrElemRef.current = container;
    qrWrapRef.current.appendChild(container);

    loadQRScript(() => {
      if (!window.QRCode || !qrElemRef.current) return;
      try {
        new window.QRCode(qrElemRef.current, {
          text:          qrContent,
          width:         200,
          height:        200,
          colorDark:     "#0f172a",
          colorLight:    "#ffffff",
          correctLevel:  window.QRCode.CorrectLevel.M,
        });
        setReady(true);
      } catch (e) {
        console.error("QRCode render error:", e);
      }
    });

    const el = container;
    const wrap = qrWrapRef.current;
    return () => {
      try { if (wrap?.contains(el)) wrap.removeChild(el); } catch {}
      qrElemRef.current = null;
    };
  }, [qrContent]);

  // ── Download PNG ────────────────────────────────────────────────────────
  const handleDownload = () => {
    const srcCanvas = qrElemRef.current?.querySelector("canvas");
    if (!srcCanvas) { alert("QR belum siap, tunggu sebentar."); return; }

    // Canvas final: QR + label di bawah
    const W = 320, H = 400;
    const ec  = document.createElement("canvas");
    ec.width  = W;
    ec.height = H;
    const ctx = ec.getContext("2d")!;

    // Background putih
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Border tipis
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Header bar
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 13px Arial";
    ctx.fillText("E-CheckSheet QA", W / 2, 22);
    ctx.font = "11px Arial";
    ctx.fillText("Physical Device Binding — TC21", W / 2, 42);

    // QR image (center)
    ctx.drawImage(srcCanvas, (W - 200) / 2, 68, 200, 200);

    // Separator
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 282); ctx.lineTo(W - 20, 282);
    ctx.stroke();

    // Device code
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText(device.device_code, W / 2, 308);

    // Device name
    if (device.device_name) {
      ctx.fillStyle = "#475569";
      ctx.font = "12px Arial";
      ctx.fillText(device.device_name, W / 2, 330);
    }

    // Label
    if (device.device_label) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Arial";
      ctx.fillText(device.device_label, W / 2, 350);
    }

    // Footer
    ctx.fillStyle = "#eff6ff";
    ctx.beginPath();
    (ctx as any).roundRect?.(16, 364, W - 32, 24, 6) ?? ctx.rect(16, 364, W - 32, 24);
    ctx.fill();
    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 10px Arial";
    ctx.fillText("Scan di /device-bind untuk aktivasi TC21", W / 2, 380);

    const filename = `QR_Device_${device.device_code}.png`;
    const a = document.createElement("a");
    a.download = filename;
    a.href = ec.toDataURL("image/png");
    a.click();
  };

  // ── Print ───────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const srcCanvas = qrElemRef.current?.querySelector("canvas");
    if (!srcCanvas) { alert("QR belum siap, tunggu sebentar."); return; }

    const dataUrl = srcCanvas.toDataURL("image/png");

    const printWin = window.open("", "_blank", "width=400,height=600");
    if (!printWin) { alert("Popup diblokir. Izinkan popup untuk print."); return; }

    const boundBadge = device.is_bound
      ? `<span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">Bound</span>`
      : `<span style="background:#fef9c3;color:#854d0e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">Unbound</span>`;

    printWin.document.write(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>QR Device — ${device.device_code}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: white;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px;
    }
    .card {
      width: 280px;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .header {
      background: #1e3a5f;
      color: white;
      text-align: center;
      padding: 10px 12px;
    }
    .header h1 { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
    .header p  { font-size: 10px; opacity: .85; }
    .qr-area {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      background: white;
    }
    .qr-area img { width: 180px; height: 180px; display: block; }
    .divider { height: 1px; background: #e2e8f0; margin: 0 16px; }
    .info {
      padding: 12px 16px;
      text-align: center;
    }
    .device-code {
      font-family: monospace;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: .04em;
      margin-bottom: 6px;
    }
    .device-name  { font-size: 12px; color: #475569; margin-bottom: 4px; }
    .device-label { font-size: 11px; color: #94a3b8; }
    .badges { display: flex; justify-content: center; gap: 6px; margin-top: 8px; }
    .footer {
      background: #eff6ff;
      border-top: 1px solid #bfdbfe;
      padding: 8px 12px;
      text-align: center;
      font-size: 10px;
      color: #1e40af;
      font-weight: 700;
    }
    @media print {
      @page { margin: 8mm; size: 80mm 110mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>E-CheckSheet QA</h1>
      <p>Physical Device Binding — TC21</p>
    </div>
    <div class="qr-area">
      <img src="${dataUrl}" alt="QR Code ${device.device_code}" />
    </div>
    <div class="divider"></div>
    <div class="info">
      <div class="device-code">${device.device_code}</div>
      ${device.device_name  ? `<div class="device-name">${device.device_name}</div>`  : ""}
      ${device.device_label ? `<div class="device-label">${device.device_label}</div>` : ""}
      <div class="badges">${boundBadge}</div>
    </div>
    <div class="footer">📷 Scan di /device-bind untuk aktivasi</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>
    `);
    printWin.document.close();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(15, 23, 42, 0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,.18)", border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}>
        {/* Modal header */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f, #1e88e5)",
          padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 700, color: "white" }}>
              QR Code Device
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,.75)" }}>
              Physical Device Binding — TC21
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.2)", border: "none", color: "white",
            width: 34, height: 34, borderRadius: 10, cursor: "pointer",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* QR area */}
        <div style={{ padding: "28px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {/* QR container */}
          <div style={{
            position: "relative", width: 220, height: 220,
            background: "#f8fafc", borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #e2e8f0",
            marginBottom: 20,
          }}>
            <div ref={qrWrapRef} style={{ display: "flex", alignItems: "center", justifyContent: "center" }} />
            {!ready && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 10,
              }}>
                <div style={{
                  width: 30, height: 30, border: "3px solid #e2e8f0",
                  borderTopColor: "#1e88e5", borderRadius: "50%",
                  animation: "spin .8s linear infinite",
                }} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Generating...</span>
              </div>
            )}
          </div>

          {/* Device info */}
          <div style={{
            width: "100%", background: "#f8fafc", borderRadius: 12,
            padding: "14px 16px", border: "1px solid #e2e8f0",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>Device Code</span>
              {device.is_bound
                ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#dbeafe", color: "#1e40af" }}>Bound</span>
                : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fef9c3", color: "#854d0e" }}>Belum Bound</span>}
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#0f172a", fontFamily: "monospace", letterSpacing: ".04em" }}>
              {device.device_code}
            </p>
            {device.device_name && (
              <p style={{ margin: "0 0 2px", fontSize: 13, color: "#475569" }}>{device.device_name}</p>
            )}
            {device.device_label && (
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{device.device_label}</p>
            )}
          </div>

          {/* QR content preview */}
          <div style={{
            width: "100%", background: "#1e293b", borderRadius: 8, padding: "8px 12px",
            marginBottom: 20, textAlign: "center",
          }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>QR Content</p>
            <code style={{ fontSize: 12, color: "#67e8f9" }}>{qrContent}</code>
          </div>

          {/* Action buttons */}
          <div style={{ width: "100%", display: "flex", gap: 10 }}>
            <button
              onClick={handleDownload}
              disabled={!ready}
              style={{
                flex: 1, padding: "12px 0",
                background: ready ? "linear-gradient(135deg, #1e88e5, #1565c0)" : "#93c5fd",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: ready ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: ready ? "0 4px 12px rgba(30,136,229,.3)" : "none",
              }}
            >
              ⬇ Download PNG
            </button>
            <button
              onClick={handlePrint}
              disabled={!ready}
              style={{
                flex: 1, padding: "12px 0",
                background: ready ? "white" : "#f8fafc",
                color: ready ? "#1e293b" : "#94a3b8",
                border: `2px solid ${ready ? "#e2e8f0" : "#f1f5f9"}`,
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: ready ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Register Modal ────────────────────────────────────────────────────────────
function RegisterModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (device: Device) => void;
}) {
  const [deviceCode,  setDeviceCode]  = useState("");
  const [deviceName,  setDeviceName]  = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!deviceCode.trim()) { setError("Device Code wajib diisi."); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await authFetch("/api/admin/devices", {
        method: "POST",
        body: JSON.stringify({
          device_code:  deviceCode.trim().toUpperCase(),
          device_name:  deviceName.trim() || null,
          device_label: deviceLabel.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      onSuccess(data.device);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15, 23, 42, 0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,.15)", border: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Register Device Baru</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Tambahkan unit TC21 ke production fleet</p>
          </div>
          <button onClick={onClose} style={{
            background: "#f1f5f9", border: "none", width: 32, height: 32,
            borderRadius: 8, cursor: "pointer", fontSize: 16, color: "#64748b",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #ef4444",
            borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#b91c1c",
          }}>⚠️ {error}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { label: "Device Code", req: true,  val: deviceCode,  set: (v: string) => setDeviceCode(v.toUpperCase()), ph: "Contoh: HT_SCANQA30", mono: true  },
            { label: "Device Name", req: false, val: deviceName,  set: setDeviceName,  ph: "Contoh: TC21 UNIT 1",   mono: false },
            { label: "Device Label",req: false, val: deviceLabel, set: setDeviceLabel, ph: "Contoh: CV.B4",          mono: false },
          ].map(f => (
            <div key={f.label}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>
                {f.label} {f.req && <span style={{ color: "#ef4444" }}>*</span>}
              </label>
              <input
                type="text" placeholder={f.ph} value={f.val}
                onChange={e => f.set(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", border: "2px solid #e2e8f0",
                  borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
                  fontFamily: f.mono ? "monospace" : "inherit", color: "#1e293b",
                }}
                onFocus={e => e.target.style.borderColor = "#1e88e5"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 0", background: "white", color: "#475569",
            border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>Batal</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, padding: "12px 0",
            background: submitting ? "#93c5fd" : "linear-gradient(135deg, #1e88e5, #1565c0)",
            color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            boxShadow: submitting ? "none" : "0 4px 12px rgba(30,136,229,.3)",
          }}>
            {submitting ? "Menyimpan..." : "+ Create Device"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const router = useRouter();
  const { user, loading: authLoading, isInitialized } = useAuth();

  const [devices,      setDevices]      = useState<Device[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [apiError,     setApiError]     = useState<string | null>(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [qrDevice,     setQrDevice]     = useState<Device | null>(null);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "bound" | "blocked">("all");

  // Auth guard
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    if (!user) { router.push("/login-page"); return; }
    if (!["admin", "superadmin"].includes(user.role)) router.push("/home");
  }, [user, authLoading, isInitialized, router]);

  // Load devices
  const loadDevices = useCallback(async () => {
    setIsLoading(true); setApiError(null);
    try {
      const res = await authFetch("/api/admin/devices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setDevices(data.devices ?? []);
    } catch (e: any) {
      setApiError(e.message || "Gagal memuat data devices.");
      setDevices([]);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (isInitialized && !authLoading && user) loadDevices();
  }, [isInitialized, authLoading, user, loadDevices]);

  // Stats
  const stats = {
    total:   devices.length,
    active:  devices.filter(d => d.is_active && !d.is_blocked).length,
    bound:   devices.filter(d => d.is_bound).length,
    blocked: devices.filter(d => d.is_blocked).length,
  };

  // Filter
  const filtered = devices.filter(d => {
    const s = searchQuery.toLowerCase();
    const matchSearch = s === "" ||
      d.device_code.toLowerCase().includes(s) ||
      (d.device_name  || "").toLowerCase().includes(s) ||
      (d.device_label || "").toLowerCase().includes(s);
    const matchStatus =
      filterStatus === "all"     ? true :
      filterStatus === "active"  ? (d.is_active && !d.is_blocked) :
      filterStatus === "bound"   ? d.is_bound :
      filterStatus === "blocked" ? d.is_blocked : true;
    return matchSearch && matchStatus;
  });

  if (authLoading || !isInitialized) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 14px" }} />
        <p style={{ color: "#64748b", fontSize: 13 }}>Memuat...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!user) return null;

  return (
    <div style={{
      marginLeft: 80, padding: 24, minHeight: "100vh",
      background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <Sidebar userName={user.fullName || user.username} />

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f, #1e88e5)",
        borderRadius: 16, padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, boxShadow: "0 4px 16px rgba(30,136,229,.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.back()} style={{
            background: "rgba(255,255,255,.15)", border: "none", color: "white",
            width: 40, height: 40, borderRadius: 10, cursor: "pointer",
            fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "white" }}>
              📱 Device Management
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.8)" }}>
              Kelola perangkat TC21 — create, generate QR, dan print sticker binding
            </p>
          </div>
        </div>
        <button onClick={() => setShowRegModal(true)} style={{
          background: "white", color: "#1565c0", border: "none",
          padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        }}>
          + Create Device
        </button>
      </div>

      {/* ── API Error ── */}
      {apiError && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e",
        }}>⚠️ {apiError}</div>
      )}

      {/* ── Stats Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "TOTAL DEVICES", value: stats.total,   dot: "#94a3b8" },
          { label: "ACTIVE",        value: stats.active,  dot: "#22c55e" },
          { label: "BOUND",         value: stats.bound,   dot: "#1e88e5" },
          { label: "BLOCKED",       value: stats.blocked, dot: "#ef4444" },
        ].map(s => (
          <div key={s.label} style={{
            background: "white", borderRadius: 14, padding: "20px 22px",
            border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: ".08em" }}>{s.label}</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
            </div>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#1e293b" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter & Search ── */}
      <div style={{
        background: "white", borderRadius: 16, padding: "18px 20px",
        border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.04)", marginBottom: 20,
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
      }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" placeholder="Cari device code, nama, label..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 12px 10px 38px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1e293b" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "active", "bound", "blocked"] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)} style={{
              padding: "9px 16px",
              border: filterStatus === f ? "2px solid #1e88e5" : "2px solid #e2e8f0",
              borderRadius: 9, background: filterStatus === f ? "#eff6ff" : "white",
              fontSize: 13, fontWeight: 600,
              color: filterStatus === f ? "#1565c0" : "#64748b",
              cursor: "pointer",
            }}>
              {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={loadDevices} style={{
          padding: "9px 16px", background: "#f1f5f9", border: "2px solid #e2e8f0",
          borderRadius: 9, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer",
        }}>🔄 Refresh</button>
      </div>

      {/* ── Device Table ── */}
      <div style={{
        background: "white", borderRadius: 16, border: "1px solid #e2e8f0",
        boxShadow: "0 1px 4px rgba(0,0,0,.04)", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "2px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
            Daftar Devices
            {!isLoading && (
              <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>
                ({filtered.length} dari {devices.length})
              </span>
            )}
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: 60 }}>
            <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#1e88e5", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Memuat data...</p>
          </div>

        ) : filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, background: "#f1f5f9", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>📱</div>
            <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
              {devices.length === 0 ? "Belum ada device terdaftar" : "Tidak ada hasil pencarian"}
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b", maxWidth: 320, marginInline: "auto" }}>
              {devices.length === 0
                ? "Daftarkan unit TC21 pertama Anda untuk mulai mengelola production fleet."
                : "Coba ubah kata kunci pencarian atau filter status."}
            </p>
            {devices.length === 0 && (
              <button onClick={() => setShowRegModal(true)} style={{
                padding: "12px 24px", background: "linear-gradient(135deg, #1e88e5, #1565c0)",
                color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 4px 12px rgba(30,136,229,.3)",
              }}>+ Register First Device</button>
            )}
          </div>

        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Device Code", "Nama / Label", "Status", "Binding", "Area", "Platform", "Last Seen", "Terdaftar", "Aksi"].map(h => (
                    <th key={h} style={{
                      padding: "12px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "#64748b",
                      textTransform: "uppercase", letterSpacing: ".05em",
                      borderBottom: "2px solid #f1f5f9", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.id} style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                    transition: "background .15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Device Code */}
                    <td style={{ padding: "14px 16px" }}>
                      <code style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6 }}>
                        {d.device_code}
                      </code>
                    </td>
                    {/* Nama / Label */}
                    <td style={{ padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                        {d.device_name || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>—</span>}
                      </p>
                      {d.device_label && <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{d.device_label}</p>}
                    </td>
                    {/* Status */}
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge active={d.is_active} blocked={d.is_blocked} />
                    </td>
                    {/* Binding */}
                    <td style={{ padding: "14px 16px" }}>
                      {d.is_bound
                        ? <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#dbeafe", color: "#1e40af" }}>✓ Bound</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#fef9c3", color: "#854d0e" }}>Unbound</span>}
                    </td>
                    {/* Area */}
                    <td style={{ padding: "14px 16px" }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#1e293b" }}>{d.area_name || "—"}</p>
                      {d.area_code && <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{d.area_code}</p>}
                    </td>
                    {/* Platform */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{d.platform || "—"}</span>
                    </td>
                    {/* Last Seen */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{formatDate(d.last_seen_at)}</span>
                    </td>
                    {/* Terdaftar */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{formatDate(d.registered_at)}</span>
                    </td>
                    {/* Aksi — QR buttons */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          onClick={() => setQrDevice(d)}
                          title="Generate & lihat QR Code"
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px",
                            background: "#eff6ff", color: "#1565c0",
                            border: "1.5px solid #bfdbfe", borderRadius: 8,
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all .15s",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#dbeafe";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "#93c5fd";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "#bfdbfe";
                          }}
                        >
                          🔲 QR Code
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showRegModal && (
        <RegisterModal
          onClose={() => setShowRegModal(false)}
          onSuccess={newDevice => {
            setDevices(prev => [newDevice as Device, ...prev]);
            setShowRegModal(false);
          }}
        />
      )}

      {qrDevice && (
        <QRModal
          device={qrDevice}
          onClose={() => setQrDevice(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body > * { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
    </div>
  );
}