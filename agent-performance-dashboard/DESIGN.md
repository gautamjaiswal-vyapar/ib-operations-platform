# IPT Agent Performance design context

## Product job
Help an IPT agent understand monthly achievement, compare it with reviewed targets, and identify the funnel stage that needs attention. Managers can use the same screen for a team snapshot.

## Visual direction
- Mission-board clarity: dense operational evidence on deep graphite and navy surfaces with mint live-state accents and amber target references.
- Typography carries hierarchy through compact labels and large, direct achievement values.
- Cards are used only for independent evidence blocks; the page avoids a generic hero and decorative charts.
- Target status is never implied. Missing targets are visibly marked as “Target not set.”
- Positive and negative period movement uses green/red plus explicit signed text; color is never the only signal.
- Team-lead review includes an expandable ranked distribution of the agents in scope.

## Interaction contract
- Level, period, and contextual date controls scope all top-level evidence. The contextual date control remains visible and changes between day, week, and month choices.
- Metric cards and the metric segmented control are synchronized.
- Selecting a team row opens that agent in the same month.
- Reviewed sheet values remain read-only; target values come only from the target configuration query.

## Tokens
The shared runtime owns palette, surfaces, controls, focus, and chart tokens in `src/theme.css`. Authored CSS uses only those tokens and component-local layout rules.
