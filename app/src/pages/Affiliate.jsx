import { useState } from "react";
import Disclosure from "../components/Disclosure.jsx";
import { seeded } from "../data/research.js";
import { copyText, downloadText } from "../lib/clipboard.js";
import { formatDate, formatPrice } from "../lib/format.js";
import { t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";
import { usePageTitle } from "../lib/hooks.js";

// Approved copy blocks: no hype, always with the disclaimer.
const copyBlocks = [
  "I track coins, token unlocks and funding rounds in CPA. Clear numbers, plain language. Try it: {link}. Not financial advice.",
  "CPA puts upcoming token unlocks and new funding rounds on one calendar. I use it to stay informed: {link}. Not financial advice.",
];
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#8b7cf8"/><text x="128" y="170" font-family="Inter, Arial, sans-serif" font-size="140" font-weight="700" text-anchor="middle" fill="#0b0c10">C</text></svg>`;
const bannerSvg = (link) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0b0c10"/><rect x="80" y="80" width="120" height="120" rx="28" fill="#8b7cf8"/><text x="140" y="170" font-family="Inter, Arial, sans-serif" font-size="80" font-weight="700" text-anchor="middle" fill="#0b0c10">C</text><text x="80" y="330" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="700" fill="#f4f5f8">${t("Coins, unlocks and funding in one place.")}</text><text x="80" y="410" font-family="Inter, Arial, sans-serif" font-size="36" fill="#8a909c">${link}</text><text x="80" y="560" font-family="Inter, Arial, sans-serif" font-size="26" fill="#8a909c">${t("Not financial advice.")}</text></svg>`;

// Simulated, deterministic stats from the referral code (28-affiliate-program.md).
function statsFor(code) {
  const random = seeded(`affiliate:${code}`);
  const clicks = 60 + Math.floor(random() * 140);
  const signups = Math.max(1, Math.floor(clicks * (0.04 + random() * 0.05)));
  return { clicks, signups, earned: Math.round(signups * 95.88 * 0.2 * 100) / 100 };
}
function nextPayout(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), 15, 12);
  return date > now ? date : new Date(now.getFullYear(), now.getMonth() + 1, 15, 12);
}

export default function Affiliate() {
  const { session, affiliate, requireAuth, joinAffiliate, setAffiliatePayout } = useApp();
  const [agree, setAgree] = useState({ age: false, terms: false });
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");

  usePageTitle(t("Affiliate program"));

  const link = affiliate ? `cpa.app/r/${affiliate.code}` : "";
  const stats = affiliate ? statsFor(affiliate.code) : null;

  const join = () =>
    requireAuth(t("Sign in to join the affiliate program"), () => {
      if (!agree.age || !agree.terms) {
        setError(t("Confirm you're 18 or older and accept the affiliate terms."));
        return;
      }
      setError(null);
      joinAffiliate("paypal");
    });
  const copy = async (text, label) => setStatus((await copyText(text)) ? t("{label} copied", { label: t(label) }) : t("Couldn't copy. Select the text and copy it instead."));
  const download = (name, text, type) => setStatus(downloadText(name, text, type) ? t("{name} downloaded", { name }) : t("Couldn't start the download in this browser."));

  return (
    <div className="info-page">
      <h1>{t("Affiliate program")}</h1>
      <p className="page-sub">{t("Earn 20% of the first year of CPA Pro subscriptions you refer.")}</p>
      <p className="visually-hidden" role="status" aria-live="polite">{status}</p>

      {!affiliate ? (
        <div className="card affiliate-join">
          <label className="check-row">
            <input type="checkbox" checked={agree.age} onChange={(event) => setAgree({ ...agree, age: event.target.checked })} />
            {t("I'm 18 or older")}
          </label>
          <label className="check-row">
            <input type="checkbox" checked={agree.terms} onChange={(event) => setAgree({ ...agree, terms: event.target.checked })} />
            {t("I accept the affiliate terms below")}
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button-primary" onClick={join}>{t("Join the program")}</button>
          {session.kind === "guest" && <p className="muted-line">{t("You'll be asked to sign in first.")}</p>}
        </div>
      ) : (
        <section aria-labelledby="dashboard-title" className="card affiliate-dashboard">
          <h2 id="dashboard-title">{t("Your dashboard")}</h2>
          <div className="promo-code-row">
            <span>{t("Link")}</span>
            <code className="mono">{link}</code>
            <button className="button-secondary compact" onClick={() => copy(`https://${link}`, "Link")}>{t("Copy")}</button>
          </div>
          <dl className="stat-tiles">
            <div><dd className="num">{stats.clicks}</dd><dt>{t("clicks")}</dt></div>
            <div><dd className="num">{stats.signups}</dd><dt>{t("sign-ups")}</dt></div>
            <div><dd className="num">{formatPrice(stats.earned)}</dd><dt>{t("earned")}</dt></div>
          </dl>
          <label className="form-field">
            <span>{t("Payout method")}</span>
            <select className="input" value={affiliate.payoutMethod} onChange={(event) => setAffiliatePayout(event.target.value)}>
              <option value="paypal">{t("PayPal (simulated)")}</option>
              <option value="bank">{t("Bank transfer (simulated)")}</option>
            </select>
          </label>
          <p className="muted-line num">{t("Next payout {date} · min {min} · stats are simulated", { date: formatDate(nextPayout()), min: formatPrice(50) })}</p>
        </section>
      )}

      <section aria-labelledby="how-title" className="info-section">
        <h2 id="how-title">{t("How it works")}</h2>
        <ol className="steps">
          <li><strong>{t("Join")}</strong> {t("with your CPA account.")}</li>
          <li><strong>{t("Share your link")}</strong> {t("with your audience.")}</li>
          <li><strong>{t("Earn")}</strong> {t("20% of first-year Pro revenue from people who subscribe within 30 days of clicking.")}</li>
        </ol>
      </section>

      <section aria-labelledby="materials-title" className="info-section">
        <h2 id="materials-title">{t("Marketing materials")}</h2>
        <div className="button-row wrap">
          <button className="button-secondary compact" onClick={() => download("cpa-logo.svg", logoSvg, "image/svg+xml")}>{t("Logo pack")}</button>
          <button className="button-secondary compact" onClick={() => download("cpa-banner-1200x630.svg", bannerSvg(link || "cpa.app"), "image/svg+xml")}>{t("Banner 1200×630")}</button>
        </div>
        <Disclosure title={t("Copy blocks")}>
          {copyBlocks.map((block) => {
            const text = t(block, { link: link ? `https://${link}` : t("your link") });
            return (
              <div key={block} className="copy-block">
                <p>{text}</p>
                <button className="button-secondary compact" onClick={() => copy(text, "Copy block")}>{t("Copy")}</button>
              </div>
            );
          })}
        </Disclosure>
      </section>

      <section aria-labelledby="tips-title" className="info-section">
        <h2 id="tips-title">{t("Tips")}</h2>
        <Disclosure title={t("Driving traffic")}>
          <p>{t("Share CPA where it genuinely helps: a post about an upcoming unlock, a thread on a funding round. Explain what you use it for rather than promising results.")}</p>
        </Disclosure>
        <Disclosure title={t("Tracking referrals")}>
          <p>{t("Clicks and sign-ups update on your dashboard. A referral counts when someone subscribes to Pro within 30 days of clicking your link.")}</p>
        </Disclosure>
      </section>

      <section aria-labelledby="terms-title" className="info-section">
        <h2 id="terms-title">{t("Terms")}</h2>
        <Disclosure title={t("Eligibility")}><p>{t("You must be 18 or older with a CPA account in good standing.")}</p></Disclosure>
        <Disclosure title={t("Commission")}><p>{t("20% of first-year subscription revenue from referred Pro subscribers. Attribution lasts 30 days from the click.")}</p></Disclosure>
        <Disclosure title={t("Payments")}><p>{t("Paid on the 15th of each month by PayPal or bank transfer (simulated) once you've earned at least $50.00.")}</p></Disclosure>
        <Disclosure title={t("Restrictions")}>
          <p>{t("No paid search on \"CPA\" brand terms, no promising returns, no spam and no misleading claims. Every post must say \"Not financial advice.\" Breaking these rules voids commission.")}</p>
        </Disclosure>
      </section>
      <p className="disclaimer">{t("Not financial advice. Affiliate stats in this build are simulated.")}</p>
    </div>
  );
}
