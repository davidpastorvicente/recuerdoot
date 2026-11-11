// Host page: solo mode and multiplayer big screen. Every flow goes through the `host` state machine.
const CONFIG = globalThis.RECUERDOOT_CONFIG;
const {
  ANSWER_SHAPES,
  createStartCountdownController,
  escapeHtml,
  formatQuestionCounter,
  normalizeQuestion,
  playCountdownTick,
  playQuestionEndGong,
} = globalThis.RECUERDOOT_SHARED;
const { MACHINES, createStateMachine } = globalThis.RECUERDOOT_STATE_MACHINES;
const { createMediaController, setMediaSource, stopVideo } = globalThis.RECUERDOOT_MEDIA;
const LEADERBOARD = globalThis.RECUERDOOT_LEADERBOARD;
const { showToast } = globalThis.RECUERDOOT_UI;

const $ = (id) => document.getElementById(id);

const RING_CIRCUMFERENCE = 2 * Math.PI * 44;
const URGENT_SECONDS = 5;
const TIME_UP_DELAY_MS = 40;
const SCOREBOARD_SETTLE_MS = 850;

const SCREEN_BY_STATE = Object.freeze({
  start: "start-screen",
  "solo-countdown": null,
  "solo-question": "question-screen",
  "solo-feedback": "question-screen",
  "solo-end": "solo-end-screen",
  "multi-connecting": "start-screen",
  "multi-lobby": "lobby-screen",
  "multi-countdown": "lobby-screen",
  "multi-reading": "question-screen",
  "multi-listening": "question-screen",
  "multi-answering": "question-screen",
  "multi-reveal": "reveal-screen",
  "multi-scoreboard": "scoreboard-screen",
  "multi-end": "multiplayer-end-screen",
});
// Entering these states always restarts their screen, even when it is already visible.
const FRESH_SCREEN_STATES = new Set(["solo-question"]);
const PHASE_LABEL_BY_STATE = Object.freeze({
  "multi-reading": "Atentos al audio",
  "multi-listening": "Escuchando",
  "multi-answering": "¡A responder!",
});
const PROGRESS_STATES = new Set(["solo-question", "solo-feedback", "multi-reading", "multi-listening", "multi-answering", "multi-reveal", "multi-scoreboard"]);
const EXIT_HIDDEN_STATES = new Set(["start", "multi-connecting", "solo-end", "multi-end"]);
const AUDIO_QUESTION_STATES = new Set(["multi-reading", "multi-listening"]);

const host = createStateMachine(MACHINES.host);
const startCountdown = createStartCountdownController();
const media = createMediaController({
  foreground: $("game-audio"),
  music: $("background-music"),
  volumes: { foreground: 1, music: 0.2, musicDucked: 0.08 },
  onForegroundChange: (playing) => {
    document.querySelectorAll(".play-button").forEach((button) => {
      button.classList.toggle("playing", playing);
      button.setAttribute("aria-pressed", String(playing));
    });
  },
});

const solo = { questions: [], index: 0, score: 0, current: null };
const multi = {
  socket: null,
  pin: null,
  question: null,
  players: [],
  previousLeaderboard: [],
  revealLeaderboard: [],
  currentLeaderboard: [],
  startRequested: false,
  autoplayTimer: null,
  scoreboardTimer: null,
};
let activeScreenId = "start-screen";
let progress = null;

const modeOf = (state) => {
  if (state.startsWith("solo-")) return "solo";
  if (state.startsWith("multi-")) return "multi";
  return "idle";
};
const isMultiInProgress = () => modeOf(host.state) === "multi" && !host.is("multi-end");

// ========== Screens & chrome ==========

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.hidden = screen.id !== screenId;
  });
  document.querySelectorAll("video").forEach(stopVideo);
  media.stopMusic();
  activeScreenId = screenId;
  $(screenId).scrollTop = 0;
}

function renderNav() {
  const state = host.state;
  const showProgress = PROGRESS_STATES.has(state) && progress;
  $("nav-progress").hidden = !showProgress;
  if (showProgress) {
    $("nav-progress-label").textContent = formatQuestionCounter(progress.index, progress.total);
    $("nav-progress-fill").style.width = `${((progress.index + 1) / progress.total) * 100}%`;
  }

  $("nav-pin-chip").hidden = !(isMultiInProgress() && multi.pin);
  $("nav-pin").textContent = multi.pin ?? "";
  $("exit-button").hidden = EXIT_HIDDEN_STATES.has(state);
}

function renderStartScreen() {
  const connecting = host.is("multi-connecting");
  const button = $("start-multiplayer-button");
  button.disabled = connecting;
  button.setAttribute("aria-busy", String(connecting));
  button.textContent = connecting ? "Creando partida…" : "Multijugador";
  $("start-solo-button").disabled = connecting;
}

function renderPhaseChip() {
  const label = PHASE_LABEL_BY_STATE[host.state];
  const chip = $("question-phase");
  chip.hidden = !label;
  chip.textContent = label ?? "";
  chip.dataset.phase = host.state;
}

host.subscribe(({ from, to }) => {
  document.body.dataset.state = to;
  document.body.dataset.mode = modeOf(to);

  const screenId = SCREEN_BY_STATE[to];
  if (screenId && (screenId !== activeScreenId || (from !== to && FRESH_SCREEN_STATES.has(to)))) {
    showScreen(screenId);
  }
  if (AUDIO_QUESTION_STATES.has(from) && !AUDIO_QUESTION_STATES.has(to)) {
    clearAutoplayTimer();
  }
  if (from === "multi-scoreboard" && to !== from) {
    clearScoreboardTimer();
  }
  if (from === "solo-feedback" && to !== from) {
    $("result-modal").hidden = true;
  }

  renderStartScreen();
  renderPhaseChip();
  renderNav();
});

function setQuestionText(element, text) {
  const quoteMatch = /"([^"]+)"/.exec(text);
  if (!quoteMatch) {
    element.textContent = text;
    return;
  }

  const highlight = document.createElement("mark");
  highlight.className = "quote";
  highlight.textContent = quoteMatch[1];
  element.replaceChildren(
    text.slice(0, quoteMatch.index),
    highlight,
    text.slice(quoteMatch.index + quoteMatch[0].length)
  );
}

function setButtonLabel(button, label) {
  button.querySelector(".button-label").textContent = label;
}

// ========== Question countdown (idle -> running -> finished) ==========

const questionTimer = (() => {
  const ring = $("countdown-ring-progress");
  const number = $("countdown-number");
  const container = $("countdown");
  let interval = null;
  let state = "idle";

  function render(remaining) {
    number.textContent = String(remaining);
    container.classList.toggle("is-urgent", remaining <= URGENT_SECONDS);
  }

  function stop() {
    clearInterval(interval);
    interval = null;
    state = "idle";
  }

  function prime(seconds) {
    stop();
    ring.style.transition = "none";
    ring.style.strokeDashoffset = "0";
    render(seconds);
  }

  /** Plays the end gong once, whether time ran out or the round ended early. */
  function finish() {
    if (state !== "running") return;
    clearInterval(interval);
    interval = null;
    state = "finished";
    media.stopMusic({ immediate: true });
    playQuestionEndGong();
  }

  function cue(remaining) {
    if (remaining <= URGENT_SECONDS) playCountdownTick(remaining);
  }

  function start(seconds, onEnd) {
    prime(seconds);
    state = "running";
    cue(seconds);
    ring.getBoundingClientRect();
    ring.style.transition = `stroke-dashoffset ${seconds}s linear`;
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE);

    let remaining = seconds;
    interval = setInterval(() => {
      remaining -= 1;
      render(Math.max(remaining, 0));
      if (remaining > 0) {
        cue(remaining);
        return;
      }
      finish();
      setTimeout(onEnd, TIME_UP_DELAY_MS);
    }, 1000);
  }

  return { finish, prime, start, stop };
})();

// ========== Shared rendering ==========

function renderAnswerTiles(options, { interactive }) {
  const grid = $("stage-answer-grid");
  grid.dataset.optionCount = String(options.length);
  grid.innerHTML = options.map((option, index) => {
    const label = escapeHtml(option);
    const content = `<span class="answer-shape">${ANSWER_SHAPES[index]}</span><span class="answer-label">${label}</span>`;
    if (!interactive) {
      return `<div class="answer-tile option-${index}">${content}</div>`;
    }
    const shortcut = `<kbd class="kbd answer-key">${index + 1}</kbd>`;
    return `<button type="button" class="answer-tile option-${index}" data-value="${label}">${content}${shortcut}</button>`;
  }).join("");
}

function renderQuestion(data, { mode }) {
  progress = { index: data.index, total: data.total };
  $("question-counter").textContent = formatQuestionCounter(data.index, data.total);
  setQuestionText($("question-text"), data.question);

  const hasAudio = data.audioBefore && Boolean(data.before.audio);
  setMediaSource($("question-image"), data.before.image);
  setMediaSource($("question-video"), data.before.video);
  $("host-audio-area").hidden = !hasAudio;
  $("question-media").hidden = !(data.before.image || data.before.video || hasAudio);
  media.loadForeground(hasAudio ? data.before.audio : null);
  media.playMusic(data.before.music || CONFIG.DEFAULT_QUESTION_MUSIC_SRC);

  renderAnswerTiles(data.options, { interactive: mode === "solo" });
  $("countdown").hidden = mode !== "multi";
  $("answer-count").hidden = mode !== "multi";
  $("answer-count-number").textContent = `0/${data.totalPlayers ?? 0}`;
  renderNav();
}

/** Fills a "gallery frame" with the media revealed after answering. */
function renderRevealMedia({ frame, image, video, audioRow, label }, { after, date }) {
  const hasVisual = Boolean(after.image || after.video);
  const hasAudio = Boolean(after.audio);

  setMediaSource(image, after.image);
  setMediaSource(video, after.video);
  frame.hidden = !(hasVisual || hasAudio);
  frame.classList.toggle("has-visual", hasVisual);
  audioRow.hidden = !hasAudio;
  label.textContent = hasAudio && date ? date : "";
  label.hidden = !label.textContent;
  media.loadForeground(after.audio);
}

// ========== Solo mode ==========

async function loadQuestionsFile() {
  if (solo.questions.length > 0) return solo.questions;

  const response = await fetch("questions.json");
  if (!response.ok) {
    throw new Error(`questions.json responded ${response.status}`);
  }
  solo.questions = await response.json();
  return solo.questions;
}

function startSolo() {
  if (!host.is("start", "solo-end")) return;

  loadQuestionsFile().then(() => {
    if (!host.is("start", "solo-end")) return;
    Object.assign(solo, { index: 0, score: 0, current: null });
    host.transition("solo-countdown");
    startCountdown.showStartCountdown(CONFIG.COUNTDOWN_GAME_START_SECONDS, { onEnd: soloLoadRound });
  }, () => {
    showToast("No se han podido cargar las preguntas. Revisa questions.json.", { tone: "error" });
  });
}

function soloLoadRound() {
  solo.current = normalizeQuestion(solo.questions[solo.index]);
  if (!host.transition("solo-question")) return;
  renderQuestion({ ...solo.current, index: solo.index, total: solo.questions.length }, { mode: "solo" });
}

function markSoloTiles(correct, selected) {
  $("stage-answer-grid").querySelectorAll(".answer-tile").forEach((tile) => {
    const value = tile.dataset.value;
    tile.disabled = true;
    tile.classList.toggle("is-correct", value === correct);
    tile.classList.toggle("is-wrong", value === selected && selected !== correct);
    tile.classList.toggle("is-dimmed", value !== correct && value !== selected);
  });
}

function soloAnswer(selected) {
  if (!host.is("solo-question")) return;
  host.transition("solo-feedback");

  const { correct, after, date } = solo.current;
  const isCorrect = selected === correct;
  if (isCorrect) solo.score += 1;
  markSoloTiles(correct, selected);

  const status = $("result-modal-status");
  status.textContent = isCorrect ? "¡Correcto!" : "¡Incorrecto!";
  status.dataset.result = isCorrect ? "correct" : "wrong";
  const detail = $("result-modal-detail");
  detail.hidden = isCorrect;
  detail.innerHTML = isCorrect ? "" : `La respuesta correcta era <strong class="text-success">${escapeHtml(correct)}</strong>`;

  media.playMusic(after.music);
  renderRevealMedia({
    frame: $("result-modal-media"),
    image: $("reveal-image"),
    video: $("reveal-video"),
    audioRow: $("result-modal-audio-row"),
    label: $("reveal-label"),
  }, { after, date });

  setButtonLabel($("solo-next-button"), solo.index < solo.questions.length - 1 ? "Siguiente" : "Ver resultado");
  $("result-modal").hidden = false;
  $("solo-next-button").focus();
}

function soloEndMessage(ratio) {
  if (ratio === 1) return "Memoria perfecta. Conocéis a vuestras amigas mejor que nadie.";
  if (ratio >= 0.75) return "¡Muy bien! Casi acertáis todas.";
  if (ratio >= 0.5) return "No está mal, ¡pero hay que repasar esos audios!";
  return "Uy… ¡toca volver a escuchar esos audios!";
}

function soloNext() {
  if (!host.is("solo-feedback")) return;

  media.stopForeground();
  solo.index += 1;
  if (solo.index < solo.questions.length) {
    soloLoadRound();
    return;
  }

  host.transition("solo-end");
  const total = solo.questions.length;
  $("final-score").textContent = `${solo.score} / ${total}`;
  $("end-message").textContent = soloEndMessage(solo.score / total);
}

// ========== Multiplayer mode ==========

function clearAutoplayTimer() {
  clearTimeout(multi.autoplayTimer);
  multi.autoplayTimer = null;
}

function clearScoreboardTimer() {
  clearTimeout(multi.scoreboardTimer);
  multi.scoreboardTimer = null;
}

function startMultiplayer() {
  if (!host.is("start")) return;
  host.transition("multi-connecting");

  Object.assign(multi, {
    pin: null,
    question: null,
    players: [],
    previousLeaderboard: [],
    revealLeaderboard: [],
    currentLeaderboard: [],
    startRequested: false,
  });
  ensureSocket().emit("host:create");
}

function renderLobbyPlayers(players) {
  $("player-grid").innerHTML = players.map((player) => `<li class="chip chip-player">${escapeHtml(player.name)}</li>`).join("");
  $("player-empty").hidden = players.length > 0;
  $("player-count").textContent = `${players.length}/${CONFIG.MAX_PLAYERS}`;

  if (multi.startRequested) return;
  const button = $("lobby-start-button");
  button.disabled = players.length === 0;
  const plural = players.length === 1 ? "" : "es";
  setButtonLabel(button, players.length > 0 ? `Empezar (${players.length} jugador${plural})` : "Esperando jugadores…");
}

function onHostCreated({ pin, joinBaseUrl, joinUrl, qrSvg }) {
  if (!host.is("multi-connecting")) {
    multi.socket.emit("host:end");
    return;
  }

  multi.pin = pin;
  host.transition("multi-lobby");
  media.playMusic(CONFIG.LOBBY_WAITING_MUSIC_SRC);
  $("pin-display").textContent = `${pin.slice(0, 3)} ${pin.slice(3)}`;
  $("pin-display").setAttribute("aria-label", pin.split("").join(" "));
  const link = $("join-url");
  link.href = joinUrl;
  link.textContent = `${joinBaseUrl.replace(/^https?:\/\//, "")}/player.html`;
  $("qr-code").innerHTML = qrSvg;
  const qrImage = $("qr-code").querySelector("svg");
  qrImage?.setAttribute("role", "img");
  qrImage?.setAttribute("aria-label", "Código QR para unirse a la partida");
  renderLobbyPlayers([]);
  renderNav();
}

function onHostError(message) {
  showToast(message, { tone: "error" });
  if (host.is("multi-connecting")) host.transition("start");
}

function onPlayerList(players) {
  multi.players = players;
  multi.currentLeaderboard = LEADERBOARD.cloneLeaderboard(players);
  if (multi.startRequested && players.length === 0 && host.is("multi-lobby")) {
    multi.startRequested = false;
  }
  renderLobbyPlayers(players);
}

function requestStart() {
  if (!host.is("multi-lobby") || multi.players.length === 0 || multi.startRequested) return;

  multi.startRequested = true;
  const button = $("lobby-start-button");
  button.disabled = true;
  setButtonLabel(button, "Empezando…");
  multi.socket.emit("host:start");
}

function onStartCountdown({ seconds, startsAt }) {
  if (!host.transition("multi-countdown")) return;
  media.stopMusic();
  startCountdown.showStartCountdown(seconds, { startsAt });
}

const emitTimeUp = () => multi.socket.emit("host:timeUp");

function openAnswersAfterAudio() {
  if (!host.is("multi-listening")) return;

  host.transition("multi-answering");
  questionTimer.start(multi.question.countdownAfter, emitTimeUp);
  multi.socket.emit("host:answersOpen");
}

/** Plays the question clip; if the browser refuses or the file fails, answers open right away. */
function beginListening() {
  clearAutoplayTimer();
  if (!host.transition("multi-listening")) return;

  media.playForeground({ onEnded: openAnswersAfterAudio }).then((started) => {
    if (!started) openAnswersAfterAudio();
  });
}

function onHostQuestion(data) {
  startCountdown.hideStartCountdown();
  multi.question = data;
  if (!host.transition(data.audioBefore ? "multi-reading" : "multi-answering")) return;

  renderQuestion(data, { mode: "multi" });
  if (data.audioBefore) {
    questionTimer.prime(data.countdownAfter);
    multi.autoplayTimer = setTimeout(beginListening, data.countdownBefore * 1000);
  } else {
    questionTimer.start(data.countdownAfter, emitTimeUp);
  }
}

function onQuestionAudioButton() {
  if (host.is("multi-reading")) {
    beginListening();
    return;
  }
  if (host.is("multi-listening")) {
    media.stopForeground({ immediate: true });
    openAnswersAfterAudio();
    return;
  }
  media.toggleForeground();
}

function onAnswerCount({ answered, total }) {
  $("answer-count-number").textContent = `${answered}/${total}`;
}

function renderRevealChart(options, { optionCounts, correct }) {
  const chart = $("reveal-chart");
  const maxCount = Math.max(1, ...options.map((option) => optionCounts[option] || 0));
  chart.dataset.optionCount = String(options.length);
  chart.innerHTML = options.map((option, index) => {
    const count = optionCounts[option] || 0;
    const isCorrect = option === correct;
    const height = count > 0 ? Math.max(10, (count / maxCount) * 100) : 3;
    const stateClass = isCorrect ? "is-correct" : "is-dimmed";
    const badge = isCorrect ? '<span class="chart-badge">✓ Correcta</span>' : '<span class="chart-badge chart-badge-empty" aria-hidden="true"></span>';

    return `<div class="chart-column option-${index} ${stateClass}">
      ${badge}
      <span class="chart-count mono">${count}</span>
      <div class="chart-track"><div class="chart-bar" style="height:${height}%"></div></div>
      <div class="chart-label"><span class="answer-shape">${ANSWER_SHAPES[index]}</span><span>${escapeHtml(option)}</span></div>
    </div>`;
  }).join("");
}

function onHostReveal(data) {
  questionTimer.finish();
  clearAutoplayTimer();
  startCountdown.hideStartCountdown();
  media.stopForeground();

  const { question } = multi;
  multi.previousLeaderboard = question.index > 0 ? LEADERBOARD.cloneLeaderboard(multi.currentLeaderboard) : [];
  multi.revealLeaderboard = LEADERBOARD.cloneLeaderboard(data.leaderboard);
  multi.currentLeaderboard = LEADERBOARD.cloneLeaderboard(data.leaderboard);
  if (!host.transition("multi-reveal")) return;

  $("reveal-question-meta").textContent = formatQuestionCounter(question.index, question.total);
  setQuestionText($("reveal-text"), question.question);
  renderRevealChart(question.options, data);
  media.playMusic(data.after.music);
  renderRevealMedia({
    frame: $("reveal-media"),
    image: $("reveal-media-image"),
    video: $("reveal-media-video"),
    audioRow: $("reveal-media-audio-row"),
    label: $("reveal-media-label"),
  }, data);

  const isLastQuestion = question.index >= question.total - 1;
  setButtonLabel($("scoreboard-next-button"), isLastQuestion ? "Ver resultados" : "Siguiente pregunta");
  $("reveal-next-button").focus();
}

/** First scoreboard appears directly; later ones show the old order, then animate to the new one. */
function showScoreboard() {
  if (!host.is("multi-reveal")) return;
  host.transition("multi-scoreboard");

  media.stopForeground({ immediate: true });
  media.stopMusic({ immediate: true });
  $("scoreboard-meta").textContent = formatQuestionCounter(multi.question.index, multi.question.total);

  const previous = multi.previousLeaderboard;
  const next = multi.revealLeaderboard;
  const list = $("scoreboard-leaderboard");
  const button = $("scoreboard-next-button");
  const limit = CONFIG.LEADERBOARD_DISPLAY_LIMIT;

  button.disabled = true;
  LEADERBOARD.renderAnimated(list, previous.length > 0 ? previous : next, { limit });
  if (previous.length === 0) {
    button.disabled = false;
    button.focus();
    return;
  }

  const movementMap = LEADERBOARD.getLeaderboardMovement(previous, next);
  multi.scoreboardTimer = setTimeout(() => {
    multi.scoreboardTimer = null;
    LEADERBOARD.renderAnimated(list, next, { limit, movementMap });
    LEADERBOARD.animateScores(list, previous, next);
    button.disabled = false;
    button.focus();
  }, SCOREBOARD_SETTLE_MS);
}

function requestNextQuestion() {
  const button = $("scoreboard-next-button");
  if (!host.is("multi-scoreboard") || button.disabled) return;

  button.disabled = true;
  media.stopForeground();
  multi.socket.emit("host:next");
}

function onGameEnd({ leaderboard }) {
  clearAutoplayTimer();
  questionTimer.stop();
  startCountdown.hideStartCountdown();
  media.stopForeground();
  if (!host.transition("multi-end")) return;

  const [winner] = leaderboard;
  $("winner-name").textContent = winner ? winner.name : "Sin ganador";
  $("winner-score").textContent = winner ? `${winner.score} puntos` : "";
  LEADERBOARD.renderStatic($("end-leaderboard"), leaderboard, { limit: CONFIG.LEADERBOARD_DISPLAY_LIMIT });
}

function onSocketDisconnect() {
  if (!isMultiInProgress()) return;
  showToast("Se ha perdido la conexión con el servidor y la partida ha terminado.", { tone: "error" });
  backToStart();
}

function ensureSocket() {
  if (multi.socket) return multi.socket;

  const socket = io();
  multi.socket = socket;
  socket.on("host:created", onHostCreated);
  socket.on("host:error", onHostError);
  socket.on("host:playerList", onPlayerList);
  socket.on("game:startCountdown", onStartCountdown);
  socket.on("host:question", onHostQuestion);
  socket.on("host:answerCount", onAnswerCount);
  socket.on("host:reveal", onHostReveal);
  socket.on("game:end", onGameEnd);
  socket.on("disconnect", onSocketDisconnect);
  return socket;
}

// ========== Exit & navigation ==========

function backToStart() {
  if (isMultiInProgress()) {
    multi.socket?.emit("host:end");
  }

  clearAutoplayTimer();
  clearScoreboardTimer();
  questionTimer.stop();
  startCountdown.hideStartCountdown();
  media.stopForeground();
  multi.pin = null;
  host.transition("start");
}

function requestExit() {
  const dialog = $("exit-dialog");
  // Escape closes without a value and keeps the previous returnValue, so reset it first.
  dialog.returnValue = "";
  $("exit-dialog-text").textContent = modeOf(host.state) === "multi"
    ? "La partida terminará para todos los jugadores."
    : "Perderás el progreso de esta partida.";
  dialog.showModal();
}

function getShortcutTarget() {
  const scope = host.is("solo-feedback") ? $("result-modal") : $(activeScreenId);
  const candidates = scope ? scope.querySelectorAll('[data-shortcut="next"]') : [];
  return Array.from(candidates).find((button) => !button.disabled && !button.closest("[hidden]")) ?? null;
}

function onKeyDown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || $("exit-dialog").open) return;
  if (event.target.closest?.("input, textarea, select")) return;

  if (host.is("solo-question") && /^[1-6]$/.test(event.key)) {
    $("stage-answer-grid").querySelectorAll("button.answer-tile")[Number(event.key) - 1]?.click();
    return;
  }
  if (event.key === "ArrowRight") {
    getShortcutTarget()?.click();
  }
}

function bindHostUi() {
  $("start-solo-button").addEventListener("click", startSolo);
  $("start-multiplayer-button").addEventListener("click", startMultiplayer);
  $("lobby-start-button").addEventListener("click", requestStart);
  $("host-play-button").addEventListener("click", onQuestionAudioButton);
  $("reveal-play-button").addEventListener("click", () => media.toggleForeground());
  $("reveal-media-play-button").addEventListener("click", () => media.toggleForeground());
  $("stage-answer-grid").addEventListener("click", (event) => {
    const tile = event.target.closest("button.answer-tile");
    if (tile) soloAnswer(tile.dataset.value);
  });
  $("solo-next-button").addEventListener("click", soloNext);
  $("reveal-next-button").addEventListener("click", showScoreboard);
  $("scoreboard-next-button").addEventListener("click", requestNextQuestion);
  $("solo-restart-button").addEventListener("click", startSolo);
  $("solo-back-button").addEventListener("click", backToStart);
  $("multiplayer-back-button").addEventListener("click", backToStart);
  $("exit-button").addEventListener("click", requestExit);
  $("exit-dialog").addEventListener("close", () => {
    if ($("exit-dialog").returnValue === "confirm") backToStart();
  });
  document.addEventListener("keydown", onKeyDown);
}

function showQuestionCount() {
  loadQuestionsFile()
    .then((questions) => {
      $("start-question-count").textContent = `${questions.length} preguntas`;
    })
    .catch(() => {
      showToast("No se encuentra questions.json. Consulta el README para crearlo.", { tone: "error" });
    });
}

// ========== Console helpers (host browser console) ==========

globalThis.purgeDisconnectedPlayers = function purgeDisconnectedPlayers() {
  if (!multi.socket || !isMultiInProgress()) return false;
  multi.socket.emit("host:purgeDisconnected");
  return true;
};

globalThis.listDisconnectedPlayers = function listDisconnectedPlayers() {
  if (modeOf(host.state) !== "multi") return [];
  return multi.players
    .filter((player) => !player.connected)
    .map(({ playerId, name, score }) => ({ playerId, name, score }));
};

globalThis.getCurrentRanking = function getCurrentRanking() {
  return multi.currentLeaderboard.map(({ name, score }) => ({ name, score }));
};

globalThis.getHostState = function getHostState() {
  return { state: host.state, mode: modeOf(host.state), pin: multi.pin, progress };
};

bindHostUi();
renderStartScreen();
renderNav();
showQuestionCount();
