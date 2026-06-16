# Keeping parts data up to date (price-change strategy)

The catalog is a **living dataset**. Vendors raise and drop prices on their own
schedules, rename columns, add fields, and discontinue parts — and we need to
know **what changed and when, as fast as possible**. This doc records how the
importer handles that today and the roadmap for the rest.

## The real problem
- Prices move up and down; we must surface that ASAP (margin + quoting depend on it).
- Every vendor formats differently **and changes their own format over time**.
- Different vendors update on different cadences — there's no single "refresh".
- More sources are coming (Sortly live inventory), and better search will expose
  data-quality gaps.

## What's built now (import pipeline)

Each import (`POST /api/distributors/:id/import`) is **non-destructive** and
produces a change report instead of silently overwriting:

1. **Adapts to the file.** Header row auto-detected under title/preamble banners;
   columns fuzzy-matched by name + content sampling; category divider rows
   (`BUTT HINGES`) become running categories; vendor float noise rounded.
2. **Learns each vendor's layout** (`distributorImportProfiles.json`) and reuses
   it next time, matching columns by header *name* (survives reordering). An admin
   can pin/correct a column once and it sticks (mapping editor in the import modal).
3. **Two price metrics.** Captures both `listPrice` (MSRP) and `netPrice` (our
   cost — discount/dealer/jobber/wholesale). `priceMode` picks the headline.
4. **Detects change vs. last import:** `added`, `priceUp`, `priceDown`,
   `unchanged`, `missing` (in catalog but absent from this file → flagged
   `missingSince`, never deleted). Returns the **biggest movers** (Δ%), newest first.
5. **Adapts to format drift.** New/removed columns are reported; a column we relied
   on disappearing raises a `formatWarning`; **new/unmapped columns are captured
   into `item.extra` so data is never lost** and can be promoted to a real field
   in the mapping editor.
6. **Keeps history.** `item.priceHistory[]` accrues `{at, list, net}` snapshots on
   every move (capped 24). Each import event is logged to
   `distributorChangeLog.json` (last 50/vendor) and exposed at
   `GET /api/distributors/:id/changes` and `GET /api/changes` (global feed).

## Roadmap

### Near-term
- **Change feed UI** — a "Recent price changes" view across all vendors (consume
  `GET /api/changes`): biggest moves, format-drift alerts, discontinued parts.
- **Thresholholded alerts** — flag/notify when a part moves > X% or a vendor's
  whole list shifts (e.g. a tariff pass-through). Push into the Nexus IT/Marketing
  dashboards or email.
- **Discontinued lifecycle** — parts `missingSince` > N days → mark inactive in
  search (still browsable in history).
- **Promote `extra` → field** — one click in the mapping editor turns a captured
  unknown column (e.g. `LEAD TIME`) into a first-class, searchable field.

### Sortly (live inventory) — when it comes online
- Sortly is the **on-hand quantity / location** source (SID-keyed), distinct from
  vendor price lists (part#-keyed). Merge by part number → each catalog row gains
  `quantity`, `location`, `sid`.
- Today Sortly arrives as an xlsx export (already importable: Entry Name→part,
  Quantity, Unit). When the **API** is available, poll it on a schedule and treat
  stock-level changes as another change-feed stream (low stock, out of stock).

### Search → data quality
- Better search (fuzzy part#, description tokens, vendor cross-refs like the
  "Door Controls Part #" cross-reference column) will expose gaps — duplicate
  parts across vendors, stale prices, missing descriptions. Feed those back as a
  data-quality report so the catalog improves as it's used.

## Key principle
**Never silently drop or overwrite.** Unknown columns are kept, missing parts are
flagged not deleted, and every price move is recorded — so the system degrades to
"capture everything + tell a human" rather than losing the signal when a vendor
changes something we didn't expect.
