export function createSocialClickHandler({ getState, publicProfileModal, recordMatchKey, modalRoot, getConversationProfile, notify, matchFeedbackModal, matchFeedbackKey, invitationModal, recordMatchEvent, contactRequestModal, setPendingRenderFocus, setSavedProfile, loadNetwork, respondCollaborationInvitation, loadNotifications, manageConversation, offerModal, workspaceModal, confirmIntroductionWorkspace, closeModal, convertIntroductionToRequest, loadRemoteWorkspace, manageNetworkItem }) {
  const state = getState();
  const MATCH_FEEDBACK_KEY = matchFeedbackKey;
  return function handleSocialClick(event) {
    const viewProfile = event.target.closest("[data-view-profile]");
    if (viewProfile) {
      const knownProfile = (state.networkProfiles || []).find(
        (x) => x.id === viewProfile.dataset.viewProfile,
      );
      const showProfile = (profile) => {
        publicProfileModal(profile);
        recordMatchKey(`profile:${profile.id}`, "viewed");
        if (state.session && profile.id !== state.profile.id)
          modalRoot
            .querySelector(".modal")
            .insertAdjacentHTML(
              "beforeend",
              `<div class="social-actions"><button class="primary" data-contact-person="${profile.id}">Message</button><button class="secondary" data-save-person="${profile.id}">${(state.networkInbox?.saved_profiles || []).includes(profile.id) ? "Saved" : "Save person"}</button></div>`,
            );
      };
      if (knownProfile) showProfile(knownProfile);
      else getConversationProfile(viewProfile.dataset.viewProfile)
        .then((profile) => {
          state.networkProfiles = [...state.networkProfiles, profile];
          showProfile(profile);
        })
        .catch((error) => notify(error.message, "warning"));
    }
    const matchFeedback = event.target.closest("[data-match-feedback]");
    if (matchFeedback) {
      const value = matchFeedback.dataset.matchFeedback;
      const separator = value.lastIndexOf(":");
      const key = value.slice(0, separator);
      const feedback = value.slice(separator + 1);
      if (feedback === "not-relevant") matchFeedbackModal(key);
      else {
        state.matchFeedback = { ...state.matchFeedback, [key]: feedback };
        localStorage.setItem(MATCH_FEEDBACK_KEY, JSON.stringify(state.matchFeedback));
        recordMatchKey(key, "useful");
        notify("Thanks—this match was marked useful");
      }
    }
    const dismissMatch = event.target.closest("[data-match-dismiss]");
    if (dismissMatch) {
      state.matchFeedback = { ...state.matchFeedback, [dismissMatch.dataset.matchDismiss]: "dismissed" };
      localStorage.setItem(MATCH_FEEDBACK_KEY, JSON.stringify(state.matchFeedback));
      recordMatchKey(dismissMatch.dataset.matchDismiss, "dismissed", "hidden");
      notify("Match hidden");
    }
    const invitePerson = event.target.closest("[data-invite-person]");
    if (invitePerson) {
      const profile = (state.networkProfiles || []).find(
        (x) => x.id === invitePerson.dataset.invitePerson,
      );
      if (profile) invitationModal(profile);
    }
    const projectInvite = event.target.closest("[data-project-invite]");
    if (projectInvite) {
      const [profileId, requestId] = projectInvite.dataset.projectInvite.split(":");
      const profile = (state.networkProfiles || []).find((item) => item.id === profileId);
      if (profile) invitationModal(profile, requestId);
    }
    const dismissRecommendation = event.target.closest("[data-dismiss-recommendation]");
    if (dismissRecommendation) {
      const [profileId, requestId] = dismissRecommendation.dataset.dismissRecommendation.split(":");
      recordMatchEvent({ profileId, requestId, event: "dismissed", reason: "project suggestion dismissed" })
        .then(() => {
          state.projectRecommendations = { ...state.projectRecommendations, [requestId]: (state.projectRecommendations[requestId] || []).filter((item) => item.id !== profileId) };
          notify("Suggestion dismissed for this project");
        })
        .catch((error) => notify(error.message));
    }
    const contactPerson = event.target.closest("[data-contact-person]");
    if (contactPerson) {
      const profileId = contactPerson.dataset.contactPerson;
      const existing = (state.networkInbox.invitations || []).find((item) => ["pending", "accepted", "converted"].includes(item.status) && ((item.sender_id === state.profile.id && item.recipient_id === profileId) || (item.recipient_id === state.profile.id && item.sender_id === profileId)));
      if (existing) {
        recordMatchKey(`profile:${profileId}`, "contacted");
        state.selectedConversationId = existing.id;
        state.messageListOnly = false;
        state.view = "messages";
        return true;
      }
      const request = state.requests.find((item) => item.id === contactPerson.dataset.contactRequest) || null;
      const profile = (state.networkProfiles || []).find((item) => item.id === profileId);
      contactRequestModal(profileId, profile?.display_name || request?.owner || "this member", request, contactPerson.dataset.contactKind || "message");
    }
    const journeyInvitation = event.target.closest("[data-journey-invitation]");
    if (journeyInvitation) {
      const invitation = (state.networkInbox.invitations || []).find((item) => item.id === journeyInvitation.dataset.journeyInvitation);
      if (invitation?.status === "accepted") workspaceModal(invitation);
      else {
        state.view = "network";
        setPendingRenderFocus({ selector: `[data-invite-response$=":${journeyInvitation.dataset.journeyInvitation}"]`, until: Date.now() + 1000 });
      }
    }
    const savePerson = event.target.closest("[data-save-person]");
    if (savePerson) {
      const id = savePerson.dataset.savePerson;
      const saved = state.networkInbox.saved_profiles || [];
      const shouldSave = !saved.includes(id);
      setSavedProfile(id, shouldSave)
        .then(loadNetwork)
        .then(() =>
          notify(shouldSave ? "Collaborator saved" : "Collaborator removed"),
        )
        .catch((error) => notify(error.message));
    }
    const inviteResponse = event.target.closest("[data-invite-response]");
    if (inviteResponse) {
      const [response, id] = inviteResponse.dataset.inviteResponse.split(":");
      respondCollaborationInvitation(id, response)
        .then(loadNetwork)
        .then(loadNotifications)
        .then(() => notify(`Invitation ${response}`))
        .catch((error) => notify(error.message));
    }
    const conversationManage = event.target.closest("[data-conversation-manage]");
    if (conversationManage) {
      const [actionName, id] = conversationManage.dataset.conversationManage.split(":");
      manageConversation(id, actionName)
        .then(loadNetwork)
        .then(() => {
          if (actionName === "archive") state.selectedConversationId = null;
          notify(actionName === "archive" ? "Conversation archived" : `Conversation ${actionName}d`, "success");
        })
        .catch((error) => notify(error.message));
    }
    const messageOffer = event.target.closest("[data-message-offer]");
    if (messageOffer) {
      const invitation = state.networkInbox.invitations.find((item) => item.id === messageOffer.dataset.messageOffer);
      const request = state.requests.find((item) => item.id === invitation?.request_id);
      if (request && request.ownerId !== state.profile.id) offerModal(request.id);
      else {
        const otherId = invitation.sender_id === state.profile.id ? invitation.recipient_id : invitation.sender_id;
        const profile = state.networkProfiles.find((item) => item.id === otherId);
        invitationModal(profile || { id: otherId, display_name: invitation.sender_id === state.profile.id ? invitation.recipient_name : invitation.sender_name });
      }
    }
    const workspaceButton = event.target.closest("[data-workspace]");
    if (workspaceButton) {
      const invitation = state.networkInbox.invitations.find(
        (item) => item.id === workspaceButton.dataset.workspace,
      );
      if (invitation) workspaceModal(invitation);
    }
    const confirmWorkspace = event.target.closest("[data-confirm-workspace]");
    if (confirmWorkspace) {
      const [id, version] = confirmWorkspace.dataset.confirmWorkspace.split(":");
      confirmIntroductionWorkspace(id, Number(version))
        .then(() => {
          closeModal();
          return loadNetwork();
        })
        .then(() => notify("Current planning terms confirmed"))
        .catch((error) => notify(error.message));
    }
    const convertIntro = event.target.closest("[data-convert-intro]");
    if (convertIntro) {
      convertIntroductionToRequest(convertIntro.dataset.convertIntro)
        .then(async (id) => {
          await loadRemoteWorkspace();
          await loadNetwork();
          state.selectedId = id;
          state.view = "detail";
        })
        .then(() => notify("Private work draft created"))
        .catch((error) => notify(error.message));
    }
    const networkManage = event.target.closest("[data-network-manage]");
    if (networkManage) {
      const [kind, actionName, id] =
        networkManage.dataset.networkManage.split(":");
      const warning =
        actionName === "block"
          ? "Block this person and close the introduction?"
          : actionName === "report"
            ? "Submit a private safety report about this introduction?"
            : null;
      if (!warning || confirm(warning))
        manageNetworkItem(kind, id, actionName)
          .then(loadNetwork)
          .then(() => notify(`Network item ${actionName}ed`))
          .catch((error) => notify(error.message));
    }
    const savedSearch = event.target.closest("[data-saved-search]");
    if (savedSearch) {
      const search = (state.networkInbox.saved_searches || []).find(
        (item) => item.id === savedSearch.dataset.savedSearch,
      );
      if (search) {
        state.networkQuery = search.query;
        state.networkExchange = search.exchange_filter || "";
        state.networkRemote = search.remote_only;
        state.networkMode = search.discovery_mode || (search.remote_only ? "remote" : "either");
        state.networkRadius = search.radius_km || 40;
        state.networkAvailability = search.availability_filter || "";
        state.networkSort = search.sort_order || "fit";
        loadNetwork();
      }
    }
    const skillSearch = event.target.closest("[data-skill-search]");
    if (skillSearch) {
      state.networkQuery = skillSearch.dataset.skillSearch;
      loadNetwork();
    }
        return false;
  };
}

