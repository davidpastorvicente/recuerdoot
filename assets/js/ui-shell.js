/* Loaded in <head> so the stored theme applies before the first paint. */
(function initUiShell(globalScope) {
  const THEME_STORAGE_KEY = "recuerdoot-theme";
  const TOAST_DURATION_MS = 5000;
  const root = document.documentElement;
  let toastTimer = null;

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function getEffectiveTheme() {
    return root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }
  }

  function syncThemeToggle(button) {
    const isDark = getEffectiveTheme() === "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.title = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  }

  function bindThemeToggle() {
    const button = document.getElementById("theme-toggle-button");
    if (!button) return;

    syncThemeToggle(button);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => syncThemeToggle(button));
    button.addEventListener("click", () => {
      const nextTheme = getEffectiveTheme() === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Private mode: the choice simply lasts for this page view.
      }
      syncThemeToggle(button);
    });
  }

  /** The dot grid is the only decorative element; a soft spotlight follows the mouse. */
  function bindDotGrid() {
    const grid = document.querySelector(".dot-grid");
    if (!grid) return;

    let frame = null;
    document.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        grid.style.setProperty("--pointer-x", `${event.clientX}px`);
        grid.style.setProperty("--pointer-y", `${event.clientY}px`);
        grid.classList.add("is-tracking");
      });
    });
    document.documentElement.addEventListener("pointerleave", () => grid.classList.remove("is-tracking"));
  }

  function showToast(message, { tone = "neutral" } = {}) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, TOAST_DURATION_MS);
  }

  applyTheme(readStoredTheme());

  document.addEventListener("DOMContentLoaded", () => {
    bindThemeToggle();
    bindDotGrid();
  });

  globalScope.RECUERDOOT_UI = { showToast };
})(globalThis);
