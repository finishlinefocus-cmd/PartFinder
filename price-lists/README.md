# Vendor price lists

Drop each vendor's file (xlsx / xlsm / PDF) into `raw/<year>/` exactly as received, then:

```bash
npm run prices            # normalize → import into PartFinder → regenerate Volusion vendor rules
```

or one step at a time:

| step | command | output |
|---|---|---|
| 1. parse | `npm run prices:normalize` | `normalized/<vendor-id>.csv` + `manifest.json` |
| 2. load into PartFinder (API must be running) | `npm run prices:import` | Price Lists tab shows the vendor with a change report |
| 3. Volusion files | `npm run prices:volusion` | `volusion/out/VendorRules-updated.csv`, `…-new-candidates.csv`, `Vendors-new.csv`, `report.md` |

`normalize.py` finds each vendor's newest file by name pattern (`*BEA*PRICE LIST*.xlsx`, `*NABCO PRICE LIST*.pdf`, …),
so next year's list just needs to land in `raw/2027/` with a similar name. If a vendor changes its layout,
fix that vendor's `parse_*` function — every parser writes the same columns:

`Part Number, Description, UOM, List Price, Net Price (= our cost), Category, Manufacturer Part, Notes, <vendor extras>`

Cost basis per vendor is recorded in `manifest.json` (e.g. BEA = "Actual Cost + 6% Tariff", Optex = "NET level 5").

Before running step 3, export fresh **Vendors** and **Vendor_Rules** tables from Volusion into `volusion/exports/`.
`VendorRules-updated.csv` keeps every `vr_id`, so it re-imports cleanly. The candidates file lists parts that have a
cost but no rule yet — Volusion only honours rules whose product code exists in the store, so trim it first.

Image-only PDFs (e.g. the NABCO decals pages, whose font encoding is broken) go through macOS Vision OCR via
`scripts/price-lists/ocr-pdf.swift` — no tesseract needed; rows are flagged `OCR-derived` in Notes.

Known gaps: Quad Systems has only sent a quote, not a price list.
