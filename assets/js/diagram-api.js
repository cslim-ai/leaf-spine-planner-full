/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Public diagram facade. Loaded after diagram implementation files.
const LeafSpineDiagram = {
  makeForView: makeDiagramMarkupForView,
  getGeometryForView: (result, viewMode) => diagramGeometryForView(result, viewMode),
  adjustLabelBadges,
  exportPng: async () => {
    await LeafSpineExportUtils.ensureEmbeddedFontDataLoaded();
    return exportDiagramPng();
  },
  exportSvg: async () => {
    await LeafSpineExportUtils.ensureEmbeddedFontDataLoaded();
    return exportDiagramSvg();
  },
  exportPptx: async (viewMode) => {
    await LeafSpineExportUtils.ensureDiagramPptxExportLoaded();
    return exportDiagramPptx(viewMode);
  },
  openWindow: openDiagramWindow,
  makeWindowPayload: makeDiagramWindowPayload,
  syncOpenWindows: syncOpenDiagramWindows,
  clearOpenWindows: clearOpenDiagramWindows,
};
