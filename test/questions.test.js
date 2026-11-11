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
    assert.deepEqual(validateQuestions({}), ["questions.json debe contener una lista JSON de preguntas"]);
    assert.deepEqual(validateQuestions([]), ["questions.json debe contener al menos una pregunta"]);
  });

  it("reports missing question text and answers with the question number", () => {
    assert.deepEqual(validateQuestions([valid(), { answers: { right: "A", wrong: ["B", "C", "D"] } }]), [
      'Pregunta 2: "question" debe ser un texto no vacío',
    ]);
    assert.match(validateQuestions([valid({ answers: null })])[0], /"answers" debe ser un objeto/);
  });

  it("enforces 3 to 5 unique wrong answers", () => {
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C"] } })])[0], /entre 3 y 5 respuestas/);
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C", "D", "E", "F", "G"] } })])[0], /entre 3 y 5 respuestas/);
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C", "A"] } })])[0], /no pueden repetirse/);
    assert.match(validateQuestions([valid({ answers: { right: "A", wrong: ["B", "C", ""] } })])[0], /texto no vacío/);
  });

  it("validates media slots and kinds", () => {
    assert.deepEqual(validateQuestions([valid({ before: { gif: "x.gif" } })]), [
      'Pregunta 1: "before.gif" no está permitido (usa audio, image, music, video)',
    ]);
    assert.deepEqual(validateQuestions([valid({ after: { audio: "" } })]), ['Pregunta 1: "after.audio" debe ser un nombre de archivo']);
    assert.deepEqual(validateQuestions([valid({ after: [] })]), ['Pregunta 1: "after" debe ser un objeto']);
  });
});

describe("loadQuestions", () => {
  it("throws a readable error for missing or invalid files", () => {
    assert.throws(() => loadQuestions(path.join(__dirname, "missing.json")), /file not found/);
    assert.throws(() => loadQuestions(__filename), /not valid JSON/);
  });

  it("lists every referenced local media file", () => {
    const raw = require(FIXTURE);
    assert.deepEqual(listReferencedMedia(raw), [
      "assets/images/bicycle.jpg",
      "assets/audios/PTT-20190704-WA0001_filtered.mp3",
      "assets/audios/PTT-20190704-WA0001.mp3",
      "assets/music/reveal.mp3",
      "assets/images/trip.jpg",
      "assets/videos/trip.mp4",
    ]);
    assert.deepEqual(listReferencedMedia([valid({ after: { image: "https://example.com/photo.jpg" } })]), []);
  });
});
