// Lists every t("…") / tn(n, "…", "…") string literal in src/ that has no entry in a language,
// Spanish entries no source uses, Portuguese gaps against the Spanish key set (which also holds
// the keys looked up at runtime), and {placeholders} that differ from the English key.
// Run with `npm run i18n:check`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { es } from "../src/locales/es/index.js";
import { pt } from "../src/locales/pt/index.js";

const dictionaries = { es, pt };

const root = new URL("../src/", import.meta.url).pathname;
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "locales") walk(path);
    } else if (/\.(jsx?|mjs)$/.test(name) && name !== "i18n.js") files.push(path);
  }
};
walk(root);

const literal = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\x60(?:[^\x60\\$]|\\.)*\x60)`;
const single = new RegExp(String.raw`\bt\(\s*${literal}`, "g");
const plural = new RegExp(String.raw`\btn\([^,]+,\s*${literal}\s*,\s*${literal}`, "g");
const unquote = (text) => JSON.parse(text[0] === '"' ? text : `"${text.slice(1, -1).replace(/"/g, '\\"').replace(/\\'/g, "'")}"`);

const used = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const add = (text) => {
    const key = unquote(text);
    if (!used.has(key)) used.set(key, relative(root, file));
  };
  for (const match of source.matchAll(single)) add(match[1]);
  for (const match of source.matchAll(plural)) {
    add(match[1]);
    add(match[2]);
  }
}

const placeholdersOf = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
let problems = 0;
const summary = [];
for (const [lang, dictionary] of Object.entries(dictionaries)) {
  const missing = [...used].filter(([key]) => !(key in dictionary));
  // Spanish holds every key, including the ones looked up at runtime; the others must match it.
  const gaps = lang === "es" ? [] : Object.keys(es).filter((key) => !(key in dictionary));
  const mismatched = Object.entries(dictionary).filter(([key, value]) => placeholdersOf(key) !== placeholdersOf(value));
  for (const [key, file] of missing) console.log(`${lang} missing  ${file}: ${JSON.stringify(key)}`);
  for (const key of gaps) console.log(`${lang} missing  (es key): ${JSON.stringify(key)}`);
  for (const [key] of mismatched) console.log(`${lang} placeholders differ: ${JSON.stringify(key)}`);
  problems += missing.length + gaps.length + mismatched.length;
  summary.push(`${lang}: ${missing.length + gaps.length} missing, ${mismatched.length} placeholder mismatches`);
}
const unused = Object.keys(es).filter((key) => !used.has(key));
if (process.argv.includes("--unused")) for (const key of unused) console.log(`unused   ${JSON.stringify(key)}`);
console.log(`${used.size} strings (literals only; dynamic keys aren't counted) · ${summary.join(" · ")} · ${unused.length} es keys not used as literals`);
process.exitCode = problems ? 1 : 0;
