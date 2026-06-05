/*
 * Copyright (c) 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const {
  formatReportHeaderRows,
  makeReportDiagramSvgFromCurrentMarkup,
  formatReportTwinPortUsage,
  getReportHeaderMetaStyle,
  getReportHeaderSpacing,
  getReportDiagramViewportRect,
  getReportDiagramRequiredHeight,
  getReportDiagramSourceSize,
  getReportDiagramContentViewBox,
  getReportVisualStyle,
} = require("../assets/js/report-layout");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, message, tolerance = 0.001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(
  formatReportTwinPortUsage(true, "2x800 Gbps", "USE", "UNUSED"),
  "2x800 Gbps USE",
  "report sidebar should show compact enabled Twin-port usage",
);

assertEqual(
  formatReportTwinPortUsage(false, "2x800 Gbps", "USE", "UNUSED"),
  "UNUSED",
  "report sidebar should show compact disabled Twin-port usage",
);

{
  const rows = formatReportHeaderRows("2026-05-30 00:00:00", "Copyright 2026 Chaeseong Lim.");
  assertEqual(rows.length, 2, "report header should use separate generated-at and copyright rows");
  assertEqual(rows[0], "2026-05-30 00:00:00", "generated date should be the first header detail row");
  assertEqual(rows[1], "Copyright 2026 Chaeseong Lim.", "copyright should be under the generated date row");
}

{
  const style = getReportHeaderMetaStyle();
  assertEqual(style.fill, "#000", "report header meta should match website credit color");
  assertEqual(style.fontSize, 12, "report header meta should match website credit font size");
  assertEqual(style.fontWeight, 500, "report header meta should match website credit font weight");
  assertEqual(style.lineHeight, 1.2, "report header meta should match website credit line height");
}

{
  const spacing = getReportHeaderSpacing();
  assertEqual(spacing.titleToMetaGap > 20, true, "report header meta should be spaced away from the main title");
  assertEqual(spacing.metaToDividerGap, 18, "report header divider should sit close to the copyright row");
}

{
  const style = getReportVisualStyle();
  assertEqual(style.colors.bg, "#eef5ff", "report background should match website background");
  assertEqual(style.colors.ink, "#0f172a", "report ink color should match website ink");
  assertEqual(style.colors.muted, "#5b6b86", "report muted color should match website muted color");
  assertEqual(style.colors.line, "#c8d8ee", "report line color should match website line color");
  assertEqual(style.colors.panel, "#ffffff", "report panel color should match website panel color");
  assertEqual(style.colors.accent, "#2563eb", "report accent color should match website accent color");
  assertEqual(style.colors.accentDark, "#1d4ed8", "report accent-dark color should match website accent-dark color");
  assertEqual(style.title.fontSize, 32, "report title should match website title scale");
  assertEqual(style.metric.valueFontSize, 32, "report metric value should match website metric value size");
  assertEqual(style.panelTitle.fontSize, 20, "report panel title should match website h2 size");
  assertEqual(style.detail.valueFontWeight, 750, "report detail value weight should match website detail value weight");
}

{
  const markup = `
    <svg viewBox="120 80 640 360" data-base-width="1200" data-base-height="800" role="img">
      <style>.is-dimmed{opacity:0.2}.device{fill:#000}</style>
      <g class="device is-selected" data-device="Node #1"><rect width="10" height="10"/></g>
      <path class="is-highlighted" data-source="Node #1" data-target="Leaf 1" d="M0 0L10 10"/>
    </svg>
  `;
  const reportSvg = makeReportDiagramSvgFromCurrentMarkup(markup, 300, 200);
  assertEqual(reportSvg.includes('viewBox="120 80 640 360"'), true, "report diagram should preserve the current visible viewBox");
  assertEqual(reportSvg.includes('width="300"'), true, "report diagram should use report viewport width");
  assertEqual(reportSvg.includes('height="200"'), true, "report diagram should use report viewport height");
  assertEqual(reportSvg.includes('<g transform="translate('), false, "report diagram should not add a nested viewport transform");
  assertEqual(reportSvg.includes("is-selected"), false, "report diagram should remove interactive highlight state");
  assertEqual(reportSvg.includes("is-highlighted"), false, "report diagram should remove highlighted link state");
  assertEqual(reportSvg.includes("is-dimmed"), false, "report diagram should remove dimmed state");
}

{
  const size = getReportDiagramSourceSize();
  assertEqual(size.width, 16, "report diagram should use a browser-independent fixed source width");
  assertEqual(size.height, 9, "report diagram should use a browser-independent fixed source height");
}

{
  const viewBox = getReportDiagramContentViewBox({
    getBBox() {
      return { x: 100, y: 50, width: 600, height: 300 };
    },
  });
  assertEqual(viewBox, "68 18 664 364", "report diagram should crop to padded content bounds for larger report rendering");
}

{
  const viewBox = getReportDiagramContentViewBox({
    getBBox() {
      return { x: 0, y: 0, width: 600, height: 300 };
    },
  });
  assertEqual(viewBox, "-32 -32 664 364", "report diagram should keep symmetric padding when content starts at the origin");
}

{
  const rect = getReportDiagramViewportRect(900, 600, { width: 900, height: 450 });
  assertEqual(rect.width, 900, "report diagram viewport should use full width when source aspect fits");
  assertEqual(rect.height, 450, "report diagram viewport should preserve the web viewport aspect ratio");
  assertEqual(rect.x, 0, "report diagram viewport should not add horizontal inset when full width fits");
  assertEqual(rect.y, 75, "report diagram viewport should center vertically inside the available area");
}

{
  const rect = getReportDiagramViewportRect(900, 300, { width: 900, height: 600 });
  assertEqual(rect.width, 450, "report diagram viewport should shrink width when height is the limiting axis");
  assertEqual(rect.height, 300, "report diagram viewport should use full available height when height limits");
  assertEqual(rect.x, 225, "report diagram viewport should center horizontally when width shrinks");
  assertEqual(rect.y, 0, "report diagram viewport should not add vertical inset when full height fits");
}

{
  const height = getReportDiagramRequiredHeight(900, { width: 1600, height: 900 }, 420);
  assertEqual(height, 575, "report diagram panel should reserve enough height for a full-width 16:9 web viewport");
}

{
  const height = getReportDiagramRequiredHeight(900, { width: 900, height: 300 }, 420);
  assertEqual(height, 420, "report diagram panel should keep the base minimum when the web viewport is already wide");
}

console.log("report layout tests passed");
