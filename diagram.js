// Diagram rendering, topology window, and topology PowerPoint export helpers.
// This file is loaded before app.js; functions use app globals at call time.

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
    nodes.push(switchNode("spine", x, spineY, switchW, switchH, `Spine ${i + 1}`));
  });

  leafXs.forEach((leafX, leafIndex) => {
    spineXs.forEach((spineX, spineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, best.spines, spineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push(line(
          leafX + offset,
          leafY - switchH / 2,
          spineX + offset,
          spineY + switchH / 2,
          "uplink",
          {
            stroke: leafColor(leafIndex),
            title: `Leaf ${leafIndex + 1} uplink`,
          },
        ));
      }
    });

    nodes.push(switchNode("leaf", leafX, leafY, switchW, switchH, `Leaf ${leafIndex + 1}`));
  });

  serverXs.forEach((serverX, serverIndex) => {
    const serverNumber = serverIndex + 1;
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;

    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = (nicLeafStart + nicIndex) % shownLeafs;
      const nicX = nicPortX(serverX, serverW, input.serverNicPorts, nicIndex);
      lines.push(line(
        nicX,
        serverY - serverH / 2,
        leafXs[leafIndex],
        leafY + switchH / 2,
        "link",
        {
          stroke: nicColor(nicIndex),
          title: `Server NIC ${nicIndex + 1}`,
        },
      ));
    }

    nodes.push(serverNode(serverX, serverY, serverW, serverH, serverNumber, input.serverNicPorts));
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
    { stroke: item.color, title: item.title },
  ));
  const nodes = [
    ...geometry.switches.map((sw) => switchNode(sw.kind, sw.x, sw.y, sw.w, sw.h, sw.label)),
    ...geometry.servers.map((server) => serverNode(server.x, server.y, server.w, server.h, server.number, server.nicCount, server.label)),
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
    ctx.fillStyle = "#f8fbff";
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
  const initialView = diagramViewMode;
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Leaf-Spine 구성도</title>
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
      #viewSummary {
        width: 48px;
      }
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
        background: #f8fbff;
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
    </style>
  </head>
  <body>
    <div class="toolbar">
      <strong>네트워크 구성도</strong>
      <div class="actions">
        <div class="control-group">
          <button id="viewFull" type="button">전체</button>
          <button id="viewWrapped" type="button">줄바꿈</button>
          <button id="viewSummary" type="button">요약</button>
        </div>
        <div class="control-group">
          <button id="zoomOut" type="button">-</button>
          <button id="zoomReset" type="button">100%</button>
          <button id="zoomIn" type="button">+</button>
          <button id="zoomCenter" type="button" title="가운데 정렬" aria-label="가운데 정렬">⨁</button>
          <button id="zoomFit" type="button" title="화면에 맞춤" aria-label="화면에 맞춤">⇔</button>
        </div>
        <div class="control-group">
          <div id="downloadMenu" class="export-menu">
            <button id="downloadExport" type="button">Export</button>
            <div class="export-menu-list" role="menu" aria-label="구성도 저장 형식">
              <button type="button" data-export-value="svg">SVG</button>
              <button type="button" data-export-value="png">PNG</button>
              <button type="button" data-export-value="ppt">PPT</button>
            </div>
          </div>
          <button id="openPortMap" type="button">Port Map</button>
        </div>
      </div>
    </div>
    <div id="viewer" class="viewer"></div>
    <script>
      const variants = ${JSON.stringify(variants)};
      const defaultViewWidth = 920;
      const defaultViewHeight = 500;
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

      function trim(value) {
        return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "");
      }

      function viewBoxSize() {
        return {
          width: Math.min(defaultViewWidth, baseWidth) / zoom,
          height: Math.min(defaultViewHeight, baseHeight) / zoom,
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
        zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(defaultViewWidth / baseWidth, defaultViewHeight / baseHeight)));
        pan = centeredPan();
        applyView();
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
        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
      }

      function moveDrag(event) {
        if (!drag) return;
        if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
        const scale = unitsPerPixel();
        pan.x = drag.panX - (event.clientX - drag.startX) * scale.x;
        pan.y = drag.panY - (event.clientY - drag.startY) * scale.y;
        applyView();
      }

      function endDrag(event) {
        if (!drag) return;
        if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
        viewer.classList.remove("is-dragging");
        drag = null;
      }

      function exportClone() {
        const clone = svg.cloneNode(true);
        clone.setAttribute("viewBox", "0 0 " + baseWidth + " " + baseHeight);
        clone.setAttribute("width", baseWidth);
        clone.setAttribute("height", baseHeight);
        return clone;
      }

      function setViewMode(mode) {
        viewMode = mode;
        viewer.innerHTML = variants[mode].svg;
        svg = viewer.querySelector("svg");
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
          ctx.fillStyle = "#f8fbff";
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
          alert("메인 페이지와 연결되어 있지 않아 Port Map을 열 수 없습니다.");
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
    `;
  }
  return `
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-Thin.ttf") format("truetype");
      font-weight: 100;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-ExtraLight.ttf") format("truetype");
      font-weight: 200;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-Light.ttf") format("truetype");
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-Regular.ttf") format("truetype");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-Medium.ttf") format("truetype");
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-SemiBold.ttf") format("truetype");
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-Bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-ExtraBold.ttf") format("truetype");
      font-weight: 800;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("fonts/Pretendard-Black.ttf") format("truetype");
      font-weight: 900;
      font-style: normal;
      font-display: swap;
    }
  `;
}

function makeExportSvgClone(svg) {
  const width = Number(svg.dataset.baseWidth) || 1200;
  const height = Number(svg.dataset.baseHeight) || 700;
  const clone = svg.cloneNode(true);
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.insertBefore(makePngSvgStyleElement(), clone.firstChild);
  clone.insertBefore(makeSvgBackgroundRect(width, height), clone.children[1] || null);
  return { clone, width, height };
}

function makeSvgBackgroundRect(width, height) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("fill", "#f8fbff");
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
      background: #f8fbff;
    }
    .hint text { fill: #5b6b86; font-weight: 900; font-size: 14px; }
    .link, .uplink { vector-effect: non-scaling-stroke; }
    .link { stroke-width: 1.35; }
    .uplink { stroke-width: 1.45; }
    .node rect, .node circle { vector-effect: non-scaling-stroke; stroke-width: 1.2; }
    .node text { font-weight: 800; text-anchor: middle; dominant-baseline: middle; }
    .switch-body { stroke-width: 1.2; }
    .spine .switch-body { fill: #b45309; stroke: #92400e; }
    .leaf .switch-body { fill: #2563eb; stroke: #1e40af; }
    .switch-face { fill: rgba(255, 255, 255, 0.14); stroke: rgba(255, 255, 255, 0.22); }
    .switch-port { fill: #e5e7eb; stroke: #111827; stroke-width: 0.6; }
    .switch-led, .server-led { fill: #86efac; stroke: #166534; stroke-width: 0.7; }
    .spine text, .leaf text, .server .server-name { fill: #0f172a; font-size: 12px; }
    .server .server-body, .server rect { fill: #475569; stroke: #334155; }
    .server .server-face { fill: #64748b; stroke: #334155; }
    .server .nic-port { stroke: #1f2937; stroke-width: 0.8; }
    .ellipsis-node rect { fill: #eef2f7; stroke: #94a3b8; stroke-dasharray: 4 4; }
    .ellipsis-node text { fill: #334155; font-size: 19px; }
    .ellipsis-node .ellipsis-label { fill: #64748b; font-size: 11px; }
  `;
  return style;
}

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

  const slide = pptx.addSlide();
  slide.background = { color: "F8FBFF" };

  const scale = Math.min((slideW - margin * 2) / geometry.width, (slideH - margin * 2) / geometry.height);
  const toX = (value) => margin + value * scale;
  const toY = (value) => margin + value * scale;
  const toL = (value) => value * scale;

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: slideW,
    h: slideH,
    fill: { color: "F8FBFF" },
    line: { color: "F8FBFF", transparency: 100 },
  });

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

function diagramGeometryForView(result, viewMode) {
  if (viewMode === "wrapped") return getPptDiagramGeometry(result);
  if (viewMode === "summary") return getSummaryDiagramGeometry(result);
  return getDiagramGeometry(result);
}

function getPptDiagramGeometry({ input, best }) {
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const switchW = 116;
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const serverGap = Math.max(88, serverW + 18);
  const spinePerRow = 8;
  const leafPerRow = 12;
  const serverPerRow = Math.max(1, Math.min(16, Math.floor(1120 / serverGap)));
  const spineRows = Math.ceil(shownSpines / spinePerRow);
  const leafRows = Math.ceil(shownLeafs / leafPerRow);
  const serverRows = Math.ceil(shownServers / serverPerRow);
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const maxRowWidth = Math.max(
    Math.min(shownSpines, spinePerRow) * 126,
    Math.min(shownLeafs, leafPerRow) * 122,
    Math.min(shownServers, serverPerRow) * serverGap,
  );
  const width = Math.max(920, labelGutter + maxRowWidth + 150);
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const spineStartY = 58;
  const spineRowGap = 72;
  const leafStartY = spineStartY + (spineRows - 1) * spineRowGap + 132;
  const leafRowGap = 88;
  const serverStartY = leafStartY + (leafRows - 1) * leafRowGap + 170;
  const serverRowGap = 105;
  const height = serverStartY + (serverRows - 1) * serverRowGap + serverH / 2 + 52;
  const lines = [];
  const switches = [];
  const servers = [];
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || shownLeafs;
  const perPodSpines = best.perPodSpines || shownSpines;
  const podServerCount = best.podServerCount || shownServers;
  const labels = [];

  const spinePositions = makePptRowPositions(shownSpines, spinePerRow, center, spineStartY, spineRowGap, 126);
  const leafPositions = makePptRowPositions(shownLeafs, leafPerRow, center, leafStartY, leafRowGap, 122);
  const serverPositions = makePptRowPositions(shownServers, serverPerRow, center, serverStartY, serverRowGap, serverGap);

  spinePositions.forEach((position, index) => {
    const label = podCount > 1 ? `Pod ${Math.floor(index / perPodSpines) + 1} Spine ${(index % perPodSpines) + 1}` : `Spine ${index + 1}`;
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label });
  });

  leafPositions.forEach((leafPosition, leafIndex) => {
    const podIndex = Math.floor(leafIndex / perPodLeafs);
    const spineStart = podIndex * perPodSpines;
    const spineEnd = Math.min(spineStart + perPodSpines, spinePositions.length);
    spinePositions.slice(spineStart, spineEnd).forEach((spinePosition, localSpineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push({
          x1: leafPosition.x + offset,
          y1: leafPosition.y - switchH / 2,
          x2: spinePosition.x + offset,
          y2: spinePosition.y + switchH / 2,
          color: leafColor(leafIndex),
          kind: "uplink",
          title: `Leaf ${leafIndex + 1} uplink`,
        });
      }
    });
    const label = podCount > 1 ? `Pod ${Math.floor(leafIndex / perPodLeafs) + 1} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`;
    switches.push({ kind: "leaf", x: leafPosition.x, y: leafPosition.y, w: switchW, h: switchH, label });
  });

  serverPositions.forEach((serverPosition, serverIndex) => {
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;
    const ports = [];
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = podCount > 1
        ? Math.floor(serverIndex / podServerCount) * perPodLeafs + (((serverIndex % podServerCount) * activeNicPorts + nicIndex) % perPodLeafs)
        : (nicLeafStart + nicIndex) % shownLeafs;
      const leafPosition = leafPositions[leafIndex];
      const nicX = nicPortX(serverPosition.x, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverPosition.y - serverH / 2 + 7, color });
      lines.push({
        x1: nicX,
        y1: serverPosition.y - serverH / 2,
        x2: leafPosition.x,
        y2: leafPosition.y + switchH / 2,
        color,
        kind: "link",
        title: `Server NIC ${nicIndex + 1}`,
      });
    }
    servers.push({ x: serverPosition.x, y: serverPosition.y, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label: `Server #${serverIndex + 1}`, ports });
  });

  return normalizeGeometryHorizontal({ width, height, labels, lines, switches, servers, labelGutter });
}

function makePptRowPositions(count, perRow, center, startY, rowGap, itemGap) {
  const positions = [];
  const rows = Math.ceil(count / perRow);
  for (let row = 0; row < rows; row += 1) {
    const rowStart = row * perRow;
    const rowCount = Math.min(perRow, count - rowStart);
    const xs = distribute(center, rowCount, itemGap);
    xs.forEach((x, column) => {
      positions[rowStart + column] = { x, y: startY + row * rowGap };
    });
  }
  return positions;
}

function getSummaryDiagramGeometry({ input, best }) {
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const perPodSpines = best.perPodSpines || best.spines;
  const podServerCount = best.podServerCount || input.serverCount;
  const switchW = summarySwitchWidth(best, podCount);
  const switchEntryLimit = summarySwitchEntryLimit(best, podCount);
  const spineEntries = compactEntriesByPod(best.spines, perPodSpines, switchEntryLimit.spine, "spine");
  const leafEntries = compactEntriesByPod(best.leafCount, perPodLeafs, switchEntryLimit.leaf, "leaf");
  const serverEntries = compactEntriesByPod(input.serverCount, podServerCount, podCount > 1 ? 7 : 13, "server");
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const switchSlotWidth = Math.max(92, switchW + 18);
  const serverSlotWidth = Math.max(96, serverW + 16);
  const maxRowWidth = Math.max(
    spineEntries.length * switchSlotWidth,
    leafEntries.length * switchSlotWidth,
    serverEntries.length * serverSlotWidth,
  );
  const width = Math.max(920, labelGutter + maxRowWidth + 150);
  const summaryDensity = Math.max(spineEntries.length, leafEntries.length, serverEntries.length);
  const verticalScale = Math.min(1, Math.max(0, (summaryDensity - 10) / 10));
  const spineY = 58;
  const leafY = 190 + verticalScale * 58;
  const serverY = 360 + verticalScale * 138;
  const height = Math.round(serverY + serverH / 2 + 58);
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const lines = [];
  const switches = [];
  const servers = [];
  const ellipsis = [];
  const spinePositions = placeCompactEntries(spineEntries, center, spineY, switchSlotWidth);
  const leafPositions = placeCompactEntries(leafEntries, center, leafY, switchSlotWidth);
  const serverPositions = placeCompactEntries(serverEntries, center, serverY, serverSlotWidth);
  const switchEllipsisW = Math.max(78, switchW);

  spineEntries.forEach((entry) => {
    const position = spinePositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Spine") });
      return;
    }
    const label = podCount > 1 ? `Pod ${Math.floor(entry.index / perPodSpines) + 1} Spine ${(entry.index % perPodSpines) + 1}` : `Spine ${entry.index + 1}`;
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label });
  });

  leafEntries.forEach((entry) => {
    const position = leafPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Leaf") });
      return;
    }
    const label = podCount > 1 ? `Pod ${Math.floor(entry.index / perPodLeafs) + 1} Leaf ${(entry.index % perPodLeafs) + 1}` : `Leaf ${entry.index + 1}`;
    switches.push({ kind: "leaf", x: position.x, y: position.y, w: switchW, h: switchH, label });
  });

  leafEntries.filter((entry) => entry.type === "node").forEach((leafEntry) => {
    const leafPosition = leafPositions.get(leafEntry.key);
    spineEntries.filter((entry) => entry.type === "node").forEach((spineEntry) => {
      if (Math.floor(leafEntry.index / perPodLeafs) !== Math.floor(spineEntry.index / perPodSpines)) return;
      const spinePosition = spinePositions.get(spineEntry.key);
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, spineEntry.index % perPodSpines);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push({
          x1: leafPosition.x + offset,
          y1: leafY - switchH / 2,
          x2: spinePosition.x + offset,
          y2: spineY + switchH / 2,
          color: leafColor(leafEntry.index),
          kind: "uplink",
          title: `Leaf ${leafEntry.index + 1} uplink`,
        });
      }
    });
  });

  serverEntries.forEach((entry) => {
    const position = serverPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: 78, h: 42, label: summaryHiddenLabel(entry, "Server") });
      return;
    }

    const ports = [];
    const nicLeafStart = (entry.index * activeNicPorts) % best.leafCount;
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = podCount > 1
        ? Math.floor(entry.index / podServerCount) * perPodLeafs + (((entry.index % podServerCount) * activeNicPorts + nicIndex) % perPodLeafs)
        : (nicLeafStart + nicIndex) % best.leafCount;
      const leafEntry = leafEntries.find((item) => item.type === "node" && item.index === leafIndex);
      const fallbackLeafEntry = leafEntries.find((item) => {
        if (item.type !== "ellipsis") return false;
        return leafIndex >= item.rangeStart && leafIndex <= item.rangeEnd;
      }) || leafEntries.find((item) => item.type === "ellipsis");
      const nicX = nicPortX(position.x, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverY - serverH / 2 + 7, color });
      const linkLeafEntry = leafEntry || fallbackLeafEntry;
      if (!linkLeafEntry) continue;
      const leafPosition = leafPositions.get(linkLeafEntry.key);
      lines.push({
        x1: nicX,
        y1: serverY - serverH / 2,
        x2: leafPosition.x,
        y2: leafY + switchH / 2,
        color,
        kind: "link",
        title: `Server NIC ${nicIndex + 1}`,
      });
    }
    servers.push({ x: position.x, y: position.y, w: serverW, h: serverH, number: entry.index + 1, nicCount: input.serverNicPorts, label: `Server #${entry.index + 1}`, ports });
  });

  return normalizeGeometryHorizontal({
    width,
    height,
    labels: [],
    lines,
    switches,
    servers,
    ellipsis,
    labelGutter,
  });
}

function compactLayerEntries(count, maxEntries) {
  if (count <= maxEntries) {
    return Array.from({ length: count }, (_, index) => ({ type: "node", index, key: `node-${index}` }));
  }

  const visibleNodeCount = maxEntries - 1;
  const headCount = Math.ceil(visibleNodeCount / 2);
  const tailCount = visibleNodeCount - headCount;
  const entries = [];
  for (let index = 0; index < headCount; index += 1) {
    entries.push({ type: "node", index, key: `node-${index}` });
  }
  entries.push({
    type: "ellipsis",
    hiddenCount: count - headCount - tailCount,
    rangeStart: headCount,
    rangeEnd: count - tailCount - 1,
    key: "ellipsis",
  });
  for (let index = count - tailCount; index < count; index += 1) {
    entries.push({ type: "node", index, key: `node-${index}` });
  }
  return entries;
}

function compactEntriesByPod(totalCount, perPodCount, maxEntriesPerPod, kind, maxPods = 5) {
  if (perPodCount >= totalCount) return compactLayerEntries(totalCount, maxEntriesPerPod);

  const entries = [];
  const podCount = Math.ceil(totalCount / perPodCount);
  const podEntries = compactPodEntries(podCount, maxPods);

  podEntries.forEach((podEntry) => {
    if (podEntry.type === "ellipsis") {
      const podStart = podEntry.rangeStart || 0;
      const podEnd = podEntry.rangeEnd || podCount - 1;
      const rangeStart = podStart * perPodCount;
      const rangeEnd = Math.min(totalCount - 1, (podEnd + 1) * perPodCount - 1);
      entries.push({
        type: "ellipsis",
        key: `${kind}-pods-${podStart}-${podEnd}-ellipsis`,
        podEllipsis: true,
        podIndex: podStart,
        rangePodStart: podStart,
        rangePodEnd: podEnd,
        hiddenPodCount: podEnd - podStart + 1,
        rangeStart,
        rangeEnd,
        hiddenCount: Math.max(0, rangeEnd - rangeStart + 1),
      });
      return;
    }

    const podIndex = podEntry.index;
    const start = podIndex * perPodCount;
    const count = Math.min(perPodCount, totalCount - start);
    const deviceEntries = compactLayerEntries(count, maxEntriesPerPod);
    deviceEntries.forEach((entry, entryIndex) => {
      if (entry.type === "ellipsis") {
        const previousNode = [...deviceEntries.slice(0, entryIndex)].reverse().find((item) => item.type === "node");
        const nextNode = deviceEntries.slice(entryIndex + 1).find((item) => item.type === "node");
        const rangeStart = start + (previousNode ? previousNode.index + 1 : 0);
        const rangeEnd = start + (nextNode ? nextNode.index - 1 : count - 1);
        entries.push({
          ...entry,
          key: `${kind}-pod-${podIndex}-ellipsis`,
          podIndex,
          rangeStart,
          rangeEnd,
          hiddenCount: Math.max(0, rangeEnd - rangeStart + 1),
        });
        return;
      }
      entries.push({
        ...entry,
        index: start + entry.index,
        key: `${kind}-pod-${podIndex}-node-${entry.index}`,
        podIndex,
      });
    });
  });
  return entries;
}

function compactPodEntries(podCount, maxPods = 5) {
  if (podCount <= 2) {
    return Array.from({ length: podCount }, (_, index) => ({ type: "node", index, key: `pod-${index}` }));
  }

  return [
    { type: "node", index: 0, key: "pod-0" },
    {
      type: "ellipsis",
      hiddenCount: podCount - 2,
      rangeStart: 1,
      rangeEnd: podCount - 2,
      key: "pod-ellipsis",
    },
    { type: "node", index: podCount - 1, key: `pod-${podCount - 1}` },
  ];
}

function normalizeGeometryHorizontal(geometry, padding = 96) {
  const bounds = getGeometryHorizontalBounds(geometry);
  if (!bounds) return geometry;
  const contentWidth = bounds.maxX - bounds.minX;
  const width = Math.max(DEFAULT_DIAGRAM_VIEW_WIDTH, Math.ceil(contentWidth + padding * 2));
  const shift = (width - contentWidth) / 2 - bounds.minX;
  shiftGeometryX(geometry, shift);
  geometry.width = width;
  geometry.labelGutter = 0;
  return geometry;
}

function getGeometryHorizontalBounds(geometry) {
  let minX = Infinity;
  let maxX = -Infinity;
  const take = (value) => {
    if (!Number.isFinite(value)) return;
    minX = Math.min(minX, value);
    maxX = Math.max(maxX, value);
  };
  geometry.switches.forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
  });
  geometry.servers.forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
    (item.ports || []).forEach((port) => take(port.x));
  });
  (geometry.ellipsis || []).forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
  });
  geometry.lines.forEach((item) => {
    take(item.x1);
    take(item.x2);
  });
  geometry.labels.forEach((item) => take(item.x));
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return { minX, maxX };
}

function shiftGeometryX(geometry, shift) {
  geometry.switches.forEach((item) => { item.x += shift; });
  geometry.servers.forEach((item) => {
    item.x += shift;
    (item.ports || []).forEach((port) => { port.x += shift; });
  });
  (geometry.ellipsis || []).forEach((item) => { item.x += shift; });
  geometry.lines.forEach((item) => {
    item.x1 += shift;
    item.x2 += shift;
  });
  geometry.labels.forEach((item) => { item.x += shift; });
}

function summaryHiddenLabel(entry, label) {
  if (entry.podEllipsis) {
    return `${entry.hiddenPodCount} Pods hidden`;
  }
  const podPrefix = entry.podIndex === undefined ? "" : `Pod ${entry.podIndex + 1} `;
  return `${podPrefix}${entry.hiddenCount} ${label} hidden`;
}

function summarySwitchWidth(best, podCount) {
  const switchCount = Math.max(best.leafCount, best.spines);
  if (podCount > 1) {
    if (switchCount >= 512) return 88;
    if (switchCount >= 128) return 96;
    return 104;
  }
  if (switchCount >= 128) return 88;
  if (switchCount >= 64) return 96;
  if (switchCount >= 32) return 104;
  return 116;
}

function summarySwitchEntryLimit(best, podCount) {
  const switchCount = Math.max(best.leafCount, best.spines);
  if (podCount > 1) {
    if (switchCount >= 512) return { spine: 9, leaf: 9 };
    if (switchCount >= 128) return { spine: 7, leaf: 7 };
    return { spine: 5, leaf: 5 };
  }
  if (switchCount >= 128) return { spine: 11, leaf: 13 };
  if (switchCount >= 64) return { spine: 9, leaf: 11 };
  return { spine: 7, leaf: 9 };
}

function placeCompactEntries(entries, center, y, gap) {
  const positions = new Map();
  const xs = distribute(center, entries.length, gap);
  entries.forEach((entry, index) => {
    positions.set(entry.key, { x: xs[index], y });
  });
  return positions;
}

function placeCompactEntriesInRange(entries, left, right, y) {
  const positions = new Map();
  if (entries.length === 1) {
    positions.set(entries[0].key, { x: (left + right) / 2, y });
    return positions;
  }

  const usableLeft = left + 56;
  const usableRight = right - 56;
  const gap = (usableRight - usableLeft) / Math.max(entries.length - 1, 1);
  entries.forEach((entry, index) => {
    positions.set(entry.key, { x: usableLeft + gap * index, y });
  });
  return positions;
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
  slide.addText(sw.label, {
    x: toX(sw.x - 45),
    y: toY(sw.y + sw.h / 2 + 5),
    w: toL(90),
    h: toL(18),
    fontFace: "Arial",
    fontSize: 7.5,
    bold: true,
    color: "0F172A",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
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
  slide.addText(server.label, {
    x: toX(server.x - 45),
    y: toY(server.y + server.h / 2 + 5),
    w: toL(90),
    h: toL(18),
    fontFace: "Arial",
    fontSize: 7.5,
    bold: true,
    color: "0F172A",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
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
  slide.addText(item.label, {
    x: toX(item.x - item.w / 2 - 8),
    y: toY(item.y + item.h / 2 + 5),
    w: toL(item.w + 16),
    h: toL(16),
    fontFace: "Arial",
    fontSize: 6.5,
    bold: true,
    color: "64748B",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
}

function parallelOffset(index, count, maxSpan = 88) {
  if (count <= 1) return 0;
  const naturalSpan = (count - 1) * 5;
  const span = Math.min(naturalSpan, maxSpan);
  const step = span / (count - 1);
  return (index - (count - 1) / 2) * step;
}

function distribute(center, count, gap) {
  if (count === 1) return [center];
  const start = center - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function distributeFromLeft(start, count, gap) {
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function line(x1, y1, x2, y2, className, options = {}) {
  const stroke = options.stroke ? ` style="stroke: ${options.stroke}"` : "";
  const title = options.title ? `<title>${options.title}</title>` : "";
  return `<line class="${className}" x1="${trim(x1)}" y1="${trim(y1)}" x2="${trim(x2)}" y2="${trim(y2)}"${stroke}>${title}</line>`;
}

function switchNode(className, x, y, w, h, text) {
  const portCount = 10;
  const portGap = 7;
  const firstPortX = x - w / 2 + 14;
  const ports = Array.from({ length: portCount }, (_, index) => {
    const px = firstPortX + index * portGap;
    return `<rect class="switch-port" x="${px}" y="${y - 4}" width="4" height="5" rx="1"></rect>`;
  }).join("");

  return `
    <g class="node ${className}">
      <rect class="switch-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="4"></rect>
      <rect class="switch-face" x="${x - w / 2 + 6}" y="${y - h / 2 + 5}" width="${w - 12}" height="${h - 10}" rx="2"></rect>
      ${ports}
      <circle class="switch-led" cx="${x + w / 2 - 14}" cy="${y - 2}" r="2.4"></circle>
      <text x="${x}" y="${y + h / 2 + 14}">${text}</text>
    </g>
  `;
}

function serverNode(x, y, w, h, serverNumber, nicCount, label = `Server #${serverNumber}`) {
  const ports = Array.from({ length: nicCount }, (_, index) => {
    const portX = nicPortX(x, w, nicCount, index);
    return `<rect class="nic-port" x="${portX - 3}" y="${y - h / 2 + 7}" width="6" height="8" rx="1" style="fill: ${nicColor(index)}">
      <title>NIC ${index + 1}</title>
    </rect>`;
  }).join("");

  return `
    <g class="node server">
      <rect class="server-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6"></rect>
      <rect class="server-face" x="${x - w / 2 + 6}" y="${y - h / 2 + 16}" width="${w - 12}" height="${h - 24}" rx="3"></rect>
      <circle class="server-led" cx="${x + w / 2 - 12}" cy="${y + h / 2 - 10}" r="2.5"></circle>
      ${ports}
      <text class="server-name" x="${x}" y="${y + h / 2 + 14}">${label}</text>
    </g>
  `;
}

function ellipsisNode(x, y, w, h, label) {
  return `
    <g class="node ellipsis-node">
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="8"></rect>
      <text x="${x}" y="${y - 2}">...</text>
      <text class="ellipsis-label" x="${x}" y="${y + h / 2 + 14}">${label}</text>
    </g>
  `;
}

function serverNodeWidth(nicCount) {
  return Math.max(82, 28 + nicCount * 8);
}

function nicPortX(serverX, serverW, nicCount, nicIndex) {
  const usableWidth = serverW - 16;
  if (nicCount === 1) return serverX;
  const gap = usableWidth / (nicCount - 1);
  return serverX - usableWidth / 2 + gap * nicIndex;
}

function nicColor(index) {
  return NIC_COLORS[index % NIC_COLORS.length];
}

function leafColor(index) {
  return LEAF_COLORS[index % LEAF_COLORS.length];
}

function buildPptx(result) {
  const geometry = getDiagramGeometry(result);
  const slide = buildSlideXml(geometry);
  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelsXml(),
    "docProps/app.xml": appPropsXml(),
    "docProps/core.xml": corePropsXml(),
    "ppt/presentation.xml": presentationXml(),
    "ppt/_rels/presentation.xml.rels": presentationRelsXml(),
    "ppt/slides/slide1.xml": slide,
    "ppt/slides/_rels/slide1.xml.rels": slideRelsXml(),
    "ppt/slideMasters/slideMaster1.xml": slideMasterXml(),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": slideMasterRelsXml(),
    "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml(),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": slideLayoutRelsXml(),
    "ppt/theme/theme1.xml": themeXml(),
    "ppt/viewProps.xml": viewPropsXml(),
    "ppt/tableStyles.xml": tableStylesXml(),
  };
  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function getDiagramGeometry({ input, best }) {
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
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || shownLeafs;
  const perPodSpines = best.perPodSpines || shownSpines;
  const podServerCount = best.podServerCount || shownServers;
  const lines = [];
  const switches = [];
  const servers = [];

  spineXs.forEach((x, index) => {
    const label = podCount > 1 ? `Pod ${Math.floor(index / perPodSpines) + 1} Spine ${(index % perPodSpines) + 1}` : `Spine ${index + 1}`;
    switches.push({ kind: "spine", x, y: spineY, w: switchW, h: switchH, label });
  });
  leafXs.forEach((leafX, leafIndex) => {
    const podIndex = Math.floor(leafIndex / perPodLeafs);
    const spineStart = podIndex * perPodSpines;
    const spineEnd = Math.min(spineStart + perPodSpines, spineXs.length);
    spineXs.slice(spineStart, spineEnd).forEach((spineX, localSpineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push({
          x1: leafX + offset,
          y1: leafY - switchH / 2,
          x2: spineX + offset,
          y2: spineY + switchH / 2,
          color: leafColor(leafIndex),
          kind: "uplink",
          title: `Leaf ${leafIndex + 1} uplink`,
        });
      }
    });
    const label = podCount > 1 ? `Pod ${Math.floor(leafIndex / perPodLeafs) + 1} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`;
    switches.push({ kind: "leaf", x: leafX, y: leafY, w: switchW, h: switchH, label });
  });

  serverXs.forEach((serverX, serverIndex) => {
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;
    const ports = [];
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = podCount > 1
        ? Math.floor(serverIndex / podServerCount) * perPodLeafs + (((serverIndex % podServerCount) * activeNicPorts + nicIndex) % perPodLeafs)
        : (nicLeafStart + nicIndex) % shownLeafs;
      const nicX = nicPortX(serverX, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverY - serverH / 2 + 7, color });
      lines.push({
        x1: nicX,
        y1: serverY - serverH / 2,
        x2: leafXs[leafIndex],
        y2: leafY + switchH / 2,
        color,
        kind: "link",
        title: `Server NIC ${nicIndex + 1}`,
      });
    }
    servers.push({ x: serverX, y: serverY, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label: `Server #${serverIndex + 1}`, ports });
  });

  return normalizeGeometryHorizontal({
    width,
    height,
    labels: [],
    lines,
    switches,
    servers,
    labelGutter,
  });
}

function buildSlideXml(geometry) {
  const slideW = 12192000;
  const slideH = 6858000;
  const margin = 274320;
  const scale = Math.min((slideW - margin * 2) / geometry.width, (slideH - margin * 2) / geometry.height);
  const offsetX = margin;
  const offsetY = margin;
  const toX = (value) => Math.round(offsetX + value * scale);
  const toY = (value) => Math.round(offsetY + value * scale);
  const toL = (value) => Math.round(value * scale);
  const shapes = [];
  let id = 2;

  shapes.push(pptRect(id++, 0, 0, slideW, slideH, "F8FBFF", "F8FBFF"));
  geometry.labels.forEach((label) => {
    shapes.push(pptText(id++, toX(label.x), toY(label.y - 9), toL(74), toL(18), label.text, "5B6B86", 11, true));
  });
  geometry.lines.forEach((lineData) => {
    shapes.push(pptLine(id++, toX(lineData.x1), toY(lineData.y1), toX(lineData.x2), toY(lineData.y2), cleanColor(lineData.color), 12700));
  });
  geometry.switches.forEach((sw) => {
    const bodyColor = sw.kind === "spine" ? "B45309" : "2563EB";
    const lineColor = sw.kind === "spine" ? "92400E" : "1E40AF";
    shapes.push(pptRect(id++, toX(sw.x - sw.w / 2), toY(sw.y - sw.h / 2), toL(sw.w), toL(sw.h), bodyColor, lineColor, "roundRect"));
    shapes.push(pptRect(id++, toX(sw.x - sw.w / 2 + 6), toY(sw.y - sw.h / 2 + 5), toL(sw.w - 12), toL(sw.h - 10), "FFFFFF", "FFFFFF", "roundRect", 18000));
    for (let i = 0; i < 10; i += 1) {
      shapes.push(pptRect(id++, toX(sw.x - sw.w / 2 + 14 + i * 7), toY(sw.y - 4), toL(4), toL(5), "E5E7EB", "111827", "rect"));
    }
    shapes.push(pptEllipse(id++, toX(sw.x + sw.w / 2 - 16.4), toY(sw.y - 4.4), toL(4.8), toL(4.8), "86EFAC", "166534"));
    shapes.push(pptText(id++, toX(sw.x - 45), toY(sw.y + sw.h / 2 + 5), toL(90), toL(18), sw.label, "0F172A", 9, true));
  });
  geometry.servers.forEach((server) => {
    shapes.push(pptRect(id++, toX(server.x - server.w / 2), toY(server.y - server.h / 2), toL(server.w), toL(server.h), "475569", "334155", "roundRect"));
    shapes.push(pptRect(id++, toX(server.x - server.w / 2 + 6), toY(server.y - server.h / 2 + 16), toL(server.w - 12), toL(server.h - 24), "64748B", "334155", "roundRect"));
    shapes.push(pptEllipse(id++, toX(server.x + server.w / 2 - 14.5), toY(server.y + server.h / 2 - 12.5), toL(5), toL(5), "86EFAC", "166534"));
    server.ports.forEach((port) => {
      shapes.push(pptRect(id++, toX(port.x - 3), toY(port.y), toL(6), toL(8), cleanColor(port.color), "1F2937", "rect"));
    });
    shapes.push(pptText(id++, toX(server.x - 45), toY(server.y + server.h / 2 + 5), toL(90), toL(18), server.label, "0F172A", 9, true));
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    ${shapes.join("\n")}
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function pptRect(id, x, y, w, h, fill, stroke, preset = "rect", transparency = 0) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}">${transparency ? `<a:alpha val="${100000 - transparency}"/>` : ""}</a:srgbClr></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln></p:spPr></p:sp>`;
}

function pptEllipse(id, x, y, w, h, fill, stroke) {
  return pptRect(id, x, y, w, h, fill, stroke, "ellipse");
}

function pptLine(id, x1, y1, x2, y2, color, width) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const cx = Math.abs(x2 - x1);
  const cy = Math.abs(y2 - y1);
  const flipH = x2 < x1 ? ' flipH="1"' : "";
  const flipV = y2 < y1 ? ' flipV="1"' : "";
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Line ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flipH}${flipV}><a:off x="${x}" y="${y}"/><a:ext cx="${Math.max(cx, 1)}" cy="${Math.max(cy, 1)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${width}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`;
}

function pptText(id, x, y, w, h, text, color, size, bold = false, align = "ctr") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none"/><a:lstStyle/><a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="ko-KR" sz="${size * 100}"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="ko-KR"/></a:p></p:txBody></p:sp>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/></Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function presentationXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
}

function presentationRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
}

function slideRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
}

function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
}

function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Leaf-Spine Theme"><a:themeElements><a:clrScheme name="Leaf-Spine"><a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="EEF5FF"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="B45309"/></a:accent2><a:accent3><a:srgbClr val="475569"/></a:accent3><a:accent4><a:srgbClr val="16A34A"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Leaf-Spine"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Leaf-Spine"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function viewPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>`;
}

function tableStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
}

function appPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Leaf-Spine Planner</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>1</Slides></Properties>`;
}

function corePropsXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Leaf-Spine Topology</dc:title><dc:creator>임채성</dc:creator><cp:lastModifiedBy>임채성</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

const LeafSpineDiagram = {
  makeForView: (result, viewMode) => makeDiagramFromGeometry(diagramGeometryForView(result, viewMode)),
  getGeometryForView: (result, viewMode) => diagramGeometryForView(result, viewMode),
  exportPng: exportDiagramPng,
  exportSvg: exportDiagramSvg,
  exportPptx: exportDiagramPptx,
  openWindow: openDiagramWindow,
};
