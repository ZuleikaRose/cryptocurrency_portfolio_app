import { useEffect, useState } from "react";
import Sheet from "./Sheet.jsx";
import { categories } from "../data/coins.js";
import { t } from "../lib/i18n.js";
import { useApp, useMarket } from "../state/context.js";

// First-visit onboarding (01-home.md, US-1.3): three cards, then an optional interest picker.
// Card text is English here and translated when shown.
// Cards advance every 6 s only when "Auto-advance onboarding cards" is on and motion isn't reduced.
const cards = [
  {
    title: "Markets",
    body: "Rank coins by market cap, price and momentum, and star the ones you follow.",
    art: <path d="M6 40 18 28l8 6 16-18M34 16h8v8" />,
  },
  {
    title: "Unlocks",
    body: "See when locked tokens are released, and get a reminder before big unlocks.",
    art: (
      <>
        <rect x="10" y="22" width="28" height="20" rx="3" />
        <path d="M16 22v-6a8 8 0 0 1 15-4" />
      </>
    ),
  },
  {
    title: "Fundraising",
    body: "Follow who is funding what: rounds, investors and upcoming token sales.",
    art: (
      <>
        <circle cx="24" cy="24" r="16" />
        <path d="M24 14v20M29 18c-1-2-3-3-5-3-3 0-5 2-5 4s2 3 5 4 5 2 5 4-2 4-5 4c-2 0-4-1-5-3" />
      </>
    ),
  },
];

export default function Onboarding() {
  const { onboarded, completeOnboarding, settings } = useApp();
  const { coins } = useMarket();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState({ coins: [], sectors: [] });
  const topCoins = [...coins].sort((a, b) => a.rank - b.rank).slice(0, 20);

  const toggle = (key, value) =>
    setPicks((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  const skip = () => completeOnboarding(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || settings.stopAnimations;
    if (onboarded || !settings.autoAdvance || reduced || step >= cards.length - 1) return undefined;
    const id = window.setTimeout(() => setStep((current) => Math.min(current + 1, cards.length - 1)), 6000);
    return () => window.clearTimeout(id);
  }, [onboarded, settings.autoAdvance, settings.stopAnimations, step]);
  const picking = step === cards.length;
  const card = cards[step];

  return (
    <Sheet open={!onboarded} onClose={skip} title={picking ? t("Pick what you care about") : t("Welcome to CPA")} side="bottom">
      {!picking ? (
        <div className="onboarding">
          <svg className="onboarding-art" viewBox="0 0 48 48" aria-hidden="true">{card.art}</svg>
          <h3 className="sheet-heading">{t(card.title)}</h3>
          <p className="sheet-note">{t(card.body)}</p>
          <div className="onboarding-foot">
            <span className="step-dots" role="img" aria-label={t("Step {step} of {total}", { step: step + 1, total: cards.length })}>
              {cards.map((item, index) => (
                <span key={item.title} className={index === step ? "active" : undefined} />
              ))}
            </span>
            <button className="button-tertiary muted" onClick={skip}>{t("Skip")}</button>
            <button className="button-primary compact-primary" onClick={() => setStep(step + 1)}>{t("Next")}</button>
          </div>
        </div>
      ) : (
        <div className="onboarding">
          <p className="sheet-note">{t("Coins you pick join your watchlist. Sectors shape the funding rounds on Home.")}</p>
          <fieldset className="field-group">
            <legend>{t("Coins")}</legend>
            <div className="pick-chips">
              {topCoins.map((coin) => (
                <button key={coin.id} className={picks.coins.includes(coin.id) ? "chip toggle on" : "chip toggle"} aria-pressed={picks.coins.includes(coin.id)} onClick={() => toggle("coins", coin.id)}>
                  {coin.symbol}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="field-group">
            <legend>{t("Sectors")}</legend>
            <div className="pick-chips">
              {categories.map((sector) => (
                <button key={sector} className={picks.sectors.includes(sector) ? "chip toggle on" : "chip toggle"} aria-pressed={picks.sectors.includes(sector)} onClick={() => toggle("sectors", sector)}>
                  {t(sector)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="sheet-actions">
            <button className="button-secondary" onClick={skip}>{t("Skip")}</button>
            <button className="button-primary" onClick={() => completeOnboarding(picks)} disabled={!picks.coins.length && !picks.sectors.length}>
              {t("Continue")}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
