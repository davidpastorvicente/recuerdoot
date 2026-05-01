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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function backToStart() {
  audio.pause(); isPlaying = false;
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
    audio.pause(); isPlaying = false;
    document.querySelectorAll(".play-btn").forEach(b => b.classList.remove("playing"));
  } else {
    audio.play(); isPlaying = true;
    document.querySelectorAll(".play-btn").forEach(b => b.classList.add("playing"));
  }
}
audio.addEventListener("ended", () => {
  isPlaying = false;
  document.querySelectorAll(".play-btn").forEach(b => b.classList.remove("playing"));
});

function startCountdown(seconds, onEnd) {
  let remaining = seconds;
  const circumference = 2 * Math.PI * 44;
  const fg = document.getElementById("countdown-fg");
  const num = document.getElementById("countdown-number");
  fg.style.transition = "none";
  fg.style.strokeDashoffset = "0";
  num.textContent = remaining;
  num.style.color = remaining <= 5 ? "var(--wrong)" : "var(--accent)";
  fg.getBoundingClientRect();
  fg.style.transition = `stroke-dashoffset ${seconds}s linear`;
  fg.style.strokeDashoffset = circumference;

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      num.textContent = "0";
      if (onEnd) onEnd();
      return;
    }
    num.textContent = remaining;
    if (remaining <= 5) num.style.color = "var(--wrong)";
    else num.style.color = "var(--accent)";
  }, 1000);
}

function renderQuestion(data) {
  showScreen("question-screen");
  document.getElementById("q-counter").textContent = `${data.index + 1} / ${data.total}`;
  document.getElementById("q-progress-fill").style.width = `${((data.index + 1) / data.total) * 100}%`;
  document.getElementById("q-badge").style.display = "none";

  // Photo
  const qPhoto = document.getElementById("q-photo");
  if (data.photo) {
    qPhoto.src = data.photo;
    qPhoto.style.display = "";
  } else {
    qPhoto.style.display = "none";
    qPhoto.src = "";
  }

  const qText = document.getElementById("q-text");
  const quoteMatch = data.question.match(/"([^"]+)"/);
  if (quoteMatch) {
    qText.innerHTML = data.question.replace(`"${quoteMatch[1]}"`, `<span class="quote">"${quoteMatch[1]}"</span>`);
  } else {
    qText.textContent = data.question;
  }

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
  const tiles = document.getElementById("option-tiles");
  tiles.innerHTML = data.options.map((opt, i) =>
    `<button class="option-tile" data-value="${esc(opt)}"><span class="shape">${shapes[i]}</span>${esc(opt)}</button>`
  ).join("");

  // Hide post-answer stuff
  document.getElementById("result-banner").className = "result-banner";
  document.getElementById("reveal-info").classList.remove("show");
  document.getElementById("btn-next").style.display = "none";
  document.getElementById("countdown-container").style.display = "";

  return tiles;
}

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function renderLeaderboard(containerId, list) {
  document.getElementById(containerId).innerHTML = list.map((p, i) =>
    `<div class="lb-row" style="animation-delay:${i * 0.08}s">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${p.name}</span>
      <span class="lb-score">${p.score}</span>
    </div>`
  ).join("");
}

// ========== SOLO MODE ==========
let soloQuestions = [];
let soloCurrent = 0, soloScore = 0, soloCurrentQ = null, soloAnswered = false;

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
    afterAudioFile: after.audio ? `media/audios/${after.audio}` : null,
    photo: before.image ? `media/images/${before.image}` : null,
  };
}

async function initSolo() {
  mode = "solo";
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
  soloCurrentQ = buildSoloQuestion(entry);

  const audioSrc = soloCurrentQ.audioFile;

  const data = {
    index: soloCurrent, total: soloQuestions.length,
    question: soloCurrentQ.question,
    options: soloCurrentQ.options, audioBefore: soloCurrentQ.audioBefore,
    audioSrc, photo: soloCurrentQ.photo,
  };

  document.getElementById("q-info-right").textContent = `${soloScore} acierto${soloScore !== 1 ? 's' : ''}`;
  const tiles = renderQuestion(data);

  // No countdown in solo mode
  document.getElementById("countdown-container").style.display = "none";

  // Bind click handlers for solo
  tiles.querySelectorAll(".option-tile").forEach(btn => {
    btn.onclick = () => soloAnswer(btn, btn.dataset.value);
  });

  if (data.audioBefore) {
    document.getElementById("countdown-number").textContent = "\u00B7\u00B7\u00B7";
    const fg = document.getElementById("countdown-fg");
    fg.style.transition = "none"; fg.style.strokeDashoffset = "0";

    setTimeout(() => {
      audio.play(); isPlaying = true;
      document.getElementById("host-play-btn").classList.add("playing");
      audio.onended = () => {
        isPlaying = false;
        document.getElementById("host-play-btn").classList.remove("playing");
        audio.onended = () => { isPlaying = false; document.querySelectorAll(".play-btn").forEach(b => b.classList.remove("playing")); };
      };
    }, 3000);
  }
}

function soloAnswer(btn, selected) {
  if (soloAnswered) return;
  soloAnswered = true;
  const correct = soloCurrentQ.correct;

  document.querySelectorAll(".option-tile").forEach(b => {
    b.disabled = true;
    if (b.dataset.value === correct) b.classList.add("correct-tile");
    else b.classList.add("dim");
    if (b.dataset.value === selected && selected !== correct) {
      b.classList.remove("dim"); b.classList.add("wrong-tile");
    }
  });

  const banner = document.getElementById("result-banner");
  if (selected === correct) {
    soloScore++;
    banner.className = "result-banner show correct-banner";
    banner.textContent = "¡Correcto!";
  } else {
    banner.className = "result-banner show wrong-banner";
    banner.textContent = `Nope! Era: ${correct}`;
  }
  document.getElementById("q-info-right").textContent = `${soloScore} acierto${soloScore !== 1 ? 's' : ''}`;

  // Show after audio on reveal
  if (soloCurrentQ.afterAudioFile) {
    document.getElementById("reveal-info").classList.add("show");
    audio.pause(); isPlaying = false;
    document.querySelectorAll(".play-btn").forEach(b => b.classList.remove("playing"));
    audio.src = soloCurrentQ.afterAudioFile;
    audio.load();
    const entry = soloQuestions[soloCurrent];
    const { date } = parseDate(entry.after.audio);
    document.getElementById("reveal-label").innerHTML = `${date}`;
  }

  document.getElementById("btn-next").style.display = "";
  document.getElementById("btn-next").textContent =
    soloCurrent < soloQuestions.length - 1 ? "Siguiente" : "Ver resultado";
}

function nextQuestion() {
  if (mode === "solo") {
    audio.pause(); isPlaying = false;
    document.querySelectorAll(".play-btn").forEach(b => b.classList.remove("playing"));
    soloCurrent++;
    if (soloCurrent >= soloQuestions.length) soloEnd();
    else soloLoadRound();
  }
}

function soloEnd() {
  showScreen("end-solo");
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
let mpCurrentQ = null;

function initMultiplayer() {
  mode = "multi";
  if (!socket) socket = io();
  socket.emit("host:create");

  socket.on("host:created", ({ pin }) => {
    showScreen("lobby");
    document.getElementById("pin-display").textContent = pin;
    const joinUrl = `${location.protocol}//${location.host}/player.html?pin=${pin}`;
    document.getElementById("join-url").textContent = `${location.host}/player.html`;
    new QRious({ element: document.getElementById("qr-canvas"), value: joinUrl, size: 200, backgroundAlpha: 0, foreground: "#ffffff" });
  });

  socket.on("host:playerList", (players) => {
    const grid = document.getElementById("player-grid");
    grid.innerHTML = players.map(p => `<div class="player-chip">${p.name}</div>`).join("");
    const btn = document.getElementById("btn-lobby-start");
    btn.disabled = players.length === 0;
    btn.textContent = players.length > 0 ? `Empezar (${players.length} jugador${players.length > 1 ? 'es' : ''})` : "Esperando jugadores...";
  });

  socket.on("host:question", (data) => {
    mpCurrentQ = data;
    document.getElementById("q-info-right").textContent = "0 respuestas";
    renderQuestion(data);

    // In multiplayer, tiles are NOT clickable
    document.querySelectorAll(".option-tile").forEach(b => b.onclick = null);

    if (data.audioBefore) {
      document.getElementById("countdown-number").textContent = "5";
      document.getElementById("countdown-number").style.color = "var(--accent)";
      const fg = document.getElementById("countdown-fg");
      fg.style.transition = "none"; fg.style.strokeDashoffset = "0";
      document.getElementById("q-info-right").textContent = "Escuchad...";

      setTimeout(() => {
        audio.play(); isPlaying = true;
        document.getElementById("host-play-btn").classList.add("playing");
        audio.onended = () => {
          isPlaying = false;
          document.getElementById("host-play-btn").classList.remove("playing");
          document.getElementById("q-info-right").textContent = "0 respuestas";
          startCountdown(5, () => socket.emit("host:timeUp"));
          socket.emit("host:answersOpen");
        };
      }, 3000);
    } else {
      startCountdown(data.countdown, () => socket.emit("host:timeUp"));
    }
  });

  socket.on("host:answerCount", ({ answered, total }) => {
    document.getElementById("q-info-right").textContent = `${answered} / ${total} respuestas`;
  });

  socket.on("host:reveal", (data) => {
    clearInterval(countdownInterval);
    audio.pause(); isPlaying = false;

    showScreen("reveal-screen");
    document.getElementById("r-badge").style.display = "none";

    const rText = document.getElementById("r-text");
    const quoteMatch = mpCurrentQ.question.match(/"([^"]+)"/);
    if (quoteMatch) {
      rText.innerHTML = mpCurrentQ.question.replace(`"${quoteMatch[1]}"`, `<span class="quote">"${quoteMatch[1]}"</span>`);
    } else {
      rText.textContent = mpCurrentQ.question;
    }

    // Bar chart
    const maxCount = Math.max(1, ...mpCurrentQ.options.map(o => data.optionCounts[o] || 0));
    document.getElementById("r-bar-chart").innerHTML = mpCurrentQ.options.map((opt, i) => {
      const count = data.optionCounts[opt] || 0;
      const isCorrect = opt === data.correct;
      const heightPct = count > 0 ? Math.max(10, (count / maxCount) * 100) : 4;
      return `<div class="bar-col">
        <div class="bar-check">${isCorrect ? "\u2714" : ""}</div>
        <div class="bar-count">${count}</div>
        <div class="bar-fill c${i} ${isCorrect ? "" : "dim-bar"}" style="height:${heightPct}%"></div>
        <div class="bar-base c${i}">${shapes[i]} ${esc(opt)}</div>
      </div>`;
    }).join("");

    // Reveal audio
    const revealInfo = document.getElementById("r-reveal-info");
    if (data.afterAudio) {
      revealInfo.classList.add("show");
      audio.src = data.afterAudio;
      audio.load(); isPlaying = false;
      document.getElementById("r-reveal-play-btn").classList.remove("playing");
      document.getElementById("r-reveal-label").innerHTML = data.date || "";
    } else {
      revealInfo.classList.remove("show");
    }

    renderLeaderboard("r-leaderboard", data.leaderboard);
    document.getElementById("btn-mp-next").textContent =
      mpCurrentQ.index < mpCurrentQ.total - 1 ? "Siguiente" : "Ver resultados";
  });

  socket.on("game:end", ({ leaderboard }) => {
    clearInterval(countdownInterval);
    audio.pause();
    showScreen("end-mp");
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

function mpNext() {
  audio.pause(); isPlaying = false;
  if (socket) socket.emit("host:next");
}
