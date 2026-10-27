import { useId, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import Sheet from "./Sheet.jsx";
import { profiles, resetPatch, toggleProfile } from "../lib/a11y.js";
import { formatNumber } from "../lib/format.js";
import { languages, t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";

function Stepper({ label, value, display, min, max, step, onChange }) {
  const id = useId();
  const round = (n) => Math.round(n * 100) / 100;
  return (
    <div className="a11y-row">
      <span id={id}>{t(label)}</span>
      <span className="stepper" role="group" aria-labelledby={id}>
        <button type="button" className="icon-button small" onClick={() => onChange(round(Math.max(min, value - step)))} aria-disabled={value <= min} aria-label={t("Decrease {name}", { name: t(label).toLowerCase() })}>−</button>
        <output className="num" aria-hidden="true">{display}</output>
        <button type="button" className="icon-button small" onClick={() => onChange(round(Math.min(max, value + step)))} aria-disabled={value >= max} aria-label={t("Increase {name}", { name: t(label).toLowerCase() })}>+</button>
      </span>
    </div>
  );
}

function Choice({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="a11y-row stacked">
      <span id={id}>{t(label)}</span>
      <div className="segmented wrap" role="group" aria-labelledby={id}>
        {options.map(([optionId, text]) => (
          <button key={optionId} type="button" className={value === optionId ? "segment active" : "segment"} aria-pressed={value === optionId} onClick={() => onChange(optionId, t(text))}>
            {t(text)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ label, hint, checked, onChange }) {
  return (
    <label className="a11y-row switch-row">
      <span className="setting-label">
        {t(label)}
        {hint && <small>{t(hint)}</small>}
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch-track" aria-hidden="true" />
      </span>
    </label>
  );
}

// OneTap-style accessibility menu (27-accessibility-menu.md). Every change applies at once
// and is announced through a polite live region.
export default function AccessibilityMenu({ open, onClose, onShowShortcuts }) {
  const { session, settings, updateSettings, showToast } = useApp();
  const [status, setStatus] = useState("");
  const a11y = settings.a11y;

  const setA11y = (patch, message) => {
    updateSettings({ a11y: patch });
    setStatus(message);
  };
  const setApp = (patch, message) => {
    updateSettings(patch);
    setStatus(message);
  };
  const onOff = (value) => (value ? t("on") : t("off"));

  return (
    <Sheet open={open} onClose={onClose} title={t("Accessibility")} side="right">
      <div className="a11y-menu">
        <div className="a11y-top">
          {session.kind !== "user" && <p className="muted-line">{t("Sign in to keep these settings.")}</p>}
          <button
            type="button"
            className="button-secondary compact"
            onClick={() => {
              updateSettings(resetPatch());
              setStatus(t("Accessibility settings reset"));
              showToast(t("Accessibility settings reset."));
            }}
          >
            {t("Reset")}
          </button>
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">{status}</p>

        {/* Language (clarification 30): names in their own language, so either is findable. */}
        <section aria-labelledby="a11y-language">
          <h3 id="a11y-language">{t("Language")}</h3>
          <div className="segmented wrap" role="group" aria-labelledby="a11y-language">
            {languages.map((language) => (
              <button
                key={language.id}
                type="button"
                lang={language.id}
                className={settings.language === language.id ? "segment active" : "segment"}
                aria-pressed={settings.language === language.id}
                onClick={() => setApp({ language: language.id }, language.label)}
              >
                {language.label}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="a11y-profiles">
          <h3 id="a11y-profiles">{t("Profiles")}</h3>
          <div className="profile-grid">
            {profiles.map((profile) => {
              const active = a11y.profiles.includes(profile.id);
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={active ? "profile-tile active" : "profile-tile"}
                  aria-pressed={active}
                  onClick={() => setApp(toggleProfile(settings, profile.id), t(active ? "{name} profile off" : "{name} profile on", { name: t(profile.label) }))}
                >
                  <Icon name={profile.icon} />
                  {t(profile.label)}
                </button>
              );
            })}
          </div>
          {a11y.profiles.includes("keyboard") && (
            <p className="muted-line">
              {t("Press")} <kbd>?</kbd> {t("anywhere for keyboard shortcuts,")} <kbd>Alt</kbd>+<kbd>A</kbd> {t("for this menu.")}
            </p>
          )}
        </section>

        <section aria-labelledby="a11y-text">
          <h3 id="a11y-text">{t("Text")}</h3>
          <Stepper label="Text size" value={a11y.textSize} display={`${a11y.textSize}%`} min={80} max={200} step={10} onChange={(textSize) => setA11y({ textSize }, `${t("Text size")} ${textSize}%`)} />
          <Choice
            label="Font"
            value={a11y.font}
            options={[["default", "Default"], ["readable", "Readable"], ["dyslexic", "Dyslexic"]]}
            onChange={(font, text) => setA11y({ font }, `${t("Font")} ${text}`)}
          />
          <Stepper
            label="Line height"
            value={a11y.lineHeight || 1.5}
            display={a11y.lineHeight ? formatNumber(a11y.lineHeight, 1) : t("Default")}
            min={1}
            max={2}
            step={0.1}
            onChange={(lineHeight) => setA11y({ lineHeight }, `${t("Line height")} ${formatNumber(lineHeight, 1)}`)}
          />
          <Stepper
            label="Letter spacing"
            value={a11y.letterSpacing}
            display={a11y.letterSpacing ? `+${formatNumber(a11y.letterSpacing)}em` : t("Default")}
            min={0}
            max={0.2}
            step={0.02}
            onChange={(letterSpacing) => setA11y({ letterSpacing }, `${t("Letter spacing")} ${formatNumber(letterSpacing)} em`)}
          />
          <Choice
            label="Alignment"
            value={a11y.align}
            options={[["default", "Default"], ["left", "Left"], ["center", "Center"]]}
            onChange={(align, text) => setA11y({ align }, `${t("Alignment")} ${text}`)}
          />
        </section>

        <section aria-labelledby="a11y-colour">
          <h3 id="a11y-colour">{t("Colour")}</h3>
          <Choice
            label="Contrast"
            value={a11y.contrast}
            options={[["default", "Default"], ["high", "High"], ["dark", "Dark"], ["light", "Light"]]}
            onChange={(contrast, text) => setA11y({ contrast }, `${t("Contrast")} ${text}`)}
          />
          <Choice
            label="Saturation"
            value={a11y.saturation}
            options={[["default", "Default"], ["low", "Low"], ["high", "High"], ["mono", "Mono"]]}
            onChange={(saturation, text) => setA11y({ saturation }, `${t("Saturation")} ${text}`)}
          />
        </section>

        <section aria-labelledby="a11y-navigation">
          <h3 id="a11y-navigation">{t("Navigation")}</h3>
          <Switch label="Highlight links" checked={a11y.highlightLinks} onChange={(v) => setA11y({ highlightLinks: v }, `${t("Highlight links")} ${onOff(v)}`)} />
          <Switch label="Highlight headings" checked={a11y.highlightHeadings} onChange={(v) => setA11y({ highlightHeadings: v }, `${t("Highlight headings")} ${onOff(v)}`)} />
          <Switch label="Strong focus outline" checked={a11y.strongFocus} onChange={(v) => setA11y({ strongFocus: v }, `${t("Strong focus outline")} ${onOff(v)}`)} />
          <Switch label="Big cursor" checked={a11y.bigCursor} onChange={(v) => setA11y({ bigCursor: v }, `${t("Big cursor")} ${onOff(v)}`)} />
          <Switch label="Reading guide" hint="A bar that follows the pointer; drag it on touch screens" checked={a11y.readingGuide} onChange={(v) => setA11y({ readingGuide: v }, `${t("Reading guide")} ${onOff(v)}`)} />
        </section>

        <section aria-labelledby="a11y-content">
          <h3 id="a11y-content">{t("Content")}</h3>
          <Switch label="Hide images" hint="Logos and decorative graphics; text stays" checked={a11y.hideImages} onChange={(v) => setA11y({ hideImages: v }, `${t("Hide images")} ${onOff(v)}`)} />
          <Switch label="Stop animations" checked={settings.stopAnimations} onChange={(v) => setApp({ stopAnimations: v }, `${t("Stop animations")} ${onOff(v)}`)} />
          <Switch label="Chart text summaries" hint="Shown under every chart" checked={settings.chartSummaries} onChange={(v) => setApp({ chartSummaries: v }, `${t("Chart text summaries")} ${onOff(v)}`)} />
          <Choice
            label="Summary text size"
            value={a11y.summarySize}
            options={[["S", "S"], ["M", "M"], ["L", "L"], ["XL", "XL"]]}
            onChange={(summarySize) => setA11y({ summarySize }, `${t("Summary text size")} ${summarySize}`)}
          />
          <Switch
            label="Auto-refresh live prices"
            hint={settings.autoRefresh ? "Prices update every 30 s" : "Prices update when you tap Refresh"}
            checked={settings.autoRefresh}
            onChange={(v) => setApp({ autoRefresh: v }, `${t("Auto-refresh live prices")} ${onOff(v)}`)}
          />
        </section>

        <div className="a11y-links">
          <Link to="/accessibility-policy" className="menu-link" onClick={onClose}>
            {t("Accessibility policy")} <Icon name="chevron" />
          </Link>
          <button type="button" className="menu-link" onClick={onShowShortcuts}>
            {t("Keyboard shortcuts")} <Icon name="chevron" />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
