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
const COUNTDOWN_QUESTION_SECONDS = 30;
const COUNTDOWN_GAME_START_SECONDS = 5;
const COUNTDOWN_AUDIO_BEFORE_SECONDS = 3;
const COUNTDOWN_AUDIO_AFTER_SECONDS = 5;
const MAX_PLAYERS = 10;
const MAX_POINTS = 1000;
const MIN_POINTS = 100;
const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

let game = null; // { pin, host, players, questions, currentQ, phase, timer, answers }

function emitPlayerList() {
  if (game?.host) {
    io.to(game.host).emit("host:playerList", getPlayerList());
  }
}

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

function parseDate(filename) {
  const match = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return "";
  return `${parseInt(match[3])} ${months[parseInt(match[2]) - 1]} ${match[1]}`;
}

function getOptionCounts(options, answers) {
  const optionCounts = {};
  options.forEach((option) => {
    optionCounts[option] = 0;
  });
  Object.values(answers).forEach((answer) => {
    if (optionCounts[answer.answer] !== undefined) optionCounts[answer.answer]++;
  });
  return optionCounts;
}

function emitPlayerResult(socketId, result) {
  io.to(socketId).emit("player:result", result);
}

function loadQuestions() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf-8"));

  return raw.map((entry) => {
    const before = entry.before || {};
    const after = entry.after || {};
    const audioBefore = !!before.audio;
    const audioFile = before.audio || after.audio;

    return {
      question: entry.question,
      options: shuffle([entry.answers.right, ...entry.answers.wrong]),
      correct: entry.answers.right,
      audioBefore,
      audioFile: audioFile ? `assets/audios/${audioFile}` : null,
      afterAudio: after.audio ? `assets/audios/${after.audio}` : null,
      afterImage: after.image ? `assets/images/${after.image}` : null,
      afterMusic: after.music ? `assets/music/${after.music}` : null,
      afterVideo: after.video ? `assets/videos/${after.video}` : null,
      image: before.image ? `assets/images/${before.image}` : null,
      music: before.music ? `assets/music/${before.music}` : null,
      video: before.video ? `assets/videos/${before.video}` : null,
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
      phase: "lobby", // lobby | starting | question | reveal | end
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
    const names = Object.values(game.players).map((player) => player.name.toLowerCase());
    if (names.includes(name.toLowerCase())) {
      return socket.emit("player:error", "Ese nombre ya está en uso");
    }

    game.players[socket.id] = { name, score: 0, streak: 0 };
    socket.join(`game-${pin}`);
    socket.emit("player:joined", { name });

    // Notify host
    emitPlayerList();
  });

  // Host starts
  socket.on("host:start", () => {
    if (!game || socket.id !== game.host) return;
    if (game.phase !== "lobby") return;
    if (Object.keys(game.players).length === 0) return;

    game.phase = "starting";
    const startsAt = Date.now() + 250;
    io.to(`game-${game.pin}`).emit("game:startCountdown", { seconds: COUNTDOWN_GAME_START_SECONDS, startsAt });
    game.timer = setTimeout(() => {
      nextQuestion();
    }, (startsAt - Date.now()) + (COUNTDOWN_GAME_START_SECONDS * 1000));
  });

  // Host signals audio is done, start countdown timer
  socket.on("host:answersOpen", () => {
    if (!game || socket.id !== game.host) return;
    if (game.phase !== "question") return;
    game.timer = setTimeout(() => { endQuestion(); }, COUNTDOWN_AUDIO_AFTER_SECONDS * 1000);
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

    const question = game.questions[game.currentQ];
    const elapsed = (Date.now() - game.questionStartTime) / 1000;
    const isCorrect = answer === question.correct;

    let points = 0;
    if (isCorrect) {
      // Linear interpolation: faster = more points
      const timeFraction = Math.max(0, 1 - elapsed / COUNTDOWN_QUESTION_SECONDS);
      points = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeFraction);
      game.players[socket.id].score += points;
      game.players[socket.id].streak++;
    } else {
      game.players[socket.id].streak = 0;
    }

    game.answers[socket.id] = { answer, isCorrect, points, elapsed };

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
      emitPlayerList();
    }
  });
});

function getPlayerList() {
  if (!game) return [];
  return Object.values(game.players).map((player) => ({ name: player.name, score: player.score }))
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

  const question = game.questions[game.currentQ];
  game.phase = "question";
  game.answers = {};
  game.questionStartTime = Date.now();

  // Send question to host (full info)
  io.to(game.host).emit("host:question", {
    index: game.currentQ,
    total: game.questions.length,
    question: question.question,
    options: question.options,
    audioBefore: question.audioBefore,
    audioSrc: question.audioFile || null,
    image: question.image || null,
    music: question.music || null,
    video: question.video || null,
    countdownBefore: question.audioBefore ? COUNTDOWN_AUDIO_BEFORE_SECONDS : null,
    countdownAfter: question.audioBefore ? COUNTDOWN_AUDIO_AFTER_SECONDS : COUNTDOWN_QUESTION_SECONDS,
  });

  // Players always get options immediately
  io.to(`game-${game.pin}`).emit("player:question", {
    index: game.currentQ,
    total: game.questions.length,
    options: question.options,
    countdown: question.audioBefore ? null : COUNTDOWN_QUESTION_SECONDS,
  });

  if (!question.audioBefore) {
    game.timer = setTimeout(() => { endQuestion(); }, COUNTDOWN_QUESTION_SECONDS * 1000);
  }
}

function endQuestion() {
  if (!game || game.phase !== "question") return;
  game.phase = "reveal";

  const question = game.questions[game.currentQ];
  const leaderboard = getPlayerList();
  const optionCounts = getOptionCounts(question.options, game.answers);

  io.to(game.host).emit("host:reveal", {
    correct: question.correct,
    optionCounts,
    leaderboard,
    date: question.date || null,
    afterAudio: question.afterAudio || null,
    afterImage: question.afterImage || null,
    afterMusic: question.afterMusic || null,
    afterVideo: question.afterVideo || null,
  });

  // Tell players who didn't answer yet
  Object.keys(game.players).forEach((socketId) => {
    const answer = game.answers[socketId];
    const player = game.players[socketId];
    if (!answer) {
      player.streak = 0;
      emitPlayerResult(socketId, {
        isCorrect: false,
        points: 0,
        score: player.score,
        streak: 0,
        timeout: true,
      });
      return;
    }

    emitPlayerResult(socketId, {
      isCorrect: answer.isCorrect,
      points: answer.points,
      score: player.score,
      streak: player.streak,
      timeout: false,
    });
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
