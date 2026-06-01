/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const {
  calculate,
  effectiveSwitchLinkSpeed,
  leafSpineLeafTwinFactor,
  leafSpineTwinFactor,
} = require("../assets/js/calculator");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertNoGarbledKorean(text, message) {
  const garbledFragments = ["媛", "몃", "뱶", "쒖", "꾩", "遺", "臾", "蹂", "섎", "낅", "덈"];
  const found = garbledFragments.find((fragment) => text.includes(fragment));
  if (found) {
    throw new Error(`${message}: found ${found} in ${text}`);
  }
}

const baseInput = {
  serverCount: 8,
  serverNicPorts: 8,
  serverLinkSpeed: 400,
  switchPorts: 64,
  switchLinkSpeed: 400,
  useTwinPort: false,
  disableUplinkTwinPort: false,
  mode: "nonblocking",
  targetOversub: 3,
  useMultiPlanar: false,
  useMultiPods: false,
  podServerCount: 64,
};

function withInput(overrides) {
  return { ...baseInput, ...overrides };
}

{
  const result = calculate(baseInput);
  assert(result.feasible, "default input should be feasible");
  assert(result.best.leafCount >= 2, "leaf count should keep HA minimum");
  assert(result.best.spines >= 2, "spine count should keep HA minimum");
}

{
  const baseline = calculate(withInput({ leafMinSparePorts: 0 }));
  const reserved = calculate(withInput({ leafMinSparePorts: 8 }));
  assert(baseline.feasible && reserved.feasible, "leaf spare port reservation inputs should be feasible");
  assertEqual(baseline.best.leafCount, 2, "zero leaf spare port reservation should preserve the existing default leaf count");
  assert(reserved.best.unusedPortsPerLeaf >= 8, "leaf spare port reservation should leave the requested physical spare ports per leaf");
  assert(reserved.best.leafCount > baseline.best.leafCount, "leaf spare port reservation should increase leaf count when the default fabric has no spare leaf ports");
}

{
  const result = calculate(withInput({
    useCustomSwitchCounts: true,
    customLeafCount: 2,
    customSpineCount: 2,
    leafMinSparePorts: 8,
  }));
  assert(!result.feasible, "custom leaf count should be infeasible when requested leaf spare ports cannot be preserved");
  assert(result.infeasibleReason.includes("Leaf"), "leaf spare port infeasible reason should identify leaf constraints");
  assert(result.infeasibleReason.includes("요청한 Leaf당 예비 포트 8개"), "leaf spare port infeasible reason should include the requested spare port count");
  assertNoGarbledKorean(result.infeasibleReason, "leaf spare port infeasible reason should not contain garbled Korean");
}

{
  const input = withInput({
    useCustomSwitchCounts: true,
    customLeafCount: 4,
    customSpineCount: 2,
  });
  const result = calculate(input);
  assert(result.feasible, "custom leaf/spine count should be validated as feasible when constraints fit");
  assertEqual(result.best.leafCount, 4, "custom leaf count should be used exactly");
  assertEqual(result.best.spines, 2, "custom spine count should be used exactly");
}

{
  const input = withInput({
    useCustomSwitchCounts: true,
    customLeafCount: 2,
    customSpineCount: 40,
  });
  const result = calculate(input);
  assert(!result.feasible, "custom spine count should be infeasible when leaf uplinks cannot full-mesh to all spines");
  assert(result.infeasibleReason.includes("Spine"), "custom infeasible reason should identify spine constraints");
  assertNoGarbledKorean(result.infeasibleReason, "custom spine infeasible reason should not contain garbled Korean");
}

{
  const input = withInput({
    serverCount: 72,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    spineUseTwinPort: true,
  });
  const result = calculate(input);
  assert(result.feasible, "72-server 800G twin-port input should be feasible");
  assertEqual(result.best.leafCount, 8, "leaf count should account for server and uplink logical ports");
  assertEqual(result.best.uplinksPerLeaf, 72, "non-blocking uplinks should match leaf downlink bandwidth");
  assertEqual(result.best.usedPortsPerLeaf, 72, "leaf physical ports should be fully used with twin-port");
}

{
  const baseline = calculate(withInput({
    serverCount: 72,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    spineUseTwinPort: true,
  }));
  const input = withInput({
    serverCount: 72,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    spineSwitchPorts: 72,
    spineSwitchLinkSpeed: 1600,
    spineUseTwinPort: true,
  });
  const result = calculate(input);
  assert(result.feasible, "separate leaf/spine input should remain feasible when specs match");
  assertEqual(result.best.leafCount, baseline.best.leafCount, "matching spine specs should preserve leaf count");
  assertEqual(result.best.spines, baseline.best.spines, "matching spine specs should preserve spine count");
  assertEqual(result.best.spineSwitchPortCapacity, 72, "spine port capacity should be tracked separately");
}

{
  const input = withInput({
    serverCount: 72,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    spineSwitchPorts: 36,
    spineSwitchLinkSpeed: 800,
    spineUseTwinPort: false,
  });
  const result = calculate(input);
  assert(result.feasible, "smaller spine switches should still be evaluated with separate capacity");
  assert(result.best.spines > 8, "smaller spine port capacity should require more spine switches");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "leaf-spine link speed should use the slower leaf/spine side");
}

{
  const input = withInput({
    serverCount: 256,
    serverLinkSpeed: 400,
    switchPorts: 64,
    switchLinkSpeed: 400,
  });
  const result = calculate(input);
  assert(result.feasible, "64-port 2-tier non-blocking fabric should support 256 servers at 8 NICs");
  assertEqual(result.best.leafCount, 64, "256-server 64-port fabric should use 64 leaf switches");
  assertEqual(result.best.spines, 32, "256-server 64-port fabric should use 32 spine switches");
  assertEqual(result.best.oversubscription, 1, "256-server 64-port fabric should remain 1:1");
}

{
  const input = withInput({
    serverCount: 512,
    serverLinkSpeed: 400,
    switchPorts: 64,
    switchLinkSpeed: 400,
  });
  const result = calculate(input);
  assert(!result.feasible, "64-port 2-tier non-blocking fabric should not support 512 servers");
  assert(result.infeasibleReason.includes("Leaf"), "512-server infeasible reason should point to leaf capacity");
  assert(result.infeasibleReason.includes("64"), "512-server infeasible reason should include switch port context");
}

{
  const input = withInput({
    serverCount: 288,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
  });
  const result = calculate(input);
  assert(result.feasible, "288-server rail-balanced input should be feasible");
  assertEqual(result.best.leafCount, 32, "leaf count should fit 288 servers with 8 NICs");
  assertEqual(result.best.spines, 36, "spine count should prefer evenly distributed leaf-spine links with leaf-side twin-port uplinks");
  assertEqual(result.best.uplinksPerLeaf % result.best.spines, 0, "leaf-spine links should be balanced");
}

{
  const input = withInput({
    serverCount: 1296,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    disableUplinkTwinPort: true,
  });
  const result = calculate(input);
  assert(!result.feasible, "1296-server input without uplink twin-port should be infeasible");
  assert(result.infeasibleReason, "infeasible result should include a reason");
  assert(/\d/.test(result.infeasibleReason), "infeasible reason should include numeric capacity context");
  assert(
    result.infeasibleReason.includes("Leaf") || result.infeasibleReason.includes("Spine"),
    "infeasible reason should identify the constrained layer",
  );
}

{
  const input = withInput({
    serverCount: 1296,
    serverLinkSpeed: 800,
    switchPorts: 144,
    switchLinkSpeed: 1600,
    useTwinPort: true,
  });
  const result = calculate(input);
  assert(result.feasible, "144-port twin-port non-blocking fabric should support 1296 servers");
  assertEqual(result.best.leafCount, 72, "1296-server 144-port fabric should use 72 leaf switches");
  assertEqual(result.best.spines, 72, "1296-server 144-port fabric should use 72 spine switches with leaf-side twin-port uplinks");
  assertEqual(result.best.oversubscription, 1, "1296-server fabric should remain 1:1");
}

{
  const nonBlocking = calculate(withInput({
    serverCount: 64,
    serverLinkSpeed: 400,
    switchPorts: 64,
    switchLinkSpeed: 400,
    mode: "nonblocking",
  }));
  const oversubscribed = calculate(withInput({
    serverCount: 64,
    serverLinkSpeed: 400,
    switchPorts: 64,
    switchLinkSpeed: 400,
    mode: "oversubscribed",
    targetOversub: 3,
  }));
  assert(nonBlocking.feasible && oversubscribed.feasible, "comparison inputs should both be feasible");
  assertEqual(oversubscribed.totalServerLinks, nonBlocking.totalServerLinks, "oversubscription should not drop server NIC links");
  assertEqual(
    oversubscribed.best.serverDownlinksPerLeaf,
    nonBlocking.best.serverDownlinksPerLeaf,
    "oversubscription should not change server downlinks per leaf",
  );
  assert(
    oversubscribed.best.totalLeafUplinks <= nonBlocking.best.totalLeafUplinks,
    "oversubscription should not require more total leaf-spine uplinks than non-blocking",
  );
}

{
  const input = withInput({
    serverCount: 32,
    serverLinkSpeed: 800,
    switchPorts: 64,
    switchLinkSpeed: 800,
    useTwinPort: false,
    spineUseTwinPort: false,
    useMultiPlanar: true,
  });
  const result = calculate(input);
  assert(result.feasible, "multi-planar input should be feasible per plane");
  assertEqual(result.input.useNodeTwinPort, true, "multi-planar should force node-side twin-port usage");
  assertEqual(result.input.useTwinPort, false, "multi-planar should not force leaf twin-port usage");
  assertEqual(result.best.podCount, 2, "multi-planar should use two independent planes");
  assertEqual(result.best.perPodLeafs, 8, "per-plane leaf count should not get leaf port savings from node-side twin-port");
  assertEqual(result.best.perPodSpines, 2, "per-plane spine count should reflect unsplit leaf-spine links");
  assertEqual(result.best.leafCount, 16, "total leaf count should be plane count times per-plane leafs");
  assertEqual(result.best.spines, 4, "total spine count should be plane count times per-plane spines");
}

{
  const input = withInput({
    serverCount: 32,
    serverLinkSpeed: 800,
    switchPorts: 64,
    switchLinkSpeed: 800,
    useTwinPort: true,
    spineUseTwinPort: false,
    useMultiPlanar: true,
  });
  const result = calculate(input);
  assert(result.feasible, "multi-planar input should account for leaf-side twin-port when enabled");
  assertEqual(result.best.perPodLeafs, 4, "leaf twin-port should halve leaf-side physical downlink port pressure per plane");
  assertEqual(result.best.leafCount, 8, "total leaf count should reflect leaf-side twin-port savings");
  assertEqual(result.best.physicalDownlinkPorts, 32, "leaf physical downlink ports should be halved only when leaf twin-port is enabled");
}

{
  const input = withInput({
    serverCount: 576,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    spineUseTwinPort: false,
    useMultiPlanar: true,
  });
  const result = calculate(input);
  assert(result.feasible, "larger multi-planar input should be feasible per plane");
  assertEqual(result.best.podCount, 2, "multi-planar should remain two planes");
  assertEqual(result.best.perPodLeafs, 48, "per-plane leaf count should scale with the full server set");
  assertEqual(result.best.perPodSpines, 48, "per-plane spine count should scale with leaf-side twin-port leaf-spine links");
  assertEqual(result.best.leafCount, 96, "total leaf count should be plane count times per-plane leafs");
  assertEqual(result.best.spines, 96, "total spine count should be plane count times per-plane spines");
}

{
  const input = withInput({
    serverCount: 128,
    serverLinkSpeed: 400,
    switchPorts: 64,
    switchLinkSpeed: 400,
    useMultiPods: true,
    podServerCount: 64,
  });
  const result = calculate(input);
  assert(result.feasible, "multi-pods input should be feasible per pod");
  assertEqual(result.best.multiPodCount, 2, "pod count should be derived from pod server count");
  assertEqual(result.best.podServerCount, 64, "pod server count should come from user input");
  assertEqual(result.best.leafCount, 32, "total leaf count should be pod count times per-pod leafs");
  assertEqual(result.best.spines, 16, "total spine count should be pod count times per-pod spines");
}

{
  const input = withInput({
    serverCount: 128,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useMultiPlanar: true,
    useMultiPods: true,
    podServerCount: 64,
    spineUseTwinPort: false,
  });
  const result = calculate(input);
  assert(result.feasible, "multi-pods and multi-planar should compose");
  assertEqual(result.best.multiPodCount, 2, "composed design should derive pods from pod server count");
  assertEqual(result.best.planeCount, 2, "composed design should keep two planes per pod");
  assertEqual(result.best.podCount, 4, "composed design should have pod count times plane count fabric groups");
  assertEqual(result.input.useNodeTwinPort, true, "composed design should force node-side twin-port usage");
  assertEqual(result.input.useTwinPort, false, "composed design should not force leaf twin-port usage");
}

{
  const input = withInput({
    serverLinkSpeed: 100,
    useMultiPlanar: true,
  });
  const result = calculate(input);
  assert(!result.feasible, "multi-planar should be infeasible below 200G node link speed");
  assert(result.infeasibleReason.includes("최소 200 Gbps"), "infeasible reason should explain the node twin-port speed floor");
  assertEqual(result.input.useNodeTwinPort, true, "multi-planar infeasible result should still reflect forced node twin-port");
}

{
  const input = withInput({
    serverCount: 128,
    serverLinkSpeed: 100,
    useMultiPlanar: true,
    useMultiPods: true,
    podServerCount: 64,
  });
  const result = calculate(input);
  assert(!result.feasible, "multi-pods plus multi-planar should also be infeasible below 200G node link speed");
  assert(result.infeasibleReason.includes("노드 연결 포트당 링크 스피드"), "composed infeasible reason should identify node link speed");
}

{
  const input = withInput({ useTwinPort: true, spineUseTwinPort: true, switchLinkSpeed: 1600 });
  assertEqual(leafSpineTwinFactor(input), 2, "spine twin-port option should split spine-side leaf-spine ports");
  assertEqual(leafSpineLeafTwinFactor(input), 2, "spine twin-port option should also split leaf-side leaf-spine ports");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "effective logical link speed should halve with leaf-spine twin-port");
}

{
  const input = withInput({
    serverCount: 32,
    serverLinkSpeed: 400,
    switchPorts: 64,
    switchLinkSpeed: 400,
    spineSwitchPorts: 64,
    spineSwitchLinkSpeed: 800,
    spineUseTwinPort: true,
  });
  const result = calculate(input);
  assert(result.feasible, "asymmetric leaf-spine twin-port input should be feasible");
  assertEqual(leafSpineLeafTwinFactor(input), 1, "400G leaf ports should remain unsplit when connecting to 2x400G spine ports");
  assertEqual(leafSpineTwinFactor(input), 2, "800G spine ports should split into 2x400G links");
  assertEqual(effectiveSwitchLinkSpeed(input), 400, "asymmetric leaf-spine twin-port should keep a 400G logical link speed");
  assertEqual(result.best.uplinksPerLeaf, 32, "asymmetric spine twin-port should not double required leaf-spine logical links");
  assertEqual(result.best.totalLeafUplinks, 256, "asymmetric spine twin-port should keep total leaf-spine logical links equal to the baseline");
  assertEqual(result.best.spines, 2, "asymmetric spine twin-port should allow fewer spine switches");
  assertEqual(result.best.usedPortsPerSpine, 64, "asymmetric spine twin-port should keep each selected spine fully utilized after spine count optimization");
}

{
  const input = withInput({
    switchLinkSpeed: 1600,
    spineSwitchLinkSpeed: 1600,
    useTwinPort: true,
    spineUseTwinPort: false,
  });
  assertEqual(leafSpineLeafTwinFactor(input), 2, "leaf twin-port option should split leaf-side leaf-spine ports unless native leaf-spine uplinks are requested");
  assertEqual(leafSpineTwinFactor(input), 1, "spine ports should stay unsplit when spine twin-port is disabled");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "leaf-side twin-port should halve the effective leaf-spine link speed");
}

{
  const input = withInput({
    switchLinkSpeed: 800,
    useTwinPort: true,
    spineSwitchLinkSpeed: 1600,
    spineUseTwinPort: true,
    disableUplinkTwinPort: true,
  });
  const result = calculate(input);
  assert(result.feasible, "leaf-native and spine twin-port uplink option should remain feasible");
  assertEqual(leafSpineLeafTwinFactor(input), 1, "native leaf-spine uplink option should keep leaf uplink ports unsplit");
  assertEqual(leafSpineTwinFactor(input), 2, "native leaf-spine uplink option should still allow spine-side twin-port splitting");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "1600G spine twin-port should match an 800G native leaf uplink");
  assertEqual(result.best.physicalUplinkPortsPerLeaf, result.best.uplinksPerLeaf, "native leaf uplinks should consume one leaf physical port per logical link");
}

{
  const leafSpineTwinInput = withInput({
    serverCount: 32,
    switchPorts: 128,
    switchLinkSpeed: 800,
    useTwinPort: true,
    spineSwitchPorts: 128,
    spineSwitchLinkSpeed: 800,
    spineUseTwinPort: true,
    disableUplinkTwinPort: false,
  });
  const leafNativeInput = { ...leafSpineTwinInput, disableUplinkTwinPort: true };
  const twinResult = calculate(leafSpineTwinInput);
  const nativeResult = calculate(leafNativeInput);
  assert(twinResult.feasible && nativeResult.feasible, "leaf-spine twin and leaf-native comparison inputs should both be feasible");
  assertEqual(leafSpineLeafTwinFactor(leafSpineTwinInput), 2, "baseline should split leaf-side leaf-spine ports");
  assertEqual(leafSpineLeafTwinFactor(leafNativeInput), 1, "native leaf-spine option should not split leaf-side uplink ports");
  assert(nativeResult.best.uplinksPerLeaf < twinResult.best.uplinksPerLeaf, "native leaf-spine option should reduce leaf uplinks per leaf when the optimized leaf count changes");
  assert(nativeResult.best.usedPortsPerLeaf < twinResult.best.usedPortsPerLeaf, "native leaf-spine option should reduce total used leaf ports in this constrained case");
}

console.log("calculator tests passed");
