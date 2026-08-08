const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const dataPath = path.join(__dirname, 'data', 'hive-data.json');
const publicPath = path.join(__dirname, 'dist');
const readData = () => JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const writeData = data => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
const respond = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(JSON.stringify(body)); };
const bodyOf = req => new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => raw += chunk); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body')); } }); });
function serveStatic(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(publicPath, requested);
  if (!file.startsWith(path.resolve(publicPath)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return respond(res, 200, { ok: true, service: 'HIVE API' });
    if (req.method === 'GET' && url.pathname === '/api/dashboard') { const data = readData(), user = data.users[0], sessions = data.sessions.filter(s => s.status !== 'completed'); return respond(res, 200, { user, stats: { sessions: sessions.length + 5, rating: user.rating, seu: user.seu, skills: user.skills.length }, sessions, matches: data.matches, connections: data.connections }); }
    if (req.method === 'GET' && url.pathname === '/api/sessions') { const data = readData(), status = url.searchParams.get('status'); return respond(res, 200, status ? data.sessions.filter(s => s.status === status) : data.sessions); }
    if (req.method === 'GET' && url.pathname === '/api/matches') return respond(res, 200, readData().matches);
    if (req.method === 'POST' && url.pathname === '/api/auth/login') { const body = await bodyOf(req), data = readData(), user = data.users.find(u => u.email === body.email) || data.users[0]; return respond(res, 200, { token: `hive-demo-${user.id}`, user }); }
    if (req.method === 'POST' && url.pathname === '/api/connections') { const body = await bodyOf(req), data = readData(), match = data.matches.find(m => m.id === body.matchId); if (!match) return respond(res, 404, { error: 'Match not found' }); if (data.connections.some(c => c.matchId === match.id)) return respond(res, 409, { error: 'Connection request already sent' }); const connection = { id: `connection-${Date.now()}`, matchId: match.id, userId: 'vandan', status: 'pending', createdAt: new Date().toISOString() }; data.connections.push(connection); writeData(data); return respond(res, 201, { connection, match }); }
    if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/join$/.test(url.pathname)) { const id = url.pathname.split('/')[3], session = readData().sessions.find(s => s.id === id); return session ? respond(res, 200, { message: `You joined ${session.title}`, session }) : respond(res, 404, { error: 'Session not found' }); }
    if (req.method === 'GET' && serveStatic(res, url.pathname)) return;
    return respond(res, 404, { error: 'Route not found' });
  } catch (error) { return respond(res, 500, { error: error.message || 'Unexpected server error' }); }
});
server.listen(PORT, () => console.log(`HIVE API running at http://localhost:${PORT}`));
