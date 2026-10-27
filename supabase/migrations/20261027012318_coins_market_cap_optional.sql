-- Clarification 39: CryptoRank gives no market cap for Maker (unranked since it became Sky), so a
-- coin's market cap may be unknown. Clear Maker's leftover $2.2B sample figure; cryptorank-sync
-- now prices Maker from Sky's row × 24,000 and never writes a market cap for it.
alter table cpa.coins alter column market_cap_usd drop not null;

update cpa.coins set market_cap_usd = null where cryptorank_slug = 'maker';
