const socket = io();
let myName = "";
let answered = false;
let startCountdownInterval = null;

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

  document.getElementById("join-button").disabled = true;
  socket.emit("player:join", { pin, name });
}

function bindPlayerUi() {
  document.getElementById("join-button").addEventListener("click", joinGame);
  document.getElementById("player-reload-button").addEventListener("click", () => location.reload());
}

function clearStartCountdownTimer() {
  clearTimeout(startCountdownInterval);
  startCountdownInterval = null;
}

function swapStartCountdownDigit(value) {
  const digits = Array.from(document.querySelectorAll("#start-countdown-number .start-countdown-digit"));
  const activeDigit = digits.find((digit) => digit.classList.contains("active")) || digits[0];
  const nextDigit = digits.find((digit) => digit !== activeDigit) || digits[1];

  nextDigit.textContent = String(value);
  nextDigit.classList.remove("exit");
  void nextDigit.offsetWidth;
  nextDigit.classList.add("active");

  activeDigit.classList.remove("active");
  activeDigit.classList.add("exit");
}

function getStartCountdownLabel(seconds, remaining) {
  if (remaining <= 1) return "\u00A1YA!";
  return remaining > Math.ceil(seconds / 2) ? "Preparados" : "Listos";
}

function showStartCountdown(seconds, startsAt = Date.now()) {
  const overlay = document.getElementById("start-countdown-overlay");
  const label = document.getElementById("start-countdown-label");
  const digits = Array.from(document.querySelectorAll("#start-countdown-number .start-countdown-digit"));

  clearStartCountdownTimer();
  digits[0].textContent = String(seconds);
  digits[0].classList.add("active");
  digits[0].classList.remove("exit");
  digits[1].classList.remove("active", "exit");

  const renderTick = () => {
    const elapsedSteps = Math.floor(Math.max(0, Date.now() - startsAt) / 1000);
    if (elapsedSteps >= seconds) {
      hideStartCountdown();
      return;
    }

    const remaining = seconds - elapsedSteps;
    overlay.classList.add("show");
    label.textContent = getStartCountdownLabel(seconds, remaining);
    swapStartCountdownDigit(remaining);

    const nextTickAt = startsAt + ((elapsedSteps + 1) * 1000);
    startCountdownInterval = setTimeout(renderTick, Math.max(0, nextTickAt - Date.now()));
  };

  startCountdownInterval = setTimeout(renderTick, Math.max(0, startsAt - Date.now()));
}

function hideStartCountdown() {
  clearStartCountdownTimer();
  document.getElementById("start-countdown-overlay").classList.remove("show");
  document.getElementById("start-countdown-label").textContent = "";
  document.querySelectorAll("#start-countdown-number .start-countdown-digit").forEach((digit) => {
    digit.classList.remove("active", "exit");
    digit.textContent = "";
  });
}

function setResultState({ icon, text, textClass, pointsText }) {
  document.getElementById("result-icon").innerHTML = icon;
  document.getElementById("result-text").textContent = text;
  document.getElementById("result-text").className = `result-text ${textClass}`;
  document.getElementById("result-points").textContent = pointsText;
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
  document.getElementById("error-msg").textContent = msg;
  document.getElementById("join-button").disabled = false;
});

socket.on("player:joined", ({ name }) => {
  myName = name;
  document.getElementById("my-name").textContent = name;
  showScreen("waiting-screen");
});

socket.on("player:wait", (data) => {
  hideStartCountdown();
  showScreen("listen-screen");
  document.getElementById("listen-question-meta").textContent = `Pregunta ${data.index + 1} de ${data.total}`;
});

socket.on("game:startCountdown", ({ seconds, startsAt }) => {
  showStartCountdown(seconds, startsAt);
});

socket.on("player:question", (data) => {
  answered = false;
  hideStartCountdown();
  showScreen("answer-screen");
  const grid = document.getElementById("player-answer-grid");
  grid.dataset.optionCount = String(data.options.length);
  grid.innerHTML = data.options.map((opt, i) =>
    `<button class="answer-choice player-answer" data-answer="${escapeHtml(opt)}" aria-label="${escapeHtml(opt)}"><span class="shape">${shapes[i]}</span><span class="player-answer-label">${escapeHtml(opt)}</span></button>`
  ).join("");
  grid.querySelectorAll(".player-answer").forEach((button) => {
    button.addEventListener("click", () => sendAnswer(button));
  });
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

socket.on("player:result", ({ isCorrect, points, score, streak, timeout }) => {
  hideStartCountdown();
  showScreen("result-screen");
  setResultState(getResultState({ isCorrect, points, timeout }));
  document.getElementById("result-score").textContent = `${score} pts`;
  document.getElementById("result-streak").textContent = streak > 1 ? `Racha de ${streak}` : "";
});

socket.on("game:end", ({ leaderboard }) => {
  hideStartCountdown();
  showScreen("end-screen");
  const myIndex = leaderboard.findIndex((player) => player.name === myName);
  const rank = myIndex + 1;
  const rankEl = document.getElementById("end-rank");
  const rankLabels = ["", "Primera posicion", "Segunda posicion", "Tercera posicion"];
  if (rank >= 1 && rank <= 3) {
    rankEl.innerHTML = `<span class="rank-badge rank-${rank}" aria-label="${rankLabels[rank]}">${rank}</span>`;
  } else {
    rankEl.textContent = `#${rank}`;
  }
  document.getElementById("end-position").textContent = rank === 1 ? "\u00A1Has ganado!" : `Puesto ${rank}`;
  document.getElementById("end-score").textContent = myIndex >= 0 ? `${leaderboard[myIndex].score} puntos` : "";
});

socket.on("player:gameOver", (msg) => {
  hideStartCountdown();
  showScreen("end-screen");
  document.getElementById("end-rank").textContent = "";
  document.getElementById("end-position").textContent = msg;
  document.getElementById("end-score").textContent = "";
});

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

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
