/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Topology PPTX export using PptxGenJS.

async function exportDiagramPptx(viewMode = diagramViewMode) {
  if (!currentResult) return;

  try {
    await LeafSpineExportUtils.ensurePptxGenLoaded();
    const pptx = buildPptxWithPptxGen(currentResult, viewMode);
    const blob = await pptx.write({ outputType: "blob", compression: true });
    downloadBlob(blob, exportFilename("leaf-spine-topology", "pptx"));
  } catch (error) {
    console.error(error);
    alert("PPTX 파일을 만드는 중 오류가 발생했습니다.");
  }
}

window.exportDiagramPptx = exportDiagramPptx;

function buildPptxWithPptxGen(result, viewMode = diagramViewMode) {
  const geometry = diagramGeometryForView(result, viewMode);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "임채성";
  pptx.company = "Leaf-Spine Planner";
  pptx.subject = "Leaf-Spine Topology";
  pptx.title = "Leaf-Spine Topology";

  const slideW = 13.333;
  const slideH = 7.5;
  const margin = 0.25;
  const exportScale = typeof DIAGRAM_EXPORT_CONTENT_SCALE === "number" ? DIAGRAM_EXPORT_CONTENT_SCALE : 0.8;

  const slide = pptx.addSlide();

  const scale = Math.min((slideW - margin * 2) / geometry.width, (slideH - margin * 2) / geometry.height) * exportScale;
  const offsetX = (slideW - geometry.width * scale) / 2;
  const offsetY = (slideH - geometry.height * scale) / 2;
  const toX = (value) => offsetX + value * scale;
  const toY = (value) => offsetY + value * scale;
  const toL = (value) => value * scale;

  geometry.labels.forEach((label) => {
    slide.addText(label.text, {
      x: toX(label.x),
      y: toY(label.y - 9),
      w: toL(74),
      h: toL(18),
      fontFace: "Arial",
      fontSize: 9,
      bold: true,
      color: "5B6B86",
      align: "left",
      valign: "mid",
      margin: 0,
      fit: "shrink",
    });
  });

  geometry.lines.forEach((link) => {
    const x1 = toX(link.x1);
    const y1 = toY(link.y1);
    const x2 = toX(link.x2);
    const y2 = toY(link.y2);
    slide.addShape("line", {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.max(Math.abs(x2 - x1), 0.001),
      h: Math.max(Math.abs(y2 - y1), 0.001),
      flipH: x2 < x1,
      flipV: y2 < y1,
      line: { color: cleanColor(link.color), width: 0.65, transparency: 12 },
    });
  });

  geometry.switches.forEach((sw) => {
    addPptSwitch(slide, sw, toX, toY, toL);
  });

  geometry.servers.forEach((server) => {
    addPptServer(slide, server, toX, toY, toL);
  });

  (geometry.ellipsis || []).forEach((item) => {
    addPptEllipsis(slide, item, toX, toY, toL);
  });

  return pptx;
}

function addPptSwitch(slide, sw, toX, toY, toL) {
  const bodyColor = sw.kind === "spine" ? "B45309" : "2563EB";
  const lineColor = sw.kind === "spine" ? "92400E" : "1E40AF";
  const x = toX(sw.x - sw.w / 2);
  const y = toY(sw.y - sw.h / 2);
  const w = toL(sw.w);
  const h = toL(sw.h);

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.04,
    fill: { color: bodyColor },
    line: { color: lineColor, width: 0.6 },
  });
  slide.addShape("roundRect", {
    x: toX(sw.x - sw.w / 2 + 6),
    y: toY(sw.y - sw.h / 2 + 5),
    w: toL(sw.w - 12),
    h: toL(sw.h - 10),
    fill: { color: "FFFFFF", transparency: 82 },
    line: { color: "FFFFFF", transparency: 78, width: 0.35 },
  });
  for (let index = 0; index < 10; index += 1) {
    slide.addShape("rect", {
      x: toX(sw.x - sw.w / 2 + 14 + index * 7),
      y: toY(sw.y - 4),
      w: toL(4),
      h: toL(5),
      fill: { color: "E5E7EB" },
      line: { color: "111827", width: 0.25 },
    });
  }
  slide.addShape("ellipse", {
    x: toX(sw.x + sw.w / 2 - 16.4),
    y: toY(sw.y - 4.4),
    w: toL(4.8),
    h: toL(4.8),
    fill: { color: "86EFAC" },
    line: { color: "166534", width: 0.25 },
  });
  addPptxGenLabelBadge(slide, sw.x, sw.y + sw.h / 2 + 14, sw.label, toX, toY, toL);
}

function addPptServer(slide, server, toX, toY, toL) {
  slide.addShape("roundRect", {
    x: toX(server.x - server.w / 2),
    y: toY(server.y - server.h / 2),
    w: toL(server.w),
    h: toL(server.h),
    fill: { color: "475569" },
    line: { color: "334155", width: 0.6 },
  });
  slide.addShape("roundRect", {
    x: toX(server.x - server.w / 2 + 6),
    y: toY(server.y - server.h / 2 + 16),
    w: toL(server.w - 12),
    h: toL(server.h - 24),
    fill: { color: "64748B" },
    line: { color: "334155", width: 0.4 },
  });
  slide.addShape("ellipse", {
    x: toX(server.x + server.w / 2 - 14.5),
    y: toY(server.y + server.h / 2 - 12.5),
    w: toL(5),
    h: toL(5),
    fill: { color: "86EFAC" },
    line: { color: "166534", width: 0.25 },
  });
  server.ports.forEach((port) => {
    slide.addShape("rect", {
      x: toX(port.x - 3),
      y: toY(port.y),
      w: toL(6),
      h: toL(8),
      fill: { color: cleanColor(port.color) },
      line: { color: "1F2937", width: 0.3 },
    });
  });
  addPptxGenLabelBadge(slide, server.x, server.y + server.h / 2 + 14, server.label, toX, toY, toL);
}

function addPptEllipsis(slide, item, toX, toY, toL) {
  slide.addShape("roundRect", {
    x: toX(item.x - item.w / 2),
    y: toY(item.y - item.h / 2),
    w: toL(item.w),
    h: toL(item.h),
    fill: { color: "EEF2F7" },
    line: { color: "94A3B8", width: 0.6, dash: "dash" },
  });
  slide.addText("...", {
    x: toX(item.x - item.w / 2),
    y: toY(item.y - item.h / 2 + 1),
    w: toL(item.w),
    h: toL(item.h / 2),
    fontFace: "Arial",
    fontSize: 11,
    bold: true,
    color: "334155",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
  addPptxGenLabelBadge(slide, item.x, item.y + item.h / 2 + 14, item.label, toX, toY, toL, 6);
}

function addPptxGenLabelBadge(slide, x, y, text, toX, toY, toL, fontSize = 6.6) {
  const { width, height } = pptLabelBadgeSize(text);
  const padding = 0.03937;
  const boxW = toL(width) + padding * 2;
  const boxH = toL(height) + padding * 2;
  slide.addText(String(text || ""), {
    x: toX(x) - boxW / 2,
    y: toY(y) - boxH / 2,
    w: boxW,
    h: boxH,
    fontFace: "Arial",
    fontSize,
    bold: false,
    color: "0F172A",
    fill: { color: "FFFFFF" },
    line: { color: "111827", width: 0.25 },
    align: "center",
    valign: "mid",
    margin: padding,
    wrap: false,
    fit: "resize",
  });
}

