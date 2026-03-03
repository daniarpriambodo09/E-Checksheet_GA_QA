-- Migration: Add Carline and Line support to checksheet-final-assy
-- This migration adds carline and line fields to track production lines and car models

-- 1. Add carline and line columns to checklist_results table
ALTER TABLE checklist_results 
ADD COLUMN IF NOT EXISTS carline VARCHAR(100),
ADD COLUMN IF NOT EXISTS line VARCHAR(100);

-- Create indexes for faster queries on carline and line
CREATE INDEX IF NOT EXISTS idx_results_carline ON checklist_results(carline);
CREATE INDEX IF NOT EXISTS idx_results_line ON checklist_results(line);
CREATE INDEX IF NOT EXISTS idx_results_carline_line ON checklist_results(carline, line);

-- 2. Create carline_line_mapping table to store user's history
CREATE TABLE IF NOT EXISTS carline_line_mapping (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    carline VARCHAR(100) NOT NULL,
    line VARCHAR(100) NOT NULL,
    category_code VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, carline, line, category_code)
);

-- Create indexes for carline_line_mapping
CREATE INDEX IF NOT EXISTS idx_mapping_user ON carline_line_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_mapping_category ON carline_line_mapping(category_code);
CREATE INDEX IF NOT EXISTS idx_mapping_active ON carline_line_mapping(user_id, category_code, is_active);
CREATE INDEX IF NOT EXISTS idx_mapping_carline ON carline_line_mapping(carline);
CREATE INDEX IF NOT EXISTS idx_mapping_line ON carline_line_mapping(line);

-- 3. Add trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_carline_line_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_carline_line_mapping_updated_at ON carline_line_mapping;

CREATE TRIGGER update_carline_line_mapping_updated_at
    BEFORE UPDATE ON carline_line_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_carline_line_mapping_updated_at();

-- 4. Add indexes for composite searches (user + category for quick lookups)
CREATE INDEX IF NOT EXISTS idx_mapping_user_category_active 
ON carline_line_mapping(user_id, category_code, is_active);
