export function createMatchingFeature({ getState, esc, notify, recordMatchEvent, requestCard, shell }) {
  const state = () => getState();
  const matchTerms = (values = []) => values.flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/)).filter((value) => value.length > 2);
  const overlaps = (left, right) => {
    const rightTerms = matchTerms(right);
    return [...new Set(left.filter((value) => rightTerms.some((other) => value.includes(other) || other.includes(value))))];
  };
  const scoreRequestForProfile = (request) => {
    const offerTerms = matchTerms(state().profile.offers);
    const requestText = `${request.title} ${request.description} ${request.skills.join(" ")}`.toLowerCase();
    const overlap = offerTerms.filter((term) => requestText.includes(term));
    const nearby = !state().profile.location || request.location.toLowerCase().includes(state().profile.location.split(",")[0].toLowerCase());
    return { request, overlap: [...new Set(overlap)], score: overlap.length * 3 + (nearby ? 1 : 0) };
  };
  const scorePersonForProfile = (person) => {
    const offered = (person.capabilities || []).filter((x) => x.direction === "offer").map((x) => x.label);
    const needed = (person.capabilities || []).filter((x) => x.direction === "need").map((x) => x.label);
    const helpsMe = overlaps(matchTerms(state().profile.needs), offered);
    const helpThem = overlaps(matchTerms(state().profile.offers), needed);
    const locationFit = !!state().profile.location && !!person.location_text && person.location_text.toLowerCase().includes(state().profile.location.split(",")[0].toLowerCase());
    const exchangeFit = (state().profile.preferredExchangeModes || ["barter", "cash", "hybrid"]).some((mode) => (person.preferred_exchange_modes || []).includes(mode));
    const proof = Math.min(2, Number(person.completed_count || 0));
    const serverHelpsMe = person.matched_offers || [];
    const serverHelpThem = person.matched_needs || [];
    const score = person.match_score == null ? Math.min(100, helpsMe.length * 18 + helpThem.length * 18 + (locationFit ? 12 : 0) + (person.remote_available && state().profile.remoteAvailable ? 8 : 0) + (exchangeFit ? 8 : 0) + proof * 4) : Number(person.match_score);
    return { person, helpsMe: serverHelpsMe.length ? serverHelpsMe : helpsMe, helpThem: serverHelpThem.length ? serverHelpThem : helpThem, locationFit, exchangeFit, score, reasons: person.match_reasons || [] };
  };
  const feedbackControls = (key) => {
    const current = state().matchFeedback[key];
    return `<div class="match-feedback" aria-label="Rate this match"><button class="text-btn ${current === "useful" ? "selected" : ""}" data-match-feedback="${key}:useful">Useful</button><button class="text-btn ${current?.startsWith("not-relevant") ? "selected" : ""}" data-match-feedback="${key}:not-relevant">Not relevant</button><button class="text-btn" data-match-dismiss="${key}">Hide</button></div>`;
  };
  const recordMatchKey = (key, event, reason = null) => {
    if (!state().remote || !state().session) return;
    const [kind, id] = String(key).split(":");
    recordMatchEvent({ profileId: kind === "profile" ? id : null, requestId: kind === "request" ? id : null, event, reason }).catch(() => {});
  };
  const announceStrongMatches = (profiles) => {
    if (!state().session) return;
    const key = "worktrade:seen-strong-matches:v1";
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(key)) || []; } catch { seen = []; }
    const fresh = profiles.map(scorePersonForProfile).filter((match) => match.score >= 50 && !seen.includes(match.person.id));
    if (!fresh.length) return;
    localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...fresh.map((match) => match.person.id)])]));
    const title = fresh.length === 1 ? `Strong match with ${fresh[0].person.display_name}` : `${fresh.length} new strong matches`;
    state().notifications = [{ id: `match:${Date.now()}`, kind: "network", title, body: "Open Matches to see the two-way fit and propose an exchange.", created_at: new Date().toISOString(), read_at: null }, ...state().notifications];
    const badge = document.querySelector("#unread-count");
    if (badge) badge.textContent = String(state().notifications.filter((item) => !item.read_at).length);
    notify(title, "success");
  };
  const renderFirstMatches = () => {
    const hidden = (key) => state().matchFeedback[key] === "dismissed";
    const work = state().requests.filter((request) => request.status === "open" && !hidden(`request:${request.id}`)).map(scoreRequestForProfile).sort((a, b) => b.score - a.score).slice(0, 4);
    const people = state().networkProfiles.filter((person) => person.id !== state().profile.id && !hidden(`profile:${person.id}`)).map(scorePersonForProfile).sort((a, b) => b.score - a.score).slice(0, 6);
    const strong = people.filter((match) => match.score >= 50).length;
    return shell(`<section class="match-welcome"><span class="eyebrow">Personalized matches</span><h1>Useful overlap, explained.</h1><p>WorkTrade scores both directions of an exchange, then adds general location, remote availability, exchange preferences, and proven work. A high score is a starting point—not a judgment.</p><div class="match-summary"><b>${strong}</b><span>strong reciprocal match${strong === 1 ? "" : "es"}</span><button class="secondary" data-action="onboarding">Adjust matching profile</button></div></section>
      <div class="first-match-grid"><section><div class="section-title"><div><span class="eyebrow">Work you may be able to help with</span><h2>${work.length} starting points</h2></div></div><div class="request-grid first-match-list">${work.map(({ request, overlap, score }) => `<div class="match-shell"><div class="match-explanation"><b>${Math.min(100, score * 12)}% work fit</b><span>${overlap.length ? `Your ${esc(overlap.join(", "))} may help` : score ? "Near your general location" : "A chance to explore something different"}</span></div>${requestCard(request)}${feedbackControls(`request:${request.id}`)}</div>`).join("") || `<div class="empty"><p>No visible work matches. Adjust your profile or restore hidden matches below.</p></div>`}</div></section>
      <section><div class="section-title"><div><span class="eyebrow">Reciprocal people matches</span><h2>${people.length} potential collaborators</h2></div></div><div class="people-list match-people">${people.map(({ person, helpsMe, helpThem, locationFit, exchangeFit, score }) => `<article class="person-card match-person"><span class="avatar big">${esc((person.display_name || "WT").split(/\s+/).map((x) => x[0]).join("").slice(0, 2))}</span><div><div class="match-score-row"><h3>${esc(person.display_name)}</h3><b>${score}%</b></div><p class="match-direction"><strong>They may help you:</strong> ${esc(helpsMe.join(", ") || "No direct need overlap yet")}</p><p class="match-direction"><strong>You may help them:</strong> ${esc(helpThem.join(", ") || "No direct offer overlap yet")}</p><small>${[locationFit ? "nearby" : "location flexible", exchangeFit ? "exchange fit" : "different exchange preferences", `${person.completed_count || 0} completed`].join(" · ")}</small><div class="social-actions"><button class="text-btn" data-view-profile="${person.id}">View evidence</button>${state().session ? `<button class="primary compact" data-contact-person="${person.id}">Message</button><button class="secondary compact" data-save-person="${person.id}">${(state().networkInbox?.saved_profiles || []).includes(person.id) ? "Saved" : "Save"}</button>` : `<button class="primary compact" data-action="sign-in">Sign in to connect</button>`}</div>${feedbackControls(`profile:${person.id}`)}</div></article>`).join("") || `<div class="empty"><p>Connected collaborator suggestions will appear here. Your work matches are ready now.</p><button class="secondary" data-nav="network">Explore the network</button></div>`}</div></section></div>${Object.values(state().matchFeedback).includes("dismissed") ? `<button class="text-btn restore-matches" data-action="restore-matches">Restore hidden matches</button>` : ""}`, "Personalized starting points");
  };
  return { announceStrongMatches, feedbackControls, recordMatchKey, renderFirstMatches, scorePersonForProfile, scoreRequestForProfile };
}
