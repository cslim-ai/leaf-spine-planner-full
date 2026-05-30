const {
  calculate,
  effectiveSwitchLinkSpeed,
  leafSpineTwinFactor,
} = require("../calculator");

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
  assert(
    /필요 포트|최소|현재 스위치/.test(result.infeasibleReason),
    "infeasible reason should include numeric capacity context",
  );
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
  assert(
    oversubscribed.best.totalLeafUplinks <= nonBlocking.best.totalLeafUplinks,
    "oversubscription should not require more total leaf-spine uplinks than non-blocking",
  );
}

{
  const input = withInput({
    serverCount: 576,
    serverLinkSpeed: 800,
    switchPorts: 72,
    switchLinkSpeed: 1600,
    useTwinPort: true,
    useMultiPlanar: true,
    podServerCount: 288,
  });
  const result = calculate(input);
  assert(result.feasible, "multi-planar input should be feasible per pod");
  assertEqual(result.best.podCount, 2, "pod count should be calculated from server count and pod size");
  assertEqual(result.best.perPodLeafs, 32, "per-pod leaf count should match single-pod calculation");
  assertEqual(result.best.perPodSpines, 18, "per-pod spine count should match single-pod calculation");
}

{
  const input = withInput({ useTwinPort: true, switchLinkSpeed: 1600 });
  assertEqual(leafSpineTwinFactor(input), 2, "leaf-spine twin factor should use twin-port by default");
  assertEqual(effectiveSwitchLinkSpeed(input), 800, "effective logical link speed should halve with twin-port");
  assertEqual(leafSpineTwinFactor({ ...input, disableUplinkTwinPort: true }), 1, "uplink disable option should use full-speed single links");
}

console.log("calculator tests passed");
