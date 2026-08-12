import test from "node:test";
import assert from "node:assert/strict";
import {
  amendAgreement,
  approveObligation,
  confirmAgreement,
  fulfillObligation,
  proposeAgreement,
  transitionAgreement,
  validateTradeChain,
} from "../modules/agreements.js";

const request = { title: "Build shelving" };
const offer = {
  id: "o1",
  mode: "barter",
  gives: "Build shelves",
  wants: "Photography",
};

test("agreements require confirmation by every party", () => {
  let agreement = proposeAgreement({
    offer,
    request,
    requesterId: "a",
    providerId: "b",
  });
  agreement = confirmAgreement(agreement, "a");
  assert.equal(agreement.status, "proposed");
  agreement = confirmAgreement(agreement, "b");
  assert.equal(agreement.status, "agreed");
});

test("amendments reset confirmation and preserve history", () => {
  let agreement = proposeAgreement({
    offer,
    request,
    requesterId: "a",
    providerId: "b",
  });
  agreement = confirmAgreement(confirmAgreement(agreement, "a"), "b");
  agreement = amendAgreement(agreement, "a", {
    exchange: "Two photography sessions",
  });
  assert.equal(agreement.status, "proposed");
  assert.deepEqual(agreement.confirmations, ["a"]);
  assert.equal(agreement.version, 2);
});

test("a party cannot approve its own obligation", () => {
  let agreement = proposeAgreement({
    offer,
    request,
    requesterId: "a",
    providerId: "b",
  });
  const obligation = agreement.obligations.find((item) => item.partyId === "b");
  agreement = fulfillObligation(agreement, obligation.id, "b");
  assert.throws(
    () => approveObligation(agreement, obligation.id, "b"),
    /Another participating party/,
  );
  agreement = approveObligation(agreement, obligation.id, "a");
  assert.equal(
    agreement.obligations.find((item) => item.id === obligation.id).status,
    "fulfilled",
  );
});

test("invalid status jumps are rejected", () => {
  const agreement = proposeAgreement({
    offer,
    request,
    requesterId: "a",
    providerId: "b",
  });
  assert.throws(
    () => transitionAgreement(agreement, "completed", "a"),
    /Cannot move/,
  );
});

test("trade chains must form one closed reciprocal loop", () => {
  assert.equal(
    validateTradeChain([
      { from: "a", to: "b", value: "welding" },
      { from: "b", to: "c", value: "design" },
      { from: "c", to: "a", value: "lumber" },
    ]).valid,
    true,
  );
  assert.equal(
    validateTradeChain([
      { from: "a", to: "b", value: "welding" },
      { from: "b", to: "c", value: "design" },
      { from: "c", to: "d", value: "lumber" },
    ]).valid,
    false,
  );
});

test("trade chains reject duplicate providers and disconnected loops", () => {
  assert.equal(
    validateTradeChain([
      { from: "a", to: "b", value: "welding" },
      { from: "a", to: "c", value: "design" },
      { from: "c", to: "a", value: "lumber" },
    ]).valid,
    false,
  );
  assert.equal(
    validateTradeChain([
      { from: "a", to: "b", value: "one" },
      { from: "b", to: "a", value: "two" },
      { from: "c", to: "d", value: "three" },
      { from: "d", to: "c", value: "four" },
    ]).valid,
    false,
  );
});
