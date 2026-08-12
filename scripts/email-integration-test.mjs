import assert from "node:assert/strict";

const base = process.env.WT_SUPABASE_URL;
const publishable = process.env.WT_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.WT_SUPABASE_SECRET_KEY;
if (!base || !publishable || !secret)
  throw new Error("Integration test credentials are not configured");

const run = Date.now();
const password = `Wt-${crypto.randomUUID()}-Aa9!`;
const created = [];

async function request(
  path,
  { key = publishable, token = key, method = "GET", body, headers = {} } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok)
    throw Object.assign(
      new Error(data?.message || data?.error || data?.hint || `HTTP ${response.status}`),
      { status: response.status, data },
    );
  return data;
}

const rpc = (token, name, body = {}) =>
  request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });

async function createUser(role) {
  const name = `Email ${role}`;
  const email = `worktrade-email-${role}-${run}@example.com`;
  const record = await request("/auth/v1/admin/users", {
    key: secret,
    token: secret,
    method: "POST",
    body: { email, password, email_confirm: true, user_metadata: { display_name: name } },
  });
  created.push(record.id);
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  const user = { id: record.id, token: session.access_token };
  await rpc(user.token, "set_my_profile", {
    payload: { display_name: name, location_text: "Richmond, VA", bio: "Email integration account", needs: [], offers: [] },
  });
  return user;
}

async function cleanup() {
  for (const id of created.reverse()) {
    try {
      await request(`/auth/v1/admin/users/${id}`, { key: secret, token: secret, method: "DELETE" });
    } catch {}
  }
}

async function createRequest(owner, title) {
  return rpc(owner.token, "create_work_request", {
    payload: {
      title,
      description: "Temporary request for transactional email testing.",
      kind: "build",
      publish: true,
      visibility: "public",
      exchange_modes: ["barter"],
      skills: ["Testing"],
    },
  });
}

async function offer(provider, requestId, privateScope) {
  return rpc(provider.token, "submit_trade_offer", {
    target_request_id: requestId,
    payload: {
      mode: "barter",
      scope: privateScope,
      exchange_summary: "A private exchange description",
      duration: "One day",
      exclusions: "",
      responsibilities: { provider: "Test", requester: "Test" },
      milestones: [],
      questions: "Private question text",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
}

try {
  const [owner, provider] = await Promise.all([
    createUser("Owner"),
    createUser("Provider"),
  ]);
  const privateScope = `CONFIDENTIAL-SCOPE-${crypto.randomUUID()}`;
  const firstRequest = await createRequest(owner, "Email outbox test one");
  await offer(provider, firstRequest, privateScope);

  let outbox = await request(
    `/rest/v1/email_outbox?profile_id=eq.${owner.id}&select=*`,
    { key: secret, token: secret },
  );
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].template_key, "proposal");
  assert.equal(outbox[0].status, "pending");
  assert.equal(JSON.stringify(outbox[0]).includes(privateScope), false);
  assert.equal(JSON.stringify(outbox[0]).includes("Private question text"), false);

  const targetOutboxId = outbox[0].id;
  let dispatch;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    dispatch = await request("/functions/v1/email-dispatch", {
      key: secret,
      token: secret,
      method: "POST",
      body: { limit: 100 },
    });
    outbox = await request(
      `/rest/v1/email_outbox?id=eq.${targetOutboxId}&select=*`,
      { key: secret, token: secret },
    );
    if (outbox[0].status === "sent") break;
  }
  assert.equal(dispatch.mode, "sink");
  assert.equal(outbox[0].status, "sent");
  const attempts = await request(
    `/rest/v1/email_delivery_attempts?outbox_id=eq.${outbox[0].id}&select=*`,
    { key: secret, token: secret },
  );
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].delivery_mode, "sink");
  assert.equal(attempts[0].outcome, "sent");

  await request("/rest/v1/notification_preferences", {
    token: owner.token,
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: {
      profile_id: owner.id,
      in_app: true,
      email_enabled: true,
      email_proposals: false,
      email_messages: true,
      email_agreements: true,
      email_reminders: false,
      email_network: true,
      email_safety: true,
    },
  });
  const secondRequest = await createRequest(owner, "Email outbox test two");
  await offer(provider, secondRequest, "A second private scope");
  const afterOptOut = await request(
    `/rest/v1/email_outbox?profile_id=eq.${owner.id}&select=id`,
    { key: secret, token: secret },
  );
  assert.equal(afterOptOut.length, 1);

  const emptyDispatch = await request("/functions/v1/email-dispatch", {
    key: secret,
    token: secret,
    method: "POST",
    body: { limit: 10 },
  });
  assert.equal(emptyDispatch.results.some((item) => item.id === outbox[0].id), false);
  console.log("WorkTrade sink-mode transactional email lifecycle passed against hosted Supabase.");
} finally {
  await cleanup();
}
