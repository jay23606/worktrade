export function createManagementClickHandler({ getState, closeRequest, loadRemoteWorkspace, notify, markNotificationsRead, loadNotifications, closeModal, projectNotificationKey, notificationsModal, requestLifecycleAction, reviseOfferModal, withdrawOffer, manageMilestone, manageRequestMedia }) {
  const state = getState();
  const PROJECT_NOTIFICATION_KEY = projectNotificationKey;
  return function handleManagementClick(event) {
    const requestAction = event.target.closest("[data-request-action]");
    if (requestAction) {
      const request = state.requests.find((item) => item.id === state.selectedId);
      if (
        confirm(
          `${requestAction.dataset.requestAction[0].toUpperCase() + requestAction.dataset.requestAction.slice(1)} this request?`,
        )
      )
        closeRequest(
          request.id,
          request.version,
          requestAction.dataset.requestAction,
        )
          .then(async () => {
            state.view = "workspace";
            await loadRemoteWorkspace();
            notify("Request updated");
          })
          .catch((error) => notify(error.message));
    }
    const notification = event.target.closest("[data-notification]");
    if (notification) {
      if (state.remote) markNotificationsRead([notification.dataset.notification]).then(loadNotifications);
      else state.notifications = state.notifications.map((item) => item.id === notification.dataset.notification ? { ...item, read_at: item.read_at || new Date().toISOString() } : item);
      closeModal();
      if (notification.dataset.request) {
        state.selectedId = notification.dataset.request;
        state.projectDetailTab = notification.dataset.section || "overview";
        state.view = "detail";
      } else state.view = notification.dataset.route || "workspace";
    }
    const negotiationOpen = event.target.closest("[data-negotiation-open]");
    if (negotiationOpen) {
      state.selectedId = negotiationOpen.dataset.negotiationOpen;
      state.projectDetailTab = "overview";
      state.view = "detail";
    }
    const projectNotifications = event.target.closest("[data-project-notifications]");
    if (projectNotifications) {
      const [requestId, setting] = projectNotifications.dataset.projectNotifications.split(":");
      state.projectNotificationSettings = { ...state.projectNotificationSettings, [requestId]: setting };
      localStorage.setItem(PROJECT_NOTIFICATION_KEY, JSON.stringify(state.projectNotificationSettings));
      notificationsModal();
      notify(setting === "muted" ? "Project updates muted on this device; required actions remain in your inbox" : "Project updates unmuted");
    }
    const lifecycle = event.target.closest("[data-lifecycle]");
    if (lifecycle) {
      event.stopPropagation();
      const [actionName, id, version] = lifecycle.dataset.lifecycle.split(":");
      requestLifecycleAction(id, Number(version), actionName)
        .then(loadRemoteWorkspace)
        .then(() => notify(`Request ${actionName}d`))
        .catch((error) => notify(error.message));
    }
    const editOffer = event.target.closest("[data-edit-offer]");
    if (editOffer) {
      event.stopPropagation();
      reviseOfferModal(
        state.myOffers.find((o) => o.id === editOffer.dataset.editOffer),
      );
    }
    const withdraw = event.target.closest("[data-withdraw-offer]");
    if (withdraw) {
      event.stopPropagation();
      if (confirm("Withdraw this proposal?"))
        withdrawOffer(withdraw.dataset.withdrawOffer)
          .then(loadRemoteWorkspace)
          .then(() => notify("Proposal withdrawn"))
          .catch((error) => notify(error.message));
    }
    const removeMilestone = event.target.closest("[data-remove-milestone]");
    if (removeMilestone) {
      event.stopPropagation();
      const request = state.requests.find((x) => x.id === state.selectedId);
      manageMilestone(request.agreement.id, request.agreement.version, "remove", {
        milestone_id: removeMilestone.dataset.removeMilestone,
      })
        .then(loadRemoteWorkspace)
        .then(() => notify("Milestone removed"))
        .catch((error) => notify(error.message));
    }
    const deleteMedia = event.target.closest("[data-delete-media]");
    if (deleteMedia) {
      manageRequestMedia(deleteMedia.dataset.deleteMedia, "delete")
        .then(loadRemoteWorkspace)
        .then(() => notify("Photo removed"))
        .catch((error) => notify(error.message));
    }
      };
}

