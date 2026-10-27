import { PDFDocument, rgb } from "pdf-lib";

export const demoSchema = [
  { field: "request.id", header: "Request ID", type: "text", required: true },
  { field: "request.amount", header: "Amount", type: "number", required: true },
  { field: "request.notes", header: "Notes", type: "text", required: false },
  { field: "request.confirmed", header: "Confirmed", type: "boolean", required: true },
  { field: "request.services", header: "Services", type: "list", required: true },
  { field: "request.priority", header: "Priority", type: "text", required: false },
];

export async function syntheticForm({ id = "0007", amount = "1250.50", notes = "=1+1", confirmed = false, extra = false, omit = "", flatten = false } = {}) {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  page.drawText("SYNTHETIC DEMO / NOT CLIENT DATA", { x: 38, y: 800, size: 17, color: rgb(0.08, 0.39, 0.29) });
  page.drawText("Made only to verify PDF field extraction.", { x: 38, y: 775, size: 11 });
  const form = document.getForm();
  for (const [index, [name, label, value]] of [["request.id", "Request ID", id], ["request.amount", "Amount", amount], ["request.notes", "Notes", notes]].entries()) {
    if (name === omit) continue;
    const y = 704 - index * 78;
    page.drawText(label, { x: 38, y: y + 36, size: 11 });
    const field = form.createTextField(name);
    if (value !== undefined) field.setText(value);
    field.addToPage(page, { x: 38, y, width: 500, height: 27, fontSize: 11 });
  }
  const checkbox = form.createCheckBox("request.confirmed");
  checkbox.addToPage(page, { x: 38, y: 456, width: 18, height: 18 });
  page.drawText("Confirmed", { x: 65, y: 460, size: 11 });
  if (confirmed) checkbox.check();
  page.drawText("Services", { x: 38, y: 422, size: 11 });
  const services = form.createOptionList("request.services");
  services.addOptions(["Review", "Export, CSV", "Documentation"]);
  services.enableMultiselect();
  services.select(["Review", "Export, CSV"]);
  services.addToPage(page, { x: 38, y: 325, width: 240, height: 85 });
  page.drawText("Priority", { x: 38, y: 298, size: 11 });
  const priority = form.createRadioGroup("request.priority");
  priority.addOptionToPage("Normal", page, { x: 38, y: 260, width: 18, height: 18 });
  priority.addOptionToPage("Urgent", page, { x: 180, y: 260, width: 18, height: 18 });
  page.drawText("Normal", { x: 65, y: 264, size: 11 });
  page.drawText("Urgent", { x: 207, y: 264, size: 11 });
  priority.select("Normal");
  if (extra) form.createTextField("unexpected").setText("Unmapped demo data");
  if (flatten) form.flatten();
  return document.save();
}