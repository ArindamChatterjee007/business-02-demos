import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { syntheticForm, demoSchema } from "./pdf-fixtures.mjs";
import { convertBatch } from "./pdf-extraction.mjs";

const root = fileURLToPath(new URL("../artifacts/pdf-demo/", import.meta.url));
await mkdir(root, { recursive: true, mode: 0o700 });
const directory = await mkdtemp(join(root, "run-"));
const samples = [
  { name: "synthetic-01.pdf", values: { id: "0007", amount: "1250.50", notes: "=1+1", confirmed: false }, expected: ["0007", 1250.5, "=1+1", false, '["Review","Export, CSV"]', "Normal"] },
  { name: "synthetic-02.pdf", values: { id: "0008", amount: "0", notes: "", confirmed: true }, expected: ["0008", 0, null, true, '["Review","Export, CSV"]', "Normal"] },
  { name: "synthetic-03.pdf", values: { id: "0099", amount: "-42.75", notes: "<literal>&data", confirmed: false }, expected: ["0099", -42.75, "<literal>&data", false, '["Review","Export, CSV"]', "Normal"] },
];
const inputs = [];
for (const sample of samples) {
  const bytes = await syntheticForm(sample.values);
  await writeFile(join(directory, sample.name), bytes, { flag: "wx", mode: 0o600 });
  inputs.push({ name: sample.name, bytes: await readFile(join(directory, sample.name)) });
}
const { buffer, report } = await convertBatch(inputs, demoSchema);
const workbookPath = join(directory, "synthetic-output.xlsx");
await writeFile(workbookPath, buffer, { flag: "wx", mode: 0o600 });
await writeFile(join(directory, "field-map.json"), JSON.stringify(demoSchema, null, 2), { flag: "wx", mode: 0o600 });
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);
const sheet = workbook.getWorksheet("Extracted fields");
assert.equal(sheet.rowCount, samples.length + 1);
assert.deepEqual(sheet.getRow(1).values.slice(1), ["Source file", ...demoSchema.map(column => column.header)]);
for (const [index, sample] of samples.entries()) {
  const row = sheet.getRow(index + 2);
  assert.equal(row.getCell(1).value, sample.name);
  for (const [column, expected] of sample.expected.entries()) {
    const cell = row.getCell(column + 2);
    assert.equal(cell.value, expected);
    assert.equal(cell.formula, undefined);
    if (typeof expected === "string") assert.equal(cell.type, ExcelJS.ValueType.String);
  }
  assert.equal(createHash("sha256").update(await readFile(join(directory, sample.name))).digest("hex"), report.sources[index].sha256);
}
const receipt = { ...report, verifiedAt: new Date().toISOString(), status: "PASS", checks: ["Three saved synthetic PDFs read back", "Exact schema and typed values", "Leading-zero identifiers preserved", "Formula-looking and XML-like text remained literal", "Blank optional value did not become zero", "Input hashes unchanged", "No client files or account access"], workbookSHA256: createHash("sha256").update(buffer).digest("hex"), limits: "Synthetic proof only. No client sample, OCR, XFA, encrypted PDFs, arbitrary field layouts or high-volume validation." };
await writeFile(join(directory, "verification.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ status: receipt.status, demoOnly: true, directory, workbook: workbookPath, inputCount: report.inputCount, outputRows: report.outputRows, mappedFields: report.mappedFields }, null, 2));