
const VitalConnect = (() => {
  // Inline SVG logo — avoids GitHub Pages MIME/CORS issues with <img src=".svg">
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 120" role="img" aria-label="VitalConnect logo" style="width:180px;height:auto;display:block"><defs><linearGradient id="vcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f4c81"/><stop offset="100%" stop-color="#c9a227"/></linearGradient></defs><rect width="420" height="120" rx="18" fill="#ffffff"/><g transform="translate(18,20)"><circle cx="36" cy="40" r="26" fill="none" stroke="url(#vcg)" stroke-width="8"/><circle cx="78" cy="40" r="26" fill="none" stroke="#0f4c81" stroke-width="8" opacity="0.85"/><path d="M8 40h18l10-16 14 34 14-26 10 8h24" fill="none" stroke="#c9a227" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g><text x="128" y="54" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" fill="#0f4c81">Vital<tspan fill="#c9a227">Connect</tspan></text><text x="130" y="82" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="2" fill="#4b5563">COMMUNITY WELLNESS PLATFORM</text></svg>`;

  const STORE = {
    users: 'vc_users',
    session: 'vc_session',
    prayers: 'vc_prayers',
    blessings: 'vc_blessings',
    helpRequests: 'vc_help_requests',
    moods: 'vc_moods'
  };

  const seedData = {
    [STORE.users]: [
      { id: 1, name: 'Demo User', email: 'demo@vitalconnect.com', password: 'Password123!', role: 'member', city: 'Indianapolis', state: 'IN', bio: 'Community member using VitalConnect for wellness support.' },
      { id: 2, name: 'Admin User', email: 'admin@vitalconnect.com', password: 'Admin123!', role: 'admin', city: 'Lafayette', state: 'IN', bio: 'Platform administrator.' }
    ],
    [STORE.prayers]: [
      { id: 1, title: 'Prayer for guidance', content: 'Please pray for wisdom and direction as I balance school, work, and family responsibilities.', authorEmail: 'demo@vitalconnect.com', authorName: 'Demo User', createdAt: '2026-03-01T12:00:00' }
    ],
    [STORE.blessings]: [
      { id: 1, title: "Children's books bundle", description: "A clean set of children's books available for pickup.", category: 'Items', location: 'Community Hub', image: '', authorEmail: 'demo@vitalconnect.com', authorName: 'Demo User', createdAt: '2026-03-02T09:00:00' }
    ],
    [STORE.helpRequests]: [
      { id: 1, title: 'Need grocery transportation', description: 'Looking for a ride to the grocery store this Saturday morning.', urgency: 'Medium', authorEmail: 'demo@vitalconnect.com', authorName: 'Demo User', createdAt: '2026-03-03T14:30:00' }
    ],
    [STORE.moods]: [
      { id: 1, mood: 'Hopeful', notes: 'Feeling optimistic about this week.', authorEmail: 'demo@vitalconnect.com', authorName: 'Demo User', createdAt: '2026-03-04T08:00:00' }
    ]
  };

  const protectedPages = ['dashboard.html','mood-check.html','mood-history.html','prayer-wall.html','blessing-marketplace.html','help-board.html','my-posts.html','profile.html'];
  const pathName = () => window.location.pathname.split('/').pop() || 'index.html';
  const formatDate = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  function ensureSeeds() {
    for (const key of Object.keys(seedData)) {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(seedData[key]));
      }
    }
  }

  const getCollection = key => JSON.parse(localStorage.getItem(key) || '[]');
  const setCollection = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const getSession = () => JSON.parse(localStorage.getItem(STORE.session) || 'null');
  const setSession = user => localStorage.setItem(STORE.session, JSON.stringify({ email: user.email, name: user.name, role: user.role || 'member', loggedInAt: new Date().toISOString() }));
  const logout = () => { localStorage.removeItem(STORE.session); window.location.href = 'login.html'; };

  function requireAuth() {
    if (protectedPages.includes(pathName()) && !getSession()) window.location.href = 'login.html';
  }

  const nextId = items => items.length ? Math.max(...items.map(item => Number(item.id) || 0)) + 1 : 1;
  const createNotice = (message, type = 'info') => `<div class="notice ${type}">${message}</div>`;

  function renderShell() {
    const current = pathName();
    const session = getSession();
    const appHeader = document.querySelector('#app-header');
    const appFooter = document.querySelector('#app-footer');

    if (appHeader) {
      const authButtons = session
        ? `<a class="btn-ghost" href="dashboard.html">Dashboard</a><button class="btn" id="logoutBtn" type="button">Logout</button>`
        : `<a class="btn-ghost" href="login.html">Login</a><a class="btn" href="register.html">Get Started</a>`;
      appHeader.innerHTML = `<a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="container navbar"><a class="brand" href="index.html" aria-label="VitalConnect home">${LOGO_SVG}</a><nav class="nav-links" aria-label="Primary navigation">${[['index.html','Home'],['about.html','About'],['dashboard.html','Dashboard'],['prayer-wall.html','Prayer Wall'],['blessing-marketplace.html','Marketplace'],['help-board.html','Help Board'],['contact.html','Contact']].map(([href,label]) => `<a href="${href}" class="${current===href?'active':''}">${label}</a>`).join('')}</nav><div class="nav-actions">${authButtons}</div></div></header>`;
    }
    if (appFooter) {
      appFooter.innerHTML = `<footer class="site-footer"><div class="container footer-grid"><div>${LOGO_SVG}<p class="mini">VitalConnect is a capstone-ready community wellness platform designed for static hosting using HTML, CSS, JavaScript, and LocalStorage.</p></div><div><h3>Explore</h3><p class="mini"><a href="dashboard.html">Dashboard</a><br><a href="mood-check.html">Mood Check</a><br><a href="my-posts.html">My Posts</a></p></div><div><h3>Support</h3><p class="mini"><a href="contact.html">Contact</a><br><a href="about.html">About VitalConnect</a><br><a href="policies.html">Policies</a></p></div></div></footer>`;
    }
    const logoutBtn = document.querySelector('#logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  const dashboardSidebar = (activeHref = 'dashboard.html') => `<aside class="sidebar"><a href="dashboard.html" class="${activeHref==='dashboard.html'?'active':''}">Overview</a><a href="mood-check.html" class="${activeHref==='mood-check.html'?'active':''}">Mood Check</a><a href="mood-history.html" class="${activeHref==='mood-history.html'?'active':''}">Mood History</a><a href="prayer-wall.html" class="${activeHref==='prayer-wall.html'?'active':''}">Prayer Wall</a><a href="blessing-marketplace.html" class="${activeHref==='blessing-marketplace.html'?'active':''}">Marketplace</a><a href="help-board.html" class="${activeHref==='help-board.html'?'active':''}">Help Board</a><a href="my-posts.html" class="${activeHref==='my-posts.html'?'active':''}">My Posts</a><a href="profile.html" class="${activeHref==='profile.html'?'active':''}">Profile</a></aside>`;

  const sanitize = (text = '') => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
  const validateEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ONE DOMContentLoaded listener per page — dispatches to all init functions
  // after seeds, auth-guard, and shell are ready.
  document.addEventListener('DOMContentLoaded', () => {
    ensureSeeds();
    requireAuth();
    renderShell();
    // Dispatch to page-specific init functions (defined in auth.js, mood.js, community.js)
    const page = pathName();
    const dispatch = {
      'login.html':               () => typeof initLogin      === 'function' && initLogin(),
      'register.html':            () => typeof initRegister   === 'function' && initRegister(),
      'profile.html':             () => typeof initProfile    === 'function' && initProfile(),
      'dashboard.html':           () => typeof initDashboard  === 'function' && initDashboard(),
      'mood-check.html':          () => typeof initMoodCheck  === 'function' && initMoodCheck(),
      'mood-history.html':        () => typeof initMoodHistory=== 'function' && initMoodHistory(),
      'prayer-wall.html':         () => typeof initPrayerWall === 'function' && initPrayerWall(),
      'blessing-marketplace.html':() => typeof initMarketplace=== 'function' && initMarketplace(),
      'help-board.html':          () => typeof initHelpBoard  === 'function' && initHelpBoard(),
      'my-posts.html':            () => typeof initMyPosts    === 'function' && initMyPosts(),
    };
    if (dispatch[page]) dispatch[page]();
  });

  // pageInit kept for backward compatibility but is now a no-op wrapper
  // (the DOMContentLoaded above handles everything)
  const pageInit = fn => { /* no-op: dispatch is handled above */ };

  return { STORE, getCollection, setCollection, getSession, setSession, logout, nextId, createNotice, formatDate, renderShell, dashboardSidebar, sanitize, validateEmail, pageInit };
})();
