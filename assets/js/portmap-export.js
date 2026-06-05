/*
 * Copyright ? 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

// Port map Excel and PowerPoint export helpers.
function exportPortMapExcel() {
  if (!currentResult) return;
  const generatedAt = makeExportTimestamp();
  const blob = buildPortMapXlsx(buildPortMap(currentResult));
  downloadBlob(blob, exportFilename("leaf-spine-port-map", "xlsx", generatedAt));
}

async function exportPortMapPpt() {
  if (!currentResult) return;
  try {
    await LeafSpineExportUtils.ensurePptxGenLoaded();
    const generatedAt = makeExportTimestamp();
    const pptx = buildPortMapPptx(buildPortMap(currentResult), generatedAt.display);
    const blob = await pptx.write({ outputType: "blob" });
    downloadBlob(blob, exportFilename("leaf-spine-port-map", "pptx", generatedAt));
  } catch (error) {
    console.error(error);
    alert(typeof tr === "function" ? tr("portMap.pptError") : "포트맵 PPT 파일을 만드는 중 오류가 발생했습니다.");
  }
}

window.exportPortMapExcel = exportPortMapExcel;
window.exportPortMapPpt = exportPortMapPpt;

function getPortMapRows(portMap) {
  return [...portMap.serverLeafRows, ...portMap.leafSpineRows];
}

function portMapHeaders() {
  if (typeof tr !== "function") return ["#", "Segment", "Plane", "Pod", "From Device", "From Port", "To Device", "To Port", "Link Speed", "Group"];
  if (typeof tr !== "function") return ["#", "구간", "Plane", "출발 장비", "출발 포트", "도착 장비", "도착 포트", "속도", "그룹"];
  return [
    tr("portMap.columns.index"),
    tr("portMap.columns.segment"),
    tr("portMap.columns.plane"),
    tr("common.pod"),
    tr("portMap.columns.fromDevice"),
    tr("portMap.columns.fromPort"),
    tr("portMap.columns.toDevice"),
    tr("portMap.columns.toPort"),
    tr("portMap.columns.speed"),
    tr("portMap.columns.group"),
  ];
}

function portMapTr(path, params = {}) {
  return typeof tr === "function" ? tr(path, params) : path;
}

function portMapRowValues(row, index) {
  return [
    index + 1,
    row.section,
    row.plane,
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
  const sectionClass = row.section === "Node-Leaf" ? "server-leaf" : "leaf-spine";
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
  const colWidths = [7, 14, 11, 11, 22, 16, 24, 16, 14, 20];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${colWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>
    ${rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, colIndex) => xlsxCell(value, rowIndex, colIndex, sourceRows[rowIndex])).join("")}</row>`).join("")}
  </sheetData>
  <autoFilter ref="A1:J${rows.length}"/>
</worksheet>`;
}

function xlsxCell(value, rowIndex, colIndex, sourceRow) {
  const ref = `${xlsxColumnName(colIndex)}${rowIndex + 1}`;
  let style = rowIndex === 0 ? 1 : 0;
  if (sourceRow && colIndex === 1) style = sourceRow.section === "Node-Leaf" ? 2 : 3;
  if (sourceRow && [2, 3].includes(colIndex) && String(value) !== "-") style = 4 + ((sourceRow.podIndex || 0) % 6);
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
  <fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF8A4B12"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Arial"/></font></fonts>
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
    fontFace: "Arial", fontSize: 17, bold: true, color: "2563EB", margin: 0,
  });
  slide.addText(`${portMapTr("meta.credit")} ${generatedAtText}`, {
    x: 0.5, y: 0.5, w: 2.48, h: 0.16,
    fontFace: "Arial", fontSize: 7.5, bold: true, color: "5B6B86", align: "right", margin: 0,
  });
  addPortMapPptPageNumber(slide, pageNumber, pageCount, 0.32);
}

function addPortMapPptPageNumber(slide, pageNumber, pageCount, y = 0.12) {
  slide.addText(`Page ${pageNumber} / ${pageCount}`, {
    x: 11.4, y, w: 1.4, h: 0.2,
    fontFace: "Arial", fontSize: 8, bold: true, color: "5B6B86", align: "right", margin: 0,
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
      fontFace: "Arial", fontSize: 6.3, bold: true, color: "5B6B86", margin: 0,
    });
    slide.addText(value, {
      x: x + 0.09, y: 1.05, w: 1.65, h: 0.14,
      fontFace: "Arial", fontSize: 9.3, bold: true, color: "0F172A", margin: 0,
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
      const isPodOrPlane = [2, 3].includes(cellIndex) && String(value) !== "-";
      const sectionColor = row.section === "Node-Leaf" ? "1D4ED8" : "8A4B12";
      const tone = isPodOrPlane ? podTone(row.podIndex || 0) : null;
      return {
        text: String(value),
        options: {
          bold: isSection || isPodOrPlane,
          color: isSection ? sectionColor : (isPodOrPlane ? tone.ppt : "0F172A"),
        },
      };
    })),
  ];
  slide.addTable(tableRows, {
    x: 0.35,
    y,
    w: 12.15,
    colW: [0.5, 1.2, 0.75, 0.75, 1.65, 1.15, 1.9, 1.15, 0.95, 1.95],
    rowH: 0.36,
    fontFace: "Arial",
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
    shapes.push(pptText(id++, inch(1.42), inch(0.5), inch(1.55), inch(0.16), portMapTr("meta.credit"), "5B6B86", 7.5, true, "r"));
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
  const colW = [0.5, 1.2, 0.75, 0.75, 1.65, 1.15, 1.9, 1.15, 0.95, 1.95];
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
    color = row.source.section === "Node-Leaf" ? "1D4ED8" : "8A4B12";
    bold = true;
  } else if ([2, 3].includes(cellIndex) && value !== "-") {
    const tone = podTone(row.source.podIndex || 0);
    fill = tone.fill;
    color = tone.ppt;
    bold = true;
  } else if (row.rowIndex % 2) {
    fill = "F8FBFF";
  }
  return `<a:tc>
    <a:txBody><a:bodyPr wrap="none" lIns="28575" rIns="28575" tIns="9525" bIns="9525" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="ko-KR" sz="540"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/></a:rPr><a:t>${escapeXml(value)}</a:t></a:r></a:p></a:txBody>
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
