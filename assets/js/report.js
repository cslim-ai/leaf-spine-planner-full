// A4 one-page report SVG export helpers.
// This file uses app globals at click time and diagram SVG helpers from diagram.js.

const REPORT_FONT_URL = "assets/fonts/Pretendard-Regular.ttf";
let reportFontCssPromise = null;

async function exportPagePdf() {
  return exportReport("pdf");
}

async function exportReport(format = "pdf") {
  if (!currentResult) return;
  const button = outputs.exportPdf;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "저장 중...";

  try {
    const generatedAt = makeExportTimestamp();
    if (format === "svg") {
      const blob = await makeReportSvgBlob(generatedAt.display);
      downloadBlob(blob, exportFilename("leaf-spine-topology-report", "svg", generatedAt));
      return;
    }

    const canvas = await renderReportCanvas(generatedAt.display);
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
    const pdfBlob = await makePdfFromImageBlob(jpegBlob, canvas.width, canvas.height);
    downloadBlob(pdfBlob, exportFilename("leaf-spine-topology-report", "pdf", generatedAt));
  } catch (error) {
    console.error(error);
    alert("리포트 파일을 만드는 중 오류가 발생했습니다.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function exportReportSvg() {
  return exportReport("svg");
}

async function makeReportSvgBlob(generatedAtText) {
  const fontCss = await getEmbeddedReportFontCss();
  const svgText = makeReportSvg(generatedAtText, fontCss);
  return new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
}

function getEmbeddedReportFontCss() {
  if (!reportFontCssPromise) {
    reportFontCssPromise = getReportFontDataUrls()
      .then((urls) => `
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.thin}") format("truetype");
          font-weight: 100;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.extraLight}") format("truetype");
          font-weight: 200;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.light}") format("truetype");
          font-weight: 300;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.regular}") format("truetype");
          font-weight: 400;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.medium}") format("truetype");
          font-weight: 500;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.semiBold}") format("truetype");
          font-weight: 600;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.bold}") format("truetype");
          font-weight: 700;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.extraBold}") format("truetype");
          font-weight: 800;
          font-style: normal;
          font-display: block;
        }
        @font-face {
          font-family: "Pretendard";
          src: url("${urls.black}") format("truetype");
          font-weight: 900;
          font-style: normal;
          font-display: block;
        }
      `);
  }
  return reportFontCssPromise;
}

async function getReportFontDataUrls() {
  if (window.LEAF_SPINE_FONT_DATA_URLS) {
    return window.LEAF_SPINE_FONT_DATA_URLS;
  }
  const [thin, extraLight, light, regular, medium, semiBold, bold, extraBold, black] = await Promise.all([
    fetchReportFontDataUrl("assets/fonts/Pretendard-Thin.ttf"),
    fetchReportFontDataUrl("assets/fonts/Pretendard-ExtraLight.ttf"),
    fetchReportFontDataUrl("assets/fonts/Pretendard-Light.ttf"),
    fetchReportFontDataUrl(REPORT_FONT_URL),
    fetchReportFontDataUrl("assets/fonts/Pretendard-Medium.ttf"),
    fetchReportFontDataUrl("assets/fonts/Pretendard-SemiBold.ttf"),
    fetchReportFontDataUrl("assets/fonts/Pretendard-Bold.ttf"),
    fetchReportFontDataUrl("assets/fonts/Pretendard-ExtraBold.ttf"),
    fetchReportFontDataUrl("assets/fonts/Pretendard-Black.ttf"),
  ]);
  return { thin, extraLight, light, regular, medium, semiBold, bold, extraBold, black };
}

async function fetchReportFontDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font load failed: ${response.status}`);
  return blobToDataUrl(await response.blob());
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

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
  ctx.fillStyle = "#eef5ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function makeReportSvg(generatedAtText = formatDisplayTimestamp(new Date()), embeddedFontCss = "") {
  const pageWidth = 1320;
  const pageHeight = 1867;
  const margin = 20;
  const gap = 18;
  const sidebarW = 340;
  const contentX = margin + sidebarW + gap;
  const contentW = pageWidth - contentX - margin;
  const sidebarRows = getReportInputRows();
  const detailRows = getReportDetailRows();
  const metrics = getReportMetrics();
  const sidebarDividerY = margin + 80;
  const sidebarTopRowsY = margin + 108;
  const sidebarH = 126 + reportRowsHeight(sidebarRows);
  const metricH = 92;
  const minDiagramH = 420;
  const detailContentOffset = 76;
  const maxDetailH = pageHeight - (margin + metricH + gap + gap + minDiagramH) - margin;
  const detailScale = Math.min(1, Math.max(0.66, (maxDetailH - detailContentOffset) / reportDetailRowsHeight(detailRows)));
  const detailRowH = 24 * detailScale;
  const detailSeparatorH = 12 * detailScale;
  const detailFontSize = 14 * detailScale;
  const detailH = Math.max(142, Math.min(maxDetailH, detailContentOffset + reportDetailRowsHeight(detailRows, detailRowH, detailSeparatorH)));
  const diagramH = pageHeight - (margin + metricH + gap + detailH + gap) - margin;
  const diagramY = margin + metricH + gap + detailH + gap;
  const diagramViewportX = contentX + 16;
  const diagramViewportY = diagramY + 52;
  const diagramViewportW = contentW - 32;
  const diagramViewportH = diagramH - 68;
  const diagramSvg = makeVisibleDiagramSvgMarkup(diagramViewportW, diagramViewportH);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">
      <style>
        ${embeddedFontCss}
        svg, text { font-family: "Pretendard", Arial, sans-serif; }
        .title { fill: #2563eb; font-size: 30px; font-weight: 900; text-anchor: middle; }
        .section { fill: #1d4ed8; font-size: 16px; font-weight: 900; }
        .subsection { fill: #0f172a; font-size: 13px; font-weight: 900; }
        .label { fill: #5b6b86; font-size: 14px; font-weight: 700; }
        .value { fill: #0f172a; font-size: 14px; font-weight: 700; }
        .metric-label { fill: #5b6b86; font-size: 13px; font-weight: 900; }
        .metric-value { fill: #0f172a; font-size: 28px; font-weight: 900; }
        .panel-title { fill: #0f172a; font-size: 18px; font-weight: 900; }
        .detail-label { fill: #5b6b86; font-size: ${trim(detailFontSize)}px; font-weight: 800; }
        .detail-value { fill: #0f172a; font-size: ${trim(detailFontSize)}px; font-weight: 800; }
        .detail-group-label { fill: #1d4ed8; font-size: ${trim(Math.max(12, detailFontSize - 1))}px; font-weight: 900; }
        .detail-message { fill: #5b6b86; font-size: 14px; font-weight: 400; }
      </style>
      <rect width="100%" height="100%" fill="#eef5ff"/>
      ${reportPanel(margin, margin, sidebarW, sidebarH)}
      <text class="title" x="${margin + sidebarW / 2}" y="${margin + 38}">Leaf-Spine Planner</text>
      <text class="label" x="${margin + sidebarW / 2}" y="${margin + 60}" text-anchor="middle">Created by 임채성 ${escapeXml(generatedAtText)}</text>
      <line x1="${margin + 20}" y1="${sidebarDividerY}" x2="${margin + sidebarW - 20}" y2="${sidebarDividerY}" stroke="#c8d8ee" stroke-width="1"/>
      ${reportRows(sidebarRows, margin + 20, sidebarTopRowsY, sidebarW - 40)}
      ${metrics.map((item, index) => reportMetricCard(contentX + index * ((contentW - 36) / 4 + 12), margin, (contentW - 36) / 4, metricH, item)).join("")}
      ${reportPanel(contentX, margin + metricH + gap, contentW, detailH)}
      <text class="panel-title" x="${contentX + 20}" y="${margin + metricH + gap + 32}">계산 결과</text>
      <line x1="${contentX + 20}" y1="${margin + metricH + gap + 46}" x2="${contentX + contentW - 20}" y2="${margin + metricH + gap + 46}" stroke="#c8d8ee" stroke-width="1"/>
      ${reportDetailRows(detailRows, contentX + 20, margin + metricH + gap + detailContentOffset, contentW - 40, detailRowH, detailSeparatorH)}
      ${reportPanel(contentX, diagramY, contentW, diagramH)}
      <text class="panel-title" x="${contentX + 20}" y="${diagramY + 32}">네트워크 구성도</text>
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
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fff" stroke="#c8d8ee"/>`;
}

function reportDiagramViewport(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f8fbff" stroke="#c8d8ee"/>`;
}

function reportMetricCard(x, y, w, h, item) {
  return `
    ${reportPanel(x, y, w, h)}
    <text class="metric-label" x="${x + 16}" y="${y + 28}">${escapeXml(item.label)}</text>
    <text class="metric-value" x="${x + 16}" y="${y + 66}">${escapeXml(item.value)}</text>
  `;
}

function reportRows(rows, x, y, width) {
  let cursorY = y;
  return rows.map((row) => {
    if (row.type === "section") {
      const isFirstSection = cursorY === y;
      const lineY = cursorY - (isFirstSection ? 18 : 18);
      const textY = cursorY + (isFirstSection ? 0 : 10);
      const separator = isFirstSection ? "" : `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="#c8d8ee" stroke-width="1"/>`;
      const markup = `${separator}<text class="section" x="${x}" y="${textY}">${escapeXml(row.label)}</text>`;
      cursorY += isFirstSection ? 30 : 38;
      return markup;
    }
    if (row.type === "subsection") {
      const markup = `<text class="subsection" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>`;
      cursorY += 24;
      return markup;
    }
    const valueX = x + width * 0.62;
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
  let hasRenderedDetailItem = false;
  return rows.map((row) => {
    if (row.type === "separator") {
      const lineY = cursorY - separatorHeight * 0.8;
      cursorY += separatorHeight;
      return `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="#c8d8ee" stroke-width="1"/>`;
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
        <rect x="${x}" y="${rectY}" width="${width}" height="${groupH}" rx="6" fill="#eef5ff"/>
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
    { type: "section", label: "노드" },
    { label: "노드 수", value: fields.serverCount.value },
    { label: "노드당 연결 포트 수", value: fields.serverNicPorts.value },
    { label: "노드 연결 포트당 링크 스피드", value: `${fields.serverLinkSpeed.value} Gbps` },
    { type: "section", label: "스위치" },
    { type: "subsection", label: "Leaf" },
    { label: "Leaf당 포트 수", value: fields.switchPorts.value },
    { label: "Leaf 포트당 링크 스피드", value: `${fields.switchLinkSpeed.value} Gbps` },
    { label: "Leaf에 Twin-port Transceiver 사용", value: fields.useTwinPort.checked ? `${getTwinPortSpeedText(fields.switchLinkSpeed)} 사용` : "미사용", valueNextLine: true },
    { type: "subsection", label: "Spine" },
    { label: "Leaf와 사양 같음", value: fields.spineSameAsLeaf.checked ? "사용" : "미사용" },
    { label: "Spine당 포트 수", value: fields.spineSwitchPorts.value },
    { label: "Spine 포트당 링크 스피드", value: `${fields.spineSwitchLinkSpeed.value} Gbps` },
    { label: "Spine에 Twin-port Transceiver 사용", value: fields.spineUseTwinPort.checked ? `${getTwinPortSpeedText(fields.spineSwitchLinkSpeed)} 사용` : "미사용", valueNextLine: true },
    { type: "section", label: "구성 방식" },
    { label: "Topology", value: getMode() === "oversubscribed" ? "Oversubscribed" : "Non-blocking" },
    { label: "Multi-planar Design", value: fields.useMultiPlanar.checked ? "사용" : "미사용" },
    { label: "Multi-pods Design", value: fields.useMultiPods.checked ? "사용" : "미사용" },
    ...(fields.useMultiPods.checked ? [{ label: "Pod당 노드 수", value: fields.podServerCount.value }] : []),
  ];
}

function getReportMetrics() {
  return [
    { label: "Leaf", value: outputs.leafCount.textContent },
    { label: "Spine", value: outputs.spineCount.textContent },
    { label: "Oversub 비율", value: outputs.oversubRatio.textContent },
    { label: "총 스위치", value: outputs.totalSwitches.textContent },
  ];
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
  const clone = svg.cloneNode(true);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.insertBefore(makePngSvgStyleElement(), clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
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

  const rect = (x, y, w, h, fill = "FFFFFF", stroke = "C8D8EE") => {
    ops.push(`q ${pdfRgb(fill)} rg ${pdfRgb(stroke)} RG ${trim(toX(x))} ${trim(toY(y + h))} ${trim(toW(w))} ${trim(toH(h))} re B Q`);
  };
  const fillRect = (x, y, w, h, fill) => {
    ops.push(`q ${pdfRgb(fill)} rg ${trim(toX(x))} ${trim(toY(y + h))} ${trim(toW(w))} ${trim(toH(h))} re f Q`);
  };
  const line = (x1, y1, x2, y2, color = "C8D8EE") => {
    ops.push(`q ${pdfRgb(color)} RG 0.6 w ${trim(toX(x1))} ${trim(toY(y1))} m ${trim(toX(x2))} ${trim(toY(y2))} l S Q`);
  };
  const text = (value, x, y, size = 10, color = "0F172A") => {
    ops.push(`BT /F2 ${trim(size * scale)} Tf ${pdfRgb(color)} rg ${trim(toX(x))} ${trim(toY(y))} Td <${pdfTextHex(value)}> Tj ET`);
  };

  fillRect(0, 0, layout.pageWidth, layout.pageHeight, "EEF5FF");
  rect(layout.margin, layout.margin, layout.sidebarW, layout.sidebarH);
  text("Leaf-Spine Planner", layout.margin + 50, layout.margin + 38, 28, "2563EB");
  text(`Created by 임채성 ${generatedAtText}`, layout.margin + layout.sidebarW / 2 - 92, layout.margin + 60, 12, "5B6B86");
  line(layout.margin + 20, layout.sidebarDividerY, layout.margin + layout.sidebarW - 20, layout.sidebarDividerY);
  drawPdfRows(ops, layout.sidebarRows, layout.margin + 20, layout.sidebarTopRowsY, layout.sidebarW - 40, text);

  layout.metrics.forEach((item, index) => {
    const x = layout.contentX + index * ((layout.contentW - 36) / 4 + 12);
    const w = (layout.contentW - 36) / 4;
    rect(x, layout.margin, w, layout.metricH);
    text(item.label, x + 16, layout.margin + 28, 12, "5B6B86");
    text(item.value, x + 16, layout.margin + 66, 26, "0F172A");
  });

  const detailY = layout.margin + layout.metricH + layout.gap;
  rect(layout.contentX, detailY, layout.contentW, layout.detailH);
  text("계산 결과", layout.contentX + 20, detailY + 32, 17, "0F172A");
  line(layout.contentX + 20, detailY + 46, layout.contentX + layout.contentW - 20, detailY + 46);
  drawPdfDetailRows(ops, layout.detailRows, layout.contentX + 20, detailY + layout.detailContentOffset, layout.contentW - 40, layout.detailRowH, layout.detailSeparatorH, layout.detailFontSize, text, line);

  rect(layout.contentX, layout.diagramY, layout.contentW, layout.diagramH);
  text("네트워크 구성도", layout.contentX + 20, layout.diagramY + 32, 17, "0F172A");

  const diagramBlob = await renderDiagramJpeg(layout.contentW - 32, layout.diagramH - 68);
  const diagramBytes = new Uint8Array(await diagramBlob.arrayBuffer());
  const imageWidth = diagramBlob._width;
  const imageHeight = diagramBlob._height;
  const imageX = layout.contentX + 16;
  const imageY = layout.diagramY + 52;
  rect(imageX, imageY, layout.contentW - 32, layout.diagramH - 68, "F8FBFF", "C8D8EE");
  ops.push(`q ${trim(toW(layout.contentW - 32))} 0 0 ${trim(toH(layout.diagramH - 68))} ${trim(toX(imageX))} ${trim(toY(imageY + layout.diagramH - 68))} cm /Im0 Do Q`);

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
  const sidebarW = 340;
  const contentX = margin + sidebarW + gap;
  const contentW = pageWidth - contentX - margin;
  const sidebarRows = getReportInputRows();
  const detailRows = getReportDetailRows();
  const metrics = getReportMetrics();
  const sidebarDividerY = margin + 80;
  const sidebarTopRowsY = margin + 108;
  const sidebarH = 126 + reportRowsHeight(sidebarRows);
  const metricH = 92;
  const minDiagramH = 420;
  const detailContentOffset = 76;
  const maxDetailH = pageHeight - (margin + metricH + gap + gap + minDiagramH) - margin;
  const detailScale = Math.min(1, Math.max(0.66, (maxDetailH - detailContentOffset) / reportDetailRowsHeight(detailRows)));
  const detailRowH = 24 * detailScale;
  const detailSeparatorH = 12 * detailScale;
  const detailFontSize = 14 * detailScale;
  const detailH = Math.max(142, Math.min(maxDetailH, detailContentOffset + reportDetailRowsHeight(detailRows, detailRowH, detailSeparatorH)));
  const diagramH = pageHeight - (margin + metricH + gap + detailH + gap) - margin;
  const diagramY = margin + metricH + gap + detailH + gap;
  return {
    pageWidth,
    pageHeight,
    margin,
    gap,
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
  };
}

function drawPdfRows(ops, rows, x, y, width, text) {
  let cursorY = y;
  rows.forEach((row) => {
    if (row.type === "section") {
      const isFirstSection = cursorY === y;
      const lineY = cursorY - (isFirstSection ? 18 : 18);
      const textY = cursorY + (isFirstSection ? 0 : 10);
      if (cursorY !== y) {
        ops.push(`q ${pdfRgb("C8D8EE")} RG 0.6 w ${trim(x * (595.28 / 1320))} ${trim(841.89 - lineY * (595.28 / 1320))} m ${trim((x + width) * (595.28 / 1320))} ${trim(841.89 - lineY * (595.28 / 1320))} l S Q`);
      }
      text(row.label, x, textY, 16, "1D4ED8");
      cursorY += isFirstSection ? 30 : 38;
      return;
    }
    if (row.type === "subsection") {
      text(row.label, x, cursorY, 13, "0F172A");
      cursorY += 24;
      return;
    }
    if (row.valueNextLine) {
      text(row.label, x, cursorY, 14, "5B6B86");
      text(row.value, x + width * 0.62, cursorY + 20, 14, "0F172A");
      cursorY += 56;
      return;
    }
    text(row.label, x, cursorY, 14, "5B6B86");
    text(row.value, x + width * 0.62, cursorY, 14, "0F172A");
    cursorY += 38;
  });
}

function drawPdfDetailRows(ops, rows, x, y, width, rowHeight, separatorHeight, fontSize, text, line) {
  let cursorY = y;
  const contentIndent = 14;
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
      ops.push(`q ${pdfRgb("EEF5FF")} rg ${trim(x * scale)} ${trim(pageHeight - (rectY + groupH) * scale)} ${trim(width * scale)} ${trim(groupH * scale)} re f Q`);
      text(row.label, x + 9, cursorY, Math.max(12, fontSize - 1), "1D4ED8");
      cursorY += groupH + groupBottomGap;
      return;
    }
    if (row.type === "message") {
      splitReportMessage(row.value).forEach((messageLine, index) => {
        text(messageLine, x, cursorY + index * rowHeight * 0.78, 14, "5B6B86");
      });
      cursorY += reportMessageHeight(row, rowHeight);
      hasRenderedDetailItem = true;
      return;
    }
    text(row.label, x + contentIndent, cursorY, fontSize, "5B6B86");
    text(row.value, x + width * 0.38 + contentIndent, cursorY, fontSize, "0F172A");
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
  ctx.fillStyle = "#f8fbff";
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

async function makePdfFromImageBlob(imageBlob, imageWidth, imageHeight) {
  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const imageRatio = imageWidth / imageHeight;
  const pageRatio = pageWidth / pageHeight;
  const drawWidth = imageRatio > pageRatio ? pageWidth : pageHeight * imageRatio;
  const drawHeight = imageRatio > pageRatio ? pageWidth / imageRatio : pageHeight;
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = pageHeight - drawHeight;
  const content = `q\n${trim(drawWidth)} 0 0 ${trim(drawHeight)} ${trim(drawX)} ${trim(drawY)} cm\n/Im0 Do\nQ`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${trim(pageWidth)} ${trim(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    {
      header: `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>`,
      bytes: imageBytes,
    },
    `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  return buildPdf(objects);
}

function buildPdf(objects) {
  const chunks = [];
  const offsets = [0];
  let position = 0;
  const appendText = (text) => {
    const bytes = new TextEncoder().encode(text);
    chunks.push(bytes);
    position += bytes.length;
  };
  const appendBytes = (bytes) => {
    chunks.push(bytes);
    position += bytes.length;
  };

  appendText("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  objects.forEach((object, index) => {
    offsets[index + 1] = position;
    appendText(`${index + 1} 0 obj\n`);
    if (typeof object === "string") {
      appendText(`${object}\n`);
    } else {
      appendText(`${object.header}\nstream\n`);
      appendBytes(object.bytes);
      appendText("\nendstream\n");
    }
    appendText("endobj\n");
  });

  const xrefOffset = position;
  appendText(`xref\n0 ${objects.length + 1}\n`);
  appendText("0000000000 65535 f \n");
  for (let index = 1; index <= objects.length; index += 1) {
    appendText(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  appendText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

const LeafSpineReport = {
  export: exportReport,
  exportPdf: exportPagePdf,
  exportSvg: exportReportSvg,
  makeSvg: makeReportSvg,
};
