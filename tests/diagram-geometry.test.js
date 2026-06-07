/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const calculator = require("../assets/js/calculator");
const { getDiagramGeometry, getPptDiagramGeometry, getSummaryDiagramGeometry } = require("../assets/js/diagram-geometry");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowGaps(geometry) {
  const spineY = geometry.switches.find((item) => item.kind === "spine").y;
  const leafY = geometry.switches.find((item) => item.kind === "leaf").y;
  const nodeY = geometry.servers[0].y;
  return {
    spineLeafGap: leafY - spineY,
    leafNodeGap: nodeY - leafY,
  };
}

function fullGeometry(serverCount, leafCount, spines) {
  return getDiagramGeometry({
    input: {
      serverCount,
      serverNicPorts: 4,
      useMultiPods: false,
    },
    best: {
      spines,
      leafCount,
      uplinksPerLeaf: 4,
    },
  });
}

function wrappedGeometry(serverCount, leafCount, spines, serverNicPorts = 4) {
  return getPptDiagramGeometry({
    input: {
      serverCount,
      serverNicPorts,
      useMultiPods: false,
    },
    best: {
      spines,
      leafCount,
      uplinksPerLeaf: 4,
    },
  });
}

function assertRatioNear(geometry, targetRatio, label) {
  const ratio = geometry.height / geometry.width;
  const lower = targetRatio - 0.015;
  const upper = targetRatio + 0.015;
  assert(ratio >= lower && ratio <= upper, `${label} ratio should stay near ${targetRatio}: ${ratio}`);
}

function horizontalMargins(geometry) {
  const xs = [];
  const take = (value) => Number.isFinite(value) && xs.push(value);
  geometry.switches.forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
  });
  geometry.servers.forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
    (item.ports || []).forEach((port) => take(port.x));
  });
  geometry.lines.forEach((item) => {
    take(item.x1);
    take(item.x2);
  });
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return {
    left: minX,
    right: geometry.width - maxX,
  };
}

function rowCount(items) {
  return new Set(items.map((item) => Math.round(item.y))).size;
}

function countUplinksTouchingEllipsis(geometry) {
  const ellipsisBounds = (geometry.ellipsis || []).map((item) => ({
    left: item.x - item.w / 2,
    right: item.x + item.w / 2,
    top: item.y - item.h / 2,
    bottom: item.y + item.h / 2,
  }));
  return geometry.lines.filter((line) => {
    if (line.kind !== "uplink") return false;
    return ellipsisBounds.some((bounds) => (
      (line.x1 >= bounds.left && line.x1 <= bounds.right && line.y1 >= bounds.top && line.y1 <= bounds.bottom)
        || (line.x2 >= bounds.left && line.x2 <= bounds.right && line.y2 >= bounds.top && line.y2 <= bounds.bottom)
    ));
  }).length;
}

function countUplinksFromLeafToSpineEllipsis(geometry, leafIndex = 0) {
  const spineEllipsisBounds = (geometry.ellipsis || [])
    .filter((item) => item.label.includes("Spine hidden"))
    .map((item) => ({
      left: item.x - item.w / 2,
      right: item.x + item.w / 2,
      top: item.y - item.h / 2,
      bottom: item.y + item.h / 2,
    }));
  return geometry.lines.filter((line) => {
    if (line.kind !== "uplink" || line.sourceKey !== `leaf-${leafIndex}`) return false;
    return spineEllipsisBounds.some((bounds) => (
      line.x2 >= bounds.left && line.x2 <= bounds.right && line.y2 >= bounds.top && line.y2 <= bounds.bottom
    ));
  }).length;
}

function countUplinksFromHiddenLeafToVisibleSpine(geometry) {
  const visibleSpineKeys = new Set(geometry.switches.filter((item) => item.kind === "spine").map((item) => item.deviceKey));
  return geometry.lines.filter((line) => line.kind === "uplink" && !line.sourceKey && visibleSpineKeys.has(line.targetKey)).length;
}

function countUplinksFromHiddenLeafToHiddenSpine(geometry) {
  return geometry.lines.filter((line) => line.kind === "uplink" && !line.sourceKey && !line.targetKey).length;
}

{
  [fullGeometry(8, 2, 2), fullGeometry(64, 16, 8)].forEach((geometry) => {
    const margins = horizontalMargins(geometry);
    assert(margins.left <= 1, `geometry left margin should be removed: ${margins.left}`);
    assert(margins.right <= 1, `geometry right margin should be removed: ${margins.right}`);
  });
}

{
  const targetRatio = 0.325;
  assertRatioNear(fullGeometry(32, 8, 4), targetRatio, "32-node full geometry");
  assertRatioNear(fullGeometry(64, 16, 8), targetRatio, "64-node full geometry");
  assertRatioNear(fullGeometry(128, 32, 16), targetRatio, "128-node full geometry");
  assertRatioNear(fullGeometry(256, 64, 32), targetRatio, "256-node full geometry");
}

{
  [fullGeometry(2, 2, 2), fullGeometry(8, 2, 2), fullGeometry(16, 8, 4)].forEach((geometry) => {
    const gaps = rowGaps(geometry);
    assert(gaps.spineLeafGap >= 132, `small full geometry spine-leaf gap should not collapse: ${gaps.spineLeafGap}`);
    assert(gaps.leafNodeGap >= 170, `small full geometry leaf-node gap should not collapse: ${gaps.leafNodeGap}`);
  });
}

{
  const geometry64 = fullGeometry(64, 16, 8);
  const geometry128 = fullGeometry(128, 32, 16);
  const geometry256 = fullGeometry(256, 64, 32);
  const ratio64 = geometry64.height / geometry64.width;
  const ratio128 = geometry128.height / geometry128.width;
  const ratio256 = geometry256.height / geometry256.width;

  assert(ratio128 >= ratio64 * 0.95, `128-node height/width ratio should stay proportional: 64 ${ratio64}, 128 ${ratio128}`);
  assert(ratio256 >= ratio128 * 0.95, `256-node height/width ratio should stay proportional: 128 ${ratio128}, 256 ${ratio256}`);
}

{
  const geometry64 = wrappedGeometry(64, 64, 64);
  assert(rowCount(geometry64.servers) === 4, `wrapped 64 nodes should use 16 nodes per row: ${rowCount(geometry64.servers)}`);
  assert(rowCount(geometry64.switches.filter((item) => item.kind === "leaf")) === 7, "wrapped 64 leafs should use 10 leafs per row");
  assert(rowCount(geometry64.switches.filter((item) => item.kind === "spine")) === 8, "wrapped 64 spines should use 8 spines per row");
}

{
  const result = calculator.calculate({
    serverCount: 512,
    serverNicPorts: 8,
    serverLinkSpeed: 800,
    useCustomSwitchCounts: false,
    customLeafCount: 2,
    customSpineCount: 2,
    switchPorts: 64,
    leafSwitchPorts: 64,
    leafMinSparePorts: 0,
    switchLinkSpeed: 800,
    leafSwitchLinkSpeed: 800,
    useTwinPort: true,
    disableUplinkTwinPort: false,
    spineSameAsLeaf: true,
    spineSwitchPorts: 64,
    spineSwitchLinkSpeed: 800,
    spineUseTwinPort: false,
    mode: "nonblocking",
    targetOversub: 3,
    useMultiPlanar: true,
    useMultiPods: true,
    podServerCount: 64,
  });
  assert(result.feasible, "512-node multi-planar multi-pod twin-port input should be feasible");
  assert(result.best.perPodSpines === 8, `test fixture should produce 8 spines per fabric group: ${result.best.perPodSpines}`);
  const summary = getSummaryDiagramGeometry(result);
  assert(summary.ellipsis.some((item) => item.label.includes("Spine hidden")), "summary geometry should keep Spine hidden entries");
  assert(!summary.ellipsis.some((item) => item.label.includes("links per Leaf")), "summary hidden Spine label should stay compact");
  assert(countUplinksTouchingEllipsis(summary) > 0, "summary geometry should show leaf-spine uplinks to hidden ellipsis entries");
  assert(countUplinksFromLeafToSpineEllipsis(summary, 0) === 8, `visible Leaf should draw one hidden Spine representative worth of uplinks: ${countUplinksFromLeafToSpineEllipsis(summary, 0)}`);
  assert(countUplinksFromHiddenLeafToVisibleSpine(summary) > 0, "summary geometry should draw uplinks from hidden Leaf ellipsis entries to visible Spines");
  assert(countUplinksFromHiddenLeafToHiddenSpine(summary) === 0, "summary geometry should not draw hidden Leaf to hidden Spine uplinks");
}

console.log("diagram geometry tests passed");
