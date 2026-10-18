// FAQ content (18-faqs.md), also searched from Customer support. Plain language, sentence
// case, and never a promise of returns.
export const faqSections = [
  {
    id: "general",
    title: "General",
    items: [
      { q: "Is CPA's data real-time?", a: "No. CPA uses a bundled sample dataset that refreshes every 30 seconds in your browser while the app is open. Prices, unlocks and funding rounds are realistic examples, not live market data." },
      { q: "Where is my data stored?", a: "With an account, your data is stored on CPA's servers, so it's there on any device you sign in on. Guest browsing and the private demo aren't stored and reset when you refresh." },
      { q: "Why didn't my alert fire?", a: "Alerts are checked only while CPA is open in a tab. Nothing fires when the tab is closed. Check the alert is switched on in Alerts → My alerts, and that quiet hours aren't holding back the banner." },
      { q: "Is this financial advice?", a: "No. CPA shows information only. Nothing in the app is a recommendation to buy, sell or hold anything." },
      { q: "How do I reset the demo?", a: "Refresh the page. The demo lives in memory only, so it starts over with the same sample watchlist, portfolio and alerts." },
      { q: "When do token unlocks matter?", a: "An unlock releases locked tokens on a schedule. CPA highlights unlocks above 2% of circulating supply, because those add the most new supply at once. See Token unlocks for dates and sizes." },
    ],
  },
  {
    id: "earn",
    title: "Earn & rewards",
    items: [
      { q: "What are CPA points?", a: "Loyalty points you earn for completing your profile, building your first watchlist, setting alerts and weekly check-ins. You can spend 500 points on a 10% Pro discount code. Points have no cash value and are not a token." },
      { q: "How do quests work?", a: "Community quests are short tasks, like setting your first unlock reminder, that award points once. They're listed on Promotions when one is running." },
      { q: "How do raffles work?", a: "Promotional raffles are free to enter. Each raffle states the number of prizes and the odds, and its terms are on the Promotions page. Raffles never require a purchase." },
      { q: "Where do I see claimed rewards?", a: "Open Settings → Subscription & billing. Applied codes and points redemptions show on your plan card and in billing history." },
    ],
  },
  {
    id: "funds",
    title: "Funds",
    items: [
      { q: "How are funds tiered?", a: "Funds are placed in Tier 1 to 5 by deal count, typical deal size and how their portfolio performed over the last 24 months. Tier 1 is the most active and established." },
      { q: "Can I track who a fund follows on social media?", a: "Fund profiles link to their social accounts. Follow lists aren't tracked in the sample data." },
      { q: "Which investor types are covered?", a: "Venture funds, angels, corporates, DAOs, launchpads and accelerators. Each fund profile shows its type." },
      { q: "How do I analyse a fund's sectors?", a: "The Top sectors bar on a fund profile shows the share of its deals in each sector. On Fundraising you can also filter rounds by sector and investor." },
    ],
  },
  {
    id: "api-plans",
    title: "API & plans",
    items: [
      { q: "Does CPA have a public API?", a: "Not yet. CPA has no public API today. The plans below are planned and may change." },
      { q: "What will the plans include?", a: "Free: rate-limited access and 1 year of history. Pro: higher credit limits, full history and alerts without caps. Team: shared watchlists and seats. Credit limits, endpoints and history depth are listed as planned." },
      { q: "How do the prices differ?", a: "Pro is $9.99 a month or $95.88 a year (the yearly plan works out to $7.99 a month). Free costs nothing. Team pricing is planned." },
      { q: "Can I cancel or pause Pro?", a: "Yes. In Settings → Subscription & billing you can change your billing date, pause for 1 to 3 months, or cancel. Billing in CPA is simulated, so no money is charged." },
    ],
  },
];

export const planTable = [
  { feature: "API credits / month", free: "Planned: 10K", pro: "Planned: 500K", team: "Planned: 2M" },
  { feature: "Price history", free: "1 year", pro: "Full", team: "Full" },
  { feature: "Price alerts", free: "Up to 5", pro: "No cap", team: "No cap" },
  { feature: "Price", free: "$0", pro: "$9.99 / month", team: "Planned" },
];

// Short learn articles (Explore → Learn and Home tips) included in help search.
export const learnArticles = [
  { q: "Market cap vs FDV", a: "Market cap is price × the tokens trading today; FDV is price × every token that will ever exist.", to: "/explore" },
  { q: "How to read a vesting chart", a: "Each band is a group (team, investors, ecosystem) and how many of its tokens have unlocked over time.", to: "/explore" },
  { q: "Why prices are signed with ▲ and ▼", a: "Colour alone can't be relied on, so every change also carries an arrow and a + or − sign.", to: "/explore" },
];

export const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function searchHelp(query) {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const faq = faqSections.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.title, to: `/faqs?q=${encodeURIComponent(query.trim())}#${section.id}` })),
  );
  return [...faq, ...learnArticles.map((item) => ({ ...item, section: "Learn" }))].filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(term));
}
