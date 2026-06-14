# Automatics & More Operating Platform PRD

**Status:** replacement architecture source  
**Last updated:** 2026-06-14  
**Apps covered:** Nexus Support, FieldCam, PartFinder  

This PRD replaces the older single-app PRDs that described each app in isolation. The new platform is one operating system with three permanent homes:

- **Nexus Support:** internal operations brain for customer service, sales support, technical support, quoting, purchasing, shipping coordination, accounting context, and vendor intelligence.
- **FieldCam:** permanent field operations home for deployed service and install teams, including DDG as the current quasi field team and future Automatics & More field teams.
- **PartFinder:** part, vendor, price sheet, cross-reference, and availability intelligence layer used by both Nexus and FieldCam.

## Replacement Set

Read these documents together:

- [Platform Architecture](docs/architecture/00-platform-architecture.md)
- [Nexus Support PRD](docs/architecture/01-nexus-support-prd.md)
- [FieldCam PRD](docs/architecture/02-fieldcam-prd.md)
- [PartFinder PRD](docs/architecture/03-partfinder-prd.md)
- [Integration Channel Contract](docs/architecture/04-integration-channel-contract.md)
- [Tech Support Live Calls PRD](docs/architecture/05-tech-support-live-calls.md)

## Supersedes

These old files should be replaced or reduced to pointers to this PRD packet:

- `/Users/sterling/Desktop/Development/Nexus-Support/PRD.md`
- `/Users/sterling/Desktop/Development/FieldCam/PRD.MD`

## Migration Notes

Keep this file as the root PRD index for the operating platform. The canonical detailed docs live in `docs/architecture/` using the numbered filenames above.

For each old PRD:

1. Preserve a copy in an archive location before deleting or rewriting it.
2. Replace the old file body with a short pointer to this root PRD and the relevant architecture doc.
3. Move app-specific implementation notes into tickets or design docs only if they are still current.
4. Do not keep separate Nexus, FieldCam, or PartFinder PRDs that contradict this packet.

Recommended archive location for retired source material:

- `docs/archive/legacy-prds/2026-06-14/`

## North Star

The company needs one clear operating machine:

1. Customers enter through Volusion, phone calls, email, sales outreach, and field relationships.
2. Nexus turns demand into cases, quotes, purchase orders, vendor decisions, shipping decisions, and accounting context.
3. PartFinder identifies the right part, cross-references alternate part numbers, finds vendor options, and explains price and availability confidence.
4. FieldCam executes field work, captures jobsite reality, and feeds production evidence back to Nexus.
5. QBO remains the financial ledger. Sortly remains useful as the physical inventory/bin/photo layer until QBO inventory and warehouse process maturity can replace parts of it.

## Current Priority

1. Tighten Nexus sales and tech support workflows.
2. Define the remote channel between Nexus and FieldCam.
3. Normalize PartFinder around canonical parts and vendor offers.
4. Keep FieldCam field-work focused while making it ready for future Automatics & More field teams.
5. Use PRDs as the shared map so new agents, developers, and team members can understand the architecture quickly.
