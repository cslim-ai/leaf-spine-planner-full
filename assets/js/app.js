/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const form = document.querySelector("#networkForm");
const modeInputs = [...document.querySelectorAll("input[name='topologyMode']")];
const oversubField = document.querySelector("#oversubField");
const podField = document.querySelector("#podField");
const nodeTwinPortNotice = document.querySelector("#nodeTwinPortNotice");
const twinPortLabel = document.querySelector("#twinPortLabel");
const spineTwinPortLabel = document.querySelector("#spineTwinPortLabel");
const {
  calculate,
  effectiveSwitchLinkSpeed,
  leafSpineTwinFactor,
  leafSpineLeafTwinFactor,
  calculateCableCounts,
  activeServerNicPorts,
  priorLinksForSpine,
  linksForSpine,
} = LeafSpineCalculator;
const {
  makeEcmpPathCountDetail,
} = LeafSpineResultDetails;

const fields = {
  serverCount: document.querySelector("#serverCount"),
  serverNicPorts: document.querySelector("#serverNicPorts"),
  serverLinkSpeed: document.querySelector("#serverLinkSpeed"),
  useCustomSwitchCounts: document.querySelector("#useCustomSwitchCounts"),
  customLeafCount: document.querySelector("#customLeafCount"),
  customSpineCount: document.querySelector("#customSpineCount"),
  switchPorts: document.querySelector("#switchPorts"),
  leafMinSparePorts: document.querySelector("#leafMinSparePorts"),
  switchLinkSpeed: document.querySelector("#switchLinkSpeed"),
  useTwinPort: document.querySelector("#useTwinPort"),
  disableUplinkTwinPort: document.querySelector("#disableUplinkTwinPort"),
  spineSameAsLeaf: document.querySelector("#spineSameAsLeaf"),
  spineSwitchPorts: document.querySelector("#spineSwitchPorts"),
  spineSwitchLinkSpeed: document.querySelector("#spineSwitchLinkSpeed"),
  spineUseTwinPort: document.querySelector("#spineUseTwinPort"),
  targetOversub: document.querySelector("#targetOversub"),
  useMultiPlanar: document.querySelector("#useMultiPlanar"),
  useMultiPods: document.querySelector("#useMultiPods"),
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
  topologyExportMenu: document.querySelector("#topologyExportMenu"),
  exportDiagram: document.querySelector("#exportDiagram"),
  openPortMapWindow: document.querySelector("#openPortMapWindow"),
  reportExportMenu: document.querySelector("#reportExportMenu"),
  exportPdf: document.querySelector("#exportPdf"),
  inputTransferMenu: document.querySelector("#inputTransferMenu"),
  importExportInputs: document.querySelector("#importExportInputs"),
  importInputsFile: document.querySelector("#importInputsFile"),
  resetInputs: document.querySelector("#resetInputs"),
  languageSelect: document.querySelector("#languageSelect"),
  appTitle: document.querySelector("#appTitle"),
};

const I18N = typeof LeafSpineI18n !== "undefined" ? LeafSpineI18n : null;
const LOCALE_STORAGE_KEY = "leaf-spine-planner-locale";
const DISABLED_LOCALES = new Set(["en"]);
const INPUT_RENDER_DEBOUNCE_MS = 150;
let currentLocale = resolveInitialLocale();
const inputRenderScheduler = LeafSpineRenderScheduler.createDebouncedScheduler(renderCurrentConfiguration, INPUT_RENDER_DEBOUNCE_MS);

let diagramZoom = 1;
let diagramPan = { x: 0, y: 0 };
let dragState = null;
let suppressNextDiagramClick = false;
let diagramViewMode = "full";
const MIN_DIAGRAM_ZOOM = 0.1;
const MAX_DIAGRAM_ZOOM = 10;
const MIN_RENDERED_DIAGRAM_SCALE = 0.15;
const MAX_RENDERED_DIAGRAM_SCALE = 10;
const DIAGRAM_ZOOM_STEP = 0.05;
const DEFAULT_DIAGRAM_VIEW_WIDTH = 920;
const DEFAULT_DIAGRAM_VIEW_HEIGHT = 500;
const DIAGRAM_FIT_PADDING_X = 50;
const DIAGRAM_FIT_PADDING_Y = 100;
const DIAGRAM_LABEL_GUTTER = 0;
const DIAGRAM_CONTENT_OFFSET = 96;
let currentResult = null;
let latestResult = null;
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
fields.useMultiPods.addEventListener("change", updateMode);
fields.spineUseTwinPort.addEventListener("change", () => {
  fields.spineUseTwinPort.dataset.userChanged = "1";
});
fields.spineSameAsLeaf.addEventListener("change", () => {
  syncSpineSwitchFields();
  updateTwinPortState();
  renderCurrentConfigurationIfValid();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  renderCurrentConfigurationNow();
});

Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => {
    updateTwinPortState();
    scheduleCurrentConfigurationRender();
  });
});

outputs.zoomIn.addEventListener("click", () => setRenderedDiagramScaleByStep(DIAGRAM_ZOOM_STEP));
outputs.zoomOut.addEventListener("click", () => setRenderedDiagramScaleByStep(-DIAGRAM_ZOOM_STEP));
outputs.zoomReset.addEventListener("click", () => resetDiagramView());
outputs.zoomCenter.addEventListener("click", () => centerDiagramView());
outputs.zoomFit.addEventListener("click", () => fitDiagramView());
outputs.viewFull.addEventListener("click", () => setDiagramViewMode("full"));
outputs.viewWrapped.addEventListener("click", () => setDiagramViewMode("wrapped"));
outputs.viewSummary.addEventListener("click", () => setDiagramViewMode("summary"));
outputs.openDiagramWindow.addEventListener("click", () => LeafSpineDiagram.openWindow());
setupExportMenu(outputs.topologyExportMenu, outputs.exportDiagram, exportDiagramByFormat);
outputs.openPortMapWindow.addEventListener("click", () => LeafSpinePortMap.openWindow());
outputs.exportPdf.addEventListener("click", handleReportTriggerClick, true);
setupExportMenu(outputs.reportExportMenu, outputs.exportPdf, (format) => LeafSpineReport.export(format));
setupExportMenu(outputs.inputTransferMenu, outputs.importExportInputs, handleInputTransferAction);
outputs.importInputsFile.addEventListener("change", handleImportInputsFile);
outputs.resetInputs.addEventListener("click", () => resetInputsToDefaults());
outputs.languageSelect?.addEventListener("change", () => setLocale(outputs.languageSelect.value));
outputs.appTitle?.addEventListener("click", () => window.location.reload());
outputs.appTitle?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  window.location.reload();
});
document.addEventListener("click", () => closeExportMenus());
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
  if (event.data?.type === "leaf-spine-open-port-map") {
    LeafSpinePortMap.openWindow();
  }
});
outputs.diagram.addEventListener("wheel", (event) => {
  if (!outputs.diagram.querySelector("svg")) return;
  event.preventDefault();
  setRenderedDiagramScaleByStep(event.deltaY < 0 ? DIAGRAM_ZOOM_STEP : -DIAGRAM_ZOOM_STEP, {
    x: event.clientX,
    y: event.clientY,
  });
}, { passive: false });
outputs.diagram.addEventListener("click", handleDiagramHighlightClick);
if (window.PointerEvent) {
  outputs.diagram.addEventListener("pointerdown", startDiagramDrag);
  window.addEventListener("pointermove", moveDiagramDrag);
  window.addEventListener("pointerup", endDiagramDrag);
} else {
  outputs.diagram.addEventListener("mousedown", startDiagramDrag);
  window.addEventListener("mousemove", moveDiagramDrag);
  window.addEventListener("mouseup", endDiagramDrag);
}
window.addEventListener("resize", () => {
  updateBodyScrollbarCompensation();
  fitDiagramView();
});
if (window.ResizeObserver) {
  const diagramResizeObserver = new ResizeObserver(() => {
    updateBodyScrollbarCompensation();
    fitDiagramView();
  });
  diagramResizeObserver.observe(outputs.diagram);
}

initializeLocale();
updateBodyScrollbarCompensation();
updateMode();
updateTwinPortState();
renderCurrentConfigurationNow();

function setupExportMenu(menu, trigger, onSelect) {
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !menu.classList.contains("is-open");
    closeExportMenus();
    menu.classList.toggle("is-open", willOpen);
  });

  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-export-value]");
    if (!option) return;
    event.stopPropagation();
    menu.classList.remove("is-open");
    onSelect(option.dataset.exportValue);
  });
}

function closeExportMenus(except = null) {
  document.querySelectorAll(".export-menu.is-open").forEach((menu) => {
    if (menu !== except) menu.classList.remove("is-open");
  });
}

function renderCurrentConfiguration() {
  render(calculate(readInput()));
}

function renderCurrentConfigurationNow() {
  inputRenderScheduler.cancel();
  renderCurrentConfiguration();
}

function renderCurrentConfigurationIfValid() {
  if (!form.reportValidity()) {
    inputRenderScheduler.cancel();
    return;
  }
  renderCurrentConfigurationNow();
}

function scheduleCurrentConfigurationRender() {
  if (!form.reportValidity()) {
    inputRenderScheduler.cancel();
    return;
  }
  inputRenderScheduler.schedule();
}

function initializeLocale() {
  if (outputs.languageSelect) {
    [...outputs.languageSelect.options].forEach((option) => {
      option.disabled = DISABLED_LOCALES.has(option.value);
    });
    outputs.languageSelect.value = currentLocale;
  }
  applyStaticText();
}

function setLocale(locale) {
  currentLocale = normalizeSelectableLocale(locale);
  savePreferredLocale(currentLocale);
  if (outputs.languageSelect) {
    outputs.languageSelect.value = currentLocale;
  }
  applyStaticText();
  updateTwinPortLabel();
  renderCurrentConfigurationNow();
}

function resolveInitialLocale() {
  const storedLocale = loadPreferredLocale();
  if (I18N?.SUPPORTED_LOCALES?.includes(storedLocale)) return normalizeSelectableLocale(storedLocale);
  return normalizeSelectableLocale(I18N?.detectLocale() || "en");
}

function normalizeSelectableLocale(locale) {
  if (!I18N?.SUPPORTED_LOCALES?.includes(locale) || DISABLED_LOCALES.has(locale)) {
    return "ko";
  }
  return locale;
}

function loadPreferredLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePreferredLocale(locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale persistence is optional; the UI still works if storage is unavailable.
  }
}

function tr(path, params = {}) {
  return I18N?.t ? I18N.t(path, params, currentLocale) : path;
}

function applyStaticText() {
  document.documentElement.lang = currentLocale;
  document.title = tr("meta.documentTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", tr(element.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", tr(element.dataset.i18nAriaLabel));
  });
  renderEmailContacts();
}

function renderEmailContacts() {
  document.querySelectorAll("[data-email-user][data-email-domain][data-email-tld]").forEach((element) => {
    const { emailUser, emailDomain, emailTld } = element.dataset;
    element.textContent = `${emailUser}@${emailDomain}.${emailTld}`;
  });
}

function exportDiagramByFormat(format) {
  if (format === "png") {
    LeafSpineDiagram.exportPng();
    return;
  }
  if (format === "ppt") {
    LeafSpineDiagram.exportPptx();
    return;
  }
  LeafSpineDiagram.exportSvg();
}

function handleInputTransferAction(action) {
  if (action === "export-json") {
    exportInputConfig();
    return;
  }
  if (action === "import-json") {
    outputs.importInputsFile.value = "";
    outputs.importInputsFile.click();
  }
}

function exportInputConfig() {
  const payload = LeafSpineInputState.createPayload(collectInputConfig());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const filename = exportFilename("leaf-spine-inputs", "json");
  downloadBlob(blob, filename);
}

async function handleImportInputsFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    const imported = LeafSpineInputState.parsePayload(await file.text());
    applyInputConfig(imported);
    if (!form.reportValidity()) return;
    renderCurrentConfigurationNow();
  } catch (error) {
    alert(error.message || tr("messages.importError"));
  }
}

function collectInputConfig() {
  return {
    serverCount: toInt(fields.serverCount.value),
    serverNicPorts: toInt(fields.serverNicPorts.value),
    serverLinkSpeed: toFloat(fields.serverLinkSpeed.value),
    useCustomSwitchCounts: fields.useCustomSwitchCounts.checked,
    customLeafCount: toInt(fields.customLeafCount.value),
    customSpineCount: toInt(fields.customSpineCount.value),
    switchPorts: toInt(fields.switchPorts.value),
    leafMinSparePorts: toNonNegativeInt(fields.leafMinSparePorts.value),
    switchLinkSpeed: toFloat(fields.switchLinkSpeed.value),
    useTwinPort: fields.useTwinPort.checked,
    disableUplinkTwinPort: fields.disableUplinkTwinPort.checked,
    spineSameAsLeaf: fields.spineSameAsLeaf.checked,
    spineSwitchPorts: toInt(fields.spineSwitchPorts.value),
    spineSwitchLinkSpeed: toFloat(fields.spineSwitchLinkSpeed.value),
    spineUseTwinPort: fields.spineUseTwinPort.checked,
    topologyMode: getMode(),
    targetOversub: toFloat(fields.targetOversub.value),
    useMultiPlanar: fields.useMultiPlanar.checked,
    useMultiPods: fields.useMultiPods.checked,
    podServerCount: toInt(fields.podServerCount.value),
  };
}

function applyInputConfig(input) {
  fields.serverCount.value = input.serverCount;
  fields.serverNicPorts.value = input.serverNicPorts;
  fields.serverLinkSpeed.value = input.serverLinkSpeed;
  fields.useCustomSwitchCounts.checked = input.useCustomSwitchCounts;
  fields.customLeafCount.value = input.customLeafCount;
  fields.customSpineCount.value = input.customSpineCount;
  fields.switchPorts.value = input.switchPorts;
  fields.leafMinSparePorts.value = input.leafMinSparePorts || 0;
  fields.switchLinkSpeed.value = input.switchLinkSpeed;
  fields.useTwinPort.checked = input.useTwinPort;
  fields.disableUplinkTwinPort.checked = Boolean(input.disableUplinkTwinPort);
  fields.spineSameAsLeaf.checked = input.spineSameAsLeaf;
  fields.spineSwitchPorts.value = input.spineSwitchPorts;
  fields.spineSwitchLinkSpeed.value = input.spineSwitchLinkSpeed;
  fields.spineUseTwinPort.checked = input.spineUseTwinPort;
  if (input.spineUseTwinPort) {
    fields.spineUseTwinPort.dataset.userChanged = "1";
  } else {
    delete fields.spineUseTwinPort.dataset.userChanged;
  }
  modeInputs.forEach((modeInput) => {
    modeInput.checked = modeInput.value === input.topologyMode;
  });
  fields.targetOversub.value = input.targetOversub;
  fields.useMultiPlanar.checked = input.useMultiPlanar;
  fields.useMultiPods.checked = input.useMultiPods;
  fields.podServerCount.value = input.podServerCount;
  updateMode();
  updateCustomSwitchState();
  updateTwinPortState();
}

function updateMode() {
  const mode = getMode();
  oversubField.classList.toggle("hidden", mode !== "oversubscribed");
  podField.classList.toggle("hidden", !fields.useMultiPods.checked);
  updateTwinPortState();
}

function getMode() {
  return document.querySelector("input[name='topologyMode']:checked").value;
}

function readInput() {
  return {
    serverCount: toInt(fields.serverCount.value),
    serverNicPorts: toInt(fields.serverNicPorts.value),
    serverLinkSpeed: toFloat(fields.serverLinkSpeed.value),
    useCustomSwitchCounts: fields.useCustomSwitchCounts.checked,
    customLeafCount: toInt(fields.customLeafCount.value),
    customSpineCount: toInt(fields.customSpineCount.value),
    switchPorts: toInt(fields.switchPorts.value),
    leafMinSparePorts: toNonNegativeInt(fields.leafMinSparePorts.value),
    switchLinkSpeed: toFloat(fields.switchLinkSpeed.value),
    leafSwitchPorts: toInt(fields.switchPorts.value),
    leafSwitchLinkSpeed: toFloat(fields.switchLinkSpeed.value),
    useNodeTwinPort: fields.useMultiPlanar.checked,
    useTwinPort: fields.useTwinPort.checked && !fields.useTwinPort.disabled,
    disableUplinkTwinPort: fields.disableUplinkTwinPort.checked,
    spineSameAsLeaf: fields.spineSameAsLeaf.checked,
    spineSwitchPorts: toInt(fields.spineSameAsLeaf.checked ? fields.switchPorts.value : fields.spineSwitchPorts.value),
    spineSwitchLinkSpeed: toFloat(fields.spineSameAsLeaf.checked ? fields.switchLinkSpeed.value : fields.spineSwitchLinkSpeed.value),
    spineUseTwinPort: fields.spineUseTwinPort.checked && !fields.spineUseTwinPort.disabled,
    mode: getMode(),
    targetOversub: toFloat(fields.targetOversub.value),
    useMultiPlanar: fields.useMultiPlanar.checked,
    useMultiPods: fields.useMultiPods.checked,
    podServerCount: toInt(fields.podServerCount.value),
  };
}

function resetInputsToDefaults() {
  fields.serverCount.value = "8";
  fields.serverNicPorts.value = "8";
  fields.serverLinkSpeed.value = "400";
  fields.useCustomSwitchCounts.checked = false;
  fields.customLeafCount.value = "2";
  fields.customSpineCount.value = "2";
  fields.switchPorts.value = "64";
  fields.leafMinSparePorts.value = "0";
  fields.switchLinkSpeed.value = "400";
  fields.useTwinPort.checked = false;
  fields.disableUplinkTwinPort.checked = false;
  fields.spineSameAsLeaf.checked = true;
  fields.spineSwitchPorts.value = "64";
  fields.spineSwitchLinkSpeed.value = "400";
  fields.spineUseTwinPort.checked = false;
  delete fields.spineUseTwinPort.dataset.userChanged;
  fields.targetOversub.value = "3";
  fields.useMultiPlanar.checked = false;
  fields.useMultiPods.checked = false;
  fields.podServerCount.value = "64";
  modeInputs.forEach((input) => {
    input.checked = input.value === "nonblocking";
  });
  updateMode();
  updateCustomSwitchState();
  updateTwinPortState();
  setDiagramViewMode("full");
  renderCurrentConfigurationNow();
}

function updateTwinPortState() {
  updateCustomSwitchState();
  syncSpineSwitchFields();
  const leafSpeed = Number.parseFloat(fields.switchLinkSpeed.value) || 0;
  const leafSpeedTooLow = leafSpeed < 200;
  const leafTwinDisabled = leafSpeedTooLow;
  fields.useTwinPort.disabled = leafTwinDisabled;
  if (leafSpeedTooLow) fields.useTwinPort.checked = false;
  fields.useTwinPort.closest("label")?.classList.toggle("is-disabled", leafTwinDisabled);

  const spineSpeed = Number.parseFloat(fields.spineSwitchLinkSpeed.value) || 0;
  const spineTwinDisabled = leafSpeed < 200 || spineSpeed < 200;
  fields.spineUseTwinPort.disabled = spineTwinDisabled;
  if (spineTwinDisabled) {
    fields.spineUseTwinPort.checked = false;
  }
  fields.spineUseTwinPort.closest("label")?.classList.toggle("is-disabled", spineTwinDisabled);

  updateTwinPortLabel();
}

function updateCustomSwitchState() {
  const enabled = fields.useCustomSwitchCounts.checked;
  document.querySelector("#customLeafCountField")?.classList.toggle("hidden", !enabled);
  document.querySelector("#customSpineCountField")?.classList.toggle("hidden", !enabled);
}

function syncSpineSwitchFields() {
  const sameAsLeaf = fields.spineSameAsLeaf.checked;
  if (sameAsLeaf) {
    fields.spineSwitchPorts.value = fields.switchPorts.value;
    fields.spineSwitchLinkSpeed.value = fields.switchLinkSpeed.value;
  }
  [fields.spineSwitchPorts, fields.spineSwitchLinkSpeed].forEach((field) => {
    field.disabled = sameAsLeaf;
    field.closest("label")?.classList.toggle("is-disabled", sameAsLeaf);
  });
}

function updateTwinPortLabel() {
  if (nodeTwinPortNotice) {
    const nodeSpeedTooLow = (Number.parseFloat(fields.serverLinkSpeed.value) || 0) < 200;
    nodeTwinPortNotice.textContent = tr("sidebar.nodeTwinPortNotice", { speed: getTwinPortSpeedText(fields.serverLinkSpeed) });
    nodeTwinPortNotice.classList.toggle("hidden", !fields.useMultiPlanar.checked || nodeSpeedTooLow);
  }
  if (!twinPortLabel) return;
  twinPortLabel.textContent = tr("sidebar.leafTwinPort", { speed: getTwinPortSpeedText(fields.switchLinkSpeed) });
  if (spineTwinPortLabel) {
    spineTwinPortLabel.textContent = tr("sidebar.spineTwinPort", { speed: getTwinPortSpeedText(fields.spineSwitchLinkSpeed) });
  }
}

function getTwinPortSpeedText(field = fields.switchLinkSpeed) {
  const perLaneSpeed = Math.max(1, Number.parseFloat(field.value) || 1) / 2;
  return `2x${formatSpeedValue(perLaneSpeed)} Gbps`;
}

function formatSpeedValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function formatCount(value) {
  const formatted = Number(value).toLocaleString();
  return currentLocale === "ko" ? `${formatted}개` : formatted;
}

function toInt(value) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function toNonNegativeInt(value) {
  return Math.max(0, Number.parseInt(value, 10) || 0);
}

function toFloat(value) {
  return Math.max(1, Number.parseFloat(value) || 1);
}

function render(result) {
  latestResult = result;
  currentResult = result.feasible ? result : null;
  if (!result.feasible) {
    outputs.calculationStatus.classList.remove("hidden");
    outputs.leafCount.textContent = "-";
    outputs.spineCount.textContent = "-";
    outputs.oversubRatio.textContent = "-";
    outputs.totalSwitches.textContent = "-";
    outputs.detailList.innerHTML = "";
    outputs.message.textContent = makeInfeasibleMessage(result);
    outputs.message.classList.add("is-warning");
    outputs.diagram.innerHTML = "";
    outputs.diagramCaption.textContent = "";
    resetDiagramView();
    LeafSpineDiagram.clearOpenWindows();
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
  const leafSpineLeafLinkTwinFactor = leafSpineLeafTwinFactor(input);
  const leafSpineLinkTwinFactor = leafSpineTwinFactor(input);
  const leafServerLinkTransceivers = Math.ceil(best.downlinks / serverLeafTwinFactor);
  const totalLeafServerLinkTransceivers = Math.ceil(result.totalServerLinks / serverLeafTwinFactor);
  const leafSpineLinkTransceivers = Math.ceil(best.uplinksPerLeaf / leafSpineLeafLinkTwinFactor);
  const totalLeafSpineLinkTransceivers = Math.ceil(best.totalLeafUplinks / leafSpineLeafLinkTwinFactor);
  const spineLeafLinkTransceivers = Math.ceil(best.logicalLinksPerSpine / leafSpineLinkTwinFactor);
  const totalSpineLeafLinkTransceivers = Math.ceil(best.totalLeafUplinks / leafSpineLinkTwinFactor);
  const serverLeafTransceiverType = input.useTwinPort ? tr("results.values.twinPortTransceiver") : tr("results.values.normalTransceiver");
  const leafTwinUsageText = getLeafTwinUsageText(input, leafSpineLeafLinkTwinFactor);
  const leafUplinkTransceiverType = leafSpineLeafLinkTwinFactor > 1 ? tr("results.values.twinPortTransceiver") : tr("results.values.normalTransceiver");
  const spineTransceiverType = leafSpineLinkTwinFactor > 1 ? tr("results.values.twinPortTransceiver") : tr("results.values.normalTransceiver");
  const spineSwitchPortCapacity = best.spineSwitchPortCapacity || best.switchPortCapacity;
  const leafSpineBalanceText = best.balancedLeafSpineLinks
    ? tr("results.values.balanced", { spineCount: best.spines, linksPerSpine: best.uplinksPerLeaf / best.spines })
    : tr("results.values.unbalanced", { minLinks: Math.floor(best.uplinksPerLeaf / best.spines), maxLinks: Math.ceil(best.uplinksPerLeaf / best.spines) });
  const details = [
    ["group", tr("results.groups.node")],
    [tr("results.labels.nodeLinkPortsPerNode"), formatCount(input.serverNicPorts)],
    [tr("results.labels.totalNodeLinkPorts"), formatCount(result.totalServerLinks)],
    [tr("results.labels.bandwidthPerNode"), `${formatGbps(result.serverBandwidth)}`],
    [tr("results.labels.totalNodeBandwidth"), `${formatGbps(result.totalServerBandwidth)}`],
    ["group", tr("results.groups.leafDownlink")],
    [tr("results.labels.nodeLinksPerLeaf"), `${formatCount(best.downlinks)} (${formatGbps(best.leafDownlinkBandwidth)})`],
    [tr("results.labels.totalLeafNodeLinks"), `${formatCount(result.totalServerLinks)} (${formatGbps(totalLeafServerDownlinkBandwidth)})`],
    ["group", tr("results.groups.leafSpineUplink")],
    [tr("results.labels.spineLinksPerLeaf"), `${formatCount(best.uplinksPerLeaf)} (${formatGbps(best.leafUplinkBandwidth)})`],
    [tr("results.labels.totalLeafSpineLinks"), `${formatCount(best.totalLeafUplinks)} (${formatGbps(totalLeafSpineUplinkBandwidth)})`],
    makeEcmpPathCountDetail(best, tr),
    ["group", tr("results.groups.leafPortUsage")],
    [tr("results.labels.usedPortsPerLeaf"), tr("results.values.logicalPorts", { used: best.usedPortsPerLeaf.toLocaleString(), capacity: best.switchPortCapacity.toLocaleString(), logical: best.logicalPortsPerLeaf.toLocaleString() })],
    [tr("results.labels.requiredSparePortsPerLeaf"), formatCount(best.requiredLeafSparePorts || 0)],
    [tr("results.labels.sparePortsPerLeaf"), formatCount(best.unusedPortsPerLeaf)],
    [tr("results.labels.totalLeafUsedPorts"), formatCount(totalLeafUsedPorts)],
    [tr("results.labels.totalLeafSparePorts"), formatCount(totalLeafUnusedPorts)],
    [tr("results.labels.leafTwinPortUsage"), leafTwinUsageText],
    ["group", tr("results.groups.spinePortUsage")],
    [tr("results.labels.leafLinksPerSpine"), `${formatCount(best.logicalLinksPerSpine)} (${formatGbps(best.logicalLinksPerSpine * effectiveSwitchLinkSpeed(input))})`],
    [tr("results.labels.totalSpineLeafLinks"), `${formatCount(best.totalLeafUplinks)} (${formatGbps(totalLeafSpineUplinkBandwidth)})`],
    [tr("results.labels.usedPortsPerSpine"), tr("results.values.logicalPorts", { used: best.usedPortsPerSpine.toLocaleString(), capacity: spineSwitchPortCapacity.toLocaleString(), logical: best.logicalLinksPerSpine.toLocaleString() })],
    [tr("results.labels.sparePortsPerSpine"), formatCount(best.unusedPortsPerSpine)],
    [tr("results.labels.totalSpineUsedPorts"), formatCount(totalSpineUsedPorts)],
    [tr("results.labels.totalSpineSparePorts"), formatCount(totalSpineUnusedPorts)],
    [tr("results.labels.spineTwinPortUsage"), input.spineUseTwinPort ? tr("results.values.spineTwinLeafSpine") : tr("common.unused")],
    ["group", tr("results.groups.leafSpineBalance")],
    [tr("results.labels.leafSpineConnection"), tr("results.values.leafSpineConnection", { spineCount: best.spines, uplinksPerLeaf: best.uplinksPerLeaf })],
    [tr("results.labels.leafSpineBalanceStatus"), leafSpineBalanceText],
    ["group", tr("results.groups.nodeLeafMedia")],
    [tr("results.labels.leafNodeTransceiverPerLeaf"), `${formatCount(leafServerLinkTransceivers)} (${serverLeafTransceiverType})`],
    [tr("results.labels.leafNodeCablePerLeaf"), formatCount(best.downlinks)],
    [tr("results.labels.totalLeafNodeTransceivers"), `${formatCount(totalLeafServerLinkTransceivers)} (${serverLeafTransceiverType})`],
    [tr("results.labels.totalLeafNodeCables"), formatCount(result.totalServerLinks)],
    ["group", tr("results.groups.leafSpineMedia")],
    [tr("results.labels.leafSpineTransceiverPerLeaf"), `${formatCount(leafSpineLinkTransceivers)} (${leafUplinkTransceiverType})`],
    [tr("results.labels.totalLeafSpineTransceivers"), `${formatCount(totalLeafSpineLinkTransceivers)} (${leafUplinkTransceiverType})`],
    [tr("results.labels.spineLeafTransceiverPerSpine"), `${formatCount(spineLeafLinkTransceivers)} (${spineTransceiverType})`],
    [tr("results.labels.spineLeafCablePerSpine"), formatCount(best.logicalLinksPerSpine)],
    [tr("results.labels.totalSpineLeafTransceivers"), `${formatCount(totalSpineLeafLinkTransceivers)} (${spineTransceiverType})`],
    [tr("results.labels.totalSpineLeafCables"), formatCount(best.totalLeafUplinks)],
    ["separator"],
  ];

  outputs.detailList.innerHTML = details
    .map(([label, value]) => {
      if (label === "separator") return `<dt class="detail-separator"></dt>`;
      if (label === "group") return `<dt class="detail-group">${value}</dt>`;
      const valueClass = isWarningDetail(label, value)
        ? " class=\"is-warning\""
        : "";
      return `<dt>${label}</dt><dd${valueClass}>${value}</dd>`;
    })
    .join("");

  const message = makeMessage(result);
  outputs.message.textContent = message;
  outputs.message.classList.toggle(
    "is-warning",
    message.includes("포트 호환성") || message.includes("물리 포트 사용량") || message.includes("권장")
      || message.includes("균등하지") || message.includes("compatibility") || message.includes("physical")
      || message.includes("Increase") || message.includes("not evenly"),
  );
  outputs.diagram.innerHTML = makeDiagramForView(result);
  adjustCurrentDiagramLabelBadges();
  setupDiagramHighlight();
  fitDiagramView();
  updateDiagramViewButtons();
  outputs.diagramCaption.textContent = "";
  LeafSpineDiagram.syncOpenWindows(currentResult);
}

function updateBodyScrollbarCompensation() {
  const root = document.documentElement;
  const hasHorizontalScrollbar = root.scrollWidth > root.clientWidth + 1;
  const scrollbarHeight = hasHorizontalScrollbar ? Math.max(0, window.innerHeight - root.clientHeight) : 0;
  root.style.setProperty("--body-horizontal-scrollbar-height", `${scrollbarHeight}px`);
}

function makeInfeasibleMessage(result) {
  const reason = result.infeasibleReason || tr("results.defaultInfeasibleMessage");
  const advice = makeInfeasibleAdvice(result);
  return advice ? `${reason}\n\n${tr("messages.recommendedAction")} ${advice}` : reason;
}

function makeInfeasibleAdvice({ input, infeasibleReason = "" }) {
  const reason = String(infeasibleReason);
  if (input?.useMultiPlanar && input.serverLinkSpeed < 200) {
    return tr("messages.infeasibleAdvice.multiPlanarSpeed");
  }
  if (reason.includes("Leaf")) {
    return tr("messages.infeasibleAdvice.leafCapacity");
  }
  if (reason.includes("Spine") || reason.includes("full") || reason.includes("전체 연결")) {
    return tr("messages.infeasibleAdvice.spineCapacity");
  }
  if (reason.includes("대역폭") || reason.toLowerCase().includes("bandwidth")) {
    return tr("messages.infeasibleAdvice.bandwidth");
  }
  if (input?.useCustomSwitchCounts) {
    return tr("messages.infeasibleAdvice.customSwitch");
  }
  return tr("messages.infeasibleAdvice.general");
}

function isWarningDetail(label, value) {
  const text = String(value);
  if (label === tr("results.labels.leafSpineBalanceStatus") && (text.startsWith("불균등") || text.startsWith("Unbalanced"))) return true;
  if ((label === tr("results.labels.sparePortsPerLeaf") || label === tr("results.labels.sparePortsPerSpine")) && (text.startsWith("0개") || text === "0")) return true;
  return false;
}

function getLeafTwinUsageText(input, leafSpineLeafLinkTwinFactor) {
  if (!input.useTwinPort) return tr("results.values.leafTwinUnused");
  if (leafSpineLeafLinkTwinFactor > 1) return tr("results.values.leafTwinNodeLeafAndLeafSpine");
  return tr("results.values.leafTwinNodeLeafOnly");
}

function handleReportTriggerClick(event) {
  if (latestResult?.feasible === false) {
    event.preventDefault();
    event.stopImmediatePropagation();
    outputs.reportExportMenu.classList.remove("is-open");
    alert(tr("messages.reportInfeasible"));
  }
}

function setDiagramViewMode(mode) {
  diagramViewMode = mode;
  if (currentResult) {
    outputs.diagram.innerHTML = makeDiagramForView(currentResult);
    adjustCurrentDiagramLabelBadges();
    setupDiagramHighlight();
  }
  fitDiagramView();
  updateDiagramViewButtons();
}

function adjustCurrentDiagramLabelBadges() {
  const svg = outputs.diagram.querySelector("svg");
  LeafSpineDiagram.adjustLabelBadges(svg);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      LeafSpineDiagram.adjustLabelBadges(outputs.diagram.querySelector("svg"));
    });
  }
}

function setupDiagramHighlight() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  svg.querySelectorAll(getDiagramHighlightItemSelector()).forEach((item) => {
    item.classList.remove("is-selected", "is-highlighted", "is-dimmed");
  });
}

function handleDiagramHighlightClick(event) {
  if (suppressNextDiagramClick) {
    suppressNextDiagramClick = false;
    return;
  }
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  highlightDiagramTarget(svg, event.target);
}

function highlightDiagramTarget(svg, target) {
  const node = target?.closest?.("[data-device]");
  if (!node || !svg.contains(node)) {
    clearDiagramHighlight(svg);
    return;
  }
  const strictKeys = usesDiagramUniqueHighlightKeys(svg);
  highlightDiagramDevice(svg, getDiagramHighlightKey(node, strictKeys), strictKeys);
}

function highlightDiagramDevice(svg, selectedKey, strictKeys = usesDiagramUniqueHighlightKeys(svg)) {
  if (!selectedKey) {
    clearDiagramHighlight(svg);
    return;
  }
  const links = svg.querySelectorAll("[data-source-key], [data-target-key], [data-source][data-target]");
  const highlightedDevices = getConnectedHighlightKeys(links, selectedKey, strictKeys);
  svg.querySelectorAll("[data-device]").forEach((item) => {
    const highlighted = highlightedDevices.has(getDiagramHighlightKey(item, strictKeys));
    item.classList.toggle("is-selected", highlighted);
    item.classList.toggle("is-dimmed", !highlighted);
  });
  links.forEach((link) => {
    const connected = isDiagramLinkConnectedToKey(link, selectedKey, strictKeys);
    link.classList.toggle("is-highlighted", connected);
    link.classList.toggle("is-dimmed", !connected);
  });
}

function clearDiagramHighlight(svg = outputs.diagram.querySelector("svg")) {
  if (!svg) return;
  svg.querySelectorAll(getDiagramHighlightItemSelector()).forEach((item) => {
    item.classList.remove("is-selected", "is-highlighted", "is-dimmed");
  });
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
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  const nextZoom = clampDiagramZoomForRenderedScale(svg, value);

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

function setRenderedDiagramScaleByStep(step, origin = null) {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) return;
  const currentScale = getRenderedDiagramScale(svg);
  const targetScale = Math.min(MAX_RENDERED_DIAGRAM_SCALE, Math.max(MIN_RENDERED_DIAGRAM_SCALE, currentScale + step));
  setDiagramZoom(getDiagramZoomForRenderedScale(svg, targetScale), origin);
}

function resetDiagramView() {
  const svg = outputs.diagram.querySelector("svg");
  diagramZoom = svg ? getDiagramZoomForRenderedScale(svg, 1) : 1;
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
  const rect = svg.getBoundingClientRect();
  const bounds = getDiagramContentBounds(svg);
  const availableWidth = Math.max(1, rect.width - DIAGRAM_FIT_PADDING_X * 2);
  const availableHeight = Math.max(1, rect.height - DIAGRAM_FIT_PADDING_Y * 2);
  const targetScale = Math.min(availableWidth / Math.max(bounds.width, 1), availableHeight / Math.max(bounds.height, 1));
  diagramZoom = getDiagramZoomForRenderedScale(svg, targetScale);
  const viewBox = getDiagramViewBox(svg);
  diagramPan = {
    x: bounds.x + bounds.width / 2 - viewBox.width / 2,
    y: bounds.y + bounds.height / 2 - viewBox.height / 2,
  };
  applyDiagramTransform();
}

function applyDiagramTransform() {
  const svg = outputs.diagram.querySelector("svg");
  if (!svg) {
    outputs.zoomReset.textContent = `${Math.round(diagramZoom * 100)}%`;
    return;
  }
  clampDiagramPan(svg);
  const viewBox = getDiagramViewBox(svg);
  const positionedViewBox = {
    x: diagramPan.x,
    y: diagramPan.y,
    width: viewBox.width,
    height: viewBox.height,
  };
  svg.setAttribute("viewBox", `${trim(positionedViewBox.x)} ${trim(positionedViewBox.y)} ${trim(positionedViewBox.width)} ${trim(positionedViewBox.height)}`);
  outputs.zoomReset.textContent = `${Math.round(getRenderedDiagramScale(svg, viewBox) * 100)}%`;
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
    target: event.target,
    moved: false,
  };
}

function moveDiagramDrag(event) {
  if (!dragState) return;
  if (dragState.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
  const svg = outputs.diagram.querySelector("svg");
  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;
  if (Math.hypot(deltaX, deltaY) > 3) dragState.moved = true;
  const scale = getSvgUnitsPerScreenPixel(svg);
  diagramPan.x = dragState.panX - deltaX * scale.x;
  diagramPan.y = dragState.panY - deltaY * scale.y;
  applyDiagramTransform();
}

function endDiagramDrag(event) {
  if (!dragState) return;
  if (dragState.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
  const finishedDragState = dragState;
  outputs.diagram.classList.remove("is-dragging");
  dragState = null;
  if (finishedDragState.moved) {
    suppressNextDiagramClick = true;
    setTimeout(() => { suppressNextDiagramClick = false; }, 120);
    return;
  }
  const svg = outputs.diagram.querySelector("svg");
  if (svg) {
    highlightDiagramTarget(svg, finishedDragState.target);
    suppressNextDiagramClick = true;
    setTimeout(() => { suppressNextDiagramClick = false; }, 120);
  }
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
  const viewport = getDiagramViewportSize(svg);
  return {
    width: viewport.width / diagramZoom,
    height: viewport.height / diagramZoom,
  };
}

function getDiagramViewportSize(svg) {
  const baseWidth = Number(svg.dataset.baseWidth) || DEFAULT_DIAGRAM_VIEW_WIDTH;
  const baseHeight = Number(svg.dataset.baseHeight) || DEFAULT_DIAGRAM_VIEW_HEIGHT;
  const rect = svg.getBoundingClientRect();
  let viewWidth = Math.min(DEFAULT_DIAGRAM_VIEW_WIDTH, baseWidth);
  let viewHeight = Math.min(DEFAULT_DIAGRAM_VIEW_HEIGHT, baseHeight);
  const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : viewWidth / viewHeight;
  if (Number.isFinite(aspect) && aspect > 0) {
    if (viewWidth / viewHeight < aspect) {
      viewWidth = Math.max(viewWidth, viewHeight * aspect);
    } else if (viewWidth / viewHeight > aspect) {
      viewHeight = Math.max(viewHeight, viewWidth / aspect);
    }
  }
  return {
    width: viewWidth,
    height: viewHeight,
  };
}

function getDiagramContentBounds(svg) {
  const baseWidth = Number(svg.dataset.baseWidth) || DEFAULT_DIAGRAM_VIEW_WIDTH;
  const baseHeight = Number(svg.dataset.baseHeight) || DEFAULT_DIAGRAM_VIEW_HEIGHT;
  const elementBounds = getDiagramElementBounds(svg);
  if (elementBounds) return elementBounds;
  try {
    const bbox = svg.getBBox();
    if (bbox.width > 0 && bbox.height > 0) return bbox;
  } catch (error) {
    // Some browser states can reject getBBox before the SVG is fully laid out.
  }
  return { x: 0, y: 0, width: baseWidth, height: baseHeight };
}

function getDiagramElementBounds(svg) {
  const boxes = [...svg.querySelectorAll(".node, .link, .uplink")]
    .map((element) => {
      try {
        const box = element.getBBox();
        return box.width > 0 && box.height > 0 ? box : null;
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
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

function getRenderedDiagramScale(svg, viewBox = getDiagramViewBox(svg)) {
  const rect = svg.getBoundingClientRect();
  const scaleX = rect.width / Math.max(viewBox.width, 1);
  const scaleY = rect.height / Math.max(viewBox.height, 1);
  const renderedScale = Math.min(scaleX, scaleY);
  return Number.isFinite(renderedScale) && renderedScale > 0 ? renderedScale : diagramZoom;
}

function getDiagramZoomForRenderedScale(svg, targetScale) {
  const rect = svg.getBoundingClientRect();
  const viewport = getDiagramViewportSize(svg);
  const baseRenderedScale = Math.min(
    rect.width / Math.max(viewport.width, 1),
    rect.height / Math.max(viewport.height, 1),
  );
  if (!Number.isFinite(baseRenderedScale) || baseRenderedScale <= 0) return 1;
  const clampedTargetScale = Math.min(MAX_RENDERED_DIAGRAM_SCALE, Math.max(MIN_RENDERED_DIAGRAM_SCALE, targetScale));
  return clampedTargetScale / baseRenderedScale;
}

function clampDiagramZoomForRenderedScale(svg, zoom) {
  const rect = svg.getBoundingClientRect();
  const viewport = getDiagramViewportSize(svg);
  const baseRenderedScale = Math.min(
    rect.width / Math.max(viewport.width, 1),
    rect.height / Math.max(viewport.height, 1),
  );
  if (!Number.isFinite(baseRenderedScale) || baseRenderedScale <= 0) {
    return Math.min(MAX_DIAGRAM_ZOOM, Math.max(MIN_DIAGRAM_ZOOM, zoom));
  }
  const minZoom = MIN_RENDERED_DIAGRAM_SCALE / baseRenderedScale;
  const maxZoom = MAX_RENDERED_DIAGRAM_SCALE / baseRenderedScale;
  return Math.min(maxZoom, Math.max(minZoom, zoom));
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
  if (input.useMultiPlanar || input.useMultiPods) {
    if (input.useMultiPods) {
      parts.push(tr("messages.multiPods", { podNodeCount: best.podServerCount, podCount: best.multiPodCount }));
    }
    if (input.useMultiPlanar) {
      parts.push(tr("messages.multiPlanar"));
    }
  } else if (input.mode === "nonblocking") {
    parts.push(tr("messages.nonBlocking"));
  } else {
    parts.push(tr("messages.oversubscribed", { ratio: trim(input.targetOversub) }));
  }
  const leafPortSpeed = input.leafSwitchLinkSpeed || input.switchLinkSpeed;
  const nodeLeafLogicalSpeed = nodeLeafLinkSpeed(input);
  if (nodeLeafLogicalSpeed > leafPortSpeed) {
    parts.push(tr("messages.nodeLeafSpeedMismatch"));
  }
  if (shouldWarnLeafTwinPortEfficiency(input, leafPortSpeed, nodeLeafLogicalSpeed)) {
    parts.push(tr("messages.leafTwinPortEfficiency"));
  }
  const leafSpinePortWarning = getLeafSpinePortEfficiencyWarning(input, best);
  if (leafSpinePortWarning) {
    parts.push(leafSpinePortWarning);
  }
  if (best.leafCount === best.switchPortCapacity) {
    parts.push(tr("messages.spineExpansionWarning"));
  }
  if (!best.balancedLeafSpineLinks) {
    parts.push(tr("messages.unbalancedLeafSpine", {
      minLinks: Math.floor(best.uplinksPerLeaf / best.spines),
      maxLinks: Math.ceil(best.uplinksPerLeaf / best.spines),
    }));
  }
  return parts.join(" ");
}

function nodeLeafLinkSpeed(input) {
  return input.serverLinkSpeed / (input.useNodeTwinPort ? 2 : 1);
}

function shouldWarnLeafTwinPortEfficiency(input, leafPortSpeed, nodeLeafLogicalSpeed = nodeLeafLinkSpeed(input)) {
  if (input.useTwinPort) return false;
  if (leafPortSpeed < 200) return false;
  return leafPortSpeed >= nodeLeafLogicalSpeed * 2;
}

function getLeafSpinePortEfficiencyWarning(input, best) {
  const currentLeafPorts = best.physicalUplinkPortsPerLeaf * best.leafCount;
  const currentSpinePorts = best.usedPortsPerSpine * best.spines;
  const currentLogicalLinks = best.totalLeafUplinks;
  const variants = [];

  if (input.leafSwitchLinkSpeed >= 200 && input.spineSwitchLinkSpeed >= 200) {
    variants.push({
      name: tr("messages.applyLeafSpineTwinPort"),
      input: {
        ...input,
        disableUplinkTwinPort: false,
        spineUseTwinPort: true,
      },
    });
    variants.push({
      name: tr("messages.applySpineTwinPort"),
      input: {
        ...input,
        spineUseTwinPort: true,
      },
    });
  }

  if (leafSpineLeafTwinFactor(input) > 1 || leafSpineTwinFactor(input) > 1) {
    variants.push({
      name: tr("messages.disableLeafSpineTwinPort"),
      input: {
        ...input,
        disableUplinkTwinPort: true,
        spineUseTwinPort: false,
      },
    });
  }

  const better = variants
    .map((variant) => ({ ...variant, result: calculate(variant.input) }))
    .filter((variant) => {
      if (!variant.result.feasible || !variant.result.best) return false;
      const candidate = variant.result.best;
      const candidateLeafPorts = candidate.physicalUplinkPortsPerLeaf * candidate.leafCount;
      const candidateSpinePorts = candidate.usedPortsPerSpine * candidate.spines;
      return candidate.totalLeafUplinks < currentLogicalLinks
        || candidateLeafPorts < currentLeafPorts
        || candidateSpinePorts < currentSpinePorts;
    })
    .sort((a, b) => {
      const aBest = a.result.best;
      const bBest = b.result.best;
      const linkDelta = aBest.totalLeafUplinks - bBest.totalLeafUplinks;
      if (linkDelta) return linkDelta;
      const aPorts = aBest.physicalUplinkPortsPerLeaf * aBest.leafCount + aBest.usedPortsPerSpine * aBest.spines;
      const bPorts = bBest.physicalUplinkPortsPerLeaf * bBest.leafCount + bBest.usedPortsPerSpine * bBest.spines;
      return aPorts - bPorts;
    })[0];

  if (!better) return "";
  return tr("messages.leafSpinePortEfficiency", { recommendation: better.name });
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
