export function createNetworkFeature({ getState, shell, esc, networkPersonCard, activityCard, scorePersonForProfile, circleDetail, renderChainHub }) {
  const state = getState();
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
            `<small class="match-score">Match ${profile.match_score} · ${esc((profile.match_reasons || ["Profile information overlaps your preferences"]).join(" · "))}</small>`,
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


  return { hydrateLocalDiscovery, hydrateNetworkSocial, localDiscoveryProfiles, renderNetwork, socialPersonCard };
}
