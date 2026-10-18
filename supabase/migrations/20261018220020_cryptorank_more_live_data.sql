-- More live data (Oct 18, 2026): Toncoin and Maker get CryptoRank figures, Zcash joins the list
-- (seeded by npm run seed, mapped in the next migration), and 7d change and FDV come from
-- CryptoRank's per-coin endpoint about every 2 days.

-- Adding a coin re-ranks the ones below it; checking rank uniqueness at commit lets the seed
-- upsert the shifted ranks in one statement.
alter table cpa.coins drop constraint coins_rank_key;
alter table cpa.coins add constraint coins_rank_key unique (rank) deferrable initially deferred;

alter table cpa.coins
  add column cryptorank_id integer unique,
  add column details_updated_at timestamptz;
comment on column cpa.coins.cryptorank_id is 'CryptoRank v3 currency id, for the per-coin endpoint (filled in by the sync).';
comment on column cpa.coins.details_updated_at is 'When CryptoRank last reported change_7d and fdv_usd (refreshed about every 2 days).';

-- Toncoin is listed on CryptoRank as Gram (GRAM), the layer 1 first developed by Telegram.
-- Maker is unranked there (migrated to Sky), so it's only reachable by id through the details refresh.
update cpa.coins set cryptorank_slug = 'gram' where id = 'toncoin';
update cpa.coins set cryptorank_slug = 'maker', cryptorank_id = 34 where id = 'maker';

-- Rows: {slug, id?, price?, change24h?, marketCap?, volume24h?, change7d?, fdv?, details?}.
-- Page rows carry price figures; detail rows (details: true) add 7d change and FDV.
create or replace function cpa.apply_market_prices(prices jsonb, credits integer, missing text[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  updated integer;
begin
  update cpa.coins c set
    cryptorank_id = coalesce(p.id, c.cryptorank_id),
    price_usd = coalesce(p.price, c.price_usd),
    change_24h = coalesce(p."change24h", c.change_24h),
    market_cap_usd = coalesce(p."marketCap", c.market_cap_usd),
    volume_24h_usd = coalesce(p."volume24h", c.volume_24h_usd),
    change_7d = coalesce(p."change7d", c.change_7d),
    fdv_usd = coalesce(p.fdv, c.fdv_usd),
    price_source = case when p.price is not null then 'cryptorank' else c.price_source end,
    price_updated_at = case when p.price is not null then now() else c.price_updated_at end,
    details_updated_at = case when coalesce(p.details, false) then now() else c.details_updated_at end
  from jsonb_to_recordset(prices) as p(slug text, id integer, price numeric, "change24h" numeric, "marketCap" numeric,
    "volume24h" numeric, "change7d" numeric, fdv numeric, details boolean)
  where c.cryptorank_slug = p.slug and (p.price is null or p.price >= 0);
  get diagnostics updated = row_count;
  update cpa.market_sync set last_finished_at = now(), last_status = 'ok', coins_updated = updated,
    credits_used = credits, missing_slugs = missing, last_error = null
  where id;
  return updated;
end;
$$;
revoke execute on function cpa.apply_market_prices(jsonb, integer, text[]) from public, anon, authenticated;
grant execute on function cpa.apply_market_prices(jsonb, integer, text[]) to service_role;
