// Player phone page. The server is authoritative; the `player` state machine mirrors where this phone is.
const CONFIG = globalThis.RECUERDOOT_CONFIG;
const { ANSWER_SHAPES, createStartCountdownController, escapeHtml, formatQuestionCounter } = globalThis.RECUERDOOT_SHARED;
const { MACHINES, createStateMachine } = globalThis.RECUERDOOT_STATE_MACHINES;

const $ = (id) => document.getElementById(id);

const PLAYER_SESSION_KEY = "recuerdoot-player-session";
const PIN_PATTERN = new RegExp(String.raw`^\d{${CONFIG.PIN_LENGTH}}$`);
const SCREEN_BY_STATE = Object.freeze({
  join: "join-screen",
  joining: "join-screen",
  waiting: "waiting-screen",
  countdown: "waiting-screen",
  answering: "answer-screen",
  answered: "answer-screen",
  result: "result-screen",
  ended: "end-screen",
});
const RANK_LABELS = ["", "Primera posición", "Segunda posición", "Tercera posición"];
const RESULT_ICONS = {
  correct: '<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm10.4 14.6a2 2 0 0 0-2.8 0L28 36.2l-3.6-3.6a2 2 0 1 0-2.8 2.8l5 5a2 2 0 0 0 2.8 0l13-13a2 2 0 0 0 0-2.8Z"/></svg>',
  wrong: '<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm-7.4 14.6a2 2 0 0 0 0 2.8l4.6 4.6-4.6 4.6a2 2 0 1 0 2.8 2.8l4.6-4.6 4.6 4.6a2 2 0 1 0 2.8-2.8L34.8 32l4.6-4.6a2 2 0 0 0-2.8-2.8L32 29.2l-4.6-4.6a2 2 0 0 0-2.8 0Z"/></svg>',
  timeout: '<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm0 6a2 2 0 0 0-2 2v14.8l8.4 5.6a2 2 0 1 0 2.2-3.3L34 30.8V18a2 2 0 0 0-2-2Z"/></svg>',
};

const socket = io();
const player = createStateMachine(MACHINES.player);
const startCountdown = createStartCountdownController();
const session = { pin: "", name: "", playerId: "" };
let activeScreenId = "join-screen";

// ========== Session storage ==========

function readStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem(PLAYER_SESSION_KEY)) ?? null;
  } catch {
    return null;
  }
}

function storeSession() {
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  session.playerId = "";
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

// ========== Rendering ==========

function showScreen(screenId) {
  if (screenId === activeScreenId) return;
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.hidden = screen.id !== screenId;
  });
  activeScreenId = screenId;
}

function renderJoinForm() {
  const joining = player.is("joining");
  const button = $("join-button");
  button.disabled = joining;
  button.setAttribute("aria-busy", String(joining));
  button.textContent = joining ? "Uniéndote…" : "Unirse";
}

function renderNameChip() {
  const chip = $("player-name-chip");
  const visible = Boolean(session.playerId) && !player.is("join", "joining");
  chip.hidden = !visible;
  chip.textContent = session.name;
}

player.subscribe(({ to }) => {
  document.body.dataset.state = to;
  showScreen(SCREEN_BY_STATE[to]);
  renderJoinForm();
  renderNameChip();
});

function setJoinError(message) {
  $("error-msg").textContent = message;
  $("pin-input").setAttribute("aria-invalid", String(message.includes("PIN")));
}

function renderRankBadge(container, rank) {
  if (!rank || rank < 1) {
    container.textContent = "—";
    return;
  }
  if (rank <= 3) {
    container.innerHTML = `<span class="rank-badge rank-badge-lg rank-${rank}"><span aria-hidden="true">${rank}</span><span class="visually-hidden">${RANK_LABELS[rank]}</span></span>`;
    return;
  }
  container.textContent = `#${rank}`;
}

function getResultView({ isCorrect, points, timeout }) {
  if (timeout) return { icon: RESULT_ICONS.timeout, text: "Se acabó el tiempo", tone: "wrong", pointsText: "" };
  if (isCorrect) return { icon: RESULT_ICONS.correct, text: "¡Correcto!", tone: "correct", pointsText: `+${points} puntos` };
  return { icon: RESULT_ICONS.wrong, text: "Incorrecto", tone: "wrong", pointsText: "" };
}

function setAnswerStatus(text, tone) {
  const status = $("answer-status");
  status.textContent = text;
  status.dataset.tone = tone;
}

function renderAnswerGrid({ options }) {
  const grid = $("player-answer-grid");
  grid.dataset.optionCount = String(options.length);
  grid.innerHTML = options.map((option, index) => {
    const label = escapeHtml(option);
    return `<button type="button" class="player-answer option-${index}" data-answer="${label}" aria-label="${label}"><span class="answer-shape">${ANSWER_SHAPES[index]}</span><span class="visually-hidden">${label}</span></button>`;
  }).join("");
}

function markSelectedAnswer(answer) {
  $("player-answer-grid").querySelectorAll(".player-answer").forEach((button) => {
    const selected = button.dataset.answer === answer;
    button.disabled = true;
    button.classList.toggle("is-selected", selected);
    button.classList.toggle("is-dimmed", !selected);
  });
  setAnswerStatus("Respuesta enviada", "done");
}

// ========== Join flow ==========

function emitJoin() {
  socket.emit("player:join", { pin: session.pin, name: session.name, playerId: session.playerId || undefined });
}

function requestJoin() {
  if (!player.transition("joining")) return;
  setJoinError("");
  if (socket.connected) emitJoin();
}

function onJoinSubmit(event) {
  event.preventDefault();
  const pin = $("pin-input").value.trim();
  const name = $("name-input").value.trim();

  if (!PIN_PATTERN.test(pin)) {
    setJoinError(`Introduce el PIN de ${CONFIG.PIN_LENGTH} cifras`);
    $("pin-input").focus();
    return;
  }
  if (!name) {
    setJoinError("Introduce tu nombre");
    $("name-input").focus();
    return;
  }

  if (session.pin !== pin || session.name !== name) {
    session.playerId = "";
  }
  Object.assign(session, { pin, name });
  requestJoin();
}

function resetToJoin() {
  clearSession();
  const url = new URL(location.href);
  if (url.searchParams.has("pin")) {
    url.searchParams.delete("pin");
    history.replaceState(null, "", url);
  }
  const pinInput = $("pin-input");
  pinInput.readOnly = false;
  pinInput.value = "";
  player.transition("join");
  pinInput.focus();
}

// ========== Server events ==========

socket.on("connect", () => {
  $("connection-chip").hidden = true;
  if (player.is("joining") || session.playerId) emitJoin();
});

socket.on("disconnect", () => {
  $("connection-chip").hidden = player.is("join", "ended");
});

socket.on("player:error", (message) => {
  clearSession();
  startCountdown.hideStartCountdown();
  $("pin-input").readOnly = false;
  setJoinError(message);
  player.transition("join");
});

socket.on("player:joined", ({ name, pin, playerId }) => {
  Object.assign(session, { name, pin, playerId });
  storeSession();
  $("my-name").textContent = name;
  setJoinError("");
  if (player.is("joining")) {
    player.transition("waiting");
  }
  renderNameChip();
});

socket.on("game:startCountdown", ({ seconds, startsAt }) => {
  if (!player.transition("countdown")) return;
  startCountdown.showStartCountdown(seconds, { startsAt });
});

socket.on("player:question", (data) => {
  startCountdown.hideStartCountdown();
  if (!player.transition(data.hasAnswered ? "answered" : "answering")) return;

  $("answer-question-meta").textContent = formatQuestionCounter(data.index, data.total);
  renderAnswerGrid(data);
  if (data.hasAnswered && data.selectedAnswer) {
    markSelectedAnswer(data.selectedAnswer);
  } else if (data.answersOpen) {
    setAnswerStatus("¡Responde!", "open");
  } else {
    setAnswerStatus("Escucha el audio", "listening");
  }
});

socket.on("player:answersOpen", () => {
  if (player.is("answering")) setAnswerStatus("¡Responde!", "open");
});

function sendAnswer(button) {
  if (!player.is("answering")) return;
  player.transition("answered");
  socket.emit("player:answer", { answer: button.dataset.answer });
  markSelectedAnswer(button.dataset.answer);
}

socket.on("player:result", (result) => {
  startCountdown.hideStartCountdown();
  if (!player.transition("result")) return;

  const view = getResultView(result);
  $("result-icon").innerHTML = view.icon;
  $("result-icon").dataset.tone = view.tone;
  $("result-text").textContent = view.text;
  $("result-text").dataset.tone = view.tone;
  $("result-points").textContent = view.pointsText;
  renderRankBadge($("result-rank"), result.rank);
  $("result-position").textContent = result.rank ? `Vas en el puesto ${result.rank}` : "";
  $("result-score").textContent = String(result.score);
  $("result-streak").hidden = result.streak <= 1;
  $("result-streak").textContent = `Racha de ${result.streak}`;
});

socket.on("game:end", ({ leaderboard }) => {
  startCountdown.hideStartCountdown();
  const myIndex = leaderboard.findIndex((entry) => entry.playerId === session.playerId);
  clearSession();
  if (!player.transition("ended")) return;

  const rank = myIndex + 1;
  renderRankBadge($("end-rank"), rank);
  let positionText = "Partida terminada";
  if (rank === 1) positionText = "¡Has ganado!";
  else if (rank > 1) positionText = `Puesto ${rank}`;
  $("end-position").textContent = positionText;
  $("end-score").textContent = myIndex >= 0 ? `${leaderboard[myIndex].score} puntos` : "";
});

socket.on("player:gameOver", (message) => {
  startCountdown.hideStartCountdown();
  clearSession();
  if (!player.transition("ended")) return;

  $("end-rank").textContent = "";
  $("end-position").textContent = message;
  $("end-score").textContent = "";
});

// ========== Boot ==========

function bindPlayerUi() {
  $("join-form").addEventListener("submit", onJoinSubmit);
  $("player-reload-button").addEventListener("click", resetToJoin);
  $("player-answer-grid").addEventListener("click", (event) => {
    const button = event.target.closest(".player-answer");
    if (button) sendAnswer(button);
  });
}

function restoreSession() {
  const stored = readStoredSession();
  if (stored?.name) $("name-input").value = stored.name;
  if (stored?.pin) $("pin-input").value = stored.pin;

  const urlPin = new URLSearchParams(location.search).get("pin");
  if (urlPin) {
    $("pin-input").value = urlPin;
    $("pin-input").readOnly = true;
  }

  const sameGame = !urlPin || urlPin === stored?.pin;
  if (sameGame && stored?.pin && stored.name && stored.playerId) {
    Object.assign(session, { pin: stored.pin, name: stored.name, playerId: stored.playerId });
    requestJoin();
    return;
  }

  (urlPin ? $("name-input") : $("pin-input")).focus();
}

bindPlayerUi();
restoreSession();

globalThis.getPlayerState = function getPlayerState() {
  return { state: player.state, name: session.name, pin: session.pin, connected: socket.connected };
};
