# ⚔ ARK Raid Methods

A small website to collect every raiding method for **ARK: Survival Evolved**.
You can search, filter by category and structure tier, and add, edit or delete methods.

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
server.js          ← the whole backend (one file, read top to bottom)
data/raids.json    ← the "database": all raid methods live here
public/
  index.html       ← page layout
  style.css        ← look & colors
  app.js           ← frontend: calls the API and draws the cards
```

## How the backend works

`server.js` is split into 6 numbered sections:

| # | Section | What it does |
|---|---------|--------------|
| 1 | **Settings** | Port, admin password, and the dropdown lists (`categories`, `tiers`, `difficulties`). Edit these lists to add new options. |
| 2 | **Database** | `loadRaids()` reads `data/raids.json`; `saveRaids()` writes it back. No database server needed. |
| 3 | **Validation** | `validateRaid()` checks what the user sent (title required, valid category, at least one step…). |
| 4 | **Password check** | `requirePassword` blocks add/edit/delete unless the `x-admin-password` header matches `ADMIN_PASSWORD`. |
| 5 | **Routes** | The API endpoints below. |
| 6 | **Start** | Starts the server. |

### API

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/raids` | List all methods. Filters: `?search=c4&category=Explosives&tier=Metal` |
| GET | `/api/raids/:id` | Get one method |
| POST | `/api/raids` | Create a method 🔒 |
| PUT | `/api/raids/:id` | Update a method 🔒 |
| DELETE | `/api/raids/:id` | Delete a method 🔒 |
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
  "author": "Your name",
  "createdAt": "2026-09-28T10:00:00.000Z",
  "updatedAt": "2026-09-28T10:00:00.000Z"
}
```

You can also edit `data/raids.json` by hand (stop the server first).

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
