// ========== Shared ==========
const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const shapes = [
  `<svg viewBox="0 0 32 32" width="32" height="32"><polygon points="16,2 2,30 30,30" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><rect x="2" y="2" width="28" height="28" rx="4" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><polygon points="16,2 30,16 16,30 2,16" fill="white"/></svg>`,
];

const audio = document.getElementById("game-audio");
let isPlaying = false;
let countdownInterval = null;
let mode = null; // "solo" or "multi"

function setPlayButtonsPlaying(playing) {
  document.querySelectorAll(".play-btn").forEach((button) => {
    button.classList.toggle("playing", playing);
  });
}

function bindHostUi() {
  document.getElementById("start-solo-button").addEventListener("click", initSolo);
  document.getElementById("start-multiplayer-button").addEventListener("click", initMultiplayer);
  document.getElementById("lobby-start-button").addEventListener("click", lobbyStart);
  document.getElementById("host-play-btn").addEventListener("click", toggleAudio);
  document.getElementById("reveal-play-btn").addEventListener("click", toggleAudio);
  document.getElementById("solo-next-button").addEventListener("click", nextQuestion);
  document.getElementById("reveal-media-play-button").addEventListener("click", toggleAudio);
  document.getElementById("reveal-next-button").addEventListener("click", nextMultiplayerQuestion);
  document.getElementById("solo-restart-button").addEventListener("click", initSolo);
  document.getElementById("solo-back-button").addEventListener("click", backToStart);
  document.getElementById("multiplayer-back-button").addEventListener("click", backToStart);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById(id).scrollTop = 0;
}

function setQuestionScreenMode(isSolo) {
  document.getElementById("question-screen").classList.toggle("solo-mode", isSolo);
}

function backToStart() {
  stopAudioPlayback();
  clearInterval(countdownInterval);
  showScreen("start-screen");
}

function parseDate(key) {
  const m = key.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return { date: "", year: "" };
  return { date: `${parseInt(m[3])} ${months[parseInt(m[2]) - 1]} ${m[1]}`, year: m[1] };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toggleAudio() {
  if (isPlaying) {
    stopAudioPlayback();
  } else {
    audio.play();
    isPlaying = true;
    setPlayButtonsPlaying(true);
  }
}

function stopAudioPlayback() {
  audio.pause();
  isPlaying = false;
  setPlayButtonsPlaying(false);
}

function setHighlightedQuestionText(element, question) {
  const quoteMatch = question.match(/"([^"]+)"/);
  if (!quoteMatch) {
    element.textContent = question;
    return;
  }

  element.innerHTML = question.replace(
    `"${quoteMatch[1]}"`,
    `<span class="quote text-highlight-success">${quoteMatch[1]}</span>`
  );
}

audio.addEventListener("ended", () => {
  stopAudioPlayback();
});

function startCountdown(seconds, onEnd) {
  let remaining = seconds;
  const circumference = 2 * Math.PI * 44;
  const progressRing = document.getElementById("countdown-ring-progress");
  const num = document.getElementById("countdown-number");
  const container = document.getElementById("countdown-container");
  progressRing.style.transition = "none";
  progressRing.style.strokeDashoffset = "0";
  num.textContent = remaining;
  container.classList.toggle("urgent", remaining <= 5);
  progressRing.getBoundingClientRect();
  progressRing.style.transition = `stroke-dashoffset ${seconds}s linear`;
  progressRing.style.strokeDashoffset = circumference;

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      num.textContent = "0";
      container.classList.add("urgent");
      if (onEnd) onEnd();
      return;
    }
    num.textContent = remaining;
    container.classList.toggle("urgent", remaining <= 5);
  }, 1000);
}

function renderQuestion(data) {
  showScreen("question-screen");
  document.getElementById("question-counter").textContent = `${data.index + 1} / ${data.total}`;
  document.getElementById("question-progress-fill").style.width = `${((data.index + 1) / data.total) * 100}%`;
  document.getElementById("question-badge").style.display = "none";

  // Photo
  const questionImage = document.getElementById("question-image");
  if (data.image) {
    questionImage.src = data.image;
    questionImage.alt = "Imagen de la pregunta";
    questionImage.style.display = "";
  } else {
    questionImage.style.display = "none";
    questionImage.src = "";
  }

  setHighlightedQuestionText(document.getElementById("question-text"), data.question);

  // Audio area
  const audioArea = document.getElementById("host-audio-area");
  if (data.audioBefore && data.audioSrc) {
    audioArea.style.display = "";
    audio.src = data.audioSrc;
    audio.load();
    isPlaying = false;
    document.getElementById("host-play-btn").classList.remove("playing");
  } else {
    audioArea.style.display = "none";
  }

  // Options
  const tiles = document.getElementById("stage-answer-grid");
  tiles.innerHTML = data.options.map((opt, i) =>
    `<button class="answer-choice stage-answer" data-value="${escapeHtml(opt)}"><span class="shape">${shapes[i]}</span>${escapeHtml(opt)}</button>`
  ).join("");

  // Hide post-answer stuff
  document.getElementById("result-modal").classList.remove("show");
  document.getElementById("countdown-container").style.display = "";

  return tiles;
}

function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

function renderLeaderboard(containerId, list) {
  document.getElementById(containerId).innerHTML = list.map((p, i) =>
    `<div class="leaderboard-row" style="animation-delay:${i * 0.08}s">
      <span class="leaderboard-rank">${i + 1}</span>
      <span class="leaderboard-name">${p.name}</span>
      <span class="leaderboard-score">${p.score}</span>
    </div>`
  ).join("");
}

// ========== SOLO MODE ==========
let soloQuestions = [];
let soloCurrent = 0, soloScore = 0, soloCurrentQuestion = null, soloAnswered = false;

function buildSoloQuestion(entry) {
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
    afterAudio: after.audio ? `media/audios/${after.audio}` : null,
    afterImage: after.image ? `media/images/${after.image}` : null,
    image: before.image ? `media/images/${before.image}` : null,
  };
}

async function initSolo() {
  mode = "solo";
  setQuestionScreenMode(true);
  if (!soloQuestions.length) {
    const resp = await fetch("questions.json");
    soloQuestions = await resp.json();
  }
  soloCurrent = 0; soloScore = 0;
  soloLoadRound();
}

function soloLoadRound() {
  soloAnswered = false;
  const entry = soloQuestions[soloCurrent];
  soloCurrentQuestion = buildSoloQuestion(entry);

  const audioSrc = soloCurrentQuestion.audioFile;

  const data = {
    index: soloCurrent, total: soloQuestions.length,
    question: soloCurrentQuestion.question,
    options: soloCurrentQuestion.options, audioBefore: soloCurrentQuestion.audioBefore,
    audioSrc, image: soloCurrentQuestion.image,
  };

  document.getElementById("question-meta").textContent = `${soloScore} acierto${soloScore !== 1 ? 's' : ''}`;
  const tiles = renderQuestion(data);

  // No countdown in solo mode
  document.getElementById("countdown-container").style.display = "none";

  // Bind click handlers for solo
  tiles.querySelectorAll(".stage-answer").forEach(btn => {
    btn.onclick = () => soloAnswer(btn, btn.dataset.value);
  });

  if (data.audioBefore) {
    document.getElementById("countdown-number").textContent = "\u00B7\u00B7\u00B7";
    const progressRing = document.getElementById("countdown-ring-progress");
    progressRing.style.transition = "none"; progressRing.style.strokeDashoffset = "0";

    setTimeout(() => {
      audio.play(); isPlaying = true;
      document.getElementById("host-play-btn").classList.add("playing");
      audio.onended = () => {
        isPlaying = false;
        document.getElementById("host-play-btn").classList.remove("playing");
        audio.onended = stopAudioPlayback;
      };
    }, 3000);
  }
}

function soloAnswer(btn, selected) {
  if (soloAnswered) return;
  soloAnswered = true;
  const correct = soloCurrentQuestion.correct;

  document.querySelectorAll(".stage-answer").forEach(b => {
    b.disabled = true;
    if (b.dataset.value === correct) b.classList.add("answer-correct");
    else b.classList.add("dim");
    if (b.dataset.value === selected && selected !== correct) {
      b.classList.remove("dim"); b.classList.add("answer-wrong");
    }
  });

  const statusEl = document.getElementById("result-modal-status");
  const detailEl = document.getElementById("result-modal-detail");
  if (selected === correct) {
    soloScore++;
    statusEl.className = "correct";
    statusEl.textContent = "¡Correcto!";
    detailEl.style.display = "none";
    detailEl.textContent = "";
    detailEl.innerHTML = "";
  } else {
    statusEl.className = "wrong";
    statusEl.textContent = "¡Incorrecto!";
    detailEl.style.display = "block";
    detailEl.innerHTML = `La respuesta correcta era <span class="text-highlight-success">${escapeHtml(correct)}</span>.`;
  }
  document.getElementById("question-meta").textContent = `${soloScore} acierto${soloScore !== 1 ? 's' : ''}`;

  // Show after media in modal
  const revealImg = document.getElementById("reveal-image");
  const mediaEl = document.getElementById("result-modal-media");
  const audioRow = document.getElementById("result-modal-audio-row");
  const hasAfterImage = !!soloCurrentQuestion.afterImage;
  const hasAfterAudio = !!soloCurrentQuestion.afterAudio;

  mediaEl.style.display = hasAfterImage || hasAfterAudio ? "flex" : "none";
  if (hasAfterImage) {
    revealImg.src = soloCurrentQuestion.afterImage;
    revealImg.alt = "Imagen revelada tras responder";
    revealImg.style.display = "";
  } else {
    revealImg.style.display = "none";
  }
  if (hasAfterAudio) {
    stopAudioPlayback();
    audio.src = soloCurrentQuestion.afterAudio;
    audio.load();
    document.getElementById("reveal-play-btn").style.display = "";
    const entry = soloQuestions[soloCurrent];
    const { date } = parseDate(entry.after.audio);
    document.getElementById("reveal-label").innerHTML = `${date}`;
    audioRow.style.display = "";
  } else {
    document.getElementById("reveal-play-btn").style.display = "none";
    document.getElementById("reveal-label").innerHTML = "";
    audioRow.style.display = "none";
  }

  document.getElementById("solo-next-button").textContent =
    soloCurrent < soloQuestions.length - 1 ? "Siguiente" : "Ver resultado";
  document.getElementById("result-modal").classList.add("show");
}

function nextQuestion() {
  if (mode === "solo") {
    stopAudioPlayback();
    soloCurrent++;
    if (soloCurrent >= soloQuestions.length) soloEnd();
    else soloLoadRound();
  }
}

function soloEnd() {
  showScreen("solo-end-screen");
  const total = soloQuestions.length;
  document.getElementById("final-score").textContent = `${soloScore} / ${total}`;
  const pct = soloScore / total;
  let msg;
  if (pct === 1) msg = "Memoria perfecta. Conocéis a vuestras amigas mejor que nadie.";
  else if (pct >= 0.75) msg = "¡Muy bien! Casi acertáis todas.";
  else if (pct >= 0.5) msg = "No está mal, ¡pero hay que repasar esos audios!";
  else msg = "Uy... ¡toca volver a escuchar esos audios!";
  document.getElementById("end-message").textContent = msg;
}

// ========== MULTIPLAYER MODE ==========
let socket = null;
let multiplayerCurrentQuestion = null;

function initMultiplayer() {
  mode = "multi";
  setQuestionScreenMode(false);
  if (!socket) socket = io();
  socket.emit("host:create");

  socket.on("host:created", ({ pin }) => {
    showScreen("lobby");
    document.getElementById("pin-display").textContent = pin;
    const joinUrl = `${location.origin}/player.html?pin=${pin}`;
    const joinEl = document.getElementById("join-url");
    joinEl.textContent = `${location.host}/player.html`;
    joinEl.href = joinUrl;
    new QRious({ element: document.getElementById("qr-canvas"), value: joinUrl, size: 200, backgroundAlpha: 0, foreground: "#ffffff" });
  });

  socket.on("host:playerList", (players) => {
    const grid = document.getElementById("player-grid");
    grid.innerHTML = players.map(p => `<div class="player-chip">${p.name}</div>`).join("");
    const startButton = document.getElementById("lobby-start-button");
    startButton.disabled = players.length === 0;
    startButton.textContent = players.length > 0 ? `Empezar (${players.length} jugador${players.length > 1 ? 'es' : ''})` : "Esperando jugadores...";
  });

  socket.on("host:question", (data) => {
    multiplayerCurrentQuestion = data;
    document.getElementById("question-meta").textContent = "0 respuestas";
    renderQuestion(data);

    // In multiplayer, tiles are NOT clickable
    document.querySelectorAll(".stage-answer").forEach(b => b.onclick = null);

    if (data.audioBefore) {
      document.getElementById("countdown-number").textContent = "5";
      document.getElementById("countdown-container").classList.remove("urgent");
      const progressRing = document.getElementById("countdown-ring-progress");
      progressRing.style.transition = "none"; progressRing.style.strokeDashoffset = "0";
      document.getElementById("question-meta").textContent = "Escuchad...";

      setTimeout(() => {
        audio.play(); isPlaying = true;
        document.getElementById("host-play-btn").classList.add("playing");
        audio.onended = () => {
          isPlaying = false;
          document.getElementById("host-play-btn").classList.remove("playing");
          document.getElementById("question-meta").textContent = "0 respuestas";
          startCountdown(5, () => socket.emit("host:timeUp"));
          socket.emit("host:answersOpen");
        };
      }, 3000);
    } else {
      startCountdown(data.countdown, () => socket.emit("host:timeUp"));
    }
  });

  socket.on("host:answerCount", ({ answered, total }) => {
    document.getElementById("question-meta").textContent = `${answered} / ${total} respuestas`;
  });

  socket.on("host:reveal", (data) => {
    clearInterval(countdownInterval);
    stopAudioPlayback();

    showScreen("reveal-screen");
    document.getElementById("reveal-badge").style.display = "none";

    setHighlightedQuestionText(document.getElementById("reveal-text"), multiplayerCurrentQuestion.question);

    // Bar chart
    const maxCount = Math.max(1, ...multiplayerCurrentQuestion.options.map(option => data.optionCounts[option] || 0));
    document.getElementById("reveal-chart").innerHTML = multiplayerCurrentQuestion.options.map((opt, i) => {
      const count = data.optionCounts[opt] || 0;
      const isCorrect = opt === data.correct;
      const heightPct = count > 0 ? Math.max(10, (count / maxCount) * 100) : 4;
      return `<div class="bar-col">
        <div class="bar-check">${isCorrect ? "\u2714" : ""}</div>
        <div class="bar-count">${count}</div>
        <div class="bar-fill c${i} ${isCorrect ? "" : "dim-bar"}" style="height:${heightPct}%"></div>
        <div class="bar-base c${i}">${shapes[i]} ${escapeHtml(opt)}</div>
      </div>`;
    }).join("");

    // Reveal image
    const revealImage = document.getElementById("reveal-media-image");
    if (data.afterImage) {
      revealImage.src = data.afterImage;
      revealImage.alt = "Imagen revelada de la pregunta";
      revealImage.style.display = "";
    } else {
      revealImage.style.display = "none";
    }

    // Reveal audio
    const revealInfo = document.getElementById("reveal-media");
    if (data.afterAudio) {
      revealInfo.classList.add("show");
      audio.src = data.afterAudio;
      audio.load();
      isPlaying = false;
      document.getElementById("reveal-media-play-button").classList.remove("playing");
      document.getElementById("reveal-media-label").innerHTML = data.date || "";
    } else {
      revealInfo.classList.remove("show");
    }

    renderLeaderboard("reveal-leaderboard", data.leaderboard);
    document.getElementById("reveal-next-button").textContent =
      multiplayerCurrentQuestion.index < multiplayerCurrentQuestion.total - 1 ? "Siguiente" : "Ver resultados";
  });

  socket.on("game:end", ({ leaderboard }) => {
    clearInterval(countdownInterval);
    stopAudioPlayback();
    showScreen("multiplayer-end-screen");
    if (leaderboard.length > 0) {
      document.getElementById("winner-name").textContent = leaderboard[0].name;
      document.getElementById("winner-score").textContent = `${leaderboard[0].score} puntos`;
    }
    renderLeaderboard("end-leaderboard", leaderboard);
  });
}

function lobbyStart() {
  if (socket) socket.emit("host:start");
}

function nextMultiplayerQuestion() {
  stopAudioPlayback();
  if (socket) socket.emit("host:next");
}

bindHostUi();
