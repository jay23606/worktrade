export function createProfileSubmitHandler(deps) {
  const profilePayload = (profile, preferredExchangeModes) => ({
    display_name: profile.name,
    location_text: profile.location,
    bio: profile.bio,
    needs: profile.needs,
    offers: profile.offers,
    work_radius_km: profile.workRadius,
    remote_available: profile.remoteAvailable,
    preferred_exchange_modes: preferredExchangeModes,
    availability_text: profile.availability,
    location_visibility: profile.locationVisibility,
    resources_text: profile.resources,
    profile_visibility: profile.visibility,
  });

  return async function handleProfileSubmit(form, data) {
    const state = deps.getState();
    const kind = form.dataset.form;
    if (kind === "profile") {
      const profile = {
        ...structuredClone(state.profile),
        name: data.get("display_name"), location: data.get("location_text"), bio: data.get("bio"),
        workRadius: Number(data.get("work_radius_km")) || null, remoteAvailable: data.has("remote_available"),
        availability: data.get("availability_text"), resources: data.get("resources_text") || "",
        locationVisibility: data.get("location_visibility") || "region", visibility: data.get("profile_visibility"),
      };
      try {
        if (state.remote) await deps.updateMyProfile(profilePayload(profile, ["cash", "barter", "hybrid"]));
        const avatar = form.elements.avatar?.files?.[0];
        if (state.remote && avatar) await deps.uploadProfileAvatar(avatar, state.profile.avatarPath);
        state.profile = profile;
        if (state.remote && avatar) await deps.loadRemoteWorkspace();
        if (!state.remote) deps.persist();
        deps.closeModal(); deps.notify("Profile saved");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "portfolio-photo") {
      try {
        const photo = form.elements.photo.files[0];
        if (!photo) { deps.notify("Choose a photo", "warning"); return true; }
        await deps.uploadPortfolioImage(form.dataset.entry, photo, form.dataset.path);
        await deps.loadRemoteWorkspace(); deps.notify("Portfolio photo added", "success");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "onboarding") {
      const splitList = (value) => value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
      if (!deps.validateOnboardingCapabilities(form)) { deps.showOnboardingStep(form, 2); return true; }
      const exchanges = data.getAll("exchange");
      if (!exchanges.length) { deps.notify("Choose at least one way to exchange value.", "warning"); return true; }
      const profile = {
        ...structuredClone(state.profile),
        name: data.get("display_name") || state.profile.name,
        offers: splitList(data.get("offers")), needs: splitList(data.get("needs")), location: data.get("location_text"),
        availability: data.get("availability_text"), workRadius: Number(data.get("work_radius_km")) || null,
        resources: data.get("resources_text") || "", locationVisibility: data.get("location_visibility") || "region",
        visibility: data.get("profile_visibility") || state.profile.visibility || "public",
        remoteAvailable: data.has("remote_available"), preferredExchangeModes: exchanges,
        firstGoal: data.get("first_goal") || "find_help", onboardingComplete: true,
      };
      try {
        if (state.remote) await deps.updateMyProfile(profilePayload(profile, data.has("flexible") ? ["cash", "barter", "hybrid"] : exchanges));
        if (state.remote) await deps.recordOnboardingState(profile.firstGoal, "complete");
        const avatar = form.elements.avatar?.files?.[0];
        if (state.remote && avatar) await deps.uploadProfileAvatar(avatar, state.profile.avatarPath);
        state.profile = profile;
        if (state.remote && avatar) await deps.loadRemoteWorkspace();
        if (!state.remote) deps.persist();
        localStorage.removeItem(deps.onboardingDraftKey);
        deps.closeModal();
        if (state.remote) await deps.loadNetwork();
        if (profile.firstGoal === "post_work") {
          state.view = "discover";
          setTimeout(deps.postModal, 0);
          deps.notify("Profile saved. Tell the community what you need.", "success");
        } else {
          state.view = "matches";
          deps.notify(profile.firstGoal === "offer_help" ? "Here’s work you may be able to help with" : "Your first matches are ready", "success");
        }
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    return false;
  };
}
