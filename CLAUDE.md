# VitalConnect — notes for Claude

## Preferences

**Time zone: Pacific (America/Los_Angeles).** Report times in PT, not UTC —
GitHub and CI timestamps come back in UTC, so convert before quoting them.
This holds until the owner says otherwise; edit this line to change it.

## What this is

A Purdue Global IT499 capstone: a community wellness site with mood tracking,
a prayer wall, a marketplace for shared resources, and a help board.

**The architecture is a constraint, not an accident.** Plain HTML, CSS, and
JavaScript — no build step, no dependencies, no server, no framework. It has
to run from static hosting and from `file://`. Do not introduce npm packages,
a bundler, or a backend without being asked; suggest them instead.

## Layout

```
core.js          Pure logic: hashing, validation, formatting, statistics.
                 No browser APIs, so it unit tests directly under Node.
app.js           Storage, sessions, page chrome, theming, router, charts.
auth.js          Login, registration, profile, dashboard.
mood.js          Mood check-in and mood history.
community.js     Prayer wall, marketplace, help board, my posts.
style.css        The whole design system.
tests/           Unit tests (Node) and end-to-end tests (Playwright).
```

Every page loads `core.js`, then `app.js`, then one feature file. `app.js`
boots on `DOMContentLoaded` and routes to the page's `init*` function — it
must not boot earlier, or the feature file has not parsed yet.

Anything a feature file calls has to be re-exported on `VitalConnect` in
`app.js`. A missing re-export fails at runtime, not at load.

## Testing

```bash
node tests/core.test.mjs        # 45 unit tests, no dependencies

npx http-server -p 8127 -s .    # one terminal
node tests/e2e.mjs              # 100 browser checks (Playwright)
```

Playwright is installed globally, not in the project. Resolve it through
`npm root -g` — a bare `import 'playwright'` fails under ESM.

Run both before pushing. The browser suite fails the run on any console error.

## Things that will bite you

- **Escaping is context-aware.** `escapeHtml` for text, `escapeAttr` for
  attribute values, `safeUrl` for anything reaching `src`/`href`. Mixing them
  up reintroduces the attribute-injection XSS this project already had once.
- **Passwords** are `sha256$<rounds>$<salt>$<digest>`, 2000 rounds, compared
  in constant time. SHA-256 is hand-rolled because `crypto.subtle` needs a
  secure context and this must work over plain HTTP and `file://`.
- **Storage writes can fail** (quota, private mode). `setCollection` returns a
  boolean — check it before showing a success toast.
- **Schema changes** need a bump to `SCHEMA_VERSION` and a forward migration
  in `migrate()`. Migrations are all-or-nothing: leave the version alone if
  any write fails.
- **CSS avoids `color-mix()` and `:has()`** on purpose, for older browsers.
  Use the explicit tint tokens and sibling selectors already in `style.css`.
- **Breakpoints are separate for a reason.** The nav collapses to the drawer
  at 1180px, where it stops fitting; the rest of the layout reflows at 940px
  and 620px. Do not merge them.
- **Grid and flex children need `min-width: 0`** or a wide child stretches its
  track past the viewport instead of scrolling inside its own box.

## Deploying

GitHub Pages builds from `main` — https://tovi91-hub.github.io/VitalConnect/.
Nothing is live until a PR merges. Hard-refresh after a CSS change.

## Not a real service

Academic project, browser-only, no server and no secret. Anyone with the
device can read or edit LocalStorage. It is not a medical, counselling, or
emergency service, and the crisis line in the footer stays.
