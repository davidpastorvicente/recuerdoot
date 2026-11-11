"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { randomInt } = require("node:crypto");
const express = require("express");
const QRCode = require("qrcode");
const { Server } = require("socket.io");
const CONFIG = require("../assets/js/game-config.js");
const { Game } = require("./game");
const { loadQuestions } = require("./questions");
const { resolveJoinBaseUrl } = require("./network");

const ROOT_DIR = path.resolve(__dirname, "..");
const PIN_MIN = 10 ** (CONFIG.PIN_LENGTH - 1);
const PIN_MAX = 10 ** CONFIG.PIN_LENGTH;

function generatePin() {
  return String(randomInt(PIN_MIN, PIN_MAX));
}

function attachLiveReload(app, rootDir, logger) {
  try {
    const livereload = require("livereload");
    const connectLivereload = require("connect-livereload");
    const liveReloadServer = livereload.createServer({ exts: ["html", "css", "js"], delay: 300 });
    liveReloadServer.watch([path.join(rootDir, "assets"), path.join(rootDir, "index.html"), path.join(rootDir, "player.html")]);
    app.use(connectLivereload());
    return liveReloadServer;
  } catch (error) {
    logger.warn(`Live reload disabled: ${error.message}`);
    return null;
  }
}

/**
 * Builds the HTTP + Socket.IO server without listening, so tests can start it on a random port.
 * There is at most one active game at a time.
 */
function createApp({
  rootDir = ROOT_DIR,
  questionsPath = path.join(rootDir, "questions.json"),
  publicBaseUrl = "",
  liveReload = false,
  logger = console,
} = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const liveReloadServer = liveReload ? attachLiveReload(app, rootDir, logger) : null;
  let game = null;

  const emit = (target, event, payload) => io.to(target).emit(event, payload);

  app.disable("x-powered-by");
  app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(rootDir, "index.html")));
  app.get("/player.html", (req, res) => res.sendFile(path.join(rootDir, "player.html")));
  app.get("/questions.json", (req, res) => {
    if (!fs.existsSync(questionsPath)) {
      res.status(404).json({ error: "questions.json not found. Create it following the format described in README.md." });
      return;
    }
    res.sendFile(path.resolve(questionsPath));
  });
  app.use("/assets", express.static(path.join(rootDir, "assets")));
  app.get("/api/state", (req, res) => res.json(game ? game.snapshot() : { phase: "idle" }));

  function closeGame(reason) {
    game?.close(reason);
    game = null;
  }

  async function createGame(socket) {
    let questions;
    try {
      questions = loadQuestions(questionsPath);
    } catch (error) {
      logger.error(error.message);
      socket.emit("host:error", "No se han podido cargar las preguntas. Revisa questions.json.");
      return;
    }

    closeGame("El host ha creado una nueva partida");
    const pin = generatePin();
    const createdGame = new Game({ pin, hostId: socket.id, questions, emit });
    game = createdGame;
    socket.join(createdGame.room);

    const joinBaseUrl = resolveJoinBaseUrl({ publicBaseUrl, port: server.address().port });
    const joinUrl = `${joinBaseUrl}/player.html?pin=${pin}`;
    const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 0, color: { dark: "#0A0A0A", light: "#FFFFFF" } });

    if (game === createdGame) {
      socket.emit("host:created", { pin, joinBaseUrl, joinUrl, qrSvg });
    }
  }

  io.on("connection", (socket) => {
    const on = (event, handler) => {
      socket.on(event, (payload) => {
        Promise.resolve()
          .then(() => handler(payload ?? {}))
          .catch((error) => logger.error(`Socket handler "${event}" failed:`, error));
      });
    };
    const isHost = () => Boolean(game?.isHost(socket.id));

    on("host:create", () => createGame(socket));
    on("host:start", () => game?.start(socket.id));
    on("host:answersOpen", () => game?.openAnswers(socket.id));
    on("host:timeUp", () => game?.timeUp(socket.id));
    on("host:next", () => game?.next(socket.id));
    on("host:purgeDisconnected", () => game?.purgeDisconnected(socket.id));
    on("host:end", () => {
      if (isHost()) closeGame("El host ha terminado la partida");
    });

    on("player:join", (payload) => {
      if (!game) {
        socket.emit("player:error", "PIN incorrecto");
        return;
      }
      if (game.join(socket.id, payload)) {
        socket.join(game.room);
      }
    });
    on("player:answer", (payload) => game?.submitAnswer(socket.id, payload.answer));

    on("disconnect", () => {
      if (isHost()) {
        closeGame("El host se ha desconectado");
        return;
      }
      game?.disconnect(socket.id);
    });
  });

  return {
    app,
    io,
    server,
    getGame: () => game,
    close() {
      closeGame("El servidor se ha detenido");
      liveReloadServer?.close();
      io.close();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { createApp, generatePin };
