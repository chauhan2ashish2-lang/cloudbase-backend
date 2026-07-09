# Monorepo Folder Structure

```
ai-marketing-manager/
├── frontend/                          # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── agency/                # Agency-level dashboard
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── businesses/page.tsx
│   │   │   │   │   ├── billing/page.tsx
│   │   │   │   │   └── team/page.tsx
│   │   │   │   ├── business/[businessId]/
│   │   │   │   │   ├── page.tsx           # client dashboard home
│   │   │   │   │   ├── onboarding/page.tsx
│   │   │   │   │   ├── strategy/page.tsx
│   │   │   │   │   ├── content/
│   │   │   │   │   │   ├── calendar/page.tsx
│   │   │   │   │   │   ├── create/page.tsx
│   │   │   │   │   │   └── approvals/page.tsx
│   │   │   │   │   ├── ads/
│   │   │   │   │   │   ├── campaigns/page.tsx
│   │   │   │   │   │   ├── campaigns/[id]/page.tsx
│   │   │   │   │   │   └── create/page.tsx
│   │   │   │   │   ├── analytics/page.tsx
│   │   │   │   │   ├── agents/page.tsx    # AI chat console
│   │   │   │   │   └── settings/
│   │   │   │   │       ├── connections/page.tsx  # Meta OAuth connect
│   │   │   │   │       └── brand-kit/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── api/                      # Next.js route handlers (BFF, if used)
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/                       # shadcn components
│   │   │   ├── calendar/
│   │   │   ├── charts/
│   │   │   ├── ads/
│   │   │   ├── content/
│   │   │   └── agents/ChatConsole.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts             # typed fetch wrapper to backend
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   └── types/
│   ├── public/
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                           # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   ├── redis.js
│   │   │   └── env.js
│   │   ├── middleware/
│   │   │   ├── auth.js                   # JWT verify + tenant scoping
│   │   │   ├── rateLimit.js
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── agencies.routes.js
│   │   │   ├── businesses.routes.js
│   │   │   ├── meta.routes.js            # OAuth connect, webhooks
│   │   │   ├── content.routes.js
│   │   │   ├── ads.routes.js
│   │   │   ├── analytics.routes.js
│   │   │   ├── agents.routes.js          # chat with AI agents
│   │   │   └── billing.routes.js
│   │   ├── services/
│   │   │   ├── metaGraphService.js       # Graph API + IG Graph API wrapper
│   │   │   ├── metaAdsService.js         # Marketing API wrapper
│   │   │   ├── encryptionService.js
│   │   │   ├── strategyService.js
│   │   │   ├── schedulingService.js
│   │   │   ├── optimizationService.js
│   │   │   └── billingService.js
│   │   ├── agents/
│   │   │   ├── orchestrator.js
│   │   │   ├── contentAgent.js
│   │   │   ├── designAgent.js
│   │   │   ├── adsAgent.js
│   │   │   ├── seoAgent.js
│   │   │   ├── analyticsAgent.js
│   │   │   ├── competitorResearchAgent.js
│   │   │   ├── trendResearchAgent.js
│   │   │   └── llmClient.js              # unified Claude/OpenAI/Gemini client
│   │   ├── jobs/
│   │   │   ├── queue.js                  # BullMQ setup
│   │   │   ├── publishWorker.js
│   │   │   ├── syncInsightsWorker.js
│   │   │   ├── syncAdPerformanceWorker.js
│   │   │   ├── optimizationWorker.js
│   │   │   └── tokenRefreshWorker.js
│   │   ├── models/                       # DB access layer (Knex/Prisma models)
│   │   ├── utils/
│   │   └── index.js                      # app entrypoint
│   ├── migrations/                       # Knex/Prisma migrations mirroring schema.sql
│   ├── Dockerfile
│   └── package.json
│
├── database/
│   └── schema.sql
│
├── n8n/
│   └── workflows/                        # exported n8n workflow JSON
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_DESIGN.md
│   ├── FOLDER_STRUCTURE.md
│   └── IMPLEMENTATION_PLAN.md
│
├── docker-compose.yml                    # local dev: postgres, redis, backend, frontend, n8n
└── README.md
```
