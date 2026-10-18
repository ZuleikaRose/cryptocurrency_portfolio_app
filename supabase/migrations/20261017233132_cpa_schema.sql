-- CPA (Cryptocurrency Portfolio App): Supabase schema.
--
-- The Supabase version of ../../schema.sql. Differences from the portable file:
--   * Accounts use Supabase Auth. cpa.users is a profile row keyed to auth.users, so
--     passwords, sessions, reset links and login rate limits are handled by Auth and the
--     users/sessions/login_attempts/password_reset_* password columns and tables are gone.
--   * Row-level security on every table: users reach only their own rows, reference data
--     is read-only for everyone, billing is read-only to its owner, support_log is server-only.
--   * Every foreign key has a covering index, plus trigram indexes for name search.
--   * Functions pin search_path; views run as the caller (security_invoker).
--
-- Tables live in the private `cpa` schema. To use them from supabase-js, add `cpa` to the
-- exposed schemas in Dashboard → Project Settings → Data API; the grants and policies below
-- are already in place for that.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists cpa;
set search_path = cpa, public, extensions;

-- Keeps updated_at current on every UPDATE.
create or replace function cpa.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- 1. Reference data (today: app/src/data/*.js)
-- =====================================================================

-- Market categories (data/coins.js `categories`); also fund and round sectors.
create table cpa.categories (
  name       text primary key,
  sort_order smallint not null default 0
);

-- Coins and their latest market figures (01-market.md, 03-coin-detail.md).
create table cpa.coins (
  id               text primary key,                          -- slug, e.g. "bitcoin"
  rank             integer not null unique check (rank > 0),
  name             text not null,
  symbol           text not null check (symbol = upper(symbol)),
  category         text not null references cpa.categories (name),
  logo_tint        text,
  price_usd        numeric(30, 12) not null check (price_usd >= 0),
  change_1h        numeric(10, 4) not null default 0,         -- percent
  change_24h       numeric(10, 4) not null default 0,
  change_7d        numeric(10, 4) not null default 0,
  market_cap_usd   numeric(24, 2) not null check (market_cap_usd >= 0),
  fdv_usd          numeric(24, 2) check (fdv_usd >= 0),
  volume_24h_usd   numeric(24, 2) check (volume_24h_usd >= 0),
  sparkline_7d     numeric[] not null default '{}',           -- 24 points
  listed_on        date,
  contract_address text check (contract_address ~ '^0x[0-9a-f]{40}$'),  -- null for native coins
  contract_verified boolean not null default false,           -- trust signal (journey rule 4)
  about            text,
  total_supply       numeric(30, 6),
  circulating_supply numeric(30, 6),
  max_supply         numeric(30, 6),
  updated_at       timestamptz not null default now()         -- "Last updated" / stale over 5 min
);
create trigger coins_touch before update on cpa.coins for each row execute function cpa.touch_updated_at();

-- Price history for charts: ranges 1D · 7D · 1M · 3M · 1Y · ALL (03-coin-detail.md).
create table cpa.coin_prices (
  coin_id    text not null references cpa.coins (id) on delete cascade,
  at         timestamptz not null,
  price_usd  numeric(30, 12) not null check (price_usd >= 0),
  volume_usd numeric(24, 2),
  primary key (coin_id, at)
);

-- Exchanges (data/directory.js) and a coin's markets tab.
create table cpa.exchanges (
  id             text primary key,
  name           text not null,
  type           text not null check (type in ('Centralized', 'Decentralized')),
  volume_24h_usd numeric(24, 2)
);

create table cpa.coin_markets (
  coin_id      text not null references cpa.coins (id) on delete cascade,
  exchange_id  text not null references cpa.exchanges (id) on delete cascade,
  pair         text not null,                                 -- "BTC/USDT"
  price_usd    numeric(30, 12),
  volume_share numeric(6, 5) check (volume_share between 0 and 1),
  primary key (coin_id, exchange_id, pair)
);

-- Tokenomics: vesting schedule per coin and its allocations (03-coin-detail.md Tokenomics).
create table cpa.vesting_schedules (
  coin_id      text primary key references cpa.coins (id) on delete cascade,
  total_supply numeric(30, 6) not null check (total_supply > 0),
  tge_date     date not null
);

create table cpa.vesting_allocations (
  coin_id      text not null references cpa.vesting_schedules (coin_id) on delete cascade,
  name         text not null check (name in ('Team', 'Investors', 'Ecosystem', 'Community', 'Foundation')),
  share        numeric(6, 5) not null check (share > 0 and share <= 1),
  tge_share    numeric(6, 5) not null default 0 check (tge_share between 0 and 1),
  cliff_months smallint not null default 0 check (cliff_months >= 0),
  vest_months  smallint not null check (vest_months > 0),
  unlock_day   smallint not null check (unlock_day between 1 and 31),
  primary key (coin_id, name)
);

-- Unlock events (08-unlocks.md). Same-day tranches are grouped into one event.
create table cpa.unlock_events (
  id          text primary key,                               -- "<coin>-<yyyy-mm-dd>"
  coin_id     text not null references cpa.coins (id) on delete cascade,
  unlock_at   timestamptz not null,
  amount      numeric(30, 6) not null check (amount > 0),
  allocations text[] not null default '{}'
);

-- Funds (10-fund-profile.md). Tier 1 is the most established.
create table cpa.funds (
  id           text primary key,
  name         text not null,
  tier         smallint not null check (tier between 1 and 5),
  type         text not null check (type in ('Venture fund', 'Accelerator', 'Hedge fund', 'Family office', 'DAO', 'Corporate VC', 'Angel syndicate', 'Launchpad')),
  founded      smallint,
  deals        integer not null default 0,
  deals_30d    integer not null default 0,
  deployed_usd numeric(24, 2)
);

-- "Top sectors" bar on a fund profile: share of deals per sector, in percent.
create table cpa.fund_sectors (
  fund_id text not null references cpa.funds (id) on delete cascade,
  sector  text not null references cpa.categories (name),
  share   smallint not null check (share between 0 and 100),
  primary key (fund_id, sector)
);

-- Funding rounds (07-fundraising.md). coin_id is null for projects without a token yet.
create table cpa.funding_rounds (
  id              text primary key,
  coin_id         text references cpa.coins (id) on delete set null,
  project         text not null,
  sector          text not null references cpa.categories (name),
  round_type      text not null check (round_type in ('Pre-seed', 'Seed', 'Series A', 'Series B', 'Strategic')),
  announced_on    date not null,
  amount_usd      numeric(24, 2) not null check (amount_usd > 0),
  valuation_usd   numeric(24, 2),
  token_price_usd numeric(30, 12)                             -- entry vs round price (Portfolio)
);

create table cpa.round_investors (
  round_id text not null references cpa.funding_rounds (id) on delete cascade,
  fund_id  text not null references cpa.funds (id) on delete cascade,
  is_lead  boolean not null default false,
  primary key (round_id, fund_id)
);

-- Token sales: IDO / IEO / ICO (09-token-sales.md).
create table cpa.token_sales (
  id                text primary key,
  coin_id           text references cpa.coins (id) on delete set null,
  name              text not null,
  symbol            text not null,
  sale_type         text not null check (sale_type in ('IDO', 'IEO', 'ICO')),
  launchpad         text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  raise_usd         numeric(24, 2) not null,
  price_usd         numeric(30, 12) not null,
  fdv_usd           numeric(24, 2),
  sold_share        numeric(6, 5) check (sold_share between 0 and 1),
  current_price_usd numeric(30, 12),                          -- when no linked coin
  ath_roi           numeric(12, 4),
  check (ends_at > starts_at)
);

-- Plans (16-account-settings.md, 18-faqs.md plan table).
create table cpa.plans (
  id        text primary key,
  label     text not null,
  price_usd numeric(8, 2) not null check (price_usd >= 0),
  period    text check (period in ('month', 'year'))
);

-- Promotions (21-promotions.md) and the points redemption (POINTS10).
create table cpa.promotions (
  code              text primary key check (code = upper(code)),
  title             text not null,
  plan_id           text references cpa.plans (id),           -- null: any Pro plan
  percent_off       numeric(5, 2) check (percent_off > 0 and percent_off <= 100),
  fixed_price_usd   numeric(8, 2),
  detail            text,
  new_accounts_only boolean not null default false,           -- created in the last 30 days
  points_cost       integer check (points_cost > 0),          -- set for points redemptions
  ends_at           timestamptz,
  terms             text,
  check ((percent_off is null) <> (fixed_price_usd is null))
);

-- Help content: FAQs (18-faqs.md), Learn cards, glossary ⓘ definitions.
create table cpa.faq_sections (
  id         text primary key,
  title      text not null,
  sort_order smallint not null default 0
);

create table cpa.faq_items (
  id         bigint generated always as identity primary key,
  section_id text not null references cpa.faq_sections (id) on delete cascade,
  question   text not null,
  answer     text not null,
  sort_order smallint not null default 0
);

create table cpa.learn_articles (
  id      bigint generated always as identity primary key,
  title   text not null,
  summary text not null,
  path    text not null check (path like '/%')
);

create table cpa.glossary_terms (
  key        text primary key,                                -- "marketCap", "fdv", …
  definition text not null
);

-- =====================================================================
-- 2. Accounts: Supabase Auth owns sign-in; cpa.users is the profile (13–16 specs)
-- =====================================================================

create table cpa.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  status     text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'deleted') = (deleted_at is not null))
);
create trigger users_touch before update on cpa.users for each row execute function cpa.touch_updated_at();

-- =====================================================================
-- 3. Settings (state/context.js defaultSettings; 16-account-settings.md,
--    27-accessibility-menu.md). One row per user; defaults match the app.
-- =====================================================================

create table cpa.user_settings (
  user_id uuid primary key references cpa.users (id) on delete cascade,

  -- Display
  currency        text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  theme           text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  colors          text not null default 'standard' check (colors in ('standard', 'swapped', 'cb-safe')),
  auto_refresh    boolean not null default true,
  stop_animations boolean not null default false,             -- data-motion="off"
  hide_balances   boolean not null default false,
  watchlist_sort  text not null default 'mine',
  chart_range     text not null default '1M' check (chart_range in ('1D', '7D', '1M', '3M', '1Y', 'ALL')),
  chart_summaries boolean not null default false,
  auto_advance    boolean not null default false,
  analytics       boolean not null default false,

  -- Notifications (12-alerts.md, US-7.3)
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start   time not null default '22:00',
  quiet_hours_end     time not null default '07:00',
  weekly_digest       boolean not null default true,
  reminder_timings    text[] not null default '{1h}' check (reminder_timings <@ array['1h', '24h']),
  notifications_asked boolean not null default false,         -- journey rule 1

  -- AI features (25-ai-integration.md)
  ai_explain_metric boolean not null default true,
  ai_similar_coins  boolean not null default true,
  ai_digest_summary boolean not null default false,

  -- Accessibility menu (27-accessibility-menu.md)
  a11y_profiles           text[] not null default '{}',
  a11y_text_size          smallint not null default 100 check (a11y_text_size between 80 and 200),
  a11y_font               text not null default 'default' check (a11y_font in ('default', 'readable', 'dyslexic')),
  a11y_line_height        numeric(3, 2) not null default 0 check (a11y_line_height = 0 or a11y_line_height between 1 and 2),
  a11y_letter_spacing     numeric(3, 2) not null default 0 check (a11y_letter_spacing between 0 and 0.2),
  a11y_align              text not null default 'default' check (a11y_align in ('default', 'left', 'center')),
  a11y_contrast           text not null default 'default' check (a11y_contrast in ('default', 'high', 'dark', 'light')),
  a11y_saturation         text not null default 'default' check (a11y_saturation in ('default', 'low', 'high', 'mono')),
  a11y_highlight_links    boolean not null default false,
  a11y_highlight_headings boolean not null default false,
  a11y_strong_focus       boolean not null default false,
  a11y_big_cursor         boolean not null default false,
  a11y_reading_guide      boolean not null default false,
  a11y_hide_images        boolean not null default false,
  a11y_summary_size       text not null default 'M' check (a11y_summary_size in ('S', 'M', 'L', 'XL')),

  -- Market tab (journey rule 2: remember filters and sorts per tab; rule 5: Simple vs Pro)
  market_view           text not null default 'coins',
  market_sort           text not null default 'rank',
  market_dir            text not null default 'asc' check (market_dir in ('asc', 'desc')),
  market_category       text not null default 'All',
  market_density        text not null default 'simple' check (market_density in ('simple', 'pro')),
  market_gainers_window text not null default '24h' check (market_gainers_window in ('1h', '24h', '7d')),

  -- Unlocks tab (08-unlocks.md)
  unlocks_range          text not null default 'week' check (unlocks_range in ('today', 'week', 'month', 'custom')),
  unlocks_watchlist_only boolean not null default false,
  unlocks_min_one        boolean not null default false,      -- only unlocks ≥ 1% of supply
  unlocks_sort           text not null default 'share' check (unlocks_sort in ('share', 'usd', 'date')),
  unlocks_view           text not null default 'list' check (unlocks_view in ('list', 'calendar')),

  -- Fundraising tab (07-fundraising.md)
  fundraising_sectors    text[] not null default '{}',
  fundraising_types      text[] not null default '{}',
  fundraising_min_amount numeric(24, 2) not null default 0 check (fundraising_min_amount >= 0),
  fundraising_max_amount numeric(24, 2) check (fundraising_max_amount > 0),
  fundraising_days       smallint not null default 90 check (fundraising_days in (0, 7, 30, 90)),  -- 0: all time
  fundraising_investor   text not null default '',
  fundraising_sort       text not null default 'newest' check (fundraising_sort in ('newest', 'amount')),

  updated_at timestamptz not null default now()
);
create trigger user_settings_touch before update on cpa.user_settings for each row execute function cpa.touch_updated_at();

-- Counters and flags that aren't settings.
create table cpa.user_state (
  user_id                      uuid primary key references cpa.users (id) on delete cascade,
  onboarded                    boolean not null default false,  -- 02-onboarding.md
  visits                       integer not null default 0 check (visits >= 0),
  feedback_prompt_dismissed_at timestamptz,
  last_digest_at               timestamptz,
  points_spent                 integer not null default 0 check (points_spent >= 0)
);

-- Onboarding interest picker (02-onboarding.md).
create table cpa.user_interest_coins (
  user_id uuid not null references cpa.users (id) on delete cascade,
  coin_id text not null references cpa.coins (id) on delete cascade,
  primary key (user_id, coin_id)
);

create table cpa.user_interest_sectors (
  user_id uuid not null references cpa.users (id) on delete cascade,
  sector  text not null references cpa.categories (name),
  primary key (user_id, sector)
);

-- =====================================================================
-- 4. Watchlist, recents, votes (04-search.md, 05-watchlist.md, 03-coin-detail.md)
-- =====================================================================

create table cpa.watchlist_items (
  user_id  uuid not null references cpa.users (id) on delete cascade,
  coin_id  text not null references cpa.coins (id) on delete cascade,
  position integer not null,                                  -- "My order" sort
  added_at timestamptz not null default now(),
  primary key (user_id, coin_id)
);

-- Last 10 coins viewed and last 10 searches (US-P04.2); trimmed by trigger below.
create table cpa.recent_coins (
  user_id   uuid not null references cpa.users (id) on delete cascade,
  coin_id   text not null references cpa.coins (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, coin_id)
);

create table cpa.recent_searches (
  user_id     uuid not null references cpa.users (id) on delete cascade,
  query       text not null check (length(btrim(query)) > 0),
  searched_at timestamptz not null default now(),
  primary key (user_id, query)
);

-- One sentiment vote per coin per day (US-P03.2).
create table cpa.sentiment_votes (
  user_id  uuid not null references cpa.users (id) on delete cascade,
  coin_id  text not null references cpa.coins (id) on delete cascade,
  vote_day date not null default current_date,
  vote     text not null check (vote in ('bullish', 'bearish')),
  primary key (user_id, coin_id, vote_day)
);

-- =====================================================================
-- 5. Portfolio (11-portfolio.md, US-6.x)
-- =====================================================================

create table cpa.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references cpa.users (id) on delete cascade,
  coin_id     text not null references cpa.coins (id),
  type        text not null check (type in ('buy', 'sell', 'transfer-in', 'transfer-out')),
  amount      numeric(30, 12) not null check (amount > 0),
  price_usd   numeric(30, 12) not null check (price_usd >= 0),
  fee_usd     numeric(18, 2) not null default 0 check (fee_usd >= 0),
  occurred_at timestamptz not null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 6. Following (07-fundraising.md, 10-fund-profile.md, US-5.4)
-- =====================================================================

create table cpa.fund_follows (
  user_id     uuid not null references cpa.users (id) on delete cascade,
  fund_id     text not null references cpa.funds (id) on delete cascade,
  frequency   text not null check (frequency in ('instant', 'daily', 'weekly')),
  followed_at timestamptz not null default now(),
  primary key (user_id, fund_id)
);

create table cpa.project_follows (
  user_id     uuid not null references cpa.users (id) on delete cascade,
  project     text not null,
  followed_at timestamptz not null default now(),
  primary key (user_id, project)
);

-- Saved Fundraising filters: at most 10, names up to 30 characters.
create table cpa.saved_filters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references cpa.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 30),
  sectors    text[] not null default '{}',
  types      text[] not null default '{}',
  min_amount numeric(24, 2) not null default 0 check (min_amount >= 0),
  max_amount numeric(24, 2) check (max_amount > 0),
  days       smallint not null default 90 check (days in (0, 7, 30, 90)),
  investor   text not null default '',
  sort       text not null default 'newest' check (sort in ('newest', 'amount')),
  created_at timestamptz not null default now()
);

create or replace function cpa.limit_saved_filters() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from cpa.saved_filters where user_id = new.user_id) >= 10 then
    raise exception 'You can save up to 10 filters. Delete one to save another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger saved_filters_limit before insert on cpa.saved_filters for each row execute function cpa.limit_saved_filters();

-- =====================================================================
-- 7. Alerts, reminders, notifications (12-alerts.md, US-7.x)
-- =====================================================================

-- Price alerts. Values in USD; % alerts store a percentage. Recurring alerts wait 1 h.
create table cpa.price_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references cpa.users (id) on delete cascade,
  coin_id       text not null references cpa.coins (id) on delete cascade,
  type          text not null check (type in ('above', 'below', 'pct1h', 'pct24h')),
  value         numeric(30, 12) not null check (value > 0),
  repeat        text not null default 'once' check (repeat in ('once', 'recurring')),
  bypass_quiet  boolean not null default false,
  active        boolean not null default true,
  last_fired_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Unlock and token sale reminders ("Remind me"), fired 1 h and/or 24 h before.
create table cpa.reminders (
  user_id    uuid not null references cpa.users (id) on delete cascade,
  target_id  text not null,                                   -- unlock_events.id or token_sales.id
  kind       text not null check (kind in ('unlock', 'sale')),
  symbol     text not null,
  name       text not null,
  label      text not null,
  event_at   timestamptz not null,
  timings    text[] not null check (cardinality(timings) > 0 and timings <@ array['1h', '24h']),
  fired      text[] not null default '{}' check (fired <@ array['1h', '24h']),
  paused     boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

-- In-app notification inbox; capped at 200 per user (MAX_NOTIFICATIONS).
create table cpa.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references cpa.users (id) on delete cascade,
  kind         text not null check (kind in ('price', 'unlock', 'sale', 'fund', 'digest')),
  coin_id      text references cpa.coins (id) on delete set null,
  title        text not null,
  detail       text not null default '',
  path         text not null default '/alerts' check (path like '/%' and path not like '//%'),
  bypass_quiet boolean not null default false,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Trim per-user lists to their caps after each insert.
create or replace function cpa.trim_user_list() returns trigger
language plpgsql set search_path = '' as $$
declare
  cap integer := tg_argv[0]::integer;
  order_col text := tg_argv[1];
begin
  execute format(
    'delete from %I.%I where ctid in (
       select ctid from %I.%I where user_id = $1 order by %I desc offset $2)',
    tg_table_schema, tg_table_name, tg_table_schema, tg_table_name, order_col)
  using new.user_id, cap;
  return null;
end;
$$;
create trigger notifications_cap after insert on cpa.notifications for each row execute function cpa.trim_user_list('200', 'created_at');
create trigger recent_coins_cap after insert or update on cpa.recent_coins for each row execute function cpa.trim_user_list('10', 'viewed_at');
create trigger recent_searches_cap after insert or update on cpa.recent_searches for each row execute function cpa.trim_user_list('10', 'searched_at');

-- =====================================================================
-- 8. Billing (16-account-settings.md, 21-promotions.md). Simulated: test cards only.
-- =====================================================================

-- One subscription row per user. A cancelled plan drops to Free once cancels_on passes.
create table cpa.subscriptions (
  user_id          uuid primary key references cpa.users (id) on delete cascade,
  plan_id          text not null default 'free' references cpa.plans (id),
  status           text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  billing_day      smallint check (billing_day between 1 and 28),
  next_billing_at  timestamptz,
  paused_until     timestamptz,
  cancels_on       timestamptz,
  promo_code       text references cpa.promotions (code),
  promo_applied_at timestamptz,
  updated_at       timestamptz not null default now(),
  check (status <> 'paused' or paused_until is not null),
  check ((promo_code is null) = (promo_applied_at is null))
);
create trigger subscriptions_touch before update on cpa.subscriptions for each row execute function cpa.touch_updated_at();

-- Each promo once per account.
create table cpa.promo_redemptions (
  user_id     uuid not null references cpa.users (id) on delete cascade,
  code        text not null references cpa.promotions (code),
  redeemed_at timestamptz not null default now(),
  points_used integer not null default 0 check (points_used >= 0),
  primary key (user_id, code)
);

create table cpa.billing_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references cpa.users (id) on delete cascade,
  charged_at  timestamptz not null default now(),
  amount_usd  numeric(8, 2) not null check (amount_usd >= 0),
  description text not null,                                  -- "Pro monthly · FIRSTPRO"
  status      text not null default 'Paid' check (status in ('Paid', 'Refunded', 'Failed'))
);

-- Never the full card number or CVC.
create table cpa.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references cpa.users (id) on delete cascade,
  type         text not null check (type in ('card', 'paypal')),
  brand        text check (brand in ('Visa', 'Mastercard', 'American Express', 'Discover')),
  last4        char(4) check (last4 ~ '^[0-9]{4}$'),
  exp          char(5) check (exp ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),  -- MM/YY
  paypal_email extensions.citext,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  check (type <> 'card' or (brand is not null and last4 is not null and exp is not null))
);

-- =====================================================================
-- 9. Support, feedback, affiliate (17–24 specs)
-- =====================================================================

-- Ticket ids: CPA-1042… for support tickets, BUG-0217… for issue reports.
create sequence cpa.support_ticket_seq start 1042;
create sequence cpa.issue_report_seq start 217;

create or replace function cpa.next_ticket_id(kind text) returns text
language sql set search_path = '' as $$
  select case kind
    when 'issue' then 'BUG-' || lpad(nextval('cpa.issue_report_seq')::text, 4, '0')
    else 'CPA-' || nextval('cpa.support_ticket_seq')::text
  end;
$$;

-- Support tickets (17-customer-support.md) and issue reports (19-report-issue.md).
-- Guests can file them too, so user_id is optional.
create table cpa.support_tickets (
  id             text primary key,
  user_id        uuid references cpa.users (id) on delete set null,
  kind           text not null check (kind in ('ticket', 'issue')),
  topic          text not null,
  subject        text not null,
  message        text,
  email          extensions.citext,
  status         text not null default 'Received' check (status in ('Received', 'In progress', 'Resolved', 'Completed')),
  page           text,                                        -- issue reports only, from here down
  steps          text,
  expected       text,
  actual         text,
  assistive_tech text,
  severity       text check (severity in ('blocking', 'annoying', 'minor')),
  technical      text,
  screenshot_url text,
  created_at     timestamptz not null default now(),
  check (
    (kind = 'ticket' and topic in ('account', 'billing', 'data', 'alerts', 'accessibility', 'data-removal', 'other'))
    or (kind = 'issue' and topic in ('bug', 'data', 'accessibility', 'other') and severity is not null)
  )
);

-- Completed data-removal requests (US-P17.2): id, topic, date and status only, no personal data.
create table cpa.support_log (
  ticket_id    text primary key,
  topic        text not null default 'data-removal',
  completed_at timestamptz not null default now(),
  status       text not null default 'Completed'
);

-- Feedback (20-feedback.md): 1–5 ease rating, area, text.
create table cpa.feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid references cpa.users (id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  area        text not null check (area in ('Market', 'Coin detail', 'Unlocks', 'Fundraising', 'Portfolio', 'Alerts', 'Other')),
  body        text not null default '' check (length(body) <= 1000),
  may_contact boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Affiliate program (22-affiliate.md). Payouts are simulated.
create table cpa.affiliates (
  user_id       uuid primary key references cpa.users (id) on delete cascade,
  code          text not null unique,
  payout_method text not null check (payout_method in ('paypal', 'bank')),
  joined_at     timestamptz not null default now()
);

-- =====================================================================
-- 10. New accounts: Auth sign-up → profile → default settings, state, Free plan
-- =====================================================================

create or replace function cpa.create_user_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into cpa.user_settings (user_id) values (new.id);
  insert into cpa.user_state (user_id) values (new.id);
  insert into cpa.subscriptions (user_id) values (new.id);
  return new;
end;
$$;
create trigger users_defaults after insert on cpa.users for each row execute function cpa.create_user_defaults();

-- Runs as its owner because signing up happens before the user has a session. It only
-- copies the new auth user's own id and display name; `name` is display text, never used
-- for authorization. Kept in the private cpa schema, not callable through the Data API.
create or replace function cpa.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cpa.users (id, name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'CPA user'));
  return new;
end;
$$;
revoke execute on function cpa.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function cpa.handle_new_auth_user();

-- =====================================================================
-- 11. Indexes
-- =====================================================================

-- Foreign keys not already covered by the leading column of a primary key or index.
-- Postgres doesn't index these automatically; without them joins and ON DELETE cascades
-- scan the whole child table.
create index coins_category_idx              on cpa.coins (category);
create index coin_markets_exchange_idx       on cpa.coin_markets (exchange_id);
create index unlock_events_coin_idx          on cpa.unlock_events (coin_id);
create index fund_sectors_sector_idx         on cpa.fund_sectors (sector);
create index funding_rounds_coin_idx         on cpa.funding_rounds (coin_id);
create index funding_rounds_sector_idx       on cpa.funding_rounds (sector);
create index round_investors_fund_idx        on cpa.round_investors (fund_id);
create index token_sales_coin_idx            on cpa.token_sales (coin_id);
create index promotions_plan_idx             on cpa.promotions (plan_id);
create index faq_items_section_idx           on cpa.faq_items (section_id, sort_order);
create index user_interest_coins_coin_idx    on cpa.user_interest_coins (coin_id);
create index user_interest_sectors_sector_idx on cpa.user_interest_sectors (sector);
create index watchlist_items_coin_idx        on cpa.watchlist_items (coin_id);
create index recent_coins_coin_idx           on cpa.recent_coins (coin_id);
create index sentiment_votes_coin_idx        on cpa.sentiment_votes (coin_id, vote_day);
create index transactions_user_idx           on cpa.transactions (user_id, occurred_at);
create index transactions_coin_idx           on cpa.transactions (coin_id);
create index fund_follows_fund_idx           on cpa.fund_follows (fund_id);
create index saved_filters_user_idx          on cpa.saved_filters (user_id, created_at desc);
create index price_alerts_user_idx           on cpa.price_alerts (user_id);
create index price_alerts_coin_idx           on cpa.price_alerts (coin_id);
create index notifications_user_idx          on cpa.notifications (user_id, created_at desc);
create index notifications_coin_idx          on cpa.notifications (coin_id);
create index subscriptions_plan_idx          on cpa.subscriptions (plan_id);
create index subscriptions_promo_idx         on cpa.subscriptions (promo_code);
create index promo_redemptions_code_idx      on cpa.promo_redemptions (code);
create index billing_history_user_idx        on cpa.billing_history (user_id, charged_at desc);
create index payment_methods_user_idx        on cpa.payment_methods (user_id);
create index support_tickets_user_idx        on cpa.support_tickets (user_id, created_at desc);
create index feedback_user_idx               on cpa.feedback (user_id);

-- Query patterns the app uses.
create index coins_symbol_idx                on cpa.coins (symbol);   -- not unique: copycat tickers exist (US-2.5)
create index coins_market_cap_idx            on cpa.coins (market_cap_usd desc);
create index coin_prices_recent_idx          on cpa.coin_prices (coin_id, at desc);
create index unlock_events_at_idx            on cpa.unlock_events (unlock_at);
create index funding_rounds_date_idx         on cpa.funding_rounds (announced_on desc);
create index token_sales_start_idx           on cpa.token_sales (starts_at);
create index watchlist_items_order_idx       on cpa.watchlist_items (user_id, position);
create index recent_coins_viewed_idx         on cpa.recent_coins (user_id, viewed_at desc);
create unique index recent_searches_ci_idx   on cpa.recent_searches (user_id, lower(query));
create index recent_searches_time_idx        on cpa.recent_searches (user_id, searched_at desc);
create index reminders_due_idx               on cpa.reminders (event_at) where not paused;
create index price_alerts_active_coin_idx    on cpa.price_alerts (coin_id) where active;
create index notifications_unread_idx        on cpa.notifications (user_id) where not read;
create unique index payment_methods_one_default on cpa.payment_methods (user_id) where is_default;

-- Search overlay (04-search.md): fuzzy, partial name matches.
create index coins_name_trgm_idx             on cpa.coins using gin (lower(name) extensions.gin_trgm_ops);
create index funds_name_trgm_idx             on cpa.funds using gin (lower(name) extensions.gin_trgm_ops);
create index funding_rounds_project_trgm_idx on cpa.funding_rounds using gin (lower(project) extensions.gin_trgm_ops);
create index token_sales_name_trgm_idx       on cpa.token_sales using gin (lower(name) extensions.gin_trgm_ops);
create index exchanges_name_trgm_idx         on cpa.exchanges using gin (lower(name) extensions.gin_trgm_ops);

-- =====================================================================
-- 12. Views and functions
-- =====================================================================

-- Today's sentiment per coin (Coin detail "Community sentiment"). A function rather than a
-- view: it returns totals only, so voters stay private while everyone sees the split.
create or replace function cpa.coin_sentiment_today()
returns table (coin_id text, votes bigint, bullish_pct numeric)
language sql stable security definer set search_path = '' as $$
  select v.coin_id,
         count(*),
         round(100.0 * count(*) filter (where v.vote = 'bullish') / count(*))
  from cpa.sentiment_votes v
  where v.vote_day = current_date
  group by v.coin_id;
$$;

-- Holdings per user and coin: net amount and average buy cost (11-portfolio.md).
create view cpa.portfolio_holdings with (security_invoker = true) as
select t.user_id,
       t.coin_id,
       sum(case when t.type in ('buy', 'transfer-in') then t.amount else -t.amount end) as amount,
       sum(t.amount * t.price_usd + t.fee_usd) filter (where t.type = 'buy')
         / nullif(sum(t.amount) filter (where t.type = 'buy'), 0) as avg_buy_price_usd,
       sum(case when t.type in ('buy', 'transfer-in') then t.amount else -t.amount end) * c.price_usd as value_usd
from cpa.transactions t
join cpa.coins c on c.id = t.coin_id
group by t.user_id, t.coin_id, c.price_usd;

-- Loyalty points (data/promotions.js pointsFor): 200 base, +100 with a watchlist,
-- +50 per alert (up to 5), +25 per visit (up to 10), minus points spent.
create view cpa.user_points with (security_invoker = true) as
select u.id as user_id,
       greatest(0,
         200
         + case when exists (select 1 from cpa.watchlist_items w where w.user_id = u.id) then 100 else 0 end
         + least((select count(*) from cpa.price_alerts a where a.user_id = u.id), 5) * 50
         + least(s.visits, 10) * 25
         - s.points_spent) as points
from cpa.users u
join cpa.user_state s on s.user_id = u.id
where u.status = 'active';

-- =====================================================================
-- 13. Access: grants for the Data API roles, then row-level security
-- =====================================================================

grant usage on schema cpa to anon, authenticated, service_role;
grant all on all tables in schema cpa to service_role;
grant all on all sequences in schema cpa to service_role;
grant usage on sequence cpa.support_ticket_seq, cpa.issue_report_seq to anon, authenticated;
grant execute on function cpa.next_ticket_id(text), cpa.coin_sentiment_today() to anon, authenticated;

-- Reference data: anyone can read, only the server writes.
do $$
declare t text;
begin
  foreach t in array array['categories', 'coins', 'coin_prices', 'exchanges', 'coin_markets',
    'vesting_schedules', 'vesting_allocations', 'unlock_events', 'funds', 'fund_sectors',
    'funding_rounds', 'round_investors', 'token_sales', 'plans', 'promotions',
    'faq_sections', 'faq_items', 'learn_articles', 'glossary_terms']
  loop
    execute format('alter table cpa.%I enable row level security', t);
    execute format('grant select on cpa.%I to anon, authenticated', t);
    execute format('create policy "Anyone can read %s" on cpa.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end;
$$;

-- A user's own rows: full read and write, never another user's.
do $$
declare t text;
begin
  foreach t in array array['user_interest_coins', 'user_interest_sectors', 'watchlist_items',
    'recent_coins', 'recent_searches', 'sentiment_votes', 'transactions', 'fund_follows',
    'project_follows', 'saved_filters', 'price_alerts', 'reminders', 'notifications',
    'payment_methods', 'affiliates']
  loop
    execute format('alter table cpa.%I enable row level security', t);
    execute format('grant select, insert, update, delete on cpa.%I to authenticated', t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users add their own %s" on cpa.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users change their own %s" on cpa.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users delete their own %s" on cpa.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

-- Settings and state: one row each, created at sign-up; users read and update their own.
do $$
declare t text;
begin
  foreach t in array array['user_settings', 'user_state']
  loop
    execute format('alter table cpa.%I enable row level security', t);
    execute format('grant select, update on cpa.%I to authenticated', t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users change their own %s" on cpa.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

-- Billing: read-only to its owner; plan changes and charges go through the server.
do $$
declare t text;
begin
  foreach t in array array['subscriptions', 'promo_redemptions', 'billing_history']
  loop
    execute format('alter table cpa.%I enable row level security', t);
    execute format('grant select on cpa.%I to authenticated', t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

-- Profile: read and rename your own. Rows are created by sign-up and removed with the auth user.
alter table cpa.users enable row level security;
grant select, update (name) on cpa.users to authenticated;
create policy "Users read their own profile" on cpa.users for select to authenticated
  using ((select auth.uid()) = id);
create policy "Users change their own profile" on cpa.users for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Support tickets and feedback: guests and users can send them; users see their own.
alter table cpa.support_tickets enable row level security;
grant insert on cpa.support_tickets to anon, authenticated;
grant select on cpa.support_tickets to authenticated;
create policy "Guests send tickets" on cpa.support_tickets for insert to anon
  with check (user_id is null);
create policy "Users send tickets" on cpa.support_tickets for insert to authenticated
  with check (user_id is null or (select auth.uid()) = user_id);
create policy "Users read their own tickets" on cpa.support_tickets for select to authenticated
  using ((select auth.uid()) = user_id);

alter table cpa.feedback enable row level security;
grant insert on cpa.feedback to anon, authenticated;
grant select on cpa.feedback to authenticated;
create policy "Guests send feedback" on cpa.feedback for insert to anon
  with check (user_id is null);
create policy "Users send feedback" on cpa.feedback for insert to authenticated
  with check (user_id is null or (select auth.uid()) = user_id);
create policy "Users read their own feedback" on cpa.feedback for select to authenticated
  using ((select auth.uid()) = user_id);

-- Data-removal log: server only (RLS on, no policies, no grants to API roles).
alter table cpa.support_log enable row level security;

grant select on cpa.portfolio_holdings, cpa.user_points to authenticated;

-- =====================================================================
-- 14. Seed data that the app treats as fixed
-- =====================================================================

insert into cpa.categories (name, sort_order) values
  ('Layer 1', 1), ('Layer 2', 2), ('DeFi', 3), ('AI', 4), ('Stablecoin', 5),
  ('Meme', 6), ('Exchange', 7), ('Infrastructure', 8), ('Gaming', 9), ('RWA', 10);

insert into cpa.plans (id, label, price_usd, period) values
  ('free', 'Free', 0, null),
  ('pro-monthly', 'Pro monthly', 9.99, 'month'),
  ('pro-yearly', 'Pro yearly', 95.88, 'year');

insert into cpa.promotions (code, title, plan_id, percent_off, fixed_price_usd, detail, new_accounts_only, points_cost, ends_at, terms) values
  ('AUTUMN20', '20% off CPA Pro yearly', 'pro-yearly', 20, null, '$95.88 → $76.70 for the first year', false, null, '2026-10-31 23:59:59',
   'For CPA Pro yearly. One use per account. The discount applies to the first year only and can''t be combined with other codes.'),
  ('FIRSTPRO', 'First month of Pro for $1.00', 'pro-monthly', null, 1.00, 'New accounts only', true, null, '2026-12-31 23:59:59',
   'For accounts created in the last 30 days. Applies to the first month of CPA Pro monthly, then $9.99 a month. One use per account.'),
  ('SUMMER15', 'Summer 15% off', 'pro-monthly', 15, null, null, false, null, '2026-08-31 23:59:59', 'Ended.'),
  ('POINTS10', '10% off with 500 points', null, 10, null, null, false, 500, null, null);

insert into cpa.exchanges (id, name, type, volume_24h_usd) values
  ('binance', 'Binance', 'Centralized', 14.2e9),
  ('coinbase', 'Coinbase', 'Centralized', 3.1e9),
  ('okx', 'OKX', 'Centralized', 2.8e9),
  ('bybit', 'Bybit', 'Centralized', 2.4e9),
  ('kraken', 'Kraken', 'Centralized', 1.1e9),
  ('uniswap-v3', 'Uniswap v3', 'Decentralized', 1.6e9),
  ('kucoin', 'KuCoin', 'Centralized', 840e6),
  ('gate', 'Gate', 'Centralized', 760e6),
  ('orbx', 'OrbX Exchange', 'Centralized', 210.4e6);

insert into cpa.glossary_terms (key, definition) values
  ('marketCap', 'Price × circulating supply. The value of all tokens that can trade today.'),
  ('fdv', 'Fully diluted valuation: price × maximum supply. Shows the value if every token were circulating.'),
  ('volume', 'The value of this coin traded across all tracked markets in the last 24 hours.'),
  ('circulating', 'Tokens that are unlocked and trading today.'),
  ('unlocked', 'Tokens already released from vesting that are not yet circulating, for example held in treasury.'),
  ('locked', 'Tokens still vesting. They are released on a schedule and can add selling pressure when they unlock.'),
  ('supply', 'How the maximum supply splits between circulating, unlocked but not circulating, and still locked.'),
  ('ath', 'All-time high and low: the highest and lowest prices in this coin''s sample history.'),
  ('roi', 'Return on investment: current price divided by the round''s token price.');
