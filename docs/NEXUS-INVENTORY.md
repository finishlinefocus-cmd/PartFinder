# Nexus Live Inventory Bridge (READ-ONLY)

PartFinder can show **live** on-hand stock and **our-cost** for a part by reading
them from the Nexus Support app instead of the bundled mock files.

- **Availability lane** (`/api/inventory?q=...`): real Sortly on-hand and live
  `available` (on-hand − shipped) from Nexus.
- **Pricing Engine lane** (`/api/cost?q=...`): `ourCost` from Nexus, used as the
  highest-priority cost source ahead of direct QBO, vendor-net, and mock.

PartFinder **only ever GETs** from Nexus. It never writes back to Nexus or Sortly.

## How it works

PartFinder calls Nexus's existing endpoint:

```
GET {NEXUS_BASE_URL}/api/sortly/items?q=<part>
→ { items: [ { name, sku, category, qty, price, ourCost, customerPrice,
               walmartPrice, available, status, ... } ], stats, source, total }
```

In Nexus, `name` is the A&M part number, `qty` is Sortly on-hand, `ourCost` is our
cost, and `available` is the live count (on-hand minus shipped). PartFinder maps
those onto its own inventory/cost shapes (see `nexusToInventoryItem` /
`nexusToCostItem` in `server.js`).

Results are cached per normalized query for `NEXUS_CACHE_TTL_MS` (default 5 min)
so a burst of lookups for the same part hits Nexus at most once per window.

Any failure — bridge off, bad cookie, timeout, non-2xx, or no match — falls back
silently to PartFinder's local mock stock/cost data, so lanes always render.

## Configuration

Set these in PartFinder's `.env` (see `.env.example`):

| Var | Default | Purpose |
|---|---|---|
| `NEXUS_BASE_URL` | `http://localhost:4800` | Nexus server base URL |
| `NEXUS_SESSION_COOKIE` | _(empty)_ | **Required to enable.** Nexus session cookie/token |
| `NEXUS_ENABLED` | `true` | Kill-switch; `false` forces the bridge off |
| `NEXUS_CACHE_TTL_MS` | `300000` | Per-query cache window (~5 min) |
| `NEXUS_TIMEOUT_MS` | `8000` | Live request timeout before fallback |

The bridge is **off** unless `NEXUS_SESSION_COOKIE` is set (and `NEXUS_ENABLED`
is not `false`).

## Auth requirement — the cross-service blocker

Nexus protects `/api/sortly/items` with its cookie-based login session
(`requireAuth` checks a `nexus_session` token against an in-memory `sessions` Map
that Nexus persists to `sessions.json`). There is **no API-key path** for this
route — Nexus's API keys only authenticate `/api/agent/*`, not `/api/sortly/*`.

So a server-to-server read from PartFinder needs a **valid Nexus session token**.
Options, easiest first:

1. **Reuse an existing session token (quickest).** A logged-in Nexus user already
   has a token in Nexus's `sessions.json` (a map of `token → agentId`). Copy any
   live token and set `NEXUS_SESSION_COOKIE=<token>` in PartFinder's `.env`.
   - Caveat: Nexus tokens are session-scoped. They survive Nexus restarts
     (persisted to `sessions.json`) but are cleared on logout, so this may need
     occasional refreshing. When the token is rejected, PartFinder logs
     `Nexus inventory: unauthorized ...` and falls back to mock data.

2. **Programmatic login (more robust, needs a Nexus-side decision).** Have
   PartFinder `POST {NEXUS_BASE_URL}/api/login` with a dedicated service account's
   credentials, capture the `Set-Cookie: nexus_session=...`, and reuse it. This
   keeps the token fresh automatically. It requires creating a low-privilege
   Nexus service agent and storing its credentials in PartFinder's `.env`. **Not
   implemented here** — it touches the login flow and a credentials policy
   decision that is the operator's call.

3. **Add a shared-secret read endpoint in Nexus (cleanest long-term).** Mirror the
   `NEXUS_INGEST_TOKEN` pattern Nexus already uses for server-to-server posts:
   mount a read-only `/api/sortly/items` variant *before* `requireAuth`, gated by
   a shared secret header. **Requires a change in the Nexus repo** (out of scope
   for this PartFinder-only change).

For now PartFinder ships behind the `NEXUS_SESSION_COOKIE` flag (option 1). If
left blank, nothing changes — PartFinder behaves exactly as before, on mock data.
