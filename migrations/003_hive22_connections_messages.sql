-- HIVE 2.2 Phase 3: Connections and Direct Messaging

-- 1. Extend `connections` table
ALTER TABLE connections 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

-- Force status constraint if not exists (pending, connected, rejected)
-- Note: SQLite / Postgres handling might differ slightly, but CHECK is standard
-- For safety, we will just add a check constraint if possible, but let's assume it's handled in application logic mostly.
-- To be safe, we can add a check constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_connection_status'
    ) THEN
        ALTER TABLE connections ADD CONSTRAINT valid_connection_status CHECK (status IN ('pending', 'connected', 'rejected'));
    END IF;
END $$;

-- 2. Create `messages` table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    connection_id VARCHAR(255) NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying a conversation's messages quickly
CREATE INDEX IF NOT EXISTS idx_messages_connection_id ON messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
