# ⚔ ARK Raid Methods

A small website for **ARK: Survival Evolved** with two pages:

- **⚔ Raiding** — every raiding method (C4, soaking, Snow Owl push, Gasbag, Mek, Titanosaur…) with steps, tips and YouTube videos.
- **⛏ Farming** — where to farm each resource, on which map, with which dino, plus videos.

You can search, filter, and add, edit or delete entries on both pages.

## Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open **http://localhost:3000**.

To stop strangers from editing, start it with a password:

```bash
ADMIN_PASSWORD=mysecret npm start
```

The site asks for the password the first time you add, edit or delete something.

## Project layout

```
server.js           ← the whole backend (one file, read top to bottom)
data/raids.json     ← the "database" for raid methods
data/farming.json   ← the "database" for farming spots
public/
  index.html        ← Raiding page layout
  farming.html      ← Farming page layout
  style.css         ← look & colors (shared)
  common.js         ← shared code: API calls, password, YouTube embeds
  raids.js          ← Raiding page logic
  farming.js        ← Farming page logic
```

## How the backend works

`server.js` is split into 6 numbered sections:

| # | Section | What it does |
|---|---------|--------------|
| 1 | **Settings** | Port, admin password, and the dropdown lists (`categories`, `tiers`, `difficulties`, `maps`). Edit these lists to add new options. |
| 2 | **Database** | `load('raids')` reads `data/raids.json`; `save('raids', list)` writes it back. Same for `'farming'`. No database server needed. |
| 3 | **Validation** | `validateRaid()` and `validateFarming()` check what the user sent (required fields, valid dropdown values, videos must be YouTube links). |
| 4 | **Password check** | `requirePassword` blocks add/edit/delete unless the `x-admin-password` header matches `ADMIN_PASSWORD`. |
| 5 | **Routes** | `addCrudRoutes()` builds the same 5 API routes for each collection (raids and farming). |
| 6 | **Start** | Starts the server. |

### API

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/raids` | List all methods. Filters: `?search=c4&category=Explosives&tier=Metal` |
| GET | `/api/raids/:id` | Get one method |
| POST | `/api/raids` | Create a method 🔒 |
| PUT | `/api/raids/:id` | Update a method 🔒 |
| DELETE | `/api/raids/:id` | Delete a method 🔒 |
| GET | `/api/farming` | List farming spots. Filters: `?search=anky&resource=Metal&map=The Island` |
| GET/POST/PUT/DELETE | `/api/farming/...` | Same as the raid routes, for farming spots 🔒 |
| GET | `/api/options` | Dropdown values + whether a password is required |

🔒 = needs the admin password if `ADMIN_PASSWORD` is set.

### What a raid method looks like

```json
{
  "id": "…generated…",
  "title": "Turret Soaking with a Stegosaurus",
  "category": "Turret Soaking",
  "tier": "Any",
  "difficulty": "Easy",
  "description": "Short summary",
  "requirements": ["High-health Stego", "Medical Brews"],
  "steps": ["Step 1", "Step 2"],
  "tips": ["Tip 1"],
  "videos": ["https://www.youtube.com/watch?v=..."],
  "author": "Your name",
  "createdAt": "2026-09-28T10:00:00.000Z",
  "updatedAt": "2026-09-28T10:00:00.000Z"
}
```

### What a farming spot looks like

```json
{
  "resource": "Metal",
  "map": "The Island",
  "locations": ["The Volcano", "Snow biome mountains"],
  "dinos": ["Ankylosaurus", "Argentavis to carry"],
  "tips": ["Put the Anky on an Argentavis"],
  "videos": ["https://www.youtube.com/watch?v=..."]
}
```

You can also edit the JSON files in `data/` by hand (stop the server first).

### Adding a new map or category

Open `server.js`, find `OPTIONS` at the top, and add the name to the list. Restart the server.

## Put it online

**Render (free, easiest):**

1. Push this repo to GitHub.
2. On [render.com](https://render.com) → **New → Blueprint** → pick this repo. It reads `render.yaml`.
3. Set `ADMIN_PASSWORD` when asked. Done — you get a public URL.

> ⚠ On free hosting plans the disk is reset on every redeploy, so methods added
> through the website can be lost. To keep them: add a persistent disk mounted at
> `/opt/render/project/src/data` (paid Render plan), use a Railway/Fly.io volume,
> or regularly copy `data/raids.json` back into the repo.

Any other Node host (Railway, Fly.io, a VPS) works too: run `npm install` then `npm start`, and set `PORT` / `ADMIN_PASSWORD` as environment variables.
