/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Diagram geometry and shared SVG node helpers.
const GEOMETRY_CALCULATOR = typeof LeafSpineCalculator !== "undefined"
  ? LeafSpineCalculator
  : (typeof require === "function" ? require("./calculator") : null);
const GEOMETRY_DIAGRAM_LABEL_GUTTER = typeof DIAGRAM_LABEL_GUTTER !== "undefined" ? DIAGRAM_LABEL_GUTTER : 0;
const GEOMETRY_DIAGRAM_CONTENT_OFFSET = typeof DIAGRAM_CONTENT_OFFSET !== "undefined" ? DIAGRAM_CONTENT_OFFSET : 96;
const GEOMETRY_DEFAULT_DIAGRAM_VIEW_WIDTH = typeof DEFAULT_DIAGRAM_VIEW_WIDTH !== "undefined" ? DEFAULT_DIAGRAM_VIEW_WIDTH : 920;
const GEOMETRY_SUMMARY_POD_GROUP_GAP_EXTRA = 56;
const GEOMETRY_SUMMARY_PLANE_GROUP_GAP_EXTRA = 24;
const GEOMETRY_SUMMARY_HIDDEN_POD_GROUP_GAP_EXTRA = 24;
const GEOMETRY_FALLBACK_NIC_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be123c",
  "#4d7c0f",
  "#9333ea",
  "#0f766e",
  "#b45309",
  "#475569",
  "#c026d3",
];
const GEOMETRY_FALLBACK_LEAF_COLORS = [
  "#334155",
  "#a16207",
  "#7c2d12",
  "#581c87",
  "#0f766e",
  "#9f1239",
  "#1e3a8a",
  "#365314",
  "#7f1d1d",
  "#4c1d95",
];
const geometryActiveServerNicPorts = GEOMETRY_CALCULATOR.activeServerNicPorts;
const geometryLinksForSpine = GEOMETRY_CALCULATOR.linksForSpine;

function diagramGeometryForView(result, viewMode) {
  if (viewMode === "wrapped") return getPptDiagramGeometry(result);
  if (viewMode === "summary") return getSummaryDiagramGeometry(result);
  return getDiagramGeometry(result);
}

function getDiagramGeometry({ input, best }) {
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const labelGutter = GEOMETRY_DIAGRAM_LABEL_GUTTER;
  const switchW = 116;
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = geometryActiveServerNicPorts(input);
  const serverH = 62;
  const serverSlotWidth = Math.max(86, serverW + 14);
  const leafSlotWidth = Math.max(120, switchW + 12);
  const serverSlots = Math.max(shownServers, shownLeafs);
  const width = Math.max(920, labelGutter + serverSlots * Math.max(serverSlotWidth, leafSlotWidth) + 150);
  const contentLeft = labelGutter + GEOMETRY_DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const spineY = 58;
  const serverXs = distribute(center, shownServers, Math.max(serverSlotWidth, Math.min(104, width / Math.max(shownServers, 1) * 0.8)));
  const serverRowWidth = rowExtent(serverXs);
  const { spineLeafGap, leafServerGap } = fullDiagramLayerGaps(serverRowWidth, serverW, spineY, serverH);
  const leafY = spineY + spineLeafGap;
  const serverY = leafY + leafServerGap;
  const height = Math.round(serverY + serverH / 2 + 58);
  const spineXs = distribute(center, shownSpines, expandedRowSpacing(shownSpines, 126, serverRowWidth * 0.23));
  const leafXs = distribute(center, shownLeafs, expandedRowSpacing(shownLeafs, Math.max(120, Math.min(160, width / Math.max(shownLeafs, 1) * 0.8)), serverRowWidth * 0.31));
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || shownLeafs;
  const perPodSpines = best.perPodSpines || shownSpines;
  const lines = [];
  const switches = [];
  const servers = [];

  spineXs.forEach((x, index) => {
    const label = spineDeviceLabel(index, input, best, perPodSpines, podCount);
    switches.push({ kind: "spine", x, y: spineY, w: switchW, h: switchH, label, device: label, deviceKey: `spine-${index}` });
  });

  leafXs.forEach((leafX, leafIndex) => {
    const podIndex = Math.floor(leafIndex / perPodLeafs);
    const spineStart = podIndex * perPodSpines;
    const spineEnd = Math.min(spineStart + perPodSpines, spineXs.length);
    spineXs.slice(spineStart, spineEnd).forEach((spineX, localSpineIndex) => {
      const linkCount = geometryLinksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
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
          source: leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount),
          target: spineDeviceLabel(spineStart + localSpineIndex, input, best, perPodSpines, podCount),
          sourceKey: `leaf-${leafIndex}`,
          targetKey: `spine-${spineStart + localSpineIndex}`,
        });
      }
    });
    const label = leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount);
    switches.push({ kind: "leaf", x: leafX, y: leafY, w: switchW, h: switchH, label, device: label, deviceKey: `leaf-${leafIndex}` });
  });

  serverXs.forEach((serverX, serverIndex) => {
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;
    const ports = [];
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const nicX = nicPortX(serverX, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverY - serverH / 2 + 7, color });
      serverFabricGroupIndexes(serverIndex, input, best).forEach((groupIndex) => {
        const localServerIndex = serverLocalIndex(serverIndex, input, best);
        const leafIndex = podCount > 1
          ? groupIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : (nicLeafStart + nicIndex) % shownLeafs;
        lines.push({
          x1: nicX,
          y1: serverY - serverH / 2,
          x2: leafXs[leafIndex],
          y2: leafY + switchH / 2,
          color,
          kind: "link",
          title: podCount > 1 ? `Node NIC ${nicIndex + 1} ${fabricGroupLabel(groupIndex, input, best)}` : `Node NIC ${nicIndex + 1}`,
          source: nodeDeviceLabelForGroup(serverIndex, input, best, groupIndex),
          target: leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount),
          sourceKey: `node-${serverIndex}`,
          targetKey: `leaf-${leafIndex}`,
        });
      });
    }
    const label = nodeDeviceLabel(serverIndex, input, best);
    servers.push({ x: serverX, y: serverY, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label, device: label, deviceKey: `node-${serverIndex}`, ports });
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

function getPptDiagramGeometry({ input, best }) {
  const wrappedSpinesPerRow = 8;
  const wrappedLeafsPerRow = 10;
  const wrappedServersPerRow = 16;
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const switchW = 116;
  const switchH = 24;
  const spineGap = 150;
  const leafGap = 150;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = geometryActiveServerNicPorts(input);
  const serverH = 62;
  const serverGap = Math.max(88, serverW + 18);
  const labelGutter = GEOMETRY_DIAGRAM_LABEL_GUTTER;
  const spinePerRow = wrappedSpinesPerRow;
  const leafPerRow = wrappedLeafsPerRow;
  const serverPerRow = wrappedServersPerRow;
  const spineRows = Math.ceil(shownSpines / spinePerRow);
  const leafRows = Math.ceil(shownLeafs / leafPerRow);
  const serverRows = Math.ceil(shownServers / serverPerRow);
  const maxRowWidth = Math.max(
    Math.min(shownSpines, spinePerRow) * spineGap,
    Math.min(shownLeafs, leafPerRow) * leafGap,
    Math.min(shownServers, serverPerRow) * serverGap,
  );
  const width = Math.max(920, labelGutter + maxRowWidth + 150);
  const contentLeft = labelGutter + GEOMETRY_DIAGRAM_CONTENT_OFFSET;
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

  const spinePositions = makePptRowPositions(shownSpines, spinePerRow, center, spineStartY, spineRowGap, spineGap);
  const leafPositions = makePptRowPositions(shownLeafs, leafPerRow, center, leafStartY, leafRowGap, leafGap);
  const serverPositions = makePptRowPositions(shownServers, serverPerRow, center, serverStartY, serverRowGap, serverGap);

  spinePositions.forEach((position, index) => {
    const label = spineDeviceLabel(index, input, best, perPodSpines, podCount);
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label, device: label, deviceKey: `spine-${index}` });
  });

  leafPositions.forEach((leafPosition, leafIndex) => {
    const podIndex = Math.floor(leafIndex / perPodLeafs);
    const spineStart = podIndex * perPodSpines;
    const spineEnd = Math.min(spineStart + perPodSpines, spinePositions.length);
    spinePositions.slice(spineStart, spineEnd).forEach((spinePosition, localSpineIndex) => {
      const linkCount = geometryLinksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
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
          source: leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount),
          target: spineDeviceLabel(spineStart + localSpineIndex, input, best, perPodSpines, podCount),
          sourceKey: `leaf-${leafIndex}`,
          targetKey: `spine-${spineStart + localSpineIndex}`,
        });
      }
    });
    const label = leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount);
    switches.push({ kind: "leaf", x: leafPosition.x, y: leafPosition.y, w: switchW, h: switchH, label, device: label, deviceKey: `leaf-${leafIndex}` });
  });

  serverPositions.forEach((serverPosition, serverIndex) => {
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;
    const ports = [];
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const nicX = nicPortX(serverPosition.x, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverPosition.y - serverH / 2 + 7, color });
      serverFabricGroupIndexes(serverIndex, input, best).forEach((groupIndex) => {
        const localServerIndex = serverLocalIndex(serverIndex, input, best);
        const leafIndex = podCount > 1
          ? groupIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : (nicLeafStart + nicIndex) % shownLeafs;
        const leafPosition = leafPositions[leafIndex];
        lines.push({
          x1: nicX,
          y1: serverPosition.y - serverH / 2,
          x2: leafPosition.x,
          y2: leafPosition.y + switchH / 2,
          color,
          kind: "link",
          title: podCount > 1 ? `Node NIC ${nicIndex + 1} ${fabricGroupLabel(groupIndex, input, best)}` : `Node NIC ${nicIndex + 1}`,
          source: nodeDeviceLabelForGroup(serverIndex, input, best, groupIndex),
          target: leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount),
          sourceKey: `node-${serverIndex}`,
          targetKey: `leaf-${leafIndex}`,
        });
      });
    }
    const label = nodeDeviceLabel(serverIndex, input, best);
    servers.push({ x: serverPosition.x, y: serverPosition.y, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label, device: label, deviceKey: `node-${serverIndex}`, ports });
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
  const labelGutter = GEOMETRY_DIAGRAM_LABEL_GUTTER;
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const perPodSpines = best.perPodSpines || best.spines;
  const podServerCount = best.podServerCount || input.serverCount;
  const summaryPlaneCount = best.planeCount || (input.useMultiPlanar ? 2 : 1);
  const usePodSummaryGroups = input.useMultiPods && input.useMultiPlanar;
  const summarySpinesPerPod = usePodSummaryGroups ? perPodSpines * summaryPlaneCount : perPodSpines;
  const summaryLeafsPerPod = usePodSummaryGroups ? perPodLeafs * summaryPlaneCount : perPodLeafs;
  const switchW = summarySwitchWidth(best, podCount);
  const switchEntryLimit = summarySwitchEntryLimit(best, podCount);
  const spineEntries = usePodSummaryGroups
    ? compactEntriesByActualPodPlanes(best.spines, perPodSpines, summaryPlaneCount, "spine")
    : compactEntriesByPod(best.spines, summarySpinesPerPod, switchEntryLimit.spine, "spine");
  const leafEntries = usePodSummaryGroups
    ? compactEntriesByActualPodPlanes(best.leafCount, perPodLeafs, summaryPlaneCount, "leaf")
    : compactEntriesByPod(best.leafCount, summaryLeafsPerPod, switchEntryLimit.leaf, "leaf");
  const serverEntries = compactEntriesByPod(input.serverCount, podServerCount, podCount > 1 ? 7 : 13, "server", 5, { actualPodGroups: input.useMultiPods && input.useMultiPlanar });
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = geometryActiveServerNicPorts(input);
  const serverH = 62;
  const switchSlotWidth = Math.max(92, switchW + 18);
  const serverSlotWidth = Math.max(96, serverW + 16);
  const podGroupGapExtra = input.useMultiPods ? GEOMETRY_SUMMARY_POD_GROUP_GAP_EXTRA : 0;
  const planeGroupGapExtra = input.useMultiPlanar ? GEOMETRY_SUMMARY_PLANE_GROUP_GAP_EXTRA : 0;
  const hiddenPodGroupGapExtra = input.useMultiPods && !input.useMultiPlanar ? GEOMETRY_SUMMARY_HIDDEN_POD_GROUP_GAP_EXTRA : 0;
  const compactGapOptions = { podGroupGapExtra, planeGroupGapExtra, hiddenPodGroupGapExtra, useMultiPlanar: input.useMultiPlanar, useMultiPods: input.useMultiPods };
  const maxRowWidth = Math.max(
    compactEntryRowWidth(spineEntries, switchSlotWidth, compactGapOptions),
    compactEntryRowWidth(leafEntries, switchSlotWidth, compactGapOptions),
    compactEntryRowWidth(serverEntries, serverSlotWidth, compactGapOptions),
  );
  const width = Math.max(920, labelGutter + maxRowWidth + 150);
  const summaryDensity = Math.max(spineEntries.length, leafEntries.length, serverEntries.length);
  const verticalScale = Math.min(1, Math.max(0, (summaryDensity - 10) / 10));
  const spineY = 58;
  const leafY = 190 + verticalScale * 58;
  const serverY = 360 + verticalScale * 138;
  const height = Math.round(serverY + serverH / 2 + 58);
  const contentLeft = labelGutter + GEOMETRY_DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const lines = [];
  const switches = [];
  const servers = [];
  const ellipsis = [];
  const spinePositions = placeCompactEntries(spineEntries, center, spineY, switchSlotWidth, compactGapOptions);
  const leafPositions = placeCompactEntries(leafEntries, center, leafY, switchSlotWidth, compactGapOptions);
  const serverPositions = placeCompactEntries(serverEntries, center, serverY, serverSlotWidth, compactGapOptions);
  const switchEllipsisW = Math.max(78, switchW);

  spineEntries.forEach((entry) => {
    const position = spinePositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Spine", input, best) });
      return;
    }
    const label = spineDeviceLabel(entry.index, input, best, perPodSpines, podCount);
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label, device: label, deviceKey: `spine-${entry.index}` });
  });

  leafEntries.forEach((entry) => {
    const position = leafPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Leaf", input, best) });
      return;
    }
    const label = leafDeviceLabel(entry.index, input, best, perPodLeafs, podCount);
    switches.push({ kind: "leaf", x: position.x, y: position.y, w: switchW, h: switchH, label, device: label, deviceKey: `leaf-${entry.index}` });
  });

  leafEntries.forEach((leafEntry) => {
    const leafPosition = leafPositions.get(leafEntry.key);
    spineEntries.forEach((spineEntry) => {
      if (leafEntry.type !== "node" && spineEntry.type !== "node" && !summaryEntriesCanDrawHiddenUplink(leafEntry, spineEntry)) return;
      if (!summaryEntriesShareFabricGroup(leafEntry, perPodLeafs, spineEntry, perPodSpines)) return;
      const spinePosition = spinePositions.get(spineEntry.key);
      const linkCount = summaryLeafSpineLinkCount(best.uplinksPerLeaf, perPodSpines, spineEntry);
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
          source: leafEntry.type === "node" ? leafDeviceLabel(leafEntry.index, input, best, perPodLeafs, podCount) : "",
          target: spineEntry.type === "node" ? spineDeviceLabel(spineEntry.index, input, best, perPodSpines, podCount) : "",
          sourceKey: leafEntry.type === "node" ? `leaf-${leafEntry.index}` : "",
          targetKey: spineEntry.type === "node" ? `spine-${spineEntry.index}` : "",
        });
      }
    });
  });

  serverEntries.forEach((entry) => {
    const position = serverPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: 78, h: 42, label: summaryHiddenLabel(entry, "Node", input, best) });
      return;
    }

    const ports = [];
    const nicLeafStart = (entry.index * activeNicPorts) % best.leafCount;
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const nicX = nicPortX(position.x, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverY - serverH / 2 + 7, color });
      serverFabricGroupIndexes(entry.index, input, best).forEach((groupIndex) => {
        const localServerIndex = serverLocalIndex(entry.index, input, best);
        const leafIndex = podCount > 1
          ? groupIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : (nicLeafStart + nicIndex) % best.leafCount;
        const leafEntry = leafEntries.find((item) => item.type === "node" && item.index === leafIndex);
        const fallbackLeafEntry = leafEntries.find((item) => {
          if (item.type !== "ellipsis") return false;
          return leafIndex >= item.rangeStart && leafIndex <= item.rangeEnd;
        }) || leafEntries.find((item) => item.type === "ellipsis");
        const linkLeafEntry = leafEntry || fallbackLeafEntry;
        if (!linkLeafEntry) return;
        const leafPosition = leafPositions.get(linkLeafEntry.key);
        lines.push({
          x1: nicX,
          y1: serverY - serverH / 2,
          x2: leafPosition.x,
          y2: leafY + switchH / 2,
          color,
          kind: "link",
          title: podCount > 1 ? `Node NIC ${nicIndex + 1} ${fabricGroupLabel(groupIndex, input, best)}` : `Node NIC ${nicIndex + 1}`,
          source: nodeDeviceLabelForGroup(entry.index, input, best, groupIndex),
          target: linkLeafEntry.type === "node"
            ? leafDeviceLabel(linkLeafEntry.index, input, best, perPodLeafs, podCount)
            : "",
          sourceKey: `node-${entry.index}`,
          targetKey: linkLeafEntry.type === "node" ? `leaf-${linkLeafEntry.index}` : "",
        });
      });
    }
    const label = nodeDeviceLabel(entry.index, input, best);
    servers.push({ x: position.x, y: position.y, w: serverW, h: serverH, number: entry.index + 1, nicCount: input.serverNicPorts, label, device: label, deviceKey: `node-${entry.index}`, ports });
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

function compactEntriesByPod(totalCount, perPodCount, maxEntriesPerPod, kind, maxPods = 5, options = {}) {
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
        actualPodIndex: options.actualPodGroups ? podStart : undefined,
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
          actualPodIndex: options.actualPodGroups ? podIndex : undefined,
        });
        return;
      }
      entries.push({
        ...entry,
        index: start + entry.index,
        key: `${kind}-pod-${podIndex}-node-${entry.index}`,
        podIndex,
        actualPodIndex: options.actualPodGroups ? podIndex : undefined,
      });
    });
  });
  return entries;
}

function compactEntriesByActualPodPlanes(totalCount, perPlaneCount, planeCount, kind, maxPods = 5) {
  const entries = [];
  const devicesPerPod = perPlaneCount * planeCount;
  const podCount = Math.ceil(totalCount / devicesPerPod);
  const podEntries = compactPodEntries(podCount, maxPods);

  podEntries.forEach((podEntry) => {
    if (podEntry.type === "ellipsis") {
      const podStart = podEntry.rangeStart || 0;
      const podEnd = podEntry.rangeEnd || podCount - 1;
      const rangeStart = podStart * devicesPerPod;
      const rangeEnd = Math.min(totalCount - 1, (podEnd + 1) * devicesPerPod - 1);
      entries.push({
        type: "ellipsis",
        key: `${kind}-actual-pods-${podStart}-${podEnd}-ellipsis`,
        podEllipsis: true,
        actualPodIndex: podStart,
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
    for (let planeIndex = 0; planeIndex < planeCount; planeIndex += 1) {
      const fabricGroupIndex = podIndex * planeCount + planeIndex;
      const start = fabricGroupIndex * perPlaneCount;
      if (start >= totalCount) continue;
      const count = Math.min(perPlaneCount, totalCount - start);
      compactLayerEntries(count, 3).forEach((entry) => {
        if (entry.type === "ellipsis") {
          entries.push({
            ...entry,
            key: `${kind}-pod-${podIndex}-plane-${planeIndex}-ellipsis`,
            podIndex: fabricGroupIndex,
            actualPodIndex: podIndex,
            actualFabricGroupIndex: fabricGroupIndex,
            rangeStart: start + entry.rangeStart,
            rangeEnd: start + entry.rangeEnd,
            hiddenCount: entry.hiddenCount,
          });
          return;
        }
        entries.push({
          ...entry,
          index: start + entry.index,
          key: `${kind}-pod-${podIndex}-plane-${planeIndex}-node-${entry.index}`,
          podIndex: fabricGroupIndex,
          actualPodIndex: podIndex,
          actualFabricGroupIndex: fabricGroupIndex,
        });
      });
    }
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

function normalizeGeometryHorizontal(geometry, padding = 0) {
  const bounds = getGeometryHorizontalBounds(geometry);
  if (!bounds) return geometry;
  const contentWidth = bounds.maxX - bounds.minX;
  const width = Math.max(1, Math.ceil(contentWidth + padding * 2));
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

function summaryHiddenLabel(entry, label, input, best) {
  if (entry.podEllipsis) {
    const groupText = hiddenFabricGroupText(input, label);
    return `${entry.hiddenPodCount} ${groupText}\nhidden`;
  }
  const groupLabel = hiddenEntryGroupLabel(entry, input, best);
  if (entry.actualFabricGroupIndex !== undefined && groupLabel) {
    return `${groupLabel}\n${entry.hiddenCount} ${label}\nhidden`;
  }
  const podPrefix = groupLabel ? `${groupLabel} - ` : "";
  return `${podPrefix}${entry.hiddenCount} ${label}\nhidden`;
}

function hiddenEntryGroupLabel(entry, input, best) {
  if (entry.actualFabricGroupIndex !== undefined) return fabricGroupLabel(entry.actualFabricGroupIndex, input, best);
  if (entry.actualPodIndex !== undefined) return `Pod ${entry.actualPodIndex + 1}`;
  if (entry.podIndex === undefined) return "";
  return fabricGroupLabel(entry.podIndex, input, best);
}

function hiddenFabricGroupText(input, fallbackLabel) {
  if (input.useMultiPods && input.useMultiPlanar) return "Pod";
  if (input.useMultiPods) return "Pod";
  if (input.useMultiPlanar) return "Plane";
  return fallbackLabel;
}

function fabricGroupLabel(groupIndex, input, best) {
  const planeCount = best.planeCount || (input.useMultiPlanar ? 2 : 1);
  if (input.useMultiPods && input.useMultiPlanar) {
    return `Pod ${Math.floor(groupIndex / planeCount) + 1} - Plane ${(groupIndex % planeCount) + 1}`;
  }
  if (input.useMultiPods) return `Pod ${groupIndex + 1}`;
  if (input.useMultiPlanar) return `Plane ${groupIndex + 1}`;
  return "";
}

function fabricDeviceLabel(groupIndex, kind, localIndex, globalIndex, input, best) {
  const groupLabel = fabricGroupLabel(groupIndex, input, best);
  const deviceLabel = `${kind} ${localIndex + 1}`;
  if (!groupLabel) return `${kind} ${globalIndex + 1}`;
  return input.useMultiPlanar && input.useMultiPods ? `${groupLabel}\n${deviceLabel}` : `${groupLabel} - ${deviceLabel}`;
}

function spineDeviceLabel(spineIndex, input, best, perPodSpines, podCount) {
  const groupIndex = podCount > 1 ? Math.floor(spineIndex / perPodSpines) : 0;
  const localIndex = podCount > 1 ? spineIndex % perPodSpines : spineIndex;
  return fabricDeviceLabel(groupIndex, "Spine", localIndex, spineIndex, input, best);
}

function leafDeviceLabel(leafIndex, input, best, perPodLeafs, podCount) {
  const groupIndex = podCount > 1 ? Math.floor(leafIndex / perPodLeafs) : 0;
  const localIndex = podCount > 1 ? leafIndex % perPodLeafs : leafIndex;
  return fabricDeviceLabel(groupIndex, "Leaf", localIndex, leafIndex, input, best);
}

function nodeDeviceLabel(serverIndex, input, best) {
  return nodeDeviceLabelForGroup(serverIndex, input, best, null);
}

function nodeDeviceLabelForGroup(serverIndex, input, best, groupIndex) {
  if (!input.useMultiPods && !input.useMultiPlanar) return `Node ${serverIndex + 1}`;
  const multiPodCount = best.multiPodCount || Math.ceil(input.serverCount / Math.max(1, input.podServerCount || input.serverCount));
  const podServerCount = best.podServerCount || input.serverCount;
  const podIndex = Math.min(multiPodCount - 1, Math.floor(serverIndex / podServerCount));
  const localNodeLabel = `Node ${(serverIndex % podServerCount) + 1}`;
  if (input.useMultiPlanar) {
    return input.useMultiPods ? `Pod ${podIndex + 1} - ${localNodeLabel}` : `Node ${serverIndex + 1}`;
  }
  return `Pod ${podIndex + 1} - ${localNodeLabel}`;
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

function summaryEntriesShareFabricGroup(leftEntry, leftPerGroup, rightEntry, rightPerGroup) {
  const leftRange = summaryEntryFabricGroupRange(leftEntry, leftPerGroup);
  const rightRange = summaryEntryFabricGroupRange(rightEntry, rightPerGroup);
  return leftRange.start <= rightRange.end && rightRange.start <= leftRange.end;
}

function summaryEntriesCanDrawHiddenUplink(leafEntry, spineEntry) {
  if (leafEntry.type !== "ellipsis" || spineEntry.type !== "ellipsis") return false;
  if (leafEntry.podEllipsis || spineEntry.podEllipsis) return false;
  const leafGroup = leafEntry.actualFabricGroupIndex ?? leafEntry.podIndex;
  const spineGroup = spineEntry.actualFabricGroupIndex ?? spineEntry.podIndex;
  if (leafGroup === undefined && spineGroup === undefined) return true;
  return leafGroup !== undefined && leafGroup === spineGroup;
}

function summaryLeafSpineLinkCount(uplinksPerLeaf, perPodSpines, spineEntry) {
  const representativeSpineIndex = spineEntry.index ?? spineEntry.rangeStart ?? 0;
  return geometryLinksForSpine(uplinksPerLeaf, perPodSpines, representativeSpineIndex % perPodSpines);
}

function summaryEntryFabricGroupRange(entry, perGroup) {
  const startIndex = entry.rangeStart ?? entry.index ?? 0;
  const endIndex = entry.rangeEnd ?? entry.index ?? startIndex;
  return {
    start: Math.floor(startIndex / perGroup),
    end: Math.floor(endIndex / perGroup),
  };
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

function placeCompactEntries(entries, center, y, gap, gapOptions = {}) {
  const positions = new Map();
  const xs = distributeCompactEntries(center, entries, gap, gapOptions);
  entries.forEach((entry, index) => {
    positions.set(entry.key, { x: xs[index], y });
  });
  return positions;
}

function compactEntryRowWidth(entries, gap, gapOptions = {}) {
  if (entries.length <= 1) return gap;
  return gap * entries.length + compactEntryBoundaryExtraWidth(entries, gapOptions);
}

function distributeCompactEntries(center, entries, gap, gapOptions = {}) {
  if (entries.length === 1) return [center];
  const stepWidths = entries.slice(1).map((entry, index) => (
    gap + compactEntryBoundaryExtra(entries[index], entry, gapOptions)
  ));
  const totalWidth = stepWidths.reduce((sum, step) => sum + step, 0);
  let x = center - totalWidth / 2;
  const xs = [x];
  stepWidths.forEach((step) => {
    x += step;
    xs.push(x);
  });
  return xs;
}

function compactEntryBoundaryExtraWidth(entries, gapOptions = {}) {
  return entries.slice(1).reduce((width, entry, index) => width + compactEntryBoundaryExtra(entries[index], entry, gapOptions), 0);
}

function compactEntryBoundaryExtra(left, right, gapOptions = {}) {
  if (compactEntriesTouchHiddenPodBoundary(left, right)) return gapOptions.hiddenPodGroupGapExtra || gapOptions.podGroupGapExtra || 0;
  if (gapOptions.useMultiPlanar && !gapOptions.useMultiPods && compactEntriesCrossPlaneBoundary(left, right, gapOptions)) return gapOptions.planeGroupGapExtra || 0;
  if (compactEntriesCrossPodBoundary(left, right)) return gapOptions.podGroupGapExtra || 0;
  if (compactEntriesCrossPlaneBoundary(left, right, gapOptions)) return gapOptions.planeGroupGapExtra || 0;
  return 0;
}

function compactEntriesTouchHiddenPodBoundary(left, right) {
  return Boolean(left.podEllipsis || right.podEllipsis) && Boolean(compactEntriesCrossPodBoundary(left, right));
}

function compactEntriesCrossPodBoundary(left, right) {
  const leftPod = compactEntryPodGroup(left);
  const rightPod = compactEntryPodGroup(right);
  return leftPod !== undefined && rightPod !== undefined && leftPod !== rightPod ? 1 : 0;
}

function compactEntriesCrossPlaneBoundary(left, right, gapOptions = {}) {
  const leftPod = compactEntryPodGroup(left);
  const rightPod = compactEntryPodGroup(right);
  const leftPlane = compactEntryFabricGroup(left);
  const rightPlane = compactEntryFabricGroup(right);
  if (gapOptions.useMultiPlanar && !gapOptions.useMultiPods) {
    return leftPlane !== undefined && rightPlane !== undefined && leftPlane !== rightPlane ? 1 : 0;
  }
  return leftPod !== undefined
    && rightPod !== undefined
    && leftPod === rightPod
    && leftPlane !== undefined
    && rightPlane !== undefined
    && leftPlane !== rightPlane
    ? 1
    : 0;
}

function compactEntryPodGroup(entry) {
  if (entry.actualPodIndex !== undefined) return entry.actualPodIndex;
  if (entry.rangePodStart !== undefined) return entry.rangePodStart;
  return entry.podIndex;
}

function compactEntryFabricGroup(entry) {
  if (entry.actualFabricGroupIndex !== undefined) return entry.actualFabricGroupIndex;
  return entry.podIndex;
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

function rowExtent(xs) {
  if (xs.length <= 1) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

function fullDiagramLayerGaps(serverRowWidth, serverW, spineY, serverH, targetRatio = 0.325) {
  const minSpineLeafGap = 132;
  const minLeafServerGap = 170;
  const estimatedWidth = Math.max(1, Math.ceil(serverRowWidth + serverW));
  const targetHeight = Math.round(estimatedWidth * targetRatio);
  const fixedHeight = spineY + serverH / 2 + 58;
  const gapBudget = Math.max(minSpineLeafGap + minLeafServerGap, targetHeight - fixedHeight);
  const spineLeafGap = Math.max(minSpineLeafGap, Math.round(gapBudget * 0.43));
  return {
    spineLeafGap,
    leafServerGap: Math.max(minLeafServerGap, gapBudget - spineLeafGap),
  };
}

function expandedRowSpacing(count, baseGap, targetWidth) {
  if (count <= 1) return baseGap;
  return Math.max(baseGap, targetWidth / (count - 1));
}

function distributeFromLeft(start, count, gap) {
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function line(x1, y1, x2, y2, className, options = {}) {
  const stroke = options.stroke ? ` style="stroke: ${options.stroke}"` : "";
  const title = options.title ? `<title>${options.title}</title>` : "";
  const source = options.source ? ` data-source="${escapeXml(options.source)}"` : "";
  const target = options.target ? ` data-target="${escapeXml(options.target)}"` : "";
  const sourceKey = options.sourceKey ? ` data-source-key="${escapeXml(options.sourceKey)}"` : "";
  const targetKey = options.targetKey ? ` data-target-key="${escapeXml(options.targetKey)}"` : "";
  return `<line class="${className}" x1="${trim(x1)}" y1="${trim(y1)}" x2="${trim(x2)}" y2="${trim(y2)}"${source}${target}${sourceKey}${targetKey}${stroke}>${title}</line>`;
}

function switchNode(className, x, y, w, h, text, options = {}) {
  const portCount = 10;
  const portGap = 7;
  const firstPortX = x - w / 2 + 14;
  const device = options.device || text;
  const deviceAttr = device ? ` data-device="${escapeXml(device)}"` : "";
  const deviceKeyAttr = options.deviceKey ? ` data-device-key="${escapeXml(options.deviceKey)}"` : "";
  const ports = Array.from({ length: portCount }, (_, index) => {
    const px = firstPortX + index * portGap;
    return `<rect class="switch-port" x="${px}" y="${y - 4}" width="4" height="5" rx="1"></rect>`;
  }).join("");

  return `
    <g class="node ${className}"${deviceAttr}${deviceKeyAttr}>
      <rect class="switch-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="4"></rect>
      <rect class="switch-face" x="${x - w / 2 + 6}" y="${y - h / 2 + 5}" width="${w - 12}" height="${h - 10}" rx="2"></rect>
      ${ports}
      <circle class="switch-led" cx="${x + w / 2 - 14}" cy="${y - 2}" r="2.4"></circle>
      ${labelBadge(x, y + h / 2 + 14, text)}
    </g>
  `;
}

function serverNode(x, y, w, h, serverNumber, nicCount, label = `Node ${serverNumber}`, options = {}) {
  const device = options.device || label;
  const deviceAttr = device ? ` data-device="${escapeXml(device)}"` : "";
  const deviceKeyAttr = options.deviceKey ? ` data-device-key="${escapeXml(options.deviceKey)}"` : "";
  const ports = Array.from({ length: nicCount }, (_, index) => {
    const portX = nicPortX(x, w, nicCount, index);
    return `<rect class="nic-port" x="${portX - 3}" y="${y - h / 2 + 7}" width="6" height="8" rx="1" style="fill: ${nicColor(index)}">
      <title>NIC ${index + 1}</title>
    </rect>`;
  }).join("");

  return `
    <g class="node server"${deviceAttr}${deviceKeyAttr}>
      <rect class="server-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6"></rect>
      <rect class="server-face" x="${x - w / 2 + 6}" y="${y - h / 2 + 16}" width="${w - 12}" height="${h - 24}" rx="3"></rect>
      <circle class="server-led" cx="${x + w / 2 - 12}" cy="${y + h / 2 - 10}" r="2.5"></circle>
      ${ports}
      ${labelBadge(x, y + h / 2 + 14, label, "server-name")}
    </g>
  `;
}

function ellipsisNode(x, y, w, h, label) {
  return `
    <g class="node ellipsis-node">
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="8"></rect>
      <text x="${x}" y="${y - 2}">...</text>
      ${labelBadge(x, y + h / 2 + 14, label, "ellipsis-label")}
    </g>
  `;
}

function labelBadge(x, y, text, className = "") {
  const label = String(text || "");
  const { width, height } = labelBadgeSize(label);
  const textClass = ["node-label", className].filter(Boolean).join(" ");
  const lines = labelLines(label);
  const visualY = y + (height - 12.5) / 2;
  const textMarkup = lines.length === 1
    ? `<text class="${textClass}" x="${x}" y="${visualY}">${escapeXml(lines[0])}</text>`
    : `<text class="${textClass}" x="${x}" y="${trim(visualY - ((lines.length - 1) * 11) / 2)}">${lines.map((lineText, index) => `<tspan x="${x}"${index === 0 ? "" : ' dy="11"'}>${escapeXml(lineText)}</tspan>`).join("")}</text>`;
  return `
    <rect class="node-label-bg" x="${trim(x - width / 2)}" y="${trim(visualY - height / 2)}" width="${trim(width)}" height="${trim(height)}"></rect>
    ${textMarkup}
  `;
}

function labelBadgeSize(text) {
  const label = String(text || "");
  const estimatedTextWidth = Math.max(...labelLines(label).map(estimateLabelTextWidth));
  const nodeNumberPadding = /^Node\s+\d+$/i.test(label) ? 3 : 0;
  return {
    width: Math.max(18, estimatedTextWidth + 5 + nodeNumberPadding),
    height: labelLines(label).length > 1 ? 12.5 + (labelLines(label).length - 1) * 11 : 12.5,
  };
}

function labelLines(text) {
  const lines = String(text || "").split(/\r?\n/).filter((lineText) => lineText.length > 0);
  return lines.length ? lines : [""];
}

function estimateLabelTextWidth(label) {
  return [...String(label || "")].reduce((width, char) => {
    if (/\s/.test(char)) return width + 3.2;
    if (/[#]/.test(char)) return width + 6.4;
    if (/[0-9]/.test(char)) return width + 5.8;
    if (/[A-Z]/.test(char)) return width + 6.2;
    if (/[a-z]/.test(char)) return width + 5.1;
    if (/[-_/().]/.test(char)) return width + 3.5;
    if (/[^\x00-\x7F]/.test(char)) return width + 9.6;
    return width + 4.8;
  }, 0);
}

function pptLabelBadgeSize(text) {
  const size = labelBadgeSize(text);
  return {
    width: size.width + 2,
    height: size.height + 1,
  };
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
  const colors = typeof NIC_COLORS !== "undefined" ? NIC_COLORS : GEOMETRY_FALLBACK_NIC_COLORS;
  return colors[index % colors.length];
}

function leafColor(index) {
  const colors = typeof LEAF_COLORS !== "undefined" ? LEAF_COLORS : GEOMETRY_FALLBACK_LEAF_COLORS;
  return colors[index % colors.length];
}

if (typeof module !== "undefined") {
  module.exports = {
    getDiagramGeometry,
    getPptDiagramGeometry,
    getSummaryDiagramGeometry,
  };
}
