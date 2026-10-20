# EduAnalyzeAI

ระบบติดตามความก้าวหน้าทางการศึกษาและวิเคราะห์ผลลัพธ์การเรียนรู้ตามหลักสูตร (Course → CLO → PLO)

## Tech Stack

**Backend:** NestJS, TypeScript, Prisma ORM, PostgreSQL, bcrypt, JWT, class-validator, @nestjs/throttler, Helmet

**Frontend:** Next.js, React, TypeScript

## Monorepo Structure

```
apps/
  backend/     # NestJS API — source of truth for all business logic, security, and data
  frontend/    # Next.js client
packages/
  shared-types/  # Types shared between backend and frontend (added when needed)
```

## Development Principles

- Backend is the security boundary. Frontend never enforces authorization on its own.
- Every significant API validates Authentication + Role + Scope — not Role alone.
- Analytics (GPA, CLO/PLO achievement, Radar values) are deterministic calculations done in the backend. AI only interprets already-computed results; it never generates scores.
- Development proceeds one phase at a time, per the project's phased roadmap. Each phase is reviewed and approved before implementation.

## Getting Started

Setup instructions will be added as each phase is implemented (starting with database connection and Prisma schema in Phase 1).

## API documentation (OpenAPI)

Swagger UI (`/api/docs`) is only served outside production. For reports and slides, export the
document offline instead (no port is opened and the database is not touched):

```bash
npm run openapi:export -w apps/backend                  # writes docs/api/openapi.json
npx --yes @redocly/cli build-docs docs/api/openapi.json -o docs/api/index.html   # readable HTML
```

## Database backup

Run `bash scripts/db-backup.sh <label>` from the project root (the label is optional and defaults to `manual`). Dumps are written to `apps/backend/.backups/` and are git-ignored. They contain real user data, so never send anything in `.backups` off the machine. Back up before any QA or test round that touches Docker; see `apps/backend/CONVENTIONS.md` §10.

## Deployment

Production runs on a VPS at `https://eduanalyze.itkukps.tech`: GitHub Actions (`CI`, then `Deploy`) builds the images, pushes them to GHCR and deploys over SSH. Setup steps, rollback, backups and the PDPA rule are in [docs/DEPLOY.md](docs/DEPLOY.md) (Thai).
