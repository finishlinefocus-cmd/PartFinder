# Office server notes — PartFinder

Deployment notes for whoever runs PartFinder on the office server. Newest release at the top.

---

## 2026-09-21 — Vendor price lists loaded, landing redesign merged, Volusion vendor-rule files ready

`main` is at `bd3a4d8`. This release merges two lines of work that had drifted apart:

- the **July client redesign** (one-search landing, in-page supplier browser, semantic search) that was on `main`, and
- the **server/data work** from `feat/nexus-inventory` (price-list importer, catalog, search cache, Nexus live-inventory bridge, and today's batch price-list pipeline).

### What's new for staff

**Price Lists tab** now carries current 2026 costs for ten vendors — 8,840 priced parts added:

| Vendor | Parts | Our-cost basis |
|---|---|---|
| Horton (via Advanced Door Services) | 3,402 | "Our cost" column (30 % off list) |
| NABCO / Gyro Tech | 1,983 | Net price; old→new part numbers cross-referenced; decals pages OCR'd (net = 50 % of list) |
| Record USA | 961 | Our cost (35 % off + 4); Addison / Door Controls comparison prices kept as extras |
| BEA | 674 | **Actual Cost + 6 % tariff** (pre-tariff net kept as an extra column) |
| Motion Access | 637 | Net; suffix-priced items carry the LOW end of the vendor's range (see Notes) |
| Ready Access | 621 | Authorized Agent price; "Used on" models merged per part |
| Xcluder | 228 | Xcluder cost — new vendor |
| MS Sedco | 193 | "Your Price" |
| OPTEX | 129 | Net level 5 |
| Quad Systems | 13 | From a sales quote only — not a real price list yet |

New vendor cards: Xcluder, Motion Access, MS Sedco, Ready Access, Quad Systems.

### Deploy steps

1. **Check for local changes first.** `distributorCatalog.json` is committed in this release (13 MB, all ten vendors).
   If the office server has done its own price-list uploads through the UI since the last pull, that file will
   have local edits. Run `git status` — if `distributorCatalog.json` shows modified, tell Sterling before pulling;
   otherwise those uploads get overwritten (or the pull refuses).
2. `git pull origin main`
3. `npm install` and `npm --prefix client install` (no new npm packages this release, but the lockfiles moved).
4. Restart the API so the five new vendor entries load:
   - Mac: `launchctl kickstart -k gui/$(id -u)/com.partfinder.dev`
   - Windows: restart however `npm run dev:all` is being kept alive there.
5. `client/vite.config.js` now expects **`client/.env.local`** with `PARTFINDER_KEY=<same value as Nexus's .env>` for the
   semantic-search proxy (`/nexus-semantic` → Nexus :4800). This came in with the July redesign on `main`; if the
   office box already ran that landing, the file is already there. Without it, semantic search silently returns nothing —
   everything else works.
6. Open the app → **Price Lists** → pick Xcluder → confirm parts show a price. That's the smoke test.

**No data import is needed on the server** — the catalog with all ten vendors is in git.

### Running the next round of price lists (the recurring job)

More lists are coming before year-end (Ashley is sending several). Procedure:

```bash
# 1. drop the vendor file(s) into price-lists/raw/2026/ (keep the vendor's own filename)
# 2. with the API running:
npm run prices
```

That runs three steps (each can be run alone):

| step | command | does |
|---|---|---|
| parse | `npm run prices:normalize` | vendor xlsx/xlsm/PDF → `price-lists/normalized/<vendor>.csv` + `manifest.json` |
| load | `npm run prices:import` | pushes each CSV through the same import the Price Lists tab uses; prints new / ↑ / ↓ / discontinued |
| storefront | `npm run prices:volusion` | rebuilds the Volusion vendor-rule files (below) |

Requirements on the machine running it: **Python 3 + `openpyxl`** (`pip3 install openpyxl`) and **poppler** for `pdftotext`
(`brew install poppler` on Mac; on Windows install poppler and put its `bin` on PATH). The NABCO decals PDF is image-only
and is OCR'd with macOS Vision — on Windows that step is skipped with a warning and the rest of NABCO still loads; run it
on a Mac when the decals matter.

Adding a vendor = one `parse_*` function in `scripts/price-lists/normalize.py` plus a distributor entry in `server.js`.
Full detail: `price-lists/README.md`.

After a run, **commit** `price-lists/` and `distributorCatalog.json` so every machine gets the same data.

### Volusion storefront — vendor rules (NOT yet imported; manual step)

Generated files are in `price-lists/volusion/out/`:

| file | what | action |
|---|---|---|
| `VendorRules-updated.csv` | the full `Vendor_Rules` table with 211 prices refreshed; every `vr_id` kept | safe to import as-is: Volusion admin → Inventory → Import/Export → Import → table `Vendor_Rules` |
| `VendorRules-new-candidates.csv` | 8,523 parts we now have a cost for but that have no rule | **review first** — Volusion only honours a rule whose `vr_productcode` exists in the store. Delete the two `_description` / `_list_price` helper columns and keep only rows for product codes we actually sell |
| `Vendors-new.csv` | 6 vendors not in Volusion yet (Xcluder, Horton/ADS, Record, Ready Access, OPTEX, Quad Systems) with placeholder ids 901–906 | create them in Volusion first, then fix `vendor_id` in the candidates file to the real ids |
| `report.md` | per-vendor summary, biggest price movers, rules not on this year's list | read before importing |

Existing Volusion vendor ids: BEA 33, NABCO 22, Motion Access 66, MS Sedco 77.
Before regenerating, export fresh **Vendors** and **Vendor_Rules** tables from Volusion into `price-lists/volusion/exports/`.

### Things to know / open items

- **NABCO decals prices are list, not net.** The decals pages only print list; net is derived at NABCO's standard 50 %.
  A new NABCO list is expected soon and will replace this.
- **BEA cost basis** = tariff-inclusive column. Switch to pre-tariff net is a one-line change in `parse_bea()` if wanted.
- **Motion Access**: 30 existing Volusion rules (`MA-ARM-*`, `MA50100`, …) don't appear under those exact numbers on the
  2026 list, so their prices were left as-is. See `report.md`.
- **Quad Systems** only sent a quote (13 lines). Ask them for a price list.
- **Re-importing a vendor's full list** flags parts missing from it as discontinued in PartFinder (there's a guard against
  partial uploads doing this). That's intended.
- `price-lists/volusion/exports/` contains Volusion's vendor contact details — it's fine in this private repo, but don't
  copy it anywhere public.

### Rollback

`git checkout 962dc9f -- distributorCatalog.json` restores the pre-price-list catalog; `git revert bd3a4d8 -m 1`
undoes the merge with main if the redesigned landing causes trouble on the office box.
