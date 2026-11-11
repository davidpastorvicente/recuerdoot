const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createApp } = require("../lib/app");

const QUESTIONS = path.join(__dirname, "fixtures", "questions.json");
const silentLogger = { error() {}, warn() {}, log() {} };

describe("dev server", () => {
  let instance;
  let baseUrl;

  before(async () => {
    instance = createApp({ questionsPath: QUESTIONS, publicBaseUrl: "http://quiz.test/", logger: silentLogger });
    await new Promise((resolve) => instance.server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${instance.server.address().port}`;
  });

  after(() => instance.close());

  it("serves the pages, assets, vendor scripts and questions but not server code", async () => {
    const publicRoutes = [
      "/",
      "/player.html",
      "/assets/css/main.css",
      "/assets/js/match-host.js",
      "/assets/vendor/peerjs.min.js",
      "/assets/vendor/qrcode.js",
      "/assets/vendor/fflate.js",
      "/assets/templates/questions.json",
      "/questions.json",
    ];
    for (const route of publicRoutes) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
    }
    for (const route of ["/server.js", "/lib/app.js", "/package.json", "/assets/vendor/unknown.js", "/node_modules/peerjs/package.json"]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 404, route);
    }
    assert.equal((await fetch(`${baseUrl}/`)).headers.get("x-powered-by"), null);
  });

  it("reports the public join address and whether it has questions", async () => {
    assert.deepEqual(await (await fetch(`${baseUrl}/config.json`)).json(), { joinBaseUrl: "http://quiz.test", serverQuestions: true });
  });

  it("answers 404 for questions.json when there is none", async () => {
    const empty = createApp({ questionsPath: path.join(__dirname, "missing.json"), logger: silentLogger });
    await new Promise((resolve) => empty.server.listen(0, "127.0.0.1", resolve));
    const emptyUrl = `http://127.0.0.1:${empty.server.address().port}`;
    assert.equal((await fetch(`${emptyUrl}/questions.json`)).status, 404);
    assert.equal((await (await fetch(`${emptyUrl}/config.json`)).json()).serverQuestions, false);
    await empty.close();
  });
});
