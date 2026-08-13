export function createCommunitySubmitHandler(deps) {
  return async function handleCommunitySubmit(form, data) {
    const state = deps.getState();
    const kind = form.dataset.form;
    try {
      if (kind === "create-circle") {
        const id = await deps.createCircle({
          name: data.get("name"), description: data.get("description"), visibility: data.get("visibility"), rules: data.get("rules"),
        });
        deps.closeModal(); state.selectedCircleId = id; await deps.loadNetwork(); deps.notify("Trusted circle created");
      } else if (kind === "circle-resource") {
        await deps.saveCircleResource(form.dataset.circle, null, {
          kind: data.get("kind"), name: data.get("name"), description: data.get("description"), availability: data.get("availability"),
        });
        deps.closeModal(); await deps.loadNetwork(); deps.notify("Resource shared with circle");
      } else if (kind === "circle-invite") {
        await deps.inviteCircleMember(form.dataset.circle, data.get("profile"));
        deps.closeModal(); await deps.loadNetwork(); deps.notify("Circle invitation sent");
      } else if (kind === "circle-post") {
        await deps.createCircleRequest(form.dataset.circle, {
          title: data.get("title"), description: data.get("description"), kind: data.get("kind"), location: data.get("location"), urgency: data.get("urgency"),
          cash_budget_cents: "", publish: true,
          skills: String(data.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean),
          exchange_modes: ["barter", "hybrid"], exchange_summary: data.get("exchange_summary"), constraints: data.get("constraints"),
        });
        deps.closeModal(); await deps.loadNetwork(); deps.notify("Private circle work posted");
      } else if (kind === "circle-settings") {
        await deps.updateCircleSettings(form.dataset.circle, {
          description: data.get("description"), visibility: data.get("visibility"), rules: data.get("rules"),
        });
        deps.closeModal(); await deps.loadNetwork(); deps.notify("Circle settings updated");
      } else if (kind === "chain-builder") {
        const count = Number(data.get("link_count"));
        const links = Array.from({ length: count }, (_, index) => ({
          from_profile_id: data.get(`from_${index}`), to_profile_id: data.get(`to_${index}`),
          value_description: data.get(`value_${index}`), position: index,
          due_at: data.get(`due_${index}`) ? new Date(`${data.get(`due_${index}`)}T12:00:00`).toISOString() : "",
          conditions: data.get(`conditions_${index}`),
        }));
        const payload = { title: data.get("title"), description: data.get("description"), execution_mode: data.get("execution_mode"), links };
        if (form.dataset.chain) await deps.reviseTradeChain(form.dataset.chain, Number(form.dataset.version), payload);
        else await deps.createTradeChain(form.dataset.circle, { title: payload.title, description: payload.description, executionMode: payload.execution_mode, links });
        deps.closeModal(); await deps.loadNetwork();
        deps.notify(form.dataset.chain ? "Chain revised; confirmations reset" : "Trade chain proposed");
      } else if (kind === "chain-message") {
        await deps.manageTradeChain(form.dataset.chain, "message", { body: data.get("body") });
        form.reset(); await deps.loadNetwork();
      } else if (kind === "chain-hold") {
        await deps.manageTradeChain(form.dataset.chain, "hold", {
          link_id: form.dataset.link, kind: data.get("kind"), detail: data.get("detail"),
          review_at: data.get("review_at") ? new Date(`${data.get("review_at")}T12:00:00`).toISOString() : "",
        });
        deps.closeModal(); await deps.loadNetwork(); deps.notify("Chain dependency recorded");
      } else {
        return false;
      }
    } catch (error) {
      deps.notify(error.message);
    }
    return true;
  };
}
