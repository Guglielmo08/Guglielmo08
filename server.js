// =============================================================================
//  ARK RAID METHODS — BACKEND
// =============================================================================
//
//  This file is the whole backend. It does 3 things:
//
//    1. Serves the website (the files inside the /public folder)
//    2. Stores raid methods in a simple JSON file (data/raids.json)
//    3. Exposes an API the website uses to list / add / edit / delete methods
//
//  API ROUTES (all return JSON):
//
//    GET    /api/raids          -> list all methods (supports ?search=&category=&tier=)
//    GET    /api/raids/:id      -> get one method
//    POST   /api/raids          -> create a method        (needs password if set)
//    PUT    /api/raids/:id      -> update a method        (needs password if set)
//    DELETE /api/raids/:id      -> delete a method        (needs password if set)
//    GET    /api/options        -> the allowed categories / tiers / difficulties
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

const DATA_FILE = path.join(__dirname, 'data', 'raids.json');

// The lists the website shows in its dropdowns. Add new values here if you want.
const OPTIONS = {
  categories: [
    'Explosives',
    'Turret Soaking',
    'Dino Raid',
    'Tek Weapons',
    'Siege / Artillery',
    'Offline Raid',
    'Stealth / Sneak',
    'Defense Counter',
    'Other',
  ],
  tiers: ['Thatch', 'Wood', 'Stone', 'Metal', 'Tek', 'Any'],
  difficulties: ['Easy', 'Medium', 'Hard', 'Expert'],
};

// -----------------------------------------------------------------------------
// 2. "DATABASE" — just a JSON file on disk
// -----------------------------------------------------------------------------
//  loadRaids()  reads the file and gives back an array of raid objects
//  saveRaids()  writes the array back to the file

function loadRaids() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveRaids(raids) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  // Write to a temp file first, then rename — so a crash never corrupts the data.
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(raids, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// -----------------------------------------------------------------------------
// 3. VALIDATION — checks what the user sent before we save it
// -----------------------------------------------------------------------------
//  Returns { raid } when everything is OK, or { error } with a message.

function toList(value) {
  // Accepts either an array or a text with one item per line.
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split('\n').map((s) => s.trim()).filter(Boolean);
  return [];
}

function validateRaid(body) {
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Title is required.' };
  if (title.length > 120) return { error: 'Title must be 120 characters or less.' };

  if (!OPTIONS.categories.includes(body.category))
    return { error: 'Category must be one of: ' + OPTIONS.categories.join(', ') };
  if (!OPTIONS.tiers.includes(body.tier))
    return { error: 'Tier must be one of: ' + OPTIONS.tiers.join(', ') };
  if (!OPTIONS.difficulties.includes(body.difficulty))
    return { error: 'Difficulty must be one of: ' + OPTIONS.difficulties.join(', ') };

  const steps = toList(body.steps);
  if (steps.length === 0) return { error: 'Add at least one step.' };

  return {
    raid: {
      title,
      category: body.category,
      tier: body.tier,
      difficulty: body.difficulty,
      description: String(body.description || '').trim(),
      requirements: toList(body.requirements),
      steps,
      tips: toList(body.tips),
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
// 5. THE APP + ROUTES
// -----------------------------------------------------------------------------

const app = express();
app.use(express.json());                                  // read JSON bodies
app.use(express.static(path.join(__dirname, 'public')));  // serve the website

// Tell the website which dropdown options exist and whether a password is needed.
app.get('/api/options', (req, res) => {
  res.json({ ...OPTIONS, passwordRequired: Boolean(ADMIN_PASSWORD) });
});

// LIST — with optional filters: /api/raids?search=c4&category=Explosives&tier=Metal
app.get('/api/raids', (req, res) => {
  const { search = '', category = '', tier = '' } = req.query;
  const q = search.toLowerCase();

  const results = loadRaids().filter((r) => {
    if (category && r.category !== category) return false;
    if (tier && r.tier !== tier) return false;
    if (q) {
      const text = [r.title, r.description, ...r.requirements, ...r.steps, ...r.tips]
        .join(' ')
        .toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  // Newest first
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(results);
});

// GET ONE
app.get('/api/raids/:id', (req, res) => {
  const raid = loadRaids().find((r) => r.id === req.params.id);
  if (!raid) return res.status(404).json({ error: 'Raid method not found.' });
  res.json(raid);
});

// CREATE
app.post('/api/raids', requirePassword, (req, res) => {
  const { raid, error } = validateRaid(req.body);
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  const newRaid = { id: crypto.randomUUID(), ...raid, createdAt: now, updatedAt: now };

  const raids = loadRaids();
  raids.push(newRaid);
  saveRaids(raids);
  res.status(201).json(newRaid);
});

// UPDATE
app.put('/api/raids/:id', requirePassword, (req, res) => {
  const raids = loadRaids();
  const index = raids.findIndex((r) => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Raid method not found.' });

  const { raid, error } = validateRaid(req.body);
  if (error) return res.status(400).json({ error });

  raids[index] = { ...raids[index], ...raid, updatedAt: new Date().toISOString() };
  saveRaids(raids);
  res.json(raids[index]);
});

// DELETE
app.delete('/api/raids/:id', requirePassword, (req, res) => {
  const raids = loadRaids();
  const remaining = raids.filter((r) => r.id !== req.params.id);
  if (remaining.length === raids.length)
    return res.status(404).json({ error: 'Raid method not found.' });

  saveRaids(remaining);
  res.status(204).end();
});

// -----------------------------------------------------------------------------
// 6. START THE SERVER
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`ARK Raid Methods running at http://localhost:${PORT}`);
  console.log(ADMIN_PASSWORD ? 'Admin password is ON.' : 'Admin password is OFF (anyone can edit).');
});
