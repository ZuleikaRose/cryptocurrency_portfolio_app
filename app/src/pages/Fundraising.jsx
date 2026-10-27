import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { ErrorBanner, SkeletonCards } from "../components/LoadState.jsx";
import InvestorStack from "../components/InvestorStack.jsx";
import Sheet from "../components/Sheet.jsx";
import { fundById, fundingRounds, funds, roundSectors, roundTypeList, TODAY } from "../data/research.js";
import { arrow, direction, formatCompact, formatDate, formatPercent, relativeTime } from "../lib/format.js";
import { useFirstLoad, usePageTitle, useSimulatedError } from "../lib/hooks.js";
import { t, tn } from "../lib/i18n.js";
import { shareCard } from "../lib/share.js";
import { normalizeFundraisingFilters, useApp } from "../state/context.js";

const DAY_MS = 86_400_000;
const dayOptions = [
  [7, "Last 7 days"],
  [30, "Last 30 days"],
  [90, "Last 90 days"],
  [0, "All time"],
];
const amountSteps = [0, 1e6, 5e6, 10e6, 25e6, 50e6];

function applyFilters(rounds, filters, now) {
  return rounds.filter((round) => {
    if (filters.days && now - round.date.getTime() > filters.days * DAY_MS) return false;
    if (filters.sectors.length && !filters.sectors.includes(round.sector)) return false;
    if (filters.types.length && !filters.types.includes(round.type)) return false;
    if (round.amount < (filters.minAmount || 0)) return false;
    if (filters.maxAmount && round.amount > filters.maxAmount) return false;
    if (filters.investor && !round.investors.includes(filters.investor)) return false;
    return true;
  });
}

function filterChips(filters) {
  const chips = [];
  filters.sectors.forEach((sector) => chips.push({ id: `s-${sector}`, label: t(sector), patch: { sectors: filters.sectors.filter((item) => item !== sector) } }));
  filters.types.forEach((type) => chips.push({ id: `t-${type}`, label: t(type), patch: { types: filters.types.filter((item) => item !== type) } }));
  if (filters.days !== 90) chips.push({ id: "days", label: filters.days ? t("Last {count} days", { count: filters.days }) : t("All time"), patch: { days: 90 } });
  if (filters.minAmount) chips.push({ id: "min", label: `≥ ${formatCompact(filters.minAmount)}`, patch: { minAmount: 0 } });
  if (filters.maxAmount) chips.push({ id: "max", label: `≤ ${formatCompact(filters.maxAmount)}`, patch: { maxAmount: null } });
  if (filters.investor) chips.push({ id: "inv", label: fundById(filters.investor)?.name ?? filters.investor, patch: { investor: "" } });
  return chips;
}

function FilterSheet({ open, onClose, filters, onApply, now }) {
  const [draft, setDraft] = useState(filters);
  const toggle = (key, value) => setDraft((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const matching = applyFilters(fundingRounds, draft, now).length;

  return (
    <Sheet open={open} onClose={onClose} title={t("Filters")} side="bottom">
      <fieldset className="field-group">
        <legend>{t("Sector")}</legend>
        <div className="chip-row">
          {roundSectors.map((sector) => (
            <button key={sector} className={draft.sectors.includes(sector) ? "chip toggle on" : "chip toggle"} aria-pressed={draft.sectors.includes(sector)} onClick={() => toggle("sectors", sector)}>
              {t(sector)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>{t("Round")}</legend>
        <div className="chip-row">
          {roundTypeList.map((type) => (
            <button key={type} className={draft.types.includes(type) ? "chip toggle on" : "chip toggle"} aria-pressed={draft.types.includes(type)} onClick={() => toggle("types", type)}>
              {t(type)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>{t("Amount")}</legend>
        <div className="custom-range">
          <label className="form-field">
            <span>{t("At least")}</span>
            <select className="select" value={draft.minAmount} onChange={(event) => setDraft({ ...draft, minAmount: Number(event.target.value) })}>
              {amountSteps.map((value) => (
                <option key={value} value={value}>{value ? formatCompact(value) : "Any"}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("At most")}</span>
            <select className="select" value={draft.maxAmount ?? 0} onChange={(event) => setDraft({ ...draft, maxAmount: Number(event.target.value) || null })}>
              {[0, ...amountSteps.slice(1), 100e6].map((value) => (
                <option key={value} value={value}>{value ? formatCompact(value) : "Any"}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>{t("Date")}</legend>
        <div className="segmented" role="group">
          {dayOptions.map(([days, label]) => (
            <button key={days} className={draft.days === days ? "segment active" : "segment"} aria-pressed={draft.days === days} onClick={() => setDraft({ ...draft, days })}>
              {days ? `${days}d` : t(label)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field-group">
        <span className="legend">{t("Investor")}</span>
        <select className="select" value={draft.investor} onChange={(event) => setDraft({ ...draft, investor: event.target.value })}>
          <option value="">{t("Any investor")}</option>
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>{fund.name}</option>
          ))}
        </select>
      </label>
      <div className="sheet-actions">
        <button className="button-secondary" onClick={() => setDraft({ sectors: [], types: [], minAmount: 0, maxAmount: null, days: 90, investor: "", sort: draft.sort })}>
          {t("Reset")}
        </button>
        <button
          className="button-primary"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {tn(matching, "Show {count} round", "Show {count} rounds")}
        </button>
      </div>
    </Sheet>
  );
}

export default function Fundraising() {
  const [params, setParams] = useSearchParams();
  const { settings, updateSettings, savedFilters, saveFilter, renameFilter, deleteFilter, followedProjects, toggleFollowProject, requireAuth, showToast } = useApp();
  const [filterOpen, setFilterOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [manage, setManage] = useState(null);
  const [roundSheet, setRoundSheet] = useState(null);
  const [name, setName] = useState("");
  const now = TODAY.getTime();
  const view = params.get("view") === "funds" ? "funds" : "rounds";
  const filters = settings.fundraising;
  const loading = useFirstLoad("fundraising");
  const [failed, retry] = useSimulatedError();
  const setFilters = (patch) => updateSettings({ fundraising: patch });

  usePageTitle(t("Fundraising"));

  const rounds = applyFilters(fundingRounds, filters, now).sort((a, b) => (filters.sort === "amount" ? b.amount - a.amount : b.date - a.date));
  const windowDays = filters.days || 90;
  const current = fundingRounds.filter((round) => now - round.date.getTime() <= windowDays * DAY_MS).reduce((sum, round) => sum + round.amount, 0);
  const previous = fundingRounds
    .filter((round) => now - round.date.getTime() > windowDays * DAY_MS && now - round.date.getTime() <= 2 * windowDays * DAY_MS)
    .reduce((sum, round) => sum + round.amount, 0);
  const change = previous ? ((current - previous) / previous) * 100 : null;
  const chips = filterChips(filters);
  const activeCount = chips.length;

  const setView = (id) => {
    const next = new URLSearchParams(params);
    if (id === "funds") next.set("view", "funds");
    else next.delete("view");
    setParams(next, { replace: true });
  };

  const onShare = async (round) => {
    const result = await shareCard({
      fileName: `cpa-${round.project.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${round.type.toLowerCase().replace(/\s+/g, "-")}`,
      title: `${round.project} · ${t(round.type)}`,
      headline: formatCompact(round.amount),
      detail: `${t(round.sector)} · ${formatDate(round.date)}${round.valuation ? ` · ${t("Val. {value}", { value: formatCompact(round.valuation) })}` : ""}`,
    });
    if (result === "downloaded") showToast(t("Share card for {name} downloaded", { name: round.project }));
    if (result === "failed") showToast(t("Couldn't create the share card in this browser."));
  };

  return (
    <div className="fundraising">
      <h1>{t("Fundraising")}</h1>
      <p className="page-sub num">
        {t("{amount} raised in the last {count} days", { amount: formatCompact(current), count: windowDays })}
        {change != null && (
          <span className={direction(change)}>
            {" "}
            {arrow(change)} {formatPercent(change)}
          </span>
        )}
      </p>

      <div className="segmented" role="group" aria-label={t("View")}>
        {[
          ["rounds", "Rounds"],
          ["funds", "Funds"],
        ].map(([id, label]) => (
          <button key={id} className={view === id ? "segment active" : "segment"} aria-pressed={view === id} onClick={() => setView(id)}>
            {t(label)}
          </button>
        ))}
      </div>

      {view === "funds" ? (
        <ul className="fund-list">
          {[...funds].sort((a, b) => a.tier - b.tier || b.deals - a.deals).map((fund) => (
            <li key={fund.id}>
              <Link to={`/funds/${fund.id}`} className="search-option">
                <span className="square-logo" aria-hidden="true">{fund.name[0]}</span>
                <span className="result-main">
                  <strong>
                    {fund.name} <span className="tag">{t("Tier {tier}", { tier: fund.tier })}</span>
                  </strong>
                  <span className="num">
                    {t("{deals} deals · {recent} in 30d · {type}", { deals: fund.deals, recent: fund.deals30d, type: t(fund.type) })}
                  </span>
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="saved-row" role="group" aria-label={t("Saved filters")}>
            {savedFilters.map((saved) => (
              <span key={saved.id} className="saved-chip">
                <button className="chip" onClick={() => updateSettings({ fundraising: normalizeFundraisingFilters({ ...saved.filters, sort: filters.sort }) })}>{saved.name}</button>
                <button className="icon-button small" onClick={() => { setManage(saved); setName(saved.name); }} aria-label={t("Rename or delete {name}", { name: saved.name })}>⋯</button>
              </span>
            ))}
            <button
              className="chip add-chip"
              onClick={() =>
                requireAuth(t("Sign in to save filters"), () => {
                  setName(chips.map((chip) => chip.label).join(" + ").slice(0, 30) || t("My filters"));
                  setSaveOpen(true);
                })
              }
            >
              + {t("Save")}
            </button>
          </div>

          <div className="list-controls">
            <button className="button-secondary compact" onClick={() => setFilterOpen(true)}>
              <Icon name="swap" /> {t("Filters")}{activeCount > 0 && <span className="count-badge num">{activeCount}</span>}
            </button>
            <label className="inline-select">
              {t("Sort")}
              <select className="select" value={filters.sort} onChange={(event) => setFilters({ sort: event.target.value })}>
                <option value="newest">{t("Newest")}</option>
                <option value="amount">{t("Amount")}</option>
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <ul className="chip-row" aria-label={t("Active filters")}>
              {chips.map((chip) => (
                <li key={chip.id}>
                  <button className="chip" onClick={() => setFilters(chip.patch)} aria-label={t("Remove filter: {label}", { label: chip.label })}>
                    {chip.label} <Icon name="close" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {failed ? (
            <ErrorBanner what={t("funding rounds")} onRetry={retry} />
          ) : loading ? (
            <SkeletonCards count={4} label={t("funding rounds")} />
          ) : (
            <>
              <p className="result-count" role="status">{tn(rounds.length, "{count} round", "{count} rounds")}</p>
              {rounds.length === 0 ? (
                <div className="empty-state">
                  <p>{t("No rounds match these filters.")}</p>
                  <button className="button-secondary" onClick={() => setFilters({ sectors: [], types: [], minAmount: 0, maxAmount: null, days: 90, investor: "" })}>
                    {t("Reset filters")}
                  </button>
                </div>
              ) : (
                <ul className="round-feed">
                  {rounds.map((round) => {
                    const following = followedProjects.includes(round.project);
                    return (
                      <li key={round.id} className="card round-card">
                        <div className="round-head">
                          <span className="square-logo" aria-hidden="true">{round.project[0]}</span>
                          {round.coinId ? (
                            <Link to={`/coins/${round.coinId}?tab=funding`} className="round-title">{round.project}</Link>
                          ) : (
                            <button className="round-title link-button" onClick={() => setRoundSheet(round)}>{round.project}</button>
                          )}
                          <span className="tag tag-fundraising">{t(round.type)}</span>
                          <span className="tag">{t(round.sector)}</span>
                        </div>
                        <p className="num">
                          <strong>{formatCompact(round.amount)}</strong> {t("raised")} · {t("Val. {value}", { value: round.valuation ? formatCompact(round.valuation) : t("undisclosed") })}
                        </p>
                        <p className="muted-line num">
                          {formatDate(round.date)} · {relativeTime(round.date.getTime(), now)}
                        </p>
                        <div className="round-foot">
                          <InvestorStack round={round} />
                          <span className="muted-inline">{t("Lead: {name}", { name: fundById(round.leads[0])?.name })}</span>
                          <span className="round-actions">
                            <button className="icon-button small" onClick={() => onShare(round)} aria-label={t("Share {project} {type} round", { project: round.project, type: t(round.type) })}>
                              <Icon name="share" />
                            </button>
                            <button className={following ? "chip toggle on" : "chip toggle"} aria-pressed={following} onClick={() => toggleFollowProject(round.project)}>
                              {following ? t("Following") : t("Follow")}
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </>
      )}

      <p className="disclaimer">{t("Not financial advice. Data provided for informational purposes.")} {t("Funding rounds are CPA sample data.")}</p>

      <FilterSheet key={filterOpen ? "open" : "closed"} open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={(next) => setFilters(next)} now={now} />

      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title={t("Save filter")} side="bottom">
        <form
          className="tx-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            const { sort: _sort, ...rest } = filters;
            if (saveFilter(name.trim().slice(0, 30), rest)) setSaveOpen(false);
          }}
        >
          <label className="form-field">
            <span>{t("Name (up to 30 characters)")}</span>
            <input className="input" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} autoFocus />
          </label>
          <button type="submit" className="button-primary" disabled={!name.trim()}>{t("Save filter")}</button>
        </form>
      </Sheet>

      <Sheet open={Boolean(manage)} onClose={() => setManage(null)} title={t("Saved filter")} side="bottom">
        {manage && (
          <form
            className="tx-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              renameFilter(manage.id, name.trim().slice(0, 30));
              setManage(null);
            }}
          >
            <label className="form-field">
              <span>{t("Name")}</span>
              <input className="input" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="submit" className="button-primary" disabled={!name.trim()}>{t("Rename")}</button>
            <button
              type="button"
              className="button-secondary button-block danger-text"
              onClick={() => {
                deleteFilter(manage.id);
                setManage(null);
              }}
            >
              {t("Delete filter")}
            </button>
          </form>
        )}
      </Sheet>

      <Sheet open={Boolean(roundSheet)} onClose={() => setRoundSheet(null)} title={roundSheet ? `${roundSheet.project} · ${t(roundSheet.type)}` : t("Round")} side="bottom">
        {roundSheet && (
          <>
            <dl className="stats">
              <div><dt>{t("Raised")}</dt><dd className="num">{formatCompact(roundSheet.amount)}</dd></div>
              <div><dt>{t("Valuation")}</dt><dd className="num">{roundSheet.valuation ? formatCompact(roundSheet.valuation) : t("Undisclosed")}</dd></div>
              <div><dt>{t("Date")}</dt><dd>{formatDate(roundSheet.date)}</dd></div>
              <div><dt>{t("Sector")}</dt><dd>{t(roundSheet.sector)}</dd></div>
            </dl>
            <h3 className="sheet-heading">{t("Investors")}</h3>
            <ul className="result-list">
              {roundSheet.investors.map((id) => (
                <li key={id}>
                  <Link to={`/funds/${id}`} className="search-option" onClick={() => setRoundSheet(null)}>
                    <span className="square-logo" aria-hidden="true">{fundById(id)?.name[0]}</span>
                    <span className="result-main">
                      <strong>{fundById(id)?.name}</strong>
                      <span>{roundSheet.leads.includes(id) ? t("Lead investor") : t("Participant")}</span>
                    </span>
                    <Icon name="chevron" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="sheet-note">{t("{project} has no token listed in CPA yet.", { project: roundSheet.project })}</p>
          </>
        )}
      </Sheet>
    </div>
  );
}
