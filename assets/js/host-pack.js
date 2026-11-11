// Quiz pack card on the host start screen. The `pack` state machine decides what the card shows.
(function initHostPack(globalScope) {
  const { MACHINES, createStateMachine } = globalScope.RECUERDOOT_STATE_MACHINES;
  const LOADER = globalScope.RECUERDOOT_PACK_LOADER;
  const { showToast } = globalScope.RECUERDOOT_UI;
  const I18N = globalScope.RECUERDOOT_I18N;
  const { t } = I18N;

  const $ = (id) => document.getElementById(id);
  const MAX_VISIBLE_ERRORS = 6;
  // Message keys by pack source and card state (see i18n.js).
  const SOURCE_KEYS = Object.freeze({
    folder: "pack.source.folder",
    zip: "pack.source.zip",
    json: "pack.source.json",
    stored: "pack.source.stored",
    server: "pack.source.server",
  });
  const TITLE_KEY_BY_STATE = Object.freeze({
    empty: "pack.title.empty",
    loading: "pack.title.loading",
    invalid: "pack.title.invalid",
  });
  const TEXT_KEY_BY_STATE = Object.freeze({
    empty: "pack.text.empty",
    loading: "pack.text.loading",
    invalid: "pack.text.invalid",
  });

  /** A ready-to-paste message for the user's AI assistant, pointing at the published guide in the current language. */
  function assistantPrompt() {
    const url = new URL(t("pack.guideFile"), location.href).href;
    return t("pack.prompt", { url });
  }

  async function copyAssistantPrompt() {
    try {
      await navigator.clipboard.writeText(assistantPrompt());
      showToast(t("pack.toast.copied"));
    } catch {
      showToast(t("pack.toast.copyFailed"), { tone: "error" });
    }
  }

  function createPackPanel({ onChange }) {
    const machine = createStateMachine(MACHINES.pack);
    const supportsFolders = "webkitdirectory" in HTMLInputElement.prototype;
    let pack = null;
    let locked = false;
    let loadToken = 0;
    let lastLoader = null;

    function readyText() {
      const parts = [t("pack.count.questions", { count: pack.questionCount })];
      if (pack.mediaCount > 0) parts.push(t("pack.count.files", { count: pack.mediaCount }));
      parts.push(SOURCE_KEYS[pack.source] ? t(SOURCE_KEYS[pack.source]) : "");
      return parts.filter(Boolean).join(" · ");
    }

    function renderErrors() {
      const list = $("pack-errors");
      const errors = machine.is("invalid") ? pack?.errors ?? [] : [];
      const visible = errors.slice(0, MAX_VISIBLE_ERRORS);
      const items = visible.map((error) => {
        const item = document.createElement("li");
        item.textContent = error;
        return item;
      });
      if (errors.length > visible.length) {
        const more = document.createElement("li");
        more.textContent = t("pack.moreErrors", { count: errors.length - visible.length });
        items.push(more);
      }
      list.replaceChildren(...items);
      list.hidden = items.length === 0;
    }

    function render() {
      const state = machine.state;
      const card = $("pack-card");
      const busy = state === "loading";
      card.dataset.state = state;
      card.setAttribute("aria-busy", String(busy));

      $("pack-title").textContent = state === "ready" ? pack.name : t(TITLE_KEY_BY_STATE[state]);
      $("pack-text").textContent = state === "ready" ? readyText() : t(TEXT_KEY_BY_STATE[state]);
      const chip = $("pack-status-chip");
      chip.hidden = state !== "ready" && state !== "invalid";
      chip.textContent = t(state === "ready" ? "pack.status.ready" : "pack.status.invalid");
      renderErrors();

      $("pack-folder-button").hidden = !supportsFolders;
      $("pack-folder-button").disabled = busy || locked;
      $("pack-file-button").disabled = busy || locked;
      $("pack-clear-button").hidden = state !== "ready" && state !== "invalid";
      $("pack-clear-button").disabled = busy || locked;
    }

    machine.subscribe(({ to }) => {
      render();
      onChange({ state: to, pack: to === "ready" ? pack : null });
    });

    function replacePack(next) {
      if (pack !== next) pack?.release();
      pack = next;
    }

    /** Runs a loader; a newer load always wins over a slower older one. */
    async function load(loader, { persist }) {
      if (locked) return;
      const token = ++loadToken;
      lastLoader = loader;
      machine.transition("loading");

      let next;
      try {
        next = await loader();
      } catch (error) {
        console.error(error);
        next = null;
        if (token === loadToken) showToast(t("pack.toast.readFailed"), { tone: "error" });
      }
      if (token !== loadToken) {
        next?.release();
        return;
      }
      if (!next) {
        replacePack(null);
        machine.transition("empty");
        return;
      }

      replacePack(next);
      const valid = next.errors.length === 0;
      machine.transition(valid ? "ready" : "invalid");
      if (valid && persist) {
        LOADER.saveStored(next).catch((error) => {
          console.warn(error);
          showToast(t("pack.toast.saveFailed"), { tone: "error" });
        });
      }
    }

    function clear() {
      if (locked || machine.is("loading")) return;
      loadToken += 1;
      replacePack(null);
      machine.transition("empty");
      LOADER.clearStored().catch((error) => console.warn(error));
    }

    async function restore({ serverQuestions }) {
      const fromServer = serverQuestions ? await LOADER.fromServer() : null;
      if (fromServer) return fromServer;
      return LOADER.loadStored().catch((error) => {
        console.warn(error);
        return null;
      });
    }

    function onDrop(event) {
      event.preventDefault();
      $("pack-card").classList.remove("is-dragging");
      if (locked) return;
      // Entries must be taken synchronously: the DataTransfer is emptied once the event returns.
      const items = Array.from(event.dataTransfer.items ?? []).filter((item) => item.kind === "file");
      const entries = items.map((item) => item.webkitGetAsEntry?.() ?? null);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0 && entries.every((entry) => !entry)) return;
      void load(() => LOADER.fromDrop({ entries, files }), { persist: true });
    }

    function bindDropZone() {
      const card = $("pack-card");
      let depth = 0;
      card.addEventListener("dragenter", (event) => {
        event.preventDefault();
        depth += 1;
        card.classList.toggle("is-dragging", !locked);
      });
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("dragleave", () => {
        depth = Math.max(0, depth - 1);
        if (depth === 0) card.classList.remove("is-dragging");
      });
      card.addEventListener("drop", (event) => {
        depth = 0;
        onDrop(event);
      });
      // Dropping outside the card must not navigate away from the game.
      document.addEventListener("dragover", (event) => event.preventDefault());
      document.addEventListener("drop", (event) => event.preventDefault());
    }

    function bindInputs() {
      const folderInput = $("pack-folder-input");
      const fileInput = $("pack-file-input");
      $("pack-folder-button").addEventListener("click", () => folderInput.click());
      $("pack-file-button").addEventListener("click", () => fileInput.click());
      $("pack-clear-button").addEventListener("click", clear);
      $("pack-ai-copy-button").addEventListener("click", copyAssistantPrompt);
      folderInput.addEventListener("change", () => {
        const files = Array.from(folderInput.files);
        folderInput.value = "";
        if (files.length > 0) void load(() => LOADER.fromFileList(files), { persist: true });
      });
      fileInput.addEventListener("change", () => {
        const [file] = fileInput.files;
        fileInput.value = "";
        if (file) void load(() => LOADER.fromFile(file), { persist: true });
      });
    }

    /** Texts follow the language; validation problems are re-checked so they are listed in it too. */
    function onLocaleChange() {
      if (machine.is("invalid") && lastLoader && !locked) {
        void load(lastLoader, { persist: false });
        return;
      }
      render();
    }

    bindInputs();
    bindDropZone();
    I18N.onChange(onLocaleChange);
    render();

    return {
      get state() {
        return machine.state;
      },
      get pack() {
        return machine.is("ready") ? pack : null;
      },
      /** Loads the dev server's questions.json when there is one, or else the pack saved in this browser. */
      restore: (siteConfig) => load(async () => restore(await siteConfig), { persist: false }),
      /** The pack cannot change while a match or solo game is using its media. */
      setLocked(value) {
        locked = value;
        render();
      },
    };
  }

  globalScope.RECUERDOOT_HOST_PACK = { createPackPanel };
})(globalThis);
