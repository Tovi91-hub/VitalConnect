// mood.js — defines init functions only; dispatch is handled by app.js

function initMoodCheck() {
  const shell   = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('mood-check.html')}
    <section class="card">
      <h2>Mood Check</h2>
      <p class="mini">Record how you are feeling and save your update to your personal history.</p>
      <div id="moodFeedback"></div>
      <form id="moodForm">
        <div class="form-row">
          <div class="form-group">
            <label for="mood">Current Mood</label>
            <select id="mood" name="mood" required>
              <option value="">Select mood</option>
              <option>Hopeful</option><option>Calm</option><option>Grateful</option>
              <option>Focused</option><option>Stressed</option><option>Tired</option>
            </select>
          </div>
          <div class="form-group">
            <label for="createdAt">Date and Time</label>
            <input id="createdAt" name="createdAt" type="datetime-local" required>
          </div>
        </div>
        <div class="form-group">
          <label for="notes">Reflection Notes</label>
          <textarea id="notes" name="notes" placeholder="Describe what influenced your mood today."></textarea>
        </div>
        <div class="form-actions">
          <button class="btn" type="submit">Save Mood Entry</button>
          <a class="btn-ghost" href="mood-history.html">View Mood History</a>
        </div>
      </form>
    </section>`;

  const form = document.querySelector('#moodForm');
  form.createdAt.value = new Date().toISOString().slice(0, 16);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const moods = VitalConnect.getCollection(VitalConnect.STORE.moods);
    moods.unshift({ id: VitalConnect.nextId(moods), mood: form.mood.value, notes: form.notes.value.trim(), createdAt: new Date(form.createdAt.value).toISOString(), authorEmail: session.email, authorName: session.name });
    VitalConnect.setCollection(VitalConnect.STORE.moods, moods);
    document.querySelector('#moodFeedback').innerHTML = VitalConnect.createNotice('Mood entry saved successfully.', 'success');
    form.reset();
    form.createdAt.value = new Date().toISOString().slice(0, 16);
  });
}

function initMoodHistory() {
  const shell   = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const moods  = VitalConnect.getCollection(VitalConnect.STORE.moods).filter(item => item.authorEmail === session.email).slice(0, 10);
  const counts = {};
  moods.forEach(item => { counts[item.mood] = (counts[item.mood] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('mood-history.html')}
    <section class="grid">
      <div class="card">
        <h2>Mood History</h2>
        <p class="mini">Your ten most recent entries are shown below.</p>
        <div class="chart">
          ${Object.keys(counts).length
            ? Object.entries(counts).map(([mood, value]) => `
                <div class="bar-wrap">
                  <span>${VitalConnect.sanitize(mood)}</span>
                  <div class="bar"><span style="width:${(value / max) * 100}%"></span></div>
                  <strong>${value}</strong>
                </div>`).join('')
            : '<div class="empty-state">No mood data yet.</div>'}
        </div>
      </div>
      <div class="collection">
        ${moods.length
          ? moods.map(item => `
              <article class="item-card">
                <div class="item-meta">
                  <span class="tag">${VitalConnect.sanitize(item.mood)}</span>
                  <span>${VitalConnect.formatDate(item.createdAt)}</span>
                </div>
                <p>${VitalConnect.sanitize(item.notes || 'No notes added.')}</p>
              </article>`).join('')
          : '<div class="empty-state">Start by submitting your first mood check.</div>'}
      </div>
    </section>`;
}
