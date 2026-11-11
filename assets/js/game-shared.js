(function initGameShared(globalScope) {
  const I18N = typeof module !== "undefined" && module.exports ? require("./i18n.js") : globalScope.RECUERDOOT_I18N;
  const APP_NAME = globalScope.RECUERDOOT_CONFIG?.APP_NAME;
  const MEDIA_FOLDERS = Object.freeze({
    audio: "assets/audios",
    image: "assets/images",
    music: "assets/music",
    video: "assets/videos",
  });
  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const UINT32_RANGE = 2 ** 32;

  // Triangle, square, circle, diamond, pentagon and inverted triangle: one per answer slot.
  const ANSWER_SHAPES = Object.freeze([
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="12,2 2,22 22,22" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="12,2 22,12 12,22 2,12" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="12,2 22,9 18,22 6,22 2,9" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="2,3 22,3 12,22" fill="currentColor"/></svg>',
  ]);

  function syncBranding() {
    if (typeof document === "undefined") return;

    document.querySelectorAll(".brand").forEach((element) => {
      element.textContent = APP_NAME;
    });
  }

  function escapeHtml(value) {
    return String(value).replaceAll(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
  }

  /** Unbiased integer in [0, maxExclusive) backed by the platform CSPRNG. */
  function randomInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
      throw new RangeError(`randomInt expects an integer in (0, 2^32], received ${maxExclusive}`);
    }

    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    const buffer = new Uint32Array(1);
    do {
      globalScope.crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % maxExclusive;
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = randomInt(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  /** Finds a YYYYMMDD date in a file name: `iso` is "YYYY-MM-DD", `date` is formatted in the current language. */
  function parseDateParts(key) {
    const match = /(\d{4})(\d{2})(\d{2})/.exec(String(key));
    const month = match ? Number.parseInt(match[2], 10) : 0;
    if (month < 1 || month > 12) return { date: "", year: "", iso: "" };

    const [, year, monthDigits, day] = match;
    const iso = `${year}-${monthDigits}-${day}`;
    return { date: I18N.formatDate(iso), year, iso };
  }

  function resolveMedia(media, resolveFile) {
    return Object.fromEntries(
      Object.keys(MEDIA_FOLDERS).map((kind) => [kind, media[kind] ? resolveFile(kind, media[kind]) : null])
    );
  }

  /** Media can be a file name inside the quiz or a full http(s) URL. */
  function isRemoteMedia(file) {
    return /^https?:\/\//i.test(String(file));
  }

  /** Default resolver: files under assets/<kind folder>/, used by the dev server's questions.json. */
  function resolveAssetMedia(kind, file) {
    return isRemoteMedia(file) ? file : `${MEDIA_FOLDERS[kind]}/${file}`;
  }

  /**
   * Turns a raw questions.json entry into the runtime shape used by the match engine and solo mode.
   * Options are shuffled once here; the stored file keeps answers in a fixed structure.
   * `resolveMedia(kind, file)` maps file names to playable URLs (asset paths or blob: URLs of a quiz pack).
   */
  function normalizeQuestion(entry, { shuffleOptions = shuffle, resolveMedia: resolveFile = resolveAssetMedia } = {}) {
    const before = entry.before || {};
    const after = entry.after || {};
    const dateSource = before.audio || after.audio;

    return {
      question: entry.question,
      options: shuffleOptions([entry.answers.right, ...entry.answers.wrong]),
      correct: entry.answers.right,
      audioBefore: Boolean(before.audio),
      before: resolveMedia(before, resolveFile),
      after: resolveMedia(after, resolveFile),
      // ISO date; pages format it in the viewer's language (I18N.formatDate).
      date: dateSource ? parseDateParts(dateSource).iso : "",
    };
  }

  /** Random hex identifier from the CSPRNG; unlike crypto.randomUUID it also works outside secure contexts. */
  function randomId(bytes = 16) {
    const buffer = new Uint8Array(bytes);
    globalScope.crypto.getRandomValues(buffer);
    return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function formatQuestionCounter(index, total) {
    return I18N.t("question.counter", { current: index + 1, total });
  }

  let sharedAudioContext = null;

  function getSharedAudioContext() {
    const AudioContextCtor = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextCtor) return null;
    sharedAudioContext ??= new AudioContextCtor();
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  }

  function playTone(context, { type, frequency, start, duration, peak, endFrequency = frequency }) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    }
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function playCountdownTick(value) {
    const context = getSharedAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const isFinalTick = value <= 1;
    const pulses = isFinalTick
      ? [
        { offset: 0, frequency: 1046.5, duration: 0.08, peak: 0.12 },
        { offset: 0.11, frequency: 1318.5, duration: 0.12, peak: 0.16 },
      ]
      : [
        { offset: 0, frequency: 880, duration: 0.06, peak: 0.08 },
        { offset: 0.09, frequency: 987.8, duration: 0.05, peak: 0.06 },
      ];

    pulses.forEach(({ offset, frequency, duration, peak }) => {
      playTone(context, { type: isFinalTick ? "triangle" : "square", frequency, start: now + offset, duration, peak });
    });
  }

  function playQuestionEndGong() {
    const context = getSharedAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const partials = [
      { type: "sine", frequency: 261.63, peak: 0.16, duration: 2.9 },
      { type: "triangle", frequency: 392, peak: 0.07, duration: 2.3 },
      { type: "sine", frequency: 523.25, peak: 0.03, duration: 1.9 },
    ];

    partials.forEach(({ type, frequency, peak, duration }) => {
      playTone(context, { type, frequency, start: now, duration, peak, endFrequency: frequency * 0.996 });
    });
  }

  /** Full-screen "Ready, set, go" overlay shared by host and player pages. */
  function createStartCountdownController() {
    let timer = null;
    let lastAnnouncedValue = null;

    const getOverlay = () => document.getElementById("start-countdown-overlay");
    const getLabel = () => document.getElementById("start-countdown-label");
    const getDigits = () => Array.from(document.querySelectorAll("#start-countdown-number .start-countdown-digit"));

    function clearStartCountdownTimer() {
      clearTimeout(timer);
      timer = null;
      lastAnnouncedValue = null;
    }

    function swapDigit(value) {
      const digits = getDigits();
      const activeDigit = digits.find((digit) => digit.classList.contains("active")) || digits[0];
      const nextDigit = digits.find((digit) => digit !== activeDigit) || digits[1];

      nextDigit.textContent = String(value);
      nextDigit.classList.remove("exit");
      nextDigit.getBoundingClientRect();
      nextDigit.classList.add("active");

      activeDigit.classList.remove("active");
      activeDigit.classList.add("exit");
    }

    function getLabelText(seconds, remaining) {
      if (remaining <= 1) return I18N.t("countdown.go");
      return I18N.t(remaining > Math.ceil(seconds / 2) ? "countdown.ready" : "countdown.set");
    }

    function hideStartCountdown() {
      clearStartCountdownTimer();
      const overlay = getOverlay();
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
      getLabel().textContent = "";
      getDigits().forEach((digit) => {
        digit.classList.remove("active", "exit");
        digit.textContent = "";
      });
    }

    function showStartCountdown(seconds, { startsAt = Date.now(), onEnd = null } = {}) {
      const overlay = getOverlay();
      const label = getLabel();
      const [firstDigit, secondDigit] = getDigits();

      clearStartCountdownTimer();
      firstDigit.textContent = String(seconds);
      firstDigit.classList.add("active");
      firstDigit.classList.remove("exit");
      secondDigit.classList.remove("active", "exit");

      const renderTick = () => {
        const elapsedSteps = Math.floor(Math.max(0, Date.now() - startsAt) / 1000);
        if (elapsedSteps >= seconds) {
          hideStartCountdown();
          onEnd?.();
          return;
        }

        const remaining = seconds - elapsedSteps;
        overlay.classList.add("show");
        overlay.removeAttribute("aria-hidden");
        label.textContent = getLabelText(seconds, remaining);
        swapDigit(remaining);
        if (lastAnnouncedValue !== remaining) {
          lastAnnouncedValue = remaining;
          playCountdownTick(remaining);
        }

        const nextTickAt = startsAt + ((elapsedSteps + 1) * 1000);
        timer = setTimeout(renderTick, Math.max(0, nextTickAt - Date.now()));
      };

      timer = setTimeout(renderTick, Math.max(0, startsAt - Date.now()));
    }

    return { clearStartCountdownTimer, showStartCountdown, hideStartCountdown };
  }

  const shared = {
    ANSWER_SHAPES,
    MEDIA_FOLDERS,
    createStartCountdownController,
    escapeHtml,
    formatQuestionCounter,
    isRemoteMedia,
    normalizeQuestion,
    parseDateParts,
    playCountdownTick,
    playQuestionEndGong,
    randomId,
    randomInt,
    resolveAssetMedia,
    shuffle,
    syncBranding,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = shared;
  }

  globalScope.RECUERDOOT_SHARED = shared;

  syncBranding();
})(globalThis);
