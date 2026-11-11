"use strict";

const fs = require("node:fs");
const { MEDIA_FOLDERS, normalizeQuestion } = require("../assets/js/game-shared.js");

const MEDIA_SLOTS = ["before", "after"];
const MEDIA_KINDS = Object.keys(MEDIA_FOLDERS);
const MIN_WRONG_ANSWERS = 3;
const MAX_WRONG_ANSWERS = 5;

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

function validateAnswers(answers, label) {
  if (!answers || typeof answers !== "object") {
    return [`${label}: "answers" must be an object with "right" and "wrong"`];
  }

  const errors = [];
  if (!isNonEmptyString(answers.right)) {
    errors.push(`${label}: "answers.right" must be a non-empty string`);
  }

  const { wrong } = answers;
  if (!Array.isArray(wrong) || wrong.length < MIN_WRONG_ANSWERS || wrong.length > MAX_WRONG_ANSWERS) {
    errors.push(`${label}: "answers.wrong" must contain ${MIN_WRONG_ANSWERS} to ${MAX_WRONG_ANSWERS} answers`);
    return errors;
  }

  if (!wrong.every(isNonEmptyString)) {
    errors.push(`${label}: every "answers.wrong" entry must be a non-empty string`);
  }

  const options = [answers.right, ...wrong];
  if (new Set(options).size !== options.length) {
    errors.push(`${label}: answer options must be unique`);
  }
  return errors;
}

function validateMedia(media, slot, label) {
  if (media === undefined) return [];
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    return [`${label}: "${slot}" must be an object`];
  }

  return Object.entries(media).flatMap(([kind, file]) => {
    if (!MEDIA_KINDS.includes(kind)) {
      return [`${label}: "${slot}.${kind}" is not supported (use ${MEDIA_KINDS.join(", ")})`];
    }
    return isNonEmptyString(file) ? [] : [`${label}: "${slot}.${kind}" must be a file name`];
  });
}

/** Returns a list of human-readable problems; an empty list means the file is valid. */
function validateQuestions(raw) {
  if (!Array.isArray(raw)) {
    return ["questions.json must contain a JSON array"];
  }
  if (raw.length === 0) {
    return ["questions.json must contain at least one question"];
  }

  return raw.flatMap((entry, index) => {
    const label = `Question ${index + 1}`;
    if (!entry || typeof entry !== "object") {
      return [`${label}: must be an object`];
    }

    return [
      ...(isNonEmptyString(entry.question) ? [] : [`${label}: "question" must be a non-empty string`]),
      ...validateAnswers(entry.answers, label),
      ...MEDIA_SLOTS.flatMap((slot) => validateMedia(entry[slot], slot, label)),
    ];
  });
}

/** Lists the media files referenced by the questions as paths relative to the project root. */
function listReferencedMedia(raw) {
  return raw.flatMap((entry) => MEDIA_SLOTS.flatMap((slot) =>
    Object.entries(entry[slot] || {})
      .filter(([kind]) => MEDIA_KINDS.includes(kind))
      .map(([kind, file]) => `${MEDIA_FOLDERS[kind]}/${file}`)
  ));
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
