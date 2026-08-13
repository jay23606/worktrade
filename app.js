import { createStore } from "./modules/store.js";
import { cloneSeed } from "./data.js";
import { createModalController, esc, money, modeLabel } from "./modules/ui.js";
import { mapRemoteRequest } from "./modules/request-mapper.js";
import {
  confirmAgreement,
  proposeAgreement,
  transitionAgreement,
} from "./modules/agreements.js";
import {
  acceptOffer,
  counterOffer,
  declineOffer,
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
  getMyRestrictions,
  getMySafetyReports,
  getModerationQueue,
  getPilotAccess,
  getPilotDashboard,
  getNotificationPreferences,
  getNotifications,
  getProjectMessages,
  getProjectUpdates,
  getProposalQuestions,
  getRequestMedia,
  getRequestOffers,
  getOfferVersions,
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
  getAgreementSchedule,
  proposeScheduleWindow,
  respondScheduleWindow,
  saveMyAvailability,
  getAgreementLedger,
  saveLedgerItem,
  manageLedgerItem,
  uploadLedgerReceipt,
  getChangeOrderHub,
  reportWorkIssue,
  proposeChangeOrder,
  respondChangeOrder,
  manageWorkIssue,
  uploadWorkIssueEvidence,
  signInWithEmail,
  signOut,
  submitOffer,
  submitSafetyReport,
  submitModerationAppeal,
  submitReview,
  moderateReport,
  resolveModerationAppeal,
  redeemPilotInvite,
  recordOnboardingState,
  createPilotInvite,
  setPilotInviteEnabled,
  submitPilotFeedback,
  getMyPilotFeedback,
  managePilotFeedback,
  replyToPilotFeedback,
  updateMyProfile,
  updateRequest,
  uploadRequestMedia,
  uploadProfileAvatar,
  removeProfileAvatar,
  uploadPortfolioImage,
  removePortfolioImage,
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
  saveDiscoveryAlert,
  sendCollaborationInvitation,
  sendContactRequest,
  sendIntroductionMessage,
  sendMessageAttachment,
  subscribeToMessages,
  setSavedProfile,
  updateIntroductionWorkspace,
  confirmIntroductionWorkspace,
  convertIntroductionToRequest,
  manageNetworkItem,
  manageConversation,
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
const MATCH_FEEDBACK_KEY = "worktrade:match-feedback:v1";
const PROJECT_NOTIFICATION_KEY = "worktrade:project-notifications:v1";
const MESSAGE_DRAFT_KEY = "worktrade:message-drafts:v1";
const EXAMPLES_KEY = "worktrade:examples-hidden:v1";
const ONBOARDING_DRAFT_KEY = "worktrade:onboarding-draft:v1";
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
})();
const initial = saved?.requests ? saved : cloneSeed();
const savedMatchFeedback = (() => {
  try { return JSON.parse(localStorage.getItem(MATCH_FEEDBACK_KEY)) || {}; } catch { return {}; }
})();
const store = createStore({
  view: "discover",
  query: "",
  category: "All",
  selectedId: null,
  projectDetailTab: "overview",
  session: null,
  remote: false,
  profile: initial.profile,
  requests: initial.requests,
  myOffers: [],
  notifications: initial.notifications || [],
  notificationPreferences: null,
  projectNotificationSettings: (() => { try { return JSON.parse(localStorage.getItem(PROJECT_NOTIFICATION_KEY)) || {}; } catch { return {}; } })(),
  examplesHidden: localStorage.getItem(EXAMPLES_KEY) === "true",
  networkProfiles: [],
  networkActivity: [],
  networkQuery: "",
  networkExchange: "",
  networkRemote: false,
  networkMode: "either",
  networkRadius: 40,
  networkAvailability: "",
  networkSort: "fit",
  networkFollowingOnly: false,
  selectedConversationId: null,
  messageQuery: "",
  showArchivedMessages: false,
  messageListOnly: true,
  messagePageSizes: {},
  messageDrafts: (() => { try { return JSON.parse(localStorage.getItem(MESSAGE_DRAFT_KEY)) || {}; } catch { return {}; } })(),
  networkInbox: {
    invitations: [],
    messages: [],
    attachments: [],
    saved_profiles: [],
    saved_searches: [],
  },
  circleHub: { circles: [], members: [], resources: [], requests: [] },
  selectedCircleId: null,
  chainHub: { chains: [], suggestions: [] },
  matchFeedback: savedMatchFeedback,
});
const { state } = store;
const main = document.querySelector("#main");
const modalRoot = document.querySelector("#modal-root");
const modalController = createModalController(modalRoot);
const currentTheme = document.documentElement.dataset.theme;
document.querySelector(".theme-toggle").setAttribute(
  "aria-label",
  `Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`,
);
document.querySelector('meta[name="theme-color"]').content =
  currentTheme === "dark" ? "#111914" : "#f4f0e6";
let installPrompt = null;
let waitingWorker = null;
let messageSubscription = null;
let realtimeRefreshTimer = null;
let updateRequested = false;
const installButton = document.querySelector("#install-app");
const connectionBanner = document.querySelector("#connection-banner");
const updateBanner = document.querySelector("#update-banner");

function applyConnectivityState(announce = false) {
  const offline = !navigator.onLine;
  document.body.classList.toggle("is-offline", offline);
  connectionBanner.hidden = !offline;
  connectionBanner.querySelector("span").textContent = offline
    ? "You’re offline. Browsing and device-local work remain available; connected changes are paused."
    : "Back online.";
  document.querySelectorAll("[data-connected-action]").forEach((control) => {
    control.disabled = offline;
    control.title = offline ? "Reconnect to use this feature" : "";
  });
  if (announce) notify(offline ? "WorkTrade is offline" : "Connection restored", offline ? "warning" : "success");
}

addEventListener("online", () => applyConnectivityState(true));
addEventListener("offline", () => applyConnectivityState(true));
document.querySelector("#retry-connection").addEventListener("click", () => applyConnectivityState(true));
addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
  if (choice.outcome === "accepted") notify("WorkTrade installed", "success");
});
addEventListener("appinstalled", () => {
  installButton.hidden = true;
  notify("WorkTrade installed", "success");
});
document.querySelector("#apply-update").addEventListener("click", () => {
  updateRequested = true;
  waitingWorker?.postMessage({ type: "SKIP_WAITING" });
});
if ("serviceWorker" in navigator) {
  addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    const showUpdate = (worker) => {
      waitingWorker = worker;
      updateBanner.hidden = false;
    };
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !updateRequested) return;
      refreshing = true;
      location.reload();
    });
  });
}
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

const persist = () =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ profile: state.profile, requests: state.requests }),
  );
let toastTimer;
const notify = (message, tone = "neutral") => {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
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
      (!state.examplesHidden || state.remote) &&
      request.status === "open" &&
      !(state.profile.blocked || []).includes(request.ownerId) &&
      (state.category === "All" || request.category === state.category) &&
      `${request.title} ${request.description} ${request.skills.join(" ")}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
  return shell(`
    <section class="hero">
      <div class="hero-copy"><span class="hero-kicker">A better way to get things done</span><h1>Useful work.<br><em>Fairly exchanged.</em></h1><p>Build, fix, install, restore, or maintain—trade money, skills, goods, or a thoughtful mix.</p>
      <div class="hero-actions"><button class="primary" data-action="post">Post work</button><button class="secondary" data-nav="network">Explore the network</button></div></div>
      <div class="hero-visual"><img src="assets/worktrade-hero.webp" alt="Neighbors sharing tools and skills while building and repairing together"><div class="balance-card"><span>Community pulse</span><strong>${state.requests.length} active stories</strong><div><b>12</b> skills offered <b>8</b> needs matched</div><p>No platform credits. People agree on value together.</p></div></div>
    </section>
    ${!state.remote && !state.examplesHidden ? `<div class="example-banner"><div><b>These are removable examples.</b><span>They demonstrate building, diagnosis, and an active project without pretending to be local listings.</span></div><button class="text-btn" data-action="hide-examples">Hide examples</button></div>` : ""}
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
  const workspace = request.agreement ? projectWorkspace(request, isOwner) : requestOverview(request, isOwner);
  return shell(
    `<button class="back" data-nav="discover">← Back to requests</button>
    ${request.agreement ? projectPath(request) : ""}
    <div class="detail-grid"><article class="detail-main">
      <div class="card-top"><span class="category">${esc(request.category)}</span><span>${esc(request.status)}</span></div>
      ${isOwner && state.remote && request.status === "open" ? `<div class="owner-actions"><button class="secondary" data-action="edit-request">Edit request</button><button class="text-btn" data-request-action="close">Close</button><button class="text-btn" data-request-action="archive">Archive</button><button class="danger-text" data-request-action="cancel">Cancel</button></div>` : ""}
      <h1>${esc(request.title)}</h1><p class="lede">${esc(request.description)}</p>
      <div class="facts"><div><small>Location</small><b>${esc(request.location)}</b></div><div><small>Timing</small><b>${esc(request.urgency)}</b></div><div><small>Cash range</small><b>${money(request.cashBudget)}</b></div></div>
      ${workspace}
    </article>
    <aside class="detail-side"><div class="person"><span class="avatar big">${request.initials}</span><div><small>Posted by</small><h3>${esc(request.owner)}</h3><p>${esc(request.location)}</p></div></div>
      ${request.agreement ? agreementCard(request) : isOwner ? `<div class="side-note"><b>Waiting for responses</b><p>Questions and offers will appear here. Compare the whole exchange before selecting formal terms.</p>${request.offers.length > 1 ? `<button class="secondary full" data-action="compare-offers">Compare offers</button>` : ""}</div>` : `<div class="contact-actions"><button class="primary full" data-action="offer" data-id="${request.id}">Offer to help</button><button class="secondary full" data-contact-person="${request.ownerId}" data-contact-request="${request.id}" data-contact-kind="question">Ask a question</button></div>`}
      <div class="side-note"><b>Choose your own exchange</b><p>Cash, goods, services, labor, access, or a combination. WorkTrade does not assign artificial credits.</p></div>
      <div class="safety-actions"><button class="text-btn" data-action="follow">${(request.followers || []).includes("me") ? "Following" : "Follow project"}</button><button class="text-btn" data-action="report">Report concern</button><button class="text-btn" data-action="block" data-person="${request.ownerId}">Block user</button></div>
      ${request.offers.length ? `<section class="proposals"><span class="eyebrow">Proposals</span>${request.offers.map((o) => offerCard(o, isOwner, request.id)).join("")}</section>` : ""}
    </aside></div>`,
    "Work request",
  );
}

function requestMedia(request, isOwner) {
  return request.media?.length ? `<div class="request-media">${request.media.map((item) => `<figure><img src="${esc(item.url)}" alt="${esc(item.caption || request.title)}"><figcaption><b>${esc(item.label || "current")}</b> ${esc(item.caption || "")}${isOwner && state.remote ? ` <button data-delete-media="${item.id}">Remove</button>` : ""}</figcaption></figure>`).join("")}</div>` : `<div class="empty compact"><b>No project photos yet</b><p>Add current-condition, progress, or completion photos when they help explain the work.</p></div>`;
}

function requestOverview(request, isOwner) {
  return `${requestMedia(request, isOwner)}<section><span class="eyebrow">Skills and capabilities</span><div class="tags large">${request.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></section><section><span class="eyebrow">Value available in return</span><div class="value-list">${request.offersInReturn.map((item) => `<div><span>↔</span>${esc(item)}</div>`).join("")}</div></section>${request.constraints ? `<section><span class="eyebrow">Constraints and site conditions</span><p>${esc(request.constraints)}</p></section>` : ""}`;
}

function projectWorkspace(request, isOwner) {
  const active = ["overview", "activity", "exchange", "files"].includes(state.projectDetailTab) ? state.projectDetailTab : "overview";
  const tabs = [["overview", "Overview"], ["activity", "Activity"], ["exchange", "Exchange"], ["files", "Files"]];
  const nav = `<nav class="project-tabs" aria-label="Project sections">${tabs.map(([id, label]) => `<button class="${active === id ? "active" : ""}" data-project-tab="${id}" aria-current="${active === id ? "page" : "false"}">${label}</button>`).join("")}</nav>`;
  const panels = {
    overview: `<div class="project-panel" data-project-panel="overview"><section><span class="eyebrow">Skills and capabilities</span><div class="tags large">${request.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></section>${request.constraints ? `<section><span class="eyebrow">Conditions to plan around</span><p>${esc(request.constraints)}</p></section>` : ""}${request.hold ? holdCard(request.hold) : ""}${request.milestones ? milestones(request) : ""}</div>`,
    activity: projectActivity(request),
    exchange: `<div class="project-panel" data-project-panel="exchange"><section><span class="eyebrow">Agreed value</span><h2>What each side is contributing</h2><div class="value-list">${request.offersInReturn.map((item) => `<div><span>↔</span>${esc(item)}</div>`).join("")}</div><button class="secondary" data-action="ledger">Open preparation and cost ledger</button></section>${request.agreement?.obligations?.length ? obligationCards(request.agreement) : `<div class="empty compact"><b>No separate exchange obligations</b><p>The accepted agreement remains the source of truth.</p></div>`}${request.agreement?.history ? historySection(request.agreement.history) : ""}</div>`,
    files: `<div class="project-panel" data-project-panel="files"><section><span class="eyebrow">Project photos</span><h2>Conditions, progress, and results</h2>${requestMedia(request, isOwner)}</section>${evidenceSection(request)}</div>`,
  };
  return `${nav}${panels[active]}`;
}

function projectActivity(request) {
  const entries = [
    ...(request.updates || []).map((item) => ({ type: "Update", author: item.author, text: item.text, date: item.date })),
    ...(request.messages || []).map((item) => ({ type: "Message", author: item.author, text: item.text, date: item.date, mine: item.authorId === state.profile.id })),
    ...((request.agreement?.history || []).map((item) => ({ type: "Agreement", author: "WorkTrade", text: `${item.from_status || "Created"} → ${item.to_status}${item.note ? ` · ${item.note}` : ""}`, date: item.created_at }))),
    ...(request.evidence || []).map((item) => ({ type: "Evidence", author: "Participant", text: `${item.skill}: ${item.description}`, date: item.created_at || item.verified_at })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return `<div class="project-panel" data-project-panel="activity"><section><div class="section-title"><div><span class="eyebrow">Project activity</span><h2>Updates, messages, and decisions</h2></div></div><div class="activity-feed">${entries.map((item) => `<article class="${item.mine ? "mine" : ""}"><span class="activity-type">${esc(item.type)}</span><div><b>${esc(item.author || "Participant")}</b><p>${esc(item.text)}</p><small>${esc(activityDate(item.date))}</small></div></article>`).join("") || `<div class="empty compact"><b>No activity yet</b><p>Updates, messages, evidence, and agreement decisions will appear here.</p></div>`}</div><div class="activity-composers"><form data-form="update" class="inline-form"><input name="text" required placeholder="Share a progress update"><button class="secondary">Post update</button></form><form data-form="message" class="inline-form"><input name="text" required maxlength="1000" placeholder="Message the other participant"><button class="secondary">Send message</button></form></div></section></div>`;
}

function activityDate(value) {
  if (!value) return "";
  if (typeof value === "string" && !/\b\d{4}\b/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function offerCard(offer, isOwner, requestId) {
  const awaitingMe = !offer.lastProposedBy || offer.lastProposedBy !== state.profile.id;
  return `<article class="offer"><div><span class="mini-avatar">${offer.initials}</span><b>${esc(offer.provider)}</b><span class="mode">${modeLabel(offer.mode)}</span></div><span class="proposal-version">Version ${offer.version || 1} · ${awaitingMe ? "Your response" : "Waiting for response"}</span><p><strong>Will provide:</strong> ${esc(offer.gives)}</p><p><strong>In exchange:</strong> ${esc(offer.wants)}</p><small>${esc(offer.duration)} · ${esc(offer.note)}</small>${offer.changedFields?.length ? `<div class="terms-changed"><b>Changed in this counter</b>${offer.changedFields.map((field) => `<span>${esc(field)}</span>`).join("")}</div>` : ""}${offer.history?.length ? `<details class="proposal-history"><summary>Earlier terms (${offer.history.length})</summary>${offer.history.map((version) => `<article><b>Version ${version.version} · ${esc(version.profiles?.display_name || "Participant")}</b><p>${esc(version.scope)} · ${esc(version.exchange_summary)}</p></article>`).join("")}</details>` : ""}${offer.discussion?.length ? `<div class="proposal-discussion">${offer.discussion.map((q) => `<p><b>${esc(q.profiles?.display_name || "Participant")}:</b> ${esc(q.body)}</p>`).join("")}</div>` : ""}${isOwner && awaitingMe ? `<div class="proposal-actions"><button class="primary" data-accept="${offer.id}" data-request="${requestId}">Accept latest terms</button><button class="secondary" data-counter-offer="${offer.id}" data-request="${requestId}">Counter</button><button class="text-btn" data-decline-offer="${offer.id}">Decline</button></div>` : ""}</article>`;
}
function findOffer(offerId) {
  return state.myOffers.find((offer) => offer.id === offerId) || state.requests.flatMap((request) => request.offers || []).find((offer) => offer.id === offerId);
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
  return `${next ? `<button class="secondary full" data-agreement="${next[0]}">${next[1]}</button>` : ""}${completion}${!["completed", "cancelled", "disputed"].includes(agreement.status) ? `<details class="project-tools"><summary>More project tools</summary><button class="text-btn full" data-action="schedule">Schedule</button><button class="text-btn full" data-action="ledger">Preparation & costs</button>${["scheduled","active","review"].includes(agreement.status)?`<button class="text-btn full" data-action="change-orders">Changes & issues</button>`:""}<button class="text-btn full" data-action="amend">Amend agreement</button><div class="agreement-links"><button data-agreement="disputed">Raise concern</button><button data-agreement="cancelled">Cancel project</button></div></details>` : ""}`;
}

function projectPath(request) {
  const agreement = request.agreement;
  const status = agreement.status;
  const confirmed = (agreement.confirmations || []).includes(state.profile.id);
  const items = request.milestones || [];
  const finished = items.filter((item) => item.done || item.completed_at).length;
  const blocked = Boolean(request.hold);
  const steps = [
    { name: "Agreement", state: status === "proposed" ? (confirmed ? "waiting" : "current") : "complete", note: status === "proposed" ? (confirmed ? "Waiting for the other participant" : "Review and confirm the same terms") : `Confirmed · version ${agreement.version || 1}` },
    { name: "Schedule", state: status === "agreed" ? "current" : status === "proposed" ? "upcoming" : "complete", note: status === "agreed" ? "Choose a shared work window" : agreement.proposed_start_at ? new Date(agreement.proposed_start_at).toLocaleString() : status === "proposed" ? "Available after agreement" : "Work window set" },
    { name: "Prepare", state: blocked ? "blocked" : status === "scheduled" ? "current" : ["active", "review", "completed"].includes(status) ? "complete" : "upcoming", note: blocked ? `Blocked — ${request.hold.type}: ${request.hold.detail}` : ["active", "review", "completed"].includes(status) ? "Ready for work" : "Confirm access, supplies, conditions, and costs" },
    { name: "Work", state: status === "active" ? "current" : ["review", "completed"].includes(status) ? "complete" : "upcoming", note: items.length ? `${finished} of ${items.length} milestones complete` : status === "active" ? "Work is in progress" : "Track the agreed result" },
    { name: "Changes", state: ["active", "review"].includes(status) ? "available" : status === "completed" ? "complete" : "upcoming", note: ["active", "review"].includes(status) ? "Record surprises before scope or value changes" : status === "completed" ? "No unresolved changes" : "Available during work" },
    { name: "Complete", state: status === "completed" ? "complete" : status === "review" ? "current" : "upcoming", note: status === "review" ? "Result is awaiting approval" : status === "completed" ? "Approved by both participants" : "Review the result and exchanged value" },
  ];
  let action = "";
  if (status === "proposed") action = confirmed ? `<button class="secondary" disabled>Waiting for confirmation</button>` : `<button class="primary" data-agreement="confirm">Confirm agreement</button>`;
  else if (status === "agreed") action = `<button class="primary" data-action="schedule">Set the schedule</button>`;
  else if (blocked) action = `<button class="primary" data-action="resolve-hold">Resolve dependency</button>`;
  else if (status === "scheduled") action = `<button class="primary" data-action="ledger">Check preparation</button>`;
  else if (status === "active" && finished < items.length) action = `<button class="primary" data-focus-milestones>Continue the next milestone</button>`;
  else if (status === "active") action = `<button class="primary" data-completion="request">Request completion review</button>`;
  else if (status === "review" && agreement.completion_requested_by !== state.profile.id) action = `<button class="primary" data-completion="approve">Approve completion</button>`;
  else if (status === "review") action = `<button class="secondary" disabled>Waiting for completion approval</button>`;
  return `<section class="project-path" aria-labelledby="project-path-title"><div class="project-path-head"><div><span class="eyebrow">Project path</span><h2 id="project-path-title">One clear step at a time</h2></div>${action}</div><ol>${steps.map((step) => `<li class="${step.state}"><span class="path-mark" aria-hidden="true">${step.state === "complete" ? "✓" : ""}</span><div><b>${step.name}</b><small>${esc(step.note)}</small></div><span class="path-state">${step.state === "available" ? "available" : step.state}</span></li>`).join("")}</ol></section>`;
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
  const journey = buildJourneyActions(active, state.networkInbox?.invitations || []);
  const activation = activationChecklist(posted, active);
  const negotiations = buildNegotiationInbox(posted);
  return shell(
    `<div class="section-title"><div><span class="eyebrow">My work</span><h1>${activation.complete ? "Keep every commitment visible." : "Start with one useful exchange."}</h1></div><button class="primary" data-action="post">Post work</button></div>
    ${activation.complete ? "" : activationPanel(activation)}
    <div class="stats"><div><b>${needsAction.length}</b><span>Need your action</span></div><div><b>${active.length}</b><span>Active agreements</span></div><div><b>${posted.filter((r) => r.status === "draft").length}</b><span>Draft requests</span></div><div><b>${state.myOffers.filter((o) => o.status === "pending").length}</b><span>Pending proposals</span></div></div>
    ${negotiationInbox(negotiations)}${journeyPanel(journey)}${dashboardGroup("Needs your action", needsAction)}${dashboardGroup("Requests I posted", posted, true)}${offerDashboard()}${dashboardGroup("Active work", active)}${dashboardGroup("Completed history", completed)}`,
    "Personal workspace",
  );
}

function buildNegotiationInbox(posted) {
  const owned = posted.flatMap((request) => (request.offers || []).map((offer) => ({ ...offer, requestId: request.id, requestTitle: request.title })));
  const submitted = state.myOffers.map((offer) => ({ ...offer, requestId: offer.request_id, requestTitle: offer.work_requests?.title || "Work request", gives: offer.scope, wants: offer.exchange_summary, duration: offer.duration_text || "To be agreed", lastProposedBy: offer.last_proposed_by }));
  return [...owned, ...submitted].filter((offer, index, list) => list.findIndex((item) => item.id === offer.id) === index).map((offer) => {
    const awaitingMe = offer.status === "pending" && (!offer.lastProposedBy || offer.lastProposedBy !== state.profile.id);
    const expiresAt = offer.expires_at ? new Date(offer.expires_at) : null;
    const hoursLeft = expiresAt ? Math.ceil((expiresAt - new Date()) / 36e5) : null;
    const status = offer.status !== "pending" ? offer.status : awaitingMe ? "waiting-on-you" : "waiting-on-them";
    return { ...offer, awaitingMe, expiresAt, hoursLeft, status };
  }).sort((a, b) => Number(b.awaitingMe) - Number(a.awaitingMe) || (a.expiresAt || Infinity) - (b.expiresAt || Infinity));
}

function negotiationInbox(items) {
  const actionable = items.filter((item) => item.awaitingMe);
  const current = items.filter((item) => item.status === "waiting-on-them");
  const recent = items.filter((item) => !["waiting-on-you", "waiting-on-them"].includes(item.status)).slice(0, 5);
  const cards = (list) => list.map((item) => `<article class="negotiation-card ${item.awaitingMe ? "action" : ""}"><div><span class="category">${esc(item.status.replaceAll("-", " "))}</span><small>Version ${item.version || 1}${item.hoursLeft != null && item.hoursLeft <= 48 ? ` · ${item.hoursLeft <= 0 ? "expired" : `${item.hoursLeft}h left`}` : ""}</small></div><h3>${esc(item.requestTitle)}</h3><p><b>Work:</b> ${esc(item.gives || item.scope || "Not specified")}</p><p><b>Exchange:</b> ${esc(item.wants || item.exchange_summary || "Not specified")}</p>${item.changedFields?.length ? `<div class="terms-changed"><b>Changed</b>${item.changedFields.map((field) => `<span>${esc(field)}</span>`).join("")}</div>` : ""}<div class="proposal-actions"><button class="text-btn" data-negotiation-open="${item.requestId}">Open request</button>${item.awaitingMe ? `<button class="primary" data-accept="${item.id}" data-request="${item.requestId}">Accept</button><button class="secondary" data-counter-offer="${item.id}">Counter</button><button class="text-btn" data-decline-offer="${item.id}">Decline</button>` : ""}</div></article>`).join("");
  return `<section class="negotiation-inbox"><div class="section-title"><div><span class="eyebrow">Negotiation inbox</span><h2>Latest terms, one response at a time.</h2></div><span>${actionable.length} need${actionable.length === 1 ? "s" : ""} your response</span></div><div class="negotiation-columns"><section><h3>Needs your response</h3>${cards(actionable) || '<div class="empty compact"><p>No proposal is waiting on you.</p></div>'}</section><section><h3>Waiting on someone else</h3>${cards(current) || '<div class="empty compact"><p>No outstanding responses.</p></div>'}</section></div>${recent.length ? `<details class="negotiation-recent"><summary>Recent accepted or declined proposals (${recent.length})</summary>${cards(recent)}</details>` : ""}</section>`;
}

function activationChecklist(posted = [], active = []) {
  const profile = state.profile;
  const steps = [
    { id: "profile", label: "Complete your work profile", detail: "Add a short introduction, general location, and availability.", done: Boolean(profile.bio && profile.location && profile.availability), action: "onboarding", button: "Complete profile" },
    { id: "value", label: "Describe what you offer and need", detail: "Specific skills, goods, equipment, and access produce better reciprocal matches.", done: (profile.offers || []).length > 0 && (profile.needs || []).length > 0, action: "onboarding", button: "Add offers and needs" },
    { id: "matches", label: "Review your first matches", detail: "Every score explains both directions of the possible exchange.", done: Object.keys(state.matchFeedback || {}).length > 0 || state.view === "matches", nav: "matches", button: "See matches" },
    { id: "contact", label: "Contact one possible collaborator", detail: "An invitation states what you need and what you can offer before messaging opens.", done: (state.networkInbox?.invitations || []).length > 0 || state.myOffers.length > 0, nav: "network", button: "Find a collaborator" },
    { id: "work", label: "Post or propose real work", detail: "Define the desired result, responsibilities, exclusions, timing, and fair value.", done: posted.length > 0 || state.myOffers.length > 0 || active.length > 0, action: "post", button: "Post work" },
  ];
  return { steps, complete: steps.every((step) => step.done), completed: steps.filter((step) => step.done).length };
}

function activationPanel(activation) {
  return `<section class="activation-panel"><div class="activation-head"><div><span class="eyebrow">First exchange checklist</span><h2>${activation.completed} of ${activation.steps.length} steps complete</h2><p>WorkTrade reveals advanced tools when the work needs them. You only need these fundamentals to begin.</p></div><div class="activation-progress" role="progressbar" aria-label="First exchange progress" aria-valuemin="0" aria-valuemax="${activation.steps.length}" aria-valuenow="${activation.completed}"><span style="width:${activation.completed / activation.steps.length * 100}%"></span></div></div><ol>${activation.steps.map((step) => `<li class="${step.done ? "done" : ""}"><span>${step.done ? "✓" : ""}</span><div><b>${step.label}</b><small>${step.detail}</small></div>${step.done ? `<em>Complete</em>` : `<button class="secondary" ${step.action ? `data-action="${step.action}"` : `data-nav="${step.nav}"`}>${step.button}</button>`}</li>`).join("")}</ol></section>`;
}

function requestJourneyAction(request) {
  const agreement = request.agreement;
  if (!agreement) return null;
  const mine = (agreement.obligations || []).find((item) => item.responsible_profile_id === state.profile.id && item.status === "pending");
  const approval = (agreement.obligations || []).find((item) => item.responsible_profile_id !== state.profile.id && item.status === "submitted");
  const incomplete = (request.milestones || []).find((item) => !item.done && !item.completed_at);
  if (request.hold) return { rank: 2, title: `Resolve dependency for ${request.title}`, detail: `${request.hold.type}: ${request.hold.detail}`, label: "Open dependency", requestId: request.id };
  if (request.status === "proposed" && !(agreement.confirmations || []).includes(state.profile.id)) return { rank: 1, title: `Confirm terms for ${request.title}`, detail: `Review agreement version ${agreement.version || 1}; confirmation applies only to this version.`, label: "Review terms", requestId: request.id };
  if (request.status === "proposed") return { rank: 6, waiting: true, title: `Waiting for confirmation on ${request.title}`, detail: "The other participant must confirm the same version before scheduling.", label: "View status", requestId: request.id };
  if (approval) return { rank: 1, title: `Approve exchanged value for ${request.title}`, detail: approval.description, label: "Review fulfillment", requestId: request.id };
  if (request.status === "review" && agreement.completion_requested_by !== state.profile.id) return { rank: 1, title: `Review completion of ${request.title}`, detail: "Approve the result or return it to active work with a clear update.", label: "Review completion", requestId: request.id };
  if (request.status === "review") return { rank: 6, waiting: true, title: `Waiting for completion approval`, detail: `The other participant is reviewing ${request.title}.`, label: "View status", requestId: request.id };
  if (mine) return { rank: 2, title: `Submit your side of the exchange`, detail: mine.description, label: "Open obligation", requestId: request.id };
  if (agreement.status === "agreed") return { rank: 2, title: `Schedule ${request.title}`, detail: "Set a shared date, time zone, and practical work window.", label: "Set schedule", requestId: request.id };
  if (agreement.status === "scheduled") return { rank: 2, title: `Start ${request.title}`, detail: "Confirm the work has begun when both participants are ready.", label: "Start work", requestId: request.id };
  if (incomplete) return { rank: 3, title: `Continue: ${incomplete.title}`, detail: `The next incomplete milestone for ${request.title}.`, label: "Open milestone", requestId: request.id };
  if (agreement.status === "active") return { rank: 4, title: `Request completion approval`, detail: `All listed milestones for ${request.title} are complete.`, label: "Review project", requestId: request.id };
  return null;
}

function invitationJourneyAction(invitation) {
  const incoming = invitation.recipient_id === state.profile.id;
  const other = incoming ? invitation.sender_name : invitation.recipient_name;
  if (invitation.invitation_kind && invitation.invitation_kind !== "exchange") {
    if (invitation.status === "pending") return incoming
      ? { rank: 0, title: `${invitation.invitation_kind === "question" ? "Question" : "Message"} from ${other}`, detail: invitation.note || "They would like to start a conversation.", label: "Review message", invitationId: invitation.id }
      : { rank: 7, waiting: true, title: `Message sent to ${other}`, detail: "They decide whether to open the conversation.", label: "View message", invitationId: invitation.id };
    return null;
  }
  if (invitation.status === "pending") return incoming
    ? { rank: 0, title: `Respond to ${other}`, detail: `${invitation.need_text} in exchange for ${invitation.offer_text}`, label: "Review invitation", invitationId: invitation.id }
    : { rank: 7, waiting: true, title: `Waiting for ${other}`, detail: "They decide whether to open a private planning conversation.", label: "View invitation", invitationId: invitation.id };
  if (invitation.status !== "accepted") return null;
  const workspace = invitation.workspace;
  if (!workspace) return { rank: 1, title: `Define the work with ${other}`, detail: "Agree on scope, responsibilities, materials, timing, exclusions, and exchange value.", label: "Start planning", invitationId: invitation.id };
  const myConfirmation = incoming ? workspace.recipient_confirmed_version : workspace.sender_confirmed_version;
  const otherConfirmation = incoming ? workspace.sender_confirmed_version : workspace.recipient_confirmed_version;
  if (myConfirmation !== workspace.version) return { rank: 1, title: `Confirm planning terms with ${other}`, detail: `Review version ${workspace.version}. Any edit clears prior confirmations.`, label: "Review workspace", invitationId: invitation.id };
  if (otherConfirmation !== workspace.version) return { rank: 7, waiting: true, title: `Waiting for ${other} to confirm`, detail: `Your confirmation of planning version ${workspace.version} is recorded.`, label: "View workspace", invitationId: invitation.id };
  return { rank: 1, title: `Create the private work project`, detail: `Both participants confirmed version ${workspace.version}.`, label: "Create project", invitationId: invitation.id, convert: true };
}

function buildJourneyActions(requests, invitations) {
  return [...invitations.map(invitationJourneyAction), ...requests.map(requestJourneyAction)].filter(Boolean).sort((a, b) => a.rank - b.rank);
}

function journeyPanel(items) {
  const primary = items.find((item) => !item.waiting) || items[0];
  if (!primary) return `<section class="journey-panel complete"><span class="eyebrow">Next action</span><h2>You’re caught up.</h2><p>New invitations, confirmations, milestones, and completion reviews will appear here.</p></section>`;
  const button = primary.convert ? `<button class="primary" data-convert-intro="${primary.invitationId}">${esc(primary.label)}</button>` : primary.invitationId ? `<button class="primary" data-journey-invitation="${primary.invitationId}">${esc(primary.label)}</button>` : `<button class="primary" data-open="${primary.requestId}">${esc(primary.label)}</button>`;
  return `<section class="journey-panel ${primary.waiting ? "waiting" : ""}"><div><span class="eyebrow">${primary.waiting ? "Waiting on someone else" : "Your next action"}</span><h2>${esc(primary.title)}</h2><p>${esc(primary.detail)}</p></div>${button}${items.length > 1 ? `<details><summary>${items.length - 1} more upcoming or waiting</summary><ol>${items.slice(1).map((item) => `<li><b>${esc(item.title)}</b><span>${esc(item.detail)}</span></li>`).join("")}</ol></details>` : ""}</section>`;
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
  return `<section class="dashboard-group"><h2>Proposals I submitted</h2>${state.myOffers.map((o) => { const countered = o.status === "pending" && o.last_proposed_by && o.last_proposed_by !== state.profile.id; return `<article class="work-row"><span class="category">${countered ? "countered" : esc(o.status)}</span><div><h3>${esc(o.work_requests?.title || "Work request")}</h3><p>${esc(o.scope)} · ${esc(o.exchange_summary)}</p><small>Version ${o.version || 1}${countered ? " · your response needed" : ""}</small></div>${o.status === "pending" ? `<div class="dashboard-actions">${countered ? `<button data-accept="${o.id}">Accept counter</button><button data-counter-offer="${o.id}">Counter again</button><button data-decline-offer="${o.id}">Decline</button>` : `<button data-edit-offer="${o.id}">Revise</button><button data-withdraw-offer="${o.id}">Withdraw</button>`}</div>` : ""}</article>`; }).join("") || `<div class="empty">No submitted proposals.</div>`}</section>`;
}

function avatarMarkup(url, name, size = "") {
  const initials = (name || "WT").split(/\s+/).map((x) => x[0]).join("").slice(0, 2);
  return url ? `<span class="avatar ${size} photo"><img src="${esc(url)}" alt="${esc(name)} profile photo"></span>` : `<span class="avatar ${size}">${esc(initials)}</span>`;
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
  return `<article class="person-card">${avatarMarkup(p.avatar_url, p.display_name, "big")}<div><h3>${esc(p.display_name)}</h3><small>${esc(p.location_text || "Location not listed")}${p.remote_available ? " · Remote available" : ""}</small><p><b>Offers:</b> ${esc(offers.join(" · ") || "Not listed")}</p><p><b>Needs:</b> ${esc(needs.join(" · ") || "Not listed")}</p>${overlap.length ? `<p class="match-reason">Matches what you need: ${esc(overlap.join(", "))}</p>` : ""}<small>${p.completed_count || 0} completed · ${p.review_count || 0} reviews</small><div class="person-card-actions"><button class="text-btn" data-view-profile="${p.id}">View evidence</button>${state.session && p.id !== state.profile.id ? `<button class="text-btn" data-follow-person="${p.id}">${state.profile.following?.includes(p.id) ? "Following" : "Follow"}</button>` : ""}</div></div></article>`;
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
  return `<div class="inbox-list">${(inbox.invitations || []).map((i) => {
    const incoming = i.recipient_id === state.profile.id;
    const messages = (inbox.messages || []).filter((m) => m.invitation_id === i.id);
    const workspace = i.workspace;
    const bothConfirmed = workspace && workspace.sender_confirmed_version === workspace.version && workspace.recipient_confirmed_version === workspace.version;
    const accepted = i.status === "accepted";
    const kind = i.invitation_kind || "exchange";
    const isExchange = kind === "exchange";
    const kindLabel = kind === "question" ? "question" : kind === "message" ? "message request" : "exchange invitation";
    return `<article><div><span class="category">${esc(i.status)}</span> <b>${esc(incoming ? i.sender_name : i.recipient_name)}</b><small>${incoming ? ` sent you a ${kindLabel}` : ` received your ${kindLabel}`}</small></div>${isExchange ? `<p><b>Need:</b> ${esc(i.need_text)} <b>Offer:</b> ${esc(i.offer_text)}</p>` : ""}${i.note ? `<p class="message-request-note">${esc(i.note)}</p>` : ""}${incoming && i.status === "pending" ? `<button class="secondary" data-invite-response="accepted:${i.id}">${isExchange ? "Accept" : "Open conversation"}</button> <button class="text-btn" data-invite-response="declined:${i.id}">Decline</button> <button class="text-btn" data-invite-response="muted:${i.id}">Mute</button>` : ""}${accepted && isExchange ? `<div class="workspace-summary"><b>${workspace?.scope ? esc(workspace.scope) : "Planning workspace not started"}</b><small>${workspace ? `Terms v${workspace.version}${bothConfirmed ? " · confirmed by both" : " · confirmation pending"}` : "Define scope, exchange, and availability together"}</small><button class="secondary" data-workspace="${i.id}">Open planning workspace</button>${bothConfirmed ? `<button class="primary" data-convert-intro="${i.id}">Create private work draft</button>` : ""}</div>` : ""}${accepted ? `<div class="intro-thread">${messages.map((m) => `<p><b>${esc(m.author_name)}:</b> ${esc(m.body)}</p>`).join("")}<form data-form="intro-message" data-invitation="${i.id}" class="inline-form"><input name="body" required maxlength="1500" placeholder="Write a message"><button class="secondary">Send</button></form></div>` : ""}<div class="conversation-safety">${["declined", "muted", "accepted"].includes(i.status) ? `<button class="text-btn" data-network-manage="invitation:archive:${i.id}">Archive</button>` : ""}<button class="text-btn" data-network-manage="profile:report:${i.id}">Report</button><button class="danger-text" data-network-manage="profile:block:${i.id}">Block</button></div></article>`;
  }).join("") || '<div class="empty"><p>No conversations yet. Message someone whose work fits yours.</p></div>'}</div>`;
}

function conversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderMessages() {
  if (!state.session) return shell(`<section class="messages-welcome"><span class="eyebrow">Private conversations</span><h1>Talk first. Trade when it makes sense.</h1><p>Sign in to see message requests and conversations.</p><button class="primary" data-action="sign-in">Sign in</button></section>`, "Messages");
  const inbox = state.networkInbox || { invitations: [], messages: [] };
  const query = (state.messageQuery || "").trim().toLowerCase();
  const conversations = (inbox.invitations || []).filter((item) => {
    const archived = !!item.member_state?.archived_at;
    if (archived !== !!state.showArchivedMessages) return false;
    const other = item.sender_id === state.profile.id ? item.recipient_name : item.sender_name;
    const request = state.requests.find((entry) => entry.id === item.request_id);
    return !query || `${other} ${item.note || ""} ${request?.title || ""}`.toLowerCase().includes(query);
  });
  const selected = state.messageListOnly && window.matchMedia("(max-width: 760px)").matches ? null : conversations.find((item) => item.id === state.selectedConversationId) || conversations[0] || null;
  if (selected && selected.id !== state.selectedConversationId) queueMicrotask(() => { state.selectedConversationId = selected.id; });
  const list = conversations.map((item) => {
    const other = item.sender_id === state.profile.id ? item.recipient_name : item.sender_name;
    const messages = (inbox.messages || []).filter((message) => message.invitation_id === item.id);
    const latest = messages.at(-1);
    const preview = latest?.body || item.note || (item.status === "pending" ? "Waiting for a response" : "Conversation opened");
    const unread = Number(item.unread_count || 0);
    return `<button class="conversation-row ${selected?.id === item.id ? "active" : ""} ${unread ? "unread" : ""}" data-conversation="${item.id}"><span class="avatar">${esc(other.split(/\s+/).map((part) => part[0]).join("").slice(0, 2))}</span><span><b>${esc(other)}</b><small>${esc(preview)}</small></span><span class="conversation-meta"><time>${conversationTime(latest?.created_at || item.created_at)}</time>${unread ? `<i>${unread}</i>` : ""}</span></button>`;
  }).join("");
  return shell(`<section class="messages-page"><div class="messages-title"><div><span class="eyebrow">Private conversations</span><h1>Messages</h1></div><button class="secondary" data-nav="network">Find people</button></div><div class="messages-layout ${selected ? "has-selection" : ""}"><aside class="conversation-list" aria-label="Conversations"><form data-form="message-search" class="message-search"><input name="query" aria-label="Search conversations" value="${esc(state.messageQuery || "")}" placeholder="Search conversations"><button class="secondary">Search</button></form><button class="text-btn archive-toggle" data-action="toggle-message-archive">${state.showArchivedMessages ? "Back to inbox" : "Archived"}</button>${list || `<div class="empty"><p>${state.showArchivedMessages ? "No archived conversations." : "No conversations yet."}</p><button class="secondary" data-nav="network">Find someone to message</button></div>`}</aside>${selected ? conversationPanel(selected, inbox) : `<section class="conversation-empty"><span aria-hidden="true">✉</span><h2>Choose a conversation</h2><p>Messages, questions, and formal exchange planning stay connected without becoming the same thing.</p></section>`}</div></section>`, "Messages");
}

function conversationPanel(invitation, inbox) {
  const incoming = invitation.recipient_id === state.profile.id;
  const otherId = incoming ? invitation.sender_id : invitation.recipient_id;
  const other = incoming ? invitation.sender_name : invitation.recipient_name;
  const allMessages = (inbox.messages || []).filter((item) => item.invitation_id === invitation.id);
  const pageSize = state.messagePageSizes[invitation.id] || 40;
  const messages = allMessages.slice(-pageSize);
  const attachments = inbox.attachments || [];
  const request = state.requests.find((item) => item.id === invitation.request_id);
  const pendingIncoming = incoming && invitation.status === "pending";
  const accepted = ["accepted", "converted"].includes(invitation.status);
  return `<section class="conversation-panel" aria-label="Conversation with ${esc(other)}"><header><button class="text-btn messages-back" data-action="messages-back">← Inbox</button><button class="conversation-person" data-view-profile="${otherId}"><span class="avatar">${esc(other.split(/\s+/).map((part) => part[0]).join("").slice(0, 2))}</span><span><b>${esc(other)}</b><small>${invitation.member_state?.muted ? "Notifications muted" : "Private conversation"}</small></span></button><div class="conversation-tools"><button class="text-btn" data-conversation-manage="${invitation.member_state?.muted ? "unmute" : "mute"}:${invitation.id}">${invitation.member_state?.muted ? "Unmute" : "Mute"}</button><button class="text-btn" data-conversation-manage="archive:${invitation.id}">Archive</button></div></header>${request ? `<aside class="conversation-context"><span><small>Related work</small><b>${esc(request.title)}</b></span><button class="secondary compact" data-open="${request.id}">View work</button></aside>` : ""}<div class="message-thread">${allMessages.length > messages.length ? `<button class="text-btn load-older" data-load-messages="${invitation.id}">Load ${Math.min(40, allMessages.length - messages.length)} older messages</button>` : ""}${invitation.note ? `<div class="message-bubble ${incoming ? "theirs" : "mine"}"><p>${esc(invitation.note)}</p><small>${esc(incoming ? invitation.sender_name : "You")} · ${conversationTime(invitation.created_at)}</small></div>` : ""}${messages.map((message) => { const files = attachments.filter((item) => item.message_id === message.id); const mine = message.author_id === state.profile.id; const receipt = mine ? (invitation.other_read_at && new Date(invitation.other_read_at) >= new Date(message.created_at) ? "Read" : "Delivered") : ""; return `<div class="message-bubble ${mine ? "mine" : "theirs"}"><p>${esc(message.body)}</p>${files.map((file) => file.mime_type.startsWith("image/") && file.url ? `<a class="message-image" href="${esc(file.url)}" target="_blank" rel="noopener"><img src="${esc(file.url)}" alt="${esc(file.file_name)}"><span>${esc(file.file_name)}</span></a>` : `<a class="message-file" href="${esc(file.url)}" target="_blank" rel="noopener"><span aria-hidden="true">📎</span><span><b>${esc(file.file_name)}</b><small>${Math.max(1, Math.round(file.byte_size / 1024))} KB</small></span></a>`).join("")}<small>${mine ? "You" : esc(message.author_name)} · ${conversationTime(message.created_at)}${receipt ? ` · ${receipt}` : ""}</small></div>`; }).join("") || (!invitation.note ? `<p class="thread-empty">No messages yet.</p>` : "")}</div>${pendingIncoming ? `<div class="message-consent"><p><b>${esc(other)} wants to start a conversation.</b> Open it to reply. You can decline or mute without notifying them further.</p><button class="primary" data-invite-response="accepted:${invitation.id}">Open conversation</button><button class="text-btn" data-invite-response="declined:${invitation.id}">Decline</button></div>` : accepted ? `<form data-form="intro-message" data-invitation="${invitation.id}" class="message-composer"><label><span class="sr-only">Message ${esc(other)}</span><textarea name="body" maxlength="1500" data-message-draft="${invitation.id}" placeholder="Write a message">${esc(state.messageDrafts[invitation.id] || "")}</textarea></label><label class="attachment-button" title="Attach a photo or document"><span aria-hidden="true">📎</span><span class="sr-only">Attach file</span><input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.doc,.docx"></label><button class="primary">Send</button><small class="composer-help">Enter to send · Shift+Enter for a new line · 10 MB maximum</small></form><div class="conversation-next"><span><b>Ready to make it concrete?</b><small>Turn the discussion into clear work and exchange terms.</small></span><button class="secondary" data-message-offer="${invitation.id}">${request && request.ownerId !== state.profile.id ? "Create an offer" : "Plan an exchange"}</button></div>` : `<div class="message-consent"><p>${invitation.status === "pending" ? "Waiting for them to open the conversation." : `This conversation is ${esc(invitation.status)}.`}</p></div>`}<footer><button class="text-btn" data-network-manage="profile:report:${invitation.id}">Report</button><button class="danger-text" data-network-manage="profile:block:${invitation.id}">Block</button></footer></section>`;
}
function renderNetwork() {
  const profiles = localDiscoveryProfiles(state.networkProfiles || []);
  const activity = state.networkActivity || [];
  const inbox = state.networkInbox || {
    invitations: [],
    messages: [],
    saved_profiles: [],
    saved_searches: [],
  };
  return shell(
    `<section class="network-hero"><span class="eyebrow">Trusted local work communities</span><h1>Useful work starts with people<br>who share a place.</h1><p>Bring a neighborhood, maker space, nonprofit, trade school, or small-business community together around practical needs, useful skills, and fair exchange.</p><div class="community-factors"><span>Nearby & transport</span><span>Time & availability</span><span>Tools & equipment</span><span>Workspace & site access</span></div></section><form data-form="network-search" class="controls network-filters"><label class="search"><span>⌕</span><input name="query" aria-label="Search the work network" value="${esc(state.networkQuery || "")}" placeholder="Search skills, needs, names, or locations"></label><select name="exchange" aria-label="Exchange type"><option value="">Any exchange</option><option value="barter">Barter</option><option value="cash">Cash</option><option value="hybrid">Cash + barter</option></select><label><input type="checkbox" name="remote" ${state.networkRemote ? "checked" : ""}> Remote available</label><button class="secondary">Find people</button>${state.session ? `<button type="button" class="text-btn" data-action="save-search">Save search</button>` : ""}</form>${state.session && inbox.invitations.length ? `<aside class="messages-shortcut"><span><b>${inbox.invitations.length} conversation${inbox.invitations.length === 1 ? "" : "s"}</b><small>Questions and messages now live in one focused inbox.</small></span><button class="primary" data-nav="messages">Open Messages</button></aside>` : ""}<div class="two-col"><section><span class="eyebrow">Suggested collaborators</span><h2>${profiles.length} people with useful overlap</h2><div class="people-list">${profiles.map(networkPersonCard).join("") || '<div class="empty"><p>No matching public profiles yet.</p></div>'}</div></section><section><div class="feed-heading"><div><span class="eyebrow">Work activity</span><h2>Useful things moving forward</h2></div>${state.session ? `<label><input type="checkbox" data-following-feed ${state.networkFollowingOnly ? "checked" : ""}> Following only</label>` : ""}</div><div class="activity-list">${activity.map(activityCard).join("") || '<div class="empty"><p>No activity matches this feed.</p></div>'}</div></section></div>`,
    "Community network",
  );
}

function localDiscoveryProfiles(profiles) {
  const availability = (state.networkAvailability || "").toLowerCase();
  const filtered = profiles.filter((profile) => {
    const nearby = profile.location_band === "Same general area";
    if (state.networkMode === "nearby" && !nearby) return false;
    if (state.networkMode === "remote" && !profile.remote_available) return false;
    if (availability && !(profile.availability_text || "").toLowerCase().includes(availability)) return false;
    return true;
  });
  return filtered.map((profile) => ({ ...profile, location_text: profile.location_band || profile.location_text })).sort((a, b) => {
    if (state.networkSort === "distance") return (a.location_band === "Same general area" ? 0 : 1) - (b.location_band === "Same general area" ? 0 : 1);
    if (state.networkSort === "availability") return Number(!!b.availability_text) - Number(!!a.availability_text);
    if (state.networkSort === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    return Number(b.match_score || 0) - Number(a.match_score || 0);
  });
}

function hydrateLocalDiscovery() {
  if (state.view !== "network") return;
  const form = main.querySelector('form[data-form="network-search"]');
  if (!form) return;
  form.classList.add("local-discovery");
  const discoveryShortcuts = ["Carpentry", "Auto repair", "Electrical", "Landscaping", "Web design", "Photography"];
  form.innerHTML = `<label class="search"><span>⌕</span><input name="query" aria-label="Search the work network" value="${esc(state.networkQuery || "")}" placeholder="Search skills, needs, or names"></label><label>Where<select name="mode"><option value="either">Nearby or remote</option><option value="nearby">Nearby only</option><option value="remote">Remote only</option></select></label><label>Travel radius<select name="radius"><option value="10">10 km</option><option value="25">25 km</option><option value="40">40 km</option><option value="80">80 km</option><option value="160">160 km</option></select></label><label>Availability<select name="availability"><option value="">Any time</option><option value="now">Available now</option><option value="week">This week</option><option value="weekend">Weekends</option><option value="evening">Evenings</option></select></label><label>Exchange<select name="exchange" aria-label="Exchange type"><option value="">Any exchange</option><option value="barter">Barter</option><option value="cash">Cash</option><option value="hybrid">Cash + barter</option></select></label><label>Sort<select name="sort"><option value="fit">Reciprocal fit</option><option value="distance">Distance band</option><option value="availability">Availability</option><option value="newest">Newest</option></select></label><button class="secondary">Find people</button>${state.session ? `<button type="button" class="text-btn" data-action="save-search">Save alert</button>` : ""}<p class="location-privacy">Distance is shown only as an approximate band. Exact addresses are never used or revealed.</p>`;
  form.elements.mode.value = state.networkMode;
  form.innerHTML = `<label class="search"><span>⌕</span><input name="query" aria-label="Search the work network" value="${esc(state.networkQuery || "")}" placeholder="Try carpenter, mechanic, web design…"></label><label>Where<select name="mode"><option value="either">Nearby or remote</option><option value="nearby">Same general area</option><option value="remote">Remote only</option></select></label><label>Availability<select name="availability"><option value="">Any time</option><option value="now">Available now</option><option value="week">This week</option><option value="weekend">Weekends</option><option value="evening">Evenings</option></select></label><label>Exchange<select name="exchange" aria-label="Exchange type"><option value="">Any exchange</option><option value="barter">Barter</option><option value="cash">Cash</option><option value="hybrid">Cash + barter</option></select></label><label>Sort<select name="sort"><option value="fit">Reciprocal fit</option><option value="distance">Area match</option><option value="availability">Availability</option><option value="newest">Newest</option></select></label><button class="secondary">Find people</button>${state.session ? `<button type="button" class="text-btn" data-action="save-search">Save alert</button>` : ""}<div class="skill-shortcuts" aria-label="Popular skill searches">${discoveryShortcuts.map((x) => `<button type="button" class="chip" data-skill-search="${x}">${x}</button>`).join("")}</div><p class="location-privacy">Nearby means the same member-provided general area. WorkTrade does not collect coordinates or reveal exact addresses.</p>`;
  form.elements.mode.value = state.networkMode;
  form.elements.availability.value = state.networkAvailability;
  form.elements.exchange.value = state.networkExchange;
  form.elements.sort.value = state.networkSort;
}

function socialPersonCard(p) {
  if (!state.session || p.id === state.profile.id) return networkPersonCard(p);
  const saved = (state.networkInbox?.saved_profiles || []).includes(p.id);
  const actions = `<div class="social-actions"><button class="primary compact" data-contact-person="${p.id}">Message</button><button class="secondary compact" data-save-person="${p.id}">${saved ? "Saved" : "Save"}</button></div>`;
  return networkPersonCard(p).replace(
    "</div></article>",
    `${actions}</div></article>`,
  );
}

function hydrateNetworkSocial() {
  if (state.view !== "network") return;
  const profiles = localDiscoveryProfiles(state.networkProfiles || []);
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
      actions.innerHTML = `<button class="primary compact" data-contact-person="${profile.id}">Message</button><button class="secondary compact" data-save-person="${profile.id}">${saved ? "Saved" : "Save"}</button>`;
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
      .querySelector(".two-col")
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
      .querySelector(".two-col")
      ?.insertAdjacentHTML(
        "beforebegin",
        `<section class="circles-hub"><div class="section-title"><div><span class="eyebrow">Your trusted communities</span><h2>Coordinate useful work with people connected by place.</h2><p>Private by default, grounded in community history, and built for real needs—not popularity.</p></div><button class="primary" data-action="create-circle">Create community</button></div><div class="circle-grid">${hub.circles.map((circle) => `<article class="circle"><span class="category">${esc(circle.visibility)}</span><h3>${esc(circle.name)}</h3><p>${esc(circle.description || "")}</p><small>${circle.member_count} members · ${circle.request_count} open needs</small><button class="secondary" data-open-circle="${circle.id}">${circle.membership?.status === "active" ? "Open community" : circle.membership?.status === "requested" ? "Requested" : circle.membership?.status === "invited" ? "Review invitation" : "Request access"}</button></article>`).join("") || '<div class="empty"><h3>Start with people you already know.</h3><p>Create an invite-only community for your block, shop, school, organization, or shared workspace.</p><button class="primary" data-action="create-circle">Create the first community</button></div>'}</div>${selected ? circleDetail(selected, hub) : ""}</section>`,
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
  const activeMembers = members.filter((member) => member.status === "active");
  const completed = activeMembers.reduce((sum, member) => sum + Number(member.completed_inside || 0), 0);
  const returning = activeMembers.filter((member) => Number(member.completed_inside || 0) > 1).length;
  const pending = members.filter((member) => member.status === "requested").length;
  return `<section class="circle-detail"><div class="section-title"><div><span class="eyebrow">${esc(membership.role)} · ${esc(circle.visibility)} community</span><h2>${esc(circle.name)}</h2><p>${esc(circle.description || "")}</p></div><div><button class="secondary" data-circle-post="${circle.id}">Post a need</button><button class="secondary" data-circle-resource="${circle.id}">Share a resource</button>${membership.role !== "owner" ? `<button class="text-btn" data-circle-membership="leave:${circle.id}:${state.profile.id}">Leave</button>` : ""}</div></div><div class="community-health" aria-label="Community activity"><div><b>${requests.length}</b><span>open needs</span></div><div><b>${resources.length}</b><span>shared resources</span></div><div><b>${completed}</b><span>work completed</span></div><div><b>${returning}</b><span>returning contributors</span></div></div><div class="community-start"><article><span>Need help?</span><h3>Describe useful work</h3><p>Share the outcome, timing, access, and what you can exchange.</p><button class="secondary" data-circle-post="${circle.id}">Post community work</button></article><article><span>Can help?</span><h3>See open needs</h3><p>Find practical work where your skills, schedule, and location fit.</p><button class="secondary" data-community-needs>Browse below</button></article><article><span>Have something useful?</span><h3>Share access</h3><p>Offer tools, equipment, transport, materials, or workspace.</p><button class="secondary" data-circle-resource="${circle.id}">Share resource</button></article></div>${moderator ? `<aside class="organizer-panel"><div><span class="eyebrow">Organizer view</span><h3>Keep the community useful</h3><p>${pending ? `${pending} membership request${pending === 1 ? "" : "s"} need a decision.` : requests.length ? "Help open needs find the right members." : "Seed one real need so members know how to participate."}</p></div><div><button class="secondary" data-circle-invite="${circle.id}">Invite members</button><button class="secondary" data-circle-post="${circle.id}">Seed a need</button><button class="secondary" data-circle-resource="${circle.id}">Add shared resource</button></div></aside>` : ""}<div class="circle-rules"><b>Community rules</b><p>${esc(circle.rules || "No additional rules have been posted.")}</p></div><div class="circle-columns"><section><h3>People you know through this community</h3>${members.map((member) => `<article class="circle-member"><b>${esc(member.display_name)}</b><span>${esc(member.role)} · ${member.completed_inside} completed here</span>${moderator && member.profile_id !== state.profile.id ? `${member.status === "requested" ? `<button data-circle-membership="approve:${circle.id}:${member.profile_id}">Approve</button><button data-circle-membership="decline:${circle.id}:${member.profile_id}">Decline</button>` : `<button data-circle-membership="remove:${circle.id}:${member.profile_id}">Remove</button>`}${membership.role === "owner" && member.status === "active" ? `<button data-circle-role="${circle.id}:${member.profile_id}:${member.role === "moderator" ? "member" : "moderator"}">${member.role === "moderator" ? "Make member" : "Make moderator"}</button>` : ""}` : ""}</article>`).join("")}<button class="text-btn" data-circle-invite="${circle.id}">Invite profile</button></section><section><h3>Shared tools, materials, and access</h3>${resources.map((resource) => `<article class="circle-resource"><span class="category">${esc(resource.kind)}</span><b>${esc(resource.name)}</b><p>${esc(resource.description)}</p><small>${esc(resource.owner_name)} · ${esc(resource.availability_text || "Ask about availability")}</small>${resource.owner_id === state.profile.id || moderator ? `<button class="text-btn" data-delete-circle-resource="${resource.id}">Remove</button>` : ""}</article>`).join("") || "<p>No shared resources yet.</p>"}</section></div><section data-community-needs-list><h3>Open community needs</h3>${requests.map((request) => `<article class="activity-card"><span class="category">${esc(request.stage)}</span><h3>${esc(request.title)}</h3><p>${esc(request.description)}</p><small>${esc(request.owner_name)} · known through ${esc(circle.name)}</small></article>`).join("") || "<p>No community work has been posted yet.</p>"}</section></section>`;
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
function contactRequestModal(profileId, displayName, request = null, kind = "message") {
  const question = kind === "question";
  openModal(`<span class="eyebrow">${question ? "Question about work" : "Message request"}</span><h2>${request ? `Ask ${esc(displayName)} about ${esc(request.title)}.` : `Message ${esc(displayName)}.`}</h2><p>Start with a short, useful message. They choose whether to open the conversation. You can discuss scope and exchange terms afterward.</p><form data-form="contact-request" data-profile="${profileId}" data-request="${request?.id || ""}" data-kind="${question ? "question" : "message"}" class="form-grid"><label class="wide">Message<textarea name="message" required minlength="2" maxlength="1000" placeholder="${request ? "Is this still available? Would weekday evenings work?" : "Introduce yourself or ask a practical question."}"></textarea></label><button class="primary wide">Send message request</button></form>`);
}
function saveSearchModal() {
  openModal(
    `<span class="eyebrow">Discovery alert</span><h2>Keep this local search.</h2><form data-form="save-network-search" class="form-grid"><label class="wide">Name<input name="name" required maxlength="80" placeholder="Nearby carpenters open to barter"></label><label class="wide"><input type="checkbox" name="alerts" checked> Notify me when a strong new match appears</label><button class="primary wide">Save alert</button></form>`,
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
    `<span class="eyebrow">New trusted community</span><h2>Start with people connected by place.</h2><p>A block, shop, maker space, trade school, nonprofit, or small-business network all work well.</p><form data-form="create-circle" class="form-grid"><label class="wide">Community name<input name="name" required minlength="2" maxlength="100" placeholder="East End Fixers"></label><label class="wide">Shared place and purpose<textarea name="description" required maxlength="1000" placeholder="Who this is for, the area you share, and the practical work you want to make easier"></textarea></label><label>Visibility<select name="visibility"><option value="private">Invite-only (recommended)</option><option value="public">Publicly discoverable</option></select></label><label class="wide">Community rules<textarea name="rules" required placeholder="Who belongs, what may be posted, safety expectations, fair exchange, and moderation norms"></textarea></label><button class="primary wide">Create community</button></form>`,
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

async function moderationConsoleModal() {
  try {
    const queue = await getModerationQueue();
    openModal(
      `<span class="eyebrow">Private staff workspace · ${esc(queue.role)}</span><h2>Safety review queue</h2><p>Internal notes and reporter identities are confidential. Immediate danger belongs with local emergency services.</p><section class="moderation-queue"><h3>Open reports</h3>${queue.reports
        .map(
          (report) =>
            `<article><span class="category">${esc(report.category)} · ${esc(report.severity)}</span><h3>${esc(report.target_name || report.target_type)}</h3><p>${esc(report.detail)}</p><small>Reported by ${esc(report.reporter_name)} · ${esc(report.reporter_status)}</small><button class="secondary" data-review-report="${report.id}">Review case</button></article>`,
        )
        .join("") || "<p>No open reports.</p>"}<h3>Open appeals</h3>${queue.appeals
        .map(
          (appeal) =>
            `<article><p>${esc(appeal.statement)}</p><button class="secondary" data-review-appeal="${appeal.id}">Review appeal</button></article>`,
        )
        .join("") || "<p>No open appeals.</p>"}</section>`,
    );
  } catch (error) {
    notify(error.message);
  }
}

async function pilotDashboardModal() {
  try {
    const dashboard = await getPilotDashboard();
    const m = dashboard.metrics;
    openModal(
      `<span class="eyebrow">Private pilot operations</span><h2>Pilot dashboard</h2><div class="pilot-metrics">${[
        ["Members", m.members], ["Open work", m.open_work], ["Stalled", m.stalled],
        ["Open reports", m.open_reports], ["Open feedback", m.open_feedback], ["Email failed", m.email_failed],
      ].map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join("")}</div>
      <h3>Activation funnel</h3><div class="pilot-funnel">${Object.entries(dashboard.funnel).map(([step,value]) => `<div><b>${value}</b><span>${esc(step.replaceAll("_"," "))}</span></div>`).join("")}</div>
      <section class="moderation-queue"><h3>Pilot feedback</h3>${dashboard.feedback.map((item) => `<article><span class="category">${esc(item.category)} · ${esc(item.severity)}</span><h3>${esc(item.reporter_name)}</h3><p>${esc(item.body)}</p><small>${esc(item.view_name)}${item.workflow_stage ? ` · ${esc(item.workflow_stage)}` : ""} · ${esc(item.status)}</small><button class="secondary" data-triage-feedback="${item.id}">Triage and reply</button></article>`).join("") || "<p>No pilot feedback yet.</p>"}</section>
      <section class="moderation-queue"><h3>Recent members</h3>${dashboard.recent_members.map((member) => `<article><b>${esc(member.display_name)}</b><p>${esc(member.status)} · joined ${new Date(member.joined_at).toLocaleDateString()}</p></article>`).join("") || "<p>No members yet.</p>"}</section>`,
    );
  } catch (error) { notify(error.message); }
}

function pilotFeedbackModal() {
  if (!state.session) return notify("Sign in to send pilot feedback");
  const selected = state.requests.find((item) => item.id === state.selectedId);
  openModal(`<span class="eyebrow">Pilot feedback</span><h2>Help shape WorkTrade.</h2><p>We automatically include the current screen and workflow stage, but never private message contents.</p><form data-form="pilot-feedback" data-view="${esc(state.view)}" data-stage="${esc(selected?.stage || "")}" class="form-grid"><label>What kind?<select name="category"><option value="confusing">Confusing</option><option value="broken">Broken</option><option value="missing">Something is missing</option><option value="unsafe">Safety concern</option><option value="suggestion">Suggestion</option></select></label><label class="wide">What happened or would help?<textarea name="body" required minlength="10" maxlength="4000"></textarea></label><button class="primary wide">Send private feedback</button></form>`);
}

async function myPilotFeedbackModal() {
  try {
    const items = await getMyPilotFeedback();
    openModal(`<span class="eyebrow">Your pilot feedback</span><h2>Updates from the team</h2><section class="moderation-queue">${items.map((item) => `<article><span class="category">${esc(item.category)} · ${esc(item.status)}</span><p>${esc(item.body)}</p>${item.replies.map((reply) => `<blockquote><b>${esc(reply.author_name)}</b><p>${esc(reply.body)}</p></blockquote>`).join("")}<form data-form="pilot-feedback-reply" data-id="${item.id}" class="inline-form"><input name="body" required minlength="2" placeholder="Reply"><button class="secondary">Send</button></form></article>`).join("") || "<p>You have not sent feedback yet.</p>"}</section>`);
  } catch (error) { notify(error.message); }
}

async function pilotFeedbackTriageModal(id) {
  try {
    const dashboard = await getPilotDashboard();
    const item = dashboard.feedback.find((entry) => entry.id === id);
    if (!item) throw new Error("Feedback unavailable");
    openModal(`<span class="eyebrow">Pilot feedback triage</span><h2>${esc(item.reporter_name)}</h2><p>${esc(item.body)}</p><form data-form="pilot-feedback-triage" data-id="${id}" class="form-grid"><label>Status<select name="status">${["new","reviewing","planned","resolved","closed"].map(x=>`<option ${x===item.status?"selected":""}>${x}</option>`).join("")}</select></label><label>Severity<select name="severity">${["low","normal","high","blocking"].map(x=>`<option ${x===item.severity?"selected":""}>${x}</option>`).join("")}</select></label><label>Assign to<select name="assignee"><option value="">Unassigned</option>${dashboard.staff.map(s=>`<option value="${s.id}" ${s.id===item.assigned_to?"selected":""}>${esc(s.name)} · ${esc(s.role)}</option>`).join("")}</select></label><label class="wide">Internal note<textarea name="note">${esc(item.internal_note || "")}</textarea></label><label class="wide">Reply visible to member<textarea name="reply"></textarea></label><button class="primary wide">Save triage</button></form>`);
  } catch (error) { notify(error.message); }
}

function pilotInviteModal() {
  openModal(
    `<span class="eyebrow">Private pilot</span><h2>Enter your WorkTrade invite.</h2><p>This early community is intentionally small while we learn what makes work exchanges safe and useful.</p><form data-form="pilot-invite-redeem" class="form-grid"><label class="wide">Invite code<input name="invite_code" required autocomplete="one-time-code" spellcheck="false"></label><button class="primary wide">Join the pilot</button></form>`,
  );
}

function moderationDecisionModal(reportId) {
  openModal(
    `<span class="eyebrow">Staff case action</span><h2>Record a proportionate decision.</h2><form data-form="moderation-decision" data-report="${reportId}" class="form-grid"><label>Action<select name="action"><option value="note">Continue review</option><option value="dismissed">Dismiss</option><option value="warned">Warn</option><option value="restricted">Restrict interactions</option><option value="suspended">Suspend</option><option value="banned">Ban (admin only)</option><option value="resolved">Resolve without restriction</option></select></label><label>Restriction ends<input name="expires_at" type="datetime-local"></label><label class="wide">Internal rationale<textarea name="internal_note" required minlength="5" maxlength="4000"></textarea></label><label class="wide">Update visible to reporter<textarea name="reporter_update" maxlength="1000"></textarea></label><button class="primary wide">Record immutable action</button></form>`,
  );
}

function appealDecisionModal(appealId) {
  openModal(
    `<span class="eyebrow">Appeal review</span><h2>Uphold or restore access.</h2><form data-form="appeal-decision" data-appeal="${appealId}" class="form-grid"><label>Decision<select name="decision"><option value="granted">Grant and restore access</option><option value="upheld">Uphold restriction</option></select></label><label class="wide">Internal rationale<textarea name="internal_note" required minlength="5" maxlength="4000"></textarea></label><label class="wide">Explanation visible to member<textarea name="member_update" required minlength="5" maxlength="1000"></textarea></label><button class="primary wide">Record appeal decision</button></form>`,
  );
}

function moderationAppealModal(restrictionId) {
  openModal(
    `<span class="eyebrow">Appeal a restriction</span><h2>Explain what should be reconsidered.</h2><p>A different moderator should review appeals when staffing permits.</p><form data-form="moderation-appeal" data-restriction="${restrictionId}" class="form-grid"><label class="wide">Appeal statement<textarea name="statement" required minlength="20" maxlength="4000"></textarea></label><button class="primary wide">Submit appeal</button></form>`,
  );
}

function renderProfile() {
  const p = state.profile;
  const quality = profileQuality(p);
  return shell(
    `<section class="profile-head">${avatarMarkup(p.avatarUrl, p.name, "giant")}<div><span class="eyebrow">Your WorkTrade profile</span><h1>${esc(p.name)}</h1><p>${esc(p.bio)}</p><small>${esc(p.location)}</small></div><div class="profile-actions"><button class="primary" data-action="onboarding">${p.onboardingComplete ? "Improve my matches" : "Finish match setup"}</button><button class="secondary profile-edit" data-action="edit-profile">Edit profile</button></div></section>
    <section class="profile-quality"><div><span class="eyebrow">Profile readiness</span><h2>${quality.score}% ready for useful matches</h2><p>${quality.missing.length ? `Next improvement: ${esc(quality.missing[0])}.` : "Your profile gives collaborators enough context to start a grounded conversation."}</p></div><div class="quality-meter"><span style="width:${quality.score}%"></span></div>${quality.missing.length ? `<ul>${quality.missing.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}</section>
    <div class="two-col"><section class="list-panel"><span class="eyebrow">I can offer</span><h2>Skills, goods, and access</h2><div class="editable-list">${p.offers.map((x, i) => `<span>${esc(x)}<button data-remove="offers:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="offers" class="inline-form"><input name="item" required placeholder="Add something you can offer"><button class="secondary">Add</button></form></section>
    <section class="list-panel warm"><span class="eyebrow">I need</span><h2>Things that could move you forward</h2><div class="editable-list">${p.needs.map((x, i) => `<span>${esc(x)}<button data-remove="needs:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="needs" class="inline-form"><input name="item" required placeholder="Add something you need"><button class="secondary">Add</button></form></section></div>
    <section class="proof"><span class="eyebrow">Proof of work</span><h2>A reputation grounded in real outcomes.</h2><div class="proof-grid">${(p.portfolio || []).map((entry) => `<div>${entry.asset_url ? `<img class="portfolio-photo" src="${esc(entry.asset_url)}" alt="Work example: ${esc(entry.title)}">` : ""}<b>${esc(entry.title)}</b><p>${esc(entry.summary)}</p>${state.remote ? `<form data-form="portfolio-photo" data-entry="${entry.id}" data-path="${esc(entry.asset_path || "")}"><label class="photo-picker">${entry.asset_path ? "Replace photo" : "Add photo"}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="secondary compact">Upload</button>${entry.asset_path ? `<button type="button" class="text-btn" data-remove-portfolio-photo="${entry.id}" data-path="${esc(entry.asset_path)}">Remove</button>` : ""}</form>` : ""}</div>`).join("") || `<div><b>No completed-work portfolio yet</b><p>After a project is completed, publish it to your portfolio and add a photo here.</p></div>`}</div>${backendConfigured ? `<div class="account-panel" id="account-panel"><p>Checking account…</p></div>` : `<div class="account-panel"><b>Device-local demonstration</b><p>Real accounts become available when this installation is connected to its own Supabase project.</p></div>`}<button class="danger-text" data-action="reset">Reset demo data</button></section>`,
    "Profile and capabilities",
  );
}

function profileQuality(profile) {
  const checks = [
    [profile.bio && profile.bio.length >= 30, "Add a short introduction about how you work"],
    [profile.location, "Add a general location or mark yourself remote"],
    [profile.availability, "Describe when you are usually available"],
    [(profile.offers || []).length >= 2, "List at least two specific things you can offer"],
    [(profile.needs || []).length >= 1, "Add something you genuinely need"],
    [(profile.preferredExchangeModes || []).length > 0, "Choose acceptable exchange types"],
  ];
  return { score: Math.round(checks.filter(([done]) => done).length / checks.length * 100), missing: checks.filter(([done]) => !done).map(([, text]) => text) };
}

function matchTerms(values = []) {
  return values.flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/)).filter((value) => value.length > 2);
}

function overlaps(left, right) {
  const rightTerms = matchTerms(right);
  return [...new Set(left.filter((value) => rightTerms.some((other) => value.includes(other) || other.includes(value))))];
}

function scoreRequestForProfile(request) {
  const offerTerms = matchTerms(state.profile.offers);
  const requestText = `${request.title} ${request.description} ${request.skills.join(" ")}`.toLowerCase();
  const overlap = offerTerms.filter((term) => requestText.includes(term));
  const nearby = !state.profile.location || request.location.toLowerCase().includes(state.profile.location.split(",")[0].toLowerCase());
  return { request, overlap: [...new Set(overlap)], score: overlap.length * 3 + (nearby ? 1 : 0) };
}

function scorePersonForProfile(person) {
  const offered = (person.capabilities || []).filter((x) => x.direction === "offer").map((x) => x.label);
  const needed = (person.capabilities || []).filter((x) => x.direction === "need").map((x) => x.label);
  const helpsMe = overlaps(matchTerms(state.profile.needs), offered);
  const helpThem = overlaps(matchTerms(state.profile.offers), needed);
  const locationFit = !!state.profile.location && !!person.location_text && person.location_text.toLowerCase().includes(state.profile.location.split(",")[0].toLowerCase());
  const exchangeFit = (state.profile.preferredExchangeModes || ["barter", "cash", "hybrid"]).some((mode) => (person.preferred_exchange_modes || []).includes(mode));
  const proof = Math.min(2, Number(person.completed_count || 0));
  const score = Math.min(100, helpsMe.length * 18 + helpThem.length * 18 + (locationFit ? 12 : 0) + (person.remote_available && state.profile.remoteAvailable ? 8 : 0) + (exchangeFit ? 8 : 0) + proof * 4);
  return { person, helpsMe, helpThem, locationFit, exchangeFit, score };
}

function announceStrongMatches(profiles) {
  if (!state.session) return;
  const key = "worktrade:seen-strong-matches:v1";
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(key)) || []; } catch { seen = []; }
  const fresh = profiles.map(scorePersonForProfile).filter((match) => match.score >= 50 && !seen.includes(match.person.id));
  if (!fresh.length) return;
  localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...fresh.map((match) => match.person.id)])]));
  const title = fresh.length === 1 ? `Strong match with ${fresh[0].person.display_name}` : `${fresh.length} new strong matches`;
  state.notifications = [{ id: `match:${Date.now()}`, kind: "network", title, body: "Open Matches to see the two-way fit and propose an exchange.", created_at: new Date().toISOString(), read_at: null }, ...state.notifications];
  const badge = document.querySelector("#unread-count");
  if (badge) badge.textContent = String(state.notifications.filter((item) => !item.read_at).length);
  notify(title, "success");
}

function feedbackControls(key) {
  const current = state.matchFeedback[key];
  return `<div class="match-feedback" aria-label="Rate this match"><button class="text-btn ${current === "useful" ? "selected" : ""}" data-match-feedback="${key}:useful">Useful</button><button class="text-btn ${current?.startsWith("not-relevant") ? "selected" : ""}" data-match-feedback="${key}:not-relevant">Not relevant</button><button class="text-btn" data-match-dismiss="${key}">Hide</button></div>`;
}

function renderFirstMatches() {
  const hidden = (key) => state.matchFeedback[key] === "dismissed";
  const work = state.requests.filter((request) => request.status === "open" && !hidden(`request:${request.id}`)).map(scoreRequestForProfile).sort((a, b) => b.score - a.score).slice(0, 4);
  const people = state.networkProfiles.filter((person) => person.id !== state.profile.id && !hidden(`profile:${person.id}`)).map(scorePersonForProfile).sort((a, b) => b.score - a.score).slice(0, 6);
  const strong = people.filter((match) => match.score >= 50).length;
  return shell(`<section class="match-welcome"><span class="eyebrow">Personalized matches</span><h1>Useful overlap, explained.</h1><p>WorkTrade scores both directions of an exchange, then adds general location, remote availability, exchange preferences, and proven work. A high score is a starting point—not a judgment.</p><div class="match-summary"><b>${strong}</b><span>strong reciprocal match${strong === 1 ? "" : "es"}</span><button class="secondary" data-action="onboarding">Adjust matching profile</button></div></section>
    <div class="first-match-grid"><section><div class="section-title"><div><span class="eyebrow">Work you may be able to help with</span><h2>${work.length} starting points</h2></div></div><div class="request-grid first-match-list">${work.map(({ request, overlap, score }) => `<div class="match-shell"><div class="match-explanation"><b>${Math.min(100, score * 12)}% work fit</b><span>${overlap.length ? `Your ${esc(overlap.join(", "))} may help` : score ? "Near your general location" : "A chance to explore something different"}</span></div>${requestCard(request)}${feedbackControls(`request:${request.id}`)}</div>`).join("") || `<div class="empty"><p>No visible work matches. Adjust your profile or restore hidden matches below.</p></div>`}</div></section>
    <section><div class="section-title"><div><span class="eyebrow">Reciprocal people matches</span><h2>${people.length} potential collaborators</h2></div></div><div class="people-list match-people">${people.map(({ person, helpsMe, helpThem, locationFit, exchangeFit, score }) => `<article class="person-card match-person"><span class="avatar big">${esc((person.display_name || "WT").split(/\s+/).map((x) => x[0]).join("").slice(0, 2))}</span><div><div class="match-score-row"><h3>${esc(person.display_name)}</h3><b>${score}%</b></div><p class="match-direction"><strong>They may help you:</strong> ${esc(helpsMe.join(", ") || "No direct need overlap yet")}</p><p class="match-direction"><strong>You may help them:</strong> ${esc(helpThem.join(", ") || "No direct offer overlap yet")}</p><small>${[locationFit ? "nearby" : "location flexible", exchangeFit ? "exchange fit" : "different exchange preferences", `${person.completed_count || 0} completed`].join(" · ")}</small><div class="social-actions"><button class="text-btn" data-view-profile="${person.id}">View evidence</button>${state.session ? `<button class="primary compact" data-contact-person="${person.id}">Message</button><button class="secondary compact" data-save-person="${person.id}">${(state.networkInbox?.saved_profiles || []).includes(person.id) ? "Saved" : "Save"}</button>` : `<button class="primary compact" data-action="sign-in">Sign in to connect</button>`}</div>${feedbackControls(`profile:${person.id}`)}</div></article>`).join("") || `<div class="empty"><p>Connected collaborator suggestions will appear here. Your work matches are ready now.</p><button class="secondary" data-nav="network">Explore the network</button></div>`}</div></section></div>${Object.values(state.matchFeedback).includes("dismissed") ? `<button class="text-btn restore-matches" data-action="restore-matches">Restore hidden matches</button>` : ""}`, "Personalized starting points");
}

let renderedLocation = null;
let pendingRenderFocus = null;

function render() {
  const nextLocation = `${state.view}:${state.view === "detail" ? state.selectedId || "" : ""}`;
  const navigated = renderedLocation !== null && renderedLocation !== nextLocation;
  renderedLocation = nextLocation;
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === state.view));
  if (state.view === "detail")
    main.innerHTML = renderDetail(
      state.requests.find((r) => r.id === state.selectedId),
    );
  else if (state.view === "workspace") main.innerHTML = renderWorkspace();
  else if (state.view === "messages") main.innerHTML = renderMessages();
  else if (state.view === "network") main.innerHTML = renderNetwork();
  else if (state.view === "profile") main.innerHTML = renderProfile();
  else if (state.view === "matches") main.innerHTML = renderFirstMatches();
  else main.innerHTML = renderDiscover();
  hydrateNetworkSocial();
  hydrateLocalDiscovery();
  document.querySelector(".notification-button").toggleAttribute("data-connected-action", state.remote);
  main.querySelectorAll('form:not([data-form="network-search"]) button, [data-action="notifications"]').forEach((control) =>
    control.toggleAttribute("data-connected-action", state.remote),
  );
  applyConnectivityState();
  if (navigated) window.scrollTo({ top: 0, behavior: "instant" });
  if (pendingRenderFocus && pendingRenderFocus.until > Date.now()) {
    const target = main.querySelector(pendingRenderFocus.selector);
    if (target) {
      target.setAttribute("tabindex", "-1");
      setTimeout(() => target.focus({ preventScroll: true }), 150);
    }
  } else {
    pendingRenderFocus = null;
  }
}

function openModal(content) {
  modalController.open(content);
}
function closeModal() {
  modalController.close();
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
  const request = state.requests.find((item) => item.id === id);
  if (!request) return notify("That work request is no longer available.", "warning");
  const availableValue = request.offersInReturn?.length
    ? request.offersInReturn.join(" · ")
    : "Open to a fair proposal";
  openModal(`<span class="eyebrow">Formal offer · four clear parts</span><h2>Offer to help.</h2><p>This creates proposed terms the requester can accept as an agreement. If you only need clarification, use Ask a question instead.</p><aside class="proposal-context" aria-label="Work and exchange you are proposing for"><span class="eyebrow">You are offering help with</span><h3>${esc(request.title)}</h3><p>${esc(request.description)}</p><dl><div><dt>They are offering</dt><dd>${esc(availableValue)}</dd></div><div><dt>Exchange options</dt><dd>${request.exchange.map(modeLabel).join(" · ")}${request.cashBudget ? ` · up to ${money(request.cashBudget)}` : ""}</dd></div><div><dt>Posted by</dt><dd>${esc(request.owner)} · ${esc(request.location)}</dd></div></dl></aside><form data-form="offer" data-id="${id}" class="form-grid">
    <div class="wide proposal-step"><b>1 · Value</b><span>Choose how value moves between both people.</span></div>
    <label>Exchange<select name="mode"><option value="hybrid">Cash + barter</option><option value="barter">Barter</option><option value="cash">Cash</option></select></label><label>Cash component<input name="cash" type="number" min="0" placeholder="0"></label>
    <div class="wide proposal-step"><b>2 · Scope</b><span>State the result you will deliver and what is outside this proposal.</span></div>
    <label class="wide">What will you provide?<textarea name="gives" required placeholder="Scope and deliverables"></textarea></label><label class="wide">What is excluded?<textarea name="exclusions" placeholder="Permits, electrical work, finish materials…"></textarea></label><label class="wide">What would you receive?<input name="wants" required placeholder="$400 plus bookkeeping help"></label><label>Expected duration<input name="duration" required placeholder="Two weekends"></label><label>Offer expires<input name="expires_at" type="date"></label><label>Provider supplies<input name="provider_supplies" placeholder="Tools, labor, fasteners"></label><label>Requester supplies<input name="requester_supplies" placeholder="Site access, lumber, power"></label><label class="wide">Proposed milestones, one per line<textarea name="milestones" placeholder="Confirm measurements\nBuild components\nInstall and review"></textarea></label><label class="wide">Questions before committing<textarea name="questions" placeholder="Is weekend access available?"></textarea></label><button class="primary wide">Send offer</button></form>`);
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
function counterOfferModal(offer) {
  const scope = offer.scope ?? offer.gives ?? "";
  const exchange = offer.exchange_summary ?? offer.wants ?? "";
  const duration = offer.duration_text ?? offer.duration ?? "";
  openModal(
    `<span class="eyebrow">Counterproposal · version ${(offer.version || 1) + 1}</span><h2>Change only what needs negotiating.</h2><p>The other participant will see exactly which terms changed. Your counter replaces the current actionable version.</p><form data-form="counter-offer" data-id="${offer.id}" class="form-grid"><label>Exchange<select name="mode"><option value="cash">Cash</option><option value="barter">Barter</option><option value="hybrid">Cash + barter</option></select></label><label>Duration<input name="duration" value="${esc(duration)}"></label><label class="wide">Scope<textarea name="scope" required>${esc(scope)}</textarea></label><label class="wide">Exclusions<textarea name="exclusions">${esc(offer.exclusions || "")}</textarea></label><label class="wide">Exchange terms<input name="exchange_summary" required value="${esc(exchange)}"></label><label class="wide">Questions or reason for the counter<textarea name="questions">${esc(offer.questions || offer.note || "")}</textarea></label><label>Offer expires<input name="expires_at" type="date" value="${offer.expires_at ? offer.expires_at.slice(0, 10) : ""}"></label><button class="primary wide">Send counterproposal</button></form>`,
  );
  modalRoot.querySelector("[name=mode]").value = offer.mode;
}
function scheduleModal(request) {
  const a = request.agreement;
  openModal(
    `<span class="eyebrow">Work schedule</span><h2>Set practical timing.</h2><form data-form="schedule" data-agreement="${a.id}" data-version="${a.version}" class="form-grid"><label>Proposed start<input name="start_at" type="datetime-local" value="${a.proposed_start_at ? a.proposed_start_at.slice(0, 16) : ""}"></label><label>Time zone<select name="timezone"><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option></select></label><label class="wide">Working windows<textarea name="working_windows" placeholder="Saturdays 8–4; no work during store hours">${esc(a.working_windows || "")}</textarea></label><button class="primary wide">Save schedule</button></form>`,
  );
}
async function scheduleCoordinationModal(request, counterTo = "") {
  const a=request.agreement;
  try {
    const hub=await getAgreementSchedule(a.id),pending=hub.proposals.find(x=>x.status==="pending"),accepted=hub.proposals.find(x=>x.status==="accepted");
    openModal(`<span class="eyebrow">Private work scheduling</span><h2>Coordinate a practical window.</h2><p>Exact locations and arrival instructions are visible only to confirmed agreement participants.</p>${pending?`<article class="schedule-card"><span class="category">Pending proposal</span><h3>${new Date(pending.start_at).toLocaleString()}–${new Date(pending.end_at).toLocaleTimeString()}</h3><p>${esc(pending.location_detail||"Location to be coordinated")}${pending.weather_sensitive?" · Weather-sensitive":""}</p>${pending.proposed_by!==state.profile.id?`<button class="primary" data-schedule-response="accepted:${pending.id}">Accept</button><button class="secondary" data-schedule-counter="${pending.id}">Counter</button><button class="text-btn" data-schedule-response="declined:${pending.id}">Decline</button>`:"<small>Waiting for the other participant.</small>"}</article>`:""}${accepted?`<article class="schedule-card confirmed"><span class="category">Confirmed</span><h3>${new Date(accepted.start_at).toLocaleString()}</h3><p>${esc(accepted.location_detail||"")}</p><p>${esc(accepted.arrival_notes||"")}</p><button class="secondary" data-calendar-export="${accepted.id}" data-title="${esc(request.title)}" data-start="${accepted.start_at}" data-end="${accepted.end_at}" data-location="${esc(accepted.location_detail)}">Add to calendar (.ics)</button></article>`:""}<form data-form="schedule-proposal" data-agreement="${a.id}" data-counter="${counterTo}" class="form-grid"><label>Start<input name="start_at" type="datetime-local" required></label><label>End<input name="end_at" type="datetime-local" required></label><label>Time zone<select name="timezone"><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option></select></label><label>Exact meeting/work location<input name="location_detail" maxlength="500"></label><label class="wide">Arrival, access, parking, or entry details<textarea name="arrival_notes" maxlength="1500"></textarea></label><label><input type="checkbox" name="weather_sensitive"> Weather-sensitive work</label><button class="primary wide">${counterTo?"Send counterproposal":"Propose window"}</button></form><details><summary>My recurring availability</summary><form data-form="availability" class="form-grid"><label>Time zone<select name="timezone"><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option></select></label><label>Minimum notice (hours)<input name="lead_time_hours" type="number" min="0" max="8760" value="${hub.my_availability?.lead_time_hours??24}"></label><label class="wide">Usual windows<textarea name="windows" placeholder="Saturday 8am–2pm; weekday evenings">${esc((hub.my_availability?.weekly_windows||[]).join("\n"))}</textarea></label><button class="secondary wide">Save availability</button></form></details>`);
  }catch(error){notify(error.message);}
}

async function agreementLedgerModal(request){
  try{const ledger=await getAgreementLedger(request.agreement.id);openModal(`<span class="eyebrow">Agreement preparation</span><h2>Materials, tools & value ledger</h2><div class="ledger-summary"><div><b>${ledger.summary.ready}</b><span>ready</span></div><div><b>${ledger.summary.needed}</b><span>still needed</span></div><div><b>${money(ledger.summary.estimated_cash_cents/100)}</b><span>estimated cash</span></div><div><b>${money(ledger.summary.actual_cash_cents/100)}</b><span>actual cash</span></div></div><section class="ledger-list">${ledger.items.map(i=>{const approved=i.approvals?.some(a=>a.profile_id===state.profile.id&&a.version===i.version);return `<article><span class="category">${esc(i.item_type)} · ${esc(i.status)}</span><h3>${esc(i.description)}</h3><p>${esc(i.responsibility)} · ${esc(i.contribution_mode)}${i.quantity_estimate?` · ${i.quantity_estimate} ${esc(i.unit)}`:""}${i.estimated_cost_cents!=null?` · est. ${money(i.estimated_cost_cents/100)}`:""}${i.barter_description?` · ${esc(i.barter_description)}`:""}</p>${i.responsibility==="shared"?`<button class="secondary" data-ledger-action="approve:${i.id}" ${approved?"disabled":""}>${approved?"You approved":"Approve shared cost"}</button>`:""}<button class="text-btn" data-ledger-status="${i.id}">Update readiness/cost</button><form data-form="ledger-receipt" data-agreement="${request.agreement.id}" data-item="${i.id}" class="inline-form"><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required aria-label="Receipt or item photo"><button class="secondary">Add receipt/photo</button></form></article>`}).join("")||"<p>No preparation items yet.</p>"}</section><form data-form="ledger-item" data-agreement="${request.agreement.id}" class="form-grid"><label>Type<select name="item_type"><option value="material">Material</option><option value="tool">Tool</option><option value="rental">Rental</option><option value="permit">Permit</option><option value="delivery">Delivery</option><option value="expense">Other expense</option><option value="service">Service</option><option value="other">Other</option></select></label><label>Responsibility<select name="responsibility"><option value="requester">Requester</option><option value="provider">Provider</option><option value="shared">Shared (both approve)</option><option value="third_party">Third party</option></select></label><label class="wide">Item or contribution<input name="description" required maxlength="500"></label><label>Value type<select name="contribution_mode"><option value="cash">Cash expense</option><option value="barter">Barter contribution</option><option value="included">Already included</option></select></label><label>Initial state<select name="status"><option value="needed">Needed</option><option value="available">Already available</option><option value="ordered">Ordered</option><option value="ready">Ready</option></select></label><label>Estimated quantity<input name="quantity" type="number" min="0" step="0.001"></label><label>Unit<input name="unit" placeholder="boards, hours, days"></label><label>Estimated cash cost<input name="estimated_cost" type="number" min="0" step="0.01"></label><label class="wide">Barter/non-cash detail<input name="barter_description" placeholder="Use of trailer in exchange for cleanup"></label><button class="primary wide">Add preparation item</button></form>`);}catch(error){notify(error.message);}
}
function ledgerStatusModal(id){openModal(`<span class="eyebrow">Preparation update</span><h2>Record what changed.</h2><form data-form="ledger-status" data-item="${id}" class="form-grid"><label>Status<select name="status"><option value="available">Available</option><option value="needed">Needed</option><option value="ordered">Ordered</option><option value="ready">Ready</option><option value="used">Used</option><option value="cancelled">Cancelled</option></select></label><label>Actual quantity<input name="quantity_actual" type="number" min="0" step="0.001"></label><label>Actual cash cost<input name="actual_cost" type="number" min="0" step="0.01"></label><button class="primary wide">Save update</button></form>`);}

async function changeOrderHubModal(request){try{const hub=await getChangeOrderHub(request.agreement.id);openModal(`<span class="eyebrow">Active-work changes</span><h2>Issues & change orders</h2><div class="baseline-card"><b>Accepted baseline · v${hub.baseline.version}</b><p>${esc(hub.baseline.scope)}</p><small>${esc(hub.baseline.exchange?.summary||"")}</small></div><section class="issue-list">${hub.issues.map(i=>{const order=i.orders.find(o=>o.status==="proposed");return `<article><span class="category">${esc(i.category.replaceAll("_"," "))} · ${esc(i.status)}</span><h3>${esc(i.title)}</h3><p>${esc(i.detail)}</p><small>${i.unaffected_work_can_continue?"Unaffected work may continue":"Pause affected work"}</small>${order?`<div class="change-diff"><b>Proposed difference from baseline</b><p>${esc(order.scope_delta)}</p><dl><dt>Time</dt><dd>${order.time_delta_minutes} minutes</dd><dt>Cash</dt><dd>${money(order.cash_delta_cents/100)}</dd><dt>Barter</dt><dd>${esc(order.barter_delta||"No change")}</dd><dt>Schedule</dt><dd>${esc(order.schedule_delta||"No change")}</dd></dl>${order.proposed_by!==state.profile.id?`<button class="primary" data-change-response="accept:${order.id}">Accept change</button><button class="text-btn" data-change-response="decline:${order.id}">Decline</button>`:"<small>Waiting for counterparty.</small>"}</div>`:`${!["resolved","closed","escalated"].includes(i.status)?`<button class="secondary" data-propose-change="${i.id}">Propose resolution</button><button class="text-btn" data-issue-action="close:${i.id}">Resolve without change</button><button class="danger-text" data-issue-action="escalate:${i.id}">Escalate to dispute</button>`:""}`}<form data-form="issue-evidence" data-agreement="${request.agreement.id}" data-issue="${i.id}" class="inline-form"><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required aria-label="Issue photo"><input name="caption" required maxlength="500" placeholder="What does this show?"><button class="secondary">Add evidence</button></form></article>`}).join("")||"<p>No active-work issues have been reported.</p>"}</section><form data-form="work-issue" data-agreement="${request.agreement.id}" class="form-grid"><label>Category<select name="category"><option value="hidden_condition">Hidden condition</option><option value="damaged_material">Damaged material</option><option value="access">Access problem</option><option value="weather">Weather</option><option value="safety">Safety</option><option value="scope_discovery">Scope discovery</option><option value="mistake">Mistake</option><option value="other">Other</option></select></label><label class="wide">Short title<input name="title" required minlength="3" maxlength="180"></label><label class="wide">What was discovered and what is affected?<textarea name="detail" required minlength="10" maxlength="4000"></textarea></label><label><input type="checkbox" name="continue" checked> Unaffected work can continue</label><button class="primary wide">Report issue</button></form>`);}catch(error){notify(error.message);}}
function changeOrderModal(issueId){openModal(`<span class="eyebrow">Proposed difference</span><h2>Change only what the issue requires.</h2><form data-form="change-order" data-issue="${issueId}" class="form-grid"><label class="wide">Added or removed scope<textarea name="scope_delta" required></textarea></label><label>Time change (minutes)<input name="time_delta_minutes" type="number" value="0"></label><label>Cash change<input name="cash_delta" type="number" step="0.01" value="0"></label><label class="wide">Barter change<input name="barter_delta" placeholder="Additional cleanup in exchange for materials"></label><label class="wide">Schedule impact<input name="schedule_delta" placeholder="Adds one workday after materials arrive"></label><button class="primary wide">Send for counterparty approval</button></form>`);}

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
    `<span class="eyebrow">Safety report</span><h2>Tell moderators what happened.</h2><p>Reports are private. WorkTrade is not an emergency service. If anyone is in immediate danger, contact local emergency services now.</p><form data-form="report" data-id="${id}" class="form-grid"><label>Concern<select name="reason"><option value="unsafe_work">Unsafe work or conditions</option><option value="fraud">Fraud or misrepresentation</option><option value="harassment">Harassment</option><option value="prohibited_service">Regulated or prohibited work</option><option value="spam">Spam</option><option value="privacy">Privacy concern</option><option value="other">Other</option></select></label><label class="wide">Details<textarea name="detail" required minlength="10" maxlength="2000"></textarea></label><button class="primary wide">Submit private report</button></form>`,
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
    `<span class="eyebrow">Sign in or join</span><h2>Use a secure email link.</h2><p>No password or invite code is required. Enter your email and WorkTrade will send a private sign-in link.</p><form data-form="sign-in" class="form-grid"><label class="wide">Email<input name="email" type="email" autocomplete="email" required></label><button class="primary wide">Send sign-in link</button></form>`,
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
  const groups = { action: [], message: [], update: [] };
  state.notifications.forEach((item) => {
    const group = notificationGroup(item);
    if (group === "update" && item.request_id && state.projectNotificationSettings[item.request_id] === "muted") return;
    groups[group].push(item);
  });
  openModal(
    `<span class="eyebrow">Inbox</span><div class="section-title inbox-title"><div><h2>Work that changed</h2><p>${unread.length ? `${unread.length} unread` : "You’re caught up"}</p></div>${unread.length ? `<button class="text-btn" data-action="read-all">Mark all read</button>` : ""}</div><div class="inbox-groups">${notificationGroupSection("Needs your action", groups.action, "Confirmations, proposals, and reviews that cannot move without you.")}${notificationGroupSection("Messages", groups.message, "Project conversations from other participants.")}${notificationGroupSection("Updates", groups.update, "Status changes and useful context; no response is required.")}</div><button class="text-btn" data-action="notification-preferences">Notification preferences</button>`,
  );
}

function notificationGroup(item) {
  if (item.kind === "message" || /message/i.test(item.title)) return "message";
  if (/new trade proposal|counterproposal|approval requested|needs? (your )?review|proposed|invitation|membership request|renewed consent|work issue reported/i.test(item.title)) return "action";
  return "update";
}

function notificationRoute(item) {
  if (/new introduction message|new message request|new question about your work/i.test(item.title)) return { view: "messages" };
  if (item.request_id) return { view: "detail", section: item.kind === "message" ? "activity" : /change|issue/i.test(item.title) ? "overview" : /cost|contribution|exchange/i.test(item.title) ? "exchange" : "overview" };
  if (item.kind === "network") return { view: "network" };
  if (item.kind === "safety") return { view: "profile" };
  return { view: "workspace" };
}

function notificationGroupSection(title, items, emptyText) {
  return `<section class="inbox-group"><div class="inbox-group-head"><h3>${title}</h3><span>${items.length}</span></div>${items.length ? `<div class="notification-list">${items.map(notificationItem).join("")}</div>` : `<div class="empty compact"><b>Nothing here</b><p>${emptyText}</p></div>`}</section>`;
}

function notificationItem(item) {
  const route = notificationRoute(item);
  const waiting = notificationGroup(item) === "action" ? "Waiting on you" : "For your awareness";
  const muted = item.request_id && state.projectNotificationSettings[item.request_id] === "muted";
  return `<article class="notification-item ${item.read_at ? "" : "unread"}"><button data-notification="${item.id}" data-request="${item.request_id || ""}" data-route="${route.view}" data-section="${route.section || ""}"><span>${esc(waiting)}</span><b>${esc(item.title)}</b><p>${esc(item.body)}</p><small>${new Date(item.created_at).toLocaleString()}</small></button>${item.request_id ? `<button class="notification-mute" data-project-notifications="${item.request_id}:${muted ? "normal" : "muted"}">${muted ? "Unmute project" : "Mute project"}</button>` : ""}</article>`;
}

function preferencesModal() {
  const p = state.notificationPreferences || {};
  openModal(
    `<span class="eyebrow">Notification preferences</span><h2>Choose what reaches you.</h2><p>Email routing is active in safe sink mode while the production sending domain is being authorized. Your preferences are already enforced.</p><form data-form="preferences" class="preference-form">${[
      ["in_app", "In-app notifications"],
      ["browser_notifications", "Browser/PWA new-message alerts"],
      ["email_enabled", "Allow transactional email"],
      ["email_proposals", "Proposal emails"],
      ["email_messages", "Message emails"],
      ["email_agreements", "Agreement emails"],
      ["email_reminders", "Reminder emails"],
      ["email_network", "Network and circle emails"],
      ["email_safety", "Safety and account emails"],
    ]
      .map(
        ([name, label]) =>
          `<label><span>${label}</span><input type="checkbox" name="${name}" ${(name === "browser_notifications" ? ("Notification" in window && Notification.permission === "granted") : p[name]) ? "checked" : ""}></label>`,
      )
      .join("")}<button class="primary">Save preferences</button></form>`,
  );
}

function profileModal() {
  const profile = state.profile;
  openModal(
    `<span class="eyebrow">Work profile</span><h2>Show how you can participate.</h2><form data-form="profile" class="form-grid"><label class="wide">Display name<input name="display_name" required minlength="2" maxlength="80" value="${esc(profile.name)}"></label><label>General location<input name="location_text" maxlength="120" value="${esc(profile.location)}"></label><label>Work radius (km)<input name="work_radius_km" type="number" min="0" max="1000" value="${profile.workRadius || ""}"></label><label class="wide">Short biography<textarea name="bio" maxlength="500">${esc(profile.bio)}</textarea></label><label class="wide">Availability<input name="availability_text" value="${esc(profile.availability || "")}"></label><label class="wide">Tools, workspace, vehicles, and equipment<textarea name="resources_text">${esc(profile.resources || "")}</textarea></label><label>Visibility<select name="profile_visibility"><option value="public">Public</option><option value="members">Members</option><option value="private">Private</option></select></label><label><input type="checkbox" name="remote_available" ${profile.remoteAvailable ? "checked" : ""}> Available for remote work</label><button class="primary wide">Save profile</button></form>`,
  );
  const photoField = document.createElement("div");
  photoField.className = "wide profile-photo-field";
  photoField.innerHTML = `${avatarMarkup(profile.avatarUrl, profile.name, "giant")}<label>Profile photo<span class="field-help">JPG, PNG, or WebP. Large images are resized before upload.</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label>${profile.avatarPath ? `<button type="button" class="text-btn" data-remove-avatar>Remove current photo</button>` : ""}`;
  modalRoot.querySelector('form[data-form="profile"]')?.prepend(photoField);
  const locationPrivacy = document.createElement("label");
  locationPrivacy.innerHTML = `Location visibility<span class="field-help">Controls who can see the general area above; your exact address is never collected.</span><select name="location_visibility"><option value="region">Show general region</option><option value="members">Signed-in members only</option><option value="private">Keep private</option></select>`;
  modalRoot.querySelector('[name="location_text"]')?.closest("label")?.after(locationPrivacy);
  locationPrivacy.querySelector("select").value = profile.locationVisibility || "region";
  modalRoot.querySelector("[name=profile_visibility]").value =
    profile.visibility || "public";
}

function onboardingModal() {
  const profile = state.profile;
  openModal(`<span class="eyebrow">Match setup · about 2 minutes</span><h2>What would make WorkTrade useful to you?</h2><p>Use plain language. You can change every answer later.</p><form data-form="onboarding" class="form-grid onboarding-form">
    <label class="wide">What can you offer?<span class="field-help">Skills, labor, goods, tools, space, access, or materials</span><textarea name="offers" required placeholder="Carpentry, bookkeeping, trailer access">${esc((profile.offers || []).join(", "))}</textarea></label>
    <label class="wide">What do you need?<span class="field-help">Work, knowledge, goods, equipment, or help finishing something</span><textarea name="needs" required placeholder="Fence repair, welding lessons, reclaimed lumber">${esc((profile.needs || []).join(", "))}</textarea></label>
    <label>General location<input name="location_text" maxlength="120" value="${esc(profile.location || "")}" placeholder="Richmond, VA"></label>
    <label>Availability<input name="availability_text" maxlength="240" value="${esc(profile.availability || "")}" placeholder="Weekends; weekday evenings"></label>
    <label>Comfortable travel radius (km)<input name="work_radius_km" type="number" min="0" max="1000" value="${profile.workRadius || ""}" placeholder="25"></label>
    <label class="wide">Transport, tools, equipment, materials, or workspace<span class="field-help">Useful access you could share with a local community</span><textarea name="resources_text" placeholder="Pickup truck, table saw, garage workspace">${esc(profile.resources || "")}</textarea></label>
    <label>Location visibility<select name="location_visibility"><option value="region">Show general region</option><option value="members">Signed-in members only</option><option value="private">Keep private</option></select></label>
    <fieldset class="wide"><legend>Ways you are open to exchanging value</legend><label><input type="checkbox" name="exchange" value="barter" checked> Barter</label><label><input type="checkbox" name="exchange" value="cash" checked> Cash</label><label><input type="checkbox" name="exchange" value="hybrid" checked> Cash + barter</label></fieldset>
    <label>Profile visibility<select name="profile_visibility"><option value="public">Public profile</option><option value="members">Members only</option><option value="private">Private</option></select></label>
    <label><input type="checkbox" name="remote_available" ${profile.remoteAvailable ? "checked" : ""}> Include remote opportunities</label>
    <div class="wide privacy-note"><b>Your exact address is never requested here.</b><span>General location improves nearby matches; visibility controls who can discover your profile.</span></div>
    <button class="primary wide">Save and show my matches</button>
  </form>`);
}

function welcomeSetupModal() {
  const profile = state.profile;
  let draft = {};
  try { draft = JSON.parse(localStorage.getItem(ONBOARDING_DRAFT_KEY)) || {}; } catch { draft = {}; }
  const value = (key, fallback = "") => esc(draft[key] ?? fallback ?? "");
  openModal(`<span class="eyebrow">Welcome to WorkTrade · about 2 minutes</span><h2>Let’s find a useful first connection.</h2><p>You can skip, resume, or change any answer later.</p><form data-form="onboarding" class="onboarding-form" data-step="1">
    <div class="onboarding-progress"><span>Step <b data-onboarding-step-number>1</b> of 3</span><div><i data-onboarding-progress></i></div></div>
    <section data-onboarding-step="1"><fieldset class="goal-cards"><legend>What would you like to do first?</legend><label><input type="radio" name="first_goal" value="find_help" checked><span><b>Find help</b><small>Meet people who offer what you need.</small></span></label><label><input type="radio" name="first_goal" value="offer_help"><span><b>Offer help</b><small>Find work and people who need your skills.</small></span></label><label><input type="radio" name="first_goal" value="post_work"><span><b>Post work</b><small>Describe something you want done or built.</small></span></label></fieldset></section>
    <section data-onboarding-step="2" hidden class="form-grid"><label class="wide">Display name<input name="display_name" required minlength="2" maxlength="80" value="${value("display_name", profile.name)}"></label><label class="wide">I can offer<span class="field-help">Skills, labor, goods, tools, space, access, or materials—for example carpentry, bookkeeping, or a pickup truck.</span><textarea name="offers" required>${value("offers", (profile.offers || []).join(", "))}</textarea></label><label class="wide">I need<span class="field-help">Work, knowledge, goods, equipment, or help—for example fence repair, sewing lessons, or reclaimed lumber.</span><textarea name="needs" required>${value("needs", (profile.needs || []).join(", "))}</textarea></label><fieldset class="wide exchange-cards"><legend>How are you open to exchanging value?</legend><label><input type="checkbox" name="exchange" value="barter" checked> Barter</label><label><input type="checkbox" name="exchange" value="cash" checked> Cash</label><label><input type="checkbox" name="exchange" value="hybrid" checked> Cash + barter</label><label><input type="checkbox" name="flexible"> Flexible</label></fieldset></section>
    <section data-onboarding-step="3" hidden class="form-grid"><label>General area<span class="field-help">City, county, or region only—never an exact address.</span><input name="location_text" maxlength="120" value="${value("location_text", profile.location)}" placeholder="Richmond, VA"></label><label>Who can see it?<span class="field-help">This controls the general area beside it.</span><select name="location_visibility"><option value="region">Everyone</option><option value="members">Signed-in members</option><option value="private">Only me</option></select></label><label>Availability<input name="availability_text" maxlength="240" value="${value("availability_text", profile.availability)}" placeholder="Saturday mornings"></label><label>Travel radius (km)<input name="work_radius_km" type="number" min="0" max="1000" value="${value("work_radius_km", profile.workRadius)}" placeholder="25"></label><label class="wide"><input type="checkbox" name="remote_available" ${profile.remoteAvailable ? "checked" : ""}> Include remote opportunities</label><label class="wide">Tools, materials, transportation, or workspace <span class="optional">optional</span><textarea name="resources_text" placeholder="Pickup truck, table saw, garage workspace">${value("resources_text", profile.resources)}</textarea></label><label class="wide">Portfolio photo <span class="optional">optional</span><span class="field-help">Photo upload will be added to profiles next. Completed projects already accept proof-of-work photos.</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled></label><div class="wide privacy-note"><b>Your precise location stays private.</b><span>Share meeting details yourself only after deciding to work together.</span></div></section>
    <div class="onboarding-actions"><button type="button" class="text-btn" data-onboarding-skip>Skip for now</button><button type="button" class="secondary" data-onboarding-back hidden>Back</button><button type="button" class="primary" data-onboarding-next>Continue</button><button class="primary" data-onboarding-finish hidden>Save and continue</button></div>
  </form>`);
  const goal = draft.first_goal || profile.firstGoal;
  if (goal) modalRoot.querySelector(`[name="first_goal"][value="${goal}"]`)?.click();
  const visibility = modalRoot.querySelector('[name="location_visibility"]');
  if (visibility) visibility.value = draft.location_visibility || profile.locationVisibility || "region";
  const onboardingPhoto = modalRoot.querySelector('input[type="file"][disabled]');
  if (onboardingPhoto) {
    onboardingPhoto.disabled = false;
    onboardingPhoto.name = "avatar";
    const help = onboardingPhoto.closest("label")?.querySelector(".field-help");
    if (help) help.textContent = "Optional profile photo. Large images are resized before upload.";
  }
}

function saveOnboardingDraft(form) {
  const data = new FormData(form);
  localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(Object.fromEntries(data.entries())));
}

function showOnboardingStep(form, step) {
  form.dataset.step = String(step);
  form.querySelectorAll("[data-onboarding-step]").forEach((panel) => { panel.hidden = Number(panel.dataset.onboardingStep) !== step; });
  form.querySelector("[data-onboarding-step-number]").textContent = String(step);
  form.querySelector("[data-onboarding-progress]").style.width = `${step / 3 * 100}%`;
  form.querySelector("[data-onboarding-back]").hidden = step === 1;
  form.querySelector("[data-onboarding-next]").hidden = step === 3;
  form.querySelector("[data-onboarding-finish]").hidden = step !== 3;
  modalRoot.querySelector(".modal")?.scrollTo({ top: 0, behavior: "instant" });
}

function matchFeedbackModal(matchKey) {
  openModal(`<span class="eyebrow">Improve your matches</span><h2>Why isn’t this relevant?</h2><p>This feedback stays private and helps tune what you see.</p><form data-form="match-feedback" data-match-key="${esc(matchKey)}" class="form-grid"><fieldset class="wide feedback-reasons"><legend>Choose the closest reason</legend><label><input type="radio" name="reason" value="wrong-skill" required> The skill or need is not a fit</label><label><input type="radio" name="reason" value="too-far"> Too far away</label><label><input type="radio" name="reason" value="timing"> Timing or availability does not work</label><label><input type="radio" name="reason" value="exchange"> Exchange terms are not a fit</label><label><input type="radio" name="reason" value="other"> Something else</label></fieldset><button class="primary wide">Save feedback</button></form>`);
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
  if (event.target.closest("[data-remove-avatar]")) {
    removeProfileAvatar(state.profile.avatarPath).then(loadRemoteWorkspace).then(() => { closeModal(); notify("Profile photo removed"); }).catch((error) => notify(error.message));
    return;
  }
  const removePortfolio = event.target.closest("[data-remove-portfolio-photo]");
  if (removePortfolio) {
    removePortfolioImage(removePortfolio.dataset.removePortfolioPhoto, removePortfolio.dataset.path).then(loadRemoteWorkspace).then(() => notify("Portfolio photo removed")).catch((error) => notify(error.message));
    return;
  }
  const onboardingForm = event.target.closest('form[data-form="onboarding"]');
  if (onboardingForm && event.target.closest("[data-onboarding-next]")) {
    const step = Number(onboardingForm.dataset.step || 1);
    const required = [...onboardingForm.querySelectorAll(`[data-onboarding-step="${step}"] [required]`)];
    if (required.some((field) => !field.reportValidity())) return;
    saveOnboardingDraft(onboardingForm);
    showOnboardingStep(onboardingForm, Math.min(3, step + 1));
    return;
  }
  if (onboardingForm && event.target.closest("[data-onboarding-back]")) {
    saveOnboardingDraft(onboardingForm);
    showOnboardingStep(onboardingForm, Math.max(1, Number(onboardingForm.dataset.step || 1) - 1));
    return;
  }
  if (onboardingForm && event.target.closest("[data-onboarding-skip]")) {
    saveOnboardingDraft(onboardingForm);
    const goal = new FormData(onboardingForm).get("first_goal");
    if (state.remote) recordOnboardingState(goal, "skipped").catch(() => {});
    state.profile = { ...state.profile, firstGoal: goal, onboardingSkipped: true };
    closeModal();
    notify("Setup saved. Resume it any time from your profile.");
    return;
  }
  const projectTab = event.target.closest("[data-project-tab]");
  if (projectTab) {
    const previousTop = projectTab.closest(".project-tabs").getBoundingClientRect().top;
    const nextProjectTab = projectTab.dataset.projectTab;
    queueMicrotask(() => {
      state.projectDetailTab = nextProjectTab;
      const nextTabs = document.querySelector(".project-tabs");
      if (nextTabs) window.scrollBy({ top: nextTabs.getBoundingClientRect().top - previousTop, behavior: "instant" });
    });
    return;
  }
  if (event.target.closest("[data-focus-milestones]")) {
    document.querySelector(".milestones")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    state.view = nav.dataset.nav;
    state.selectedId = null;
    state.projectDetailTab = "overview";
    return;
  }
  const conversation = event.target.closest("[data-conversation]");
  if (conversation) {
    state.selectedConversationId = conversation.dataset.conversation;
    state.messageListOnly = false;
    if (state.remote) manageConversation(state.selectedConversationId, "read").then(loadNetwork).catch(() => {});
    return;
  }
  const loadMessages = event.target.closest("[data-load-messages]");
  if (loadMessages) {
    const id = loadMessages.dataset.loadMessages;
    state.messagePageSizes = { ...state.messagePageSizes, [id]: (state.messagePageSizes[id] || 40) + 40 };
    return;
  }
  const card = event.target.closest("[data-open]");
  if (card) {
    state.selectedId = card.dataset.open;
    state.view = "detail";
    state.projectDetailTab = "overview";
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
  if (event.target.closest("[data-community-needs]"))
    document.querySelector("[data-community-needs-list]")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (action === "theme") {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("worktrade:theme", next);
    document.querySelector('meta[name="theme-color"]').content = next === "dark" ? "#111914" : "#f4f0e6";
    event.target.closest("[data-action=theme]").setAttribute("aria-label", `Switch to ${next === "dark" ? "light" : "dark"} mode`);
    return;
  }
  if (action === "post") postModal();
  if (action === "save-search") saveSearchModal();
  if (action === "create-circle") createCircleModal();
  if (action === "community-needs")
    document.querySelector("[data-community-needs-list]")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    scheduleCoordinationModal(state.requests.find((x) => x.id === state.selectedId));
  if(action==="ledger")agreementLedgerModal(state.requests.find(x=>x.id===state.selectedId));
  if(action==="change-orders")changeOrderHubModal(state.requests.find(x=>x.id===state.selectedId));
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
  if (action === "onboarding") welcomeSetupModal();
  if (action === "restore-matches") {
    state.matchFeedback = Object.fromEntries(Object.entries(state.matchFeedback).filter(([, value]) => value !== "dismissed"));
    localStorage.setItem(MATCH_FEEDBACK_KEY, JSON.stringify(state.matchFeedback));
    notify("Hidden matches restored");
  }
  if (action === "hide-examples") {
    state.examplesHidden = true;
    localStorage.setItem(EXAMPLES_KEY, "true");
    notify("Example work hidden");
  }
  if (action === "edit-request")
    editRequestModal(
      state.requests.find((item) => item.id === state.selectedId),
    );
  if (action === "notifications") notificationsModal();
  if (action === "toggle-message-archive") state.showArchivedMessages = !state.showArchivedMessages;
  if (action === "messages-back") state.messageListOnly = true;
  if (action === "notification-preferences") preferencesModal();
  if (action === "read-all")
    state.remote
      ? markNotificationsRead().then(loadNotifications).then(notificationsModal).catch((error) => notify(error.message))
      : (() => { state.notifications = state.notifications.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })); notificationsModal(); })();
  if (action === "export-data")
    exportMyData()
      .then(downloadExport)
      .then(() => notify("Your data export is ready"))
      .catch((error) => notify(error.message));
  if (action === "deactivate") deactivateModal();
  if (action === "moderation-console") moderationConsoleModal();
  if (action === "pilot-dashboard") pilotDashboardModal();
  if (action === "pilot-feedback") pilotFeedbackModal();
  if (action === "my-pilot-feedback") myPilotFeedbackModal();
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
  const reviewReport = event.target.closest("[data-review-report]");
  if (reviewReport) moderationDecisionModal(reviewReport.dataset.reviewReport);
  const reviewAppeal = event.target.closest("[data-review-appeal]");
  if (reviewAppeal) appealDecisionModal(reviewAppeal.dataset.reviewAppeal);
  const submitAppeal = event.target.closest("[data-submit-appeal]");
  if (submitAppeal) moderationAppealModal(submitAppeal.dataset.submitAppeal);
  const inviteToggle = event.target.closest("[data-pilot-invite-toggle]");
  if (inviteToggle)
    setPilotInviteEnabled(inviteToggle.dataset.pilotInviteToggle, inviteToggle.dataset.enabled === "true")
      .then(pilotDashboardModal)
      .catch((error) => notify(error.message));
  const copyText = event.target.closest("[data-copy-text]");
  if (copyText)
    navigator.clipboard.writeText(copyText.dataset.copyText)
      .then(() => notify("Invite code copied"))
      .catch(() => notify("Select and copy the code above"));
  const triageFeedback = event.target.closest("[data-triage-feedback]");
  if (triageFeedback) pilotFeedbackTriageModal(triageFeedback.dataset.triageFeedback);
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
  const counter = event.target.closest("[data-counter-offer]");
  if (counter) counterOfferModal(findOffer(counter.dataset.counterOffer));
  const decline = event.target.closest("[data-decline-offer]");
  if (decline && confirm("Decline the latest proposal terms?")) {
    if (state.remote)
      declineOffer(decline.dataset.declineOffer)
        .then(loadRemoteWorkspace)
        .then(() => notify("Proposal declined"))
        .catch((error) => notify(error.message));
    else {
      updateRequests((list) => list.map((request) => ({ ...request, offers: (request.offers || []).filter((offer) => offer.id !== decline.dataset.declineOffer) })));
      notify("Proposal declined");
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
    if (state.remote) markNotificationsRead([notification.dataset.notification]).then(loadNotifications);
    else state.notifications = state.notifications.map((item) => item.id === notification.dataset.notification ? { ...item, read_at: item.read_at || new Date().toISOString() } : item);
    closeModal();
    if (notification.dataset.request) {
      state.selectedId = notification.dataset.request;
      state.projectDetailTab = notification.dataset.section || "overview";
      state.view = "detail";
    } else state.view = notification.dataset.route || "workspace";
  }
  const negotiationOpen = event.target.closest("[data-negotiation-open]");
  if (negotiationOpen) {
    state.selectedId = negotiationOpen.dataset.negotiationOpen;
    state.projectDetailTab = "overview";
    state.view = "detail";
  }
  const projectNotifications = event.target.closest("[data-project-notifications]");
  if (projectNotifications) {
    const [requestId, setting] = projectNotifications.dataset.projectNotifications.split(":");
    state.projectNotificationSettings = { ...state.projectNotificationSettings, [requestId]: setting };
    localStorage.setItem(PROJECT_NOTIFICATION_KEY, JSON.stringify(state.projectNotificationSettings));
    notificationsModal();
    notify(setting === "muted" ? "Project updates muted on this device; required actions remain in your inbox" : "Project updates unmuted");
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
            `<div class="social-actions"><button class="primary" data-contact-person="${profile.id}">Message</button><button class="secondary" data-save-person="${profile.id}">${(state.networkInbox?.saved_profiles || []).includes(profile.id) ? "Saved" : "Save person"}</button></div>`,
          );
    }
  }
  const matchFeedback = event.target.closest("[data-match-feedback]");
  if (matchFeedback) {
    const value = matchFeedback.dataset.matchFeedback;
    const separator = value.lastIndexOf(":");
    const key = value.slice(0, separator);
    const feedback = value.slice(separator + 1);
    if (feedback === "not-relevant") matchFeedbackModal(key);
    else {
      state.matchFeedback = { ...state.matchFeedback, [key]: feedback };
      localStorage.setItem(MATCH_FEEDBACK_KEY, JSON.stringify(state.matchFeedback));
      notify("Thanks—this match was marked useful");
    }
  }
  const dismissMatch = event.target.closest("[data-match-dismiss]");
  if (dismissMatch) {
    state.matchFeedback = { ...state.matchFeedback, [dismissMatch.dataset.matchDismiss]: "dismissed" };
    localStorage.setItem(MATCH_FEEDBACK_KEY, JSON.stringify(state.matchFeedback));
    notify("Match hidden");
  }
  const invitePerson = event.target.closest("[data-invite-person]");
  if (invitePerson) {
    const profile = (state.networkProfiles || []).find(
      (x) => x.id === invitePerson.dataset.invitePerson,
    );
    if (profile) invitationModal(profile);
  }
  const contactPerson = event.target.closest("[data-contact-person]");
  if (contactPerson) {
    const profileId = contactPerson.dataset.contactPerson;
    const request = state.requests.find((item) => item.id === contactPerson.dataset.contactRequest) || null;
    const profile = (state.networkProfiles || []).find((item) => item.id === profileId);
    contactRequestModal(profileId, profile?.display_name || request?.owner || "this member", request, contactPerson.dataset.contactKind || "message");
  }
  const journeyInvitation = event.target.closest("[data-journey-invitation]");
  if (journeyInvitation) {
    const invitation = (state.networkInbox.invitations || []).find((item) => item.id === journeyInvitation.dataset.journeyInvitation);
    if (invitation?.status === "accepted") workspaceModal(invitation);
    else {
      state.view = "network";
      pendingRenderFocus = { selector: `[data-invite-response$=":${journeyInvitation.dataset.journeyInvitation}"]`, until: Date.now() + 1000 };
    }
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
  const conversationManage = event.target.closest("[data-conversation-manage]");
  if (conversationManage) {
    const [actionName, id] = conversationManage.dataset.conversationManage.split(":");
    manageConversation(id, actionName)
      .then(loadNetwork)
      .then(() => {
        if (actionName === "archive") state.selectedConversationId = null;
        notify(actionName === "archive" ? "Conversation archived" : `Conversation ${actionName}d`, "success");
      })
      .catch((error) => notify(error.message));
  }
  const messageOffer = event.target.closest("[data-message-offer]");
  if (messageOffer) {
    const invitation = state.networkInbox.invitations.find((item) => item.id === messageOffer.dataset.messageOffer);
    const request = state.requests.find((item) => item.id === invitation?.request_id);
    if (request && request.ownerId !== state.profile.id) offerModal(request.id);
    else {
      const otherId = invitation.sender_id === state.profile.id ? invitation.recipient_id : invitation.sender_id;
      const profile = state.networkProfiles.find((item) => item.id === otherId);
      if (profile) invitationModal(profile);
      else notify("Open their profile to begin exchange planning.", "warning");
    }
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
      state.networkMode = search.discovery_mode || (search.remote_only ? "remote" : "either");
      state.networkRadius = search.radius_km || 40;
      state.networkAvailability = search.availability_filter || "";
      state.networkSort = search.sort_order || "fit";
      loadNetwork();
    }
  }
  const skillSearch = event.target.closest("[data-skill-search]");
  if (skillSearch) {
    state.networkQuery = skillSearch.dataset.skillSearch;
    loadNetwork();
  }
  const scheduleResponse=event.target.closest("[data-schedule-response]");
  if(scheduleResponse){const[response,id]=scheduleResponse.dataset.scheduleResponse.split(":");respondScheduleWindow(id,response).then(loadRemoteWorkspace).then(()=>{closeModal();notify(`Schedule ${response}`)}).catch(error=>notify(error.message));}
  const scheduleCounter=event.target.closest("[data-schedule-counter]");
  if(scheduleCounter)scheduleCoordinationModal(state.requests.find(x=>x.id===state.selectedId),scheduleCounter.dataset.scheduleCounter);
  const calendarExport=event.target.closest("[data-calendar-export]");
  if(calendarExport){const stamp=x=>new Date(x).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const clean=x=>String(x||"").replace(/[\\;,\n]/g," ");const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//WorkTrade//Schedule//EN\r\nBEGIN:VEVENT\r\nUID:${calendarExport.dataset.calendarExport}@worktrade\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(calendarExport.dataset.start)}\r\nDTEND:${stamp(calendarExport.dataset.end)}\r\nSUMMARY:${clean(calendarExport.dataset.title)}\r\nLOCATION:${clean(calendarExport.dataset.location)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));link.download="worktrade-schedule.ics";link.click();URL.revokeObjectURL(link.href);}
  const ledgerAction=event.target.closest("[data-ledger-action]");if(ledgerAction){const[actionName,id]=ledgerAction.dataset.ledgerAction.split(":");manageLedgerItem(id,actionName).then(()=>agreementLedgerModal(state.requests.find(x=>x.id===state.selectedId))).then(()=>notify("Shared item approved")).catch(error=>notify(error.message));}
  const ledgerStatus=event.target.closest("[data-ledger-status]");if(ledgerStatus)ledgerStatusModal(ledgerStatus.dataset.ledgerStatus);
  const proposeChange=event.target.closest("[data-propose-change]");if(proposeChange)changeOrderModal(proposeChange.dataset.proposeChange);
  const changeResponse=event.target.closest("[data-change-response]");if(changeResponse){const[choice,id]=changeResponse.dataset.changeResponse.split(":");respondChangeOrder(id,choice==="accept").then(loadRemoteWorkspace).then(()=>changeOrderHubModal(state.requests.find(x=>x.id===state.selectedId))).then(()=>notify(`Change ${choice}ed`)).catch(error=>notify(error.message));}
  const issueAction=event.target.closest("[data-issue-action]");if(issueAction){const[actionName,id]=issueAction.dataset.issueAction.split(":");const allowed=actionName!=="escalate"||confirm("Escalate this issue and place the whole agreement in dispute?");if(allowed)manageWorkIssue(id,actionName).then(loadRemoteWorkspace).then(()=>{closeModal();notify(actionName==="escalate"?"Issue escalated to dispute":"Issue closed")}).catch(error=>notify(error.message));}
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
  if (event.target.matches("[data-message-draft]")) {
    state.messageDrafts[event.target.dataset.messageDraft] = event.target.value;
    localStorage.setItem(MESSAGE_DRAFT_KEY, JSON.stringify(state.messageDrafts));
  }
});
document.addEventListener("change", (event) => {
  if (event.target.matches('.message-composer input[type="file"]')) {
    const file = event.target.files?.[0];
    let preview = event.target.form?.querySelector("[data-attachment-preview]");
    if (!preview && event.target.form) {
      preview = document.createElement("span");
      preview.className = "attachment-preview";
      preview.dataset.attachmentPreview = "";
      preview.setAttribute("aria-live", "polite");
      event.target.form.append(preview);
    }
    if (preview) preview.textContent = file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB ready to send` : "";
  }
  if (event.target.matches("[data-following-feed]")) {
    state.networkFollowingOnly = event.target.checked;
    loadNetwork();
  }
});
document.addEventListener("keydown", (event) => {
  modalController.trapFocus(event);
  const card = event.target.closest("[data-open]");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    card.click();
  }
  if (event.key === "Escape") closeModal();
  if (event.target.matches("[data-message-draft]") && event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.target.form?.requestSubmit();
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  if (form.dataset.submitting) return;
  form.dataset.submitting = "true";
  form.setAttribute("aria-busy", "true");
  const submitButtons = [...form.querySelectorAll('button[type="submit"],button:not([type])')];
  submitButtons.forEach((button) => (button.disabled = true));
  try {
  const data = new FormData(form);
  if (form.dataset.form === "match-feedback") {
    state.matchFeedback = { ...state.matchFeedback, [form.dataset.matchKey]: `not-relevant:${data.get("reason")}` };
    localStorage.setItem(MATCH_FEEDBACK_KEY, JSON.stringify(state.matchFeedback));
    closeModal();
    notify("Thanks—this will improve future ranking");
  }
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
      pendingRenderFocus = { selector: "h1", until: Date.now() + 1500 };
      state.view = "detail";
      notify("Work request published on this device", "success");
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
    if (state.remote) {
      try {
        await submitSafetyReport(
          "request",
          form.dataset.id,
          data.get("reason"),
          data.get("detail"),
        );
        closeModal();
        notify("Private report submitted for moderator review");
      } catch (error) {
        notify(error.message);
      }
      return;
    }
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
      if (!state.profile.onboardingComplete && !state.profile.onboardingSkipped && !sessionStorage.getItem("worktrade:onboarding-shown")) {
        sessionStorage.setItem("worktrade:onboarding-shown", "true");
        setTimeout(welcomeSetupModal, 150);
      }
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
  if (form.dataset.form === "pilot-invite-redeem") {
    try {
      await redeemPilotInvite(data.get("invite_code"));
      sessionStorage.removeItem("worktrade-pilot-invite");
      closeModal();
      await bootstrapBackend();
      notify("Welcome to the WorkTrade pilot");
    } catch (error) { notify(error.message); }
  }
  if (form.dataset.form === "pilot-invite-create") {
    try {
      const invite = await createPilotInvite(
        data.get("label"), Number(data.get("max_uses")),
        data.get("expires_at") ? new Date(`${data.get("expires_at")}T23:59:59`).toISOString() : null,
      );
      openModal(`<span class="eyebrow">Invite created</span><h2>Copy this code now.</h2><p>Only a secure digest is stored, so it cannot be shown again.</p><div class="invite-code"><code>${esc(invite.code)}</code></div><button class="primary" data-copy-text="${esc(invite.code)}">Copy invite code</button>`);
    } catch (error) { notify(error.message); }
  }
  if (form.dataset.form === "pilot-feedback") {
    try {
      await submitPilotFeedback(data.get("category"), data.get("body"), form.dataset.view, form.dataset.stage, { selected_id: state.selectedId || null });
      closeModal(); notify("Feedback sent privately to the pilot team");
    } catch (error) { notify(error.message); }
  }
  if (form.dataset.form === "pilot-feedback-reply") {
    try { await replyToPilotFeedback(form.dataset.id, data.get("body")); await myPilotFeedbackModal(); notify("Reply sent"); }
    catch (error) { notify(error.message); }
  }
  if (form.dataset.form === "pilot-feedback-triage") {
    try { await managePilotFeedback(form.dataset.id, data.get("status"), data.get("severity"), data.get("assignee"), data.get("note"), data.get("reply")); await pilotDashboardModal(); notify("Feedback triage saved"); }
    catch (error) { notify(error.message); }
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
      workRadius: Number(data.get("work_radius_km")) || null,
      resources: data.get("resources_text") || "",
      locationVisibility: data.get("location_visibility") || "region",
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
          location_visibility: profile.locationVisibility,
          resources_text: profile.resources,
          profile_visibility: profile.visibility,
        });
      const avatar = form.elements.avatar?.files?.[0];
      if (state.remote && avatar) await uploadProfileAvatar(avatar, state.profile.avatarPath);
      state.profile = profile;
      if (state.remote && avatar) await loadRemoteWorkspace();
      if (!state.remote) persist();
      closeModal();
      notify("Profile saved");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "portfolio-photo") {
    try {
      const photo = form.elements.photo.files[0];
      if (!photo) return notify("Choose a photo", "warning");
      const oldPath = form.dataset.path;
      await uploadPortfolioImage(form.dataset.entry, photo, oldPath);
      await loadRemoteWorkspace();
      notify("Portfolio photo added", "success");
    } catch (error) { notify(error.message); }
  }
  if (form.dataset.form === "onboarding") {
    const splitList = (value) => value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
    const exchanges = data.getAll("exchange");
    if (!exchanges.length) return notify("Choose at least one way to exchange value.", "warning");
    const profile = {
      ...structuredClone(state.profile),
      name: data.get("display_name") || state.profile.name,
      offers: splitList(data.get("offers")),
      needs: splitList(data.get("needs")),
      location: data.get("location_text"),
      availability: data.get("availability_text"),
      workRadius: Number(data.get("work_radius_km")) || null,
      resources: data.get("resources_text") || "",
      locationVisibility: data.get("location_visibility") || "region",
      visibility: data.get("profile_visibility") || state.profile.visibility || "public",
      remoteAvailable: data.has("remote_available"),
      preferredExchangeModes: exchanges,
      firstGoal: data.get("first_goal") || "find_help",
      onboardingComplete: true,
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
          preferred_exchange_modes: data.has("flexible") ? ["cash", "barter", "hybrid"] : exchanges,
          availability_text: profile.availability,
          location_visibility: profile.locationVisibility,
          resources_text: profile.resources,
          profile_visibility: profile.visibility,
        });
      if (state.remote) await recordOnboardingState(profile.firstGoal, "complete");
      const avatar = form.elements.avatar?.files?.[0];
      if (state.remote && avatar) await uploadProfileAvatar(avatar, state.profile.avatarPath);
      state.profile = profile;
      if (state.remote && avatar) await loadRemoteWorkspace();
      if (!state.remote) persist();
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      closeModal();
      if (state.remote) await loadNetwork();
      if (profile.firstGoal === "post_work") {
        state.view = "discover";
        setTimeout(postModal, 0);
        notify("Profile saved. Tell the community what you need.", "success");
      } else {
        state.view = "matches";
        notify(profile.firstGoal === "offer_help" ? "Here’s work you may be able to help with" : "Your first matches are ready", "success");
      }
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
      if (data.has("browser_notifications") && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
      state.notificationPreferences = await saveNotificationPreferences({
        in_app: data.has("in_app"),
        email_enabled: data.has("email_enabled"),
        email_proposals: data.has("email_proposals"),
        email_messages: data.has("email_messages"),
        email_agreements: data.has("email_agreements"),
        email_reminders: data.has("email_reminders"),
        email_network: data.has("email_network"),
        email_safety: data.has("email_safety"),
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
  if (form.dataset.form === "moderation-decision") {
    try {
      await moderateReport(
        form.dataset.report,
        data.get("action"),
        data.get("internal_note"),
        data.get("reporter_update"),
        data.get("expires_at")
          ? new Date(data.get("expires_at")).toISOString()
          : null,
      );
      closeModal();
      notify("Immutable moderation action recorded");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "appeal-decision") {
    try {
      await resolveModerationAppeal(
        form.dataset.appeal,
        data.get("decision"),
        data.get("internal_note"),
        data.get("member_update"),
      );
      closeModal();
      notify("Appeal decision recorded");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "moderation-appeal") {
    try {
      await submitModerationAppeal(
        form.dataset.restriction,
        data.get("statement"),
      );
      closeModal();
      await hydrateAccount();
      notify("Appeal submitted for review");
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
  if (form.dataset.form === "counter-offer") {
    const original = findOffer(form.dataset.id);
    const payload = {
      mode: data.get("mode"), scope: data.get("scope"), exchange_summary: data.get("exchange_summary"),
      duration: data.get("duration"), exclusions: data.get("exclusions"), responsibilities: original.responsibilities || {},
      milestones: original.proposed_milestones || [], questions: data.get("questions"),
      expires_at: data.get("expires_at") ? new Date(`${data.get("expires_at")}T23:59:59`).toISOString() : "",
    };
    try {
      if (state.remote) await counterOffer(form.dataset.id, payload);
      else updateRequests((list) => { const offer = list.flatMap((request) => request.offers || []).find((item) => item.id === form.dataset.id); if (offer) { offer.history ||= []; offer.history.unshift({ version: offer.version || 1, scope: offer.gives, exchange_summary: offer.wants, profiles: { display_name: offer.provider } }); offer.version = (offer.version || 1) + 1; offer.mode = payload.mode; offer.gives = payload.scope; offer.wants = payload.exchange_summary; offer.duration = payload.duration; offer.exclusions = payload.exclusions; offer.note = payload.questions; offer.lastProposedBy = state.profile.id; } });
      closeModal();
      if (state.remote) await loadRemoteWorkspace();
      notify("Counterproposal sent", "success");
    } catch (error) { notify(error.message); }
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
  if(form.dataset.form==="schedule-proposal"){
    try{const start=new Date(data.get("start_at")),end=new Date(data.get("end_at"));if(end<=start)return notify("End time must be after the start");await proposeScheduleWindow(form.dataset.agreement,{start_at:start.toISOString(),end_at:end.toISOString(),timezone:data.get("timezone"),weather_sensitive:data.has("weather_sensitive"),location_detail:data.get("location_detail"),arrival_notes:data.get("arrival_notes"),counter_to:form.dataset.counter||""});closeModal();await loadRemoteWorkspace();notify(form.dataset.counter?"Counterproposal sent":"Schedule proposal sent");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="availability"){
    try{await saveMyAvailability({timezone:data.get("timezone"),lead_time_hours:Number(data.get("lead_time_hours"))||0,weekly_windows:String(data.get("windows")||"").split(/\n|;/).map(x=>x.trim()).filter(Boolean)});notify("Availability saved");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="ledger-item"){
    try{await saveLedgerItem(form.dataset.agreement,null,{item_type:data.get("item_type"),description:data.get("description"),responsibility:data.get("responsibility"),contribution_mode:data.get("contribution_mode"),status:data.get("status"),quantity:data.get("quantity"),unit:data.get("unit"),estimated_cost_cents:data.get("estimated_cost")?Math.round(Number(data.get("estimated_cost"))*100):"",barter_description:data.get("barter_description")});await agreementLedgerModal(state.requests.find(x=>x.id===state.selectedId));notify("Preparation item added");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="ledger-status"){
    try{await manageLedgerItem(form.dataset.item,"status",{status:data.get("status"),quantity_actual:data.get("quantity_actual"),actual_cost_cents:data.get("actual_cost")?Math.round(Number(data.get("actual_cost"))*100):""});await agreementLedgerModal(state.requests.find(x=>x.id===state.selectedId));notify("Preparation status updated");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="ledger-receipt"){
    const file=form.elements.receipt.files[0];if(!file||file.size>10485760)return notify("Choose a JPG, PNG, or WebP under 10 MB.");try{await uploadLedgerReceipt(form.dataset.agreement,form.dataset.item,file);await agreementLedgerModal(state.requests.find(x=>x.id===state.selectedId));notify("Receipt or item photo added");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="work-issue"){
    try{await reportWorkIssue(form.dataset.agreement,{category:data.get("category"),title:data.get("title"),detail:data.get("detail"),milestone_id:"",obligation_id:"",unaffected_work_can_continue:data.has("continue")});await changeOrderHubModal(state.requests.find(x=>x.id===state.selectedId));notify("Work issue documented");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="change-order"){
    try{await proposeChangeOrder(form.dataset.issue,{scope_delta:data.get("scope_delta"),time_delta_minutes:Number(data.get("time_delta_minutes"))||0,cash_delta_cents:Math.round((Number(data.get("cash_delta"))||0)*100),barter_delta:data.get("barter_delta"),schedule_delta:data.get("schedule_delta")});await changeOrderHubModal(state.requests.find(x=>x.id===state.selectedId));notify("Change order sent for approval");}catch(error){notify(error.message);}
  }
  if(form.dataset.form==="issue-evidence"){
    const file=form.elements.photo.files[0];if(!file||file.size>10485760)return notify("Choose a JPG, PNG, or WebP under 10 MB.");try{await uploadWorkIssueEvidence(form.dataset.agreement,form.dataset.issue,file,data.get("caption"));await changeOrderHubModal(state.requests.find(x=>x.id===state.selectedId));notify("Private issue evidence added");}catch(error){notify(error.message);}
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
    state.networkMode = data.get("mode") || "either";
    state.networkRemote = state.networkMode === "remote";
    state.networkRadius = 40;
    state.networkAvailability = data.get("availability") || "";
    state.networkSort = data.get("sort") || "fit";
    await loadNetwork();
  }
  if (form.dataset.form === "message-search") {
    state.messageQuery = data.get("query") || "";
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
  if (form.dataset.form === "contact-request") {
    try {
      if (state.remote) {
        await sendContactRequest(
          form.dataset.profile,
          data.get("message"),
          form.dataset.request || null,
          form.dataset.kind || "message",
        );
        await loadNetwork();
      }
      closeModal();
      state.view = "network";
      notify("Message request sent", "success");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "intro-message") {
    try {
      const file = form.elements.attachment?.files?.[0];
      const body = String(data.get("body") || "").trim();
      if (!body && !file) return notify("Write a message or attach a file.", "warning");
      if (file && file.size > 10485760) return notify("Choose a file under 10 MB.", "warning");
      if (file) await sendMessageAttachment(form.dataset.invitation, body, file);
      else await sendIntroductionMessage(form.dataset.invitation, body);
      delete state.messageDrafts[form.dataset.invitation];
      localStorage.setItem(MESSAGE_DRAFT_KEY, JSON.stringify(state.messageDrafts));
      form.reset();
      await loadNetwork();
      if (state.remote) await manageConversation(form.dataset.invitation, "read");
    } catch (error) {
      notify(error.message);
    }
  }
  if (form.dataset.form === "save-network-search") {
    try {
      await saveDiscoveryAlert(data.get("name"), { query: state.networkQuery, exchange: state.networkExchange, mode: state.networkMode, radius: state.networkRadius, availability: state.networkAvailability, sort: state.networkSort, alerts: data.has("alerts") });
      closeModal();
      await loadNetwork();
      notify("Discovery alert saved");
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
  } finally {
    if (form.isConnected) {
      delete form.dataset.submitting;
      form.removeAttribute("aria-busy");
      submitButtons.forEach((button) => (button.disabled = false));
    }
  }
});

store.subscribe(render, true);
document.querySelector("#mode-badge").textContent = backendConfigured
  ? "Connected"
  : "Demo mode";

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
        offers.map(async (offer) => {
          const [discussion, history] = await Promise.all([getProposalQuestions(offer.id), getOfferVersions(offer.id)]);
          const previous = history[0];
          const changedFields = previous ? [["scope", "Scope"], ["exchange_summary", "Exchange"], ["duration_text", "Duration"], ["exclusions", "Exclusions"], ["mode", "Exchange type"]].filter(([key]) => String(previous[key] || "") !== String(offer[key] || "")).map(([, label]) => label) : [];
          return ({
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
          version: offer.version,
          lastProposedBy: offer.last_proposed_by,
          changedFields,
          history,
          discussion,
        });}),
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
  await Promise.all(myOffers.map(async (offer) => {
    offer.history = await getOfferVersions(offer.id);
    const previous = offer.history[0];
    offer.changedFields = previous ? [["scope", "Scope"], ["exchange_summary", "Exchange"], ["duration_text", "Duration"], ["exclusions", "Exclusions"], ["mode", "Exchange type"]].filter(([key]) => String(previous[key] || "") !== String(offer[key] || "")).map(([, label]) => label) : [];
  }));
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
      locationVisibility: profile.location_visibility || "region",
      resources: profile.resources_text || "",
      visibility: profile.profile_visibility,
      avatarPath: profile.avatar_path || null,
      avatarUrl: profile.avatar_url || "",
      portfolio: profile.portfolio_entries || [],
      preferredExchangeModes: profile.preferred_exchange_modes || ["cash", "barter", "hybrid"],
      firstGoal: profile.first_goal || null,
      onboardingComplete: !!profile.onboarding_completed_at,
      onboardingSkipped: !!profile.onboarding_skipped_at,
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
            attachments: [],
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
    const unreadMessages = (inbox.invitations || []).reduce((total, item) => total + Number(item.unread_count || 0) + (item.recipient_id === state.profile.id && item.status === "pending" ? 1 : 0), 0);
    const messageCount = document.querySelector("#message-count");
    if (messageCount) {
      messageCount.textContent = unreadMessages ? String(unreadMessages) : "";
      messageCount.hidden = !unreadMessages;
    }
    announceStrongMatches(profiles || []);
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
    if (!session) {
      panel.innerHTML = `<b>Ready for a real account</b><p>Sign in with a secure email link.</p><button class="primary" data-action="sign-in">Sign in</button>`;
      return;
    }
    const [reports, restrictions, staffQueue, pilotAccess] = await Promise.all([
      getMySafetyReports(),
      getMyRestrictions(),
      getModerationQueue().catch(() => null),
      getPilotAccess().catch(() => ({ member: true, admin: false })),
    ]);
    const activeRestriction = restrictions.find(
      (restriction) =>
        !restriction.lifted_at &&
        (!restriction.expires_at || new Date(restriction.expires_at) > new Date()),
    );
    panel.innerHTML = `<b>${esc(session.user.email)}</b><p>Your session is encrypted and managed by Supabase Auth.</p>${
      activeRestriction
        ? `<div class="safety-notice"><b>Account ${esc(activeRestriction.level)}</b><p>${esc(activeRestriction.reason)}</p><button class="secondary" data-submit-appeal="${activeRestriction.id}">Appeal this restriction</button></div>`
        : ""
    }${
      reports.length
        ? `<div class="safety-notice"><b>Your safety reports</b>${reports
            .slice(0, 3)
            .map(
              (report) =>
                `<p>${esc(report.category)} · ${esc(report.reporter_status)}${report.reporter_update ? `<br>${esc(report.reporter_update)}` : ""}</p>`,
            )
            .join("")}</div>`
        : ""
    }<div class="account-actions"><button class="secondary" data-action="my-pilot-feedback">My feedback</button><button class="secondary" data-action="notification-preferences">Notifications</button><button class="secondary" data-action="export-data">Export my data</button>${pilotAccess.admin ? `<button class="secondary" data-action="pilot-dashboard">Pilot dashboard</button>` : ""}${staffQueue ? `<button class="secondary" data-action="moderation-console">Safety queue (${staffQueue.reports.length + staffQueue.appeals.length})</button>` : ""}<button class="secondary" data-action="sign-out">Sign out</button><button class="danger-text" data-action="deactivate">Deactivate account</button></div>`;
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
      if (!messageSubscription) {
        messageSubscription = await subscribeToMessages(() => {
          clearTimeout(realtimeRefreshTimer);
          realtimeRefreshTimer = setTimeout(async () => {
            await loadNetwork();
            if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") new Notification("New WorkTrade message", { body: "Open Messages to reply.", icon: "./assets/icon-192.png" });
          }, 250);
        });
      }
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
