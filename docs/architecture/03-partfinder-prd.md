# PartFinder PRD

## Product Role

PartFinder is the part and vendor intelligence layer. It helps the team answer:

- What is this part?
- What other part numbers refer to the same or compatible part?
- Who sells it?
- Which vendor has the best price?
- Which vendor can actually ship it soon?
- Is this price current, login-gated, from a monthly sheet, or public catalog data?
- Do we already have it in stock, and where? (inventory)
- What does it cost us, and what should we sell it for at a healthy margin? (pricing)

PartFinder lives under shared **tools**, so any department can open it. The UI is organized into clearly separated **lanes**, and a role-aware **Home** dashboard surfaces the lane each department uses most (sales → pricing, field → availability, accounting → cost) without hiding the others. See [Lanes And Role Dashboards](#lanes-and-role-dashboards).

## Current Shape

PartFinder currently has:

- `distributorCatalog.json` as the main flat catalog
- Addison public catalog rows
- Automatics & More product/category rows
- public vendor/OEM source records
- search across distributor, category, Addison part, manufacturer part, and description
- optional external search sources
- a **self-adapting vendor price-list importer** that ingests real vendor CSV/XLSX exports as-is, captures both list and net (our cost) pricing, learns each vendor's column layout, and produces a change report instead of overwriting — see [Price Data Strategy](../PRICE-DATA-STRATEGY.md) for the full pipeline

Current limitations:

- part identity is flat, not canonical
- `manufacturerPart` is overloaded with replacement and discontinued prose
- cross-references are implicit
- price confidence is not yet a first-class scored field
- vendor offers are mixed into catalog items (the importer writes back to flat catalog rows, not separate offer records)
- duplicate/colliding IDs exist for some public-source rows

Already addressed by the importer:

- availability is now modeled at the row level (`available` / `availability` / `missingSince`) — parts absent from a full re-import are flagged discontinued, never deleted
- per-part `priceHistory[]` snapshots and a per-vendor + global change feed capture price moves over time

## Lanes And Role Dashboards

PartFinder is a multi-lane sourcing hub. The client (`client/src/App.jsx`) presents six tabs plus a "Viewing as" department switcher:

| Lane | Purpose | Backing |
|---|---|---|
| **Home** | Role-aware dashboard. Renders the department's primary lane as a large tile plus quick-link tiles with live stats (stock counts, parts costed, flagged-unavailable count, vendor/catalog counts), and a "stock needing attention" list. | `GET /api/inventory`, `GET /api/cost`, `GET /api/availability` |
| **Price Search** | Existing live price search (saved catalog + BigQuery/Apify/SerpAPI). | `GET /api/search` |
| **Availability** | "Do we already have it on the shelf?" — matches a part against our stock, showing on-hand/reserved/available, bin, and location, with in-stock / low / out status. | `GET /api/inventory` (Sortly) |
| **Pricing Engine** | Pulls our cost, sets it against the market price, computes margin, and suggests a competitive retail price. Live, client-side recompute of target margin / competitor price / manual retail override. | `GET /api/cost` (layered) |
| **Price Lists** | Distributor price-list importer + column-mapping editor (unchanged). | import endpoints |
| **Changes & Alerts** | Global change feed + availability flags (unchanged). | `GET /api/changes`, `GET /api/availability` |

**Role model.** Department is chosen manually for now via the header switcher (`sales` / `field` / `accounting`); the design anticipates Nexus passing a role in on load. Role only changes which lane Home surfaces first — every lane stays open to everyone (`ROLES` and `HOME_TILES` in `App.jsx`).

**Availability source (Sortly).** `GET /api/inventory?q=` is served by `searchInventory()` in `server.js`, reading a mock stock file (`mockSortlyInventory.json`) and annotating each row with `available` (on-hand − reserved) and a `status` (`in_stock` / `low_stock` / `out_of_stock`). Going live means replacing only that one function body with a Sortly API call mapped onto the same shape — the route, response, and frontend are unchanged.

**Pricing Engine cost (layered).** `GET /api/cost?q=` resolves "our cost" via `searchCosts()` in priority order, first source with a hit wins, each result tagged with a `costSource`:

1. **QuickBooks Online** — live `Item.PurchaseCost`, env-gated (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_REFRESH_TOKEN`, optional `QBO_ENV=sandbox`). OAuth2 refresh-token flow; the rotating refresh token is persisted to `qbo-tokens.json` (git-ignored). **Note:** the production QBO file currently holds only service items (no costed inventory), so this layer is dormant until costed `Item`s exist.
2. **Vendor net price** — the importer's captured `netPrice` column (our actual cost source). Dormant until a vendor list is imported in net mode.
3. **Mock sample data** — `mockQboCosts.json`, so the lane always demos.

The suggested-retail rule (`computePricing()` in `App.jsx`): price at the target margin, slip just under a known market price to stay competitive, but never below a 20% margin floor — and say which case applied.

## Required Data Model

PartFinder should move toward canonical parts and offers:

```json
{
  "canonicalPartId": "part_6054_1000",
  "normalizedPartNumber": "60541000",
  "title": "6 conductor wire",
  "manufacturer": { "id": "besam", "name": "Besam" },
  "identifiers": [
    { "type": "vendor_sku", "value": "6054-1000", "sourceId": "am-besam" },
    { "type": "addison_part", "value": "1174", "sourceId": "addison" }
  ],
  "crossReferences": [
    { "type": "replaces", "from": "661S", "to": "661P", "confidence": 0.9, "sourceId": "addison" }
  ],
  "offers": [
    {
      "vendorId": "am-besam",
      "vendorSku": "6054-1000",
      "condition": "new",
      "price": { "amount": 1.63, "currency": "USD", "asOf": "2026-06-14T00:00:00.000Z" },
      "availability": { "status": "unknown", "quantity": null, "leadTimeDays": null, "asOf": null },
      "confidence": "public-price",
      "url": "https://www.automaticsandmore.com/product-p/6054-1000.htm"
    }
  ]
}
```

## Cross-Reference Types

- `same_as`
- `replaces`
- `replaced_by`
- `compatible_with`
- `rebuilt_version_of`
- `core_exchange_for`
- `kit_contains`
- `variant_of`
- `needs_confirmation`

## Availability States

- `in_stock`
- `limited`
- `out_of_stock`
- `dropship`
- `login_required`
- `quote_required`
- `unknown`

## Vendor Source Types

| Source type | Example | Use |
|---|---|---|
| API | future vendor API | direct price/availability |
| monthly price sheet | Addison | current price book import |
| portal/export | Door Controls, Service Spring | semi-manual but structured |
| public catalog | BEA, OEM sites | product identification |
| storefront scrape | Automatics & More | public price and product info |
| manual confirmation | phone/email vendor | confirmed availability note |

## Nexus Consumption

Nexus uses PartFinder for:

- quote line part lookup
- vendor choice
- dropship/local stock decision
- price confidence
- customer-facing replacement explanation
- tech support part suggestions
- sales demand and vendor opportunity analysis

## FieldCam Consumption

FieldCam uses PartFinder for:

- field part identification
- field material requests
- alternate part suggestions
- technician-safe docs and images
- request to quote/order through Nexus

FieldCam should not directly order from vendors unless a future workflow explicitly approves that.

## Near-Term Build Priorities

1. Add normalized part-number parser.
2. Add stable source IDs based on full URL hash.
3. Extract Addison replacement/discontinued prose into cross-reference edges.
4. Add `availability` and `priceConfidence` fields.
5. Add a canonical part API.
6. Add vendor price sheet import flow.
7. Feed Nexus sales dashboard with offer/availability summaries.

## Current Repo Surface

The current PartFinder repository contains a React/Vite client and Express API. The important local files are:

- `client/src/App.jsx`: tabbed UI with a "Viewing as" role switcher — Home (role-aware dashboard), Price Search, Availability (Sortly stock check), Pricing Engine (cost → margin → suggested retail), Price Lists (the import column-mapping editor: per-vendor dropdowns, List/Net headline toggle, re-import, and a "what changed" results panel), and Changes & Alerts (consumes the global change feed + availability). See [Lanes And Role Dashboards](#lanes-and-role-dashboards).
- `server.js`: API routes, source connectors, public catalog parsing, the price-list importer (header detection, fuzzy mapping, change detection), BigQuery/Apify/SerpAPI search, the inventory + layered cost endpoints, and local catalog persistence. `express.json()` runs at a `64mb` limit so large vendor lists (Door Controls ≈527KB, Sortly ≈317KB) don't 413.
- `distributorCatalog.json`: refreshed local distributor catalog rows.
- `mockSortlyInventory.json`: mock Sortly stock for the Availability lane (replace with the live Sortly API).
- `mockQboCosts.json`: mock cost data for the Pricing Engine's fallback layer.
- `distributorImportProfiles.json`: per-vendor learned import format profiles (header row, column→header-name mapping, `priceMode`).
- `distributorChangeLog.json`: per-vendor import event log (last 50/vendor) backing the change feed.
- `sources.json`: configured source channels.
- `package.json`: server scripts, including `dev`, `dev:all`, and launch/autostart helpers.

Current API endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/sources` | List configured sources and whether optional services are configured. |
| `GET /api/distributors` | List distributors/manufacturers, connection status, categories, source URLs, item counts. |
| `GET /api/distributor-catalog?q=&distributor=` | Search saved catalog rows. |
| `POST /api/distributors/:id/import` | Import a vendor price list (CSV/TSV); returns a non-destructive change report (added/up/down/unchanged/discontinued, movers, format drift). |
| `GET/PUT/DELETE /api/distributors/:id/import-profile` | View / pin-correct / forget a vendor's learned column mapping and headline `priceMode`. |
| `GET /api/distributors/:id/changes` | Per-vendor import event feed (recent movers + format-drift warnings). |
| `GET /api/changes` | Global recent-changes feed across all vendors. |
| `GET /api/availability?id=` | Parts that can't be sold (discontinued / absent from latest list); optional vendor filter. |
| `POST /api/distributors/:id/refresh` | Refresh one configured source. |
| `POST /api/distributors/refresh-automatics-and-more` | Refresh Automatics & More categories. |
| `POST /api/distributors/refresh-connected` | Refresh all connected public/catalog sources. |
| `GET /api/search?q=&condition=` | Merge saved catalog, BigQuery, Apify, and SerpAPI search results. |
| `GET /api/inventory?q=` | Availability lane: match a part against our stock (Sortly; mock today). Returns rows annotated with `available`, `status` (`in_stock`/`low_stock`/`out_of_stock`), bin, and location. |
| `GET /api/cost?q=` | Pricing Engine: layered cost lookup (QBO → vendor net price → mock). Each row carries a `costSource`. |

## Product Goals

- Search and identify parts from messy descriptions, partial numbers, photos, field notes, vendor SKUs, and manufacturer numbers.
- Normalize vendor and distributor offers into comparable records.
- Ingest and version vendor price sheets.
- Maintain explicit cross-reference relationships with confidence and source.
- Recommend best buy by total cost, availability, vendor reliability, source freshness, and match confidence.
- Expose stable APIs to Nexus for quotes, POs, support, sales, and inventory decisions.
- Expose technician-safe lookup to FieldCam for part identification and field requests.

## Non-Goals

- PartFinder does not create QBO, ShipStation, or vendor ordering transactions in the first release. (It may *read* QBO item cost for the Pricing Engine, read-only.)
- PartFinder does not own customer conversation, case, or field visit lifecycle.
- PartFinder does not guarantee live availability unless the source is explicitly real-time.
- PartFinder does not treat public or scraped source data as equal to approved vendor feeds.

## Target Data Model

Recommended records:

- `CanonicalPart`
- `PartIdentifier`
- `PartCrossReference`
- `Vendor`
- `VendorSource`
- `VendorOffer`
- `PriceSheet`
- `PriceSheetRow`
- `AvailabilitySnapshot`
- `CatalogIngestionRun`
- `SourceError`
- `SourcingRequest`
- `SourcingRecommendation`
- `PartRequest`
- `StaffReview`

Every source-derived row should preserve:

- Raw source reference.
- Source URL or file.
- Captured timestamp.
- Parser version.
- Normalized fields.
- Match confidence.
- Review state.
- Stale-after timestamp where possible.

## Vendor Offer Shape

Minimum normalized offer fields:

- `vendorOfferId`
- `canonicalPartId` or unresolved part request reference.
- `vendorId`
- `vendorSku`
- `title`
- `description`
- `condition`
- `price.amount`
- `price.currency`
- `shipping.amount`
- `availability.status`
- `availability.quantity`
- `availability.leadTimeDays`
- `sourceType`
- `sourceUrl` or `priceSheetId`
- `capturedAt`
- `staleAfter`
- `confidence.score`
- `confidence.explanation`

## Cross-Reference Requirements

- Relationships must be explicit rather than embedded in prose.
- Supported relationship types: `same_as`, `replaces`, `replaced_by`, `compatible_with`, `rebuilt_version_of`, `core_exchange_for`, `kit_contains`, `variant_of`, `needs_confirmation`.
- Each relationship needs source, confidence, reviewer/review state, notes, and last-confirmed timestamp.
- Conflicts must be visible instead of silently collapsed.
- Staff should be able to confirm, reject, merge, split, or retire relationships.

## Availability And Confidence

Availability state should use a controlled vocabulary:

- `in_stock`
- `limited`
- `out_of_stock`
- `dropship`
- `backordered`
- `login_required`
- `quote_required`
- `discontinued`
- `unknown`

Confidence should explain why the system trusts a result:

- Exact part number match.
- Manufacturer and vendor SKU match.
- Cross-reference match.
- Description-only match.
- Public catalog fallback.
- Login-gated price.
- Staff-confirmed.
- Needs review.

## Price Sheet Ingestion

A first-generation price-list importer now ships (`POST /api/distributors/:id/import`). Real vendor files never match a fixed template, so the importer adapts to the file rather than forcing the file to adapt to us. Full detail lives in [Price Data Strategy](../PRICE-DATA-STRATEGY.md); the highlights:

- Accepts CSV/TSV (and pasted XLSX exports) today; PDF-derived tables remain future work.
- **Adapts to the file:** auto-detects the header row under title/preamble banners, fuzzy-matches columns by name plus content sampling, treats one-cell `BUTT HINGES`-style rows as a running category, and rounds vendor float noise to 2dp. A price/cost column whose values are all ≤1 is rejected as a percentage (this fixed a real bug where SDC's `50% DISC` column was being read as money).
- **Captures both prices:** `listPrice` (MSRP) and `netPrice` (our cost — net aliases broadened to discount/dealer/jobber/wholesale/disc). `priceMode` (`list` | `net`) picks the headline; net is always stored regardless.
- **Learns each vendor's layout** to `distributorImportProfiles.json` and reuses it next upload by matching columns by header *name* (survives reordering). An admin can pin/correct a column (`overrides`) or change the headline price; profile CRUD is exposed at `GET/PUT/DELETE /api/distributors/:id/import-profile`.
- **Non-destructive change detection:** on re-import, counts added / price-up / price-down / unchanged / discontinued, reports biggest movers, and surfaces new/removed columns plus format-drift warnings. Unknown columns are captured into `item.extra` so data is never dropped. Parts absent from a full re-import are flagged `available: false`; a partial-upload coverage guard prevents mass false "discontinued" when only part of a list is uploaded.
- **Preserves history:** per-part `priceHistory[]` (capped 24) and a per-vendor + global change feed (`distributorChangeLog.json`, exposed at `GET /api/distributors/:id/changes`, `GET /api/changes`, and `GET /api/availability`).

Validated against five real vendor files (Direct Hardware, Door Controls, SDC, BEA 2026 6%-tariff, Sortly export). Still to do: original-file archival with a stored mapping/version record, a formal staff-review gate before publishing large imports, and separating offers out of flat catalog rows.

## Best-Buy Recommendation

Best buy is not simply lowest price. Ranking should consider:

- Item cost.
- Shipping and handling.
- Availability and lead time.
- Match confidence.
- Cross-reference relationship type.
- Vendor reliability.
- Quote/customer urgency.
- Minimum order quantity.
- Return/restocking risk.
- Internal stock availability.

Every recommendation must show its explanation and source data freshness.

## Source Strategy

Priority source order:

1. Approved vendor API or feed.
2. Account-backed export with permission.
3. Vendor price sheet import.
4. Public catalog where terms allow it.
5. Marketplace search as fallback/discovery.
6. Manual staff confirmation.

Current public connectors and scrapers are useful discovery tools, but high-value vendors should move toward approved feeds, account exports, or price sheets.

## Nexus And FieldCam Consumption

Nexus uses PartFinder for:

- Support part suggestions.
- Quote line source cost and availability.
- Customer-facing replacement explanations.
- Vendor choice and PO input.
- Sales demand and vendor opportunity analysis.
- Inventory substitution suggestions.

FieldCam uses PartFinder for:

- Field part identification.
- Part requests with photos and notes.
- Technician-safe alternates and images.
- "Send to office for quote/order" workflows.

## MVP Acceptance Criteria

- Search returns exact, equivalent, substitute, and uncertain matches as distinct categories.
- Saved catalog, external search, and price sheet rows normalize into vendor offers.
- Each price or availability claim shows source, freshness, and confidence.
- Nexus can request sourcing and receive stable recommendation payloads.
- FieldCam can submit a part request with photos/notes and receive safe suggestions or a review state.
- Staff can review and confirm cross-references.

## Success Metrics

- Search-to-selected-offer conversion.
- Quote lines with source provenance.
- Part requests resolved without manual vendor browsing.
- Sourcing time per quote line.
- Savings versus baseline vendor.
- Offer freshness by source.
- Price sheet import error rate.
- Vendor fill rate and backorder rate.

## Open Questions

- Which vendors get approved feed/API outreach first?
- Which price sheet formats are available and how often are they updated?
- What confidence threshold is required before a result can appear in a customer-facing quote?
- Should PartFinder store inventory snapshots or query Sortly live? (The Availability lane reads a single `GET /api/inventory` endpoint, mock today; the open question is whether the live implementation queries Sortly per-request or syncs periodic snapshots.)
- How should staff review queues be assigned?
- What retention policy applies to raw imported price sheets and scraped source payloads?
