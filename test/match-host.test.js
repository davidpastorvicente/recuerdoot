const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const CONFIG = require("../assets/js/game-config.js");
const { loadQuestions } = require("../lib/questions");
const { createMatchHost, generatePin, peerIdForPin } = require("../assets/js/match-host.js");

const QUESTIONS = loadQuestions(path.join(__dirname, "fixtures", "questions.json"), { shuffleOptions: (options) => options });
const silentLogger = { error() {}, warn() {}, log() {} };

/** In-memory stand-in for PeerJS: `listen` registers ids, `connect` opens a link to one. */
function createFakeNetwork({ takenIds = [] } = {}) {
  const hosts = new Map();
  let counter = 0;

  async function listen(peerId, onConnection) {
    if (takenIds.includes(peerId) || hosts.has(peerId)) {
      throw Object.assign(new Error(`${peerId} is taken`), { type: "unavailable-id" });
    }
    hosts.set(peerId, onConnection);
    return { close: () => hosts.delete(peerId) };
  }

  function connect(peerId) {
    const onConnection = hosts.get(peerId);
    assert.ok(onConnection, `nobody listens on ${peerId}`);
    const messageHandlers = [];
    const closeHandlers = [];
    const player = { inbox: [], closed: false };
    const close = () => {
      if (player.closed) return;
      player.closed = true;
      closeHandlers.forEach((handler) => handler());
    };

    counter += 1;
    onConnection({
      id: `connection-${counter}`,
      send: (event, payload) => player.inbox.push({ event, payload }),
      close,
      onMessage: (handler) => messageHandlers.push(handler),
      onClose: (handler) => closeHandlers.push(handler),
    });

    player.send = (event, payload) => messageHandlers.forEach((handler) => handler(event, payload));
    player.drop = close;
    player.last = (event) => player.inbox.filter((entry) => entry.event === event).at(-1)?.payload;
    return player;
  }

  return { hosts, listen, connect };
}

async function setup(t, options = {}) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  const network = createFakeNetwork(options);
  const hostEvents = [];
  const match = await createMatchHost({
    questions: QUESTIONS,
    listen: network.listen,
    onEvent: (event, payload) => hostEvents.push({ event, payload }),
    logger: silentLogger,
    ...options.matchOptions,
  });
  const lastHost = (event) => hostEvents.filter((entry) => entry.event === event).at(-1)?.payload;
  return { network, match, hostEvents, lastHost };
}

describe("match-host", () => {
  it("generates PINs of the configured length", () => {
    for (let index = 0; index < 200; index++) {
      assert.match(generatePin(), new RegExp(String.raw`^[1-9]\d{${CONFIG.PIN_LENGTH - 1}}$`));
    }
    assert.equal(peerIdForPin("123456"), `${CONFIG.PEER_ID_PREFIX}123456`);
  });

  it("plays a full match from lobby to final results", async (t) => {
    const { network, match, lastHost } = await setup(t);
    assert.match(match.pin, /^\d{6}$/);
    assert.ok(network.hosts.has(match.peerId));

    const ana = network.connect(match.peerId);
    ana.send("player:join", { pin: match.pin, name: "Ana" });
    assert.equal(ana.last("player:joined").name, "Ana");
    assert.deepEqual(lastHost("host:playerList").map((player) => player.name), ["Ana"]);

    assert.equal(match.command("host:start"), true);
    assert.equal(ana.last("game:startCountdown").seconds, CONFIG.COUNTDOWN_GAME_START_SECONDS);
    assert.ok(lastHost("game:startCountdown"), "the host is part of the room");
    t.mock.timers.tick(250 + CONFIG.COUNTDOWN_GAME_START_SECONDS * 1000);
    assert.equal(lastHost("host:question").index, 0);
    assert.equal(ana.last("player:question").answersOpen, true);
    assert.equal("correct" in ana.last("player:question"), false, "phones never receive the answer");

    ana.send("player:answer", { answer: "Roja" });
    assert.equal(lastHost("host:reveal").correct, "Roja");
    assert.equal(ana.last("player:result").isCorrect, true);
    assert.equal(match.snapshot().phase, "reveal");

    match.command("host:next");
    assert.equal(lastHost("host:question").audioBefore, true);
    match.command("host:answersOpen");
    assert.ok(ana.last("player:answersOpen"));
    match.command("host:timeUp");
    assert.equal(lastHost("host:reveal").date, "2019-07-04");

    match.command("host:next");
    assert.equal(lastHost("host:question").options.length, 6);
    match.command("host:timeUp");
    match.command("host:next");
    assert.equal(ana.last("game:end").leaderboard[0].name, "Ana");
    assert.equal(match.snapshot().phase, "end");
  });

  it("only accepts player events from phones and survives malformed payloads", async (t) => {
    const { network, match } = await setup(t);
    const stranger = network.connect(match.peerId);
    stranger.send("host:start");
    stranger.send("player:join");
    assert.deepEqual(stranger.last("player:error"), { key: "join.error.wrongPin" });
    stranger.send("player:join", "nope");
    stranger.send("player:answer", null);
    assert.equal(match.snapshot().phase, "lobby");
    assert.equal(match.command("host:unknown"), false);
  });

  it("marks players as disconnected when their link drops and lets them rejoin", async (t) => {
    const { network, match, lastHost } = await setup(t);
    const ana = network.connect(match.peerId);
    ana.send("player:join", { pin: match.pin, name: "Ana" });
    const bea = network.connect(match.peerId);
    bea.send("player:join", { pin: match.pin, name: "Bea" });
    match.command("host:start");
    t.mock.timers.tick(250 + CONFIG.COUNTDOWN_GAME_START_SECONDS * 1000);

    const { playerId } = ana.last("player:joined");
    ana.drop();
    assert.equal(lastHost("host:playerList").find((player) => player.name === "Ana").connected, false);

    const anaAgain = network.connect(match.peerId);
    anaAgain.send("player:join", { pin: match.pin, playerId });
    assert.equal(anaAgain.last("player:joined").name, "Ana");
    assert.equal(anaAgain.last("player:question").index, 0);
  });

  it("tries another PIN when one is already taken", async (t) => {
    const pins = ["111111", "222222"];
    const { match } = await setup(t, {
      takenIds: [peerIdForPin("111111")],
      matchOptions: { createPin: () => pins.shift() },
    });
    assert.equal(match.pin, "222222");
  });

  it("gives up on network errors", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const failure = Object.assign(new Error("offline"), { type: "network" });
    await assert.rejects(createMatchHost({ questions: QUESTIONS, listen: async () => { throw failure; }, onEvent() {} }), failure);
  });

  it("closes the match for everyone and stops listening", async (t) => {
    const { network, match } = await setup(t);
    const ana = network.connect(match.peerId);
    ana.send("player:join", { pin: match.pin, name: "Ana" });

    const closing = match.close("gameOver.hostEnded");
    assert.deepEqual(ana.last("player:gameOver"), { key: "gameOver.hostEnded" });
    assert.equal(match.command("host:start"), false);
    t.mock.timers.tick(300);
    await closing;
    assert.equal(ana.closed, true);
    assert.equal(network.hosts.has(match.peerId), false);
    assert.equal(match.isClosed, true);
  });
});
