-- Mirror schema.sql's descriptions of the live price sync into the database (drawsql.png, Market group).
comment on table cpa.market_sync is
  'Last run of the live price sync (the cryptorank-sync Edge Function). One row; server-only.';
comment on column cpa.market_sync.id is 'Always true: the table holds a single row.';
comment on column cpa.market_sync.last_started_at is 'When the last run was claimed; runs start at most every 9 minutes (claim_market_sync).';
comment on column cpa.market_sync.last_finished_at is 'When the last run ended, successfully or not.';
comment on column cpa.market_sync.last_status is 'ok or error.';
comment on column cpa.market_sync.coins_updated is 'Coins whose figures the last run updated.';
comment on column cpa.market_sync.credits_used is 'CryptoRank credits the last run spent (free plan: 400 a day).';
comment on column cpa.market_sync.missing_slugs is 'Mapped coins (coins.cryptorank_slug) not found in the top 200.';
comment on column cpa.market_sync.last_error is 'Error message of the last failed run, up to 500 characters.';
comment on table cpa.coins is
  'Coins and their latest market figures (01-market.md, 03-coin-detail.md). Coins with a cryptorank_slug get live CryptoRank figures.';
