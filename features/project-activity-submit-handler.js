export function createProjectActivitySubmitHandler(deps) {
  return async function handleProjectActivitySubmit(form, data) {
    const state = deps.getState();
    const kind = form.dataset.form;
    if (kind === "hold") {
      const request = state.requests.find((item) => item.id === form.dataset.id);
      try {
        if (state.remote) {
          await deps.performAgreementAction("hold", request.agreement.id, request.agreement.version, {
            kind: data.get("type").toLowerCase().replaceAll(" ", "_").replace("_or_", "_"),
            owner: data.get("owner"), detail: data.get("detail"), review_at: data.get("reviewDate"),
          });
          await deps.loadRemoteWorkspace();
        } else {
          deps.updateRequests((list) => {
            const target = list.find((item) => item.id === form.dataset.id);
            target.hold = { type: data.get("type"), owner: data.get("owner"), detail: data.get("detail"), reviewDate: data.get("reviewDate") };
            return list;
          });
        }
        deps.closeModal(); deps.notify("Dependency hold added");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "update" || kind === "message") {
      try {
        if (state.remote) {
          if (kind === "update") await deps.addProjectUpdate(state.selectedId, data.get("text"));
          else await deps.sendProjectMessage(state.selectedId, data.get("text"));
          await deps.loadRemoteWorkspace();
        } else {
          deps.updateRequests((list) => {
            const request = list.find((item) => item.id === state.selectedId);
            const entry = { id: crypto.randomUUID(), author: state.profile.name, text: data.get("text"), date: "Today" };
            if (kind === "update") request.updates.push(entry);
            else { request.messages ||= []; request.messages.push({ ...entry, authorId: "me" }); }
            return list;
          });
        }
        form.reset(); deps.notify(kind === "update" ? (state.remote ? "Project journal updated" : "Update posted") : "Message sent");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "report") {
      try {
        if (state.remote) await deps.submitSafetyReport("request", form.dataset.id, data.get("reason"), data.get("detail"));
        else deps.updateRequests((list) => {
          const request = list.find((item) => item.id === form.dataset.id);
          request.reports ||= [];
          request.reports.push({ id: crypto.randomUUID(), reporterId: "me", reason: data.get("reason"), detail: data.get("detail"), status: "submitted", createdAt: new Date().toISOString() });
          return list;
        });
        deps.closeModal(); deps.notify(state.remote ? "Private report submitted for moderator review" : "Private report recorded for moderator review");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "profile-item") {
      const item = String(data.get("item") || "").trim();
      if (item.length < 2 || item.length > 100) { deps.notify("Use 2–100 characters for each offer or need.", "warning"); return true; }
      const profile = structuredClone(state.profile);
      profile[form.dataset.list].push(item);
      try {
        if (state.remote) await deps.updateMyProfile({ display_name: profile.name, location_text: profile.location, bio: profile.bio, needs: profile.needs, offers: profile.offers });
        state.profile = profile;
        if (!state.remote) deps.persist();
        form.reset(); deps.notify("Profile updated");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "review") {
      try {
        await deps.submitReview({
          agreement_id: form.dataset.agreement, subject_id: form.dataset.subject,
          reliability: Number(data.get("reliability")), communication: Number(data.get("communication")),
          work_quality: Number(data.get("work_quality")), exchange_fairness: Number(data.get("exchange_fairness")), body: data.get("body"),
        });
        deps.closeModal(); deps.notify("Contextual review published");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    if (kind === "evidence") {
      const file = form.elements.photo.files[0];
      if (!file || file.size > 10485760) { deps.notify("Choose a JPG, PNG, or WebP under 10 MB."); return true; }
      try {
        await deps.uploadWorkEvidence(form.dataset.agreement, file, { skill: data.get("skill"), description: data.get("description") });
        form.reset(); await deps.loadRemoteWorkspace();
        if (!state.profile.onboardingComplete && !state.profile.onboardingSkipped && !sessionStorage.getItem("worktrade:onboarding-shown")) {
          sessionStorage.setItem("worktrade:onboarding-shown", "true"); setTimeout(deps.welcomeSetupModal, 150);
        }
        deps.notify("Work evidence added");
      } catch (error) { deps.notify(error.message); }
      return true;
    }
    return false;
  };
}
