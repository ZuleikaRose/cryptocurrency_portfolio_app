-- Copies schema.sql's descriptions of the price history columns and functions (clarifications
-- 26 and 28) into the database, so they show in the Supabase dashboard. Comments only.
comment on column cpa.coins.change_1h is 'Percent. From Coinbase 15-minute closes when history_updated_at is set.';
comment on table cpa.coin_prices is 'Coinbase Exchange closes in USD, stamped at the candle''s close (UTC). 15-minute closes are kept 26 hours, hourly 8 days, 6-hourly 32 days and daily for the whole history. Read through price_history(coin_id, range_id) for charts and price_at(coin_id, at_ms) for "Use market price", never selected directly (PostgREST caps rows at 1,000).';
comment on column cpa.coin_prices.coin_id is 'The coin (coins.id).';
comment on column cpa.coin_prices.at is 'When the candle closed (UTC). A close at midnight UTC is the previous day''s daily close.';
comment on column cpa.coin_prices.price_usd is 'Closing price in USD.';
comment on column cpa.coin_prices.volume_usd is 'Volume in USD, when known.';

comment on column cpa.price_history_sync.id is 'Always true: the table has one row.';
comment on column cpa.price_history_sync.last_started_at is 'When the last run started. Runs start at most every 10 minutes (claim_price_history_sync).';
comment on column cpa.price_history_sync.last_finished_at is 'When the last run finished.';
comment on column cpa.price_history_sync.last_status is 'ok or error.';
comment on column cpa.price_history_sync.coins_updated is 'Coins whose history the last run wrote.';
comment on column cpa.price_history_sync.requests is 'Coinbase requests the last run made (public candles, 10 a second).';
comment on column cpa.price_history_sync.last_error is 'Generic error text from the last failed run; details are in the function logs.';

comment on function cpa.price_history(text, text) is 'One chart range for a coin (1D, 7D, 1M, 3M, 1Y, ALL) as {points: [[ms, price_usd]], high, low, since}; high and low are the highest and lowest daily close. Public.';
comment on function cpa.price_at(text, bigint) is 'The nearest stored close to a moment as [ms, price_usd], or null without history. For the transaction sheet''s "Use market price". Public.';
comment on function cpa.claim_price_history_sync() is 'Starts a price-history-sync run if none started in the last 10 minutes, returning what to fetch, or null. Service role only.';
comment on function cpa.apply_price_history(jsonb, jsonb, jsonb, text[], text[], integer) is 'Writes a run''s closes, change_1h and sparkline_7d, prunes by retention, and records the run. Service role only.';
comment on function cpa.fail_price_history_sync(text, integer) is 'Records a failed price-history-sync run. Service role only.';
