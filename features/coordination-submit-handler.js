export function createCoordinationSubmitHandler(deps) {
  const selectedRequest = () => {
    const state = deps.getState();
    return state.requests.find((request) => request.id === state.selectedId);
  };

  return async function handleCoordinationSubmit(form, data) {
    const kind = form.dataset.form;
    try {
      if (kind === "schedule") {
        await deps.setAgreementSchedule(form.dataset.agreement, Number(form.dataset.version), {
          start_at: data.get("start_at") ? new Date(data.get("start_at")).toISOString() : "",
          timezone: data.get("timezone"), working_windows: data.get("working_windows"),
        });
        deps.closeModal(); await deps.loadRemoteWorkspace(); deps.notify("Schedule saved");
      } else if (kind === "schedule-proposal") {
        const start = new Date(data.get("start_at"));
        const end = new Date(data.get("end_at"));
        if (end <= start) { deps.notify("End time must be after the start"); return true; }
        await deps.proposeScheduleWindow(form.dataset.agreement, {
          start_at: start.toISOString(), end_at: end.toISOString(), timezone: data.get("timezone"),
          weather_sensitive: data.has("weather_sensitive"), location_detail: data.get("location_detail"),
          arrival_notes: data.get("arrival_notes"), counter_to: form.dataset.counter || "",
        });
        deps.closeModal(); await deps.loadRemoteWorkspace();
        deps.notify(form.dataset.counter ? "Counterproposal sent" : "Schedule proposal sent");
      } else if (kind === "availability") {
        await deps.saveMyAvailability({
          timezone: data.get("timezone"), lead_time_hours: Number(data.get("lead_time_hours")) || 0,
          weekly_windows: String(data.get("windows") || "").split(/\n|;/).map((item) => item.trim()).filter(Boolean),
        });
        deps.notify("Availability saved");
      } else if (kind === "ledger-item") {
        await deps.saveLedgerItem(form.dataset.agreement, null, {
          item_type: data.get("item_type"), description: data.get("description"), responsibility: data.get("responsibility"),
          contribution_mode: data.get("contribution_mode"), status: data.get("status"), quantity: data.get("quantity"), unit: data.get("unit"),
          estimated_cost_cents: data.get("estimated_cost") ? Math.round(Number(data.get("estimated_cost")) * 100) : "",
          barter_description: data.get("barter_description"),
        });
        await deps.agreementLedgerModal(selectedRequest()); deps.notify("Preparation item added");
      } else if (kind === "ledger-status") {
        await deps.manageLedgerItem(form.dataset.item, "status", {
          status: data.get("status"), quantity_actual: data.get("quantity_actual"),
          actual_cost_cents: data.get("actual_cost") ? Math.round(Number(data.get("actual_cost")) * 100) : "",
        });
        await deps.agreementLedgerModal(selectedRequest()); deps.notify("Preparation status updated");
      } else if (kind === "ledger-receipt") {
        const file = form.elements.receipt.files[0];
        if (!file || file.size > 10485760) { deps.notify("Choose a JPG, PNG, or WebP under 10 MB."); return true; }
        await deps.uploadLedgerReceipt(form.dataset.agreement, form.dataset.item, file);
        await deps.agreementLedgerModal(selectedRequest()); deps.notify("Receipt or item photo added");
      } else if (kind === "work-issue") {
        await deps.reportWorkIssue(form.dataset.agreement, {
          category: data.get("category"), title: data.get("title"), detail: data.get("detail"),
          milestone_id: "", obligation_id: "", unaffected_work_can_continue: data.has("continue"),
        });
        await deps.changeOrderHubModal(selectedRequest()); deps.notify("Work issue documented");
      } else if (kind === "change-order") {
        await deps.proposeChangeOrder(form.dataset.issue, {
          scope_delta: data.get("scope_delta"), time_delta_minutes: Number(data.get("time_delta_minutes")) || 0,
          cash_delta_cents: Math.round((Number(data.get("cash_delta")) || 0) * 100),
          barter_delta: data.get("barter_delta"), schedule_delta: data.get("schedule_delta"),
        });
        await deps.changeOrderHubModal(selectedRequest()); deps.notify("Change order sent for approval");
      } else if (kind === "issue-evidence") {
        const file = form.elements.photo.files[0];
        if (!file || file.size > 10485760) { deps.notify("Choose a JPG, PNG, or WebP under 10 MB."); return true; }
        await deps.uploadWorkIssueEvidence(form.dataset.agreement, form.dataset.issue, file, data.get("caption"));
        await deps.changeOrderHubModal(selectedRequest()); deps.notify("Private issue evidence added");
      } else {
        return false;
      }
    } catch (error) {
      deps.notify(error.message);
    }
    return true;
  };
}
