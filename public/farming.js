// Farming page: where to farm each resource, with which dino, on which map.

let options = null;   // dropdown values from the backend
let current = null;   // the spot currently opened in the view dialog
let editingId = null; // id being edited (null = creating a new one)

function tags(spot) {
  return el('div', { class: 'tags' },
    el('span', { class: 'tag map' }, spot.map),
    videoBadge(spot.videos),
  );
}

// ---------- List (grouped by resource) ----------

async function loadList() {
  const params = new URLSearchParams({
    search: $('search').value,
    resource: $('filterResource').value,
    map: $('filterMap').value,
  });
  const spots = await api('GET', '/api/farming?' + params);

  // Group the spots by resource: { "Metal": [...], "Oil": [...] }
  const groups = {};
  for (const spot of spots) (groups[spot.resource] ||= []).push(spot);

  const list = $('list');
  list.replaceChildren();
  for (const [resource, items] of Object.entries(groups)) {
    const grid = el('div', { class: 'grid' });
    for (const spot of items) {
      const card = el('button', { class: 'card', type: 'button' },
        el('h3', {}, spot.map),
        tags(spot),
        el('p', {}, el('strong', {}, 'Dinos: '), spot.dinos.join(', ')),
        el('p', {}, el('strong', {}, 'Where: '), spot.locations[0]),
      );
      card.addEventListener('click', () => openView(spot));
      grid.append(card);
    }
    list.append(el('section', { class: 'group' }, el('h2', {}, resource), grid));
  }

  $('count').textContent = `${spots.length} farming spot${spots.length === 1 ? '' : 's'}`;
  $('empty').hidden = spots.length > 0;
}

// Fill the "resource" filter with every resource that exists in the data.
async function loadResourceFilter() {
  const all = await api('GET', '/api/farming');
  const select = $('filterResource');
  const chosen = select.value;
  select.replaceChildren(el('option', { value: '' }, 'All resources'));
  fillSelect(select, [...new Set(all.map((s) => s.resource))].sort());
  select.value = chosen;
}

// ---------- View one ----------

function openView(spot) {
  current = spot;
  const date = new Date(spot.updatedAt).toLocaleDateString();
  $('viewBody').replaceChildren(
    el('h2', {}, `${spot.resource} — ${spot.map}`),
    tags(spot),
    section('Where to farm', spot.locations),
    section('Best dinos / tools', spot.dinos),
    section('Tips', spot.tips),
    videoSection(spot.videos),
    el('p', { class: 'meta' }, `Added by ${spot.author} · updated ${date}`),
  );
  $('viewDialog').showModal();
}

// ---------- Add / edit ----------

function openForm(spot) {
  editingId = spot ? spot.id : null;
  $('formTitle').textContent = spot ? 'Edit farming spot' : 'Add farming spot';
  $('formError').hidden = true;

  $('farmForm').reset();
  const f = $('farmForm').elements;
  if (spot) {
    f.resource.value = spot.resource;
    f.map.value = spot.map;
    f.locations.value = spot.locations.join('\n');
    f.dinos.value = spot.dinos.join('\n');
    f.tips.value = spot.tips.join('\n');
    f.videos.value = (spot.videos || []).join('\n');
    f.author.value = spot.author;
  }
  $('formDialog').showModal();
}

$('farmForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!ensurePassword(options)) return;

  const data = Object.fromEntries(new FormData(e.target));
  try {
    if (editingId) await api('PUT', `/api/farming/${editingId}`, data);
    else await api('POST', '/api/farming', data);
    $('formDialog').close();
    await loadResourceFilter();
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
  if (!confirm(`Delete "${current.resource} — ${current.map}"?`)) return;
  if (!ensurePassword(options)) return;
  try {
    await api('DELETE', `/api/farming/${current.id}`);
    $('viewDialog').close();
    await loadResourceFilter();
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
$('filterResource').addEventListener('change', loadList);
$('filterMap').addEventListener('change', loadList);

// ---------- Start ----------

(async function init() {
  setupDialogs();
  options = await api('GET', '/api/options');
  fillSelect($('filterMap'), options.maps);
  fillSelect($('farmForm').elements.map, options.maps);
  await loadResourceFilter();
  await loadList();
})();
