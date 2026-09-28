// Raids page: list, view, add, edit and delete raid methods.

let options = null;   // dropdown values from the backend
let current = null;   // the raid currently opened in the view dialog
let editingId = null; // id being edited (null = creating a new one)

function tags(raid) {
  return el('div', { class: 'tags' },
    el('span', { class: `tag diff ${raid.difficulty}` }, raid.difficulty),
    el('span', { class: 'tag' }, raid.category),
    el('span', { class: 'tag' }, raid.tier),
    videoBadge(raid.videos),
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
    videoSection(raid.videos),
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
    f.videos.value = (raid.videos || []).join('\n');
    f.author.value = raid.author;
  }
  $('formDialog').showModal();
}

$('raidForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!ensurePassword(options)) return;

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
  if (!ensurePassword(options)) return;
  try {
    await api('DELETE', `/api/raids/${current.id}`);
    $('viewDialog').close();
    await loadList();
  } catch (err) {
    alert(err.message);
  }
});

let searchTimer;
$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadList, 200);
});
$('filterCategory').addEventListener('change', loadList);
$('filterTier').addEventListener('change', loadList);

// ---------- Start ----------

(async function init() {
  setupDialogs();
  options = await api('GET', '/api/options');
  fillSelect($('filterCategory'), options.categories);
  fillSelect($('filterTier'), options.tiers);
  const f = $('raidForm').elements;
  fillSelect(f.category, options.categories);
  fillSelect(f.tier, options.tiers);
  fillSelect(f.difficulty, options.difficulties);
  await loadList();
})();
