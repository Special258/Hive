const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

require('dotenv').config();
const logger = require('./services/logger');

if (!process.env.DATABASE_URL) {
    logger.fatal('DATABASE_URL is not set. Exiting immediately.');
    process.exit(1);
}

const { messageRepo, userRepo, skillRepo, sessionRepo, connectionRepo, notificationRepo, authSessionRepo, reviewRepo, availabilityRepo, skillRelationshipRepo } = require('./services/repositories');
const { normaliseSkills, calculateMatches } = require('./services/matching');
const { rateLimit, sanitizeHtml, getSecurityHeaders } = require('./services/security');

const PORT = Number(process.env.PORT || 3001);
const publicPath = __dirname;
const configuredOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
const socketAllowedOrigins = Array.from(new Set([
  configuredOrigin,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
]));

function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
async function notify(userId, title, message, kind = 'update') {
  await notificationRepo.create({ id: id('notification'), user_id: userId, title, message, kind, read: false, created_at: new Date() });
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith('scrypt:')) return stored === password;
  const [, salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function safeUser(user) {
  const { password, ...safe } = user;
  safe.name = `${safe.first_name || ''} ${safe.last_name || ''}`.trim();
  if(!safe.name) safe.name = 'User';
  return { ...safe, skills: (Array.isArray(user.skills) ? user.skills : []).map((skill, index) => typeof skill === 'string'
    ? { id: `legacy-${index}-${skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: skill, type: 'teach', level: 'intermediate' }
    : { id: skill.id || id('skill'), name: String(skill.name || '').trim(), type: skill.type === 'learn' ? 'learn' : 'teach', level: skill.level || 'intermediate' }
  ).filter(skill => skill.name) };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function userFrom(req) {
  let rawToken = '';
  if (req.headers) {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) rawToken = authHeader.substring(7).trim();
  } else if (req.auth && req.auth.token) { // For Socket.io
      rawToken = req.auth.token.trim();
  }
  
  if (!rawToken) return null;
  
  const tokenHash = hashToken(rawToken);
  const session = await authSessionRepo.findByTokenHash(tokenHash);
  if (!session) return null;
  
  if (new Date(session.expires_at) < new Date()) return null; 
  
  const user = await userRepo.findById(session.user_id);
  if(user) {
      user.skills = await skillRepo.findByUserId(user.id);
  }
  return user;
}
function json(req, res, status, body) {
  const headers = getSecurityHeaders(req.headers.origin, configuredOrigin);
  headers['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooLarge = false;
    req.on('data', chunk => { 
        if (tooLarge) return;
        raw += chunk;
        if (raw.length > 50000) tooLarge = true; // 50KB payload limit
    });
    req.on('end', () => {
      if (tooLarge) return reject(new Error('Payload Too Large'));
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Request body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}
async function requireUser(req, res) {
  const user = await userFrom(req);
  if (!user) { json(req, res, 401, { error: 'Please sign in again.' }); return null; }
  if (user.status === 'suspended') { json(req, res, 403, { error: 'Your account is suspended.' }); return null; }
  return user;
}
async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') { json(req, res, 403, { error: 'Forbidden. Admin access required.' }); return null; }
  return user;
}


async function getMatchingData() {
    const relationships = await skillRelationshipRepo.findAll();
    const availabilities = await availabilityRepo.findAll();
    const availabilitiesMap = {};
    for (const a of availabilities) {
        if (!availabilitiesMap[a.user_id]) availabilitiesMap[a.user_id] = [];
        availabilitiesMap[a.user_id].push(a);
    }
    return { relationships, availabilitiesMap };
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(publicPath, requested);
  if (!file.startsWith(`${path.resolve(publicPath)}${path.sep}`) && file !== path.join(path.resolve(publicPath), 'index.html')) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;

  const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
  
  const headers = getSecurityHeaders(req.headers.origin, configuredOrigin);
  headers['Content-Type'] = `${contentTypes[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`;
  
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log('API CALLED:', req.method, url.pathname);
  const clientIp = req.socket.remoteAddress;
  
  if (req.method === 'OPTIONS') { 
      res.writeHead(204, getSecurityHeaders(req.headers.origin, configuredOrigin)); 
      return res.end(); 
  }
  
  // Rate limiting (100 req / minute globally per IP for non-static routes)
  if (url.pathname.startsWith('/api') && !rateLimit(clientIp, 150)) {
      return json(req, res, 429, { error: 'Too many requests. Please try again later.' });
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
        try {
            const { pool } = require('./services/db');
            await pool.query('SELECT 1');
            return json(req, res, 200, { ok: true, service: 'HIVE API Postgres Secure', time: new Date().toISOString() });
        } catch (dbErr) {
            logger.error('Health check failed - Database unavailable:', dbErr.message);
            return json(req, res, 503, { error: 'Service Unavailable', time: new Date().toISOString() });
        }
    }
    
    if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
      if (!rateLimit(`${clientIp}:auth`, 10)) return json(req, res, 429, { error: 'Too many signup attempts.' });
        
      const { firstName, lastName, email, password, role } = await readBody(req);
      if (![firstName, lastName, email, password, role].every(value => String(value || '').trim())) return json(req, res, 400, { error: 'All fields are required.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return json(req, res, 400, { error: 'Enter a valid email address.' });
      if (String(password).length < 8) return json(req, res, 400, { error: 'Password must be at least 8 characters.' });
      if (!['learner', 'tutor'].includes(role)) return json(req, res, 400, { error: 'Invalid role.' });
      if (String(firstName).length > 50 || String(lastName).length > 50) return json(req, res, 400, { error: 'Name is too long.' });
      
      const normalizedEmail = String(email).trim().toLowerCase();
      const existingUser = await userRepo.findByEmail(normalizedEmail);
      if (existingUser) return json(req, res, 409, { error: 'An account with this email already exists.' });
      
      const user = await userRepo.create({
        id: id('user'),
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        email: normalizedEmail,
        password: hashPassword(String(password)),
        role: role,
        seu: 100,
        rating: 0,
        status: 'active'
      });
      user.skills = [];
      
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await authSessionRepo.create({ token_hash: tokenHash, user_id: user.id, created_at: new Date(), expires_at: expiresAt });
      
      return json(req, res, 201, { token: rawToken, user: safeUser(user) });
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!rateLimit(`${clientIp}:auth`, 20)) return json(req, res, 429, { error: 'Too many login attempts.' });
        
      const { email, password } = await readBody(req);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const user = await userRepo.findByEmail(normalizedEmail);
      
      if (!user || !verifyPassword(String(password || ''), user.password)) return json(req, res, 401, { error: 'Invalid email or password.' });
      
      if (!String(user.password).startsWith('scrypt:')) {
          await userRepo.updatePassword(user.id, hashPassword(String(password)));
      }
      user.skills = await skillRepo.findByUserId(user.id);
      
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await authSessionRepo.create({ token_hash: tokenHash, user_id: user.id, created_at: new Date(), expires_at: expiresAt });
      
      return json(req, res, 200, { token: rawToken, user: safeUser(user) });
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const rawToken = authHeader.substring(7).trim();
        const tokenHash = hashToken(rawToken);
        await authSessionRepo.deleteByTokenHash(tokenHash);
      }
      return json(req, res, 200, { message: 'Logged out successfully.' });
    }

    
    if (req.method === 'GET' && url.pathname === '/api/users/me') {
        const user = await requireUser(req, res); if (!user) return;
        const fullUser = await userRepo.findById(user.id);
        return json(req, res, 200, safeUser(fullUser));
    }

    if (req.method === 'PUT' && url.pathname === '/api/users/me') {
        const user = await requireUser(req, res); if (!user) return;
        const body = await readBody(req);
        
        let avatarUrl = body.avatar_url || null;
        if (avatarUrl) {
            try {
                const parsed = new URL(avatarUrl);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    return json(req, res, 400, { error: 'Invalid avatar URL protocol' });
                }
            } catch (e) {
                return json(req, res, 400, { error: 'Invalid avatar URL format' });
            }
        }
        
        const profile = {
            avatar_url: avatarUrl,
            bio: body.bio || null,
            timezone: body.timezone || null,
            location: body.location || null,
            availability_summary: body.availability_summary || null
        };
        await userRepo.updateProfile(user.id, profile);
        const updated = await userRepo.findById(user.id);
        return json(req, res, 200, safeUser(updated));
    }

    if (req.method === 'GET' && url.pathname.match(/^\/api\/users\/([^\/]+)$/)) {
        const match = url.pathname.match(/^\/api\/users\/([^\/]+)$/);
        const targetUserId = match[1];
        const targetUser = await userRepo.findById(targetUserId);
        if (!targetUser) return json(req, res, 404, { error: 'User not found' });
        
        const skills = await skillRepo.findByUserId(targetUserId);
        
        const publicUser = {
            id: targetUser.id,
            first_name: targetUser.first_name,
            last_name: targetUser.last_name,
            role: targetUser.role,
            avatar_url: targetUser.avatar_url,
            bio: targetUser.bio,
            timezone: targetUser.timezone,
            location: targetUser.location,
            availability_summary: targetUser.availability_summary,
            rating: targetUser.rating,
            review_count: targetUser.review_count,
            teaching_hours: targetUser.teaching_hours,
            learning_hours: targetUser.learning_hours,
            sessions_completed: targetUser.sessions_completed,
            skills: skills
        };
        return json(req, res, 200, publicUser);
    }

    if (req.method === 'GET' && url.pathname.match(/^\/api\/users\/([^\/]+)\/reviews$/)) {
        const match = url.pathname.match(/^\/api\/users\/([^\/]+)\/reviews$/);
        const targetUserId = match[1];
        const reviews = await reviewRepo.findByRevieweeId(targetUserId);
        return json(req, res, 200, { reviews });
    }

    if (req.method === 'POST' && url.pathname === '/api/reviews') {
        const user = await requireUser(req, res); if (!user) return;
        const body = await readBody(req);
        
        const { session_id, overall_rating, teaching_rating, communication_rating, helpfulness_rating, comment } = body;
        
        if (!session_id || !overall_rating || overall_rating < 1 || overall_rating > 5) {
            return json(req, res, 400, { error: 'Missing session ID or invalid overall rating' });
        }

        const session = await sessionRepo.findById(session_id);
        if (!session) return json(req, res, 404, { error: 'Session not found' });
        if (session.status !== 'completed') return json(req, res, 400, { error: 'Cannot review an incomplete session' });

        const attendees = await sessionRepo.getAttendees(session_id);
        if (!attendees.includes(user.id)) return json(req, res, 403, { error: 'You did not participate in this session' });

        // Find the other participant
        let reviewee_id = null;
        if (session.tutor_id === user.id) {
            // I am the tutor, find a learner. For simplicity in 1-on-1, take the first attendee that is not me.
            reviewee_id = attendees.find(a => a !== user.id);
        } else {
            // I am a learner, review the tutor
            reviewee_id = session.tutor_id;
        }

        if (!reviewee_id) return json(req, res, 400, { error: 'No valid reviewee found in this session' });
        if (reviewee_id === user.id) return json(req, res, 400, { error: 'Cannot review yourself' });

        // Check duplicate
        const isDuplicate = await reviewRepo.checkDuplicate(session_id, user.id, reviewee_id);
        if (isDuplicate) return json(req, res, 400, { error: 'You have already reviewed this user for this session' });

        const review = {
            id: 'rev_' + Date.now() + Math.floor(Math.random()*1000),
            session_id,
            reviewer_id: user.id,
            reviewee_id,
            overall_rating,
            teaching_rating: teaching_rating || null,
            communication_rating: communication_rating || null,
            helpfulness_rating: helpfulness_rating || null,
            comment: comment || null
        };

        await reviewRepo.create(review);

        // Recalculate average and update user stats
        const { count, rating } = await reviewRepo.getAverageRating(reviewee_id);
        const reviewee = await userRepo.findById(reviewee_id);
        if (reviewee) {
            await userRepo.updateStats(reviewee_id, {
                review_count: count,
                rating: rating,
                teaching_hours: reviewee.teaching_hours,
                learning_hours: reviewee.learning_hours,
                sessions_completed: reviewee.sessions_completed
            });
        }

        // Notification
        await notificationRepo.create({
            id: 'notif_' + Date.now() + Math.floor(Math.random()*1000),
            user_id: reviewee_id,
            title: 'New Review',
            message: `${user.first_name} left you a ${overall_rating}-star review for session "${session.title}".`,
            kind: 'info',
            read: false,
            created_at: new Date()
        });

        return json(req, res, 201, { message: 'Review submitted successfully', review });
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const user = await requireUser(req, res); if (!user) return;
      const dbSessions = await sessionRepo.findAll();
      const activeSessions = dbSessions.filter(session => session.status !== 'completed').map(s => ({
          ...s, tutorId: s.tutor_id, tutor: s.tutor_name
      }));
      
      let completedSessionsCount = 0;
      for (const s of dbSessions) {
          if (s.status === 'completed') {
              if (s.tutor_id === user.id) { completedSessionsCount++; continue; }
              const attendees = await sessionRepo.getAttendees(s.id);
              if (attendees.includes(user.id)) completedSessionsCount++;
          }
      }
      
      const allUsers = await userRepo.findAll();
      for(const u of allUsers) u.skills = await skillRepo.findByUserId(u.id);
      
      const connectionsRaw = await connectionRepo.findByUserId(user.id);
      const connections = connectionsRaw.map(c => ({
          id: c.id, 
          userId: c.user_id, 
          matchId: c.user_id === user.id ? c.target_user_id : c.user_id, 
          status: c.status, 
          createdAt: c.created_at,
          isIncoming: c.target_user_id === user.id
      }));
      
      const { availabilitiesMap, relationships } = await getMatchingData();
      const matches = await calculateMatches(user, allUsers, availabilitiesMap, relationships);

      return json(req, res, 200, { 
          user: safeUser(user), 
          stats: { sessions: activeSessions.length, sessionsCompleted: completedSessionsCount, rating: Number(user.rating || 0), seu: Number(user.seu || 0), skills: normaliseSkills(user.skills).length }, 
          sessions: activeSessions, 
          matches: matches.slice(0, 3), 
          connections 
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/skills') {
      const user = await requireUser(req, res); if (!user) return;
      return json(req, res, 200, { skills: normaliseSkills(user.skills) });
    }

    if (req.method === 'POST' && url.pathname === '/api/skills') {
      const user = await requireUser(req, res); if (!user) return;
      const { name, type, level } = await readBody(req);
      const cleanName = sanitizeHtml(String(name || '').trim());
      if (!cleanName || cleanName.length > 50 || !['teach', 'learn'].includes(type) || !['beginner', 'intermediate', 'advanced', 'expert'].includes(level)) 
          return json(req, res, 400, { error: 'Provide a valid skill name, type, and level.' });
      
      const skills = normaliseSkills(user.skills);
      if (skills.some(skill => skill.name.toLowerCase() === cleanName.toLowerCase() && skill.type === type)) 
          return json(req, res, 409, { error: 'You already added this skill.' });
      
      const skill = await skillRepo.create({ id: id('skill'), user_id: user.id, name: cleanName, type, level });
      const outSkill = { id: skill.id, name: skill.name, type: skill.type, level: skill.level };
      return json(req, res, 201, { skill: outSkill, skills: [...skills, outSkill] });
    }

    if (req.method === 'PUT' && /^\/api\/skills\/[^/]+$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const skillId = url.pathname.split('/').pop();
      const body = await readBody(req);
      const existing = await skillRepo.findByIdAndUserId(skillId, user.id);
      if (!existing) return json(req, res, 404, { error: 'Skill not found.' });
      if (body.level && ['beginner', 'intermediate', 'advanced'].includes(body.level)) {
        await skillRepo.updateLevel(skillId, user.id, body.level);
      }
      const updatedSkills = await skillRepo.findByUserId(user.id);
      const outSkill = normaliseSkills(updatedSkills).find(s => s.id === skillId);
      return json(req, res, 200, { skill: outSkill, skills: normaliseSkills(updatedSkills) });
    }

    if (req.method === 'DELETE' && /^\/api\/skills\/[^/]+$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const skillId = url.pathname.split('/').pop();
      const deleted = await skillRepo.delete(skillId, user.id);
      if (!deleted) return json(req, res, 404, { error: 'Skill not found.' });
      const updatedSkills = await skillRepo.findByUserId(user.id);
      return json(req, res, 200, { skills: normaliseSkills(updatedSkills) });
    }

    if (req.method === 'GET' && url.pathname === '/api/matches') { 
        const user = await requireUser(req, res); if (!user) return; 
        const allUsers = await userRepo.findAll();
        for(const u of allUsers) u.skills = await skillRepo.findByUserId(u.id);
        const { availabilitiesMap, relationships } = await getMatchingData();
        const matches = await calculateMatches(user, allUsers, availabilitiesMap, relationships);
        return json(req, res, 200, { matches }); 
    }

    if (req.method === 'GET' && url.pathname === '/api/notifications') {
      const user = await requireUser(req, res); if (!user) return;
      const notifications = await notificationRepo.findByUserId(user.id);
      const outNotifs = notifications.map(n => ({ id: n.id, userId: n.user_id, title: n.title, message: n.message, kind: n.kind, read: n.read, createdAt: n.created_at }));
      return json(req, res, 200, { notifications: outNotifs, unread: outNotifs.filter(item => !item.read).length });
    }

    if (req.method === 'POST' && /^\/api\/notifications\/[^/]+\/read$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const notifId = url.pathname.split('/')[3];
      const updated = await notificationRepo.markRead(notifId, user.id);
      if (!updated) return json(req, res, 404, { error: 'Notification not found.' });
      return json(req, res, 200, { notification: { id: updated.id, read: true } });
    }

    if (req.method === 'GET' && url.pathname === '/api/sessions') { 
        const dbSessions = await sessionRepo.findAll();
        const status = url.searchParams.get('status');
        let sessions = dbSessions.map(s => ({ ...s, tutorId: s.tutor_id, tutor: s.tutor_name }));
        if(status) sessions = sessions.filter(s => s.status === status);
        return json(req, res, 200, { sessions }); 
    }

    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      const user = await requireUser(req, res); if (!user) return;
      const { title, topic, seu, scheduledFor } = await readBody(req);
      const cleanTitle = sanitizeHtml(String(title || '').trim());
      const cleanTopic = sanitizeHtml(String(topic || '').trim());
      
      if (!cleanTitle || cleanTitle.length > 100 || !cleanTopic || cleanTopic.length > 50) 
          return json(req, res, 400, { error: 'A valid session title and topic are required.' });
      
      const newSess = { 
          id: id('session'), title: cleanTitle, topic: cleanTopic, 
          tutor_id: user.id, status: 'upcoming', 
          seu: Math.max(0, Math.min(500, Number(seu) || 25)), 
          time: scheduledFor ? new Date(scheduledFor).toLocaleString() : 'Schedule to be confirmed'
      };
      await sessionRepo.create(newSess);
      await sessionRepo.addAttendee(newSess.id, user.id);
      await notify(user.id, 'Session published', `Your ${newSess.title} session is ready for learners to join.`, 'session'); 
      
      const outSess = { ...newSess, tutorId: user.id, tutor: safeUser(user).name, attendees: [user.id] };
      return json(req, res, 201, { session: outSess });
    }

    if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/join$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const sessionId = url.pathname.split('/')[3];
      const session = await sessionRepo.findById(sessionId);
      if (!session) return json(req, res, 404, { error: 'Session not found.' });
      await sessionRepo.addAttendee(sessionId, user.id);
      
      const attendees = await sessionRepo.getAttendees(sessionId);
      return json(req, res, 200, { message: `You joined ${session.title}.`, session: { ...session, tutorId: session.tutor_id, tutor: session.tutor_name, attendees } });
    }

    if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/leave$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const sessionId = url.pathname.split('/')[3];
      const session = await sessionRepo.findById(sessionId);
      if (!session) return json(req, res, 404, { error: 'Session not found.' });
      await sessionRepo.removeAttendee(sessionId, user.id);
      
      const attendees = await sessionRepo.getAttendees(sessionId);
      return json(req, res, 200, { message: `You left ${session.title}.`, session: { ...session, tutorId: session.tutor_id, tutor: session.tutor_name, attendees } });
    }

    if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/complete$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const sessionId = url.pathname.split('/')[3];
      const session = await sessionRepo.findById(sessionId);
      if (!session) return json(req, res, 404, { error: 'Session not found.' });
      if (session.tutor_id !== user.id && user.role !== 'admin') return json(req, res, 403, { error: 'Only the tutor can complete this session.' });
      
      if (session.status !== 'completed') {
        const { query } = require('./services/db');
        await query("UPDATE sessions SET status = 'completed' WHERE id = $1", [session.id]);
        session.status = 'completed';

        const tutor = await userRepo.findById(session.tutor_id);
        if (tutor) {
            await query("UPDATE users SET seu = seu + $1, teaching_hours = teaching_hours + 1, sessions_completed = sessions_completed + 1 WHERE id = $2", [session.seu, tutor.id]);
        }

        const attendees = await sessionRepo.getAttendees(session.id);
        for (const attendee of attendees) {
            if (attendee !== session.tutor_id) {
                await query("UPDATE users SET learning_hours = learning_hours + 1, sessions_completed = sessions_completed + 1 WHERE id = $1", [attendee]);
            }
        }
      }
      return json(req, res, 200, { message: 'Session completed.', session: { ...session, tutorId: session.tutor_id, tutor: session.tutor_name } });
    }

    if (req.method === 'DELETE' && /^\/api\/sessions\/[^/]+$/.test(url.pathname)) {
      const user = await requireUser(req, res); if (!user) return;
      const sessionId = url.pathname.split('/')[3];
      const session = await sessionRepo.findById(sessionId);
      if (!session) return json(req, res, 404, { error: 'Session not found.' });
      if (session.tutor_id !== user.id && user.role !== 'admin') return json(req, res, 403, { error: 'Only the tutor can delete this session.' });
      
      const { query } = require('./services/db');
      await query("DELETE FROM sessions WHERE id = $1", [sessionId]);
      return json(req, res, 200, { message: 'Session deleted.' });
    }

    
    if (req.method === 'GET' && url.pathname === '/api/users/me/availability') {
        const user = await requireUser(req, res); if (!user) return;
        const availabilities = await availabilityRepo.findByUserId(user.id);
        return json(req, res, 200, { availabilities });
    }

    if (req.method === 'POST' && url.pathname === '/api/users/me/availability') {
        const user = await requireUser(req, res); if (!user) return;
        const body = await readBody(req);
        
        // validate
        if (body.day_of_week < 0 || body.day_of_week > 6) return json(req, res, 400, { error: 'Invalid day of week' });
        if (!body.start_time || !body.end_time || body.start_time >= body.end_time) return json(req, res, 400, { error: 'Invalid time range' });
        try { Intl.DateTimeFormat(undefined, { timeZone: body.timezone }); } catch { return json(req, res, 400, { error: 'Invalid timezone' }); }

        const av = {
            id: id('avail'),
            user_id: user.id,
            day_of_week: body.day_of_week,
            start_time: body.start_time,
            end_time: body.end_time,
            timezone: body.timezone,
            created_at: new Date(),
            updated_at: new Date()
        };
        try {
            await availabilityRepo.create(av);
            return json(req, res, 201, { availability: av });
        } catch (e) {
            return json(req, res, 500, { error: e.message });
        }
    }

    if (req.method === 'DELETE' && url.pathname.match(/^\/api\/users\/me\/availability\/([^\/]+)$/)) {
        const user = await requireUser(req, res); if (!user) return;
        const match = url.pathname.match(/^\/api\/users\/me\/availability\/([^\/]+)$/);
        const avId = match[1];
        const deleted = await availabilityRepo.delete(avId, user.id);
        if (deleted) return json(req, res, 200, { success: true });
        return json(req, res, 404, { error: 'Not found' });
    }

    // Admin Routes
    if (url.pathname.startsWith('/api/admin')) {
        if (!rateLimit(`${clientIp}:admin`, 30)) return json(req, res, 429, { error: 'Rate limit exceeded for admin endpoints.' });
    }
    
    if (req.method === 'GET' && url.pathname === '/api/admin/stats') {
      const admin = await requireAdmin(req, res); if (!admin) return;
      const { query } = require('./services/db');
      
      const totalUsers = (await query('SELECT COUNT(*) FROM users')).rows[0].count;
      const activeSessions = (await query("SELECT COUNT(*) FROM sessions WHERE status != 'completed'")).rows[0].count;
      const totalSessions = (await query('SELECT COUNT(*) FROM sessions')).rows[0].count;
      const totalSkills = (await query('SELECT COUNT(*) FROM skills')).rows[0].count;
      const recentConnections = (await query('SELECT COUNT(*) FROM connections')).rows[0].count;
      
      return json(req, res, 200, { 
          totalUsers: Number(totalUsers), activeSessions: Number(activeSessions), 
          totalSessions: Number(totalSessions), totalSkills: Number(totalSkills), 
          recentConnections: Number(recentConnections) 
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/users') {
      const admin = await requireAdmin(req, res); if (!admin) return;
      const users = await userRepo.findAll();
      return json(req, res, 200, { users: users.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email, role: u.role, seu: Number(u.seu || 0), status: u.status || 'active', rating: Number(u.rating) })) });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/sessions') {
      const admin = await requireAdmin(req, res); if (!admin) return;
      const dbSessions = await sessionRepo.findAll();
      return json(req, res, 200, { sessions: dbSessions.map(s => ({ ...s, tutorId: s.tutor_id, tutor: s.tutor_name })) });
    }

    if (req.method === 'PUT' && /^\/api\/admin\/users\/[^/]+\/suspend$/.test(url.pathname)) {
      const admin = await requireAdmin(req, res); if (!admin) return;
      const targetId = url.pathname.split('/')[4];
      const target = await userRepo.findById(targetId);
      if (!target) return json(req, res, 404, { error: 'User not found.' });
      if (target.id === admin.id) return json(req, res, 400, { error: 'Cannot suspend yourself.' });
      
      const newStatus = target.status === 'suspended' ? 'active' : 'suspended';
      await userRepo.updateStatus(targetId, newStatus);
      target.status = newStatus;
      
      return json(req, res, 200, { user: { ...target, name: `${target.first_name} ${target.last_name}` } });
    }

    if (req.method === 'DELETE' && /^\/api\/admin\/users\/[^/]+$/.test(url.pathname)) {
      const admin = await requireAdmin(req, res); if (!admin) return;
      const targetId = url.pathname.split('/')[4];
      const target = await userRepo.findById(targetId);
      if (!target) return json(req, res, 404, { error: 'User not found.' });
      if (target.id === admin.id) return json(req, res, 400, { error: 'Cannot delete yourself.' });
      
      const { query } = require('./services/db');
      await query('DELETE FROM users WHERE id = $1', [targetId]);
      return json(req, res, 200, { message: 'User deleted.' });
    }

    
    // ----- PHASE 3: CONNECTIONS API -----
    if (url.pathname.startsWith('/api/connections')) {
        const user = await userFrom(req);
        if (!user) return json(req, res, 401, { error: 'Unauthorized' });

        if (req.method === 'GET' && url.pathname === '/api/connections') {
            const connections = await connectionRepo.findByUserId(user.id);
            // Enrich with user data
            const enriched = await Promise.all(connections.map(async (c) => {
                const otherId = c.user_id === user.id ? c.target_user_id : c.user_id;
                const otherUser = await userRepo.findById(otherId);
                return {
                    ...c,
                    otherUser: {
                        id: otherUser.id,
                        name: otherUser.first_name + ' ' + otherUser.last_name,
                        avatar: otherUser.avatar_url,
                        rating: Number(otherUser.rating),
                        review_count: otherUser.review_count,
                        skills: await skillRepo.findByUserId(otherUser.id),
                        availability_summary: otherUser.availability_summary
                    },
                    isIncoming: c.target_user_id === user.id
                };
            }));
            return json(req, res, 200, { connections: enriched });
        }

        if (req.method === 'POST' && url.pathname === '/api/connections') {
            const body = await readBody(req);
            const { targetUserId } = body;
            if (!targetUserId) return json(req, res, 400, { error: 'Missing targetUserId' });
            if (targetUserId === user.id) return json(req, res, 400, { error: 'Self-connection not allowed' });
            
            const existing = await connectionRepo.findExisting(user.id, targetUserId);
            if (existing) {
                if (existing.status === 'rejected') {
                    // Update rejected to pending if they try again? Wait, instructions say:
                    // "a future connection request may be allowed again according to a sensible rule"
                    // We can just update it back to pending and swap user_id/target_user_id to reflect who initiated.
                    await query('UPDATE connections SET status = $1, user_id = $2, target_user_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', ['pending', user.id, targetUserId, existing.id]);
                    await notificationRepo.create({
                        id: 'notif_' + Date.now() + Math.random().toString(36).substring(2,7),
                        user_id: targetUserId,
                        title: 'New Connection Request',
                        message: `${user.first_name} ${user.last_name} wants to connect with you.`,
                        kind: 'connection_request',
                        read: false,
                        created_at: new Date().toISOString()
                    });
                    return json(req, res, 200, { message: 'Connection request sent.' });
                }
                return json(req, res, 400, { error: 'Connection already exists.' });
            }

            const connId = 'conn_' + Date.now() + Math.random().toString(36).substring(2,7);
            await connectionRepo.create({
                id: connId,
                user_id: user.id,
                target_user_id: targetUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

            await notificationRepo.create({
                id: 'notif_' + Date.now() + Math.random().toString(36).substring(2,7),
                user_id: targetUserId,
                title: 'New Connection Request',
                message: `${user.first_name} ${user.last_name} wants to connect with you.`,
                kind: 'connection_request',
                read: false,
                created_at: new Date().toISOString()
            });

            return json(req, res, 201, { message: 'Connection request sent.' });
        }

        const match = url.pathname.match(/^\/api\/connections\/([^/]+)\/(accept|reject)$/);
        if (req.method === 'POST' && match) {
            const connId = match[1];
            const action = match[2];
            const conn = await connectionRepo.findById(connId);
            if (!conn) return json(req, res, 404, { error: 'Connection not found.' });
            
            // Only the target user can accept/reject an incoming request
            if (conn.target_user_id !== user.id) return json(req, res, 403, { error: 'Unauthorized to modify this connection' });
            if (conn.status !== 'pending') return json(req, res, 400, { error: 'Connection is not pending' });

            if (action === 'accept') {
                await connectionRepo.updateStatus(connId, 'connected');
                await notificationRepo.create({
                    id: 'notif_' + Date.now() + Math.random().toString(36).substring(2,7),
                    user_id: conn.user_id,
                    title: 'Connection Accepted',
                    message: `${user.first_name} ${user.last_name} accepted your request.`,
                    kind: 'connection_accepted',
                    read: false,
                    created_at: new Date().toISOString()
                });
                return json(req, res, 200, { message: 'Connection accepted.' });
            } else if (action === 'reject') {
                await connectionRepo.updateStatus(connId, 'rejected');
                return json(req, res, 200, { message: 'Connection rejected.' });
            }
        }
        
        const delMatch = url.pathname.match(/^\/api\/connections\/([^/]+)$/);
        if (req.method === 'DELETE' && delMatch) {
            const connId = delMatch[1];
            const conn = await connectionRepo.findById(connId);
            if (!conn) return json(req, res, 404, { error: 'Connection not found.' });
            if (conn.user_id !== user.id && conn.target_user_id !== user.id) return json(req, res, 403, { error: 'Unauthorized to modify this connection' });
            
            await connectionRepo.delete(connId);
            return json(req, res, 200, { message: 'Connection deleted.' });
        }
    }

    // ----- PHASE 3: CONVERSATIONS API -----
    if (url.pathname.startsWith('/api/conversations')) {
        const user = await userFrom(req);
        if (!user) return json(req, res, 401, { error: 'Unauthorized' });

        if (req.method === 'GET' && url.pathname === '/api/conversations') {
            const convs = await messageRepo.getConversations(user.id);
            const enriched = await Promise.all(convs.map(async (c) => {
                const otherId = c.user_id === user.id ? c.target_user_id : c.user_id;
                const otherUser = await userRepo.findById(otherId);
                return {
                    ...c,
                    otherUser: {
                        id: otherUser.id,
                        name: otherUser.first_name + ' ' + otherUser.last_name,
                        avatar: otherUser.avatar_url
                    }
                };
            }));
            return json(req, res, 200, { conversations: enriched });
        }

        const msgMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
        if (req.method === 'GET' && msgMatch) {
            const connId = msgMatch[1];
            const conn = await connectionRepo.findById(connId);
            if (!conn || (conn.user_id !== user.id && conn.target_user_id !== user.id)) {
                return json(req, res, 403, { error: 'Unauthorized' });
            }
            if (conn.status !== 'connected') {
                return json(req, res, 403, { error: 'Not connected' });
            }
            const msgs = await messageRepo.findByConnectionId(connId);
            return json(req, res, 200, { messages: msgs });
        }

        if (req.method === 'POST' && msgMatch) {
            const connId = msgMatch[1];
            const conn = await connectionRepo.findById(connId);
            if (!conn || (conn.user_id !== user.id && conn.target_user_id !== user.id)) return json(req, res, 403, { error: 'Unauthorized' });
            if (conn.status !== 'connected') return json(req, res, 403, { error: 'Not connected' });
            
            const body = await readBody(req);
            let { message } = body;
            if (!message || typeof message !== 'string') return json(req, res, 400, { error: 'Invalid message' });
            message = message.substring(0, 1000).replace(/</g, "&lt;").replace(/>/g, "&gt;");
            if (!message.trim()) return json(req, res, 400, { error: 'Empty message' });

            const msgObj = await messageRepo.create({
                id: 'msg_' + Date.now() + Math.random().toString(36).substring(2,7),
                connection_id: connId,
                sender_id: user.id,
                message: message,
                created_at: new Date().toISOString()
            });

            // If we use REST to send, we might still want to emit via Socket.IO if we have a way.
            // But Socket.IO will handle realtime sending directly anyway.
            return json(req, res, 201, { message: msgObj });
        }

        const readMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/read$/);
        if (req.method === 'POST' && readMatch) {
            const connId = readMatch[1];
            const conn = await connectionRepo.findById(connId);
            if (!conn || (conn.user_id !== user.id && conn.target_user_id !== user.id)) return json(req, res, 403, { error: 'Unauthorized' });
            
            await messageRepo.markRead(connId, user.id);
            return json(req, res, 200, { success: true });
        }
    }


    if (req.method === 'GET' && serveStatic(req, res, url.pathname)) return;
    
    console.log('RETURNING 404 FOR:', req.method, url.pathname);
    return json(req, res, 404, { error: 'Route not found.' });
  } catch (error) { 
      logger.error('Server Error:', error.message); 
      if(error.message === 'Payload Too Large') {
          return json(req, res, 413, { error: 'Payload Too Large' });
      }
      return json(req, res, 500, { error: 'Something went wrong on the server.' }); 
  }
});

server.listen(PORT, () => logger.info(`HIVE is running at http://localhost:${PORT}`));

const io = new Server(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type']
  }
});

// Phase 3: Socket.io Security
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication error: Token required'));
        const reqMock = { auth: { token } };
        const user = await userFrom(reqMock);
        if (!user) return next(new Error('Authentication error: Invalid or expired token'));
        if (user.status === 'suspended') return next(new Error('Authentication error: Suspended account'));
        socket.user = safeUser(user);
        socket.user.rawId = user.id;
        next();
    } catch (err) {
        next(new Error('Authentication error: Internal error'));
    }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected securely: ${socket.id} (User: ${socket.user.name})`);

  // Join personal room for direct messages
  socket.join('user:' + socket.user.rawId);

  socket.on('direct-message', async (data) => {
    try {
        const { connectionId, message, clientMessageId } = data;
        if (!connectionId || !message || typeof message !== 'string') return;
        
        const cleanMsg = message.substring(0, 1000).replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
        if (!cleanMsg) return;

        const conn = await connectionRepo.findById(connectionId);
        if (!conn) return socket.emit('error', 'Connection not found');
        if (conn.status !== 'connected') return socket.emit('error', 'Not connected');
        if (conn.user_id !== socket.user.rawId && conn.target_user_id !== socket.user.rawId) {
            return socket.emit('error', 'Unauthorized conversation access');
        }

        const msgObj = await messageRepo.create({
            id: 'msg_' + Date.now() + Math.random().toString(36).substring(2,7),
            connection_id: connectionId,
            sender_id: socket.user.rawId,
            message: cleanMsg,
            created_at: new Date().toISOString()
        });

        if (clientMessageId) {
            msgObj.clientMessageId = clientMessageId;
        }

        // Notify both users in the connection
        io.to('user:' + conn.user_id).to('user:' + conn.target_user_id).emit('message-received', msgObj);

        // create notification for recipient if not self
        const recipientId = conn.user_id === socket.user.rawId ? conn.target_user_id : conn.user_id;
        // Optionally create notification, though realtime is usually enough. Let's create one.
        await notificationRepo.create({
            id: 'notif_' + Date.now() + Math.random().toString(36).substring(2,7),
            user_id: recipientId,
            title: 'New Message',
            message: `${socket.user.name} sent you a message.`,
            kind: 'direct_message',
            read: false,
            created_at: new Date().toISOString()
        });
        
    } catch(err) {
        logger.error('Socket direct-message error:', err.message);
    }
  });

  socket.on('mark-read', async (connectionId) => {
      try {
          const conn = await connectionRepo.findById(connectionId);
          if (!conn || (conn.user_id !== socket.user.rawId && conn.target_user_id !== socket.user.rawId)) return;
          await messageRepo.markRead(connectionId, socket.user.rawId);
          
          // emit back to the other user that messages were read
          const otherId = conn.user_id === socket.user.rawId ? conn.target_user_id : conn.user_id;
          io.to('user:' + otherId).emit('message-read', { connectionId, readBy: socket.user.rawId });
      } catch(err) {
          logger.error('Socket mark-read error:', err.message);
      }
  });

  
  socket.on('join-room', async (roomId) => {
    try {
        // Room authorization
        const session = await sessionRepo.findById(roomId);
        if (!session) {
            socket.emit('error', 'Session not found');
            return;
        }
        
        let isAuthorized = false;
        if (session.tutor_id === socket.user.rawId) {
            isAuthorized = true;
        } else {
            const attendees = await sessionRepo.getAttendees(roomId);
            if (attendees.includes(socket.user.rawId)) {
                isAuthorized = true;
            }
        }
        
        if (!isAuthorized) {
            socket.emit('error', 'Unauthorized to join this room');
            return;
        }
        
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', { userId: socket.user.rawId, name: socket.user.name });
    } catch(err) {
        socket.emit('error', 'Failed to join room');
    }
  });
  
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId: socket.user.rawId, name: socket.user.name });
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) socket.to(roomId).emit('user-left', { userId: socket.user.rawId, name: socket.user.name });
    }
  });

  socket.on('chat-message', (roomId, messageStr) => {
    if (!socket.rooms.has(roomId)) {
        return; // Only allow sending messages to joined rooms
    }
    const cleanStr = sanitizeHtml(String(messageStr || '').substring(0, 500));
    if (!cleanStr) return;
    
    // Server resolves identity securely, ignoring any client claims
    const secureMessage = {
        senderId: socket.user.rawId,
        senderName: socket.user.name,
        text: cleanStr,
        timestamp: new Date().toISOString()
    };
    socket.to(roomId).emit('chat-message', secureMessage);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        logger.info('Closed out remaining HTTP connections.');
        io.close(() => {
            logger.info('Closed Socket.IO connections.');
            const { pool } = require('./services/db');
            pool.end().then(() => {
                logger.info('PostgreSQL pool disconnected.');
                process.exit(0);
            });
        });
    });
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    logger.fatal('Uncaught Exception:', err.stack);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
});
