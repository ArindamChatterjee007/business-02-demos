import { readFile, writeFile, mkdir, mkdtemp, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";
import { demoSchema, syntheticForm } from "./pdf-fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = join(root, "artifacts/form-desk");
await mkdir(outputRoot, { recursive: true, mode: 0o700 });
const directory = await mkdtemp(join(outputRoot, "run-"));
const samples = [
  { name: "synthetic-01.pdf", values: { id: "0007", amount: "1250.50", notes: "=1+1", confirmed: false } },
  { name: "synthetic-02.pdf", values: { id: "0008", amount: "0", notes: "", confirmed: true } },
  { name: "synthetic-03.pdf", values: { id: "0099", amount: "-42.75", notes: "<literal>&data", confirmed: false } },
];
const files = [];
for (const sample of [...samples, { name: "invalid-sample.pdf", values: { id: "0010", amount: "not-a-number" } }]) {
  const bytes = await syntheticForm(sample.values);
  const path = join(directory, sample.name);
  await writeFile(path, bytes, { mode: 0o600 });
  const previewPath = `${path}.png`;
  if (process.platform === "darwin") await promisify(execFile)("sips", ["-s", "format", "png", "-Z", "594", path, "--out", previewPath], { timeout: 15000 });
  else await promisify(execFile)("pdftoppm", ["-png", "-singlefile", "-scale-to", "594", path, path], { timeout: 15000 });
  const preview = await readFile(previewPath);
  files.push({ name: sample.name, base64: Buffer.from(bytes).toString("base64"), preview: `data:image/png;base64,${preview.toString("base64")}` });
}
const bundle = await build({ entryPoints: [join(root, "demos/form-desk/entry.mjs")], bundle: true, platform: "browser", format: "esm", target: "es2022", minify: true, write: false, legalComments: "inline" });
const javascript = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
const font = await readFile(join(root, "node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff2"));
const css = (await readFile(join(root, "demos/form-desk/styles.css"), "utf8")).replace("__FONT_DATA__", `data:font/woff2;base64,${font.toString("base64")}`);
const data = { schema: demoSchema, files: files.slice(0, 3), invalid: files[3] };
const hash = createHash("sha256").update(javascript).digest("base64");
const security = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">`;
const html = (await readFile(join(root, "demos/form-desk/index.html"), "utf8"))
  .replace("</head>", `${security}<style>${css}</style></head>`)
  .replace("__SAMPLE_DATA__", JSON.stringify(data).replaceAll("<", "\\u003c"))
  .replace("</body>", `<script type="module">${javascript}</script></body>`);
await writeFile(join(directory, "form-desk.html"), html, { mode: 0o600 });
for (const [source, target] of [["@fontsource/manrope/LICENSE", "MANROPE-LICENSE.txt"], ["exceljs/LICENSE", "EXCELJS-LICENSE.txt"], ["pdf-lib/LICENSE.md", "PDF-LIB-LICENSE.txt"], ["lucide/LICENSE", "LUCIDE-LICENSE.txt"]]) await copyFile(join(root, "node_modules", source), join(directory, target));
await writeFile(join(directory, "build.json"), JSON.stringify({ builtAt: new Date().toISOString(), demoOnly: true, htmlBytes: Buffer.byteLength(html), sourceCount: 3, clientFilesUsed: false, networkRequired: false }, null, 2));
console.log(JSON.stringify({ directory, page: join(directory, "form-desk.html"), htmlBytes: Buffer.byteLength(html), mode: "self-contained synthetic demo, no server or network" }, null, 2));