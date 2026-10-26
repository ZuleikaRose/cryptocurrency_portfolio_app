-- Real price history (clarification 26): the price-history-sync Edge Function writes Coinbase
-- Exchange closes into cpa.coin_prices every 15 minutes, and 1h change and the 7d sparkline into
-- cpa.coins. The app reads a chart range through cpa.price_history().

-- Set when the sync last wrote this coin's history; null keeps the sample chart and sparkline.
alter table cpa.coins add column history_updated_at timestamptz;
comment on column cpa.coins.history_updated_at is 'When price-history-sync last wrote this coin''s Coinbase history, change_1h and sparkline_7d; null keeps the sample chart.';
comment on column cpa.coins.sparkline_7d is '24 points. Coinbase hourly closes over 7 days when history_updated_at is set, otherwise a unitless sample shape.';
comment on table cpa.coin_prices is 'Coinbase Exchange closes in USD, stamped at the candle''s close (UTC). 15-minute closes are kept 26 hours, hourly 8 days, 6-hourly 32 days and daily for the whole history (price-history-sync).';

-- One row: the last sync run. Server-only (RLS on, no policies, no grants to API roles).
create table cpa.price_history_sync (
  id               boolean primary key default true check (id),
  last_started_at  timestamptz,
  last_finished_at timestamptz,
  last_status      text check (last_status in ('ok', 'error')),
  coins_updated    integer not null default 0,
  requests         integer not null default 0,
  fetched_at       jsonb not null default '{}',
  backfilled       text[] not null default '{}',
  skipped_coins    text[] not null default '{}',
  last_error       text
);
comment on table cpa.price_history_sync is 'Last run of price-history-sync. Server-only.';
comment on column cpa.price_history_sync.fetched_at is 'Last successful fetch per candle size in seconds, e.g. {"900": "2026-10-26T12:00:00Z"}.';
comment on column cpa.price_history_sync.backfilled is 'Coins whose daily closes reach back to their first Coinbase day.';
comment on column cpa.price_history_sync.skipped_coins is 'Coins left on sample charts this run (no Coinbase product, or its price differs from CryptoRank by over 10%).';
alter table cpa.price_history_sync enable row level security;
revoke all on cpa.price_history_sync from anon, authenticated;
insert into cpa.price_history_sync (id) values (true);

-- Claims a run unless one started in the last 10 minutes, so calling the public function more
-- often can't multiply Coinbase requests. Returns what the run needs, or null.
create or replace function cpa.claim_price_history_sync() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  state cpa.price_history_sync;
begin
  update cpa.price_history_sync set last_started_at = now()
  where id and (last_started_at is null or last_started_at < now() - interval '10 minutes')
  returning * into state;
  if not found then return null; end if;
  return jsonb_build_object(
    'fetched', state.fetched_at,
    'backfilled', to_jsonb(state.backfilled),
    'coins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'price', c.price_usd,
        'oldest', (select floor(extract(epoch from min(p.at)) * 1000) from cpa.coin_prices p
                   where p.coin_id = c.id and (p.at at time zone 'UTC') = date_trunc('day', p.at at time zone 'UTC'))))
      from cpa.coins c where c.price_source = 'cryptorank'), '[]'::jsonb)
  );
end;
$$;

-- Saves one run: closes [{coin, at, price}] (at in ms), per-coin figures
-- [{id, change1h, spark}], and the run record. Prunes closes past their retention.
create or replace function cpa.apply_price_history(points jsonb, coins jsonb, fetched jsonb, backfilled text[], skipped text[], requests integer)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  updated integer;
begin
  insert into cpa.coin_prices (coin_id, at, price_usd)
  select p.coin, to_timestamp(p.at / 1000.0), p.price
  from jsonb_to_recordset(points) as p(coin text, at bigint, price numeric)
  where p.price > 0 and exists (select 1 from cpa.coins c where c.id = p.coin and c.price_source = 'cryptorank')
  on conflict (coin_id, at) do update set price_usd = excluded.price_usd;

  update cpa.coins c set
    change_1h = coalesce(f."change1h", c.change_1h),
    sparkline_7d = coalesce(f.spark, c.sparkline_7d),
    history_updated_at = now()
  from jsonb_to_recordset(coins) as f(id text, "change1h" numeric, spark numeric[])
  where c.id = f.id and c.price_source = 'cryptorank';
  get diagnostics updated = row_count;

  delete from cpa.coin_prices where
    (at < now() - interval '26 hours' and extract(minute from at at time zone 'UTC') <> 0)
    or (at < now() - interval '8 days' and extract(hour from at at time zone 'UTC')::int % 6 <> 0)
    or (at < now() - interval '32 days' and (at at time zone 'UTC') <> date_trunc('day', at at time zone 'UTC'));

  update cpa.price_history_sync set last_finished_at = now(), last_status = 'ok', coins_updated = updated,
    requests = apply_price_history.requests, fetched_at = fetched_at || apply_price_history.fetched,
    backfilled = apply_price_history.backfilled, skipped_coins = skipped, last_error = null
  where id;
  return updated;
end;
$$;

create or replace function cpa.fail_price_history_sync(message text, requests integer) returns void
language sql security invoker set search_path = '' as $$
  update cpa.price_history_sync set last_finished_at = now(), last_status = 'error', coins_updated = 0,
    requests = fail_price_history_sync.requests, last_error = left(message, 500)
  where id;
$$;

revoke execute on function cpa.claim_price_history_sync() from public, anon, authenticated;
revoke execute on function cpa.apply_price_history(jsonb, jsonb, jsonb, text[], text[], integer) from public, anon, authenticated;
revoke execute on function cpa.fail_price_history_sync(text, integer) from public, anon, authenticated;
grant execute on function cpa.claim_price_history_sync() to service_role;
grant execute on function cpa.apply_price_history(jsonb, jsonb, jsonb, text[], text[], integer) to service_role;
grant execute on function cpa.fail_price_history_sync(text, integer) to service_role;
grant select, update on cpa.price_history_sync to service_role;
grant select, insert, update, delete on cpa.coin_prices to service_role;

-- One chart range for Coin detail and Portfolio (03-coin-detail.md ranges): 1D 15-minute,
-- 7D hourly, 1M 6-hourly, 3M / 1Y / ALL daily closes, ALL thinned to about 400 points (the
-- newest kept). high and low are the highest and lowest daily close on record (ATH / ATL).
-- Times are ms since the epoch. Public data, so anon may call it.
create or replace function cpa.price_history(coin_id text, range_id text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with history as (
    select p.at, p.price_usd, p.at at time zone 'UTC' as utc
    from cpa.coin_prices p
    where p.coin_id = price_history.coin_id
  ),
  daily as (select at, price_usd from history where utc = date_trunc('day', utc)),
  picked as (
    select at, price_usd from history where case price_history.range_id
      when '1D' then at > now() - interval '1 day'
      when '7D' then at > now() - interval '7 days' and extract(minute from utc) = 0
      when '1M' then at > now() - interval '30 days' and extract(minute from utc) = 0 and extract(hour from utc)::int % 6 = 0
      when '3M' then at > now() - interval '90 days' and utc = date_trunc('day', utc)
      when '1Y' then at > now() - interval '365 days' and utc = date_trunc('day', utc)
      when 'ALL' then utc = date_trunc('day', utc)
      else false
    end
  ),
  numbered as (select at, price_usd, row_number() over (order by at desc) - 1 as n, count(*) over () as total from picked),
  thinned as (select at, price_usd from numbered where n % greatest(1, ceil(total / 400.0)::integer) = 0)
  select jsonb_build_object(
    'points', coalesce((select jsonb_agg(jsonb_build_array(floor(extract(epoch from at) * 1000), price_usd) order by at) from thinned), '[]'::jsonb),
    'high', (select jsonb_build_array(floor(extract(epoch from at) * 1000), price_usd) from daily order by price_usd desc, at limit 1),
    'low', (select jsonb_build_array(floor(extract(epoch from at) * 1000), price_usd) from daily order by price_usd, at limit 1),
    'since', (select floor(extract(epoch from min(at)) * 1000) from daily)
  );
$$;
revoke execute on function cpa.price_history(text, text) from public;
grant execute on function cpa.price_history(text, text) to anon, authenticated, service_role;

-- Every 15 minutes, offset from cryptorank-sync's 10-minute runs. Coinbase's public candles need
-- no key and allow 10 requests a second; a run makes 31 to about 150.
select cron.schedule(
  'price-history-sync',
  '7,22,37,52 * * * *',
  $job$
  select net.http_post(
    url := 'https://hxckrfjrmhdloqpctemy.supabase.co/functions/v1/price-history-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
