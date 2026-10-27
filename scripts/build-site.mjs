import { mkdir, readFile, writeFile, cp, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const output = join(root, "site");
const verifiedOnly = process.argv.includes("--verified-only");
let formDesk;
let verification;
if (!verifiedOnly) {
  const built = await execute(process.execPath, [join(root, "demos/build-form-desk.mjs")], { timeout: 120000, maxBuffer: 1024 * 1024 });
  formDesk = JSON.parse(built.stdout.trim());
  const tested = await execute(process.execPath, [join(root, "demos/test-form-desk.mjs"), formDesk.page], { timeout: 180000, maxBuffer: 1024 * 1024 });
  verification = JSON.parse(tested.stdout.trim());
  if (verification.status !== "PASS" || verification.externalRequests.length || verification.errors.length) throw new Error("Form Desk did not pass remote acceptance.");
  await mkdir(join(output, "form-desk"), { recursive: true });
}
await mkdir(join(output, "evidence"), { recursive: true });
await cp(join(root, "static"), output, { recursive: true });
if (!verifiedOnly) {
  await copyFile(formDesk.page, join(output, "form-desk/index.html"));
  for (const name of ["form-desk-1440.png", "form-desk-390.png", "form-desk-320.png", "error-state.png", "verified-demo-output.xlsx", "synthetic-01.pdf", "synthetic-02.pdf", "synthetic-03.pdf", "invalid-sample.pdf", "MANROPE-LICENSE.txt", "EXCELJS-LICENSE.txt", "PDF-LIB-LICENSE.txt", "LUCIDE-LICENSE.txt"]) await copyFile(join(formDesk.directory, name), join(output, "evidence", name));
  const { directory: ignoredDirectory, ...safeVerification } = verification;
  await writeFile(join(output, "evidence/form-desk-verification.json"), JSON.stringify(safeVerification, null, 2));
  await copyFile(join(root, "node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff2"), join(output, "manrope.woff2"));
}
const cards = [
  ...(!verifiedOnly ? [{ title: "Form Desk", type: "Interactive software demo", image: "evidence/form-desk-1440.png", href: "form-desk/", text: "PDF form fields, schema validation and a real Excel export. Processing stays in the browser.", action: "Open workspace", proof: "evidence/form-desk-verification.json" }] : []),
  { title: "PDF to XLSX", type: "Tested data workflow", image: "portfolio/pdf-to-xlsx-demo.png", href: "portfolio/pdf-to-xlsx-demo.html", text: "Typed values, leading-zero identifiers and formula-looking text. Three synthetic input documents.", action: "View case study", proof: "portfolio/pdf-evidence/verification.json" },
  { title: "Project Tracker", type: "Responsive UI case study", image: "tracker/tracker-case-study.png", href: "tracker/tracker-case-study.png", text: "Actual frontend screenshots with synthetic records. This case is a visual review, not a hosted backend.", action: "View full study", proof: "tracker/verification.json" },
  { title: "Waypoint", type: "Fictional identity concept", image: "portfolio/waypoint-concept.png", href: "portfolio/waypoint-concept.html", text: "A coastal identity exploration. Original personal concept, not a commissioned brand.", action: "View concept", proof: "portfolio/waypoint-concept.pdf" },
  { title: "The Mendery", type: "Fictional identity concept", image: "portfolio/mendery-concept.png", href: "portfolio/mendery-concept.html", text: "A repair-workshop identity exploration. Original personal concept, not client work.", action: "View concept", proof: "portfolio/mendery-concept.pdf" },
  { title: "Lantern Row", type: "Fictional identity concept", image: "portfolio/lantern-row-concept.png", href: "portfolio/lantern-row-concept.html", text: "A night-market identity exploration. Fictional venue and visual system, not an operating business.", action: "View concept", proof: "portfolio/lantern-row-concept.pdf" },
];
const builtAt = new Date().toISOString();
const cardMarkup = cards.map(card => `<article class="demo"><a class="visual" href="${card.href}" aria-label="${card.action}: ${card.title}"><img src="${card.image}" alt="${card.title} actual demonstration preview" width="800" height="600" loading="lazy"></a><div class="demo-copy"><p class="kind">${card.type}</p><h2>${card.title}</h2><p>${card.text}</p><div class="links"><a href="${card.href}">${card.action} <span aria-hidden="true">&#8599;</span></a><a href="${card.proof}">Evidence / download</a></div></div></article>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Self-initiated, AI-assisted software demonstrations and fictional visual studies. Synthetic data, not client work."><title>Demo Library / Arindam Chatterjee</title><style>
@font-face{font-family:Manrope;src:url('manrope.woff2') format('woff2');font-display:swap}*{box-sizing:border-box}body{margin:0;font:14px Manrope,sans-serif;letter-spacing:0;color:#25342e;background:#f3f6f4}a{color:inherit;text-decoration:none}a:focus-visible{outline:3px solid #d59847;outline-offset:4px}header{border-bottom:1px solid #dae4dc;background:#fff;padding:22px 36px;display:flex;justify-content:space-between;align-items:center;gap:18px}header strong{font-size:13px}header span{font-size:11px;color:#65796c}main{max-width:1260px;margin:auto;padding:38px 28px}.heading{max-width:760px;margin-bottom:29px}.eyebrow,.kind{font-size:10px;font-weight:700;color:#236747;margin:0 0 9px}.heading h1{font-size:32px;line-height:1.2;margin:0 0 12px}.heading p{line-height:1.8;color:#607166;font-size:13px}.library{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.demo{border:1px solid #dce5de;border-radius:7px;overflow:hidden;background:#fff;min-width:0}.visual{display:block;aspect-ratio:4/3;background:#e8eee9;overflow:hidden}.visual img{width:100%;height:100%;object-fit:contain;display:block}.demo-copy{padding:21px}.demo h2{font-size:21px;margin:0 0 9px;line-height:1.3}.demo-copy>p:not(.kind){min-height:62px;font-size:12px;line-height:1.75;color:#647469}.links{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding-top:14px;border-top:1px solid #e4ebe6;font-size:10px;font-weight:700}.links a:first-child{color:#176442}.links a:hover{text-decoration:underline}.verification{border-top:1px solid #dce5de;margin-top:34px;padding-top:24px;display:flex;justify-content:space-between;gap:24px;font-size:11px;line-height:1.9;color:#65766b}.verification a{text-decoration:underline;color:#225f40}footer{margin-top:24px;font-size:9px;color:#75877b;line-height:1.8}code{overflow-wrap:anywhere;font-size:10px}@media(max-width:950px){.library{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){header{padding:18px 18px;align-items:flex-start;flex-direction:column;gap:5px}main{padding:28px 18px}.heading h1{font-size:27px}.library{grid-template-columns:minmax(0,1fr)}.demo-copy>p:not(.kind){min-height:0}.verification{flex-direction:column;gap:12px}}
</style></head><body><header><strong>ARINDAM CHATTERJEE / DEMO LIBRARY</strong><span>Personal experiments. No client data.</span></header><main><section class="heading"><p class="eyebrow">SOFTWARE + VISUAL STUDIES</p><h1>Working ideas, inspectable results.</h1><p>Self-initiated, AI-assisted demonstrations and fictional design concepts. All displayed records are synthetic. These are portfolio experiments, not paid client deliveries, production services or earnings claims.</p></section><section class="library" aria-label="Demo collection">${cardMarkup}</section><section class="verification"><div><strong>Verification records</strong><br><a href="evidence/form-desk-verification.json">Current interactive-demo checks</a><br><a href="verification/outreach-synthetic.json">Queue benchmark: synthetic only, zero client contacts</a></div><div><strong>Source and history</strong><br><a href="https://github.com/ArindamChatterjee007/business-02-demos">Public demo source and remote runs</a><br><a href="deployment.json">Deployment receipt</a></div></section><footer>Built ${builtAt}. Static portfolio demonstration. No account, payment or production service is provided.<br>Source commit: <code>${process.env.GITHUB_SHA || "local-unpublished"}</code></footer></main></body></html>`;
const currentHtml = (verifiedOnly ? html.replace('<a href="evidence/form-desk-verification.json">Current interactive-demo checks</a>', '<a href="https://github.com/ArindamChatterjee007/business-02-demos/tree/main/demos/form-desk">Form Desk source: interactive verification pending</a>') : html).replace("local-unpublished</code>", "see repository history</code>");
await writeFile(join(output, "index.html"), currentHtml);
await writeFile(join(output, ".nojekyll"), "");
const deployment = { builtAt, sourceCommit: process.env.GITHUB_SHA || null, githubRunId: process.env.GITHUB_RUN_ID || null, demoCount: cards.length, realClientWork: false, formDesk: verifiedOnly ? { status: "pending remote verification; not hosted" } : { status: verification.status, checks: verification.checks.length, externalRequests: verification.externalRequests.length, htmlSHA256: createHash("sha256").update(await readFile(formDesk.page)).digest("hex") }, privateDataPublished: false, galleryBrowserValidation: verifiedOnly ? "pending" : "PASS" };
await writeFile(join(output, "deployment.json"), JSON.stringify(deployment, null, 2));
if (!verifiedOnly) await execute(process.execPath, [join(root, "demos/test-demo-site.mjs"), output], { timeout: 90000, maxBuffer: 1024 * 1024 });
console.log(JSON.stringify({ output, deployment }, null, 2));