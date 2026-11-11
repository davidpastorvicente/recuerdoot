"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { vendorPath } = require("./vendor");
const { resolveJoinBaseUrl } = require("./network");

const ROOT_DIR = path.resolve(__dirname, "..");

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
 * Local development server. The game itself runs in the host browser (see assets/js/match-host.js),
 * so this only serves the same static files GitHub Pages does, plus two development extras:
 * a local questions.json with media under assets/, and the LAN or tunnel address for the join QR.
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
  const liveReloadServer = liveReload ? attachLiveReload(app, rootDir, logger) : null;

  app.disable("x-powered-by");
  app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(rootDir, "index.html")));
  app.get("/player.html", (req, res) => res.sendFile(path.join(rootDir, "player.html")));
  app.get("/quiz-guide.md", (req, res) => res.type("text/markdown; charset=utf-8").sendFile(path.join(rootDir, "docs", "quiz-guide.md")));
  app.get("/questions.json", (req, res) => {
    if (!fs.existsSync(questionsPath)) {
      res.status(404).json({ error: "questions.json not found. Load a quiz from the start screen or create one (see README.md)." });
      return;
    }
    res.sendFile(path.resolve(questionsPath));
  });
  app.get("/assets/vendor/:file", (req, res) => {
    const file = vendorPath(req.params.file, rootDir);
    if (!file) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(file);
  });
  app.use("/assets", express.static(path.join(rootDir, "assets")));
  // GitHub Pages gets a static config.json from `npm run build`.
  app.get("/config.json", (req, res) => {
    res.json({
      joinBaseUrl: resolveJoinBaseUrl({ publicBaseUrl, port: server.address().port }),
      serverQuestions: fs.existsSync(questionsPath),
    });
  });

  return {
    app,
    server,
    close() {
      liveReloadServer?.close();
      server.closeAllConnections?.();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { createApp };
