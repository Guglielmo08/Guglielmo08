// Frontend logic: talks to the backend API and draws the page.

const $ = (id) => document.getElementById(id);

let options = null;   // dropdown values from the backend
let current = null;   // the raid currently opened in the view dialog
let editingId = null; // id being edited (null = creating a new one)

// ---------- Talking to the backend ----------

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const pw = getPassword();
  if (pw) headers['x-admin-password'] = pw;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

  if (res.status === 401) {
    forgetPassword();
    throw new Error('Wrong admin password. Try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------- Admin password (only if the server asks for one) ----------

function getPassword() {
  try { return localStorage.getItem('adminPassword') || ''; } catch { return ''; }
}
function forgetPassword() {
  try { localStorage.removeItem('adminPassword'); } catch {}
}
function ensurePassword() {
  if (!options.passwordRequired || getPassword()) return true;
  const pw = prompt('Admin password:');
  if (!pw) return false;
  try { localStorage.setItem('adminPassword', pw); } catch {}
  return true;
}

// ---------- Small DOM helpers ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function fillSelect(select, values) {
  for (const v of values) select.append(el('option', { value: v }, v));
}

function tags(raid) {
  return el('div', { class: 'tags' },
    el('span', { class: `tag diff ${raid.difficulty}` }, raid.difficulty),
    el('span', { class: 'tag' }, raid.category),
    el('span', { class: 'tag' }, raid.tier),
  );
}

// ---------- List ----------

async function loadList() {
  const params = new URLSearchParams({
    search: $('search').value,
    category: $('filterCategory').value,
    tier: $('filterTier').value,
  });
  const raids = await api('GET', '/api/raids?' + params);

  const list = $('list');
  list.replaceChildren();
  for (const raid of raids) {
    const card = el('button', { class: 'card', type: 'button' },
      el('h3', {}, raid.title),
      tags(raid),
      el('p', {}, raid.description || raid.steps[0]),
    );
    card.addEventListener('click', () => openView(raid));
    list.append(card);
  }

  $('count').textContent = `${raids.length} method${raids.length === 1 ? '' : 's'}`;
  $('empty').hidden = raids.length > 0;
}

// ---------- View one ----------

function section(title, items, ordered = false) {
  if (!items.length) return '';
  const listEl = el(ordered ? 'ol' : 'ul');
  for (const i of items) listEl.append(el('li', {}, i));
  return el('div', {}, el('h4', {}, title), listEl);
}

function openView(raid) {
  current = raid;
  const date = new Date(raid.updatedAt).toLocaleDateString();
  $('viewBody').replaceChildren(
    el('h2', {}, raid.title),
    tags(raid),
    raid.description ? el('p', {}, raid.description) : '',
    section('What you need', raid.requirements),
    section('Steps', raid.steps, true),
    section('Tips', raid.tips),
    el('p', { class: 'meta' }, `Added by ${raid.author} · updated ${date}`),
  );
  $('viewDialog').showModal();
}

// ---------- Add / edit ----------

function openForm(raid) {
  editingId = raid ? raid.id : null;
  $('formTitle').textContent = raid ? 'Edit raid method' : 'Add raid method';
  $('formError').hidden = true;

  $('raidForm').reset();
  const f = $('raidForm').elements;
  if (raid) {
    f.title.value = raid.title;
    f.category.value = raid.category;
    f.tier.value = raid.tier;
    f.difficulty.value = raid.difficulty;
    f.description.value = raid.description;
    f.requirements.value = raid.requirements.join('\n');
    f.steps.value = raid.steps.join('\n');
    f.tips.value = raid.tips.join('\n');
    f.author.value = raid.author;
  }
  $('formDialog').showModal();
}

$('raidForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!ensurePassword()) return;

  const data = Object.fromEntries(new FormData(e.target));
  try {
    if (editingId) await api('PUT', `/api/raids/${editingId}`, data);
    else await api('POST', '/api/raids', data);
    $('formDialog').close();
    await loadList();
  } catch (err) {
    $('formError').textContent = err.message;
    $('formError').hidden = false;
  }
});

// ---------- Buttons ----------

$('addBtn').addEventListener('click', () => openForm(null));

$('editBtn').addEventListener('click', () => {
  $('viewDialog').close();
  openForm(current);
});

$('deleteBtn').addEventListener('click', async () => {
  if (!confirm(`Delete "${current.title}"?`)) return;
  if (!ensurePassword()) return;
  try {
    await api('DELETE', `/api/raids/${current.id}`);
    $('viewDialog').close();
    await loadList();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('dialog .close').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close()));

let searchTimer;
$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadList, 200);
});
$('filterCategory').addEventListener('change', loadList);
$('filterTier').addEventListener('change', loadList);

// ---------- Start ----------

(async function init() {
  options = await api('GET', '/api/options');
  fillSelect($('filterCategory'), options.categories);
  fillSelect($('filterTier'), options.tiers);
  const f = $('raidForm').elements;
  fillSelect(f.category, options.categories);
  fillSelect(f.tier, options.tiers);
  fillSelect(f.difficulty, options.difficulties);
  await loadList();
})();
