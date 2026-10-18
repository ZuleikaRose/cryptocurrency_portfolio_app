-- Zcash (ZEC) joined the sample data on Oct 18, 2026 (app/src/data/coins.js, loaded by npm run seed).
-- It's CryptoRank's #9 coin, so the existing pages cover it at no extra credit.
update cpa.coins set cryptorank_slug = 'zcash' where id = 'zcash';
