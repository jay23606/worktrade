import { createStore } from "./modules/store.js";
import { cloneSeed } from "./data.js";
import { createModalController, esc, money, modeLabel } from "./modules/ui.js";
import { mapRemoteRequest } from "./modules/request-mapper.js";
import { createMatchingFeature } from "./features/matching.js";
import { createMessagesFeature } from "./features/messages.js";
import { createNetworkFeature } from "./features/network.js";
import { createProjectsFeature } from "./features/projects.js";
import { createWorkspaceFeature } from "./features/workspace.js";
import { createCommunitiesFeature } from "./features/communities.js";
import { createProfileFeature } from "./features/profile.js";
import { createCollaborationDialogs } from "./features/collaboration-dialogs.js";
import { createOperationsDialogs } from "./features/operations-dialogs.js";
import { createProjectCoordinationDialogs } from "./features/project-coordination-dialogs.js";
import { createNotificationsFeature } from "./features/notifications.js";
import { createCoreClickHandler } from "./features/core-click-handler.js";
import { createProjectClickHandler } from "./features/project-click-handler.js";
import { createSocialClickHandler } from "./features/social-click-handler.js";
import { createCommunityClickHandler } from "./features/community-click-handler.js";
import { createProfileClickHandler } from "./features/profile-click-handler.js";
import { createManagementClickHandler } from "./features/management-click-handler.js";
import { createCoordinationClickHandler } from "./features/coordination-click-handler.js";
import { createCoordinationSubmitHandler } from "./features/coordination-submit-handler.js";
import { createNetworkSubmitHandler } from "./features/network-submit-handler.js";
import { createCommunitySubmitHandler } from "./features/community-submit-handler.js";
import { initializePwa } from "./shell/pwa.js";
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
  recordMatchEvent,
  recommendProfilesForRequest,
  notifyProjectMatches,
  getConversationProfile,
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
  projectRecommendations: {},
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
let messageSubscription = null;
let realtimeRefreshTimer = null;
let applyConnectivityState;

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
({ applyConnectivityState } = initializePwa({ notify }));
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

const { conversationTime, renderMessages } = createMessagesFeature({ getState: () => state, shell, esc });
const { renderWorkspace } = createWorkspaceFeature({ getState: () => state, shell, esc, conversationTime });
const { findOffer, loadProjectRecommendations, renderDetail } = createProjectsFeature({ getState: () => state, shell, esc, money, modeLabel, recommendProfilesForRequest, notify });
const matchingFeature = createMatchingFeature({ getState: () => state, esc, notify, recordMatchEvent, requestCard, shell });
const { announceStrongMatches, feedbackControls, recordMatchKey, renderFirstMatches, scorePersonForProfile, scoreRequestForProfile } = matchingFeature;
const { circleDetail, renderChainHub } = createCommunitiesFeature({ getState: () => state, esc });
const { hydrateLocalDiscovery, hydrateNetworkSocial, localDiscoveryProfiles, renderNetwork, socialPersonCard } = createNetworkFeature({ getState: () => state, shell, esc, networkPersonCard, activityCard, scorePersonForProfile, circleDetail, renderChainHub });
const { onboardingCapabilities, onboardingModal, profileModal, renderProfile, saveOnboardingDraft, showOnboardingStep, validateOnboardingCapabilities, welcomeSetupModal } = createProfileFeature({ getState: () => state, shell, esc, avatarMarkup, backendConfigured, openModal, modalRoot, onboardingDraftKey: ONBOARDING_DRAFT_KEY, notify });
const { chainBuilderModal, chainHoldModal, circleInviteModal, circlePostModal, circleResourceModal, circleSettingsModal, contactRequestModal, createCircleModal, invitationModal, saveSearchModal, workspaceModal } = createCollaborationDialogs({ getState: () => state, openModal, esc, modalRoot, categories, notify });
const { appealDecisionModal, moderationAppealModal, moderationConsoleModal, moderationDecisionModal, myPilotFeedbackModal, pilotDashboardModal, pilotFeedbackModal, pilotFeedbackTriageModal, pilotInviteModal } = createOperationsDialogs({ getState: () => state, openModal, esc, notify, getModerationQueue, getPilotDashboard, getMyPilotFeedback });
const { agreementLedgerModal, changeOrderHubModal, changeOrderModal, ledgerStatusModal, scheduleCoordinationModal } = createProjectCoordinationDialogs({ getState: () => state, openModal, esc, money, notify, getAgreementSchedule, getAgreementLedger, getChangeOrderHub });
const { notificationRoute, notificationsModal, preferencesModal } = createNotificationsFeature({ getState: () => state, openModal, esc });
const handleCoreClick = createCoreClickHandler({ getState: () => state, removeProfileAvatar, removePortfolioImage, loadRemoteWorkspace, closeModal, notify, validateOnboardingCapabilities, saveOnboardingDraft, showOnboardingStep, recordOnboardingState, loadNetwork, manageConversation, modalRoot });
const handleProjectClick = createProjectClickHandler({ getState: () => state, acceptOffer, loadRemoteWorkspace, notify, updateRequests, proposeAgreement, confirmAgreement, counterOfferModal, findOffer, declineOffer, performAgreementAction, transitionAgreement, handleCompletion, respondAmendment });
const handleSocialClick = createSocialClickHandler({ getState: () => state, publicProfileModal, recordMatchKey, modalRoot, getConversationProfile, notify, matchFeedbackModal, matchFeedbackKey: MATCH_FEEDBACK_KEY, invitationModal, recordMatchEvent, contactRequestModal, setPendingRenderFocus: (value) => { pendingRenderFocus = value; }, setSavedProfile, loadNetwork, respondCollaborationInvitation, loadNotifications, manageConversation, offerModal, workspaceModal, confirmIntroductionWorkspace, closeModal, convertIntroductionToRequest, loadRemoteWorkspace, manageNetworkItem });
const handleCommunityClick = createCommunityClickHandler({ getState: () => state, loadNetwork, notify, requestCircleMembership, manageCircleMembership, circleResourceModal, circleSettingsModal, circleInviteModal, circlePostModal, deleteCircleResource, chainBuilderModal, acceptTradeChain, activateTradeChain, manageTradeChainLink, chainHoldModal, manageTradeChain });
const handleProfileClick = createProfileClickHandler({ getState: () => state, updateMyProfile, notify, persist, setFollow });
const handleManagementClick = createManagementClickHandler({ getState: () => state, closeRequest, loadRemoteWorkspace, notify, markNotificationsRead, loadNotifications, closeModal, projectNotificationKey: PROJECT_NOTIFICATION_KEY, notificationsModal, requestLifecycleAction, reviseOfferModal, withdrawOffer, manageMilestone, manageRequestMedia });
const handleCoordinationClick = createCoordinationClickHandler({ getState: () => state, respondScheduleWindow, loadRemoteWorkspace, closeModal, notify, scheduleCoordinationModal, manageLedgerItem, agreementLedgerModal, ledgerStatusModal, changeOrderModal, respondChangeOrder, changeOrderHubModal, manageWorkIssue });
const handleCoordinationSubmit = createCoordinationSubmitHandler({ getState: () => state, notify, closeModal, loadRemoteWorkspace, setAgreementSchedule, proposeScheduleWindow, saveMyAvailability, saveLedgerItem, manageLedgerItem, uploadLedgerReceipt, reportWorkIssue, proposeChangeOrder, uploadWorkIssueEvidence, agreementLedgerModal, changeOrderHubModal });
const handleNetworkSubmit = createNetworkSubmitHandler({ getState: () => state, notify, closeModal, loadNetwork, publishCompletion, sendCollaborationInvitation, recordMatchKey, recordMatchEvent, sendContactRequest, sendMessageAttachment, sendIntroductionMessage, manageConversation, saveDiscoveryAlert, updateIntroductionWorkspace, messageDraftKey: MESSAGE_DRAFT_KEY });
const handleCommunitySubmit = createCommunitySubmitHandler({ getState: () => state, notify, closeModal, loadNetwork, createCircle, saveCircleResource, inviteCircleMember, createCircleRequest, updateCircleSettings, reviseTradeChain, createTradeChain, manageTradeChain });

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
  if (state.view === "detail") loadProjectRecommendations(state.selectedId);
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
  if (handleCoreClick(event)) return;
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
  handleProjectClick(event);
  handleProfileClick(event);
  handleManagementClick(event);
  if (handleSocialClick(event)) return;
  handleCoordinationClick(event);
  if (handleCommunityClick(event)) return;
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
    recordMatchKey(form.dataset.matchKey, "dismissed", data.get("reason"));
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
        if (shouldPublish) notifyProjectMatches(newId).catch(() => {});
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
    const item = String(data.get("item") || "").trim();
    if (item.length < 2 || item.length > 100) return notify("Use 2–100 characters for each offer or need.", "warning");
    const profile = structuredClone(state.profile);
    profile[form.dataset.list].push(item);
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
    if (!validateOnboardingCapabilities(form)) {
      showOnboardingStep(form, 2);
      return;
    }
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
  if (await handleCoordinationSubmit(form, data)) return;
  if (form.dataset.form === "proposal-question") {
    try {
      await askProposalQuestion(form.dataset.offer, data.get("body"));
      form.reset();
      notify("Question sent to proposal participants");
    } catch (error) {
      notify(error.message);
    }
  }
  if (await handleNetworkSubmit(form, data)) return;
  if (await handleCommunitySubmit(form, data)) return;
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.session) loadNetwork();
});
