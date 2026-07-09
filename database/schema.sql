-- =====================================================================
-- AI Marketing Manager — PostgreSQL Schema
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------
-- TENANCY & AUTH
-- ---------------------------------------------------------------------
CREATE TABLE agencies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    slug              TEXT UNIQUE NOT NULL,
    plan              TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','agency')),
    stripe_customer_id TEXT,
    settings          JSONB NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email             TEXT UNIQUE NOT NULL,
    password_hash     TEXT,                    -- null if OAuth-only
    full_name         TEXT,
    avatar_url        TEXT,
    role              TEXT NOT NULL DEFAULT 'owner'
                      CHECK (role IN ('owner','admin','manager','client_viewer')),
    auth_provider     TEXT NOT NULL DEFAULT 'email'
                      CHECK (auth_provider IN ('email','google','facebook')),
    provider_user_id  TEXT,
    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_agency ON users(agency_id);

CREATE TABLE refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id           UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    plan                TEXT NOT NULL CHECK (plan IN ('free','pro','agency')),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','trialing','past_due','canceled')),
    stripe_subscription_id TEXT,
    current_period_end TIMESTAMPTZ,
    seats               INT NOT NULL DEFAULT 1,
    ai_credits_monthly   INT NOT NULL DEFAULT 100,
    ai_credits_used      INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- BUSINESSES (clients / brands managed by an agency)
-- ---------------------------------------------------------------------
CREATE TABLE businesses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    website_url       TEXT,
    industry          TEXT,
    products_services TEXT,
    target_audience   TEXT,
    country           TEXT,
    language           TEXT DEFAULT 'en',
    marketing_goals   TEXT[],
    monthly_ad_budget NUMERIC(12,2),
    brand_voice       TEXT,
    brand_colors      JSONB DEFAULT '[]',      -- ["#111111", "#F5A623"]
    logo_url          TEXT,
    onboarding_status TEXT NOT NULL DEFAULT 'pending'
                      CHECK (onboarding_status IN ('pending','analyzing','strategy_ready','active')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_businesses_agency ON businesses(agency_id);

CREATE TABLE business_users (       -- who can access which business (client_viewer scoping)
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (business_id, user_id)
);

-- ---------------------------------------------------------------------
-- META (FACEBOOK / INSTAGRAM) CONNECTIONS
-- ---------------------------------------------------------------------
CREATE TABLE meta_connections (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id            UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fb_page_id             TEXT NOT NULL,
    fb_page_name           TEXT,
    ig_business_id         TEXT,
    ig_username            TEXT,
    ad_account_id          TEXT,
    page_access_token_enc  TEXT NOT NULL,      -- AES-256-GCM encrypted
    user_access_token_enc  TEXT,
    token_expires_at       TIMESTAMPTZ,
    scopes                 TEXT[],
    status                 TEXT NOT NULL DEFAULT 'connected'
                           CHECK (status IN ('connected','expired','revoked','error')),
    connected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_meta_conn_page ON meta_connections(business_id, fb_page_id);

-- ---------------------------------------------------------------------
-- AI STRATEGY & BUSINESS INTELLIGENCE
-- ---------------------------------------------------------------------
CREATE TABLE marketing_strategies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    summary         TEXT,
    target_personas JSONB DEFAULT '[]',
    content_pillars JSONB DEFAULT '[]',
    competitor_analysis JSONB DEFAULT '{}',
    industry_trends JSONB DEFAULT '{}',
    posting_cadence JSONB DEFAULT '{}',        -- {"facebook": "5/week", "instagram": "1/day"}
    generated_by_model TEXT,
    version         INT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE competitors (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    fb_page_url  TEXT,
    ig_handle    TEXT,
    notes        TEXT,
    last_analyzed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- CONTENT ENGINE
-- ---------------------------------------------------------------------
CREATE TABLE content_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
    post_type       TEXT NOT NULL CHECK (post_type IN
                    ('single_image','carousel','reel','story','text')),
    category        TEXT CHECK (category IN
                    ('promotional','festival','educational','lead_gen','product_launch','engagement','other')),
    caption         TEXT,
    hashtags        TEXT[],
    cta             TEXT,
    media_urls      JSONB DEFAULT '[]',
    reel_script     TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_review','approved','scheduled','published','failed')),
    scheduled_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    meta_post_id    TEXT,                      -- id returned by Graph API after publish
    created_by      TEXT NOT NULL DEFAULT 'ai' CHECK (created_by IN ('ai','user')),
    approved_by     UUID REFERENCES users(id),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_business_status ON content_posts(business_id, status);
CREATE INDEX idx_posts_scheduled ON content_posts(scheduled_at) WHERE status = 'scheduled';

CREATE TABLE content_calendar_slots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    time_of_day   TIME NOT NULL,
    platform      TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
    predicted_score NUMERIC(5,2),               -- best-time prediction confidence
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- AI GENERATION LOG (audit + cost tracking, all agents)
-- ---------------------------------------------------------------------
CREATE TABLE ai_generations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID REFERENCES businesses(id) ON DELETE CASCADE,
    agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    agent_type      TEXT NOT NULL CHECK (agent_type IN
                    ('content','design','ads','seo','analytics','competitor_research','trend_research','orchestrator')),
    model_provider  TEXT NOT NULL CHECK (model_provider IN ('claude','openai','gemini')),
    model_name      TEXT,
    input_summary   TEXT,
    output          JSONB,
    tokens_input    INT,
    tokens_output   INT,
    cost_usd        NUMERIC(10,4),
    related_post_id UUID REFERENCES content_posts(id),
    related_campaign_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_gen_agency_date ON ai_generations(agency_id, created_at);

-- ---------------------------------------------------------------------
-- ADVERTISING
-- ---------------------------------------------------------------------
CREATE TABLE ad_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    meta_campaign_id TEXT,                      -- null until created on Meta
    name            TEXT NOT NULL,
    objective       TEXT NOT NULL CHECK (objective IN
                    ('leads','sales','traffic','awareness','app_installs')),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_approval','active','paused','completed','archived')),
    daily_budget    NUMERIC(12,2),
    lifetime_budget NUMERIC(12,2),
    start_date      DATE,
    end_date        DATE,
    autonomy_level  TEXT NOT NULL DEFAULT 'manual'
                    CHECK (autonomy_level IN ('manual','recommend_only','full_auto')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ad_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    meta_adset_id   TEXT,
    name            TEXT NOT NULL,
    targeting       JSONB NOT NULL DEFAULT '{}',  -- age, gender, locations, interests, lookalike src
    is_retargeting  BOOLEAN NOT NULL DEFAULT false,
    is_lookalike    BOOLEAN NOT NULL DEFAULT false,
    daily_budget    NUMERIC(12,2),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','paused','completed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_set_id       UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
    meta_ad_id      TEXT,
    headline        TEXT,
    primary_text    TEXT,
    cta             TEXT,
    creative_media_url TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','paused','rejected','archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ad_performance_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id         UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    impressions   BIGINT DEFAULT 0,
    clicks        BIGINT DEFAULT 0,
    spend         NUMERIC(12,2) DEFAULT 0,
    cpc           NUMERIC(10,4),
    cpm           NUMERIC(10,4),
    ctr           NUMERIC(6,4),
    conversions   INT DEFAULT 0,
    revenue       NUMERIC(12,2) DEFAULT 0,
    roas          NUMERIC(8,4)
);
CREATE INDEX idx_ad_perf_ad_time ON ad_performance_snapshots(ad_id, snapshot_at);

CREATE TABLE optimization_actions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ad_id         UUID REFERENCES ads(id),
    ad_set_id     UUID REFERENCES ad_sets(id),
    action_type   TEXT NOT NULL CHECK (action_type IN
                  ('pause_ad','increase_budget','decrease_budget','duplicate_ad','rotate_creative','recommendation_only')),
    reason        TEXT,
    before_state  JSONB,
    after_state   JSONB,
    executed_by   TEXT NOT NULL DEFAULT 'ai_optimization_engine',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ANALYTICS (organic)
-- ---------------------------------------------------------------------
CREATE TABLE analytics_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
    snapshot_date   DATE NOT NULL,
    followers       INT,
    followers_delta INT,
    reach           BIGINT,
    impressions     BIGINT,
    engagement      BIGINT,
    profile_views   BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(business_id, platform, snapshot_date)
);

-- ---------------------------------------------------------------------
-- APPROVAL / NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('content_post','ad_campaign')),
    entity_id       UUID NOT NULL,
    requested_by    TEXT NOT NULL DEFAULT 'ai',
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewer_id     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TRIGGERS: updated_at maintenance
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agencies_updated BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON content_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON ad_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
