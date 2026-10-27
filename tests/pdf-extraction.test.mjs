import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { PDFDocument, PDFName } from "pdf-lib";
import { extractForm, convertBatch } from "../demos/pdf-extraction.mjs";
import { demoSchema, syntheticForm } from "../demos/pdf-fixtures.mjs";

test("synthetic PDF fields retain explicit types, zero prefixes and literal formula-like text", async () => {
  const bytes = await syntheticForm();
  const before = createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(await extractForm(bytes, demoSchema), ["0007", 1250.5, "=1+1", false, '["Review","Export, CSV"]', "Normal"]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), before);
  const result = await convertBatch([{ name: "demo-01.pdf", bytes }, { name: "demo-02.pdf", bytes: await syntheticForm({ id: "0008", amount: "0", notes: "", confirmed: true }) }], demoSchema);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const sheet = workbook.getWorksheet("Extracted fields");
  assert.equal(sheet.rowCount, 3);
  assert.equal(sheet.getCell("B2").value, "0007");
  assert.equal(sheet.getCell("C2").type, ExcelJS.ValueType.Number);
  assert.equal(sheet.getCell("D2").value, "=1+1");
  assert.equal(sheet.getCell("D2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("D2").formula, undefined);
  assert.equal(sheet.getCell("E2").value, false);
  assert.equal(sheet.getCell("C3").value, 0);
  assert.equal(sheet.getCell("D3").value, null);
  assert.equal(result.report.demoOnly, true);
  assert.equal(result.report.outputRows, 2);
  assert.equal(result.report.sources[0].sha256, before);
});

test("invalid values and incomplete mappings fail without a partial workbook", async () => {
  await assert.rejects(extractForm(await syntheticForm({ amount: "1,250" }), demoSchema), /Invalid numeric/);
  await assert.rejects(extractForm(await syntheticForm({ amount: "1234567890123456" }), demoSchema), /precision/);
  await assert.rejects(extractForm(await syntheticForm({ id: "" }), demoSchema), /Required field is blank/);
  await assert.rejects(extractForm(await syntheticForm({ omit: "request.notes" }), demoSchema), /Missing PDF field/);
  await assert.rejects(extractForm(await syntheticForm({ extra: true }), demoSchema), /Unmapped PDF field/);
  const inputs = [{ name: "valid.pdf", bytes: await syntheticForm() }, { name: "invalid.pdf", bytes: await syntheticForm({ amount: "not-numeric" }) }];
  await assert.rejects(convertBatch(inputs, demoSchema), error => error instanceof AggregateError && error.errors.length === 1 && error.message.includes("no workbook"));
});

test("unsupported forms and invalid schemas are rejected explicitly", async () => {
  await assert.rejects(extractForm(await syntheticForm({ flatten: true }), demoSchema), /No AcroForm fields/);
  const document = await PDFDocument.load(await syntheticForm());
  document.getForm().acroForm.dict.set(PDFName.of("XFA"), document.context.stream("synthetic XFA"));
  const bytes = await document.save({ updateFieldAppearances: false });
  await assert.rejects(extractForm(bytes, demoSchema), /XFA forms/);
  await assert.rejects(extractForm(await syntheticForm(), [...demoSchema, demoSchema[0]]), /Duplicate field/);
  await assert.rejects(extractForm(await syntheticForm(), demoSchema.map((column, index) => index ? column : { ...column, header: "Source file" })), /Duplicate field/);
  await assert.rejects(extractForm(await syntheticForm(), demoSchema.map((column, index) => index ? column : { ...column, header: "Request\u0000ID" })), /clean output headers/);
  await assert.rejects(convertBatch([], demoSchema), /1-20/);
  const repeated = { name: "duplicate.pdf", bytes: await syntheticForm() };
  await assert.rejects(convertBatch([repeated, repeated], demoSchema), /unique/);
});

test("formula prefixes and XML-like strings remain literal after XLSX serialization", async () => {
  const values = ["=1+1", "+SUM(1,2)", "-1+1", "@SUM(1,2)", "_x0041_", "_x005F_", "_x0041__x0042_", "_x00a9_", "<literal>&data"];
  const inputs = [];
  for (const [index, notes] of values.entries()) inputs.push({ name: `literal_x0042_-${index}.pdf`, bytes: await syntheticForm({ notes }) });
  const schema = demoSchema.map(column => column.field === "request.notes" ? { ...column, header: "Notes _x0041_" } : column);
  const { buffer } = await convertBatch(inputs, schema);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Extracted fields");
  assert.equal(sheet.getCell("D1").value, "Notes _x0041_");
  for (const [index, expected] of values.entries()) {
    assert.equal(sheet.getCell(index + 2, 1).value, inputs[index].name);
    const cell = sheet.getCell(index + 2, 4);
    assert.equal(cell.value, expected);
    assert.equal(cell.type, ExcelJS.ValueType.String);
    assert.equal(cell.formula, undefined);
  }
});