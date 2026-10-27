import { createIcons, Files, Upload, Download, RotateCcw, ShieldCheck, Play, FileSpreadsheet, Check, FileText, Trash2, Plus, CircleAlert, CircleCheck } from "lucide";
import { convertBatch, extractForm } from "../pdf-extraction.mjs";

const payload = JSON.parse(document.querySelector("#sample-data").textContent);
const icons = { Files, Upload, Download, RotateCcw, ShieldCheck, Play, FileSpreadsheet, Check, FileText, Trash2, Plus, CircleAlert, CircleCheck };
const state = { files: [], schema: structuredClone(payload.schema), selected: 0, rows: [], result: null, errors: [], busy: false, view: "table" };
const element = selector => document.querySelector(selector);
const bytesFrom = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const icon = name => { const node = document.createElement("i"); node.dataset.lucide = name; return node; };
const text = (tag, value, className = "") => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
const paintIcons = () => createIcons({ icons, attrs: { "aria-hidden": "true" } });
const byteLabel = bytes => `${(bytes / 1024).toFixed(1)} KiB`;

function status(message, error = false) {
  element("#status").textContent = message;
  element("#status").classList.toggle("error", error);
}

function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function selectView(view) {
  state.view = view;
  for (const tab of document.querySelectorAll("[data-view]")) {
    const active = tab.dataset.view === view;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    element(`#${tab.dataset.view}-panel`).hidden = !active;
  }
}

function invalidate(message = "Field map changed. Validation required.") {
  state.result = null;
  state.rows = [];
  state.errors = [];
  status(message);
  render();
}

function renderMapping() {
  const container = element("#mapping");
  container.replaceChildren();
  state.schema.forEach((column, index) => {
    const row = text("div", "", "map-row");
    for (const [key, caption] of [["field", "PDF FIELD"], ["header", "COLUMN NAME"], ["type", "CELL TYPE"], ["required", "REQUIRED"]]) {
      const label = text("label", caption, key === "required" ? "required-field" : "");
      const input = document.createElement(key === "type" ? "select" : "input");
      input.setAttribute("aria-label", `${caption} ${index + 1}`);
      if (key === "type") for (const value of ["text", "number", "boolean", "list"]) input.add(new Option(value, value));
      if (key === "required") { input.type = "checkbox"; input.checked = column.required; }
      else { input.value = column[key]; if (input.tagName === "INPUT") input.maxLength = 200; }
      input.disabled = state.busy;
      input.addEventListener("change", () => { column[key] = key === "required" ? input.checked : input.value; invalidate(); });
      label.append(input);
      row.append(label);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.title = `Remove ${column.header || "field"}`;
    remove.setAttribute("aria-label", remove.title);
    remove.disabled = state.busy || state.schema.length === 1;
    remove.append(icon("trash-2"));
    remove.addEventListener("click", () => { state.schema.splice(index, 1); invalidate(); renderMapping(); paintIcons(); });
    row.append(remove);
    container.append(row);
  });
}

function render() {
  const valid = Boolean(state.result);
  element("#file-count").textContent = state.files.length;
  element("#stat-files").textContent = String(state.files.length).padStart(2, "0");
  element("#stat-fields").textContent = String(state.schema.length).padStart(2, "0");
  element("#stat-rows").textContent = String(state.rows.length).padStart(2, "0");
  element("#batch-state").textContent = state.busy ? "Validating" : state.errors.length ? "Needs review" : valid ? "Ready to export" : state.files.length ? "Not validated" : "Empty";
  element("#batch-state").parentElement.classList.toggle("error", state.errors.length > 0);
  element("#check-count").textContent = state.errors.length || (valid ? state.files.length : 0);
  element("#row-summary").textContent = `${state.rows.length} rows`;
  element("#checks-summary").textContent = state.errors.length ? `${state.errors.length} issue(s)` : valid ? "All files passed" : "Not run";
  element("#export").disabled = !valid || state.busy;
  element("#validate").disabled = !state.files.length || state.busy;
  element("#clear").disabled = !state.files.length || state.busy;
  for (const selector of ["#load-samples", "#invalid-sample", "#pdf-files", "#map-file", "#add-field", "#download-map"]) element(selector).disabled = state.busy;
  element("#batch-label").textContent = state.files.length ? `${state.files.length} file${state.files.length === 1 ? "" : "s"} / ${byteLabel(state.files.reduce((sum, file) => sum + file.bytes.length, 0))}` : "No batch loaded";
  const files = element("#file-list");
  files.replaceChildren();
  state.files.forEach((file, index) => {
    const button = document.createElement("button");
    button.className = "file-row";
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === state.selected));
    button.title = file.name;
    const symbol = text("span", "", "file-symbol"); symbol.append(icon("file-text"));
    const details = text("span", ""); details.append(text("span", file.name, "file-name"), text("span", byteLabel(file.bytes.length), "file-meta"));
    const fileStatus = text("span", "", `file-state${state.errors.length ? " error" : ""}`); fileStatus.append(icon(state.errors.length ? "circle-alert" : valid ? "circle-check" : "file-text"));
    button.append(symbol, details, fileStatus);
    button.addEventListener("click", () => { state.selected = index; render(); });
    files.append(button);
  });
  const head = element("#results thead"); head.replaceChildren();
  const header = document.createElement("tr");
  for (const label of ["Source file", ...state.schema.map(column => column.header)]) header.append(text("th", label));
  head.append(header);
  const body = element("#results tbody"); body.replaceChildren();
  for (const [index, values] of state.rows.entries()) {
    const row = document.createElement("tr"); row.classList.toggle("selected", index === state.selected);
    for (const value of values) {
      const cell = text("td", value === null ? "-" : String(value), typeof value === "boolean" ? "bool" : typeof value === "string" && /^[=+@-]|^</.test(value) ? "literal" : "");
      row.append(cell);
    }
    body.append(row);
  }
  element("#empty-state").hidden = state.rows.length > 0;
  element(".table-scroll").hidden = state.rows.length === 0;
  const checks = element("#checks-list"); checks.replaceChildren();
  const messages = state.errors.length ? state.errors : valid ? state.files.map(file => `${file.name}: ${state.schema.length} mapped fields validated; input fingerprint retained.`) : ["Validation has not run for this batch."];
  for (const message of messages) { const item = text("li", "", state.errors.length ? "error" : ""); item.append(icon(state.errors.length ? "circle-alert" : valid ? "circle-check" : "file-text"), text("span", message)); checks.append(item); }
  const selected = state.files[state.selected];
  element("#preview-name").textContent = selected?.name || "No file selected";
  element("#preview-size").textContent = selected ? byteLabel(selected.bytes.length) : "-";
  element("#preview-fields").textContent = valid ? state.schema.length : "-";
  element("#preview-state").textContent = valid ? "Passed" : state.errors.length ? "Blocked" : "Not run";
  element("#download-source").disabled = !selected || state.busy;
  const image = element("#preview-image");
  image.hidden = !selected?.preview;
  if (selected?.preview) image.src = selected.preview;
  else image.removeAttribute("src");
  element("#preview-empty").hidden = Boolean(selected?.preview);
  paintIcons();
}

async function validate() {
  if (state.busy || !state.files.length) return;
  state.busy = true;
  state.result = null;
  state.rows = [];
  state.errors = [];
  status("Validating mapped fields and building the workbook...");
  render(); renderMapping();
  try {
    const result = await convertBatch(state.files, state.schema);
    const rows = [];
    for (const file of state.files) rows.push([file.name, ...await extractForm(file.bytes, state.schema)]);
    state.result = result;
    state.rows = rows;
    status(`${state.files.length} files passed. ${rows.length} rows ready for export.`);
  } catch (error) {
    state.errors = error instanceof AggregateError ? error.errors.map(item => item.message) : [error.message || "Validation failed."];
    status(`${state.errors.length} issue(s). No workbook produced.`, true);
    selectView("checks");
  } finally { state.busy = false; render(); renderMapping(); paintIcons(); }
}

async function loadSamples(invalid = false) {
  if (state.busy) return;
  state.schema = structuredClone(payload.schema);
  const samples = invalid ? [payload.invalid] : payload.files;
  state.files = samples.map(sample => ({ name: sample.name, bytes: bytesFrom(sample.base64), preview: sample.preview }));
  state.selected = 0;
  invalidate("Sample batch loaded.");
  selectView("table");
  renderMapping();
  await validate();
}

async function addFiles(files) {
  if (state.busy) return;
  const incoming = Array.from(files);
  if (!incoming.length) return;
  if (state.files.length + incoming.length > 20 || incoming.some(file => file.size > 5 * 1024 * 1024 || !/\.pdf$/i.test(file.name))) { status("Choose up to 20 PDF files of no more than 5 MiB each.", true); return; }
  const names = new Set(state.files.map(file => file.name));
  for (const file of incoming) { if (names.has(file.name)) { status(`Duplicate source filename: ${file.name}`, true); return; } names.add(file.name); }
  state.busy = true; render();
  try {
    const additions = [];
    for (const file of incoming) additions.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), preview: null });
    state.files.push(...additions);
    invalidate("Files added. Validation required.");
  } catch { status("A selected file could not be read. Existing files were retained.", true); }
  finally { state.busy = false; element("#pdf-files").value = ""; render(); }
}

element("#load-samples").addEventListener("click", () => loadSamples());
element("#invalid-sample").addEventListener("click", () => loadSamples(true));
element("#validate").addEventListener("click", validate);
element("#export").addEventListener("click", () => { if (state.result) download(state.result.buffer, "form-desk-demo.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); });
element("#download-source").addEventListener("click", () => { const file = state.files[state.selected]; if (file) download(file.bytes, file.name, "application/pdf"); });
element("#download-map").addEventListener("click", () => download(JSON.stringify(state.schema, null, 2), "field-map.json", "application/json"));
element("#clear").addEventListener("click", () => { state.files = []; state.selected = 0; invalidate("No files selected."); });
element("#add-field").addEventListener("click", () => { if (state.schema.length >= 100) return; state.schema.push({ field: "", header: "", type: "text", required: false }); invalidate(); renderMapping(); paintIcons(); });
element("#pdf-files").addEventListener("change", event => addFiles(event.target.files));
element("#map-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file || state.busy) return;
  try {
    if (file.size > 65536) throw new Error("Field map must be under 64 KiB.");
    const schema = JSON.parse(await file.text());
    if (!Array.isArray(schema) || !schema.length || schema.length > 100 || schema.some(column => !column || typeof column.field !== "string" || typeof column.header !== "string" || !["text", "number", "boolean", "list"].includes(column.type) || typeof column.required !== "boolean")) throw new Error("Invalid field-map structure.");
    state.schema = schema; invalidate("Field map imported. Validation required."); renderMapping(); paintIcons();
  } catch (error) { status(error.message, true); }
  event.target.value = "";
});
for (const tab of document.querySelectorAll("[data-view]")) {
  tab.addEventListener("click", () => selectView(tab.dataset.view));
  tab.addEventListener("keydown", event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(document.querySelectorAll("[data-view]")); const index = tabs.indexOf(tab); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; selectView(tabs[next].dataset.view); tabs[next].focus(); });
}
const drop = element("#drop-zone");
drop.addEventListener("dragover", event => { event.preventDefault(); drop.classList.add("dragging"); });
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", event => { event.preventDefault(); drop.classList.remove("dragging"); addFiles(event.dataTransfer.files); });
paintIcons();
await loadSamples();