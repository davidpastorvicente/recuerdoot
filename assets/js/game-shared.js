(function initGameShared(globalScope) {
  const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  function escapeHtml(value) {
    const stringValue = String(value);
    if (typeof document === "undefined") {
      return stringValue
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const div = document.createElement("div");
    div.textContent = stringValue;
    return div.innerHTML;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function parseDateParts(key) {
    const match = String(key).match(/(\d{4})(\d{2})(\d{2})/);
    if (!match) return { date: "", year: "" };
    return {
      date: `${parseInt(match[3], 10)} ${MONTHS_ES[parseInt(match[2], 10) - 1]} ${match[1]}`,
      year: match[1],
    };
  }

  let sharedAudioContext = null;

  function getSharedAudioContext() {
    const AudioContextCtor = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContextCtor();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
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
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const pulseStart = now + offset;

      oscillator.type = isFinalTick ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, pulseStart);
      gainNode.gain.setValueAtTime(0.0001, pulseStart);
      gainNode.gain.exponentialRampToValueAtTime(peak, pulseStart + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, pulseStart + duration);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(pulseStart);
      oscillator.stop(pulseStart + duration + 0.02);
    });
  }

  function playQuestionEndGong() {
    const context = getSharedAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const partials = [
      { type: "sine", frequency: 261.63, peak: 0.16, decay: 2.9 },
      { type: "triangle", frequency: 392, peak: 0.07, decay: 2.3 },
      { type: "sine", frequency: 523.25, peak: 0.03, decay: 1.9 },
    ];

    partials.forEach(({ type, frequency, peak, decay }) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.996, now + decay);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + decay + 0.05);
    });
  }

  function createStartCountdownController() {
    let startCountdownTimer = null;
    let lastAnnouncedValue = null;

    function clearStartCountdownTimer() {
      clearTimeout(startCountdownTimer);
      startCountdownTimer = null;
      lastAnnouncedValue = null;
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
      if (remaining <= 1) return "YA";
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
        if (lastAnnouncedValue !== remaining) {
          lastAnnouncedValue = remaining;
          playCountdownTick(remaining);
        }

        const nextTickAt = startsAt + ((elapsedSteps + 1) * 1000);
        startCountdownTimer = setTimeout(renderTick, Math.max(0, nextTickAt - Date.now()));
      };

      startCountdownTimer = setTimeout(renderTick, Math.max(0, startsAt - Date.now()));
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

    return { clearStartCountdownTimer, showStartCountdown, hideStartCountdown };
  }

  const shared = {
    createStartCountdownController,
    escapeHtml,
    parseDateParts,
    playCountdownTick,
    playQuestionEndGong,
    shuffle,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = shared;
  }

  globalScope.RECUERDOOT_SHARED = shared;
})(typeof globalThis !== "undefined" ? globalThis : window);
