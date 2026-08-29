/**
 * Unit tests for core.js.
 *
 * Run with: node tests/core.test.mjs
 *
 * core.js is deliberately free of browser APIs, so it loads straight into Node
 * with no jsdom, no bundler, and no dependencies.
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const Core = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'core.js'));

/* ------------------------------------------------------------------ *
 * Tiny test harness
 * ------------------------------------------------------------------ */

let passed = 0;
const failures = [];
let currentSuite = '';

const suite = name => { currentSuite = name; console.log(`\n${name}`); };

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push({ suite: currentSuite, name, error });
    console.log(`  FAIL ${name}`);
    console.log(`       ${error.message}`);
  }
}

function assert(condition, message = 'expected a truthy value') {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(message || `expected ${b}, got ${a}`);
}

/* ------------------------------------------------------------------ *
 * Escaping
 * ------------------------------------------------------------------ */

suite('escapeHtml / escapeAttr / safeUrl');

test('escapes the five significant markup characters', () => {
  equal(Core.escapeHtml('<script>"x"&\'y\'</script>'),
    '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
});

test('escapes quotes, which the old sanitize() left intact', () => {
  // This is the regression that made attribute interpolation unsafe.
  assert(!Core.escapeHtml('" onerror="alert(1)').includes('"'),
    'a double quote survived escaping');
});

test('handles null and undefined without throwing', () => {
  equal(Core.escapeHtml(null), '');
  equal(Core.escapeHtml(undefined), '');
  equal(Core.escapeHtml(0), '0');
});

test('escapeAttr also neutralises backtick and equals', () => {
  equal(Core.escapeAttr('a=`b`'), 'a&#61;&#96;b&#96;');
});

test('safeUrl passes ordinary links and inline images', () => {
  equal(Core.safeUrl('https://example.com/a.png'), 'https://example.com/a.png');
  equal(Core.safeUrl('about.html'), 'about.html');
  equal(Core.safeUrl('./logo.svg'), './logo.svg');
  assert(Core.safeUrl('data:image/jpeg;base64,AAAA').startsWith('data:image/jpeg'));
});

test('safeUrl rejects script-bearing URLs, including obfuscated ones', () => {
  equal(Core.safeUrl('javascript:alert(1)'), '');
  equal(Core.safeUrl('  javascript:alert(1)'), '');
  equal(Core.safeUrl('java\nscript:alert(1)'), '');
  equal(Core.safeUrl('vbscript:msgbox'), '');
  equal(Core.safeUrl('data:text/html,<script>alert(1)</script>'), '');
  equal(Core.safeUrl(''), '');
});

/* ------------------------------------------------------------------ *
 * Hashing
 * ------------------------------------------------------------------ */

suite('sha256Hex');

test('matches the published NIST vectors', () => {
  equal(Core.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  equal(Core.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  equal(Core.sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('matches node crypto across block boundaries and unicode', () => {
  // 55, 56, 63, 64, and 65 bytes bracket the padding edge cases.
  for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
    const input = 'a'.repeat(length);
    equal(Core.sha256Hex(input), createHash('sha256').update(input).digest('hex'),
      `length ${length} disagreed with node crypto`);
  }
  const unicode = 'héllo wörld — 日本語 🎯';
  equal(Core.sha256Hex(unicode), createHash('sha256').update(unicode, 'utf8').digest('hex'));
});

suite('hashPassword / verifyPassword');

test('produces the documented storage format', () => {
  const stored = Core.hashPassword('Password123!', 'abc123');
  assert(/^sha256\$2000\$abc123\$[0-9a-f]{64}$/.test(stored), `unexpected format: ${stored}`);
  assert(Core.isHashedPassword(stored));
});

test('never stores the plaintext password', () => {
  assert(!Core.hashPassword('Password123!', 'abc123').includes('Password123!'));
});

test('verifies the correct password and rejects near misses', () => {
  const stored = Core.hashPassword('Password123!', Core.uid('salt'));
  assert(Core.verifyPassword('Password123!', stored), 'correct password was rejected');
  assert(!Core.verifyPassword('password123!', stored), 'case difference was accepted');
  assert(!Core.verifyPassword('Password123', stored), 'truncated password was accepted');
  assert(!Core.verifyPassword('', stored), 'empty password was accepted');
});

test('different salts give different digests for the same password', () => {
  const a = Core.hashPassword('same-password', 'salt-one');
  const b = Core.hashPassword('same-password', 'salt-two');
  assert(a !== b, 'salting had no effect');
});

test('rejects malformed or non-string stored values', () => {
  for (const value of [null, undefined, 42, '', 'plaintext', 'sha256$abc$salt$digest', 'md5$1$s$d']) {
    assert(!Core.verifyPassword('anything', value), `accepted malformed value: ${String(value)}`);
  }
});

test('rejects an absurd round count rather than hanging on it', () => {
  // A hand-edited store could otherwise freeze the tab for minutes.
  assert(!Core.verifyPassword('x', 'sha256$999999999$salt$' + 'a'.repeat(64)));
});

test('isHashedPassword distinguishes migrated from legacy records', () => {
  assert(Core.isHashedPassword(Core.hashPassword('x', 'y')));
  assert(!Core.isHashedPassword('Password123!'));
  assert(!Core.isHashedPassword(undefined));
});

test('constantTimeEqual behaves like equality', () => {
  assert(Core.constantTimeEqual('abc', 'abc'));
  assert(!Core.constantTimeEqual('abc', 'abd'));
  assert(!Core.constantTimeEqual('abc', 'abcd'));
});

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

suite('validateEmail / passwordStrength');

test('accepts ordinary addresses', () => {
  for (const email of ['a@b.co', 'first.last@example.com', 'user+tag@sub.example.org']) {
    assert(Core.validateEmail(email), `rejected valid address: ${email}`);
  }
});

test('rejects malformed addresses', () => {
  for (const email of ['', 'plain', 'a@b', 'a@b.', '@example.com', 'a b@example.com', 'a@@b.com']) {
    assert(!Core.validateEmail(email), `accepted invalid address: ${email}`);
  }
});

test('scores password strength on a 0-4 scale', () => {
  equal(Core.passwordStrength('').score, 0);
  assert(Core.passwordStrength('abc').score < 2, 'a three-letter password scored too well');
  equal(Core.passwordStrength('Password123!').score, 4);
  assert(Core.passwordStrength('Passw1!').score < 4, 'a seven-character password scored full marks');
});

test('reports which individual rules are met', () => {
  const met = Core.passwordStrength('abcdefgh').rules.filter(rule => rule.met).map(rule => rule.id);
  equal(met.sort(), ['length', 'letter']);
});

test('acceptable requires eight characters and three rules', () => {
  assert(!Core.passwordStrength('abc1!').acceptable, 'a five-character password was accepted');
  assert(!Core.passwordStrength('abcdefgh').acceptable, 'letters alone were accepted');
  assert(!Core.passwordStrength('12345678').acceptable, 'digits alone were accepted');
  // Eight characters with letters and digits meets the stated policy.
  assert(Core.passwordStrength('abcdefg1').acceptable, 'letters plus a number was rejected');
  assert(Core.passwordStrength('abcdefg1!').acceptable, 'a valid password was rejected');
});

/* ------------------------------------------------------------------ *
 * Collections
 * ------------------------------------------------------------------ */

suite('nextId / uid / searchItems / truncate');

test('nextId starts at one and never reuses an id', () => {
  equal(Core.nextId([]), 1);
  equal(Core.nextId([{ id: 1 }, { id: 4 }, { id: 2 }]), 5);
  equal(Core.nextId([{ id: 'x' }, { id: 3 }]), 4);
});

test('uid produces distinct prefixed ids', () => {
  const ids = new Set(Array.from({ length: 500 }, () => Core.uid('mood')));
  equal(ids.size, 500, 'uid collided within 500 calls');
  assert([...ids][0].startsWith('mood_'));
});

test('searchItems matches any named field, case-insensitively', () => {
  const items = [
    { title: 'Need a Ride', body: 'to the store' },
    { title: 'Coats', body: 'winter clothing' }
  ];
  equal(Core.searchItems(items, 'ride', ['title', 'body']).length, 1);
  equal(Core.searchItems(items, 'WINTER', ['title', 'body']).length, 1);
  equal(Core.searchItems(items, '', ['title']).length, 2, 'an empty term should not filter');
  equal(Core.searchItems(items, 'zzz', ['title', 'body']).length, 0);
});

test('searchItems tolerates missing fields', () => {
  equal(Core.searchItems([{ title: 'a' }], 'a', ['title', 'missing']).length, 1);
});

test('truncate only shortens strings past the limit', () => {
  equal(Core.truncate('short', 10), 'short');
  equal(Core.truncate('abcdefghij', 5), 'abcd…');
  equal(Core.truncate(null, 5), '');
});

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

suite('formatDate / relativeTime / dayKey');

test('invalid dates degrade to a label instead of "Invalid Date"', () => {
  equal(Core.formatDate('not-a-date'), 'Unknown date');
  equal(Core.relativeTime(undefined), 'Unknown date');
  equal(Core.dayKey('nonsense'), '');
});

test('relativeTime describes each bucket', () => {
  const now = Date.parse('2026-06-15T12:00:00Z');
  equal(Core.relativeTime(now - 30 * 1000, now), 'Just now');
  equal(Core.relativeTime(now - 60 * 1000, now), '1 minute ago');
  equal(Core.relativeTime(now - 5 * 60 * 1000, now), '5 minutes ago');
  equal(Core.relativeTime(now - 60 * 60 * 1000, now), '1 hour ago');
  equal(Core.relativeTime(now - 3 * 86400000, now), '3 days ago');
  equal(Core.relativeTime(now + 86400000, now), 'Scheduled');
});

test('dayKey buckets by local calendar day', () => {
  const date = new Date(2026, 0, 5, 23, 30); // 5 Jan, local time
  equal(Core.dayKey(date), '2026-01-05');
  // Late-evening local time must not roll forward the way toISOString would
  // for anyone west of UTC.
  equal(Core.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  equal(Core.dayKey(new Date(2026, 0, 6, 0, 1)), '2026-01-06');
});

/* ------------------------------------------------------------------ *
 * Mood statistics
 * ------------------------------------------------------------------ */

suite('moodStats / currentStreak');

const DAY = 86400000;
const at = (daysBack, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

test('summarises an empty history without dividing by zero', () => {
  const stats = Core.moodStats([]);
  equal(stats.total, 0);
  equal(stats.average, 0);
  equal(stats.streak, 0);
  equal(stats.topMood, null);
  equal(stats.series.length, 14);
  assert(stats.series.every(point => point.average === null));
});

test('counts entries and averages their scores', () => {
  const stats = Core.moodStats([
    { mood: 'Joyful', createdAt: at(0) },   // 5
    { mood: 'Sad', createdAt: at(1) },      // 1
    { mood: 'Calm', createdAt: at(2) }      // 4
  ]);
  equal(stats.total, 3);
  equal(stats.average, 3.33);
  equal(stats.counts, { Joyful: 1, Sad: 1, Calm: 1 });
});

test('identifies the most frequent mood', () => {
  const stats = Core.moodStats([
    { mood: 'Tired', createdAt: at(0) },
    { mood: 'Tired', createdAt: at(1) },
    { mood: 'Calm', createdAt: at(2) }
  ]);
  equal(stats.topMood, 'Tired');
});

test('leaves gaps as null rather than plotting a skipped day as zero', () => {
  const stats = Core.moodStats([{ mood: 'Calm', createdAt: at(0) }], { days: 3 });
  const logged = stats.series.filter(point => point.average !== null);
  equal(logged.length, 1);
  equal(logged[0].average, 4);
});

test('averages multiple entries recorded on the same day', () => {
  const stats = Core.moodStats([
    { mood: 'Joyful', createdAt: at(0, 9) },  // 5
    { mood: 'Sad', createdAt: at(0, 18) }     // 1
  ], { days: 1 });
  equal(stats.series[0].average, 3);
  equal(stats.series[0].count, 2);
});

test('discards entries with unusable timestamps', () => {
  const stats = Core.moodStats([
    { mood: 'Calm', createdAt: at(0) },
    { mood: 'Calm', createdAt: 'garbage' },
    null
  ]);
  equal(stats.total, 1);
});

test('an unknown mood scores neutral instead of throwing', () => {
  equal(Core.moodMeta('Wistful').score, 3);
  equal(Core.moodStats([{ mood: 'Wistful', createdAt: at(0) }]).average, 3);
});

test('streak counts consecutive days ending today', () => {
  equal(Core.currentStreak([
    { createdAt: at(0) }, { createdAt: at(1) }, { createdAt: at(2) }
  ]), 3);
});

test('streak survives a missing today, since the day is not over', () => {
  equal(Core.currentStreak([{ createdAt: at(1) }, { createdAt: at(2) }]), 2);
});

test('streak breaks on a real gap', () => {
  equal(Core.currentStreak([{ createdAt: at(0) }, { createdAt: at(3) }]), 1);
  equal(Core.currentStreak([{ createdAt: at(5) }]), 0);
});

test('several entries on one day count as a single streak day', () => {
  equal(Core.currentStreak([
    { createdAt: at(0, 8) }, { createdAt: at(0, 20) }, { createdAt: at(1) }
  ]), 2);
});

/* ------------------------------------------------------------------ *
 * Sorting
 * ------------------------------------------------------------------ */

suite('byNewest / byOldest');

test('orders by createdAt in both directions', () => {
  const items = [
    { id: 'b', createdAt: at(1) },
    { id: 'a', createdAt: at(0) },
    { id: 'c', createdAt: at(2) }
  ];
  equal(items.slice().sort(Core.byNewest).map(item => item.id), ['a', 'b', 'c']);
  equal(items.slice().sort(Core.byOldest).map(item => item.id), ['c', 'b', 'a']);
});

test('sorts unusable timestamps to the end rather than throwing', () => {
  const items = [{ id: 'bad', createdAt: 'x' }, { id: 'good', createdAt: at(0) }];
  equal(items.slice().sort(Core.byNewest)[0].id, 'good');
});

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

suite('toCsv');

test('writes a header row and one row per record', () => {
  const csv = Core.toCsv([{ a: 1, b: 2 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
  equal(csv, 'A,B\r\n1,2');
});

test('quotes cells containing commas, quotes, or newlines', () => {
  const csv = Core.toCsv(
    [{ note: 'one, two' }, { note: 'he said "hi"' }, { note: 'line\nbreak' }],
    [{ key: 'note', label: 'Note' }]
  );
  equal(csv.split('\r\n')[1], '"one, two"');
  equal(csv.split('\r\n')[2], '"he said ""hi"""');
  assert(csv.includes('"line\nbreak"'));
});

test('renders missing values as empty cells', () => {
  equal(Core.toCsv([{ a: null }], [{ key: 'a', label: 'A' }]), 'A\r\n');
});

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

const total = passed + failures.length;
console.log(`\n${'-'.repeat(52)}`);
console.log(`${passed}/${total} tests passed`);

if (failures.length) {
  console.log(`\n${failures.length} failing:`);
  for (const failure of failures) {
    console.log(`  ${failure.suite} > ${failure.name}`);
    console.log(`    ${failure.error.message}`);
  }
  process.exit(1);
}
