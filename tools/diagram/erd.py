"""Build a DrawSQL-style ERD (HTML + inline SVG) from schema.sql. Usage: erd.py schema.sql out.html"""
import html
import re
import sys

if len(sys.argv) != 3:
    sys.exit("Usage: erd.py schema.sql out.html")
try:
    with open(sys.argv[1], encoding="utf-8") as schema_file:
        src = schema_file.read()
except OSError as error:
    sys.exit(f"Couldn't read {sys.argv[1]}: {error.strerror}")
if "CREATE TABLE" not in src:
    sys.exit(f"No CREATE TABLE statements found in {sys.argv[1]}")
src = re.sub(r"--[^\n]*", "", src)

KEYWORDS = ("NOT", "DEFAULT", "PRIMARY", "REFERENCES", "CHECK", "UNIQUE", "GENERATED")


def split_top(body):
    parts, depth, cur = [], 0, ""
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [" ".join(p.split()) for p in parts if p.strip()]


tables = {}
order = []
for match in re.finditer(r"CREATE TABLE (\w+) \(", src):
    name = match.group(1)
    i, depth = match.end(), 1
    while depth:
        depth += {"(": 1, ")": -1}.get(src[i], 0)
        i += 1
    cols, pk, table_refs = [], [], []
    for item in split_top(src[match.end():i - 1]):
        head = item.split()[0]
        if head in ("CHECK", "UNIQUE", "CONSTRAINT"):
            continue
        # Composite key, e.g. FOREIGN KEY (user_id, watchlist_id) REFERENCES watchlists (user_id, id):
        # draw it from its last column, the one that isn't shared with the parent.
        fk = re.match(r"FOREIGN KEY \((.*?)\) REFERENCES (\w+) \((.*?)\)", item)
        if fk:
            local = [c.strip() for c in fk.group(1).split(",")]
            remote = [c.strip() for c in fk.group(3).split(",")]
            table_refs.append((local[-1], (fk.group(2), remote[-1])))
            continue
        if item.startswith("PRIMARY KEY"):
            pk = [c.strip() for c in re.search(r"\((.*?)\)", item).group(1).split(",")]
            continue
        words = item.split()
        type_words = []
        for word in words[1:]:
            if word in KEYWORDS:
                break
            type_words.append(word)
        ctype = " ".join(type_words)
        ctype = re.sub(r"\s*\(\s*", "(", ctype).replace(", ", ",")
        ref = re.search(r"REFERENCES (\w+) \((\w+)\)", item)
        cols.append({
            "name": head,
            "type": ctype,
            "pk": "PRIMARY KEY" in item,
            "nn": "NOT NULL" in item or "PRIMARY KEY" in item,
            "unique": " UNIQUE" in item,
            "ref": (ref.group(1), ref.group(2)) if ref else None,
        })
    for col in cols:
        if col["name"] in pk:
            col["pk"] = True
        for name_, ref in table_refs:
            if col["name"] == name_:
                col["ref"] = ref
    tables[name] = cols
    order.append(name)

# Layout: columns of tables, grouped by domain. Colour = group.
GROUPS = [
    ("Reference", "#64748b", ["categories", "plans", "promotions", "faq_sections", "faq_items", "learn_articles", "glossary_terms"]),
    ("Market", "#3d7bff", ["coins", "coin_prices", "exchanges", "coin_markets", "market_sync", "price_history_sync", "cryptorank_lookup_usage"]),
    ("Research", "#0e9f8e", ["vesting_schedules", "vesting_allocations", "unlock_events", "funds", "fund_sectors", "funding_rounds", "round_investors", "token_sales"]),
    ("Watchlist & portfolio", "#d97706", ["watchlist_items", "watchlists", "watchlist_list_coins", "recent_coins", "recent_searches", "sentiment_votes", "transactions", "wallet_lookup_quota", "user_interest_coins", "user_interest_sectors", "fund_follows", "project_follows"]),
    ("Accounts", "#7c5cff", ["users", "sessions", "login_attempts", "password_reset_tokens", "password_reset_requests", "user_state", "affiliates"]),
    ("Alerts & billing", "#db2777", ["price_alerts", "reminders", "notifications", "saved_filters", "subscriptions", "promo_redemptions", "billing_history", "payment_methods"]),
    ("Settings", "#7c5cff", ["user_settings"]),
    ("Support", "#16a34a", ["support_tickets", "support_log", "feedback"]),
]
placed = {t for _, _, ts in GROUPS for t in ts}
missing = [t for t in order if t not in placed]
if missing:
    GROUPS[0][2].extend(missing)

CARD_W, HEAD_H, ROW_H, GAP_X, GAP_Y, MARGIN, TOP = 320, 34, 22, 110, 36, 48, 150
pos, color = {}, {}
x = MARGIN
height = 0
for label, tint, names in GROUPS:
    y = TOP
    for name in names:
        h = HEAD_H + ROW_H * len(tables[name]) + 6
        pos[name] = (x, y, CARD_W, h)
        color[name] = tint
        y += h + GAP_Y
    height = max(height, y)
    x += CARD_W + GAP_X
width = x - GAP_X + MARGIN
height += MARGIN - GAP_Y + 40

group_x = {}
gx = MARGIN
for label, tint, _ in GROUPS:
    group_x[label] = (gx, tint)
    gx += CARD_W + GAP_X


def row_y(table, column):
    x0, y0, _, _ = pos[table]
    idx = next(i for i, c in enumerate(tables[table]) if c["name"] == column)
    return y0 + HEAD_H + ROW_H * idx + ROW_H / 2


esc = html.escape
edges, cards = [], []

# Relationship lines: crow's foot (many) at the FK side, bar (one) at the PK side.
for table in order:
    for col in tables[table]:
        if not col["ref"]:
            continue
        target, tcol = col["ref"]
        sx, _, sw, _ = pos[table]
        tx, _, tw, _ = pos[target]
        y1, y2 = row_y(table, col["name"]), row_y(target, tcol)
        one_to_one = col["pk"] and sum(c["pk"] for c in tables[table]) == 1
        if tx + tw < sx:            # target to the left
            x1, d1, x2, d2 = sx, -1, tx + tw, 1
        elif tx > sx + sw:          # target to the right
            x1, d1, x2, d2 = sx + sw, 1, tx, -1
        else:                       # same column: loop out on the right
            x1, d1, x2, d2 = sx + sw, 1, tx + tw, 1
        bend = max(60, abs(x2 - x1) * 0.45) if d1 != d2 else 70 + abs(y2 - y1) * 0.08
        tint = color[target]
        path = f"M{x1},{y1} C{x1 + d1 * bend},{y1} {x2 + d2 * bend},{y2} {x2},{y2}"
        marks = []
        # PK end: single bar ("exactly one")
        marks.append(f'<line x1="{x2 + d2 * 9}" y1="{y2 - 6}" x2="{x2 + d2 * 9}" y2="{y2 + 6}"/>')
        if one_to_one:
            marks.append(f'<line x1="{x1 + d1 * 9}" y1="{y1 - 6}" x2="{x1 + d1 * 9}" y2="{y1 + 6}"/>')
        else:
            # FK end: crow's foot ("many")
            tip = x1 + d1 * 12
            marks.append(f'<path d="M{tip},{y1} L{x1},{y1 - 6} M{tip},{y1} L{x1},{y1 + 6} M{tip},{y1} L{x1},{y1}"/>')
        edges.append(
            f'<g class="edge" stroke="{tint}"><path d="{path}"/>{"".join(marks)}</g>'
        )

for table in order:
    x0, y0, w, h = pos[table]
    tint = color[table]
    rows = []
    for i, col in enumerate(tables[table]):
        ry = y0 + HEAD_H + ROW_H * i
        badge = "PK" if col["pk"] else ("FK" if col["ref"] else ("UQ" if col["unique"] else ""))
        badge_svg = f'<text x="{x0 + 12}" y="{ry + 15}" class="badge b{badge}">{badge}</text>' if badge else ""
        ctype = col["type"] if len(col["type"]) <= 22 else col["type"][:21] + "…"
        # Condense a long name rather than let it run into its type.
        fit = 37 - len(ctype + ("" if col["nn"] else "?"))
        squeeze = f' textLength="{fit * 7.1:.0f}" lengthAdjust="spacingAndGlyphs"' if len(col["name"]) > fit else ""
        name_class = "col pk" if col["pk"] else "col"
        null_mark = "" if col["nn"] else "?"
        stripe = f'<rect x="{x0}" y="{ry}" width="{w}" height="{ROW_H}" class="stripe"/>' if i % 2 else ""
        rows.append(
            f'{stripe}{badge_svg}<text x="{x0 + 38}" y="{ry + 15}" class="{name_class}"{squeeze}>{esc(col["name"])}</text>'
            f'<text x="{x0 + w - 12}" y="{ry + 15}" class="type" text-anchor="end">{esc(ctype)}{null_mark}</text>'
        )
    cards.append(
        f'<g class="card"><rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="10" class="body"/>'
        f'<path d="M{x0},{y0 + 10} a10,10 0 0 1 10,-10 h{w - 20} a10,10 0 0 1 10,10 v{HEAD_H - 10} h{-w} z" fill="{tint}"/>'
        f'<text x="{x0 + 12}" y="{y0 + 22}" class="title">{esc(table)}</text>'
        f'<text x="{x0 + w - 12}" y="{y0 + 22}" class="count" text-anchor="end">{len(tables[table])}</text>'
        f'{"".join(rows)}</g>'
    )

labels = "".join(
    f'<text x="{gx}" y="{TOP - 16}" class="group" fill="{tint}">{esc(label)}</text>'
    for label, (gx, tint) in group_x.items()
)
fk_count = sum(1 for t in order for c in tables[t] if c["ref"])
legend_x = width - 760
legend = (
    f'<g class="legend" transform="translate({legend_x},40)">'
    '<text x="0" y="14" class="lg">PK primary key · FK foreign key · UQ unique · ? nullable</text>'
    '<g stroke="#475569" fill="none" stroke-width="1.6"><path d="M470,10 h60"/><line x1="521" y1="4" x2="521" y2="16"/>'
    '<path d="M482,10 L470,4 M482,10 L470,16"/></g>'
    '<text x="540" y="14" class="lg">many → exactly one</text></g>'
)

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<style>
  text {{ font-family: Inter, "Segoe UI", "DejaVu Sans", Arial, sans-serif; }}
  .edge {{ fill: none; stroke-width: 1.5; stroke-opacity: .55; }}
  .edge line, .edge path:not(:first-child) {{ stroke-opacity: .9; }}
  .body {{ fill: #fff; stroke: #d6dae1; }}
  .card {{ filter: drop-shadow(0 1px 2px rgba(15,23,42,.12)); }}
  .stripe {{ fill: #f6f7f9; }}
  .title {{ font-size: 14px; font-weight: 700; fill: #fff; }}
  .count {{ font-size: 11px; fill: rgba(255,255,255,.85); }}
  .col {{ font-size: 12.5px; fill: #1e293b; }}
  .col.pk {{ font-weight: 700; }}
  .type {{ font-size: 11.5px; fill: #64748b; font-family: "JetBrains Mono", "DejaVu Sans Mono", monospace; }}
  .badge {{ font-size: 9.5px; font-weight: 700; }}
  .bPK {{ fill: #b45309; }} .bFK {{ fill: #2563eb; }} .bUQ {{ fill: #0e7490; }}
  .group {{ font-size: 15px; font-weight: 700; }}
  .h1 {{ font-size: 30px; font-weight: 800; fill: #0f172a; }}
  .sub {{ font-size: 14px; fill: #475569; }}
  .lg {{ font-size: 13px; fill: #475569; }}
</style>
<rect width="100%" height="100%" fill="#eef1f5"/>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d3d8e0"/></pattern>
<rect width="100%" height="100%" fill="url(#dots)"/>
<text x="{MARGIN}" y="58" class="h1">CPA · Cryptocurrency Portfolio App</text>
<text x="{MARGIN}" y="84" class="sub">Entity-relationship diagram from schema.sql · PostgreSQL · schema cpa · {len(order)} tables · {fk_count} foreign keys</text>
{legend}
{labels}
{"".join(edges)}
{"".join(cards)}
</svg>"""

try:
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        out.write(f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0}}</style></head><body>{svg}</body></html>')
except OSError as error:
    sys.exit(f"Couldn't write {sys.argv[2]}: {error.strerror}")
print(width, height, len(order), fk_count)
