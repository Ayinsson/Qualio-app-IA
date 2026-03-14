# AGENTS.md

Guidance for agentic coding assistants working in `Qualio-app-IA`.

## 1) Repository reality and intent

- Current repo content is documentation-first (`README.md`, `docs/`).
- Official target stack (from docs): React + Vite + TypeScript (`apps/web`), NestJS + Express + Prisma + MySQL (`apps/api`).
- Use this file as the default operating contract for future code generation and maintenance.
- If code and this file diverge, prefer actual project config files (`package.json`, eslint/prettier/jest/vitest configs).

## 2) Workspace conventions

- Expected monorepo shape:
  - `apps/web` for frontend.
  - `apps/api` for backend.
  - `docs` for architecture and setup docs.
- Keep framework-specific logic inside each app; avoid cross-app coupling.
- Add shared libraries only when duplication is real and stable.

## 3) Build, lint, test commands

These commands reflect the documented stack and should be implemented in `package.json` scripts when scaffolding code.

### 3.1 Root (when workspaces exist)

- Install deps: `npm install`
- Run all dev servers (if wired): `npm run dev`
- Build all apps: `npm run build`
- Lint all apps: `npm run lint`
- Test all apps: `npm run test`
- Typecheck all apps: `npm run typecheck`

### 3.2 Frontend (`apps/web`)

- Dev server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`
- Lint: `npm run lint`
- Unit tests: `npm run test`
- Single test file (Vitest): `npm run test -- src/path/to/file.test.ts`
- Single test by name (Vitest): `npm run test -- -t "renders project list"`
- Coverage: `npm run test -- --coverage`

### 3.3 Backend (`apps/api`)

- Dev server: `npm run start:dev`
- Production build: `npm run build`
- Start compiled app: `npm run start:prod`
- Lint: `npm run lint`
- Unit tests (Jest): `npm run test`
- Watch tests: `npm run test:watch`
- Single test file (Jest): `npm run test -- src/module/service.spec.ts`
- Single test by name (Jest): `npm run test -- -t "creates a project"`
- e2e tests: `npm run test:e2e`
- Coverage: `npm run test:cov`

### 3.4 Database and Prisma (`apps/api`)

- Init Prisma: `npx prisma init`
- Create/apply migration (local): `npx prisma migrate dev --name <change-name>`
- Generate Prisma client: `npx prisma generate`
- Open Prisma Studio: `npx prisma studio`
- Deploy migrations (non-dev): `npx prisma migrate deploy`

## 4) Definition of done for agent changes

- Run lint for touched app(s).
- Run tests relevant to changed code.
- Prefer single-test runs during iteration; run broader suite before handoff.
- For API/data model changes, run related Prisma command and tests.
- Update docs in `docs/` when architecture, setup, or workflows change.

## 5) Code style guidelines

### 5.1 Language and typing

- Use TypeScript across frontend and backend.
- Prefer explicit types at module boundaries (public functions, DTOs, API responses).
- Prefer `unknown` over `any`; narrow with type guards.
- Use enums or union literals for constrained values; avoid magic strings.
- Keep functions small and single-purpose; extract helpers when branching grows.

### 5.2 Imports and module structure

- Order imports as: standard library -> third-party -> internal aliases -> relative.
- Separate import groups with one blank line.
- Prefer named exports for shared modules; default exports only when framework-conventional.
- Avoid deep relative paths when path aliases are available.
- Remove unused imports and dead exports.

### 5.3 Formatting and linting

- Use ESLint + Prettier as source of truth.
- Do not manually fight formatter output.
- Keep lines readable; prefer early returns over nested conditionals.
- Use trailing commas where formatter enforces them.
- Keep files focused; split files that combine unrelated responsibilities.

### 5.4 Naming conventions

- `PascalCase`: React components, classes, DTO/type names.
- `camelCase`: variables, functions, methods, hooks.
- `UPPER_SNAKE_CASE`: constants and environment variable names.
- Backend files follow Nest style where possible (`*.controller.ts`, `*.service.ts`, `*.module.ts`).
- Test files: `*.test.ts` or `*.spec.ts` consistently per app tooling.

### 5.5 React frontend guidelines

- Prefer function components and hooks.
- Keep presentational UI separate from data-fetching orchestration.
- Validate forms with `react-hook-form` + `zod`.
- Use TanStack Query for server state; avoid ad hoc fetch state duplication.
- Centralize API client configuration (base URL, interceptors, auth header strategy).

### 5.6 NestJS backend guidelines

- Keep controller thin: request/response mapping only.
- Put business logic in services.
- Validate input via DTOs with `class-validator` and `class-transformer`.
- Use guards/interceptors/pipes for cross-cutting concerns.
- Keep Prisma access encapsulated behind service/repository boundaries.

### 5.7 Error handling and logging

- Fail fast on invalid input and configuration.
- Use framework-native exceptions in backend (e.g., `BadRequestException`, `NotFoundException`).
- Return user-safe messages; avoid leaking internals or secrets.
- Log structured context for debugging (operation, entity id, outcome).
- Do not swallow errors; rethrow with context when needed.

### 5.8 Security and secrets

- Never commit secrets (`OPENAI_API_KEY`, DB passwords, JWT secrets).
- Keep local secrets in `.env`; keep `.env.example` sanitized and current.
- Validate required environment variables at startup.
- Prefer least-privilege defaults for tokens and database roles.

### 5.9 Testing expectations

- Test behavior, not implementation details.
- Cover critical business rules and validation paths.
- Include negative/error-path tests for API and service logic.
- Keep test data explicit; avoid brittle global fixtures.
- When fixing a bug, add or update at least one test that would have caught it.

## 6) Documentation and decision records

- `README.md` should stay concise (project purpose + quick start).
- Put detailed setup and architecture updates in `docs/`.
- If a technical decision changes stack/tooling, update both command sections and relevant docs.
- Use `docs/contexto-oficial-repo.md` as the documentation tiebreaker when older docs conflict.

## 7) Cursor and Copilot rule files

- Checked for Cursor rules in `.cursor/rules/` and `.cursorrules`: none found.
- Checked for Copilot instructions in `.github/copilot-instructions.md`: none found.
- If these files are added later, treat them as higher-priority agent instructions and merge their requirements into this document.

## 8) Agent behavior preferences for this repo

- Make minimal, targeted diffs.
- Preserve existing patterns in each app before introducing new abstractions.
- Avoid speculative dependencies not justified by active requirements.
- Prefer clear, maintainable code over clever compact code.
- Leave the repository easier to understand than you found it.
