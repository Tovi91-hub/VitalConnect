/*!
 * VitalConnect — community.js
 * Prayer wall, blessing marketplace, community help board, and My Posts.
 * Invoked by the router in app.js.
 */
'use strict';

/* ==================================================================== *
 * Shared board plumbing
 * ==================================================================== */

const ownedBy = (item, session) => item.authorEmail === session.email;

/**
 * Wires up the delete buttons a board just rendered.
 *
 * Ownership is re-checked here rather than trusted from the markup: the button
 * is only drawn for the author, but a hand-crafted DOM node should still not be
 * able to remove somebody else's post.
 */
function bindDelete(selector, storeKey, session, rerender, copy) {
  document.querySelectorAll(selector).forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-id');
      const items = VitalConnect.getCollection(storeKey);
      const target = items.find(item => String(item.id) === id);
      if (!target || !ownedBy(target, session)) {
        VitalConnect.toast('You can only delete your own posts.', 'error');
        return;
      }

      const confirmed = await VitalConnect.confirmAction({
        title: copy?.title || 'Delete this post?',
        body: copy?.body || 'This cannot be undone.',
        confirmLabel: copy?.confirmLabel || 'Delete'
      });
      if (!confirmed) return;

      VitalConnect.setCollection(storeKey, items.filter(item => String(item.id) !== id));
      VitalConnect.toast('Post deleted.', 'success');
      rerender();
    });
  });
}

/** Toolbar of search + select filters shared by all three boards. */
function filterBar(config) {
  return `
    <div class="filter-bar">
      <div class="form-group grow">
        <label for="boardSearch">Search</label>
        <input id="boardSearch" type="search" placeholder="${VitalConnect.escAttr(config.searchPlaceholder)}" value="${VitalConnect.escAttr(config.state.search)}">
      </div>
      ${config.selects.map(select => `
        <div class="form-group">
          <label for="${VitalConnect.escAttr(select.id)}">${VitalConnect.esc(select.label)}</label>
          <select id="${VitalConnect.escAttr(select.id)}">
            ${select.options.map(([value, label]) => `
              <option value="${VitalConnect.escAttr(value)}" ${config.state[select.key] === value ? 'selected' : ''}>${VitalConnect.esc(label)}</option>`).join('')}
          </select>
        </div>`).join('')}
    </div>`;
}

/**
 * Binds the filter toolbar. The search input keeps focus and caret position
 * across re-renders, which a naive innerHTML refresh would throw away on every
 * keystroke.
 */
function bindFilters(state, render, selects) {
  const search = document.querySelector('#boardSearch');
  if (search) {
    let timer;
    search.addEventListener('input', event => {
      clearTimeout(timer);
      const value = event.target.value;
      const caret = event.target.selectionStart;
      timer = setTimeout(() => {
        state.search = value;
        render();
        const refreshed = document.querySelector('#boardSearch');
        if (refreshed) {
          refreshed.focus();
          refreshed.setSelectionRange(caret, caret);
        }
      }, 200);
    });
  }

  selects.forEach(select => {
    document.querySelector(`#${select.id}`)?.addEventListener('change', event => {
      state[select.key] = event.target.value;
      render();
    });
  });
}

const authorLine = item =>
  `${VitalConnect.esc(item.authorName)} · <time datetime="${VitalConnect.escAttr(item.createdAt)}">${VitalConnect.esc(VitalConnect.relativeTime(item.createdAt))}</time>${item.updatedAt ? ' · <span class="muted">edited</span>' : ''}`;

const SORT_OPTIONS = [['newest', 'Newest first'], ['oldest', 'Oldest first']];
const applySort = (items, sort) => items.sort(sort === 'oldest' ? VitalConnect.byOldest : VitalConnect.byNewest);

/* ==================================================================== *
 * Prayer wall
 * ==================================================================== */

function initPrayerWall() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const state = { search: '', scope: 'all', sort: 'newest', editing: null };
  const selects = [
    { id: 'scopeFilter', key: 'scope', label: 'Show', options: [['all', 'Everyone'], ['mine', 'Only mine'], ['prayed', 'I prayed for these']] },
    { id: 'sortFilter', key: 'sort', label: 'Sort', options: SORT_OPTIONS }
  ];

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('prayer-wall.html')}
    <div class="stack">
      <section class="card">
        <h1>Prayer wall</h1>
        <p class="mini">Share a request with the community, and let others know you are praying for theirs.</p>
        <div id="prayerFeedback"></div>
        <form id="prayerForm" novalidate>
          <div class="form-group">
            <label for="title">Title</label>
            <input id="title" name="title" required maxlength="80" placeholder="A short summary">
          </div>
          <div class="form-group">
            <label for="content">Your request</label>
            <textarea id="content" name="content" required maxlength="500" placeholder="Share as much or as little as you would like."></textarea>
            <p class="mini"><span id="contentCount">0</span>/500 characters</p>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit">Post request</button>
            <button class="btn-ghost" type="reset" id="cancelEdit" hidden>Cancel edit</button>
          </div>
        </form>
      </section>
      <div id="boardFilters"></div>
      <div id="boardBody"></div>
    </div>`;

  const form = document.querySelector('#prayerForm');
  const contentCount = document.querySelector('#contentCount');
  const updateCount = () => { contentCount.textContent = String(form.content.value.length); };
  form.content.addEventListener('input', updateCount);
  updateCount();

  const resetForm = () => {
    state.editing = null;
    form.reset();
    updateCount();
    form.querySelector('button[type="submit"]').textContent = 'Post request';
    document.querySelector('#cancelEdit').hidden = true;
  };

  document.querySelector('#cancelEdit').addEventListener('click', event => {
    event.preventDefault();
    resetForm();
  });

  const render = () => {
    const all = VitalConnect.getCollection(VitalConnect.STORE.prayers);
    let items = all.slice();
    if (state.scope === 'mine') items = items.filter(item => ownedBy(item, session));
    if (state.scope === 'prayed') items = items.filter(item => (item.prayedBy || []).includes(session.email));
    items = VitalConnect.searchItems(items, state.search, ['title', 'content', 'authorName']);
    applySort(items, state.sort);

    document.querySelector('#boardFilters').innerHTML =
      `<section class="card">${filterBar({ state, selects, searchPlaceholder: 'Search requests' })}</section>`;

    document.querySelector('#boardBody').innerHTML = `
      <p class="result-count" role="status">${items.length} of ${all.length} request${all.length === 1 ? '' : 's'}</p>
      <section class="collection">
        ${items.length ? items.map(item => {
          const prayedBy = item.prayedBy || [];
          const iPrayed = prayedBy.includes(session.email);
          return `
          <article class="item-card">
            <div class="item-meta">
              <span class="tag tag-prayer">Prayer</span>
              <span>${authorLine(item)}</span>
            </div>
            <h2>${VitalConnect.esc(item.title)}</h2>
            <p>${VitalConnect.esc(item.content)}</p>
            <div class="item-actions">
              <button class="btn-support ${iPrayed ? 'is-active' : ''}" type="button"
                      data-pray="${VitalConnect.escAttr(String(item.id))}"
                      aria-pressed="${iPrayed}">
                ${iPrayed ? 'Praying' : 'I am praying'}
                <span class="count">${prayedBy.length}</span>
              </button>
              ${ownedBy(item, session) ? `
                <button class="btn-ghost" type="button" data-edit="${VitalConnect.escAttr(String(item.id))}"
                        aria-label="Edit ${VitalConnect.escAttr(item.title)}">Edit</button>
                <button class="btn-danger" type="button" data-delete-prayer data-id="${VitalConnect.escAttr(String(item.id))}"
                        aria-label="Delete ${VitalConnect.escAttr(item.title)}">Delete</button>` : ''}
            </div>
          </article>`;
        }).join('') : `<div class="empty-state">${all.length ? 'No requests match your filters.' : 'No prayer requests yet. Be the first to post one.'}</div>`}
      </section>`;

    bindFilters(state, render, selects);

    // "I am praying" is a per-member toggle stored on the post itself, so the
    // count reflects distinct people rather than repeated clicks.
    document.querySelectorAll('[data-pray]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.pray;
        const updated = VitalConnect.getCollection(VitalConnect.STORE.prayers).map(item => {
          if (String(item.id) !== id) return item;
          const prayedBy = item.prayedBy || [];
          return {
            ...item,
            prayedBy: prayedBy.includes(session.email)
              ? prayedBy.filter(email => email !== session.email)
              : [...prayedBy, session.email]
          };
        });
        VitalConnect.setCollection(VitalConnect.STORE.prayers, updated);
        render();
      });
    });

    document.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => {
        const item = VitalConnect.getCollection(VitalConnect.STORE.prayers)
          .find(entry => String(entry.id) === button.dataset.edit);
        if (!item || !ownedBy(item, session)) return;

        state.editing = String(item.id);
        form.title.value = item.title;
        form.content.value = item.content;
        updateCount();
        form.querySelector('button[type="submit"]').textContent = 'Save changes';
        document.querySelector('#cancelEdit').hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.title.focus();
      });
    });

    bindDelete('[data-delete-prayer]', VitalConnect.STORE.prayers, session, render, {
      title: 'Delete this prayer request?',
      body: 'It will be removed from the wall for everyone.'
    });
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    VitalConnect.clearFieldErrors(form);

    const title = form.title.value.trim();
    const content = form.content.value.trim();
    if (!title) { VitalConnect.setFieldError(form.title, 'Give your request a short title.'); form.title.focus(); return; }
    if (content.length < 10) { VitalConnect.setFieldError(form.content, 'Please add a little more detail (at least 10 characters).'); form.content.focus(); return; }

    const items = VitalConnect.getCollection(VitalConnect.STORE.prayers);

    if (state.editing) {
      const updated = items.map(item =>
        String(item.id) === state.editing && ownedBy(item, session)
          ? { ...item, title, content, updatedAt: new Date().toISOString() }
          : item
      );
      VitalConnect.setCollection(VitalConnect.STORE.prayers, updated);
      VitalConnect.toast('Request updated.', 'success');
    } else {
      items.unshift({
        id: VitalConnect.uid('prayer'),
        title,
        content,
        authorEmail: session.email,
        authorName: session.name,
        createdAt: new Date().toISOString(),
        prayedBy: []
      });
      if (!VitalConnect.setCollection(VitalConnect.STORE.prayers, items)) return;
      VitalConnect.toast('Prayer request posted.', 'success');
    }

    resetForm();
    render();
  });

  render();
}

/* ==================================================================== *
 * Blessing marketplace
 * ==================================================================== */

const BLESSING_CATEGORIES = ['Items', 'Service', 'Food', 'Clothing', 'Furniture', 'Other'];

function initMarketplace() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const state = { search: '', category: 'all', status: 'available', sort: 'newest', editing: null };
  const selects = [
    { id: 'categoryFilter', key: 'category', label: 'Category', options: [['all', 'All categories'], ...BLESSING_CATEGORIES.map(name => [name, name])] },
    { id: 'statusFilter', key: 'status', label: 'Status', options: [['available', 'Available'], ['claimed', 'Claimed'], ['all', 'All']] },
    { id: 'sortFilter', key: 'sort', label: 'Sort', options: SORT_OPTIONS }
  ];

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('blessing-marketplace.html')}
    <div class="stack">
      <section class="card">
        <h1>Blessing marketplace</h1>
        <p class="mini">Offer items, services, or resources that could bless someone. Everything here is given freely.</p>
        <div id="marketFeedback"></div>
        <form id="marketForm" novalidate>
          <div class="form-group">
            <label for="title">Listing title</label>
            <input id="title" name="title" required maxlength="80" placeholder="What are you offering?">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="category">Category</label>
              <select id="category" name="category" required>
                <option value="">Select a category</option>
                ${BLESSING_CATEGORIES.map(name => `<option>${VitalConnect.esc(name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="location">Pickup or service location</label>
              <input id="location" name="location" required maxlength="80" placeholder="Neighbourhood or landmark">
            </div>
          </div>
          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" required maxlength="500" placeholder="Condition, quantity, timing, anything useful."></textarea>
          </div>
          <div class="form-group">
            <label for="image">Photo <span class="mini">(optional)</span></label>
            <input id="image" name="image" type="file" accept="image/*">
            <p class="mini">Photos are resized in your browser before being saved, so they do not fill up local storage.</p>
            <div id="imagePreview" class="image-preview" hidden></div>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit">Post blessing</button>
            <button class="btn-ghost" type="reset" id="cancelEdit" hidden>Cancel edit</button>
          </div>
        </form>
      </section>
      <div id="boardFilters"></div>
      <div id="boardBody"></div>
    </div>`;

  const form = document.querySelector('#marketForm');
  const preview = document.querySelector('#imagePreview');
  // Holds the resized data URL between selecting a file and submitting, and
  // carries the existing photo through an edit that does not replace it.
  let pendingImage = '';

  form.image.addEventListener('change', async () => {
    const file = form.image.files[0];
    if (!file) { pendingImage = ''; preview.hidden = true; preview.innerHTML = ''; return; }

    preview.hidden = false;
    preview.innerHTML = '<p class="mini">Processing photo…</p>';
    pendingImage = await VitalConnect.readImageScaled(file);

    if (!pendingImage) {
      preview.innerHTML = '<p class="mini">That file could not be read as an image.</p>';
      return;
    }
    preview.innerHTML = `<img src="${VitalConnect.escAttr(pendingImage)}" alt="Preview of the photo you selected">`;
  });

  const resetForm = () => {
    state.editing = null;
    pendingImage = '';
    form.reset();
    preview.hidden = true;
    preview.innerHTML = '';
    form.querySelector('button[type="submit"]').textContent = 'Post blessing';
    document.querySelector('#cancelEdit').hidden = true;
  };

  document.querySelector('#cancelEdit').addEventListener('click', event => {
    event.preventDefault();
    resetForm();
  });

  const render = () => {
    const all = VitalConnect.getCollection(VitalConnect.STORE.blessings);
    let items = all.slice();
    if (state.category !== 'all') items = items.filter(item => item.category === state.category);
    if (state.status !== 'all') items = items.filter(item => (item.status || 'available') === state.status);
    items = VitalConnect.searchItems(items, state.search, ['title', 'description', 'location', 'authorName']);
    applySort(items, state.sort);

    document.querySelector('#boardFilters').innerHTML =
      `<section class="card">${filterBar({ state, selects, searchPlaceholder: 'Search listings' })}</section>`;

    document.querySelector('#boardBody').innerHTML = `
      <p class="result-count" role="status">${items.length} of ${all.length} listing${all.length === 1 ? '' : 's'}</p>
      <section class="collection collection-grid">
        ${items.length ? items.map(item => {
          const claimed = (item.status || 'available') === 'claimed';
          // safeUrl rejects anything that is not an inline image, so a
          // hand-edited store cannot turn a listing into a script URL.
          const image = VitalConnect.safeUrl(item.image || '');
          return `
          <article class="item-card ${claimed ? 'is-claimed' : ''}">
            ${image ? `<img class="item-image" src="${VitalConnect.escAttr(image)}" alt="${VitalConnect.escAttr(item.title)}" loading="lazy">` : ''}
            <div class="item-meta">
              <span class="tag">${VitalConnect.esc(item.category)}</span>
              <span class="status-pill status-${claimed ? 'claimed' : 'available'}">${claimed ? 'Claimed' : 'Available'}</span>
              <span>${VitalConnect.esc(item.location)}</span>
            </div>
            <h2>${VitalConnect.esc(item.title)}</h2>
            <p>${VitalConnect.esc(item.description)}</p>
            <p class="mini muted">${authorLine(item)}</p>
            ${ownedBy(item, session) ? `
              <div class="item-actions">
                <button class="btn-ghost" type="button" data-toggle-status="${VitalConnect.escAttr(String(item.id))}">
                  Mark as ${claimed ? 'available' : 'claimed'}
                </button>
                <button class="btn-ghost" type="button" data-edit="${VitalConnect.escAttr(String(item.id))}"
                        aria-label="Edit ${VitalConnect.escAttr(item.title)}">Edit</button>
                <button class="btn-danger" type="button" data-delete-blessing data-id="${VitalConnect.escAttr(String(item.id))}"
                        aria-label="Delete ${VitalConnect.escAttr(item.title)}">Delete</button>
              </div>` : ''}
          </article>`;
        }).join('') : `<div class="empty-state">${all.length ? 'No listings match your filters.' : 'No listings yet. Share the first blessing.'}</div>`}
      </section>`;

    bindFilters(state, render, selects);

    document.querySelectorAll('[data-toggle-status]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.toggleStatus;
        const updated = VitalConnect.getCollection(VitalConnect.STORE.blessings).map(item =>
          String(item.id) === id && ownedBy(item, session)
            ? { ...item, status: (item.status || 'available') === 'claimed' ? 'available' : 'claimed' }
            : item
        );
        VitalConnect.setCollection(VitalConnect.STORE.blessings, updated);
        render();
      });
    });

    document.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => {
        const item = VitalConnect.getCollection(VitalConnect.STORE.blessings)
          .find(entry => String(entry.id) === button.dataset.edit);
        if (!item || !ownedBy(item, session)) return;

        state.editing = String(item.id);
        form.title.value = item.title;
        form.category.value = item.category;
        form.location.value = item.location;
        form.description.value = item.description;
        pendingImage = item.image || '';

        if (pendingImage) {
          preview.hidden = false;
          preview.innerHTML = `<img src="${VitalConnect.escAttr(VitalConnect.safeUrl(pendingImage))}" alt="Current listing photo">`;
        } else {
          preview.hidden = true;
          preview.innerHTML = '';
        }

        form.querySelector('button[type="submit"]').textContent = 'Save changes';
        document.querySelector('#cancelEdit').hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.title.focus();
      });
    });

    bindDelete('[data-delete-blessing]', VitalConnect.STORE.blessings, session, render, {
      title: 'Delete this listing?',
      body: 'It will be removed from the marketplace for everyone.'
    });
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    VitalConnect.clearFieldErrors(form);

    const title = form.title.value.trim();
    const category = form.category.value;
    const location = form.location.value.trim();
    const description = form.description.value.trim();

    if (!title) { VitalConnect.setFieldError(form.title, 'Give your listing a title.'); form.title.focus(); return; }
    if (!category) { VitalConnect.setFieldError(form.category, 'Choose a category.'); form.category.focus(); return; }
    if (!location) { VitalConnect.setFieldError(form.location, 'Say where this can be collected.'); form.location.focus(); return; }
    if (description.length < 10) { VitalConnect.setFieldError(form.description, 'Add a little more detail (at least 10 characters).'); form.description.focus(); return; }

    const items = VitalConnect.getCollection(VitalConnect.STORE.blessings);

    if (state.editing) {
      const updated = items.map(item =>
        String(item.id) === state.editing && ownedBy(item, session)
          ? { ...item, title, category, location, description, image: pendingImage, updatedAt: new Date().toISOString() }
          : item
      );
      if (!VitalConnect.setCollection(VitalConnect.STORE.blessings, updated)) return;
      VitalConnect.toast('Listing updated.', 'success');
    } else {
      items.unshift({
        id: VitalConnect.uid('blessing'),
        title, category, location, description,
        image: pendingImage,
        status: 'available',
        authorEmail: session.email,
        authorName: session.name,
        createdAt: new Date().toISOString()
      });
      if (!VitalConnect.setCollection(VitalConnect.STORE.blessings, items)) return;
      VitalConnect.toast('Blessing posted.', 'success');
    }

    resetForm();
    render();
  });

  render();
}

/* ==================================================================== *
 * Community help board
 * ==================================================================== */

const URGENCIES = ['Low', 'Medium', 'High'];

function initHelpBoard() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const state = { search: '', urgency: 'all', status: 'open', sort: 'newest', editing: null };
  const selects = [
    { id: 'urgencyFilter', key: 'urgency', label: 'Urgency', options: [['all', 'Any urgency'], ...URGENCIES.map(level => [level, level])] },
    { id: 'statusFilter', key: 'status', label: 'Status', options: [['open', 'Open'], ['fulfilled', 'Fulfilled'], ['all', 'All']] },
    { id: 'sortFilter', key: 'sort', label: 'Sort', options: SORT_OPTIONS }
  ];

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('help-board.html')}
    <div class="stack">
      <section class="card">
        <h1>Community help board</h1>
        <p class="mini">Ask for practical support, or offer to take on someone else's request.</p>
        <div id="helpFeedback"></div>
        <form id="helpForm" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label for="title">Request title</label>
              <input id="title" name="title" required maxlength="80" placeholder="What do you need?">
            </div>
            <div class="form-group">
              <label for="urgency">Urgency</label>
              <select id="urgency" name="urgency" required>
                <option value="">Select urgency</option>
                ${URGENCIES.map(level => `<option>${level}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="description">Details</label>
            <textarea id="description" name="description" required maxlength="500" placeholder="When, where, and what would help most."></textarea>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit">Submit request</button>
            <button class="btn-ghost" type="reset" id="cancelEdit" hidden>Cancel edit</button>
          </div>
        </form>
      </section>
      <div id="boardFilters"></div>
      <div id="boardBody"></div>
    </div>`;

  const form = document.querySelector('#helpForm');

  const resetForm = () => {
    state.editing = null;
    form.reset();
    form.querySelector('button[type="submit"]').textContent = 'Submit request';
    document.querySelector('#cancelEdit').hidden = true;
  };

  document.querySelector('#cancelEdit').addEventListener('click', event => {
    event.preventDefault();
    resetForm();
  });

  const render = () => {
    const all = VitalConnect.getCollection(VitalConnect.STORE.helpRequests);
    let items = all.slice();
    if (state.urgency !== 'all') items = items.filter(item => item.urgency === state.urgency);
    if (state.status !== 'all') items = items.filter(item => (item.status || 'open') === state.status);
    items = VitalConnect.searchItems(items, state.search, ['title', 'description', 'authorName']);
    applySort(items, state.sort);

    document.querySelector('#boardFilters').innerHTML =
      `<section class="card">${filterBar({ state, selects, searchPlaceholder: 'Search requests' })}</section>`;

    document.querySelector('#boardBody').innerHTML = `
      <p class="result-count" role="status">${items.length} of ${all.length} request${all.length === 1 ? '' : 's'}</p>
      <section class="collection">
        ${items.length ? items.map(item => {
          const offers = item.offers || [];
          const fulfilled = (item.status || 'open') === 'fulfilled';
          const iOffered = offers.includes(session.email);
          const mine = ownedBy(item, session);
          return `
          <article class="item-card ${fulfilled ? 'is-claimed' : ''}">
            <div class="item-meta">
              <span class="tag urgency-${VitalConnect.escAttr(String(item.urgency).toLowerCase())}">${VitalConnect.esc(item.urgency)} urgency</span>
              <span class="status-pill status-${fulfilled ? 'claimed' : 'available'}">${fulfilled ? 'Fulfilled' : 'Open'}</span>
              <span>${authorLine(item)}</span>
            </div>
            <h2>${VitalConnect.esc(item.title)}</h2>
            <p>${VitalConnect.esc(item.description)}</p>
            ${offers.length ? `<p class="mini muted">${offers.length} member${offers.length === 1 ? '' : 's'} offered to help.</p>` : ''}
            <div class="item-actions">
              ${!mine && !fulfilled ? `
                <button class="btn-support ${iOffered ? 'is-active' : ''}" type="button"
                        data-offer="${VitalConnect.escAttr(String(item.id))}" aria-pressed="${iOffered}">
                  ${iOffered ? 'You offered to help' : 'Offer to help'}
                </button>` : ''}
              ${mine ? `
                <button class="btn-ghost" type="button" data-toggle-status="${VitalConnect.escAttr(String(item.id))}">
                  Mark as ${fulfilled ? 'open' : 'fulfilled'}
                </button>
                <button class="btn-ghost" type="button" data-edit="${VitalConnect.escAttr(String(item.id))}"
                        aria-label="Edit ${VitalConnect.escAttr(item.title)}">Edit</button>
                <button class="btn-danger" type="button" data-delete-help data-id="${VitalConnect.escAttr(String(item.id))}"
                        aria-label="Delete ${VitalConnect.escAttr(item.title)}">Delete</button>` : ''}
            </div>
          </article>`;
        }).join('') : `<div class="empty-state">${all.length ? 'No requests match your filters.' : 'No open requests right now.'}</div>`}
      </section>`;

    bindFilters(state, render, selects);

    document.querySelectorAll('[data-offer]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.offer;
        const updated = VitalConnect.getCollection(VitalConnect.STORE.helpRequests).map(item => {
          if (String(item.id) !== id) return item;
          const offers = item.offers || [];
          return {
            ...item,
            offers: offers.includes(session.email)
              ? offers.filter(email => email !== session.email)
              : [...offers, session.email]
          };
        });
        VitalConnect.setCollection(VitalConnect.STORE.helpRequests, updated);
        VitalConnect.toast('Thanks — the member can see your offer.', 'success');
        render();
      });
    });

    document.querySelectorAll('[data-toggle-status]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.toggleStatus;
        const updated = VitalConnect.getCollection(VitalConnect.STORE.helpRequests).map(item =>
          String(item.id) === id && ownedBy(item, session)
            ? { ...item, status: (item.status || 'open') === 'fulfilled' ? 'open' : 'fulfilled' }
            : item
        );
        VitalConnect.setCollection(VitalConnect.STORE.helpRequests, updated);
        render();
      });
    });

    document.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => {
        const item = VitalConnect.getCollection(VitalConnect.STORE.helpRequests)
          .find(entry => String(entry.id) === button.dataset.edit);
        if (!item || !ownedBy(item, session)) return;

        state.editing = String(item.id);
        form.title.value = item.title;
        form.urgency.value = item.urgency;
        form.description.value = item.description;
        form.querySelector('button[type="submit"]').textContent = 'Save changes';
        document.querySelector('#cancelEdit').hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.title.focus();
      });
    });

    bindDelete('[data-delete-help]', VitalConnect.STORE.helpRequests, session, render, {
      title: 'Delete this request?',
      body: 'It will be removed from the help board for everyone.'
    });
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    VitalConnect.clearFieldErrors(form);

    const title = form.title.value.trim();
    const urgency = form.urgency.value;
    const description = form.description.value.trim();

    if (!title) { VitalConnect.setFieldError(form.title, 'Give your request a title.'); form.title.focus(); return; }
    if (!urgency) { VitalConnect.setFieldError(form.urgency, 'Choose an urgency level.'); form.urgency.focus(); return; }
    if (description.length < 10) { VitalConnect.setFieldError(form.description, 'Add a little more detail (at least 10 characters).'); form.description.focus(); return; }

    const items = VitalConnect.getCollection(VitalConnect.STORE.helpRequests);

    if (state.editing) {
      const updated = items.map(item =>
        String(item.id) === state.editing && ownedBy(item, session)
          ? { ...item, title, urgency, description, updatedAt: new Date().toISOString() }
          : item
      );
      VitalConnect.setCollection(VitalConnect.STORE.helpRequests, updated);
      VitalConnect.toast('Request updated.', 'success');
    } else {
      items.unshift({
        id: VitalConnect.uid('help'),
        title, urgency, description,
        status: 'open',
        offers: [],
        authorEmail: session.email,
        authorName: session.name,
        createdAt: new Date().toISOString()
      });
      if (!VitalConnect.setCollection(VitalConnect.STORE.helpRequests, items)) return;
      VitalConnect.toast('Help request submitted.', 'success');
    }

    resetForm();
    render();
  });

  render();
}

/* ==================================================================== *
 * My posts
 * ==================================================================== */

function initMyPosts() {
  const shell = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const state = { tab: 'all', search: '' };

  const collect = () => {
    const mine = (key, kind, config) =>
      VitalConnect.getCollection(key)
        .filter(item => ownedBy(item, session))
        .map(item => ({ ...item, kind, storeKey: key, ...config(item) }));

    return [
      ...mine(VitalConnect.STORE.prayers, 'Prayer', item => ({
        summary: item.content,
        editHref: 'prayer-wall.html',
        badge: `${(item.prayedBy || []).length} praying`
      })),
      ...mine(VitalConnect.STORE.blessings, 'Blessing', item => ({
        summary: item.description,
        editHref: 'blessing-marketplace.html',
        badge: (item.status || 'available') === 'claimed' ? 'Claimed' : 'Available'
      })),
      ...mine(VitalConnect.STORE.helpRequests, 'Help', item => ({
        summary: item.description,
        editHref: 'help-board.html',
        badge: (item.status || 'open') === 'fulfilled' ? 'Fulfilled' : `${(item.offers || []).length} offers`
      })),
      ...mine(VitalConnect.STORE.moods, 'Mood', item => ({
        title: `${item.mood} check-in`,
        summary: item.notes || 'No notes added.',
        editHref: `mood-check.html?edit=${encodeURIComponent(item.id)}`,
        badge: `${VitalConnect.moodMeta(item.mood).score}/5`
      }))
    ].sort(VitalConnect.byNewest);
  };

  const TABS = [['all', 'All'], ['Prayer', 'Prayers'], ['Blessing', 'Listings'], ['Help', 'Requests'], ['Mood', 'Moods']];

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('my-posts.html')}
    <div class="stack">
      <section class="card">
        <h1>My posts</h1>
        <p class="mini">Everything you have shared, in one place. Edit or remove any of it.</p>
        <div class="tab-row" role="tablist" aria-label="Filter by post type">
          ${TABS.map(([id, label]) => `
            <button class="tab" type="button" role="tab" data-tab="${id}"
                    aria-selected="${id === state.tab}" id="tab-${id}">${label} <span class="tab-count" data-count="${id}"></span></button>`).join('')}
        </div>
        <div class="form-group">
          <label for="boardSearch">Search my posts</label>
          <input id="boardSearch" type="search" placeholder="Search titles and details">
        </div>
      </section>
      <div id="boardBody"></div>
    </div>`;

  const render = () => {
    const all = collect();

    document.querySelectorAll('[data-count]').forEach(node => {
      const id = node.dataset.count;
      node.textContent = String(id === 'all' ? all.length : all.filter(item => item.kind === id).length);
    });

    let items = state.tab === 'all' ? all : all.filter(item => item.kind === state.tab);
    items = VitalConnect.searchItems(items, state.search, ['title', 'summary']);

    document.querySelector('#boardBody').innerHTML = `
      <p class="result-count" role="status">${items.length} post${items.length === 1 ? '' : 's'}</p>
      <section class="collection">
        ${items.length ? items.map(item => `
          <article class="item-card">
            <div class="item-meta">
              <span class="tag tag-${VitalConnect.esc(item.kind.toLowerCase())}">${VitalConnect.esc(item.kind)}</span>
              <span>${VitalConnect.esc(item.badge)}</span>
              <span><time datetime="${VitalConnect.escAttr(item.createdAt)}">${VitalConnect.esc(VitalConnect.formatDate(item.createdAt))}</time></span>
            </div>
            <h2>${VitalConnect.esc(item.title)}</h2>
            <p>${VitalConnect.esc(VitalConnect.truncate(item.summary, 200))}</p>
            <div class="item-actions">
              <a class="btn-ghost" href="${VitalConnect.escAttr(item.editHref)}">Open</a>
              <button class="btn-danger" type="button" data-delete-mine data-id="${VitalConnect.escAttr(String(item.id))}"
                      data-store="${VitalConnect.escAttr(item.storeKey)}"
                      aria-label="Delete ${VitalConnect.escAttr(item.title)}">Delete</button>
            </div>
          </article>`).join('') : `<div class="empty-state">${all.length
            ? 'Nothing matches this filter.'
            : 'You have not posted anything yet. Try the <a href="prayer-wall.html">prayer wall</a> or the <a href="blessing-marketplace.html">marketplace</a>.'}</div>`}
      </section>`;

    document.querySelectorAll('[data-delete-mine]').forEach(button => {
      button.addEventListener('click', async () => {
        const confirmed = await VitalConnect.confirmAction({
          title: 'Delete this post?',
          body: 'This cannot be undone.',
          confirmLabel: 'Delete'
        });
        if (!confirmed) return;

        const storeKey = button.dataset.store;
        const id = button.dataset.id;
        const remaining = VitalConnect.getCollection(storeKey)
          .filter(item => !(String(item.id) === id && ownedBy(item, session)));
        VitalConnect.setCollection(storeKey, remaining);
        VitalConnect.toast('Post deleted.', 'success');
        render();
      });
    });
  };

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.tab = button.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(tab =>
        tab.setAttribute('aria-selected', String(tab.dataset.tab === state.tab))
      );
      render();
    });
  });

  let searchTimer;
  document.querySelector('#boardSearch').addEventListener('input', event => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => { state.search = value; render(); }, 200);
  });

  render();
}
