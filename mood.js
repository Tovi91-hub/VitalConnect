/*!
 * VitalConnect — mood.js
 * Mood check-in and mood history. Invoked by the router in app.js.
 */
'use strict';

const MOOD_STORE = () => VitalConnect.STORE.moods;

const myMoods = session =>
  VitalConnect.getCollection(MOOD_STORE())
    .filter(item => item.authorEmail === session.email)
    .sort(VitalConnect.byNewest);

/** `datetime-local` needs local wall-clock time; toISOString() would shift it. */
function toLocalInputValue(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ==================================================================== *
 * Mood check
 * ==================================================================== */

function initMoodCheck() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  // The same form handles both creating and editing, driven by ?edit=<id>.
  const editId = new URLSearchParams(window.location.search).get('edit');
  const existing = editId
    ? VitalConnect.getCollection(MOOD_STORE()).find(item => String(item.id) === String(editId) && item.authorEmail === session.email)
    : null;

  if (editId && !existing) {
    VitalConnect.toast('That entry could not be found.', 'warning');
  }

  const selectedMood = existing?.mood || '';
  const energy = Number(existing?.energy) || 3;

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('mood-check.html')}
    <div class="stack">
      <section class="card">
        <h1>${existing ? 'Edit mood entry' : 'Mood check'}</h1>
        <p class="mini">${existing
          ? 'Update how you recorded this moment.'
          : 'Record how you are feeling. Entries are private to your account and stay on this device.'}</p>
        <div id="moodFeedback"></div>

        <form id="moodForm" novalidate>
          <fieldset class="form-group mood-fieldset">
            <legend>How are you feeling?</legend>
            <div class="mood-grid">
              ${VitalConnect.MOODS.map(mood => `
                <label class="mood-option tone-${VitalConnect.escAttr(mood.tone)}">
                  <input type="radio" name="mood" value="${VitalConnect.escAttr(mood.name)}"
                         ${mood.name === selectedMood ? 'checked' : ''}>
                  <span class="mood-name">${VitalConnect.esc(mood.name)}</span>
                </label>`).join('')}
            </div>
            <p class="field-error" id="mood-error" hidden></p>
          </fieldset>

          <div class="form-row">
            <div class="form-group">
              <label for="energy">Energy level: <output id="energyOut" for="energy">${energy}</output> of 5</label>
              <input id="energy" name="energy" type="range" min="1" max="5" step="1" value="${energy}">
              <p class="mini range-scale"><span>Drained</span><span>Energised</span></p>
            </div>
            <div class="form-group">
              <label for="createdAt">Date and time</label>
              <input id="createdAt" name="createdAt" type="datetime-local" required>
            </div>
          </div>

          <div class="form-group">
            <label for="notes">Reflection notes <span class="mini">(optional)</span></label>
            <textarea id="notes" name="notes" maxlength="500"
                      placeholder="What shaped how you feel today?">${VitalConnect.esc(existing?.notes || '')}</textarea>
            <p class="mini"><span id="notesCount">0</span>/500 characters</p>
          </div>

          <div class="form-actions">
            <button class="btn" type="submit">${existing ? 'Save changes' : 'Save mood entry'}</button>
            <a class="btn-ghost" href="mood-history.html">${existing ? 'Cancel' : 'View mood history'}</a>
          </div>
        </form>
      </section>

      ${existing ? '' : `
      <section class="card">
        <h2>Recent entries</h2>
        <div id="recentMoods"></div>
      </section>`}
    </div>`;

  const form = document.querySelector('#moodForm');
  form.createdAt.value = toLocalInputValue(existing ? new Date(existing.createdAt) : new Date());
  // A mood cannot be logged for the future; the browser enforces this too.
  form.createdAt.max = toLocalInputValue(new Date());

  const notesCount = document.querySelector('#notesCount');
  const updateNotes = () => { notesCount.textContent = String(form.notes.value.length); };
  form.notes.addEventListener('input', updateNotes);
  updateNotes();

  const energyOut = document.querySelector('#energyOut');
  form.energy.addEventListener('input', () => { energyOut.textContent = form.energy.value; });

  if (!existing) renderRecent(session);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const moodError = document.querySelector('#mood-error');
    const chosen = form.querySelector('input[name="mood"]:checked');

    if (!chosen) {
      moodError.textContent = 'Choose the mood that fits best.';
      moodError.hidden = false;
      form.querySelector('input[name="mood"]').focus();
      return;
    }
    moodError.hidden = true;

    const when = new Date(form.createdAt.value);
    if (Number.isNaN(when.getTime())) {
      VitalConnect.setFieldError(form.createdAt, 'Enter a valid date and time.');
      return;
    }
    if (when.getTime() > Date.now() + 60000) {
      VitalConnect.setFieldError(form.createdAt, 'You cannot log a mood in the future.');
      return;
    }
    VitalConnect.setFieldError(form.createdAt, '');

    const entries = VitalConnect.getCollection(MOOD_STORE());
    const payload = {
      mood: chosen.value,
      energy: Number(form.energy.value),
      notes: form.notes.value.trim(),
      createdAt: when.toISOString(),
      authorEmail: session.email,
      authorName: session.name
    };

    if (existing) {
      const updated = entries.map(item =>
        String(item.id) === String(existing.id) ? { ...item, ...payload, updatedAt: new Date().toISOString() } : item
      );
      if (!VitalConnect.setCollection(MOOD_STORE(), updated)) return;
      VitalConnect.setFlash('Mood entry updated.', 'success');
      window.location.href = 'mood-history.html';
      return;
    }

    entries.unshift({ id: VitalConnect.uid('mood'), ...payload });
    if (!VitalConnect.setCollection(MOOD_STORE(), entries)) return;

    document.querySelector('#moodFeedback').innerHTML =
      VitalConnect.createNotice('Mood entry saved.', 'success');
    VitalConnect.toast('Mood entry saved.', 'success');

    form.reset();
    form.createdAt.value = toLocalInputValue(new Date());
    form.energy.value = '3';
    energyOut.textContent = '3';
    updateNotes();
    renderRecent(session);
  });
}

function renderRecent(session) {
  const target = document.querySelector('#recentMoods');
  if (!target) return;

  const recent = myMoods(session).slice(0, 5);
  target.innerHTML = recent.length
    ? `<ul class="mini-list">${recent.map(item => `
        <li>
          <span class="tag tone-${VitalConnect.escAttr(VitalConnect.moodMeta(item.mood).tone)}">${VitalConnect.esc(item.mood)}</span>
          <span>${VitalConnect.esc(VitalConnect.relativeTime(item.createdAt))}</span>
          <span class="mini">${VitalConnect.esc(VitalConnect.truncate(item.notes || 'No notes.', 60))}</span>
        </li>`).join('')}</ul>`
    : '<div class="empty-state">No entries yet. Your first one appears here.</div>';
}

/* ==================================================================== *
 * Mood history
 * ==================================================================== */

const HISTORY_RANGES = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'All time', days: null }
];

function initMoodHistory() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const state = { range: '30', search: '', mood: 'all', sort: 'newest' };

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('mood-history.html')}
    <div class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h1>Mood history</h1>
            <p class="mini">Every entry you have recorded, with trends over time.</p>
          </div>
          <div class="form-actions">
            <button class="btn-ghost" type="button" id="exportMoods">Export CSV</button>
            <a class="btn" href="mood-check.html">New entry</a>
          </div>
        </div>

        <div class="filter-bar">
          <div class="form-group">
            <label for="rangeFilter">Time range</label>
            <select id="rangeFilter">
              ${HISTORY_RANGES.map(range => `<option value="${range.id}" ${range.id === state.range ? 'selected' : ''}>${range.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="moodFilter">Mood</label>
            <select id="moodFilter">
              <option value="all">All moods</option>
              ${VitalConnect.MOODS.map(mood => `<option value="${VitalConnect.escAttr(mood.name)}">${VitalConnect.esc(mood.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="sortFilter">Sort</label>
            <select id="sortFilter">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div class="form-group grow">
            <label for="searchFilter">Search notes</label>
            <input id="searchFilter" type="search" placeholder="e.g. deadline, family">
          </div>
        </div>
      </section>

      <div id="historyBody"></div>
    </div>`;

  const render = () => {
    const all = myMoods(session);
    const rangeDays = HISTORY_RANGES.find(range => range.id === state.range)?.days ?? null;
    const cutoff = rangeDays ? Date.now() - rangeDays * 86400000 : null;

    let filtered = all.filter(item => (cutoff ? VitalConnect.toTime(item.createdAt) >= cutoff : true));
    if (state.mood !== 'all') filtered = filtered.filter(item => item.mood === state.mood);
    filtered = VitalConnect.searchItems(filtered, state.search, ['notes', 'mood']);
    filtered.sort(state.sort === 'newest' ? VitalConnect.byNewest : VitalConnect.byOldest);

    // Chart window follows the selected range, capped so the SVG stays legible.
    const chartDays = Math.min(rangeDays || 90, 60);
    const stats = VitalConnect.moodStats(
      all.filter(item => (cutoff ? VitalConnect.toTime(item.createdAt) >= cutoff : true)),
      { days: chartDays }
    );

    document.querySelector('#historyBody').innerHTML = `
      <div class="grid grid-4">
        <div class="metric-card"><p>Entries shown</p><strong>${filtered.length}</strong><span class="metric-note">of ${all.length} total</span></div>
        <div class="metric-card"><p>Average mood</p><strong>${stats.total ? `${stats.average}/5` : '—'}</strong><span class="metric-note">In this range</span></div>
        <div class="metric-card"><p>Current streak</p><strong>${stats.streak}</strong><span class="metric-note">Consecutive days</span></div>
        <div class="metric-card"><p>Most frequent</p><strong>${VitalConnect.esc(stats.topMood || '—')}</strong><span class="metric-note">In this range</span></div>
      </div>

      <div class="grid grid-2">
        <section class="card">
          <h2>Trend</h2>
          <p class="mini">Average score per day, 1 (low) to 5 (high). Gaps are days with no entry.</p>
          ${VitalConnect.moodTrendChart(stats.series)}
        </section>
        <section class="card">
          <h2>Breakdown</h2>
          <p class="mini">How often each mood came up in this range.</p>
          ${VitalConnect.barChart(stats.counts, { total: stats.total })}
        </section>
      </div>

      <section class="collection" aria-label="Mood entries">
        ${filtered.length ? filtered.map(item => {
          const meta = VitalConnect.moodMeta(item.mood);
          return `
          <article class="item-card">
            <div class="item-meta">
              <span class="tag tone-${VitalConnect.escAttr(meta.tone)}">${VitalConnect.esc(item.mood)}</span>
              ${item.energy ? `<span>Energy ${VitalConnect.esc(String(item.energy))}/5</span>` : ''}
              <span><time datetime="${VitalConnect.escAttr(item.createdAt)}">${VitalConnect.esc(VitalConnect.formatDate(item.createdAt))}</time></span>
              ${item.updatedAt ? '<span class="muted">edited</span>' : ''}
            </div>
            <p>${VitalConnect.esc(item.notes || 'No notes added.')}</p>
            <div class="item-actions">
              <a class="btn-ghost" href="mood-check.html?edit=${encodeURIComponent(item.id)}">Edit</a>
              <button class="btn-danger" type="button" data-delete-mood="${VitalConnect.escAttr(String(item.id))}"
                      aria-label="Delete ${VitalConnect.escAttr(item.mood)} entry from ${VitalConnect.escAttr(VitalConnect.formatDate(item.createdAt))}">Delete</button>
            </div>
          </article>`;
        }).join('') : `<div class="empty-state">${all.length
          ? 'No entries match these filters. Try widening the time range.'
          : 'No entries yet. <a href="mood-check.html">Record your first mood check.</a>'}</div>`}
      </section>`;

    document.querySelectorAll('[data-delete-mood]').forEach(button => {
      button.addEventListener('click', async () => {
        const confirmed = await VitalConnect.confirmAction({
          title: 'Delete this entry?',
          body: 'It will be removed from your history and trend charts.',
          confirmLabel: 'Delete entry'
        });
        if (!confirmed) return;

        const id = button.dataset.deleteMood;
        const remaining = VitalConnect.getCollection(MOOD_STORE())
          .filter(item => !(String(item.id) === id && item.authorEmail === session.email));
        VitalConnect.setCollection(MOOD_STORE(), remaining);
        VitalConnect.toast('Entry deleted.', 'success');
        render();
      });
    });
  };

  document.querySelector('#rangeFilter').addEventListener('change', event => { state.range = event.target.value; render(); });
  document.querySelector('#moodFilter').addEventListener('change', event => { state.mood = event.target.value; render(); });
  document.querySelector('#sortFilter').addEventListener('change', event => { state.sort = event.target.value; render(); });

  // Debounced so a long note search does not re-render on every keystroke.
  let searchTimer;
  document.querySelector('#searchFilter').addEventListener('input', event => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => { state.search = value; render(); }, 180);
  });

  document.querySelector('#exportMoods').addEventListener('click', () => {
    const rows = myMoods(session).map(item => ({
      date: VitalConnect.formatDate(item.createdAt, { dateStyle: 'short', timeStyle: 'short' }),
      mood: item.mood,
      score: VitalConnect.moodMeta(item.mood).score,
      energy: item.energy ?? '',
      notes: item.notes || ''
    }));

    if (!rows.length) {
      VitalConnect.toast('There is nothing to export yet.', 'warning');
      return;
    }

    VitalConnect.download(
      `vitalconnect-moods-${VitalConnect.dayKey(Date.now())}.csv`,
      VitalConnect.toCsv(rows, [
        { key: 'date', label: 'Date' },
        { key: 'mood', label: 'Mood' },
        { key: 'score', label: 'Score' },
        { key: 'energy', label: 'Energy' },
        { key: 'notes', label: 'Notes' }
      ]),
      'text/csv;charset=utf-8'
    );
    VitalConnect.toast(`Exported ${rows.length} entries.`, 'success');
  });

  render();
}
