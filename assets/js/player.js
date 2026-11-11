// Player phone page. The host browser is authoritative; the `player` state machine mirrors where this phone is.
const CONFIG = globalThis.RECUERDOOT_CONFIG;
const { ANSWER_SHAPES, createStartCountdownController, escapeHtml } = globalThis.RECUERDOOT_SHARED;
const I18N = globalThis.RECUERDOOT_I18N;
const { setPlain, setText, t } = I18N;
const { MACHINES, createStateMachine } = globalThis.RECUERDOOT_STATE_MACHINES;
const { createPeerClient } = globalThis.RECUERDOOT_PEER;

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
const RESULT_ICONS = {
  correct: '<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm10.4 14.6a2 2 0 0 0-2.8 0L28 36.2l-3.6-3.6a2 2 0 1 0-2.8 2.8l5 5a2 2 0 0 0 2.8 0l13-13a2 2 0 0 0 0-2.8Z"/></svg>',
  wrong: '<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm-7.4 14.6a2 2 0 0 0 0 2.8l4.6 4.6-4.6 4.6a2 2 0 1 0 2.8 2.8l4.6-4.6 4.6 4.6a2 2 0 1 0 2.8-2.8L34.8 32l4.6-4.6a2 2 0 0 0-2.8-2.8L32 29.2l-4.6-4.6a2 2 0 0 0-2.8 0Z"/></svg>',
  timeout: '<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm0 6a2 2 0 0 0-2 2v14.8l8.4 5.6a2 2 0 1 0 2.2-3.3L34 30.8V18a2 2 0 0 0-2-2Z"/></svg>',
};

const player = createStateMachine(MACHINES.player);
const startCountdown = createStartCountdownController();
const session = { pin: "", name: "", playerId: "" };
const connection = createPeerClient({
  onOpen: onConnectionOpen,
  onEvent: onHostEvent,
  onDrop: onConnectionDrop,
  onUnavailable: onMatchUnavailable,
  onFailure: onConnectionFailure,
});
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
  setText(button, joining ? "player.joining" : "player.join");
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

const PIN_ERROR_KEYS = new Set(["join.error.wrongPin", "join.error.pinFormat"]);

/** Shows a join problem; `error` is a message key (or `{ key, params }` from the host), or null to clear it. */
function setJoinError(error) {
  const { key, params } = toMessage(error);
  if (key) setText($("error-msg"), key, params);
  else setPlain($("error-msg"), "");
  $("pin-input").setAttribute("aria-invalid", String(PIN_ERROR_KEYS.has(key)));
}

/** Host messages arrive as `{ key, params }` (see game-engine.js) so they show in this phone's language. */
function toMessage(value) {
  if (typeof value === "string") return { key: value };
  if (value && typeof value.key === "string") return { key: value.key, params: value.params };
  return { key: null };
}

function renderRankBadge(container, rank) {
  if (!rank || rank < 1) {
    container.textContent = "—";
    return;
  }
  if (rank <= 3) {
    const key = `rank.${rank}`;
    container.innerHTML = `<span class="rank-badge rank-badge-lg rank-${rank}"><span aria-hidden="true">${rank}</span><span class="visually-hidden" ${I18N.attrs(key)}>${escapeHtml(t(key))}</span></span>`;
    return;
  }
  container.textContent = `#${rank}`;
}

function getResultView({ isCorrect, timeout }) {
  if (timeout) return { icon: RESULT_ICONS.timeout, textKey: "player.timeout", tone: "wrong" };
  if (isCorrect) return { icon: RESULT_ICONS.correct, textKey: "player.correct", tone: "correct" };
  return { icon: RESULT_ICONS.wrong, textKey: "player.wrong", tone: "wrong" };
}

function setAnswerStatus(key, tone) {
  const status = $("answer-status");
  setText(status, key);
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
  setAnswerStatus("player.sent", "done");
}

// ========== Join flow ==========

function emitJoin() {
  connection.send("player:join", { pin: session.pin, name: session.name, playerId: session.playerId || undefined });
}

/** Opens a fresh link to the host of `session.pin`; player:join is sent once it is open. */
function requestJoin() {
  if (!player.transition("joining")) return;
  setJoinError(null);
  connection.connect(session.pin);
}

function onJoinSubmit(event) {
  event.preventDefault();
  const pin = $("pin-input").value.trim();
  const name = $("name-input").value.trim();

  if (!PIN_PATTERN.test(pin)) {
    setJoinError({ key: "join.error.pinFormat", params: { length: CONFIG.PIN_LENGTH } });
    $("pin-input").focus();
    return;
  }
  if (!name) {
    setJoinError("join.error.nameRequired");
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
  connection.disconnect();
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

function showJoinError(error) {
  connection.disconnect();
  clearSession();
  startCountdown.hideStartCountdown();
  $("connection-chip").hidden = true;
  $("pin-input").readOnly = false;
  setJoinError(error);
  player.transition("join");
}

function showMatchOver(reason) {
  connection.disconnect();
  startCountdown.hideStartCountdown();
  clearSession();
  $("connection-chip").hidden = true;
  if (!player.transition("ended")) return;

  $("end-rank").textContent = "";
  const { key, params } = toMessage(reason);
  setText($("end-position"), key ?? "player.matchOver", params);
  setPlain($("end-score"), "");
}

// ========== Connection ==========

function onConnectionOpen() {
  $("connection-chip").hidden = true;
  if (player.is("joining") || session.playerId) emitJoin();
}

function onConnectionDrop() {
  $("connection-chip").hidden = player.is("join", "ended");
}

/** Nobody is hosting that PIN: a typo, or the host closed the match while this phone was away. */
function onMatchUnavailable() {
  if (player.is("join", "joining")) {
    showJoinError("join.error.wrongPin");
    return;
  }
  showMatchOver("gameOver.hostGone");
}

function onConnectionFailure() {
  showJoinError("join.error.connection");
}

// ========== Host events ==========

function onJoined({ name, pin, playerId }) {
  Object.assign(session, { name, pin, playerId });
  storeSession();
  $("my-name").textContent = name;
  setJoinError(null);
  if (player.is("joining")) {
    player.transition("waiting");
  }
  renderNameChip();
}

function onStartCountdown({ seconds, startsAt }) {
  if (!player.transition("countdown")) return;
  startCountdown.showStartCountdown(seconds, { startsAt });
}

function onQuestion(data) {
  startCountdown.hideStartCountdown();
  if (!player.transition(data.hasAnswered ? "answered" : "answering")) return;

  setText($("answer-question-meta"), "question.counter", { current: data.index + 1, total: data.total });
  renderAnswerGrid(data);
  if (data.hasAnswered && data.selectedAnswer) {
    markSelectedAnswer(data.selectedAnswer);
  } else if (data.answersOpen) {
    setAnswerStatus("player.answerNow", "open");
  } else {
    setAnswerStatus("player.listen", "listening");
  }
}

function onAnswersOpen() {
  if (player.is("answering")) setAnswerStatus("player.answerNow", "open");
}

function sendAnswer(button) {
  if (!player.is("answering")) return;
  player.transition("answered");
  connection.send("player:answer", { answer: button.dataset.answer });
  markSelectedAnswer(button.dataset.answer);
}

function onResult(result) {
  startCountdown.hideStartCountdown();
  if (!player.transition("result")) return;

  const view = getResultView(result);
  $("result-icon").innerHTML = view.icon;
  $("result-icon").dataset.tone = view.tone;
  setText($("result-text"), view.textKey);
  $("result-text").dataset.tone = view.tone;
  if (result.isCorrect && !result.timeout) setText($("result-points"), "player.gained", { points: result.points });
  else setPlain($("result-points"), "");
  renderRankBadge($("result-rank"), result.rank);
  if (result.rank) setText($("result-position"), "player.rankNow", { rank: result.rank });
  else setPlain($("result-position"), "");
  $("result-score").textContent = String(result.score);
  $("result-streak").hidden = result.streak <= 1;
  setText($("result-streak"), "player.streak", { count: result.streak });
}

function onGameEnd({ leaderboard }) {
  connection.disconnect();
  startCountdown.hideStartCountdown();
  $("connection-chip").hidden = true;
  const myIndex = leaderboard.findIndex((entry) => entry.playerId === session.playerId);
  clearSession();
  if (!player.transition("ended")) return;

  const rank = myIndex + 1;
  renderRankBadge($("end-rank"), rank);
  if (rank === 1) setText($("end-position"), "player.won");
  else if (rank > 1) setText($("end-position"), "player.place", { rank });
  else setText($("end-position"), "player.matchOver");
  if (myIndex >= 0) setText($("end-score"), "score.points", { count: leaderboard[myIndex].score });
  else setPlain($("end-score"), "");
}

const HOST_EVENT_HANDLERS = {
  "player:error": showJoinError,
  "player:joined": onJoined,
  "game:startCountdown": onStartCountdown,
  "player:question": onQuestion,
  "player:answersOpen": onAnswersOpen,
  "player:result": onResult,
  "game:end": onGameEnd,
  "player:gameOver": showMatchOver,
};

function onHostEvent(event, payload) {
  if (!Object.hasOwn(HOST_EVENT_HANDLERS, event)) return;
  try {
    HOST_EVENT_HANDLERS[event](payload ?? {});
  } catch (error) {
    console.error(`Host event "${event}" failed:`, error);
  }
}


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

I18N.translateDom();
bindPlayerUi();
restoreSession();

globalThis.getPlayerState = function getPlayerState() {
  return { state: player.state, name: session.name, pin: session.pin, connected: connection.connected };
};
