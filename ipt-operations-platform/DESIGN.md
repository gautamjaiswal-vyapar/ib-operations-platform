# IPT Customer Intelligence — Design Direction

## Reference and north star

The visual reference is `/Users/vyapar/Downloads/ib-operations-platform-github/apps/web`: slate-50 workspace, slate-950 navigation, blue-700 active state, white bordered cards, compact shadows, and direct operational language.

A calm, evidence-first operating dashboard for sales and customer-success teams. Partner and Customer views should feel like two modules of the same operations control center, with the opening view revealing readiness or performance immediately.

## Audience and jobs

- Sales and IPT operations leads reviewing customer quality and follow-up priorities.
- Analysts comparing stages, lead sources, requirements, objections, intent, and engagement.
- Agents locating a customer record and understanding the recommended next plan.

## Visual system

- Use the shared shell, tabs, cards, chart renderer, filters, table, source inspection, and theme behavior.
- Translate the IB Operations slate/blue token language into `src/theme.css`; do not copy its application shell or bypass protected dashboard chrome.
- Preserve the runtime token source in `src/theme.css`; authored CSS may compose layout but must not duplicate the palette.
- Keep the shared 12-column canvas, 20px card gaps, restrained borders, and compact contextual copy.
- Use color for series identity and status only; labels and values must carry meaning independently.

## Information hierarchy

1. Shell-owned Partner View / Customer View navigation.
2. View-specific heading and data-readiness status.
3. Partner metric readiness, milestone journey, and measurement schema.
4. Customer filters and four topline quality metrics.
5. Customer mix, requirements, objections, and intent/engagement relationship.
6. Searchable customer priority queue.

## Interaction and accessibility

- Shared filters govern every metric, chart, source view, and table row.
- The priority table uses the shared searchable, paginated table pattern.
- Interactive controls retain native/shared keyboard and focus behavior.
- The layout collapses to one column on narrow screens; tables retain internal horizontal scrolling.
- Target WCAG 2.2 AA through shared semantic components and theme tokens.

## Data contract

- Customer grain: one row per `lead_id` across the two supplied IPT attribution CSVs.
- “High intent” is a dashboard analysis threshold of `intent_score >= 70`, not a source-system lifecycle status.
- “Logged in” means either mobile-login or desktop-login flag is true.
- Requirements and objections are multi-valued; their chart totals are intentionally non-additive.
- Partner operating context comes from the IPT Partner Program KT Google Doc. It is a working knowledge base, not authoritative policy for unresolved thresholds.
- Partner lifecycle: acquisition → classification → onboarding → referral-code enablement → Hunting → first lead/business → activation → performance scoring → Farming.
- AP/EP naming, activation, AI-intent buckets, Farming/Hunting tiers, identity keys, and commission eligibility remain explicit definition gaps.
- The discontinued partner-refers-partner experiment is excluded from live lifecycle measurement.
