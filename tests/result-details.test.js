const {
  formatEcmpPathCount,
  makeEcmpPathCountDetail,
} = require("../assets/js/result-details");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(formatEcmpPathCount(4), "4-way", "ECMP path count should use way suffix");
assertEqual(formatEcmpPathCount(1), "1-way", "single ECMP path should keep the same format");

const row = makeEcmpPathCountDetail(
  { uplinksPerLeaf: 4, spines: 2 },
  (path) => (path === "results.labels.ecmpPathCount" ? "ECMP Path Count" : path),
);
assertEqual(row[0], "ECMP Path Count", "ECMP detail label should come from i18n");
assertEqual(row[1], "2-way", "ECMP detail value should use reachable Spine count");

const groupedRow = makeEcmpPathCountDetail(
  { uplinksPerLeaf: 32, spines: 64, perPodSpines: 4, podCount: 16, planeCount: 2 },
  (path) => (path === "results.labels.ecmpPathCount" ? "ECMP Path Count" : path),
);
assertEqual(groupedRow[1], "4-way", "ECMP detail value should use Spine count within the Leaf fabric group");

console.log("result details tests passed");
