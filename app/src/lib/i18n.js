// Translation (Spanish, Oct 26, 2026). The English text is the key, so UI strings stay readable
// where they're used; a missing Spanish entry falls back to English instead of breaking a page.
// `t()` reads the language AppStore sets before each render, so it also works in lib/ helpers.
import { es } from "../locales/es/index.js";

export const languages = [
  { id: "en", label: "English", locale: "en-US" },
  { id: "es", label: "Español", locale: "es-ES" },
];

const dictionaries = { es };
let current = "en";

export const isLanguage = (id) => languages.some((language) => language.id === id);

// Guests start in the browser's language when it's Spanish; accounts keep their saved choice.
export function detectLanguage() {
  try {
    const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
    return preferred.some((tag) => /^es\b/i.test(tag ?? "")) ? "es" : "en";
  } catch {
    return "en";
  }
}

export function setLanguage(id) {
  current = isLanguage(id) ? id : "en";
}

export const getLanguage = () => current;

// Locale for Intl number and date formatting.
export const locale = () => languages.find((language) => language.id === current)?.locale ?? "en-US";

// t("{count} coins", { count: 3 }): look up the text, then fill {placeholders}.
export function t(text, vars) {
  const translated = (current !== "en" && dictionaries[current]?.[text]) || text;
  if (!vars) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// A shorter wording for one place only, e.g. tc("tab", "Unlocks") for the bottom nav: looks up
// "tab|Unlocks" first, then the plain text.
export const tc = (context, text, vars) => {
  const key = `${context}|${text}`;
  return current !== "en" && dictionaries[current]?.[key] ? t(key, vars) : t(text, vars);
};

// Picks the singular or plural English key, then translates it: tn(n, "{count} coin", "{count} coins").
export const tn = (count, one, other, vars) => t(count === 1 ? one : other, { count, ...vars });
