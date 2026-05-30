const form = document.querySelector("#networkForm");
const modeInputs = [...document.querySelectorAll("input[name='topologyMode']")];
const oversubField = document.querySelector("#oversubField");
const podField = document.querySelector("#podField");
const twinPortLabel = document.querySelector("#twinPortLabel");

const fields = {
  serverCount: document.querySelector("#serverCount"),
  serverNicPorts: document.querySelector("#serverNicPorts"),
  serverLinkSpeed: document.querySelector("#serverLinkSpeed"),
  switchPorts: document.querySelector("#switchPorts"),
  switchLinkSpeed: document.querySelector("#switchLinkSpeed"),
  useTwinPort: document.querySelector("#useTwinPort"),
  disableUplinkTwinPort: document.querySelector("#disableUplinkTwinPort"),
  targetOversub: document.querySelector("#targetOversub"),
  useMultiPlanar: document.querySelector("#useMultiPlanar"),
  podServerCount: document.querySelector("#podServerCount"),
};

const outputs = {
  leafCount: document.querySelector("#leafCount"),
  spineCount: document.querySelector("#spineCount"),
  oversubRatio: document.querySelector("#oversubRatio"),
  totalSwitches: document.querySelector("#totalSwitches"),
  detailList: document.querySelector("#detailList"),
  calculationStatus: document.querySelector("#calculationStatus"),
  message: document.querySelector("#message"),
  diagram: document.querySelector("#diagram"),
  diagramCaption: document.querySelector("#diagramCaption"),
  viewFull: document.querySelector("#viewFull"),
  viewWrapped: document.querySelector("#viewWrapped"),
  viewSummary: document.querySelector("#viewSummary"),
  openDiagramWindow: document.querySelector("#openDiagramWindow"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomReset: document.querySelector("#zoomReset"),
  zoomCenter: document.querySelector("#zoomCenter"),
  zoomFit: document.querySelector("#zoomFit"),
  exportSvg: document.querySelector("#exportSvg"),
  exportPng: document.querySelector("#exportPng"),
  exportPptx: document.querySelector("#exportPptx"),
  openPortMapWindow: document.querySelector("#openPortMapWindow"),
  exportPdf: document.querySelector("#exportPdf"),
  resetInputs: document.querySelector("#resetInputs"),
};

let diagramZoom = 1;
let diagramPan = { x: 0, y: 0 };
let dragState = null;
let diagramViewMode = "full";
let pptxGenLoadPromise = null;
const MIN_DIAGRAM_ZOOM = 0.1;
const MAX_DIAGRAM_ZOOM = 10;
const DIAGRAM_ZOOM_STEP = 0.05;
const DEFAULT_DIAGRAM_VIEW_WIDTH = 920;
const DEFAULT_DIAGRAM_VIEW_HEIGHT = 500;
const DIAGRAM_LABEL_GUTTER = 0;
const DIAGRAM_CONTENT_OFFSET = 96;
let currentResult = null;
let exportSequence = 0;
const NIC_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be123c",
  "#4d7c0f",
  "#9333ea",
  "#0f766e",
  "#b45309",
  "#475569",
  "#c026d3",
];
const LEAF_COLORS = [
  "#334155",
  "#a16207",
  "#7c2d12",
  "#581c87",
  "#0f766e",
  "#9f1239",
  "#1e3a8a",
  "#365314",
  "#7f1d1d",
  "#4c1d95",
];

modeInputs.forEach((input) => input.addEventListener("change", updateMode));
fields.useMultiPlanar.addEventListener("change", updateMode);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  render(calculate(readInput()));
});

Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => {
    updateTwinPortState();
    if (form.reportValidity()) render(calculate(readInput()));
  });
});

outputs.zoomIn.addEventListener("click", () => setDiagramZoom(diagramZoom + DIAGRAM_ZOOM_STEP));
outputs.zoomOut.addEventListener("click", () => setDiagramZoom(diagramZoom - DIAGRAM_ZOOM_STEP));
outputs.zoomReset.addEventListener("click", () => resetDiagramView());
outputs.zoomCenter.addEventListener("click", () => centerDiagramView());
outputs.zoomFit.addEventListener("click", () => fitDiagramView());
outputs.viewFull.addEventListener("click", () => setDiagramViewMode("full"));
outputs.viewWrapped.addEventListener("click", () => setDiagramViewMode("wrapped"));
outputs.viewSummary.addEventListener("click", () => setDiagramViewMode("summary"));
outputs.openDiagramWindow.addEventListener("click", () => openDiagramWindow());
outputs.exportSvg.addEventListener("click", () => exportDiagramSvg());
outputs.exportPng.addEventListener("click", () => exportDiagramPng());
outputs.exportPptx.addEventListener("click", () => exportDiagramPptx());
outputs.openPortMapWindow.addEventListener("click", () => openPortMapWindow());
outputs.exportPdf.addEventListener("click", () => exportPagePdf());
outputs.resetInputs.addEventListener("click", () => resetInputsToDefaults());
window.addEventListener("message", (event) => {
  if (event.data?.type === "leaf-spine-export-pptx") {
    exportDiagramPptx(event.data.viewMode || diagramViewMode);
  }
  if (event.data?.type === "leaf-spine-export-port-map") {
    const actions = {
      excel: exportPortMapExcel,
      ppt: exportPortMapPpt,
    };
    actions[event.data.format]?.();
  }
});
outputs.diagram.addEventListener("wheel", (event) => {
  if (!outputs.diagram.querySelector("svg")) return;
  event.preventDefault();
  setDiagramZoom(diagramZoom + (event.deltaY < 0 ? DIAGRAM_ZOOM_STEP : -DIAGRAM_ZOOM_STEP), {
    x: event.clientX,
    y: event.clientY,
  });
}, { passive: false });
if (window.PointerEvent) {
  outputs.diagram.addEventListener("pointerdown", startDiagramDrag);
  window.addEventListener("pointermove", moveDiagramDrag);
  window.addEventListener("pointerup", endDiagramDrag);
} else {
  outputs.diagram.addEventListener("mousedown", startDiagramDrag);
  window.addEventListener("mousemove", moveDiagramDrag);
  window.addEventListener("mouseup", endDiagramDrag);
}
window.addEventListener("resize", () => applyDiagramTransform());

updateMode();
updateTwinPortState();
render(calculate(readInput()));

function updateMode() {
  const mode = getMode();
  oversubField.classList.toggle("hidden", mode !== "oversubscribed");
  podField.classList.toggle("hidden", !fields.useMultiPlanar.checked);
}

function getMode() {
  return document.querySelector("input[name='topologyMode']:checked").value;
}

function readInput() {
  return {
    serverCount: toInt(fields.serverCount.value),
    serverNicPorts: toInt(fields.serverNicPorts.value),
    serverLinkSpeed: toFloat(fields.serverLinkSpeed.value),
    switchPorts: toInt(fields.switchPorts.value),
    switchLinkSpeed: toFloat(fields.switchLinkSpeed.value),
    useTwinPort: fields.useTwinPort.checked && !fields.useTwinPort.disabled,
    disableUplinkTwinPort: fields.disableUplinkTwinPort.checked && !fields.disableUplinkTwinPort.disabled,
    mode: getMode(),
    targetOversub: toFloat(fields.targetOversub.value),
    useMultiPlanar: fields.useMultiPlanar.checked,
    podServerCount: toInt(fields.podServerCount.value),
  };
}

function resetInputsToDefaults() {
  fields.serverCount.value = "8";
  fields.serverNicPorts.value = "8";
  fields.serverLinkSpeed.value = "400";
  fields.switchPorts.value = "64";
  fields.switchLinkSpeed.value = "400";
  fields.useTwinPort.checked = false;
  fields.disableUplinkTwinPort.checked = false;
  fields.targetOversub.value = "3";
  fields.useMultiPlanar.checked = false;
  fields.podServerCount.value = "64";
  modeInputs.forEach((input) => {
    input.checked = input.value === "nonblocking";
  });
  updateMode();
  updateTwinPortState();
  setDiagramViewMode("full");
  render(calculate(readInput()));
}

function updateTwinPortState() {
  const switchSpeed = Number.parseFloat(fields.switchLinkSpeed.value) || 0;
  const disabled = switchSpeed < 200;
  fields.useTwinPort.disabled = disabled;
  if (disabled) fields.useTwinPort.checked = false;
  fields.useTwinPort.closest("label")?.classList.toggle("is-disabled", disabled);
  const uplinkOptionDisabled = disabled || !fields.useTwinPort.checked;
  fields.disableUplinkTwinPort.disabled = uplinkOptionDisabled;
  if (uplinkOptionDisabled) fields.disableUplinkTwinPort.checked = false;
  fields.disableUplinkTwinPort.closest("label")?.classList.toggle("is-disabled", uplinkOptionDisabled);
  updateTwinPortLabel();
}

function updateTwinPortLabel() {
  if (!twinPortLabel) return;
  twinPortLabel.textContent = `${getTwinPortSpeedText()} Twin-port Transceiver 사용`;
}

function getTwinPortSpeedText() {
  const perLaneSpeed = Math.max(1, Number.parseFloat(fields.switchLinkSpeed.value) || 1) / 2;
  return `2x${formatSpeedValue(perLaneSpeed)} Gbps`;
}

function formatSpeedValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function toInt(value) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function toFloat(value) {
  return Math.max(1, Number.parseFloat(value) || 1);
}

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

  for (let leafCount = minimumLeafs; leafCount <= Math.max(maxLeafs, minimumLeafs); leafCount += 1) {
    const downlinks = Math.ceil(totalServerLinks / leafCount);
    const physicalDownlinkPorts = input.useTwinPort
      ? Math.ceil(downlinks / 2)
      : downlinks;
    if (physicalDownlinkPorts >= input.switchPorts) continue;

    const downlinkBandwidth = downlinks * input.serverLinkSpeed;
    const requiredUplinks = input.mode === "nonblocking"
      ? Math.ceil(downlinkBandwidth / switchLogicalLinkSpeed)
      : Math.max(1, Math.ceil(downlinkBandwidth / (targetRatio * switchLogicalLinkSpeed)));
    const uplinksPerLeaf = Math.max(minimumSpines, requiredUplinks);
    const physicalUplinkPortsPerLeaf = Math.ceil(uplinksPerLeaf / uplinkTwinFactor);
    const usedPortsPerLeaf = physicalDownlinkPorts + physicalUplinkPortsPerLeaf;
    const logicalPortsPerLeaf = downlinks + uplinksPerLeaf;
    if (usedPortsPerLeaf > input.switchPorts) continue;

    const totalLeafUplinks = leafCount * uplinksPerLeaf;
    const spinesByPortCapacity = Math.ceil(totalLeafUplinks / (input.switchPorts * uplinkTwinFactor));
    if (leafCount > maxLeafs) continue;

    const uplinkBandwidth = uplinksPerLeaf * switchLogicalLinkSpeed;
    const oversubscription = downlinkBandwidth / uplinkBandwidth;

    if (input.mode === "nonblocking" && oversubscription > 1) continue;
    if (input.mode === "oversubscribed" && oversubscription < 1) continue;
    if (input.mode === "oversubscribed" && oversubscription > targetRatio + 0.0001) continue;

    const minimumFeasibleSpines = Math.max(minimumSpines, spinesByPortCapacity);
    for (let spines = minimumFeasibleSpines; spines <= uplinksPerLeaf; spines += 1) {
      if (leafCount > input.switchPorts * uplinkTwinFactor * spines) continue;
      const logicalLinksPerSpine = Math.ceil(totalLeafUplinks / spines);
      const usedPortsPerSpine = Math.ceil(logicalLinksPerSpine / uplinkTwinFactor);
      if (usedPortsPerSpine > input.switchPorts) continue;

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

function infeasibleResult(input, totalServerLinks) {
  const activeNicPorts = activeServerNicPorts(input);
  return {
    input,
    totalServerLinks,
    serverBandwidth: activeNicPorts * input.serverLinkSpeed,
    totalServerBandwidth: totalServerLinks * input.serverLinkSpeed,
    best: null,
    feasible: false,
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
    return infeasibleResult({ ...input, podServerCount, podCount }, totalServerLinks);
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
  };
}

function render(result) {
  currentResult = result.feasible ? result : null;
  if (!result.feasible) {
    outputs.calculationStatus.classList.remove("hidden");
    outputs.leafCount.textContent = "-";
    outputs.spineCount.textContent = "-";
    outputs.oversubRatio.textContent = "-";
    outputs.totalSwitches.textContent = "-";
    outputs.detailList.innerHTML = "";
    outputs.message.textContent = "현재 입력값으로는 모든 Leaf가 모든 Spine에 연결되는 기본 Leaf-Spine 구성을 만들 수 없습니다. 스위치 포트 수를 늘리거나 서버 링크 수를 줄여 주세요.";
  outputs.diagram.innerHTML = "";
  outputs.diagramCaption.textContent = "";
    resetDiagramView();
    return;
  }

  const { input, best } = result;
  outputs.calculationStatus.classList.add("hidden");
  outputs.leafCount.textContent = best.leafCount;
  outputs.spineCount.textContent = best.spines;
  outputs.oversubRatio.textContent = formatRatio(best.oversubscription);
  outputs.totalSwitches.textContent = best.totalSwitches;

  const totalLeafServerDownlinkBandwidth = result.totalServerBandwidth;
  const totalLeafSpineUplinkBandwidth = best.totalLeafUplinks * effectiveSwitchLinkSpeed(input);
  const cableCounts = calculateCableCounts(input, best);

  const details = [
    ["총 서버 연결 포트", `${result.totalServerLinks.toLocaleString()}개`],
    ["서버당 대역폭", `${formatGbps(result.serverBandwidth)}`],
    ["총 서버 대역폭", `${formatGbps(result.totalServerBandwidth)}`],
    ["전체 Leaf-서버 다운링크", `${result.totalServerLinks.toLocaleString()}개 (${formatGbps(totalLeafServerDownlinkBandwidth)})`],
    ["전체 Leaf-Spine 업링크", `${best.totalLeafUplinks.toLocaleString()}개 (${formatGbps(totalLeafSpineUplinkBandwidth)})`],
    ["서버-Leaf 케이블 수", `${cableCounts.serverLeaf.toLocaleString()}개`],
    ["Leaf-Spine 케이블 수", `${cableCounts.leafSpine.toLocaleString()}개`],
    ["Leaf당 서버 다운링크", `${best.downlinks}개 (${formatGbps(best.leafDownlinkBandwidth)})`],
    ["Leaf당 Spine 업링크", `${best.uplinksPerLeaf}개 (${formatGbps(best.leafUplinkBandwidth)})`],
    ["Leaf당 총 사용 포트", `${best.usedPortsPerLeaf}/${best.switchPortCapacity}개 (논리 ${best.logicalPortsPerLeaf}개)`],
    ["Leaf당 예비 포트", `${best.unusedPortsPerLeaf}개`],
    ["Spine당 Leaf 다운링크", `${best.logicalLinksPerSpine}개 (${formatGbps(best.logicalLinksPerSpine * effectiveSwitchLinkSpeed(input))})`],
    ["Spine당 총 사용 포트", `${best.usedPortsPerSpine}/${best.switchPortCapacity}개 (논리 ${best.logicalLinksPerSpine}개)`],
    ["Spine당 예비 포트", `${best.unusedPortsPerSpine}개`],
    ["전체 Leaf-Spine 링크", `${best.totalLeafUplinks}개`],
    ["Leaf-Spine 연결 방식", `Leaf당 ${best.spines}대 Spine에 총 ${best.uplinksPerLeaf}개 업링크 분산`],
    ["Twin-port Transceiver 사용", input.useTwinPort ? "사용, 서버-Leaf 구간 적용" : "미사용"],
    ["Leaf-Spine Twin-port", input.useTwinPort && input.disableUplinkTwinPort ? "미사용, 업링크 포트 속도 온전히 사용" : (input.useTwinPort ? "사용" : "미사용")],
  ];

  if (input.useMultiPlanar) {
    details.splice(3, 0, ["구성 방식", `Multi-planar design (${best.podCount} pods)`]);
    details.splice(4, 0, ["Pod당 서버 수", `${best.podServerCount}대`]);
    details.splice(5, 0, ["Pod당 Leaf/Spine", `${best.perPodLeafs} Leaf / ${best.perPodSpines} Spine`]);
  }

  outputs.detailList.innerHTML = details
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join("");

  outputs.message.textContent = makeMessage(result);
  outputs.diagram.innerHTML = makeDiagramForView(result);
  applyDiagramTransform();
  updateDiagramViewButtons();
  outputs.diagramCaption.textContent = "";
}

function setDiagramViewMode(mode) {
  diagramViewMode = mode;
  if (currentResult) {
    outputs.diagram.innerHTML = makeDiagramForView(currentResult);
  }
  resetDiagramView();
  updateDiagramViewButtons();
}

function makeDiagramForView(result) {
  return makeDiagramFromGeometry(getDiagramGeometryForView(result, diagramViewMode));
}

function getDiagramGeometryForView(result, viewMode) {
  if (viewMode === "wrapped") return getPptDiagramGeometry(result);
  if (viewMode === "summary") return getSummaryDiagramGeometry(result);
  return getDiagramGeometry(result);
}

function updateDiagramViewButtons() {
  [
    [outputs.viewFull, "full"],
    [outputs.viewWrapped, "wrapped"],
    [outputs.viewSummary, "summary"],
  ].forEach(([button, mode]) => {
    button.classList.toggle("is-active", diagramViewMode === mode);
  });
}

function setDiagramZoom(value, origin = null) {
  const nextZoom = Math.min(MAX_DIAGRAM_ZOOM, Math.max(MIN_DIAGRAM_ZOOM, value));
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;

  if (origin) {
    const beforePoint = clientPointToSvg(svg, origin.x, origin.y);
    diagramZoom = nextZoom;
    const afterPoint = clientPointToSvg(svg, origin.x, origin.y);
    diagramPan.x += beforePoint.x - afterPoint.x;
    diagramPan.y += beforePoint.y - afterPoint.y;
  } else {
    diagramZoom = nextZoom;
  }
  applyDiagramTransform();
}

function resetDiagramView() {
  diagramZoom = 1;
  const svg = outputs.diagram.querySelector("svg");
  diagramPan = svg ? getCenteredDiagramPan(svg) : { x: 0, y: 0 };
  applyDiagramTransform();
}

function centerDiagramView() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  diagramPan = getCenteredDiagramPan(svg);
  applyDiagramTransform();
}

function fitDiagramView() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  const baseWidth = Number(svg.dataset.baseWidth) || DEFAULT_DIAGRAM_VIEW_WIDTH;
  const baseHeight = Number(svg.dataset.baseHeight) || DEFAULT_DIAGRAM_VIEW_HEIGHT;
  const viewWidth = Math.min(DEFAULT_DIAGRAM_VIEW_WIDTH, baseWidth);
  const viewHeight = Math.min(DEFAULT_DIAGRAM_VIEW_HEIGHT, baseHeight);
  diagramZoom = Math.min(MAX_DIAGRAM_ZOOM, Math.max(MIN_DIAGRAM_ZOOM, Math.min(viewWidth / baseWidth, viewHeight / baseHeight)));
  diagramPan = getCenteredDiagramPan(svg);
  applyDiagramTransform();
}

function applyDiagramTransform() {
  outputs.zoomReset.textContent = `${Math.round(diagramZoom * 100)}%`;
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  clampDiagramPan(svg);
  const viewBox = getDiagramViewBox(svg);
  svg.setAttribute("viewBox", `${trim(diagramPan.x)} ${trim(diagramPan.y)} ${trim(viewBox.width)} ${trim(viewBox.height)}`);
}

function startDiagramDrag(event) {
  if (!outputs.diagram.querySelector("svg")) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (!event.pointerType && event.button !== 0) return;
  event.preventDefault();
  if (event.pointerId !== undefined && outputs.diagram.setPointerCapture) {
    outputs.diagram.setPointerCapture(event.pointerId);
  }
  outputs.diagram.classList.add("is-dragging");
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: diagramPan.x,
    panY: diagramPan.y,
  };
}

function moveDiagramDrag(event) {
  if (!dragState) return;
  if (dragState.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
  const svg = outputs.diagram.querySelector("svg");
  const scale = getSvgUnitsPerScreenPixel(svg);
  diagramPan.x = dragState.panX - (event.clientX - dragState.startX) * scale.x;
  diagramPan.y = dragState.panY - (event.clientY - dragState.startY) * scale.y;
  applyDiagramTransform();
}

function endDiagramDrag(event) {
  if (!dragState) return;
  if (dragState.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
  outputs.diagram.classList.remove("is-dragging");
  dragState = null;
}

function clampDiagramPan(svg) {
  const baseWidth = Number(svg.dataset.baseWidth) || 1;
  const baseHeight = Number(svg.dataset.baseHeight) || 1;
  const viewBox = getDiagramViewBox(svg);

  diagramPan.x = clampViewBoxAxis(diagramPan.x, viewBox.width, baseWidth);
  diagramPan.y = clampViewBoxAxis(diagramPan.y, viewBox.height, baseHeight);
}

function clampViewBoxAxis(value, visible, total) {
  const slack = visible * 0.5;
  const min = Math.min(0, total - visible) - slack;
  const max = Math.max(0, total - visible) + slack;
  return Math.min(max, Math.max(min, value));
}

function getDiagramViewBox(svg) {
  const baseWidth = Number(svg.dataset.baseWidth) || DEFAULT_DIAGRAM_VIEW_WIDTH;
  const baseHeight = Number(svg.dataset.baseHeight) || DEFAULT_DIAGRAM_VIEW_HEIGHT;
  const viewWidth = Math.min(DEFAULT_DIAGRAM_VIEW_WIDTH, baseWidth);
  const viewHeight = Math.min(DEFAULT_DIAGRAM_VIEW_HEIGHT, baseHeight);
  return {
    width: viewWidth / diagramZoom,
    height: viewHeight / diagramZoom,
  };
}

function getCenteredDiagramPan(svg) {
  const baseWidth = Number(svg.dataset.baseWidth) || DEFAULT_DIAGRAM_VIEW_WIDTH;
  const baseHeight = Number(svg.dataset.baseHeight) || DEFAULT_DIAGRAM_VIEW_HEIGHT;
  const viewBox = getDiagramViewBox(svg);
  return {
    x: (baseWidth - viewBox.width) / 2,
    y: (baseHeight - viewBox.height) / 2,
  };
}

function clientPointToSvg(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const viewBox = getDiagramViewBox(svg);
  return {
    x: diagramPan.x + ((clientX - rect.left) / Math.max(rect.width, 1)) * viewBox.width,
    y: diagramPan.y + ((clientY - rect.top) / Math.max(rect.height, 1)) * viewBox.height,
  };
}

function getSvgUnitsPerScreenPixel(svg) {
  const rect = svg.getBoundingClientRect();
  const viewBox = getDiagramViewBox(svg);
  return {
    x: viewBox.width / Math.max(rect.width, 1),
    y: viewBox.height / Math.max(rect.height, 1),
  };
}

function formatGbps(value) {
  if (value >= 1000) return `${trim(value / 1000)} Tbps`;
  return `${trim(value)} Gbps`;
}

function formatRatio(value) {
  if (value <= 1.0001) return "1:1";
  return `1:${trim(value)}`;
}

function trim(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function makeExportTimestamp(date = new Date()) {
  exportSequence = (exportSequence + 1) % 100;
  return {
    compact: `${formatCompactTimestamp(date)}-${String(exportSequence).padStart(2, "0")}`,
    display: formatDisplayTimestamp(date),
  };
}

function exportFilename(prefix, extension, timestamp = makeExportTimestamp()) {
  return `${prefix}-${timestamp.compact}.${extension}`;
}

function formatCompactTimestamp(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function formatDisplayTimestamp(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function makeMessage({ input, best }) {
  const parts = [];
  if (input.useMultiPlanar) {
    parts.push(`Multi-planar design으로 ${best.podCount}개의 독립 Leaf-Spine pod를 계산했습니다. 각 pod는 선택한 ${input.mode === "oversubscribed" ? "oversubscribed" : "non-blocking"} 조건을 그대로 적용합니다.`);
  } else if (input.mode === "nonblocking") {
    parts.push("Non-blocking 조건으로 Leaf의 업링크 대역폭이 다운링크 대역폭 이상이 되도록 계산했습니다.");
  } else {
    parts.push(`목표 1:${trim(input.targetOversub)} 이하에서 스위치 수가 가장 적은 oversubscribed 구성을 선택했습니다.`);
  }
  if (input.serverLinkSpeed > effectiveSwitchLinkSpeed(input)) {
    parts.push("서버 링크 스피드가 스위치 포트 스피드보다 높아 실제 구성에서는 포트 호환성을 별도로 확인해야 합니다.");
  }
  if (best.leafCount === best.switchPortCapacity) {
    parts.push("Spine 포트가 모두 Leaf 연결에 사용되므로 확장 여유가 거의 없습니다.");
  }
  return parts.join(" ");
}

function makeDiagram({ input, best }) {
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const switchW = 116;
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const serverSlotWidth = Math.max(86, serverW + 14);
  const leafSlotWidth = Math.max(120, switchW + 12);
  const serverSlots = Math.max(shownServers, shownLeafs);
  const width = Math.max(920, labelGutter + serverSlots * Math.max(serverSlotWidth, leafSlotWidth) + 150);
  const height = 500;
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const spineY = 58;
  const leafY = 190;
  const serverY = 360;
  const spineXs = distribute(center, shownSpines, 126);
  const leafXs = distribute(center, shownLeafs, Math.max(120, Math.min(160, width / Math.max(shownLeafs, 1) * 0.8)));
  const serverXs = distribute(center, shownServers, Math.max(serverSlotWidth, Math.min(104, width / Math.max(shownServers, 1) * 0.8)));
  const lines = [];
  const nodes = [];

  spineXs.forEach((x, i) => {
    nodes.push(switchNode("spine", x, spineY, switchW, switchH, `Spine ${i + 1}`));
  });

  leafXs.forEach((leafX, leafIndex) => {
    spineXs.forEach((spineX, spineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, best.spines, spineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push(line(
          leafX + offset,
          leafY - switchH / 2,
          spineX + offset,
          spineY + switchH / 2,
          "uplink",
          {
            stroke: leafColor(leafIndex),
            title: `Leaf ${leafIndex + 1} uplink`,
          },
        ));
      }
    });

    nodes.push(switchNode("leaf", leafX, leafY, switchW, switchH, `Leaf ${leafIndex + 1}`));
  });

  serverXs.forEach((serverX, serverIndex) => {
    const serverNumber = serverIndex + 1;
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;

    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = (nicLeafStart + nicIndex) % shownLeafs;
      const nicX = nicPortX(serverX, serverW, input.serverNicPorts, nicIndex);
      lines.push(line(
        nicX,
        serverY - serverH / 2,
        leafXs[leafIndex],
        leafY + switchH / 2,
        "link",
        {
          stroke: nicColor(nicIndex),
          title: `Server NIC ${nicIndex + 1}`,
        },
      ));
    }

    nodes.push(serverNode(serverX, serverY, serverW, serverH, serverNumber, input.serverNicPorts));
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" data-base-width="${width}" data-base-height="${height}" role="img">
      <title>Leaf-Spine 네트워크 구성도</title>
      ${lines.join("")}
      ${nodes.join("")}
    </svg>
  `;
}

function makeDiagramFromGeometry(geometry) {
  const lines = geometry.lines.map((item) => line(
    item.x1,
    item.y1,
    item.x2,
    item.y2,
    item.kind || "link",
    { stroke: item.color, title: item.title },
  ));
  const nodes = [
    ...geometry.switches.map((sw) => switchNode(sw.kind, sw.x, sw.y, sw.w, sw.h, sw.label)),
    ...geometry.servers.map((server) => serverNode(server.x, server.y, server.w, server.h, server.number, server.nicCount, server.label)),
    ...(geometry.ellipsis || []).map((item) => ellipsisNode(item.x, item.y, item.w, item.h, item.label)),
  ];

  return `
    <svg viewBox="0 0 ${geometry.width} ${geometry.height}" data-base-width="${geometry.width}" data-base-height="${geometry.height}" role="img">
      <title>Leaf-Spine network topology</title>
      ${lines.join("")}
      ${nodes.join("")}
    </svg>
  `;
}

async function exportDiagramPng() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;

  const { clone, width, height } = makeExportSvgClone(svg);

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  const scale = 2;

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (blob) downloadBlob(blob, exportFilename("leaf-spine-topology", "png"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function exportDiagramSvg() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  const { clone } = makeExportSvgClone(svg);
  const svgText = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, exportFilename("leaf-spine-topology", "svg"));
}

async function exportPagePdf() {
  if (!currentResult) return;
  const button = outputs.exportPdf;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "저장 중...";

  try {
    const generatedAt = makeExportTimestamp();
    const canvas = await renderReportCanvas(generatedAt.display);
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
    const pdfBlob = await makePdfFromImageBlob(jpegBlob, canvas.width, canvas.height);
    downloadBlob(pdfBlob, exportFilename("leaf-spine-topology-report", "pdf", generatedAt));
  } catch (error) {
    console.error(error);
    alert("PDF 파일을 만드는 중 오류가 발생했습니다.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function renderReportCanvas(generatedAtText = formatDisplayTimestamp(new Date())) {
  const svgText = makeReportSvg(generatedAtText);
  const { width, height } = getReportSvgSize(svgText);
  const scale = Math.min(2, Math.max(0.5, 8192 / Math.max(width, height)));
  const image = await loadSvgImage(svgText);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#eef5ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function makeReportSvg(generatedAtText = formatDisplayTimestamp(new Date())) {
  const pageWidth = 1320;
  const pageHeight = 1867;
  const margin = 20;
  const gap = 18;
  const sidebarW = 340;
  const contentX = margin + sidebarW + gap;
  const contentW = pageWidth - contentX - margin;
  const sidebarRows = getReportInputRows();
  const detailRows = getReportDetailRows();
  const metrics = getReportMetrics();
  const sidebarDividerY = margin + 80;
  const sidebarTopRowsY = margin + 108;
  const sidebarH = 126 + sidebarRows.length * 38;
  const metricH = 92;
  const detailH = Math.max(142, 58 + Math.ceil(detailRows.length / 2) * 28);
  const diagramH = Math.min(760, pageHeight - (margin + metricH + gap + detailH + gap) - margin);
  const diagramY = margin + metricH + gap + detailH + gap;
  const diagramSvg = makeVisibleDiagramSvgMarkup(contentW - 32, diagramH - 68);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">
      <style>
        svg { font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif; }
        .title { fill: #2563eb; font-size: 28px; font-weight: 900; text-anchor: middle; }
        .section { fill: #1d4ed8; font-size: 13px; font-weight: 900; }
        .label { fill: #5b6b86; font-size: 12px; font-weight: 800; }
        .value { fill: #0f172a; font-size: 13px; font-weight: 800; }
        .metric-label { fill: #5b6b86; font-size: 12px; font-weight: 900; }
        .metric-value { fill: #0f172a; font-size: 26px; font-weight: 900; }
        .panel-title { fill: #0f172a; font-size: 17px; font-weight: 900; }
      </style>
      <rect width="100%" height="100%" fill="#eef5ff"/>
      ${reportPanel(margin, margin, sidebarW, sidebarH)}
      <text class="title" x="${margin + sidebarW / 2}" y="${margin + 38}">Leaf-Spine Planner</text>
      <text class="label" x="${margin + sidebarW / 2 + 116}" y="${margin + 60}" text-anchor="end">Created by 임채성 ${escapeXml(generatedAtText)}</text>
      <line x1="${margin + 20}" y1="${sidebarDividerY}" x2="${margin + sidebarW - 20}" y2="${sidebarDividerY}" stroke="#c8d8ee" stroke-width="1"/>
      ${reportRows(sidebarRows, margin + 20, sidebarTopRowsY, sidebarW - 40)}
      ${metrics.map((item, index) => reportMetricCard(contentX + index * ((contentW - 36) / 4 + 12), margin, (contentW - 36) / 4, metricH, item)).join("")}
      ${reportPanel(contentX, margin + metricH + gap, contentW, detailH)}
      <text class="panel-title" x="${contentX + 20}" y="${margin + metricH + gap + 32}">계산 결과</text>
      ${reportDetailRows(detailRows, contentX + 20, margin + metricH + gap + 58, contentW - 40)}
      ${reportPanel(contentX, diagramY, contentW, diagramH)}
      <text class="panel-title" x="${contentX + 20}" y="${diagramY + 32}">네트워크 구성도</text>
      <g transform="translate(${contentX + 16} ${diagramY + 52})">${diagramSvg}</g>
    </svg>
  `;
}

function getReportSvgSize(svgText) {
  const width = Number(svgText.match(/width="(\d+(?:\.\d+)?)"/)?.[1]) || 1320;
  const height = Number(svgText.match(/height="(\d+(?:\.\d+)?)"/)?.[1]) || 900;
  return { width, height };
}

function reportPanel(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fff" stroke="#c8d8ee"/>`;
}

function reportMetricCard(x, y, w, h, item) {
  return `
    ${reportPanel(x, y, w, h)}
    <text class="metric-label" x="${x + 16}" y="${y + 28}">${escapeXml(item.label)}</text>
    <text class="metric-value" x="${x + 16}" y="${y + 66}">${escapeXml(item.value)}</text>
  `;
}

function reportRows(rows, x, y, width) {
  let cursorY = y;
  return rows.map((row) => {
    if (row.type === "section") {
      const markup = `<text class="section" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>`;
      cursorY += 28;
      return markup;
    }
    const valueX = x + width * 0.52;
    const markup = `
      <text class="label" x="${x}" y="${cursorY}">${escapeXml(row.label)}</text>
      <text class="value" x="${valueX}" y="${cursorY}">${escapeXml(row.value)}</text>
    `;
    cursorY += 38;
    return markup;
  }).join("");
}

function reportDetailRows(rows, x, y, width) {
  const columnW = width / 2;
  return rows.map((row, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    const rowX = x + column * columnW;
    const rowY = y + line * 28;
    return `
      <text class="label" x="${rowX}" y="${rowY}">${escapeXml(row.label)}</text>
      <text class="value" x="${rowX + columnW * 0.45}" y="${rowY}">${escapeXml(row.value)}</text>
    `;
  }).join("");
}

function getReportInputRows() {
  return [
    { type: "section", label: "서버" },
    { label: "서버 대수", value: fields.serverCount.value },
    { label: "서버 NIC 포트 수", value: fields.serverNicPorts.value },
    { label: "서버 NIC 링크 스피드", value: `${fields.serverLinkSpeed.value} Gbps` },
    { type: "section", label: "스위치" },
    { label: "스위치 포트 수", value: fields.switchPorts.value },
    { label: "스위치 링크 스피드", value: `${fields.switchLinkSpeed.value} Gbps` },
    { label: "Twin-port Transceiver", value: fields.useTwinPort.checked ? `${getTwinPortSpeedText()} 사용` : "미사용" },
    { label: "Leaf-Spine Twin-port", value: fields.useTwinPort.checked && fields.disableUplinkTwinPort.checked ? "미사용" : (fields.useTwinPort.checked ? "사용" : "미사용") },
    { type: "section", label: "구성 방식" },
    { label: "Topology", value: getMode() === "oversubscribed" ? "Oversubscribed" : "Non-blocking" },
    { label: "Multi-planar Design", value: fields.useMultiPlanar.checked ? "사용" : "미사용" },
    ...(fields.useMultiPlanar.checked ? [{ label: "Pod당 서버 수", value: fields.podServerCount.value }] : []),
  ];
}

function getReportMetrics() {
  return [
    { label: "Leaf 스위치", value: outputs.leafCount.textContent },
    { label: "Spine 스위치", value: outputs.spineCount.textContent },
    { label: "Oversub 비율", value: outputs.oversubRatio.textContent },
    { label: "총 스위치", value: outputs.totalSwitches.textContent },
  ];
}

function getReportDetailRows() {
  const terms = [...outputs.detailList.querySelectorAll("dt")];
  const descriptions = [...outputs.detailList.querySelectorAll("dd")];
  return terms.map((term, index) => ({
    label: term.textContent,
    value: descriptions[index]?.textContent || "",
  }));
}

function makeVisibleDiagramSvgMarkup(width, height) {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return "";
  const clone = svg.cloneNode(true);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.insertBefore(makePngSvgStyleElement(), clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

async function loadSvgImage(svgText) {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Report SVG image load failed."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed."));
    }, type, quality);
  });
}

async function makePdfFromImageBlob(imageBlob, imageWidth, imageHeight) {
  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const imageRatio = imageWidth / imageHeight;
  const pageRatio = pageWidth / pageHeight;
  const drawWidth = imageRatio > pageRatio ? pageWidth : pageHeight * imageRatio;
  const drawHeight = imageRatio > pageRatio ? pageWidth / imageRatio : pageHeight;
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = pageHeight - drawHeight;
  const content = `q\n${trim(drawWidth)} 0 0 ${trim(drawHeight)} ${trim(drawX)} ${trim(drawY)} cm\n/Im0 Do\nQ`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${trim(pageWidth)} ${trim(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    {
      header: `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>`,
      bytes: imageBytes,
    },
    `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  return buildPdf(objects);
}

function buildPdf(objects) {
  const chunks = [];
  const offsets = [0];
  let position = 0;
  const appendText = (text) => {
    const bytes = new TextEncoder().encode(text);
    chunks.push(bytes);
    position += bytes.length;
  };
  const appendBytes = (bytes) => {
    chunks.push(bytes);
    position += bytes.length;
  };

  appendText("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  objects.forEach((object, index) => {
    offsets[index + 1] = position;
    appendText(`${index + 1} 0 obj\n`);
    if (typeof object === "string") {
      appendText(`${object}\n`);
    } else {
      appendText(`${object.header}\nstream\n`);
      appendBytes(object.bytes);
      appendText("\nendstream\n");
    }
    appendText("endobj\n");
  });

  const xrefOffset = position;
  appendText(`xref\n0 ${objects.length + 1}\n`);
  appendText("0000000000 65535 f \n");
  for (let index = 1; index <= objects.length; index += 1) {
    appendText(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  appendText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

function openDiagramWindow() {
  if (!currentResult) return;
  const variants = {
    full: makeExportSvgDataFromMarkup(makeDiagramFromGeometry(getDiagramGeometry(currentResult))),
    wrapped: makeExportSvgDataFromMarkup(makeDiagramFromGeometry(getPptDiagramGeometry(currentResult))),
    summary: makeExportSvgDataFromMarkup(makeDiagramFromGeometry(getSummaryDiagramGeometry(currentResult))),
  };
  const initialView = diagramViewMode;
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Leaf-Spine 구성도</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #eef5ff;
        font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif;
      }
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid #c8d8ee;
        background: rgba(255, 255, 255, 0.94);
      }
      .actions {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      button {
        min-height: 30px;
        min-width: 42px;
        border: 1px solid #c8d8ee;
        border-radius: 6px;
        background: #fff;
        color: #1d4ed8;
        font: inherit;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
      }
      button:hover { background: #dbeafe; }
      button.is-active {
        background: #2563eb;
        border-color: #2563eb;
        color: #fff;
      }
      .toolbar strong {
        color: #0f172a;
        font-size: 16px;
      }
      .viewer {
        width: 100vw;
        height: calc(100vh - 55px);
        overflow: hidden;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        background: #eef5ff;
      }
      .viewer.is-dragging {
        cursor: grabbing;
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        background: #f8fbff;
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <strong>네트워크 구성도</strong>
      <div class="actions">
        <button id="viewFull" type="button">전체</button>
        <button id="viewWrapped" type="button">줄바꿈</button>
        <button id="viewSummary" type="button">요약</button>
        <button id="zoomOut" type="button">-</button>
        <button id="zoomReset" type="button">100%</button>
        <button id="zoomIn" type="button">+</button>
        <button id="zoomCenter" type="button" title="가운데 정렬" aria-label="가운데 정렬">◎</button>
        <button id="zoomFit" type="button" title="화면에 맞춤" aria-label="화면에 맞춤">▣</button>
        <button id="downloadSvg" type="button">SVG</button>
        <button id="downloadPng" type="button">PNG</button>
        <button id="downloadPpt" type="button">PPT</button>
        <button id="openPortMap" type="button">Port Map</button>
      </div>
    </div>
    <div id="viewer" class="viewer"></div>
    <script>
      const variants = ${JSON.stringify(variants)};
      const defaultViewWidth = 920;
      const defaultViewHeight = 500;
      const minZoom = 0.1;
      const maxZoom = 10;
      const zoomStep = 0.05;
      const viewer = document.querySelector("#viewer");
      const zoomReset = document.querySelector("#zoomReset");
      let svg = null;
      let baseWidth = 1;
      let baseHeight = 1;
      let viewMode = ${JSON.stringify(initialView)};
      let zoom = 1;
      let pan = { x: 0, y: 0 };
      let drag = null;

      function trim(value) {
        return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "");
      }

      function viewBoxSize() {
        return {
          width: Math.min(defaultViewWidth, baseWidth) / zoom,
          height: Math.min(defaultViewHeight, baseHeight) / zoom,
        };
      }

      function clampAxis(value, visible, total) {
        const slack = visible * 0.5;
        const min = Math.min(0, total - visible) - slack;
        const max = Math.max(0, total - visible) + slack;
        return Math.min(max, Math.max(min, value));
      }

      function applyView() {
        zoomReset.textContent = Math.round(zoom * 100) + "%";
        if (!svg) return;
        const size = viewBoxSize();
        pan.x = clampAxis(pan.x, size.width, baseWidth);
        pan.y = clampAxis(pan.y, size.height, baseHeight);
        svg.setAttribute("viewBox", trim(pan.x) + " " + trim(pan.y) + " " + trim(size.width) + " " + trim(size.height));
      }

      function clientPointToSvg(clientX, clientY) {
        const rect = svg.getBoundingClientRect();
        const size = viewBoxSize();
        return {
          x: pan.x + ((clientX - rect.left) / Math.max(rect.width, 1)) * size.width,
          y: pan.y + ((clientY - rect.top) / Math.max(rect.height, 1)) * size.height,
        };
      }

      function unitsPerPixel() {
        const rect = svg.getBoundingClientRect();
        const size = viewBoxSize();
        return {
          x: size.width / Math.max(rect.width, 1),
          y: size.height / Math.max(rect.height, 1),
        };
      }

      function setZoom(nextZoom, origin) {
        nextZoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));
        if (origin) {
          const before = clientPointToSvg(origin.x, origin.y);
          zoom = nextZoom;
          const after = clientPointToSvg(origin.x, origin.y);
          pan.x += before.x - after.x;
          pan.y += before.y - after.y;
        } else {
          zoom = nextZoom;
        }
        applyView();
      }

      function resetView() {
        zoom = 1;
        pan = centeredPan();
        applyView();
      }

      function centerView() {
        pan = centeredPan();
        applyView();
      }

      function fitView() {
        zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(defaultViewWidth / baseWidth, defaultViewHeight / baseHeight)));
        pan = centeredPan();
        applyView();
      }

      function centeredPan() {
        if (!svg) return { x: 0, y: 0 };
        const size = viewBoxSize();
        return {
          x: (baseWidth - size.width) / 2,
          y: (baseHeight - size.height) / 2,
        };
      }

      function startDrag(event) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        if (event.pointerId !== undefined && viewer.setPointerCapture) viewer.setPointerCapture(event.pointerId);
        viewer.classList.add("is-dragging");
        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
      }

      function moveDrag(event) {
        if (!drag) return;
        if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
        const scale = unitsPerPixel();
        pan.x = drag.panX - (event.clientX - drag.startX) * scale.x;
        pan.y = drag.panY - (event.clientY - drag.startY) * scale.y;
        applyView();
      }

      function endDrag(event) {
        if (!drag) return;
        if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
        viewer.classList.remove("is-dragging");
        drag = null;
      }

      function exportClone() {
        const clone = svg.cloneNode(true);
        clone.setAttribute("viewBox", "0 0 " + baseWidth + " " + baseHeight);
        clone.setAttribute("width", baseWidth);
        clone.setAttribute("height", baseHeight);
        return clone;
      }

      function setViewMode(mode) {
        viewMode = mode;
        viewer.innerHTML = variants[mode].svg;
        svg = viewer.querySelector("svg");
        baseWidth = variants[mode].width;
        baseHeight = variants[mode].height;
        document.querySelector("#viewFull").classList.toggle("is-active", mode === "full");
        document.querySelector("#viewWrapped").classList.toggle("is-active", mode === "wrapped");
        document.querySelector("#viewSummary").classList.toggle("is-active", mode === "summary");
        resetView();
      }

      function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      function downloadSvg() {
        const text = new XMLSerializer().serializeToString(exportClone());
    downloadBlob(new Blob([text], { type: "image/svg+xml;charset=utf-8" }), exportFilename("leaf-spine-topology", "svg"));
      }

      async function downloadPng() {
        const clone = exportClone();
        const text = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const image = new Image();
        const scale = 2;
        try {
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
          });
          const canvas = document.createElement("canvas");
          canvas.width = baseWidth * scale;
          canvas.height = baseHeight * scale;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#f8fbff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
          if (blob) downloadBlob(blob, exportFilename("leaf-spine-topology", "png"));
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - zoomStep));
      document.querySelector("#zoomReset").addEventListener("click", resetView);
      document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + zoomStep));
      document.querySelector("#zoomCenter").addEventListener("click", centerView);
      document.querySelector("#zoomFit").addEventListener("click", fitView);
      document.querySelector("#viewFull").addEventListener("click", () => setViewMode("full"));
      document.querySelector("#viewWrapped").addEventListener("click", () => setViewMode("wrapped"));
      document.querySelector("#viewSummary").addEventListener("click", () => setViewMode("summary"));
      document.querySelector("#downloadSvg").addEventListener("click", downloadSvg);
      document.querySelector("#downloadPng").addEventListener("click", downloadPng);
      document.querySelector("#downloadPpt").addEventListener("click", () => {
        if (!window.opener) {
          alert("메인 페이지와 연결되어 있지 않아 PPT를 만들 수 없습니다.");
          return;
        }
        try {
          if (typeof window.opener.exportDiagramPptx === "function") {
            window.opener.exportDiagramPptx(viewMode);
            return;
          }
        } catch (error) {
          // Fall back to postMessage below when direct opener access is blocked.
        }
        window.opener.postMessage({ type: "leaf-spine-export-pptx", viewMode }, "*");
      });
      document.querySelector("#openPortMap").addEventListener("click", () => {
        if (window.opener && typeof window.opener.openPortMapWindow === "function") {
          window.opener.openPortMapWindow();
        }
      });
      viewer.addEventListener("wheel", (event) => {
        event.preventDefault();
        setZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), { x: event.clientX, y: event.clientY });
      }, { passive: false });
      viewer.addEventListener("pointerdown", startDrag);
      window.addEventListener("pointermove", moveDrag);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("resize", applyView);
      setViewMode(viewMode);
    </script>
  </body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "width=1280,height=800,scrollbars=yes,resizable=yes");
  if (!popup) {
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function makeExportSvgDataFromMarkup(markup) {
  const container = document.createElement("div");
  container.innerHTML = markup;
  const svg = container.querySelector("svg");
  const { clone, width, height } = makeExportSvgClone(svg);
  return {
    svg: new XMLSerializer().serializeToString(clone),
    width,
    height,
  };
}

function openPortMapWindow() {
  if (!currentResult) return;
  const portMap = buildPortMap(currentResult);
  const html = makePortMapHtml(portMap);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "width=1280,height=820,scrollbars=yes,resizable=yes");
  if (!popup) {
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

window.openPortMapWindow = openPortMapWindow;

function buildPortMap({ input, best }) {
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const perPodSpines = best.perPodSpines || best.spines;
  const podServerCount = best.podServerCount || input.serverCount;
  const activeNicPorts = activeServerNicPorts(input);
  const serverLeafTwinFactor = input.useTwinPort ? 2 : 1;
  const uplinkTwinFactor = leafSpineTwinFactor(input);
  const leafServerPortCounters = Array.from({ length: best.leafCount }, () => 0);
  const spinePortCounters = Array.from({ length: best.spines }, () => 0);
  const serverLeafRows = [];
  const leafSpineRows = [];

  for (let serverIndex = 0; serverIndex < input.serverCount; serverIndex += 1) {
    const podIndex = input.useMultiPlanar ? Math.floor(serverIndex / podServerCount) : 0;
    const localServerIndex = input.useMultiPlanar ? serverIndex % podServerCount : serverIndex;
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = input.useMultiPlanar
        ? podIndex * perPodLeafs + ((localServerIndex * activeNicPorts + nicIndex) % perPodLeafs)
        : ((serverIndex * activeNicPorts + nicIndex) % best.leafCount);
      const leafLogicalPort = leafServerPortCounters[leafIndex];
      leafServerPortCounters[leafIndex] += 1;
      serverLeafRows.push({
        podIndex,
        pod: podLabel(podIndex, podCount),
        section: "Server-Leaf",
        sourceDevice: `Server ${serverIndex + 1}`,
        sourcePort: `NIC ${nicIndex + 1}`,
        targetDevice: leafLabel(leafIndex, perPodLeafs, podCount),
        targetPort: switchDownlinkPortLabel(leafLogicalPort, serverLeafTwinFactor),
        speed: `${formatGbps(input.serverLinkSpeed)}`,
        group: `NIC ${nicIndex + 1}`,
      });
    }
  }

  for (let leafIndex = 0; leafIndex < best.leafCount; leafIndex += 1) {
    const podIndex = input.useMultiPlanar ? Math.floor(leafIndex / perPodLeafs) : 0;
    const leafUplinkStart = best.downlinks + 1;
    for (let localSpineIndex = 0; localSpineIndex < perPodSpines; localSpineIndex += 1) {
      const spineIndex = podIndex * perPodSpines + localSpineIndex;
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      const priorLinks = priorLinksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const leafPort = leafUplinkStart + priorLinks + linkIndex;
        spinePortCounters[spineIndex] += 1;
        leafSpineRows.push({
          podIndex,
          pod: podLabel(podIndex, podCount),
          section: "Leaf-Spine",
          sourceDevice: leafLabel(leafIndex, perPodLeafs, podCount),
          sourcePort: switchPortLabel(leafPort - 1, uplinkTwinFactor),
          targetDevice: spineLabel(spineIndex, perPodSpines, podCount),
          targetPort: switchPortLabel(spinePortCounters[spineIndex] - 1, uplinkTwinFactor),
          speed: `${formatGbps(effectiveSwitchLinkSpeed(input))}`,
          group: `Leaf ${leafIndex + 1}`,
        });
      }
    }
  }

  return {
    input,
    best,
    summary: [
      ["Servers", input.serverCount.toLocaleString()],
      ["Server NIC Ports", input.serverNicPorts.toLocaleString()],
      ["Leaf Switches", best.leafCount.toLocaleString()],
      ["Spine Switches", best.spines.toLocaleString()],
      ["Pods", podCount.toLocaleString()],
      ["Total Links", (serverLeafRows.length + leafSpineRows.length).toLocaleString()],
    ],
    serverLeafRows,
    leafSpineRows,
  };
}

function priorLinksForSpine(uplinksPerLeaf, spineCount, spineIndex) {
  let total = 0;
  for (let index = 0; index < spineIndex; index += 1) {
    total += linksForSpine(uplinksPerLeaf, spineCount, index);
  }
  return total;
}

function switchDownlinkPortLabel(logicalPortIndex, twinFactor) {
  return switchPortLabel(logicalPortIndex, twinFactor);
}

function switchPortLabel(logicalPortIndex, twinFactor) {
  if (twinFactor <= 1) return `Port ${logicalPortIndex + 1}`;
  const lane = logicalPortIndex % twinFactor === 0 ? "A" : "B";
  return `Port ${Math.floor(logicalPortIndex / twinFactor) + 1}${lane}`;
}

function podLabel(podIndex, podCount) {
  return podCount > 1 ? `Pod ${podIndex + 1}` : "-";
}

function leafLabel(leafIndex, perPodLeafs, podCount) {
  if (podCount > 1) return `Pod ${Math.floor(leafIndex / perPodLeafs) + 1} Leaf ${(leafIndex % perPodLeafs) + 1}`;
  return `Leaf ${leafIndex + 1}`;
}

function spineLabel(spineIndex, perPodSpines, podCount) {
  if (podCount > 1) return `Pod ${Math.floor(spineIndex / perPodSpines) + 1} Spine ${(spineIndex % perPodSpines) + 1}`;
  return `Spine ${spineIndex + 1}`;
}

function makePortMapHtml(portMap) {
  const rows = [...portMap.serverLeafRows, ...portMap.leafSpineRows];
  const maxRowsWithoutWarning = 12000;
  const warning = rows.length > maxRowsWithoutWarning
    ? `<p class="notice">포트맵 행이 ${rows.length.toLocaleString()}개입니다. 브라우저에서 검색은 가능하지만, 대규모 구성에서는 표시가 다소 느릴 수 있습니다.</p>`
    : "";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Leaf-Spine Port Map</title>
    <style>
      * { box-sizing: border-box; }
      html,
      body {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      body {
        margin: 0;
        background: #eef5ff;
        color: #0f172a;
        font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif;
        display: flex;
        flex-direction: column;
      }
      header {
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 22px 14px;
        border-bottom: 1px solid #c8d8ee;
        background: rgba(255, 255, 255, 0.96);
        flex: 0 0 auto;
      }
      .title-lockup {
        display: inline-grid;
        justify-items: end;
      }
      h1 {
        margin: 0;
        color: #2563eb;
        font-size: 24px;
        line-height: 1.2;
      }
      .credit {
        margin-top: 3px;
        color: #5b6b86;
        font-size: 12px;
        font-weight: 800;
      }
      .actions {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      button {
        min-height: 32px;
        border: 1px solid #c8d8ee;
        border-radius: 6px;
        background: #fff;
        color: #1d4ed8;
        font: inherit;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
        padding: 0 12px;
      }
      button:hover {
        background: #dbeafe;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(6, minmax(120px, 1fr));
        gap: 8px;
        padding: 14px 22px;
        flex: 0 0 auto;
      }
      .metric {
        border: 1px solid #c8d8ee;
        border-radius: 8px;
        background: #fff;
        padding: 10px 12px;
      }
      .metric span {
        display: block;
        color: #5b6b86;
        font-size: 11px;
        font-weight: 900;
      }
      .metric strong {
        display: block;
        margin-top: 4px;
        font-size: 18px;
      }
      main {
        padding: 0 22px 22px;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .notice {
        margin: 0 0 10px;
        color: #92400e;
        font-size: 13px;
        font-weight: 800;
        flex: 0 0 auto;
      }
      .table-wrap {
        overflow: auto;
        flex: 1 1 auto;
        min-height: 0;
        border: 1px solid #c8d8ee;
        border-radius: 8px;
        background: #fff;
      }
      table {
        width: 100%;
        min-width: 1040px;
        border-collapse: separate;
        border-spacing: 0;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 12px;
        text-align: left;
      }
      th,
      td {
        padding: 9px 10px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
        font-size: 13px;
      }
      tbody tr:nth-child(even) td { background: #f8fbff; }
      tbody tr:hover td { background: #eff6ff; }
      .section {
        font-weight: 900;
      }
      .section-server-leaf {
        color: #1d4ed8;
      }
      .section-leaf-spine {
        color: #8a4b12;
      }
      .pod-cell {
        font-weight: 900;
      }
      @media (max-width: 900px) {
        .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="title-lockup">
        <h1>Leaf-Spine Port Map</h1>
        <div class="credit">Created by 임채성</div>
      </div>
      <div class="actions">
        <button id="exportPortMapExcel" type="button">Excel</button>
        <button id="exportPortMapPpt" type="button">PPT</button>
      </div>
    </header>
    <section class="summary">
      ${portMap.summary.map(([label, value]) => `<div class="metric"><span>${escapeXml(label)}</span><strong>${escapeXml(value)}</strong></div>`).join("")}
    </section>
    <main>
      ${warning}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>구간</th>
              <th>Pod</th>
              <th>출발 장비</th>
              <th>출발 포트</th>
              <th>도착 장비</th>
              <th>도착 포트</th>
              <th>속도</th>
              <th>그룹</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="section ${portMapSectionClass(row.section)}">${escapeXml(row.section)}</td>
                <td class="pod-cell" style="${portMapPodStyle(row)}">${escapeXml(row.pod)}</td>
                <td>${escapeXml(row.sourceDevice)}</td>
                <td>${escapeXml(row.sourcePort)}</td>
                <td>${escapeXml(row.targetDevice)}</td>
                <td>${escapeXml(row.targetPort)}</td>
                <td>${escapeXml(row.speed)}</td>
                <td>${escapeXml(row.group)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </main>
    <script>
      function runExport(name, format) {
        if (!window.opener) {
          alert("메인 페이지와 연결되어 있지 않아 export를 실행할 수 없습니다.");
          return;
        }
        try {
          if (typeof window.opener[name] === "function") {
            window.opener[name]();
            return;
          }
        } catch (error) {
          // Fall back to postMessage below when direct opener access is blocked.
        }
        window.opener.postMessage({ type: "leaf-spine-export-port-map", format }, "*");
      }
      document.querySelector("#exportPortMapExcel").addEventListener("click", () => runExport("exportPortMapExcel", "excel"));
      document.querySelector("#exportPortMapPpt").addEventListener("click", () => runExport("exportPortMapPpt", "ppt"));
    </script>
  </body>
</html>`;
}

function portMapSectionClass(section) {
  if (section === "Server-Leaf") return "section-server-leaf";
  if (section === "Leaf-Spine") return "section-leaf-spine";
  return "";
}

function portMapPodStyle(row) {
  if (row.pod === "-") return "";
  const tone = podTone(row.podIndex || 0);
  return `color:${tone.text}; background:${tone.bg};`;
}

function podTone(index) {
  const tones = [
    { text: "#1d4ed8", bg: "#eff6ff", ppt: "1D4ED8", fill: "EFF6FF" },
    { text: "#047857", bg: "#ecfdf5", ppt: "047857", fill: "ECFDF5" },
    { text: "#8a4b12", bg: "#fff7ed", ppt: "8A4B12", fill: "FFF7ED" },
    { text: "#6d28d9", bg: "#f5f3ff", ppt: "6D28D9", fill: "F5F3FF" },
    { text: "#be123c", bg: "#fff1f2", ppt: "BE123C", fill: "FFF1F2" },
    { text: "#0e7490", bg: "#ecfeff", ppt: "0E7490", fill: "ECFEFF" },
  ];
  return tones[index % tones.length];
}

function exportPortMapExcel() {
  if (!currentResult) return;
  const generatedAt = makeExportTimestamp();
  const blob = buildPortMapXlsx(buildPortMap(currentResult));
  downloadBlob(blob, exportFilename("leaf-spine-port-map", "xlsx", generatedAt));
}

async function exportPortMapPpt() {
  if (!currentResult) return;
  try {
    await ensurePptxGenLoaded();
    const generatedAt = makeExportTimestamp();
    const pptx = buildPortMapPptx(buildPortMap(currentResult), generatedAt.display);
    const blob = await pptx.write({ outputType: "blob" });
    downloadBlob(blob, exportFilename("leaf-spine-port-map", "pptx", generatedAt));
  } catch (error) {
    console.error(error);
    alert("포트맵 PPT 파일을 만드는 중 오류가 발생했습니다.");
  }
}

window.exportPortMapExcel = exportPortMapExcel;
window.exportPortMapPpt = exportPortMapPpt;

async function ensurePptxGenLoaded() {
  if (typeof PptxGenJS === "function") return;
  if (!pptxGenLoadPromise) {
    pptxGenLoadPromise = loadScriptWithFallback("pptxgen.bundle.js", "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js")
      .then(() => loadScriptWithFallback("pptxgen.min.js", "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.min.js"))
      .then(() => {
        if (typeof PptxGenJS !== "function") {
          throw new Error("PptxGenJS global was not created.");
        }
      })
      .catch((error) => {
        pptxGenLoadPromise = null;
        throw error;
      });
  }
  await pptxGenLoadPromise;
}

function loadScriptWithFallback(localSrc, fallbackSrc) {
  return loadScriptOnce(localSrc).catch(() => loadScriptOnce(fallbackSrc));
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.dynamicSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function getPortMapRows(portMap) {
  return [...portMap.serverLeafRows, ...portMap.leafSpineRows];
}

function portMapHeaders() {
  return ["#", "구간", "Pod", "출발 장비", "출발 포트", "도착 장비", "도착 포트", "속도", "그룹"];
}

function portMapRowValues(row, index) {
  return [
    index + 1,
    row.section,
    row.pod,
    row.sourceDevice,
    row.sourcePort,
    row.targetDevice,
    row.targetPort,
    row.speed,
    row.group,
  ];
}

function portMapTableHeaderHtml() {
  return `<tr>${portMapHeaders().map((header) => `<th>${escapeXml(header)}</th>`).join("")}</tr>`;
}

function portMapExcelRowHtml(row, index) {
  const sectionClass = row.section === "Server-Leaf" ? "server-leaf" : "leaf-spine";
  return `<tr>${portMapRowValues(row, index).map((value, cellIndex) => {
    const className = cellIndex === 1 ? ` class="${sectionClass}"` : "";
    return `<td${className}>${escapeXml(value)}</td>`;
  }).join("")}</tr>`;
}

function buildPortMapXlsx(portMap) {
  const files = {
    "[Content_Types].xml": xlsxContentTypesXml(),
    "_rels/.rels": xlsxRootRelsXml(),
    "docProps/app.xml": xlsxAppXml(),
    "docProps/core.xml": xlsxCoreXml(),
    "xl/workbook.xml": xlsxWorkbookXml(),
    "xl/_rels/workbook.xml.rels": xlsxWorkbookRelsXml(),
    "xl/styles.xml": xlsxStylesXml(),
    "xl/worksheets/sheet1.xml": xlsxSheetXml(portMap),
  };
  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function xlsxSheetXml(portMap) {
  const rows = [portMapHeaders(), ...getPortMapRows(portMap).map((row, index) => portMapRowValues(row, index))];
  const sourceRows = [null, ...getPortMapRows(portMap)];
  const colWidths = [7, 14, 11, 22, 16, 24, 16, 14, 20];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${colWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>
    ${rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, colIndex) => xlsxCell(value, rowIndex, colIndex, sourceRows[rowIndex])).join("")}</row>`).join("")}
  </sheetData>
  <autoFilter ref="A1:I${rows.length}"/>
</worksheet>`;
}

function xlsxCell(value, rowIndex, colIndex, sourceRow) {
  const ref = `${xlsxColumnName(colIndex)}${rowIndex + 1}`;
  let style = rowIndex === 0 ? 1 : 0;
  if (sourceRow && colIndex === 1) style = sourceRow.section === "Server-Leaf" ? 2 : 3;
  if (sourceRow && colIndex === 2 && sourceRow.pod !== "-") style = 4 + ((sourceRow.podIndex || 0) % 6);
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${escapeXml(value)}</t></is></c>`;
}

function xlsxColumnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function xlsxContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
}

function xlsxRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function xlsxWorkbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Port Map" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function xlsxWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function xlsxAppXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Leaf-Spine Planner</Application></Properties>`;
}

function xlsxCoreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Leaf-Spine Port Map</dc:title><dc:creator>임채성</dc:creator><cp:lastModifiedBy>임채성</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function xlsxStylesXml() {
  const fills = ["FFFFFF", "DBEAFE", "EFF6FF", "ECFDF5", "FFF7ED", "F5F3FF", "FFF1F2", "ECFEFF"];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4"><font><sz val="10"/><name val="Segoe UI"/></font><font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Segoe UI"/></font><font><b/><sz val="10"/><color rgb="FF8A4B12"/><name val="Segoe UI"/></font><font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Segoe UI"/></font></fonts>
  <fills count="${fills.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map((color) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills>
  <borders count="1"><border><left style="thin"><color rgb="FFC8D8EE"/></left><right style="thin"><color rgb="FFC8D8EE"/></right><top style="thin"><color rgb="FFC8D8EE"/></top><bottom style="thin"><color rgb="FFC8D8EE"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10"><xf numFmtId="49" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>${[2,3,4,5,6,7].map((fillId) => `<xf numFmtId="49" fontId="3" fillId="${fillId + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>`).join("")}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function buildPortMapPptx(portMap, generatedAtText = formatDisplayTimestamp(new Date())) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "임채성";
  pptx.company = "Leaf-Spine Planner";
  pptx.subject = "Leaf-Spine Port Map";
  pptx.title = "Leaf-Spine Port Map";
  pptx.lang = "ko-KR";

  const rows = getPortMapRows(portMap);
  const chunks = [];
  let cursor = 0;
  while (cursor < rows.length || chunks.length === 0) {
    const limit = chunks.length === 0 ? 10 : 16;
    chunks.push({ start: cursor, rows: rows.slice(cursor, cursor + limit) });
    cursor += limit;
  }

  chunks.forEach((chunk, slideIndex) => {
    const slide = pptx.addSlide();
    if (slideIndex === 0) {
      addPortMapPptHeader(slide, slideIndex + 1, chunks.length, generatedAtText);
      addPortMapPptSummary(slide, portMap);
    } else {
      addPortMapPptPageNumber(slide, slideIndex + 1, chunks.length);
    }
    addPortMapPptTable(slide, chunk.rows, chunk.start, slideIndex === 0 ? 1.55 : 0.35);
  });

  return pptx;

  const files = {
    "[Content_Types].xml": portMapPptContentTypesXml(chunks.length),
    "_rels/.rels": rootRelsXml(),
    "docProps/app.xml": portMapPptAppPropsXml(chunks.length),
    "docProps/core.xml": portMapPptCorePropsXml(),
    "ppt/presentation.xml": portMapPresentationXml(chunks.length),
    "ppt/_rels/presentation.xml.rels": portMapPresentationRelsXml(chunks.length),
    "ppt/slideMasters/slideMaster1.xml": slideMasterXml(),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": slideMasterRelsXml(),
    "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml(),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": slideLayoutRelsXml(),
    "ppt/theme/theme1.xml": themeXml(),
    "ppt/viewProps.xml": viewPropsXml(),
    "ppt/tableStyles.xml": tableStylesXml(),
  };
  chunks.forEach((chunk, index) => {
    files[`ppt/slides/slide${index + 1}.xml`] = portMapSlideXml(portMap, chunk, index + 1, chunks.length);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRelsXml();
  });

  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function addPortMapPptHeader(slide, pageNumber, pageCount, generatedAtText) {
  slide.addText("Leaf-Spine Port Map", {
    x: 0.35, y: 0.2, w: 2.6, h: 0.28,
    fontFace: "Segoe UI", fontSize: 17, bold: true, color: "2563EB", margin: 0,
  });
  slide.addText(`Created by 임채성 ${generatedAtText}`, {
    x: 0.5, y: 0.5, w: 2.48, h: 0.16,
    fontFace: "Segoe UI", fontSize: 7.5, bold: true, color: "5B6B86", align: "right", margin: 0,
  });
  addPortMapPptPageNumber(slide, pageNumber, pageCount, 0.32);
}

function addPortMapPptPageNumber(slide, pageNumber, pageCount, y = 0.12) {
  slide.addText(`Page ${pageNumber} / ${pageCount}`, {
    x: 11.4, y, w: 1.4, h: 0.2,
    fontFace: "Segoe UI", fontSize: 8, bold: true, color: "5B6B86", align: "right", margin: 0,
  });
}

function addPortMapPptSummary(slide, portMap) {
  portMap.summary.forEach(([label, value], index) => {
    const x = 0.35 + index * 2.05;
    slide.addShape("roundRect", {
      x, y: 0.82, w: 1.85, h: 0.46,
      rectRadius: 0.04,
      fill: { color: "FFFFFF" },
      line: { color: "C8D8EE", width: 0.45 },
    });
    slide.addText(label, {
      x: x + 0.09, y: 0.9, w: 1.65, h: 0.1,
      fontFace: "Segoe UI", fontSize: 6.3, bold: true, color: "5B6B86", margin: 0,
    });
    slide.addText(value, {
      x: x + 0.09, y: 1.05, w: 1.65, h: 0.14,
      fontFace: "Segoe UI", fontSize: 9.3, bold: true, color: "0F172A", margin: 0,
    });
  });
}

function addPortMapPptTable(slide, rows, startIndex, y) {
  const tableRows = [
    portMapHeaders().map((header) => ({
      text: header,
      options: { bold: true, color: "1D4ED8" },
    })),
    ...rows.map((row, rowIndex) => portMapRowValues(row, startIndex + rowIndex).map((value, cellIndex) => {
      const isSection = cellIndex === 1;
      const isPod = cellIndex === 2 && row.pod !== "-";
      const sectionColor = row.section === "Server-Leaf" ? "1D4ED8" : "8A4B12";
      const tone = isPod ? podTone(row.podIndex || 0) : null;
      return {
        text: String(value),
        options: {
          bold: isSection || isPod,
          color: isSection ? sectionColor : (isPod ? tone.ppt : "0F172A"),
        },
      };
    })),
  ];
  slide.addTable(tableRows, {
    x: 0.35,
    y,
    w: 12.15,
    colW: [0.55, 1.35, 0.85, 1.8, 1.25, 2.05, 1.25, 1.05, 2.1],
    rowH: 0.36,
    fontFace: "Segoe UI",
    fontSize: 9,
    color: "0F172A",
    margin: 0.04,
    border: { type: "solid", color: "C8D8EE", pt: 0.25 },
  });
}

function portMapSlideXml(portMap, chunk, pageNumber, pageCount) {
  const slideW = 12192000;
  const slideH = 6858000;
  const shapes = [];
  let id = 2;
  shapes.push(pptRect(id++, 0, 0, slideW, slideH, "F8FBFF", "F8FBFF"));
  if (pageNumber === 1) {
    shapes.push(pptText(id++, inch(0.35), inch(0.2), inch(2.8), inch(0.32), "Leaf-Spine Port Map", "2563EB", 17, true));
    shapes.push(pptText(id++, inch(1.42), inch(0.5), inch(1.55), inch(0.16), "Created by 임채성", "5B6B86", 7.5, true, "r"));
    shapes.push(pptText(id++, inch(11.35), inch(0.32), inch(1.5), inch(0.2), `Page ${pageNumber} / ${pageCount}`, "5B6B86", 8, true, "r"));
    portMap.summary.forEach(([label, value], index) => {
      const x = 0.35 + index * 2.05;
      shapes.push(pptRect(id++, inch(x), inch(0.82), inch(1.85), inch(0.46), "FFFFFF", "C8D8EE", "roundRect"));
      shapes.push(pptText(id++, inch(x + 0.09), inch(0.9), inch(1.65), inch(0.1), label, "5B6B86", 6.3, true, "l"));
      shapes.push(pptText(id++, inch(x + 0.09), inch(1.05), inch(1.65), inch(0.14), value, "0F172A", 9.3, true, "l"));
    });
  } else {
    shapes.push(pptText(id++, inch(11.35), inch(0.12), inch(1.5), inch(0.18), `Page ${pageNumber} / ${pageCount}`, "5B6B86", 8, true, "r"));
  }

  const tableY = pageNumber === 1 ? 1.55 : 0.35;
  shapes.push(portMapTableXml(id++, chunk.rows, chunk.start, 0.35, tableY));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    ${shapes.join("\n")}
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function portMapTableXml(id, rows, startIndex, xIn, yIn) {
  const colW = [0.55, 1.35, 0.85, 1.8, 1.25, 2.05, 1.25, 1.05, 2.1];
  const rowH = 0.25;
  const tableRows = [
    { type: "header", values: portMapHeaders() },
    ...rows.map((row, rowIndex) => ({ type: "data", source: row, values: portMapRowValues(row, startIndex + rowIndex).map(String), rowIndex })),
  ];
  const tableW = colW.reduce((sum, value) => sum + value, 0);
  const tableH = rowH * tableRows.length;
  return `<p:graphicFrame>
    <p:nvGraphicFramePr><p:cNvPr id="${id}" name="Port Map Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
    <p:xfrm><a:off x="${inch(xIn)}" y="${inch(yIn)}"/><a:ext cx="${inch(tableW)}" cy="${inch(tableH)}"/></p:xfrm>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr>
        <a:tblGrid>${colW.map((width) => `<a:gridCol w="${inch(width)}"/>`).join("")}</a:tblGrid>
        ${tableRows.map((row) => portMapTableRowXml(row, rowH)).join("")}
      </a:tbl>
    </a:graphicData></a:graphic>
  </p:graphicFrame>`;
}

function portMapTableRowXml(row, rowH) {
  return `<a:tr h="${inch(rowH)}">${row.values.map((value, cellIndex) => portMapTableCellXml(row, value, cellIndex)).join("")}</a:tr>`;
}

function portMapTableCellXml(row, value, cellIndex) {
  let fill = "FFFFFF";
  let color = "0F172A";
  let bold = false;
  if (row.type === "header") {
    fill = "DBEAFE";
    color = "1D4ED8";
    bold = true;
  } else if (cellIndex === 1) {
    color = row.source.section === "Server-Leaf" ? "1D4ED8" : "8A4B12";
    bold = true;
  } else if (cellIndex === 2 && row.source.pod !== "-") {
    const tone = podTone(row.source.podIndex || 0);
    fill = tone.fill;
    color = tone.ppt;
    bold = true;
  } else if (row.rowIndex % 2) {
    fill = "F8FBFF";
  }
  return `<a:tc>
    <a:txBody><a:bodyPr wrap="none" lIns="28575" rIns="28575" tIns="9525" bIns="9525" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="ko-KR" sz="540"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Segoe UI"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${escapeXml(value)}</a:t></a:r></a:p></a:txBody>
    <a:tcPr><a:lnL w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnL><a:lnR w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnR><a:lnT w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnT><a:lnB w="3175"><a:solidFill><a:srgbClr val="C8D8EE"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></a:tcPr>
  </a:tc>`;
}

function inch(value) {
  return Math.round(value * 914400);
}

function portMapPptContentTypesXml(slideCount) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slideOverrides}<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/></Types>`;
}

function portMapPresentationXml(slideCount) {
  const slides = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="12192000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="ko-KR"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
}

function portMapPresentationRelsXml(slideCount) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const nextId = slideCount + 2;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId${nextId + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${nextId + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
}

function portMapPptAppPropsXml(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Leaf-Spine Planner</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slideCount}</Slides></Properties>`;
}

function portMapPptCorePropsXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Leaf-Spine Port Map</dc:title><dc:creator>임채성</dc:creator><cp:lastModifiedBy>임채성</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function makeExportSvgClone(svg) {
  const width = Number(svg.dataset.baseWidth) || 1200;
  const height = Number(svg.dataset.baseHeight) || 700;
  const clone = svg.cloneNode(true);
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.insertBefore(makePngSvgStyleElement(), clone.firstChild);
  clone.insertBefore(makeSvgBackgroundRect(width, height), clone.children[1] || null);
  return { clone, width, height };
}

function makeSvgBackgroundRect(width, height) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("fill", "#f8fbff");
  return rect;
}

function makePngSvgStyleElement() {
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    svg {
      font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif;
      shape-rendering: geometricPrecision;
      text-rendering: geometricPrecision;
      background: #f8fbff;
    }
    .hint text { fill: #5b6b86; font-weight: 900; font-size: 13px; }
    .link, .uplink { vector-effect: non-scaling-stroke; }
    .link { stroke-width: 1.35; }
    .uplink { stroke-width: 1.45; }
    .node rect, .node circle { vector-effect: non-scaling-stroke; stroke-width: 1.2; }
    .node text { font-weight: 800; text-anchor: middle; dominant-baseline: middle; }
    .switch-body { stroke-width: 1.2; }
    .spine .switch-body { fill: #b45309; stroke: #92400e; }
    .leaf .switch-body { fill: #2563eb; stroke: #1e40af; }
    .switch-face { fill: rgba(255, 255, 255, 0.14); stroke: rgba(255, 255, 255, 0.22); }
    .switch-port { fill: #e5e7eb; stroke: #111827; stroke-width: 0.6; }
    .switch-led, .server-led { fill: #86efac; stroke: #166534; stroke-width: 0.7; }
    .spine text, .leaf text, .server .server-name { fill: #0f172a; font-size: 11px; }
    .server .server-body, .server rect { fill: #475569; stroke: #334155; }
    .server .server-face { fill: #64748b; stroke: #334155; }
    .server .nic-port { stroke: #1f2937; stroke-width: 0.8; }
    .ellipsis-node rect { fill: #eef2f7; stroke: #94a3b8; stroke-dasharray: 4 4; }
    .ellipsis-node text { fill: #334155; font-size: 18px; }
    .ellipsis-node .ellipsis-label { fill: #64748b; font-size: 10px; }
  `;
  return style;
}

async function exportDiagramPptx(viewMode = diagramViewMode) {
  if (!currentResult) return;

  try {
    await ensurePptxGenLoaded();
    const pptx = buildPptxWithPptxGen(currentResult, viewMode);
    const blob = await pptx.write({ outputType: "blob", compression: true });
    downloadBlob(blob, exportFilename("leaf-spine-topology", "pptx"));
  } catch (error) {
    console.error(error);
    alert("PPTX 파일을 만드는 중 오류가 발생했습니다.");
  }
}

window.exportDiagramPptx = exportDiagramPptx;

function buildPptxWithPptxGen(result, viewMode = diagramViewMode) {
  const geometry = getDiagramGeometryForView(result, viewMode);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "임채성";
  pptx.company = "Leaf-Spine Planner";
  pptx.subject = "Leaf-Spine Topology";
  pptx.title = "Leaf-Spine Topology";

  const slideW = 13.333;
  const slideH = 7.5;
  const margin = 0.25;

  const slide = pptx.addSlide();
  slide.background = { color: "F8FBFF" };

  const scale = Math.min((slideW - margin * 2) / geometry.width, (slideH - margin * 2) / geometry.height);
  const toX = (value) => margin + value * scale;
  const toY = (value) => margin + value * scale;
  const toL = (value) => value * scale;

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: slideW,
    h: slideH,
    fill: { color: "F8FBFF" },
    line: { color: "F8FBFF", transparency: 100 },
  });

  geometry.labels.forEach((label) => {
    slide.addText(label.text, {
      x: toX(label.x),
      y: toY(label.y - 9),
      w: toL(74),
      h: toL(18),
      fontFace: "Segoe UI",
      fontSize: 9,
      bold: true,
      color: "5B6B86",
      align: "left",
      valign: "mid",
      margin: 0,
      fit: "shrink",
    });
  });

  geometry.lines.forEach((link) => {
    const x1 = toX(link.x1);
    const y1 = toY(link.y1);
    const x2 = toX(link.x2);
    const y2 = toY(link.y2);
    slide.addShape("line", {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.max(Math.abs(x2 - x1), 0.001),
      h: Math.max(Math.abs(y2 - y1), 0.001),
      flipH: x2 < x1,
      flipV: y2 < y1,
      line: { color: cleanColor(link.color), width: 0.65, transparency: 12 },
    });
  });

  geometry.switches.forEach((sw) => {
    addPptSwitch(slide, sw, toX, toY, toL);
  });

  geometry.servers.forEach((server) => {
    addPptServer(slide, server, toX, toY, toL);
  });

  (geometry.ellipsis || []).forEach((item) => {
    addPptEllipsis(slide, item, toX, toY, toL);
  });

  return pptx;
}

function getPptDiagramGeometry({ input, best }) {
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const switchW = 116;
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const serverGap = Math.max(88, serverW + 18);
  const spinePerRow = 8;
  const leafPerRow = 12;
  const serverPerRow = Math.max(1, Math.min(16, Math.floor(1120 / serverGap)));
  const spineRows = Math.ceil(shownSpines / spinePerRow);
  const leafRows = Math.ceil(shownLeafs / leafPerRow);
  const serverRows = Math.ceil(shownServers / serverPerRow);
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const maxRowWidth = Math.max(
    Math.min(shownSpines, spinePerRow) * 126,
    Math.min(shownLeafs, leafPerRow) * 122,
    Math.min(shownServers, serverPerRow) * serverGap,
  );
  const width = Math.max(920, labelGutter + maxRowWidth + 150);
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const spineStartY = 58;
  const spineRowGap = 72;
  const leafStartY = spineStartY + (spineRows - 1) * spineRowGap + 132;
  const leafRowGap = 88;
  const serverStartY = leafStartY + (leafRows - 1) * leafRowGap + 170;
  const serverRowGap = 105;
  const height = serverStartY + (serverRows - 1) * serverRowGap + serverH / 2 + 52;
  const lines = [];
  const switches = [];
  const servers = [];
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || shownLeafs;
  const perPodSpines = best.perPodSpines || shownSpines;
  const podServerCount = best.podServerCount || shownServers;
  const labels = [];

  const spinePositions = makePptRowPositions(shownSpines, spinePerRow, center, spineStartY, spineRowGap, 126);
  const leafPositions = makePptRowPositions(shownLeafs, leafPerRow, center, leafStartY, leafRowGap, 122);
  const serverPositions = makePptRowPositions(shownServers, serverPerRow, center, serverStartY, serverRowGap, serverGap);

  spinePositions.forEach((position, index) => {
    const label = podCount > 1 ? `Pod ${Math.floor(index / perPodSpines) + 1} Spine ${(index % perPodSpines) + 1}` : `Spine ${index + 1}`;
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label });
  });

  leafPositions.forEach((leafPosition, leafIndex) => {
    const podIndex = Math.floor(leafIndex / perPodLeafs);
    const spineStart = podIndex * perPodSpines;
    const spineEnd = Math.min(spineStart + perPodSpines, spinePositions.length);
    spinePositions.slice(spineStart, spineEnd).forEach((spinePosition, localSpineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push({
          x1: leafPosition.x + offset,
          y1: leafPosition.y - switchH / 2,
          x2: spinePosition.x + offset,
          y2: spinePosition.y + switchH / 2,
          color: leafColor(leafIndex),
          kind: "uplink",
          title: `Leaf ${leafIndex + 1} uplink`,
        });
      }
    });
    const label = podCount > 1 ? `Pod ${Math.floor(leafIndex / perPodLeafs) + 1} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`;
    switches.push({ kind: "leaf", x: leafPosition.x, y: leafPosition.y, w: switchW, h: switchH, label });
  });

  serverPositions.forEach((serverPosition, serverIndex) => {
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;
    const ports = [];
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = podCount > 1
        ? Math.floor(serverIndex / podServerCount) * perPodLeafs + (((serverIndex % podServerCount) * activeNicPorts + nicIndex) % perPodLeafs)
        : (nicLeafStart + nicIndex) % shownLeafs;
      const leafPosition = leafPositions[leafIndex];
      const nicX = nicPortX(serverPosition.x, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverPosition.y - serverH / 2 + 7, color });
      lines.push({
        x1: nicX,
        y1: serverPosition.y - serverH / 2,
        x2: leafPosition.x,
        y2: leafPosition.y + switchH / 2,
        color,
        kind: "link",
        title: `Server NIC ${nicIndex + 1}`,
      });
    }
    servers.push({ x: serverPosition.x, y: serverPosition.y, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label: `Server #${serverIndex + 1}`, ports });
  });

  return normalizeGeometryHorizontal({ width, height, labels, lines, switches, servers, labelGutter });
}

function makePptRowPositions(count, perRow, center, startY, rowGap, itemGap) {
  const positions = [];
  const rows = Math.ceil(count / perRow);
  for (let row = 0; row < rows; row += 1) {
    const rowStart = row * perRow;
    const rowCount = Math.min(perRow, count - rowStart);
    const xs = distribute(center, rowCount, itemGap);
    xs.forEach((x, column) => {
      positions[rowStart + column] = { x, y: startY + row * rowGap };
    });
  }
  return positions;
}

function getSummaryDiagramGeometry({ input, best }) {
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || best.leafCount;
  const perPodSpines = best.perPodSpines || best.spines;
  const podServerCount = best.podServerCount || input.serverCount;
  const switchW = summarySwitchWidth(best, podCount);
  const switchEntryLimit = summarySwitchEntryLimit(best, podCount);
  const spineEntries = compactEntriesByPod(best.spines, perPodSpines, switchEntryLimit.spine, "spine");
  const leafEntries = compactEntriesByPod(best.leafCount, perPodLeafs, switchEntryLimit.leaf, "leaf");
  const serverEntries = compactEntriesByPod(input.serverCount, podServerCount, podCount > 1 ? 7 : 13, "server");
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const switchSlotWidth = Math.max(92, switchW + 18);
  const serverSlotWidth = Math.max(96, serverW + 16);
  const maxRowWidth = Math.max(
    spineEntries.length * switchSlotWidth,
    leafEntries.length * switchSlotWidth,
    serverEntries.length * serverSlotWidth,
  );
  const width = Math.max(920, labelGutter + maxRowWidth + 150);
  const summaryDensity = Math.max(spineEntries.length, leafEntries.length, serverEntries.length);
  const verticalScale = Math.min(1, Math.max(0, (summaryDensity - 10) / 10));
  const spineY = 58;
  const leafY = 190 + verticalScale * 58;
  const serverY = 360 + verticalScale * 138;
  const height = Math.round(serverY + serverH / 2 + 58);
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const lines = [];
  const switches = [];
  const servers = [];
  const ellipsis = [];
  const spinePositions = placeCompactEntries(spineEntries, center, spineY, switchSlotWidth);
  const leafPositions = placeCompactEntries(leafEntries, center, leafY, switchSlotWidth);
  const serverPositions = placeCompactEntries(serverEntries, center, serverY, serverSlotWidth);
  const switchEllipsisW = Math.max(78, switchW);

  spineEntries.forEach((entry) => {
    const position = spinePositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Spine") });
      return;
    }
    const label = podCount > 1 ? `Pod ${Math.floor(entry.index / perPodSpines) + 1} Spine ${(entry.index % perPodSpines) + 1}` : `Spine ${entry.index + 1}`;
    switches.push({ kind: "spine", x: position.x, y: position.y, w: switchW, h: switchH, label });
  });

  leafEntries.forEach((entry) => {
    const position = leafPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: switchEllipsisW, h: 34, label: summaryHiddenLabel(entry, "Leaf") });
      return;
    }
    const label = podCount > 1 ? `Pod ${Math.floor(entry.index / perPodLeafs) + 1} Leaf ${(entry.index % perPodLeafs) + 1}` : `Leaf ${entry.index + 1}`;
    switches.push({ kind: "leaf", x: position.x, y: position.y, w: switchW, h: switchH, label });
  });

  leafEntries.filter((entry) => entry.type === "node").forEach((leafEntry) => {
    const leafPosition = leafPositions.get(leafEntry.key);
    spineEntries.filter((entry) => entry.type === "node").forEach((spineEntry) => {
      if (Math.floor(leafEntry.index / perPodLeafs) !== Math.floor(spineEntry.index / perPodSpines)) return;
      const spinePosition = spinePositions.get(spineEntry.key);
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, spineEntry.index % perPodSpines);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push({
          x1: leafPosition.x + offset,
          y1: leafY - switchH / 2,
          x2: spinePosition.x + offset,
          y2: spineY + switchH / 2,
          color: leafColor(leafEntry.index),
          kind: "uplink",
          title: `Leaf ${leafEntry.index + 1} uplink`,
        });
      }
    });
  });

  serverEntries.forEach((entry) => {
    const position = serverPositions.get(entry.key);
    if (entry.type === "ellipsis") {
      ellipsis.push({ x: position.x, y: position.y, w: 78, h: 42, label: summaryHiddenLabel(entry, "Server") });
      return;
    }

    const ports = [];
    const nicLeafStart = (entry.index * activeNicPorts) % best.leafCount;
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = podCount > 1
        ? Math.floor(entry.index / podServerCount) * perPodLeafs + (((entry.index % podServerCount) * activeNicPorts + nicIndex) % perPodLeafs)
        : (nicLeafStart + nicIndex) % best.leafCount;
      const leafEntry = leafEntries.find((item) => item.type === "node" && item.index === leafIndex);
      const fallbackLeafEntry = leafEntries.find((item) => {
        if (item.type !== "ellipsis") return false;
        return leafIndex >= item.rangeStart && leafIndex <= item.rangeEnd;
      }) || leafEntries.find((item) => item.type === "ellipsis");
      const nicX = nicPortX(position.x, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverY - serverH / 2 + 7, color });
      const linkLeafEntry = leafEntry || fallbackLeafEntry;
      if (!linkLeafEntry) continue;
      const leafPosition = leafPositions.get(linkLeafEntry.key);
      lines.push({
        x1: nicX,
        y1: serverY - serverH / 2,
        x2: leafPosition.x,
        y2: leafY + switchH / 2,
        color,
        kind: "link",
        title: `Server NIC ${nicIndex + 1}`,
      });
    }
    servers.push({ x: position.x, y: position.y, w: serverW, h: serverH, number: entry.index + 1, nicCount: input.serverNicPorts, label: `Server #${entry.index + 1}`, ports });
  });

  return normalizeGeometryHorizontal({
    width,
    height,
    labels: [],
    lines,
    switches,
    servers,
    ellipsis,
    labelGutter,
  });
}

function compactLayerEntries(count, maxEntries) {
  if (count <= maxEntries) {
    return Array.from({ length: count }, (_, index) => ({ type: "node", index, key: `node-${index}` }));
  }

  const visibleNodeCount = maxEntries - 1;
  const headCount = Math.ceil(visibleNodeCount / 2);
  const tailCount = visibleNodeCount - headCount;
  const entries = [];
  for (let index = 0; index < headCount; index += 1) {
    entries.push({ type: "node", index, key: `node-${index}` });
  }
  entries.push({
    type: "ellipsis",
    hiddenCount: count - headCount - tailCount,
    rangeStart: headCount,
    rangeEnd: count - tailCount - 1,
    key: "ellipsis",
  });
  for (let index = count - tailCount; index < count; index += 1) {
    entries.push({ type: "node", index, key: `node-${index}` });
  }
  return entries;
}

function compactEntriesByPod(totalCount, perPodCount, maxEntriesPerPod, kind, maxPods = 5) {
  if (perPodCount >= totalCount) return compactLayerEntries(totalCount, maxEntriesPerPod);

  const entries = [];
  const podCount = Math.ceil(totalCount / perPodCount);
  const podEntries = compactPodEntries(podCount, maxPods);

  podEntries.forEach((podEntry) => {
    if (podEntry.type === "ellipsis") {
      const podStart = podEntry.rangeStart || 0;
      const podEnd = podEntry.rangeEnd || podCount - 1;
      const rangeStart = podStart * perPodCount;
      const rangeEnd = Math.min(totalCount - 1, (podEnd + 1) * perPodCount - 1);
      entries.push({
        type: "ellipsis",
        key: `${kind}-pods-${podStart}-${podEnd}-ellipsis`,
        podEllipsis: true,
        podIndex: podStart,
        rangePodStart: podStart,
        rangePodEnd: podEnd,
        hiddenPodCount: podEnd - podStart + 1,
        rangeStart,
        rangeEnd,
        hiddenCount: Math.max(0, rangeEnd - rangeStart + 1),
      });
      return;
    }

    const podIndex = podEntry.index;
    const start = podIndex * perPodCount;
    const count = Math.min(perPodCount, totalCount - start);
    const deviceEntries = compactLayerEntries(count, maxEntriesPerPod);
    deviceEntries.forEach((entry, entryIndex) => {
      if (entry.type === "ellipsis") {
        const previousNode = [...deviceEntries.slice(0, entryIndex)].reverse().find((item) => item.type === "node");
        const nextNode = deviceEntries.slice(entryIndex + 1).find((item) => item.type === "node");
        const rangeStart = start + (previousNode ? previousNode.index + 1 : 0);
        const rangeEnd = start + (nextNode ? nextNode.index - 1 : count - 1);
        entries.push({
          ...entry,
          key: `${kind}-pod-${podIndex}-ellipsis`,
          podIndex,
          rangeStart,
          rangeEnd,
          hiddenCount: Math.max(0, rangeEnd - rangeStart + 1),
        });
        return;
      }
      entries.push({
        ...entry,
        index: start + entry.index,
        key: `${kind}-pod-${podIndex}-node-${entry.index}`,
        podIndex,
      });
    });
  });
  return entries;
}

function compactPodEntries(podCount, maxPods = 5) {
  if (podCount <= 2) {
    return Array.from({ length: podCount }, (_, index) => ({ type: "node", index, key: `pod-${index}` }));
  }

  return [
    { type: "node", index: 0, key: "pod-0" },
    {
      type: "ellipsis",
      hiddenCount: podCount - 2,
      rangeStart: 1,
      rangeEnd: podCount - 2,
      key: "pod-ellipsis",
    },
    { type: "node", index: podCount - 1, key: `pod-${podCount - 1}` },
  ];
}

function normalizeGeometryHorizontal(geometry, padding = 96) {
  const bounds = getGeometryHorizontalBounds(geometry);
  if (!bounds) return geometry;
  const contentWidth = bounds.maxX - bounds.minX;
  const width = Math.max(DEFAULT_DIAGRAM_VIEW_WIDTH, Math.ceil(contentWidth + padding * 2));
  const shift = (width - contentWidth) / 2 - bounds.minX;
  shiftGeometryX(geometry, shift);
  geometry.width = width;
  geometry.labelGutter = 0;
  return geometry;
}

function getGeometryHorizontalBounds(geometry) {
  let minX = Infinity;
  let maxX = -Infinity;
  const take = (value) => {
    if (!Number.isFinite(value)) return;
    minX = Math.min(minX, value);
    maxX = Math.max(maxX, value);
  };
  geometry.switches.forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
  });
  geometry.servers.forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
    (item.ports || []).forEach((port) => take(port.x));
  });
  (geometry.ellipsis || []).forEach((item) => {
    take(item.x - item.w / 2);
    take(item.x + item.w / 2);
  });
  geometry.lines.forEach((item) => {
    take(item.x1);
    take(item.x2);
  });
  geometry.labels.forEach((item) => take(item.x));
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return { minX, maxX };
}

function shiftGeometryX(geometry, shift) {
  geometry.switches.forEach((item) => { item.x += shift; });
  geometry.servers.forEach((item) => {
    item.x += shift;
    (item.ports || []).forEach((port) => { port.x += shift; });
  });
  (geometry.ellipsis || []).forEach((item) => { item.x += shift; });
  geometry.lines.forEach((item) => {
    item.x1 += shift;
    item.x2 += shift;
  });
  geometry.labels.forEach((item) => { item.x += shift; });
}

function summaryHiddenLabel(entry, label) {
  if (entry.podEllipsis) {
    return `${entry.hiddenPodCount} Pods hidden`;
  }
  const podPrefix = entry.podIndex === undefined ? "" : `Pod ${entry.podIndex + 1} `;
  return `${podPrefix}${entry.hiddenCount} ${label} hidden`;
}

function summarySwitchWidth(best, podCount) {
  const switchCount = Math.max(best.leafCount, best.spines);
  if (podCount > 1) {
    if (switchCount >= 512) return 88;
    if (switchCount >= 128) return 96;
    return 104;
  }
  if (switchCount >= 128) return 88;
  if (switchCount >= 64) return 96;
  if (switchCount >= 32) return 104;
  return 116;
}

function summarySwitchEntryLimit(best, podCount) {
  const switchCount = Math.max(best.leafCount, best.spines);
  if (podCount > 1) {
    if (switchCount >= 512) return { spine: 9, leaf: 9 };
    if (switchCount >= 128) return { spine: 7, leaf: 7 };
    return { spine: 5, leaf: 5 };
  }
  if (switchCount >= 128) return { spine: 11, leaf: 13 };
  if (switchCount >= 64) return { spine: 9, leaf: 11 };
  return { spine: 7, leaf: 9 };
}

function placeCompactEntries(entries, center, y, gap) {
  const positions = new Map();
  const xs = distribute(center, entries.length, gap);
  entries.forEach((entry, index) => {
    positions.set(entry.key, { x: xs[index], y });
  });
  return positions;
}

function placeCompactEntriesInRange(entries, left, right, y) {
  const positions = new Map();
  if (entries.length === 1) {
    positions.set(entries[0].key, { x: (left + right) / 2, y });
    return positions;
  }

  const usableLeft = left + 56;
  const usableRight = right - 56;
  const gap = (usableRight - usableLeft) / Math.max(entries.length - 1, 1);
  entries.forEach((entry, index) => {
    positions.set(entry.key, { x: usableLeft + gap * index, y });
  });
  return positions;
}

function addPptSwitch(slide, sw, toX, toY, toL) {
  const bodyColor = sw.kind === "spine" ? "B45309" : "2563EB";
  const lineColor = sw.kind === "spine" ? "92400E" : "1E40AF";
  const x = toX(sw.x - sw.w / 2);
  const y = toY(sw.y - sw.h / 2);
  const w = toL(sw.w);
  const h = toL(sw.h);

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.04,
    fill: { color: bodyColor },
    line: { color: lineColor, width: 0.6 },
  });
  slide.addShape("roundRect", {
    x: toX(sw.x - sw.w / 2 + 6),
    y: toY(sw.y - sw.h / 2 + 5),
    w: toL(sw.w - 12),
    h: toL(sw.h - 10),
    fill: { color: "FFFFFF", transparency: 82 },
    line: { color: "FFFFFF", transparency: 78, width: 0.35 },
  });
  for (let index = 0; index < 10; index += 1) {
    slide.addShape("rect", {
      x: toX(sw.x - sw.w / 2 + 14 + index * 7),
      y: toY(sw.y - 4),
      w: toL(4),
      h: toL(5),
      fill: { color: "E5E7EB" },
      line: { color: "111827", width: 0.25 },
    });
  }
  slide.addShape("ellipse", {
    x: toX(sw.x + sw.w / 2 - 16.4),
    y: toY(sw.y - 4.4),
    w: toL(4.8),
    h: toL(4.8),
    fill: { color: "86EFAC" },
    line: { color: "166534", width: 0.25 },
  });
  slide.addText(sw.label, {
    x: toX(sw.x - 45),
    y: toY(sw.y + sw.h / 2 + 5),
    w: toL(90),
    h: toL(18),
    fontFace: "Segoe UI",
    fontSize: 7.5,
    bold: true,
    color: "0F172A",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
}

function addPptServer(slide, server, toX, toY, toL) {
  slide.addShape("roundRect", {
    x: toX(server.x - server.w / 2),
    y: toY(server.y - server.h / 2),
    w: toL(server.w),
    h: toL(server.h),
    fill: { color: "475569" },
    line: { color: "334155", width: 0.6 },
  });
  slide.addShape("roundRect", {
    x: toX(server.x - server.w / 2 + 6),
    y: toY(server.y - server.h / 2 + 16),
    w: toL(server.w - 12),
    h: toL(server.h - 24),
    fill: { color: "64748B" },
    line: { color: "334155", width: 0.4 },
  });
  slide.addShape("ellipse", {
    x: toX(server.x + server.w / 2 - 14.5),
    y: toY(server.y + server.h / 2 - 12.5),
    w: toL(5),
    h: toL(5),
    fill: { color: "86EFAC" },
    line: { color: "166534", width: 0.25 },
  });
  server.ports.forEach((port) => {
    slide.addShape("rect", {
      x: toX(port.x - 3),
      y: toY(port.y),
      w: toL(6),
      h: toL(8),
      fill: { color: cleanColor(port.color) },
      line: { color: "1F2937", width: 0.3 },
    });
  });
  slide.addText(server.label, {
    x: toX(server.x - 45),
    y: toY(server.y + server.h / 2 + 5),
    w: toL(90),
    h: toL(18),
    fontFace: "Segoe UI",
    fontSize: 7.5,
    bold: true,
    color: "0F172A",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
}

function addPptEllipsis(slide, item, toX, toY, toL) {
  slide.addShape("roundRect", {
    x: toX(item.x - item.w / 2),
    y: toY(item.y - item.h / 2),
    w: toL(item.w),
    h: toL(item.h),
    fill: { color: "EEF2F7" },
    line: { color: "94A3B8", width: 0.6, dash: "dash" },
  });
  slide.addText("...", {
    x: toX(item.x - item.w / 2),
    y: toY(item.y - item.h / 2 + 1),
    w: toL(item.w),
    h: toL(item.h / 2),
    fontFace: "Segoe UI",
    fontSize: 11,
    bold: true,
    color: "334155",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
  slide.addText(item.label, {
    x: toX(item.x - item.w / 2 - 8),
    y: toY(item.y + item.h / 2 + 5),
    w: toL(item.w + 16),
    h: toL(16),
    fontFace: "Segoe UI",
    fontSize: 6.5,
    bold: true,
    color: "64748B",
    align: "center",
    valign: "mid",
    margin: 0,
    fit: "shrink",
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function linksForSpine(uplinksPerLeaf, spineCount, spineIndex) {
  const base = Math.floor(uplinksPerLeaf / spineCount);
  const extra = uplinksPerLeaf % spineCount;
  return base + (spineIndex < extra ? 1 : 0);
}

function parallelOffset(index, count, maxSpan = 88) {
  if (count <= 1) return 0;
  const naturalSpan = (count - 1) * 5;
  const span = Math.min(naturalSpan, maxSpan);
  const step = span / (count - 1);
  return (index - (count - 1) / 2) * step;
}

function distribute(center, count, gap) {
  if (count === 1) return [center];
  const start = center - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function distributeFromLeft(start, count, gap) {
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function line(x1, y1, x2, y2, className, options = {}) {
  const stroke = options.stroke ? ` style="stroke: ${options.stroke}"` : "";
  const title = options.title ? `<title>${options.title}</title>` : "";
  return `<line class="${className}" x1="${trim(x1)}" y1="${trim(y1)}" x2="${trim(x2)}" y2="${trim(y2)}"${stroke}>${title}</line>`;
}

function switchNode(className, x, y, w, h, text) {
  const portCount = 10;
  const portGap = 7;
  const firstPortX = x - w / 2 + 14;
  const ports = Array.from({ length: portCount }, (_, index) => {
    const px = firstPortX + index * portGap;
    return `<rect class="switch-port" x="${px}" y="${y - 4}" width="4" height="5" rx="1"></rect>`;
  }).join("");

  return `
    <g class="node ${className}">
      <rect class="switch-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="4"></rect>
      <rect class="switch-face" x="${x - w / 2 + 6}" y="${y - h / 2 + 5}" width="${w - 12}" height="${h - 10}" rx="2"></rect>
      ${ports}
      <circle class="switch-led" cx="${x + w / 2 - 14}" cy="${y - 2}" r="2.4"></circle>
      <text x="${x}" y="${y + h / 2 + 14}">${text}</text>
    </g>
  `;
}

function serverNode(x, y, w, h, serverNumber, nicCount, label = `Server #${serverNumber}`) {
  const ports = Array.from({ length: nicCount }, (_, index) => {
    const portX = nicPortX(x, w, nicCount, index);
    return `<rect class="nic-port" x="${portX - 3}" y="${y - h / 2 + 7}" width="6" height="8" rx="1" style="fill: ${nicColor(index)}">
      <title>NIC ${index + 1}</title>
    </rect>`;
  }).join("");

  return `
    <g class="node server">
      <rect class="server-body" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6"></rect>
      <rect class="server-face" x="${x - w / 2 + 6}" y="${y - h / 2 + 16}" width="${w - 12}" height="${h - 24}" rx="3"></rect>
      <circle class="server-led" cx="${x + w / 2 - 12}" cy="${y + h / 2 - 10}" r="2.5"></circle>
      ${ports}
      <text class="server-name" x="${x}" y="${y + h / 2 + 14}">${label}</text>
    </g>
  `;
}

function ellipsisNode(x, y, w, h, label) {
  return `
    <g class="node ellipsis-node">
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="8"></rect>
      <text x="${x}" y="${y - 2}">...</text>
      <text class="ellipsis-label" x="${x}" y="${y + h / 2 + 14}">${label}</text>
    </g>
  `;
}

function serverNodeWidth(nicCount) {
  return Math.max(82, 28 + nicCount * 8);
}

function nicPortX(serverX, serverW, nicCount, nicIndex) {
  const usableWidth = serverW - 16;
  if (nicCount === 1) return serverX;
  const gap = usableWidth / (nicCount - 1);
  return serverX - usableWidth / 2 + gap * nicIndex;
}

function nicColor(index) {
  return NIC_COLORS[index % NIC_COLORS.length];
}

function leafColor(index) {
  return LEAF_COLORS[index % LEAF_COLORS.length];
}

function buildPptx(result) {
  const geometry = getDiagramGeometry(result);
  const slide = buildSlideXml(geometry);
  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelsXml(),
    "docProps/app.xml": appPropsXml(),
    "docProps/core.xml": corePropsXml(),
    "ppt/presentation.xml": presentationXml(),
    "ppt/_rels/presentation.xml.rels": presentationRelsXml(),
    "ppt/slides/slide1.xml": slide,
    "ppt/slides/_rels/slide1.xml.rels": slideRelsXml(),
    "ppt/slideMasters/slideMaster1.xml": slideMasterXml(),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": slideMasterRelsXml(),
    "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml(),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": slideLayoutRelsXml(),
    "ppt/theme/theme1.xml": themeXml(),
    "ppt/viewProps.xml": viewPropsXml(),
    "ppt/tableStyles.xml": tableStylesXml(),
  };
  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function getDiagramGeometry({ input, best }) {
  const shownSpines = best.spines;
  const shownLeafs = best.leafCount;
  const shownServers = input.serverCount;
  const labelGutter = DIAGRAM_LABEL_GUTTER;
  const switchW = 116;
  const switchH = 24;
  const serverW = serverNodeWidth(input.serverNicPorts);
  const activeNicPorts = activeServerNicPorts(input);
  const serverH = 62;
  const serverSlotWidth = Math.max(86, serverW + 14);
  const leafSlotWidth = Math.max(120, switchW + 12);
  const serverSlots = Math.max(shownServers, shownLeafs);
  const width = Math.max(920, labelGutter + serverSlots * Math.max(serverSlotWidth, leafSlotWidth) + 150);
  const height = 500;
  const contentLeft = labelGutter + DIAGRAM_CONTENT_OFFSET;
  const contentRight = width - 48;
  const center = (contentLeft + contentRight) / 2;
  const spineY = 58;
  const leafY = 190;
  const serverY = 360;
  const spineXs = distribute(center, shownSpines, 126);
  const leafXs = distribute(center, shownLeafs, Math.max(120, Math.min(160, width / Math.max(shownLeafs, 1) * 0.8)));
  const serverXs = distribute(center, shownServers, Math.max(serverSlotWidth, Math.min(104, width / Math.max(shownServers, 1) * 0.8)));
  const podCount = best.podCount || 1;
  const perPodLeafs = best.perPodLeafs || shownLeafs;
  const perPodSpines = best.perPodSpines || shownSpines;
  const podServerCount = best.podServerCount || shownServers;
  const lines = [];
  const switches = [];
  const servers = [];

  spineXs.forEach((x, index) => {
    const label = podCount > 1 ? `Pod ${Math.floor(index / perPodSpines) + 1} Spine ${(index % perPodSpines) + 1}` : `Spine ${index + 1}`;
    switches.push({ kind: "spine", x, y: spineY, w: switchW, h: switchH, label });
  });
  leafXs.forEach((leafX, leafIndex) => {
    const podIndex = Math.floor(leafIndex / perPodLeafs);
    const spineStart = podIndex * perPodSpines;
    const spineEnd = Math.min(spineStart + perPodSpines, spineXs.length);
    spineXs.slice(spineStart, spineEnd).forEach((spineX, localSpineIndex) => {
      const linkCount = linksForSpine(best.uplinksPerLeaf, perPodSpines, localSpineIndex);
      for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
        const offset = parallelOffset(linkIndex, linkCount, switchW - 28);
        lines.push({
          x1: leafX + offset,
          y1: leafY - switchH / 2,
          x2: spineX + offset,
          y2: spineY + switchH / 2,
          color: leafColor(leafIndex),
          kind: "uplink",
          title: `Leaf ${leafIndex + 1} uplink`,
        });
      }
    });
    const label = podCount > 1 ? `Pod ${Math.floor(leafIndex / perPodLeafs) + 1} Leaf ${(leafIndex % perPodLeafs) + 1}` : `Leaf ${leafIndex + 1}`;
    switches.push({ kind: "leaf", x: leafX, y: leafY, w: switchW, h: switchH, label });
  });

  serverXs.forEach((serverX, serverIndex) => {
    const nicLeafStart = (serverIndex * activeNicPorts) % best.leafCount;
    const ports = [];
    for (let nicIndex = 0; nicIndex < activeNicPorts; nicIndex += 1) {
      const leafIndex = podCount > 1
        ? Math.floor(serverIndex / podServerCount) * perPodLeafs + (((serverIndex % podServerCount) * activeNicPorts + nicIndex) % perPodLeafs)
        : (nicLeafStart + nicIndex) % shownLeafs;
      const nicX = nicPortX(serverX, serverW, input.serverNicPorts, nicIndex);
      const color = nicColor(nicIndex);
      ports.push({ x: nicX, y: serverY - serverH / 2 + 7, color });
      lines.push({
        x1: nicX,
        y1: serverY - serverH / 2,
        x2: leafXs[leafIndex],
        y2: leafY + switchH / 2,
        color,
        kind: "link",
        title: `Server NIC ${nicIndex + 1}`,
      });
    }
    servers.push({ x: serverX, y: serverY, w: serverW, h: serverH, number: serverIndex + 1, nicCount: input.serverNicPorts, label: `Server #${serverIndex + 1}`, ports });
  });

  return normalizeGeometryHorizontal({
    width,
    height,
    labels: [],
    lines,
    switches,
    servers,
    labelGutter,
  });
}

function buildSlideXml(geometry) {
  const slideW = 12192000;
  const slideH = 6858000;
  const margin = 274320;
  const scale = Math.min((slideW - margin * 2) / geometry.width, (slideH - margin * 2) / geometry.height);
  const offsetX = margin;
  const offsetY = margin;
  const toX = (value) => Math.round(offsetX + value * scale);
  const toY = (value) => Math.round(offsetY + value * scale);
  const toL = (value) => Math.round(value * scale);
  const shapes = [];
  let id = 2;

  shapes.push(pptRect(id++, 0, 0, slideW, slideH, "F8FBFF", "F8FBFF"));
  geometry.labels.forEach((label) => {
    shapes.push(pptText(id++, toX(label.x), toY(label.y - 9), toL(74), toL(18), label.text, "5B6B86", 11, true));
  });
  geometry.lines.forEach((lineData) => {
    shapes.push(pptLine(id++, toX(lineData.x1), toY(lineData.y1), toX(lineData.x2), toY(lineData.y2), cleanColor(lineData.color), 12700));
  });
  geometry.switches.forEach((sw) => {
    const bodyColor = sw.kind === "spine" ? "B45309" : "2563EB";
    const lineColor = sw.kind === "spine" ? "92400E" : "1E40AF";
    shapes.push(pptRect(id++, toX(sw.x - sw.w / 2), toY(sw.y - sw.h / 2), toL(sw.w), toL(sw.h), bodyColor, lineColor, "roundRect"));
    shapes.push(pptRect(id++, toX(sw.x - sw.w / 2 + 6), toY(sw.y - sw.h / 2 + 5), toL(sw.w - 12), toL(sw.h - 10), "FFFFFF", "FFFFFF", "roundRect", 18000));
    for (let i = 0; i < 10; i += 1) {
      shapes.push(pptRect(id++, toX(sw.x - sw.w / 2 + 14 + i * 7), toY(sw.y - 4), toL(4), toL(5), "E5E7EB", "111827", "rect"));
    }
    shapes.push(pptEllipse(id++, toX(sw.x + sw.w / 2 - 16.4), toY(sw.y - 4.4), toL(4.8), toL(4.8), "86EFAC", "166534"));
    shapes.push(pptText(id++, toX(sw.x - 45), toY(sw.y + sw.h / 2 + 5), toL(90), toL(18), sw.label, "0F172A", 9, true));
  });
  geometry.servers.forEach((server) => {
    shapes.push(pptRect(id++, toX(server.x - server.w / 2), toY(server.y - server.h / 2), toL(server.w), toL(server.h), "475569", "334155", "roundRect"));
    shapes.push(pptRect(id++, toX(server.x - server.w / 2 + 6), toY(server.y - server.h / 2 + 16), toL(server.w - 12), toL(server.h - 24), "64748B", "334155", "roundRect"));
    shapes.push(pptEllipse(id++, toX(server.x + server.w / 2 - 14.5), toY(server.y + server.h / 2 - 12.5), toL(5), toL(5), "86EFAC", "166534"));
    server.ports.forEach((port) => {
      shapes.push(pptRect(id++, toX(port.x - 3), toY(port.y), toL(6), toL(8), cleanColor(port.color), "1F2937", "rect"));
    });
    shapes.push(pptText(id++, toX(server.x - 45), toY(server.y + server.h / 2 + 5), toL(90), toL(18), server.label, "0F172A", 9, true));
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    ${shapes.join("\n")}
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function pptRect(id, x, y, w, h, fill, stroke, preset = "rect", transparency = 0) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}">${transparency ? `<a:alpha val="${100000 - transparency}"/>` : ""}</a:srgbClr></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln></p:spPr></p:sp>`;
}

function pptEllipse(id, x, y, w, h, fill, stroke) {
  return pptRect(id, x, y, w, h, fill, stroke, "ellipse");
}

function pptLine(id, x1, y1, x2, y2, color, width) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const cx = Math.abs(x2 - x1);
  const cy = Math.abs(y2 - y1);
  const flipH = x2 < x1 ? ' flipH="1"' : "";
  const flipV = y2 < y1 ? ' flipV="1"' : "";
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Line ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flipH}${flipV}><a:off x="${x}" y="${y}"/><a:ext cx="${Math.max(cx, 1)}" cy="${Math.max(cy, 1)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${width}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`;
}

function pptText(id, x, y, w, h, text, color, size, bold = false, align = "ctr") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none"/><a:lstStyle/><a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="ko-KR" sz="${size * 100}"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Segoe UI"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="ko-KR"/></a:p></p:txBody></p:sp>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/></Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function presentationXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
}

function presentationRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
}

function slideRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
}

function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
}

function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Leaf-Spine Theme"><a:themeElements><a:clrScheme name="Leaf-Spine"><a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="EEF5FF"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="B45309"/></a:accent2><a:accent3><a:srgbClr val="475569"/></a:accent3><a:accent4><a:srgbClr val="16A34A"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Leaf-Spine"><a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface="맑은 고딕"/><a:cs typeface="Segoe UI"/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface="맑은 고딕"/><a:cs typeface="Segoe UI"/></a:minorFont></a:fontScheme><a:fmtScheme name="Leaf-Spine"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function viewPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>`;
}

function tableStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
}

function appPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Leaf-Spine Planner</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>1</Slides></Properties>`;
}

function corePropsXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Leaf-Spine Topology</dc:title><dc:creator>임채성</dc:creator><cp:lastModifiedBy>임채성</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(files).forEach(([name, text]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const local = concatBytes(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data,
    );
    const central = concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes,
    );
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = concatBytes(
    u32(0x06054b50), u16(0), u16(0), u16(centralParts.length), u16(centralParts.length),
    u32(centralSize), u32(offset), u16(0),
  );
  return concatBytes(...localParts, ...centralParts, end);
}

function concatBytes(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function u16(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function cleanColor(color) {
  return color.replace("#", "").toUpperCase();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
