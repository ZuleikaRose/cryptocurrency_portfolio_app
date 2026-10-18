# drawsql.png generator

Regenerates `drawsql.png` (the entity-relationship diagram in the repo root) from `schema.sql`.

```bash
cd tools/diagram
npm install
npx playwright install chromium   # first time only
npm run diagram
```

- `erd.py` parses every `CREATE TABLE` in `schema.sql` and writes `build/erd.html`, an inline SVG with one card per table and crow's-foot lines for foreign keys. Python 3 standard library only.
- `render.mjs` screenshots that page with Playwright at 1.5× to `../../drawsql.png`.

When you add a table, put it in the right group in `GROUPS` in `erd.py`. A table that isn't listed falls into Reference. View the PNG before committing it.
