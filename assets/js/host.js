// ========== Shared ==========
const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const shapes = [
  `<svg viewBox="0 0 32 32" width="32" height="32"><polygon points="16,2 2,30 30,30" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><rect x="2" y="2" width="28" height="28" rx="4" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><polygon points="16,2 30,16 16,30 2,16" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><polygon points="16,2 29,12 24,28 8,28 3,12" fill="white"/></svg>`,
  `<svg viewBox="0 0 32 32" width="32" height="32"><polygon points="2,4 30,4 16,30" fill="white"/></svg>`,
];

const audio = document.getElementById("game-audio");
const backgroundMusic = document.getElementById("background-music");
let isPlaying = false;
let countdownInterval = null;
let mode = null; // "solo" or "multi"
let startCountdownInterval = null;
let scoreboardTransitionTimer = null;

backgroundMusic.volume = 0.22;

function clearStartCountdownTimer() {
  clearTimeout(startCountdownInterval);
  startCountdownInterval = null;
}

function clearScoreboardTransitionTimer() {
  clearTimeout(scoreboardTransitionTimer);
  scoreboardTransitionTimer = null;
}

function setPlayButtonsPlaying(playing) {
  document.querySelectorAll(".play-button").forEach((button) => {
    button.classList.toggle("playing", playing);
  });
}

function bindHostUi() {
  document.getElementById("start-solo-button").addEventListener("click", initSolo);
  document.getElementById("start-multiplayer-button").addEventListener("click", initMultiplayer);
  document.getElementById("lobby-start-button").addEventListener("click", lobbyStart);
  document.getElementById("host-play-button").addEventListener("click", toggleAudio);
  document.getElementById("reveal-play-button").addEventListener("click", toggleAudio);
  document.getElementById("solo-next-button").addEventListener("click", nextQuestion);
  document.getElementById("reveal-media-play-button").addEventListener("click", toggleAudio);
  document.getElementById("reveal-next-button").addEventListener("click", nextMultiplayerQuestion);
  document.getElementById("scoreboard-next-button").addEventListener("click", nextMultiplayerQuestion);
  document.getElementById("solo-restart-button").addEventListener("click", initSolo);
  document.getElementById("solo-back-button").addEventListener("click", backToStart);
  document.getElementById("multiplayer-back-button").addEventListener("click", backToStart);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.querySelectorAll("video").forEach((video) => {
    stopVideoPlayback(video);
  });
  stopBackgroundMusic();
  document.getElementById(id).classList.add("active");
  document.getElementById(id).scrollTop = 0;
}

function backToStart() {
  stopAudioPlayback();
  clearInterval(countdownInterval);
  clearStartCountdownTimer();
  clearScoreboardTransitionTimer();
  hideStartCountdown();
  showScreen("start-screen");
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

function showStartCountdown(seconds, options = {}) {
  const { startsAt = Date.now(), onEnd = null } = options;
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
      if (onEnd) onEnd();
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

function playBackgroundMusic(source) {
  if (!source) {
    stopBackgroundMusic();
    return;
  }

  if (backgroundMusic.getAttribute("src") !== source) {
    backgroundMusic.src = source;
    backgroundMusic.load();
  }

  backgroundMusic.currentTime = 0;
  backgroundMusic.play().catch(() => {});
}

function stopBackgroundMusic() {
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  backgroundMusic.removeAttribute("src");
  backgroundMusic.load();
}

function stopVideoPlayback(video) {
  video.pause();
  video.currentTime = 0;
}

function setMediaElementSource(element, source) {
  const isVideo = element.tagName === "VIDEO";

  if (source) {
    element.src = source;
    element.style.display = "";
    if (isVideo) {
      element.load();
    }
    return;
  }

  if (isVideo) {
    element.pause();
  }
  element.removeAttribute("src");
  if (isVideo) {
    element.load();
  }
  element.style.display = "none";
}

function formatSoloCounter() {
  return `Pregunta ${soloCurrent + 1} de ${soloQuestions.length}`;
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
  document.getElementById("question-counter").textContent = `Pregunta ${data.index + 1} de ${data.total}`;
  playBackgroundMusic(data.music);

  // Visual media
  const questionImage = document.getElementById("question-image");
  const questionVideo = document.getElementById("question-video");
  questionImage.alt = "Imagen de la pregunta";
  setMediaElementSource(questionImage, data.image);
  setMediaElementSource(questionVideo, data.video);

  setHighlightedQuestionText(document.getElementById("question-text"), data.question);

  // Audio area
  const audioArea = document.getElementById("host-audio-area");
  if (data.audioBefore && data.audioSrc) {
    audioArea.style.display = "";
    audio.src = data.audioSrc;
    audio.load();
    isPlaying = false;
    document.getElementById("host-play-button").classList.remove("playing");
  } else {
    audioArea.style.display = "none";
  }

  // Options
  const tiles = document.getElementById("stage-answer-grid");
  tiles.dataset.optionCount = String(data.options.length);
  tiles.innerHTML = data.options.map((opt, i) =>
    `<button class="answer-choice stage-answer" data-value="${escapeHtml(opt)}"><span class="shape">${shapes[i]}</span>${escapeHtml(opt)}</button>`
  ).join("");

  // Hide post-answer stuff
  document.getElementById("result-modal").classList.remove("show");
  document.getElementById("countdown-container").style.display = "";

  // Answer count: show only in multiplayer
  const answerCountEl = document.getElementById("answer-count");
  if (mode === "multi") {
    answerCountEl.classList.add("show");
    document.getElementById("answer-count-number").textContent = "0";
  } else {
    answerCountEl.classList.remove("show");
  }

  return tiles;
}

function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

function cloneLeaderboard(list) {
  return list.map((player) => ({ ...player }));
}

function getLeaderboardMovement(previousList, nextList) {
  const previousRanks = new Map(previousList.map((player, index) => [player.name, index]));

  return new Map(nextList.map((player, index) => {
    const previousRank = previousRanks.get(player.name);
    if (previousRank === undefined) return [player.name, { direction: "new", places: 0 }];
    if (previousRank > index) return [player.name, { direction: "up", places: previousRank - index }];
    if (previousRank < index) return [player.name, { direction: "down", places: index - previousRank }];
    return [player.name, { direction: "same", places: 0 }];
  }));
}

function buildLeaderboardMovementBadge(movement) {
  if (!movement || movement.direction === "same") {
    return '<span class="leaderboard-movement leaderboard-movement-idle"></span>';
  }

  if (movement.direction === "new") {
    return '<span class="leaderboard-movement leaderboard-movement-new">NUEVO</span>';
  }

  const label = movement.direction === "up" ? "▲" : "▼";
  const movementClass = movement.direction === "up" ? "leaderboard-movement-up" : "leaderboard-movement-down";
  return `<span class="leaderboard-movement ${movementClass}">${label} ${movement.places}</span>`;
}

function buildLeaderboardRow(player, rank, movement = null) {
  return `<span class="leaderboard-rank">${rank}</span>
    <span class="leaderboard-name">${escapeHtml(player.name)}</span>
    ${buildLeaderboardMovementBadge(movement)}
    <span class="leaderboard-score" data-score="${player.score}">${player.score}</span>`;
}

function animateLeaderboardScores(container, previousList, nextList) {
  const previousScores = new Map(previousList.map((player) => [player.name, player.score]));

  nextList.forEach((player) => {
    const row = container.querySelector(`.leaderboard-row[data-player-name="${CSS.escape(player.name)}"]`);
    const scoreEl = row?.querySelector(".leaderboard-score");
    if (!scoreEl) return;

    const startScore = previousScores.get(player.name) ?? 0;
    const endScore = player.score;

    scoreEl.textContent = String(startScore);
    if (startScore === endScore) {
      scoreEl.dataset.score = String(endScore);
      return;
    }

    const scoreAnimation = scoreEl.animate(
      [
        { opacity: 0.85, transform: "scale(0.98)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        duration: 2000,
        easing: "linear",
        fill: "both",
      }
    );

    const startedAt = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startedAt) / 2000, 1);
      const currentScore = Math.round(startScore + ((endScore - startScore) * progress));
      scoreEl.textContent = String(currentScore);

      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }

      scoreEl.textContent = String(endScore);
      scoreEl.dataset.score = String(endScore);
      scoreAnimation.cancel();
    };

    requestAnimationFrame(step);
  });
}

function renderLeaderboard(containerId, list, options = {}) {
  const { movementMap = new Map() } = options;
  const container = document.getElementById(containerId);

  if (containerId !== "scoreboard-leaderboard") {
    container.innerHTML = list.map((player, i) =>
      `<div class="leaderboard-row leaderboard-row-appear" style="animation-delay:${i * 0.08}s">${buildLeaderboardRow(player, i + 1, movementMap.get(player.name))}</div>`
    ).join("");
    return;
  }

  const existingRows = new Map(
    Array.from(container.querySelectorAll(".leaderboard-row")).map((row) => [row.dataset.playerName, row])
  );
  const previousTop = new Map(
    Array.from(existingRows.values()).map((row) => [row.dataset.playerName, row.getBoundingClientRect().top])
  );
  const orderedRows = [];

  list.forEach((player, i) => {
    let row = existingRows.get(player.name);

    if (!row) {
      row = document.createElement("div");
      row.className = "leaderboard-row leaderboard-row-enter";
      row.dataset.playerName = player.name;
    }

    row.innerHTML = buildLeaderboardRow(player, i + 1, movementMap.get(player.name));
    row.classList.toggle("leaderboard-row-moved", previousTop.has(player.name) && list.length > 1);
    row.classList.toggle("leaderboard-row-up", movementMap.get(player.name)?.direction === "up");
    row.classList.toggle("leaderboard-row-down", movementMap.get(player.name)?.direction === "down");
    orderedRows.push(row);
  });

  container.replaceChildren(...orderedRows);

  requestAnimationFrame(() => {
    orderedRows.forEach((row) => {
      const previousRowTop = previousTop.get(row.dataset.playerName);
      if (previousRowTop === undefined) {
        row.classList.add("leaderboard-row-enter-active");
        return;
      }

      const currentTop = row.getBoundingClientRect().top;
      const deltaY = previousRowTop - currentTop;

      if (Math.abs(deltaY) < 1) {
        row.classList.remove("leaderboard-row-moved");
        return;
      }

      row.getAnimations().forEach((animation) => animation.cancel());
      row.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: "translateY(0)" },
        ],
        {
          duration: 2000,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        }
      );
    });
  });
}

function showScoreboardTransition(previousList, nextList) {
  const scoreboardButton = document.getElementById("scoreboard-next-button");
  const scoreboardLeaderboard = document.getElementById("scoreboard-leaderboard");
  const previousLeaderboard = previousList.length ? cloneLeaderboard(previousList) : cloneLeaderboard(nextList);
  const nextLeaderboard = cloneLeaderboard(nextList);
  const movementMap = getLeaderboardMovement(previousLeaderboard, nextLeaderboard);

  clearScoreboardTransitionTimer();
  showScreen("scoreboard-screen");
  scoreboardButton.disabled = true;
  renderLeaderboard("scoreboard-leaderboard", previousLeaderboard);

  scoreboardTransitionTimer = setTimeout(() => {
    renderLeaderboard("scoreboard-leaderboard", nextLeaderboard, { movementMap });
    animateLeaderboardScores(scoreboardLeaderboard, previousLeaderboard, nextLeaderboard);
    scoreboardButton.disabled = false;
  }, 850);
}

function renderRevealChart(revealData) {
  const revealChart = document.getElementById("reveal-chart");
  revealChart.dataset.optionCount = String(multiplayerCurrentQuestion.options.length);
  const maxCount = Math.max(1, ...multiplayerCurrentQuestion.options.map((option) => revealData.optionCounts[option] || 0));
  revealChart.innerHTML = multiplayerCurrentQuestion.options.map((option, i) => {
    const count = revealData.optionCounts[option] || 0;
    const isCorrect = option === revealData.correct;
    const heightPercent = count > 0 ? Math.max(10, (count / maxCount) * 100) : 4;

    return `<div class="bar-col">
      <div class="bar-check ${isCorrect ? "" : "hidden"}">${isCorrect ? "\u2714" : ""}</div>
      <div class="bar-count">${count}</div>
      <div class="bar-track">
        <div class="bar-fill c${i} ${isCorrect ? "" : "dim-bar"}" style="height:${heightPercent}%"></div>
      </div>
      <div class="bar-base c${i}">${shapes[i]} ${escapeHtml(option)}</div>
    </div>`;
  }).join("");
}

function updateRevealMedia(revealData) {
  const revealMedia = document.getElementById("reveal-media");
  const revealImage = document.getElementById("reveal-media-image");
  const revealVideo = document.getElementById("reveal-media-video");
  const revealPlayButton = document.getElementById("reveal-media-play-button");
  const revealMediaLabel = document.getElementById("reveal-media-label");
  const hasRevealImage = !!revealData.afterImage;
  const hasRevealVideo = !!revealData.afterVideo;
  const hasRevealAudio = !!revealData.afterAudio;

  playBackgroundMusic(revealData.afterMusic);

  revealImage.alt = "Imagen revelada de la pregunta";
  setMediaElementSource(revealImage, revealData.afterImage);
  setMediaElementSource(revealVideo, revealData.afterVideo);

  revealMedia.classList.toggle("show", hasRevealImage || hasRevealVideo || hasRevealAudio);
  revealMedia.classList.toggle("has-image", hasRevealImage || hasRevealVideo);
  revealMedia.classList.toggle("has-audio", hasRevealAudio);

  if (hasRevealAudio) {
    revealPlayButton.style.display = "";
    audio.src = revealData.afterAudio;
    audio.load();
    isPlaying = false;
    revealPlayButton.classList.remove("playing");
    revealMediaLabel.innerHTML = revealData.date || "";
    revealMediaLabel.style.display = revealData.date ? "block" : "none";
    return;
  }

  revealPlayButton.style.display = "none";
  revealMediaLabel.innerHTML = "";
  revealMediaLabel.style.display = "none";
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
    audioFile: audioFile ? `assets/audios/${audioFile}` : null,
    afterAudio: after.audio ? `assets/audios/${after.audio}` : null,
    afterImage: after.image ? `assets/images/${after.image}` : null,
    afterMusic: after.music ? `assets/music/${after.music}` : null,
    afterVideo: after.video ? `assets/videos/${after.video}` : null,
    image: before.image ? `assets/images/${before.image}` : null,
    music: before.music ? `assets/music/${before.music}` : null,
    video: before.video ? `assets/videos/${before.video}` : null,
  };
}

async function initSolo() {
  mode = "solo";
  hideStartCountdown();
  if (!soloQuestions.length) {
    const resp = await fetch("questions.json");
    soloQuestions = await resp.json();
  }
  soloCurrent = 0; soloScore = 0;
  showStartCountdown(3, {
    onEnd: () => {
    soloLoadRound();
    },
  });
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
    audioSrc, image: soloCurrentQuestion.image, music: soloCurrentQuestion.music, video: soloCurrentQuestion.video,
  };

  document.getElementById("question-counter").textContent = formatSoloCounter();
  const tiles = renderQuestion(data);

  // No countdown in solo mode
  document.getElementById("countdown-container").style.display = "none";

  // Bind click handlers for solo
  tiles.querySelectorAll(".stage-answer").forEach((button) => {
    button.onclick = () => soloAnswer(button.dataset.value);
  });

}

function soloAnswer(selected) {
  if (soloAnswered) return;
  soloAnswered = true;
  const correct = soloCurrentQuestion.correct;

  document.querySelectorAll(".stage-answer").forEach((answerButton) => {
    answerButton.disabled = true;
    if (answerButton.dataset.value === correct) answerButton.classList.add("answer-correct");
    else answerButton.classList.add("dim");
    if (answerButton.dataset.value === selected && selected !== correct) {
      answerButton.classList.remove("dim");
      answerButton.classList.add("answer-wrong");
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
    detailEl.innerHTML = `La respuesta correcta era <span class="text-highlight-success">${escapeHtml(correct)}</span>`;
  }
  document.getElementById("question-counter").textContent = formatSoloCounter();

  // Show after media in modal
  const revealImg = document.getElementById("reveal-image");
  const revealVideo = document.getElementById("reveal-video");
  const mediaEl = document.getElementById("result-modal-media");
  const audioRow = document.getElementById("result-modal-audio-row");
  const hasAfterImage = !!soloCurrentQuestion.afterImage;
  const hasAfterVideo = !!soloCurrentQuestion.afterVideo;
  const hasAfterAudio = !!soloCurrentQuestion.afterAudio;

  playBackgroundMusic(soloCurrentQuestion.afterMusic);
  mediaEl.style.display = hasAfterImage || hasAfterVideo || hasAfterAudio ? "flex" : "none";
  revealImg.alt = "Imagen revelada tras responder";
  setMediaElementSource(revealImg, soloCurrentQuestion.afterImage);
  setMediaElementSource(revealVideo, soloCurrentQuestion.afterVideo);
  if (hasAfterAudio) {
    stopAudioPlayback();
    audio.src = soloCurrentQuestion.afterAudio;
    audio.load();
    document.getElementById("reveal-play-button").style.display = "";
    const entry = soloQuestions[soloCurrent];
    const { date } = parseDate(entry.after.audio);
    document.getElementById("reveal-label").innerHTML = `${date}`;
    audioRow.style.display = "";
  } else {
    document.getElementById("reveal-play-button").style.display = "none";
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
let multiplayerRevealLeaderboard = [];
let multiplayerPreviousLeaderboard = [];
let multiplayerCurrentLeaderboard = [];
let multiplayerHandlersBound = false;

function initMultiplayer() {
  mode = "multi";
  hideStartCountdown();
  clearScoreboardTransitionTimer();
  multiplayerRevealLeaderboard = [];
  multiplayerPreviousLeaderboard = [];
  multiplayerCurrentLeaderboard = [];
  if (!socket) socket = io();
  if (!multiplayerHandlersBound) {
    multiplayerHandlersBound = true;

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
      grid.innerHTML = players.map((player) => `<div class="player-chip">${player.name}</div>`).join("");
      multiplayerCurrentLeaderboard = cloneLeaderboard(players);
      if (multiplayerPreviousLeaderboard.length === 0) {
        multiplayerPreviousLeaderboard = cloneLeaderboard(players);
      }
      const startButton = document.getElementById("lobby-start-button");
      startButton.disabled = players.length === 0;
      startButton.textContent = players.length > 0 ? `Empezar (${players.length} jugador${players.length > 1 ? 'es' : ''})` : "Esperando jugadores...";
    });

    socket.on("host:question", (data) => {
      multiplayerCurrentQuestion = data;
      hideStartCountdown();
      renderQuestion(data);

      // In multiplayer, tiles are NOT clickable
      document.querySelectorAll(".stage-answer").forEach((button) => {
        button.onclick = null;
      });

      if (data.audioBefore) {
        document.getElementById("countdown-number").textContent = String(data.countdownBefore);
        document.getElementById("countdown-container").classList.remove("urgent");
        const progressRing = document.getElementById("countdown-ring-progress");
        progressRing.style.transition = "none"; progressRing.style.strokeDashoffset = "0";

        setTimeout(() => {
          audio.play(); isPlaying = true;
          document.getElementById("host-play-button").classList.add("playing");
          audio.onended = () => {
            isPlaying = false;
            document.getElementById("host-play-button").classList.remove("playing");
            startCountdown(data.countdownAfter, () => socket.emit("host:timeUp"));
            socket.emit("host:answersOpen");
          };
        }, data.countdownBefore * 1000);
      } else {
        startCountdown(data.countdownAfter, () => socket.emit("host:timeUp"));
      }
    });

    socket.on("host:answerCount", ({ answered, total }) => {
      document.getElementById("answer-count-number").textContent = answered;
    });

    socket.on("game:startCountdown", ({ seconds, startsAt }) => {
      showStartCountdown(seconds, { startsAt });
    });

    socket.on("host:reveal", (data) => {
      clearInterval(countdownInterval);
      hideStartCountdown();
      stopAudioPlayback();
      multiplayerPreviousLeaderboard = cloneLeaderboard(multiplayerCurrentLeaderboard.length ? multiplayerCurrentLeaderboard : data.leaderboard);
      multiplayerRevealLeaderboard = cloneLeaderboard(data.leaderboard);
      multiplayerCurrentLeaderboard = cloneLeaderboard(data.leaderboard);

      showScreen("reveal-screen");

      document.getElementById("reveal-question-meta").textContent =
        `Pregunta ${multiplayerCurrentQuestion.index + 1} de ${multiplayerCurrentQuestion.total}`;
      setHighlightedQuestionText(document.getElementById("reveal-text"), multiplayerCurrentQuestion.question);

      // Bar chart
      renderRevealChart(data);
      updateRevealMedia(data);

      document.getElementById("reveal-next-button").textContent = "Ver marcador";
      document.getElementById("scoreboard-next-button").textContent =
        multiplayerCurrentQuestion.index < multiplayerCurrentQuestion.total - 1 ? "Siguiente" : "Ver resultados";
    });

    socket.on("game:end", ({ leaderboard }) => {
      clearInterval(countdownInterval);
      hideStartCountdown();
      stopAudioPlayback();
      showScreen("multiplayer-end-screen");
      if (leaderboard.length > 0) {
        document.getElementById("winner-name").textContent = leaderboard[0].name;
        document.getElementById("winner-score").textContent = `${leaderboard[0].score} puntos`;
      }
      renderLeaderboard("end-leaderboard", leaderboard);
    });
  }

  socket.emit("host:create");
}

function lobbyStart() {
  if (!socket) return;
  document.getElementById("lobby-start-button").disabled = true;
  socket.emit("host:start");
}

function nextMultiplayerQuestion() {
  if (document.getElementById("reveal-screen").classList.contains("active")) {
    showScoreboardTransition(multiplayerPreviousLeaderboard, multiplayerRevealLeaderboard);
    return;
  }

  clearScoreboardTransitionTimer();
  stopAudioPlayback();
  if (socket) socket.emit("host:next");
}

bindHostUi();
