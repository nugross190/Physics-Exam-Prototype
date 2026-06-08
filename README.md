# Physics Exam Prototype

Web platform for staged physics exams over PhET-style simulations.
Students log in with NIS + examinee number, work through 6 simulations in fixed order, and answer questions in 5 stages per simulation: tutorial → variable testing → inquiry (MC + complex MC) → true/false → conclusion (word bank). Teachers manage students, questions, and view responses.

## Tech stack

- Node.js 20 + Express
- **SQLite (better-sqlite3, WAL mode)** — single-file DB, no separate database server
- Vanilla JS frontend (no build step)
- Cookie-based JWT auth

## Local development

```bash
# 1. Configure
cp .env.example .env
# edit JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

# 2. Install
npm install

# 3. Run (migrate + seed run automatically on first start)
npm start
# open http://localhost:8000
```

The SQLite database file is created on first run at `./data/physics-exam.db` (configurable via `DATABASE_FILE`). Seed inserts: 6 sims, ~10 questions each, and an admin account from `.env`. Students are added via the admin panel CSV upload (sample: `scripts/sample-students.csv`).

## Sim order (fixed)

1. Hukum Newton tentang Gerak
2. Energy Skate Park
3. Laboratorium Gaya Apung
4. Tekanan dalam Fluida
5. Aliran Fluida
6. Gerak Rotasi

A student can only enter sim N+1 after sim N is marked complete (all questions answered at least once). Progress is saved per question, so a student can close the browser and resume exactly where they left off.

## Project layout

```
server/
  app.js              Express entrypoint
  auth.js             JWT cookie helpers
  grading.js          Per-question type grading
  db/
    schema.sql        SQLite DDL
    migrate.js        Apply schema
    seed.js           Sims + questions + admin
    pool.js           better-sqlite3 instance (WAL mode)
  routes/
    auth.js           /api/auth/* (student & admin login)
    quest.js          /api/quest/* (dashboard, sim, responses)
    admin.js          /api/admin/* (students, questions, CSV)
public/
  index.html, login.html, dashboard.html, sim.html, admin.html
  shared/
    api.js, style.css, overlay.css, overlay.js
Newton Laws of Motion/, Energy Skate Park/, etc. — sim folders served via /sims/<key>/
Dockerfile, railway.json
```

## Floating quiz overlay

`public/shared/overlay.js` is the unified quiz UI. The sim is loaded in an iframe so the overlay sits above any sim (PhET HTML or custom). The overlay is draggable, can be minimized to a floating action button, shows stage chips, and submits each answer to the server immediately.

## Question types

Each question is `(sim_key, stage, type, order_index, payload)`. The seed file is authoritative; the admin panel can edit anything via JSON.

| stage      | type           | payload keys                                    |
|------------|----------------|-------------------------------------------------|
| tutorial   | tutorial_step  | `title`, `body`                                 |
| var_test   | var_test       | `prompt`, `hint`                                |
| inquiry    | simple_mc      | `question`, `options[]`, `answer` (int)         |
| inquiry    | complex_mc     | `question`, `options[]`, `answers[]` (int[])    |
| true_false | true_false     | `statement`, `answer` (bool)                    |
| conclusion | word_bank      | `template` ("...__1__..."), `bank[]`, `blanks[]`|

## API surface

```
POST   /api/auth/student/login   {nis, examinee_no}
POST   /api/auth/admin/login     {username, password}
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/quest/dashboard
GET    /api/quest/sim/:simKey
POST   /api/quest/response       {question_id, answer, time_spent_ms}
POST   /api/quest/sim/:simKey/complete

GET    /api/admin/students
POST   /api/admin/students/upload  (multipart: file=csv)
DELETE /api/admin/students/:id
GET    /api/admin/sims
GET    /api/admin/questions?sim_key=...
POST   /api/admin/questions
PUT    /api/admin/questions/:id
DELETE /api/admin/questions/:id
GET    /api/admin/responses
GET    /api/admin/responses.csv
GET    /api/admin/summary
```

## Deploying to Railway

Railway has a generous free trial ($5 credit/month) — no separate Postgres needed since we use SQLite on a persistent volume.

### Step 1 — Push the repo to GitHub

Make sure this code is on `main` of your GitHub repo.

### Step 2 — Create a Railway project

1. Go to **railway.app** → sign in with GitHub
2. **New Project** → **Deploy from GitHub repo** → pick `Physics-Exam-Prototype`
3. Railway auto-detects the `Dockerfile` and starts building

### Step 3 — Add a persistent volume (for the SQLite file)

1. In the project, click your service → **Settings** → **Volumes** → **+ New Volume**
2. Mount path: `/data`
3. Save. Railway attaches a persistent disk (1 GB free tier is plenty — exam data is well under 100 MB).

### Step 4 — Set environment variables

Service → **Variables** tab. Add:

| Key              | Value                              |
|------------------|------------------------------------|
| `NODE_ENV`       | `production`                       |
| `PORT`           | `8000`                             |
| `DATABASE_FILE`  | `/data/physics-exam.db`            |
| `JWT_SECRET`     | (any long random string — `openssl rand -hex 32` or just paste 32+ random chars) |
| `ADMIN_USERNAME` | `admin` (or your choice)           |
| `ADMIN_PASSWORD` | a strong password                  |

### Step 5 — Generate a public domain

Service → **Settings** → **Networking** → **Generate Domain**. You'll get `your-app.up.railway.app`.

### Step 6 — Redeploy

Railway redeploys automatically when env vars change, or click **Deploy**. Watch the build/deploy logs. On first boot you should see:

```
[db] using sqlite at /data/physics-exam.db
[migrate] schema applied
[seed] inserted 11 questions for newton
[seed] inserted 9 questions for energy
...
[seed] admin user ready: admin
[server] listening on :8000
```

### Step 7 — Use it

- Open the Railway domain → landing page
- `/admin.html` → log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- **Siswa** tab → **Unggah** → upload `scripts/sample-students.csv` (or your real list)
- Hand out NIS + examinee numbers, students log in at `/login.html`

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on `better-sqlite3` | The Dockerfile already includes `python3 make g++` — confirm Railway is using `Dockerfile` (Settings → Build → Builder = Dockerfile) |
| `SQLITE_CANTOPEN` | Volume not mounted at `/data` or `DATABASE_FILE` doesn't match the mount path |
| DB resets on each deploy | Volume missing — every deploy gets a fresh container. Add the volume in Step 3. |
| Admin password not working | Change `ADMIN_PASSWORD` env var → redeploy. Seed runs `ON CONFLICT DO UPDATE` so the hash refreshes. |
| 502 / app crashed | Check **Deploy Logs** for `[error]` |

## Capacity for 200–250 concurrent students

Traffic profile during exam:
- **Static**: each student loads HTML/CSS/JS + ~5 MB PhET assets once per sim, then cached.
- **Dynamic**: ~1 POST `/api/quest/response` every 30–60s while answering, plus a `GET /api/quest/sim/...` on entry.
- Sustained ≈ **5–10 req/s**, peaks **20–30 req/s** at stage transitions.

**SQLite + WAL** handles this load easily — writes are serialized to one writer at a time, but each write is ~1 ms, giving 1000+ writes/sec on cheap hardware. With WAL, readers don't block writers.

| Railway plan       | RAM / vCPU         | Verdict for 250 students                                |
|--------------------|--------------------|---------------------------------------------------------|
| Free trial ($5)    | shared, ~512 MB    | ✅ enough for the exam window (~2 hours of $5 credit usage) |
| **Hobby ($5/mo)**  | **512 MB / 1 vCPU**| ✅ **recommended** — plenty for 250 students            |
| Pro ($20/mo)       | 8 GB / 8 vCPU      | overkill                                                |

**Recommendation:** Hobby plan, single instance. SQLite makes horizontal scaling impossible (single writer, single file), but a single Node process is more than enough — Node can serve thousands of req/s and our DB writes are tiny.

Verify before exam day:
```bash
TARGET=https://your-app.up.railway.app CONNECTIONS=250 DURATION=120 npm run loadtest
```

Look for p99 < 500 ms and 0% non-2xx. If memory pressure shows up, bump Railway resources or trim PhET asset sizes.

### Why not Postgres?

- 200–250 students × ~50 answers = ~12,500 small JSON rows. SQLite handles this trivially.
- No external DB service to provision, pay for, or fail over.
- Backups are a single file: download `/data/physics-exam.db` after the exam.

The only trade-off: you can't run multiple replicas writing to the same DB. For an exam window this is fine.

## Backups

After (or during) the exam, download the DB:

```bash
# Via Railway CLI
railway run cat /data/physics-exam.db > backup.db

# Or use the admin CSV export — open /admin.html → Jawaban → ⬇ Unduh CSV
```

## Admin CSV format

`scripts/sample-students.csv`:
```csv
nis,examinee_no,name,class_name
2024001,P001,Ahmad Setiawan,XI-IPA-1
```
Upload via Admin → Siswa → Unggah. Existing NIS rows are updated, not duplicated.
