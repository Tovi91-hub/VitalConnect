# VitalConnect

A community wellness platform: mood tracking, a prayer wall, a marketplace for
shared resources, and a board for practical help. Built as a Purdue Global
IT499 capstone for static hosting — plain HTML, CSS, and JavaScript, no build
step, no dependencies, no server.

## Running it

Any static file server works:

```bash
npx http-server -p 8127 -s .
# then open http://127.0.0.1:8127
```

Opening `index.html` straight from the filesystem also works, though a server
is closer to how it will be deployed.

### Demo accounts

| Email                     | Password       | Role   |
| ------------------------- | -------------- | ------ |
| `demo@vitalconnect.com`   | `Password123!` | member |
| `admin@vitalconnect.com`  | `Admin123!`    | admin  |
| `maria@vitalconnect.com`  | `Password123!` | member |
| `james@vitalconnect.com`  | `Password123!` | member |

Seed data is created on first load and dated relative to today, so the charts
and activity feed look alive straight away. To start over, clear the site's
LocalStorage in your browser's developer tools and reload.

## Deploying

Upload the repository contents to the hosting space with `index.html` at the
root. Keep every file in the same folder — all paths are relative. Nothing
needs to be compiled or installed.

## How it is organised

```
core.js          Pure logic: hashing, validation, formatting, statistics.
                 No browser APIs, so it is unit tested directly under Node.
app.js           Storage, sessions, page chrome, theming, router, charts.
auth.js          Login, registration, profile, dashboard.
mood.js          Mood check-in and mood history.
community.js     Prayer wall, marketplace, help board, my posts.
style.css        The whole design system: tokens, components, responsive rules.
tests/           Unit tests (Node) and end-to-end tests (Playwright).
```

Every page loads `core.js` and `app.js`, then just the one feature file it
needs. `app.js` owns a small router that calls the matching `init*` function
after seeding, the auth guard, and the shared header and footer have run.

### Data model

Everything lives in LocalStorage under `vc_*` keys: `vc_users`, `vc_session`,
`vc_moods`, `vc_prayers`, `vc_blessings`, `vc_help_requests`, plus `vc_theme`
and `vc_schema`. Collections are versioned — `migrate()` in `app.js` upgrades
data saved by an earlier version rather than discarding it.

## Testing

```bash
node tests/core.test.mjs     # 45 unit tests, no dependencies

npx http-server -p 8127 -s . # in one terminal
node tests/e2e.mjs           # 93 browser checks (needs Playwright)
```

The end-to-end suite covers sign-in and the auth guard, full create/read/
update/delete on every board, ownership rules, mobile navigation, keyboard
access, duplicate-id and labelling checks, recovery from corrupted storage,
and resistance to injected markup. It fails the run if the browser console
reports any error.

## Notes on security

This is coursework, and it is worth being precise about what that means.

**What is done properly.** Passwords are never stored in plaintext: each is
salted and stretched over 2,000 rounds of SHA-256, compared in constant time,
and existing plaintext records are migrated on first load. All user-supplied
text is escaped for its context — including attribute values, which is where
the previous version was injectable. Image URLs are checked against an
allowlist, so a tampered store cannot turn a listing into a script URL. The
post-login redirect only accepts known internal pages, so `?next=` cannot be
used to bounce someone to another site. Ownership is re-checked before any
edit or delete rather than trusted from the rendered markup.

**What cannot be done here.** A browser-only application has no server and no
secret. Anyone with access to the device can read or edit LocalStorage
directly, and can attack the stored digests offline at their leisure. The
login throttle is a usability guardrail, not a security control — clearing
storage resets it. Treat VitalConnect as a demonstration of the front-end
practices, not as a system to trust with a real password.

## Accessibility

Landmarks and headings are structured, every control is labelled and reachable
by keyboard, focus is visible throughout and trapped inside dialogs, status
messages are announced through live regions, and charts carry both text
descriptions and a hidden data table. The interface honours
`prefers-color-scheme`, `prefers-reduced-motion`, and `prefers-contrast`.

## Browser support

Current versions of Chrome, Edge, Firefox, and Safari. The stylesheet avoids
`color-mix()` and `:has()` in favour of explicit tokens and sibling selectors,
and SHA-256 is implemented in plain JavaScript rather than via `crypto.subtle`,
which is unavailable outside secure contexts — so the app works over plain
HTTP and from `file://` as well as over HTTPS.

---

VitalConnect is an academic project. It is not a medical, counselling, or
emergency service. In a crisis in the US, call or text **988** for the Suicide
& Crisis Lifeline.
