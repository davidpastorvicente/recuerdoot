const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { listReferencedMedia, loadQuestions, validateQuestions } = require("../lib/questions");

const FIXTURE = path.join(__dirname, "fixtures", "questions.json");
const valid = (overrides = {}) => ({ question: "Q", answers: { right: "A", wrong: ["B", "C", "D"] }, ...overrides });

describe("validateQuestions", () => {
  it("accepts a valid file", () => {
    assert.equal(loadQuestions(FIXTURE).length, 3);
  });

  it("requires a non-empty array", () => {
    assert.deepEqual(validateQuestions({}), ["questions.json must contain a JSON array"]);
    assert.deepEqual(validateQuestions([]), ["questions.json must contain at least one question"]);
  });

  it("reports missing question text and answers with the question number", () => {
    assert.deepEqual(validateQuestions([valid(), { answers: { right: "A", wrong: ["B", "C", "D"] } }]), [
      'Question 2: "question" must be a non-empty string',
    ]);
    assert.match(validateQuestions([valid({ answers: null })])[0], /"answers" must be an object/);
  });

  it("enforces 3 to 5 unique wrong answers", () => {
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C"] } })])[0], /3 to 5 answers/);
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C", "D", "E", "F", "G"] } })])[0], /3 to 5 answers/);
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C", "A"] } })])[0], /must be unique/);
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C", ""] } })])[0], /non-empty string/);
  });

  it("validates media slots and kinds", () => {
    assert.deepEqual(validateQuestions([valid({ before: { gif: "x.gif" } })]), [
      'Question 1: "before.gif" is not supported (use audio, image, music, video)',
    ]);
    assert.deepEqual(validateQuestions([valid({ after: { audio: "" } })]), ['Question 1: "after.audio" must be a file name']);
    assert.deepEqual(validateQuestions([valid({ after: [] })]), ['Question 1: "after" must be an object']);
  });
});

describe("loadQuestions", () => {
  it("throws a readable error for missing or invalid files", () => {
    assert.throws(() => loadQuestions(path.join(__dirname, "missing.json")), /file not found/);
    assert.throws(() => loadQuestions(__filename), /not valid JSON/);
  });

  it("lists every referenced media file", () => {
    const raw = require(FIXTURE);
    assert.deepEqual(listReferencedMedia(raw), [
      "assets/images/bicycle.jpg",
      "assets/audios/PTT-20190704-WA0001_filtered.mp3",
      "assets/audios/PTT-20190704-WA0001.mp3",
      "assets/music/reveal.mp3",
      "assets/images/trip.jpg",
      "assets/videos/trip.mp4",
    ]);
  });
});
