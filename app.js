import { createStore } from "./modules/store.js";
import { cloneSeed } from "./data.js";
import { confirmAgreement, proposeAgreement, transitionAgreement } from "./modules/agreements.js";
import { backendConfigured, getSession, signInWithEmail, signOut } from "./modules/backend.js";

const STORAGE_KEY = "worktrade:v1";
const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();
const initial = saved?.requests ? saved : cloneSeed();
const store = createStore({ view: "discover", query: "", category: "All", selectedId: null, profile: initial.profile, requests: initial.requests });
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
      <h1>${esc(request.title)}</h1><p class="lede">${esc(request.description)}</p>
      <div class="facts"><div><small>Location</small><b>${esc(request.location)}</b></div><div><small>Timing</small><b>${esc(request.urgency)}</b></div><div><small>Cash range</small><b>${money(request.cashBudget)}</b></div></div>
      <section><span class="eyebrow">Skills and capabilities</span><div class="tags large">${request.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></section>
      <section><span class="eyebrow">Value available in return</span><div class="value-list">${request.offersInReturn.map((item) => `<div><span>↔</span>${esc(item)}</div>`).join("")}</div></section>
      ${request.hold ? holdCard(request.hold) : ""}
      ${request.milestones ? milestones(request) : ""}
      <section><div class="section-title"><div><span class="eyebrow">Project journal</span><h2>Progress in the open</h2></div></div>
        <div class="timeline">${request.updates.map((u) => `<div><span class="dot"></span><p><b>${esc(u.author)}</b> ${esc(u.text)}<small>${esc(u.date)}</small></p></div>`).join("") || "<p>No updates yet.</p>"}</div>
        ${request.status !== "open" ? `<form data-form="update" class="inline-form"><input name="text" required placeholder="Share a progress update"><button class="secondary">Post</button></form>` : ""}
      </section>
      <section><div class="section-title"><div><span class="eyebrow">Conversation</span><h2>Keep decisions beside the work.</h2></div></div>
        <div class="messages">${(request.messages || []).map((m) => `<div class="message ${m.authorId === "me" ? "mine" : ""}"><b>${esc(m.author)}</b><p>${esc(m.text)}</p><small>${esc(m.date)}</small></div>`).join("") || `<p>No messages yet. Ask a clear, project-specific question.</p>`}</div>
        <form data-form="message" class="inline-form"><input name="text" required maxlength="1000" placeholder="Ask about scope, access, timing, or value"><button class="secondary">Send</button></form>
      </section>
    </article>
    <aside class="detail-side"><div class="person"><span class="avatar big">${request.initials}</span><div><small>Posted by</small><h3>${esc(request.owner)}</h3><p>${esc(request.location)}</p></div></div>
      ${request.agreement ? agreementCard(request) : `<button class="primary full" data-action="offer" data-id="${request.id}">Propose a trade</button>`}
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
  const confirmed = modern && agreement.confirmations.includes("me");
  const controls = modern ? agreementControls(agreement, confirmed) : "";
  return `<div class="agreement"><span class="eyebrow">${esc(agreement.status)} agreement${agreement.version ? ` · v${agreement.version}` : ""}</span><h3>${esc(agreement.provider || "Shared terms")}</h3><p>${esc(agreement.exchange || agreement.summary)}</p><div class="progress"><span style="width:${agreement.progress || 0}%"></span></div><small>${agreement.progress || 0}% of milestones complete</small>${controls}</div>`;
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
  return `<section><span class="eyebrow">Milestones</span><div class="milestones">${request.milestones.map((m, index) => `<button data-milestone="${index}" class="${m.done ? "done" : ""}"><span>${m.done ? "✓" : index + 1}</span>${esc(m.title)}</button>`).join("")}</div>${request.status !== "completed" ? `<button class="text-btn" data-action="hold">Add dependency hold</button>` : ""}</section>`;
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
  return shell(`<section class="profile-head"><span class="avatar giant">${p.initials}</span><div><span class="eyebrow">Your WorkTrade profile</span><h1>${esc(p.name)}</h1><p>${esc(p.bio)}</p><small>${esc(p.location)}</small></div></section>
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

function openModal(content) { modalRoot.innerHTML = `<div class="modal-backdrop" data-close><section class="modal" role="dialog" aria-modal="true">${content}<button class="modal-x" data-close aria-label="Close">×</button></section></div>`; setTimeout(() => modalRoot.querySelector("input, select, textarea")?.focus(), 0); }
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

function signInModal() {
  openModal(`<span class="eyebrow">Sign in</span><h2>Use a secure email link.</h2><p>No password is stored by WorkTrade. We will send a one-time sign-in link.</p><form data-form="sign-in" class="form-grid"><label class="wide">Email<input name="email" type="email" autocomplete="email" required></label><button class="primary wide">Send sign-in link</button></form>`);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]"); if (nav) { state.view = nav.dataset.nav; state.selectedId = null; return; }
  const card = event.target.closest("[data-open]"); if (card) { state.selectedId = card.dataset.open; state.view = "detail"; return; }
  const category = event.target.closest("[data-category]"); if (category) { state.category = category.dataset.category; return; }
  if (event.target.closest("[data-close]")) closeModal();
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "post") postModal();
  if (action === "offer") offerModal(event.target.closest("[data-id]").dataset.id);
  if (action === "interest") notify("Interest noted — introductions are next on the roadmap.");
  if (action === "hold") holdModal(state.selectedId);
  if (action === "follow") { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.followers ||= []; r.followers = r.followers.includes("me") ? r.followers.filter((id) => id !== "me") : [...r.followers, "me"]; return list; }); notify("Project follow updated"); }
  if (action === "report") reportModal(state.selectedId);
  if (action === "block") { const person = event.target.closest("[data-person]").dataset.person; const profile = structuredClone(state.profile); profile.blocked ||= []; if (!profile.blocked.includes(person)) profile.blocked.push(person); state.profile = profile; persist(); state.view = "discover"; notify("User blocked on this device"); }
  if (action === "resolve-hold") { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.hold = null; r.updates.push({ id: crypto.randomUUID(), author: state.profile.name, text: "Resolved the dependency hold. Work can move forward.", date: "Today" }); return list; }); notify("Dependency resolved"); }
  if (action === "reset") { localStorage.removeItem(STORAGE_KEY); const seed = cloneSeed(); store.batch(() => { state.profile = seed.profile; state.requests = seed.requests; }); notify("Demo data reset"); }
  if (action === "sign-in") signInModal();
  if (action === "sign-out") signOut().then(() => { notify("Signed out"); hydrateAccount(); }).catch((error) => notify(error.message));
  const accept = event.target.closest("[data-accept]"); if (accept) { updateRequests((list) => { const r = list.find((x) => x.id === accept.dataset.request); const o = r.offers.find((x) => x.id === accept.dataset.accept); r.agreement = { ...proposeAgreement({ offer: o, request: r, requesterId: r.ownerId, providerId: o.provider === state.profile.name ? "me" : `provider:${o.id}` }), provider: o.provider, progress: 0 }; r.agreement = confirmAgreement(r.agreement, r.ownerId); r.status = "proposed"; r.milestones = [{ title: "Confirm scope", done: false }, { title: "Prepare inputs", done: false }, { title: "Complete work", done: false }, { title: "Review exchange", done: false }]; r.updates.push({ id: crypto.randomUUID(), author: r.owner, text: `Selected ${o.provider}'s proposal. Both parties must confirm before work starts.`, date: "Today" }); return list; }); notify("Proposal selected — awaiting mutual confirmation"); }
  const agreementAction = event.target.closest("[data-agreement]")?.dataset.agreement;
  if (agreementAction) { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); if (agreementAction === "confirm") r.agreement = confirmAgreement(r.agreement, "me"); else r.agreement = transitionAgreement(r.agreement, agreementAction, "me"); r.status = r.agreement.status; r.updates.push({ id: crypto.randomUUID(), author: state.profile.name, text: agreementAction === "confirm" ? "Confirmed the current agreement terms." : `Moved the agreement to ${agreementAction}.`, date: "Today" }); return list; }); notify(agreementAction === "confirm" ? "Terms confirmed" : `Agreement moved to ${agreementAction}`); }
  const milestone = event.target.closest("[data-milestone]"); if (milestone) { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.milestones[Number(milestone.dataset.milestone)].done = !r.milestones[Number(milestone.dataset.milestone)].done; const done = r.milestones.filter((m) => m.done).length; r.agreement.progress = Math.round(done / r.milestones.length * 100); if (done === r.milestones.length) r.status = "completed"; return list; }); }
  const remove = event.target.closest("[data-remove]"); if (remove) { const [list, index] = remove.dataset.remove.split(":"); const profile = structuredClone(state.profile); profile[list].splice(Number(index), 1); state.profile = profile; persist(); }
  const followPerson = event.target.closest("[data-follow-person]"); if (followPerson) { const profile = structuredClone(state.profile); profile.following ||= []; profile.following = profile.following.includes(followPerson.dataset.followPerson) ? profile.following.filter((id) => id !== followPerson.dataset.followPerson) : [...profile.following, followPerson.dataset.followPerson]; state.profile = profile; persist(); notify("Following updated"); }
  const circle = event.target.closest("[data-circle]"); if (circle) { const profile = structuredClone(state.profile); profile.joinedCircles ||= []; profile.joinedCircles = profile.joinedCircles.includes(circle.dataset.circle) ? profile.joinedCircles.filter((id) => id !== circle.dataset.circle) : [...profile.joinedCircles, circle.dataset.circle]; state.profile = profile; persist(); notify("Circle membership updated"); }
});

document.addEventListener("input", (event) => { if (event.target.id === "search") { state.query = event.target.value; } });
document.addEventListener("keydown", (event) => { const card = event.target.closest("[data-open]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); card.click(); } if (event.key === "Escape") closeModal(); });
document.addEventListener("submit", (event) => {
  const form = event.target; if (!form.dataset.form) return; event.preventDefault(); const data = new FormData(form);
  if (form.dataset.form === "post") {
    const exchanges = data.getAll("exchange"); if (!exchanges.length) return notify("Choose at least one exchange option.");
    const request = { id: crypto.randomUUID(), ownerId: "me", owner: state.profile.name, initials: state.profile.initials, title: data.get("title"), category: data.get("category"), location: data.get("location"), distance: 0, urgency: "Flexible", status: "open", description: data.get("description"), skills: data.get("skills").split(",").map((x) => x.trim()).filter(Boolean), exchange: exchanges, cashBudget: Number(data.get("budget")) || 0, offersInReturn: data.get("returns").split(",").map((x) => x.trim()).filter(Boolean), createdAt: new Date().toISOString().slice(0, 10), offers: [], updates: [] };
    updateRequests((list) => [request, ...list]); closeModal(); state.selectedId = request.id; state.view = "detail"; notify("Work request published");
  }
  if (form.dataset.form === "offer") { updateRequests((list) => { const r = list.find((x) => x.id === form.dataset.id); r.offers.push({ id: crypto.randomUUID(), provider: state.profile.name, initials: state.profile.initials, mode: data.get("mode"), cash: Number(data.get("cash")) || 0, gives: data.get("gives"), wants: data.get("wants"), duration: data.get("duration"), note: data.get("note") }); return list; }); closeModal(); notify("Trade proposal sent"); }
  if (form.dataset.form === "hold") { updateRequests((list) => { const r = list.find((x) => x.id === form.dataset.id); r.hold = { type: data.get("type"), owner: data.get("owner"), detail: data.get("detail"), reviewDate: data.get("reviewDate") }; return list; }); closeModal(); notify("Dependency hold added"); }
  if (form.dataset.form === "update") { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.updates.push({ id: crypto.randomUUID(), author: state.profile.name, text: data.get("text"), date: "Today" }); return list; }); form.reset(); notify("Update posted"); }
  if (form.dataset.form === "message") { updateRequests((list) => { const r = list.find((x) => x.id === state.selectedId); r.messages ||= []; r.messages.push({ id: crypto.randomUUID(), authorId: "me", author: state.profile.name, text: data.get("text"), date: "Today" }); return list; }); form.reset(); notify("Message sent"); }
  if (form.dataset.form === "report") { updateRequests((list) => { const r = list.find((x) => x.id === form.dataset.id); r.reports ||= []; r.reports.push({ id: crypto.randomUUID(), reporterId: "me", reason: data.get("reason"), detail: data.get("detail"), status: "submitted", createdAt: new Date().toISOString() }); return list; }); closeModal(); notify("Private report recorded for moderator review"); }
  if (form.dataset.form === "profile-item") { const profile = structuredClone(state.profile); profile[form.dataset.list].push(data.get("item")); state.profile = profile; persist(); form.reset(); notify("Profile updated"); }
  if (form.dataset.form === "sign-in") { signInWithEmail(data.get("email")).then(() => { closeModal(); notify("Check your email for the secure link"); }).catch((error) => notify(error.message)); }
});

store.subscribe(render, true);
document.querySelector("#mode-badge").textContent = backendConfigured ? "Connected" : "Demo mode";

async function hydrateAccount() {
  if (!backendConfigured || state.view !== "profile") return;
  const panel = document.querySelector("#account-panel");
  if (!panel) return;
  try {
    const session = await getSession();
    panel.innerHTML = session ? `<b>${esc(session.user.email)}</b><p>Your session is encrypted and managed by Supabase Auth.</p><button class="secondary" data-action="sign-out">Sign out</button>` : `<b>Ready for a real account</b><p>Sign in with a secure email link.</p><button class="primary" data-action="sign-in">Sign in</button>`;
  } catch (error) { panel.innerHTML = `<p>Account service unavailable: ${esc(error.message)}</p>`; }
}

store.subscribe(() => queueMicrotask(hydrateAccount));
