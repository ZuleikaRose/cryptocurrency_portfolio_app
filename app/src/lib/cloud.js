// Signed-up accounts on Supabase (supabase/migrations). The app keeps one `data` object per
// session (state/AppStore.jsx); this maps it to and from the cpa tables and saves only the
// rows that changed. Guest and demo data never come through here.
import { supabase } from "./supabase.js";

const ms = (value) => (value ? new Date(value).getTime() : 0);
const iso = (value) => (value ? new Date(value).toISOString() : null);
const hhmm = (value) => (typeof value === "string" ? value.slice(0, 5) : value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Times that keep a list's order (newest first): a row keeps its saved time while the order
// still holds, otherwise it gets one just below the row above it.
function orderedTimes(list, previous, now) {
  let limit = Infinity;
  return list.map((item) => {
    const saved = previous.get(item);
    const time = saved != null && saved < limit ? saved : Math.min(limit - 1, now);
    limit = time;
    return time;
  });
}
const savedTimes = (snapshot, table, field) =>
  new Map([...(snapshot?.[table]?.values() ?? [])].map((row) => [row.key, ms(row[field])]));

// --- One-row tables -------------------------------------------------------

function settingsRow(data) {
  const { settings: s } = data;
  return {
    currency: s.currency, theme: s.theme, colors: s.colors, auto_refresh: s.autoRefresh,
    stop_animations: s.stopAnimations, hide_balances: s.hideBalances, watchlist_sort: s.watchlistSort,
    watchlist_list: s.watchlistList,
    chart_range: s.chartRange, chart_summaries: s.chartSummaries, auto_advance: s.autoAdvance, analytics: s.analytics,
    quiet_hours_enabled: s.quietHours.enabled, quiet_hours_start: s.quietHours.start, quiet_hours_end: s.quietHours.end,
    weekly_digest: s.weeklyDigest, reminder_timings: data.reminderTimings, notifications_asked: data.notificationsAsked,
    ai_explain_metric: s.ai.explainMetric, ai_similar_coins: s.ai.similarCoins, ai_digest_summary: s.ai.digestSummary,
    a11y_profiles: s.a11y.profiles, a11y_text_size: Math.round(s.a11y.textSize), a11y_font: s.a11y.font,
    a11y_line_height: s.a11y.lineHeight, a11y_letter_spacing: s.a11y.letterSpacing, a11y_align: s.a11y.align,
    a11y_contrast: s.a11y.contrast, a11y_saturation: s.a11y.saturation, a11y_highlight_links: s.a11y.highlightLinks,
    a11y_highlight_headings: s.a11y.highlightHeadings, a11y_strong_focus: s.a11y.strongFocus, a11y_big_cursor: s.a11y.bigCursor,
    a11y_reading_guide: s.a11y.readingGuide, a11y_hide_images: s.a11y.hideImages, a11y_summary_size: s.a11y.summarySize,
    market_view: s.market.view, market_sort: s.market.sort, market_dir: s.market.dir, market_category: s.market.category,
    market_density: s.market.density, market_gainers_window: s.market.gainersWindow,
    unlocks_range: s.unlocks.range, unlocks_watchlist_only: s.unlocks.watchlistOnly, unlocks_min_one: s.unlocks.minOne,
    unlocks_sort: s.unlocks.sort, unlocks_view: s.unlocks.view,
    fundraising_sectors: s.fundraising.sectors, fundraising_types: s.fundraising.types,
    fundraising_min_amount: s.fundraising.minAmount, fundraising_max_amount: s.fundraising.maxAmount,
    fundraising_days: s.fundraising.days, fundraising_investor: s.fundraising.investor, fundraising_sort: s.fundraising.sort,
  };
}

function settingsFromRow(r) {
  return {
    currency: r.currency, theme: r.theme, colors: r.colors, autoRefresh: r.auto_refresh, stopAnimations: r.stop_animations,
    hideBalances: r.hide_balances, watchlistSort: r.watchlist_sort, watchlistList: r.watchlist_list, chartRange: r.chart_range,
    chartSummaries: r.chart_summaries, autoAdvance: r.auto_advance, analytics: r.analytics,
    quietHours: { enabled: r.quiet_hours_enabled, start: hhmm(r.quiet_hours_start), end: hhmm(r.quiet_hours_end) },
    weeklyDigest: r.weekly_digest,
    ai: { explainMetric: r.ai_explain_metric, similarCoins: r.ai_similar_coins, digestSummary: r.ai_digest_summary },
    a11y: {
      profiles: r.a11y_profiles, textSize: r.a11y_text_size, font: r.a11y_font, lineHeight: Number(r.a11y_line_height),
      letterSpacing: Number(r.a11y_letter_spacing), align: r.a11y_align, contrast: r.a11y_contrast, saturation: r.a11y_saturation,
      highlightLinks: r.a11y_highlight_links, highlightHeadings: r.a11y_highlight_headings, strongFocus: r.a11y_strong_focus,
      bigCursor: r.a11y_big_cursor, readingGuide: r.a11y_reading_guide, hideImages: r.a11y_hide_images, summarySize: r.a11y_summary_size,
    },
    market: { view: r.market_view, sort: r.market_sort, dir: r.market_dir, category: r.market_category, density: r.market_density, gainersWindow: r.market_gainers_window },
    unlocks: { range: r.unlocks_range, watchlistOnly: r.unlocks_watchlist_only, minOne: r.unlocks_min_one, sort: r.unlocks_sort, view: r.unlocks_view },
    fundraising: {
      sectors: r.fundraising_sectors, types: r.fundraising_types, minAmount: Number(r.fundraising_min_amount),
      maxAmount: r.fundraising_max_amount == null ? null : Number(r.fundraising_max_amount),
      days: r.fundraising_days, investor: r.fundraising_investor, sort: r.fundraising_sort,
    },
  };
}

const stateRow = (data) => ({
  onboarded: data.onboarded,
  visits: data.visits,
  points_spent: data.pointsSpent,
  feedback_prompt_dismissed_at: iso(data.feedbackPromptDismissed),
  last_digest_at: iso(data.lastDigest),
  simulated_billing: data.billing,
});

// --- Per-user collections: rows keyed by `key`, written with user_id added -------

const collections = [
  { table: "watchlist_items", conflict: "coin_id", rows: (d) => d.watchlist.map((coin_id, position) => ({ key: coin_id, coin_id, position })) },
  // Named lists (US-6.2) save before their coins, so the coins' foreign key holds.
  {
    table: "watchlists", conflict: "id",
    rows: (d) => d.lists.filter((list) => UUID.test(list.id)).map(({ id, name }, position) => ({ key: id, id, name, position })),
  },
  {
    table: "watchlist_list_coins", conflict: "watchlist_id,coin_id", keys: ["watchlist_id", "coin_id"],
    rows: (d) => d.lists.filter((list) => UUID.test(list.id)).flatMap((list) =>
      list.coinIds.map((coin_id, position) => ({ key: `${list.id}|${coin_id}`, watchlist_id: list.id, coin_id, position }))),
  },
  {
    table: "recent_coins", conflict: "coin_id",
    rows: (d, prev, now) => {
      const times = orderedTimes(d.recentCoins, savedTimes(prev, "recent_coins", "viewed_at"), now);
      return d.recentCoins.map((coin_id, i) => ({ key: coin_id, coin_id, viewed_at: iso(times[i]) }));
    },
  },
  {
    table: "recent_searches", conflict: "query",
    rows: (d, prev, now) => {
      const times = orderedTimes(d.recentSearches, savedTimes(prev, "recent_searches", "searched_at"), now);
      return d.recentSearches.map((query, i) => ({ key: query, query, searched_at: iso(times[i]) }));
    },
  },
  {
    table: "sentiment_votes", conflict: "coin_id,vote_day", keys: ["coin_id", "vote_day"],
    rows: (d) => Object.entries(d.votes).map(([coin_id, v]) => ({ key: `${coin_id}|${v.day}`, coin_id, vote_day: v.day, vote: v.vote })),
  },
  { table: "user_interest_coins", conflict: "coin_id", rows: (d) => d.interests.coins.map((coin_id) => ({ key: coin_id, coin_id })) },
  { table: "user_interest_sectors", conflict: "sector", rows: (d) => d.interests.sectors.map((sector) => ({ key: sector, sector })) },
  {
    table: "transactions", conflict: "id",
    rows: (d) => d.transactions.filter((tx) => UUID.test(tx.id)).map((tx) => ({
      key: tx.id, id: tx.id, coin_id: tx.coinId, type: tx.type, amount: tx.amount, price_usd: tx.price,
      fee_usd: tx.fee ?? 0, occurred_at: iso(tx.date), note: tx.note ?? "",
    })),
  },
  { table: "fund_follows", conflict: "fund_id", rows: (d) => Object.entries(d.follows).map(([fund_id, frequency]) => ({ key: fund_id, fund_id, frequency })) },
  { table: "project_follows", conflict: "project", rows: (d) => d.followedProjects.map((project) => ({ key: project, project })) },
  {
    table: "saved_filters", conflict: "id",
    rows: (d) => d.savedFilters.filter((item) => UUID.test(item.id)).map(({ id, name, filters: f }) => ({
      key: id, id, name, sectors: f.sectors, types: f.types, min_amount: f.minAmount, max_amount: f.maxAmount,
      days: f.days, investor: f.investor, sort: f.sort,
    })),
  },
  {
    table: "price_alerts", conflict: "id",
    rows: (d) => d.alerts.filter((a) => UUID.test(a.id)).map((a) => ({
      key: a.id, id: a.id, coin_id: a.coinId, type: a.type, value: a.value, repeat: a.repeat, bypass_quiet: a.bypassQuiet,
      active: a.active, last_fired_at: iso(a.lastFired), created_at: iso(a.created) ?? undefined,
    })),
  },
  {
    table: "reminders", conflict: "target_id",
    rows: (d) => Object.entries(d.reminders).map(([target_id, r]) => ({
      key: target_id, target_id, kind: r.kind, symbol: r.symbol, name: r.name, label: r.label ?? `${r.symbol} unlock`,
      event_at: iso(r.date), timings: r.timings, fired: r.fired ?? [], paused: r.paused === true,
    })),
  },
  {
    table: "notifications", conflict: "id",
    rows: (d) => d.notifications.filter((n) => UUID.test(n.id)).map((n) => ({
      key: n.id, id: n.id, kind: n.kind, coin_id: n.coinId ?? null, title: n.title, detail: n.detail ?? "",
      path: n.path, bypass_quiet: n.bypassQuiet === true, read: n.read, created_at: iso(n.at),
    })),
  },
  {
    table: "affiliates", conflict: "user_id", keys: [],
    rows: (d) => (d.affiliate ? [{ key: "me", code: d.affiliate.code, payout_method: d.affiliate.payoutMethod, joined_at: iso(d.affiliate.joinedAt) }] : []),
  },
];

// Everything the save step compares against: table -> Map(key -> row).
export function snapshot(data, previous = null, now = Date.now()) {
  const out = {
    user_settings: new Map([["me", { key: "me", ...settingsRow(data) }]]),
    user_state: new Map([["me", { key: "me", ...stateRow(data) }]]),
  };
  collections.forEach((c) => {
    out[c.table] = new Map(c.rows(data, previous, now).map((row) => [row.key, row]));
  });
  return out;
}

const body = ({ key: _key, ...row }) => row;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function check(request) {
  const { error } = await request;
  if (error) throw error;
}

// Writes what changed between `previous` and `data`. Each table that saves keeps its new
// snapshot; a table that fails keeps the old one, so the next save retries it.
// Returns { snapshot, ok, error }.
export async function saveAccountData(userId, previous, data) {
  const next = snapshot(data, previous);
  const result = { ...previous };
  let firstError = null;

  const singles = [["user_settings", "user_id"], ["user_state", "user_id"]];
  for (const [table] of singles) {
    const row = next[table].get("me");
    if (same(row, previous[table]?.get("me"))) continue;
    try {
      await check(supabase.from(table).update(body(row)).eq("user_id", userId));
      result[table] = next[table];
    } catch (error) {
      firstError ??= error;
    }
  }

  for (const c of collections) {
    const before = previous[c.table] ?? new Map();
    const after = next[c.table];
    const removed = [...before.values()].filter((row) => !after.has(row.key));
    const changed = [...after.values()].filter((row) => !same(row, before.get(row.key)));
    if (!removed.length && !changed.length) continue;
    try {
      // Deletes first: a re-added search with different casing would hit the unique index otherwise.
      const keyColumns = c.keys ?? [c.conflict];
      if (removed.length && keyColumns.length === 1) {
        const column = keyColumns[0];
        await check(supabase.from(c.table).delete().eq("user_id", userId).in(column, removed.map((row) => row[column])));
      } else {
        for (const row of removed) {
          const match = Object.fromEntries(keyColumns.map((column) => [column, row[column]]));
          await check(supabase.from(c.table).delete().match({ user_id: userId, ...match }));
        }
      }
      if (changed.length) {
        // The conflict target must match a real unique key: the primary key `id` for uuid rows,
        // otherwise (user_id, key column).
        const target = c.conflict === "id" || c.conflict === "user_id" ? c.conflict : `user_id,${c.conflict}`;
        await check(supabase.from(c.table).upsert(changed.map((row) => ({ user_id: userId, ...body(row) })), { onConflict: target }));
      }
      result[c.table] = after;
    } catch (error) {
      firstError ??= error;
    }
  }
  return { snapshot: result, ok: !firstError, error: firstError };
}

// --- Load ------------------------------------------------------------------

async function rows(table, order, ascending = true, tieBreaker = null) {
  const pageSize = 1000;
  const result = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select("*").order(order, { ascending });
    if (tieBreaker) query = query.order(tieBreaker, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

// The signed-in user's profile and data in the app's shape (before AppStore's normalising).
// Returns { profile, stored } or throws. RLS limits every query to this user's rows.
export async function loadAccountData() {
  const [
    profiles, settings, state, watchlist, lists, listCoins, recentCoins, recentSearches, votes, interestCoins, interestSectors,
    transactions, follows, projects, filters, alerts, reminders, notifications, affiliates, tickets, feedback,
  ] = await Promise.all([
    rows("users", "id"), rows("user_settings", "user_id"), rows("user_state", "user_id"), rows("watchlist_items", "position", true, "coin_id"),
    rows("watchlists", "position", true, "id"), rows("watchlist_list_coins", "position", true, "coin_id"),
    rows("recent_coins", "viewed_at", false, "coin_id"), rows("recent_searches", "searched_at", false, "query"), rows("sentiment_votes", "vote_day", true, "coin_id"),
    rows("user_interest_coins", "coin_id"), rows("user_interest_sectors", "sector"), rows("transactions", "occurred_at", true, "id"),
    rows("fund_follows", "fund_id"), rows("project_follows", "followed_at", false, "project"), rows("saved_filters", "created_at", false, "id"),
    rows("price_alerts", "created_at", false, "id"), rows("reminders", "target_id"), rows("notifications", "created_at", false, "id"),
    rows("affiliates", "user_id"), rows("support_tickets", "created_at", false, "id"), rows("feedback", "created_at", false, "id"),
  ]);
  const profile = profiles[0];
  if (!profile) throw new Error("No profile row for this account.");
  const s = settings[0];
  const st = state[0];
  const affiliate = affiliates[0];

  const stored = {
    settings: s ? settingsFromRow(s) : undefined,
    reminderTimings: s?.reminder_timings,
    notificationsAsked: s?.notifications_asked,
    onboarded: st?.onboarded,
    visits: st?.visits,
    pointsSpent: st?.points_spent,
    feedbackPromptDismissed: ms(st?.feedback_prompt_dismissed_at),
    lastDigest: ms(st?.last_digest_at),
    billing: st?.simulated_billing,
    watchlist: watchlist.map((row) => row.coin_id),
    lists: lists.map((list) => ({
      id: list.id, name: list.name,
      coinIds: listCoins.filter((row) => row.watchlist_id === list.id).map((row) => row.coin_id),
    })),
    recentCoins: recentCoins.map((row) => row.coin_id),
    recentSearches: recentSearches.map((row) => row.query),
    votes: Object.fromEntries(votes.map((row) => [row.coin_id, { vote: row.vote, day: row.vote_day }])),
    interests: { coins: interestCoins.map((row) => row.coin_id), sectors: interestSectors.map((row) => row.sector) },
    transactions: transactions.map((row) => ({
      id: row.id, coinId: row.coin_id, type: row.type, amount: Number(row.amount), price: Number(row.price_usd),
      fee: Number(row.fee_usd), date: row.occurred_at, note: row.note,
    })),
    follows: Object.fromEntries(follows.map((row) => [row.fund_id, row.frequency])),
    followedProjects: projects.map((row) => row.project),
    savedFilters: filters.map((row) => ({
      id: row.id, name: row.name,
      filters: {
        sectors: row.sectors, types: row.types, minAmount: Number(row.min_amount),
        maxAmount: row.max_amount == null ? null : Number(row.max_amount), days: row.days, investor: row.investor, sort: row.sort,
      },
    })),
    alerts: alerts.map((row) => ({
      id: row.id, coinId: row.coin_id, type: row.type, value: Number(row.value), repeat: row.repeat,
      bypassQuiet: row.bypass_quiet, active: row.active, lastFired: ms(row.last_fired_at), created: ms(row.created_at),
    })),
    reminders: Object.fromEntries(reminders.map((row) => [row.target_id, {
      timings: row.timings, kind: row.kind, symbol: row.symbol, name: row.name, date: row.event_at,
      label: row.label, fired: row.fired, paused: row.paused,
    }])),
    notifications: notifications.map((row) => ({
      id: row.id, kind: row.kind, coinId: row.coin_id ?? undefined, title: row.title, detail: row.detail,
      path: row.path, at: ms(row.created_at), read: row.read, bypassQuiet: row.bypass_quiet,
    })),
    affiliate: affiliate ? { code: affiliate.code, payoutMethod: affiliate.payout_method, joinedAt: affiliate.joined_at } : null,
    tickets: tickets.map(ticketFromRow),
    feedback: feedback.map((row) => ({ rating: row.rating, area: row.area, text: row.body, contact: row.may_contact, date: row.created_at })),
  };
  return {
    profile,
    stored,
    snapshot: {
      recent_coins: new Map(recentCoins.map((row) => [row.coin_id, { key: row.coin_id, viewed_at: row.viewed_at }])),
      recent_searches: new Map(recentSearches.map((row) => [row.query, { key: row.query, searched_at: row.searched_at }])),
    },
  };
}

// --- Tickets and feedback: insert-only, so they're written directly, not diffed ----------

function ticketFromRow(row) {
  return {
    id: row.id, kind: row.kind, topic: row.topic, subject: row.subject, message: row.message ?? undefined,
    email: row.email ?? undefined, status: row.status, date: row.created_at, page: row.page ?? undefined,
    steps: row.steps ?? undefined, expected: row.expected ?? undefined, actual: row.actual ?? undefined,
    assistive: row.assistive_tech ?? undefined, severity: row.severity ?? undefined,
    technical: row.technical ?? undefined, screenshot: row.screenshot_url ?? undefined,
  };
}

// Sends a ticket for a signed-in user (userId) or a guest (null). Returns the saved ticket.
export async function sendTicket(userId, ticket) {
  const { data: id, error } = await supabase.rpc("next_ticket_id", { kind: ticket.kind });
  if (error) throw error;
  const row = {
    id, user_id: userId, kind: ticket.kind, topic: ticket.topic, subject: ticket.subject, message: ticket.message ?? null,
    email: ticket.email ?? null, page: ticket.page ?? null, steps: ticket.steps ?? null, expected: ticket.expected ?? null,
    actual: ticket.actual ?? null, assistive_tech: ticket.assistive ?? null, severity: ticket.severity ?? null,
    technical: ticket.technical ?? null, screenshot_url: ticket.screenshot ?? null,
  };
  await check(supabase.from("support_tickets").insert(row));
  return { ...ticket, id, status: "Received", date: new Date().toISOString() };
}

export async function sendFeedback(userId, entry) {
  await check(supabase.from("feedback").insert({
    user_id: userId, rating: entry.rating, area: entry.area, body: entry.text ?? "", may_contact: entry.contact === true,
  }));
}
