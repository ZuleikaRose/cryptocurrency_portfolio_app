// Single source of truth for every page: drives the router, the bottom nav,
// the header menu and the footer.

export const tabs = [
  { path: "/", label: "Home", icon: "home" },
  { path: "/market", label: "Market", icon: "chart" },
  { path: "/explore", label: "Explore", icon: "compass" },
  { path: "/fundraising", label: "Funding", icon: "coins", title: "Fundraising" },
  { path: "/unlocks", label: "Unlocks", icon: "calendarLock" },
  { path: "/watchlist", label: "Watchlist", icon: "star" },
  { path: "/portfolio", label: "Portfolio", icon: "user" },
];

export const pages = [
  { path: "/", title: "Home", doc: "01-home.md" },
  { path: "/market", title: "Market", doc: "02-market.md" },
  { path: "/coins/:slug", title: "Coin detail", doc: "03-coin-detail.md", sample: "/coins/bitcoin" },
  { path: "/search", title: "Search", doc: "04-search.md" },
  { path: "/explore", title: "Explore", doc: "05-explore.md" },
  { path: "/fundraising", title: "Fundraising", doc: "06-fundraising.md" },
  { path: "/funds/:slug", title: "Fund profile", doc: "07-fund-profile.md", sample: "/funds/northstar-capital" },
  { path: "/unlocks", title: "Token unlocks", doc: "08-unlocks.md" },
  { path: "/token-sales", title: "Token sales", doc: "09-token-sales.md", group: "explore" },
  { path: "/watchlist", title: "Watchlist", doc: "10-watchlist.md" },
  { path: "/portfolio/:slug", title: "Holding", doc: "11-portfolio.md" },
  { path: "/portfolio", title: "Portfolio", doc: "11-portfolio.md" },
  { path: "/alerts", title: "Alerts", doc: "12-alerts.md", group: "account" },
  { path: "/login", title: "Log in or sign up", doc: "13-login-signup.md", group: "account" },
  { path: "/signup", title: "Log in or sign up", doc: "13-login-signup.md" },
  { path: "/forgot-password", title: "Forgot password", doc: "14-forgot-reset-password.md" },
  { path: "/reset-password", title: "Reset password", doc: "14-forgot-reset-password.md" },
  { path: "/logout", title: "Log out", doc: "15-logout.md" },
  { path: "/settings", title: "Account settings", doc: "16-account-settings.md", group: "account" },
  { path: "/support", title: "Customer support", doc: "17-customer-support.md", group: "help" },
  { path: "/faqs", title: "FAQs", doc: "18-faqs.md", group: "help" },
  { path: "/report-issue", title: "Report an issue", doc: "19-report-issue.md", group: "help" },
  { path: "/feedback", title: "Send feedback", doc: "20-feedback.md", group: "help" },
  { path: "/promotions", title: "Promotions", doc: "21-promotions.md", group: "info" },
  { path: "/affiliate", title: "Affiliate program", doc: "28-affiliate-program.md", group: "info" },
  { path: "/technical-requirements", title: "Technical requirements", doc: "22-technical-requirements.md", group: "info" },
  { path: "/ai", title: "AI features", doc: "25-ai-integration.md", group: "info" },
  { path: "/terms", title: "Terms of service", doc: "23-terms-of-service.md", group: "legal" },
  { path: "/privacy", title: "Privacy policy", doc: "24-privacy-policy.md", group: "legal" },
  { path: "/accessibility-policy", title: "Accessibility policy", doc: "26-accessibility-policy.md", group: "legal" },
];

export const menuGroups = [
  { id: "explore", title: "Research" },
  { id: "account", title: "Account" },
  { id: "help", title: "Help" },
  { id: "info", title: "About CPA" },
  { id: "legal", title: "Legal" },
];

export const pagesInGroup = (group) => pages.filter((page) => page.group === group);
