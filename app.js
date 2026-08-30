/*!
 * VitalConnect — app.js
 * Storage, session, chrome (header/footer/nav), theming, notifications, and
 * the page router. Pure logic lives in core.js.
 */
const VitalConnect = (() => {
  'use strict';

  const Core = globalThis.VitalCore;
  if (!Core) throw new Error('VitalConnect: core.js must load before app.js');

  /* ================================================================== *
   * Branding
   * ================================================================== */

  // Inlined rather than loaded from logo.svg: an <img src="*.svg"> is served
  // with the wrong MIME type by some school hosting stacks, and inlining also
  // lets the wordmark inherit currentColor so it stays legible in dark mode.
  //
  // The gradient id is made unique per call because the logo is rendered twice
  // on every page (header and footer); a repeated id is invalid HTML, and the
  // second instance would reference the first one's gradient.
  let logoInstance = 0;
  const logoSvg = () => {
    const gradientId = `vc-logo-gradient-${++logoInstance}`;
    return `
    <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 120" role="img" aria-label="VitalConnect">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="currentColor"/>
          <stop offset="100%" stop-color="#c9a227"/>
        </linearGradient>
      </defs>
      <g transform="translate(6,20)">
        <circle cx="36" cy="40" r="26" fill="none" stroke="url(#${gradientId})" stroke-width="8"/>
        <circle cx="78" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="8" opacity="0.7"/>
        <path d="M8 40h18l10-16 14 34 14-26 10 8h24" fill="none" stroke="#c9a227"
              stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <text x="118" y="54" font-family="inherit" font-size="34" font-weight="700" fill="currentColor">Vital<tspan fill="#c9a227">Connect</tspan></text>
      <text x="120" y="82" font-family="inherit" font-size="12.5" letter-spacing="2.4" fill="currentColor" opacity="0.62">COMMUNITY WELLNESS</text>
    </svg>`;
  };

  /* ================================================================== *
   * Storage
   * ================================================================== */

  const STORE = {
    users: 'vc_users',
    session: 'vc_session',
    prayers: 'vc_prayers',
    blessings: 'vc_blessings',
    helpRequests: 'vc_help_requests',
    moods: 'vc_moods',
    theme: 'vc_theme',
    schema: 'vc_schema',
    flash: 'vc_flash',
    lockouts: 'vc_lockouts'
  };

  const SCHEMA_VERSION = 2;

  // localStorage throws outright in Safari private browsing and when a site is
  // opened from file:// with storage disabled. Falling back to an in-memory
  // shim keeps the whole app usable for one session instead of throwing on the
  // first read, which is what the previous version did.
  const memoryStore = new Map();
  const backing = (() => {
    try {
      const probe = '__vc_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return { available: true, store: window.localStorage };
    } catch {
      return {
        available: false,
        store: {
          getItem: key => (memoryStore.has(key) ? memoryStore.get(key) : null),
          setItem: (key, value) => memoryStore.set(key, String(value)),
          removeItem: key => memoryStore.delete(key)
        }
      };
    }
  })();

  const storageAvailable = backing.available;

  const readRaw = key => {
    try { return backing.store.getItem(key); } catch { return null; }
  };

  const writeRaw = (key, value) => {
    try {
      backing.store.setItem(key, value);
      return { ok: true };
    } catch (error) {
      const quota = error && (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014);
      return { ok: false, quota, error };
    }
  };

  /**
   * Reads a JSON array. A corrupted value (hand-edited, or truncated by a
   * quota failure mid-write) used to throw and take the whole page down;
   * now it is quarantined under a `.corrupt` key and reported.
   */
  function getCollection(key) {
    const raw = readRaw(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn(`VitalConnect: "${key}" held invalid JSON; quarantining it.`);
      writeRaw(`${key}__corrupt`, raw);
      writeRaw(key, '[]');
      return [];
    }
  }

  function setCollection(key, value) {
    const result = writeRaw(key, JSON.stringify(value));
    if (!result.ok) {
      // Surfacing this matters most on the marketplace, where an uploaded
      // photo can single-handedly exhaust the ~5MB origin quota.
      toast(
        result.quota
          ? 'Storage is full. Remove an older post or a large photo, then try again.'
          : 'This browser refused to save the change.',
        'error'
      );
    }
    return result.ok;
  }

  const getItem = key => {
    const raw = readRaw(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const setItem = (key, value) => writeRaw(key, JSON.stringify(value)).ok;
  const removeItem = key => { try { backing.store.removeItem(key); } catch { /* ignore */ } };

  /* ================================================================== *
   * Seed data
   * ================================================================== */

  const DAY = 86400000;
  const daysAgo = (days, hour = 9, minute = 0) => {
    const date = new Date(Date.now() - days * DAY);
    date.setHours(hour, minute, 0, 0);
    // Setting the hour on "today" can land ahead of the current time, which
    // would render a seeded post as "Scheduled". Pull it back an hour at a
    // time until it is genuinely in the past.
    while (date.getTime() > Date.now()) date.setTime(date.getTime() - 3600000);
    return date.toISOString();
  };

  // Seeds are generated relative to "now" so a freshly cloned copy shows a
  // live-looking two weeks of activity instead of dates stuck in the past.
  function buildSeeds() {
    const demo = 'demo@vitalconnect.com';
    const maria = 'maria@vitalconnect.com';
    const james = 'james@vitalconnect.com';

    const moodPlan = [
      [0, 'Hopeful', 'Starting the day with a clear plan.'],
      [0, 'Focused', 'Deep work block went well.'],
      [1, 'Grateful', 'A neighbour dropped off a meal.'],
      [2, 'Tired', 'Late shift, but the team pulled together.'],
      [3, 'Calm', 'Long walk after class.'],
      [4, 'Stressed', 'Two deadlines landed on the same afternoon.'],
      [5, 'Hopeful', 'Study group is finally clicking.'],
      [6, 'Content', 'Quiet, ordinary, good day.'],
      [8, 'Anxious', 'Waiting on results.'],
      [9, 'Grateful', 'Prayer wall response really lifted me.'],
      [11, 'Joyful', 'Family visit.'],
      [13, 'Calm', 'Rested properly for once.']
    ];

    return {
      [STORE.users]: [
        { id: 1, name: 'Demo User', email: demo, password: 'Password123!', role: 'member',
          city: 'Indianapolis', state: 'IN', bio: 'Community member using VitalConnect for wellness support.',
          joinedAt: daysAgo(45) },
        { id: 2, name: 'Admin User', email: 'admin@vitalconnect.com', password: 'Admin123!', role: 'admin',
          city: 'Lafayette', state: 'IN', bio: 'Platform administrator.', joinedAt: daysAgo(60) },
        { id: 3, name: 'Maria Alvarez', email: maria, password: 'Password123!', role: 'member',
          city: 'Fort Wayne', state: 'IN', bio: 'Volunteer coordinator and long-time member.', joinedAt: daysAgo(30) },
        { id: 4, name: 'James Okoro', email: james, password: 'Password123!', role: 'member',
          city: 'Bloomington', state: 'IN', bio: 'Student, part-time driver, always up for helping out.', joinedAt: daysAgo(22) }
      ],
      [STORE.prayers]: [
        { id: 'p1', title: 'Prayer for guidance', content: 'Please pray for wisdom and direction as I balance school, work, and family responsibilities.', authorEmail: demo, authorName: 'Demo User', createdAt: daysAgo(2, 12), prayedBy: [maria, james] },
        { id: 'p2', title: 'Healing for my mother', content: 'She has surgery scheduled next week. Praying for steady hands for the team and a calm recovery.', authorEmail: maria, authorName: 'Maria Alvarez', createdAt: daysAgo(1, 8, 30), prayedBy: [demo] },
        { id: 'p3', title: 'Thanksgiving for a new job', content: 'After six months of searching I start on Monday. Grateful for everyone who checked in on me.', authorEmail: james, authorName: 'James Okoro', createdAt: daysAgo(4, 17), prayedBy: [demo, maria] }
      ],
      [STORE.blessings]: [
        { id: 'b1', title: "Children's books bundle", description: "A clean set of about thirty picture books and early readers, free for pickup.", category: 'Items', location: 'Community Hub, Indianapolis', image: '', authorEmail: demo, authorName: 'Demo User', createdAt: daysAgo(3, 9), status: 'available' },
        { id: 'b2', title: 'Free haircuts, Saturday morning', description: 'Licensed stylist offering six slots between 9am and noon. First come, first served.', category: 'Service', location: 'Fort Wayne', image: '', authorEmail: maria, authorName: 'Maria Alvarez', createdAt: daysAgo(1, 11), status: 'available' },
        { id: 'b3', title: 'Winter coats, sizes M-XL', description: 'Four coats in good condition, freshly cleaned. Happy to meet halfway.', category: 'Clothing', location: 'Bloomington', image: '', authorEmail: james, authorName: 'James Okoro', createdAt: daysAgo(6, 15), status: 'claimed' }
      ],
      [STORE.helpRequests]: [
        { id: 'h1', title: 'Need grocery transportation', description: 'Looking for a ride to the grocery store this Saturday morning. I can cover fuel.', urgency: 'Medium', authorEmail: demo, authorName: 'Demo User', createdAt: daysAgo(1, 14, 30), status: 'open', offers: [] },
        { id: 'h2', title: 'Help moving a sofa', description: 'One flight of stairs, should take under an hour with two people.', urgency: 'Low', authorEmail: maria, authorName: 'Maria Alvarez', createdAt: daysAgo(5, 10), status: 'fulfilled', offers: [james] },
        { id: 'h3', title: 'Tutoring for algebra final', description: 'My daughter is struggling with quadratics and the exam is in ten days.', urgency: 'High', authorEmail: james, authorName: 'James Okoro', createdAt: daysAgo(0, 7, 45), status: 'open', offers: [] }
      ],
      [STORE.moods]: moodPlan.map(([days, mood, notes], index) => ({
        id: `m${index + 1}`,
        mood,
        notes,
        energy: 3,
        createdAt: daysAgo(days, 8 + (index % 8)),
        authorEmail: demo,
        authorName: 'Demo User'
      }))
    };
  }

  /* ================================================================== *
   * Bootstrap and migration
   * ================================================================== */

  const randomSalt = () => {
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(8);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  };

  function ensureSeeds() {
    const seeds = buildSeeds();
    for (const [key, value] of Object.entries(seeds)) {
      if (readRaw(key) !== null) continue;
      // Seed credentials are hashed on the way in, so a plaintext password is
      // never written to storage even for one page load.
      const payload = key === STORE.users
        ? value.map(user => ({ ...user, password: Core.hashPassword(user.password, randomSalt()) }))
        : value;
      setCollection(key, payload);
    }
  }

  /**
   * Rewrites any credential still held as plaintext into a salted, stretched
   * digest, and backfills fields added after v1 (post status, prayer counts).
   * Runs once per schema bump and is safe to re-run.
   */
  function migrate() {
    const previous = Number(getItem(STORE.schema)) || 1;
    if (previous >= SCHEMA_VERSION) return;

    const users = getCollection(STORE.users).map(user => {
      if (Core.isHashedPassword(user.password)) return user;
      const plaintext = typeof user.password === 'string' ? user.password : '';
      return { ...user, password: Core.hashPassword(plaintext, randomSalt()), joinedAt: user.joinedAt || new Date().toISOString() };
    });
    // The version is stamped only once every write has landed. Hashing expands
    // the user record, so on a near-full quota that write can fail while the
    // much smaller schema write succeeds — which would mark the store upgraded
    // with plaintext passwords still in it and lock out every account, since
    // login now accepts only hashes. Re-running is safe: already-hashed
    // records are skipped and the other writes are idempotent.
    const writes = [
      setCollection(STORE.users, users),
      setCollection(STORE.prayers, getCollection(STORE.prayers).map(item => ({
        ...item, prayedBy: Array.isArray(item.prayedBy) ? item.prayedBy : []
      }))),
      setCollection(STORE.blessings, getCollection(STORE.blessings).map(item => ({
        ...item, status: item.status || 'available'
      }))),
      setCollection(STORE.helpRequests, getCollection(STORE.helpRequests).map(item => ({
        ...item, status: item.status || 'open', offers: Array.isArray(item.offers) ? item.offers : []
      })))
    ];

    if (!writes.every(Boolean)) {
      console.warn('VitalConnect: migration incomplete; leaving schema at version', previous);
      return;
    }

    setItem(STORE.schema, SCHEMA_VERSION);
  }

  /* ================================================================== *
   * Session
   * ================================================================== */

  const SESSION_HOURS = 8;

  const findUser = email =>
    getCollection(STORE.users).find(user => String(user.email).toLowerCase() === String(email).toLowerCase()) || null;

  function setSession(user) {
    return setItem(STORE.session, {
      email: user.email,
      name: user.name,
      role: user.role || 'member',
      loggedInAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_HOURS * 3600000
    });
  }

  /** Returns the live session, or null once it has expired or gone stale. */
  function getSession() {
    const session = getItem(STORE.session);
    if (!session || !session.email) return null;

    // A session saved before this version carries loggedInAt but no expiresAt.
    // Treating a missing expiry as "never expires" let a pre-upgrade session on
    // a shared device stay valid indefinitely, because requireAuth() would then
    // hand it a fresh eight hours through touchSession(). Derive the deadline
    // from loggedInAt instead; an unusable timestamp resolves to the epoch and
    // is therefore already expired.
    const expiresAt = Number.isFinite(session.expiresAt)
      ? session.expiresAt
      : Core.toTime(session.loggedInAt) + SESSION_HOURS * 3600000;

    if (Date.now() > expiresAt) {
      removeItem(STORE.session);
      return null;
    }
    // A session whose account was deleted in another tab must not stay valid.
    if (!findUser(session.email)) {
      removeItem(STORE.session);
      return null;
    }
    return session;
  }

  const touchSession = () => {
    const session = getItem(STORE.session);
    if (session) setItem(STORE.session, { ...session, expiresAt: Date.now() + SESSION_HOURS * 3600000 });
  };

  function logout() {
    removeItem(STORE.session);
    setFlash('You have been signed out.', 'success');
    window.location.href = 'login.html';
  }

  /* ================================================================== *
   * Routing and page guard
   * ================================================================== */

  const PROTECTED_PAGES = [
    'dashboard.html', 'mood-check.html', 'mood-history.html', 'prayer-wall.html',
    'blessing-marketplace.html', 'help-board.html', 'my-posts.html', 'profile.html'
  ];

  const pathName = () => window.location.pathname.split('/').pop() || 'index.html';

  // A message that survives one redirect, so "please sign in" and "signed out"
  // can be shown on the page the member actually lands on.
  const setFlash = (message, type = 'info') => {
    try { sessionStorage.setItem(STORE.flash, JSON.stringify({ message, type })); } catch { /* ignore */ }
  };
  const takeFlash = () => {
    try {
      const raw = sessionStorage.getItem(STORE.flash);
      sessionStorage.removeItem(STORE.flash);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  /**
   * Redirects signed-out visitors away from member pages, remembering where
   * they were headed so login can send them back there.
   */
  function requireAuth() {
    const page = pathName();
    if (!PROTECTED_PAGES.includes(page)) return true;
    if (getSession()) { touchSession(); return true; }
    setFlash('Please sign in to continue.', 'warning');
    window.location.replace(`login.html?next=${encodeURIComponent(page + window.location.search)}`);
    return false;
  }

  // Only same-document page names are accepted as a redirect target, so a
  // crafted ?next= cannot bounce a member to another site after login.
  function safeNext(value) {
    const candidate = String(value || '').trim();
    if (!candidate) return '';
    const [page] = candidate.split('?');
    return PROTECTED_PAGES.includes(page) ? candidate : '';
  }

  /* ================================================================== *
   * Theme
   * ================================================================== */

  const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

  function currentTheme() {
    const stored = readRaw(STORE.theme);
    return stored === 'dark' || stored === 'light' ? stored : (prefersDark() ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    writeRaw(STORE.theme, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#0f4c81');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      const icon = button.querySelector('.theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
  }

  const toggleTheme = () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');

  /* ================================================================== *
   * Notifications
   * ================================================================== */

  const esc = Core.escapeHtml;
  const escAttr = Core.escapeAttr;

  const createNotice = (message, type = 'info') =>
    `<div class="notice ${esc(type)}" role="${type === 'error' ? 'alert' : 'status'}">${message}</div>`;

  /**
   * Transient status message. The live region is created once and reused, so
   * screen readers announce updates instead of silently re-rendering markup —
   * the old innerHTML-into-a-div approach announced nothing.
   */
  function toast(message, type = 'info', timeout = 5000) {
    let region = document.querySelector('#vc-toasts');
    if (!region) {
      region = document.createElement('div');
      region.id = 'vc-toasts';
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'false');
      document.body.appendChild(region);
    }

    const node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.innerHTML = `<span>${esc(message)}</span><button type="button" class="toast-close" aria-label="Dismiss">&times;</button>`;
    node.querySelector('.toast-close').addEventListener('click', () => node.remove());
    region.appendChild(node);

    if (timeout) {
      setTimeout(() => {
        node.classList.add('toast-leaving');
        setTimeout(() => node.remove(), 250);
      }, timeout);
    }
    return node;
  }

  /**
   * Accessible replacement for window.confirm, used before every destructive
   * action. Returns a promise so callers can `await` the decision.
   */
  function confirmAction({ title = 'Are you sure?', body = '', confirmLabel = 'Confirm', tone = 'danger' } = {}) {
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="vc-modal-title">
          <h2 id="vc-modal-title">${esc(title)}</h2>
          ${body ? `<p class="mini">${esc(body)}</p>` : ''}
          <div class="form-actions">
            <button type="button" class="btn-ghost" data-modal-cancel>Cancel</button>
            <button type="button" class="${tone === 'danger' ? 'btn-danger' : 'btn'}" data-modal-confirm>${esc(confirmLabel)}</button>
          </div>
        </div>`;

      const close = result => {
        document.removeEventListener('keydown', onKeydown, true);
        overlay.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
        resolve(result);
      };

      // Keep Tab inside the dialog; without this, focus wanders behind the
      // overlay and keyboard users lose the Cancel button.
      const onKeydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); close(false); return; }
        if (event.key !== 'Tab') return;
        const focusable = overlay.querySelectorAll('button');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };

      overlay.querySelector('[data-modal-cancel]').addEventListener('click', () => close(false));
      overlay.querySelector('[data-modal-confirm]').addEventListener('click', () => close(true));
      overlay.addEventListener('click', event => { if (event.target === overlay) close(false); });
      document.addEventListener('keydown', onKeydown, true);

      document.body.appendChild(overlay);
      overlay.querySelector('[data-modal-confirm]').focus();
    });
  }

  /* ================================================================== *
   * Chrome
   * ================================================================== */

  const NAV_LINKS = [
    ['index.html', 'Home'],
    ['about.html', 'About'],
    ['dashboard.html', 'Dashboard'],
    ['prayer-wall.html', 'Prayer Wall'],
    ['blessing-marketplace.html', 'Marketplace'],
    ['help-board.html', 'Help Board'],
    ['contact.html', 'Contact']
  ];

  const SIDEBAR_LINKS = [
    ['dashboard.html', 'Overview'],
    ['mood-check.html', 'Mood Check'],
    ['mood-history.html', 'Mood History'],
    ['prayer-wall.html', 'Prayer Wall'],
    ['blessing-marketplace.html', 'Marketplace'],
    ['help-board.html', 'Help Board'],
    ['my-posts.html', 'My Posts'],
    ['profile.html', 'Profile']
  ];

  const initials = (name = '') =>
    String(name).trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';

  function renderShell() {
    logoInstance = 0;
    const current = pathName();
    const session = getSession();
    const header = document.querySelector('#app-header');
    const footer = document.querySelector('#app-footer');

    if (header) {
      const authControls = session
        ? `<a class="user-chip" href="profile.html"><span class="avatar" aria-hidden="true">${esc(initials(session.name))}</span><span class="user-chip-name">${esc(session.name)}</span></a>
           <button class="btn-ghost" type="button" data-logout>Sign out</button>`
        : `<a class="btn-ghost" href="login.html">Login</a><a class="btn" href="register.html">Get Started</a>`;

      const links = NAV_LINKS.map(([href, label]) => {
        const active = current === href;
        return `<a href="${href}" class="${active ? 'active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
      }).join('');

      header.innerHTML = `
        <a class="skip-link" href="#main-content">Skip to content</a>
        <header class="site-header">
          <div class="container navbar">
            <a class="brand" href="index.html" aria-label="VitalConnect home">${logoSvg()}</a>
            <nav class="nav-links" id="primaryNav" aria-label="Primary">${links}</nav>
            <div class="nav-actions">
              <button class="icon-btn" type="button" data-theme-toggle aria-pressed="false">
                <span class="theme-icon">Dark</span>
              </button>
              <div class="nav-auth">${authControls}</div>
              <button class="icon-btn nav-toggle" type="button" id="navToggle"
                      aria-expanded="false" aria-controls="mobileNav" aria-label="Open menu">
                <span class="nav-toggle-bars" aria-hidden="true"><span></span><span></span><span></span></span>
              </button>
            </div>
          </div>
          <nav class="mobile-nav" id="mobileNav" aria-label="Mobile" hidden>
            <div class="container">
              ${links}
              <div class="mobile-nav-auth">${authControls}</div>
            </div>
          </nav>
        </header>`;
    }

    if (footer) {
      footer.innerHTML = `
        <footer class="site-footer">
          <div class="container footer-grid">
            <div>
              <div class="footer-brand">${logoSvg()}</div>
              <p class="mini">A community wellness platform built as an IT499 capstone: mood tracking, prayer support, shared resources, and practical help, running entirely in the browser.</p>
            </div>
            <div>
              <h3>Explore</h3>
              <ul class="footer-list">
                <li><a href="dashboard.html">Dashboard</a></li>
                <li><a href="mood-check.html">Mood Check</a></li>
                <li><a href="prayer-wall.html">Prayer Wall</a></li>
                <li><a href="my-posts.html">My Posts</a></li>
              </ul>
            </div>
            <div>
              <h3>Support</h3>
              <ul class="footer-list">
                <li><a href="about.html">About</a></li>
                <li><a href="contact.html">Contact</a></li>
                <li><a href="policies.html">Policies</a></li>
              </ul>
            </div>
          </div>
          <div class="container footer-bottom">
            <p class="mini">&copy; ${new Date().getFullYear()} VitalConnect. Academic project — not a medical or emergency service.</p>
            <p class="mini">In a crisis in the US, call or text <strong>988</strong> for the Suicide &amp; Crisis Lifeline.</p>
          </div>
        </footer>`;
    }

    bindShellEvents();
    applyTheme(currentTheme());
  }

  function bindShellEvents() {
    document.querySelectorAll('[data-logout]').forEach(button =>
      button.addEventListener('click', async () => {
        if (await confirmAction({
          title: 'Sign out?',
          body: 'Your saved entries stay on this device.',
          confirmLabel: 'Sign out',
          tone: 'primary'
        })) logout();
      })
    );

    document.querySelectorAll('[data-theme-toggle]').forEach(button =>
      button.addEventListener('click', toggleTheme)
    );

    const toggle = document.querySelector('#navToggle');
    const mobileNav = document.querySelector('#mobileNav');
    if (toggle && mobileNav) {
      const setOpen = open => {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        toggle.classList.toggle('is-open', open);
        mobileNav.hidden = !open;
        document.body.classList.toggle('nav-open', open);
      };

      toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
      mobileNav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          setOpen(false);
          toggle.focus();
        }
      });
      // Reset state when the viewport grows past the mobile breakpoint,
      // otherwise the drawer stays open behind the desktop nav.
      const desktop = window.matchMedia('(min-width: 941px)');
      const onBreakpoint = event => { if (event.matches) setOpen(false); };
      if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
      else if (desktop.addListener) desktop.addListener(onBreakpoint);
    }
  }

  /** Member-area side navigation, rendered by every dashboard feature page. */
  const dashboardSidebar = (activeHref = 'dashboard.html') => `
    <aside class="sidebar" aria-label="Member area">
      <nav>
        ${SIDEBAR_LINKS.map(([href, label]) => {
          const active = href === activeHref;
          return `<a href="${href}" class="${active ? 'active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
        }).join('')}
      </nav>
    </aside>`;

  /* ================================================================== *
   * Files
   * ================================================================== */

  /**
   * Reads an image and re-encodes it to fit within `maxSize`, because a photo
   * straight off a phone is several megabytes as a data URL and will blow the
   * LocalStorage quota on the very first upload.
   */
  function readImageScaled(file, { maxSize = 1000, quality = 0.72 } = {}) {
    return new Promise(resolve => {
      if (!file || !file.type.startsWith('image/')) { resolve(''); return; }
      if (file.size > 12 * 1024 * 1024) {
        toast('That image is larger than 12MB. Please choose a smaller file.', 'warning');
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => resolve('');
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve('');
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch {
            resolve(''); // Tainted canvas or an unsupported codec.
          }
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function download(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ================================================================== *
   * Charts
   * ================================================================== */

  /**
   * Line chart of average daily mood score, drawn as inline SVG so the project
   * keeps its zero-dependency, static-hosting constraint.
   *
   * Days with no entry break the line rather than being plotted as zero, which
   * would misrepresent a skipped day as a terrible one. A visually hidden table
   * carries the same numbers for screen readers.
   */
  function moodTrendChart(series, { height = 110 } = {}) {
    const width = 320;
    const padX = 8;
    const padY = 14;
    const span = Math.max(1, series.length - 1);
    const x = index => padX + (index / span) * (width - padX * 2);
    const y = score => height - padY - ((score - 1) / 4) * (height - padY * 2);

    // Split into runs of consecutive logged days so gaps stay gaps.
    const runs = [];
    let run = [];
    series.forEach((point, index) => {
      if (point.average === null) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push({ index, ...point });
      }
    });
    if (run.length) runs.push(run);

    const lines = runs
      .filter(points => points.length > 1)
      .map(points => `<polyline points="${points.map(p => `${x(p.index).toFixed(1)},${y(p.average).toFixed(1)}`).join(' ')}" />`)
      .join('');

    const dots = runs.flat()
      .map(p => `<circle cx="${x(p.index).toFixed(1)}" cy="${y(p.average).toFixed(1)}" r="3"><title>${escAttr(`${p.label}: ${p.average.toFixed(1)} of 5`)}</title></circle>`)
      .join('');

    const logged = series.filter(point => point.average !== null);
    if (!logged.length) {
      return '<div class="empty-state">No entries in this window yet. Your trend line appears once you log a mood.</div>';
    }

    const gridlines = [1, 3, 5]
      .map(score => `<line x1="${padX}" x2="${width - padX}" y1="${y(score).toFixed(1)}" y2="${y(score).toFixed(1)}" />`)
      .join('');

    const rows = logged
      .map(point => `<tr><th scope="row">${esc(point.label)}</th><td>${point.average.toFixed(1)}</td></tr>`)
      .join('');

    return `
      <figure class="chart-figure">
        <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img"
             aria-label="Average daily mood score over the last ${series.length} days, from 1 (low) to 5 (high)"
             preserveAspectRatio="none">
          <g class="trend-grid">${gridlines}</g>
          <g class="trend-line">${lines}</g>
          <g class="trend-dots">${dots}</g>
        </svg>
        <figcaption class="chart-axis">
          <span>${esc(series[0].label)}</span>
          <span>${esc(series[series.length - 1].label)}</span>
        </figcaption>
        <table class="visually-hidden">
          <caption>Average mood score by day</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Score out of 5</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </figure>`;
  }

  /** Horizontal bar breakdown, used for "which moods came up most". */
  function barChart(counts, { total = 0 } = {}) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<div class="empty-state">No mood data yet.</div>';
    const max = Math.max(...entries.map(entry => entry[1]), 1);
    const denominator = total || entries.reduce((sum, entry) => sum + entry[1], 0);

    return `<div class="chart">${entries.map(([mood, count]) => {
      const meta = Core.moodMeta(mood);
      const share = denominator ? Math.round((count / denominator) * 100) : 0;
      return `
        <div class="bar-wrap">
          <span class="bar-label">${esc(mood)}</span>
          <div class="bar" role="img" aria-label="${escAttr(`${mood}: ${count} entries, ${share} percent`)}">
            <span class="tone-${esc(meta.tone)}" style="width:${((count / max) * 100).toFixed(1)}%"></span>
          </div>
          <strong>${count}</strong>
        </div>`;
    }).join('')}</div>`;
  }

  /* ================================================================== *
   * Form helpers
   * ================================================================== */

  /** Attaches an inline, screen-reader-associated error to one field. */
  function setFieldError(input, message) {
    if (!input) return;
    const id = `${input.id}-error`;
    let node = document.getElementById(id);
    if (message) {
      if (!node) {
        node = document.createElement('p');
        node.id = id;
        node.className = 'field-error';
        input.insertAdjacentElement('afterend', node);
      }
      node.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);
      input.classList.add('has-error');
    } else if (node) {
      node.remove();
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      input.classList.remove('has-error');
    }
  }

  const clearFieldErrors = form =>
    form?.querySelectorAll('[aria-invalid]').forEach(input => setFieldError(input, ''));

  /* ================================================================== *
   * Router
   * ================================================================== */

  const ROUTES = {
    'login.html': 'initLogin',
    'register.html': 'initRegister',
    'profile.html': 'initProfile',
    'dashboard.html': 'initDashboard',
    'mood-check.html': 'initMoodCheck',
    'mood-history.html': 'initMoodHistory',
    'prayer-wall.html': 'initPrayerWall',
    'blessing-marketplace.html': 'initMarketplace',
    'help-board.html': 'initHelpBoard',
    'my-posts.html': 'initMyPosts'
  };

  function boot() {
    ensureSeeds();
    migrate();
    // A page whose guard redirects must not also render — otherwise the
    // member-only markup is built and paints during the navigation.
    if (!requireAuth()) return;

    renderShell();

    if (!storageAvailable) {
      toast('This browser is blocking site storage, so nothing you enter will be saved.', 'warning', 9000);
    }

    const flash = takeFlash();
    if (flash) toast(flash.message, flash.type);

    const handler = ROUTES[pathName()];
    if (handler && typeof globalThis[handler] === 'function') {
      try {
        globalThis[handler]();
      } catch (error) {
        console.error(`VitalConnect: ${handler} failed`, error);
        toast('Something went wrong loading this page.', 'error');
      }
    }
  }

  // Boot on DOMContentLoaded, which fires only after every deferred script has
  // run. Booting as soon as app.js executes would be too early: readyState is
  // already "interactive" at that point, but the feature file that defines this
  // page's init function (auth.js, mood.js, community.js) is still queued.
  // Only a readyState of "complete" means that event has already gone by.
  if (document.readyState === 'complete') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  }

  return {
    // storage
    STORE, getCollection, setCollection, getItem, setItem, removeItem, storageAvailable,
    // session
    getSession, setSession, logout, findUser, requireAuth, safeNext, randomSalt,
    setFlash, SESSION_HOURS,
    // chrome
    renderShell, dashboardSidebar, initials, applyTheme, toggleTheme, currentTheme,
    // feedback
    createNotice, toast, confirmAction, setFieldError, clearFieldErrors,
    // files
    readImageScaled, download,
    // charts
    moodTrendChart, barChart,
    // re-exported pure helpers, so feature files need only one namespace
    esc, escAttr, sanitize: esc, safeUrl: Core.safeUrl,
    hashPassword: Core.hashPassword, verifyPassword: Core.verifyPassword,
    validateEmail: Core.validateEmail, passwordStrength: Core.passwordStrength,
    uid: Core.uid, nextId: Core.nextId, byNewest: Core.byNewest, byOldest: Core.byOldest,
    searchItems: Core.searchItems, truncate: Core.truncate, toTime: Core.toTime,
    formatDate: Core.formatDate, relativeTime: Core.relativeTime, dayKey: Core.dayKey,
    MOODS: Core.MOODS, moodMeta: Core.moodMeta, moodStats: Core.moodStats, toCsv: Core.toCsv
  };
})();
