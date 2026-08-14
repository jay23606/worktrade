export function createAccountSubmitHandler(deps) {
  return async function handleAccountSubmit(form, data) {
    const state = deps.getState();
    const kind = form.dataset.form;
    try {
      if (kind === "sign-in") {
        await deps.signInWithEmail(data.get("email"));
        deps.closeModal(); deps.notify("Check your email for the secure link");
      } else if (kind === "pilot-invite-redeem") {
        await deps.redeemPilotInvite(data.get("invite_code"));
        sessionStorage.removeItem("worktrade-pilot-invite");
        deps.closeModal(); await deps.bootstrapBackend(); deps.notify("Welcome to the WorkTrade pilot");
      } else if (kind === "pilot-invite-create") {
        const invite = await deps.createPilotInvite(
          data.get("label"), Number(data.get("max_uses")),
          data.get("expires_at") ? new Date(`${data.get("expires_at")}T23:59:59`).toISOString() : null,
        );
        const code = deps.esc(invite.code);
        deps.openModal(`<span class="eyebrow">Invite created</span><h2>Copy this code now.</h2><p>Only a secure digest is stored, so it cannot be shown again.</p><div class="invite-code"><code>${code}</code></div><button class="primary" data-copy-text="${code}">Copy invite code</button>`);
      } else if (kind === "pilot-feedback") {
        await deps.submitPilotFeedback(data.get("category"), data.get("body"), form.dataset.view, form.dataset.stage, { selected_id: state.selectedId || null });
        deps.closeModal(); deps.notify("Feedback sent privately to the pilot team");
      } else if (kind === "pilot-feedback-reply") {
        await deps.replyToPilotFeedback(form.dataset.id, data.get("body"));
        await deps.myPilotFeedbackModal(); deps.notify("Reply sent");
      } else if (kind === "pilot-feedback-triage") {
        await deps.managePilotFeedback(form.dataset.id, data.get("status"), data.get("severity"), data.get("assignee"), data.get("note"), data.get("reply"));
        await deps.pilotDashboardModal(); deps.notify("Feedback triage saved");
      } else if (kind === "preferences") {
        if (data.has("browser_notifications") && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
        state.notificationPreferences = await deps.saveNotificationPreferences({
          in_app: data.has("in_app"), email_enabled: data.has("email_enabled"), email_proposals: data.has("email_proposals"),
          email_messages: data.has("email_messages"), email_agreements: data.has("email_agreements"), email_reminders: data.has("email_reminders"),
          email_network: data.has("email_network"), email_safety: data.has("email_safety"),
        });
        deps.closeModal(); deps.notify("Notification preferences saved");
      } else if (kind === "deactivate") {
        await deps.deactivateMyAccount();
        const seed = deps.cloneSeed();
        deps.batchState(() => {
          state.session = null; state.remote = false; state.profile = seed.profile; state.requests = seed.requests; state.notifications = [];
        });
        deps.closeModal(); deps.notify("Account deactivated; showing device demo");
      } else if (kind === "moderation-decision") {
        await deps.moderateReport(
          form.dataset.report, data.get("action"), data.get("internal_note"), data.get("reporter_update"),
          data.get("expires_at") ? new Date(data.get("expires_at")).toISOString() : null,
        );
        deps.closeModal(); deps.notify("Immutable moderation action recorded");
      } else if (kind === "appeal-decision") {
        await deps.resolveModerationAppeal(form.dataset.appeal, data.get("decision"), data.get("internal_note"), data.get("member_update"));
        deps.closeModal(); deps.notify("Appeal decision recorded");
      } else if (kind === "moderation-appeal") {
        await deps.submitModerationAppeal(form.dataset.restriction, data.get("statement"));
        deps.closeModal(); await deps.hydrateAccount(); deps.notify("Appeal submitted for review");
      } else {
        return false;
      }
    } catch (error) {
      deps.notify(error.message);
    }
    return true;
  };
}
