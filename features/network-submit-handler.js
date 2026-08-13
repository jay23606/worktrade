export function createNetworkSubmitHandler(deps) {
  return async function handleNetworkSubmit(form, data) {
    const state = deps.getState();
    const kind = form.dataset.form;
    try {
      if (kind === "network-search") {
        state.networkQuery = data.get("query") || "";
        state.networkExchange = data.get("exchange") || "";
        state.networkMode = data.get("mode") || "either";
        state.networkRemote = state.networkMode === "remote";
        state.networkRadius = 40;
        state.networkAvailability = data.get("availability") || "";
        state.networkSort = data.get("sort") || "fit";
        await deps.loadNetwork();
      } else if (kind === "message-search") {
        state.messageQuery = data.get("query") || "";
      } else if (kind === "completion-story") {
        await deps.publishCompletion(form.dataset.agreement, data.get("summary"), data.get("exchange"), data.get("title"), data.get("visibility"));
        deps.closeModal();
        await deps.loadNetwork();
        deps.notify("Verified completion story published");
      } else if (kind === "collaboration-invite") {
        await deps.sendCollaborationInvitation(form.dataset.profile, {
          need: data.get("need"), offer: data.get("offer"), note: data.get("note"), requestId: data.get("request") || null,
        });
        deps.recordMatchKey(`profile:${form.dataset.profile}`, "proposed");
        if (data.get("request")) deps.recordMatchEvent({ profileId: form.dataset.profile, requestId: data.get("request"), event: "proposed" }).catch(() => {});
        deps.closeModal();
        await deps.loadNetwork();
        deps.notify("Collaboration invitation sent");
      } else if (kind === "contact-request") {
        let conversationId = null;
        if (state.remote) {
          conversationId = await deps.sendContactRequest(form.dataset.profile, data.get("message"), form.dataset.request || null, form.dataset.kind || "message");
          deps.recordMatchKey(`profile:${form.dataset.profile}`, "contacted");
          if (form.dataset.request) deps.recordMatchEvent({ profileId: form.dataset.profile, requestId: form.dataset.request, event: "contacted" }).catch(() => {});
          await deps.loadNetwork();
        }
        deps.closeModal();
        state.selectedConversationId = conversationId;
        state.messageListOnly = false;
        state.view = "messages";
        deps.notify("Message request sent — it’s now in Messages", "success");
      } else if (kind === "intro-message") {
        const file = form.elements.attachment?.files?.[0];
        const body = String(data.get("body") || "").trim();
        if (!body && !file) { deps.notify("Write a message or attach a file.", "warning"); return true; }
        if (file && file.size > 10485760) { deps.notify("Choose a file under 10 MB.", "warning"); return true; }
        if (file) await deps.sendMessageAttachment(form.dataset.invitation, body, file);
        else await deps.sendIntroductionMessage(form.dataset.invitation, body);
        delete state.messageDrafts[form.dataset.invitation];
        localStorage.setItem(deps.messageDraftKey, JSON.stringify(state.messageDrafts));
        form.reset();
        await deps.loadNetwork();
        if (state.remote) await deps.manageConversation(form.dataset.invitation, "read");
      } else if (kind === "save-network-search") {
        await deps.saveDiscoveryAlert(data.get("name"), {
          query: state.networkQuery, exchange: state.networkExchange, mode: state.networkMode,
          radius: state.networkRadius, availability: state.networkAvailability, sort: state.networkSort, alerts: data.has("alerts"),
        });
        deps.closeModal();
        await deps.loadNetwork();
        deps.notify("Discovery alert saved");
      } else if (kind === "intro-workspace") {
        const invitation = state.networkInbox.invitations.find((item) => item.id === form.dataset.invitation);
        const otherId = invitation.sender_id === state.profile.id ? invitation.recipient_id : invitation.sender_id;
        await deps.updateIntroductionWorkspace(form.dataset.invitation, Number(form.dataset.version), {
          scope: data.get("scope"),
          responsibilities: { [state.profile.id]: data.get("mine"), [otherId]: data.get("theirs"), other: data.get("theirs") },
          materials: data.get("materials"), exclusions: data.get("exclusions"), exchange_terms: data.get("exchange_terms"),
          proposed_windows: data.get("proposed_windows"), timezone: data.get("timezone"),
        });
        deps.closeModal();
        await deps.loadNetwork();
        deps.notify("Shared planning terms updated");
      } else {
        return false;
      }
    } catch (error) {
      deps.notify(error.message);
    }
    return true;
  };
}
