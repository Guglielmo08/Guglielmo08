// Shared code used by both pages (raids + farming).

const $ = (id) => document.getElementById(id);

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
function ensurePassword(options) {
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

function section(title, items, ordered = false) {
  if (!items || !items.length) return '';
  const listEl = el(ordered ? 'ol' : 'ul');
  for (const i of items) listEl.append(el('li', {}, i));
  return el('div', {}, el('h4', {}, title), listEl);
}

// ---------- YouTube videos ----------

// Turns any YouTube link (watch, youtu.be, shorts) into its video id.
function youtubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function videoSection(urls) {
  const ids = (urls || []).map(youtubeId).filter(Boolean);
  if (!ids.length) return '';
  const grid = el('div', { class: 'videos' });
  for (const id of ids) {
    grid.append(el('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      title: 'YouTube video',
      loading: 'lazy',
      allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: '',
    }));
  }
  return el('div', {}, el('h4', {}, `Videos (${ids.length})`), grid);
}

function videoBadge(urls) {
  const n = (urls || []).length;
  return n ? el('span', { class: 'tag video' }, `▶ ${n} video${n === 1 ? '' : 's'}`) : '';
}

// ---------- Dialogs ----------

// Close buttons + stop videos from playing when a dialog closes.
function setupDialogs() {
  document.querySelectorAll('dialog .close').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('close', () => d.querySelectorAll('iframe').forEach((f) => f.remove())));
}
