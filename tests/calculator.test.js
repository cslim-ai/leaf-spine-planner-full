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
  const input = withInput({
    serverCount: 72,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
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
  assertEqual(result.best.spines, 18, "spine count should prefer evenly distributed leaf-spine links");
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
  assertEqual(result.best.spines, 36, "1296-server 144-port fabric should use 36 spine switches");
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
    serverCount: 64,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: false,
    spineUseTwinPort: false,
    useMultiPlanar: true,
  });
  const result = calculate(input);
  assert(result.feasible, "multi-planar input should be feasible per plane");
  assertEqual(result.input.useTwinPort, true, "multi-planar should force server-leaf twin-port usage");
  assertEqual(result.best.podCount, 2, "multi-planar should use two independent planes");
  assertEqual(result.best.perPodLeafs, 8, "per-plane leaf count should match 64-node reference layout");
  assertEqual(result.best.perPodSpines, 4, "per-plane spine count should match 64-node reference layout");
  assertEqual(result.best.leafCount, 16, "total leaf count should be plane count times per-plane leafs");
  assertEqual(result.best.spines, 8, "total spine count should be plane count times per-plane spines");
}

{
  const input = withInput({
    serverCount: 576,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: false,
    spineUseTwinPort: false,
    useMultiPlanar: true,
  });
  const result = calculate(input);
  assert(result.feasible, "larger multi-planar input should be feasible per plane");
  assertEqual(result.best.podCount, 2, "multi-planar should remain two planes");
  assertEqual(result.best.perPodLeafs, 48, "per-plane leaf count should scale with the full server set");
  assertEqual(result.best.perPodSpines, 48, "per-plane spine count should scale with the full server set");
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
  assertEqual(result.input.useTwinPort, true, "composed design should force twin-port on server links");
}

{
  const input = withInput({ useTwinPort: true, switchLinkSpeed: 1600 });
  assertEqual(leafSpineTwinFactor(input), 2, "leaf-spine twin factor should use twin-port by default");
  assertEqual(leafSpineLeafTwinFactor(input), 2, "leaf-side leaf-spine twin factor should use leaf twin-port by default");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "effective logical link speed should halve with twin-port");
  assertEqual(leafSpineLeafTwinFactor({ ...input, disableUplinkTwinPort: true }), 1, "uplink disable option should apply to leaf-side ports");
  assertEqual(leafSpineTwinFactor({ ...input, disableUplinkTwinPort: true }), 1, "uplink disable option should apply to spine-side ports too");
}

{
  const input = withInput({
    switchLinkSpeed: 1600,
    spineSwitchLinkSpeed: 1600,
    useTwinPort: true,
    spineUseTwinPort: false,
    disableUplinkTwinPort: false,
  });
  assertEqual(leafSpineLeafTwinFactor(input), 2, "leaf uplinks should split into two logical links");
  assertEqual(leafSpineTwinFactor(input), 1, "spine ports should stay unsplit when spine twin-port is disabled");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "asymmetric 2:1 leaf-to-spine port mapping should use leaf-side split speed");
}

{
  const input = withInput({
    switchLinkSpeed: 1600,
    spineSwitchLinkSpeed: 1600,
    useTwinPort: true,
    spineUseTwinPort: true,
    disableUplinkTwinPort: true,
  });
  assertEqual(leafSpineLeafTwinFactor(input), 1, "leaf uplink disable should keep leaf ports unsplit");
  assertEqual(leafSpineTwinFactor(input), 1, "leaf-spine disable should keep spine ports unsplit");
}

console.log("calculator tests passed");
