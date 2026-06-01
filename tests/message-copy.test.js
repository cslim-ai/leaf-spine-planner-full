/*
 * Copyright © 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const I18n = require("../assets/js/i18n");
const { calculate } = require("../assets/js/calculator");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, expected, message) {
  assert(text.includes(expected), `${message}: expected "${expected}" in "${text}"`);
}

function assertCleanText(text, message) {
  const forbidden = ["낭비", "검토해 주세요", "거의 없습니다", "full-mesh", "??", "�"];
  const found = forbidden.find((fragment) => text.includes(fragment));
  assert(!found, `${message}: found "${found}" in "${text}"`);
}

{
  const result = calculate({
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
    useCustomSwitchCounts: true,
    customLeafCount: 2,
    customSpineCount: 2,
    leafMinSparePorts: 8,
  });
  assert(!result.feasible, "spare-port constrained custom topology should be infeasible");
  assertIncludes(result.infeasibleReason, "Leaf 총 포트 부족", "Leaf infeasible reason should keep a clear summary");
  assertIncludes(result.infeasibleReason, "요청한 Leaf당 예비 포트 8개", "Leaf infeasible reason should include the requested spare ports");
  assertCleanText(result.infeasibleReason, "Leaf infeasible reason should use cleaned copy");
}

{
  const keys = [
    "messages.nonBlocking",
    "messages.oversubscribed",
    "messages.multiPods",
    "messages.multiPlanar",
    "messages.nodeLeafSpeedMismatch",
    "messages.leafTwinPortEfficiency",
    "messages.spineExpansionWarning",
    "messages.unbalancedLeafSpine",
    "messages.leafSpinePortEfficiency",
  ];
  keys.forEach((key) => {
    const text = I18n.t(key, { ratio: 3, podNodeCount: 64, podCount: 8, minLinks: 4, maxLinks: 5 }, "ko");
    assertCleanText(text, `${key} Korean copy should use consistent wording`);
  });
}

console.log("message copy tests passed");
