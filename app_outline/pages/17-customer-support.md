# Customer support
**Route:** `/support` (`?topic=account|billing|data|alerts|accessibility|data-removal|other`)  ·  **Nav:** no tab active; from hamburger, Explore, footer  ·  **Personas:** all  ·  **Source stories:** US-9.6, US-P17.x (new)

## Purpose
One entry point for help: search help articles, browse FAQs, report an issue, give feedback, or submit a support ticket (including data-removal requests after account deletion).

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ How can we help?                             │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔍 Search help articles                  │ │
│ └──────────────────────────────────────────┘ │
│ ┌────────────────────┐┌────────────────────┐ │
│ │ ? FAQs             ││ 🐞 Report an issue │ │
│ └────────────────────┘└────────────────────┘ │
│ ┌────────────────────┐┌────────────────────┐ │
│ │ 💬 Feedback        ││ ♿ Accessibility   │ │
│ └────────────────────┘└────────────────────┘ │
│                                              │
│ Contact support                              │
│ Topic   [ Account ⌄ ]                        │
│ Email   [ maya@example.com          ]        │
│ Subject [                           ]        │
│ Message [                           ]        │
│         [                           ]        │
│ [ Submit ticket ]                            │
│                                              │
│ Your tickets                                 │
│ #CPA-1042 Billing date question · Received   │
│ #CPA-1038 Data removal · Completed           │
│                                              │
│ Status: All systems normal · Sample data feed│
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- Help search over FAQ and Learn content (client-side).
- Tiles: FAQs `/faqs`, Report an issue `/report-issue`, Feedback `/feedback`, Accessibility `/accessibility-policy`.
- Ticket form: topic, email (prefilled), subject (≤ 120 chars), message (20–2,000 chars). Submit shows "Ticket #CPA-1042 received. We usually reply within 2 business days." (simulated).
- Data-removal topic: requires the account email; shows "This permanently removes your CPA data from this browser."
- Your tickets list with status; status line for the sample data feed.

## User stories & acceptance criteria
- **US-P17.1 Submit ticket.** Given a valid form, then a ticket with an id is saved and listed; invalid fields show inline errors.
- **US-P17.2 Data removal.** As a user who deleted my account, I want to ask support to remove my data so that nothing is left behind.
  - Given topic "Data removal" and the email of a deleted account, when I submit and confirm, then the simulated support process runs: all `cpa:v1:user:<id>` data and the account record are erased, and the ticket shows "Completed". For an active account: "Delete your account in Settings first."
- **US-P17.3 Guest access.** Guests can open support and submit tickets (stored in memory for the session).

## States
- Empty tickets: "No tickets yet." Submitting: "Sending…".

## Data & persistence
- Tickets: `cpa:v1:user:<id>.tickets` for accounts; memory for guest/demo. Data-removal tickets for deleted accounts are kept in `cpa:v1:supportLog` (id, topic, date, status; no personal data).

## Done when (phase passing conditions)
- [ ] All four tiles navigate correctly.
- [ ] Ticket submission shows an id and appears in Your tickets.
- [ ] Data-removal flow on a deleted account erases its localStorage data.
