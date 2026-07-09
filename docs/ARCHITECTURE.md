# AI Marketing Manager — System Architecture

## 1. High-Level Overview

AI Marketing Manager is a multi-tenant SaaS platform that connects to a business's Facebook
Page and Instagram Business Account, builds an AI-generated marketing strategy, and then
autonomously creates, schedules, publishes, and optimizes organic content and paid ad
campaigns via the Meta Graph API.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                 │
│   Next.js 14 (App Router) + React + Tailwind + Shadcn UI                  │
│   - Agency Dashboard   - Client Dashboard   - Content Calendar            │
│   - Ads Manager UI     - Analytics UI       - AI Chat Console             │
└───────────────────────────────┬────────────────────────────────────────--┘
                                 │ HTTPS / REST / WebSocket
┌───────────────────────────────▼──────────────────────────────────────────┐
│                              API GATEWAY                                  │
│   Node.js + Express.js  (REST, versioned /api/v1)                         │
│   - AuthN/AuthZ (JWT + session)   - Rate limiting   - Tenant resolution   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
┌───────────────┐      ┌──────────────────┐        ┌──────────────────┐
│  Core Services │      │   AI Agent Layer │        │  Meta Integration │
│  - Users/Tenants│     │  Orchestrator +   │        │  - Graph API      │
│  - Billing      │     │  7 specialized    │        │  - IG Graph API   │
│  - Business     │     │  agents (Content, │        │  - Marketing API  │
│    Profiles     │     │  Design, Ads,     │        │    (Ads)          │
│  - Scheduling   │     │  SEO, Analytics,  │        │  - Webhooks       │
└───────┬─────────┘     │  Competitor,      │        └────────┬──────────┘
        │               │  Trend)           │                 │
        │               └─────────┬─────────┘                 │
        │                         │                            │
        ▼                         ▼                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         QUEUE / WORKER LAYER                            │
│   Redis + BullMQ                                                        │
│   - content-generation queue   - image/video generation queue          │
│   - publish queue               - ad-sync queue                        │
│   - optimization queue (cron)   - analytics-fetch queue (cron)         │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
┌───────────────┐      ┌──────────────────┐        ┌──────────────────┐
│  PostgreSQL    │      │  AI Providers     │        │  n8n              │
│  (primary data)│      │  Claude API       │        │  automation flows │
│                │      │  OpenAI API       │        │  (cron triggers,  │
│  Redis (cache, │      │  Gemini API       │        │  webhook relays,  │
│  sessions,     │      │  Image/Video Gen  │        │  approval chains) │
│  queues)       │      │  (Stability/Runway│        │                   │
└───────────────┘      │  or similar)       │        └──────────────────┘
                        └──────────────────┘
```

## 2. Multi-Tenancy Model

- **Agency** (tenant root) → owns many **Businesses** (clients/brands).
- A **User** belongs to one Agency, with a **role**: `owner`, `admin`, `manager`, `client_viewer`.
- Every data table carries `agency_id` (tenant key) and, where relevant, `business_id`.
- Row-level isolation enforced at the query layer (Postgres RLS optional for defense-in-depth
  in production; app-layer scoping is mandatory regardless).
- Subscription plan (`free`, `pro`, `agency`) is attached to the Agency and gates feature
  flags (# of connected businesses, AI generations/month, ad spend automation, etc).

## 3. Authentication Flow

1. User signs up via Email/Password, Google OAuth, or Facebook OAuth (NextAuth.js on the
   frontend talking to the Express backend, or Passport.js strategies directly on the API).
2. On first login, an Agency + default User(owner) record is created.
3. Session issued as a short-lived JWT (access token, 15 min) + rotating refresh token
   (httpOnly cookie, 30 days), stored hashed in `refresh_tokens` table.
4. Connecting a Business triggers a **separate** OAuth flow: Facebook Login for Business
   with scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`, `ads_management`, `ads_read`,
   `business_management`, `read_insights`.
5. Long-lived Page Access Tokens (60-day) are stored encrypted (AES-256-GCM) in
   `meta_connections`, with a background job to refresh before expiry.

## 4. Meta Integration Flow

```
User clicks "Connect Facebook Page"
   → Frontend opens Facebook Login dialog (JS SDK) requesting Business scopes
   → Meta returns short-lived user access token
   → Backend exchanges it for a long-lived user token (Graph API /oauth/access_token)
   → Backend calls GET /me/accounts to list Pages the user manages
   → User selects Page(s) + linked Instagram Business Account
   → Backend fetches Page Access Token per page (never expires unless password change/revoke)
   → Backend fetches ad account(s) via /me/adaccounts
   → Store connection: page_id, ig_business_id, ad_account_id, encrypted tokens
   → Subscribe to webhooks (feed, mentions, comments) via /{page-id}/subscribed_apps
```

Ongoing sync jobs (BullMQ, cron):
- `sync-page-insights` (hourly): followers, reach, impressions, engagement.
- `sync-ig-insights` (hourly): IG followers, reach, profile views, story metrics.
- `sync-ad-performance` (every 15 min while campaigns active): CPC, CPM, CTR, ROAS, spend.
- `refresh-tokens` (daily): renew long-lived tokens before expiry.

## 5. AI Agent Architecture

A central **Orchestrator Agent** receives a goal (e.g. "generate this week's content plan")
and delegates to specialized sub-agents. Each agent is a thin wrapper around an LLM call with
a scoped system prompt, tool access, and structured JSON output contract.

| Agent | Responsibility | Primary Model |
|---|---|---|
| Content Agent | Post copy, captions, hashtags, CTAs, campaign series | Claude |
| Design Agent | Creative briefs → image/video generation prompts, brand-kit application | Claude + Image Gen API |
| Ads Agent | Campaign/ad set/ad structuring, targeting, budget logic | Claude |
| SEO Agent | Website content audit, keyword suggestions for captions/bio | Claude |
| Analytics Agent | Performance summarization, anomaly detection, plain-English insights | Claude |
| Competitor Research Agent | Competitor page/ad scraping via public Graph API + web search, positioning gaps | Claude + web search |
| Trend Research Agent | Industry & platform trend detection, seasonal/festival calendar | Claude + web search |

Orchestration pattern: **planner → tool-using workers → critic/reviewer pass → human
approval queue (optional) → publish**. All agent I/O is logged to `ai_generations` for
audit, cost tracking, and regeneration.

## 6. Content Lifecycle

```
Business onboarded → Business Intelligence job runs (website scrape, competitor scan,
industry trend scan) → Strategy document generated (stored in `marketing_strategies`)
   → Content Agent generates a content calendar (draft posts, `status = draft`)
   → Design Agent generates creatives per post
   → (Optional) Manual approval workflow: `status: draft → pending_review → approved`
   → Scheduler queues approved posts at best-time-predicted slots
   → Publish worker calls Graph API / IG Graph API at scheduled time
   → Post performance synced back hourly → feeds Analytics Agent & Optimization Engine
```

## 7. AI Advertising & Optimization Loop

```
Ads Agent drafts Campaign → Ad Set(s) → Ad(s) (status: draft, not yet on Meta)
   → Human approval (configurable per plan) OR auto-launch if "full autonomy" enabled
   → Backend creates real objects via Marketing API (campaign → adset → ad → creative)
   → sync-ad-performance job polls insights every 15 min
   → Optimization Engine evaluates rules:
       - CTR < threshold for N hours → pause ad, notify
       - ROAS > target → increase budget by X% (capped by daily increase limit)
       - Winning ad (top decile CTR/ROAS) → duplicate into new ad set for scale testing
       - Audience fatigue (frequency > 3) → rotate creative
   → All automated actions logged to `optimization_actions` for transparency/rollback
```

## 8. Deployment Architecture

- **Frontend**: Vercel (Next.js), preview deployments per PR.
- **Backend API + Workers**: Dockerized, deployed on AWS ECS Fargate (or EKS at scale).
  - Separate services: `api`, `worker-content`, `worker-publish`, `worker-ads`,
    `worker-analytics` — scaled independently.
- **Database**: AWS RDS PostgreSQL (Multi-AZ), read replica for analytics queries.
- **Cache/Queue**: AWS ElastiCache for Redis.
- **Object storage**: S3 for generated media (images/video), served via CloudFront.
- **Secrets**: AWS Secrets Manager (Meta app secret, AI API keys, DB creds).
- **n8n**: Self-hosted on ECS or n8n Cloud, connected via webhooks to the backend for
  approval-chain and notification automations.
- **Observability**: CloudWatch + Sentry (errors) + a metrics pipeline (Prometheus/Grafana
  or Datadog) for queue depth, job latency, AI token spend.

## 9. Security & Compliance Notes

- All Meta tokens encrypted at rest (AES-256-GCM), decrypted only in-memory per request.
- Meta App Review required for advanced permissions (`ads_management`,
  `instagram_content_publish`, `pages_manage_posts`) — plan for a demo video + data-use
  justification per permission during submission.
- GDPR/CCPA: data deletion endpoint required by Meta ("Data Deletion Request Callback").
  Implement `/webhooks/meta/data-deletion`.
  Store minimal PII; support tenant-level data export/delete.
- Ad spend automation must have hard caps (per-agency daily/monthly spend ceiling) to
  prevent runaway automated budget increases.

## 10. Phased Build Order (maps to Implementation Plan doc)

1. Auth + multi-tenant core + billing stub
2. Meta OAuth + Page/IG connection + basic analytics sync
3. Business onboarding + AI strategy generation
4. Content Agent + content calendar + manual scheduling
5. Design Agent + image generation + brand kit
6. Auto-publish worker + best-time prediction
7. Ads Agent + Marketing API campaign creation (draft mode first, no auto-launch)
8. Optimization Engine (read-only recommendations first, then automated actions behind a
   feature flag)
9. Full agent orchestration + chat console
10. Analytics dashboards + reporting exports
