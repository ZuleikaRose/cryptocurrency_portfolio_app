import { Link } from "react-router-dom";
import DocPage from "../components/DocPage.jsx";
import { shortcuts } from "../data/shortcuts.js";
import { getLanguage, t } from "../lib/i18n.js";

// Text stays English here and is translated at render; section titles are translated by DocPage.
const paragraphs = (...lines) => lines.map((line) => <p key={line}>{t(line)}</p>);

// Shown above translated legal text only.
const TranslationNote = () =>
  getLanguage() === "en" ? null : <p className="muted-line" role="note">{t("This translation is provided for convenience; the English version prevails.")}</p>;

// Terms of service (23-terms-of-service.md). Placeholder text, marked as a draft.
export default function Terms() {
  const sections = [
    { id: "who-we-are", title: "Who we are", body: paragraphs("CPA (Cryptocurrency Portfolio App) helps you follow coins, token unlocks, funding rounds and your own portfolio. These terms apply whenever you use CPA.") },
    { id: "eligibility", title: "Eligibility", body: paragraphs("You must be 18 or older to create an account, subscribe or join the affiliate program.") },
    { id: "using-cpa", title: "Using CPA", body: paragraphs("You may browse CPA without an account. Some features, such as alerts and a saved portfolio, need an account or the private demo.") },
    { id: "accounts", title: "Accounts and security", body: paragraphs("Your account and its data are stored on CPA's servers, hosted by Supabase. Sign-in and passwords are handled by Supabase Auth; CPA never sees or stores your password. Use a password you don't use anywhere else.") },
    { id: "subscriptions", title: "Subscriptions, billing changes and refunds", body: paragraphs("CPA Pro costs $9.99 a month or $95.88 a year. You can change your billing date, pause for up to 3 months, or cancel at any time in Settings. After cancelling you keep Pro until the end of the period you paid for. Billing in this version is simulated; no money is charged.") },
    { id: "promotions", title: "Promotions and points", body: paragraphs("Promo codes are one use per account and can't be combined. CPA points have no cash value, can't be transferred and are not a token.") },
    { id: "affiliates", title: "Affiliate program", body: <p>{t("Affiliates follow the separate")} <Link to="/affiliate">{t("affiliate terms")}</Link>{t(", including the ban on promising returns.")}</p> },
    { id: "not-advice", title: "Not financial advice", body: paragraphs("CPA shows information only. Nothing in the app is a recommendation to buy, sell or hold any asset. Generated summaries describe data; they don't give advice.") },
    { id: "accuracy", title: "Data accuracy", body: paragraphs("Prices, unlocks and funding rounds in this version are sample data. Data may be delayed, incomplete or wrong. Check important information with the original source.") },
    { id: "acceptable-use", title: "Acceptable use", body: paragraphs("Don't misuse CPA: no attempts to break it, scrape it at scale, or use it to mislead others.") },
    { id: "ip", title: "Intellectual property", body: paragraphs("The CPA name, logo and app design belong to CPA. Coin names and logos belong to their owners.") },
    { id: "deletion", title: "Account deletion and data removal", body: <p>{t("You can delete your account in Settings once any subscription is cancelled. Deleting removes access; to remove your data too,")} <Link to="/login">{t("log in")}</Link> {t("to the deleted account and choose Remove my data.")} <Link to="/support">{t("Customer support")}</Link> {t("can also help.")}</p> },
    { id: "liability", title: "Limitation of liability", body: paragraphs("CPA is provided as is. To the extent the law allows, CPA isn't liable for losses that come from relying on information in the app.") },
    { id: "changes", title: "Changes to these terms", body: paragraphs("We'll show the new date at the top when these terms change. Continuing to use CPA means you accept the updated terms.") },
    { id: "contact", title: "Contact", body: <p>{t("Questions? Use")} <Link to="/support">{t("Customer support")}</Link>.</p> },
  ];
  return <DocPage title="Terms of service" draft intro={<TranslationNote />} sections={sections} />;
}

// Every key CPA writes in the browser (00-app-shell.md persistence model). Account data
// lives in the database, not in these keys.
const storageKeys = [
  ["cpa:v1:auth", "Your sign-in session for this browser, set by Supabase Auth and removed when you log out"],
  ["cpa:v1:probe", "Written and deleted at once by the setup check"],
];

export function Privacy() {
  const collected = [
    ["Name and email (passwords are handled by Supabase Auth)", "Your account", "CPA servers"],
    ["Plan and simulated billing: card brand, last 4 digits, expiry", "Subscription", "Your account"],
    ["Watchlists and starred coins", "Tracking coins", "Your account"],
    ["Portfolio transactions", "Portfolio and P&L", "Your account"],
    ["Alerts, reminders, notifications, follows", "Alerts", "Your account"],
    ["Recently viewed coins", "Home and Search", "Your account"],
    ["Coin sentiment votes", "One vote a day", "Your account"],
    ["Search queries and saved filters", "Recent searches", "Your account"],
    ["Settings and accessibility preferences", "Your experience", "Your account"],
    ["Feedback, tickets and bug reports (with optional screenshot)", "Support", "Your account"],
    ["Promo codes, points and affiliate link", "Promotions", "Your account"],
    ["Visit count", "Feedback prompt timing", "Your account"],
    ["Device info for the setup check and bug reports", "Troubleshooting", "Not stored, unless you include it in a report"],
    ["Usage analytics (off by default)", "Improving CPA", "This browser only"],
  ];
  const sections = [
    {
      id: "what-we-collect",
      title: "What we collect",
      body: (
        <table className="data-table">
          <thead><tr><th scope="col">{t("Data")}</th><th scope="col">{t("Why")}</th><th scope="col">{t("Where")}</th></tr></thead>
          <tbody>
            {collected.map(([data, why, where]) => (
              <tr key={data}><th scope="row">{t(data)}</th><td>{t(why)}</td><td>{t(where)}</td></tr>
            ))}
          </tbody>
        </table>
      ),
    },
    { id: "permissions", title: "Permissions", body: paragraphs("Notifications: asked only when you set your first alert or reminder, after an explanation. Local storage: to keep you signed in on this browser. Clipboard: only when you tap Copy.") },
    {
      id: "your-choices",
      title: "Your choices",
      body: (
        <ul className="plain-list bullets">
          <li><Link to="/settings#privacy">{t("Clear browsing history or recent searches")}</Link></li>
          <li><Link to="/settings#privacy">{t("Export your data as JSON")}</Link></li>
          <li><Link to="/settings#privacy">{t("Turn usage analytics on or off")}</Link></li>
          <li><Link to="/settings#danger-zone">{t("Delete your account")}</Link></li>
          <li><Link to="/login">{t("Remove your data")}</Link> {t("after deleting your account: log in to it and choose Remove my data")}</li>
        </ul>
      ),
    },
    {
      id: "storage",
      title: "Cookies and storage",
      body: (
        <>
          <p>{t("CPA uses no cookies and no third-party trackers. It stores these keys in your browser's local storage:")}</p>
          <table className="data-table">
            <thead><tr><th scope="col">{t("Key")}</th><th scope="col">{t("Purpose")}</th></tr></thead>
            <tbody>
              {storageKeys.map(([key, purpose]) => (
                <tr key={key}><th scope="row" className="mono">{key}</th><td>{t(purpose)}</td></tr>
              ))}
            </tbody>
          </table>
          <p>{t("The private demo and guest browsing store nothing. Tickets and feedback you send as a guest are kept with Support.")}</p>
        </>
      ),
    },
    { id: "retention", title: "Retention", body: paragraphs("Your data stays in your account until you clear it in Settings, or delete your account and then remove its data. Removing data is permanent; the support log keeps only the ticket id, topic, date and status.") },
    { id: "children", title: "Children", body: paragraphs("CPA is for people aged 18 and over.") },
    { id: "changes", title: "Changes", body: paragraphs("We'll update the date at the top when this policy changes.") },
    { id: "contact", title: "Contact", body: <p>{t("Questions about privacy? Use")} <Link to="/support">{t("Customer support")}</Link>.</p> },
  ];
  const intro = (
    <>
      <TranslationNote />
      <div className="card in-short">
        <h2>{t("In short")}</h2>
        <ul className="plain-list bullets">
          <li>{t("Your data is stored with your account on CPA's servers.")}</li>
          <li>{t("We don't sell personal data.")}</li>
          <li>{t("The demo stores nothing.")}</li>
          <li>{t("Delete or export anytime in Settings.")}</li>
        </ul>
      </div>
    </>
  );
  return <DocPage title="Privacy policy" draft intro={intro} sections={sections} />;
}

export function AccessibilityPolicy() {
  const sections = [
    {
      id: "commitment",
      title: "Our commitment",
      body: (
        <>
          <p>{t("CPA aims to meet WCAG 2.2 level AA. We test with NVDA, JAWS, VoiceOver, TalkBack and keyboard only.")}</p>
          <ul className="plain-list bullets">
            <li>{t("Text contrast at least 4.5:1 (3:1 for large text and icons).")}</li>
            <li>{t("Touch targets at least 44×44 px.")}</li>
            <li>{t("Focus is never hidden behind the sticky header or bottom navigation.")}</li>
            <li>{t("No drag-only actions: reordering the watchlist also has up and down buttons.")}</li>
            <li>{t("Help is always in the same place: Support in the menu and footer.")}</li>
            <li>{t("Sign-in allows pasting, has show-password, and has no puzzles or memory tests.")}</li>
            <li>{t("You're never asked for the same information twice in one flow.")}</li>
          </ul>
        </>
      ),
    },
    {
      id: "features",
      title: "Accessibility features",
      body: (
        <ul className="plain-list bullets">
          <li>{t("Accessibility menu: the ♿ button in the header, or Alt+A.")}</li>
          <li>{t("Chart text summaries with adjustable size.")}</li>
          <li>{t("Full keyboard access and visible focus.")}</li>
          <li>{t("Control of auto-refresh and animations.")}</li>
          <li>{t("Colour is never the only signal: ▲ ▼ and + − signs.")}</li>
          <li>{t("Up/down colour options, including a colour-blind safe pair.")}</li>
          <li>{t("Text up to 200% without losing content.")}</li>
        </ul>
      ),
    },
    {
      id: "shortcuts",
      title: "Keyboard shortcuts",
      body: (
        <table className="data-table">
          <thead><tr><th scope="col">{t("Keys")}</th><th scope="col">{t("Action")}</th></tr></thead>
          <tbody>
            {shortcuts.map((item) => (
              <tr key={item.keys}><th scope="row"><kbd>{item.keys}</kbd></th><td>{t(item.action)}</td></tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: (
        <ul className="plain-list bullets">
          <li>{t("The chart crosshair is pointer-first. A text summary and arrow-key reading are provided.")}</li>
          <li>{t("Generated share images have alt text, but the text inside the image can't be selected.")}</li>
        </ul>
      ),
    },
    {
      id: "report",
      title: "Report a barrier",
      body: (
        <>
          <p>{t("Tell us what got in your way. We aim to reply within 5 business days.")}</p>
          <Link to="/report-issue?type=accessibility" className="button-primary">{t("Report an accessibility issue")}</Link>
        </>
      ),
    },
  ];
  return <DocPage title="Accessibility policy" dateLabel="Last reviewed" intro={<TranslationNote />} sections={sections} />;
}
