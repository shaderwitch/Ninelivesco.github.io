/* =============================================================================
 * Nine Lives Co. — build.mjs
 * Renders the page from data + Handlebars (Necromancy framework partials: head,
 * site-frame, sigil-defs, footer-mark, …), then ships the framework JS (core
 * booter + the brand ember field). CSS is produced separately by build:css.
 * Same harness as sites/guidelines — the site dogfoods the framework.
 * ========================================================================== */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { Handlebars, registerFramework, loadData, shipFrameworkJS, read, log } from "@ninelives/necromancy/build";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK = join(__dirname, "..", "..", "packages", "necromancy");

registerFramework(FRAMEWORK);                         // framework partials (head, sigil-defs, site-frame, …)
const data = loadData(join(__dirname, "data"));

const html = Handlebars.compile(read(join(__dirname, "templates", "index.hbs")))(data);
mkdirSync(join(__dirname, "dist"), { recursive: true });
writeFileSync(join(__dirname, "dist", "index.html"), html);
log(`html: dist/index.html (${html.length.toLocaleString()} bytes)`);

shipFrameworkJS(FRAMEWORK, join(__dirname, "dist"));  // core booter + js/embers.js
