// =============================================================================
//  ARK RAID METHODS — BACKEND
// =============================================================================
//
//  This file is the whole backend. It does 3 things:
//
//    1. Serves the website (the files inside the /public folder)
//    2. Stores the data in simple JSON files:
//         data/raids.json    -> raiding methods
//         data/farming.json  -> where to farm each resource
//    3. Exposes an API the website uses to list / add / edit / delete entries
//
//  API ROUTES (all return JSON). The same 5 routes exist for both
//  "raids" and "farming" — just swap the word in the URL:
//
//    GET    /api/raids          -> list all   (supports ?search= and filters)
//    GET    /api/raids/:id      -> get one
//    POST   /api/raids          -> create     (needs password if set)
//    PUT    /api/raids/:id      -> update     (needs password if set)
//    DELETE /api/raids/:id      -> delete     (needs password if set)
//
//    GET    /api/farming ...    -> same as above, for farming spots
//    GET    /api/options        -> dropdown values (categories, tiers, maps…)
//
//  Start it with:   npm install   then   npm start
//  Then open:       http://localhost:3000
// =============================================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// -----------------------------------------------------------------------------
// 1. SETTINGS
// -----------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;

// If you set ADMIN_PASSWORD, nobody can add/edit/delete without it.
// If you leave it empty, anyone who opens the site can edit (fine for local use).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const DATA_DIR = path.join(__dirname, 'data');

// The lists the website shows in its dropdowns. Add new values here if you want.
const OPTIONS = {
  // Raids
  categories: [
    'Explosives',
    'Turret Soaking',
    'Healing / Push',
    'Dino Raid',
    'Tek Weapons',
    'Siege / Artillery',
    'Cave / Underwater',
    'Offline Raid',
    'Stealth / Sneak',
    'Defense Counter',
    'Other',
  ],
  tiers: ['Thatch', 'Wood', 'Stone', 'Metal', 'Tek', 'Any'],
  difficulties: ['Easy', 'Medium', 'Hard', 'Expert'],

  // Farming
  maps: [
    'The Island',
    'Scorched Earth',
    'Aberration',
    'Extinction',
    'Genesis',
    'Genesis Part 2',
    'Ragnarok',
    'Valguero',
    'The Center',
    'Crystal Isles',
    'Lost Island',
    'Fjordur',
    'All Maps',
  ],
};

// -----------------------------------------------------------------------------
// 2. "DATABASE" — just JSON files on disk
// -----------------------------------------------------------------------------
//  load('raids')        reads data/raids.json and gives back an array
//  save('raids', list)  writes the array back to the file

function load(name) {
  const file = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(name, items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, name + '.json');
  // Write to a temp file first, then rename — so a crash never corrupts the data.
  fs.writeFileSync(file + '.tmp', JSON.stringify(items, null, 2));
  fs.renameSync(file + '.tmp', file);
}

// -----------------------------------------------------------------------------
// 3. VALIDATION — checks what the user sent before we save it
// -----------------------------------------------------------------------------
//  Each validate function returns { item } when OK, or { error } with a message.

function toList(value) {
  // Accepts either an array or a text with one item per line.
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split('\n').map((s) => s.trim()).filter(Boolean);
  return [];
}

// Only YouTube links are allowed for videos.
function checkVideos(value) {
  const videos = toList(value);
  const bad = videos.find((url) => !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url));
  if (bad) return { error: 'Videos must be YouTube links. This one is not: ' + bad };
  return { videos };
}

function mustBeOneOf(value, list, label) {
  if (!list.includes(value)) return `${label} must be one of: ${list.join(', ')}`;
  return null;
}

function validateRaid(body) {
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Title is required.' };
  if (title.length > 120) return { error: 'Title must be 120 characters or less.' };

  const error =
    mustBeOneOf(body.category, OPTIONS.categories, 'Category') ||
    mustBeOneOf(body.tier, OPTIONS.tiers, 'Tier') ||
    mustBeOneOf(body.difficulty, OPTIONS.difficulties, 'Difficulty');
  if (error) return { error };

  const steps = toList(body.steps);
  if (steps.length === 0) return { error: 'Add at least one step.' };

  const v = checkVideos(body.videos);
  if (v.error) return v;

  return {
    item: {
      title,
      category: body.category,
      tier: body.tier,
      difficulty: body.difficulty,
      description: String(body.description || '').trim(),
      requirements: toList(body.requirements),
      steps,
      tips: toList(body.tips),
      videos: v.videos,
      author: String(body.author || '').trim() || 'Anonymous',
    },
  };
}

function validateFarming(body) {
  const resource = String(body.resource || '').trim();
  if (!resource) return { error: 'Resource is required.' };

  const error = mustBeOneOf(body.map, OPTIONS.maps, 'Map');
  if (error) return { error };

  const locations = toList(body.locations);
  if (locations.length === 0) return { error: 'Add at least one location.' };

  const dinos = toList(body.dinos);
  if (dinos.length === 0) return { error: 'Add at least one dino or tool.' };

  const v = checkVideos(body.videos);
  if (v.error) return v;

  return {
    item: {
      resource,
      map: body.map,
      locations,
      dinos,
      tips: toList(body.tips),
      videos: v.videos,
      author: String(body.author || '').trim() || 'Anonymous',
    },
  };
}

// -----------------------------------------------------------------------------
// 4. PASSWORD CHECK — protects create / update / delete
// -----------------------------------------------------------------------------
//  The website sends the password in a header called "x-admin-password".

function requirePassword(req, res, next) {
  if (!ADMIN_PASSWORD) return next(); // no password configured -> open to everyone
  if (req.get('x-admin-password') === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Wrong or missing admin password.' });
}

// -----------------------------------------------------------------------------
// 5. ROUTES — one function builds the same 5 routes for any collection
// -----------------------------------------------------------------------------
//  name     -> the URL + file name ("raids" -> /api/raids and data/raids.json)
//  validate -> the validate function from section 3
//  filters  -> fields you can filter on with ?field=value (e.g. ?tier=Metal)
//  sortBy   -> how the list is sorted

function addCrudRoutes(app, { name, validate, filters, sortBy }) {
  const url = '/api/' + name;

  // LIST — e.g. /api/raids?search=c4&tier=Metal
  app.get(url, (req, res) => {
    const search = String(req.query.search || '').toLowerCase();

    const results = load(name).filter((item) => {
      for (const field of filters) {
        if (req.query[field] && item[field] !== req.query[field]) return false;
      }
      // Search looks inside every text field of the entry.
      if (search && !JSON.stringify(item).toLowerCase().includes(search)) return false;
      return true;
    });

    results.sort(sortBy);
    res.json(results);
  });

  // GET ONE
  app.get(url + '/:id', (req, res) => {
    const item = load(name).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  // CREATE
  app.post(url, requirePassword, (req, res) => {
    const { item, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    const now = new Date().toISOString();
    const newItem = { id: crypto.randomUUID(), ...item, createdAt: now, updatedAt: now };

    const items = load(name);
    items.push(newItem);
    save(name, items);
    res.status(201).json(newItem);
  });

  // UPDATE
  app.put(url + '/:id', requirePassword, (req, res) => {
    const items = load(name);
    const index = items.findIndex((i) => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found.' });

    const { item, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    items[index] = { ...items[index], ...item, updatedAt: new Date().toISOString() };
    save(name, items);
    res.json(items[index]);
  });

  // DELETE
  app.delete(url + '/:id', requirePassword, (req, res) => {
    const items = load(name);
    const remaining = items.filter((i) => i.id !== req.params.id);
    if (remaining.length === items.length) return res.status(404).json({ error: 'Not found.' });

    save(name, remaining);
    res.status(204).end();
  });
}

const app = express();
app.use(express.json());                                  // read JSON bodies
app.use(express.static(path.join(__dirname, 'public')));  // serve the website

// Tell the website which dropdown options exist and whether a password is needed.
app.get('/api/options', (req, res) => {
  res.json({ ...OPTIONS, passwordRequired: Boolean(ADMIN_PASSWORD) });
});

// Raids: newest first
addCrudRoutes(app, {
  name: 'raids',
  validate: validateRaid,
  filters: ['category', 'tier', 'difficulty'],
  sortBy: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

// Farming: alphabetical by resource, then by map
addCrudRoutes(app, {
  name: 'farming',
  validate: validateFarming,
  filters: ['resource', 'map'],
  sortBy: (a, b) => a.resource.localeCompare(b.resource) || a.map.localeCompare(b.map),
});

// -----------------------------------------------------------------------------
// 6. START THE SERVER
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`ARK Raid Methods running at http://localhost:${PORT}`);
  console.log(ADMIN_PASSWORD ? 'Admin password is ON.' : 'Admin password is OFF (anyone can edit).');
});
