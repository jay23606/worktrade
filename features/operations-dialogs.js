export function createOperationsDialogs({ getState, openModal, esc, notify, getModerationQueue, getPilotDashboard, getMyPilotFeedback }) {
  const state = getState();
  async function moderationConsoleModal() {
    try {
      const queue = await getModerationQueue();
      openModal(
        `<span class="eyebrow">Private staff workspace · ${esc(queue.role)}</span><h2>Safety review queue</h2><p>Internal notes and reporter identities are confidential. Immediate danger belongs with local emergency services.</p><section class="moderation-queue"><h3>Open reports</h3>${queue.reports
          .map(
            (report) =>
              `<article><span class="category">${esc(report.category)} · ${esc(report.severity)}</span><h3>${esc(report.target_name || report.target_type)}</h3><p>${esc(report.detail)}</p><small>Reported by ${esc(report.reporter_name)} · ${esc(report.reporter_status)}</small><button class="secondary" data-review-report="${report.id}">Review case</button></article>`,
          )
          .join("") || "<p>No open reports.</p>"}<h3>Open appeals</h3>${queue.appeals
          .map(
            (appeal) =>
              `<article><p>${esc(appeal.statement)}</p><button class="secondary" data-review-appeal="${appeal.id}">Review appeal</button></article>`,
          )
          .join("") || "<p>No open appeals.</p>"}</section>`,
      );
    } catch (error) {
      notify(error.message);
    }
  }
  
  async function pilotDashboardModal() {
    try {
      const dashboard = await getPilotDashboard();
      const m = dashboard.metrics;
      openModal(
        `<span class="eyebrow">Private pilot operations</span><h2>Pilot dashboard</h2><div class="pilot-metrics">${[
          ["Members", m.members], ["Open work", m.open_work], ["Stalled", m.stalled],
          ["Open reports", m.open_reports], ["Open feedback", m.open_feedback], ["Email failed", m.email_failed],
        ].map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join("")}</div>
        <h3>Activation funnel</h3><div class="pilot-funnel">${Object.entries(dashboard.funnel).map(([step,value]) => `<div><b>${value}</b><span>${esc(step.replaceAll("_"," "))}</span></div>`).join("")}</div>
        <section class="moderation-queue"><h3>Pilot feedback</h3>${dashboard.feedback.map((item) => `<article><span class="category">${esc(item.category)} · ${esc(item.severity)}</span><h3>${esc(item.reporter_name)}</h3><p>${esc(item.body)}</p><small>${esc(item.view_name)}${item.workflow_stage ? ` · ${esc(item.workflow_stage)}` : ""} · ${esc(item.status)}</small><button class="secondary" data-triage-feedback="${item.id}">Triage and reply</button></article>`).join("") || "<p>No pilot feedback yet.</p>"}</section>
        <section class="moderation-queue"><h3>Recent members</h3>${dashboard.recent_members.map((member) => `<article><b>${esc(member.display_name)}</b><p>${esc(member.status)} · joined ${new Date(member.joined_at).toLocaleDateString()}</p></article>`).join("") || "<p>No members yet.</p>"}</section>`,
      );
    } catch (error) { notify(error.message); }
  }
  
  function pilotFeedbackModal() {
    if (!state.session) return notify("Sign in to send pilot feedback");
    const selected = state.requests.find((item) => item.id === state.selectedId);
    openModal(`<span class="eyebrow">Pilot feedback</span><h2>Help shape WorkTrade.</h2><p>We automatically include the current screen and workflow stage, but never private message contents.</p><form data-form="pilot-feedback" data-view="${esc(state.view)}" data-stage="${esc(selected?.stage || "")}" class="form-grid"><label>What kind?<select name="category"><option value="confusing">Confusing</option><option value="broken">Broken</option><option value="missing">Something is missing</option><option value="unsafe">Safety concern</option><option value="suggestion">Suggestion</option></select></label><label class="wide">What happened or would help?<textarea name="body" required minlength="10" maxlength="4000"></textarea></label><button class="primary wide">Send private feedback</button></form>`);
  }
  
  async function myPilotFeedbackModal() {
    try {
      const items = await getMyPilotFeedback();
      openModal(`<span class="eyebrow">Your pilot feedback</span><h2>Updates from the team</h2><section class="moderation-queue">${items.map((item) => `<article><span class="category">${esc(item.category)} · ${esc(item.status)}</span><p>${esc(item.body)}</p>${item.replies.map((reply) => `<blockquote><b>${esc(reply.author_name)}</b><p>${esc(reply.body)}</p></blockquote>`).join("")}<form data-form="pilot-feedback-reply" data-id="${item.id}" class="inline-form"><input name="body" required minlength="2" placeholder="Reply"><button class="secondary">Send</button></form></article>`).join("") || "<p>You have not sent feedback yet.</p>"}</section>`);
    } catch (error) { notify(error.message); }
  }
  
  async function pilotFeedbackTriageModal(id) {
    try {
      const dashboard = await getPilotDashboard();
      const item = dashboard.feedback.find((entry) => entry.id === id);
      if (!item) throw new Error("Feedback unavailable");
      openModal(`<span class="eyebrow">Pilot feedback triage</span><h2>${esc(item.reporter_name)}</h2><p>${esc(item.body)}</p><form data-form="pilot-feedback-triage" data-id="${id}" class="form-grid"><label>Status<select name="status">${["new","reviewing","planned","resolved","closed"].map(x=>`<option ${x===item.status?"selected":""}>${x}</option>`).join("")}</select></label><label>Severity<select name="severity">${["low","normal","high","blocking"].map(x=>`<option ${x===item.severity?"selected":""}>${x}</option>`).join("")}</select></label><label>Assign to<select name="assignee"><option value="">Unassigned</option>${dashboard.staff.map(s=>`<option value="${s.id}" ${s.id===item.assigned_to?"selected":""}>${esc(s.name)} · ${esc(s.role)}</option>`).join("")}</select></label><label class="wide">Internal note<textarea name="note">${esc(item.internal_note || "")}</textarea></label><label class="wide">Reply visible to member<textarea name="reply"></textarea></label><button class="primary wide">Save triage</button></form>`);
    } catch (error) { notify(error.message); }
  }
  
  function pilotInviteModal() {
    openModal(
      `<span class="eyebrow">Private pilot</span><h2>Enter your WorkTrade invite.</h2><p>This early community is intentionally small while we learn what makes work exchanges safe and useful.</p><form data-form="pilot-invite-redeem" class="form-grid"><label class="wide">Invite code<input name="invite_code" required autocomplete="one-time-code" spellcheck="false"></label><button class="primary wide">Join the pilot</button></form>`,
    );
  }
  
  function moderationDecisionModal(reportId) {
    openModal(
      `<span class="eyebrow">Staff case action</span><h2>Record a proportionate decision.</h2><form data-form="moderation-decision" data-report="${reportId}" class="form-grid"><label>Action<select name="action"><option value="note">Continue review</option><option value="dismissed">Dismiss</option><option value="warned">Warn</option><option value="restricted">Restrict interactions</option><option value="suspended">Suspend</option><option value="banned">Ban (admin only)</option><option value="resolved">Resolve without restriction</option></select></label><label>Restriction ends<input name="expires_at" type="datetime-local"></label><label class="wide">Internal rationale<textarea name="internal_note" required minlength="5" maxlength="4000"></textarea></label><label class="wide">Update visible to reporter<textarea name="reporter_update" maxlength="1000"></textarea></label><button class="primary wide">Record immutable action</button></form>`,
    );
  }
  
  function appealDecisionModal(appealId) {
    openModal(
      `<span class="eyebrow">Appeal review</span><h2>Uphold or restore access.</h2><form data-form="appeal-decision" data-appeal="${appealId}" class="form-grid"><label>Decision<select name="decision"><option value="granted">Grant and restore access</option><option value="upheld">Uphold restriction</option></select></label><label class="wide">Internal rationale<textarea name="internal_note" required minlength="5" maxlength="4000"></textarea></label><label class="wide">Explanation visible to member<textarea name="member_update" required minlength="5" maxlength="1000"></textarea></label><button class="primary wide">Record appeal decision</button></form>`,
    );
  }
  
  function moderationAppealModal(restrictionId) {
    openModal(
      `<span class="eyebrow">Appeal a restriction</span><h2>Explain what should be reconsidered.</h2><p>A different moderator should review appeals when staffing permits.</p><form data-form="moderation-appeal" data-restriction="${restrictionId}" class="form-grid"><label class="wide">Appeal statement<textarea name="statement" required minlength="20" maxlength="4000"></textarea></label><button class="primary wide">Submit appeal</button></form>`,
    );
  }
  
    return { appealDecisionModal, moderationAppealModal, moderationConsoleModal, moderationDecisionModal, myPilotFeedbackModal, pilotDashboardModal, pilotFeedbackModal, pilotFeedbackTriageModal, pilotInviteModal };
}

