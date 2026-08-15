-- HIVE 2.2 Phase 1: User Profiles and Reviews/Ratings

-- 1. Extend `users` table with profile fields
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(100),
    ADD COLUMN IF NOT EXISTS location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS availability_summary TEXT,
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS teaching_hours INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS learning_hours INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sessions_completed INTEGER DEFAULT 0;

-- 2. Create `reviews` table
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    reviewer_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    teaching_rating INTEGER CHECK (teaching_rating >= 1 AND teaching_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    helpfulness_rating INTEGER CHECK (helpfulness_rating >= 1 AND helpfulness_rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_review UNIQUE(session_id, reviewer_id, reviewee_id)
);

-- Index for querying a user's reviews quickly
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
