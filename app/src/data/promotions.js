import { TODAY } from "./research.js";

// Promotions (21-promotions.md). Dates are fixed so "Ends" reads the same for everyone.
export const promotions = [
  {
    code: "AUTUMN20",
    title: "20% off CPA Pro yearly",
    plan: "pro-yearly",
    percentOff: 20,
    detail: "$95.88 → $76.70 for the first year",
    ends: "2026-10-31T23:59:59",
    terms: "For CPA Pro yearly. One use per account. The discount applies to the first year only and can't be combined with other codes.",
  },
  {
    code: "FIRSTPRO",
    title: "First month of Pro for $1.00",
    plan: "pro-monthly",
    fixedPrice: 1,
    detail: "New accounts only",
    newAccountsOnly: true,
    ends: "2026-12-31T23:59:59",
    terms: "For accounts created in the last 30 days. Applies to the first month of CPA Pro monthly, then $9.99 a month. One use per account.",
  },
  {
    code: "SUMMER15",
    title: "Summer 15% off",
    plan: "pro-monthly",
    percentOff: 15,
    ends: "2026-08-31T23:59:59",
    terms: "Ended.",
  },
];

// Points redemption (FAQ: CPA points). 500 points → 10% off any Pro plan.
export const POINTS_PROMO = { code: "POINTS10", title: "10% off with 500 points", plan: null, percentOff: 10, cost: 500 };

export const promoStatus = (promo, now = TODAY) => (new Date(promo.ends) >= now ? "active" : "ended");
export const findPromo = (code) => [...promotions, POINTS_PROMO].find((promo) => promo.code === code.trim().toUpperCase());

// Price after a promo for a plan, or null if the promo doesn't apply to it.
export function discountedPrice(promo, plan) {
  if (!promo || !plan?.price || (promo.plan && promo.plan !== plan.id)) return null;
  if (promo.fixedPrice != null) return promo.fixedPrice;
  return Math.round(plan.price * (1 - promo.percentOff / 100) * 100) / 100;
}

// Points earned from things the user has done (shown as sample loyalty points).
export function pointsFor(data, session) {
  if (session.kind === "guest") return 0;
  const earned = 200 + (data.watchlist.length ? 100 : 0) + Math.min(data.alerts.length, 5) * 50 + Math.min(data.visits, 10) * 25;
  return Math.max(0, earned - data.pointsSpent);
}
