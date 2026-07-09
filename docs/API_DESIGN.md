# API Design — `/api/v1`

All routes require `Authorization: Bearer <JWT>` unless marked public. Tenant (`agency_id`)
is derived from the JWT; `business_id` is validated against `business_users`/agency
ownership on every request.

## Auth
| Method | Route | Description |
|---|---|---|
| POST | `/auth/register` | Email/password signup, creates Agency + owner User |
| POST | `/auth/login` | Email/password login |
| GET  | `/auth/google` / `/auth/google/callback` | Google OAuth |
| GET  | `/auth/facebook` / `/auth/facebook/callback` | Facebook OAuth login (user identity, not page access) |
| POST | `/auth/refresh` | Rotate refresh token → new access token |
| POST | `/auth/logout` | Revoke refresh token |

## Agencies & Billing
| Method | Route | Description |
|---|---|---|
| GET | `/agencies/me` | Current agency profile + plan |
| PATCH | `/agencies/me` | Update agency settings |
| GET | `/agencies/me/team` | List team members |
| POST | `/agencies/me/team/invite` | Invite team member |
| GET | `/billing/plans` | List available plans |
| POST | `/billing/checkout` | Create Stripe checkout session |
| POST | `/billing/webhook` | Stripe webhook (public, signature-verified) |

## Businesses
| Method | Route | Description |
|---|---|---|
| GET | `/businesses` | List businesses for agency |
| POST | `/businesses` | Create business (starts onboarding) |
| GET | `/businesses/:id` | Business detail |
| PATCH | `/businesses/:id` | Update onboarding fields |
| POST | `/businesses/:id/analyze` | Trigger AI business intelligence job |
| GET | `/businesses/:id/strategy` | Get latest marketing strategy |
| POST | `/businesses/:id/strategy/regenerate` | Regenerate strategy |

## Meta Integration
| Method | Route | Description |
|---|---|---|
| GET | `/meta/oauth/start?businessId=` | Redirect to Facebook Business Login |
| GET | `/meta/oauth/callback` | Exchange code, list available pages |
| POST | `/meta/connect` | Persist selected Page + IG account + ad account |
| DELETE | `/meta/connections/:id` | Disconnect |
| POST | `/webhooks/meta` | Meta webhook receiver (public, signed) |
| POST | `/webhooks/meta/data-deletion` | Meta data-deletion callback (public, signed) |

## Content Engine
| Method | Route | Description |
|---|---|---|
| GET | `/businesses/:id/content/posts?status=&platform=` | List posts |
| POST | `/businesses/:id/content/generate` | AI-generate a batch of posts (Content + Design agents) |
| GET | `/content/posts/:id` | Post detail |
| PATCH | `/content/posts/:id` | Edit caption/media/schedule |
| POST | `/content/posts/:id/approve` | Approve for scheduling |
| POST | `/content/posts/:id/reject` | Reject with feedback (regenerates) |
| POST | `/content/posts/:id/publish-now` | Immediate publish |
| DELETE | `/content/posts/:id` | Delete draft |
| GET | `/businesses/:id/content/calendar` | Calendar view (date range) |
| POST | `/businesses/:id/content/best-times` | Recompute best-time slots |

## Advertising
| Method | Route | Description |
|---|---|---|
| GET | `/businesses/:id/ads/campaigns` | List campaigns |
| POST | `/businesses/:id/ads/campaigns/generate` | AI-generate campaign (Ads Agent), status=draft |
| POST | `/ads/campaigns/:id/launch` | Push draft campaign to Meta Marketing API |
| PATCH | `/ads/campaigns/:id` | Update budget/status |
| POST | `/ads/campaigns/:id/pause` | Pause on Meta |
| GET | `/ads/campaigns/:id/performance` | Performance time series |
| GET | `/businesses/:id/ads/recommendations` | Optimization Engine suggestions |
| POST | `/ads/optimization-actions/:id/approve` | Approve a recommended action (if not full-auto) |

## Analytics
| Method | Route | Description |
|---|---|---|
| GET | `/businesses/:id/analytics/overview` | Followers, reach, engagement, leads, ROI |
| GET | `/businesses/:id/analytics/export` | CSV/PDF export |

## AI Agents
| Method | Route | Description |
|---|---|---|
| POST | `/businesses/:id/agents/chat` | Send message to orchestrator (SSE streaming response) |
| GET | `/businesses/:id/agents/history` | Prior agent conversation/log |
| GET | `/businesses/:id/agents/generations` | AI generation audit log (cost, tokens) |

## Conventions
- Pagination: `?page=&pageSize=` → `{ data, page, pageSize, total }`
- Errors: `{ error: { code, message, details? } }` with standard HTTP status codes
- All list endpoints support `?businessId=` scoping where applicable
- Webhooks verify `X-Hub-Signature-256` against `META_APP_SECRET`
