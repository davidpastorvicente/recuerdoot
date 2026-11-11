const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const CONFIG = require("../assets/js/game-config.js");
const { normalizeQuestion } = require("../assets/js/game-shared.js");
const { Game, calculatePoints, sanitizePlayerName } = require("../assets/js/game-engine.js");

const PIN = "123456";
const identity = (options) => options;
const TEXT_QUESTION = normalizeQuestion({ question: "Text?", answers: { right: "A", wrong: ["B", "C", "D"] } }, { shuffleOptions: identity });
const AUDIO_QUESTION = normalizeQuestion({
  question: "Audio?",
  answers: { right: "X", wrong: ["Y", "Z", "W"] },
  before: { audio: "PTT-20190704-WA0001_filtered.mp3" },
  after: { audio: "PTT-20190704-WA0001.mp3" },
}, { shuffleOptions: identity });

function setup(t, { questions = [TEXT_QUESTION, AUDIO_QUESTION], players = ["Ana", "Bea"], config = CONFIG } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  const events = [];
  const game = new Game({ pin: PIN, hostId: "host", questions, config, emit: (target, event, payload) => events.push({ target, event, payload }) });
  players.forEach((name) => game.join(`socket-${name}`, { pin: PIN, name }));

  const idOf = (name) => [...game.players.values()].find((player) => player.name === name).playerId;
  const sent = (event, target) => events.filter((entry) => entry.event === event && (target === undefined || entry.target === target));
  const last = (event, target) => sent(event, target).at(-1)?.payload;
  const startAndWait = () => {
    game.start("host");
    t.mock.timers.tick(250 + CONFIG.COUNTDOWN_GAME_START_SECONDS * 1000);
  };
  return { game, events, idOf, sent, last, startAndWait };
}

describe("Game: joining", () => {
  it("adds players, sanitizes names and notifies the host", (t) => {
    const { game, last } = setup(t, { players: [] });
    assert.equal(game.join("s1", { pin: ` ${PIN} `, name: "  Ana\u0007   María " }), true);
    assert.equal(last("player:joined", "s1").name, "Ana María");
    assert.deepEqual(last("host:playerList", "host").map((player) => player.name), ["Ana María"]);
  });

  it("rejects bad PINs, empty names, duplicate names and full rooms", (t) => {
    const { game, last } = setup(t, { players: ["Ana"], config: { ...CONFIG, MAX_PLAYERS: 2 } });
    game.join("s1", { pin: "000000", name: "Bea" });
    assert.deepEqual(last("player:error", "s1"), { key: "join.error.wrongPin" });
    game.join("s2", { pin: PIN, name: "   " });
    assert.deepEqual(last("player:error", "s2"), { key: "join.error.nameRequired" });
    game.join("s3", { pin: PIN, name: "ANA" });
    assert.deepEqual(last("player:error", "s3"), { key: "join.error.nameTaken" });
    game.join("s4", { pin: PIN, name: "Bea" });
    game.join("s5", { pin: PIN, name: "Cris" });
    assert.deepEqual(last("player:error", "s5"), { key: "join.error.full", params: { max: 2 } });
  });

  it("does not crash on malformed payloads", (t) => {
    const { game, last } = setup(t, { players: [] });
    assert.equal(game.join("s1", undefined), false);
    assert.equal(game.join("s2", { pin: PIN, name: 42 }), false);
    assert.deepEqual(last("player:error", "s2"), { key: "join.error.nameRequired" });
  });

  it("refuses new players once the game has started", (t) => {
    const { game, last } = setup(t);
    game.start("host");
    game.join("late", { pin: PIN, name: "Late" });
    assert.deepEqual(last("player:error", "late"), { key: "join.error.started" });
  });

  it("removes players who leave the lobby", (t) => {
    const { game } = setup(t);
    game.disconnect("socket-Ana");
    assert.deepEqual([...game.players.values()].map((player) => player.name), ["Bea"]);
  });
});

describe("Game: phases", () => {
  it("only the host can start, and only with players", (t) => {
    const empty = setup(t, { players: [] });
    assert.equal(empty.game.start("host"), false);

    t.mock.timers.reset();
    const { game, last } = setup(t);
    assert.equal(game.start("socket-Ana"), false);
    assert.equal(game.start("host"), true);
    assert.equal(game.phase, "starting");
    assert.deepEqual(last("game:startCountdown", game.room), { seconds: CONFIG.COUNTDOWN_GAME_START_SECONDS, startsAt: 1_000_250 });
    assert.equal(game.start("host"), false);
  });

  it("opens the first question when the start countdown ends", (t) => {
    const { game, last, startAndWait } = setup(t);
    startAndWait();
    assert.equal(game.phase, "answering");
    assert.equal(last("host:question", "host").question, "Text?");
    assert.equal(last("host:question", "host").countdownAfter, CONFIG.COUNTDOWN_QUESTION_SECONDS);
    assert.deepEqual(last("player:question", "socket-Ana"), {
      index: 0, total: 2, options: ["A", "B", "C", "D"], audioBefore: false, answersOpen: true, hasAnswered: false, selectedAnswer: null,
    });
  });

  it("reveals when the question timer expires and resets streaks of players who did not answer", (t) => {
    const { game, last, startAndWait } = setup(t);
    startAndWait();
    game.submitAnswer("socket-Ana", "A");
    t.mock.timers.tick(CONFIG.COUNTDOWN_QUESTION_SECONDS * 1000);
    assert.equal(game.phase, "reveal");
    assert.deepEqual(last("player:result", "socket-Bea"), { isCorrect: false, points: 0, rank: 2, score: 0, streak: 0, timeout: true });
    assert.equal(last("host:reveal", "host").optionCounts.A, 1);
  });

  it("drives audio questions through listening -> answering -> reveal", (t) => {
    const { game, last, startAndWait } = setup(t, { questions: [AUDIO_QUESTION] });
    startAndWait();
    assert.equal(game.phase, "listening");
    assert.equal(last("player:question", "socket-Ana").answersOpen, false);
    assert.equal(last("host:question", "host").before.audio, "assets/audios/PTT-20190704-WA0001_filtered.mp3");

    assert.equal(game.openAnswers("socket-Ana"), false);
    assert.equal(game.openAnswers("host"), true);
    assert.equal(game.openAnswers("host"), false);
    assert.equal(game.phase, "answering");
    assert.ok(last("player:answersOpen", game.room));

    t.mock.timers.tick(CONFIG.COUNTDOWN_AUDIO_AFTER_SECONDS * 1000);
    assert.equal(game.phase, "reveal");
    assert.equal(last("host:reveal", "host").date, "2019-07-04");
  });

  it("advances on host:next and ends after the last question", (t) => {
    const { game, last, startAndWait } = setup(t, { questions: [TEXT_QUESTION] });
    assert.equal(game.next("host"), false);
    startAndWait();
    game.timeUp("host");
    assert.equal(game.phase, "reveal");
    assert.equal(game.next("socket-Ana"), false);
    assert.equal(game.next("host"), true);
    assert.equal(game.phase, "end");
    assert.equal(last("game:end", game.room).leaderboard.length, 2);
  });
});

describe("Game: answers and scoring", () => {
  it("awards more points to faster correct answers", (t) => {
    const { game, last, idOf, startAndWait } = setup(t);
    startAndWait();
    game.submitAnswer("socket-Ana", "A");
    t.mock.timers.tick(10_000);
    game.submitAnswer("socket-Bea", "A");

    assert.equal(game.players.get(idOf("Ana")).score, 1000);
    assert.equal(game.players.get(idOf("Bea")).score, 550);
    assert.equal(game.phase, "reveal", "everyone answered, so the round ends early");
    assert.deepEqual(last("player:result", "socket-Ana"), { isCorrect: true, points: 1000, rank: 1, score: 1000, streak: 1, timeout: false });
  });

  it("ignores duplicate, unknown and out-of-phase answers", (t) => {
    const { game, sent, startAndWait } = setup(t);
    assert.equal(game.submitAnswer("socket-Ana", "A"), false);
    startAndWait();
    assert.equal(game.submitAnswer("socket-Ana", "not an option"), false);
    assert.equal(game.submitAnswer("stranger", "A"), false);
    assert.equal(game.submitAnswer("socket-Ana", "B"), true);
    assert.equal(game.submitAnswer("socket-Ana", "A"), false);
    assert.deepEqual(sent("host:answerCount", "host").map((entry) => entry.payload), [{ answered: 1, total: 2 }]);
  });

  it("does not wait for disconnected players to end a question", (t) => {
    const { game, startAndWait } = setup(t);
    startAndWait();
    game.submitAnswer("socket-Ana", "A");
    assert.equal(game.phase, "answering");
    game.disconnect("socket-Bea");
    assert.equal(game.phase, "reveal");
  });

  it("calculates points linearly between the bounds", () => {
    assert.equal(calculatePoints(0, 20, CONFIG), 1000);
    assert.equal(calculatePoints(20, 20, CONFIG), 100);
    assert.equal(calculatePoints(60, 20, CONFIG), 100);
  });

  it("sanitizes player names", () => {
    assert.equal(sanitizePlayerName("  a\tb\n c ", 15), "a b c");
    assert.equal(sanitizePlayerName("x".repeat(30), 15), "x".repeat(15));
    assert.equal(sanitizePlayerName(null, 15), "");
  });
});

describe("Game: reconnection and teardown", () => {
  it("restores a player's question and selected answer on rejoin", (t) => {
    const { game, last, idOf, startAndWait } = setup(t);
    startAndWait();
    game.submitAnswer("socket-Ana", "C");
    game.disconnect("socket-Ana");
    assert.equal(game.players.get(idOf("Ana")).connected, false);

    game.join("socket-Ana-2", { pin: PIN, name: "ignored", playerId: idOf("Ana") });
    assert.equal(last("player:joined", "socket-Ana-2").name, "Ana");
    assert.equal(last("player:question", "socket-Ana-2").hasAnswered, true);
    assert.equal(last("player:question", "socket-Ana-2").selectedAnswer, "C");
  });

  it("sends the right screen for each phase on rejoin", (t) => {
    const { game, last, idOf } = setup(t, { questions: [TEXT_QUESTION] });
    game.start("host");
    game.disconnect("socket-Bea");
    game.join("b2", { pin: PIN, playerId: idOf("Bea") });
    assert.ok(last("game:startCountdown", "b2"));

    t.mock.timers.tick(5250);
    game.timeUp("host");
    game.join("b3", { pin: PIN, playerId: idOf("Bea") });
    assert.equal(last("player:result", "b3").timeout, true);

    game.next("host");
    game.join("b4", { pin: PIN, playerId: idOf("Bea") });
    assert.ok(last("game:end", "b4"));
  });

  it("purges disconnected players only for the host", (t) => {
    const { game, startAndWait } = setup(t);
    startAndWait();
    game.disconnect("socket-Bea");
    assert.equal(game.purgeDisconnected("socket-Ana"), 0);
    assert.equal(game.purgeDisconnected("host"), 1);
    assert.deepEqual([...game.players.values()].map((player) => player.name), ["Ana"]);
  });

  it("notifies players when the game closes mid-match but not after the final results", (t) => {
    const { game, sent, startAndWait } = setup(t, { questions: [TEXT_QUESTION] });
    startAndWait();
    game.close("bye");
    assert.equal(game.phase, "closed");
    assert.equal(sent("player:gameOver").length, 1);

    t.mock.timers.reset();
    const finished = setup(t, { questions: [TEXT_QUESTION] });
    finished.startAndWait();
    finished.game.timeUp("host");
    finished.game.next("host");
    finished.game.close("bye");
    assert.equal(finished.sent("player:gameOver").length, 0);
  });

  it("exposes a snapshot without answers or credentials", (t) => {
    const { game, idOf, startAndWait } = setup(t);
    startAndWait();
    game.submitAnswer("socket-Ana", "A");
    const snapshot = game.snapshot();
    const serialized = JSON.stringify(snapshot);
    assert.equal(snapshot.phase, "answering");
    assert.equal(snapshot.answered, 1);
    assert.deepEqual(snapshot.players[0], { name: "Ana", score: 1000, connected: true });
    assert.equal(serialized.includes('"A"'), false);
    assert.equal(serialized.includes("socket-"), false);
    assert.equal(serialized.includes(idOf("Ana")), false);
  });
});
