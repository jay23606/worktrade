export function createProfileFeature({ getState, shell, esc, avatarMarkup, backendConfigured, openModal, modalRoot, onboardingDraftKey, notify }) {
  const state = getState();
  const ONBOARDING_DRAFT_KEY = onboardingDraftKey;
  function renderProfile() {
    const p = state.profile;
    const quality = profileQuality(p);
    return shell(
      `<section class="profile-head">${avatarMarkup(p.avatarUrl, p.name, "giant")}<div><span class="eyebrow">Your WorkTrade profile</span><h1>${esc(p.name)}</h1><p>${esc(p.bio)}</p><small>${esc(p.location)}</small></div><div class="profile-actions"><button class="primary" data-action="onboarding">${p.onboardingComplete ? "Improve my matches" : "Finish match setup"}</button><button class="secondary profile-edit" data-action="edit-profile">Edit profile</button></div></section>
      <section class="profile-quality"><div><span class="eyebrow">Profile readiness</span><h2>${quality.score}% ready for useful matches</h2><p>${quality.missing.length ? `Next improvement: ${esc(quality.missing[0])}.` : "Your profile gives collaborators enough context to start a grounded conversation."}</p></div><div class="quality-meter"><span style="width:${quality.score}%"></span></div>${quality.missing.length ? `<ul>${quality.missing.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}</section>
      <div class="two-col"><section class="list-panel"><span class="eyebrow">I can offer</span><h2>Skills, goods, and access</h2><div class="editable-list">${p.offers.map((x, i) => `<span>${esc(x)}<button data-remove="offers:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="offers" class="inline-form"><input name="item" required minlength="2" maxlength="100" placeholder="Add something you can offer"><button class="secondary">Add</button></form></section>
      <section class="list-panel warm"><span class="eyebrow">I need</span><h2>Things that could move you forward</h2><div class="editable-list">${p.needs.map((x, i) => `<span>${esc(x)}<button data-remove="needs:${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")}</div><form data-form="profile-item" data-list="needs" class="inline-form"><input name="item" required minlength="2" maxlength="100" placeholder="Add something you need"><button class="secondary">Add</button></form></section></div>
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
  
  function onboardingCapabilities(form) {
    const split = (value) => String(value || "").split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
    return { offers: split(form.elements.offers?.value), needs: split(form.elements.needs?.value) };
  }
  
  function validateOnboardingCapabilities(form) {
    const { offers, needs } = onboardingCapabilities(form);
    const invalid = [...offers, ...needs].find((item) => item.length < 2 || item.length > 100);
    if (!offers.length || !needs.length) {
      notify("Add at least one thing you can offer and one thing you need.", "warning");
      return false;
    }
    if (invalid) {
      notify(`“${invalid}” is too short. Use at least 2 characters for each offer or need.`, "warning");
      return false;
    }
    return true;
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
  
    return { onboardingCapabilities, onboardingModal, profileModal, renderProfile, saveOnboardingDraft, showOnboardingStep, validateOnboardingCapabilities, welcomeSetupModal };
}

