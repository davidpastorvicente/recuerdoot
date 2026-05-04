const socket = io();
let myName = "";
let currentPin = "";
let playerId = "";
let answered = false;
const { createStartCountdownController, escapeHtml } = window.RECUERDOOT_SHARED;
const { showStartCountdown, hideStartCountdown } = createStartCountdownController();
const PLAYER_SESSION_KEY = "recuerdoot-player-session";

function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(session) {
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

function setJoinButtonDisabled(disabled) {
  document.getElementById("join-button").disabled = disabled;
}

function populateJoinForm(session) {
  if (!session) return;
  if (session.pin) document.getElementById("pin-input").value = session.pin;
  if (session.name) document.getElementById("name-input").value = session.name;
}

function restoreSelectedAnswer(answer) {
  if (!answer) return;

  document.querySelectorAll(".player-answer").forEach((button) => {
    button.disabled = true;
    if (button.dataset.answer !== answer) {
      button.classList.add("dim");
      return;
    }

    button.classList.add("selected");
  });
}

function tryAutoRejoin() {
  const session = getStoredSession();
  if (!session?.pin || !session?.name || !session?.playerId) return;

  myName = session.name;
  currentPin = session.pin;
  playerId = session.playerId;
  populateJoinForm(session);
  setJoinButtonDisabled(true);
}

const shapes = [
  `<svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,2 2,22 22,22" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,2 22,12 12,22 2,12" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,2 22,9 18,22 6,22 2,9" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><polygon points="2,3 22,3 12,22" fill="currentColor"/></svg>`,
];

function joinGame() {
  const pin = document.getElementById("pin-input").value.trim();
  const name = document.getElementById("name-input").value.trim();
  const errorEl = document.getElementById("error-msg");
  errorEl.textContent = "";

  if (!pin || pin.length < 4) {
    errorEl.textContent = "Introduce un PIN";
    return;
  }

  if (!name) {
    errorEl.textContent = "Introduce tu nombre";
    return;
  }

  currentPin = pin;
  myName = name;
  setJoinButtonDisabled(true);
  socket.emit("player:join", { pin, name, playerId: playerId || undefined });
}

function bindPlayerUi() {
  document.getElementById("join-button").addEventListener("click", joinGame);
  document.getElementById("player-reload-button").addEventListener("click", () => location.reload());
}

function setResultState({ icon, text, textClass, pointsText }) {
  document.getElementById("result-icon").innerHTML = icon;
  document.getElementById("result-text").textContent = text;
  document.getElementById("result-text").className = `result-text ${textClass}`;
  document.getElementById("result-points").textContent = pointsText;
}

function renderRankBadge(containerId, rank) {
  const container = document.getElementById(containerId);
  const rankLabels = ["", "Primera posicion", "Segunda posicion", "Tercera posicion"];

  if (!rank || rank < 1) {
    container.textContent = "";
    return;
  }

  if (rank <= 3) {
    container.innerHTML = `<span class="rank-badge rank-${rank}" aria-label="${rankLabels[rank]}">${rank}</span>`;
    return;
  }

  container.textContent = `#${rank}`;
}

function getResultState({ isCorrect, points, timeout }) {
  if (timeout) {
    return {
      icon: `<svg viewBox="0 0 64 64" width="64" height="64" role="img" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm0 6a2 2 0 0 0-2 2v14.8l8.4 5.6a2 2 0 1 0 2.2-3.3L34 30.8V18a2 2 0 0 0-2-2Zm-12.6-5.8a2 2 0 0 0 0 2.8l1.4 1.4a2 2 0 1 0 2.8-2.8l-1.4-1.4a2 2 0 0 0-2.8 0Zm24.8 0-1.4 1.4a2 2 0 1 0 2.8 2.8l1.4-1.4a2 2 0 0 0-2.8-2.8Z"/></svg>`,
      text: "Se acabo el tiempo",
      textClass: "result-wrong",
      pointsText: "",
    };
  }

  if (isCorrect) {
    return {
      icon: `<svg viewBox="0 0 64 64" width="64" height="64" role="img" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm10.4 14.6a2 2 0 0 0-2.8 0L28 36.2l-3.6-3.6a2 2 0 1 0-2.8 2.8l5 5a2 2 0 0 0 2.8 0l13-13a2 2 0 0 0 0-2.8Z"/></svg>`,
      text: "¡Correcto!",
      textClass: "result-correct",
      pointsText: `+${points} puntos`,
    };
  }

  return {
    icon: `<svg viewBox="0 0 64 64" width="64" height="64" role="img" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm-7.4 14.6a2 2 0 0 0 0 2.8l4.6 4.6-4.6 4.6a2 2 0 1 0 2.8 2.8l4.6-4.6 4.6 4.6a2 2 0 1 0 2.8-2.8L34.8 32l4.6-4.6a2 2 0 0 0-2.8-2.8L32 29.2l-4.6-4.6a2 2 0 0 0-2.8 0Z"/></svg>`,
    text: "Incorrecto",
    textClass: "result-wrong",
    pointsText: "",
  };
}

socket.on("player:error", (msg) => {
  if (playerId) {
    playerId = "";
    currentPin = "";
    clearSession();
  }
  document.getElementById("error-msg").textContent = msg;
  setJoinButtonDisabled(false);
  showScreen("join-screen");
});

socket.on("player:joined", ({ name, pin, playerId: joinedPlayerId }) => {
  myName = name;
  currentPin = pin;
  playerId = joinedPlayerId;
  storeSession({ pin, name, playerId: joinedPlayerId });
  document.getElementById("my-name").textContent = name;
  document.getElementById("error-msg").textContent = "";
  showScreen("waiting-screen");
});

socket.on("player:wait", (data) => {
  hideStartCountdown();
  showScreen("listen-screen");
  document.getElementById("listen-question-meta").textContent = `Pregunta ${data.index + 1} de ${data.total}`;
});

socket.on("game:startCountdown", ({ seconds, startsAt }) => {
  showStartCountdown(seconds, { startsAt });
});

socket.on("player:question", (data) => {
  answered = !!data.hasAnswered;
  hideStartCountdown();
  showScreen("answer-screen");
  document.getElementById("listen-question-meta").textContent = `Pregunta ${data.index + 1} de ${data.total}`;
  const grid = document.getElementById("player-answer-grid");
  grid.dataset.optionCount = String(data.options.length);
  grid.innerHTML = data.options.map((opt, i) =>
    `<button class="answer-choice player-answer" data-answer="${escapeHtml(opt)}" aria-label="${escapeHtml(opt)}"><span class="shape">${shapes[i]}</span><span class="player-answer-label">${escapeHtml(opt)}</span></button>`
  ).join("");
  grid.querySelectorAll(".player-answer").forEach((button) => {
    button.addEventListener("click", () => sendAnswer(button));
  });

  if (data.hasAnswered && data.selectedAnswer) {
    restoreSelectedAnswer(data.selectedAnswer);
  }
});

function sendAnswer(button) {
  if (answered) return;
  answered = true;
  const answer = button.dataset.answer;
  socket.emit("player:answer", { answer });

  // Visual feedback
  document.querySelectorAll(".player-answer").forEach((answerButton) => {
    answerButton.disabled = true;
    if (answerButton !== button) answerButton.classList.add("dim");
    else answerButton.classList.add("selected");
  });
}

socket.on("player:result", ({ isCorrect, points, rank, score, streak, timeout }) => {
  hideStartCountdown();
  showScreen("result-screen");
  setResultState(getResultState({ isCorrect, points, timeout }));
  renderRankBadge("result-rank", rank);
  document.getElementById("result-position").textContent = rank ? `Vas en el puesto ${rank}` : "";
  document.getElementById("result-score").textContent = `${score} pts`;
  document.getElementById("result-streak").textContent = streak > 1 ? `Racha de ${streak}` : "";
});

socket.on("game:end", ({ leaderboard }) => {
  hideStartCountdown();
  clearSession();
  showScreen("end-screen");
  const myIndex = leaderboard.findIndex((player) => player.name === myName);
  const rank = myIndex + 1;
  renderRankBadge("end-rank", rank);
  document.getElementById("end-position").textContent = rank === 1 ? "\u00A1Has ganado!" : `Puesto ${rank}`;
  document.getElementById("end-score").textContent = myIndex >= 0 ? `${leaderboard[myIndex].score} puntos` : "";
});

socket.on("player:gameOver", (msg) => {
  hideStartCountdown();
  clearSession();
  showScreen("end-screen");
  document.getElementById("end-rank").textContent = "";
  document.getElementById("end-position").textContent = msg;
  document.getElementById("end-score").textContent = "";
});

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

socket.on("connect", () => {
  if (playerId) {
    socket.emit("player:join", { pin: currentPin, name: myName, playerId });
  }
});

// Auto-fill PIN from URL query param
const urlPin = new URLSearchParams(location.search).get("pin");
const pinInput = document.getElementById("pin-input");
if (urlPin) {
  pinInput.value = urlPin;
  pinInput.readOnly = true;
  pinInput.style.opacity = "0.7";
  document.getElementById("name-input").focus();
} else {
  pinInput.focus();
}

// Allow Enter to submit
document.querySelectorAll("#join-screen input").forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") joinGame();
  });
});

bindPlayerUi();
populateJoinForm(getStoredSession());
tryAutoRejoin();
