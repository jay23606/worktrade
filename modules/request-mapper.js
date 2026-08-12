export function mapRemoteRequest(request) {
  const name = request.profiles?.display_name || "WorkTrade member";
  return {
    id: request.id,
    version: request.version,
    ownerId: request.owner_id,
    owner: name,
    initials: name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    title: request.title,
    category: request.kind[0].toUpperCase() + request.kind.slice(1),
    location:
      request.location_visibility === "region"
        ? request.location_text || "Region not specified"
        : "Location shared with participants",
    distance: "—",
    urgency: request.urgency_text || "Flexible",
    status: request.stage,
    description: request.description,
    constraints: request.constraints || "",
    skills: (request.work_request_skills || []).map((item) => item.skill),
    exchange: request.exchange_modes || ["cash", "barter", "hybrid"],
    cashBudget: request.cash_budget_cents
      ? Math.round(request.cash_budget_cents / 100)
      : 0,
    offersInReturn: request.exchange_summary
      ? [request.exchange_summary]
      : ["Open to a fair proposal"],
    createdAt: request.created_at,
    offers: [],
    updates: [],
    messages: [],
    followers: [],
    reports: [],
  };
}
