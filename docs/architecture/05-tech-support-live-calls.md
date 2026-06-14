# Tech Support Live Calls PRD

## Product Role

The Tech Support branch of Nexus should become a live support console for calls, transcripts, documents, parts, and decisions. Today the pieces exist but are split across Phone Calls, Tech Support, AI Assistant, case logs, and tickets.

## Current Assessment

Existing backend endpoints:

- `GET /api/calls`
- `GET /api/calls/presence`
- `POST /api/calls/sync`
- `POST /api/calls/:id/transcript`
- `POST /api/calls/:id/tag`
- `POST /api/calls/:id/route`
- `POST /api/calls/:id/create-ticket`
- `POST /api/tech/assist`
- `POST /api/tech/summarize`
- `GET/POST /api/tech/case-log/:ticketId`
- tech docs, knowledge, pictures, and library endpoints

Existing UI surfaces:

- Phone Calls view
- PhoneLinesWidget
- Tech Support Emails tab
- Tech Support Call Assist tab
- Tech Support AI Assistant tab
- Library, Knowledge Base, Videos, Vendors, Agents tabs

The workflow feels disjointed because calls, tickets, transcripts, case notes, and AI answers do not share one canonical support session.

## Key Problem

Office@Hand call presence and call logs are available, but Nexus cannot generate true live transcripts from a `tel:` desktop app launch alone. Nexus needs either provider-supported real-time audio/transcription, a per-user softphone/OAuth media path, or a permitted local companion that can send transcript segments.

## Canonical Entity

Add `SupportInteraction`:

```json
{
  "id": "si_...",
  "type": "phone",
  "provider": "office-at-hand",
  "sessionId": "123",
  "callId": "456",
  "linkedTicketId": "TIC-1001",
  "customer": {
    "name": "Customer",
    "phone": "+17065551212",
    "email": null
  },
  "state": "live",
  "category": "Customer Pictures / Tech Support",
  "transcriptSegments": [
    {
      "id": "seg_1",
      "speaker": "customer",
      "text": "Door reverses halfway.",
      "at": "2026-06-14T12:00:00.000Z",
      "confidence": 0.92
    }
  ],
  "aiCards": [],
  "acceptedActions": [],
  "caseNotes": []
}
```

## Desired Live Workflow

1. Call rings or starts.
2. Nexus creates or opens `SupportInteraction`.
3. Transcript segments appear as available.
4. Agent and user can read the conversation record.
5. AI decision cards update during the call:
   - ask next
   - likely equipment/model
   - likely part
   - procedure
   - source document
   - dispatch field team
   - create quote
   - save knowledge entry
6. Agent accepts/edit/rejects cards.
7. Accepted cards become case notes, ticket actions, or handoffs.
8. Post-call summary is saved and linked to the ticket/customer.

## UI Recommendation

Replace the current split with a "Live Support Console" inside Tech Support:

- left column: active/recent calls
- center: live transcript and case timeline
- right column: decision cards, related docs, related parts, related tickets
- bottom action bar: create/link ticket, add note, quote handoff, field dispatch, save KB entry

Keep Library, Knowledge Base, Videos, and Vendors as supporting tabs, but make Live Support the main workflow.

## Provider Integration Plan

### Phase 1: Tighten current post-call path

- sync calls automatically or on schedule
- upsert existing calls so late recording IDs appear
- fetch transcripts after calls end when available
- create tickets with `callId`, `sessionId`, `customer.phone`, and real `category`
- create/open case log immediately when a call becomes a ticket
- persist AI answers and accepted actions

### Phase 2: Telephony event stream

- add Office@Hand webhook endpoint for telephony/session events
- add SSE/WebSocket endpoint for Nexus UI
- update active call state without manual sync

### Phase 3: Live transcript

Choose one:

- Office@Hand/provider-supported real-time media/transcription if the plan exposes it
- per-user OAuth softphone integration
- local companion that captures permitted audio and posts transcript segments

### Phase 4: Decision support

- rolling transcript windows into `/api/tech/assist`
- decision cards with citations
- accepted actions written to `SupportInteraction`
- optional summarizer drafts KB entries after call

## Security Requirements

- redact Office@Hand secrets from `GET /api/config`
- encrypt Office@Hand secret/JWT at rest
- log transcript access
- allow deletion/redaction of transcript segments
- avoid exposing call data to FieldCam unless linked to an assigned field job

## Success Metrics

- percent of tech calls linked to a ticket or case
- percent of calls with transcript or usable notes
- time from call end to case summary
- number of accepted AI decision cards
- repeat issue reduction through KB entries
- number of field dispatches created from tech calls
