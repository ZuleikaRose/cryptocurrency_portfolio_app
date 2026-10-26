// Translation (Spanish and Portuguese, Oct 26, 2026). The English text is the key, so UI strings stay readable
// where they're used; a missing Spanish entry falls back to English instead of breaking a page.
// `t()` reads the language AppStore sets before each render, so it also works in lib/ helpers.
// Each dictionary is its own chunk, loaded when its language is first chosen (loadDictionary).

export const languages = [
  { id: "en", label: "English", locale: "en-US" },
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "pt", label: "Português", locale: "pt-BR" },
];

const loaders = {
  es: () => import("../locales/es/index.js").then((module) => module.es),
  pt: () => import("../locales/pt/index.js").then((module) => module.pt),
};
const dictionaries = {};
let current = "en";

// English needs no dictionary; the others are ready once loadDictionary has resolved.
export const hasDictionary = (id) => id === "en" || Boolean(dictionaries[id]);

// Fetches a language's dictionary once. Rejects when the chunk can't be loaded (offline, say).
export async function loadDictionary(id) {
  if (hasDictionary(id) || !loaders[id]) return;
  dictionaries[id] = await loaders[id]();
}

export const isLanguage = (id) => languages.some((language) => language.id === id);

// Guests start in their browser's first language CPA has; accounts keep their saved choice.
export function detectLanguage() {
  try {
    const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
    const match = preferred.map((tag) => String(tag ?? "").toLowerCase().split("-")[0]).find(isLanguage);
    return match ?? "en";
  } catch {
    return "en";
  }
}

// Only a language whose dictionary has loaded; until then the current one stays.
export function setLanguage(id) {
  if (isLanguage(id) && hasDictionary(id)) current = id;
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
