// components/ChecksheetComponents/CarlineLineSection.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';

interface CarlineLineSectionProps {
  // Props lama (backward compat) — carline dipakai sebagai conveyor
  carline:    string;
  setCarline: (value: string) => void;
  line:       string;
  setLine:    (value: string) => void;
  history:    Array<{ carline: string; line: string }>;
  areaId?:    number;
  areaCode?:  string;
  // Props baru (opsional)
  userId?:       string;
  categoryCode?: string;
  isLoading?:    boolean;
}

export default function CarlineLineSection({
  carline,       // ← dipakai sebagai nilai conveyor
  setCarline,    // ← dipakai sebagai setter conveyor
  areaCode,
  userId,
  categoryCode = 'final-assy-inspector',
  isLoading = false,
}: CarlineLineSectionProps) {
  const [conveyorOptions, setConveyorOptions] = useState<string[]>([]);
  const [conveyorInput, setConveyorInput]     = useState('');
  const [isFetching, setIsFetching]           = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Nilai conveyor saat ini = props carline (backward compat)
  const conveyor    = carline;
  const setConveyor = setCarline;

  // ── Fetch daftar conveyor existing ───────────────────────────────
  const fetchOptions = useCallback(async (code: string) => {
    if (!code) return;
    setIsFetching(true);
    try {
      const res  = await fetch(
        `/e-checksheet-qa/api/final-assy/get-carline-line?areaCode=${encodeURIComponent(code)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        const list = [
          ...new Set(
            data
              .map((d: any) => d.conveyor || d.carline)
              .filter(Boolean)
          ),
        ] as string[];
        setConveyorOptions(list);
      }
    } catch (err) {
      console.error('[CarlineLineSection/ConveyorSection] fetch error:', err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    setConveyorOptions([]);
    setConveyor('');
    if (areaCode) fetchOptions(areaCode);
  }, [areaCode, fetchOptions]);

  // ── Tambah conveyor baru ─────────────────────────────────────────
  const handleAdd = async () => {
    const cv = conveyorInput.trim().toUpperCase();
    if (!cv) { setError('Nama conveyor harus diisi.'); return; }

    if (conveyorOptions.some(o => o.toUpperCase() === cv)) {
      setConveyor(cv);
      setConveyorInput('');
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/e-checksheet-qa/api/final-assy/save-conveyor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conveyor: cv, areaCode, userId, categoryCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Sudah ada di DB → tambahkan ke list lokal dan pilih
          setConveyorOptions(prev => prev.includes(cv) ? prev : [...prev, cv]);
          setConveyor(cv);
          setConveyorInput('');
          return;
        }
        throw new Error(data.error || 'Gagal menyimpan conveyor.');
      }

      setConveyorOptions(prev => [...prev, cv]);
      setConveyor(cv);
      setConveyorInput('');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan. Coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  return (
    <div className="conveyor-section">
      <div className="conveyor-header">
        <span className="conveyor-icon">🏭</span>
        <h3 className="conveyor-title">Conveyor</h3>
        {conveyor && (
          <span className="conveyor-selected-badge">✓ {conveyor}</span>
        )}
      </div>

      {/* ── Dropdown pilih conveyor yang sudah ada ── */}
      {(conveyorOptions.length > 0 || isFetching) && (
        <div className="conveyor-row">
          <label className="conveyor-label">Pilih Conveyor</label>
          <select
            className="conveyor-select"
            value={conveyor}
            onChange={e => setConveyor(e.target.value)}
            disabled={isLoading || isFetching}
          >
            <option value="">-- Pilih Conveyor --</option>
            {conveyorOptions.map(cv => (
              <option key={cv} value={cv}>{cv}</option>
            ))}
          </select>
          {isFetching && (
            <span className="conveyor-loading">Memuat...</span>
          )}
        </div>
      )}

      {/* ── Input tambah conveyor baru ── */}
      <div className="conveyor-add-section">
        <p className="conveyor-add-label">
          {conveyorOptions.length === 0 && !isFetching
            ? 'Belum ada Conveyor. Tambahkan:'
            : 'Tambah Conveyor baru:'}
        </p>
        <div className="conveyor-inputs">
          <input
            className="conveyor-input"
            type="text"
            placeholder="Nama Conveyor (cth: CONVEYOR-1)"
            value={conveyorInput}
            maxLength={60}
            onChange={e => { setConveyorInput(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isSaving}
          />
          <button
            className="conveyor-add-btn"
            onClick={handleAdd}
            disabled={isLoading || isSaving || !conveyorInput.trim()}
            type="button"
          >
            {isSaving ? '...' : '+ Tambah'}
          </button>
        </div>
        {error && <p className="conveyor-error">⚠️ {error}</p>}
      </div>

      {/* ── Warning belum dipilih ── */}
      {!conveyor && (
        <div className="conveyor-warning">
          ⚠️ Pilih atau tambahkan Conveyor sebelum mengisi checklist.
        </div>
      )}

      <style jsx>{`
        .conveyor-section {
          background: linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%);
          border: 1px solid #e2e8f0;
          border-left: 4px solid #f59e0b;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .conveyor-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }

        .conveyor-icon { font-size: 18px; }

        .conveyor-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          flex: 1;
        }

        .conveyor-selected-badge {
          font-size: 12px;
          font-weight: 700;
          background: #d1fae5;
          color: #065f46;
          padding: 3px 10px;
          border-radius: 20px;
          border: 1.5px solid #6ee7b7;
          white-space: nowrap;
        }

        .conveyor-row { margin-bottom: 14px; }

        .conveyor-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 6px;
        }

        .conveyor-select {
          width: 100%;
          padding: 11px 14px;
          border: 2px solid #cbd5e1;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          background: white;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .conveyor-select:focus  { border-color: #f59e0b; }
        .conveyor-select:hover:not(:disabled) { border-color: #94a3b8; background: #f8fafc; }
        .conveyor-select:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }

        .conveyor-loading {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #64748b;
          font-style: italic;
        }

        .conveyor-add-section {
          background: #fffbeb;
          border: 1px dashed #fcd34d;
          border-radius: 10px;
          padding: 12px 14px;
        }

        .conveyor-add-label {
          margin: 0 0 10px;
          font-size: 13px;
          color: #92400e;
          font-weight: 600;
        }

        .conveyor-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .conveyor-input {
          flex: 1;
          min-width: 120px;
          padding: 11px 14px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          background: white;
          outline: none;
          text-transform: uppercase;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .conveyor-input:focus { border-color: #f59e0b; }
        .conveyor-input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }

        .conveyor-add-btn {
          padding: 11px 16px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .conveyor-add-btn:hover:not(:disabled) { background: #d97706; }
        .conveyor-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .conveyor-error {
          margin: 8px 0 0;
          font-size: 12px;
          color: #dc2626;
          font-weight: 500;
        }

        .conveyor-warning {
          margin-top: 12px;
          padding: 8px 12px;
          background: #fef3c7;
          border-radius: 8px;
          font-size: 13px;
          color: #92400e;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .conveyor-section  { padding: 16px; margin-bottom: 16px; }
          .conveyor-inputs   { flex-direction: column; align-items: stretch; }
          .conveyor-add-btn  { text-align: center; }
          .conveyor-input    { font-size: 16px; /* prevent zoom iOS */ }
        }
      `}</style>
    </div>
  );
}