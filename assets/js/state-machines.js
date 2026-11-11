/*
 * Every stateful flow in Recuerdoot is declared here as an explicit transition table.
 * The server (game), the host page (host) and the player page (player) each drive one
 * machine; docs/state-machines.md explains every state and the events behind each edge.
 */
(function initStateMachines(globalScope) {
  const MACHINES = Object.freeze({
    game: Object.freeze({
      name: "game",
      initial: "lobby",
      transitions: Object.freeze({
        lobby: ["starting", "closed"],
        starting: ["listening", "answering", "end", "closed"],
        listening: ["answering", "reveal", "closed"],
        answering: ["reveal", "closed"],
        reveal: ["listening", "answering", "end", "closed"],
        end: ["closed"],
        closed: [],
      }),
    }),
    host: Object.freeze({
      name: "host",
      initial: "start",
      transitions: Object.freeze({
        start: ["solo-countdown", "multi-connecting"],
        "solo-countdown": ["solo-question", "start"],
        "solo-question": ["solo-feedback", "start"],
        "solo-feedback": ["solo-question", "solo-end", "start"],
        "solo-end": ["solo-countdown", "start"],
        "multi-connecting": ["multi-lobby", "start"],
        "multi-lobby": ["multi-countdown", "start"],
        "multi-countdown": ["multi-reading", "multi-answering", "multi-end", "start"],
        "multi-reading": ["multi-listening", "multi-reveal", "start"],
        "multi-listening": ["multi-answering", "multi-reveal", "start"],
        "multi-answering": ["multi-reveal", "start"],
        "multi-reveal": ["multi-scoreboard", "start"],
        "multi-scoreboard": ["multi-reading", "multi-answering", "multi-end", "start"],
        "multi-end": ["start"],
      }),
    }),
    player: Object.freeze({
      name: "player",
      initial: "join",
      transitions: Object.freeze({
        join: ["joining"],
        joining: ["join", "waiting", "countdown", "answering", "answered", "result", "ended"],
        waiting: ["countdown", "answering", "answered", "result", "ended", "join"],
        countdown: ["answering", "answered", "result", "ended", "join"],
        answering: ["answered", "result", "ended", "join"],
        answered: ["answering", "result", "ended", "join"],
        result: ["answering", "answered", "ended", "join"],
        ended: ["join"],
      }),
    }),
  });

  function assertValidDefinition({ name, initial, transitions }) {
    const states = Object.keys(transitions);
    if (!states.includes(initial)) {
      throw new Error(`[${name}] Initial state "${initial}" is not declared`);
    }

    for (const [from, targets] of Object.entries(transitions)) {
      const unknownTarget = targets.find((target) => !states.includes(target));
      if (unknownTarget) {
        throw new Error(`[${name}] "${from}" points to undeclared state "${unknownTarget}"`);
      }
    }
  }

  function warnInvalidTransition({ name, from, to }) {
    console.warn(`[${name}] Ignored invalid transition ${from} -> ${to}`);
  }

  /**
   * Re-entering the current state is always allowed and notifies listeners, so screens
   * can re-render when the server pushes the same phase again (for example after a rejoin).
   */
  function createStateMachine(definition, { onInvalid = warnInvalidTransition } = {}) {
    assertValidDefinition(definition);
    const { name, initial, transitions } = definition;
    const listeners = new Set();
    let current = initial;

    function can(target) {
      return target === current || transitions[current].includes(target);
    }

    function transition(target, detail = null) {
      if (!Object.hasOwn(transitions, target)) {
        throw new Error(`[${name}] Unknown state "${target}"`);
      }

      if (!can(target)) {
        onInvalid({ name, from: current, to: target, detail });
        return false;
      }

      const from = current;
      current = target;
      for (const listener of listeners) {
        listener({ from, to: target, detail });
      }
      return true;
    }

    return {
      name,
      get state() {
        return current;
      },
      is: (...candidates) => candidates.includes(current),
      can,
      transition,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  const api = { MACHINES, createStateMachine };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RECUERDOOT_STATE_MACHINES = api;
})(globalThis);
