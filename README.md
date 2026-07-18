# ReadyLoop Backend

Express + PostgreSQL (Neon) backend for ReadyLoop — an AI-powered interview preparation tracker.

## Prerequisites

- Node.js 18+
- A Google OAuth 2.0 app ([console.cloud.google.com](https://console.cloud.google.com))

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL=postgresql://neondb_owner:<password>@ep-billowing-lake-aurp8i0p-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback
JWT_SECRET=<long-random-string>
FRONTEND_URL=http://localhost:5173
PORT=3000
```

> **JWT_SECRET** — generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Configure Google OAuth

In [Google Cloud Console](https://console.cloud.google.com):
- Add `http://localhost:3000/auth/callback` as an **Authorised redirect URI**

### 4. Start the dev server

```bash
npm run dev
```

Server starts at **http://localhost:3000**

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (auto-restarts on file changes) |
| `npm start` | Start without nodemon (production) |

## API Overview

All routes except `/auth/*` require `Authorization: Bearer <jwt>`.

### Auth

| Method | Route | Description |
|---|---|---|
| GET | `/auth/google` | Redirect to Google OAuth consent |
| GET | `/auth/callback` | OAuth callback — issues JWT, redirects to `FRONTEND_URL/#token=<jwt>` |
| GET | `/api/me` | Get logged-in user profile |

### Job Applications

| Method | Route | Description |
|---|---|---|
| GET | `/api/applications` | List all applications |
| POST | `/api/applications` | Create application (requires `company`, `role`, `jd_text`) |
| GET | `/api/applications/:id` | Get application with rounds |

### Interview Rounds

| Method | Route | Description |
|---|---|---|
| GET | `/api/applications/:id/rounds` | List rounds |
| POST | `/api/applications/:id/rounds` | Create round (requires `round_type`) |
| PATCH | `/api/rounds/:id` | Update status / confidence score |

### Question Sets

| Method | Route | Description |
|---|---|---|
| GET | `/api/rounds/:id/question-sets` | List question sets |
| POST | `/api/rounds/:id/question-sets` | Save question set (requires `questions`, `difficulty_profile`) |

### Round Attempts

| Method | Route | Description |
|---|---|---|
| POST | `/api/rounds/:id/attempts` | Start a new attempt |
| PATCH | `/api/attempts/:id` | Complete attempt (score, status, completed_at) |

### Question Attempts

| Method | Route | Description |
|---|---|---|
| POST | `/api/attempts/:id/questions` | Save a question attempt |
| GET | `/api/attempts/:id/questions` | Get all question attempts |

## Health Check

```
GET /health
→ { "ok": true }
```

## Project Structure

```
src/
  index.js              # App entry point
  db.js                 # PostgreSQL pool (Neon)
  middleware/
    auth.js             # JWT Bearer verification
  routes/
    auth.js             # Google OAuth + JWT issuance
    api.js              # All /api/* endpoints
schema.sql              # Database schema (already applied to Neon)
.env.example            # Environment variable template
```
