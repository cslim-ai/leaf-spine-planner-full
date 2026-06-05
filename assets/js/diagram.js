/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Diagram rendering, topology window, and topology PowerPoint export helpers.
// This file is loaded before app.js; functions use app globals at call time.

const DIAGRAM_EXPORT_CONTENT_SCALE = 0.8;

function makeDiagram({ input, best }) {
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const switchW = 116;
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const serverSlotWidth = Math.max(86, serverW + 14);
  const leafSlotWidth = Math.max(120, switchW + 12);
  const serverSlots = Math.max(shownServers, shownLeafs);
  const width = Math.max(920, labelGutter + serverSlots * Math.max(serverSlotWidth, leafSlotWidth) + 150);
  const height = 500;
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const spineY = 58;
  const leafY = 190;
  const serverY = 360;
  const spineXs = distribute(center, shownSpines, 126);
  const leafXs = distribute(center, shownLeafs, Math.max(120, Math.min(160, width / Math.max(shownLeafs, 1) * 0.8)));
  const serverXs = distribute(center, shownServers, Math.max(serverSlotWidth, Math.min(104, width / Math.max(shownServers, 1) * 0.8)));
  const lines = [];
  const nodes = [];

  spineXs.forEach((x, i) => {
    nodes.push(switchNode("spine", x, spineY, switchW, switchH, `Spine ${i + 1}`, { device: `Spine ${i + 1}`, deviceKey: `spine-${i}` }));
  });

  leafXs.forEach((leafX, leafIndex) => {
    spineXs.forEach((spineX, spineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, best.spines, spineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        const leafDevice = `Leaf ${leafIndex + 1}`;
        const spineDevice = `Spine ${spineIndex + 1}`;
        lines.push(line(
          leafX + offset,
          leafY - switchH / 2,
          spineX + offset,
          spineY + switchH / 2,
          "uplink",
          {
            stroke: leafColor(leafIndex),
            title: `${leafDevice} uplink`,
            source: leafDevice,
            target: spineDevice,
            sourceKey: `leaf-${leafIndex}`,
            targetKey: `spine-${spineIndex}`,
          },
        ));
      }
    });

    nodes.push(switchNode("leaf", leafX, leafY, switchW, switchH, `Leaf ${leafIndex + 1}`, { device: `Leaf ${leafIndex + 1}`, deviceKey: `leaf-${leafIndex}` }));
  });

  serverXs.forEach((serverX, serverIndex) => {
    const serverNumber = serverIndex + 1;
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;

    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = (nicLeafStart + nicIndex) % shownLeafs;
      const nicX = nicPortX(serverX, serverW, input.serverNicPorts, nicIndex);
      const nodeDevice = `Node #${serverNumber}`;
      const leafDevice = `Leaf ${leafIndex + 1}`;
      lines.push(line(
        nicX,
        serverY - serverH / 2,
        leafXs[leafIndex],
        leafY + switchH / 2,
        "link",
        {
          stroke: nicColor(nicIndex),
          title: `Node NIC ${nicIndex + 1}`,
          source: nodeDevice,
          target: leafDevice,
          sourceKey: `node-${serverIndex}`,
          targetKey: `leaf-${leafIndex}`,
        },
      ));
    }

    nodes.push(serverNode(serverX, serverY, serverW, serverH, serverNumber, input.serverNicPorts, `Node #${serverNumber}`, { device: `Node #${serverNumber}`, deviceKey: `node-${serverIndex}` }));
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" data-base-width="${width}" data-base-height="${height}" role="img">
      <title>Leaf-Spine 네트워크 구성도</title>
      ${lines.join("")}
      ${nodes.join("")}
    </svg>
  `;
}

function makeDiagramFromGeometry(geometry) {
  const lines = geometry.lines.map((item) => line(
    item.x1,
    item.y1,
    item.x2,
    item.y2,
    item.kind || "link",
    { stroke: item.color, title: item.title, source: item.source, target: item.target, sourceKey: item.sourceKey, targetKey: item.targetKey },
  ));
  const nodes = [
    ...geometry.switches.map((sw) => switchNode(sw.kind, sw.x, sw.y, sw.w, sw.h, sw.label, { device: sw.device || sw.label, deviceKey: sw.deviceKey })),
    ...geometry.servers.map((server) => serverNode(server.x, server.y, server.w, server.h, server.number, server.nicCount, server.label, { device: server.device || server.label, deviceKey: server.deviceKey })),
    ...(geometry.ellipsis || []).map((item) => ellipsisNode(item.x, item.y, item.w, item.h, item.label)),
  ];

  return `
    <svg viewBox="0 0 ${geometry.width} ${geometry.height}" data-base-width="${geometry.width}" data-base-height="${geometry.height}" role="img">
      <title>Leaf-Spine network topology</title>
      ${lines.join("")}
      ${nodes.join("")}
    </svg>
  `;
}

async function exportDiagramPng() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;

  const { clone, width, height } = makeExportSvgClone(svg);

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  const scale = 2;

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (blob) downloadBlob(blob, exportFilename("leaf-spine-topology", "png"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function exportDiagramSvg() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  const { clone } = makeExportSvgClone(svg);
  const svgText = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, exportFilename("leaf-spine-topology", "svg"));
}

function openDiagramWindow() {
  if (!currentResult) return;
  const variants = {
    full: makeExportSvgDataFromMarkup(makeDiagramFromGeometry(getDiagramGeometry(currentResult))),
    wrapped: makeExportSvgDataFromMarkup(makeDiagramFromGeometry(getPptDiagramGeometry(currentResult))),
    summary: makeExportSvgDataFromMarkup(makeDiagramFromGeometry(getSummaryDiagramGeometry(currentResult))),
  };
  const labels = {
    locale: typeof currentLocale === "string" ? currentLocale : "ko",
    title: typeof tr === "function" ? tr("diagram.title") : "네트워크 구성도",
    viewFull: typeof tr === "function" ? tr("diagram.viewFull") : "전체",
    viewWrapped: typeof tr === "function" ? tr("diagram.viewWrapped") : "줄바꿈",
    viewSummary: typeof tr === "function" ? tr("diagram.viewSummary") : "요약",
    center: typeof tr === "function" ? tr("diagram.center") : "가운데 정렬",
    fitToScreen: typeof tr === "function" ? tr("diagram.fitToScreen") : "화면에 맞춤",
    exportFormat: typeof tr === "function" ? tr("diagram.exportFormatAriaLabel") : "구성도 저장 형식",
    exportButton: typeof tr === "function" ? tr("diagram.exportButton") : "Export",
    portMapButton: typeof tr === "function" ? tr("diagram.portMapButton") : "Port Map",
    portMapNotConnected: typeof tr === "function" ? tr("portMap.notConnectedAlert") : "메인 페이지와 연결되어 있지 않아 Port Map을 열 수 없습니다.",
  };
  const initialView = diagramViewMode;
  const html = `<!doctype html>
<html lang="${escapeXml(labels.locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(labels.title)}</title>
    <style>
      ${makeEmbeddedPretendardFontCss()}
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #eef5ff;
        font-family: "Pretendard", Arial, sans-serif;
      }
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid #c8d8ee;
        background: rgba(255, 255, 255, 0.94);
      }
      .actions {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }
      .control-group {
        display: flex;
        gap: 5px;
        align-items: center;
      }
      button {
        min-height: 28px;
        padding: 0;
        border: 1px solid #c8d8ee;
        border-radius: 6px;
        background: #fff;
        color: #1d4ed8;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }
      button:hover { background: #dbeafe; }
      #viewFull,
      #viewSummary,
      #viewWrapped {
        width: 62px;
      }
      #zoomOut,
      #zoomIn,
      #zoomCenter,
      #zoomFit {
        width: 36px;
      }
      #zoomReset {
        width: 64px;
      }
      #downloadMenu,
      #downloadExport {
        width: 72px;
      }
      #openPortMap {
        width: 72px;
      }
      #downloadExport,
      #openPortMap {
        border-color: #2563eb;
        background: #2563eb;
        color: #fff;
      }
      #downloadExport:hover,
      #openPortMap:hover {
        border-color: #1d4ed8;
        background: #1d4ed8;
      }
      #zoomOut,
      #zoomIn,
      #zoomCenter,
      #zoomFit {
        font-size: 16px;
      }
      #zoomReset {
        font-size: 12px;
      }
      button.is-active {
        background: #2563eb;
        border-color: #2563eb;
        color: #fff;
      }
      .toolbar strong {
        color: #0f172a;
        font-size: 20px;
      }
      .viewer {
        width: 100vw;
        height: calc(100vh - 55px);
        overflow: hidden;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        background: #eef5ff;
      }
      .viewer.is-dragging {
        cursor: grabbing;
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        background: #fff;
      }
      .export-menu {
        position: relative;
      }
      .export-menu-list {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 5;
        display: none;
        min-width: 78px;
        padding: 6px;
        border: 1px solid #c8d8ee;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
      }
      .export-menu.is-open .export-menu-list {
        display: grid;
        gap: 4px;
      }
      .export-menu-list button {
        width: 100%;
        min-height: 28px;
        border: 0;
        padding: 0 10px;
        text-align: left;
        font-size: 12px;
        font-weight: 900;
      }
      [data-device] {
        cursor: pointer;
      }
      .is-dimmed {
        opacity: 0.2;
      }
      [data-device].is-selected {
        opacity: 1;
      }
      [data-device].is-selected .node-label-bg {
        stroke: #2563eb;
        stroke-width: 1.6;
      }
      [data-source][data-target].is-highlighted {
        opacity: 1;
        stroke-width: 2;
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <strong>${escapeXml(labels.title)}</strong>
      <div class="actions">
        <div class="control-group">
          <button id="viewFull" type="button">${escapeXml(labels.viewFull)}</button>
          <button id="viewWrapped" type="button">${escapeXml(labels.viewWrapped)}</button>
          <button id="viewSummary" type="button">${escapeXml(labels.viewSummary)}</button>
        </div>
        <div class="control-group">
          <button id="zoomOut" type="button">-</button>
          <button id="zoomReset" type="button">100%</button>
          <button id="zoomIn" type="button">+</button>
          <button id="zoomCenter" type="button" title="${escapeXml(labels.center)}" aria-label="${escapeXml(labels.center)}">⨁</button>
          <button id="zoomFit" type="button" title="${escapeXml(labels.fitToScreen)}" aria-label="${escapeXml(labels.fitToScreen)}">⇔</button>
        </div>
        <div class="control-group">
          <div id="downloadMenu" class="export-menu">
            <button id="downloadExport" type="button">${escapeXml(labels.exportButton)}</button>
            <div class="export-menu-list" role="menu" aria-label="${escapeXml(labels.exportFormat)}">
              <button type="button" data-export-value="svg">SVG</button>
              <button type="button" data-export-value="png">PNG</button>
              <button type="button" data-export-value="ppt">PPT</button>
            </div>
          </div>
          <button id="openPortMap" type="button">${escapeXml(labels.portMapButton)}</button>
        </div>
      </div>
    </div>
    <div id="viewer" class="viewer"></div>
    <script>
      const variants = ${JSON.stringify(variants)};
      const labels = ${JSON.stringify(labels)};
      const defaultViewWidth = 920;
      const defaultViewHeight = 500;
      const fitPadding = 24;
      const minZoom = 0.1;
      const maxZoom = 10;
      const zoomStep = 0.05;
      const viewer = document.querySelector("#viewer");
      const zoomReset = document.querySelector("#zoomReset");
      let svg = null;
      let baseWidth = 1;
      let baseHeight = 1;
      let viewMode = ${JSON.stringify(initialView)};
      let zoom = 1;
      let pan = { x: 0, y: 0 };
      let drag = null;
      let suppressNextClick = false;

      function trim(value) {
        return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "");
      }

      function getDiagramHighlightItemSelector() {
        return "[data-device], [data-source], [data-target], [data-source-key], [data-target-key]";
      }

      function usesDiagramUniqueHighlightKeys(targetSvg) {
        return !!(targetSvg && targetSvg.querySelector && targetSvg.querySelector("[data-device-key], [data-source-key], [data-target-key]"));
      }

      function getDiagramHighlightKey(item, strictKeys) {
        if (strictKeys) return (item && item.dataset && item.dataset.deviceKey) || "";
        return (item && item.dataset && (item.dataset.deviceKey || item.dataset.device)) || "";
      }

      function getDiagramLinkSourceKey(link, strictKeys) {
        if (strictKeys) return (link && link.dataset && link.dataset.sourceKey) || "";
        return (link && link.dataset && (link.dataset.sourceKey || link.dataset.source)) || "";
      }

      function getDiagramLinkTargetKey(link, strictKeys) {
        if (strictKeys) return (link && link.dataset && link.dataset.targetKey) || "";
        return (link && link.dataset && (link.dataset.targetKey || link.dataset.target)) || "";
      }

      function isDiagramLinkConnectedToKey(link, selectedKey, strictKeys) {
        return getDiagramLinkSourceKey(link, strictKeys) === selectedKey || getDiagramLinkTargetKey(link, strictKeys) === selectedKey;
      }

      function getConnectedHighlightKeys(links, selectedKey, strictKeys) {
        const highlightedKeys = new Set([selectedKey]);
        Array.from(links || []).forEach((link) => {
          const sourceKey = getDiagramLinkSourceKey(link, strictKeys);
          const targetKey = getDiagramLinkTargetKey(link, strictKeys);
          if (sourceKey === selectedKey && targetKey) highlightedKeys.add(targetKey);
          if (targetKey === selectedKey && sourceKey) highlightedKeys.add(sourceKey);
        });
        return highlightedKeys;
      }

      function viewportSize() {
        const rect = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
        let width = Math.min(defaultViewWidth, baseWidth);
        let height = Math.min(defaultViewHeight, baseHeight);
        const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : width / height;
        if (Number.isFinite(aspect) && aspect > 0) {
          if (width / height < aspect) {
            width = Math.max(width, height * aspect);
          } else if (width / height > aspect) {
            height = Math.max(height, width / aspect);
          }
        }
        return { width, height };
      }

      function viewBoxSize() {
        const viewport = viewportSize();
        return {
          width: viewport.width / zoom,
          height: viewport.height / zoom,
        };
      }

      function clampAxis(value, visible, total) {
        const slack = visible * 0.5;
        const min = Math.min(0, total - visible) - slack;
        const max = Math.max(0, total - visible) + slack;
        return Math.min(max, Math.max(min, value));
      }

      function applyView() {
        zoomReset.textContent = Math.round(zoom * 100) + "%";
        if (!svg) return;
        const size = viewBoxSize();
        pan.x = clampAxis(pan.x, size.width, baseWidth);
        pan.y = clampAxis(pan.y, size.height, baseHeight);
        svg.setAttribute("viewBox", trim(pan.x) + " " + trim(pan.y) + " " + trim(size.width) + " " + trim(size.height));
      }

      function clientPointToSvg(clientX, clientY) {
        const rect = svg.getBoundingClientRect();
        const size = viewBoxSize();
        return {
          x: pan.x + ((clientX - rect.left) / Math.max(rect.width, 1)) * size.width,
          y: pan.y + ((clientY - rect.top) / Math.max(rect.height, 1)) * size.height,
        };
      }

      function unitsPerPixel() {
        const rect = svg.getBoundingClientRect();
        const size = viewBoxSize();
        return {
          x: size.width / Math.max(rect.width, 1),
          y: size.height / Math.max(rect.height, 1),
        };
      }

      function setZoom(nextZoom, origin) {
        nextZoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));
        if (origin) {
          const before = clientPointToSvg(origin.x, origin.y);
          zoom = nextZoom;
          const after = clientPointToSvg(origin.x, origin.y);
          pan.x += before.x - after.x;
          pan.y += before.y - after.y;
        } else {
          zoom = nextZoom;
        }
        applyView();
      }

      function resetView() {
        zoom = 1;
        pan = centeredPan();
        applyView();
      }

      function centerView() {
        pan = centeredPan();
        applyView();
      }

      function fitView() {
        const viewport = viewportSize();
        const bounds = contentBounds();
        const targetWidth = Math.max(1, bounds.width + fitPadding * 2);
        zoom = Math.min(maxZoom, Math.max(minZoom, viewport.width / targetWidth));
        const size = viewBoxSize();
        pan = {
          x: bounds.x + bounds.width / 2 - size.width / 2,
          y: bounds.y + bounds.height / 2 - size.height / 2,
        };
        applyView();
      }

      function contentBounds() {
        const elementBounds = diagramElementBounds();
        if (elementBounds) return elementBounds;
        try {
          const bbox = svg.getBBox();
          if (bbox.width > 0 && bbox.height > 0) return bbox;
        } catch (error) {
          // Ignore transient layout states before the SVG is measurable.
        }
        return { x: 0, y: 0, width: baseWidth, height: baseHeight };
      }

      function diagramElementBounds() {
        const boxes = Array.from(svg.querySelectorAll(".node, .link, .uplink"))
          .map((element) => {
            try {
              const box = element.getBBox();
              return box.width > 0 && box.height > 0 ? box : null;
            } catch (error) {
              return null;
            }
          })
          .filter(Boolean);
        if (!boxes.length) return null;
        const minX = Math.min(...boxes.map((box) => box.x));
        const minY = Math.min(...boxes.map((box) => box.y));
        const maxX = Math.max(...boxes.map((box) => box.x + box.width));
        const maxY = Math.max(...boxes.map((box) => box.y + box.height));
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }

      function centeredPan() {
        if (!svg) return { x: 0, y: 0 };
        const size = viewBoxSize();
        return {
          x: (baseWidth - size.width) / 2,
          y: (baseHeight - size.height) / 2,
        };
      }

      function startDrag(event) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        if (event.pointerId !== undefined && viewer.setPointerCapture) viewer.setPointerCapture(event.pointerId);
        viewer.classList.add("is-dragging");
        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y, target: event.target, moved: false };
      }

      function moveDrag(event) {
        if (!drag) return;
        if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
        const scale = unitsPerPixel();
        pan.x = drag.panX - deltaX * scale.x;
        pan.y = drag.panY - deltaY * scale.y;
        applyView();
      }

      function endDrag(event) {
        if (!drag) return;
        if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
        const finishedDrag = drag;
        viewer.classList.remove("is-dragging");
        drag = null;
        if (finishedDrag.moved) {
          suppressNextClick = true;
          setTimeout(() => { suppressNextClick = false; }, 120);
          return;
        }
        highlightTarget(finishedDrag.target);
        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 120);
      }

      function clearHighlight() {
        if (!svg) return;
        svg.querySelectorAll(getDiagramHighlightItemSelector()).forEach((item) => {
          item.classList.remove("is-selected", "is-highlighted", "is-dimmed");
        });
      }

      function highlightTarget(target) {
        if (!svg) return;
        const node = target && typeof target.closest === "function" ? target.closest("[data-device]") : null;
        if (!node || !svg.contains(node)) {
          clearHighlight();
          return;
        }
        const strictKeys = usesDiagramUniqueHighlightKeys(svg);
        const selectedKey = getDiagramHighlightKey(node, strictKeys);
        if (!selectedKey) {
          clearHighlight();
          return;
        }
        const links = svg.querySelectorAll("[data-source-key], [data-target-key], [data-source][data-target]");
        const highlightedDevices = getConnectedHighlightKeys(links, selectedKey, strictKeys);
        svg.querySelectorAll("[data-device]").forEach((item) => {
          const highlighted = highlightedDevices.has(getDiagramHighlightKey(item, strictKeys));
          item.classList.toggle("is-selected", highlighted);
          item.classList.toggle("is-dimmed", !highlighted);
        });
        links.forEach((link) => {
          const connected = isDiagramLinkConnectedToKey(link, selectedKey, strictKeys);
          link.classList.toggle("is-highlighted", connected);
          link.classList.toggle("is-dimmed", !connected);
        });
      }

      function handleHighlightClick(event) {
        if (suppressNextClick) {
          suppressNextClick = false;
          return;
        }
        highlightTarget(event.target);
      }

      function exportClone() {
        adjustLabelBadges(svg);
        const clone = svg.cloneNode(true);
        clone.setAttribute("viewBox", "0 0 " + baseWidth + " " + baseHeight);
        clone.setAttribute("width", baseWidth);
        clone.setAttribute("height", baseHeight);
        scaleExportContent(clone, baseWidth, baseHeight);
        return clone;
      }

      function scaleExportContent(targetSvg, width, height) {
        const scale = 0.8;
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", "translate(" + trim(width / 2) + " " + trim(height / 2) + ") scale(" + scale + ") translate(" + trim(-width / 2) + " " + trim(-height / 2) + ")");
        Array.from(targetSvg.childNodes)
          .filter((node) => node.nodeType === Node.ELEMENT_NODE && !["title", "style"].includes(node.tagName.toLowerCase()))
          .forEach((node) => group.appendChild(node));
        targetSvg.appendChild(group);
      }

      function adjustLabelBadges(targetSvg) {
        if (!targetSvg) return;
        targetSvg.querySelectorAll("text.node-label").forEach((text) => {
          const rect = text.previousElementSibling;
          if (!rect || !rect.classList.contains("node-label-bg") || typeof text.getBBox !== "function") return;
          try {
            const box = text.getBBox();
            const padX = 2;
            const padY = 1;
            rect.setAttribute("x", trim(box.x - padX));
            rect.setAttribute("y", trim(box.y - padY));
            rect.setAttribute("width", trim(box.width + padX * 2));
            rect.setAttribute("height", trim(box.height + padY * 2));
          } catch {}
        });
      }

      function setViewMode(mode) {
        viewMode = mode;
        viewer.innerHTML = variants[mode].svg;
        svg = viewer.querySelector("svg");
        adjustLabelBadges(svg);
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => adjustLabelBadges(svg));
        }
        baseWidth = variants[mode].width;
        baseHeight = variants[mode].height;
        document.querySelector("#viewFull").classList.toggle("is-active", mode === "full");
        document.querySelector("#viewWrapped").classList.toggle("is-active", mode === "wrapped");
        document.querySelector("#viewSummary").classList.toggle("is-active", mode === "summary");
        resetView();
      }

      function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      function makeExportTimestamp() {
        const now = new Date();
        const pad = (value, size = 2) => String(value).padStart(size, "0");
        return [
          now.getFullYear(),
          pad(now.getMonth() + 1),
          pad(now.getDate()),
        ].join("-") + "-" + [
          pad(now.getHours()),
          pad(now.getMinutes()),
          pad(now.getSeconds()),
        ].join("") + "-" + pad(Math.floor(now.getMilliseconds() / 10));
      }

      function exportFilename(prefix, extension) {
        return prefix + "-" + makeExportTimestamp() + "." + extension;
      }

      function downloadSvg() {
        const text = new XMLSerializer().serializeToString(exportClone());
        downloadBlob(new Blob([text], { type: "image/svg+xml;charset=utf-8" }), exportFilename("leaf-spine-topology", "svg"));
      }

      async function downloadPng() {
        const clone = exportClone();
        const text = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const image = new Image();
        const scale = 2;
        try {
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
          });
          const canvas = document.createElement("canvas");
          canvas.width = baseWidth * scale;
          canvas.height = baseHeight * scale;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
          if (blob) downloadBlob(blob, exportFilename("leaf-spine-topology", "png"));
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - zoomStep));
      document.querySelector("#zoomReset").addEventListener("click", resetView);
      document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + zoomStep));
      document.querySelector("#zoomCenter").addEventListener("click", centerView);
      document.querySelector("#zoomFit").addEventListener("click", fitView);
      document.querySelector("#viewFull").addEventListener("click", () => setViewMode("full"));
      document.querySelector("#viewWrapped").addEventListener("click", () => setViewMode("wrapped"));
      document.querySelector("#viewSummary").addEventListener("click", () => setViewMode("summary"));
      function exportByFormat(format) {
        if (format === "png") {
          downloadPng();
          return;
        }
        if (format === "ppt") {
          downloadPpt();
          return;
        }
        downloadSvg();
      }

      function closeExportMenus() {
        document.querySelectorAll(".export-menu.is-open").forEach((menu) => menu.classList.remove("is-open"));
      }

      function setupExportMenu() {
        const menu = document.querySelector("#downloadMenu");
        const trigger = document.querySelector("#downloadExport");
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          const willOpen = !menu.classList.contains("is-open");
          closeExportMenus();
          menu.classList.toggle("is-open", willOpen);
        });
        menu.addEventListener("click", (event) => {
          const option = event.target.closest("[data-export-value]");
          if (!option) return;
          event.stopPropagation();
          menu.classList.remove("is-open");
          exportByFormat(option.dataset.exportValue);
        });
        document.addEventListener("click", closeExportMenus);
      }

      function downloadPpt() {
        if (!window.opener) {
          alert("메인 페이지와 연결되어 있지 않아 PPT를 만들 수 없습니다.");
          return;
        }
        try {
          if (typeof window.opener.exportDiagramPptx === "function") {
            window.opener.exportDiagramPptx(viewMode);
            return;
          }
        } catch (error) {
          // Fall back to postMessage below when direct opener access is blocked.
        }
        window.opener.postMessage({ type: "leaf-spine-export-pptx", viewMode }, "*");
      }

      setupExportMenu();
      document.querySelector("#openPortMap").addEventListener("click", () => {
        if (!window.opener) {
          alert(labels.portMapNotConnected);
          return;
        }
        try {
          if (typeof window.opener.openPortMapWindow === "function") {
            window.opener.openPortMapWindow();
            return;
          }
        } catch (error) {
          // Fall back to postMessage below when direct opener access is blocked.
        }
        window.opener.postMessage({ type: "leaf-spine-open-port-map" }, "*");
      });
      viewer.addEventListener("wheel", (event) => {
        event.preventDefault();
        setZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), { x: event.clientX, y: event.clientY });
      }, { passive: false });
      viewer.addEventListener("click", handleHighlightClick);
      viewer.addEventListener("pointerdown", startDrag);
      window.addEventListener("pointermove", moveDrag);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("resize", applyView);
      setViewMode(viewMode);
    </script>
  </body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "width=1280,height=800,scrollbars=yes,resizable=yes");
  if (!popup) {
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function makeExportSvgDataFromMarkup(markup) {
  const container = document.createElement("div");
  container.innerHTML = markup;
  const svg = container.querySelector("svg");
  const { clone, width, height } = makeExportSvgClone(svg);
  return {
    svg: new XMLSerializer().serializeToString(clone),
    width,
    height,
  };
}

function makeEmbeddedPretendardFontCss() {
  const urls = window.LEAF_SPINE_FONT_DATA_URLS;
  if (urls) {
    return `
      @font-face {
        font-family: "Pretendard";
        src: url("${urls.regular}") format("woff2");
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: "Pretendard";
        src: url("${urls.medium}") format("woff2");
        font-weight: 500;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: "Pretendard";
        src: url("${urls.semiBold}") format("woff2");
        font-weight: 600;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: "Pretendard";
        src: url("${urls.bold}") format("woff2");
        font-weight: 700;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: "Pretendard";
        src: url("${urls.extraBold}") format("woff2");
        font-weight: 800;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: "Pretendard";
        src: url("${urls.black}") format("woff2");
        font-weight: 900;
        font-style: normal;
        font-display: block;
      }
    `;
  }
  return `
    @font-face {
      font-family: "Pretendard";
      src: url("assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/Pretendard-Regular.subset.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/Pretendard-Medium.subset.woff2") format("woff2");
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/Pretendard-SemiBold.subset.woff2") format("woff2");
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/Pretendard-Bold.subset.woff2") format("woff2");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/Pretendard-ExtraBold.subset.woff2") format("woff2");
      font-weight: 800;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/Pretendard-Black.subset.woff2") format("woff2");
      font-weight: 900;
      font-style: normal;
      font-display: swap;
    }
  `;
}

function makeExportSvgClone(svg) {
  adjustLabelBadges(svg);
  const width = Number(svg.dataset.baseWidth) || 1200;
  const height = Number(svg.dataset.baseHeight) || 700;
  const clone = svg.cloneNode(true);
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.insertBefore(makePngSvgStyleElement(), clone.firstChild);
  clone.insertBefore(makeSvgBackgroundRect(width, height), clone.children[1] || null);
  scaleExportContent(clone, width, height);
  return { clone, width, height };
}

function scaleExportContent(svg, width, height, scale = DIAGRAM_EXPORT_CONTENT_SCALE) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("transform", `translate(${trim(width / 2)} ${trim(height / 2)}) scale(${trim(scale)}) translate(${trim(-width / 2)} ${trim(-height / 2)})`);
  [...svg.childNodes]
    .filter((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      const tagName = node.tagName.toLowerCase();
      return !["title", "style"].includes(tagName) && node.dataset.exportBackground !== "true";
    })
    .forEach((node) => group.appendChild(node));
  svg.appendChild(group);
}

function adjustLabelBadges(svg) {
  if (!svg) return;
  svg.querySelectorAll("text.node-label").forEach((text) => {
    const rect = text.previousElementSibling;
    if (!rect || !rect.classList.contains("node-label-bg") || typeof text.getBBox !== "function") return;
    try {
      const box = text.getBBox();
      const padX = 2;
      const padY = 1;
      rect.setAttribute("x", trim(box.x - padX));
      rect.setAttribute("y", trim(box.y - padY));
      rect.setAttribute("width", trim(box.width + padX * 2));
      rect.setAttribute("height", trim(box.height + padY * 2));
    } catch {
      // getBBox can fail while an SVG is detached; the initial estimated size remains usable.
    }
  });
}

function makeSvgBackgroundRect(width, height) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("fill", "#ffffff");
  rect.dataset.exportBackground = "true";
  return rect;
}

function makePngSvgStyleElement() {
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    ${makeEmbeddedPretendardFontCss()}
    svg {
      font-family: "Pretendard", Arial, sans-serif;
      shape-rendering: geometricPrecision;
      text-rendering: geometricPrecision;
      background: #ffffff;
    }
    .hint text { fill: #5b6b86; font-weight: 900; font-size: 14px; }
    .link, .uplink { vector-effect: non-scaling-stroke; }
    .link { stroke-width: 1.35; }
    .uplink { stroke-width: 1.45; }
    .node rect, .node circle { vector-effect: non-scaling-stroke; stroke-width: 1.2; }
    .node text { font-weight: 800; text-anchor: middle; dominant-baseline: middle; }
    .node .node-label-bg { fill: #fff; stroke: #111827; stroke-width: 0.75; vector-effect: non-scaling-stroke; }
    .node .node-label { fill: #0f172a; font-size: 10.5px; font-weight: 450; }
    .switch-body { stroke-width: 1.2; }
    .spine .switch-body { fill: #b45309; stroke: #92400e; }
    .leaf .switch-body { fill: #2563eb; stroke: #1e40af; }
    .switch-face { fill: rgba(255, 255, 255, 0.14); stroke: rgba(255, 255, 255, 0.22); }
    .switch-port { fill: #e5e7eb; stroke: #111827; stroke-width: 0.6; }
    .switch-led, .server-led { fill: #86efac; stroke: #166534; stroke-width: 0.7; }
    .spine text, .leaf text, .server .server-name { fill: #0f172a; font-size: 10.5px; font-weight: 450; }
    .server .server-body, .server rect { fill: #475569; stroke: #334155; }
    .server .server-face { fill: #64748b; stroke: #334155; }
    .server .nic-port { stroke: #1f2937; stroke-width: 0.8; }
    .ellipsis-node rect { fill: #eef2f7; stroke: #94a3b8; stroke-dasharray: 4 4; }
    .ellipsis-node text { fill: #334155; font-size: 19px; }
    .ellipsis-node .ellipsis-label { fill: #0f172a; font-size: 10px; font-weight: 450; }
  `;
  return style;
}
