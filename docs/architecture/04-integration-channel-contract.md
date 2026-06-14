# Integration Channel Contract

## Purpose

Nexus, FieldCam, and PartFinder should integrate through explicit channels. This prevents FieldCam from becoming a raw window into the internal office app while still making field teams productive.

## Channel Direction

| Direction | Purpose |
|---|---|
| Nexus to FieldCam | approved field work, safe customer/job summaries, selected parts/docs, quote status |
| FieldCam to Nexus | field photos, notes, forms, measurements, job status, part requests, completion packet |
| PartFinder to Nexus | canonical part, cross-reference, offer, availability, price confidence |
| PartFinder to FieldCam | technician-safe part identification and request data |
| Nexus to PartFinder | demand signals, quote misses, vendor confirmation outcomes |

## Envelope

All channel messages should use a consistent envelope:

```json
{
  "id": "evt_...",
  "channel": "field-work",
  "entityType": "work-order",
  "entityId": "wo_123",
  "op": "upsert",
  "source": "nexus",
  "target": "fieldcam",
  "occurredAt": "2026-06-14T12:00:00.000Z",
  "cursor": "2026-06-14T12:00:00.000Z_evt_...",
  "payload": {},
  "links": [],
  "visibility": {
    "companyIds": ["ddg"],
    "roleIds": ["admin", "employee"]
  }
}
```

## Proposed Nexus Endpoints

Internal implementation can vary, but the contract should look like:

- `GET /api/remote/fieldcam/channels`
- `GET /api/remote/fieldcam/snapshot?channels=field-work,tech,parts,quotes&since=<cursor>`
- `POST /api/remote/fieldcam/events`
- `GET /api/remote/fieldcam/assets/:id`

## Proposed FieldCam Collections

- `integrationEvents`
- `nexusSnapshots`
- `nexusLinks`
- `fieldEvents`

Raw integration payloads should not directly mutate `jobsites`. A trusted mapper should promote approved work into jobsite records.

## Core Channels

### `field-work`

Nexus publishes work ready for a field team:

- customer/site summary
- scope
- due date
- priority
- contact
- linked ticket
- required forms/photos
- part/material notes

### `field-events`

FieldCam publishes:

- arrived
- status changed
- note added
- photo/video uploaded
- form submitted
- measurement captured
- part request created
- job complete

### `parts`

PartFinder publishes:

- canonical part
- identifiers
- cross-references
- vendor offers
- availability confidence
- source provenance

### `tech`

Nexus publishes technician-safe support data:

- selected documents
- procedures
- support notes
- known equipment
- accepted AI guidance

### `sales-marketing-summary`

Nexus publishes safe remote summaries:

- demand categories
- quote conversion
- campaign lead counts
- customer/product opportunities
- no secrets
- no internal cost detail unless role permits

## Security Requirements

- Use token-authenticated server-side integration, not browser access to Nexus internals.
- Filter payloads by company/team/role.
- Store an audit trail for all channel writes.
- Do not expose QBO, ShipStation, Office@Hand, or vendor credentials to FieldCam.
- Keep raw internal tickets out of FieldCam unless explicitly linked and filtered.

## Migration Plan

1. Implement read-only Nexus snapshot channel.
2. Add FieldCam integration event store.
3. Map approved field-work snapshots to FieldCam jobsites.
4. Add FieldCam event publishing back to Nexus.
5. Add PartFinder canonical part endpoint.
6. Add role-based sales/marketing summaries.

## Shared Identifier Rules

| Field | Rule |
|---|---|
| `tenantId` | Required if multiple business entities, companies, or partners share infrastructure. |
| `correlationId` | Required across related commands, events, logs, and user-facing exceptions. |
| `idempotencyKey` | Required for every command and inbound event write. |
| `schemaVersion` | Required on every channel message. |
| `sourceApp` | `nexus`, `fieldcam`, `partfinder`, or approved external channel. |
| `targetApp` | Required for commands and snapshots. |
| `externalRefs` | Map of external system names to IDs. |
| `actor` | User, partner, service, or system that caused the action. |

Nexus-owned references:

- `customerId`
- `siteId`
- `contactId`
- `ticketId`
- `caseId`
- `supportInteractionId`
- `quoteId`
- `customerPurchaseOrderId`
- `vendorPurchaseOrderId`
- `shipmentId`
- `workOrderId`

FieldCam-owned references:

- `jobsiteId`
- `fieldVisitId`
- `fieldEventId`
- `mediaAssetId`
- `fieldPartRequestId`
- `partnerLeadId`

PartFinder-owned references:

- `canonicalPartId`
- `partIdentifierId`
- `crossReferenceId`
- `vendorId`
- `vendorOfferId`
- `priceSheetId`
- `availabilitySnapshotId`
- `sourcingRequestId`

## Command Envelope

Commands request a state change and must be idempotent:

```json
{
  "commandId": "cmd_...",
  "commandType": "nexus.work_order.dispatch",
  "schemaVersion": "1.0",
  "sourceApp": "nexus",
  "targetApp": "fieldcam",
  "tenantId": "default",
  "requestedAt": "2026-06-14T12:00:00.000Z",
  "correlationId": "corr_...",
  "idempotencyKey": "dispatch_wo_123_v1",
  "actor": {
    "actorType": "user",
    "actorId": "usr_..."
  },
  "externalRefs": {},
  "payload": {}
}
```

Command states:

- `accepted`
- `rejected`
- `queued`
- `completed`
- `failed`
- `duplicate`

## Event Envelope

Events describe facts that already happened:

```json
{
  "eventId": "evt_...",
  "eventType": "fieldcam.field_visit.completed",
  "schemaVersion": "1.0",
  "sourceApp": "fieldcam",
  "tenantId": "default",
  "occurredAt": "2026-06-14T14:30:00.000Z",
  "receivedAt": "2026-06-14T14:30:05.000Z",
  "correlationId": "corr_...",
  "idempotencyKey": "field_visit_fv_123_completed_v1",
  "actor": {
    "actorType": "user",
    "actorId": "usr_..."
  },
  "subject": {
    "type": "field_visit",
    "id": "fv_123"
  },
  "externalRefs": {},
  "payload": {}
}
```

## Required Event Families

### Nexus

- `nexus.ticket.created`
- `nexus.support_interaction.created`
- `nexus.quote.created`
- `nexus.quote.approved`
- `nexus.customer_po.received`
- `nexus.vendor_po.created`
- `nexus.work_order.dispatched`
- `nexus.shipment.requested`
- `nexus.task.created`

### FieldCam

- `fieldcam.field_visit.accepted`
- `fieldcam.field_visit.arrived`
- `fieldcam.field_visit.blocked`
- `fieldcam.field_visit.completed`
- `fieldcam.media.uploaded`
- `fieldcam.form.submitted`
- `fieldcam.measurement.captured`
- `fieldcam.part_request.created`
- `fieldcam.partner_lead.created`
- `fieldcam.customer_signoff.completed`

### PartFinder

- `partfinder.sourcing_request.created`
- `partfinder.sourcing_recommendation.ready`
- `partfinder.vendor_offer.updated`
- `partfinder.price_sheet.imported`
- `partfinder.catalog_refresh.completed`
- `partfinder.cross_reference.confirmed`
- `partfinder.cross_reference.rejected`

### External Channels

- `qbo.estimate.synced`
- `qbo.invoice.status_changed`
- `shipstation.shipment.created`
- `shipstation.shipment.status_changed`
- `sortly.inventory.changed`
- `officeathand.call.completed`
- `officeathand.call.missed`
- `volusion.order.received`

## Required Commands

| Command | Source | Target | Purpose |
|---|---|---|---|
| `nexus.work_order.dispatch` | Nexus | FieldCam | Send approved work to a field team or partner. |
| `nexus.field_question.ask` | Nexus | FieldCam | Request more field information. |
| `nexus.sourcing_request.create` | Nexus | PartFinder | Request part/vendor sourcing. |
| `fieldcam.part_request.submit` | FieldCam | Nexus/PartFinder | Submit field-originated part need. |
| `partfinder.catalog_refresh.request` | Nexus/Admin | PartFinder | Refresh a source or vendor. |
| `nexus.qbo_estimate.create` | Nexus | QBO connector | Create an approved estimate. |
| `nexus.shipment.request` | Nexus | ShipStation connector | Create shipment or label request. |
| `nexus.inventory_lookup.request` | Nexus/PartFinder | Sortly connector | Check physical inventory state. |

## Query Response Standard

Query APIs should return:

```json
{
  "data": {},
  "meta": {
    "source": "partfinder",
    "generatedAt": "2026-06-14T12:00:00.000Z",
    "stale": false,
    "freshness": "fresh",
    "schemaVersion": "1.0"
  },
  "warnings": []
}
```

Error shape:

```json
{
  "error": {
    "code": "SOURCE_UNAVAILABLE",
    "message": "Vendor source is temporarily unavailable.",
    "retryable": true,
    "details": {}
  },
  "correlationId": "corr_..."
}
```

Freshness labels:

- `live`
- `fresh`
- `stale`
- `manual`
- `unknown`

## External Channel Rules

### QBO

- QBO remains source of truth for accounting status, payments, and ledger state.
- Nexus should create or update QBO objects only after approval policy is satisfied.
- QBO sync failures must become visible Nexus exceptions.
- Nexus must distinguish internal quote state from QBO estimate or invoice state.

### ShipStation

- ShipStation remains source of truth for label, carrier, tracking, and shipment execution state.
- Nexus can request shipment only when order, address, item, and warehouse readiness validations pass.
- Carrier exceptions and label failures must create Nexus tasks or alerts.

### Sortly

- Sortly remains source of truth for physical inventory during transition.
- Nexus and PartFinder may query item, photo, bin/location, barcode, count, and freshness.
- Inventory write or reservation operations require explicit API support and approval.

### Office@Hand

- Calls should link to contacts through phone number and user mapping.
- Recordings and transcripts should be linked only when policy and provider access allow it.
- Missed calls should create callback tasks.
- FieldCam should not receive raw call data unless explicitly linked to assigned field work and filtered.

### Volusion

- Volusion remains the public storefront path.
- Nexus may consume order, customer, product, and demand signals.
- Product demand and search gaps should feed Nexus sales/marketing and PartFinder catalog planning.

## Media Rules

- FieldCam owns original field media.
- Nexus stores references, summaries, thumbnails, and access decisions.
- Media URLs must expire.
- Media events must include media type, capture timestamp, uploaded timestamp, actor, field visit, and visibility.
- Retention policy must be configurable by category.

## Retry And Failure Rules

- All commands must be safe to retry.
- Transient errors retry with backoff.
- Permanent errors create user-visible exceptions in the source app.
- Webhook receivers return success only after durable acceptance.
- Poison messages are quarantined with correlation ID and payload reference.
- Replays must be possible by event ID or time window.

## Security Requirements

- Use OIDC/OAuth for users where available.
- Use scoped service tokens for app-to-app integration.
- Verify webhook signatures or shared secrets.
- Store credentials outside source control.
- Apply partner/company/team role filters before publishing remote channel data.
- Audit role changes, quote approvals, PO approvals, shipment requests, inventory write requests, call transcript access, field media access, and accounting actions.

## Observability

Every integration path should log:

- Correlation ID.
- Command or event ID.
- Source and target.
- External references.
- Start and finish timestamp.
- Outcome.
- Retry count.
- Error code.

Dashboards should show:

- Connector health by channel.
- Failed event count.
- Oldest queued command.
- Webhook latency.
- Source freshness.
- Authentication failures.
- Replay/quarantine counts.
