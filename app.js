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
function handleLogin(e) {
  e.preventDefault();
  
  // Grab the email the user typed in
  const emailInput = e.target.querySelector('input[type="email"]');
  const email = emailInput ? emailInput.value : '';

  const btn = e.target.querySelector('button[type=submit]');
  const btnText = btn.querySelector('span');
  const btnLoader = '<span class="btn-loader" style="display:inline-block;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;"></span>';
  
  // Show loading animation on the button
  btnText.style.display = 'none';
  btn.innerHTML = btnLoader;
  
  showToast('Welcome back!', 'Verifying credentials…');
  
  fetch('http://localhost:3001/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(result => { localStorage.setItem('hiveUser', JSON.stringify(result.user)); window.location.href = email === 'admin@hive.com' ? 'admin.html' : 'dashboard.html'; })
    .catch(() => { showToast('API unavailable', 'Start npm run server, then try again.'); btn.innerHTML = '<span>Sign In</span>'; });
}

function handleSignup(e) {
  e.preventDefault();
  showToast('Account created', 'Welcome to HIVE. Your workspace is ready.');
  setTimeout(() => window.location.href = 'dashboard.html', 700);
}

// Navbar scroll
window.addEventListener('scroll', () => {
  const nb = document.getElementById('navbar');
  if (nb) nb.style.background = window.scrollY > 10 ? 'rgba(5,8,15,.95)' : 'rgba(5,8,15,.7)';
});
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.endsWith('sessions.html')) {
    loadSampleSessions();
  }
  setupCommandPalette();
  setupMatchInteractions();
});

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

function setupMatchInteractions() {
  document.querySelectorAll('[data-match]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.match;
    if (action === 'connect') {
      fetch('http://localhost:3001/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId: 'aarav' }) })
        .then(response => response.ok ? response.json() : response.json().then(error => Promise.reject(error)))
        .then(() => { button.textContent = '✓'; button.classList.add('connected'); showToast('Connection sent', 'Aarav can now accept your exchange request.'); })
        .catch(error => showToast('Could not connect', error.error || 'Start the HIVE API and try again.'));
    }
    if (action === 'javascript') { showToast('Top matches loaded', 'Aarav and 7 more learners match your JavaScript skill.'); document.getElementById('match-stack')?.classList.add('is-active'); }
    if (action === 'refresh') { showToast('Suggestions refreshed', 'New learner matches are available for you.'); document.getElementById('match-stack')?.classList.toggle('is-active'); }
  }));
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions-container');
  if (!container) return;

  // Notice we changed the <button> into an <a> tag styled like a button!
  container.innerHTML = sessions.map(session => `
    <div class="session-card">
      <div class="session-header">
        <div class="session-avatar">${session.title.charAt(0)}</div>
        <div class="session-info">
          <h4>${session.title}</h4>
          <p>${session.tutor} • ${session.seu} SEU</p>
        </div>
        <div class="session-status ${session.status}">
          <span class="status-dot ${session.status}"></span>
          <span>${session.time}</span>
        </div>
      </div>
      <a href="room.html" class="btn-primary btn-sm" style="text-decoration: none; width: fit-content;">
        Join Session
      </a>
    </div>
  `).join('');

  showToast('Sessions loaded!', `${sessions.length} active/upcoming sessions`);
}

function loadSampleSessions() {
  fetch('http://localhost:3001/api/sessions')
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(renderSessions)
    .catch(() => renderSessions([
      { title: 'JavaScript Advanced', tutor: 'Jal Patel', status: 'live', seu: 40, time: 'Live now' },
      { title: 'Machine Learning Basics', tutor: 'Smit Thakar', status: 'upcoming', seu: 60, time: 'Starts in 10 min' },
      { title: 'Spoken English Practice', tutor: 'You (Vandan)', status: 'upcoming', seu: 25, time: 'Tomorrow 5 PM' }
    ]));
}


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

Object.assign(window, { showAuth, closeAuth, closeAuthDirect, togglePwd, checkStrength, showToast, handleLogin, handleSignup });
/* =========================================
   Admin User Table Filtering
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
  const filterTabs = document.querySelectorAll('.filter-tabs .tab-btn');
  const userRows = document.querySelectorAll('.admin-table tbody tr');

  if (filterTabs.length > 0 && userRows.length > 0) {
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        
        // 1. Remove active class from all tabs, add to clicked
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // 2. Get the text of the tab (e.g., "Tutors")
        const filterType = tab.textContent.trim().toLowerCase();

        // 3. Loop through rows and show/hide based on content
        userRows.forEach(row => {
          // Grab the text from the Role column (index 1) and Status column (index 3)
          const roleText = row.children[1].textContent.toLowerCase();
          const statusText = row.children[3].textContent.toLowerCase();

          if (filterType === 'all users') {
            row.style.display = '';
          } else if (filterType === 'tutors' && roleText.includes('tutor')) {
            row.style.display = '';
          } else if (filterType === 'learners' && roleText === 'learner') {
            // Strict match for learner so "Learner · Tutor" doesn't show up here
            row.style.display = '';
          } else if (filterType === 'suspended' && statusText.includes('suspended')) {
            row.style.display = '';
          } else {
            row.style.display = 'none'; // Hide row if it doesn't match
          }
        });
      });
    });
  }
});
