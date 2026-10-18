-- Live market data (phase 3): the cryptorank-sync Edge Function writes CryptoRank v3 figures
-- into cpa.coins on a pg_cron schedule; the app reads them over the REST API.

-- Which CryptoRank currency a coin mirrors, and where its price figures came from.
alter table cpa.coins
  add column cryptorank_slug text unique,
  add column price_source text not null default 'sample' check (price_source in ('sample', 'cryptorank')),
  add column price_updated_at timestamptz;
comment on column cpa.coins.cryptorank_slug is 'CryptoRank v3 currency slug; null keeps the sample figures.';
comment on column cpa.coins.price_source is 'Source of price, 24h change, market cap and volume (trust signal, journey rule 4).';
comment on column cpa.coins.price_updated_at is 'When CryptoRank last reported these figures ("Last updated", stale over 5 min).';

-- Matched by slug, not ticker, so copycat tickers can never overwrite a real coin (US-2.5).
-- Toncoin and Maker sit outside CryptoRank's top 200 and stay on sample figures.
update cpa.coins c set cryptorank_slug = m.slug
from (values
  ('bitcoin', 'bitcoin'), ('ethereum', 'ethereum'), ('tether', 'tether'), ('bnb', 'bnb'),
  ('solana', 'solana'), ('usd-coin', 'usdcoin'), ('xrp', 'ripple'), ('dogecoin', 'dogecoin'),
  ('cardano', 'cardano'), ('avalanche', 'avalanche'), ('shiba-inu', 'shiba-inu'), ('tron', 'tron'),
  ('chainlink', 'chainlink'), ('polkadot', 'polkadot'), ('bitcoin-cash', 'bitcoin-cash'),
  ('near', 'near-protocol'), ('litecoin', 'litecoin'), ('uniswap', 'uniswap'),
  ('internet-computer', 'internet-computer'), ('polygon', 'polygon-ecosystem-token'), ('aptos', 'aptos'),
  ('render', 'render-token'), ('arbitrum', 'arbitrum'), ('optimism', 'optimism'), ('sui', 'sui'),
  ('injective', 'injective-protocol'), ('celestia', 'celestia'), ('fetch-ai', 'fetch-ai'),
  ('immutable', 'immutable-x'), ('aave', 'aave'), ('ondo', 'ondo-finance')
) as m(id, slug)
where c.id = m.id;

-- One row: the last sync run. Server-only (RLS on, no policies, no grants to API roles).
create table cpa.market_sync (
  id               boolean primary key default true check (id),
  last_started_at  timestamptz,
  last_finished_at timestamptz,
  last_status      text check (last_status in ('ok', 'error')),
  coins_updated    integer not null default 0,
  credits_used     integer not null default 0,
  missing_slugs    text[] not null default '{}',
  last_error       text
);
alter table cpa.market_sync enable row level security;
revoke all on cpa.market_sync from anon, authenticated;
insert into cpa.market_sync (id) values (true);

-- Claims a run unless one started in the last 9 minutes. The function is public (pg_cron calls
-- it without a secret), so this caps CryptoRank spend however often it's called.
create or replace function cpa.claim_market_sync() returns boolean
language sql security invoker set search_path = '' as $$
  update cpa.market_sync set last_started_at = now()
  where id and (last_started_at is null or last_started_at < now() - interval '9 minutes')
  returning true;
$$;

-- Applies one batch of CryptoRank figures: [{slug, price, change24h, marketCap, volume24h}]
-- and records the run. Returns the number of coins updated.
create or replace function cpa.apply_market_prices(prices jsonb, credits integer, missing text[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  updated integer;
begin
  update cpa.coins c set
    price_usd = p.price,
    change_24h = coalesce(p."change24h", c.change_24h),
    market_cap_usd = coalesce(p."marketCap", c.market_cap_usd),
    volume_24h_usd = coalesce(p."volume24h", c.volume_24h_usd),
    price_source = 'cryptorank',
    price_updated_at = now()
  from jsonb_to_recordset(prices) as p(slug text, price numeric, "change24h" numeric, "marketCap" numeric, "volume24h" numeric)
  where c.cryptorank_slug = p.slug and p.price is not null and p.price >= 0;
  get diagnostics updated = row_count;
  update cpa.market_sync set last_finished_at = now(), last_status = 'ok', coins_updated = updated,
    credits_used = credits, missing_slugs = missing, last_error = null
  where id;
  return updated;
end;
$$;

create or replace function cpa.fail_market_sync(message text, credits integer) returns void
language sql security invoker set search_path = '' as $$
  update cpa.market_sync set last_finished_at = now(), last_status = 'error', coins_updated = 0,
    credits_used = credits, last_error = left(message, 500)
  where id;
$$;

revoke execute on function cpa.claim_market_sync() from public, anon, authenticated;
revoke execute on function cpa.apply_market_prices(jsonb, integer, text[]) from public, anon, authenticated;
revoke execute on function cpa.fail_market_sync(text, integer) from public, anon, authenticated;
grant execute on function cpa.claim_market_sync() to service_role;
grant execute on function cpa.apply_market_prices(jsonb, integer, text[]) to service_role;
grant execute on function cpa.fail_market_sync(text, integer) to service_role;
grant select, update on cpa.market_sync to service_role;

-- Every 10 minutes: 2 credits a run (top 200 coins) is 288 a day, inside the free plan's
-- 400 a day and 10K a month. Raise the frequency only on a paid CryptoRank plan.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'cryptorank-sync',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://hxckrfjrmhdloqpctemy.supabase.co/functions/v1/cryptorank-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
