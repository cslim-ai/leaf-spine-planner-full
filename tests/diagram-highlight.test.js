/*
 * Copyright (c) 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const {
  getDiagramHighlightItemSelector,
  usesDiagramUniqueHighlightKeys,
  getDiagramHighlightKey,
  getConnectedHighlightKeys,
  isDiagramLinkConnectedToKey,
} = require("../assets/js/diagram-highlight");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function makeLink(source, target, sourceKey, targetKey) {
  return {
    dataset: {
      source,
      target,
      sourceKey,
      targetKey,
    },
  };
}

{
  const selector = getDiagramHighlightItemSelector();
  assertEqual(selector.includes("[data-source-key]"), true, "clear selector should include summary links that only have source keys");
  assertEqual(selector.includes("[data-target-key]"), true, "clear selector should include summary links that only have target keys");
  assertEqual(selector.includes("[data-source]"), true, "clear selector should include legacy source-only links");
}

{
  const selected = { dataset: { device: "Node 1", deviceKey: "node-1-pod-1-plane-1" } };
  assertEqual(getDiagramHighlightKey(selected), "node-1-pod-1-plane-1", "device highlight should prefer the unique device key");
}

{
  const links = [
    makeLink("Pod 1 - Node 1", "Pod 1 - Plane 1\nLeaf 1", "node-1-pod-1-plane-1", "leaf-1-pod-1-plane-1"),
    makeLink("Pod 1 - Node 1", "Pod 1 - Plane 2\nLeaf 1", "node-1-pod-1-plane-2", "leaf-1-pod-1-plane-2"),
  ];
  const connected = getConnectedHighlightKeys(links, "node-1-pod-1-plane-1");
  assertEqual(connected.has("leaf-1-pod-1-plane-1"), true, "selected node should include its directly connected leaf");
  assertEqual(connected.has("leaf-1-pod-1-plane-2"), false, "same display label in another plane should not be highlighted");
}

{
  const link = makeLink("Pod 1 - Node 1", "Pod 1 - Plane 2\nLeaf 1", "node-1-pod-1-plane-2", "leaf-1-pod-1-plane-2");
  assertEqual(isDiagramLinkConnectedToKey(link, "node-1-pod-1-plane-1"), false, "same display source should not connect when unique key differs");
}

{
  const selected = { dataset: { device: "Node 1" } };
  assertEqual(getDiagramHighlightKey(selected, true), "", "strict key mode should not fall back to duplicate display labels");
}

{
  const link = makeLink("Node 1", "Leaf 1", "", "");
  assertEqual(isDiagramLinkConnectedToKey(link, "Node 1", true), false, "strict key mode should not match links that only have duplicate display labels");
}

{
  const svg = {
    querySelector(selector) {
      return selector === "[data-device-key], [data-source-key], [data-target-key]" ? {} : null;
    },
  };
  assertEqual(usesDiagramUniqueHighlightKeys(svg), true, "svg should enter strict mode when unique highlight keys are present");
}

console.log("diagram highlight tests passed");
