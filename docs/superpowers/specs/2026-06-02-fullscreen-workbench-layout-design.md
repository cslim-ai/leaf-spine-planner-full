# Fullscreen Workbench Layout Design

## Context

The current Leaf-Spine Planner layout places the input sidebar and the result area side by side, with the network diagram nested inside the results column. This makes the diagram feel secondary and prevents the app from using the full browser viewport as a diagram-first workspace.

The target interaction model is closer to diagrams.net: a persistent left control area, a large central canvas, and a persistent right-side information panel.

## Goals

- Use the browser viewport as a full-screen workbench.
- Keep the existing input controls in a fixed left sidebar.
- Promote the network diagram to the central, largest region of the UI.
- Move summary metrics and configuration results into a fixed right panel.
- Preserve existing calculation, export, zoom, view mode, and port map behavior.
- Avoid changing the core calculator or diagram rendering logic unless layout coupling requires a small adapter.

## Non-Goals

- Redesigning form fields or calculation behavior.
- Changing topology rendering semantics.
- Adding collapsible side panels.
- Adding new dependencies.
- Reworking the report/export pipeline beyond necessary layout compatibility.

## Approved Layout

Desktop layout:

```text
left input sidebar | central diagram canvas | right summary/results panel
```

Initial sizing:

- Left sidebar: fixed width around 320px.
- Center canvas: flexible remaining space.
- Right panel: fixed width around 360px.
- App shell: fills the viewport height.

The central diagram area should feel like the primary workspace. The diagram toolbar remains attached to the diagram region, above the canvas. The diagram body should expand to fill available height and width.

## Right Panel

The right panel contains two stacked sections:

1. Summary metrics
2. Configuration results

Summary metrics must use a 2x2 grid rather than the current four-column row:

```text
Leaf  | Spine
Ratio | Total
```

Configuration results should remain compact but readable:

- Reduce the gap between labels and values.
- Keep enough row height and section spacing to avoid a cramped appearance.
- Preserve the existing `dl` structure where practical.
- Keep status and message content near the result title.

The right panel should scroll internally if content exceeds available height.

## Responsive Behavior

The desktop layout is the primary target.

For narrow screens, the layout may switch to a stacked flow:

- Sidebar first
- Diagram second
- Summary/results third

This is acceptable as long as desktop remains the optimized experience.

## Implementation Boundaries

Expected files:

- `index.html`: restructure the workspace into left, center, and right regions.
- `assets/css/styles.css`: replace the current results-first layout with a full-height three-column workbench.

Likely no changes:

- `assets/js/calculator.js`
- `assets/js/diagram*.js`
- `assets/js/report*.js`

If JavaScript queries depend on DOM ancestry, keep element IDs stable and move existing nodes rather than replacing them.

## Testing

Manual verification:

- Open the app in a desktop browser.
- Confirm the left sidebar touches the left side of the viewport.
- Confirm the right panel touches the right side of the viewport.
- Confirm the diagram is centered and occupies the largest region.
- Confirm summary metrics render as 2x2.
- Confirm configuration results remain readable with reduced label/value spacing.
- Confirm existing controls still work:
  - Configure
  - Zoom in/out/reset/center/fit
  - View mode buttons
  - Export menu
  - Port Map button

Automated verification should run existing tests after implementation.

## Risks

- Existing CSS may assume the diagram is inside `.results-scroll`.
- Print styles may need a targeted adjustment after the desktop layout changes.
- Report/export code may assume dimensions from the previous diagram container.

Mitigation:

- Preserve IDs and core classes.
- Move DOM nodes conservatively.
- Keep print-specific styles isolated.
- Run browser smoke verification after CSS and markup changes.
