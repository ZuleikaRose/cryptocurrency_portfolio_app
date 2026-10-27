-- Bring the live comments in line with schema.sql: Kraken history for TRON, USDC and Maker
-- (clarification 36) and Maker's price from Sky with no market cap (clarification 39).
comment on table cpa.coin_prices is 'Coinbase Exchange closes in USD (Kraken''s for TRON, USDC and Maker, which is SKY × 24,000), stamped at the candle''s close (UTC). 15-minute closes are kept 26 hours, hourly 8 days, 6-hourly 32 days and daily for the whole history. Read through price_history(coin_id, range_id) for charts and price_at(coin_id, at_ms) for "Use market price", never selected directly (PostgREST caps rows at 1,000).';
comment on column cpa.coins.change_1h is 'Percent. From Coinbase (or Kraken) 15-minute closes when history_updated_at is set.';
comment on column cpa.coins.sparkline_7d is '24 points. Coinbase (or Kraken) hourly closes over 7 days when history_updated_at is set, otherwise a unitless sample shape.';
comment on column cpa.coins.history_updated_at is 'When price-history-sync last wrote this coin''s history (Coinbase, or Kraken for TRON, USDC and Maker), change_1h and sparkline_7d; null keeps the sample chart.';
comment on column cpa.coins.market_cap_usd is 'Market cap in USD; null when CryptoRank gives none (Maker, priced from Sky × 24,000), shown "—".';
comment on column cpa.price_history_sync.requests is 'Coinbase and Kraken requests the last run made (public candles, no key).';
comment on column cpa.price_history_sync.backfilled is 'Coins whose daily closes reach back to their first Coinbase day; Kraken coins after one read (Kraken returns its latest 720 candles).';
comment on column cpa.price_history_sync.skipped_coins is 'Coins left on sample charts this run (no Coinbase or Kraken source, or its price differs from CryptoRank by over 10%).';
comment on column cpa.user_settings.watchlist_list is 'Open watchlist: ''main'' or a watchlists.id (US-6.2).';
