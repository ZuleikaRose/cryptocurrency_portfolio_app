-- CPA (Cryptocurrency Portfolio App): database schema.
--
-- PostgreSQL 15+. Models every feature and setting the front end keeps today, so the
-- browser-only build (sample data in app/src/data, accounts in localStorage under cpa:v1:*)
-- can move to a server. Table and column comments cite the page spec or story they come from.
--
-- Live prices: a scheduled job (the cryptorank-sync Edge Function on Supabase) writes CryptoRank
-- v3 price, 24h change, market cap and volume into coins every 10 minutes, and 7d change and FDV
-- about every 2 days, and records each run in market_sync. Coins without a cryptorank_slug keep
-- their sample figures. A second job (the price-history-sync Edge Function) writes Coinbase
-- Exchange closes into coin_prices, and 1h change and the 7d sparkline into coins, every 15
-- minutes, recording each run in price_history_sync.
--
-- Guest and demo sessions stay in memory and are not stored (prompt.md clarifications).
-- Passwords are never stored: only a salted PBKDF2-SHA-256 hash (lib/auth.js).
-- Cards are never stored in full: only brand, last 4 digits and expiry (lib/billing.js).
--
-- Run:  psql "$DATABASE_URL" -f schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email

CREATE SCHEMA IF NOT EXISTS cpa;
SET search_path = cpa, public;

-- Keeps updated_at current on every UPDATE.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 1. Reference data (today: app/src/data/*.js; live prices from CryptoRank)
-- =====================================================================

-- Market categories (data/coins.js `categories`); also fund and round sectors.
CREATE TABLE categories (
  name       text PRIMARY KEY,
  sort_order smallint NOT NULL DEFAULT 0
);

-- Coins and their latest market figures (01-market.md, 03-coin-detail.md).
CREATE TABLE coins (
  id               text PRIMARY KEY,                          -- slug, e.g. "bitcoin"
  rank             integer NOT NULL UNIQUE DEFERRABLE INITIALLY DEFERRED CHECK (rank > 0),  -- re-ranked when a coin is added
  name             text NOT NULL,
  symbol           text NOT NULL CHECK (symbol = upper(symbol)),
  category         text NOT NULL REFERENCES categories (name),
  logo_tint        text,                                      -- fallback logo colour
  price_usd        numeric(30, 12) NOT NULL CHECK (price_usd >= 0),
  change_1h        numeric(10, 4) NOT NULL DEFAULT 0,         -- percent; from Coinbase 15-minute closes when history_updated_at is set
  change_24h       numeric(10, 4) NOT NULL DEFAULT 0,
  change_7d        numeric(10, 4) NOT NULL DEFAULT 0,
  market_cap_usd   numeric(24, 2) NOT NULL CHECK (market_cap_usd >= 0),
  fdv_usd          numeric(24, 2) CHECK (fdv_usd >= 0),
  volume_24h_usd   numeric(24, 2) CHECK (volume_24h_usd >= 0),
  sparkline_7d     numeric[] NOT NULL DEFAULT '{}',           -- 24 points: Coinbase hourly closes over 7 days, or a sample shape
  listed_on        date,
  contract_address text CHECK (contract_address ~ '^0x[0-9a-f]{40}$'),  -- null for native coins
  contract_verified boolean NOT NULL DEFAULT false,           -- trust signal (journey rule 4)
  about            text,
  total_supply       numeric(30, 6),
  circulating_supply numeric(30, 6),
  max_supply         numeric(30, 6),
  cryptorank_slug  text UNIQUE,                               -- CryptoRank v3 slug; null keeps sample figures
  price_source     text NOT NULL DEFAULT 'sample' CHECK (price_source IN ('sample', 'cryptorank')),  -- trust signal (journey rule 4)
  price_updated_at timestamptz,                               -- when CryptoRank last reported price, 24h, cap, volume
  cryptorank_id    integer UNIQUE,                            -- CryptoRank v3 id, for the per-coin endpoint
  details_updated_at timestamptz,                             -- when CryptoRank last reported change_7d and fdv_usd (~every 2 days)
  history_updated_at timestamptz,                             -- when price-history-sync last wrote coin_prices, change_1h and sparkline_7d; null keeps the sample chart
  updated_at       timestamptz NOT NULL DEFAULT now()         -- "Last updated" / stale over 5 min
);
CREATE INDEX coins_symbol_idx ON coins (symbol);   -- not unique: copycat tickers exist (US-2.5)
CREATE INDEX coins_category_idx ON coins (category);
CREATE TRIGGER coins_touch BEFORE UPDATE ON coins FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Price history for charts: ranges 1D · 7D · 1M · 3M · 1Y · ALL (03-coin-detail.md). Coinbase
-- Exchange closes in USD, stamped at the candle's close (UTC): 15-minute closes kept 26 hours,
-- hourly 8 days, 6-hourly 32 days, daily for the whole history. price_history(coin_id, range_id)
-- returns one range plus the highest and lowest daily close (ATH / ATL); price_at(coin_id, at_ms)
-- returns the nearest close to a moment (the transaction sheet's "Use market price").
CREATE TABLE coin_prices (
  coin_id   text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  at        timestamptz NOT NULL,                               -- candle close (UTC); midnight = the previous day's daily close
  price_usd numeric(30, 12) NOT NULL CHECK (price_usd >= 0),
  volume_usd numeric(24, 2),
  PRIMARY KEY (coin_id, at)
);

-- Exchanges (data/directory.js) and a coin's markets tab.
CREATE TABLE exchanges (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  type           text NOT NULL CHECK (type IN ('Centralized', 'Decentralized')),
  volume_24h_usd numeric(24, 2)
);

CREATE TABLE coin_markets (
  coin_id      text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  exchange_id  text NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
  pair         text NOT NULL,                                 -- "BTC/USDT"
  price_usd    numeric(30, 12),
  volume_share numeric(6, 5) CHECK (volume_share BETWEEN 0 AND 1),
  PRIMARY KEY (coin_id, exchange_id, pair)
);

-- Last run of the live price sync (the cryptorank-sync Edge Function). One row; server-only.
CREATE TABLE market_sync (
  id               boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_started_at  timestamptz,                               -- runs start at most every 9 minutes
  last_finished_at timestamptz,
  last_status      text CHECK (last_status IN ('ok', 'error')),
  coins_updated    integer NOT NULL DEFAULT 0,
  credits_used     integer NOT NULL DEFAULT 0,                -- CryptoRank credits (free plan: 400 a day)
  missing_slugs    text[] NOT NULL DEFAULT '{}',              -- mapped coins not found in the top 200
  last_error       text
);

-- Last run of the price history sync (the price-history-sync Edge Function). One row; server-only.
CREATE TABLE price_history_sync (
  id               boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_started_at  timestamptz,                               -- runs start at most every 10 minutes
  last_finished_at timestamptz,
  last_status      text CHECK (last_status IN ('ok', 'error')),
  coins_updated    integer NOT NULL DEFAULT 0,
  requests         integer NOT NULL DEFAULT 0,                -- Coinbase requests (public, 10 a second)
  fetched_at       jsonb NOT NULL DEFAULT '{}',               -- last fetch per candle size in seconds
  backfilled       text[] NOT NULL DEFAULT '{}',              -- coins whose daily closes reach their first Coinbase day
  skipped_coins    text[] NOT NULL DEFAULT '{}',              -- no Coinbase product, or price over 10% from CryptoRank's
  last_error       text
);

-- CryptoRank credits spent each UTC day by the cryptorank-lookup Edge Function, which lookup.py
-- calls so the API key stays a function secret. Capped at 60 a day, leaving the price sync its
-- ~305 of the free plan's 400. Server-only; rows older than 30 days are removed.
CREATE TABLE cryptorank_lookup_usage (
  day          date PRIMARY KEY DEFAULT current_date,
  credits_used integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0)
);

-- Tokenomics: vesting schedule per coin and its allocations (03-coin-detail.md Tokenomics).
CREATE TABLE vesting_schedules (
  coin_id      text PRIMARY KEY REFERENCES coins (id) ON DELETE CASCADE,
  total_supply numeric(30, 6) NOT NULL CHECK (total_supply > 0),
  tge_date     date NOT NULL
);

CREATE TABLE vesting_allocations (
  coin_id       text NOT NULL REFERENCES vesting_schedules (coin_id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (name IN ('Team', 'Investors', 'Ecosystem', 'Community', 'Foundation')),
  share         numeric(6, 5) NOT NULL CHECK (share > 0 AND share <= 1),
  tge_share     numeric(6, 5) NOT NULL DEFAULT 0 CHECK (tge_share BETWEEN 0 AND 1),
  cliff_months  smallint NOT NULL DEFAULT 0 CHECK (cliff_months >= 0),
  vest_months   smallint NOT NULL CHECK (vest_months > 0),
  unlock_day    smallint NOT NULL CHECK (unlock_day BETWEEN 1 AND 31),
  PRIMARY KEY (coin_id, name)
);

-- Unlock events (08-unlocks.md). Same-day tranches are grouped into one event.
CREATE TABLE unlock_events (
  id          text PRIMARY KEY,                               -- "<coin>-<yyyy-mm-dd>"
  coin_id     text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  unlock_at   timestamptz NOT NULL,
  amount      numeric(30, 6) NOT NULL CHECK (amount > 0),
  allocations text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX unlock_events_at_idx ON unlock_events (unlock_at);
CREATE INDEX unlock_events_coin_idx ON unlock_events (coin_id);

-- Funds (10-fund-profile.md). Tier 1 is the most established.
CREATE TABLE funds (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  tier            smallint NOT NULL CHECK (tier BETWEEN 1 AND 5),
  type            text NOT NULL CHECK (type IN ('Venture fund', 'Accelerator', 'Hedge fund', 'Family office', 'DAO', 'Corporate VC', 'Angel syndicate', 'Launchpad')),
  founded         smallint,
  deals           integer NOT NULL DEFAULT 0,
  deals_30d       integer NOT NULL DEFAULT 0,
  deployed_usd    numeric(24, 2)
);

-- "Top sectors" bar on a fund profile: share of deals per sector, in percent.
CREATE TABLE fund_sectors (
  fund_id text NOT NULL REFERENCES funds (id) ON DELETE CASCADE,
  sector  text NOT NULL REFERENCES categories (name),
  share   smallint NOT NULL CHECK (share BETWEEN 0 AND 100),
  PRIMARY KEY (fund_id, sector)
);

-- Funding rounds (07-fundraising.md). coin_id is null for projects without a token yet.
CREATE TABLE funding_rounds (
  id              text PRIMARY KEY,
  coin_id         text REFERENCES coins (id) ON DELETE SET NULL,
  project         text NOT NULL,
  sector          text NOT NULL REFERENCES categories (name),
  round_type      text NOT NULL CHECK (round_type IN ('Pre-seed', 'Seed', 'Series A', 'Series B', 'Strategic')),
  announced_on    date NOT NULL,
  amount_usd      numeric(24, 2) NOT NULL CHECK (amount_usd > 0),
  valuation_usd   numeric(24, 2),
  token_price_usd numeric(30, 12)                             -- entry vs round price (Portfolio)
);
CREATE INDEX funding_rounds_date_idx ON funding_rounds (announced_on DESC);
CREATE INDEX funding_rounds_sector_idx ON funding_rounds (sector);

CREATE TABLE round_investors (
  round_id text NOT NULL REFERENCES funding_rounds (id) ON DELETE CASCADE,
  fund_id  text NOT NULL REFERENCES funds (id) ON DELETE CASCADE,
  is_lead  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (round_id, fund_id)
);
CREATE INDEX round_investors_fund_idx ON round_investors (fund_id);

-- Token sales: IDO / IEO / ICO (09-token-sales.md).
CREATE TABLE token_sales (
  id                text PRIMARY KEY,
  coin_id           text REFERENCES coins (id) ON DELETE SET NULL,
  name              text NOT NULL,
  symbol            text NOT NULL,
  sale_type         text NOT NULL CHECK (sale_type IN ('IDO', 'IEO', 'ICO')),
  launchpad         text NOT NULL,
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  raise_usd         numeric(24, 2) NOT NULL,
  price_usd         numeric(30, 12) NOT NULL,
  fdv_usd           numeric(24, 2),
  sold_share        numeric(6, 5) CHECK (sold_share BETWEEN 0 AND 1),
  current_price_usd numeric(30, 12),                          -- when no linked coin
  ath_roi           numeric(12, 4),
  CHECK (ends_at > starts_at)
);
CREATE INDEX token_sales_start_idx ON token_sales (starts_at);

-- Plans (16-account-settings.md, 18-faqs.md plan table).
CREATE TABLE plans (
  id         text PRIMARY KEY,
  label      text NOT NULL,
  price_usd  numeric(8, 2) NOT NULL CHECK (price_usd >= 0),
  period     text CHECK (period IN ('month', 'year'))
);

-- Promotions (21-promotions.md) and the points redemption (POINTS10).
CREATE TABLE promotions (
  code               text PRIMARY KEY CHECK (code = upper(code)),
  title              text NOT NULL,
  plan_id            text REFERENCES plans (id),              -- null: any Pro plan
  percent_off        numeric(5, 2) CHECK (percent_off > 0 AND percent_off <= 100),
  fixed_price_usd    numeric(8, 2),
  detail             text,
  new_accounts_only  boolean NOT NULL DEFAULT false,          -- created in the last 30 days
  points_cost        integer CHECK (points_cost > 0),         -- set for points redemptions
  ends_at            timestamptz,
  terms              text,
  CHECK ((percent_off IS NULL) <> (fixed_price_usd IS NULL))
);

-- Help content: FAQs (18-faqs.md), Learn cards, glossary ⓘ definitions.
CREATE TABLE faq_sections (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE faq_items (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id text NOT NULL REFERENCES faq_sections (id) ON DELETE CASCADE,
  question   text NOT NULL,
  answer     text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE learn_articles (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title   text NOT NULL,
  summary text NOT NULL,
  path    text NOT NULL CHECK (path LIKE '/%')
);

CREATE TABLE glossary_terms (
  key        text PRIMARY KEY,                                -- "marketCap", "fdv", …
  definition text NOT NULL
);

-- =====================================================================
-- 2. Accounts (today: cpa:v1:accounts, cpa:v1:session, cpa:v1:resetTokens)
-- =====================================================================

-- 13-login.md, 14-signup.md. Passwords: 13+ chars with lower, upper, digit, symbol, and not
-- on the leaked list; that check runs before hashing, so it isn't a constraint here.
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext NOT NULL UNIQUE CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  password_hash     text NOT NULL,                            -- base64 PBKDF2-SHA-256
  password_salt     text NOT NULL,                            -- base64, 16 bytes
  password_iterations integer NOT NULL CHECK (password_iterations >= 100000),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Signed-in sessions. Store only a hash of the session token.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Login lockout: 5 failures lock the form for 60 s (13-login.md).
CREATE TABLE login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        citext NOT NULL,
  succeeded    boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (email, attempted_at DESC);

-- Password reset (15-forgot-password.md): single use, 30-minute expiry, SHA-256 hash only.
-- One live token per account; requests are rate limited per email.
CREATE TABLE password_reset_tokens (
  token_hash   text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  CHECK (expires_at <= requested_at + interval '30 minutes')
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

CREATE TABLE password_reset_requests (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        citext NOT NULL,                               -- unknown emails count too
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_requests_email_idx ON password_reset_requests (email, requested_at DESC);

-- =====================================================================
-- 3. Settings (state/context.js defaultSettings; 16-account-settings.md,
--    27-accessibility-menu.md). One row per user; defaults match the app.
-- =====================================================================

CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

  -- Display
  language        text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es', 'pt')),  -- lib/i18n.js
  currency        text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  theme           text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  colors          text NOT NULL DEFAULT 'standard' CHECK (colors IN ('standard', 'swapped', 'cb-safe')),
  auto_refresh    boolean NOT NULL DEFAULT true,
  stop_animations boolean NOT NULL DEFAULT false,             -- data-motion="off"
  hide_balances   boolean NOT NULL DEFAULT false,
  watchlist_sort  text NOT NULL DEFAULT 'mine',
  watchlist_list  text NOT NULL DEFAULT 'main',              -- 'main' or a watchlists.id (US-6.2)
  chart_range     text NOT NULL DEFAULT '1M' CHECK (chart_range IN ('1D', '7D', '1M', '3M', '1Y', 'ALL')),
  chart_summaries boolean NOT NULL DEFAULT false,             -- auto chart summaries
  auto_advance    boolean NOT NULL DEFAULT false,             -- carousels
  analytics       boolean NOT NULL DEFAULT false,

  -- Notifications (12-alerts.md, US-7.3)
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start   time NOT NULL DEFAULT '22:00',
  quiet_hours_end     time NOT NULL DEFAULT '07:00',
  weekly_digest       boolean NOT NULL DEFAULT true,
  reminder_timings    text[] NOT NULL DEFAULT '{1h}' CHECK (reminder_timings <@ ARRAY['1h', '24h']),
  notifications_asked boolean NOT NULL DEFAULT false,         -- journey rule 1

  -- AI features (25-ai-integration.md)
  ai_explain_metric  boolean NOT NULL DEFAULT true,
  ai_similar_coins   boolean NOT NULL DEFAULT true,
  ai_digest_summary  boolean NOT NULL DEFAULT false,

  -- Accessibility menu (27-accessibility-menu.md)
  a11y_profiles           text[] NOT NULL DEFAULT '{}',
  a11y_text_size          smallint NOT NULL DEFAULT 100 CHECK (a11y_text_size BETWEEN 80 AND 200),
  a11y_font               text NOT NULL DEFAULT 'default' CHECK (a11y_font IN ('default', 'readable', 'dyslexic')),
  a11y_line_height        numeric(3, 2) NOT NULL DEFAULT 0 CHECK (a11y_line_height = 0 OR a11y_line_height BETWEEN 1 AND 2),  -- 0: app default
  a11y_letter_spacing     numeric(3, 2) NOT NULL DEFAULT 0 CHECK (a11y_letter_spacing BETWEEN 0 AND 0.2),               -- em
  a11y_align              text NOT NULL DEFAULT 'default' CHECK (a11y_align IN ('default', 'left', 'center')),
  a11y_contrast           text NOT NULL DEFAULT 'default' CHECK (a11y_contrast IN ('default', 'high', 'dark', 'light')),
  a11y_saturation         text NOT NULL DEFAULT 'default' CHECK (a11y_saturation IN ('default', 'low', 'high', 'mono')),
  a11y_highlight_links    boolean NOT NULL DEFAULT false,
  a11y_highlight_headings boolean NOT NULL DEFAULT false,
  a11y_strong_focus       boolean NOT NULL DEFAULT false,
  a11y_big_cursor         boolean NOT NULL DEFAULT false,
  a11y_reading_guide      boolean NOT NULL DEFAULT false,
  a11y_hide_images        boolean NOT NULL DEFAULT false,
  a11y_summary_size       text NOT NULL DEFAULT 'M' CHECK (a11y_summary_size IN ('S', 'M', 'L', 'XL')),

  -- Market tab (journey rule 2: remember filters and sorts per tab; rule 5: Simple vs Pro)
  market_view           text NOT NULL DEFAULT 'coins',
  market_sort           text NOT NULL DEFAULT 'rank',
  market_dir            text NOT NULL DEFAULT 'asc' CHECK (market_dir IN ('asc', 'desc')),
  market_category       text NOT NULL DEFAULT 'All',
  market_density        text NOT NULL DEFAULT 'simple' CHECK (market_density IN ('simple', 'pro')),
  market_gainers_window text NOT NULL DEFAULT '24h' CHECK (market_gainers_window IN ('1h', '24h', '7d')),

  -- Unlocks tab (08-unlocks.md)
  unlocks_range          text NOT NULL DEFAULT 'week' CHECK (unlocks_range IN ('today', 'week', 'month', 'custom')),
  unlocks_watchlist_only boolean NOT NULL DEFAULT false,
  unlocks_min_one        boolean NOT NULL DEFAULT false,      -- only unlocks ≥ 1% of supply
  unlocks_sort           text NOT NULL DEFAULT 'share' CHECK (unlocks_sort IN ('share', 'usd', 'date')),
  unlocks_view           text NOT NULL DEFAULT 'list' CHECK (unlocks_view IN ('list', 'calendar')),

  -- Fundraising tab (07-fundraising.md)
  fundraising_sectors    text[] NOT NULL DEFAULT '{}',
  fundraising_types      text[] NOT NULL DEFAULT '{}',
  fundraising_min_amount numeric(24, 2) NOT NULL DEFAULT 0 CHECK (fundraising_min_amount >= 0),
  fundraising_max_amount numeric(24, 2) CHECK (fundraising_max_amount > 0),
  fundraising_days       smallint NOT NULL DEFAULT 90 CHECK (fundraising_days IN (0, 7, 30, 90)),  -- 0: all time
  fundraising_investor   text NOT NULL DEFAULT '',
  fundraising_sort       text NOT NULL DEFAULT 'newest' CHECK (fundraising_sort IN ('newest', 'amount')),

  -- Portfolio tab (11-portfolio.md, journey rule 2)
  portfolio_range      text NOT NULL DEFAULT '1M' CHECK (portfolio_range IN ('24h', '7D', '1M', '3M', '1Y', 'ALL')),
  portfolio_sort       text NOT NULL DEFAULT 'value' CHECK (portfolio_sort IN ('value', 'pnl', 'pnlPct', 'name')),
  portfolio_tax_method text NOT NULL DEFAULT 'fifo' CHECK (portfolio_tax_method IN ('fifo', 'average')),  -- lib/taxlots.js

  -- Coin detail › Markets table (03-coin-detail.md, journey rule 2)
  coin_markets_sort text NOT NULL DEFAULT 'volume' CHECK (coin_markets_sort IN ('exchange', 'price', 'volume', 'share')),
  coin_markets_dir  text NOT NULL DEFAULT 'desc' CHECK (coin_markets_dir IN ('asc', 'desc')),

  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER user_settings_touch BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Counters and flags that aren't settings.
CREATE TABLE user_state (
  user_id                   uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  onboarded                 boolean NOT NULL DEFAULT false,   -- 02-onboarding.md
  visits                    integer NOT NULL DEFAULT 0 CHECK (visits >= 0),  -- feedback prompt after the 5th
  feedback_prompt_dismissed_at timestamptz,
  last_digest_at            timestamptz,                      -- weekly digest, Monday 08:00 local
  points_spent              integer NOT NULL DEFAULT 0 CHECK (points_spent >= 0)
);

-- Onboarding interest picker (02-onboarding.md).
CREATE TABLE user_interest_coins (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coin_id text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, coin_id)
);

CREATE TABLE user_interest_sectors (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sector  text NOT NULL REFERENCES categories (name),
  PRIMARY KEY (user_id, sector)
);

-- New users get settings and state rows with the app defaults.
CREATE OR REPLACE FUNCTION create_user_defaults() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  INSERT INTO user_state (user_id) VALUES (NEW.id);
  INSERT INTO subscriptions (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 4. Watchlist, recents, votes (04-search.md, 05-watchlist.md, 03-coin-detail.md)
-- =====================================================================

-- "My order" sort uses position.
CREATE TABLE watchlist_items (
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coin_id  text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  position integer NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, coin_id)
);
CREATE INDEX watchlist_items_order_idx ON watchlist_items (user_id, position);

-- Named watchlists (US-6.2): "Main" is watchlist_items; these are up to 9 more (10 lists in all).
CREATE TABLE watchlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  position   integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id)
);
CREATE INDEX watchlists_order_idx ON watchlists (user_id, position);

CREATE OR REPLACE FUNCTION limit_watchlists() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM watchlists WHERE id = NEW.id AND user_id = NEW.user_id)
     AND (SELECT count(*) FROM watchlists WHERE user_id = NEW.user_id) >= 9 THEN
    RAISE EXCEPTION 'You can have up to 10 watchlists. Delete one to add another.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER watchlists_limit BEFORE INSERT ON watchlists FOR EACH ROW EXECUTE FUNCTION limit_watchlists();

-- Coins in a named list, in the list's own order.
CREATE TABLE watchlist_list_coins (
  user_id      uuid NOT NULL,
  watchlist_id uuid NOT NULL,
  coin_id      text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  position     integer NOT NULL,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, watchlist_id, coin_id),
  FOREIGN KEY (user_id, watchlist_id) REFERENCES watchlists (user_id, id) ON DELETE CASCADE
);
CREATE INDEX watchlist_list_coins_coin_idx ON watchlist_list_coins (coin_id);

-- Last 10 coins viewed and last 10 searches (US-P04.2); trimmed by trigger below.
CREATE TABLE recent_coins (
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coin_id   text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, coin_id)
);

CREATE TABLE recent_searches (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  query       text NOT NULL CHECK (length(btrim(query)) > 0),
  searched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, query)
);
CREATE UNIQUE INDEX recent_searches_ci_idx ON recent_searches (user_id, lower(query));

-- One sentiment vote per coin per day (US-P03.2).
CREATE TABLE sentiment_votes (
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coin_id  text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  vote_day date NOT NULL DEFAULT current_date,
  vote     text NOT NULL CHECK (vote IN ('bullish', 'bearish')),
  PRIMARY KEY (user_id, coin_id, vote_day)
);
CREATE INDEX sentiment_votes_coin_idx ON sentiment_votes (coin_id, vote_day);

-- =====================================================================
-- 5. Portfolio (11-portfolio.md, US-6.x)
-- =====================================================================

-- Manual, CSV-imported and wallet-imported transactions; holdings are derived from them by
-- average cost, never stored. A wallet import (US-6.4) records one transfer per coin per UTC
-- day of the address's history, priced at that day's close, plus an opening balance or an
-- adjustment at the import day's price where the history doesn't explain the balance.
CREATE TABLE transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coin_id     text NOT NULL REFERENCES coins (id),
  type        text NOT NULL CHECK (type IN ('buy', 'sell', 'transfer-in', 'transfer-out')),
  amount      numeric(30, 12) NOT NULL CHECK (amount > 0),
  price_usd   numeric(30, 12) NOT NULL CHECK (price_usd >= 0),  -- cost basis per coin; wallet imports: that day's closing price (Coinbase, UTC)
  fee_usd     numeric(18, 2) NOT NULL DEFAULT 0 CHECK (fee_usd >= 0),
  occurred_at timestamptz NOT NULL,                              -- wallet imports: 12:00 UTC on the transfer day (00:00 for an opening balance)
  note        text NOT NULL DEFAULT '',                          -- wallet imports: "Wallet import <short address>", which re-imports and "Rebuild from history" match
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_idx ON transactions (user_id, occurred_at);

-- Rate limit for read-only wallet import (US-6.4): the wallet-lookup Edge Function counts
-- lookups per signed-in user and per hashed caller IP each hour. Server-only; rows expire
-- after an hour. Wallet addresses are never stored.
CREATE TABLE wallet_lookup_quota (
  bucket       text PRIMARY KEY CHECK (bucket ~ '^(user:[0-9a-f-]{36}|ip:[0-9a-f]{64})$'),
  window_start timestamptz NOT NULL DEFAULT now(),
  used         integer NOT NULL DEFAULT 0 CHECK (used >= 0)  -- lookups in the current hour
);

-- =====================================================================
-- 6. Following (07-fundraising.md, 10-fund-profile.md, US-5.4)
-- =====================================================================

CREATE TABLE fund_follows (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fund_id     text NOT NULL REFERENCES funds (id) ON DELETE CASCADE,
  frequency   text NOT NULL CHECK (frequency IN ('instant', 'daily', 'weekly')),
  followed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fund_id)
);

CREATE TABLE project_follows (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project     text NOT NULL,
  followed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project)
);

-- Saved Fundraising filters: at most 10, names up to 30 characters.
CREATE TABLE saved_filters (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
  sectors    text[] NOT NULL DEFAULT '{}',
  types      text[] NOT NULL DEFAULT '{}',
  min_amount numeric(24, 2) NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
  max_amount numeric(24, 2) CHECK (max_amount > 0),
  days       smallint NOT NULL DEFAULT 90 CHECK (days IN (0, 7, 30, 90)),
  investor   text NOT NULL DEFAULT '',
  sort       text NOT NULL DEFAULT 'newest' CHECK (sort IN ('newest', 'amount')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_filters_user_idx ON saved_filters (user_id);

CREATE OR REPLACE FUNCTION limit_saved_filters() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM saved_filters WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'You can save up to 10 filters. Delete one to save another.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER saved_filters_limit BEFORE INSERT ON saved_filters FOR EACH ROW EXECUTE FUNCTION limit_saved_filters();

-- =====================================================================
-- 7. Alerts, reminders, notifications (12-alerts.md, US-7.x)
-- =====================================================================

-- Price alerts. Values in USD; % alerts store a percentage. Recurring alerts wait 1 h.
CREATE TABLE price_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  coin_id      text NOT NULL REFERENCES coins (id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('above', 'below', 'pct1h', 'pct24h')),
  value        numeric(30, 12) NOT NULL CHECK (value > 0),
  repeat       text NOT NULL DEFAULT 'once' CHECK (repeat IN ('once', 'recurring')),
  bypass_quiet boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_alerts_active_idx ON price_alerts (coin_id) WHERE active;
CREATE INDEX price_alerts_user_idx ON price_alerts (user_id);

-- Unlock and token sale reminders ("Remind me"), fired 1 h and/or 24 h before.
CREATE TABLE reminders (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id  text NOT NULL,                                   -- unlock_events.id or token_sales.id
  kind       text NOT NULL CHECK (kind IN ('unlock', 'sale')),
  symbol     text NOT NULL,
  name       text NOT NULL,
  label      text NOT NULL,
  event_at   timestamptz NOT NULL,
  timings    text[] NOT NULL CHECK (cardinality(timings) > 0 AND timings <@ ARRAY['1h', '24h']),
  fired      text[] NOT NULL DEFAULT '{}' CHECK (fired <@ ARRAY['1h', '24h']),
  paused     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);
CREATE INDEX reminders_due_idx ON reminders (event_at) WHERE NOT paused;

-- In-app notification inbox; capped at 200 per user (MAX_NOTIFICATIONS).
CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('price', 'unlock', 'sale', 'fund', 'digest')),
  coin_id      text REFERENCES coins (id) ON DELETE SET NULL,
  title        text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  path         text NOT NULL DEFAULT '/alerts' CHECK (path LIKE '/%' AND path NOT LIKE '//%'),
  bypass_quiet boolean NOT NULL DEFAULT false,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE NOT read;

-- Trim per-user lists to their caps after each insert.
CREATE OR REPLACE FUNCTION trim_user_list() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cap integer := TG_ARGV[0]::integer;
  order_col text := TG_ARGV[1];
BEGIN
  EXECUTE format(
    'DELETE FROM %I.%I WHERE ctid IN (
       SELECT ctid FROM %I.%I WHERE user_id = $1 ORDER BY %I DESC OFFSET $2)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME, order_col)
  USING NEW.user_id, cap;
  RETURN NULL;
END;
$$;
CREATE TRIGGER notifications_cap AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION trim_user_list('200', 'created_at');
CREATE TRIGGER recent_coins_cap AFTER INSERT OR UPDATE ON recent_coins FOR EACH ROW EXECUTE FUNCTION trim_user_list('10', 'viewed_at');
CREATE TRIGGER recent_searches_cap AFTER INSERT OR UPDATE ON recent_searches FOR EACH ROW EXECUTE FUNCTION trim_user_list('10', 'searched_at');

-- =====================================================================
-- 8. Billing (16-account-settings.md, 21-promotions.md). Simulated: test cards only.
-- =====================================================================

-- One subscription row per user. A cancelled plan drops to Free once cancels_on passes.
CREATE TABLE subscriptions (
  user_id          uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  plan_id          text NOT NULL DEFAULT 'free' REFERENCES plans (id),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  billing_day      smallint CHECK (billing_day BETWEEN 1 AND 28),
  next_billing_at  timestamptz,
  paused_until     timestamptz,
  cancels_on       timestamptz,
  promo_code       text REFERENCES promotions (code),
  promo_applied_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'paused' OR paused_until IS NOT NULL),
  CHECK ((promo_code IS NULL) = (promo_applied_at IS NULL))
);
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Each promo once per account.
CREATE TABLE promo_redemptions (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code        text NOT NULL REFERENCES promotions (code),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  points_used integer NOT NULL DEFAULT 0 CHECK (points_used >= 0),
  PRIMARY KEY (user_id, code)
);

CREATE TABLE billing_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  charged_at  timestamptz NOT NULL DEFAULT now(),
  amount_usd  numeric(8, 2) NOT NULL CHECK (amount_usd >= 0),
  description text NOT NULL,                                  -- "Pro monthly · FIRSTPRO"
  status      text NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Refunded', 'Failed'))
);
CREATE INDEX billing_history_user_idx ON billing_history (user_id, charged_at DESC);

-- Never the full card number or CVC.
CREATE TABLE payment_methods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('card', 'paypal')),
  brand      text CHECK (brand IN ('Visa', 'Mastercard', 'American Express', 'Discover')),
  last4      char(4) CHECK (last4 ~ '^[0-9]{4}$'),
  exp        char(5) CHECK (exp ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),  -- MM/YY
  paypal_email citext,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (type <> 'card' OR (brand IS NOT NULL AND last4 IS NOT NULL AND exp IS NOT NULL))
);
CREATE UNIQUE INDEX payment_methods_one_default ON payment_methods (user_id) WHERE is_default;

-- =====================================================================
-- 9. Support, feedback, affiliate (17–24 specs)
-- =====================================================================

-- Ticket ids: CPA-1042… for support tickets, BUG-0217… for issue reports.
CREATE SEQUENCE support_ticket_seq START 1042;
CREATE SEQUENCE issue_report_seq START 217;

CREATE OR REPLACE FUNCTION next_ticket_id(kind text) RETURNS text
LANGUAGE sql AS $$
  SELECT CASE kind
    WHEN 'issue' THEN 'BUG-' || lpad(nextval('cpa.issue_report_seq')::text, 4, '0')
    ELSE 'CPA-' || nextval('cpa.support_ticket_seq')::text
  END;
$$;

-- Support tickets (17-customer-support.md) and issue reports (19-report-issue.md).
-- Guests can file them too, so user_id is optional.
-- Guests can send these, so every free-text field has a limit that matches its form, and the
-- id must be one next_ticket_id() has already issued (check_ticket_id trigger below).
CREATE TABLE support_tickets (
  id            text PRIMARY KEY CHECK (id ~ '^(CPA-[0-9]+|BUG-[0-9]{4,})$'),
  user_id       uuid REFERENCES users (id) ON DELETE SET NULL,
  kind          text NOT NULL CHECK (kind IN ('ticket', 'issue')),
  topic         text NOT NULL,
  subject       text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 140),
  message       text CHECK (char_length(message) <= 2000),
  email         citext CHECK (char_length(email::text) <= 254),
  status        text NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'In progress', 'Resolved', 'Completed')),
  -- Issue reports only
  page          text CHECK (char_length(page) <= 200),
  steps         text CHECK (char_length(steps) <= 2000),
  expected      text CHECK (char_length(expected) <= 1000),
  actual        text CHECK (char_length(actual) <= 1000),
  assistive_tech text CHECK (char_length(assistive_tech) <= 200),   -- accessibility reports
  severity      text CHECK (severity IN ('blocking', 'annoying', 'minor')),
  technical     text CHECK (char_length(technical) <= 1000),        -- app version, browser, last error
  -- A PNG or JPEG data URL under 2 MB.
  screenshot_url text CHECK (screenshot_url ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$' AND char_length(screenshot_url) <= 2796300),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'ticket' AND topic IN ('account', 'billing', 'data', 'alerts', 'accessibility', 'data-removal', 'other'))
    OR (kind = 'issue' AND topic IN ('bug', 'data', 'accessibility', 'other') AND severity IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION check_ticket_id() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  issued bigint;
BEGIN
  IF NEW.id LIKE 'BUG-%' THEN
    SELECT last_value INTO issued FROM issue_report_seq;
  ELSE
    SELECT last_value INTO issued FROM support_ticket_seq;
  END IF;
  IF substring(NEW.id FROM 5)::bigint > issued THEN
    RAISE EXCEPTION 'Unknown ticket ID.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER support_tickets_issued_id BEFORE INSERT ON support_tickets FOR EACH ROW EXECUTE FUNCTION check_ticket_id();
CREATE INDEX support_tickets_user_idx ON support_tickets (user_id, created_at DESC);

-- Completed data-removal requests (US-P17.2): id, topic, date and status only, no personal data.
CREATE TABLE support_log (
  ticket_id    text PRIMARY KEY,
  topic        text NOT NULL DEFAULT 'data-removal',
  completed_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'Completed'
);

-- Feedback (20-feedback.md): 1–5 ease rating, area, text.
CREATE TABLE feedback (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  area        text NOT NULL CHECK (area IN ('Market', 'Coin detail', 'Unlocks', 'Fundraising', 'Portfolio', 'Alerts', 'Other')),
  body        text NOT NULL DEFAULT '' CHECK (length(body) <= 1000),
  may_contact boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Affiliate program (22-affiliate.md). Payouts are simulated.
CREATE TABLE affiliates (
  user_id        uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE,
  payout_method  text NOT NULL CHECK (payout_method IN ('paypal', 'bank')),
  joined_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_defaults AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_user_defaults();

-- =====================================================================
-- 10. Views
-- =====================================================================

-- Today's sentiment per coin (Coin detail "Community sentiment").
CREATE VIEW coin_sentiment AS
SELECT coin_id,
       count(*) AS votes,
       round(100.0 * count(*) FILTER (WHERE vote = 'bullish') / count(*)) AS bullish_pct
FROM sentiment_votes
WHERE vote_day = current_date
GROUP BY coin_id;

-- Holdings per user and coin: net amount and average buy cost (11-portfolio.md).
CREATE VIEW portfolio_holdings AS
SELECT t.user_id,
       t.coin_id,
       sum(CASE WHEN t.type IN ('buy', 'transfer-in') THEN t.amount ELSE -t.amount END) AS amount,
       sum(t.amount * t.price_usd + t.fee_usd) FILTER (WHERE t.type = 'buy')
         / NULLIF(sum(t.amount) FILTER (WHERE t.type = 'buy'), 0) AS avg_buy_price_usd,
       sum(CASE WHEN t.type IN ('buy', 'transfer-in') THEN t.amount ELSE -t.amount END) * c.price_usd AS value_usd
FROM transactions t
JOIN coins c ON c.id = t.coin_id
GROUP BY t.user_id, t.coin_id, c.price_usd;

-- Loyalty points (data/promotions.js pointsFor): 200 base, +100 with a watchlist,
-- +50 per alert (up to 5), +25 per visit (up to 10), minus points spent.
CREATE VIEW user_points AS
SELECT u.id AS user_id,
       greatest(0,
         200
         + CASE WHEN EXISTS (SELECT 1 FROM watchlist_items w WHERE w.user_id = u.id) THEN 100 ELSE 0 END
         + least((SELECT count(*) FROM price_alerts a WHERE a.user_id = u.id), 5) * 50
         + least(s.visits, 10) * 25
         - s.points_spent) AS points
FROM users u
JOIN user_state s ON s.user_id = u.id
WHERE u.status = 'active';

-- =====================================================================
-- 11. Seed data that the app treats as fixed
-- =====================================================================

INSERT INTO categories (name, sort_order) VALUES
  ('Layer 1', 1), ('Layer 2', 2), ('DeFi', 3), ('AI', 4), ('Stablecoin', 5),
  ('Meme', 6), ('Exchange', 7), ('Infrastructure', 8), ('Gaming', 9), ('RWA', 10);

INSERT INTO plans (id, label, price_usd, period) VALUES
  ('free', 'Free', 0, NULL),
  ('pro-monthly', 'Pro monthly', 9.99, 'month'),
  ('pro-yearly', 'Pro yearly', 95.88, 'year');

INSERT INTO promotions (code, title, plan_id, percent_off, fixed_price_usd, detail, new_accounts_only, points_cost, ends_at, terms) VALUES
  ('AUTUMN20', '20% off CPA Pro yearly', 'pro-yearly', 20, NULL, '$95.88 → $76.70 for the first year', false, NULL, '2026-10-31 23:59:59',
   'For CPA Pro yearly. One use per account. The discount applies to the first year only and can''t be combined with other codes.'),
  ('FIRSTPRO', 'First month of Pro for $1.00', 'pro-monthly', NULL, 1.00, 'New accounts only', true, NULL, '2026-12-31 23:59:59',
   'For accounts created in the last 30 days. Applies to the first month of CPA Pro monthly, then $9.99 a month. One use per account.'),
  ('SUMMER15', 'Summer 15% off', 'pro-monthly', 15, NULL, NULL, false, NULL, '2026-08-31 23:59:59', 'Ended.'),
  ('POINTS10', '10% off with 500 points', NULL, 10, NULL, NULL, false, 500, NULL, NULL);

INSERT INTO exchanges (id, name, type, volume_24h_usd) VALUES
  ('binance', 'Binance', 'Centralized', 14.2e9),
  ('coinbase', 'Coinbase', 'Centralized', 3.1e9),
  ('okx', 'OKX', 'Centralized', 2.8e9),
  ('bybit', 'Bybit', 'Centralized', 2.4e9),
  ('kraken', 'Kraken', 'Centralized', 1.1e9),
  ('uniswap-v3', 'Uniswap v3', 'Decentralized', 1.6e9),
  ('kucoin', 'KuCoin', 'Centralized', 840e6),
  ('gate', 'Gate', 'Centralized', 760e6),
  ('orbx', 'OrbX Exchange', 'Centralized', 210.4e6);

INSERT INTO glossary_terms (key, definition) VALUES
  ('marketCap', 'Price × circulating supply. The value of all tokens that can trade today.'),
  ('fdv', 'Fully diluted valuation: price × maximum supply. Shows the value if every token were circulating.'),
  ('volume', 'The value of this coin traded across all tracked markets in the last 24 hours.'),
  ('circulating', 'Tokens that are unlocked and trading today.'),
  ('unlocked', 'Tokens already released from vesting that are not yet circulating, for example held in treasury.'),
  ('locked', 'Tokens still vesting. They are released on a schedule and can add selling pressure when they unlock.'),
  ('supply', 'How the maximum supply splits between circulating, unlocked but not circulating, and still locked.'),
  ('ath', 'All-time high and low: the highest and lowest prices in this coin''s sample history.'),
  ('roi', 'Return on investment: current price divided by the round''s token price.');

COMMIT;
