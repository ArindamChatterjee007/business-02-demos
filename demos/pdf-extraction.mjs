import { PDFDocument, PDFName, PDFDict, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from "pdf-lib";
import ExcelJS from "exceljs";

const escapeXlsxLiteralTokens = value => value.replace(/_(?=x[0-9A-Fa-f]{4}_)/g, "_x005F_");

function validateSchema(schema) {
  if (!Array.isArray(schema) || !schema.length || schema.length > 100) throw new Error("Provide a schema with 1-100 mapped fields.");
  const fields = new Set();
  const headers = new Set(["source file"]);
  for (const column of schema) {
    if (!column || typeof column.field !== "string" || !column.field.trim() || typeof column.header !== "string" || !column.header.trim()) throw new Error("Each field needs its exact PDF name and an output header.");
    if (column.header !== column.header.trim() || column.header.length > 200 || /[\u0000-\u001f]/.test(column.header)) throw new Error("Use clean output headers up to 200 characters.");
    if (fields.has(column.field) || headers.has(column.header.toLowerCase())) throw new Error("Duplicate field or output header in schema.");
    if (!["text", "number", "boolean", "list"].includes(column.type) || typeof column.required !== "boolean") throw new Error("Specify a supported type and explicit required flag for every field.");
    fields.add(column.field);
    headers.add(column.header.toLowerCase());
  }
}

function fieldValue(field, column) {
  let value;
  if (field instanceof PDFTextField && ["text", "number"].includes(column.type)) value = field.getText();
  else if (field instanceof PDFCheckBox && column.type === "boolean") value = field.isChecked();
  else if (field instanceof PDFRadioGroup && column.type === "text") value = field.getSelected();
  else if ((field instanceof PDFDropdown || field instanceof PDFOptionList) && column.type === "list") value = field.getSelected();
  else throw new Error(`Unsupported field/type pairing: ${column.field}.`);
  const blank = value == null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);
  if (blank) {
    if (column.required) throw new Error(`Required field is blank: ${column.field}.`);
    return null;
  }
  if (column.type === "number") {
    const numeric = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(numeric) || !Number.isFinite(Number(numeric))) throw new Error(`Invalid numeric field: ${column.field}.`);
    if (numeric.replace(/^[+-]/, "").replace(".", "").replace(/^0+/, "").length > 15) throw new Error(`Numeric precision exceeds the demo limit: ${column.field}.`);
    value = Number(numeric);
  }
  if (column.type === "list") value = JSON.stringify(value);
  if (typeof value === "string" && (value.length > 32767 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))) throw new Error(`Text cannot be represented safely in XLSX: ${column.field}.`);
  return value;
}

export async function extractForm(bytes, schema) {
  validateSchema(schema);
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("Provide a PDF buffer up to 5 MiB.");
  const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  const acroForm = document.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (acroForm?.has(PDFName.of("XFA"))) throw new Error("XFA forms are outside this demo; no data was extracted.");
  const fields = document.getForm().getFields();
  if (!fields.length) throw new Error("No AcroForm fields found; flattened/scanned PDFs need a different scope.");
  const byName = new Map();
  for (const field of fields) {
    if (byName.has(field.getName())) throw new Error(`Duplicate PDF field name: ${field.getName()}.`);
    byName.set(field.getName(), field);
  }
  const mapped = new Set(schema.map(column => column.field));
  for (const name of byName.keys()) if (!mapped.has(name)) throw new Error(`Unmapped PDF field: ${name}.`);
  return schema.map(column => {
    const field = byName.get(column.field);
    if (!field) throw new Error(`Missing PDF field: ${column.field}.`);
    return fieldValue(field, column);
  });
}

export async function convertBatch(inputs, schema) {
  validateSchema(schema);
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 20) throw new Error("Provide 1-20 explicitly selected PDFs for this demo.");
  const names = new Set();
  for (const input of inputs) {
    if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 200 || /[\u0000-\u001f]/.test(input.name) || names.has(input.name)) throw new Error("Every PDF needs a unique, non-empty source label up to 200 characters.");
    names.add(input.name);
  }
  const rows = [];
  const errors = [];
  const sources = [];
  for (const input of inputs) {
    try {
      rows.push([input.name, ...await extractForm(input.bytes, schema)]);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", input.bytes);
      sources.push({ name: input.name, sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("") });
    } catch (error) { errors.push(new Error(`${input.name}: ${error.message}`)); }
  }
  if (errors.length) throw new AggregateError(errors, `${errors.length} input(s) failed validation; no workbook produced.`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Business 02 / synthetic-data demonstration";
  workbook.title = "PDF field extraction demo - not client delivery";
  const sheet = workbook.addWorksheet("Extracted fields", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ header: "Source file", width: 25 }, ...schema.map(column => ({ header: column.header, width: 26 }))];
  for (const values of rows) sheet.addRow(values);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146349" } };
  sheet.eachRow(row => row.eachCell(cell => {
    cell.alignment = { vertical: "top", wrapText: true };
    if (typeof cell.value === "string") { cell.value = escapeXlsxLiteralTokens(cell.value); cell.numFmt = "@"; }
  }));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: schema.length + 1 } };
  const notes = workbook.addWorksheet("Demo notes");
  notes.getColumn(1).width = 100;
  for (const note of ["Self-initiated, AI-assisted synthetic-data demonstration, not client work.", "No client PDF, account, submission or payment was used.", "One row per source PDF. Multi-selections are JSON arrays; blank optional values are blank cells.", "XFA, encrypted/flattened/scanned PDFs and unsupported field types are not supported.", "No formulas or macros are intentionally created. Client samples and field mapping still require review."]) notes.addRow([note]);
  return { buffer: await workbook.xlsx.writeBuffer(), report: { demoOnly: true, inputCount: inputs.length, outputRows: rows.length, mappedFields: schema.length, sources } };
}