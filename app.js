import { api } from './services/api.js';

// Particle canvas
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.5 + 0.1,
      c: Math.random() > 0.5 ? '74,158,255' : '123,111,255'
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${p.o})`;
      ctx.fill();
    });

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(74,158,255,${0.06 * (1 - dist/100)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// Auth modal
function showAuth(type) {
  const modal = document.getElementById('auth-modal');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  if (!modal) return;
  if (loginForm) loginForm.classList.toggle('hidden', type !== 'login');
  if (signupForm) signupForm.classList.toggle('hidden', type !== 'signup');
  modal.classList.add('active');
}

function closeAuth(e) {
  if (e.target.id === 'auth-modal') closeAuthDirect();
}
function closeAuthDirect() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
}

// Toggle password
function togglePwd(btn) {
  const input = btn.closest('.input-wrap').querySelector('input');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Password strength
function checkStrength(val) {
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  if (!fill) return;
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    {w:'0%', c:'transparent', l:'Weak'},
    {w:'25%', c:'#ef4444', l:'Weak'},
    {w:'50%', c:'#f97316', l:'Fair'},
    {w:'75%', c:'#eab308', l:'Good'},
    {w:'100%', c:'#22c55e', l:'Strong'}
  ];
  const lvl = levels[score];
  fill.style.width = lvl.w;
  fill.style.background = lvl.c;
  label.textContent = lvl.l;
  label.style.color = lvl.c;
}

// Toast
function showToast(title, msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-icon"></div>
      <div class="toast-text"><strong></strong><p></p></div>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('strong').textContent = title;
  toast.querySelector('p').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// Updated Login handler
async function handleLogin(e) {
  e.preventDefault();

  const emailInput = e.target.querySelector('#login-email');
  const passwordInput = e.target.querySelector('#login-password');

  const email = emailInput?.value.trim().toLowerCase() || '';
  const password = passwordInput?.value || '';

  if (!email || !password) {
    showToast('Missing information', 'Please enter your email and password.');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');

  if (!btn) return;

  const btnText = btn.querySelector('span');

  btn.disabled = true;

  if (btnText) {
    btnText.style.display = 'none';
  }

  btn.insertAdjacentHTML(
    'beforeend',
    `<span class="btn-loader" style="
      display:inline-block;
      width:18px;
      height:18px;
      border:2px solid rgba(255,255,255,.3);
      border-top-color:#fff;
      border-radius:50%;
      animation:spin .7s linear infinite;
    "></span>`
  );

  showToast('Signing in', 'Verifying your credentials…');

  try {
    const result = await api.post('/auth/login', { email, password });

    // Save the logged-in user and token
    localStorage.setItem('token', result.token);
    localStorage.setItem(
      'hiveUser',
      JSON.stringify(result.user)
    );

    showToast(
      'Welcome back!',
      `Good to see you again, ${result.user.name || 'HIVE User'}.`
    );

    setTimeout(() => {
      window.location.href =
        result.user.role === 'admin'
          ? 'admin.html'
          : 'dashboard.html';
    }, 500);

  } catch (error) {

    console.error('Login error:', error);

    showToast(
      'Sign in failed',
      error.message || 'Unable to sign in.'
    );

    btn.disabled = false;

    const loader = btn.querySelector('.btn-loader');
    if (loader) loader.remove();

    if (btnText) {
      btnText.style.display = '';
    }
  }
}

async function handleSignup(e) {
    e.preventDefault();

    const firstName = document.getElementById('signup-first-name')?.value.trim();
    const lastName = document.getElementById('signup-last-name')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim();
    const password = document.getElementById('pwd-input')?.value;
    const role = document.querySelector('input[name="role"]:checked')?.value;

    if (!firstName || !lastName || !email || !password || !role) {
        showToast('Missing information', 'Please fill in all required fields.');
        return;
    }

    try {
        const result = await api.post('/auth/signup', {
            firstName,
            lastName,
            email,
            password,
            role
        });

        localStorage.setItem('token', result.token);
        localStorage.setItem('hiveUser', JSON.stringify(result.user));

        showToast(
            'Account created',
            'Welcome to HIVE. Your account has been created successfully.'
        );

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 700);

    } catch (error) {
        console.error('Signup error:', error);

        showToast(
            'Signup failed',
            error.message || 'Unable to create your account.'
        );
    }
}

// Navbar scroll
window.addEventListener('scroll', () => {
  const nb = document.getElementById('navbar');
  if (nb) nb.style.background = window.scrollY > 10 ? 'rgba(5,8,15,.95)' : 'rgba(5,8,15,.7)';
});
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.endsWith('sessions.html')) {
    loadSampleSessions();
    setupCreateSession();
  }
  setupCommandPalette();
  setupMatchInteractions();
  setupNotifications();
  updateUserShell();
});

function updateUserShell() {
  const user = JSON.parse(localStorage.getItem('hiveUser') || 'null');
  if (!user) return;
  const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'HIVE User';
  document.querySelectorAll('.user-name, #sidebar-name').forEach(el => { el.textContent = name; });
  document.querySelectorAll('.user-avatar, #sidebar-avatar').forEach(el => { el.textContent = getInitials(name); });
  document.querySelectorAll('.user-role').forEach(el => { el.textContent = user.role || 'Learner'; });
  document.querySelectorAll('.seu-badge, #sidebar-seu').forEach(el => { el.textContent = `${Number(user.seu || 0)} SEU`; });
}

// Command palette — a lightweight, keyboard-first navigation component.
function setupCommandPalette() {
  if (document.getElementById('command-palette')) return;
  const palette = document.createElement('div');
  palette.id = 'command-palette';
  palette.className = 'command-palette';
  palette.innerHTML = `
    <div class="command-backdrop" data-command-close></div>
    <section class="command-dialog" role="dialog" aria-modal="true" aria-label="Quick actions">
      <div class="command-search"><span>⌕</span><input id="command-search" placeholder="Search pages or actions…" autocomplete="off"><kbd>Esc</kbd></div>
      <div class="command-list" id="command-list">
        <p class="command-label">Navigate</p>
        <button data-command="dashboard.html"><span>⌂</span><b>Dashboard</b><small>Overview and progress</small></button>
        <button data-command="sessions.html"><span>◉</span><b>Browse sessions</b><small>Find a live exchange</small></button>
        <button data-command="subscription.html"><span>✦</span><b>Upgrade plan</b><small>Unlock more sessions</small></button>
        <p class="command-label">Actions</p>
        <button data-command="match"><span>✧</span><b>Find my best match</b><small>See people to learn with</small></button>
      </div>
    </section>`;
  document.body.appendChild(palette);
  const input = palette.querySelector('#command-search');
  const close = () => { palette.classList.remove('open'); input.value = ''; filterCommands(''); };
  window.openCommandPalette = () => { palette.classList.add('open'); setTimeout(() => input.focus(), 40); };
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); window.openCommandPalette(); }
    if (event.key === 'Escape') close();
  });
  palette.querySelector('[data-command-close]').addEventListener('click', close);
  input.addEventListener('input', event => filterCommands(event.target.value));
  palette.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => {
    const target = button.dataset.command;
    if (target === 'match') { close(); showToast('Matching in progress', 'Your best exchange partners are ready below.'); document.querySelector('.match-spotlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    window.location.href = target;
  }));
}
function filterCommands(query) {
  const term = query.toLowerCase().trim();
  document.querySelectorAll('#command-list button').forEach(button => { button.hidden = !button.textContent.toLowerCase().includes(term); });
}

function setupNotifications() {
  const currentUser = JSON.parse(localStorage.getItem('hiveUser') || 'null');
  if (!currentUser?.email || document.getElementById('notification-center')) return;
  const center = document.createElement('aside');
  center.id = 'notification-center';
  center.className = 'notification-center';
  center.innerHTML = `<button class="notification-toggle" type="button" aria-label="Open notifications"><span>♢</span><b id="notification-count" hidden>0</b></button><div class="notification-panel" hidden><div class="notification-panel-head"><div><strong>Notifications</strong><small>Stay in the loop</small></div><button type="button" id="mark-notifications-read">Mark all read</button></div><div class="notification-list"><div class="notification-empty">Loading your updates…</div></div></div>`;
  document.body.appendChild(center);
  const panel = center.querySelector('.notification-panel');
  const toggle = center.querySelector('.notification-toggle');
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) loadNotifications(); });
  document.addEventListener('click', event => { if (!center.contains(event.target)) panel.hidden = true; });
  center.querySelector('#mark-notifications-read').addEventListener('click', async () => {
    const items = [...center.querySelectorAll('[data-notification-id]')];
    await Promise.all(items.map(item => api.post(`/notifications/${encodeURIComponent(item.dataset.notificationId)}/read`)));
    loadNotifications();
  });
  async function loadNotifications() {
    try {
      const data = await api.get('/notifications');
      const list = center.querySelector('.notification-list'), count = center.querySelector('#notification-count');
      count.hidden = !data.unread; count.textContent = data.unread > 9 ? '9+' : data.unread;
      list.innerHTML = data.notifications.length ? data.notifications.map(item => `<button class="notification-item ${item.read ? '' : 'unread'}" data-notification-id="${escapeHTML(item.id)}"><span class="notification-kind ${escapeHTML(item.kind || 'update')}">${item.kind === 'session' ? '◉' : item.kind === 'match' ? '✧' : '•'}</span><span><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.message)}</small><em>${new Date(item.createdAt).toLocaleDateString()}</em></span></button>`).join('') : '<div class="notification-empty">No notifications yet. Start a session or connect with a match.</div>';
      list.querySelectorAll('[data-notification-id]').forEach(item => item.addEventListener('click', async () => { await api.post(`/notifications/${encodeURIComponent(item.dataset.notificationId)}/read`); item.classList.remove('unread'); loadNotifications(); }));
    } catch { center.querySelector('.notification-list').innerHTML = '<div class="notification-empty">Could not load notifications.</div>'; }
  }
  loadNotifications();
}

function setupMatchInteractions() {
  document.querySelectorAll('[data-match]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.match;
    if (action === 'connect') {
      const matchId = button.dataset.matchId;
      if (!matchId) return;
      try {
        await api.post('/connections', { matchId });
        button.innerHTML = 'Pending'; 
        button.className = 'btn-secondary btn-connect pending'; 
        button.disabled = true; 
        showToast('Connection sent', 'Your request has been sent.');
      } catch (error) { 
        showToast('Could not connect', error.message || 'Error sending request.'); 
      }
    }
    if (action === 'javascript') { showToast('Top matches loaded', 'Aarav and 7 more learners match your JavaScript skill.'); }
    if (action === 'refresh') { 
        showToast('Suggestions refreshed', 'New learner matches are available for you.'); 
        loadDashboard(); // reload the dashboard
    }
  }));
}

let allSessions = [];

function renderSessions(sessions) {
  const container = document.getElementById('sessions-container');
  const countPill = document.getElementById('sessions-count-pill');

  if (!container) return;

  if (countPill) {
    countPill.textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;
  }

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="sessions-empty">
        <div class="sessions-empty-icon">⌕</div>
        <h3>No sessions found</h3>
        <p>Try another search or filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map(session => `
    <article class="session-card ${session.status}">

      <div class="session-header">

        <div class="session-avatar">
          ${session.title.charAt(0)}
        </div>

        <div class="session-info">

          <div class="session-meta">
            <span class="session-kicker">SKILL EXCHANGE</span>

            <span class="session-status-badge ${session.status}">
              ${session.status === 'live' ? '● LIVE' : session.status === 'upcoming' ? 'UPCOMING' : session.status.toUpperCase()}
            </span>
          </div>

          <h4>${session.title}</h4>

          <p>
            <span>👤 ${session.tutor}</span>
            <span class="session-separator">•</span>
            <span>⚡ ${session.seu} SEU</span>
          </p>

        </div>

        <div class="session-time ${session.status}">
          <small>
            ${session.status === 'live' ? 'HAPPENING NOW' : session.status === 'upcoming' ? 'STARTING SOON' : 'ENDED'}
          </small>

          <strong>${session.time}</strong>
        </div>

      </div>

      <div class="session-footer">

        <span class="session-type">
          🤝 Peer learning session
        </span>

        ${(session.status === 'live' || session.status === 'upcoming') ? `
        <button type="button" class="btn-primary btn-sm" data-join-session="${escapeHTML(session.id || '')}">Join Session</button>
        ` : ''}

      </div>

    </article>
  `).join('');
}


function loadSampleSessions() {
  api.get('/sessions')
    .then(data => {
      allSessions = Array.isArray(data) ? data : (data.sessions || []);
      renderSessions(allSessions);
    })
    .catch(() => {

      allSessions = [
        {
          title: 'JavaScript Advanced',
          tutor: 'Jal Patel',
          status: 'live',
          seu: 40,
          time: 'Live now',
          skill: 'javascript'
        },
        {
          title: 'Machine Learning Basics',
          tutor: 'Smit Thakar',
          status: 'upcoming',
          seu: 60,
          time: 'Starts in 10 min',
          skill: 'ml'
        },
        {
          title: 'Spoken English Practice',
          tutor: 'You (Vandan)',
          status: 'upcoming',
          seu: 25,
          time: 'Tomorrow 5 PM',
          skill: 'english'
        }
      ];

      renderSessions(allSessions);
    });
}

function setupCreateSession() {
  const trigger = document.getElementById('create-session-btn');
  if (!trigger || document.getElementById('create-session-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'create-session-modal'; modal.className = 'create-session-modal';
  modal.innerHTML = `<div class="create-session-backdrop" data-close-session-modal></div><form class="create-session-form" id="create-session-form"><button type="button" class="create-session-close" data-close-session-modal aria-label="Close">×</button><span class="eyebrow">HOST A SESSION</span><h2>Share what you know.</h2><p>Create a learning exchange and let the right people find you.</p><label>Session title<input name="title" required maxlength="80" placeholder="e.g. JavaScript fundamentals"></label><label>Skill or topic<input name="topic" required maxlength="50" placeholder="e.g. JavaScript"></label><div class="create-session-row"><label>SEU reward<input name="seu" type="number" min="0" max="500" value="25"></label><label>When<input name="scheduledFor" type="datetime-local"></label></div><button class="btn-primary btn-full" type="submit">Create session <span>→</span></button></form>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.remove('active');
  trigger.addEventListener('click', () => modal.classList.add('active'));
  modal.querySelectorAll('[data-close-session-modal]').forEach(button => button.addEventListener('click', close));
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const currentUser = JSON.parse(localStorage.getItem('hiveUser') || 'null');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const form = event.currentTarget;
      const data = await api.post('/sessions', fields);
      allSessions.unshift(data.session); renderSessions(allSessions); close(); form.reset(); showToast('Session created', 'Your new exchange is now visible to the HIVE community.');
    } catch (error) { showToast('Could not create session', error.message); }
  });
}

document.addEventListener('click', async event => {
  const joinButton = event.target.closest('[data-join-session]');
  if (!joinButton) return;
  const currentUser = JSON.parse(localStorage.getItem('hiveUser') || 'null');
  try {
    const data = await api.post(`/sessions/${encodeURIComponent(joinButton.dataset.joinSession)}/join`);
    showToast('You are in!', data.message); setTimeout(() => { window.location.href = `room.html?session=${encodeURIComponent(data.session.id)}`; }, 450);
  } catch (error) { showToast('Could not join session', error.message); }
});

/* =========================================
   SESSION SEARCH & FILTERS
   ========================================= */

function filterSessions() {
  const searchInput = document.getElementById('session-search');

  const searchTerm = searchInput
    ? searchInput.value.trim().toLowerCase()
    : '';

  const activeButton = document.querySelector('.tab-btn.active');

  const activeFilter = activeButton
    ? activeButton.dataset.filter
    : 'all';

  const filteredSessions = allSessions.filter(session => {

    /* SEARCH */
    const matchesSearch =
      !searchTerm ||
      session.title.toLowerCase().includes(searchTerm) ||
      session.tutor.toLowerCase().includes(searchTerm) ||
      (session.skill || '').toLowerCase().includes(searchTerm);

    /* FILTER */
    let matchesFilter = true;

    if (activeFilter === 'live') {
      matchesFilter = session.status === 'live';
    }

    else if (activeFilter === 'js') {
      matchesFilter =
        (session.skill || '').toLowerCase() === 'javascript' ||
        session.title.toLowerCase().includes('javascript');
    }

    else if (activeFilter === 'ml') {
      matchesFilter =
        (session.skill || '').toLowerCase() === 'ml' ||
        session.title.toLowerCase().includes('machine learning');
    }

    else if (activeFilter === 'english') {
      matchesFilter =
        (session.skill || '').toLowerCase() === 'english' ||
        session.title.toLowerCase().includes('english');
    }

    return matchesSearch && matchesFilter;
  });

  renderSessions(filteredSessions);
}


/* FILTER BUTTONS */

document.addEventListener('click', event => {

  const button = event.target.closest('.tab-btn');

  if (!button) return;

  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.classList.remove('active');
  });

  button.classList.add('active');

  filterSessions();
});


/* SEARCH */

document.addEventListener('input', event => {

  if (event.target.id !== 'session-search') return;

  filterSessions();
});

// Spin keyframe
const style = document.createElement('style');
style.textContent = '@keyframes spin{to{transform:rotate(360deg)}} .toast{position:fixed;bottom:28px;right:28px;background:#0d1120;border:1px solid rgba(74,158,255,.3);border-radius:14px;padding:16px 22px;color:#e8eaf0;display:flex;align-items:center;gap:12px;transform:translateX(400px);transition:transform .4s;} .toast.show{transform:translateX(0);}';
document.head.appendChild(style);
// Skill progress chart
function initChart() {
  const canvas = document.getElementById('skillChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const skills = ['JavaScript', 'Python', 'ML', 'UI/UX', 'English'];
  const progress = [85, 72, 65, 58, 90];
  const maxWidth = 240;
  const barHeight = 24;
  const padding = 40;
  
  ctx.fillStyle = 'rgba(13,17,32,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  skills.forEach((skill, i) => {
    const x = padding;
    const y = padding + i * 32;
    const barWidth = (progress[i] / 100) * maxWidth;
    
    // Background bar
    ctx.fillStyle = 'rgba(148,163,184,0.3)';
    ctx.fillRect(x, y + 4, maxWidth, barHeight);
    
    // Progress bar
    const grad = ctx.createLinearGradient(x, y, x + barWidth, y);
    grad.addColorStop(0, '#4A9EFF');
    grad.addColorStop(1, '#7B6FFF');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y + 4, barWidth, barHeight);
    
    // Label
    ctx.fillStyle = '#e8eaf0';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(skill, x + 8, y + 16);
    
    // Progress text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(progress[i] + '%', x + maxWidth - 8, y + 16);
  });
}

// Initialize chart when page loads
if (document.getElementById('skillChart')) {
  initChart();
}
async function handleSignOut() {
  try {
    await api.post('/auth/logout', {});
  } catch(e) {
    // Ignore error on logout
  }
  localStorage.removeItem('token');
  localStorage.removeItem('hiveUser');

  showToast(
    'Signed out',
    'You have been successfully signed out of HIVE.'
  );

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 500);
}
Object.assign(window, {
  showAuth,
  closeAuth,
  closeAuthDirect,
  togglePwd,
  checkStrength,
  showToast,
  handleLogin,
  handleSignup,
  handleSignOut
});
/* =========================================
   Admin User Table Filtering
   ========================================= */
function bindAdminFilters() {
  const filterTabs = document.querySelectorAll('.admin-filter-tab');
  const searchInput = document.getElementById('admin-user-search');

  function applyFilters() {
    const rows = document.querySelectorAll('.admin-table tbody tr');
    const activeTab = document.querySelector('.admin-filter-tab.active');
    const filterType = activeTab ? activeTab.dataset.filter : 'all';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    rows.forEach(row => {
      const roleText = (row.children[1] ? row.children[1].textContent : '').toLowerCase();
      const statusText = (row.children[3] ? row.children[3].textContent : '').toLowerCase();
      const nameText = (row.children[0] ? row.children[0].textContent : '').toLowerCase();

      let matchesFilter = true;
      if (filterType === 'tutor') matchesFilter = roleText.includes('tutor');
      else if (filterType === 'learner') matchesFilter = roleText.includes('learner');
      else if (filterType === 'suspended') matchesFilter = statusText.includes('suspended');

      const matchesSearch = !searchTerm || nameText.includes(searchTerm);

      row.style.display = (matchesFilter && matchesSearch) ? '' : 'none';
    });
  }

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
}

/* =========================================
   HIVE DASHBOARD API INTEGRATION
   ========================================= */

async function loadDashboardData() {
    const dashboardPage =
    window.location.pathname.endsWith('dashboard.html');

    if (!dashboardPage) return;

    try {
        const data = await api.get('/dashboard');
        console.log('HIVE Dashboard data:', data);

        updateDashboard(data);

    } catch (error) {
        console.error('Dashboard loading error:', error);

        showToast(
            'Dashboard error',
            'Could not load the latest HIVE data.'
        );
    }
}


/* -----------------------------------------
   Update dashboard
   ----------------------------------------- */

function updateDashboard(data) {

  const user = data.user || {};
  const stats = data.stats || {};
  const sessions = data.sessions || [];
  const matches = data.matches || [];

  /* USER */

  const userName = user.name || 'HIVE User';

  document.querySelectorAll('.user-name').forEach(el => {
    el.textContent = userName;
  });

  document.querySelectorAll('.user-avatar').forEach(el => {
    const initials = getInitials(userName);
    el.textContent = initials;
  });

  const headerTitle = document.querySelector('.page-header h1');

  if (headerTitle) {
    const hour = new Date().getHours();

    let greeting = 'Good evening';

    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 18) {
      greeting = 'Good afternoon';
    }

    headerTitle.textContent = `${greeting}, ${userName}`;
  }


  /* USER ROLE */

  const roleElement = document.querySelector('.user-role');

  if (roleElement && user.role) {
    roleElement.textContent =
      user.role === 'learner'
        ? 'Learner'
        : user.role;
  }


  /* SEU */

  const seu = user.seu ?? 0;

  document.querySelectorAll('.seu-badge').forEach(el => {
    el.textContent = `${seu} SEU`;
  });

  const seuValue = document.querySelector('.seu-val');

  if (seuValue) {
    seuValue.textContent = seu;
  }


  /* STATS */

  updateDashboardStats(stats);


  /* SESSIONS */

  updateDashboardSessions(sessions);


  /* MATCHES */

  updateDashboardMatches(matches, data.connections || []);

  /* NOTIFICATIONS */
  loadDashboardNotifications();
}

async function loadDashboardNotifications() {
  const container = document.getElementById('dashboard-recent-notifications');
  if (!container) return;

  try {
    const res = await api.get('/notifications');
    const notifications = res.notifications || [];
    if (notifications.length === 0) {
      container.innerHTML = '<div class="empty-note" style="padding: 1rem; color: var(--muted); text-align: center;">No new notifications.</div>';
      return;
    }

    container.innerHTML = notifications.slice(0, 3).map(notif => `
      <div class="session-item" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);">
        <div class="session-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">H</div>
        <div class="session-info" style="flex:1;">
          <div class="session-name" style="font-weight:600;font-size:14px;color:#fff;">${escapeHTML(notif.title || 'System Notification')}</div>
          <div class="session-skill" style="font-size:12px;color:var(--muted);">${escapeHTML(notif.message || '')}</div>
        </div>
      </div>
    `).join('');
  } catch(err) {
    console.error('Failed to load notifications', err);
    container.innerHTML = '<div class="empty-note" style="color:#ef4444;">Failed to load notifications.</div>';
  }
}


/* -----------------------------------------
   Statistics
   ----------------------------------------- */

function updateDashboardStats(stats) {

  const cards = document.querySelectorAll('.react-stats-grid .stats-card');

  if (!cards.length) return;

  const values = [
    stats.sessions,
    stats.rating,
    stats.seu,
    stats.skills
  ];

  cards.forEach((card, index) => {

    if (values[index] !== undefined) {

      const valueElement =
        card.querySelector('.stats-value');

      if (valueElement) {
        valueElement.textContent = values[index];
      }

    }

  });
}


/* -----------------------------------------
   Sessions
   ----------------------------------------- */

function updateDashboardSessions(sessions) {
  const container = document.getElementById('upcoming-sessions-container');
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = '<div class="sessions-empty" style="padding: 1rem; color: var(--muted); text-align: center;">No upcoming sessions found.</div>';
    return;
  }

  container.innerHTML = sessions.slice(0, 3).map(session => `
    <div class="session-item">
      <div class="session-avatar">${(session.title || 'S').substring(0, 2).toUpperCase()}</div>
      <div class="session-info">
        <div class="session-name">${escapeHTML(session.title)}</div>
        <div class="session-skill">Tutor: ${escapeHTML(session.tutor)} · SEU ${session.seu || 0}</div>
      </div>
      <div class="session-meta">
        <div class="session-time">${escapeHTML(session.time || 'Upcoming')}</div>
        <span class="tag ${session.status === 'live' ? 'tag-live' : 'tag-soon'}">${session.status === 'live' ? 'LIVE' : 'Upcoming'}</span>
      </div>
    </div>
  `).join('');
}


/* -----------------------------------------
   Matches
   ----------------------------------------- */

function updateDashboardMatches(matches, connections = []) {
  const matchStack = document.getElementById('match-stack');
  if (!matchStack || !matches.length) {
    if (matchStack) matchStack.innerHTML = '<div style="color: var(--muted); padding: 1rem;">No matching learners found. Try adding more skills.</div>';
    return;
  }

  matchStack.innerHTML = '';

  // Limit to 3 matches max for desktop grid
  matches.slice(0, 3).forEach((match, index) => {
    const article = document.createElement('article');
    article.className = 'match-profile';
    const initials = match.initials || getInitials(match.name || 'HIVE User');
    
    // Only display real ratings or "New member"
    let ratingHtml = '';
    if (match.rating && match.review_count) {
       ratingHtml = `<div class="match-rating-row"><span class="star">★</span> ${Number(match.rating).toFixed(1)} · ${match.review_count} reviews</div>`;
    } else {
       ratingHtml = `<div class="match-rating-row">New member</div>`;
    }
    
    // show at most 3 reasons
    const reasons = (match.reasons || []).slice(0, 3);
    const reasonsList = reasons.map(r => `<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px;"><polyline points="20 6 9 17 4 12"></polyline></svg> ${escapeHTML(r)}</li>`).join('');
    
    const conn = connections.find(c => c.matchId === match.id);
    let connectBtnHtml = '';
    if (!conn) {
       connectBtnHtml = `<button type="button" class="btn-secondary btn-connect" data-match="connect" data-match-id="${escapeHTML(match.id || '')}">Connect</button>`;
    } else if (conn.status === 'pending') {
       connectBtnHtml = `<button type="button" class="btn-secondary btn-connect pending" disabled>Pending</button>`;
    } else if (conn.status === 'connected' || conn.status === 'accepted') {
       connectBtnHtml = `<button type="button" class="btn-secondary btn-connect connected" onclick="window.location.href='messages.html?conn=${conn.id}'">Message</button>`;
    } else {
       connectBtnHtml = `<button type="button" class="btn-secondary btn-connect" data-match="connect" data-match-id="${escapeHTML(match.id || '')}">Connect</button>`;
    }

    article.innerHTML = `
      <div class="match-card-header">
        <div class="match-card-user">
          <div class="match-avatar">${initials}</div>
          <div class="match-user-details">
            <a href="profile.html?id=${escapeHTML(match.id)}" class="match-user-name">${escapeHTML(match.name || 'HIVE Member')}</a>
            <div class="match-percent-badge">${match.matchPercentage ?? 0}% Match</div>
          </div>
        </div>
      </div>
      ${ratingHtml}
      
      <ul class="match-reasons-list">
         ${reasonsList}
      </ul>
      
      <div class="match-card-footer">
        ${connectBtnHtml}
      </div>
    `;
    matchStack.appendChild(article);
  });
  
  setupMatchInteractions();
}


/* -----------------------------------------
   Initials
   ----------------------------------------- */

function getInitials(name) {

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();
}


/* -----------------------------------------
   Basic HTML escaping
   ----------------------------------------- */

function escapeHTML(value) {

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


/* -----------------------------------------
   Start dashboard
   ----------------------------------------- */

document.addEventListener(
  'DOMContentLoaded',
  loadDashboardData
);
/* =========================================
   MY SKILLS
   ========================================= */

let hiveSkills = [];


function openSkillModal() {

    const modal = document.getElementById('skill-modal');

    if (modal) {
        modal.classList.add('active');
    }

}


function closeSkillModal() {

    const modal = document.getElementById('skill-modal');

    if (modal) {
        modal.classList.remove('active');
    }

}


async function loadSkills() {
    if (!window.location.pathname.endsWith('skills.html')) {
        return;
    }

    try {
        const data = await api.get('/skills');
        hiveSkills = data.skills || [];
        renderSkills();
    } catch (error) {
        console.error('Skills loading error:', error);
        showToast(
            'Skills error',
            error.message || 'Unable to load your skills.'
        );
    }
}


function renderSkills() {

    const teachContainer =
        document.getElementById('teach-skills');

    const learnContainer =
        document.getElementById('learn-skills');

    const teachCount =
        document.getElementById('teach-count');

    const learnCount =
        document.getElementById('learn-count');


    if (!teachContainer || !learnContainer) {
        return;
    }


    const teachingSkills =
        hiveSkills.filter(
            skill => skill.type === 'teach'
        );


    const learningSkills =
        hiveSkills.filter(
            skill => skill.type === 'learn'
        );


    teachCount.textContent =
        teachingSkills.length;


    learnCount.textContent =
        learningSkills.length;


    teachContainer.innerHTML =
        renderSkillItems(
            teachingSkills,
            'teach'
        );


    learnContainer.innerHTML =
        renderSkillItems(
            learningSkills,
            'learn'
        );

}


function renderSkillItems(skills, type) {

    if (!skills.length) {
        return `
            <div class="empty-skill-state">
                <div class="empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                </div>
                <h3>No ${type === 'teach' ? 'teaching' : 'learning'} skills yet</h3>
                <p>Add a skill you ${type === 'teach' ? 'can teach to start finding better HIVE matches' : 'want to learn to find someone who can teach you'}.</p>
                <button type="button" class="btn-primary" onclick="openSkillModal()">+ Add skill</button>
            </div>
        `;
    }

    return skills.map(skill => {
        const lvls = ['beginner', 'intermediate', 'advanced', 'expert'];
        const lvlIdx = lvls.indexOf(String(skill.level || 'beginner').toLowerCase());
        const activeCount = lvlIdx >= 0 ? lvlIdx + 1 : 1;
        const dots = [1,2,3,4].map(i => `<div class="skill-dot ${i <= activeCount ? 'active' : ''}"></div>`).join('');

        return `
        <div class="skill-item">
            <div class="skill-icon">
                ${getSkillInitial(skill.name)}
            </div>
            <div class="skill-details">
                <strong>${escapeHTML(skill.name)}</strong>
                <div class="skill-level-indicator">
                    <div class="skill-dots">${dots}</div>
                    <span>${formatSkillLevel(skill.level)}</span>
                </div>
            </div>
            <div class="skill-actions">
              <button type="button" class="skill-action-btn" data-skill-edit="${escapeHTML(skill.id)}" data-skill-name="${escapeHTML(skill.name)}" data-skill-level="${escapeHTML(skill.level || 'beginner')}" aria-label="Edit ${escapeHTML(skill.name)}">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                 Edit
              </button>
              <button type="button" class="skill-action-btn danger" data-skill-delete="${escapeHTML(skill.id)}" data-skill-name="${escapeHTML(skill.name)}" aria-label="Delete ${escapeHTML(skill.name)}">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                 Delete
              </button>
            </div>
        </div>
        `;
    }).join('');

}
          

function openSkillEditModal(skillId, skillName, currentLevel) {
    let modal = document.getElementById('skill-edit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'skill-edit-modal';
        modal.className = 'skill-modal';
        modal.innerHTML = `<div class="skill-modal-backdrop" data-close-skill-edit></div>
        <div class="skill-modal-box">
            <div class="skill-modal-header">
                <div>
                    <h2>EDIT SKILL</h2>
                    <p>Update your proficiency level</p>
                </div>
                <button type="button" class="skill-modal-close" data-close-skill-edit aria-label="Close">×</button>
            </div>
            
            <div class="skill-context-block">
                <div class="skill-context-name" data-edit-skill-name></div>
                <div class="skill-context-level">Current level: <span data-edit-current-level></span></div>
            </div>

            <form id="skill-edit-form">
                <label>Skill level</label>
                <div class="select-wrapper">
                    <select id="skill-edit-level">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                    </select>
                    <svg class="select-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="skill-modal-actions">
                    <button type="button" class="text-button" data-close-skill-edit>Cancel</button>
                    <button type="submit" class="btn-primary">Save changes</button>
                </div>
            </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelectorAll('[data-close-skill-edit]').forEach(button => button.addEventListener('click', () => modal.classList.remove('active')));
    }
    modal.querySelector('[data-edit-skill-name]').textContent = skillName;
    modal.querySelector('#skill-edit-level').value = currentLevel;
    modal.classList.add('active');
    const form = modal.querySelector('#skill-edit-form');
    form.onsubmit = async event => {
        event.preventDefault();
        try {
            const level = modal.querySelector('#skill-edit-level').value;
            const data = await api.put(`/skills/${encodeURIComponent(skillId)}`, { level });
            hiveSkills = data.skills || hiveSkills;
            renderSkills();
            modal.classList.remove('active');
            showToast('Skill updated', `${skillName} is now ${level}.`);
        } catch (error) {
            showToast('Could not update skill', error.message || 'Unable to update this skill.');
        }
    };
}


function getSkillInitial(name) {

    return String(name || 'S')
        .trim()
        .charAt(0)
        .toUpperCase();

}


function formatSkillLevel(lvl) {
    const l = String(lvl||'').toLowerCase();
    if(l==='beginner') return 'Beginner';
    if(l==='intermediate') return 'Intermediate';
    if(l==='advanced') return 'Advanced';
    if(l==='expert') return 'Expert';
    return lvl;
}


async function handleAddSkill(e) {

    e.preventDefault();


    const currentUser = JSON.parse(
        localStorage.getItem('hiveUser') || 'null'
    );


    if (!currentUser?.email) {

        showToast(
            'Not signed in',
            'Please sign in again.'
        );

        return;
    }


    const name =
        document.getElementById('skill-name')
            ?.value.trim();


    const type =
        document.querySelector(
            'input[name="skill-type"]:checked'
        )?.value;


    const level =
        document.getElementById('skill-level')
            ?.value;


    if (!name || !type || !level) {

        showToast(
            'Missing information',
            'Please complete all skill fields.'
        );

        return;
    }


    try {
        const data = await api.post('/skills', { name, type, level });


        hiveSkills =
            data.skills || hiveSkills;


        renderSkills();

        closeSkillModal();


        document.getElementById('skill-form')
            ?.reset();


        showToast(
            'Skill added',
            `${name} has been added to your HIVE profile.`
        );


    } catch (error) {

        console.error(
            'Add skill error:',
            error
        );


        showToast(
            'Could not add skill',
            error.message ||
            'Unable to add this skill.'
        );

    }

}


document.addEventListener(
    'DOMContentLoaded',
    () => {

        const skillForm =
            document.getElementById('skill-form');


        if (skillForm) {

            skillForm.addEventListener(
                'submit',
                handleAddSkill
            );

        }


        loadSkills();

    }
);

document.addEventListener('click', async event => {
    const editButton = event.target.closest('[data-skill-edit]');
    const deleteButton = event.target.closest('[data-skill-delete]');
    if (!editButton && !deleteButton) return;

    if (editButton) {
        openSkillEditModal(editButton.dataset.skillEdit, editButton.dataset.skillName, editButton.dataset.skillLevel);
        return;
    }

    if (!window.confirm(`Delete ${deleteButton.dataset.skillName}?`)) return;
    try {
        const data = await api.delete(`/skills/${encodeURIComponent(deleteButton.dataset.skillDelete)}`);
        hiveSkills = data.skills || hiveSkills;
        renderSkills();
        showToast('Skill deleted', `${deleteButton.dataset.skillName} was removed.`);
    } catch (error) {
        showToast('Could not delete skill', error.message || 'Unable to delete this skill.');
    }
});


Object.assign(window, {

    openSkillModal,
    closeSkillModal,
    handleAddSkill

});

/* =========================================
   ADMIN API INTEGRATION
   ========================================= */

async function initAdminPages() {
  const path = window.location.pathname;
  if (path.endsWith('admin.html')) {
    await loadAdminStats();
  } else if (path.endsWith('admin-users.html')) {
    await loadAdminUsers();
  } else if (path.endsWith('admin-sessions.html')) {
    await loadAdminSessions();
  }
}

async function loadAdminStats() {
  try {
    const stats = await api.get('/admin/stats');
    const uEl = document.getElementById('admin-total-users');
    const sEl = document.getElementById('admin-total-sessions');
    const skEl = document.getElementById('admin-total-skills');
    const aEl = document.getElementById('admin-active-sessions');
    if (uEl) uEl.textContent = stats.totalUsers;
    if (sEl) sEl.textContent = stats.totalSessions;
    if (skEl) skEl.textContent = stats.totalSkills;
    if (aEl) aEl.textContent = stats.activeSessions;

    const recentUsersEl = document.getElementById('admin-recent-registrations');
    if (recentUsersEl) {
      try {
        const usersResp = await api.get('/admin/users');
        const recentUsers = (usersResp.users || []).slice(-3).reverse();
        if (recentUsers.length === 0) {
          recentUsersEl.innerHTML = '<div class="empty-note">No recent registrations.</div>';
        } else {
          recentUsersEl.innerHTML = recentUsers.map(u => `
            <div class="session-item" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);">
              <div class="session-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">${u.name.substring(0,2).toUpperCase()}</div>
              <div class="session-info" style="flex:1;">
                <div class="session-name" style="font-weight:600;font-size:14px;color:#fff;">${u.name}</div>
                <div class="session-skill" style="font-size:12px;color:var(--muted);">${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</div>
              </div>
            </div>
          `).join('');
        }
      } catch (err) {
        console.error('Failed to load recent users:', err);
        recentUsersEl.innerHTML = '<div class="empty-note" style="color:#ef4444;">Failed to load users</div>';
      }
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
    showToast('Error', 'Failed to load admin stats');
  }
}

async function loadAdminUsers() {
  try {
    const response = await api.get('/admin/users');
    const users = response.users || [];
    const tbody = document.querySelector('.admin-table tbody');
    if (!tbody) return;
    
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No users found</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div class="admin-user-cell">
            <div class="admin-user-cell-avatar">${u.name.substring(0,2).toUpperCase()}</div>
            <div class="admin-user-cell-info">
              <div class="admin-user-cell-name">${u.name}</div>
              <div class="admin-user-cell-email">${u.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="admin-badge ${u.role}">${u.role}</span>
        </td>
        <td>
          ${u.seu || 0} SEU
        </td>
        <td>
          <span class="admin-badge ${u.status === 'suspended' ? 'suspended' : 'active'}">${u.status}</span>
        </td>
        <td>
          <div class="admin-actions">
            <button class="admin-action-btn toggle-suspend-btn" aria-label="${u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}" data-id="${u.id}" data-status="${u.status}" title="${u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${u.status === 'suspended' 
                  ? '<path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38l-2.68 2.68"/>' 
                  : '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'}
              </svg>
            </button>
            <button class="admin-action-btn danger delete-user-btn" aria-label="Delete User" data-id="${u.id}" title="Delete User">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    // Attach events
    document.querySelectorAll('.toggle-suspend-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const status = e.currentTarget.dataset.status;
        try {
          await api.put(`/admin/users/${id}/suspend`, { suspend: status !== 'suspended' });
          loadAdminUsers();
          showToast('Success', `User ${status !== 'suspended' ? 'suspended' : 'unsuspended'} successfully.`);
        } catch (err) {
          showToast('Error', err.message);
        }
      });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        const id = e.currentTarget.dataset.id;
        try {
          await api.delete(`/admin/users/${id}`);
          loadAdminUsers();
          showToast('Success', 'User deleted successfully.');
        } catch (err) {
          showToast('Error', err.message);
        }
      });
    });

    // Bind filter tabs and search after rows are rendered
    bindAdminFilters();

  } catch (err) {
    console.error('Failed to load admin users:', err);
    showToast('Error', 'Failed to load users');
  }
}

async function loadAdminSessions() {
  try {
    const response = await api.get('/admin/sessions');
    const sessions = response.sessions || [];
    
    // Check if we are on the admin-sessions page which has a different table structure for ALL LIVE SESSIONS
    const tableBody = document.getElementById('admin-sessions-tbody') || document.querySelector('.admin-table tbody');
    if (tableBody) {
      if (sessions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">No sessions found</td></tr>`;
        return;
      }
        tableBody.innerHTML = sessions.map(s => `
        <tr>
          <td><span style="font-family: monospace; color: #888;">#${s.id.substring(0,8)}</span></td>
          <td style="color: #fff; font-weight: 500;">${s.topic}</td>
          <td>${s.time || 'N/A'}</td>
          <td><span class="admin-badge ${s.status}">${s.status}</span></td>
          <td>
             <div class="admin-actions">
               <button class="admin-action-btn spectate-btn" data-id="${s.id}" title="Spectate Session">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
               </button>
             </div>
          </td>
        </tr>
      `).join('');
      
      document.querySelectorAll('.spectate-btn').forEach(btn => {
         btn.addEventListener('click', (e) => {
            window.location.href = `room.html?id=${e.currentTarget.dataset.id}`;
         });
      });
    }
  } catch (err) {
    console.error('Failed to load admin sessions:', err);
    showToast('Error', 'Failed to load sessions');
  }
}

document.addEventListener('DOMContentLoaded', initAdminPages);

Object.assign(window, {
  loadAdminUsers,
  loadAdminSessions,
  loadAdminStats
});


function openDeleteModal(skillId, skillName) {
    let modal = document.getElementById('skill-delete-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'skill-delete-modal';
        modal.className = 'skill-modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="skill-modal-backdrop" data-close-skill-delete></div>
        <div class="skill-modal-box">
            <div class="skill-modal-header">
                <div>
                    <h2>Delete skill?</h2>
                </div>
                <button type="button" class="skill-modal-close" data-close-skill-delete aria-label="Close">×</button>
            </div>
            <div class="modal-body-text">
                <p>Are you sure you want to remove <strong>"${escapeHTML(skillName)}"</strong> from your skills?</p>
                <p style="color:var(--muted); font-size:14px; margin-top:8px;">This action cannot be undone.</p>
            </div>
            <div class="skill-modal-actions" style="margin-top: 32px;">
                <button type="button" class="text-button" data-close-skill-delete>Cancel</button>
                <button type="button" class="btn-primary danger-bg" id="confirm-delete-btn" data-skill-id="${escapeHTML(skillId)}">Delete skill</button>
            </div>
        </div>`;
    
    modal.classList.add('active');
    
    modal.querySelectorAll('[data-close-skill-delete]').forEach(btn => {
        btn.onclick = () => modal.classList.remove('active');
    });
    
    document.getElementById('confirm-delete-btn').onclick = async function() {
        const id = this.dataset.skillId;
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Deleting...';
        try {
            await api.delete('/skills/' + id);
            hiveSkills = hiveSkills.filter(s => s.id !== id);
            renderSkills();
            showToast('Skill deleted', `The skill was removed.`);
            modal.classList.remove('active');
        } catch (error) {
            showToast('Could not delete skill', error.message || 'Unable to delete this skill.');
            btn.disabled = false;
            btn.textContent = 'Delete skill';
        }
    };
}

// --- Navigation Badges ---
async function loadNavBadges() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const connRes = await fetch('/api/connections', { headers: { 'Authorization': 'Bearer ' + token } });
        if (connRes.ok) {
            const data = await connRes.json();
            const pending = (data.connections || []).filter(c => c.status === 'pending' && c.isIncoming).length;
            const badge = document.getElementById('badge-nav-connections');
            if (badge) {
                badge.innerText = pending;
                badge.style.display = pending > 0 ? 'inline-flex' : 'none';
            }
        }
        
        const msgRes = await fetch('/api/conversations', { headers: { 'Authorization': 'Bearer ' + token } });
        if (msgRes.ok) {
            const data = await msgRes.json();
            const unread = (data.conversations || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
            const badge = document.getElementById('badge-nav-messages');
            if (badge) {
                badge.innerText = unread;
                badge.style.display = unread > 0 ? 'inline-flex' : 'none';
            }
        }
    } catch(e) {
        console.error('Could not load nav badges', e);
    }
}
document.addEventListener('DOMContentLoaded', loadNavBadges);
