const LeafSpineCalculator = (() => {
  function calculate(input) {
    if (input.useMultiPlanar) {
      return calculateMultiPlanar(input);
    }

    const activeNicPorts = activeServerNicPorts(input);
    const totalServerLinks = input.serverCount * activeNicPorts;
    const uplinkTwinFactor = leafSpineTwinFactor(input);
    const switchLogicalLinkSpeed = effectiveSwitchLinkSpeed(input);
    const targetRatio = input.mode === "nonblocking" ? 1 : input.targetOversub;
    const minimumLeafs = 2;
    const minimumSpines = 2;
    const maxLeafs = maxLeafSwitches(input);
    const candidates = [];
    const failureStats = {
      leafServerPortShortage: 0,
      leafTotalPortShortage: 0,
      leafLimitExceeded: 0,
      bandwidthMismatch: 0,
      spinePortShortage: 0,
      fullMeshShortage: 0,
      checkedLeafs: 0,
    };

    for (let leafCount = minimumLeafs; leafCount <= Math.max(maxLeafs, minimumLeafs); leafCount += 1) {
      failureStats.checkedLeafs += 1;
      const downlinks = Math.ceil(totalServerLinks / leafCount);
      const physicalDownlinkPorts = input.useTwinPort
        ? Math.ceil(downlinks / 2)
        : downlinks;
      if (physicalDownlinkPorts >= input.switchPorts) {
        failureStats.leafServerPortShortage += 1;
        continue;
      }

      const downlinkBandwidth = downlinks * input.serverLinkSpeed;
      const requiredUplinks = input.mode === "nonblocking"
        ? Math.ceil(downlinkBandwidth / switchLogicalLinkSpeed)
        : Math.max(1, Math.ceil(downlinkBandwidth / (targetRatio * switchLogicalLinkSpeed)));
      const uplinksPerLeaf = Math.max(minimumSpines, requiredUplinks);
      const physicalUplinkPortsPerLeaf = Math.ceil(uplinksPerLeaf / uplinkTwinFactor);
      const usedPortsPerLeaf = physicalDownlinkPorts + physicalUplinkPortsPerLeaf;
      const logicalPortsPerLeaf = downlinks + uplinksPerLeaf;
      if (usedPortsPerLeaf > input.switchPorts) {
        failureStats.leafTotalPortShortage += 1;
        continue;
      }

      const totalLeafUplinks = leafCount * uplinksPerLeaf;
      const spinesByPortCapacity = Math.ceil(totalLeafUplinks / (input.switchPorts * uplinkTwinFactor));
      if (leafCount > maxLeafs) {
        failureStats.leafLimitExceeded += 1;
        continue;
      }

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
      let spineCandidateFound = false;
      for (let spines = minimumFeasibleSpines; spines <= uplinksPerLeaf; spines += 1) {
        if (leafCount > input.switchPorts * uplinkTwinFactor * spines) {
          failureStats.fullMeshShortage += 1;
          continue;
        }
        const logicalLinksPerSpine = Math.ceil(totalLeafUplinks / spines);
        const usedPortsPerSpine = Math.ceil(logicalLinksPerSpine / uplinkTwinFactor);
        if (usedPortsPerSpine > input.switchPorts) {
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
          switchPortCapacity: input.switchPorts,
          usedPortsPerLeaf,
          logicalPortsPerLeaf,
          physicalUplinkPortsPerLeaf,
          totalSwitches: leafCount + spines,
          oversubscription,
          leafDownlinkBandwidth: downlinkBandwidth,
          leafUplinkBandwidth: uplinkBandwidth,
          balancedLeafSpineLinks,
          balancedSpinePorts,
          unusedPortsPerLeaf: input.switchPorts - usedPortsPerLeaf,
          usedPortsPerSpine,
          logicalLinksPerSpine,
          unusedPortsPerSpine: input.switchPorts - usedPortsPerSpine,
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
    const leafDownlinkCapacity = Math.floor(effectiveSwitchPorts(input) / 2);
    const serverLinks = leafDownlinkCapacity * maxLeafSwitches(input);
    return serverLinks;
  }

  function maxLeafSwitches(input) {
    const portCapacity = effectiveSwitchPorts(input);
    if (portCapacity <= 72) return Math.min(portCapacity, 64);
    return portCapacity;
  }

  function effectiveSwitchPorts(input) {
    return input.switchPorts * leafSpineTwinFactor(input);
  }

  function effectiveSwitchLinkSpeed(input) {
    return input.switchLinkSpeed / leafSpineTwinFactor(input);
  }

  function leafSpineTwinFactor(input) {
    return input.useTwinPort && !input.disableUplinkTwinPort ? 2 : 1;
  }

  function calculateCableCounts(input, best) {
    return {
      serverLeaf: countServerLeafCables(input, best, input.useTwinPort ? 2 : 1),
      leafSpine: countLeafSpineCables(input, best, leafSpineTwinFactor(input)),
    };
  }

  function countServerLeafCables(input, best, twinFactor) {
    const podCount = best.podCount || 1;
    const perPodLeafs = best.perPodLeafs || best.leafCount;
    const podServerCount = best.podServerCount || input.serverCount;
    const activeNicPorts = activeServerNicPorts(input);
    const linksPerLeaf = Array.from({ length: best.leafCount }, () => 0);

    for (let serverIndex = 0; serverIndex < input.serverCount; serverIndex += 1) {
      const podIndex = input.useMultiPlanar ? Math.floor(serverIndex / podServerCount) : 0;
      const localServerIndex = input.useMultiPlanar ? serverIndex % podServerCount : serverIndex;
      for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
        const leafIndex = input.useMultiPlanar
          ? podIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
          : ((serverIndex * activeNicPorts + nicIndex) % best.leafCount);
        if (leafIndex < linksPerLeaf.length && podIndex < podCount) linksPerLeaf[leafIndex] += 1;
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
    const podServerCount = Math.min(input.podServerCount, input.serverCount);
    const podCount = Math.ceil(input.serverCount / podServerCount);
    const podInput = {
      ...input,
      useMultiPlanar: false,
      serverCount: podServerCount,
    };
    const podResult = calculate(podInput);
    const activeNicPorts = activeServerNicPorts(input);
    const totalServerLinks = input.serverCount * activeNicPorts;

    if (!podResult.feasible) {
      return infeasibleResult(
        { ...input, podServerCount, podCount },
        totalServerLinks,
        `Pod당 ${podServerCount.toLocaleString()}대 기준 구성이 불가능합니다. ${podResult.infeasibleReason || ""}`.trim(),
      );
    }

    const podBest = podResult.best;
    const best = {
      ...podBest,
      podCount,
      podServerCount,
      perPodLeafs: podBest.leafCount,
      perPodSpines: podBest.spines,
      perPodSwitches: podBest.totalSwitches,
      leafCount: podBest.leafCount * podCount,
      spines: podBest.spines * podCount,
      totalSwitches: podBest.totalSwitches * podCount,
      totalLeafUplinks: podBest.totalLeafUplinks * podCount,
      usedPortsPerSpine: podBest.usedPortsPerSpine,
      unusedPortsPerSpine: podBest.unusedPortsPerSpine,
    };

    return {
      input: { ...input, podServerCount, podCount },
      totalServerLinks,
      serverBandwidth: activeNicPorts * input.serverLinkSpeed,
      totalServerBandwidth: totalServerLinks * input.serverLinkSpeed,
      best,
      feasible: true,
      infeasibleReason: "",
    };
  }

  function buildInfeasibleReason(input, totalServerLinks, stats) {
    const logicalSwitchPorts = effectiveSwitchPorts(input);
    const modeText = input.mode === "oversubscribed"
      ? `목표 1:${input.targetOversub} oversubscription`
      : "non-blocking";
    const reasons = [];

    if (stats.leafServerPortShortage > 0) {
      reasons.push(`서버 연결 포트 ${totalServerLinks.toLocaleString()}개를 Leaf에 분산해도 일부 Leaf의 서버 다운링크가 스위치 물리 포트 ${input.switchPorts.toLocaleString()}개 이상을 요구합니다.`);
    }
    if (stats.leafTotalPortShortage > 0) {
      reasons.push(`Leaf에서 서버 다운링크와 Spine 업링크를 동시에 수용할 물리 포트가 부족합니다.`);
    }
    if (stats.spinePortShortage > 0 || stats.fullMeshShortage > 0) {
      reasons.push(`모든 Leaf가 모든 Spine에 연결되는 조건에서 Spine당 Leaf 링크가 스위치 포트 용량을 초과합니다.`);
    }
    if (stats.bandwidthMismatch > 0) {
      reasons.push(`${modeText} 대역폭 조건을 만족하는 Leaf-Spine 업링크 수를 만들 수 없습니다.`);
    }

    if (!reasons.length) {
      reasons.push(`스위치 논리 포트 ${logicalSwitchPorts.toLocaleString()}개 기준으로 ${modeText} 구성을 만들 수 없습니다.`);
    }

    return reasons.join(" ");
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
    calculateCableCounts,
    priorLinksForSpine,
    linksForSpine,
  };
})();

if (typeof module !== "undefined") {
  module.exports = LeafSpineCalculator;
}
