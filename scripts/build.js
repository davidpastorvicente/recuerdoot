#!/usr/bin/env node
// Builds the static site for GitHub Pages into dist/. Only allowlisted files are copied, so a local
// questions.json and private media under assets/ can never be published.
const fs = require("node:fs");
const path = require("node:path");
const { VENDOR_FILES } = require("../lib/vendor");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(process.env.BUILD_DIR || path.join(ROOT_DIR, "dist"));
const PUBLIC_FILES = [
  "index.html",
  "player.html",
  "assets/favicon.svg",
  "assets/css",
  "assets/js",
  "assets/templates",
  "assets/music/default.mp3",
  "assets/music/waiting.mp3",
];

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
PUBLIC_FILES.forEach((file) => copy(path.join(ROOT_DIR, file), path.join(OUT_DIR, file)));
Object.entries(VENDOR_FILES).forEach(([name, source]) => copy(path.join(ROOT_DIR, source), path.join(OUT_DIR, "assets/vendor", name)));
// Serve files as they are, without Jekyll processing.
fs.writeFileSync(path.join(OUT_DIR, ".nojekyll"), "");
// Static hosting: phones join at the page's own address and quizzes are loaded in the browser.
fs.writeFileSync(path.join(OUT_DIR, "config.json"), `${JSON.stringify({ joinBaseUrl: null, serverQuestions: false })}\n`);

console.log(`✓ Static site built in ${path.relative(process.cwd(), OUT_DIR) || "."}`);
