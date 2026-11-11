const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
require("../assets/js/game-config.js");
const shared = require("../assets/js/game-shared.js");
const leaderboard = require("../assets/js/host-leaderboard.js");

describe("game-shared", () => {
  it("escapes HTML special characters", () => {
    assert.equal(shared.escapeHtml(`<b class="x">Tom & 'Jerry'</b>`), "&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;");
    assert.equal(shared.escapeHtml(42), "42");
  });

  it("randomInt stays within bounds and rejects invalid ranges", () => {
    for (let index = 0; index < 500; index++) {
      const value = shared.randomInt(6);
      assert.ok(Number.isInteger(value) && value >= 0 && value < 6);
    }
    assert.throws(() => shared.randomInt(0), RangeError);
    assert.throws(() => shared.randomInt(1.5), RangeError);
  });

  it("shuffle returns a permutation without mutating the input", () => {
    const input = ["a", "b", "c", "d", "e", "f"];
    const result = shared.shuffle(input);
    assert.deepEqual(input, ["a", "b", "c", "d", "e", "f"]);
    assert.deepEqual([...result].sort(), input);
  });

  it("parses Spanish dates from WhatsApp audio names", () => {
    assert.deepEqual(shared.parseDateParts("PTT-20180122-WA0003.mp3"), { date: "22 enero 2018", year: "2018", iso: "2018-01-22" });
    assert.deepEqual(shared.parseDateParts("PTT-20190704-WA0001_filtered.mp3"), { date: "4 julio 2019", year: "2019", iso: "2019-07-04" });
    assert.deepEqual(shared.parseDateParts("clip.mp4"), { date: "", year: "", iso: "" });
    assert.deepEqual(shared.parseDateParts("20141399"), { date: "", year: "", iso: "" });
  });

  it("normalizes a questions.json entry into the runtime shape", () => {
    const question = shared.normalizeQuestion({
      question: "¿Quién?",
      answers: { right: "A", wrong: ["B", "C", "D"] },
      before: { audio: "PTT-20210315-WA0002_filtered.mp3", image: "pic.jpg" },
      after: { audio: "PTT-20210315-WA0002.mp3", music: "reveal.mp3" },
    }, { shuffleOptions: (options) => options });

    assert.deepEqual(question, {
      question: "¿Quién?",
      options: ["A", "B", "C", "D"],
      correct: "A",
      audioBefore: true,
      before: { audio: "assets/audios/PTT-20210315-WA0002_filtered.mp3", image: "assets/images/pic.jpg", music: null, video: null },
      after: { audio: "assets/audios/PTT-20210315-WA0002.mp3", image: null, music: "assets/music/reveal.mp3", video: null },
      date: "2021-03-15",
    });
  });

  it("normalizes entries without media", () => {
    const question = shared.normalizeQuestion({ question: "Q", answers: { right: "A", wrong: ["B", "C", "D"] } });
    assert.equal(question.audioBefore, false);
    assert.equal(question.date, "");
    assert.deepEqual(question.before, { audio: null, image: null, music: null, video: null });
    assert.deepEqual([...question.options].sort(), ["A", "B", "C", "D"]);
  });

  it("resolves media through a custom resolver and keeps remote URLs", () => {
    const entry = {
      question: "Q",
      answers: { right: "A", wrong: ["B", "C", "D"] },
      before: { image: "pic.jpg", video: "https://example.com/clip.mp4" },
    };
    const resolveMedia = (kind, file) => `blob:${kind}/${file}`;
    assert.deepEqual(shared.normalizeQuestion(entry, { resolveMedia }).before.image, "blob:image/pic.jpg");
    assert.equal(shared.normalizeQuestion(entry).before.video, "https://example.com/clip.mp4");
    assert.equal(shared.isRemoteMedia("HTTPS://x.test/a.mp3"), true);
    assert.equal(shared.isRemoteMedia("a.mp3"), false);
  });

  it("creates random hex ids", () => {
    const id = shared.randomId();
    assert.match(id, /^[0-9a-f]{32}$/);
    assert.notEqual(id, shared.randomId());
  });

  it("formats question counters", () => {
    assert.equal(shared.formatQuestionCounter(0, 12), "Pregunta 1 de 12");
  });

  it("provides one answer shape per possible option", () => {
    assert.equal(shared.ANSWER_SHAPES.length, 6);
  });
});

describe("host-leaderboard", () => {
  it("computes rank movement between rounds", () => {
    const previous = [{ playerId: "a", score: 300 }, { playerId: "b", score: 200 }, { playerId: "c", score: 100 }];
    const next = [{ playerId: "c", score: 900 }, { playerId: "a", score: 300 }, { playerId: "b", score: 200 }, { playerId: "d", score: 0 }];

    assert.deepEqual(Object.fromEntries(leaderboard.getLeaderboardMovement(previous, next)), {
      c: { direction: "up", places: 2 },
      a: { direction: "down", places: 1 },
      b: { direction: "down", places: 1 },
      d: { direction: "new", places: 0 },
    });
  });

  it("falls back to names when entries have no playerId", () => {
    const movement = leaderboard.getLeaderboardMovement([{ name: "Ana" }], [{ name: "Ana" }]);
    assert.deepEqual(movement.get("Ana"), { direction: "same", places: 0 });
  });

  it("clones leaderboards deeply enough to avoid shared mutation", () => {
    const original = [{ name: "Ana", score: 1 }];
    const clone = leaderboard.cloneLeaderboard(original);
    clone[0].score = 99;
    assert.equal(original[0].score, 1);
  });
});
