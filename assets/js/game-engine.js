(function initGameEngine(globalScope) {
  const isNode = typeof module !== "undefined" && module.exports;
  const DEFAULT_CONFIG = isNode ? require("./game-config.js") : globalScope.RECUERDOOT_CONFIG;
  const { MACHINES, createStateMachine } = isNode ? require("./state-machines.js") : globalScope.RECUERDOOT_STATE_MACHINES;
  const { randomId } = isNode ? require("./game-shared.js") : globalScope.RECUERDOOT_SHARED;

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
   * One multiplayer match, run inside the host's browser. The network stays outside: every outgoing
   * message goes through `emit(target, event, payload)`, where target is the host id, a player
   * connection id or the game room (see match-host.js).
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

    isHost(connectionId) {
      return connectionId === this.hostId;
    }

    // ---------- Player lifecycle ----------

    join(connectionId, { pin, name, playerId } = {}) {
      if (String(pin ?? "").trim() !== this.pin) {
        return this.#rejectJoin(connectionId, "PIN incorrecto");
      }

      const existingPlayer = typeof playerId === "string" ? this.players.get(playerId) : undefined;
      if (existingPlayer) {
        return this.#rejoin(connectionId, existingPlayer);
      }

      if (this.phase !== "lobby") {
        return this.#rejectJoin(connectionId, "La partida ya ha comenzado");
      }
      if (this.#connectedPlayers().length >= this.config.MAX_PLAYERS) {
        return this.#rejectJoin(connectionId, `Sala llena (máx ${this.config.MAX_PLAYERS})`);
      }

      const cleanName = sanitizePlayerName(name, this.config.PLAYER_NAME_MAX_LENGTH);
      if (!cleanName) {
        return this.#rejectJoin(connectionId, "Introduce tu nombre");
      }
      if (this.#isNameTaken(cleanName)) {
        return this.#rejectJoin(connectionId, "Ese nombre ya está en uso");
      }

      const player = { playerId: randomId(), name: cleanName, score: 0, streak: 0, connectionId, connected: true };
      this.players.set(player.playerId, player);
      this.emit(connectionId, "player:joined", { name: player.name, pin: this.pin, playerId: player.playerId });
      this.#emitPlayerList();
      return true;
    }

    disconnect(connectionId) {
      const player = this.#playerByConnection(connectionId);
      if (!player) return;

      if (this.phase === "lobby") {
        this.#removePlayer(player.playerId);
        return;
      }

      player.connected = false;
      player.connectionId = null;
      this.#emitPlayerList();
      this.#emitAnswerCount();
      this.#endQuestionIfEveryoneAnswered();
    }

    purgeDisconnected(connectionId) {
      if (!this.isHost(connectionId)) return 0;

      const disconnected = [...this.players.values()].filter((player) => !player.connected);
      disconnected.forEach((player) => this.#removePlayer(player.playerId));
      return disconnected.length;
    }

    // ---------- Host commands ----------

    start(connectionId) {
      if (!this.isHost(connectionId) || this.phase !== "lobby" || this.players.size === 0) {
        return false;
      }

      this.#machine.transition("starting");
      const seconds = this.config.COUNTDOWN_GAME_START_SECONDS;
      this.startsAt = Date.now() + START_DELAY_MS;
      this.emit(this.room, "game:startCountdown", { seconds, startsAt: this.startsAt });
      this.#schedule(() => this.#advance(), START_DELAY_MS + seconds * 1000);
      return true;
    }

    openAnswers(connectionId) {
      if (!this.isHost(connectionId) || this.phase !== "listening") return false;

      this.#machine.transition("answering");
      this.emit(this.room, "player:answersOpen", { index: this.questionIndex });
      this.#schedule(() => this.#endQuestion(), this.config.COUNTDOWN_AUDIO_AFTER_SECONDS * 1000);
      return true;
    }

    timeUp(connectionId) {
      if (!this.isHost(connectionId) || !this.isQuestionPhase) return false;
      this.#endQuestion();
      return true;
    }

    next(connectionId) {
      if (!this.isHost(connectionId) || this.phase !== "reveal") return false;
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

    submitAnswer(connectionId, answer) {
      if (!this.isQuestionPhase) return false;

      const player = this.#playerByConnection(connectionId);
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

    /** Public view of the match for debugging tools and agents: no answers, connection ids or player ids (rejoin credentials). */
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

    #rejectJoin(connectionId, message) {
      this.emit(connectionId, "player:error", message);
      return false;
    }

    #rejoin(connectionId, player) {
      player.connectionId = connectionId;
      player.connected = true;
      this.emit(connectionId, "player:joined", { name: player.name, pin: this.pin, playerId: player.playerId });
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

    #playerByConnection(connectionId) {
      return [...this.players.values()].find((player) => player.connectionId === connectionId) ?? null;
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
        if (player.connectionId) {
          this.emit(player.connectionId, "player:result", this.#resultFor(player, leaderboard));
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
      this.emit(player.connectionId, "player:question", {
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
        this.emit(player.connectionId, "game:startCountdown", { seconds: this.config.COUNTDOWN_GAME_START_SECONDS, startsAt: this.startsAt });
      } else if (this.isQuestionPhase) {
        this.#emitPlayerQuestion(player);
      } else if (this.phase === "reveal") {
        this.emit(player.connectionId, "player:result", this.#resultFor(player, this.leaderboard()));
      } else if (this.phase === "end") {
        this.emit(player.connectionId, "game:end", { leaderboard: this.leaderboard() });
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

  const api = { Game, calculatePoints, sanitizePlayerName };

  if (isNode) {
    module.exports = api;
  }

  globalScope.RECUERDOOT_GAME = api;
})(globalThis);
