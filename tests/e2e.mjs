/**
 * End-to-end browser tests for VitalConnect.
 *
 * These drive the real pages in Chromium and cover the things a unit test
 * cannot: the auth guard, storage, rendering, mobile navigation, keyboard
 * access, and resistance to injected markup.
 *
 * Prerequisites:
 *   npm install -g playwright http-server   (or use npx)
 *
 * Run:
 *   npx http-server -p 8127 -s .            # in one terminal, from the repo root
 *   node tests/e2e.mjs                      # in another
 *
 * The server URL can be overridden with VC_BASE_URL.
 */

import { createRequire } from 'node:module';

// Resolve Playwright whether it is installed locally or globally, so the
// suite runs without a package.json in this dependency-free project.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try {
    const { execSync } = await import('node:child_process');
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    ({ chromium } = require(`${globalRoot}/playwright`));
  } catch {
    console.error('Playwright is not installed. Run: npm install -g playwright');
    process.exit(1);
  }
}

const BASE = process.env.VC_BASE_URL || 'http://127.0.0.1:8127';

const results = [];
const consoleErrors = [];

async function clickSettled(target, selector) {
  const locator = target.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  await target.waitForTimeout(350); // let scroll-behavior: smooth finish
  await locator.click();
}

const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ' -> ' + detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(`${page.url().split('/').pop()}: ${msg.text()}`);
});
page.on('pageerror', error => consoleErrors.push(`${page.url().split('/').pop()}: ${error.message}`));

/* ---------------------------------------------------------------- public */

await page.goto(`${BASE}/index.html`);
check('home renders header nav', await page.locator('.site-header .nav-links a').count() >= 5);
check('home renders footer', await page.locator('.site-footer').isVisible());
check('logo is inline SVG', await page.locator('.brand svg.logo').count() === 1);

// Theme toggle
const themeBefore = await page.getAttribute('html', 'data-theme');
await page.click('[data-theme-toggle]');
const themeAfter = await page.getAttribute('html', 'data-theme');
check('theme toggle switches theme', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
await page.reload();
check('theme persists across reload', await page.getAttribute('html', 'data-theme') === themeAfter);
await page.click('[data-theme-toggle]'); // back to light

/* -------------------------------------------------------------- auth guard */

await page.goto(`${BASE}/dashboard.html`);
await page.waitForURL(/login\.html/, { timeout: 5000 }).catch(() => {});
check('protected page redirects when signed out', page.url().includes('login.html'));
check('redirect remembers the target page', page.url().includes('next=dashboard.html'), page.url());

/* ------------------------------------------------------------------ login */

await page.fill('#email', 'demo@vitalconnect.com');
await page.fill('#password', 'WrongPassword1!');
await page.click('#loginForm button[type="submit"]');
await page.waitForTimeout(400);
check('bad password is rejected', await page.locator('.notice.error').count() === 1);
check('error message does not reveal whether the account exists',
  !(await page.locator('.notice.error').innerText()).toLowerCase().includes('no account'));

// Show/hide password toggle
await page.click('.password-toggle');
check('password toggle reveals the field', await page.getAttribute('#password', 'type') === 'text');
await page.click('.password-toggle');

await page.fill('#email', 'demo@vitalconnect.com');
await page.fill('#password', 'Password123!');
await page.click('#loginForm button[type="submit"]');
await page.waitForURL(/dashboard\.html/, { timeout: 8000 });
check('correct password signs in and honours ?next=', page.url().includes('dashboard.html'));

/* ------------------------------------------- passwords are hashed at rest */

const storedUsers = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_users')));
check('no plaintext password in storage',
  storedUsers.every(u => /^sha256\$\d+\$/.test(u.password)),
  JSON.stringify(storedUsers.map(u => u.password.slice(0, 18))));

/* -------------------------------------------------------------- dashboard */

check('dashboard greets the member', (await page.locator('.welcome-strip h1').innerText()).includes('Demo'));
check('dashboard shows metric cards', await page.locator('.metric-card').count() === 4);
check('dashboard renders the trend chart', await page.locator('.trend-chart polyline').count() > 0);
check('dashboard shows a community feed', await page.locator('.activity-feed li').count() > 0);
check('sidebar is present', await page.locator('.sidebar a').count() === 8);

/* ------------------------------------------------------------- mood check */

await page.click('.sidebar a[href="mood-check.html"]');
await page.waitForSelector('#moodForm');
await page.click('.mood-option:has-text("Grateful") .mood-name');
await page.fill('#notes', 'End-to-end test entry');
await page.click('#moodForm button[type="submit"]');
await page.waitForTimeout(300);
check('mood entry saves', await page.locator('#moodFeedback .notice.success').count() === 1);

// Submitting with no mood chosen must be blocked.
await page.reload();
await page.waitForSelector('#moodForm');
await page.click('#moodForm button[type="submit"]');
check('mood is required', await page.locator('#mood-error').isVisible());

/* ----------------------------------------------------------- mood history */

await page.goto(`${BASE}/mood-history.html`);
await page.waitForSelector('.item-card');
const historyCount = await page.locator('.item-card').count();
check('history lists entries', historyCount > 0, `${historyCount} entries`);
check('history renders a breakdown chart', await page.locator('.bar-wrap').count() > 0);

await page.fill('#searchFilter', 'End-to-end');
await page.waitForTimeout(400);
check('history search filters entries', await page.locator('.item-card').count() === 1);
await page.fill('#searchFilter', '');
await page.waitForTimeout(400);

await page.selectOption('#rangeFilter', '7');
await page.waitForTimeout(200);
check('range filter re-renders', await page.locator('.metric-card').count() === 4);

/* ------------------------------------------------------------ prayer wall */

await page.goto(`${BASE}/prayer-wall.html`);
await page.waitForSelector('#prayerForm');
const prayersBefore = await page.locator('#boardBody .item-card').count();

await page.fill('#title', 'E2E prayer request');
await page.fill('#content', 'Posted by the automated end-to-end test run.');
await page.click('#prayerForm button[type="submit"]');
await page.waitForTimeout(300);
check('prayer posts', await page.locator('#boardBody .item-card').count() === prayersBefore + 1);

// "I am praying" toggle
const firstPray = page.locator('[data-pray]').first();
const countBefore = parseInt(await firstPray.locator('.count').innerText(), 10);
await firstPray.click();
await page.waitForTimeout(200);
const countAfter = parseInt(await page.locator('[data-pray]').first().locator('.count').innerText(), 10);
check('praying toggle changes the count', countAfter !== countBefore, `${countBefore} -> ${countAfter}`);

// Edit flow
await page.locator('[data-edit]').first().click();
await page.waitForTimeout(200);
check('edit populates the form', (await page.inputValue('#title')).length > 0);
await page.fill('#title', 'E2E prayer request (edited)');
await page.click('#prayerForm button[type="submit"]');
await page.waitForTimeout(300);
check('edit saves', (await page.locator('#boardBody').innerText()).includes('(edited)'));

// Ownership: another member's post must not offer Edit/Delete.
const otherCard = page.locator('.item-card', { hasText: 'Maria Alvarez' }).first();
check('cannot edit another member\'s post', await otherCard.locator('[data-edit]').count() === 0);

// Delete with confirmation dialog
const beforeDelete = await page.locator('#boardBody .item-card').count();
await page.locator('[data-delete-prayer]').first().click();
await page.waitForSelector('.modal');
check('delete asks for confirmation', await page.locator('.modal').isVisible());
await page.click('[data-modal-cancel]');
await page.waitForTimeout(200);
check('cancelling keeps the post', await page.locator('#boardBody .item-card').count() === beforeDelete);

await page.locator('[data-delete-prayer]').first().click();
await page.waitForSelector('.modal');
await page.click('[data-modal-confirm]');
await page.waitForTimeout(300);
check('confirming deletes the post', await page.locator('#boardBody .item-card').count() === beforeDelete - 1);

/* --------------------------------------------------------- XSS resistance */

await page.evaluate(() => {
  const items = JSON.parse(localStorage.getItem('vc_prayers'));
  items.unshift({
    id: 'xss1',
    title: '"><img src=x onerror="window.__XSS__=true">',
    content: '<script>window.__XSS2__=true<\/script>',
    authorEmail: 'demo@vitalconnect.com',
    authorName: '"><svg onload="window.__XSS3__=true">',
    createdAt: new Date().toISOString(),
    prayedBy: []
  });
  localStorage.setItem('vc_prayers', JSON.stringify(items));
});
await page.goto(`${BASE}/prayer-wall.html`);
await page.waitForSelector('#boardBody .item-card');
await page.waitForTimeout(400);
const xss = await page.evaluate(() => ({
  a: window.__XSS__ === true, b: window.__XSS2__ === true, c: window.__XSS3__ === true,
  injectedImg: document.querySelectorAll('#boardBody img[onerror]').length,
  injectedSvg: document.querySelectorAll('#boardBody svg[onload]').length
}));
check('markup in a post title does not execute', !xss.a && xss.injectedImg === 0, JSON.stringify(xss));
check('markup in post content does not execute', !xss.b);
check('markup in an author name does not execute', !xss.c && xss.injectedSvg === 0);
check('injected markup is shown as text',
  (await page.locator('#boardBody').innerText()).includes('onerror'));

// A hostile image URL must not survive into the DOM.
await page.evaluate(() => {
  const items = JSON.parse(localStorage.getItem('vc_blessings'));
  items.unshift({
    id: 'xssb', title: 'Bad image', description: 'Listing with a script URL as its photo.',
    category: 'Items', location: 'Nowhere', image: 'javascript:window.__XSS4__=true',
    status: 'available', authorEmail: 'demo@vitalconnect.com', authorName: 'Demo User',
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('vc_blessings', JSON.stringify(items));
});
await page.goto(`${BASE}/blessing-marketplace.html`);
await page.waitForSelector('#boardBody');
await page.waitForTimeout(300);
const badImg = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#boardBody img')).filter(i => i.getAttribute('src')?.startsWith('javascript:')).length);
check('javascript: image URL is stripped', badImg === 0);

/* ------------------------------------------------------------- help board */

await page.goto(`${BASE}/help-board.html`);
await page.waitForSelector('#helpForm');
await page.fill('#title', 'E2E help request');
await page.selectOption('#urgency', 'High');
await page.fill('#description', 'Automated end-to-end coverage for the help board.');
await page.click('#helpForm button[type="submit"]');
await page.waitForTimeout(300);
check('help request posts', (await page.locator('#boardBody').innerText()).includes('E2E help request'));

await page.selectOption('#statusFilter', 'all');
await page.waitForTimeout(200);
await page.selectOption('#urgencyFilter', 'High');
await page.waitForTimeout(300);
const urgencies = await page.locator('#boardBody .item-card .tag').allInnerTexts();
check('urgency filter applies', urgencies.every(t => t.includes('High')), urgencies.join('|'));

/* --------------------------------------------------------------- my posts */

await page.goto(`${BASE}/my-posts.html`);
await page.waitForSelector('.tab-row');
check('my posts lists entries', await page.locator('#boardBody .item-card').count() > 0);
await page.click('[data-tab="Mood"]');
await page.waitForTimeout(300);
const kinds = await page.locator('#boardBody .item-card .tag').allInnerTexts();
check('tab filter narrows to one kind', kinds.length > 0 && kinds.every(t => t === 'Mood'), kinds.join('|'));

/* ---------------------------------------------------------------- profile */

await page.goto(`${BASE}/profile.html`);
await page.waitForSelector('#profileForm');
await page.fill('#name', 'Renamed Member');
await page.click('#profileForm button[type="submit"]');
await page.waitForTimeout(400);
check('profile saves', await page.locator('#profileFeedback .notice.success').count() === 1);

await page.goto(`${BASE}/prayer-wall.html`);
await page.waitForSelector('#boardBody');
check('rename propagates to existing posts',
  (await page.locator('#boardBody').innerText()).includes('Renamed Member'));

// Password change
await page.goto(`${BASE}/profile.html`);
await page.waitForSelector('#passwordForm');
await page.fill('#currentPassword', 'WrongPass1!');
await page.fill('#newPassword', 'BrandNew123!');
await page.fill('#confirmNewPassword', 'BrandNew123!');
await page.click('#passwordForm button[type="submit"]');
await page.waitForTimeout(300);
check('wrong current password is rejected', await page.locator('#currentPassword[aria-invalid="true"]').count() === 1);

await page.fill('#currentPassword', 'Password123!');
await page.click('#passwordForm button[type="submit"]');
await page.waitForTimeout(500);
check('password change succeeds', await page.locator('#passwordFeedback .notice.success').count() === 1);

/* ------------------------------------------------------------ session end */

await page.click('[data-logout]');
await page.waitForSelector('.modal');
await page.click('[data-modal-confirm]');
await page.waitForURL(/login\.html/, { timeout: 5000 });
check('sign out returns to login', page.url().includes('login.html'));

// The new password must work, the old one must not.
await page.fill('#email', 'demo@vitalconnect.com');
await page.fill('#password', 'Password123!');
await page.click('#loginForm button[type="submit"]');
await page.waitForTimeout(600);
check('old password no longer works', page.url().includes('login.html'));

await page.fill('#password', 'BrandNew123!');
await page.click('#loginForm button[type="submit"]');
await page.waitForURL(/dashboard\.html/, { timeout: 8000 });
check('new password works', page.url().includes('dashboard.html'));

/* ---------------------------------------------------------- registration */

await context.clearCookies();
const fresh = await context.newPage();
fresh.on('pageerror', e => console.log('   [fresh pageerror]', e.message));
await fresh.goto(`${BASE}/index.html`);
await fresh.evaluate(() => localStorage.clear());
await fresh.goto(`${BASE}/register.html`);
await fresh.waitForSelector('#registerForm');

await fresh.fill('#password', 'abc');
await fresh.waitForTimeout(150);
check('strength meter reacts to typing',
  (await fresh.locator('.strength-label').innerText()).includes('Weak') ||
  (await fresh.locator('.strength-label').innerText()).includes('Very weak'));

await fresh.click('#registerForm button[type="submit"]');
await fresh.waitForTimeout(300);
const invalidCount = await fresh.locator('[aria-invalid="true"]').count();
check('empty registration reports every bad field', invalidCount >= 4, `${invalidCount} fields flagged`);

await fresh.fill('#name', 'New Member');
await fresh.fill('#email', 'demo@vitalconnect.com');
await fresh.fill('#password', 'GoodPass123!');
await fresh.fill('#confirmPassword', 'GoodPass123!');
await fresh.fill('#city', 'Indianapolis');
await fresh.fill('#state', 'IN');
await fresh.click('#registerForm button[type="submit"]');
await fresh.waitForTimeout(400);
check('duplicate email is rejected', await fresh.locator('#email[aria-invalid="true"]').count() === 1);

await fresh.fill('#email', 'brand.new@example.com');
await fresh.fill('#confirmPassword', 'Mismatch123!');
await fresh.click('#registerForm button[type="submit"]');
await fresh.waitForTimeout(300);
check('password mismatch is rejected', await fresh.locator('#confirmPassword[aria-invalid="true"]').count() === 1);

await fresh.fill('#confirmPassword', 'GoodPass123!');
await fresh.click('#registerForm button[type="submit"]');
await fresh.waitForURL(/dashboard\.html/, { timeout: 8000 }).catch(() => {});
check('valid registration signs in', fresh.url().includes('dashboard.html'));
await fresh.close();

/* ------------------------------------------------------ mobile navigation */

const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${BASE}/index.html`);
check('desktop nav is hidden on mobile', !(await mobile.locator('.nav-links').isVisible()));
check('hamburger is shown on mobile', await mobile.locator('#navToggle').isVisible());
check('drawer starts closed', !(await mobile.locator('#mobileNav').isVisible()));

await mobile.click('#navToggle');
await mobile.waitForTimeout(200);
check('hamburger opens the drawer', await mobile.locator('#mobileNav').isVisible());
check('drawer exposes navigation links', await mobile.locator('#mobileNav a').count() >= 7);
check('toggle reports expanded state', await mobile.getAttribute('#navToggle', 'aria-expanded') === 'true');

await mobile.keyboard.press('Escape');
await mobile.waitForTimeout(200);
check('Escape closes the drawer', !(await mobile.locator('#mobileNav').isVisible()));

await mobile.click('#navToggle');
await mobile.click('#mobileNav a[href="about.html"]');
await mobile.waitForURL(/about\.html/, { timeout: 5000 });
check('drawer link navigates', mobile.url().includes('about.html'));

// The registration test left this context signed in as the new member, so the
// member pages are reachable directly.
await mobile.goto(`${BASE}/dashboard.html`);
await mobile.waitForSelector('.welcome-strip', { timeout: 8000 });
check('signed-in session is shared across tabs', mobile.url().includes('dashboard.html'));

// No horizontal overflow at phone width, including on data-heavy pages.
for (const path of ['dashboard.html', 'mood-history.html', 'blessing-marketplace.html', 'profile.html']) {
  await mobile.goto(`${BASE}/${path}`);
  await mobile.waitForTimeout(400);
  const overflow = await mobile.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no horizontal overflow on ${path}`, overflow <= 1, `${overflow}px`);
}
await mobile.close();

/* ----------------------------------------------------- keyboard and a11y */

const kb = await context.newPage();
await kb.goto(`${BASE}/index.html`);
await kb.keyboard.press('Tab');
const firstFocus = await kb.evaluate(() => document.activeElement?.className || '');
check('first Tab reaches the skip link', firstFocus.includes('skip-link'), firstFocus);

const landmarks = await kb.evaluate(() => ({
  main: document.querySelectorAll('main#main-content').length,
  header: document.querySelectorAll('header.site-header').length,
  footer: document.querySelectorAll('footer.site-footer').length,
  navLabels: Array.from(document.querySelectorAll('nav')).every(n => n.hasAttribute('aria-label')),
  h1: document.querySelectorAll('h1').length,
  current: document.querySelectorAll('[aria-current="page"]').length
}));
check('landmarks are present and labelled',
  landmarks.main === 1 && landmarks.header === 1 && landmarks.footer === 1 && landmarks.navLabels,
  JSON.stringify(landmarks));
check('exactly one h1 per page', landmarks.h1 === 1, String(landmarks.h1));
check('current page is marked for assistive tech', landmarks.current >= 1);

// Duplicate ids break label association and querySelector lookups.
for (const path of ['index.html', 'dashboard.html', 'prayer-wall.html', 'profile.html', 'register.html']) {
  await kb.goto(`${BASE}/${path}`);
  await kb.waitForTimeout(350);
  const dupes = await kb.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  check(`no duplicate ids on ${path}`, dupes.length === 0, dupes.join(','));
}

// Every form control must have an accessible name.
await kb.goto(`${BASE}/register.html`);
await kb.waitForTimeout(300);
const unlabelled = await kb.evaluate(() =>
  Array.from(document.querySelectorAll('input, select, textarea'))
    .filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
    .map(el => el.id || el.name || el.type));
check('every register field is labelled', unlabelled.length === 0, unlabelled.join(','));
await kb.close();

/* ------------------------------------------------------- resilience cases */

const resilient = await context.newPage();
await resilient.goto(`${BASE}/index.html`);
await resilient.evaluate(() => localStorage.setItem('vc_prayers', '{not valid json'));
await resilient.goto(`${BASE}/login.html`);
await resilient.waitForTimeout(300);
const quarantined = await resilient.evaluate(() => ({
  recovered: localStorage.getItem('vc_prayers'),
  backup: localStorage.getItem('vc_prayers__corrupt')
}));
check('corrupt storage is quarantined, not fatal',
  quarantined.recovered === '[]' && quarantined.backup === '{not valid json',
  JSON.stringify(quarantined));

// A tampered ?next= must not be able to bounce the member off-site.
// Sign out first: the login page sends an already-authenticated visitor
// straight to the dashboard.
// Sign out and clear any lockout: the login page sends an already
// authenticated visitor straight to the dashboard, and an earlier block
// deliberately failed some sign-in attempts.
await resilient.evaluate(() => {
  localStorage.removeItem('vc_session');
  localStorage.removeItem('vc_lockouts');
});
await resilient.goto(`${BASE}/login.html?next=https://evil.example.com`);
await resilient.waitForSelector('#loginForm');
await resilient.fill('#email', 'demo@vitalconnect.com');
await resilient.fill('#password', 'Password123!');
await resilient.click('#loginForm button[type="submit"]');
await resilient.waitForTimeout(2000);
check('open-redirect via ?next= is refused',
  resilient.url().includes('dashboard.html'), resilient.url());

// The same guard, exercised directly across a range of hostile values.
const nextResults = await resilient.evaluate(() => ({
  external: VitalConnect.safeNext('https://evil.example.com'),
  protocolRelative: VitalConnect.safeNext('//evil.example.com'),
  script: VitalConnect.safeNext('javascript:alert(1)'),
  unknownPage: VitalConnect.safeNext('index.html'),
  allowed: VitalConnect.safeNext('mood-history.html')
}));
check('safeNext only accepts known member pages',
  nextResults.external === '' && nextResults.protocolRelative === '' &&
  nextResults.script === '' && nextResults.unknownPage === '' &&
  nextResults.allowed === 'mood-history.html',
  JSON.stringify(nextResults));
await resilient.close();

/* ------------------------------------------------------- every page loads */

const pages = ['index.html', 'about.html', 'contact.html', 'policies.html', 'login.html',
  'register.html', 'dashboard.html', 'profile.html', 'mood-check.html', 'mood-history.html',
  'prayer-wall.html', 'blessing-marketplace.html', 'help-board.html', 'my-posts.html', '404.html'];

for (const path of pages) {
  const response = await page.goto(`${BASE}/${path}`);
  await page.waitForTimeout(250);
  const rendered = await page.evaluate(() => ({
    header: !!document.querySelector('.site-header'),
    footer: !!document.querySelector('.site-footer'),
    mainText: (document.querySelector('#main-content')?.innerText || '').trim().length
  }));
  check(`${path} renders chrome and content`,
    response.status() === 200 && rendered.header && rendered.footer && rendered.mainText > 40,
    JSON.stringify(rendered));
}

await browser.close();

/* -------------------------------------------------------------- summary */

const failed = results.filter(r => !r.ok);
console.log('\n' + '-'.repeat(58));
console.log(`${results.length - failed.length}/${results.length} browser checks passed`);

if (consoleErrors.length) {
  console.log(`\nConsole errors (${consoleErrors.length}):`);
  [...new Set(consoleErrors)].slice(0, 15).forEach(e => console.log('  ' + e));
}

if (failed.length) {
  console.log(`\n${failed.length} failing:`);
  failed.forEach(f => console.log(`  ${f.name}${f.detail ? ' -> ' + f.detail : ''}`));
  process.exit(1);
}
if (consoleErrors.length) process.exit(1);
