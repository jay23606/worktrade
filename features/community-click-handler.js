export function createCommunityClickHandler({ getState, loadNetwork, notify, requestCircleMembership, manageCircleMembership, circleResourceModal, circleSettingsModal, circleInviteModal, circlePostModal, deleteCircleResource, chainBuilderModal, acceptTradeChain, activateTradeChain, manageTradeChainLink, chainHoldModal, manageTradeChain }) {
  const state = getState();
  return function handleCommunityClick(event) {
    const openCircle = event.target.closest("[data-open-circle]");
    if (openCircle) {
      const circle = state.circleHub.circles.find(
        (item) => item.id === openCircle.dataset.openCircle,
      );
      if (
        circle?.membership?.status === "active" ||
        circle?.membership?.status === "invited"
      ) {
        state.selectedCircleId = circle.id;
        loadNetwork();
      } else if (circle)
        requestCircleMembership(circle.id)
          .then(loadNetwork)
          .then(() => notify("Membership requested"))
          .catch((error) => notify(error.message));
    }
    const circleMembership = event.target.closest("[data-circle-membership]");
    if (circleMembership) {
      const rowButtons = circleMembership.closest(".circle-member, .circle-detail")?.querySelectorAll("[data-circle-membership]") || [];
      rowButtons.forEach((button) => { button.disabled = true; });
      const [memberAction, circleId, profileId] =
        circleMembership.dataset.circleMembership.split(":");
      const operation =
        memberAction === "request"
          ? requestCircleMembership(circleId)
          : manageCircleMembership(circleId, profileId, memberAction);
      operation
        .then(loadNetwork)
        .then(() => notify("Circle membership updated"))
        .catch((error) => {
          rowButtons.forEach((button) => { button.disabled = false; });
          notify(error.message);
        });
      return true;
    }
    const circleRole = event.target.closest("[data-circle-role]");
    if (circleRole) {
      const [circleId, profileId, role] =
        circleRole.dataset.circleRole.split(":");
      manageCircleMembership(circleId, profileId, "role", role)
        .then(loadNetwork)
        .then(() => notify("Circle role updated"))
        .catch((error) => notify(error.message));
    }
    const circleResource = event.target.closest("[data-circle-resource]");
    if (circleResource)
      circleResourceModal(circleResource.dataset.circleResource);
    const circleSettings = event.target.closest("[data-circle-settings]");
    if (circleSettings) {
      const circle = state.circleHub.circles.find(
        (item) => item.id === circleSettings.dataset.circleSettings,
      );
      if (circle) circleSettingsModal(circle);
    }
    const circleInvite = event.target.closest("[data-circle-invite]");
    if (circleInvite) circleInviteModal(circleInvite.dataset.circleInvite);
    const circlePost = event.target.closest("[data-circle-post]");
    if (circlePost) circlePostModal(circlePost.dataset.circlePost);
    const deleteResource = event.target.closest("[data-delete-circle-resource]");
    if (deleteResource && confirm("Remove this shared resource?"))
      deleteCircleResource(deleteResource.dataset.deleteCircleResource)
        .then(loadNetwork)
        .then(() => notify("Resource removed"))
        .catch((error) => notify(error.message));
    const createChainButton = event.target.closest("[data-create-chain]");
    if (createChainButton)
      chainBuilderModal(createChainButton.dataset.createChain);
    const suggestChain = event.target.closest("[data-suggest-chain]");
    if (suggestChain) {
      const [index, circleId] = suggestChain.dataset.suggestChain.split(":");
      const suggestions = (state.chainHub.suggestions || []).filter((item) =>
        (item.participants || []).includes(state.profile.id),
      );
      chainBuilderModal(circleId, suggestions[Number(index)]);
    }
    const editChain = event.target.closest("[data-chain-edit]");
    if (editChain) {
      const chain = state.chainHub.chains.find(
        (c) => c.id === editChain.dataset.chainEdit,
      );
      if (chain) chainBuilderModal(chain.circle_id, null, chain);
    }
    const acceptChainButton = event.target.closest("[data-chain-accept]");
    if (acceptChainButton) {
      const [id, version] = acceptChainButton.dataset.chainAccept.split(":");
      acceptTradeChain(id, Number(version))
        .then(loadNetwork)
        .then(() => notify("You accepted the complete chain"))
        .catch((error) => notify(error.message));
    }
    const activateChainButton = event.target.closest("[data-chain-activate]");
    if (activateChainButton)
      activateTradeChain(activateChainButton.dataset.chainActivate)
        .then(loadNetwork)
        .then(() => notify("Trade chain activated"))
        .catch((error) => notify(error.message));
    const chainLinkButton = event.target.closest("[data-chain-link]");
    if (chainLinkButton) {
      const [actionName, id] = chainLinkButton.dataset.chainLink.split(":");
      const note =
        actionName === "fulfill"
          ? prompt("Briefly describe the delivered work or value:") || ""
          : "";
      manageTradeChainLink(id, actionName, note)
        .then(loadNetwork)
        .then(() =>
          notify(
            actionName === "fulfill"
              ? "Fulfillment submitted"
              : "Contribution approved",
          ),
        )
        .catch((error) => notify(error.message));
    }
    const chainHold = event.target.closest("[data-chain-hold]");
    if (chainHold) {
      const [chainId, linkId] = chainHold.dataset.chainHold.split(":");
      chainHoldModal(chainId, linkId);
    }
    const resolveChainHold = event.target.closest("[data-chain-resolve-hold]");
    if (resolveChainHold) {
      const [chainId, holdId] =
        resolveChainHold.dataset.chainResolveHold.split(":");
      manageTradeChain(chainId, "resolve_hold", { hold_id: holdId })
        .then(loadNetwork)
        .then(() => notify("Dependency resolved"))
        .catch((error) => notify(error.message));
    }
    const chainManage = event.target.closest("[data-chain-manage]");
    if (chainManage) {
      const [actionName, id] = chainManage.dataset.chainManage.split(":");
      if (
        confirm(
          `${actionName === "disputed" ? "Raise a dispute for" : "Cancel"} this entire chain?`,
        )
      )
        manageTradeChain(id, actionName, {})
          .then(loadNetwork)
          .then(() => notify(`Chain ${actionName}`))
          .catch((error) => notify(error.message));
    }    return false;
  };
}

