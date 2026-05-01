const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const livereload = require("livereload");
const connectLivereload = require("connect-livereload");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Livereload: watch HTML files and auto-refresh browsers
const lrServer = livereload.createServer({ exts: ["html", "css", "js"], delay: 300 });
lrServer.watch(__dirname);
app.use(connectLivereload());

// Serve static files
app.use(express.static(__dirname));

// ---------- Game state ----------
const COUNTDOWN_SECONDS = 15;
const COUNTDOWN_AUDIO = 5;
const MAX_PLAYERS = 10;
const MAX_POINTS = 1000;
const MIN_POINTS = 100;

let game = null; // { pin, host, players, questions, currentQ, phase, timer, answers }

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadQuestions() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf-8"));
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  function parseDate(filename) {
    const m = filename.match(/(\d{4})(\d{2})(\d{2})/);
    if (!m) return "";
    return `${parseInt(m[3])} ${months[parseInt(m[2]) - 1]} ${m[1]}`;
  }

  return raw.map(entry => {
    const before = entry.before || {};
    const after = entry.after || {};
    const audioBefore = !!before.audio;
    const audioFile = before.audio || after.audio;

    return {
      question: entry.question,
      options: shuffle([entry.answers.right, ...entry.answers.wrong]),
      correct: entry.answers.right,
      audioBefore,
      audioFile: audioFile ? `media/audios/${audioFile}` : null,
      afterAudioFile: after.audio ? `media/audios/${after.audio}` : null,
      afterImage: after.image ? `media/images/${after.image}` : null,
      image: before.image ? `media/images/${before.image}` : null,
      date: audioFile ? parseDate(audioFile) : "",
    };
  });
}

// ---------- Socket.IO ----------
io.on("connection", (socket) => {

  // Host creates a game
  socket.on("host:create", () => {
    if (game) {
      // Reset any existing game
      clearTimeout(game.timer);
    }
    const pin = generatePin();
    game = {
      pin,
      host: socket.id,
      players: {},   // { socketId: { name, score, streak } }
      questions: loadQuestions(),
      currentQ: -1,
      phase: "lobby", // lobby | question | reveal | end
      timer: null,
      answers: {},
      questionStartTime: 0,
    };
    socket.join(`game-${pin}`);
    socket.emit("host:created", { pin });
  });

  // Player joins
  socket.on("player:join", ({ pin, name }) => {
    if (!game || game.pin !== pin) {
      return socket.emit("player:error", "PIN incorrecto");
    }
    if (game.phase !== "lobby") {
      return socket.emit("player:error", "La partida ya ha comenzado");
    }
    if (Object.keys(game.players).length >= MAX_PLAYERS) {
      return socket.emit("player:error", "Sala llena (máx 10)");
    }
    // Check duplicate name
    const names = Object.values(game.players).map(p => p.name.toLowerCase());
    if (names.includes(name.toLowerCase())) {
      return socket.emit("player:error", "Ese nombre ya está en uso");
    }

    game.players[socket.id] = { name, score: 0, streak: 0 };
    socket.join(`game-${pin}`);
    socket.emit("player:joined", { name });

    // Notify host
    io.to(game.host).emit("host:playerList", getPlayerList());
  });

  // Host starts
  socket.on("host:start", () => {
    if (!game || socket.id !== game.host) return;
    if (Object.keys(game.players).length === 0) return;
    nextQuestion();
  });

  // Host signals audio is done, start countdown timer
  socket.on("host:answersOpen", () => {
    if (!game || socket.id !== game.host) return;
    if (game.phase !== "question") return;
    game.timer = setTimeout(() => { endQuestion(); }, COUNTDOWN_AUDIO * 1000);
  });

  // Host signals countdown reached 0
  socket.on("host:timeUp", () => {
    if (!game || socket.id !== game.host) return;
    if (game.phase !== "question") return;
    clearTimeout(game.timer);
    endQuestion();
  });

  // Host advances to next question
  socket.on("host:next", () => {
    if (!game || socket.id !== game.host) return;
    if (game.phase === "reveal") {
      nextQuestion();
    }
  });

  // Player answers
  socket.on("player:answer", ({ answer }) => {
    if (!game || game.phase !== "question") return;
    if (!game.players[socket.id]) return;
    if (game.answers[socket.id] !== undefined) return; // already answered

    const q = game.questions[game.currentQ];
    const elapsed = (Date.now() - game.questionStartTime) / 1000;
    const isCorrect = answer === q.correct;

    let points = 0;
    if (isCorrect) {
      // Linear interpolation: faster = more points
      const timeFraction = Math.max(0, 1 - elapsed / COUNTDOWN_SECONDS);
      points = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeFraction);
      game.players[socket.id].score += points;
      game.players[socket.id].streak++;
    } else {
      game.players[socket.id].streak = 0;
    }

    game.answers[socket.id] = { answer, isCorrect, points, elapsed };

    socket.emit("player:result", { isCorrect, points, score: game.players[socket.id].score, streak: game.players[socket.id].streak });

    // Notify host of answer count
    const totalPlayers = Object.keys(game.players).length;
    const answeredCount = Object.keys(game.answers).length;
    io.to(game.host).emit("host:answerCount", { answered: answeredCount, total: totalPlayers });

    // If all answered, end question early
    if (answeredCount >= totalPlayers) {
      clearTimeout(game.timer);
      endQuestion();
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (!game) return;
    if (socket.id === game.host) {
      // Host left, end game
      io.to(`game-${game.pin}`).emit("player:gameOver", "El host se ha desconectado");
      clearTimeout(game.timer);
      game = null;
    } else if (game.players[socket.id]) {
      delete game.players[socket.id];
      if (game.host) {
        io.to(game.host).emit("host:playerList", getPlayerList());
      }
    }
  });
});

function getPlayerList() {
  if (!game) return [];
  return Object.values(game.players).map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function nextQuestion() {
  game.currentQ++;
  if (game.currentQ >= game.questions.length) {
    game.phase = "end";
    const leaderboard = getPlayerList();
    io.to(`game-${game.pin}`).emit("game:end", { leaderboard });
    return;
  }

  const q = game.questions[game.currentQ];
  game.phase = "question";
  game.answers = {};
  game.questionStartTime = Date.now();

  // Send question to host (full info)
  io.to(game.host).emit("host:question", {
    index: game.currentQ,
    total: game.questions.length,
    question: q.question,
    options: q.options,
    audioBefore: q.audioBefore,
    audioSrc: q.audioFile || null,
    image: q.image || null,
    countdown: COUNTDOWN_SECONDS,
  });

  // Players always get options immediately
  io.to(`game-${game.pin}`).emit("player:question", {
    index: game.currentQ,
    total: game.questions.length,
    options: q.options,
    countdown: q.audioBefore ? null : COUNTDOWN_SECONDS,
  });

  if (!q.audioBefore) {
    game.timer = setTimeout(() => { endQuestion(); }, COUNTDOWN_SECONDS * 1000);
  }
}

function endQuestion() {
  if (!game || game.phase !== "question") return;
  game.phase = "reveal";

  const q = game.questions[game.currentQ];
  const leaderboard = getPlayerList();

  // Compute per-option answer counts
  const optionCounts = {};
  q.options.forEach(o => optionCounts[o] = 0);
  Object.values(game.answers).forEach(a => {
    if (optionCounts[a.answer] !== undefined) optionCounts[a.answer]++;
  });

  io.to(game.host).emit("host:reveal", {
    correct: q.correct,
    optionCounts,
    leaderboard,
    date: q.date || null,
    afterAudio: q.afterAudioFile || null,
    afterImage: q.afterImage || null,
  });

  // Tell players who didn't answer yet
  Object.keys(game.players).forEach(sid => {
    if (!game.answers[sid]) {
      io.to(sid).emit("player:result", { isCorrect: false, points: 0, score: game.players[sid].score, streak: 0, timeout: true });
      game.players[sid].streak = 0;
    }
  });
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
  // Get local IP for display
  const nets = require("os").networkInterfaces();
  let localIp = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }
  console.log(`\n  Recuerdoot server running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIp}:${PORT}\n`);
});
