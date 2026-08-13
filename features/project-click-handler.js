export function createProjectClickHandler({ getState, acceptOffer, loadRemoteWorkspace, notify, updateRequests, proposeAgreement, confirmAgreement, counterOfferModal, findOffer, declineOffer, performAgreementAction, transitionAgreement, handleCompletion, respondAmendment }) {
  const state = getState();
  return function handleProjectClick(event) {
    const accept = event.target.closest("[data-accept]");
    if (accept) {
      if (state.remote)
        acceptOffer(accept.dataset.accept)
          .then(loadRemoteWorkspace)
          .then(() => notify("Proposal selected — awaiting mutual confirmation"))
          .catch((error) => notify(error.message));
      else {
        updateRequests((list) => {
          const r = list.find((x) => x.id === accept.dataset.request);
          const o = r.offers.find((x) => x.id === accept.dataset.accept);
          r.agreement = {
            ...proposeAgreement({
              offer: o,
              request: r,
              requesterId: r.ownerId,
              providerId:
                o.provider === state.profile.name ? "me" : `provider:${o.id}`,
            }),
            provider: o.provider,
            progress: 0,
          };
          r.agreement = confirmAgreement(r.agreement, r.ownerId);
          r.status = "proposed";
          r.milestones = [
            { title: "Confirm scope", done: false },
            { title: "Prepare inputs", done: false },
            { title: "Complete work", done: false },
            { title: "Review exchange", done: false },
          ];
          r.updates.push({
            id: crypto.randomUUID(),
            author: r.owner,
            text: `Selected ${o.provider}'s proposal. Both parties must confirm before work starts.`,
            date: "Today",
          });
          return list;
        });
        notify("Proposal selected — awaiting mutual confirmation");
      }
    }
    const counter = event.target.closest("[data-counter-offer]");
    if (counter) counterOfferModal(findOffer(counter.dataset.counterOffer));
    const decline = event.target.closest("[data-decline-offer]");
    if (decline && confirm("Decline the latest proposal terms?")) {
      if (state.remote)
        declineOffer(decline.dataset.declineOffer)
          .then(loadRemoteWorkspace)
          .then(() => notify("Proposal declined"))
          .catch((error) => notify(error.message));
      else {
        updateRequests((list) => list.map((request) => ({ ...request, offers: (request.offers || []).filter((offer) => offer.id !== decline.dataset.declineOffer) })));
        notify("Proposal declined");
      }
    }
    const agreementAction =
      event.target.closest("[data-agreement]")?.dataset.agreement;
    if (agreementAction) {
      const request = state.requests.find((x) => x.id === state.selectedId);
      if (state.remote)
        performAgreementAction(
          agreementAction,
          request.agreement.id,
          request.agreement.version,
        )
          .then(loadRemoteWorkspace)
          .then(() =>
            notify(
              agreementAction === "confirm"
                ? "Terms confirmed"
                : `Agreement moved to ${agreementAction}`,
            ),
          )
          .catch((error) => notify(error.message));
      else {
        updateRequests((list) => {
          const r = list.find((x) => x.id === state.selectedId);
          if (agreementAction === "confirm")
            r.agreement = confirmAgreement(r.agreement, "me");
          else
            r.agreement = transitionAgreement(r.agreement, agreementAction, "me");
          r.status = r.agreement.status;
          r.updates.push({
            id: crypto.randomUUID(),
            author: state.profile.name,
            text:
              agreementAction === "confirm"
                ? "Confirmed the current agreement terms."
                : `Moved the agreement to ${agreementAction}.`,
            date: "Today",
          });
          return list;
        });
        notify(
          agreementAction === "confirm"
            ? "Terms confirmed"
            : `Agreement moved to ${agreementAction}`,
        );
      }
    }
    const milestone = event.target.closest("[data-milestone]");
    if (milestone) {
      const request = state.requests.find((x) => x.id === state.selectedId);
      if (state.remote)
        performAgreementAction(
          "milestone",
          request.agreement.id,
          request.agreement.version,
          { milestone_id: milestone.dataset.milestone },
        )
          .then(loadRemoteWorkspace)
          .catch((error) => notify(error.message));
      else
        updateRequests((list) => {
          const r = list.find((x) => x.id === state.selectedId);
          r.milestones[Number(milestone.dataset.milestone)].done =
            !r.milestones[Number(milestone.dataset.milestone)].done;
          const done = r.milestones.filter((m) => m.done).length;
          r.agreement.progress = Math.round((done / r.milestones.length) * 100);
          if (done === r.milestones.length) r.status = "completed";
          return list;
        });
    }
    const obligation = event.target.closest("[data-obligation]");
    if (obligation) {
      const [kind, id] = obligation.dataset.obligation.split(":");
      const request = state.requests.find((x) => x.id === state.selectedId);
      performAgreementAction(
        kind,
        request.agreement.id,
        request.agreement.version,
        { obligation_id: id },
      )
        .then(loadRemoteWorkspace)
        .then(() =>
          notify(
            kind === "fulfill" ? "Fulfillment submitted" : "Fulfillment approved",
          ),
        )
        .catch((error) => notify(error.message));
    }
    const completion = event.target.closest("[data-completion]");
    if (completion) {
      const request = state.requests.find((x) => x.id === state.selectedId);
      handleCompletion(
        request.agreement.id,
        request.agreement.version,
        completion.dataset.completion,
      )
        .then(loadRemoteWorkspace)
        .then(() => notify("Completion status updated"))
        .catch((error) => notify(error.message));
    }
    const amendment = event.target.closest("[data-amendment]");
    if (amendment) {
      const [choice, id] = amendment.dataset.amendment.split(":");
      respondAmendment(id, choice === "accept")
        .then(loadRemoteWorkspace)
        .then(() => notify(`Amendment ${choice}ed`))
        .catch((error) => notify(error.message));
    }
      };
}

