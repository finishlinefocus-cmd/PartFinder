# PartFinder PRD

## Product Role

PartFinder is the part and vendor intelligence layer. It helps the team answer:

- What is this part?
- What other part numbers refer to the same or compatible part?
- Who sells it?
- Which vendor has the best price?
- Which vendor can actually ship it soon?
- Is this price current, login-gated, from a monthly sheet, or public catalog data?

## Current Shape

PartFinder currently has:

- `distributorCatalog.json` as the main flat catalog
- Addison public catalog rows
- Automatics & More product/category rows
- public vendor/OEM source records
- search across distributor, category, Addison part, manufacturer part, and description
- optional external search sources

Current limitations:

- part identity is flat, not canonical
- `manufacturerPart` is overloaded with replacement and discontinued prose
- cross-references are implicit
- availability is not modeled
- price confidence is not modeled
- vendor offers are mixed into catalog items
- duplicate/colliding IDs exist for some public-source rows

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

- `client/src/App.jsx`: search UI and distributor catalog UI.
- `server.js`: API routes, source connectors, public catalog parsing, BigQuery/Apify/SerpAPI search, and local catalog persistence.
- `distributorCatalog.json`: refreshed local distributor catalog rows.
- `sources.json`: configured source channels.
- `package.json`: server scripts, including `dev`, `dev:all`, and launch/autostart helpers.

Current API endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/sources` | List configured sources and whether optional services are configured. |
| `GET /api/distributors` | List distributors/manufacturers, connection status, categories, source URLs, item counts. |
| `GET /api/distributor-catalog?q=&distributor=` | Search saved catalog rows. |
| `POST /api/distributors/:id/refresh` | Refresh one configured source. |
| `POST /api/distributors/refresh-automatics-and-more` | Refresh Automatics & More categories. |
| `POST /api/distributors/refresh-connected` | Refresh all connected public/catalog sources. |
| `GET /api/search?q=&condition=` | Merge saved catalog, BigQuery, Apify, and SerpAPI search results. |

## Product Goals

- Search and identify parts from messy descriptions, partial numbers, photos, field notes, vendor SKUs, and manufacturer numbers.
- Normalize vendor and distributor offers into comparable records.
- Ingest and version vendor price sheets.
- Maintain explicit cross-reference relationships with confidence and source.
- Recommend best buy by total cost, availability, vendor reliability, source freshness, and match confidence.
- Expose stable APIs to Nexus for quotes, POs, support, sales, and inventory decisions.
- Expose technician-safe lookup to FieldCam for part identification and field requests.

## Non-Goals

- PartFinder does not create QBO, ShipStation, or vendor ordering transactions in the first release.
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

Price sheet support should:

- Accept CSV first, then XLSX and PDF-derived table imports later.
- Store original file reference, vendor, version, import timestamp, row count, row errors, and mapping configuration.
- Detect new SKUs, removed SKUs, price changes, availability changes, and changed descriptions.
- Require staff review before publishing large imports.
- Preserve historical price for quote audit and vendor trend reporting.

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
- Should PartFinder store inventory snapshots or query Sortly live?
- How should staff review queues be assigned?
- What retention policy applies to raw imported price sheets and scraped source payloads?
