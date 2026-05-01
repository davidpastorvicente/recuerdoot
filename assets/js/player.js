const socket = io();
let myName = "";
let answered = false;

const shapes = [
  `<svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,2 2,22 22,22" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>`,
  `<svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,2 22,12 12,22 2,12" fill="currentColor"/></svg>`,
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

function setResultState({ icon, text, textClass, pointsText }) {
  document.getElementById("result-icon").innerHTML = icon;
  document.getElementById("result-text").textContent = text;
  document.getElementById("result-text").className = `result-text ${textClass}`;
  document.getElementById("result-points").textContent = pointsText;
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
  showScreen("listen-screen");
  document.getElementById("listen-question-meta").textContent = `Pregunta ${data.index + 1} / ${data.total}`;
});

socket.on("player:question", (data) => {
  answered = false;
  showScreen("answer-screen");
  document.getElementById("player-question-meta").textContent = `Pregunta ${data.index + 1} / ${data.total}`;
  const grid = document.getElementById("player-answer-grid");
  grid.innerHTML = data.options.map((opt, i) =>
    `<button class="answer-choice player-answer" data-answer="${escapeHtml(opt)}"><span class="shape">${shapes[i]}</span>${escapeHtml(opt)}</button>`
  ).join("");
  grid.querySelectorAll(".player-answer").forEach((button) => {
    button.addEventListener("click", () => sendAnswer(button));
  });
});

function sendAnswer(btn) {
  if (answered) return;
  answered = true;
  const answer = btn.dataset.answer;
  socket.emit("player:answer", { answer });

  // Visual feedback
  document.querySelectorAll(".player-answer").forEach(b => {
    b.disabled = true;
    if (b !== btn) b.classList.add("dim");
    else b.classList.add("selected");
  });
}

socket.on("player:result", ({ isCorrect, points, score, streak, timeout }) => {
  showScreen("result-screen");
  if (timeout) {
    setResultState({
      icon: `<svg viewBox="0 0 64 64" width="64" height="64" role="img" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm0 6a2 2 0 0 0-2 2v14.8l8.4 5.6a2 2 0 1 0 2.2-3.3L34 30.8V18a2 2 0 0 0-2-2Zm-12.6-5.8a2 2 0 0 0 0 2.8l1.4 1.4a2 2 0 1 0 2.8-2.8l-1.4-1.4a2 2 0 0 0-2.8 0Zm24.8 0-1.4 1.4a2 2 0 1 0 2.8 2.8l1.4-1.4a2 2 0 0 0-2.8-2.8Z"/></svg>`,
      text: "Se acabo el tiempo",
      textClass: "result-wrong",
      pointsText: "",
    });
  } else if (isCorrect) {
    setResultState({
      icon: `<svg viewBox="0 0 64 64" width="64" height="64" role="img" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm10.4 14.6a2 2 0 0 0-2.8 0L28 36.2l-3.6-3.6a2 2 0 1 0-2.8 2.8l5 5a2 2 0 0 0 2.8 0l13-13a2 2 0 0 0 0-2.8Z"/></svg>`,
      text: "\u00A1Correcto!",
      textClass: "result-correct",
      pointsText: `+${points} puntos`,
    });
  } else {
    setResultState({
      icon: `<svg viewBox="0 0 64 64" width="64" height="64" role="img" focusable="false"><path fill="currentColor" d="M32 10a22 22 0 1 1 0 44 22 22 0 0 1 0-44Zm-7.4 14.6a2 2 0 0 0 0 2.8l4.6 4.6-4.6 4.6a2 2 0 1 0 2.8 2.8l4.6-4.6 4.6 4.6a2 2 0 1 0 2.8-2.8L34.8 32l4.6-4.6a2 2 0 0 0-2.8-2.8L32 29.2l-4.6-4.6a2 2 0 0 0-2.8 0Z"/></svg>`,
      text: "Incorrecto",
      textClass: "result-wrong",
      pointsText: "",
    });
  }
  document.getElementById("result-score").textContent = `${score} pts`;
  if (streak > 1) {
    document.getElementById("result-streak").textContent = `Racha de ${streak}`;
  } else {
    document.getElementById("result-streak").textContent = "";
  }
});

socket.on("game:end", ({ leaderboard }) => {
  showScreen("end-screen");
  const myIdx = leaderboard.findIndex(p => p.name === myName);
  const rank = myIdx + 1;
  const rankEl = document.getElementById("end-rank");
  const rankLabels = ["", "Primera posicion", "Segunda posicion", "Tercera posicion"];
  if (rank >= 1 && rank <= 3) {
    rankEl.innerHTML = `<span class="rank-badge rank-${rank}" aria-label="${rankLabels[rank]}">${rank}</span>`;
  } else {
    rankEl.textContent = `#${rank}`;
  }
  document.getElementById("end-position").textContent = rank === 1 ? "\u00A1Has ganado!" : `Puesto ${rank}`;
  document.getElementById("end-score").textContent = myIdx >= 0 ? `${leaderboard[myIdx].score} puntos` : "";
});

socket.on("player:gameOver", (msg) => {
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
document.querySelectorAll("#join-screen input").forEach(inp => {
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") joinGame(); });
});

bindPlayerUi();
