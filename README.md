# Physics Exam Prototype

Web platform for staged physics exams over PhET-style simulations.
Students log in with NIS + examinee number, work through 6 simulations in fixed order, and answer questions in 5 stages per simulation: tutorial → variable testing → inquiry (MC + complex MC) → true/false → conclusion (word bank). Teachers manage students, questions, and view responses.

## Tech stack

- Node.js 20 + Express
- PostgreSQL
- Vanilla JS frontend (no build step)
- Cookie-based JWT auth

## Local development

```bash
# 1. Postgres (Docker or local)
createdb physics_exam

# 2. Configure
cp .env.example .env
# edit DATABASE_URL, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

# 3. Install + migrate + seed
npm install
npm run migrate
npm run seed

# 4. Run
npm start
# open http://localhost:8000
```

Seed creates: 6 sims, ~10 questions each, and an admin account from `.env`.
Add students via the admin panel CSV upload (sample: `scripts/sample-students.csv`).

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
    schema.sql        DDL
    migrate.js        Apply schema
    seed.js           Sims + questions + admin
    pool.js           pg Pool
  routes/
    auth.js           /api/auth/* (student & admin login)
    quest.js          /api/quest/* (dashboard, sim, responses)
    admin.js          /api/admin/* (students, questions, CSV)
public/
  index.html          Landing
  login.html          Student login
  dashboard.html      Quest map
  sim.html            Sim runner (iframe + floating overlay)
  admin.html          Teacher console
  shared/
    api.js            fetch wrapper
    style.css         shared UI
    overlay.css       quiz overlay styles
    overlay.js        quiz overlay component
Newton Laws of Motion/   ┐
Energy Skate Park/        ├ Existing sim folders, served via /sims/<key>/
Buoyancy Lab/             │
Under Pressure/           │
Fluid flow/               │
Rotational Motion/        ┘
Dockerfile
koyeb.yaml
```

## Floating quiz overlay

`public/shared/overlay.js` is the unified quiz UI. The sim itself is loaded in an iframe so the overlay sits above any sim (PhET HTML or custom). The overlay is draggable, can be minimized to a floating action button, shows stage chips, and submits each answer to the server immediately.

## Question types & schema

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

## Deploying to Koyeb

1. Provision Postgres (Koyeb Postgres add-on, Neon, or Supabase).
2. Push this repo to GitHub.
3. Create secrets:
   ```
   koyeb secret create database_url --value 'postgres://...'
   koyeb secret create jwt_secret    --value "$(openssl rand -hex 32)"
   koyeb secret create admin_username --value 'guru'
   koyeb secret create admin_password --value 'pilih-yang-kuat'
   ```
4. Deploy:
   ```
   koyeb service create -f koyeb.yaml
   ```
   First boot auto-migrates and (if `SEED_ON_START=1`) seeds sims, questions, and the admin user.

## Capacity for 200–250 concurrent students

Traffic profile during exam:
- **Static**: each student loads HTML/CSS/JS + ~5 MB PhET assets once per sim. Heavy on first hit, then cached.
- **Dynamic**: ~1 POST `/api/quest/response` every 30–60s while answering, plus a `GET /api/quest/sim/...` on entry.
- Sustained load with 250 students ≈ **5–10 req/s**, peaks during stage transitions **20–30 req/s**.
- Per-request payload is small (<2 KB) and DB writes are tiny JSONB inserts with one unique-index update.

| Tier              | Spec               | Verdict for 250 students                                 |
|-------------------|--------------------|----------------------------------------------------------|
| Koyeb Free / Eco  | 0.1 vCPU / 512 MB  | ❌ runs out of CPU above ~80 concurrent.                  |
| **Standard Small**| **0.5 vCPU / 1 GB**| ✅ **recommended** with **min 2 instances** + autoscale.  |
| Standard Medium   | 1 vCPU / 2 GB      | ✅ single instance works, but no redundancy.              |
| Standard Large    | 2 vCPU / 4 GB      | Overkill for this workload.                              |

**Recommendation:** Standard Small × 2 instances (Singapore region), with autoscale up to 4 on 70% CPU. Postgres on Koyeb Nano (or Neon free tier) is enough — total response data for one exam is well under 100 MB.

Verify before exam day:
```bash
TARGET=https://your-app.koyeb.app CONNECTIONS=250 DURATION=120 npm run loadtest
```

Look for p99 < 500 ms and 0% non-2xx. If CPU saturates, raise `scaling.max` in `koyeb.yaml` or bump to Medium.

## Admin CSV format

`scripts/sample-students.csv`:
```csv
nis,examinee_no,name,class_name
2024001,P001,Ahmad Setiawan,XI-IPA-1
```
Upload via Admin → Siswa → Unggah. Existing NIS rows are updated, not duplicated.
