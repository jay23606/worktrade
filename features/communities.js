export function createCommunitiesFeature({ getState, esc }) {
  const state = getState();
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
  
    return { circleDetail, renderChainHub };
}

