const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/hive-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const report = {
  users: { total: 0, valid: 0, invalid: [], details: [] },
  skills: { total: 0, valid: 0, invalid: [], details: [] },
  sessions: { total: 0, valid: 0, invalid: [], details: [] },
  session_participants: { total: 0, valid: 0, invalid: [], details: [] },
  connections: { total: 0, valid: 0, invalid: [], details: [] },
  notifications: { total: 0, valid: 0, invalid: [], details: [] },
  auth_sessions: { total: 0, valid: 0, invalid: [], details: [] },
};

const userIds = new Set();
const userEmails = new Set();
const userNames = new Map(); // name -> id, to map legacy tutors

// 1. Process Users
for (const u of data.users || []) {
  report.users.total++;
  if (!u.id || !u.email) {
    report.users.invalid.push({ record: u, reason: 'Missing id or email' });
    continue;
  }
  if (userEmails.has(u.email)) {
    report.users.invalid.push({ record: u, reason: 'Duplicate email' });
    continue;
  }
  userIds.add(u.id);
  userEmails.add(u.email);
  if (u.name) userNames.set(u.name.trim().toLowerCase(), u.id);
  
  if (u.firstName && u.lastName) {
      userNames.set(`${u.firstName} ${u.lastName}`.trim().toLowerCase(), u.id);
  }
  
  report.users.valid++;
  
  // 2. Process Skills for this user
  for (const s of u.skills || []) {
    report.skills.total++;
    if (!s.id || !s.name) {
      report.skills.invalid.push({ record: s, userId: u.id, reason: 'Missing id or name' });
    } else {
      report.skills.valid++;
    }
  }
}

// 3. Process Sessions
for (const s of data.sessions || []) {
  report.sessions.total++;
  let tutorId = s.tutorId;
  if (!tutorId && s.tutor) {
      const nameKey = String(s.tutor).trim().toLowerCase();
      if (userNames.has(nameKey)) {
          tutorId = userNames.get(nameKey);
      }
  }
  
  if (!tutorId || !userIds.has(tutorId)) {
    report.sessions.invalid.push({ record: s, reason: `Tutor user not found. Tutor string: "${s.tutor}", mapped ID: ${tutorId}` });
  } else {
    report.sessions.valid++;
  }
  
  // Session Participants
  for (const attendeeId of s.attendees || []) {
    report.session_participants.total++;
    if (!userIds.has(attendeeId)) {
      report.session_participants.invalid.push({ sessionId: s.id, attendeeId, reason: 'Attendee user not found' });
    } else {
      report.session_participants.valid++;
    }
  }
}

// 4. Process Connections
for (const c of data.connections || []) {
  report.connections.total++;
  if (!userIds.has(c.userId)) {
    report.connections.invalid.push({ record: c, reason: `Sender user not found: ${c.userId}` });
  } else if (!userIds.has(c.matchId)) {
    report.connections.invalid.push({ record: c, reason: `Target match user not found: ${c.matchId}` });
  } else {
    report.connections.valid++;
  }
}

// 5. Process Notifications
for (const n of data.notifications || []) {
  report.notifications.total++;
  if (!userIds.has(n.userId)) {
    report.notifications.invalid.push({ record: n, reason: `Target user not found: ${n.userId}` });
  } else {
    report.notifications.valid++;
  }
}

// 6. Process Auth Sessions
for (const a of data.authSessions || []) {
  report.auth_sessions.total++;
  if (!userIds.has(a.userId)) {
    report.auth_sessions.invalid.push({ record: a, reason: `User not found: ${a.userId}` });
  } else {
    report.auth_sessions.valid++;
  }
}

console.log(JSON.stringify(report, null, 2));
