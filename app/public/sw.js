// Service worker for the installable app (US-8.1 adapted: a web app can't add a home-screen
// widget, so CPA installs with shortcuts to Watchlist, Unlocks and Alerts) and offline mode
// (US-9.5: "You're offline: showing saved data").
//
// - Pages: network first; offline, the cached app shell opens any route.
// - Built assets (/assets/*, hashed names) and icons: cache first.
// - Live prices (GET <supabase>/rest/v1/coins): network first, so after a reload offline the
//   last prices still show. The coins table is public reference data, the same for everyone.
// - Everything else, including account data, sign-in and writes: never cached.
const VERSION = "cpa-v2";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const PRICES = `${VERSION}-prices`;
// Servers may send "Vary: Origin"; module scripts send an Origin header and the precache
// doesn't, so match on the URL alone (the files are hashed and immutable).
const MATCH = { ignoreVary: true };
const SHELL_FILES = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];

// The build's own list of every script and stylesheet (vite.config.js), including the pages and
// languages that load on demand; empty in development.
async function builtAssets() {
  try {
    const response = await fetch("/precache.json", { cache: "no-store" });
    const list = response.ok ? await response.json() : [];
    return Array.isArray(list) ? list.filter((path) => typeof path === "string" && path.startsWith("/assets/")) : [];
  } catch {
    return [];
  }
}

// Precache the shell and the build's hashed scripts and styles (index.html's and the build list's),
// so the app opens offline, on any page, even if the old version's asset cache was just cleared.
async function precache() {
  const shell = await caches.open(SHELL);
  await shell.addAll(SHELL_FILES);
  const html = await (await shell.match("/")).text();
  const linked = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  const assets = [...new Set([...linked, ...(await builtAssets())])];
  const cache = await caches.open(ASSETS);
  await cache.addAll(assets);
  // Fonts are referenced from the stylesheets, not index.html. English, Spanish and Portuguese
  // all use the Latin subsets; other subsets still load from the network when online.
  for (const sheet of assets.filter((path) => path.endsWith(".css"))) {
    const css = await (await cache.match(sheet, MATCH)).text();
    const fonts = [...new Set([...css.matchAll(/url\((?:"|')?(\/assets\/[^"')]+\.woff2)/g)].map((match) => match[1]))].filter((path) => /-latin-wght-/.test(path));
    await cache.addAll(fonts);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackUrl ?? request, MATCH);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, SHELL, "/"));
    } else if (SHELL_FILES.includes(url.pathname)) {
      event.respondWith(networkFirst(request, SHELL));
    } else if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // Supabase REST: only the public coins table (lib/market.js).
  if (url.pathname === "/rest/v1/coins") {
    event.respondWith(networkFirst(request, PRICES));
  }
});
