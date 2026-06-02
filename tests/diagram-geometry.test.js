/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const { getDiagramGeometry, getPptDiagramGeometry } = require("../assets/js/diagram-geometry");

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

console.log("diagram geometry tests passed");
