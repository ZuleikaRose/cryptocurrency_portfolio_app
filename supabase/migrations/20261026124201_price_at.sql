-- Nearest Coinbase close to a moment, for "Use market price" on the transaction sheet
-- (clarification 28). Reads the newest close at or before the moment and the oldest after it
-- (both by the primary key), and returns the nearer as [ms, price_usd], or null when the coin
-- has no history.
create or replace function cpa.price_at(coin_id text, at_ms bigint) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with target as (select to_timestamp(price_at.at_ms / 1000.0) as t),
  candidates as (
    (select p.at, p.price_usd from cpa.coin_prices p, target
      where p.coin_id = price_at.coin_id and p.at <= target.t order by p.at desc limit 1)
    union all
    (select p.at, p.price_usd from cpa.coin_prices p, target
      where p.coin_id = price_at.coin_id and p.at > target.t order by p.at limit 1)
  )
  select jsonb_build_array(floor(extract(epoch from c.at) * 1000), c.price_usd)
  from candidates c, target
  order by abs(extract(epoch from c.at - target.t)), c.at
  limit 1;
$$;
revoke execute on function cpa.price_at(text, bigint) from public;
grant execute on function cpa.price_at(text, bigint) to anon, authenticated, service_role;
