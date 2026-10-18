// Loads the app's bundled sample data (app/src/data/*.js) into the cpa reference tables.
// Run from supabase/: `npm run seed`. Uses SUPABASE_SECRET_KEY from ../.env (server-only,
// bypasses RLS); the key is never printed.
//
// Safe to re-run. Tables that users point at (coins, funds) are upserted so watchlists,
// follows and transactions survive; derived tables are cleared and reloaded.
// Dates in the sample data are relative to today, so a re-run moves them forward.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { categories, initialCoins } from "../../app/src/data/coins.js";
import { exchanges, tokenSales } from "../../app/src/data/directory.js";
import { faqSections, learnArticles } from "../../app/src/data/help.js";
import { definitions } from "../../app/src/data/glossary.js";
import { funds, fundingRounds, researchFor } from "../../app/src/data/research.js";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
let envText;
try {
  envText = readFileSync(envPath, "utf8");
} catch (error) {
  console.error(`Couldn't read ${envPath} (${error.code}). Copy .env.example to .env and fill in the Supabase values.`);
  process.exit(1);
}
const env = Object.fromEntries(
  envText.split("\n")
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.trim().replace(/^["']|["']$/g, "")]),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.");
  process.exit(1);
}

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  db: { schema: "cpa" },
  auth: { persistSession: false },
});

const day = (date) => date.toISOString().slice(0, 10);
const iso = (date) => date.toISOString();

async function run(label, request) {
  const { error } = await request;
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    await run(`upsert ${table}`, db.from(table).upsert(rows.slice(i, i + 500), { onConflict }));
  }
  console.log(`${table}: ${rows.length}`);
}

async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    await run(`insert ${table}`, db.from(table).insert(rows.slice(i, i + 500)));
  }
  console.log(`${table}: ${rows.length}`);
}

// Deletes every row; PostgREST needs a filter, so match on a column that is never null.
const clear = (table, column) => run(`clear ${table}`, db.from(table).delete().not(column, "is", null));

// ---------------------------------------------------------------------------
// Build rows
// ---------------------------------------------------------------------------

const research = new Map(initialCoins.map((coin) => [coin.id, researchFor(coin)]));
const exchangeIdByName = new Map(exchanges.map((exchange) => [exchange.name, exchange.id]));

const coinRows = initialCoins.map((coin) => {
  const r = research.get(coin.id);
  return {
    id: coin.id,
    rank: coin.rank,
    name: coin.name,
    symbol: coin.symbol,
    category: coin.category,
    logo_tint: coin.tint,
    price_usd: coin.price,
    change_1h: coin.change1h,
    change_24h: coin.change24h,
    change_7d: coin.change7d,
    market_cap_usd: coin.marketCap,
    fdv_usd: coin.fdv,
    volume_24h_usd: coin.volume24h,
    sparkline_7d: coin.spark,
    listed_on: day(r.listedOn),
    contract_address: r.contract,
    contract_verified: r.verified,
    about: r.about,
    total_supply: r.supply.total,
    circulating_supply: r.supply.circulating,
    max_supply: r.vesting?.total ?? r.supply.total,
  };
});

const marketRows = initialCoins.flatMap((coin) =>
  research.get(coin.id).markets.map((market) => ({
    coin_id: coin.id,
    exchange_id: exchangeIdByName.get(market.exchange),
    pair: market.pair,
    price_usd: coin.price * market.priceOffset,
    volume_share: market.share,
  })),
);

const vestingRows = [];
const allocationRows = [];
const unlockRows = new Map();
for (const coin of initialCoins) {
  const r = research.get(coin.id);
  if (r.vesting) {
    vestingRows.push({ coin_id: coin.id, total_supply: r.vesting.total, tge_date: day(r.vesting.tge) });
    for (const a of r.vesting.allocations) {
      allocationRows.push({
        coin_id: coin.id, name: a.name, share: a.share, tge_share: a.tge,
        cliff_months: a.cliff, vest_months: a.months, unlock_day: a.day,
      });
    }
  }
  for (const unlock of r.upcomingUnlocks) {
    unlockRows.set(unlock.id, {
      id: unlock.id, coin_id: coin.id, unlock_at: iso(unlock.date), amount: unlock.amount, allocations: unlock.allocations,
    });
  }
}

const fundRows = funds.map((fund) => ({
  id: fund.id, name: fund.name, tier: fund.tier, type: fund.type, founded: fund.founded,
  deals: fund.deals, deals_30d: fund.deals30d, deployed_usd: fund.deployed,
}));
const fundSectorRows = funds.flatMap((fund) =>
  fund.sectors.map(([sector, share]) => ({ fund_id: fund.id, sector, share: Math.round(share) })),
);

const roundRows = fundingRounds.map((round) => ({
  id: round.id, coin_id: round.coinId, project: round.project, sector: round.sector, round_type: round.type,
  announced_on: day(round.date), amount_usd: round.amount, valuation_usd: round.valuation, token_price_usd: round.tokenPrice,
}));
const investorRows = fundingRounds.flatMap((round) =>
  round.investors.map((fundId) => ({ round_id: round.id, fund_id: fundId, is_lead: round.leads.includes(fundId) })),
);

const saleRows = tokenSales.map((sale) => ({
  id: sale.id, coin_id: sale.coinId ?? null, name: sale.name, symbol: sale.symbol, sale_type: sale.type,
  launchpad: sale.launchpad, starts_at: iso(sale.start), ends_at: iso(sale.end), raise_usd: sale.raise,
  price_usd: sale.price, fdv_usd: sale.fdv, sold_share: sale.sold ?? null,
  current_price_usd: sale.currentPrice ?? null, ath_roi: sale.athRoi ?? null,
}));

const faqSectionRows = faqSections.map((section, index) => ({ id: section.id, title: section.title, sort_order: index + 1 }));
const faqItemRows = faqSections.flatMap((section) =>
  section.items.map((item, index) => ({ section_id: section.id, question: item.q, answer: item.a, sort_order: index + 1 })),
);
const learnRows = learnArticles.map((article) => ({ title: article.q, summary: article.a, path: article.to }));
const glossaryRows = Object.entries(definitions).map(([key, definition]) => ({ key, definition }));

// ---------------------------------------------------------------------------
// Write: parents before children, children cleared before parents change
// ---------------------------------------------------------------------------

try {
  await upsert("categories", categories.map((name, index) => ({ name, sort_order: index + 1 })), "name");
  await upsert("exchanges", exchanges.map((e) => ({ id: e.id, name: e.name, type: e.type, volume_24h_usd: e.volume24h })), "id");
  await upsert("coins", coinRows, "id");
  await upsert("funds", fundRows, "id");

  // Derived tables: no user rows point at these, so reload them in full.
  await clear("coin_markets", "coin_id");
  await clear("vesting_allocations", "coin_id");
  await clear("vesting_schedules", "coin_id");
  await clear("unlock_events", "id");
  await clear("fund_sectors", "fund_id");
  await clear("round_investors", "round_id");
  await clear("funding_rounds", "id");
  await clear("token_sales", "id");
  await clear("faq_items", "id");
  await clear("faq_sections", "id");
  await clear("learn_articles", "id");

  await insert("coin_markets", marketRows);
  await insert("vesting_schedules", vestingRows);
  await insert("vesting_allocations", allocationRows);
  await insert("unlock_events", [...unlockRows.values()]);
  await insert("fund_sectors", fundSectorRows);
  await insert("funding_rounds", roundRows);
  await insert("round_investors", investorRows);
  await insert("token_sales", saleRows);
  await insert("faq_sections", faqSectionRows);
  await insert("faq_items", faqItemRows);
  await insert("learn_articles", learnRows);
  await upsert("glossary_terms", glossaryRows, "key");
  console.log("Seed complete.");
} catch (error) {
  console.error(`Seed failed. ${error.message}`);
  process.exit(1);
}
