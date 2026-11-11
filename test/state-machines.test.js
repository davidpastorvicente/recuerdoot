const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { MACHINES, createStateMachine } = require("../assets/js/state-machines.js");

function reachableStates({ initial, transitions }) {
  const seen = new Set([initial]);
  const queue = [initial];
  while (queue.length > 0) {
    for (const target of transitions[queue.shift()]) {
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

describe("createStateMachine", () => {
  const definition = { name: "door", initial: "closed", transitions: { closed: ["open"], open: ["closed", "locked"], locked: [] } };

  it("starts in the initial state and follows declared transitions", () => {
    const machine = createStateMachine(definition);
    assert.equal(machine.state, "closed");
    assert.equal(machine.transition("open"), true);
    assert.equal(machine.state, "open");
    assert.ok(machine.is("open", "locked"));
  });

  it("rejects undeclared transitions without changing state", () => {
    const invalid = [];
    const machine = createStateMachine(definition, { onInvalid: (info) => invalid.push(info) });
    assert.equal(machine.transition("locked"), false);
    assert.equal(machine.state, "closed");
    assert.deepEqual(invalid, [{ name: "door", from: "closed", to: "locked", detail: null }]);
  });

  it("allows re-entering the current state and notifies listeners", () => {
    const machine = createStateMachine(definition);
    const seen = [];
    const unsubscribe = machine.subscribe((change) => seen.push(change));
    machine.transition("closed");
    machine.transition("open", { by: "test" });
    unsubscribe();
    machine.transition("closed");
    assert.deepEqual(seen, [
      { from: "closed", to: "closed", detail: null },
      { from: "closed", to: "open", detail: { by: "test" } },
    ]);
  });

  it("throws on unknown states and invalid definitions", () => {
    const machine = createStateMachine(definition);
    assert.throws(() => machine.transition("ajar"), /Unknown state "ajar"/);
    assert.throws(() => createStateMachine({ name: "bad", initial: "x", transitions: { a: [] } }), /Initial state/);
    assert.throws(() => createStateMachine({ name: "bad", initial: "a", transitions: { a: ["b"] } }), /undeclared state "b"/);
  });
});

describe("MACHINES", () => {
  for (const [key, definition] of Object.entries(MACHINES)) {
    it(`${key}: every state is reachable from "${definition.initial}"`, () => {
      assert.doesNotThrow(() => createStateMachine(definition));
      assert.deepEqual([...reachableStates(definition)].sort(), Object.keys(definition.transitions).sort());
    });
  }

  it("host: every in-game state can exit back to start", () => {
    const { transitions } = MACHINES.host;
    for (const [state, targets] of Object.entries(transitions)) {
      if (state !== "start") assert.ok(targets.includes("start"), `${state} cannot exit to start`);
    }
  });

  it("game: closed is terminal and reachable from every other phase", () => {
    const { transitions } = MACHINES.game;
    assert.deepEqual(transitions.closed, []);
    for (const [phase, targets] of Object.entries(transitions)) {
      if (phase !== "closed") assert.ok(targets.includes("closed"), `${phase} cannot close`);
    }
  });

  it("player: only a local tap or a rejoin leads to answered", () => {
    const sources = Object.entries(MACHINES.player.transitions)
      .filter(([, targets]) => targets.includes("answered"))
      .map(([state]) => state)
      .sort();
    assert.deepEqual(sources, ["answering", "countdown", "joining", "result", "waiting"]);
  });
});
