'use client';

import { useState } from 'react';

interface CarlineLineSectionProps {
  carline: string;
  setCarline: (value: string) => void;
  line: string;
  setLine: (value: string) => void;
  history: Array<{ carline: string; line: string }>;
}

export default function CarlineLineSection({
  carline,
  setCarline,
  line,
  setLine,
  history,
}: CarlineLineSectionProps) {
  const [showCarlineDropdown, setShowCarlineDropdown] = useState(false);
  const [showLineDropdown, setShowLineDropdown] = useState(false);

  // Get unique carlines and corresponding lines
  const uniqueCarlines = Array.from(new Set(history.map(h => h.carline))).sort();
  const linesForCarline = carline
    ? Array.from(new Set(history.filter(h => h.carline === carline).map(h => h.line))).sort()
    : [];

  const handleCarlineSelect = (selectedCarline: string) => {
    setCarline(selectedCarline);
    setShowCarlineDropdown(false);
    // Auto-select first available line if exists
    const availableLines = history.filter(h => h.carline === selectedCarline);
    if (availableLines.length > 0 && !line) {
      setLine(availableLines[0].line);
    }
  };

  const handleLineSelect = (selectedLine: string) => {
    setLine(selectedLine);
    setShowLineDropdown(false);
  };

  const filteredCarlines = carline === '' ? uniqueCarlines : uniqueCarlines.filter(c => c.toLowerCase().includes(carline.toLowerCase()));
  const filteredLines = line === '' ? linesForCarline : linesForCarline.filter(l => l.toLowerCase().includes(line.toLowerCase()));

  return (
    <div className="carline-line-section">
      <h3 className="section-title">🏭 Carline & Line Information</h3>
      
      <div className="carline-line-grid">
        {/* Carline Field */}
        <div className="form-group-enhanced">
          <label className="form-label-enhanced">
            Carline
            <span className="required-badge">*</span>
          </label>
          <div className="input-wrapper">
            <div className="input-container">
              <input
                type="text"
                value={carline}
                onChange={(e) => {
                  setCarline(e.target.value);
                  setShowCarlineDropdown(true);
                }}
                onFocus={() => setShowCarlineDropdown(true)}
                placeholder="Masukkan atau pilih Carline"
                className="text-input"
                autoComplete="off"
              />
              {carline && (
                <button
                  className="clear-button"
                  onClick={() => setCarline('')}
                  type="button"
                  aria-label="Clear carline"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Carline Dropdown */}
            {showCarlineDropdown && uniqueCarlines.length > 0 && (
              <div className="dropdown-menu">
                {filteredCarlines.length > 0 ? (
                  filteredCarlines.map((c) => (
                    <button
                      key={c}
                      className={`dropdown-option ${carline === c ? 'selected' : ''}`}
                      onClick={() => handleCarlineSelect(c)}
                      type="button"
                    >
                      {c}
                    </button>
                  ))
                ) : (
                  <div className="dropdown-empty">Tidak ada hasil</div>
                )}
              </div>
            )}
          </div>
          <p className="helper-text">
            {uniqueCarlines.length > 0 && carline === ''
              ? `${uniqueCarlines.length} carline tersedia`
              : carline && !uniqueCarlines.includes(carline)
              ? 'Carline baru akan ditambahkan'
              : ''}
          </p>
        </div>

        {/* Line Field */}
        <div className="form-group-enhanced">
          <label className="form-label-enhanced">
            Line
            <span className="required-badge">*</span>
          </label>
          <div className="input-wrapper">
            <div className="input-container">
              <input
                type="text"
                value={line}
                onChange={(e) => {
                  setLine(e.target.value);
                  setShowLineDropdown(true);
                }}
                onFocus={() => setShowLineDropdown(true)}
                placeholder="Masukkan atau pilih Line"
                className="text-input"
                autoComplete="off"
                disabled={!carline}
              />
              {line && (
                <button
                  className="clear-button"
                  onClick={() => setLine('')}
                  type="button"
                  aria-label="Clear line"
                  disabled={!carline}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Line Dropdown */}
            {showLineDropdown && carline && linesForCarline.length > 0 && (
              <div className="dropdown-menu">
                {filteredLines.length > 0 ? (
                  filteredLines.map((l) => (
                    <button
                      key={l}
                      className={`dropdown-option ${line === l ? 'selected' : ''}`}
                      onClick={() => handleLineSelect(l)}
                      type="button"
                    >
                      {l}
                    </button>
                  ))
                ) : (
                  <div className="dropdown-empty">Tidak ada hasil</div>
                )}
              </div>
            )}
          </div>
          <p className="helper-text">
            {!carline
              ? 'Pilih Carline terlebih dahulu'
              : linesForCarline.length > 0 && line === ''
              ? `${linesForCarline.length} line tersedia`
              : line && !linesForCarline.includes(line)
              ? 'Line baru akan ditambahkan'
              : ''}
          </p>
        </div>
      </div>

      <style jsx>{`
        .carline-line-section {
          background: linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .section-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .carline-line-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group-enhanced {
          position: relative;
        }

        .form-label-enhanced {
          display: block;
          font-weight: 600;
          color: #334155;
          margin-bottom: 8px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .required-badge {
          color: #ef4444;
          font-weight: 700;
        }

        .input-wrapper {
          position: relative;
        }

        .input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .text-input {
          width: 100%;
          padding: 11px 40px 11px 14px;
          border: 2px solid #cbd5e1;
          border-radius: 10px;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s ease;
          background: white;
          box-sizing: border-box;
        }

        .text-input:hover:not(:disabled) {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .text-input:focus {
          outline: none;
          border-color: #1e88e5;
          background: white;
          box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.1);
        }

        .text-input:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .clear-button {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .clear-button:hover:not(:disabled) {
          color: #64748b;
        }

        .clear-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-top: none;
          border-radius: 0 0 10px 10px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .dropdown-option {
          width: 100%;
          padding: 12px 14px;
          background: white;
          border: none;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          color: #475569;
          transition: all 0.15s ease;
          font-weight: 500;
        }

        .dropdown-option:hover {
          background: #f1f5f9;
          color: #1e88e5;
        }

        .dropdown-option.selected {
          background: #eff6ff;
          color: #1e88e5;
          font-weight: 600;
        }

        .dropdown-empty {
          padding: 12px 14px;
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
        }

        .helper-text {
          margin: 6px 0 0 0;
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .carline-line-section {
            padding: 16px;
            margin-bottom: 16px;
          }

          .carline-line-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .text-input {
            padding: 10px 36px 10px 12px;
            font-size: 16px; /* Prevent zoom on iOS */
          }

          .section-title {
            font-size: 15px;
          }

          .dropdown-menu {
            max-height: 180px;
          }
        }
      `}</style>
    </div>
  );
}
