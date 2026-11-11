/*
 * WebRTC transport built on PeerJS. The host registers `${PEER_ID_PREFIX}${pin}` on the public
 * PeerJS signalling server; phones connect to it directly through a data channel. After the
 * handshake no game data goes through any server.
 *
 * Messages are `{ e: event, p: payload }`. Both sides send a heartbeat, because a phone that
 * locks its screen or loses the network often never fires a "close" event.
 */
(function initPeerTransport(globalScope) {
  const CONFIG = globalScope.RECUERDOOT_CONFIG;
  const HEARTBEAT_EVENT = "ping";
  const PEER_OPTIONS = Object.freeze({ debug: 1 });
  const FATAL_CLIENT_ERRORS = new Set(["browser-incompatible", "ssl-unavailable", "invalid-id", "invalid-key"]);

  let connectionCounter = 0;

  const PeerCtor = () => {
    if (!globalScope.Peer) throw new Error("PeerJS is not loaded");
    return globalScope.Peer;
  };

  /** Wraps a PeerJS DataConnection as the `{ id, send, close, onMessage, onClose }` used by match-host.js. */
  function wrapConnection(dataConnection) {
    const messageHandlers = [];
    const closeHandlers = [];
    let lastSeen = Date.now();
    let closed = false;

    function rawSend(message) {
      if (closed || !dataConnection.open) return;
      try {
        dataConnection.send(message);
      } catch (error) {
        console.warn("[peer] send failed", error);
      }
    }

    function finish() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      closeHandlers.forEach((handler) => handler());
    }

    function close() {
      finish();
      dataConnection.close();
    }

    const heartbeat = setInterval(() => {
      if (Date.now() - lastSeen > CONFIG.HEARTBEAT_TIMEOUT_MS) {
        close();
        return;
      }
      rawSend({ e: HEARTBEAT_EVENT });
    }, CONFIG.HEARTBEAT_INTERVAL_MS);

    dataConnection.on("data", (data) => {
      lastSeen = Date.now();
      if (!data || typeof data !== "object" || typeof data.e !== "string" || data.e === HEARTBEAT_EVENT) return;
      messageHandlers.forEach((handler) => handler(data.e, data.p));
    });
    dataConnection.on("close", finish);
    dataConnection.on("error", close);

    connectionCounter += 1;
    return {
      id: `connection-${connectionCounter}`,
      send: (event, payload) => rawSend({ e: event, p: payload }),
      close,
      onMessage: (handler) => messageHandlers.push(handler),
      onClose: (handler) => closeHandlers.push(handler),
    };
  }

  /** Re-registers with the signalling server when that link drops; open data channels keep working. */
  function keepRegistered(peer) {
    peer.on("disconnected", () => {
      setTimeout(() => {
        if (!peer.destroyed && peer.disconnected) peer.reconnect();
      }, CONFIG.RECONNECT_DELAY_MS);
    });
  }

  // ---------- Host ----------

  /** `listen` for createMatchHost: resolves once `peerId` is registered; rejects with PeerJS errors (`unavailable-id`...) or a timeout. */
  function listen(peerId, onConnection) {
    return new Promise((resolve, reject) => {
      const Peer = PeerCtor();
      const peer = new Peer(peerId, PEER_OPTIONS);
      let opened = false;
      // A blocked or unreachable signalling server may never answer; don't leave the host waiting forever.
      const timeout = setTimeout(() => {
        if (opened) return;
        peer.destroy();
        reject(Object.assign(new Error("Timed out registering the match"), { type: "timeout" }));
      }, CONFIG.CONNECT_TIMEOUT_MS);

      peer.on("open", () => {
        opened = true;
        clearTimeout(timeout);
        resolve({ close: () => peer.destroy() });
      });
      peer.on("connection", (dataConnection) => {
        dataConnection.on("open", () => onConnection(wrapConnection(dataConnection)));
      });
      peer.on("error", (error) => {
        if (!opened) {
          clearTimeout(timeout);
          peer.destroy();
          reject(error);
          return;
        }
        console.warn(`[peer] host error: ${error.type}`, error);
      });
      keepRegistered(peer);
    });
  }

  // ---------- Player ----------

  /**
   * One phone's link to the host, with automatic reconnection.
   * - `onOpen()`: connected (first time or after a drop); the page should (re)send player:join.
   * - `onEvent(event, payload)`: a message from the host.
   * - `onDrop()`: an established link dropped; it keeps retrying until `disconnect()`.
   * - `onUnavailable()`: no match with that PIN (wrong PIN, or the host left). Stops.
   * - `onFailure()`: the first connection attempt failed (network, timeout, no WebRTC). Stops.
   */
  function createPeerClient({ onOpen, onEvent, onDrop, onUnavailable, onFailure }) {
    let peer = null;
    let connection = null;
    let targetId = null;
    let wanted = false;
    let everConnected = false;
    let attemptToken = 0;
    let attemptTimer = null;
    let retryTimer = null;

    function clearTimers() {
      clearTimeout(attemptTimer);
      clearTimeout(retryTimer);
      attemptTimer = null;
      retryTimer = null;
    }

    function discardPeer() {
      peer?.destroy();
      peer = null;
    }

    function stop() {
      wanted = false;
      attemptToken += 1;
      clearTimers();
      const current = connection;
      connection = null;
      current?.close();
      discardPeer();
    }

    /** An attempt failed or an open link dropped. */
    function lost() {
      if (!wanted) return;
      clearTimers();
      if (!everConnected) {
        stop();
        onFailure();
        return;
      }
      onDrop();
      retryTimer = setTimeout(attempt, CONFIG.RECONNECT_DELAY_MS);
    }

    function handlePeerError(error) {
      if (!wanted) return;
      if (error.type === "peer-unavailable") {
        stop();
        onUnavailable();
        return;
      }
      if (FATAL_CLIENT_ERRORS.has(error.type)) {
        stop();
        onFailure();
        return;
      }
      console.warn(`[peer] client error: ${error.type}`, error);
      // Signalling errors do not break an open data channel; only a pending attempt fails.
      if (!connection) {
        discardPeer();
        lost();
      }
    }

    function openDataChannel(token) {
      const dataConnection = peer.connect(targetId, { reliable: true, serialization: "json" });
      dataConnection.on("open", () => {
        if (token !== attemptToken) {
          dataConnection.close();
          return;
        }
        clearTimers();
        everConnected = true;
        connection = wrapConnection(dataConnection);
        connection.onMessage(onEvent);
        connection.onClose(() => {
          if (token !== attemptToken) return;
          connection = null;
          lost();
        });
        onOpen();
      });
    }

    function attempt() {
      if (!wanted || connection) return;
      clearTimers();
      attemptToken += 1;
      const token = attemptToken;
      attemptTimer = setTimeout(() => {
        if (token !== attemptToken) return;
        attemptToken += 1;
        discardPeer();
        lost();
      }, CONFIG.CONNECT_TIMEOUT_MS);

      if (peer && !peer.destroyed && peer.open && !peer.disconnected) {
        openDataChannel(token);
        return;
      }
      discardPeer();
      const Peer = PeerCtor();
      const createdPeer = new Peer(PEER_OPTIONS);
      peer = createdPeer;
      createdPeer.on("open", () => {
        if (token === attemptToken && !connection) openDataChannel(token);
      });
      createdPeer.on("error", (error) => {
        if (peer === createdPeer) handlePeerError(error);
      });
      keepRegistered(createdPeer);
    }

    function connect(pin) {
      stop();
      targetId = `${CONFIG.PEER_ID_PREFIX}${pin}`;
      wanted = true;
      everConnected = false;
      try {
        attempt();
      } catch (error) {
        console.error(error);
        stop();
        onFailure();
      }
    }

    // A phone coming back from the lock screen retries right away instead of waiting for the timer.
    globalScope.document?.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && wanted && everConnected && !connection && retryTimer) {
        attempt();
      }
    });

    return {
      connect,
      disconnect: stop,
      send: (event, payload) => connection?.send(event, payload),
      get connected() {
        return Boolean(connection);
      },
    };
  }

  globalScope.RECUERDOOT_PEER = { createPeerClient, listen };
})(globalThis);
