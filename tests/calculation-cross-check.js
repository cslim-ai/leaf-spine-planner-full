/*
 * Copyright 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const fs = require("fs");
const path = require("path");
const calculator = require("../assets/js/calculator");
const resultDetails = require("../assets/js/result-details");

const REPORT_PATH = path.join(__dirname, "..", "docs", "generated", "calculation-cross-check-2026-06-07.md");
const TARGET_FEASIBLE_CASES = 29317;
const TARGET_INFEASIBLE_CASES = 44130;
const TARGET_CHECKED_CASES = TARGET_FEASIBLE_CASES + TARGET_INFEASIBLE_CASES;
const MAX_GENERATED_POOL = 118510;
const FLOAT_EPSILON = 0.000001;

const axes = {
  serverCounts: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
  serverNicPorts: [1, 2, 4, 8],
  serverLinkSpeeds: [25, 100, 200, 400, 800],
  leafPorts: [32, 64, 72, 128],
  leafSparePorts: [0, 2, 4, 8],
  leafLinkSpeeds: [100, 200, 400, 800],
  spinePorts: [32, 64, 72, 128],
  spineLinkSpeeds: [100, 200, 400, 800],
  booleans: [false, true],
  modes: [
    { mode: "nonblocking", targetOversub: 3 },
    { mode: "oversubscribed", targetOversub: 2 },
    { mode: "oversubscribed", targetOversub: 3 },
    { mode: "oversubscribed", targetOversub: 4 },
  ],
  designs: [
    { useMultiPlanar: false, useMultiPods: false },
    { useMultiPlanar: true, useMultiPods: false },
    { useMultiPlanar: false, useMultiPods: true },
    { useMultiPlanar: true, useMultiPods: true },
  ],
  podServerCounts: [16, 64, 128],
  customProfiles: [
    { useCustomSwitchCounts: false },
    { useCustomSwitchCounts: true, customLeafCount: 2, customSpineCount: 2 },
    { useCustomSwitchCounts: true, customLeafCount: 4, customSpineCount: 2 },
    { useCustomSwitchCounts: true, customLeafCount: 4, customSpineCount: 4 },
    { useCustomSwitchCounts: true, customLeafCount: 8, customSpineCount: 4 },
    { useCustomSwitchCounts: true, customLeafCount: 8, customSpineCount: 8 },
    { useCustomSwitchCounts: true, customLeafCount: 16, customSpineCount: 8 },
    { useCustomSwitchCounts: true, customLeafCount: 16, customSpineCount: 16 },
    { useCustomSwitchCounts: true, customLeafCount: 32, customSpineCount: 16 },
    { useCustomSwitchCounts: true, customLeafCount: 32, customSpineCount: 32 },
  ],
};

const compareBestFields = [
  "leafCount",
  "spines",
  "downlinks",
  "physicalDownlinkPorts",
  "uplinksPerLeaf",
  "totalLeafUplinks",
  "linksPerLeafToSpine",
  "switchPortCapacity",
  "spineSwitchPortCapacity",
  "usedPortsPerLeaf",
  "logicalPortsPerLeaf",
  "physicalUplinkPortsPerLeaf",
  "totalSwitches",
  "oversubscription",
  "leafDownlinkBandwidth",
  "leafUplinkBandwidth",
  "balancedLeafSpineLinks",
  "balancedSpinePorts",
  "unusedPortsPerLeaf",
  "requiredLeafSparePorts",
  "usedPortsPerSpine",
  "logicalLinksPerSpine",
  "unusedPortsPerSpine",
  "podCount",
  "planeCount",
  "multiPodCount",
  "groupsPerPod",
  "podServerCount",
  "perPodLeafs",
  "perPodSpines",
  "perPodSwitches",
];

function pick(list, seed, step) {
  return list[hashIndex(seed, step) % list.length];
}

function hashIndex(seed, salt) {
  let value = (seed + 1) ^ Math.imul(salt + 17, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

function makeInput(index) {
  const serverCount = pick(axes.serverCounts, index, 1);
  const serverNicPorts = pick(axes.serverNicPorts, index, 3);
  const serverLinkSpeed = pick(axes.serverLinkSpeeds, index, 5);
  const leafSwitchPorts = pick(axes.leafPorts, index, 7);
  const leafMinSparePorts = pick(axes.leafSparePorts, index, 11);
  const leafSwitchLinkSpeed = pick(axes.leafLinkSpeeds, index, 13);
  const useTwinPort = pick(axes.booleans, index, 17);
  const disableUplinkTwinPort = useTwinPort ? pick(axes.booleans, index, 19) : false;
  const sameSpineSpec = pick(axes.booleans, index, 23);
  const spineSwitchPorts = sameSpineSpec ? leafSwitchPorts : pick(axes.spinePorts, index, 29);
  const spineSwitchLinkSpeed = sameSpineSpec ? leafSwitchLinkSpeed : pick(axes.spineLinkSpeeds, index, 31);
  const spineUseTwinPort = pick(axes.booleans, index, 37);
  const mode = pick(axes.modes, index, 41);
  const design = pick(axes.designs, index, 43);
  const custom = pick(axes.customProfiles, index, 47);
  const podServerCount = design.useMultiPods
    ? Math.min(serverCount, Math.max(1, pick(axes.podServerCounts, index, 53)))
    : serverCount;

  return {
    serverCount,
    serverNicPorts,
    serverLinkSpeed,
    switchPorts: leafSwitchPorts,
    switchLinkSpeed: leafSwitchLinkSpeed,
    leafSwitchPorts,
    leafMinSparePorts,
    leafSwitchLinkSpeed,
    useTwinPort,
    disableUplinkTwinPort,
    spineSwitchPorts,
    spineSwitchLinkSpeed,
    spineUseTwinPort,
    mode: mode.mode,
    targetOversub: mode.targetOversub,
    useMultiPlanar: design.useMultiPlanar,
    useMultiPods: design.useMultiPods,
    podServerCount,
    useNodeTwinPort: false,
    ...custom,
  };
}

function stableInputKey(input) {
  return JSON.stringify(Object.keys(input).sort().map((key) => [key, input[key]]));
}

function calculateOracle(input) {
  if (input.useMultiPlanar && input.serverLinkSpeed < 200) {
    const totalServerLinks = input.serverCount * activeServerNicPorts(input) * 2;
    return makeInfeasibleResult(
      { ...input, useNodeTwinPort: true, planeCount: 2 },
      totalServerLinks,
      "multi-planar requires at least 200G node link speed",
    );
  }

  if (input.useMultiPods) return calculateOracleMultiPods(input);
  if (input.useMultiPlanar) return calculateOracleMultiPlanar(input);
  return calculateOracleBase(input);
}

function calculateOracleBase(input) {
  const activeNicPorts = activeServerNicPorts(input);
  const totalServerLinks = input.serverCount * activeNicPorts;
  const leafUplinkTwinFactor = leafSpineLeafTwinFactor(input);
  const spineUplinkTwinFactor = leafSpineTwinFactor(input);
  const logicalLinkSpeed = effectiveSwitchLinkSpeed(input);
  const leafPorts = leafSwitchPorts(input);
  const spinePorts = spineSwitchPorts(input);
  const requiredLeafSparePorts = leafMinSparePorts(input);
  const targetRatio = input.mode === "nonblocking" ? 1 : input.targetOversub;
  const minimumLeafs = 2;
  const minimumSpines = 2;
  const maxLeafs = maxLeafSwitches(input, totalServerLinks);
  const customLeafCount = input.useCustomSwitchCounts
    ? Math.max(minimumLeafs, input.customLeafCount || minimumLeafs)
    : null;
  const customSpineCount = input.useCustomSwitchCounts
    ? Math.max(minimumSpines, input.customSpineCount || minimumSpines)
    : null;
  const leafStart = customLeafCount || minimumLeafs;
  const leafEnd = customLeafCount || Math.max(maxLeafs, minimumLeafs);
  const candidates = [];

  for (let leafCount = leafStart; leafCount <= leafEnd; leafCount += 1) {
    const downlinks = Math.ceil(totalServerLinks / leafCount);
    const physicalDownlinkPorts = Math.ceil(downlinks / serverLeafTwinFactor(input));
    if (physicalDownlinkPorts >= leafPorts - requiredLeafSparePorts) continue;

    const downlinkBandwidth = downlinks * input.serverLinkSpeed;
    const requiredUplinks = input.mode === "nonblocking"
      ? Math.ceil(downlinkBandwidth / logicalLinkSpeed)
      : Math.max(1, Math.ceil(downlinkBandwidth / (targetRatio * logicalLinkSpeed)));
    const uplinksPerLeaf = Math.max(minimumSpines, requiredUplinks);
    const physicalUplinkPortsPerLeaf = Math.ceil(uplinksPerLeaf / leafUplinkTwinFactor);
    const usedPortsPerLeaf = physicalDownlinkPorts + physicalUplinkPortsPerLeaf;
    const logicalPortsPerLeaf = downlinks + uplinksPerLeaf;
    if (usedPortsPerLeaf + requiredLeafSparePorts > leafPorts) continue;

    const totalLeafUplinks = leafCount * uplinksPerLeaf;
    const spinesByPortCapacity = Math.ceil(totalLeafUplinks / (spinePorts * spineUplinkTwinFactor));
    const uplinkBandwidth = uplinksPerLeaf * logicalLinkSpeed;
    const oversubscription = downlinkBandwidth / uplinkBandwidth;

    if (input.mode === "nonblocking" && oversubscription > 1) continue;
    if (input.mode === "oversubscribed" && oversubscription < 1) continue;
    if (input.mode === "oversubscribed" && oversubscription > targetRatio + 0.0001) continue;

    const minimumFeasibleSpines = Math.max(minimumSpines, spinesByPortCapacity);
    if (minimumFeasibleSpines > uplinksPerLeaf) continue;
    if (customSpineCount && (customSpineCount < minimumFeasibleSpines || customSpineCount > uplinksPerLeaf)) continue;

    const spineStart = customSpineCount || minimumFeasibleSpines;
    const spineEnd = customSpineCount || uplinksPerLeaf;
    for (let spines = spineStart; spines <= spineEnd; spines += 1) {
      if (leafCount > spinePorts * spineUplinkTwinFactor * spines) continue;
      const logicalLinksPerSpine = Math.ceil(totalLeafUplinks / spines);
      const usedPortsPerSpine = Math.ceil(logicalLinksPerSpine / spineUplinkTwinFactor);
      if (usedPortsPerSpine > spinePorts) continue;

      candidates.push({
        downlinks,
        physicalDownlinkPorts,
        uplinksPerLeaf,
        totalLeafUplinks,
        linksPerLeafToSpine: Math.ceil(uplinksPerLeaf / spines),
        spines,
        leafCount,
        switchPortCapacity: leafPorts,
        spineSwitchPortCapacity: spinePorts,
        usedPortsPerLeaf,
        logicalPortsPerLeaf,
        physicalUplinkPortsPerLeaf,
        totalSwitches: leafCount + spines,
        oversubscription,
        leafDownlinkBandwidth: downlinkBandwidth,
        leafUplinkBandwidth: uplinkBandwidth,
        balancedLeafSpineLinks: uplinksPerLeaf % spines === 0,
        balancedSpinePorts: totalLeafUplinks % spines === 0,
        unusedPortsPerLeaf: leafPorts - usedPortsPerLeaf,
        requiredLeafSparePorts,
        usedPortsPerSpine,
        logicalLinksPerSpine,
        unusedPortsPerSpine: spinePorts - usedPortsPerSpine,
      });
    }
  }

  const best = candidates.sort((a, b) => compareCandidates(input, a, b))[0] || null;
  return {
    input,
    totalServerLinks,
    serverBandwidth: activeNicPorts * input.serverLinkSpeed,
    totalServerBandwidth: totalServerLinks * input.serverLinkSpeed,
    best,
    feasible: Boolean(best),
    infeasibleReason: best ? "" : "No independently feasible Leaf-Spine combination was found.",
  };
}

function compareCandidates(input, a, b) {
  if (input.mode === "nonblocking") {
    const linkBalanceDelta = Number(b.balancedLeafSpineLinks) - Number(a.balancedLeafSpineLinks);
    if (linkBalanceDelta) return linkBalanceDelta;
    const spineBalanceDelta = Number(b.balancedSpinePorts) - Number(a.balancedSpinePorts);
    if (spineBalanceDelta) return spineBalanceDelta;
  }
  const switchDelta = a.totalSwitches - b.totalSwitches;
  if (switchDelta) return switchDelta;
  const leafDelta = a.leafCount - b.leafCount;
  if (leafDelta) return leafDelta;
  const spineDelta = a.spines - b.spines;
  if (spineDelta) return spineDelta;
  if (input.mode === "oversubscribed") {
    const ratioDelta = Math.abs(input.targetOversub - a.oversubscription)
      - Math.abs(input.targetOversub - b.oversubscription);
    if (ratioDelta) return ratioDelta;
  }
  const linkBalanceDelta = Number(b.balancedLeafSpineLinks) - Number(a.balancedLeafSpineLinks);
  if (linkBalanceDelta) return linkBalanceDelta;
  const spineBalanceDelta = Number(b.balancedSpinePorts) - Number(a.balancedSpinePorts);
  if (spineBalanceDelta) return spineBalanceDelta;
  return a.leafCount - b.leafCount;
}

function calculateOracleMultiPlanar(input) {
  const planeCount = 2;
  const podServerCount = input.serverCount;
  const podInput = {
    ...input,
    useMultiPlanar: false,
    useNodeTwinPort: true,
    serverCount: input.serverCount,
    serverLinkSpeed: input.serverLinkSpeed / planeCount,
  };
  const podResult = calculateOracle(podInput);
  const activeNicPorts = activeServerNicPorts(input);
  const totalServerLinks = input.serverCount * activeNicPorts * planeCount;

  if (!podResult.feasible) {
    return makeInfeasibleResult(
      { ...input, useNodeTwinPort: true, podServerCount, podCount: planeCount, planeCount },
      totalServerLinks,
      "per-plane fabric is infeasible",
    );
  }

  const podBest = podResult.best;
  const best = {
    ...podBest,
    podCount: planeCount,
    planeCount,
    podServerCount,
    perPodLeafs: podBest.leafCount,
    perPodSpines: podBest.spines,
    perPodSwitches: podBest.totalSwitches,
    leafCount: podBest.leafCount * planeCount,
    spines: podBest.spines * planeCount,
    totalSwitches: podBest.totalSwitches * planeCount,
    totalLeafUplinks: podBest.totalLeafUplinks * planeCount,
    usedPortsPerSpine: podBest.usedPortsPerSpine,
    unusedPortsPerSpine: podBest.unusedPortsPerSpine,
  };

  return {
    input: { ...input, useNodeTwinPort: true, podServerCount, podCount: planeCount, planeCount },
    totalServerLinks,
    serverBandwidth: activeNicPorts * input.serverLinkSpeed,
    totalServerBandwidth: input.serverCount * activeNicPorts * input.serverLinkSpeed,
    best,
    feasible: true,
    infeasibleReason: "",
  };
}

function calculateOracleMultiPods(input) {
  const podServerCount = Math.min(Math.max(1, input.podServerCount || input.serverCount), input.serverCount);
  const multiPodCount = Math.ceil(input.serverCount / podServerCount);
  const podInput = {
    ...input,
    useMultiPods: false,
    serverCount: podServerCount,
  };
  const podResult = calculateOracle(podInput);
  const activeNicPorts = activeServerNicPorts(input);
  const planeCount = input.useMultiPlanar ? 2 : 1;
  const totalServerLinks = input.serverCount * activeNicPorts * planeCount;

  if (!podResult.feasible) {
    return makeInfeasibleResult(
      { ...input, podServerCount, podCount: multiPodCount, multiPodCount, planeCount },
      totalServerLinks,
      "per-pod fabric is infeasible",
    );
  }

  const podBest = podResult.best;
  const groupsPerPod = podBest.podCount || 1;
  const groupCount = groupsPerPod * multiPodCount;
  const best = {
    ...podBest,
    podCount: groupCount,
    multiPodCount,
    planeCount,
    groupsPerPod,
    podServerCount,
    perPodLeafs: podBest.perPodLeafs || podBest.leafCount,
    perPodSpines: podBest.perPodSpines || podBest.spines,
    perPodSwitches: podBest.totalSwitches,
    leafCount: podBest.leafCount * multiPodCount,
    spines: podBest.spines * multiPodCount,
    totalSwitches: podBest.totalSwitches * multiPodCount,
    totalLeafUplinks: podBest.totalLeafUplinks * multiPodCount,
    usedPortsPerSpine: podBest.usedPortsPerSpine,
    unusedPortsPerSpine: podBest.unusedPortsPerSpine,
  };

  return {
    input: {
      ...podResult.input,
      ...input,
      useNodeTwinPort: input.useMultiPlanar || input.useNodeTwinPort,
      podServerCount,
      podCount: groupCount,
      multiPodCount,
      planeCount,
    },
    totalServerLinks,
    serverBandwidth: activeNicPorts * input.serverLinkSpeed,
    totalServerBandwidth: input.serverCount * activeNicPorts * input.serverLinkSpeed,
    best,
    feasible: true,
    infeasibleReason: "",
  };
}

function makeInfeasibleResult(input, totalServerLinks, reason) {
  const activeNicPorts = activeServerNicPorts(input);
  return {
    input,
    totalServerLinks,
    serverBandwidth: activeNicPorts * input.serverLinkSpeed,
    totalServerBandwidth: totalServerLinks * input.serverLinkSpeed,
    best: null,
    feasible: false,
    infeasibleReason: reason,
  };
}

function activeServerNicPorts(input) {
  return input.serverNicPorts;
}

function maxLeafSwitches(input, totalServerLinks) {
  if (Number.isFinite(totalServerLinks) && totalServerLinks > 0) return Math.max(2, totalServerLinks);
  return spineSwitchPorts(input) * leafSpineTwinFactor(input);
}

function effectiveSwitchLinkSpeed(input) {
  return Math.min(
    leafSwitchLinkSpeed(input) / leafSpineLeafTwinFactor(input),
    spineSwitchLinkSpeed(input) / leafSpineTwinFactor(input),
  );
}

function leafSpineTwinFactor(input) {
  return input.spineUseTwinPort ? 2 : 1;
}

function leafSpineLeafTwinFactor(input) {
  if (input.disableUplinkTwinPort) return 1;
  return input.useTwinPort ? 2 : 1;
}

function serverLeafTwinFactor(input) {
  return input.useTwinPort ? 2 : 1;
}

function leafSwitchPorts(input) {
  return input.leafSwitchPorts ?? input.switchPorts;
}

function spineSwitchPorts(input) {
  return input.spineSwitchPorts ?? input.switchPorts;
}

function leafSwitchLinkSpeed(input) {
  return input.leafSwitchLinkSpeed ?? input.switchLinkSpeed;
}

function spineSwitchLinkSpeed(input) {
  return input.spineSwitchLinkSpeed ?? input.switchLinkSpeed;
}

function leafMinSparePorts(input) {
  return Math.max(0, Math.floor(Number(input.leafMinSparePorts) || 0));
}

function expectedEcmpPathCount(best) {
  return Math.min(best.uplinksPerLeaf, best.perPodSpines || best.spines);
}

function expectedCableCounts(input, best) {
  return {
    serverLeaf: countServerLeafCables(input, best, serverLeafTwinFactor(input)),
    leafSpine: countLeafSpineCables(input, best, leafSpineTwinFactor(input)),
  };
}

function countServerLeafCables(input, best, twinFactor) {
  const groupCount = best.podCount || 1;
  const multiPodCount = best.multiPodCount || (input.useMultiPods
    ? Math.ceil(input.serverCount / Math.max(1, input.podServerCount || input.serverCount))
    : 1);
  const planeCount = best.planeCount || (input.useMultiPlanar ? 2 : 1);
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const podServerCount = best.podServerCount || input.serverCount;
  const activeNicPorts = activeServerNicPorts(input);
  const linksPerLeaf = Array.from({ length: best.leafCount }, () => 0);

  for (let serverIndex = 0; serverIndex < input.serverCount; serverIndex += 1) {
    const serverPodIndex = input.useMultiPods
      ? Math.min(multiPodCount - 1, Math.floor(serverIndex / podServerCount))
      : 0;
    const localServerIndex = input.useMultiPods ? serverIndex % podServerCount : serverIndex;
    const planeIterations = input.useMultiPlanar ? planeCount : 1;
    for (let planeIndex = 0; planeIndex < planeIterations; planeIndex += 1) {
      const groupIndex = serverPodIndex * planeCount + planeIndex;
      for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
        const leafIndex = groupCount > 1
          ? groupIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : ((serverIndex * activeNicPorts + nicIndex) % best.leafCount);
        if (leafIndex < linksPerLeaf.length && groupIndex < groupCount) linksPerLeaf[leafIndex] += 1;
      }
    }
  }

  return linksPerLeaf.reduce((total, linkCount) => total + Math.ceil(linkCount / twinFactor), 0);
}

function countLeafSpineCables(input, best, twinFactor) {
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const perPodSpines = best.perPodSpines || best.spines;
  let cables = 0;

  for (let podIndex = 0; podIndex < podCount; podIndex += 1) {
    const leafsInPod = Math.min(perPodLeafs, best.leafCount - podIndex * perPodLeafs);
    for (let leafIndex = 0; leafIndex < leafsInPod; leafIndex += 1) {
      for (let spineIndex = 0; spineIndex < perPodSpines; spineIndex += 1) {
        cables += Math.ceil(linksForSpine(best.uplinksPerLeaf, perPodSpines, spineIndex) / twinFactor);
      }
    }
  }

  return cables;
}

function linksForSpine(uplinksPerLeaf, spineCount, spineIndex) {
  const base = Math.floor(uplinksPerLeaf / spineCount);
  const extra = uplinksPerLeaf % spineCount;
  return base + (spineIndex < extra ? 1 : 0);
}

function compareCase(input, expected, actual) {
  const errors = [];

  compareValue(errors, "feasible", actual.feasible, expected.feasible);
  compareValue(errors, "totalServerLinks", actual.totalServerLinks, expected.totalServerLinks);
  compareValue(errors, "serverBandwidth", actual.serverBandwidth, expected.serverBandwidth);
  compareValue(errors, "totalServerBandwidth", actual.totalServerBandwidth, expected.totalServerBandwidth);

  if (expected.feasible !== actual.feasible) return errors;
  if (!expected.feasible) {
    if (!actual.infeasibleReason) errors.push({ field: "infeasibleReason", expected: "non-empty", actual: "" });
    return errors;
  }

  compareBestFields.forEach((field) => {
    compareValue(errors, `best.${field}`, actual.best[field], expected.best[field]);
  });

  const actualEcmp = resultDetails.makeEcmpPathCountDetail(actual.best, tr);
  const expectedEcmp = `${expectedEcmpPathCount(expected.best).toLocaleString()}-way`;
  compareValue(errors, "details.ecmpPathCount", actualEcmp[1], expectedEcmp);

  const actualCableCounts = calculator.calculateCableCounts(input, actual.best);
  const expectedCables = expectedCableCounts(input, expected.best);
  compareValue(errors, "cables.serverLeaf", actualCableCounts.serverLeaf, expectedCables.serverLeaf);
  compareValue(errors, "cables.leafSpine", actualCableCounts.leafSpine, expectedCables.leafSpine);

  const displayValues = expectedDisplayValues(expected);
  compareValue(errors, "display.totalUsedLeafPorts", actual.best.usedPortsPerLeaf * actual.best.leafCount, displayValues.totalUsedLeafPorts);
  compareValue(errors, "display.totalSpareLeafPorts", actual.best.unusedPortsPerLeaf * actual.best.leafCount, displayValues.totalSpareLeafPorts);
  compareValue(errors, "display.totalUsedSpinePorts", actual.best.usedPortsPerSpine * actual.best.spines, displayValues.totalUsedSpinePorts);
  compareValue(errors, "display.totalSpareSpinePorts", actual.best.unusedPortsPerSpine * actual.best.spines, displayValues.totalSpareSpinePorts);

  return errors;
}

function expectedDisplayValues(result) {
  return {
    totalUsedLeafPorts: result.best.usedPortsPerLeaf * result.best.leafCount,
    totalSpareLeafPorts: result.best.unusedPortsPerLeaf * result.best.leafCount,
    totalUsedSpinePorts: result.best.usedPortsPerSpine * result.best.spines,
    totalSpareSpinePorts: result.best.unusedPortsPerSpine * result.best.spines,
  };
}

function compareValue(errors, field, actual, expected) {
  if (typeof actual === "number" && typeof expected === "number") {
    if (Math.abs(actual - expected) > FLOAT_EPSILON) {
      errors.push({ field, expected, actual });
    }
    return;
  }
  if (actual !== expected) {
    errors.push({ field, expected, actual });
  }
}

function tr(pathName) {
  if (pathName === "results.labels.ecmpPathCount") return "ECMP Path Count";
  return pathName;
}

function categorize(input, result) {
  return {
    feasible: result.feasible,
    nonblocking: input.mode === "nonblocking",
    oversubscribed: input.mode === "oversubscribed",
    multiPlanar: input.useMultiPlanar,
    multiPods: input.useMultiPods,
    custom: Boolean(input.useCustomSwitchCounts),
    asymmetricSpine: input.leafSwitchPorts !== input.spineSwitchPorts
      || input.leafSwitchLinkSpeed !== input.spineSwitchLinkSpeed,
    leafTwin: input.useTwinPort,
    leafSpineTwinEnabled: input.useTwinPort && !input.disableUplinkTwinPort,
    spineTwin: input.spineUseTwinPort,
  };
}

function run() {
  const seen = new Set();
  const selected = [];
  const mismatches = [];
  const stats = {
    generatedPool: 0,
    checked: 0,
    feasible: 0,
    infeasible: 0,
    nonblocking: 0,
    oversubscribed: 0,
    multiPlanar: 0,
    multiPods: 0,
    custom: 0,
    asymmetricSpine: 0,
    leafTwin: 0,
    leafSpineTwinEnabled: 0,
    spineTwin: 0,
  };

  for (let generatedIndex = 0; generatedIndex < MAX_GENERATED_POOL; generatedIndex += 1) {
    stats.generatedPool += 1;
    const input = makeInput(generatedIndex);
    const key = stableInputKey(input);
    if (seen.has(key)) continue;
    seen.add(key);

    const expected = calculateOracle(input);
    const wantsFeasible = expected.feasible && stats.feasible < TARGET_FEASIBLE_CASES;
    const wantsInfeasible = !expected.feasible && stats.infeasible < TARGET_INFEASIBLE_CASES;
    if (!wantsFeasible && !wantsInfeasible) {
      if (stats.feasible >= TARGET_FEASIBLE_CASES && stats.infeasible >= TARGET_INFEASIBLE_CASES) break;
      continue;
    }

    const actual = calculator.calculate(input);
    const errors = compareCase(input, expected, actual);
    if (errors.length) {
      mismatches.push({ input, errors, expected: summarizeResult(expected), actual: summarizeResult(actual) });
    }

    const category = categorize(input, expected);
    selected.push({ input, expected, errors });
    stats.checked += 1;
    if (category.feasible) stats.feasible += 1;
    else stats.infeasible += 1;
    if (category.nonblocking) stats.nonblocking += 1;
    if (category.oversubscribed) stats.oversubscribed += 1;
    if (category.multiPlanar) stats.multiPlanar += 1;
    if (category.multiPods) stats.multiPods += 1;
    if (category.custom) stats.custom += 1;
    if (category.asymmetricSpine) stats.asymmetricSpine += 1;
    if (category.leafTwin) stats.leafTwin += 1;
    if (category.leafSpineTwinEnabled) stats.leafSpineTwinEnabled += 1;
    if (category.spineTwin) stats.spineTwin += 1;

    if (stats.checked >= TARGET_CHECKED_CASES) break;
  }

  if (stats.checked !== TARGET_CHECKED_CASES) {
    throw new Error(`Unable to fill target validation cases: ${JSON.stringify(stats)}`);
  }

  writeReport(stats, selected, mismatches);

  const result = {
    reportPath: path.relative(process.cwd(), REPORT_PATH),
    stats,
    mismatchCount: mismatches.length,
  };
  console.log(JSON.stringify(result, null, 2));

  if (mismatches.length) {
    process.exitCode = 1;
  }
}

function summarizeResult(result) {
  if (!result.feasible) {
    return {
      feasible: false,
      totalServerLinks: result.totalServerLinks,
      infeasibleReason: result.infeasibleReason,
    };
  }
  return {
    feasible: true,
    totalServerLinks: result.totalServerLinks,
    leafCount: result.best.leafCount,
    spines: result.best.spines,
    uplinksPerLeaf: result.best.uplinksPerLeaf,
    oversubscription: result.best.oversubscription,
    ecmpPathCount: expectedEcmpPathCount(result.best),
  };
}

function writeReport(stats, selected, mismatches) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const representativeCases = selectRepresentativeCases(selected);
  const lines = [
    "# Calculation Cross-check Report",
    "",
    "- Date: 2026-06-07",
    "- Purpose: Cross-check project calculation output against an independent oracle.",
    `- Result: ${mismatches.length ? `${mismatches.length} mismatch group(s) found.` : "No mismatches found in the tested cases."}`,
    `- Recommendation: ${mismatches.length ? "Review the mismatch details below before changing formulas." : "No source-code or calculation-formula correction is recommended from this validation run."}`,
    "- Browser visual DOM check: not covered by this script. This script validates calculation and result-detail module outputs.",
    "",
    "## Scope",
    "",
    "| Axis | Values |",
    "| --- | --- |",
    `| Node count | ${axes.serverCounts.join(", ")} |`,
    `| Node ports | ${axes.serverNicPorts.join(", ")} |`,
    `| Node link speed | ${axes.serverLinkSpeeds.map((value) => `${value}G`).join(", ")} |`,
    `| Leaf ports | ${axes.leafPorts.join(", ")} |`,
    `| Leaf spare ports | ${axes.leafSparePorts.join(", ")} |`,
    `| Leaf link speed | ${axes.leafLinkSpeeds.map((value) => `${value}G`).join(", ")} |`,
    `| Spine ports | ${axes.spinePorts.join(", ")} |`,
    `| Spine link speed | ${axes.spineLinkSpeeds.map((value) => `${value}G`).join(", ")} |`,
    "| Twin-port options | Leaf, Leaf-Spine, Spine |",
    "| Modes | nonblocking, oversubscribed 2:1, oversubscribed 3:1, oversubscribed 4:1 |",
    "| Fabric designs | single, multi-planar, multi-pods, multi-planar + multi-pods |",
    "| Custom switch counts | auto plus selected custom Leaf/Spine count pairs |",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Generated pool | ${formatCount(stats.generatedPool)} |`,
    `| Checked cases | ${formatCount(stats.checked)} |`,
    `| Feasible cases | ${formatCount(stats.feasible)} |`,
    `| Infeasible cases | ${formatCount(stats.infeasible)} |`,
    `| Non-blocking cases | ${formatCount(stats.nonblocking)} |`,
    `| Oversubscribed cases | ${formatCount(stats.oversubscribed)} |`,
    `| Multi-planar cases | ${formatCount(stats.multiPlanar)} |`,
    `| Multi-pods cases | ${formatCount(stats.multiPods)} |`,
    `| Custom switch count cases | ${formatCount(stats.custom)} |`,
    `| Asymmetric Spine spec cases | ${formatCount(stats.asymmetricSpine)} |`,
    `| Leaf Twin-port cases | ${formatCount(stats.leafTwin)} |`,
    `| Leaf-Spine Twin-port enabled cases | ${formatCount(stats.leafSpineTwinEnabled)} |`,
    `| Spine Twin-port cases | ${formatCount(stats.spineTwin)} |`,
    `| Mismatch groups | ${formatCount(mismatches.length)} |`,
    "",
    "## Representative Cases",
    "",
  ];

  representativeCases.forEach((entry, index) => {
    lines.push(`### Case ${index + 1}: ${entry.title}`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("| --- | --- |");
    Object.entries(entry.values).forEach(([field, value]) => {
      lines.push(`| ${field} | ${value} |`);
    });
    lines.push("");
  });

  lines.push("## Mismatch Details");
  lines.push("");
  if (!mismatches.length) {
    lines.push("No mismatches were found.");
  } else {
    mismatches.slice(0, 50).forEach((mismatch, index) => {
      lines.push(`### Mismatch ${index + 1}`);
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(mismatch, null, 2));
      lines.push("```");
      lines.push("");
    });
    if (mismatches.length > 50) {
      lines.push(`Only the first 50 mismatch groups are shown. Total mismatch groups: ${mismatches.length}.`);
    }
  }

  lines.push("");
  lines.push("## Conclusion");
  lines.push("");
  lines.push(
    mismatches.length
      ? `Based on ${formatCount(stats.checked)} checked cases, mismatches were found. Review the mismatch details before changing production formulas.`
      : `Based on ${formatCount(stats.checked)} checked cases, the independent oracle matched the project calculation results and result-display derived values. No source-code or calculation-formula correction is recommended from this validation run.`,
  );
  lines.push("");

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function selectRepresentativeCases(selected) {
  const findCase = (predicate) => selected.find((entry) => entry.expected.feasible && predicate(entry.input, entry.expected.best));
  const fallback = selected.find((entry) => entry.expected.feasible);
  const infeasible = selected.find((entry) => !entry.expected.feasible);
  const cases = [
    {
      title: "512 nodes, 8 ports, 800G, multi-planar + multi-pods, Leaf-Spine Twin-port enabled",
      entry: findCase((input) => (
        input.serverCount === 512
        && input.serverNicPorts === 8
        && input.serverLinkSpeed === 800
        && input.useMultiPlanar
        && input.useMultiPods
        && input.useTwinPort
        && !input.disableUplinkTwinPort
      )),
    },
    {
      title: "512 nodes, 8 ports, 800G, multi-planar + multi-pods, native Leaf-Spine uplinks",
      entry: findCase((input) => (
        input.serverCount === 512
        && input.serverNicPorts === 8
        && input.serverLinkSpeed === 800
        && input.useMultiPlanar
        && input.useMultiPods
        && input.disableUplinkTwinPort
      )),
    },
    {
      title: "Oversubscribed design",
      entry: findCase((input) => input.mode === "oversubscribed"),
    },
    {
      title: "Asymmetric Spine specification",
      entry: findCase((input) => (
        input.leafSwitchPorts !== input.spineSwitchPorts
        || input.leafSwitchLinkSpeed !== input.spineSwitchLinkSpeed
      )),
    },
    {
      title: "Infeasible input",
      entry: infeasible,
    },
  ];

  return cases
    .map(({ title, entry }) => ({ title, entry: entry || fallback }))
    .filter(({ entry }) => entry)
    .map(({ title, entry }) => ({
      title,
      values: summarizeCase(entry.input, entry.expected),
    }));
}

function summarizeCase(input, result) {
  const values = {
    "Node count": input.serverCount.toLocaleString(),
    "Node ports": input.serverNicPorts.toLocaleString(),
    "Node link speed": `${input.serverLinkSpeed.toLocaleString()}G`,
    "Leaf ports": input.leafSwitchPorts.toLocaleString(),
    "Leaf spare ports": input.leafMinSparePorts.toLocaleString(),
    "Leaf link speed": `${input.leafSwitchLinkSpeed.toLocaleString()}G`,
    "Leaf Twin-port": String(input.useTwinPort),
    "Native Leaf-Spine uplink": String(input.disableUplinkTwinPort),
    "Spine ports": input.spineSwitchPorts.toLocaleString(),
    "Spine link speed": `${input.spineSwitchLinkSpeed.toLocaleString()}G`,
    "Spine Twin-port": String(input.spineUseTwinPort),
    "Mode": input.mode === "oversubscribed" ? `${input.targetOversub}:1 oversubscribed` : "nonblocking",
    "Multi-planar": String(input.useMultiPlanar),
    "Multi-pods": String(input.useMultiPods),
    "Pod node count": input.podServerCount.toLocaleString(),
    "Feasible": String(result.feasible),
  };

  if (!result.feasible) return values;

  return {
    ...values,
    "Leaf count": result.best.leafCount.toLocaleString(),
    "Spine count": result.best.spines.toLocaleString(),
    "Per-group Leaf count": (result.best.perPodLeafs || result.best.leafCount).toLocaleString(),
    "Per-group Spine count": (result.best.perPodSpines || result.best.spines).toLocaleString(),
    "Uplinks per Leaf": result.best.uplinksPerLeaf.toLocaleString(),
    "Total Leaf-Spine links": result.best.totalLeafUplinks.toLocaleString(),
    "ECMP path count": `${expectedEcmpPathCount(result.best).toLocaleString()}-way`,
    "Oversubscription": formatRatio(result.best.oversubscription),
    "Leaf port usage": `${result.best.usedPortsPerLeaf.toLocaleString()} / ${result.best.switchPortCapacity.toLocaleString()}`,
    "Spine port usage": `${result.best.usedPortsPerSpine.toLocaleString()} / ${result.best.spineSwitchPortCapacity.toLocaleString()}`,
  };
}

function formatRatio(value) {
  if (Math.abs(value - Math.round(value)) < FLOAT_EPSILON) return Math.round(value).toLocaleString();
  return value.toFixed(2);
}

function formatCount(value) {
  return Number(value).toLocaleString();
}

run();
