(function initHostLeaderboard(globalScope) {
  const ROW_MOVE_MS = 2000;
  const SCORE_COUNT_MS = 2000;
  const ROW_STAGGER_MS = 80;

  const escapeHtml = (value) => globalScope.RECUERDOOT_SHARED.escapeHtml(value);
  const keyOf = (player) => player.playerId ?? player.name;

  function cloneLeaderboard(list) {
    return list.map((player) => ({ ...player }));
  }

  /** Maps each player key to how many places they moved between two rankings. */
  function getLeaderboardMovement(previousList, nextList) {
    const previousRanks = new Map(previousList.map((player, index) => [keyOf(player), index]));

    return new Map(nextList.map((player, index) => {
      const previousRank = previousRanks.get(keyOf(player));
      if (previousRank === undefined) return [keyOf(player), { direction: "new", places: 0 }];
      if (previousRank > index) return [keyOf(player), { direction: "up", places: previousRank - index }];
      if (previousRank < index) return [keyOf(player), { direction: "down", places: index - previousRank }];
      return [keyOf(player), { direction: "same", places: 0 }];
    }));
  }

  function movementBadge(movement) {
    switch (movement?.direction) {
      case "new":
        return '<span class="movement-chip movement-new">Nuevo</span>';
      case "up":
        return `<span class="movement-chip movement-up" aria-label="Sube ${movement.places}">▲ ${movement.places}</span>`;
      case "down":
        return `<span class="movement-chip movement-down" aria-label="Baja ${movement.places}">▼ ${movement.places}</span>`;
      default:
        return '<span class="movement-chip movement-idle" aria-hidden="true"></span>';
    }
  }

  function rowHtml(player, rank, movement) {
    const offline = player.connected === false
      ? '<span class="status-dot status-offline" title="Desconectado"><span class="visually-hidden">Desconectado</span></span>'
      : "";
    return `<span class="rank-badge rank-${rank}">${rank}</span>
      <span class="leaderboard-name">${escapeHtml(player.name)}${offline}</span>
      ${movementBadge(movement)}
      <span class="leaderboard-score" data-score="${player.score}">${player.score}</span>`;
  }

  function renderStatic(container, list, { limit }) {
    container.innerHTML = list.slice(0, limit).map((player, index) =>
      `<li class="leaderboard-row leaderboard-row-appear" style="animation-delay:${index * ROW_STAGGER_MS}ms">${rowHtml(player, index + 1, null)}</li>`
    ).join("");
  }

  function playRowAnimations(rows, previousTop) {
    rows.forEach((row) => {
      const previousRowTop = previousTop.get(row.dataset.playerKey);
      if (previousRowTop === undefined) {
        row.classList.add("leaderboard-row-enter-active");
        return;
      }

      const deltaY = previousRowTop - row.getBoundingClientRect().top;
      if (Math.abs(deltaY) < 1) return;

      row.getAnimations().forEach((animation) => animation.cancel());
      row.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
        { duration: ROW_MOVE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
      );
    });
  }

  /** Re-renders the list reusing existing rows so moved players visibly travel (FLIP). */
  function renderAnimated(container, list, { limit, movementMap = new Map() }) {
    const existingRows = new Map(
      Array.from(container.querySelectorAll(".leaderboard-row")).map((row) => [row.dataset.playerKey, row])
    );
    const previousTop = new Map(
      Array.from(existingRows.entries()).map(([key, row]) => [key, row.getBoundingClientRect().top])
    );

    const rows = list.slice(0, limit).map((player, index) => {
      const key = keyOf(player);
      const movement = movementMap.get(key);
      const row = existingRows.get(key) ?? Object.assign(document.createElement("li"), { className: "leaderboard-row leaderboard-row-enter" });
      row.dataset.playerKey = key;
      row.innerHTML = rowHtml(player, index + 1, movement);
      row.classList.toggle("leaderboard-row-up", movement?.direction === "up");
      row.classList.toggle("leaderboard-row-down", movement?.direction === "down");
      return row;
    });

    container.replaceChildren(...rows);
    requestAnimationFrame(() => playRowAnimations(rows, previousTop));
  }

  /** Counts every visible score up from its previous total. */
  function animateScores(container, previousList, nextList) {
    const previousScores = new Map(previousList.map((player) => [keyOf(player), player.score]));

    nextList.forEach((player) => {
      const row = container.querySelector(`.leaderboard-row[data-player-key="${CSS.escape(keyOf(player))}"]`);
      const scoreElement = row?.querySelector(".leaderboard-score");
      if (!scoreElement) return;

      const startScore = previousScores.get(keyOf(player)) ?? 0;
      const endScore = player.score;
      scoreElement.textContent = String(startScore);
      if (startScore === endScore) return;

      const startedAt = performance.now();
      const step = (now) => {
        const progress = Math.min((now - startedAt) / SCORE_COUNT_MS, 1);
        scoreElement.textContent = String(Math.round(startScore + (endScore - startScore) * progress));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  const api = { animateScores, cloneLeaderboard, getLeaderboardMovement, renderAnimated, renderStatic };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RECUERDOOT_LEADERBOARD = api;
})(globalThis);
