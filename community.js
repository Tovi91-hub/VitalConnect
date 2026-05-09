// community.js — defines init functions only; dispatch is handled by app.js

function bindDelete(selector, storeKey, rerender) {
  document.querySelectorAll(selector).forEach(button => {
    button.addEventListener('click', () => {
      const datasetKey = Object.keys(button.dataset)[0];
      const id = Number(button.dataset[datasetKey]);
      const items = VitalConnect.getCollection(storeKey).filter(item => Number(item.id) !== id);
      VitalConnect.setCollection(storeKey, items);
      rerender();
    });
  });
}

function renderPrayerItems(items, session) {
  if (!items.length) return '<div class="empty-state">No prayer requests yet.</div>';
  return items.map(item => `
    <article class="item-card">
      <div class="item-meta">
        <span class="tag">Prayer</span>
        <span>By ${VitalConnect.sanitize(item.authorName)}</span>
        <span>${VitalConnect.formatDate(item.createdAt)}</span>
      </div>
      <h3>${VitalConnect.sanitize(item.title)}</h3>
      <p>${VitalConnect.sanitize(item.content)}</p>
      ${item.authorEmail === session.email ? `<div class="item-actions"><button class="btn-danger" data-delete-prayer="${item.id}" type="button">Delete</button></div>` : ''}
    </article>`).join('');
}

function initPrayerWall() {
  const shell   = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;
  const prayers = VitalConnect.getCollection(VitalConnect.STORE.prayers).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('prayer-wall.html')}
    <section class="grid">
      <div class="card">
        <h2>Prayer Wall</h2>
        <p class="mini">Share a prayer request with the VitalConnect community.</p>
        <div id="prayerFeedback"></div>
        <form id="prayerForm">
          <div class="form-group"><label for="title">Prayer Title</label><input id="title" name="title" required maxlength="80"></div>
          <div class="form-group"><label for="content">Prayer Request</label><textarea id="content" name="content" required maxlength="500"></textarea></div>
          <div class="form-actions"><button class="btn" type="submit">Post Prayer Request</button></div>
        </form>
      </div>
      <div class="collection" id="prayerCollection">${renderPrayerItems(prayers, session)}</div>
    </section>`;

  document.querySelector('#prayerForm').addEventListener('submit', e => {
    e.preventDefault();
    const items = VitalConnect.getCollection(VitalConnect.STORE.prayers);
    items.unshift({ id: VitalConnect.nextId(items), title: e.target.title.value.trim(), content: e.target.content.value.trim(), authorEmail: session.email, authorName: session.name, createdAt: new Date().toISOString() });
    VitalConnect.setCollection(VitalConnect.STORE.prayers, items);
    initPrayerWall();
    document.querySelector('#prayerFeedback').innerHTML = VitalConnect.createNotice('Prayer request posted successfully.', 'success');
  });
  bindDelete('[data-delete-prayer]', VitalConnect.STORE.prayers, initPrayerWall);
}

function renderMarketplaceItems(items, session) {
  if (!items.length) return '<div class="empty-state">No marketplace listings yet.</div>';
  return items.map(item => `
    <article class="item-card">
      ${item.image ? `<img src="${VitalConnect.sanitize(item.image)}" alt="${VitalConnect.sanitize(item.title)}" style="height:180px;object-fit:cover;border-radius:14px;margin-bottom:14px">` : ''}
      <div class="item-meta">
        <span class="tag">${VitalConnect.sanitize(item.category)}</span>
        <span>${VitalConnect.sanitize(item.location)}</span>
        <span>${VitalConnect.formatDate(item.createdAt)}</span>
      </div>
      <h3>${VitalConnect.sanitize(item.title)}</h3>
      <p>${VitalConnect.sanitize(item.description)}</p>
      <p class="mini">Shared by ${VitalConnect.sanitize(item.authorName)}</p>
      ${item.authorEmail === session.email ? `<div class="item-actions"><button class="btn-danger" data-delete-blessing="${item.id}" type="button">Delete</button></div>` : ''}
    </article>`).join('');
}

function initMarketplace() {
  const shell    = document.querySelector('#featureShell');
  const session  = VitalConnect.getSession();
  if (!shell || !session) return;
  const blessings = VitalConnect.getCollection(VitalConnect.STORE.blessings).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('blessing-marketplace.html')}
    <section class="grid">
      <div class="card">
        <h2>Blessing Marketplace</h2>
        <p class="mini">Share items, services, or resources that may bless someone in the community.</p>
        <div id="marketFeedback"></div>
        <form id="marketForm">
          <div class="form-group"><label for="title">Listing Title</label><input id="title" name="title" required maxlength="80"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="category">Category</label>
              <select id="category" name="category" required>
                <option value="">Select category</option>
                <option>Items</option><option>Service</option><option>Food</option><option>Clothing</option>
              </select>
            </div>
            <div class="form-group"><label for="location">Pickup / Service Location</label><input id="location" name="location" required maxlength="80"></div>
          </div>
          <div class="form-group"><label for="description">Description</label><textarea id="description" name="description" required maxlength="500"></textarea></div>
          <div class="form-group"><label for="image">Optional Image Upload</label><input id="image" name="image" type="file" accept="image/*"></div>
          <div class="form-actions"><button class="btn" type="submit">Post Blessing</button></div>
        </form>
      </div>
      <div class="collection">${renderMarketplaceItems(blessings, session)}</div>
    </section>`;

  document.querySelector('#marketForm').addEventListener('submit', async e => {
    e.preventDefault();
    const items     = VitalConnect.getCollection(VitalConnect.STORE.blessings);
    const file      = e.target.image.files[0];
    const imageData = file ? await fileToDataUrl(file) : '';
    items.unshift({ id: VitalConnect.nextId(items), title: e.target.title.value.trim(), category: e.target.category.value, location: e.target.location.value.trim(), description: e.target.description.value.trim(), image: imageData, authorEmail: session.email, authorName: session.name, createdAt: new Date().toISOString() });
    VitalConnect.setCollection(VitalConnect.STORE.blessings, items);
    initMarketplace();
    document.querySelector('#marketFeedback').innerHTML = VitalConnect.createNotice('Blessing posted successfully.', 'success');
  });
  bindDelete('[data-delete-blessing]', VitalConnect.STORE.blessings, initMarketplace);
}

function renderHelpItems(items, session) {
  if (!items.length) return '<div class="empty-state">No help requests yet.</div>';
  return items.map(item => `
    <article class="item-card">
      <div class="item-meta">
        <span class="tag">${VitalConnect.sanitize(item.urgency)} urgency</span>
        <span>By ${VitalConnect.sanitize(item.authorName)}</span>
        <span>${VitalConnect.formatDate(item.createdAt)}</span>
      </div>
      <h3>${VitalConnect.sanitize(item.title)}</h3>
      <p>${VitalConnect.sanitize(item.description)}</p>
      ${item.authorEmail === session.email ? `<div class="item-actions"><button class="btn-danger" data-delete-help="${item.id}" type="button">Delete</button></div>` : ''}
    </article>`).join('');
}

function initHelpBoard() {
  const shell   = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;
  const items = VitalConnect.getCollection(VitalConnect.STORE.helpRequests).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('help-board.html')}
    <section class="grid">
      <div class="card">
        <h2>Community Help Board</h2>
        <p class="mini">Request support from the community and explain the need clearly.</p>
        <div id="helpFeedback"></div>
        <form id="helpForm">
          <div class="form-group"><label for="title">Request Title</label><input id="title" name="title" required maxlength="80"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="urgency">Urgency</label>
              <select id="urgency" name="urgency" required>
                <option value="">Select urgency</option>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>
            <div class="form-group"><label for="description">Details</label><textarea id="description" name="description" required maxlength="500"></textarea></div>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Submit Help Request</button></div>
        </form>
      </div>
      <div class="collection">${renderHelpItems(items, session)}</div>
    </section>`;

  document.querySelector('#helpForm').addEventListener('submit', e => {
    e.preventDefault();
    const all = VitalConnect.getCollection(VitalConnect.STORE.helpRequests);
    all.unshift({ id: VitalConnect.nextId(all), title: e.target.title.value.trim(), urgency: e.target.urgency.value, description: e.target.description.value.trim(), authorEmail: session.email, authorName: session.name, createdAt: new Date().toISOString() });
    VitalConnect.setCollection(VitalConnect.STORE.helpRequests, all);
    initHelpBoard();
    document.querySelector('#helpFeedback').innerHTML = VitalConnect.createNotice('Help request submitted successfully.', 'success');
  });
  bindDelete('[data-delete-help]', VitalConnect.STORE.helpRequests, initHelpBoard);
}

function initMyPosts() {
  const shell   = document.querySelector('#featureShell');
  const session = VitalConnect.getSession();
  if (!shell || !session) return;

  const prayers      = VitalConnect.getCollection(VitalConnect.STORE.prayers).filter(item => item.authorEmail === session.email);
  const blessings    = VitalConnect.getCollection(VitalConnect.STORE.blessings).filter(item => item.authorEmail === session.email);
  const helpRequests = VitalConnect.getCollection(VitalConnect.STORE.helpRequests).filter(item => item.authorEmail === session.email);

  shell.innerHTML = `
    ${VitalConnect.dashboardSidebar('my-posts.html')}
    <section class="grid">
      <div class="card"><h2>My Posts</h2><p class="mini">Manage your VitalConnect entries in one place.</p></div>
      <div class="card">
        <h3>Prayer Requests</h3>
        ${prayers.length ? prayers.map(item => `<div class="item-card"><strong>${VitalConnect.sanitize(item.title)}</strong><p>${VitalConnect.sanitize(item.content)}</p><button class="btn-danger" data-delete-prayer="${item.id}" type="button">Delete</button></div>`).join('') : '<div class="empty-state">No prayer posts yet.</div>'}
      </div>
      <div class="card">
        <h3>Marketplace Listings</h3>
        ${blessings.length ? blessings.map(item => `<div class="item-card"><strong>${VitalConnect.sanitize(item.title)}</strong><p>${VitalConnect.sanitize(item.description)}</p><button class="btn-danger" data-delete-blessing="${item.id}" type="button">Delete</button></div>`).join('') : '<div class="empty-state">No marketplace posts yet.</div>'}
      </div>
      <div class="card">
        <h3>Help Requests</h3>
        ${helpRequests.length ? helpRequests.map(item => `<div class="item-card"><strong>${VitalConnect.sanitize(item.title)}</strong><p>${VitalConnect.sanitize(item.description)}</p><button class="btn-danger" data-delete-help="${item.id}" type="button">Delete</button></div>`).join('') : '<div class="empty-state">No help requests yet.</div>'}
      </div>
    </section>`;

  bindDelete('[data-delete-prayer]',   VitalConnect.STORE.prayers,      initMyPosts);
  bindDelete('[data-delete-blessing]', VitalConnect.STORE.blessings,    initMyPosts);
  bindDelete('[data-delete-help]',     VitalConnect.STORE.helpRequests, initMyPosts);
}

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
