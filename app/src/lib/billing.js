// Simulated subscription and payment methods (16-account-settings.md). No charges are made;
// only brand, last 4 and expiry of a card are kept — never the full number or CVC.

export const plans = [
  { id: "free", label: "Free", price: 0, period: null },
  { id: "pro-monthly", label: "Pro monthly", price: 9.99, period: "month" },
  { id: "pro-yearly", label: "Pro yearly", price: 95.88, period: "year" },
];
export const planById = (id) => plans.find((plan) => plan.id === id) ?? plans[0];

export const emptyBilling = { plan: "free", status: "active", billingDay: null, nextBilling: null, pausedUntil: null, cancelsOn: null, history: [], methods: [], promo: null };

const iso = (date) => date.toISOString();
const atNoon = (date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
};
export function addMonths(date, months) {
  const copy = new Date(date);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  copy.setDate(Math.min(day, new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate()));
  return copy;
}
// Next date (after `from`) that falls on `day` of the month.
export function nextOnDay(day, from = new Date()) {
  const candidate = atNoon(from);
  candidate.setDate(day);
  return candidate > from ? candidate : addMonths(candidate, 1);
}

export function normalizeBilling(value) {
  const v = value && typeof value === "object" ? value : {};
  const methods = Array.isArray(v.methods) ? v.methods.filter((m) => m && typeof m.id === "string" && (m.type === "card" || m.type === "paypal")) : [];
  return {
    ...emptyBilling,
    plan: plans.some((plan) => plan.id === v.plan) ? v.plan : "free",
    status: ["active", "paused", "cancelled"].includes(v.status) ? v.status : "active",
    billingDay: Number.isInteger(v.billingDay) && v.billingDay >= 1 && v.billingDay <= 28 ? v.billingDay : null,
    nextBilling: typeof v.nextBilling === "string" ? v.nextBilling : null,
    pausedUntil: typeof v.pausedUntil === "string" ? v.pausedUntil : null,
    cancelsOn: typeof v.cancelsOn === "string" ? v.cancelsOn : null,
    history: Array.isArray(v.history) ? v.history.filter((h) => h && typeof h.date === "string" && Number.isFinite(h.amount)) : [],
    methods,
    promo: v.promo && typeof v.promo.code === "string" ? { code: v.promo.code, appliedAt: String(v.promo.appliedAt ?? "") } : null,
  };
}

// A cancelled paid plan drops to Free once its period ends.
export function settleBilling(billing, now = new Date()) {
  if (billing.status === "cancelled" && billing.cancelsOn && new Date(billing.cancelsOn) <= now) {
    return { ...billing, plan: "free", status: "active", cancelsOn: null, nextBilling: null, billingDay: null };
  }
  if (billing.status === "paused" && billing.pausedUntil && new Date(billing.pausedUntil) <= now) {
    return { ...billing, status: "active", pausedUntil: null };
  }
  return billing;
}

export const isPaid = (billing) => billing.plan !== "free";
// Delete account needs a cancelled subscription (Free counts as cancelled).
export const blocksDeletion = (billing) => isPaid(billing) && billing.status !== "cancelled";

// `price` overrides the first charge (an applied promo); later periods bill the full price.
export function subscribe(billing, planId, now = new Date(), price = null) {
  const plan = planById(planId);
  const day = Math.min(now.getDate(), 28);
  const next = plan.period === "year" ? addMonths(atNoon(now), 12) : nextOnDay(day, now);
  return {
    ...billing,
    plan: plan.id,
    status: "active",
    billingDay: day,
    nextBilling: iso(next),
    pausedUntil: null,
    cancelsOn: null,
    history: [{ date: iso(now), amount: price ?? plan.price, description: price != null && billing.promo ? `${plan.label} · ${billing.promo.code}` : plan.label, status: "Paid" }, ...billing.history],
  };
}

export const changeBillingDay = (billing, day, now = new Date()) => ({ ...billing, billingDay: day, nextBilling: iso(nextOnDay(day, now)) });

export function pause(billing, months, now = new Date()) {
  const until = addMonths(atNoon(now), months);
  return { ...billing, status: "paused", pausedUntil: iso(until), nextBilling: iso(nextOnDay(billing.billingDay ?? 1, until)) };
}

export const resume = (billing, now = new Date()) => ({
  ...billing,
  status: "active",
  pausedUntil: null,
  cancelsOn: null,
  nextBilling: billing.nextBilling && new Date(billing.nextBilling) > now ? billing.nextBilling : iso(nextOnDay(billing.billingDay ?? 1, now)),
});

export const cancel = (billing) => ({ ...billing, status: "cancelled", cancelsOn: billing.nextBilling ?? billing.pausedUntil, pausedUntil: null });

// --- Payment methods: test card numbers only ---
export const testCards = {
  "4242424242424242": "Visa",
  "4000056655665556": "Visa",
  "5555555555554444": "Mastercard",
  "2223003122003222": "Mastercard",
  "378282246310005": "American Express",
  "6011111111111117": "Discover",
};

export function luhnValid(digits) {
  let sum = 0;
  [...digits].reverse().forEach((char, index) => {
    let n = Number(char);
    if (index % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  });
  return digits.length >= 12 && sum % 10 === 0;
}

// Returns { errors: {field: message}, method? }. The full number and CVC are dropped here.
export function validateCard({ number, expiry, cvc, name }, now = new Date()) {
  const digits = number.replace(/\D/g, "");
  const errors = {};
  if (!name.trim()) errors.name = "Enter the name on the card.";
  if (!luhnValid(digits)) errors.number = "Enter a valid card number.";
  else if (!testCards[digits]) errors.number = "Only test cards work here, for example 4242 4242 4242 4242.";
  const match = expiry.trim().match(/^(\d{1,2})\s*\/\s*(\d{2})$/);
  const month = match ? Number(match[1]) : 0;
  const year = match ? 2000 + Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) errors.expiry = "Enter the expiry as MM/YY.";
  else if (new Date(year, month, 1) <= now) errors.expiry = "This card has expired.";
  const cvcLength = testCards[digits] === "American Express" ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(cvc.trim())) errors.cvc = `Enter the ${cvcLength}-digit security code.`;
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    method: { type: "card", brand: testCards[digits], last4: digits.slice(-4), exp: `${String(month).padStart(2, "0")}/${String(year).slice(-2)}` },
  };
}
