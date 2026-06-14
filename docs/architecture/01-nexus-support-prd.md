# Nexus Support PRD

## Product Role

Nexus Support is the internal operations brain. It connects customer demand to support, sales, quoting, purchasing, shipping, accounting context, marketing insight, and field execution.

## Primary Users

- Customer service agents
- Technical support agents
- Sales support
- Warehouse/shipping team
- Accounting users
- Marketing/growth users
- Owners/managers

## Current Capabilities

Nexus already contains many of the needed pieces:

- tickets from email and calls
- claim/handoff/resolve workflow
- QBO estimate and purchase order hooks
- Sortly import/status
- ShipStation order, shipment, rate, shipped-log, and watchdog views
- Walmart/ZEUS PO lookup/register
- UPS/FedEx tracking
- tech support library, docs, knowledge base, video ingest, AI assistant
- Office@Hand call log, presence, transcript fetch, call router, ticket creation
- marketing dashboard with Hibu/QBO attribution
- sales dashboard work now in progress

## Required Workflow Shape

### Customer Service

1. Customer calls, emails, or arrives through storefront.
2. Nexus creates or links a ticket.
3. Agent classifies request: quote, order, tech support, customer PO, tracking, invoice, vendor statement.
4. Agent creates quote or PO when needed.
5. Approved work is handed to warehouse, vendor procurement, accounting, or FieldCam.

### Sales

Sales needs a clear operating view:

- what is selling
- what needs help
- last week vs prior week
- this quarter vs prior quarter
- year to date vs same period last year
- top customers and repeat demand
- quote pressure and stale quotes
- approved and customer-PO-linked work
- vendors with overlapping products
- best price vs current availability
- product gaps marketing should promote or fix

### Technical Support

Tech support should become one console, not scattered tabs:

1. Live or recent call appears.
2. Transcript or notes stream into a call session.
3. Agent sees customer, related tickets, known equipment, pictures, and docs.
4. AI produces decision cards: ask next, likely part, procedure, source doc, field dispatch, quote handoff.
5. Agent accepts, edits, or rejects suggestions.
6. Accepted outputs become case notes or ticket actions.
7. Reusable solutions become knowledge base entries.

### Warehouse and Shipping

Nexus should remain the internal shipping coordinator:

- ShipStation order status
- ShipStation status regression watchdog
- shipped parts log
- carrier tracking
- Walmart/ZEUS PO lookup
- vendor/drop ship coordination
- order confirmation register

### Accounting

Accounting needs context, not every operational detail:

- QBO estimate ID, PO ID, invoice/bill status
- customer PO received/not received
- quote approved/not approved
- shipment status
- vendor bill expectation
- margin and exception flags

## Key Data Contracts

Nexus should expose internal normalized records:

- `Ticket`
- `SupportInteraction`
- `Quote`
- `CustomerPurchaseOrder`
- `VendorPurchaseOrder`
- `Shipment`
- `PartRequest`
- `FieldWorkRequest`
- `TechCase`
- `SalesMetricSnapshot`
- `MarketingMetricSnapshot`

## Remote Channel Responsibility

Nexus should not give FieldCam raw access to every ticket or integration. It should publish curated channels:

- field work ready for dispatch
- safe job/customer summary
- selected part intelligence
- selected tech documents
- quote status summaries
- customer-approved field scope
- status updates needed from the field

## Near-Term Build Priorities

1. Complete first-class Sales dashboard navigation and view.
2. Refactor Tech Support into a live support console.
3. Add `supportInteractions` or equivalent canonical call/case entity.
4. Add a remote channel API for FieldCam.
5. Add PartFinder canonical part/offer consumption.
6. Add audit trail for accepted AI suggestions and workflow decisions.

## Product Goals

- Give internal teams one operating command center for customer service, technical support, quotes, customer POs, vendor POs, warehouse coordination, accounting context, marketing, sales, and calls.
- Reduce duplicate entry across QBO, Sortly, ShipStation, Office@Hand, PartFinder, FieldCam, and vendor channels.
- Make every customer and order state explainable from one Nexus timeline.
- Give owners and managers visibility into backlog, quote pressure, PO aging, shipping exceptions, missed calls, sales trends, and field handoffs.
- Preserve enough structure that remote apps get curated channels, not raw internal access.

## Non-Goals

- Nexus does not replace QBO as the financial ledger.
- Nexus does not replace FieldCam as the mobile field execution app.
- Nexus does not replace PartFinder as canonical part/vendor intelligence.
- Nexus does not expose raw internal inbox, Office@Hand, QBO, ShipStation, or vendor credentials to FieldCam.
- Nexus does not become a public customer portal in the first release.

## Core Records

| Record | Purpose |
|---|---|
| `Customer` | Account or buyer. |
| `Contact` | Person, phone, email, customer/site relationship. |
| `Ticket` or `TechCase` | Customer service or technical support work item. |
| `SupportInteraction` | Canonical call, transcript, AI decision, note, and ticket/case session. |
| `Quote` | Proposed work or sale with source cost, margin, status, and customer-facing output. |
| `CustomerPurchaseOrder` | Customer PO intake, approval, matching, and status. |
| `VendorPurchaseOrder` | Vendor purchasing workflow. |
| `Shipment` | ShipStation and carrier state mirrored into Nexus. |
| `FieldWorkRequest` | Work approved for FieldCam dispatch. |
| `PartRequest` | Need for part identification, cross-reference, quote, PO, or availability. |
| `SalesMetricSnapshot` | Sales demand, trend, customer, product, and vendor insight snapshot. |
| `MarketingMetricSnapshot` | Campaign, attribution, channel, and demand snapshot. |
| `Mailbox` | An email account Nexus syncs: kind (shared/personal), address, owner/team, IMAP/SMTP config ref, and sync watermark. |
| `MailboxMembership` | User ↔ mailbox link with role; governs visibility and send-as rights. Tickets/threads carry `mailboxId`; outbound messages carry `sentAsMailboxId`. |

## Required Functional Areas

### Customer Timeline

- Show calls, emails, tickets, cases, quotes, customer POs, vendor POs, shipments, field events, PartFinder sourcing decisions, notes, and tasks in one chronological view.
- Filter by source system, object type, owner, date, status, and customer/site/contact.
- Mark external state as requested, mirrored, confirmed, stale, failed, or manual.
- Store audit metadata for important state changes.

### Email Accounts, Mailboxes & Send-As

Nexus must run more than one email account at once: a shared team-mailbox model **plus** a personal mailbox per user. Today there is a single shared mailbox; this is a required upgrade, not an optional one.

**Account model**

- Two mailbox kinds: **shared mailboxes** (e.g. `cs@`, `sales@`) owned by a team/lane, and **personal mailboxes** (e.g. `sterling@`) owned by one user.
- Each mailbox carries its own IMAP/SMTP credentials, sync watermark (`lastSeenUid`), and inbox/folder partition. Credentials are encrypted at rest.
- A user may be a member of one or more shared mailboxes and may own at most one personal mailbox.

**Sidebar / navigation**

- Each mailbox renders as its **own folder tree** in the left sidebar (separate sections) — e.g. a "Customer Service (cs@)" tree and a "Sterling (sterling@)" tree, each with its own Inbox and folders.
- Personal and shared trees are visually separated. A user only sees trees for mailboxes they own or are a member of.

**Send-as (changeable From)**

- Every reply and every new message has a **From selector** the user can change per message.
- Default From = the mailbox the thread belongs to: a reply in `cs@` defaults to sending as `cs@`; a reply in `sterling@` defaults to `sterling@`. The user can override — e.g. while working a `cs@` thread, choose to reply **as `sterling@`**, and vice-versa.
- A user may only send as mailboxes they own or are a member of. The chosen From determines the SMTP account, the `From` / `Reply-To` headers, and the signature.
- The outbound copy is filed in the **sending** mailbox's Sent folder and linked back to the originating ticket/thread regardless of which mailbox the inbound landed in.

**Visibility & permissions**

- Personal-mailbox mail is private to its owner (plus admins/owners). Shared-mailbox mail is visible to that mailbox's team/lane.
- Threads, search, and the customer timeline respect mailbox visibility — personal mail does not surface in shared views unless explicitly linked to a shared ticket.

**Sync & threading**

- Each mailbox syncs independently with its own watermark and single-flight guard so concurrent syncs do not collide.
- Threading and dedup are scoped per mailbox; a given inbound message belongs to exactly one mailbox.

**Acceptance**

- A user working the `cs@` inbox can reply and switch the From to their personal address; the message goes out via the correct SMTP account and is filed in that account's Sent.
- `cs@` and the personal mailbox appear as separate folder trees in the sidebar, and a user cannot see another user's personal mailbox.
- Each mailbox imports only its own new mail (independent watermarks); no duplicate tickets across mailboxes.

### Intake And Routing

- Create or link tickets from Office@Hand calls, email, Volusion/storefront demand, manual entry, FieldCam events, and sales leads.
- Classify work as quote, order support, tech support, customer PO, tracking, invoice, vendor statement, field dispatch, marketing lead, or sales opportunity.
- Assign owner, priority, due date, department, status, and next action.
- Create follow-up tasks automatically for missed calls, blocked field work, stale quotes, PO exceptions, and shipping regressions.

### Quote And Customer PO Workflow

- Build quote drafts from customer request, tech support result, field observations, PartFinder offers, and inventory availability.
- Track draft, review, sent, revised, approved, declined, expired, converted, and cancelled states.
- Show source cost, margin, confidence, availability, lead time, customer PO status, and accounting link.
- Distinguish Nexus quote state from QBO estimate/invoice state.
- Preserve customer PO documents and matching status.

### Vendor PO And Purchasing Workflow

- Convert approved demand into vendor PO needs.
- Compare PartFinder vendor offers by total cost, availability, source confidence, vendor reliability, shipping, and urgency.
- Track draft, approval needed, sent, acknowledged, partial, received, cancelled, and exception states.
- Link PO lines to quote/order/ticket/customer PO/PartFinder offer.
- Surface price changes, duplicate purchase risk, backorders, and vendor confirmation notes.

### Warehouse And Shipping

- Mirror ShipStation order, shipment, label, tracking, carrier, exception, and delivered state.
- Keep a shipped parts log and status regression watchdog.
- Link shipments to quote, order, ticket, customer PO, and customer timeline.
- Support warehouse handoff states: ready to pick, waiting on vendor, waiting on customer PO, ready to ship, shipped, exception.

### Accounting Context

- Mirror QBO estimate, invoice, item, PO, bill, and customer references as needed.
- Show financial context, but keep QBO as the ledger.
- Create visible exceptions when QBO sync or object creation fails.
- Protect cost, margin, and accounting actions behind permissions.

### Sales And Marketing

- Provide sales views for week-over-week, quarter-over-quarter, year-to-date, top customers, repeat demand, stale quotes, customer PO-linked work, vendor overlap, and product gaps.
- Convert campaign or sales lead into ticket, quote, FieldCam lead, customer, or opportunity.
- Attribute revenue and activity back to campaign, sales owner, outside partner, and product category where possible.

## Integration Responsibilities

| Channel | Nexus responsibility |
|---|---|
| FieldCam | Publish field-ready work and safe summaries; receive field events, media summaries, forms, measurements, part requests, and completion packets. |
| PartFinder | Request part intelligence; consume canonical parts, offers, confidence, availability, and cross-references. |
| QBO | Create or sync approved financial objects; mirror accounting status and external IDs. |
| ShipStation | Request shipments and mirror status, labels, tracking, and exceptions. |
| Sortly | Read inventory, item, image, bin/location, and count data during transition. |
| Office@Hand | Link calls, presence, transcripts, recordings, routing, and tickets to support interactions. |
| Volusion | Consume storefront demand, order/customer context, and product signals. |

## Permissions

Minimum role groups:

- Admin
- Owner/manager
- Customer service
- Technical support
- Sales
- Marketing
- Quotes
- Purchasing
- Warehouse/shipping
- Accounting
- Field coordinator
- Read-only reviewer

Role checks must protect:

- QBO actions.
- Vendor cost, source cost, and margin.
- Customer PO and accounting documents.
- Office@Hand recordings and transcripts.
- Internal-only notes.
- FieldCam channel publishing.
- PartFinder vendor credential and source settings.
- Sales/marketing exports.

## MVP Acceptance Criteria

- A staff user can open a customer and see calls, tickets, quotes, customer POs, vendor POs, shipments, field activity, and sourcing decisions in one timeline.
- A live or recent Office@Hand call can become a `SupportInteraction` linked to a ticket, case, customer, quote, or field dispatch.
- A quote user can search PartFinder from Nexus and attach a sourced offer with provenance and confidence.
- A dispatcher can publish approved field work to FieldCam without exposing raw internal tickets.
- A warehouse user can see ShipStation status and shipment exceptions in Nexus.
- A manager can identify stale quotes, missed-call recovery, PO aging, shipping regressions, and sales pressure without exporting data.

## Success Metrics

- Percent of calls linked to a support interaction or ticket.
- Quote cycle time and conversion rate.
- Customer PO matching time.
- Vendor PO aging and backorder exposure.
- Shipment exception time to resolution.
- Missed-call callback completion rate.
- PartFinder offer adoption rate.
- Field work request to completion packet time.
- Sales dashboard usage by owner/manager.

## Open Questions

- Which QBO write operations are approved for the first release?
- Should Nexus customer records lead QBO sync or be seeded from QBO?
- Which Office@Hand transcript/recording capabilities are available and permitted?
- Which Sortly operations are read-only versus writable through API?
- What approvals are required for margin overrides, discounts, vendor substitution, and PO creation?
- Which sales metrics are canonical for ownership reporting?
