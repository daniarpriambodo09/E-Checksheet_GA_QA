// app/device-bind/page.tsx
//
// Halaman untuk binding device fisik (TC21) ↔ UUID lokal via QR scan.
//
// Flow:
//   1. Tampilkan instruksi + tombol "Mulai Scan"
//   2. Aktifkan kamera / scanner input
//   3. Proses QR result via useDeviceBind hook
//   4. Tampilkan success → redirect ke '/' setelah 2 detik
//   5. Tampilkan error → opsi "Coba Lagi"
//
// Tidak menggunakan library QR scanner eksternal — menggunakan
// <input> dengan capture="environment" untuk kompatibilitas TC21 Zebra.
// TC21 memiliki hardware barcode scanner yang otomatis inject ke input aktif.
//
// Untuk environment yang punya jsQR atau @zxing, bisa swap
// section kamera dengan library tersebut tanpa mengubah hook.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter }          from 'next/navigation';
import { useDeviceBind }      from '@/lib/device/useDeviceBind';
import { isDeviceBound }      from '@/lib/device/binding-storage';

// ── Style constants (inline — tidak butuh CSS file) ──────────────────────────

const COLORS = {
  primary:    '#1565C0',
  success:    '#2E7D32',
  error:      '#C62828',
  warning:    '#E65100',
  bg:         '#F5F7FA',
  card:       '#FFFFFF',
  border:     '#E0E4EA',
  textMain:   '#1A2332',
  textMuted:  '#5A6474',
  textLight:  '#8A96A4',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeviceBindPage() {
  const router              = useRouter();
  const { bindState, processQRScan, resetBind, isValidating } = useDeviceBind();
  const inputRef            = useRef<HTMLInputElement>(null);
  const [scanActive, setScanActive] = useState(false);

  // Jika sudah bound, redirect ke home
  useEffect(() => {
    if (typeof window !== 'undefined' && isDeviceBound()) {
      router.replace('/');
    }
  }, [router]);

  // Auto-redirect setelah success
  useEffect(() => {
    if (bindState.phase === 'success') {
      const timer = setTimeout(() => {
        router.replace('/');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [bindState.phase, router]);

  // ── Handle input dari scanner TC21 ───────────────────────────────────────
  // TC21 Zebra hardware scanner inject teks ke input field yang focused

  const handleScannerInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (!value) return;

    // Clear input setelah read
    if (inputRef.current) inputRef.current.value = '';
    setScanActive(false);
    processQRScan(value);
  }, [processQRScan]);

  // Handle Enter key (beberapa scanner inject Enter setelah data)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (!value) return;
      if (inputRef.current) inputRef.current.value = '';
      setScanActive(false);
      processQRScan(value);
    }
  }, [processQRScan]);

  const activateScanner = useCallback(() => {
    setScanActive(true);
    // Delay kecil agar state update dulu sebelum focus
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight:       '100dvh',
      background:      COLORS.bg,
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '24px 16px',
      fontFamily:      'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── Card utama ── */}
      <div style={{
        width:        '100%',
        maxWidth:     '420px',
        background:   COLORS.card,
        borderRadius: '16px',
        boxShadow:    '0 4px 24px rgba(0,0,0,0.08)',
        overflow:     'hidden',
      }}>

        {/* Header */}
        <div style={{
          background:  COLORS.primary,
          padding:     '24px 24px 20px',
          textAlign:   'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📱</div>
          <h1 style={{
            color:      '#fff',
            fontSize:   '18px',
            fontWeight: 700,
            margin:     0,
          }}>
            Registrasi Device Fisik
          </h1>
          <p style={{
            color:      'rgba(255,255,255,0.85)',
            fontSize:   '13px',
            margin:     '6px 0 0',
          }}>
            Scan stiker QR yang terpasang pada device TC21 ini
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {/* ── State: idle / scanning ── */}
          {(bindState.phase === 'idle' || bindState.phase === 'scanning') && (
            <>
              {/* Instruksi */}
              <div style={{ marginBottom: '20px' }}>
                <StepItem
                  step="1"
                  text="Temukan stiker QR pada bagian belakang atau samping device TC21 ini"
                />
                <StepItem
                  step="2"
                  text='Tekan tombol "Mulai Scan" di bawah'
                />
                <StepItem
                  step="3"
                  text="Arahkan scanner TC21 ke stiker QR"
                />
              </div>

              {/* Hidden input untuk scanner TC21 */}
              {/* TC21 Zebra hardware scanner inject ke input yang focused */}
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                onChange={handleScannerInput}
                onKeyDown={handleKeyDown}
                style={{
                  position:  'absolute',
                  opacity:   0,
                  width:     '1px',
                  height:    '1px',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
                tabIndex={-1}
              />

              {/* Area scan visual */}
              {scanActive ? (
                <div style={{
                  border:        `2px solid ${COLORS.primary}`,
                  borderRadius:  '12px',
                  padding:       '32px 16px',
                  textAlign:     'center',
                  marginBottom:  '16px',
                  background:    '#EEF4FF',
                  position:      'relative',
                }}>
                  {/* Animasi pulse */}
                  <div style={{
                    width:        '64px',
                    height:       '64px',
                    border:       `3px solid ${COLORS.primary}`,
                    borderRadius: '8px',
                    margin:       '0 auto 12px',
                    animation:    'pulse 1.5s ease-in-out infinite',
                  }} />
                  <style>{`
                    @keyframes pulse {
                      0%, 100% { opacity: 1; transform: scale(1); }
                      50%       { opacity: 0.5; transform: scale(0.95); }
                    }
                  `}</style>
                  <p style={{
                    color:     COLORS.primary,
                    fontSize:  '14px',
                    fontWeight: 600,
                    margin:    '0 0 4px',
                  }}>
                    Siap untuk scan
                  </p>
                  <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: 0 }}>
                    Arahkan scanner TC21 ke stiker QR pada device ini
                  </p>
                </div>
              ) : (
                <div style={{
                  border:        `2px dashed ${COLORS.border}`,
                  borderRadius:  '12px',
                  padding:       '32px 16px',
                  textAlign:     'center',
                  marginBottom:  '16px',
                  color:         COLORS.textLight,
                  fontSize:      '13px',
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>⬜</div>
                  Tekan tombol di bawah untuk memulai
                </div>
              )}

              <button
                onClick={activateScanner}
                disabled={isValidating}
                style={buttonStyle(COLORS.primary)}
              >
                {scanActive ? '🔍 Menunggu Scan...' : '📷 Mulai Scan QR'}
              </button>

              {/* Manual input fallback — untuk testing / jika scanner tidak berfungsi */}
              <ManualInputFallback onSubmit={processQRScan} disabled={isValidating} />
            </>
          )}

          {/* ── State: validating ── */}
          {bindState.phase === 'validating' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spinner />
              <p style={{ color: COLORS.textMain, fontWeight: 600, marginBottom: '4px' }}>
                Memvalidasi kode...
              </p>
              <p style={{ color: COLORS.textMuted, fontSize: '13px', margin: 0 }}>
                Menghubungi server untuk konfirmasi binding
              </p>
              {bindState.deviceCode && (
                <div style={{
                  marginTop:    '12px',
                  padding:      '8px 16px',
                  background:   '#EEF4FF',
                  borderRadius: '8px',
                  fontSize:     '13px',
                  color:        COLORS.primary,
                  fontFamily:   'monospace',
                }}>
                  {bindState.deviceCode}
                </div>
              )}
            </div>
          )}

          {/* ── State: success ── */}
          {bindState.phase === 'success' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '56px', marginBottom: '12px' }}>✅</div>
              <h2 style={{
                color:      COLORS.success,
                fontSize:   '18px',
                fontWeight: 700,
                margin:     '0 0 8px',
              }}>
                Binding Berhasil!
              </h2>
              <p style={{ color: COLORS.textMuted, fontSize: '13px', margin: '0 0 16px' }}>
                {bindState.message ?? 'Device berhasil terhubung ke identity fisik.'}
              </p>
              <div style={{
                background:    '#F0FDF4',
                border:        `1px solid #A7F3D0`,
                borderRadius:  '10px',
                padding:       '12px 16px',
                marginBottom:  '16px',
              }}>
                <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: '0 0 4px' }}>
                  Kode Device
                </p>
                <p style={{
                  color:      COLORS.success,
                  fontSize:   '20px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  margin:     0,
                }}>
                  {bindState.deviceCode}
                </p>
              </div>
              <p style={{ color: COLORS.textLight, fontSize: '12px', margin: 0 }}>
                Mengarahkan ke halaman utama...
              </p>
            </div>
          )}

          {/* ── State: error ── */}
          {bindState.phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
              <h2 style={{
                color:      COLORS.error,
                fontSize:   '17px',
                fontWeight: 700,
                margin:     '0 0 8px',
              }}>
                Binding Gagal
              </h2>
              <div style={{
                background:    '#FFF0F0',
                border:        `1px solid #FFCDD2`,
                borderRadius:  '10px',
                padding:       '12px 16px',
                marginBottom:  '20px',
                textAlign:     'left',
              }}>
                <p style={{
                  color:     COLORS.error,
                  fontSize:  '13px',
                  margin:    0,
                  lineHeight: 1.5,
                }}>
                  {bindState.error}
                </p>
              </div>
              <button
                onClick={resetBind}
                style={buttonStyle(COLORS.primary)}
              >
                🔄 Coba Lagi
              </button>
              <p style={{
                color:     COLORS.textLight,
                fontSize:  '12px',
                marginTop: '12px',
              }}>
                Jika masalah berlanjut, hubungi admin IT
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <p style={{
        color:     COLORS.textLight,
        fontSize:  '11px',
        marginTop: '24px',
        textAlign: 'center',
      }}>
        E-Checksheet QA · Physical Device Binding
      </p>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepItem({ step, text }: { step: string; text: string }) {
  return (
    <div style={{
      display:      'flex',
      gap:          '12px',
      alignItems:   'flex-start',
      marginBottom: '12px',
    }}>
      <div style={{
        width:        '24px',
        height:       '24px',
        borderRadius: '50%',
        background:   '#EEF4FF',
        color:        '#1565C0',
        fontSize:     '12px',
        fontWeight:   700,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        flexShrink:   0,
      }}>
        {step}
      </div>
      <p style={{
        fontSize:  '13px',
        color:     '#5A6474',
        margin:    0,
        lineHeight: 1.5,
        paddingTop: '3px',
      }}>
        {text}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div style={{
        width:        '48px',
        height:       '48px',
        border:       '3px solid #E0E4EA',
        borderTop:    '3px solid #1565C0',
        borderRadius: '50%',
        animation:    'spin 0.8s linear infinite',
        margin:       '0 auto 16px',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    width:        '100%',
    padding:      '14px',
    background:   color,
    color:        '#fff',
    border:       'none',
    borderRadius: '10px',
    fontSize:     '15px',
    fontWeight:   600,
    cursor:       'pointer',
    letterSpacing: '0.3px',
  };
}

// ── Manual input fallback ─────────────────────────────────────────────────────
// Untuk testing di browser desktop, atau jika hardware scanner tidak berfungsi

function ManualInputFallback({
  onSubmit,
  disabled,
}: {
  onSubmit:  (value: string) => void;
  disabled:  boolean;
}) {
  const [show, setShow]   = useState(false);
  const [value, setValue] = useState('');

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        style={{
          width:      '100%',
          padding:    '10px',
          background: 'transparent',
          color:      '#8A96A4',
          border:     'none',
          cursor:     'pointer',
          fontSize:   '12px',
          marginTop:  '8px',
        }}
      >
        Input manual (jika scanner tidak berfungsi)
      </button>
    );
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ fontSize: '12px', color: '#8A96A4', margin: '0 0 8px' }}>
        Masukkan kode device secara manual:
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="TC21-QA-001"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          style={{
            flex:         1,
            padding:      '10px 12px',
            border:       '1px solid #E0E4EA',
            borderRadius: '8px',
            fontSize:     '14px',
            fontFamily:   'monospace',
          }}
        />
        <button
          onClick={() => { if (value) { onSubmit(value); setValue(''); setShow(false); } }}
          disabled={disabled || !value}
          style={{
            padding:      '10px 16px',
            background:   '#1565C0',
            color:        '#fff',
            border:       'none',
            borderRadius: '8px',
            cursor:       'pointer',
            fontSize:     '14px',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}