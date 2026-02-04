// components/detailmodal.tsx
import React from "react"

interface CheckItem {
  name: string
  status: "OK" | "NG" | "N/A"
  notes: string
}

interface CheckResult {
  status: "OK" | "NG"
  ngCount: number
  items: CheckItem[]
  notes: string
  submittedAt: string
  submittedBy: string
}

interface ModalData {
  date: number
  checkpoint: {
    checkPoint?: string
    machine?: string
    kind?: string
    size?: string
    frequency?: string
    judge?: string
    shift: string
    waktuCheck?: string
    standard?: string
    method?: string
  }
  result: CheckResult
}

export function DetailModal({ data, onClose }: { data: ModalData; onClose: () => void }) {
  const { checkpoint, result } = data

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        <h3 className="modal-title">Detail Checklist</h3>

        <div className="modal-body">
          <div className="modal-section">
            <h4>Informasi Umum</h4>
            <div className="info-grid">
              <div><strong>Tanggal:</strong> {data.date} Januari</div>
              <div><strong>Shift:</strong> {checkpoint.shift}</div>
              {(checkpoint.checkPoint || checkpoint.machine) && (
                <div><strong>{checkpoint.checkPoint ? "Checkpoint" : "Machine"}:</strong> {checkpoint.checkPoint || checkpoint.machine}</div>
              )}
              {checkpoint.kind && <div><strong>Kind:</strong> {checkpoint.kind}</div>}
              {checkpoint.size && <div><strong>Size:</strong> {checkpoint.size}</div>}
              {checkpoint.waktuCheck && <div><strong>Waktu Check:</strong> {checkpoint.waktuCheck}</div>}
              {checkpoint.frequency && <div><strong>Frekuensi:</strong> {checkpoint.frequency}</div>}
              {checkpoint.standard && <div><strong>Standard:</strong> {checkpoint.standard}</div>}
              <div><strong>Petugas:</strong> {result.submittedBy}</div>
              <div><strong>Waktu Submit:</strong> {new Date(result.submittedAt).toLocaleString("id-ID")}</div>
            </div>
          </div>

          <div className="modal-section">
            <h4>Status: <span className={result.status === "OK" ? "status-ok" : "status-ng"}>{result.status}</span></h4>
            <div><strong>Item NG:</strong> {result.ngCount} dari {result.items.length}</div>
          </div>

          <div className="modal-section">
            <h4>Daftar Pemeriksaan</h4>
            <table className="modal-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>
                      <span className={`status-badge status-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.notes && (
            <div className="modal-section">
              <h4>Catatan Tambahan</h4>
              <p className="notes-text">{result.notes}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          width: 90%;
          max-width: 700px;
          max-height: 85vh;
          overflow-y: auto;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          position: relative;
        }
        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          font-size: 24px;
          background: none;
          border: none;
          cursor: pointer;
          color: #999;
        }
        .modal-title {
          text-align: center;
          padding: 20px 20px 10px;
          margin: 0;
          color: #0d47a1;
          border-bottom: 1px solid #eee;
        }
        .modal-body {
          padding: 20px;
        }
        .modal-section {
          margin-bottom: 20px;
        }
        .modal-section h4 {
          margin: 0 0 12px;
          color: #1e88e5;
          font-size: 1.1rem;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
        }
        .info-grid div {
          padding: 6px 0;
        }
        .modal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .modal-table th,
        .modal-table td {
          padding: 8px;
          border: 1px solid #eee;
          text-align: left;
        }
        .modal-table th {
          background: #f5f9ff;
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-ok { background: #4caf50; color: white; }
        .status-ng { background: #f44336; color: white; }
        .status-na { background: #9e9e9e; color: white; }
        .notes-text {
          background: #f9f9f9;
          padding: 12px;
          border-radius: 6px;
          white-space: pre-wrap;
        }
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
          text-align: right;
        }
        .btn {
          padding: 8px 20px;
          background: #1e88e5;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn:hover {
          background: #1976d2;
        }
      `}</style>
    </div>
  )
}