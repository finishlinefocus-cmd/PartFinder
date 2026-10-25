# Search demand — what the Demand panel is for

Beside a part's prices, PartFinder shows a **Demand** panel: how much people search Google for that part.
Sterling, 2026-10-25: *"It's got to be understood by the people that are using it. What's it for?"*

The numbers come from Google Trends through **Nexus** (Nexus owns the cache and the SerpApi spend —
`src/trendsServer.ts` there). PartFinder only forwards (`GET /api/trends/:term` in `server.ts`).
`client/src/DemandPanel.tsx` is the SAME file as Nexus's `src/DemandPanel.tsx`; keep them byte-identical.

## What each line tells you

| Line | What it answers | What to do with it |
|---|---|---|
| **Rising / Steady / Falling** | Are more people searching now than in the same weeks last year? (last 13 weeks vs the same 13 weeks a year earlier, ±15 % — so a product is not called Falling just because its season ended) | Rising is a reason to keep it in stock. |
| **Busy months** | When people search for it most — each month's typical (median) week across five years, ±15 % from the typical month; one odd year cannot make a season | Order stock and run ads a few weeks before the busy months. |
| **Over 5 years** | Is it gaining or fading over the years? (the last 12 months vs the first 12 counted from Jan 2022, when Google changed its data collection; medians, ±20 %) | Check it before a big purchase or a large stock order. |
| **Rising searches** | The words buyers are typing more and more | Use them in part titles, the catalog and ads. Click one to look it up. |

All of it is Google's **relative interest** (0–100 against the busiest week of the last five years in the
US), never a count of searches.

## What it searches for

Not the part number — none of our best sellers' numbers have Google data. Nexus asks for the KIND of part,
the way a buyer types it, but only for kinds Google really measures: felt and brush seals → "weather
stripping", sweeps → "door sweep", Quikrete → "concrete crack repair". The panel says "searched as …".

## What Google cannot measure for us (checked 2026-10-25)

- "automatic door", "automatic sliding door" — the searches are chicken-coop doors, garage doors, dog doors.
- "key fob" — car keys and batteries, not HID prox tags.
- "electric strike" — e-bikes and fishing lures. "key switch" — keyboards.
- Brand names (Stanley, Horton, NABCO, BEA, Optex), "prox card", "dock seal", door sensors — too few searches.

Parts of those kinds show "No search trend data". That is the true answer, not a fault.

## What it costs

One five-year look-up plus one related-searches look-up per part, then saved for 24 hours. The SerpApi key
is shared with PartFinder's own Google Shopping price search (Free plan, 250 a month), so the panel shows a
**Show search demand** button instead of asking on every search, and Nexus stops Trends before PartFinder's
reserve is touched.

## The bigger version

Nexus › Marketing › Google › **Search Trends** does the same for any words: compare brands or product lines,
interest by state **and city**, seasons and the 5-year direction, and a "What Search Trends is for" box with
one-click starters (automatic door systems, loading dock levelers, Stanley vs Horton vs NABCO).

## When it shows nothing

"Too few Google searches" means most weeks are zero or near zero on Google's scale — true of most brand
names (Stanley, Horton, NABCO, BEA, Optex) and many part words. That is an answer, not a fault: a part
almost nobody googles is bought by people who already know where to get it.

## Tested on real stock, 2026-10-25

Weather stripping (our 411624 felt, brush seals): busy Nov–Jan, quiet Apr. Concrete crack repair
(Quikrete 8650): busy Jun–Sep, quiet Nov–Jan. Door sweep:
buyers type "door bottom", "brush door sweep", "door sweep seal" — our titles say "NYLON BRUSH DOOR SWEEP".
In spring 2026 "automatic door", "electric strike" and "door sweep" all quadrupled together for about ten
weeks and fell back — not demand — which is why the rules use medians.
