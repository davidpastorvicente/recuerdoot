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

  function createStartCountdownController() {
    let startCountdownTimer = null;

    function clearStartCountdownTimer() {
      clearTimeout(startCountdownTimer);
      startCountdownTimer = null;
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
    shuffle,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = shared;
  }

  globalScope.RECUERDOOT_SHARED = shared;
})(typeof globalThis !== "undefined" ? globalThis : window);
