const form = document.querySelector("#networkForm");
const modeInputs = [...document.querySelectorAll("input[name='topologyMode']")];
const oversubField = document.querySelector("#oversubField");
const podField = document.querySelector("#podField");
const twinPortLabel = document.querySelector("#twinPortLabel");
const {
  calculate,
  effectiveSwitchLinkSpeed,
  leafSpineTwinFactor,
  calculateCableCounts,
  activeServerNicPorts,
  priorLinksForSpine,
  linksForSpine,
} = LeafSpineCalculator;

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
outputs.openDiagramWindow.addEventListener("click", () => LeafSpineDiagram.openWindow());
outputs.exportSvg.addEventListener("click", () => LeafSpineDiagram.exportSvg());
outputs.exportPng.addEventListener("click", () => LeafSpineDiagram.exportPng());
outputs.exportPptx.addEventListener("click", () => LeafSpineDiagram.exportPptx());
outputs.openPortMapWindow.addEventListener("click", () => LeafSpinePortMap.openWindow());
outputs.exportPdf.addEventListener("click", () => LeafSpineReport.exportPdf());
outputs.resetInputs.addEventListener("click", () => resetInputsToDefaults());
window.addEventListener("message", (event) => {
  if (event.data?.type === "leaf-spine-export-pptx") {
    LeafSpineDiagram.exportPptx(event.data.viewMode || diagramViewMode);
  }
  if (event.data?.type === "leaf-spine-export-port-map") {
    const actions = {
      excel: LeafSpinePortMap.exportExcel,
      ppt: LeafSpinePortMap.exportPpt,
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

function render(result) {
  currentResult = result.feasible ? result : null;
  if (!result.feasible) {
    outputs.calculationStatus.classList.remove("hidden");
    outputs.leafCount.textContent = "-";
    outputs.spineCount.textContent = "-";
    outputs.oversubRatio.textContent = "-";
    outputs.totalSwitches.textContent = "-";
    outputs.detailList.innerHTML = "";
    outputs.message.textContent = result.infeasibleReason || "현재 입력값으로 구성 가능한 Leaf-Spine 조합을 찾지 못했습니다.";
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
  const totalLeafUsedPorts = best.usedPortsPerLeaf * best.leafCount;
  const totalLeafUnusedPorts = best.unusedPortsPerLeaf * best.leafCount;
  const totalSpineUsedPorts = best.usedPortsPerSpine * best.spines;
  const totalSpineUnusedPorts = best.unusedPortsPerSpine * best.spines;
  const serverLeafTwinFactor = input.useTwinPort ? 2 : 1;
  const leafSpineLinkTwinFactor = leafSpineTwinFactor(input);
  const leafServerLinkTransceivers = Math.ceil(best.downlinks / serverLeafTwinFactor);
  const totalLeafServerLinkTransceivers = Math.ceil(result.totalServerLinks / serverLeafTwinFactor);
  const spineLeafLinkTransceivers = Math.ceil(best.logicalLinksPerSpine / leafSpineLinkTwinFactor);
  const totalSpineLeafLinkTransceivers = Math.ceil(best.totalLeafUplinks / leafSpineLinkTwinFactor);
  const serverLeafTransceiverType = input.useTwinPort ? "Twin-port Transceiver 사용" : "일반 Transceiver 사용";
  const leafSpineTransceiverType = leafSpineLinkTwinFactor > 1 ? "Twin-port Transceiver 사용" : "일반 Transceiver 사용";

  const details = [
    ...(input.useMultiPlanar ? [
      ["구성 방식", `Multi-planar design (${best.podCount} pods)`],
      ["Pod당 서버 수", `${best.podServerCount}대`],
      ["Pod당 Leaf/Spine", `${best.perPodLeafs} Leaf / ${best.perPodSpines} Spine`],
      ["separator"],
    ] : []),
    ["서버당 연결 포트", `${input.serverNicPorts.toLocaleString()}개`],
    ["전체 서버 연결 포트", `${result.totalServerLinks.toLocaleString()}개`],
    ["separator"],
    ["서버당 대역폭", `${formatGbps(result.serverBandwidth)}`],
    ["전체 서버 대역폭", `${formatGbps(result.totalServerBandwidth)}`],
    ["separator"],
    ["Leaf당 서버 링크", `${best.downlinks.toLocaleString()}개 (${formatGbps(best.leafDownlinkBandwidth)})`],
    ["전체 Leaf-서버 링크", `${result.totalServerLinks.toLocaleString()}개 (${formatGbps(totalLeafServerDownlinkBandwidth)})`],
    ["separator"],
    ["Leaf당 Spine 링크", `${best.uplinksPerLeaf.toLocaleString()}개 (${formatGbps(best.leafUplinkBandwidth)})`],
    ["전체 Leaf-Spine 링크", `${best.totalLeafUplinks.toLocaleString()}개 (${formatGbps(totalLeafSpineUplinkBandwidth)})`],
    ["separator"],
    ["Leaf당 총 사용 포트", `${best.usedPortsPerLeaf.toLocaleString()}/${best.switchPortCapacity.toLocaleString()}개 (논리 ${best.logicalPortsPerLeaf.toLocaleString()}개)`],
    ["Leaf당 총 예비 포트", `${best.unusedPortsPerLeaf.toLocaleString()}개`],
    ["전체 Leaf 총 사용 포트", `${totalLeafUsedPorts.toLocaleString()}개`],
    ["전체 Leaf 총 예비 포트", `${totalLeafUnusedPorts.toLocaleString()}개`],
    ["separator"],
    ["Spine당 Leaf 링크", `${best.logicalLinksPerSpine.toLocaleString()}개 (${formatGbps(best.logicalLinksPerSpine * effectiveSwitchLinkSpeed(input))})`],
    ["전체 Spine-Leaf 링크", `${best.totalLeafUplinks.toLocaleString()}개 (${formatGbps(totalLeafSpineUplinkBandwidth)})`],
    ["separator"],
    ["Spine당 총 사용 포트", `${best.usedPortsPerSpine.toLocaleString()}/${best.switchPortCapacity.toLocaleString()}개 (논리 ${best.logicalLinksPerSpine.toLocaleString()}개)`],
    ["Spine당 총 예비 포트", `${best.unusedPortsPerSpine.toLocaleString()}개`],
    ["전체 Spine 총 사용 포트", `${totalSpineUsedPorts.toLocaleString()}개`],
    ["전체 Spine 총 예비 포트", `${totalSpineUnusedPorts.toLocaleString()}개`],
    ["separator"],
    ["Leaf-Spine 연결 방식", `Leaf당 ${best.spines}대 Spine에 총 ${best.uplinksPerLeaf}개 업링크 분산`],
    ["Twin-port Transceiver 사용", input.useTwinPort ? "사용, 서버-Leaf 구간 적용" : "미사용"],
    ["Leaf-Spine 링크에 Twin-port Transceiver 사용", input.useTwinPort && input.disableUplinkTwinPort ? "미사용, 업링크 포트 속도 온전히 사용" : (input.useTwinPort ? "사용" : "미사용")],
    ["separator"],
    ["Leaf당 서버 링크 Transceiver", `${leafServerLinkTransceivers.toLocaleString()}개 (${serverLeafTransceiverType})`],
    ["Leaf당 서버 링크 케이블", `${best.downlinks.toLocaleString()}개`],
    ["전체 Leaf-서버 링크 Transceiver", `${totalLeafServerLinkTransceivers.toLocaleString()}개 (${serverLeafTransceiverType})`],
    ["전체 Leaf-서버 링크 케이블", `${result.totalServerLinks.toLocaleString()}개`],
    ["separator"],
    ["Spine당 Leaf 링크 Transceiver", `${spineLeafLinkTransceivers.toLocaleString()}개 (${leafSpineTransceiverType})`],
    ["Spine당 Leaf 링크 케이블", `${best.logicalLinksPerSpine.toLocaleString()}개`],
    ["전체 Spine-Leaf 링크 Transceiver", `${totalSpineLeafLinkTransceivers.toLocaleString()}개 (${leafSpineTransceiverType})`],
    ["전체 Spine-Leaf 링크 케이블", `${best.totalLeafUplinks.toLocaleString()}개`],
    ["separator"],
  ];

  outputs.detailList.innerHTML = details
    .map(([label, value]) => label === "separator"
      ? `<dt class="detail-separator"></dt>`
      : `<dt>${label}</dt><dd>${value}</dd>`)
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
  return LeafSpineDiagram.makeForView(result, diagramViewMode);
}

function getDiagramGeometryForView(result, viewMode) {
  return LeafSpineDiagram.getGeometryForView(result, viewMode);
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
