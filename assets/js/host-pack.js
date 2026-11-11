// Quiz pack card on the host start screen. The `pack` state machine decides what the card shows.
(function initHostPack(globalScope) {
  const { MACHINES, createStateMachine } = globalScope.RECUERDOOT_STATE_MACHINES;
  const LOADER = globalScope.RECUERDOOT_PACK_LOADER;
  const { showToast } = globalScope.RECUERDOOT_UI;

  const $ = (id) => document.getElementById(id);
  const MAX_VISIBLE_ERRORS = 6;
  const SOURCE_LABELS = Object.freeze({
    folder: "Carpeta",
    zip: "Archivo .zip",
    json: "questions.json",
    stored: "Guardado en este navegador",
    server: "questions.json del servidor local",
  });
  const TITLE_BY_STATE = Object.freeze({
    empty: "Carga tus preguntas",
    loading: "Cargando quiz…",
    invalid: "Hay que revisar el quiz",
  });
  const TEXT_BY_STATE = Object.freeze({
    empty: "Elige una carpeta o un .zip con tu questions.json y sus fotos, audios y vídeos. Nada se sube a internet: todo se queda en este navegador.",
    loading: "Leyendo las preguntas y comprobando los archivos.",
    invalid: "Corrige estos puntos y vuelve a cargarlo:",
  });

  const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

  /** A ready-to-paste message for the user's AI assistant, pointing at the published guide. */
  function assistantPrompt() {
    const guideUrl = new URL("quiz-guide.md", location.href).href;
    return [
      "Quiero crear un quiz de Recuerdoot sobre recuerdos de mi grupo.",
      `Lee esta guía y sigue su flujo guiado: ${guideUrl}`,
      "Hazme las preguntas de la entrevista, propón un guion de preguntas y ayúdame a preparar los archivos, el questions.json y el .zip.",
      "Si no puedes abrir el enlace, dímelo y te adjunto el archivo.",
    ].join("\n");
  }

  async function copyAssistantPrompt() {
    try {
      await navigator.clipboard.writeText(assistantPrompt());
      showToast("Instrucciones copiadas: pégalas en tu asistente de IA.");
    } catch {
      showToast("No se han podido copiar. Abre la guía y pásale el enlace a tu IA.", { tone: "error" });
    }
  }

  function createPackPanel({ onChange }) {
    const machine = createStateMachine(MACHINES.pack);
    const supportsFolders = "webkitdirectory" in HTMLInputElement.prototype;
    let pack = null;
    let locked = false;
    let loadToken = 0;

    function readyText() {
      const parts = [plural(pack.questionCount, "pregunta", "preguntas")];
      if (pack.mediaCount > 0) parts.push(plural(pack.mediaCount, "archivo", "archivos"));
      parts.push(SOURCE_LABELS[pack.source] ?? "");
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
        more.textContent = `…y ${errors.length - visible.length} más`;
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

      $("pack-title").textContent = state === "ready" ? pack.name : TITLE_BY_STATE[state];
      $("pack-text").textContent = state === "ready" ? readyText() : TEXT_BY_STATE[state];
      const chip = $("pack-status-chip");
      chip.hidden = state !== "ready" && state !== "invalid";
      chip.textContent = state === "ready" ? "Listo" : "Con errores";
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
      machine.transition("loading");

      let next;
      try {
        next = await loader();
      } catch (error) {
        console.error(error);
        next = null;
        if (token === loadToken) showToast("No se ha podido leer el quiz.", { tone: "error" });
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
          showToast("El quiz funciona, pero no se ha podido guardar: tendrás que cargarlo otra vez si recargas.", { tone: "error" });
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
      load(() => LOADER.fromDrop({ entries, files }), { persist: true });
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
        if (files.length > 0) load(() => LOADER.fromFileList(files), { persist: true });
      });
      fileInput.addEventListener("change", () => {
        const [file] = fileInput.files;
        fileInput.value = "";
        if (file) load(() => LOADER.fromFile(file), { persist: true });
      });
    }

    bindInputs();
    bindDropZone();
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
