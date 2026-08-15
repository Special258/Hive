-- Migration: 002_hive22_availability_matching.sql
-- Description: Adds user availability scheduling and skill relationships

BEGIN;

CREATE TABLE IF NOT EXISTS user_availability (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun, 1=Mon, ..., 6=Sat
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(100) NOT NULL, -- IANA timezone identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);

CREATE TABLE IF NOT EXISTS skill_relationships (
    id SERIAL PRIMARY KEY,
    source_skill VARCHAR(100) NOT NULL,
    related_skill VARCHAR(100) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL, -- 'alias', 'subset', 'related'
    weight NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (weight > 0 AND weight <= 1.00),
    UNIQUE(source_skill, related_skill)
);

-- Seed initial skill relationships
INSERT INTO skill_relationships (source_skill, related_skill, relationship_type, weight) VALUES
('javascript', 'react', 'subset', 0.80),
('javascript', 'next.js', 'subset', 0.70),
('javascript', 'typescript', 'related', 0.90),
('react', 'next.js', 'related', 0.85),
('python', 'django', 'subset', 0.80),
('python', 'fastapi', 'subset', 0.80),
('python', 'flask', 'subset', 0.70),
('html', 'css', 'related', 0.80),
('node.js', 'express', 'subset', 0.90),
('node.js', 'javascript', 'subset', 0.90),
('java', 'spring boot', 'subset', 0.80)
ON CONFLICT DO NOTHING;

COMMIT;
