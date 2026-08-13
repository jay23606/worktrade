export function createCollaborationDialogs({ getState, openModal, esc, modalRoot, categories, notify }) {
  const state = getState();
  function invitationModal(profile, selectedRequestId = null) {
    openModal(
      `<span class="eyebrow">Collaboration invitation</span><h2>Propose an exchange with ${esc(profile.display_name)}.</h2><p>They choose whether to open a private conversation.</p><form data-form="collaboration-invite" data-profile="${profile.id}" class="form-grid"><label class="wide">What do you need?<input name="need" required maxlength="500" value="${esc((state.profile.needs || []).join(", "))}"></label><label class="wide">What can you offer?<input name="offer" required maxlength="500" value="${esc((state.profile.offers || []).join(", "))}"></label><label class="wide">Short note<textarea name="note" maxlength="1000" placeholder="Why this might be a useful fit"></textarea></label><label class="wide">Related request<select name="request"><option value="">No specific request</option>${state.requests
        .filter((r) => r.ownerId === state.profile.id && r.status === "open")
        .map((r) => `<option value="${r.id}" ${r.id === selectedRequestId ? "selected" : ""}>${esc(r.title)}</option>`)
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
  
    return { chainBuilderModal, chainHoldModal, circleInviteModal, circlePostModal, circleResourceModal, circleSettingsModal, contactRequestModal, createCircleModal, invitationModal, saveSearchModal, workspaceModal };
}

