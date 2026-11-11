"use strict";

const fs = require("node:fs");
const { MEDIA_FOLDERS, normalizeQuestion } = require("../assets/js/game-shared.js");
const { listMediaReferences, validateQuestions } = require("../assets/js/quiz-pack.js");

/** Lists the local media files referenced by the questions as paths relative to the project root. */
function listReferencedMedia(raw) {
  return listMediaReferences(raw).map(({ kind, file }) => `${MEDIA_FOLDERS[kind]}/${file}`);
}

function readQuestionsFile(questionsPath) {
  let contents;
  try {
    contents = fs.readFileSync(questionsPath, "utf-8");
  } catch (error) {
    throw new Error(`Cannot read ${questionsPath}: ${error.code === "ENOENT" ? "file not found" : error.message}`, { cause: error });
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`${questionsPath} is not valid JSON: ${error.message}`, { cause: error });
  }
}

function loadQuestions(questionsPath, options) {
  const raw = readQuestionsFile(questionsPath);
  const errors = validateQuestions(raw);
  if (errors.length > 0) {
    throw new Error(`Invalid questions file:\n- ${errors.join("\n- ")}`);
  }
  return raw.map((entry) => normalizeQuestion(entry, options));
}

module.exports = { listReferencedMedia, loadQuestions, readQuestionsFile, validateQuestions };
