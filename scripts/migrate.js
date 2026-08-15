require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dataPath = path.join(__dirname, '../data/hive-data.json');
const exceptionsPath = path.join(__dirname, '../migration-exceptions.json');

async function migrate() {
    console.log("Starting PostgreSQL Migration...");
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
    } catch(e) {
        console.error("CRITICAL ERROR: Could not connect to PostgreSQL.", e.message);
        console.error("Please ensure PostgreSQL is running and DATABASE_URL is set in .env.");
        process.exit(1);
    }

    try {
        await client.query('BEGIN');

        console.log("Creating tables...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                seu INTEGER NOT NULL DEFAULT 0,
                rating NUMERIC NOT NULL DEFAULT 0,
                status VARCHAR(50) NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS skills (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                level VARCHAR(50) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                tutor_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL,
                seu INTEGER NOT NULL DEFAULT 0,
                time VARCHAR(255) NOT NULL,
                topic VARCHAR(255) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS session_participants (
                session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (session_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS connections (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                target_user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, target_user_id)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                kind VARCHAR(50) NOT NULL,
                read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
            CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
            CREATE INDEX IF NOT EXISTS idx_skills_name_type ON skills(name, type);
            CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
            CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
            CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
        `);

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        let counts = {
            users: 0, skills: 0, sessions: 0, participants: 0, 
            connections: 0, notifications: 0, auth_sessions: 0
        };

        const exceptions = [];
        const userIds = new Set();
        const userNames = new Map();

        console.log("Migrating Users...");
        for (const u of data.users || []) {
            if (!u.id || !u.email) continue;
            
            await client.query(`
                INSERT INTO users (id, first_name, last_name, email, password, role, seu, rating, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            `, [
                u.id, 
                u.firstName || (u.name ? u.name.split(' ')[0] : 'User'), 
                u.lastName || (u.name && u.name.split(' ').length > 1 ? u.name.split(' ').slice(1).join(' ') : ''), 
                u.email, u.password, u.role || 'learner', u.seu || 0, u.rating || 0, u.status || 'active'
            ]);
            userIds.add(u.id);
            if(u.name) userNames.set(u.name.trim().toLowerCase(), u.id);
            if(u.firstName && u.lastName) userNames.set(`${u.firstName} ${u.lastName}`.trim().toLowerCase(), u.id);
            counts.users++;

            for (const s of u.skills || []) {
                if(!s.id || !s.name) continue;
                await client.query(`
                    INSERT INTO skills (id, user_id, name, type, level)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO NOTHING
                `, [s.id, u.id, s.name, s.type, s.level]);
                counts.skills++;
            }
        }

        console.log("Migrating Sessions...");
        for (const s of data.sessions || []) {
            let tutorId = s.tutorId;
            if (!tutorId && s.tutor) {
                const nameKey = String(s.tutor).trim().toLowerCase();
                if (userNames.has(nameKey)) tutorId = userNames.get(nameKey);
            }

            if (!tutorId || !userIds.has(tutorId)) {
                exceptions.push({
                    type: 'Session',
                    id: s.id,
                    original: s,
                    reason: `Tutor user not found. Tutor string: "${s.tutor}", mapped ID: ${tutorId}`
                });
                continue;
            }

            await client.query(`
                INSERT INTO sessions (id, title, tutor_id, status, seu, time, topic)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [s.id, s.title, tutorId, s.status, s.seu || 0, s.time, s.topic]);
            counts.sessions++;

            for (const attendeeId of s.attendees || []) {
                if (!userIds.has(attendeeId)) continue;
                await client.query(`
                    INSERT INTO session_participants (session_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (session_id, user_id) DO NOTHING
                `, [s.id, attendeeId]);
                counts.participants++;
            }
        }

        console.log("Migrating Connections...");
        for (const c of data.connections || []) {
            if (!userIds.has(c.userId) || !userIds.has(c.matchId)) {
                exceptions.push({
                    type: 'Connection',
                    id: c.id,
                    original: c,
                    reason: `User or target match user not found: userId=${c.userId}, matchId=${c.matchId}`
                });
                continue;
            }
            await client.query(`
                INSERT INTO connections (id, user_id, target_user_id, status, created_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [c.id, c.userId, c.matchId, c.status, new Date(c.createdAt || Date.now())]);
            counts.connections++;
        }

        console.log("Migrating Notifications...");
        for (const n of data.notifications || []) {
            if (!userIds.has(n.userId)) continue;
            await client.query(`
                INSERT INTO notifications (id, user_id, title, message, kind, read, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [n.id, n.userId, n.title, n.message, n.kind, n.read || false, new Date(n.createdAt || Date.now())]);
            counts.notifications++;
        }

        console.log("Migrating Auth Sessions...");
        for (const a of data.authSessions || []) {
            if (!userIds.has(a.userId)) continue;
            await client.query(`
                INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (token_hash) DO NOTHING
            `, [a.tokenHash, a.userId, new Date(a.createdAt), new Date(a.expiresAt)]);
            counts.auth_sessions++;
        }

        fs.writeFileSync(exceptionsPath, JSON.stringify(exceptions, null, 2));

        await client.query('COMMIT');
        console.log("Migration successful!");
        console.log("Before / After Counts (Migrated):", counts);
        console.log(`Exceptions saved to ${exceptionsPath} (Count: ${exceptions.length})`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Migration failed. Rolled back.", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
