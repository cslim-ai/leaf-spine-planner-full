/*
 * Copyright (c) 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Shared diagram highlight helpers. Display labels can repeat across pods/planes, so
// highlighting must use stable topology keys when available.
function getDiagramHighlightItemSelector() {
  return "[data-device], [data-source], [data-target], [data-source-key], [data-target-key]";
}

function usesDiagramUniqueHighlightKeys(svg) {
  return Boolean(svg?.querySelector?.("[data-device-key], [data-source-key], [data-target-key]"));
}

function getDiagramHighlightKey(item, strictKeys = false) {
  if (strictKeys) return item?.dataset?.deviceKey || "";
  return item?.dataset?.deviceKey || item?.dataset?.device || "";
}

function getDiagramLinkSourceKey(link, strictKeys = false) {
  if (strictKeys) return link?.dataset?.sourceKey || "";
  return link?.dataset?.sourceKey || link?.dataset?.source || "";
}

function getDiagramLinkTargetKey(link, strictKeys = false) {
  if (strictKeys) return link?.dataset?.targetKey || "";
  return link?.dataset?.targetKey || link?.dataset?.target || "";
}

function isDiagramLinkConnectedToKey(link, selectedKey, strictKeys = false) {
  return getDiagramLinkSourceKey(link, strictKeys) === selectedKey || getDiagramLinkTargetKey(link, strictKeys) === selectedKey;
}

function getConnectedHighlightKeys(links, selectedKey, strictKeys = false) {
  const highlightedKeys = new Set([selectedKey]);
  Array.from(links || []).forEach((link) => {
    const sourceKey = getDiagramLinkSourceKey(link, strictKeys);
    const targetKey = getDiagramLinkTargetKey(link, strictKeys);
    if (sourceKey === selectedKey && targetKey) highlightedKeys.add(targetKey);
    if (targetKey === selectedKey && sourceKey) highlightedKeys.add(sourceKey);
  });
  return highlightedKeys;
}

if (typeof module !== "undefined") {
  module.exports = {
    getDiagramHighlightItemSelector,
    usesDiagramUniqueHighlightKeys,
    getDiagramHighlightKey,
    getConnectedHighlightKeys,
    isDiagramLinkConnectedToKey,
  };
}
