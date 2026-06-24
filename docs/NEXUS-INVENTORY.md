# Nexus Live Inventory Bridge (READ-ONLY)

PartFinder can show **live** on-hand stock and **our-cost** for a part by reading
them from the Nexus Support app instead of the bundled mock files.

- **Availability lane** (`/api/inventory?q=...`): real Sortly on-hand and live
  `available` (on-hand − shipped) from Nexus.
- **Pricing Engine lane** (`/api/cost?q=...`): `ourCost` from Nexus, used as the
  highest-priority cost source ahead of direct QBO, vendor-net, and mock.

PartFinder **only ever GETs** from Nexus. It never writes back to Nexus or Sortly.

## How it works

PartFinder calls Nexus's shared-secret inventory feed:

```
GET {NEXUS_BASE_URL}/api/inventory/feed?q=<part>&refresh=<0|1>
Authorization: Bearer <NEXUS_INVENTORY_TOKEN>
→ { items: [ { name, sku, category, qty, price, ourCost, customerPrice,
               walmartPrice, available, status } ], total }
```

In Nexus, `name` is the product description, `sku` is the A&M part number, `qty`
is Sortly on-hand, `ourCost` is our cost, and `available` is the live count
(on-hand minus shipped). PartFinder maps those onto its own inventory/cost shapes
(see `nexusToInventoryItem` / `nexusToCostItem` in `server.js`). PartFinder always
sends `refresh=0` so Nexus serves from its own cache; it never forces a refresh.

Results are cached per normalized query for `NEXUS_CACHE_TTL_MS` (default 5 min)
so a burst of lookups for the same part hits Nexus at most once per window.

Any failure — bridge off, bad/missing token, timeout, non-2xx, or no match —
falls back silently to PartFinder's local mock stock/cost data, so lanes always
render.

## Configuration

Set these in PartFinder's `.env` (see `.env.example`):

| Var | Default | Purpose |
|---|---|---|
| `NEXUS_BASE_URL` | `http://localhost:4800` | Nexus server base URL |
| `NEXUS_INVENTORY_TOKEN` | _(empty)_ | **Required to enable.** Shared secret; must equal Nexus's `NEXUS_INGEST_TOKEN` |
| `NEXUS_ENABLED` | `true` | Kill-switch; `false` forces the bridge off |
| `NEXUS_CACHE_TTL_MS` | `300000` | Per-query cache window (~5 min) |
| `NEXUS_TIMEOUT_MS` | `8000` | Live request timeout before fallback |

The bridge is **off** unless `NEXUS_INVENTORY_TOKEN` is set (and `NEXUS_ENABLED`
is not `false`).

## Auth — shared-secret token

`/api/inventory/feed` is a read-only endpoint that Nexus mounts **before** its
cookie-based `requireAuth`, gated by a shared secret. PartFinder authenticates
each request with an `Authorization: Bearer <token>` header — **no login session
or cookie is involved**.

Set `NEXUS_INVENTORY_TOKEN` in PartFinder's `.env` to the **same value** as
Nexus's `NEXUS_INGEST_TOKEN` (the existing server-to-server secret Nexus already
uses for ingest). The owner sets both sides to the same string.

When the token is missing or does not match, Nexus responds 401/403; PartFinder
logs `Nexus inventory: unauthorized ...` and falls back to mock data. If
`NEXUS_INVENTORY_TOKEN` is left blank, nothing changes — PartFinder behaves
exactly as before, on mock data.
