// components/ChecksheetComponents/ConveyorSection.tsx
// Mendukung kedua tipe checklist: "Daily Check – Inspector Final Assy" dan "Daily Check – Group Leader Final Assy".
// Gabungan carline + line menjadi satu field "Conveyor", konsisten dengan pre-assy.
// Menerima categoryCode parameter untuk membedakan antara inspector dan GL mode.

'use client';

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';

interface ConveyorSectionProps {
  conveyor: string;
  setConveyor: (value: string) => void;
  areaCode?: string;
  userId?: string;
  categoryCode?: string;
  isLoading?: boolean;
}

export default function ConveyorSection({
  conveyor,
  setConveyor,
  areaCode,
  userId,
  categoryCode = 'final-assy-inspector',
  isLoading = false,
}: ConveyorSectionProps) {
  const [conveyorOptions, setConveyorOptions] = useState<string[]>([]);
  const [conveyorInput, setConveyorInput]     = useState('');
  const [isFetching, setIsFetching]           = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [isDeleting, setIsDeleting]           = useState(false);
  const [isDropdownOpen, setIsDropdownOpen]   = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [deleteError, setDeleteError]         = useState<string | null>(null);

  // ── Fetch daftar conveyor yang sudah ada dari DB ──────────────────
  const fetchOptions = useCallback(async (code: string) => {
    if (!code) return;
    setIsFetching(true);
    try {
      const res  = await fetch(`/api/final-assy/get-carline-line?areaCode=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        // API mengembalikan [{carline, line, conveyor?}]
        // Ambil nilai conveyor: prioritaskan field conveyor, fallback ke carline
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
      console.error('[ConveyorSection] fetch error:', err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!areaCode) return;
    fetchOptions(areaCode);
  }, [areaCode, fetchOptions]);

  // ── Close dropdown when clicking outside ────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.conveyor-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // ── Tambah conveyor baru ──────────────────────────────────────────
  const handleAdd = async () => {
    const cv = conveyorInput.trim().toUpperCase();
    if (!cv) { setError('Nama conveyor harus diisi.'); return; }

    // Sudah ada di list → langsung pilih
    if (conveyorOptions.some(o => o.toUpperCase() === cv)) {
      setConveyor(cv);
      setConveyorInput('');
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/final-assy/save-conveyor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conveyor: cv, areaCode, userId, categoryCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 409 = sudah ada di DB tapi belum di list lokal → tambahkan saja
        if (res.status === 409) {
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

  const handleDelete = async (value: string) => {
    if (!window.confirm(`Hapus conveyor "${value}"?`)) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/final-assy/delete-conveyor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conveyor: value, categoryCode, userId, areaCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus conveyor.');
      }

      setConveyorOptions(prev => prev.filter(item => item !== value));
      if (conveyor === value) {
        setConveyor('');
      }
      if (areaCode) {
        await fetchOptions(areaCode);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus conveyor.');
    } finally {
      setIsDeleting(false);
    }
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

      {/* ── Dropdown pilih conveyor existing ── */}
      {conveyorOptions.length > 0 && (
        <div className="conveyor-row">
          <label className="conveyor-label">Pilih Conveyor</label>
          <div className={`conveyor-dropdown-container ${isDropdownOpen ? 'open' : ''}`}>
            <button
              type="button"
              className="conveyor-dropdown-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isLoading || isFetching}
            >
              <span>{conveyor || "-- Pilih Conveyor --"}</span>
              <span className="conveyor-dropdown-arrow">▼</span>
            </button>

            {isDropdownOpen && (
              <div className="conveyor-dropdown-menu">
                {conveyorOptions.map(cv => (
                  <div
                    key={cv}
                    className={`conveyor-dropdown-item ${conveyor === cv ? 'selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="conveyor-dropdown-item-button"
                      onClick={() => {
                        setConveyor(cv);
                        setIsDropdownOpen(false);
                      }}
                      disabled={isLoading || isFetching || isDeleting}
                    >
                      {cv}
                    </button>
                    <button
                      type="button"
                      className="conveyor-dropdown-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(cv);
                      }}
                      disabled={isLoading || isFetching || isDeleting}
                      aria-label={`Hapus ${cv}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isFetching && (
            <span className="conveyor-loading">Memuat...</span>
          )}
          {deleteError && (
            <p className="conveyor-error">⚠️ {deleteError}</p>
          )}
        </div>
      )}

      {/* ── Input tambah conveyor baru ── */}
      <div className="conveyor-add-section">
        <p className="conveyor-add-label">
          {conveyorOptions.length === 0
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

      {/* ── Warning jika belum dipilih ── */}
      {!conveyor && (
        <div className="conveyor-warning">
          ⚠️ Pilih atau tambahkan Conveyor sebelum mengisi checklist.
        </div>
      )}

      <style jsx>{`
        .conveyor-section {
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          border-left: 4px solid #f59e0b;
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
          font-size: 15px;
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
        }

        .conveyor-row { margin-bottom: 14px; }

        .conveyor-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 6px;
        }

        .conveyor-list-box {
          display: grid;
          gap: 8px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px;
        }

        .conveyor-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: white;
          border: 1px solid transparent;
          transition: border-color 0.15s, background 0.15s;
        }

        .conveyor-item.selected {
          border-color: #f59e0b;
          background: #fffbeb;
        }

        .conveyor-item-button {
          flex: 1;
          text-align: left;
          background: transparent;
          border: none;
          padding: 0;
          color: #1e293b;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .conveyor-item-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .conveyor-delete-btn {
          min-width: 32px;
          height: 32px;
          background: #f8d7da;
          color: #b91c1c;
          border: 1px solid #f5c2c7;
          border-radius: 10px;
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .conveyor-delete-btn:hover:not(:disabled) {
          background: #f5c2c7;
        }
        .conveyor-delete-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

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
          padding: 9px 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          background: white;
          outline: none;
          text-transform: uppercase;
          transition: border-color 0.15s;
        }
        .conveyor-input:focus { border-color: #f59e0b; }
        .conveyor-input:disabled { opacity: 0.6; cursor: not-allowed; }

        .conveyor-add-btn {
          padding: 9px 16px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 8px;
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
          margin-top: 10px;
          padding: 8px 12px;
          background: #fef3c7;
          border-radius: 8px;
          font-size: 13px;
          color: #92400e;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .conveyor-section { padding: 14px 16px; }
          .conveyor-inputs { flex-direction: column; align-items: stretch; }
          .conveyor-add-btn { width: 100%; text-align: center; }
        }

        /* ── Custom Dropdown Styles ── */
        .conveyor-dropdown-container {
          position: relative;
          width: 100%;
        }

        .conveyor-dropdown-trigger {
          width: 100%;
          padding: 9px 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background-color: white;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
          text-transform: uppercase;
        }

        .conveyor-dropdown-trigger:hover {
          border-color: #cbd5e1;
        }

        .conveyor-dropdown-trigger:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .conveyor-dropdown-trigger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .conveyor-dropdown-arrow {
          font-size: 12px;
          color: #64748b;
          transition: transform 0.15s ease-in-out;
        }

        .conveyor-dropdown-container.open .conveyor-dropdown-arrow {
          transform: rotate(180deg);
        }

        .conveyor-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 10;
          margin-top: 4px;
          background-color: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          max-height: 200px;
          overflow-y: auto;
        }

        .conveyor-dropdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
          border-bottom: 1px solid #f1f5f9;
        }

        .conveyor-dropdown-item:last-child {
          border-bottom: none;
        }

        .conveyor-dropdown-item:hover {
          background-color: #f8fafc;
        }

        .conveyor-dropdown-item.selected {
          background-color: #fef3c7;
          color: #92400e;
        }

        .conveyor-dropdown-item-button {
          flex: 1;
          background: none;
          border: none;
          padding: 0;
          font-size: 14px;
          font-weight: 600;
          color: inherit;
          cursor: pointer;
          text-align: left;
          text-transform: uppercase;
        }

        .conveyor-dropdown-item-button:disabled {
          cursor: not-allowed;
        }

        .conveyor-dropdown-delete-btn {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 16px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
          margin-left: 8px;
        }

        .conveyor-dropdown-delete-btn:hover {
          background-color: #fef2f2;
        }

        .conveyor-dropdown-delete-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};