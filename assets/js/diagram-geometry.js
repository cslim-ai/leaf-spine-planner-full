/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Diagram geometry and shared SVG node helpers.

function diagramGeometryForView(result, viewMode) {
  if (viewMode === "wrapped") return getPptDiagramGeometry(result);
  if (viewMode === "summary") return getSummaryDiagramGeometry(result);
  return getDiagramGeometry(result);
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
  const lines = [];
  const switches = [];
  const servers = [];

  spineXs.forEach((x, index) => {
    const label = podCount > 1 ? `${fabricGroupLabel(Math.floor(index / perPodSpines), input, best)} Spine ${(index % perPodSpines) + 1}` : `Spine ${index + 1}`;
    switches.push({ kind: "spine", x, y: spineY, w: switchW, h: switchH, label, device: label, deviceKey: `spine-${index}` });
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
          source: podCount > 1 ? `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`,
          target: podCount > 1 ? `${fabricGroupLabel(Math.floor((spineStart + localSpineIndex) / perPodSpines), input, best)} Spine ${((spineStart + localSpineIndex) % perPodSpines) + 1}` : `Spine ${spineStart + localSpineIndex + 1}`,
          sourceKey: `leaf-${leafIndex}`,
          targetKey: `spine-${spineStart + localSpineIndex}`,
        });
      }
    });
    const label = podCount > 1 ? `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`;
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
          source: `Node #${serverIndex + 1}`,
          target: podCount > 1 ? `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`,
          sourceKey: `node-${serverIndex}`,
          targetKey: `leaf-${leafIndex}`,
        });
      });
    }
    servers.push({ x: serverX, y: serverY, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label: `Node #${serverIndex + 1}`, device: `Node #${serverIndex + 1}`, deviceKey: `node-${serverIndex}`, ports });
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
    const label = podCount > 1 ? `${fabricGroupLabel(index, input, best)} Spine ${(index % perPodSpines) + 1}` : `Spine ${index + 1}`;
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label, device: label, deviceKey: `spine-${index}` });
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
          source: podCount > 1 ? `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`,
          target: podCount > 1 ? `${fabricGroupLabel(Math.floor((spineStart + localSpineIndex) / perPodSpines), input, best)} Spine ${((spineStart + localSpineIndex) % perPodSpines) + 1}` : `Spine ${spineStart + localSpineIndex + 1}`,
          sourceKey: `leaf-${leafIndex}`,
          targetKey: `spine-${spineStart + localSpineIndex}`,
        });
      }
    });
    const label = podCount > 1 ? `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`;
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
          source: `Node #${serverIndex + 1}`,
          target: podCount > 1 ? `${fabricGroupLabel(Math.floor(leafIndex / perPodLeafs), input, best)} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`,
          sourceKey: `node-${serverIndex}`,
          targetKey: `leaf-${leafIndex}`,
        });
      });
    }
    servers.push({ x: serverPosition.x, y: serverPosition.y, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label: `Node #${serverIndex + 1}`, device: `Node #${serverIndex + 1}`, deviceKey: `node-${serverIndex}`, ports });
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
    const label = podCount > 1 ? `${fabricGroupLabel(Math.floor(entry.index / perPodSpines), input, best)} Spine ${(entry.index % perPodSpines) + 1}` : `Spine ${entry.index + 1}`;
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label, device: label, deviceKey: `spine-${entry.index}` });
  });

  leafEntries.forEach((entry) => {
    const position = leafPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Leaf") });
      return;
    }
    const label = podCount > 1 ? `${fabricGroupLabel(Math.floor(entry.index / perPodLeafs), input, best)} Leaf ${(entry.index % perPodLeafs) + 1}` : `Leaf ${entry.index + 1}`;
    switches.push({ kind: "leaf", x: position.x, y: position.y, w: switchW, h: switchH, label, device: label, deviceKey: `leaf-${entry.index}` });
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
          source: leafEntry.type === "node" ? (podCount > 1 ? `${fabricGroupLabel(Math.floor(leafEntry.index / perPodLeafs), input, best)} Leaf ${(leafEntry.index % perPodLeafs) + 1}` : `Leaf ${leafEntry.index + 1}`) : "",
          target: spineEntry.type === "node" ? (podCount > 1 ? `${fabricGroupLabel(Math.floor(spineEntry.index / perPodSpines), input, best)} Spine ${(spineEntry.index % perPodSpines) + 1}` : `Spine ${spineEntry.index + 1}`) : "",
          sourceKey: `leaf-${leafEntry.index}`,
          targetKey: `spine-${spineEntry.index}`,
        });
      }
    });
  });

  serverEntries.forEach((entry) => {
    const position = serverPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: 78, h: 42, label: summaryHiddenLabel(entry, "Node") });
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
          source: `Node #${entry.index + 1}`,
          target: linkLeafEntry.type === "node"
            ? (podCount > 1 ? `${fabricGroupLabel(Math.floor(linkLeafEntry.index / perPodLeafs), input, best)} Leaf ${(linkLeafEntry.index % perPodLeafs) + 1}` : `Leaf ${linkLeafEntry.index + 1}`)
            : "",
          sourceKey: `node-${entry.index}`,
          targetKey: linkLeafEntry.type === "node" ? `leaf-${linkLeafEntry.index}` : "",
        });
      });
    }
    servers.push({ x: position.x, y: position.y, w: serverW, h: serverH, number: entry.index + 1, nicCount: input.serverNicPorts, label: `Node #${entry.index + 1}`, device: `Node #${entry.index + 1}`, deviceKey: `node-${entry.index}`, ports });
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
    return `${entry.hiddenPodCount} Groups hidden`;
  }
  const podPrefix = entry.podIndex === undefined ? "" : `Group ${entry.podIndex + 1} `;
  return `${podPrefix}${entry.hiddenCount} ${label} hidden`;
}

function fabricGroupLabel(groupIndex, input, best) {
  const planeCount = best.planeCount || (input.useMultiPlanar ? 2 : 1);
  if (input.useMultiPods && input.useMultiPlanar) {
    return `Pod ${Math.floor(groupIndex / planeCount) + 1} Plane ${(groupIndex % planeCount) + 1}`;
  }
  if (input.useMultiPods) return `Pod ${groupIndex + 1}`;
  if (input.useMultiPlanar) return `Plane ${groupIndex + 1}`;
  return "";
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

function serverNode(x, y, w, h, serverNumber, nicCount, label = `Node #${serverNumber}`, options = {}) {
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
  return `
    <rect class="node-label-bg" x="${trim(x - width / 2)}" y="${trim(y - height / 2)}" width="${trim(width)}" height="${height}"></rect>
    <text class="${textClass}" x="${x}" y="${y}">${escapeXml(label)}</text>
  `;
}

function labelBadgeSize(text) {
  const label = String(text || "");
  const estimatedTextWidth = [...label].reduce((width, char) => {
    if (/\s/.test(char)) return width + 3.2;
    if (/[#]/.test(char)) return width + 6.4;
    if (/[0-9]/.test(char)) return width + 5.8;
    if (/[A-Z]/.test(char)) return width + 6.2;
    if (/[a-z]/.test(char)) return width + 5.1;
    if (/[-_/().]/.test(char)) return width + 3.5;
    if (/[^\x00-\x7F]/.test(char)) return width + 9.6;
    return width + 4.8;
  }, 0);
  const nodeNumberPadding = /^Node\s+#\d+$/i.test(label) ? 3 : 0;
  return {
    width: Math.max(18, estimatedTextWidth + 5 + nodeNumberPadding),
    height: 12.5,
  };
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
  return NIC_COLORS[index % NIC_COLORS.length];
}

function leafColor(index) {
  return LEAF_COLORS[index % LEAF_COLORS.length];
}
