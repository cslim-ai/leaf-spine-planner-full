/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const fs = require("fs");
const vm = require("vm");
const calculator = require("../assets/js/calculator");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadPortMap() {
  const context = {
    console,
    window: {},
    currentResult: null,
    activeServerNicPorts: calculator.activeServerNicPorts,
    leafSpineLeafTwinFactor: calculator.leafSpineLeafTwinFactor,
    leafSpineTwinFactor: calculator.leafSpineTwinFactor,
    effectiveSwitchLinkSpeed: calculator.effectiveSwitchLinkSpeed,
    linksForSpine: calculator.linksForSpine,
    priorLinksForSpine: calculator.priorLinksForSpine,
    formatGbps: (value) => `${value} Gbps`,
    setTimeout: () => {},
    URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
    Blob: function Blob() {},
  };
  vm.createContext(context);
  context.currentLocale = "en";
  context.tr = (key) => ({
    "portMap.title": "Port Map",
    "portMap.largeRowNotice": "Large row count",
    "portMap.columns.segment": "Segment",
    "common.pod": "Pod",
    "portMap.columns.plane": "Plane",
    "portMap.columns.fromDevice": "From Device",
    "portMap.columns.fromPort": "From Port",
    "portMap.columns.toDevice": "To Device",
    "portMap.columns.toPort": "To Port",
    "portMap.columns.speed": "Link Speed",
    "portMap.columns.group": "Group",
    "portMap.notConnectedAlert": "Not connected",
    "meta.credit": "credit",
  }[key] || key);
  context.escapeXml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  context.makeEmbeddedPretendardFontCss = () => "";
  const code = `${fs.readFileSync("assets/js/portmap.js", "utf8")}\nthis.__portMap = { buildPortMap, fabricGroupLabel, makePortMapHtml };`;
  vm.runInContext(code, context);
  return context.__portMap;
}

{
  const { buildPortMap } = loadPortMap();
  const portMap = buildPortMap({
    input: {
      serverCount: 4,
      serverNicPorts: 1,
      serverLinkSpeed: 400,
      switchLinkSpeed: 400,
      useTwinPort: false,
      disableUplinkTwinPort: false,
      spineUseTwinPort: false,
      useMultiPods: false,
      useMultiPlanar: false,
    },
    best: {
      podCount: 2,
      perPodLeafs: 2,
      perPodSpines: 1,
      leafCount: 4,
      spines: 2,
      downlinks: 1,
      uplinksPerLeaf: 1,
    },
  });

  const visibleLabels = [
    ...portMap.serverLeafRows.flatMap((row) => [row.sourcePort, row.targetDevice, row.pod, row.plane]),
    ...portMap.leafSpineRows.flatMap((row) => [row.sourceDevice, row.targetDevice, row.pod, row.plane]),
  ].filter(Boolean);

  assert(!visibleLabels.some((label) => label.includes("Group")), "non-multi port map labels should not include Group");
  assert(portMap.serverLeafRows.some((row) => row.targetDevice === "Leaf 1"), "non-multi target leaf should use the plain global label");
  assert(portMap.leafSpineRows.some((row) => row.targetDevice === "Spine 1"), "non-multi target spine should use the plain global label");
}

{
  const { buildPortMap, fabricGroupLabel } = loadPortMap();
  const input = {
    serverCount: 4,
    serverNicPorts: 1,
    serverLinkSpeed: 400,
    switchLinkSpeed: 400,
    useTwinPort: false,
    disableUplinkTwinPort: false,
    spineUseTwinPort: false,
    useMultiPods: true,
    useMultiPlanar: true,
    podServerCount: 2,
  };
  const best = {
    podCount: 4,
    planeCount: 2,
    multiPodCount: 2,
    podServerCount: 2,
    perPodLeafs: 1,
    perPodSpines: 1,
    leafCount: 4,
    spines: 4,
    downlinks: 1,
    uplinksPerLeaf: 1,
  };
  const portMap = buildPortMap({ input, best });
  const firstRow = portMap.serverLeafRows[0];
  const secondPlaneRow = portMap.serverLeafRows.find((row) => row.pod === "Pod 1" && row.plane === "Plane 2");

  assert(fabricGroupLabel(0, input, best) === "Pod 1 - Plane 1", "multi-planar pod fabric label should show Pod before Plane");
  assert(firstRow.pod === "Pod 1", `first port map row should keep Pod in the Pod column: ${firstRow.pod}`);
  assert(firstRow.plane === "Plane 1", `first port map row should keep Plane in the Plane column: ${firstRow.plane}`);
  assert(firstRow.podColorIndex === 0, "Pod color grouping should use actual Pod index");
  assert(firstRow.planeColorIndex === 0, "Plane color grouping should use actual Plane index");
  assert(secondPlaneRow && secondPlaneRow.podColorIndex === 0, "Rows in the same Pod should keep the same Pod color index");
  assert(secondPlaneRow && secondPlaneRow.planeColorIndex === 1, "Rows in different Planes should use a different Plane color index");
}

{
  const { makePortMapHtml } = loadPortMap();
  const html = makePortMapHtml({ summary: [], serverLeafRows: [], leafSpineRows: [] });
  assert(/td\s*\{[\s\S]*font-size:\s*13px;/.test(html), "port map table body font size should be 13px");
  assert(/thead th\s*\{[\s\S]*font-size:\s*13px;/.test(html), "port map table header font size should remain 13px");
}

console.log("port map label tests passed");
