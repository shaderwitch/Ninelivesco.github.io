/* =============================================================================
 * Nine Lives Co. — dev.mjs  (the `npm start` dev loop)
 *
 * Build once, then WATCH every source that feeds the page — including
 * @ninelives/necromancy and @kitten/core, compiled in as SOURCE — and rebuild on
 * save with LIVE reload, so edits show up instantly (no manual rebuild/refresh).
 *
 * Speed: CSS is compiled IN-PROCESS (dart-sass JS API + a reused Tailwind/PostCSS
 * processor), not by spawning the CLIs (~25x faster warm rebuilds). Only
 * build.mjs (HTML render + JS ship) is a short spawn, and only when
 * template/data/js change. (Dev skips autoprefixer for speed; prod `npm run
 * build` still uses the CLI, which prefixes + minifies.)
 *
 * Live reload: save .scss → CSS hot-swaps in place (no reload); save
 * template/data/js → full reload. Signalled over Server-Sent Events.
 * ========================================================================== */
import { spawnSync, spawn } from "node:child_process";
import { watch, existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";
import * as sass from "sass";
import postcss from "postcss";
import tailwind from "tailwindcss";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DIST = join(__dirname, "dist");
const PORT = 8097;

// --- CSS: in-process, warm. The sass output is the `@import`ed sheet; append
//     the @tailwind layers, then run the reused Tailwind/PostCSS processor. -----
const cssProcessor = postcss([tailwind(join(__dirname, "tailwind.config.js"))]);
async function compileCss() {
  const sassCss = sass.compile(join(__dirname, "src", "styles.scss"), { quietDeps: true }).css;
  const input = sassCss + "\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n";
  const { css } = await cssProcessor.process(input, { from: join(__dirname, "src", "input.css"), to: join(DIST, "css", "main.css") });
  mkdirSync(join(DIST, "css"), { recursive: true });
  writeFileSync(join(DIST, "css", "main.css"), css);
}

// --- HTML + JS ship: build.mjs (short spawn), only on template/data/js change.
const buildHtml = () => spawnSync("node", ["build.mjs"], { stdio: "inherit", shell: true, cwd: __dirname }).status === 0;

// --- live-reload over Server-Sent Events ------------------------------------
const clients = new Set();
const notify = (kind) => { for (const res of clients) res.write(`data: ${kind}\n\n`); };
const RELOAD_SNIPPET =
  '<script>(function(){try{var s=new EventSource("/__livereload");s.onmessage=function(ev){' +
  'if(ev.data==="css"){document.querySelectorAll(\'link[rel="stylesheet"]\').forEach(function(l){' +
  'var u=l.href.split("?")[0];if(!/main\\.css$/.test(u))return;var n=l.cloneNode();' +
  'n.href=u+"?t="+Date.now();n.onload=function(){l.remove()};l.parentNode.insertBefore(n,l.nextSibling);});}' +
  'else{location.reload();}};}catch(_){}})();</script>';

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json",
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/__livereload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write("retry: 1000\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end("Forbidden"); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return res.end(`404 — ${rel}`); }
  const ext = extname(file).toLowerCase();
  let body = readFileSync(file);
  if (ext === ".html") body = Buffer.from(body.toString("utf8").replace("</body>", RELOAD_SNIPPET + "</body>"));
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
});

// --- initial build ----------------------------------------------------------
buildHtml();
await compileCss();

// --- watch sources (incl. the framework) and rebuild the MINIMUM needed -----
const watched = [
  join(__dirname, "src"), join(__dirname, "templates"), join(__dirname, "data"),
  join(ROOT, "packages", "necromancy", "scss"),
  join(ROOT, "packages", "necromancy", "hbs"),
  join(ROOT, "packages", "necromancy", "js"),
  join(ROOT, "packages", "kitten-core", "scss"),
  join(ROOT, "packages", "kitten-core", "js"),
];
let timer = null, sawStyle = false, sawMarkup = false, sawScript = false;
const classify = (file) => {
  if (/\.(scss|css)$/i.test(file)) sawStyle = true;
  else if (/\.(hbs|json)$/i.test(file)) sawMarkup = true;
  else if (/\.(js|mjs)$/i.test(file)) sawScript = true;
  else sawMarkup = true; // unknown → safest (full rebuild)
};
async function run() {
  const t0 = Date.now();
  const reload = sawMarkup || sawScript;
  try {
    if (sawMarkup || sawScript) buildHtml();
    if (sawStyle || sawMarkup) await compileCss();
    notify(reload ? "reload" : "css");
    process.stdout.write(`✓ ${reload ? "reload" : "css hot-swap"} — ${Date.now() - t0}ms\n`);
  } catch (e) {
    process.stdout.write(`✗ build error: ${e.message}\n`);
  }
  sawStyle = sawMarkup = sawScript = false;
};
const schedule = (file) => { classify(file); clearTimeout(timer); timer = setTimeout(run, 120); };
for (const dir of watched) {
  try { watch(dir, { recursive: true }, (_evt, f) => schedule(f ? f.replace(/\\/g, "/") : dir)); }
  catch { /* directory may not exist yet — skip */ }
}

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  process.stdout.write(
    `\n▶ Nine Lives Co. dev — ${url}  (in-process compile, live reload)\n` +
    "  Watching this site + @ninelives/necromancy + @kitten/core.\n" +
    "  Save scss → CSS hot-swaps (~100ms). Save template/data/js → full reload.\n\n",
  );
  const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(opener[0], opener[1], { stdio: "ignore", shell: process.platform === "win32" }).on("error", () => {}); } catch { /* ignore */ }
});
