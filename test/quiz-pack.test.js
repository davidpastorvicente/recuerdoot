const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { findMissingMedia, indexPackPaths, listMediaReferences, resolvePackPath } = require("../assets/js/quiz-pack.js");

const question = (media = {}) => ({ question: "Q", answers: { right: "A", wrong: ["B", "C", "D"] }, ...media });

describe("quiz-pack: indexPackPaths", () => {
  it("uses the shallowest questions.json as the pack root", () => {
    const index = indexPackPaths([
      "my-quiz/questions.json",
      "my-quiz/images/photo.jpg",
      "my-quiz/old/questions.json",
      "elsewhere/notes.txt",
    ]);
    assert.equal(index.questionsPath, "my-quiz/questions.json");
    assert.deepEqual([...index.files.keys()].sort(), ["images/photo.jpg", "old/questions.json", "questions.json"]);
  });

  it("ignores hidden files and macOS zip metadata", () => {
    const index = indexPackPaths(["questions.json", "__MACOSX/._questions.json", ".DS_Store", "images/.hidden.jpg", "images/a.jpg"]);
    assert.deepEqual([...index.files.keys()].sort(), ["images/a.jpg", "questions.json"]);
  });

  it("normalizes Windows separators and returns null without questions.json", () => {
    assert.equal(indexPackPaths(["quiz\\questions.json"]).questionsPath, "quiz/questions.json");
    assert.equal(indexPackPaths(["images/a.jpg"]), null);
  });
});

describe("quiz-pack: resolvePackPath", () => {
  const index = indexPackPaths([
    "quiz/questions.json",
    "quiz/audios/clip.mp3",
    "quiz/assets/images/photo.jpg",
    "quiz/flat.mp4",
    "quiz/misc/Song.MP3",
    "quiz/a/dup.jpg",
    "quiz/images/dup.jpg",
  ]);

  it("prefers the kind folder, then assets/<folder>, then the root", () => {
    assert.equal(resolvePackPath(index, "audio", "clip.mp3"), "quiz/audios/clip.mp3");
    assert.equal(resolvePackPath(index, "image", "photo.jpg"), "quiz/assets/images/photo.jpg");
    assert.equal(resolvePackPath(index, "video", "flat.mp4"), "quiz/flat.mp4");
  });

  it("falls back to a unique file with the same name, ignoring case", () => {
    assert.equal(resolvePackPath(index, "music", "song.mp3"), "quiz/misc/Song.MP3");
    assert.equal(resolvePackPath(index, "image", "dup.jpg"), "quiz/images/dup.jpg");
    assert.equal(resolvePackPath(index, "audio", "missing.mp3"), null);
  });
});

describe("quiz-pack: media references", () => {
  it("skips remote URLs and reports each missing file once", () => {
    const raw = [
      question({ before: { image: "a.jpg", video: "https://example.com/v.mp4" } }),
      question({ after: { image: "a.jpg", audio: "b.mp3" } }),
    ];
    assert.deepEqual(listMediaReferences(raw).map(({ kind, file }) => `${kind}:${file}`), ["image:a.jpg", "image:a.jpg", "audio:b.mp3"]);

    const index = indexPackPaths(["questions.json", "images/a.jpg"]);
    assert.deepEqual(findMissingMedia(raw, index), ['Pregunta 2: falta el archivo "audios/b.mp3"']);
  });
});
