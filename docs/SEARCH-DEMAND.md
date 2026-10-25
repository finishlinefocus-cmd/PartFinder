# Search demand — what the Demand panel is for

Beside a part's prices, PartFinder shows a **Demand** panel: how much people search Google for that part.
Sterling, 2026-10-25: *"It's got to be understood by the people that are using it. What's it for?"*

The numbers come from Google Trends through **Nexus** (Nexus owns the cache and the SerpApi spend —
`src/trendsServer.ts` there). PartFinder only forwards (`GET /api/trends/:term` in `server.ts`).
`client/src/DemandPanel.tsx` is the SAME file as Nexus's `src/DemandPanel.tsx`; keep them byte-identical.

## What each line tells you

| Line | What it answers | What to do with it |
|---|---|---|
| **Rising / Steady / Falling** | Are more people searching now than three months ago? (last 90 days vs the 90 before, ±15 %) | Rising is a reason to keep it in stock. |
| **Busy months** | When people search for it most — each month averaged over five years, ±15 % from the average month | Order stock and run ads a few weeks before the busy months. |
| **Over 5 years** | Is it gaining or fading over the years? (the last 12 months vs the first 12, ±20 %; two whole years, so the season cancels out) | Check it before a big purchase or a large stock order. |
| **Rising searches** | The words buyers are typing more and more | Use them in part titles, the catalog and ads. Click one to look it up. |

All of it is Google's **relative interest** (0–100 against the busiest week of the last five years in the
US), never a count of searches.

## What it costs

One five-year look-up plus one related-searches look-up per part, then saved for 24 hours. The SerpApi key
is shared with PartFinder's own Google Shopping price search (Free plan, 250 a month), so the panel shows a
**Show search demand** button instead of asking on every search, and Nexus stops Trends before PartFinder's
reserve is touched.

## The bigger version

Nexus › Marketing › Google › **Search Trends** does the same for any words: compare brands or product lines,
interest by state **and city**, seasons and the 5-year direction, and a "What Search Trends is for" box with
one-click starters (automatic door systems, loading dock levelers, Stanley vs Horton vs NABCO).
