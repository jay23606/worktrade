export const AGREEMENT_STAGES = ["proposed", "agreed", "scheduled", "active", "review", "completed", "cancelled", "disputed"];

const transitions = {
  proposed: ["agreed", "cancelled"],
  agreed: ["scheduled", "active", "cancelled", "disputed"],
  scheduled: ["active", "cancelled", "disputed"],
  active: ["review", "cancelled", "disputed"],
  review: ["active", "completed", "disputed"],
  disputed: ["active", "cancelled", "completed"],
  completed: [],
  cancelled: [],
};

export function canTransition(from, to) {
  return Boolean(transitions[from]?.includes(to));
}

export function transitionAgreement(agreement, to, actorId, note = "") {
  if (!canTransition(agreement.status, to)) throw new Error(`Cannot move agreement from ${agreement.status} to ${to}`);
  if (!agreement.parties.includes(actorId)) throw new Error("Only an agreement participant can change its status");
  const next = structuredClone(agreement);
  next.status = to;
  next.history = [...(next.history || []), { from: agreement.status, to, actorId, note, at: new Date().toISOString() }];
  return next;
}

export function proposeAgreement({ offer, request, requesterId, providerId }) {
  if (requesterId === providerId) throw new Error("An agreement needs at least two distinct parties");
  return {
    id: crypto.randomUUID(),
    offerId: offer.id,
    status: "proposed",
    parties: [requesterId, providerId],
    confirmations: [],
    version: 1,
    scope: offer.gives,
    exchange: offer.wants,
    mode: offer.mode,
    obligations: [
      { id: crypto.randomUUID(), partyId: providerId, description: offer.gives, status: "pending" },
      { id: crypto.randomUUID(), partyId: requesterId, description: offer.wants, status: "pending" },
    ],
    history: [{ from: null, to: "proposed", actorId: requesterId, note: `Proposal selected for ${request.title}`, at: new Date().toISOString() }],
  };
}

export function confirmAgreement(agreement, actorId) {
  if (!agreement.parties.includes(actorId)) throw new Error("Only an agreement participant can confirm terms");
  const next = structuredClone(agreement);
  if (!next.confirmations.includes(actorId)) next.confirmations.push(actorId);
  if (next.confirmations.length === next.parties.length && next.status === "proposed") {
    next.status = "agreed";
    next.history.push({ from: "proposed", to: "agreed", actorId, note: "Every party confirmed the terms", at: new Date().toISOString() });
  }
  return next;
}

export function amendAgreement(agreement, actorId, changes) {
  if (!agreement.parties.includes(actorId)) throw new Error("Only a participant can propose an amendment");
  if (["completed", "cancelled"].includes(agreement.status)) throw new Error("Closed agreements cannot be amended");
  const next = structuredClone(agreement);
  next.version += 1;
  next.scope = changes.scope ?? next.scope;
  next.exchange = changes.exchange ?? next.exchange;
  next.confirmations = [actorId];
  next.status = "proposed";
  next.history.push({ from: agreement.status, to: "proposed", actorId, note: `Proposed amendment v${next.version}`, at: new Date().toISOString() });
  return next;
}

export function fulfillObligation(agreement, obligationId, actorId) {
  const next = structuredClone(agreement);
  const obligation = next.obligations.find((item) => item.id === obligationId);
  if (!obligation) throw new Error("Obligation not found");
  if (obligation.partyId !== actorId) throw new Error("Only the responsible party can mark an obligation fulfilled");
  obligation.status = "submitted";
  obligation.submittedAt = new Date().toISOString();
  return next;
}

export function approveObligation(agreement, obligationId, actorId) {
  const next = structuredClone(agreement);
  const obligation = next.obligations.find((item) => item.id === obligationId);
  if (!obligation) throw new Error("Obligation not found");
  if (obligation.partyId === actorId || !next.parties.includes(actorId)) throw new Error("Another participating party must approve fulfillment");
  if (obligation.status !== "submitted") throw new Error("Obligation must be submitted before approval");
  obligation.status = "fulfilled";
  obligation.approvedBy = actorId;
  obligation.approvedAt = new Date().toISOString();
  return next;
}

export function validateTradeChain(links) {
  if (!Array.isArray(links) || links.length < 3) return { valid: false, reason: "A chain requires at least three links" };
  const outgoing = new Map();
  for (const link of links) {
    if (!link.from || !link.to || link.from === link.to || !link.value?.trim()) return { valid: false, reason: "Every link needs distinct parties and described value" };
    if (outgoing.has(link.from)) return { valid: false, reason: "The initial model supports one outgoing obligation per participant" };
    outgoing.set(link.from, link.to);
  }
  let current = links[0].from;
  const visited = new Set();
  while (!visited.has(current) && outgoing.has(current)) { visited.add(current); current = outgoing.get(current); }
  if (current !== links[0].from || visited.size !== links.length) return { valid: false, reason: "Links must form one closed reciprocal chain" };
  return { valid: true };
}
