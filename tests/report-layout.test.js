/*
 * Copyright © 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const { formatReportTwinPortUsage } = require("../assets/js/report-layout");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(
  formatReportTwinPortUsage(true, "2x800 Gbps", "사용", "미사용"),
  "2x800 Gbps 사용",
  "report sidebar should show compact enabled Twin-port usage",
);

assertEqual(
  formatReportTwinPortUsage(false, "2x800 Gbps", "사용", "미사용"),
  "미사용",
  "report sidebar should show compact disabled Twin-port usage",
);

console.log("report layout tests passed");
