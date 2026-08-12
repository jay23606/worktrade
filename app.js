import { createStore } from "./modules/store.js";
import { cloneSeed } from "./data.js";
import {
  confirmAgreement,
  proposeAgreement,
  transitionAgreement,
} from "./modules/agreements.js";
import {
  acceptOffer,
  addProjectUpdate,
  askProposalQuestion,
  backendConfigured,
  closeRequest,
  createRequest as createRemoteRequest,
  deactivateMyAccount,
  exportMyData,
  getAgreementAmendments,
  getAgreementHistory,
  getEvidenceUrl,
  getMyAgreements,
  getMyOffers,
  getMyProfile,
  getMyRequests,
  getNotificationPreferences,
  getNotifications,
  getProjectMessages,
  getProjectUpdates,
  getProposalQuestions,
  getRequestMedia,
  getRequestOffers,
  getSession,
  handleCompletion,
  listPublicRequests,
  manageMilestone,
  manageRequestMedia,
  markNotificationsRead,
  performAgreementAction,
  proposeAmendment,
  requestLifecycleAction,
  respondAmendment,
  reviseOffer,
  saveNotificationPreferences,
  sendProjectMessage,
  setAgreementSchedule,
  signInWithEmail,
  signOut,
  submitOffer,
  submitReview,
  updateMyProfile,
  updateRequest,
  uploadRequestMedia,
  uploadWorkEvidence,
  withdrawOffer,
} from "./modules/backend.js";
import {
  discoverProfiles,
  getNetworkActivity,
  publishCompletion,
  setFollow,
} from "./modules/backend.js";
import {
  getNetworkInbox,
  respondCollaborationInvitation,
  saveNetworkSearch,
  sendCollaborationInvitation,
  sendIntroductionMessage,
  setSavedProfile,
  updateIntroductionWorkspace,
  confirmIntroductionWorkspace,
  convertIntroductionToRequest,
  manageNetworkItem,
  getCircleHub,
  createCircle,
  requestCircleMembership,
  inviteCircleMember,
  manageCircleMembership,
  saveCircleResource,
  deleteCircleResource,
  createCircleRequest,
  updateCircleSettings,
  getTradeChainHub,
  createTradeChain,
  reviseTradeChain,
  acceptTradeChain,
  activateTradeChain,
  manageTradeChainLink,
  manageTradeChain,
} from "./modules/backend.js";

const STORAGE_KEY = "worktrade:v1";
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
})();
const initial = saved?.requests ? saved : cloneSeed();
const store = createStore({
  view: "discover",
  query: "",
  category: "All",
  selectedId: null,
  session: null,
  remote: false,
  profile: initial.profile,
  requests: initial.requests,
  myOffers: [],
  notifications: [],
  notificationPreferences: null,
  networkProfiles: [],
  networkActivity: [],
  networkQuery: "",
  networkExchange: "",
  networkRemote: false,
  networkFollowingOnly: false,
  networkInbox: {
    invitations: [],
    messages: [],
    saved_profiles: [],
    saved_searches: [],
  },
  circleHub: { circles: [], members: [], resources: [], requests: [] },
  selectedCircleId: null,
  chainHub: { chains: [], suggestions: [] },
});
const { state } = store;
const main = document.querySelector("#main");
const modalRoot = document.querySelector("#modal-root");
const categories = [
  "All",
  "Build",
  "Repair",
  "Install",
  "Fabricate",
  "Restore",
  "Modify",
  "Maintain",
  "Inspect",
  "Diagnose",
];

const esc = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
const money = (value) =>
  value ? `$${Number(value).toLocaleString()}` : "Open budget";
const modeLabel = (mode) =>
  ({ cash: "Cash", barter: "Barter", hybrid: "Cash + barter" })[mode] || mode;
const persist = () =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ profile: state.profile, requests: state.requests }),
  );
const notify = (message) => {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
};
const updateRequests = (transform) => {
  state.requests = transform(structuredClone(state.requests));
  persist();
};

function shell(content, eyebrow = "Local work exchange") {
  return `<section class="page"><div class="page-head"><span class="eyebrow">${eyebrow}</span></div>${content}</section>`;
}

function renderDiscover() {
  const filtered = state.requests.filter(
    (request) =>
      request.status === "open" &&
      !(state.profile.blocked || []).includes(request.ownerId) &&
      (state.category === "All" || request.category === state.category) &&
      `${request.title} ${request.description} ${request.skills.join(" ")}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
  return shell(`
    <section class="hero">
      <div><h1>Useful work.<br><em>Fairly exchanged.</em></h1><p>Build, fix, install, restore, or maintain—trade money, skills, goods, or a thoughtful mix.</p>
      <div class="hero-actions"><button class="primary" data-action="post">Post work</button><button class="secondary" data-nav="network">Explore the network</button></div></div>
      <div class="balance-card"><span>Community pulse</span><strong>${state.requests.length} active stories</strong><div><b>12</b> skills offered <b>8</b> needs matched</div><p>No platform credits. People agree on value together.</p></div>
    </section>
    <section class="controls"><label class="search"><span>⌕</span><input id="search" value="${esc(state.query)}" placeholder="Search work, skills, or outcomes"></label><div class="chips">${categories.map((c) => `<button class="chip ${state.category === c ? "active" : ""}" data-category="${c}">${c}</button>`).join("")}</div></section>
    <div class="section-title"><div><span class="eyebrow">Open requests</span><h2>What can you help move forward?</h2></div><span>${filtered.length} matches</span></div>
    <div class="request-grid">${filtered.map(requestCard).join("") || `<div class="empty"><h3>No matching work</h3><p>Try another skill or category.</p></div>`}</div>
  `);
}

function requestCard(request) {
  return `<article class="request-card" data-open="${request.id}" tabindex="0">
    <div class="card-top"><span class="category">${esc(request.category)}</span><span>${request.distance} mi · ${esc(request.urgency)}</span></div>
    <h3>${esc(request.title)}</h3><p>${esc(request.description)}</p>
    <div class="tags">${request.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
    <div class="exchange"><span>Offers</span>${request.exchange.map((m) => `<b>${modeLabel(m)}</b>`).join("")}<strong>${money(request.cashBudget)}</strong></div>
    <footer><span class="mini-avatar">${request.initials}</span><span><b>${esc(request.owner)}</b><small>${esc(request.location)}</small></span><span class="offer-count">${request.offers.length} proposal${request.offers.length === 1 ? "" : "s"} →</span></footer>
  </article>`;
}

function renderDetail(request) {
  const isOwner = request.ownerId === "me";
  return shell(
    `<button class="back" data-nav="discover">← Back to requests</button>
    <div class="detail-grid"><article class="detail-main">
      <div class="card-top"><span class="category">${esc(request.category)}</span><span>${esc(request.status)}</span></div>
      ${isOwner && state.remote && request.status === "open" ? `<div class="owner-actions"><button class="secondary" data-action="edit-request">Edit request</button><button class="text-btn" data-request-action="close">Close</button><button class="text-btn" data-request-action="archive">Archive</button><button class="danger-text" data-request-action="cancel">Cancel</button></div>` : ""}
      <h1>${esc(request.title)}</h1><p class="lede">${esc(request.description)}</p>
      ${request.media?.length ? `<div class="request-media">${request.media.map((item, index) => `<figure><img src="${esc(item.url)}" alt="${esc(item.caption || request.title)}"><figcaption><b>${esc(item.label || "current")}</b> ${esc(item.caption || "")}${isOwner && state.remote ? ` <button data-delete-media="${item.id}">Remove</button>` : ""}</figcaption></figure>`).join("")}</div>` : ""}
      <div class="facts"><div><small>Location</small><b>${esc(request.location)}</b></div><div><small>Timing</small><b>${esc(request.urgency)}</b></div><div><small>Cash range</small><b>${money(request.cashBudget)}</b></div></div>
      <section><span class="eyebrow">Skills and capabilities</span><div class="tags large">${request.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></section>
      <section><span class="eyebrow">Value available in return</span><div class="value-list">${request.offersInReturn.map((item) => `<div><span>↔</span>${esc(item)}</div>`).join("")}</div></section>
      ${request.constraints ? `<section><span class="eyebrow">Constraints and site conditions</span><p>${esc(request.constraints)}</p></section>` : ""}
      ${request.hold ? holdCard(request.hold) : ""}
      ${request.milestones ? milestones(request) : ""}
      ${request.agreement?.history ? historySection(request.agreement.history) : ""}
      ${request.agreement ? evidenceSection(request) : ""}
      <section><div class="section-title"><div><span class="eyebrow">Project journal</span><h2>Progress in the open</h2></div></div>
        <div class="timeline">${request.updates.map((u) => `<div><span class="dot"></span><p><b>${esc(u.author)}</b> ${esc(u.text)}<small>${esc(u.date)}</small></p></div>`).join("") || "<p>No updates yet.</p>"}</div>
        ${request.status !== "open" ? `<form data-form="update" class="inline-form"><input name="text" required placeholder="Share a progress update"><button class="secondary">Post</button></form>` : ""}
      </section>
      <section><div class="section-title"><div><span class="eyebrow">Conversation</span><h2>Keep decisions beside the work.</h2></div></div>
        <div class="messages">${(request.messages || []).map((m) => `<div class="message ${m.authorId === state.profile.id ? "mine" : ""}"><b>${esc(m.author)}</b><p>${esc(m.text)}</p><small>${esc(m.date)}</small></div>`).join("") || `<p>No messages yet. Ask a clear, project-specific question.</p>`}</div>
        <form data-form="message" class="inline-form"><input name="text" required maxlength="1000" placeholder="Ask about scope, access, timing, or value"><button class="secondary">Send</button></form>
      </section>
    </article>
    <aside class="detail-side"><div class="person"><span class="avatar big">${request.initials}</span><div><small>Posted by</small><h3>${esc(request.owner)}</h3><p>${esc(request.location)}</p></div></div>
      ${request.agreement ? agreementCard(request) : isOwner ? `<div class="side-note"><b>Waiting for proposals</b><p>Compare scope and both sides of the exchange before selecting one.</p>${request.offers.length > 1 ? `<button class="secondary full" data-action="compare-offers">Compare proposals</button>` : ""}</div>` : `<button class="primary full" data-action="offer" data-id="${request.id}">Propose a trade</button>`}
      <div class="side-note"><b>Choose your own exchange</b><p>Cash, goods, services, labor, access, or a combination. WorkTrade does not assign artificial credits.</p></div>
      <div class="safety-actions"><button class="text-btn" data-action="follow">${(request.followers || []).includes("me") ? "Following" : "Follow project"}</button><button class="text-btn" data-action="report">Report concern</button><button class="text-btn" data-action="block" data-person="${request.ownerId}">Block user</button></div>
      ${request.offers.length ? `<section class="proposals"><span class="eyebrow">Proposals</span>${request.offers.map((o) => offerCard(o, isOwner, request.id)).join("")}</section>` : ""}
    </aside></div>`,
    "Work request",
  );
}

function offerCard(offer, isOwner, requestId) {
  return `<article class="offer"><div><span class="mini-avatar">${offer.initials}</span><b>${esc(offer.provider)}</b><span class="mode">${modeLabel(offer.mode)}</span></div><p><strong>Will provide:</strong> ${esc(offer.gives)}</p><p><strong>In exchange:</strong> ${esc(offer.wants)}</p><small>${esc(offer.duration)} · ${esc(offer.note)}</small>${offer.discussion?.length ? `<div class="proposal-discussion">${offer.discussion.map((q) => `<p><b>${esc(q.profiles?.display_name || "Participant")}:</b> ${esc(q.body)}</p>`).join("")}</div>` : ""}${isOwner ? `<button class="secondary full" data-accept="${offer.id}" data-request="${requestId}">Accept and start</button>` : ""}</article>`;
}

function agreementCard(request) {
  const agreement = request.agreement;
  const modern = Array.isArray(agreement.parties);
  const confirmed =
    modern && agreement.confirmations.includes(state.profile.id);
  const controls = modern ? agreementControls(agreement, confirmed) : "";
  return `<div class="agreement"><span class="eyebrow">${esc(agreement.status)} agreement${agreement.version ? ` · v${agreement.version}` : ""}</span><h3>${esc(agreement.provider || "Shared terms")}</h3><p>${esc(typeof agreement.exchange === "object" ? agreement.exchange.summary : agreement.exchange || agreement.summary)}</p><div class="progress"><span style="width:${agreement.progress || 0}%"></span></div><small>${agreement.progress || 0}% of milestones complete</small>${controls}</div>${pendingAmendment(agreement)}${agreement.obligations?.length ? obligationCards(agreement) : ""}`;
}

function pendingAmendment(agreement) {
  const item = agreement.amendments?.find((x) => x.status === "proposed");
  if (!item) return "";
  const mine = item.proposed_by === state.profile.id;
  return `<div class="amendment-card"><span class="eyebrow">Pending amendment · v${item.version}</span><p><b>Scope:</b> ${esc(item.scope)}</p><p><b>Exchange:</b> ${esc(item.exchange_snapshot?.summary || "")}</p><p><b>Reason:</b> ${esc(item.reason)}</p>${mine ? `<small>Waiting for your counterparty.</small>` : `<div><button class="secondary" data-amendment="accept:${item.id}">Accept changes</button><button class="text-btn" data-amendment="decline:${item.id}">Decline</button></div>`}</div>`;
}

function obligationCards(agreement) {
  return `<div class="obligations"><span class="eyebrow">Exchange obligations</span>${agreement.obligations
    .map((item) => {
      const mine = item.responsible_profile_id === state.profile.id;
      return `<article><div><b>${mine ? "Your side" : "Their side"}</b><span>${esc(item.status)}</span></div><p>${esc(item.description)}</p>${item.status === "pending" && mine ? `<button class="secondary" data-obligation="fulfill:${item.id}">Submit fulfillment</button>` : ""}${item.status === "submitted" && !mine ? `<button class="secondary" data-obligation="approve:${item.id}">Approve fulfillment</button>` : ""}</article>`;
    })
    .join("")}</div>`;
}

function agreementControls(agreement, confirmed) {
  if (agreement.status === "proposed")
    return confirmed
      ? `<small class="agreement-note">Waiting for the other party to confirm.</small>`
      : `<button class="secondary full" data-agreement="confirm">Confirm terms</button>`;
  const next = {
    agreed: ["scheduled", "Schedule work"],
    scheduled: ["active", "Start work"],
  }[agreement.status];
  const completion =
    agreement.status === "active"
      ? `<button class="secondary full" data-completion="request">Request completion approval</button>`
      : agreement.status === "review" &&
          agreement.completion_requested_by !== state.profile.id
        ? `<button class="secondary full" data-completion="approve">Approve completion</button><button class="secondary full" data-completion="return">Return to active work</button>`
        : "";
  return `${next ? `<button class="secondary full" data-agreement="${next[0]}">${next[1]}</button>` : ""}${completion}${!["completed", "cancelled", "disputed"].includes(agreement.status) ? `<button class="text-btn full" data-action="schedule">Set schedule</button><button class="text-btn full" data-action="amend">Propose amendment</button><div class="agreement-links"><button data-agreement="disputed">Raise concern</button><button data-agreement="cancelled">Cancel</button></div>` : ""}`;
}

function holdCard(hold) {
  return `<section class="hold"><div class="hold-icon">Ⅱ</div><div><span class="eyebrow">Dependency hold · ${esc(hold.type)}</span><h3>${esc(hold.detail)}</h3><p>Next action: ${esc(hold.owner)} · Review ${esc(hold.reviewDate)}</p></div><button class="text-btn" data-action="resolve-hold">Resolve</button></section>`;
}

function milestones(request) {
  const planning = ["proposed", "agreed", "scheduled"].includes(request.status);
  return `<section><span class="eyebrow">Milestones</span><div class="milestones">${request.milestones.map((m, index) => `<div class="milestone-item"><button data-milestone="${state.remote ? m.id : index}" class="${m.done || m.completed_at ? "done" : ""}"><span>${m.done || m.completed_at ? "✓" : index + 1}</span>${esc(m.title)}${m.due_at ? `<small class="${new Date(m.due_at) < new Date() && !m.completed_at ? "overdue" : ""}">${new Date(m.due_at).toLocaleDateString()}</small>` : ""}</button>${planning ? `<button class="milestone-remove" data-remove-milestone="${m.id}" aria-label="Remove ${esc(m.title)}">×</button>` : ""}</div>`).join("")}</div>${planning && state.remote ? `<button class="text-btn" data-action="add-milestone">Add milestone</button>` : ""}${request.status !== "completed" ? `<button class="text-btn" data-action="hold">Add dependency hold</button>` : `<button class="text-btn" data-action="review">Leave contextual feedback</button>${state.remote ? `<button class="secondary" data-action="publish-completion">Publish completion story</button>` : ""}`}</section>`;
}

function historySection(items) {
  return `<section><span class="eyebrow">Agreement history</span><div class="history-list">${items.map((item) => `<div><span>${new Date(item.created_at).toLocaleString()}</span><b>${esc(item.from_status || "Created")} → ${esc(item.to_status)}</b><p>${esc(item.note || "Agreement updated")}</p></div>`).join("") || "<p>No history yet.</p>"}</div></section>`;
}

function evidenceSection(request) {
  return `<section><div class="section-title"><div><span class="eyebrow">Proof of work</span><h2>Evidence tied to this agreement</h2></div></div><div class="evidence-grid">${(request.evidence || []).map((item) => `<article>${item.url ? `<img src="${esc(item.url)}" alt="${esc(item.description)}">` : ""}<div><b>${esc(item.skill)}</b><p>${esc(item.description)}</p><small>${item.verified_at ? "Verified by a participant" : "Participant evidence"}</small></div></article>`).join("") || `<p>No evidence has been added yet.</p>`}</div>${state.remote ? `<form data-form="evidence" data-agreement="${request.agreement.id}" class="form-grid evidence-form"><label>Skill demonstrated<input name="skill" required maxlength="100" placeholder="Carpentry"></label><label>Photo<input name="photo" type="file" required accept="image/jpeg,image/png,image/webp"></label><label class="wide">What does this show?<input name="description" required maxlength="500" placeholder="Installed shelving after final leveling"></label><button class="secondary wide">Add private project evidence</button></form>` : ""}</section>`;
}

function renderWorkspace() {
  const posted = state.requests.filter((r) => r.ownerId === state.profile.id);
  const active = state.requests.filter(
    (r) => r.agreement && !["completed", "cancelled"].includes(r.status),
  );
  const needsAction = active.filter(
    (r) =>
      (r.status === "proposed" &&
        !r.agreement.confirmations.includes(state.profile.id)) ||
      (r.status === "review" &&
        r.agreement.completion_requested_by !== state.profile.id) ||
      r.agreement.obligations?.some(
        (o) =>
          o.status === "submitted" &&
          o.responsible_profile_id !== state.profile.id,
      ),
  );
  const completed = state.requests.filter((r) => r.status === "completed");
  return shell(
    `<div class="section-title"><div><span class="eyebrow">My work</span><h1>Keep every commitment visible.</h1></div><button class="primary" data-action="post">Post work</button></div>
    <div class="stats"><div><b>${needsAction.length}</b><span>Need your action</span></div><div><b>${active.length}</b><span>Active agreements</span></div><div><b>${posted.filter((r) => r.status === "draft").length}</b><span>Draft requests</span></div><div><b>${state.myOffers.filter((o) => o.status === "pending").length}</b><span>Pending proposals</span></div></div>
    ${dashboardGroup("Needs your action", needsAction)}${dashboardGroup("Requests I posted", posted, true)}${offerDashboard()}${dashboardGroup("Active work", active)}${dashboardGroup("Completed history", completed)}`,
    "Personal workspace",
  );
}

function dashboardGroup(title, items, requestControls = false) {
  return `<section class="dashboard-group"><h2>${title}</h2>${items.map((r) => `<article class="work-row" data-open="${r.id}" tabindex="0"><span class="category">${esc(r.status)}</span><div><h3>${esc(r.title)}</h3><p>${r.hold ? `Waiting on ${esc(r.hold.type)}` : r.agreement ? `Next: ${nextAction(r)}` : esc(r.urgency)}</p></div>${requestControls ? `<div class="dashboard-actions">${r.status === "draft" ? `<button data-lifecycle="publish:${r.id}:${r.version}">Publish</button>` : ""}<button data-lifecycle="duplicate:${r.id}:${r.version}">Duplicate</button>${["cancelled", "completed"].includes(r.status) && !r.agreement ? `<button data-lifecycle="reopen:${r.id}:${r.version}">Reopen</button>` : ""}</div>` : `<b>${r.agreement?.progress || 0}%</b>`}</article>`).join("") || `<div class="empty">Nothing here.</div>`}</section>`;
}
function nextAction(r) {
  if (r.status === "proposed")
    return r.agreement.confirmations.includes(state.profile.id)
      ? "Waiting for confirmation"
      : "Confirm terms";
  if (r.status === "review")
    return r.agreement.completion_requested_by === state.profile.id
      ? "Waiting for approval"
      : "Review completion";
  return r.hold ? "Resolve dependency" : "Continue milestones";
}
function offerDashboard() {
  return `<section class="dashboard-group"><h2>Proposals I submitted</h2>${state.myOffers.map((o) => `<article class="work-row"><span class="category">${esc(o.status)}</span><div><h3>${esc(o.work_requests?.title || "Work request")}</h3><p>${esc(o.scope)} · ${esc(o.exchange_summary)}</p></div>${o.status === "pending" ? `<div class="dashboard-actions"><button data-edit-offer="${o.id}">Revise</button><button data-withdraw-offer="${o.id}">Withdraw</button></div>` : ""}</article>`).join("") || `<div class="empty">No submitted proposals.</div>`}</section>`;
}

function renderLegacyNetwork() {
  return shell(
    `<section class="network-hero"><span class="eyebrow">Needs + offers</span><h1>The useful things around us<br>are closer than we think.</h1><p>Find reciprocal matches between what people need and what their neighbors can offer.</p></section>
    <div class="match-card"><div><span class="match-label">Potential three-way trade</span><h2>A chain no one could complete alone</h2><p>You offer product photography to Maya. Maya offers a produce share to Sam. Sam offers carpentry for your workshop shelving.</p><div class="trade-chain"><span>You<small>Photography</small></span><i>→</i><span>Maya<small>Produce</small></span><i>→</i><span>Sam<small>Carpentry</small></span><i>→</i><span>You</span></div></div><button class="secondary" data-action="interest">I’m interested</button></div>
    <div class="two-col"><section><span class="eyebrow">People nearby</span><h2>Built on demonstrated capability</h2>${peopleCards()}</section><section><span class="eyebrow">Community circles</span><h2>Start with people you trust</h2>${circleCard("circle-makers", "Richmond Makers", "128 members · 34 skills", "Fabrication, electronics, woodworking, and shared shop access.")}${circleCard("circle-neighbors", "Manchester Neighbors", "76 members · 19 active needs", "Local maintenance, gardens, tools, and mutual aid.")}</section></div>`,
    "Community network",
  );
}

function circleCard(id, name, meta, description) {
  const joined = state.profile.joinedCircles?.includes(id);
  return `<div class="circle"><b>${name}</b><span>${meta}</span><p>${description}</p><button class="secondary" data-circle="${id}">${joined ? "Joined" : "Join circle"}</button></div>`;
}

function peopleCards() {
  return [
    {
      id: "sam",
      name: "Sam Rivera",
      initials: "SR",
      offers: "Carpentry · Site work",
      needs: "Photography · Bookkeeping",
      proof: 18,
    },
    {
      id: "asha",
      name: "Asha Patel",
      initials: "AP",
      offers: "Electronics · Diagnostics",
      needs: "Studio shelving",
      proof: 27,
    },
  ]
    .map(
      (p) =>
        `<article class="person-card"><span class="avatar big">${p.initials}</span><div><h3>${p.name}</h3><p><b>Offers:</b> ${p.offers}</p><p><b>Needs:</b> ${p.needs}</p><small>${p.proof} verified work records</small><button class="text-btn" data-follow-person="${p.id}">${state.profile.following?.includes(p.id) ? "Following" : "Follow"}</button></div></article>`,
    )
    .join("");
}

function renderNetworkBase() {
  const profiles = state.networkProfiles || [];
  const activity = state.networkActivity || [];
  return shell(
    `<section class="network-hero"><span class="eyebrow">Work network</span><h1>Find people through what they can do<br>and what they need next.</h1><p>Profiles are grounded in completed work, contextual reviews, and concrete offers—not follower counts.</p></section>
    <form data-form="network-search" class="controls network-filters"><label class="search"><span>⌕</span><input name="query" value="${esc(state.networkQuery || "")}" placeholder="Search skills, needs, names, or locations"></label><select name="exchange"><option value="">Any exchange</option><option value="barter">Barter</option><option value="cash">Cash</option><option value="hybrid">Cash + barter</option></select><label><input type="checkbox" name="remote" ${state.networkRemote ? "checked" : ""}> Remote available</label><button class="secondary">Find people</button></form>
    <div class="two-col"><section><span class="eyebrow">Suggested collaborators</span><h2>${profiles.length} people with useful overlap</h2><div class="people-list">${profiles.map(networkPersonCard).join("") || `<div class="empty"><h3>No public profiles yet</h3><p>Try broader filters, or publish your own offers and needs.</p></div>`}</div></section><section><span class="eyebrow">Work activity</span><h2>Useful things moving forward</h2><div class="activity-list">${activity.map(activityCard).join("") || `<div class="empty"><p>Completed work and new public requests will appear here.</p></div>`}</div></section></div>`,
    "Community network",
  );
}

function networkPersonCard(p) {
  const caps = p.capabilities || [];
  const offers = caps
    .filter((x) => x.direction === "offer")
    .map((x) => x.label);
  const needs = caps.filter((x) => x.direction === "need").map((x) => x.label);
  const myNeeds = (state.profile.needs || []).map((x) => x.toLowerCase());
  const overlap = offers.filter((x) =>
    myNeeds.some(
      (n) => x.toLowerCase().includes(n) || n.includes(x.toLowerCase()),
    ),
  );
  return `<article class="person-card"><span class="avatar big">${esc(
    (p.display_name || "WT")
      .split(/\s+/)
      .map((x) => x[0])
      .join("")
      .slice(0, 2),
  )}</span><div><h3>${esc(p.display_name)}</h3><small>${esc(p.location_text || "Location not listed")}${p.remote_available ? " · Remote available" : ""}</small><p><b>Offers:</b> ${esc(offers.join(" · ") || "Not listed")}</p><p><b>Needs:</b> ${esc(needs.join(" · ") || "Not listed")}</p>${overlap.length ? `<p class="match-reason">Matches what you need: ${esc(overlap.join(", "))}</p>` : ""}<small>${p.completed_count || 0} completed · ${p.review_count || 0} reviews</small><div><button class="text-btn" data-view-profile="${p.id}">View evidence</button>${state.session && p.id !== state.profile.id ? `<button class="text-btn" data-follow-person="${p.id}">${state.profile.following?.includes(p.id) ? "Following" : "Follow"}</button>` : ""}</div></div></article>`;
}
function activityCard(item) {
  return `<article class="activity-card"><span class="category">${esc(item.type === "portfolio" ? "Completed work" : "Open request")}</span><h3>${esc(item.title)}</h3><p>${esc(item.summary || "")}</p><small>${esc(item.actor_name || "WorkTrade member")} · ${new Date(item.created_at).toLocaleDateString()}</small></article>`;
}
function publicProfileModal(p) {
  const caps = p.capabilities || [];
  openModal(
    `<span class="eyebrow">Public work profile</span><h2>${esc(p.display_name)}</h2><p>${esc(p.bio || "No biography yet.")}</p><small>${esc(p.location_text || "Location not listed")}${p.remote_available ? " · Remote available" : ""}</small><div class="two-col"><section><h3>Can offer</h3><div class="tags">${
      caps
        .filter((x) => x.direction === "offer")
        .map((x) => `<span>${esc(x.label)}</span>`)
        .join("") || "<p>None listed.</p>"
    }</div></section><section><h3>Needs</h3><div class="tags">${
      caps
        .filter((x) => x.direction === "need")
        .map((x) => `<span>${esc(x.label)}</span>`)
        .join("") || "<p>None listed.</p>"
    }</div></section></div><section><span class="eyebrow">Verified portfolio</span><div class="proof-grid">${(p.portfolio || []).map((x) => `<div><b>${esc(x.title)}</b><p>${esc(x.summary)}</p><small>Linked to completed agreement</small></div>`).join("") || "<p>No public portfolio entries yet.</p>"}</div></section><section><span class="eyebrow">Contextual reviews</span>${(p.reviews || []).map((x) => `<blockquote><p>${esc(x.body || "Completed successfully.")}</p><small>Reliability ${x.reliability}/5 · Communication ${x.communication}/5 · Quality ${x.work_quality}/5</small></blockquote>`).join("") || "<p>No published reviews yet.</p>"}</section>`,
  );
}

function networkInbox(inbox) {
  return `<div class="inbox-list">${
    (inbox.invitations || [])
      .map((i) => {
        const incoming = i.recipient_id === state.profile.id;
        const messages = (inbox.messages || []).filter(
          (m) => m.invitation_id === i.id,
        );
        const workspace = i.workspace;
        const bothConfirmed =
          workspace &&
          workspace.sender_confirmed_version === workspace.version &&
          workspace.recipient_confirmed_version === workspace.version;
        const accepted = i.status === "accepted";
        return `<article><div><span class="category">${esc(i.status)}</span> <b>${esc(incoming ? i.sender_name : i.recipient_name)}</b><small>${incoming ? " invited you" : " was invited by you"}</small></div><p><b>Need:</b> ${esc(i.need_text)} <b>Offer:</b> ${esc(i.offer_text)}</p>${i.note ? `<p>${esc(i.note)}</p>` : ""}${incoming && i.status === "pending" ? `<button class="secondary" data-invite-response="accepted:${i.id}">Accept</button> <button class="text-btn" data-invite-response="declined:${i.id}">Decline</button> <button class="text-btn" data-invite-response="muted:${i.id}">Mute</button>` : ""}${accepted ? `<div class="workspace-summary"><b>${workspace?.scope ? esc(workspace.scope) : "Planning workspace not started"}</b><small>${workspace ? `Terms v${workspace.version}${bothConfirmed ? " · confirmed by both" : " · confirmation pending"}` : "Define scope, exchange, and availability together"}</small><button class="secondary" data-workspace="${i.id}">Open planning workspace</button>${bothConfirmed ? `<button class="primary" data-convert-intro="${i.id}">Create private work draft</button>` : ""}</div><div class="intro-thread">${messages.map((m) => `<p><b>${esc(m.author_name)}:</b> ${esc(m.body)}</p>`).join("")}<form data-form="intro-message" data-invitation="${i.id}" class="inline-form"><input name="body" required maxlength="1500" placeholder="Discuss the possible collaboration"><button class="secondary">Send</button></form></div>` : ""}<div class="conversation-safety">${["declined", "muted", "accepted"].includes(i.status) ? `<button class="text-btn" data-network-manage="invitation:archive:${i.id}">Archive</button>` : ""}<button class="text-btn" data-network-manage="profile:report:${i.id}">Report</button><button class="danger-text" data-network-manage="profile:block:${i.id}">Block</button></div></article>`;
      })
      .join("") ||
    '<div class="empty"><p>No invitations yet. Invite someone whose work fits yours.</p></div>'
  }</div>`;
}
function renderNetwork() {
  const profiles = state.networkProfiles || [];
  const activity = state.networkActivity || [];
  const inbox = state.networkInbox || {
    invitations: [],
    messages: [],
    saved_profiles: [],
    saved_searches: [],
  };
  return shell(
    `<section class="network-hero"><span class="eyebrow">Work network</span><h1>Find people through what they can do<br>and what they need next.</h1><p>Profiles are grounded in completed work, contextual reviews, and concrete offers—not follower counts.</p></section><form data-form="network-search" class="controls network-filters"><label class="search"><span>⌕</span><input name="query" value="${esc(state.networkQuery || "")}" placeholder="Search skills, needs, names, or locations"></label><select name="exchange"><option value="">Any exchange</option><option value="barter">Barter</option><option value="cash">Cash</option><option value="hybrid">Cash + barter</option></select><label><input type="checkbox" name="remote" ${state.networkRemote ? "checked" : ""}> Remote available</label><button class="secondary">Find people</button>${state.session ? `<button type="button" class="text-btn" data-action="save-search">Save search</button>` : ""}</form>${state.session ? `<section class="network-inbox"><div class="section-title"><div><span class="eyebrow">Introductions</span><h2>Your collaboration inbox</h2></div><span>${inbox.invitations.filter((x) => x.recipient_id === state.profile.id && x.status === "pending").length} awaiting you</span></div>${networkInbox(inbox)}</section>` : ""}<div class="two-col"><section><span class="eyebrow">Suggested collaborators</span><h2>${profiles.length} people with useful overlap</h2><div class="people-list">${profiles.map(networkPersonCard).join("") || '<div class="empty"><p>No matching public profiles yet.</p></div>'}</div></section><section><div class="feed-heading"><div><span class="eyebrow">Work activity</span><h2>Useful things moving forward</h2></div>${state.session ? `<label><input type="checkbox" data-following-feed ${state.networkFollowingOnly ? "checked" : ""}> Following only</label>` : ""}</div><div class="activity-list">${activity.map(activityCard).join("") || '<div class="empty"><p>No activity matches this feed.</p></div>'}</div></section></div>`,
    "Community network",
  );
}

function socialPersonCard(p) {
  if (!state.session || p.id === state.profile.id) return networkPersonCard(p);
  const saved = (state.networkInbox?.saved_profiles || []).includes(p.id);
  const actions = `<div class="social-actions"><button class="text-btn" data-invite-person="${p.id}">Propose exchange</button><button class="text-btn" data-save-person="${p.id}">${saved ? "Saved" : "Save"}</button></div>`;
  return networkPersonCard(p).replace(
    "</div></article>",
    `${actions}</div></article>`,
  );
}

function hydrateNetworkSocial() {
  if (state.view !== "network") return;
  const profiles = state.networkProfiles || [];
  document
    .querySelectorAll(".people-list .person-card")
    .forEach((card, index) => {
      const profile = profiles[index];
      if (!profile || !state.session || profile.id === state.profile.id) return;
      const actions = document.createElement("div");
      actions.className = "social-actions";
      const saved = (state.networkInbox?.saved_profiles || []).includes(
        profile.id,
      );
      actions.innerHTML = `<button class="text-btn" data-invite-person="${profile.id}">Propose exchange</button><button class="text-btn" data-save-person="${profile.id}">${saved ? "Saved" : "Save"}</button>`;
      card.querySelector("div")?.append(actions);
      const theirNeeds = (profile.capabilities || [])
        .filter((x) => x.direction === "need")
        .map((x) => x.label);
      const myOffers = (state.profile.offers || []).map((x) => x.toLowerCase());
      const reciprocal = theirNeeds.filter((need) =>
        myOffers.some(
          (offer) =>
            need.toLowerCase().includes(offer) ||
            offer.includes(need.toLowerCase()),
        ),
      );
      if (reciprocal.length)
        card
          .querySelector("div")
          ?.insertAdjacentHTML(
            "beforeend",
            `<p class="match-reason">You can help with ${esc(reciprocal.join(", "))}.</p>`,
          );
      if (profile.match_score > 0)
        card
          .querySelector("h3")
          ?.insertAdjacentHTML(
            "afterend",
            `<small class="match-score">Match ${profile.match_score} · skills, location, availability, exchange fit, and proven work</small>`,
          );
    });
  const saved = state.networkInbox?.saved_searches || [];
  if (saved.length)
    document
      .querySelector(".network-inbox")
      ?.insertAdjacentHTML(
        "afterbegin",
        `<div class="saved-searches"><span>Saved searches</span>${saved.map((search) => `<button class="chip" data-saved-search="${search.id}">${esc(search.name)}</button><button class="saved-search-delete" data-network-manage="search:delete:${search.id}" aria-label="Delete ${esc(search.name)}">×</button>`).join("")}</div>`,
      );
  if (state.session) {
    const hub = state.circleHub || {
      circles: [],
      members: [],
      resources: [],
      requests: [],
    };
    const selected = hub.circles.find(
      (circle) => circle.id === state.selectedCircleId,
    );
    document
      .querySelector(".network-inbox")
      ?.insertAdjacentHTML(
        "beforebegin",
        `<section class="circles-hub"><div class="section-title"><div><span class="eyebrow">Trusted circles</span><h2>Exchange within communities you know.</h2></div><button class="primary" data-action="create-circle">Create circle</button></div><div class="circle-grid">${hub.circles.map((circle) => `<article class="circle"><span class="category">${esc(circle.visibility)}</span><h3>${esc(circle.name)}</h3><p>${esc(circle.description || "")}</p><small>${circle.member_count} members · ${circle.request_count} open work</small><button class="secondary" data-open-circle="${circle.id}">${circle.membership?.status === "active" ? "Open circle" : circle.membership?.status === "requested" ? "Requested" : circle.membership?.status === "invited" ? "Review invitation" : "Request access"}</button></article>`).join("") || '<div class="empty"><p>No circles are visible yet.</p></div>'}</div>${selected ? circleDetail(selected, hub) : ""}</section>`,
      );
    if (["owner", "moderator"].includes(selected?.membership?.role))
      document
        .querySelector(".circle-detail .section-title>div:last-child")
        ?.insertAdjacentHTML(
          "beforeend",
          `<button class="text-btn" data-circle-settings="${selected.id}">Edit rules</button>`,
        );
    if (selected?.membership?.status === "active")
      document
        .querySelector(".circle-detail")
        ?.insertAdjacentHTML("beforeend", renderChainHub(selected));
    document
      .querySelectorAll(".chain-list .chain-card")
      .forEach((card, index) => {
        const chain = (state.chainHub.chains || [])[index];
        if (
          chain?.status === "active" &&
          (chain.links || []).every((link) => !link.fulfilled_at)
        )
          card.insertAdjacentHTML(
            "beforeend",
            `<button class="secondary" data-chain-edit="${chain.id}">Renegotiate or replace participant</button>`,
          );
      });
  }
}

function renderChainHub(circle) {
  const hub = state.chainHub || { chains: [], suggestions: [] };
  const suggestions = (hub.suggestions || []).filter((suggestion) =>
    (suggestion.participants || []).includes(state.profile.id),
  );
  return `<section class="chain-hub"><div class="section-title"><div><span class="eyebrow">Multi-person barter</span><h2>Closed loops of useful value</h2></div><button class="primary" data-create-chain="${circle.id}">Build a chain</button></div>${suggestions.length ? `<div class="chain-suggestions">${suggestions.map((s, index) => `<article><span class="match-label">Suggested reciprocal loop</span><p>${esc(s.explanation)}</p><button class="secondary" data-suggest-chain="${index}:${circle.id}">Review suggestion</button></article>`).join("")}</div>` : ""}<div class="chain-list">${(hub.chains || []).map(chainCard).join("") || '<div class="empty"><p>No trade chains in this circle yet.</p></div>'}</div></section>`;
}
function chainCard(chain) {
  const accepted = (chain.acceptances || []).filter(
    (a) => a.version === chain.version,
  );
  const participantIds = [
    ...new Set((chain.links || []).map((l) => l.from_profile_id)),
  ];
  const mineAccepted = accepted.some((a) => a.profile_id === state.profile.id);
  const allAccepted = accepted.length === participantIds.length;
  return `<article class="chain-card"><div class="card-top"><span class="category">${esc(chain.status)}</span><span>v${chain.version} · ${esc(chain.execution_mode)}</span></div><h3>${esc(chain.title)}</h3><p>${esc(chain.description || "")}</p><div class="trade-chain">${(chain.links || []).map((link) => `<span>${esc(link.from_name)}<small>${esc(link.value_description)} → ${esc(link.to_name)}</small></span>`).join("<i>→</i>")}</div><small>${accepted.length}/${participantIds.length} confirmed</small>${chain.status === "proposed" && !mineAccepted ? `<button class="primary" data-chain-accept="${chain.id}:${chain.version}">Accept entire chain</button>` : ""}${chain.status === "accepted" && allAccepted ? `<button class="primary" data-chain-activate="${chain.id}">Activate obligations</button>` : ""}${["proposed", "accepted"].includes(chain.status) ? `<button class="secondary" data-chain-edit="${chain.id}">Revise proposal</button>` : ""}${chain.status === "active" ? `<div class="chain-links">${chain.links.map((link) => `<article><b>${esc(link.from_name)} → ${esc(link.to_name)}</b><p>${esc(link.value_description)}</p><small>${link.approved_at ? "Approved" : link.fulfilled_at ? "Awaiting recipient approval" : "Pending"}${link.due_at ? ` · due ${new Date(link.due_at).toLocaleDateString()}` : ""}</small>${link.from_profile_id === state.profile.id && !link.fulfilled_at ? `<button data-chain-link="fulfill:${link.id}">Submit fulfillment</button>` : ""}${link.to_profile_id === state.profile.id && link.fulfilled_at && !link.approved_at ? `<button data-chain-link="approve:${link.id}">Approve receipt</button>` : ""}<button class="text-btn" data-chain-hold="${chain.id}:${link.id}">Add dependency</button></article>`).join("")}</div>` : ""}${(
    chain.holds || []
  )
    .filter((h) => !h.resolved_at)
    .map(
      (h) =>
        `<div class="hold"><div><b>${esc(h.kind)}</b><p>${esc(h.detail)}</p></div><button data-chain-resolve-hold="${chain.id}:${h.id}">Resolve</button></div>`,
    )
    .join(
      "",
    )}<div class="intro-thread">${(chain.messages || []).map((m) => `<p><b>${esc(m.author_name)}:</b> ${esc(m.body)}</p>`).join("")}<form data-form="chain-message" data-chain="${chain.id}" class="inline-form"><input name="body" required maxlength="1500" placeholder="Message every participant"><button class="secondary">Send</button></form></div><details><summary>Audit history</summary>${(chain.history || []).map((h) => `<p><b>${esc(h.event)}</b> ${esc(h.note)} <small>${new Date(h.created_at).toLocaleString()}</small></p>`).join("")}</details>${!["completed", "cancelled", "disputed"].includes(chain.status) ? `<div class="conversation-safety"><button class="text-btn" data-chain-manage="cancelled:${chain.id}">Cancel chain</button><button class="danger-text" data-chain-manage="disputed:${chain.id}">Raise dispute</button></div>` : ""}</article>`;
}

function circleDetail(circle, hub) {
  const membership = circle.membership;
  if (!membership)
    return `<section class="circle-detail"><h2>${esc(circle.name)}</h2><p>${esc(circle.description || "")}</p><button class="primary" data-circle-membership="request:${circle.id}:${state.profile.id}">Request access</button></section>`;
  if (membership.status === "invited")
    return `<section class="circle-detail"><h2>${esc(circle.name)}</h2><p>You were invited to this ${esc(circle.visibility)} circle.</p><button class="primary" data-circle-membership="accept:${circle.id}:${state.profile.id}">Accept invitation</button><button class="text-btn" data-circle-membership="decline:${circle.id}:${state.profile.id}">Decline</button></section>`;
  if (membership.status !== "active")
    return `<section class="circle-detail"><h2>${esc(circle.name)}</h2><p>Your membership request is ${esc(membership.status)}.</p></section>`;
  const members = hub.members.filter((item) => item.circle_id === circle.id);
  const resources = hub.resources.filter(
    (item) => item.circle_id === circle.id,
  );
  const requests = hub.requests.filter((item) => item.circle_id === circle.id);
  const moderator = ["owner", "moderator"].includes(membership.role);
  return `<section class="circle-detail"><div class="section-title"><div><span class="eyebrow">${esc(membership.role)} · ${esc(circle.visibility)}</span><h2>${esc(circle.name)}</h2><p>${esc(circle.description || "")}</p></div><div><button class="secondary" data-circle-post="${circle.id}">Post private work</button><button class="secondary" data-circle-resource="${circle.id}">Share resource</button>${membership.role !== "owner" ? `<button class="text-btn" data-circle-membership="leave:${circle.id}:${state.profile.id}">Leave</button>` : ""}</div></div><div class="circle-rules"><b>Circle rules</b><p>${esc(circle.rules || "No additional rules have been posted.")}</p></div><div class="circle-columns"><section><h3>Members and circle work</h3>${members.map((member) => `<article class="circle-member"><b>${esc(member.display_name)}</b><span>${esc(member.role)} · ${member.completed_inside} completed here</span>${moderator && member.profile_id !== state.profile.id ? `${member.status === "requested" ? `<button data-circle-membership="approve:${circle.id}:${member.profile_id}">Approve</button><button data-circle-membership="decline:${circle.id}:${member.profile_id}">Decline</button>` : `<button data-circle-membership="remove:${circle.id}:${member.profile_id}">Remove</button>`}${membership.role === "owner" && member.status === "active" ? `<button data-circle-role="${circle.id}:${member.profile_id}:${member.role === "moderator" ? "member" : "moderator"}">${member.role === "moderator" ? "Make member" : "Make moderator"}</button>` : ""}` : ""}</article>`).join("")}<button class="text-btn" data-circle-invite="${circle.id}">Invite profile</button></section><section><h3>Shared resources</h3>${resources.map((resource) => `<article class="circle-resource"><span class="category">${esc(resource.kind)}</span><b>${esc(resource.name)}</b><p>${esc(resource.description)}</p><small>${esc(resource.owner_name)} · ${esc(resource.availability_text || "Ask about availability")}</small>${resource.owner_id === state.profile.id || moderator ? `<button class="text-btn" data-delete-circle-resource="${resource.id}">Remove</button>` : ""}</article>`).join("") || "<p>No shared resources yet.</p>"}</section></div><section><h3>Private circle activity</h3>${requests.map((request) => `<article class="activity-card"><span class="category">${esc(request.stage)}</span><h3>${esc(request.title)}</h3><p>${esc(request.description)}</p><small>${esc(request.owner_name)}</small></article>`).join("") || "<p>No circle work has been posted yet.</p>"}</section></section>`;
}

function invitationModal(profile) {
  openModal(
    `<span class="eyebrow">Collaboration invitation</span><h2>Propose an exchange with ${esc(profile.display_name)}.</h2><p>They choose whether to open a private conversation.</p><form data-form="collaboration-invite" data-profile="${profile.id}" class="form-grid"><label class="wide">What do you need?<input name="need" required maxlength="500" value="${esc((state.profile.needs || []).join(", "))}"></label><label class="wide">What can you offer?<input name="offer" required maxlength="500" value="${esc((state.profile.offers || []).join(", "))}"></label><label class="wide">Short note<textarea name="note" maxlength="1000" placeholder="Why this might be a useful fit"></textarea></label><label class="wide">Related request<select name="request"><option value="">No specific request</option>${state.requests
      .filter((r) => r.ownerId === state.profile.id && r.status === "open")
      .map((r) => `<option value="${r.id}">${esc(r.title)}</option>`)
      .join(
        "",
      )}</select></label><button class="primary wide">Send invitation</button></form>`,
  );
}
function saveSearchModal() {
  openModal(
    `<span class="eyebrow">Saved search</span><h2>Keep this network search.</h2><form data-form="save-network-search" class="form-grid"><label class="wide">Name<input name="name" required maxlength="80" placeholder="Nearby carpenters open to barter"></label><button class="primary wide">Save search</button></form>`,
  );
}

function workspaceModal(invitation) {
  const w = invitation.workspace || {
    version: 1,
    scope: "",
    responsibilities: {},
    materials: "",
    exclusions: "",
    exchange_terms: "",
    proposed_windows: "",
    timezone: "America/New_York",
  };
  openModal(
    `<span class="eyebrow">Shared planning workspace · v${w.version}</span><h2>Shape the work before committing.</h2><p>Any edit clears both confirmations. Both people must confirm the same version before conversion.</p><form data-form="intro-workspace" data-invitation="${invitation.id}" data-version="${w.version}" class="form-grid"><label class="wide">Scope and desired outcome<textarea name="scope" required>${esc(w.scope)}</textarea></label><label>My responsibilities<textarea name="mine">${esc(w.responsibilities?.[state.profile.id] || "")}</textarea></label><label>Their responsibilities<textarea name="theirs">${esc(w.responsibilities?.other || "")}</textarea></label><label class="wide">Materials, tools, and access<textarea name="materials">${esc(w.materials)}</textarea></label><label class="wide">Exclusions and boundaries<textarea name="exclusions">${esc(w.exclusions)}</textarea></label><label class="wide">Exchange terms<textarea name="exchange_terms" required>${esc(w.exchange_terms)}</textarea></label><label>Proposed availability<textarea name="proposed_windows" placeholder="Saturday mornings; after 5pm weekdays">${esc(w.proposed_windows)}</textarea></label><label>Time zone<select name="timezone"><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option></select></label><button class="secondary wide">Save revised terms</button></form>${invitation.workspace ? `<button class="primary full" data-confirm-workspace="${invitation.id}:${w.version}">Confirm current terms</button>` : ""}`,
  );
}

function createCircleModal() {
  openModal(
    `<span class="eyebrow">New trusted circle</span><h2>Create a place for known collaborators.</h2><form data-form="create-circle" class="form-grid"><label class="wide">Circle name<input name="name" required minlength="2" maxlength="100"></label><label class="wide">Purpose<textarea name="description" required maxlength="1000"></textarea></label><label>Visibility<select name="visibility"><option value="private">Invite-only</option><option value="public">Publicly discoverable</option></select></label><label class="wide">Rules<textarea name="rules" required placeholder="Who belongs, what may be posted, safety expectations, and moderation norms"></textarea></label><button class="primary wide">Create circle</button></form>`,
  );
}
function circleSettingsModal(circle) {
  openModal(
    `<span class="eyebrow">Circle settings</span><h2>Edit rules and visibility.</h2><form data-form="circle-settings" data-circle="${circle.id}" class="form-grid"><label class="wide">Purpose<textarea name="description" required>${esc(circle.description || "")}</textarea></label><label>Visibility<select name="visibility"><option value="private">Invite-only</option><option value="public">Publicly discoverable</option></select></label><label class="wide">Rules<textarea name="rules" required>${esc(circle.rules || "")}</textarea></label><button class="primary wide">Save circle settings</button></form>`,
  );
  modalRoot.querySelector("[name=visibility]").value = circle.visibility;
}

function circleResourceModal(circleId) {
  openModal(
    `<span class="eyebrow">Shared circle resource</span><h2>What can members coordinate around?</h2><form data-form="circle-resource" data-circle="${circleId}" class="form-grid"><label>Type<select name="kind"><option>tool</option><option>equipment</option><option>workspace</option><option>vehicle</option><option>material</option><option>access</option><option>other</option></select></label><label>Name<input name="name" required maxlength="120"></label><label class="wide">Description<textarea name="description"></textarea></label><label class="wide">Availability and conditions<input name="availability"></label><button class="primary wide">Share with circle</button></form>`,
  );
}
function circleInviteModal(circleId) {
  openModal(
    `<span class="eyebrow">Circle invitation</span><h2>Invite a visible WorkTrade profile.</h2><form data-form="circle-invite" data-circle="${circleId}" class="form-grid"><label class="wide">Profile<select name="profile" required>${(
      state.networkProfiles || []
    )
      .filter((p) => p.id !== state.profile.id)
      .map((p) => `<option value="${p.id}">${esc(p.display_name)}</option>`)
      .join(
        "",
      )}</select></label><button class="primary wide">Send invitation</button></form>`,
  );
}
function circlePostModal(circleId) {
  openModal(
    `<span class="eyebrow">Private circle work</span><h2>Post work only members can see.</h2><form data-form="circle-post" data-circle="${circleId}" class="form-grid"><label class="wide">Title<input name="title" required minlength="5" maxlength="140"></label><label>Type<select name="kind">${categories
      .slice(1)
      .map((c) => `<option value="${c.toLowerCase()}">${c}</option>`)
      .join(
        "",
      )}<option value="other">Other</option></select></label><label>Location<input name="location"></label><label class="wide">Desired outcome<textarea name="description" required></textarea></label><label>Skills<input name="skills" placeholder="Carpentry, design"></label><label>Timing<input name="urgency" placeholder="Flexible"></label><label class="wide">Exchange terms<input name="exchange_summary" required placeholder="Garden help for welding, cash, or a mix"></label><label class="wide">Constraints<textarea name="constraints"></textarea></label><button class="primary wide">Post inside circle</button></form>`,
  );
}
function chainBuilderModal(circleId, suggestion = null, chain = null) {
  const members = (state.circleHub.members || [])
    .filter((m) => m.circle_id === circleId && m.status === "active")
    .sort(
      (a, b) =>
        Number(b.profile_id === state.profile.id) -
        Number(a.profile_id === state.profile.id),
    );
  const links =
    chain?.links ||
    suggestion?.links ||
    members.slice(0, 3).map((member, index, list) => ({
      from_profile_id: member.profile_id,
      to_profile_id: list[(index + 1) % list.length]?.profile_id || "",
      value_description: "",
      position: index,
      conditions: "",
      due_at: "",
    }));
  if (members.length < 3)
    return notify(
      "A circle needs at least three active members for a trade chain",
    );
  const memberOptions = (selected) =>
    members
      .map(
        (m) =>
          `<option value="${m.profile_id}" ${m.profile_id === selected ? "selected" : ""}>${esc(m.display_name)}</option>`,
      )
      .join("");
  openModal(
    `<span class="eyebrow">${chain ? "Revise" : "Propose"} reciprocal chain</span><h2>Every person gives once and receives once.</h2><p>Changes reset all confirmations. Describe concrete deliverables without converting them to platform credits.</p><form data-form="chain-builder" data-circle="${circleId}" ${chain ? `data-chain="${chain.id}" data-version="${chain.version}"` : ""} class="form-grid"><label class="wide">Title<input name="title" required maxlength="140" value="${esc(chain?.title || "Circle reciprocal exchange")}"></label><label class="wide">Purpose<textarea name="description">${esc(chain?.description || suggestion?.explanation || "")}</textarea></label><label>Execution<select name="execution_mode"><option value="sequential">Sequential</option><option value="simultaneous">Simultaneous</option><option value="conditional">Conditional</option></select></label><div class="wide chain-builder-links">${links.map((link, index) => `<fieldset><legend>Link ${index + 1}</legend><label>Provider<select name="from_${index}">${memberOptions(link.from_profile_id)}</select></label><label>Recipient<select name="to_${index}">${memberOptions(link.to_profile_id)}</select></label><label>Contribution<input name="value_${index}" required value="${esc(link.value_description || "")}"></label><label>Due date<input name="due_${index}" type="date" value="${link.due_at ? link.due_at.slice(0, 10) : ""}"></label><label>Conditions<input name="conditions_${index}" value="${esc(link.conditions || "")}"></label></fieldset>`).join("")}</div><input type="hidden" name="link_count" value="${links.length}"><button class="primary wide">${chain ? "Publish revision" : "Propose to everyone"}</button></form>`,
  );
  modalRoot.querySelector("[name=execution_mode]").value =
    chain?.execution_mode || "sequential";
}
function chainHoldModal(chainId, linkId) {
  openModal(
    `<span class="eyebrow">Chain dependency</span><h2>What must happen before this link can proceed?</h2><form data-form="chain-hold" data-chain="${chainId}" data-link="${linkId}" class="form-grid"><label>Type<select name="kind"><option value="materials">Materials</option><option value="equipment">Equipment</option><option value="weather">Weather</option><option value="access_permission">Access or permission</option><option value="customer_decision">Decision</option><option value="specialist">Specialist</option><option value="third_party">Third party</option><option value="custom">Other</option></select></label><label>Review date<input name="review_at" type="date"></label><label class="wide">Detail<textarea name="detail" required></textarea></label><button class="primary wide">Place dependency hold</button></form>`,
  );
}

function renderProfile() {
  const p = state.profile;
  return shell(
    `<section class="profile-head"><span class="avatar giant">${p.initials}</span><div><span class="eyebrow">Your WorkTrade profile</span><h1>${esc(p.name)}</h1><p>${esc(p.bio)}</p><small>${esc(p.location)}</small></div><button class="secondary profile-edit" data-action="edit-profile">Edit profile</button></section>
    <div class="two-col"><section class="list-panel"><span class="eyebrow">I can offer</span><h2>Skills, goods, and access</h2><div class="editable-list">${p.offers.map((x, i) => `<span>${esc(x)}<button data-remove="offers:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="offers" class="inline-form"><input name="item" required placeholder="Add something you can offer"><button class="secondary">Add</button></form></section>
    <section class="list-panel warm"><span class="eyebrow">I need</span><h2>Things that could move you forward</h2><div class="editable-list">${p.needs.map((x, i) => `<span>${esc(x)}<button data-remove="needs:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="needs" class="inline-form"><input name="item" required placeholder="Add something you need"><button class="secondary">Add</button></form></section></div>
    <section class="proof"><span class="eyebrow">Proof of work</span><h2>A reputation grounded in real outcomes.</h2><div class="proof-grid"><div><b>Storefront deck restoration</b><span>Carpentry · Exterior finishing</span><p>Verified by Nia Brooks</p></div><div><b>Product launch photography</b><span>Photography · Art direction</span><p>Verified by Maya Chen</p></div></div>${backendConfigured ? `<div class="account-panel" id="account-panel"><p>Checking account…</p></div>` : `<div class="account-panel"><b>Device-local demonstration</b><p>Real accounts become available when this installation is connected to its own Supabase project.</p></div>`}<button class="danger-text" data-action="reset">Reset demo data</button></section>`,
    "Profile and capabilities",
  );
}

function render() {
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === state.view));
  if (state.view === "detail")
    main.innerHTML = renderDetail(
      state.requests.find((r) => r.id === state.selectedId),
    );
  else if (state.view === "workspace") main.innerHTML = renderWorkspace();
  else if (state.view === "network") main.innerHTML = renderNetwork();
  else if (state.view === "profile") main.innerHTML = renderProfile();
  else main.innerHTML = renderDiscover();
  hydrateNetworkSocial();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true">${content}<button class="modal-x" data-modal-close aria-label="Close">×</button></section></div>`;
  setTimeout(
    () => modalRoot.querySelector("input, select, textarea")?.focus(),
    0,
  );
}
function closeModal() {
  modalRoot.innerHTML = "";
}

function postModal() {
  openModal(`<span class="eyebrow">New work request</span><h2>What outcome do you need?</h2><p>Describe the work, then decide what kinds of value you are open to exchanging.</p><form data-form="post" class="form-grid">
    <label class="wide">Title<input name="title" required placeholder="Build workshop storage shelves"></label><label>Type<select name="category">${categories
      .slice(1)
      .map((c) => `<option>${c}</option>`)
      .join(
        "",
      )}</select></label><label>Location<input name="location" required value="Richmond, VA"></label>
    <label class="wide">Desired outcome<textarea name="description" required placeholder="Describe the result and current conditions."></textarea></label><label class="wide">Constraints and site conditions<textarea name="constraints" placeholder="Access hours, dimensions, known hazards, required cleanup…"></textarea></label><label>Skills, comma separated<input name="skills" required placeholder="Carpentry, design"></label><label>Cash budget<input name="budget" type="number" min="0" placeholder="Optional"></label><label>Location visibility<select name="location_visibility"><option value="region">Show city or region</option><option value="participants">Participants only</option><option value="private">Private until agreement</option></select></label>
    <fieldset class="wide"><legend>Exchange options</legend><label><input type="checkbox" name="exchange" value="cash"> Cash</label><label><input type="checkbox" name="exchange" value="barter" checked> Barter</label><label><input type="checkbox" name="exchange" value="hybrid" checked> Cash + barter</label></fieldset>
    <label class="wide">What can you offer?<input name="returns" required placeholder="Web design, lumber, cash"></label><label>Reference photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><label>Photo caption<input name="photo_caption" maxlength="200" placeholder="Existing wall and work area"></label><div class="wide form-actions"><button class="secondary" name="intent" value="draft">Save draft</button><button class="primary" name="intent" value="publish">Publish request</button></div></form>`);
}

function offerModal(id) {
  openModal(`<span class="eyebrow">Trade proposal</span><h2>Make the exchange clear.</h2><p>Describe both sides. A good proposal values scope, risk, materials, and time without forcing everything into cash.</p><form data-form="offer" data-id="${id}" class="form-grid">
    <label>Exchange<select name="mode"><option value="hybrid">Cash + barter</option><option value="barter">Barter</option><option value="cash">Cash</option></select></label><label>Cash component<input name="cash" type="number" min="0" placeholder="0"></label>
    <label class="wide">What will you provide?<textarea name="gives" required placeholder="Scope and deliverables"></textarea></label><label class="wide">What is excluded?<textarea name="exclusions" placeholder="Permits, electrical work, finish materials…"></textarea></label><label class="wide">What would you receive?<input name="wants" required placeholder="$400 plus bookkeeping help"></label><label>Expected duration<input name="duration" required placeholder="Two weekends"></label><label>Offer expires<input name="expires_at" type="date"></label><label>Provider supplies<input name="provider_supplies" placeholder="Tools, labor, fasteners"></label><label>Requester supplies<input name="requester_supplies" placeholder="Site access, lumber, power"></label><label class="wide">Proposed milestones, one per line<textarea name="milestones" placeholder="Confirm measurements\nBuild components\nInstall and review"></textarea></label><label class="wide">Questions before committing<textarea name="questions" placeholder="Is weekend access available?"></textarea></label><button class="primary wide">Send proposal</button></form>`);
}

function amendmentModal(request) {
  const a = request.agreement;
  openModal(
    `<span class="eyebrow">Agreement amendment</span><h2>Changes require the other party's acceptance.</h2><form data-form="amendment" data-agreement="${a.id}" data-version="${a.version}" class="form-grid"><label class="wide">Updated scope<textarea name="scope" required>${esc(a.scope_snapshot || "")}</textarea></label><label class="wide">Updated exchange summary<input name="exchange" required value="${esc(a.exchange?.summary || "")}"></label><label class="wide">Why is this changing?<textarea name="reason" required></textarea></label><button class="primary wide">Propose amendment</button></form>`,
  );
}
function milestoneModal(request) {
  openModal(
    `<span class="eyebrow">Planning milestone</span><h2>Add a clear checkpoint.</h2><form data-form="milestone" data-agreement="${request.agreement.id}" data-version="${request.agreement.version}" class="form-grid"><label class="wide">Milestone title<input name="title" required></label><label>Responsible party<select name="responsible"><option value="${request.agreement.requester_id}">Requester</option><option value="${request.agreement.provider_id}">Provider</option></select></label><label>Due date<input name="due_at" type="date"></label><button class="primary wide">Add milestone</button></form>`,
  );
}
function reviseOfferModal(offer) {
  openModal(
    `<span class="eyebrow">Revise proposal</span><h2>Update pending terms.</h2><form data-form="revise-offer" data-id="${offer.id}" class="form-grid"><label>Exchange<select name="mode"><option value="cash">Cash</option><option value="barter">Barter</option><option value="hybrid">Cash + barter</option></select></label><label>Duration<input name="duration" value="${esc(offer.duration_text || "")}"></label><label class="wide">Scope<textarea name="scope" required>${esc(offer.scope)}</textarea></label><label class="wide">Exclusions<textarea name="exclusions">${esc(offer.exclusions || "")}</textarea></label><label class="wide">Exchange summary<input name="exchange_summary" required value="${esc(offer.exchange_summary)}"></label><label class="wide">Questions<textarea name="questions">${esc(offer.questions || "")}</textarea></label><label>Expires<input name="expires_at" type="date" value="${offer.expires_at ? offer.expires_at.slice(0, 10) : ""}"></label><button class="primary wide">Save revision</button></form>`,
  );
  modalRoot.querySelector("[name=mode]").value = offer.mode;
}
function scheduleModal(request) {
  const a = request.agreement;
  openModal(
    `<span class="eyebrow">Work schedule</span><h2>Set practical timing.</h2><form data-form="schedule" data-agreement="${a.id}" data-version="${a.version}" class="form-grid"><label>Proposed start<input name="start_at" type="datetime-local" value="${a.proposed_start_at ? a.proposed_start_at.slice(0, 16) : ""}"></label><label>Time zone<select name="timezone"><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option></select></label><label class="wide">Working windows<textarea name="working_windows" placeholder="Saturdays 8–4; no work during store hours">${esc(a.working_windows || "")}</textarea></label><button class="primary wide">Save schedule</button></form>`,
  );
}
function compareOffersModal(request) {
  openModal(
    `<span class="eyebrow">Proposal comparison</span><h2>Compare the whole exchange.</h2><div class="comparison">${request.offers.map((o) => `<article><h3>${esc(o.provider)}</h3><b>${modeLabel(o.mode)}</b><dl><dt>Scope</dt><dd>${esc(o.gives)}</dd><dt>Exclusions</dt><dd>${esc(o.exclusions || "None stated")}</dd><dt>Exchange</dt><dd>${esc(o.wants)}</dd><dt>Duration</dt><dd>${esc(o.duration)}</dd><dt>Responsibilities</dt><dd>${esc(JSON.stringify(o.responsibilities || {}))}</dd><dt>Expires</dt><dd>${o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "No expiration"}</dd></dl><form data-form="proposal-question" data-offer="${o.id}" class="inline-form"><input name="body" required placeholder="Ask about this proposal"><button class="secondary">Ask</button></form><button class="primary full" data-accept="${o.id}" data-request="${request.id}">Select proposal</button></article>`).join("")}</div>`,
  );
}

function holdModal(id) {
  openModal(
    `<span class="eyebrow">Dependency hold</span><h2>What does the work depend on?</h2><form data-form="hold" data-id="${id}" class="form-grid"><label>Type<select name="type"><option>Materials</option><option>Equipment</option><option>Weather</option><option>Access or permission</option><option>Customer decision</option><option>Specialist</option><option>Third party</option><option>Custom</option></select></label><label>Next action owner<input name="owner" required placeholder="Customer, provider, conditions…"></label><label class="wide">What is needed?<input name="detail" required placeholder="A dry 48-hour weather window"></label><label>Review date<input name="reviewDate" type="date" required></label><button class="primary wide">Place hold</button></form>`,
  );
}

function reportModal(id) {
  openModal(
    `<span class="eyebrow">Safety report</span><h2>Tell moderators what happened.</h2><p>Reports are private. Immediate danger should be reported to local emergency services.</p><form data-form="report" data-id="${id}" class="form-grid"><label>Concern<select name="reason"><option>Unsafe work or conditions</option><option>Fraud or misrepresentation</option><option>Harassment</option><option>Regulated or prohibited work</option><option>Spam</option><option>Other</option></select></label><label class="wide">Details<textarea name="detail" required maxlength="2000"></textarea></label><button class="primary wide">Submit private report</button></form>`,
  );
}

function completionStoryModal(request) {
  openModal(
    `<span class="eyebrow">Completion story</span><h2>Turn finished work into trusted proof.</h2><p>The entry stays linked to this completed agreement. Do not include private addresses or contact details.</p><form data-form="completion-story" data-agreement="${request.agreement.id}" class="form-grid"><label class="wide">Portfolio title<input name="title" required maxlength="140" value="${esc(request.title)}"></label><label class="wide">What was accomplished?<textarea name="summary" required maxlength="2000"></textarea></label><label class="wide">How was value exchanged?<textarea name="exchange" maxlength="1000" placeholder="Labor for materials, cash plus design help…"></textarea></label><label>Visibility<select name="visibility"><option value="public">Public profile</option><option value="members">Members only</option><option value="private">Private record</option></select></label><button class="primary wide">Publish verified story</button></form>`,
  );
}

function reviewModal(request) {
  const agreement = request.agreement;
  const subjectId = agreement.parties.find((id) => id !== state.profile.id);
  openModal(
    `<span class="eyebrow">Completion feedback</span><h2>Review this specific exchange.</h2><form data-form="review" data-agreement="${agreement.id}" data-subject="${subjectId}" class="form-grid">${["reliability", "communication", "work_quality", "exchange_fairness"].map((name) => `<label>${name.replaceAll("_", " ")}<select name="${name}">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>`).join("")}<label class="wide">What should future collaborators know?<textarea name="body" maxlength="2000"></textarea></label><button class="primary wide">Publish contextual review</button></form>`,
  );
}

function signInModal() {
  openModal(
    `<span class="eyebrow">Sign in</span><h2>Use a secure email link.</h2><p>No password is stored by WorkTrade. We will send a one-time sign-in link.</p><form data-form="sign-in" class="form-grid"><label class="wide">Email<input name="email" type="email" autocomplete="email" required></label><button class="primary wide">Send sign-in link</button></form>`,
  );
}

function editRequestModal(request) {
  openModal(
    `<span class="eyebrow">Edit work request</span><h2>Update the desired outcome.</h2><p>Once a proposal is selected, the request is frozen and changes belong in a mutually confirmed agreement amendment.</p><form data-form="edit-request" data-id="${request.id}" data-version="${request.version}" class="form-grid"><label class="wide">Title<input name="title" required value="${esc(request.title)}"></label><label>Type<select name="category">${categories
      .slice(1)
      .map(
        (c) =>
          `<option ${c === request.category ? "selected" : ""}>${c}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Location<input name="location" value="${esc(request.location)}"></label><label class="wide">Desired outcome<textarea name="description" required>${esc(request.description)}</textarea></label><label>Skills<input name="skills" value="${esc(request.skills.join(", "))}"></label><label>Cash budget<input name="budget" type="number" min="0" value="${request.cashBudget || ""}"></label><label class="wide">Timing<input name="urgency" value="${esc(request.urgency)}"></label><button class="primary wide">Save changes</button></form>`,
  );
}

function notificationsModal() {
  const unread = state.notifications.filter((item) => !item.read_at);
  openModal(
    `<span class="eyebrow">Notifications</span><div class="section-title"><h2>What changed</h2>${unread.length ? `<button class="text-btn" data-action="read-all">Mark all read</button>` : ""}</div><div class="notification-list">${state.notifications.map((item) => `<button data-notification="${item.id}" data-request="${item.request_id || ""}" class="${item.read_at ? "" : "unread"}"><span>${esc(item.kind)}</span><b>${esc(item.title)}</b><p>${esc(item.body)}</p><small>${new Date(item.created_at).toLocaleString()}</small></button>`).join("") || `<p>No notifications yet.</p>`}</div>`,
  );
}

function preferencesModal() {
  const p = state.notificationPreferences || {};
  openModal(
    `<span class="eyebrow">Notification preferences</span><h2>Choose what reaches you.</h2><p>Email delivery is queued for future activation; these preferences are already stored and will be honored.</p><form data-form="preferences" class="preference-form">${[
      ["in_app", "In-app notifications"],
      ["email_proposals", "Proposal emails"],
      ["email_messages", "Message emails"],
      ["email_agreements", "Agreement emails"],
      ["email_reminders", "Reminder emails"],
    ]
      .map(
        ([name, label]) =>
          `<label><span>${label}</span><input type="checkbox" name="${name}" ${p[name] ? "checked" : ""}></label>`,
      )
      .join("")}<button class="primary">Save preferences</button></form>`,
  );
}

function profileModal() {
  const profile = state.profile;
  openModal(
    `<span class="eyebrow">Work profile</span><h2>Show how you can participate.</h2><form data-form="profile" class="form-grid"><label class="wide">Display name<input name="display_name" required minlength="2" maxlength="80" value="${esc(profile.name)}"></label><label>General location<input name="location_text" maxlength="120" value="${esc(profile.location)}"></label><label>Work radius (km)<input name="work_radius_km" type="number" min="0" max="1000" value="${profile.workRadius || ""}"></label><label class="wide">Short biography<textarea name="bio" maxlength="500">${esc(profile.bio)}</textarea></label><label class="wide">Availability<input name="availability_text" value="${esc(profile.availability || "")}"></label><label class="wide">Tools, workspace, vehicles, and equipment<textarea name="resources_text">${esc(profile.resources || "")}</textarea></label><label>Visibility<select name="profile_visibility"><option value="public">Public</option><option value="members">Members</option><option value="private">Private</option></select></label><label><input type="checkbox" name="remote_available" ${profile.remoteAvailable ? "checked" : ""}> Available for remote work</label><button class="primary wide">Save profile</button></form>`,
  );
  modalRoot.querySelector("[name=profile_visibility]").value =
    profile.visibility || "public";
}

function deactivateModal() {
  openModal(
    `<span class="eyebrow">Deactivate account</span><h2>Remove your public presence.</h2><p>Open requests will be cancelled, pending proposals withdrawn, and profile details replaced. Completed agreement history remains pseudonymous for the other participant. Active agreements must be resolved first.</p><form data-form="deactivate" class="form-grid"><label class="wide">Type DEACTIVATE to confirm<input name="confirmation" required pattern="DEACTIVATE"></label><button class="primary wide">Deactivate and sign out</button></form>`,
  );
}

function downloadExport(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `worktrade-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    state.view = nav.dataset.nav;
    state.selectedId = null;
    return;
  }
  const card = event.target.closest("[data-open]");
  if (card) {
    state.selectedId = card.dataset.open;
    state.view = "detail";
    return;
  }
  const category = event.target.closest("[data-category]");
  if (category) {
    state.category = category.dataset.category;
    return;
  }
  if (
    event.target.closest("[data-modal-close]") ||
    event.target === modalRoot.querySelector("[data-modal-backdrop]")
  )
    closeModal();
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "post") postModal();
  if (action === "save-search") saveSearchModal();
  if (action === "create-circle") createCircleModal();
  if (action === "offer")
    offerModal(event.target.closest("[data-id]").dataset.id);
  if (action === "interest")
    notify("Interest noted — introductions are next on the roadmap.");
  if (action === "hold") holdModal(state.selectedId);
  if (action === "review")
    reviewModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "amend")
    amendmentModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "add-milestone")
    milestoneModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "schedule")
    scheduleModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "compare-offers")
    compareOffersModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "publish-completion")
    completionStoryModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "follow") {
    updateRequests((list) => {
      const r = list.find((x) => x.id === state.selectedId);
      r.followers ||= [];
      r.followers = r.followers.includes("me")
        ? r.followers.filter((id) => id !== "me")
        : [...r.followers, "me"];
      return list;
    });
    notify("Project follow updated");
  }
  if (action === "report") reportModal(state.selectedId);
  if (action === "block") {
    const person = event.target.closest("[data-person]").dataset.person;
    const profile = structuredClone(state.profile);
    profile.blocked ||= [];
    if (!profile.blocked.includes(person)) profile.blocked.push(person);
    state.profile = profile;
    persist();
    state.view = "discover";
    notify("User blocked on this device");
  }
  if (action === "resolve-hold") {
    const request = state.requests.find((x) => x.id === state.selectedId);
    if (state.remote)
      performAgreementAction(
        "resolve_hold",
        request.agreement.id,
        request.agreement.version,
        { hold_id: request.hold.id },
      )
        .then(loadRemoteWorkspace)
        .then(() => notify("Dependency resolved"))
        .catch((error) => notify(error.message));
    else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === state.selectedId);
        r.hold = null;
        r.updates.push({
          id: crypto.randomUUID(),
          author: state.profile.name,
          text: "Resolved the dependency hold. Work can move forward.",
          date: "Today",
        });
        return list;
      });
      notify("Dependency resolved");
    }
  }
  if (action === "reset") {
    localStorage.removeItem(STORAGE_KEY);
    const seed = cloneSeed();
    store.batch(() => {
      state.profile = seed.profile;
      state.requests = seed.requests;
    });
    notify("Demo data reset");
  }
  if (action === "sign-in") signInModal();
  if (action === "edit-profile") profileModal();
  if (action === "edit-request")
    editRequestModal(
      state.requests.find((item) => item.id === state.selectedId),
    );
  if (action === "notifications") notificationsModal();
  if (action === "notification-preferences") preferencesModal();
  if (action === "read-all")
    markNotificationsRead()
      .then(loadNotifications)
      .then(notificationsModal)
      .catch((error) => notify(error.message));
  if (action === "export-data")
    exportMyData()
      .then(downloadExport)
      .then(() => notify("Your data export is ready"))
      .catch((error) => notify(error.message));
  if (action === "deactivate") deactivateModal();
  if (action === "sign-out")
    signOut()
      .then(() => {
        const seed = cloneSeed();
        store.batch(() => {
          state.session = null;
          state.remote = false;
          state.profile = seed.profile;
          state.requests = seed.requests;
        });
        notify("Signed out — showing the device demo");
      })
      .catch((error) => notify(error.message));
  const accept = event.target.closest("[data-accept]");
  if (accept) {
    if (state.remote)
      acceptOffer(accept.dataset.accept)
        .then(loadRemoteWorkspace)
        .then(() => notify("Proposal selected — awaiting mutual confirmation"))
        .catch((error) => notify(error.message));
    else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === accept.dataset.request);
        const o = r.offers.find((x) => x.id === accept.dataset.accept);
        r.agreement = {
          ...proposeAgreement({
            offer: o,
            request: r,
            requesterId: r.ownerId,
            providerId:
              o.provider === state.profile.name ? "me" : `provider:${o.id}`,
          }),
          provider: o.provider,
          progress: 0,
        };
        r.agreement = confirmAgreement(r.agreement, r.ownerId);
        r.status = "proposed";
        r.milestones = [
          { title: "Confirm scope", done: false },
          { title: "Prepare inputs", done: false },
          { title: "Complete work", done: false },
          { title: "Review exchange", done: false },
        ];
        r.updates.push({
          id: crypto.randomUUID(),
          author: r.owner,
          text: `Selected ${o.provider}'s proposal. Both parties must confirm before work starts.`,
          date: "Today",
        });
        return list;
      });
      notify("Proposal selected — awaiting mutual confirmation");
    }
  }
  const agreementAction =
    event.target.closest("[data-agreement]")?.dataset.agreement;
  if (agreementAction) {
    const request = state.requests.find((x) => x.id === state.selectedId);
    if (state.remote)
      performAgreementAction(
        agreementAction,
        request.agreement.id,
        request.agreement.version,
      )
        .then(loadRemoteWorkspace)
        .then(() =>
          notify(
            agreementAction === "confirm"
              ? "Terms confirmed"
              : `Agreement moved to ${agreementAction}`,
          ),
        )
        .catch((error) => notify(error.message));
    else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === state.selectedId);
        if (agreementAction === "confirm")
          r.agreement = confirmAgreement(r.agreement, "me");
        else
          r.agreement = transitionAgreement(r.agreement, agreementAction, "me");
        r.status = r.agreement.status;
        r.updates.push({
          id: crypto.randomUUID(),
          author: state.profile.name,
          text:
            agreementAction === "confirm"
              ? "Confirmed the current agreement terms."
              : `Moved the agreement to ${agreementAction}.`,
          date: "Today",
        });
        return list;
      });
      notify(
        agreementAction === "confirm"
          ? "Terms confirmed"
          : `Agreement moved to ${agreementAction}`,
      );
    }
  }
  const milestone = event.target.closest("[data-milestone]");
  if (milestone) {
    const request = state.requests.find((x) => x.id === state.selectedId);
    if (state.remote)
      performAgreementAction(
        "milestone",
        request.agreement.id,
        request.agreement.version,
        { milestone_id: milestone.dataset.milestone },
      )
        .then(loadRemoteWorkspace)
        .catch((error) => notify(error.message));
    else
      updateRequests((list) => {
        const r = list.find((x) => x.id === state.selectedId);
        r.milestones[Number(milestone.dataset.milestone)].done =
          !r.milestones[Number(milestone.dataset.milestone)].done;
        const done = r.milestones.filter((m) => m.done).length;
        r.agreement.progress = Math.round((done / r.milestones.length) * 100);
        if (done === r.milestones.length) r.status = "completed";
        return list;
      });
  }
  const obligation = event.target.closest("[data-obligation]");
  if (obligation) {
    const [kind, id] = obligation.dataset.obligation.split(":");
    const request = state.requests.find((x) => x.id === state.selectedId);
    performAgreementAction(
      kind,
      request.agreement.id,
      request.agreement.version,
      { obligation_id: id },
    )
      .then(loadRemoteWorkspace)
      .then(() =>
        notify(
          kind === "fulfill" ? "Fulfillment submitted" : "Fulfillment approved",
        ),
      )
      .catch((error) => notify(error.message));
  }
  const completion = event.target.closest("[data-completion]");
  if (completion) {
    const request = state.requests.find((x) => x.id === state.selectedId);
    handleCompletion(
      request.agreement.id,
      request.agreement.version,
      completion.dataset.completion,
    )
      .then(loadRemoteWorkspace)
      .then(() => notify("Completion status updated"))
      .catch((error) => notify(error.message));
  }
  const amendment = event.target.closest("[data-amendment]");
  if (amendment) {
    const [choice, id] = amendment.dataset.amendment.split(":");
    respondAmendment(id, choice === "accept")
      .then(loadRemoteWorkspace)
      .then(() => notify(`Amendment ${choice}ed`))
      .catch((error) => notify(error.message));
  }
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    const [list, index] = remove.dataset.remove.split(":");
    const profile = structuredClone(state.profile);
    profile[list].splice(Number(index), 1);
    if (state.remote)
      updateMyProfile({
        display_name: profile.name,
        location_text: profile.location,
        bio: profile.bio,
        needs: profile.needs,
        offers: profile.offers,
      })
        .then(() => {
          state.profile = profile;
          notify("Profile updated");
        })
        .catch((error) => notify(error.message));
    else {
      state.profile = profile;
      persist();
    }
  }
  const followPerson = event.target.closest("[data-follow-person]");
  if (followPerson) {
    const id = followPerson.dataset.followPerson;
    const following = state.profile.following || [];
    const shouldFollow = !following.includes(id);
    if (state.remote)
      setFollow(id, shouldFollow)
        .then(() => {
          state.profile = {
            ...state.profile,
            following: shouldFollow
              ? [...following, id]
              : following.filter((x) => x !== id),
          };
          notify(
            shouldFollow ? "Following collaborator" : "Unfollowed collaborator",
          );
        })
        .catch((error) => notify(error.message));
    else {
      state.profile = {
        ...state.profile,
        following: shouldFollow
          ? [...following, id]
          : following.filter((x) => x !== id),
      };
      persist();
      notify("Following updated");
    }
  }
  const circle = event.target.closest("[data-circle]");
  if (circle) {
    const profile = structuredClone(state.profile);
    profile.joinedCircles ||= [];
    profile.joinedCircles = profile.joinedCircles.includes(
      circle.dataset.circle,
    )
      ? profile.joinedCircles.filter((id) => id !== circle.dataset.circle)
      : [...profile.joinedCircles, circle.dataset.circle];
    state.profile = profile;
    persist();
    notify("Circle membership updated");
  }
  const requestAction = event.target.closest("[data-request-action]");
  if (requestAction) {
    const request = state.requests.find((item) => item.id === state.selectedId);
    if (
      confirm(
        `${requestAction.dataset.requestAction[0].toUpperCase() + requestAction.dataset.requestAction.slice(1)} this request?`,
      )
    )
      closeRequest(
        request.id,
        request.version,
        requestAction.dataset.requestAction,
      )
        .then(async () => {
          state.view = "workspace";
          await loadRemoteWorkspace();
          notify("Request updated");
        })
        .catch((error) => notify(error.message));
  }
  const notification = event.target.closest("[data-notification]");
  if (notification) {
    markNotificationsRead([notification.dataset.notification]).then(
      loadNotifications,
    );
    closeModal();
    if (notification.dataset.request) {
      state.selectedId = notification.dataset.request;
      state.view = "detail";
    }
  }
  const lifecycle = event.target.closest("[data-lifecycle]");
  if (lifecycle) {
    event.stopPropagation();
    const [actionName, id, version] = lifecycle.dataset.lifecycle.split(":");
    requestLifecycleAction(id, Number(version), actionName)
      .then(loadRemoteWorkspace)
      .then(() => notify(`Request ${actionName}d`))
      .catch((error) => notify(error.message));
  }
  const editOffer = event.target.closest("[data-edit-offer]");
  if (editOffer) {
    event.stopPropagation();
    reviseOfferModal(
      state.myOffers.find((o) => o.id === editOffer.dataset.editOffer),
    );
  }
  const withdraw = event.target.closest("[data-withdraw-offer]");
  if (withdraw) {
    event.stopPropagation();
    if (confirm("Withdraw this proposal?"))
      withdrawOffer(withdraw.dataset.withdrawOffer)
        .then(loadRemoteWorkspace)
        .then(() => notify("Proposal withdrawn"))
        .catch((error) => notify(error.message));
  }
  const removeMilestone = event.target.closest("[data-remove-milestone]");
  if (removeMilestone) {
    event.stopPropagation();
    const request = state.requests.find((x) => x.id === state.selectedId);
    manageMilestone(request.agreement.id, request.agreement.version, "remove", {
      milestone_id: removeMilestone.dataset.removeMilestone,
    })
      .then(loadRemoteWorkspace)
      .then(() => notify("Milestone removed"))
      .catch((error) => notify(error.message));
  }
  const deleteMedia = event.target.closest("[data-delete-media]");
  if (deleteMedia) {
    manageRequestMedia(deleteMedia.dataset.deleteMedia, "delete")
      .then(loadRemoteWorkspace)
      .then(() => notify("Photo removed"))
      .catch((error) => notify(error.message));
  }
  const viewProfile = event.target.closest("[data-view-profile]");
  if (viewProfile) {
    const profile = (state.networkProfiles || []).find(
      (x) => x.id === viewProfile.dataset.viewProfile,
    );
    if (profile) {
      publicProfileModal(profile);
      if (state.session && profile.id !== state.profile.id)
        modalRoot
          .querySelector(".modal")
          .insertAdjacentHTML(
            "beforeend",
            `<div class="social-actions"><button class="primary" data-invite-person="${profile.id}">Propose an exchange</button><button class="secondary" data-save-person="${profile.id}">${(state.networkInbox?.saved_profiles || []).includes(profile.id) ? "Saved" : "Save person"}</button></div>`,
          );
    }
  }
  const invitePerson = event.target.closest("[data-invite-person]");
  if (invitePerson) {
    const profile = (state.networkProfiles || []).find(
      (x) => x.id === invitePerson.dataset.invitePerson,
    );
    if (profile) invitationModal(profile);
  }
  const savePerson = event.target.closest("[data-save-person]");
  if (savePerson) {
    const id = savePerson.dataset.savePerson;
    const saved = state.networkInbox.saved_profiles || [];
    const shouldSave = !saved.includes(id);
    setSavedProfile(id, shouldSave)
      .then(loadNetwork)
      .then(() =>
        notify(shouldSave ? "Collaborator saved" : "Collaborator removed"),
      )
      .catch((error) => notify(error.message));
  }
  const inviteResponse = event.target.closest("[data-invite-response]");
  if (inviteResponse) {
    const [response, id] = inviteResponse.dataset.inviteResponse.split(":");
    respondCollaborationInvitation(id, response)
      .then(loadNetwork)
      .then(loadNotifications)
      .then(() => notify(`Invitation ${response}`))
      .catch((error) => notify(error.message));
  }
  const workspaceButton = event.target.closest("[data-workspace]");
  if (workspaceButton) {
    const invitation = state.networkInbox.invitations.find(
      (item) => item.id === workspaceButton.dataset.workspace,
    );
    if (invitation) workspaceModal(invitation);
  }
  const confirmWorkspace = event.target.closest("[data-confirm-workspace]");
  if (confirmWorkspace) {
    const [id, version] = confirmWorkspace.dataset.confirmWorkspace.split(":");
    confirmIntroductionWorkspace(id, Number(version))
      .then(() => {
        closeModal();
        return loadNetwork();
      })
      .then(() => notify("Current planning terms confirmed"))
      .catch((error) => notify(error.message));
  }
  const convertIntro = event.target.closest("[data-convert-intro]");
  if (convertIntro) {
    convertIntroductionToRequest(convertIntro.dataset.convertIntro)
      .then(async (id) => {
        await loadRemoteWorkspace();
        await loadNetwork();
        state.selectedId = id;
        state.view = "detail";
      })
      .then(() => notify("Private work draft created"))
      .catch((error) => notify(error.message));
  }
  const networkManage = event.target.closest("[data-network-manage]");
  if (networkManage) {
    const [kind, actionName, id] =
      networkManage.dataset.networkManage.split(":");
    const warning =
      actionName === "block"
        ? "Block this person and close the introduction?"
        : actionName === "report"
          ? "Submit a private safety report about this introduction?"
          : null;
    if (!warning || confirm(warning))
      manageNetworkItem(kind, id, actionName)
        .then(loadNetwork)
        .then(() => notify(`Network item ${actionName}ed`))
        .catch((error) => notify(error.message));
  }
  const savedSearch = event.target.closest("[data-saved-search]");
  if (savedSearch) {
    const search = (state.networkInbox.saved_searches || []).find(
      (item) => item.id === savedSearch.dataset.savedSearch,
    );
    if (search) {
      state.networkQuery = search.query;
      state.networkExchange = search.exchange_filter || "";
      state.networkRemote = search.remote_only;
      loadNetwork();
    }
  }
  const openCircle = event.target.closest("[data-open-circle]");
  if (openCircle) {
    const circle = state.circleHub.circles.find(
      (item) => item.id === openCircle.dataset.openCircle,
    );
    if (
      circle?.membership?.status === "active" ||
      circle?.membership?.status === "invited"
    ) {
      state.selectedCircleId = circle.id;
      loadNetwork();
    } else if (circle)
      requestCircleMembership(circle.id)
        .then(loadNetwork)
        .then(() => notify("Membership requested"))
        .catch((error) => notify(error.message));
  }
  const circleMembership = event.target.closest("[data-circle-membership]");
  if (circleMembership) {
    const [memberAction, circleId, profileId] =
      circleMembership.dataset.circleMembership.split(":");
    const operation =
      memberAction === "request"
        ? requestCircleMembership(circleId)
        : manageCircleMembership(circleId, profileId, memberAction);
    operation
      .then(loadNetwork)
      .then(() => notify("Circle membership updated"))
      .catch((error) => notify(error.message));
  }
  const circleRole = event.target.closest("[data-circle-role]");
  if (circleRole) {
    const [circleId, profileId, role] =
      circleRole.dataset.circleRole.split(":");
    manageCircleMembership(circleId, profileId, "role", role)
      .then(loadNetwork)
      .then(() => notify("Circle role updated"))
      .catch((error) => notify(error.message));
  }
  const circleResource = event.target.closest("[data-circle-resource]");
  if (circleResource)
    circleResourceModal(circleResource.dataset.circleResource);
  const circleSettings = event.target.closest("[data-circle-settings]");
  if (circleSettings) {
    const circle = state.circleHub.circles.find(
      (item) => item.id === circleSettings.dataset.circleSettings,
    );
    if (circle) circleSettingsModal(circle);
  }
  const circleInvite = event.target.closest("[data-circle-invite]");
  if (circleInvite) circleInviteModal(circleInvite.dataset.circleInvite);
  const circlePost = event.target.closest("[data-circle-post]");
  if (circlePost) circlePostModal(circlePost.dataset.circlePost);
  const deleteResource = event.target.closest("[data-delete-circle-resource]");
  if (deleteResource && confirm("Remove this shared resource?"))
    deleteCircleResource(deleteResource.dataset.deleteCircleResource)
      .then(loadNetwork)
      .then(() => notify("Resource removed"))
      .catch((error) => notify(error.message));
  const createChainButton = event.target.closest("[data-create-chain]");
  if (createChainButton)
    chainBuilderModal(createChainButton.dataset.createChain);
  const suggestChain = event.target.closest("[data-suggest-chain]");
  if (suggestChain) {
    const [index, circleId] = suggestChain.dataset.suggestChain.split(":");
    const suggestions = (state.chainHub.suggestions || []).filter((item) =>
      (item.participants || []).includes(state.profile.id),
    );
    chainBuilderModal(circleId, suggestions[Number(index)]);
  }
  const editChain = event.target.closest("[data-chain-edit]");
  if (editChain) {
    const chain = state.chainHub.chains.find(
      (c) => c.id === editChain.dataset.chainEdit,
    );
    if (chain) chainBuilderModal(chain.circle_id, null, chain);
  }
  const acceptChainButton = event.target.closest("[data-chain-accept]");
  if (acceptChainButton) {
    const [id, version] = acceptChainButton.dataset.chainAccept.split(":");
    acceptTradeChain(id, Number(version))
      .then(loadNetwork)
      .then(() => notify("You accepted the complete chain"))
      .catch((error) => notify(error.message));
  }
  const activateChainButton = event.target.closest("[data-chain-activate]");
  if (activateChainButton)
    activateTradeChain(activateChainButton.dataset.chainActivate)
      .then(loadNetwork)
      .then(() => notify("Trade chain activated"))
      .catch((error) => notify(error.message));
  const chainLinkButton = event.target.closest("[data-chain-link]");
  if (chainLinkButton) {
    const [actionName, id] = chainLinkButton.dataset.chainLink.split(":");
    const note =
      actionName === "fulfill"
        ? prompt("Briefly describe the delivered work or value:") || ""
        : "";
    manageTradeChainLink(id, actionName, note)
      .then(loadNetwork)
      .then(() =>
        notify(
          actionName === "fulfill"
            ? "Fulfillment submitted"
            : "Contribution approved",
        ),
      )
      .catch((error) => notify(error.message));
  }
  const chainHold = event.target.closest("[data-chain-hold]");
  if (chainHold) {
    const [chainId, linkId] = chainHold.dataset.chainHold.split(":");
    chainHoldModal(chainId, linkId);
  }
  const resolveChainHold = event.target.closest("[data-chain-resolve-hold]");
  if (resolveChainHold) {
    const [chainId, holdId] =
      resolveChainHold.dataset.chainResolveHold.split(":");
    manageTradeChain(chainId, "resolve_hold", { hold_id: holdId })
      .then(loadNetwork)
      .then(() => notify("Dependency resolved"))
      .catch((error) => notify(error.message));
  }
  const chainManage = event.target.closest("[data-chain-manage]");
  if (chainManage) {
    const [actionName, id] = chainManage.dataset.chainManage.split(":");
    if (
      confirm(
        `${actionName === "disputed" ? "Raise a dispute for" : "Cancel"} this entire chain?`,
      )
    )
      manageTradeChain(id, actionName, {})
        .then(loadNetwork)
        .then(() => notify(`Chain ${actionName}`))
        .catch((error) => notify(error.message));
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.query = event.target.value;
  }
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-following-feed]")) {
    state.networkFollowingOnly = event.target.checked;
    loadNetwork();
  }
});
document.addEventListener("keydown", (event) => {
  const card = event.target.closest("[data-open]");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    card.click();
  }
  if (event.key === "Escape") closeModal();
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const data = new FormData(form);
  if (form.dataset.form === "post") {
    const exchanges = data.getAll("exchange");
    if (!exchanges.length)
      return notify("Choose at least one exchange option.");
    const request = {
      id: crypto.randomUUID(),
      ownerId: "me",
      owner: state.profile.name,
      initials: state.profile.initials,
      title: data.get("title"),
      category: data.get("category"),
      location: data.get("location"),
      distance: 0,
      urgency: "Flexible",
      status: "open",
      description: data.get("description"),
      skills: data
        .get("skills")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      exchange: exchanges,
      cashBudget: Number(data.get("budget")) || 0,
      offersInReturn: data
        .get("returns")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString().slice(0, 10),
      offers: [],
      updates: [],
    };
    if (state.remote) {
      try {
        const shouldPublish = event.submitter?.value !== "draft";
        const newId = await createRemoteRequest({
          title: request.title,
          description: request.description,
          kind: request.category.toLowerCase(),
          location: request.location,
          urgency: request.urgency,
          cash_budget_cents: request.cashBudget * 100,
          visibility: "public",
          publish: shouldPublish,
          skills: request.skills,
          exchange_modes: exchanges,
          exchange_summary: request.offersInReturn.join(", "),
          constraints: data.get("constraints"),
          location_visibility: data.get("location_visibility"),
        });
        const photo = form.elements.photo.files[0];
        if (photo) {
          if (photo.size > 10485760)
            throw new Error("Reference photo must be under 10 MB");
          await uploadRequestMedia(newId, photo, data.get("photo_caption"));
        }
        closeModal();
        await loadRemoteWorkspace();
        state.view = shouldPublish ? "discover" : "workspace";
        notify(
          shouldPublish
            ? "Work request published to the community"
            : "Draft saved privately",
        );
      } catch (error) {
        notify(error.message);
      }
    } else {
      updateRequests((list) => [request, ...list]);
      closeModal();
      state.selectedId = request.id;
      state.view = "detail";
      notify("Work request published on this device");
    }
  }
  if (form.dataset.form === "offer") {
    if (state.remote) {
      try {
        const milestoneLines = String(data.get("milestones") || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((title) => ({ title, responsible: "provider", due_at: "" }));
        await submitOffer(form.dataset.id, {
          mode: data.get("mode"),
          scope: data.get("gives"),
          exchange_summary: data.get("wants"),
          duration: data.get("duration"),
          exclusions: data.get("exclusions"),
          responsibilities: {
            provider: data.get("provider_supplies"),
            requester: data.get("requester_supplies"),
          },
          milestones: milestoneLines,
          questions: data.get("questions"),
          expires_at: data.get("expires_at")
            ? new Date(`${data.get("expires_at")}T23:59:59`).toISOString()
            : "",
        });
        closeModal();
        await loadRemoteWorkspace();
        notify("Detailed trade proposal sent");
      } catch (error) {
        notify(error.message);
      }
    } else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === form.dataset.id);
        r.offers.push({
          id: crypto.randomUUID(),
          provider: state.profile.name,
          initials: state.profile.initials,
          mode: data.get("mode"),
          cash: Number(data.get("cash")) || 0,
          gives: data.get("gives"),
          wants: data.get("wants"),
          duration: data.get("duration"),
          note: data.get("questions"),
        });
        return list;
      });
      closeModal();
      notify("Trade proposal sent");
    }
  }
  if (form.dataset.form === "hold") {
    const request = state.requests.find((x) => x.id === form.dataset.id);
    if (state.remote) {
      try {
        await performAgreementAction(
          "hold",
          request.agreement.id,
          request.agreement.version,
          {
            kind: data
              .get("type")
              .toLowerCase()
              .replaceAll(" ", "_")
              .replace("_or_", "_"),
            owner: data.get("owner"),
            detail: data.get("detail"),
            review_at: data.get("reviewDate"),
          },
        );
        closeModal();
        await loadRemoteWorkspace();
        notify("Dependency hold added");
      } catch (error) {
        notify(error.message);
      }
    } else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === form.dataset.id);
        r.hold = {
          type: data.get("type"),
          owner: data.get("owner"),
          detail: data.get("detail"),
          reviewDate: data.get("reviewDate"),
        };
        return list;
      });
      closeModal();
      notify("Dependency hold added");
    }
  }
  if (form.dataset.form === "update") {
    if (state.remote) {
      try {
        await addProjectUpdate(state.selectedId, data.get("text"));
        form.reset();
        await loadRemoteWorkspace();
        notify("Project journal updated");
      } catch (error) {
        notify(error.message);
      }
    } else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === state.selectedId);
        r.updates.push({
          id: crypto.randomUUID(),
          author: state.profile.name,
          text: data.get("text"),
          date: "Today",
        });
        return list;
      });
      form.reset();
      notify("Update posted");
    }
  }
  if (form.dataset.form === "message") {
    if (state.remote) {
      try {
        await sendProjectMessage(state.selectedId, data.get("text"));
        form.reset();
        await loadRemoteWorkspace();
        notify("Message sent");
      } catch (error) {
        notify(error.message);
      }
    } else {
      updateRequests((list) => {
        const r = list.find((x) => x.id === state.selectedId);
        r.messages ||= [];
        r.messages.push({
          id: crypto.randomUUID(),
          authorId: "me",
          author: state.profile.name,
          text: data.get("text"),
          date: "Today",
        });
        return list;
      });
      form.reset();
      notify("Message sent");
    }
  }
  if (form.dataset.form === "report") {
    updateRequests((list) => {
      const r = list.find((x) => x.id === form.dataset.id);
      r.reports ||= [];
      r.reports.push({
        id: crypto.randomUUID(),
        reporterId: "me",
        reason: data.get("reason"),
        detail: data.get("detail"),
        status: "submitted",
        createdAt: new Date().toISOString(),
      });
      return list;
    });
    closeModal();
    notify("Private report recorded for moderator review");
  }
  if (form.dataset.form === "profile-item") {
    const profile = structuredClone(state.profile);
    profile[form.dataset.list].push(data.get("item"));
    if (state.remote) {
      try {
        await updateMyProfile({
          display_name: profile.name,
          location_text: profile.location,
          bio: profile.bio,
          needs: profile.needs,
          offers: profile.offers,
        });
        state.profile = profile;
        form.reset();
        notify("Profile updated");
      } catch (error) {
        notify(error.message);
      }
    } else {
      state.profile = profile;
      persist();
      form.reset();
      notify("Profile updated");
    }
  }
  if (form.dataset.form === "review") {
    try {
      await submitReview({
        agreement_id: form.dataset.agreement,
        subject_id: form.dataset.subject,
        reliability: Number(data.get("reliability")),
        communication: Number(data.get("communication")),
        work_quality: Number(data.get("work_quality")),
        exchange_fairness: Number(data.get("exchange_fairness")),
        body: data.get("body"),
      });
      closeModal();
      notify("Contextual review published");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "evidence") {
    const file = form.elements.photo.files[0];
    if (!file || file.size > 10485760)
      return notify("Choose a JPG, PNG, or WebP under 10 MB.");
    try {
      await uploadWorkEvidence(form.dataset.agreement, file, {
        skill: data.get("skill"),
        description: data.get("description"),
      });
      form.reset();
      await loadRemoteWorkspace();
      notify("Work evidence added");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "sign-in") {
    signInWithEmail(data.get("email"))
      .then(() => {
        closeModal();
        notify("Check your email for the secure link");
      })
      .catch((error) => notify(error.message));
  }
  if (form.dataset.form === "profile") {
    const profile = {
      ...structuredClone(state.profile),
      name: data.get("display_name"),
      location: data.get("location_text"),
      bio: data.get("bio"),
      workRadius: Number(data.get("work_radius_km")) || null,
      remoteAvailable: data.has("remote_available"),
      availability: data.get("availability_text"),
      resources: data.get("resources_text"),
      visibility: data.get("profile_visibility"),
    };
    try {
      if (state.remote)
        await updateMyProfile({
          display_name: profile.name,
          location_text: profile.location,
          bio: profile.bio,
          needs: profile.needs,
          offers: profile.offers,
          work_radius_km: profile.workRadius,
          remote_available: profile.remoteAvailable,
          preferred_exchange_modes: ["cash", "barter", "hybrid"],
          availability_text: profile.availability,
          resources_text: profile.resources,
          profile_visibility: profile.visibility,
        });
      state.profile = profile;
      if (!state.remote) persist();
      closeModal();
      notify("Profile saved");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "edit-request") {
    try {
      await updateRequest(form.dataset.id, Number(form.dataset.version), {
        title: data.get("title"),
        description: data.get("description"),
        kind: data.get("category").toLowerCase(),
        location: data.get("location"),
        urgency: data.get("urgency"),
        cash_budget_cents: (Number(data.get("budget")) || 0) * 100,
        skills: data
          .get("skills")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      });
      closeModal();
      await loadRemoteWorkspace();
      notify("Request updated with history preserved");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "preferences") {
    try {
      state.notificationPreferences = await saveNotificationPreferences({
        in_app: data.has("in_app"),
        email_proposals: data.has("email_proposals"),
        email_messages: data.has("email_messages"),
        email_agreements: data.has("email_agreements"),
        email_reminders: data.has("email_reminders"),
      });
      closeModal();
      notify("Notification preferences saved");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "deactivate") {
    try {
      await deactivateMyAccount();
      const seed = cloneSeed();
      store.batch(() => {
        state.session = null;
        state.remote = false;
        state.profile = seed.profile;
        state.requests = seed.requests;
        state.notifications = [];
      });
      closeModal();
      notify("Account deactivated; showing device demo");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "amendment") {
    try {
      await proposeAmendment(
        form.dataset.agreement,
        Number(form.dataset.version),
        {
          scope: data.get("scope"),
          exchange: { summary: data.get("exchange") },
          reason: data.get("reason"),
        },
      );
      closeModal();
      notify("Amendment sent for counterparty approval");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "milestone") {
    try {
      await manageMilestone(
        form.dataset.agreement,
        Number(form.dataset.version),
        "add",
        {
          title: data.get("title"),
          responsible_profile_id: data.get("responsible"),
          due_at: data.get("due_at")
            ? new Date(`${data.get("due_at")}T12:00:00`).toISOString()
            : "",
        },
      );
      closeModal();
      await loadRemoteWorkspace();
      notify("Milestone added");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "revise-offer") {
    try {
      const original = state.myOffers.find((o) => o.id === form.dataset.id);
      await reviseOffer(form.dataset.id, {
        mode: data.get("mode"),
        scope: data.get("scope"),
        exchange_summary: data.get("exchange_summary"),
        duration: data.get("duration"),
        exclusions: data.get("exclusions"),
        responsibilities: original.responsibilities || {},
        milestones: original.proposed_milestones || [],
        questions: data.get("questions"),
        expires_at: data.get("expires_at")
          ? new Date(`${data.get("expires_at")}T23:59:59`).toISOString()
          : "",
      });
      closeModal();
      await loadRemoteWorkspace();
      notify("Proposal revised");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "schedule") {
    try {
      await setAgreementSchedule(
        form.dataset.agreement,
        Number(form.dataset.version),
        {
          start_at: data.get("start_at")
            ? new Date(data.get("start_at")).toISOString()
            : "",
          timezone: data.get("timezone"),
          working_windows: data.get("working_windows"),
        },
      );
      closeModal();
      await loadRemoteWorkspace();
      notify("Schedule saved");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "proposal-question") {
    try {
      await askProposalQuestion(form.dataset.offer, data.get("body"));
      form.reset();
      notify("Question sent to proposal participants");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "network-search") {
    state.networkQuery = data.get("query") || "";
    state.networkExchange = data.get("exchange") || "";
    state.networkRemote = data.has("remote");
    await loadNetwork();
  }
  if (form.dataset.form === "completion-story") {
    try {
      await publishCompletion(
        form.dataset.agreement,
        data.get("summary"),
        data.get("exchange"),
        data.get("title"),
        data.get("visibility"),
      );
      closeModal();
      await loadNetwork();
      notify("Verified completion story published");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "collaboration-invite") {
    try {
      await sendCollaborationInvitation(form.dataset.profile, {
        need: data.get("need"),
        offer: data.get("offer"),
        note: data.get("note"),
        requestId: data.get("request") || null,
      });
      closeModal();
      await loadNetwork();
      notify("Collaboration invitation sent");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "intro-message") {
    try {
      await sendIntroductionMessage(form.dataset.invitation, data.get("body"));
      form.reset();
      await loadNetwork();
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "save-network-search") {
    try {
      await saveNetworkSearch(
        data.get("name"),
        state.networkQuery || "",
        state.networkExchange || "",
        !!state.networkRemote,
      );
      closeModal();
      await loadNetwork();
      notify("Network search saved");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "intro-workspace") {
    try {
      const invitation = state.networkInbox.invitations.find(
        (item) => item.id === form.dataset.invitation,
      );
      const otherId =
        invitation.sender_id === state.profile.id
          ? invitation.recipient_id
          : invitation.sender_id;
      await updateIntroductionWorkspace(
        form.dataset.invitation,
        Number(form.dataset.version),
        {
          scope: data.get("scope"),
          responsibilities: {
            [state.profile.id]: data.get("mine"),
            [otherId]: data.get("theirs"),
            other: data.get("theirs"),
          },
          materials: data.get("materials"),
          exclusions: data.get("exclusions"),
          exchange_terms: data.get("exchange_terms"),
          proposed_windows: data.get("proposed_windows"),
          timezone: data.get("timezone"),
        },
      );
      closeModal();
      await loadNetwork();
      notify("Shared planning terms updated");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "create-circle") {
    try {
      const id = await createCircle({
        name: data.get("name"),
        description: data.get("description"),
        visibility: data.get("visibility"),
        rules: data.get("rules"),
      });
      closeModal();
      state.selectedCircleId = id;
      await loadNetwork();
      notify("Trusted circle created");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "circle-resource") {
    try {
      await saveCircleResource(form.dataset.circle, null, {
        kind: data.get("kind"),
        name: data.get("name"),
        description: data.get("description"),
        availability: data.get("availability"),
      });
      closeModal();
      await loadNetwork();
      notify("Resource shared with circle");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "circle-invite") {
    try {
      await inviteCircleMember(form.dataset.circle, data.get("profile"));
      closeModal();
      await loadNetwork();
      notify("Circle invitation sent");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "circle-post") {
    try {
      await createCircleRequest(form.dataset.circle, {
        title: data.get("title"),
        description: data.get("description"),
        kind: data.get("kind"),
        location: data.get("location"),
        urgency: data.get("urgency"),
        cash_budget_cents: "",
        publish: true,
        skills: String(data.get("skills") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        exchange_modes: ["barter", "hybrid"],
        exchange_summary: data.get("exchange_summary"),
        constraints: data.get("constraints"),
      });
      closeModal();
      await loadNetwork();
      notify("Private circle work posted");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "circle-settings") {
    try {
      await updateCircleSettings(form.dataset.circle, {
        description: data.get("description"),
        visibility: data.get("visibility"),
        rules: data.get("rules"),
      });
      closeModal();
      await loadNetwork();
      notify("Circle settings updated");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "chain-builder") {
    try {
      const count = Number(data.get("link_count"));
      const links = Array.from({ length: count }, (_, index) => ({
        from_profile_id: data.get(`from_${index}`),
        to_profile_id: data.get(`to_${index}`),
        value_description: data.get(`value_${index}`),
        position: index,
        due_at: data.get(`due_${index}`)
          ? new Date(`${data.get(`due_${index}`)}T12:00:00`).toISOString()
          : "",
        conditions: data.get(`conditions_${index}`),
      }));
      const payload = {
        title: data.get("title"),
        description: data.get("description"),
        execution_mode: data.get("execution_mode"),
        links,
      };
      if (form.dataset.chain)
        await reviseTradeChain(
          form.dataset.chain,
          Number(form.dataset.version),
          payload,
        );
      else
        await createTradeChain(form.dataset.circle, {
          title: payload.title,
          description: payload.description,
          executionMode: payload.execution_mode,
          links,
        });
      closeModal();
      await loadNetwork();
      notify(
        form.dataset.chain
          ? "Chain revised; confirmations reset"
          : "Trade chain proposed",
      );
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "chain-message") {
    try {
      await manageTradeChain(form.dataset.chain, "message", {
        body: data.get("body"),
      });
      form.reset();
      await loadNetwork();
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "chain-hold") {
    try {
      await manageTradeChain(form.dataset.chain, "hold", {
        link_id: form.dataset.link,
        kind: data.get("kind"),
        detail: data.get("detail"),
        review_at: data.get("review_at")
          ? new Date(`${data.get("review_at")}T12:00:00`).toISOString()
          : "",
      });
      closeModal();
      await loadNetwork();
      notify("Chain dependency recorded");
    } catch (error) {
      notify(error.message);
    }
  }
});

store.subscribe(render, true);
document.querySelector("#mode-badge").textContent = backendConfigured
  ? "Connected"
  : "Demo mode";

function mapRemoteRequest(request) {
  const name = request.profiles?.display_name || "WorkTrade member";
  return {
    id: request.id,
    version: request.version,
    ownerId: request.owner_id,
    owner: name,
    initials: name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    title: request.title,
    category: request.kind[0].toUpperCase() + request.kind.slice(1),
    location:
      request.location_visibility === "region"
        ? request.location_text || "Region not specified"
        : "Location shared with participants",
    distance: "—",
    urgency: request.urgency_text || "Flexible",
    status: request.stage,
    description: request.description,
    constraints: request.constraints || "",
    skills: (request.work_request_skills || []).map((item) => item.skill),
    exchange: request.exchange_modes || ["cash", "barter", "hybrid"],
    cashBudget: request.cash_budget_cents
      ? Math.round(request.cash_budget_cents / 100)
      : 0,
    offersInReturn: request.exchange_summary
      ? [request.exchange_summary]
      : ["Open to a fair proposal"],
    createdAt: request.created_at,
    offers: [],
    updates: [],
    messages: [],
    followers: [],
    reports: [],
  };
}

async function loadRemoteWorkspace() {
  const [profile, requests, ownedRows, agreementRows, myOffers] =
    await Promise.all([
      getMyProfile(),
      listPublicRequests(),
      getMyRequests(),
      getMyAgreements(),
      getMyOffers(),
    ]);
  if (!profile) return;
  const capabilities = profile.capabilities || [];
  const combined = [...requests];
  for (const row of ownedRows)
    if (!combined.some((x) => x.id === row.id))
      combined.push({
        ...row,
        profiles: { display_name: profile.display_name },
      });
  const mapped = combined.map(mapRemoteRequest);
  await Promise.all(
    mapped.map(async (request) => {
      request.media = await getRequestMedia(request.id);
    }),
  );
  for (const row of agreementRows) {
    let request = mapped.find((item) => item.id === row.request.id);
    if (!request) {
      request = mapRemoteRequest({
        ...row.request,
        profiles: {
          display_name:
            row.request.owner_id === profile.id
              ? profile.display_name
              : "Trade partner",
        },
        work_request_skills: [],
      });
      mapped.push(request);
    }
    const done = row.milestones.filter((item) => item.completed_at).length;
    request.status = row.agreement.status;
    request.milestones = row.milestones;
    request.hold = row.holds.find((item) => !item.resolved_at)
      ? (() => {
          const hold = row.holds.find((item) => !item.resolved_at);
          return {
            id: hold.id,
            type: hold.kind.replaceAll("_", " "),
            detail: hold.detail,
            owner: hold.action_owner_text || "Participant",
            reviewDate: hold.review_at
              ? new Date(hold.review_at).toLocaleDateString()
              : "Not set",
          };
        })()
      : null;
    request.agreement = {
      ...row.agreement,
      parties: [row.agreement.requester_id, row.agreement.provider_id],
      confirmations: [
        row.agreement.confirmed_by_requester_at
          ? row.agreement.requester_id
          : null,
        row.agreement.confirmed_by_provider_at
          ? row.agreement.provider_id
          : null,
      ].filter(Boolean),
      provider:
        row.agreement.provider_id === profile.id
          ? profile.display_name
          : "Trade partner",
      exchange: row.agreement.exchange_snapshot,
      progress: row.milestones.length
        ? Math.round((done / row.milestones.length) * 100)
        : 0,
      obligations: row.obligations,
      amendments: await getAgreementAmendments(row.agreement.id),
      history: await getAgreementHistory(row.agreement.id),
    };
    request.evidence = await Promise.all(
      (row.evidence || []).map(async (item) => ({
        ...item,
        url: item.asset_path ? await getEvidenceUrl(item.asset_path) : null,
      })),
    );
    request.reviews = row.reviews || [];
  }
  const ownedOpen = mapped.filter(
    (request) => request.ownerId === profile.id && request.status === "open",
  );
  await Promise.all(
    ownedOpen.map(async (request) => {
      const offers = await getRequestOffers(request.id);
      request.offers = await Promise.all(
        offers.map(async (offer) => ({
          id: offer.id,
          provider: offer.profiles?.display_name || "WorkTrade member",
          initials: (offer.profiles?.display_name || "WM")
            .split(/\s+/)
            .map((x) => x[0])
            .join("")
            .slice(0, 2),
          mode: offer.mode,
          gives: offer.scope,
          wants: offer.exchange_summary,
          duration: offer.duration_text || "To be agreed",
          note: offer.questions || "",
          exclusions: offer.exclusions,
          responsibilities: offer.responsibilities,
          expires_at: offer.expires_at,
          discussion: await getProposalQuestions(offer.id),
        })),
      );
    }),
  );
  const participantRequests = mapped.filter((request) => request.agreement);
  await Promise.all(
    participantRequests.map(async (request) => {
      const [messages, updates] = await Promise.all([
        getProjectMessages(request.id),
        getProjectUpdates(request.id),
      ]);
      request.messages = messages.map((message) => ({
        id: message.id,
        authorId: message.author_id,
        author: message.profiles?.display_name || "Participant",
        text: message.body,
        date: new Date(message.created_at).toLocaleDateString(),
      }));
      request.updates = updates.map((item) => ({
        id: item.id,
        author: item.profiles?.display_name || "Participant",
        text: item.body,
        date: new Date(item.created_at).toLocaleDateString(),
      }));
    }),
  );
  store.batch(() => {
    state.remote = true;
    state.profile = {
      id: profile.id,
      name: profile.display_name,
      initials: profile.display_name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      location: profile.location_text || "",
      bio: profile.bio || "",
      workRadius: profile.work_radius_km,
      remoteAvailable: profile.remote_available,
      availability: profile.availability_text || "",
      resources: profile.resources_text || "",
      visibility: profile.profile_visibility,
      needs: capabilities
        .filter((item) => item.direction === "need")
        .map((item) => item.label),
      offers: capabilities
        .filter((item) => item.direction === "offer")
        .map((item) => item.label),
      following: [],
      joinedCircles: [],
      blocked: [],
    };
    state.requests = mapped;
    state.myOffers = myOffers;
  });
}

async function loadNotifications() {
  if (!state.remote) return;
  state.notifications = await getNotifications();
  const badge = document.querySelector("#unread-count");
  const count = state.notifications.filter((item) => !item.read_at).length;
  if (badge) badge.textContent = count ? String(count) : "";
}

async function loadNetwork() {
  if (!backendConfigured) return;
  try {
    const [profiles, activity, inbox, circleHub, chainHub] = await Promise.all([
      discoverProfiles({
        query: state.networkQuery || "",
        exchange: state.networkExchange || null,
        remote: !!state.networkRemote,
      }),
      getNetworkActivity(!!state.networkFollowingOnly),
      state.session
        ? getNetworkInbox()
        : Promise.resolve({
            invitations: [],
            messages: [],
            saved_profiles: [],
            saved_searches: [],
          }),
      state.session
        ? getCircleHub()
        : Promise.resolve({
            circles: [],
            members: [],
            resources: [],
            requests: [],
          }),
      state.session && state.selectedCircleId
        ? getTradeChainHub(state.selectedCircleId)
        : Promise.resolve({ chains: [], suggestions: [] }),
    ]);
    store.batch(() => {
      state.networkProfiles = profiles || [];
      state.networkActivity = activity || [];
      state.networkInbox = inbox;
      state.circleHub = circleHub;
      state.chainHub = chainHub;
      if (state.session)
        state.profile = {
          ...state.profile,
          following: (profiles || [])
            .filter((x) => x.following)
            .map((x) => x.id),
        };
    });
  } catch (error) {
    notify(`Network unavailable: ${error.message}`);
  }
}

async function hydrateAccount() {
  if (!backendConfigured || state.view !== "profile") return;
  const panel = document.querySelector("#account-panel");
  if (!panel) return;
  try {
    const session = state.session || (await getSession());
    panel.innerHTML = session
      ? `<b>${esc(session.user.email)}</b><p>Your session is encrypted and managed by Supabase Auth.</p><div class="account-actions"><button class="secondary" data-action="notification-preferences">Notifications</button><button class="secondary" data-action="export-data">Export my data</button><button class="secondary" data-action="sign-out">Sign out</button><button class="danger-text" data-action="deactivate">Deactivate account</button></div>`
      : `<b>Ready for a real account</b><p>Sign in with a secure email link.</p><button class="primary" data-action="sign-in">Sign in</button>`;
  } catch (error) {
    panel.innerHTML = `<p>Account service unavailable: ${esc(error.message)}</p>`;
  }
}

store.subscribe(() => queueMicrotask(hydrateAccount));

async function bootstrapBackend() {
  if (!backendConfigured) return;
  try {
    const session = await getSession();
    state.session = session;
    if (session) {
      await loadRemoteWorkspace();
      state.notificationPreferences = await getNotificationPreferences();
      await loadNotifications();
    }
    await loadNetwork();
  } catch (error) {
    notify(`Connected service unavailable: ${error.message}`);
  }
}
bootstrapBackend();
