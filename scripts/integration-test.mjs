import assert from "node:assert/strict";

const base = process.env.WT_SUPABASE_URL;
const publishable = process.env.WT_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.WT_SUPABASE_SECRET_KEY;
if (!base || !publishable || !secret) throw new Error("Integration test credentials are not configured");

const run = Date.now();
const password = `Wt-${crypto.randomUUID()}-Aa9!`;
const users = [
  { email: `worktrade-owner-${run}@example.com`, name: "Integration Owner" },
  { email: `worktrade-provider-${run}@example.com`, name: "Integration Provider" },
];
const created = [];
const uploaded = [];

async function request(path, { key = publishable, token = key, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error(data?.message || data?.error_description || data?.hint || data?.error || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}

async function rpc(token, name, body) {
  return request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });
}

async function edgeAction(token, action, agreementId, expectedVersion, payload = {}) {
  const result = await request("/functions/v1/wt-agreement-action", { token, method: "POST", body: { action, agreementId, expectedVersion, payload } });
  return result.agreement;
}

async function createUser(user) {
  const record = await request("/auth/v1/admin/users", { key: secret, token: secret, method: "POST", body: { email: user.email, password, email_confirm: true, user_metadata: { display_name: user.name } } });
  created.push(record.id);
  const session = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email: user.email, password } });
  return { ...user, id: record.id, token: session.access_token };
}

async function cleanup() {
  for (const path of uploaded) {
    try { await fetch(`${base}/storage/v1/object/work-evidence/${path}`, { method: "DELETE", headers: { apikey: secret, Authorization: `Bearer ${secret}` } }); } catch {}
  }
  for (const id of created) {
    try { await request(`/auth/v1/admin/users/${id}`, { key: secret, token: secret, method: "DELETE" }); } catch {}
  }
}

try {
  const owner = await createUser(users[0]);
  const provider = await createUser(users[1]);

  await rpc(owner.token, "set_my_profile", { payload: { display_name: owner.name, location_text: "Richmond, VA", bio: "Owner test account", needs: ["Carpentry"], offers: ["Photography"] } });
  await rpc(provider.token, "set_my_profile", { payload: { display_name: provider.name, location_text: "Richmond, VA", bio: "Provider test account", needs: ["Photography"], offers: ["Carpentry"] } });

  const requestId = await rpc(owner.token, "create_work_request", { payload: { title: "Build integration-test shelving", description: "Build and install two sturdy workshop shelves.", kind: "build", location: "Richmond, VA", urgency: "This month", cash_budget_cents: 30000, visibility: "public", skills: ["Carpentry"] } });
  const offerId = await rpc(provider.token, "submit_trade_offer", { target_request_id: requestId, payload: { mode: "hybrid", scope: "Build and install two shelves", exchange_summary: "$200 and a product photography session", duration: "One weekend" } });

  await assert.rejects(() => rpc(provider.token, "accept_trade_offer", { target_offer_id: offerId }), /only the request owner/i);
  const agreementId = await rpc(owner.token, "accept_trade_offer", { target_offer_id: offerId });

  let rows = await rpc(owner.token, "get_my_agreements", {});
  let agreement = rows.find((row) => row.agreement.id === agreementId);
  assert.equal(agreement.agreement.status, "proposed");
  assert.equal(agreement.obligations.length, 2);

  await edgeAction(owner.token, "confirm", agreementId, agreement.agreement.version);
  rows = await rpc(provider.token, "get_my_agreements", {}); agreement = rows[0];
  await rpc(provider.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "confirm", payload: {} });
  rows = await rpc(owner.token, "get_my_agreements", {}); agreement = rows[0];
  assert.equal(agreement.agreement.status, "agreed");

  await rpc(owner.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "transition", payload: { status: "active" } });
  rows = await rpc(owner.token, "get_my_agreements", {}); agreement = rows[0];
  await request("/rest/v1/project_messages", { token: provider.token, method: "POST", headers: { Prefer: "return=minimal" }, body: { request_id: requestId, author_id: provider.id, body: "Materials are ready; arrival is scheduled for Saturday." } });
  const evidencePath = `${agreementId}/${provider.id}/${crypto.randomUUID()}.png`;
  const pixel = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const uploadResponse = await fetch(`${base}/storage/v1/object/work-evidence/${evidencePath}`, { method: "POST", headers: { apikey: publishable, Authorization: `Bearer ${provider.token}`, "Content-Type": "image/png", "x-upsert": "false" }, body: pixel });
  assert.equal(uploadResponse.ok, true, await uploadResponse.text()); uploaded.push(evidencePath);
  await request("/rest/v1/work_evidence", { token: provider.token, method: "POST", headers: { Prefer: "return=minimal" }, body: { agreement_id: agreementId, contributor_id: provider.id, skill: "Carpentry", description: "Installed and leveled shelves", asset_path: evidencePath } });

  await rpc(owner.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "milestone", payload: { milestone_id: agreement.milestones[0].id } });
  rows = await rpc(owner.token, "get_my_agreements", {}); agreement = rows[0];
  await rpc(owner.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "hold", payload: { kind: "materials", detail: "Waiting for brackets", owner: provider.name, review_at: new Date(Date.now() + 86400000).toISOString() } });
  rows = await rpc(provider.token, "get_my_agreements", {}); agreement = rows[0];
  const activeHold = agreement.holds.find((hold) => !hold.resolved_at);
  await rpc(provider.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "resolve_hold", payload: { hold_id: activeHold.id } });

  rows = await rpc(provider.token, "get_my_agreements", {}); agreement = rows[0];
  for (const obligation of agreement.obligations) {
    const responsible = obligation.responsible_profile_id === owner.id ? owner : provider;
    const counterpart = responsible.id === owner.id ? provider : owner;
    await rpc(responsible.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "fulfill", payload: { obligation_id: obligation.id } });
    rows = await rpc(counterpart.token, "get_my_agreements", {}); agreement = rows[0];
    await assert.rejects(() => rpc(responsible.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "approve", payload: { obligation_id: obligation.id } }), /another party/i);
    await rpc(counterpart.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "approve", payload: { obligation_id: obligation.id } });
    rows = await rpc(owner.token, "get_my_agreements", {}); agreement = rows[0];
  }

  await rpc(owner.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "transition", payload: { status: "review" } });
  rows = await rpc(provider.token, "get_my_agreements", {}); agreement = rows[0];
  await rpc(provider.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "transition", payload: { status: "completed" } });
  await request("/rest/v1/work_reviews", { token: owner.token, method: "POST", headers: { Prefer: "return=representation" }, body: { agreement_id: agreementId, reviewer_id: owner.id, subject_id: provider.id, reliability: 5, communication: 5, work_quality: 5, exchange_fairness: 5, body: "Clear scope and dependable follow-through." } });

  rows = await rpc(owner.token, "get_my_agreements", {});
  assert.equal(rows[0].agreement.status, "completed");
  assert.ok(rows[0].obligations.every((item) => item.status === "fulfilled"));
  assert.equal(rows[0].evidence.length, 1);
  console.log("WorkTrade two-user lifecycle passed against hosted Supabase.");
} finally {
  await cleanup();
}
