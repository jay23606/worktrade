export function createWorkspaceFeature({ getState, shell, esc, conversationTime }) {
  const state = getState();
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
  
    return { renderWorkspace };
}

