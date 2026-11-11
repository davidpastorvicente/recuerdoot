/*
 * Runs one multiplayer match inside the host's browser. This is what the Node server used to do:
 * it owns the Game, accepts player connections and routes messages both ways.
 * The network is injected (`listen`), so tests drive it with an in-memory transport and the
 * pages use peer-transport.js (WebRTC through PeerJS).
 */
(function initMatchHost(globalScope) {
  const isNode = typeof module !== "undefined" && module.exports;
  const DEFAULT_CONFIG = isNode ? require("./game-config.js") : globalScope.RECUERDOOT_CONFIG;
  const { Game } = isNode ? require("./game-engine.js") : globalScope.RECUERDOOT_GAME;
  const { randomInt } = isNode ? require("./game-shared.js") : globalScope.RECUERDOOT_SHARED;

  const HOST_ID = "host";
  const PIN_ATTEMPTS = 5;
  const CLOSE_FLUSH_MS = 300;

  function generatePin(config = DEFAULT_CONFIG) {
    const min = 10 ** (config.PIN_LENGTH - 1);
    return String(min + randomInt(9 * min));
  }

  function peerIdForPin(pin, config = DEFAULT_CONFIG) {
    return `${config.PEER_ID_PREFIX}${pin}`;
  }

  /**
   * Creates the match and registers its PIN on the network.
   * - `listen(peerId, onConnection)` resolves to `{ close() }` once the id is registered, or rejects
   *   with `{ type: "unavailable-id" }` when another match already uses that PIN (a new one is tried).
   * - Each connection is `{ id, send(event, payload), close(), onMessage(handler), onClose(handler) }`.
   * - `onEvent(event, payload)` receives everything the Game sends to the host or to the whole room.
   */
  async function createMatchHost({ questions, listen, onEvent, config = DEFAULT_CONFIG, createPin = () => generatePin(config), logger = console }) {
    const connections = new Map();
    const roomMembers = new Set();
    let game = null;
    let listener = null;
    let closed = false;

    function emit(target, event, payload) {
      if (closed) return;
      if (target === HOST_ID) {
        onEvent(event, payload);
        return;
      }
      if (target === game.room) {
        onEvent(event, payload);
        roomMembers.forEach((id) => connections.get(id)?.send(event, payload));
        return;
      }
      connections.get(target)?.send(event, payload);
    }

    const run = (label, action) => {
      try {
        return action();
      } catch (error) {
        logger.error(`Match handler "${label}" failed:`, error);
        return false;
      }
    };

    function handleMessage(connection, event, payload) {
      const data = payload && typeof payload === "object" ? payload : {};
      if (event === "player:join") {
        run(event, () => {
          if (game.join(connection.id, data)) roomMembers.add(connection.id);
        });
      } else if (event === "player:answer") {
        run(event, () => game.submitAnswer(connection.id, data.answer));
      }
    }

    function handleConnection(connection) {
      if (closed) {
        connection.close();
        return;
      }
      connections.set(connection.id, connection);
      connection.onMessage((event, payload) => handleMessage(connection, event, payload));
      connection.onClose(() => {
        connections.delete(connection.id);
        roomMembers.delete(connection.id);
        if (!closed) run("disconnect", () => game.disconnect(connection.id));
      });
    }

    for (let attempt = 1; !listener; attempt++) {
      game = new Game({ pin: createPin(), hostId: HOST_ID, questions, emit, config });
      try {
        listener = await listen(peerIdForPin(game.pin, config), handleConnection);
      } catch (error) {
        if (error?.type !== "unavailable-id" || attempt >= PIN_ATTEMPTS) throw error;
      }
    }

    const commands = {
      "host:start": () => game.start(HOST_ID),
      "host:answersOpen": () => game.openAnswers(HOST_ID),
      "host:timeUp": () => game.timeUp(HOST_ID),
      "host:next": () => game.next(HOST_ID),
      "host:purgeDisconnected": () => game.purgeDisconnected(HOST_ID),
    };

    return {
      pin: game.pin,
      peerId: peerIdForPin(game.pin, config),
      /** Runs a host command (`host:start`, `host:next`...). Returns the Game's result or false. */
      command(name) {
        if (closed || !Object.hasOwn(commands, name)) return false;
        return run(name, commands[name]);
      },
      snapshot: () => game.snapshot(),
      get isClosed() {
        return closed;
      },
      /** Ends the match for everyone. The short delay lets the goodbye message reach the phones. */
      close(reason, { flushMs = CLOSE_FLUSH_MS } = {}) {
        if (closed) return Promise.resolve();
        run("close", () => game.close(reason));
        closed = true;

        const teardown = () => {
          connections.forEach((connection) => connection.close());
          connections.clear();
          roomMembers.clear();
          listener.close();
        };
        if (flushMs <= 0) {
          teardown();
          return Promise.resolve();
        }
        return new Promise((resolve) => setTimeout(() => {
          teardown();
          resolve();
        }, flushMs));
      },
    };
  }

  const api = { HOST_ID, createMatchHost, generatePin, peerIdForPin };

  if (isNode) {
    module.exports = api;
  }

  globalScope.RECUERDOOT_MATCH = api;
})(globalThis);
