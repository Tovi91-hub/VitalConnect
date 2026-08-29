/*!
 * VitalConnect — core.js
 * Pure, DOM-free logic: hashing, validation, formatting, and statistics.
 *
 * This file deliberately touches no browser API so that every function in it
 * can be unit tested under Node (see tests/core.test.mjs). app.js layers the
 * DOM, storage, and routing concerns on top of it.
 */
(function (root, factory) {
  const api = factory();
  root.VitalCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Escaping
   * ------------------------------------------------------------------ */

  // Escapes the five characters that can change the meaning of markup.
  // The previous implementation round-tripped through textContent/innerHTML,
  // which leaves quotes intact — safe between tags, but an injection hole the
  // moment the value lands inside an attribute.
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);

  // Attribute values get the same treatment plus backtick and equals, which
  // some legacy parsers accept as attribute delimiters.
  const escapeAttr = (value = '') => escapeHtml(value).replace(/`/g, '&#96;').replace(/=/g, '&#61;');

  // Only these URL shapes may be rendered into src/href. Anything else
  // (javascript:, vbscript:, data:text/html) collapses to an empty string.
  const SAFE_URL = /^(?:https?:|mailto:|data:image\/(?:png|jpe?g|gif|webp|avif);base64,|\/|\.\/|\.\.\/|#|[\w.-]+(?:[/?#]|$))/i;
  const safeUrl = (value = '') => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return '';
    // Strip control characters and whitespace before testing: a browser reads
    // "java\nscript:alert(1)" as a javascript: URL, but a naive prefix check
    // does not.
    const normalized = Array.from(trimmed)
      .filter(ch => ch.charCodeAt(0) > 32)
      .join('');
    return SAFE_URL.test(normalized) ? trimmed : '';
  };

  /* ------------------------------------------------------------------ *
   * SHA-256
   * ------------------------------------------------------------------ */

  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    const out = [];
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code >= 0xd800 && code <= 0xdbff) {
        code = 0x10000 + ((code & 0x3ff) << 10) + (text.charCodeAt(++i) & 0x3ff);
        out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return new Uint8Array(out);
  }

  // A dependency-free SHA-256. crypto.subtle would be faster, but it is only
  // exposed in secure contexts — this project is expected to run from plain
  // http school hosting and from file:// during grading, so the pure
  // implementation is the one that always works.
  function sha256Hex(message) {
    const bytes = utf8Bytes(String(message));
    const len = bytes.length;
    const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(bytes);
    padded[len] = 0x80;

    const bitsHigh = Math.floor(len / 536870912) >>> 0; // (len * 8) / 2^32
    const bitsLow = (len * 8) >>> 0;
    const end = padded.length;
    padded[end - 8] = (bitsHigh >>> 24) & 0xff;
    padded[end - 7] = (bitsHigh >>> 16) & 0xff;
    padded[end - 6] = (bitsHigh >>> 8) & 0xff;
    padded[end - 5] = bitsHigh & 0xff;
    padded[end - 4] = (bitsLow >>> 24) & 0xff;
    padded[end - 3] = (bitsLow >>> 16) & 0xff;
    padded[end - 2] = (bitsLow >>> 8) & 0xff;
    padded[end - 1] = bitsLow & 0xff;

    const H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    const w = new Uint32Array(64);

    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i++) {
        const p = offset + i * 4;
        w[i] = ((padded[p] << 24) | (padded[p + 1] << 16) | (padded[p + 2] << 8) | padded[p + 3]) >>> 0;
      }
      for (let i = 16; i < 64; i++) {
        const x = w[i - 15];
        const y = w[i - 2];
        const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + s1 + ch + SHA_K[i] + w[i]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    let hex = '';
    for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0');
    return hex;
  }

  /* ------------------------------------------------------------------ *
   * Password storage
   * ------------------------------------------------------------------ */

  const PASSWORD_ROUNDS = 2000;

  // Stored as `sha256$<rounds>$<salt>$<digest>`. The salt stops two members
  // who picked the same password from sharing a digest; the rounds add enough
  // work to make a dictionary sweep over an exported store tedious.
  //
  // This is deliberate key stretching, not production credential storage — a
  // browser-only project has no server to keep a secret, so anyone with the
  // device can still attack the digests offline. See README.md.
  function hashPassword(password, salt, rounds = PASSWORD_ROUNDS) {
    let digest = sha256Hex(`${salt}:${password}`);
    for (let i = 1; i < rounds; i++) digest = sha256Hex(`${salt}:${digest}`);
    return `sha256$${rounds}$${salt}$${digest}`;
  }

  function verifyPassword(password, stored) {
    if (typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'sha256') return false;
    const rounds = Number(parts[1]);
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100000) return false;
    return constantTimeEqual(hashPassword(password, parts[2], rounds), stored);
  }

  const isHashedPassword = value =>
    typeof value === 'string' && /^sha256\$\d+\$[^$]+\$[0-9a-f]{64}$/.test(value);

  // Comparing digests with === leaks timing information. The amount leaked
  // here is academic, but the habit is the point.
  function constantTimeEqual(a = '', b = '') {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ------------------------------------------------------------------ *
   * Validation
   * ------------------------------------------------------------------ */

  const validateEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(email).trim());

  const PASSWORD_RULES = [
    { id: 'length', label: 'At least 8 characters', test: value => value.length >= 8 },
    { id: 'letter', label: 'Contains a letter', test: value => /[a-z]/i.test(value) },
    { id: 'number', label: 'Contains a number', test: value => /\d/.test(value) },
    { id: 'symbol', label: 'Contains a symbol', test: value => /[^A-Za-z0-9]/.test(value) }
  ];

  // Returns a 0-4 score plus which rules passed, so the register form can show
  // a live checklist instead of one pass/fail message after submit.
  function passwordStrength(password = '') {
    const value = String(password);
    const passed = PASSWORD_RULES.filter(rule => rule.test(value));
    const bonus = value.length >= 12 ? 1 : 0;
    const score = Math.min(4, passed.length === PASSWORD_RULES.length ? 3 + bonus : passed.length);
    const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
    return {
      score,
      label: labels[score],
      rules: PASSWORD_RULES.map(rule => ({ id: rule.id, label: rule.label, met: rule.test(value) })),
      acceptable: passed.length >= 3 && value.length >= 8
    };
  }

  /* ------------------------------------------------------------------ *
   * Collections
   * ------------------------------------------------------------------ */

  // Ids only have to be unique inside one browser's storage, so a timestamp
  // plus randomness is plenty — and it avoids the collisions a max()+1 counter
  // produces once items have been deleted.
  const uid = (prefix = 'vc') =>
    `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const nextId = (items = []) =>
    items.length ? Math.max(0, ...items.map(item => Number(item && item.id) || 0)) + 1 : 1;

  function toTime(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  const byNewest = (a, b) => toTime(b.createdAt) - toTime(a.createdAt);
  const byOldest = (a, b) => toTime(a.createdAt) - toTime(b.createdAt);

  // Case-insensitive substring search across the named fields.
  function searchItems(items = [], term = '', fields = []) {
    const needle = String(term).trim().toLowerCase();
    if (!needle) return items.slice();
    return items.filter(item =>
      fields.some(field => String(item[field] ?? '').toLowerCase().includes(needle))
    );
  }

  const truncate = (text = '', max = 140) => {
    const value = String(text ?? '');
    return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
  };

  /* ------------------------------------------------------------------ *
   * Dates
   * ------------------------------------------------------------------ */

  function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString([], options);
  }

  const MINUTE = 60000, HOUR = 3600000, DAY = 86400000;

  function relativeTime(value, now = Date.now()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    const delta = now - date.getTime();
    if (delta < 0) return 'Scheduled';
    if (delta < MINUTE) return 'Just now';
    if (delta < HOUR) { const n = Math.floor(delta / MINUTE); return `${n} minute${n === 1 ? '' : 's'} ago`; }
    if (delta < DAY) { const n = Math.floor(delta / HOUR); return `${n} hour${n === 1 ? '' : 's'} ago`; }
    if (delta < DAY * 7) { const n = Math.floor(delta / DAY); return `${n} day${n === 1 ? '' : 's'} ago`; }
    return formatDate(value, { dateStyle: 'medium' });
  }

  // Local-time YYYY-MM-DD. Bucketing by toISOString() would file entries under
  // the wrong day for anyone west of UTC.
  function dayKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  /* ------------------------------------------------------------------ *
   * Mood model
   * ------------------------------------------------------------------ */

  // `score` drives the trend line; `tone` drives the colour treatment.
  const MOODS = [
    { name: 'Joyful',      score: 5, tone: 'positive' },
    { name: 'Grateful',    score: 5, tone: 'positive' },
    { name: 'Hopeful',     score: 4, tone: 'positive' },
    { name: 'Calm',        score: 4, tone: 'positive' },
    { name: 'Focused',     score: 4, tone: 'positive' },
    { name: 'Content',     score: 3, tone: 'neutral'  },
    { name: 'Tired',       score: 2, tone: 'caution'  },
    { name: 'Anxious',     score: 2, tone: 'caution'  },
    { name: 'Stressed',    score: 2, tone: 'caution'  },
    { name: 'Overwhelmed', score: 1, tone: 'alert'    },
    { name: 'Sad',         score: 1, tone: 'alert'    }
  ];

  const moodMeta = name =>
    MOODS.find(mood => mood.name === name) || { name, score: 3, tone: 'neutral' };

  /**
   * Summarises a member's mood entries: counts per mood, average score, a
   * day-by-day series for the trend chart, and the current logging streak.
   */
  function moodStats(entries = [], { days = 14, now = Date.now() } = {}) {
    const valid = entries.filter(entry => entry && toTime(entry.createdAt) > 0);
    const counts = {};
    let total = 0;

    for (const entry of valid) {
      counts[entry.mood] = (counts[entry.mood] || 0) + 1;
      total += moodMeta(entry.mood).score;
    }

    const byDay = new Map();
    for (const entry of valid) {
      const key = dayKey(entry.createdAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(moodMeta(entry.mood).score);
    }

    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * DAY);
      const scores = byDay.get(dayKey(date)) || [];
      series.push({
        date: dayKey(date),
        label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        count: scores.length,
        average: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null
      });
    }

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      total: valid.length,
      counts,
      average: valid.length ? Number((total / valid.length).toFixed(2)) : 0,
      series,
      streak: currentStreak(valid, now),
      topMood: ranked.length ? ranked[0][0] : null
    };
  }

  // Consecutive days ending today. A one-day gap is tolerated only when today
  // has no entry yet, so a streak is not declared broken before the day is over.
  function currentStreak(entries = [], now = Date.now()) {
    const logged = new Set(entries.map(entry => dayKey(entry.createdAt)).filter(Boolean));
    if (!logged.size) return 0;

    let cursor = new Date(now);
    if (!logged.has(dayKey(cursor))) {
      cursor = new Date(cursor.getTime() - DAY);
      if (!logged.has(dayKey(cursor))) return 0;
    }

    let streak = 0;
    while (logged.has(dayKey(cursor))) {
      streak++;
      cursor = new Date(cursor.getTime() - DAY);
    }
    return streak;
  }

  /* ------------------------------------------------------------------ *
   * CSV export
   * ------------------------------------------------------------------ */

  function toCsv(rows = [], columns = []) {
    const escapeCell = value => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = columns.map(column => escapeCell(column.label ?? column.key)).join(',');
    const body = rows.map(row => columns.map(column => escapeCell(row[column.key])).join(','));
    return [header, ...body].join('\r\n');
  }

  return {
    escapeHtml, escapeAttr, safeUrl,
    sha256Hex, hashPassword, verifyPassword, isHashedPassword, constantTimeEqual, PASSWORD_ROUNDS,
    validateEmail, passwordStrength, PASSWORD_RULES,
    uid, nextId, byNewest, byOldest, searchItems, truncate, toTime,
    formatDate, relativeTime, dayKey,
    MOODS, moodMeta, moodStats, currentStreak,
    toCsv
  };
});
