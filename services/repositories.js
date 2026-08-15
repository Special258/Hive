const db = require('./db');

class UserRepository {
    async findById(id) {
        const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        return res.rows[0];
    }
    
    async findByEmail(email) {
        const res = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        return res.rows[0];
    }

    async findAll() {
        const res = await db.query('SELECT * FROM users');
        return res.rows;
    }

    async create(user) {
        await db.query(
            `INSERT INTO users (id, first_name, last_name, email, password, role, seu, rating, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [user.id, user.first_name, user.last_name, user.email, user.password, user.role, user.seu, user.rating, user.status]
        );
        return user;
    }

    async updateStatus(id, status) {
        await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    }
    
    async updatePassword(id, password) {
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [password, id]);
    }

    async updateProfile(id, profile) {
        await db.query(
            `UPDATE users SET 
                avatar_url = $1, 
                bio = $2, 
                timezone = $3, 
                location = $4, 
                availability_summary = $5 
            WHERE id = $6`,
            [profile.avatar_url, profile.bio, profile.timezone, profile.location, profile.availability_summary, id]
        );
    }

    async updateStats(id, stats) {
        await db.query(
            `UPDATE users SET 
                review_count = $1, 
                rating = $2,
                teaching_hours = $3,
                learning_hours = $4,
                sessions_completed = $5
            WHERE id = $6`,
            [stats.review_count, stats.rating, stats.teaching_hours, stats.learning_hours, stats.sessions_completed, id]
        );
    }
}

class SkillRepository {
    async findByUserId(userId) {
        const res = await db.query('SELECT * FROM skills WHERE user_id = $1', [userId]);
        return res.rows;
    }

    async create(skill) {
        await db.query(
            'INSERT INTO skills (id, user_id, name, type, level) VALUES ($1, $2, $3, $4, $5)',
            [skill.id, skill.user_id, skill.name, skill.type, skill.level]
        );
        return skill;
    }

    async updateLevel(id, userId, level) {
        await db.query('UPDATE skills SET level = $1 WHERE id = $2 AND user_id = $3', [level, id, userId]);
    }

    async delete(id, userId) {
        const res = await db.query('DELETE FROM skills WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
        return res.rowCount > 0;
    }
    
    async findByIdAndUserId(id, userId) {
        const res = await db.query('SELECT * FROM skills WHERE id = $1 AND user_id = $2', [id, userId]);
        return res.rows[0];
    }
}

class SessionRepository {
    async findAll() {
        // Need to join to get tutor name for legacy frontend support
        const res = await db.query(`
            SELECT s.*, u.first_name || ' ' || u.last_name as tutor_name
            FROM sessions s
            JOIN users u ON s.tutor_id = u.id
            ORDER BY s.id DESC
        `);
        return res.rows;
    }

    async findById(id) {
        const res = await db.query(`
            SELECT s.*, u.first_name || ' ' || u.last_name as tutor_name
            FROM sessions s
            JOIN users u ON s.tutor_id = u.id
            WHERE s.id = $1
        `, [id]);
        return res.rows[0];
    }

    async create(session) {
        await db.query(
            `INSERT INTO sessions (id, title, tutor_id, status, seu, time, topic) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [session.id, session.title, session.tutor_id, session.status, session.seu, session.time, session.topic]
        );
        return session;
    }

    async getAttendees(sessionId) {
        const res = await db.query('SELECT user_id FROM session_participants WHERE session_id = $1', [sessionId]);
        return res.rows.map(r => r.user_id);
    }

    async addAttendee(sessionId, userId) {
        await db.query('INSERT INTO session_participants (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sessionId, userId]);
    }

    async removeAttendee(sessionId, userId) {
        await db.query('DELETE FROM session_participants WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
    }
}

class ConnectionRepository {
    async findById(id) {
        const res = await db.query('SELECT * FROM connections WHERE id = $1', [id]);
        return res.rows[0];
    }

    async findByUserId(userId) {
        const res = await db.query('SELECT * FROM connections WHERE user_id = $1 OR target_user_id = $2', [userId, userId]);
        return res.rows;
    }

    async findExisting(userId, targetUserId) {
        const res = await db.query('SELECT * FROM connections WHERE (user_id = $1 AND target_user_id = $2) OR (user_id = $2 AND target_user_id = $1)', [userId, targetUserId]);
        return res.rows[0];
    }

    async create(conn) {
        if (conn.user_id === conn.target_user_id) throw new Error("Self-connection not allowed");
        const existing = await this.findExisting(conn.user_id, conn.target_user_id);
        if (existing) throw new Error("Connection already exists");
        await db.query(
            'INSERT INTO connections (id, user_id, target_user_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)',
            [conn.id, conn.user_id, conn.target_user_id, conn.status, conn.created_at]
        );
        return conn;
    }

    async updateStatus(id, status) {
        if (status === 'connected') {
            await db.query("UPDATE connections SET status = $1, updated_at = CURRENT_TIMESTAMP, accepted_at = CURRENT_TIMESTAMP WHERE id = $2", [status, id]);
        } else {
            await db.query("UPDATE connections SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, id]);
        }
    }
    
    async delete(id) {
        await db.query('DELETE FROM connections WHERE id = $1', [id]);
    }
}

class NotificationRepository {
    async findByUserId(userId, limit = 20) {
        const res = await db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
        return res.rows;
    }

    async create(notif) {
        await db.query(
            'INSERT INTO notifications (id, user_id, title, message, kind, read, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [notif.id, notif.user_id, notif.title, notif.message, notif.kind, notif.read, notif.created_at]
        );
        return notif;
    }

    async markRead(id, userId) {
        const res = await db.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        return res.rows[0];
    }
}

class AuthSessionRepository {
    async create(authSession) {
        await db.query(
            'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
            [authSession.token_hash, authSession.user_id, authSession.created_at, authSession.expires_at]
        );
    }

    async findByTokenHash(tokenHash) {
        const res = await db.query('SELECT * FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
        return res.rows[0];
    }

    async deleteByTokenHash(tokenHash) {
        await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
    }
}

class ReviewRepository {
    async create(review) {
        await db.query(
            `INSERT INTO reviews (
                id, session_id, reviewer_id, reviewee_id, overall_rating, 
                teaching_rating, communication_rating, helpfulness_rating, comment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                review.id, review.session_id, review.reviewer_id, review.reviewee_id, 
                review.overall_rating, review.teaching_rating, review.communication_rating, 
                review.helpfulness_rating, review.comment
            ]
        );
        return review;
    }

    async findByRevieweeId(revieweeId) {
        const res = await db.query(
            `SELECT r.*, u.first_name || ' ' || u.last_name as reviewer_name, u.avatar_url as reviewer_avatar
             FROM reviews r
             JOIN users u ON r.reviewer_id = u.id
             WHERE r.reviewee_id = $1
             ORDER BY r.created_at DESC`,
            [revieweeId]
        );
        return res.rows;
    }

    async getAverageRating(revieweeId) {
        const res = await db.query(
            `SELECT COUNT(id) as count, AVG(overall_rating) as avg_rating 
             FROM reviews WHERE reviewee_id = $1`,
            [revieweeId]
        );
        return {
            count: parseInt(res.rows[0].count) || 0,
            rating: parseFloat(res.rows[0].avg_rating) || 0
        };
    }
    
    async checkDuplicate(sessionId, reviewerId, revieweeId) {
        const res = await db.query(
            'SELECT id FROM reviews WHERE session_id = $1 AND reviewer_id = $2 AND reviewee_id = $3',
            [sessionId, reviewerId, revieweeId]
        );
        return res.rows.length > 0;
    }
}

class AvailabilityRepository {
    async findByUserId(userId) {
        const res = await db.query('SELECT * FROM user_availability WHERE user_id = $1', [userId]);
        return res.rows;
    }
    async create(av) {
        await db.query('INSERT INTO user_availability (id, user_id, day_of_week, start_time, end_time, timezone, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [av.id, av.user_id, av.day_of_week, av.start_time, av.end_time, av.timezone, av.created_at, av.updated_at]);
        return av;
    }
    async delete(id, userId) {
        const res = await db.query('DELETE FROM user_availability WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
        return res.rowCount > 0;
    }
    async findAll() {
        const res = await db.query('SELECT * FROM user_availability');
        return res.rows;
    }
}

class SkillRelationshipRepository {
    async findAll() {
        const res = await db.query('SELECT * FROM skill_relationships');
        return res.rows;
    }
}


class MessageRepository {
    async create(msg) {
        await db.query(
            'INSERT INTO messages (id, connection_id, sender_id, message, created_at) VALUES ($1, $2, $3, $4, $5)',
            [msg.id, msg.connection_id, msg.sender_id, msg.message, msg.created_at]
        );
        return msg;
    }
    
    async findByConnectionId(connectionId, limit = 100) {
        const res = await db.query('SELECT * FROM messages WHERE connection_id = $1 ORDER BY created_at ASC LIMIT $2', [connectionId, limit]);
        return res.rows;
    }
    
    async markRead(connectionId, recipientId) {
        await db.query('UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE connection_id = $1 AND sender_id != $2 AND read_at IS NULL', [connectionId, recipientId]);
    }
    
    async getUnreadCount(userId) {
        const res = await db.query(`
            SELECT COUNT(*) as count 
            FROM messages m
            JOIN connections c ON m.connection_id = c.id
            WHERE (c.user_id = $1 OR c.target_user_id = $1)
              AND m.sender_id != $1
              AND m.read_at IS NULL
        `, [userId]);
        return parseInt(res.rows[0].count);
    }
    
    async getConversations(userId) {
        const res = await db.query(`
            SELECT c.*, 
                   (SELECT row_to_json(m) FROM messages m WHERE m.connection_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                   (SELECT COUNT(*) FROM messages m2 WHERE m2.connection_id = c.id AND m2.sender_id != $1 AND m2.read_at IS NULL) as unread_count
            FROM connections c
            WHERE (c.user_id = $1 OR c.target_user_id = $1) AND c.status = 'connected'
            ORDER BY c.updated_at DESC
        `, [userId]);
        return res.rows;
    }
}

const availabilityRepo = new AvailabilityRepository();
const skillRelationshipRepo = new SkillRelationshipRepository();

module.exports = {
    messageRepo: new MessageRepository(),
    availabilityRepo,
    skillRelationshipRepo,
    userRepo: new UserRepository(),
    skillRepo: new SkillRepository(),
    sessionRepo: new SessionRepository(),
    connectionRepo: new ConnectionRepository(),
    notificationRepo: new NotificationRepository(),
    authSessionRepo: new AuthSessionRepository(),
    reviewRepo: new ReviewRepository()
};