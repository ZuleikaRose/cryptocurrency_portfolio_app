// Lists every t("…") / tn(n, "…", "…") string literal in src/ that has no Spanish entry,
// and Spanish entries no source uses. Run with `npm run i18n:check`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { es } from "../src/locales/es/index.js";

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

const missing = [...used].filter(([key]) => !(key in es));
const unused = Object.keys(es).filter((key) => !used.has(key));
for (const [key, file] of missing) console.log(`missing  ${file}: ${JSON.stringify(key)}`);
if (process.argv.includes("--unused")) for (const key of unused) console.log(`unused   ${JSON.stringify(key)}`);
console.log(`${used.size} strings, ${missing.length} missing, ${unused.length} unused (literals only; dynamic keys aren't counted)`);
process.exitCode = missing.length ? 1 : 0;
