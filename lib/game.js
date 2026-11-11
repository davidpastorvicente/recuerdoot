"use strict";

const { randomUUID } = require("node:crypto");
const DEFAULT_CONFIG = require("../assets/js/game-config.js");
const { MACHINES, createStateMachine } = require("../assets/js/state-machines.js");

const START_DELAY_MS = 250;
const QUESTION_PHASES = new Set(["listening", "answering"]);

function calculatePoints(elapsedSeconds, windowSeconds, { MAX_POINTS, MIN_POINTS }) {
  const timeFraction = Math.max(0, 1 - elapsedSeconds / windowSeconds);
  return Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeFraction);
}

function sanitizePlayerName(name, maxLength) {
  if (typeof name !== "string") return "";
  return name.replaceAll(/\s+/g, " ").replaceAll(/\p{Cc}/gu, "").trim().slice(0, maxLength);
}

/**
 * One multiplayer match. Socket.IO stays outside: every outgoing message goes through
 * `emit(target, event, payload)`, where target is a socket id or the game room.
 * The phase is an explicit state machine (see MACHINES.game).
 */
class Game {
  #machine = createStateMachine(MACHINES.game, {
    onInvalid: ({ from, to }) => {
      throw new Error(`Invalid game transition ${from} -> ${to}`);
    },
  });
  #timer = null;

  constructor({ pin, hostId, questions, emit, config = DEFAULT_CONFIG }) {
    this.pin = pin;
    this.hostId = hostId;
    this.room = `game-${pin}`;
    this.questions = questions;
    this.emit = emit;
    this.config = config;
    this.players = new Map();
    this.answers = new Map();
    this.questionIndex = -1;
    this.questionStartedAt = 0;
    this.startsAt = null;
  }

  get phase() {
    return this.#machine.state;
  }

  get currentQuestion() {
    return this.questions[this.questionIndex] ?? null;
  }

  get isQuestionPhase() {
    return QUESTION_PHASES.has(this.phase);
  }

  isHost(socketId) {
    return socketId === this.hostId;
  }

  // ---------- Player lifecycle ----------

  join(socketId, { pin, name, playerId } = {}) {
    if (String(pin ?? "").trim() !== this.pin) {
      return this.#rejectJoin(socketId, "PIN incorrecto");
    }

    const existingPlayer = typeof playerId === "string" ? this.players.get(playerId) : undefined;
    if (existingPlayer) {
      return this.#rejoin(socketId, existingPlayer);
    }

    if (this.phase !== "lobby") {
      return this.#rejectJoin(socketId, "La partida ya ha comenzado");
    }
    if (this.#connectedPlayers().length >= this.config.MAX_PLAYERS) {
      return this.#rejectJoin(socketId, `Sala llena (máx ${this.config.MAX_PLAYERS})`);
    }

    const cleanName = sanitizePlayerName(name, this.config.PLAYER_NAME_MAX_LENGTH);
    if (!cleanName) {
      return this.#rejectJoin(socketId, "Introduce tu nombre");
    }
    if (this.#isNameTaken(cleanName)) {
      return this.#rejectJoin(socketId, "Ese nombre ya está en uso");
    }

    const player = { playerId: randomUUID(), name: cleanName, score: 0, streak: 0, socketId, connected: true };
    this.players.set(player.playerId, player);
    this.emit(socketId, "player:joined", { name: player.name, pin: this.pin, playerId: player.playerId });
    this.#emitPlayerList();
    return true;
  }

  disconnect(socketId) {
    const player = this.#playerBySocket(socketId);
    if (!player) return;

    if (this.phase === "lobby") {
      this.#removePlayer(player.playerId);
      return;
    }

    player.connected = false;
    player.socketId = null;
    this.#emitPlayerList();
    this.#emitAnswerCount();
    this.#endQuestionIfEveryoneAnswered();
  }

  purgeDisconnected(socketId) {
    if (!this.isHost(socketId)) return 0;

    const disconnected = [...this.players.values()].filter((player) => !player.connected);
    disconnected.forEach((player) => this.#removePlayer(player.playerId));
    return disconnected.length;
  }

  // ---------- Host commands ----------

  start(socketId) {
    if (!this.isHost(socketId) || this.phase !== "lobby" || this.players.size === 0) {
      return false;
    }

    this.#machine.transition("starting");
    const seconds = this.config.COUNTDOWN_GAME_START_SECONDS;
    this.startsAt = Date.now() + START_DELAY_MS;
    this.emit(this.room, "game:startCountdown", { seconds, startsAt: this.startsAt });
    this.#schedule(() => this.#advance(), START_DELAY_MS + seconds * 1000);
    return true;
  }

  openAnswers(socketId) {
    if (!this.isHost(socketId) || this.phase !== "listening") return false;

    this.#machine.transition("answering");
    this.emit(this.room, "player:answersOpen", { index: this.questionIndex });
    this.#schedule(() => this.#endQuestion(), this.config.COUNTDOWN_AUDIO_AFTER_SECONDS * 1000);
    return true;
  }

  timeUp(socketId) {
    if (!this.isHost(socketId) || !this.isQuestionPhase) return false;
    this.#endQuestion();
    return true;
  }

  next(socketId) {
    if (!this.isHost(socketId) || this.phase !== "reveal") return false;
    this.#advance();
    return true;
  }

  /** Ends the match for everyone. Players who already saw the final results keep that screen. */
  close(reason) {
    this.#clearTimer();
    if (!this.#machine.is("end", "closed")) {
      this.emit(this.room, "player:gameOver", reason);
    }
    this.#machine.transition("closed");
  }

  // ---------- Answers ----------

  submitAnswer(socketId, answer) {
    if (!this.isQuestionPhase) return false;

    const player = this.#playerBySocket(socketId);
    const question = this.currentQuestion;
    if (!player || this.answers.has(player.playerId) || !question.options.includes(answer)) return false;

    const elapsed = (Date.now() - this.questionStartedAt) / 1000;
    const isCorrect = answer === question.correct;
    const points = isCorrect ? calculatePoints(elapsed, this.config.COUNTDOWN_QUESTION_SECONDS, this.config) : 0;

    if (isCorrect) {
      player.score += points;
      player.streak += 1;
    } else {
      player.streak = 0;
    }

    this.answers.set(player.playerId, { answer, isCorrect, points, elapsed });
    this.#emitAnswerCount();
    this.#endQuestionIfEveryoneAnswered();
    return true;
  }

  // ---------- Read models ----------

  leaderboard({ includeDisconnected = true } = {}) {
    return [...this.players.values()]
      .filter((player) => includeDisconnected || player.connected)
      .map(({ playerId, name, score, connected }) => ({ playerId, name, score, connected }))
      .sort((a, b) => b.score - a.score);
  }

  /** Public view of the match for debugging tools and agents: no answers, socket ids or player ids (rejoin credentials). */
  snapshot() {
    return {
      pin: this.pin,
      phase: this.phase,
      questionIndex: this.questionIndex,
      totalQuestions: this.questions.length,
      answered: this.answers.size,
      players: this.leaderboard().map(({ name, score, connected }) => ({ name, score, connected })),
    };
  }

  // ---------- Internals ----------

  #rejectJoin(socketId, message) {
    this.emit(socketId, "player:error", message);
    return false;
  }

  #rejoin(socketId, player) {
    player.socketId = socketId;
    player.connected = true;
    this.emit(socketId, "player:joined", { name: player.name, pin: this.pin, playerId: player.playerId });
    this.#emitPlayerList();
    this.#emitAnswerCount();
    this.#emitPlayerState(player);
    return true;
  }

  #isNameTaken(name) {
    const normalized = name.toLowerCase();
    return [...this.players.values()].some((player) => player.name.toLowerCase() === normalized);
  }

  #connectedPlayers() {
    return [...this.players.values()].filter((player) => player.connected);
  }

  #playerBySocket(socketId) {
    return [...this.players.values()].find((player) => player.socketId === socketId) ?? null;
  }

  #removePlayer(playerId) {
    if (!this.players.delete(playerId)) return;
    this.answers.delete(playerId);
    this.#emitPlayerList();
    this.#emitAnswerCount();
    this.#endQuestionIfEveryoneAnswered();
  }

  #schedule(callback, delayMs) {
    this.#clearTimer();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      callback();
    }, delayMs);
  }

  #clearTimer() {
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #advance() {
    this.#clearTimer();
    this.startsAt = null;
    this.questionIndex += 1;

    if (this.questionIndex >= this.questions.length) {
      this.#machine.transition("end");
      this.emit(this.room, "game:end", { leaderboard: this.leaderboard() });
      return;
    }

    const question = this.currentQuestion;
    this.answers.clear();
    this.questionStartedAt = Date.now();
    this.#machine.transition(question.audioBefore ? "listening" : "answering");

    this.emit(this.hostId, "host:question", this.#hostQuestionPayload());
    this.#connectedPlayers().forEach((player) => this.#emitPlayerQuestion(player));

    if (!question.audioBefore) {
      this.#schedule(() => this.#endQuestion(), this.config.COUNTDOWN_QUESTION_SECONDS * 1000);
    }
  }

  /** Players who disconnect after answering still count; disconnected players without an answer do not block. */
  #expectedAnswerCount() {
    return [...this.players.values()].filter((player) => player.connected || this.answers.has(player.playerId)).length;
  }

  #endQuestionIfEveryoneAnswered() {
    if (!this.isQuestionPhase) return;

    const connected = this.#connectedPlayers();
    const everyoneAnswered = connected.length > 0 && connected.every((player) => this.answers.has(player.playerId));
    if (everyoneAnswered) {
      this.#endQuestion();
    }
  }

  #endQuestion() {
    if (!this.isQuestionPhase) return;

    this.#clearTimer();
    this.#machine.transition("reveal");
    const question = this.currentQuestion;
    const leaderboard = this.leaderboard();

    this.emit(this.hostId, "host:reveal", {
      correct: question.correct,
      optionCounts: this.#optionCounts(),
      leaderboard,
      date: question.date || null,
      after: question.after,
    });

    for (const player of this.players.values()) {
      if (!this.answers.has(player.playerId)) {
        player.streak = 0;
      }
      if (player.socketId) {
        this.emit(player.socketId, "player:result", this.#resultFor(player, leaderboard));
      }
    }
  }

  #optionCounts() {
    const counts = Object.fromEntries(this.currentQuestion.options.map((option) => [option, 0]));
    for (const { answer } of this.answers.values()) {
      counts[answer] += 1;
    }
    return counts;
  }

  #resultFor(player, leaderboard) {
    const answer = this.answers.get(player.playerId);
    const rankIndex = leaderboard.findIndex((entry) => entry.playerId === player.playerId);
    return {
      isCorrect: answer?.isCorrect ?? false,
      points: answer?.points ?? 0,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      score: player.score,
      streak: player.streak,
      timeout: !answer,
    };
  }

  #hostQuestionPayload() {
    const question = this.currentQuestion;
    return {
      index: this.questionIndex,
      total: this.questions.length,
      question: question.question,
      options: question.options,
      audioBefore: question.audioBefore,
      before: question.before,
      totalPlayers: this.#expectedAnswerCount(),
      countdownBefore: question.audioBefore ? this.config.COUNTDOWN_AUDIO_BEFORE_SECONDS : null,
      countdownAfter: question.audioBefore ? this.config.COUNTDOWN_AUDIO_AFTER_SECONDS : this.config.COUNTDOWN_QUESTION_SECONDS,
    };
  }

  #emitPlayerQuestion(player) {
    const answer = this.answers.get(player.playerId);
    this.emit(player.socketId, "player:question", {
      index: this.questionIndex,
      total: this.questions.length,
      options: this.currentQuestion.options,
      audioBefore: this.currentQuestion.audioBefore,
      answersOpen: this.phase === "answering",
      hasAnswered: Boolean(answer),
      selectedAnswer: answer?.answer ?? null,
    });
  }

  #emitPlayerState(player) {
    if (this.phase === "starting") {
      this.emit(player.socketId, "game:startCountdown", { seconds: this.config.COUNTDOWN_GAME_START_SECONDS, startsAt: this.startsAt });
    } else if (this.isQuestionPhase) {
      this.#emitPlayerQuestion(player);
    } else if (this.phase === "reveal") {
      this.emit(player.socketId, "player:result", this.#resultFor(player, this.leaderboard()));
    } else if (this.phase === "end") {
      this.emit(player.socketId, "game:end", { leaderboard: this.leaderboard() });
    }
  }

  #emitPlayerList() {
    this.emit(this.hostId, "host:playerList", this.leaderboard({ includeDisconnected: this.phase !== "lobby" }));
  }

  #emitAnswerCount() {
    if (!this.isQuestionPhase) return;
    this.emit(this.hostId, "host:answerCount", { answered: this.answers.size, total: this.#expectedAnswerCount() });
  }
}

module.exports = { Game, calculatePoints, sanitizePlayerName };
