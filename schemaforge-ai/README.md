# SchemaForge AI

**Plain English → Universal Database Schema Generator**

Transform natural language descriptions into production-ready database schemas with tables, relationships, indexes, constraints, and interactive ERD visualization.

Built from the SchemaForge AI PRD v1.0 (May 2026).

## Features

- **Natural Language Schema Engine** — Describe any domain in plain English
- **Multi-dialect DDL** — PostgreSQL, MySQL, SQLite, SQL Server, Oracle
- **Interactive ERD** — React Flow visualizer with zoom, pan, and minimap
- **Monaco DDL Editor** — Syntax-highlighted SQL output
- **Chat Refinement** — Incrementally evolve schemas ("add soft delete", etc.)
- **Template Library** — 10+ curated domain templates (e-commerce, SaaS, healthcare, etc.)
- **Export** — DDL, Prisma, SQLAlchemy formats
- **Versioning API** — Git-like schema versions with diff view

## Quick Start

### 1. Backend (FastAPI)

```powershell
cd schemaforge-ai\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend (Next.js 15)

```powershell
cd schemaforge-ai\frontend
npm install
npm run dev
```

Open http://localhost:3000

### OpenAI (recommended)

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4o-mini
```

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Without `OPENAI_API_KEY`, the rule-based fallback engine is used.

## Supabase

Supabase is the chosen backend/auth foundation for the SaaS version:

- Supabase Auth: signup, login, email verification, password reset, and OAuth
- Supabase Postgres: profiles, schemas, feedback, billing customers, subscriptions, usage
- Stripe remains the planned checkout and billing portal provider

Create a Supabase project, run `supabase/schema.sql` in the SQL editor, then set:

```env
# backend/.env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
```

```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Project Structure

```
schemaforge-ai/
├── backend/          # FastAPI + schema generation pipeline
│   └── app/
│       ├── api/      # REST endpoints (/v1/schema/*)
│       └── services/ # Engine, DDL synthesizer, templates
└── frontend/         # Next.js 15 + React 19 UI
    └── src/
        ├── app/      # Pages: home, workspace, templates
        └── components/  # ERD, DDL editor, chat refine
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/schema/generate` | Generate schema (OpenAI or fallback) |
| POST | `/v1/schema/refine` | Chat-based refinement |
| POST | `/v1/schema/wizard` | Guided Q&A generation |
| POST | `/v1/schema/infer-csv` | CSV → schema |
| POST | `/v1/schema/{id}/review` | AI schema critique |
| POST | `/v1/schema/{id}/rollback` | Rollback to version |
| POST | `/v1/schema/{id}/migrate` | Migration SQL between versions |
| POST | `/v1/schema/{id}/share` | Create share link |
| GET | `/v1/schema/{id}/compare` | Side-by-side dialect DDL |
| GET | `/v1/schema/{id}/export` | Export (10+ formats) |
| GET | `/v1/schema/{id}/diff` | Version diff + migration |
| GET | `/v1/schemas` | List saved schemas |
| GET | `/v1/usage` | Plan usage stats |
| GET | `/templates` | Template library |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS, React Flow |
| Backend | FastAPI, Pydantic, sqlglot |
| AI | OpenAI GPT-4o-mini (configurable) |
| Storage | SQLite persistence |

## License

Internal / educational use per PRD.
