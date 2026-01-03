-- Animation Production Tracker Database Schema
-- PostgreSQL Schema for Google Cloud SQL

-- Production Summary Table
CREATE TABLE IF NOT EXISTS production_summary (
    id SERIAL PRIMARY KEY,
    animator VARCHAR(100) NOT NULL,
    project_type VARCHAR(20) NOT NULL CHECK (project_type IN ('long-form', 'short-form')),
    episode_title VARCHAR(255) NOT NULL,
    scene VARCHAR(50) NOT NULL,
    shot VARCHAR(50) NOT NULL,
    week_yyyymmdd VARCHAR(8) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('submitted', 'approved', 'revision')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_to_local BOOLEAN DEFAULT FALSE,
    -- Old constraint: UNIQUE(animator, project_type, episode_title, scene, shot, week_yyyymmdd)
    -- New constraint: Prevent duplicates based on project content only (no animator/week duplicates)
    UNIQUE(project_type, episode_title, scene, shot)
);

-- Sync Log Table for tracking sync operations
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('cloud_to_local', 'local_to_cloud')),
    record_id INTEGER,
    action VARCHAR(20) NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    excel_row_data JSONB, -- Store the Excel row data for debugging
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_production_summary_week ON production_summary(week_yyyymmdd);
CREATE INDEX IF NOT EXISTS idx_production_summary_animator ON production_summary(animator);
CREATE INDEX IF NOT EXISTS idx_production_summary_sync ON production_summary(synced_to_local);
CREATE INDEX IF NOT EXISTS idx_production_summary_updated ON production_summary(updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status, created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_production_summary_updated_at
    BEFORE UPDATE ON production_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial test data (optional)
-- This can be commented out for production
INSERT INTO production_summary (animator, project_type, episode_title, scene, shot, week_yyyymmdd, status, notes)
VALUES 
    ('Abhishek A.', 'long-form', 'Episode_01', 'sc_01', 'sh_01', '20241201', 'submitted', 'Initial test entry'),
    ('Kiran Kilaga', 'short-form', '02_Morning_Coffee', 'sc_02', 'sh_03', '20241208', 'approved', 'Test short form entry')
ON CONFLICT (animator, project_type, episode_title, scene, shot, week_yyyymmdd) DO NOTHING;