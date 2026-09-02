/*!
 * VitalConnect — auth.js
 * Login, registration, profile management, and the member dashboard.
 * Every function here is invoked by the router in app.js.
 */
'use strict';

/* ==================================================================== *
 * Login
 * ==================================================================== */

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Throttles repeated failures against one address. Client-side throttling is
 * trivially bypassed by clearing storage — it is here because the capstone
 * brief asks for account protection, and it does stop the casual case of
 * someone guessing at a shared demo machine.
 */
function lockoutState(email) {
  const all = VitalConnect.getItem(VitalConnect.STORE.lockouts) || {};
  const record = all[email];
  if (!record) return { locked: false, attempts: 0, minutesLeft: 0 };

  const elapsed = Date.now() - record.lastAttempt;
  if (elapsed > LOCKOUT_MINUTES * 60000) return { locked: false, attempts: 0, minutesLeft: 0 };

  const minutesLeft = Math.ceil((LOCKOUT_MINUTES * 60000 - elapsed) / 60000);
  return { locked: record.attempts >= LOCKOUT_THRESHOLD, attempts: record.attempts, minutesLeft };
}

function recordAttempt(email, success) {
  const all = VitalConnect.getItem(VitalConnect.STORE.lockouts) || {};
  if (success) delete all[email];
  else {
    const previous = all[email];
    const stale = previous && Date.now() - previous.lastAttempt > LOCKOUT_MINUTES * 60000;
    all[email] = { attempts: stale || !previous ? 1 : previous.attempts + 1, lastAttempt: Date.now() };
  }
  VitalConnect.setItem(VitalConnect.STORE.lockouts, all);
}

/** Adds a show/hide control to a password field. */
function attachPasswordToggle(input) {
  if (!input || input.dataset.toggleAttached) return;
  input.dataset.toggleAttached = 'true';

  const wrapper = document.createElement('div');
  wrapper.className = 'password-field';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'password-toggle';
  button.textContent = 'Show';
  button.setAttribute('aria-label', 'Show password');
  button.addEventListener('click', () => {
    const revealed = input.type === 'text';
    input.type = revealed ? 'password' : 'text';
    button.textContent = revealed ? 'Show' : 'Hide';
    button.setAttribute('aria-label', revealed ? 'Show password' : 'Hide password');
  });
  wrapper.appendChild(button);
}

function initLogin() {
  const form = document.querySelector('#loginForm');
  if (!form) return;

  // Somebody already signed in has no business on the login page.
  if (VitalConnect.getSession()) {
    window.location.replace('dashboard.html');
    return;
  }

  const feedback = document.querySelector('#formFeedback');
  const demoNotice = document.querySelector('#demoNotice');
  if (demoNotice) {
    demoNotice.innerHTML = VitalConnect.createNotice(
      'Demo accounts — <strong>demo@vitalconnect.com</strong> / Password123! &nbsp;·&nbsp; <strong>admin@vitalconnect.com</strong> / Admin123!',
      'info'
    );
  }

  attachPasswordToggle(form.password);

  const next = VitalConnect.safeNext(new URLSearchParams(window.location.search).get('next'));

  form.addEventListener('submit', event => {
    event.preventDefault();
    VitalConnect.clearFieldErrors(form);
    feedback.innerHTML = '';

    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    if (!email || !password) {
      feedback.innerHTML = VitalConnect.createNotice('Enter both your email address and password.', 'warning');
      return;
    }

    const lock = lockoutState(email);
    if (lock.locked) {
      feedback.innerHTML = VitalConnect.createNotice(
        `Too many failed attempts. Try again in ${lock.minutesLeft} minute${lock.minutesLeft === 1 ? '' : 's'}.`,
        'error'
      );
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Checking…';

    // Verification stretches the password over 2000 rounds, so yield a frame
    // first — otherwise the button never repaints as disabled.
    setTimeout(() => {
      const user = VitalConnect.findUser(email);
      const ok = user && VitalConnect.verifyPassword(password, user.password);

      submit.disabled = false;
      submit.textContent = 'Sign in';
      recordAttempt(email, Boolean(ok));

      if (!ok) {
        const remaining = LOCKOUT_THRESHOLD - lockoutState(email).attempts;
        // One message for both cases: saying "no such account" would confirm
        // which addresses are registered.
        feedback.innerHTML = VitalConnect.createNotice(
          `That email and password combination was not recognised.${remaining > 0 && remaining <= 2 ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} left before a temporary lock.` : ''}`,
          'error'
        );
        form.password.value = '';
        form.password.focus();
        return;
      }

      VitalConnect.setSession(user);
      VitalConnect.setFlash(`Welcome back, ${user.name.split(' ')[0]}.`, 'success');
      window.location.href = next || 'dashboard.html';
    }, 0);
  });
}

/* ==================================================================== *
 * Registration
 * ==================================================================== */

function initRegister() {
  const form = document.querySelector('#registerForm');
  if (!form) return;

  if (VitalConnect.getSession()) {
    window.location.replace('dashboard.html');
    return;
  }

  const feedback = document.querySelector('#formFeedback');
  attachPasswordToggle(form.password);

  // Live strength checklist, so requirements are visible while typing rather
  // than revealed one at a time by failed submissions.
  const meter = document.querySelector('#passwordStrength');
  const renderStrength = () => {
    if (!meter) return;
    const strength = VitalConnect.passwordStrength(form.password.value);
    meter.innerHTML = `
      <div class="strength-bar" role="img" aria-label="Password strength: ${VitalConnect.escAttr(strength.label)}">
        ${[0, 1, 2, 3].map(index => `<span class="${index < strength.score ? `filled level-${strength.score}` : ''}"></span>`).join('')}
      </div>
      <p class="mini strength-label">Strength: <strong>${VitalConnect.esc(strength.label)}</strong></p>
      <ul class="strength-rules">
        ${strength.rules.map(rule => `
          <li class="${rule.met ? 'met' : ''}">
            <span aria-hidden="true">${rule.met ? '&#10003;' : '&#8226;'}</span>
            ${VitalConnect.esc(rule.label)}
          </li>`).join('')}
      </ul>`;
  };
  form.password.addEventListener('input', renderStrength);
  renderStrength();

  const fields = ['name', 'email', 'password', 'confirmPassword', 'city', 'state'];
  const validate = () => {
    const values = Object.fromEntries(fields.map(field => [field, form[field].value.trim()]));
    const errors = {};

    if (!values.name) errors.name = 'Enter your full name.';
    else if (values.name.length < 2) errors.name = 'That name looks too short.';

    if (!values.email) errors.email = 'Enter your email address.';
    else if (!VitalConnect.validateEmail(values.email)) errors.email = 'Enter a valid email address, for example name@example.com.';
    else if (VitalConnect.findUser(values.email)) errors.email = 'An account with this email already exists.';

    const strength = VitalConnect.passwordStrength(form.password.value);
    if (!form.password.value) errors.password = 'Choose a password.';
    else if (!strength.acceptable) errors.password = 'Use at least 8 characters with a mix of letters, numbers, or symbols.';

    if (!form.confirmPassword.value) errors.confirmPassword = 'Re-enter your password.';
    else if (form.confirmPassword.value !== form.password.value) errors.confirmPassword = 'Passwords do not match.';

    if (!values.city) errors.city = 'Enter your city.';
    if (!values.state) errors.state = 'Enter your state.';

    return { values, errors };
  };

  // Live-correct a field that submit has already flagged, so a fix is
  // acknowledged straight away instead of waiting for another submit.
  //
  // This deliberately listens for input rather than blur. Validating on blur
  // inserts or removes the error paragraph during the mousedown of the very
  // next click; that moves everything below it, so a click aimed at the submit
  // button lands on empty card instead and is silently swallowed. Reacting to
  // typing keeps every layout change well away from a click.
  fields.forEach(field => {
    const input = form[field];
    const revalidate = () => {
      if (input.getAttribute('aria-invalid') !== 'true') return;
      const { errors } = validate();
      VitalConnect.setFieldError(input, errors[field] || '');
    };
    input.addEventListener('input', revalidate);
    input.addEventListener('change', revalidate);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    VitalConnect.clearFieldErrors(form);
    feedback.innerHTML = '';

    const { values, errors } = validate();
    const failed = Object.keys(errors);
    if (failed.length) {
      failed.forEach(field => VitalConnect.setFieldError(form[field], errors[field]));
      feedback.innerHTML = VitalConnect.createNotice(
        `Please correct ${failed.length} field${failed.length === 1 ? '' : 's'} below.`,
        'warning'
      );
      form[failed[0]].focus();
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Creating account…';

    setTimeout(() => {
      const users = VitalConnect.getCollection(VitalConnect.STORE.users);
      const account = {
        id: VitalConnect.nextId(users),
        name: values.name,
        email: values.email.toLowerCase(),
        password: VitalConnect.hashPassword(form.password.value, VitalConnect.randomSalt()),
        role: 'member',
        city: values.city,
        state: values.state,
        bio: form.bio.value.trim(),
        joinedAt: new Date().toISOString()
      };

      users.push(account);
      if (!VitalConnect.setCollection(VitalConnect.STORE.users, users)) {
        submit.disabled = false;
        submit.textContent = 'Create account';
        return;
      }

      VitalConnect.setSession(account);
      VitalConnect.setFlash(`Welcome to VitalConnect, ${account.name.split(' ')[0]}.`, 'success');
      window.location.href = 'dashboard.html';
    }, 0);
  });
}

/* ==================================================================== *
 * Profile
 * ==================================================================== */

function initProfile() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const user = VitalConnect.findUser(session.email);
  if (!user) return;

  const counts = {
    prayers: VitalConnect.getCollection(VitalConnect.STORE.prayers).filter(item => item.authorEmail === user.email).length,
    blessings: VitalConnect.getCollection(VitalConnect.STORE.blessings).filter(item => item.authorEmail === user.email).length,
    help: VitalConnect.getCollection(VitalConnect.STORE.helpRequests).filter(item => item.authorEmail === user.email).length,
    moods: VitalConnect.getCollection(VitalConnect.STORE.moods).filter(item => item.authorEmail === user.email).length
  };

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('profile.html')}
    <div class="stack">
      <section class="card profile-header">
        <span class="avatar avatar-lg" aria-hidden="true">${VitalConnect.esc(VitalConnect.initials(user.name))}</span>
        <div>
          <h1>${VitalConnect.esc(user.name)}</h1>
          <p class="mini">${VitalConnect.esc(user.email)} · ${VitalConnect.esc([user.city, user.state].filter(Boolean).join(', ') || 'Location not set')}</p>
          <p class="mini">Member since ${VitalConnect.esc(VitalConnect.formatDate(user.joinedAt || Date.now(), { dateStyle: 'long' }))} · ${VitalConnect.esc(user.role)}</p>
        </div>
        <dl class="profile-stats">
          <div><dt>Moods</dt><dd>${counts.moods}</dd></div>
          <div><dt>Prayers</dt><dd>${counts.prayers}</dd></div>
          <div><dt>Listings</dt><dd>${counts.blessings}</dd></div>
          <div><dt>Requests</dt><dd>${counts.help}</dd></div>
        </dl>
      </section>

      <section class="card">
        <h2>Profile details</h2>
        <p class="mini">Your name and location are shown alongside anything you post.</p>
        <div id="profileFeedback"></div>
        <form id="profileForm" novalidate>
          <div class="form-row">
            <div class="form-group"><label for="name">Full name</label><input id="name" name="name" required></div>
            <div class="form-group">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" readonly aria-describedby="emailHelp">
              <p class="mini" id="emailHelp">Your email identifies your account and cannot be changed.</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="city">City</label><input id="city" name="city"></div>
            <div class="form-group"><label for="state">State</label><input id="state" name="state"></div>
          </div>
          <div class="form-group">
            <label for="bio">Short bio</label>
            <textarea id="bio" name="bio" maxlength="300"></textarea>
            <p class="mini"><span id="bioCount">0</span>/300 characters</p>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Save changes</button></div>
        </form>
      </section>

      <section class="card">
        <h2>Change password</h2>
        <div id="passwordFeedback"></div>
        <form id="passwordForm" novalidate>
          <div class="form-group">
            <label for="currentPassword">Current password</label>
            <input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="newPassword">New password</label>
              <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" required>
            </div>
            <div class="form-group">
              <label for="confirmNewPassword">Confirm new password</label>
              <input id="confirmNewPassword" name="confirmNewPassword" type="password" autocomplete="new-password" required>
            </div>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Update password</button></div>
        </form>
      </section>

      <section class="card danger-zone">
        <h2>Your data</h2>
        <p class="mini">Everything VitalConnect knows about you is stored in this browser. Export it as JSON, or remove it entirely.</p>
        <div class="form-actions">
          <button class="btn-ghost" type="button" id="exportData">Export my data</button>
          <button class="btn-danger" type="button" id="deleteAccount">Delete my account</button>
        </div>
      </section>
    </div>`;

  const form = document.querySelector('#profileForm');
  form.name.value = user.name || '';
  form.email.value = user.email || '';
  form.city.value = user.city || '';
  form.state.value = user.state || '';
  form.bio.value = user.bio || '';

  const bioCount = document.querySelector('#bioCount');
  const updateCount = () => { bioCount.textContent = String(form.bio.value.length); };
  form.bio.addEventListener('input', updateCount);
  updateCount();

  form.addEventListener('submit', event => {
    event.preventDefault();
    VitalConnect.clearFieldErrors(form);

    const name = form.name.value.trim();
    if (name.length < 2) {
      VitalConnect.setFieldError(form.name, 'Enter your full name.');
      form.name.focus();
      return;
    }

    const users = VitalConnect.getCollection(VitalConnect.STORE.users);
    const updated = users.map(item =>
      item.email === user.email
        ? { ...item, name, city: form.city.value.trim(), state: form.state.value.trim(), bio: form.bio.value.trim() }
        : item
    );
    VitalConnect.setCollection(VitalConnect.STORE.users, updated);

    // Posts store a denormalised authorName so the boards render without a
    // per-item user lookup. A rename therefore has to be propagated, or old
    // posts keep showing the previous name forever.
    if (name !== user.name) renameAuthor(user.email, name);

    VitalConnect.setSession({ ...user, name });
    document.querySelector('#profileFeedback').innerHTML =
      VitalConnect.createNotice('Profile updated.', 'success');
    VitalConnect.toast('Profile updated.', 'success');
    VitalConnect.renderShell(); // Refresh the name in the header chip.
  });

  document.querySelector('#passwordForm').addEventListener('submit', event => {
    event.preventDefault();
    const passwordForm = event.target;
    const panel = document.querySelector('#passwordFeedback');
    VitalConnect.clearFieldErrors(passwordForm);

    const current = passwordForm.currentPassword.value;
    const next = passwordForm.newPassword.value;
    const confirm = passwordForm.confirmNewPassword.value;
    const fresh = VitalConnect.findUser(user.email);

    if (!VitalConnect.verifyPassword(current, fresh.password)) {
      VitalConnect.setFieldError(passwordForm.currentPassword, 'That is not your current password.');
      panel.innerHTML = VitalConnect.createNotice('Password not changed.', 'error');
      return;
    }
    if (!VitalConnect.passwordStrength(next).acceptable) {
      VitalConnect.setFieldError(passwordForm.newPassword, 'Use at least 8 characters with a mix of letters, numbers, or symbols.');
      return;
    }
    if (next !== confirm) {
      VitalConnect.setFieldError(passwordForm.confirmNewPassword, 'Passwords do not match.');
      return;
    }
    if (next === current) {
      VitalConnect.setFieldError(passwordForm.newPassword, 'Choose a password different from your current one.');
      return;
    }

    const users = VitalConnect.getCollection(VitalConnect.STORE.users).map(item =>
      item.email === user.email
        ? { ...item, password: VitalConnect.hashPassword(next, VitalConnect.randomSalt()) }
        : item
    );
    VitalConnect.setCollection(VitalConnect.STORE.users, users);
    passwordForm.reset();
    panel.innerHTML = VitalConnect.createNotice('Password updated.', 'success');
    VitalConnect.toast('Password updated.', 'success');
  });

  document.querySelector('#exportData').addEventListener('click', () => {
    const mine = key => VitalConnect.getCollection(key).filter(item => item.authorEmail === user.email);
    const { password, ...profile } = VitalConnect.findUser(user.email); // Never export the digest.
    VitalConnect.download(
      `vitalconnect-${user.email.split('@')[0]}-${VitalConnect.dayKey(Date.now())}.json`,
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        profile,
        moods: mine(VitalConnect.STORE.moods),
        prayers: mine(VitalConnect.STORE.prayers),
        blessings: mine(VitalConnect.STORE.blessings),
        helpRequests: mine(VitalConnect.STORE.helpRequests)
      }, null, 2),
      'application/json'
    );
    VitalConnect.toast('Export downloaded.', 'success');
  });

  document.querySelector('#deleteAccount').addEventListener('click', async () => {
    const confirmed = await VitalConnect.confirmAction({
      title: 'Delete your account?',
      body: 'This removes your profile, mood entries, prayer requests, listings, and help requests from this browser. It cannot be undone.',
      confirmLabel: 'Delete everything'
    });
    if (!confirmed) return;

    [VitalConnect.STORE.moods, VitalConnect.STORE.prayers, VitalConnect.STORE.blessings, VitalConnect.STORE.helpRequests]
      .forEach(key => VitalConnect.setCollection(
        key,
        VitalConnect.getCollection(key).filter(item => item.authorEmail !== user.email)
      ));

    // Removing only what the member authored would leave their address behind
    // in other people's posts, so prayer counts would keep counting someone who
    // is gone and re-registering the same address would inherit those old
    // interactions.
    const scrubInteractions = (key, field) => VitalConnect.setCollection(
      key,
      VitalConnect.getCollection(key).map(item =>
        Array.isArray(item[field]) && item[field].includes(user.email)
          ? { ...item, [field]: item[field].filter(email => email !== user.email) }
          : item
      )
    );
    scrubInteractions(VitalConnect.STORE.prayers, 'prayedBy');
    scrubInteractions(VitalConnect.STORE.helpRequests, 'offers');

    VitalConnect.setCollection(
      VitalConnect.STORE.users,
      VitalConnect.getCollection(VitalConnect.STORE.users).filter(item => item.email !== user.email)
    );

    VitalConnect.removeItem(VitalConnect.STORE.session);
    VitalConnect.setFlash('Your account and all of its data were deleted.', 'success');
    window.location.href = 'index.html';
  });
}

/** Propagates a display-name change across every collection that stores it. */
function renameAuthor(email, name) {
  [VitalConnect.STORE.moods, VitalConnect.STORE.prayers, VitalConnect.STORE.blessings, VitalConnect.STORE.helpRequests]
    .forEach(key => {
      const items = VitalConnect.getCollection(key);
      let changed = false;
      const updated = items.map(item => {
        if (item.authorEmail !== email || item.authorName === name) return item;
        changed = true;
        return { ...item, authorName: name };
      });
      if (changed) VitalConnect.setCollection(key, updated);
    });
}

/* ==================================================================== *
 * Dashboard
 * ==================================================================== */

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initDashboard() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const mine = key => VitalConnect.getCollection(key).filter(item => item.authorEmail === session.email);
  const moods = mine(VitalConnect.STORE.moods);
  const prayers = mine(VitalConnect.STORE.prayers);
  const blessings = mine(VitalConnect.STORE.blessings);
  const help = mine(VitalConnect.STORE.helpRequests);
  const stats = VitalConnect.moodStats(moods, { days: 14 });

  // One merged, newest-first feed across every board, so the dashboard shows
  // the community rather than only the member's own counters.
  const activity = [
    ...VitalConnect.getCollection(VitalConnect.STORE.prayers).map(item => ({ ...item, kind: 'Prayer', href: 'prayer-wall.html', summary: item.content })),
    ...VitalConnect.getCollection(VitalConnect.STORE.blessings).map(item => ({ ...item, kind: 'Blessing', href: 'blessing-marketplace.html', summary: item.description })),
    ...VitalConnect.getCollection(VitalConnect.STORE.helpRequests).map(item => ({ ...item, kind: 'Help', href: 'help-board.html', summary: item.description }))
  ].sort(VitalConnect.byNewest).slice(0, 6);

  const openHelp = VitalConnect.getCollection(VitalConnect.STORE.helpRequests).filter(item => item.status !== 'fulfilled').length;
  const loggedToday = moods.some(item => VitalConnect.dayKey(item.createdAt) === VitalConnect.dayKey(Date.now()));

  const metric = (label, value, note) => `
    <div class="metric-card">
      <p>${VitalConnect.esc(label)}</p>
      <strong>${VitalConnect.esc(String(value))}</strong>
      ${note ? `<span class="metric-note">${VitalConnect.esc(note)}</span>` : ''}
    </div>`;

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('dashboard.html')}
    <div class="stack">
      <section class="welcome-strip">
        <div>
          <h1>${VitalConnect.esc(greeting())}, ${VitalConnect.esc(session.name.split(' ')[0])}</h1>
          <p>${loggedToday
            ? 'You have already checked in today. Nicely done.'
            : 'You have not logged a mood today — it takes about fifteen seconds.'}</p>
        </div>
        <a class="btn-secondary" href="mood-check.html">${loggedToday ? 'Log another entry' : 'Log today’s mood'}</a>
      </section>

      <section class="grid grid-4" aria-label="Your activity at a glance">
        ${metric('Mood entries', stats.total, stats.topMood ? `Most often: ${stats.topMood}` : 'No entries yet')}
        ${metric('Day streak', stats.streak, stats.streak ? 'Consecutive days logged' : 'Log today to start one')}
        ${metric('Average mood', stats.total ? `${stats.average}/5` : '—', 'Across all entries')}
        ${metric('Your posts', prayers.length + blessings.length + help.length, `${openHelp} open request${openHelp === 1 ? '' : 's'} community-wide`)}
      </section>

      <div class="grid grid-2">
        <section class="card">
          <h2>Your mood, last 14 days</h2>
          <p class="mini">Average score per day on a scale of 1 (low) to 5 (high).</p>
          ${VitalConnect.moodTrendChart(stats.series)}
          <div class="form-actions">
            <a class="btn-ghost" href="mood-history.html">Full history</a>
            <a class="btn-ghost" href="mood-check.html">New entry</a>
          </div>
        </section>

        <section class="card">
          <h2>Community activity</h2>
          <p class="mini">The most recent posts across all three boards.</p>
          ${activity.length ? `<ul class="activity-feed">${activity.map(item => `
            <li>
              <span class="tag tag-${VitalConnect.esc(item.kind.toLowerCase())}">${VitalConnect.esc(item.kind)}</span>
              <div>
                <a href="${VitalConnect.escAttr(item.href)}">${VitalConnect.esc(item.title)}</a>
                <p class="mini">${VitalConnect.esc(VitalConnect.truncate(item.summary, 90))}</p>
                <p class="mini muted">${VitalConnect.esc(item.authorName)} · ${VitalConnect.esc(VitalConnect.relativeTime(item.createdAt))}</p>
              </div>
            </li>`).join('')}</ul>` : '<div class="empty-state">Nothing posted yet.</div>'}
        </section>
      </div>

      <section class="card">
        <h2>Quick actions</h2>
        <div class="badge-row">
          <a class="btn-ghost" href="prayer-wall.html">Open prayer wall</a>
          <a class="btn-ghost" href="blessing-marketplace.html">Share a blessing</a>
          <a class="btn-ghost" href="help-board.html">Request help</a>
          <a class="btn-ghost" href="my-posts.html">Manage my posts</a>
          <a class="btn-ghost" href="profile.html">Profile settings</a>
        </div>
      </section>
    </div>`;
}
