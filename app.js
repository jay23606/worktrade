import { createStore } from "./modules/store.js";
import { cloneSeed } from "./data.js";
import { confirmAgreement, proposeAgreement, transitionAgreement } from "./modules/agreements.js";
import { acceptOffer, backendConfigured, closeRequest, createRequest as createRemoteRequest, deactivateMyAccount, exportMyData, getEvidenceUrl, getMyAgreements, getMyProfile, getNotificationPreferences, getNotifications, getProjectMessages, getRequestOffers, getSession, listPublicRequests, markNotificationsRead, performAgreementAction, saveNotificationPreferences, sendProjectMessage, signInWithEmail, signOut, submitOffer, submitReview, updateMyProfile, updateRequest, uploadWorkEvidence } from "./modules/backend.js";

const STORAGE_KEY = "worktrade:v1";
const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();
const initial = saved?.requests ? saved : cloneSeed();
const store = createStore({ view: "discover", query: "", category: "All", selectedId: null, session: null, remote: false, profile: initial.profile, requests: initial.requests, notifications: [], notificationPreferences: null });
const { state } = store;
const main = document.querySelector("#main");
const modalRoot = document.querySelector("#modal-root");
const categories = ["All", "Build", "Repair", "Install", "Fabricate", "Restore", "Modify", "Maintain", "Inspect", "Diagnose"];

const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const money = (value) => value ? `$${Number(value).toLocaleString()}` : "Open budget";
const modeLabel = (mode) => ({ cash: "Cash", barter: "Barter", hybrid: "Cash + barter" }[mode] || mode);
const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: state.profile, requests: state.requests }));
const notify = (message) => { const toast = document.querySelector("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2200); };
const updateRequests = (transform) => { state.requests = transform(structuredClone(state.requests)); persist(); };

function shell(content, eyebrow = "Local work exchange") {
  return `<section class="page"><div class="page-head"><span class="eyebrow">${eyebrow}</span></div>${content}</section>`;
}

function renderDiscover() {
  const filtered = state.requests.filter((request) => request.status === "open" && !(state.profile.blocked || []).includes(request.ownerId) && (state.category === "All" || request.category === state.category)
    && `${request.title} ${request.description} ${request.skills.join(" ")}`.toLowerCase().includes(state.query.toLowerCase()));
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
  return shell(`<button class="back" data-nav="discover">← Back to requests</button>
    <div class="detail-grid"><article class="detail-main">
      <div class="card-top"><span class="category">${esc(request.category)}</span><span>${esc(request.status)}</span></div>
      ${isOwner && state.remote && request.status === "open" ? `<div class="owner-actions"><button class="secondary" data-action="edit-request">Edit request</button><button class="text-btn" data-request-action="close">Close</button><button class="text-btn" data-request-action="archive">Archive</button><button class="danger-text" data-request-action="cancel">Cancel</button></div>` : ""}
      <h1>${esc(request.title)}</h1><p class="lede">${esc(request.description)}</p>
      <div class="facts"><div><small>Location</small><b>${esc(request.location)}</b></div><div><small>Timing</small><b>${esc(request.urgency)}</b></div><div><small>Cash range</small><b>${money(request.cashBudget)}</b></div></div>
      <section><span class="eyebrow">Skills and capabilities</span><div class="tags large">${request.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></section>
      <section><span class="eyebrow">Value available in return</span><div class="value-list">${request.offersInReturn.map((item) => `<div><span>↔</span>${esc(item)}</div>`).join("")}</div></section>
      ${request.hold ? holdCard(request.hold) : ""}
      ${request.milestones ? milestones(request) : ""}
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
      ${request.agreement ? agreementCard(request) : isOwner ? `<div class="side-note"><b>Waiting for proposals</b><p>Compare scope and both sides of the exchange before selecting one.</p></div>` : `<button class="primary full" data-action="offer" data-id="${request.id}">Propose a trade</button>`}
      <div class="side-note"><b>Choose your own exchange</b><p>Cash, goods, services, labor, access, or a combination. WorkTrade does not assign artificial credits.</p></div>
      <div class="safety-actions"><button class="text-btn" data-action="follow">${(request.followers || []).includes("me") ? "Following" : "Follow project"}</button><button class="text-btn" data-action="report">Report concern</button><button class="text-btn" data-action="block" data-person="${request.ownerId}">Block user</button></div>
      ${request.offers.length ? `<section class="proposals"><span class="eyebrow">Proposals</span>${request.offers.map((o) => offerCard(o, isOwner, request.id)).join("")}</section>` : ""}
    </aside></div>`, "Work request");
}

function offerCard(offer, isOwner, requestId) {
  return `<article class="offer"><div><span class="mini-avatar">${offer.initials}</span><b>${esc(offer.provider)}</b><span class="mode">${modeLabel(offer.mode)}</span></div><p><strong>Will provide:</strong> ${esc(offer.gives)}</p><p><strong>In exchange:</strong> ${esc(offer.wants)}</p><small>${esc(offer.duration)} · ${esc(offer.note)}</small>${isOwner ? `<button class="secondary full" data-accept="${offer.id}" data-request="${requestId}">Accept and start</button>` : ""}</article>`;
}

function agreementCard(request) {
  const agreement = request.agreement;
  const modern = Array.isArray(agreement.parties);
  const confirmed = modern && agreement.confirmations.includes(state.profile.id);
  const controls = modern ? agreementControls(agreement, confirmed) : "";
  return `<div class="agreement"><span class="eyebrow">${esc(agreement.status)} agreement${agreement.version ? ` · v${agreement.version}` : ""}</span><h3>${esc(agreement.provider || "Shared terms")}</h3><p>${esc(typeof agreement.exchange === "object" ? agreement.exchange.summary : agreement.exchange || agreement.summary)}</p><div class="progress"><span style="width:${agreement.progress || 0}%"></span></div><small>${agreement.progress || 0}% of milestones complete</small>${controls}</div>${agreement.obligations?.length ? obligationCards(agreement) : ""}`;
}

function obligationCards(agreement) {
  return `<div class="obligations"><span class="eyebrow">Exchange obligations</span>${agreement.obligations.map((item) => { const mine = item.responsible_profile_id === state.profile.id; return `<article><div><b>${mine ? "Your side" : "Their side"}</b><span>${esc(item.status)}</span></div><p>${esc(item.description)}</p>${item.status === "pending" && mine ? `<button class="secondary" data-obligation="fulfill:${item.id}">Submit fulfillment</button>` : ""}${item.status === "submitted" && !mine ? `<button class="secondary" data-obligation="approve:${item.id}">Approve fulfillment</button>` : ""}</article>`; }).join("")}</div>`;
}

function agreementControls(agreement, confirmed) {
  if (agreement.status === "proposed") return confirmed ? `<small class="agreement-note">Waiting for the other party to confirm.</small>` : `<button class="secondary full" data-agreement="confirm">Confirm terms</button>`;
  const next = { agreed: ["scheduled", "Schedule work"], scheduled: ["active", "Start work"], active: ["review", "Request review"], review: ["completed", "Approve completion"] }[agreement.status];
  return `${next ? `<button class="secondary full" data-agreement="${next[0]}">${next[1]}</button>` : ""}${!["completed", "cancelled", "disputed"].includes(agreement.status) ? `<div class="agreement-links"><button data-agreement="disputed">Raise concern</button><button data-agreement="cancelled">Cancel</button></div>` : ""}`;
}

function holdCard(hold) {
  return `<section class="hold"><div class="hold-icon">Ⅱ</div><div><span class="eyebrow">Dependency hold · ${esc(hold.type)}</span><h3>${esc(hold.detail)}</h3><p>Next action: ${esc(hold.owner)} · Review ${esc(hold.reviewDate)}</p></div><button class="text-btn" data-action="resolve-hold">Resolve</button></section>`;
}

function milestones(request) {
  return `<section><span class="eyebrow">Milestones</span><div class="milestones">${request.milestones.map((m, index) => `<button data-milestone="${state.remote ? m.id : index}" class="${m.done || m.completed_at ? "done" : ""}"><span>${m.done || m.completed_at ? "✓" : index + 1}</span>${esc(m.title)}</button>`).join("")}</div>${request.status !== "completed" ? `<button class="text-btn" data-action="hold">Add dependency hold</button>` : `<button class="text-btn" data-action="review">Leave contextual feedback</button>`}</section>`;
}

function evidenceSection(request) {
  return `<section><div class="section-title"><div><span class="eyebrow">Proof of work</span><h2>Evidence tied to this agreement</h2></div></div><div class="evidence-grid">${(request.evidence || []).map((item) => `<article>${item.url ? `<img src="${esc(item.url)}" alt="${esc(item.description)}">` : ""}<div><b>${esc(item.skill)}</b><p>${esc(item.description)}</p><small>${item.verified_at ? "Verified by a participant" : "Participant evidence"}</small></div></article>`).join("") || `<p>No evidence has been added yet.</p>`}</div>${state.remote ? `<form data-form="evidence" data-agreement="${request.agreement.id}" class="form-grid evidence-form"><label>Skill demonstrated<input name="skill" required maxlength="100" placeholder="Carpentry"></label><label>Photo<input name="photo" type="file" required accept="image/jpeg,image/png,image/webp"></label><label class="wide">What does this show?<input name="description" required maxlength="500" placeholder="Installed shelving after final leveling"></label><button class="secondary wide">Add private project evidence</button></form>` : ""}</section>`;
}

function renderWorkspace() {
  const active = state.requests.filter((r) => r.status !== "open");
  const posted = state.requests.filter((r) => r.ownerId === "me");
  return shell(`<div class="section-title"><div><span class="eyebrow">My work</span><h1>Keep every commitment visible.</h1></div><button class="primary" data-action="post">Post work</button></div>
    <div class="stats"><div><b>${active.length}</b><span>Active agreements</span></div><div><b>${active.filter((r) => r.hold).length}</b><span>Dependency holds</span></div><div><b>${posted.length}</b><span>Requests posted</span></div><div><b>4</b><span>Skills verified</span></div></div>
    <div class="workspace-grid"><section><h2>In progress</h2>${active.map((r) => `<article class="work-row" data-open="${r.id}" tabindex="0"><span class="category">${r.category}</span><div><h3>${esc(r.title)}</h3><p>${r.agreement ? esc(r.agreement.summary) : "Agreement active"}</p></div><div class="row-progress"><b>${r.agreement?.progress || 0}%</b><span>${r.hold ? `Held: ${esc(r.hold.type)}` : "Moving forward"}</span></div></article>`).join("") || `<div class="empty">No active work yet.</div>`}</section>
    <aside class="activity"><span class="eyebrow">Exchange ledger</span><h2>What you contribute matters.</h2><div><b>14h</b><span>Practical help given</span></div><div><b>3</b><span>People helped</span></div><div><b>2</b><span>Barter agreements</span></div><p>This is contribution history—not currency, debt, or a social score.</p></aside></div>`, "Personal workspace");
}

function renderNetwork() {
  return shell(`<section class="network-hero"><span class="eyebrow">Needs + offers</span><h1>The useful things around us<br>are closer than we think.</h1><p>Find reciprocal matches between what people need and what their neighbors can offer.</p></section>
    <div class="match-card"><div><span class="match-label">Potential three-way trade</span><h2>A chain no one could complete alone</h2><p>You offer product photography to Maya. Maya offers a produce share to Sam. Sam offers carpentry for your workshop shelving.</p><div class="trade-chain"><span>You<small>Photography</small></span><i>→</i><span>Maya<small>Produce</small></span><i>→</i><span>Sam<small>Carpentry</small></span><i>→</i><span>You</span></div></div><button class="secondary" data-action="interest">I’m interested</button></div>
    <div class="two-col"><section><span class="eyebrow">People nearby</span><h2>Built on demonstrated capability</h2>${peopleCards()}</section><section><span class="eyebrow">Community circles</span><h2>Start with people you trust</h2>${circleCard("circle-makers","Richmond Makers","128 members · 34 skills","Fabrication, electronics, woodworking, and shared shop access.")}${circleCard("circle-neighbors","Manchester Neighbors","76 members · 19 active needs","Local maintenance, gardens, tools, and mutual aid.")}</section></div>`, "Community network");
}

function circleCard(id, name, meta, description) {
  const joined = state.profile.joinedCircles?.includes(id);
  return `<div class="circle"><b>${name}</b><span>${meta}</span><p>${description}</p><button class="secondary" data-circle="${id}">${joined ? "Joined" : "Join circle"}</button></div>`;
}

function peopleCards() {
  return [{ id: "sam", name: "Sam Rivera", initials: "SR", offers: "Carpentry · Site work", needs: "Photography · Bookkeeping", proof: 18 }, { id: "asha", name: "Asha Patel", initials: "AP", offers: "Electronics · Diagnostics", needs: "Studio shelving", proof: 27 }].map((p) => `<article class="person-card"><span class="avatar big">${p.initials}</span><div><h3>${p.name}</h3><p><b>Offers:</b> ${p.offers}</p><p><b>Needs:</b> ${p.needs}</p><small>${p.proof} verified work records</small><button class="text-btn" data-follow-person="${p.id}">${state.profile.following?.includes(p.id) ? "Following" : "Follow"}</button></div></article>`).join("");
}

function renderProfile() {
  const p = state.profile;
  return shell(`<section class="profile-head"><span class="avatar giant">${p.initials}</span><div><span class="eyebrow">Your WorkTrade profile</span><h1>${esc(p.name)}</h1><p>${esc(p.bio)}</p><small>${esc(p.location)}</small></div><button class="secondary profile-edit" data-action="edit-profile">Edit profile</button></section>
    <div class="two-col"><section class="list-panel"><span class="eyebrow">I can offer</span><h2>Skills, goods, and access</h2><div class="editable-list">${p.offers.map((x, i) => `<span>${esc(x)}<button data-remove="offers:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="offers" class="inline-form"><input name="item" required placeholder="Add something you can offer"><button class="secondary">Add</button></form></section>
    <section class="list-panel warm"><span class="eyebrow">I need</span><h2>Things that could move you forward</h2><div class="editable-list">${p.needs.map((x, i) => `<span>${esc(x)}<button data-remove="needs:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="needs" class="inline-form"><input name="item" required placeholder="Add something you need"><button class="secondary">Add</button></form></section></div>
    <section class="proof"><span class="eyebrow">Proof of work</span><h2>A reputation grounded in real outcomes.</h2><div class="proof-grid"><div><b>Storefront deck restoration</b><span>Carpentry · Exterior finishing</span><p>Verified by Nia Brooks</p></div><div><b>Product launch photography</b><span>Photography · Art direction</span><p>Verified by Maya Chen</p></div></div>${backendConfigured ? `<div class="account-panel" id="account-panel"><p>Checking account…</p></div>` : `<div class="account-panel"><b>Device-local demonstration</b><p>Real accounts become available when this installation is connected to its own Supabase project.</p></div>`}<button class="danger-text" data-action="reset">Reset demo data</button></section>`, "Profile and capabilities");
}

function render() {
  document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("active", b.dataset.nav === state.view));
  if (state.view === "detail") main.innerHTML = renderDetail(state.requests.find((r) => r.id === state.selectedId));
  else if (state.view === "workspace") main.innerHTML = renderWorkspace();
  else if (state.view === "network") main.innerHTML = renderNetwork();
  else if (state.view === "profile") main.innerHTML = renderProfile();
  else main.innerHTML = renderDiscover();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function openModal(content) { modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true">${content}<button class="modal-x" data-modal-close aria-label="Close">×</button></section></div>`; setTimeout(() => modalRoot.querySelector("input, select, textarea")?.focus(), 0); }
function closeModal() { modalRoot.innerHTML = ""; }

function postModal() {
  openModal(`<span class="eyebrow">New work request</span><h2>What outcome do you need?</h2><p>Describe the work, then decide what kinds of value you are open to exchanging.</p><form data-form="post" class="form-grid">
    <label class="wide">Title<input name="title" required placeholder="Build workshop storage shelves"></label><label>Type<select name="category">${categories.slice(1).map((c) => `<option>${c}</option>`).join("")}</select></label><label>Location<input name="location" required value="Richmond, VA"></label>
    <label class="wide">Desired outcome<textarea name="description" required placeholder="Describe the result, current conditions, and useful constraints."></textarea></label><label>Skills, comma separated<input name="skills" required placeholder="Carpentry, design"></label><label>Cash budget<input name="budget" type="number" min="0" placeholder="Optional"></label>
    <fieldset class="wide"><legend>Exchange options</legend><label><input type="checkbox" name="exchange" value="cash"> Cash</label><label><input type="checkbox" name="exchange" value="barter" checked> Barter</label><label><input type="checkbox" name="exchange" value="hybrid" checked> Cash + barter</label></fieldset>
    <label class="wide">What can you offer?<input name="returns" required placeholder="Web design, lumber, cash"></label><button class="primary wide">Publish request</button></form>`);
}

function offerModal(id) {
  openModal(`<span class="eyebrow">Trade proposal</span><h2>Make the exchange clear.</h2><p>Describe both sides. A good proposal values scope, risk, materials, and time without forcing everything into cash.</p><form data-form="offer" data-id="${id}" class="form-grid">
    <label>Exchange<select name="mode"><option value="hybrid">Cash + barter</option><option value="barter">Barter</option><option value="cash">Cash</option></select></label><label>Cash component<input name="cash" type="number" min="0" placeholder="0"></label>
    <label class="wide">What will you provide?<textarea name="gives" required placeholder="Scope, deliverables, materials, and exclusions"></textarea></label><label class="wide">What would you receive?<input name="wants" required placeholder="$400 plus bookkeeping help"></label><label>Expected duration<input name="duration" required placeholder="Two weekends"></label><label>Note<input name="note" placeholder="Relevant experience or constraints"></label><button class="primary wide">Send proposal</button></form>`);
}

function holdModal(id) {
  openModal(`<span class="eyebrow">Dependency hold</span><h2>What does the work depend on?</h2><form data-form="hold" data-id="${id}" class="form-grid"><label>Type<select name="type"><option>Materials</option><option>Equipment</option><option>Weather</option><option>Access or permission</option><option>Customer decision</option><option>Specialist</option><option>Third party</option><option>Custom</option></select></label><label>Next action owner<input name="owner" required placeholder="Customer, provider, conditions…"></label><label class="wide">What is needed?<input name="detail" required placeholder="A dry 48-hour weather window"></label><label>Review date<input name="reviewDate" type="date" required></label><button class="primary wide">Place hold</button></form>`);
}

function reportModal(id) {
  openModal(`<span class="eyebrow">Safety report</span><h2>Tell moderators what happened.</h2><p>Reports are private. Immediate danger should be reported to local emergency services.</p><form data-form="report" data-id="${id}" class="form-grid"><label>Concern<select name="reason"><option>Unsafe work or conditions</option><option>Fraud or misrepresentation</option><option>Harassment</option><option>Regulated or prohibited work</option><option>Spam</option><option>Other</option></select></label><label class="wide">Details<textarea name="detail" required maxlength="2000"></textarea></label><button class="primary wide">Submit private report</button></form>`);
}

function reviewModal(request) {
  const agreement = request.agreement;
  const subjectId = agreement.parties.find((id) => id !== state.profile.id);
  openModal(`<span class="eyebrow">Completion feedback</span><h2>Review this specific exchange.</h2><form data-form="review" data-agreement="${agreement.id}" data-subject="${subjectId}" class="form-grid">${["reliability","communication","work_quality","exchange_fairness"].map((name) => `<label>${name.replaceAll("_"," ")}<select name="${name}">${[5,4,3,2,1].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>`).join("")}<label class="wide">What should future collaborators know?<textarea name="body" maxlength="2000"></textarea></label><button class="primary wide">Publish contextual review</button></form>`);
}

function signInModal() {
  openModal(`<span class="eyebrow">Sign in</span><h2>Use a secure email link.</h2><p>No password is stored by WorkTrade. We will send a one-time sign-in link.</p><form data-form="sign-in" class="form-grid"><label class="wide">Email<input name="email" type="email" autocomplete="email" required></label><button class="primary wide">Send sign-in link</button></form>`);
}

function editRequestModal(request) {
  openModal(`<span class="eyebrow">Edit work request</span><h2>Update the desired outcome.</h2><p>Once a proposal is selected, the request is frozen and changes belong in a mutually confirmed agreement amendment.</p><form data-form="edit-request" data-id="${request.id}" data-version="${request.version}" class="form-grid"><label class="wide">Title<input name="title" required value="${esc(request.title)}"></label><label>Type<select name="category">${categories.slice(1).map((c) => `<option ${c === request.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Location<input name="location" value="${esc(request.location)}"></label><label class="wide">Desired outcome<textarea name="description" required>${esc(request.description)}</textarea></label><label>Skills<input name="skills" value="${esc(request.skills.join(", "))}"></label><label>Cash budget<input name="budget" type="number" min="0" value="${request.cashBudget || ""}"></label><label class="wide">Timing<input name="urgency" value="${esc(request.urgency)}"></label><button class="primary wide">Save changes</button></form>`);
}

function notificationsModal() {
  const unread = state.notifications.filter((item) => !item.read_at);
  openModal(`<span class="eyebrow">Notifications</span><div class="section-title"><h2>What changed</h2>${unread.length ? `<button class="text-btn" data-action="read-all">Mark all read</button>` : ""}</div><div class="notification-list">${state.notifications.map((item) => `<button data-notification="${item.id}" data-request="${item.request_id || ""}" class="${item.read_at ? "" : "unread"}"><span>${esc(item.kind)}</span><b>${esc(item.title)}</b><p>${esc(item.body)}</p><small>${new Date(item.created_at).toLocaleString()}</small></button>`).join("") || `<p>No notifications yet.</p>`}</div>`);
}

function preferencesModal() {
  const p = state.notificationPreferences || {};
  openModal(`<span class="eyebrow">Notification preferences</span><h2>Choose what reaches you.</h2><p>Email delivery is queued for future activation; these preferences are already stored and will be honored.</p><form data-form="preferences" class="preference-form">${[["in_app","In-app notifications"],["email_proposals","Proposal emails"],["email_messages","Message emails"],["email_agreements","Agreement emails"],["email_reminders","Reminder emails"]].map(([name,label]) => `<label><span>${label}</span><input type="checkbox" name="${name}" ${p[name] ? "checked" : ""}></label>`).join("")}<button class="primary">Save preferences</button></form>`);
}

function profileModal() {
  const profile = state.profile;
  openModal(`<span class="eyebrow">Public profile</span><h2>Introduce the person behind the work.</h2><form data-form="profile" class="form-grid"><label class="wide">Display name<input name="display_name" required minlength="2" maxlength="80" value="${esc(profile.name)}"></label><label class="wide">General location<input name="location_text" maxlength="120" value="${esc(profile.location)}" placeholder="Richmond, VA"></label><label class="wide">Short biography<textarea name="bio" maxlength="500">${esc(profile.bio)}</textarea></label><button class="primary wide">Save profile</button></form>`);
}

function deactivateModal() {
  openModal(`<span class="eyebrow">Deactivate account</span><h2>Remove your public presence.</h2><p>Open requests will be cancelled, pending proposals withdrawn, and profile details replaced. Completed agreement history remains pseudonymous for the other participant. Active agreements must be resolved first.</p><form data-form="deactivate" class="form-grid"><label class="wide">Type DEACTIVATE to confirm<input name="confirmation" required pattern="DEACTIVATE"></label><button class="primary wide">Deactivate and sign out</button></form>`);
}

function downloadExport(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `worktrade-export-${new Date().toISOString().slice(0,10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]"); if (nav) { state.view = nav.dataset.nav; state.selectedId = null; return; }
  const card = event.target.closest("[data-open]"); if (card) { state.selectedId = card.dataset.open; state.view = "detail"; return; }
  const category = event.target.closest("[data-category]"); if (category) { state.category = category.dataset.category; return; }
  if (event.target.closest("[data-modal-close]") || event.target === modalRoot.querySelector("[data-modal-backdrop]")) closeModal();
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "post") postModal();
  if (action === "offer") offerModal(event.target.closest("[data-id]").dataset.id);
  if (action === "interest") notify("Interest noted — introductions are next on the roadmap.");
  if (action === "hold") holdModal(state.selectedId);
  if (action === "review") reviewModal(state.requests.find((x) => x.id === state.selectedId));
  if (action === "follow") { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.followers ||= []; r.followers = r.followers.includes("me") ? r.followers.filter((id) => id !== "me") : [...r.followers, "me"]; return list; }); notify("Project follow updated"); }
  if (action === "report") reportModal(state.selectedId);
  if (action === "block") { const person = event.target.closest("[data-person]").dataset.person; const profile = structuredClone(state.profile); profile.blocked ||= []; if (!profile.blocked.includes(person)) profile.blocked.push(person); state.profile = profile; persist(); state.view = "discover"; notify("User blocked on this device"); }
  if (action === "resolve-hold") { const request = state.requests.find((x) => x.id === state.selectedId); if (state.remote) performAgreementAction("resolve_hold", request.agreement.id, request.agreement.version, { hold_id: request.hold.id }).then(loadRemoteWorkspace).then(() => notify("Dependency resolved")).catch((error) => notify(error.message)); else { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.hold = null; r.updates.push({ id: crypto.randomUUID(), author: state.profile.name, text: "Resolved the dependency hold. Work can move forward.", date: "Today" }); return list; }); notify("Dependency resolved"); } }
  if (action === "reset") { localStorage.removeItem(STORAGE_KEY); const seed = cloneSeed(); store.batch(() => { state.profile = seed.profile; state.requests = seed.requests; }); notify("Demo data reset"); }
  if (action === "sign-in") signInModal();
  if (action === "edit-profile") profileModal();
  if (action === "edit-request") editRequestModal(state.requests.find((item) => item.id === state.selectedId));
  if (action === "notifications") notificationsModal();
  if (action === "notification-preferences") preferencesModal();
  if (action === "read-all") markNotificationsRead().then(loadNotifications).then(notificationsModal).catch((error) => notify(error.message));
  if (action === "export-data") exportMyData().then(downloadExport).then(() => notify("Your data export is ready")).catch((error) => notify(error.message));
  if (action === "deactivate") deactivateModal();
  if (action === "sign-out") signOut().then(() => { const seed = cloneSeed(); store.batch(() => { state.session = null; state.remote = false; state.profile = seed.profile; state.requests = seed.requests; }); notify("Signed out — showing the device demo"); }).catch((error) => notify(error.message));
  const accept = event.target.closest("[data-accept]"); if (accept) { if (state.remote) acceptOffer(accept.dataset.accept).then(loadRemoteWorkspace).then(() => notify("Proposal selected — awaiting mutual confirmation")).catch((error) => notify(error.message)); else { updateRequests((list) => { const r = list.find((x) => x.id === accept.dataset.request); const o = r.offers.find((x) => x.id === accept.dataset.accept); r.agreement = { ...proposeAgreement({ offer: o, request: r, requesterId: r.ownerId, providerId: o.provider === state.profile.name ? "me" : `provider:${o.id}` }), provider: o.provider, progress: 0 }; r.agreement = confirmAgreement(r.agreement, r.ownerId); r.status = "proposed"; r.milestones = [{ title: "Confirm scope", done: false }, { title: "Prepare inputs", done: false }, { title: "Complete work", done: false }, { title: "Review exchange", done: false }]; r.updates.push({ id: crypto.randomUUID(), author: r.owner, text: `Selected ${o.provider}'s proposal. Both parties must confirm before work starts.`, date: "Today" }); return list; }); notify("Proposal selected — awaiting mutual confirmation"); } }
  const agreementAction = event.target.closest("[data-agreement]")?.dataset.agreement;
  if (agreementAction) { const request = state.requests.find((x) => x.id === state.selectedId); if (state.remote) performAgreementAction(agreementAction, request.agreement.id, request.agreement.version).then(loadRemoteWorkspace).then(() => notify(agreementAction === "confirm" ? "Terms confirmed" : `Agreement moved to ${agreementAction}`)).catch((error) => notify(error.message)); else { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); if (agreementAction === "confirm") r.agreement = confirmAgreement(r.agreement, "me"); else r.agreement = transitionAgreement(r.agreement, agreementAction, "me"); r.status = r.agreement.status; r.updates.push({ id: crypto.randomUUID(), author: state.profile.name, text: agreementAction === "confirm" ? "Confirmed the current agreement terms." : `Moved the agreement to ${agreementAction}.`, date: "Today" }); return list; }); notify(agreementAction === "confirm" ? "Terms confirmed" : `Agreement moved to ${agreementAction}`); } }
  const milestone = event.target.closest("[data-milestone]"); if (milestone) { const request = state.requests.find((x) => x.id === state.selectedId); if (state.remote) performAgreementAction("milestone", request.agreement.id, request.agreement.version, { milestone_id: milestone.dataset.milestone }).then(loadRemoteWorkspace).catch((error) => notify(error.message)); else updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.milestones[Number(milestone.dataset.milestone)].done = !r.milestones[Number(milestone.dataset.milestone)].done; const done = r.milestones.filter((m) => m.done).length; r.agreement.progress = Math.round(done / r.milestones.length * 100); if (done === r.milestones.length) r.status = "completed"; return list; }); }
  const obligation = event.target.closest("[data-obligation]"); if (obligation) { const [kind, id] = obligation.dataset.obligation.split(":"); const request = state.requests.find((x) => x.id === state.selectedId); performAgreementAction(kind, request.agreement.id, request.agreement.version, { obligation_id: id }).then(loadRemoteWorkspace).then(() => notify(kind === "fulfill" ? "Fulfillment submitted" : "Fulfillment approved")).catch((error) => notify(error.message)); }
  const remove = event.target.closest("[data-remove]"); if (remove) { const [list, index] = remove.dataset.remove.split(":"); const profile = structuredClone(state.profile); profile[list].splice(Number(index), 1); if (state.remote) updateMyProfile({ display_name: profile.name, location_text: profile.location, bio: profile.bio, needs: profile.needs, offers: profile.offers }).then(() => { state.profile = profile; notify("Profile updated"); }).catch((error) => notify(error.message)); else { state.profile = profile; persist(); } }
  const followPerson = event.target.closest("[data-follow-person]"); if (followPerson) { const profile = structuredClone(state.profile); profile.following ||= []; profile.following = profile.following.includes(followPerson.dataset.followPerson) ? profile.following.filter((id) => id !== followPerson.dataset.followPerson) : [...profile.following, followPerson.dataset.followPerson]; state.profile = profile; persist(); notify("Following updated"); }
  const circle = event.target.closest("[data-circle]"); if (circle) { const profile = structuredClone(state.profile); profile.joinedCircles ||= []; profile.joinedCircles = profile.joinedCircles.includes(circle.dataset.circle) ? profile.joinedCircles.filter((id) => id !== circle.dataset.circle) : [...profile.joinedCircles, circle.dataset.circle]; state.profile = profile; persist(); notify("Circle membership updated"); }
  const requestAction = event.target.closest("[data-request-action]"); if (requestAction) { const request = state.requests.find((item) => item.id === state.selectedId); if (confirm(`${requestAction.dataset.requestAction[0].toUpperCase() + requestAction.dataset.requestAction.slice(1)} this request?`)) closeRequest(request.id, request.version, requestAction.dataset.requestAction).then(async () => { state.view="workspace"; await loadRemoteWorkspace(); notify("Request updated"); }).catch((error) => notify(error.message)); }
  const notification = event.target.closest("[data-notification]"); if (notification) { markNotificationsRead([notification.dataset.notification]).then(loadNotifications); closeModal(); if (notification.dataset.request) { state.selectedId=notification.dataset.request; state.view="detail"; } }
});

document.addEventListener("input", (event) => { if (event.target.id === "search") { state.query = event.target.value; } });
document.addEventListener("keydown", (event) => { const card = event.target.closest("[data-open]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); card.click(); } if (event.key === "Escape") closeModal(); });
document.addEventListener("submit", async (event) => {
  const form = event.target; if (!form.dataset.form) return; event.preventDefault(); const data = new FormData(form);
  if (form.dataset.form === "post") {
    const exchanges = data.getAll("exchange"); if (!exchanges.length) return notify("Choose at least one exchange option.");
    const request = { id: crypto.randomUUID(), ownerId: "me", owner: state.profile.name, initials: state.profile.initials, title: data.get("title"), category: data.get("category"), location: data.get("location"), distance: 0, urgency: "Flexible", status: "open", description: data.get("description"), skills: data.get("skills").split(",").map((x) => x.trim()).filter(Boolean), exchange: exchanges, cashBudget: Number(data.get("budget")) || 0, offersInReturn: data.get("returns").split(",").map((x) => x.trim()).filter(Boolean), createdAt: new Date().toISOString().slice(0, 10), offers: [], updates: [] };
    if (state.remote) {
      try {
        await createRemoteRequest({ title: request.title, description: request.description, kind: request.category.toLowerCase(), location: request.location, urgency: request.urgency, cash_budget_cents: request.cashBudget * 100, visibility: "public", skills: request.skills });
        closeModal(); await loadRemoteWorkspace(); state.view = "discover"; notify("Work request published to the community");
      } catch (error) { notify(error.message); }
    } else { updateRequests((list) => [request, ...list]); closeModal(); state.selectedId = request.id; state.view = "detail"; notify("Work request published on this device"); }
  }
  if (form.dataset.form === "offer") { if (state.remote) { try { await submitOffer(form.dataset.id, { mode: data.get("mode"), scope: data.get("gives"), exchange_summary: data.get("wants"), duration: data.get("duration"), note: data.get("note") }); closeModal(); await loadRemoteWorkspace(); notify("Trade proposal sent"); } catch (error) { notify(error.message); } } else { updateRequests((list) => { const r = list.find((x) => x.id === form.dataset.id); r.offers.push({ id: crypto.randomUUID(), provider: state.profile.name, initials: state.profile.initials, mode: data.get("mode"), cash: Number(data.get("cash")) || 0, gives: data.get("gives"), wants: data.get("wants"), duration: data.get("duration"), note: data.get("note") }); return list; }); closeModal(); notify("Trade proposal sent"); } }
  if (form.dataset.form === "hold") { const request = state.requests.find((x) => x.id === form.dataset.id); if (state.remote) { try { await performAgreementAction("hold", request.agreement.id, request.agreement.version, { kind: data.get("type").toLowerCase().replaceAll(" ", "_").replace("_or_", "_"), owner: data.get("owner"), detail: data.get("detail"), review_at: data.get("reviewDate") }); closeModal(); await loadRemoteWorkspace(); notify("Dependency hold added"); } catch (error) { notify(error.message); } } else { updateRequests((list) => { const r = list.find((x) => x.id === form.dataset.id); r.hold = { type: data.get("type"), owner: data.get("owner"), detail: data.get("detail"), reviewDate: data.get("reviewDate") }; return list; }); closeModal(); notify("Dependency hold added"); } }
  if (form.dataset.form === "update") { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.updates.push({ id: crypto.randomUUID(), author: state.profile.name, text: data.get("text"), date: "Today" }); return list; }); form.reset(); notify("Update posted"); }
  if (form.dataset.form === "message") { if (state.remote) { try { await sendProjectMessage(state.selectedId, data.get("text")); form.reset(); await loadRemoteWorkspace(); notify("Message sent"); } catch (error) { notify(error.message); } } else { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.messages ||= []; r.messages.push({ id: crypto.randomUUID(), authorId: "me", author: state.profile.name, text: data.get("text"), date: "Today" }); return list; }); form.reset(); notify("Message sent"); } }
  if (form.dataset.form === "report") { updateRequests((list) => { const r = list.find((x) => x.id === form.dataset.id); r.reports ||= []; r.reports.push({ id: crypto.randomUUID(), reporterId: "me", reason: data.get("reason"), detail: data.get("detail"), status: "submitted", createdAt: new Date().toISOString() }); return list; }); closeModal(); notify("Private report recorded for moderator review"); }
  if (form.dataset.form === "profile-item") { const profile = structuredClone(state.profile); profile[form.dataset.list].push(data.get("item")); if (state.remote) { try { await updateMyProfile({ display_name: profile.name, location_text: profile.location, bio: profile.bio, needs: profile.needs, offers: profile.offers }); state.profile = profile; form.reset(); notify("Profile updated"); } catch (error) { notify(error.message); } } else { state.profile = profile; persist(); form.reset(); notify("Profile updated"); } }
  if (form.dataset.form === "review") { try { await submitReview({ agreement_id: form.dataset.agreement, subject_id: form.dataset.subject, reliability: Number(data.get("reliability")), communication: Number(data.get("communication")), work_quality: Number(data.get("work_quality")), exchange_fairness: Number(data.get("exchange_fairness")), body: data.get("body") }); closeModal(); notify("Contextual review published"); } catch (error) { notify(error.message); } }
  if (form.dataset.form === "evidence") { const file = form.elements.photo.files[0]; if (!file || file.size > 10485760) return notify("Choose a JPG, PNG, or WebP under 10 MB."); try { await uploadWorkEvidence(form.dataset.agreement, file, { skill: data.get("skill"), description: data.get("description") }); form.reset(); await loadRemoteWorkspace(); notify("Work evidence added"); } catch (error) { notify(error.message); } }
  if (form.dataset.form === "sign-in") { signInWithEmail(data.get("email")).then(() => { closeModal(); notify("Check your email for the secure link"); }).catch((error) => notify(error.message)); }
  if (form.dataset.form === "profile") { const profile = { ...structuredClone(state.profile), name: data.get("display_name"), location: data.get("location_text"), bio: data.get("bio") }; try { if (state.remote) await updateMyProfile({ display_name: profile.name, location_text: profile.location, bio: profile.bio, needs: profile.needs, offers: profile.offers }); state.profile = profile; if (!state.remote) persist(); closeModal(); notify("Profile saved"); } catch (error) { notify(error.message); } }
  if (form.dataset.form === "edit-request") { try { await updateRequest(form.dataset.id, Number(form.dataset.version), { title:data.get("title"), description:data.get("description"), kind:data.get("category").toLowerCase(), location:data.get("location"), urgency:data.get("urgency"), cash_budget_cents:(Number(data.get("budget"))||0)*100, skills:data.get("skills").split(",").map((x)=>x.trim()).filter(Boolean) }); closeModal(); await loadRemoteWorkspace(); notify("Request updated with history preserved"); } catch(error) { notify(error.message); } }
  if (form.dataset.form === "preferences") { try { state.notificationPreferences = await saveNotificationPreferences({ in_app:data.has("in_app"), email_proposals:data.has("email_proposals"), email_messages:data.has("email_messages"), email_agreements:data.has("email_agreements"), email_reminders:data.has("email_reminders") }); closeModal(); notify("Notification preferences saved"); } catch(error) { notify(error.message); } }
  if (form.dataset.form === "deactivate") { try { await deactivateMyAccount(); const seed=cloneSeed(); store.batch(()=>{state.session=null;state.remote=false;state.profile=seed.profile;state.requests=seed.requests;state.notifications=[];}); closeModal(); notify("Account deactivated; showing device demo"); } catch(error) { notify(error.message); } }
});

store.subscribe(render, true);
document.querySelector("#mode-badge").textContent = backendConfigured ? "Connected" : "Demo mode";

function mapRemoteRequest(request) {
  const name = request.profiles?.display_name || "WorkTrade member";
  return { id: request.id, version: request.version, ownerId: request.owner_id, owner: name, initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), title: request.title, category: request.kind[0].toUpperCase() + request.kind.slice(1), location: request.location_text || "Location shared privately", distance: "—", urgency: request.urgency_text || "Flexible", status: request.stage, description: request.description, skills: (request.work_request_skills || []).map((item) => item.skill), exchange: ["cash", "barter", "hybrid"], cashBudget: request.cash_budget_cents ? Math.round(request.cash_budget_cents / 100) : 0, offersInReturn: ["Open to a fair proposal"], createdAt: request.created_at, offers: [], updates: [], messages: [], followers: [], reports: [] };
}

async function loadRemoteWorkspace() {
  const [profile, requests, agreementRows] = await Promise.all([getMyProfile(), listPublicRequests(), getMyAgreements()]);
  if (!profile) return;
  const capabilities = profile.capabilities || [];
  const mapped = requests.map(mapRemoteRequest);
  for (const row of agreementRows) {
    let request = mapped.find((item) => item.id === row.request.id);
    if (!request) { request = mapRemoteRequest({ ...row.request, profiles: { display_name: row.request.owner_id === profile.id ? profile.display_name : "Trade partner" }, work_request_skills: [] }); mapped.push(request); }
    const done = row.milestones.filter((item) => item.completed_at).length;
    request.status = row.agreement.status;
    request.milestones = row.milestones;
    request.hold = row.holds.find((item) => !item.resolved_at) ? (() => { const hold = row.holds.find((item) => !item.resolved_at); return { id: hold.id, type: hold.kind.replaceAll("_", " "), detail: hold.detail, owner: hold.action_owner_text || "Participant", reviewDate: hold.review_at ? new Date(hold.review_at).toLocaleDateString() : "Not set" }; })() : null;
    request.agreement = { ...row.agreement, parties: [row.agreement.requester_id, row.agreement.provider_id], confirmations: [row.agreement.confirmed_by_requester_at ? row.agreement.requester_id : null, row.agreement.confirmed_by_provider_at ? row.agreement.provider_id : null].filter(Boolean), provider: row.agreement.provider_id === profile.id ? profile.display_name : "Trade partner", exchange: row.agreement.exchange_snapshot, progress: row.milestones.length ? Math.round(done / row.milestones.length * 100) : 0, obligations: row.obligations };
    request.evidence = await Promise.all((row.evidence || []).map(async (item) => ({ ...item, url: item.asset_path ? await getEvidenceUrl(item.asset_path) : null })));
    request.reviews = row.reviews || [];
  }
  const ownedOpen = mapped.filter((request) => request.ownerId === profile.id && request.status === "open");
  await Promise.all(ownedOpen.map(async (request) => { const offers = await getRequestOffers(request.id); request.offers = offers.map((offer) => ({ id: offer.id, provider: offer.profiles?.display_name || "WorkTrade member", initials: (offer.profiles?.display_name || "WM").split(/\s+/).map((x) => x[0]).join("").slice(0,2), mode: offer.mode, gives: offer.scope, wants: offer.exchange_summary, duration: offer.duration_text || "To be agreed", note: "" })); }));
  const participantRequests = mapped.filter((request) => request.agreement);
  await Promise.all(participantRequests.map(async (request) => { const messages = await getProjectMessages(request.id); request.messages = messages.map((message) => ({ id: message.id, authorId: message.author_id, author: message.profiles?.display_name || "Participant", text: message.body, date: new Date(message.created_at).toLocaleDateString() })); }));
  store.batch(() => {
    state.remote = true;
    state.profile = { id: profile.id, name: profile.display_name, initials: profile.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), location: profile.location_text || "", bio: profile.bio || "", needs: capabilities.filter((item) => item.direction === "need").map((item) => item.label), offers: capabilities.filter((item) => item.direction === "offer").map((item) => item.label), following: [], joinedCircles: [], blocked: [] };
    state.requests = mapped;
  });
}

async function loadNotifications() {
  if (!state.remote) return;
  state.notifications = await getNotifications();
  const badge=document.querySelector("#unread-count"); const count=state.notifications.filter((item)=>!item.read_at).length;
  if (badge) badge.textContent=count ? String(count) : "";
}

async function hydrateAccount() {
  if (!backendConfigured || state.view !== "profile") return;
  const panel = document.querySelector("#account-panel");
  if (!panel) return;
  try {
    const session = state.session || await getSession();
    panel.innerHTML = session ? `<b>${esc(session.user.email)}</b><p>Your session is encrypted and managed by Supabase Auth.</p><div class="account-actions"><button class="secondary" data-action="notification-preferences">Notifications</button><button class="secondary" data-action="export-data">Export my data</button><button class="secondary" data-action="sign-out">Sign out</button><button class="danger-text" data-action="deactivate">Deactivate account</button></div>` : `<b>Ready for a real account</b><p>Sign in with a secure email link.</p><button class="primary" data-action="sign-in">Sign in</button>`;
  } catch (error) { panel.innerHTML = `<p>Account service unavailable: ${esc(error.message)}</p>`; }
}

store.subscribe(() => queueMicrotask(hydrateAccount));

async function bootstrapBackend() {
  if (!backendConfigured) return;
  try {
    const session = await getSession();
    state.session = session;
    if (session) { await loadRemoteWorkspace(); state.notificationPreferences=await getNotificationPreferences(); await loadNotifications(); }
  } catch (error) { notify(`Connected service unavailable: ${error.message}`); }
}
bootstrapBackend();
