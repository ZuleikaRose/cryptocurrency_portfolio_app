import { defaultSettings } from "../state/context.js";

// One-tap profiles (27-accessibility-menu.md). Each sets a bundle of accessibility-menu
// values (`a11y`) and app settings (`app`); the switches then show what changed.
export const profiles = [
  { id: "low-vision", label: "Low vision", icon: "eye", a11y: { textSize: 150, contrast: "high", strongFocus: true, bigCursor: true } },
  { id: "focus", label: "Focus (ADHD)", icon: "compass", a11y: { readingGuide: true }, app: { stopAnimations: true, autoRefresh: false } },
  { id: "motion", label: "Motion safe", icon: "clock", app: { stopAnimations: true, autoAdvance: false } },
  { id: "dyslexia", label: "Dyslexia", icon: "info", a11y: { font: "dyslexic", lineHeight: 1.8, letterSpacing: 0.12, align: "left" } },
  { id: "keyboard", label: "Keyboard nav", icon: "menu", a11y: { strongFocus: true, highlightLinks: true } },
  { id: "screen-reader", label: "Screen reader", icon: "accessibility", a11y: { hideImages: true }, app: { chartSummaries: true, autoRefresh: false } },
];

// Turning a profile off restores each value it set to the default, unless another
// active profile also sets it (then that profile's value stays).
export function toggleProfile(settings, id) {
  const profile = profiles.find((item) => item.id === id);
  const active = settings.a11y.profiles.includes(id);
  const others = profiles.filter((item) => item.id !== id && settings.a11y.profiles.includes(item.id));
  const fallback = (group, key) => {
    const owner = [...others].reverse().find((item) => item[group] && key in item[group]);
    return owner ? owner[group][key] : group === "a11y" ? defaultSettings.a11y[key] : defaultSettings[key];
  };
  const a11yPatch = Object.fromEntries(Object.entries(profile.a11y ?? {}).map(([key, value]) => [key, active ? fallback("a11y", key) : value]));
  const appPatch = Object.fromEntries(Object.entries(profile.app ?? {}).map(([key, value]) => [key, active ? fallback("app", key) : value]));
  return {
    ...appPatch,
    a11y: {
      ...settings.a11y,
      ...a11yPatch,
      profiles: active ? settings.a11y.profiles.filter((item) => item !== id) : [...settings.a11y.profiles, id],
    },
  };
}

// Reset: every accessibility-menu value and the app settings it controls.
export const resetPatch = () => ({
  a11y: defaultSettings.a11y,
  stopAnimations: prefersReducedMotion(),
  chartSummaries: defaultSettings.chartSummaries,
  autoRefresh: defaultSettings.autoRefresh,
  autoAdvance: defaultSettings.autoAdvance,
});

export function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function prefersMoreContrast() {
  try {
    return window.matchMedia("(prefers-contrast: more)").matches;
  } catch {
    return false;
  }
}

export const summarySizes = { S: 14, M: 16, L: 18, XL: 20 };
