/*
 * Copyright (c) 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.join(__dirname, "..");
const diagramSource = fs.readFileSync(path.join(root, "assets/js/diagram.js"), "utf8");
const diagramApiSource = fs.readFileSync(path.join(root, "assets/js/diagram-api.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets/js/app.js"), "utf8");

assert(
  diagramSource.includes("function makeDiagramWindowPayload"),
  "diagram window payload builder should exist; add makeDiagramWindowPayload(result)",
);
assert(
  diagramSource.includes("function makeWindowSvgDataFromMarkup"),
  "diagram popup should have a non-export SVG payload builder",
);
assert(
  diagramSource.includes("full: makeWindowSvgDataFromMarkup") && !diagramSource.includes("makeExportSvgDataFromMarkup"),
  "diagram popup payload should use unscaled source SVG instead of export-scaled SVG",
);
assert(
  diagramSource.includes("const DIAGRAM_EXPORT_CONTENT_SCALE = 0.8"),
  "diagram export content scale should remain 0.8",
);
assert(
  diagramSource.includes("function makeDiagramSvgStyleCss") && diagramSource.includes("${makeDiagramSvgStyleCss()}"),
  "diagram popup should include topology SVG color styles without using export scaling",
);
assert(
  diagramSource.includes("${makeDiagramInlineStyleElement()}") && diagramSource.includes("function makeDiagramInlineStyleElement"),
  "main diagram SVG markup should embed the same topology SVG style source",
);
assert(
  diagramSource.includes("function makeDiagramMarkupForView") && diagramApiSource.includes("makeForView: makeDiagramMarkupForView"),
  "main diagram API should use the shared view-mode markup builder",
);
assert(
  diagramSource.includes("function makeDiagramWindowVariants") && diagramSource.includes("makeDiagramMarkupForView(result, \"full\")"),
  "popup variants should be built from the same view-mode markup builder as the main diagram",
);
assert(
  !diagramSource.includes("viewMode,"),
  "diagram popup update payload should not force the popup view mode",
);
assert(
  !diagramSource.includes("payload.viewMode"),
  "diagram popup should preserve its own view mode when it receives updated data",
);
assert(
  diagramApiSource.includes("makeWindowPayload: makeDiagramWindowPayload"),
  "diagram public API should expose makeWindowPayload for smoke tests and future agents",
);
assert(
  diagramSource.includes("leaf-spine-diagram-update"),
  "diagram popup should listen for leaf-spine-diagram-update messages",
);
assert(
  diagramSource.includes("leaf-spine-diagram-clear"),
  "diagram popup should support clearing stale topology on infeasible input",
);
assert(
  diagramSource.includes("width: calc(100vw - 40px);") && diagramSource.includes("height: calc(100vh - 75px);") && diagramSource.includes("margin: 0 20px 20px;"),
  "diagram popup viewport should be inset by 20px on the left, right, and bottom",
);
assert(
  diagramSource.includes("body {\n        margin: 0;\n        min-height: 100vh;\n        background: #fff;") && diagramSource.includes(".viewer {\n        width: calc(100vw - 40px);"),
  "diagram popup viewport inset should reveal a white background instead of a blue frame",
);
assert(
  diagramSource.includes("const fitPaddingX = 50") && diagramSource.includes("const fitPaddingY = 100"),
  "diagram popup fit padding should be restored independently from the viewport inset",
);
assert(
  diagramSource.includes("const targetScale = Math.min(availableWidth / Math.max(bounds.width, 1), availableHeight / Math.max(bounds.height, 1))"),
  "diagram popup fit should use both width and height constraints",
);
assert(
  diagramSource.includes("zoom = getZoomForRenderedScale(targetScale)"),
  "diagram popup fit should convert target rendered scale like the main diagram",
);
assert(
  diagramSource.includes("fitView();"),
  "diagram popup should refit after view changes, data updates, and resize events",
);
assert(
  !appSource.includes("renderDiagramDebugGuides") && !diagramSource.includes("renderWindowDebugGuides") && !diagramSource.includes("diagramDebugGuide"),
  "temporary debug guide overlays should be fully removed from main and popup diagrams",
);
assert(
  appSource.includes("LeafSpineDiagram.syncOpenWindows(currentResult)"),
  "main render loop should sync open diagram windows after feasible renders",
);
assert(
  !appSource.includes("updateDiagramViewButtons();\n  LeafSpineDiagram.syncOpenWindows(currentResult);"),
  "main view-mode button changes should not sync popup view mode",
);
assert(
  appSource.includes("LeafSpineDiagram.clearOpenWindows()"),
  "main render loop should clear open diagram windows after infeasible renders",
);

console.log("diagram window sync tests passed");
