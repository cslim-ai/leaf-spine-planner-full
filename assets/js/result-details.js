/*
 * Copyright 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const LeafSpineResultDetails = (() => {
  function formatEcmpPathCount(value) {
    return `${Number(value).toLocaleString()}-way`;
  }

  function makeEcmpPathCountDetail(best, tr) {
    const reachableSpines = best.perPodSpines || best.spines;
    const pathCount = Math.min(best.uplinksPerLeaf, reachableSpines);
    return [
      tr("results.labels.ecmpPathCount"),
      formatEcmpPathCount(pathCount),
    ];
  }

  return {
    formatEcmpPathCount,
    makeEcmpPathCountDetail,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = LeafSpineResultDetails;
}
