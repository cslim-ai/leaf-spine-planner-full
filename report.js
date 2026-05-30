// A4 one-page report PDF export helpers.
// This file uses app globals at click time and diagram SVG helpers from diagram.js.

async function exportPagePdf() {
  if (!currentResult) return;
  const button = outputs.exportPdf;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "저장 중...";

  try {
    const generatedAt = makeExportTimestamp();
    const canvas = await renderReportCanvas(generatedAt.display);
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
    const pdfBlob = await makePdfFromImageBlob(jpegBlob, canvas.width, canvas.height);
    downloadBlob(pdfBlob, exportFilename("leaf-spine-topology-report", "pdf", generatedAt));
  } catch (error) {
    console.error(error);
    alert("PDF 파일을 만드는 중 오류가 발생했습니다.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function renderReportCanvas(generatedAtText = formatDisplayTimestamp(new Date())) {
  const svgText = makeReportSvg(generatedAtText);
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

function makeReportSvg(generatedAtText = formatDisplayTimestamp(new Date())) {
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
  const sidebarH = 126 + sidebarRows.length * 38;
  const metricH = 92;
  const minDiagramH = 420;
  const maxDetailH = pageHeight - (margin + metricH + gap + gap + minDiagramH) - margin;
  const detailScale = Math.min(1, Math.max(0.66, (maxDetailH - 72) / reportDetailRowsHeight(detailRows)));
  const detailRowH = 24 * detailScale;
  const detailSeparatorH = 12 * detailScale;
  const detailFontSize = 13 * detailScale;
  const detailH = Math.max(142, Math.min(maxDetailH, 72 + reportDetailRowsHeight(detailRows, detailRowH, detailSeparatorH)));
  const diagramH = pageHeight - (margin + metricH + gap + detailH + gap) - margin;
  const diagramY = margin + metricH + gap + detailH + gap;
  const diagramSvg = makeVisibleDiagramSvgMarkup(contentW - 32, diagramH - 68);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">
      <style>
        svg { font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif; }
        .title { fill: #2563eb; font-size: 28px; font-weight: 900; text-anchor: middle; }
        .section { fill: #1d4ed8; font-size: 13px; font-weight: 900; }
        .label { fill: #5b6b86; font-size: 12px; font-weight: 800; }
        .value { fill: #0f172a; font-size: 13px; font-weight: 800; }
        .metric-label { fill: #5b6b86; font-size: 12px; font-weight: 900; }
        .metric-value { fill: #0f172a; font-size: 26px; font-weight: 900; }
        .panel-title { fill: #0f172a; font-size: 17px; font-weight: 900; }
        .detail-label { fill: #5b6b86; font-size: ${trim(detailFontSize)}px; font-weight: 800; }
        .detail-value { fill: #0f172a; font-size: ${trim(detailFontSize)}px; font-weight: 800; }
      </style>
      <rect width="100%" height="100%" fill="#eef5ff"/>
      ${reportPanel(margin, margin, sidebarW, sidebarH)}
      <text class="title" x="${margin + sidebarW / 2}" y="${margin + 38}">Leaf-Spine Planner</text>
      <text class="label" x="${margin + sidebarW / 2 + 116}" y="${margin + 60}" text-anchor="end">Created by 임채성 ${escapeXml(generatedAtText)}</text>
      <line x1="${margin + 20}" y1="${sidebarDividerY}" x2="${margin + sidebarW - 20}" y2="${sidebarDividerY}" stroke="#c8d8ee" stroke-width="1"/>
      ${reportRows(sidebarRows, margin + 20, sidebarTopRowsY, sidebarW - 40)}
      ${metrics.map((item, index) => reportMetricCard(contentX + index * ((contentW - 36) / 4 + 12), margin, (contentW - 36) / 4, metricH, item)).join("")}
      ${reportPanel(contentX, margin + metricH + gap, contentW, detailH)}
      <text class="panel-title" x="${contentX + 20}" y="${margin + metricH + gap + 32}">계산 결과</text>
      <line x1="${contentX + 20}" y1="${margin + metricH + gap + 46}" x2="${contentX + contentW - 20}" y2="${margin + metricH + gap + 46}" stroke="#c8d8ee" stroke-width="1"/>
      ${reportDetailRows(detailRows, contentX + 20, margin + metricH + gap + 72, contentW - 40, detailRowH, detailSeparatorH)}
      ${reportPanel(contentX, diagramY, contentW, diagramH)}
      <text class="panel-title" x="${contentX + 20}" y="${diagramY + 32}">네트워크 구성도</text>
      <g transform="translate(${contentX + 16} ${diagramY + 52})">${diagramSvg}</g>
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
      const markup = `<text class="section" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>`;
      cursorY += 28;
      return markup;
    }
    const valueX = x + width * 0.52;
    const markup = `
      <text class="label" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>
      <text class="value" x="${valueX}" y="${cursorY}">${escapeXml(row.value)}</text>
    `;
    cursorY += 38;
    return markup;
  }).join("");
}

function reportDetailRows(rows, x, y, width, rowHeight = 24, separatorHeight = 12) {
  let cursorY = y;
  return rows.map((row) => {
    if (row.type === "separator") {
      const lineY = cursorY - separatorHeight * 0.8;
      cursorY += separatorHeight;
      return `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="#c8d8ee" stroke-width="1"/>`;
    }
    const rowY = cursorY;
    cursorY += rowHeight;
    return `
      <text class="detail-label" x="${x}" y="${rowY}">${escapeXml(row.label)}</text>
      <text class="detail-value" x="${x + width * 0.38}" y="${rowY}">${escapeXml(row.value)}</text>
    `;
  }).join("");
}

function reportDetailRowsHeight(rows, rowHeight = 24, separatorHeight = 12) {
  return rows.reduce((height, row) => height + (row.type === "separator" ? separatorHeight : rowHeight), 0);
}

function getReportInputRows() {
  return [
    { type: "section", label: "서버" },
    { label: "서버 대수", value: fields.serverCount.value },
    { label: "서버 NIC 포트 수", value: fields.serverNicPorts.value },
    { label: "서버 NIC 링크 스피드", value: `${fields.serverLinkSpeed.value} Gbps` },
    { type: "section", label: "스위치" },
    { label: "스위치 포트 수", value: fields.switchPorts.value },
    { label: "스위치 링크 스피드", value: `${fields.switchLinkSpeed.value} Gbps` },
    { label: "Twin-port Transceiver", value: fields.useTwinPort.checked ? `${getTwinPortSpeedText()} 사용` : "미사용" },
    { label: "Leaf-Spine Twin-port", value: fields.useTwinPort.checked && fields.disableUplinkTwinPort.checked ? "미사용" : (fields.useTwinPort.checked ? "사용" : "미사용") },
    { type: "section", label: "구성 방식" },
    { label: "Topology", value: getMode() === "oversubscribed" ? "Oversubscribed" : "Non-blocking" },
    { label: "Multi-planar Design", value: fields.useMultiPlanar.checked ? "사용" : "미사용" },
    ...(fields.useMultiPlanar.checked ? [{ label: "Pod당 서버 수", value: fields.podServerCount.value }] : []),
  ];
}

function getReportMetrics() {
  return [
    { label: "Leaf 스위치", value: outputs.leafCount.textContent },
    { label: "Spine 스위치", value: outputs.spineCount.textContent },
    { label: "Oversub 비율", value: outputs.oversubRatio.textContent },
    { label: "총 스위치", value: outputs.totalSwitches.textContent },
  ];
}

function getReportDetailRows() {
  const rows = [];
  [...outputs.detailList.children].forEach((item) => {
    if (item.classList.contains("detail-separator")) {
      rows.push({ type: "separator" });
      return;
    }
    if (item.tagName !== "DT") return;
    const value = item.nextElementSibling?.tagName === "DD" ? item.nextElementSibling.textContent : "";
    rows.push({ label: item.textContent, value });
  });
  return rows;
}

function makeVisibleDiagramSvgMarkup(width, height) {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return "";
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
