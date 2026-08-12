import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../modules/store.js";

test("store publishes changes and rejects unknown keys", () => {
  const store = createStore({ count: 0 });
  let renders = 0;
  store.subscribe(() => { renders += 1; });
  store.state.count = 1;
  assert.equal(renders, 1);
  assert.throws(() => { store.state.missing = true; }, /Unknown state key/);
});

test("batch publishes once", () => {
  const store = createStore({ a: 0, b: 0 });
  let renders = 0;
  store.subscribe(() => { renders += 1; });
  store.batch(() => { store.state.a = 1; store.state.b = 2; });
  assert.equal(renders, 1);
});
