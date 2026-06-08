/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

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
      const fabricIndexes = fabricGroupIndexes(podIndex, input, best);
      const localServerIndex = serverLocalIndex(serverIndex, input, best);
      for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
        const leafIndex = podCount > 1
          ? podIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : ((serverIndex * activeNicPorts + nicIndex) % best.leafCount);
        const leafLogicalPort = leafServerPortCounters[leafIndex];
        leafServerPortCounters[leafIndex] += 1;
        serverLeafRows.push({
          podIndex,
          podColorIndex: fabricIndexes.pod,
          planeColorIndex: fabricIndexes.plane,
          pod: fabricGroupPodLabel(podIndex, input, best),
          plane: fabricGroupPlaneLabel(podIndex, input, best),
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
    const fabricIndexes = fabricGroupIndexes(podIndex, input, best);
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
          podColorIndex: fabricIndexes.pod,
          planeColorIndex: fabricIndexes.plane,
          pod: fabricGroupPodLabel(podIndex, input, best),
          plane: fabricGroupPlaneLabel(podIndex, input, best),
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
  return fabricGroupLabel(podIndex, input, best) || "-";
}

function leafLabel(leafIndex, perPodLeafs, podCount, input = null, best = null) {
  const groupLabel = podCount > 1 ? fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best) : "";
  if (groupLabel) return `${groupLabel} Leaf ${(leafIndex % perPodLeafs) + 1}`;
  return `Leaf ${leafIndex + 1}`;
}

function spineLabel(spineIndex, perPodSpines, podCount, input = null, best = null) {
  const groupLabel = podCount > 1 ? fabricGroupLabel(Math.floor(spineIndex / perPodSpines), input, best) : "";
  if (groupLabel) return `${groupLabel} Spine ${(spineIndex % perPodSpines) + 1}`;
  return `Spine ${spineIndex + 1}`;
}

function fabricGroupLabel(groupIndex, input = null, best = null) {
  const sourceInput = input || currentResult?.input || {};
  const sourceBest = best || currentResult?.best || {};
  const planeCount = sourceBest.planeCount || (sourceInput.useMultiPlanar ? 2 : 1);
  if (sourceInput.useMultiPods && sourceInput.useMultiPlanar) {
    return `Pod ${Math.floor(groupIndex / planeCount) + 1} - Plane ${(groupIndex % planeCount) + 1}`;
  }
  if (sourceInput.useMultiPods) return `Pod ${groupIndex + 1}`;
  if (sourceInput.useMultiPlanar) return `Plane ${groupIndex + 1}`;
  return "";
}

function fabricGroupPodLabel(groupIndex, input = null, best = null) {
  const sourceInput = input || currentResult?.input || {};
  const sourceBest = best || currentResult?.best || {};
  if (!sourceInput.useMultiPods) return "-";
  const planeCount = sourceBest.planeCount || (sourceInput.useMultiPlanar ? 2 : 1);
  return `Pod ${Math.floor(groupIndex / planeCount) + 1}`;
}

function fabricGroupPlaneLabel(groupIndex, input = null, best = null) {
  const sourceInput = input || currentResult?.input || {};
  const sourceBest = best || currentResult?.best || {};
  if (!sourceInput.useMultiPlanar) return "-";
  const planeCount = sourceBest.planeCount || (sourceInput.useMultiPlanar ? 2 : 1);
  return `Plane ${(groupIndex % planeCount) + 1}`;
}

function fabricGroupIndexes(groupIndex, input = null, best = null) {
  const sourceInput = input || currentResult?.input || {};
  const sourceBest = best || currentResult?.best || {};
  const planeCount = sourceBest.planeCount || (sourceInput.useMultiPlanar ? 2 : 1);
  return {
    pod: sourceInput.useMultiPods ? Math.floor(groupIndex / planeCount) : 0,
    plane: sourceInput.useMultiPlanar ? groupIndex % planeCount : 0,
  };
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
    ? `<p class="notice">${escapeXml(tr("portMap.largeRowNotice", { rowCount: rows.length.toLocaleString() }))}</p>`
    : "";
  const serializedRows = JSON.stringify(rows);
  return `<!doctype html>
<html lang="${currentLocale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(tr("portMap.title"))}</title>
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
        flex: 0 0 auto;
      }
      .toolbar strong {
        color: #0f172a;
        font-size: 20px;
        white-space: nowrap;
      }
      .actions {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }
      button {
        min-height: 28px;
        border: 1px solid #c8d8ee;
        border-radius: 6px;
        background: #fff;
        color: #1d4ed8;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        padding: 0;
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
        min-height: 28px;
        border: 0;
        padding: 0 10px;
        background: #fff;
        color: #1d4ed8;
        text-align: left;
        font-size: 12px;
        font-weight: 900;
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
      }
      td {
        font-size: 13px;
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
    <div class="toolbar">
      <strong>Port Map</strong>
      <div class="actions">
        <div id="portMapExportMenu" class="export-menu">
          <button id="exportPortMap" type="button">${escapeXml(tr("portMap.exportButton"))}</button>
          <div class="export-menu-list" role="menu" aria-label="${escapeXml(tr("portMap.exportFormatAriaLabel"))}">
            <button type="button" data-export-value="excel">Excel</button>
            <button type="button" data-export-value="ppt">PPT</button>
          </div>
        </div>
      </div>
    </div>
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
              <th>${escapeXml(tr("portMap.columns.segment"))}</th>
              <th>${escapeXml(tr("common.pod"))}</th>
              <th>${escapeXml(tr("portMap.columns.plane"))}</th>
              <th>${escapeXml(tr("portMap.columns.fromDevice"))}</th>
              <th>${escapeXml(tr("portMap.columns.fromPort"))}</th>
              <th>${escapeXml(tr("portMap.columns.toDevice"))}</th>
              <th>${escapeXml(tr("portMap.columns.toPort"))}</th>
              <th>${escapeXml(tr("portMap.columns.speed"))}</th>
              <th>${escapeXml(tr("portMap.columns.group"))}</th>
            </tr>
          </thead>
          <tbody id="portMapBody"></tbody>
        </table>
      </div>
    </main>
    <script>
      const portMapRows = ${serializedRows};
      portMapRows.forEach((row, index) => { row.originalIndex = index; });
      const tbody = document.querySelector("#portMapBody");
      let visibleRows = portMapRows;
      let renderToken = 0;
      const podTones = [
        { text: "#1d4ed8", bg: "#eff6ff" },
        { text: "#047857", bg: "#ecfdf5" },
        { text: "#8a4b12", bg: "#fff7ed" },
        { text: "#6d28d9", bg: "#f5f3ff" },
        { text: "#be123c", bg: "#fff1f2" },
        { text: "#0e7490", bg: "#ecfeff" },
      ];
      const planeTones = [
        { text: "#0f766e", bg: "#ccfbf1" },
        { text: "#7e22ce", bg: "#f3e8ff" },
        { text: "#b45309", bg: "#fef3c7" },
        { text: "#be123c", bg: "#ffe4e6" },
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
      function renderRowsChunk(start = 0, token = renderToken) {
        if (token !== renderToken) return;
        const fragment = document.createDocumentFragment();
        const end = Math.min(start + 600, visibleRows.length);
        for (let index = start; index < end; index += 1) {
          const row = visibleRows[index];
          const tr = document.createElement("tr");
          const podTone = podTones[(row.podColorIndex || 0) % podTones.length];
          const planeTone = planeTones[(row.planeColorIndex || 0) % planeTones.length];
          appendCell(tr, row.originalIndex + 1);
          appendCell(tr, row.section, "section " + sectionClass(row.section));
          appendCell(tr, row.pod, "pod-cell", row.pod === "-" ? "" : "color:" + podTone.text + "; background:" + podTone.bg + ";");
          appendCell(tr, row.plane, "pod-cell", row.plane === "-" ? "" : "color:" + planeTone.text + "; background:" + planeTone.bg + ";");
          appendCell(tr, row.sourceDevice);
          appendCell(tr, row.sourcePort);
          appendCell(tr, row.targetDevice);
          appendCell(tr, row.targetPort);
          appendCell(tr, row.speed);
          appendCell(tr, row.group);
          fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        if (end < visibleRows.length) {
          requestAnimationFrame(() => renderRowsChunk(end, token));
        }
      }
      requestAnimationFrame(() => renderRowsChunk(0, renderToken));
      function runExport(name, format) {
        if (!window.opener) {
          alert(${JSON.stringify(tr("portMap.notConnectedAlert"))});
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
  const tone = podTone(row.podColorIndex || 0);
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

function planeTone(index) {
  const tones = [
    { text: "#0f766e", bg: "#ccfbf1", ppt: "0F766E", fill: "CCFBF1" },
    { text: "#7e22ce", bg: "#f3e8ff", ppt: "7E22CE", fill: "F3E8FF" },
    { text: "#b45309", bg: "#fef3c7", ppt: "B45309", fill: "FEF3C7" },
    { text: "#be123c", bg: "#ffe4e6", ppt: "BE123C", fill: "FFE4E6" },
  ];
  return tones[index % tones.length];
}
