-- Tabel users untuk PostgreSQL
CREATE TABLE users (
  id VARCHAR(100) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  nik VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buat database baru
CREATE DATABASE procedure_management;

-- Connect ke database
\c procedure_management

-- Buat tabel procedure_documents
CREATE TABLE procedure_documents (
    id SERIAL PRIMARY KEY,
    nama_dokumen VARCHAR(500) NOT NULL,
    nomor_dokumen VARCHAR(100) UNIQUE NOT NULL,
    level_dokumen VARCHAR(50) NOT NULL,
    tanggal_selesai_approval VARCHAR(50) NOT NULL,
    revisi VARCHAR(20) NOT NULL,
    owner VARCHAR(200) NOT NULL,
    pic VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT '-',
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buat index untuk performa
CREATE INDEX idx_pic ON procedure_documents(pic);
CREATE INDEX idx_nomor_dokumen ON procedure_documents(nomor_dokumen);
CREATE INDEX idx_status ON procedure_documents(status);

-- Buat tabel document_reviews
CREATE TABLE document_reviews (
    id SERIAL PRIMARY KEY,
    nomor_dokumen VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    revisi VARCHAR(20) NOT NULL,
    last_reviewed_month INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(nomor_dokumen, last_reviewed_month)
);

-- Buat index untuk document_reviews
CREATE INDEX idx_review_nomor ON document_reviews(nomor_dokumen);
CREATE INDEX idx_review_month ON document_reviews(last_reviewed_month);

-- Buat function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Buat trigger untuk procedure_documents
CREATE TRIGGER update_procedure_documents_updated_at 
    BEFORE UPDATE ON procedure_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Buat trigger untuk document_reviews
CREATE TRIGGER update_document_reviews_updated_at 
    BEFORE UPDATE ON document_reviews 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verifikasi tabel sudah dibuat
\dt

-- Lihat struktur tabel
\d procedure_documents
\d document_reviews

CREATE TABLE IF NOT EXISTS checklist_areas (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES checklist_categories(id) ON DELETE CASCADE,
    area_name VARCHAR(100) NOT NULL,
    area_code VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_category_area UNIQUE (category_id, area_code)
);

-- Index untuk performa query
CREATE INDEX idx_areas_category ON checklist_areas(category_id);
CREATE INDEX idx_areas_code ON checklist_areas(area_code);

-- checklist_items: link item ke area
ALTER TABLE checklist_items 
ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES checklist_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_items_area ON checklist_items(area_id);

-- checklist_results: filter hasil berdasarkan area (opsional tapi direkomendasikan)
ALTER TABLE checklist_results 
ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES checklist_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_results_area ON checklist_results(area_id);

-- Sesuaikan category_id dengan data Anda (cek: SELECT id, category_code FROM checklist_categories;)

-- ✅ Final Assy - Group Leader (final-assy-gl)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-gl'), 'Line A - Final Assembly', 'final-assy-gl-line-a', 'Area produksi Line A', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-gl'), 'Line B - Final Assembly', 'final-assy-gl-line-b', 'Area produksi Line B', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-gl'), 'Rework Station', 'final-assy-gl-rework', 'Area perbaikan & rework', 3),
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-gl'), 'Packing Area', 'final-assy-gl-packing', 'Area packing & shipping', 4)
ON CONFLICT (category_id, area_code) DO NOTHING;

-- ✅ Final Assy - Inspector (final-assy-inspector)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-inspector'), 'Checker Station', 'final-assy-insp-checker', 'Station pemeriksaan Checker', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-inspector'), 'Visual 1 Station', 'final-assy-insp-visual1', 'Station inspeksi Visual 1', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-inspector'), 'Visual 2 Station', 'final-assy-insp-visual2', 'Station inspeksi Visual 2', 3),
((SELECT id FROM checklist_categories WHERE category_code = 'final-assy-inspector'), 'Double Check / RI', 'final-assy-insp-ri', 'Station Receiving Inspection', 4)
ON CONFLICT (category_id, area_code) DO NOTHING;

-- ✅ Pre Assy - Daily GL (pre-assy-daily-gl)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-gl'), 'Crimping Area', 'pre-assy-gl-crimping', 'Area proses crimping terminal', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-gl'), 'Taping Area', 'pre-assy-gl-taping', 'Area proses taping harness', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-gl'), 'Sub-Assy Line 1', 'pre-assy-gl-sub1', 'Line sub-assembly 1', 3),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-gl'), 'Material Store', 'pre-assy-gl-store', 'Area penyimpanan material', 4)
ON CONFLICT (category_id, area_code) DO NOTHING;

-- ✅ Pre Assy - CC & Stripping (pre-assy-cc-stripping-gl)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-cc-stripping-gl'), 'CC Machine Zone', 'pre-assy-cc-zone', 'Area mesin CC & stripping', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-cc-stripping-gl'), 'Terminal Processing', 'pre-assy-cc-terminal', 'Area proses terminal', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-cc-stripping-gl'), 'Wire Cutting', 'pre-assy-cc-cutting', 'Area pemotongan wire', 3)
ON CONFLICT (category_id, area_code) DO NOTHING;

-- ✅ Pre Assy - Daily Check Ins (pre-assy-daily-check-ins)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-check-ins'), 'Tensile Test Lab', 'pre-assy-ins-tensile', 'Laboratorium uji tensile', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-check-ins'), 'Cross Section Lab', 'pre-assy-ins-cross', 'Laboratorium cross section', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-check-ins'), 'Cutting Station', 'pre-assy-ins-cutting', 'Station pemotongan sample', 3),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-daily-check-ins'), 'PA General Area', 'pre-assy-ins-pa', 'Area umum Pre-Assy', 4)
ON CONFLICT (category_id, area_code) DO NOTHING;

-- ✅ Pre Assy - CS Remove Tool (pre-assy-cs-remove-tool)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-cs-remove-tool'), 'Tool Crib', 'pre-assy-tool-crib', 'Penyimpanan tool & gauge', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-cs-remove-tool'), 'Maintenance Workshop', 'pre-assy-tool-maint', 'Workshop maintenance tool', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-cs-remove-tool'), 'Production Floor', 'pre-assy-tool-prod', 'Lantai produksi', 3)
ON CONFLICT (category_id, area_code) DO NOTHING;

-- ✅ Pre Assy - Pressure Jig (pre-assy-pressure-jig)
INSERT INTO checklist_areas (category_id, area_name, area_code, description, sort_order) VALUES
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-pressure-jig'), 'Jig Storage', 'pre-assy-jig-storage', 'Penyimpanan pressure jig', 1),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-pressure-jig'), 'Calibration Zone', 'pre-assy-jig-calib', 'Area kalibrasi jig', 2),
((SELECT id FROM checklist_categories WHERE category_code = 'pre-assy-pressure-jig'), 'Line Setup Area', 'pre-assy-jig-setup', 'Area setup jig di line', 3)
ON CONFLICT (category_id, area_code) DO NOTHING;

