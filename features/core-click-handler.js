export function createCoreClickHandler({ getState, removeProfileAvatar, removePortfolioImage, loadRemoteWorkspace, closeModal, notify, validateOnboardingCapabilities, saveOnboardingDraft, showOnboardingStep, recordOnboardingState, loadNetwork, manageConversation, modalRoot }) {
  const state = getState();
  return function handleCoreClick(event) {
    if (event.target.closest("[data-remove-avatar]")) {
      removeProfileAvatar(state.profile.avatarPath).then(loadRemoteWorkspace).then(() => { closeModal(); notify("Profile photo removed"); }).catch((error) => notify(error.message));
      return true;
    }
    const removePortfolio = event.target.closest("[data-remove-portfolio-photo]");
    if (removePortfolio) {
      removePortfolioImage(removePortfolio.dataset.removePortfolioPhoto, removePortfolio.dataset.path).then(loadRemoteWorkspace).then(() => notify("Portfolio photo removed")).catch((error) => notify(error.message));
      return true;
    }
    const onboardingForm = event.target.closest('form[data-form="onboarding"]');
    if (onboardingForm && event.target.closest("[data-onboarding-next]")) {
      const step = Number(onboardingForm.dataset.step || 1);
      const required = [...onboardingForm.querySelectorAll(`[data-onboarding-step="${step}"] [required]`)];
      if (required.some((field) => !field.reportValidity())) return true;
      if (step === 2 && !validateOnboardingCapabilities(onboardingForm)) return true;
      saveOnboardingDraft(onboardingForm);
      showOnboardingStep(onboardingForm, Math.min(3, step + 1));
      return true;
    }
    if (onboardingForm && event.target.closest("[data-onboarding-back]")) {
      saveOnboardingDraft(onboardingForm);
      showOnboardingStep(onboardingForm, Math.max(1, Number(onboardingForm.dataset.step || 1) - 1));
      return true;
    }
    if (onboardingForm && event.target.closest("[data-onboarding-skip]")) {
      saveOnboardingDraft(onboardingForm);
      const goal = new FormData(onboardingForm).get("first_goal");
      if (state.remote) recordOnboardingState(goal, "skipped").catch(() => {});
      state.profile = { ...state.profile, firstGoal: goal, onboardingSkipped: true };
      closeModal();
      notify("Setup saved. Resume it any time from your profile.");
      return true;
    }
    const projectTab = event.target.closest("[data-project-tab]");
    if (projectTab) {
      const previousTop = projectTab.closest(".project-tabs").getBoundingClientRect().top;
      const nextProjectTab = projectTab.dataset.projectTab;
      queueMicrotask(() => {
        state.projectDetailTab = nextProjectTab;
        const nextTabs = document.querySelector(".project-tabs");
        if (nextTabs) window.scrollBy({ top: nextTabs.getBoundingClientRect().top - previousTop, behavior: "instant" });
      });
      return true;
    }
    if (event.target.closest("[data-focus-milestones]")) {
      document.querySelector(".milestones")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      state.view = nav.dataset.nav;
      state.selectedId = null;
      state.projectDetailTab = "overview";
      if (state.view === "messages" && state.session) loadNetwork();
      return true;
    }
    const conversation = event.target.closest("[data-conversation]");
    if (conversation) {
      state.selectedConversationId = conversation.dataset.conversation;
      state.messageListOnly = false;
      if (state.remote) manageConversation(state.selectedConversationId, "read").then(loadNetwork).catch(() => {});
      return true;
    }
    const loadMessages = event.target.closest("[data-load-messages]");
    if (loadMessages) {
      const id = loadMessages.dataset.loadMessages;
      state.messagePageSizes = { ...state.messagePageSizes, [id]: (state.messagePageSizes[id] || 40) + 40 };
      return true;
    }
    const card = event.target.closest("[data-open]");
    if (card) {
      state.selectedId = card.dataset.open;
      state.view = "detail";
      state.projectDetailTab = "overview";
      return true;
    }
    const category = event.target.closest("[data-category]");
    if (category) {
      state.category = category.dataset.category;
      return true;
    }
    if (
      event.target.closest("[data-modal-close]") ||
      event.target === modalRoot.querySelector("[data-modal-backdrop]")
    )
      closeModal();
        return false;
  };
}

