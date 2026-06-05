/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Report SVG layout and canvas rendering helpers.
function reportTr(path, params = {}) {
  return typeof tr === "function" ? tr(path, params) : path;
}

function reportTrim(value) {
  if (typeof trim === "function") return trim(value);
  return Number.parseFloat(Number(value).toFixed(3)).toString();
}

const REPORT_HEADER_META_STYLE = {
  fill: "#000",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.2,
};

const REPORT_HEADER_SPACING = {
  titleToMetaGap: 30,
  metaRowGap: 16,
  metaToDividerGap: 18,
};

const REPORT_VISUAL_STYLE = {
  colors: {
    bg: "#eef5ff",
    ink: "#0f172a",
    muted: "#5b6b86",
    line: "#c8d8ee",
    panel: "#ffffff",
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    diagramBg: "#f8fbff",
    warning: "#dc2626",
  },
  title: { fontSize: 32, fontWeight: 900 },
  section: { fontSize: 16, fontWeight: 900 },
  subsection: { fontSize: 13, fontWeight: 900 },
  label: { fontSize: 14, fontWeight: 700 },
  value: { fontSize: 14, fontWeight: 700 },
  metric: { labelFontSize: 14, labelFontWeight: 800, valueFontSize: 32, valueFontWeight: 900 },
  panelTitle: { fontSize: 20, fontWeight: 900 },
  detail: { labelFontWeight: 800, valueFontWeight: 750, messageFontWeight: 400 },
};
const REPORT_DIAGRAM_SOURCE_SIZE = { width: 16, height: 9 };

async function renderReportCanvas(generatedAtText = formatDisplayTimestamp(new Date())) {
  const fontCss = await getEmbeddedReportFontCss();
  const svgText = makeReportSvg(generatedAtText, fontCss);
  const { width, height } = getReportSvgSize(svgText);
  const scale = Math.min(2, Math.max(0.5, 8192 / Math.max(width, height)));
  const image = await loadSvgImage(svgText);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = getReportVisualStyle().colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function makeReportSvg(generatedAtText = formatDisplayTimestamp(new Date()), embeddedFontCss = "") {
  const pageWidth = 1320;
  const pageHeight = 1867;
  const margin = 20;
  const gap = 18;
  const sidebarW = 380;
  const contentX = margin + sidebarW + gap;
  const contentW = pageWidth - contentX - margin;
  const sidebarRows = getReportInputRows();
  const detailRows = getReportDetailRows();
  const metrics = getReportMetrics();
  const visualStyle = getReportVisualStyle();
  const titleOffsetY = 10;
  const headerRows = formatReportHeaderRows(generatedAtText, reportTr("meta.credit"));
  const headerStyle = getReportHeaderMetaStyle();
  const headerSpacing = getReportHeaderSpacing();
  const titleY = margin + 38 + titleOffsetY;
  const headerRowsY = titleY + headerSpacing.titleToMetaGap;
  const sidebarDividerY = headerRowsY + headerSpacing.metaRowGap * (headerRows.length - 1) + headerSpacing.metaToDividerGap;
  const sidebarTopRowsY = sidebarDividerY + 28;
  const sidebarH = sidebarTopRowsY - margin + reportRowsHeight(sidebarRows) + 18;
  const metricH = 104;
  const diagramSourceSize = getReportDiagramSourceSize();
  const diagramH = getReportDiagramRequiredHeight(contentW - 32, diagramSourceSize, 420);
  const detailContentOffset = 76;
  const maxDetailH = pageHeight - (margin + metricH + gap + gap + diagramH) - margin;
  const detailScale = Math.min(1, Math.max(0.66, (maxDetailH - detailContentOffset) / reportDetailRowsHeight(detailRows)));
  const detailRowH = 24 * detailScale;
  const detailSeparatorH = 12 * detailScale;
  const detailFontSize = visualStyle.label.fontSize * detailScale;
  const detailH = Math.max(142, Math.min(maxDetailH, detailContentOffset + reportDetailRowsHeight(detailRows, detailRowH, detailSeparatorH)));
  const diagramY = pageHeight - margin - diagramH;
  const diagramViewportArea = { x: contentX + 16, y: diagramY + 52, width: contentW - 32, height: diagramH - 68 };
  const diagramViewportRect = getReportDiagramViewportRect(diagramViewportArea.width, diagramViewportArea.height, diagramSourceSize);
  const diagramViewportX = diagramViewportArea.x + diagramViewportRect.x;
  const diagramViewportY = diagramViewportArea.y + diagramViewportRect.y;
  const diagramViewportW = diagramViewportRect.width;
  const diagramViewportH = diagramViewportRect.height;
  const diagramSvg = makeVisibleDiagramSvgMarkup(diagramViewportW, diagramViewportH);
  const colors = visualStyle.colors;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">
      <style>
        ${embeddedFontCss}
        svg, text { font-family: "Pretendard", Arial, sans-serif; }
        .title { fill: ${colors.accent}; font-size: ${visualStyle.title.fontSize}px; font-weight: ${visualStyle.title.fontWeight}; text-anchor: middle; }
        .header-meta { fill: ${headerStyle.fill}; font-size: ${headerStyle.fontSize}px; font-weight: ${headerStyle.fontWeight}; }
        .section { fill: ${colors.accentDark}; font-size: ${visualStyle.section.fontSize}px; font-weight: ${visualStyle.section.fontWeight}; }
        .subsection { fill: ${colors.ink}; font-size: ${visualStyle.subsection.fontSize}px; font-weight: ${visualStyle.subsection.fontWeight}; }
        .label { fill: ${colors.muted}; font-size: ${visualStyle.label.fontSize}px; font-weight: ${visualStyle.label.fontWeight}; }
        .value { fill: ${colors.ink}; font-size: ${visualStyle.value.fontSize}px; font-weight: ${visualStyle.value.fontWeight}; }
        .metric-label { fill: ${colors.muted}; font-size: ${visualStyle.metric.labelFontSize}px; font-weight: ${visualStyle.metric.labelFontWeight}; }
        .metric-value { fill: ${colors.ink}; font-size: ${visualStyle.metric.valueFontSize}px; font-weight: ${visualStyle.metric.valueFontWeight}; }
        .panel-title { fill: ${colors.ink}; font-size: ${visualStyle.panelTitle.fontSize}px; font-weight: ${visualStyle.panelTitle.fontWeight}; }
        .detail-label { fill: ${colors.muted}; font-size: ${trim(detailFontSize)}px; font-weight: ${visualStyle.detail.labelFontWeight}; }
        .detail-value { fill: ${colors.ink}; font-size: ${trim(detailFontSize)}px; font-weight: ${visualStyle.detail.valueFontWeight}; }
        .detail-group-label { fill: ${colors.accentDark}; font-size: ${trim(Math.max(12, detailFontSize - 1))}px; font-weight: ${visualStyle.section.fontWeight}; }
        .detail-message { fill: ${colors.muted}; font-size: ${visualStyle.label.fontSize}px; font-weight: ${visualStyle.detail.messageFontWeight}; }
      </style>
      <rect width="100%" height="100%" fill="${colors.bg}"/>
      ${reportPanel(margin, margin, sidebarW, sidebarH)}
      <text class="title" x="${margin + sidebarW / 2}" y="${titleY}">Leaf-Spine Planner</text>
      ${headerRows.map((row, index) => `<text class="header-meta" x="${margin + sidebarW / 2}" y="${headerRowsY + index * headerSpacing.metaRowGap}" text-anchor="middle">${escapeXml(row)}</text>`).join("")}
      <line x1="${margin + 20}" y1="${sidebarDividerY}" x2="${margin + sidebarW - 20}" y2="${sidebarDividerY}" stroke="${colors.line}" stroke-width="1"/>
      ${reportRows(sidebarRows, margin + 20, sidebarTopRowsY, sidebarW - 40)}
      ${metrics.map((item, index) => reportMetricCard(contentX + index * ((contentW - 36) / 4 + 12), margin, (contentW - 36) / 4, metricH, item)).join("")}
      ${reportPanel(contentX, margin + metricH + gap, contentW, detailH)}
      <text class="panel-title" x="${contentX + 20}" y="${margin + metricH + gap + 32}">${escapeXml(reportTr("report.resultTitle"))}</text>
      <line x1="${contentX + 20}" y1="${margin + metricH + gap + 46}" x2="${contentX + contentW - 20}" y2="${margin + metricH + gap + 46}" stroke="${colors.line}" stroke-width="1"/>
      ${reportDetailRows(detailRows, contentX + 20, margin + metricH + gap + detailContentOffset, contentW - 40, detailRowH, detailSeparatorH)}
      ${reportPanel(contentX, diagramY, contentW, diagramH)}
      <text class="panel-title" x="${contentX + 20}" y="${diagramY + 32}">${escapeXml(reportTr("report.diagramTitle"))}</text>
      ${reportDiagramViewport(diagramViewportX, diagramViewportY, diagramViewportW, diagramViewportH)}
      <g transform="translate(${diagramViewportX} ${diagramViewportY})">${diagramSvg}</g>
    </svg>
  `;
}

function getReportSvgSize(svgText) {
  const width = Number(svgText.match(/width="(\d+(?:\.\d+)?)"/)?.[1]) || 1320;
  const height = Number(svgText.match(/height="(\d+(?:\.\d+)?)"/)?.[1]) || 900;
  return { width, height };
}

function reportPanel(x, y, w, h) {
  const colors = getReportVisualStyle().colors;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${colors.panel}" stroke="${colors.line}"/>`;
}

function reportDiagramViewport(x, y, w, h) {
  const colors = getReportVisualStyle().colors;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${colors.diagramBg}" stroke="${colors.line}"/>`;
}

function reportMetricCard(x, y, w, h, item) {
  return `
    ${reportPanel(x, y, w, h)}
    <text class="metric-label" x="${x + 16}" y="${y + 32}">${escapeXml(item.label)}</text>
    <text class="metric-value" x="${x + 16}" y="${y + 74}">${escapeXml(item.value)}</text>
  `;
}

function reportRows(rows, x, y, width) {
  let cursorY = y;
  const colors = getReportVisualStyle().colors;
  return rows.map((row) => {
    if (row.type === "section") {
      const isFirstSection = cursorY === y;
      const lineY = cursorY - (isFirstSection ? 18 : 18);
      const textY = cursorY + (isFirstSection ? 0 : 10);
      const separator = isFirstSection ? "" : `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="${colors.line}" stroke-width="1"/>`;
      const markup = `${separator}<text class="section" x="${x}" y="${textY}">${escapeXml(row.label)}</text>`;
      cursorY += isFirstSection ? 30 : 38;
      return markup;
    }
    if (row.type === "subsection") {
      const markup = `<text class="subsection" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>`;
      cursorY += 24;
      return markup;
    }
    const valueX = x + width * 0.72;
    if (row.valueNextLine) {
      const markup = `
        <text class="label" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>
        <text class="value" x="${valueX}" y="${cursorY + 20}">${escapeXml(row.value)}</text>
      `;
      cursorY += 56;
      return markup;
    }
    const markup = `
      <text class="label" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>
      <text class="value" x="${valueX}" y="${cursorY}">${escapeXml(row.value)}</text>
    `;
    cursorY += 38;
    return markup;
  }).join("");
}

function reportRowsHeight(rows) {
  let cursorY = 0;
  rows.forEach((row) => {
    if (row.type === "section") {
      cursorY += cursorY === 0 ? 30 : 38;
      return;
    }
    if (row.type === "subsection") {
      cursorY += 24;
      return;
    }
    cursorY += row.valueNextLine ? 56 : 38;
  });
  return cursorY;
}

function reportDetailRows(rows, x, y, width, rowHeight = 24, separatorHeight = 12) {
  let cursorY = y;
  const contentIndent = 14;
  const colors = getReportVisualStyle().colors;
  let hasRenderedDetailItem = false;
  return rows.map((row) => {
    if (row.type === "separator") {
      const lineY = cursorY - separatorHeight * 0.8;
      cursorY += separatorHeight;
      return `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="${colors.line}" stroke-width="1"/>`;
    }
    if (row.type === "group") {
      const groupTopGap = hasRenderedDetailItem ? Math.max(7, rowHeight * 0.45) : 0;
      const groupH = rowHeight * 1.14;
      const groupBottomGap = Math.max(3, rowHeight * 0.22);
      cursorY += groupTopGap;
      const rectY = cursorY - rowHeight * 0.78;
      const textY = cursorY;
      cursorY += groupH + groupBottomGap;
      return `
        <rect x="${x}" y="${rectY}" width="${width}" height="${groupH}" rx="6" fill="${colors.bg}"/>
        <text class="detail-group-label" x="${x + 9}" y="${textY}">${escapeXml(row.label)}</text>
      `;
    }
    if (row.type === "message") {
      const lines = splitReportMessage(row.value);
      const markup = `
        <text class="detail-message" x="${x}" y="${cursorY}">
          ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : rowHeight * 0.78}">${escapeXml(line)}</tspan>`).join("")}
        </text>
      `;
      cursorY += reportMessageHeight(row, rowHeight);
      hasRenderedDetailItem = true;
      return markup;
    }
    const rowY = cursorY;
    cursorY += rowHeight;
    hasRenderedDetailItem = true;
    return `
      <text class="detail-label" x="${x + contentIndent}" y="${rowY}">${escapeXml(row.label)}</text>
      <text class="detail-value" x="${x + width * 0.38 + contentIndent}" y="${rowY}">${escapeXml(row.value)}</text>
    `;
  }).join("");
}

function reportDetailRowsHeight(rows, rowHeight = 24, separatorHeight = 12) {
  let hasRenderedDetailItem = false;
  return rows.reduce((height, row) => {
    if (row.type === "separator") return height + separatorHeight;
    if (row.type === "group") {
      const groupTopGap = hasRenderedDetailItem ? Math.max(7, rowHeight * 0.45) : 0;
      return height + groupTopGap + rowHeight * 1.14 + Math.max(3, rowHeight * 0.22);
    }
    if (row.type === "message") {
      hasRenderedDetailItem = true;
      return height + reportMessageHeight(row, rowHeight);
    }
    hasRenderedDetailItem = true;
    return height + rowHeight;
  }, 0);
}

function reportMessageHeight(row, rowHeight) {
  return Math.max(rowHeight, splitReportMessage(row.value).length * rowHeight * 0.78 + rowHeight * 0.35);
}

function splitReportMessage(text, maxChars = 82) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    if (word.length <= maxChars) {
      line = word;
      return;
    }
    for (let index = 0; index < word.length; index += maxChars) {
      const chunk = word.slice(index, index + maxChars);
      if (chunk.length === maxChars) lines.push(chunk);
      else line = chunk;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function getReportInputRows() {
  return [
    { type: "section", label: reportTr("sidebar.nodeSection") },
    { label: reportTr("sidebar.nodeCount"), value: fields.serverCount.value },
    { label: reportTr("sidebar.nodeLinkPortCount"), value: fields.serverNicPorts.value },
    { label: reportTr("sidebar.nodeLinkPortSpeed"), value: `${fields.serverLinkSpeed.value} Gbps` },
    ...(fields.useMultiPlanar.checked ? [{
      label: reportTr("report.nodeTwinPortUsage"),
      value: formatReportTwinPortUsage(true, getTwinPortSpeedText(fields.serverLinkSpeed)),
    }] : []),
    { type: "section", label: reportTr("sidebar.switchSection") },
    { type: "subsection", label: "Leaf" },
    { label: reportTr("sidebar.leafPorts"), value: fields.switchPorts.value },
    { label: reportTr("sidebar.leafMinSparePorts"), value: fields.leafMinSparePorts.value },
    { label: reportTr("sidebar.leafLinkSpeed"), value: `${fields.switchLinkSpeed.value} Gbps` },
    { label: reportTr("results.labels.leafTwinPortUsage"), value: getReportLeafTwinUsageText() },
    { label: reportTr("sidebar.leafSpineDisableTwinPort"), value: fields.disableUplinkTwinPort.checked ? reportTr("common.use") : reportTr("common.unused") },
    { type: "subsection", label: "Spine" },
    { label: reportTr("sidebar.spineSameAsLeaf"), value: fields.spineSameAsLeaf.checked ? reportTr("common.use") : reportTr("common.unused") },
    { label: reportTr("sidebar.spinePorts"), value: fields.spineSwitchPorts.value },
    { label: reportTr("sidebar.spineLinkSpeed"), value: `${fields.spineSwitchLinkSpeed.value} Gbps` },
    { label: reportTr("results.labels.spineTwinPortUsage"), value: formatReportTwinPortUsage(fields.spineUseTwinPort.checked, getTwinPortSpeedText(fields.spineSwitchLinkSpeed)) },
    { type: "section", label: reportTr("sidebar.topologySection") },
    { label: reportTr("report.topology"), value: getMode() === "oversubscribed" ? "Oversubscribed" : "Non-blocking" },
    { label: "Multi-planar Design", value: fields.useMultiPlanar.checked ? reportTr("common.use") : reportTr("common.unused") },
    { label: "Multi-pods Design", value: fields.useMultiPods.checked ? reportTr("common.use") : reportTr("common.unused") },
    ...(fields.useMultiPods.checked ? [{ label: reportTr("sidebar.podNodeCount"), value: fields.podServerCount.value }] : []),
  ];
}

function getReportMetrics() {
  return [
    { label: "Leaf", value: outputs.leafCount.textContent },
    { label: "Spine", value: outputs.spineCount.textContent },
    { label: reportTr("summary.oversubRatio"), value: outputs.oversubRatio.textContent },
    { label: reportTr("summary.totalSwitches"), value: outputs.totalSwitches.textContent },
  ];
}

function getReportLeafTwinUsageText() {
  return formatReportTwinPortUsage(fields.useTwinPort.checked, getTwinPortSpeedText(fields.switchLinkSpeed));
}

function formatReportTwinPortUsage(isEnabled, speedText, useText = reportTr("common.use"), unusedText = reportTr("common.unused")) {
  return isEnabled ? `${speedText} ${useText}` : unusedText;
}

function formatReportHeaderRows(generatedAtText, creditText) {
  return [generatedAtText, creditText];
}

function getReportHeaderMetaStyle() {
  return { ...REPORT_HEADER_META_STYLE };
}

function getReportHeaderSpacing() {
  return { ...REPORT_HEADER_SPACING };
}

function getReportVisualStyle() {
  return {
    ...REPORT_VISUAL_STYLE,
    colors: { ...REPORT_VISUAL_STYLE.colors },
    title: { ...REPORT_VISUAL_STYLE.title },
    section: { ...REPORT_VISUAL_STYLE.section },
    subsection: { ...REPORT_VISUAL_STYLE.subsection },
    label: { ...REPORT_VISUAL_STYLE.label },
    value: { ...REPORT_VISUAL_STYLE.value },
    metric: { ...REPORT_VISUAL_STYLE.metric },
    panelTitle: { ...REPORT_VISUAL_STYLE.panelTitle },
    detail: { ...REPORT_VISUAL_STYLE.detail },
  };
}

function getReportDiagramSourceSize() {
  return { ...REPORT_DIAGRAM_SOURCE_SIZE };
}

function getReportDiagramViewportRect(availableWidth, availableHeight, sourceSize = {}) {
  const sourceWidth = Math.max(1, Number(sourceSize.width) || availableWidth);
  const sourceHeight = Math.max(1, Number(sourceSize.height) || availableHeight);
  const sourceAspect = sourceWidth / sourceHeight;
  let width = availableWidth;
  let height = width / sourceAspect;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * sourceAspect;
  }
  return {
    x: (availableWidth - width) / 2,
    y: (availableHeight - height) / 2,
    width,
    height,
  };
}

function getReportDiagramRequiredHeight(viewportWidth, sourceSize = {}, baseMinHeight = 420) {
  const sourceWidth = Math.max(1, Number(sourceSize.width) || 16);
  const sourceHeight = Math.max(1, Number(sourceSize.height) || 9);
  const sourceAspect = sourceWidth / sourceHeight;
  const viewportHeight = viewportWidth / sourceAspect;
  return Math.max(baseMinHeight, Math.ceil(viewportHeight + 68));
}

function getReportDetailRows() {
  const rows = [];
  [...outputs.detailList.children].forEach((item) => {
    if (item.classList.contains("detail-group")) {
      rows.push({ type: "group", label: item.textContent });
      return;
    }
    if (item.classList.contains("detail-separator")) {
      rows.push({ type: "separator" });
      return;
    }
    if (item.tagName !== "DT") return;
    const value = item.nextElementSibling?.tagName === "DD" ? item.nextElementSibling.textContent : "";
    rows.push({ label: item.textContent, value });
  });
  const message = outputs.message.textContent.trim();
  if (message) {
    if (rows.at(-1)?.type !== "separator") {
      rows.push({ type: "separator" });
    }
    rows.push({ type: "message", value: message });
  }
  return rows;
}

function makeVisibleDiagramSvgMarkup(width, height) {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return "";
  LeafSpineDiagram.adjustLabelBadges(svg);
  return makeReportDiagramSvgFromElement(svg, width, height);
}

function makeReportDiagramSvgFromElement(svg, width, height) {
  const clone = svg.cloneNode(true);
  prepareReportDiagramSvgClone(clone, width, height);
  return stripReportDiagramStyleState(new XMLSerializer().serializeToString(clone));
}

function makeReportDiagramSvgFromCurrentMarkup(markup, width, height) {
  const svg = parseSvgMarkup(markup);
  if (!svg) return "";
  prepareReportDiagramSvgClone(svg, width, height);
  return stripReportDiagramStyleState(serializeSvgNode(svg));
}

function parseSvgMarkup(markup) {
  if (typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(markup, "image/svg+xml").querySelector("svg");
  }
  const match = String(markup).match(/<svg[\s\S]*<\/svg>/i);
  return match ? createStringSvgNode(match[0]) : null;
}

function createStringSvgNode(svgText) {
  return {
    text: svgText,
    setAttribute(name, value) {
      const openTag = this.text.match(/<svg\b[^>]*>/i)?.[0];
      if (!openTag) return;
      const pattern = new RegExp(`\\s${name}="[^"]*"`, "i");
      const nextOpenTag = pattern.test(openTag)
        ? openTag.replace(pattern, ` ${name}="${value}"`)
        : openTag.replace(/<svg/i, `<svg ${name}="${value}"`);
      this.text = this.text.replace(openTag, nextOpenTag);
    },
  };
}

function prepareReportDiagramSvgClone(svg, width, height) {
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  stripReportDiagramInteractionState(svg);
  if (typeof document !== "undefined" && svg.insertBefore) {
    svg.insertBefore(makePngSvgStyleElement(), svg.firstChild);
  }
}

function stripReportDiagramInteractionState(svg) {
  if (svg.text) {
    svg.text = svg.text
      .replace(/\sclass="([^"]*)"/g, (_match, classValue) => {
        const nextClass = classValue.split(/\s+/).filter((name) => !["is-selected", "is-highlighted", "is-dimmed"].includes(name)).join(" ");
        return nextClass ? ` class="${nextClass}"` : "";
      });
    return;
  }
  if (svg.querySelectorAll) {
    svg.querySelectorAll(".is-selected, .is-highlighted, .is-dimmed").forEach((node) => {
      node.classList.remove("is-selected", "is-highlighted", "is-dimmed");
    });
  }
}

function serializeSvgNode(svg) {
  if (svg.text) return svg.text;
  return new XMLSerializer().serializeToString(svg);
}

function stripReportDiagramStyleState(svgText) {
  return svgText.replace(/\.is-(?:selected|highlighted|dimmed)\s*\{[^}]*\}/g, "");
}

async function loadSvgImage(svgText) {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Report SVG image load failed."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed."));
    }, type, quality);
  });
}

async function makeSelectableReportPdf(generatedAtText = formatDisplayTimestamp(new Date())) {
  const layout = getReportLayout();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const scale = pageWidth / layout.pageWidth;
  const ops = [];
  const toX = (value) => value * scale;
  const toY = (value) => pageHeight - value * scale;
  const toW = (value) => value * scale;
  const toH = (value) => value * scale;

  const rect = (x, y, w, h, fill = getReportVisualStyle().colors.panel, stroke = getReportVisualStyle().colors.line) => {
    ops.push(`q ${pdfRgb(fill)} rg ${pdfRgb(stroke)} RG ${trim(toX(x))} ${trim(toY(y + h))} ${trim(toW(w))} ${trim(toH(h))} re B Q`);
  };
  const fillRect = (x, y, w, h, fill) => {
    ops.push(`q ${pdfRgb(fill)} rg ${trim(toX(x))} ${trim(toY(y + h))} ${trim(toW(w))} ${trim(toH(h))} re f Q`);
  };
  const line = (x1, y1, x2, y2, color = getReportVisualStyle().colors.line) => {
    ops.push(`q ${pdfRgb(color)} RG 0.6 w ${trim(toX(x1))} ${trim(toY(y1))} m ${trim(toX(x2))} ${trim(toY(y2))} l S Q`);
  };
  const text = (value, x, y, size = 10, color = getReportVisualStyle().colors.ink) => {
    ops.push(`BT /F2 ${trim(size * scale)} Tf ${pdfRgb(color)} rg ${trim(toX(x))} ${trim(toY(y))} Td <${pdfTextHex(value)}> Tj ET`);
  };
  const visualStyle = getReportVisualStyle();
  const colors = visualStyle.colors;

  fillRect(0, 0, layout.pageWidth, layout.pageHeight, colors.bg);
  const headerRows = formatReportHeaderRows(generatedAtText, reportTr("meta.credit"));
  const headerStyle = getReportHeaderMetaStyle();
  const headerSpacing = getReportHeaderSpacing();
  const titleY = layout.margin + 38 + layout.titleOffsetY;
  const headerRowsY = titleY + headerSpacing.titleToMetaGap;
  rect(layout.margin, layout.margin, layout.sidebarW, layout.sidebarH);
  text("Leaf-Spine Planner", layout.margin + 50, titleY, visualStyle.title.fontSize, colors.accent);
  headerRows.forEach((row, index) => {
    text(row, layout.margin + layout.sidebarW / 2 - 92, headerRowsY + index * headerSpacing.metaRowGap, headerStyle.fontSize, colors.ink);
  });
  line(layout.margin + 20, layout.sidebarDividerY, layout.margin + layout.sidebarW - 20, layout.sidebarDividerY);
  drawPdfRows(ops, layout.sidebarRows, layout.margin + 20, layout.sidebarTopRowsY, layout.sidebarW - 40, text);

  layout.metrics.forEach((item, index) => {
    const x = layout.contentX + index * ((layout.contentW - 36) / 4 + 12);
    const w = (layout.contentW - 36) / 4;
    rect(x, layout.margin, w, layout.metricH);
    text(item.label, x + 16, layout.margin + 32, visualStyle.metric.labelFontSize, colors.muted);
    text(item.value, x + 16, layout.margin + 74, visualStyle.metric.valueFontSize, colors.ink);
  });

  const detailY = layout.margin + layout.metricH + layout.gap;
  rect(layout.contentX, detailY, layout.contentW, layout.detailH);
  text(reportTr("report.resultTitle"), layout.contentX + 20, detailY + 32, visualStyle.panelTitle.fontSize, colors.ink);
  line(layout.contentX + 20, detailY + 46, layout.contentX + layout.contentW - 20, detailY + 46);
  drawPdfDetailRows(ops, layout.detailRows, layout.contentX + 20, detailY + layout.detailContentOffset, layout.contentW - 40, layout.detailRowH, layout.detailSeparatorH, layout.detailFontSize, text, line);

  rect(layout.contentX, layout.diagramY, layout.contentW, layout.diagramH);
  text(reportTr("report.diagramTitle"), layout.contentX + 20, layout.diagramY + 32, visualStyle.panelTitle.fontSize, colors.ink);

  const diagramBlob = await renderDiagramJpeg(layout.diagramViewportW, layout.diagramViewportH);
  const diagramBytes = new Uint8Array(await diagramBlob.arrayBuffer());
  const imageWidth = diagramBlob._width;
  const imageHeight = diagramBlob._height;
  const imageX = layout.diagramViewportX;
  const imageY = layout.diagramViewportY;
  rect(imageX, imageY, layout.diagramViewportW, layout.diagramViewportH, colors.diagramBg, colors.line);
  ops.push(`q ${trim(toW(layout.diagramViewportW))} 0 0 ${trim(toH(layout.diagramViewportH))} ${trim(toX(imageX))} ${trim(toY(imageY + layout.diagramViewportH))} cm /Im0 Do Q`);

  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${trim(pageWidth)} ${trim(pageHeight)}] /Resources << /Font << /F2 4 0 R >> /XObject << /Im0 7 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /HYGoThic-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [5 0 R] >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYGoThic-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> >>",
    `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    {
      header: `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${diagramBytes.length} >>`,
      bytes: diagramBytes,
    },
  ];
  return buildPdf(objects);
}

function getReportLayout() {
  const pageWidth = 1320;
  const pageHeight = 1867;
  const margin = 20;
  const gap = 18;
  const sidebarW = 380;
  const contentX = margin + sidebarW + gap;
  const contentW = pageWidth - contentX - margin;
  const sidebarRows = getReportInputRows();
  const detailRows = getReportDetailRows();
  const metrics = getReportMetrics();
  const titleOffsetY = 10;
  const headerRows = formatReportHeaderRows("", "");
  const titleY = margin + 38 + titleOffsetY;
  const headerSpacing = getReportHeaderSpacing();
  const headerRowsY = titleY + headerSpacing.titleToMetaGap;
  const sidebarDividerY = headerRowsY + headerSpacing.metaRowGap * (headerRows.length - 1) + headerSpacing.metaToDividerGap;
  const sidebarTopRowsY = sidebarDividerY + 28;
  const sidebarH = sidebarTopRowsY - margin + reportRowsHeight(sidebarRows) + 18;
  const metricH = 104;
  const diagramSourceSize = getReportDiagramSourceSize();
  const diagramH = getReportDiagramRequiredHeight(contentW - 32, diagramSourceSize, 420);
  const detailContentOffset = 76;
  const maxDetailH = pageHeight - (margin + metricH + gap + gap + diagramH) - margin;
  const detailScale = Math.min(1, Math.max(0.66, (maxDetailH - detailContentOffset) / reportDetailRowsHeight(detailRows)));
  const detailRowH = 24 * detailScale;
  const detailSeparatorH = 12 * detailScale;
  const detailFontSize = 14 * detailScale;
  const detailH = Math.max(142, Math.min(maxDetailH, detailContentOffset + reportDetailRowsHeight(detailRows, detailRowH, detailSeparatorH)));
  const diagramY = pageHeight - margin - diagramH;
  const diagramViewportArea = { x: contentX + 16, y: diagramY + 52, width: contentW - 32, height: diagramH - 68 };
  const diagramViewportRect = getReportDiagramViewportRect(diagramViewportArea.width, diagramViewportArea.height, diagramSourceSize);
  return {
    pageWidth,
    pageHeight,
    margin,
    gap,
    titleOffsetY,
    sidebarW,
    contentX,
    contentW,
    sidebarRows,
    detailRows,
    metrics,
    sidebarDividerY,
    sidebarTopRowsY,
    sidebarH,
    metricH,
    detailRowH,
    detailSeparatorH,
    detailFontSize,
    detailContentOffset,
    detailH,
    diagramH,
    diagramY,
    diagramViewportX: diagramViewportArea.x + diagramViewportRect.x,
    diagramViewportY: diagramViewportArea.y + diagramViewportRect.y,
    diagramViewportW: diagramViewportRect.width,
    diagramViewportH: diagramViewportRect.height,
  };
}

function drawPdfRows(ops, rows, x, y, width, text) {
  let cursorY = y;
  const style = getReportVisualStyle();
  const colors = style.colors;
  rows.forEach((row) => {
    if (row.type === "section") {
      const isFirstSection = cursorY === y;
      const lineY = cursorY - (isFirstSection ? 18 : 18);
      const textY = cursorY + (isFirstSection ? 0 : 10);
      if (cursorY !== y) {
        ops.push(`q ${pdfRgb(colors.line)} RG 0.6 w ${trim(x * (595.28 / 1320))} ${trim(841.89 - lineY * (595.28 / 1320))} m ${trim((x + width) * (595.28 / 1320))} ${trim(841.89 - lineY * (595.28 / 1320))} l S Q`);
      }
      text(row.label, x, textY, style.section.fontSize, colors.accentDark);
      cursorY += isFirstSection ? 30 : 38;
      return;
    }
    if (row.type === "subsection") {
      text(row.label, x, cursorY, style.subsection.fontSize, colors.ink);
      cursorY += 24;
      return;
    }
    if (row.valueNextLine) {
      text(row.label, x, cursorY, style.label.fontSize, colors.muted);
      text(row.value, x + width * 0.72, cursorY + 20, style.value.fontSize, colors.ink);
      cursorY += 56;
      return;
    }
    text(row.label, x, cursorY, style.label.fontSize, colors.muted);
    text(row.value, x + width * 0.72, cursorY, style.value.fontSize, colors.ink);
    cursorY += 38;
  });
}

function drawPdfDetailRows(ops, rows, x, y, width, rowHeight, separatorHeight, fontSize, text, line) {
  let cursorY = y;
  const contentIndent = 14;
  const style = getReportVisualStyle();
  const colors = style.colors;
  let hasRenderedDetailItem = false;
  rows.forEach((row) => {
    if (row.type === "separator") {
      line(x, cursorY - separatorHeight * 0.8, x + width, cursorY - separatorHeight * 0.8);
      cursorY += separatorHeight;
      return;
    }
    if (row.type === "group") {
      const scale = 595.28 / 1320;
      const pageHeight = 841.89;
      const groupTopGap = hasRenderedDetailItem ? Math.max(7, rowHeight * 0.45) : 0;
      const groupH = rowHeight * 1.14;
      const groupBottomGap = Math.max(3, rowHeight * 0.22);
      cursorY += groupTopGap;
      const rectY = cursorY - rowHeight * 0.78;
      ops.push(`q ${pdfRgb(colors.bg)} rg ${trim(x * scale)} ${trim(pageHeight - (rectY + groupH) * scale)} ${trim(width * scale)} ${trim(groupH * scale)} re f Q`);
      text(row.label, x + 9, cursorY, Math.max(12, fontSize - 1), colors.accentDark);
      cursorY += groupH + groupBottomGap;
      return;
    }
    if (row.type === "message") {
      splitReportMessage(row.value).forEach((messageLine, index) => {
        text(messageLine, x, cursorY + index * rowHeight * 0.78, style.label.fontSize, colors.muted);
      });
      cursorY += reportMessageHeight(row, rowHeight);
      hasRenderedDetailItem = true;
      return;
    }
    text(row.label, x + contentIndent, cursorY, fontSize, colors.muted);
    text(row.value, x + width * 0.38 + contentIndent, cursorY, fontSize, colors.ink);
    cursorY += rowHeight;
    hasRenderedDetailItem = true;
  });
}

async function renderDiagramJpeg(width, height) {
  const svgText = makeVisibleDiagramSvgMarkup(width, height);
  const image = await loadSvgImage(svgText);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = getReportVisualStyle().colors.diagramBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  blob._width = canvas.width;
  blob._height = canvas.height;
  return blob;
}

function pdfRgb(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return `${trim(r)} ${trim(g)} ${trim(b)}`;
}

function pdfTextHex(value) {
  const text = String(value);
  let hex = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hex += code.toString(16).padStart(4, "0");
  }
  return hex.toUpperCase();
}

if (typeof module !== "undefined") {
  module.exports = {
    formatReportHeaderRows,
    formatReportTwinPortUsage,
    getReportDiagramViewportRect,
    getReportDiagramRequiredHeight,
    getReportDiagramSourceSize,
    makeReportDiagramSvgFromCurrentMarkup,
    getReportHeaderMetaStyle,
    getReportHeaderSpacing,
    getReportVisualStyle,
  };
}
