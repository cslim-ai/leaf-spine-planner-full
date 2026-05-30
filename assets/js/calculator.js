const LeafSpineCalculator = (() => {
  function calculate(input) {
    if (input.useMultiPods) {
      return calculateMultiPods(input);
    }
    if (input.useMultiPlanar) {
      return calculateMultiPlanar(input);
    }

    const activeNicPorts = activeServerNicPorts(input);
    const totalServerLinks = input.serverCount * activeNicPorts;
    const leafUplinkTwinFactor = leafSpineLeafTwinFactor(input);
    const spineUplinkTwinFactor = leafSpineTwinFactor(input);
    const switchLogicalLinkSpeed = effectiveSwitchLinkSpeed(input);
    const leafPorts = leafSwitchPorts(input);
    const spinePorts = spineSwitchPorts(input);
    const targetRatio = input.mode === "nonblocking" ? 1 : input.targetOversub;
    const minimumLeafs = 2;
    const minimumSpines = 2;
    const maxLeafs = maxLeafSwitches(input, totalServerLinks);
    const candidates = [];
    const failureStats = {
      leafServerPortShortage: 0,
      leafTotalPortShortage: 0,
      bandwidthMismatch: 0,
      spinePortShortage: 0,
      fullMeshShortage: 0,
      checkedLeafs: 0,
      leafServerFit: 0,
      leafTotalFit: 0,
      maxPhysicalDownlinkPorts: 0,
      minPhysicalDownlinkPorts: Number.POSITIVE_INFINITY,
      maxUsedPortsPerLeaf: 0,
      minUsedPortsPerLeaf: Number.POSITIVE_INFINITY,
      maxUsedPortsPerSpine: 0,
      maxLeafCountForFullMesh: 0,
      minRequiredSpinesForFullMesh: Number.POSITIVE_INFINITY,
    };

    for (let leafCount = minimumLeafs; leafCount <= Math.max(maxLeafs, minimumLeafs); leafCount += 1) {
      failureStats.checkedLeafs += 1;
      const downlinks = Math.ceil(totalServerLinks / leafCount);
      const physicalDownlinkPorts = Math.ceil(downlinks / serverLeafTwinFactor(input));
      failureStats.maxPhysicalDownlinkPorts = Math.max(failureStats.maxPhysicalDownlinkPorts, physicalDownlinkPorts);
      failureStats.minPhysicalDownlinkPorts = Math.min(failureStats.minPhysicalDownlinkPorts, physicalDownlinkPorts);
      if (physicalDownlinkPorts >= leafPorts) {
        failureStats.leafServerPortShortage += 1;
        continue;
      }
      failureStats.leafServerFit += 1;

      const downlinkBandwidth = downlinks * input.serverLinkSpeed;
      const requiredUplinks = input.mode === "nonblocking"
        ? Math.ceil(downlinkBandwidth / switchLogicalLinkSpeed)
        : Math.max(1, Math.ceil(downlinkBandwidth / (targetRatio * switchLogicalLinkSpeed)));
      const uplinksPerLeaf = Math.max(minimumSpines, requiredUplinks);
      const physicalUplinkPortsPerLeaf = Math.ceil(uplinksPerLeaf / leafUplinkTwinFactor);
      const usedPortsPerLeaf = physicalDownlinkPorts + physicalUplinkPortsPerLeaf;
      const logicalPortsPerLeaf = downlinks + uplinksPerLeaf;
      failureStats.maxUsedPortsPerLeaf = Math.max(failureStats.maxUsedPortsPerLeaf, usedPortsPerLeaf);
      failureStats.minUsedPortsPerLeaf = Math.min(failureStats.minUsedPortsPerLeaf, usedPortsPerLeaf);
      if (usedPortsPerLeaf > leafPorts) {
        failureStats.leafTotalPortShortage += 1;
        continue;
      }
      failureStats.leafTotalFit += 1;

      const totalLeafUplinks = leafCount * uplinksPerLeaf;
      const spinesByPortCapacity = Math.ceil(totalLeafUplinks / (spinePorts * spineUplinkTwinFactor));
      const uplinkBandwidth = uplinksPerLeaf * switchLogicalLinkSpeed;
      const oversubscription = downlinkBandwidth / uplinkBandwidth;

      if (input.mode === "nonblocking" && oversubscription > 1) {
        failureStats.bandwidthMismatch += 1;
        continue;
      }
      if (input.mode === "oversubscribed" && oversubscription < 1) {
        failureStats.bandwidthMismatch += 1;
        continue;
      }
      if (input.mode === "oversubscribed" && oversubscription > targetRatio + 0.0001) {
        failureStats.bandwidthMismatch += 1;
        continue;
      }

      const minimumFeasibleSpines = Math.max(minimumSpines, spinesByPortCapacity);
      if (minimumFeasibleSpines > uplinksPerLeaf) {
        failureStats.spinePortShortage += 1;
        failureStats.fullMeshShortage += 1;
        failureStats.minRequiredSpinesForFullMesh = Math.min(
          failureStats.minRequiredSpinesForFullMesh,
          minimumFeasibleSpines,
        );
        continue;
      }
      let spineCandidateFound = false;
      for (let spines = minimumFeasibleSpines; spines <= uplinksPerLeaf; spines += 1) {
        if (leafCount > spinePorts * spineUplinkTwinFactor * spines) {
          failureStats.fullMeshShortage += 1;
          failureStats.maxLeafCountForFullMesh = Math.max(failureStats.maxLeafCountForFullMesh, leafCount);
          failureStats.minRequiredSpinesForFullMesh = Math.min(
            failureStats.minRequiredSpinesForFullMesh,
            Math.ceil(leafCount / (spinePorts * spineUplinkTwinFactor)),
          );
          continue;
        }
        const logicalLinksPerSpine = Math.ceil(totalLeafUplinks / spines);
        const usedPortsPerSpine = Math.ceil(logicalLinksPerSpine / spineUplinkTwinFactor);
        failureStats.maxUsedPortsPerSpine = Math.max(failureStats.maxUsedPortsPerSpine, usedPortsPerSpine);
        if (usedPortsPerSpine > spinePorts) {
          failureStats.spinePortShortage += 1;
          continue;
        }

        spineCandidateFound = true;
        const balancedLeafSpineLinks = uplinksPerLeaf % spines === 0;
        const balancedSpinePorts = totalLeafUplinks % spines === 0;

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
          balancedLeafSpineLinks,
          balancedSpinePorts,
          unusedPortsPerLeaf: leafPorts - usedPortsPerLeaf,
          usedPortsPerSpine,
          logicalLinksPerSpine,
          unusedPortsPerSpine: spinePorts - usedPortsPerSpine,
        });
      }

      if (!spineCandidateFound) failureStats.spinePortShortage += 1;
    }

    const best = candidates.sort((a, b) => {
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
    })[0];

    return {
      input,
      totalServerLinks,
      serverBandwidth: activeNicPorts * input.serverLinkSpeed,
      totalServerBandwidth: totalServerLinks * input.serverLinkSpeed,
      best,
      feasible: Boolean(best),
      infeasibleReason: best ? "" : buildInfeasibleReason(input, totalServerLinks, failureStats),
      failureStats,
    };
  }

  function activeServerNicPorts(input) {
    return input.serverNicPorts;
  }

  function maxNonBlockingServerLinks(input) {
    const leafDownlinkCapacity = Math.floor((leafSwitchPorts(input) * serverLeafTwinFactor(input)) / 2);
    const serverLinks = leafDownlinkCapacity * effectiveSpineSwitchPorts(input);
    return serverLinks;
  }

  function maxLeafSwitches(input, totalServerLinks = null) {
    if (Number.isFinite(totalServerLinks) && totalServerLinks > 0) {
      return Math.max(2, totalServerLinks);
    }
    return effectiveSpineSwitchPorts(input);
  }

  function effectiveSwitchPorts(input) {
    return effectiveSpineSwitchPorts(input);
  }

  function effectiveSpineSwitchPorts(input) {
    return spineSwitchPorts(input) * leafSpineTwinFactor(input);
  }

  function effectiveSwitchLinkSpeed(input) {
    return Math.min(
      leafSwitchLinkSpeed(input) / leafSpineLeafTwinFactor(input),
      spineSwitchLinkSpeed(input) / leafSpineTwinFactor(input),
    );
  }

  function leafSpineTwinFactor(input) {
    const spineTwin = input.spineUseTwinPort ?? input.useTwinPort;
    return spineTwin && !input.disableUplinkTwinPort ? 2 : 1;
  }

  function leafSpineLeafTwinFactor(input) {
    return input.useTwinPort && !input.disableUplinkTwinPort ? 2 : 1;
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

  function calculateCableCounts(input, best) {
    return {
      serverLeaf: countServerLeafCables(input, best, serverLeafTwinFactor(input)),
      leafSpine: countLeafSpineCables(input, best, leafSpineTwinFactor(input)),
    };
  }

  function countServerLeafCables(input, best, twinFactor) {
    const groupCount = best.podCount || 1;
    const multiPodCount = best.multiPodCount || (input.useMultiPods ? Math.ceil(input.serverCount / Math.max(1, input.podServerCount || input.serverCount)) : 1);
    const planeCount = best.planeCount || (input.useMultiPlanar ? 2 : 1);
    const perPodLeafs = best.perPodLeafs || best.leafCount;
    const podServerCount = best.podServerCount || input.serverCount;
    const activeNicPorts = activeServerNicPorts(input);
    const linksPerLeaf = Array.from({ length: best.leafCount }, () => 0);

    for (let serverIndex = 0; serverIndex < input.serverCount; serverIndex += 1) {
      const serverPodIndex = input.useMultiPods ? Math.min(multiPodCount - 1, Math.floor(serverIndex / podServerCount)) : 0;
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

  function infeasibleResult(input, totalServerLinks, reason) {
    const activeNicPorts = activeServerNicPorts(input);
    return {
      input,
      totalServerLinks,
      serverBandwidth: activeNicPorts * input.serverLinkSpeed,
      totalServerBandwidth: totalServerLinks * input.serverLinkSpeed,
      best: null,
      feasible: false,
      infeasibleReason: reason || "현재 입력값으로 구성 가능한 Leaf-Spine 조합을 찾지 못했습니다.",
    };
  }

  function calculateMultiPlanar(input) {
    const planeCount = 2;
    const podServerCount = input.serverCount;
    const podInput = {
      ...input,
      useMultiPlanar: false,
      useTwinPort: true,
      serverCount: input.serverCount,
      serverLinkSpeed: input.serverLinkSpeed / planeCount,
    };
    const podResult = calculate(podInput);
    const activeNicPorts = activeServerNicPorts(input);
    const totalServerLinks = input.serverCount * activeNicPorts * planeCount;

    if (!podResult.feasible) {
      return infeasibleResult(
        { ...input, useTwinPort: true, podServerCount, podCount: planeCount, planeCount },
        totalServerLinks,
        `Plane당 노드 ${podServerCount.toLocaleString()}대 기준 구성이 불가능합니다.\n${podResult.infeasibleReason || ""}`.trim(),
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
      input: { ...input, useTwinPort: true, podServerCount, podCount: planeCount, planeCount },
      totalServerLinks,
      serverBandwidth: activeNicPorts * input.serverLinkSpeed,
      totalServerBandwidth: input.serverCount * activeNicPorts * input.serverLinkSpeed,
      best,
      feasible: true,
      infeasibleReason: "",
    };
  }

  function calculateMultiPods(input) {
    const podServerCount = Math.min(Math.max(1, input.podServerCount || input.serverCount), input.serverCount);
    const multiPodCount = Math.ceil(input.serverCount / podServerCount);
    const podInput = {
      ...input,
      useMultiPods: false,
      serverCount: podServerCount,
    };
    const podResult = calculate(podInput);
    const activeNicPorts = activeServerNicPorts(input);
    const planeCount = input.useMultiPlanar ? 2 : 1;
    const totalServerLinks = input.serverCount * activeNicPorts * planeCount;

    if (!podResult.feasible) {
      return infeasibleResult(
        { ...input, podServerCount, podCount: multiPodCount, multiPodCount, planeCount },
        totalServerLinks,
        `Pod당 노드 ${podServerCount.toLocaleString()}대 기준 구성이 불가능합니다.\n${podResult.infeasibleReason || ""}`.trim(),
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
      input: { ...podResult.input, ...input, useTwinPort: input.useMultiPlanar || input.useTwinPort, podServerCount, podCount: groupCount, multiPodCount, planeCount },
      totalServerLinks,
      serverBandwidth: activeNicPorts * input.serverLinkSpeed,
      totalServerBandwidth: input.serverCount * activeNicPorts * input.serverLinkSpeed,
      best,
      feasible: true,
      infeasibleReason: "",
    };
  }

  function buildInfeasibleReason(input, totalServerLinks, stats) {
    const logicalSwitchPorts = effectiveSwitchPorts(input);
    const leafPorts = leafSwitchPorts(input);
    const spinePorts = spineSwitchPorts(input);
    const modeText = input.mode === "oversubscribed"
      ? `목표 1:${input.targetOversub} oversubscription`
      : "non-blocking";
    const reasons = [];

    if (stats.leafServerPortShortage > 0 && stats.leafServerFit === 0) {
      const requiredDownlinkPorts = Number.isFinite(stats.minPhysicalDownlinkPorts)
        ? stats.minPhysicalDownlinkPorts
        : stats.maxPhysicalDownlinkPorts;
      reasons.push(`Leaf 노드 다운링크 포트 부족: 노드 연결 링크 ${totalServerLinks.toLocaleString()}개를 Leaf에 분산해도 Leaf당 최소 ${requiredDownlinkPorts.toLocaleString()}개의 물리 포트가 필요합니다. 현재 Leaf는 ${leafPorts.toLocaleString()}포트입니다.`);
    }
    if (stats.leafTotalPortShortage > 0 && stats.leafTotalFit === 0) {
      const requiredLeafPorts = Number.isFinite(stats.minUsedPortsPerLeaf)
        ? stats.minUsedPortsPerLeaf
        : stats.maxUsedPortsPerLeaf;
      reasons.push(`Leaf 총 포트 부족: Leaf당 노드 다운링크와 Spine 업링크를 합산하면 최소 ${requiredLeafPorts.toLocaleString()}개의 물리 포트가 필요합니다. 현재 Leaf는 ${leafPorts.toLocaleString()}포트입니다.`);
    }
    if (stats.spinePortShortage > 0 || stats.fullMeshShortage > 0) {
      const spineDetail = stats.maxUsedPortsPerSpine > 0
        ? `Spine당 Leaf 다운링크가 최대 ${stats.maxUsedPortsPerSpine.toLocaleString()}개의 물리 포트까지 필요합니다. `
        : "";
      const fullMeshDetail = Number.isFinite(stats.minRequiredSpinesForFullMesh)
        ? `모든 Leaf가 모든 Spine에 연결되는 기본 Leaf-Spine 조건을 만족하려면 최소 ${stats.minRequiredSpinesForFullMesh.toLocaleString()}대 이상의 Spine이 필요합니다. `
        : "";
      reasons.push(`Spine 포트 또는 full-mesh 조건 부족: ${spineDetail}${fullMeshDetail}현재 Spine 스위치는 Spine당 ${spinePorts.toLocaleString()}포트를 사용할 수 있습니다.`);
    }
    if (stats.bandwidthMismatch > 0) {
      reasons.push(`대역폭 조건 미충족: ${modeText} 조건을 만족하는 Leaf-Spine 업링크 수를 만들 수 없습니다.`);
    }

    if (!reasons.length) {
      reasons.push(`Spine 스위치 논리 포트 ${logicalSwitchPorts.toLocaleString()}개 기준으로 ${modeText} 구성을 만들 수 없습니다.`);
    }

    return reasons.join("\n");
  }

  function priorLinksForSpine(uplinksPerLeaf, spineCount, spineIndex) {
    let total = 0;
    for (let index = 0; index < spineIndex; index += 1) {
      total += linksForSpine(uplinksPerLeaf, spineCount, index);
    }
    return total;
  }

  function linksForSpine(uplinksPerLeaf, spineCount, spineIndex) {
    const base = Math.floor(uplinksPerLeaf / spineCount);
    const extra = uplinksPerLeaf % spineCount;
    return base + (spineIndex < extra ? 1 : 0);
  }

  return {
    calculate,
    activeServerNicPorts,
    maxNonBlockingServerLinks,
    maxLeafSwitches,
    effectiveSwitchPorts,
    effectiveSwitchLinkSpeed,
    leafSpineTwinFactor,
    leafSpineLeafTwinFactor,
    leafSwitchPorts,
    spineSwitchPorts,
    leafSwitchLinkSpeed,
    spineSwitchLinkSpeed,
    calculateCableCounts,
    priorLinksForSpine,
    linksForSpine,
  };
})();

if (typeof module !== "undefined") {
  module.exports = LeafSpineCalculator;
}
