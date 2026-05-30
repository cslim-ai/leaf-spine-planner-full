// Port map window, Excel export, and PowerPoint export helpers.
// This file is loaded after app.js and uses the same classic-script globals.

function openPortMapWindow() {
  if (!currentResult) return;
  const portMap = buildPortMap(currentResult);
  const html = makePortMapHtml(portMap);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "width=1280,height=820,scrollbars=yes,resizable=yes");
  if (!popup) {
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

window.openPortMapWindow = openPortMapWindow;

function buildPortMap({ input, best }) {
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const perPodSpines = best.perPodSpines || best.spines;
  const activeNicPorts = activeServerNicPorts(input);
  const serverLeafTwinFactor = input.useTwinPort ? 2 : 1;
  const uplinkTwinFactor = leafSpineTwinFactor(input);
  const leafServerPortCounters = Array.from({ length: best.leafCount }, () => 0);
  const spinePortCounters = Array.from({ length: best.spines }, () => 0);
  const serverLeafRows = [];
  const leafSpineRows = [];

  for (let serverIndex = 0; serverIndex < input.serverCount; serverIndex += 1) {
    serverFabricGroupIndexes(serverIndex, input, best).forEach((podIndex) => {
      const localServerIndex = serverLocalIndex(serverIndex, input, best);
      for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
        const leafIndex = podCount > 1
          ? podIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : ((serverIndex * activeNicPorts + nicIndex) % best.leafCount);
        const leafLogicalPort = leafServerPortCounters[leafIndex];
        leafServerPortCounters[leafIndex] += 1;
        serverLeafRows.push({
          podIndex,
          pod: podLabel(podIndex, podCount, input, best),
          section: "Node-Leaf",
          sourceDevice: `Node ${serverIndex + 1}`,
          sourcePort: podCount > 1 ? `NIC ${nicIndex + 1} ${podLabel(podIndex, podCount, input, best)}` : `NIC ${nicIndex + 1}`,
          targetDevice: leafLabel(leafIndex, perPodLeafs, podCount, input, best),
          targetPort: switchDownlinkPortLabel(leafLogicalPort, serverLeafTwinFactor),
          speed: `${formatGbps(input.useMultiPlanar ? input.serverLinkSpeed / (best.planeCount || 2) : input.serverLinkSpeed)}`,
          group: `NIC ${nicIndex + 1}`,
        });
      }
    });
  }

  for (let leafIndex = 0; leafIndex < best.leafCount; leafIndex += 1) {
    const podIndex = input.useMultiPlanar ? Math.floor(leafIndex / perPodLeafs) : 0;
    const leafUplinkStart = best.downlinks + 1;
    for (let localSpineIndex = 0; localSpineIndex < perPodSpines; localSpineIndex += 1) {
      const spineIndex = podIndex * perPodSpines + localSpineIndex;
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      const priorLinks = priorLinksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const leafPort = leafUplinkStart + priorLinks + linkIndex;
        spinePortCounters[spineIndex] += 1;
        leafSpineRows.push({
          podIndex,
          pod: podLabel(podIndex, podCount, input, best),
          section: "Leaf-Spine",
          sourceDevice: leafLabel(leafIndex, perPodLeafs, podCount, input, best),
          sourcePort: switchPortLabel(leafPort - 1, uplinkTwinFactor),
          targetDevice: spineLabel(spineIndex, perPodSpines, podCount, input, best),
          targetPort: switchPortLabel(spinePortCounters[spineIndex] - 1, uplinkTwinFactor),
          speed: `${formatGbps(effectiveSwitchLinkSpeed(input))}`,
          group: `Leaf ${leafIndex + 1}`,
        });
      }
    }
  }

  return {
    input,
    best,
    summary: [
      ["Nodes", input.serverCount.toLocaleString()],
      ["Node NIC Ports", input.serverNicPorts.toLocaleString()],
      ["Leaf Switches", best.leafCount.toLocaleString()],
      ["Spine Switches", best.spines.toLocaleString()],
      [input.useMultiPods && input.useMultiPlanar ? "Pod/Plane Groups" : (input.useMultiPods ? "Pods" : "Planes"), podCount.toLocaleString()],
      ["Total Links", (serverLeafRows.length + leafSpineRows.length).toLocaleString()],
    ],
    serverLeafRows,
    leafSpineRows,
  };
}

function switchDownlinkPortLabel(logicalPortIndex, twinFactor) {
  return switchPortLabel(logicalPortIndex, twinFactor);
}

function switchPortLabel(logicalPortIndex, twinFactor) {
  if (twinFactor <= 1) return `Port ${logicalPortIndex + 1}`;
  const lane = logicalPortIndex % twinFactor === 0 ? "A" : "B";
  return `Port ${Math.floor(logicalPortIndex / twinFactor) + 1}${lane}`;
}

function podLabel(podIndex, podCount, input = null, best = null) {
  if (podCount <= 1) return "-";
  return fabricGroupLabel(podIndex, input, best);
}

function leafLabel(leafIndex, perPodLeafs, podCount, input = null, best = null) {
  if (podCount > 1) return `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}`;
  return `Leaf ${leafIndex + 1}`;
}

function spineLabel(spineIndex, perPodSpines, podCount, input = null, best = null) {
  if (podCount > 1) return `${fabricGroupLabel(Math.floor(spineIndex / perPodSpines), input, best)} Spine ${(spineIndex % perPodSpines) + 1}`;
  return `Spine ${spineIndex + 1}`;
}

function fabricGroupLabel(groupIndex, input = null, best = null) {
  const sourceInput = input || currentResult?.input || {};
  const sourceBest = best || currentResult?.best || {};
  const planeCount = sourceBest.planeCount || (sourceInput.useMultiPlanar ? 2 : 1);
  if (sourceInput.useMultiPods && sourceInput.useMultiPlanar) {
    return `Pod ${Math.floor(groupIndex / planeCount) + 1} Plane ${(groupIndex % planeCount) + 1}`;
  }
  if (sourceInput.useMultiPods) return `Pod ${groupIndex + 1}`;
  if (sourceInput.useMultiPlanar) return `Plane ${groupIndex + 1}`;
  return `Group ${groupIndex + 1}`;
}

function serverFabricGroupIndexes(serverIndex, input, best) {
  const planeCount = best.planeCount || (input.useMultiPlanar ? 2 : 1);
  const multiPodCount = best.multiPodCount || (input.useMultiPods ? Math.ceil(input.serverCount / Math.max(1, input.podServerCount || input.serverCount)) : 1);
  const podServerCount = best.podServerCount || input.serverCount;
  const podIndex = input.useMultiPods ? Math.min(multiPodCount - 1, Math.floor(serverIndex / podServerCount)) : 0;
  const planes = input.useMultiPlanar ? planeCount : 1;
  return Array.from({ length: planes }, (_, planeIndex) => podIndex * planeCount + planeIndex);
}

function serverLocalIndex(serverIndex, input, best) {
  const podServerCount = best.podServerCount || input.serverCount;
  return input.useMultiPods ? serverIndex % podServerCount : serverIndex;
}

function makePortMapHtml(portMap) {
  const rows = [...portMap.serverLeafRows, ...portMap.leafSpineRows];
  const maxRowsWithoutWarning = 12000;
  const warning = rows.length > maxRowsWithoutWarning
    ? `<p class="notice">포트맵 행이 ${rows.length.toLocaleString()}개입니다. 브라우저에서 검색은 가능하지만, 대규모 구성에서는 표시가 다소 느릴 수 있습니다.</p>`
    : "";
  const serializedRows = JSON.stringify(rows);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Leaf-Spine Port Map</title>
    <style>
      ${makeEmbeddedPretendardFontCss()}
      * { box-sizing: border-box; }
      html,
      body {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      body {
        margin: 0;
        background: #eef5ff;
        color: #0f172a;
        font-family: "Pretendard", Arial, sans-serif;
        display: flex;
        flex-direction: column;
      }
      header {
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 22px 14px;
        border-bottom: 1px solid #c8d8ee;
        background: rgba(255, 255, 255, 0.96);
        flex: 0 0 auto;
      }
      .title-lockup {
        display: inline-grid;
        justify-items: end;
      }
      h1 {
        margin: 0;
        color: #2563eb;
        font-size: 26px;
        line-height: 1.2;
      }
      .credit {
        margin-top: 3px;
        color: #5b6b86;
        font-size: 13px;
        font-weight: 800;
      }
      .actions {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      button {
        min-height: 32px;
        border: 1px solid #c8d8ee;
        border-radius: 6px;
        background: #fff;
        color: #1d4ed8;
        font: inherit;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
        padding: 0 12px;
      }
      button:hover {
        background: #dbeafe;
      }
      .export-menu {
        position: relative;
      }
      #exportPortMap {
        width: 72px;
        min-height: 28px;
        padding: 0;
        border-color: #2563eb;
        background: #2563eb;
        color: #fff;
        font-size: 12px;
      }
      #exportPortMap:hover {
        border-color: #1d4ed8;
        background: #1d4ed8;
      }
      .export-menu-list {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 20;
        display: none;
        min-width: 72px;
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
        min-height: 30px;
        border: 0;
        padding: 0 10px;
        background: #fff;
        color: #1d4ed8;
        text-align: left;
        font-size: 14px;
      }
      .export-menu-list button:hover {
        background: #dbeafe;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(6, minmax(120px, 1fr));
        gap: 8px;
        padding: 14px 22px;
        flex: 0 0 auto;
      }
      .metric {
        border: 1px solid #c8d8ee;
        border-radius: 8px;
        background: #fff;
        padding: 10px 12px;
      }
      .metric span {
        display: block;
        color: #5b6b86;
        font-size: 13px;
        font-weight: 900;
      }
      .metric strong {
        display: block;
        margin-top: 4px;
        font-size: 19px;
      }
      main {
        padding: 0 22px 22px;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .notice {
        margin: 0 0 10px;
        color: #92400e;
        font-size: 14px;
        font-weight: 800;
        flex: 0 0 auto;
      }
      .table-wrap {
        overflow: auto;
        flex: 1 1 auto;
        min-height: 0;
        border: 1px solid #c8d8ee;
        border-radius: 8px;
        background: #fff;
      }
      table {
        width: 100%;
        min-width: 1040px;
        border-collapse: separate;
        border-spacing: 0;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 13px;
        text-align: left;
      }
      th,
      td {
        padding: 9px 10px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
        font-size: 14px;
      }
      tbody tr:nth-child(even) td { background: #f8fbff; }
      tbody tr:hover td { background: #eff6ff; }
      .section {
        font-weight: 900;
      }
      .section-server-leaf {
        color: #1d4ed8;
      }
      .section-leaf-spine {
        color: #8a4b12;
      }
      .pod-cell {
        font-weight: 900;
      }
      @media (max-width: 900px) {
        .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="title-lockup">
        <h1>Leaf-Spine Port Map</h1>
        <div class="credit">Created by 임채성</div>
      </div>
      <div class="actions">
        <div id="portMapExportMenu" class="export-menu">
          <button id="exportPortMap" type="button">Export</button>
          <div class="export-menu-list" role="menu" aria-label="포트맵 저장 형식">
            <button type="button" data-export-value="excel">Excel</button>
            <button type="button" data-export-value="ppt">PPT</button>
          </div>
        </div>
      </div>
    </header>
    <section class="summary">
      ${portMap.summary.map(([label, value]) => `<div class="metric"><span>${escapeXml(label)}</span><strong>${escapeXml(value)}</strong></div>`).join("")}
    </section>
    <main>
      ${warning}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>구간</th>
              <th>Plane</th>
              <th>출발 장비</th>
              <th>출발 포트</th>
              <th>도착 장비</th>
              <th>도착 포트</th>
              <th>속도</th>
              <th>그룹</th>
            </tr>
          </thead>
          <tbody id="portMapBody"></tbody>
        </table>
      </div>
    </main>
    <script>
      const portMapRows = ${serializedRows};
      const tbody = document.querySelector("#portMapBody");
      const podTones = [
        { text: "#1d4ed8", bg: "#eff6ff" },
        { text: "#047857", bg: "#ecfdf5" },
        { text: "#8a4b12", bg: "#fff7ed" },
        { text: "#6d28d9", bg: "#f5f3ff" },
        { text: "#be123c", bg: "#fff1f2" },
        { text: "#0e7490", bg: "#ecfeff" },
      ];
      function sectionClass(section) {
        if (section === "Node-Leaf") return "section-server-leaf";
        if (section === "Leaf-Spine") return "section-leaf-spine";
        return "";
      }
      function appendCell(tr, value, className = "", style = "") {
        const td = document.createElement("td");
        if (className) td.className = className;
        if (style) td.setAttribute("style", style);
        td.textContent = value;
        tr.appendChild(td);
      }
      function renderRowsChunk(start = 0) {
        const fragment = document.createDocumentFragment();
        const end = Math.min(start + 600, portMapRows.length);
        for (let index = start; index < end; index += 1) {
          const row = portMapRows[index];
          const tr = document.createElement("tr");
          const tone = podTones[(row.podIndex || 0) % podTones.length];
          appendCell(tr, index + 1);
          appendCell(tr, row.section, "section " + sectionClass(row.section));
          appendCell(tr, row.pod, "pod-cell", row.pod === "-" ? "" : "color:" + tone.text + "; background:" + tone.bg + ";");
          appendCell(tr, row.sourceDevice);
          appendCell(tr, row.sourcePort);
          appendCell(tr, row.targetDevice);
          appendCell(tr, row.targetPort);
          appendCell(tr, row.speed);
          appendCell(tr, row.group);
          fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        if (end < portMapRows.length) {
          requestAnimationFrame(() => renderRowsChunk(end));
        }
      }
      renderRowsChunk();
      function runExport(name, format) {
        if (!window.opener) {
          alert("메인 페이지와 연결되어 있지 않아 export를 실행할 수 없습니다.");
          return;
        }
        try {
          if (typeof window.opener[name] === "function") {
            window.opener[name]();
            return;
          }
        } catch (error) {
          // Fall back to postMessage below when direct opener access is blocked.
        }
        window.opener.postMessage({ type: "leaf-spine-export-port-map", format }, "*");
      }
      function closeExportMenus() {
        document.querySelectorAll(".export-menu.is-open").forEach((menu) => menu.classList.remove("is-open"));
      }
      function setupExportMenu() {
        const menu = document.querySelector("#portMapExportMenu");
        const trigger = document.querySelector("#exportPortMap");
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
          if (option.dataset.exportValue === "ppt") {
            runExport("exportPortMapPpt", "ppt");
            return;
          }
          runExport("exportPortMapExcel", "excel");
        });
        document.addEventListener("click", closeExportMenus);
      }
      setupExportMenu();
    </script>
  </body>
</html>`;
}

function portMapSectionClass(section) {
  if (section === "Node-Leaf") return "section-server-leaf";
  if (section === "Leaf-Spine") return "section-leaf-spine";
  return "";
}

function portMapPodStyle(row) {
  if (row.pod === "-") return "";
  const tone = podTone(row.podIndex || 0);
  return `color:${tone.text}; background:${tone.bg};`;
}

function podTone(index) {
  const tones = [
    { text: "#1d4ed8", bg: "#eff6ff", ppt: "1D4ED8", fill: "EFF6FF" },
    { text: "#047857", bg: "#ecfdf5", ppt: "047857", fill: "ECFDF5" },
    { text: "#8a4b12", bg: "#fff7ed", ppt: "8A4B12", fill: "FFF7ED" },
    { text: "#6d28d9", bg: "#f5f3ff", ppt: "6D28D9", fill: "F5F3FF" },
    { text: "#be123c", bg: "#fff1f2", ppt: "BE123C", fill: "FFF1F2" },
    { text: "#0e7490", bg: "#ecfeff", ppt: "0E7490", fill: "ECFEFF" },
  ];
  return tones[index % tones.length];
}

function exportPortMapExcel() {
  if (!currentResult) return;
  const generatedAt = makeExportTimestamp();
  const blob = buildPortMapXlsx(buildPortMap(currentResult));
  downloadBlob(blob, exportFilename("leaf-spine-port-map", "xlsx", generatedAt));
}

async function exportPortMapPpt() {
  if (!currentResult) return;
  try {
    await LeafSpineExportUtils.ensurePptxGenLoaded();
    const generatedAt = makeExportTimestamp();
    const pptx = buildPortMapPptx(buildPortMap(currentResult), generatedAt.display);
    const blob = await pptx.write({ outputType: "blob" });
    downloadBlob(blob, exportFilename("leaf-spine-port-map", "pptx", generatedAt));
  } catch (error) {
    console.error(error);
    alert("포트맵 PPT 파일을 만드는 중 오류가 발생했습니다.");
  }
}

window.exportPortMapExcel = exportPortMapExcel;
window.exportPortMapPpt = exportPortMapPpt;

function getPortMapRows(portMap) {
  return [...portMap.serverLeafRows, ...portMap.leafSpineRows];
}

function portMapHeaders() {
  return ["#", "구간", "Plane", "출발 장비", "출발 포트", "도착 장비", "도착 포트", "속도", "그룹"];
}

function portMapRowValues(row, index) {
  return [
    index + 1,
    row.section,
    row.pod,
    row.sourceDevice,
    row.sourcePort,
    row.targetDevice,
    row.targetPort,
    row.speed,
    row.group,
  ];
}

function portMapTableHeaderHtml() {
  return `<tr>${portMapHeaders().map((header) => `<th>${escapeXml(header)}</th>`).join("")}</tr>`;
}

function portMapExcelRowHtml(row, index) {
  const sectionClass = row.section === "Node-Leaf" ? "server-leaf" : "leaf-spine";
  return `<tr>${portMapRowValues(row, index).map((value, cellIndex) => {
    const className = cellIndex === 1 ? ` class="${sectionClass}"` : "";
    return `<td${className}>${escapeXml(value)}</td>`;
  }).join("")}</tr>`;
}

function buildPortMapXlsx(portMap) {
  const files = {
    "[Content_Types].xml": xlsxContentTypesXml(),
    "_rels/.rels": xlsxRootRelsXml(),
    "docProps/app.xml": xlsxAppXml(),
    "docProps/core.xml": xlsxCoreXml(),
    "xl/workbook.xml": xlsxWorkbookXml(),
    "xl/_rels/workbook.xml.rels": xlsxWorkbookRelsXml(),
    "xl/styles.xml": xlsxStylesXml(),
    "xl/worksheets/sheet1.xml": xlsxSheetXml(portMap),
  };
  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function xlsxSheetXml(portMap) {
  const rows = [portMapHeaders(), ...getPortMapRows(portMap).map((row, index) => portMapRowValues(row, index))];
  const sourceRows = [null, ...getPortMapRows(portMap)];
  const colWidths = [7, 14, 11, 22, 16, 24, 16, 14, 20];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${colWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>
    ${rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, colIndex) => xlsxCell(value, rowIndex, colIndex, sourceRows[rowIndex])).join("")}</row>`).join("")}
  </sheetData>
  <autoFilter ref="A1:I${rows.length}"/>
</worksheet>`;
}

function xlsxCell(value, rowIndex, colIndex, sourceRow) {
  const ref = `${xlsxColumnName(colIndex)}${rowIndex + 1}`;
  let style = rowIndex === 0 ? 1 : 0;
  if (sourceRow && colIndex === 1) style = sourceRow.section === "Node-Leaf" ? 2 : 3;
  if (sourceRow && colIndex === 2 && sourceRow.pod !== "-") style = 4 + ((sourceRow.podIndex || 0) % 6);
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${escapeXml(value)}</t></is></c>`;
}

function xlsxColumnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function xlsxContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
}

function xlsxRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function xlsxWorkbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Port Map" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function xlsxWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function xlsxAppXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Leaf-Spine Planner</Application></Properties>`;
}

function xlsxCoreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Leaf-Spine Port Map</dc:title><dc:creator>임채성</dc:creator><cp:lastModifiedBy>임채성</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function xlsxStylesXml() {
  const fills = ["FFFFFF", "DBEAFE", "EFF6FF", "ECFDF5", "FFF7ED", "F5F3FF", "FFF1F2", "ECFEFF"];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF8A4B12"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Arial"/></font></fonts>
  <fills count="${fills.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map((color) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills>
  <borders count="1"><border><left style="thin"><color rgb="FFC8D8EE"/></left><right style="thin"><color rgb="FFC8D8EE"/></right><top style="thin"><color rgb="FFC8D8EE"/></top><bottom style="thin"><color rgb="FFC8D8EE"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10"><xf numFmtId="49" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>${[2,3,4,5,6,7].map((fillId) => `<xf numFmtId="49" fontId="3" fillId="${fillId + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>`).join("")}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function buildPortMapPptx(portMap, generatedAtText = formatDisplayTimestamp(new Date())) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "임채성";
  pptx.company = "Leaf-Spine Planner";
  pptx.subject = "Leaf-Spine Port Map";
  pptx.title = "Leaf-Spine Port Map";
  pptx.lang = "ko-KR";

  const rows = getPortMapRows(portMap);
  const chunks = [];
  let cursor = 0;
  while (cursor < rows.length || chunks.length === 0) {
    const limit = chunks.length === 0 ? 10 : 16;
    chunks.push({ start: cursor, rows: rows.slice(cursor, cursor + limit) });
    cursor += limit;
  }

  chunks.forEach((chunk, slideIndex) => {
    const slide = pptx.addSlide();
    if (slideIndex === 0) {
      addPortMapPptHeader(slide, slideIndex + 1, chunks.length, generatedAtText);
      addPortMapPptSummary(slide, portMap);
    } else {
      addPortMapPptPageNumber(slide, slideIndex + 1, chunks.length);
    }
    addPortMapPptTable(slide, chunk.rows, chunk.start, slideIndex === 0 ? 1.55 : 0.35);
  });

  return pptx;

  const files = {
    "[Content_Types].xml": portMapPptContentTypesXml(chunks.length),
    "_rels/.rels": rootRelsXml(),
    "docProps/app.xml": portMapPptAppPropsXml(chunks.length),
    "docProps/core.xml": portMapPptCorePropsXml(),
    "ppt/presentation.xml": portMapPresentationXml(chunks.length),
    "ppt/_rels/presentation.xml.rels": portMapPresentationRelsXml(chunks.length),
    "ppt/slideMasters/slideMaster1.xml": slideMasterXml(),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": slideMasterRelsXml(),
    "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml(),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": slideLayoutRelsXml(),
    "ppt/theme/theme1.xml": themeXml(),
    "ppt/viewProps.xml": viewPropsXml(),
    "ppt/tableStyles.xml": tableStylesXml(),
  };
  chunks.forEach((chunk, index) => {
    files[`ppt/slides/slide${index + 1}.xml`] = portMapSlideXml(portMap, chunk, index + 1, chunks.length);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRelsXml();
  });

  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function addPortMapPptHeader(slide, pageNumber, pageCount, generatedAtText) {
  slide.addText("Leaf-Spine Port Map", {
    x: 0.35, y: 0.2, w: 2.6, h: 0.28,
    fontFace: "Arial", fontSize: 17, bold: true, color: "2563EB", margin: 0,
  });
  slide.addText(`Created by 임채성 ${generatedAtText}`, {
    x: 0.5, y: 0.5, w: 2.48, h: 0.16,
    fontFace: "Arial", fontSize: 7.5, bold: true, color: "5B6B86", align: "right", margin: 0,
  });
  addPortMapPptPageNumber(slide, pageNumber, pageCount, 0.32);
}

function addPortMapPptPageNumber(slide, pageNumber, pageCount, y = 0.12) {
  slide.addText(`Page ${pageNumber} / ${pageCount}`, {
    x: 11.4, y, w: 1.4, h: 0.2,
    fontFace: "Arial", fontSize: 8, bold: true, color: "5B6B86", align: "right", margin: 0,
  });
}

function addPortMapPptSummary(slide, portMap) {
  portMap.summary.forEach(([label, value], index) => {
    const x = 0.35 + index * 2.05;
    slide.addShape("roundRect", {
      x, y: 0.82, w: 1.85, h: 0.46,
      rectRadius: 0.04,
      fill: { color: "FFFFFF" },
      line: { color: "C8D8EE", width: 0.45 },
    });
    slide.addText(label, {
      x: x + 0.09, y: 0.9, w: 1.65, h: 0.1,
      fontFace: "Arial", fontSize: 6.3, bold: true, color: "5B6B86", margin: 0,
    });
    slide.addText(value, {
      x: x + 0.09, y: 1.05, w: 1.65, h: 0.14,
      fontFace: "Arial", fontSize: 9.3, bold: true, color: "0F172A", margin: 0,
    });
  });
}

function addPortMapPptTable(slide, rows, startIndex, y) {
  const tableRows = [
    portMapHeaders().map((header) => ({
      text: header,
      options: { bold: true, color: "1D4ED8" },
    })),
    ...rows.map((row, rowIndex) => portMapRowValues(row, startIndex + rowIndex).map((value, cellIndex) => {
      const isSection = cellIndex === 1;
      const isPod = cellIndex === 2 && row.pod !== "-";
      const sectionColor = row.section === "Node-Leaf" ? "1D4ED8" : "8A4B12";
      const tone = isPod ? podTone(row.podIndex || 0) : null;
      return {
        text: String(value),
        options: {
          bold: isSection || isPod,
          color: isSection ? sectionColor : (isPod ? tone.ppt : "0F172A"),
        },
      };
    })),
  ];
  slide.addTable(tableRows, {
    x: 0.35,
    y,
    w: 12.15,
    colW: [0.55, 1.35, 0.85, 1.8, 1.25, 2.05, 1.25, 1.05, 2.1],
    rowH: 0.36,
    fontFace: "Arial",
    fontSize: 9,
    color: "0F172A",
    margin: 0.04,
    border: { type: "solid", color: "C8D8EE", pt: 0.25 },
  });
}

function portMapSlideXml(portMap, chunk, pageNumber, pageCount) {
  const slideW = 12192000;
  const slideH = 6858000;
  const shapes = [];
  let id = 2;
  shapes.push(pptRect(id++, 0, 0, slideW, slideH, "F8FBFF", "F8FBFF"));
  if (pageNumber === 1) {
    shapes.push(pptText(id++, inch(0.35), inch(0.2), inch(2.8), inch(0.32), "Leaf-Spine Port Map", "2563EB", 17, true));
    shapes.push(pptText(id++, inch(1.42), inch(0.5), inch(1.55), inch(0.16), "Created by 임채성", "5B6B86", 7.5, true, "r"));
    shapes.push(pptText(id++, inch(11.35), inch(0.32), inch(1.5), inch(0.2), `Page ${pageNumber} / ${pageCount}`, "5B6B86", 8, true, "r"));
    portMap.summary.forEach(([label, value], index) => {
      const x = 0.35 + index * 2.05;
      shapes.push(pptRect(id++, inch(x), inch(0.82), inch(1.85), inch(0.46), "FFFFFF", "C8D8EE", "roundRect"));
      shapes.push(pptText(id++, inch(x + 0.09), inch(0.9), inch(1.65), inch(0.1), label, "5B6B86", 6.3, true, "l"));
      shapes.push(pptText(id++, inch(x + 0.09), inch(1.05), inch(1.65), inch(0.14), value, "0F172A", 9.3, true, "l"));
    });
  } else {
    shapes.push(pptText(id++, inch(11.35), inch(0.12), inch(1.5), inch(0.18), `Page ${pageNumber} / ${pageCount}`, "5B6B86", 8, true, "r"));
  }

  const tableY = pageNumber === 1 ? 1.55 : 0.35;
  shapes.push(portMapTableXml(id++, chunk.rows, chunk.start, 0.35, tableY));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    ${shapes.join("\n")}
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function portMapTableXml(id, rows, startIndex, xIn, yIn) {
  const colW = [0.55, 1.35, 0.85, 1.8, 1.25, 2.05, 1.25, 1.05, 2.1];
  const rowH = 0.25;
  const tableRows = [
    { type: "header", values: portMapHeaders() },
    ...rows.map((row, rowIndex) => ({ type: "data", source: row, values: portMapRowValues(row, startIndex + rowIndex).map(String), rowIndex })),
  ];
  const tableW = colW.reduce((sum, value) => sum + value, 0);
  const tableH = rowH * tableRows.length;
  return `<p:graphicFrame>
    <p:nvGraphicFramePr><p:cNvPr id="${id}" name="Port Map Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
    <p:xfrm><a:off x="${inch(xIn)}" y="${inch(yIn)}"/><a:ext cx="${inch(tableW)}" cy="${inch(tableH)}"/></p:xfrm>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr>
        <a:tblGrid>${colW.map((width) => `<a:gridCol w="${inch(width)}"/>`).join("")}</a:tblGrid>
        ${tableRows.map((row) => portMapTableRowXml(row, rowH)).join("")}
      </a:tbl>
    </a:graphicData></a:graphic>
  </p:graphicFrame>`;
}

function portMapTableRowXml(row, rowH) {
  return `<a:tr h="${inch(rowH)}">${row.values.map((value, cellIndex) => portMapTableCellXml(row, value, cellIndex)).join("")}</a:tr>`;
}

function portMapTableCellXml(row, value, cellIndex) {
  let fill = "FFFFFF";
  let color = "0F172A";
  let bold = false;
  if (row.type === "header") {
    fill = "DBEAFE";
    color = "1D4ED8";
    bold = true;
  } else if (cellIndex === 1) {
    color = row.source.section === "Node-Leaf" ? "1D4ED8" : "8A4B12";
    bold = true;
  } else if (cellIndex === 2 && row.source.pod !== "-") {
    const tone = podTone(row.source.podIndex || 0);
    fill = tone.fill;
    color = tone.ppt;
    bold = true;
  } else if (row.rowIndex % 2) {
    fill = "F8FBFF";
  }
  return `<a:tc>
    <a:txBody><a:bodyPr wrap="none" lIns="28575" rIns="28575" tIns="9525" bIns="9525" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="ko-KR" sz="540"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/></a:rPr><a:t>${escapeXml(value)}</a:t></a:r></a:p></a:txBody>
    <a:tcPr><a:lnL w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnL><a:lnR w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnR><a:lnT w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnT><a:lnB w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></a:tcPr>
  </a:tc>`;
}

function inch(value) {
  return Math.round(value * 914400);
}

function portMapPptContentTypesXml(slideCount) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slideOverrides}<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/></Types>`;
}

function portMapPresentationXml(slideCount) {
  const slides = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="12192000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="ko-KR"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
}

function portMapPresentationRelsXml(slideCount) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const nextId = slideCount + 2;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId${nextId + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${nextId + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
}

function portMapPptAppPropsXml(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Leaf-Spine Planner</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slideCount}</Slides></Properties>`;
}

function portMapPptCorePropsXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Leaf-Spine Port Map</dc:title><dc:creator>임채성</dc:creator><cp:lastModifiedBy>임채성</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

const LeafSpinePortMap = {
  openWindow: openPortMapWindow,
  build: buildPortMap,
  exportExcel: exportPortMapExcel,
  exportPpt: exportPortMapPpt,
  buildXlsx: buildPortMapXlsx,
  buildPptx: buildPortMapPptx,
};
