-- Copies schema.sql's description of portfolio transactions, including wallet-import rows
-- (US-6.4 cost basis), into the database. Comments only.
comment on table cpa.transactions is 'Manual, CSV-imported and wallet-imported transactions; holdings are derived from them by average cost, never stored. A wallet import records one transfer per coin per UTC day of the address''s history, priced at that day''s close, plus an opening balance or an adjustment at the import day''s price where the history doesn''t explain the balance.';
comment on column cpa.transactions.price_usd is 'Cost basis per coin. Wallet imports: that day''s closing price (Coinbase, UTC).';
comment on column cpa.transactions.occurred_at is 'Wallet imports: 12:00 UTC on the transfer day (00:00 for an opening balance).';
comment on column cpa.transactions.note is 'Wallet imports: "Wallet import <short address>", which re-imports and "Rebuild from history" match.';
