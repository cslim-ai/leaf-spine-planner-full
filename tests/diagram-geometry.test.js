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

function multiPodGeometry(viewFactory = getDiagramGeometry) {
  const input = {
    serverCount: 32,
    serverNicPorts: 2,
    useMultiPods: true,
    useMultiPlanar: false,
    podServerCount: 16,
  };
  const best = {
    spines: 4,
    leafCount: 8,
    perPodSpines: 2,
    perPodLeafs: 4,
    podCount: 2,
    multiPodCount: 2,
    podServerCount: 16,
    uplinksPerLeaf: 2,
  };
  return viewFactory({ input, best });
}

function multiPodSummaryWithHiddenPod() {
  return getSummaryDiagramGeometry({
    input: {
      serverCount: 96,
      serverNicPorts: 2,
      useMultiPods: true,
      useMultiPlanar: false,
      podServerCount: 16,
    },
    best: {
      spines: 12,
      leafCount: 12,
      perPodSpines: 2,
      perPodLeafs: 2,
      podCount: 6,
      multiPodCount: 6,
      podServerCount: 16,
      uplinksPerLeaf: 2,
    },
  });
}

function multiPlanarPodGeometry(viewFactory = getDiagramGeometry) {
  const input = {
    serverCount: 32,
    serverNicPorts: 2,
    useMultiPods: true,
    useMultiPlanar: true,
    podServerCount: 16,
  };
  const best = {
    spines: 8,
    leafCount: 16,
    perPodSpines: 2,
    perPodLeafs: 4,
    podCount: 4,
    planeCount: 2,
    multiPodCount: 2,
    podServerCount: 16,
    uplinksPerLeaf: 2,
  };
  return viewFactory({ input, best });
}

function multiPlanarGeometry(viewFactory = getDiagramGeometry) {
  const input = {
    serverCount: 16,
    serverNicPorts: 2,
    useMultiPods: false,
    useMultiPlanar: true,
    podServerCount: 16,
  };
  const best = {
    spines: 4,
    leafCount: 8,
    perPodSpines: 2,
    perPodLeafs: 4,
    podCount: 2,
    planeCount: 2,
    podServerCount: 16,
    uplinksPerLeaf: 2,
  };
  return viewFactory({ input, best });
}

function summaryGeometryWithHiddenLeafAndSpine() {
  return getSummaryDiagramGeometry({
    input: {
      serverCount: 64,
      serverNicPorts: 4,
      useMultiPods: false,
      useMultiPlanar: false,
    },
    best: {
      spines: 16,
      leafCount: 16,
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
    .filter((item) => item.label.includes("Spine\nhidden"))
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

function centerGap(left, right) {
  return right.x - left.x;
}

function horizontalGap(left, right) {
  return right.x - left.x;
}

{
  const geometry = fullGeometry(8, 2, 2);
  assert(geometry.servers[0].label === "Node 1", `full geometry node label should not include #: ${geometry.servers[0].label}`);
  assert(geometry.servers[0].device === "Node 1", `full geometry node device should not include #: ${geometry.servers[0].device}`);
  assert(!geometry.lines.some((item) => item.source.includes("Node #")), "full geometry link source should not include #");
}

{
  [getDiagramGeometry, getPptDiagramGeometry, getSummaryDiagramGeometry].forEach((viewFactory) => {
    const geometry = viewFactory({
      input: {
        serverCount: 64,
        serverNicPorts: 4,
        useMultiPods: false,
        useMultiPlanar: false,
      },
      best: {
        spines: 8,
        leafCount: 16,
        uplinksPerLeaf: 4,
        podCount: 2,
        perPodSpines: 4,
        perPodLeafs: 8,
        podServerCount: 64,
      },
    });
    const visibleLabels = [
      ...geometry.switches.map((item) => item.label),
      ...geometry.servers.map((item) => item.label),
      ...(geometry.ellipsis || []).map((item) => item.label),
      ...geometry.lines.flatMap((item) => [item.source, item.target, item.title]),
    ].filter(Boolean);
    assert(!visibleLabels.some((label) => label.includes("Group")), "non-multi diagram labels should not include Group");
  });
}

{
  [getDiagramGeometry, getPptDiagramGeometry, getSummaryDiagramGeometry].forEach((viewFactory) => {
    const geometry = multiPodGeometry(viewFactory);
    assert(geometry.switches.some((item) => item.kind === "spine" && item.label === "Pod 1 - Spine 1"), "multi-pod Spine label should separate Pod and device with hyphen");
    assert(geometry.switches.some((item) => item.kind === "leaf" && item.label === "Pod 1 - Leaf 1"), "multi-pod Leaf label should separate Pod and device with hyphen");
    assert(geometry.servers.some((item) => item.label === "Pod 1 - Node 1"), "multi-pod Node label should include Pod and local Node number");
    assert(geometry.servers.some((item) => item.label === "Pod 2 - Node 1"), "multi-pod Node label should restart numbering per Pod");
    assert(!geometry.servers.some((item) => item.label.includes("#")), "multi-pod Node labels should not include #");
    assert(!geometry.lines.some((item) => item.source.includes("Node #")), "multi-pod link source should not include #");
  });
}

{
  [getDiagramGeometry, getPptDiagramGeometry, getSummaryDiagramGeometry].forEach((viewFactory) => {
    const geometry = multiPlanarPodGeometry(viewFactory);
    assert(geometry.switches.some((item) => item.kind === "spine" && item.label === "Pod 1 - Plane 1\nSpine 1"), "multi-planar pod Spine label should show Pod before Plane on the first line");
    assert(geometry.switches.some((item) => item.kind === "leaf" && item.label === "Pod 1 - Plane 1\nLeaf 1"), "multi-planar pod Leaf label should show Pod before Plane on the first line");
    assert(geometry.servers.some((item) => item.label === "Pod 1 - Node 1"), "multi-planar pod Node label should show Pod only");
    assert(geometry.servers.some((item) => item.label === "Pod 2 - Node 1"), "multi-planar pod Node label should use local node numbering per Pod");
    assert(geometry.lines.some((item) => item.source === "Pod 1 - Node 1"), "multi-planar pod Node link source should show Pod only");
    assert(!geometry.servers.some((item) => item.label.includes("Plane")), "multi-planar pod Node labels should not include Plane");
  });
}

{
  const geometry = getSummaryDiagramGeometry({
    input: {
      serverCount: 96,
      serverNicPorts: 2,
      useMultiPods: true,
      useMultiPlanar: true,
      podServerCount: 16,
    },
    best: {
      spines: 48,
      leafCount: 48,
      perPodSpines: 4,
      perPodLeafs: 4,
      podCount: 12,
      planeCount: 2,
      multiPodCount: 6,
      podServerCount: 16,
      uplinksPerLeaf: 2,
    },
  });
  const hiddenLabels = (geometry.ellipsis || []).map((item) => item.label);
  const spineLabels = geometry.switches.filter((item) => item.kind === "spine").map((item) => item.label);
  const leafLabels = geometry.switches.filter((item) => item.kind === "leaf").map((item) => item.label);
  assert(spineLabels.some((label) => label === "Pod 1 - Plane 1\nSpine 1"), "multi-planar pod summary should show Plane 1 for the first visible Pod");
  assert(spineLabels.some((label) => label === "Pod 1 - Plane 1\nSpine 4"), "multi-planar pod summary should show the last Spine in Plane 1 for the first visible Pod");
  assert(spineLabels.some((label) => label === "Pod 1 - Plane 2\nSpine 1"), "multi-planar pod summary should show Plane 2 for the first visible Pod");
  assert(spineLabels.some((label) => label === "Pod 1 - Plane 2\nSpine 4"), "multi-planar pod summary should show the last Spine in Plane 2 for the first visible Pod");
  assert(spineLabels.some((label) => label === "Pod 6 - Plane 1\nSpine 1"), "multi-planar pod summary should show Plane 1 for the last visible Pod");
  assert(spineLabels.some((label) => label === "Pod 6 - Plane 2\nSpine 1"), "multi-planar pod summary should show Plane 2 for the last visible Pod");
  assert(leafLabels.some((label) => label === "Pod 1 - Plane 1\nLeaf 1"), "multi-planar pod summary should show the first Leaf in Plane 1 for the first visible Pod");
  assert(leafLabels.some((label) => label === "Pod 1 - Plane 1\nLeaf 4"), "multi-planar pod summary should show the last Leaf in Plane 1 for the first visible Pod");
  assert(leafLabels.some((label) => label === "Pod 1 - Plane 2\nLeaf 1"), "multi-planar pod summary should show the first Leaf in Plane 2 for the first visible Pod");
  assert(leafLabels.some((label) => label === "Pod 1 - Plane 2\nLeaf 4"), "multi-planar pod summary should show the last Leaf in Plane 2 for the first visible Pod");
  assert(!spineLabels.some((label) => label.includes("Pod 3")), "multi-planar pod summary should hide middle Pods instead of mixing Plane/Pod groups");
  assert(!hiddenLabels.some((label) => label.includes("Group")), "multi-planar pod hidden labels should not include Group");
  assert(hiddenLabels.some((label) => label.includes("Pod\nhidden")), "multi-planar pod hidden fabric labels should describe hidden Pods instead of Plane/Pod groups");
  assert(hiddenLabels.some((label) => label.includes("Pod 1 - Plane 1\n2 Spine\nhidden")), "multi-planar pod summary should place Plane hidden counts on their own line");
  assert(hiddenLabels.some((label) => label.includes("Pod 1 - Plane 2\n2 Leaf\nhidden")), "multi-planar pod summary should place Plane hidden Leaf counts on their own line");
  assert(hiddenLabels.some((label) => label.includes("Pod 1 - 10 Node\nhidden")), "multi-planar pod hidden Node labels should use the actual Pod label");
  assert(!hiddenLabels.some((label) => label.includes("Plane 2 - Pod 3")), "multi-planar pod hidden labels should not interpret actual Pod indexes as fabric group indexes");
  assert(hiddenLabels.every((label) => !label.includes(" hidden")), "hidden badge labels should wrap hidden onto the next line");
}

{
  const geometry = getSummaryDiagramGeometry({
    input: {
      serverCount: 96,
      serverNicPorts: 2,
      useMultiPods: true,
      useMultiPlanar: true,
      podServerCount: 16,
    },
    best: {
      spines: 48,
      leafCount: 48,
      perPodSpines: 4,
      perPodLeafs: 4,
      podCount: 12,
      planeCount: 2,
      multiPodCount: 6,
      podServerCount: 16,
      uplinksPerLeaf: 4,
    },
  });
  const visibleLeafUplinks = geometry.lines.filter((line) => line.kind === "uplink" && line.sourceKey === "leaf-0");
  assert(visibleLeafUplinks.length === 2, `summary visible Leaf should only draw visible Spine uplinks: ${visibleLeafUplinks.length}`);
  assert(countUplinksFromLeafToSpineEllipsis(geometry, 0) === 0, `summary visible Leaf should not draw uplinks to hidden Spine entries: ${countUplinksFromLeafToSpineEllipsis(geometry, 0)}`);
}

{
  const geometry = multiPlanarPodGeometry(getSummaryDiagramGeometry);
  const spines = geometry.switches.filter((item) => item.kind === "spine").sort((left, right) => left.x - right.x);
  const samePlaneGap = centerGap(spines[0], spines[1]);
  const pod1PlaneGap = centerGap(spines[1], spines[2]);
  const podBoundaryGap = centerGap(spines[3], spines[4]);
  assert(pod1PlaneGap >= samePlaneGap + 16, `summary Plane boundary gap should be slightly wider than same-Plane gap: same ${samePlaneGap}, plane ${pod1PlaneGap}`);
  assert(podBoundaryGap >= pod1PlaneGap + 24, `summary Pod boundary gap should be wider than Plane boundary gap: plane ${pod1PlaneGap}, boundary ${podBoundaryGap}`);
}

{
  const geometry = summaryGeometryWithHiddenLeafAndSpine();
  assert(geometry.ellipsis.some((item) => item.label.includes("Spine\nhidden")), "regular summary geometry should hide middle Spines");
  assert(geometry.ellipsis.some((item) => item.label.includes("Leaf\nhidden")), "regular summary geometry should hide middle Leafs");
  assert(countUplinksFromHiddenLeafToHiddenSpine(geometry) === 0, `regular summary geometry should not draw hidden Leaf to hidden Spine uplinks: ${countUplinksFromHiddenLeafToHiddenSpine(geometry)}`);
}

{
  const geometry = multiPlanarGeometry(getSummaryDiagramGeometry);
  const spines = geometry.switches.filter((item) => item.kind === "spine").sort((left, right) => left.x - right.x);
  const samePlaneGap = centerGap(spines[0], spines[1]);
  const planeBoundaryGap = centerGap(spines[1], spines[2]);
  assert(planeBoundaryGap >= samePlaneGap + 16, `summary multi-planar Plane boundary gap should be wider than same-Plane gap: same ${samePlaneGap}, plane ${planeBoundaryGap}`);
}

{
  const hiddenGeometry = multiPodSummaryWithHiddenPod();
  const hiddenSpineBadge = hiddenGeometry.ellipsis.find((item) => item.label.includes("Pod\nhidden") && item.y < 100);
  const hiddenSpines = hiddenGeometry.switches.filter((item) => item.kind === "spine").sort((left, right) => left.x - right.x);
  const samePodGap = horizontalGap(hiddenSpines[0], hiddenSpines[1]);
  const hiddenPodGap = horizontalGap(hiddenSpines[1], hiddenSpineBadge);

  const visibleGeometry = multiPodGeometry(getSummaryDiagramGeometry);
  const visibleSpines = visibleGeometry.switches.filter((item) => item.kind === "spine").sort((left, right) => left.x - right.x);
  const visiblePodBoundaryGap = horizontalGap(visibleSpines[1], visibleSpines[2]);

  assert(hiddenPodGap >= samePodGap + 16, `summary hidden Pod gap should still separate from same-Pod devices: same ${samePodGap}, hidden ${hiddenPodGap}`);
  assert(hiddenPodGap <= visiblePodBoundaryGap - 16, `summary hidden Pod gap should be narrower than visible Pod boundary gap: hidden ${hiddenPodGap}, visible ${visiblePodBoundaryGap}`);
}

{
  [getDiagramGeometry, getPptDiagramGeometry, getSummaryDiagramGeometry].forEach((viewFactory) => {
    const geometry = multiPlanarGeometry(viewFactory);
    assert(geometry.switches.some((item) => item.kind === "spine" && item.label === "Plane 1 - Spine 1"), "multi-planar Spine label should keep Plane and device on one line");
    assert(geometry.switches.some((item) => item.kind === "leaf" && item.label === "Plane 1 - Leaf 1"), "multi-planar Leaf label should keep Plane and device on one line");
    assert(geometry.servers.some((item) => item.label === "Node 1"), "multi-planar Node label should not include Plane");
    assert(geometry.lines.some((item) => item.source === "Node 1"), "multi-planar Node link source should not include Plane");
    assert(!geometry.servers.some((item) => item.label.includes("Plane")), "multi-planar Node labels should not include Plane");
    assert(!geometry.switches.some((item) => item.label.includes("\n")), "multi-planar switch labels should not wrap when only Plane is enabled");
  });
}

{
  [fullGeometry(8, 2, 2), fullGeometry(64, 16, 8)].forEach((geometry) => {
    const margins = horizontalMargins(geometry);
    assert(margins.left <= 1, `geometry left margin should be removed: ${margins.left}`);
    assert(margins.right <= 1, `geometry right margin should be removed: ${margins.right}`);
  });
}

{
  const targetRatio = 0.25;
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
  const visibleLeafUplinks = summary.lines.filter((line) => line.kind === "uplink" && line.sourceKey === "leaf-0");
  assert(summary.ellipsis.some((item) => item.label.includes("Spine\nhidden")), "summary geometry should keep Spine hidden entries");
  assert(!summary.ellipsis.some((item) => item.label.includes("links per Leaf")), "summary hidden Spine label should stay compact");
  assert(countUplinksTouchingEllipsis(summary) === 0, `summary geometry should not show leaf-spine uplinks to hidden ellipsis entries: ${countUplinksTouchingEllipsis(summary)}`);
  assert(visibleLeafUplinks.length === 16, `visible Leaf should only draw visible Spine uplinks: ${visibleLeafUplinks.length}`);
  assert(countUplinksFromLeafToSpineEllipsis(summary, 0) === 0, `visible Leaf should not draw uplinks to hidden Spine entries: ${countUplinksFromLeafToSpineEllipsis(summary, 0)}`);
  assert(countUplinksFromHiddenLeafToVisibleSpine(summary) === 0, `summary geometry should not draw uplinks from hidden Leaf entries to visible Spines: ${countUplinksFromHiddenLeafToVisibleSpine(summary)}`);
  assert(countUplinksFromHiddenLeafToHiddenSpine(summary) === 0, `summary geometry should not draw hidden Leaf to hidden Spine uplinks: ${countUplinksFromHiddenLeafToHiddenSpine(summary)}`);
}

console.log("diagram geometry tests passed");
