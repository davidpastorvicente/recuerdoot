const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { io: connect } = require("socket.io-client");
const { createApp } = require("../lib/app");

const QUESTIONS = path.join(__dirname, "fixtures", "questions.json");
const silentLogger = { error() {}, warn() {}, log() {} };

function nextEvent(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("server integration", () => {
  let instance;
  let baseUrl;
  const sockets = [];

  const open = async () => {
    const socket = connect(baseUrl, { transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    await nextEvent(socket, "connect");
    return socket;
  };

  before(async () => {
    instance = createApp({ questionsPath: QUESTIONS, publicBaseUrl: "http://quiz.test", logger: silentLogger });
    await new Promise((resolve) => instance.server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${instance.server.address().port}`;
  });

  after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await instance.close();
  });

  it("serves the pages, assets and questions but not server code", async () => {
    for (const route of ["/", "/player.html", "/assets/css/main.css", "/assets/js/state-machines.js", "/questions.json"]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
    }
    for (const route of ["/server.js", "/lib/game.js", "/package.json"]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 404, route);
    }
    assert.equal((await fetch(`${baseUrl}/`)).headers.get("x-powered-by"), null);
  });

  it("reports an idle state before any game exists", async () => {
    assert.deepEqual(await (await fetch(`${baseUrl}/api/state`)).json(), { phase: "idle" });
  });

  it("plays a full match from lobby to final results", async () => {
    const host = await open();
    host.emit("host:create");
    const created = await nextEvent(host, "host:created");
    assert.match(created.pin, /^\d{6}$/);
    assert.equal(created.joinUrl, `http://quiz.test/player.html?pin=${created.pin}`);
    assert.match(created.qrSvg, /^<svg/);

    const ana = await open();
    const hostList = nextEvent(host, "host:playerList");
    ana.emit("player:join", { pin: created.pin, name: "Ana" });
    const joined = await nextEvent(ana, "player:joined");
    assert.equal(joined.name, "Ana");
    assert.deepEqual((await hostList).map((player) => player.name), ["Ana"]);

    const countdown = nextEvent(ana, "game:startCountdown");
    const firstQuestion = nextEvent(host, "host:question");
    const firstPlayerQuestion = nextEvent(ana, "player:question");
    host.emit("host:start");
    assert.equal((await countdown).seconds, 5);
    const question = await firstQuestion;
    assert.equal(question.index, 0);
    assert.equal((await firstPlayerQuestion).answersOpen, true);

    const reveal = nextEvent(host, "host:reveal");
    const result = nextEvent(ana, "player:result");
    ana.emit("player:answer", { answer: "Roja" });
    assert.equal((await reveal).correct, "Roja");
    const firstResult = await result;
    assert.equal(firstResult.isCorrect, true);
    assert.ok(firstResult.points > 900);

    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    assert.equal(state.phase, "reveal");
    assert.equal(state.players[0].name, "Ana");

    const audioQuestion = nextEvent(host, "host:question");
    host.emit("host:next");
    assert.equal((await audioQuestion).audioBefore, true);
    const answersOpen = nextEvent(ana, "player:answersOpen");
    host.emit("host:answersOpen");
    await answersOpen;
    const secondReveal = nextEvent(host, "host:reveal");
    host.emit("host:timeUp");
    assert.equal((await secondReveal).date, "4 julio 2019");

    const lastQuestion = nextEvent(host, "host:question");
    host.emit("host:next");
    assert.equal((await lastQuestion).options.length, 6);
    const lastReveal = nextEvent(host, "host:reveal");
    host.emit("host:timeUp");
    await lastReveal;

    const end = nextEvent(ana, "game:end");
    host.emit("host:next");
    assert.equal((await end).leaderboard[0].name, "Ana");
  });

  it("ends the match for players when the host leaves", async () => {
    const host = await open();
    host.emit("host:create");
    const { pin } = await nextEvent(host, "host:created");
    const bea = await open();
    bea.emit("player:join", { pin, name: "Bea" });
    await nextEvent(bea, "player:joined");

    const gameOver = nextEvent(bea, "player:gameOver");
    host.emit("host:end");
    assert.equal(await gameOver, "El host ha terminado la partida");

    bea.emit("player:join", { pin, name: "Bea" });
    assert.equal(await nextEvent(bea, "player:error"), "PIN incorrecto");
  });

  it("survives malformed socket payloads", async () => {
    const stranger = await open();
    stranger.emit("player:join");
    assert.equal(await nextEvent(stranger, "player:error"), "PIN incorrecto");
    stranger.emit("player:answer", null);
    stranger.emit("host:start", "nope");
    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 200);
  });
});
