# Fullscreen Workbench Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the app into a full-browser workbench with a fixed left input sidebar, large central diagram canvas, and fixed right summary/results panel.

**Architecture:** Keep all existing element IDs and JavaScript contracts stable. Move existing DOM blocks into three semantic workspace regions and update CSS layout rules so rendering, exports, zoom, and result updates continue to target the same nodes.

**Tech Stack:** Static HTML, CSS Grid/Flexbox, vanilla JavaScript, existing browser smoke page/tests.

---

## File Structure

- Modify `index.html`: split `.workspace` into `.sidebar`, `.diagram-workbench`, and `.inspector`.
- Modify `assets/css/styles.css`: replace the two-column results layout with a full-height three-column workbench, 2x2 summary metrics, central diagram fill behavior, and compact result rows.
- Use existing tests in `tests/*.test.js`.
- Use browser verification against `index.html` or a local static server.

## Task 1: Preserve Workspace Markup Contracts

**Files:**
- Inspect: `index.html`
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Keep existing DOM IDs stable**

Do not move or rename existing DOM nodes. The current JavaScript depends on stable IDs, so the layout should be achieved with CSS placement:

```css
.results,
.results-scroll {
  display: contents;
}
```

- [ ] **Step 2: Verify IDs are unchanged**

Run:

```powershell
Select-String -Path 'D:\Projects\lsp-full\index.html' -Pattern 'id="diagram"|id="detailList"|id="leafCount"|id="spineCount"|id="oversubRatio"|id="totalSwitches"|id="calculationStatus"|id="message"'
```

Expected: each ID appears once.

## Task 2: Implement Fullscreen Three-Column CSS

**Files:**
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Update app shell sizing**

Replace the constrained app shell with full viewport sizing:

```css
.app {
  position: relative;
  width: 100%;
  height: 100vh;
  padding: 12px 12px 40px;
  overflow: hidden;
}
```

- [ ] **Step 2: Update workspace columns**

Use a three-column grid:

```css
.workspace {
  display: grid;
  grid-template-columns: 320px minmax(560px, 1fr) 360px;
  gap: 12px;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}
```

- [ ] **Step 3: Add central workbench and inspector layout**

Add:

```css
.diagram-workbench,
.inspector {
  min-height: 0;
  overflow: hidden;
}

.diagram-workbench {
  display: grid;
}

.inspector {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}
```

- [ ] **Step 4: Make the diagram panel fill the center**

Update diagram panel and diagram sizing:

```css
.diagram-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.diagram {
  height: auto;
  min-height: 0;
}
```

## Task 3: Tune Right Panel Density

**Files:**
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Change summary metrics to 2x2**

Use:

```css
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  min-height: 86px;
  padding: 14px 14px 13px;
}

.metric strong {
  margin-top: 4px;
  font-size: 26px;
}
```

- [ ] **Step 2: Compact result label/value spacing**

Use:

```css
dl {
  grid-template-columns: minmax(132px, 0.85fr) minmax(0, 1fr);
  gap: 6px 8px;
}

dl > dt:not(.detail-group):not(.detail-separator) {
  padding-left: 6px;
}

dd {
  padding-left: 0;
}
```

## Task 4: Responsive And Toolbar Compatibility

**Files:**
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Update diagram toolbar wrapping**

Use a single-column title area so controls do not collide with the heading in the central canvas:

```css
.diagram-title {
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.diagram-actions {
  flex-wrap: wrap;
  justify-content: flex-start;
}
```

- [ ] **Step 2: Update wide screen rule**

At `@media (min-width: 1600px)`, keep three columns and let the center grow:

```css
@media (min-width: 1600px) {
  .workspace {
    grid-template-columns: 340px minmax(720px, 1fr) 380px;
  }
}
```

- [ ] **Step 3: Update narrow screen behavior**

At `@media (max-width: 980px)`, stack the workspace:

```css
@media (max-width: 980px) {
  .workspace {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .diagram-workbench,
  .inspector,
  .results-scroll {
    overflow: visible;
  }

  .diagram {
    min-height: 460px;
  }
}
```

## Task 5: Verify Behavior

**Files:**
- Test: `tests/*.test.js`
- Browser: local `index.html`

- [ ] **Step 1: Run JavaScript tests**

Run:

```powershell
node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Browser verify desktop layout**

Open the local app and verify:

- Left sidebar is flush with the left side of the workbench.
- Diagram is centered and largest.
- Right panel is fixed on the right.
- Summary metrics render 2x2.
- Configure button updates summary, details, and diagram.
- Zoom and view controls still work.

- [ ] **Step 3: Commit implementation**

Run:

```powershell
git add index.html assets/css/styles.css docs/superpowers/plans/2026-06-02-fullscreen-workbench-layout.md
git commit -m "Implement fullscreen workbench layout"
```
