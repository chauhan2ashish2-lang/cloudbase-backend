# Step-by-Step Implementation Plan

This scaffold gives you a working skeleton for Sprint 0–2. Below is the full path to
production, in build order. Each sprint assumes ~1 week for a small team (2 backend,
1 frontend, 1 part-time AI/prompt engineer).

## Sprint 0 — Foundations (done in this scaffold)
- [x] Monorepo structure, docker-compose local dev environment
- [x] Database schema (`database/schema.sql`)
- [x] Auth: register/login/refresh, JWT + tenant scoping middleware
- [x] Meta OAuth connect flow + encrypted token storage
- [x] Content Agent + Orchestrator skeleton
- [x] Publish worker + BullMQ queue setup

## Sprint 1 — Core Platform
- [ ] Google/Facebook login (Passport strategies) wired into auth routes
- [ ] Agency team management (invite, roles)
- [ ] Stripe billing: plans, checkout, webhook, plan-gated feature flags
- [ ] Business CRUD + onboarding form (frontend)
- [ ] `businesses.routes.js`, migrations tooling (Knex or Prisma) replacing raw schema.sql

## Sprint 2 — Meta Integration Depth
- [ ] Frontend Facebook JS SDK integration for the Business Login dialog
- [ ] Page/IG account picker UI
- [ ] `syncInsightsWorker.js`: hourly Page + IG insights pull → `analytics_snapshots`
- [ ] `tokenRefreshWorker.js`: renew long-lived tokens before 60-day expiry
- [ ] Webhook processing queue (feed/comments/mentions → notifications)
- [ ] Meta App Review submission prep (screencast, data-use justification per scope)

## Sprint 3 — AI Business Intelligence & Strategy
- [ ] Website scraper service (fetch + summarize site content)
- [ ] Competitor Research Agent (public page/ad library lookups + web search)
- [ ] Trend Research Agent (industry + seasonal/festival calendar)
- [ ] `strategyService.js`: assembles inputs → single Claude call → `marketing_strategies`
- [ ] Strategy review UI (editable before content generation starts)

## Sprint 4 — Content Engine
- [ ] Design Agent: image_brief → image generation API → S3 upload → `media_urls`
- [ ] Content calendar UI (drag-drop scheduling)
- [ ] Approval workflow UI + n8n approval-chain integration
- [ ] Best-time prediction: start with a heuristic (engagement-weighted historical hours),
      upgrade to a learned model once enough per-business data exists
- [ ] Bulk scheduling + recurring content templates (festival campaigns, weekly series)

## Sprint 5 — Advertising Engine
- [ ] `metaAdsService.js`: Marketing API wrappers (create campaign/adset/ad/creative)
- [ ] Ads Agent: objective → targeting/audience/creative brief generation
- [ ] Draft-mode ads UI (review before launch) — launch button calls `/ads/campaigns/:id/launch`
- [ ] Lookalike + retargeting audience builders
- [ ] Hard spend caps per agency (config + enforcement in `metaAdsService.js`)

## Sprint 6 — Optimization Engine
- [ ] `syncAdPerformanceWorker.js`: 15-min performance polling
- [ ] `optimizationService.js`: rule engine (pause/scale/duplicate/rotate) — start in
      `recommend_only` mode, surfaced in UI for human approval
- [ ] Promote to `full_auto` per-campaign once trust is established; log every action to
      `optimization_actions` with before/after state for rollback and audit

## Sprint 7 — Full Agent Orchestration & Analytics
- [ ] AI Chat Console (SSE streaming) wired to `orchestrator.js`
- [ ] Analytics Agent: plain-English weekly summaries + anomaly flags
- [ ] Full analytics dashboards (followers, engagement, leads, ROAS) with CSV/PDF export
- [ ] Cost/usage dashboard from `ai_generations` (per-agency AI spend, credit gating)

## Sprint 8 — Hardening for Production
- [ ] Postgres Row-Level Security policies mirroring app-layer tenant scoping
- [ ] Load testing on publish/optimization workers; queue backpressure handling
- [ ] Structured logging + Sentry + Prometheus/Grafana dashboards
- [ ] Data deletion callback fully implemented (Meta requirement)
- [ ] Pen test / secrets audit before public launch

## Immediate Next Steps To Run This Scaffold Locally
```bash
cd ai-marketing-manager
cp backend/.env.example backend/.env   # fill in Meta app creds + Anthropic key
docker compose up -d postgres redis
docker compose exec postgres psql -U postgres -d ai_marketing_manager -f /docker-entrypoint-initdb.d/01-schema.sql
cd backend && npm install && npm run dev
# in a second terminal
cd backend && npm run worker
```

Frontend (`frontend/`) is scaffolded structurally in `docs/FOLDER_STRUCTURE.md` — run
`npx create-next-app@latest` inside that folder with App Router + Tailwind + TypeScript,
then port in the route/component tree from the folder structure doc.
