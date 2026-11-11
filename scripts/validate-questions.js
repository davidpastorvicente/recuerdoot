#!/usr/bin/env node
// Validates questions.json (or the path given as first argument) and checks every referenced media file exists.
const fs = require("node:fs");
const path = require("node:path");
const { listReferencedMedia, readQuestionsFile, validateQuestions } = require("../lib/questions");

const ROOT_DIR = path.resolve(__dirname, "..");
const questionsPath = path.resolve(process.argv[2] || path.join(ROOT_DIR, "questions.json"));

function fail(problems) {
  console.error(`✗ ${path.relative(process.cwd(), questionsPath)} has ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

let raw;
try {
  raw = readQuestionsFile(questionsPath);
} catch (error) {
  fail([error.message]);
}

const schemaErrors = validateQuestions(raw);
if (schemaErrors.length > 0) {
  fail(schemaErrors);
}

const missingMedia = [...new Set(listReferencedMedia(raw))]
  .filter((file) => !fs.existsSync(path.join(ROOT_DIR, file)))
  .map((file) => `Missing media file: ${file}`);
if (missingMedia.length > 0) {
  fail(missingMedia);
}

console.log(`✓ ${raw.length} questions are valid and all media files exist.`);
