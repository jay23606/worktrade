export function createProjectsFeature({ getState, shell, esc, money, modeLabel, recommendProfilesForRequest, notify }) {
  const state = getState();
  function renderDetail(request) {
    const isOwner = request.ownerId === "me" || request.ownerId === state.profile.id;
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
        ${request.agreement ? agreementCard(request) : isOwner ? `<div class="side-note"><b>Waiting for responses</b><p>Questions and offers will appear here. Compare the whole exchange before selecting formal terms.</p>${request.offers.length > 1 ? `<button class="secondary full" data-action="compare-offers">Compare offers</button>` : ""}</div>${projectRecommendations(request)}` : `<div class="contact-actions"><button class="primary full" data-action="offer" data-id="${request.id}">Offer to help</button><button class="secondary full" data-contact-person="${request.ownerId}" data-contact-request="${request.id}" data-contact-kind="question">Ask a question</button></div>`}
        <div class="side-note"><b>Choose your own exchange</b><p>Cash, goods, services, labor, access, or a combination. WorkTrade does not assign artificial credits.</p></div>
        <div class="safety-actions"><button class="text-btn" data-action="follow">${(request.followers || []).includes("me") ? "Following" : "Follow project"}</button><button class="text-btn" data-action="report">Report concern</button><button class="text-btn" data-action="block" data-person="${request.ownerId}">Block user</button></div>
        ${request.offers.length ? `<section class="proposals"><span class="eyebrow">Proposals</span>${request.offers.map((o) => offerCard(o, isOwner, request.id)).join("")}</section>` : ""}
      </aside></div>`,
      "Work request",
    );
  }
  
  function projectRecommendations(request) {
    if (!state.remote || request.status !== "open") return "";
    const recommendations = state.projectRecommendations[request.id];
    if (!recommendations) return `<section class="project-recommendations" aria-live="polite"><span class="eyebrow">Suggested collaborators</span><p>Finding people whose skills and exchange preferences fit…</p></section>`;
    return `<section class="project-recommendations"><div class="section-title"><div><span class="eyebrow">Suggested collaborators</span><h2>People who may fit this work</h2></div><span>${recommendations.length}</span></div>${recommendations.map((person) => `<article class="recommendation-card"><div class="recommendation-head"><span class="mini-avatar">${esc((person.display_name || "WT").split(/\s+/).map((part) => part[0]).join("").slice(0, 2))}</span><div><h3>${esc(person.display_name)}</h3><b>${Number(person.score)}% fit</b></div></div><p>${esc((person.reasons || []).join(" · ") || "Potential practical fit")}</p>${person.matched_skills?.length ? `<div class="tags">${person.matched_skills.map((skill) => `<span>${esc(skill)}</span>`).join("")}</div>` : ""}<small>${esc(person.availability_text || "Ask about availability")}${person.location_text ? ` · ${esc(person.location_text)}` : " · Location private"}</small><div class="recommendation-actions"><button class="primary compact" data-contact-person="${person.id}" data-contact-request="${request.id}">Message</button><button class="secondary compact" data-project-invite="${person.id}:${request.id}">Invite</button><button class="text-btn" data-save-person="${person.id}">${(state.networkInbox?.saved_profiles || []).includes(person.id) ? "Saved" : "Save"}</button><button class="text-btn" data-dismiss-recommendation="${person.id}:${request.id}">Dismiss</button></div></article>`).join("") || `<div class="empty compact"><b>No suggestions yet</b><p>Add specific skills, timing, and exchange options to improve recommendations.</p></div>`}</section>`;
  }
  
  async function loadProjectRecommendations(requestId) {
    if (!state.remote || !state.session || state.projectRecommendations[requestId]) return;
    try {
      const recommendations = await recommendProfilesForRequest(requestId);
      state.projectRecommendations = { ...state.projectRecommendations, [requestId]: recommendations };
      const known = new Map((state.networkProfiles || []).map((profile) => [profile.id, profile]));
      recommendations.forEach((profile) => known.set(profile.id, { ...known.get(profile.id), ...profile }));
      state.networkProfiles = [...known.values()];
    } catch (error) {
      state.projectRecommendations = { ...state.projectRecommendations, [requestId]: [] };
      notify(error.message);
    }
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
  
    return { findOffer, loadProjectRecommendations, renderDetail };
}

